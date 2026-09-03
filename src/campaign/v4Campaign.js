import { AuthoredLevelRepository } from './AuthoredLevelRepository.js';
import { loadPrototypeLevel } from './catalog.js';
import { assertValidAuthoredLevel } from './levelSchema.js';
import {
  loadOuterVeilLevel,
  OUTER_VEIL_CAMPAIGN_CATALOG,
} from './outerVeilCampaign.js';
import { Tile } from '../levels/constants.js';

export const V4_CAMPAIGN_ID = 'veiled-kingdom-v4-20';
export const V4_SESSION_KIND = 'v4-campaign';
export const V4_CAMPAIGN_KEY = 'v4';
export const V4_OUTER_VEIL_REALM_KEY = 'outer-veil';
export const V4_INNER_KINGDOM_REALM_KEY = 'inner-kingdom';

const stageTwoEntries = [
  {
    levelKey: 'inner-kingdom-01-outer-veil-restored', campaignOrder: 11, legacyId: 1,
    sourceLevelKey: 'outer-veil', title: 'Outer Veil Restored',
    subtitle: 'The Road Behind You Lives',
    storyLine: 'Aren crosses the first road again and finds that every returned name has changed its defenders.',
    mechanic: 'Re-read the restored route under a mixed occupation and prove the first lessons without guidance.',
    targetTime: { parSeconds: 205, masterySeconds: 135 },
    gameplay: {
      openingHint: 'RETURN TRIAL · the road is familiar, but its defenders are not',
      enemyRoster: ['shield', 'spear', 'archer'],
      tutorialCues: [],
      deterministicRoute: ['restored-sand', 'crown-gate', 'dawn-road'],
    },
  },
  {
    levelKey: 'inner-kingdom-02-road-of-missing-names', campaignOrder: 12, legacyId: 2,
    sourceLevelKey: 'inner-kingdom', title: 'The Inner Kingdom',
    subtitle: 'Road of Missing Names',
    storyLine: 'Beyond the Warden, the archive has removed whole families from the kingdom’s memory.',
    mechanic: 'Carve two sealed rises, balance the oath block, and recover the names hidden on three heights.',
    targetTime: { parSeconds: 250, masterySeconds: 165 },
    gameplay: {
      openingHint: 'THE INNER ROAD · height, sand, and balance now answer together',
      enemyRoster: ['grunt', 'shield'],
      tutorialCues: [{ minX: 28, maxX: 37, text: 'BALANCE TEST · settle the oath block on the civic promise' }],
      deterministicRoute: ['inner-sand', 'mid-vault', 'inner-stair'],
    },
  },
  {
    levelKey: 'inner-kingdom-03-sundered-aqueduct', campaignOrder: 13, legacyId: 3,
    sourceLevelKey: 'sundered-aqueduct', title: 'The Sundered Aqueduct',
    subtitle: 'Water Keeps the Names',
    storyLine: 'The erased citizens survive as reflections moving beneath a broken royal aqueduct.',
    mechanic: 'Read water buoyancy and moving lifts as one route before the archive drains the channel.',
    targetTime: { parSeconds: 245, masterySeconds: 160 },
    gameplay: {
      openingHint: 'CURRENT TRIAL · tap Jump to swim and use the lifts before the route closes',
      enemyRoster: ['grunt', 'spear'],
      tutorialCues: [{ minX: 10, maxX: 28, text: 'WATER MEMORY · tap Jump to rise; release to sink beneath danger' }],
      deterministicRoute: ['flood-mark', 'lift-seal', 'aqueduct-crown'],
    },
  },
  {
    levelKey: 'inner-kingdom-04-buried-foundry', campaignOrder: 14, legacyId: 4,
    sourceLevelKey: 'buried-foundry', title: 'The Buried Foundry',
    subtitle: 'Hammer Without a King',
    storyLine: 'An abandoned foundry still stamps the Crown’s lie into every blade it makes.',
    mechanic: 'Cross timed crushers, moving anvils, and a guarded forge without losing the rhythm.',
    targetTime: { parSeconds: 240, masterySeconds: 155 },
    gameplay: {
      openingHint: 'FOUNDRY RHYTHM · watch one full crusher cycle before committing',
      enemyRoster: ['shield', 'spear'],
      tutorialCues: [{ minX: 20, maxX: 56, text: 'RHYTHM TEST · move on the crusher’s rise, never beneath its fall' }],
      deterministicRoute: ['coal-sigil', 'anvil-oath', 'forge-heart'],
    },
  },
  {
    levelKey: 'inner-kingdom-05-gardens-of-glass', campaignOrder: 15, legacyId: 5,
    sourceLevelKey: 'gardens-of-glass', title: 'The Gardens of Glass',
    subtitle: 'A Bloom That Remembers',
    storyLine: 'Crystal flowers preserve forbidden faces, but every bright foothold can betray its weight.',
    mechanic: 'Chain precise crystal landings with moving garden terraces and a guarded ascent.',
    targetTime: { parSeconds: 235, masterySeconds: 150 },
    gameplay: {
      openingHint: 'GLASS GARDEN · land centrally; crystal edges punish hurried jumps',
      enemyRoster: ['grunt', 'archer'],
      tutorialCues: [{ minX: 18, maxX: 58, text: 'PRECISION TEST · commit to the terrace only when its return arc begins' }],
      deterministicRoute: ['root-memory', 'glass-bloom', 'sun-seed'],
    },
  },
  {
    levelKey: 'inner-kingdom-06-hollow-barracks', campaignOrder: 16, legacyId: 6,
    sourceLevelKey: 'hollow-barracks', title: 'The Hollow Barracks',
    subtitle: 'The Army That Forgot Why',
    storyLine: 'Soldiers defend empty bunks because the Crown erased the oaths that once made them human.',
    mechanic: 'Break a mixed shield, spear, and archer formation while moving through exposed lifts.',
    targetTime: { parSeconds: 255, masterySeconds: 175 },
    gameplay: {
      openingHint: 'FORMATION TRIAL · isolate the shield bearer before the archers gain a clear lane',
      enemyRoster: ['shield', 'spear', 'archer'],
      tutorialCues: [{ minX: 60, maxX: 88, text: 'COMBAT TEST · keep moving; the formation is strongest when you stand still' }],
      deterministicRoute: ['captain-mark', 'watch-seal', 'barracks-oath'],
    },
  },
  {
    levelKey: 'inner-kingdom-07-observatory-of-mirrors', campaignOrder: 17, legacyId: 7,
    sourceLevelKey: 'observatory-of-mirrors', title: 'Observatory of Mirrors',
    subtitle: 'Light Has Two Truths',
    storyLine: 'The royal observatory points every beam at a history the Crown wants Aren to mistake for truth.',
    mechanic: 'Rotate the mirror route, read the beam, and cross moving platforms under ranged pressure.',
    targetTime: { parSeconds: 265, masterySeconds: 180 },
    gameplay: {
      openingHint: 'MIRROR TRIAL · Strike a mirror to turn the beam toward the sealed path',
      enemyRoster: ['shield', 'archer'],
      tutorialCues: [{ minX: 8, maxX: 48, text: 'LIGHT TEST · follow the beam’s destination, not the mirror’s face' }],
      deterministicRoute: ['first-lens', 'eclipse-lens', 'true-star'],
    },
  },
  {
    levelKey: 'inner-kingdom-08-shifting-sepulchre', campaignOrder: 18, legacyId: 8,
    sourceLevelKey: 'shifting-sepulchre', title: 'The Shifting Sepulchre',
    subtitle: 'Walk Between Pulses',
    storyLine: 'The dead kept their names by hiding the road itself between alternating veils.',
    mechanic: 'Memorize the veil-platform cadence and fight only from stable ground.',
    targetTime: { parSeconds: 250, masterySeconds: 165 },
    gameplay: {
      openingHint: 'VEIL TRIAL · each bridge exists on one pulse and vanishes on the next',
      enemyRoster: ['spear', 'archer'],
      tutorialCues: [{ minX: 38, maxX: 68, text: 'PULSE TEST · wait on stone, then cross the whole veil chain decisively' }],
      deterministicRoute: ['mourner-name', 'hidden-road', 'sepulchre-key'],
    },
  },
  {
    levelKey: 'inner-kingdom-09-crown-under-siege', campaignOrder: 19, legacyId: 9,
    sourceLevelKey: 'crown-under-siege', title: 'The Crown Under Siege',
    subtitle: 'No Wall Stands Alone',
    storyLine: 'At the last city wall, restored citizens fight beside Aren instead of waiting to be remembered.',
    mechanic: 'Combine crushers, movers, and a full enemy roster in a sustained approach to the throne.',
    targetTime: { parSeconds: 270, masterySeconds: 185 },
    gameplay: {
      openingHint: 'SIEGE TRIAL · advance between volleys and use the machinery as cover',
      enemyRoster: ['shield', 'spear', 'archer'],
      tutorialCues: [{ minX: 55, maxX: 88, text: 'MASTERY · control the ground first; the final ascent is not a race' }],
      deterministicRoute: ['wall-standard', 'citizen-oath', 'siege-crown'],
    },
  },
  {
    levelKey: 'inner-kingdom-10-throne-of-eclipse', campaignOrder: 20, legacyId: 10,
    sourceLevelKey: 'throne-of-eclipse', title: 'Throne of the Eclipse',
    subtitle: 'The Second Veil Opens',
    storyLine: 'The old throne has grown a guardian from every command the restored kingdom refused to obey.',
    mechanic: 'Master moving and vanishing ground, defeat the throne guardian, and open the second Crown Path.',
    targetTime: { parSeconds: 300, masterySeconds: 205 },
    gameplay: {
      openingHint: 'THRONE TRIAL · recover the seals, then defeat the guardian to break the second veil',
      enemyRoster: ['shield', 'spear', 'archer'],
      tutorialCues: [{ minX: 58, maxX: 88, text: 'FINAL TEST · clear the arena before committing to the guardian' }],
      deterministicRoute: ['royal-seal', 'eclipse-crown', 'guardian-brand', 'throne-guardian'],
    },
  },
];

export const V4_CAMPAIGN_CATALOG = Object.freeze([
  ...OUTER_VEIL_CAMPAIGN_CATALOG.map((entry) => Object.freeze({ ...entry })),
  ...stageTwoEntries.map((entry) => Object.freeze({ ...entry, realmKey: V4_INNER_KINGDOM_REALM_KEY })),
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

export function getV4CampaignEntry(levelKey) {
  return V4_CAMPAIGN_CATALOG.find((entry) => entry.levelKey === levelKey) || null;
}

export async function loadV4Level(levelKey) {
  const entry = getV4CampaignEntry(levelKey);
  if (!entry) throw new Error(`Unknown V4 level: ${levelKey}`);
  if (entry.campaignOrder <= 10) return loadOuterVeilLevel(levelKey);

  const prototype = await loadPrototypeLevel(entry.sourceLevelKey);
  const source = entry.campaignOrder === 11 ? restoreOuterVeil(prototype) : prototype;
  return assertValidAuthoredLevel({
    ...source,
    name: entry.title,
    subtitle: entry.subtitle,
    storyLine: entry.storyLine,
    mechanic: entry.mechanic,
    targetTime: entry.targetTime,
    gameplay: entry.gameplay,
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
