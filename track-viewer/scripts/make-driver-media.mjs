// The press photos (assets/career/MEDIA-IMAGES.md): sources/driver-media/<folder>/<name>.png -> public/assets/drivers/..., each as a full image and a -thumb.webp for tiles and bytes,
// and the lists of what exists in assets/career/media.json. Folders: <driver slug>/<mood> -> <slug>/media/<mood>; pairs/<a-b> (the two surnames); you/<name>; principals/<team id>; scenes/<id>.
// Skips what is already built; --force rebuilds.   node scripts/make-driver-media.mjs [--force]
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';

const root = new URL('../../', import.meta.url), src = new URL('sources/driver-media/', root), out = new URL('track-viewer/public/assets/drivers/', root), manifest = new URL('assets/career/media.json', root);
const teams = JSON.parse(readFileSync(new URL('assets/teams/teams.json', root))).teams.flatMap((t) => t.cars.map((c) => c.driver));
const slug = (name) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-'), path = (u) => decodeURIComponent(u.pathname.slice(1));
const force = process.argv.includes('--force');
const ffmpeg = (from, to, width, quality) => { if (!existsSync(to) || force) execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', path(from), '-vf', `scale=${width}:-2:flags=lanczos`, '-frames:v', '1', '-c:v', 'libwebp', '-quality', String(quality), '-compression_level', '6', path(to)]); };
/** one source image: the full copy (1200 wide; the older square portraits 800, their display is narrower) and a 480 wide thumbnail, which is what a tile needs */
function build(from, dir, name) {
  mkdirSync(dir, { recursive: true });
  const [w, h] = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', path(from)]).toString().trim().split(',').map(Number);
  ffmpeg(from, new URL(`${name}.webp`, dir), w === h ? 800 : 1200, 80);
  ffmpeg(from, new URL(`${name}-thumb.webp`, dir), 480, 72);
}
const pngs = (dir) => (existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.png')).map((f) => f.slice(0, -4)).sort() : []);
const media = JSON.parse(readFileSync(manifest, 'utf8'));
media.images = {};
for (const d of teams) {
  const dir = new URL(`${slug(d.name)}/`, src), moods = pngs(dir); if (!moods.length) continue;
  for (const m of moods) build(new URL(`${m}.png`, dir), new URL(`${slug(d.name)}/media/`, out), m);
  media.images[d.code] = moods;
}
for (const [folder, key] of [['you', 'you'], ['principals', 'principals'], ['scenes', 'scenes']]) {
  media[key] = pngs(new URL(`${folder}/`, src));
  for (const n of media[key]) build(new URL(`${folder}/${n}.png`, src), new URL(`${folder}/`, out), n);
}
media.pairs = pngs(new URL('pairs/', src)).map((id) => {
  const drivers = id.split('-').map((sn) => teams.find((d) => slug(d.name.split(' ').at(-1)) === sn)?.code);
  if (drivers.some((c) => !c)) throw Error(`pair ${id}: name it by the two surnames`);
  build(new URL(`pairs/${id}.png`, src), new URL('pairs/', out), id);
  return { id, drivers };
});
writeFileSync(manifest, JSON.stringify(media, null, 2).replace(/\[\n\s+("[^\]]+?")\n\s+\]/g, (m, a) => `[${a.replace(/\n\s+/g, ' ')}]`) + '\n');
console.log(`${Object.keys(media.images).length} drivers, ${media.pairs.length} pairs, ${media.you.length} you, ${media.principals.length} principals, ${media.scenes.length} scenes`);
