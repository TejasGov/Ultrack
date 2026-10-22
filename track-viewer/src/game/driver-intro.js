import TEAMS from '../../../assets/teams/teams.json';

export const DRIVER_INTRO_SECONDS = 2.5;
export function introDrivers(keys) {
  return keys.map(key => {
    const team = TEAMS.teams.find(t => t.cars.some(c => c.key === key));
    const entry = team?.cars.find(c => c.key === key);
    if (!entry) return null;
    const slug = entry.driver.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    return { ...entry, team, poster: `/assets/drivers/${slug}/poster-game.webp` };
  }).filter(Boolean);
}

/** A race-local presentation. No images are requested until play(); no timers survive cancellation. */
export class DriverIntro {
  constructor(root) { this.root = root; this.active = false; }

  play(keys, { reduceMotion = false } = {}) {
    this.cancel();
    this.entries = introDrivers(keys);
    if (!this.entries.length) return Promise.resolve(true);
    this.active = true; this.index = 0; this.elapsed = 0; this.wait = 0;
    this.padHeld = this.padPressed();
    this.previousFocus = document.activeElement;
    const el = this.el = document.createElement('section');
    el.className = 'driver-intro' + (reduceMotion ? ' still' : '');
    el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true');
    el.setAttribute('aria-label', 'Race driver introductions');
    this.frame = document.createElement('div'); this.frame.className = 'driver-intro-frame';
    const footer = document.createElement('div'); footer.className = 'driver-intro-footer';
    this.label = document.createElement('span'); this.label.setAttribute('aria-live', 'polite');
    this.progress = document.createElement('div'); this.progress.className = 'driver-intro-progress';
    this.progress.setAttribute('aria-hidden', 'true');
    this.entries.forEach(() => this.progress.append(document.createElement('i')));
    const skip = document.createElement('button'); skip.type = 'button';
    skip.textContent = 'Skip intro · Enter'; skip.addEventListener('click', () => this.skip());
    footer.append(this.label, this.progress, skip); el.append(this.frame, footer);
    this.root.append(el); skip.focus({ preventScroll: true });
    const promise = new Promise(resolve => { this.resolve = resolve; });
    this.images = this.entries.map((entry, i) => {
      const image = new Image(); image.decoding = 'async';
      image.alt = `${entry.driver.name} · ${entry.team.name} · #${entry.number}`;
      const item = { image, state: 'loading' };
      const settle = state => {
        item.state = state;
        if (this.active && this.images?.[i] === item && this.index === i) this.render();
      };
      image.onload = () => {
        Promise.resolve(image.decode?.()).catch(() => {}).then(() => settle('ready'));
      };
      image.onerror = () => settle('failed');
      image.src = entry.poster;
      return item;
    });
    this.render();
    return promise;
  }

  render() {
    const entry = this.entries[this.index], item = this.images[this.index];
    this.label.textContent = `THE GRID  ${this.index + 1} / ${this.entries.length} · ${entry.driver.name}`;
    this.frame.replaceChildren();
    if (item.state === 'ready') this.frame.append(item.image);
    else {
      const fallback = document.createElement('div'); fallback.className = 'driver-intro-fallback';
      fallback.style.setProperty('--intro-team', entry.team.colors.primary);
      const team = document.createElement('p'); team.textContent = `${entry.team.name} · #${entry.number}`;
      const name = document.createElement('h1'); name.textContent = entry.driver.name;
      const note = document.createElement('p');
      note.textContent = item.state === 'loading' ? 'Preparing driver artwork…' : entry.driver.role;
      fallback.append(team, name, note); this.frame.append(fallback);
    }
    [...this.progress.children].forEach((bar, i) => {
      bar.classList.toggle('done', i < this.index); bar.classList.toggle('current', i === this.index);
      bar.style.setProperty('--progress', '0%');
    });
  }

  padPressed() {
    return !!globalThis.navigator?.getGamepads?.().some(p => p?.connected && (p.buttons[0]?.pressed || p.buttons[9]?.pressed));
  }

  update(dt) {
    if (!this.active || document.hidden) return;
    const pressed = this.padPressed();
    if (pressed && !this.padHeld) { this.skip(); return; }
    this.padHeld = pressed;
    const item = this.images[this.index];
    if (item.state === 'loading') {
      this.wait += dt;
      if (this.wait < 5) return;
      // A broken or slow image never blocks the race; show the driver's name instead.
      item.state = 'failed'; this.render(); return;
    }
    this.elapsed += dt;
    this.progress.children[this.index].style.setProperty('--progress', `${Math.min(100, this.elapsed / DRIVER_INTRO_SECONDS * 100)}%`);
    if (this.elapsed >= DRIVER_INTRO_SECONDS) {
      if (++this.index === this.entries.length) this.finish(true);
      else { this.elapsed = 0; this.wait = 0; this.render(); }
    }
  }

  skip() { this.finish(true); }
  cancel() { this.finish(false); }
  finish(continueRace) {
    if (!this.active) return;
    this.active = false;
    for (const { image } of this.images ?? []) { image.onload = null; image.onerror = null; }
    this.el.remove(); this.frame.replaceChildren(); this.images = [];
    if (this.previousFocus?.isConnected) this.previousFocus.focus({ preventScroll: true });
    const resolve = this.resolve; this.resolve = null; resolve?.(continueRace);
  }
}
