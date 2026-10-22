// Copy the built track and the look HDRIs into public/assets (the viewer never edits them; rebuild in Blender instead).
import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync, unlinkSync } from 'node:fs';
import { dirname, join, relative, resolve, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const out = join(root, 'tracks', 'marina', 'out');
const dest = join(root, 'track-viewer', 'public', 'assets');
const files = [
  [join(out, 'web', 'marina_visual.glb'), 'marina_visual.glb'],
  [join(out, 'web', 'marina_visual_ktx2.glb'), 'marina_visual_ktx2.glb'],   // node scripts/pack-ktx2.mjs
  [join(out, 'track.json'), 'track.json'],
  [join(out, 'web', 'marina_collision.glb'), 'marina_collision.glb'],   // Rapier ground, kerbs, run-off and walls (src/physics)
  [join(out, 'lights.json'), 'lights.json'],
  [join(out, 'vip.json'), 'vip.json'],
  ...['belfast_sunset_puresky', 'qwantani_dusk_1_puresky', 'qwantani_night_puresky'].map((id) =>
    [join(root, 'assets', 'polyhaven', id, `${id}_2k.hdr`), `hdri/${id}_2k.hdr`]),
];
for (const [original, rel] of files) {
  const shell=original.replace(/\.glb$/,'_shell.glb');
  const src=rel.startsWith('marina_visual')&&existsSync(shell)&&statSync(shell).mtimeMs>=statSync(original).mtimeMs?shell:original;
  if (!existsSync(src)) throw new Error(`missing ${src}: build the track first (see tracks/marina/README.md)`);
  mkdirSync(dirname(join(dest, rel)), { recursive: true });
  copyFileSync(src, join(dest, rel));
}
// characters (Mixamo + Meshy, compressed): assets/characters/web/*.glb -> /assets/characters/
const chars = join(root, 'assets', 'characters', 'web');
if (existsSync(chars)) {
  mkdirSync(join(dest, 'characters'), { recursive: true });
  for (const f of readdirSync(chars).filter((f) => f.endsWith('.glb'))) copyFileSync(join(chars, f), join(dest, 'characters', f));
}
// car bodies (derived game meshes, scripts/derive-car-lods.mjs): assets/cars/<key>/body_lod*.glb -> /assets/cars/<key>/
const cars = join(root, 'assets', 'cars');
if (existsSync(cars)) {
  for (const key of readdirSync(cars).filter((f) => existsSync(join(cars, f, 'body_lod0.glb')) || existsSync(join(cars, f, 'car_lod0.glb')))) {
    mkdirSync(join(dest, 'cars', key), { recursive: true });
    for (const f of ['body_lod0.glb', 'body_lod1.glb', 'car_lod0.glb', 'car_lod1.glb', 'car_lod0_ktx2.glb', 'car_lod1_ktx2.glb', 'license.json']) if (existsSync(join(cars, key, f))) copyFileSync(join(cars, key, f), join(dest, 'cars', key, f));   // car_*: complete models (scripts/model-car.py)
  }
}
// game audio (assets/audio, see its README): every shipped folder, announcer voices and the manifests, without the
// src/ masters; copied only when a file is new or changed (the voices are ~50 MB)
const audio = join(root, 'assets', 'audio');
if (existsSync(audio)) {
  const copyTree = (from, to) => {
    for (const e of readdirSync(from, { withFileTypes: true })) {
      if (e.name === 'src' || e.name.startsWith('_') || e.name === 'voice-previews') continue;
      if (from===audio&&['exhaust','nitro','engine-sim-bank.json','engine-sim-receipts.json'].includes(e.name)) continue;
      if (from===join(audio,'engines')&&e.name!=='recorded') continue;
      const a = join(from, e.name), b = join(to, e.name);
      if (e.isDirectory()) { copyTree(a, b); continue; }
      if (!/\.(ogg|json)$/.test(e.name)) continue;
      if (existsSync(b) && statSync(b).size === statSync(a).size && statSync(b).mtimeMs >= statSync(a).mtimeMs) continue;
      mkdirSync(to, { recursive: true }); copyFileSync(a, b);
    }
  };
  // Remove only previously copied legacy engine/SFX files from the derived
  // public folder. Source recordings, announcers and unrelated effects stay put.
  const publicAudio=join(dest,'audio');
  const prune=dir=>{
    const checked=relative(resolve(publicAudio),resolve(dir));
    if(!checked||checked.startsWith('..')||isAbsolute(checked))throw Error('Legacy audio cleanup escaped public/assets/audio.');
    if(!existsSync(dir))return;
    for(const e of readdirSync(dir,{withFileTypes:true})){
      const p=join(dir,e.name);
      if(e.isDirectory())prune(p);else if(/\.(ogg|json)$/.test(e.name))unlinkSync(p);
    }
  };
  for(const folder of ['exhaust','nitro'])prune(join(publicAudio,folder));
  const oldEngines=join(publicAudio,'engines');
  if(existsSync(oldEngines))for(const e of readdirSync(oldEngines,{withFileTypes:true}))if(e.isDirectory()&&e.name!=='recorded')prune(join(oldEngines,e.name));
  for(const name of ['engine-sim-bank.json','engine-sim-receipts.json']){const file=join(publicAudio,name);if(existsSync(file))unlinkSync(file);}
  copyTree(audio, join(dest, 'audio'));
}
// Basis transcoder for the KTX2 build (three's KTX2Loader loads it from /basis/)
const basis = join(root, 'track-viewer', 'node_modules', 'three', 'examples', 'jsm', 'libs', 'basis');
mkdirSync(join(root, 'track-viewer', 'public', 'basis'), { recursive: true });
for (const f of ['basis_transcoder.js', 'basis_transcoder.wasm']) copyFileSync(join(basis, f), join(root, 'track-viewer', 'public', 'basis', f));
console.log(`synced ${files.length} assets into public/assets`);
// Small baked loading stills; never load a live track just to draw a loading screen.
const loadingArt=join(root,'assets','loading');
if(existsSync(loadingArt)){
  mkdirSync(join(dest,'loading'),{recursive:true});
  for(const f of readdirSync(loadingArt))if(f.endsWith('.webp'))copyFileSync(join(loadingArt,f),join(dest,'loading',f));
}

// Original sponsor marks are local assets; gameplay never depends on third-party CDNs.
const sponsors=join(root,'assets','sponsors');
mkdirSync(join(dest,'sponsors','logos'),{recursive:true});
copyFileSync(join(sponsors,'manifest.json'),join(dest,'sponsors','manifest.json'));
for(const file of readdirSync(join(sponsors,'logos')))copyFileSync(join(sponsors,'logos',file),join(dest,'sponsors','logos',file));

copyFileSync(join(root,'assets','brand','ultrack_logo_alpha.webp'),join(dest,'brand','ultrack-alpha.webp'));

// Prebuilt team identities: no runtime font rendering for team wordmarks.
const teamLogos=join(root,'assets','teams','logos'),publicTeamLogos=join(dest,'teams','logos');
mkdirSync(publicTeamLogos,{recursive:true});
for(const file of readdirSync(teamLogos))if(/\.(svg|png|webp|json)$/.test(file))copyFileSync(join(teamLogos,file),join(publicTeamLogos,file));
copyFileSync(join(root,'assets','teams','brand-guide.html'),join(root,'track-viewer','public','team-brand-guide.html'));

// Driver artwork is requested by review pages or race intros, never during game startup.
// Keep originals and build scripts out of the published folder.
const driverRoot=join(root,'assets','drivers');
if(existsSync(driverRoot)){
  for(const entry of readdirSync(driverRoot,{withFileTypes:true})){
    if(!entry.isDirectory())continue;
    const from=join(driverRoot,entry.name);if(!existsSync(join(from,'poster-v1.png')))continue;
    const to=join(dest,'drivers',entry.name);mkdirSync(to,{recursive:true});
    for(const file of ['illustration-v1.webp','poster-v1.png','poster-v1.svg','poster-thumb.webp','poster-game.webp','poster-hoarding.webp','intro.json','intro-v1.html'])if(existsSync(join(from,file)))copyFileSync(join(from,file),join(to,file));
  }
  const matteo=join(driverRoot,'matteo-varrone','intro-v1.html');
  if(existsSync(matteo))copyFileSync(matteo,join(root,'track-viewer','public','driver-intro.html'));
  const gallery=join(driverRoot,'gallery.html');
  if(existsSync(gallery))copyFileSync(gallery,join(root,'track-viewer','public','driver-posters.html'));
}
