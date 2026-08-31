import { TILE, Tile } from '../constants.js';
import { campaignLevel, fill, spikePit } from './shared.js';

export function createShiftingSepulchre() {
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

