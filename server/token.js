// Mints a short-lived, single-use Gemini Live API token.
// The real API key never leaves the server. The token is locked to our model and
// tutor configuration, so it can't be reused for anything else.
import { GoogleGenAI } from '@google/genai';
import { buildLiveConfig, getCourse, getLevel, levelForCourse, allowedTopicIds } from '../shared/tutor.js';

export const DEFAULT_MODEL = 'gemini-3.8-live';

const json = (status, body) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });

export function sanitizeOptions(body = {}) {
  const course = getCourse(String(body.course ?? ''))?.id ?? null;
  const level = levelForCourse(getLevel(String(body.level ?? '')).id, course);
  const topic = String(body.topic ?? '');
  return {
    course,
    level,
    // Only topics offered to this course and level are accepted.
    topic: allowedTopicIds(course, level).includes(topic) ? topic : 'free',
    adaptive: body.adaptive !== false,
    placement: body.placement === true,
    voice: String(body.voice ?? ''),
    // Only letters, spaces, hyphens, apostrophes; max 40 chars. Keeps the system prompt clean.
    learnerName: String(body.learnerName ?? '')
      .replace(/[^\p{L}\s'-]/gu, '')
      .trim()
      .slice(0, 40),
  };
}

export default async function handler(req) {
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed' });

  const env = (k) => (globalThis.Netlify?.env?.get?.(k) ?? process.env[k]) || '';
  const apiKey = env('GEMINI_API_KEY');
  if (!apiKey) return json(500, { error: 'Server is missing GEMINI_API_KEY. Add it in Netlify → Site configuration → Environment variables.' });

  const accessCode = env('ACCESS_CODE');
  if (accessCode && req.headers.get('x-access-code') !== accessCode) {
    return json(401, { error: 'access_code_required' });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: 'Invalid JSON body' });
  }

  const opts = sanitizeOptions(body);
  const model = env('GEMINI_LIVE_MODEL') || DEFAULT_MODEL;
  const config = buildLiveConfig(opts);

  try {
    const ai = new GoogleGenAI({ apiKey, httpOptions: { apiVersion: 'v1alpha' } });
    const now = Date.now();
    const token = await ai.authTokens.create({
      config: {
        uses: 1,
        expireTime: new Date(now + 30 * 60 * 1000).toISOString(), // conversation may last up to 30 min
        newSessionExpireTime: new Date(now + 60 * 1000).toISOString(), // must connect within 1 min
        liveConnectConstraints: { model, config },
        httpOptions: { apiVersion: 'v1alpha' },
      },
    });
    return json(200, { token: token.name, model, config });
  } catch (err) {
    console.error('Token creation failed', err);
    return json(502, { error: `Could not create a Gemini session token: ${err?.message ?? err}` });
  }
}

