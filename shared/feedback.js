// End-of-conversation feedback report.
// The report is written from the captured transcript by a separate Gemini text request (server/feedback.js),
// so every quotation can be checked against what the student actually said.
import { getCourse } from './courses.js';

/** What each class should work on. Edit these lists to change the feedback focus. */
export const FEEDBACK_FOCUS = {
  'francais-4': {
    label: 'French 4 (class target: Intermediate Mid)',
    focus: [
      'Elaborating on ideas with explanations and examples (parce que, par exemple).',
      'Connecting sentences and ideas (mais, donc, quand, ensuite, alors, aussi…).',
      'Using different time frames, especially the past when telling about experiences.',
      'Asking questions and participating actively in the conversation.',
    ],
    example: {
      student: 'Mon ami est gentil.',
      improved: "Mon ami est gentil parce qu'il m'aide quand j'ai un problème. Par exemple, la semaine dernière, il m'a aidé avec mes devoirs.",
      why: 'Adding a reason (parce que), an example (par exemple) and a detail from the past turns a short statement into a developed answer.',
    },
  },
  'francais-5': {
    label: 'French 5 (solid Intermediate Mid, progressing toward Intermediate High)',
    focus: [
      'Developing ideas in depth instead of listing separate statements.',
      'Producing connected discourse that approaches paragraph length.',
      'Using dependent clauses, especially qui and que, to expand ideas.',
      'Moving between past, present and future time frames.',
      'Using the conditional and the subjunctive where appropriate for suggestions, possibilities and recommendations.',
      'Supporting opinions with explanations and specific examples.',
    ],
    example: {
      student: 'Les immigrants apportent de nouvelles traditions. Ils apportent de la nourriture.',
      improved:
        "Les immigrants enrichissent leur communauté en partageant des traditions qui permettent aux habitants de découvrir d'autres cultures. Par exemple, ils peuvent ouvrir des restaurants qui font découvrir de nouvelles cuisines.",
      why: 'The two separate statements become one connected idea: "qui" clauses explain the effect of the traditions, and "par exemple" adds a specific example.',
    },
  },
};

const DEFAULT_FOCUS = {
  label: 'Open practice',
  focus: [
    'Developing answers with reasons, details and examples.',
    'Connecting ideas with linking words.',
    'Asking questions and keeping the conversation going.',
  ],
  example: null,
};

export const MIN_STUDENT_WORDS = 12;

export const FEEDBACK_SCHEMA = {
  type: 'OBJECT',
  properties: {
    strengths: {
      type: 'ARRAY',
      description: 'Up to two strengths, each backed by an exact quotation of the student.',
      items: {
        type: 'OBJECT',
        properties: {
          skill: { type: 'STRING', description: 'Short name of the strength, in English.' },
          quote: { type: 'STRING', description: 'Exact words the student said, copied from a "Student:" line.' },
          explanation: { type: 'STRING', description: 'One or two sentences in English: why this worked well.' },
        },
        required: ['skill', 'quote', 'explanation'],
      },
    },
    improvements: {
      type: 'ARRAY',
      description: 'One or two communication skills to work on.',
      items: {
        type: 'OBJECT',
        properties: {
          skill: { type: 'STRING', description: 'Short name of the communication skill, in English.' },
          quote: { type: 'STRING', description: 'Exact words the student said, copied from a "Student:" line.' },
          improved: { type: 'STRING', description: 'An improved French version of the SAME idea.' },
          why: { type: 'STRING', description: 'One or two sentences in English: why the improved version is stronger.' },
        },
        required: ['skill', 'quote', 'improved', 'why'],
      },
    },
    challenge: { type: 'STRING', description: 'ONE specific, achievable goal for the next conversation, in English.' },
    limitations: {
      type: 'STRING',
      description: 'In English: any limits of the evidence (short or unclear transcript). Empty string if none.',
    },
  },
  required: ['strengths', 'improvements', 'challenge', 'limitations'],
};

