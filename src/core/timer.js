/**
 * Accurate mission timer. Time is derived from a monotonic clock, never from
 * accumulated animation frames, and pauses are excluded from elapsed time.
 */
export class MissionTimer {
  constructor(durationSeconds = 180, clock = () => performance.now()) {
    this.duration = durationSeconds * 1000;
    this.clock = clock;
    this.startedAt = null;
    this.accumulated = 0;
    this.running = false;
    this.finished = false;
  }

  start() {
    if (this.startedAt !== null) return this;
    this.startedAt = this.clock();
    this.running = true;
    return this;
  }

  pause() {
    if (!this.running) return this;
    this.accumulated += this.clock() - this.startedAt;
    this.startedAt = null;
    this.running = false;
    return this;
  }

  resume() {
    if (this.running || this.finished) return this;
    this.startedAt = this.clock();
    this.running = true;
    return this;
  }

  stop() {
    if (this.running) this.pause();
    this.finished = true;
    return this;
  }

  /**
   * Accuracy credit: correct answers add a few seconds back to the mission.
   * This rewards care, never speed, and is capped so the 3-minute frame holds.
   */
  extend(seconds) {
    this.duration = Math.min(210000, this.duration + Math.max(0, seconds) * 1000);
    return this;
  }

  elapsedMs() {
    let elapsed = this.accumulated;
    if (this.running && this.startedAt !== null) elapsed += this.clock() - this.startedAt;
    return Math.min(this.duration, Math.max(0, elapsed));
  }

  elapsedSeconds() { return this.elapsedMs() / 1000; }

  remainingSeconds() { return Math.max(0, (this.duration - this.elapsedMs()) / 1000); }

  ratio() { return 1 - this.elapsedMs() / this.duration; }

  isExpired() { return this.elapsedMs() >= this.duration; }

  reset() {
    this.startedAt = null;
    this.accumulated = 0;
    this.running = false;
    this.finished = false;
    return this;
  }
}
