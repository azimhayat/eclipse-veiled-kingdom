export const VIEW_W = 960;
export const VIEW_H = 540;
export const TILE = 48;
export const WORLD_COLS = 90;
export const WORLD_ROWS = 28;
export const WORLD_W = WORLD_COLS * TILE;
export const WORLD_H = WORLD_ROWS * TILE;
export const CHUNK_COLS = 20;
export const CHUNK_W = CHUNK_COLS * TILE;
export const CHUNK_COUNT = 5;

export const Tile = Object.freeze({
  AIR: 0,
  STONE: 1,
  SAND: 2,
  SPIKE: 3,
  ONEWAY: 4,
  CRUMBLE: 5,
  GLOW: 6,
  GATE: 7,
  CRYSTAL: 8,
});

const emptyMap = () => Array.from({ length: WORLD_ROWS }, () => Array(WORLD_COLS).fill(Tile.AIR));

function put(map, x, y, tile) {
  if (x >= 0 && x < WORLD_COLS && y >= 0 && y < WORLD_ROWS) map[y][x] = tile;
}

function fill(map, x, y, w, h, tile) {
  for (let yy = y; yy < y + h; yy += 1) {
    for (let xx = x; xx < x + w; xx += 1) put(map, xx, yy, tile);
  }
}

function baseKingdom() {
  const map = emptyMap();
  fill(map, 0, 26, WORLD_COLS, 1, Tile.STONE);
  fill(map, 0, 12, 2, 14, Tile.STONE);
  fill(map, 89, 8, 1, 18, Tile.STONE);
  return map;
}

function spikePit(map, x, width) {
  fill(map, x, 26, width, 1, Tile.SPIKE);
}

function staircase(map) {
  fill(map, 72, 24, 5, 2, Tile.STONE);
  fill(map, 75, 22, 5, 4, Tile.STONE);
  fill(map, 78, 20, 5, 6, Tile.STONE);
  fill(map, 81, 18, 5, 8, Tile.STONE);
  fill(map, 85, 16, 4, 10, Tile.GLOW);
  fill(map, 85, 10, 4, 6, Tile.AIR);
}

function outerVeil() {
  const map = baseKingdom();
  spikePit(map, 11, 3);

  fill(map, 16, 21, 6, 5, Tile.SAND);
  fill(map, 15, 20, 8, 1, Tile.ONEWAY);

  fill(map, 47, 17, 1, 9, Tile.GATE);
  spikePit(map, 49, 2);
  spikePit(map, 54, 14);
  fill(map, 54, 24, 3, 1, Tile.CRUMBLE);
  fill(map, 58, 23, 3, 1, Tile.CRUMBLE);
  fill(map, 62, 24, 3, 1, Tile.CRUMBLE);
  fill(map, 66, 22, 3, 1, Tile.CRUMBLE);
  fill(map, 69, 24, 3, 1, Tile.ONEWAY);
  staircase(map);

  return {
    id: 1,
    name: 'The Outer Veil',
    map,
    spawn: { x: 6 * TILE + 10, y: 26 * TILE - 44 },
    checkpoints: [
      { x: 52 * TILE, spawnX: 52 * TILE, spawnY: 26 * TILE - 44, label: 'Gate sanctum' },
      { x: 70 * TILE, spawnX: 70 * TILE, spawnY: 26 * TILE - 44, label: 'Arena sanctum' },
    ],
    relics: [
      { id: 'sand-crown', x: 19.2 * TILE, y: 18.9 * TILE },
      { id: 'high-stair', x: 83.5 * TILE, y: 16.9 * TILE },
      { id: 'arena-floor', x: 73.4 * TILE, y: 22.9 * TILE },
    ],
    block: { x: 36 * TILE + 4, y: 26 * TILE - 40, w: 40, h: 40 },
    plate: { x: 40 * TILE, y: 26 * TILE - 10, w: TILE, h: 10 },
    gateColumn: 47,
    door: { x: 86 * TILE, y: 12 * TILE, w: 96, h: 160 },
    ships: [71.5, 77.5, 83].map((x, i) => ({ x: x * TILE, y: (6.2 + i * .75) * TILE, phase: i * 2.1 })),
  };
}

