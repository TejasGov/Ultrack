// Plays seeded careers with a stub player (docs/career-mode.md 10.6) and prints how they go: seasons to the first Maestro and Legend
// offers, the A seat, drops, W1, negotiation, the wallet, offers per season. `node scripts/career-sim.mjs [careers] [seasons=9]`.
// The stub's lap is par / skill with noise; race order is each entry's lap with race noise (no physics: the live race is not simulated).
import { createServer } from 'vite';

export async function loadCareer(server) {
  const C = await server.ssrLoadModule('/src/game/career/career.js'), R = await server.ssrLoadModule('/src/game/career/rules.js');
  return { C, R };
}
const AVAILABLE = { india: null, drylake: ['day', 'dusk'], infinia: ['day', 'dusk'], marina: null, shajawa: ['day', 'dusk'], llano: ['day', 'dusk'], tokyo: null };

/** the sim's pick at a review: the highest tier, the A seat, then the highest pay; a reserve seat only when nothing else is left */
const best = (offers, R) => [...offers].sort((a, b) => R.TIERS.tiers[b.tier].rank - R.TIERS.tiers[a.tier].rank || (b.seat === 'A') - (a.seat === 'A') || b.salary - a.salary)[0];

/** one career for `seasons` seasons; skill is the player's pace (1.00 = an AI of rating ~88) */
export function play({ C, R }, seed, skill, seasons = 3, raceLength = 'sprint') {
  let r = seed >>> 0; const rand = () => ((r = (Math.imul(r ^ (r >>> 15), 2246822507) + 0x9e3779b9) >>> 0) / 4294967296);
  const noise = (s) => (rand() + rand() + rand() - 1.5) * s;
  const save = C.newCareer({ name: 'Sim Driver', seed, raceLength, now: '2026-11-01T00:00:00Z' });
  const sh = C.shootout(); C.finishShootout(save, R.parLap(sh.track, sh.car) / skill * (1 + noise(0.01)));
  const log = { sponsors: 0, money: {}, seasonEnd: [], maestroOffer: null, legendOffer: null, promotion: null, minWallet: save.wallet.coins, offers: [], rr: [], finish: [], drops: 0, warnings: 0, w1: 0, tier: [], medals: 0, numberOne: null, titles: 0, withdrawn: 0, deals: 0 };
  // ask for a bit more, sometimes too much: a refusal or a withdrawal must never strand the career
  const haggle = (o) => { if (!C.canNegotiate(o)) return; const a = C.negotiate(save, o.id, { salary: rand() < 0.3 ? 0.3 : 0.1, seasons: o.seasons, status: o.status });
    if (a.result === 'accepted') log.deals++; if (a.result === 'withdrawn') log.withdrawn++; if (a.result === 'countered') C.negotiate(save, o.id, a.terms); };
  haggle(save.pending.offers[seed % save.pending.offers.length]);
  C.acceptOffer(save, save.pending.offers[seed % save.pending.offers.length].id, AVAILABLE);
  log.tier.push(save.season.tier);
  while (save.clock.season <= seasons) {
    if (save.clock.phase === 'paddock') {
      const spec = C.sideSpec(save);
      if (spec) { const m = C.finishSide(save, spec.kind === 'test' ? spec.par / skill * (1 + noise(0.01)) : 12000 + rand() * 30000); log.medals += m.medal; }
      for (const o of [...save.sponsors.offers]) { if (C.negotiate(save, o.id, { retainer: 0.15, bonus: 0 }).result !== 'withdrawn' && C.signSponsor(save, o.id).ok) log.sponsors++; }
      if (C.currentWeek(save).kind !== 'race') {
        for (const m of [...save.season.mid]) { log.w1++; if (rand() < 0.5) C.signMid(save, m.id); else C.walkAway(save, m.id); }
        C.advanceWeek(save); continue;
      }
      const rd = C.currentRound(save), car = save.contract.car, u = save.garage.upgrades[car];
      const lapNow = () => R.parLap(rd.track, car, rd.weather, [u.engine, u.tyres, u.brakes]) / skill * (1 + noise(0.008));
      C.finishQuali(save, lapNow()); if (!save.season.current.quali.grid.includes(car)) C.finishQuali(save, lapNow());   // a missed cut uses the one retry
    } else if (save.clock.phase === 'race') {
      const q = save.season.current.quali, t = Object.fromEntries(q.grid.map((k) => [k, (q.laps[k] ?? (k === save.contract.car ? R.parLap(C.currentRound(save).track, k, C.currentRound(save).weather, ['engine', 'tyres', 'brakes'].map((c) => save.garage.upgrades[k][c])) / skill : 999)) * (1 + noise(0.012 * Math.sqrt(C.currentRound(save).laps / 5)))]));   // a model, not a measurement: fewer laps, fewer places change from the grid
      const order = Object.keys(t).sort((a, b) => t[a] - t[b]), lap = Object.fromEntries(Object.entries(t).map(([k, v]) => [k, v * 0.99]));
      const missed = !q.grid.includes(save.contract.car), rep = missed ? C.finishDnq(save) : C.finishRace(save, { order, best: lap, dnf: rand() < 0.03, crashes: rand() < 0.3 ? 1 : 0, spins: rand() < 0.2 ? 1 : 0 });
      log.rr.push(rep.rr); log.finish.push(rep.finish); log.exempt = (log.exempt ?? 0) + (q.exempt ? 1 : 0); log.dnq = (log.dnq ?? 0) + (missed ? 1 : 0);
      if (rep.midSeason?.warning) log.warnings++;
      for (const cat of ['engine', 'tyres', 'brakes']) C.buyUpgrade(save, cat, 500);
      log.minWallet = Math.min(log.minWallet, save.wallet.coins); log.money[save.season.tier] = save.wallet.coins;
    } else if (save.clock.phase === 'review') {
      log.seasonEnd.push({ tier: save.history.at(-1).tier, coins: save.wallet.coins, trust: save.contract.trust, rep: Math.round(save.career.rep), cl: save.career.cl });
      const offers = save.pending.offers, season = save.clock.season; log.offers.push(offers.length);
      if (save.pending.review.dropped) log.drops++;
      if (offers.some((o) => o.tier === 'maestro') && log.maestroOffer === null) log.maestroOffer = season;
      if (offers.some((o) => o.tier === 'legend') && log.legendOffer === null) log.legendOffer = season;
      if (offers.some((o) => o.team === save.contract.team && o.seat === 'A' && save.contract.seat === 'B') && log.promotion === null) log.promotion = season;
      if (season === seasons) break;
      const pick = best(offers, R); haggle(pick);
      const still = save.pending.offers.find((o) => o.id === pick.id) ?? best(save.pending.offers, R);
      C.acceptOffer(save, still.id, AVAILABLE); log.tier.push(save.season.tier);
      if (save.contract.status === 'number1' && log.numberOne === null) log.numberOne = save.clock.season;
    } else throw new Error('stuck in ' + save.clock.phase);
  }
  log.titles = save.stats.titles; log.cups = save.stats.cups;
  return { save, log };
}

