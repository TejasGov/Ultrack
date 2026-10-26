// The easter egg: giant holographic projections of the three original anime characters (tracks/tokyo/textures/anime, PROVENANCE.md),
// standing on projector discs beside the circuit. Each is a Y-axis billboard with its own additive shader (the character's colours kept,
// pulled toward a cyan/violet tint; scanlines in figure space that fade out before they alias; an alpha-edge rim and halo; a slow
// vertical bob; a smooth interference band that sweeps down every ~7 s), a ground disc with rings and a faint additive light cone.
// Nothing blinks: every animated term is a smooth function of time with a period of 4 s or more.
//
// The six track.json `holograms` anchors are the design intent; two of them hang over the lane and one is 120 m from the road, so the
// figures stand at the nearest spots the driver sees them from and that are free of buildings (checked against the venue geometry and the
// collision walls): the base is >= 19 m from the centerline, beyond the barriers and their sponsor boards, and the figure never overhangs the road.
import * as THREE from 'three';

const DIR = '/assets/tokyo/holo/';
const FILES = { marshal: 'holo_01_marshal.webp', driver: 'holo_02_driver.webp', idol: 'holo_03_idol.webp' };
// base: where the projector stands (game coords, y = ground); h: figure height in m; anchor: the track.json hologram it stands in for;
// seen from: the centerline indices it is visible from, as measured on the venue geometry
export const HOLOS = [
  { id: 'tunnel-exit', anchor: 1, char: 'marshal', base: [-538, 3.3, -423], h: 12 },     // on the rim of the cut where the road climbs out of the tunnel, seen from idx 1090-1145
  { id: 'bridge-approach', anchor: 6, char: 'driver', base: [-280, 25.2, -731], h: 12 },     // beside the viaduct before the bridge, idx 599-661
  { id: 'neon-street', anchor: 5, char: 'idol', base: [465, 7.1, -379], h: 12 },            // the neon street's entrance, idx 184-224
];
const ASPECT = 576 / 1024;
const PAD = 0.12;                                   // the quad is larger than the picture so the halo has room

const NIGHT = new THREE.Color('#19e3ff'), VIOLET = new THREE.Color('#7a3cff');
const shared = { uTime: { value: 0 }, uK: { value: 1 }, uGain: { value: 1 }, uSat: { value: 1 }, uCyan: { value: NIGHT }, uViolet: { value: VIOLET } };   // uK: opacity of the whole projection, uGain: its HDR brightness

const FOG = /* glsl */`
#if defined(USE_FOG) && defined(FOG_EXP2)
  float fogF = 1.0 - exp(-fogDensity * fogDensity * vFogDepth * vFogDepth);
#else
  float fogF = 0.0;
#endif
`;

const FIGURE_VS = /* glsl */`
  #include <fog_pars_vertex>
  uniform vec2 uSize; uniform float uSeed, uTime;
  varying vec2 vUv; varying float vDist;
  void main() {
    vec3 origin = (modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
    vec2 toCam = cameraPosition.xz - origin.xz;
    toCam = dot(toCam, toCam) > 1e-6 ? normalize(toCam) : vec2(0.0, 1.0);
    vec3 right = vec3(toCam.y, 0.0, -toCam.x);                      // up x facing: the quad turns about Y only
    float bob = sin((uTime + uSeed * 9.0) * 1.2) * 0.16;             // 5.2 s period
    vec3 wp = origin + right * (position.x * uSize.x) + vec3(0.0, position.y * uSize.y + 0.3 + bob, 0.0);
    vUv = vec2(position.x + 0.5, position.y);
    vDist = distance(cameraPosition, wp);
    vec4 mv = viewMatrix * vec4(wp, 1.0);
    #ifdef USE_FOG
      vFogDepth = -mv.z;
    #endif
    gl_Position = projectionMatrix * mv;
  }`;

