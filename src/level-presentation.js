const MASTERY_PRESENTATION = Object.freeze({
  'memory-carve': Object.freeze({
    order: 1,
    keyboard: 'K or Shift cuts remembered paths through living sand.',
    touch: 'DIG cuts remembered paths through living sand.',
  }),
  oathbind: Object.freeze({
    order: 2,
    keyboard: 'K or Shift beside a rune block binds it; use the same action to release it.',
    touch: 'DIG beside a rune block binds it; use DIG again to release it.',
  }),
  'pilgrims-grip': Object.freeze({
    order: 3,
    keyboard: 'Hold toward a wall to grip, W to climb, then hold Jump to spring away.',
    touch: 'Hold toward a wall to grip, UP to climb, then hold JUMP to spring away.',
  }),
  'sanctum-recall': Object.freeze({
    order: 4,
    keyboard: 'Press K or Shift beside a sanctuary lamp to bind a safe return.',
    touch: 'Press DIG beside a sanctuary lamp to bind a safe return.',
  }),
  dawnstroke: Object.freeze({
    order: 5,
    keyboard: 'Press J or X after the amber tell; answer during blue recovery.',
    touch: 'Press STRIKE after the amber tell; answer during blue recovery.',
  }),
});

export const PRESENTATION_DURATIONS = Object.freeze({
  chapter: 2600,
  memory: 5200,
  mastery: 3000,
  objective: 2400,
});

export function detectPresentationInput(windowObject = globalThis.window) {
  try {
    return windowObject?.matchMedia?.('(hover: none), (pointer: coarse), (max-width: 900px)')?.matches
      ? 'touch'
      : 'keyboard';
  } catch {
    return 'keyboard';
  }
}

export function buildLevelTransitionPresentation(entry, {
  completedLevel,
  nextLevel,
  totalLevels = 10,
  nextLevelKey = entry?.levelKey || null,
} = {}) {
  if (!entry || !Number.isInteger(completedLevel) || !Number.isInteger(nextLevel)) return null;
  return {
    completedLevel,
    nextLevel,
    totalLevels,
    nextLevelKey,
    title: entry.name || entry.title || 'The next path',
    subtitle: entry.subtitle || '',
    storyLine: entry.storyLine || '',
    objective: entry.objectiveTitle || entry.mechanic || 'Restore the path ahead.',
  };
}

export function buildLevelPresentation(entry, {
  productionCampaign = false,
  inputMode = 'keyboard',
  campaignTotal = productionCampaign ? 10 : null,
  realmLabel = productionCampaign ? 'Realm I' : null,
  unitLabel = 'Chapter',
} = {}) {
  if (!entry || !Number.isInteger(entry.level) || typeof entry.name !== 'string') return [];

  const cards = [{
    kind: 'chapter',
    durationMs: PRESENTATION_DURATIONS.chapter,
    level: entry.level,
    name: entry.name,
    kicker: `${realmLabel ? `${realmLabel} · ` : ''}${unitLabel} ${String(entry.level).padStart(2, '0')}${Number.isInteger(campaignTotal) ? ` of ${campaignTotal}` : ''}`,
    title: entry.name,
    subtitle: entry.subtitle && entry.subtitle !== entry.name ? entry.subtitle : '',
    detail: entry.storyLine || '',
  }];

  if (!productionCampaign) return cards;

  if (entry.storyMoment?.delivery === 'presentation'
    && entry.storyMoment?.id && entry.storyMoment?.title) {
    cards.push({
      kind: 'memory',
      durationMs: PRESENTATION_DURATIONS.memory,
      level: entry.level,
      name: entry.name,
      storyMomentId: entry.storyMoment.id,
      kicker: entry.storyMoment.kicker || 'Memory echo',
      title: entry.storyMoment.title,
      detail: entry.storyMoment.detail || '',
      portraitPath: entry.storyMoment.portraitPath || null,
      portraitAlt: entry.storyMoment.portraitAlt || '',
    });
  }

  const unlock = entry.abilityUnlock;
  const mastery = unlock?.key ? MASTERY_PRESENTATION[unlock.key] : null;
  if (mastery) {
    cards.push({
      kind: 'mastery',
      durationMs: PRESENTATION_DURATIONS.mastery,
      level: entry.level,
      name: entry.name,
      kicker: `Mastery remembered · ${mastery.order} of 5`,
      title: unlock.name,
      detail: unlock.description,
      inputLabel: inputMode === 'touch' ? 'Touch' : 'Keys',
      input: mastery[inputMode === 'touch' ? 'touch' : 'keyboard'],
    });
  }

  cards.push({
    kind: 'objective',
    durationMs: PRESENTATION_DURATIONS.objective,
    level: entry.level,
    name: entry.name,
    kicker: 'Current objective',
    title: entry.objectiveTitle || entry.mechanic || 'Restore the path',
    detail: entry.mechanic && entry.mechanic !== entry.objectiveTitle ? entry.mechanic : '',
  });

  return cards;
}
