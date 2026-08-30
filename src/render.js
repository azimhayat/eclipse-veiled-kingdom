import { CHUNK_COLS, CHUNK_COUNT, CHUNK_W, TILE, Tile, VIEW_H, VIEW_W, WORLD_COLS, WORLD_H, WORLD_W } from './levels.js';

const roundRect = (ctx, x, y, w, h, r) => {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
};

function seeded(n) {
  const x = Math.sin(n * 91.731) * 43758.5453;
  return x - Math.floor(x);
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

export function bakeLevel(level) {
  const chunks = [];
  for (let chunkIndex = 0; chunkIndex < CHUNK_COUNT; chunkIndex += 1) {
    const canvas = document.createElement('canvas');
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
    chunks.push(canvas);
  }
  return chunks;
}

export async function bakeAllLevels(levels, onProgress) {
  const bank = new Map();
  let painted = 0;
  const total = levels.length * CHUNK_COUNT;
  for (const level of levels) {
    const chunks = [];
    for (let chunkIndex = 0; chunkIndex < CHUNK_COUNT; chunkIndex += 1) {
      const canvas = document.createElement('canvas');
      canvas.width = CHUNK_W;
      canvas.height = WORLD_H;
      const ctx = canvas.getContext('2d', { alpha: true });
      ctx.imageSmoothingEnabled = false;
      const firstCol = chunkIndex * CHUNK_COLS;
      for (let y = 0; y < level.map.length; y += 1) {
        for (let localX = 0; localX < CHUNK_COLS; localX += 1) {
          const worldX = firstCol + localX;
          if (worldX < WORLD_COLS) drawTile(ctx, level.map[y][worldX], localX * TILE, y * TILE, worldX * 37 + y * 73 + level.id * 101);
        }
      }
      chunks.push(canvas);
      painted += 1;
      onProgress?.(painted / total);
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }
    bank.set(level.id, chunks);
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

export function drawLevelMechanics(ctx, level, time, gateOpen) {
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
  ctx.save();
  ctx.translate(boss.x + boss.w / 2, boss.y + boss.h);
  const pulse = .7 + Math.sin(time * 3) * .25;
  ctx.fillStyle = 'rgba(0,0,0,.4)';
  ctx.beginPath(); ctx.ellipse(0, 3, 48, 12, 0, 0, Math.PI * 2); ctx.fill();
  ctx.shadowColor = '#d8a746';
  ctx.shadowBlur = 20 * pulse;
  const cloak = ctx.createLinearGradient(-40, -100, 35, -10);
  cloak.addColorStop(0, '#d0a044');
  cloak.addColorStop(.35, '#40314a');
  cloak.addColorStop(1, '#130f20');
  ctx.fillStyle = cloak;
  ctx.beginPath();
  ctx.moveTo(-27, -82);
  ctx.quadraticCurveTo(-52, -43, -42, 0);
  ctx.lineTo(42, 0);
  ctx.quadraticCurveTo(52, -47, 27, -82);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#111522';
  ctx.beginPath(); ctx.arc(0, -79, 26, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#f0c75d'; ctx.lineWidth = 5;
  ctx.beginPath(); ctx.arc(0, -79, 21, -.2, Math.PI * 1.15); ctx.stroke();
  ctx.fillStyle = '#ffda74';
  ctx.fillRect(7, -84, 9, 3);
  ctx.strokeStyle = '#c9d6e2'; ctx.lineWidth = 7;
  ctx.beginPath(); ctx.moveTo(23, -58); ctx.lineTo(70, -28); ctx.stroke();
  ctx.restore();

  const barW = 150;
  ctx.fillStyle = 'rgba(3,5,12,.8)';
  ctx.fillRect(boss.x + boss.w / 2 - barW / 2, boss.y - 24, barW, 8);
  ctx.fillStyle = '#e8c56a';
  ctx.fillRect(boss.x + boss.w / 2 - barW / 2, boss.y - 24, barW * (boss.hp / boss.maxHp), 8);
}

export function drawVisibleChunks(ctx, chunks, camera) {
  const first = Math.max(0, Math.floor(camera.x / CHUNK_W));
  const last = Math.min(CHUNK_COUNT - 1, Math.floor((camera.x + VIEW_W - 1) / CHUNK_W));
  for (let i = first; i <= last; i += 1) {
    const chunkWorldX = i * CHUNK_W;
    const visibleLeft = Math.max(camera.x, chunkWorldX);
    const visibleRight = Math.min(camera.x + VIEW_W, chunkWorldX + CHUNK_W, WORLD_W);
    const width = Math.max(0, visibleRight - visibleLeft);
    if (!width) continue;
    const sourceX = visibleLeft - chunkWorldX;
    const destX = visibleLeft - camera.x;
    ctx.drawImage(chunks[i], sourceX, camera.y, width, VIEW_H, destX, 0, width, VIEW_H);
  }
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
  ctx.shadowColor = active ? '#e8c56a' : 'transparent';
  ctx.shadowBlur = active ? 18 : 0;
  ctx.fillStyle = active ? '#e8c56a' : '#725e43';
  roundRect(ctx, plate.x, plate.y, plate.w, plate.h, 5);
  ctx.fill();
  ctx.strokeStyle = '#f5d47d';
  ctx.stroke();
  ctx.shadowBlur = 0;
  const grad = ctx.createLinearGradient(block.x, block.y, block.x + block.w, block.y + block.h);
  grad.addColorStop(0, '#596079');
  grad.addColorStop(.45, '#30384e');
  grad.addColorStop(1, '#151b2d');
  ctx.fillStyle = grad;
  roundRect(ctx, block.x, block.y, block.w, block.h, 5);
  ctx.fill();
  ctx.strokeStyle = '#b99247';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(block.x + block.w / 2, block.y + block.h / 2, 10, 0, Math.PI * 2);
  ctx.strokeStyle = '#d8b45d';
  ctx.stroke();
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

export function drawSoldier(ctx, soldier, time) {
  ctx.save();
  ctx.translate(soldier.x + soldier.w / 2, soldier.y + soldier.h);
  const facing = soldier.facing || 1;
  ctx.scale(facing, 1);
  if (soldier.kind === 'shield') ctx.scale(1.12, 1.12);
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
  const stride = soldier.mode === 'walk' ? Math.sin(time * 10 + soldier.x * .04) * 5 : 0;
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
    let col = 0;
    let row = 0;
    let drawSize = 142;
    let offsetX = 0;
    let offsetY = 7;

    if (player.attackTimer > 0) {
      col = 0;
      row = 1;
      drawSize = 156;
      offsetX = -2;
    } else if (player.digTimer > 0) {
      col = 1;
      row = 1;
      drawSize = 150;
      offsetY = 4;
    } else if (player.climbing) {
      col = 2;
      row = 1;
      drawSize = 146;
      offsetY = 2;
    } else if (!player.grounded) {
      col = 2;
      row = 0;
      drawSize = 150;
      offsetY = 1;
    } else if (running) {
      col = 1;
      row = 0;
      drawSize = 148;
      offsetX = -2;
      offsetY = 4 - Math.abs(Math.sin(time * 15)) * 2;
    }

    const cellW = heroSheet.width / 3;
    const cellH = heroSheet.height / 2;
    ctx.save();
    ctx.translate(player.x + player.w / 2, player.y + player.h);
    ctx.scale(player.facing, 1);
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
      -drawSize / 2 + offsetX,
      -drawSize + offsetY,
      drawSize,
      drawSize,
    );
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
  ctx.restore();
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
