// Before / after tables from two perf-passes.mjs reports.
//   node scripts/perf-table.mjs qa/perf/before-tokyo.json qa/perf/after-tokyo.json     two reports
//   node scripts/perf-table.mjs qa/perf/compare-tokyo.json                                one report made with --compare
import { readFileSync } from 'node:fs';
const [aFile, bFile] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
let A = JSON.parse(readFileSync(aFile, 'utf8')), B = bFile ? JSON.parse(readFileSync(bFile, 'utf8')) : null;
if (!B) { B = A; A = { ...A, runs: A.baseRuns }; }   // one --compare report: savings off vs as shipped
const f = (x, d = 1) => (x === undefined ? '-' : (+x).toFixed(d));
const pct = (a, b) => (a > 0 ? `${b <= a ? '-' : '+'}${Math.abs(((b - a) / a) * 100).toFixed(0)}%` : '');
console.log(`| ${A.track} ${A.weather} | GPU avg ms | GPU p95 ms | CPU render ms | tick JS avg / p95 ms | draws | tris k |`);
console.log('|---|---|---|---|---|---|---|');
for (const key of Object.keys(A.runs)) {
  const a = A.runs[key], b = B.runs[key]; if (!b) continue;
  console.log(`| ${key} | ${f(a.gpuAvg)} -> ${f(b.gpuAvg)} (${pct(a.gpuAvg, b.gpuAvg)}) | ${f(a.gpuP95)} -> ${f(b.gpuP95)} | ${f(a.cpuAvg)} -> ${f(b.cpuAvg)} (${pct(a.cpuAvg, b.cpuAvg)}) | ${f(a.tickAvg)} / ${f(a.tickP95)} -> ${f(b.tickAvg)} / ${f(b.tickP95)} | ${a.calls} -> ${b.calls} | ${a.trisK} -> ${b.trisK} |`);
}
console.log('\nper pass (gpu ms / cpu ms / draws / tris k), before -> after');
for (const key of Object.keys(A.runs)) {
  const a = A.runs[key], b = B.runs[key]; if (!b) continue;
  console.log(`\n${key}`);
  const names = [...new Set([...Object.keys(a.buckets), ...Object.keys(b.buckets)])].sort((x, y) => (b.buckets[y]?.gpuMs ?? 0) + (a.buckets[y]?.gpuMs ?? 0) - (b.buckets[x]?.gpuMs ?? 0) - (a.buckets[x]?.gpuMs ?? 0));
  for (const n of names) {
    const x = a.buckets[n] ?? {}, y = b.buckets[n] ?? {};
    if ((x.gpuMs ?? 0) + (y.gpuMs ?? 0) < 0.02 && (x.cpuMs ?? 0) + (y.cpuMs ?? 0) < 0.05) continue;
    console.log(`  ${n.padEnd(24)} gpu ${f(x.gpuMs, 2)} -> ${f(y.gpuMs, 2)}   cpu ${f(x.cpuMs, 2)} -> ${f(y.cpuMs, 2)}   draws ${x.calls ?? 0} -> ${y.calls ?? 0}   tris ${x.trisK ?? 0}k -> ${y.trisK ?? 0}k`);
  }
}
