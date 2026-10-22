// Per-car physics parameters. The facts (mass, size, power, drive, 0-100, top speed, engine type) come from
// assets/cars/specs.json (real published figures, sourced); the car's character (grip, downforce, centre of mass, weight
// split), its brake calibration and the balance of performance come from assets/cars/handling.json.
// The real figures are compressed so the whole field can race: top speed 250 + (real - 240) * 0.6 km/h, 0-100 three
// quarters of the way from 2.6 s, tyre grip to within ±0.1 of 1.16, 100-0 braking 37 m + (real - 33 m) * 0.5 (handling.json brakeK).
// Power follows from mass and the 0-100 time, drag from power and top speed (at top speed all the power goes into drag);
// bop then scales the power alone. Upgrades (setUpgrades) sit on top: engine -> power, tyres -> grip and wet grip,
// brakes -> brake torque.
import DATA from '../../../assets/cars/handling.json';
import SPECS from '../../../assets/cars/specs.json';
import DRIVING from '../../../assets/cars/driving.json';

const DEFAULT = { hp: 600, zeroTo100: 3.5, topKmh: 310, drive: 'RWD', massKg: 1500, grip: 1.1, downforce: 0.6, cogM: 0.47, weightFront: 0.45, bop: 1, brakeK: 1 };
const UP = SPECS.upgrades.categories, LEVELS = SPECS.upgrades.levels;

// balance of performance set at runtime (npm run laps / balance()) wins over handling.json's bop
export const BOP = {};        // key -> { power, grip } multipliers

// owned upgrade levels per car (0 = stock). AI cars never get any. handling() reads them every call, so after a change
// call vehicle.retune(handling(key)) on a car that already exists
const OWNED = {};
const level = (n) => Math.min(LEVELS, Math.max(0, Math.round(+n || 0)));
/** set the owned upgrade levels, each 0..3: { engine, tyres, brakes }; a category left out keeps its level. Returns all three */
export function setUpgrades(key, levels = {}) {
  const o = OWNED[key] ??= { engine: 0, tyres: 0, brakes: 0 };
  for (const c of Object.keys(o)) if (levels[c] !== undefined) o[c] = level(levels[c]);
  return { ...o };
}
export const getUpgrades = (key) => ({ engine: 0, tyres: 0, brakes: 0, ...OWNED[key] });
/** a category's effect array at an owned level (0 = stock = the neutral value) */
const at = (arr, n, neutral) => (n > 0 ? arr[n - 1] : neutral);

/** the real figures for a car (assets/cars/specs.json), undefined for an unknown key */
export const specs = (key) => SPECS.cars[key];
export const upgradeEffects = () => SPECS.upgrades;

/** throttle response (s): an EV answers at once, a turbo ICE builds boost */
function lagOf(S) {
  if (S.powertrain === 'EV') return 0.04;
  const turbo = /turbo/i.test(S.engine ?? '');
  return S.powertrain === 'hybrid' ? (turbo ? 0.12 : 0.08) : turbo ? 0.22 : 0.1;
}

export function handling(key) {
  const S = SPECS.cars[key] ?? {}, H = { ...DEFAULT, ...(DATA.cars[key] ?? {}) };
  if (BOP[key]) { H.bop = BOP[key].power ?? H.bop; H.bopGrip = BOP[key].grip ?? H.bopGrip; }
  const u = getUpgrades(key);
  const arcade={...DRIVING.defaults,...DRIVING.archetypes[DRIVING.cars[key]]};
  const mass = (S.massKg ?? H.massKg) + at(UP.engine.massKg, u.engine, 0);
  const top = (250 + ((S.topSpeedKmh ?? H.topKmh) - 240) * 0.6) / 3.6;     // m/s
  const t100 = 2.6 + ((S.zeroTo100S ?? H.zeroTo100) - 2.6) * 0.75;          // s
  const base = mass * (27.78 / t100) * 27.78 * 0.7;                          // W
  const roll = 0.0006 * (mass * 9.81 + 0.6 * H.downforce * top * top) * top * top;   // W the tyres' rolling drag takes at top speed (vehicle.js): the aero drag gets the rest
  return {
    key, mass, power: base * H.bop * at(UP.engine.powerMul, u.engine, 1), top, t100, dragK: (base - roll) / top ** 3,   // drag from the unbalanced power: bop and engine upgrades move top speed too
    grip: (1.16 + (H.grip - 1.16) * 0.45) * (H.bopGrip ?? 1) * at(UP.tyres.gripMul, u.tyres, 1) * arcade.gripScale,
    wetRetention: at(UP.tyres.wetRetentionPlus, u.tyres, 0),
    brakeK: H.brakeK * at(UP.brakes.brakeMul, u.brakes, 1),
    downforce: H.downforce, cog: H.cogM*arcade.cogScale, weightFront: H.weightFront, drive: S.drive ?? H.drive, arcade,
    size: S.lengthM ? { length: S.lengthM, width: S.widthM, height: S.heightM } : null,
    powertrain: S.powertrain ?? 'ICE', ev: S.powertrain === 'EV', lag: lagOf(S)*arcade.throttleResponseScale, tractionK: ((S.drive ?? H.drive) === 'RWD' ? 1.4 : 1.2) * (S.powertrain === 'EV' ? 1.07 : 1), upgrades: u,
  };
}
