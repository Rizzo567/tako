#!/usr/bin/env node
/** Pixel comparison of two screenshot folders from scripts/qa-screenshots.mjs.
 *  Usage: node scripts/qa-screenshot-diff.mjs <before> <after> [diffDir] — exit 1 if any image differs. */
import { createRequire } from 'node:module';
import { readdir, mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const require = createRequire(resolve(dirname(fileURLToPath(import.meta.url)), '../apps/server/package.json'));
const sharp = require('sharp');
const [a, b, d] = process.argv.slice(2).map(p => p && resolve(p));
if (d) await mkdir(d, { recursive: true });
let bad = 0;
for (const f of (await readdir(a)).filter(f => f.endsWith('.png')).sort()) {
  let A, B;
  try { A = await sharp(resolve(a, f)).ensureAlpha().raw().toBuffer({ resolveWithObject: true }); B = await sharp(resolve(b, f)).ensureAlpha().raw().toBuffer({ resolveWithObject: true }); }
  catch (e) { console.log(`${f}: MISSING ${e.message}`); bad++; continue; }
  if (A.info.width !== B.info.width || A.info.height !== B.info.height) { console.log(`${f}: SIZE ${A.info.width}x${A.info.height} vs ${B.info.width}x${B.info.height}`); bad++; continue; }
  const n = A.info.width * A.info.height; let diff = 0; const out = Buffer.alloc(n * 4);
  for (let i = 0; i < n; i++) { const o = i * 4; const dd = Math.abs(A.data[o]-B.data[o]) + Math.abs(A.data[o+1]-B.data[o+1]) + Math.abs(A.data[o+2]-B.data[o+2]);
    if (dd > 0) { diff++; out[o] = 255; out[o+3] = 255; } else { const g = (A.data[o] + A.data[o+1] + A.data[o+2]) / 3 * 0.3 + 170; out[o] = out[o+1] = out[o+2] = g; out[o+3] = 255; } }
  console.log(`${f}: ${diff === 0 ? 'IDENTICAL' : `DIFF ${diff} px (${(diff / n * 100).toFixed(3)}%)`}`);
  if (diff) { bad++; if (d) await sharp(out, { raw: { width: A.info.width, height: A.info.height, channels: 4 } }).png().toFile(resolve(d, f)); }
}
console.log(bad ? `${bad} differing` : 'ALL IDENTICAL');
process.exitCode = bad ? 1 : 0;
