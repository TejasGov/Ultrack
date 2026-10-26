// Night light spill: the pools of light the street lamps, neon signs, lanterns, barrier LED lines and tunnel lights throw on the
// ground around them. Lights are not in the glTF and real lights cost a pass each, so every source gets a fixed additive card that
// hugs the ground under it (its vertices are dropped onto the road, kerb, pavement and park meshes), shaded with the falloff of a
// light at the source's height over that ground: E(r) ~ (1 + (r/h)^2)^-1.5, r measured to the source's segment (a lamp is a point;
// a sign, a lantern string or an LED line is a segment along its own principal axis, so a line lights a continuous band, never a
// dotted one that would strobe at speed). All pools are one merged mesh, one draw call, at fixed places: nothing jumps from lamp to
// lamp. They fade with fog and per look (none by day but the tunnel's, a trace at dusk) and darken a little on a wet road.
//   sources: lights.json streetLamps (sodium); every sign in its own hue (signs.js, the colours neon-signs gives them: a lit panel
//   throws more light than neon-tube text); clusters of the other emissive surfaces in SOURCES (colour from the material)
import * as THREE from 'three';
import { TRACKS } from '../../tracks.js';
import { analyseSigns, PALETTE } from './signs.js';

const GROUND = new Set(TRACKS.tokyo.wet.wet);                 // the surfaces a pool may fall on: road, paint, kerbs, pavement, park
const LAMP = 0, NEON = 1, WARM = 2, TUNNEL = 3;                // gain groups (uGain.xyzw)
const SODIUM = new THREE.Color('#ffb46b');
// emissive sources: material name, gain group, cluster cell (m, 3D), strength, colour override (else the material's emissive colour)
const SOURCES = [
  { re: /^V10 (cyan|pink)$/, kind: NEON, cell: 10, k: 0.8 },
  { re: /^V9 vm_(white|red|blue|green)$/, kind: NEON, cell: 4, k: 0.6, color: '#eaf3ff' },              // vending machines: a cool white apron
  { re: /^(V9 LED (violet|lime|white|pink|cyan|amber)|V12 LED (cyan|purple))$/, kind: NEON, cell: 16, k: 0.12 },   // LED lines on the barriers
  { re: /^(V12 red lantern glow|V13 lantern paper white|V9 amber_lamp)$/, kind: WARM, cell: 9, k: 0.75, color: '#ff9a4a' },
  { re: /^(V10 warm|V12 pagoda shoji|V13 (lamp warm|village window|castle window warm))$/, kind: WARM, cell: 10, k: 0.5, color: '#ffb46b' },
  { re: /^V13\.1 tunnel luminaire$/, kind: TUNNEL, cell: 24, k: 1.0, color: '#f2f6ff' },   // long cells: one continuous band, no 7 Hz beat at speed
  { re: /^V13 cove warm white$/, kind: TUNNEL, cell: 24, k: 0.4, color: '#ffe4ce' },
];
const NEAR_ROAD = 30;            // m from the centerline: farther sources light nothing the driver sees
const MAX_R = { [LAMP]: 26, [NEON]: 14, [WARM]: 12, [TUNNEL]: 15 };
const H_REF = 6;                 // a source this high over its ground has the nominal peak; the peak goes as 1/h^2 (capped)

/** Ground height lookup over the GROUND meshes: triangles binned on a 4 m grid (xz). height(x, z, below) = the highest ground under `below`.
 *  Built once per venue (neon-streaks uses it too). */
