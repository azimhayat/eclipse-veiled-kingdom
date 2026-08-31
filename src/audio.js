import { loadAudioSettings, persistAudioSettings, sanitizeAudioSettings } from './audio-settings.js';
import { createScoreStep, scoreSeed, selectScoreProfile } from './procedural-score.js';

const MASTER_LEVEL = .82;
const MUSIC_BUS_LEVEL = .68;
const EFFECTS_BUS_LEVEL = .78;

function browserStorage(windowObject) {
  try {
    return windowObject?.localStorage || null;
  } catch {
    return null;
  }
}

function ramp(param, value, context, smoothing = .035) {
  if (!param || !context) return;
  if (typeof param.setTargetAtTime === 'function') param.setTargetAtTime(value, context.currentTime, smoothing);
  else param.value = value;
}

export class AudioManager {
  constructor({ windowObject = globalThis.window, storage, AudioContextClass } = {}) {
    this.windowObject = windowObject;
    this.storage = storage === undefined ? browserStorage(windowObject) : storage;
    this.AudioContextClass = AudioContextClass || windowObject?.AudioContext || windowObject?.webkitAudioContext || null;
    this.settings = loadAudioSettings({ storage: this.storage }).settings;
    this.context = null;
    this.master = null;
    this.musicBus = null;
    this.effectsBus = null;
    this.compressor = null;
    this.voices = { music: new Set(), effects: new Set() };
    this.profile = selectScoreProfile({ mode: 'title' });
    this.profileId = this.profile.id;
    this.scoreStep = 0;
    this.scoreClock = 0;
    this.scoreSeed = scoreSeed('outer-veil', this.profileId);
    this.footstepClock = 0;
    this.destroyed = false;
  }

  get muted() { return this.settings.muted; }

  getSettings() { return { ...this.settings }; }

  persist(next) {
    const result = persistAudioSettings({ storage: this.storage, settings: next });
    this.settings = result.settings;
    this.applySettings();
    return { ...this.settings };
  }

  applySettings() {
    if (!this.context) return;
    ramp(this.master?.gain, this.settings.muted ? 0 : MASTER_LEVEL, this.context);
    ramp(this.musicBus?.gain, this.profile.intensity <= 0 ? 0 : this.settings.musicVolume * MUSIC_BUS_LEVEL, this.context);
    ramp(this.effectsBus?.gain, this.settings.effectsVolume * EFFECTS_BUS_LEVEL, this.context);
  }

  async unlock() {
    if (this.destroyed || !this.AudioContextClass) return false;
    try {
      if (!this.context) {
        this.context = new this.AudioContextClass();
        this.master = this.context.createGain();
        this.musicBus = this.context.createGain();
        this.effectsBus = this.context.createGain();
        this.compressor = typeof this.context.createDynamicsCompressor === 'function'
          ? this.context.createDynamicsCompressor()
          : null;
        this.musicBus.connect(this.master);
        this.effectsBus.connect(this.master);
        if (this.compressor) {
          this.master.connect(this.compressor);
          this.compressor.connect(this.context.destination);
        } else this.master.connect(this.context.destination);
        this.master.gain.value = this.settings.muted ? 0 : MASTER_LEVEL;
        this.musicBus.gain.value = this.settings.musicVolume * MUSIC_BUS_LEVEL;
        this.effectsBus.gain.value = this.settings.effectsVolume * EFFECTS_BUS_LEVEL;
      }
      if (this.context.state !== 'running' && this.context.state !== 'closed'
        && typeof this.context.resume === 'function') await this.context.resume();
      return this.context.state !== 'closed';
    } catch {
      const failedContext = this.context;
      this.context = null;
      this.master = null;
      this.musicBus = null;
      this.effectsBus = null;
      this.compressor = null;
      if (failedContext && failedContext.state !== 'closed' && typeof failedContext.close === 'function') {
        try { await failedContext.close(); } catch { /* the failed context is already unusable */ }
      }
      return false;
    }
  }

  setMuted(muted) {
    const next = this.persist({ ...this.settings, muted: Boolean(muted) });
    if (!next.muted) void this.unlock();
    return next.muted;
  }

  toggle() { return this.setMuted(!this.settings.muted); }

  setMusicVolume(value) {
    return this.persist(sanitizeAudioSettings({ ...this.settings, musicVolume: Number(value) })).musicVolume;
  }

  setEffectsVolume(value) {
    return this.persist(sanitizeAudioSettings({ ...this.settings, effectsVolume: Number(value) })).effectsVolume;
  }

