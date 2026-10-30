// The UI's icon set, hand-authored here as SVG geometry (docs/ui-system.md, "Icons"): one 24 px grid, a 2 px live-area margin,
// 1.75 stroke, round caps and joins, currentColor; fills only for small solid details. Writes
//   public/assets/ui/icons/<name>.svg   one file per icon (standalone: carries its own stroke attributes)
//   public/assets/ui/icons.svg          the sprite of <symbol id=name> that src/game/icons.js references (no stroke attributes:
//                                       the referencing <svg class="icon"> sets them in CSS, so a screen can restyle them)
//   qa/ui-icons.png                     the contact sheet: every icon at 20 px and 48 px, ink on the panel colour
// and checks every file: it parses (sharp renders it), it has ink, and nothing reaches into the outer 1 px of the grid.
//   node scripts/make-ui-icons.mjs
import sharp from 'sharp';
import { mkdirSync, writeFileSync, readdirSync, renameSync, appendFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dir = join(root, 'public', 'assets', 'ui', 'icons');
const f = (v) => +v.toFixed(2);
const pt = (cx, cy, r, deg) => [f(cx + r * Math.cos((deg * Math.PI) / 180)), f(cy + r * Math.sin((deg * Math.PI) / 180))];
const poly = (pts) => 'M' + pts.map((p) => p.join(' ')).join('L') + 'Z';
const dot = (x, y) => `<circle cx="${x}" cy="${y}" r="1.1" fill="currentColor" stroke="none"/>`;
const ring = (r = 9) => `<circle cx="12" cy="12" r="${r}"/>`;
// stroked letters for the pad glyphs, in an 8-tall box centred on (12, 12)
const LETTER = {
  A: 'M8.9 16 12 8l3.1 8M10.1 13.2h3.8',
  B: 'M9.6 8v8h3.2a2 2 0 0 0 0-4H9.6M9.6 8h2.9a2 2 0 0 1 0 4',
  X: 'M9.4 8.3l5.2 7.4M14.6 8.3l-5.2 7.4',
  Y: 'M9.3 8.3 12 12l2.7-3.7M12 12v4',
  L: 'M10.2 8v8h4.3',
  R: 'M10 16V8h2.7a2.2 2.2 0 0 1 0 4.4H10M12.5 12.4 14.6 16',
};
const letter = (c, dy = 0) => `<path d="${LETTER[c]}"${dy ? ` transform="translate(0 ${dy})"` : ''}/>`;
const cog = () => {   // 8 teeth: outer 9.3, root 7.1; the tooth is wider at the root
  const p = [];
  for (let i = 0; i < 8; i++) { const a = i * 45 - 90; p.push(pt(12, 12, 7.1, a - 15), pt(12, 12, 9.3, a - 8), pt(12, 12, 9.3, a + 8), pt(12, 12, 7.1, a + 15)); }
  return `<path d="${poly(p)}"/><circle cx="12" cy="12" r="3"/>`;
};
const star = (cx = 12, cy = 12.6, R = 9, r = 4) => poly([...Array(10)].map((_, i) => pt(cx, cy, i % 2 ? r : R, i * 36 - 90)));
const rays = (cx, cy, r0, r1, n, from = 0, to = 360) => [...Array(n)].map((_, i) => { const a = from + (i * (to - from)) / (to - from === 360 ? n : n - 1); const [x0, y0] = pt(cx, cy, r0, a), [x1, y1] = pt(cx, cy, r1, a); return `M${x0} ${y0}L${x1} ${y1}`; }).join('');
const watch = (cx = 12, cy = 13.5, r = 7.5) => `<circle cx="${cx}" cy="${cy}" r="${r}"/><path d="M${cx - 2} 2.75h4M${cx} 2.75V${cy - r}M${cx} ${cy}V${cy - 4}M${f(cx + r * 0.8)} ${f(cy - r * 0.86)}l1.4-1.4"/>`;
const cloud = 'M7 18A4 4 0 0 1 6.6 10.02A5.5 5.5 0 0 1 17.3 11.02A3.5 3.5 0 0 1 17 18Z';
const speaker = 'M3.5 9.5v5h3.6L12 18.6V5.4L7.1 9.5Z';
const moon = (s = 1, dx = 0, dy = 0) => `<path d="M20 14.6A8.2 8.2 0 1 1 9.4 4A6.6 6.6 0 0 0 20 14.6Z"${s !== 1 || dx || dy ? ` transform="translate(${dx} ${dy}) scale(${s})"` : ''}/>`;
const checker = () => {   // the race flag: a pole and a 4 x 3 checker
  const cells = []; for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) if ((r + c) % 2 === 0) cells.push(`<rect x="${f(6 + c * 3.5)}" y="${f(4 + r * 3)}" width="3.5" height="3" fill="currentColor" stroke="none"/>`);
  return `<path d="M6 21V3.5"/><rect x="6" y="4" width="14" height="9" rx="0.5"/>${cells.join('')}`;
};

