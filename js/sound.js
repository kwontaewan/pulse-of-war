// Web Audio API heartbeat sound

export class HeartbeatSound {
  constructor() {
    this.ctx = null;
    this.playing = false;
    this.interval = null;
  }

  init() {
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
  }

  beat() {
    if (!this.ctx || !this.playing) return;

    const now = this.ctx.currentTime;

    // First thump (lub)
    this.thump(now, 60, 0.15);
    // Second thump (dub) — slightly higher, quieter
    this.thump(now + 0.12, 50, 0.08);
  }

  thump(time, freq, volume) {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, time);
    osc.frequency.exponentialRampToValueAtTime(30, time + 0.15);

    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(volume, time + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.3);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(time);
    osc.stop(time + 0.4);
  }

  toggle() {
    if (!this.ctx) this.init();

    if (this.playing) {
      this.playing = false;
      clearInterval(this.interval);
      this.interval = null;
    } else {
      this.playing = true;
      if (this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
      this.beat();
      this.interval = setInterval(() => this.beat(), 2000);
    }

    return this.playing;
  }

  destroy() {
    this.playing = false;
    clearInterval(this.interval);
    if (this.ctx) this.ctx.close();
  }
}
