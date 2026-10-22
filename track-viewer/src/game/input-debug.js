export class InputDebug {
  constructor(root) {
    this.el = document.createElement('pre'); this.el.className = 'input-debug';
    this.el.setAttribute('aria-label', 'Driving input diagnostics'); root.append(this.el);
    this.elapsed = 0;
  }
  update(dt, field) {
    this.elapsed += dt; if (this.elapsed < 0.1) return; this.elapsed = 0;
    const input = field?.input, v = field?.hero?.vehicle, d = input?.debug ?? {};
    this.el.textContent = [
      'INPUT / ' + (field?.hero?.key ?? 'loading'),
      'Held: ' + ([...(input?.keys ?? [])].join(', ') || 'none'),
      'Pad: ' + (d.pad ?? 'none') + ' / ' + (d.source ?? 'neutral'),
      'Axes: ' + (d.axes?.map(n => n.toFixed(3)).join(', ') || 'none'),
      'Input steer: ' + (d.steer ?? 0).toFixed(3),
      'Wheel steer: ' + ((v?.state.steer ?? 0) * 180 / Math.PI).toFixed(2) + '°',
      'Drift: ' + (v?.state.drift ?? 0).toFixed(3) + ' / enabled: ' + !!input?.enabled,
    ].join('\n');
  }
}
