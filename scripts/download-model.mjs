#!/usr/bin/env node
/**
 * Downloads InsightFace Buffalo_L recognition model (w600k_r50.onnx)
 * Official model from InsightFace model zoo
 */
import { createWriteStream, mkdirSync, existsSync } from 'fs';
import { pipeline } from 'stream/promises';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, '../frontend/public/models');
const OUT_FILE = join(OUT_DIR, 'w600k_r50.onnx');

const MODEL_URL =
  'https://huggingface.co/public-data/insightface/resolve/main/models/buffalo_l/w600k_r50.onnx';

async function download() {
  if (existsSync(OUT_FILE)) {
    console.log('Model already exists:', OUT_FILE);
    return;
  }

  mkdirSync(OUT_DIR, { recursive: true });
  console.log('Downloading InsightFace w600k_r50.onnx (Buffalo_L recognition model)...');

  const res = await fetch(MODEL_URL);
  if (!res.ok) {
    throw new Error(`Download failed: ${res.status} ${res.statusText}`);
  }

  await pipeline(res.body, createWriteStream(OUT_FILE));
  console.log('Saved to', OUT_FILE);
}

download().catch((err) => {
  console.error(err);
  process.exit(1);
});
