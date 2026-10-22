// Drives the real Commentary with a simulated race (virtual clock, fake audio) and checks the booth mix:
// Enzo:Alastair share, runs of one voice, gaps between lines, overlaps, airtime. `--report` prints the numbers only.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {Commentary} from '../src/game/audio.js';
const dir = new URL('../public/assets/audio/announcers/', import.meta.url);
const script = JSON.parse(fs.readFileSync(new URL('script.json', dir))), voices = JSON.parse(fs.readFileSync(new URL('voice_manifest.json', dir))).lines;
const lines = script.lines.filter((l) => voices[l.id]);
const report = process.argv.includes('--report');

// one race (intro, lights ~22 s in, then three 45 s laps); mirrors the say() calls in game.js (same priorities, cooldowns, filler rule). dt 0.1 s
function race(seed, laps = 3) {
  let s = seed; Math.random = () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  let now = 0, cur = null, calls = 0; const timers = [], log = [];
  globalThis.setTimeout = (f, ms) => { timers.push({ at: now + ms / 1000, f }); };
  const audio = {
    ready: true, ctx: { get currentTime() { return now; } }, voices, duck: { gain: { setTargetAtTime() {} } },
    play: (file, { delay = 0 } = {}) => {
      const f = file.replace('announcers/', ''), e = { file: f, speaker: f.split('/')[0], start: now + delay, end: now + delay + voices[Object.keys(voices).find((k) => voices[k].file === f)].seconds, call: cur };
      const src = { stop: () => { if (now < e.start) e.dead = true; else e.end = Math.min(e.end, now); } };
      log.push(e); return { then: (f) => f(src) };   // synchronous thenable: the source exists the moment it is scheduled
    }
  };
  const c = new Commentary(audio, lines); c.setTags(['race', 'night', 'dry', 'corniche']);
  const say = (cat, o = {}) => { cur = { id: ++calls, prio: o.priority ?? 2, force: !!o.force }; return c.say(cat, o); };
  const lapT = 45, total = laps * lapT + 30, ev = [];
  ev.push([0.4, () => say('intro_session', { priority: 3, force: true })], [14, () => say('grid_and_lights', { extraTags: ['lights_on'], priority: 2, cooldown: 0 })],
    [22, () => say('grid_and_lights', { extraTags: ['lights_out'], priority: 3, force: true })], [29, () => say(Math.random() < .5 ? 'race_start_good' : 'race_start_bad', { priority: 2 })]);
  for (let n = 1; n <= laps; n++) ev.push([n * lapT + 30, () => { if (n === 1) say('lap_one_complete', { priority: 1 }); else if (Math.random() < .3) say('fastest_lap', { priority: 2 }); else if (Math.random() < .4) say('personal_best', { priority: 2 }); }]);
  ev.push([(laps - 1) * lapT + 30, () => say('final_lap', { priority: 3 })]);
  for (let t = 34; t < total - 5; t += 4 + Math.random() * 8) {
    const r = Math.random(), f = r < .35 ? () => say(Math.random() < .5 ? 'overtake_player' : 'overtaken_player', { priority: 2, cooldown: 12 })
      : r < .5 ? () => say('off_track', { priority: 2, cooldown: 14 }) : r < .6 ? () => say('spin', { priority: 2, cooldown: 12 })
      : r < .7 ? () => say(Math.random() < .4 ? 'hard_crash' : 'soft_crash', { priority: 3, cooldown: 10 }) : r < .78 ? () => say(Math.random() < .5 ? 'lead_taken' : 'lead_lost', { priority: 3, cooldown: 15 })
      : r < .9 ? () => say('nitro_used', { cooldown: 40, priority: 1 }) : null;
    if (f) ev.push([t, f]);
  }
  ev.push([total, () => say('player_podium', { priority: 3, force: true })]);
  ev.sort((a, b) => a[0] - b[0]);
  let quiet = 0;
  for (; now < total + 14; now = Math.round((now + 0.1) * 10) / 10) {
    for (const t of timers.splice(0).filter((t) => (t.at > now ? (timers.push(t), false) : true))) t.f();
    while (ev.length && ev[0][0] <= now) { if (ev.shift()[1]() ) quiet = 0; }
    quiet += 0.1;
    if (quiet > 24 && !c.busy) { const p = Math.random(); say(p < .55 ? 'general_filler' : p < .85 ? 'booth_exchanges' : 'paddock_report', { priority: 1, cooldown: 0 }); quiet = 0; }
  }
  return { log: log.filter((e) => !e.dead).sort((a, b) => a.start - b.start), dur: total + 14 };
}

