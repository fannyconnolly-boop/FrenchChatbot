import { GoogleGenAI } from '@google/genai';
import {
  LEVELS, VOICES, LEVEL_TOOL_NAME, FLAG_TOOL_NAME, COURSES, getCourse, getLevel, getTopic, topicsForLevel, courseLevels, levelForCourse, allowedTopicIds,
} from '../shared/tutor.js';
import { MicStream, PcmPlayer } from './audio.js';

const $ = (id) => document.getElementById(id);
const icon = (name) => `<svg class="i"><use href="#i-${name}" /></svg>`;
const store = {
  get(k, d) {
    try {
      return localStorage.getItem(k) ?? d;
    } catch {
      return d;
    }
  },
  set(k, v) {
    try {
      localStorage.setItem(k, v);
    } catch {}
  },
};

const meter = (levelId) => {
  const idx = LEVELS.findIndex((l) => l.id === levelId);
  return `<span class="meter" aria-hidden="true">${LEVELS.map((_, i) => `<i class="${i <= idx ? 'on' : ''}"></i>`).join('')}</span>`;
};

/* ---------------- Routing: home, open practice, or a class ---------------- */

const ALIASES = { 'french-4': 'francais-4', 'french4': 'francais-4', 'francais4': 'francais-4', 'f4': 'francais-4',
  'french-5': 'francais-5', 'french5': 'francais-5', 'francais5': 'francais-5', 'f5': 'francais-5' };
const slug = location.pathname.replace(/^\/+|\/+$/g, '').toLowerCase();
const course = getCourse(ALIASES[slug] ?? slug);
const page = course ? 'course' : slug === 'libre' ? 'open' : 'home';
const key = (k) => `${course?.id ?? 'libre'}:${k}`;

function renderHome() {
  $('home').hidden = false;
  $('courseCards').innerHTML = COURSES.map((c) => {
    const levels = courseLevels(c.id)
      .map((l) => `<span class="${l.id === c.target ? 'target' : ''}">${l.name}${l.id === c.target ? ' · target' : ''}</span>`)
      .join('');
    const units = c.units.map((u) => `<li><strong>${u.title.split(' · ')[0]}</strong>${u.title.split(' · ')[1] ?? ''}</li>`).join('');
    return `<a class="course-card" href="/${c.id}">
      <div><h2>${c.name}</h2><div class="tag">${c.tagline}</div></div>
      <div class="range">${levels}</div>
      <ul>${units}</ul>
      <span class="btn primary go">Commencer ${icon('mic')}</span>
    </a>`;
  }).join('');
}

/* ---------------- Setup screen ---------------- */

const range = courseLevels(course?.id);
const state = {
  level: levelForCourse(store.get(key('level'), course?.target ?? 'intermediate-low'), course?.id),
  topic: store.get(key('topic'), course?.units[0]?.topics[0]?.id ?? 'free'),
  voice: VOICES.includes(store.get('voice')) ? store.get('voice') : VOICES[0],
};

function radio(el, checked, onSelect) {
  el.type = 'button';
  el.setAttribute('role', 'radio');
  el.setAttribute('aria-checked', String(checked));
  el.onclick = onSelect;
  return el;
}

function renderLevels() {
  const box = $('levels');
  box.innerHTML = '';
  box.classList.toggle('three', range.length <= 3);
  let group = '';
  for (const l of range) {
    if (l.group !== group && range.length > 3) {
      group = l.group;
      const h = document.createElement('div');
      h.className = 'group';
      h.textContent = group;
      box.append(h);
    }
    const b = radio(document.createElement('button'), l.id === state.level, () => {
      state.level = l.id;
      store.set(key('level'), l.id);
      $('placement').checked = false;
      renderAll();
    });
    b.className = 'level';
    const badge = course?.badges?.[l.id];
    b.innerHTML = `${meter(l.id)}<strong>${l.name}</strong><span class="desc">${l.can}</span>${
      badge ? `<span class="tag ${badge === 'Challenge' ? 'challenge' : ''}">${badge}</span>` : ''
    }<span class="check">${icon('check')}</span>`;
    box.append(b);
  }
  box.classList.toggle('disabled', $('placement').checked);
}

function topicTile(t) {
  const [fr, en] = t.label.split(' — ');
  const b = radio(document.createElement('button'), t.id === state.topic, () => {
    state.topic = t.id;
    store.set(key('topic'), t.id);
    renderAll();
  });
  b.className = 'topic';
  b.innerHTML = `<span class="emoji" aria-hidden="true">${t.emoji ?? '💬'}</span><span><strong></strong><small></small></span>`;
  b.querySelector('strong').textContent = fr;
  b.querySelector('small').textContent = en ?? '';
  return b;
}

