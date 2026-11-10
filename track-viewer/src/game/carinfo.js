// What the garage and results know about each car: its name, its real-world facts (assets/cars/specs.json, written by the
// physics work; every field optional) and what an upgrade changes. Facts fall back to handling.json and the model's
// measured size while specs.json is missing a car, and `estimated` says so.
import * as CARS from '../cars.js';
import TEAMS from '../../../assets/teams/teams.json';
import HANDLING from '../../../assets/cars/handling.json';
import * as PHYSICS from '../physics/handling.js';
import { CATS } from './economy.js';
import { EV } from './ev.js';

// optional files: import.meta.glob is empty when the file does not exist yet (a static import would fail the build)
const first = (o) => Object.values(o)[0];
const SPECS = first(import.meta.glob('../../../assets/cars/specs.json', { eager: true, import: 'default' })) ?? {};
const MODELS = import.meta.glob('../../../assets/cars/*/model.json', { eager: true, import: 'default' });

export const ROSTER = TEAMS.teams.flatMap((t) => t.cars.map((c) => c.key));
const ENTRY = Object.fromEntries(TEAMS.teams.flatMap((t) => t.cars.map((c) => [c.key, c])));
const KNOWN = { destrier: 'Bugatti Destrier', blackbird: 'Hennessey Blackbird', buggati: 'Bugatti Divo' };
const pretty = (k) => k.replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

/** the in-game name: cars.js carName() if it exports one, else a teams.json name, specs.json, then a readable key */
export const carName = (k) => CARS.carName?.(k) ?? ENTRY[k]?.name ?? SPECS.cars?.[k]?.model ?? KNOWN[k] ?? pretty(k);

export const hasSpecs = (k) => !!SPECS.cars?.[k];
export function factsOf(k) {
  const s = SPECS.cars?.[k] ?? {}, hd = HANDLING.cars?.[k] ?? {}, size = MODELS[`../../../assets/cars/${k}/model.json`]?.size;
  return {
    estimated: s.estimated ?? !SPECS.cars?.[k], estimatedFields: s.estimatedFields ?? [], model: s.model, sources: s.sources,
    lengthM: s.lengthM ?? size?.length, widthM: s.widthM ?? size?.width, heightM: s.heightM ?? size?.height, wheelbaseM: s.wheelbaseM,
    massKg: s.massKg ?? hd.massKg, powertrain: s.powertrain ?? (EV.has(k) ? 'EV' : 'ICE'), engine: s.engine,
    powerHp: s.powerHp ?? hd.hp, torqueNm: s.torqueNm, drive: s.drive ?? hd.drive,
    topSpeedKmh: s.topSpeedKmh ?? hd.topKmh, zeroTo100S: s.zeroTo100S ?? hd.zeroTo100, brake100To0M: s.brake100To0M,
  };
}

/** min / max of a fact over the whole roster, for comparison bars */
export function rangeOf(field) {
  const v = ROSTER.map((k) => factsOf(k)[field]).filter((x) => Number.isFinite(x));
  return v.length ? [Math.min(...v), Math.max(...v)] : [0, 1];
}

// ---------------------------------------------------------------------------------------------- upgrades
/** Used only while src/physics/handling.js has no setUpgrades(): a rough per-level change, so the garage still shows a before -> after. */
const NOMINAL = { engine: 0.06, tyres: 0.04, brakes: 0.08 };
export const physicsHasUpgrades = typeof PHYSICS.setUpgrades === 'function';
const ZERO = Object.fromEntries(CATS.map(([c]) => [c, 0]));    // every category: setUpgrades keeps a level it is not told about

/** tell the physics which upgrade levels each car wears: the player's cars as saved, everything else (AI) at level 0; `power`: a career session's mood multipliers ({ key: x }), cleared by any call without them */
export function applyUpgrades(levelsOf, onlyKey, power = {}) {
  PHYSICS.setPower?.(power);
  if (!physicsHasUpgrades) return;
  for (const k of ROSTER) PHYSICS.setUpgrades(k, onlyKey === undefined || k === onlyKey ? levelsOf(k) : ZERO);
}

/** the handling numbers behind a set of levels (physics when it can, otherwise the nominal multipliers) */
export function handlingWith(key, levels, restore) {
  if (physicsHasUpgrades) {
    PHYSICS.setUpgrades(key, levels);
    const h = PHYSICS.handling(key);
    PHYSICS.setUpgrades(key, restore ?? levels);
    return h;
  }
  const h = PHYSICS.handling(key), p = 1 + NOMINAL.engine * levels.engine, g = 1 + NOMINAL.tyres * levels.tyres, b = 1 + NOMINAL.brakes * levels.brakes;
  return { ...h, power: h.power * p, grip: h.grip * g, brakeK: (h.brakeK ?? 1) * b };
}

/** how much better (>1) a set of levels makes top speed, acceleration, grip and braking than stock */
export function gainOf(key, levels, restore) {
  const a = handlingWith(key, ZERO, restore ?? levels), b = handlingWith(key, levels, restore ?? levels);
  // stopping distance follows brake torque, held in check by what the tyres can grip
  const brake = (x) => x.brakeK ?? x.brake;
  // handling() does not move top speed or 0-100 with the engine (they come out of the simulation: the drag is unchanged, the power
  // is not), so they are read from the power: top speed follows its cube root (drag-limited), 0-100 about its 0.8 power
  const pw = b.power / a.power;
  return { top: (b.top / a.top) * pw ** (1 / 3), acc: (a.t100 / b.t100) * pw ** 0.8, grip: b.grip / a.grip, power: b.power / a.power, brake: brake(a) && brake(b) ? (brake(b) / brake(a)) * Math.sqrt(b.grip / a.grip) : null };
}

/** the garage's real-world stats with the upgrades applied: { top km/h, t100 s, brake m, hp, grip ratio } */
export function upgradedFacts(key, levels, restore) {
  const f = factsOf(key), g = gainOf(key, levels, restore);
  const brakeGain = g.brake ?? (1 + NOMINAL.brakes * levels.brakes) * (1 + NOMINAL.tyres * levels.tyres) ** 0.5;
  return {
    topSpeedKmh: f.topSpeedKmh && f.topSpeedKmh * g.top, zeroTo100S: f.zeroTo100S && f.zeroTo100S / g.acc,
    brake100To0M: f.brake100To0M && f.brake100To0M / brakeGain, powerHp: f.powerHp && f.powerHp * g.power, gain: g,
  };
}

export const upgradeNote = (cat) => SPECS.upgrades?.categories?.[cat]?.label ?? CATS.find(([c]) => c === cat)?.[1];
