import { AuthoredLevelRepository } from './AuthoredLevelRepository.js';
import { loadPrototypeLevel } from './catalog.js';
import { assertValidAuthoredLevel } from './levelSchema.js';
import {
  loadOuterVeilLevel,
  OUTER_VEIL_CAMPAIGN_CATALOG,
} from './outerVeilCampaign.js';
import { Tile } from '../levels/constants.js';
import { cloneObjective } from '../levels/cloneObjective.js';

export const V4_CAMPAIGN_ID = 'veiled-kingdom-v4-20';
export const V4_SESSION_KIND = 'v4-campaign';
export const V4_CAMPAIGN_KEY = 'v4';
export const V4_OUTER_VEIL_REALM_KEY = 'outer-veil';
export const V4_INNER_KINGDOM_REALM_KEY = 'inner-kingdom';
export const V5_LAUNCH_PRESENTATION = Object.freeze({
  releaseLabel: 'V5 · STORY ONE · CHAPTERS I–II · TWENTY LEVELS',
  completionEyebrow: 'CHAPTER II COMPLETE',
  completionHeading: 'THE SECOND CROWN PATH IS OPEN',
  nextChapter: 'CHAPTER III — THE SUNDERED AQUEDUCT',
  nextStatus: 'COMING SOON',
  chronicleLabel: 'FOUNDERS’ CHRONICLE',
});

const lioraStoryMoments = Object.freeze({
  1: Object.freeze({
    id: 'liora-01-two-cartographers',
    delivery: 'presentation',
    kicker: 'Memory echo · an unknown voice',
    title: '“You did not draw this road alone.”',
    detail: 'A woman’s voice survives beneath the first buried path, but the Crown has taken her name.',
  }),
  2: Object.freeze({
    id: 'liora-01-two-cartographers',
    delivery: 'objective',
    kicker: 'Memory echo · a second hand',
    title: 'Two cartographer marks share one line.',
    detail: 'Aren’s seal is joined by another: deliberate, equal, and carefully hidden from Serath.',
  }),
  3: Object.freeze({
    id: 'liora-02-the-heir-resists',
    delivery: 'objective',
    kicker: 'Recovered procession · before the Eclipse',
    title: 'An unnamed heir stands against the Regent.',
    detail: 'She refuses Serath’s claim that the Crown may own the memories of Orun’s citizens.',
  }),
  4: Object.freeze({
    id: 'liora-03-law-before-crown',
    delivery: 'objective',
    kicker: 'Recovered law · the first promise',
    title: 'The protective law bears the heir’s seal.',
    detail: 'Before its corruption, the oath placed every citizen’s memory beyond royal possession.',
  }),
  7: Object.freeze({
    id: 'liora-04-last-lamp',
    delivery: 'objective',
    kicker: 'Mira · keeper of the Last Lamp',
    title: '“This flame was kept for the lost heir.”',
    detail: 'Mira admits the sanctum was never waiting for a king. It was holding a road for someone erased.',
  }),
  9: Object.freeze({
    id: 'liora-05-concealed-seal',
    delivery: 'objective',
    kicker: 'Gate memory · two makers',
    title: 'Aren’s mark hides the heir’s seal beneath it.',
    detail: 'The inward-facing defense was authored by two people who expected the Crown itself to become the threat.',
  }),
  10: Object.freeze({
    id: 'liora-06-carried-into-the-paths',
    delivery: 'cinematic',
    kicker: 'The restored Warden remembers',
    title: '“You carried the heir into the Crown Paths.”',
    detail: 'The Warden confirms that the erased heir persists as divided living light, hidden beyond the Outer Veil.',
  }),
  13: Object.freeze({
    id: 'liora-07-face-between-floors',
    delivery: 'presentation',
    portraitPath: 'assets/liora-memory-fragment-v1.png',
    portraitAlt: 'A fragmented living-light memory of the still-unnamed heir',
    kicker: 'Civic fragment · identity withheld',
    title: 'A face and voice return between floors.',
    detail: 'She speaks of public roads and shared memory, while every registry panel still refuses to name her.',
  }),
  15: Object.freeze({
    id: 'liora-08-the-heirs-petition',
    delivery: 'chapter',
    kicker: 'Civic fragment · the heir’s petition',
    title: '“Memory belongs first to the person who lived it.”',
    detail: 'The unnamed heir’s own petition proves her reform was consent, not ceremony.',
  }),
  17: Object.freeze({
    id: 'liora-09-ysras-oath',
    delivery: 'presentation',
    kicker: 'Civic fragment · a captain’s vow',
    title: 'Ysra swore to defend the heir’s voice above the Crown.',
    detail: 'The recovered oath links the still-unnamed witness to the captain now hunting Aren.',
  }),
  18: Object.freeze({
    id: 'liora-10-the-name-spoken',
    delivery: 'presentation',
    kicker: 'The dead complete the sentence',
    title: '“Her name is Liora.”',
    detail: 'Many erased voices restore the same forbidden truth: Princess Liora of Orun survived within the memory network.',
  }),
  19: Object.freeze({
    id: 'liora-11-testimony-not-title',
    delivery: 'presentation',
    kicker: 'The citizens answer',
    title: 'They follow Liora’s testimony—not her crown.',
    detail: 'The restored citizens rally around what she proved, refusing to turn her title into another command.',
  }),
  20: Object.freeze({
    id: 'liora-12-a-living-witness',
    delivery: 'cinematic',
    kicker: 'Living light · Princess Liora',
    title: '“Aren. Look at me. I chose the division.”',
    detail: '“You mapped ten paths because I asked you to keep my testimony from Serath. The choice was mine. The design—and its cost—were ours.”',
  }),
});

