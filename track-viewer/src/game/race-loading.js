import './race-loading.css';
import TEAMS from '../../../assets/teams/teams.json';
import { GRID } from '../cars.js';
import { TRACKS, trackOf, revUrl } from '../tracks.js';
import { store, WEATHER } from './store.js';
import { icon } from './icons.js';

/** one backdrop and story per circuit: the circuit's own still (make-ui-stills.mjs), never painted art */
export const LOADING_SLIDES = [
  { track: 'marina', title: 'The city\nholds its breath.', text: 'The cafés stay open on race night. Mechanics lean over the pit wall, and for the people who live along the Corniche the first engine note is the start of the evening.' },
  { track: 'tokyo', title: 'Old city,\nnew city.', text: 'A temple street under the cherry blossom, then the neon straight with Fuji on the horizon. Every lap runs through both halves of Tokyo.' },
  { track: 'india', title: 'Down the ghat\ninto the valley.', text: 'The road falls off the ridge in tight bends, the city below and the far ranges sharp in the thin mountain air. Commit to the line before the bend, not in it.' },
  { track: 'infinia', title: 'Over the bay,\nunder the bay.', text: 'The sea link climbs over the water on one long curve; half a lap later you pass beneath it in the undersea tunnel. Then the seafront and its necklace of streetlights.' },
  { track: 'shajawa', title: 'The whole bowl\nis on its feet.', text: 'Stands on every side, then out through a gate under the upper rows for a loop of open desert, and back in through another. The bowl hears you long before it sees you.' },
  { track: 'drylake', title: 'Under the wings\nof the boneyard.', text: 'A test airfield on the edge of a dry lake. The main straight is a runway; the infield is rows of retired airliners. Brake hard at the end of the runway for the hairpin round the parked tail.' },
  { track: 'venice', title: 'Palazzi on\nboth sides.', text: 'Canal bridges, a campanile on the turn-in, and a figure-eight that dives through a tunnel under its own deck. The walls are stone and they stand close.' },
  { track: 'qingshan', title: 'Forest to\nthe kerb.', text: 'Wind turbines on the ridge, solar fields by the lake, and trees right up to the barrier for most of the lap. Long sweeping corners reward a clean line.' },
  { track: 'llano', title: 'A long way\nfrom anywhere.', text: 'Red dirt to the horizon and two kilometres of flat-out road down the Long Mile. The race-day train still pulls in at Llano Central. Last Chance is at the far end, and it is well named.' },
  { track: 'pilbara', title: 'Down into\nthe red.', text: 'A haul road off the rim of an open-cut iron mine: down the bench wall, one switchback, across the pit floor under the conveyor, and a blind crest back onto the rim.' },
  { track: 'terminal', title: 'Steel walls\non every side.', text: 'A Sunday at the container terminal: a quay straight under the cranes, then a canyon of boxes stacked four high. You never see the next corner until you are in it.' },
  { track: 'morro', title: 'The whole hill\nis watching.', text: 'A drag strip under the strings of lights, the beach avenue, then up the morro between the houses and two hairpins to the top road over the city. Always night, always wet: the neon is in every puddle.' },
  { track: 'wold', title: 'Through the\nvillage, over the river.', text: 'Off the wold top and down the escarpment, along the river meadows and between the honey-stone cottages of the high street, then hard left onto the old bridge. Stone walls, not run-off.' },
].map((s) => ({ ...s, image: revUrl(`/assets/ui/stills/tracks/${s.track}.webp`) }));
const TIP = 'Brake before the corner. Ease off the pedal as you turn, then build throttle on the exit.';
export const LOAD_STAGES = ['Circuit', 'Grid', 'Track physics', 'Audio', 'Graphics'];
const STAGE_LABEL = { Circuit: 'Loading the circuit', Grid: 'Preparing the grid', 'Track physics': 'Building track physics', Audio: 'Tuning engine audio', Graphics: 'Warming up graphics' };
const LOOK_LABEL = { day: 'Day', dusk: 'Dusk', bluehour: 'Evening', night: 'Night' };   // as ui.js LOOK_LABEL (bluehour keeps its id)
const MODE = { race: ['race', 'Race'], trial: ['time-trial', 'Time Trial'], drift: ['drift', 'Drift Attack'], free: ['free-drive', 'Free Drive'] };
const WORDS = ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve'];
/** the line under the title: a race names the true field (one car per team, as many as the grid holds: game.js racersFor) */
const RACING = Math.min(TEAMS.teams.length, GRID);
export const fieldLine = (mode) => ({ race: `${WORDS[RACING] ?? RACING} teams. One grid.`, trial: 'An empty circuit and the clock.', drift: 'Ninety seconds. Chain the drifts.', free: 'No clock, no rivals.' })[mode] ?? '';
const el = (tag, cls, ...kids) => { const e = document.createElement(tag); if (cls) e.className = cls; e.append(...kids.filter((k) => k !== null && k !== undefined)); return e; };