  tone(freq, duration, type = 'sine', endFreq = freq, volume = .16, delay = 0, bus = 'effects') {
    if (!this.context || this.settings.muted || this.context.state === 'closed') return false;
    const voiceSet = bus === 'music' ? this.voices.music : this.voices.effects;
    const voiceLimit = bus === 'music' ? 18 : 28;
    if (voiceSet.size >= voiceLimit) return false;
    try {
      const now = this.context.currentTime + Math.max(0, delay);
      const osc = this.context.createOscillator();
      const gain = this.context.createGain();
      const safeDuration = Math.max(.025, Math.min(4, duration));
      osc.type = type;
      osc.frequency.setValueAtTime(Math.max(20, freq), now);
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), now + safeDuration);
      gain.gain.setValueAtTime(.0001, now);
      gain.gain.exponentialRampToValueAtTime(Math.max(.0002, Math.min(.42, volume)), now + Math.min(.018, safeDuration / 3));
      gain.gain.exponentialRampToValueAtTime(.0001, now + safeDuration);
      osc.connect(gain);
      gain.connect(bus === 'music' ? this.musicBus : this.effectsBus);
      voiceSet.add(osc);
      osc.onended = () => {
        voiceSet.delete(osc);
        try { osc.disconnect(); } catch { /* already detached */ }
        try { gain.disconnect(); } catch { /* already detached */ }
      };
      osc.start(now);
      osc.stop(now + safeDuration + .03);
      return true;
    } catch {
      return false;
    }
  }

  play(name) {
    if (!name) return false;
    let played = false;
    const tone = (...args) => { played = this.tone(...args) || played; };
    const recipes = {
      footstep: () => tone(76, .055, 'triangle', 54, .075),
      jump: () => tone(230, .17, 'triangle', 560, .25),
      land: () => tone(90, .11, 'sine', 48, .16),
      attack: () => { tone(720, .12, 'sawtooth', 180, .15); tone(1100, .08, 'triangle', 420, .1, .025); },
      dig: () => { tone(135, .08, 'square', 80, .13); tone(260, .06, 'triangle', 110, .09, .05); },
      hit: () => tone(105, .13, 'square', 55, .2),
      hurt: () => tone(180, .24, 'sawtooth', 60, .2),
      block: () => { tone(155, .12, 'square', 105, .15); tone(610, .08, 'triangle', 360, .1, .035); },
      parry: () => { tone(440, .1, 'triangle', 880, .16); tone(1180, .18, 'sine', 690, .1, .04); },
      heavy: () => { tone(92, .22, 'sawtooth', 42, .24); tone(280, .11, 'square', 120, .12, .035); },
      enemy: () => tone(196, .15, 'sawtooth', 126, .12),
      wave: () => { tone(68, .55, 'sawtooth', 46, .11); tone(104, .5, 'sine', 64, .1, .08); },
      oathbind: () => { tone(370, .22, 'sine', 740, .18); tone(555, .3, 'triangle', 1110, .11, .07); },
      'oath-release': () => { tone(520, .24, 'triangle', 260, .15); tone(330, .2, 'sine', 165, .09, .05); },
      relic: () => { tone(520, .3, 'sine', 1040, .18); tone(780, .35, 'triangle', 1560, .11, .08); },
      win: () => [392, 523, 659, 784].forEach((f, i) => tone(f, .38, 'sine', f * 1.03, .13, i * .11)),
      death: () => { tone(220, .65, 'sawtooth', 38, .17); tone(110, .75, 'sine', 28, .14); },
      gate: () => { tone(75, .55, 'triangle', 170, .2); tone(210, .4, 'sine', 420, .1, .18); },
      menu: () => tone(460, .08, 'sine', 620, .09),
    };
    recipes[name]?.();
    return played;
  }

  transitionMusic(nextProfile) {
    if (!this.context || !this.musicBus) return;
    const now = this.context.currentTime;
    const gain = this.musicBus.gain;
    gain.cancelScheduledValues?.(now);
    if (typeof gain.setTargetAtTime === 'function') {
      gain.setTargetAtTime(0, now, .014);
      if (nextProfile.intensity > 0 && !this.settings.muted) {
        gain.setTargetAtTime(this.settings.musicVolume * MUSIC_BUS_LEVEL, now + .085, .035);
      }
    } else gain.value = nextProfile.intensity > 0 && !this.settings.muted
      ? this.settings.musicVolume * MUSIC_BUS_LEVEL
      : 0;
    for (const voice of this.voices.music) {
      try { voice.stop(now + .075); } catch { /* voice already ended */ }
    }
  }

  update(scene = {}, dt = 0) {
    const profile = selectScoreProfile(scene);
    if (profile.id !== this.profileId) {
      this.transitionMusic(profile);
      this.profile = profile;
      this.profileId = profile.id;
      this.scoreStep = 0;
      this.scoreClock = 0;
      this.scoreSeed = scoreSeed(scene.levelKey, profile.id);
    }
    if (this.destroyed || !this.context || this.settings.muted || this.context.state !== 'running') return profile.id;

    const safeDt = Math.max(0, Math.min(.1, Number.isFinite(dt) ? dt : 0));
    const moving = scene.mode === 'play' && scene.grounded && Math.abs(scene.speed || 0) > 80;
    if (moving) {
      this.footstepClock -= safeDt;
      if (this.footstepClock <= 0) {
        this.play('footstep');
        this.footstepClock = Math.max(.2, .38 - Math.min(190, Math.abs(scene.speed || 0)) / 1500);
      }
    } else this.footstepClock = 0;

    if (profile.intensity <= 0) return profile.id;
    this.scoreClock -= safeDt;
    if (this.scoreClock <= 0) {
      const notes = createScoreStep(profile, this.scoreStep, this.scoreSeed);
      for (const note of notes) this.tone(note.freq, note.duration, note.type, note.freq, note.gain, note.delay, 'music');
      this.scoreStep += 1;
      this.scoreClock = Math.max(.18, 60 / profile.tempo / 2);
    }
    return profile.id;
  }

  async destroy() {
    this.destroyed = true;
    for (const voiceSet of Object.values(this.voices)) {
      for (const voice of voiceSet) {
        try { voice.stop(); } catch { /* voice already ended */ }
        try { voice.disconnect(); } catch { /* voice already detached */ }
      }
      voiceSet.clear();
    }
    const context = this.context;
    this.context = null;
    if (context && context.state !== 'closed' && typeof context.close === 'function') {
      try { await context.close(); } catch { /* browser may reject a duplicate close */ }
    }
  }
}
