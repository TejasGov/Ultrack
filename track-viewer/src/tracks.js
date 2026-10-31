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
    dayNight: { day: /^M_Supertall\w*Day$/, night: /^(M_(NightBeam|NightBridgeRed|SupertallLightsNight)|V14 tower top red lens)$/, nightK: { M_NightBeam: 0.1, M_NightBridgeRed: 0.3 } },     // the red shell over the tower tops read as a flat salmon slab at full opacity: a tint     // v13.1: the sky arc, the ridges (by day) and the searchlights / distant lights (by night)
    // the canopies keep the asphalt and stands in shade: more exposure and sky light by day; the baked skyline and signs follow `emissive`;
    // the neon blooms from a higher threshold at night. The steps day > dusk > evening > night only ever go down.
    looks: {
      // sun tone (main.js LOOKS): the same ~20 % less hard sun and ~40 % flare / haze / glint as the base looks
      day: { exposure: 1.75, env: 1.3, emissive: 0.32, fogDensity: 0.0003, sun: 4.8, grade: { shadows: [1, 0.99, 0.97], sat: 1.02 } },
      // the dusk sun sets straight down the neon street: a softer flare, sun haze and road glint than Marina's open bay
      dusk: { exposure: 0.65, env: 1.0, flare: 0.14, fogSun: [0.08, 0.044, 0.02], glint: [0.96, 0.56, 0.24] },
      bluehour: { exposure: 0.9, bg: 0.12, bloomGain: 0.4, bloomThr: 0.95, emissive: 0.9, fog: 0x1d2a4f, grade: { s: 0.5, black: 0.03, shadows: [0.84, 0.94, 1.16], sat: 1.12 } },
      night: { bloomGain: 0.4, bloomThr: 0.95, emissive: 1.2, fog: 0x0d0f24, fogDensity: 0.0014, fogSun: [0.03, 0.012, 0.02] },
    },
    wet: { wet: ['V4 damp Poly Haven asphalt', 'Warm road paint', 'Concrete | mineral', 'V12 run-off blue', 'V12 run-off pink', 'V12 run-off yellow',
      'V9 painted concrete | flow', 'V9 painted concrete | ichimatsu', 'V9 painted concrete | chevron', 'V9 painted concrete | seigaiha', 'Park meadow'],
    puddles: ['V4 damp Poly Haven asphalt'] },
    venue: () => import('./venue/tokyo.js'),
    // flip these on as the Tokyo export grows pit boxes, a VIP booth, hoarding sites and Marina-style scenery
    has: { pit: false, vip: false, hoardings: false, people: false, yachts: false, buildings: false, teamDress: false },
  },
  india: {
    id: 'india', name: 'India Ghat Circuit', stem: 'india', dir: '/assets/india/', look: 'day', fog: 0.45, sun: [-0.55, -0.77], tag: null,     // thin mountain air: the far ranges stay readable
    // night-only: about a third of the city's windows (a lit shell over the glass, tracks/india/game_india.py)
    dayNight: { day: /(?!)/, night: /^IN window glow night$/ },     // no day backdrop: `day` matches nothing
    // the baked vertex colours are albedo only: the same lift by day as Tokyo's, with the toned-down sun (main.js LOOKS)
    looks: { day: { exposure: 1.75, env: 1.3, sun: 4.2 }, dusk: { exposure: 0.6 } },
    wet: { wet: ['India | asphalt'], puddles: ['India | asphalt'] },
    // location-specific brands: a GLB board material -> an image of the same aspect in `${dir}ads/` (main.js; sources in
    // assets/sponsors/manifest.json). India's long Sony boards and the gantry banner carry Jio; the 3:1 Sony boards stay.
    brands: { 'DRESS | board sony-6000': 'jio-6000', 'DRESS | board sony-11818': 'jio-11818' },
    // the collision corridor ends ~40 m out while the terrain goes on: invisible walls where the ground stops (physics/world.js)
    voidWalls: true,
    // the six lamps nearest the camera are real lights (main.js pool.street): the heads hang 9 m up and 11 m out (Marina's 3.6 m), so
    // the common power barely reached the road. The road itself is lit lap-long by venue/india/road-light.js; these add the close
    // detail (car bodies, walls, poles) without doubling the pools' road light
    lampPower: 2,
    venue: () => import('./venue/india.js'),
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
// Two bytes, not one: Vite's dev server (sirv) reads the end of "bytes=0-0" as "to the end of the file" and sent the whole 28 MB
// Tokyo venue for each probe. (HEAD works too, but Chrome reports every HEAD as an aborted request, which the QA scripts flag.)
const real = (url, not) => fetch(url, { headers: { Range: 'bytes=0-1' } }).then((r) => r.ok && !not.test(r.headers.get('content-type') ?? '')).catch(() => false);
/** Fetch JSON that may not exist (lights.json, vip.json): the fallback when it is missing or is the SPA fallback page. */
export const optionalJson = (url, fallback = null) => fetch(url).then((r) => (r.ok && /json/.test(r.headers.get('content-type') ?? '') ? r.json() : fallback)).catch(() => fallback);
let probed = null;
/** The tracks whose files are on the server: Marina always, the others once track.json, the collision mesh and the venue exist. */
export function availableTracks() {
  return probed ??= Promise.all(Object.values(TRACKS).map(async (t) =>
    t.id === DEFAULT_TRACK || (await Promise.all(['track', 'collision', 'visual'].map((what) => real(trackUrl(t, what), /html/)))).every(Boolean) ? t : null,
  )).then((list) => list.filter(Boolean));
}
