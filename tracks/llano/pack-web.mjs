// Llano web build, the same steps as track-viewer/scripts/pack-web.mjs for Marina (read its header for why each flag):
//   node tracks/llano/pack-web.mjs    after build_llano.py ->  tracks/llano/out/web/llano_{visual,collision,visual_ktx2,*_sectors}.glb
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const out = join(root, 'tracks', 'llano', 'out');
const viewer = join(root, 'track-viewer');
process.env.TRACK = 'llano';
process.env.TEX_MAX ??= '2048';


process.env.SKIP_SHELL ??= '1';         // no hidden-face pass (needs Blender)
process.env.SECTOR_RE ??= '.';          // every mesh over 1,500 triangles that spans more than one 768 m cell
mkdirSync(join(out, 'web'), { recursive: true });
const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const gt = (...args) => execFileSync(npx, ['-y', '@gltf-transform/cli@4', ...args], { stdio: 'inherit', shell: true, cwd: viewer });
const q16 = ['--level', 'high', '--quantize-position', '16'];
const tmp = join(out, 'web', '_opt.glb');
gt('optimize', join(out, 'llano_visual.glb'), tmp, '--compress', 'false', '--texture-compress', 'webp', '--texture-size', '2048', '--simplify', 'false', '--palette', 'false', ...(process.env.NO_JOIN ? ['--join', 'false'] : []));
gt('meshopt', tmp, join(out, 'web', 'llano_visual.glb'), ...q16);
gt('optimize', join(out, 'llano_collision.glb'), tmp, '--compress', 'false', '--texture-compress', 'false', '--simplify', 'false', '--weld', 'false', '--join', 'false');
gt('meshopt', tmp, join(out, 'web', 'llano_collision.glb'), ...q16);
rmSync(tmp);
const run = (script) => execFileSync(process.execPath, [join(viewer, 'scripts', script)], { stdio: 'inherit', cwd: viewer, env: process.env });
run('pack-ktx2.mjs');
if (!process.env.SKIP_SHELL) run('shell-venue.mjs');     // hidden-face removal runs Blender (-b): one Blender process at a time
run('partition-venue.mjs');
