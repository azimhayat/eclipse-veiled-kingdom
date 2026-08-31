import { AuthoredLevelRepository } from './AuthoredLevelRepository.js';
import { assertValidAuthoredLevel } from './levelSchema.js';

export const OUTER_VEIL_CAMPAIGN_ID = 'outer-veil-production-v1';
export const OUTER_VEIL_SESSION_KIND = 'production-campaign';
export const OUTER_VEIL_REALM_KEY = 'outer-veil';
export const INNER_KINGDOM_REALM_KEY = 'inner-kingdom';

const entries = [
  { levelKey: 'outer-veil-01-buried-dawn', campaignOrder: 1, legacyId: 1, title: 'Buried Dawn' },
  { levelKey: 'outer-veil-02-sand-that-remembers', campaignOrder: 2, legacyId: 2, title: 'Sand That Remembers', unlocksAbility: 'memory-carve' },
  { levelKey: 'outer-veil-03-broken-procession', campaignOrder: 3, legacyId: 3, title: 'The Broken Procession' },
  { levelKey: 'outer-veil-04-weight-of-oaths', campaignOrder: 4, legacyId: 4, title: 'The Weight of Oaths', unlocksAbility: 'oathbind' },
  { levelKey: 'outer-veil-05-teeth-beneath-dust', campaignOrder: 5, legacyId: 5, title: 'Teeth Beneath Dust' },
  { levelKey: 'outer-veil-06-pilgrims-climb', campaignOrder: 6, legacyId: 6, title: "Pilgrim's Climb", unlocksAbility: 'pilgrims-grip' },
  { levelKey: 'outer-veil-07-first-sanctum', campaignOrder: 7, legacyId: 7, title: 'The First Sanctum', unlocksAbility: 'sanctum-recall' },
  { levelKey: 'outer-veil-08-parachute-choir', campaignOrder: 8, legacyId: 8, title: 'Parachute Choir', unlocksAbility: 'dawnstroke' },
  { levelKey: 'outer-veil-09-gate-of-the-veil', campaignOrder: 9, legacyId: 9, title: 'Gate of the Veil' },
  { levelKey: 'outer-veil-10-warden-of-dust', campaignOrder: 10, legacyId: 10, title: 'Warden of Dust' },
];

export const OUTER_VEIL_CAMPAIGN_CATALOG = Object.freeze(
  entries.map((entry) => Object.freeze({ ...entry, realmKey: OUTER_VEIL_REALM_KEY })),
);

export const OUTER_VEIL_LEVEL_KEYS = Object.freeze(
  OUTER_VEIL_CAMPAIGN_CATALOG.map((entry) => entry.levelKey),
);

export const OUTER_VEIL_ABILITY_KEYS = Object.freeze(
  OUTER_VEIL_CAMPAIGN_CATALOG.flatMap((entry) => entry.unlocksAbility ? [entry.unlocksAbility] : []),
);

export const OUTER_VEIL_COMPLETION = Object.freeze({
  eyebrow: 'REALM I COMPLETE · THE OUTER VEIL',
  heading: 'The Guardian Chooses a Road',
  body: 'Aren frees the Warden from Serath’s inverted command. It does not die; it carries one narrow current of the unreturned toward Orun while the deeper archive remains sealed.',
  nextSlot: Object.freeze({
    realmKey: INNER_KINGDOM_REALM_KEY,
    label: 'NEXT · THE INNER KINGDOM',
    chapter: 'Road of Missing Names',
    status: 'Revealed by the Crown Path · not yet playable',
  }),
});

const levelLoaders = Object.freeze({
  'outer-veil-01-buried-dawn': async () => {
    const level = (await import('../levels/prototypes/outerVeil.js')).createOuterVeil();
    return {
      ...level,
      name: 'Buried Dawn',
      subtitle: 'The First Remembered Road',
      storyLine: 'A kingdom erased from history calls its cartographer home beneath the first buried dawn.',
      mechanic: 'Recover the three buried memories and reopen the first Crown Path.',
      targetTime: { parSeconds: 240, masterySeconds: 150 },
      gameplay: {
        openingHint: 'Move with A / D · Jump with SPACE or ↑',
        enemyRoster: ['grunt'],
        tutorialCues: [
          { minX: 9, maxX: 14, text: 'SAFE LESSON · hold jump for height; release for a short hop' },
          { minX: 14, maxX: 23, text: 'COMBINATION · hold W + toward the sand wall; DIG opens remembered sand' },
          { minX: 52, maxX: 69, text: 'MASTERY · crumble ledges fall after 0.45s; keep moving' },
        ],
        deterministicRoute: ['sand-crown', 'high-stair', 'arena-floor', 'eclipse-door'],
        demoRelicOrder: ['sand-crown', 'high-stair', 'arena-floor'],
      },
    };
  },
  'outer-veil-02-sand-that-remembers': async () => (
    await import('../levels/outerVeil/sandThatRemembers.js')
  ).createSandThatRemembers(),
  'outer-veil-03-broken-procession': async () => (
    await import('../levels/outerVeil/brokenProcession.js')
  ).createBrokenProcession(),
  'outer-veil-04-weight-of-oaths': async () => (
    await import('../levels/outerVeil/weightOfOaths.js')
  ).createWeightOfOaths(),
  'outer-veil-05-teeth-beneath-dust': async () => (
    await import('../levels/outerVeil/teethBeneathDust.js')
  ).createTeethBeneathDust(),
  'outer-veil-06-pilgrims-climb': async () => (
    await import('../levels/outerVeil/pilgrimsClimb.js')
  ).createPilgrimsClimb(),
  'outer-veil-07-first-sanctum': async () => (
    await import('../levels/outerVeil/firstSanctum.js')
  ).createFirstSanctum(),
  'outer-veil-08-parachute-choir': async () => (
    await import('../levels/outerVeil/parachuteChoir.js')
  ).createParachuteChoir(),
  'outer-veil-09-gate-of-the-veil': async () => (
    await import('../levels/outerVeil/gateOfTheVeil.js')
  ).createGateOfTheVeil(),
  'outer-veil-10-warden-of-dust': async () => (
    await import('../levels/outerVeil/wardenOfDust.js')
  ).createWardenOfDust(),
});

export function getOuterVeilCampaignEntry(levelKey) {
  return OUTER_VEIL_CAMPAIGN_CATALOG.find((entry) => entry.levelKey === levelKey) || null;
}

export async function loadOuterVeilLevel(levelKey) {
  const entry = getOuterVeilCampaignEntry(levelKey);
  if (!entry || !levelLoaders[levelKey]) throw new Error(`Unknown Outer Veil level: ${levelKey}`);
  return assertValidAuthoredLevel(await levelLoaders[levelKey](), entry);
}

export function createOuterVeilCampaignRepository() {
  return new AuthoredLevelRepository({
    catalog: OUTER_VEIL_CAMPAIGN_CATALOG,
    campaignId: OUTER_VEIL_CAMPAIGN_ID,
    sessionKind: OUTER_VEIL_SESSION_KIND,
    loadLevel: loadOuterVeilLevel,
    decorate: (level) => level,
  });
}
