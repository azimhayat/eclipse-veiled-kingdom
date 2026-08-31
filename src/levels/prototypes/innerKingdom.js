import { TILE, Tile } from '../constants.js';
import { baseKingdom, fill, spikePit, staircase } from './shared.js';

export function createInnerKingdom() {
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
