// The track registry: which circuit the game is on, where its files live and which venue systems it has. main.js,
// game.js and the menu read the selected track from here instead of naming Marina. Plain data plus fetch probes, so
// node tests can import it.
//   stem       file base name: <stem>_visual(_ktx2).glb, <stem>_collision.glb (tracks/<id>/out/web -> sync-assets.mjs)
//   dir        public URL folder; Marina keeps /assets/ itself (its files predate the registry), the rest get /assets/<id>/
//   look       the time of day the track opens in when picked in the menu
//   times      optional: the only times of day the track offers (the career's small tracks: day and dusk, chosen by the story); default all
//   fog        multiplies the look's fog density (a bigger or hazier venue)
//   sun        [x, z] bearing of the sun over the track; its height comes from the look
//   tag        the commentary tag for lines about this circuit (null: none)
//   dayNight   optional: { day: RegExp on the name of the day skyline's materials, night: RegExp on materials that only show from evening on (off at dusk; opacity = nightK[name]), dayEnd: the dn by which the day one is gone (default 1) } for a backdrop of two coincident bands (the night one
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
    wet: { wet: [], puddles: [] },     // the export shares its materials between the road and everything else: venue/india/materials.js wets its own road clones
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
  drylake: {     // career World 1 (docs/career-worlds.md, tracks/drylake/build_drylake.py): a desert airfield and its boneyard
    id: 'drylake', name: 'Mojave Dry Lake', stem: 'drylake', dir: '/assets/drylake/', look: 'day', times: ['day', 'dusk'], fog: 0.6, sun: [-0.55, -0.77], tag: null,
    dayNight: { day: /^Backdrop \| goegap day$/, dayEnd: 0.35 },     // the photographed range: the day copy over the dusk one, gone by dusk
    wet: { wet: ['DL | asphalt', 'DL | runway concrete', 'DL | line white', 'DL | kerb red', 'DL | kerb white', 'DL | runway paint'], puddles: ['DL | asphalt'] },
    voidWalls: true,
    has: { pit: false, vip: false, hoardings: false, people: false, yachts: false, buildings: false, teamDress: false },
  },
  pilbara: {     // a qualifying venue (docs/10x/maps-spec.md, tracks/pilbara/build_pilbara.py): a haul road down an open-cut iron mine, 18 m of drop
    id: 'pilbara', name: 'Pilbara Pit', stem: 'pilbara', dir: '/assets/pilbara/', look: 'day', times: ['day', 'dusk'], fog: 0.6, sun: [-0.55, -0.77], tag: null,
    wet: { wet: ['PP | asphalt', 'PP | line white', 'PP | kerb red', 'PP | kerb white'], puddles: ['PP | asphalt'] },
    voidWalls: true,
    has: { pit: false, vip: false, hoardings: false, people: false, yachts: false, buildings: false, teamDress: false },
  },
  terminal: {     // a qualifying venue (docs/10x/maps-spec.md, tracks/terminal/build_terminal.py): a flat container terminal on a North Sea quay; the sea is the horizon, so no backdrop
    id: 'terminal', name: 'North Sea Terminal', stem: 'terminal', dir: '/assets/terminal/', look: 'day', times: ['day', 'dusk'], fog: 0.7, sun: [-0.55, -0.77], tag: null,
    wet: { wet: ['NT | asphalt', 'NT | line white', 'NT | kerb red', 'NT | kerb white'], puddles: ['NT | asphalt'] },
    voidWalls: true,
    has: { pit: false, vip: false, hoardings: false, people: false, yachts: false, buildings: false, teamDress: false },
  },
  infinia: {     // the main India circuit (docs/career-worlds.md section 4, tracks/infinia/build_infinia.py): a sea link over an undersea tunnel
    id: 'infinia', name: 'Infinia', stem: 'infinia', dir: '/assets/infinia/', look: 'dusk', fog: 0.7, sun: [-0.94, 0.34], tag: null,
    dayNight: { day: /(?!)/, night: /^IF window glow night/ },     // a lit-window shell over the facades, from evening on
    wet: { wet: ['IF | asphalt', 'IF | line white', 'IF | kerb red', 'IF | kerb white', 'IF | paving'], puddles: ['IF | asphalt'] },
    voidWalls: true,
    lampPower: 2,     // heads 9 m up and 1.8 m out, as India Ghat's
    has: { pit: false, vip: false, hoardings: false, people: false, yachts: false, buildings: false, teamDress: false },
  },
  shajawa: {     // career World 2 (docs/career-worlds.md, tracks/shajawa/build_shajawa.py): the one stadium, a flat 3.5 km speedway through a bowl of stands and out round the desert
    id: 'shajawa', name: 'Shajawa Stadium', stem: 'shajawa', dir: '/assets/shajawa/', look: 'day', times: ['day', 'dusk'], fog: 0.5, sun: [-0.55, -0.77], tag: null,
    wet: { wet: ['SJ | asphalt', 'SJ | run-off', 'SJ | line white', 'SJ | kerb red', 'SJ | kerb white', 'SJ | paddock', 'SJ | apron'], puddles: ['SJ | asphalt'] },
    voidWalls: true,
    has: { pit: false, vip: false, hoardings: false, people: false, yachts: false, buildings: false, teamDress: false },
  },
  venice: {     // tracks/venice/build_venice.py: a fictional street circuit on a lagoon island, a figure-eight with a tunnel under the deck (not yet on the career calendar, local only)
    id: 'venice', name: 'Venice', stem: 'venice', dir: '/assets/venice/', look: 'dusk', times: ['day', 'dusk', 'bluehour', 'night'], fog: 0.5, sun: [0.3, 0.95], tag: null,     // the sun from the south, across the tunnel: a low sun along it runs the sunset's glow down the inside (see venue/tokyo/tunnel-light.js); the pillared fronts north of the two straights take the light
    dayNight: { day: /(?!)/, night: /^VE (window|lamp) glow night/ },     // lit rooms and lantern mantles, from evening on
    // glow 0: the lantern sprites stay off at dusk, as they always were. After dark the sky is the road's floor and the lamps' pools (venue/venice/night.js) lie over it
    looks: { day: { env: 1.3 }, dusk: { exposure: 0.54, env: 1.2, glow: 0 }, bluehour: { exposure: 0.92, env: 0.3 }, night: { env: 0.09 } },     // more sky light than most, as Llano: else the road goes black
    wet: { wet: ['VE | asphalt', 'VE | line white', 'VE | kerb red', 'VE | kerb white', 'VE | paving'], puddles: ['VE | asphalt'] },
    voidWalls: true,
    venue: () => import('./venue/venice.js'),
    has: { pit: false, vip: false, hoardings: false, people: false, yachts: false, buildings: false, teamDress: false },
  },
  qingshan: {     // tracks/qingshan/build_qingshan.py: Cheongsan Park (internal id qingshan, saves and the calendar key on it): a forest circuit in a Korean energy park, from the user's sketch; its imperial-style halls were kept on purpose
    id: 'qingshan', name: 'Cheongsan Park', stem: 'qingshan', dir: '/assets/qingshan/', look: 'day', times: ['day', 'dusk'], fog: 0.45, sun: [0.45, 0.89], tag: null,     // the sun on the halls' and the wind farm's road-facing sides
    looks: { day: { env: 1.75 }, dusk: { exposure: 0.56, env: 1.6 } },     // more sky light than Llano or Venice: the road sits in the forest's shade for much of the lap and would go black
    wet: { wet: ['QS | asphalt', 'QS | line white', 'QS | kerb red', 'QS | kerb white', 'QS | hard shoulder'], puddles: ['QS | asphalt'] },
    voidWalls: true,
    venue: () => import('./venue/qingshan.js'),
    has: { pit: false, vip: false, hoardings: false, people: false, yachts: false, buildings: false, teamDress: false },
  },
  llano: {     // career World 2 (docs/career-worlds/llano.json, tracks/llano/build_llano.py): the big speed track on the empty West Texas plain, Llano Central on its Long Mile
    id: 'llano', name: 'Llano Speedway', stem: 'llano', dir: '/assets/llano/', look: 'dusk', times: ['day', 'dusk'], fog: 0.35, sun: [0.98, -0.18], tag: null,     // the low sun straight ahead down the start straight
    dayNight: { day: /^Backdrop \| range day$/, dayEnd: 0.35 },     // the far range: the day copy over the dusk one, as Mojave's
    looks: { day: { env: 1.3 }, dusk: { exposure: 0.54, env: 1.05 } },     // the low sun runs down the start straight, so the Long Mile and Llano Central's front stand in shade: more sky light, or the road goes black
    wet: { wet: ['LL | asphalt', 'LL | line white', 'LL | kerb red', 'LL | kerb white', 'LL | road patch'], puddles: ['LL | asphalt'] },
    voidWalls: true,
    has: { pit: false, vip: false, hoardings: false, people: false, yachts: false, buildings: false, teamDress: false },
  },
  wold: {     // tracks/wold/build_wold.py: Hartwell Wold, a country road circuit in the English Cotswolds: the wold's top, the escarpment, a river village and its bridge, the park
    id: 'wold', name: 'Hartwell Wold', stem: 'wold', dir: '/assets/wold/', look: 'day', times: ['day', 'dusk'], fog: 0.45, sun: [-0.55, -0.77], tag: null,
    looks: { day: { env: 1.3 }, dusk: { exposure: 0.54, env: 1.05 } },     // more sky light, as Llano and Venice: the high street sits between two rows of houses and would go black
    wet: { wet: ['HW | asphalt', 'HW | line white', 'HW | kerb red', 'HW | kerb white', 'HW | pavement'], puddles: ['HW | asphalt'] },
    voidWalls: true,
    has: { pit: false, vip: false, hoardings: false, people: false, yachts: false, buildings: false, teamDress: false },
  },
};
// A deploy's file versions (deploy-build.mjs): a changed file gets a new URL. The bucket sends no Cache-Control, so a browser may reuse an old copy for hours after an upload.
const REV = typeof __ASSET_REV__ === 'undefined' ? {} : __ASSET_REV__;
export const revUrl = (path) => (REV[path] ? `${path}?v=${REV[path]}` : path);
export const DEFAULT_TRACK = 'marina';
export const trackOf = (id) => TRACKS[id] ?? TRACKS[DEFAULT_TRACK];
const FILES = { track: () => 'track.json', lights: () => 'lights.json', vip: () => 'vip.json', collision: (t) => `${t.stem}_collision.glb`,
  visual: (t, tex) => `${t.stem}_visual${tex === 'ktx2' ? '_ktx2' : ''}.glb` };
/** URL of one of the track's files: what is track | lights | vip | collision | visual (tex: 'ktx2' | 'webp'). */
export const trackUrl = (t, what, tex = 'ktx2') => revUrl(t.dir + FILES[what](t, tex));

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
