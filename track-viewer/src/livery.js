// Team liveries for the car-lab cars (assets/teams/teams.json). The generated body shells have no UVs, so each car gets
// four transparent decal sheets drawn here on canvases: the +Z flank, the -Z flank, the top and the rear. The paint
// shader (applyLivery) projects them onto the body from its own normalised coordinates, blending by surface facing.
// Layout is in metres of the body, placed from the car-lab profile (wheel positions, window line), so a number lands
// on the door of every car. Text is always drawn unmirrored; shapes are defined from nose to tail, so a team's graphic
// flows backwards on both flanks.
import * as THREE from 'three';
import {SPONSOR_BRANDS,drawSponsor,loadSponsorLogos} from './sponsors.js';
import logoUrl from '../../assets/brand/ultrack_logo_alpha.webp';
import {loadTeamLogos,drawTeamLogo} from './team-logos.js';

// the trackside brands (tracks/marina/venue.py SPONSORS): name, tagline, panel and text colour (linear), mark

const srgb = (c) => '#' + c.map((v) => Math.round(255 * Math.pow(Math.min(1, v), 1 / 2.2)).toString(16).padStart(2, '0')).join('');

const FONTS = [
  ['Anton', 'anton-latin-400-normal.woff2', {}],
  ['Barlow Condensed', 'barlow-condensed-latin-700-normal.woff2', { weight: '700' }],
  ['Barlow Condensed', 'barlow-condensed-latin-800-italic.woff2', { weight: '800', style: 'italic' }],
  ['Barlow Condensed', 'barlow-condensed-latin-900-italic.woff2', { weight: '900', style: 'italic' }],
  // Team names are baked into logo textures; their seven fonts are build inputs.
];
let ready = null;
export function loadAssets() {
  ready ??= Promise.all([
    loadSponsorLogos(),
    loadTeamLogos(),
    ...FONTS.map(([family, file, desc]) => new FontFace(family, `url(/assets/fonts/${file})`, desc).load().then((f) => document.fonts.add(f))),
    new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = logoUrl; }),
  ]).then((r) => ({ logo: r[r.length - 1] }));
  return ready;
}

/**
 * A canvas in body metres. ax(a) and ay(b) map body coordinates to pixels; the caller picks which body axes a and b are
 * and whether they run reversed. Shapes go through ax/ay; text is placed with them but drawn unrotated (or turned with
 * rot for the top sheet).
 */
function sheet(w, h, k) {
  const c = document.createElement('canvas');
  c.width = Math.max(4, Math.round(w * k)); c.height = Math.max(4, Math.round(h * k));
  return { c, g: c.getContext('2d'), k };
}

export function text(s, str, x, y, size, { font = '900 italic', family = 'Barlow Condensed', fill = '#fff', stroke = null, lw = 0.08, align = 'center', base = 'middle', rot = 0, maxW = 0 } = {}) {
  const g = s.g, px = size * s.k;
  g.save();
  g.translate(x, y); if (rot) g.rotate(rot);
  g.font = `${font} ${px}px "${family}"`;
  g.textAlign = align; g.textBaseline = base;
  if (maxW) { const m = g.measureText(str).width; if (m > maxW * s.k) g.scale(maxW * s.k / m, 1); }
  if (stroke) { g.lineJoin = 'round'; g.lineWidth = px * lw; g.strokeStyle = stroke; g.strokeText(str, 0, 0); }
  g.fillStyle = fill; g.fillText(str, 0, 0);
  g.restore();
}

/** A sponsor sticker centred at pixel (x, y), w x h metres; rot turns it (the top sheet reads from behind). */
function sticker(s,name,x,y,w,h,rot=0){
  s.g.save();s.g.translate(x,y);if(rot)s.g.rotate(rot);
  drawSponsor(s.g,name,0,0,w*s.k,h*s.k);s.g.restore();
}

// race-number plates: shape and plate / ring / ink roles from the team colours (p primary, s secondary, a accent)
const NUMBER = {
  saetta: ['roundel', 'a', 's', 'p'], corvid: ['roundel', 's', 'a', 'p'], kalt: ['box', 's', 'a', 'a'],
  mojave: ['box', 'a', 's', 's'], aurum: ['roundel', 'p', 's', 's'], liberty: ['roundel', 'a', 's', 'p'], sarab: ['roundel', 'a', 's', 's'],
  toro: ['roundel', 's', 'a', 'p'],      // black plate, bone ring, yellow digits
};
const role = (c, r) => ({ p: c.primary, s: c.secondary, a: c.accent })[r];
/** lettering on the team's own paint: colors.ink where the accent is too pale for it (Toro's yellow), else the accent */
const ink = (c) => c.ink ?? c.accent;

