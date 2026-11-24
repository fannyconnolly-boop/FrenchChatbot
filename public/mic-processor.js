// AudioWorklet: downsample mic audio to 16 kHz mono PCM16 and post ~100 ms chunks.
class MicProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.ratio = sampleRate / 16000;
    this.pos = 0; // fractional read position into incoming stream
    this.out = new Int16Array(1600);
    this.outLen = 0;
    this.prev = 0;
    this.levelAcc = 0;
    this.levelN = 0;
  }

  process(inputs) {
    const ch = inputs[0]?.[0];
    if (!ch) return true;
    // Linear interpolation resampler.
    while (this.pos < ch.length) {
      const i = Math.floor(this.pos);
      const frac = this.pos - i;
      const a = i === 0 ? this.prev : ch[i - 1];
      const b = ch[i];
      const s = Math.max(-1, Math.min(1, a + (b - a) * frac));
      this.out[this.outLen++] = s < 0 ? s * 0x8000 : s * 0x7fff;
      this.levelAcc += s * s;
      this.levelN++;
      if (this.outLen === this.out.length) {
        const level = Math.sqrt(this.levelAcc / this.levelN);
        this.port.postMessage({ pcm: this.out.buffer, level }, [this.out.buffer]);
        this.out = new Int16Array(1600);
        this.outLen = 0;
        this.levelAcc = 0;
        this.levelN = 0;
      }
      this.pos += this.ratio;
    }
    this.pos -= ch.length;
    this.prev = ch[ch.length - 1];
    return true;
  }
}
registerProcessor('mic-processor', MicProcessor);
