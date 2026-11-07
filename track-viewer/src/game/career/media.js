// The paddock press (docs/career-mode.md 13): stories written from what really happened in a career, a save goes in and comes out changed, like the rest of career/.
// A story is plain data in save.media; its picture is worked out when it is drawn (storyImage), so new art reaches old stories and a missing image only falls back.
import MEDIA from '../../../../assets/career/media.json';
import { TUNING as T, CAR, FIELD, DIV, loreOf } from './rules.js';
import { rng } from './rng.js';
import { YOU, personOf, rivalsOf } from './world.js';
import { latest } from './ledger.js';

const MAX = 40;
const pick = (r, list) => list[Math.floor(r() * list.length)];
const carOf = (save, code) => Object.keys(save.world.seats).find((k) => save.world.seats[k] === code) ?? null;
/** the lore rivals of a teams.json driver, by code */
const LORE = Object.fromEntries(Object.values(CAR).map((c) => [c.driver.code, c.driver]));

export function story(save, kind, title, body, { driver = null, mood = 'portrait', track = null, pair = null, you = null, scene = null, principal = null, posts = null } = {}) {
  const box = (save.media ??= []), S = save.season, extra = Object.fromEntries(Object.entries({ you, scene, principal, posts }).filter(([, v]) => v));   // only what this story uses: 40 of these live in the save
  box.unshift({ id: (save.mediaN = (save.mediaN ?? 0) + 1), season: save.clock.season, week: (save.clock.week ?? 0) + 1, kind, title, body, driver, mood, track: track ?? S?.calendar?.[save.clock.round]?.track ?? S?.calendar?.at(-1)?.track ?? null, pair, ...extra, read: false });
  box.length = Math.min(box.length, MAX);
}
/** the media bytes on Home and the race report: the newest week's stories in the order they were written (the lead first), then older ones */
export function latestBytes(save, n = 3) {
  const box = save.media ?? [], top = box[0], now = top ? box.filter((s) => s.season === top.season && s.week === top.week).reverse() : [];
  return [...now, ...box.filter((s) => !now.includes(s))].slice(0, n);
}
export const unreadStories = (save) => (save.media ?? []).filter((s) => !s.read).length;
export function readStory(save, id) { const s = save.media?.find((x) => x.id === id); if (s) s.read = true; return s ?? null; }

const quote = (code, mood, r) => { const q = MEDIA.quotes[code]?.[mood]; return q ? `"${pick(r, q)}" ${LORE[code].name.split(' ').at(-1)} told the press.` : ''; };
const placeName = (entry, i) => (entry.dnq ? 'missed the cut' : `P${i + 1}`);

