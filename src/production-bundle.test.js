import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { build } from 'vite';
import { describe, expect, it } from 'vitest';

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PROTOTYPE_SOURCES = [
  'outerVeil',
  'innerKingdom',
  'sunderedAqueduct',
  'buriedFoundry',
  'gardensOfGlass',
  'hollowBarracks',
  'observatoryOfMirrors',
  'shiftingSepulchre',
  'crownUnderSiege',
  'throneOfEclipse',
].map((name) => `src/levels/prototypes/${name}.js`);
const PREVIEW_SOURCES = [
  'src/levels/outerVeil/sandThatRemembers.js',
  'src/levels/outerVeil/brokenProcession.js',
  'src/levels/outerVeil/weightOfOaths.js',
  'src/levels/outerVeil/teethBeneathDust.js',
  'src/levels/outerVeil/pilgrimsClimb.js',
  'src/levels/outerVeil/firstSanctum.js',
  'src/levels/outerVeil/parachuteChoir.js',
  'src/levels/outerVeil/gateOfTheVeil.js',
  'src/levels/outerVeil/wardenOfDust.js',
];

describe('production level delivery', () => {
  it('builds every prototype as a distinct dynamic entry outside the main bundle', async () => {
    const outDir = await mkdtemp(path.join(tmpdir(), 'eotvk-bundle-'));
    try {
      await build({
        root: PROJECT_ROOT,
        configFile: false,
        plugins: [react()],
        base: '/eclipse-veiled-kingdom/',
        logLevel: 'silent',
        build: { outDir, emptyOutDir: true, manifest: true },
      });
      const manifest = JSON.parse(await readFile(path.join(outDir, '.vite', 'manifest.json'), 'utf8'));
      const entry = Object.values(manifest).find((item) => item.isEntry && item.src === 'index.html');
      expect(entry).toBeDefined();
      expect(new Set(entry.dynamicImports)).toEqual(new Set([...PROTOTYPE_SOURCES, ...PREVIEW_SOURCES]));

      const files = new Set();
      for (const source of PROTOTYPE_SOURCES) {
        expect(manifest[source]).toMatchObject({ src: source, isDynamicEntry: true });
        expect(manifest[source].file).not.toBe(entry.file);
        files.add(manifest[source].file);
        await expect(readFile(path.join(outDir, manifest[source].file), 'utf8')).resolves.toBeTruthy();
      }
      expect(files.size).toBe(PROTOTYPE_SOURCES.length);
      const previewFiles = new Set();
      for (const source of PREVIEW_SOURCES) {
        expect(manifest[source]).toMatchObject({ src: source, isDynamicEntry: true });
        expect(manifest[source].file).not.toBe(entry.file);
        expect(files.has(manifest[source].file)).toBe(false);
        previewFiles.add(manifest[source].file);
        await expect(readFile(path.join(outDir, manifest[source].file), 'utf8')).resolves.toBeTruthy();
      }
      expect(previewFiles.size).toBe(PREVIEW_SOURCES.length);
    } finally {
      await rm(outDir, { recursive: true, force: true });
    }
  }, 15000);
});
