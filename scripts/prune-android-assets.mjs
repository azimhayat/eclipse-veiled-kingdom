import { rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const LEGACY_CINEMATIC_FILES = Object.freeze([
  'opening-prologue-v1.mp4',
  'opening-prologue-v1.en.vtt',
  'chapter-one-introduction-v1.mp4',
  'chapter-one-introduction-v1.en.vtt',
  'chapter-one-to-two-bridge-v1.mp4',
  'chapter-one-to-two-bridge-v1.en.vtt',
  'chapter-two-to-three-bridge-v1.mp4',
  'chapter-two-to-three-bridge-v1.en.vtt',
]);

export const CURRENT_CINEMATIC_FILES = Object.freeze([
  'opening-prologue-v2.mp4',
  'opening-prologue-v2.en.vtt',
  'chapter-one-introduction-v2.mp4',
  'chapter-one-introduction-v2.en.vtt',
  'chapter-one-to-two-bridge-v2.mp4',
  'chapter-one-to-two-bridge-v2.en.vtt',
  'chapter-two-to-three-bridge-v2.mp4',
  'chapter-two-to-three-bridge-v2.en.vtt',
]);

async function fileSize(filePath) {
  try {
    return (await stat(filePath)).size;
  } catch (error) {
    if (error?.code === 'ENOENT') return null;
    throw error;
  }
}

export async function pruneAndroidAssets(distRoot = 'dist') {
  const cinematicRoot = path.resolve(distRoot, 'assets', 'cinematics');
  let removedBytes = 0;
  const removed = [];

  for (const file of LEGACY_CINEMATIC_FILES) {
    const filePath = path.join(cinematicRoot, file);
    const size = await fileSize(filePath);
    if (size === null) continue;
    await rm(filePath);
    removedBytes += size;
    removed.push(file);
  }

  for (const file of CURRENT_CINEMATIC_FILES) {
    const filePath = path.join(cinematicRoot, file);
    if (await fileSize(filePath) === null) {
      throw new Error(`Required Android cinematic is missing: ${file}`);
    }
  }

  return { removed, removedBytes };
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : '';
if (invokedPath === fileURLToPath(import.meta.url)) {
  const result = await pruneAndroidAssets(process.argv[2] || 'dist');
  const removedMb = (result.removedBytes / (1024 * 1024)).toFixed(1);
  console.log(`Android package prepared: removed ${result.removed.length} legacy files (${removedMb} MiB).`);
}
