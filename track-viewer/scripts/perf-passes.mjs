// Per-pass frame cost of a circuit: GPU milliseconds (EXT_disjoint_timer_query), CPU submit milliseconds, draw calls and triangles for the
// main pass, the planar road mirror, every shadow map, GTAO, the car-reflection cube capture and the post chain.
//   node scripts/qa-lock.mjs -- node scripts/perf-passes.mjs [track=tokyo] [looks=night,dusk] [--weather dry|damp|rain|dry,damp] [--frames 90]
//        [--label name] [--size 1512x982] [--dpr 2] [--views 0,1,..] [--drive 20] [--mode game|dev] [--census] [--bench] [--set mirror=false,renderScale=0.5]
// game mode (default) is the game's Free Drive like qa-tokyo-views.mjs (one car); dev is ?dev=1 (the whole 8-car grid). The real tick runs
// (the game's chase camera behind the hero, held at a spot of the lap, or driven by the AI for --drive seconds), so the numbers include
// what the game pays: the sun's shadow refresh per 8 m cell, lamp shadow re-picks, the cube capture every few frames. --census lists
// what each pass draws; --bench runs the viewer's bench() instead. Output: qa/perf/<label>-<track>.json and a table on stdout.
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { openViewer, args as parseArgs, views, setupLook, teleport, retry, shoot, closeup, installProbe, root } from './perf-open.mjs';

const { flag, pos, has } = parseArgs(process.argv.slice(2));
const track = pos[0] ?? 'tokyo', looks = (pos[1] ?? 'night,dusk').split(',');
const weathers = flag('weather', 'dry').split(','), weather = weathers[0], frames = +flag('frames', 90), label = flag('label', 'run'), driveSec = +flag('drive', 0);
const mode = flag('mode', 'game'), census = has('census'), rounds = +flag('rounds', 1);
const sets = Object.fromEntries((flag('set', '') || '').split(',').filter(Boolean).map((kv) => { const [k, v] = kv.split('='); return [k, v === 'true' ? true : v === 'false' ? false : Number.isNaN(+v) ? v : +v]; }));   // --set mirror=false,renderScale=0.5
const outDir = join(root, 'qa', 'perf'); mkdirSync(outDir, { recursive: true });
const { C, N, V: VIEWS, names: viewNames } = views(track, flag('views', null));

// ------------------------------------------------------------------------------------------------ driver
const { browser, page, errors, mode: openedMode } = await openViewer({ track, look: looks[0], weather, mode, base: flag('url', 'http://127.0.0.1:5180'), query: flag('query', ''), width: +flag('size', '1920x1080').split('x')[0], height: +flag('size', '1920x1080').split('x')[1], dpr: +flag('dpr', 1) });
// --compare: every spot is measured twice in this session, first with every saving in viewer.perf off (the baseline), then as shipped
const setSavings = (spec) => page.evaluate((spec) => { const v = window.viewer; window.__perfDefaults ??= { ...v.perf }; for (const k of Object.keys(v.perf ?? {})) v.perf[k] = spec === true ? window.__perfDefaults[k] : spec === false ? false : !spec.off.includes(k) && window.__perfDefaults[k]; v.applyAll(); }, spec);
const flagNames = await page.evaluate(() => Object.keys(window.viewer.perf ?? {}));
// --compare: every spot is measured twice in this session, first with every saving in viewer.perf off (the baseline), then as shipped;
// --compare-each adds one run per saving with only that one off
const variants = has('compare-each') ? [['base', false], ...flagNames.map((f) => ['no ' + f, { off: [f] }]), ['', true]] : has('compare') ? [['base', false], ['', true]] : [['', true]];
if (has('bench')) {   // the viewer's own bench(): 120 frames along the lap, CPU+GPU with a readback, per look (and with --compare, with the savings off first)
  const rows = [];
  for (const look of looks) {
    await retry(page, setupLook, [look, weather, sets]);
    await page.evaluate(() => { window.viewer.params.fpsCap = 1; });
    for (const [variant, on] of variants) {
      await setSavings(on);
      await page.waitForTimeout(2500);
      await page.evaluate(() => window.viewer.bench(40));     // warm-up: the first frames after a switch compile shaders
      const r = await page.evaluate(() => window.viewer.bench(120));
      rows.push({ look, savings: variant || 'on', ...r }); console.log(look, variant || 'savings on', JSON.stringify(r));
    }
    await page.evaluate(() => { window.viewer.params.fpsCap = 60; });
  }
  writeFileSync(join(outDir, `${label}-bench-${track}.json`), JSON.stringify({ weather, mode: openedMode, rows }, null, 1));
  await browser.close(); process.exit(0);
}
const env = await page.evaluate(installProbe);
console.log(`${track} (${openedMode} mode)\n  gpu: ${env.device.gpu}\n  tier ${env.device.tier}, canvas ${env.size.join('x')}, timer query ${env.ext}`);
if (!env.ext) throw Error('EXT_disjoint_timer_query_webgl2 unavailable');

