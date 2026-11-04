// Shajawa's Gulf sponsors on two sheets: tex/ads_3x1.png (billboards, 2 x 4 cells of 1024 x 341) and tex/ads_6x1.png (wall boards, 1 x 8 strips of 2048 x 256). Cell order is ADS in shajawa_venue.py.
// Real marks for this fan project, the user's call (source/gulf_logos, CREDITS.md).   node tracks/shajawa/make_ads.mjs
import { createRequire } from 'node:module';
import { readFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url)), sharp = createRequire(join(here, '..', '..', 'track-viewer', 'package.json'))('sharp');
const L = join(here, 'source', 'gulf_logos'), sponsors = join(here, '..', '..', 'assets', 'sponsors', 'logos'); mkdirSync(join(here, 'tex'), { recursive: true });
const saudia = readFileSync(join(L, 'saudia', 'saudia.svg'), 'utf8').replace('<svg ', '<svg fill="#ffffff" ');
// each sponsor's own ground, so a row of boards does not read as one repeated panel
const ADS = [
  { id: 'aramco', file: join(L, 'aramco', 'saudi_aramco_logo.svg'), bg: '#ffffff', scale: 0.72 },
  { id: 'emirates', file: join(sponsors, 'emirates.png'), bg: '#d71920', scale: 0.8, word: 'Emirates' },
  { id: 'adnoc', file: join(L, 'adnoc', 'adnoc_logo.png'), bg: '#ffffff', scale: 0.9 },
  { id: 'saudia', svg: saudia, bg: '#0b5d4e', scale: 0.82, word: 'SAUDIA' },
  { id: 'stc', file: join(L, 'stc', 'stc.svg'), bg: '#ffffff', scale: 0.7 },
  { id: 'sabic', file: join(L, 'sabic', 'logo_of_sabic.svg'), bg: '#f4f4f2', scale: 0.86 },
  { id: 'dpworld', file: join(L, 'dpworld', 'dp_world.svg'), bg: '#ffffff', scale: 0.86 },
  { id: 'aramco2', file: join(L, 'aramco', 'saudi_aramco_logo.svg'), bg: '#e9efe9', scale: 0.72 },
];
async function board(a, W, H) {
  const src = a.svg ? Buffer.from(a.svg) : a.file, h = Math.round(H * a.scale), w = Math.round(W * 0.82);
  let img = sharp(src, { density: 600 }).resize(a.word ? Math.round(w * 0.3) : w, h, { fit: 'inside' }).png();
  if (a.id.startsWith('aramco')) img = sharp(await img.toBuffer()).modulate({ brightness: 0.42 }).png();      // its grey carries poorly at speed
  const logo = await img.toBuffer(), m = await sharp(logo).metadata(), comp = [];
  if (a.word) {       // the emblem has no lettering of its own
    const size = Math.round(H * 0.46), tw = Math.round(size * 0.68 * a.word.length), gap = Math.round(H * 0.14), x = Math.round((W - m.width - gap - tw) / 2);
    const text = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${tw + 20}" height="${H}"><text x="0" y="${Math.round(H * 0.66)}" font-family="Arial, Helvetica, sans-serif" font-weight="700" letter-spacing="${Math.round(size * 0.08)}" font-size="${size}" fill="#ffffff">${a.word}</text></svg>`);
    comp.push({ input: logo, left: x, top: Math.round((H - m.height) / 2) }, { input: text, left: x + m.width + gap, top: 0 });
  } else comp.push({ input: logo, left: Math.round((W - m.width) / 2), top: Math.round((H - m.height) / 2) });
  return sharp({ create: { width: W, height: H, channels: 3, background: a.bg } }).composite(comp).png().toBuffer();
}
const cells3 = [], cells6 = [];
for (const [i, a] of ADS.entries()) {
  cells3.push({ input: await board(a, 1024, 341), left: (i % 2) * 1024, top: Math.floor(i / 2) * 341 });
  cells6.push({ input: await board(a, 2048, 256), left: 0, top: i * 256 });
}
await sharp({ create: { width: 2048, height: 1364, channels: 3, background: '#202020' } }).composite(cells3).png().toFile(join(here, 'tex', 'ads_3x1.png'));
await sharp({ create: { width: 2048, height: 2048, channels: 3, background: '#202020' } }).composite(cells6).png().toFile(join(here, 'tex', 'ads_6x1.png'));
console.log(`${ADS.length} boards -> tex/ads_3x1.png, tex/ads_6x1.png`);
