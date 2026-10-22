import './race-loading.css';

export const LOADING_SLIDES = [
  { image: 'broadcast.webp', kicker: 'THE VOICES OF ULTRACK', title: 'Two voices.\nOne obsession.', text: 'Enzo Moretti raced before he called races. Alastair Finch engineered them. One remembers every brave overtake. The other remembers exactly how much fuel it wasted.' },
  { image: 'starting-line.webp', kicker: 'CORNICHE MARINA · AFTER HOURS', title: 'The city\nholds its breath.', text: 'The cafés stay open on race night. Mechanics lean over the pit wall. For the people who live along the Corniche, the first engine note is the start of the evening.' },
  { image: 'broadcast.webp', kicker: 'ENZO MORETTI · PLAY-BY-PLAY', title: 'A racer,\nwith a microphone.', text: 'Above his father’s tyre shop near Parma, Enzo dreamed of the grid. A broken wrist ended his junior racing career at 22. Twenty-five years in the commentary box have done nothing to cool his love of late braking.' },
  { image: 'hairpin.webp', kicker: 'THE JIM CLARK STAND', title: 'Every seat\nhas a story.', text: 'A father explains the racing line. His daughter watches the driver taking the other one. The same corner creates a different favourite every season.', tip: 'Brake before the corner. Ease off the pedal as you turn, then build throttle on the exit.' },
  { image: 'broadcast.webp', kicker: 'ALASTAIR FINCH · RACE ANALYST', title: 'Precision.\nWith a dry finish.', text: 'Eleven years on endurance pit walls taught Finch to count fuel and distrust excuses. At home he restores old clocks—forty-one at last count. He says Enzo is the only thing he has never managed to slow down.' },
];
export const LOAD_STAGES = ['Circuit', 'Grid', 'Track physics', 'Audio', 'Graphics'];

/** Images and CSS compositor animations only: no 3D scene is rendered behind this screen.
 * No artificial minimum wait; stages advance only when their actual promises complete. */
export class RaceLoading {
  constructor(root) { this.root = root; this.active = false; }
  preload() {
    if(this.preloaded)return;
    this.preloaded=new Image();this.preloaded.src='/assets/loading/broadcast.webp';
  }
  async open({ mode = 'race', reduceMotion = false, track = 'Corniche Marina', onCancel } = {}) {
    this.close(); this.active = true; this.done = new Set(); this.started = performance.now();
    this.previousFocus = document.activeElement;
    const el = this.el = document.createElement('section');
    el.className = 'race-loading' + (reduceMotion ? ' still' : '');
    el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', 'Preparing race');
    const art = document.createElement('div'); art.className = 'race-loading-stories';
    LOADING_SLIDES.forEach((slide, index) => {
      const frame = document.createElement('article'); frame.className = 'race-loading-slide';
      frame.style.setProperty('--slide', index);
      const image = new Image(); image.src = `/assets/loading/${slide.image}`; image.alt = ''; image.decoding = 'async';
      image.onerror = () => image.remove(); // Dark art-directed background and text remain usable offline.
      const copy = document.createElement('div'); copy.className = 'race-loading-copy';
      for (const [tag, text] of [['p', slide.kicker], ['h1', slide.title], ['p', slide.text]]) {
        const node = document.createElement(tag); node.textContent = text; copy.append(node);
      }
      if (slide.tip) { const tip = document.createElement('aside'); tip.textContent = slide.tip; copy.append(tip); }
      frame.append(image, copy); art.append(frame);
    });
    const mast = document.createElement('header');
    const logo = new Image(); logo.src = '/assets/brand/ultrack-alpha.webp'; logo.alt = 'Ultrack';
    const event = document.createElement('span'); event.textContent = `${track.toUpperCase()}\n${mode === 'race' ? 'SEVEN TEAMS. ONE GRID.' : mode.replaceAll('_', ' ').toUpperCase()}`;
    mast.append(logo, event);
    const foot = document.createElement('footer');
    const status = document.createElement('div'); status.className = 'race-loading-status';
    this.label = document.createElement('strong'); this.label.textContent = 'PREPARING THE RACE';
    this.label.setAttribute('role', 'status'); this.label.setAttribute('aria-live', 'polite');
    this.bar = document.createElement('div'); this.bar.className = 'race-loading-stages';
    this.bar.setAttribute('aria-label', 'Completed loading stages');
    LOAD_STAGES.forEach(name => { const part = document.createElement('i'); part.title = name; this.bar.append(part); });
    this.detail = document.createElement('span'); this.detail.textContent = 'Bringing the circuit to life';
    status.append(this.label, this.bar, this.detail);
    const back = document.createElement('button'); back.type = 'button'; back.textContent = 'ESC · BACK TO MENU';
    this.cancel = () => { if (!this.active) return; onCancel?.(); };
    back.onclick = this.cancel;
    this.onKey = e => { if (e.code === 'Escape') { e.preventDefault(); this.cancel(); } };
    addEventListener('keydown', this.onKey);
    foot.append(back, status); el.append(art, mast, foot); this.root.append(el); back.focus({ preventScroll: true });
    this.slowTimer = setTimeout(() => { if (this.active) this.detail.textContent = 'First-time preparation can take longer. You can return to the menu at any time.'; }, 20000);
    // Let the first artwork reach the compositor before heavy scene preparation starts.
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  }
  complete(name) {
    if (!this.active) return;
    this.done.add(name);
    LOAD_STAGES.forEach((stage, i) => this.bar.children[i].classList.toggle('done', this.done.has(stage)));
    const remaining = LOAD_STAGES.filter(stage => !this.done.has(stage));
    this.detail.textContent = remaining.length ? `Preparing ${remaining.join(' · ')}` : 'Ready for the grid';
  }
  close() {
    this.active = false; clearTimeout(this.slowTimer);
    if (this.onKey) removeEventListener('keydown', this.onKey);
    this.el?.remove(); this.el = null;
    if (this.previousFocus?.isConnected) this.previousFocus.focus({ preventScroll: true });
  }
}
