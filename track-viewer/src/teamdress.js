// Team artwork on the venue (assets/teams/teams.json), drawn with each team's own font onto the per-team materials the
// Blender build makes with stand-in textures: garage headers (M_GarageHeader_<TEAM>, lit like a lightbox), the
// team's panel painted on its pit box floor (M_PitBox_<TEAM>), flags (M_Flag_<TEAM>, which life.js still ripples),
// the Corniche Club's hanging banners (M_TeamBanner_<TEAM>) and its commentary booth sign (M_VipSign).
import * as THREE from 'three';
import {drawSponsor} from './sponsors.js';
import TEAMS from '../../assets/teams/teams.json';
import { loadAssets, text } from './livery.js';
import {drawTeamLogo} from './team-logos.js';

const BY_NAME = Object.fromEntries(TEAMS.teams.map((t) => [t.name.toUpperCase(), t]));

function canvas(w, h, k) {
  const c = document.createElement('canvas');
  c.width = Math.round(w * k); c.height = Math.round(h * k);
  return { c, g: c.getContext('2d'), k, w, h };
}

// a lit strip in the team's light colour (teams.json 'light'; royal blue at Liberty) with a soft glow, or plain colour without one
function led(s, t, x, y, w, h, fallback) {
  const g = s.g;
  g.save(); g.fillStyle = t.light || fallback;
  if (t.light) { g.shadowColor = t.light; g.shadowBlur = Math.min(w, h) * 1.6; }
  g.fillRect(x, y, w, h); g.restore();
}

const DRAW = {
  // 10 x 1.6 m over the garage door: the team name in its font, the two cars' numbers, the title sponsor
  GarageHeader(t) {
    const s = canvas(10, 1.6, 102), g = s.g, c = t.colors, W = s.c.width, H = s.c.height;
    g.fillStyle = c.primary; g.fillRect(0, 0, W, H);
    g.fillStyle = c.secondary; g.fillRect(0, H * 0.86, W, H * 0.14); led(s, t, W * 0.02, H * 0.9, W * 0.96, H * 0.04, c.secondary);
    led(s, t, 0, 0, W, H * 0.05, c.accent);
    drawTeamLogo(g,t,W*.43,H*.48,4.6*s.k,1.05*s.k);
    t.cars.forEach((car, j) => text(s, String(car.number), W * (0.78 + j * 0.11), H * 0.47, 0.8, { fill: c.secondary, stroke: c.accent, lw: 0.05, maxW: 1 }));
    drawSponsor(g,t.sponsor,W*.11,H*.47,W*.16,H*.55);
    return s;
  },
  // 9 x 5 m painted on the box: a border, the name across it, the two numbers; transparent elsewhere (it is paint)
  PitBox(t) {
    const s = canvas(9, 5, 80), g = s.g, c = t.colors, W = s.c.width, H = s.c.height, b = 0.14 * s.k;
    g.strokeStyle = t.light || c.secondary; g.lineWidth = b; g.strokeRect(b / 2, b / 2, W - b, H - b);
    g.fillStyle = c.primary; g.globalAlpha = 0.85; g.fillRect(b, H * 0.3, W - 2 * b, H * 0.4); g.globalAlpha = 1;
    drawTeamLogo(g,t,W/2,H/2,6.0*s.k,1.5*s.k);
    t.cars.forEach((car, j) => text(s, String(car.number), W * (j ? 0.9 : 0.1), H / 2, 1.0, { fill: c.secondary, maxW: 1.2 }));
    return s;
  },
  // 2.4 x 1.5 m: the team colours split by a diagonal accent band, the name in its font
  Flag(t) {
    const s = canvas(2.4, 1.5, 200), g = s.g, c = t.colors, W = s.c.width, H = s.c.height;
    g.fillStyle = c.primary; g.fillRect(0, 0, W, H);
    g.fillStyle = c.secondary; g.beginPath(); g.moveTo(0, H * 0.78); g.lineTo(W * 0.35, H); g.lineTo(0, H); g.fill();
    g.beginPath(); g.moveTo(W, 0); g.lineTo(W, H * 0.22); g.lineTo(W * 0.65, 0); g.fill();
    drawTeamLogo(g,t,W/2,H/2,1.9*s.k,.6*s.k);
    return s;
  },
  // 5 x 8 m hanging banner: the name, the team's line, both drivers with their numbers
  TeamBanner(t) {
    const s = canvas(5, 8, 100), g = s.g, c = t.colors, W = s.c.width, H = s.c.height;
    g.fillStyle = c.primary; g.fillRect(0, 0, W, H);
    g.fillStyle = c.secondary; g.fillRect(0, 0, W, H * 0.025); g.fillRect(0, H * 0.975, W, H * 0.025);
    led(s, t, W * 0.08, H * 0.25, W * 0.84, H * 0.006, c.secondary);
    if (t.light) { led(s, t, W * 0.03, H * 0.04, W * 0.012, H * 0.92); led(s, t, W * 0.958, H * 0.04, W * 0.012, H * 0.92); }
    drawTeamLogo(g,t,W/2,H*.14,4.4*s.k,1.15*s.k);
    text(s, t.line.toUpperCase(), W / 2, H * 0.3, 0.2, { font: '700', family: 'Barlow Condensed', fill: c.ink ?? c.accent, maxW: 4.3 });
    t.cars.forEach((car, j) => {
      const y = H * (0.48 + j * 0.27), d = car.driver;
      text(s, String(car.number), W / 2, y, 1.25, { fill: c.secondary, stroke: c.accent, lw: 0.04, maxW: 3 });
      text(s, d.name.toUpperCase(), W / 2, y + H * 0.11, 0.3, { font: '800 italic', fill: c.ink ?? c.accent, maxW: 4.4 });
      text(s, d.nation, W / 2, y + H * 0.155, 0.18, { font: '700', family: 'Barlow Condensed', fill: c.secondary });
    });
    return s;
  },
};

