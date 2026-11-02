// The career's one place for messages (docs/career-mode.md section 13): every change the player did not make himself leaves a line here, so
// nothing happens silently. action: { deal: offerId } opens that negotiation, { tab } opens a hub tab. What the player has just seen on another screen (a race, an event, a level) arrives read: the count is what still wants him.
const MAX = 50;
export function post(save, kind, title, body = '', action = null) {
  const box = (save.inbox ??= []);
  box.unshift({ id: (save.inboxN = (save.inboxN ?? 0) + 1), season: save.clock.season, week: (save.clock.week ?? 0) + 1, kind, title, body, action, read: ['race', 'event', 'news'].includes(kind) });
  box.length = Math.min(box.length, MAX);
}
export const unread = (save) => (save.inbox ?? []).filter((m) => !m.read).length;
export function markRead(save, id) { const m = save.inbox?.find((x) => x.id === id); if (m) m.read = true; return m ?? null; }
