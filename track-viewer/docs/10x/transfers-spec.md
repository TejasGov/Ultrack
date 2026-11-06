# Transfers with drama: spec

From the user (2026-11-06): moving to another team should feel like a game, with negotiations and drama like other games, not an obligation that just happens. Lower teams usually end up firing drivers and hiring from a slightly better team when that driver has little loyalty to their own. The player never sees or cares about that loyalty; it runs on the backend.

## Starting point

Read `src/game/career/offers.js`, `world.js`, `career.js` (endSeason, acceptOffer, nextSeasonWorld), `media.js` (coverMoves and the cover* helpers), `src/game/career-deals.js` (the deal screen), and the review and Deals parts of `career-hub.js`.

How it works today:
- At the season end, `seasonOffers` lists every offer at once.
- On the deal screen the player sets the levers (salary, signing, length, status) and proposes. The team accepts within leverage, otherwise counters and loses patience. Out of patience, it walks.
- The player signs one offer and the next season starts. Nothing changes while the player is deciding. No one else wants the seat. The player's own team answers once, with a fixed counter.

## Part A: the transfer window (season end)

1. **A window of days.**
   - `endSeason` opens `save.pending.window = { day: 0, days: 3, news: [] }` (`tuning.window.days`).
   - The review/market screen shows "Day 1 of 3" and makes the last day read as **Deadline day**.
   - A new pure function `windowDay(save)` advances a day. Signing any offer closes the window, as `acceptOffer` does today.
   - On deadline day, "Advance" becomes "Close the window": every outside offer not agreed lapses, and what remains is always signable.
   - Never a dead end (6.7): the player's own keep, renew, fallback or reserve offer never lapses.
2. **Deadlines.** Each outside offer has `deadline` (a day index). It is seeded from the team's style and interest: a keen team waits longer, and a hardball team gives 1 day.
   - The offer row and the deal screen show "Answer by Day N" or "Today".
   - An offer past its deadline that is not agreed lapses, with a news line and an inbox post.
3. **A rival for the seat.**
   - An outside offer can carry `rival`, an AI driver the team is also talking to. Pick the best market score from the seat's shortlist (`world.js shortlistOf`, seated drivers allowed), excluding the seat's own driver and the player.
   - It also carries `rivalDay`, the day the team signs that rival unless the player has agreed terms first. Seeded, and earlier when:
     - the player's demands pushed past leverage (each refusal brings it 1 day closer, never before today)
     - or the rival's market score beats the player's rating.
   - When the rival signs, the offer goes away. Post a story ("<rival> signs for <team>") in the news feed and inbox. The rival takes that seat in next season's world: make `marketMoves` honour it (`save.pending.window.signed[car] = code`, applied before the open-seat loop).
   - The deal screen shows the rival plainly: "Also in talks: Ortega (rated 84). They want an answer before Day 2."
4. **The player's own team reacts.**
   - On the first day the player has talked to another team (`season.talked`), the own team escalates once, if trust ≥ `trust.renew`:
     - the counter gets a further raise (`tuning.window.counterStep`),
     - or, for a B-seat driver, the A seat.
   - That is a news line and a principal quote.
   - If trust is low, the principal says so instead ("Go, if they want you").
5. **Teams improve on their own.**
   - Once per window, a team with a rival offer on the table for the player, keen (interest ≥ 0.6) and with patience left, raises its salary a step on the next day ("<team> come back with more").
   - Seeded, and at most one such raise per offer.
6. **News feed.**
   - `pending.window.news` holds the day's lines: deadlines, rival moves, raises, own-team reactions, leaks.
   - Leaks: a seeded chance per day that the press reports talks. Add a media story, with no gameplay effect at the season end.
   - Show the feed on the market screen, newest first. Use the inbox too, but the feed is where the drama reads.

## Part B: negotiation that is a game

1. **The principal's style.** Add `style` per team in `tiers.json`: `hardball`, `warm`, `bidder` or `frugal`, spread so no tier has two of a kind where possible. A style sets:
   - patience (refusals): hardball 2, warm 4, others 3
   - what the team gives most on (`prize`, a lever whose demand counts at half): warm → length, bidder → salary, frugal → signing and status, hardball → none
   - how it answers each tactic below

   On the deal screen, show the principal's name (loreOf(team).principal) and a one-line read of them ("Plays hardball: little patience, short deadlines"). Show the style, but not the exact numbers.
2. **Tactics.** Each can be used once per offer and is logged in the conversation, with a quote from the principal (media.json, per style). Each has a one-line hint of its risk on the button.
   - **Mention the other offer.** Needs another live outside offer. If that offer's salary is higher, the team raises toward it (bidder: matches it up to +20 %; others: half the gap; hardball: no raise, but no penalty). If it is lower, they see through it: patience −1, and the rival day moves 1 day closer.
   - **Meet the principal.** Reveals the team's prize lever in the log. Warm: leverage +1 for this offer. Hardball: patience −1 ("I don't do coffee"). Others: nothing more.
   - **Set a deadline.** The team answers today with its best terms within leverage: they become the counter, marked final. With a rival, they may sign the rival instead (a seeded roll on the rival's score against the player's rating). Bidder teams never call the bluff. Hardball teams call it more often.
   - **Say you want to be here.** Restores 1 patience (2 with warm teams) but lowers this offer's leverage by 0.5. It is the move for a seat you really want.
