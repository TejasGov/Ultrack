// India's roadside political hoarding (venue/india.js): saffron panel, a green foot band, the BJP lotus (assets/sponsors/sources/bjp.svg)
// on a white disc, the wordmark, and the PM's official portrait (sources/modi-portrait.jpg, GODL-India) on a slanted white panel
// (its white ground and sleeves stay whole: no cut-out). Output: assets/sponsors/boards/bjp-3000.png (3:1, like the 3000-aspect boards). sharp, no network.
import sharp from 'sharp';
import { readFileSync } from 'node:fs';
const root = new URL('../../assets/sponsors/', import.meta.url), local = (u) => u.pathname.replace(/^\/([A-Za-z]:)/, '$1');
const W = 1536, H = 512, lotus = await sharp(readFileSync(new URL('sources/bjp.svg', root)), { density: 300 }).trim().resize({ height: 330 }).png().toBuffer();
const lm = await sharp(lotus).metadata(), PH = H - 78;
const portrait = await sharp(readFileSync(new URL('sources/modi-portrait.jpg', root))).extract({ left: 40, top: 90, width: 1200, height: 1216 }).resize({ height: PH }).png().toBuffer();
const pm = await sharp(portrait).metadata();
const art = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <rect width="${W}" height="${H}" fill="#FF9933"/><rect y="${H - 70}" width="${W}" height="70" fill="#138808"/><rect y="${H - 78}" width="${W}" height="8" fill="#ffffff"/>
  <circle cx="250" cy="${(H - 78) / 2}" r="190" fill="#ffffff"/>
  <polygon points="${W - pm.width - 70},0 ${W},0 ${W},${PH} ${W - pm.width + 10},${PH}" fill="#ffffff"/>
  <text x="${(440 + W - pm.width - 30) / 2}" y="300" text-anchor="middle" font-family="Arial Black, Arial" font-weight="900" font-size="230" letter-spacing="24" fill="#ffffff">BJP</text>
</svg>`;
await sharp(Buffer.from(art)).composite([{ input: portrait, left: W - pm.width, top: 0 }, { input: lotus, left: Math.round(250 - lm.width / 2), top: Math.round((H - 78) / 2 - lm.height / 2) }])
  .png().toFile(local(new URL('boards/bjp-3000.png', root)));
console.log('bjp-3000.png', W + 'x' + H);
