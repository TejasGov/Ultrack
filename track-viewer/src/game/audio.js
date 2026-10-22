// Game audio on the Web Audio API (assets/audio/README.md says how each sound is meant to be used):
// - buses: master -> engine, effects, commentary, crowd (volumes from the settings)
// - real recorded engines: idle / low / mid / high loops crossfaded and pitched by rpm, a decel
//   layer on lift-off; rpm comes from a display gearbox (the physics has no gears; HUD shows the same gear)
// - one-shots: race cues, pops, nitro, crashes, crowd, fireworks; the crowd ambience loop
// - commentary: Enzo, Alastair and Kavya lines picked by category and situation, never two at once, speakers alternating
//   (Enzo, then Alastair answering), minimum gaps by priority and an airtime cap, no repeats until a category is used up
import { createPA, RoadAudio } from './audio-effects.js';
import { EV } from './ev.js';
const A = '/assets/audio/';

export class GameAudio {
  constructor() {
    this.ctx = null; this.buffers = new Map(); this.ready = false;
  }

  /** must run inside a user gesture (browsers start audio only then) */
  async start() {
    if (this.ctx) { if (this.ctx.state === 'suspended') await this.ctx.resume(); await this.initializing; return; }
    const ctx = this.ctx = new AudioContext({ latencyHint: 'interactive' });
    this.master = ctx.createGain(); this.master.connect(ctx.destination);
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -10; comp.ratio.value = 4;   // keeps a crash and a shout from clipping
    this.master.disconnect(); this.master.connect(comp); comp.connect(ctx.destination);
    this.bus = {};
    for (const b of ['engine', 'effects', 'commentary', 'crowd']) { this.bus[b] = ctx.createGain(); this.bus[b].connect(this.master); }
    const pa=createPA(ctx,this.master);this.bus.commentary.disconnect();this.bus.commentary.connect(pa.input);this.pa=pa;
    this.duck = ctx.createGain(); this.duck.connect(this.bus.crowd);    // the crowd dips under the commentators
    this.initializing=this.loadBank();await this.initializing;
  }

  async loadBank() {
    const [bank, script, voices] = await Promise.all([
      fetch(A+'recorded-engine-bank.json').then(r=>r.ok?r.json():null).catch(()=>null),
      ...['announcers/script.json', 'announcers/voice_manifest.json'].map(f=>fetch(A+f).then(r=>r.json()))
    ]);
    this.engineBank=bank; this.voices = voices.lines;
    this.commentary = new Commentary(this, script.lines.filter((l) => voices.lines[l.id]));
    this.ready = true;
  }

  /** menu idle: decode what Start would otherwise wait for (the car's engine loops, its start cue, the lights) */
  async preload(key) {
    if (this.initializing) await this.initializing;
    if (!this.ready) return;
    const prof = this.engineBank?.profiles?.[key];
    const files = [...Object.values(prof?.loops ?? {}).map((l) => l.file), prof?.start, prof?.rev, 'race/lights-on.ogg', 'race/lights-out.ogg', 'race/horn-start.ogg'];
    await Promise.all(files.filter(Boolean).map((f) => this.buffer(f)));
  }

