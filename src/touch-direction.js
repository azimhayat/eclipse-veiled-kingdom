const FULL_TURN = Math.PI * 2;
const CARDINAL_HALF_ANGLE = Math.PI / 6;
const DIAGONAL_HALF_ANGLE = Math.PI / 12;

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

const DIRECTION_CENTERS = Object.freeze([
  0,
  Math.PI / 4,
  Math.PI / 2,
  Math.PI * 3 / 4,
  Math.PI,
  -Math.PI * 3 / 4,
  -Math.PI / 2,
  -Math.PI / 4,
]);

const DIRECTION_HALF_ANGLES = Object.freeze([
  CARDINAL_HALF_ANGLE,
  DIAGONAL_HALF_ANGLE,
  CARDINAL_HALF_ANGLE,
  DIAGONAL_HALF_ANGLE,
  CARDINAL_HALF_ANGLE,
  DIAGONAL_HALF_ANGLE,
  CARDINAL_HALF_ANGLE,
  DIAGONAL_HALF_ANGLE,
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
  const previousIndex = TOUCH_DIRECTIONS.indexOf(previousDirection);
  if (previousIndex >= 0) {
    const previousCenter = DIRECTION_CENTERS[previousIndex];
    const holdRange = DIRECTION_HALF_ANGLES[previousIndex] + TOUCH_DIRECTION_HYSTERESIS;
    if (angularDistance(angle, previousCenter) <= holdRange) return previousDirection;
  }

  const candidateIndex = DIRECTION_CENTERS.findIndex((center, index) => (
    angularDistance(angle, center) <= DIRECTION_HALF_ANGLES[index]
  ));
  return TOUCH_DIRECTIONS[candidateIndex < 0 ? 0 : candidateIndex];
}

export function clampTouchVector(dx, dy, maximumDistance) {
  const limit = Math.max(0, Number.isFinite(maximumDistance) ? maximumDistance : 0);
  const distance = Math.hypot(dx, dy);
  if (!distance || distance <= limit) return { x: dx, y: dy };
  const scale = limit / distance;
  return { x: dx * scale, y: dy * scale };
}