function renderTopics() {
  const box = $('topics');
  box.innerHTML = '';
  const level = $('placement').checked ? range[0].id : state.level;
  const general = topicsForLevel(level);
  const allowed = allowedTopicIds(course?.id, level);
  if (!allowed.includes(state.topic)) state.topic = course?.units[0]?.topics[0]?.id ?? 'free';

  if (!course) {
    box.className = 'topics';
    general.forEach((t) => box.append(topicTile(t)));
    return;
  }
  box.className = '';
  for (const u of course.units) {
    const [chip, title] = u.title.split(' · ');
    const sec = document.createElement('div');
    sec.className = 'unit';
    sec.innerHTML = `<div class="unit-head"><span class="unit-chip">${chip}</span><h3>${title ?? ''}</h3><small>${u.subtitle ?? ''}</small></div><div class="topics unit-topics"></div>`;
    u.topics.forEach((t) => sec.lastElementChild.append(topicTile(t)));
    box.append(sec);
  }
  const sec = document.createElement('div');
  sec.className = 'unit';
  sec.innerHTML = `<div class="unit-head"><h3>Autres sujets</h3><small>General topics, if you'd like something different</small></div><div class="topics"></div>`;
  general.forEach((t) => sec.lastElementChild.append(topicTile(t)));
  box.append(sec);
}

function renderVoices() {
  const box = $('voice');
  box.innerHTML = '';
  for (const v of VOICES) {
    const b = radio(document.createElement('button'), v === state.voice, () => {
      state.voice = v;
      store.set('voice', v);
      renderVoices();
    });
    b.textContent = v;
    box.append(b);
  }
}

function renderSummary() {
  const level = $('placement').checked ? 'Finding my level' : getLevel(state.level).name;
  const topic = getTopic(state.topic, course?.id).label.split(' — ')[0];
  $('summary').textContent = `${course ? `${course.name} · ` : ''}${level} · ${topic}`;
}

function renderAll() {
  renderLevels();
  renderTopics();
  renderSummary();
}

if (page === 'home') {
  renderHome();
} else {
  $('setup').hidden = false;
  if (course) {
    document.title = `${course.name} · Parlons !`;
    $('coursePill').textContent = `${course.name} · ${course.tagline.replace(/^Target: /, 'Target ')}`;
    $('setupEyebrow').querySelector('span').textContent = `${course.name} · ${course.tagline}`;
    $('topicsHint').textContent = 'Pick a topic from your units, or any other topic.';
    $('nameLabel').firstChild.textContent = 'Your name ';
    $('nameLabel').querySelector('small').textContent = 'first name and last initial, so your teacher knows it was you';
    $('learnerName').placeholder = 'e.g. Sam R.';
    $('safetyTip').hidden = false;
  } else {
    $('coursePill').textContent = 'Open practice · All levels';
  }
  $('learnerName').value = store.get('learnerName', '');
  $('accessCode').value = store.get('accessCode', '');
  if ($('accessCode').value) $('accessField').hidden = false;
  $('placement').onchange = renderAll;
  renderVoices();
  renderAll();
}

/* ---------------- Conversation ---------------- */

let session = null;
let mic = null;
let player = null;
let ready = false;
let ending = false;
let timerId = null;
let rafId = null;
let micLevel = 0;
let currentUser = null;
let currentTutor = null;
let history = []; // [{ who, el }] for the well-being alert excerpt
let flagged = false;
let flagTimer = null;

// Visualiser bars
const BARS = 24;
$('viz').innerHTML = '<span></span>'.repeat(BARS);
const bars = [...$('viz').children];
const barShape = bars.map((_, i) => 0.35 + 0.65 * Math.sin((Math.PI * (i + 0.5)) / BARS));

function setStatus(text, orbState) {
  $('status').textContent = text;
  if (orbState) $('orb').dataset.state = orbState;
}

function setLevelBadge(levelId, evidence) {
  const level = getLevel(levelId);
  $('levelBadge').textContent = level.name;
  $('levelBadge').classList.remove('pulse');
  void $('levelBadge').offsetWidth;
  $('levelBadge').classList.add('pulse');
  const idx = LEVELS.indexOf(level);
  $('ladder').innerHTML = LEVELS.map((l, i) => `<i class="${i < idx ? 'on' : i === idx ? 'current' : ''}" title="${l.name}"></i>`).join('');
  if (evidence !== undefined) $('levelEvidence').textContent = evidence;
}

