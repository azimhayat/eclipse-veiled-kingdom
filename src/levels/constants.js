export const VIEW_W = 960;
export const VIEW_H = 540;
export const TILE = 48;
export const WORLD_COLS = 90;
export const WORLD_ROWS = 28;
export const WORLD_W = WORLD_COLS * TILE;
export const WORLD_H = WORLD_ROWS * TILE;
export const CHUNK_COLS = 20;
export const CHUNK_W = CHUNK_COLS * TILE;
export const CHUNK_COUNT = 5;

export const Tile = Object.freeze({
  AIR: 0,
  STONE: 1,
  SAND: 2,
  SPIKE: 3,
  ONEWAY: 4,
  CRUMBLE: 5,
  GLOW: 6,
  GATE: 7,
  CRYSTAL: 8,
});