function sign() {
  const s = canvas(14, 1.4, 90), g = s.g, W = s.c.width, H = s.c.height;
  g.fillStyle = '#0b0c0f'; g.fillRect(0, 0, W, H);
  g.fillStyle = '#f2b705'; g.fillRect(0, H * 0.9, W, H * 0.1);
  text(s, 'COMMENTARY', W * 0.3, H * 0.47, 0.75, { font: '400', family: 'Anton', fill: '#f4f1ea', maxW: 6 });
  text(s, 'ENZO MORETTI  ·  ALASTAIR FINCH', W * 0.72, H * 0.47, 0.42, { font: '800 italic', fill: '#f2b705', maxW: 6.2 });
  return s;
}

/** Repaint the venue's team materials. materials: every material of the loaded track. */
export async function dressTeams(materials) {
  await loadAssets();
  const tex = (s) => {
    const t = new THREE.CanvasTexture(s.c);
    t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
    t.flipY = false;                          // glTF UVs run top-down: the track's own textures load unflipped too
    return t;
  };
  const cache = new Map();
  let n = 0;
  for (const m of materials) {
    if (m.name === 'M_VipSign') {
      m.map = m.emissiveMap = tex(sign()); m.emissive?.set(0xffffff); m.needsUpdate = true; n++; continue;
    }
    const hit = /^M_(GarageHeader|PitBox|Flag|TeamBanner)_([A-Z]+)/.exec(m.name);
    const team = hit && BY_NAME[hit[2]];
    if (!team) continue;
    const key = hit[1] + team.id;
    if (!cache.has(key)) cache.set(key, tex(DRAW[hit[1]](team)));
    m.map = cache.get(key);
    m.color?.set(0xffffff);
    if (hit[1] === 'GarageHeader') { m.emissiveMap = m.map; m.emissive?.set(0xffffff); if (team.light) m.emissiveIntensity = 1.5; }
    if (hit[1] === 'PitBox') { m.transparent = true; m.depthWrite = false; m.polygonOffset = true; m.polygonOffsetFactor = -2; }
    m.needsUpdate = true;
    n++;
  }
  return n;
}
