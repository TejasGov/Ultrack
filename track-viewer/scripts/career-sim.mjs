// Plays seeded careers with a stub player (docs/career-mode.md 10.6) and prints how they go: seasons to the first Maestro offer,
// how often the A seat is offered, the wallet, offers per season. `node scripts/career-sim.mjs [careers] [seasons]`.
// The stub's lap is par / skill with noise; race order is each entry's lap with race noise (no physics: the live race is not simulated).
import { createServer } from 'vite';

export async function loadCareer(server) {
  const C = await server.ssrLoadModule('/src/game/career/career.js'), R = await server.ssrLoadModule('/src/game/career/rules.js');
  return { C, R };
}
const AVAILABLE = { india: null, drylake: ['day', 'dusk'], marina: null, shajawa: ['day', 'dusk'], tokyo: null };

/** one career for `seasons` seasons; skill is the player's pace (1.00 = an AI of rating ~88) */
export function play({ C, R }, seed, skill, seasons = 3) {
  let r = seed >>> 0; const rand = () => ((r = (Math.imul(r ^ (r >>> 15), 2246822507) + 0x9e3779b9) >>> 0) / 4294967296);
  const noise = (s) => (rand() + rand() + rand() - 1.5) * s;
  const save = C.newCareer({ name: 'Sim Driver', seed, now: '2026-11-01T00:00:00Z' });
  const sh = C.shootout(); C.finishShootout(save, R.parLap(sh.track, sh.car) / skill * (1 + noise(0.01)));
  C.acceptOffer(save, save.pending.offers[seed % 3].id, AVAILABLE);
  const log = { maestroOffer: null, promotion: null, minWallet: save.wallet.coins, offers: [], rr: [], finish: [] };
  while (save.clock.season <= seasons) {
    if (save.clock.phase === 'paddock') {
      const rd = C.currentRound(save), car = save.contract.car;
      C.finishQuali(save, R.parLap(rd.track, car, rd.weather, [0, 0, 0]) / skill * (1 + noise(0.008)));
    } else if (save.clock.phase === 'race') {
      const q = save.season.current.quali, t = Object.fromEntries(Object.entries(q.laps).map(([k, v]) => [k, (v ?? 999) * (1 + noise(0.012))]));
      const order = Object.keys(t).sort((a, b) => t[a] - t[b]), best = Object.fromEntries(Object.entries(t).map(([k, v]) => [k, v * 0.99]));
      const rep = C.finishRace(save, { order, best, dnf: rand() < 0.03, crashes: rand() < 0.3 ? 1 : 0, spins: rand() < 0.2 ? 1 : 0 });
      log.rr.push(rep.rr); log.finish.push(rep.finish);
      for (const cat of ['engine', 'tyres', 'brakes']) C.buyUpgrade(save, cat, 500);
      log.minWallet = Math.min(log.minWallet, save.wallet.coins);
    } else if (save.clock.phase === 'review') {
      const offers = save.pending.offers; log.offers.push(offers.length);
      const up = offers.find((o) => o.tier === 'maestro'), promo = offers.find((o) => o.team === save.contract.team && o.seat === 'A' && save.contract.seat === 'B');
      if (up && log.maestroOffer === null) log.maestroOffer = save.clock.season;
      if (promo && log.promotion === null) log.promotion = save.clock.season;
      if (save.clock.season === seasons) break;
      C.acceptOffer(save, (up ?? promo ?? offers[0]).id, AVAILABLE);
    } else throw new Error('stuck in ' + save.clock.phase);
  }
  return { save, log };
}

if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}`) {
  const N = +(process.argv[2] ?? 200), S = +(process.argv[3] ?? 3);
  const server = await createServer({ root: new URL('../', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'), configFile: false, server: { middlewareMode: true, hmr: false }, appType: 'custom', logLevel: 'error' });
  try {
    const M = await loadCareer(server);
    for (const [label, skill] of [['weak', 0.975], ['average', 0.995], ['strong', 1.015]]) {
      const runs = Array.from({ length: N }, (_, i) => play(M, 1000 + i, skill, S).log);
      const med = (l) => { const v = l.filter((x) => x !== null).sort((a, b) => a - b); return v.length ? v[v.length >> 1] : '—'; };
      const share = (f) => `${Math.round((100 * runs.filter(f).length) / N)} %`;
      const avg = (f) => (runs.reduce((s, r) => s + f(r), 0) / N).toFixed(2);
      console.log(`${label.padEnd(8)} skill ${skill}: Maestro offer median season ${med(runs.map((r) => r.maestroOffer))} (any ${share((r) => r.maestroOffer)}, in season 1 ${share((r) => r.maestroOffer === 1)}),` +
        ` A-seat offer ${share((r) => r.promotion)}, avg RR ${avg((r) => r.rr.reduce((a, b) => a + b, 0) / r.rr.length)}, avg finish ${avg((r) => r.finish.reduce((a, b) => a + b, 0) / r.finish.length)},` +
        ` min wallet ${Math.min(...runs.map((r) => r.minWallet))}, offers/season ${avg((r) => r.offers.reduce((a, b) => a + b, 0) / r.offers.length)}`);
    }
  } finally { await server.close(); }
}
