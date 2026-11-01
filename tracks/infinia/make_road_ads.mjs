// Infinia's roadside ads: the 3:1 sponsor boards the India map already uses (assets/sponsors/boards, real marks for this local fan prototype) on one sheet,
// the BJP board first -> tex/road_ads.png (2 x 5 cells of 1024 x 341). Cell order is ROAD_ADS in infinia_place.py.   node tracks/infinia/make_road_ads.mjs
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url)), sharp = createRequire(join(here, '..', '..', 'track-viewer', 'package.json'))('sharp');
const boards = join(here, '..', '..', 'assets', 'sponsors', 'boards'), W = 1024, H = 341, cols = 2;
const names = ['bjp', 'cocacola', 'emirates', 'jio', 'oppo', 'pirelli', 'rolex', 'sony', 'vivo'], rows = Math.ceil(names.length / cols), cells = [];
for (const [i, n] of names.entries()) {
  const input = await sharp(join(boards, `${n}-3000.png`)).resize(W, H, { fit: 'fill' }).flatten({ background: '#ffffff' }).png().toBuffer();
  cells.push({ input, left: (i % cols) * W, top: Math.floor(i / cols) * H });
}
await sharp({ create: { width: cols * W, height: rows * H, channels: 3, background: '#202020' } }).composite(cells).png().toFile(join(here, 'tex', 'road_ads.png'));
console.log(`${names.length} boards -> tex/road_ads.png (${cols} x ${rows})`);
