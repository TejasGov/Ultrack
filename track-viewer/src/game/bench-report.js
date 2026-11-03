// ?bench=1 on any build: drive (or sit) through 30 s of a session and get the real numbers of this machine, in a box to copy. The numbers the project
// cannot get without the player's hardware: a MacBook's GPU, its screen, its browser. Frame times are the intervals between the frames the game drew, nothing is forced.
const SECONDS = 30;

export function startBenchReport(viewer, game) {
  const box = document.createElement('textarea');
  Object.assign(box.style, { position: 'fixed', top: '12px', right: '12px', width: '360px', height: '60px', zIndex: 99999, font: '12px monospace', background: 'rgba(0,0,0,.8)', color: '#fff', border: '1px solid #666', padding: '8px' });
  box.readOnly = true; box.value = `Benchmark: start a race. It measures ${SECONDS} s from the green light.`;
  document.body.append(box);
  const frames = [], scales = [], t00 = performance.now(), render = viewer.composer.render;
  let last = 0, t0 = 0, startMs = null, on = false;
  viewer.composer.render = function (...args) {   // the frames the game really drew: rAF itself may run at 120 Hz over the game's 60 fps cap
    const now = performance.now();
    if (on) { if (last) frames.push(now - last); if (scales.at(-1)?.[1] !== viewer.params.renderScale) scales.push([+((now - t0) / 1000).toFixed(1), viewer.params.renderScale]); }
    last = now;
    return render.apply(this, args);
  };
  const step = (now) => {
    const s = game.session;
    if (startMs === null && s) startMs = game.lastLoad?.totalMs ?? 0;
    if (s?.state === 'running' && !game.raceLoading.active && !on) { on = true; t0 = now; box.value = `Benchmark: measuring for ${SECONDS} s…`; }
    if (on && now - t0 > SECONDS * 1000) { on = false; viewer.composer.render = render; return finish(); }
    requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
  function finish() {
    const r = viewer.renderer, gl = r.getContext(), sorted = [...frames].sort((a, b) => a - b), sum = (a) => a.reduce((x, y) => x + y, 0), low = sorted.slice(Math.floor(sorted.length * 0.99));
    const report = {
      gpu: viewer.device.gpu, tier: viewer.device.tier, ua: navigator.userAgent, screen: `${innerWidth}x${innerHeight}@${devicePixelRatio}`, canvas: `${gl.drawingBufferWidth}x${gl.drawingBufferHeight}`,
      gpuTimer: !!gl.getExtension('EXT_disjoint_timer_query_webgl2'), track: viewer.trackId(), look: viewer.params.look, msaa: viewer.composer.renderTarget1.samples,
      fps: +(1000 * frames.length / sum(frames)).toFixed(1), low1Fps: +(1000 * low.length / sum(low)).toFixed(1), p50Ms: +sorted[sorted.length >> 1].toFixed(1), p99Ms: +sorted[Math.floor(sorted.length * 0.99)].toFixed(1), worstMs: +sorted.at(-1).toFixed(0),
      over20: frames.filter((f) => f > 20).length, over33: frames.filter((f) => f > 33.4).length, over50: frames.filter((f) => f > 50).length, over100: frames.filter((f) => f > 100).length, frames: frames.length,
      scale: scales, draws: r.info.render.calls, trisK: Math.round(r.info.render.triangles / 1000), programs: r.info.programs.length, raceStartMs: startMs, pageToBenchS: Math.round((t0 - t00) / 1000),
    };
    box.style.height = '340px'; box.value = JSON.stringify(report, null, 1); box.select();
    console.info('Benchmark:', report);
  }
}
