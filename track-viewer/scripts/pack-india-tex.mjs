// India's photo textures (CC0 Poly Haven, assets/polyhaven/<slug>/) -> compressed KTX2 sets for src/venue/india/materials.js.
//   node scripts/pack-india-tex.mjs        (also run by sync-assets.mjs; only sets that are new or changed)
// The same two-file format as scripts/pack-tokyo-tex.mjs, in public/assets/india/tex/ (the GPU keeps them compressed):
//   <slug>_d.ktx2  albedo, sRGB, ETC1S
//   <slug>_n.ktx2  linear RGBA, UASTC: R,G = normal x,y (OpenGL, +y up), B = roughness, A = ambient occlusion
// The image is flipped, so row 0 is the picture's bottom and v grows upward. manifest.json carries each set's mean linear albedo,
// roughness and AO: the shader divides by them, so a texture only adds variation and each surface keeps its baked colour.
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { encodeToKTX2 } from 'ktx2-encoder';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const src = join(root, 'assets', 'polyhaven'), dst = join(root, 'track-viewer', 'public', 'assets', 'india', 'tex');
// pixels per side: 1k where the texture is seen up close at speed (road, kerb paint, cut walls), 512 where it is soft or far
export const SETS = {
  asphalt_track: 1024, brushed_concrete: 512, concrete_wall_009: 1024, japanese_stone_wall: 1024,
  white_plaster_02: 512, leafy_grass: 512, aerial_sand: 512,
};
const decoder = async (b) => { const { data, info } = await sharp(b).ensureAlpha().raw().toBuffer({ resolveWithObject: true }); return { data: new Uint8Array(data), width: info.width, height: info.height }; };
const raw = async (file, size) => (await sharp(file).resize(size, size, { kernel: 'lanczos3' }).flip().removeAlpha().raw().toBuffer({ resolveWithObject: true })).data;
const lin = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
mkdirSync(dst, { recursive: true });
const manifestFile = join(dst, 'manifest.json');
const manifest = existsSync(manifestFile) ? JSON.parse(readFileSync(manifestFile, 'utf8')) : {};
for (const [slug, size] of Object.entries(SETS)) {
  const dir = join(src, slug), have = existsSync(dir) ? readdirSync(dir) : [];
  const f = (k) => { const m = have.find((n) => n.startsWith(`${slug}_${k}_`) && /\.(jpg|png)$/.test(n)); return m && join(dir, m); };   // 1k or 2k source, whichever is on disk
  const outD = join(dst, `${slug}_d.ktx2`), outN = join(dst, `${slug}_n.ktx2`);
  if (!['diff', 'nor_gl', 'arm'].every(f)) { console.warn(`india tex ${slug}: sources missing in assets/polyhaven, skipped (materials.js keeps the plain colour)`); continue; }
  const newest = Math.max(...['diff', 'nor_gl', 'arm'].map((k) => statSync(f(k)).mtimeMs));
  if (manifest[slug]?.size === size && existsSync(outD) && existsSync(outN) && statSync(outD).mtimeMs >= newest && statSync(outN).mtimeMs >= newest) continue;
  const [d, n, a] = await Promise.all([raw(f('diff'), size), raw(f('nor_gl'), size), raw(f('arm'), size)]);
  const px = size * size, rgbaD = Buffer.alloc(px * 4), rgbaN = Buffer.alloc(px * 4);
  const sum = [0, 0, 0], lut = Array.from({ length: 256 }, (_, i) => lin(i));
  let sr = 0, sa = 0;
  for (let i = 0; i < px; i++) {
    for (let c = 0; c < 3; c++) { rgbaD[i * 4 + c] = d[i * 3 + c]; sum[c] += lut[d[i * 3 + c]]; }
    rgbaD[i * 4 + 3] = 255;
    rgbaN[i * 4] = n[i * 3]; rgbaN[i * 4 + 1] = n[i * 3 + 1];
    rgbaN[i * 4 + 2] = a[i * 3 + 1]; rgbaN[i * 4 + 3] = a[i * 3];       // roughness (arm.g), ambient occlusion (arm.r)
    sr += a[i * 3 + 1] / 255; sa += a[i * 3] / 255;
  }
  const png = (buf) => sharp(buf, { raw: { width: size, height: size, channels: 4 } }).png().toBuffer();
  const common = { imageDecoder: decoder, generateMipmap: true, isKTX2File: true };
  const kd = await encodeToKTX2(new Uint8Array(await png(rgbaD)), { ...common, isUASTC: false, qualityLevel: 170, compressionLevel: 2, isPerceptual: true, isSetKTX2SRGBTransferFunc: true });
  const kn = await encodeToKTX2(new Uint8Array(await png(rgbaN)), { ...common, isUASTC: true, uastcLDRQualityLevel: 2, enableRDO: true, rdoQualityLevel: 1.5, needSupercompression: true, isPerceptual: false, isSetKTX2SRGBTransferFunc: false });
  writeFileSync(outD, kd); writeFileSync(outN, kn);
  manifest[slug] = { size, avg: sum.map((s) => +(s / px).toFixed(4)), rough: +(sr / px).toFixed(4), ao: +(sa / px).toFixed(4) };
  console.log(`india tex ${slug}: ${size}px, ${(kd.length / 1e3).toFixed(0)} + ${(kn.length / 1e3).toFixed(0)} kB`);
}
writeFileSync(manifestFile, JSON.stringify(manifest, null, 1));
