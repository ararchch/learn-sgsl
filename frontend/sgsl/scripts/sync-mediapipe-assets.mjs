import { copyFile, mkdir, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, '..');
const publicRoot = path.join(projectRoot, 'public', 'vendor', 'mediapipe');

const FILES_TO_COPY = [
  {
    sourceDir: path.join(projectRoot, 'node_modules', '@mediapipe', 'hands'),
    targetDir: path.join(publicRoot, 'hands'),
    include: (name) =>
      name.endsWith('.js') ||
      name.endsWith('.wasm') ||
      name.endsWith('.data') ||
      name.endsWith('.binarypb') ||
      name.endsWith('.tflite'),
  },
  {
    sourceDir: path.join(
      projectRoot,
      'node_modules',
      '@mediapipe',
      'drawing_utils',
    ),
    targetDir: path.join(publicRoot, 'drawing_utils'),
    include: (name) => name === 'drawing_utils.js',
  },
];

async function copyPackageFiles({ sourceDir, targetDir, include }) {
  await mkdir(targetDir, { recursive: true });
  const entries = await readdir(sourceDir, { withFileTypes: true });

  await Promise.all(
    entries
      .filter((entry) => entry.isFile() && include(entry.name))
      .map((entry) =>
        copyFile(
          path.join(sourceDir, entry.name),
          path.join(targetDir, entry.name),
        ),
      ),
  );
}

await Promise.all(FILES_TO_COPY.map(copyPackageFiles));