const FIGURE_FS = /* glsl */`
  #include <fog_pars_fragment>
  uniform sampler2D map; uniform vec2 uTexel; uniform float uTime, uK, uGain, uSat, uSeed, uLines;
  uniform vec3 uCyan, uViolet;
  varying vec2 vUv; varying float vDist;
  float inside(vec2 p) { vec2 e = smoothstep(vec2(0.0), vec2(0.004), p) * (1.0 - smoothstep(vec2(0.996), vec2(1.0), p)); return e.x * e.y; }
  float alphaAt(vec2 p) { return texture2D(map, p).a * inside(p); }
  void main() {
    // interference band: sweeps from above the head to below the feet every 7.5 s; a gaussian, so it never pops
    float period = 7.5, ph = fract((uTime + uSeed * period) / period);
    float bandY = 1.2 - ph * 1.45, dB = vUv.y - bandY, g = exp(-dB * dB / (2.0 * 0.045 * 0.045));
    vec2 uv = vUv; uv.x += g * 0.011 * sin(vUv.y * 55.0 + uTime * 1.3);
    vec4 tex = texture2D(map, uv);
    float a = tex.a * inside(uv);
    // soft alpha edge: rim just inside the silhouette, halo just outside it
    // (the radius is at least 2.5 screen pixels, so the glow outline survives distance: at 100 m a texel is a twentieth of a pixel)
    vec2 r = min(max(uTexel * 7.0, 2.5 * vec2(fwidth(vUv.x), fwidth(vUv.y))), vec2(0.05));
    float blur = (alphaAt(uv + vec2(r.x, 0.0)) + alphaAt(uv - vec2(r.x, 0.0)) + alphaAt(uv + vec2(0.0, r.y)) + alphaAt(uv - vec2(0.0, r.y))
                + alphaAt(uv + r * 0.7) + alphaAt(uv - r * 0.7) + alphaAt(uv + vec2(r.x, -r.y) * 0.7) + alphaAt(uv + vec2(-r.x, r.y) * 0.7)) * 0.125;
    float rim = a * (1.0 - blur), halo = (1.0 - a) * blur;
    vec3 c = tex.rgb;
    float lum = dot(c, vec3(0.299, 0.587, 0.114));
    vec3 tint = mix(uCyan, uViolet, smoothstep(0.1, 1.0, uv.y));
    vec3 col = mix(c, tint * (0.22 + 1.5 * lum), 0.48);                // the character stays readable, the light is the hologram's
    col = max(mix(vec3(dot(col, vec3(0.2126, 0.7152, 0.0722))), col, uSat), 0.0);   // deeper colour after dark: additive over the neon it went pale
    // scanlines in figure space (so they drift with the figure, not the screen); gone before they would alias
    float sl = uv.y * uLines - uTime * 2.4, fw = fwidth(sl);
    float amp = 0.30 * (1.0 - smoothstep(0.16, 0.45, fw));
    col *= 1.0 - amp * (0.5 + 0.5 * sin(6.2831853 * sl));
    float breathe = 0.93 + 0.07 * sin(uTime * 0.9 + uSeed * 6.0);       // 7 s
    col = col * breathe + uCyan * (rim * 1.3 + halo * 0.8) + tint * g * a * 0.4;
    float alpha = clamp(a * 0.94 + rim * 0.3 + halo * 0.5, 0.0, 1.0) * uK;
    alpha *= smoothstep(7.0, 18.0, vDist) * (1.0 - smoothstep(380.0, 560.0, vDist));
    ${FOG}
    gl_FragColor = vec4(col * uGain * (1.0 - fogF), alpha);
  }`;

const DISC_FS = /* glsl */`
  #include <fog_pars_fragment>
  uniform float uTime, uK, uGain, uSeed; uniform vec3 uCyan, uViolet;
  varying vec2 vUv; varying float vDist;
  void main() {
    vec2 p = vUv * 2.0 - 1.0; float d = length(p), ang = atan(p.y, p.x + 1e-5);
    float core = exp(-d * d * 3.2) * 0.55;
    float ring = smoothstep(0.045, 0.0, abs(d - 0.92)) * 0.9;
    float seg = smoothstep(0.1, 0.5, sin(ang * 18.0 + uTime * 0.35)) * smoothstep(0.05, 0.0, abs(d - 0.7)) * 0.5;   // slow dashes, 18 s per turn
    float inner = smoothstep(0.03, 0.0, abs(d - 0.45)) * 0.28;
    float v = (core + ring + seg + inner) * (1.0 - smoothstep(0.88, 1.0, d)) + ring * 0.4;
    vec3 col = mix(uCyan, uViolet, 0.28 + 0.2 * sin(uTime * 0.5 + uSeed * 6.0));
    ${FOG}
    gl_FragColor = vec4(col * 1.25 * (0.4 + 0.6 * uGain) * (1.0 - fogF), clamp(v, 0.0, 1.0) * uK * (1.0 - smoothstep(380.0, 560.0, vDist)));
  }`;