function innerKingdom() {
  const map = baseKingdom();
  spikePit(map, 8, 3);
  fill(map, 13, 21, 5, 5, Tile.SAND);
  fill(map, 12, 20, 7, 1, Tile.ONEWAY);

  spikePit(map, 23, 5);
  fill(map, 23, 23, 2, 1, Tile.CRUMBLE);
  fill(map, 26, 21, 2, 1, Tile.CRUMBLE);
  fill(map, 36, 16, 1, 10, Tile.GATE);

  fill(map, 42, 18, 5, 8, Tile.SAND);
  fill(map, 41, 17, 7, 1, Tile.ONEWAY);
  spikePit(map, 50, 15);
  fill(map, 50, 23, 3, 1, Tile.CRUMBLE);
  fill(map, 54, 21, 3, 1, Tile.CRUMBLE);
  fill(map, 58, 23, 3, 1, Tile.CRUMBLE);
  fill(map, 62, 20, 3, 1, Tile.CRUMBLE);
  fill(map, 65, 23, 3, 1, Tile.ONEWAY);

  fill(map, 68, 24, 5, 2, Tile.STONE);
  staircase(map);

  return {
    id: 2,
    name: 'The Inner Kingdom',
    map,
    spawn: { x: 5 * TILE + 10, y: 26 * TILE - 44 },
    checkpoints: [
      { x: 39 * TILE, spawnX: 39 * TILE, spawnY: 26 * TILE - 44, label: 'Inner gate sanctum' },
      { x: 68 * TILE, spawnX: 68 * TILE, spawnY: 26 * TILE - 44, label: 'Royal sanctum' },
    ],
    relics: [
      { id: 'inner-sand', x: 15.2 * TILE, y: 18.9 * TILE },
      { id: 'mid-vault', x: 44.2 * TILE, y: 15.9 * TILE },
      { id: 'inner-stair', x: 83.5 * TILE, y: 16.9 * TILE },
    ],
    block: { x: 30 * TILE + 4, y: 26 * TILE - 40, w: 40, h: 40 },
    plate: { x: 34 * TILE, y: 26 * TILE - 10, w: TILE, h: 10 },
    gateColumn: 36,
    door: { x: 86 * TILE, y: 12 * TILE, w: 96, h: 160 },
    ships: [69.5, 76.5, 83].map((x, i) => ({ x: x * TILE, y: (6 + i * .7) * TILE, phase: i * 1.8 })),
  };
}

