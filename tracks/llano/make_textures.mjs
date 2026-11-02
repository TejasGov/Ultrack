// Llano's flat art, all 2D: the sponsors on two sheets (assets/sponsors/logos: real marks, as the other tracks' boards), the track's own signs, the Texas flag, the catch fence and skid marks.
//   node tracks/llano/make_textures.mjs   -> tex/ads_3x1.png, ads_6x1.png (cell order: ADS3, ADS6 in llano_venue.py), signs.png, flag.png, fence.png, skid.png
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url)), sharp = createRequire(join(here, '..', '..', 'track-viewer', 'package.json'))('sharp');
const root = join(here, '..', '..'), tex = join(here, 'tex'); mkdirSync(tex, { recursive: true });
const BRANDS = Object.fromEntries(JSON.parse(readFileSync(join(root, 'assets', 'sponsors', 'manifest.json'), 'utf8')).brands.map((x) => [x.id, x]));
// each cell the brand's colour with its logo inside, its proportions kept (the stock boards stretch some marks to fit)
const sheet = async (file, names, W, H, cols, fill) => {
  const rows = Math.ceil(names.length / cols), cells = [];
  for (const [i, n] of names.entries()) {
    const b = BRANDS[n], mark = await sharp(join(root, 'assets', 'sponsors', b.file)).trim().resize(Math.round(W * fill), Math.round(H * fill), { fit: 'inside', kernel: 'lanczos3' }).png().toBuffer();
    const input = await sharp({ create: { width: W, height: H, channels: 3, background: b.background } }).composite([{ input: mark }]).png().toBuffer();
    cells.push({ input, left: (i % cols) * W, top: Math.floor(i / cols) * H });
  }
  await sharp({ create: { width: cols * W, height: rows * H, channels: 3, background: '#202020' } }).composite(cells).png().toFile(join(tex, file));
  console.log(file, `${cols} x ${rows}`);
};
await sheet('ads_3x1.png', ['shell', 'rolex', 'pirelli', 'cocacola', 'redbull', 'emirates', 'sony', 'oppo'], 1024, 341, 2, 0.74);
await sheet('ads_6x1.png', ['shell', 'redbull', 'rolex', 'pirelli', 'cocacola', 'hsbc', 'emirates', 'sony'], 1024, 171, 1, 0.72);

// the track's signs: 512 x 256 cells, 4 x 4 (SIGNS in llano_venue.py). The wide ones take a whole row of the sheet's 2048 px
const cell = (bg, ink, text, size, y = 165, font = 'Impact', edge = null) => `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="256"><rect width="512" height="256" fill="${bg}"/>${edge ? `<rect x="10" y="10" width="492" height="236" fill="none" stroke="${edge}" stroke-width="8"/>` : ''}<text x="256" y="${y}" font-family="${font}" font-size="${size}" fill="${ink}" text-anchor="middle" letter-spacing="2">${text}</text></svg>`;
const wide = (bg, ink, text, size) => `<svg xmlns="http://www.w3.org/2000/svg" width="2048" height="256"><rect width="2048" height="256" fill="${bg}"/><text x="1024" y="${128 + size * 0.36}" font-family="Impact" font-size="${size}" fill="${ink}" text-anchor="middle" letter-spacing="14">${text}</text></svg>`;
const small = [
  cell('#f2f0ea', '#111', '300', 190, 195), cell('#f2f0ea', '#111', '200', 190, 195), cell('#f2f0ea', '#111', '100', 190, 195), cell('#b5331f', '#fff', 'PIT IN', 120, 172),
  cell('#14361f', '#f4f4ee', 'THE LONG MILE', 44, 143, 'Arial Black', '#f4f4ee'), cell('#14361f', '#f4f4ee', 'LAST CHANCE', 52, 146, 'Arial Black', '#f4f4ee'), cell('#14361f', '#f4f4ee', 'THE CORRAL', 56, 148, 'Arial Black', '#f4f4ee'), cell('#14361f', '#f4f4ee', 'BIG BEND', 70, 153, 'Arial Black', '#f4f4ee'),
];
const cells = [];
for (const [i, s] of small.entries()) cells.push({ input: Buffer.from(s), left: (i % 4) * 512, top: Math.floor(i / 4) * 256 });
cells.push({ input: Buffer.from(wide('#101012', '#f4f4ee', 'LLANO SPEEDWAY', 200)), left: 0, top: 512 });
// the game's own logo for the start gantry, on dark
const logo = await sharp(join(root, 'assets', 'brand', 'ultrack_logo_alpha.png')).resize(1500, 220, { fit: 'inside' }).png().toBuffer();
cells.push({ input: await sharp({ create: { width: 2048, height: 256, channels: 3, background: '#101012' } }).composite([{ input: logo }]).png().toBuffer(), left: 0, top: 768 });
await sharp({ create: { width: 2048, height: 1024, channels: 3, background: '#202020' } }).composite(cells).png().toFile(join(tex, 'signs.png'));
console.log('signs.png');

