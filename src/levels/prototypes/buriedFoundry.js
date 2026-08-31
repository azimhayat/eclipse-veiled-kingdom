import { TILE, Tile } from '../constants.js';
import { campaignLevel, fill, spikePit } from './shared.js';

export function createBuriedFoundry() {
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

