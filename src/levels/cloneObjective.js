function deepClone(value) {
  if (Array.isArray(value)) return value.map(deepClone);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, deepClone(item)]));
}

/**
 * Objectives are authored as pristine templates. Runtime copies deliberately
 * reset every mutable field here so new objective types do not leak shallow
 * nested state through the repository, validation, replay, or life reset.
 */
export function cloneObjective(objective) {
  if (!objective || typeof objective !== 'object') return objective;
  const clone = deepClone(objective);

  for (const mark of clone.marks || []) mark.revealed = false;
  for (const station of clone.stations || []) {
    station.observed = false;
    station.observedAt = null;
  }
  if (clone.memoryMark) clone.memoryMark.revealed = false;
  for (const hazard of clone.hazards || []) {
    hazard.bound = false;
    hazard.restored = false;
  }
  if (clone.oathShelter) clone.oathShelter.boundOnce = false;

  clone.complete = false;
  clone.restored = false;
  clone.completedAt = null;
  clone.lessonComplete = false;
  clone.controlledComplete = false;
  clone.masteryComplete = false;

  if (clone.type === 'oathbind-restoration') clone.phase = 'learn';
  if (clone.type === 'timed-teeth-restoration') {
    clone.phase = 'observe';
    clone.hazardClock = 0;
    clone.clockStarted = false;
  }
  if (clone.type === 'bell-tower-restoration') {
    clone.phase = 'learn';
    clone.gripSeconds = 0;
    clone.wallJumps = [];
    clone.lessonComplete = false;
    clone.alternatingComplete = false;
    clone.masteryReached = false;
    if (clone.lesson) clone.lesson.jumpRecorded = false;
    if (clone.alternating) clone.alternating.retryHintShown = false;
    if (clone.memoryBrace) clone.memoryBrace.revealed = false;
    for (const section of clone.collapse?.sections || []) {
      section.state = 'stable';
      section.timer = 0;
      section.triggeredAt = null;
    }
    if (clone.bell) {
      clone.bell.awakened = false;
      clone.bell.restored = false;
      clone.bell.ringStartedAt = null;
      if (clone.bell.puzzle) {
        clone.bell.puzzle.progress = [];
        clone.bell.puzzle.mistakes = 0;
        for (const chime of clone.bell.puzzle.chimes || []) chime.struck = false;
      }
    }
    for (const window of clone.lightWindows || []) window.lit = false;
  }
  if (clone.type === 'sanctum-lamp-restoration') {
    clone.phase = 'find';
    clone.returnCount = 0;
    clone.lastReturnId = null;
    clone.returnProven = false;
    clone.returnProvenAt = null;
    if (clone.lamp) {
      clone.lamp.bound = false;
      clone.lamp.boundAt = null;
    }
    if (clone.arch) {
      clone.arch.gripJumpRecorded = false;
      clone.arch.open = false;
    }
    if (clone.witness) {
      clone.witness.reached = false;
      clone.witness.reachedAt = null;
    }
    if (clone.canopy) clone.canopy.restored = false;
    for (const column of clone.lightColumns || []) column.lit = false;
  }
  if (clone.type === 'parachute-choir-restoration') {
    clone.phase = 'lesson';
    clone.encounterClock = 0;
    clone.spawnedCount = 0;
    clone.defeatedCount = 0;
    for (const stage of clone.stages || []) {
      stage.active = false;
      stage.complete = false;
      stage.startedAt = null;
      stage.completedAt = null;
    }
    for (const member of clone.roster || []) {
      member.status = 'queued';
      member.spawnedAt = null;
      member.defeatedAt = null;
      member.gripStrikeLanded = false;
    }
    if (clone.skycut) {
      clone.skycut.gripJumpRecorded = false;
      clone.skycut.landed = false;
      clone.skycut.completed = false;
      if (clone.skycut.seesaw) {
        clone.skycut.seesaw.angle = 0;
        clone.skycut.seesaw.balanceSeconds = 0;
        clone.skycut.seesaw.balanced = false;
      }
      if (clone.skycut.tether) clone.skycut.tether.cut = false;
    }
    for (const sail of clone.windSails || []) sail.unfurled = false;
    if (clone.windLoom) {
      clone.windLoom.clock = 0;
      clone.windLoom.state = 'warning';
      clone.windLoom.launched = false;
      clone.windLoom.crossed = false;
      clone.windLoom.attempts = 0;
    }
    clone.skyRestored = false;
  }
  if (clone.type === 'veil-gate-restoration') {
    clone.phase = 'carve';
    if (clone.memoryMark) clone.memoryMark.revealed = false;
    if (clone.counterweight) {
      clone.counterweight.bound = false;
      clone.counterweight.locked = false;
    }
    if (clone.upperLatch) {
      clone.upperLatch.gripJumpRecorded = false;
      clone.upperLatch.reached = false;
      clone.upperLatch.retryHintShown = false;
    }
    if (clone.encounter) {
      clone.encounter.clock = 0;
      clone.encounter.spawnedCount = 0;
      clone.encounter.defeatedCount = 0;
      for (const stage of clone.encounter.stages || []) {
        stage.active = false;
        stage.complete = false;
        stage.startedAt = null;
        stage.completedAt = null;
      }
      for (const member of clone.encounter.roster || []) {
        member.status = 'queued';
        member.spawnedAt = null;
        member.defeatedAt = null;
      }
    }
    if (clone.sunstone) {
      clone.sunstone.exposed = false;
      clone.sunstone.struck = false;
    }
    if (clone.cartographersTurn) {
      clone.cartographersTurn.restored = false;
      clone.cartographersTurn.turnedAt = null;
    }
    for (const banner of clone.relayBanners || []) banner.restored = false;
    clone.gateRestored = false;
  }
  if (clone.type === 'warden-restoration') {
    clone.phase = 'listen';
    if (clone.breath) {
      clone.breath.clock = 0;
      clone.breath.firstBreathComplete = false;
      clone.breath.strikeCount = 0;
    }
    if (clone.memorySeam) clone.memorySeam.revealed = false;
    if (clone.heartstone) {
      clone.heartstone.bound = false;
      clone.heartstone.locked = false;
    }
    if (clone.rememberedHand) {
      clone.rememberedHand.gripJumpRecorded = false;
      clone.rememberedHand.reached = false;
      clone.rememberedHand.retryHintShown = false;
      clone.rememberedHand.raised = false;
      clone.rememberedHand.restored = false;
    }
    if (clone.bridle) {
      clone.bridle.exposed = false;
      clone.bridle.struck = false;
      clone.bridle.clock = 0;
    }
    if (clone.warden) {
      clone.warden.state = 'sleeping';
      clone.warden.kneeling = false;
      clone.warden.commandBroken = false;
    }
    if (clone.crownPath) clone.crownPath.restored = false;
  }

  return clone;
}
