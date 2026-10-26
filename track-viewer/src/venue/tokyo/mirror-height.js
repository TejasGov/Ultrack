// The wet-road mirror (main.js makeReflector) is a plane at y = 0, right for flat Marina. Tokyo's road climbs to 28 m on the bridge
// and drops to -12 m in the tunnel: there the mirror clipped away everything below y = 0 (the whole tunnel) and showed the city
// above it as bright streaks on the tunnel floor. This part keeps the plane at the road height under the camera instead: the height
// of the centerline at the 3D-nearest point, so at the crossover the level the camera is on wins (the other is >= 10 m away).
export async function create({ scene, track }) {
  const C = track.centerline, n = C.length;
  let reflector = null;
  const roadY = (p) => {
    let best = 0, bd = Infinity;
    for (let i = 0; i < n; i++) { const c = C[i], d = (c[0] - p.x) ** 2 + (c[1] - p.y) ** 2 + (c[2] - p.z) ** 2; if (d < bd) { bd = d; best = i; } }
    let y = C[best][1], sd = Infinity;        // the nearer of the two segments around it: a continuous height along the lap
    for (const j of [best - 1, best]) {
      const a = C[(j + n) % n], b = C[(j + 1) % n], dx = b[0] - a[0], dz = b[2] - a[2];
      const t = Math.min(1, Math.max(0, ((p.x - a[0]) * dx + (p.z - a[2]) * dz) / (dx * dx + dz * dz || 1)));
      const d = (a[0] + dx * t - p.x) ** 2 + (a[2] + dz * t - p.z) ** 2;
      if (d < sd) { sd = d; y = a[1] + (b[1] - a[1]) * t; }
    }
    return y;
  };
  return {
    update(t, camera) {
      if (!reflector?.parent) reflector = scene.children.find((o) => o.isReflector) ?? null;   // main.js rebuilds it on a resolution change
      if (reflector) reflector.position.y = roadY(camera.position);   // main.js updates the matrices after the venue effects, before rendering
    },
    dispose() { if (reflector) reflector.position.y = 0; },
  };
}
