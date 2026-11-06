// Plays seeded careers with a stub player (docs/career-mode.md 10.6) and prints how they go: seasons to the first Maestro and Legend
// offers, the A seat, drops, W1, negotiation, the wallet, offers per season. `node scripts/career-sim.mjs [careers] [seasons=9]`.
// The stub's lap is par / skill with noise; race order is each entry's lap with race noise (no physics: the live race is not simulated).
import { createServer } from 'vite';
import { CATS } from '../src/game/economy.js';

export async function loadCareer(server) {
  const C = await server.ssrLoadModule('/src/game/career/career.js'), R = await server.ssrLoadModule('/src/game/career/rules.js');
  return { C, R };
}
const AVAILABLE = { india: null, drylake: ['day', 'dusk'], infinia: ['day', 'dusk'], marina: null, shajawa: ['day', 'dusk'], llano: ['day', 'dusk'], tokyo: null, qingshan: null, venice: null, pilbara: ['day', 'dusk'], terminal: ['day', 'dusk'] };

/** the sim's pick at a review: the highest tier, the A seat, then the highest pay; a reserve seat only when nothing else is left */
const best = (offers, R) => [...offers].sort((a, b) => R.TIERS.tiers[b.tier].rank - R.TIERS.tiers[a.tier].rank || (b.seat === 'A') - (a.seat === 'A') || b.salary - a.salary)[0];

