/**
 * Fully procedural audio: no external files, no licences, no network.
 * All sounds are short Web Audio envelopes, so the whole game stays tiny.
 */
export class AudioEngine {
  constructor(settings = {}) {
    this.settings = {
      music: 35,
      sfx: 70,
      musicOn: true,
      ...settings,
    };
    this.ctx = null;
    this.musicTimer = null;
    this.musicStep = 0;
    this.musicGain = null;
    this.sfxGain = null;
    this.muted = false;
    this.available = typeof window !== 'undefined' &&
      Boolean(window.AudioContext || window.webkitAudioContext);
  }

  ensure() {
    if (!this.available) return null;
    if (!this.ctx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new Ctx();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.9;
      this.master.connect(this.ctx.destination);
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = (this.settings.music / 100) * 0.18;
      this.musicGain.connect(this.master);
      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = (this.settings.sfx / 100) * 0.5;
      this.sfxGain.connect(this.master);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
    return this.ctx;
  }

  applySettings(settings) {
    this.settings = { ...this.settings, ...settings };
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    if (this.musicGain) this.musicGain.gain.setTargetAtTime(this.muted ? 0 : (this.settings.music / 100) * 0.18, now, 0.05);
    if (this.sfxGain) this.sfxGain.gain.setTargetAtTime(this.muted ? 0 : (this.settings.sfx / 100) * 0.5, now, 0.05);
    if (!this.settings.musicOn) this.stopMusic();
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.ctx?.master) this.ctx.master.gain.setTargetAtTime(muted ? 0 : 0.9, this.ctx.currentTime, 0.03);
  }

  tone({ freq = 440, to = null, duration = 0.12, type = 'square', volume = 0.2, delay = 0 }) {
    const ctx = this.ensure();
    if (!ctx) return;
    const t0 = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (to) osc.frequency.exponentialRampToValueAtTime(Math.max(30, to), t0 + duration);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(volume, t0 + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    osc.connect(gain);
    gain.connect(this.sfxGain || ctx.destination);
    osc.start(t0);
    osc.stop(t0 + duration + 0.02);
  }

  play(name) {
    if (!this.available || this.muted) return;
    switch (name) {
      case 'click':
        this.tone({ freq: 720, to: 900, duration: 0.05, type: 'square', volume: 0.12 });
        break;
      case 'select':
        this.tone({ freq: 520, duration: 0.06, type: 'triangle', volume: 0.14 });
        break;
      case 'correct':
        this.tone({ freq: 660, duration: 0.1, type: 'sine', volume: 0.2 });
        this.tone({ freq: 880, duration: 0.12, type: 'sine', volume: 0.18, delay: 0.09 });
        this.tone({ freq: 1320, duration: 0.16, type: 'sine', volume: 0.14, delay: 0.18 });
        break;
      case 'wrong':
        this.tone({ freq: 220, to: 130, duration: 0.22, type: 'sawtooth', volume: 0.12 });
        break;
      case 'pickup':
        this.tone({ freq: 880, to: 1170, duration: 0.1, type: 'triangle', volume: 0.15 });
        break;
      case 'open':
        this.tone({ freq: 330, to: 495, duration: 0.12, type: 'triangle', volume: 0.12 });
        break;
      case 'close':
        this.tone({ freq: 495, to: 330, duration: 0.1, type: 'triangle', volume: 0.1 });
        break;
      case 'fanfare':
        [523, 659, 784, 1046].forEach((f, i) => this.tone({ freq: f, duration: 0.2, type: 'square', volume: 0.12, delay: i * 0.13 }));
        break;
      case 'tick':
        this.tone({ freq: 1200, duration: 0.03, type: 'square', volume: 0.05 });
        break;
      default:
        break;
    }
  }

  startMusic() {
    if (!this.available || this.muted || !this.settings.musicOn) return;
    if (this.musicTimer) return;
    const ctx = this.ensure();
    if (!ctx) return;

    // A calm, slow ambient loop: soft sine arpeggio over a warm drone.
    // Nothing musical is fetched; every note is synthesised locally.
    const scale = [0, 3, 5, 7, 10, 12, 10, 7, 5, 3];
    const base = 261.63; // C4
    const stepMs = 560;
    const note = (freq, t0, { type = 'sine', peak = 0.16, attack = 0.08, release = 1.6, detune = 0 }) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      osc.detune.value = detune;
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(peak, t0 + attack);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + release);
      osc.connect(gain);
      if (this.musicGain) gain.connect(this.musicGain);
      osc.start(t0);
      osc.stop(t0 + release + 0.05);
    };

    const playStep = () => {
      if (!this.ctx || !this.musicGain || this.musicGain.gain.value < 0.001) return;
      const t0 = this.ctx.currentTime;
      const semis = scale[this.musicStep % scale.length];
      const freq = base * Math.pow(2, semis / 12);
      note(freq, t0, { peak: 0.14, release: 1.5, detune: -4 });
      note(freq * 2, t0 + 0.12, { peak: 0.05, release: 1.9, detune: 6 });
      // Warm sub drone every bar, very quiet.
      if (this.musicStep % 6 === 0) {
        note(base / 4, t0, { type: 'sine', peak: 0.1, attack: 0.35, release: 3.4 });
        note((base / 2) * Math.pow(2, 7 / 12), t0 + 0.05, { type: 'sine', peak: 0.05, attack: 0.4, release: 3.2 });
      }
      this.musicStep += 1;
    };
    playStep();
    this.musicTimer = setInterval(playStep, stepMs);
  }

  stopMusic() {
    if (this.musicTimer) {
      clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
  }
}
