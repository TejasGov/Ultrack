// The press photos (assets/career/MEDIA-IMAGES.md): sources/driver-media/<slug>/<mood>.png -> public/assets/drivers/<slug>/media/<mood>.webp, and the list of what exists in assets/career/media.json.
// sources/driver-media/pairs/<id>.png -> public/assets/drivers/pairs/<id>.webp; the pair's id is the two surnames, a-b.   node scripts/make-driver-media.mjs
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';

const root = new URL('../../', import.meta.url), src = new URL('sources/driver-media/', root), out = new URL('track-viewer/public/assets/drivers/', root), manifest = new URL('assets/career/media.json', root);
const teams = JSON.parse(readFileSync(new URL('assets/teams/teams.json', root))).teams.flatMap((t) => t.cars.map((c) => c.driver));
const slug = (name) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
const webp = (from, to, width) => {
  if (existsSync(to) && !process.argv.includes('--force')) return;
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', decodeURIComponent(from.pathname.slice(1)), '-vf', `scale=${width}:-2:flags=lanczos`, '-frames:v', '1', '-c:v', 'libwebp', '-quality', '80', '-compression_level', '6', decodeURIComponent(to.pathname.slice(1))]);
};
const media = JSON.parse(readFileSync(manifest, 'utf8'));
media.images = {};
for (const d of teams) {
  const dir = new URL(`${slug(d.name)}/`, src); if (!existsSync(dir)) continue;
  const moods = readdirSync(dir).filter((f) => f.endsWith('.png')).map((f) => f.slice(0, -4)).sort(); if (!moods.length) continue;
  mkdirSync(new URL(`${slug(d.name)}/media/`, out), { recursive: true });
  for (const m of moods) webp(new URL(`${m}.png`, dir), new URL(`${slug(d.name)}/media/${m}.webp`, out), m === 'portrait' ? 800 : 1200);
  media.images[d.code] = moods;
}
const pairs = new URL('pairs/', src); media.pairs = [];
if (existsSync(pairs)) {
  mkdirSync(new URL('pairs/', out), { recursive: true });
  for (const f of readdirSync(pairs).filter((n) => n.endsWith('.png'))) {
    const id = f.slice(0, -4), drivers = id.split('-').map((sn) => teams.find((d) => slug(d.name.split(' ').at(-1)) === sn)?.code);
    if (drivers.some((c) => !c)) throw Error(`pair ${id}: name it by the two surnames`);
    webp(new URL(f, pairs), new URL(`pairs/${id}.webp`, out), 1200); media.pairs.push({ id, drivers });
  }
}
writeFileSync(manifest, JSON.stringify(media, null, 2).replace(/\[\n\s+("[^\]]+?")\n\s+\]/g, (m, a) => `[${a.replace(/\n\s+/g, ' ')}]`) + '\n');
console.log(Object.entries(media.images).map(([c, m]) => `${c}: ${m.join(', ')}`).join('\n') + `\npairs: ${media.pairs.length}`);