/** The race number: a roundel or box in the team's colours, the number in heavy italic. */
function numberPlate(s, team, num, x, y, size, rot = 0) {
  const g = s.g, R = size * s.k, c = team.colors, [style, plate, ring, ink] = NUMBER[team.id] || ['roundel', 'a', 's', 'p'];
  g.save(); g.translate(x, y); if (rot) g.rotate(rot);
  g.fillStyle = role(c, plate); g.strokeStyle = role(c, ring); g.lineWidth = R * 0.09;
  g.beginPath();
  if (style === 'box') g.roundRect(-R * 1.0, -R * 0.8, R * 2.0, R * 1.6, R * 0.1); else g.arc(0, 0, R, 0, 7);
  g.fill(); g.stroke();
  g.restore();
  text(s, String(num), x, y + (rot ? 0 : R * 0.06), size * 1.25, { fill: role(c, ink), rot, maxW: size * 1.6 });
}

/** text() options for a team's own display face. */
export const teamType = (team, fill) => ({ font: team.font.weight, family: team.font.family, ...(team.font.bold && fill ? { stroke: fill, lw: team.font.bold } : {}) });

// ------------------------------------------------------------------------------------------------ team graphics

/** The flank graphic of each team, drawn with body coordinates x (nose x0 -> tail x1) and y (height), via P(x, y). */
const FLANK = {
  // a single lightning bolt fractures from the front wheel to the rear haunch
  saetta(s, P, L, c) {
    const { xf, xr, wy } = L, g = s.g, X = (t) => xf + (xr - xf) * t;
    const pts = [[X(-0.05), wy - 0.04], [X(0.3), wy - 0.16], [X(0.27), wy - 0.1], [X(0.62), wy - 0.26], [X(0.58), wy - 0.18], [X(1.08), wy - 0.3],
      [X(0.6), wy - 0.24], [X(0.64), wy - 0.31], [X(0.28), wy - 0.17], [X(0.31), wy - 0.23]];
    g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo : g.moveTo).call(g, ...P(x, y))); g.closePath();
    g.lineJoin = 'miter'; g.lineWidth = 0.022 * s.k; g.strokeStyle = c.accent; g.stroke();
    g.fillStyle = c.secondary; g.fill();
  },
  // cream nose band, and a brass feather sweeping up the door
  corvid(s, P, L, c) {
    const { x0, x1, xf, xr, wy, y0, y1 } = L, g = s.g, len = x1 - x0, nb = x0 + len * 0.1;
    g.fillStyle = c.secondary; g.beginPath(); [[x0 - 0.1, y0], [nb, y0], [nb - 0.12, y1 + 0.1], [x0 - 0.1, y1 + 0.1]].forEach(([x, y], i) => (i ? g.lineTo : g.moveTo).call(g, ...P(x, y))); g.fill();
    g.fillStyle = c.accent; g.fillRect(...P(nb - 0.02, y1 + 0.1), 0.02 * s.k, (y1 - y0 + 0.1) * s.k);   // brass edge on the band
    const a = P(xf + 0.35, 0.27), b = P(xr - 0.3, wy - 0.05), m1 = P(xf + 0.9, 0.24), m2 = P(xr - 0.7, wy - 0.06);
    g.beginPath(); g.moveTo(...a); g.bezierCurveTo(...m1, ...m2, ...b);
    const top = P(xr - 0.7, wy - 0.12), top2 = P(xf + 0.95, 0.31);
    g.bezierCurveTo(...top, ...top2, ...a);
    g.fillStyle = c.accent; g.fill();
  },
  // black lower half under a hard diagonal, a cyan edge, technical stencils and a blueprint grid on the rear quarter
  kalt(s, P, L, c, car) {
    const { x0, x1, xr, wy, y0 } = L, g = s.g, ya = 0.44, yb = 0.31;
    g.fillStyle = c.secondary; g.beginPath(); [[x0 - 0.1, y0 - 0.1], [x0 - 0.1, ya], [x1 + 0.1, yb], [x1 + 0.1, y0 - 0.1]].forEach(([x, y], i) => (i ? g.lineTo : g.moveTo).call(g, ...P(x, y))); g.fill();
    g.strokeStyle = c.accent; g.lineWidth = 0.012 * s.k; g.beginPath(); g.moveTo(...P(x0 - 0.1, ya + 0.02)); g.lineTo(...P(x1 + 0.1, yb + 0.02)); g.stroke();
    g.strokeStyle = c.accent; g.globalAlpha = 0.45; g.lineWidth = 0.003 * s.k;
    for (let x = xr - 0.55; x <= xr + 0.25; x += 0.05) { g.beginPath(); g.moveTo(...P(x, yb + 0.05)); g.lineTo(...P(x, wy - 0.02)); g.stroke(); }
    for (let y = yb + 0.05; y <= wy; y += 0.05) { g.beginPath(); g.moveTo(...P(xr - 0.55, y)); g.lineTo(...P(xr + 0.25, y)); g.stroke(); }
    g.globalAlpha = 1;
    const st = { font: '700', family: 'Barlow Condensed', fill: c.accent, align: 'left' };
    text(s, `KLT-${car.number}  /  TYPE ${car.number === 11 ? 'F6' : 'R6'}`, ...P(x0 + 0.45, 0.255), 0.032, st);
    text(s, '2.4 BAR   CD 0.31   VMAX 312 KM/H', ...P(xr - 0.5, yb + 0.02), 0.026, st);
  },
  // navy sunburst rays fanning back from the front wheel
  mojave(s, P, L, c) {
    const { xf, rf, x1 } = L, g = s.g, cx = xf, cy = rf - L.lift, reach = x1 - xf + 0.3;
    g.fillStyle = c.secondary;
    for (const [a0, a1] of [[-6, 0], [5, 10], [15, 19], [24, 27]]) {
      g.beginPath(); g.moveTo(...P(cx, cy));
      for (const a of [a0, a1]) { const r = a * Math.PI / 180; g.lineTo(...P(cx + Math.cos(r) * reach, cy + Math.sin(r) * reach)); }
      g.fill();
    }
  },
  // champagne double beltline pinstripe and an art-deco fan on the door
  aurum(s, P, L, c) {
    const { x0, x1, xf, xr, wy } = L, g = s.g;
    g.strokeStyle = c.secondary; g.lineWidth = 0.007 * s.k;
    for (const dy of [0.075, 0.095]) { g.beginPath(); g.moveTo(...P(x0 + 0.25, wy - dy)); g.lineTo(...P(x1 - 0.2, wy - dy - 0.02)); g.stroke(); }
    const fx = xf + (xr - xf) * 0.18, fy = 0.26;
    for (let i = 0; i <= 8; i++) { const a = (20 + i * 9) * Math.PI / 180; g.beginPath(); g.moveTo(...P(fx, fy)); g.lineTo(...P(fx + Math.cos(a) * 0.42, fy + Math.sin(a) * 0.3)); g.stroke(); }
  },
  // red and white flag stripes stream back from the front wheel, a star field on the fender, a royal-blue light line on the beltline
  liberty(s, P, L, c, car, team) {
    const { x0, x1, xf, wy } = L, g = s.g, wave = (x) => 0.022 * Math.sin((x - xf) * 2.3);
    const band = (y0, y1, color) => {
      g.fillStyle = color; g.beginPath();
      const xs = []; for (let x = xf - 0.1; x <= x1 + 0.1; x += 0.05) xs.push(x);
      xs.forEach((x, i) => (i ? g.lineTo : g.moveTo).call(g, ...P(x, y0 + wave(x))));
      xs.slice().reverse().forEach((x) => g.lineTo(...P(x, y1 + wave(x))));
      g.fill();
    };
    band(0.285, 0.335, c.secondary); band(0.345, 0.395, c.accent); band(0.405, 0.455, c.secondary);
    const star = (cx, cy, r) => {
      g.beginPath();
      for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, q = i % 2 ? r * 0.4 : r; (i ? g.lineTo : g.moveTo).call(g, cx + Math.cos(a) * q, cy + Math.sin(a) * q); }
      g.closePath(); g.fill();
    };
    g.fillStyle = c.accent;
    [[0, 0], [1, 0], [2, 0], [3, 0], [0.5, 1], [1.5, 1], [2.5, 1]].forEach(([i, j]) => star(...P(xf + 0.3 + i * 0.1, 0.56 - j * 0.045), 0.028 * s.k));
    g.save(); g.strokeStyle = team.light; g.lineWidth = 0.009 * s.k; g.shadowColor = team.light; g.shadowBlur = 0.03 * s.k;
    g.beginPath(); g.moveTo(...P(x0 + 0.25, wy - 0.075)); g.lineTo(...P(x1 - 0.2, wy - 0.095)); g.stroke(); g.restore();
  },
  // two black horn blades flare apart from the front wheel, one climbing to the shoulder, one dropping to the sill, edged in bone white (the number sits on top)
  toro(s, P, L, c) {
    const { xf, xr, wy } = L, g = s.g, X = (t) => xf + (xr - xf) * t;
    const horn = (x0, y0, x1, y1, bow, w) => {      // root (x0, y0), tip (x1, y1); the tip end rises by bow; w = root thickness, tapering to a point
      const mx = (x0 + x1) / 2, my = (y0 + y1) / 2 - bow;
      g.beginPath(); g.moveTo(...P(x0, y0 + w / 2));
      g.quadraticCurveTo(...P(mx, my + w * 0.35), ...P(x1, y1));
      g.quadraticCurveTo(...P(mx, my - w * 0.35), ...P(x0 + 0.1, y0 - w / 2));     // the root is cut on a slant, like the fender
      g.closePath();
      g.fillStyle = c.secondary; g.fill();
      g.lineJoin = 'miter'; g.lineWidth = 0.007 * s.k; g.strokeStyle = c.accent; g.stroke();
    };
    horn(X(-0.2), 0.47, X(1.12), wy + 0.07, 0.12, 0.14);     // the upper horn climbs to the shoulder
    horn(X(-0.2), 0.43, X(0.98), 0.33, -0.05, 0.1);          // the lower one drops toward the sill
  },
  // teal dune contour lines from nose to tail, a gold line along the sill
  sarab(s, P, L, c) {
    const { x0, x1 } = L, g = s.g;
    g.strokeStyle = c.secondary; g.lineWidth = 0.011 * s.k;
    for (let i = 0; i < 6; i++) {
      g.beginPath();
      for (let x = x0 - 0.1; x <= x1 + 0.1; x += 0.04) {
        const y = 0.27 + i * 0.055 + 0.035 * Math.sin(x * 2.1 + i * 0.7) + 0.02 * Math.sin(x * 4.7 - i);
        (x === x0 - 0.1 ? g.moveTo : g.lineTo).call(g, ...P(x, y));
      }
      g.stroke();
    }
    g.strokeStyle = c.accent; g.lineWidth = 0.016 * s.k; g.beginPath(); g.moveTo(...P(x0 + 0.2, 0.235)); g.lineTo(...P(x1 - 0.2, 0.235)); g.stroke();
  },
};