  setVolumes(s) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime, set = (g, v) => g.gain.setTargetAtTime(v, t, 0.05);
    set(this.master, s.master); set(this.bus.engine, s.engine); set(this.bus.effects, s.effects);
    set(this.bus.commentary, s.commentaryOn ? s.commentary : 0); set(this.bus.crowd, s.crowd);
  }

  buffer(path) {
    if (!this.buffers.has(path)) this.buffers.set(path, fetch(A + path).then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(path)))).then((b) => this.ctx.decodeAudioData(b)).catch((e) => { console.warn('audio:', e.message); return null; }));
    return this.buffers.get(path);
  }

  /** one-shot; returns the source node (or null). bus: effects | crowd | commentary | engine */
  async play(path, { bus = 'effects', gain = 1, rate = 1, delay = 0, onended } = {}) {
    if (!this.ready) return null;
    const buf = await this.buffer(path); if (!buf) return null;
    const src = this.ctx.createBufferSource(), g = this.ctx.createGain();
    src.buffer = buf; src.playbackRate.value = rate; g.gain.value = gain;
    src.connect(g).connect(bus === 'crowd' ? this.duck : this.bus[bus]);
    if (onended) src.onended = onended;
    src.start(this.ctx.currentTime + delay);
    return src;
  }

  /** a looping layer: { src, gain, stop() } */
  async loop(path, { bus = 'effects', gain = 0 } = {}) {
    if (!this.ready) return null;
    const buf = await this.buffer(path); if (!buf) return null;
    const src = this.ctx.createBufferSource(), g = this.ctx.createGain();
    src.buffer = buf; src.loop = true; g.gain.value = gain;
    src.connect(g).connect(bus === 'crowd' ? this.duck : this.bus[bus]);
    src.start();
    return { src, gain: g, stop: () => { try { src.stop(); } catch { /* already stopped */ } } };
  }

  pick(prefix, n) { return `${prefix}${1 + Math.floor(Math.random() * n)}.ogg`; }

  // ---------------------------------------------------------------------------------------------- crowd
  async crowdOn() { if (!this.crowdLoop) this.crowdLoop = await this.loop('crowd/ambience-loop.ogg', { bus: 'crowd', gain: 0.35 }); }
  cheer(big) { this.play(big ? 'crowd/cheer-big.ogg' : 'crowd/cheer-medium.ogg', { bus: 'crowd', gain: 0.8 }); if (big) this.play('crowd/applause.ogg', { bus: 'crowd', gain: 0.6, delay: 0.8 }); }

  // ---------------------------------------------------------------------------------------------- engine
  /** the player's engine for a car key; replaces any previous one */
  async engineFor(key) {
    this.engineOff();
    const token=this.engineToken;
    if(this.initializing)await this.initializing;
    if (!this.ready||token!==this.engineToken) return;
    const electric=EV.has(key);
    if(electric){this.engine={ev:true,prof:{redline:16000},layers:{},road:new RoadAudio(this.ctx,this.bus,{electric:true})};return;}
    // Missing recordings stay quiet; never silently restore the generated V1 bank.
    const prof = this.engineBank?.profiles?.[key] ?? {redline:8000,loops:{}};
    const layers = {};
    await Promise.all(Object.entries(prof.loops).map(async ([name, l]) => { layers[name] = { ...l, h: await this.loop(l.file, { bus: 'engine', gain: 0 }) }; }));
    if(token!==this.engineToken){for(const l of Object.values(layers))l.h?.stop();return;}
    this.engine = { prof, layers, ev:false,rev:prof.rev,shiftUntil:0,road:new RoadAudio(this.ctx,this.bus) };
  }

  engineOff() {
    this.engineToken=(this.engineToken??0)+1;
    if (!this.engine) return;
    this.engine.road?.stop();
    for (const l of Object.values(this.engine.layers)) l.h?.stop();
    this.engine = null;
  }

  /** rpm and throttle 0..1 each frame; mute 0..1 (pause, menus) */
  engineUpdate(rpm, throttle, mute = 1, speed = 0, slip = 0) {
    const E = this.engine; if (!E || !this.ctx) return;
    E.road?.update(speed,throttle,mute,slip);if(E.ev)return;
    const t = this.ctx.currentTime, L = E.layers, order = ['idle', 'low', 'mid', 'high'].filter((k) => L[k]?.h);
    if(!order.length)return;
    const gains = {};
    // the two layers either side of the rpm, equal-power crossfade
    let i = 0; while (i < order.length - 1 && rpm > L[order[i + 1]].rpm) i++;
    const a = order[i], b = order[Math.min(i + 1, order.length - 1)];
    const x = a === b ? 0 : Math.min(1, Math.max(0, (rpm - L[a].rpm) / (L[b].rpm - L[a].rpm)));
    for (const k of order) gains[k] = 0;
    gains[a] = Math.cos(x * Math.PI / 2); gains[b] = (gains[b] ?? 0) + Math.sin(x * Math.PI / 2);
    const idleRpm=L.idle?.rpm??L[order[0]].rpm;
    const load = 0.32 + 0.68 * throttle, decel = L.decel?.h ? Math.max(0, 1 - throttle * 5) * Math.min(1, Math.max(0, (rpm - idleRpm * 1.6) / (idleRpm * 2))) : 0;
    const shiftGain=t<(E.shiftUntil??0)?0.55:1,boost=this.nitroOn?1.08:1;
    for (const k of order) {
      // Adjacent reference notes must both reach the requested pitch. The old
      // ±15% clamp made RPM rise while the recording stayed on a fixed note.
      const l = L[k], rate = Math.min(3.5, Math.max(0.45, rpm / l.rpm));
      l.h.src.playbackRate.setTargetAtTime(rate, t, 0.03);
      l.h.gain.gain.setTargetAtTime(gains[k] * (k === 'idle' ? 0.65 : load * (1 - 0.7 * decel)) * mute * 0.7 * shiftGain * boost, t, 0.04);
    }
    if (L.decel?.h) {
      L.decel.h.src.playbackRate.setTargetAtTime(Math.min(3.5, Math.max(0.45, rpm / L.decel.rpm)), t, 0.03);
      L.decel.h.gain.gain.setTargetAtTime(decel * mute * 0.32, t, 0.06);
    }
  }

  pop() {
    // Natural burble comes from the car's recorded overrun layer. Add a separate
    // pop only when an explicitly reviewed recording exists for this engine.
    const e=this.engine,files=e?.prof?.pops;
    if(!e||e.ev||!files?.length||this.ctx.currentTime<(e.nextPop??0))return;
    e.nextPop=this.ctx.currentTime+.35;
    this.play(files[Math.floor(Math.random()*files.length)],{bus:'engine',gain:.35});
  }
  shift() {
    const e=this.engine;if(!e||e.ev)return;
    e.shiftUntil=this.ctx.currentTime+.09;
    const files=e.prof.shifts;
    if(files?.length)this.play(files[Math.floor(Math.random()*files.length)],{bus:'engine',gain:.3});
  }

  // ---------------------------------------------------------------------------------------------- nitro
  async nitro(on) {
    // Boost lifts the real engine slightly. No generated sci-fi jet samples.
    this.nitroOn=on;
  }

  crash(kmh) {
    if (kmh < 40) this.play(this.pick('crash/soft-', 3), { gain: 0.4 + kmh / 80 });
    else { this.play(this.pick('crash/hard-', 3), { gain: Math.min(1, 0.5 + kmh / 200) }); this.play(this.pick('crash/glass-tinkle-', 2), { gain: 0.5, delay: 0.2 }); }
  }

  stopAll() { this.engineOff(); this.nitro(false); this.commentary?.stop(); }
}

