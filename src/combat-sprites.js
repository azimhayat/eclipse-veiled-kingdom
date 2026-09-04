export const VEIL_RAIDER_SHEET = Object.freeze({
  columns: 4,
  rows: 2,
  frames: Object.freeze({
    descent: Object.freeze({ col: 0, row: 0, anchorX: .5, anchorY: .96, height: 128 }),
    landing: Object.freeze({ col: 1, row: 0, anchorX: .5, anchorY: .96, height: 114 }),
    idle: Object.freeze({ col: 2, row: 0, anchorX: .5, anchorY: .96, height: 114 }),
    anticipation: Object.freeze({ col: 3, row: 0, anchorX: .5, anchorY: .96, height: 116 }),
    contact: Object.freeze({ col: 0, row: 1, anchorX: .5, anchorY: .96, height: 118 }),
    recovery: Object.freeze({ col: 1, row: 1, anchorX: .5, anchorY: .96, height: 114 }),
    hit: Object.freeze({ col: 2, row: 1, anchorX: .5, anchorY: .96, height: 116 }),
    defeat: Object.freeze({ col: 3, row: 1, anchorX: .5, anchorY: .96, height: 118 }),
  }),
});

export const WARDEN_SHEET = Object.freeze({
  columns: 4,
  rows: 2,
  frames: Object.freeze({
    idle: Object.freeze({ col: 0, row: 0, anchorX: .5, anchorY: .96, height: 205 }),
    guard: Object.freeze({ col: 1, row: 0, anchorX: .5, anchorY: .96, height: 205 }),
    windup: Object.freeze({ col: 2, row: 0, anchorX: .5, anchorY: .96, height: 208 }),
    contact: Object.freeze({ col: 3, row: 0, anchorX: .5, anchorY: .96, height: 212 }),
    recovery: Object.freeze({ col: 0, row: 1, anchorX: .5, anchorY: .96, height: 205 }),
    hit: Object.freeze({ col: 1, row: 1, anchorX: .5, anchorY: .96, height: 205 }),
    eclipse: Object.freeze({ col: 2, row: 1, anchorX: .5, anchorY: .96, height: 215 }),
    restoration: Object.freeze({ col: 3, row: 1, anchorX: .5, anchorY: .96, height: 215 }),
  }),
});

export function getVeilRaiderFrame(soldier = {}) {
  if (soldier.mode === 'para') return VEIL_RAIDER_SHEET.frames.descent;
  const state = soldier.presentation?.state;
  if (state === 'landing') return VEIL_RAIDER_SHEET.frames.landing;
  if (state === 'anticipation') return VEIL_RAIDER_SHEET.frames.anticipation;
  if (state === 'contact') return VEIL_RAIDER_SHEET.frames.contact;
  if (state === 'guard') return VEIL_RAIDER_SHEET.frames.anticipation;
  if (state === 'recovery' || soldier.attackPhase === 'stun') return VEIL_RAIDER_SHEET.frames.recovery;
  if (state === 'hit') return VEIL_RAIDER_SHEET.frames.hit;
  if (state === 'defeat' || soldier.hp <= 0) return VEIL_RAIDER_SHEET.frames.defeat;
  return VEIL_RAIDER_SHEET.frames.idle;
}

export function getWardenFrame(duel = {}) {
  const boss = duel.boss || {};
  if (duel.complete) return WARDEN_SHEET.frames.restoration;
  if (duel.phase === 'finale') return WARDEN_SHEET.frames.hit;
  if (boss.action === 'hitstun' || boss.hitFlash > 0) return WARDEN_SHEET.frames.hit;
  if (boss.action === 'guard' || boss.guarding) return WARDEN_SHEET.frames.guard;
  if (boss.action === 'windup') return WARDEN_SHEET.frames.windup;
  if (boss.action === 'active') return WARDEN_SHEET.frames.contact;
  if (boss.action === 'recovery' || boss.action === 'backstep') return WARDEN_SHEET.frames.recovery;
  if (boss.action === 'intro' && boss.phase === 'eclipse') return WARDEN_SHEET.frames.eclipse;
  return WARDEN_SHEET.frames.idle;
}

export function drawSpriteFrame(ctx, image, sheet, frame) {
  if (!ctx || !image || !sheet || !frame || !image.width || !image.height) return false;
  const cellW = image.width / sheet.columns;
  const cellH = image.height / sheet.rows;
  const height = frame.height;
  const width = height * (cellW / cellH);
  ctx.drawImage(
    image,
    frame.col * cellW,
    frame.row * cellH,
    cellW,
    cellH,
    -width * frame.anchorX,
    -height * frame.anchorY,
    width,
    height,
  );
  return true;
}
