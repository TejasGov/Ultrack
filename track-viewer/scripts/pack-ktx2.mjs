// KTX2 (Basis Universal) build of the track: the GPU keeps textures compressed (BC7/BC1/ASTC/ETC after transcoding),
// so they take ~4-8x less VRAM than the WebP build, which the browser decodes to raw RGBA.
//   node scripts/pack-ktx2.mjs   (after the Blender build; reads out/marina_visual.glb, writes out/web/marina_visual_ktx2.glb)
// Geometry goes through the same gltf-transform optimize settings as the WebP build, then textures become KTX2:
// the road's normal map UASTC, everything else ETC1S. sRGB flags follow the slot.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, rmSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Material, NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { textureCompress } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';
import { ktx2 } from 'ktx2-encoder/gltf-transform';
import sharp from 'sharp';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const TRACK = process.env.TRACK ?? 'marina';
const TEX_MAX = Number(process.env.TEX_MAX ?? 2048);   // Tokyo's 8192 px panorama bands need 4096   // TRACK=tokyo reads tracks/tokyo/out/tokyo_visual.glb
const out = join(root, 'tracks', TRACK, 'out');
const src = join(out, `${TRACK}_visual.glb`);
const tmp = join(out, 'web', '_geometry.glb');
const dst = join(out, 'web', `${TRACK}_visual_ktx2.glb`);
if (!existsSync(src)) throw new Error(`missing ${src}: build the track first`);

// 1. geometry: identical to the WebP build (see tracks/marina/README.md), textures left as they are
// (optimize without compression, then meshopt with 16-bit positions: 14-bit, the optimize default, is a 12 cm grid on
// meshes that span the venue, which collapses 9 cm fence posts and turns thin arms into floating planks)
const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const tmp0 = join(out, 'web', '_opt.glb');
execFileSync(npx, ['-y', '@gltf-transform/cli@4', 'optimize', src, tmp0,
  '--compress', 'false', '--texture-compress', 'false', '--simplify', 'false', '--palette', 'false', ...(process.env.NO_JOIN ? ['--join', 'false'] : [])], { stdio: 'inherit', shell: true });   // NO_JOIN: Tokyo's distance tiers are separate named meshes
execFileSync(npx, ['-y', '@gltf-transform/cli@4', 'meshopt', tmp0, tmp, '--level', 'high', '--quantize-position', '16'],
  { stdio: 'inherit', shell: true });
rmSync(tmp0);

await MeshoptDecoder.ready;
await MeshoptEncoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });
const doc = await io.read(tmp);

const imageDecoder = async (buffer) => {
  const { data, info } = await sharp(buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data: new Uint8Array(data), width: info.width, height: info.height };
};
const common = { generateMipmap: true, imageDecoder };
await doc.transform(textureCompress({ encoder: sharp, resize: [TEX_MAX, TEX_MAX] }));   // same cap as the WebP build; keeps the format
// Compressed mip chains need power-of-two sizes: the 1536x393 logo uploaded with missing levels and rendered black.
// UVs span 0..1, so stretching to the next power of two changes nothing on screen.
const pot = (n) => 2 ** Math.ceil(Math.log2(n));
for (const t of doc.getRoot().listTextures()) {
  const [w, h] = t.getSize() || [0, 0];
  if (!w || (pot(w) === w && pot(h) === h)) continue;
  t.setImage(new Uint8Array(await sharp(t.getImage()).resize(Math.min(TEX_MAX, pot(w)), Math.min(TEX_MAX, pot(h)), { fit: 'fill' }).png().toBuffer()));
  t.setMimeType('image/png');
}
// TEX_CAPS: a JSON file of { material name regex: largest px }, for surfaces a driver only sees from afar (tracks/venice/texture_caps.json). A texture shrinks only if every material using it has a cap, so one shared with a near surface stays sharp.
if (process.env.TEX_CAPS) {
  const caps = Object.entries(JSON.parse(readFileSync(process.env.TEX_CAPS, 'utf8'))).map(([re, px]) => [new RegExp(re), px]), done = [];
  for (const t of doc.getRoot().listTextures()) {
    const mats = doc.getGraph().listParents(t).filter((p) => p instanceof Material), [w, h] = t.getSize() || [0, 0];
    const each = mats.map((m) => caps.find(([re]) => re.test(m.getName()))?.[1]);
    if (!mats.length || !w || each.some((c) => !c)) continue;
    const cap = Math.max(...each);
    if (Math.max(w, h) <= cap) continue;
    t.setImage(new Uint8Array(await sharp(t.getImage()).resize(Math.min(w, cap), Math.min(h, cap), { fit: 'fill', kernel: 'lanczos3' }).png().toBuffer())); t.setMimeType('image/png');
    done.push(`${t.getName()} (${mats[0].getName()}) ${w} -> ${Math.min(w, cap)}`);
  }
  console.log(`texture caps: ${done.length} shrunk\n  ${done.join('\n  ')}`);
}
await doc.transform(
  // the race surface's normal map is what the camera sees most: UASTC keeps its grain; other normal maps are ETC1S in
  // normal-map mode (UASTC for all of them tripled the download for little visible gain)
  ktx2({ ...common, pattern: /asphalt_track_nor/, isUASTC: true, isNormalMap: true, needSupercompression: true, uastcLDRQualityLevel: 2, enableRDO: true, rdoQualityLevel: 2 }),
  ktx2({ ...common, slots: /normalTexture/, isUASTC: false, isNormalMap: true, qualityLevel: 200, compressionLevel: 2, isPerceptual: false }),
  ktx2({ ...common, slots: /baseColorTexture|emissiveTexture/, isUASTC: false, qualityLevel: 160, compressionLevel: 2,
    isPerceptual: true, isSetKTX2SRGBTransferFunc: true }),
  ktx2({ ...common, isUASTC: false, qualityLevel: 160, compressionLevel: 2, isPerceptual: false, isSetKTX2SRGBTransferFunc: false }),
);
const left = doc.getRoot().listTextures().filter((t) => t.getMimeType() !== 'image/ktx2');
if (left.length) console.warn(`not converted: ${left.map((t) => t.getName() || t.getURI()).join(', ')}`);
await io.write(dst, doc);
rmSync(tmp);
console.log(`${dst}: ${(statSync(dst).size / 1e6).toFixed(2)} MB, ${doc.getRoot().listTextures().length} textures`);