const all = [], races = [];
for (let i = 1; i <= 24; i++) { const r = race(i * 7919); races.push(r); all.push(...r.log); }
const share = (log, sp) => log.filter((e) => e.speaker === sp).length / log.filter((e) => e.speaker !== 'kavya').length;
const air = races.reduce((a, r) => a + r.log.reduce((s, e) => s + e.end - e.start, 0), 0) / races.reduce((a, r) => a + r.dur, 0);
let maxRun = 0, minGapPrio = Infinity, overlaps = 0, lines3 = 0, longest = 0;
for (const r of races) {
  let run = 0;
  r.log.forEach((e, i) => {
    run = i && r.log[i - 1].speaker === e.speaker ? run + 1 : 1; maxRun = Math.max(maxRun, run);
    if (i) { const gap = e.start - r.log[i - 1].end; if (gap < -0.001) overlaps++; }
  });
}
console.log(`races ${races.length}, lines ${all.length} (${(all.length / races.length).toFixed(1)}/race), enzo ${(share(all, 'enzo') * 100).toFixed(0)}%, alastair ${(share(all, 'alastair') * 100).toFixed(0)}%, kavya ${all.filter((e) => e.speaker === 'kavya').length}, airtime ${(air * 100).toFixed(0)}%, max run ${maxRun}, overlaps ${overlaps}`);
if (!report) {
  assert.ok(share(all, 'enzo') >= .4 && share(all, 'enzo') <= .6, 'Enzo share 40-60%');
  assert.ok(air <= .4, 'airtime at most 40%');
  assert.equal(overlaps, 0, 'no two voices at once');
  // a run of 3+ from one voice is allowed only when the category has no line from anyone else (e.g. Kavya's paddock reports)
  const runs = races.flatMap((r) => r.log.map((e, i) => (i >= 2 && r.log[i - 1].speaker === e.speaker && r.log[i - 2].speaker === e.speaker && e.speaker !== 'kavya' ? e.file : null)).filter(Boolean));
  assert.deepEqual(runs, [], 'no more than 2 in a row from one voice');
  // inside an exchange the reply comes 0.4-0.8 s after the line before
  const inEx = races.flatMap((r) => r.log.filter((e, i) => i && e.call.id === r.log[i - 1].call.id).map((e) => e.start - r.log.find((q) => q.call.id === e.call.id && q.end <= e.start + 0.01 && q.end > e.start - 0.9 && q !== e).end));
  assert.ok(inEx.length > 20 && inEx.every((g) => g >= 0.39 && g <= 0.81), 'reply gaps 0.4-0.8 s');
  // a new exchange waits out the quiet for its priority (3 and forced lines may cut in)
  const need = { 1: 10, 2: 6 };
  for (const r of races) r.log.forEach((e, i) => { const p = r.log[i - 1]; if (p && e.call.id !== p.call.id && e.call.prio < 3 && !e.call.force) assert.ok(e.start - p.end >= need[e.call.prio] - 0.01, 'gap ' + (e.start - p.end).toFixed(2) + ' before ' + e.file); });
  console.log('ok');
}
if (process.argv.includes('--cats')) { const c = {}; for (const e of all) { const k = e.file.split('.')[1]; c[k] ??= { enzo: 0, alastair: 0, kavya: 0 }; c[k][e.speaker]++; } console.table(c); }
if (process.argv.includes('--ov')) races.slice(0, 3).forEach((r) => r.log.forEach((e, i) => { const p = r.log[i - 1]; if (p && e.start < p.end - 0.001) console.log(p.file, p.start.toFixed(2), p.end.toFixed(2), '|', e.file, e.start.toFixed(2), e.end.toFixed(2)); }));