const fields = new WeakMap();
export function groundField(root) {
  if (!fields.has(root)) fields.set(root, buildGroundField(root));
  return fields.get(root);
}
function buildGroundField(root) {
  const CELL = 4, cells = new Map(), big = [], T = [];
  const key = (ix, iz) => (ix + 30000) * 60000 + (iz + 30000);
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), m = new THREE.Matrix4(), w = new THREE.Matrix4();
  root.updateMatrixWorld(true);
  root.traverse((o) => {
    if (!o.isMesh || Array.isArray(o.material) || !GROUND.has(o.material.name)) return;
    const pos = o.geometry.attributes.position, idx = o.geometry.index, nt = (idx ? idx.count : pos.count) / 3;
    for (let k = 0, ni = o.isInstancedMesh ? o.count : 1; k < ni; k++) {
      if (o.isInstancedMesh) { o.getMatrixAt(k, m); w.multiplyMatrices(o.matrixWorld, m); } else w.copy(o.matrixWorld);
      for (let t = 0; t < nt; t++) {
        const i0 = idx ? idx.getX(t * 3) : t * 3, i1 = idx ? idx.getX(t * 3 + 1) : t * 3 + 1, i2 = idx ? idx.getX(t * 3 + 2) : t * 3 + 2;
        a.fromBufferAttribute(pos, i0).applyMatrix4(w); b.fromBufferAttribute(pos, i1).applyMatrix4(w); c.fromBufferAttribute(pos, i2).applyMatrix4(w);
        const ny = (b.z - a.z) * (c.x - a.x) - (b.x - a.x) * (c.z - a.z), area2 = Math.hypot(ny, (b.y - a.y) * (c.z - a.z) - (b.z - a.z) * (c.y - a.y), (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x));
        if (area2 < 1e-6 || Math.abs(ny) < 0.5 * area2) continue;            // walls and kerb faces are not ground
        const id = T.length / 9;
        T.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
        const x0 = Math.floor(Math.min(a.x, b.x, c.x) / CELL), x1 = Math.floor(Math.max(a.x, b.x, c.x) / CELL);
        const z0 = Math.floor(Math.min(a.z, b.z, c.z) / CELL), z1 = Math.floor(Math.max(a.z, b.z, c.z) / CELL);
        if ((x1 - x0 + 1) * (z1 - z0 + 1) > 256) { big.push(id); continue; }    // the park's km-wide triangles: tested every time
        for (let ix = x0; ix <= x1; ix++) for (let iz = z0; iz <= z1; iz++) { const kk = key(ix, iz); let l = cells.get(kk); if (!l) cells.set(kk, l = []); l.push(id); }
      }
    }
  });
  const test = (list, x, z, below, best) => {
    for (const id of list) {
      const o = id * 9, ax = T[o], az = T[o + 2], bx = T[o + 3], bz = T[o + 5], cx = T[o + 6], cz = T[o + 8];
      const d = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz);
      if (Math.abs(d) < 1e-9) continue;
      const l1 = ((bz - cz) * (x - cx) + (cx - bx) * (z - cz)) / d, l2 = ((cz - az) * (x - cx) + (ax - cx) * (z - cz)) / d, l3 = 1 - l1 - l2;
      if (l1 < -1e-4 || l2 < -1e-4 || l3 < -1e-4) continue;
      const y = l1 * T[o + 1] + l2 * T[o + 4] + l3 * T[o + 7];
      if (y < below && y > best) best = y;
    }
    return best;
  };
  return (x, z, below) => {
    const best = test(big, x, z, below, test(cells.get(key(Math.floor(x / CELL), Math.floor(z / CELL))) ?? [], x, z, below, -Infinity));
    return best > -Infinity ? best : null;
  };
}

/** The signs as light sources: a segment along each one's longer horizontal side, in its hue; print and far-tier copies throw none. */
function signSources(root) {
  const out = [], size = new THREE.Vector3();
  for (const s of analyseSigns(root).signs) {
    if (s.style > 2) continue;
    s.box.getSize(size);
    const half = Math.max(0, Math.max(size.x, size.z) / 2 - 0.4), seg = size.x > size.z ? new THREE.Vector2(half, 0) : new THREE.Vector2(0, half);
    const area = s.panel ? s.A : s.glyphs.reduce((a, g) => a + g.A, 0);
    // spread: a sign faces the street and lights the ground in front of it, not a wide disc; many wide pools in many hues
    // summed to a muddy brown wash that also drowned the wet road's reflections
    out.push({ pos: s.pos.clone(), seg, spread: 3.5, color: PALETTE[s.hue].c.clone().multiplyScalar(PALETTE[s.hue].k), kind: NEON,
      k: (s.style < 2 ? 1 : 0.55) * THREE.MathUtils.clamp(Math.sqrt(area / (1 + 2 * half)) / 1.3, 0.35, 1.6) });
  }
  return out;
}

