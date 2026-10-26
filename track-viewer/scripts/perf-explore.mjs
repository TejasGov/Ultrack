// What are the main pass and the road mirror spending on? Switches one cost off at a time in the live viewer and times the passes again (each
// experiment twice, interleaved with the baseline, frames pooled: other processes share this GPU).
//   node scripts/qa-lock.mjs -- node scripts/perf-explore.mjs [track=tokyo] [looks=dusk] [--views 0,1] [--frames 40] [--weather dry] [--url ...] [--only a,b]
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { openViewer, args as parseArgs, views, setupLook, teleport, retry, installProbe, root } from './perf-open.mjs';

const { flag, pos } = parseArgs(process.argv.slice(2));
const track = pos[0] ?? 'tokyo', looks = (pos[1] ?? 'dusk').split(','), weather = flag('weather', 'dry'), frames = +flag('frames', 40), mode = flag('mode', 'game');
const { C, N, V, names } = views(track, flag('views', '0,1'));
const { browser, page } = await openViewer({ track, look: looks[0], weather, mode, base: flag('url', 'http://127.0.0.1:5180') });
await page.evaluate(installProbe);

// page side: each experiment is [apply, revert] in window.__x
await page.evaluate(() => {
  const v = window.viewer, THREE = v.THREE, r = v.renderer, X = {};
  const mats = () => { const s = new Set(); v.scene.traverse((o) => { if (o.material) [].concat(o.material).forEach((m) => s.add(m)); }); return [...s]; };
  const refl = () => v.scene.children.find((o) => o.isReflector);
  X.baseline = [() => {}, () => {}];
  // every transmissive material (cars and venue) as plain alpha-authored glass: what the whole transmission machinery costs
  X.noTransmission = [() => { mats().filter((m) => m.transmission > 0).forEach((m) => { m.__t = m.transmission; m.transmission = 0; m.needsUpdate = true; }); }, () => { mats().filter((m) => m.__t > 0).forEach((m) => { m.transmission = m.__t; m.needsUpdate = true; }); }];
  // the road mirror only when drawn into the frame's own target, not again into the transmission pass's copy
  X.mirrorOnce = [() => { const m = refl(); m.__ob = m.onBeforeRender; m.onBeforeRender = function (rd, ...a) { const t = rd.getRenderTarget(); if (t !== v.composer.readBuffer && t !== v.composer.writeBuffer && t !== null) return; return m.__ob.call(this, rd, ...a); }; }, () => { const m = refl(); m.onBeforeRender = m.__ob; }];
  X.transHalf = [() => { r.__ts = r.transmissionResolutionScale; r.transmissionResolutionScale = 0.5; }, () => { r.transmissionResolutionScale = r.__ts ?? 1; }];
  X.mirrorOnceHalf = [() => { X.mirrorOnce[0](); X.transHalf[0](); }, () => { X.mirrorOnce[1](); X.transHalf[1](); }];
  X.noMirror = [() => { v.params.mirror = false; v.applyAll(); }, () => { v.params.mirror = true; v.applyAll(); }];
  X.noPoolLights = [() => { v.scene.children.filter((c) => c.isLight && !c.isDirectionalLight).forEach((l) => { l.__vis = l.visible; l.visible = false; }); }, () => { v.scene.children.filter((c) => c.isLight && !c.isDirectionalLight).forEach((l) => { l.visible = l.__vis; }); }];
  X.basicMaterials = [() => { r.__ov = r.__ov ?? new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }); v.scene.overrideMaterial = r.__ov; }, () => { v.scene.overrideMaterial = null; }];
  window.__x = X;
});
const experiments = (flag('only', null) ?? 'noTransmission,mirrorOnce,transHalf,mirrorOnceHalf,noMirror,noPoolLights,basicMaterials').split(',');

const avg = (a) => a.reduce((s, x) => s + x, 0) / Math.max(1, a.length);
async function measure() {
  await page.evaluate(() => window.__S.start());
  await page.waitForFunction((n) => window.__S.frames.length >= n, frames, { timeout: 40000, polling: 100 });
  const res = await page.evaluate(() => window.__S.stop());
  return { frames: res.frames.slice(6), tick: res.tick.slice(6) };
}
function sum(acc) {
  const fr = acc.frames, by = {};
  for (const rows of fr) for (const row of rows) { const b = (by[row.name] ??= { gpu: 0, cpu: 0, calls: 0, tris: 0 }); b.gpu += row.gpu; b.cpu += row.cpu; b.calls += row.calls; b.tris += row.tris; }
  const n = fr.length, g = (k, f) => (by[k] ? by[k][f] / n : 0);
  return { n, total: avg(fr.map((rows) => rows.reduce((s, x) => s + x.gpu, 0))), main: g('main', 'gpu'), mirror: g('mirror', 'gpu'), mainCpu: g('main', 'cpu'), mirrorCpu: g('mirror', 'cpu'), mainDraws: Math.round(g('main', 'calls')), mirrorDraws: Math.round(g('mirror', 'calls')), tick: avg(acc.tick) };
}

const out = {};
for (const look of looks) {
  await retry(page, setupLook, [look, weather, {}]);
  for (const name of names) {
    const i = V[name], k = ((i % N) + N) % N;
    await page.evaluate(teleport, [C[k], C[(k + 3) % N], true]);
    await page.waitForTimeout(3500);
    console.log(`\n== ${track} ${look} | ${name}   (GPU ms main / mirror / total; CPU ms main / mirror; draws main / mirror; tick JS ms)`);
    const acc = {};
    for (let round = 0; round < 2; round++) {
      for (const key of ['baseline', ...experiments]) {
        await page.evaluate((k) => window.__x[k][0](), key);
        await page.waitForTimeout(2500);
        const m = await measure();
        const a = (acc[key] ??= { frames: [], tick: [] }); a.frames.push(...m.frames); a.tick.push(...m.tick);
        await page.evaluate((k) => window.__x[k][1](), key);
        await page.waitForTimeout(600);
      }
    }
    const rows = Object.entries(acc).map(([key, a]) => [key, sum(a)]);
    for (const [key, m] of rows) console.log(`  ${key.padEnd(16)} GPU ${m.main.toFixed(2).padStart(6)} ${m.mirror.toFixed(2).padStart(6)} ${m.total.toFixed(2).padStart(6)}   CPU ${m.mainCpu.toFixed(2).padStart(6)} ${m.mirrorCpu.toFixed(2).padStart(6)}   draws ${String(m.mainDraws).padStart(5)} ${String(m.mirrorDraws).padStart(5)}   tick ${m.tick.toFixed(1)}`);
    out[`${look} | ${name}`] = Object.fromEntries(rows);
  }
}
mkdirSync(join(root, 'qa', 'perf'), { recursive: true });
writeFileSync(join(root, 'qa', 'perf', `explore-${track}.json`), JSON.stringify(out, null, 1));
await browser.close();
