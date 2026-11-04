// The Ultrack Ranking (docs/career-mode.md, "The Tour, the Opens, the ranking"): all sixteen drivers, points from every Tour round, Open and Masters, counted over a rolling window of
// race days and carried across seasons. It starts from the driver ratings (a seed that fades out over the first window), so the first Open is seeded before anyone has raced.
// Pure, like the rest of career/: the ranking is plain data in save.ranking = { seed: {code: pts}, days: [{ [code]: pts }], n }.
import { TUNING as T } from './rules.js';
import { YOU } from './world.js';

const W = T.ranking.window;
/** the starting ranking: a point total from each driver's rating, the player entering below the field */
export const newRanking = (ratings) => ({ seed: { ...Object.fromEntries(Object.entries(ratings).map(([code, r]) => [code, Math.round((r - 60) * T.ranking.seedPerRating)])), [YOU]: Math.round((T.ranking.playerRating - 60) * T.ranking.seedPerRating) }, days: [], n: 0 });
/** ranking points for a finishing place (0 = the winner) at an event kind; places past the table score nothing */
export const rankPoints = (place, kind = 'tour') => Math.round((T.ranking.points[place] ?? 0) * (T.events[kind]?.rank ?? 1) * 10) / 10;
/** a race day is over: `pts` maps driver code -> points. Only the last window of days counts, so the oldest drops out */
export function addDay(save, pts) {
  const K = (save.ranking ??= newRanking(save.world.ratings));
  K.days.push(pts); K.days = K.days.slice(-W); K.n++;
}
/** the sixteen drivers in the seats, best first: [{ code, key (his car), pts, rank, you }]. Ties go to the higher-rated driver (the player counts as the fixed rating the seed used) */
export function rankingOf(save) {
  const K = save.ranking, fade = Math.max(0, W - K.n) / W, rating = (c) => (c === YOU ? T.ranking.playerRating : save.world.ratings[c] ?? 0);
  const list = Object.entries(save.world.seats).filter(([, code]) => code).map(([key, code]) => ({ code, key, you: code === YOU,
    pts: Math.round(((K.seed[code] ?? 0) * fade + K.days.reduce((s, d) => s + (d[code] ?? 0), 0)) * 10) / 10 }));
  list.sort((a, b) => b.pts - a.pts || rating(b.code) - rating(a.code) || (a.code < b.code ? -1 : 1));
  return list.map((x, i) => ({ ...x, rank: i + 1 }));
}
export const rankOf = (save) => rankingOf(save).find((x) => x.you)?.rank ?? null;
