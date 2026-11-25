# Parlons ! — a real-time French conversation partner

A voice chatbot for learners of French built on the **Gemini Live API**. Learners talk out loud with "Camille", a
conversation partner who pitches her French to their level on the **ACTFL Proficiency Guidelines** scale
(Novice Low → Distinguished) and focuses on **meaning over form**.

## Teaching approach

**ACTFL-adapted.** Each of the 11 sublevels has its own guidance for Camille: speech rate, vocabulary, sentence
complexity, question types (yes/no and either/or for Novice, open narration for Intermediate High, opinion and
hypothesis for Advanced/Superior), the kinds of tasks she sets, and how much English support is allowed.
- **Fixed level:** Camille stays at the level the learner chose.
- **Adaptive (default):** she starts at the chosen level and moves up or down one sublevel at a time based on what
  the learner shows they can do. The level she is currently using is shown in the app, with a short note on what the
  learner did well.
- **"Not sure — find my level":** a relaxed placement conversation modelled on the warm-up / level-check / probe
  structure of an OPI.

**Meaning over form.** Camille responds to *what* the learner says. She does not correct errors explicitly or
explain grammar unless asked. When she doesn't understand, she negotiates meaning (clarification requests,
confirmation checks). Otherwise she uses implicit recasts at most. Tasks have a real purpose: information gaps,
role-plays with complications, stories, and opinions. **Finish & get feedback** ends with what the learner
communicated well, plus a few expressions that would help them say more next time.

**Learner supports:** Slower / Repeat / Hint buttons, typing instead of speaking, a transcript that can be blurred
for listening practice, and barge-in (you can interrupt Camille).

All of the teaching logic lives in [`shared/tutor.js`](shared/tutor.js). Edit that file to adjust the levels,
topics or persona.

## Class versions

Each class has its own link, so students go straight to their version:

| Link | Levels offered | Unit topics |
|---|---|---|
| `/francais-4` | Intermediate Low, **Intermediate Mid (target)**, Intermediate High | Unité 1 · Les arts et les artistes; Unité 2 · L'amitié et les relations |
| `/francais-5` | Intermediate Mid, **Intermediate High (target)**, Advanced Low (challenge) | Unité 1 · Les défis des ados; Unité 2 · L'immigration et la communauté |
| `/libre` | All 11 ACTFL levels | General topics only |

The home page (`/`) lets students pick their class. The server enforces each class's level range, so Camille
stays inside it in fixed, adaptive and "find my level" modes. The general topics are available in every class too.

**To add or change units,** edit [`shared/courses.js`](shared/courses.js). Each topic has a title, an emoji, and a
short `guide` that tells Camille what to talk about and which questions to ask. Push the change and Render
redeploys automatically.

## Well-being alerts

If a student says something suggesting they may be in danger (thoughts of suicide or self-harm, being hurt or
abused, being unsafe, or intending to hurt someone), Camille:

1. Silently raises an alert. She is told not to do this for everyday stress or figures of speech like « ce devoir me tue ».
2. Says a short, caring message in English and stops the French practice.
3. Ends the session and shows a "Let's pause here" screen: talk to a trusted adult or the school counselor, call
   or text 988, or call 911 in an emergency.
4. Emails the teacher the student's name, the class, what she noticed, and the last few exchanges.

Every alert is also written to **Render → Logs** (search for `WELL-BEING ALERT`), even if email isn't set up.
On the class pages, students must enter their name, and a tip on the setup screen tells them about this.

**To turn on email alerts (about 5 minutes):**
1. Sign up at <https://resend.com> **using the email address that should receive the alerts**.
2. In Resend, go to **API Keys → Create API key** and copy the key.
3. In Render, open your service → **Environment** and add `TEACHER_EMAIL` (that same address) and `RESEND_API_KEY`
   (the key). You can also set `TEACHER_TIMEZONE` (default `America/New_York`). Save, and Render redeploys.

On Resend's free plan, without verifying a domain, it can only send to your own sign-up address. That's
fine for this use. To send to several people (e.g. a counselor too), verify a domain in Resend and set
`ALERT_FROM_EMAIL`, then list the addresses comma-separated in `TEACHER_EMAIL`.

Camille only tells students their teacher is being notified when email alerts are configured.

> This is an AI safety net, not a monitoring system. It can miss things or raise false alarms, and it doesn't
> replace supervision or your school's procedures. Check your district's policy on student data in AI tools.

## How it works

```
Browser ──POST /api/token──▶ Node server (holds GEMINI_API_KEY)
   │                              └─▶ Gemini: create single-use ephemeral token,
   │                                  locked to the model + tutor config
   └──WebSocket (ephemeral token)──▶ Gemini Live API
        mic → 16 kHz PCM  ▶      ◀ 24 kHz audio, transcripts, level updates
```

Your API key never reaches the browser. Each conversation gets a token that can be used once, must connect
within 60 seconds, and expires after 30 minutes. `server/index.js` serves the built app and the token endpoint,
and it uses no dependencies beyond Node itself.

## Deploy to Render

1. Get a Gemini API key at <https://aistudio.google.com/apikey>.
2. At <https://dashboard.render.com>, choose **New → Blueprint** and connect this GitHub repository. Render reads
   `render.yaml` and creates a free web service.
   (Or choose **New → Web Service**: Runtime *Node*, Build command `npm ci --include=dev && npm run build`,
   Start command `npm start`.)
3. Fill in the environment variables when Render asks for them:
   | Variable | Required | Purpose |
   |---|---|---|
   | `GEMINI_API_KEY` | yes | Your Gemini API key |
   | `ACCESS_CODE` | recommended | Learners must enter this code before starting. Without it, anyone with the link can use your quota. |
   | `GEMINI_LIVE_MODEL` | no | Overrides the Live model (default `gemini-3.8-live`). Check the current IDs at <https://ai.google.dev/gemini-api/docs/models>. |
   | `TEACHER_EMAIL`, `RESEND_API_KEY` | recommended | Email well-being alerts to you (see [Well-being alerts](#well-being-alerts)). |
   | `SESSIONS_PER_HOUR_PER_IP` | no | Limits how many conversations one network can start per hour (default 30). |
4. Open the `https://….onrender.com` URL. Render serves it over HTTPS, which browsers require for the microphone.

If you change environment variables later, Render redeploys automatically. On the free plan the service sleeps
after 15 minutes without visitors, so the first visit afterwards takes about 30 seconds to load.

### Netlify (alternative)

`netlify.toml` and `netlify/functions/token.mjs` are still included, so the same repo can also deploy on Netlify:
import the repo and set the same environment variables.

## Run locally

```bash
npm install
cp .env.example .env   # then put your key in .env
npm run dev            # http://localhost:5173, with /api/token served by Vite
npm run check          # unit tests
```

Use Chrome, Edge, Safari or Firefox, and headphones if you can.