const stageTwoEntries = [
  {
    levelKey: 'inner-kingdom-01-outer-veil-restored', campaignOrder: 11, legacyId: 1,
    sourceLevelKey: 'outer-veil', title: 'Road of Missing Names',
    subtitle: 'The First Empty Register',
    storyLine: 'The restored road enters a civic avenue where every monument keeps a place for a name the Crown removed.',
    mechanic: 'Re-read the restored route under a mixed occupation and open the first empty civic register.',
    targetTime: { parSeconds: 205, masterySeconds: 135 },
    gameplay: {
      openingHint: 'EMPTY REGISTER · the road is familiar, but its missing citizens are not',
      enemyRoster: ['shield', 'spear', 'archer'],
      tutorialCues: [],
      deterministicRoute: ['restored-sand', 'crown-gate', 'dawn-road'],
    },
  },
  {
    levelKey: 'inner-kingdom-02-road-of-missing-names', campaignOrder: 12, legacyId: 2,
    sourceLevelKey: 'inner-kingdom', title: 'Houses Without Doors',
    subtitle: 'The Families Between Walls',
    storyLine: 'Whole households remain in the light behind sealed homes, remembered as addresses but not as people.',
    mechanic: 'Carve two sealed rises, balance the oath block, and return three households to the civic record.',
    targetTime: { parSeconds: 250, masterySeconds: 165 },
    gameplay: {
      openingHint: 'SEALED HOMES · height, sand, and balance now answer together',
      enemyRoster: ['grunt', 'shield'],
      tutorialCues: [{ minX: 28, maxX: 37, text: 'BALANCE TEST · settle the oath block on the civic promise' }],
      deterministicRoute: ['inner-sand', 'mid-vault', 'inner-stair'],
    },
  },
  {
    levelKey: 'inner-kingdom-03-sundered-aqueduct', campaignOrder: 13, legacyId: 3,
    sourceLevelKey: 'sundered-aqueduct', title: 'The Civic Lift',
    subtitle: 'A Face Between Floors',
    storyLine: 'A public lift repeats a woman’s face and voice, but every registry panel has scraped away who she was.',
    mechanic: 'Read the flooded lift and moving platforms as one civic route before its witness fades.',
    targetTime: { parSeconds: 245, masterySeconds: 160 },
    gameplay: {
      openingHint: 'CIVIC LIFT · tap Jump to swim and follow the public lift between floors',
      enemyRoster: ['grunt', 'spear'],
      tutorialCues: [{ minX: 10, maxX: 28, text: 'FLOODED SHAFT · tap Jump to rise; release to sink beneath danger' }],
      deterministicRoute: ['flood-mark', 'lift-seal', 'aqueduct-crown'],
    },
  },
  {
    levelKey: 'inner-kingdom-04-buried-foundry', campaignOrder: 14, legacyId: 4,
    sourceLevelKey: 'buried-foundry', title: 'Measure of a Citizen',
    subtitle: 'What Memory Cost',
    storyLine: 'The civic scales priced each citizen’s memories as tribute, turning private lives into entries the Crown could seize.',
    mechanic: 'Cross the timed civic presses and moving measures without becoming another entry in the Crown’s ledger.',
    targetTime: { parSeconds: 240, masterySeconds: 155 },
    gameplay: {
      openingHint: 'CIVIC MEASURE · watch one full press cycle before committing',
      enemyRoster: ['shield', 'spear'],
      tutorialCues: [{ minX: 20, maxX: 56, text: 'RHYTHM TEST · move on the crusher’s rise, never beneath its fall' }],
      deterministicRoute: ['coal-sigil', 'anvil-oath', 'forge-heart'],
    },
  },
  {
    levelKey: 'inner-kingdom-05-gardens-of-glass', campaignOrder: 15, legacyId: 5,
    sourceLevelKey: 'gardens-of-glass', title: 'Lantern Court',
    subtitle: 'The Heir’s Petition',
    storyLine: 'A preserved petition shows the unnamed heir demanding that memory remain the citizen’s, never the Crown’s.',
    mechanic: 'Chain precise landings across the court’s fragile testimony and carry the petition to its public seal.',
    targetTime: { parSeconds: 235, masterySeconds: 150 },
    gameplay: {
      openingHint: 'LANTERN COURT · land centrally; the narrow testimony ledges punish hurried jumps',
      enemyRoster: ['grunt', 'archer'],
      tutorialCues: [{ minX: 18, maxX: 58, text: 'PRECISION TEST · commit to the terrace only when its return arc begins' }],
      deterministicRoute: ['root-memory', 'glass-bloom', 'sun-seed'],
    },
  },
  {
    levelKey: 'inner-kingdom-06-hollow-barracks', campaignOrder: 16, legacyId: 6,
    sourceLevelKey: 'hollow-barracks', title: 'The Unwritten Market',
    subtitle: 'No Trade Without a Name',
    storyLine: 'Stalls stand full and ledgers blank; the occupation kept the goods and erased the people who made them.',
    mechanic: 'Break a mixed occupation patrol while crossing the market’s exposed freight lifts.',
    targetTime: { parSeconds: 255, masterySeconds: 175 },
    gameplay: {
      openingHint: 'MARKET OCCUPATION · isolate the shield bearer before the archers gain a clear lane',
      enemyRoster: ['shield', 'spear', 'archer'],
      tutorialCues: [{ minX: 60, maxX: 88, text: 'COMBAT TEST · keep moving; the formation is strongest when you stand still' }],
      deterministicRoute: ['captain-mark', 'watch-seal', 'barracks-oath'],
    },
  },
  {
    levelKey: 'inner-kingdom-07-observatory-of-mirrors', campaignOrder: 17, legacyId: 7,
    sourceLevelKey: 'observatory-of-mirrors', title: 'Magistrate’s Teeth',
    subtitle: 'The Captain’s Broken Oath',
    storyLine: 'Inside the Magistrate’s seal, the heir’s light remembers Captain Ysra swearing to defend her voice above the Crown.',
    mechanic: 'Turn the testimony mirrors, read the beam, and cross moving platforms under ranged pressure.',
    targetTime: { parSeconds: 265, masterySeconds: 180 },
    gameplay: {
      openingHint: 'MAGISTRATE’S SEAL · Strike a mirror to turn testimony toward the sealed path',
      enemyRoster: ['shield', 'archer'],
      tutorialCues: [{ minX: 8, maxX: 48, text: 'LIGHT TEST · follow the beam’s destination, not the mirror’s face' }],
      deterministicRoute: ['first-lens', 'eclipse-lens', 'true-star'],
    },
  },
  {
    levelKey: 'inner-kingdom-08-shifting-sepulchre', campaignOrder: 18, legacyId: 8,
    sourceLevelKey: 'shifting-sepulchre', title: 'Archive of Sentences',
    subtitle: 'The Name in Every Testimony',
    storyLine: 'The dead rebuild one forbidden sentence and speak the erased heir’s name: Liora.',
    mechanic: 'Memorize the archive’s veil cadence and assemble the forbidden sentence from stable ground.',
    targetTime: { parSeconds: 250, masterySeconds: 165 },
    gameplay: {
      openingHint: 'ARCHIVE PULSE · each sentence bridge exists on one pulse and vanishes on the next',
      enemyRoster: ['spear', 'archer'],
      tutorialCues: [{ minX: 38, maxX: 68, text: 'PULSE TEST · wait on stone, then cross the whole veil chain decisively' }],
      deterministicRoute: ['mourner-name', 'hidden-road', 'sepulchre-key'],
    },
  },
  {
    levelKey: 'inner-kingdom-09-crown-under-siege', campaignOrder: 19, legacyId: 9,
    sourceLevelKey: 'crown-under-siege', title: 'The Royal Road',
    subtitle: 'Follow the Witness, Not the Crown',
    storyLine: 'Citizens raise Liora’s testimony along the royal road, refusing to make her title another command.',
    mechanic: 'Combine civic machinery, moving roads, and the full occupation roster in a sustained public advance.',
    targetTime: { parSeconds: 270, masterySeconds: 185 },
    gameplay: {
      openingHint: 'ROYAL ROAD · advance between volleys and let the civic machinery become your cover',
      enemyRoster: ['shield', 'spear', 'archer'],
      tutorialCues: [{ minX: 55, maxX: 88, text: 'MASTERY · control the ground first; the final ascent is not a race' }],
      deterministicRoute: ['wall-standard', 'citizen-oath', 'siege-crown'],
    },
  },
  {
    levelKey: 'inner-kingdom-10-throne-of-eclipse', campaignOrder: 20, legacyId: 10,
    sourceLevelKey: 'throne-of-eclipse', title: 'The Nameless Magistrate',
    subtitle: 'A Name No Court Could Erase',
    storyLine: 'The Magistrate guards a blank royal record; beyond it, Liora gathers into one living-light witness.',
    mechanic: 'Master moving and vanishing ground, defeat the Nameless Magistrate, and open the second Crown Path.',
    bossIdentity: {
      displayName: 'The Nameless Magistrate',
      hudLabel: 'NAMELESS MAGISTRATE',
      visualStyle: 'nameless-magistrate',
    },
    targetTime: { parSeconds: 300, masterySeconds: 205 },
    gameplay: {
      openingHint: 'MAGISTRATE’S COURT · recover the seals, then defeat the Magistrate to open the second Crown Path',
      enemyRoster: ['shield', 'spear', 'archer'],
      tutorialCues: [{ minX: 58, maxX: 88, text: 'FINAL TEST · clear the arena before committing to the guardian' }],
      deterministicRoute: ['royal-seal', 'eclipse-crown', 'guardian-brand', 'throne-guardian'],
    },
  },
];

