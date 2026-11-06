# Part B build spec: a career that answers back

**Base:** Design 3, on-track impact. **Grafts:** a lean contract market and reasons (Design 2), causes, a ledger and choice scenes (Design 1).

**Rules for the build:**
- Pure career modules stay pure: a save goes in and comes out changed.
- Every roll is `rng(save.seed, ...)`, stored once its moment comes.
- No LLM. No Owner mode.
- The player car (physics, handling, assists) does not change. Every race hook is behind `!this.car.hero` and a profile only the career sends.
- No AI pace change: `paceOf`, `aiPace`, AI ratings, team `dev` and par laps keep today's values.
- Happiness never touches lap times.
- Do not touch `calendar.json` `qualifying`, `qualiVenue`, `finishQuali` or the quali branch of `session.js`. Part C owns them; keep diffs away from them to avoid merge conflicts.

## Where things are

Paths are relative to `D:/RaceUltimate-wt/career/track-viewer` unless they start with `assets/`, which sits at `D:/RaceUltimate-wt/career/assets/`.

**Career, pure:**
- `src/game/career/career.js`
  - `SCHEMA = 7` (:22), `migrate` (:59-101), `takeSeat` usage
  - `aiPace` (:310), `raceSetup` (:352)
  - `sideSpec` (:363), `finishSide` (:369)
  - `finishRace` (:388; calls `heatAfter` at :408 with the full 16-key `order`)
  - `settleLife` (:470), `nextSeasonWorld` (:555)
- `src/game/career/world.js`: `newWorld` (:11), `takeSeat` (:35), `marketMoves` (:46), `callUp` (:62), `heatAfter` (:76), `rivalsOf` (:93)
- `src/game/career/offers.js`
  - `WHY` and `outsideOffer` (:110-120), `midSeason` (:122)
  - approach (:150-181), `seasonOffers` (:189-213)
  - sponsors (:219-285), transfer demand (:307-329)