/** Top-sheet graphic of each team: x along the length, z across, via P(x, z). */
const TOPS = {
  saetta(s, P, L, c) { stripe(s, P, L, c.secondary, [-0.07, 0.07], 0.018); },
  corvid(s, P, L, c) {
    const { x0, x1, z0, z1 } = L, g = s.g, nb = x0 + (x1 - x0) * 0.1;
    g.fillStyle = c.secondary; g.beginPath(); [[x0 - 0.1, z0 - 0.1], [nb, z0 - 0.1], [nb, z1 + 0.1], [x0 - 0.1, z1 + 0.1]].forEach(([x, z], i) => (i ? g.lineTo : g.moveTo).call(g, ...P(x, z))); g.fill();
    stripe(s, P, L, c.accent, [0], 0.012);
  },
  kalt(s, P, L, c) { stripe(s, P, L, c.secondary, [-0.16, 0.16], 0.05); stripe(s, P, L, c.accent, [-0.13, 0.13], 0.008); },
  mojave(s, P, L, c) { stripe(s, P, L, c.secondary, [-0.13, 0.13], 0.15); stripe(s, P, L, c.accent, [-0.2, -0.055, 0.055, 0.2], 0.012); },
  aurum(s, P, L, c) {
    const { x0 } = L, g = s.g, fx = x0 + 0.35;
    g.strokeStyle = c.secondary; g.lineWidth = 0.008 * s.k;
    for (let i = -5; i <= 5; i++) { const a = i * 8 * Math.PI / 180; g.beginPath(); g.moveTo(...P(fx, 0)); g.lineTo(...P(fx + Math.cos(a) * 0.7, Math.sin(a) * 0.7)); g.stroke(); }
    stripe(s, P, L, c.secondary, [-0.04, 0.04], 0.007);
  },
  liberty(s, P, L, c, team) { stripe(s, P, L, c.accent, [0], 0.17); stripe(s, P, L, c.secondary, [-0.125, 0.125], 0.05); stripe(s, P, L, team.light, [-0.165, 0.165], 0.008); },
  toro(s, P, L, c) { stripe(s, P, L, c.secondary, [0], 0.2); stripe(s, P, L, c.accent, [-0.14, 0.14], 0.012); },
  sarab(s, P, L, c) {
    const { x0, x1, z0, z1 } = L, g = s.g;
    g.strokeStyle = c.secondary; g.lineWidth = 0.011 * s.k;
    for (let i = 0; i < 7; i++) {
      g.beginPath();
      for (let x = x0 - 0.1; x <= x1 + 0.1; x += 0.04) {
        const z = z0 + (z1 - z0) * (0.12 + i * 0.125) + 0.05 * Math.sin(x * 1.9 + i * 0.9);
        (x === x0 - 0.1 ? g.moveTo : g.lineTo).call(g, ...P(x, z));
      }
      g.stroke();
    }
  },
};
function stripe(s, P, L, color, offsets, w) {
  const g = s.g; g.fillStyle = color;
  for (const o of offsets) { const a = P(L.x0 - 0.2, o - w / 2), b = P(L.x1 + 0.2, o + w / 2); g.fillRect(Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1])); }
}