export const V4_CAMPAIGN_CATALOG = Object.freeze([
  ...OUTER_VEIL_CAMPAIGN_CATALOG.map((entry) => Object.freeze({
    ...entry,
    ...(lioraStoryMoments[entry.campaignOrder]
      ? { storyMoment: lioraStoryMoments[entry.campaignOrder] }
      : {}),
  })),
  ...stageTwoEntries.map((entry) => Object.freeze({
    ...entry,
    realmKey: V4_INNER_KINGDOM_REALM_KEY,
    ...(lioraStoryMoments[entry.campaignOrder]
      ? { storyMoment: lioraStoryMoments[entry.campaignOrder] }
      : {}),
  })),
]);

export const V4_LEVEL_KEYS = Object.freeze(V4_CAMPAIGN_CATALOG.map((entry) => entry.levelKey));

function assertV4Catalog() {
  if (V4_CAMPAIGN_CATALOG.length !== 20) throw new Error('V4 must contain exactly twenty playable levels.');
  const keys = new Set();
  V4_CAMPAIGN_CATALOG.forEach((entry, index) => {
    if (entry.campaignOrder !== index + 1) throw new Error('V4 campaign order must be contiguous.');
    if (keys.has(entry.levelKey)) throw new Error(`Duplicate V4 level key: ${entry.levelKey}`);
    keys.add(entry.levelKey);
  });
  const lioraMomentIds = new Set(V4_CAMPAIGN_CATALOG.flatMap((entry) => (
    entry.storyMoment?.id ? [entry.storyMoment.id] : []
  )));
  if (lioraMomentIds.size !== 12) throw new Error('V5 must contain exactly twelve Liora story moments.');
}