/** Emissive surfaces grouped into sources: per cluster cell the area-weighted centroid, colour and principal axis (a segment). */
function emissiveSources(root) {
  const out = [], a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), e1 = new THREE.Vector3(), e2 = new THREE.Vector3();
  const m = new THREE.Matrix4(), w = new THREE.Matrix4(), I = [0, 0, 0];
  for (const S of SOURCES) {
    const cells = new Map();
    root.traverse((o) => {
      if (!o.isMesh || Array.isArray(o.material) || !S.re.test(o.material.name) || /_far~/.test(o.name)) return;   // the near tier is enough
      const mat = o.material, pos = o.geometry.attributes.position, idx = o.geometry.index, nt = (idx ? idx.count : pos.count) / 3;
      const base = new THREE.Color(S.color ?? mat.emissive);
      for (let k = 0, ni = o.isInstancedMesh ? o.count : 1; k < ni; k++) {
        if (o.isInstancedMesh) { o.getMatrixAt(k, m); w.multiplyMatrices(o.matrixWorld, m); } else w.copy(o.matrixWorld);
        for (let t = 0; t < nt; t++) {
          for (let j = 0; j < 3; j++) I[j] = idx ? idx.getX(t * 3 + j) : t * 3 + j;
          a.fromBufferAttribute(pos, I[0]).applyMatrix4(w); b.fromBufferAttribute(pos, I[1]).applyMatrix4(w); c.fromBufferAttribute(pos, I[2]).applyMatrix4(w);
          const area = e1.subVectors(b, a).cross(e2.subVectors(c, a)).length() / 2;
          if (area < 1e-4) continue;
          const x = (a.x + b.x + c.x) / 3, y = (a.y + b.y + c.y) / 3, z = (a.z + b.z + c.z) / 3;
          const col = [base.r, base.g, base.b];
          const kk = `${Math.floor(x / S.cell)},${Math.floor(y / S.cell)},${Math.floor(z / S.cell)}`;
          let s = cells.get(kk);
          if (!s) cells.set(kk, s = { x: 0, y: 0, z: 0, xx: 0, xz: 0, zz: 0, A: 0, r: 0, g: 0, b: 0 });
          s.x += x * area; s.y += y * area; s.z += z * area; s.xx += x * x * area; s.xz += x * z * area; s.zz += z * z * area;
          s.A += area; s.r += col[0] * area; s.g += col[1] * area; s.b += col[2] * area;
        }
      }
    });
    for (const s of cells.values()) {
      const col = new THREE.Color(s.r / s.A, s.g / s.A, s.b / s.A), mx = Math.max(col.r, col.g, col.b);
      if (mx < 0.02) continue;
      col.multiplyScalar(1 / mx);
      const x = s.x / s.A, z = s.z / s.A, vxx = s.xx / s.A - x * x, vxz = s.xz / s.A - x * z, vzz = s.zz / s.A - z * z;
      // principal axis in xz; for a uniform segment of length L the variance along it is L^2 / 12, so its half-length is sqrt(3 var)
      const ang = 0.5 * Math.atan2(2 * vxz, vxx - vzz), lam = 0.5 * (vxx + vzz) + Math.sqrt(0.25 * (vxx - vzz) ** 2 + vxz * vxz);
      const half = Math.min(Math.sqrt(3 * Math.max(lam, 0)), S.cell * 0.75);
      out.push({ pos: new THREE.Vector3(x, s.y / s.A, z), seg: new THREE.Vector2(Math.cos(ang), Math.sin(ang)).multiplyScalar(half), color: col, kind: S.kind, src: S,
        k: S.k * THREE.MathUtils.clamp(Math.sqrt(s.A / (1 + 2 * half)) / 1.6, 0.35, 1.4) });       // brightness per metre of the source
    }
  }
  return out;
}

/** Least-squares plane y = a + b x + c z through the samples with a height, twice dropping those more than 0.35 m off it. */
function fitPlane(S, y0) {
  const ys = S.filter((s) => s.y !== null).map((s) => s.y).sort((a, b) => a - b);
  let pl = [ys.length ? ys[ys.length >> 1] : y0, 0, 0];      // start flat at the median height: most of a pool is road
  for (let it = 0; it < 3; it++) {
    const M = [0, 0, 0, 0, 0, 0, 0, 0, 0], r = [0, 0, 0];
    for (const s of S) {
      if (s.y === null || Math.abs(s.y - (pl[0] + pl[1] * s.x + pl[2] * s.z)) > (it ? 0.35 : 0.8)) continue;
      const q = [1, s.x, s.z];
      for (let a = 0; a < 3; a++) { r[a] += q[a] * s.y; for (let b = 0; b < 3; b++) M[a * 3 + b] += q[a] * q[b]; }
    }
    if (M[0] < 4) break;                                    // too few ground samples to fit a slope: keep the last plane
    const m = new THREE.Matrix3().set(...M);
    if (Math.abs(m.determinant()) < 1e-6) { pl = [r[0] / M[0], 0, 0]; continue; }
    pl = new THREE.Vector3(...r).applyMatrix3(m.invert()).toArray();
  }
  return pl;
}