if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}`) {
  const N = +(process.argv[2] ?? 200), S = +(process.argv[3] ?? 9);
  const server = await createServer({ root: new URL('../', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'), configFile: false, server: { middlewareMode: true, hmr: false }, appType: 'custom', logLevel: 'error' });
  try {
    const M = await loadCareer(server);
    for (const [label, skill] of [['weak', 0.975], ['average', 0.995], ['strong', 1.015]]) {
      const runs = Array.from({ length: N }, (_, i) => play(M, 1000 + i, skill, S).log);
      const med = (l) => { const v = l.filter((x) => x !== null).sort((a, b) => a - b); return v.length ? v[v.length >> 1] : '—'; };
      const share = (f) => `${Math.round((100 * runs.filter(f).length) / N)} %`;
      const avg = (f) => (runs.reduce((s, r) => s + f(r), 0) / N).toFixed(2);
      const med2 = (f) => med(runs.map(f));
      console.log(`${label.padEnd(8)} skill ${skill}: Maestro offer median season ${med2((r) => r.maestroOffer)} (any ${share((r) => r.maestroOffer)}, in season 1 ${share((r) => r.maestroOffer === 1)}), Legend offer median ${med2((r) => r.legendOffer)} (any ${share((r) => r.legendOffer)}), A-seat offer ${share((r) => r.promotion)},` +
        ` Number One ${share((r) => r.numberOne)}, missed the cut ${Math.round(100 * runs.reduce((a, r) => a + (r.dnq ?? 0), 0) / runs.reduce((a, r) => a + r.rr.length, 0))} % of rounds, skipped qualifying ${Math.round(100 * runs.reduce((a, r) => a + (r.exempt ?? 0), 0) / runs.reduce((a, r) => a + r.rr.length, 0))} %
         avg RR ${avg((r) => r.rr.reduce((a, b) => a + b, 0) / r.rr.length)}, avg finish ${avg((r) => r.finish.reduce((a, b) => a + b, 0) / r.finish.length)}, min wallet ${Math.min(...runs.map((r) => r.minWallet))}, offers/season ${avg((r) => r.offers.reduce((a, b) => a + b, 0) / r.offers.length)} (min ${Math.min(...runs.flatMap((r) => r.offers))}),` +
        ` drops/career ${avg((r) => r.drops)}, warnings ${avg((r) => r.warnings)}, W1 ${avg((r) => r.w1)}, deals ${avg((r) => r.deals)}, withdrawn ${avg((r) => r.withdrawn)}, titles ${avg((r) => r.titles)}, cups ${avg((r) => r.cups)},` +
        ` final tier ${['rookie', 'maestro', 'legend'].map((t) => `${t} ${share((r) => r.tier.at(-1) === t)}`).join(' ')}`);
    }
    // the race lengths, same driver: progress must not depend on how long you race (the race noise is modelled, see above)
    for (const length of ['sprint', 'standard', 'full']) {
      const runs = Array.from({ length: N }, (_, i) => play(M, 1000 + i, 0.995, S, length).log), avg = (f) => (runs.reduce((a, r) => a + f(r), 0) / N).toFixed(2);
      console.log(`${length.padEnd(9)} avg RR ${avg((r) => r.rr.reduce((a, b) => a + b, 0) / r.rr.length)}, avg finish ${avg((r) => r.finish.reduce((a, b) => a + b, 0) / r.finish.length)}, Maestro offer ${Math.round((100 * runs.filter((r) => r.maestroOffer).length) / N)} %, min wallet ${Math.min(...runs.map((r) => r.minWallet))}`);
    }
  } finally { await server.close(); }
}