function restoreOuterVeil(level) {
  const map = level.map.map((row) => [...row]);
  for (const tx of [3, 4, 5, 6, 7, 8, 24, 25, 26, 27, 28, 29, 42, 43, 44, 45, 46]) {
    if (map[26][tx] === Tile.STONE) map[26][tx] = Tile.GLOW;
  }
  return {
    ...level,
    map,
    relics: level.relics.map((relic, index) => ({
      ...relic,
      label: ['Returned Name', 'Dawn Cartouche', 'Warden Oath'][index],
    })),
  };
}

function attachV5StoryMoment(level, entry) {
  if (!entry.storyMoment) return level;
  const storyMoment = { ...entry.storyMoment };
  if (storyMoment.delivery !== 'objective' || !level.objective) {
    return { ...level, storyMoment };
  }

  const objective = cloneObjective(level.objective);
  if (entry.campaignOrder === 2) {
    const makerSeal = objective.marks?.find(({ id }) => id === 'maker-seal');
    if (makerSeal) makerSeal.revealText = 'Two cartographer marks share one line: Aren’s seal and an equal second hand hidden from Serath.';
  } else if (entry.campaignOrder === 3) {
    const seizure = objective.stations?.find(({ id }) => id === 'inverted-crown');
    if (seizure) seizure.text = 'MIRA · Serath stands over an unnamed heir who refused the Crown’s ownership of memory.';
  } else if (entry.campaignOrder === 4) {
    if (objective.memoryMark) objective.memoryMark.revealText = 'THE HEIR’S SEAL · the first law placed every citizen’s memory beyond royal possession.';
  } else if (entry.campaignOrder === 7) {
    objective.completionHint = 'MIRA · This Last Lamp was kept for the lost heir—not for a king.';
  } else if (entry.campaignOrder === 9) {
    if (objective.memoryMark) objective.memoryMark.revealText = 'TWO MAKERS · Aren’s mark conceals the lost heir’s seal beneath the inward lock.';
  }
  return { ...level, objective, storyMoment };
}

