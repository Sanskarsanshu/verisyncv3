/**
 * Downloads the InsightFace Buffalo_L recognition model (w600k_r50.onnx)
 * required for browser-based face embedding generation.
 *
 * Source: https://huggingface.co/public-data/insightface
 */
import { mkdir, writeFile, stat } from 'fs/promises';
import { createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MODEL_URL =
  'https://huggingface.co/public-data/insightface/resolve/main/models/buffalo_l/w600k_r50.onnx';
const OUTPUT_DIR = path.join(__dirname, '..', 'frontend', 'public', 'models');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'w600k_r50.onnx');

async function download() {
  try {
    await stat(OUTPUT_FILE);
    console.log('Model already exists at:', OUTPUT_FILE);
    return;
  } catch {
    // file does not exist, proceed with download
  }

  await mkdir(OUTPUT_DIR, { recursive: true });
  console.log('Downloading InsightFace w600k_r50.onnx (~174 MB)...');
  console.log('This may take a few minutes depending on your connection.');

  const response = await fetch(MODEL_URL, { redirect: 'follow' });
  if (!response.ok || !response.body) {
    throw new Error(`Download failed: HTTP ${response.status}`);
  }

  const fileStream = createWriteStream(OUTPUT_FILE);
  await pipeline(response.body, fileStream);

  console.log('Model saved to:', OUTPUT_FILE);
}

download().catch((err) => {
  console.error('Failed to download model:', err.message);
  console.error('\nManual download:');
  console.error(`  URL: ${MODEL_URL}`);
  console.error(`  Save to: ${OUTPUT_FILE}`);
  process.exit(1);
});
