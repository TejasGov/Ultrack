// Measures seeded stub careers (career-sim.mjs play()) against the career's design targets and prints PASS or FAIL for each; exits 1 on any FAIL.
// `node scripts/career-metrics.mjs [careers=100] [seasons=6]`. The targets are in docs/10x/career-spec.md (WP1: rivalries that are earned; WP3: the Sponsor Challenge).
// It watches through wrapped copies of the career functions, so the careers play exactly as they do in career-sim.
import { createServer } from 'vite';
import assert from 'node:assert/strict';
import { loadCareer, play } from './career-sim.mjs';

const N = +(process.argv[2] ?? 100), S = +(process.argv[3] ?? 6), MIN_RACED = 100, WALLET = { rookie: 17905, maestro: 49302, legend: 101082 };   // the average driver's wallet at the end of each tier, measured on the base commit (the spec's baseline)
const server = await createServer({ root: new URL('../', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'), configFile: false, server: { middlewareMode: true, hmr: false }, appType: 'custom', logLevel: 'error' });
let failed = 0;
const check = (label, v, lo, hi, fmt = (x) => x.toFixed(2)) => { const ok = v >= lo && v <= hi; if (!ok) failed++; console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}: ${fmt(v)} (target ${fmt(lo)}-${fmt(hi)})`); };
const pct = (x) => `${Math.round(x * 100)} %`;
try {
  const M = await loadCareer(server), { C, R } = M;
  for (const [label, skill] of [['weak', 0.975], ['average', 0.995], ['strong', 1.015]]) {
    const A = { days: 0, medals: [0, 0, 0, 0], moodMax: 0, money: { rookie: [], maestro: [], legend: [] }, rounds: 0, raced: 0, nemRounds: 0, nemRaced: 0, nemMate: 0, repLines: 0, rivalsEnd: 0, feudsEnd: 0, causes: {}, h2h: 0, firstRival: [] };
    for (let i = 0; i < N; i++) {
      let n = 0, first = null;
      /** every round's report, however the round was run (raced, missed the cut, out of an Open's Last Chance) */
      const seen = (save, rep) => {
        if (rep.lcq === true) return rep;                                   // through the Last Chance: the Final is still to come
        n++; A.rounds++; A.repLines += rep.rivals?.length ?? 0; if (rep.nemesis) A.nemRounds++; if (!rep.dnq) { A.raced++; if (rep.nemesis) A.nemRaced++; if (rep.nemesis?.code === rep.duel?.mateCode) A.nemMate++; }
        assert.ok(rep.nemesis === null || typeof rep.nemesis.code === 'string', 'one nemesis a round at most');
        assert.ok(C.rivalsOf(save).filter((r) => r.nemesis).length <= 1, 'one nemesis a weekend at most');
        if (first === null && C.rivalsOf(save).length) first = n;
        return rep;
      };
      const side = (save, r) => { if (r?.kind === 'sponsor') { A.days++; A.medals[r.medal]++; } A.moodMax = Math.max(A.moodMax, ...save.sponsors.deals.map((d) => d.mood)); return r; };
      const W = { ...C, finishSide: (s, v) => side(s, C.finishSide(s, v)), finishRace: (s, r) => seen(s, C.finishRace(s, r)), finishDnq: (s) => seen(s, C.finishDnq(s)), finishLcq: (s, r) => seen(s, C.finishLcq(s, r)) };
      const { save, log } = play({ C: W, R }, 1000 + i, skill, S), rv = C.rivalsOf(save);
      for (const t in A.money) if (log.money[t] !== undefined) A.money[t].push(log.money[t]);
      A.rivalsEnd += rv.length; A.feudsEnd += rv.filter((r) => r.feud).length; A.h2h += rv.reduce((a, r) => a + r.w + r.l, 0); A.firstRival.push(first);
      for (const r of rv) A.causes[r.cause] = (A.causes[r.cause] ?? 0) + 1;
    }
    const rivals = Object.values(A.causes).reduce((a, b) => a + b, 0), med = (l) => { const v = l.filter((x) => x !== null).sort((a, b) => a - b); return v.length ? v[v.length >> 1] : '-'; };
    console.log(`${label} skill ${skill}, ${N} careers x ${S} seasons, ${A.rounds} rounds (${A.raced} raced, a nemesis in ${pct(A.nemRounds / A.rounds)} of all rounds): rivals at the end ${(A.rivalsEnd / N).toFixed(2)} (feuds ${(A.feudsEnd / N).toFixed(2)}), causes ${Object.entries(A.causes).map(([k, v]) => `${k} ${pct(v / rivals)}`).join(', ') || 'none'}, head-to-head races per rival ${(A.h2h / Math.max(1, A.rivalsEnd)).toFixed(1)}, first rival in round ${med(A.firstRival)} (careers with one: ${A.firstRival.filter((x) => x !== null).length})`);
    check('rivals at career end (avg)', A.rivalsEnd / N, 1.0, 3.0);
    // the nemesis races the player, so this counts the rounds he raced; a driver who almost never makes the cut has too few to judge
    // a driver who almost never makes the cut cannot meet a nemesis on track: that FAILs and says why, it is not skipped
    check(`raced rounds with a nemesis on the grid (${A.raced} raced${A.raced < MIN_RACED ? `, too few: this driver misses the cut in ${pct(1 - A.raced / A.rounds)} of rounds` : ''})`, A.nemRaced / Math.max(1, A.raced), 0.2, 0.7, pct);
    console.log(`  info  the nemesis is the teammate in ${pct(A.nemMate / Math.max(1, A.nemRaced))} of raced rounds with one`);
    check('rival REP lines per race', A.repLines / Math.max(1, A.raced), 0, 1.0);
    check('rivals with a cause other than grid', rivals ? 1 - (A.causes.grid ?? 0) / rivals : 1, 0.9, 1, pct);
    const atLeast = (m) => A.medals.slice(m).reduce((a, b) => a + b, 0) / Math.max(1, A.days), cap = R.SPONSORS.startMood + 3;
    console.log(`  info  ${A.days} Sponsor Challenges: no medal ${pct(A.medals[0] / Math.max(1, A.days))}, bronze ${pct(A.medals[1] / Math.max(1, A.days))}, silver ${pct(A.medals[2] / Math.max(1, A.days))}, gold ${pct(A.medals[3] / Math.max(1, A.days))}; wallet at the end of the tier ${Object.entries(A.money).map(([t, v]) => `${t} ${v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : '-'}`).join(', ')}`);
    if (label === 'average') { check('challenges at bronze or better', atLeast(1), 0.75, 0.95, pct); check('challenges at silver or better', atLeast(2), 0.4, 0.7, pct); check('challenges at gold', atLeast(3), 0.1, 0.35, pct);
      for (const [t, base] of Object.entries(WALLET)) check(`wallet at the end of ${t} (baseline ${base})`, A.money[t].reduce((a, b) => a + b, 0) / Math.max(1, A.money[t].length) / base, 0.9, 1.1, pct); }
    if (label === 'weak') check('challenges at silver or better', atLeast(2), 0, 0.45, pct);
    check(`sponsor goodwill never above startMood + 3 = ${cap} (highest seen)`, A.moodMax, 0, cap, (x) => String(x));
  }
} finally { await server.close(); }
console.log(failed ? `career-metrics: ${failed} FAIL` : 'career-metrics: all PASS');
process.exit(failed ? 1 : 0);
