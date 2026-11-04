// The public build: the game's code only, with /assets/* redirected to the bucket that holds the 3D assets (scripts/deploy-upload-assets.mjs), because the assets are
// far over Vercel Hobby's 100 MB upload limit. Run it from a clean checkout's track-viewer, so nobody's unfinished edits ship.
//   node scripts/deploy-build.mjs https://pub-xxxx.r2.dev [outDir=dist-deploy]     then: vercel deploy dist-deploy --prod
// The bundles go to /app, not Vite's default /assets, so the redirect catches only the bucket's files.
import { build } from 'vite';
import { execSync } from 'node:child_process';
import { cpSync, existsSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const [assetsUrl, outDir = 'dist-deploy'] = process.argv.slice(2);
if (!/^https:\/\/\S+[^/]$/.test(assetsUrl ?? '')) throw new Error('Pass the bucket URL, https and no trailing slash');
// the track files' versions, from git so a checkout without LFS smudging still has them (tracks.js revUrl): a changed file gets a new URL and no browser keeps the old one
const REV = Object.fromEntries(execSync('git ls-tree -r HEAD -- public/assets', { encoding: 'utf8', maxBuffer: 1 << 26 }).split('\n').map((l) => l.split('\t'))
  .filter(([, p]) => /(track\.json|lights\.json|vip\.json|_collision\.glb|_visual(_ktx2)?\.glb|stills\/tracks\/\w+\.webp)$/.test(p ?? '')).map(([m, p]) => [p.replace(/^public/, ''), m.split(' ')[2].slice(0, 10)]));
if (!REV['/assets/shajawa/track.json']) throw new Error('No track file versions from git');
await build({ define: { __ASSET_REV__: JSON.stringify(REV) }, build: { outDir, emptyOutDir: true, assetsDir: 'app', copyPublicDir: false, rollupOptions: { input: { game: 'index.html' } } } });
rmSync(join(outDir, 'audio-lab.html'), { force: true });      // a developer tool, the config's second page
cpSync(join('public', 'basis'), join(outDir, 'basis'), { recursive: true });       // the KTX2 transcoder stays with the page
cpSync(join('public', 'assets', 'ui', 'icons.svg'), join(outDir, 'assets', 'ui', 'icons.svg'));       // <use href> refuses another domain, so the icon sprite stays too
writeFileSync(join(outDir, 'vercel.json'), JSON.stringify({
  redirects: [{ source: '/assets/:path((?!ui/icons\\.svg$).*)', destination: `${assetsUrl}/:path`, permanent: false }],
  headers: [{ source: '/app/(.*)', headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }] }],
}, null, 2));
const sizeOf = (d) => readdirSync(d).reduce((n, f) => { const p = join(d, f), s = statSync(p); return n + (s.isDirectory() ? sizeOf(p) : s.size); }, 0);
// a clean checkout without LFS smudging has text pointers for images: one in a build is a broken picture on the live site
const walk = (d) => readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(d, e.name)) : [join(d, e.name)]));
const pointers = walk(outDir).filter((f) => statSync(f).size < 300 && readFileSync(f, 'latin1').includes('git-lfs.github.com/spec'));
if (pointers.length) throw new Error('Git LFS pointers in the build, fetch them first: ' + pointers.join(', '));
if (!existsSync(join(outDir, 'index.html'))) throw new Error('No index.html in the build');
console.log(`${outDir}: ${(sizeOf(outDir) / 1048576).toFixed(1)} MB, /assets -> ${assetsUrl}`);