// the Lone Star flag, public domain: 2:3
const star = (cx, cy, r) => Array.from({ length: 10 }, (_, k) => { const a = -Math.PI / 2 + k * Math.PI / 5, q = k % 2 ? r * 0.382 : r; return `${cx + q * Math.cos(a)},${cy + q * Math.sin(a)}`; }).join(' ');
await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="768" height="512"><rect width="768" height="512" fill="#fff"/><rect y="256" width="768" height="256" fill="#bf0a30"/><rect width="256" height="512" fill="#002868"/><polygon points="${star(128, 256, 96)}" fill="#fff"/></svg>`)).png().toFile(join(tex, 'flag.png'));

// catch fence: a diamond mesh with alpha, one 1 m tile
const S = 256, wire = Buffer.alloc(S * S * 4);
for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
  const u = ((x + y) % 64), v = ((x - y + S) % 64), on = u < 5 || v < 5, o = (y * S + x) * 4;
  wire[o] = 120; wire[o + 1] = 122; wire[o + 2] = 124; wire[o + 3] = on ? 255 : 0;
}
await sharp(wire, { raw: { width: S, height: S, channels: 4 } }).png().toFile(join(tex, 'fence.png'));

// skid marks: dark streaks across, fading in and out along (v), alpha only where rubber was laid. Seeded, so a rebuild matches
const W2 = 256, H2 = 1024, skid = Buffer.alloc(W2 * H2 * 4); let seed = 11; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const lines = Array.from({ length: 22 }, () => ({ x: 20 + rnd() * 216, w: 3 + rnd() * 11, a: 0.1 + rnd() * 0.26, s: rnd() * 0.5, e: 0.55 + rnd() * 0.45, d: (rnd() - 0.5) * 18 }));
for (let y = 0; y < H2; y++) { const t = y / H2; for (let x = 0; x < W2; x++) {
  let a = 0; for (const l of lines) { if (t < l.s || t > l.e) continue; const f = Math.min(1, (t - l.s) * 12, (l.e - t) * 6), dx = Math.abs(x - (l.x + l.d * t)); if (dx < l.w) a = Math.max(a, l.a * f * (1 - dx / l.w * 0.4)); }
  const o = (y * W2 + x) * 4; skid[o] = 14; skid[o + 1] = 14; skid[o + 2] = 15; skid[o + 3] = Math.round(a * 255);
} }
await sharp(skid, { raw: { width: W2, height: H2, channels: 4 } }).png().toFile(join(tex, 'skid.png'));
// the dirt: Mojave's pale sand with its big blotches taken out (each pixel over its wide blur), or the tile shows as scales across a plain this size. Blurred wrapped, so the tile still meets itself
const sandFile = join(root, 'tracks', 'drylake', 'tex', 'aerial_sand_pale_diff_1k.jpg'), meta = await sharp(sandFile).metadata(), W3 = meta.width, H3 = meta.height;
const sand = await sharp(sandFile).removeAlpha().raw().toBuffer();
const pad = 192, wrapped = await sharp(await sharp(sandFile).removeAlpha().extend({ top: pad, bottom: pad, left: pad, right: pad, extendWith: 'repeat' }).blur(56).png().toBuffer()).extract({ left: pad, top: pad, width: W3, height: H3 }).raw().toBuffer();
const flat = Buffer.alloc(sand.length), mean = [0, 1, 2].map((c) => { let t = 0; for (let k = c; k < sand.length; k += 3) t += sand[k]; return t / (sand.length / 3); });
for (let k = 0; k < sand.length; k++) flat[k] = Math.max(0, Math.min(255, Math.round(mean[k % 3] * (sand[k] / Math.max(1, wrapped[k])))));
await sharp(flat, { raw: { width: W3, height: H3, channels: 3 } }).jpeg({ quality: 92 }).toFile(join(tex, 'dirt_diff.jpg'));

// tyre stacks, one 3 m x 1 m tile: three rows, painted by the column in Lone Star colours, a shadow in each gap
const tyre = (x, y, c) => `<circle cx="${x}" cy="${y}" r="42" fill="${c}"/><circle cx="${x}" cy="${y}" r="20" fill="#0a0a0b"/><circle cx="${x}" cy="${y}" r="42" fill="none" stroke="#000" stroke-opacity="0.4" stroke-width="5"/>`;
let ty = ''; const TC = ['#bf0a30', '#e9e5da', '#14306e', '#e9e5da']; for (let r = 0; r < 4; r++) for (let c = 0; c < 9; c++) ty += tyre(42 + c * 85 + (r % 2 ? 21 : 0), 42 + r * 84, TC[Math.floor(c / 2) % 4]);
await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="768" height="256" viewBox="0 0 768 340"><rect width="768" height="340" fill="#0b0b0c"/>${ty}</svg>`)).resize(768, 256, { fit: 'fill' }).png().toFile(join(tex, 'tyres.png'));
// the start lights: eight dark discs on a black board, unlit (the game can light them; a flat picture never blinks)
const discs = Array.from({ length: 8 }, (_, k) => `<circle cx="${64 + k * 128}" cy="79" r="50" fill="#3c0d0d" stroke="#70181a" stroke-width="5"/><circle cx="${52 + k * 128}" cy="64" r="11" fill="#7a2c2a"/>`).join('');
await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="158"><rect width="1024" height="158" fill="#0c0c0e"/>${discs}</svg>`)).png().toFile(join(tex, 'start_lights.png'));

// Llano Central: cut lettering on stone, a station clock, a carriage's side
await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="2048" height="128"><rect width="2048" height="128" fill="#c9a98a"/><text x="1024" y="98" font-family="Georgia, Times New Roman, serif" font-size="96" font-weight="700" fill="#3b2a1e" text-anchor="middle" letter-spacing="26">LLANO CENTRAL</text></svg>`)).png().toFile(join(tex, 'station_sign.png'));
const ticks = Array.from({ length: 12 }, (_, k) => { const a = k * Math.PI / 6; return `<line x1="${256 + 188 * Math.sin(a)}" y1="${256 - 188 * Math.cos(a)}" x2="${256 + 222 * Math.sin(a)}" y2="${256 - 222 * Math.cos(a)}" stroke="#1a1512" stroke-width="16"/>`; }).join('');
await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512"><rect width="512" height="512" fill="#c9a98a"/><circle cx="256" cy="256" r="246" fill="#8a6a4a"/><circle cx="256" cy="256" r="232" fill="#f1ead8"/>${ticks}<line x1="256" y1="256" x2="256" y2="108" stroke="#1a1512" stroke-width="14"/><line x1="256" y1="256" x2="356" y2="330" stroke="#1a1512" stroke-width="20"/><circle cx="256" cy="256" r="14" fill="#1a1512"/></svg>`)).png().toFile(join(tex, 'clock.png'));
const wins = Array.from({ length: 11 }, (_, k) => `<rect x="${56 + k * 86}" y="46" width="64" height="62" rx="6" fill="#1a2430"/>`).join('');
await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="170"><rect width="1024" height="170" fill="#7a2418"/><rect y="0" width="1024" height="30" fill="#2c2a28"/><rect y="118" width="1024" height="10" fill="#e9c98a"/><rect y="146" width="1024" height="24" fill="#1a1918"/>${wins}<rect x="6" y="36" width="34" height="108" fill="#5d1c13" stroke="#e9c98a" stroke-width="2"/><rect x="984" y="36" width="34" height="108" fill="#5d1c13" stroke="#e9c98a" stroke-width="2"/></svg>`)).png().toFile(join(tex, 'train_side.png'));

// the rubbered line: soft across, the same along
const rubber = Buffer.alloc(64 * 4 * 4); for (let x = 0; x < 64; x++) for (let y = 0; y < 4; y++) { const o = (y * 64 + x) * 4, t = Math.abs(x / 63 - 0.5) * 2; rubber[o] = 18; rubber[o + 1] = 18; rubber[o + 2] = 19; rubber[o + 3] = Math.round(62 * (1 - t * t)); }
await sharp(rubber, { raw: { width: 64, height: 4, channels: 4 } }).png().toFile(join(tex, 'rubber.png'));

// a motorhome's side, three liveries side by side (1 x 3 of 512 x 170)
const rv = (x, a, b) => `<g transform="translate(${x},0)"><rect width="512" height="170" fill="#e9e6df"/><path d="M0 104 C120 84 250 130 512 88 L512 118 C260 158 120 112 0 132 Z" fill="${a}"/><path d="M0 132 C120 112 260 158 512 118 L512 130 C260 170 120 124 0 144 Z" fill="${b}"/><rect y="150" width="512" height="20" fill="#2c2b2a"/><rect x="36" y="34" width="86" height="42" rx="5" fill="#1c232a"/><rect x="170" y="34" width="118" height="42" rx="5" fill="#1c232a"/><rect x="338" y="28" width="44" height="118" rx="3" fill="#d6d2c8" stroke="#8c8a84" stroke-width="2"/><rect x="346" y="36" width="28" height="30" fill="#1c232a"/><rect x="420" y="34" width="62" height="42" rx="5" fill="#1c232a"/></g>`;
await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1536" height="170">${rv(0, '#8c2f1c', '#c9772e')}${rv(512, '#20395e', '#7f94ad')}${rv(1024, '#3c4a35', '#a39a6f')}</svg>`)).png().toFile(join(tex, 'rv_side.png'));
console.log('flag, fence, skid, rubber, rv done');