// ------------------------------------------------------------------------------------------------ the four sheets

/**
 * Draw a car's livery. box: body-space bounds (min/max Vector3, nose at min.x); profile: its car-lab profile;
 * team, car: from teams.json; k: pixels per metre. Returns { sideP, sideN, top, rear } textures.
 */
export async function makeLivery({ team, car, profile, box, k = 256 }) {
  const { logo } = await loadAssets();
  const lift = profile.body.lift, c = team.colors;
  const L = {
    x0: box.min.x, x1: box.max.x, y0: box.min.y, y1: box.max.y, z0: box.min.z, z1: box.max.z, lift,
    xf: profile.wheels.front.x, xr: profile.wheels.rear.x, rf: profile.wheels.front.radius, rr: profile.wheels.rear.radius,
    wy: Math.min(...profile.glass.side.map((p) => p[1])) - lift,     // window line, in body coordinates
  };
  const len = L.x1 - L.x0, hgt = L.y1 - L.y0, wid = L.z1 - L.z0;
  const others = SPONSOR_BRANDS.map(b=>b.name).filter(n=>n!==team.sponsor&&n!=='Pirelli');
  const pick = (i) => others[(car.number * 3 + i * 5) % others.length];

  // flanks: +Z is seen with the nose on the left, -Z with the nose on the right
  const flank = (noseLeft) => {
    const s = sheet(len, hgt, k);
    const P = (x, y) => [(noseLeft ? x - L.x0 : L.x1 - x) * k, (L.y1 - y) * k];
    FLANK[team.id]?.(s, P, L, c, car, team);
    const dx = L.xf + (L.xr - L.xf) * 0.44, doorH = L.wy - 0.24, dy = 0.24 + doorH * 0.5;
    numberPlate(s, team, car.number, ...P(dx, dy), Math.min(0.19, doorH * 0.48));
    const d = car.driver, last = d.name.split(' ').slice(-1)[0].toUpperCase();
    text(s, `${d.name[0]}. ${last}`, ...P(dx, L.wy - 0.035), 0.05, { font: '800 italic', fill: ink(c), stroke: c.primary, lw: 0.12, maxW: 0.5 });
    text(s, d.nation, ...P(dx, L.wy - 0.075), 0.026, { font: '700', fill: ink(c), maxW: 0.2 });
    sticker(s, team.sponsor, ...P(L.xf + (L.xr - L.xf) * 0.79, dy + 0.02), 0.46, 0.12);
    sticker(s, 'KESTROVA', ...P(L.xf + L.rf + 0.38, 0.255), 0.34, 0.07);
    sticker(s, pick(0), ...P(L.xf + (L.xr - L.xf) * 0.66, 0.27), 0.2, 0.055);
    sticker(s, pick(1), ...P(L.xf + (L.xr - L.xf) * 0.66 + 0.22, 0.27), 0.2, 0.055);
    const lw = 0.3, lh = lw / 3.91, [lx, ly] = P(L.xf + 0.12, L.rf - lift + L.rf + 0.1);   // series logo on the front wing
    s.g.drawImage(logo, lx - lw * k / 2, ly - lh * k / 2, lw * k, lh * k);
    return s;
  };

  // top: length runs left to right (nose left), the -Z side at the top of the canvas; text turns to read from behind
  const top = sheet(len, wid, k);
  {
    const P = (x, z) => [(x - L.x0) * k, (z - L.z0) * k], up = -Math.PI / 2;
    TOPS[team.id]?.(top, P, L, c, team);
    const roofX = (Math.min(...profile.glass.side.map((p) => p[0])) + Math.max(...profile.glass.side.map((p) => p[0]))) / 2;
    numberPlate(top, team, car.number, ...P(roofX, 0), 0.2, up);
    drawTeamLogo(top.g,team,...P(L.x0+len*.17,0),wid*.5*k,.25*k,{rot:Math.PI/2});
    const deck = L.x1 - Math.max(0.3, (L.x1 - L.x0) * 0.07);
    drawTeamLogo(top.g,team,...P(deck,0),wid*.65*k,.3*k,{rot:up});
    sticker(top, team.sponsor, ...P((roofX + deck) / 2 + 0.15, 0), 0.5, 0.12, up);
  }

  // rear: seen from behind, +Z on the left of the canvas
  const rear = sheet(wid, hgt, k);
  {
    const P = (z, y) => [(L.z1 - z) * k, (L.y1 - y) * k], g = rear.g;
    g.fillStyle = c.secondary; const a = P(L.z1 + 0.1, 0.4), b = P(L.z0 - 0.1, 0.25); g.fillRect(a[0], a[1], b[0] - a[0], b[1] - a[1]);
    drawTeamLogo(rear.g,team,...P(0,.325),wid*.42*k,.17*k);
    text(rear, String(car.number), ...P(-wid * 0.31, 0.325), 0.11, { fill: c.accent, maxW: 0.25 });
    sticker(rear, 'KESTROVA', ...P(wid * 0.31, 0.325), 0.26, 0.07);
  }

  const tex = (s) => {
    const t = new THREE.CanvasTexture(s.c);
    t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
    t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
    return t;
  };
  return { sideP: tex(flank(true)), sideN: tex(flank(false)), top: tex(top), rear: tex(rear) };
}

