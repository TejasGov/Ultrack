// Choices with consequences (docs/career-mode.md 6.9): small decisions that arrive in the inbox, each button saying what it does. Pure, like the rest of career/.
// The scenes are data (assets/career/choices.json); their triggers are the predicates below. One a week at most, perSeason a season, rolled with
// rng(seed, 'choice', season, week) and stored in season.choices[id] = { id, scene, week, ctx, answer (option index or null), auto (the default was taken) }.
import CH from '../../../../assets/career/choices.json';
import { CAR, SPONSORS, clamp, tierOf, levelOf, loreOf, composureOf, seatCar, otherSeat } from './rules.js';
import { rng } from './rng.js';
import { YOU, personOf, nemesisAmong, heatUp, rivalsOf } from './world.js';
import { note } from './ledger.js';
import { post } from './inbox.js';
import { story } from './media.js';

export { CH as CHOICES };
/** the only effects an option can have, and the most any one of them moves (test-career checks every option against both) */
export const EFFECTS = { trust: 5, rep: 15, xp: 100, heat: 20, interest: 0.15, note: null, flag: null, mood: 1, story: null };
const SCENES = Object.fromEntries(CH.scenes.map((s) => [s.id, s]));
const kindOf = (e) => Object.keys(e).find((k) => k in EFFECTS);

/** when a scene can arrive, from the save as it stands on entering a week: its context, or null */
const TRIGGERS = {
  /** a rumour from the market week (offers.js rumours) that has the player on a shortlist */
  rumour: (save) => {
    const x = save.season.weeks[save.clock.week]?.kind === 'market' && (save.season.rumours ?? []).find((r) => r.list.includes(YOU));
    return x ? { who: x.code, team: CAR[x.car].team } : null;
  },
  /** the hottest driver at 70+ will race the next round and is easily rattled (composure under callout.composure) */
  callout: (save) => {
    const W = save.world, n = nemesisAmong(save, Object.keys(W.seats)), R = save.season.calendar[save.clock.round];
    if (!n || !R || composureOf(W.ratings[n.code], W.ages[n.code]) >= CH.callout.composure) return null;
    const higher = tierOf(CAR[n.key].team).rank > tierOf(save.contract.team).rank;
    return { who: n.code, team: CAR[n.key].team, gp: R.name, stake: Math.round(CH.callout.win.rep * (higher ? CH.callout.higherTier : 1)) };
  },
  /**
   * The week after a round the papers write the player up for (media.js coverRound): a podium, a finish press.gap or more places either side of the
   * expected one, a retirement or a missed cut. The named driver is the hottest rival, else the teammate
   */
  press: (save) => {
    const r = save.season.results.at(-1), P = CH.press; if (!r || save.season.weeks[save.clock.week - 1]?.kind !== 'race') return null;
    const news = r.dnf || r.dnq || r.finish <= 3 || Math.abs(r.finish - r.expPos) >= P.gap, who = rivalsOf(save)[0]?.code ?? save.world.seats[seatCar(save.contract.team, otherSeat(save.contract.seat))];
    return news && who && who !== YOU ? { who, gp: r.name, exp: r.expPos, result: r.dnq ? P.dnq : r.dnf ? P.dnf : `P${r.finish}` } : null;
  },
};

const fill = (save, text, ctx) => text.replace(/\{(\w+)\}/g, (_, k) => {
  const name = ctx.who ? personOf(save, ctx.who)?.name ?? ctx.who : '';
  return { who: name, surname: name.split(' ').at(-1), team: ctx.team ? loreOf(ctx.team).name : '', me: save.player.name }[k] ?? String(ctx[k] ?? '');
});
/** a scene as the inbox shows it: the record, its title and options in words, and whether it still waits for an answer; null for another season's */
export function choiceOf(save, id) {
  const rec = save.season?.choices?.[id], sc = rec && SCENES[rec.scene]; if (!sc) return null;
  return { ...rec, open: rec.answer === null, title: fill(save, sc.title, rec.ctx), options: sc.options.map((o) => ({ label: fill(save, o.label, rec.ctx), effectText: fill(save, o.effectText, rec.ctx) })) };
}
export const openChoices = (save) => Object.keys(save.season?.choices ?? {}).map((id) => choiceOf(save, id)).filter((c) => c?.open);

