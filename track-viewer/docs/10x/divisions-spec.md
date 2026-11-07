# Two series, one Tour: final build spec

Status: final spec, 2026-11-07, for the user's request to split the career into two leagues that move teams like football. Nothing here is built, tested or measured yet.

Base: origin/main f33630d, plus two branches that land first:
- **team/koenigsegg**: a ninth team, a third Legend team on two Koenigsegg cars at expPos 3, giving 9 teams and 18 drivers. This spec writes its id as `norrsken` (the id on that branch).
- **career/no-repeat-calendar**: still 10 rounds, 21 weeks, the market after round 5.

Line numbers are from f33630d. Re-check them after both branches land: `D:/RaceUltimate` is 7 commits behind and has no `transfers.js`.

Where it comes from: design 1 ("Elite Series / Challenger Series"), which all three judges ranked first, with these grafts:
- **From design 3:** `posIn` (expected place counted inside a series), the other series' qualifying reusing the `aiLap` laps that `finishQuali` already draws, the economy left alone with one fallback knob, and the market's `pts` reading the other series too.
- **From design 2:** `div` and `exp` stamped on every entry, the Open objective "Reach the Last Chance Qualifier", and rivals in the other series cooling at `sitOut`.

---

## 0. Decisions at a glance

1. **Names.**
   - **The Ultrack Tour** stays the name of the whole season: both series, three Opens, one Masters.
   - The top division is the **Elite Series** (short form "Elite", id `elite`).
   - The second division is the **Challenger Series** (short form "Challenger", id `challenger`).
   - Never F1, F2, Formula, Premier League or Championship, in code or copy.
   - The names live in `tuning.json`, so renaming is a one-line change.
2. **Tier and series are different things.**
   - **Tier** (Rookie, Maestro, Legend) is static data. It sets pay, gates, caps, sponsors, styles and the XP/rep scale. It does not change.
   - **Series** is saved state on each team (`world.teams[id].div`) and moves by promotion and relegation.
   - A promoted team keeps its tier, cars, drivers, dev levels and cap, so it starts as the slowest team up top.
3. **The split for 9 teams is 5 / 4 by expPos.**
   - Elite: aurum, saetta, norrsken, toro, sarab (10 cars, qualifying cuts 2).
   - Challenger: corvid, hayate, mojave, liberty (8 cars, everyone races).
   - A new player always starts in the Challenger: all three `firstJob` teams are there. They never miss a cut in their first season.
4. **One swap a season.** At `endSeason`, the Challenger Teams' P1 goes up and the Elite Teams' last place goes down. Teams move; drivers move only by contract. There is no playoff and no mid-season move.
5. **One calendar.** Every Tour round is the same weekend and circuit for both series. The player drives their own series; the other series' race is computed from seeded laps.
6. **Cups are shared and score no league points.** The three Opens and the Masters are entered from both series. They pay prize, reputation, ranking points and honours, but no Drivers' or Teams' series points. The league is the 6 Tour rounds, so it is settled at round 8. This is open decision D1.
7. **Two ranking tables, one points store.**
   - `save.ranking` is unchanged. `rankingOf(save, div)` filters it to one series.
   - Challenger Tour rounds score 0.6 × the ranking points.
   - **Opens:** 2 seeds from each series, interleaved E1 C1 E2 C2 on the Final grid. The Last Chance holds at least 2 Challenger cars.
   - **Masters:** top 5 Elite and top 3 Challenger, interleaved.
8. **Expected place is counted inside the series** (`posIn`). The global expPos (1..9) stays the strength order the market uses, and the season-end blend is unchanged.
9. **The economy is unchanged.** There is no Elite multiplier. One knob, `divisions.challenger.reward` (1.0), is touched only if a metric fails.
10. **Migration: a season under way finishes in the old format.**
    - The season has no `season.divs`, so every reader falls back to `'all'`: today's combined field, single ranking and tier Cup.
    - The split starts at the next `startSeason`.
    - Nothing already raced is reinterpreted, and no weekend is re-gridded.

---

## 1. Data

### `assets/career/tuning.json`

```jsonc
"divisions": {
  "order": ["elite", "challenger"],
  "eliteTeams": 5,          // the Elite takes min(eliteTeams, teams - minTeams): 9 teams -> 5/4, 8 -> 4/4, 10 -> 5/5
  "minTeams": 4,            // a series is never below 4 teams (8 cars = the grid); fewer teams overall: the game runs today's single field
  "swap": 1,                // teams up and down a season (only 1 is built)
  "legacyField": 16,        // the field size today's formulas assume; only legacy seasons and the regression tests read it
  "elite":      { "name": "Elite Series",      "short": "Elite",      "rank": 1,   "openSeeds": 2, "masters": 5 },
  "challenger": { "name": "Challenger Series", "short": "Challenger", "rank": 0.6, "openSeeds": 2, "masters": 3, "lcqMin": 2, "reward": 1 }
}
```

`rep` gains one key:

```jsonc
"rep": { ..., "cup": 40, "teams": 60, "drivers": 100, "challenger": 60 }
```

How the reputation keys are read now:
- `rep.challenger`: the Challenger Drivers' title.
- `rep.cup`: the bonus for promotion with your team.
- `rep.teams` and `rep.drivers`: the Elite titles.

Kept for legacy seasons only:
- `open.direct` (4) and `events.open.pts` / `events.masters.pts` (1.5), read only when the season has no `divs`.
- `tiers.json` `tiers.*.cup` names and `calendar.json` `worlds`, which history rows and legacy reviews still read.

Unchanged:
- `series` (gridSize 8, points, pole, fastestLap) and `ranking`.
- `open.lcqThrough` (4) and `events.*.prize` / `rep` / `rank`.
- `trust`, `offers`, `market` and `window`.
- Every 3-long tier array.

### Other data files

- `assets/career/tiers.json`: no change. A team has no `div` field; the split is derived from expPos, so new careers and migrated saves use one rule.
- `assets/career/media.json`: a new `divisions` group (§11).
- `calendar.json`, `drivers.json`, `teams.json`, `lifestyle.json`: no change.

---

## 2. Saved state

