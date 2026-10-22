// Road wetness as the physics sees it. The game feeds the weather preset's `wet` (src/game/store.js WEATHER: dry 0.15,
// damp 0.7, rain 1) through setWeather(); every car reads road.wet each step, so it takes effect mid-session.
const clamp01 = (x) => Math.min(1, Math.max(0, x));
export const road = { wet: 0 };                       // 0 dry .. 1 full rain (dry's 0.15 is only the look: damp-down paint, no water)
export function setWeather(wetLevel) { road.wet = clamp01(((wetLevel ?? 0) - 0.15) / 0.85); return road.wet; }

/** how much of the dry peak grip a tyre keeps on this road: ~0.87 damp, 0.80 rain (racing tyre on wet asphalt) */
export const wetGrip = (w = road.wet) => 1 - 0.2 * w;
