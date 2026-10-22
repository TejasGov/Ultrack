const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const sharp = require(require.resolve('sharp', { paths: [path.join(__dirname, '../../../track-viewer')] }));
const out = __dirname;
const svg = path.join(out, 'poster-v1.svg');
const png = path.join(out, 'poster-v1.png');
(async () => {
  await sharp(svg, { density: 72 }).resize(1920, 1080).png({ compressionLevel: 8 }).toFile(png);
  const metaPath = path.join(out, 'intro.json');
  const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
  const sha256 = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
  for (const name of ['poster-v1.png', 'poster-v1.svg']) meta.outputs[name] = { sha256: sha256(path.join(out, name)) };
  fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2) + '\n');
})();