/** the round's press, after the race (finishRace). Who won, how the player did, the teammate, a feud, and sometimes paddock drama. */
export function coverRound(save, report) {
  const { season, round } = save.clock, r = rng(save.seed, 'media', season, round), E = report.entries, me = save.player, track = report.track, gp = report.name;
  const winner = E[0], at = E.findIndex((e) => e.you), mine = E[at], mate = E.find((e) => !e.you && e.team === mine.team), mateAt = E.indexOf(mate);
  const nameOf = (c) => (c === me.code ? me.name : personOf(save, c)?.name ?? c), surname = (c) => nameOf(c).split(' ').at(-1);

  // the lead: the winner
  if (winner.you) story(save, 'win', `${me.name} wins the ${gp}`, `From P${report.grid} to the top step, with ${nameOf(E[1].code)} second.`, { track, you: 'win' });
  else story(save, 'win', pick(r, [`${nameOf(winner.code)} takes the ${gp}`, `${surname(winner.code)} wins the ${gp}`]), `${loreOf(winner.team).name} on the top step, ${nameOf(E[1].code)} second. ${quote(winner.code, 'win', r)}`, { driver: winner.code, mood: 'win', track });

  // the player, unless the lead already was
  if (report.dnq && report.open) story(save, 'down', `${me.name} misses the ${report.kind === 'masters' ? gp : `${gp} Final`}`, report.kind === 'masters' ? (DIV[save.season?.div] ? `Ranked ${report.open.rank} in the ${DIV[save.season.div].short}, outside its top ${DIV[save.season.div].masters}, ${me.name} watched the Masters from the grandstand.` : `Outside the top ${T.series.gridSize} of the Ultrack Ranking, ${me.name} watched the Masters from the grandstand.`) : `The Final went ahead without ${me.name}, who finished the weekend P${report.grid} of ${report.field ?? FIELD}. The ranking will remember it.`, { track, you: 'dnq' });
  else if (report.dnq) story(save, 'down', `${me.name} misses the cut at the ${gp}`, `P${report.grid} of ${report.field ?? FIELD} in qualifying, and only the top ${T.series.gridSize} race. The grandstands never saw ${me.name} on Sunday.`, { track, you: 'dnq' });
  else if (report.dnf) story(save, 'down', `Retirement for ${me.name}`, `Out of the ${gp} after starting P${report.grid}. No points, and a long walk back to the garage.`, { track, you: 'down' });
  else if (!winner.you && report.finish <= 3) story(save, 'podium', `Podium for ${me.name}`, `P${report.finish} from P${report.grid} at the ${gp}, in a car expected ${report.expPos > report.finish ? `no higher than P${report.expPos}` : `to be up here`}.`, { track, you: 'podium' });
  else if (!winner.you && report.expPos - report.finish >= 4) story(save, 'podium', `${me.name} punches above the car`, `P${report.finish} when the paddock expected P${report.expPos}. People are starting to ask who ${me.name} is.`, { track, you: 'podium' });

  // the teammate, by the finishing order (a missed cut counts as behind)
  if (mate) {
    const lost = mateAt < at, gap = Math.abs(mateAt - at);
    if (report.dnq && !mate.dnq) story(save, 'duel', `${surname(mate.code)} races, ${me.name} does not`, `${nameOf(mate.code)} made the cut at the ${gp} and finished P${mateAt + 1}. In the same car, the comparison writes itself. ${quote(mate.code, 'win', r)}`, { driver: mate.code, mood: 'win', track });
    else if (gap >= 2 && !report.dnf && !mate.dnq && !mine.dnq) story(save, 'duel', lost ? `${surname(mate.code)} beats ${me.name} again` : `${me.name} beats ${surname(mate.code)} in the same car`, `${placeName(lost ? mate : mine, lost ? mateAt : at)} against ${placeName(lost ? mine : mate, lost ? at : mateAt)} at the ${gp}. ${quote(mate.code, lost ? 'win' : 'down', r)}`, { driver: mate.code, mood: lost ? 'win' : 'down', track });
  }

  // a feud with the player that is still alive
  const feud = rivalsOf(save).find((x) => x.feud && x.key && E.some((e) => e.key === x.key));
  if (feud) {
    const theirs = E.findIndex((e) => e.key === feud.key), beat = theirs > at && !report.dnf && !report.dnq;
    const why = callbackOf(save, 'rival', { who: feud.code })?.text;   // what started it, from the ledger
    story(save, 'feud', beat ? `${me.name} wins the latest round with ${surname(feud.code)}` : `${surname(feud.code)} has the last word over ${me.name}`, `${beat ? `${nameOf(feud.code)} finished behind at the ${gp}, and did not stop for a handshake.` : `The feud goes on after the ${gp}. Neither camp is pretending otherwise.`}${why ? ` ${why}` : ''}`, { driver: feud.code, mood: beat ? 'down' : 'win', track });
  }

  // paddock drama among the others, from the order they really finished in: teammates running together, or lore rivals side by side
  if (r() < MEDIA.dramaChance) {
    const raced = E.filter((e) => !e.dnq && !e.you), side = raced.slice(1).map((e, i) => [raced[i], e]);
    const same = side.find(([a, b]) => a.team === b.team), rivals = side.find(([a, b]) => LORE[a.code]?.rivals.includes(b.code) || LORE[b.code]?.rivals.includes(a.code));
    if (same) {
      const [a, b] = same, line = pick(r, [`Team orders at ${loreOf(a.team).name}?`, `${surname(a.code)} and ${surname(b.code)}: who waved whom through?`]);
      story(save, 'drama', line, `Finishing one place apart at the ${gp}, ${nameOf(a.code)} ahead of ${nameOf(b.code)}. ${loreOf(a.team).principal} says nobody asked anybody to do anything. Nobody in the paddock believes it.`, { driver: b.code, mood: 'down', track, pair: [a.code, b.code], principal: a.team });
    } else if (rivals) {
      const [a, b] = rivals, line = pick(r, [`${surname(a.code)} and ${surname(b.code)}: it is not over`, `Words in the pit lane: ${surname(a.code)} against ${surname(b.code)}`]);
      story(save, 'drama', line, `They crossed the line one place apart at the ${gp} and then argued about how. ${loreOf(b.team).name} is asking the stewards to look at it; ${loreOf(a.team).name} says the replay speaks for itself.`, { driver: a.code, mood: 'portrait', track, pair: [a.code, b.code] });
    }
  }
  coverSocial(save, report, r);
}

