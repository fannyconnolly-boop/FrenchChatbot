import { GoogleGenAI } from '@google/genai';
import { LEVELS, VOICES, LEVEL_TOOL_NAME, getLevel, getTopic, topicsForLevel } from '../shared/tutor.js';
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

const TOPIC_EMOJI = {
  free: '💬', intro: '👋', food: '🥐', routine: '☀️', cafe: '☕', travel: '🧳',
  weekend: '📅', hotel: '🛎️', culture: '🎬', news: '📰', debate: '⚖️', ideas: '💡',
};

const meter = (levelId) => {
  const idx = LEVELS.findIndex((l) => l.id === levelId);
  return `<span class="meter" aria-hidden="true">${LEVELS.map((_, i) => `<i class="${i <= idx ? 'on' : ''}"></i>`).join('')}</span>`;
};

/* ---------------- Setup screen ---------------- */

const state = {
  level: store.get('level', 'intermediate-low'),
  topic: store.get('topic', 'free'),
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
  let group = '';
  for (const l of LEVELS) {
    if (l.group !== group) {
      group = l.group;
      const h = document.createElement('div');
      h.className = 'group';
      h.textContent = group;
      box.append(h);
    }
    const b = radio(document.createElement('button'), l.id === state.level, () => {
      state.level = l.id;
      store.set('level', l.id);
      $('placement').checked = false;
      renderAll();
    });
    b.className = 'level';
    b.innerHTML = `${meter(l.id)}<strong>${l.name}</strong><span class="desc">${l.can}</span><span class="check">${icon('check')}</span>`;
    box.append(b);
  }
  box.classList.toggle('disabled', $('placement').checked);
}

function renderTopics() {
  const box = $('topics');
  box.innerHTML = '';
  const topics = topicsForLevel($('placement').checked ? 'novice-high' : state.level);
  if (!topics.some((t) => t.id === state.topic)) state.topic = 'free';
  for (const t of topics) {
    const [fr, en] = t.label.split(' — ');
    const b = radio(document.createElement('button'), t.id === state.topic, () => {
      state.topic = t.id;
      store.set('topic', t.id);
      renderAll();
    });
    b.className = 'topic';
    b.innerHTML = `<span class="emoji" aria-hidden="true">${TOPIC_EMOJI[t.id] ?? '💬'}</span><span><strong></strong><small></small></span>`;
    b.querySelector('strong').textContent = fr;
    b.querySelector('small').textContent = en ?? '';
    box.append(b);
  }
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
  const topic = getTopic(state.topic).label.split(' — ')[0];
  $('summary').textContent = `${level} · ${topic}`;
}

function renderAll() {
  renderLevels();
  renderTopics();
  renderSummary();
}

$('learnerName').value = store.get('learnerName', '');
$('accessCode').value = store.get('accessCode', '');
if ($('accessCode').value) $('accessField').hidden = false;
$('placement').onchange = renderAll;
renderVoices();
renderAll();

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
    level: state.level,
    topic: state.topic,
    placement: $('placement').checked,
    adaptive: $('adaptive').checked,
    voice: state.voice,
    learnerName: $('learnerName').value.trim(),
  };
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
    $('levelEvidence').textContent = '';
    setEndButton('end');
    setMuteUi(false);
    setLevelBadge(opts.placement ? 'intermediate-low' : opts.level, opts.placement ? 'Finding your level…' : '');
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

function cleanup() {
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
};
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