const CONE_FS = /* glsl */`
  #include <fog_pars_fragment>
  uniform float uTime, uK, uGain, uSeed; uniform vec3 uCyan, uViolet;
  varying vec2 vUv; varying vec3 vN; varying vec3 vV; varying float vDist;
  void main() {
    float up = vUv.y;                                               // 0 at the disc, 1 at the figure's head
    float facing = abs(dot(normalize(vN), normalize(vV)));
    float side = pow(facing, 1.6);                                  // a soft edge: a volume, not a tube
    float drift = 0.85 + 0.15 * sin(up * 9.0 - uTime * 0.8 + uSeed * 6.0);
    float v = pow(clamp(1.0 - up, 0.0, 1.0), 1.5) * side * drift;
    vec3 col = mix(uCyan, uViolet, up * 0.8);
    ${FOG}
    gl_FragColor = vec4(col * (0.4 + 0.6 * uGain) * (1.0 - fogF), v * 0.26 * uK * (1.0 - smoothstep(380.0, 560.0, vDist)));
  }`;

const FLAT_VS = /* glsl */`
  #include <fog_pars_vertex>
  varying vec2 vUv; varying vec3 vN; varying vec3 vV; varying float vDist;
  void main() {
    vUv = uv;
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vN = normalize(mat3(modelMatrix) * normal); vV = cameraPosition - wp.xyz; vDist = length(vV);
    vec4 mv = viewMatrix * wp;
    #ifdef USE_FOG
      vFogDepth = -mv.z;
    #endif
    gl_Position = projectionMatrix * mv;
  }`;

const mat = (vs, fs, extra) => new THREE.ShaderMaterial({
  vertexShader: vs, fragmentShader: fs, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: true,
  uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uSeed: { value: 0 } }, extra]),
});
const share = (m) => { for (const k of ['uTime', 'uK', 'uGain', 'uSat', 'uCyan', 'uViolet']) if (m.uniforms[k]) m.uniforms[k] = shared[k]; return m; };

