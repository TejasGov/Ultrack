// What the career remembers (docs/career-mode.md 6.5): a short list of things the player did that a team or a driver can hold against them, or for them.
// Pure, like the rest of career/. An entry weighs `w` and fades by 1 a season, so a refusal cools a team for a while and is then forgotten.
const MAX = 60;
/** remember that the player did `kind` to `who` (a driver code) or `team`, now */
export function note(save, kind, { who = null, team = null, w = 1 } = {}) {
  const L = (save.career.ledger ??= []);
  L.push({ s: save.clock.season, r: save.clock.round, kind, who, team, w });
  if (L.length > MAX) L.splice(0, L.length - MAX);
}
const matches = (e, { who, team, kinds }) => (who === undefined || e.who === who) && (team === undefined || e.team === team) && (!kinds || kinds.includes(e.kind));
/** how much `who` or `team` remembers of these kinds: each entry's weight less a season's fading for each season since */
export const remembers = (save, filter) => (save.career.ledger ?? []).filter((e) => matches(e, filter)).reduce((a, e) => a + Math.max(0, e.w - (save.clock.season - e.s)), 0);
/** the newest entry that matches, or null */
export const latest = (save, filter) => (save.career.ledger ?? []).findLast((e) => matches(e, filter)) ?? null;
