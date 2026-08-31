import { TILE, Tile, WORLD_COLS, WORLD_ROWS } from '../constants.js';

export const emptyMap = () => (
  Array.from({ length: WORLD_ROWS }, () => Array(WORLD_COLS).fill(Tile.AIR))
);

export function put(map, x, y, tile) {
  if (x >= 0 && x < WORLD_COLS && y >= 0 && y < WORLD_ROWS) map[y][x] = tile;
}

export function fill(map, x, y, w, h, tile) {
  for (let yy = y; yy < y + h; yy += 1) {
    for (let xx = x; xx < x + w; xx += 1) put(map, xx, yy, tile);
  }
}

export function baseKingdom() {
  const map = emptyMap();
  fill(map, 0, 26, WORLD_COLS, 1, Tile.STONE);
  fill(map, 0, 12, 2, 14, Tile.STONE);
  fill(map, 89, 8, 1, 18, Tile.STONE);
  return map;
}

export function spikePit(map, x, width) {
  fill(map, x, 26, width, 1, Tile.SPIKE);
}

export function staircase(map) {
  fill(map, 72, 24, 5, 2, Tile.STONE);
  fill(map, 75, 22, 5, 4, Tile.STONE);
  fill(map, 78, 20, 5, 6, Tile.STONE);
  fill(map, 81, 18, 5, 8, Tile.STONE);
  fill(map, 85, 16, 4, 10, Tile.GLOW);
  fill(map, 85, 10, 4, 6, Tile.AIR);
}

export function campaignLevel({
  id,
  name,
  mechanic,
  theme,
  setup,
  spawnX = 5,
  blockX = 31,
  plateX = 35,
  gateX = 41,
  arenaStart = 68,
  spawnEvery = 2.2,
  maxEnemies = 7,
  relics,
  movers = [],
  water = [],
  crushers = [],
  mirrors = [],
  veilPlatforms = [],
  boss = null,
}) {
  const map = baseKingdom();
  setup(map);
  fill(map, gateX, 16, 1, 10, Tile.GATE);
  staircase(map);
  return {
    id,
    name,
    mechanic,
    theme,
    map,
    spawn: { x: spawnX * TILE + 10, y: 26 * TILE - 44 },
    checkpoints: [
      { x: (gateX + 3) * TILE, spawnX: (gateX + 3) * TILE, spawnY: 26 * TILE - 44, label: `${name} sanctum` },
      { x: arenaStart * TILE, spawnX: arenaStart * TILE, spawnY: 26 * TILE - 44, label: 'Final approach sanctum' },
    ],
    relics,
    block: { x: blockX * TILE + 4, y: 26 * TILE - 40, w: 40, h: 40 },
    plate: { x: plateX * TILE, y: 26 * TILE - 10, w: TILE, h: 10 },
    gateColumn: gateX,
    door: { x: 86 * TILE, y: 12 * TILE, w: 96, h: 160 },
    ships: [70, 77, 83].map((x, i) => ({ x: x * TILE, y: (5.8 + i * .72) * TILE, phase: i * 1.9 + id })),
    arenaStart,
    spawnEvery,
    maxEnemies,
    movers,
    water,
    crushers,
    mirrors,
    veilPlatforms,
    boss,
  };
}
