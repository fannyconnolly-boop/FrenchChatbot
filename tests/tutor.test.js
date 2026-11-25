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
