// The Korean billboards' logos: assets/sponsors/sources/*.svg -> logos/*.png + manifest entries (once, idempotent). Run after a re-download:  node tracks/qingshan/make_kr_logos.mjs
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
const sharp = createRequire('D:/RaceUltimate/track-viewer/')('sharp');
const A = 'D:/RaceUltimate/assets/sponsors/';
const si = 'https://raw.githubusercontent.com/simple-icons/simple-icons/develop/icons/';
const NOTE = (n, o) => `${n} is a trademark of ${o}; used here on a local noncommercial fan project, no endorsement implied.`;
const BR = [
  ['samsung', 'Samsung', si + 'samsung.svg', '#1428A0', '#ffffff', 'Simple Icons (CC0 icon data); ' + NOTE('Samsung', 'Samsung Electronics Co.')],
  ['lg', 'LG', si + 'lg.svg', '#A50034', '#ffffff', 'Simple Icons (CC0 icon data); ' + NOTE('LG', 'LG Corp.')],
  ['hyundai', 'Hyundai', si + 'hyundai.svg', '#002C5F', '#ffffff', 'Simple Icons (CC0 icon data); ' + NOTE('Hyundai', 'Hyundai Motor Co.')],
  ['kia', 'Kia', si + 'kia.svg', '#05141F', '#ffffff', 'Simple Icons (CC0 icon data); ' + NOTE('Kia', 'Kia Corp.')],
  ['lotte-mart', 'Lotte Mart', 'https://upload.wikimedia.org/wikipedia/commons/2/24/Lotte_Mart_%282023%29.svg', '#ffffff', null, 'Wikimedia Commons, tagged public domain (File:Lotte Mart (2023).svg); ' + NOTE('Lotte Mart', 'Lotte Shopping Co.')],
];
const man = JSON.parse(readFileSync(A + 'manifest.json', 'utf8'));
for (const [id, name, source, background, ink, license] of BR) {
  const f = `${A}sources/${id}.svg`, raw = readFileSync(f);
  // density: icons are 24 px, Lotte Mart's sheet is 1000 px wide
  const svg = ink ? raw.toString().replace('<svg ', `<svg fill="${ink}" `) : raw;      // Simple Icons are bare black paths
  await sharp(Buffer.from(svg), { density: ink ? 4000 : 200 }).resize({ width: 2048, height: 1024, fit: 'inside' }).png().toFile(`${A}logos/${id}.png`);
  const e = { id, name, aliases: [], source, sourceFile: `assets/sponsors/sources/${id}.svg`, file: `logos/${id}.png`, background, ink: ink ?? '#000000', usage: 'venue-qingshan', venue: false, retrieved: '2026-11-04', license, sourceSha256: createHash('sha256').update(raw).digest('hex') };
  const q = man.brands.findIndex((b) => b.id === id); if (q < 0) man.brands.push(e); else man.brands[q] = e;
}
writeFileSync(A + 'manifest.json', JSON.stringify(man, null, 2) + '\n');
