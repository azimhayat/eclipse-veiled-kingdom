export const CINEMATIC_CATALOG_VERSION = 'v5-launch-cinematics-v3';

const CINEMATICS = Object.freeze({
  'opening-prologue': Object.freeze({
    id: 'opening-prologue',
    version: 2,
    eyebrow: 'Story One · Prologue',
    title: 'The Eclipse of Orun',
    videoPath: 'assets/cinematics/opening-prologue-v2.mp4',
    captions: Object.freeze([Object.freeze({
      id: 'opening-prologue-en',
      path: 'assets/cinematics/opening-prologue-v2.en.vtt',
      kind: 'captions',
      srcLang: 'en',
      label: 'English',
      default: true,
    })]),
    synopsis: 'Orun builds the Crown Engine to preserve its people’s memories. Regent Serath inverts it, an artificial eclipse buries the kingdom, and Aren wakes beneath the ruins while an unnamed second cartographer survives only as scattered light.',
  }),
  'chapter-one-introduction': Object.freeze({
    id: 'chapter-one-introduction',
    version: 2,
    eyebrow: 'Chapter I · The Outer Veil',
    title: 'The First Buried Path',
    videoPath: 'assets/cinematics/chapter-one-introduction-v2.mp4',
    captions: Object.freeze([Object.freeze({
      id: 'chapter-one-introduction-en',
      path: 'assets/cinematics/chapter-one-introduction-v2.en.vtt',
      kind: 'captions',
      srcLang: 'en',
      label: 'English',
      default: true,
    })]),
    synopsis: 'Mira’s Last Lamp calls Aren toward an impossible sunrise. Carrying a broken oath-blade and a memory he cannot explain, he finds the first Crown Path beneath the Outer Veil.',
  }),
  'chapter-one-to-two-bridge': Object.freeze({
    id: 'chapter-one-to-two-bridge',
    version: 2,
    eyebrow: 'Chapter I Complete · First Crown Path',
    title: 'The Kingdom Without Names',
    videoPath: 'assets/cinematics/chapter-one-to-two-bridge-v2.mp4',
    captions: Object.freeze([Object.freeze({
      id: 'chapter-one-to-two-bridge-en',
      path: 'assets/cinematics/chapter-one-to-two-bridge-v2.en.vtt',
      kind: 'captions',
      srcLang: 'en',
      label: 'English',
      default: true,
    })]),
    synopsis: 'The restored Warden reveals that the erased heir survives across the Crown Paths. With the first route repaired, Aren enters the Inner Kingdom, where even names have been taken.',
  }),
  'chapter-two-to-three-bridge': Object.freeze({
    id: 'chapter-two-to-three-bridge',
    version: 2,
    eyebrow: 'Chapter II Complete · Second Crown Path',
    title: 'The Sundered Aqueduct',
    videoPath: 'assets/cinematics/chapter-two-to-three-bridge-v2.mp4',
    captions: Object.freeze([Object.freeze({
      id: 'chapter-two-to-three-bridge-en',
      path: 'assets/cinematics/chapter-two-to-three-bridge-v2.en.vtt',
      kind: 'captions',
      srcLang: 'en',
      label: 'English',
      default: true,
    })]),
    synopsis: 'Liora coheres and confirms the plan she chose with Aren, while refusing to erase its cost. Serath names Aren the Cartographer and the second restored path reveals the Sundered Aqueduct.',
  }),
});

export const CINEMATIC_SEQUENCES = Object.freeze({
  'chapter-one-opening': Object.freeze(['opening-prologue', 'chapter-one-introduction']),
  'opening-prologue': Object.freeze(['opening-prologue']),
  'chapter-one-introduction': Object.freeze(['chapter-one-introduction']),
  'chapter-one-to-two-bridge': Object.freeze(['chapter-one-to-two-bridge']),
  'chapter-two-to-three-bridge': Object.freeze(['chapter-two-to-three-bridge']),
  'story-one-films': Object.freeze([
    'opening-prologue',
    'chapter-one-introduction',
    'chapter-one-to-two-bridge',
    'chapter-two-to-three-bridge',
  ]),
});

function joinBaseUrl(baseUrl, path) {
  const base = typeof baseUrl === 'string' && baseUrl.length ? baseUrl : '/';
  return `${base.endsWith('/') ? base : `${base}/`}${path.replace(/^\/+/, '')}`;
}

export function getCinematic(id, { baseUrl = '/' } = {}) {
  const entry = CINEMATICS[id];
  if (!entry) return null;
  return Object.freeze({
    ...entry,
    src: joinBaseUrl(baseUrl, entry.videoPath),
    captions: Object.freeze(entry.captions.map((caption) => Object.freeze({
      ...caption,
      src: joinBaseUrl(baseUrl, caption.path),
    }))),
  });
}

export function getCinematicSequence(id, { baseUrl = '/' } = {}) {
  const ids = CINEMATIC_SEQUENCES[id];
  if (!ids) return null;
  return Object.freeze(ids.map((cinematicId) => getCinematic(cinematicId, { baseUrl })));
}

export function validateCinematicCatalog() {
  const ids = Object.keys(CINEMATICS);
  if (!ids.length) throw new Error('The cinematic catalog must not be empty.');
  for (const id of ids) {
    const entry = CINEMATICS[id];
    if (entry.id !== id || !Number.isInteger(entry.version) || entry.version < 1) {
      throw new Error(`Invalid cinematic identity: ${id}`);
    }
    if (!entry.videoPath.endsWith(`-v${entry.version}.mp4`)) {
      throw new Error(`Cinematic media path must be versioned: ${id}`);
    }
    const defaults = entry.captions.filter((caption) => caption.default);
    if (defaults.length !== 1 || defaults[0].kind !== 'captions' || !defaults[0].path.endsWith('.vtt')) {
      throw new Error(`Cinematic requires one default WebVTT caption track: ${id}`);
    }
  }
  for (const [sequenceId, sequence] of Object.entries(CINEMATIC_SEQUENCES)) {
    if (!sequence.length || sequence.some((id) => !CINEMATICS[id])) {
      throw new Error(`Invalid cinematic sequence: ${sequenceId}`);
    }
  }
  return true;
}

validateCinematicCatalog();
