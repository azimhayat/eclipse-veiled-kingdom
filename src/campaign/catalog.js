import { assertValidAuthoredLevel } from './levelSchema.js';

const dynamicPrototypeLoaders = Object.freeze({
  'outer-veil': async () => (await import('../levels/prototypes/outerVeil.js')).createOuterVeil(),
  'inner-kingdom': async () => (await import('../levels/prototypes/innerKingdom.js')).createInnerKingdom(),
  'sundered-aqueduct': async () => (await import('../levels/prototypes/sunderedAqueduct.js')).createSunderedAqueduct(),
  'buried-foundry': async () => (await import('../levels/prototypes/buriedFoundry.js')).createBuriedFoundry(),
  'gardens-of-glass': async () => (await import('../levels/prototypes/gardensOfGlass.js')).createGardensOfGlass(),
  'hollow-barracks': async () => (await import('../levels/prototypes/hollowBarracks.js')).createHollowBarracks(),
  'observatory-of-mirrors': async () => (await import('../levels/prototypes/observatoryOfMirrors.js')).createObservatoryOfMirrors(),
  'shifting-sepulchre': async () => (await import('../levels/prototypes/shiftingSepulchre.js')).createShiftingSepulchre(),
  'crown-under-siege': async () => (await import('../levels/prototypes/crownUnderSiege.js')).createCrownUnderSiege(),
  'throne-of-eclipse': async () => (await import('../levels/prototypes/throneOfEclipse.js')).createThroneOfEclipse(),
});

const entries = [
  { levelKey: 'outer-veil', campaignOrder: 1, prototypeId: 1, title: 'The Outer Veil' },
  { levelKey: 'inner-kingdom', campaignOrder: 2, prototypeId: 2, title: 'The Inner Kingdom' },
  { levelKey: 'sundered-aqueduct', campaignOrder: 3, prototypeId: 3, title: 'The Sundered Aqueduct' },
  { levelKey: 'buried-foundry', campaignOrder: 4, prototypeId: 4, title: 'The Buried Foundry' },
  { levelKey: 'gardens-of-glass', campaignOrder: 5, prototypeId: 5, title: 'The Gardens of Glass' },
  { levelKey: 'hollow-barracks', campaignOrder: 6, prototypeId: 6, title: 'The Hollow Barracks' },
  { levelKey: 'observatory-of-mirrors', campaignOrder: 7, prototypeId: 7, title: 'Observatory of Mirrors' },
  { levelKey: 'shifting-sepulchre', campaignOrder: 8, prototypeId: 8, title: 'The Shifting Sepulchre' },
  { levelKey: 'crown-under-siege', campaignOrder: 9, prototypeId: 9, title: 'The Crown Under Siege' },
  { levelKey: 'throne-of-eclipse', campaignOrder: 10, prototypeId: 10, title: 'Throne of the Eclipse' },
];

export const PROTOTYPE_CAMPAIGN_CATALOG = Object.freeze(
  entries.map((entry) => Object.freeze({ ...entry })),
);

export class CampaignCatalogError extends Error {
  constructor(message) {
    super(message);
    this.name = 'CampaignCatalogError';
  }
}

export function validateCampaignCatalog(catalog) {
  if (!Array.isArray(catalog) || catalog.length === 0) {
    throw new CampaignCatalogError('Campaign catalog must be a non-empty array.');
  }

  const keys = new Set();
  const orders = new Set();
  const prototypeIds = new Set();

  for (const entry of catalog) {
    if (!entry || typeof entry !== 'object') {
      throw new CampaignCatalogError('Every campaign catalog entry must be an object.');
    }
    if (typeof entry.levelKey !== 'string' || entry.levelKey.trim() === '') {
      throw new CampaignCatalogError('Every campaign entry needs a stable levelKey.');
    }
    if (keys.has(entry.levelKey)) {
      throw new CampaignCatalogError(`Duplicate levelKey: ${entry.levelKey}`);
    }
    if (!Number.isInteger(entry.campaignOrder) || entry.campaignOrder < 1) {
      throw new CampaignCatalogError(`Invalid campaignOrder for ${entry.levelKey}.`);
    }
    if (orders.has(entry.campaignOrder)) {
      throw new CampaignCatalogError(`Duplicate campaignOrder: ${entry.campaignOrder}`);
    }
    if (!Number.isInteger(entry.prototypeId) || entry.prototypeId < 1) {
      throw new CampaignCatalogError(`Invalid prototypeId for ${entry.levelKey}.`);
    }
    if (prototypeIds.has(entry.prototypeId)) {
      throw new CampaignCatalogError(`Duplicate prototypeId: ${entry.prototypeId}`);
    }
    if (typeof entry.title !== 'string' || entry.title.trim() === '') {
      throw new CampaignCatalogError(`Missing title for ${entry.levelKey}.`);
    }

    keys.add(entry.levelKey);
    orders.add(entry.campaignOrder);
    prototypeIds.add(entry.prototypeId);
  }

  const expectedOrders = Array.from({ length: catalog.length }, (_, index) => index + 1);
  if (expectedOrders.some((order) => !orders.has(order))) {
    throw new CampaignCatalogError('Campaign order must be contiguous and start at 1.');
  }

  return true;
}

export function getCampaignEntry(levelKey) {
  return PROTOTYPE_CAMPAIGN_CATALOG.find((entry) => entry.levelKey === levelKey) || null;
}

/**
 * Transitional loader for the ten existing prototypes. The prototype factory
 * is injected so catalog inspection remains map-free; future authored files can
 * replace this adapter one level at a time without changing stable level keys.
 */
export async function loadPrototypeLevel(levelKey, createLevelsOverride) {
  const entry = getCampaignEntry(levelKey);
  if (!entry) throw new CampaignCatalogError(`Unknown levelKey: ${levelKey}`);

  const level = typeof createLevelsOverride === 'function'
    ? createLevelsOverride().find((candidate) => candidate.id === entry.prototypeId)
    : await dynamicPrototypeLoaders[levelKey]?.();

  if (!level) {
    throw new CampaignCatalogError(
      `Prototype ${entry.prototypeId} is missing for ${entry.levelKey}.`,
    );
  }
  if (level.name !== entry.title) {
    throw new CampaignCatalogError(
      `Catalog title mismatch for ${entry.levelKey}: expected "${entry.title}", received "${level.name}".`,
    );
  }

  return assertValidAuthoredLevel(level, entry);
}

validateCampaignCatalog(PROTOTYPE_CAMPAIGN_CATALOG);
