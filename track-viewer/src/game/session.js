// One session on track: a race, a time trial, a drift attack or free drive. Owns the rules: the start (lights or a
// countdown), lap timing, positions and gaps, track limits, wrong way, the drift score, the finish and the results.
// It reads the cars (Field, physics) and reports events; the HUD and the audio react to them (game.js wires both).
import * as THREE from 'three';
import TEAMS from '../../../assets/teams/teams.json';

const DRIVER = Object.fromEntries(TEAMS.teams.flatMap((t) => t.cars.map((c) => [c.key, { ...c.driver, number: c.number, team: t }])));
const ON_TRACK = new Set(['asphalt', 'pit', 'kerb', 'sausage kerb', 'run-off', 'paved']);

export const MODES = {
  race: { label: 'Race', desc: 'Eight teams, one car each. Lights out and away we go.', laps: true, rivals: true, start: 'lights', tags: ['race'] },
  trial: { label: 'Time Trial', desc: 'An empty circuit and the clock. Leave the track and the lap does not count.', laps: false, rivals: false, start: 'count', tags: ['free'], limits: true },
  quali: { label: 'Qualifying', desc: 'One valid flying lap on an empty circuit sets your grid slot.', laps: false, rivals: false, start: 'count', tags: ['free'], limits: true, validLaps: 1 },   // the career's (game.js careerWeekend)
  drift: { label: 'Drift Attack', desc: 'Ninety seconds. Chain drifts for the multiplier; touch the grass and the chain is gone.', laps: false, rivals: false, start: 'count', tags: ['free'], seconds: 90 },
  free: { label: 'Free Drive', desc: 'No clock, no rivals. The whole circuit, at the hour you choose.', laps: false, rivals: false, start: 'none', tags: ['free'] },
};

export class Session {
  /** field: Field with physics enabled; mode: key of MODES; laps: race distance; drivers: { carKey: driver } over teams.json (the career's player) */
  constructor(field, mode, { laps = 3, drivers = null } = {}) {
    this.field = field; this.mode = mode; this.M = MODES[mode]; this.laps = laps; this.drivers = drivers;
    this.t = 0; this.raceT = 0; this.state = 'grid'; this.events = [];
    this.N = field.N; this.len = field.length;
    this.trk = new Map(field.cars.map((c) => [c, { idx: this.nearest(c.vehicle.cur.pos, 0, true), cross: 0, mid: false, lapStart: null, lastLap: null, best: null, laps: [], finished: false, finishT: null, valid: true, offT: 0, dist: 0 }]));
    this.order = [...field.cars].sort((a, b) => this.score(b) - this.score(a));
    this.heroPos = this.order.indexOf(field.hero) + 1; this.posHold = 0;
    this.wrong = 0; this.offT = 0;
    this.drift = mode === 'drift' ? { score: 0, chain: 0, mult: 1, chainT: 0, gap: 0, left: this.M.seconds, best: 0, banked: [] } : null;
    field.hold = this.M.start !== 'none';
    if (this.M.start === 'none') this.state = 'running';
    this.lights = 0; this.goAt = this.M.start === 'lights' ? 2.2 + 5 + 0.6 + Math.random() * 1.0 : 3.2;
  }

  emit(type, data = {}) { this.events.push({ type, ...data }); }
  driver(c) { return this.drivers?.[c.key] ?? DRIVER[c.key]; }

  /** nearest racing-line index to p: a window ahead of the last one, or the whole line when lost */
  nearest(p, from, all = false) {
    const L = this.field.linePts, N = this.N;
    let best = Infinity, bi = from;
    const scan = (k) => { const j = ((k % N) + N) % N, d = L[j].distanceToSquared(p); if (d < best) { best = d; bi = j; } };
    if (all) for (let k = 0; k < N; k++) scan(k); else for (let k = from - 6; k <= from + 30; k++) scan(k);
    if (!all && best > 30 * 30) return this.nearest(p, from, true);
    return bi;
  }

