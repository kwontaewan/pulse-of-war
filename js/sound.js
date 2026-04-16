// Web Audio API heartbeat sound — optimized for mobile speakers

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

    // Lub (first beat) — deep thump + audible click
    this.thump(now, 150, 0.6, 0.25);       // main bass
    this.click(now, 800, 0.3);              // transient click for mobile

    // Dub (second beat) — softer
    this.thump(now + 0.15, 120, 0.35, 0.2);
    this.click(now + 0.15, 600, 0.15);
  }

  thump(time, freq, volume, duration) {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, time);
    osc.frequency.exponentialRampToValueAtTime(40, time + duration);

    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(volume, time + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, time + duration + 0.1);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(time);
    osc.stop(time + duration + 0.2);
  }

  // High-freq transient so mobile speakers can reproduce it
  click(time, freq, volume) {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, time);
    osc.frequency.exponentialRampToValueAtTime(200, time + 0.05);

    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(volume, time + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.08);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(time);
    osc.stop(time + 0.15);
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
