import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  CURRENT_CINEMATIC_FILES,
  LEGACY_CINEMATIC_FILES,
  pruneAndroidAssets,
} from './prune-android-assets.mjs';

async function createFixture() {
  const root = await mkdtemp(path.join(tmpdir(), 'eotvk-android-assets-'));
  const cinematicRoot = path.join(root, 'assets', 'cinematics');
  await mkdir(cinematicRoot, { recursive: true });
  await Promise.all([...CURRENT_CINEMATIC_FILES, ...LEGACY_CINEMATIC_FILES]
    .map((file) => writeFile(path.join(cinematicRoot, file), file)));
  return { root, cinematicRoot };
}

describe('Android asset packaging', () => {
  it('removes only superseded cinematic files and preserves every current film', async () => {
    const { root, cinematicRoot } = await createFixture();
    const result = await pruneAndroidAssets(root);

    expect(result.removed).toEqual(LEGACY_CINEMATIC_FILES);
    for (const file of CURRENT_CINEMATIC_FILES) {
      await expect(readFile(path.join(cinematicRoot, file), 'utf8')).resolves.toBe(file);
    }
    for (const file of LEGACY_CINEMATIC_FILES) {
      await expect(readFile(path.join(cinematicRoot, file), 'utf8')).rejects.toMatchObject({ code: 'ENOENT' });
    }
  });

  it('fails closed when a film used by the runtime is missing', async () => {
    const { root, cinematicRoot } = await createFixture();
    await rm(path.join(cinematicRoot, CURRENT_CINEMATIC_FILES[0]));

    await expect(pruneAndroidAssets(root)).rejects.toThrow('Required Android cinematic is missing');
  });
});
