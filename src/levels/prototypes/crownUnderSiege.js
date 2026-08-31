import { TILE, Tile } from '../constants.js';
import { campaignLevel, fill, spikePit } from './shared.js';

export function createCrownUnderSiege() {
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

