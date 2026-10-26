// Mean absolute pixel difference between two folders of same-named PNG screenshots (0..255 per RGB channel), e.g. qa-tokyo-views shots
// taken before and after a change; run the same shots twice unchanged to get the noise floor (animated lights, grain).
//   node scripts/pixel-diff.mjs <dirA> <dirB> [--save <dir>]      --save writes a x8 difference image per pair
import sharp from 'sharp';
import { readdirSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const args = process.argv.slice(2).filter((a) => !a.startsWith('--') || a === '--save');
const si = process.argv.indexOf('--save'), save = si > 0 ? process.argv[si + 1] : null;
const [A, B] = args.filter((a) => a !== '--save' && a !== save);
if (!A || !B) { console.error('usage: node scripts/pixel-diff.mjs <dirA> <dirB> [--save dir]'); process.exit(2); }
if (save) mkdirSync(save, { recursive: true });
let total = 0, n = 0;
for (const f of readdirSync(A).filter((x) => x.endsWith('.png') && !x.startsWith('_')).sort()) {
  let a, b;
  try { [a, b] = await Promise.all([A, B].map((d) => sharp(join(d, f)).removeAlpha().raw().toBuffer({ resolveWithObject: true }))); } catch { continue; }
  if (a.info.width !== b.info.width || a.info.height !== b.info.height) { console.log(f.padEnd(34), 'size differs'); continue; }
  const px = a.info.width * a.info.height, heat = Buffer.alloc(px);
  let sum = 0, over8 = 0, over32 = 0, max = 0;
  for (let i = 0; i < px; i++) {
    const o = i * 3, d = Math.max(Math.abs(a.data[o] - b.data[o]), Math.abs(a.data[o + 1] - b.data[o + 1]), Math.abs(a.data[o + 2] - b.data[o + 2]));
    sum += Math.abs(a.data[o] - b.data[o]) + Math.abs(a.data[o + 1] - b.data[o + 1]) + Math.abs(a.data[o + 2] - b.data[o + 2]);
    if (d > 8) over8++; if (d > 32) over32++; if (d > max) max = d; heat[i] = Math.min(255, d * 8);
  }
  const mad = sum / (px * 3);
  total += mad; n++;
  console.log(f.padEnd(34), 'mean abs diff', mad.toFixed(3).padStart(7), ` >8: ${(over8 / px * 100).toFixed(3)}%  >32: ${(over32 / px * 100).toFixed(4)}%  max ${max}`);
  if (save) await sharp(heat, { raw: { width: a.info.width, height: a.info.height, channels: 1 } }).png().toFile(join(save, f));
}
if (n) console.log(`mean over ${n} shots: ${(total / n).toFixed(3)}`);