function bubble(who, text = '') {
  const row = document.createElement('div');
  row.className = `row ${who}`;
  row.innerHTML = `${who === 'tutor' ? '<span class="avatar sm" aria-hidden="true">C</span>' : ''}<div class="msg"></div>`;
  const msg = row.querySelector('.msg');
  msg.textContent = text;
  msg.setAttribute('aria-label', who === 'tutor' ? 'Camille' : who === 'me' ? 'You' : 'Note');
  $('transcript').append(row);
  if (who !== 'note') history.push({ who, el: msg });
  scrollChat();
  return msg;
}

function appendTo(el, text) {
  el.textContent += text;
  scrollChat();
}

function scrollChat() {
  const t = $('transcript');
  t.scrollTop = t.scrollHeight;
}

const note = (text) => bubble('note', text);

function send(text) {
  if (!session || !ready) return;
  session.sendRealtimeInput({ text });
}

async function fetchToken(opts) {
  const headers = { 'content-type': 'application/json' };
  const code = $('accessCode').value.trim();
  if (code) headers['x-access-code'] = code;
  const res = await fetch('/api/token', { method: 'POST', headers, body: JSON.stringify(opts) });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401) {
    $('accessField').hidden = false;
    $('accessCode').focus();
    throw new Error(code ? 'That access code is not right.' : 'This site needs an access code. Enter it in step 3.');
  }
  if (!res.ok) throw new Error(data.error || `Server error (${res.status})`);
  return data;
}

function setEndButton(mode) {
  const back = mode === 'back';
  $('endBtn').innerHTML = icon(back ? 'back' : 'x');
  $('endBtn').title = back ? 'Back to setup' : 'End conversation';
  $('endBtn').setAttribute('aria-label', $('endBtn').title);
}

async function start() {
  $('setupError').textContent = '';
  const opts = {
    course: course?.id ?? null,
    level: state.level,
    topic: state.topic,
    placement: $('placement').checked,
    adaptive: $('adaptive').checked,
    voice: state.voice,
    learnerName: $('learnerName').value.trim(),
  };
  if (course && !opts.learnerName) {
    $('setupError').textContent = 'Please enter your name so your teacher knows who you are.';
    $('learnerName').focus();
    return;
  }
  store.set('learnerName', opts.learnerName);
  store.set('accessCode', $('accessCode').value.trim());

  $('startBtn').disabled = true;
  try {
    // Ask for the mic and unlock audio inside the click gesture.
    player = new PcmPlayer(24000);
    await player.init();
    mic = new MicStream({
      onChunk: (data, level) => {
        micLevel = level;
        if (session && ready) session.sendRealtimeInput({ audio: { data, mimeType: 'audio/pcm;rate=16000' } });
      },
    });
    await mic.start();

    const { token, model, config } = await fetchToken(opts);

    $('setup').hidden = true;
    $('convo').hidden = false;
    window.scrollTo({ top: 0 });
    $('transcript').innerHTML = '';
    history = [];
    flagged = false;
    $('carePanel').hidden = true;
    $('convo').classList.remove('paused');
    sessionInfo = { course: opts.course, learnerName: opts.learnerName, topic: opts.topic };
    $('levelEvidence').textContent = '';
    setEndButton('end');
    setMuteUi(false);
    setLevelBadge(opts.placement ? range[0].id : opts.level, opts.placement ? 'Finding your level…' : '');
    setStatus('Connexion…', 'connecting');
    startVisualiser();

    player.onPlayingChange = (playing) => {
      if (!ready) return;
      setStatus(playing ? 'Camille parle…' : 'À vous !', playing ? 'speaking' : 'listening');
    };

    const ai = new GoogleGenAI({ apiKey: token, httpOptions: { apiVersion: 'v1alpha' } });
    ending = false;
    ready = false;
    session = await ai.live.connect({
      model,
      config,
      callbacks: {
        onopen: () => {},
        onmessage: handleMessage,
        onerror: (e) => {
          console.error(e);
          note(`Connection error: ${e?.message || 'unknown'}`);
        },
        onclose: (e) => {
          if (!ending) {
            note(e?.reason ? `Session ended: ${e.reason}` : 'Session ended.');
            stop(false);
          }
        },
      },
    });
    if (ready) onReady();
  } catch (err) {
    console.error(err);
    cleanup();
    $('setup').hidden = false;
    $('convo').hidden = true;
    $('setupError').textContent =
      err?.name === 'NotAllowedError'
        ? 'Microphone access was blocked. Allow the microphone for this site and try again.'
        : err?.message || String(err);
  } finally {
    $('startBtn').disabled = false;
  }
}

