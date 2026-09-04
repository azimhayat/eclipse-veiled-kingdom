import { CHUNK_COLS, CHUNK_COUNT, CHUNK_W, TILE, Tile, VIEW_H, VIEW_W, WORLD_COLS, WORLD_H, WORLD_W } from './levels/constants.js';
import { releaseRenderedLevel } from './rendered-level-cache.js';
import { getTimedTeethState } from './teeth-timing.js';
import { getHeroPoseFrame } from './combat-presentation.js';
import {
  drawSpriteFrame,
  getVeilRaiderFrame,
  getWardenFrame,
  VEIL_RAIDER_SHEET,
  WARDEN_SHEET,
} from './combat-sprites.js';
import { getWardenFighterAttack } from './warden-fighter.js';

const roundRect = (ctx, x, y, w, h, r) => {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
};

function seeded(n) {
  const x = Math.sin(n * 91.731) * 43758.5453;
  return x - Math.floor(x);
}

function drawWardenSpriteFighter(ctx, duel, time, wardenSheet) {
  const boss = duel.boss;
  const target = boss.target;
  const feetY = duel.arena.feetTy * TILE;
  const frame = getWardenFrame(duel);
  const hit = boss.hitFlash > 0 || boss.action === 'hitstun';
  const guarding = boss.action === 'guard' || boss.guarding;
  const windup = boss.action === 'windup';
  const active = boss.action === 'active';
  const phaseColor = boss.phase === 'eclipse' ? '#e96663'
    : boss.phase === 'command' ? '#e9b74f'
      : '#72dce8';

  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,.58)';
  ctx.beginPath();
  ctx.ellipse(target.x, feetY - 3, 80, 15, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.translate(target.x, feetY);
  ctx.scale(boss.facing || -1, 1);
  ctx.globalAlpha = duel.phase === 'finale' ? .9 : 1;
  ctx.shadowColor = hit ? '#c9fbff' : phaseColor;
  ctx.shadowBlur = hit ? 35 : boss.phase === 'eclipse' ? 25 : 15;
  drawSpriteFrame(ctx, wardenSheet, WARDEN_SHEET, frame);
  ctx.shadowBlur = 0;

  if (guarding) {
    const guardRatio = Math.max(0, Math.min(1, (boss.guardMeter || 0) / (boss.guardMax || 6)));
    ctx.strokeStyle = guardRatio > .34 ? '#f3c969' : '#ef7764';
    ctx.lineWidth = 6;
    ctx.setLineDash([18, 7]);
    ctx.beginPath();
    ctx.arc(13, -92, 67, -1.22, 1.18);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  if (windup) {
    ctx.globalAlpha = .72 + Math.sin(time * 24) * .2;
    ctx.strokeStyle = boss.attackKind === 'crown-breaker' ? '#ef6e5e' : '#f1c461';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(12, -88, 76, -1.4, 1.35);
    ctx.stroke();
  }
  ctx.restore();

  if (['dust-sweep', 'sand-wave'].includes(boss.attackKind) && (windup || active)) {
    const attackRange = boss.attackKind === 'sand-wave' ? 5.1 * TILE : 2.75 * TILE;
    const startX = boss.attackKind === 'sand-wave' ? target.x - attackRange : target.x - attackRange * .55;
    const width = boss.attackKind === 'sand-wave' ? attackRange * 2 : attackRange * 1.1;
    ctx.save();
    ctx.strokeStyle = active ? '#ef715b' : '#dfb653';
    ctx.fillStyle = active ? 'rgba(231,92,68,.2)' : 'rgba(224,174,70,.08)';
    ctx.shadowColor = active ? '#ee684f' : '#e4af4f';
    ctx.shadowBlur = active ? 22 : 12;
    ctx.lineWidth = active ? 9 : 4;
    ctx.beginPath();
    ctx.moveTo(startX, feetY - 8);
    for (let x = startX; x <= startX + width; x += 28) {
      ctx.lineTo(x, feetY - 11 - Math.sin(x * .035 + time * 9) * (active ? 14 : 7));
    }
    ctx.lineTo(startX + width, feetY + 8);
    ctx.lineTo(startX, feetY + 8);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  ctx.save();
  for (let phaseIndex = 0; phaseIndex < 3; phaseIndex += 1) {
    const threshold = phaseIndex === 0 ? duel.thresholds.commandHp : phaseIndex === 1 ? duel.thresholds.eclipseHp : 0;
    ctx.fillStyle = boss.hp <= threshold ? '#79e5ef' : 'rgba(229,186,86,.45)';
    ctx.beginPath();
    ctx.arc(target.x - 34 + phaseIndex * 34, target.y - 103, 6, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawWardenFighter(ctx, duel, time, wardenSheet = null) {
  if (wardenSheet) {
    drawWardenSpriteFighter(ctx, duel, time, wardenSheet);
    return;
  }
  const boss = duel.boss;
  const target = boss.target;
  const facing = boss.facing || -1;
  const phaseColor = boss.phase === 'eclipse' ? '#da6d75' : boss.phase === 'command' ? '#efbd5d' : '#7fe3ed';
  const active = boss.action === 'active';
  const windup = boss.action === 'windup';
  const hit = boss.action === 'hitstun' || boss.hitFlash > 0;
  const guarding = boss.action === 'guard' || boss.guarding;
  const finale = duel.phase === 'finale';
  const feetY = duel.arena.feetTy * TILE;
  const attack = getWardenFighterAttack(boss.attackKind);
  const actionDuration = windup ? attack.windup
    : active ? attack.active
      : boss.action === 'recovery' ? attack.recovery
        : 1;
  const actionProgress = Math.max(0, Math.min(1, 1 - (boss.actionClock || 0) / Math.max(.001, actionDuration)));
  const lean = active ? 5 + Math.sin(actionProgress * Math.PI) * 11
    : windup ? -7 * actionProgress
      : boss.action === 'recovery' ? 7 * (1 - actionProgress)
        : hit ? -10 : 0;
  const bob = ['neutral', 'idle'].includes(boss.action) ? Math.sin(time * 5.2) * 2.5 : 0;

  ctx.save();
  ctx.translate(target.x, feetY + bob);
  ctx.scale(facing, 1);

  ctx.save();
  ctx.scale(1 / facing, 1);
  const shadow = ctx.createRadialGradient(0, -2, 4, 0, -2, 72);
  shadow.addColorStop(0, 'rgba(0,0,0,.58)');
  shadow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = shadow;
  ctx.beginPath();
  ctx.ellipse(0, -3, 78, 15, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  if (boss.attackKind === 'eclipse-rush' && (windup || active)) {
    ctx.save();
    ctx.globalAlpha = active ? .34 : .16;
    ctx.fillStyle = '#d85c69';
    for (let trail = 1; trail <= 3; trail += 1) {
      ctx.beginPath();
      ctx.ellipse(-trail * 34, -66, 31, 58, -.18, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  ctx.translate(lean, 0);
  ctx.globalAlpha = finale ? .76 : 1;
  ctx.shadowColor = finale ? '#c7f8fb' : phaseColor;
  ctx.shadowBlur = hit ? 38 : boss.phase === 'eclipse' ? 25 : 17;

  // Split cloak and grounded legs give the Warden a readable fighting stance.
  ctx.fillStyle = hit ? '#dffcff' : '#151722';
  ctx.strokeStyle = phaseColor;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(-31, -88);
  ctx.quadraticCurveTo(-53, -48, -48, -4);
  ctx.lineTo(-12, -4);
  ctx.lineTo(-4, -57);
  ctx.lineTo(10, -4);
  ctx.lineTo(48, -4);
  ctx.quadraticCurveTo(49, -47, 28, -88);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = boss.phase === 'eclipse' ? '#34202a' : boss.phase === 'command' ? '#32291f' : '#1a2830';
  ctx.beginPath();
  ctx.moveTo(-29, -91);
  ctx.lineTo(-20, -128);
  ctx.quadraticCurveTo(0, -143, 23, -126);
  ctx.lineTo(31, -88);
  ctx.quadraticCurveTo(0, -73, -29, -91);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Hood, single remembered eye, and broken command circlet.
  ctx.fillStyle = '#090b11';
  ctx.beginPath();
  ctx.moveTo(-23, -132);
  ctx.quadraticCurveTo(0, -160, 26, -132);
  ctx.lineTo(17, -105);
  ctx.lineTo(-17, -105);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = finale ? '#efffff' : phaseColor;
  ctx.shadowBlur = 24;
  ctx.beginPath();
  ctx.arc(8, -125, 5.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-27, -151);
  ctx.lineTo(-8, -158);
  ctx.lineTo(4, -149);
  ctx.lineTo(25, -157);
  ctx.stroke();

  // Guard arm or forward striking arm.
  ctx.lineCap = 'round';
  ctx.lineWidth = 12;
  ctx.strokeStyle = hit ? '#dffcff' : '#202633';
  ctx.beginPath();
  if (guarding) {
    ctx.moveTo(-4, -105);
    ctx.lineTo(27, -82);
    ctx.lineTo(13, -54);
  } else if (active) {
    ctx.moveTo(5, -105);
    ctx.lineTo(45, -84);
    ctx.lineTo(70, -71);
  } else {
    ctx.moveTo(5, -105);
    ctx.lineTo(34, -86);
    ctx.lineTo(28, -58);
  }
  ctx.stroke();

  const attackAngle = boss.attackKind === 'dust-sweep' || boss.attackKind === 'sand-wave'
    ? active ? -.32 + actionProgress * .58 : -.42 + actionProgress * .16
    : boss.attackKind === 'crown-breaker'
      ? active ? -.95 + actionProgress * 1.98 : -.95 + actionProgress * .2
      : active ? -1.02 + actionProgress * 1.08 : -1.02 + actionProgress * .18;
  ctx.save();
  ctx.translate(active ? 68 : 29, active ? -71 : -59);
  ctx.rotate(attackAngle);
  ctx.strokeStyle = phaseColor;
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(72, 0);
  ctx.stroke();
  ctx.strokeStyle = '#fff1b7';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(8, -2);
  ctx.lineTo(70, -2);
  ctx.stroke();
  ctx.restore();

  if (guarding) {
    const guardRatio = Math.max(0, Math.min(1, (boss.guardMeter || 0) / (boss.guardMax || 6)));
    ctx.save();
    ctx.strokeStyle = guardRatio > .34 ? '#f3c969' : '#ef7764';
    ctx.lineWidth = 7;
    ctx.setLineDash([18, 7]);
    ctx.beginPath();
    ctx.arc(16, -78, 58, -1.22, 1.18);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  if (windup) {
    ctx.save();
    ctx.globalAlpha = .72 + Math.sin(time * 24) * .2;
    ctx.strokeStyle = boss.attackKind === 'crown-breaker' ? '#ef6e5e' : '#f1c461';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(12, -76, 70, -1.4, 1.35);
    ctx.stroke();
    ctx.restore();
  }
  ctx.restore();

  if (['dust-sweep', 'sand-wave'].includes(boss.attackKind) && (windup || active)) {
    const attackRange = boss.attackKind === 'sand-wave' ? 5.1 * TILE : 2.75 * TILE;
    const startX = boss.attackKind === 'sand-wave' ? target.x - attackRange : target.x - attackRange * .55;
    const width = boss.attackKind === 'sand-wave' ? attackRange * 2 : attackRange * 1.1;
    ctx.save();
    ctx.strokeStyle = active ? '#ef715b' : '#dfb653';
    ctx.fillStyle = active ? 'rgba(231,92,68,.2)' : 'rgba(224,174,70,.08)';
    ctx.shadowColor = active ? '#ee684f' : '#e4af4f';
    ctx.shadowBlur = active ? 22 : 12;
    ctx.lineWidth = active ? 9 : 4;
    ctx.beginPath();
    ctx.moveTo(startX, feetY - 8);
    for (let x = startX; x <= startX + width; x += 28) {
      ctx.lineTo(x, feetY - 11 - Math.sin(x * .035 + time * 9) * (active ? 14 : 7));
    }
    ctx.lineTo(startX + width, feetY + 8);
    ctx.lineTo(startX, feetY + 8);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  ctx.save();
  for (let phaseIndex = 0; phaseIndex < 3; phaseIndex += 1) {
    const threshold = phaseIndex === 0 ? duel.thresholds.commandHp : phaseIndex === 1 ? duel.thresholds.eclipseHp : 0;
    ctx.fillStyle = boss.hp <= threshold ? '#79e5ef' : 'rgba(229,186,86,.45)';
    ctx.beginPath();
    ctx.arc(target.x - 34 + phaseIndex * 34, target.y - 103, 6, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawProcessionStatue(ctx, item, { observed, restored, time }) {
  const x = item.tx * TILE;
  const y = item.baseTy * TILE;
  const restorationProgress = restored ? Math.min(1, Math.max(0, (time - (item.restoredAt || 0)) / 1.1)) : 0;
  const rotation = item.requiresMemoryMark
    ? item.rotation * (1 - restorationProgress)
    : item.rotation;
  const lit = observed || restored;

  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = lit ? 'rgba(241,201,107,.72)' : 'rgba(34,41,57,.92)';
  ctx.strokeStyle = lit ? '#f1c96b' : '#677087';
  ctx.lineWidth = 4;
  ctx.shadowColor = lit ? '#f1c96b' : 'transparent';
  ctx.shadowBlur = lit ? 18 : 0;
  roundRect(ctx, -34, -9, 68, 9, 3);
  ctx.fill();
  ctx.rotate(rotation);
  ctx.fillStyle = lit ? '#8b6a35' : '#343b4d';
  roundRect(ctx, -18, -73, 36, 55, 8);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, -91, 15, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-8, -19); ctx.lineTo(-12, 0);
  ctx.moveTo(8, -19); ctx.lineTo(12, 0);
  if (item.pose === 'kneel') {
    ctx.moveTo(-13, -60); ctx.lineTo(-34, -48);
    ctx.moveTo(13, -60); ctx.lineTo(29, -76);
    ctx.moveTo(-8, -19); ctx.lineTo(-27, -5); ctx.lineTo(-10, 0);
  } else if (item.pose === 'warning') {
    ctx.moveTo(-13, -60); ctx.lineTo(-35, -76); ctx.lineTo(-21, -94);
    ctx.moveTo(13, -60); ctx.lineTo(31, -47);
  } else if (item.pose === 'blade') {
    ctx.moveTo(-13, -59); ctx.lineTo(-30, -43);
    ctx.moveTo(13, -59); ctx.lineTo(51, -62);
    ctx.moveTo(32, -63); ctx.lineTo(67, -80);
  } else if (item.pose === 'crown') {
    ctx.moveTo(-15, -59); ctx.lineTo(14, -42);
    ctx.moveTo(15, -59); ctx.lineTo(-14, -42);
    ctx.moveTo(-18, -105); ctx.lineTo(0, -116); ctx.lineTo(18, -105);
  } else if (item.pose === 'erase') {
    ctx.moveTo(-15, -59); ctx.lineTo(-31, -41);
    ctx.moveTo(15, -59); ctx.lineTo(34, -72);
    ctx.moveTo(28, -77); ctx.lineTo(42, -88);
  } else {
    ctx.moveTo(-14, -58); ctx.lineTo(-27, -39);
    ctx.moveTo(14, -58); ctx.lineTo(27, -39);
    ctx.strokeRect(-24, -45, 48, 24);
  }
  ctx.stroke();
  ctx.restore();

  ctx.save();
  ctx.textAlign = 'center';
  ctx.font = "600 9px 'Outfit'";
  ctx.letterSpacing = '1px';
  ctx.fillStyle = lit ? 'rgba(255,226,145,.88)' : 'rgba(177,188,207,.48)';
  ctx.fillText(item.label.toUpperCase(), x, y + 18);
  ctx.restore();
}

export function drawTile(ctx, tile, x, y, seed = 0) {
  if (tile === Tile.AIR) return;
  ctx.save();

  if (tile === Tile.STONE || tile === Tile.GLOW) {
    const glow = tile === Tile.GLOW;
    const grad = ctx.createLinearGradient(x, y, x, y + TILE);
    grad.addColorStop(0, glow ? '#9b7330' : '#28324a');
    grad.addColorStop(.18, glow ? '#6c4b1f' : '#1b243a');
    grad.addColorStop(1, glow ? '#2b1e17' : '#0d1426');
    ctx.fillStyle = grad;
    ctx.fillRect(x, y, TILE, TILE);
    ctx.fillStyle = glow ? '#f1cf72' : '#61708b';
    ctx.globalAlpha = glow ? .88 : .55;
    roundRect(ctx, x + 1, y + 1, TILE - 2, 6, 3);
    ctx.fill();
    ctx.globalAlpha = .38;
    ctx.fillStyle = '#030611';
    ctx.fillRect(x, y + TILE - 8, TILE, 8);
    ctx.globalAlpha = glow ? .72 : .18;
    ctx.strokeStyle = glow ? '#f6d77d' : '#8995aa';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x + 8 + seeded(seed) * 7, y + 13);
    ctx.lineTo(x + 22, y + 24);
    ctx.lineTo(x + 16 + seeded(seed + 2) * 12, y + 40);
    ctx.stroke();
    if (glow) {
      ctx.shadowColor = '#f0bd4f';
      ctx.shadowBlur = 18;
      ctx.strokeStyle = '#ffd977';
      ctx.beginPath();
      ctx.moveTo(x + 7, y + 24);
      ctx.lineTo(x + 15, y + 17);
      ctx.lineTo(x + 24, y + 25);
      ctx.lineTo(x + 33, y + 16);
      ctx.lineTo(x + 41, y + 24);
      ctx.stroke();
    }
  }

  if (tile === Tile.SAND) {
    const grad = ctx.createLinearGradient(x, y, x + TILE, y + TILE);
    grad.addColorStop(0, '#b7783e');
    grad.addColorStop(.48, '#8d542d');
    grad.addColorStop(1, '#4e2f25');
    ctx.fillStyle = grad;
    ctx.fillRect(x, y, TILE, TILE);
    ctx.fillStyle = 'rgba(255,203,118,.38)';
    ctx.beginPath();
    ctx.moveTo(x, y + 7);
    ctx.quadraticCurveTo(x + 14, y + 1 + seeded(seed) * 6, x + 28, y + 7);
    ctx.quadraticCurveTo(x + 40, y + 12, x + TILE, y + 5);
    ctx.lineTo(x + TILE, y + 11);
    ctx.quadraticCurveTo(x + 26, y + 16, x, y + 12);
    ctx.fill();
    ctx.fillStyle = 'rgba(38,20,22,.25)';
    for (let i = 0; i < 4; i += 1) {
      const px = x + 7 + seeded(seed + i * 3) * 35;
      const py = y + 18 + seeded(seed + i * 5) * 25;
      ctx.beginPath();
      ctx.arc(px, py, 1 + seeded(seed + i) * 1.4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  if (tile === Tile.SPIKE) {
    ctx.fillStyle = 'rgba(8,12,25,.78)';
    ctx.fillRect(x, y + TILE - 8, TILE, 8);
    for (let i = 0; i < 3; i += 1) {
      const sx = x + i * 16;
      const grad = ctx.createLinearGradient(sx, y + 4, sx, y + TILE);
      grad.addColorStop(0, '#f0c570');
      grad.addColorStop(.25, '#75788a');
      grad.addColorStop(1, '#171b2c');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(sx + 8, y + 3 + (i % 2) * 4);
      ctx.lineTo(sx + 15, y + TILE - 6);
      ctx.lineTo(sx + 1, y + TILE - 6);
      ctx.closePath();
      ctx.fill();
    }
  }

  if (tile === Tile.ONEWAY || tile === Tile.CRUMBLE) {
    const crumble = tile === Tile.CRUMBLE;
    ctx.fillStyle = crumble ? '#8b5c39' : '#34405b';
    roundRect(ctx, x, y + 4, TILE, crumble ? 17 : 13, 5);
    ctx.fill();
    ctx.fillStyle = crumble ? '#e3a85c' : '#dfbd69';
    roundRect(ctx, x, y + 3, TILE, 4, 3);
    ctx.fill();
    ctx.fillStyle = crumble ? 'rgba(38,19,20,.56)' : 'rgba(3,6,14,.55)';
    ctx.fillRect(x + 4, y + (crumble ? 16 : 12), TILE - 8, 5);
    if (crumble) {
      ctx.strokeStyle = 'rgba(42,18,20,.7)';
      ctx.beginPath();
      ctx.moveTo(x + 10, y + 6);
      ctx.lineTo(x + 18, y + 14);
      ctx.lineTo(x + 27, y + 7);
      ctx.lineTo(x + 38, y + 17);
      ctx.stroke();
    }
  }

  if (tile === Tile.CRYSTAL) {
    const grad = ctx.createLinearGradient(x, y, x + TILE, y + 20);
    grad.addColorStop(0, '#dff8ff');
    grad.addColorStop(.34, '#76b8d4');
    grad.addColorStop(1, '#433c78');
    ctx.fillStyle = grad;
    ctx.shadowColor = '#93dcff';
    ctx.shadowBlur = 14;
    ctx.beginPath();
    ctx.moveTo(x + 1, y + 5);
    ctx.lineTo(x + 10, y + 1);
    ctx.lineTo(x + 22, y + 5);
    ctx.lineTo(x + 34, y + 1);
    ctx.lineTo(x + 47, y + 6);
    ctx.lineTo(x + 43, y + 19);
    ctx.lineTo(x + 5, y + 19);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(255,255,255,.72)';
    ctx.beginPath();
    ctx.moveTo(x + 9, y + 4);
    ctx.lineTo(x + 17, y + 15);
    ctx.lineTo(x + 27, y + 6);
    ctx.lineTo(x + 37, y + 16);
    ctx.stroke();
  }

  if (tile === Tile.GATE) {
    const grad = ctx.createLinearGradient(x, y, x + TILE, y);
    grad.addColorStop(0, '#14192a');
    grad.addColorStop(.5, '#4f493d');
    grad.addColorStop(1, '#121728');
    ctx.fillStyle = grad;
    ctx.fillRect(x + 5, y, 38, TILE);
    ctx.strokeStyle = '#cda64f';
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 9, y, 30, TILE);
    ctx.fillStyle = '#f3d277';
    ctx.fillRect(x + 22, y, 4, TILE);
    ctx.shadowColor = '#e8c56a';
    ctx.shadowBlur = 12;
    ctx.fillRect(x + 21, y + 18, 6, 6);
  }

  ctx.restore();
}

function bakeLevelChunk(level, chunkIndex) {
  const canvas = document.createElement('canvas');
  try {
    canvas.width = CHUNK_W;
    canvas.height = WORLD_H;
    const ctx = canvas.getContext('2d', { alpha: true });
    ctx.imageSmoothingEnabled = false;
    const firstCol = chunkIndex * CHUNK_COLS;
    for (let y = 0; y < level.map.length; y += 1) {
      for (let localX = 0; localX < CHUNK_COLS; localX += 1) {
        const worldX = firstCol + localX;
        if (worldX >= WORLD_COLS) continue;
        drawTile(ctx, level.map[y][worldX], localX * TILE, y * TILE, worldX * 37 + y * 73 + level.id * 101);
      }
    }
    return canvas;
  } catch (error) {
    releaseRenderedLevel(canvas);
    throw error;
  }
}

export function bakeLevel(level) {
  const chunks = [];
  for (let chunkIndex = 0; chunkIndex < CHUNK_COUNT; chunkIndex += 1) {
    chunks.push(bakeLevelChunk(level, chunkIndex));
  }
  return chunks;
}

function yieldToNextFrame(signal) {
  if (signal?.aborted) return Promise.resolve();
  return new Promise((resolve) => {
    const useAnimationFrame = typeof requestAnimationFrame === 'function';
    let handle;
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      signal?.removeEventListener('abort', abort);
      resolve();
    };
    const abort = () => {
      if (useAnimationFrame) cancelAnimationFrame(handle);
      else clearTimeout(handle);
      finish();
    };

    signal?.addEventListener('abort', abort, { once: true });
    handle = useAnimationFrame
      ? requestAnimationFrame(finish)
      : setTimeout(finish, 0);
  });
}

/**
 * Paints one canvas chunk per browser frame. Cancellation returns `null` and
 * explicitly releases every canvas already produced by this bake.
 */
export async function bakeLevelIncrementally(level, {
  signal,
  shouldCancel = () => false,
  yieldControl = ({ signal: activeSignal }) => yieldToNextFrame(activeSignal),
} = {}) {
  const chunks = [];
  const cancelled = () => Boolean(signal?.aborted || shouldCancel());

  try {
    for (let chunkIndex = 0; chunkIndex < CHUNK_COUNT; chunkIndex += 1) {
      if (cancelled()) {
        releaseRenderedLevel(chunks);
        return null;
      }
      await yieldControl({ signal, chunkIndex, chunkCount: CHUNK_COUNT });
      if (cancelled()) {
        releaseRenderedLevel(chunks);
        return null;
      }
      chunks.push(bakeLevelChunk(level, chunkIndex));
    }

    if (cancelled()) {
      releaseRenderedLevel(chunks);
      return null;
    }
    return chunks;
  } catch (error) {
    releaseRenderedLevel(chunks);
    throw error;
  }
}

export async function bakeAllLevels(levels, onProgress, { isCancelled } = {}) {
  const bank = new Map();
  let painted = 0;
  const total = levels.length * CHUNK_COUNT;
  const releasePartial = (chunks = []) => {
    for (const rendered of [...bank.values(), chunks]) {
      for (const canvas of rendered) {
        canvas.width = 0;
        canvas.height = 0;
      }
    }
    bank.clear();
  };
  for (const level of levels) {
    const chunks = [];
    for (let chunkIndex = 0; chunkIndex < CHUNK_COUNT; chunkIndex += 1) {
      if (isCancelled?.()) {
        releasePartial(chunks);
        return null;
      }
      chunks.push(bakeLevelChunk(level, chunkIndex));
      painted += 1;
      onProgress?.(painted / total);
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }
    bank.set(level.levelKey || level.id, chunks);
  }
  return bank;
}

export function restampCell(level, chunks, tx, ty) {
  if (tx < 0 || tx >= WORLD_COLS || ty < 0 || ty >= level.map.length) return;
  const chunkIndex = Math.floor(tx / CHUNK_COLS);
  const localX = (tx % CHUNK_COLS) * TILE;
  const ctx = chunks[chunkIndex].getContext('2d');
  ctx.clearRect(localX - 1, ty * TILE - 1, TILE + 2, TILE + 2);
  drawTile(ctx, level.map[ty][tx], localX, ty * TILE, tx * 37 + ty * 73 + level.id * 101);
}

export function drawBackdrop(ctx, image, camera, time, level) {
  const levelId = typeof level === 'number' ? level : level.id;
  const theme = typeof level === 'object' ? level.theme : null;
  const grad = ctx.createLinearGradient(0, 0, 0, VIEW_H);
  grad.addColorStop(0, theme?.top || (levelId === 1 ? '#17213c' : '#101834'));
  grad.addColorStop(.6, '#10162b');
  grad.addColorStop(1, theme?.bottom || '#1b1520');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);

  if (image) {
    const scale = Math.max(VIEW_H / image.height, 1.02);
    const dw = image.width * scale;
    const dh = image.height * scale;
    const maxShift = Math.max(0, dw - VIEW_W);
    const shift = (camera.x / Math.max(1, WORLD_W - VIEW_W)) * maxShift;
    ctx.globalAlpha = levelId === 1 ? .72 : .56;
    ctx.drawImage(image, -shift, (VIEW_H - dh) * .47, dw, dh);
    ctx.globalAlpha = 1;
  }

  const haze = ctx.createLinearGradient(0, 0, 0, VIEW_H);
  haze.addColorStop(0, 'rgba(3,7,18,.12)');
  haze.addColorStop(.72, 'rgba(8,11,25,.12)');
  haze.addColorStop(1, 'rgba(29,20,27,.56)');
  ctx.fillStyle = haze;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);

  if (theme?.haze) {
    const colorWash = ctx.createRadialGradient(VIEW_W * .7, VIEW_H * .2, 10, VIEW_W * .7, VIEW_H * .35, VIEW_W * .65);
    colorWash.addColorStop(0, `${theme.haze}35`);
    colorWash.addColorStop(1, `${theme.haze}00`);
    ctx.fillStyle = colorWash;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  }

  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  for (let i = 0; i < 24; i += 1) {
    const x = ((i * 157 + time * (4 + i % 4)) % (VIEW_W + 80)) - 40;
    const y = 60 + ((i * 83 + camera.x * .025) % 420);
    ctx.globalAlpha = .1 + (i % 3) * .04;
    ctx.fillStyle = i % 4 === 0 ? '#e8c56a' : '#9ab9e8';
    ctx.beginPath();
    ctx.arc(x, y, 1 + (i % 2), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

export function drawLevelMechanics(ctx, level, time, gateOpen, assets = {}) {
  if (level.objective?.type === 'memory-carve') {
    const marks = level.objective.marks || [];
    const complete = Boolean(level.objective.complete);
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.strokeStyle = complete ? 'rgba(255,216,106,.88)' : 'rgba(103,226,255,.34)';
    ctx.lineWidth = complete ? 5 : 2;
    ctx.shadowColor = complete ? '#ffd86a' : '#67e2ff';
    ctx.shadowBlur = complete ? 22 : 10;
    ctx.beginPath();
    marks.forEach((mark, index) => {
      const x = mark.tx * TILE + TILE / 2;
      const y = mark.ty * TILE + TILE / 2;
      if (index === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    for (const mark of marks) {
      const x = mark.tx * TILE + TILE / 2;
      const y = mark.ty * TILE + TILE / 2;
      const pulse = .78 + Math.sin(time * 3.4 + mark.tx) * .2;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(Math.PI / 4);
      ctx.globalAlpha = mark.revealed ? 1 : pulse;
      ctx.strokeStyle = mark.revealed ? '#ffd86a' : '#8deaff';
      ctx.lineWidth = 4;
      ctx.shadowColor = ctx.strokeStyle;
      ctx.shadowBlur = mark.revealed ? 22 : 14;
      ctx.strokeRect(-8, -8, 16, 16);
      ctx.restore();
    }
    ctx.restore();
  }

  if (level.objective?.type === 'procession-restoration') {
    const objective = level.objective;
    const stations = objective.stations || [];
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.strokeStyle = 'rgba(241,201,107,.42)';
    ctx.lineWidth = 3;
    ctx.shadowColor = '#f1c96b';
    ctx.shadowBlur = 12;
    ctx.beginPath();
    const observed = stations.filter((item) => item.observed);
    observed.forEach((item, index) => {
      const x = item.tx * TILE;
      const y = item.baseTy * TILE - 4;
      if (index === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
    ctx.restore();

    for (const item of stations) {
      drawProcessionStatue(ctx, item, {
        observed: item.observed,
        restored: false,
        time,
      });
    }

    if (objective.finalMonument) {
      drawProcessionStatue(ctx, {
        ...objective.finalMonument,
        requiresMemoryMark: true,
        restoredAt: objective.completedAt,
      }, {
        observed: objective.complete,
        restored: objective.restored,
        time,
      });
    }

    const mark = objective.memoryMark;
    if (mark) {
      const x = mark.tx * TILE + TILE / 2;
      const y = mark.ty * TILE + TILE / 2;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(Math.PI / 4);
      ctx.strokeStyle = mark.revealed ? '#f1c96b' : '#87e6ff';
      ctx.lineWidth = 4;
      ctx.shadowColor = ctx.strokeStyle;
      ctx.shadowBlur = mark.revealed ? 22 : 14 + Math.sin(time * 4) * 4;
      ctx.strokeRect(-9, -9, 18, 18);
      ctx.restore();
    }
  }

  if (level.objective?.type === 'oathbind-restoration') {
    const objective = level.objective;
    const lesson = objective.lessonZone;
    const seal = objective.finalSeal;
    const mark = objective.memoryMark;
    const monument = objective.finalMonument;
    const pulse = .72 + Math.sin(time * 3.2) * .2;

    if (lesson) {
      ctx.save();
      ctx.globalAlpha = objective.lessonComplete ? .92 : pulse;
      ctx.fillStyle = objective.lessonComplete ? 'rgba(241,201,107,.38)' : 'rgba(110,226,255,.22)';
      ctx.strokeStyle = objective.lessonComplete ? '#f1c96b' : '#82e8ff';
      ctx.shadowColor = ctx.strokeStyle;
      ctx.shadowBlur = objective.lessonComplete ? 20 : 12;
      roundRect(ctx, lesson.x, lesson.y, lesson.w, lesson.h, 5);
      ctx.fill();
      ctx.stroke();
      ctx.translate(lesson.x + lesson.w / 2, lesson.y - 22);
      ctx.rotate(Math.PI / 4);
      ctx.strokeRect(-8, -8, 16, 16);
      ctx.restore();
    }

    if (mark) {
      ctx.save();
      ctx.translate(mark.tx * TILE + TILE / 2, mark.ty * TILE + TILE / 2);
      ctx.rotate(Math.PI / 4);
      ctx.globalAlpha = mark.revealed ? 1 : pulse;
      ctx.strokeStyle = mark.revealed ? '#f1c96b' : '#82e8ff';
      ctx.lineWidth = 4;
      ctx.shadowColor = ctx.strokeStyle;
      ctx.shadowBlur = mark.revealed ? 22 : 14;
      ctx.strokeRect(-9, -9, 18, 18);
      ctx.restore();
    }

    if (seal) {
      ctx.save();
      ctx.globalAlpha = objective.complete ? .9 : .32;
      ctx.strokeStyle = objective.complete ? '#ffe18a' : '#bca061';
      ctx.lineWidth = objective.complete ? 4 : 2;
      ctx.beginPath();
      ctx.moveTo(lesson.x + lesson.w / 2, lesson.y - 5);
      ctx.lineTo(seal.x + seal.w / 2, seal.y - 5);
      ctx.stroke();
      ctx.restore();
    }

    if (monument) {
      const restored = objective.restored;
      const elapsed = restored ? Math.max(0, time - (objective.completedAt ?? time)) : 0;
      const progress = restored ? Math.min(1, elapsed / 1.1) : 0;
      const balance = 1 - (1 - progress) ** 3;
      const rotation = monument.rotation * (1 - balance);
      const x = monument.tx * TILE;
      const y = monument.baseTy * TILE;
      ctx.save();
      ctx.translate(x, y);
      ctx.strokeStyle = restored ? '#f7d574' : '#6f7482';
      ctx.fillStyle = restored ? 'rgba(247,213,116,.2)' : 'rgba(34,39,54,.72)';
      ctx.shadowColor = restored ? '#f7d574' : 'transparent';
      ctx.shadowBlur = restored ? 22 : 0;
      ctx.lineWidth = 5;

      // Keep the civic pillar grounded while the beam and its pans visibly
      // swing from the Crown's crooked law into a level public promise.
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(0, -118);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-22, 0);
      ctx.lineTo(22, 0);
      ctx.stroke();

      ctx.save();
      ctx.translate(0, -94);
      ctx.rotate(rotation);
      ctx.beginPath();
      ctx.moveTo(-58, 0);
      ctx.lineTo(58, 0);
      ctx.stroke();
      for (const side of [-1, 1]) {
        ctx.save();
        ctx.translate(side * 47, 0);
        ctx.rotate(-rotation);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(0, 40);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(0, 49, 23, 0, Math.PI, false);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }
      ctx.restore();

      ctx.fillStyle = restored ? '#ffe39a' : '#9a9daa';
      ctx.font = "600 10px 'Outfit'";
      ctx.textAlign = 'center';
      ctx.fillText(monument.label.toUpperCase(), 0, 18);
      ctx.restore();
    }
  }

  if (level.objective?.type === 'timed-teeth-restoration') {
    const objective = level.objective;
    for (const hazard of objective.hazards || []) {
      const state = getTimedTeethState(objective.timing, hazard, objective.hazardClock);
      const startX = hazard.startTx * TILE;
      const width = (hazard.endTx - hazard.startTx + 1) * TILE;
      const baseY = hazard.baseTy * TILE;
      const extension = state.state === 'warning'
        ? Math.max(.08, state.extension)
        : state.extension;
      const toothHeight = 44 * extension;
      const settled = state.state === 'bound' || state.state === 'restored';

      ctx.save();
      if (state.state === 'warning') {
        const pulse = .38 + Math.sin(objective.hazardClock * Math.PI * 5) * .22;
        ctx.fillStyle = `rgba(244,184,80,${pulse})`;
        ctx.shadowColor = '#f3b04c';
        ctx.shadowBlur = 18;
        for (let x = startX + 12; x < startX + width; x += 24) {
          ctx.beginPath();
          ctx.arc(x, baseY - 18 - (x % 3) * 4, 3 + state.progress * 3, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.fillStyle = settled
        ? 'rgba(241,205,111,.82)'
        : state.active
          ? '#d86f4e'
          : '#565365';
      ctx.strokeStyle = settled ? '#ffe39a' : state.active ? '#ffb169' : '#9b7d67';
      ctx.shadowColor = settled ? '#efc96c' : state.active ? '#d85d42' : 'transparent';
      ctx.shadowBlur = settled || state.active ? 16 : 0;
      for (let x = startX; x < startX + width; x += 24) {
        if (settled) {
          ctx.fillRect(x + 3, baseY - 7, 18, 7);
          continue;
        }
        ctx.beginPath();
        ctx.moveTo(x + 3, baseY);
        ctx.lineTo(x + 12, baseY - toothHeight);
        ctx.lineTo(x + 21, baseY);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
      ctx.restore();
    }

    const shelter = objective.oathShelter;
    if (shelter && level.block) {
      ctx.save();
      ctx.strokeStyle = shelter.boundOnce ? '#ffe39a' : '#82e8ff';
      ctx.shadowColor = ctx.strokeStyle;
      ctx.shadowBlur = shelter.boundOnce ? 22 : 12;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(level.block.x + level.block.w / 2, level.block.y - 18, 11, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    const monument = objective.finalMonument;
    if (monument) {
      const x = monument.tx * TILE;
      const y = monument.baseTy * TILE;
      const open = objective.restored ? 1 : 0;
      ctx.save();
      ctx.translate(x, y);
      ctx.strokeStyle = open ? '#f6d576' : '#6b6170';
      ctx.fillStyle = open ? 'rgba(246,213,118,.2)' : 'rgba(25,25,38,.7)';
      ctx.shadowColor = open ? '#f6d576' : 'transparent';
      ctx.shadowBlur = open ? 24 : 0;
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(-54, -20 - open * 34);
      ctx.quadraticCurveTo(0, -92 - open * 20, 54, -20 - open * 34);
      ctx.moveTo(-54, -8 + open * 14);
      ctx.quadraticCurveTo(0, 22 + open * 24, 54, -8 + open * 14);
      ctx.stroke();
      ctx.font = "600 10px 'Outfit'";
      ctx.textAlign = 'center';
      ctx.fillStyle = open ? '#ffe39a' : '#96909c';
      ctx.fillText(monument.label.toUpperCase(), 0, 18);
      ctx.restore();
    }
  }

  if (level.objective?.type === 'bell-tower-restoration') {
    const objective = level.objective;
    for (const window of objective.lightWindows || []) {
      const x = window.tx * TILE;
      const y = window.ty * TILE;
      ctx.save();
      ctx.strokeStyle = window.lit ? '#8feaff' : '#55586b';
      ctx.fillStyle = window.lit ? 'rgba(143,234,255,.2)' : 'rgba(17,20,33,.58)';
      ctx.shadowColor = window.lit ? '#8feaff' : 'transparent';
      ctx.shadowBlur = window.lit ? 24 : 0;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(x - 18, y + 22);
      ctx.quadraticCurveTo(x, y - 18, x + 18, y + 22);
      ctx.lineTo(x + 18, y + 58);
      ctx.lineTo(x - 18, y + 58);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    for (const section of objective.collapse?.sections || []) {
      const warningProgress = section.state === 'warning'
        ? Math.min(1, section.timer / objective.collapse.warningSeconds)
        : 0;
      const goneProgress = section.state === 'gone'
        ? Math.min(1, section.timer / objective.collapse.goneSeconds)
        : 0;
      const shake = section.state === 'warning'
        ? Math.sin(section.timer * 46) * warningProgress * 4
        : 0;
      const fall = section.state === 'gone' ? goneProgress * goneProgress * 150 : 0;
      ctx.save();
      ctx.translate(shake, fall);
      ctx.globalAlpha = section.state === 'gone' ? 1 - goneProgress : 1;
      ctx.fillStyle = section.state === 'restored'
        ? 'rgba(245,213,113,.9)'
        : section.state === 'warning'
          ? 'rgba(210,142,68,.9)'
          : section.state === 'spent'
            ? 'rgba(87,100,119,.9)'
            : 'rgba(64,77,101,.94)';
      ctx.strokeStyle = section.state === 'restored' ? '#ffe69a' : section.state === 'warning' ? '#ffc069' : '#8edbe8';
      ctx.shadowColor = ctx.strokeStyle;
      ctx.shadowBlur = section.state === 'warning' || section.state === 'restored' ? 17 : 7;
      roundRect(ctx, section.x, section.y + 2, section.w, section.h, 5);
      ctx.fill();
      ctx.stroke();
      if (section.state === 'warning') {
        ctx.strokeStyle = '#ffe08a';
        ctx.lineWidth = 2;
        for (let x = section.x + 18; x < section.x + section.w - 8; x += 25) {
          ctx.beginPath();
          ctx.moveTo(x, section.y + 3);
          ctx.lineTo(x + 7 + warningProgress * 5, section.y + section.h);
          ctx.stroke();
        }
      }
      ctx.restore();
    }

    const bell = objective.bell;
    if (!bell?.restored) {
      for (const chime of bell?.puzzle?.chimes || []) {
        const x = chime.tx * TILE;
        const baseY = chime.baseTy * TILE;
        const lit = chime.struck;
        const swing = lit ? Math.sin(time * 5.2 + chime.tx) * .08 : 0;
        ctx.save();
        ctx.translate(x, baseY - 8);
        ctx.rotate(swing);
        ctx.strokeStyle = lit ? '#9cecff' : '#8a7c70';
        ctx.fillStyle = lit ? 'rgba(212,174,81,.94)' : 'rgba(60,55,66,.94)';
        ctx.shadowColor = lit ? '#8cecff' : 'transparent';
        ctx.shadowBlur = lit ? 22 : 0;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(0, -108);
        ctx.lineTo(0, -78);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(-28, -30);
        ctx.quadraticCurveTo(-23, -70, 0, -78);
        ctx.quadraticCurveTo(23, -70, 28, -30);
        ctx.quadraticCurveTo(0, -19, -28, -30);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(0, -21, 6, 0, Math.PI * 2);
        ctx.fillStyle = lit ? '#fff0b6' : '#9b929b';
        ctx.fill();
        ctx.fillStyle = lit ? '#dffcff' : '#f0dfbf';
        ctx.font = "800 13px 'Outfit'";
        ctx.textAlign = 'center';
        ctx.fillText(chime.label.toUpperCase(), 0, -2);
        ctx.restore();
      }
    }

    if (bell && (!bell.puzzle?.chimes?.length || bell.restored)) {
      const x = bell.tx * TILE;
      const baseY = bell.baseTy * TILE;
      const restored = bell.restored;
      const swing = restored ? Math.sin(time * 4.8) * .11 : 0;
      const ropeX = 70.5 * TILE;
      ctx.save();
      ctx.strokeStyle = restored ? 'rgba(133,236,255,.88)' : objective.memoryBrace?.revealed ? 'rgba(91,210,232,.58)' : 'rgba(95,91,105,.34)';
      ctx.shadowColor = restored ? '#8cecff' : 'transparent';
      ctx.shadowBlur = restored ? 20 : 0;
      ctx.lineWidth = restored ? 5 : 3;
      ctx.beginPath();
      ctx.moveTo(ropeX, 15 * TILE);
      ctx.lineTo(ropeX, 48);
      ctx.quadraticCurveTo(74 * TILE, 24, x, 18);
      ctx.stroke();

      ctx.translate(x, baseY - 9);
      ctx.rotate(swing);
      ctx.strokeStyle = restored ? '#ffe096' : '#77717c';
      ctx.fillStyle = restored ? 'rgba(218,167,70,.92)' : 'rgba(68,62,72,.9)';
      ctx.shadowColor = restored ? '#f6d06f' : 'transparent';
      ctx.shadowBlur = restored ? 28 : 0;
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(0, -126);
      ctx.lineTo(0, -93);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-47, -34);
      ctx.quadraticCurveTo(-39, -92, 0, -101);
      ctx.quadraticCurveTo(39, -92, 47, -34);
      ctx.quadraticCurveTo(0, -18, -47, -34);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, -24, 8, 0, Math.PI * 2);
      ctx.fillStyle = restored ? '#fff0b6' : '#9b929b';
      ctx.fill();
      if (!restored) {
        ctx.strokeStyle = '#2c2832';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(-12, -91);
        ctx.lineTo(4, -66);
        ctx.lineTo(-5, -42);
        ctx.stroke();
      }
      ctx.restore();

      if (restored) {
        const wave = (time * 140) % 260;
        ctx.save();
        ctx.strokeStyle = `rgba(143,234,255,${Math.max(0, 1 - wave / 260)})`;
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.arc(x, baseY - 64, 58 + wave, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
    }
  }

  if (level.objective?.type === 'sanctum-lamp-restoration') {
    const objective = level.objective;
    const lamp = objective.lamp;
    const lampX = lamp.tx * TILE;
    const lampY = lamp.baseTy * TILE;

    for (const field of objective.returnFields || []) {
      const gradient = ctx.createLinearGradient(field.x, field.y, field.x, field.y + field.h);
      gradient.addColorStop(0, field.role === 'return' ? 'rgba(122,232,239,.48)' : 'rgba(107,201,224,.28)');
      gradient.addColorStop(1, 'rgba(29,19,56,.72)');
      ctx.save();
      ctx.fillStyle = gradient;
      ctx.shadowColor = '#75dce8';
      ctx.shadowBlur = field.role === 'return' ? 24 : 12;
      ctx.fillRect(field.x, field.y, field.w, field.h);
      ctx.strokeStyle = field.role === 'return' ? 'rgba(162,245,243,.86)' : 'rgba(117,220,232,.55)';
      ctx.lineWidth = field.role === 'return' ? 4 : 2;
      for (let x = field.x + 10; x < field.x + field.w; x += 22) {
        const drift = Math.sin(time * 2.8 + x * .025) * 8;
        ctx.beginPath();
        ctx.moveTo(x + drift, field.y + field.h);
        ctx.quadraticCurveTo(x - 14, field.y + field.h * .52, x + drift * .4, field.y + 8);
        ctx.stroke();
      }
      ctx.restore();
    }

    ctx.save();
    ctx.translate(lampX, lampY);
    ctx.strokeStyle = lamp.bound ? (objective.returnProven ? '#ffe394' : '#8cebef') : '#656777';
    ctx.fillStyle = lamp.bound ? 'rgba(31,46,61,.9)' : 'rgba(25,26,39,.9)';
    ctx.shadowColor = lamp.bound ? ctx.strokeStyle : 'transparent';
    ctx.shadowBlur = lamp.bound ? 30 : 0;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(-54, 0);
    ctx.lineTo(-54, -102);
    ctx.quadraticCurveTo(0, -158, 54, -102);
    ctx.lineTo(54, 0);
    ctx.stroke();
    roundRect(ctx, -26, -92, 52, 72, 18);
    ctx.fill();
    ctx.stroke();
    if (lamp.bound) {
      const pulse = 1 + Math.sin(time * 4.2) * .09;
      ctx.scale(pulse, pulse);
      ctx.fillStyle = objective.returnProven ? '#ffe39a' : '#82e8ef';
      ctx.beginPath();
      ctx.moveTo(0, -76);
      ctx.quadraticCurveTo(-20, -55, 0, -34);
      ctx.quadraticCurveTo(20, -55, 0, -76);
      ctx.fill();
      if (objective.returnProven) {
        ctx.fillStyle = '#f8fbff';
        ctx.beginPath();
        ctx.arc(0, -50, 5, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      ctx.strokeStyle = '#72bac8';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-8, -44);
      ctx.lineTo(7, -64);
      ctx.stroke();
    }
    ctx.restore();

    const arch = objective.arch;
    if (arch) {
      ctx.save();
      ctx.fillStyle = lamp.bound ? 'rgba(241,207,113,.78)' : 'rgba(99,102,117,.5)';
      ctx.shadowColor = lamp.bound ? '#f1cf71' : 'transparent';
      ctx.shadowBlur = lamp.bound ? 14 : 0;
      for (let index = 0; index < 4; index += 1) {
        const y = (23.8 - index * 1.02) * TILE;
        ctx.beginPath();
        ctx.ellipse(42.72 * TILE, y, 7, 12, -.28, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    const witness = objective.witness;
    if (witness) {
      const x = witness.tx * TILE;
      const y = witness.baseTy * TILE;
      ctx.save();
      ctx.strokeStyle = witness.reached ? '#f2d277' : '#6f7d8e';
      ctx.shadowColor = witness.reached ? '#f2d277' : 'transparent';
      ctx.shadowBlur = witness.reached ? 22 : 0;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(x - 58, y);
      ctx.lineTo(x - 46, y - 122);
      ctx.quadraticCurveTo(x, y - 154, x + 46, y - 122);
      ctx.lineTo(x + 58, y);
      ctx.stroke();
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x - 31, y - 93);
      ctx.quadraticCurveTo(x - 3, y - 119, x + 29, y - 80);
      ctx.moveTo(x - 24, y - 61);
      ctx.quadraticCurveTo(x + 5, y - 40, x + 33, y - 70);
      ctx.stroke();
      ctx.restore();
    }

    const canopy = objective.canopy;
    if (canopy) {
      ctx.save();
      ctx.globalAlpha = canopy.restored ? .92 : .16;
      ctx.strokeStyle = canopy.restored ? '#f5d77d' : '#607286';
      ctx.shadowColor = canopy.restored ? '#f5d77d' : 'transparent';
      ctx.shadowBlur = canopy.restored ? 24 : 0;
      ctx.lineWidth = canopy.restored ? 4 : 2;
      ctx.beginPath();
      ctx.moveTo(canopy.x, canopy.y + canopy.h);
      ctx.quadraticCurveTo(canopy.x + canopy.w / 2, canopy.y - 90, canopy.x + canopy.w, canopy.y + canopy.h);
      ctx.stroke();
      const stars = [[.12,.68],[.27,.43],[.42,.55],[.58,.3],[.73,.48],[.88,.64]];
      for (let index = 0; index < stars.length; index += 1) {
        const [sx, sy] = stars[index];
        const x = canopy.x + canopy.w * sx;
        const y = canopy.y + canopy.h * sy;
        if (index) {
          const [px, py] = stars[index - 1];
          ctx.beginPath();
          ctx.moveTo(canopy.x + canopy.w * px, canopy.y + canopy.h * py);
          ctx.lineTo(x, y);
          ctx.stroke();
        }
        ctx.fillStyle = canopy.restored ? '#fff0b0' : '#6f8498';
        ctx.beginPath();
        ctx.arc(x, y, canopy.restored ? 5 : 3, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    for (const column of objective.lightColumns || []) {
      const x = column.tx * TILE;
      const y = column.ty * TILE;
      ctx.save();
      ctx.globalAlpha = column.lit ? .82 : .14;
      ctx.strokeStyle = column.lit ? '#8cebef' : '#5d6678';
      ctx.fillStyle = column.lit ? 'rgba(140,235,239,.14)' : 'rgba(35,39,53,.22)';
      ctx.shadowColor = column.lit ? '#8cebef' : 'transparent';
      ctx.shadowBlur = column.lit ? 18 : 0;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x - 20, y + 82);
      ctx.lineTo(x - 20, y + 15);
      ctx.quadraticCurveTo(x, y - 20, x + 20, y + 15);
      ctx.lineTo(x + 20, y + 82);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
  }

  if (level.objective?.type === 'parachute-choir-restoration') {
    const objective = level.objective;
    const activeStage = objective.stages?.find((stage) => stage.id === objective.phase && stage.active && !stage.complete);
    if (activeStage) {
      const elapsed = objective.encounterClock - activeStage.startedAt;
      for (const rosterId of activeStage.rosterIds) {
        const member = objective.roster.find((item) => item.id === rosterId);
        if (!member || member.status !== 'queued' || elapsed >= member.delay) continue;
        const tx = Math.floor(member.dropTx);
        const landingTy = level.map.findIndex((row) => [Tile.STONE, Tile.GLOW, Tile.ONEWAY].includes(row[tx]));
        const x = member.dropTx * TILE;
        const y = landingTy * TILE;
        const warning = Math.max(0, Math.min(1, elapsed / member.delay));
        ctx.save();
        ctx.strokeStyle = '#f2c568';
        ctx.fillStyle = `rgba(224,92,62,${.08 + warning * .12})`;
        ctx.shadowColor = '#f0b74d';
        ctx.shadowBlur = 12 + warning * 14;
        ctx.lineWidth = 3;
        ctx.setLineDash([12, 8]);
        ctx.beginPath();
        ctx.ellipse(x, y - 3, 34 + warning * 9, 10 + warning * 3, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.moveTo(x, y - 22);
        ctx.lineTo(x, y - 68 - warning * 26);
        ctx.moveTo(x - 10, y - 56 - warning * 26);
        ctx.lineTo(x, y - 68 - warning * 26);
        ctx.lineTo(x + 10, y - 56 - warning * 26);
        ctx.stroke();
        ctx.restore();
      }
    }

    const skycut = objective.skycut;
    const seesaw = skycut?.seesaw;
    if (seesaw) {
      const progress = Math.max(0, Math.min(1, seesaw.balanceSeconds / seesaw.requiredBalanceSeconds));
      ctx.save();
      ctx.translate(seesaw.pivotX, seesaw.pivotY);

      // Keep the old gold-and-dark platform language while allowing the whole
      // familiar beam to rotate around one small, readable fulcrum.
      ctx.fillStyle = '#20283a';
      ctx.strokeStyle = seesaw.balanced ? '#8ce8ff' : '#8c6e3d';
      ctx.lineWidth = 3;
      ctx.shadowColor = seesaw.balanced ? '#8ce8ff' : '#dfbd69';
      ctx.shadowBlur = seesaw.balanced ? 16 : 8;
      ctx.beginPath();
      ctx.moveTo(0, 8);
      ctx.lineTo(-24, 42);
      ctx.lineTo(24, 42);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.rotate(seesaw.angle || 0);
      for (let segment = 0; segment < seesaw.w / TILE; segment += 1) {
        const x = -seesaw.w / 2 + segment * TILE;
        ctx.fillStyle = '#34405b';
        roundRect(ctx, x, 4, TILE, 13, 5);
        ctx.fill();
        ctx.fillStyle = seesaw.balanced ? '#8ce8ff' : '#dfbd69';
        roundRect(ctx, x, 3, TILE, 4, 3);
        ctx.fill();
        ctx.fillStyle = 'rgba(3,6,14,.55)';
        ctx.fillRect(x + 4, 12, TILE - 8, 5);
      }

      ctx.shadowBlur = 0;
      ctx.fillStyle = seesaw.balanced ? '#e5feff' : '#fff0b1';
      for (const offset of [-18, 0, 18]) {
        ctx.save();
        ctx.translate(offset, -seesaw.h / 2 - 5);
        ctx.rotate(Math.PI / 4);
        ctx.fillRect(-4, -4, 8, 8);
        ctx.restore();
      }
      if (!seesaw.balanced && progress > 0) {
        ctx.fillStyle = 'rgba(140,232,255,.9)';
        ctx.fillRect(-seesaw.w * .16, -seesaw.h / 2 - 15, seesaw.w * .32 * progress, 4);
      }
      ctx.restore();
    }

    if (skycut?.tether) {
      const tetherX = skycut.tether.tx * TILE;
      const tetherY = skycut.tether.baseTy * TILE - 78;
      ctx.save();
      ctx.strokeStyle = skycut.tether.cut ? 'rgba(120,225,237,.34)' : '#f1c767';
      ctx.shadowColor = skycut.tether.cut ? 'transparent' : '#f1c767';
      ctx.shadowBlur = skycut.tether.cut ? 0 : 18;
      ctx.lineWidth = skycut.tether.cut ? 2 : 5;
      ctx.setLineDash(skycut.tether.cut ? [9, 14] : []);
      ctx.beginPath();
      ctx.moveTo(tetherX, 6 * TILE);
      ctx.quadraticCurveTo(tetherX + 35, 14 * TILE, tetherX, tetherY);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = skycut.tether.cut ? '#70929a' : '#ffe49a';
      ctx.beginPath();
      ctx.moveTo(tetherX - 15, tetherY - 5);
      ctx.lineTo(tetherX, tetherY + 13);
      ctx.lineTo(tetherX + 15, tetherY - 5);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    for (const sail of objective.windSails || []) {
      const x = sail.tx * TILE;
      const y = sail.ty * TILE;
      ctx.save();
      ctx.globalAlpha = sail.unfurled ? .9 : .16;
      ctx.strokeStyle = sail.unfurled ? '#f3d47a' : '#687486';
      ctx.fillStyle = sail.unfurled ? 'rgba(120,225,233,.22)' : 'rgba(29,35,50,.24)';
      ctx.shadowColor = sail.unfurled ? '#8be4eb' : 'transparent';
      ctx.shadowBlur = sail.unfurled ? 18 : 0;
      ctx.lineWidth = sail.unfurled ? 4 : 2;
      ctx.beginPath();
      ctx.moveTo(x - 56, y + 52);
      ctx.quadraticCurveTo(x, y - 38 - Math.sin(time * 2 + sail.tx) * 6, x + 56, y + 52);
      ctx.quadraticCurveTo(x, y + 20, x - 56, y + 52);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x - 42, y + 45);
      ctx.lineTo(x - 28, y + 96);
      ctx.moveTo(x + 42, y + 45);
      ctx.lineTo(x + 28, y + 96);
      ctx.stroke();
      ctx.restore();
    }

    const loom = objective.windLoom;
    if (loom && ['updraft', 'complete'].includes(objective.phase)) {
      const ringX = loom.ring.tx * TILE;
      const ringY = loom.ring.ty * TILE;
      const launchY = loom.launch.feetTy * TILE;
      const lifting = loom.state === 'lift';
      const complete = loom.crossed || objective.complete;
      const color = complete ? '#ffe28a' : lifting ? '#8ce8ff' : loom.state === 'warning' ? '#dfbd69' : '#71869b';
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      ctx.strokeStyle = color;
      ctx.fillStyle = complete
        ? 'rgba(255,226,138,.14)'
        : lifting ? 'rgba(140,232,255,.16)' : 'rgba(83,97,119,.08)';
      ctx.shadowColor = color;
      ctx.shadowBlur = complete || lifting ? 24 : 12;
      ctx.lineWidth = complete || lifting ? 5 : 3;

      ctx.beginPath();
      ctx.ellipse(ringX, ringY, loom.ring.radius, loom.ring.radius * .38, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.setLineDash(lifting || complete ? [] : [12, 10]);
      for (const offset of [-44, 0, 44]) {
        ctx.beginPath();
        ctx.moveTo(ringX + offset, launchY);
        for (let step = 1; step <= 6; step += 1) {
          const t = step / 6;
          const sway = Math.sin(time * 4 + step * 1.3 + offset) * (lifting ? 13 : 7) * (1 - t);
          ctx.lineTo(ringX + offset * (1 - t) + sway, launchY + (ringY - launchY) * t);
        }
        ctx.stroke();
      }
      ctx.setLineDash([]);

      ctx.font = '700 16px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = color;
      ctx.fillText(complete ? 'SKY OPEN' : lifting ? 'RIDE' : loom.state === 'warning' ? 'WAIT' : 'RESET', ringX, ringY - 18);
      ctx.restore();
    }

    if (objective.skyRestored) {
      ctx.save();
      const gradient = ctx.createLinearGradient(13 * TILE, 0, 82 * TILE, 0);
      gradient.addColorStop(0, 'rgba(116,226,236,0)');
      gradient.addColorStop(.18, 'rgba(116,226,236,.18)');
      gradient.addColorStop(.5, 'rgba(248,214,121,.27)');
      gradient.addColorStop(.82, 'rgba(116,226,236,.18)');
      gradient.addColorStop(1, 'rgba(116,226,236,0)');
      ctx.fillStyle = gradient;
      ctx.fillRect(13 * TILE, 15 * TILE, 69 * TILE, 5 * TILE);
      ctx.strokeStyle = 'rgba(255,230,151,.68)';
      ctx.shadowColor = '#f4d579';
      ctx.shadowBlur = 22;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(13 * TILE, 18 * TILE);
      ctx.bezierCurveTo(32 * TILE, 12 * TILE, 61 * TILE, 12 * TILE, 82 * TILE, 18 * TILE);
      ctx.stroke();
      ctx.restore();
    }
  }

  if (level.objective?.type === 'veil-gate-restoration') {
    const objective = level.objective;
    const gateX = level.gateColumn * TILE + TILE / 2;
    const gateBaseY = 26 * TILE;
    const restored = objective.gateRestored;
    const pulse = .76 + Math.sin(time * 3.2) * .16;

    const seat = objective.counterweight?.zone;
    if (seat) {
      ctx.save();
      ctx.fillStyle = objective.counterweight.bound ? 'rgba(112,231,241,.32)' : 'rgba(112,231,241,.12)';
      ctx.strokeStyle = objective.counterweight.bound ? '#8cebf1' : 'rgba(118,205,220,.58)';
      ctx.shadowColor = objective.counterweight.bound ? '#80e7ff' : 'transparent';
      ctx.shadowBlur = objective.counterweight.bound ? 18 : 0;
      ctx.lineWidth = 3;
      ctx.setLineDash(objective.counterweight.bound ? [] : [9, 7]);
      ctx.fillRect(seat.x, seat.y - 18, seat.w, seat.h + 18);
      ctx.strokeRect(seat.x, seat.y - 18, seat.w, seat.h + 18);
      ctx.setLineDash([]);
      ctx.restore();
    }

    ctx.save();
    ctx.strokeStyle = restored ? '#ffe394' : 'rgba(166,126,77,.7)';
    ctx.fillStyle = restored ? 'rgba(241,205,105,.09)' : 'rgba(18,19,32,.42)';
    ctx.shadowColor = restored ? '#f5cf69' : 'rgba(117,74,48,.6)';
    ctx.shadowBlur = restored ? 34 : 12;
    ctx.lineWidth = restored ? 7 : 5;
    ctx.beginPath();
    ctx.moveTo(gateX - 155, gateBaseY);
    ctx.lineTo(gateX - 155, gateBaseY - 390);
    ctx.quadraticCurveTo(gateX, gateBaseY - 570, gateX + 155, gateBaseY - 390);
    ctx.lineTo(gateX + 155, gateBaseY);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.lineWidth = 2;
    for (let ring = 1; ring <= 3; ring += 1) {
      const inset = ring * 28;
      ctx.beginPath();
      ctx.moveTo(gateX - 155 + inset, gateBaseY);
      ctx.lineTo(gateX - 155 + inset, gateBaseY - 365 + inset * .34);
      ctx.quadraticCurveTo(gateX, gateBaseY - 535 + inset, gateX + 155 - inset, gateBaseY - 365 + inset * .34);
      ctx.lineTo(gateX + 155 - inset, gateBaseY);
      ctx.stroke();
    }
    if (restored) {
      const glow = ctx.createLinearGradient(gateX - 150, 0, gateX + 150, 0);
      glow.addColorStop(0, 'rgba(111,228,239,0)');
      glow.addColorStop(.5, `rgba(255,225,137,${.12 + pulse * .12})`);
      glow.addColorStop(1, 'rgba(111,228,239,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(gateX - 150, gateBaseY - 480, 300, 480);
    }
    ctx.restore();

    for (const banner of objective.relayBanners || []) {
      const x = banner.tx * TILE;
      const y = banner.baseTy * TILE;
      ctx.save();
      ctx.globalAlpha = banner.restored ? .94 : .24;
      ctx.strokeStyle = banner.restored ? '#ffe18a' : '#6e6670';
      ctx.fillStyle = banner.restored ? 'rgba(117,226,235,.25)' : 'rgba(34,33,47,.65)';
      ctx.shadowColor = banner.restored ? '#83e4ec' : 'transparent';
      ctx.shadowBlur = banner.restored ? 24 : 0;
      ctx.lineWidth = banner.restored ? 4 : 2;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x, y - 170);
      ctx.lineTo(x + (banner.id.startsWith('west') ? 72 : -72), y - 148);
      ctx.lineTo(x, y - 98);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    const sunstone = objective.sunstone;
    if (sunstone) {
      const x = sunstone.tx * TILE;
      const y = sunstone.baseTy * TILE - 72;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(time * (sunstone.struck ? .6 : .12));
      ctx.strokeStyle = sunstone.struck ? '#fff0aa' : sunstone.exposed ? '#f0c868' : '#726157';
      ctx.fillStyle = sunstone.struck ? '#f5d470' : '#10121d';
      ctx.shadowColor = sunstone.exposed ? '#e9c363' : 'transparent';
      ctx.shadowBlur = sunstone.exposed ? 20 + pulse * 10 : 0;
      ctx.lineWidth = sunstone.exposed ? 5 : 3;
      ctx.beginPath();
      for (let point = 0; point < 16; point += 1) {
        const radius = point % 2 ? 23 : 36;
        const angle = -Math.PI / 2 + point * Math.PI / 8;
        const px = Math.cos(angle) * radius;
        const py = Math.sin(angle) * radius;
        if (point === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
  }

  if (level.objective?.type === 'warden-restoration') {
    const objective = level.objective;
    const warden = objective.warden;
    const breath = objective.breath;
    const restored = objective.crownPath?.restored || objective.complete;
    const pulse = .72 + Math.sin(time * 3.1) * .18;
    const centerX = warden.x;
    const feetY = warden.feetY;
    const kneel = warden.kneeling ? 112 : 0;

    // The guardian is a persistent monumental silhouette, not the legacy
    // health-bar boss. It stays present after release so the victory reads as
    // restoration rather than a despawned corpse.
    ctx.save();
    ctx.globalAlpha = restored ? .78 : .66;
    ctx.fillStyle = restored ? 'rgba(104,101,83,.72)' : 'rgba(25,25,34,.9)';
    ctx.strokeStyle = restored ? '#f3d47d' : 'rgba(121,223,235,.55)';
    ctx.shadowColor = restored ? '#f1ce72' : '#73dce9';
    ctx.shadowBlur = restored ? 34 : 18;
    ctx.lineWidth = restored ? 7 : 5;
    ctx.beginPath();
    ctx.moveTo(centerX - 188, feetY);
    ctx.quadraticCurveTo(centerX - 174, feetY - 330 + kneel, centerX - 92, feetY - 430 + kneel);
    ctx.quadraticCurveTo(centerX - 58, feetY - 525 + kneel, centerX, feetY - 536 + kneel);
    ctx.quadraticCurveTo(centerX + 61, feetY - 525 + kneel, centerX + 98, feetY - 425 + kneel);
    ctx.quadraticCurveTo(centerX + 178, feetY - 312 + kneel, centerX + 194, feetY);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.lineWidth = 3;
    ctx.globalAlpha *= .72;
    for (let band = 0; band < 6; band += 1) {
      const y = feetY - 74 - band * 64 + kneel * (band / 7);
      ctx.beginPath();
      ctx.moveTo(centerX - 120 + band * 6, y);
      ctx.bezierCurveTo(centerX - 35, y - 22, centerX + 34, y + 17, centerX + 126 - band * 5, y - 5);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = restored ? '#ffe493' : '#7fe3ed';
    ctx.shadowBlur = 24;
    ctx.beginPath();
    ctx.arc(centerX - 28, feetY - 449 + kneel, restored ? 10 : 7 + pulse * 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    const zone = objective.heartstone?.zone;
    if (zone) {
      ctx.save();
      ctx.fillStyle = objective.heartstone.bound ? 'rgba(118,229,238,.3)' : 'rgba(118,229,238,.1)';
      ctx.strokeStyle = objective.heartstone.bound ? '#8cebf1' : 'rgba(126,217,229,.64)';
      ctx.shadowColor = objective.heartstone.bound ? '#80e7ff' : 'transparent';
      ctx.shadowBlur = objective.heartstone.bound ? 20 : 0;
      ctx.lineWidth = 4;
      ctx.setLineDash(objective.heartstone.bound ? [] : [10, 8]);
      ctx.fillRect(zone.x, zone.y - 20, zone.w, zone.h + 20);
      ctx.strokeRect(zone.x, zone.y - 20, zone.w, zone.h + 20);
      ctx.setLineDash([]);
      ctx.restore();
    }

    if (['listen', 'anchor'].includes(objective.phase)) {
      const cycleClock = breath.clock % breath.cycleSeconds;
      const active = objective.phase === 'anchor'
        && cycleClock >= breath.warningSeconds
        && cycleClock < breath.warningSeconds + breath.activeSeconds;
      const warning = objective.phase === 'listen' || cycleClock < breath.warningSeconds;
      const edgeY = 26 * TILE - 10;
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      ctx.strokeStyle = active ? '#ee755f' : warning ? '#80e7ef' : 'rgba(126,220,230,.36)';
      ctx.fillStyle = active ? 'rgba(224,92,66,.16)' : 'rgba(110,224,235,.09)';
      ctx.shadowColor = active ? '#e75f4e' : '#79e3ec';
      ctx.shadowBlur = active ? 26 : 16;
      ctx.lineWidth = active ? 9 : 6;
      ctx.beginPath();
      ctx.moveTo(20 * TILE, edgeY);
      for (let tx = 20; tx <= 63; tx += 1) {
        ctx.lineTo(tx * TILE, edgeY - 9 - Math.sin(tx * .8 + time * 5) * (active ? 17 : 9));
      }
      ctx.lineTo(63 * TILE, 26 * TILE);
      ctx.lineTo(20 * TILE, 26 * TILE);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    const hand = objective.rememberedHand;
    if (hand?.raised) {
      const ribX = hand.rib.tx * TILE + TILE / 2;
      ctx.save();
      ctx.strokeStyle = hand.restored ? '#ffe393' : '#e8c36e';
      ctx.shadowColor = hand.restored ? '#ffe08a' : '#d5a756';
      ctx.shadowBlur = 26;
      ctx.lineWidth = 10;
      ctx.beginPath();
      ctx.moveTo(ribX, hand.rib.bottomTy * TILE + 30);
      ctx.quadraticCurveTo(ribX - 52, 23 * TILE, ribX, hand.rib.topTy * TILE + 12);
      ctx.stroke();
      ctx.lineWidth = 5;
      for (let finger = 0; finger < 4; finger += 1) {
        ctx.beginPath();
        ctx.moveTo(ribX - 10, 20 * TILE + 18);
        ctx.lineTo((47.5 + finger * 2) * TILE, 20 * TILE - 10 - finger * 7);
        ctx.stroke();
      }
      ctx.restore();
    }

    const bridle = objective.bridle;
    if (bridle?.exposed) {
      const cycle = bridle.guardSeconds + bridle.recoverySeconds;
      const recovery = objective.phase === 'unbind' && bridle.clock % cycle >= bridle.guardSeconds;
      const x = bridle.tx * TILE;
      const y = bridle.baseTy * TILE - 72;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(Math.sin(time * 1.7) * .08);
      ctx.fillStyle = bridle.struck ? '#26262b' : recovery ? '#75e3ed' : '#d8a950';
      ctx.strokeStyle = bridle.struck ? '#6b6560' : recovery ? '#bff8fa' : '#ffd67b';
      ctx.shadowColor = bridle.struck ? 'transparent' : recovery ? '#78e7f1' : '#e6aa49';
      ctx.shadowBlur = bridle.struck ? 0 : 24;
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(0, -42);
      ctx.lineTo(36, 0);
      ctx.lineTo(0, 42);
      ctx.lineTo(-36, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    const duel = objective.duel;
    if (duel?.active) {
      drawWardenFighter(ctx, duel, time, assets.warden);
    }

    if (restored) {
      ctx.save();
      const dawn = ctx.createLinearGradient(46 * TILE, 0, 74 * TILE, 0);
      dawn.addColorStop(0, 'rgba(111,228,239,0)');
      dawn.addColorStop(.34, 'rgba(111,228,239,.14)');
      dawn.addColorStop(.64, 'rgba(255,224,134,.3)');
      dawn.addColorStop(1, 'rgba(255,224,134,0)');
      ctx.fillStyle = dawn;
      ctx.fillRect(46 * TILE, 8 * TILE, 28 * TILE, 12 * TILE);
      ctx.strokeStyle = 'rgba(255,230,151,.86)';
      ctx.shadowColor = '#f4d579';
      ctx.shadowBlur = 30;
      ctx.lineWidth = 7;
      ctx.beginPath();
      ctx.moveTo(46 * TILE, 20 * TILE - 8);
      ctx.bezierCurveTo(54 * TILE, 17.6 * TILE, 65 * TILE, 18.8 * TILE, 74 * TILE, 14 * TILE);
      ctx.stroke();
      ctx.restore();
    }
  }

  for (const zone of level.water || []) {
    const grad = ctx.createLinearGradient(zone.x, zone.y, zone.x, zone.y + zone.h);
    grad.addColorStop(0, 'rgba(105,211,231,.36)');
    grad.addColorStop(.18, 'rgba(32,125,163,.32)');
    grad.addColorStop(1, 'rgba(6,40,74,.58)');
    ctx.fillStyle = grad;
    ctx.fillRect(zone.x, zone.y, zone.w, zone.h);
    ctx.strokeStyle = 'rgba(182,244,255,.72)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let x = zone.x; x <= zone.x + zone.w; x += 18) {
      const y = zone.y + Math.sin(time * 3 + x * .035) * 4;
      if (x === zone.x) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.fillStyle = 'rgba(185,240,255,.38)';
    for (let i = 0; i < Math.min(18, Math.floor(zone.w / 35)); i += 1) {
      const bx = zone.x + ((i * 97 + time * (10 + i)) % zone.w);
      const by = zone.y + zone.h - ((i * 61 + time * 28) % zone.h);
      ctx.beginPath();
      ctx.arc(bx, by, 1.5 + i % 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  for (const mover of level.movers || []) {
    ctx.save();
    ctx.shadowColor = level.theme?.accent || '#e8c56a';
    ctx.shadowBlur = 12;
    const grad = ctx.createLinearGradient(mover.x, mover.y, mover.x, mover.y + mover.h);
    grad.addColorStop(0, level.theme?.accent || '#f3cf72');
    grad.addColorStop(.32, '#5b6177');
    grad.addColorStop(1, '#171c2b');
    ctx.fillStyle = grad;
    roundRect(ctx, mover.x, mover.y, mover.w, mover.h, 5);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(255,255,255,.45)';
    ctx.stroke();
    ctx.restore();
  }

  for (const platform of level.veilPlatforms || []) {
    ctx.save();
    ctx.globalAlpha = platform.active ? .92 : .16;
    ctx.shadowColor = platform.active ? '#c5a5ff' : 'transparent';
    ctx.shadowBlur = 18;
    const grad = ctx.createLinearGradient(platform.x, platform.y, platform.x + platform.w, platform.y);
    grad.addColorStop(0, '#5d438b');
    grad.addColorStop(.5, '#d4b9ff');
    grad.addColorStop(1, '#514078');
    ctx.fillStyle = grad;
    roundRect(ctx, platform.x, platform.y, platform.w, platform.h, 6);
    ctx.fill();
    ctx.restore();
  }

  for (const crusher of level.crushers || []) {
    ctx.save();
    const grad = ctx.createLinearGradient(crusher.x, crusher.y, crusher.x + crusher.w, crusher.y);
    grad.addColorStop(0, '#151827');
    grad.addColorStop(.5, '#6d4937');
    grad.addColorStop(1, '#151827');
    ctx.fillStyle = grad;
    ctx.fillRect(crusher.x, crusher.y, crusher.w, crusher.h);
    ctx.strokeStyle = '#db8748';
    ctx.lineWidth = 3;
    ctx.strokeRect(crusher.x + 3, crusher.y + 3, crusher.w - 6, crusher.h - 6);
    ctx.fillStyle = '#e2a45d';
    for (let x = crusher.x + 8; x < crusher.x + crusher.w - 4; x += 16) {
      ctx.beginPath();
      ctx.moveTo(x, crusher.y + crusher.h);
      ctx.lineTo(x + 7, crusher.y + crusher.h + 13);
      ctx.lineTo(x + 14, crusher.y + crusher.h);
      ctx.fill();
    }
    ctx.restore();
  }

  if (level.mirrors?.length) {
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.strokeStyle = gateOpen ? 'rgba(255,226,128,.92)' : 'rgba(255,226,128,.28)';
    ctx.lineWidth = gateOpen ? 5 : 2;
    ctx.shadowColor = '#ffe082';
    ctx.shadowBlur = gateOpen ? 18 : 5;
    ctx.beginPath();
    level.mirrors.forEach((mirror, index) => {
      if (index === 0) ctx.moveTo(mirror.x, mirror.y);
      else ctx.lineTo(mirror.x, mirror.y);
    });
    ctx.lineTo(level.door.x + level.door.w / 2, level.door.y + 45);
    ctx.stroke();
    ctx.restore();
    for (const mirror of level.mirrors) {
      ctx.save();
      ctx.translate(mirror.x, mirror.y);
      ctx.rotate(mirror.angle);
      ctx.fillStyle = '#eef6ff';
      ctx.shadowColor = '#ffd76b';
      ctx.shadowBlur = 16;
      roundRect(ctx, -20, -5, 40, 10, 5);
      ctx.fill();
      ctx.restore();
    }
  }
}

export function drawBoss(ctx, boss, time) {
  if (!boss || boss.hp <= 0) return;
  const magistrate = boss.visualStyle === 'nameless-magistrate';
  ctx.save();
  ctx.translate(boss.x + boss.w / 2, boss.y + boss.h);
  const pulse = .7 + Math.sin(time * 3) * .25;
  ctx.fillStyle = 'rgba(0,0,0,.4)';
  ctx.beginPath(); ctx.ellipse(0, 3, 48, 12, 0, 0, Math.PI * 2); ctx.fill();
  ctx.shadowColor = magistrate ? '#8ce9f1' : '#d8a746';
  ctx.shadowBlur = 20 * pulse;
  const cloak = ctx.createLinearGradient(-40, -100, 35, -10);
  cloak.addColorStop(0, magistrate ? '#d9e3d8' : '#d0a044');
  cloak.addColorStop(.35, magistrate ? '#28505a' : '#40314a');
  cloak.addColorStop(1, magistrate ? '#07151e' : '#130f20');
  ctx.fillStyle = cloak;
  ctx.beginPath();
  ctx.moveTo(-27, -82);
  ctx.quadraticCurveTo(-52, -43, -42, 0);
  ctx.lineTo(42, 0);
  ctx.quadraticCurveTo(52, -47, 27, -82);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = magistrate ? '#d8ded5' : '#111522';
  ctx.beginPath(); ctx.arc(0, -79, 26, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = magistrate ? '#72dfe8' : '#f0c75d'; ctx.lineWidth = 5;
  if (magistrate) {
    ctx.beginPath(); ctx.moveTo(-16, -93); ctx.lineTo(16, -93); ctx.lineTo(20, -70); ctx.lineTo(0, -61); ctx.lineTo(-20, -70); ctx.closePath(); ctx.stroke();
    ctx.fillStyle = '#142932';
    ctx.fillRect(-14, -84, 28, 5);
    ctx.strokeStyle = '#e8c56a';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-25, -48); ctx.lineTo(25, -48); ctx.moveTo(0, -55); ctx.lineTo(0, -30); ctx.moveTo(-22, -48); ctx.lineTo(-31, -34); ctx.lineTo(-14, -34); ctx.closePath(); ctx.moveTo(22, -48); ctx.lineTo(31, -34); ctx.lineTo(14, -34); ctx.closePath(); ctx.stroke();
  } else {
    ctx.beginPath(); ctx.arc(0, -79, 21, -.2, Math.PI * 1.15); ctx.stroke();
    ctx.fillStyle = '#ffda74';
    ctx.fillRect(7, -84, 9, 3);
  }
  ctx.strokeStyle = magistrate ? '#a8e3e7' : '#c9d6e2'; ctx.lineWidth = 7;
  ctx.beginPath(); ctx.moveTo(23, -58); ctx.lineTo(70, -28); ctx.stroke();
  ctx.restore();

  const barW = 150;
  ctx.fillStyle = 'rgba(3,5,12,.8)';
  ctx.fillRect(boss.x + boss.w / 2 - barW / 2, boss.y - 24, barW, 8);
  ctx.fillStyle = magistrate ? '#72dfe8' : '#e8c56a';
  ctx.fillRect(boss.x + boss.w / 2 - barW / 2, boss.y - 24, barW * (boss.hp / boss.maxHp), 8);
}

export function drawVisibleChunks(ctx, chunks, camera) {
  if (!Array.isArray(chunks)) return false;
  const first = Math.max(0, Math.floor(camera.x / CHUNK_W));
  const last = Math.min(CHUNK_COUNT - 1, Math.floor((camera.x + VIEW_W - 1) / CHUNK_W));
  let drewChunk = false;
  for (let i = first; i <= last; i += 1) {
    if (!chunks[i]) continue;
    const chunkWorldX = i * CHUNK_W;
    const visibleLeft = Math.max(camera.x, chunkWorldX);
    const visibleRight = Math.min(camera.x + VIEW_W, chunkWorldX + CHUNK_W, WORLD_W);
    const width = Math.max(0, visibleRight - visibleLeft);
    if (!width) continue;
    const sourceX = visibleLeft - chunkWorldX;
    const destX = visibleLeft - camera.x;
    ctx.drawImage(chunks[i], sourceX, camera.y, width, VIEW_H, destX, 0, width, VIEW_H);
    drewChunk = true;
  }
  return drewChunk;
}

export function drawRelic(ctx, relic, time) {
  if (relic.collected) return;
  const bob = Math.sin(time * 3 + relic.x * .01) * 6;
  ctx.save();
  ctx.translate(relic.x, relic.y + bob);
  ctx.shadowColor = '#ffd76b';
  ctx.shadowBlur = 28;
  const grad = ctx.createLinearGradient(-16, -20, 16, 20);
  grad.addColorStop(0, '#fff5be');
  grad.addColorStop(.45, '#e8c56a');
  grad.addColorStop(1, '#8a5f22');
  ctx.fillStyle = grad;
  ctx.rotate(Math.PI / 4);
  ctx.fillRect(-13, -13, 26, 26);
  ctx.strokeStyle = '#fff4bc';
  ctx.lineWidth = 2;
  ctx.strokeRect(-9, -9, 18, 18);
  ctx.fillStyle = '#9ad9ff';
  ctx.fillRect(-4, -4, 8, 8);
  ctx.restore();
}

export function drawDoor(ctx, door, open, time) {
  ctx.save();
  ctx.translate(door.x + door.w / 2, door.y + door.h / 2);
  const pulse = .75 + Math.sin(time * 2.2) * .2;
  ctx.shadowColor = open ? '#ffd86a' : '#5f667c';
  ctx.shadowBlur = open ? 32 * pulse : 8;
  ctx.fillStyle = '#101526';
  roundRect(ctx, -door.w / 2, -door.h / 2, door.w, door.h, 42);
  ctx.fill();
  ctx.strokeStyle = open ? '#f0cb67' : '#5a5d69';
  ctx.lineWidth = 6;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, -24, 29, 0, Math.PI * 2);
  ctx.fillStyle = open ? '#e9bd4e' : '#202639';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(-10, -24, 24, 0, Math.PI * 2);
  ctx.fillStyle = '#0a0d18';
  ctx.fill();
  if (open) {
    ctx.globalAlpha = .18 + pulse * .16;
    ctx.fillStyle = '#ffe08a';
    ctx.fillRect(-32, 13, 64, 42);
  }
  ctx.globalAlpha = 1;
  ctx.fillStyle = open ? '#ffe49a' : '#8f94a2';
  ctx.font = "600 10px 'Outfit'";
  ctx.textAlign = 'center';
  ctx.letterSpacing = '2px';
  ctx.fillText(open ? 'ENTER' : 'SEALED', 0, 74);
  ctx.restore();
}

export function drawBlockAndPlate(ctx, block, plate, active) {
  ctx.save();
  if (plate && !plate.disabled) {
    ctx.shadowColor = active ? '#e8c56a' : 'transparent';
    ctx.shadowBlur = active ? 18 : 0;
    ctx.fillStyle = active ? '#e8c56a' : '#725e43';
    roundRect(ctx, plate.x, plate.y, plate.w, plate.h, 5);
    ctx.fill();
    ctx.strokeStyle = '#f5d47d';
    ctx.stroke();
  }
  ctx.shadowBlur = 0;
  if (block.bound) {
    ctx.shadowColor = '#82e8ff';
    ctx.shadowBlur = 18;
  }
  const grad = ctx.createLinearGradient(block.x, block.y, block.x + block.w, block.y + block.h);
  grad.addColorStop(0, block.bound ? '#477184' : '#596079');
  grad.addColorStop(.45, block.bound ? '#25465c' : '#30384e');
  grad.addColorStop(1, '#151b2d');
  ctx.fillStyle = grad;
  roundRect(ctx, block.x, block.y, block.w, block.h, 5);
  ctx.fill();
  ctx.strokeStyle = block.bound ? '#82e8ff' : '#b99247';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(block.x + block.w / 2, block.y + block.h / 2, 10, 0, Math.PI * 2);
  ctx.strokeStyle = block.bound ? '#d4f8ff' : '#d8b45d';
  ctx.stroke();
  if (block.bound) {
    ctx.beginPath();
    ctx.moveTo(block.x + 7, block.y + block.h - 7);
    ctx.lineTo(block.x + block.w - 7, block.y + 7);
    ctx.moveTo(block.x + 7, block.y + 7);
    ctx.lineTo(block.x + block.w - 7, block.y + block.h - 7);
    ctx.strokeStyle = 'rgba(139,236,255,.7)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
  ctx.restore();
}

export function drawShip(ctx, ship, time) {
  ctx.save();
  const hover = Math.sin(time * 1.4 + ship.phase) * 8;
  ctx.translate(ship.x, ship.y + hover);
  ctx.fillStyle = 'rgba(2,5,14,.9)';
  ctx.beginPath();
  ctx.moveTo(-54, -9);
  ctx.lineTo(34, -17);
  ctx.lineTo(53, 1);
  ctx.lineTo(26, 17);
  ctx.lineTo(-41, 13);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#d8af53';
  ctx.shadowColor = '#e8c56a';
  ctx.shadowBlur = 12;
  ctx.fillRect(14, -8, 20, 7);
  ctx.shadowBlur = 0;
  ctx.strokeStyle = 'rgba(156,175,205,.45)';
  ctx.lineWidth = 3;
  const rotor = Math.sin(time * 18 + ship.phase) * 8;
  ctx.beginPath();
  ctx.moveTo(-24 - rotor, -20);
  ctx.lineTo(10 + rotor, -20);
  ctx.moveTo(-48 - rotor, -14);
  ctx.lineTo(-22 + rotor, -14);
  ctx.stroke();
  ctx.restore();
}

export function drawSoldier(ctx, soldier, time, veilRaiderSheet = null) {
  ctx.save();
  ctx.translate(soldier.x + soldier.w / 2, soldier.y + soldier.h);
  const facing = soldier.facing || 1;
  ctx.scale(facing, 1);
  if (soldier.kind === 'shield') ctx.scale(1.12, 1.12);
  const presentationState = soldier.presentation?.state;
  if (presentationState === 'landing') {
    ctx.translate(0, 4);
    ctx.scale(1.06, .9);
  } else if (presentationState === 'anticipation') ctx.rotate(-.075);
  else if (presentationState === 'contact') ctx.translate(8, -1);
  else if (presentationState === 'recovery') ctx.rotate(.045);
  else if (presentationState === 'hit') {
    ctx.translate(-7, 0);
    ctx.rotate(.09);
  }
  if ((soldier.raidMember || soldier.readableMelee) && soldier.mode !== 'para') {
    const phase = soldier.attackPhase;
    if (phase === 'windup') {
      const progress = 1 - Math.max(0, soldier.attackClock) / Math.max(.01, soldier.telegraphSeconds);
      ctx.save();
      ctx.strokeStyle = '#f17a55';
      ctx.fillStyle = 'rgba(241,122,85,.12)';
      ctx.shadowColor = '#ef654c';
      ctx.shadowBlur = 12 + progress * 14;
      ctx.lineWidth = 3 + progress * 2;
      ctx.beginPath();
      ctx.moveTo(11, -40);
      ctx.lineTo(34 + progress * 20, -30);
      ctx.lineTo(14, -16);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(24, 1);
      ctx.quadraticCurveTo(42, -11, 63 + (soldier.kind === 'spear' ? 25 : 0), 1);
      ctx.stroke();
      ctx.restore();
    } else if (phase === 'active') {
      ctx.save();
      ctx.strokeStyle = '#fff0b0';
      ctx.shadowColor = '#f06d50';
      ctx.shadowBlur = 20;
      ctx.lineWidth = 7;
      ctx.beginPath();
      ctx.arc(18, -25, soldier.kind === 'spear' ? 74 : 52, -.65, .55);
      ctx.stroke();
      ctx.restore();
    } else if (phase === 'landing' || phase === 'recovery' || phase === 'stun' || phase === 'guard') {
      ctx.save();
      ctx.strokeStyle = phase === 'stun' && !soldier.raidMember
        ? '#ffe091'
        : phase === 'guard' ? '#d4eeff' : '#86e1eb';
      ctx.globalAlpha = .75;
      ctx.lineWidth = phase === 'guard' ? 5 : 3;
      ctx.setLineDash([8, 7]);
      ctx.beginPath();
      ctx.arc(0, -25, 28, -.2, Math.PI + .2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(-12, -66);
      ctx.lineTo(0, -58);
      ctx.lineTo(12, -66);
      ctx.stroke();
      ctx.restore();
    }
  }
  if (veilRaiderSheet && soldier.raidMember) {
    ctx.shadowColor = presentationState === 'hit' ? '#8eeeff' : 'rgba(239,184,90,.38)';
    ctx.shadowBlur = presentationState === 'hit' ? 22 : 9;
    drawSpriteFrame(ctx, veilRaiderSheet, VEIL_RAIDER_SHEET, getVeilRaiderFrame(soldier));
    ctx.shadowBlur = 0;
    if (soldier.maxHp > 1) {
      ctx.fillStyle = 'rgba(4,7,15,.78)';
      ctx.fillRect(-18, -79, 36, 5);
      ctx.fillStyle = '#f0c767';
      ctx.fillRect(-18, -79, 36 * Math.max(0, soldier.hp / soldier.maxHp), 5);
    }
    ctx.restore();
    return;
  }
  if (soldier.mode === 'para') {
    ctx.strokeStyle = 'rgba(210,220,235,.7)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-8, -47); ctx.lineTo(-25, -78);
    ctx.moveTo(8, -47); ctx.lineTo(25, -78);
    ctx.stroke();
    ctx.fillStyle = '#12182a';
    ctx.beginPath();
    ctx.arc(0, -79, 30, Math.PI, 0);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#a78342';
    ctx.stroke();
  }
  const strideClock = soldier.presentation?.clock ?? time;
  const moving = soldier.mode === 'walk' && (!presentationState
    || presentationState === 'advance' || presentationState === 'backpedal');
  const strideDirection = presentationState === 'backpedal' ? -1 : 1;
  const stride = moving ? Math.sin(strideClock * 10 + soldier.x * .04) * 5 * strideDirection : 0;
  ctx.strokeStyle = '#1a2237';
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.moveTo(-5, -20); ctx.lineTo(-7 + stride, 0);
  ctx.moveTo(5, -20); ctx.lineTo(8 - stride, 0);
  ctx.stroke();
  ctx.fillStyle = soldier.kind === 'shield' ? '#45374a' : soldier.kind === 'spear' ? '#253b4d' : '#202a42';
  roundRect(ctx, -12, -45, 24, 28, 5); ctx.fill();
  ctx.fillStyle = '#0a0d17';
  ctx.beginPath(); ctx.arc(0, -51, 10, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#f07856';
  ctx.shadowColor = '#ef5d45'; ctx.shadowBlur = 10;
  ctx.fillRect(1, -54, 7, 2);
  ctx.shadowBlur = 0;
  if (soldier.kind === 'shield') {
    ctx.fillStyle = '#30384c';
    ctx.strokeStyle = '#c99d4d';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(18, -29, 13, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  } else if (soldier.kind === 'spear') {
    ctx.strokeStyle = '#c5cdd4'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(5, -36); ctx.lineTo(48, -25); ctx.stroke();
    ctx.fillStyle = '#e8c56a';
    ctx.beginPath(); ctx.moveTo(48, -25); ctx.lineTo(38, -31); ctx.lineTo(40, -21); ctx.closePath(); ctx.fill();
  } else {
    ctx.strokeStyle = '#9b8759'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(9, -36); ctx.lineTo(27, -29); ctx.stroke();
    if (soldier.kind === 'archer') {
      ctx.strokeStyle = '#dfb75c'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(25, -29, 9, -1.1, 1.1); ctx.stroke();
    }
  }
  if ((soldier.raidMember || soldier.readableMelee) && soldier.maxHp > 1) {
    ctx.fillStyle = 'rgba(4,7,15,.72)';
    ctx.fillRect(-15, -70, 30, 4);
    ctx.fillStyle = '#f0c767';
    ctx.fillRect(-15, -70, 30 * Math.max(0, soldier.hp / soldier.maxHp), 4);
  }
  ctx.restore();
}

export function drawProjectile(ctx, projectile) {
  ctx.save();
  ctx.translate(projectile.x, projectile.y);
  ctx.scale(projectile.vx < 0 ? -1 : 1, 1);
  ctx.strokeStyle = '#d8e0e5';
  ctx.lineWidth = 2;
  ctx.shadowColor = '#e8c56a';
  ctx.shadowBlur = 8;
  ctx.beginPath();
  ctx.moveTo(-10, 0);
  ctx.lineTo(10, 0);
  ctx.stroke();
  ctx.fillStyle = '#e8c56a';
  ctx.beginPath();
  ctx.moveTo(12, 0);
  ctx.lineTo(5, -4);
  ctx.lineTo(5, 4);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

export function drawHero(ctx, player, time, heroSheet) {
  if (heroSheet) {
    const running = player.grounded && Math.abs(player.vx) > 25;
    const state = player.presentation?.state || '';
    const pose = player.attackTimer > 0 || state.startsWith('attack-') ? 'attack'
      : player.digTimer > 0 ? 'dig'
        : player.climbing || state === 'climb' || (!player.grounded && player.wallSide) ? 'climb'
          : !player.grounded || state === 'airborne' ? 'jump'
            : running || state === 'advance' || state === 'backpedal' ? 'run'
              : 'idle';
    const frame = getHeroPoseFrame(pose);
    const { col, row, size: drawSize, anchorX, anchorY } = frame;
    const presentationClock = player.presentation?.clock ?? time;
    const presentationEnabled = Boolean(player.combatPresentationEnabled);
    const legacyOffsetX = pose === 'attack' || pose === 'run' ? -2 : 0;
    const legacyOffsetY = pose === 'idle' ? 7
      : pose === 'run' ? 4 - Math.abs(Math.sin(time * 15)) * 2
        : pose === 'jump' ? 1
          : pose === 'dig' ? 4
            : pose === 'climb' ? 2
              : 0;
    const offsetY = presentationEnabled && pose === 'run'
      ? -Math.abs(Math.sin(presentationClock * 15)) * 2
      : 0;
    const cellW = heroSheet.width / 3;
    const cellH = heroSheet.height / 2;
    ctx.save();
    ctx.translate(player.x + player.w / 2, player.y + player.h);
    ctx.scale(player.facing, 1);
    if (state === 'hit') {
      ctx.translate(-6, 0);
      ctx.rotate(.075);
    } else if (state === 'guard') ctx.rotate(-.035);
    if (player.invuln > 0 && Math.floor(player.invuln * 12) % 2 === 0) ctx.globalAlpha = .34;

    ctx.fillStyle = 'rgba(0,0,0,.32)';
    ctx.beginPath();
    ctx.ellipse(0, 2, 29, 7, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.imageSmoothingEnabled = true;
    ctx.shadowColor = player.attackTimer > 0 ? '#f3c861' : 'rgba(81,156,220,.42)';
    ctx.shadowBlur = player.attackTimer > 0 ? 15 : 5;
    ctx.drawImage(
      heroSheet,
      col * cellW,
      row * cellH,
      cellW,
      cellH,
      presentationEnabled ? -drawSize * anchorX : -drawSize / 2 + legacyOffsetX,
      presentationEnabled ? -drawSize * anchorY + offsetY : -drawSize + legacyOffsetY,
      drawSize,
      drawSize,
    );
    if (player.guarding) {
      ctx.strokeStyle = '#9cefff';
      ctx.shadowColor = '#66d9ee';
      ctx.shadowBlur = 14;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(9, -43, 35, -1.35, 1.35);
      ctx.stroke();
    }
    ctx.imageSmoothingEnabled = false;
    ctx.restore();
    return;
  }

  ctx.save();
  ctx.translate(player.x + player.w / 2, player.y + player.h);
  ctx.scale(player.facing, 1);
  if (player.invuln > 0 && Math.floor(player.invuln * 12) % 2 === 0) ctx.globalAlpha = .38;
  const running = player.grounded && Math.abs(player.vx) > 25;
  const stride = running ? Math.sin(time * 15) * 7 : 0;
  const lean = Math.max(-.12, Math.min(.12, player.vx / 1800));
  ctx.rotate(lean);

  ctx.fillStyle = 'rgba(0,0,0,.25)';
  ctx.beginPath(); ctx.ellipse(0, 2, 28, 7, 0, 0, Math.PI * 2); ctx.fill();

  ctx.strokeStyle = '#121729';
  ctx.lineWidth = 8;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-7, -31); ctx.lineTo(-10 + stride, -4);
  ctx.moveTo(7, -31); ctx.lineTo(10 - stride, -4);
  ctx.stroke();

  const cloak = ctx.createLinearGradient(-24, -75, 22, -20);
  cloak.addColorStop(0, '#f0c56a');
  cloak.addColorStop(.42, '#9c612d');
  cloak.addColorStop(1, '#3e2630');
  ctx.fillStyle = cloak;
  ctx.beginPath();
  ctx.moveTo(-18, -70);
  ctx.quadraticCurveTo(-27 - Math.abs(player.vx) * .025, -49, -22 - Math.abs(player.vx) * .06, -14);
  ctx.quadraticCurveTo(-2, -25, 20, -18);
  ctx.lineTo(17, -66);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#20263a';
  roundRect(ctx, -15, -67, 30, 38, 7); ctx.fill();
  ctx.strokeStyle = '#b28b45'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(-12, -58); ctx.lineTo(13, -39); ctx.stroke();

  ctx.fillStyle = '#bd8243';
  ctx.beginPath();
  ctx.moveTo(-17, -70); ctx.quadraticCurveTo(0, -91, 18, -70); ctx.lineTo(12, -55); ctx.lineTo(-13, -55); ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#080b14';
  ctx.beginPath(); ctx.ellipse(4, -67, 10, 8, 0, 0, Math.PI * 2); ctx.fill();

  const attacking = player.attackTimer > 0;
  if (attacking) {
    const p = 1 - player.attackTimer / .32;
    ctx.save();
    ctx.rotate(-1.8 + p * 2.7);
    ctx.strokeStyle = '#dde8ef'; ctx.lineWidth = 4;
    ctx.shadowColor = '#f6c75e'; ctx.shadowBlur = 14;
    ctx.beginPath(); ctx.moveTo(8, -52); ctx.lineTo(63, -52); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,210,104,.45)'; ctx.lineWidth = 12;
    ctx.beginPath(); ctx.arc(8, -52, 58, -1.25, .5); ctx.stroke();
    ctx.restore();
  } else {
    ctx.strokeStyle = '#d9e1e5'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(10, -43); ctx.lineTo(39, -16); ctx.stroke();
  }

  if (player.digTimer > 0) {
    ctx.strokeStyle = '#75d8ff'; ctx.shadowColor = '#50c9ff'; ctx.shadowBlur = 13; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(8, -45); ctx.lineTo(39, -61); ctx.stroke();
  }
  if (player.guarding) {
    ctx.strokeStyle = '#9cefff';
    ctx.shadowColor = '#66d9ee';
    ctx.shadowBlur = 14;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(9, -43, 35, -1.35, 1.35);
    ctx.stroke();
  }
  ctx.restore();
}

export function drawCombatEvents(ctx, events = [], time = 0, assets = {}) {
  for (const event of events) {
    const duration = Math.max(.001, event.expiresAt - event.createdAt);
    const progress = Math.max(0, Math.min(1, (time - event.createdAt) / duration));
    const fade = 1 - progress;
    const direction = event.facing || 1;
    if (event.type === 'defeat' && event.actorKind === 'veil-raider'
      && assets.veilRaider && Number.isFinite(event.feetY)) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, fade * .9);
      ctx.translate(event.x || 0, event.feetY);
      ctx.scale(direction, 1);
      ctx.translate(progress * -10, progress * 5);
      ctx.rotate(direction * progress * -.08);
      ctx.shadowColor = '#8eeeff';
      ctx.shadowBlur = 18 * fade;
      drawSpriteFrame(
        ctx,
        assets.veilRaider,
        VEIL_RAIDER_SHEET,
        VEIL_RAIDER_SHEET.frames.defeat,
      );
      ctx.restore();
    }
    ctx.save();
    ctx.globalAlpha = fade * (event.type === 'anticipation' ? .55 : .82);
    ctx.translate(event.x || 0, event.y || 0);
    ctx.scale(direction, 1);
    if (event.type === 'anticipation') {
      ctx.strokeStyle = '#ef7958';
      ctx.lineWidth = 2 + progress * 2;
      ctx.setLineDash([7, 6]);
      ctx.beginPath();
      ctx.arc(5, 0, 23 + progress * 9, -1.1, 1.1);
      ctx.stroke();
      ctx.setLineDash([]);
    } else if (event.type === 'contact-window') {
      ctx.strokeStyle = '#ffe49a';
      ctx.shadowColor = '#ef784f';
      ctx.shadowBlur = 14;
      ctx.lineWidth = 5 * fade + 2;
      ctx.beginPath();
      ctx.arc(10, 0, 24 + progress * 26, -.7, .7);
      ctx.stroke();
    } else if (event.type === 'guard' || event.type === 'parry' || event.type === 'guard-break') {
      ctx.strokeStyle = event.type === 'guard-break' ? '#f29162' : '#91efff';
      ctx.lineWidth = event.type === 'parry' ? 5 : 3;
      ctx.beginPath();
      ctx.arc(0, 0, 15 + progress * 27, 0, Math.PI * 2);
      ctx.stroke();
    } else if (event.type === 'hit' || event.type === 'hurt' || event.type === 'defeat') {
      ctx.strokeStyle = event.type === 'hurt' ? '#ed765f' : event.type === 'defeat' ? '#efffff' : '#f4ce70';
      ctx.lineWidth = event.type === 'defeat' ? 6 : 4;
      const radius = 10 + progress * (event.type === 'defeat' ? 48 : 28);
      ctx.beginPath();
      ctx.moveTo(-radius, 0); ctx.lineTo(radius, 0);
      ctx.moveTo(0, -radius); ctx.lineTo(0, radius);
      ctx.stroke();
    }
    ctx.restore();
  }
}

export function drawParticles(ctx, particles) {
  for (const p of particles) {
    ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}