- `src/game/career/rules.js`: `paceOf` (:42), `buildWeeks` (:105), `interestOf` (:214), `targetFor`/`targetMet` (:248-252), `sideMedal` (:259)
- `src/game/career/media.js`: `coverMoves` (:110; it already writes "X moves to Y" when a driver's car key changes)

**Data** (`assets/career/`): `tuning.json`, `tiers.json` (team `wants` text, `side` theme), `drivers.json` (ratings, academy), `sponsors.json` (brand `target` kind: clean jio/sony/hsbc, quali rayban/pirelli/rolex, top oppo/shell, podium cocacola/emirates, win redbull, duel vivo; `startMood` 2), `media.json`.

**Race:**
- `src/physics/driver.js`: `AIDriver.read` (:76-143), with the traffic loop at :92-100, the lane at :107-115, the follow at :128 and nitro at :139-142
- `src/cars.js:583`: `new AIDriver(field, car, pace)`
- `src/game/game.js`
  - `F.paceFor` (:306), cleared at :352
  - events (:415-455): position at :443-447, impact at :452
  - the career session map (:503), `careerDone` (:507-510)
- `src/game/session.js`
  - `MODES` (:10-16), `update` (:58-122), the impact emit at :113
  - the `rival`, `rivalLap` and `rivalGap` getters (:163-171)
- `src/game/hud.js`: rival tile (:194-198)

**Screens:** `src/game/career-hub.js` (`startEvent` :48-55, `startRace` :56-63, Rivals block :380-391), `src/game/career-deals.js` (:49-50).

**Tests and sim:** `scripts/test-career.mjs`, `scripts/career-sim.mjs` (exports `play({C,R}, seed, skill, seasons)` and `loadCareer(server)`; the drift stub is at :53), `scripts/test-ai-nitro.mjs` (the pattern for a no-browser AI test).

## Commands

All are run from `D:/RaceUltimate-wt/career/track-viewer`.

**Every work package:**
- `node scripts/test-career.mjs`: must print `career: all checks passed`. Today it takes about 2 s.
- `node scripts/test-ai-nitro.mjs`
- `node scripts/career-sim.mjs 100 6`: about 1-2 min. Compare with the baseline below.
- `node scripts/career-metrics.mjs 100 6`: new in WP1. Prints PASS or FAIL for each target and exits 1 on any FAIL.

**WP2 and WP3 only:**
- `node scripts/test-ai-rivalry.mjs`: new in WP2.
- Browser QA:
  1. `node scripts/sync-assets.mjs`
  2. Start `npx vite --host 127.0.0.1 --port 5302 --strictPort` in the background.
  3. Then, one browser at a time and only through the lock: `node D:/RaceUltimate/track-viewer/scripts/qa-lock.mjs -- node <script> ...`

**Baseline, measured today (career-sim 100x6), to hold within the stated tolerances:**

| Player skill | Maestro offer, any | Maestro, median season | Legend offer, any | Legend, median season | Offers per season | Final tier |
|---|---|---|---|---|---|---|
| Average 0.995 | 97 % | 2 | 19 % | 4 | 1.75 | rookie 30 %, maestro 56 %, legend 14 % |
| Strong 1.015 | 100 % | | 100 % | 3 | | legend 100 % |
| Weak 0.975 | | | | | 1.12 (min 1) | |

**Commits:** commit each work package once its checks pass. Subject: `career: <what>`. Stage only your own paths and check `git diff --cached --name-only` before committing (other sessions share the index).

---

## WP1: Rivalries that are earned (pure career, plus race result plumbing)

**The player sees:**
- 1-3 rivals, each with a cause and a record: "Took your seat at Toro · 4-2 to you".
- At most one **nemesis** per weekend.
- Rivalries now grow from contact and passes, not just from finishing near someone.

**tuning.json `rivals`:**
- `near` 3 becomes 1. `close` 10 becomes 6. `beat` 5 becomes 3. `decay` 5 becomes 8. `displaced` 40 becomes 30.
- New keys: `contact` 8, `contactHard` 14 (over 30 km/h), `pass` 3 (at most 2 per car per race), `mate` 20, `seatLost` 30 (used in WP4), `nemesis` 70.
- Keep `rival` 40. Keep `rep`, `higherTier` and `feudRep`; `feudRep` and `feudXp` now apply only to the nemesis.

**world.js:**
- `heatAfter(save, raced, hero, dnf, ev = { contacts: {}, passes: {} })`
  - Takes the **raced** keys only. In `career.js:408`, pass `raced`, not `order`.
  - Drivers who did not race only decay.
  - Adds contact and pass heat, keyed by car key and mapped to a code through `world.seats`.
  - Keeps the payout rule (judged on the heat from before the race).
  - Updates `save.career.rivalry[code] = { cause, since: [season, round], w, l }`:
    - created when heat first reaches `rival`, or when a cause sets it;
    - `w`/`l` are updated when both drivers raced and neither DNF'd.
  - When heat reaches 0, delete both entries.
- `takeSeat`: on a new team, set the teammate's heat to `max(h, mate)` with cause `'teammate'`. The displaced driver gets heat 30 with cause `'displaced'`.
- `nemesisOf(save, keys)`
  - Takes the hottest code on those car keys with heat ≥ `nemesis`.
  - Ties are broken by `rng(seed,'nemesis',season,round)()`.
  - Returns `{ code, key }` or null.
  - Every other driver is held at heat `min(h, nemesis+9)` = 79 or less, so "feud" is only ever the nemesis.
- `rivalsOf` adds `cause`, `w`, `l` and `nemesis: bool`.

**career.js:**
- `raceSetup` returns `nemesis: nemesisOf(save, racers)`.
- `finishRace` reads `result.contacts` and `result.passes`, both `{carKey: n}`, defaulting to `{}`.
- `report.nemesis` holds the code and whether the player beat them.

**Race result plumbing (no behaviour change):**
- `session.js`:
  - At `impact` (:113), find the nearest other car within 6 m and also emit `contact { key, kmh }`.
  - In the `position` emit (:101), add `by`: the key of the car now in the hero's old place.
- `game.js`:
  - `careerRun` gets `contacts: {}`, `passes: {}` and `offTrack: 0`.
  - The handlers count them; `offTrack` is counted in the existing `offTrack` case.
  - `careerDone` data adds `contacts`, `passes`, `offTrack` and `totals` (`rows.map(r => [r.key, r.total])`).
- `career-hub.js` `startRace` puts `contacts` and `passes` into `result`.

**Migration, `SCHEMA` 7 to 8:**
- `career.heat[c] = min(h, 60)`.
- `career.rivalry[c] = { cause: 'grid', since: [season, 0], w: 0, l: 0 }` for h ≥ 40.
- Teammate heat is seeded at 20 with cause `'teammate'` when there is a contract.
- `newCareer` adds `rivalry: {}`.

**Sim:**
- `career-sim.mjs` gains seeded contacts and passes for the stub, on its **own dice** stream, like `lr`, so every other baseline number stays the same.
- Rates: 0.3 contacts per race against a neighbour within 1 place, and 1 pass per race against a neighbour.
- Pass them in the `result` given to `finishRace`.

**New `scripts/career-metrics.mjs [careers=100] [seasons=6]`:**
- Built on `loadCareer` and `play` from `career-sim.mjs`.
- Wraps career functions through a plain copy `{...C, finishRace: wrapped}`; the namespace object is frozen.
- It is the tracked home for the readers' scratch probes: `D:/RaceUltimate-wt/career/qa/10x-scratch/world-sim.mjs`, `market-sim.mjs` and `D:/RaceUltimate-wt/career/track-viewer/qa/10x-scratch/heat-sim.mjs`.
- WP1 targets, at each of the 3 skills:
  - rivals at career end, average 1.0-3.0 (today 4.7-9.1);
  - nemesis count ≤ 1 in every round (an assert);
  - rounds with a nemesis on the grid 20-70 %;
  - rival REP lines per race ≤ 1.0 (today 3.7-4.5);
  - at least 90 % of rivals have a non-`grid` cause.

**Tests to add to test-career.mjs:**
- Only raced keys gain heat.
- Contact +8, and +14 over 30 km/h. Passes are capped at 2 per car.
- `nemesisOf` is deterministic, returns at most one driver, and holds the others at 79 or less.
- Teammate seeded at 20 on joining.
- h2h increments.
- A schema-7 save migrates (heat clamped, rivalry created).
- `heatAfter` with empty `ev` gives the same result for the same seed.

**UI:**
- career-hub Rivals block (:380-391): cause line and h2h, plus a "Nemesis" badge.
- Race report: rival lines unchanged; add the nemesis line.

**Leave out:**
- Lore pairs seeded into the player's heat.
- AI-vs-AI grudges.
- Pace from heat.

## WP2: Rivals race differently near the player (race side)

**The player sees:**
- The nemesis defends their line and presses harder when behind the player.
- A low-composure rival sometimes runs wide or lifts when the player has been on their gearbox for a while.
- The teammate lets the player by on the last lap when the team favours them.
- The player can be ordered to let the teammate by, and obeying or not is the player's call.
- The race HUD shows the nemesis tile, and the booth finally uses the recorded `defending` and `side_by_side` lines.

**rules.js (pure):**
- `composureOf(rating, age) = clamp(0.35 + (rating−70)·0.02 + (age>30 ? 0.1 : 0), 0.2, 0.95)`
- `ordersFor(save)`:
  - returns `'toYou'` when the player is in the A seat, or when trust ≥ 70 and duel won > lost;
  - returns `'toMate'` when the player is in the B seat, trust < 40, and the mate is ahead on the grid;
  - otherwise null.

**career.js `raceSetup`:**
- Adds `ai: { [key]: { role: 'nemesis'|'rival'|'mate'|null, composure, seed: hash(seed, season, round, key), k } }` for AI cars only.
- `k` is the knob set copied from the new `tuning.json` `rivals.track`, so `driver.js` imports no career code:
  ```
  { follow: 1.0, followMul: 0.95, laneRate: 0.03,
    defend: { on: true, rate: 0.012, holdS: 4, behind: [1, 15], lat: 3.5 },
    mistake: { on: true, base: 0.05, rival: 1.6, nemesis: 1.3, window: 0.6, after: 3, lift: 0.95, liftS: 0.5, wide: 0.8 },
    nitro: { on: true, from: 10, to: 50 },
    orders: { lift: 0.97, s: 3, aside: 2, gap: 1.0 } }
  ```
- Adds `orders: ordersFor(save)` and `mateKey`.

**Wiring:**
- `game.js:306`: `F.aiFor = career?.ai ? (k) => career.ai[k] : null`. Clear it at :352. Also `F.orders` and `F.nemesisKey`.
- `cars.js:583`: `new AIDriver(this, c, pace, c.hero ? null : this.aiFor?.(c.key) ?? null)`.
- `AIDriver` stores the 4th argument as `this.prof`.
- `career-hub.js` `startRace` passes `ai`, `orders`, `nemesis` and `mateKey` in `session`.

**driver.js `read()`:** every hook sits under `const P = this.prof; if (P && !this.car.hero)`, and the player is `o === F.hero`.
- **Finding the player:** in the existing traffic loop, also record the hero's gap and lateral position. The scan widens to gap −15 for the hero only.
- **A. Defend (nemesis only):**
  - Trigger: player 1-15 m behind, |Δlat| < 3.5 m, and not a braking zone (`vmin ≥ speed·0.95`).
  - Ease `laneNow` toward the player's lateral position at 0.012 per tick, clamped by the existing `lo`/`hi`.
  - One move per straight: hold for 4 s, or until `vmin` drops.
  - Push `{type: 'defend', key}` to `F.aiEvents`.
- **B. Press (rival or nemesis, when `blk.car === F.hero`):** follow from 1.0 m (not 1.5 m), at ×0.95 inside 6 m (not ×0.9), and lane rate 0.03 (not 0.02).
  - Nemesis nitro: with the player 10-50 m ahead, at most once per lap, through `aiNitro` and the stock tank, whatever `field.hardPace` says.
- **C. Mistake:**
  - Trigger: the player has been within 0.6 s behind (by track distance over speed) for more than 3 s, and this is a corner entry (the first tick with `vmin < speed·0.9`).
  - Probability: `p = base·(1−composure)·(rival ? 1.6 : 1)·(nemesis ? 1.3 : 1)`.
  - The roll is `mulberry32(P.seed ^ cornerIdx·997 ^ lap·31)`, so it repeats exactly.
  - Effect, picked by the same roll: either `vt×0.95` for 0.5 s, or `laneNow` +0.8 m to the outside, clamped by `lo`/`hi`.
  - Push a `mistake` event. It never fires without the player close behind.
- **D. Orders (mate):**
  - `'toYou'`: on the final lap, with the player within 1.0 s behind, `vt×0.97` for 3 s and step 2 m aside, then clear the order. Emit `orders`.
  - `'toMate'` changes nothing in the driving; it is a banner only.

**session.js:**
- Drain `F.aiEvents` each update into `defend` / `mistake` / `ordersDone` events. Raise `defend` at most once per lap per car.
- `sideBySide`: hero and an AI car within 2.5 m sideways and 2 m along the track for 1 s.
- `get rival`: unchanged for `quali`. In `race`, it returns the car with key `F.nemesisKey`, else the teammate's car.

**game.js:**
- `say('defending', {cooldown: 30})` and `say('side_by_side', {cooldown: 25})`.
- On a mistake: HUD message "{name} runs wide".
- Orders: HUD banner "Team: {mate} lets you through" or "Team: let {mate} by". `careerRun.orders = { kind, obeyed }`; for `'toMate'`, obeyed means the player finished behind the mate.

**hud.js:** the rival tile shows in races when `session.rival` is set (AHEAD/BEHIND seconds).

**finishRace:** reads `result.orders`.
- Obeyed `'toMate'`: trust +4.
- Ignored: trust −6, mate heat +15, and a media story.

**New `scripts/test-ai-rivalry.mjs`** (no browser; stub field and vehicle like `test-ai-nitro.mjs`):
1. A null profile gives output byte-identical to no 4th argument over 1,000 seeded ticks with traffic.
2. Defend moves `laneNow` only toward the player and stays within lo/hi, one move per straight.
3. The mistake roll repeats exactly for the same seed, corner and lap, and is 0 with no hero within 0.6 s.
4. `aiFor` is never applied to the hero.

**New tracked `scripts/qa-rivalry-race.mjs`** (copy the setup of `qa-race-watch.mjs`, which drives the hero by AI):
- Arguments: `[track=india] [laps=3] [url=http://127.0.0.1:5302]`.
- Through `window.game.startSession('race', {racers, pace, ai, nemesis, done: () => {}, ...})` it runs two races, the same seed with and without profiles; force the nemesis and one rival on adjacent grid slots.
- It reports per AI car: clear-air best lap, respawns, seconds off the asphalt, contacts with the hero, defends, mistakes, `side_by_side` lines.
- Run: `node D:/RaceUltimate/track-viewer/scripts/qa-lock.mjs -- node scripts/qa-rivalry-race.mjs india 3 http://127.0.0.1:5302`, then again with `drylake`.
- **Must hold:**
  - profiled AI clear-air best laps within ±0.3 % of the unprofiled run;
  - no new respawns;
  - AI off-asphalt seconds no higher than unprofiled + 1 s;
  - hero contacts at most 1.5× unprofiled;
  - at least 1 defend per race with the nemesis adjacent.
- If a hook fails, set its `on: false` in `tuning.json` and ship the rest.

**Player car untouched:**
- Add one line to `qa-player-lap.mjs:19`: `process.env.QA_URL ?? 'http://127.0.0.1:5180'`.
- Run `QA_URL=http://127.0.0.1:5302 node D:/RaceUltimate/track-viewer/scripts/qa-lock.mjs -- node scripts/qa-player-lap.mjs india nissan-z` and check its numbers against a run on the base commit.

**Leave out:**
- Rubber-banding.
- Brake-testing.
- Pace from heat, mood or happiness.
- Nitro for non-nemesis cars.
- Announcing mistakes in the briefing.

## WP3: Sponsor Challenge replaces Drift Attack on sponsor days

**The player sees:**
- Sponsor days are a 2-lap sprint from the back of a 6-car field at the next round's circuit, dry.
- Each day is named after the deal it serves and drives that brand's wish, with 3 objectives shown before and after: bronze is 1 objective, silver 2, gold 3.
  - Examples: "Shell Overtake Challenge: gain 2 places / top 3 / win", "Rolex Hot Lap Challenge".
- Goodwill now follows the result.
- Drift Attack stays as is in free play (`MODES.drift` untouched).

**tuning.json `side.challenge`:**
```
{ "laps": 2, "field": 5, "pace": 0.97,
  "name": { "top": "Overtake", "podium": "Podium", "win": "Victory", "clean": "Clean Air", "quali": "Hot Lap", "duel": "Duel" },
  "objectives": {
    "top":    [["gain",2],["top",3],["top",1]],
    "podium": [["top",4],["top",3],["podiumClean",0]],
    "win":    [["top",3],["top",1],["winBy",1.5]],
    "clean":  [["noContact",0],["offMax",0],["cleanTop",3]],
    "quali":  [["lapPar",1.02],["fastest",0],["lapPar",1.005]],
    "duel":   [["passMate",0],["beatMate",0],["beatMateBy",2]] } }
```

**rules.js:**
- `challengeMet(spec, v)` takes `v = { order, bests, contacts, offTrack, totals, dnf }` and returns `[bool, bool, bool]`.
  - `gain` is counted from the start slot 6.
  - `offMax` is the number of `offTrack` events.
  - For `duel`, the mate's car is in the field. `passMate` means the player finished ahead of the mate, who starts P5.
- `sideMedal('sponsor', met) = met.filter(Boolean).length`.
- A DNF or retirement gives 0.
- Test days are unchanged.

**career.js:**
- `eventName`: the deal is `deals[i % deals.length]`, where `i` = the number of sponsor events in `season.weeks` before this week. The result reads `${deal.name} ${name[kind]} Challenge`. With no deal it is "Team Overtake Challenge", using kind `top`.
- `sideSpec` for sponsor returns `{ kind:'sponsor', deal, target, objectives (text), racers, gridOrder (hero last), pace, levels, drivers, laps: 2, par }` from a new `challengeSetup(save)`:
  - the field is the 5 seated cars whose expected place is closest to the player's, always including the teammate;
  - pace is `aiPace(save, key, ['challenge']) × 0.97`.
- `finishSide(save, value)` for sponsor takes that object and stores `result.met`. Pay is unchanged (`side.pay`).
- Mood: gold +1, silver and bronze 0, no medal −1, clamped to `[1, startMood + 3]`.
  - Verify in offers.js sponsor code what mood 0 does before choosing the floor.
  - Skipping still costs goodwill, as today (offers.js:282-285).
- A gold also counts once per season toward that deal's season target: increment the same counter `sponsorRound` (offers.js:260-269) uses.

**Session wiring:**
- `game.js:503`: map `sponsor` to `'race'`.
- `career-hub.js` `startEvent` passes `racers`, `gridOrder`, `pace`, `levels`, `drivers`, `label` (the name) and `field` (the objectives text) for sponsor days.
- With WP2 in, the profile applies there too.
- Retiring from the pause menu gives a DNF and no medal.
- Repairs are not billed: `finishSide` never reads hits, as today.

**Sim:**
- Replace `career-sim.mjs:53`'s `12000 + rand()*30000` with a seeded stub result from skill:
  - finish place = clamp(round(6 − (skill − 0.95)·60 + noise(1.5)), 1, 6);
  - contacts Bernoulli(0.25);
  - offTrack 0-2;
  - best lap = par / skill · (1 + noise(0.01)).
- Use its own dice stream, as above.
- `career-metrics` targets at skill 0.995: medal ≥ bronze 75-95 %, silver or better 40-70 %, gold 10-35 %; at 0.975, silver or better ≤ 45 %.
- Wallet at the end of each tier within ±10 % of the baseline.
- Sponsor mood never exceeds `startMood + 3` (an assert).

**Tests:**
- A `challengeMet` table test for every objective type and kind.
- DNF gives 0.
- The deal rotates across sponsor days.
- Mood clamp and the −1 on no medal.
- Gold counts toward the deal target once per season.
- The `eventName` format.
- An old saved drift `result.value` (a number) still renders. The screens read `result.medal`.

**QA:**
- `node D:/RaceUltimate/track-viewer/scripts/qa-lock.mjs -- node scripts/qa-career-season.mjs http://127.0.0.1:5302` (about 30 min, `RACE_LAPS=1`). Its sponsor day is now a race ended from the pause menu, so update its expectation if it asserts a drift HUD.
- One AI-bot challenge from P6 on India must reach at least bronze.

**UI:**
- `career-deals.js:49-50`: "Sponsor days: Turn up" becomes the challenge name and its 3 objectives.
- The hub event card lists the objectives.
- The toast lists ticks, e.g. "2/3: silver".

**Migration:** none. The kind stays `'sponsor'` and the names are computed.

**Leave out:**
- Ghosts.
- New voice lines or art.
- Brand gates at corners.
- Pay retuning, until it is measured.

## WP4: A contract market the player can read

**The player sees:**
- AI drivers have contracts and move between teams. "Okafor moves to Toro" appears in the press, a story that was unreachable before.
- Teams only offer seats that really open: a contract ending, a retirement, a dropped under-performer, or an incumbent the player now outrates. No 90+ driver with a running contract is ever dropped for the player.
- Offers say why, in the team's own terms ("They want overtakes: you gained 31 places this season").
- A turned-down team cools off visibly, and the coolness fades.
- A rumour in the mid-season market week names the seats that will open.
- When two teams bid, one matches the other.

**Data:**
- `drivers.json` gets `academyNames: { first: [30], last: [30], nations: [12] }`.
- `tiers.json` gets a `want` stat key per team, mapped from its `wants` text (read all 8 entries): `cups`, `poles`, `gained`, `clean`, `seasonsHere`, `duel`, `rrTrend`, `fromBehind`.
- `tuning.json`:
  - `market`: `renew` 0.6, `renewGap` 2, `dropGap` 6, `maxMoves` 3, `contract` [1,3].
  - `offers`: `cool` 0.1, `coolMax` 0.3, `wantMax` 0.15, `star` 90, `buyout` 0.85.
- `media.json`: `reasons` (2-3 variants per term: rep, form, want, rating, cool) and `rumour` templates.

**New `src/game/career/ledger.js`** (about 30 lines):
- `note(save, kind, { who, team, w })`: entries `{ s, r, kind, who, team, w }`, capped at 60.
- `remembers(save, { who|team, kinds })`: the sum of `w`, which fades by 1 per season.
- `latest(save, filter)`

**world.js:**
- `newWorld(seed)` gives `contracts[code] = 1..3` from `rng(seed,'contract',code)`. Callers: `newCareer` and `migrate`.
- `marketMoves`, as ordered, seeded phases:
  1. Age and age drift: unchanged.
  2. Retire: unchanged.
  3. Contracts tick by −1. At 0 the team re-signs if rating ≥ the tier's average − `renewGap` and `rng < renew`; otherwise the driver goes free.
  4. The team drops a driver rated ≤ tier average − `dropGap` who scored fewer points than his teammate this season (from `save.history` / the season's results).
  5. Open seats, best team first:
     - candidates are free agents plus seated AI drivers in a final-year contract at a team with a worse `expPos`;
     - score = rating + 2·form + `rng` jitter ±1;
     - a seated driver who moves opens his seat, which joins the queue (a cascade, at most `maxMoves`);
     - the driver the player displaced this window skips the player's old seat while another seat is open.
  6. Academy call-ups with seeded names from `academyNames`, unique.
  - New signings get a 2-3 season contract.
  - `coverMoves` already writes the stories.

**offers.js and rules.js:**
- `playerRating(save) = clamp(mateRating + (−avgQualiGap%)/0.21, 60, 99)`.
  - The quali gap comes from this season's `results[].duel.mine/mate`; the rating is shown on offer cards.
  - 0.21 % per point is `paceOf`'s `perRating`, so the number comes from a quantity the game already measures.
- `seatFor(save, team, seat)` allows an offer only when the incumbent is null, the incumbent's contract is ≤ 1, the incumbent's rating < `playerRating`, or the incumbent's rating < `star` and interest ≥ `buyout`.
  - If the A seat is blocked, try B (keeping today's `carZ` rule).
  - Otherwise the team outlook says why: "Both seats are signed: Ferrand to S4".
  - Used by `outsideOffer`, `midSeason`, approach and transfer demand.
- `interestOf`:
  - Drop the `declined >= 3 → −0.2` term.
  - Subtract `min(coolMax, cool · remembers(team, ['spurned']))`.
  - Add `wantMax · clamp(stat / norm, 0, 1)` for the team's `want`, computed from the season's results; no new save fields.
- `why` is built from the two largest named terms using the `media.json` `reasons` templates (a seeded pick). It replaces `WHY`.
- `spurned` is noted only for genuine refusals. Review each `declined++` site:
  - career.js:268 (walk away) and offers.js:76 (a haggle withdrawn): yes;
  - offers.js:91: check what it is;
  - career.js:134 (unpicked offers when signing elsewhere), career.js:546 (lapsed mid-season offers) and offers.js:144 (the other mid-season offers): no, they write nothing.
- Counter-bid: with ≥ 2 outside offers, the lower-rank-or-interest one improves one step (salary ×1.1) with the line "{A} have matched {B}".
- Rumours: in the `market` week, post 1-2 inbox and press items from the same state: seats whose contract has 1 season left, and the top 3 candidates by the phase-5 score, the player included when they qualify for that seat.
- If a rival with heat ≥ 40 is on the same shortlist and gets the seat the player wanted, set heat to `seatLost` with cause `'seat'`.

**Migration, schema 8 to 9:**
- Seed `world.contracts`.
- `career.ledger = []`.
- `teams[].declined` is kept but unused.

**career-metrics targets** (all 3 skills):
- AI-to-AI moves 1-3 per season on average (today 0).
- The displaced driver takes the player's old seat < 20 % of the time (today 45-52 %).
- Teams with an unchanged line-up after 6 seasons ≤ 1.5 of 8 (today 2.5-3.4).
- 0 offers for a seat whose incumbent is rated ≥ 90 with a contract > 1 (an assert).
- No single outside-offer reason text on > 30 % of offers (today 60-76 %).
- Seated AI average rating within ±0.3 of today's 83.47, since this WP changes no rating.
- Progression guards against the baseline:
  - average skill: Maestro offer any ≥ 92 %, median season 2 ±1; Legend any 14-24 %;
  - strong skill: Legend any ≥ 95 %, median ≤ 3;
  - every market at every skill has at least one offer.

**Tests:**
- Contracts tick and renew deterministically: the same seed gives the same seat-map hash after 6 seasons.
- The cascade stops at `maxMoves`.
- A star incumbent is never displaced.
- The displaced driver skips the player's old seat when another seat is open.
- Academy names are unique.
- Coolness: a walk-away cools and fades; a lapsed or unpicked offer adds nothing.
- `why` is never empty.
- Rumoured seats really open at season end unless that driver re-signs; check the rumour text says "up for renewal".
- A schema-8 save migrates.

**UI:**
- career-deals offer card: reason, `playerRating`, cool line.
- career-hub: rumour inbox item; team outlook explains blocked seats.

**Leave out:**
- Team budgets and transfer fees between AI teams.
- Rating drift by form.
- Development by table position or regulation resets (all of these move AI pace).
- Promotion or relegation between tiers.

## WP5: Choices with consequences

**The player sees:**
- 2-5 small decisions a season, each arriving in the inbox with buttons that state their effect.
- The game quotes earlier choices back in offers and stories ("Saetta haven't forgotten you walked out of talks in Season 2").
- A choice left unanswered takes its stated default, with a note.

**New `src/game/career/choices.js` and `assets/career/choices.json`:**
- Each scene has `{ id, trigger (a name; the predicate lives in JS), options: [{ label, effectText, effects }], default, story }`.
- Effects come from a fixed list: `trust`, `rep`, `xp`, `heat {who}`, `interest {team, this season}`, `note {kind}`, `flag {kind}` (one race) and `story`.
- At most 1 scene per week and 5 per season, rolled with `rng(seed,'choice',season,week)`, stored in `season.choices`.
- A scene is delivered through `post(save, 'choice', ..., { choice: id })` (`inbox.post` already takes an action).

**Scenes:**
1. **Callout:** the nemesis exists for the next round and their composure is < 0.5.
   - Accept: flag `callout`. Beating them pays REP +12 (×1.5 if they are from a higher tier) and XP +60; losing costs REP −4.
   - Decline: REP −2.
   - Ledger `callout_won` or `callout_lost`.
2. **Press:** after a podium, or a finish ≥ 4 below the expected place.
   - Humble: trust +3.
   - Bold: REP +5, the named rival's heat +15 (cause `'bold'` if new), ledger `bold_press`.
   - Showman: every deal's mood +1, within the WP3 cap.
3. **Rumour:** a WP4 rumour names the player.
   - Deny: trust +2.
   - Stoke: REP +4, trust −3, that team's interest +0.1 this season.

**Team orders (from WP2):** finishRace also notes `orders_obeyed` / `orders_ignored`, and the principal story quotes it at the next season-end market.

**Callbacks:** `media.json` `callbacks` templates fill offer `why` lines, principal lines and rival stories from `ledger.latest`.

**Migration, schema 9 to 10:** `season.choices ??= {}`.

**Sim:** the stub answers with a seeded option from its own dice. Metrics: scenes per season, average 2-5; never more than 5; the callout flag pays at most once.

**Tests:**
- The same seed and the same answers give the same ledger and story-title hash.
- An unanswered scene applies its default at advance and posts a note.
- Every effect is from the fixed list and stays within bounds.
- The callout flag clears after one race.
- A callback text names a real ledger entry.

**UI:** the career-hub inbox renders `action.choice` as 2-3 buttons with their effect text. That is one renderer branch; no new screen.

**Leave out:**
- E05, E06 and E14 (they touch physics or drift).
- E10 (team development).
- Secret meetings.
- Any LLM text.

## Docs

Update `docs/career-mode.md`:
- 6.5 interest and seats
- 6.6 rivals
- 6.8 market
- 4.2 and section 13 sponsor days

Also update any GAME.md or README line that calls sponsor days drift days.

## What stays out overall

- Owner mode.
- An LLM.
- AI pace or rating changes.
- Changes to the player car or the assists.
- Qualifying, the qualifying track, `calendar.json` `qualifying`.
- Paid generation or downloads.
- Edits to `car-lab/`, `meshy*/`, the repo-root `scripts/`, `project-plan.md`, `vehicle-pipeline.md`.

## Measured versus inferred

**Measured:**
- The baseline sim table above.
- `test-career` passes.

Everything I checked against the code is listed under "scores". Beyond that:
- **Inferred:** every new number (heat values, objective thresholds, mistake rates, metric targets) is a first guess that the metrics script and the QA races must confirm.
- **Unverified:** that `qa-career-season.mjs` asserts nothing drift-specific, and what sponsor mood 0 does.

## Work packages

### WP1 Rivalries that are earned (pure career and result plumbing)

**Outcome:** 1-3 rivals, each with a cause and a head-to-head record, and at most one nemesis per weekend. Heat comes from the raced grid, from contacts and from passes, not from the 16-driver classification. The Home Rivals block shows the cause, the record and a Nemesis badge.

**Files:** src/game/career/world.js (heatAfter on raced keys plus contact and pass heat, career.rivalry, nemesisOf, takeSeat seeds the teammate at 20 and the displaced driver at 30, rivalsOf); src/game/career/career.js (pass raced at :408, raceSetup.nemesis, finishRace reads result.contacts and passes, SCHEMA 8 migration); src/game/session.js (contact attribution at the impact emit :113, position event gets 'by'); src/game/game.js (careerRun contacts, passes and offTrack, careerDone adds contacts, passes, offTrack and totals); src/game/career-hub.js (startRace result, Rivals block); assets/career/tuning.json rivals; scripts/career-sim.mjs (seeded stub contacts and passes on their own dice); new scripts/career-metrics.mjs; scripts/test-career.mjs

**Acceptance:** `node scripts/test-career.mjs` passes, with new checks: raced-only heat, contact +8/+14, passes capped at 2, nemesisOf deterministic and at most one, teammate seeded, h2h counted, schema 7 to 8 migration. `node scripts/career-metrics.mjs 100 6` PASS at all 3 skills: average rivals at career end 1.0-3.0, at most 1 nemesis per round, rounds with a nemesis 20-70 %, rival REP lines per race at most 1.0, at least 90 % of rivals with a non-grid cause. `node scripts/career-sim.mjs 100 6` offer and tier lines within ±5 pp of the baseline (average skill: Maestro any 97 %, Legend any 19 %; final tiers 30/56/14 %).

### WP2 Rivals race differently near the player (AI profile hooks, team orders, HUD, commentary)

**Outcome:** The nemesis defends and presses, and fires the stock nitro when chasing the player. Low-composure rivals sometimes run wide or lift under sustained pressure. The teammate yields on the last lap when the team favours the player, and the player can choose whether to obey 'let him by'. The race HUD shows the nemesis tile, and the booth uses the recorded 'defending' and 'side_by_side' lines. Clear-air AI pace and the player car do not change.

**Files:** src/game/career/rules.js (composureOf, ordersFor); src/game/career/career.js (raceSetup.ai with knobs copied from tuning, orders, mateKey; finishRace applies the orders result); src/physics/driver.js (4th constructor argument prof; hooks A-D gated on prof and !car.hero; F.aiEvents); src/cars.js:583; src/game/game.js (:306 F.aiFor, F.orders and F.nemesisKey, cleared at :352; say defending and side_by_side; orders banner; careerRun.orders); src/game/session.js (drain aiEvents, sideBySide, race-mode rival getter with the quali branch unchanged); src/game/hud.js rival tile in races; src/game/career-hub.js startRace; assets/career/tuning.json rivals.track; new scripts/test-ai-rivalry.mjs; new scripts/qa-rivalry-race.mjs; one-line QA_URL in scripts/qa-player-lap.mjs:19

**Acceptance:** `node scripts/test-ai-rivalry.mjs` passes: null-profile output byte-identical over 1,000 ticks, defend moves only toward the player and stays within lo/hi, mistake roll reproducible and zero without the player within 0.6 s, no profile on the hero. `node scripts/test-ai-nitro.mjs` and `node scripts/test-career.mjs` pass (ordersFor thresholds, trust and heat from obeying or ignoring). With Vite on `npx vite --host 127.0.0.1 --port 5302 --strictPort`, `node D:/RaceUltimate/track-viewer/scripts/qa-lock.mjs -- node scripts/qa-rivalry-race.mjs india 3 http://127.0.0.1:5302` and then drylake must show: profiled AI clear-air best laps within ±0.3 % of unprofiled, no new respawns, AI off-asphalt time at most 1 s above unprofiled, hero contacts at most 1.5x, at least 1 defend per race. A hook that fails ships with on:false. qa-player-lap via QA_URL=http://127.0.0.1:5302 must match a run on the base commit.

### WP3 Sponsor Challenge replaces Drift Attack on career sponsor days

**Outcome:** Each sponsor day is a 2-lap sprint from P6 of a 6-car field, named after the deal it serves, for example 'Shell Overtake Challenge'. It has 3 objectives taken from the brand's target kind: bronze for 1, silver for 2, gold for 3. All objectives are relative, so they are fair on every circuit, car and tier. Gold raises goodwill by 1 and counts toward the deal's season target; no medal costs 1. Mood is capped. Drift Attack is untouched in free play.

**Files:** assets/career/tuning.json side.challenge (laps, field, pace, name, objectives); src/game/career/rules.js (challengeMet, sideMedal for the sponsor kind); src/game/career/career.js (eventName rotates deals, sideSpec via a new challengeSetup, finishSide takes the result object, stores met, applies the mood clamp and the deal-target credit); src/game/career/offers.js (deal target counter, read only for the mood floor); src/game/game.js:503 maps sponsor to race; src/game/career-hub.js startEvent and the event card; src/game/career-deals.js:49-50; scripts/career-sim.mjs:53 replaced by a seeded stub challenge result; scripts/career-metrics.mjs; scripts/test-career.mjs

**Acceptance:** `node scripts/test-career.mjs` passes with: challengeMet tests for every objective type and kind, DNF gives 0, deals rotate, mood clamped to [1, startMood+3] with −1 on no medal, gold credited to the deal target once per season, eventName format, old numeric drift results still render. `node scripts/career-metrics.mjs 100 6` PASS: at skill 0.995 bronze or better 75-95 %, silver or better 40-70 %, gold 10-35 %; at 0.975 silver or better at most 45 %; sponsor mood never above the cap; wallet at the end of each tier within ±10 % of the baseline (average skill: rookie 17905, maestro 49302, legend 101082). `node D:/RaceUltimate/track-viewer/scripts/qa-lock.mjs -- node scripts/qa-career-season.mjs http://127.0.0.1:5302` (RACE_LAPS=1) completes with the sponsor day run as a race, and one AI-bot challenge from P6 on India earns at least bronze.

### WP4 A contract market the player can read (AI contracts, seat check, reasons, rumours, fading coolness)

**Outcome:** AI drivers hold contracts, re-sign or move in a seeded cascade, so 'X moves to Y' stories appear. Teams offer only seats that really open, and never drop a 90+ incumbent with a running contract for the player. Offers explain themselves with the team's own wants and a market rating built from the player's quali gap to their teammate. Turning a team down cools it visibly and the coolness fades; lapsed offers count for nothing. The market-week rumours name seats that will open. Competing offers can match each other. The displaced driver rarely ends up in the player's old car.

**Files:** new src/game/career/ledger.js (note, remembers, latest); src/game/career/world.js (newWorld(seed) contracts, marketMoves phases 1-6 with the cascade and the displaced-driver rule, academy names); src/game/career/offers.js (seatFor, why from the top two terms, the 'spurned' rule per declined++ site, counter-bid, rumours, seatLost heat); src/game/career/rules.js (interestOf drops the decline penalty and adds cool and want terms, playerRating); src/game/career/career.js (newCareer and migrate pass the seed, SCHEMA 9: contracts and ledger); src/game/career/media.js (rumour stories); assets/career/drivers.json academyNames; assets/career/tiers.json want keys; assets/career/tuning.json market and offers; assets/career/media.json reasons and rumour; src/game/career-deals.js and career-hub.js (reason, rating, cool line, blocked-seat outlook, rumour item); scripts/career-metrics.mjs; scripts/test-career.mjs

**Acceptance:** `node scripts/test-career.mjs` passes with: the same seed gives the same seat-map hash after 6 seasons, the cascade is capped at maxMoves, a star incumbent is never displaced, the displaced driver skips the player's old seat when another is open, academy names are unique, walk-away coolness fades while lapsed offers add none, why is never empty, schema 8 to 9 migration. `node scripts/career-metrics.mjs 100 6` PASS at all skills: AI-to-AI moves 1-3 per season, displaced driver in the player's old seat under 20 %, unchanged line-ups at most 1.5 of 8, 0 offers against a 90+ incumbent with a running contract, no single reason text above 30 % of outside offers, seated AI average rating within ±0.3 of 83.47. Progression guards: average skill Maestro offer any at least 92 % with median season 2 ±1, Legend any 14-24 %; strong skill Legend any at least 95 % with median at most 3; every market at every skill has at least 1 offer.

### WP5 Choices with consequences (callout, press, rumour scenes, ledger callbacks)

**Outcome:** 2-5 seeded decisions a season arrive in the inbox, each button stating its effect: accept or decline a nemesis callout, a press-conference tone after a podium or a bad result, deny or stoke a transfer rumour. The results show up in the next race (callout stakes), in heat and trust, and later in offer and story text that quotes the player's past choices, including obeyed or ignored team orders. An unanswered scene takes its stated default, with a note.

**Files:** new src/game/career/choices.js; new assets/career/choices.json; src/game/career/ledger.js (new kinds); src/game/career/career.js (triggers in advanceWeek and finishRace, the callout flag paid once, orders ledger notes, SCHEMA 10 season.choices); src/game/career/media.js and assets/career/media.json callbacks; src/game/career/offers.js (callback lines in why); src/game/career-hub.js (inbox renders action.choice as buttons); scripts/career-sim.mjs (seeded answers on their own dice); scripts/career-metrics.mjs; scripts/test-career.mjs

**Acceptance:** `node scripts/test-career.mjs` passes with: the same seed and answers give the same ledger and story-title hash, unanswered scenes take their default and post a note, effects come only from the fixed list and stay within bounds, the callout flag clears after one race and pays at most once, callback texts name a real ledger entry, schema 9 to 10 migration. `node scripts/career-metrics.mjs 100 6` PASS: scenes per season average 2-5 at every skill, never more than 5 in a season; all WP1-WP4 targets still PASS. `node scripts/career-sim.mjs 100 6` progression lines within ±5 pp of the baseline. Docs updated: docs/career-mode.md 4.2, 6.5, 6.6, 6.8 and section 13.

## Biggest risk

The biggest risk is the new AI behaviour near the player in src/physics/driver.js (WP2): defending lane moves, closer following, mistakes under pressure and team-order yields. driver.js is hand-tuned around past failures. Its comments record cars locking together side by side and sliding into the outside wall as a pair, and a lane chase that walked pairs out to 9 m. None of this is visible to the node sim. A defend move toward the player's line can cause more contact, AI cars in walls and respawns, and higher repair bills (repairs bill every hit). The defend move is the one most likely to cause that.

Mitigation, all in WP2:
- Every hook is gated on a non-null profile and !car.hero, and each one has its own on/off flag in the profile's knobs.
- The null-profile output stays byte-identical, checked over 1,000 ticks in scripts/test-ai-rivalry.mjs.
- scripts/qa-rivalry-race.mjs compares profiled races with unprofiled ones: clear-air best laps within 0.3 %, no new AI time off the asphalt or new respawns, and contacts at most 1.5x.
- Any hook that fails ships switched off.

The second risk is WP4's seat check and cascade starving progression. The metrics guard against it: Maestro offer at least 92 %, Legend 14-24 %, and at least one offer in every market.

## How the designs scored

Scored 1-10 on player impact / feasibility tonight / risk to existing behaviour (10 = safest) / fit with the user's constraints.

DESIGN 1, story first: 8 / 5 / 6 / 8, mean 6.75. Its strengths are readable cause and effect (rivalries with a cause and a head-to-head record, a ledger the game quotes back, choice scenes with a stated default, rumours before offers) and the seat check that protects 90+ incumbents. Its weakness is that it builds a choice engine, a four-stage saga, a new market, three sponsor formats and on-track hooks, which is too much for one night. On track it does only the nemesis press and defend.

DESIGN 2, systems first: 8 / 3 / 4 / 7, mean 5.5. It has the deepest market (AI contracts, an auction, buy-outs, counter-bids). It also has the best single idea: a player "market rating" built from the quali gap the game already measures (rating per 0.21 % of pace, rules.js:42). Its other good ideas are reasons made from the two largest utility terms, and rumours computed from the same state as the market. The risk comes from form-driven rating drift, budget-driven development and regulation resets. All three feed AI pace (career.js:310 aiPace, dev into raceSetup levels), and the whole market is a rewrite. That made it the least feasible design and the riskiest to balance.

DESIGN 3, on-track impact first (WINNER, the base): 9 / 7 / 6 / 7, mean 7.25. It covers most of what the user asked about: rivals the player can feel in the race (defending, pressing, mistakes under pressure, team orders as a player choice). Each hook is gated on !car.hero and on a profile only the career sends. Heat must be earned from the raced grid, contacts and passes. The sponsor format is the cleanest: one race session, three tick-box objectives per brand target kind, all relative. It loses on fit because it skips transfers on purpose, and the user named transfers explicitly.

Checked against the code:
- Confirmed:
  - heatAfter gets the full 16-key classification (career.js:394-395 builds order = raced plus the non-qualifiers; world.js:79).
  - No seat check in outsideOffer or seasonOffers (offers.js:112-120, 199-205).
  - The 3 stock WHY lines (offers.js:110).
  - The permanent decline penalty, from all 6 increment sites (career.js:134, 268, 546; offers.js:76, 91, 144).
  - finishSide raises mood with no cap (career.js:375).
  - eventName always uses deals[0] (career.js:249).
  - The sim fakes the drift score (career-sim.mjs:53).
  - The rival getter is quali only (session.js:163).
  - The traffic loop reads no hero (driver.js:92-100).
  - Hard-mode nitro is gated on field.hardPace (driver.js:140).
  - game.js:503 maps sponsor to the drift mode.
  - window.game is exposed (main.js:1327), so a QA script can start a profiled race.
- Corrected or added:
  - Test days already run in 'quali' mode against par, and careerDone already returns order and bests for the race mode (game.js:507-510). The Sponsor Challenge therefore needs no new session MODE: it is the 'race' mode with a short grid.
  - newWorld() takes no seed (world.js:11). AI contracts need a seed argument added.
  - qa-player-lap.mjs hardcodes port 5180 (line 19).
- Measured today: career-sim 100x6 baselines. At average skill 0.995: Maestro offer any 97 %, median season 2; Legend any 19 %, median season 4; final tier rookie/maestro/legend 30/56/14 %; offers per season 1.75. At strong skill 1.015: Legend any 100 %, median season 3. At weak skill 0.975: offers per season 1.12, minimum 1.

Grafted onto Design 3:
- From Design 1: rivalry causes and h2h records; the ledger (lite) with fading memory in place of the hidden decline penalty, where only real refusals count; the callout, press and rumour choice scenes with a fixed list of effects and a stated default; the displaced driver kept out of the player's old seat; named academy drivers; no 90+ incumbent with a running contract ever dropped for the player.
- From Design 2: AI contracts that tick down, with AI-to-AI moves as an ordered, seeded cascade that makes the media.js "moves to" story reachable; the player market rating from duel gaps; offer reasons from the two largest named terms; team wants as real interest terms computed from season results; rumours from the same market state; a one-step counter-bid; a metrics script with targets.
- Dropped from Design 2: rating drift by form, team budgets and development resets. All of them move AI pace.
