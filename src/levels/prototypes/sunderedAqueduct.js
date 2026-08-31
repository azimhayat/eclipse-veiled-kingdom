import { TILE, Tile } from '../constants.js';
import { campaignLevel, fill, spikePit } from './shared.js';

export function createSunderedAqueduct() {
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

