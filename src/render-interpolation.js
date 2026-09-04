export const MAX_FRAME_SECONDS = .1;
const INTERPOLATION_EPSILON = 1e-9;

export function consumeFixedSteps(accumulator, frameSeconds, onStep, fixedDt) {
  let remaining = accumulator + Math.min(MAX_FRAME_SECONDS, Math.max(0, frameSeconds));
  while (remaining + INTERPOLATION_EPSILON >= fixedDt) {
    onStep(fixedDt);
    remaining -= fixedDt;
  }
  return Math.max(0, remaining);
}

export function interpolationAlpha(accumulator, fixedDt) {
  if (!Number.isFinite(accumulator) || !Number.isFinite(fixedDt) || fixedDt <= 0) return 1;
  return Math.max(0, Math.min(1, accumulator / fixedDt));
}

export function measureRenderCadence(renderHz, fixedDt, seconds = 2) {
  let accumulator = 0;
  let steps = 0;
  let lastPresentedStepSeconds = 0;
  let maximumGapSeconds = 0;
  const frameSeconds = 1 / renderHz;
  const frameCount = Math.round(renderHz * seconds);
  for (let frame = 0; frame < frameCount; frame += 1) {
    let stepped = false;
    accumulator = consumeFixedSteps(accumulator, frameSeconds, () => {
      steps += 1;
      stepped = true;
    }, fixedDt);
    if (!stepped) continue;
    const presentedAtSeconds = (frame + 1) * frameSeconds;
    maximumGapSeconds = Math.max(maximumGapSeconds, presentedAtSeconds - lastPresentedStepSeconds);
    lastPresentedStepSeconds = presentedAtSeconds;
  }
  return {
    renderHz,
    physicsSteps: steps,
    maximumInputToPhysicsPresentationMs: Math.round(maximumGapSeconds * 1e6) / 1000,
  };
}

export function captureMotion(entity, fields = ['x', 'y']) {
  if (!entity) return;
  entity.renderPrevious ||= {};
  for (const field of fields) {
    if (Number.isFinite(entity[field])) entity.renderPrevious[field] = entity[field];
  }
}

export function resetMotion(entity, fields = ['x', 'y']) {
  if (!entity) return;
  entity.renderPrevious ||= {};
  for (const field of fields) {
    if (!Number.isFinite(entity[field])) continue;
    entity.renderPrevious[field] = entity[field];
    entity[`render${field[0].toUpperCase()}${field.slice(1)}`] = entity[field];
  }
}

export function interpolateMotion(entity, alpha, fields = ['x', 'y']) {
  if (!entity) return;
  for (const field of fields) {
    if (!Number.isFinite(entity[field])) continue;
    const previous = entity.renderPrevious?.[field];
    entity[`render${field[0].toUpperCase()}${field.slice(1)}`] = Number.isFinite(previous)
      ? previous + (entity[field] - previous) * alpha
      : entity[field];
  }
}

export function snapMotionAxis(entity, field) {
  if (!entity || !Number.isFinite(entity[field])) return;
  entity.renderPrevious ||= {};
  entity.renderPrevious[field] = entity[field];
}