export function getV4CampaignEntry(levelKey) {
  return V4_CAMPAIGN_CATALOG.find((entry) => entry.levelKey === levelKey) || null;
}

export async function loadV4Level(levelKey) {
  const entry = getV4CampaignEntry(levelKey);
  if (!entry) throw new Error(`Unknown V4 level: ${levelKey}`);
  if (entry.campaignOrder <= 10) {
    const level = await loadOuterVeilLevel(levelKey);
    return attachV5StoryMoment(level, entry);
  }

  const prototype = await loadPrototypeLevel(entry.sourceLevelKey);
  const source = entry.campaignOrder === 11 ? restoreOuterVeil(prototype) : prototype;
  const finiteRosterSize = Number.isInteger(source.maxEnemies) && source.maxEnemies > 0
    ? source.maxEnemies
    : 7;
  return assertValidAuthoredLevel({
    ...source,
    name: entry.title,
    subtitle: entry.subtitle,
    storyLine: entry.storyLine,
    mechanic: entry.mechanic,
    targetTime: entry.targetTime,
    ...(entry.storyMoment ? { storyMoment: { ...entry.storyMoment } } : {}),
    checkpoints: source.checkpoints.map((checkpoint, index) => ({
      ...checkpoint,
      label: `${entry.title} · return ${index + 1}`,
    })),
    boss: source.boss ? {
      ...source.boss,
      ...(entry.bossIdentity || {}),
    } : source.boss,
    gameplay: {
      ...entry.gameplay,
      combat: {
        style: 'unified',
        maxActive: Math.min(3, finiteRosterSize),
        maxSpawns: finiteRosterSize,
        controls: 'STRIKE chains three blows · DOWN guards · DOWN + STRIKE breaks shields · JUMP + STRIKE attacks from above',
      },
    },
  }, entry);
}

export function createV4CampaignRepository() {
  return new AuthoredLevelRepository({
    catalog: V4_CAMPAIGN_CATALOG,
    campaignId: V4_CAMPAIGN_ID,
    sessionKind: V4_SESSION_KIND,
    loadLevel: loadV4Level,
    decorate: (level) => level,
  });
}

assertV4Catalog();
