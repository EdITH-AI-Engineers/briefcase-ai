#!/usr/bin/env node
// OCR driver for evaluation-frameworks.
//
// Rasterized PNGs live in ../ocr/<prefix>-page-NN.png (produced by pdftoppm
// -r 300). This script walks those images in order, runs tesseract.js against
// each, and writes one combined plain-text file per PDF to ../ocr/<name>.txt
// with page separators so downstream cross-check can locate page boundaries.
//
// Usage:
//   node scripts/ocr.mjs <prefix> <output-name>
//   e.g. node scripts/ocr.mjs cmo25 cmo-25-s2015.ocr.txt

import { createWorker } from "tesseract.js";
import { readdir, writeFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const OCR_DIR = join(HERE, "..", "ocr");

async function main() {
  const [prefix, outName] = process.argv.slice(2);
  if (!prefix || !outName) {
    console.error("usage: node scripts/ocr.mjs <prefix> <output-name>");
    process.exit(2);
  }

  const entries = await readdir(OCR_DIR);
  const pages = entries
    .filter((f) => f.startsWith(`${prefix}-page-`) && f.endsWith(".png"))
    .sort();
  if (pages.length === 0) {
    console.error(`no pages found for prefix ${prefix} in ${OCR_DIR}`);
    process.exit(1);
  }
  console.error(`[ocr] ${prefix}: ${pages.length} pages`);

  const worker = await createWorker("eng", 1, { logger: () => {} });

  const out = [];
  const t0 = Date.now();
  for (let i = 0; i < pages.length; i++) {
    const p = pages[i];
    const { data } = await worker.recognize(join(OCR_DIR, p));
    out.push(`\n===== PAGE ${i + 1} (${p}) =====\n\n${data.text.trim()}\n`);
    const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
    console.error(`[ocr] ${prefix} p${i + 1}/${pages.length} (${elapsed}s total)`);
  }

  await worker.terminate();
  await writeFile(join(OCR_DIR, outName), out.join("\n"), "utf8");
  console.error(`[ocr] ${prefix}: wrote ${outName}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