/** on entering a week (career.js enterWeek): the first scene whose trigger holds and whose chance the week's roll is under, if the week and the season have room */
export function poseWeek(save) {
  const S = save.season, C = (S.choices ??= {}), id = `s${save.clock.season}w${save.clock.week}`;
  if (C[id] || Object.keys(C).length >= CH.perSeason || !save.contract) return null;
  const r = rng(save.seed, 'choice', save.clock.season, save.clock.week)();
  for (const sc of CH.scenes) { const ctx = r < sc.chance && TRIGGERS[sc.trigger](save); if (ctx) return pose(save, sc.id, ctx, id); }
  return null;
}
/** a scene arrives in the inbox (poseWeek; the tests pose one directly) */
export function pose(save, scene, ctx, id = `s${save.clock.season}w${save.clock.week}`) {
  const sc = SCENES[scene]; (save.season.choices ??= {})[id] = { id, scene, week: save.clock.week, ctx, answer: null, auto: false };
  post(save, 'choice', fill(save, sc.title, ctx), `${fill(save, sc.body, ctx)} Answer this week, or "${fill(save, sc.default, ctx)}" is taken for you.`, { choice: id });
  return choiceOf(save, id);
}
/** the player answers scene `id` with option `i`: its effects apply once. Returns the option in words, or null for a scene that is gone or answered */
export function answerChoice(save, id, i, auto = false) {
  const rec = save.season?.choices?.[id], sc = rec && SCENES[rec.scene], o = sc?.options[i]; if (!o || rec.answer !== null) return null;
  Object.assign(rec, { answer: i, auto });
  for (const e of o.effects) DO[kindOf(e)](save, e[kindOf(e)], e, rec.ctx, sc);
  const m = save.inbox.find((x) => x.action?.choice === id); if (m) m.read = true;
  const out = choiceOf(save, id).options[i];
  if (auto) post(save, 'news', `No answer: ${choiceOf(save, id).title}`, `"${out.label}" was taken for you. ${out.effectText}.`);
  return out;
}
/** the week is over (career.js advanceWeek, finishRace): every scene still open takes its stated default, with a note */
export function settleChoices(save) {
  for (const c of openChoices(save)) { const sc = SCENES[c.scene]; answerChoice(save, c.id, sc.options.findIndex((o) => o.label === sc.default), true); }
}
const DO = {
  trust: (save, v) => { if (save.contract) save.contract.trust = clamp(save.contract.trust + v, 0, 100); },
  rep: (save, v) => { save.career.rep = clamp(save.career.rep + v, 0, 1000); },
  xp: (save, v) => { save.career.xp += v; save.career.cl = levelOf(save.career.xp); },
  heat: (save, v, e, ctx) => { if (ctx.who) heatUp(save, ctx.who, v, e.cause); },
  interest: () => {},                                          // read back from the answered scene by leanOf, so it lasts exactly this season
  note: (save, kind, e, ctx) => note(save, kind, { who: ctx.who ?? null, team: ctx.team ?? null }),
  flag: (save, kind, e, ctx) => { save.season.current.flag = { kind, who: ctx.who }; },   // season.current is the next round's, replaced after it: the flag lasts one race
  mood: (save, v) => { for (const d of save.sponsors?.deals ?? []) d.mood = clamp(d.mood + v, 1, SPONSORS.startMood + 3); },
  story: (save, key, e, ctx, sc) => { const s = sc.story[key]; story(save, s.kind, fill(save, s.title, ctx), fill(save, s.body, ctx), { driver: ctx.who ?? null, mood: 'portrait' }); },
};
/** this season's extra interest from `team` that answered scenes asked for (rules.js interestTerms lean) */
export const leanOf = (save, team) => Object.values(save.season?.choices ?? {}).reduce((a, c) => a + (c.answer !== null && c.ctx.team === team ? SCENES[c.scene].options[c.answer].effects.reduce((s, e) => s + (e.interest ?? 0), 0) : 0), 0);

/**
 * The round is done (career.js finishRace, with its classification `order`, those who missed the cut after those who raced): an accepted callout pays once. Finishing ahead of
 * the driver who called the player out pays reputation (more against a higher tier) and XP; finishing behind, or retiring, costs reputation; the ledger and the press remember it.
 * { won, rep, xp, name }, or null with no callout (or that driver not in the classification: a round they sat out)
 */
export function settleCallout(save, order, hero, dnf) {
  const f = save.season.current.flag; if (f?.kind !== 'callout' || f.paid) return null;
  f.paid = true;
  const key = order.find((k) => save.world.seats[k] === f.who), me = order.indexOf(hero); if (!key || me < 0) return null;
  const won = !dnf && order.indexOf(key) > me, P = CH.callout, higher = tierOf(CAR[key].team).rank > tierOf(save.contract.team).rank, R = save.season.calendar[save.clock.round];
  note(save, won ? 'callout_won' : 'callout_lost', { who: f.who });
  DO.story(save, won ? 'won' : 'lost', null, { who: f.who, gp: R.name }, SCENES.callout);
  return { won, rep: won ? Math.round(P.win.rep * (higher ? P.higherTier : 1)) : P.lose.rep, xp: won ? P.win.xp : 0, name: personOf(save, f.who)?.name ?? f.who };
}
