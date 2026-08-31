import { TILE, Tile } from '../constants.js';
import { campaignLevel, fill, spikePit } from './shared.js';

export function createHollowBarracks() {
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
