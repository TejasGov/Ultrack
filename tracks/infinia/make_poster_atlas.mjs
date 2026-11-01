// The tunnel's film posters: every image in source/posters/ (your own files first, then source/posters/commons/) laid out as one sheet,
// each whole on a dark ground -> tex/tunnel_posters.png + tex/tunnel_posters.json { cols, rows, count }; with none, the painted sheet.
//   node tracks/infinia/make_poster_atlas.mjs      then rebuild (build_infinia.py) and pack: the posters are baked into the visual GLB
import { createRequire } from 'node:module';
import { copyFileSync, existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url)), sharp = createRequire(join(here, '..', '..', 'track-viewer', 'package.json'))('sharp');
const images = (d) => (existsSync(d) ? readdirSync(d).filter((f) => /\.(jpe?g|png|webp)$/i.test(f)).sort().map((f) => join(d, f)) : []);
const files = [...images(join(here, 'source', 'posters')), ...images(join(here, 'source', 'posters', 'commons'))];
const W = 340, H = 512, cols = 6, sheet = join(here, 'tex', 'tunnel_posters.png'), meta = join(here, 'tex', 'tunnel_posters.json');
mkdirSync(join(here, 'tex'), { recursive: true });
if (!files.length) {
  copyFileSync(join(here, 'tex', 'tunnel_posters_painted.png'), sheet); writeFileSync(meta, JSON.stringify({ cols: 6, rows: 2, count: 12 }));
  console.log('no posters in source/posters: the painted sheet');
} else {
  const rows = Math.ceil(files.length / cols), B = 6, cells = [];
  for (const [i, f] of files.entries()) {
    const input = await sharp(f, { limitInputPixels: false }).rotate().resize(W - 2 * B, H - 2 * B, { fit: 'contain', background: '#0d0b0c', kernel: 'lanczos3' }).flatten({ background: '#0d0b0c' }).png().toBuffer();
    cells.push({ input, left: (i % cols) * W + B, top: Math.floor(i / cols) * H + B });
  }
  await sharp({ create: { width: cols * W, height: rows * H, channels: 3, background: '#0d0b0c' } }).composite(cells).png().toFile(sheet);
  writeFileSync(meta, JSON.stringify({ cols, rows, count: files.length }));
  console.log(`${files.length} posters -> tex/tunnel_posters.png (${cols} x ${rows})`);
}