const GAP = { 1: 10, 2: 6, 3: 1.5 };   // quiet after a line before the next may start, by priority (3 cuts in sooner)
const AIR = 0.35, WIN = 60;              // booth airtime cap over the last minute; priority 3 ignores it, so music gets room

/** Commentators. say(category, situation) plays one fitting exchange if the booth has been quiet long enough (or cuts a lower priority). */
export class Commentary {
  constructor(audio, lines) {
    this.audio = audio; this.lines = lines; this.used = new Set(); this.lastAt = {}; this.hist = []; this.prio = 0;
    this.byId = Object.fromEntries(lines.map((l) => [l.id, l]));
    this.second = new Set(lines.map((l) => l.pair).filter(Boolean));   // answers only play after the line that names them
    this.tags = new Set();
  }

  /** situation tags lines may require through their `when`: race / free / endurance, dusk / night, rain, ... */
  setTags(tags) { this.tags = new Set(tags); }

  /** cut everything playing or scheduled; what never started leaves the history */
  stop() {
    const now = this.audio.ctx?.currentTime ?? 0;
    for (const e of this.hist) if (e.end > now) { e.cut = true; try { e.src?.stop(); } catch { /* done */ } e.end = Math.max(Math.min(e.end, now), e.start); }
    this.hist = this.hist.filter((e) => !e.cut || e.end > e.start); this.prio = 0;
  }

  get endAt() { return this.hist.reduce((m, e) => Math.max(m, e.end), 0); }
  get busy() { return !!this.audio.ctx && this.audio.ctx.currentTime < this.endAt; }

