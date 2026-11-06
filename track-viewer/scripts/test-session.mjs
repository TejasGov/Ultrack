// Self-check for the session's lap line and gaps, and the per-track records in the store: no browser, a fake field on a
// circular racing line. Backing over the line is no lap, a finished car's cool-down lap is no lap, gaps stay seconds after
// a finish, a pass and a hard hit name the other car (the career's rivals), and best laps / drift records are kept per circuit (old car-only keys become marina's).
import assert from 'node:assert/strict';
import { createServer } from 'vite';
const server = await createServer({ root: new URL('../', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'), configFile: false, server: { middlewareMode: true, hmr: false }, appType: 'custom' });
try {
  // an old save (records keyed by car alone), read through a stub localStorage
  const saved = { settings: { track: 'tokyo' }, car: 'av12', paint: {}, best: { av12: 100 }, drift: { av12: 5000 } };
  globalThis.localStorage = { getItem: () => JSON.stringify(saved), setItem: () => {} };
  const THREE = await server.ssrLoadModule('three');
  const { Session } = await server.ssrLoadModule('/src/game/session.js');
  const { store } = await server.ssrLoadModule('/src/game/store.js');

  const N = 100, R = 100, line = Array.from({ length: N }, (_, k) => new THREE.Vector3(Math.cos(k / N * Math.PI * 2) * R, 0, Math.sin(k / N * Math.PI * 2) * R));
  const car = (key, idx) => ({ key, idx, vehicle: { cur: { pos: line[idx].clone(), quat: new THREE.Quaternion() }, wheels: [], speed: 40, aBody: { x: 0, z: 0 }, state: { beta: 0, drift: 0 } } });
  const field = (cars) => ({ N, length: 2 * Math.PI * R, linePts: line, cars, hero: cars[0] });
  const step = (S, dt = 0.1) => S.update(dt);
  const go = (S) => { while (S.state === 'grid') step(S); };
  /** move a car sample by sample (one per step) to `to`, forwards (+1) or backwards (-1) */
  const drive = (S, c, to, dir = 1, out = []) => { while (c.idx !== to) { c.idx = (c.idx + dir + N) % N; c.vehicle.cur.pos.copy(line[c.idx]); out.push(...step(S)); } return out; };

  // ---- time trial: one lap, then back over the line and forwards again
  {
    const hero = car('av12', 95), S = new Session(field([hero]), 'trial'); go(S);
    const T = S.trk.get(hero);
    drive(S, hero, 0); assert.equal(T.cross, 1, 'first crossing starts lap 1');
    drive(S, hero, 99); drive(S, hero, 0); assert.equal(T.laps.length, 1, 'a full lap is a lap');
    const lapStart = T.lapStart;
    drive(S, hero, 5); drive(S, hero, 97, -1); assert.equal(T.cross, 1, 'backwards over the line takes the crossing back');
    const ev = drive(S, hero, 3);
    assert.equal(T.laps.length, 1, 'backing over the line and forwards again is no lap');
    assert(!ev.some((e) => e.type === 'lap'), 'no lap event for the re-crossing');
    assert.equal(T.lapStart, lapStart, 'the lap in progress keeps its start');
    assert.equal(T.cross, 2);
    drive(S, hero, 99); drive(S, hero, 0);
    assert.equal(T.laps.length, 2, 'the next real lap still counts');
    assert(Math.abs(T.laps[1].t - (S.raceT - lapStart)) < 1e-9, 'timed from the real crossing');
  }

  // ---- race, one lap: a rival finishes first, then the hero; gaps and the cool-down lap
  {
    const hero = car('av12', 95), rival = car('rv', 97), S = new Session(field([hero, rival]), 'race', { laps: 1 }); go(S);
    drive(S, rival, 0); drive(S, hero, 0);
    drive(S, rival, 99); drive(S, rival, 0);
    assert(S.trk.get(rival).finished, 'rival takes the flag');
    drive(S, hero, 50);
    const g = S.gaps(), hg = g.find((x) => x.car === hero).gap;
    assert.equal(g[0].car, rival); assert(Number.isFinite(hg) && hg > 0 && hg < 60, `gap to a finished leader is seconds, not ${hg}`);
    drive(S, hero, 99); drive(S, hero, 0);
    const H = S.trk.get(hero); assert(H.finished && S.state === 'done');
    const g2 = S.gaps(), fin = S.trk.get(hero).finishT - S.trk.get(rival).finishT;
    assert(Math.abs(g2.find((x) => x.car === hero).gap - fin) < 1e-9, 'between finishers the gap is the finish-time difference');
    const laps = H.laps.length, ev = drive(S, hero, 99); ev.push(...drive(S, hero, 0));
    assert.equal(H.laps.length, laps, "a finished car's cool-down lap is not recorded");
    assert(!ev.some((e) => e.type === 'lap'), 'no lap event after the finish');
  }

  // ---- the career's rival plumbing: a pass names the car passed, a hard hit names the car within 6 m (and a lone hit nobody)
  {
    const hero = car('av12', 95), rival = car('rv', 97), S = new Session(field([hero, rival]), 'race', { laps: 3 }); go(S);
    const pos = drive(S, hero, 10).find((e) => e.type === 'position'); assert.deepEqual([pos.from, pos.to, pos.by], [2, 1, 'rv'], 'the pass names the car passed');
    S.events = []; rival.vehicle.cur.pos.copy(hero.vehicle.cur.pos).add(new THREE.Vector3(3, 0, 2)); S.contactAt(hero.vehicle.cur.pos, 45); assert.deepEqual(S.events, [{ type: 'contact', key: 'rv', kmh: 45 }]);
    S.events = []; rival.vehicle.cur.pos.add(new THREE.Vector3(5, 0, 0)); S.contactAt(hero.vehicle.cur.pos, 45); assert.deepEqual(S.events, [], 'nobody within 6 m');
  }

  // ---- records per track, with the old car-only keys migrated to marina
  assert.equal(store.data.best['marina/av12'], 100); assert.equal(store.data.drift['marina/av12'], 5000);
  assert.equal(store.bestOf('av12'), undefined, 'a marina record does not show on tokyo');
  assert.equal(store.bestLap('av12', 120), true, 'the first tokyo lap is a tokyo record');
  store.set('track', 'marina');
  assert.equal(store.bestOf('av12'), 100); assert.equal(store.driftOf('av12'), 5000);
  assert.equal(store.bestLap('av12', 110), false, 'slower than marina best'); assert.equal(store.bestLap('av12', 90), true);
  store.set('track', 'tokyo'); assert.equal(store.bestOf('av12'), 120, 'tokyo kept its own record');
  console.log('test-session: ok');
} finally { await server.close(); }