// name -> inner markup. Keep names kebab-case and generic (what it shows, not where it is used): docs/ui-system.md maps uses.
export const ICONS = {
  // ---- direction
  'arrow-left': '<path d="M19.5 12h-15M10.5 6l-6 6 6 6"/>',
  'arrow-right': '<path d="M4.5 12h15M13.5 6l6 6-6 6"/>',
  'arrow-up': '<path d="M12 19.5v-15M6 10.5l6-6 6 6"/>',
  'arrow-down': '<path d="M12 4.5v15M6 13.5l6 6 6-6"/>',
  'arrow-up-right': '<path d="M6.5 17.5l11-11M8 6.5h9.5V16"/>',
  'chevron-left': '<path d="M15 5.5 8.5 12l6.5 6.5"/>',
  'chevron-right': '<path d="M9 5.5l6.5 6.5L9 18.5"/>',
  'chevron-up': '<path d="M5.5 15 12 8.5l6.5 6.5"/>',
  'chevron-down': '<path d="M5.5 9 12 15.5 18.5 9"/>',
  'chevrons-up': '<path d="M6 12.5l6-6 6 6M6 18.5l6-6 6 6"/>',
  back: '<path d="M9 13.5 4.5 9 9 4.5M4.5 9h10a5.25 5.25 0 0 1 0 10.5H10"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  check: '<path d="M4.5 12.5 9.5 17.5 19.5 6.5"/>',
  plus: '<path d="M12 4.5v15M4.5 12h15"/>',
  minus: '<path d="M4.5 12h15"/>',
  // ---- actions
  play: '<path d="M7.5 4.8v14.4a.8.8 0 0 0 1.2.7l11-7.2a.8.8 0 0 0 0-1.4l-11-7.2a.8.8 0 0 0-1.2.7Z"/>',
  pause: '<path d="M8.5 5v14M15.5 5v14"/>',
  restart: '<path d="M4.5 12a7.5 7.5 0 1 0 1-3.75"/><path d="M5.5 4.25v4h4"/>',
  quit: '<path d="M13.5 3.5h4.5a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2h-4.5"/><path d="M8.5 7.5 4 12l4.5 4.5M4 12h11"/>',
  home: '<rect x="3.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.5"/>',
  settings: cog(),
  sliders: '<path d="M3.5 7h9M17.5 7h3M3.5 17h3M11.5 17h9"/><circle cx="15" cy="7" r="2.5"/><circle cx="9" cy="17" r="2.5"/>',
  // ---- modes and places
  race: checker(),
  'time-trial': '<circle cx="13.5" cy="13.5" r="7"/><path d="M11.5 2.75h4M13.5 2.75V6.5M13.5 13.5 16.5 10.5M2.5 11h3M2 14.5h3M2.5 18h3"/>',
  drift: '<path d="M4 20.5c5.5 0 5-6.5 9.5-8.5s4.5-6 6.5-8.5"/><path d="M9 21.5c4-.4 4.6-4.6 8.2-6.3 2.2-1 3.2-2.6 3.8-4.2"/>',
  'free-drive': '<path d="M8.5 3.5 4 20.5M15.5 3.5l4.5 17M12 4.5v2M12 10v3M12 16.5v3.5"/>',
  garage: '<path d="M3.5 20.5V9.5L12 4l8.5 5.5v11"/><path d="M7 20.5V13h10v7.5M7 16.5h10"/>',
  track: '<path d="M6 20h11.5a3 3 0 0 0 3-3v-1a3 3 0 0 0-3-3h-3a2 2 0 0 1-2-2V7a3 3 0 0 0-3-3h-1A4.5 4.5 0 0 0 4 8.5V18a2 2 0 0 0 2 2Z"/><path d="M9.5 18v4"/>',
  map: '<path d="M9 4 3.5 6.3v13.7L9 17.7l6 2.3 5.5-2.3V4L15 6.3Z"/><path d="M9 4v13.7M15 6.3V20"/>',
  car: '<path d="M4.9 16H3.5a.5.5 0 0 1-.5-.5v-2.6a1 1 0 0 1 .7-.95L7 10.9l2.7-3.1a2 2 0 0 1 1.5-.7h4.1a2 2 0 0 1 1.6.8l2.4 3.1 1.6.5a1 1 0 0 1 .7.95v3.05a.5.5 0 0 1-.5.5h-2M9.1 16h5.8"/><circle cx="7" cy="16" r="2.1"/><circle cx="17" cy="16" r="2.1"/>',
  // ---- race data
  position: '<path d="M3 20.5h18M4.5 20.5v-6h5v6M9.5 20.5V8.5h5v12M14.5 20.5v-4h5v4"/>',
  trophy: '<path d="M7.5 3.5h9v5.5a4.5 4.5 0 0 1-9 0Z"/><path d="M7.5 5.5H4.5v1a3.5 3.5 0 0 0 3.4 3.5M16.5 5.5h3v1a3.5 3.5 0 0 1-3.4 3.5M12 13.5V17M8.5 20.5h7M9.5 17h5v3.5"/>',
  lap: '<path d="M16.5 3.5 20 7l-3.5 3.5M20 7H8a4 4 0 0 0-4 4v1M7.5 20.5 4 17l3.5-3.5M4 17h12a4 4 0 0 0 4-4v-1"/>',
  timer: watch(),
  speed: '<path d="M4.6 17.3a8.5 8.5 0 1 1 14.8 0"/><path d="M12 13l4-4M12 5.5V7M6.7 7.7l1 1M17.3 7.7l-1 1M4.5 13h1.5M18 13h1.5"/><circle cx="12" cy="13" r="1.4" fill="currentColor" stroke="none"/><path d="M8 20.5h8"/>',
  gear: '<path d="M6 6v12M12 6v12M18 6v6M6 12h12"/><circle cx="6" cy="4.5" r="1.6"/><circle cx="12" cy="4.5" r="1.6"/><circle cx="18" cy="4.5" r="1.6"/>',
  nitro: '<path d="M12 21a6 6 0 0 0 6-6c0-3.9-2.7-6.4-4.3-10.3-1.6 1.9-2.6 3.9-2.7 6-1-.8-1.6-1.9-1.8-3.2C7.4 9.6 6 12.3 6 15a6 6 0 0 0 6 6Z"/><path d="M12 21a2.6 2.6 0 0 0 2.6-2.6c0-1.5-1.1-2.6-2.6-4.1-1.5 1.5-2.6 2.6-2.6 4.1A2.6 2.6 0 0 0 12 21Z"/>',
  energy: '<rect x="2.5" y="7" width="16.5" height="10" rx="2"/><path d="M21.5 10.5v3M11.5 9 9 12.3h3l-2.5 3.2"/>',
  bolt: '<path d="M13.5 2.5 5 13.5h6.5l-1 8 8.5-11H12.5Z"/>',
  // ---- garage
  lock: '<rect x="4.5" y="10.5" width="15" height="10" rx="2"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3M12 14.5v2"/>',
  unlock: '<rect x="4.5" y="10.5" width="15" height="10" rx="2"/><path d="M8 10.5V7.5a4 4 0 0 1 7.6-1.7M12 14.5v2"/>',
  coin: '<circle cx="12" cy="12" r="8.75"/><path d="M9.4 7.8v4.6a2.6 2.6 0 0 0 5.2 0V7.8"/>',
  upgrade: '<path d="M6 12.5l6-6 6 6M6 18.5l6-6 6 6"/><path d="M5 3.5h14"/>',
  specs: '<rect x="4.5" y="3" width="15" height="18" rx="2"/><path d="M8 7.5h8M8 11.5h8M8 15.5h5"/>',
  paint: '<path d="M12 3.2c3.1 3.7 6.2 6.9 6.2 10.8a6.2 6.2 0 0 1-12.4 0c0-3.9 3.1-7.1 6.2-10.8Z"/><path d="M9.2 14.6a2.9 2.9 0 0 0 2.3 2.6"/>',
  helmet: '<path d="M3.5 16.5v-2.3a8.3 8.3 0 0 1 16.4-1.7l.6 2.7v2a1.8 1.8 0 0 1-1.8 1.8H6.3a2.8 2.8 0 0 1-2.8-2.5Z"/><path d="M11 10.8h8.6M11 10.8v3.5h9.3"/>',
  // ---- devices, settings tabs
  keyboard: '<rect x="2.5" y="6" width="19" height="12" rx="2"/><path d="M6.5 10h.01M10 10h.01M14 10h.01M17.5 10h.01M8 14h8"/>',
  gamepad: '<path d="M7.6 6.5h8.8a4.5 4.5 0 0 1 4.4 3.6l1 5a2.7 2.7 0 0 1-4.7 2.3L15.3 15H8.7l-1.8 2.4a2.7 2.7 0 0 1-4.7-2.3l1-5A4.5 4.5 0 0 1 7.6 6.5Z"/><path d="M7.5 9.5v3.5M5.75 11.25h3.5"/>' + dot(16, 10) + dot(18, 12.5),
  mouse: '<rect x="6.5" y="3" width="11" height="18" rx="5.5"/><path d="M12 7v3"/>',
  picture: '<rect x="3" y="4" width="18" height="12.5" rx="2"/><path d="M8.5 20.5h7M12 16.5v4"/>',
  steering: ring(8.75) + '<circle cx="12" cy="12" r="2.4"/><path d="M3.4 11c3 .4 5.2.6 6.3 1M20.6 11c-3 .4-5.2.6-6.3 1M12 14.4v6.3"/>',
  volume: `<path d="${speaker}"/><path d="M15.5 9a4.2 4.2 0 0 1 0 6M18 6.4a8 8 0 0 1 0 11.2"/>`,
  'volume-off': `<path d="${speaker}"/><path d="M15.5 9.5l5 5M20.5 9.5l-5 5"/>`,
  music: '<path d="M9 17.5V6l10.5-2.5v11.5"/><circle cx="6.5" cy="17.5" r="2.5"/><circle cx="17" cy="15" r="2.5"/><path d="M9 9.5l10.5-2.5"/>',
  camera: '<rect x="2.5" y="6.5" width="13" height="11" rx="2"/><path d="M15.5 10.5l6-3v9l-6-3"/>',
  people: '<circle cx="9" cy="8" r="3.2"/><path d="M3 19.5a6 6 0 0 1 12 0M15.5 4.9a3.2 3.2 0 0 1 0 6.2M17.5 13.9a6 6 0 0 1 3.5 5.6"/>',
  assists: '<path d="M12 3 19 6v5.2c0 4.4-3 7.9-7 9.8-4-1.9-7-5.4-7-9.8V6Z"/><path d="M8.8 12.2l2.2 2.2 4.2-4.4"/>',
  star: `<path d="${star()}"/>`,
  // ---- states
  warning: '<path d="M10.3 4.3a2 2 0 0 1 3.4 0l7.5 13.1a2 2 0 0 1-1.7 3H4.5a2 2 0 0 1-1.7-3Z"/><path d="M12 9.5v4.5"/>' + dot(12, 17.1),
  info: ring(9) + '<path d="M12 11v5.5"/>' + dot(12, 7.9),
  error: ring(9) + '<path d="M12 7.5V13"/>' + dot(12, 16.1),
  invalid: ring(9) + '<path d="M5.7 18.3 18.3 5.7"/>',
  'wrong-way': '<path d="M7.5 20.5v-9a4.5 4.5 0 0 1 9 0v5"/><path d="M13 13.5l3.5 3.5 3.5-3.5"/>',
  // ---- time of day and weather
  sun: '<circle cx="12" cy="12" r="4"/><path d="' + rays(12, 12, 6.5, 9, 8) + '"/>',
  sunset: '<path d="M3 18.5h18M6.5 18.5a5.5 5.5 0 0 1 11 0M8.5 21.5h7"/><path d="' + rays(12, 18.5, 8, 10, 5, 180, 360) + '"/>',
  'moon-horizon': '<path d="M3 19.5h18"/><path d="M17.5 13.2A6 6 0 1 1 10.3 5.4 4.8 4.8 0 0 0 17.5 13.2Z"/>',
  moon: moon(),
  cloud: `<path d="${cloud}"/>`,
  'cloud-drizzle': `<path d="${cloud}" transform="translate(0 -2.5)"/>` + dot(8.5, 19) + dot(12, 20.8) + dot(15.5, 19),
  'cloud-rain': `<path d="${cloud}" transform="translate(0 -2.5)"/><path d="M8.5 18.5l-1 2.5M12 18.5l-1 2.5M15.5 18.5l-1 2.5"/>`,
  // ---- gamepad prompts (face letters, bumpers wide, triggers tall, sticks L / R in a ring)
  'pad-a': ring() + letter('A'),
  'pad-b': ring() + letter('B'),
  'pad-x': ring() + letter('X'),
  'pad-y': ring() + letter('Y'),
  'pad-lb': '<rect x="2.5" y="6.5" width="19" height="11" rx="4"/>' + letter('L'),
  'pad-rb': '<rect x="2.5" y="6.5" width="19" height="11" rx="4"/>' + letter('R'),
  'pad-lt': '<path d="M5.5 21.5V9a6.5 6.5 0 0 1 13 0v12.5Z"/>' + letter('L', 2),
  'pad-rt': '<path d="M5.5 21.5V9a6.5 6.5 0 0 1 13 0v12.5Z"/>' + letter('R', 2),
  'pad-ls': ring() + letter('L'),   // L / R in a circle: a stick (the face buttons are A B X Y)
  'pad-rs': ring() + letter('R'),
  'pad-menu': ring() + '<path d="M8.5 9.5h7M8.5 12h7M8.5 14.5h7"/>',
  'pad-view': ring() + '<rect x="7.5" y="8" width="6" height="5" rx="1"/><path d="M10.5 16h4.5a1 1 0 0 0 1-1v-3.5"/>',
  'pad-dpad': '<path d="M9.5 3.5h5v6h6v5h-6v6h-5v-6h-6v-5h6Z"/>',
};

