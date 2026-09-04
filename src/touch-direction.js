const FULL_TURN = Math.PI * 2;
const SECTOR_ANGLE = Math.PI / 4;

export const TOUCH_DIRECTION_DEAD_ZONE = 0.24;
export const TOUCH_DIRECTION_RELEASE_ZONE = 0.16;
export const TOUCH_DIRECTION_HYSTERESIS = Math.PI / 32;

export const TOUCH_DIRECTIONS = Object.freeze([
  'right',
  'down-right',
  'down',
  'down-left',
  'left',
  'up-left',
  'up',
  'up-right',
]);

const DIRECTION_ACTIONS = Object.freeze({
  right: Object.freeze(['right']),
  'down-right': Object.freeze(['right', 'down']),
  down: Object.freeze(['down']),
  'down-left': Object.freeze(['left', 'down']),
  left: Object.freeze(['left']),
  'up-left': Object.freeze(['left', 'climb']),
  up: Object.freeze(['climb']),
  'up-right': Object.freeze(['right', 'climb']),
});

function wrapAngle(angle) {
  return ((angle + Math.PI) % FULL_TURN + FULL_TURN) % FULL_TURN - Math.PI;
}

function angularDistance(first, second) {
  return Math.abs(wrapAngle(first - second));
}

export function getTouchDirectionActions(direction) {
  return DIRECTION_ACTIONS[direction] || [];
}

export function resolveTouchDirection(dx, dy, radius, previousDirection = null) {
  const safeRadius = Math.max(1, Number.isFinite(radius) ? radius : 1);
  const distanceRatio = Math.hypot(dx, dy) / safeRadius;
  const releaseThreshold = previousDirection
    ? TOUCH_DIRECTION_RELEASE_ZONE
    : TOUCH_DIRECTION_DEAD_ZONE;
  if (distanceRatio <= releaseThreshold) return null;

  const angle = Math.atan2(dy, dx);
  const candidateIndex = (Math.round(angle / SECTOR_ANGLE) + TOUCH_DIRECTIONS.length)
    % TOUCH_DIRECTIONS.length;

  const previousIndex = TOUCH_DIRECTIONS.indexOf(previousDirection);
  if (previousIndex >= 0) {
    const previousCenter = previousIndex * SECTOR_ANGLE;
    const holdRange = SECTOR_ANGLE / 2 + TOUCH_DIRECTION_HYSTERESIS;
    if (angularDistance(angle, previousCenter) <= holdRange) return previousDirection;
  }

  return TOUCH_DIRECTIONS[candidateIndex];
}

export function clampTouchVector(dx, dy, maximumDistance) {
  const limit = Math.max(0, Number.isFinite(maximumDistance) ? maximumDistance : 0);
  const distance = Math.hypot(dx, dy);
  if (!distance || distance <= limit) return { x: dx, y: dy };
  const scale = limit / distance;
  return { x: dx * scale, y: dy * scale };
}