/** an Open or the Masters is over (finishRace): the road the player took to the Final, and the honours he earned */
export function coverOpen(save, report) {
  const me = save.player.name, gp = report.name, track = report.track, o = report.open;
  if (!report.dnq && !o.seeded && o.lcq) story(save, 'podium', `${me} came through the Last Chance`, `P${o.lcq} at ${o.lcqAt} was enough for a place in the ${gp} Final.`, { track, you: 'podium' });
  if (report.honours.includes('triple')) story(save, 'win', `${me} completes the Triple Crown`, 'Japan, India and Venice: all three Opens won in one career. Nobody in the paddock is calling it luck.', { track, you: 'win' });
  if (report.honours.includes('slam')) story(save, 'win', `${me} takes the Grand Slam`, 'All three Opens in a single season. The record books have been opened to a new page.', { track, you: 'win' });
}

// ---------------------------------------------------------------------------------------------- the two series (docs/10x/divisions-spec.md 11)
const D = MEDIA.divisions, fillD = (t, ctx) => t.replace(/\{(\w+)\}/g, (_, k) => ({ elite: DIV.elite.name, challenger: DIV.challenger.name, ...ctx })[k] ?? '');
/** the season's swap (endSeason): the public story, or the player's own when it is their team that moves */
export function coverSwap(save, swap) {
  const t = (id) => loreOf(id).name, mine = save.contract?.team, ctx = { up: t(swap.up), down: t(swap.down), team: t(mine) };
  if (mine === swap.up) story(save, 'league', fillD(D.youUp.title, ctx), fillD(D.youUp.body, ctx), { you: 'win', principal: mine });
  else if (mine === swap.down) story(save, 'league', fillD(D.youDown.title, ctx), fillD(D.youDown.body, ctx), { principal: mine });
  else story(save, 'league', fillD(D.up.title, ctx), fillD(D.up.body, ctx), { principal: swap.up });
}
/** each series' Drivers' champion (endSeason): champs = [{ div, row }] with row a standings driver row */
export function coverChampions(save, champs) {
  for (const { div, row } of champs) {
    const you = row.you, ctx = { who: you ? save.player.name : row.name, series: DIV[div].name, pts: Math.round(row.pts * 10) / 10, team: loreOf(row.team).name, wins: row.wins === 1 ? '1 win' : row.wins ? `${row.wins} wins` : 'no wins' };
    story(save, 'league', fillD(D.champion.title, ctx), fillD(D.champion.body, ctx), you ? { you: 'win' } : { driver: row.code, mood: 'win' });
  }
}
/** a Challenger driver on the podium of an Open or the Masters (finishRace): the player's story if they are one, else the best placed */
export function coverGiantKill(save, report) {
  const E = report.entries, i = [0, 1, 2].filter((k) => E[k] && !E[k].dnq && E[k].div === 'challenger').sort((a, b) => E[b].you - E[a].you || a - b)[0];
  if (i === undefined || (E[i].you && report.dnf)) return;
  const e = E[i], ctx = { who: e.you ? save.player.name : personOf(save, e.code)?.name ?? e.code, gp: report.name, place: i + 1, beat: E.slice(i + 1).filter((x) => !x.dnq && x.div === 'elite').length };
  story(save, 'league', fillD(e.you ? D.giantKill.you : D.giantKill.title, ctx), fillD(D.giantKill.body, ctx), e.you ? { you: 'podium', track: report.track } : { driver: e.code, mood: 'win', track: report.track });
}
/** a line of media.json's divisions group, filled: divText('meanwhile', 'title', ctx) */
export const divText = (key, sub, ctx) => fillD(D[key][sub], ctx);

