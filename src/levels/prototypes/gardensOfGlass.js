import { TILE, Tile } from '../constants.js';
import { campaignLevel, fill, spikePit } from './shared.js';

export function createGardensOfGlass() {
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