/** The circuit's still under a directional scrim, its story, and the real stage progress: no 3D scene renders behind this screen.
 * No artificial minimum wait; stages advance only when their actual promises complete. */
export class RaceLoading {
  constructor(root) { this.root = root; this.active = false; }
  preload() {
    if(this.preloaded)return;
    this.preloaded=new Image();this.preloaded.src=LOADING_SLIDES.find((s)=>s.track===trackOf(store.settings.track).id)?.image??LOADING_SLIDES[0].image;
  }
  async open({ mode = 'race', reduceMotion = false, track = 'Corniche Marina', label = null, field = null, onCancel } = {}) {   // label, field: a career event's own name (Last Chance Qualifier, Japan Open Final) and line
    this.close(); this.active = true; this.done = new Set(); this.started = performance.now();
    this.previousFocus = document.activeElement;
    const t = Object.values(TRACKS).find((x) => x.name === track) ?? trackOf(store.settings.track), S = store.settings;
    const slide = LOADING_SLIDES.find((s) => s.track === t.id) ?? LOADING_SLIDES[0], [mic, mlabel] = MODE[mode] ?? MODE.race;
    const root = this.el = el('section', 'race-loading' + (reduceMotion ? ' still' : ''));
    root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true'); root.setAttribute('aria-label', 'Preparing race');
    const image = new Image(); image.src = slide.image; image.alt = ''; image.decoding = 'async'; image.className = 'rl-still';
    image.onerror = () => image.remove(); // the scrim and copy stay readable without it
    const where = [t.name, LOOK_LABEL[S.look], S.weather !== 'dry' ? WEATHER[S.weather]?.label : null].filter(Boolean).join(' · ');
    this.slow = el('p', 'rl-slow', icon('info'), el('span', '', 'First-time preparation can take longer. You can return to the menu at any time.')); this.slow.hidden = true;
    const copy = el('div', 'rl-copy', el('p', 'kick rl-kick', icon('track'), where), el('h1', '', slide.title), el('p', 'rl-field', icon(mic), field ?? fieldLine(mode)),
      el('p', 'rl-text', slide.text), el('p', 'rl-tip', icon('info'), el('span', '', TIP)), this.slow);
    const logo = el('i', 'logo'), head = el('header', 'rl-head', logo, el('span', 'kick rl-mode', icon(mic), label ?? mlabel));
    // the stage bar: the stage in progress and the share done; the label is the live region
    this.detail = el('span', 'rl-stage'); this.detail.setAttribute('role', 'status'); this.detail.setAttribute('aria-live', 'polite');
    this.pct = el('span', 'rl-pct tnum'); this.fillBar = el('i'); this.bar = el('div', 'bar4', this.fillBar);
    this.bar.setAttribute('aria-hidden', 'true');
    const status = el('div', 'rl-status', el('div', 'rl-row', this.detail, this.pct), this.bar);
    // Esc, or the pad's B (game.js update() forwards it to cancel while loading)
    const back = el('button', 'btn btn-ghost', icon('back'), 'Back to menu', el('span', 'prompt', el('span', 'pk', el('kbd', '', 'Esc')), icon('pad-b', { cls: 'pp' }))); back.type = 'button';
    this.cancel = () => { if (!this.active) return; onCancel?.(); };
    back.onclick = this.cancel;
    this.onKey = e => { if (e.code === 'Escape') { e.preventDefault(); this.cancel(); } };
    addEventListener('keydown', this.onKey);
    // focus the dialog, not Back: a held or auto-repeated Enter from Start must not click Back and quit the load (Esc cancels, the mouse clicks Back)
    root.tabIndex = -1; root.append(image, el('div', 'rl-scrim'), head, copy, el('footer', 'rl-foot', back, el('div', 'sp'), status)); this.root.append(root); root.focus({ preventScroll: true });
    this.progress();
    this.slowTimer = setTimeout(() => { if (this.active) this.slow.hidden = false; }, 20000);
    // Let the backdrop reach the compositor before heavy scene preparation starts.
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  }
  complete(name) {
    if (!this.active) return;
    this.done.add(name); this.progress();
  }
  /** the stage name (the first one still running, in LOAD_STAGES order), the percentage done and the bar; only on a change */
  progress() {
    const remaining = LOAD_STAGES.filter(stage => !this.done.has(stage)), p = (LOAD_STAGES.length - remaining.length) / LOAD_STAGES.length;
    this.detail.textContent = remaining.length ? STAGE_LABEL[remaining[0]] : 'Ready for the grid';
    this.pct.textContent = `${Math.round(p * 100)} %`; this.bar.style.setProperty('--p', p);
  }
  close() {
    this.active = false; clearTimeout(this.slowTimer);
    if (this.onKey) removeEventListener('keydown', this.onKey);
    this.el?.remove(); this.el = null;
    if (this.previousFocus?.isConnected) this.previousFocus.focus({ preventScroll: true });
  }
}
