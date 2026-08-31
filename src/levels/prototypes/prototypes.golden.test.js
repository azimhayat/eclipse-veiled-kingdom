import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import * as levelsApi from '../../levels.js';
import { createLevels } from '../../levels.js';
import { createBuriedFoundry } from './buriedFoundry.js';
import { createCrownUnderSiege } from './crownUnderSiege.js';
import { createGardensOfGlass } from './gardensOfGlass.js';
import { createHollowBarracks } from './hollowBarracks.js';
import { createInnerKingdom } from './innerKingdom.js';
import { createObservatoryOfMirrors } from './observatoryOfMirrors.js';
import { createOuterVeil } from './outerVeil.js';
import { createShiftingSepulchre } from './shiftingSepulchre.js';
import { createSunderedAqueduct } from './sunderedAqueduct.js';
import { createThroneOfEclipse } from './throneOfEclipse.js';

const GOLDEN_LEVEL_DIGESTS = Object.freeze([
  'd5685272eac1f186bf3fd5d5883b44ad7b535673e54520f0e25d216763095ed1',
  'ecbdfadd9aa2e14771496db2756c2578b3f1e50c04369d05e5bfae20ed391f51',
  '291981950c8513147105ac8720922a2acc01326605595c9f55105a525b07a788',
  '6b56b047d295e832d15ebcbd471097d21959e66665fd5b17a5313e47654e4f2d',
  'db1101f350695b96a78d0558cfb965dd3d368e8ca5676e2629f293a49918fec4',
  '5fa520555d2f3ac1d22046bc67667c9a6db7fe65c64acb06391b80ed5fdd72d1',
  '622219a51523ced483ff9ce44b6211f02758030d3c5e974eda28041e0818020a',
  'c3bcdafaa71cc4d01457f9d7622c9c46029fea0ae0910be9f478dade7ac21d86',
  '8914ab5c072ee605f397fb87cb2828a9408fd66e354ab8a76bf1696b9b08797c',
  'ba1a3f278cc832fb733b3fcc2493067bacbf682f12667e603d93fb53e454d7bb',
]);

const GOLDEN_CAMPAIGN_DIGEST = '4be22e53ed3bc0208a8fdb89243c6129a8e2f14dce5a8fdf872093ca01ca7e07';

const prototypeBuilders = [
  createOuterVeil,
  createInnerKingdom,
  createSunderedAqueduct,
  createBuriedFoundry,
  createGardensOfGlass,
  createHollowBarracks,
  createObservatoryOfMirrors,
  createShiftingSepulchre,
  createCrownUnderSiege,
  createThroneOfEclipse,
];

function digest(value) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

describe('prototype level extraction golden contract', () => {
  it('preserves the complete public levels module surface', () => {
    expect(Object.keys(levelsApi).sort()).toEqual([
      'CHUNK_COLS',
      'CHUNK_COUNT',
      'CHUNK_W',
      'TILE',
      'Tile',
      'VIEW_H',
      'VIEW_W',
      'WORLD_COLS',
      'WORLD_H',
      'WORLD_ROWS',
      'WORLD_W',
      'cloneLevel',
      'createLevels',
    ].sort());
  });

  it('preserves every pre-extraction map and entity definition byte-for-byte', () => {
    const levels = prototypeBuilders.map((buildLevel) => buildLevel());
    expect(levels.map(digest)).toEqual(GOLDEN_LEVEL_DIGESTS);
  });

  it('keeps createLevels as the exact ordered compatibility facade', () => {
    const directLevels = prototypeBuilders.map((buildLevel) => buildLevel());
    const facadeLevels = createLevels();

    expect(facadeLevels).toEqual(directLevels);
    expect(digest(facadeLevels)).toBe(GOLDEN_CAMPAIGN_DIGEST);
  });

  it('continues to return fresh mutable maps and entity collections per call', () => {
    const first = createLevels();
    const second = createLevels();

    expect(first).not.toBe(second);
    for (let index = 0; index < first.length; index += 1) {
      expect(first[index]).not.toBe(second[index]);
      expect(first[index].map).not.toBe(second[index].map);
      expect(first[index].map[0]).not.toBe(second[index].map[0]);
      expect(first[index].relics).not.toBe(second[index].relics);
      expect(first[index].checkpoints).not.toBe(second[index].checkpoints);
      expect(first[index].ships).not.toBe(second[index].ships);
    }
  });
});
