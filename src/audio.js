// Microphone capture and streaming playback for the Gemini Live API.

export function bytesToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  }
  return btoa(bin);
}

export function base64ToBytes(b64) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

/** Captures the microphone and calls onChunk(base64Pcm16k, level) roughly every 100 ms. */
export class MicStream {
  constructor({ onChunk }) {
    this.onChunk = onChunk;
    this.muted = false;
  }

  async start() {
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });
    this.ctx = new AudioContext();
    await this.ctx.audioWorklet.addModule('/mic-processor.js');
    this.source = this.ctx.createMediaStreamSource(this.stream);
    this.node = new AudioWorkletNode(this.ctx, 'mic-processor');
    this.node.port.onmessage = (e) => {
      if (this.muted) return;
      this.onChunk(bytesToBase64(e.data.pcm), e.data.level);
    };
    this.source.connect(this.node);
    // Worklet needs to be pulled; connect through a silent gain so we don't hear ourselves.
    const silent = this.ctx.createGain();
    silent.gain.value = 0;
    this.node.connect(silent).connect(this.ctx.destination);
  }

  setMuted(m) {
    this.muted = m;
    this.stream?.getAudioTracks().forEach((t) => (t.enabled = !m));
  }

  stop() {
    this.stream?.getTracks().forEach((t) => t.stop());
    this.ctx?.close().catch(() => {});
    this.stream = this.ctx = null;
  }
}

/** Gapless playback of 24 kHz PCM16 chunks, with instant flush on barge-in. */
export class PcmPlayer {
  constructor(sampleRate = 24000) {
    this.sampleRate = sampleRate;
    this.sources = new Set();
    this.onPlayingChange = () => {};
  }

  async init() {
    this.ctx = new AudioContext({ sampleRate: this.sampleRate });
    if (this.ctx.state === 'suspended') await this.ctx.resume();
    this.gain = this.ctx.createGain();
    this.gain.connect(this.ctx.destination);
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 512;
    this.gain.connect(this.analyser);
    this.levelBuf = new Float32Array(this.analyser.fftSize);
    this.nextTime = 0;
  }

  /** Current output loudness, roughly 0–1 (for the visualiser). */
  level() {
    if (!this.analyser || this.sources.size === 0) return 0;
    this.analyser.getFloatTimeDomainData(this.levelBuf);
    let sum = 0;
    for (const v of this.levelBuf) sum += v * v;
    return Math.sqrt(sum / this.levelBuf.length);
  }

  play(base64, mimeType = '') {
    if (!this.ctx) return;
    const rate = Number(/rate=(\d+)/.exec(mimeType)?.[1]) || this.sampleRate;
    const bytes = base64ToBytes(base64);
    const samples = new Int16Array(bytes.buffer, bytes.byteOffset, bytes.byteLength >> 1);
    const buf = this.ctx.createBuffer(1, samples.length, rate);
    const ch = buf.getChannelData(0);
    for (let i = 0; i < samples.length; i++) ch[i] = samples[i] / 0x8000;

    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.connect(this.gain);
    const now = this.ctx.currentTime;
    if (this.nextTime < now + 0.02) this.nextTime = now + 0.05; // small jitter buffer
    src.start(this.nextTime);
    this.nextTime += buf.duration;
    this.sources.add(src);
    if (this.sources.size === 1) this.onPlayingChange(true);
    src.onended = () => {
      this.sources.delete(src);
      if (this.sources.size === 0) this.onPlayingChange(false);
    };
  }

  /** Stop everything queued (the learner started talking over the tutor). */
  flush() {
    for (const s of this.sources) {
      try {
        s.stop();
      } catch {}
    }
    this.sources.clear();
    this.nextTime = 0;
    this.onPlayingChange(false);
  }

  close() {
    this.flush();
    this.ctx?.close().catch(() => {});
    this.ctx = null;
  }
}