/** the fans and the gossip columns, one post a round at most, from what really happened: a rare rumour, else anger at a bad day, love for a good one, a war between rival stands, or a leak about whoever underperformed */
function coverSocial(save, report, r) {
  if (r() >= MEDIA.socialChance) return;
  const E = report.entries, me = save.player.name, myTeam = save.contract.team, raced = E.filter((e) => !e.dnq), winner = E[0];
  const name = (e) => (e.you ? me : personOf(save, e.code)?.name ?? e.code), teamOf = (id) => loreOf(id).name, seated = new Set(Object.values(save.world.seats));
  const ctx = { me, who: me, team: teamOf(myTeam), rival: '', gp: report.name, week: (save.clock.week ?? 0) + 1 };
  const write = (kind, t, extra = {}) => {
    const fill = (x) => x.replace(/\{(\w+)\}/g, (_, k) => ctx[k] ?? ''), handle = (x) => fill(x.replace(/\{(team|rival)\}_/g, (_, k) => ctx[k].toLowerCase() + '_'));
    const posts = t.posts.map((line) => { const [h, text] = line.split('|'), n = 1 + r() * 40; return { h: handle(h), t: fill(text), l: `${n.toFixed(1)}K` }; });
    story(save, kind, fill(t.title), fill(t.body), { track: report.track, scene: t.scene ?? null, posts, ...extra });
  };
  const rumor = r() < MEDIA.rumorChance ? pick(r, MEDIA.rumors.filter((x) => x.drivers.every((c) => seated.has(c)))) : null;
  if (rumor) return write('rumor', rumor);
  if (report.dnq || report.dnf || report.finish - report.expPos >= 4) return write('social', pick(r, MEDIA.social.hate), { you: 'down' });
  if (!report.dnf && report.finish <= 3) return write('social', pick(r, MEDIA.social.love));
  const side = raced.slice(1).map((e, i) => [raced[i], e]).find(([a, b]) => a.team !== b.team && (LORE[a.code]?.rivals.includes(b.code) || LORE[b.code]?.rivals.includes(a.code)));
  if (side) {
    const [a, b] = side; ctx.team = teamOf(a.team); ctx.rival = teamOf(b.team);
    return write('social', pick(r, MEDIA.social.war), { scene: [a.team, b.team].every((t) => t === 'saetta' || t === 'toro') ? 'fan-war-reds' : 'fan-war-blues' });
  }
  if (!winner.you && r() < 0.5) { ctx.who = name(winner); ctx.team = teamOf(winner.team); return write('social', pick(r, MEDIA.social.love), { driver: winner.code, mood: 'win' }); }
  const flop = raced.filter((e) => !e.you && e !== winner).at(-1);
  if (flop) { const rival = raced.find((e) => e.team !== flop.team); ctx.who = name(flop); ctx.team = teamOf(flop.team); ctx.rival = rival ? teamOf(rival.team) : 'a rival'; return write('social', pick(r, MEDIA.social.leak), { driver: flop.code }); }
}

