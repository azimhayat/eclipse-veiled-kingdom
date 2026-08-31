const PROTOTYPE_GAMEPLAY = Object.freeze({
  'outer-veil': Object.freeze({
    openingHint: 'Move with A / D · Jump with SPACE · Climb with W or ↑',
    enemyRoster: Object.freeze(['grunt']),
    tutorialCues: Object.freeze([
      Object.freeze({ minX: 9, maxX: 14, text: 'Hold jump for height · release for a short hop' }),
      Object.freeze({ minX: 14, maxX: 23, text: 'Hold W + toward the sand wall to climb · K / Shift digs' }),
      Object.freeze({ minX: 52, maxX: 69, text: 'Crumble ledges fall after 0.45s · do not stop' }),
    ]),
    demoRelicOrder: Object.freeze(['sand-crown', 'high-stair', 'arena-floor']),
  }),
  'inner-kingdom': Object.freeze({
    enemyRoster: Object.freeze(['grunt']),
    tutorialCues: Object.freeze([
      Object.freeze({ minX: 52, maxX: 69, text: 'Crumble ledges fall after 0.45s · do not stop' }),
    ]),
  }),
  'sundered-aqueduct': Object.freeze({ enemyRoster: Object.freeze(['grunt']), introduceMechanic: true }),
  'buried-foundry': Object.freeze({ enemyRoster: Object.freeze(['grunt']), introduceMechanic: true }),
  'gardens-of-glass': Object.freeze({ enemyRoster: Object.freeze(['grunt']), introduceMechanic: true }),
  'hollow-barracks': Object.freeze({ enemyRoster: Object.freeze(['shield', 'spear', 'archer']), introduceMechanic: true }),
  'observatory-of-mirrors': Object.freeze({ enemyRoster: Object.freeze(['shield', 'spear', 'archer']), introduceMechanic: true }),
  'shifting-sepulchre': Object.freeze({ enemyRoster: Object.freeze(['shield', 'spear', 'archer']), introduceMechanic: true }),
  'crown-under-siege': Object.freeze({ enemyRoster: Object.freeze(['shield', 'spear', 'archer']), introduceMechanic: true }),
  'throne-of-eclipse': Object.freeze({ enemyRoster: Object.freeze(['shield', 'spear', 'archer']), introduceMechanic: true }),
});

export function getPrototypeGameplay(levelKey) {
  return PROTOTYPE_GAMEPLAY[levelKey] || null;
}

export function attachPrototypeGameplay(level) {
  const gameplay = getPrototypeGameplay(level?.levelKey);
  if (!gameplay) throw new Error(`Missing prototype gameplay metadata for ${level?.levelKey || 'unknown level'}`);
  return { ...level, gameplay };
}
