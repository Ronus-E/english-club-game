/**
 * Fully procedural audio: no external files, no licences, no network.
 * All sounds are short Web Audio envelopes, so the whole game stays tiny.
 */
export class AudioEngine {
  constructor(settings = {}) {
    this.settings = {
      music: 70,
      sfx: 70,
      musicOn: true,
      ...settings,
    };
    this.ctx = null;
    this.musicTimer = null;
    this.musicStep = 0;
    this.musicNextTime = 0;
    this.musicStage = 1;
    this.musicProgress = 0;
    this.musicGain = null;
    this.sfxGain = null;
    this.noise = null;
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
      this.musicGain.gain.value = (this.settings.music / 100) * 0.5;
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
    if (this.musicGain) this.musicGain.gain.setTargetAtTime(this.muted ? 0 : (this.settings.music / 100) * 0.5, now, 0.05);
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

  /** Shared noise buffer for the soft percussion layer. */
  noiseBuffer() {
    const ctx = this.ensure();
    if (!ctx || this.noise) return this.noise;
    const length = Math.floor(ctx.sampleRate * 0.25);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
    this.noise = buffer;
    return buffer;
  }

  /** Kick, snare and hat built from oscillators/noise; no sample is fetched. */
  percussion(kind, t0, level = 1) {
    const ctx = this.ctx;
    if (!ctx || !this.musicGain) return;
    const gain = ctx.createGain();
    gain.connect(this.musicGain);
    if (kind === 'kick') {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(140, t0);
      osc.frequency.exponentialRampToValueAtTime(48, t0 + 0.11);
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(0.16 * level, t0 + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.16);
      osc.connect(gain);
      osc.start(t0);
      osc.stop(t0 + 0.18);
      return;
    }
    const buffer = this.noiseBuffer();
    if (!buffer) return;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = kind === 'snare' ? 1400 : 6500;
    const dur = kind === 'snare' ? 0.1 : 0.035;
    const peak = kind === 'snare' ? 0.045 * level : 0.018 * level;
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(peak, t0 + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(filter);
    filter.connect(gain);
    src.start(t0);
    src.stop(t0 + dur + 0.01);
  }

  /** Later stages bring a fuller arrangement; call again to reset a run. */
  setMusicStage(stage = 1) {
    this.musicStage = Math.max(1, Math.min(10, Number(stage) || 1));
    this.musicProgress = 0;
  }

  /** Progress adds momentum without revealing whether answers were correct. */
  setMusicProgress(fraction = 0) {
    this.musicProgress = Math.max(0, Math.min(1, Number(fraction) || 0));
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

    // Upbeat four-bar loop at 112 BPM: memorable lead, moving bass, soft
    // percussion and a pad. The arrangement gains layers with stage number
    // and quiz progress, so the music pushes the learner forward.
    const tempo = 112;
    const stepDur = 60 / tempo / 2; // one eighth note
    const stepMs = Math.round(stepDur * 1000);
    const base = 261.63; // C4
    const chords = [
      { bass: -12, pad: [0, 4, 7, 11] },   // Cmaj7
      { bass: -15, pad: [-3, 0, 4, 7] },   // Am7
      { bass: -19, pad: [-7, -3, 0, 4] },  // Fmaj7
      { bass: -17, pad: [-5, -1, 2, 5] },  // G7
    ];
    const lead = [
      12, null, 16, null, 19, 16, null, 12,
      12, null, 16, 19, null, 21, 19, null,
      17, null, 16, null, 12, null, 16, null,
      14, null, 19, null, 21, 19, null, 16,
    ];
    const note = (freq, t0, { type = 'sine', peak = 0.1, attack = 0.02, release = 0.3, detune = 0 }) => {
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

    this.musicNextTime = ctx.currentTime + 0.06;
    const playStep = () => {
      if (!this.ctx || !this.musicGain || this.muted || !this.settings.musicOn) return;
      const now = this.ctx.currentTime;
      if (this.musicNextTime < now - 0.2) this.musicNextTime = now + 0.02;
      const t0 = this.musicNextTime;
      const step = this.musicStep;
      const stepInBar = step % 8;
      const bar = Math.floor(step / 8) % 4;
      const chord = chords[bar];
      const lift = (this.musicStage - 1) / 9;
      const drive = Math.max(lift, this.musicProgress * 0.55);
      const semi = (offset) => base * Math.pow(2, offset / 12);

      if (stepInBar === 0 || stepInBar === 4 || (drive > 0.6 && stepInBar === 6)) {
        this.percussion('kick', t0, 0.75 + 0.25 * drive);
      }
      if (stepInBar === 2 || stepInBar === 6) {
        this.percussion('snare', t0, 0.6 + 0.4 * drive);
      }
      if (stepInBar % 2 === 0 || drive > 0.45) {
        this.percussion('hat', t0, stepInBar % 2 === 0 ? 0.6 : 0.3 + 0.3 * drive);
      }
      if (stepInBar === 0 || stepInBar === 3 || stepInBar === 6) {
        const offset = chord.bass + (stepInBar === 6 ? 7 : 0);
        note(semi(offset), t0, {
          type: 'sine', peak: 0.11, attack: 0.01, release: stepInBar === 0 ? 0.42 : 0.26,
        });
      }
      if (stepInBar === 0) {
        for (const offset of chord.pad) {
          note(semi(offset), t0 + 0.02, {
            type: 'triangle', peak: 0.018, attack: 0.5, release: 3.6, detune: 3,
          });
        }
      }
      const offset = lead[step % lead.length];
      if (offset !== null) {
        note(semi(offset), t0, {
          type: 'triangle', peak: 0.075 + 0.03 * drive, attack: 0.015, release: 0.32, detune: -3,
        });
        if (drive > 0.6) {
          note(semi(offset + 4), t0 + 0.02, {
            type: 'sine', peak: 0.022, attack: 0.01, release: 0.26, detune: 5,
          });
        }
      }
      if (drive > 0.45 && step % 2 === 1) {
        const shimmer = chord.pad[Math.floor(step / 2) % chord.pad.length] + 12;
        note(semi(shimmer), t0, { type: 'sine', peak: 0.02, attack: 0.008, release: 0.17 });
      }

      this.musicStep += 1;
      this.musicNextTime += stepDur;
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

  /** Short reward melody when a stage is cleared. Pitch rises with the stage. */
  playStageClear(stage = 1) {
    if (!this.available || this.muted) return;
    const s = Math.max(1, Math.min(10, Number(stage) || 1));
    const shift = ((s - 1) % 5) - 2; // -2..+2 semitones, subtle lift per stage
    const root = 392; // G4
    const motif = [0, 4, 7, 12];
    motif.forEach((semis, i) => {
      this.tone({
        freq: root * Math.pow(2, (semis + shift) / 12),
        duration: 0.2, type: 'triangle', volume: 0.16, delay: i * 0.11,
      });
    });
    [0, 4, 7].forEach((semis) => {
      this.tone({
        freq: root * Math.pow(2, (semis + shift) / 12),
        duration: 0.5, type: 'sine', volume: 0.08, delay: 0.46,
      });
    });
  }

  /** Longer fanfare when every stage of a CEFR level is complete. */
  playLevelSong(level) {
    if (!this.available || this.muted) return;
    const melodies = {
      A1: [0, 4, 7, 12, 7, 12],
      A2: [2, 5, 9, 12, 9, 14],
      B1: [7, 11, 14, 19, 14, 19],
    };
    const notes = melodies[level] || melodies.A1;
    const root = 261.63; // C4
    notes.forEach((semis, i) => {
      this.tone({
        freq: root * Math.pow(2, semis / 12),
        duration: 0.26,
        type: i % 2 ? 'sine' : 'triangle',
        volume: 0.16,
        delay: i * 0.15,
      });
    });
    [0, 4, 7, 12].forEach((semis) => {
      this.tone({
        freq: root * Math.pow(2, (semis + 12) / 12),
        duration: 0.9, type: 'sine', volume: 0.08, delay: 0.9,
      });
    });
  }
}
