// Personal staff (assets/career/staff.json): a crew that cuts repair bills and an engineer that cuts upgrade prices. Hired per season, paid up front, no refund; they stay with the driver
// across teams. save.staff = { crew: { tier, season } | null, engineer: ... }: a hire counts only in the season it was paid for, so it lapses by itself when the season rolls.
import STAFF from '../../../../assets/career/staff.json';

export { STAFF };
export const ROLES = Object.keys(STAFF.roles);
export const staffId = (role, tier) => `${role}-${tier}`;
/** the hirable staff, one entry per role and paid tier: { id, role, tier, name, cost, cl, share } (share: what it takes off) */
export const STAFF_LIST = ROLES.flatMap((role) => STAFF.tiers.filter((t) => t.cost > 0).map((t) => ({ id: staffId(role, t.id), role, tier: t.id, name: `${STAFF.roles[role].name} ${t.name}`, cost: t.cost, cl: t.cl, share: t[STAFF.roles[role].key] })));
/** the tier a role works at this season (Basic when nobody was hired for it, or the hire was for an earlier season) */
export function tierNow(save, role) {
  const h = save.staff?.[role];
  return STAFF.tiers.find((t) => t.id === (h && h.season === save.clock.season ? h.tier : 'basic')) ?? STAFF.tiers[0];
}
/** the share off a repair bill (role crew) or an upgrade price (role engineer) this season, 0..1 */
export const discount = (save, role) => tierNow(save, role)[STAFF.roles[role].key];
/** can `id` be hired now? { ok, reason?: 'unknown' | 'hired' | 'better' | 'level' | 'coins', staff } ('better': a higher tier already works this season) */
export function hireInfo(save, id) {
  const s = STAFF_LIST.find((x) => x.id === id); if (!s) return { ok: false, reason: 'unknown' };
  const now = STAFF.tiers.indexOf(tierNow(save, s.role)), want = STAFF.tiers.findIndex((t) => t.id === s.tier);
  const reason = want === now ? 'hired' : want < now ? 'better' : save.career.cl < s.cl ? 'level' : save.wallet.coins < s.cost ? 'coins' : null;
  return { ok: !reason, reason, staff: s };
}
/** hire `id` for this season: the price is paid now and is not refunded */
export function hire(save, id) {
  const r = hireInfo(save, id); if (!r.ok) return r;
  save.wallet.coins -= r.staff.cost; (save.staff ??= {})[r.staff.role] = { tier: r.staff.tier, season: save.clock.season };
  return r;
}