3. **Your own team.** The existing own-team trust cost stays. Tactics against your own team cost trust as a refusal does.
4. Sponsor talks are not touched.
5. **Mid-season.** In the market week, the W1, approach and transfer-demand offers get the same tactics and rival. Their window is the market week: `rivalDay` = week end and there are no day steps. Keep this part small; the season end is the main event.

## Part C: the hidden AI market (loyalty, sackings, poaching)

1. **Loyalty.** `world.loyalty[code]`, 0-100, for AI drivers only. It is never shown, never in a story's text as a number, and never in the UI.
   - The start is seeded at 40-80.
   - Each season at the same team: +8 (`market.loyaltyGrow`).
   - The team finished 2 or more places below its expPos in the Teams' table: −15.
   - Outscored by the teammate: −10.
   - A move resets it to 30, and an academy call-up starts at 60.
   - Clamp to 0-100.
2. **Sackings: lower teams fire.** After renewals in `marketMoves`, a team that underperformed may sack its lower-scoring driver. Underperformed means finishing 2 or more places below its expPos in the Teams' table, or sitting in the bottom half of its tier. The chance is `market.sackChance` (about 0.35, higher the further below expectation), when that driver is rated below the tier average − `market.sackGap` (3) or scored under 60 % of the teammate's points.
   - At most `market.maxSacks` (2) a season across the grid.
   - A sacked driver goes free. They are not the player's rival because of it.
   - Story: "<team> sack <driver>", with a principal quote.
3. **Poaching: hire from slightly better teams.** When an open seat is filled, also consider drivers under contract (any seasons left) at a team 1-3 expPos places better ("slightly upper"):
   - whose loyalty < `market.poachLoyalty` (45),
   - and for whom the move is a step up in status or seat: the B driver there gets the A seat here, or the move is into a higher tier, or a same-tier move with a better car (carZ).

   A seeded roll weighted by (poachLoyalty − loyalty) / poachLoyalty decides. The poached driver's old seat opens and joins the cascade. At most `market.maxPoach` (2) a season, separate from maxMoves. Never poach the player or the player's teammate in the player's first season at a team.

   Story: "<driver> walks out on <old team> for <new team>", with a line that the release fee was paid. The old principal is bitter, using a media.json template.
4. **Rumours.** `rumours()` may list a poach target on a shortlist; the shortlists use the same rule.
5. **Keep the guards.**
   - `career-metrics 100 6` must keep every target it had at 987a185..main (Legend any, final tiers, displaced, Number One offers, wallet guards).
   - Add measured lines: moves, sackings and poaches per season. Targets: sackings 0.3-1.5, poaches 0.3-1.5, total moves at most 5.
   - The player's career numbers (career-sim) must stay within ±5 pp of main, except where the window's drama is meant to change them. If it changes a number on purpose, say which and why in the docs.

## Save and determinism

- Schema 10 → 11. Migration:
  - `world.loyalty` is seeded per driver.
  - A save in the review phase gets a `pending.window` at day 0, with deadlines and rivals for its existing outside offers.
  - Old saves must load mid-season and at the review.
- Every roll is seeded (`rng(save.seed, ...)` with distinct tags). The same choices give the same window.

## UI

- **Market screen** (the season review's offer list):
  - the day header with a progress dots row
  - the news feed, newest first
  - offer rows with deadline and rival chips
  - "Advance day" / "Close the window" with a confirm when offers would lapse
- **Deal screen:**
  - a principal line with the style read
  - a rival line
  - the deadline
  - four tactic buttons in a row that wraps on a phone, each disabled with a reason when not usable
  - "final" marked on a counter after Set a deadline
- Render every piece at 1600×900 and 390×844 and check it: no overflow and nothing cut off, matching the existing hub's style. Save the shots in `qa/10x-scratch/transfers-ui/` (untracked).
- Text is plain and specific, they/them for people, and never names the hidden loyalty.

## Tests and docs

- `scripts/test-career.mjs`:
  - each tactic's outcomes per style
  - deadlines lapsing
  - a rival signing on its day, and in next season's seats
  - own-team escalation
  - never a dead end
  - determinism (the same save and actions give the same window)
  - loyalty updates
  - a sacking and a poach, by seeding a world that forces them
  - caps
  - migration 10 → 11
- `scripts/career-sim.mjs` and `career-metrics.mjs`: the sim player plays the window (sensible defaults: sign the best agreed offer by day 2), and the new metrics are added.
- `docs/career-mode.md`: a section on the window, tactics, styles and the hidden market, with tuning keys.
- Commit in steps: `career: <what>` / `game: <what>` / `docs: <what>`, ending with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
