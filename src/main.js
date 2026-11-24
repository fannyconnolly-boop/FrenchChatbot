import { GoogleGenAI } from '@google/genai';
import { LEVELS, VOICES, LEVEL_TOOL_NAME, getLevel, topicsForLevel } from '../shared/tutor.js';
import { MicStream, PcmPlayer } from './audio.js';

const $ = (id) => document.getElementById(id);
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

/* ---------------- Setup screen ---------------- */

const state = {
  level: store.get('level', 'intermediate-low'),
  topic: store.get('topic', 'free'),
};

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
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'level';
    b.setAttribute('role', 'radio');
    b.setAttribute('aria-checked', String(l.id === state.level));
    b.innerHTML = `<strong>${l.name}</strong><span>${l.can}</span>`;
    b.onclick = () => {
      state.level = l.id;
      store.set('level', l.id);
      $('placement').checked = false;
      renderLevels();
      renderTopics();
    };
    box.append(b);
  }
  box.classList.toggle('disabled', $('placement').checked);
}

function renderTopics() {
  const box = $('topics');
  box.innerHTML = '';
  const level = $('placement').checked ? 'novice-high' : state.level;
  const topics = topicsForLevel(level);
  if (!topics.some((t) => t.id === state.topic)) state.topic = 'free';
  for (const t of topics) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip';
    b.setAttribute('role', 'radio');
    b.setAttribute('aria-checked', String(t.id === state.topic));
    b.textContent = t.label;
    b.onclick = () => {
      state.topic = t.id;
      store.set('topic', t.id);
      renderTopics();
    };
    box.append(b);
  }
}

for (const v of VOICES) $('voice').append(new Option(v, v));
$('voice').value = store.get('voice', VOICES[0]);
$('learnerName').value = store.get('learnerName', '');
$('accessCode').value = store.get('accessCode', '');
if ($('accessCode').value) $('accessField').hidden = false;
$('placement').onchange = () => {
  renderLevels();
  renderTopics();
};
renderLevels();
renderTopics();

/* ---------------- Conversation ---------------- */

let session = null;
let mic = null;
let player = null;
let ready = false;
let ending = false;
let timerId = null;
let micLevel = 0;
let currentUser = null;
let currentTutor = null;

function setStatus(text, orbState) {
  $('status').textContent = text;
  if (orbState) $('orb').dataset.state = orbState;
}

function setLevelBadge(levelId, evidence) {
  $('levelBadge').textContent = getLevel(levelId).name;
  $('levelBadge').classList.remove('pulse');
  void $('levelBadge').offsetWidth;
  $('levelBadge').classList.add('pulse');
  if (evidence !== undefined) $('levelEvidence').textContent = evidence;
}

function bubble(who, text = '') {
  const el = document.createElement('div');
  el.className = `msg ${who}`;
  el.innerHTML = `<div class="who">${who === 'tutor' ? 'Camille' : who === 'me' ? 'Vous' : ''}</div><div class="text"></div>`;
  el.querySelector('.text').textContent = text;
  $('transcript').append(el);
  scrollChat();
  return el;
}

function appendTo(el, text) {
  el.querySelector('.text').textContent += text;
  scrollChat();
}

function scrollChat() {
  const t = $('transcript');
  t.scrollTop = t.scrollHeight;
}

function note(text) {
  bubble('note', text);
}

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
    throw new Error(code ? 'That access code is not right.' : 'This site needs an access code. Enter it under Options.');
  }
  if (!res.ok) throw new Error(data.error || `Server error (${res.status})`);
  return data;
}

async function start() {
  $('setupError').textContent = '';
  const opts = {
    level: state.level,
    topic: state.topic,
    placement: $('placement').checked,
    adaptive: $('adaptive').checked,
    voice: $('voice').value,
    learnerName: $('learnerName').value.trim(),
  };
  store.set('voice', opts.voice);
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
    $('transcript').innerHTML = '';
    $('levelEvidence').textContent = '';
    setLevelBadge(opts.placement ? 'intermediate-low' : opts.level, opts.placement ? 'Finding your level…' : '');
    setStatus('Connexion…', 'connecting');

    player.onPlayingChange = (playing) => {
      if (!ready) return;
      setStatus(playing ? 'Camille parle…' : 'À vous ! Je vous écoute…', playing ? 'speaking' : 'listening');
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
  setStatus('À vous ! Je vous écoute…', 'listening');
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
    // Mic level drives the orb glow while listening.
    $('orb').style.setProperty('--level', Math.min(1, micLevel * 8).toFixed(2));
  }, 100);
}

function cleanup() {
  ready = false;
  clearInterval(timerId);
  mic?.stop();
  player?.close();
  mic = player = null;
  try {
    session?.close();
  } catch {}
  session = null;
  currentUser = currentTutor = null;
}

function stop(backToSetup = true) {
  ending = true;
  cleanup();
  setStatus('Conversation terminée.', 'idle');
  if (backToSetup) {
    $('convo').hidden = true;
    $('setup').hidden = false;
  } else {
    $('endBtn').textContent = '↩';
    $('endBtn').title = 'Back to setup';
  }
}

$('startBtn').onclick = start;
$('endBtn').onclick = () => {
  $('endBtn').textContent = '✕';
  $('endBtn').title = 'End conversation';
  stop(true);
};
$('muteBtn').onclick = () => {
  if (!mic) return;
  const muted = !mic.muted;
  mic.setMuted(muted);
  if (muted && session && ready) session.sendRealtimeInput({ audioStreamEnd: true });
  $('muteBtn').setAttribute('aria-pressed', String(muted));
  $('muteBtn').textContent = muted ? '🔇' : '🎙️';
  $('muteBtn').classList.toggle('muted', muted);
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
