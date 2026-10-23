// Shipping-side performance: quality tiers (auto-picked from the device), dynamic resolution held to a frame budget,
// distance culling (whole small meshes, and per instance inside GPU-instanced sets like palms and lamps), and a GPU
// timer (EXT_disjoint_timer_query_webgl2) that measures real GPU milliseconds, so numbers do not depend on rAF throttling.
import * as THREE from 'three';

// High uses 2x MSAA and keeps wet reflections; expensive AO and extra shadows are reserved for Ultra.
export const TIERS = {
  //        render scale (max)   pixel ratio cap   shadows  AO     mirror (res)   bloom  SMAA   rain   cull distance per metre of radius
  low:    { scale: 0.7,  pr: 1.0, shadows: false, ao: false, mirror: false, mirrorRes: 0.25, bloom: true, smaa: false, rain: 0.25, cull: 90, msaa: 0 },
  medium: { scale: 0.85, pr: 1.25, shadows: true, ao: false, mirror: true, mirrorRes: 0.35, bloom: true, smaa: true, rain: 0.4, cull: 160, msaa: 2 },
  high:   { scale: 1.0,  pr: 1.5, shadows: true,  ao: false, mirror: true, mirrorRes: 0.36, bloom: true, smaa: false, rain: 0.45, cull: 280, msaa: 2 },
  ultra:  { scale: 1.0,  pr: 2.0, shadows: true,  ao: true,  mirror: true, mirrorRes: 0.75, bloom: true, smaa: true, rain: 0.5, cull: 600, msaa: 4 },
};

/** A first guess from the device: phones and integrated GPUs start low/medium, discrete GPUs high (ultra is opt-in). */
export function detectTier(renderer) {
  const gl = renderer.getContext();
  const ext = gl.getExtension('WEBGL_debug_renderer_info');
  const gpu = (ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER)) || '';
  const mobile = navigator.userAgentData?.mobile ?? /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent);
  let tier = 'high';
  if (mobile) tier = /Apple GPU|Adreno \(TM\) 7[3-9]\d|Mali-G7[1-9]|Immortalis/i.test(gpu) ? 'medium' : 'low';
  else if (/Intel|UHD|Iris|Vega \d+ Graphics|Radeon\(TM\) Graphics|Mali|Adreno|SwiftShader|llvmpipe|Basic Render/i.test(gpu)) tier = 'medium';
  // ultra is opt-in only: auto never picks it (2x pixel ratio and a 0.75 mirror run hot for little visible gain)
  return { tier, gpu, mobile };
}

// ------------------------------------------------------------------------------------------------ GPU timer

export class GpuTimer {
  constructor(renderer) {
    this.gl = renderer.getContext();
    this.ext = this.gl.getExtension('EXT_disjoint_timer_query_webgl2');
    this.pending = [];
    this.ms = NaN;            // last measured GPU time of a frame
  }
  get supported() { return !!this.ext; }
  begin() {
    if (!this.ext || this.active) return;
    const q = this.gl.createQuery();
    this.gl.beginQuery(this.ext.TIME_ELAPSED_EXT, q);
    this.active = q;
  }
  end() {
    if (!this.active) return;
    this.gl.endQuery(this.ext.TIME_ELAPSED_EXT);
    this.pending.push(this.active);
    this.active = null;
    this.poll();
  }
  poll() {
    const gl = this.gl;
    while (this.pending.length) {
      const q = this.pending[0];
      if (!gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE)) break;
      const disjoint = gl.getParameter(this.ext.GPU_DISJOINT_EXT);
      if (!disjoint) this.ms = gl.getQueryParameter(q, gl.QUERY_RESULT) / 1e6;
      gl.deleteQuery(q);
      this.pending.shift();
    }
  }
}

// ------------------------------------------------------------------------------------------------ distance culling

/**
 * Hides meshes that would cover a few pixels at most: visible while distance < radius * k. Instanced sets are culled
 * per instance by compacting their instance matrices (count shrinks), so a palm 2 km away costs nothing.
 * Large objects (track chunks, ground, skyline, water) are never culled.
 * Distance tiers (Tokyo v13.1): a mesh or instanced set whose name carries `~lo-hi` (metres, hi optional) is visible only while its
 * distance is inside that range, so full-detail and lower-poly copies of the same object swap without the 280 x radius rule
 * (which never culls a 25 m frontage inside a 3 km circuit). A tagged set is culled per instance even with fewer than 6 instances.
 * Far stand-ins: an instanced set whose material name ends in "Far" (the trackside truss modules' solid boxes) sits at
 * the same positions as a detailed set with the same bounds. Per instance it shows exactly where the detailed one is
 * culled (from 1.2x its distance, until it comes back inside 1x), out to FAR x that distance, so far trusses cost one
 * box each and near ones keep every member.
 */
