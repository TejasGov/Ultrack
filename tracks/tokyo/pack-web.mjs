// Tokyo web build, the same steps as track-viewer/scripts/pack-web.mjs for Marina (read its header for why each flag):
//   node tracks/tokyo/pack-web.mjs      after game_v11.py   ->  tracks/tokyo/out/web/tokyo_{visual,collision,visual_ktx2,*_shell,*_sectors}.glb
import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const out = join(root, 'tracks', 'tokyo', 'out');
const viewer = join(root, 'track-viewer');
process.env.TRACK = 'tokyo';
process.env.TEX_MAX ??= '4096';
process.env.SHELL_RE ??= 'frontage|stand|castle|romon|lantern|neon_shrine|timber';
process.env.NO_JOIN ??= '1';            // v13.1: the distance tiers are separate named meshes (track-viewer/src/perf.js Culler reads the `~lo-hi` tag), never joined
process.env.SKIP_SHELL ??= '1';         // v13.1: the hidden-face audit would run on the full-detail frontages; skipped
process.env.SECTOR_RE ??= '.';          // every mesh over 1,500 triangles that spans more than one 768 m cell
mkdirSync(join(out, 'web'), { recursive: true });
const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const gt = (...args) => execFileSync(npx, ['-y', '@gltf-transform/cli@4', ...args], { stdio: 'inherit', shell: true, cwd: viewer });
const q16 = ['--level', 'high', '--quantize-position', '16'];
const tmp = join(out, 'web', '_opt.glb');
gt('optimize', join(out, 'tokyo_visual.glb'), tmp, '--compress', 'false', '--texture-compress', 'webp', '--texture-size', '4096', '--simplify', 'false', '--palette', 'false', ...(process.env.NO_JOIN ? ['--join', 'false'] : []));
gt('meshopt', tmp, join(out, 'web', 'tokyo_visual.glb'), ...q16);
gt('optimize', join(out, 'tokyo_collision.glb'), tmp, '--compress', 'false', '--texture-compress', 'false', '--simplify', 'false', '--weld', 'false', '--join', 'false');
cpSync(tmp, join(out, 'web', 'tokyo_collision.glb'));       // not rounded: 16 bits of a whole track is 2-3 cm, and the car feels it as ripple on every slope
rmSync(tmp);
const run = (script) => execFileSync(process.execPath, [join(viewer, 'scripts', script)], { stdio: 'inherit', cwd: viewer, env: process.env });
run('pack-ktx2.mjs');
if (!process.env.SKIP_SHELL) run('shell-venue.mjs');     // hidden-face removal runs Blender (-b): one Blender process at a time
run('partition-venue.mjs');