  /** progress round the race in racing-line samples: laps counted at the start/finish line, plus how far round the current lap */
  progress(c) {
    const s = this.trk.get(c), L = this.field.linePts, a = L[s.idx], b = L[(s.idx + 1) % this.N], p = c.vehicle.cur.pos;
    const ab = b.clone().sub(a), frac = Math.min(1, Math.max(0, p.clone().sub(a).dot(ab) / Math.max(ab.lengthSq(), 1e-6)));   // between samples
    // the grid sits just before the line: lap 1 starts at the first crossing, so a car that has crossed once is at (idx), not (N + idx),
    // or the leader would read a whole lap ahead of the cars still waiting to cross
    // a car already past the line with no recorded crossing (a reset across it) is on lap 1, not a lap behind
    const lap = s.cross === 0 && s.idx < this.N / 2 ? 0 : s.cross - 1;
    return lap * this.N + s.idx + frac;
  }
  /** for ordering: progress, with finished cars ahead of everyone, in finishing order */
  score(c) { const s = this.trk.get(c); return this.progress(c) + (s.finished ? 1e7 - s.finishT : 0); }

  update(dt) {
    this.t += dt;
    const F = this.field, hero = F.hero, hv = hero.vehicle;
    // ---- the start
    if (this.state === 'grid') {
      if (this.M.start === 'lights') {
        const n = Math.min(5, Math.floor(this.t - 2.2) + 1);
        if (this.t > 2.2 && n > this.lights) { this.lights = n; this.emit('light', { n }); }
      } else {
        const n = 3 - Math.floor(this.t - 0.2);
        if (this.t > 0.2 && n !== this.count && n >= 1) { this.count = n; this.emit('count', { n }); }
      }
      if (this.t >= this.goAt) { this.state = 'running'; F.hold = false; this.lights = 0; this.emit('go'); }
    }
    if (this.state === 'running' || this.state === 'done') this.raceT += dt;

    // ---- laps, positions
    for (const [c, s] of this.trk) {
      const prev = s.idx;
      s.idx = this.nearest(c.vehicle.cur.pos, prev);
      const N = this.N;
      if (s.idx > N * 0.45 && s.idx < N * 0.55) s.mid = true;
      if (prev > N * 0.9 && s.idx < N * 0.1 && this.state !== 'grid') {                  // over the line, forwards
        if (s.recross) { s.cross++; s.recross = false; }                                  // backed over it and forwards again: the same lap runs on
        else if (s.cross === 0 || s.mid) {
          if (s.cross > 0 && !s.finished) this.lapDone(c, s);                             // a finished car's cool-down lap is not a lap
          s.cross++; s.mid = false; s.lapStart = this.raceT; s.valid = true;
          if (this.M.laps && s.cross >= this.laps + 1 && !s.finished) this.finish(c, s);
          else if (this.M.laps && c === hero && s.cross === this.laps) this.emit('finalLap');
        }
      } else if (prev < N * 0.1 && s.idx > N * 0.9 && s.cross > 0) { s.cross--; s.recross = true; }   // backwards over the line
      // track limits (time trial): the lap is void after a second with all four wheels off
      const surf = c.vehicle.wheels.filter((w) => w.contact).map((w) => w.surface?.name);
      const off = surf.length > 0 && surf.every((n) => !ON_TRACK.has(n));
      s.offT = off ? s.offT + dt : 0;
      if (c === hero && s.offT > 1 && s.valid && this.M.limits && s.cross > 0) { s.valid = false; this.emit('invalid'); }
    }
    this.order = [...this.trk.keys()].sort((a, b) => this.score(b) - this.score(a));
    // a new position counts once it has held for 0.6 s (side by side, the order flickers)
    const pos = this.order.indexOf(hero) + 1;
    this.posHold = pos !== this.heroPos ? this.posHold + dt : 0;
    if (this.posHold > 0.6) { if (this.state === 'running') this.emit('position', { from: this.heroPos, to: pos }); this.heroPos = pos; this.posHold = 0; }
    // ---- the hero: wrong way, off track, crashes, spins
    if (this.state === 'running') {
      const s = this.trk.get(hero), L = this.field.linePts, a = L[s.idx], b = L[(s.idx + 3) % this.N];
      const fwd = new THREE.Vector3(1, 0, 0).applyQuaternion(hv.cur.quat), tan = b.clone().sub(a).normalize();
      this.wrong = hv.speed > 4 && fwd.dot(tan) < -0.3 ? this.wrong + dt : 0;
      if (s.offT > 0.8 && !this.offSaid) { this.offSaid = true; this.emit('offTrack'); }
      if (s.offT === 0) this.offSaid = false;
      const decel = -hv.aBody.x, kmh = hv.speed * 3.6;
      if ((decel > 24 || Math.abs(hv.aBody.z) > 34) && this.t - (this.crashT ?? -9) > 2) { this.crashT = this.t; this.emit('crash', { kmh: Math.max(kmh, (this.lastKmh ?? kmh)) }); }
      if (Math.abs(hv.state.beta) > 1.9 && hv.state.drift < 0.5 && this.t - (this.spinT ?? -9) > 4) { this.spinT = this.t; this.emit('spin'); }
      this.lastKmh = kmh;
      if (this.drift) this.driftUpdate(dt, hv, s);
    }
    if (this.state === 'done') this.doneT = (this.doneT ?? 0) + dt;
    const ev = this.events; this.events = [];
    return ev;
  }