const VS = /* glsl */`
  attribute vec4 aPool; attribute vec4 aSrc; attribute vec3 aColor;
  varying vec3 vW, vCol; varying vec4 vPool, vSrc; varying float vDepth;
  void main() {
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vW = wp.xyz; vPool = aPool; vSrc = aSrc; vCol = aColor;
    vec4 mv = viewMatrix * wp; vDepth = -mv.z;
    gl_Position = projectionMatrix * mv;
  }`;
// vPool: centre xz, half segment xz; vSrc: height over the ground, radius, gain group, ground under this vertex (0 = none: fade out)
const FS = /* glsl */`
  uniform vec4 uGain; uniform float uFogD;
  varying vec3 vW, vCol; varying vec4 vPool, vSrc; varying float vDepth;
  void main() {
    vec2 d = vW.xz - vPool.xy, u = vPool.zw;
    float t = clamp(dot(d, u) / max(dot(u, u), 1e-4), -1.0, 1.0), r = length(d - u * t), q = r / vSrc.x;
    float e = pow(1.0 + q * q, -1.5) * (1.0 - smoothstep(0.5, 1.0, r / vSrc.y));       // the light's falloff, softly cut at the card edge
    float k = vSrc.z;
    float g = k < 0.5 ? uGain.x : k < 1.5 ? uGain.y : k < 2.5 ? uGain.z : uGain.w;
    gl_FragColor = vec4(vCol * (e * g * vSrc.w * exp(-uFogD * uFogD * vDepth * vDepth)), 1.0);
  }`;

