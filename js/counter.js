// Casualty count-up animation
// Rate: total annual casualties / seconds in year, ticking per frame

export class CasualtyCounter {
  constructor(element, totalCasualties) {
    this.el = element;
    this.total = totalCasualties;
    this.current = 0;
    this.target = totalCasualties;
    this.startTime = null;
    this.duration = 4000; // count-up over 4 seconds on load
    this.settled = false;
    this.tickRate = totalCasualties / (365.25 * 24 * 3600); // per second
  }

  start() {
    this.startTime = performance.now();
    this.animate();
  }

  animate() {
    const now = performance.now();
    const elapsed = now - this.startTime;

    if (!this.settled) {
      // Initial count-up animation
      const progress = Math.min(elapsed / this.duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      this.current = Math.floor(this.target * eased);

      if (progress >= 1) {
        this.settled = true;
        this.current = this.target;
        this.settledTime = now;
      }
    } else {
      // Slow real-time tick after settling
      const tickElapsed = (now - this.settledTime) / 1000;
      this.current = this.target + Math.floor(this.tickRate * tickElapsed);
    }

    this.el.textContent = this.current.toLocaleString('en-US');
    requestAnimationFrame(() => this.animate());
  }
}
