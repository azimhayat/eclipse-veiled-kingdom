export const FIXED_DT = 1 / 60;

export const PHYSICS = Object.freeze({
  RUN_SPEED: 290,
  GROUND_ACCEL: 2700,
  AIR_ACCEL: 1750,
  GROUND_FRICTION: 3000,
  AIR_DRAG: 720,
  JUMP_VEL: -850,
  JUMP_CUT_SPEED: -360,
  GRAVITY_UP: 1850,
  GRAVITY_DOWN: 3000,
  WATER_ACCEL: 1500,
  WATER_DRAG: 280,
  WATER_GRAVITY_UP: 1850,
  WATER_GRAVITY_DOWN: 3050,
  APEX_SPEED: 110,
  APEX_GRAVITY_SCALE: .82,
  TERMINAL: 1250,
  COYOTE: .11,
  JUMP_BUFFER: .13,
  CLIMB_SPEED: 170,
  WALL_SLIDE: 85,
  WALL_JUMP_X: 350,
  WALL_JUMP_Y_SCALE: .9,
  WALL_COYOTE: .08,
  WALL_REGRAB_DELAY: .12,
  WALL_JUMP_CONTROL_LOCK: .1,
  LANDING_PRESENTATION_SECONDS: .11,
  LANDING_STRONG_SPEED: 720,
  MAX_HP: 4,
});

export const CAMERA = Object.freeze({
  HORIZONTAL_DEAD_ZONE: 34,
  VERTICAL_DEAD_ZONE: 24,
  MOVEMENT_LEAD_THRESHOLD: 36,
  LOOK_AHEAD_REMAINDER_PER_SECOND: .008,
  FOLLOW_REMAINDER_PER_SECOND: .001,
  CLIMB_BIAS: -54,
  FALL_BIAS_MAX: 64,
});

export const approach = (value, target, amount) => (
  value < target ? Math.min(value + amount, target) : Math.max(value - amount, target)
);

export function gravityForVelocity(vy, physics = PHYSICS) {
  const gravity = vy < 0 ? physics.GRAVITY_UP : physics.GRAVITY_DOWN;
  return Math.abs(vy) < physics.APEX_SPEED ? gravity * physics.APEX_GRAVITY_SCALE : gravity;
}

export function settlingSeconds(remainderPerSecond, tolerance = .1) {
  if (!(remainderPerSecond > 0 && remainderPerSecond < 1) || !(tolerance > 0 && tolerance < 1)) {
    return 0;
  }
  return Math.log(tolerance) / Math.log(remainderPerSecond);
}

function horizontalMeasure({ initialVelocity, targetVelocity, acceleration, fixedDt = FIXED_DT }) {
  let velocity = initialVelocity;
  let distance = 0;
  let steps = 0;
  while (velocity !== targetVelocity && steps < 600) {
    velocity = approach(velocity, targetVelocity, acceleration * fixedDt);
    distance += velocity * fixedDt;
    steps += 1;
  }
  return { seconds: steps * fixedDt, distance };
}

function jumpMeasure({
  physics = PHYSICS,
  releaseAt = Infinity,
  initialVx = 0,
  horizontalInput = 0,
  wallJump = false,
  fixedDt = FIXED_DT,
} = {}) {
  let x = 0;
  let y = 0;
  let vx = initialVx;
  let vy = wallJump ? physics.JUMP_VEL * physics.WALL_JUMP_Y_SCALE : physics.JUMP_VEL;
  let seconds = 0;
  let apexSeconds = null;
  let minY = 0;
  let released = false;
  let wallControlLock = wallJump ? physics.WALL_JUMP_CONTROL_LOCK : 0;
  for (let steps = 0; steps < 600; steps += 1) {
    if (!released && seconds >= releaseAt) {
      released = true;
      if (vy < physics.JUMP_CUT_SPEED) vy = physics.JUMP_CUT_SPEED;
    }
    if (wallControlLock > 0) wallControlLock = Math.max(0, wallControlLock - fixedDt);
    else if (horizontalInput) vx = approach(vx, horizontalInput * physics.RUN_SPEED, physics.AIR_ACCEL * fixedDt);
    else vx = approach(vx, 0, physics.AIR_DRAG * fixedDt);
    vy = Math.min(physics.TERMINAL, vy + gravityForVelocity(vy, physics) * fixedDt);
    x += vx * fixedDt;
    y += vy * fixedDt;
    seconds += fixedDt;
    minY = Math.min(minY, y);
    if (apexSeconds === null && vy >= 0) apexSeconds = seconds;
    if (seconds > fixedDt && y >= 0 && vy > 0) break;
  }
  return {
    height: -minY,
    apexSeconds: apexSeconds ?? seconds,
    airtimeSeconds: seconds,
    distance: x,
  };
}

const rounded = (value) => Math.round(value * 1000) / 1000;
const roundRecord = (record) => Object.fromEntries(
  Object.entries(record).map(([key, value]) => [key, Number.isFinite(value) ? rounded(value) : value]),
);

export function measureMovementFeel(physics = PHYSICS, fixedDt = FIXED_DT) {
  const acceleration = horizontalMeasure({
    initialVelocity: 0,
    targetVelocity: physics.RUN_SPEED,
    acceleration: physics.GROUND_ACCEL,
    fixedDt,
  });
  const stop = horizontalMeasure({
    initialVelocity: physics.RUN_SPEED,
    targetVelocity: 0,
    acceleration: physics.GROUND_FRICTION,
    fixedDt,
  });
  const reversal = horizontalMeasure({
    initialVelocity: physics.RUN_SPEED,
    targetVelocity: -physics.RUN_SPEED,
    acceleration: physics.GROUND_ACCEL,
    fixedDt,
  });
  const fullJump = jumpMeasure({ physics, horizontalInput: 1, initialVx: physics.RUN_SPEED, fixedDt });
  const shortJump = jumpMeasure({ physics, releaseAt: .067, fixedDt });
  const airRelease = jumpMeasure({ physics, initialVx: physics.RUN_SPEED, fixedDt });
  const airReverse = jumpMeasure({ physics, initialVx: physics.RUN_SPEED, horizontalInput: -1, fixedDt });
  const wallJump = jumpMeasure({ physics, initialVx: -physics.WALL_JUMP_X, wallJump: true, fixedDt });
  return {
    fixedStepMs: rounded(fixedDt * 1000),
    inputToPhysicsResponseMaxMs: rounded(fixedDt * 1000),
    acceleration: roundRecord(acceleration),
    stop: roundRecord({ ...stop, distance: Math.abs(stop.distance) }),
    reversal: roundRecord(reversal),
    fullJump: roundRecord(fullJump),
    shortJump: roundRecord(shortJump),
    airRelease: roundRecord(airRelease),
    airReverse: roundRecord(airReverse),
    wallJump: roundRecord({ ...wallJump, distance: Math.abs(wallJump.distance) }),
    camera: {
      follow90PercentSeconds: rounded(settlingSeconds(CAMERA.FOLLOW_REMAINDER_PER_SECOND)),
      lookAhead90PercentSeconds: rounded(settlingSeconds(CAMERA.LOOK_AHEAD_REMAINDER_PER_SECOND)),
    },
  };
}
