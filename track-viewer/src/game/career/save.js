// The career saves: three slots under their own localStorage key, apart from the free-play profile (store.js), guarded the same way
// (private windows, previews): a career that cannot be saved still plays, it just does not survive a reload.
import { migrate, SCHEMA } from './career.js';

const KEY = 'ultrack.career.v1';
export const SLOTS = 3;
let here = null;      // the slot this tab's career is in: `active` is shared, and with two tabs open a save must not land in the other tab's slot

function read() {
  try {
    const d = JSON.parse(localStorage.getItem(KEY)?.replace(/(?<!"name":)"mustang"/g, '"ford-gt"') ?? null);   // the Mustang became the Ford GT (2026-11-01)
    return { slots: Array.from({ length: SLOTS }, (_, i) => d?.slots?.[i] ?? null), active: d?.active ?? 0 };
  } catch { return { slots: Array(SLOTS).fill(null), active: 0 }; }
}
function write(d) {
  try { localStorage.setItem(KEY, JSON.stringify(d)); return true; } catch { return false; }
}
/** a save brought up to date, or null when it cannot be: its fields are checked, as a damaged one would otherwise throw on every screen that lists it */
function usable(s) {
  try { const m = migrate(s); return m && typeof m.player?.name === 'string' && Number.isFinite(m.clock?.season) && Number.isFinite(m.career?.cl) && Number.isFinite(m.career?.rep) ? m : null; } catch { return null; }
}
/** every slot, for the picker: a save, null when empty, { unreadable: true } for one from a schema this code cannot read and also { damaged: true } for a broken one: never guessed at, only ever deleted by the player */
export const listCareers = () => read().slots.map((s) => (s ? usable(s) ?? (s.schema > SCHEMA ? { unreadable: true } : { unreadable: true, damaged: true }) : null));
export const activeSlot = () => here ?? read().active;
/** the active career, or slot i (which then becomes active) */
export function loadCareer(i) {
  const d = read(), k = i ?? here ?? d.active; here = k;
  if (d.active !== k) { d.active = k; write(d); }
  return usable(d.slots[k]);
}
/** writes the active slot, or slot i (which then becomes active); null empties it */
export function saveCareer(save, i) {
  const d = read(); here = d.active = i ?? here ?? d.active;
  d.slots[here] = save;
  return write(d);
}