| Field | Meaning |
|---|---|
| `world.teams[id].div` | `'elite'` or `'challenger'`: the series this team races **next** (or now, outside a season). It changes only in `endSeason`. |
| `season.divs` | `{ teamId: div }`, a snapshot taken at `startSeason`. Everything during the season and in its review reads it. **When it is absent, the season is a legacy season** (one combined field, as today). |
| `season.div` | The player's series this season. `season.tier` stays. |
| `entry.div`, `entry.exp` | On every entry of every round (Tour, Open, Masters, the other race): the driver's series and their expected place at race time. Readers never re-derive them after expPos moves. |
| `report.other` | `{ div, entries }`: the other series' race at a Tour round (§4). |
| `report.field` | Cars classified in the player's race: 8 or 10 at a Tour round, 18 at an Open or the Masters. |
| `history[]` row | Gains `div`, `teamCount` (teams in the player's series) and `swap: { up, down }`. `teamOrder` becomes the Elite table followed by the Challenger table, still all 9 teams. |
| `stats.promotions`, `stats.relegations` | Seasons in which the player's team went up or down while they drove for it. They start at 0. |
| `stats.cups` | From now on counts **Challenger Drivers' titles**. Old tier Cups stay counted, and the Driver tab label becomes "Challenger titles / Cups". Aurum's want `cups + titles` still reads right. |

---

## 3. New pure helpers (`career/rules.js`; no new module)

```js
export const DIV = T.divisions;
export const eliteSize = (n = TEAM_IDS.length) => Math.min(DIV.eliteTeams, n - DIV.minTeams);
export const divsOn = (n = TEAM_IDS.length) => n >= 2 * DIV.minTeams;     // below 8 teams: today's single field
/** this season's series of a team ('all' in a legacy season); outside a season, the world's */
export const divOf = (save, team) => save.season ? (save.season.divs?.[team] ?? 'all') : save.world.teams[team].div;
export const nextDivOf = (save, team) => save.world.teams[team].div;
export const teamsIn = (save, d, dv = divOf) => TEAM_IDS.filter((t) => d === 'all' || dv(save, t) === d);
export const carsIn = (save, d, dv = divOf) => Object.keys(save.world.seats).filter((k) => save.world.seats[k] && (d === 'all' || dv(save, CAR[k].team) === d));
/** a team's place among its series' teams by global expPos (a count, so expPos need not be contiguous inside a series) */
export const posIn = (save, team, dv = divOf) => { const d = dv(save, team), e = save.world.teams; return 1 + teamsIn(save, d, dv).filter((t) => e[t].expPos < e[team].expPos).length; };
export const expIn = (save, team, seat, dv = divOf) => expOf(posIn(save, team, dv), seat, 2 * teamsIn(save, dv(save, team), dv).length);
```

Notes on the helpers:
- **`expOf(pos, seat, n = 2 * TEAM_IDS.length)`.** The hard-coded 16 clamp becomes `n`. At Opens and the Masters it is the global expected place of the 18 drivers.
- **Legacy.** In a legacy season `teamsIn` is every team and `posIn` equals the global expPos, so `expIn` equals today's `expOf` exactly.
- **`lcqGrid(order, isChallenger, min, G)`** returns the first G of `order` with at least `min` Challenger keys. If fewer than `min` make it on time, the fastest Challenger laps replace the slowest Elite ones. The grid stays in lap order.
- **`interleave(a, b, n)`** returns a1 b1 a2 b2 ... until one list runs out, then the rest of the other, cut at n. The seed lists use it.

---

## 4. Qualifying and the race field (Tour rounds)

### `startSeason` (career.js:177)

- Set `season.divs` from `world.teams[*].div` and `season.div` from the player's team.
- The season post replaces `TIERS.tiers[tier].cup` with `DIV[div].name`.
- Assert `carsIn(save, d).length >= gridSize` for both series. That holds because sizes are fixed and the market fills every seat.

### `prepareRound` (career.js:190)

- **Tour round:** `cur.expPos = expIn(save, me.team, me.seat)` and `cur.field = carsIn(save, season.div).length`.
- **Open or Masters:** `cur.expPos = expOf(world.teams[me.team].expPos, me.seat)` and `cur.field = 2 * TEAM_IDS.length` (18).
- **Legacy:** as today, with `cur.field = DIV.legacyField`.
- `objectivesFor(..., cur.field)` (§7).

### `finishQuali` (career.js:377)

- It still draws a lap for **every** seated car. The rng tags and loop are unchanged, so the other series' laps cost no new draw.
- `order` is the sorted laps of `carsIn(save, season.div)` only. `grid = order.slice(0, gridSize)`. `laps` keeps every car's lap, because the other race reads it.
- **In the Challenger** (8 cars), everyone races and qualifying only sets the grid. A player with no valid lap sorts last and starts P8. `finishDnq` cannot happen there.
- **In the Elite** (10 cars), the slowest 2 miss the cut, as today.
- Unchanged: the podium skip (`qualiExemption`), the duel, the venue and the retries.
- **At Opens**, every non-seed of both series flies a lap (14 drivers). The LCQ grid is `lcqGrid(order, isCh, DIV.challenger.lcqMin, gridSize)`. The same rule applies in `openWeek` for a seeded player. Set `cur.open.lcqIn = grid.includes(hero)`.

### The other series' race, `otherRace(save)` (new, career.js)

Called in `finishRace` for `kind === 'tour'` in divided seasons, on every path that scores a Tour round, the DNQ path included. Check at build that `finishDnq` ends in `finishRace`; if it does not, call `otherRace` there too.

1. `keys = carsIn(save, otherDiv)`, sorted by `cur.quali.laps`. The grid is the first 8.
2. `sim = simRace(save, grid, 'o', R)`. **`'o'` is the only new noise key.**
3. Order = `sim.order`, then the cars that missed the cut in lap order.
4. Points: `series.points[i]`, pole +2 to the fastest qualifying lap, fastest lap +1 from `sim.best`. Cars that missed the cut score 0.
5. Entries have the same shape as `report.entries`, plus `div` and `exp` (`expIn`). Store them as `report.other = { div, entries }`.

### Unchanged on the race side

- The player's classification (finishRace:464–466) covers only their series, because `quali.order` is already filtered.
- `raceSetup`, `fieldOf`, `game.js`, `cars.js` and `gridSlots` 8 are untouched.

### Sponsor Challenge

`challengeSetup` (417–422) draws candidates from `carsIn(save, season.div)`, sorted by `expIn`. The Challenger always has 6 cars besides the player and their teammate, so the field is always full.

---

## 5. Standings, points and titles

### Points

- **Tour rounds:** unchanged. 8 places, pole +2, fastest lap +1, and a reserve driver scores nothing in rounds 1–2.
- **Opens and the Masters in a divided season:** `pointsMult` returns 0, and pole and fastest lap score no series points.
  - Each entry stores `rpts`, the ranking points it earned.
  - The round report shows a "Ranking" column for these kinds in place of "Pts".
- **Legacy seasons:** ×1.5, as today.

### `standings(save, d = season.div)` (career.js:597)

- **Sources:** Tour-round `entries` plus `other.entries`, keeping only `e.div === d`.
  - A win is counted when an entry is first of its own list.
  - Teams with no points are filled in from `teamsIn(save, d)`.
- **Order:** points, then wins, then global expPos, then team id. The id is a new last key, so ties are fully deterministic.
- **Returns** `{ div, drivers, teams }`, both for that series.
- **Legacy (`d === 'all'`):** today's function, with `cup` included.

### Titles in `endSeason` (career.js:611), in this order

1. `st = standings(save)` for the player's series. Also build `E = standings(save, 'elite').teams` and `C = standings(save, 'challenger').teams`.
2. **The swap:** `up = C[0].team` and `down = E.at(-1).team`. Write `world.teams[up].div = 'elite'` and `world.teams[down].div = 'challenger'`. `season.divs` is not touched.
3. Rewards:

| Result | Reward |
|---|---|
| Elite Drivers' champion | rep +100 (`rep.drivers`), `stats.titles++` |
| Elite Teams' champion | rep +60 (`rep.teams`) |
| Challenger Drivers' champion | rep +60 (`rep.challenger`), `stats.cups++`, and the tier's `bonus.cup` coins, labelled "Challenger title" |
| Your team promoted (Challenger Teams' P1) | rep +40 (`rep.cup`), `stats.promotions++` |
| Your team relegated (Elite Teams' last) | no reputation or trust penalty (the Round Ratings already judged you), `stats.relegations++` |

4. **History row:** add `div`, `teamCount` and `swap`. `teamOrder` = `[...E, ...C]`.
5. **`pending.review`** gains `div`, `teamCount`, `swap`, `yourTeam: 'up' | 'down' | null` and `nextDiv`.
6. **`seasonOffers(save, { cup, title, dropped })`**: `cup` means the player's team won its series' Teams' table, and `title` means their series' Drivers' title. The Number One gate code (offers.js:320) is unchanged; only its inputs change. Offers are generated after step 2, so they see next season's series.

### Legacy season end

No swap, and no new rewards: today's Cup and titles. A migrated save already has `world.teams[*].div`.

---

## 6. Promotion, relegation and next season

### The rule

- One for one: the Challenger Teams' champion and the Elite Teams' last place. Ties follow the standings sort.
- Sizes never change, so the series stay 5 and 4 for the whole career.

### `nextSeasonWorld` (career.js:636–648)

- No change in code. Dev +1 under the tier cap, `marketMoves`, then the expPos blend `0.5·expPos + 0.5·(teamOrder index + 1)` re-sorted 1..9.
- `posIn` makes the series place right whatever the blend gives:
  - the promoted team is 5 of 5 up top;
  - the relegated team is usually 1 of 4 below.
- There is no block re-sort and no block invariant.

### The player's team is promoted mid-contract

- The contract is untouched: team, seat, salary, seasons, status, trust and caps.
- Next season they is expected P9 or P10 of 10, so their objective can be "Qualify P9 or better" and they can miss the cut. That is the earned cost of a bigger stage.
- The `-keep` offer row reads "Your contract runs N more seasons, in the Elite Series."

### The player's team is relegated mid-contract

- The same contract, with no automatic release.
- The existing market already lets them leave: an outside offer buys them out (`acceptOffer`, `releaseCut`).
- The review line: "Corvid go down. Your contract stands; any team that signs you buys you out."

### Not built

No playoff, no cap or dev bonus for a promoted team, no relegation clause, no loyalty shifts, no "Stay and bring us back" offer, and no mood lines for promotion or relegation (the press story and inbox carry it). Yo-yo dampers are open decision D4.

---

## 7. Expected place, objectives, rating, XP

### `objectivesFor(r, exp, easier, exempt, reach, N = DIV.legacyField, G = T.series.gridSize, reachLcq = false)` (rules.js:199)

- `exp > G && !exempt`: the main objective is `quali`, with `n = easier ? min(exp+1, N) : min(exp, N−1)`.
- Otherwise the main objective is `finish`, with `n = easier ? min(exp+1, G) : min(exp, G−1)`.
- The podium objective joins the pool when `exp <= floor(N · 3 / 8)`. That is 6 at N = 16 or 18 (today's value, and the Opens are unchanged), and 3 at N = 8 or 10.
- **`reachLcq`** is for an unseeded Challenger driver at an Open:
  - mandatory: `{ kind: 'reach', stage: 'lcq', to: 'the Last Chance Qualifier' }`;
  - optional: `{ kind: 'reach', to: '<Open> Final' }`, in place of one pooled optional.
- **`objectiveMet.reach`** (rules.js:213): `o.stage === 'lcq' ? !!x.lcqIn : !x.dnq`. `finishRace` and `absentFinal` put `lcqIn` from `cur.open.lcqIn` into `x`.
- Unchanged: `trustFor({ neutral })`, so missing an Open never costs trust.
- **Regression:** at N = 16 and G = 8 the output is byte-identical to today's for every exp from 1 to 16, with easier and exempt both on and off.

Examples:

| Case | Expected | Objective |
|---|---|---|
| Challenger, Liberty B | P8 of 8 | "Finish P7 or better" (P8 when easier) |
| Challenger, Hayate B | P4 of 8 | "Finish P4 or better"; podium in the pool |
| Elite, promoted Rookie B | P10 of 10 | "Qualify P9 or better" |

### `roundRating` and `xpFor` (rules.js:137–168)

- Both take `field` (default `DIV.legacyField`).
- The hard-coded `/2` on place and qualifying differences becomes `/ (field / gridSize)`:

| Field | Divisor |
|---|---|
| 16 (legacy, unchanged) | 2 |
| 8 (Challenger) | 1 |
| 10 (Elite) | 1.25 |
| 18 (Opens, Masters) | 2.25 |

- `finishRace` passes `cur.field`.
- **Regression:** with field 16 the output is identical to today's.

### Other readers

| Reader | Change |
|---|---|
| `seasonForm` (rules.js:239) | `(e.exp − place)` from the stamped entries, the other race's entries included. Old entries without `exp` fall back to today's formula. |
| `giantKills` (career.js:479) | Count entries behind the player with `e.exp < myExp` whose team has a higher tier rank **or** races in the Elite while they race in the Challenger. Only the Opens and the Masters mix series. |
| `heatAfter` higher-tier bonus (world.js:200), callout stake (choices.js:34, 110) | The same "higher tier or higher series" test. |
| `heatAfter` cooling (world.js:207) | A rival in the other series cools by `rivals.sitOut` (1), not `decay` (4), on Tour rounds. The term is `-(me < 0 \|\| otherDiv(code) ? R.sitOut : R.decay)`. A feud therefore survives until the next Open. |
| `targetFor` (sponsors) | Reads `cur.expPos`, now the series place. The 3..7 clamp still fits. No code change. |
| `life.js:62` "A seat below your form" | `x.expTeam >= 6` becomes `x.div === 'challenger'`. `settleLife` passes `div: season.div` (or `'all'` with today's test in a legacy season). |
| Global expPos readers, unchanged | `shortlistOf`, `poachable`, the market's `below`/`ranked`/seat order, `fallbackOffer` and `rumours` sorts, the standings tie-break. |

---

## 8. Rankings, the Opens and the Masters

### Ranking (`career/ranking.js`)

- **`rankingOf(save, d = playerDiv(save))`** filters seated drivers to `carsIn(save, d)` and ranks them 1..10 or 1..8.
  - `d = 'all'` (legacy, or explicit) is today's list.
  - `playerRank(save)` is the rank in the player's table.
- **`rankPoints(place, kind, f = 1)`** multiplies by `f`.
  - In `finishRace`, a Tour round's day map adds the player's series' entries with `DIV[div].rank` and `report.other` entries with the other series' `rank`.
  - So an Elite win is 25 and a Challenger win is 15. Opens (×2.5) and the Masters (×3) use `f = 1` for everyone.
  - It is one day, as today.
- **Unchanged:** `newRanking`, `addDay`, the 12-day window, the fade and the tie-breaks. The player starts at 66, last of the Challenger table. Past days are not rescaled.

### Open entry (`openEntry`, career.js:201)

1. **Seeds:** `interleave(top 2 of the Elite ranking, top 2 of the Challenger ranking)`, giving E1 C1 E2 C2.
2. The other 14 fly one lap at the qualifying venue, with one retry.
3. **The Last Chance:** `lcqGrid` gives 8 cars with at least 2 Challenger cars. The top 4 (`lcqThrough`) reach the Final.
4. **Final grid:** the seeds in interleaved order, then the 4 Last Chance finishers in finishing order. `setFinal` and `closeLcq` are unchanged; they already keep `o.seeds` order.
5. **`cur.open`** gains `div`, `rank` (the table rank) and `cut` (`DIV[div].openSeeds`). `seeded = seeds.includes(car)`.

### Masters

- Seeds are `interleave(top 5 Elite, top 3 Challenger, 8)`, giving E1 C1 E2 C2 E3 C3 E4 E5.
- If a series has fewer drivers than its quota, the other series' next-ranked fill the places, so the Masters always has 8.
- `openWeek`'s `rest` comes from `rankingOf(save, 'all')`.

### What stays

`recordOpen`, the hall (its rows gain `div`), the Triple Crown and the Grand Slam, `absentFinal`, the LCQ race and the practice locks.

### What the Challenger player can aim for at the cup nights

- Top 2 of their table: an Open Final seed, on the front row next to the Elite leader.
- Top 3 of their table: the Masters.
- Otherwise: a top-2 Challenger lap guarantees the Last Chance, which is their round objective.

---

## 9. Economy

- **Unchanged, all by tier:** salary, `tiers.prize`, objective money, win and podium bonus, sponsors, `sponsorSlots`, `adPay`, the upgrade cap, the dev cap, staff and repairs.
- **No series multiplier on Elite or Opens.** The Maestro and Legend baselines stay exactly as they are.
- **`divisions.challenger.reward`** (1.0) multiplies three things in Challenger Tour rounds only: the race prize lines, the win/podium bonus and the XP line "Finished P n". It is touched only by §14's rule.
- **New money:** only the Challenger title's `bonus.cup` coins. The promotion bonus is reputation only. The old tier Cup paid the same coins for a sub-table title, so the wallet is at parity.

---

## 10. Offers, gates and the market

### The player's offers (`offers.js`)

- **One new rule: a step up in series counts as a step up.**
  - It applies when a team of the **same tier** races in the Elite next season while the player's team races in the Challenger (`nextDivOf`).
  - Such a team is treated like the tier above in `seasonOffers` (324–330: no strong-year or A-seat rule, no `sameTierInterest` cap, no `w1Roll` scale), in `teamOutlook` (no "No step up" block) and in `approach`.
  - Its outlook text reads "A step up: Elite Series".
- **Unchanged:**
  - gates (`tiers.json gate`, `interestTerms`, `interestOf`, `offerRoll`);
  - W1 `midSeason` (tier +1);
  - `demandTransfer`, `fallbackOffer`, `reserveOffer` (any Rookie team), `holdsSeat`;
  - sponsors, the transfer window, tactics and styles.
- **Offer cards:** an offer's `tier` stamp stays, and it gains `div: nextDivOf(team)` when it is made. A W1 offer from a team that then moves shows its new chip on the review card.

### AI market (`world.js marketMoves`)

- **`pts`** (about line 100) also sums `r.other?.entries`, so loyalty, the dropGap, sackings and form see the other series' points. Cup entries carry 0 series points, as in the standings.
- **One rule, `upDiv(save, fromTeam, toTeam)`:** no seated driver moves from an Elite team to a Challenger team. It is applied in `poachable` and in `shortlistOf`'s last-season drivers. Free agents go anywhere.
- **Unchanged:** `tierAvg`, renewals, `sackChance` and `poachScale` by tier rank, `maxMoves`, rival signings and the academy. The 3-long arrays stay.

---

## 11. Media and inbox

### `media.json` `divisions` group and `media.js` functions

| Function | When it runs | What it says |
|---|---|---|
| `coverSwap(save, swap)` | in `endSeason` | public: "{up} go up to the Elite Series", "{down} go down"; when it is the player's team: "You took {team} up" or "{team} go down. Your contract stands." |
| `coverChampions` | at the season end | one story per series champion |
| `coverGiantKill` | when a Challenger driver finishes on an Open or Masters podium | the player's version leads |

Use existing team photos; no new art.

### Inbox

- **Season start:** "Season 3 with Hayate: Challenger Series, 10 rounds, 21 weeks." Plus the target: "Win the Challenger and Hayate go up" or "Stay up".
- **After each Tour round:** "Meanwhile in the Elite: Valois won at Corniche."
- **After round 8:** "The Challenger is decided: Liberty go up. Two cup nights left."
- **At the review:** "{up} are promoted. {down} go down."

### Copy fixes

| Where | Today | After |
|---|---|---|
| career.js:313 | "of 16" | `of ${cur.field}` |
| career.js:332 `weekNote` | "All 16 drivers qualify" | Challenger: "All 8 Challenger cars race: qualifying sets the grid." Elite: "All 10 Elite drivers qualify, and the fastest 8 race." Open: the seed rule and "the fastest 8 of 14 race the Last Chance (at least 2 from the Challenger)". Masters: "Top 5 Elite and top 3 Challenger race the Masters." |
| career-hub.js:156 | "of 12" | `of ${non-seeds}` |
| career-hub.js:177 | "top 8 of 16" | per series |
| media.js:43 | "only the top 8 race", "P{grid} of 16" | Elite only, and `of ${field}` |
| choices.js:26 | "all sixteen" | "your series" |
| career-ui.js:111 | Teams' "/ 8", Ranking "/ 16" | `/ ${teamCount}`, `/ ${drivers in series}` |

---

## 12. UI

All pieces reuse `cx-b`, `lrow` and `stat`. One new element is a **series chip**: the text "Elite" or "Challenger" on a token colour, defined in the career CSS. It is text, never colour alone.

| Screen | Change |
|---|---|
| Header (career-hub.js:423, career-shell.js:85) | "Challenger Series · The Ultrack Tour". `worldName` returns the series name when `season.div` is set; a legacy season keeps `tierCup · worldName`. |
| Home side block | When no Open or Masters is next, it shows the player's series Teams' top 3 plus their team. It replaces the tier Cup block. The promotion row (Challenger P1) or relegation row (Elite last) is marked "↑ Up" or "↓ Down". |
| Road to the Open / Masters (136–143) | "Ranked P3 of 8 in the Challenger", "To the cut: 12 pts" (the cut is `openSeeds` or `masters` of their series), and one rule line: "Top 2 of each series go straight to the Final." or "Top 5 Elite and top 3 Challenger race the Masters." |
| Race week | "Round 4 of 10 · Challenger round 3 of 6", "Expected P5 of 8", and the `weekNote` line. |
| Standings tab (281–294) | A two-button switch [Challenger \| Elite], opening on their series, for that series' Drivers', Teams' and Ranking tables. The Teams' table shows the "Promotion" / "Relegation" lines (existing `.cut` style) and the note "The Challenger winners go up; the last Elite team comes down." The Ranking cut lines sit at its Open seeds and Masters quota. The tier Cup block is removed in divided seasons. "Your season" stays. |
| Calendar tab | Tour rows read "Challenger round n" or "Elite round n". Open rows read "Both series: top 2 of each seeded". The Masters row reads "Top 5 Elite, top 3 Challenger". |
| Round report (career-ui.js:178–207) | The title "Challenger · Round 4", their series' entries, and one line "Elite, same day: {winner}; {leader} lead the Elite". At an Open or the Masters each entry has a chip and the Ranking column, and the rank delta names the table. |
| Review (107–118) | Hero "Challenger Series: Champion" or "P2". Stats: Drivers' P / n, Teams' P / `teamCount`, Ranking P / n (series), average rating, duel, trust, points, Opens won n / 3. One banner from `swap`: "Up: Liberty. Down: Sarab.", or, for the player's own team, "Liberty are promoted. You race in the Elite Series next season." / "Corvid are relegated. Your contract stands." The top 5 are their series. A legacy review keeps the Cup stat. |
| Deals (career-deals.js:18, 39–45, 66–68) | Every offer row and team row carries next season's chip. `teamRows` are grouped Elite first, then by tier rank. "Expected P7 of 10 in the Elite Series" (`expIn` with `nextDivOf`). The step-up label (§10). |
| Driver tab (403) | The stat label "Challenger titles / Cups". |

### Render and check at 1600×900 and 390×844

Use `qa-career-screens.mjs` through `qa-lock`, with one season-1 Challenger save, one Elite save and one migrated legacy mid-season save. Shots:
1. Header and Home (with and without an upcoming Open).
2. The Road to the Open card, seeded and unseeded.
3. The race week, Challenger and Elite.
4. Standings, both switch states, with the Promotion and Relegation lines.
5. The Calendar.
6. Round reports: Challenger Tour, Elite Tour with a DNQ, an Open Final with chips, the Masters.
7. Reviews: promoted, relegated, a neutral year, and a legacy season.
8. Deals, with chips and the step-up label.

Check at 390 px:
- The switch and chips fit in the block heads with no horizontal scroll.
- No "16" appears anywhere in a divided season.

---

## 13. Save migration (schema N → N+1)

N+1 is the number after whatever the Koenigsegg and calendar branches take: today 11, so likely 12 or 13. This step runs after the ninth team's migration.

```js
if (save.schema === N) {
  const E = eliteSize();
  [...TEAM_IDS].sort((a, b) => save.world.teams[a].expPos - save.world.teams[b].expPos || (a < b ? -1 : 1))
    .forEach((id, i) => { save.world.teams[id].div = divsOn() ? (i < E ? 'elite' : 'challenger') : 'all'; });
  save.stats.promotions ??= 0; save.stats.relegations ??= 0;
  if (save.season) post(save, 'news', 'Two series from next season', `The Tour splits into the Elite and Challenger Series. ${teamName(save.contract.team)} start in the ${DIV[save.world.teams[save.contract.team].div].name}.`);
  save.schema = N + 1;
}
```

**Decision: a season under way finishes in the old format.**
- Any phase, mid-weekend, the market week and an Open's Last Chance included.
- It has no `season.divs`, so every entry point (`divOf → 'all'`, `carsIn`, `standings`, `rankingOf`, the seeds, `expIn`, `field = legacyField`) reproduces today's behaviour.
- `endSeason` on it awards the tier Cup and makes no swap.
- The next `startSeason` is divided.
- The dual code is limited to those entry points; everything downstream reads their output.

Other phases:
- **A save at the review**, window open or closed: offers, the window, deadlines and rivals are kept, and chips read `world.teams[].div`. No swap that year.
- **Shootout or first-job offers:** only `div` is added. All firstJob teams are Challenger, given current expPos.

Unchanged: `save.ranking`, `save.hall`, history rows (without `div`, the UI shows "—") and `stats.cups`.

Tests: "a current save is unchanged by migrate" extends to N+1.

---

## 14. Determinism

- **New decisions are pure sorts with id tie-breaks:** the split, the swap, `posIn`, the LCQ quota, the interleaved seeds and the Masters quota.
- **No new draw for the other series' qualifying:** `finishQuali` already draws every seated car's lap under the `'ai'` tags.
- **One new noise key:** the other series' race, `simRace(..., 'o', R)` (round key `${round}o`).
- **Existing tags are unchanged.** For a given seed the AI laps are as before; grids and orders differ only because the field is filtered. Seeded expectations in `test-career.mjs` that encode old grids are re-recorded, not loosened.

---

## 15. File-by-file change list

| File | Change |
|---|---|
| `assets/career/tuning.json` | `divisions` block, `rep.challenger` |
| `assets/career/media.json` | the `divisions` group (swap, champions, giant-kill, staying up, inbox lines) |
| `career/rules.js` | `DIV`, `eliteSize`, `divsOn`, `divOf`, `nextDivOf`, `teamsIn`, `carsIn`, `posIn`, `expIn`, `lcqGrid`, `interleave`, `upDiv`; `expOf` clamp `n`; `objectivesFor` N/G/`reachLcq`; `objectiveMet.reach` stage; `roundRating` and `xpFor` `field`; `seasonForm` from `e.exp`; `pointsMult` 0 for cups in divided seasons |
| `career/ranking.js` | `rankingOf(save, d)`, `rankPoints(place, kind, f)`, `playerRank` per series |
| `career/career.js` | `startSeason` (divs, div, post); `prepareRound` (expIn, field, reachLcq); `openEntry` (interleaved seeds, cut); `openWeek` (lcqGrid, rest from 'all'); `finishQuali` (order per series, lcqGrid, lcqIn); `otherRace` (new); `finishRace` (entries `div`/`exp`/`rpts`, `report.other`, `field`, the ranking day with factors, giantKills, x.lcqIn, `reward` knob); `challengeSetup`; `standings(save, d)`; `endSeason` (both tables, swap, titles, history, review); `weekNote`/`enterWeek` copy; `migrate` |
| `career/world.js` | `newWorld` sets `div` by expPos; `marketMoves` `pts` reads `other`; `poachable` and `shortlistOf` use `upDiv`; `heatAfter` higher-series bonus and `sitOut` cooling for the other series |
| `career/offers.js` | the series step-up rule in `seasonOffers`, `teamOutlook`, `approach`; `div` on offers; the `-keep` text |
| `career/life.js` | line 62 `x.div === 'challenger'` |
| `career/choices.js` | the callout field per series on Tour rounds; the higher-series stake; the comment |
| `career/media.js` | `coverSwap`, `coverChampions`, `coverGiantKill`; `coverRound` field copy |
| `ui/career-hub.js` | header, Home block, road card, Standings switch and cut lines, Calendar rows, homeFoot copy |
| `ui/career-ui.js` | round report (other line, chips, Ranking column), review (stats, swap banner, legacy branch) |
| `ui/career-deals.js` | chips, grouping, Expected text, step-up label |
| `ui/career-shell.js` | `worldName` |
| career CSS | the series chip tokens |
| `scripts/test-career.mjs`, `career-sim.mjs`, `career-metrics.mjs` | §16, §17 |
| `docs/career-mode.md` | a dated top block, "Two series, changed 2026-11-07 at the user's call". It replaces "one Tour for every tier" (lines 29–36) and §0 decision 1, marks §2.6 "Living tiers" as built differently (series move, tiers do not), and updates the Opens, Masters, Ranking, §4.1–4.4 and §6.5–6.8 numbers. |

Estimate: about 350–450 changed lines plus tests. No new module.

---

## 16. Tests to add to `scripts/test-career.mjs`

1. **Split.**
   - `newWorld` with 9 teams gives Elite = aurum, saetta, norrsken, toro, sarab and Challenger = corvid, hayate, mojave, liberty.
   - `eliteSize(8) === 4`, `eliteSize(10) === 5`, `divsOn(7) === false`.
   - Every `firstJob` team is Challenger.
2. **`posIn` and `expIn`.**
   - Liberty B = 8, Hayate B = 4, Sarab B = 10.
   - After a forced swap of Liberty and Sarab, Liberty is local 5 of 5 and Sarab local 1 of 4, with expPos left non-contiguous.
3. **Challenger Tour round.**
   - The grid is 8 of 8, all Challenger, and no entry is DNQ.
   - A player with no lap starts P8 and races.
   - `quali.laps` still holds all 18 laps.
4. **Elite Tour round.** The order is 10 and the grid is 8, so 2 miss the cut, and the DNQ path still writes `report.other`.
5. **Other race.**
   - `report.other` has the other series' entries with `div`, and its points sum is right.
   - The same seed twice gives identical entries.
   - Its qualifying laps equal what the old combined `finishQuali` drew for those keys.
6. **Objectives regression.** `objectivesFor` at N = 16, G = 8 is byte-identical to the old function for exp 1..16 × easier × exempt. At (8, N = 8) it gives "Finish P7 or better"; at (10, N = 10), "Qualify P9 or better"; the podium is in the pool at exp 3 of 8 and not at 4 of 8.
7. **Rating and XP regression.** `roundRating` and `xpFor` at field 16 match today's for a table of cases. The divisor at 8, 10 and 18 is 1, 1.25 and 2.25.
8. **Standings.**
   - The tables are per series, and the other race is counted.
   - An Open win adds 0 series points and adds ranking points (`rpts`).
   - Wins are counted per race list.
   - Ties resolve by wins, then expPos, then id.
9. **Swap.**
   - The Challenger P1 and the Elite last change places in `world`, and `season.divs` is unchanged.
   - `history.swap` and `pending.review.swap` are written.
   - The sizes stay 5/4 over 6 simulated seasons.
   - `seasonOffers` sees next season's series.
10. **The player's team promoted.** The contract is deep-equal before and after; next season `cur.expPos` is 9 or 10 with `field` 10; `stats.promotions === 1`; rep +40.
11. **The player's team relegated.** The contract is kept, an outside offer can buy them out, and `stats.relegations === 1` with no rep or trust change.
12. **Titles.** The Challenger Drivers' title gives `stats.cups++`, rep +60 and `bonus.cup` coins. The Elite title gives `stats.titles++` and rep +100. Number One is offered for either series' title at a Legend A seat with trust ≥ 70.
13. **Ranking.**
    - `rankingOf(save, 'elite')` has length 10, `'challenger'` 8, and `'all'` 18.
    - A Challenger Tour win scores 15 and an Elite win 25; Open points are unscaled.
14. **Opens.**
    - The seeds are E1 C1 E2 C2 and 14 fly a lap.
    - With Challenger ratings forced to 60, the LCQ still holds 2 Challenger cars.
    - `closeLcq` gives a Final of 8 in seed-then-LCQ order.
    - An unseeded Challenger player's mandatory objective is "Reach the Last Chance Qualifier": met when they is in the LCQ grid, not met when they is out.
15. **Masters.** The order is E1 C1 E2 C2 E3 C3 E4 E5. A synthetic Challenger table of 2 is filled from the Elite to give 8.
16. **Offers.**
    - A Rookie team promoted while the player's Rookie team stays in the Challenger is offered without the strong-year rule.
    - `teamOutlook` says "A step up: Elite Series".
    - A same-tier Challenger team is still "No step up" from an A seat.
17. **Market.**
    - `pts` includes `other` entries.
    - `poachable` and `shortlistOf` never move a seated Elite driver to a Challenger team.
18. **Rivals.** A rival in the other series cools by 1 a Tour round, not 4.
19. **life.js.** "A seat below your form" fires in the Challenger with form ≥ 2 and not in the Elite.
20. **Sponsor Challenge and callout.** The field is the player's series only.
21. **Migration.**
    - A schema-N mid-season save plays to its end with today's behaviour (combined field, 4 seeds, top-8 Masters, the tier Cup), then the next season is divided with no swap.
    - A review-phase save keeps its offers and window.
    - A current save is unchanged by `migrate`.
22. **Copy.** In a divided season, `weekNote`, `coverRound` and the review stats contain no "16", "of 12" or "/ 8".
23. **Determinism.** Three careers × 6 seasons, run twice, give identical saves (`JSON.stringify`) and an identical swap log.

### Baked numbers to update

| Lines | Change |
|---|---|
| 32–45 | calendar (the calendar branch) |
| 113–116, 148–152 | 16 qualify / 8 race become per series; `expOf(8,'B')` becomes 16 with `n` 18 |
| 121 | `cup.length === 3` becomes a legacy-only test |
| 162, 302–303 | check them |
| 440, 514 | `rankingOf` length 16 becomes 10/8/18 |
| 446–480 | 12 fly a lap becomes 14, with the seeds as above |
| 487–490 | Masters 8 becomes 5+3 |
| 770 | 16 contracts becomes 18 |

---

## 17. Metrics and targets

These go in `career-sim.mjs` and `career-metrics.mjs`: 100 careers × 6 seasons at three stub skills, plus 12 seasons for the world checks.

### Sim edits

- **`best()` (line 14):** sorts by tier rank, then by next-season series, Elite first.
- **Log per season:** `div`, Tour finishes, DNQs by series, podiums and wins, promotions and relegations (the player's team and AI teams), Challenger drivers per Open Final, Finals reached, and the seated AI rating by series.
- **Splits:** the final-tier split is kept and a final-series split is added. The average ranking is the series rank.
- **`TEAMS0`** gets 9 teams. `AVAILABLE` follows the calendar branch.

### New targets (FAIL unless marked)

| Measure | Target |
|---|---|
| Structural: exactly 1 up and 1 down a season; sizes 5/4; Masters 8 with ≥ 3 Challenger when 3 are seated; every Open has 4 seeds and an LCQ of 8 with ≥ 2 Challenger | always |
| Season-1 Challenger rounds the player missed the cut (all skills) | 0 |
| Season-1 average Tour finish, average stub | P3.5–P5.5 of 8 |
| ≥ 1 league podium in season 1, average stub | ≥ 60 % of careers |
| ≥ 1 league win in season 1, average stub | 20–40 % of careers |
| Weak stub: Tour rounds raced of rounds started, season 1 | ≥ 95 % |
| The player's team promoted within their first 3 seasons | average 15–35 %, strong 30–50 % |
| A Rookie-tier team spends ≥ 1 season in the Elite in a 12-season run | ≥ 40 % of runs (a miss is open decision D4, not a quiet tune) |
| A Legend team relegated | ≤ 5 % of season ends |
| A promoted team relegated the next season | ≤ 70 % (OPEN, informational until the user decides D4) |
| Elite DNQ rate for a promoted Rookie B player | 25–60 % |
| Challenger drivers per Open Final | mean 2.0–3.0 |
| Average Challenger player in ≥ 1 Final a season | ≥ 50 % |
| Seated AI rating, Challenger mean at season 12 | ≥ its season-1 value − 3 |

### Old targets kept, replaced or re-baselined

| Old target | Now | Why |
|---|---|---|
| Wallet at the end of each tier 0.9–1.1 × `WALLET` (17905 / 49302 / 101082) | Kept. Maestro and Legend must pass untouched. Rookie: if it fails, lower `challenger.reward` (0.1 steps, not below 0.7); still failing is open decision D5. | Rookies now race and finish P3–P8, so their prize and bonus rise by design. |
| Maestro offer, any 92–100 %, median season 1–3; Legend offer, average 14–24 %, strong 95–100 % median ≤ 3 | Kept. If the median Maestro season drops by more than 0.5, lower `challenger.reward` first. | The climb pace is signed off. |
| "rivals at career end (avg)" and "raced rounds with a nemesis", OPEN for the weak stub ("misses the cut in nearly every round") | They become gating checks: `few` is false now that the weak stub races. | The old reason no longer holds; that was the user's complaint. |
| "teams with an unchanged line-up after the career (of 8)", 0–1.5 | "(of 9)", 0–1.7 | One more team, same rate. |
| "seated AI average rating at the end (today 83.47)", 83.17–83.77 | Re-measured on the Koenigsegg base, then a ±0.3 band | Two new drivers change the mean; the series do not. |
| AI moves 1–5, sackings 0.3–1.5, poaches 0.3–1.5, displaced ≤ 20 %, every market has an offer, commonest reason ≤ 30 %, choice scenes 2–5, callouts 1:1, challenge medal bands | Unchanged | Not touched by the split; they must stay green. |
| Average Round Rating per season | New watch: within ±0.3 of the base commit | Smaller fields with the corrected divisor must not inflate ratings. |

---

## 18. What not to change

- Physics, `paceOf`, `parLap`, `aiLap`, carZ, Hard mode and difficulty.
- `gridSize` 8, track `gridSlots`, the 8-place points and ranking tables, and pole/fastest values.
- Tier data: caps, gates, salaries, styles, wants, sides, XP/rep scales, sponsors, `firstJob` and the Shootout.
- The calendar builder, the 10 rounds, 21 weeks, market timing, side events, Open circuits, practice locks and LCQ race mechanics.
- The transfer window and tactics, loyalty, sackings, the academy, contracts, the seat review thresholds, life, Shop, staff and repairs.
- Existing rng tags.
- The tier Cup code and the `worlds` data, which legacy seasons and history read.

---

## 19. Build order

1. `rules.js` helpers and tuning data, with tests 1, 2, 6, 7.
2. Qualifying per series and `otherRace` (tests 3–5).
3. Standings, titles and the swap (tests 8–12).
4. Ranking split, Open and Masters entry (tests 13–15).
5. Offers, market, rivals, life, choices and the Sponsor Challenge (tests 16–20).
6. Media and inbox.
7. UI, with screenshots at 1600×900 and 390×844.
8. Migration (test 21), the copy test (22) and the determinism test (23).
9. Sim and metrics columns, then calibrate `challenger.reward` only if §17 says so.
10. The doc.

---

## 20. Open decisions for the user (only real ones)

- **D1. Do the last two cup nights count in the league tables?**
  - Default: no, as in football. The Opens and the Masters score ranking and money, not series points, so the league and promotion are settled after round 8.
  - The alternative: Open and Masters points (×1.5) count in each driver's own series table. That keeps finale stakes, but two Challenger Masters places can then decide the Challenger title.
- **D2. Names.** "Elite Series" and "Challenger Series" under "The Ultrack Tour". Any plain pair works, as a one-line data change.
- **D3. Corvid (Maestro, "Former champions") starts in the second series.** This follows from the 5/4 split after Koenigsegg shifts everyone down. The alternative, 4/5, puts Corvid in the Elite but brings back a qualifying cut (10 cars) in the new player's series.
- **D4. Yo-yo dampers, only if measured.** A promoted Rookie team keeps its cap-1 cars, so it may go straight back down, and a relegated Maestro may bounce straight back up. If "a Rookie-tier team spends a season in the Elite" misses 40 %, the fixes are a +1 dev for a promoted team, a relegated team skipping its rotating +1, or a swap of 2. All three change the user's rule that a promoted team "keeps its cars", so they need their OK.
- **D5. A Rookie wallet re-baseline, only if `challenger.reward` at 0.7 still cannot hold the Rookie wallet inside 1.1×.** The choice is then a richer start (re-baseline) or a stingier Challenger.

Not built in v1: a playoff, a third series, mid-season moves, relegation clauses, loyalty or poaching rules tied to promotion, a "Stay and bring us back" offer, promotion or relegation mood lines, and a cap bonus for a promoted team.

---

## 21. Build notes: steps 1-5 and the migration (2026-11-07, branch career/divisions)

Built: the helpers and data (step 1), qualifying per series and `otherRace` (2), the tables, titles and the swap (3), the ranking split and the Open and Masters entry (4), offers, market, rivals, life, choices and the Sponsor Challenge (5), and the schema 12 -> 13 migration (8, built early so every commit loads old saves). Not yet built: media and inbox (6), the UI (7), the copy and determinism tests (22, 23), the sim columns (9).

### Where the code differs from the spec, and why

1. **The old field is 18, not 16.** The spec was written before Norrsken. Today's `objectivesFor` clamps to `FIELD` (18), so its `N` defaults to `FIELD`, and the regression test is byte-identical for every expected place 1-18 at N = 18 (at N = 16 places 16-18 would change). `DIV.legacyField` (16) stays, but only as the default field of `roundRating` and `xpFor`, whose divisor of 2 it encodes. A season from before the split sets `cur.field = FIELD` for objectives and copy and rates with `legacyField`.
2. **`seedsOf(kind, E, C)`** is a pure helper in `rules.js` (not in the spec's list): the Open's 2 + 2 and the Masters' 5 + 3, with a short table's places filled from the other series. `openEntry` calls it; test 15's "table of 2" is a direct test of it.
3. **`standings` keeps `cup`** (the tier's teams of the table) in a divided season, and the history row and review keep `cup` (that place). Nothing awards it; it keeps today's Home and review screens from crashing until step 7 removes the block.
4. **`pointsMult(R, divided)`** takes the flag as a second argument. The UI still calls it with one, so it shows "points ×1.5" on cup rounds until step 7.
5. **`teamOutlook` gains `step`** ("A step up: Elite Series", or null) for the label, rather than replacing `why`.
6. **`heatAfter`'s `sitOut` cooling** applies to rivals seated in the other series at a Tour round; a free agent cools as before (`decay`).
7. **`startSeason` throws** if a series has fewer than 8 seated cars (the spec's assert); the market fills every seat, so it cannot happen in play.
8. **The migration also stamps `div` on mid-season offers** (`season.mid`), not only `pending.offers`, and posts its news line only when the player's team has a series.
9. **Copy:** only the race week's "Expected P n of {field}" is done; `weekNote`, `coverRound` and the rest are step 6.

### The cut problem, re-measured (100 careers x 6 seasons, `scripts/career-sim.mjs` stub, base 1479590 -> this build)

| | Base | Now |
|---|---|---|
| Weak stub, Tour rounds missed the cut | 100 % (0 raced of 6000 rounds, all kinds) | 11 %; 0 % in season 1 (3280 of 6000 rounds raced, all kinds) |
| Average stub, missed the cut, all rounds | 41 % | 13 % (Tour rounds 7 %) |
| Average stub, season 1 Tour rounds missed | 94 % | 0 % |
| Season-1 average Tour finish (weak / average / strong) | P15.1 / P11.5 / P7.3 | P5.5 / P3.0 / P1.6 (of 8) |
| ≥ 1 podium in season 1 (weak / average / strong) | 0 / 0 / 15 % | 42 / 99 / 100 % |
| ≥ 1 win in season 1, average | 0 % | 53 % |
| Player's team promoted within 3 seasons (weak / average / strong) | - | 25 / 45 / 85 % |
| A Legend team relegated, of season ends | - | 1 % |

### `career-metrics.mjs 100 6` after step 5: 7 FAIL (it exits 1)

The sim and metrics columns of §17 are step 9 and not built, so these are today's old targets on the new format:
- weak: raced rounds with a nemesis 13 % (20-70 %; OPEN before, now gating because the weak stub races), sackings 0.27 a season (0.30-1.50).
- average: the nemesis is the teammate 58 % (≤ 45 %), Legend offer 40 % (19-32 %), final tier Legend 36 % (14-22 %).
- strong: rival REP lines 1.01 a race (≤ 1.00), Number One 52 % (55-65 %).

The average stub is stronger in the Challenger than §17 wants (P3.0 against P3.5-5.5, wins 53 % against 20-40 %, promotion 45 % against 15-35 %), and it climbs to Legend faster. `challenger.reward` moves money and place XP, not reputation or ratings, so it cannot pull these back; they need the step 9 calibration or the user's call. The average Round Rating is 6.61 (base 6.52), inside the ±0.3 watch. The weak stub is dropped more often (1.91 a career, base 0.76): it now races, finishes below its expected place in the Challenger and misses its round objective, where before it sat out with the Rookie missed-cut allowance.

## 22. Build notes: steps 6-10 (2026-11-07, branch career/divisions)

Built: the press and the inbox (6), the screens (7), the copy and determinism tests (16.22, 16.23), the sim and metrics columns (9) and the doc (10, `docs/career-mode.md`'s top block, with D1-D5 for the user).

### Where the code differs from the spec, and why

1. **Home shows the road card only when a cup is the next round.** Before the split it showed whenever a cup was still to come, which with an Open in round 3 and the Masters last would have hidden the series table all season. "When no Open or Masters is next" is read as the next round.
2. **The Standings switch sits under the Drivers' head**, not in it: beside "Challenger Drivers'" it had no room. The blocks are titled with the series ("Elite ranking"), and "Last 12 days" and "Both cars score" moved into the notes for the same reason.
3. **The review's head is "Challenger Series: Drivers'"** with "Champion" or "P2" under it; a season from before the split reads "Drivers' table". The old head said "championship", a word the copy rules forbid.
4. **The other series' leader is written "Top of the Elite: Remy Valois"** in the inbox and the report, not "{leader} lead the Elite": with a name the plural verb reads wrong, and the singular would break the house rule.
5. **One giant-kill story a cup**: the player's if they are on the podium, else the best placed Challenger driver. No "staying up" story; the season-start inbox line carries "stay up".
6. **The race-week inbox line** no longer says "points x1.5" for a cup that scores no series points (it read `pointsMult` without the season's flag).
7. **career-sim's `best()`** takes next season's Elite within a tier, as asked; it is also what moved the Legend offer (40 % -> 20 %) and the final tier Legend (36 % -> 17 %) back inside their targets.
8. **`challenger.reward` stays 1.** Section 17 lowers it when the Rookie wallet is over 1.1x or the Maestro offer median drops by more than 0.5. The wallet is under the baseline (88 %), and at 0.9 / 0.8 / 0.7 the Maestro median stays season 1 (base: 2) while the Rookie wallet falls to 86 / 86 / 83 % and the Legend wallet to 86 / 83 / 79 %.
9. **Thirteen targets are OPEN, not FAIL** (`career-metrics` exits 0): the knob cannot reach them, and section 17 allows no other. They are listed, with their numbers, in `docs/career-mode.md` under "Balance". Among them two the spec made gating: the weak driver's raced rounds with a nemesis (13 %), and the Elite cut for a promoted Rookie B driver (100 % of only 18 rounds, which is D4).
10. **The phone layout:** the five mode tiles become two columns and the report's numbers wrap at 600 px and under; both ran off a 390 px screen before the split too.

### Measured (`career-metrics.mjs 100 6`, `career-sim.mjs 100 6`)

Structure, every season end and cup of 300 careers: one up and one down, 5 and 4, the Masters 8 with 3 Challenger, every Open 4 seeds and a Last Chance of 8 with at least 2 Challenger cars. A Legend team was relegated at 1 % of season ends. Season 1: no Challenger round missed by any driver; the weak driver raced every Tour round. The Challenger AI's average rating went from 80.6 to 78.6 over 12 seasons (at least 77.6 asked).

## 23. Build notes: the first review's fixes (2026-11-07, branch career/divisions)

A review of steps 1-10 found that the Challenger fed the climb at full weight (a player who stayed down reached Legend about three times as often as one who took the Elite), that `career-metrics` passed only because thirteen targets printed OPEN (old guards among them), and a list of copy and layout faults. Fixed:

1. **The Challenger keeps a share of what a round earns.** `divisions.challenger.rate` (0.75): a Challenger driver's Round Rating keeps three quarters of what it gains above the base, at the cups too (a "Challenger field" line takes the rest; losses stay whole). `divisions.challenger.rep` (0.6, the ranking's share): a Challenger Tour round's positive reputation lines. The spec had only `reward`; without these two the Challenger rated a round 1.2 higher than the Elite seat the player was offered next. The cups share the rating's discount because a Challenger seed starts a Final far above their expected place of the 18 (P11 for Corvid's A seat) and was rated on it.
2. **`challenger.reward` is 0.7**, the spec's floor (section 17's rule: the Rookie wallet was 113 % of the baseline at 0.9; 109 % at 0.7).
3. **The qualifying duel heats the teammate by the field** (`heatAfter`: per round and its cap, times field / 16 at a Tour round): in a series of 8 the teammate was the nemesis in 65 % of the average driver's rounds with one; 42 % now.
4. **A step up must make the grid** (`offers.js stepUp`): a same-tier team going up counts as a step up only when its A seat is expected inside the Elite's 8; a promoted Rookie team, last of the Elite, is not.
5. Smaller ones: a deal signed in mid-season shows the series its team races next at the review; a Challenger driver with no qualifying lap is told they start last, not that they sit out; a relegated player who is also let go no longer reads "Your contract stands"; the Masters week shows no expected place of 18 and its button says "Start the Masters"; the press's missed-Masters line gives the series rule; a round reloaded before qualifying is a sit-out in the Challenger too (it scored a win); `startSeason` no longer throws (the tests assert full grids); a sponsor's place target reads the series place at a cup week; the hall's rows and the Seasons history carry the series; the review splits the title's reputation from the promotion's; the Home table shows three rows and no up or down marks before a round; phone layouts put the series chip under the name.
6. **`career-metrics`:** the old guards are `check` again (sackings, the teammate as nemesis, rival REP lines); the Maestro offer's median may be at most 0.5 sooner than the base (2); the Legend offer, final tier Legend and Number One are also measured with the base commit's pick and with a pick that stays in the Challenger, held to the targets' upper ends; D4 is measured on purpose (the average driver in a promoted Liberty or Hayate B seat, 600 Elite rounds each). Exit 0 still does not mean every target is met: the OPEN lines are the user's decisions, listed in `docs/career-mode.md`.

### Where this differs from the reviewers' fixes, and why

- **Not built: the season-1 Round Rating within 0.3 of the base.** On the base the Rookie driver missed the cut in 94 % of season-1 Tour rounds and was rated on sitting out (6.54). Holding a season of races in the Challenger to that number would rate a race win like a missed cut, which undoes what the user asked for. What the rating buys is gated instead: the Maestro offer's median (2, as on the base) and the three picks. Measured: season-1 rating weak 5.81 / average 7.33 / strong 8.59 (base 5.61 / 6.54 / 8.77); reputation at the first review, average, 270 (base about 210).
- **Kept OPEN, for the user:** the climb with a pick that stays in the Challenger (Legend offer 40 %, final tier Legend 36 %; no value of `rate` holds this and the Elite pick inside their ranges at once: at 0.6 the Elite pick fell to 15 % and 10 %); Number One at 52 % (the cups score no series points, D1, so the strong driver takes fewer titles: 1.83 a career, base 2.27); the weak and average drivers' raced rounds with a nemesis (17 % and 13 %, the trade-off that has kept the average driver's open since Norrsken); the rest as in section 22.