const ATTR = 'fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"';
const file = (inner) => `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" ${ATTR}>${inner}</svg>\n`;

// ---- write: archive (never delete) any file whose icon was removed from the set, then each icon, then the sprite
mkdirSync(dir, { recursive: true });
for (const old of readdirSync(dir)) if (old.endsWith('.svg') && !ICONS[old.slice(0, -4)]) {
  const arc = join(root, '..', '_archive', '2026-10-30'), to = join(arc, 'ui-icons'); mkdirSync(to, { recursive: true }); renameSync(join(dir, old), join(to, old));
  appendFileSync(join(arc, 'MANIFEST.md'), `- ui-icons/${old}: from track-viewer/public/assets/ui/icons/, dropped from scripts/make-ui-icons.mjs\n`);
  console.log('archived', old);
}
for (const [name, inner] of Object.entries(ICONS)) writeFileSync(join(dir, `${name}.svg`), file(inner));
writeFileSync(join(root, 'public', 'assets', 'ui', 'icons.svg'), `<svg xmlns="http://www.w3.org/2000/svg">\n${Object.entries(ICONS).map(([n, i]) => `<symbol id="${n}" viewBox="0 0 24 24">${i}</symbol>`).join('\n')}\n</svg>\n`);

// ---- check: parses, has ink, stays off the outer 1 px of the grid (rendered at 4x: the outer 4 px)
const bad = [];
for (const [name, inner] of Object.entries(ICONS)) {
  try {
    const { data, info } = await sharp(Buffer.from(file(inner).replaceAll('currentColor', '#000')), { density: 288 }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    let ink = 0, edge = 0;
    for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) {
      const a = data[(y * info.width + x) * 4 + 3]; if (a < 24) continue; ink++;
      if (x < 4 || y < 4 || x >= info.width - 4 || y >= info.height - 4) edge++;
    }
    if (info.width !== 96 || !ink || edge) bad.push(`${name}: ${info.width}px, ink ${ink}, edge ${edge}`);
  } catch (e) { bad.push(`${name}: ${e.message}`); }
}