/** the market between seasons: compare the seats before and after (nextSeasonWorld) and write up who moved; ev (world.js marketMoves) names the sackings and the poaches */
export function coverMoves(save, before, retired, ev = { sacked: [], poached: [] }) {
  const now = save.world.seats, r = rng(save.seed, 'media', save.clock.season, 'market'), was = Object.fromEntries(Object.entries(before).map(([k, c]) => [c, k]));
  const track = null, W = MEDIA.window, fill = (t, ctx) => t.replace(/\{(\w+)\}/g, (_, k) => ctx[k] ?? ''), name = (c) => personOf(save, c)?.name ?? c;
  for (const x of ev.sacked) { const t = loreOf(x.team); story(save, 'fired', `${t.name} sack ${name(x.code)}`, `A season below what ${t.name} expected, and ${name(x.code)} pays for it. ${fill(pick(r, W.sack), { principal: t.principal })}`, { driver: x.code, mood: 'down', principal: x.team }); }
  for (const x of ev.poached) { const a = loreOf(x.from), b = loreOf(x.to); story(save, 'move', `${name(x.code)} walks out on ${a.name} for ${b.name}`, `${b.name} paid the release fee, and ${name(x.code)} drives for them next season. ${fill(pick(r, W.bitter), { principal: a.principal, rival: name(x.code) })}`, { driver: x.code, mood: 'portrait', principal: x.from }); }
  const told = new Set(ev.poached.map((x) => x.code));
  for (const code of retired) { const d = personOf(save, code); story(save, 'move', `${d?.name ?? code} retires`, `The paddock loses one of its own. ${pick(r, ['The tributes began before the announcement ended.', 'A seat is open, and everyone knows it.'])}`, { driver: code, mood: 'portrait', track }); }
  for (const [key, code] of Object.entries(now)) {
    if (!code || code === YOU || told.has(code) || was[code] === key || (was[code] && CAR[was[code]].team === CAR[key].team)) continue;   // a swap inside one team (the player's promotion) is no move
    const d = personOf(save, code), team = loreOf(CAR[key].team).name;
    if (was[code]) story(save, 'move', `${d.name} moves to ${team}`, `Out of ${loreOf(CAR[was[code]].team).name}, and into a ${team} seat for next season. Contract talks were not friendly.`, { driver: code, mood: 'portrait', track });
    else if (d.name && !LORE[code]) story(save, 'move', `${team} promotes ${d.name}`, `An academy rookie, called up for next season. ${team} says the data made the decision.`, { track });
    else story(save, 'move', `${d.name} returns with ${team}`, `A year without a seat is over.`, { driver: code, mood: 'portrait', track });
  }
}
/** the market week's rumour (career.js marketRumours): a seat up for renewal and its shortlist, named in `list` */
export function coverRumour(save, x, list) {
  const r = rng(save.seed, 'media', save.clock.season, 'rumour'), d = personOf(save, x.code), ctx = { driver: d?.name ?? x.code, team: loreOf(CAR[x.car].team).name, list };
  const fill = (t) => t.replace(/\{(\w+)\}/g, (_, k) => ctx[k] ?? '');
  story(save, 'rumor', fill(pick(r, MEDIA.rumour.title)), fill(pick(r, MEDIA.rumour.body)), { driver: x.code, mood: 'portrait' });
}
/** the player took the seat of a driver who now has no drive (acceptOffer) */
export function coverDisplaced(save, code, team) {
  const d = personOf(save, code); if (!d) return;
  story(save, 'fired', `${loreOf(team).name} drops ${d.name}`, `The seat has gone to ${save.player.name}. ${d.name} found out from the team's statement, and is not hiding it.`, { driver: code, mood: 'down' });
}
/** the player signs for a new team (acceptOffer) */
export function coverSigning(save, team) {
  const t = loreOf(team), me = save.player.name;
  story(save, 'move', `${me} signs for ${t.name}`, `${t.principal} makes it official: ${me} drives for ${t.name}. ${t.line}`, { you: `sign-${team}` });
}
/** the seat review turns against the player, mid-season */
export function coverHotSeat(save, team) {
  const t = loreOf(team), me = save.player.name;
  story(save, 'fired', `${t.principal} is losing patience with ${me}`, `The results are not good enough, and ${t.name} has told ${me} so. The review at the finale will decide the seat.`, { principal: team });
}
/** the player ignored the team's order to let the teammate by (finishRace) */
export function coverOrders(save, code, team) {
  const t = loreOf(team), me = save.player.name, d = personOf(save, code);
  story(save, 'duel', `${me} ignores team orders`, `${t.name} told ${me} to let ${d?.name ?? 'their teammate'} through on the last lap. ${me} kept the place, and ${t.principal} was not smiling in the garage.`, { driver: code, mood: 'down', principal: team });
}
/** the principal at the season-end market (endSeason), when the player was given a team order this season: they quote how it went */
export function coverPrincipal(save, team) {
  const cb = callbackOf(save, 'principal', { team, kinds: ['orders_obeyed', 'orders_ignored'] }, 0); if (!cb) return;
  story(save, 'duel', `${loreOf(team).principal} on team orders`, cb.text, { principal: team, driver: cb.entry.who });
}
/**
 * A line that quotes the ledger back (media.json callbacks[context]): the newest entry that matches `filter` (ledger.js) and has a line in this context, no older than
 * `seasons`; { text, entry } or null. The pick of wording is seeded on the entry, so a line reads the same every time it is shown
 */
