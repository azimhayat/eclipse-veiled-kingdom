import { AuthoredLevelRepository } from './AuthoredLevelRepository.js';
import { loadOuterVeilLevel } from './outerVeilCampaign.js';

const previewEntries = Object.freeze({
  'sand-that-remembers': Object.freeze({
    routeKey: 'sand-that-remembers',
    levelKey: 'outer-veil-02-sand-that-remembers',
    campaignOrder: 2,
    legacyId: 2,
    title: 'Sand That Remembers',
    previewCampaignId: 'production-preview-sand-that-remembers',
    completion: Object.freeze({
      eyebrow: 'Aren’s first truth returns',
      heading: 'Cartographer mark revealed',
      body: 'The buried road remembers Aren’s hand. Memory Carve has restored the first golden line through the Outer Veil.',
    }),
  }),
  'broken-procession': Object.freeze({
    routeKey: 'broken-procession',
    levelKey: 'outer-veil-03-broken-procession',
    campaignOrder: 3,
    legacyId: 3,
    title: 'The Broken Procession',
    previewCampaignId: 'production-preview-broken-procession',
    completion: Object.freeze({
      eyebrow: 'The stone testimony survives',
      heading: 'The final witness stands',
      body: 'The procession tells the truth again: the coup came from inside the crown, along a hidden road Aren once mapped.',
    }),
  }),
  'weight-of-oaths': Object.freeze({
    routeKey: 'weight-of-oaths',
    levelKey: 'outer-veil-04-weight-of-oaths',
    campaignOrder: 4,
    legacyId: 4,
    title: 'The Weight of Oaths',
    previewCampaignId: 'production-preview-weight-of-oaths',
    completion: Object.freeze({
      eyebrow: 'The civic oath holds again',
      heading: 'The gate remembers its promise',
      body: 'Mira hears the old vow without the crown’s lie. Aren binds it freely, and the Outer Veil’s civic road rises again.',
    }),
  }),
  'teeth-beneath-dust': Object.freeze({
    routeKey: 'teeth-beneath-dust',
    levelKey: 'outer-veil-05-teeth-beneath-dust',
    campaignOrder: 5,
    legacyId: 5,
    title: 'Teeth Beneath Dust',
    previewCampaignId: 'production-preview-teeth-beneath-dust',
    completion: Object.freeze({
      eyebrow: 'The warning path rises',
      heading: 'The teeth fall silent',
      body: 'Aren turns the Crown’s buried punishment into a road of warning lights. Mira names every danger the dust was meant to hide.',
    }),
  }),
  'pilgrims-climb': Object.freeze({
    routeKey: 'pilgrims-climb',
    levelKey: 'outer-veil-06-pilgrims-climb',
    campaignOrder: 6,
    legacyId: 6,
    title: "Pilgrim's Climb",
    previewCampaignId: 'production-preview-pilgrims-climb',
    completion: Object.freeze({
      eyebrow: 'The pilgrims’ bell answers',
      heading: 'The tower finds its voice',
      body: 'Aren frees the bell the Crown buried. Its first clear note carries Mira’s light across the Outer Veil.',
    }),
  }),
  'first-sanctum': Object.freeze({
    routeKey: 'first-sanctum',
    levelKey: 'outer-veil-07-first-sanctum',
    campaignOrder: 7,
    legacyId: 7,
    title: 'The First Sanctum',
    previewCampaignId: 'production-preview-first-sanctum',
    completion: Object.freeze({
      eyebrow: 'Mira’s first lamp endures',
      heading: 'The sanctum remembers Aren',
      body: 'Aren restores the lamp with a truth the Crown buried. Mira binds its light to his return, and the dark can no longer erase the path home.',
    }),
  }),
  'parachute-choir': Object.freeze({
    routeKey: 'parachute-choir',
    levelKey: 'outer-veil-08-parachute-choir',
    campaignOrder: 8,
    legacyId: 8,
    title: 'Parachute Choir',
    previewCampaignId: 'production-preview-parachute-choir',
    completion: Object.freeze({
      eyebrow: 'The last descent is broken',
      heading: 'The sky sings for the living',
      body: 'Aren breaks the Crown’s measured descent. Mira raises the abandoned parachutes as golden wind-banners, and the Outer Veil answers with its own chorus.',
    }),
  }),
  'gate-of-the-veil': Object.freeze({
    routeKey: 'gate-of-the-veil',
    levelKey: 'outer-veil-09-gate-of-the-veil',
    campaignOrder: 9,
    legacyId: 9,
    title: 'Gate of the Veil',
    previewCampaignId: 'production-preview-gate-of-the-veil',
    completion: Object.freeze({
      eyebrow: 'The old quarantine breaks',
      heading: 'The seal was ours',
      body: 'Aren opens the gate he once helped Mira close. Beyond it, the dust draws one enormous breath; the reason for their fear remains unseen.',
    }),
  }),
  'warden-of-dust': Object.freeze({
    routeKey: 'warden-of-dust',
    levelKey: 'outer-veil-10-warden-of-dust',
    campaignOrder: 10,
    legacyId: 10,
    title: 'Warden of Dust',
    previewCampaignId: 'production-preview-warden-of-dust',
    completion: Object.freeze({
      eyebrow: 'The first Crown Path returns',
      heading: 'The guardian chooses a road',
      body: 'Aren frees the Warden from Serath’s inverted command. It does not die; it carries one narrow current of the unreturned toward Orun while the deeper archive remains sealed.',
    }),
  }),
});

export function createProductionPreviewRepository(levelKey) {
  const entry = previewEntries[levelKey];
  if (!entry) return null;
  return new AuthoredLevelRepository({
    catalog: [entry],
    campaignId: entry.previewCampaignId,
    sessionKind: 'production-preview',
    loadLevel: loadOuterVeilLevel,
    decorate: (level) => level,
  });
}

export const PRODUCTION_PREVIEW_KEYS = Object.freeze(Object.keys(previewEntries));

export function getProductionPreviewDescriptor(routeKey) {
  return previewEntries[routeKey] || null;
}