export async function create({ scene, root, track, lights, NO_MIRROR }) {
  const t0 = performance.now();
  const height = groundField(root);
  const C = track.centerline;
  const nearestRoad = (x, z) => { let bd = Infinity, bi = 0; for (let i = 0; i < C.length; i++) { const d = (C[i][0] - x) ** 2 + (C[i][2] - z) ** 2; if (d < bd) { bd = d; bi = i; } } return { d: Math.sqrt(bd), p: C[bi] }; };
  const sources = [
    ...(lights?.streetLamps ?? []).map((l) => ({ pos: new THREE.Vector3(...l.pos), seg: new THREE.Vector2(), color: SODIUM, kind: LAMP, k: 1 })),
    ...emissiveSources(root),
    ...signSources(root),
  ];
  // pools: the ground under the source (moved a little toward the road for signs and lanterns, which face it), height, radius
  const pools = [];
  for (const s of sources) {
    const road = nearestRoad(s.pos.x, s.pos.z);
    if (s.kind !== TUNNEL && road.d > NEAR_ROAD + s.seg.length()) continue;
    const g0 = height(s.pos.x, s.pos.z, s.pos.y - 0.15);
    if (g0 === null) continue;
    const c = s.pos.clone();
    if (s.kind === NEON || s.kind === WARM) {
      const to = new THREE.Vector2(road.p[0] - c.x, road.p[2] - c.z), d = to.length();
      if (d > 0.1) { const step = Math.min(1.0 * (s.pos.y - g0), 0.75 * d); c.x += to.x / d * step; c.z += to.y / d * step; }
    }
    const gy = height(c.x, c.z, s.pos.y - 0.15) ?? g0, h = Math.max(0.7, s.pos.y - gy), hs = Math.min(h, s.spread ?? h);
    pools.push({ src: s.src, c: new THREE.Vector3(c.x, gy, c.z), seg: s.seg, h: hs, R: THREE.MathUtils.clamp(2.4 * hs, 3, MAX_R[s.kind]), color: s.color.clone().multiplyScalar(s.k * THREE.MathUtils.clamp((H_REF / h) ** 2, 0.35, 2)), kind: s.kind, top: s.pos.y - 0.15 });
  }
  // one merged mesh: a grid per pool (a rectangle around its segment), each vertex dropped onto the ground and lifted LIFT: the
  // road is crowned and the ramps bend, so between vertices the surface rises above the straight card edge; the lift (and the
  // polygon offset) keep the card over it, or it shows a hard edge where it dips under
  const LIFT = 0.12, grid = (p) => [Math.max(2, Math.min(8, Math.round((p.seg.length() + p.R) / 5))), p.R > 12 ? 6 : p.R > 6 ? 4 : 2];
  let nv = 0, ni = 0;
  for (const p of pools) { const [na, nb] = grid(p); nv += (na + 1) * (nb + 1); ni += na * nb * 6; }
  const P = new Float32Array(nv * 3), PO = new Float32Array(nv * 4), SR = new Float32Array(nv * 4), CO = new Float32Array(nv * 3), IX = new Uint32Array(ni);
  let v = 0, f = 0;
  for (const p of pools) {
    const [na, nb] = grid(p), first = v, L = p.seg.length();
    const ax = L > 0.01 ? p.seg.clone().divideScalar(L) : new THREE.Vector2(1, 0), bx = new THREE.Vector2(-ax.y, ax.x);
    const S = [];
    for (let j = 0; j <= nb; j++) for (let i = 0; i <= na; i++) {
      const sa = (i / na * 2 - 1) * (L + p.R), sb = (j / nb * 2 - 1) * p.R;
      const x = p.c.x + ax.x * sa + bx.x * sb, z = p.c.z + ax.y * sa + bx.y * sb, y = height(x, z, p.top);
      S.push({ x: x - p.c.x, z: z - p.c.z, y: y !== null && Math.abs(y - p.c.y) < 3 ? y : null });
    }
    // the ground is one gentle plane at this scale (road, kerb, pavement): a wall or planter top in the ground set, a drop off a deck
    // edge or a lower level is not, and a card triangle reaching up to one cut through the road with a hard edge. Fit, reject, refit.
    const plane = fitPlane(S, p.c.y);
    for (const s of S) {
      const py = plane[0] + plane[1] * s.x + plane[2] * s.z, on = s.y !== null && Math.abs(s.y - py) < 0.35;   // off: fade the card out there
      P.set([s.x + p.c.x, (on ? s.y : py) + LIFT, s.z + p.c.z], v * 3);
      PO.set([p.c.x, p.c.z, p.seg.x, p.seg.y], v * 4); SR.set([p.h, p.R, p.kind, on ? 1 : 0], v * 4); CO.set([p.color.r, p.color.g, p.color.b], v * 3);
      v++;
    }
    for (let j = 0; j < nb; j++) for (let i = 0; i < na; i++) {
      const q = first + j * (na + 1) + i;
      IX.set([q, q + na + 1, q + 1, q + 1, q + na + 1, q + na + 2], f); f += 6;
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(P, 3));
  geo.setAttribute('aPool', new THREE.BufferAttribute(PO, 4));
  geo.setAttribute('aSrc', new THREE.BufferAttribute(SR, 4));
  geo.setAttribute('aColor', new THREE.BufferAttribute(CO, 3));
  geo.setIndex(new THREE.BufferAttribute(IX, 1));
  geo.computeBoundingSphere();
  const uniforms = { uGain: { value: new THREE.Vector4() }, uFogD: { value: 0 } };
  const mat = new THREE.ShaderMaterial({ uniforms, vertexShader: VS, fragmentShader: FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -8, fog: false });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'tokyo_light_pools';
  mesh.frustumCulled = false; mesh.renderOrder = 1; mesh.castShadow = mesh.receiveShadow = false;
  mesh.layers.set(NO_MIRROR);            // it lies on the mirror plane: nothing to reflect
  mesh.matrixAutoUpdate = false;
  scene.add(mesh);
  const counts = [0, 0, 0, 0]; pools.forEach((p) => counts[p.kind]++);
  console.info(`tokyo light pools: ${pools.length} (lamps ${counts[0]}, neon ${counts[1]}, warm ${counts[2]}, tunnel ${counts[3]}), ${ni / 3} tris, ${Math.round(performance.now() - t0)} ms`);
  return {
    pools,
    setLook(look, params) {
      const dn = look.dn ?? 1, night = THREE.MathUtils.smoothstep(dn, 0.35, 1), wet = 1 - 0.6 * THREE.MathUtils.smoothstep(params?.wet ?? 0, 0.25, 1);   // water darkens what it soaks: the reflections carry a wet road
      uniforms.uGain.value.set(look.lights * 0.16, night * 0.3, night * 0.07, dn > 0.85 ? 0.035 : 0.09 - 0.05 * dn).multiplyScalar(wet);   // the tunnel is lit by day too, brighter than at night
    },
    update() { uniforms.uFogD.value = scene.fog?.density ?? 0; },
    dispose() { scene.remove(mesh); geo.dispose(); mat.dispose(); },
  };
}