// ---- the contact sheet: name, 20 px, 48 px; ink on the panel colour
const N = Object.keys(ICONS).length, COLS = 8, CW = 170, CH = 96, W = COLS * CW, H = Math.ceil(N / COLS) * CH + 16;
const cell = Object.entries(ICONS).map(([name, inner], i) => {
  const x = (i % COLS) * CW + 12, y = Math.floor(i / COLS) * CH + 12;
  return `<svg x="${x}" y="${y + 14}" width="20" height="20" viewBox="0 0 24 24" ${ATTR} color="#f4f2ee">${inner}</svg>` +
    `<svg x="${x + 36}" y="${y}" width="48" height="48" viewBox="0 0 24 24" ${ATTR} color="#f4f2ee">${inner}</svg>` +
    `<svg x="${x + 96}" y="${y + 14}" width="20" height="20" viewBox="0 0 24 24" ${ATTR} color="#e3141b">${inner}</svg>` +
    `<text x="${x}" y="${y + 70}" font-family="Arial, sans-serif" font-size="13" fill="#9aa0a8">${name}</text>`;
}).join('');
mkdirSync(join(root, 'qa'), { recursive: true });
await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect width="100%" height="100%" fill="#0e1218"/>${cell}</svg>`)).png().toFile(join(root, 'qa', 'ui-icons.png'));
console.log(`${N} icons -> public/assets/ui/icons/, icons.svg, qa/ui-icons.png`);
if (bad.length) { console.error('bad icons:\n  ' + bad.join('\n  ')); process.exit(1); }
