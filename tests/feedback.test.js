import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildFeedbackPrompt, quoteIsReal, verifyReport } from '../shared/feedback.js';
import { buildSystemInstruction } from '../shared/tutor.js';
import feedbackHandler from '../server/feedback.js';

const lines = [
  { who: 'tutor', text: "Qu'est-ce qui fait un bon ami, pour toi ?" },
  { who: 'me', text: "Mon ami est gentil. Il est drôle aussi." },
  { who: 'tutor', text: 'Ah oui ? Raconte-moi un souvenir avec lui.' },
  { who: 'me', text: "L'été dernier on est allés à la plage et c'était super. Et toi, tu as un meilleur ami ?" },
];

test('Camille no longer gives spoken feedback; she points to the written report', () => {
  const s = buildSystemInstruction({ course: 'francais-4', level: 'intermediate-mid', topic: 'f4-bon-ami' });
  assert.match(s, /written feedback report is appearing on the screen/);
  assert.doesNotMatch(s, /two or three useful French expressions/);
});

test('prompt is differentiated by class and forbids invented quotes and ratings', () => {
  const p4 = buildFeedbackPrompt({ course: 'francais-4', transcript: 'x' });
  const p5 = buildFeedbackPrompt({ course: 'francais-5', transcript: 'x' });
  assert.match(p4, /parce que, par exemple/);
  assert.match(p4, /Mon ami est gentil parce qu'il m'aide/);
  assert.doesNotMatch(p4, /subjunctive/);
  assert.match(p5, /qui and que/);
  assert.match(p5, /conditional and the subjunctive/);
  assert.match(p5, /enrichissent leur communauté/);
  for (const p of [p4, p5]) {
    assert.match(p, /Never invent/);
    assert.match(p, /Do NOT give any proficiency rating/);
    assert.match(p, /in clear, friendly English/);
  }
});

test('quotes must match a single student line word for word', () => {
  assert.ok(quoteIsReal('mon ami est gentil', lines));
  assert.ok(quoteIsReal("L’été dernier on est allés à la plage", lines)); // curly apostrophe, case
  assert.ok(!quoteIsReal('Mon ami est très gentil', lines)); // altered
  assert.ok(!quoteIsReal('Raconte-moi un souvenir', lines)); // Camille's words
  assert.ok(!quoteIsReal('gentil. Il est drôle aussi. L\'été', lines)); // across lines
});

test('invented quotes and level labels are removed from the report', () => {
  const r = verifyReport({
    strengths: [
      { skill: 'Asking questions', quote: 'Et toi, tu as un meilleur ami ?', explanation: 'You kept the conversation going.' },
      { skill: 'Storytelling', quote: 'Nous avons nagé avec des dauphins', explanation: 'Invented!' },
    ],
    improvements: [{ skill: 'Elaborating', quote: 'Mon ami est gentil.', improved: "Mon ami est gentil parce qu'il m'écoute.", why: 'You sound Intermediate Mid now with a reason.' }],
    challenge: 'Give a reason with parce que.',
    limitations: '',
  }, lines);
  assert.equal(r.strengths.length, 1);
  assert.equal(r.strengths[0].skill, 'Asking questions');
  assert.equal(r.improvements.length, 1);
  assert.doesNotMatch(r.improvements[0].why, /Intermediate Mid/);
  assert.match(r.limitations, /couldn't be matched exactly/);
});

test('endpoint: too little speech gives an honest limitation without calling the model', async () => {
  const res = await feedbackHandler(new Request('http://x', { method: 'POST', body: JSON.stringify({ course: 'francais-4', transcript: [{ who: 'me', text: 'Oui.' }] }) }), 'a');
  const r = await res.json();
  assert.equal(r.strengths.length, 0);
  assert.match(r.limitations, /Not enough of what you said was captured/);
});

test('endpoint: calls Gemini with the transcript and verifies the answer', async () => {
  const saved = { ...process.env };
  const realFetch = globalThis.fetch;
  let sentPrompt = '';
  globalThis.fetch = async (url, init) => {
    sentPrompt = JSON.parse(init.body).contents[0].parts[0].text;
    const report = {
      strengths: [{ skill: 'Telling a story', quote: "L'été dernier on est allés à la plage", explanation: 'You told a memory in the past.' }],
      improvements: [{ skill: 'Explaining', quote: 'Mon ami est gentil.', improved: "Mon ami est gentil parce qu'il m'aide.", why: 'A reason develops the idea.' },
        { skill: 'Fake', quote: 'Je déteste mon ami', improved: 'x', why: 'x' }],
      challenge: 'Use parce que once per answer.', limitations: '',
    };
    return new Response(JSON.stringify({ candidates: [{ content: { role: 'model', parts: [{ text: JSON.stringify(report) }] } }] }), { headers: { 'content-type': 'application/json' } });
  };
  try {
    process.env.GEMINI_API_KEY = 'k';
    delete process.env.ACCESS_CODE;
    const res = await feedbackHandler(new Request('http://x', { method: 'POST', body: JSON.stringify({ course: 'francais-4', topic: 'f4-bon-ami', transcript: lines }) }), 'b');
    const r = await res.json();
    assert.equal(res.status, 200);
    assert.match(sentPrompt, /Student: Mon ami est gentil\. Il est drôle aussi\./);
    assert.match(sentPrompt, /Un bon ami/);
    assert.equal(r.strengths.length, 1);
    assert.equal(r.improvements.length, 1);
    assert.equal(r.challenge, 'Use parce que once per answer.');
  } finally {
    globalThis.fetch = realFetch;
    process.env = saved;
  }
});
