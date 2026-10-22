// Every web build of the track, with the flags that matter, in one command (after the Blender build):
//   npm run pack   ->  out/web/marina_visual.glb (WebP), out/web/marina_collision.glb, out/web/marina_visual_ktx2.glb
// Two steps per GLB: optimize without compression, then meshopt with 16-bit positions. optimize's built-in meshopt uses
// 14 bits, a 12 cm grid on meshes that span the venue: 9 cm fence posts vanish and thin arms become floating planks.
//   --palette false     the viewer finds beacons, neon, turf, flags and the screen by material name
//   --simplify false    simplification flattens the ground grid that carries the sand colour (COLOR_0)
//   --join false        (collision only) keeps one object per surface: asphalt, kerb, sand, wall... = grip in the game
import { execFileSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const out = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'tracks', 'marina', 'out');
const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const gt = (...args) => execFileSync(npx, ['-y', '@gltf-transform/cli@4', ...args], { stdio: 'inherit', shell: true });
const q16 = ['--level', 'high', '--quantize-position', '16'];

const tmp = join(out, 'web', '_opt.glb');
gt('optimize', join(out, 'marina_visual.glb'), tmp, '--compress', 'false', '--texture-compress', 'webp', '--texture-size', '2048',
  '--simplify', 'false', '--palette', 'false');
gt('meshopt', tmp, join(out, 'web', 'marina_visual.glb'), ...q16);
gt('optimize', join(out, 'marina_collision.glb'), tmp, '--compress', 'false', '--texture-compress', 'false', '--simplify', 'false',
  '--weld', 'false', '--join', 'false');
gt('meshopt', tmp, join(out, 'web', 'marina_collision.glb'), ...q16);
rmSync(tmp);
await import('./pack-ktx2.mjs');
await import('./shell-venue.mjs');
await import('./partition-venue.mjs');
