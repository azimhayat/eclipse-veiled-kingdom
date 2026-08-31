import { TILE, Tile } from '../constants.js';
import { baseKingdom, fill, spikePit, staircase } from './shared.js';

export function createOuterVeil() {
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
    subtitle: 'Buried Dawn',
    storyLine: 'A kingdom erased from history calls its cartographer home.',
    backgroundKey: 'outerVeilBackground',
    map,
    spawn: { x: 6 * TILE + 10, y: 26 * TILE - 44 },
    checkpoints: [
      { x: 52 * TILE, spawnX: 52 * TILE, spawnY: 26 * TILE - 44, label: 'Gate sanctum' },
      { x: 70 * TILE, spawnX: 70 * TILE, spawnY: 26 * TILE - 44, label: 'Arena sanctum' },
    ],
    relics: [
      { id: 'sand-crown', label: 'Dawn Fragment', x: 19.2 * TILE, y: 18.9 * TILE },
      { id: 'high-stair', label: 'Cartographer Seal', x: 83.5 * TILE, y: 16.9 * TILE },
      { id: 'arena-floor', label: 'Oath Shard', x: 73.4 * TILE, y: 22.9 * TILE },
    ],
    block: { x: 36 * TILE + 4, y: 26 * TILE - 40, w: 40, h: 40 },
    plate: { x: 40 * TILE, y: 26 * TILE - 10, w: TILE, h: 10 },
    gateColumn: 47,
    door: { x: 86 * TILE, y: 12 * TILE, w: 96, h: 160 },
    ships: [71.5, 77.5, 83].map((x, i) => ({ x: x * TILE, y: (6.2 + i * .75) * TILE, phase: i * 2.1 })),
  };
}

