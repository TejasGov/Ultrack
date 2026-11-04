// Qingshan web build, the same steps as track-viewer/scripts/pack-web.mjs for Marina (read its header for why each flag):
//   node tracks/qingshan/pack-web.mjs    after build_qingshan.py ->  tracks/qingshan/out/web/qingshan_{visual,collision,visual_ktx2,*_sectors}.glb
import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const out = join(root, 'tracks', 'qingshan', 'out');
const viewer = join(root, 'track-viewer');
process.env.TRACK = 'qingshan';
process.env.TEX_MAX ??= '2048';


process.env.NO_JOIN ??= '1';            // the tree tiers are separate named sets (`~lo-hi`, perf.js Culler), never joined: joining is what would turn the forest into one huge mesh
process.env.SKIP_SHELL ??= '1';         // no hidden-face pass (needs Blender)
process.env.SECTOR_RE ??= '.';          // every mesh over 1,500 triangles that spans more than one 768 m cell
mkdirSync(join(out, 'web'), { recursive: true });
const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const gt = (...args) => execFileSync(npx, ['-y', '@gltf-transform/cli@4', ...args], { stdio: 'inherit', shell: true, cwd: viewer });
const q16 = ['--level', 'high', '--quantize-position', '16'];
const tmp = join(out, 'web', '_opt.glb');
// Surfaces the driver only ever sees from a distance get smaller textures, in the Blender export itself so both web builds share them. Nearest each comes to the road, measured from the geometry
// (2026-11-04): forest floor 40 m, boardwalk 40, hall red plaster 45, turbine paint 32, shed cladding 91, cedar 104. Anything also used near the road stays sharp. Safe to run twice.
const FAR_TEX = [[/^(forest_leaves_02|red_plaster_weathered|weathered_planks|white_stucco)_/, 1024], [/^japanese_cedar_planks_|^painted_metal_shutter_diff/, 512]];
{
  const req = createRequire(join(viewer, 'package.json')), { NodeIO } = req('@gltf-transform/core'), { ALL_EXTENSIONS } = req('@gltf-transform/extensions'), sharp = req('sharp');
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS), doc = await io.read(join(out, 'qingshan_visual.glb')); let n = 0;
  for (const t of doc.getRoot().listTextures()) {
    const size = FAR_TEX.find(([re]) => re.test(t.getName()))?.[1];
    if (!size || t.getSize()[0] <= size) continue;
    const s = sharp(t.getImage()).resize(size, size); t.setImage(new Uint8Array(await (t.getMimeType() === 'image/png' ? s.png() : s.jpeg({ quality: 95 })).toBuffer())); n++;
  }
  if (n) await io.write(join(out, 'qingshan_visual.glb'), doc);
  console.log('far textures shrunk:', n);
}
gt('optimize', join(out, 'qingshan_visual.glb'), tmp, '--compress', 'false', '--texture-compress', 'webp', '--texture-size', '2048', '--simplify', 'false', '--palette', 'false', ...(process.env.NO_JOIN ? ['--join', 'false'] : []));
gt('meshopt', tmp, join(out, 'web', 'qingshan_visual.glb'), ...q16);
gt('optimize', join(out, 'qingshan_collision.glb'), tmp, '--compress', 'false', '--texture-compress', 'false', '--simplify', 'false', '--weld', 'false', '--join', 'false');
cpSync(tmp, join(out, 'web', 'qingshan_collision.glb'));       // not rounded: 16 bits of a whole track is 2-3 cm, and the car feels it as ripple on every slope
rmSync(tmp);
const run = (script) => execFileSync(process.execPath, [join(viewer, 'scripts', script)], { stdio: 'inherit', cwd: viewer, env: process.env });
run('pack-ktx2.mjs');
if (!process.env.SKIP_SHELL) run('shell-venue.mjs');     // hidden-face removal runs Blender (-b): one Blender process at a time
run('partition-venue.mjs');
