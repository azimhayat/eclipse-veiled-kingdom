import { TILE, Tile } from '../constants.js';
import { campaignLevel, fill, spikePit } from './shared.js';

export function createThroneOfEclipse() {
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
