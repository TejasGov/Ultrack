// Background music: HTMLAudioElements (streamed, never decoded) -> per-track fade gain -> context level -> music bus.
// Contexts: menu (every non-race screen) loops one track; race plays the shuffled race tracks one after another, quieter
// so the engines stay clear, and halves when paused; results loops its own track. A context change crossfades.
import TRACKS from '../../../assets/audio/music/credits.json';
const A = '/assets/audio/', FADE = 1.5, LEVEL = { menu: 1, race: 0.6, results: 1 };
const byContext = (c) => TRACKS.filter((t) => t.context === c).map((t) => A + t.file);

export class Music {
  constructor(ctx, bus) {
    this.ctx = ctx; this.ctxName = null; this.queue = [];
    this.level = ctx.createGain(); this.level.connect(bus);
    this.slots = [0, 1].map(() => { const el = new Audio(); el.crossOrigin = 'anonymous'; el.preload = 'auto'; const gain = ctx.createGain(); gain.gain.value = 0; ctx.createMediaElementSource(el).connect(gain).connect(this.level); return { el, gain }; });
    this.cur = this.slots[0]; this.old = this.slots[1];
    for (const s of this.slots) s.el.addEventListener('ended', () => { if (s === this.cur && this.ctxName === 'race') this.next(); });
  }

  /** called every frame with the wanted context; cheap when nothing changed */
  update(name, paused = false) {
    const t = this.ctx.currentTime;
    if (name !== this.ctxName) { this.ctxName = name; this.queue = []; this.next(); }
    this.level.gain.setTargetAtTime(LEVEL[name] * (paused ? 0.5 : 1), t, 0.15);
  }

  next() {
    const t = this.ctx.currentTime, name = this.ctxName;
    if (!this.queue.length) { this.queue = byContext(name); if (name === 'race') this.queue.sort(() => Math.random() - 0.5); }   // shortcut: a plain shuffle, not seeded per race
    const [src] = this.queue.splice(0, 1); if (!src) return;
    const out = this.cur, inn = this.old;
    inn.el.pause(); inn.gain.gain.cancelScheduledValues(t);   // the slot being reused was already faded out (or is cut: no third player ever stacks)
    inn.el.src = src; inn.el.loop = name !== 'race' ; inn.el.currentTime = 0;
    inn.el.play().catch(() => {});
    inn.gain.gain.setValueAtTime(0, t); inn.gain.gain.linearRampToValueAtTime(1, t + FADE);
    out.gain.gain.cancelScheduledValues(t); out.gain.gain.setValueAtTime(out.gain.gain.value, t); out.gain.gain.linearRampToValueAtTime(0, t + FADE);
    setTimeout(() => { if (this.old === out) out.el.pause(); }, FADE * 1000 + 100);
    this.cur = inn; this.old = out;
  }
}
