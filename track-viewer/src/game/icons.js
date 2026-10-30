// The UI's icons (docs/ui-system.md, "Icons"): icon('lap') -> <svg class="icon"> that references the sprite's <symbol id="lap">.
// The browser fetches /assets/ui/icons.svg once and caches it; the stroke comes from .icon in ui-tokens.css (currentColor), so an
// icon takes the text colour and size (1em, or a --icon-* token) of wherever it sits. Static markup only: never build icons per
// frame. The set and its names: scripts/make-ui-icons.mjs (it writes the sprite and public/assets/ui/icons/<name>.svg).
const SPRITE = '/assets/ui/icons.svg', NS = 'http://www.w3.org/2000/svg';

/** an icon element by name; cls adds classes ('icon-l', ...), label makes it announced (otherwise aria-hidden: decoration) */
export function icon(name, { cls = '', label = '' } = {}) {
  const s = document.createElementNS(NS, 'svg'), u = document.createElementNS(NS, 'use');
  s.setAttribute('class', cls ? `icon ${cls}` : 'icon'); s.setAttribute('viewBox', '0 0 24 24'); s.dataset.icon = name;
  if (label) { s.setAttribute('role', 'img'); s.setAttribute('aria-label', label); } else s.setAttribute('aria-hidden', 'true');
  u.setAttribute('href', `${SPRITE}#${name}`); s.append(u);
  return s;
}
