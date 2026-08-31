import { createBuriedFoundry } from './levels/prototypes/buriedFoundry.js';
import { createCrownUnderSiege } from './levels/prototypes/crownUnderSiege.js';
import { createGardensOfGlass } from './levels/prototypes/gardensOfGlass.js';
import { createHollowBarracks } from './levels/prototypes/hollowBarracks.js';
import { createInnerKingdom } from './levels/prototypes/innerKingdom.js';
import { createObservatoryOfMirrors } from './levels/prototypes/observatoryOfMirrors.js';
import { createOuterVeil } from './levels/prototypes/outerVeil.js';
import { createShiftingSepulchre } from './levels/prototypes/shiftingSepulchre.js';
import { createSunderedAqueduct } from './levels/prototypes/sunderedAqueduct.js';
import { createThroneOfEclipse } from './levels/prototypes/throneOfEclipse.js';
export { cloneLevel } from './levels/cloneLevel.js';

export {
  CHUNK_COLS,
  CHUNK_COUNT,
  CHUNK_W,
  TILE,
  Tile,
  VIEW_H,
  VIEW_W,
  WORLD_COLS,
  WORLD_H,
  WORLD_ROWS,
  WORLD_W,
} from './levels/constants.js';

export const createLevels = () => [
  createOuterVeil(),
  createInnerKingdom(),
  createSunderedAqueduct(),
  createBuriedFoundry(),
  createGardensOfGlass(),
  createHollowBarracks(),
  createObservatoryOfMirrors(),
  createShiftingSepulchre(),
  createCrownUnderSiege(),
  createThroneOfEclipse(),
];
