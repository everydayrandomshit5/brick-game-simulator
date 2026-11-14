// 1-Bit Piezo Buzzer Audio Synthesizer for Brick Game
class SoundManager {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.masterGain = null;
    this.engineOsc = null;
    this.engineGain = null;
    this.isEngineRunning = false;
    this.engineWanted = false;
    this.melodyPlaying = false;
    this.melodyTimeout = null;
    this.melodyTimeouts = [];
    this.jingleTimeouts = [];
    this.onRumble = null;
    this.lastEngineRumbleTime = 0;
  }

  setRumbleCallback(fn) {
    this.onRumble = fn;
  }

  triggerRumble(durationMs, weak, strong) {
    if (this.onRumble) {
      this.onRumble(durationMs, weak, strong);
    }
  }

  init() {
    if (this.ctx) return;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioContext();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.muted ? 0 : 0.2, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);
    } catch (e) {
      console.warn('Web Audio not supported:', e);
    }
  }

  ensureContext() {
    if (!this.ctx) this.init();
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(this.muted ? 0 : 0.2, this.ctx.currentTime);
    }
    if (!this.muted && this.engineWanted && !this.isEngineRunning) {
      this.startEngine();
    }
    return !this.muted;
  }

  playTone(freq, duration = 0.04, type = 'square') {
    if (this.muted) return;
    this.ensureContext();
    if (!this.ctx) return;

    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);

      gain.gain.setValueAtTime(0.25, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start();
      osc.stop(this.ctx.currentTime + duration);
    } catch (e) {
      // Audio error catch
    }
  }

  click() {
    this.triggerRumble(25, 0.25, 0.05);
    this.playTone(880, 0.02);
  }

  move() {
    this.playTone(440, 0.025);
  }

  rotate() {
    this.triggerRumble(35, 0.35, 0.12);
    this.playTone(660, 0.035);
  }

  drop() {
    this.triggerRumble(65, 0.55, 0.45);
    this.playTone(220, 0.04);
  }

  pause() {
    this.triggerRumble(50, 0.4, 0.2);
    this.playTone(587, 0.05);
    const id = setTimeout(() => this.playTone(440, 0.05), 60);
    this.jingleTimeouts.push(id);
  }

  clear() {
    this.triggerRumble(85, 0.7, 0.5);
    const rumbleId = setTimeout(() => this.triggerRumble(110, 0.9, 0.75), 100);
    this.jingleTimeouts.push(rumbleId);
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, idx) => {
      const id = setTimeout(() => this.playTone(freq, 0.06), idx * 60);
      this.jingleTimeouts.push(id);
    });
  }

  crash() {
    this.triggerRumble(400, 1.0, 1.0);
    this.stopEngine();
    if (this.muted) return;
    this.ensureContext();
    if (!this.ctx) return;

    // Harsh low frequency buzz
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(110, this.ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(45, this.ctx.currentTime + 0.35);

      gain.gain.setValueAtTime(0.4, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.35);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start();
      osc.stop(this.ctx.currentTime + 0.35);
    } catch (e) {}
  }

  // Racing engine continuous sound
  startEngine() {
    this.engineWanted = true;
    if (this.isEngineRunning) return;
    this.ensureContext();
    if (!this.ctx) return;

    try {
      this.engineOsc = this.ctx.createOscillator();
      this.engineGain = this.ctx.createGain();

      this.engineOsc.type = 'square';
      this.engineOsc.frequency.setValueAtTime(65, this.ctx.currentTime); // idle rumble

      this.engineGain.gain.setValueAtTime(0.06, this.ctx.currentTime);

      this.engineOsc.connect(this.engineGain);
      this.engineGain.connect(this.masterGain);

      this.engineOsc.start();
      this.isEngineRunning = true;
    } catch (e) {}
  }

  setEngineSpeed(isTurbo, speedLevel = 1) {
    if (isTurbo) {
      const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
      if (now - this.lastEngineRumbleTime >= 120) {
        this.lastEngineRumbleTime = now;
        this.triggerRumble(60, 0.20, 0.08);
      }
    }

    if (!this.isEngineRunning || !this.engineOsc || !this.ctx) return;
    try {
      const baseFreq = 48 + speedLevel * 12;
      const targetFreq = isTurbo ? baseFreq * 2.0 : baseFreq;
      this.engineOsc.frequency.setTargetAtTime(targetFreq, this.ctx.currentTime, 0.05);
      if (this.engineGain) {
        this.engineGain.gain.setTargetAtTime(isTurbo ? 0.09 : 0.05, this.ctx.currentTime, 0.05);
      }
    } catch (e) {}
  }

  stopEngine() {
    this.engineWanted = false;
    if (!this.isEngineRunning) return;
    try {
      if (this.engineOsc) {
        this.engineOsc.stop();
        this.engineOsc.disconnect();
        this.engineOsc = null;
      }
      this.isEngineRunning = false;
    } catch (e) {}
  }

  // Classic Tetris Korobeiniki Melody
  playTetrisTheme() {
    if (this.muted || this.melodyPlaying) return;
    this.stopMelody();
    this.ensureContext();

    const notes = [
      { f: 659.25, d: 250 }, // E5
      { f: 493.88, d: 125 }, // B4
      { f: 523.25, d: 125 }, // C5
      { f: 587.33, d: 250 }, // D5
      { f: 523.25, d: 125 }, // C5
      { f: 493.88, d: 125 }, // B4
      { f: 440.00, d: 250 }, // A4
      { f: 440.00, d: 125 }, // A4
      { f: 523.25, d: 125 }, // C5
      { f: 659.25, d: 250 }, // E5
      { f: 587.33, d: 125 }, // D5
      { f: 523.25, d: 125 }, // C5
      { f: 493.88, d: 375 }, // B4
      { f: 523.25, d: 125 }, // C5
      { f: 587.33, d: 250 }, // D5
      { f: 659.25, d: 250 }, // E5
      { f: 523.25, d: 250 }, // C5
      { f: 440.00, d: 250 }, // A4
      { f: 440.00, d: 250 }  // A4
    ];

    this.melodyPlaying = true;
    let offset = 0;

    notes.forEach((item, idx) => {
      const id = setTimeout(() => {
        if (!this.muted && this.melodyPlaying) {
          this.playTone(item.f, item.d / 1000 * 0.85);
        }
        if (idx === notes.length - 1) {
          this.melodyPlaying = false;
          this.melodyTimeouts = [];
          this.melodyTimeout = null;
        }
      }, offset);
      this.melodyTimeouts.push(id);
      this.melodyTimeout = id;
      offset += item.d;
    });
  }

  stopMelody() {
    this.melodyPlaying = false;
    for (const id of this.melodyTimeouts) {
      clearTimeout(id);
    }
    this.melodyTimeouts = [];
    for (const id of this.jingleTimeouts) {
      clearTimeout(id);
    }
    this.jingleTimeouts = [];
    if (this.melodyTimeout) {
      clearTimeout(this.melodyTimeout);
      this.melodyTimeout = null;
    }
  }
}

// Export for browser/electron
if (typeof module !== 'undefined' && module.exports) {
  module.exports = SoundManager;
}