const FAR = 8;
const TIER = /~(\d+)-(\d*)/;
const tierOf = (o) => { const m = TIER.exec(o.name || '') ?? TIER.exec(o.parent?.name || ''); return m ? { lo: +m[1], hi: m[2] ? +m[2] : Infinity } : null; };
export class Culler {
  constructor(root) {
    this.items = [];
    this.sets = [];
    const sphere = new THREE.Sphere();
    root.updateMatrixWorld(true);
    root.traverse((o) => {
      if (!o.isMesh || !o.geometry || o.userData.sceneryLodManaged) return;
      if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere();
      const tier = tierOf(o);
      if (o.isInstancedMesh) {
        if (o.count < 6 && !tier) return;
        // a multi-material object arrives as sibling InstancedMeshes (mast, lamp units, beacon): cull them all by the
        // biggest, or the small parts vanish first and their glows float in the sky
        let r = o.geometry.boundingSphere.radius;
        for (const sib of o.parent?.children ?? []) if (sib.isInstancedMesh && sib.geometry) {
          if (!sib.geometry.boundingSphere) sib.geometry.computeBoundingSphere();
          r = Math.max(r, sib.geometry.boundingSphere.radius);
        }
        const src = new Float32Array(o.instanceMatrix.array.subarray(0, o.count * 16));
        const pos = new Float32Array(o.count * 3);
        const m = new THREE.Matrix4(), p = new THREE.Vector3();
        for (let k = 0; k < o.count; k++) {
          m.fromArray(src, k * 16).premultiply(o.matrixWorld);
          p.setFromMatrixPosition(m);
          pos.set([p.x, p.y, p.z], k * 3);
        }
        const far = [].concat(o.material).some((m) => /Far$/.test(m.name));
        this.sets.push({ o, src, pos, r, total: o.count, far, tier });
        o.frustumCulled = false;     // its bounding sphere spans the whole venue anyway
        return;
      }
      sphere.copy(o.geometry.boundingSphere).applyMatrix4(o.matrixWorld);
      if (tier) { this.items.push({ o, c: sphere.center.clone(), r: Math.max(sphere.radius, 0.5), tier }); return; }
      if (sphere.radius > 45) return;
      this.items.push({ o, c: sphere.center.clone(), r: Math.max(sphere.radius, 0.5) });
    });
    this.k = 280;
  }
  update(cam) {
    let hidden = 0, culledInstances = 0;
    const H = 1.2 ** 2;                       // hysteresis: hide beyond 1.2x the show distance, so nothing blinks
    for (const it of this.items) {
      if (it.o.userData.replaced) { it.o.visible = false; continue; }    // placeholders swapped for real characters
      const d = it.c.distanceToSquared(cam), lim = (it.r * this.k) ** 2;
      let v;
      if (it.tier) { const t = it.tier; v = it.o.visible ? d >= (t.lo / 1.1) ** 2 && d < (t.hi * 1.1) ** 2 : d >= t.lo ** 2 && d < t.hi ** 2; }
      else v = it.o.visible ? d < lim * H : d < lim;
      it.o.visible = v;
      if (!v) hidden++;
    }
    for (const s of this.sets) {
      if (s.o.userData.replaced) { s.o.visible = false; continue; }
      const lim = (s.r * this.k) ** 2, arr = s.o.instanceMatrix.array;
      if (!s.on) s.on = new Uint8Array(s.total).fill(s.far ? 0 : 1);
      if(!s.order)s.order=new Uint32Array(s.total).fill(0xffffffff);
      let n = 0,changed=false;
      for (let k = 0; k < s.total; k++) {
        const dx = s.pos[k * 3] - cam.x, dy = s.pos[k * 3 + 1] - cam.y, dz = s.pos[k * 3 + 2] - cam.z;
        const d = dx * dx + dy * dy + dz * dz;
        // the mirror image of the detailed set's hysteresis, so the two swap on the same update and never both show
        if (s.tier) { const t = s.tier; s.on[k] = s.on[k] ? d >= (t.lo / 1.1) ** 2 && d < (t.hi * 1.1) ** 2 : d >= t.lo ** 2 && d < t.hi ** 2; }
        else if (s.far) s.on[k] = (s.on[k] ? d >= lim : d >= lim * H) && d < lim * FAR * FAR;
        else s.on[k] = s.on[k] ? d < lim * H : d < lim;
        if (s.on[k]) {
          if(s.order[n]!==k){changed=true;s.order[n]=k;arr.set(s.src.subarray(k*16,k*16+16),n*16);}
          n++;
        }
      }
      if (changed||n!==s.o.count) { s.o.count = n; s.o.instanceMatrix.needsUpdate = true; }
      culledInstances += s.total - n;
    }
    return { hidden, culledInstances };
  }
}

// ------------------------------------------------------------------------------------------------ dynamic resolution

/** Nudges render scale so GPU (or frame) time stays under budget; steps are small and slow so it never pumps. */
export class DynamicResolution {
  constructor({ budgetMs = 16.6, min = 0.5, max = 1.0 } = {}) {
    Object.assign(this, { budgetMs, min, max, acc: 0, n: 0, t: 0, lastUp: 0, clock: 0 });
  }
  sample(ms, dt) { if (Number.isFinite(ms)) { this.acc += ms; this.n++; } this.t += dt; this.clock += dt; }
  /** Returns a new scale when it should change, otherwise null. */
  decide(scale) {
    // judged over 4 s; down only when clearly over budget, up only when well under it and not within 15 s of a change
    // (every change resizes the frame, and frequent ones made distant lights shimmer)
    if (this.t < 4 || !this.n) return null;
    const avg = this.acc / this.n;
    this.acc = this.n = this.t = 0;
    if (avg > this.budgetMs * 1.2 && scale > this.min) { this.lastUp = this.clock; return Math.max(this.min, +(scale - 0.1).toFixed(2)); }
    if (avg < this.budgetMs * 0.6 && scale < this.max && this.clock - this.lastUp > 15) { this.lastUp = this.clock; return Math.min(this.max, +(scale + 0.05).toFixed(2)); }
    return null;
  }
}
