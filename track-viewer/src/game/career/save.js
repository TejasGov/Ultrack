// The career save: its own localStorage key, apart from the free-play profile (store.js), guarded the same way (private windows,
// previews): a career that cannot be saved still plays, it just does not survive a reload.
// shortcut: one slot (the save format keeps `slots` for the three the design asks for in P2), add slot picking when P2 lands
const KEY = 'ultrack.career.v1';
export const SCHEMA = 1;

export function loadCareer() {
  try {
    const raw = localStorage.getItem(KEY); if (!raw) return null;
    const d = JSON.parse(raw), s = d?.slots?.[d.active ?? 0];
    return s?.schema === SCHEMA ? s : null;      // an unknown schema is not guessed at: the menu offers a new career
  } catch { return null; }
}
export function saveCareer(save) {
  try { localStorage.setItem(KEY, JSON.stringify({ slots: [save], active: 0 })); return true; } catch { return false; }
}