function campaignLevel({
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

function sunderedAqueduct() {
  return campaignLevel({
    id: 3,
    name: 'The Sundered Aqueduct',
    mechanic: 'Swim against the ancient current and ride the broken sluice lifts.',
    theme: { top: '#102d46', bottom: '#071625', haze: '#3f99b5', accent: '#77d9e8' },
    blockX: 32, plateX: 36, gateX: 42, arenaStart: 66,
    setup(map) {
      fill(map, 9, 26, 5, 1, Tile.AIR);
      fill(map, 9, 27, 5, 1, Tile.STONE);
      fill(map, 16, 21, 5, 5, Tile.SAND);
      fill(map, 15, 20, 7, 1, Tile.ONEWAY);
      spikePit(map, 24, 4);
      fill(map, 25, 23, 2, 1, Tile.CRUMBLE);
      fill(map, 46, 26, 17, 1, Tile.AIR);
      fill(map, 46, 27, 17, 1, Tile.STONE);
      fill(map, 46, 23, 3, 1, Tile.ONEWAY);
      fill(map, 52, 21, 3, 1, Tile.ONEWAY);
      fill(map, 59, 23, 4, 1, Tile.ONEWAY);
      spikePit(map, 66, 3);
    },
    relics: [
      { id: 'sluice-crown', x: 18.4 * TILE, y: 18.9 * TILE },
      { id: 'aqueduct-rise', x: 83.4 * TILE, y: 16.9 * TILE },
      { id: 'drowned-seal', x: 62.2 * TILE, y: 22.1 * TILE },
    ],
    water: [
      { x: 8.5 * TILE, y: 21 * TILE, w: 6 * TILE, h: 5 * TILE, currentX: 75 },
      { x: 45.5 * TILE, y: 18 * TILE, w: 18 * TILE, h: 8 * TILE, currentX: -95 },
    ],
    movers: [
      { x: 48 * TILE, y: 20 * TILE, w: 2.5 * TILE, h: 14, axis: 'y', range: 100, speed: 1.05, phase: 0 },
      { x: 56 * TILE, y: 19 * TILE, w: 2.5 * TILE, h: 14, axis: 'y', range: 120, speed: .85, phase: 2 },
    ],
  });
}

function buriedFoundry() {
  return campaignLevel({
    id: 4,
    name: 'The Buried Foundry',
    mechanic: 'Read the furnace rhythm, ride chain lifts, and cross between crushing pistons.',
    theme: { top: '#32151a', bottom: '#130b13', haze: '#c64f2f', accent: '#ff9a4c' },
    blockX: 31, plateX: 35, gateX: 41, arenaStart: 65,
    setup(map) {
      spikePit(map, 10, 4);
      fill(map, 16, 21, 4, 5, Tile.SAND);
      fill(map, 15, 20, 6, 1, Tile.ONEWAY);
      spikePit(map, 22, 5);
      fill(map, 23, 23, 2, 1, Tile.CRUMBLE);
      spikePit(map, 44, 17);
      fill(map, 44, 24, 3, 1, Tile.CRUMBLE);
      fill(map, 50, 22, 3, 1, Tile.CRUMBLE);
      fill(map, 57, 20, 4, 1, Tile.ONEWAY);
      spikePit(map, 65, 3);
    },
    relics: [
      { id: 'forge-ember', x: 18 * TILE, y: 18.8 * TILE },
      { id: 'foundry-crown', x: 83.4 * TILE, y: 16.9 * TILE },
      { id: 'piston-heart', x: 62.8 * TILE, y: 23.2 * TILE },
    ],
    movers: [
      { x: 47 * TILE, y: 21 * TILE, w: 2.6 * TILE, h: 14, axis: 'y', range: 120, speed: 1.2, phase: .4 },
      { x: 54 * TILE, y: 20 * TILE, w: 2.6 * TILE, h: 14, axis: 'x', range: 82, speed: 1, phase: 1.7 },
    ],
    crushers: [
      { x: 24 * TILE, y: 16 * TILE, w: 1.4 * TILE, h: 4.5 * TILE, axis: 'y', range: 150, speed: 1.35, phase: 0 },
      { x: 53 * TILE, y: 14 * TILE, w: 1.5 * TILE, h: 5 * TILE, axis: 'y', range: 190, speed: 1.05, phase: 2.1 },
      { x: 64 * TILE, y: 17 * TILE, w: 1.3 * TILE, h: 4 * TILE, axis: 'y', range: 120, speed: 1.55, phase: 1 },
    ],
  });
}

function gardensOfGlass() {
  return campaignLevel({
    id: 5,
    name: 'The Gardens of Glass',
    mechanic: 'Crystal terraces shatter beneath you; commit to every landing.',
    theme: { top: '#182b45', bottom: '#160f2a', haze: '#9f79c8', accent: '#aeeeff' },
    blockX: 32, plateX: 36, gateX: 42, arenaStart: 67,
    setup(map) {
      spikePit(map, 9, 5);
      fill(map, 10, 23, 2, 1, Tile.CRYSTAL);
      fill(map, 15, 21, 5, 5, Tile.SAND);
      fill(map, 14, 20, 7, 1, Tile.CRYSTAL);
      spikePit(map, 23, 5);
      fill(map, 23, 24, 2, 1, Tile.CRYSTAL);
      fill(map, 26, 22, 2, 1, Tile.CRYSTAL);
      spikePit(map, 45, 20);
      fill(map, 45, 24, 3, 1, Tile.CRYSTAL);
      fill(map, 49, 22, 3, 1, Tile.CRYSTAL);
      fill(map, 53, 20, 3, 1, Tile.CRYSTAL);
      fill(map, 57, 22, 3, 1, Tile.CRYSTAL);
      fill(map, 61, 19, 4, 1, Tile.CRYSTAL);
    },
    relics: [
      { id: 'glass-seed', x: 17.5 * TILE, y: 18.6 * TILE },
      { id: 'prism-crown', x: 83.4 * TILE, y: 16.9 * TILE },
      { id: 'shard-heart', x: 66.2 * TILE, y: 23.4 * TILE },
    ],
    movers: [
      { x: 47 * TILE, y: 20 * TILE, w: 2 * TILE, h: 12, axis: 'x', range: 70, speed: 1.25, phase: 0 },
    ],
  });
}

function hollowBarracks() {
  return campaignLevel({
    id: 6,
    name: 'The Hollow Barracks',
    mechanic: 'Break the occupation: shield lines, fast drops, and crossfire on narrow ground.',
    theme: { top: '#1c2334', bottom: '#0b0c14', haze: '#9d3e35', accent: '#f07856' },
    blockX: 29, plateX: 33, gateX: 39, arenaStart: 42, spawnEvery: 1.45, maxEnemies: 10,
    setup(map) {
      spikePit(map, 10, 3);
      fill(map, 15, 21, 5, 5, Tile.SAND);
      fill(map, 14, 20, 7, 1, Tile.ONEWAY);
      spikePit(map, 21, 4);
      fill(map, 22, 23, 2, 1, Tile.CRUMBLE);
      spikePit(map, 43, 5);
      fill(map, 44, 22, 3, 1, Tile.ONEWAY);
      spikePit(map, 53, 4);
      fill(map, 54, 21, 2, 1, Tile.CRUMBLE);
      fill(map, 60, 23, 7, 3, Tile.STONE);
      spikePit(map, 68, 2);
    },
    relics: [
      { id: 'barracks-mark', x: 17.4 * TILE, y: 18.9 * TILE },
      { id: 'captains-oath', x: 83.4 * TILE, y: 16.9 * TILE },
      { id: 'siege-token', x: 65 * TILE, y: 21.8 * TILE },
    ],
    movers: [
      { x: 47 * TILE, y: 20 * TILE, w: 2.5 * TILE, h: 14, axis: 'x', range: 90, speed: 1.1, phase: 1 },
    ],
  });
}

function observatoryOfMirrors() {
  return campaignLevel({
    id: 7,
    name: 'Observatory of Mirrors',
    mechanic: 'Align the golden sightline and carry its light through the ruined observatory.',
    theme: { top: '#172447', bottom: '#090c1d', haze: '#d9b85c', accent: '#fff1a9' },
    blockX: 31, plateX: 37, gateX: 43, arenaStart: 67,
    setup(map) {
      spikePit(map, 9, 4);
      fill(map, 15, 21, 5, 5, Tile.SAND);
      fill(map, 14, 20, 7, 1, Tile.ONEWAY);
      fill(map, 24, 23, 5, 3, Tile.GLOW);
      spikePit(map, 46, 16);
      fill(map, 46, 24, 3, 1, Tile.ONEWAY);
      fill(map, 51, 21, 3, 1, Tile.GLOW);
      fill(map, 56, 23, 3, 1, Tile.ONEWAY);
      fill(map, 61, 20, 3, 1, Tile.GLOW);
      spikePit(map, 66, 3);
    },
    relics: [
      { id: 'sun-fragment', x: 17.4 * TILE, y: 18.9 * TILE },
      { id: 'zenith-lens', x: 83.4 * TILE, y: 16.9 * TILE },
      { id: 'mirror-eye', x: 65.5 * TILE, y: 22.8 * TILE },
    ],
    mirrors: [
      { x: 25.5 * TILE, y: 21.7 * TILE, angle: -.65 },
      { x: 52.2 * TILE, y: 19.7 * TILE, angle: .45 },
      { x: 62.2 * TILE, y: 18.7 * TILE, angle: -.35 },
    ],
    movers: [
      { x: 48 * TILE, y: 20 * TILE, w: 2.4 * TILE, h: 13, axis: 'y', range: 92, speed: .9, phase: .8 },
    ],
  });
}

function shiftingSepulchre() {
  return campaignLevel({
    id: 8,
    name: 'The Shifting Sepulchre',
    mechanic: 'Veil bridges alternate between light and shadow. Move with their pulse.',
    theme: { top: '#241840', bottom: '#070816', haze: '#7052a6', accent: '#c4a1ff' },
    blockX: 31, plateX: 35, gateX: 41, arenaStart: 66,
    setup(map) {
      spikePit(map, 9, 4);
      fill(map, 15, 21, 5, 5, Tile.SAND);
      fill(map, 14, 20, 7, 1, Tile.ONEWAY);
      spikePit(map, 23, 5);
      fill(map, 24, 22, 2, 1, Tile.CRUMBLE);
      spikePit(map, 44, 21);
      fill(map, 65, 23, 2, 1, Tile.ONEWAY);
    },
    relics: [
      { id: 'shadow-name', x: 17.4 * TILE, y: 18.9 * TILE },
      { id: 'veil-crown', x: 83.4 * TILE, y: 16.9 * TILE },
      { id: 'sepulchre-key', x: 64.6 * TILE, y: 21.8 * TILE },
    ],
    veilPlatforms: [
      { x: 44 * TILE, y: 23 * TILE, w: 3 * TILE, h: 14, phase: 0 },
      { x: 48 * TILE, y: 20 * TILE, w: 3 * TILE, h: 14, phase: 1 },
      { x: 52 * TILE, y: 23 * TILE, w: 3 * TILE, h: 14, phase: 0 },
      { x: 56 * TILE, y: 19 * TILE, w: 3 * TILE, h: 14, phase: 1 },
      { x: 60 * TILE, y: 22 * TILE, w: 3 * TILE, h: 14, phase: 0 },
    ],
  });
}

function crownUnderSiege() {
  return campaignLevel({
    id: 9,
    name: 'The Crown Under Siege',
    mechanic: 'Climb through the invasion while the route collapses beneath the assault.',
    theme: { top: '#2a1b28', bottom: '#0b0b16', haze: '#c2573b', accent: '#ffb35c' },
    blockX: 27, plateX: 31, gateX: 37, arenaStart: 20, spawnEvery: 1.25, maxEnemies: 11,
    setup(map) {
      spikePit(map, 8, 4);
      fill(map, 14, 21, 5, 5, Tile.SAND);
      fill(map, 13, 20, 7, 1, Tile.ONEWAY);
      spikePit(map, 21, 3);
      fill(map, 40, 24, 5, 2, Tile.STONE);
      fill(map, 44, 22, 5, 4, Tile.STONE);
      spikePit(map, 49, 17);
      fill(map, 49, 23, 3, 1, Tile.CRUMBLE);
      fill(map, 54, 20, 3, 1, Tile.CRUMBLE);
      fill(map, 59, 22, 3, 1, Tile.CRUMBLE);
      fill(map, 64, 19, 3, 1, Tile.ONEWAY);
    },
    relics: [
      { id: 'siege-banner', x: 16.4 * TILE, y: 18.9 * TILE },
      { id: 'crown-spark', x: 83.4 * TILE, y: 16.9 * TILE },
      { id: 'last-standard', x: 67.2 * TILE, y: 23.2 * TILE },
    ],
    movers: [
      { x: 51 * TILE, y: 20 * TILE, w: 2.4 * TILE, h: 13, axis: 'x', range: 92, speed: 1.3, phase: .4 },
      { x: 61 * TILE, y: 18 * TILE, w: 2.4 * TILE, h: 13, axis: 'y', range: 90, speed: 1.05, phase: 1.4 },
    ],
    crushers: [
      { x: 45 * TILE, y: 14 * TILE, w: 1.4 * TILE, h: 5 * TILE, axis: 'y', range: 170, speed: 1.2, phase: .5 },
    ],
  });
}

function throneOfEclipse() {
  return campaignLevel({
    id: 10,
    name: 'Throne of the Eclipse',
    mechanic: 'Claim the three royal seals and defeat the Veiled Guardian.',
    theme: { top: '#17152d', bottom: '#080610', haze: '#d5a33f', accent: '#ffe38a' },
    blockX: 29, plateX: 33, gateX: 39, arenaStart: 60, spawnEvery: 2, maxEnemies: 6,
    setup(map) {
      spikePit(map, 9, 4);
      fill(map, 15, 21, 5, 5, Tile.SAND);
      fill(map, 14, 20, 7, 1, Tile.ONEWAY);
      spikePit(map, 22, 4);
      fill(map, 23, 22, 2, 1, Tile.CRYSTAL);
      spikePit(map, 43, 15);
      fill(map, 43, 24, 3, 1, Tile.CRUMBLE);
      fill(map, 48, 21, 3, 1, Tile.CRYSTAL);
      fill(map, 53, 19, 4, 1, Tile.GLOW);
      fill(map, 59, 24, 10, 2, Tile.STONE);
      fill(map, 68, 22, 5, 4, Tile.STONE);
    },
    relics: [
      { id: 'royal-seal', x: 17.4 * TILE, y: 18.9 * TILE },
      { id: 'eclipse-crown', x: 83.4 * TILE, y: 16.9 * TILE },
      { id: 'guardian-brand', x: 69.8 * TILE, y: 20.8 * TILE },
    ],
    movers: [
      { x: 45 * TILE, y: 21 * TILE, w: 2.5 * TILE, h: 14, axis: 'y', range: 105, speed: 1.1, phase: 0 },
      { x: 52 * TILE, y: 18 * TILE, w: 2.5 * TILE, h: 14, axis: 'x', range: 80, speed: 1, phase: 1.2 },
    ],
    veilPlatforms: [
      { x: 57 * TILE, y: 21 * TILE, w: 2.5 * TILE, h: 14, phase: 0 },
      { x: 61 * TILE, y: 19 * TILE, w: 2.5 * TILE, h: 14, phase: 1 },
    ],
    boss: { x: 64 * TILE, y: 24 * TILE - 92, w: 64, h: 92, hp: 10, maxHp: 10, active: false, vx: 0 },
  });
}

export const createLevels = () => [
  outerVeil(),
  innerKingdom(),
  sunderedAqueduct(),
  buriedFoundry(),
  gardensOfGlass(),
  hollowBarracks(),
  observatoryOfMirrors(),
  shiftingSepulchre(),
  crownUnderSiege(),
  throneOfEclipse(),
];

export function cloneLevel(level) {
  return {
    ...level,
    map: level.map.map((row) => [...row]),
    relics: level.relics.map((relic) => ({ ...relic, collected: false })),
    block: { ...level.block, homeX: level.block.x, homeY: level.block.y, vx: 0, vy: 0 },
    plate: { ...level.plate },
    door: { ...level.door },
    ships: level.ships.map((ship) => ({ ...ship })),
    checkpoints: level.checkpoints.map((checkpoint) => ({ ...checkpoint })),
    movers: (level.movers || []).map((item) => ({ ...item, baseX: item.x, baseY: item.y, dx: 0, dy: 0 })),
    water: (level.water || []).map((item) => ({ ...item })),
    crushers: (level.crushers || []).map((item) => ({ ...item, baseX: item.x, baseY: item.y })),
    mirrors: (level.mirrors || []).map((item) => ({ ...item })),
    veilPlatforms: (level.veilPlatforms || []).map((item) => ({ ...item, active: item.phase === 0 })),
    boss: level.boss ? { ...level.boss } : null,
  };
}
