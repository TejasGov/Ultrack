// Clouds and sky shading over the Poly Haven background: a camera-centred dome drawn behind everything.
// - clouds: three octaves of value noise projected onto a cloud deck ~1.5 km up, drifting with the wind, thinning to
//   haze at the horizon; lit by the look (day: white tops, blue-grey undersides; dusk: warm undersides, silver toward the sun; blue hour: cool grey; night: the
//   city's sodium glow from below, dark tops)
// - horizon glow: a light-pollution band so the skyline stands in haze, not in a black void
// Values are HDR (the background is too), tone-mapped with the scene.
import * as THREE from 'three';

export const SKY_LOOKS = {
  //            cover  lit (sunward)        shade (underside)     haze/horizon glow     zenith tint            glow height
  // sun: the disc and its glow through the haze (golden hour backlight; none at night)
  dusk:     { cover: 0.56, lit: [2.0, 1.05, 0.55], shade: [0.16, 0.13, 0.2], haze: [0.9, 0.5, 0.32], zenith: [0.0, 0.0, 0.0], glowH: 0.14, alpha: 0.97, sun: [3.2, 1.7, 0.75] },
  bluehour: { cover: 0.52, lit: [0.32, 0.36, 0.52], shade: [0.07, 0.08, 0.14], haze: [0.38, 0.3, 0.32], zenith: [0.0, 0.01, 0.03], glowH: 0.12, alpha: 0.9, sun: [0.35, 0.3, 0.36] },
  // day: a few fair-weather cumulus, lit white from above with blue-grey undersides; the HDRI's own sun disc does the sun
  day:      { cover: 0.34, lit: [1.9, 1.92, 2.0], shade: [0.5, 0.57, 0.7], haze: [0.3, 0.38, 0.5], zenith: [0.0, 0.0, 0.0], glowH: 0.1, alpha: 0.88, sun: [0.7, 0.66, 0.55] },
  night:    { cover: 0.56, lit: [0.16, 0.1, 0.06], shade: [0.012, 0.014, 0.022], haze: [0.11, 0.065, 0.035], zenith: [0.0, 0.0, 0.006], glowH: 0.09, alpha: 0.92, sun: [0, 0, 0] },
};

export class Sky {
  constructor(sunDir) {
    this.uniforms = {
      uTime: { value: 0 }, uSun: { value: sunDir.clone().normalize() }, uCover: { value: 0.5 }, uAlpha: { value: 0.9 },
      uLit: { value: new THREE.Color() }, uShade: { value: new THREE.Color() }, uHaze: { value: new THREE.Color() },
      uZenith: { value: new THREE.Color() }, uSunCol: { value: new THREE.Color() }, uGlowH: { value: 0.1 }, uWind: { value: new THREE.Vector2(0.006, 0.0025) },
    };
    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms, side: THREE.BackSide, depthWrite: false, transparent: true, fog: false,
      vertexShader: /* glsl */`
        varying vec3 vDir;
        void main() {
          vDir = normalize((modelMatrix * vec4(position, 1.0)).xyz - cameraPosition);
          gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: /* glsl */`
        uniform float uTime, uCover, uAlpha, uGlowH; uniform vec3 uSun, uLit, uShade, uHaze, uZenith, uSunCol; uniform vec2 uWind;
        varying vec3 vDir;
        float h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float n(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
          return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y); }
        float fbm(vec2 p) { float a = 0.5, s = 0.0; for (int i = 0; i < 5; i++) { s += a * n(p); p = p * 2.03 + 17.1; a *= 0.5; } return s; }
        void main() {
          vec3 d = normalize(vDir);
          float e = d.y;
          // horizon glow and zenith tint (additive over the HDRI)
          float glow = exp(-max(e, 0.0) / uGlowH) * smoothstep(-0.08, 0.02, e);
          vec3 add = uHaze * glow + uZenith * smoothstep(0.1, 0.9, e);
          float sd = max(dot(d, uSun), 0.0);                                   // disc, then a wide warm bloom through the haze
          add += uSunCol * (smoothstep(0.99985, 0.99993, sd) * 14.0 + pow(sd, 90.0) * 0.9 + pow(sd, 12.0) * 0.12);
          vec3 cloud = vec3(0.0);
          float a = 0.0;
          if (e > 0.0) {
            // cloud deck: project the view ray onto a plane, stretch along the wind
            vec2 uv = d.xz / (e + 0.06) * 1.6 + uWind * uTime;
            float base = fbm(uv * vec2(1.0, 1.6));
            float detail = fbm(uv * 4.3 + 3.7) * 0.35;
            float dens = smoothstep(1.0 - uCover, 1.0 - uCover + 0.28, base + detail * 0.6 - 0.15);
            dens *= smoothstep(0.0, 0.12, e);                                  // thin into haze at the horizon
            // light: thicker = darker underside; toward the sun = bright silver/warm rims
            float thick = clamp((base + detail - (1.0 - uCover)) * 1.8, 0.0, 1.0);
            float sunward = pow(max(dot(d, uSun), 0.0), 6.0);
            vec3 c = mix(uLit, uShade, thick * 0.85) + uLit * sunward * (1.0 - thick) * 1.5;
            c = mix(c, uHaze, (1.0 - smoothstep(0.0, 0.25, e)) * 0.6);         // aerial perspective near the horizon
            cloud = c;
            a = dens * uAlpha;
          }
          // premultiplied: clouds cover the background by a; the glow adds light where there is no cloud
          gl_FragColor = vec4(cloud * a + add * (1.0 - a), a);
        }`,
    });
    // premultiplied: rgb added on top of the background, alpha darkens what is behind the clouds
    mat.blending = THREE.CustomBlending;
    mat.blendSrc = THREE.OneFactor;
    mat.blendDst = THREE.OneMinusSrcAlphaFactor;
    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(8500, 48, 24), mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = -10;
    this.mesh.name = 'sky_clouds';
  }

  setLook(name) {
    const L = SKY_LOOKS[name] || SKY_LOOKS.night;
    this.uniforms.uCover.value = L.cover;
    this.uniforms.uAlpha.value = L.alpha;
    this.uniforms.uLit.value.setRGB(...L.lit);
    this.uniforms.uShade.value.setRGB(...L.shade);
    this.uniforms.uHaze.value.setRGB(...L.haze);
    this.uniforms.uZenith.value.setRGB(...L.zenith);
    this.uniforms.uSunCol.value.setRGB(...L.sun);
    this.uniforms.uGlowH.value = L.glowH;
  }

  update(t, camera) {
    this.uniforms.uTime.value = t;
    this.mesh.position.copy(camera.position);
  }
}