/**
 * Project a livery onto car-lab's body material. car-lab's own shader patch runs first (stripes, carbon lower trim
 * below 0.2 m); the decals go in just before that trim, so the carbon sill stays on top.
 */
export function applyLivery(mat, liv, box) {
  mat.userData.liveryOn = { value: 1 };          // the garage's livery switch (0 = plain paint)
  const base = mat.onBeforeCompile;
  mat.onBeforeCompile = (shader, renderer) => {
    base.call(mat, shader, renderer);
    Object.assign(shader.uniforms, {
      tLivSideP: { value: liv.sideP }, tLivSideN: { value: liv.sideN }, tLivTop: { value: liv.top }, tLivRear: { value: liv.rear },
      uLivMin: { value: box.min }, uLivMax: { value: box.max }, uLivOn: mat.userData.liveryOn,
    });
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vLivN;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvLivN = normal;');
    const anchor = 'float lowerTrim=';
    if (!shader.fragmentShader.includes(anchor)) console.warn('livery: car-lab paint shader changed; decals not applied');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vLivN;\nuniform sampler2D tLivSideP, tLivSideN, tLivTop, tLivRear;\nuniform vec3 uLivMin, uLivMax; uniform float uLivOn;')
      .replace(anchor, /* glsl */`float livA = 0.0;      // decal coverage, read by finish.js (vinyl is not metallic)
      {
        vec3 q = (vShellPosition - uLivMin) / (uLivMax - uLivMin), n = normalize(vLivN);
        // each sheet only where the surface faces its way; front faces keep the plain paint
        vec4 d = n.z > 0.0 ? texture2D(tLivSideP, q.xy) : texture2D(tLivSideN, vec2(1.0 - q.x, q.y));
        d.a *= smoothstep(0.3, 0.6, abs(n.z)) * uLivOn;
        vec4 t = texture2D(tLivTop, vec2(q.x, 1.0 - q.z)); t.a *= smoothstep(0.4, 0.7, n.y) * uLivOn;
        vec4 r = texture2D(tLivRear, vec2(1.0 - q.z, q.y)); r.a *= smoothstep(0.4, 0.7, n.x) * uLivOn;
        diffuseColor.rgb = mix(diffuseColor.rgb, d.rgb, d.a);
        diffuseColor.rgb = mix(diffuseColor.rgb, t.rgb, t.a);
        diffuseColor.rgb = mix(diffuseColor.rgb, r.rgb, r.a);
        livA = max(d.a, max(t.a, r.a));
      }
      ` + anchor);
  };
  mat.customProgramCacheKey = () => 'ru-livery-v1';
  mat.needsUpdate = true;
}
