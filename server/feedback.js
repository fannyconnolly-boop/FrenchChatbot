// Writes the end-of-conversation feedback report from the captured transcript.
import { GoogleGenAI } from '@google/genai';
import { getTopic } from '../shared/tutor.js';
import {
  FEEDBACK_SCHEMA, MIN_STUDENT_WORDS, buildFeedbackPrompt, notEnoughEvidence, studentText, verifyReport, wordCount,
} from '../shared/feedback.js';

export const DEFAULT_FEEDBACK_MODEL = 'gemini-3.8-flash';

const json = (status, body) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });

const hits = new Map();
function limited(ip) {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < 3600_000);
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5000) hits.clear();
  return recent.length > 20;
}

/** Turn the browser's transcript into clean { who, text } lines (last ~80 turns, length-capped). */
export function cleanTranscript(raw) {
  return (Array.isArray(raw) ? raw : [])
    .map((l) => ({
      who: l?.who === 'tutor' ? 'tutor' : 'me',
      text: String(l?.text ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 1500),
    }))
    .filter((l) => l.text && !/^\[[A-Z_]+\]$/.test(l.text))
    .slice(-80);
}

export default async function feedbackHandler(req, ip = 'unknown') {
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed' });
  const env = (k) => (globalThis.Netlify?.env?.get?.(k) ?? process.env[k]) || '';
  const accessCode = env('ACCESS_CODE');
  if (accessCode && req.headers.get('x-access-code') !== accessCode) return json(401, { error: 'access_code_required' });
  if (limited(ip)) return json(429, { error: 'Too many feedback requests. Try again later.' });

  let body;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: 'Invalid JSON body' });
  }

  const lines = cleanTranscript(body.transcript);
  if (wordCount(studentText(lines)) < MIN_STUDENT_WORDS) return json(200, notEnoughEvidence());

  const apiKey = env('GEMINI_API_KEY');
  if (!apiKey) return json(500, { error: 'Server is missing GEMINI_API_KEY.' });

  const course = String(body.course ?? '');
  const prompt = buildFeedbackPrompt({
    course,
    topicLabel: getTopic(String(body.topic ?? ''), course).label,
    transcript: lines.map((l) => `${l.who === 'tutor' ? 'Camille' : 'Student'}: ${l.text}`).join('\n'),
  });

  const ai = new GoogleGenAI({ apiKey });
  const models = [...new Set([env('GEMINI_FEEDBACK_MODEL') || DEFAULT_FEEDBACK_MODEL, 'gemini-flash-latest'])];
  let lastErr;
  for (const model of models) {
    try {
      const res = await ai.models.generateContent({
        model,
        contents: prompt,
        config: { responseMimeType: 'application/json', responseSchema: FEEDBACK_SCHEMA, temperature: 0.3 },
      });
      return json(200, verifyReport(JSON.parse(res.text), lines));
    } catch (err) {
      lastErr = err;
      console.error(`Feedback with ${model} failed:`, err?.message ?? err);
    }
  }
  return json(502, { error: `Could not write the feedback report: ${lastErr?.message ?? lastErr}` });
}
