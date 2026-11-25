// Receives a well-being alert from the browser (raised by Camille) and notifies the teacher.
// Email is sent through Resend (https://resend.com) when RESEND_API_KEY and TEACHER_EMAIL are set.
// Every alert is also written to the server log (Render → Logs) as a backup.
import { getCourse } from '../shared/tutor.js';

export const FLAG_CATEGORIES = {
  'self-harm': 'Possible self-harm or suicidal thoughts',
  'harm-to-others': 'Possible intent to harm others',
  'abuse-or-unsafe': 'Possible abuse, being hurt, or being unsafe',
  other: 'Other serious well-being concern',
};

const json = (status, body) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });

const clean = (v, max) => String(v ?? '').replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, '').trim().slice(0, max);

export function buildAlert(body = {}) {
  const course = getCourse(clean(body.course, 40));
  const category = FLAG_CATEGORIES[body.category] ? body.category : 'other';
  const excerpt = (Array.isArray(body.excerpt) ? body.excerpt : [])
    .slice(-12)
    .map((l) => `${l?.who === 'tutor' ? 'Camille' : 'Student'}: ${clean(l?.text, 600)}`)
    .filter((l) => !l.endsWith(': '));
  return {
    student: clean(body.learnerName, 60) || '(no name given)',
    className: course?.name ?? 'Open practice',
    category,
    categoryLabel: FLAG_CATEGORIES[category],
    summary: clean(body.summary, 500) || '(no summary)',
    excerpt,
    time: new Date().toLocaleString('en-US', { timeZone: process.env.TEACHER_TIMEZONE || 'America/New_York', dateStyle: 'full', timeStyle: 'short' }),
  };
}

export function alertText(a) {
  return `Camille paused a conversation because of a possible well-being concern.

Student: ${a.student}
Class: ${a.className}
When: ${a.time}
Concern: ${a.categoryLabel}
What Camille noticed: ${a.summary}

Last part of the conversation (automatic transcript, may contain errors):
${a.excerpt.length ? a.excerpt.join('\n') : '(not available)'}

The student was told their teacher would be notified and was encouraged to talk to a trusted adult or the school counselor (and 988 / 911 if in immediate danger).
This alert comes from an AI and may be a false alarm, or may miss things. Please follow your school's procedures.`;
}

// Limit alerts per IP so the endpoint can't be used to spam your inbox.
const hits = new Map();
function limited(ip) {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < 3600_000);
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5000) hits.clear();
  return recent.length > 5;
}

export default async function flagHandler(req, ip = 'unknown') {
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed' });
  if (limited(ip)) return json(429, { error: 'Too many alerts' });
  let body;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: 'Invalid JSON body' });
  }
  const alert = buildAlert(body);
  const text = alertText(alert);
  console.warn(`\n===== WELL-BEING ALERT =====\n${text}\n============================\n`);

  const env = (k) => (globalThis.Netlify?.env?.get?.(k) ?? process.env[k]) || '';
  const key = env('RESEND_API_KEY');
  const to = env('TEACHER_EMAIL');
  if (!key || !to) return json(200, { notified: false, logged: true });

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        from: env('ALERT_FROM_EMAIL') || 'Parlons alerts <onboarding@resend.dev>',
        to: to.split(',').map((s) => s.trim()).filter(Boolean),
        subject: `⚠️ Parlons: well-being alert for ${alert.student} (${alert.className})`,
        text,
      }),
    });
    if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`);
    return json(200, { notified: true });
  } catch (err) {
    console.error('Could not email the well-being alert:', err);
    return json(200, { notified: false, logged: true });
  }
}
