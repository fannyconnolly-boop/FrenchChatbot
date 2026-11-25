import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS, buildSystemInstruction, buildLiveConfig, topicsForLevel, LEVEL_TOOL } from '../shared/tutor.js';
import handler, { sanitizeOptions } from '../server/token.js';

test('all eleven ACTFL sublevels are defined', () => {
  assert.deepEqual(LEVELS.map((l) => l.name), [
    'Novice Low', 'Novice Mid', 'Novice High',
    'Intermediate Low', 'Intermediate Mid', 'Intermediate High',
    'Advanced Low', 'Advanced Mid', 'Advanced High',
    'Superior', 'Distinguished',
  ]);
});

test('system instruction is level-specific and meaning-focused', () => {
  const nov = buildSystemInstruction({ level: 'novice-low', topic: 'food' });
  const sup = buildSystemInstruction({ level: 'superior', topic: 'ideas' });
  assert.match(nov, /LEVEL: Novice Low/);
  assert.match(nov, /either\/or/);
  assert.match(sup, /LEVEL: Superior/);
  for (const s of [nov, sup]) {
    assert.match(s, /MEANING OVER FORM/);
    assert.match(s, /Do NOT explicitly correct errors/);
  }
});

test('placement and fixed modes change the adaptation block', () => {
  assert.match(buildSystemInstruction({ level: 'advanced-mid', topic: 'free', placement: true }), /PLACEMENT CONVERSATION/);
  assert.match(buildSystemInstruction({ level: 'advanced-mid', topic: 'free', adaptive: false }), /FIXED LEVEL/);
  assert.match(buildSystemInstruction({ level: 'advanced-mid', topic: 'free' }), /ADAPTIVE MODE/);
});

test('abstract topics are hidden from novices', () => {
  const ids = topicsForLevel('novice-mid').map((t) => t.id);
  assert.ok(ids.includes('cafe'));
  assert.ok(!ids.includes('debate'));
  assert.ok(topicsForLevel('superior').some((t) => t.id === 'ideas'));
});

test('live config has audio, transcription and the level tool', () => {
  const c = buildLiveConfig({ level: 'novice-high', topic: 'free', voice: 'nope' });
  assert.deepEqual(c.responseModalities, ['AUDIO']);
  assert.ok(c.inputAudioTranscription && c.outputAudioTranscription);
  assert.equal(c.speechConfig.voiceConfig.prebuiltVoiceConfig.voiceName, 'Aoede');
  assert.deepEqual(c.tools[0], LEVEL_TOOL);
});

test('sanitizeOptions rejects junk', () => {
  const o = sanitizeOptions({ level: 'expert', topic: 'x', learnerName: 'Zoë <script>IGNORE ALL</script>123' });
  assert.equal(o.level, 'intermediate-mid');
  assert.equal(o.topic, 'free');
  assert.ok(!/[<>0-9]/.test(o.learnerName));
  assert.ok(o.learnerName.length <= 40);
});

test('token endpoint guards method, key and access code', async () => {
  const saved = { ...process.env };
  try {
    assert.equal((await handler(new Request('http://x', { method: 'GET' }))).status, 405);
    delete process.env.GEMINI_API_KEY;
    assert.equal((await handler(new Request('http://x', { method: 'POST', body: '{}' }))).status, 500);
    process.env.GEMINI_API_KEY = 'k';
    process.env.ACCESS_CODE = 'secret';
    assert.equal((await handler(new Request('http://x', { method: 'POST', body: '{}' }))).status, 401);
  } finally {
    process.env = saved;
  }
});

