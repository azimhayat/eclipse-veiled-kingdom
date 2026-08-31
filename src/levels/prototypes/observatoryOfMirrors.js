import { TILE, Tile } from '../constants.js';
import { campaignLevel, fill, spikePit } from './shared.js';

export function createObservatoryOfMirrors() {
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