export function callbackOf(save, context, filter = {}, seasons = 1) {
  const L = MEDIA.callbacks[context], e = latest(save, { ...filter, kinds: (filter.kinds ?? Object.keys(L)).filter((k) => L[k]) });
  if (!e || save.clock.season - e.s > seasons) return null;
  const who = e.who ? personOf(save, e.who)?.name ?? e.who : '', lore = e.team ? loreOf(e.team) : null, ctx = { who, me: save.player.name, team: lore?.name ?? '', principal: lore?.principal ?? '', season: e.s };
  return { text: pick(rng(save.seed, 'callback', context, e.kind, e.s, e.r), L[e.kind]).replace(/\{(\w+)\}/g, (_, k) => ctx[k] ?? ''), entry: e };
}
/** the player is let go at the season end for bad results (endSeason) */
export function coverFired(save, team) {
  const t = loreOf(team), me = save.player.name;
  story(save, 'fired', `${t.name} sacks ${me}`, `After a season below what the seat demands, ${t.principal} has shown ${me} the door. The garage was cleared before the statement went out.`, { you: 'fired', scene: null });
}

/** an off-track story (life.js, the Shop): a purchase, a party, a scandal, a holiday, a gala, an ad, a mood. `key` is an item id or one of the events in media.json "life"; ctx fills {brand} and {item} */
export function coverLife(save, key, ctx = {}) {
  const t = MEDIA.life[key]; if (!t) return;
  const r = rng(save.seed, 'media', save.clock.season, 'life', save.clock.week ?? 0, key), s = pick(r, t.stories), fill = (x) => x.replace(/\{(\w+)\}/g, (_, k) => ({ me: save.player.name, team: loreOf(save.contract.team).name, brand: ctx.brand ?? 'A sponsor', item: ctx.item ?? 'it' })[k] ?? '');
  story(save, t.kind ?? 'life', fill(s.title), fill(s.body), { you: t.you ?? null, scene: t.scene ?? null, track: ctx.track ?? null });
}

// ---------------------------------------------------------------------------------------------- pictures
export const driverSlug = (name) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
const driverImage = (save, code, mood) => {
  const have = MEDIA.images[code], name = LORE[code]?.name; if (!have || !name) return null;     // the player and academy rookies have no press photo
  const pic = have.includes(mood) ? mood : have.includes('portrait') ? 'portrait' : have[0];
  return pic ? `/assets/drivers/${driverSlug(name)}/media/${pic}.webp` : null;
};
/** a tile's or a byte's small copy; the circuit stills are shared and few, so they have none */
export const thumbOf = (url) => (url?.startsWith('/assets/drivers/') ? url.replace(/\.webp$/, '-thumb.webp') : url);
/** the picture for a story: the pair's shot, a shared scene, the player's shot, the principal, else the driver in that mood, else their portrait, else the circuit, else nothing. `moved`: the driver has since changed team, so the suit is an older one */
export function storyImage(save, s) {
  const pair = s.pair && MEDIA.pairs.find((p) => s.pair.every((c) => p.drivers.includes(c)));
  if (pair) return { pair: true, url: `/assets/drivers/pairs/${pair.id}.webp` };
  if (s.scene && MEDIA.scenes.includes(s.scene)) return { url: `/assets/drivers/scenes/${s.scene}.webp` };
  const you = s.you && (MEDIA.you.includes(s.you) ? s.you : !s.you.startsWith('sign-') && MEDIA.you.includes('portrait') ? 'portrait' : null);
  if (you) return { url: `/assets/drivers/you/${you}.webp` };
  if (s.principal && MEDIA.principals.includes(s.principal)) return { url: `/assets/drivers/principals/${s.principal}.webp` };
  const url = s.driver && driverImage(save, s.driver, s.mood), key = s.driver && carOf(save, s.driver);
  if (url) return { url, driver: true, moved: !!key && CAR[key].driver.code !== s.driver };
  return s.track ? { track: s.track } : {};
}