export async function create(ctx) {
  const loader = new THREE.TextureLoader();
  const group = new THREE.Group(); group.name = 'tokyo-holograms';
  const quad = new THREE.PlaneGeometry(1 + 2 * PAD, 1 + 2 * PAD); quad.translate(0, 0.5, 0);   // origin at the feet
  const cone = new THREE.CylinderGeometry(1, 1, 1, 40, 1, true); cone.translate(0, 0.5, 0);
  const disc = new THREE.CircleGeometry(1, 56); disc.rotateX(-Math.PI / 2);
  const textures = {}, mats = [], holos = [];
  for (const [k, file] of Object.entries(FILES)) {
    if (!HOLOS.some((h) => h.char === k)) continue;
    try {
      const t = await loader.loadAsync(DIR + file);
      t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter;
      textures[k] = t;
    } catch (e) { console.warn('hologram texture skipped:', file, e); }
  }
  HOLOS.forEach((h, i) => {
    const map = textures[h.char]; if (!map) return;
    const H = h.h, W = H * ASPECT, R = Math.max(2.4, W * 0.5), seed = (i * 0.37 + 0.11) % 1;
    const fig = share(mat(FIGURE_VS, FIGURE_FS, {
      map: { value: map }, uTexel: { value: new THREE.Vector2(1 / 576, 1 / 1024) }, uSize: { value: new THREE.Vector2(W, H) }, uLines: { value: 150 },
      uTime: shared.uTime, uK: shared.uK, uGain: shared.uGain, uSat: shared.uSat, uCyan: shared.uCyan, uViolet: shared.uViolet,
    }));
    fig.uniforms.map.value = map;                                  // UniformsUtils.merge clones textures: keep the loaded one
    fig.uniforms.uSeed.value = seed;
    const dsk = share(mat(FLAT_VS, DISC_FS, { uTime: shared.uTime, uK: shared.uK, uGain: shared.uGain, uCyan: shared.uCyan, uViolet: shared.uViolet })); dsk.uniforms.uSeed.value = seed;
    const con = share(mat(FLAT_VS, CONE_FS, { uTime: shared.uTime, uK: shared.uK, uGain: shared.uGain, uCyan: shared.uCyan, uViolet: shared.uViolet })); con.uniforms.uSeed.value = seed;
    dsk.polygonOffset = true; dsk.polygonOffsetFactor = -2; dsk.polygonOffsetUnits = -2;
    mats.push(fig, dsk, con);
    const g = new THREE.Group(); g.name = 'holo-' + h.id; g.position.set(...h.base);
    const noAO = (mesh) => { mesh.onBeforeRender = (_r, scene, _c, geo) => { geo.setDrawRange(0, scene.overrideMaterial ? 0 : Infinity); }; return mesh; };
    const f = noAO(new THREE.Mesh(quad, fig)); f.frustumCulled = false; f.renderOrder = 12;
    const d = noAO(new THREE.Mesh(disc, dsk)); d.scale.setScalar(R); d.position.y = 0.06; d.renderOrder = 10; d.frustumCulled = false;
    const c = noAO(new THREE.Mesh(cone, con)); c.scale.set(1, H * 0.95, 1); c.renderOrder = 11; c.frustumCulled = false;
    // the cone is an open frustum: narrow at the disc, as wide as the figure at its head (a CylinderGeometry has one radius, so scale it per vertex)
    const cg = cone.clone(); const pos = cg.attributes.position;
    for (let v = 0; v < pos.count; v++) { const u = pos.getY(v); const r = R * 0.8 + (W * 0.5 + 0.6 - R * 0.8) * u; pos.setX(v, pos.getX(v) * r); pos.setZ(v, pos.getZ(v) * r); }
    cg.computeVertexNormals(); c.geometry = cg;
    d.layers.set(ctx.NO_MIRROR); c.layers.set(ctx.NO_MIRROR);        // the disc and cone are glow: only the figure is worth a second draw in the wet-road mirror
    g.add(d, c, f); group.add(g); holos.push({ g, h, pos: new THREE.Vector3(...h.base).add(new THREE.Vector3(0, H * 0.5, 0)), cg });
  });
  if (!holos.length) return null;
  ctx.scene.add(group);

  const _d = new THREE.Vector3(), _f = new THREE.Vector3();
  return {
    update(t, camera) {
      shared.uTime.value = t;
      camera.getWorldDirection(_f);
      for (const o of holos) {
        _d.subVectors(o.pos, camera.position); const dist = _d.length();
        // beyond ~560 m the shader has faded it out; behind the camera nothing needs drawing (the quad is not frustum-culled: its size lives in the shader)
        o.g.visible = dist < 570 && (dist < 40 || _d.dot(_f) > -0.4 * dist);
      }
    },
    // night and evening at full strength; dusk reduced; day a faint ghost (a projection you can just make out in daylight)
    setLook(look) {
      const n = THREE.MathUtils.smoothstep(look.dn, 0.1, 0.7);
      shared.uK.value = THREE.MathUtils.lerp(0.18, 1, n); shared.uGain.value = THREE.MathUtils.lerp(0.9, 1.7, n); shared.uSat.value = THREE.MathUtils.lerp(1, 2.2, n);      // night: bright enough to out-shine the neon without burning to white
    },
    dispose() {
      ctx.scene.remove(group);
      quad.dispose(); cone.dispose(); disc.dispose(); holos.forEach((o) => o.cg.dispose());
      mats.forEach((m) => m.dispose()); Object.values(textures).forEach((t) => t.dispose());
    },
  };
}