  /**
   * category: a script.json category; opts: { speaker, priority (1-3), cooldown s, extraTags, reply 0..1 }.
   * Speakers alternate (Enzo opens, never 3 in a row from one voice unless nobody else has a line); an Enzo line gets Alastair's
   * answer from the same category with chance `reply`. Returns true if a line started.
   */
  say(category, { speaker, priority = 2, cooldown = 6, extraTags = [], reply = 0.5, force = false } = {}) {
    const a = this.audio; if (!a.ready) return false;
    const now = a.ctx.currentTime, busy = this.busy;
    if (!force && now - (this.lastAt[category] ?? -1e9) < cooldown) return false;
    // busy: only a priority 3 line cuts the booth off; idle: wait out the gap for this priority
    if (busy ? !(force || priority > Math.max(this.prio, 2)) : !force && now - this.endAt < GAP[priority]) return false;
    const tags = new Set([...this.tags, ...extraTags]);
    const pool = this.lines.filter((l) => l.category === category && !l.retired && !this.second.has(l.id) && (!l.when || tags.has(l.when)));
    // who: the voice that did not just talk (Enzo opens), never the one that already had two in a row
    const [x, y] = this.hist.slice(-2).map((e) => e.speaker), want = y === 'enzo' ? 'alastair' : 'enzo', barred = x && x === y ? y : null;
    let voices = [...new Set(pool.map((l) => l.speaker))]; if (voices.length > 1) voices = voices.filter((v) => v !== barred);
    const who = speaker ?? (voices.includes(want) ? want : voices[0]);
    const fresh = (src) => { let f = src.filter((l) => !this.used.has(l.id)); if (!f.length) { src.forEach((l) => this.used.delete(l.id)); f = src; } const ex = f.filter((l) => l.when && tags.has(l.when)); return ex.length ? ex : f; };
    const choose = (src) => { const f = fresh(src); return f[Math.floor(Math.random() * f.length)]; };
    const mine = pool.filter((l) => l.speaker === who); if (!mine.length) return false;
    const chain = [choose(mine)];
    while (chain.at(-1).pair && this.byId[chain.at(-1).pair] && chain.length < 4) chain.push(this.byId[chain.at(-1).pair]);
    const alt = pool.filter((l) => l.speaker === 'alastair');
    if (chain.length === 1 && who === 'enzo' && alt.length && Math.random() < reply) chain.push(choose(alt));
    // schedule: each reply comes 0.4-0.8 s after the line before
    let t = now; const seq = chain.map((line, i) => { t += i ? 0.4 + Math.random() * 0.4 : 0; const e = { line, speaker: line.speaker, start: t, end: t + a.voices[line.id].seconds }; t = e.end; return e; });
    if (!force && priority < 3) {
      const win = Math.min(WIN, Math.max(now, 30)), talked = this.hist.reduce((s, e) => s + Math.max(0, Math.min(e.end, now) - Math.max(e.start, now - win)), 0);
      if ((talked + t - now) / win > AIR) return false;
    }
    if (busy) this.stop();
    chain.forEach((l) => this.used.add(l.id)); this.lastAt[category] = now; this.prio = priority;
    a.duck.gain.setTargetAtTime(0.45, now, 0.15); a.duck.gain.setTargetAtTime(1, t, 0.4);   // the crowd dips under the whole exchange
    this.hist = this.hist.filter((h) => h.end > now - WIN);
    for (const e of seq) {
      this.hist.push(e);
      a.play('announcers/' + a.voices[e.line.id].file, { bus: 'commentary', delay: e.start - now }).then((src) => { if (e.cut) src?.stop(); else e.src = src; });
    }
    return true;
  }
}

/** A display gearbox: the physics has no gears; the HUD and the engine sound use this one. */
export class Gearbox {
  constructor(topSpeed, redline = 8000, ev = false) {
    this.top = topSpeed; this.red = redline; this.idle = ev ? 0 : Math.min(1100, redline * 0.12); this.ev = ev;
    this.ratios = ev ? [1.02] : [0.27, 0.41, 0.54, 0.66, 0.78, 0.9, 1.03];
    this.gear = 0; this.rpm = this.idle; this.shiftT = 0;
  }

  /** returns 'up' | 'down' | null on a shift */
  update(dt, speed, throttle, reverse = false) {
    let shifted = null;
    const vTop = (g) => this.top * this.ratios[g];
    if (!this.ev) {
      const r = speed / vTop(this.gear);
      if (r > 0.95 && this.gear < this.ratios.length - 1 && throttle > 0.2) { this.gear++; shifted = 'up'; this.shiftT = 0.12; }
      else if (this.gear > 0 && speed < vTop(this.gear - 1) * 0.68) { this.gear--; shifted = 'down'; }
    }
    const frac = Math.min(1.02, speed / vTop(this.gear));
    let want = Math.max(this.idle + (throttle * 0.25 * this.red) * (speed < 2 ? 1 : 0), this.red * frac);
    if (this.shiftT > 0) { this.shiftT -= dt; want *= 0.78; }
    this.rpm += (want - this.rpm) * (1 - Math.exp(-(want > this.rpm ? 14 : 8) * dt));
    this.reverse = reverse;
    return shifted;
  }

  get label() { return this.reverse ? 'R' : this.ev ? 'D' : String(this.gear + 1); }
}
