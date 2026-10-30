// The icon set and the tokens in a real page: a blank page on the dev server imports ui-tokens.css and icons.js, places every icon
// at 20 and 32 px through icon(), waits for the sprite, and checks each one painted (a non-empty box), took the text colour, and
// that the tokens resolve. Screenshot: qa/ui-icons-live.png. No game boot, so it is light on the GPU.
//   node scripts/qa-lock.mjs -- node scripts/qa-ui-icons.mjs [url=http://127.0.0.1:5180]
import { chromium } from 'playwright-core';
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const base = process.argv[2] ?? 'http://127.0.0.1:5180';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const names = [...readFileSync(join(root, 'public', 'assets', 'ui', 'icons.svg'), 'utf8').matchAll(/<symbol id="([^"]+)"/g)].map((m) => m[1]);
const chrome = ['C:/Program Files/Google/Chrome/Application/chrome.exe'].find(existsSync);
const browser = await chromium.launch({ executablePath: chrome, headless: true, args: ['--use-angle=d3d11'] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
// Vite's HMR socket stubbed, as in every QA script: no reload mid-run when another agent saves a file
await ctx.addInitScript(() => { const W = window.WebSocket; const F = function (u, p) { if (p === 'vite-hmr') { const t = new EventTarget(); t.send = () => {}; t.close = () => {}; t.readyState = 0; return t; } return new W(u, p); }; F.prototype = W.prototype; Object.assign(F, { CONNECTING: 0, OPEN: 1, CLOSING: 2, CLOSED: 3 }); window.WebSocket = F; });
const page = await ctx.newPage(), errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(e.message));
await page.route(`${base}/qa-ui-icons.html`, (r) => r.fulfill({ contentType: 'text/html', body: `<!doctype html><meta charset="utf-8">
<body style="margin:0;background:#0e1218;color:#f4f2ee;font:14px sans-serif"><div id="g" style="display:flex;flex-wrap:wrap;gap:10px;padding:16px"></div>
<script type="module">
import '/src/game/ui-tokens.css';
import { icon } from '/src/game/icons.js';
const g = document.getElementById('g');
for (const n of ${JSON.stringify(names)}) { const c = document.createElement('div'); c.style.cssText = 'display:flex;align-items:center;gap:8px;width:136px;color:var(--c-ink-1)';
  c.append(icon(n), icon(n, { cls: 'big' })); c.lastChild.style.fontSize = '32px'; c.firstChild.style.fontSize = '20px'; c.firstChild.style.color = 'var(--c-accent)'; g.append(c); }
window.ready = true;
</script></body>` }));
await page.goto(`${base}/qa-ui-icons.html`);
await page.waitForFunction(() => window.ready);
// external <use>: the sprite arrives asynchronously; every reference has a box once it has
const r = await page.waitForFunction((n) => {
  const els = [...document.querySelectorAll('svg.icon use')];
  return els.length === n * 2 && els.every((u) => u.getBBox().width > 0) && els;
}, names.length, { timeout: 15000 }).then(() => page.evaluate(() => {
  const cs = getComputedStyle(document.documentElement), first = document.querySelector('svg.icon');
  return { accent: cs.getPropertyValue('--c-accent').trim(), u: cs.getPropertyValue('--u').trim(), stroke: getComputedStyle(first).stroke, size: first.getBoundingClientRect().width };
})).catch((e) => ({ fail: e.message.split('\n')[0], empty: null }));
const empty = await page.evaluate(() => [...document.querySelectorAll('svg.icon')].filter((s) => !(s.querySelector('use').getBBox().width > 0)).map((s) => s.dataset.icon));
await page.screenshot({ path: join(root, 'qa', 'ui-icons-live.png'), fullPage: true });
await browser.close();
console.log(JSON.stringify({ icons: names.length, ...r, empty: [...new Set(empty)], errors }, null, 1));
if (r.fail || empty.length || errors.length || r.accent !== '#e3141b' || r.stroke !== 'rgb(227, 20, 27)' || r.size !== 20) process.exit(1);