const avg = (a) => a.reduce((s, x) => s + x, 0) / Math.max(1, a.length);
const p95 = (a) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(s.length * 0.95))] ?? 0; };
function summarise(res) {
  const frames = res.frames, buckets = new Map();
  const totals = frames.map((rows) => rows.reduce((s, r) => s + r.gpu, 0));
  const cpuTotals = frames.map((rows) => rows.reduce((s, r) => s + r.cpu, 0));
  for (const rows of frames) {
    const per = new Map();
    for (const r of rows) { const b = per.get(r.name) ?? { gpu: 0, cpu: 0, calls: 0, tris: 0 }; b.gpu += r.gpu; b.cpu += r.cpu; b.calls += r.calls; b.tris += r.tris; per.set(r.name, b); }
    for (const [name, b] of per) { const acc = buckets.get(name) ?? { gpu: [], cpu: [], calls: [], tris: [], n: 0 }; acc.gpu.push(b.gpu); acc.cpu.push(b.cpu); acc.calls.push(b.calls); acc.tris.push(b.tris); acc.n++; buckets.set(name, acc); }
  }
  const n = frames.length, rows = {};
  for (const [name, a] of buckets) {
    const pad = (x) => x.concat(Array(n - x.length).fill(0));   // frames the bucket did not run in count as zero
    rows[name] = { gpuMs: +avg(pad(a.gpu)).toFixed(3), cpuMs: +avg(pad(a.cpu)).toFixed(3), calls: Math.round(avg(pad(a.calls))), trisK: Math.round(avg(pad(a.tris)) / 1000), frames: a.n };
  }
  return { n, gpuAvg: +avg(totals).toFixed(2), gpuMed: +[...totals].sort((x, y) => x - y)[Math.floor(n / 2)].toFixed(2), gpuP95: +p95(totals).toFixed(2), cpuAvg: +avg(cpuTotals).toFixed(2), tickAvg: +avg(res.tick).toFixed(2), tickP95: +p95(res.tick).toFixed(2),
    calls: Math.round(avg(frames.map((r) => r.reduce((s, x) => s + x.calls, 0)))), trisK: Math.round(avg(frames.map((r) => r.reduce((s, x) => s + x.tris, 0))) / 1000), buckets: rows };
}
function print(title, s) {
  console.log(`\n== ${title}  (${s.n} frames)  GPU avg ${s.gpuAvg} p95 ${s.gpuP95} ms | render-call CPU ${s.cpuAvg} ms | tick JS avg ${s.tickAvg} p95 ${s.tickP95} ms | ${s.calls} draws ${s.trisK}k tris`);
  const rows = Object.entries(s.buckets).sort((a, b) => b[1].gpuMs - a[1].gpuMs);
  console.log('  ' + 'pass'.padEnd(26) + 'gpu ms'.padStart(8) + 'cpu ms'.padStart(8) + 'draws'.padStart(7) + 'tris k'.padStart(8) + '  runs');
  for (const [name, b] of rows) console.log('  ' + name.padEnd(26) + b.gpuMs.toFixed(2).padStart(8) + b.cpuMs.toFixed(2).padStart(8) + String(b.calls).padStart(7) + String(b.trisK).padStart(8) + `  ${b.frames}/${s.n}`);
}

