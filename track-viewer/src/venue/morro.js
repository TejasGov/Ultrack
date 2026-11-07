// Morro Noturno's runtime effect, loaded through tracks.js `venue`: the light its sodium lamps, door bulbs and the floodlight masts throw, lap-long, baked at load into one map
// (venue/venice/night.js has how), so the streets between the six real lights near the camera are not black. Night is the track's only look.
const GROUND = { 'MN | asphalt': 44, 'MN | line white': 6, 'MN | kerb red': 12, 'MN | kerb white': 6, 'MN | pavement': 8.5 };
const WALL = /^MN \| (clay brick|broken render|ochre paint|blue paint|red paint|pink paint|white render|grey render|concrete frame|roller shutter|steel door|corrugated|cement tank|fibreglass tank|barrier|hoardings|boards|tyre wall|cabin|steel)$/;
// at night the moon's and the floods' shadows of the houses are all but invisible, and the houses are most of the triangles: they, the city, the ground, the wires and
// the glows cast none (as venue/india.js does); barriers, masts and the race furniture keep theirs. Measured with perf-mac at night in the rain: see docs/career-worlds.md
const NO_CAST = /^MN (ground|pavements|road|lines|kerbs|houses|city|wires|signs|street|water|window glow|lamp glow|mast glow)/;
export async function create(ctx) {
  ctx.root.traverse((o) => { if (o.isMesh && (NO_CAST.test(o.name) || NO_CAST.test(o.parent?.name ?? ''))) o.castShadow = false; });
  const night = await import('./venice/night.js').then((m) => m.create(ctx, { ground: GROUND, wall: WALL, label: 'morro' }));
  return { setLook(look, params) { night.setLook(look, params); }, update() {}, dispose() { night.dispose(); } };      // main.js calls update every frame
}