/** one career for `seasons` seasons; skill is the player's pace (1.00 = an AI of rating ~88) */
export function play({ C, R }, seed, skill, seasons = 3, raceLength = 'sprint', { life = false, passAll = false } = {}) {
  let r = seed >>> 0; const rand = () => ((r = (Math.imul(r ^ (r >>> 15), 2246822507) + 0x9e3779b9) >>> 0) / 4294967296);
  const noise = (s) => (rand() + rand() + rand() - 1.5) * s;
  const save = C.newCareer({ name: 'Sim Driver', seed, raceLength, now: '2026-11-01T00:00:00Z' });
  const sh = C.shootout(); C.finishShootout(save, R.parLap(sh.track, sh.car) / skill * (1 + noise(0.01)));
  const log = { sponsors: 0, money: {}, seasonEnd: [], maestroOffer: null, legendOffer: null, promotion: null, minWallet: save.wallet.coins, hits: 0, gross: 0, firstStaff: null, repairs: 0, capped: 0, staffSpent: 0, staffHires: 0, offers: [], rr: [], finish: [], drops: 0, warnings: 0, w1: 0, tier: [], medals: 0, numberOne: null, titles: 0, withdrawn: 0, deals: 0, opens: 0, finals: 0, openWins: 0, lcqs: 0, masters: 0, rank: [], absent: 0, mood: [], life: {}, scenes: [], lifeSpent: 0, adPay: 0, scandals: 0, sold: 0, upkeep: 0, free: {}, lost: 0 };
  // ask for a bit more, sometimes too much: a refusal or a withdrawal must never strand the career
  const haggle = (o) => { if (!C.canNegotiate(o)) return; const a = C.negotiate(save, o.id, { salary: rand() < 0.3 ? 0.3 : 0.1, seasons: o.seasons, status: o.status });
    if (a.result === 'accepted') log.deals++; if (a.result === 'withdrawn') log.withdrawn++; if (a.result === 'countered') C.negotiate(save, o.id, a.terms); };
  haggle(save.pending.offers[seed % save.pending.offers.length]);
  C.acceptOffer(save, save.pending.offers[seed % save.pending.offers.length].id, AVAILABLE);
  log.tier.push(save.season.tier);
  /** a sensible player: each role at the best tier that leaves four times its price in the wallet */
  const hireStaff = () => { for (const role of C.STAFF_ROLES) for (const s of C.STAFF_LIST.filter((x) => x.role === role).reverse()) { if (save.wallet.coins >= s.cost * 4 && C.hireStaff(save, s.id).ok) { log.staffSpent += s.cost; log.staffHires++; log.firstStaff ??= log.rr.length; break; } } };
  // the lifestyle policy (Part 3), with dice of its own so the career's stream is the same with or without it. A sensible player: time off when the grind shows, a party when low, the fans
  // when few, an ad when the money is short; after a race the dearest luxury that leaves a reserve of three seasons' upkeep
  const dice = (salt) => { let q = (seed ^ salt) >>> 0; return () => ((q = (Math.imul(q ^ (q >>> 15), 2246822507) + 0x9e3779b9) >>> 0) / 4294967296); }, lr = dice(0x5bd1e995);
  // the race's contacts and passes (6.6) on dice of their own, so every other number is the same with or without them: 0.3 contacts a race with a car within one place, one pass with one
  const cr = dice(0x27d4eb2f), touches = (order, me) => { const nb = [order[me - 1], order[me + 1]].filter(Boolean), pick = () => nb[Math.floor(cr() * nb.length)], contacts = {}, passes = {};
    if (me < 0 || !nb.length) return { contacts, passes }; if (cr() < 0.3) contacts[pick()] = 1; passes[pick()] = 1;
    if (passAll) return { contacts, passes: Object.fromEntries(order.filter((k, i) => i !== me && Math.abs(i - me) <= 2).map((k) => [k, 1])) };   // the realistic-pass probe (career-metrics): a pass with every car within two places
    return { contacts, passes }; };
  // a Sponsor Challenge (4.2) on dice of its own: the place from skill, a contact one race in four, 0-2 times off the track, the lap par / skill; the field's laps (par / pace) and the gaps are a model
  const xr = dice(0x68e31da4), xn = (s) => (xr() + xr() + xr() - 1.5) * s;
  const challenge = (spec) => {
    const me = save.contract.car, n = spec.racers.length, p = Math.min(n, Math.max(1, Math.round(6 - (skill - 0.95) * 60 + xn(1.5)))), ai = spec.gridOrder.filter((k) => k !== me), order = [...ai.slice(0, p - 1), me, ...ai.slice(p - 1)];
    const bests = Object.fromEntries(order.map((k) => [k, (k === me ? spec.par / skill : R.parLap(spec.track, k, 'dry', save.world.teams[R.CAR[k].team].dev) / spec.pace[k]) * (1 + xn(0.01))]));
    let t = spec.laps * spec.par; const totals = order.map((k, i) => [k, (t += i ? 0.2 + xr() * 2.5 : 0)]);
    return { order, bests, totals, contacts: xr() < 0.25 ? { [order[p] ?? order[p - 2]]: 1 } : {}, offTrack: Math.floor(xr() * 3), dnf: false };
  };
  // the inbox's choice scenes (choices.js) on dice of their own: four in five answered with a seeded option, the rest left to take their default
  const qr = dice(0x1b873593), answer = () => { for (const c of C.openChoices(save)) if (qr() < 0.8) C.answerChoice(save, c.id, Math.floor(qr() * c.options.length)); };
  const tryBuy = (id) => { const q = C.lifeInfo(save, id); if (!q.ok) return false; const r = C.buyLife(save, id); if (!r.ok) return false; log.life[id] = (log.life[id] ?? 0) + 1; if (q.pay) log.adPay += q.pay; else log.lifeSpent += q.price; if (r.scandal) log.scandals++; return true; };
  const weekly = () => {
    const L = save.life, coins = save.wallet.coins, keep = 1500 + 2 * C.upkeepOf(save), afford = (id, k = 3) => coins > C.itemOf(id).price * k + keep;
    if (L.sinceOff >= 6 && afford('luxury-holiday', 4) && tryBuy('luxury-holiday')) return;
    if (L.sinceOff >= 6 && afford('holiday', 2) && tryBuy('holiday')) return;
    if (L.happy < 50 && lr() < 0.5) for (const id of ['huge-bash', 'big-party', 'night-out']) if (afford(id) && tryBuy(id)) return;
    if (L.fans < 45 && lr() < 0.5) for (const id of ['charity-gala', 'fan-day']) if (afford(id) && tryBuy(id)) return;
    if (coins < 6000 || lr() < 0.3) for (const id of ['tv-commercial', 'billboard-deal', 'ad-shoot']) if (tryBuy(id)) return;
  };
  const shop = () => {
    for (const x of C.ITEMS.filter((i) => i.type === 'luxury').sort((a, b) => b.price - a.price)) {
      if (save.wallet.coins >= x.price + 4000 + 3 * (C.upkeepOf(save) + x.upkeep) && tryBuy(x.id)) break;
      if (!C.ownedN(save, x.id) && save.wallet.coins >= x.price * 0.5) break;     // halfway to the dearest thing not yet owned: saving for it
    }
  };
  while (save.clock.season <= seasons) {
    if (save.clock.phase === 'paddock') {
      answer();
      if (life && C.currentWeek(save).kind !== 'race') weekly();
      const spec = C.sideSpec(save);
      if (spec) { const m = C.finishSide(save, spec.kind === 'test' ? spec.par / skill * (1 + noise(0.01)) : (rand(), challenge(spec))); log.medals += m.medal; }   // rand(): the draw the old drift stub took, kept so the career's own dice replay as before the challenge
      for (const o of [...save.sponsors.offers]) { if (C.negotiate(save, o.id, { retainer: 0.15, bonus: 0 }).result !== 'withdrawn' && C.signSponsor(save, o.id).ok) log.sponsors++; }
      if (C.currentWeek(save).kind !== 'race') {
        for (const m of [...save.season.mid]) { log.w1++; if (rand() < 0.5) C.signMid(save, m.id); else C.walkAway(save, m.id); }
        C.advanceWeek(save); continue;
      }
      if (log.staffSeason !== save.clock.season) { log.staffSeason = save.clock.season; hireStaff(); }   // once a season, as a player would at its start
      const rd = C.currentRound(save), car = save.contract.car, u = { ...save.garage.upgrades[car] };
      const V = C.qualiVenue(save), lapNow = () => R.parLap(V.track, car, V.weather, [u.engine, u.tyres, u.brakes, u.aero]) / skill * (1 + noise(0.008));
      if (rand() < 0.1) { const h = [Math.round(50 + rand() * 130)]; C.logHits(save, h); log.hits++; }   // a crash in qualifying
      C.finishQuali(save, lapNow()); if (!save.season.current.quali.grid.includes(car)) C.finishQuali(save, lapNow());   // a missed cut uses the one retry
    } else if (save.clock.phase === 'race') {
      const q = save.season.current.quali, cur = save.season.current, o = cur.open, car = save.contract.car, lcq = o?.stage === 'lcq', V = o && !lcq ? C.currentRound(save) : C.qualiVenue(save);   // the laps in q.laps are the qualifying venue's, so the model stays on that scale unless it is a Final
      // a model, not a measurement: an AI car's pace is its par lap over its pace; a Tour round uses the qualifying laps, an Open's Final (whose seeds flew none) the model for every car
      const model = (k) => { const u = save.garage.upgrades[k], dev = k === car ? [u.engine, u.tyres, u.brakes, u.aero] : save.world.teams[R.CAR[k].team].dev; return R.parLap(V.track, k, V.weather, dev) / (k === car ? skill : R.paceOf(save.world.ratings[save.world.seats[k]])); };
      const t = Object.fromEntries(q.grid.map((k) => [k, (o && !lcq ? model(k) : q.laps[k] ?? (k === car ? model(k) : 999)) * (1 + noise(0.012 * Math.sqrt((lcq ? C.currentRound(save).lcqLaps : C.currentRound(save).laps) / 5)))]));   // fewer laps, fewer places change from the grid
      const order = Object.keys(t).sort((a, b) => t[a] - t[b]), lap = Object.fromEntries(Object.entries(t).map(([k, v]) => [k, v * 0.99]));
      const missed = !q.grid.includes(save.contract.car);
      if (lcq && !missed) log.lcqs++;
      const rep = missed ? C.finishDnq(save) : lcq ? C.finishLcq(save, { order, best: lap, dnf: rand() < 0.03, hits: rand() < 0.15 ? [Math.round(50 + rand() * 130)] : [] }) : C.finishRace(save, { order, best: lap, dnf: rand() < 0.03, crashes: 0, spins: rand() < 0.2 ? 1 : 0, hits: rand() < 0.3 ? [Math.round(50 + rand() * 130)] : [], ...touches(order, order.indexOf(car)) });
      log.gross += (rep.coinLines ?? []).reduce((a, l) => a + Math.max(0, l[1]), 0);
      if (rep.repairs?.hits) { log.hits += rep.repairs.hits; log.repairs += rep.repairs.bill; log.capped += rep.repairs.capped ? 1 : 0; }
      if (rep.lcq === true) continue;                            // through to the Final: the loop comes back for it
      if (o?.kind === 'open') { log.opens++; if (!rep.dnq) log.finals++; if (!rep.dnq && !rep.dnf && rep.finish === 1) log.openWins++; }
      if (o?.kind === 'masters') { if (!rep.dnq) log.masters++; else log.absent++; }
      log.rr.push(rep.rr); log.finish.push(rep.finish); log.exempt = (log.exempt ?? 0) + (q.exempt ? 1 : 0); log.dnq = (log.dnq ?? 0) + (missed ? 1 : 0);
      if (rep.midSeason?.warning) log.warnings++;
      for (const [cat] of CATS) C.buyUpgrade(save, cat, 500);
      if (life) shop();
      log.mood.push({ i: save.season.results.length, happy: save.life.happy, fans: save.life.fans, band: C.moodOf(save).id, why: save.life.why });
      log.minWallet = Math.min(log.minWallet, save.wallet.coins); log.money[save.season.tier] = save.wallet.coins;
    } else if (save.clock.phase === 'review') {
      const ch = Object.values(save.season.choices ?? {}); log.scenes.push(ch.length); log.callouts = (log.callouts ?? 0) + ch.filter((c) => c.scene === 'callout' && c.answer === 0).length;
      log.seasonEnd.push({ tier: save.history.at(-1).tier, coins: save.wallet.coins, trust: save.contract.trust, rep: Math.round(save.career.rep), cl: save.career.cl });
      const offers = save.pending.offers, season = save.clock.season; log.offers.push(offers.length);
      if (save.pending.review.dropped) log.drops++;
      if (offers.some((o) => o.tier === 'maestro') && log.maestroOffer === null) log.maestroOffer = season;
      if (offers.some((o) => o.tier === 'legend') && log.legendOffer === null) log.legendOffer = season;
      if (offers.some((o) => o.team === save.contract.team && o.seat === 'A' && save.contract.seat === 'B') && log.promotion === null) log.promotion = season;
      if (season === seasons) break;
      // the window: haggle over the best on day 1, let a day pass (rivals sign, deadlines lapse, teams come back with more), sign by day 2: the best agreed, else the best left
      const pick = best(offers, R); haggle(pick);
      const ids = save.pending.offers.map((o) => o.id), day = C.windowDay(save), left = save.pending.offers, agreed = left.filter((o) => o.agreed);
      if (day.ok) log.lost += ids.filter((id) => !left.some((o) => o.id === id)).length;   // lapsed or gone to a rival on day 2
      const still = left.find((o) => o.id === pick.id) ?? best(agreed.length ? agreed : left, R);
      const owned0 = Object.values(save.life.owned).reduce((a, b) => a + b, 0), cash0 = save.wallet.coins;
      C.acceptOffer(save, still.id, AVAILABLE); log.tier.push(save.season.tier);
      log.sold += owned0 - Object.values(save.life.owned).reduce((a, b) => a + b, 0); log.upkeep = Math.max(log.upkeep, C.upkeepOf(save));
      if (save.contract.status === 'number1' && log.numberOne === null) log.numberOne = save.clock.season;
    } else throw new Error('stuck in ' + save.clock.phase);
  }
  log.rank = save.history.map((h) => h.rank); log.titles = save.stats.titles; log.cups = save.stats.cups;
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
      const wal = (t) => { const v = runs.map((r) => r.money[t]).filter((x) => x !== undefined); return v.length ? Math.round(v.reduce((x, y) => x + y, 0) / v.length) : '—'; };
      console.log(`         running costs per career: ${avg((r) => r.hits)} hard hits, repairs ${avg((r) => r.repairs)} U (capped ${avg((r) => r.capped)} times), staff ${avg((r) => r.staffHires)} hires for ${avg((r) => r.staffSpent)} U (first hire after round ${med2((r) => r.firstStaff)} of the career), repairs are ${(100 * runs.reduce((a, r) => a + r.repairs, 0) / runs.reduce((a, r) => a + r.gross, 0)).toFixed(1)} % of the pay
         wallet at the end of the tier (avg): rookie ${wal('rookie')}, maestro ${wal('maestro')}, legend ${wal('legend')}`);
      console.log(`         Opens per career ${avg((r) => r.opens)}: reached the Final ${avg((r) => r.finals)}, Last Chance races ${avg((r) => r.lcqs)}, Open wins ${avg((r) => r.openWins)}, in the Masters ${avg((r) => r.masters)}, ranking at season end ${avg((r) => r.rank.reduce((a, b) => a + b, 0) / r.rank.length)}`);
      // Part 3: the same careers with a lifestyle buying policy (the dice are separate, so only the mood's own effects differ)
      const on = Array.from({ length: N }, (_, i) => play(M, 1000 + i, skill, S, 'sprint', { life: true }).log), avgOn = (f) => (on.reduce((s, r) => s + f(r), 0) / N).toFixed(2);
      const walOn = (t) => { const v = on.map((r) => r.money[t]).filter((x) => x !== undefined); return v.length ? Math.round(v.reduce((x, y) => x + y, 0) / v.length) : '—'; };
      const moodOf = (runs) => { const all = runs.flatMap((r) => r.mood), byRound = (k) => { const v = all.filter((m) => m.i % 10 === k % 10); return v.length ? Math.round(v.reduce((a, m) => a + m.happy, 0) / v.length) : '—'; };
        return `${[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(byRound).join(' ')}; rounds spent: ${['top', 'content', 'neutral', 'frustrated', 'unhappy'].map((b) => `${b} ${Math.round((100 * all.filter((m) => m.band === b).length) / all.length)} %`).join(', ')}; fans ${Math.round(all.reduce((a, m) => a + m.fans, 0) / all.length)}`; };
      const things = {}; for (const r of on) for (const [k, v] of Object.entries(r.life)) things[k] = (things[k] ?? 0) + v;
      console.log(`         LIFESTYLE: wallet at the end of the tier: rookie ${walOn('rookie')}, maestro ${walOn('maestro')}, legend ${walOn('legend')} (without: ${wal('rookie')}, ${wal('maestro')}, ${wal('legend')}); min wallet ${Math.min(...on.map((r) => r.minWallet))}, final tier legend ${Math.round((100 * on.filter((r) => r.tier.at(-1) === 'legend').length) / N)} % (without ${share((r) => r.tier.at(-1) === 'legend')})
         spent on things ${avgOn((r) => r.lifeSpent)} U, ads paid ${avgOn((r) => r.adPay)} U, scandals ${avgOn((r) => r.scandals)}, items sold for upkeep ${avgOn((r) => r.sold)}, peak upkeep ${avgOn((r) => r.upkeep)} U a season, avg RR ${avgOn((r) => r.rr.reduce((a, b) => a + b, 0) / r.rr.length)} (without ${avg((r) => r.rr.reduce((a, b) => a + b, 0) / r.rr.length)})
         bought per career: ${Object.entries(things).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${(v / N).toFixed(1)}`).join(', ')}
         happiness by round of a season (avg, rounds 1-10), buying: ${moodOf(on)}
         happiness the same, buying nothing: ${moodOf(runs)}`);
    }
    // the race lengths, same driver: progress must not depend on how long you race (the race noise is modelled, see above)
    for (const length of ['sprint', 'standard', 'full']) {
      const runs = Array.from({ length: N }, (_, i) => play(M, 1000 + i, 0.995, S, length).log), avg = (f) => (runs.reduce((a, r) => a + f(r), 0) / N).toFixed(2);
      console.log(`${length.padEnd(9)} avg RR ${avg((r) => r.rr.reduce((a, b) => a + b, 0) / r.rr.length)}, avg finish ${avg((r) => r.finish.reduce((a, b) => a + b, 0) / r.finish.length)}, Maestro offer ${Math.round((100 * runs.filter((r) => r.maestroOffer).length) / N)} %, min wallet ${Math.min(...runs.map((r) => r.minWallet))}`);
    }
  } finally { await server.close(); }
}
