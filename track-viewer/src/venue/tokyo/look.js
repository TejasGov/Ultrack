// Tokyo's look balance beyond what tracks.js `looks` can say: the dry road's roughness and per-material emissive levels per look.
//   road: the asphalt shipped at roughness 0.16 under a mirror clearcoat (0.55, roughness 0.05): a wet road in every weather, the
//         dry road showed the sky by day and the sunset at dusk. Dry asphalt is rough; the coat now follows the weather (none when
//         dry, most of it in rain), and wetify (wet-road.js) adds its film and puddles in damp and rain.
//   emissive: printed boards and painted run-off glowed like signs after dark; they are lit surfaces, held under the neon
//         (multipliers on main.js applyAll's level, which applyAll resets before calling setLook, so this never compounds)
const MIRROR = [0.65, 1.5];        // wet-road mirror strength, dry .. rain (rain's neon streaks are the image; damp ~0.9)
const COAT = { 'V4 damp Poly Haven asphalt': { dry: 1e-4, wet: 0.5, rough: [0.22, 0.08] } };   // clearcoat by wetness; 1e-4 keeps its program
const ROAD = { 'V4 damp Poly Haven asphalt': 0.85 };     // it has no roughness map: this is the dry surface
const EMISSIVE = [
  { re: /^(V12 board |V9 ad )/, k: { night: 0.15, bluehour: 0.35, dusk: 0.85 } },      // and the neon wash lights them (neon-wash.js)
  { re: /^(V12 run-off |V9 painted concrete)/, k: { night: 0.3, bluehour: 0.45, dusk: 0.7 } },
  // the tunnel's lines and luminaires and the barrier LED lines burn at 6-10x: after dark their bloom hazed whole views
  // (by day the look dims every emissive to 0.32, but a tunnel is lit brighter by day than by night)
  { re: /^(V13 cove warm white|V13 lane edge LED|V13\.1 tunnel luminaire)$/, k: { night: 0.45, bluehour: 0.55, dusk: 1.2, day: 2.2 } },
  { re: /^V9 LED (violet|lime|white|pink|cyan|amber)$/, k: { night: 0.35, bluehour: 0.5 } },
  // the neon street's other glow at 5-6x burned to white: held where its own colour survives the tone mapping
  { re: /^V12 pagoda shoji$/, k: { night: 0.3, bluehour: 0.4 } },
  { re: /^(V12 red lantern glow|V13 lantern paper white|V13 lamp warm)$/, k: { night: 0.5, bluehour: 0.6 } },   // at 7-10x their bloom veiled the street
  { re: /^V10 (cyan|pink)$/, k: { night: 0.55, bluehour: 0.65 } },
];

export async function create({ allMats, wetUniforms }) {
  const road = [...allMats].filter((m) => ROAD[m.name] !== undefined).map((m) => ({ m, was: m.roughness }));
  road.forEach((r) => { r.m.roughness = ROAD[r.m.name]; });
  const coat = [...allMats].filter((m) => COAT[m.name] && m.clearcoat !== undefined).map((m) => ({ m, c: COAT[m.name], was: [m.clearcoat, m.clearcoatRoughness] }));
  const em = [...allMats].map((m) => ({ m, e: EMISSIVE.find((x) => x.re.test(m.name)) })).filter((x) => x.e && x.m.emissiveIntensity !== undefined);
  return {
    setLook(look, params) {
      for (const { m, e } of em) m.emissiveIntensity *= e.k[params?.look] ?? 1;
      const wk = Math.min(1, Math.max(0, ((params?.wet ?? 0) - 0.25) / 0.75)), ws = wk * wk * (3 - 2 * wk);     // dry 0.15: 0, damp 0.7: 0.65, rain: 1
      for (const { m, c } of coat) { m.clearcoat = Math.max(c.dry, c.wet * ws); m.clearcoatRoughness = c.rough[0] + (c.rough[1] - c.rough[0]) * ws; }
      road.forEach((r) => { r.m.roughness = ROAD[r.m.name] - 0.25 * ws; });           // soaked asphalt is a little smoother under its film
      // the wet-road mirror (main.js sets uMirror to 0 or 1 just before) by weather: held down when damp (a mirror-wet road hides
      // braking points), up in rain where the neon streaks are the picture; wet-road.js smears them vertically, the lines stay
      // matte paint. Above 0.5 wet-road.js treats the mirror as on (it gates the sun glint with it).
      if (wetUniforms?.uMirror.value > 0) wetUniforms.uMirror.value = MIRROR[0] + (MIRROR[1] - MIRROR[0]) * ws * ws;
    },
    dispose() { road.forEach((r) => { r.m.roughness = r.was; }); coat.forEach((r) => { [r.m.clearcoat, r.m.clearcoatRoughness] = r.was; }); },
  };
}