export function buildFeedbackPrompt({ course: courseId, topicLabel = '', transcript }) {
  const course = getCourse(courseId);
  const f = FEEDBACK_FOCUS[course?.id] ?? DEFAULT_FOCUS;
  const example = f.example
    ? `
ILLUSTRATIVE EXAMPLE OF THE KIND OF IMPROVEMENT WANTED (do NOT reuse it; use the student's own sentences):
Student: "${f.example.student}"
Improved: "${f.example.improved}"
Why: ${f.example.why}`
    : '';

  return `You are an encouraging French teacher writing a short feedback report for a high-school student, right after their spoken conversation with Camille, an AI conversation partner.

CLASS: ${f.label}
${topicLabel ? `CONVERSATION TOPIC: ${topicLabel}\n` : ''}
FOCUS AREAS FOR THIS CLASS (choose the improvement skills from these):
${f.focus.map((x) => `- ${x}`).join('\n')}
${example}

RULES
- Write everything in clear, friendly English that a high-school student understands. Only the quoted student words and the improved versions are in French.
- Base every point on evidence in the transcript. Every "quote" must be copied EXACTLY, word for word, from a single "Student:" line: a contiguous piece of what the student said, without fixing it. Never invent, combine or paraphrase quotations, and never quote Camille.
- "What you did well": up to two strengths, each with a quote showing what the student successfully communicated or did (e.g. explained a reason, told a story in the past, asked Camille a question, kept the conversation going). If there is evidence for only one strength, give only one.
- "How you can improve": one or two communication skills from the focus areas. For each: quote something the student said, write an improved French version that keeps the student's own idea and meaning but develops it as the focus area describes (a realistic next step for this student, not native-level perfection), and explain in English why it is stronger.
- Focus on communication (developing, connecting and supporting ideas), not on correcting every grammar mistake. The improved version may quietly fix errors, but don't list or lecture about grammar errors.
- "Your next speaking challenge": ONE specific, achievable goal for the next conversation, tied to the improvement area (e.g. "Next time, give a reason with parce que and an example with par exemple for each opinion you share.").
- Be encouraging and constructive, and brief. Address the student as "you".
- Do NOT give any proficiency rating or level (no ACTFL levels like "Intermediate Mid", no grades or scores).
- The transcript was produced by automatic speech recognition and may contain mishearings or gaps. If it is short, unclear or seems incomplete, say so plainly in "limitations" and give fewer points rather than guessing. Otherwise leave "limitations" empty.

TRANSCRIPT ("Student:" lines are the student; "Camille:" lines are the AI partner):
${transcript}`;
}

/* ---------------- Checking the model's output against the transcript ---------------- */

/** Lowercase, unify apostrophes/quotes, drop punctuation, collapse spaces. Accents are kept. */
export function normalize(s) {
  return String(s ?? '')
    .toLowerCase()
    .replace(/[’‘`´]/g, "'")
    .replace(/[^\p{L}\p{N}' ]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function studentText(lines) {
  return lines.filter((l) => l.who === 'me').map((l) => l.text).join(' \n ');
}

export function wordCount(s) {
  return normalize(s).split(' ').filter(Boolean).length;
}

/** True only if the quote appears word for word in a single student line. */
export function quoteIsReal(quote, lines) {
  const q = normalize(quote);
  if (q.split(' ').filter(Boolean).length < 1) return false;
  return lines.some((l) => l.who === 'me' && ` ${normalize(l.text)} `.includes(` ${q} `));
}

const LEVEL_WORDS = /\b(novice|intermediate|advanced|superior|distinguished)[ -](low|mid|high)\b/gi;
const clean = (s, max = 600) => String(s ?? '').replace(LEVEL_WORDS, '').replace(/\s+/g, ' ').trim().slice(0, max);

/**
 * Keep only points whose quotations really appear in the student's speech, cap the counts,
 * and add a note when anything had to be dropped.
 */
export function verifyReport(report, lines) {
  const notes = [];
  const strengths = (Array.isArray(report?.strengths) ? report.strengths : [])
    .filter((s) => quoteIsReal(s?.quote, lines))
    .slice(0, 2)
    .map((s) => ({ skill: clean(s.skill, 80), quote: clean(s.quote, 400), explanation: clean(s.explanation) }));
  const improvements = (Array.isArray(report?.improvements) ? report.improvements : [])
    .filter((s) => quoteIsReal(s?.quote, lines) && s?.improved)
    .slice(0, 2)
    .map((s) => ({ skill: clean(s.skill, 80), quote: clean(s.quote, 400), improved: clean(s.improved, 600), why: clean(s.why) }));

  const offered = (report?.strengths?.length ?? 0) + (report?.improvements?.length ?? 0);
  if (strengths.length + improvements.length < offered) {
    notes.push("Some points were left out because their examples couldn't be matched exactly to the transcript.");
  }
  if (report?.limitations) notes.unshift(clean(report.limitations));
  return { strengths, improvements, challenge: clean(report?.challenge, 400), limitations: notes.filter(Boolean).join(' ') };
}

/** Report shown when too little of the student's speech was captured to give honest feedback. */
export function notEnoughEvidence() {
  return {
    strengths: [],
    improvements: [],
    challenge: 'Next time, try to answer each of Camille’s questions with at least two or three sentences.',
    limitations:
      "Not enough of what you said was captured in the transcript to give you personalized feedback. Keep the conversation going a little longer (and check that your microphone is on), then ask for feedback again.",
  };
}