function onReady() {
  setStatus('À vous !', 'listening');
  startTimer();
  send('[SESSION_START]');
}

function handleMessage(msg) {
  if (msg.setupComplete) {
    ready = true;
    if (session) onReady();
    return;
  }

  if (msg.toolCall?.functionCalls?.length) {
    const responses = msg.toolCall.functionCalls.map((fc) => {
      if (fc.name === LEVEL_TOOL_NAME && fc.args?.level) setLevelBadge(fc.args.level, fc.args.evidence || '');
      if (fc.name === FLAG_TOOL_NAME) raiseFlag(fc.args ?? {});
      return { id: fc.id, name: fc.name, response: { result: 'ok' } };
    });
    session?.sendToolResponse({ functionResponses: responses });
  }

  const sc = msg.serverContent;
  if (sc) {
    if (sc.interrupted) {
      player?.flush();
      currentTutor = null;
    }
    for (const part of sc.modelTurn?.parts ?? []) {
      if (part.inlineData?.data && part.inlineData.mimeType?.startsWith('audio/')) {
        player?.play(part.inlineData.data, part.inlineData.mimeType);
      }
    }
    if (sc.inputTranscription?.text) {
      currentUser ??= bubble('me');
      appendTo(currentUser, sc.inputTranscription.text);
    }
    if (sc.outputTranscription?.text) {
      currentTutor ??= bubble('tutor');
      appendTo(currentTutor, sc.outputTranscription.text);
    }
    if (sc.turnComplete && flagged) finishFlag();
    if (sc.turnComplete) {
      currentUser = null;
      currentTutor = null;
    }
  }

  if (msg.goAway) note('The session will end soon (time limit). Start a new conversation to continue.');
}

function startTimer() {
  const t0 = Date.now();
  clearInterval(timerId);
  timerId = setInterval(() => {
    const s = Math.floor((Date.now() - t0) / 1000);
    $('timer').textContent = `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  }, 1000);
}

function startVisualiser() {
  cancelAnimationFrame(rafId);
  let smooth = 0;
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const tick = (t) => {
    const out = player?.level() ?? 0;
    const target = Math.min(1, Math.max(out * 5, mic && !mic.muted ? micLevel * 7 : 0));
    smooth += (target - smooth) * 0.25;
    $('orb').style.setProperty('--level', smooth.toFixed(3));
    bars.forEach((bar, i) => {
      const wobble = reduceMotion ? 1 : 0.7 + 0.3 * Math.sin(t / 140 + i * 0.9);
      bar.style.height = `${4 + smooth * 32 * barShape[i] * wobble}px`;
    });
    rafId = requestAnimationFrame(tick);
  };
  rafId = requestAnimationFrame(tick);
}

/* ---------------- Well-being alert ---------------- */

let sessionInfo = {};
let flagNotified = null;

function raiseFlag({ category, summary }) {
  if (flagged) return;
  flagged = true;
  // Stop listening: the conversation is over once Camille has said her caring message.
  if (mic) {
    mic.setMuted(true);
    setMuteUi(true);
  }
  if (session && ready) session.sendRealtimeInput({ audioStreamEnd: true });
  $('convo').classList.add('paused');
  setStatus('Pause', 'speaking');
  const excerpt = history.map((h) => ({ who: h.who, text: h.el.textContent }));
  flagNotified = fetch('/api/flag', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ ...sessionInfo, category, summary, excerpt }),
  })
    .then((r) => r.json())
    .then((j) => j.notified === true)
    .catch(() => false);
  // If Camille's message never completes, end anyway.
  flagTimer = setTimeout(finishFlag, 30_000);
}

async function finishFlag() {
  clearTimeout(flagTimer);
  // Let Camille finish speaking before closing.
  for (let i = 0; i < 60 && player?.sources?.size; i++) await new Promise((r) => setTimeout(r, 250));
  const notified = await flagNotified;
  if (!flagged) return;
  stop(false);
  setStatus('Pause', 'idle');
  $('careTeacher').textContent = notified
    ? 'Your teacher has been notified so they can check in with you.'
    : 'Please let your teacher or school counselor know how you are feeling.';
  $('carePanel').hidden = false;
  $('carePanel').scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function cleanup() {
  clearTimeout(flagTimer);
  ready = false;
  clearInterval(timerId);
  cancelAnimationFrame(rafId);
  mic?.stop();
  player?.close();
  mic = player = null;
  micLevel = 0;
  try {
    session?.close();
  } catch {}
  session = null;
  currentUser = currentTutor = null;
  bars.forEach((b) => (b.style.height = '4px'));
  $('orb').style.setProperty('--level', 0);
}

function stop(backToSetup = true) {
  ending = true;
  cleanup();
  setStatus('Conversation terminée', 'idle');
  if (backToSetup) {
    $('convo').hidden = true;
    $('setup').hidden = false;
  } else {
    setEndButton('back');
  }
}

function setMuteUi(muted) {
  $('muteBtn').setAttribute('aria-pressed', String(muted));
  $('muteBtn').title = muted ? 'Unmute microphone' : 'Mute microphone';
  $('muteBtn').setAttribute('aria-label', $('muteBtn').title);
}

$('startBtn').onclick = start;
$('endBtn').onclick = () => stop(true);
$('muteBtn').onclick = () => {
  if (!mic) return;
  const muted = !mic.muted;
  mic.setMuted(muted);
  if (muted && session && ready) session.sendRealtimeInput({ audioStreamEnd: true });
  setMuteUi(muted);
};
for (const b of document.querySelectorAll('.helpers button')) {
  b.onclick = () => {
    player?.flush();
    send(`[${b.dataset.cmd}]`);
  };
}
$('wrapBtn').onclick = () => {
  player?.flush();
  send('[WRAP_UP]');
  requestFeedback();
};

/* ---------------- Written feedback report ---------------- */

async function requestFeedback() {
  if (!history.length) return;
  $('wrapBtn').disabled = true;
  const loading = bubble('note', 'Preparing your feedback report…');
  // Give the student's last words a moment to finish transcribing.
  await new Promise((r) => setTimeout(r, 1500));
  const transcript = history.map((h) => ({ who: h.who, text: h.el.textContent }));
  const headers = { 'content-type': 'application/json' };
  const code = $('accessCode').value.trim();
  if (code) headers['x-access-code'] = code;
  try {
    const res = await fetch('/api/feedback', {
      method: 'POST',
      headers,
      body: JSON.stringify({ course: sessionInfo.course, topic: sessionInfo.topic, transcript }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Server error (${res.status})`);
    loading.closest('.row').remove();
    renderReport(data);
  } catch (err) {
    console.error(err);
    loading.textContent = 'Sorry, the feedback report could not be created. Please try again.';
  } finally {
    $('wrapBtn').disabled = false;
  }
}