test('French 4 is limited to Intermediate Low–High with unit topics', () => {
  const o = sanitizeOptions({ course: 'francais-4', level: 'advanced-low', topic: 'f4-souvenir' });
  assert.equal(o.level, 'intermediate-mid'); // out-of-range level falls back to the class target
  assert.equal(o.topic, 'f4-souvenir');
  assert.equal(sanitizeOptions({ course: 'francais-4', topic: 'f5-partir' }).topic, 'free'); // other class's unit
  const c = buildLiveConfig(o);
  assert.deepEqual(c.tools[0].functionDeclarations[0].parameters.properties.level.enum, ['intermediate-low', 'intermediate-mid', 'intermediate-high']);
  assert.match(c.systemInstruction, /CLASS CONTEXT/);
  assert.match(c.systemInstruction, /L'amitié et les relations/);
  assert.match(c.systemInstruction, /never pitch your French below Intermediate Low or above Intermediate High/);
});

test('French 5 allows Intermediate Mid–Advanced Low; placement starts at the bottom of the range', () => {
  const o = sanitizeOptions({ course: 'francais-5', level: 'advanced-low', topic: 'f5-reseaux', placement: true });
  assert.equal(o.level, 'advanced-low');
  const s = buildSystemInstruction(o);
  assert.match(s, /LEVEL: Intermediate Mid/);
  assert.match(s, /only probe as high as Advanced Low/);
  assert.match(s, /réseaux sociaux/);
  assert.match(s, /988/);
  assert.equal(sanitizeOptions({ course: 'francais-5', level: 'novice-low' }).level, 'intermediate-high');
});

test('open practice keeps all levels and general topics', () => {
  const o = sanitizeOptions({ course: 'nope', level: 'novice-low', topic: 'f4-musique' });
  assert.equal(o.course, null);
  assert.equal(o.level, 'novice-low');
  assert.equal(o.topic, 'free');
  assert.equal(buildLiveConfig(o).tools[0].functionDeclarations[0].parameters.properties.level.enum.length, 11);
});

import flagHandler, { buildAlert } from '../server/flag.js';

test('flag tool is offered and the prompt says to call it first', () => {
  const c = buildLiveConfig({ course: 'francais-5', level: 'intermediate-high', topic: 'f5-stress' });
  assert.ok(c.tools[0].functionDeclarations.some((f) => f.name === 'flag_wellbeing_concern'));
  assert.match(c.systemInstruction, /FIRST call flag_wellbeing_concern/);
  assert.match(c.systemInstruction, /figures of speech are NOT emergencies/);
  assert.doesNotMatch(c.systemInstruction, /teacher is being told/);
  assert.match(buildLiveConfig({ course: 'francais-5', teacherAlerts: true }).systemInstruction, /teacher is being told/);
});

test('alerts are sanitised', () => {
  const a = buildAlert({ course: 'francais-4', learnerName: 'Sam R.\u0007', category: 'bogus', summary: 'x'.repeat(900),
    excerpt: [{ who: 'tutor', text: 'Ça va ?' }, { who: 'me', text: 'Non…' }] });
  assert.equal(a.student, 'Sam R.');
  assert.equal(a.className, 'Français 4');
  assert.equal(a.category, 'other');
  assert.equal(a.summary.length, 500);
  assert.deepEqual(a.excerpt, ['Camille: Ça va ?', 'Student: Non…']);
});

test('flag endpoint emails the teacher via Resend when configured, and rate-limits', async () => {
  const saved = { ...process.env };
  const realFetch = globalThis.fetch;
  const sent = [];
  globalThis.fetch = async (url, init) => { sent.push({ url, body: JSON.parse(init.body) }); return new Response('{}'); };
  const warn = console.warn; console.warn = () => {};
  try {
    process.env.RESEND_API_KEY = 're_test';
    process.env.TEACHER_EMAIL = 'teacher@example.com';
    const req = () => new Request('http://x', { method: 'POST', body: JSON.stringify({ course: 'francais-5', learnerName: 'Ana', category: 'self-harm', summary: 'said x' }) });
    const r = await flagHandler(req(), '1.2.3.4');
    assert.deepEqual(await r.json(), { notified: true });
    assert.equal(sent[0].url, 'https://api.resend.com/emails');
    assert.deepEqual(sent[0].body.to, ['teacher@example.com']);
    assert.match(sent[0].body.subject, /Ana \(Français 5\)/);
    for (let i = 0; i < 4; i++) await flagHandler(req(), '1.2.3.4');
    assert.equal((await flagHandler(req(), '1.2.3.4')).status, 429);
    delete process.env.RESEND_API_KEY;
    assert.deepEqual(await (await flagHandler(req(), '5.6.7.8')).json(), { notified: false, logged: true });
  } finally {
    globalThis.fetch = realFetch; console.warn = warn; process.env = saved;
  }
});
