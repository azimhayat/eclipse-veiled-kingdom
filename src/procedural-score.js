const TAU = Math.PI * 2;

const SCALE_RATIOS = Object.freeze({
  veil: [1, 9 / 8, 6 / 5, 4 / 3, 3 / 2, 8 / 5, 9 / 5],
  dawn: [1, 9 / 8, 5 / 4, 4 / 3, 3 / 2, 5 / 3, 15 / 8],
  eclipse: [1, 16 / 15, 6 / 5, 4 / 3, 3 / 2, 8 / 5, 9 / 5],
});

export const SCORE_PROFILES = Object.freeze({
  silence: Object.freeze({ id: 'silence', tempo: 56, root: 110, scale: 'veil', intensity: 0, steps: 8 }),
  title: Object.freeze({ id: 'title', tempo: 54, root: 110, scale: 'dawn', intensity: .22, steps: 8 }),
  exploration: Object.freeze({ id: 'exploration', tempo: 66, root: 110, scale: 'veil', intensity: .3, steps: 8 }),
  puzzle: Object.freeze({ id: 'puzzle', tempo: 76, root: 123.47, scale: 'veil', intensity: .38, steps: 8 }),
  danger: Object.freeze({ id: 'danger', tempo: 88, root: 98, scale: 'eclipse', intensity: .5, steps: 8 }),
  'warden-guardian': Object.freeze({ id: 'warden-guardian', tempo: 92, root: 92.5, scale: 'eclipse', intensity: .58, steps: 8 }),
  'warden-command': Object.freeze({ id: 'warden-command', tempo: 108, root: 92.5, scale: 'eclipse', intensity: .7, steps: 8 }),
  'warden-eclipse': Object.freeze({ id: 'warden-eclipse', tempo: 124, root: 92.5, scale: 'eclipse', intensity: .82, steps: 8 }),
  restoration: Object.freeze({ id: 'restoration', tempo: 64, root: 130.81, scale: 'dawn', intensity: .46, steps: 8 }),
  dead: Object.freeze({ id: 'dead', tempo: 46, root: 82.41, scale: 'eclipse', intensity: .18, steps: 8 }),
});

function stringHash(value = '') {
  let hash = 2166136261;
  for (const char of String(value)) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
function randomUnit(seed) {
  const value = Math.sin((seed + 1) * 12.9898) * 43758.5453;
  return value - Math.floor(value);
}

export function selectScoreProfile(scene = {}) {
  if (scene.mode === 'paused' || scene.mode === 'loading' || scene.mode === 'load-error') return SCORE_PROFILES.silence;
  if (scene.mode === 'title' || scene.mode === 'boot' || scene.mode === 'help') return SCORE_PROFILES.title;
  if (scene.mode === 'dead') return SCORE_PROFILES.dead;
  if (scene.mode === 'win' || scene.restored || scene.completed) return SCORE_PROFILES.restoration;
  if (scene.warden?.active) {
    if (scene.warden.phase === 'eclipse' || scene.warden.phase === 'finale') return SCORE_PROFILES['warden-eclipse'];
    if (scene.warden.phase === 'command') return SCORE_PROFILES['warden-command'];
    return SCORE_PROFILES['warden-guardian'];
  }
  if (scene.healthRatio > 0 && scene.healthRatio <= .35) return SCORE_PROFILES.danger;
  if (scene.objectiveActive || scene.objectiveType) return SCORE_PROFILES.puzzle;
  return SCORE_PROFILES.exploration;
}

export function scoreSeed(levelKey, profileId = '') {
  return stringHash(`${levelKey || 'outer-veil'}:${profileId}`);
}

export function createScoreStep(profile, step = 0, seed = 0) {
  if (!profile || profile.intensity <= 0) return [];
  const scale = SCALE_RATIOS[profile.scale] || SCALE_RATIOS.veil;
  const index = Math.abs(Math.floor(step));
  const cycle = Math.floor(index / profile.steps);
  const melodicIndex = (index * 3 + Math.floor(randomUnit(seed + cycle) * scale.length)) % scale.length;
  const root = profile.root * (cycle % 4 === 3 ? 2 : 1);
  const beatSeconds = 60 / profile.tempo;
  const notes = [];

  if (index % 2 === 0 || profile.intensity >= .55) {
    notes.push({
      freq: root * scale[melodicIndex],
      duration: beatSeconds * (profile.intensity >= .68 ? .68 : .92),
      type: profile.id.startsWith('warden') ? 'triangle' : 'sine',
      gain: .035 + profile.intensity * .035,
      delay: 0,
    });
  }
  if (index % 4 === 0) {
    notes.push({
      freq: profile.root / 2,
      duration: beatSeconds * 2.8,
      type: 'triangle',
      gain: .022 + profile.intensity * .025,
      delay: 0,
    });
  }
  if (profile.intensity >= .68 && index % 2 === 1) {
    notes.push({
      freq: profile.root * scale[(melodicIndex + 4) % scale.length] * 2,
      duration: beatSeconds * .2,
      type: 'square',
      gain: .018 + profile.intensity * .018,
      delay: beatSeconds * .08,
    });
  }
  return notes.slice(0, 3).map((note) => ({
    ...note,
    freq: Math.max(35, Math.min(1800, note.freq)),
    phase: randomUnit(seed + index * 31) * TAU,
  }));
}
