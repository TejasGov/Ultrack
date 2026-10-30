// Saved settings and the player's profile (chosen car, paint per car, best laps, drift records), in localStorage.
// Storage can be missing or blocked (private windows, previews): every read and write is guarded, and the game
// runs on the defaults if nothing can be saved.
import { migrate, START_COINS, levelsOf, buyUpgrade, earn } from './economy.js';
import { canSelectCar } from './progression.js';
const KEY = 'ultrack.v1';

export const DEFAULT_SETTINGS = {
  // display
  quality: 'auto', look: 'dusk', track: 'marina', weather: 'dry', motionBlur: 'full', reduceMotion: false, fovOffset: 0, showFps: false,
  // driving
  assists: 'rookie', units: 'kmh', laps: 3, opponents: true,
  // audio (0..1)
  master: 0.85, engine: 0.8, effects: 0.8, commentary: 0.9, crowd: 0.5, commentaryOn: true,
};

const fresh = () => ({ settings: { ...DEFAULT_SETTINGS }, car: 'av12', paint: {}, best: {}, drift: {}, coins: START_COINS, upgrades: {} });

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return fresh();
    const d = JSON.parse(raw);
    const settings = { ...DEFAULT_SETTINGS, ...(d.settings ?? {}) };
    if (settings.assists !== 'pro') settings.assists = 'rookie';   // Casual and Sport merged into Rookie; Pro stays
    // records were keyed by car alone before tracks: marina was the only circuit then, so the old ones are its records
    const perTrack = (o) => Object.fromEntries(Object.entries(o ?? {}).map(([k, v]) => [k.includes('/') ? k : `marina/${k}`, v]));
    return migrate({ ...fresh(), ...d, settings, coins: d.coins, best: perTrack(d.best), drift: perTrack(d.drift) });   // old saves: coins undefined -> the starting balance
  } catch { return fresh(); }
}

export const store = {
  data: load(),
  selectCar(key) {
    if (!canSelectCar(key, this.data)) return false;
    this.data.car = key; this.save(); return true;
  },
  save() { try { localStorage.setItem(KEY, JSON.stringify(this.data)); } catch { /* not saved: the game still runs */ } },
  get settings() { return this.data.settings; },
  set(k, v) { this.data.settings[k] = v; this.save(); },
  /** U-coins: balance, earnings, and per-car upgrade levels { engine, tyres, brakes } (see economy.js) */
  get coins() { return this.data.coins; },
  earn(n) { earn(this.data, n); this.save(); return this.data.coins; },
  levels(key) { return levelsOf(this.data, key); },
  buy(key, cat, hp) { const r = buyUpgrade(this.data, key, cat, hp); if (r.ok) this.save(); return r; },
  paintOf(key) { return this.data.paint[key] ?? null; },
  setPaint(key, p) { if (p) this.data.paint[key] = p; else delete this.data.paint[key]; this.save(); },
  /** records are per circuit and car ('marina/av12'): lap lengths differ, so one track's time means nothing on another */
  recKey(key) { return `${this.settings.track}/${key}`; },
  bestOf(key) { return this.data.best[this.recKey(key)]; },
  driftOf(key) { return this.data.drift[this.recKey(key)] ?? 0; },
  /** best lap for car on the current track; returns true when `t` is a new record */
  bestLap(key, t) {
    const cur = this.bestOf(key);
    if (t !== undefined && (cur === undefined || t < cur)) { this.data.best[this.recKey(key)] = t; this.save(); return true; }
    return false;
  },
  driftRecord(key, score) {
    if (score > this.driftOf(key)) { this.data.drift[this.recKey(key)] = Math.round(score); this.save(); return true; }
    return false;
  },
};

// driving aids per preset (src/physics/vehicle.js step(h, assist))
export const ASSISTS = {
  rookie: { counter: 0.45, stability: 1.25, tcs: 0.8, label: 'Rookie', note: 'Forgiving: the car follows the wheel, ABS and traction control help.' },
  pro: { counter: 0.1, stability: 0.35, tcs: 0, label: 'Pro', note: 'Less grip, looser alignment, minimal help: throttle and countersteer are yours.' },
};

export const WEATHER = {
  dry: { wet: 0.15, rain: 0, label: 'Dry' },
  damp: { wet: 0.7, rain: 0.2, label: 'Damp' },
  rain: { wet: 1, rain: 0.75, label: 'Rain' },
};

export const BLUR = { off: 0, light: 0.55, full: 1 };

/** m:ss.mmm (or s.mmm under a minute) */
export function fmtTime(t) {
  if (t === undefined || t === null || !Number.isFinite(t)) return '-:--.---';
  // round to whole ms first so 119.9996 rolls to 2:00.000, not 1:60.000
  const ms = Math.round(t * 1000), m = Math.floor(ms / 60000), s = (ms - m * 60000) / 1000;
  return `${m}:${s.toFixed(3).padStart(6, '0')}`;
}
