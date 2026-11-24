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
