// U-coins: the in-game currency. Results pay out coins; coins buy per-car upgrade levels (engine, tyres, brakes; 1..3).
// Pure functions over the saved profile (`data` = store.data), so they run and test without a browser. The physics side
// (what a level changes) lives in src/physics/handling.js setUpgrades(); this file only keeps the ledger and the prices.

export const CATS = [['engine', 'Engine'], ['tyres', 'Tyres'], ['brakes', 'Brakes']];
export const MAX_LEVEL = 3;
export const START_COINS = 1500;          // a new (or migrated) profile can buy a first level straight away

// price of level 1, 2, 3 for a mid ("Sports") car; the class multiplier scales it
const BASE = [700, 1700, 3600];
export const CLASSES = [
  { id: 'tourer', label: 'Tourer', maxHp: 500, mult: 0.8 },
  { id: 'sports', label: 'Sports', maxHp: 800, mult: 1 },
  { id: 'super', label: 'Super', maxHp: 1100, mult: 1.35 },
  { id: 'hyper', label: 'Hyper', maxHp: Infinity, mult: 1.8 },
];
export const classOf = (hp) => CLASSES.find((c) => (hp ?? 600) < c.maxHp) ?? CLASSES[1];
/** coins to buy `level` (1..3) of one category on a car of `hp` horsepower */
export const costOf = (hp, level) => Math.round(BASE[level - 1] * classOf(hp).mult / 50) * 50;

const clampLevel = (v) => Math.max(0, Math.min(MAX_LEVEL, Math.floor(+v) || 0));
export const levelsOf = (data, key) => ({ engine: 0, tyres: 0, brakes: 0, ...(data.upgrades?.[key] ?? {}) });
export const totalLevels = (data, key) => CATS.reduce((n, [c]) => n + levelsOf(data, key)[c], 0);

/** Old saves have no coins or upgrades: give the starting balance once, and repair anything out of range. */
export function migrate(data) {
  data.coins = Number.isFinite(data.coins) ? Math.max(0, Math.floor(data.coins)) : START_COINS;
  const up = data.upgrades && typeof data.upgrades === 'object' ? data.upgrades : {};
  data.upgrades = {};
  for (const [k, v] of Object.entries(up)) data.upgrades[k] = Object.fromEntries(CATS.map(([c]) => [c, clampLevel(v?.[c])]));
  return data;
}

/** Try to buy the next level of `cat` for car `key`. Returns { ok, reason?, cost?, level }; changes `data` only on success. */
export function buyUpgrade(data, key, cat, hp) {
  if (!CATS.some(([c]) => c === cat)) return { ok: false, reason: 'unknown' };
  const cur = levelsOf(data, key)[cat];
  if (cur >= MAX_LEVEL) return { ok: false, reason: 'maxed', level: cur };
  const cost = costOf(hp, cur + 1);
  if (data.coins < cost) return { ok: false, reason: 'coins', cost, level: cur };
  data.coins -= cost;
  data.upgrades[key] = { ...levelsOf(data, key), [cat]: cur + 1 };
  return { ok: true, cost, level: cur + 1 };
}

// ---------------------------------------------------------------------------------------------- earnings
const PAY = [1800, 1300, 950, 700, 500, 350, 200];        // by finishing place (7 cars)
const FASTEST = 300, PB = 150, LAP = 120;
/**
 * What a finished session pays. r: { mode, pos, cars, laps, finished, fastest, pb, validLaps, score, record }.
 * Returns { total, lines: [[label, coins]] }. Race pay scales with distance (sqrt of laps / 3), so a 1-lap sprint pays about
 * half a 3-lap race and long races pay more without paying per minute of grinding.
 */
export function rewardFor(r) {
  const lines = [];
  const add = (label, n) => { n = Math.round(n / 5) * 5; if (n > 0) lines.push([label, n]); };
  if (r.mode === 'race') {
    const f = Math.sqrt((r.laps ?? 3) / 3), cars = r.cars ?? PAY.length;
    const place = PAY[Math.min(PAY.length - 1, Math.round((r.pos - 1) * (PAY.length - 1) / Math.max(1, cars - 1)))];
    if (!r.retired) add(`Finished P${r.pos}`, place * f);
    add(`${r.laps} ${r.laps === 1 ? 'lap' : 'laps'} driven`, LAP * (r.finished === false ? 0 : r.laps) * 0.8);
    if (r.fastest) add('Fastest lap', FASTEST * f);
    if (r.pb) add('Personal best', PB * f);
  } else if (r.mode === 'trial') {
    add('Valid laps', 80 * Math.min(5, r.validLaps ?? 0));
    if (r.pb) add('Personal best', 350);
  } else if (r.mode === 'drift') {
    add('Drift score', Math.min(2000, (r.score ?? 0) / 25));
    if (r.record) add('New record', 400);
  }
  return { total: lines.reduce((s, l) => s + l[1], 0), lines };
}

export function earn(data, n) { data.coins = Math.max(0, Math.floor(data.coins + n)); return data.coins; }