function renderReport(r) {
  const el = (tag, cls, text) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  };
  const card = el('div', 'report');
  card.append(el('h2', '', 'Your feedback'));

  if (r.strengths?.length) {
    const sec = el('section');
    sec.append(el('h3', '', 'What you did well'));
    for (const s of r.strengths) {
      const item = el('div', 'report-item');
      item.append(el('strong', '', s.skill), el('blockquote', 'fr', `« ${s.quote} »`), el('p', '', s.explanation));
      sec.append(item);
    }
    card.append(sec);
  }

  if (r.improvements?.length) {
    const sec = el('section');
    sec.append(el('h3', '', 'How you can improve'));
    for (const s of r.improvements) {
      const item = el('div', 'report-item');
      item.append(el('strong', '', s.skill));
      const said = el('p', 'pair');
      said.append(el('span', 'label', 'You said'), el('span', 'fr', `« ${s.quote} »`));
      const better = el('p', 'pair better');
      better.append(el('span', 'label', 'A stronger way to say it'), el('span', 'fr', `« ${s.improved} »`));
      item.append(said, better, el('p', '', s.why));
      sec.append(item);
    }
    card.append(sec);
  }

  if (r.challenge) {
    const sec = el('section', 'challenge');
    sec.append(el('h3', '', 'Your next speaking challenge'), el('p', '', r.challenge));
    card.append(sec);
  }

  card.append(
    el('p', 'report-note', `${r.limitations ? `${r.limitations} ` : ''}This feedback is based on an automatic transcript, which may have misheard some words.`)
  );
  const row = el('div', 'row report-row');
  row.append(card);
  $('transcript').append(row);
  row.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
$('textForm').onsubmit = (e) => {
  e.preventDefault();
  const text = $('textInput').value.trim();
  if (!text || !ready) return;
  currentUser = null;
  bubble('me', text);
  player?.flush();
  send(text);
  $('textInput').value = '';
};
$('showTranscript').onchange = (e) => $('transcript').classList.toggle('hidden-text', !e.target.checked);
window.addEventListener('beforeunload', cleanup);
