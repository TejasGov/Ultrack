// The track registry: which circuit the game is on, where its files live and which venue systems it has. main.js,
// game.js and the menu read the selected track from here instead of naming Marina. Plain data plus fetch probes, so
// node tests can import it.
//   stem       file base name: <stem>_visual(_ktx2).glb, <stem>_collision.glb (tracks/<id>/out/web -> sync-assets.mjs)
//   dir        public URL folder; Marina keeps /assets/ itself (its files predate the registry), the rest get /assets/<id>/
//   look       the time of day the track opens in when picked in the menu
//   fog        multiplies the look's fog density (a bigger or hazier venue)
//   sun        [x, z] bearing of the sun over the track; its height comes from the look
//   tag        the commentary tag for lines about this circuit (null: none)
//   dayNight   optional: { day: RegExp on the name of the day skyline's materials, night: RegExp on materials that only show from evening on (off at dusk; opacity = nightK[name]) } for a backdrop of two coincident bands (the night one
//              opaque, the day one just inside it); main.js fades the day band's opacity per look (LOOKS dn: 0 = day .. 1 = night, opacity 1 - dn). Marina has none.
//   looks      optional per-look overrides merged over main.js LOOKS while this track is active (grade merges key by key); Marina has none
//   wet        optional { wet, puddles }: the track's material names that go wet in the rain / that also pool (default: Marina's names in main.js)
//   venue      optional () => import(module with create(ctx)): the track's runtime effects, made after its GLB (src/venue/<id>.js)
//   has        venue systems; one that is off is skipped without a request or an error
//     pit        pit crews and boxes (people.js placeholders)    vip        vip.json: the booth's commentators
//     hoardings  driver posters beside the track                  people     the Mixamo/Meshy cast
//     yachts / buildings  scenery LOD (scenery-experiment.js)     teamDress  team artwork on garages, boxes and flags
export const TRACKS = {
  marina: {
    id: 'marina', name: 'Corniche Marina', stem: 'marina', dir: '/assets/', look: 'dusk', fog: 1, sun: [-0.55, -0.77], tag: 'corniche',
    has: { pit: true, vip: true, hoardings: true, people: true, yachts: true, buildings: true, teamDress: true },
  },
  tokyo: {
    id: 'tokyo', name: 'Tokyo Hiragana Circuit', stem: 'tokyo', dir: '/assets/tokyo/', look: 'night', fog: 1, sun: [-0.94, 0.34], tag: null,     // west-south-west: Marina's bearing set straight down the neon street
    dayNight: { day: /^M_Supertall\w*Day$/, night: /^M_(NightBeam|NightBridgeRed|SupertallLightsNight)$/, nightK: { M_NightBeam: 0.1 } },     // v13.1: the sky arc, the ridges (by day) and the searchlights / distant lights (by night)
    // the canopies keep the asphalt and stands in shade: more exposure and sky light by day; the baked skyline and signs follow `emissive`;
    // the neon blooms from a higher threshold at night. The steps day > dusk > evening > night only ever go down.
    looks: {
      day: { exposure: 2.1, env: 1.25, emissive: 0.32, fogDensity: 0.0003, sun: 6, grade: { shadows: [1, 0.99, 0.97], sat: 1.02 } },
      // the dusk sun sets straight down the neon street: a softer flare, sun haze and road glint than Marina's open bay
      dusk: { exposure: 0.85, env: 1.0, flare: 0.35, fogSun: [0.2, 0.11, 0.05], glint: [2.4, 1.4, 0.6] },
      bluehour: { exposure: 0.9, bg: 0.12, bloomGain: 0.55, emissive: 0.9, fog: 0x1d2a4f, grade: { s: 0.5, black: 0.03, shadows: [0.84, 0.94, 1.16], sat: 1.12 } },
      night: { bloomGain: 0.45, bloomThr: 1.35, emissive: 1.2, fog: 0x0d0f24, fogDensity: 0.0014, fogSun: [0.03, 0.012, 0.02] },
    },
    wet: { wet: ['V4 damp Poly Haven asphalt', 'Warm road paint', 'Concrete | mineral', 'V12 run-off blue', 'V12 run-off pink', 'V12 run-off yellow',
      'V9 painted concrete | flow', 'V9 painted concrete | ichimatsu', 'V9 painted concrete | chevron', 'V9 painted concrete | seigaiha', 'Park meadow'],
    puddles: ['V4 damp Poly Haven asphalt'] },
    venue: () => import('./venue/tokyo.js'),
    // flip these on as the Tokyo export grows pit boxes, a VIP booth, hoarding sites and Marina-style scenery
    has: { pit: false, vip: false, hoardings: false, people: false, yachts: false, buildings: false, teamDress: false },
  },
};
export const DEFAULT_TRACK = 'marina';
export const trackOf = (id) => TRACKS[id] ?? TRACKS[DEFAULT_TRACK];
const FILES = { track: () => 'track.json', lights: () => 'lights.json', vip: () => 'vip.json', collision: (t) => `${t.stem}_collision.glb`,
  visual: (t, tex) => `${t.stem}_visual${tex === 'ktx2' ? '_ktx2' : ''}.glb` };
/** URL of one of the track's files: what is track | lights | vip | collision | visual (tex: 'ktx2' | 'webp'). */
export const trackUrl = (t, what, tex = 'ktx2') => t.dir + FILES[what](t, tex);

// A dev server (and a static host) answers a missing file with index.html, so "200" proves nothing: judge by type.
const real = (url, not) => fetch(url, { headers: { Range: 'bytes=0-0' } }).then((r) => r.ok && !not.test(r.headers.get('content-type') ?? '')).catch(() => false);
/** Fetch JSON that may not exist (lights.json, vip.json): the fallback when it is missing or is the SPA fallback page. */
export const optionalJson = (url, fallback = null) => fetch(url).then((r) => (r.ok && /json/.test(r.headers.get('content-type') ?? '') ? r.json() : fallback)).catch(() => fallback);
let probed = null;
/** The tracks whose files are on the server: Marina always, the others once track.json, the collision mesh and the venue exist. */
export function availableTracks() {
  return probed ??= Promise.all(Object.values(TRACKS).map(async (t) =>
    t.id === DEFAULT_TRACK || (await Promise.all(['track', 'collision', 'visual'].map((what) => real(trackUrl(t, what), /html/)))).every(Boolean) ? t : null,
  )).then((list) => list.filter(Boolean));
}