  lapDone(c, s) {
    const t = this.raceT - s.lapStart, valid = s.valid;
    s.lastLap = t; s.laps.push({ t, valid });
    const pb = valid && (s.best === null || t < s.best);
    if (pb) s.best = t;
    const fastest = valid && [...this.trk.values()].every((o) => o === s || o.best === null || t <= o.best);
    if (c === this.field.hero) this.emit('lap', { t, valid, pb, fastest, n: s.laps.length, delta: s.laps.length > 1 && s.best !== t ? t - s.best : null });
    else if (fastest && this.mode === 'race') this.emit('rivalFastest', { car: c, t });
    if (c === this.field.hero && this.M.validLaps && s.laps.filter((l) => l.valid).length >= this.M.validLaps) { this.state = 'done'; this.emit('finish', { best: s.best }); }   // qualifying: done after N valid laps
  }

  finish(c, s) {
    s.finished = true; s.finishT = this.raceT;
    if (c === this.field.hero) { this.state = 'done'; this.emit('finish', { pos: this.order.indexOf(c) + 1 }); }
  }

  driftUpdate(dt, v, s) {
    const D = this.drift;
    if (this.state !== 'running') return;
    D.left = Math.max(0, D.left - dt);
    const deg = Math.abs(THREE.MathUtils.radToDeg(v.state.beta)), kmh = v.speed * 3.6;
    const drifting = v.state.drift > 0.5 && deg > 8 && kmh > 30;
    if (s.offT > 0.3 || this.crashT === this.t) { if (D.chain > 0) { this.emit('driftFail', { lost: D.chain * D.mult }); } D.chain = 0; D.mult = 1; D.chainT = 0; }
    if (drifting) {
      D.gap = 0; D.chainT += dt;
      D.mult = Math.min(5, 1 + Math.floor(D.chainT / 2) * 0.5);
      D.chain += deg * kmh * 0.02 * dt;
      D.angle = deg;
    } else if (D.chain > 0) {
      D.gap += dt;
      if (D.gap > 1.2) { const pts = D.chain * D.mult; D.score += pts; D.banked.push(pts); this.emit('driftBank', { pts, mult: D.mult }); D.chain = 0; D.mult = 1; D.chainT = 0; }
    }
    if (D.left === 0 && this.state === 'running') {
      if (D.chain > 0) { D.score += D.chain * D.mult; D.chain = 0; }
      this.state = 'done'; this.emit('finish', { score: D.score });
    }
  }

  /** the classification: finished cars by time, the rest by progress, each with a gap (estimated for the unfinished) */
  results() {
    const hero = this.field.hero, rows = [];
    const lapLen = this.len, avg = (c) => { const s = this.trk.get(c); const d = this.score(c) / this.N * lapLen; return d > 50 && this.raceT > 0 ? d / this.raceT : 50; };
    for (const c of this.order) {
      const s = this.trk.get(c), d = this.driver(c);
      let total = s.finishT;
      if (!s.finished && this.M.laps) { const left = this.laps * this.N - this.score(c); total = this.raceT + Math.max(0, left / this.N * lapLen) / avg(c); }
      rows.push({ car: c, key: c.key, hero: c === hero, driver: d, best: s.best, total, finished: s.finished, laps: s.laps });
    }
    rows.sort((a, b) => (this.M.laps ? a.total - b.total : 0));
    return rows;
  }

  /** gap in seconds from each car to the leader, from track distance and the leader's pace; between finishers, their finish times */
  gaps() {
    const lead = this.order[0], L = this.trk.get(lead), pace = Math.max(20, lead.vehicle.speed || 40);
    // a finished leader stays at the line (its cool-down lap is no lead), and the time since it finished counts
    const lp = L.finished ? this.laps * this.N : this.progress(lead), since = L.finished ? this.raceT - L.finishT : 0;
    return this.order.map((c) => { const s = this.trk.get(c); return { car: c, gap: s.finished ? s.finishT - (L.finishT ?? s.finishT) : since + (lp - this.progress(c)) / this.N * this.len / pace }; });
  }
}
