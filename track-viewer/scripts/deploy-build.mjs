// The public build: the game's code only, with /assets/* redirected to the bucket that holds the 3D assets (scripts/deploy-upload-assets.mjs), because the assets are
// far over Vercel Hobby's 100 MB upload limit. Run it from a clean checkout's track-viewer, so nobody's unfinished edits ship.
//   node scripts/deploy-build.mjs https://pub-xxxx.r2.dev [outDir=dist-deploy]     then: vercel deploy dist-deploy --prod
// The bundles go to /app, not Vite's default /assets, so the redirect catches only the bucket's files.
import { build } from 'vite';
import { cpSync, existsSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const [assetsUrl, outDir = 'dist-deploy'] = process.argv.slice(2);
if (!/^https:\/\/\S+[^/]$/.test(assetsUrl ?? '')) throw new Error('Pass the bucket URL, https and no trailing slash');
await build({ build: { outDir, emptyOutDir: true, assetsDir: 'app', copyPublicDir: false, rollupOptions: { input: { game: 'index.html' } } } });
cpSync(join('public', 'basis'), join(outDir, 'basis'), { recursive: true });       // the KTX2 transcoder stays with the page
writeFileSync(join(outDir, 'vercel.json'), JSON.stringify({
  redirects: [{ source: '/assets/:path*', destination: `${assetsUrl}/:path*`, permanent: false }],
  headers: [{ source: '/app/(.*)', headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }] }],
}, null, 2));
const sizeOf = (d) => readdirSync(d).reduce((n, f) => { const p = join(d, f), s = statSync(p); return n + (s.isDirectory() ? sizeOf(p) : s.size); }, 0);
if (!existsSync(join(outDir, 'index.html'))) throw new Error('No index.html in the build');
console.log(`${outDir}: ${(sizeOf(outDir) / 1048576).toFixed(1)} MB, /assets -> ${assetsUrl}`);