if (has('diag')) {   // how many renders does one frame make, with which cameras, and who calls the mirror? (run it at a look whose mirror is on: dusk), savings off then on
  await retry(page, setupLook, [looks[0], weather, sets]);
  for (const [name, spec] of [['savings off', false], ['savings on', true]]) {
    await setSavings(spec);
    await page.waitForTimeout(3000);
    const d = await page.evaluate(() => {
      const v = window.viewer, r = v.renderer, out = { transmissive: [], renders: [], mirrorCalls: [] };
      v.scene.traverse((o) => { if (o.material) [].concat(o.material).forEach((m) => { if (m.transmission > 0 && !out.transmissive.includes(m.name)) out.transmissive.push(m.name); }); });
      const refl = v.scene.children.find((o) => o.isReflector), ob = refl.onBeforeRender;
      refl.onBeforeRender = function (...a) { out.mirrorCalls.push(new Error().stack.split(String.fromCharCode(10)).slice(2, 5).map((x) => x.trim().split(' (')[0]).join(' < ')); return ob.apply(this, a); };
      const render = r.render.bind(r), rbd = r.renderBufferDirect.bind(r), calls0 = r.info.render.calls;
      let cur = null;
      r.renderBufferDirect = function (...a) { if (cur) cur.draws++; return rbd(...a); };
      r.render = function (scn, cam) {
        const e = { cam: cam === v.camera ? 'main' : cam.type, scene: scn === v.scene ? 'scene' : scn.type, target: r.getRenderTarget()?.width ?? 'screen', draws: 0 };
        if (scn === v.scene) out.renders.push(e);
        const prev = cur; cur = e; const res = render(scn, cam); cur = prev; return res;
      };
      v.renderNow();
      r.render = render; r.renderBufferDirect = rbd; refl.onBeforeRender = ob;
      return out;
    });
    console.log(`diag (${name}): transmissive materials: [${d.transmissive}]; scene renders: ${d.renders.map((e) => `${e.cam} ${e.target}px ${e.draws} submits`).join(' | ')}; mirror calls: ${d.mirrorCalls.length}`);
    d.mirrorCalls.forEach((c) => console.log('    mirror called from: ' + c));
  }
  if (has('diag-only')) { await browser.close(); process.exit(0); }
}
const report = { label, track, weather, mode: openedMode, env, runs: {}, baseRuns: {}, ab: {} };
const into = (variant) => (variant === 'base' ? report.baseRuns : variant === '' ? report.runs : ((report.offOne ??= {})[variant] ??= {}));
for (const { look, wx } of weathers.flatMap((wx) => looks.map((look) => ({ look, wx })))) {
  const lk = weathers.length > 1 ? `${look}/${wx}` : look;     // report key
  await retry(page, setupLook, [look, wx, sets]);
  for (const name of viewNames) {
    const i = VIEWS[name], k = ((i % N) + N) % N;
    await page.evaluate(teleport, [C[k], C[(k + 3) % N], true]);
    // each variant is measured `rounds` times, interleaved (A B A B), and the frames pooled: other processes share this GPU, so one pass of each is not trustworthy
    const acc = new Map(), censusBy = new Map();
    for (let round = 0; round < rounds; round++) {
      for (const [variant, on] of variants) {
        await setSavings(on);
        await page.waitForTimeout(round === 0 && variant === variants[0][0] ? 3500 : 2500);     // lamps fade in, programs recompile, the culler and the shadow cells settle
        await page.evaluate(() => window.__S.start());
        await page.waitForFunction((n) => window.__S.frames.length >= n, frames, { timeout: 40000, polling: 100 });
        const res = await page.evaluate(() => window.__S.stop());
        const a = acc.get(variant) ?? acc.set(variant, { frames: [], tick: [] }).get(variant);
        a.frames.push(...res.frames.slice(6)); a.tick.push(...res.tick.slice(6));     // the first frames after a switch can carry a one-off shader compile
        if (census && round === 0) {
          await page.evaluate(() => { window.__S.census.clear(); window.__S.cen = true; window.__S.start(); });
          await page.waitForFunction(() => window.__S.frames.length >= 4, null, { timeout: 30000, polling: 50 });
          const cn = await page.evaluate(() => { window.__S.cen = false; window.__S.on = false; return { d: window.__S.dump(), n: window.__S.frames.length }; });
          const bySection = {};
          for (const [key, e] of Object.entries(cn.d)) { const [sec, nm] = key.split(' | '); (bySection[sec] ??= []).push({ nm, inv: e.inv / cn.n, draws: e.draws / cn.n, trisK: e.tris / cn.n / 1000, inst: e.inst / cn.n }); }
          censusBy.set(variant, bySection);
        }
      }
    }
    for (const [variant] of variants) {
      const sm = summarise(acc.get(variant)); into(variant)[`${lk} | ${name}`] = sm;
      print(`${lk} | ${name} (static)${variant ? ' [' + (variant === 'base' ? 'savings off' : variant) + ']' : ''}`, sm);
      const bySection = censusBy.get(variant);
      for (const sec of Object.keys(bySection ?? {})) {
        const rows = bySection[sec].sort((x, y) => y.trisK - x.trisK);
        console.log(`  census ${sec}: ${Math.round(rows.reduce((t, r) => t + r.inv, 0))} submits, ${Math.round(rows.reduce((t, r) => t + r.draws, 0))} draws ${Math.round(rows.reduce((t, r) => t + r.trisK, 0))}k tris`);
        for (const r of rows.slice(0, +flag('top', 14))) console.log('     ' + r.nm.slice(0, 58).padEnd(58) + String(Math.round(r.inv)).padStart(6) + '/' + String(Math.round(r.draws)).padEnd(4) + ' sub/draws' + String(Math.round(r.trisK)).padStart(8) + 'k tris' + (r.inst ? String(Math.round(r.inst)).padStart(7) + ' inst' : ''));
        sm.census = { ...(sm.census ?? {}), [sec]: rows.slice(0, 60) };
      }
    }
    if (has('ab') || has('ab-each')) {   // the same frame with the savings off (A) and as shipped (B): mean absolute difference over RGB on 0..255, noise floor = A against A again
      const flags = await page.evaluate(() => Object.keys(window.viewer.perf));
      for (const off of has('ab-each') ? [...flags.map((f) => [f]), 'all'] : ['all']) {
        const r = await page.evaluate(shoot, [off, false]);
        const row = { mad: +r.ab.mad.toFixed(3), over8pct: +r.ab.over8.toFixed(3), over32pct: +r.ab.over32.toFixed(4), max: r.ab.max, noiseMAD: +r.noise.mad.toFixed(3), noiseMax: r.noise.max };
        const tag = off === 'all' ? 'all' : off[0];
        (report.ab[`${lk} | ${name}`] ??= {})[tag] = row;
        console.log(`  pixel A/B ${lk} | ${name} | ${tag.padEnd(11)} mean abs diff ${String(row.mad).padEnd(6)} (>8: ${row.over8pct}%, >32: ${row.over32pct}%, max ${row.max}); noise floor ${row.noiseMAD} (max ${row.noiseMax})`);
      }
    }
    if (has('ab-closeup')) {   // the hero up close from the front, rear and side: the one place glass shows (--ab-closeup)
      for (const kind of ['front', 'rear', 'side']) {
        await page.evaluate(closeup, kind); await page.waitForTimeout(600);
        const r = await page.evaluate(shoot, ['all', false]);
        const row = { mad: +r.ab.mad.toFixed(3), over8pct: +r.ab.over8.toFixed(3), over32pct: +r.ab.over32.toFixed(4), max: r.ab.max, noiseMAD: +r.noise.mad.toFixed(3), noiseMax: r.noise.max };
        (report.ab[`${lk} | ${name}`] ??= {})['closeup ' + kind] = row;
        console.log(`  pixel A/B ${lk} | ${name} | closeup ${kind.padEnd(5)} mean abs diff ${String(row.mad).padEnd(6)} (>8: ${row.over8pct}%, >32: ${row.over32pct}%, max ${row.max}); noise floor ${row.noiseMAD} (max ${row.noiseMax})`);
      }
      await page.evaluate(closeup, 'chase');
    }
  }
  if (driveSec > 0) {
    for (const [variant, on] of variants) {
      await page.evaluate(teleport, [C[N - 8], C[N - 5], false]);
      await setSavings(on);
      await page.waitForTimeout(1500);
      await page.evaluate(() => window.__S.start());
      await page.waitForTimeout(driveSec * 1000);
      const res0 = await page.evaluate(() => window.__S.stop());
      const res = { frames: res0.frames.slice(6), tick: res0.tick.slice(6) };
      const s = summarise(res); into(variant)[`${lk} | drive`] = s; print(`${lk} | AI drive ${driveSec}s${variant ? ' [' + (variant === 'base' ? 'savings off' : variant) + ']' : ''}`, s);
    }
  }
}
writeFileSync(join(outDir, `${label}-${track}.json`), JSON.stringify({ ...report, errors }, null, 1));
console.log('\nerrors:', errors.length ? errors.slice(0, 8) : 'none');
await browser.close();
