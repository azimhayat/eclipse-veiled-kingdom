export class AudioManager {
  constructor() {
    this.context = null;
    this.master = null;
    this.muted = true;
  }

  unlock() {
    if (!this.context) {
      this.context = new (window.AudioContext || window.webkitAudioContext)();
      this.master = this.context.createGain();
      this.master.gain.value = this.muted ? 0 : .19;
      this.master.connect(this.context.destination);
    }
    if (this.context.state === 'suspended') this.context.resume();
  }

  toggle() {
    this.unlock();
    this.muted = !this.muted;
    this.master.gain.setTargetAtTime(this.muted ? 0 : .19, this.context.currentTime, .025);
    return this.muted;
  }

  tone(freq, duration, type = 'sine', endFreq = freq, volume = .45, delay = 0) {
    if (!this.context || this.muted) return;
    const now = this.context.currentTime + delay;
    const osc = this.context.createOscillator();
    const gain = this.context.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), now + duration);
    gain.gain.setValueAtTime(.0001, now);
    gain.gain.exponentialRampToValueAtTime(volume, now + .012);
    gain.gain.exponentialRampToValueAtTime(.0001, now + duration);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(now);
    osc.stop(now + duration + .03);
  }

  play(name) {
    const recipes = {
      jump: () => this.tone(230, .17, 'triangle', 560, .38),
      land: () => this.tone(90, .11, 'sine', 48, .24),
      attack: () => { this.tone(720, .12, 'sawtooth', 180, .22); this.tone(1100, .08, 'triangle', 420, .16, .025); },
      dig: () => { this.tone(135, .08, 'square', 80, .18); this.tone(260, .06, 'triangle', 110, .13, .05); },
      hit: () => this.tone(105, .13, 'square', 55, .28),
      hurt: () => this.tone(180, .24, 'sawtooth', 60, .3),
      relic: () => { this.tone(520, .3, 'sine', 1040, .28); this.tone(780, .35, 'triangle', 1560, .18, .08); },
      win: () => [392, 523, 659, 784].forEach((f, i) => this.tone(f, .38, 'sine', f * 1.03, .2, i * .11)),
      death: () => { this.tone(220, .65, 'sawtooth', 38, .26); this.tone(110, .75, 'sine', 28, .22); },
      gate: () => { this.tone(75, .55, 'triangle', 170, .32); this.tone(210, .4, 'sine', 420, .16, .18); },
    };
    recipes[name]?.();
  }
}
