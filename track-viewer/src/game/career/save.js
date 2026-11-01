// The career saves: three slots under their own localStorage key, apart from the free-play profile (store.js), guarded the same way
// (private windows, previews): a career that cannot be saved still plays, it just does not survive a reload.
import { migrate } from './career.js';

const KEY = 'ultrack.career.v1';
export const SLOTS = 3;

function read() {
  try {
    const d = JSON.parse(localStorage.getItem(KEY));
    return { slots: Array.from({ length: SLOTS }, (_, i) => d?.slots?.[i] ?? null), active: d?.active ?? 0 };
  } catch { return { slots: Array(SLOTS).fill(null), active: 0 }; }
}
function write(d) {
  try { localStorage.setItem(KEY, JSON.stringify(d)); return true; } catch { return false; }
}
/** every slot, for the picker: a save, or null when empty (or from a schema this code cannot read: not guessed at) */
export const listCareers = () => read().slots.map(migrate);
export const activeSlot = () => read().active;
/** the active career, or slot i (which then becomes active) */
export function loadCareer(i) {
  const d = read(), k = i ?? d.active;
  if (i !== undefined && d.active !== i) { d.active = i; write(d); }
  return migrate(d.slots[k]);
}
/** writes the active slot, or slot i (which then becomes active); null empties it */
export function saveCareer(save, i) {
  const d = read(); if (i !== undefined) d.active = i;
  d.slots[d.active] = save;
  return write(d);
}
