# Ultrack Career Mode: design

**Transfers with drama, changed 2026-11-06 at the user's call (`docs/10x/transfers-spec.md`; section 6.10, and 6.5 and 6.8 below):** moving team is a game now, not a form. The season end is a transfer window of three days with deadlines, rivals for the seat, teams that come back with more and your own team's answer; every principal has a style, and four tactics answer it; and the AI market runs on a hidden loyalty: lower teams sack, and hire from slightly better teams.
- **Code:** `career/transfers.js` (the window, the tactics), `offers.js` (`talksFor`, `rivalSigns`, `refuse`, patience by style), `world.js` (`loyalty`, sackings, `poachable`, the rivals' signings in `marketMoves`), `rules.js` (`styleOf`; `demandOf` halves the prize lever), the review screen (`career-ui.js`) and the deal screen (`career-deals.js`). Data: `tiers.json` `style`, `tuning.json` `window` and the `market.loyalty*`, `sack*`, `poach*` keys, `media.json` `window`.
- **Old saves** (schema 10): every AI driver gets a seeded loyalty (an academy driver 60); a save at the review opens its window on day 1, with deadlines and rivals for the outside offers it holds.
- **Check:** `node scripts/test-career.mjs` (the window, every tactic per style, rivals, the own-team answer, loyalty, a forced sacking and poach, the caps, schema 11), `node scripts/career-sim.mjs 100 6` and `node scripts/career-metrics.mjs 100 6` (moves, sackings and poaches per season).

**Shop images** (`public/assets/ui/shop/`): generated with Meshy (nano-banana) on 2026-11-04 from prompts asking for no text, logos or real brands. Nine of the 22 exist; cards without one show only their icon.

**Happiness, fan support and the Shop, changed 2026-11-04 at the user's call (Part 3 of the career overhaul):** money now has somewhere to go at every tier, and a driver has a life.
- **Mood and fans** (`career/life.js`, `assets/career/lifestyle.json`, `save.life`): two meters, 0-100. **They never change a car, a lap or a rival** (nothing in `life.js` is read by `paceOf`, `aiLap` or the physics; `test-career.mjs` qualifies the same career at mood 3 and 97 and compares every lap). Mood starts at 50 and drifts 16 % of the gap back to 50 each race week; each race week adds: the Round Rating against 6, a win or podium, the teammate duel, a rival beaten, a retirement or missed cut (more at an Open), a poor run of ratings, fan support, team trust, a good seat (Maestro and Legend), a seat below your form, a home crowd, the press that week, a big repair bill, the lifestyle you own (its glow, up to 2.5) and, past 9 weeks without time off, a grind. The lines are kept in `save.life.why` and shown on the Life tab as "Why it moved". Fan support follows results, clean racing, the press and a home crowd (`save.player.nation`: IND at Infinia and India Ghat, JPN Tokyo, KOR Cheongsan, ITA Venice, UAE Shajawa and Marina, USA Llano), and settles toward 20 + 3 % of reputation.
- **Bands** (`lifestyle.json` `bands`): 80+ On top of the world (sponsor pay +10 %, XP +5 %, trust gains +30 %, reputation gains +25 %, outside offers x1.25, +1 leverage in contract talks, friendly press), 60-79 Content (sponsors +4 %, reputation gains +10 %, outside offers x1.1, +0.5 leverage), 40-59 Neutral, 20-39 Frustrated (sponsors -5 %, trust grows at half speed), under 20 Unhappy (outside offers x0.6, a sponsor may walk at 30 % a race week through the same ending as too many skipped sponsor days, harsh press, and the player may **demand a transfer**). Sponsor pay is scaled inside the existing retainer and bonus lines (`offers.js` `sponsorRound`), so a round's pay still adds up and the repair cap is unchanged. It never ends a career: the worst case is a slower climb.
- **Demand a transfer** (`offers.js` `demandTransfer`, once a season, not in a race week): up to two offers from the tier above (if they would talk to the player) and from the player's own tier, made with the existing `outsideOffer` and put in `save.season.mid`, so they are signed with `signMid` like any mid-season offer and start next season; they lapse when the week is advanced. The interest leaves out any refusal the team remembers, so these offers carry no cool line; a team in the player's own tier whose bar they are below still answers, and says so ("Corvid were not looking at you (Reputation 120 of 200), but they have a seat."). No team to offer: a reserve seat (`reserveOffer`). Their team takes it badly (trust -6).
- **The Shop** (`lifestyle.json` `items`, `career.js` `lifeInfo` and `buyLife`): Luxury (apartment 5,000, watch 9,000, penthouse 24,000, mansion 75,000, supercar 140,000, yacht 320,000): bought any time, a lift now, a glow every round, an upkeep a season, a repeat counts half as much (three at most). Parties (night out 400, big party 2,500, huge bash 9,000): a lift and a seeded 5 / 9 / 15 % chance the pictures get out, which costs team trust or a sponsor's goodwill (the same path as a skipped sponsor day, so it can end a deal), never the wallet. Time off (holiday 1,500, luxury holiday 7,000): a bigger lift, resets the grind, and skips the week's optional event (`w.event.skipped`; on a sponsor day it costs goodwill once, like any no-show). Giving back (fan day 800, charity gala 5,000): fans and a little mood. Sponsor ad deals (ad shoot, billboard deal, TV commercial): pay `pay x tier's sponsor multiplier x form x mood`, take the week and its event (an ad is work, so a sponsor is not upset), cost a little mood, need reputation 0 / 150 / 400 and are capped at 3 / 2 / 1 a season; the brand is a seeded pick from `sponsors.json` at the player's tier or below (the list has no exclusive deals, so none can clash). **One activity per open week** (`w.activity`; open and pre-season weeks only, so a race week and the market take luxuries only). The six staff tiers are on the same screen and hire through the same `hireStaff` and the same ask-then-pay press as the Garage.
- **Upkeep** is paid when a season starts (`life.js` `payUpkeep`), cheapest first; what the wallet cannot carry is **sold at half its price**, so the wallet never goes below 0, with an inbox line and a press story. The Life tab warns when next season's upkeep is more than the wallet.
- **Press** (`media.js` `coverLife`, `media.json` `life`): a story for each purchase, party, scandal, holiday, gala and ad, and for a driver on top of the world, an unhappy one, a transfer demand and a sale. Scandals are light and never about anyone driving after a party.
- **Screens:** a **Life** tab (after Garage; `TABS`, `LAYOUT`, the Q/E cycle and the arrow keys all take it, cards are `data-nav`), a Mood stat in the status bar, a Mood line on the round report, the booked activity on Home, the Calendar and the Events tab. Shop pictures are `/assets/ui/shop/<id>.webp` and hide themselves when missing (a card shows its icon instead). Ids: the 16 items and `crew-pro`, `crew-elite`, `crew-factory`, `engineer-pro`, `engineer-elite`, `engineer-factory`.
- **Old saves** (schema 7): `save.life` appears at mood 50 with nothing owned; a season under way keeps its weeks with no activity booked.
- **Check:** `node scripts/test-career.mjs`, `node scripts/career-sim.mjs` (prints, per skill, wallets at the end of each tier with and without a shopping policy, what was bought, and the mood by round of a season for both), and in the real game `node scripts/qa-lock.mjs -- node scripts/qa-career-life.mjs`.

**Car running costs, changed 2026-11-04 at the user's call (Part 2 of the career overhaul):** money now has somewhere to go besides upgrades.
- **Repairs** (`rules.js` `hitBill`, `repairBill`; `tuning.json` `repairs`): every hard crash in a qualifying, the Last Chance Qualifier or a race adds a bill, shown as one negative line in "What it paid" (`report.coinLines`, `report.repairs`). Practice, test and sponsor days never bill. The bill is `400 x class price x (v/100)^2`, where `v` is the velocity the hit took away in the 0.4 s after the session's `crash` spike (`session.js` emits `impact` with it), and is free under 50 km/h. Class prices are `economy.js` `CLASSES` (Tourer 0.8, Sports 1, Super 1.35, Hyper 1.8): 100 km/h in a mid-class car is 400 U. It is capped at 40 % of what the round paid (before the bill), so the wallet never goes down. The weekend's hits are kept in `save.season.current.hits` (qualifying, `logHits`; the Last Chance, `finishLcq`) and billed once, in `finishRace`. The Last Chance report only warns ("Crash damage: ..."): it pays nothing itself, and a player beaten there is still billed in the round's report. Why `impact` and not the crash event's own `kmh`: that is the speed before the hit, and a rub along a barrier at 150 km/h trips the crash test about as often as a head-on one but takes a fifth of the speed (`scripts/qa-crash-severity.mjs`).
- **Upgrades** are five categories: Engine, Tyres, Brakes and the new **Aero** and **Nitro**, still three levels each, with the same tier caps and Career Level gates (`CATS` in `economy.js` drives the garage, the hub and free play). Maxing a mid-class car costs 30,000 (was 18,000). Aero multiplies the car's downforce by 1.3, 1.6 and 2 (`assets/cars/specs.json` `upgrades.categories.aero`, read by `physics/handling.js`): more cornering grip the faster the car goes, no change in drag or top speed, and nothing at all on a stock car (`handling()` of a stock car is identical to before for all 16 cars). Nitro scales the tank (1.25, 1.5, 2 times) and the refill rate (the same); the boost is unchanged. The AI drivers' corner speeds follow a rival's Aero through `aeroGain` (`physics/arcade.js`), exactly 1 for a stock car. Measured lap effect: `scripts/measure-upgrades.mjs`.
- **Rivals** wear Aero equal to the rounded average of their team's development levels (`aeroOf`; `t.dev` stays three long, so saves are untouched). `parLap` takes it off the lap by `pace.perAeroLevel` per level, so for a dev of 0 the par laps are exactly what they were. Rivals buy no Nitro; in Hard mode they fire the stock tank.
- **Staff** (`assets/career/staff.json`, `career/staff.js`, `save.staff`): a crew (repair bills -25 / -40 / -60 %) and an engineer (upgrade prices -10 / -20 / -30 %), hired separately for the current season at Pro 1,500 (Career Level 3), Elite 4,000 (8) or Factory 9,000 (15), paid at once and never refunded. They belong to the driver, not the team, and lapse when the season rolls. The Garage tab has the Staff block: the first press on a tier asks, the second pays. Ids `crew-pro` ... `engineer-factory` are the Shop image names for Part 3 (`/assets/ui/shop/<id>.webp`). The part buy-back at 60 % applies to what was paid, discount included.
- **Old saves** (schema 6): `save.staff` appears empty and the garage entries gain `aero` and `nitro` at 0; a missing category reads 0 everywhere (`economy.levelsOf`, `stock()`).
- **Check:** `node scripts/test-career.mjs`, `node scripts/career-sim.mjs` (prints crash bills, staff and the wallet at the end of each tier), `scripts/measure-upgrades.mjs`, `scripts/qa-crash-severity.mjs` and, in the real game, `node scripts/qa-lock.mjs -- node scripts/qa-career-costs.mjs`.

**The Tour, the Opens and the Ultrack Ranking, changed 2026-11-04 at the user's call (over sections 4.1 to 4.4 and the worlds of `career-worlds.md`):** one Tour for every tier, because a league per tier would hold fewer than 8 drivers. Tiers stay as contracts, expected places, upgrade caps and the Cup table inside it.
- **Season (up to 10 race days, 21 weeks):** Tour 1-2, Japan Open (Tokyo), Tour 3-4, market, India Open (Infinia), Tour 5-6, Venice Open (Venice), Masters (Marina at night), review. `assets/career/calendar.json` `format`. The Tour is not listed: it is every circuit in `calendar.json` `tracks` that the game ships and that is not an Open's, the Masters' (Marina) or a qualifying or Shootout venue; today Shajawa, India Ghat, Cheongsan (`qingshan`) and Llano, and a new circuit joins it once it is in `tracks` and `src/tracks.js` (the season strip shows the first word of its name unless `career-shell.js` `SHORT` has a label for it, and the loading screen shows Marina's slide until `race-loading.js` `LOADING_SLIDES` has one for it). No circuit is raced twice in a season while the Tour has at least as many circuits as Tour rounds (six): each Tour circuit once, the Opens and the Masters only on their own. With fewer (today four for six rounds) the Tour runs the shuffled circuits in a cycle, so the fewest return (each at most once more), each a whole cycle later (four Tour rounds today, so never twice in a row), and a return takes the circuit's second name. A game shipping no Tour circuit at all fills the Tour from its other circuits but the Opens' and the Masters'. A circuit marked `wetOnly` always runs in rain or damp (rain 2 in 5, from `tuning.json` `weather`), its wet round does not count against `weather.maxWet` for the other rounds, and it comes last in the shuffled cycle, so it never opens the Tour (round 1 stays dry) and returns only once every dry circuit has; a circuit offering only night in `src/tracks.js` `times` runs at night. A season already under way keeps the calendar it was rolled with; a new season rolls its own. Qualifying and the Last Chance Qualifier rotate between Mojave Dry Lake, Pilbara Pit and North Sea Terminal, fixed per round, never twice in a row; the Shootout stays at Dry Lake. These three venues host no other race. Each Open circuit is raced in its Open and nowhere else: practice is locked on it until the Final, and a test or sponsor day before an Open runs on the next round that is not an Open.
- **Ultrack Ranking** (`career/ranking.js`, `save.ranking`): all 16 seated drivers; ranking points by finishing place (25-18-15-12-10-8-6-4) times 1 on a Tour round, 2.5 at an Open Final, 3 at the Masters; the last 12 race days count (tennis style) and it carries across seasons. It starts from the driver ratings, a seed that fades out over the first 12 days; the player starts below the field (`tuning.json` `ranking`). Shown on the Home "Road to" card, the Standings tab, the Driver tab, the report and the review.
- **Entering an Open** (`career/career.js`, "the Opens and the Masters"): ranks 1-4 go straight to the Final. Ranks 5-16 fly one lap at the round's qualifying venue (one retry); the fastest 8 of the 12 race the Last Chance Qualifier there (a real short race, the one allowed race at a qualifying venue) and its top 4 reach the Final. **Final grid:** the four seeds first, in ranking order, then the four Last Chance finishers in the order they finished, so a season of results buys the front rows and a seed's skipped lap is a real advantage. Rivals' races the player is not in are computed from `aiLap`, seeded, with a separate noise key for the race.
- **Missing out:** missing the cut, losing the Last Chance, retiring in it, or being outside the Masters' top 8 runs the Final without the player; the round is scored like a missed cut (Round Rating as now, no points, no Ranking points), the objective is "Reach the Japan Open Final" and missing it does not cost team trust, because the ranking decides it. A seed is judged like a podium skip: an earned skip never counts against the rating.
- **Stakes** (`tuning.json` `events`): a Final or the Masters pays 3x prize money (race prize and win/podium bonus) and 3x positive reputation, and scores 1.5x season points. Opens won, Masters won, the Triple Crown (all three Opens in a career, first season kept) and Grand Slams (all three in one season) are in `save.stats`; `save.hall` lists every winner, rivals included, and the press covers them (`media.js` `coverOpen`).
- **Old saves** (schema 5): the ranking starts from today's ratings; a season rolled before the Tour keeps its calendar and plays as plain Tour rounds (rounds without a `kind`).
- **Check:** `node scripts/test-career.mjs` (format, entry rules, absent players, practice and events, honours, migration), `node scripts/career-sim.mjs`, and in the real game `node scripts/qa-lock.mjs -- node scripts/qa-career-tour.mjs`.

**Race length and qualifying, changed 2026-11-01 at the user's call (over sections 4.1 and 4.2 below):** nobody should have to drive 8 laps to take part. The player picks a race length in minutes when creating a career and between rounds: Sprint (2.5, the default), Standard (4), Full (6). Laps follow per circuit, 2-lap minimum; points, XP, rating and reputation are the same at every length (only per-lap prize money differs). Qualifying, the Shootout and test days are one valid flying lap with a 250 m run-up; the Paddock's "Improve your lap" retries before the race and keeps the better lap.

**The hub, weeks, events, negotiations and sponsors, changed 2026-11-02 at the user's call (section 13):** read section 13 first; it replaces the Paddock, side events and offer cards described below, and it retuned rating, trust, reputation, XP and money.

Status: P0, P1 and P2 built 2026-11-01, the 360 overhaul 2026-11-02 (`src/game/career/`, `src/game/career-ui.js`, `career-hub.js`, `career-deals.js`, `career-shell.js`, `assets/career/*.json`; tests `scripts/test-career.mjs`, `scripts/test-menu.mjs`, sim `scripts/career-sim.mjs`, in-game `scripts/qa-career-season.mjs` and `scripts/qa-career-screens.mjs`). Par laps are measured (`scripts/measure-par-laps.mjs`, 2026-11-01); the human baseline is not. Not yet built: P3 and later (events, perks, press, living tiers), Mail and Contract tabs (the contract sits in Profile). Design first written 2026-10-31. It is written for the people who will build it: decisions first, the reason in a line, open questions at the end (section 12).

Every number here is a starting value for a data file (section 10.5), not a promise. Numbers marked **(assumed)** are guesses that a measurement must confirm before they are trusted; section 10.4 lists the measurements.

## 0. Decisions at a glance

1. **One championship, one grid, three classes.** All eight teams race every round (the grid is eight slots, one car per team). The eight teams are split into three tiers: **Rookies** (Hayate, Mojave, Liberty), **Maestros** (Toro, Sarab, Corvid), **Legends** (Aurum, Saetta). Each tier also keeps its own class table (the Rookie Cup, the Maestro Cup, the Legend Cup), so a player in a slow car always has a title he can win.
2. **The player is a seat, not a team.** He takes the **B seat** (the team's weaker car) at a Rookie team, earns the A seat, then moves to better teams by offer. Seat plus tier is the **Ladder** (7 rungs, section 5.3).
3. **Results are judged against the car.** Every round gets a **Round Rating** (1-10) from finish vs. expected finish, qualifying vs. expected, a teammate duel and a few clean-racing flags. Finishing P5 in the slowest car beats winning in the fastest. This single number drives reputation, team trust, offers and getting dropped.
4. **The weekend is Qualifying (Time Trial) then the Feature race**, about 11 minutes. A short Race becomes the **sponsor event** (the Sponsor Challenge, 4.2), Time Trial the **test day**, Free Drive the **practice**. Drift Attack stays in free play. No mode is rebuilt.
5. **A season is 6 rounds on today's 3 tracks** (each twice, in different conditions), **8 rounds** once the planned tracks arrive. A full climb is about 9 seasons; the first two (Rookie) are the MVP.
6. **Progression has three separate dials**: Career Level (XP, 1-25, the existing `playerLevel`, gates car access and upgrade levels), Reputation (0-1000, drives offers), Team Trust (0-100, drives job security). Upgrades are the existing engine / tyres / brakes, 0-3, capped by tier (1 / 2 / 3).
7. **Offers come at two windows** (mid-season poaching, end-of-season market), decided by thresholds plus a seeded roll. The player can negotiate three terms (salary, length, status). Overreaching gets the offer withdrawn.
8. **Randomness is a seeded event layer on the meta game only**, at most one event per round, always with visible stakes and an opt-out, never injury or death, with a bad-luck brake. The race itself is not randomised by the career.
9. **Manager mode is a later layer, not a second game**: a Driver-Principal role (budget, teammate hire, sponsors, board) unlocked at the top. Build it last and small.
10. **The MVP is one Rookie season** (create driver, three offers, 6 rounds, standings, one upgrade level per category, an end-of-season verdict and an offer: the A seat, or a Maestro seat after a standout year). Section 10.4 lists the phases.

## 1. Ground truth: what the game already does

Read from the code on 2026-10-31. File references are to `track-viewer/` unless noted.

### 1.1 Hooks the career can reuse

| Piece | What exists | Where |
|---|---|---|
| Roster | 8 teams x 2 cars = 16 cars; `ROSTER` lists the keys; `carName(key)` is the display name | `src/game/carinfo.js`, `../assets/teams/teams.json` |
| Drivers | 16 named drivers with nation, age, role, bio, personality, `rivals` (driver codes), race numbers | `teams.json` `cars[].driver`, `../assets/teams/TEAMS.md` |
| Modes | `race`, `trial` (Time Trial), `drift` (Drift Attack, 90 s), `free` (Free Drive) | `src/game/session.js` `MODES` |
| Session events for the hero | `lap`, `finalLap`, `position`, `invalid`, `offTrack`, `crash`, `spin`, `finish`, `driftBank`, `driftFail` | `session.js update()`, `game.js onEvent()` |
| Results rows | position, driver, team, best lap, total time, finished flag per car | `session.js results()` |
| Upgrades | engine / tyres / brakes, levels 0-3 per car: power x1.05 / 1.10 / 1.16, grip x1.03 / 1.06 / 1.09 (+2/4/6 points wet grip kept), brake torque x1.05 / 1.10 / 1.16 | `../assets/cars/specs.json` `upgrades`, `src/physics/handling.js setUpgrades()` |
| Upgrade prices | 700 / 1,700 / 3,600 U for levels 1 / 2 / 3, times a class multiplier (Tourer under 500 hp x0.8, Sports x1, Super 800-1,100 hp x1.35, Hyper x1.8) | `src/game/economy.js` |
| Setting AI upgrades | `applyUpgrades(levelsOf, onlyKey)` already sets any car's levels; the race start passes `onlyKey`, so AI cars run stock today. Passing no `onlyKey` and a different `levelsOf` upgrades the AI | `src/game/carinfo.js`, `game.js startSession()` |
| Coins | `store.data.coins`, start 1,500; race pay by place `[1800,1300,950,700,500,350,200]` x sqrt(laps/3) + 95 per lap + 300 fastest lap + 150 PB | `economy.js rewardFor()` |
| Car ranks | each car has a rank D / C / B / A / S / S+ that unlocks at player level 1 / 5 / 10 / 15 / 20 / 25; `testingUnlockAll: true` currently bypasses it; `playerLevel` is read from `profile.playerLevel` but nothing writes it ("Player XP and level rewards are not enabled yet") | `../assets/teams/progression.json`, `src/game/progression.js` |
| Team status text | one line of status per team ("Serial winners", "Rookie team"...) | `progression.json` `teams` |
| Records | best lap and best drift keyed `track/car` | `src/game/store.js` |
| Saves | `localStorage` key `ultrack.v1`, every access guarded | `store.js` |
| Menu | the Career Mode tile exists and shows "Coming soon" with a lock | `src/game/ui.js` `MenuScreen` (lines 198, 208) |
| UI kit | tokens, Panel, Tile, Tabs, List row, Stat readout, Bar, Segmented, Select card, Slider, Toast, Modal, Prompt | `docs/ui-system.md` section 2 |
| Pure-module style | `economy.js` is "pure functions over the saved profile" so it runs without a browser; the career logic should follow it | `economy.js` header |

### 1.2 Constraints the design must respect

| # | Constraint | Consequence for the career |
|---|---|---|
| C1 | **(Career: replaced, see 4.3: all 16 qualify, the fastest 8 race, teammates included.) Free-play races stay one car per team on 8 slots.** `racersFor()` returns the hero plus each other team's `cars[0]`; `Field.grid()` puts the hero in the last slot (`cars.js` 532-545) | The teammate cannot be on track. The teammate duel is a qualifying-lap duel plus a team-trust number (section 6.3). Grid order needs one small engine change (section 10.3). A 16-car grid is a stretch goal, not a dependency |
| C2 | **Balance of performance flattens the cars.** Per-car `bop` / `bopGrip` push AI solo laps on Marina into a ~144-153 s band, 4% apart (`PHYSICS.md`). A 268 km/h Nissan Z and a 346 km/h Destrier end up close in lap time | The gap between tiers cannot come from stock cars alone. It comes from upgrade levels on the AI cars, driver ratings (AI pace) and the player's own upgrades (section 2.3) |
| C3 | **AI pace today is the grid index, not the driver**: `new AIDriver(this, c, c.hero ? 1 : 0.93 + 0.012 * k)` (`cars.js` 563), so rivals run 0.942 to 1.014 in the order of `teams.json`. | The career needs a per-entry pace override (one line) driven by driver rating |
| C4 | **AI cars are never upgraded** at race start (GAME.md; `applyUpgrades(..., store.data.car)`) | See C2: the career sets AI levels from a team-development table |
| C5 | **The AI does not defend or choose lines** (GAME.md "Not done") | Overtaking is easier than it should be; keep the AI-pace spread modest and let qualifying matter (section 4.3) |
| C6 | **Race length**: a 3-lap Marina race is about 7.5 min (lap ~150 s). Tokyo lap measured 105.6 s (`tracks/tokyo/README.md`); India lap is not documented (estimate ~90 s **(assumed)**) | Race laps per round are computed from a target duration (7.5 min), not fixed |
| C7 | **Tokyo and India have no pit, VIP, hoardings, people or team dress** (`src/tracks.js has:{}` all false) | The career hub must not depend on those venue pieces; the hub is a menu scene, not a paddock walk-around |
| C8 | **Commentary does not name the current driver** ("Event lines are about the player's car"; no line names Toro, Barreto or Ortega, `TEAMS.md`) | Career moments use text and UI first; new voice lines are a later, costed addition |
| C9 | The assist preset named **Rookie** (`store.js ASSISTS`) shares a name with the **Rookies** tier | Call the preset "Assisted" in career copy, or rename the tier class in the UI to "Rookie Class" (open question 3) |
| C10 | Pause menu has **Restart** (`ui.js` PauseScreen) | Career hides Restart in races (one try per round, section 7.5) |

## 2. Tiers: Rookies, Maestros, Legends

### 2.1 The stats used

Method (reproducible, Appendix C): for each of the 16 cars, take the numbers `handling(key)` returns in the game today (BoP, compression and the arcade grip scale applied): power-to-weight, top speed, 0-100 time, tyre grip. Turn each into a z-score across the 16 cars and average the four: the **composite z** (above 0 is faster than the field average). Second metric: the car's **progression rank** from `progression.json`, in unlock levels (D=1, C=5, B=10, A=15, S=20, S+=25). A team's score is the mean over its two cars.

| Team | Car A (higher composite z) | Car B | z of A | z of B | Team mean z | Rank levels (A, B) | Mean level | Status line (`progression.json`) |
|---|---|---|---|---|---|---|---|---|
| **Aurum** | `destrier` Bugatti Destrier (top 346 km/h, 0-100 2.38 s, 200 W/kg) | `buggati` Bugatti Divo (334 km/h, 2.45 s, 201 W/kg) | +0.69 | +0.66 | **+0.67** | S+ 25, S 20 | **22.5** | Defending champions |
| **Saetta** | `laferrari` La Furari (316, 2.60, 183) | `furari-488` Furari 488-R (310, 2.79, 182) | +0.50 | +0.24 | **+0.37** | S 20, A 15 | **17.5** | Serial winners |
| **Toro** | `av12` AV-12 (316, 2.75, 183) | `huracan` HU-10 (292, 2.90, 186) | +0.19 | +0.09 | **+0.14** | A 15, A 15 | **15.0** | Eternal challengers |
| **Sarab** | `porsche1` 918-S (313, 2.60, 183) | `mp1x` McLaren 720S (311, 2.83, 181) | +0.37 | +0.18 | **+0.27** | B 10, A 15 | **12.5** | Rising contenders |
| **Corvid** | `aston-martin-valk` Valkyrie-X (318, 2.60, 183) | `bentley-gt` Bentley Continental (307, 3.35, 170) | +0.55 | -0.95 | **-0.20** | S+ 25, C 5 | **15.0** | Former champions |
| **Hayate** | `supra` GR Supra GT (286, 2.75, 186) | `nissan-z` Nissan Z GT4 (268, 3.50, 165) | +0.42 | -1.07 | **-0.32** | S 20, C 5 | **12.5** | Precision newcomers |
| **Mojave** | `jaguarxkjss` Mercedes-AMG ONE (317, 2.83, 178) | `bmw1` Mercedes-AMG GT4 (277, 3.35, 172) | +0.22 | -0.92 | **-0.35** | S 20, D 1 | **10.5** | Fallen greats |
| **Liberty** | `blackbird` Blackbird-X (318, 2.68, 187) | `ford-gt` Ford GT Mk II (286, 2.90, 186) | +0.40 | -0.03 | **+0.19** | A 15, B 10 | **12.5** | Rookie team |

Top speed in km/h, 0-100 in seconds and power-to-weight in W/kg are the game's compressed numbers, not the real cars' (the real Destrier is 400 km/h; the game's is 346). The key names are the `teams.json` keys; always show `carName(key)` in the UI. `TEAMS.md` still describes some teams with older car names; `teams.json` is the truth the game reads.

### 2.2 The split

Rank both metrics, break ties with the lore status line, and cut the table 2 / 3 / 3:

| Order | Team | By composite z | By mean rank level | Tier |
|---|---|---|---|---|
| 1 | Aurum | 1 | 1 | **Legends** |
| 2 | Saetta | 2 | 2 | **Legends** |
| 3 | Toro | 4 | 3= | **Maestros** |
| 4 | Sarab | 3 | 5= | **Maestros** |
| 5 | Corvid | 5 | 3= | **Maestros** |
| 6 | Hayate | 6 | 5= | **Rookies** |
| 7 | Mojave | 7 | 7 | **Rookies** |
| 8 | Liberty | 8 | 8 | **Rookies** |

Mean z by tier: Legends +0.52, Maestros +0.07, Rookies -0.42. The two metrics agree on both ends and swap only inside the Maestros, where the lore breaks the tie (Toro "Eternal challengers" ahead of Sarab "Rising contenders", who are expected to climb). This order is the **opening expected finish** (`expPos` 1 to 8) that every objective is judged against; `expPos` is data and moves each season (section 6.1).

Inside a team the two cars are not equal (Liberty: Blackbird +0.40 vs. Ford GT -0.03). That is a feature: the **A seat** (higher composite z) is the senior drive, the **B seat** is the junior drive, and the jump from B to A inside one team is the biggest single car step in the game (AMG GT4 to AMG ONE, Nissan Z to Supra). Aurum's two cars are 0.03 apart, so it has no junior seat: its second seat is a full drive.

### 2.3 What a tier means

| | **Rookies** | **Maestros** | **Legends** |
|---|---|---|---|
| Teams | Hayate, Mojave, Liberty | Toro, Sarab, Corvid | Aurum, Saetta |
| Class table | Rookie Cup (3 teams) | Maestro Cup (3 teams) | Legend Cup (2 teams) |
| Opening expected finish | P6-P8 | P3-P5 | P1-P2 |
| B-seat cars | Ford GT B, AMG GT4 D, Nissan Z C | HU-10 A, 720S A, Bentley C | 488-R A, Divo S |
| A-seat cars | Blackbird A, AMG ONE S, Supra S | AV-12 A, 918-S B, Valkyrie S+ | La Furari S, Destrier S+ |
| **Upgrade cap** per category | **1** | **2** | **3** |
| AI cars' development levels, season 1 (engine / tyres / brakes) | 0 / 0 / 0 | 1 / 1 / 1 | 2 / 2 / 2 |
| AI driver ratings (invented, 2.4) | 76-83 | 82-88 | 86-94 |
| Prize multiplier (5.5) | x0.7 | x1.2 | x2.0 |
| XP multiplier | x1.0 | x1.3 | x1.6 |
| Reputation scale (positive gains) | x1.0 | x0.8 | x0.6 |
| Team's season demand (board) | Top 6 of 8 in the Teams' table; win or podium the Rookie Cup | Top 4; at least one podium | Title fight; at least 2 wins |
| Prestige off track | Local brands, small crowds | Name sponsors, press | Title sponsors, rivalries on every broadcast |
| What failure looks like | Dropped to reserve, a worse Rookie seat | Back to a Rookie offer | A Maestro drop, a public "fallen" arc |

How the tier gap becomes real on track, given C2: three layers, all data.

1. **Stock car** (BoP-flattened): small, already there.
2. **Development levels on the AI cars** (table above): the AI team's engine / tyres / brakes levels, applied through `applyUpgrades`. The level gap Legends vs. Rookies is 2-3 levels per category, worth roughly 3-4% of lap time **(assumed; measure with `physics-harness.mjs --tests lap` at levels 0 / 1 / 2 / 3)**.
3. **Driver rating to AI pace**: `pace = clamp(0.94 + (rating - 60) x 0.0021, 0.94, 1.02) x difficulty x (1 + seeded jitter)`. Rating 94 gives 1.011, 84 gives 0.990, 76 gives 0.974: about 3.5% between the best and the weakest driver. This replaces the grid-index formula (C3).

Each season every AI team gains one level in a rotating category (tyres, engine, brakes), up to its tier cap, so Rookies reach 1 / 1 / 1, Maestros 2 / 2 / 2 and Legends 3 / 3 / 3 within three seasons (E10 can skip a step).

Together a Legend entry is about 5-7% (8-10 s a lap on Marina) faster than a Rookie entry **(assumed)**. The existing spread was 0.942 to 1.014 (7%), so this stays inside what the AI was already asked to do.

### 2.4 AI driver ratings (starting values, editable)

Invented for the career, chosen to match the lore in `TEAMS.md` and to fit the tier bands. Young drivers grow, veterans fade (6.8).

| Driver | Team / car | Age | Rating | Note |
|---|---|---|---|---|
| Remy Valois | Aurum / `buggati` | 31 | 94 | reigning champion |
| Calderini | Saetta / `furari-488` | 27 | 90 | the calm one |
| Varrone | Toro / `av12` | 26 | 88 | prodigal son |
| Beaulieu | Aurum / `destrier` | 36 | 87 | gentleman racer |
| Barreto | Saetta / `laferrari` | 34 | 86 | the showman |
| Ortega | Toro / `huracan` | 32 | 86 | the matador |
| Qasimi | Sarab / `porsche1` | 25 | 85 | the overtaker (quicker than her teammate, per lore) |
| Kareem | Sarab / `mp1x` | 27 | 84 | home hero |
| Whitlow | Corvid / `bentley-gt` | 38 | 84 | the Metronome, retires soon |
| Kuroda | Hayate / `supra` | 31 | 83 | quiet ace |
| Ashcombe | Corvid / `aston-martin-valk` | 24 | 82 | third generation, grows fast |
| Lindqvist | Mojave / `jaguarxkjss` | 29 | 82 | rally convert |
| Mizuno | Hayate / `nissan-z` | 29 | 80 | drift king |
| Quintero | Mojave / `bmw1` | 20 | 79 | the rookie, grows +2 a season |
| Maddox | Liberty / `ford-gt` | 30 | 77 | the brawler |
| Hollis | Liberty / `blackbird` | 37 | 76 | the Colonel |

### 2.5 Team lore the career uses

`teams.json` already carries `rivals` for each driver (Varrone vs. Ashcombe, Calderini vs. Ortega, Mizuno vs. Lindqvist, Maddox vs. Hollis and Lindqvist, Kareem vs. Qasimi, Valois vs. Kareem / Quintero / Beaulieu). Section 6.6 turns these into rivalries. Team "wants" for offers (6.5) come from the same text: Saetta wants wins and poles, Toro wants overtakes and giant-killing, Corvid wants clean races, Hayate wants qualifying precision and drift, Mojave wants improvement, Liberty tolerates grit, Aurum wants titles, Sarab wants loyalty.

### 2.6 Living tiers (later)

Phase 3 option: at season end, rank the eight teams by Teams' points and re-cut 2 / 3 / 3, with hysteresis (a team changes tier only after two seasons outside its band). If the player's team moves up, his caps rise with it. The tier of a team is a derived field (`world.teams[id].tier`), so the rest of the design does not change.

## 3. The first job

### 3.1 How it is offered: the Open Shootout

A new career starts with **creating the driver** (name, nation, race number from the free numbers, helmet colours, age 21 fixed) and then the **Open Shootout**: the three Rookie teams hold a joint trial at the smallest circuit (India Ghat, 2.99 km), the same way Mojave found Quintero in an esports shootout (`TEAMS.md`). The shootout is a Time Trial (3 flying laps) in a neutral trial car; the best valid lap against the par lap gives a **Shootout grade**:

| Best lap vs. par | Grade | Effect |
|---|---|---|
| within 3% | Standout | all three offers pay a signing bonus; starting XP 300 |
| 3-6% | Solid | normal offers |
| over 6%, or no valid lap | Raw | offers still come, with lower salary and an objective set one place easier |

Rule: **the player is never refused**. Three offers always arrive, so onboarding cannot dead-end. Wrestling Revolution starts a new wrestler in an unpaid school; here the entry level is low-paid and never locked.

### 3.2 The three offers

Each offer is the **B seat** of one Rookie team.

| | **Hayate** | **Mojave** | **Liberty** |
|---|---|---|---|
| Seat and car | #23, `nissan-z` Nissan Z GT4 (400 hp, 268 km/h sim, C) | #9, `bmw1` AMG GT4 (503 hp, 277 km/h sim, D) | #66, `ford-gt` Ford GT Mk II (700 hp, 286 km/h sim, B; replaced the Mustang on 2026-11-01; the slowest car in the game) |
| Teammate (A seat) | Rina Kuroda, `supra` (83) | Freya Lindqvist, `jaguarxkjss` (82) | Wade Hollis, `blackbird` (76) |
| Pitch | Precision, qualifying, drift events (Sony) | The underdog garage, balanced deal | American muscle, a first-season team with no history to protect |
| Contract | 2 seasons, 300 U a round, signing bonus 600 U | 2 seasons, 300 U a round, signing bonus 900 U | 2 seasons, 250 U a round, signing bonus 1,500 U |
| Difficulty | Medium: the best of the three cars | Medium: balanced | Hard: slowest car; **Underdog bonus** (Round Rating +0.3 on a finish within expectation, XP x1.1) |
| Season demand | Top 6; beat the Rookie-Cup rivals twice | Top 6 in 4 of 6 rounds | Top 7 in 4 of 6 rounds (they are the weakest team: lowest bar) |
| Expected finish (entry) | P6 + 1 seat step = **P7** | **P8** | **P8** |
| Sponsor-event theme | Drift (Hayate loves a slide) | Time Trial test days | Drift and showmanship |

The signing bonus sums to the first upgrade level or two, the salary covers a season of running costs, the release clause is low (section 6.4) so a strong first year is not trapped.

Narrative cost of the seat: the displaced driver (Mizuno, Quintero or Maddox) becomes a **free agent** for the market (2.6). That is a lore decision for the user (open question 2).

### 3.3 Contract anatomy

Same record for every contract in the game (the save schema holds it, 10.2):

| Field | Meaning | Rookie default |
|---|---|---|
| `team`, `seat` | the team and the car key | B seat |
| `status` | `junior` (B car), `second` (B car, equal rights), `lead` (A car), `number1` (A car + development priority) | `junior` |
| `seasons` | length, 1-3 | 2 |
| `salary` | U per round | 250-300 |
| `signing` | one-off U on signing | 600-1,500 |
| `bonus` | U for a podium, a win, a Cup title | 100 / 250 / 800 |
| `objectives` | season demands (6.4) | top-6 style, see above |
| `release` | amount another team pays your team to sign you mid-contract; you get 20% | 8 x salary x seasons left |
| `exit` | what you pay to leave unilaterally | 6 x salary x seasons left |
| `livery` | whether you may use your own paint (the garage has a paint tuner); the idea comes from the "creative control" clause that Wrestling Revolution players call crucial | off at Rookie, negotiable from Maestro |

### 3.4 What the rookie expects and gets

- The car is the team's B-seat car at **stock**, upgradable to cap 1 in each category (section 5.4). All three Rookie B cars are in the `tourer` / `sports` price classes (Nissan Z x0.8, AMG GT4 and Ford GT x1).
- Opening wallet: 1,000 U plus the signing bonus. Upgrades unlock at Career Level 2 (90 XP), which the Shootout alone reaches.
- Probation: the player cannot be dropped before round 4 of season 1.

## 4. Seasons and race weekends

### 4.1 The calendar

A season is a list of **rounds**. Each round is a track, a time of day (`day`, `dusk`, `bluehour`, `night`; the game's `store.settings.look`) and a weather (`dry`, `damp`, `rain`; `store.settings.weather`), so three tracks make a varied year. Rules:

- Rounds per season = `min(8, 2 x tracks available)`: **6 now, 8 once there are 4 or more tracks**.
- A track appears once per season (it only comes back if the game has too few tracks for the rounds), never in back-to-back rounds. Rounds run sprints, then grands prix, then showpieces (`event` in `calendar.json`).
- The finale is drawn each season from the world's showpieces at a fixed look, worth x1.5 points.
- Conditions are seeded per season (`seed`, stream `cal`) with an even chance of each look the track offers in the circuit menu (`times` in tracks.js, all four without it); a world's finale keeps its set hour. Rain appears in at most one in three rounds and never in round 1.
- Race laps = `round(featureMinutes x 60 / parLap)`, clamped to 3-12, with `featureMinutes = 7.5` (**assumed**; the existing 3-lap Marina race is 7.5 min). Today: Marina 3 laps, Tokyo 4, India 5 **(assumed)**.

Season 1 (three tracks, the MVP):

| Round | Track | Look / weather | Laps (est.) | Name | Notes |
|---|---|---|---|---|---|
| 1 | Corniche Marina (5.47 km, 16 corners) | dusk / dry | 3 | Corniche Opener | long, technical; the player learns qualifying |
| 2 | India Ghat (2.99 km, 12 corners) | day / dry | 5 | Ghat Climb | tight, grip and brakes matter |
| 3 | Tokyo Hiragana (5.18 km, 8 fast corners) | night / dry | 4 | Neon Street | power and top speed matter; mid-season window opens |
| 4 | India Ghat | bluehour / damp | 5 | Ghat Evening | first damp round |
| 5 | Corniche Marina | night / dry | 3 | Marina Lights | |
| 6 | Tokyo Hiragana | dusk / dry | 4 | Season Finale | points x1.5 |

Names are placeholders; they use the tracks' own names, not real places' details.

### 4.2 The weekend

```
Paddock -> Briefing -> Qualifying (Time Trial) -> Race (Feature) -> Round report -> [event?] -> Paddock
                (optional, between rounds: Practice, Test day, Sponsor day)
```

| Session | Existing mode | Career rules | Length |
|---|---|---|---|
| Practice (optional) | Free Drive | The round's exact track, look and weather. No pay, no XP; it is there to learn the rain | any |
| **Qualifying** | Time Trial | Ends after **3 valid laps** or when the player ends it; best valid lap counts; an invalid lap (4 wheels off for 1 s) does not. AI laps are computed (4.3). Sets the grid | ~4 min |
| **Race** | Race | Laps from 4.1; grid from qualifying; AI pace from ratings; AI upgrade levels from team development; no Restart (7.5); results feed the Round Rating | ~7.5 min |
| Test day (between rounds, optional) | Time Trial | Target lap = par x 1.015 / 1.005; hitting it pays the E09 reward, an early free upgrade level (7.4) | ~3 min |
| **Sponsor day** (between rounds, optional) | Race | The **Sponsor Challenge**: 2 laps, dry, at the next round's circuit, from P6 of a 6-car field (below) | ~3 min |

Total: a full weekend is about 11 minutes; with both optional events about 15. A callout the player accepted in the week before (6.9) makes the race a second contest with one driver.

**The Sponsor Challenge** (`career.sideSpec`, `challengeSetup`, `rules.challengeMet`; numbers in `tuning.json` `side.challenge`). Each sponsor day serves one signed deal: the deals take turns, by how many sponsor days came before it in the season. It is named after the deal and its target kind, for example "Shell Overtake Challenge"; with no deal it is the "Team Overtake Challenge". The field is the teammate and the seated cars expected closest to the player, five in all, at their race pace x 0.97, with the rival profiles of a career race (6.6) and no team orders. The grid is the four others by expected place, then the teammate, and the player last. Three objectives come from the target kind, all relative to the field, the player's par or the teammate, so they are fair at every circuit, car and tier:

| Kind | Name | Objectives |
|---|---|---|
| top | Overtake | gain 2 places; top 3; win |
| podium | Podium | top 4; top 3; a podium with no contact |
| win | Victory | top 3; win; win by 1.5 s |
| clean | Clean Air | no contact; never off the track; top 3 with neither |
| quali | Hot Lap | a lap within 2 % of par; the fastest lap of the race; a lap within 0.5 % of par |
| duel | Duel | finish ahead of the teammate; a faster best lap than the teammate; finish 2 s ahead of the teammate |

Bronze is one objective met, silver two, gold three. A retirement (Retire in the pause menu) meets none. The result keeps the name and the objectives the day ran under, each met or not (`event.result.name`, `objectives`, `met`): the race HUD lists the three under the standings for the whole race, the hub and the week's calendar entry tick them afterwards, and a deal signed or ended later never renames a past day. Pay and XP by medal are as before (`side.pay`, `side.xp`); repairs are not billed. The deal served takes its goodwill from the result: gold +1, silver and bronze nothing, no medal -1, kept within 1 and startMood + 3 = 5 (goodwill 0 ends a deal, so a bad result never does; a skipped day still costs every deal 1). The first gold of the season is also a step toward that deal's season target, the same counter a race that meets it moves, and pays the bonus on the last step. Measured with `scripts/career-metrics.mjs 100 6` (the stub result in `career-sim.mjs` is a model, not a race): at skill 0.995, 93 % bronze or better, 60 % silver or better, 30 % gold; at 0.975, 33 % silver or better.

### 4.3 Qualifying and the grid

- Player lap: real. AI lap: `parLap(track, car) / pace(rating) x (1 + N(0, 0.012))`, seeded per (season, round, entry). The teammate (who does not race) is on track with the player, starting 20 m ahead on the same run-up at his race pace: his real lap is the **teammate duel** (6.3). If the player finishes first, his pace so far is carried to the line; a computed lap stands in only when he got less than halfway.
- **All 16 drivers qualify and the fastest 8 race**, two cars of one team if both are quick enough; the other 14 laps are computed. Whoever misses the cut classifies by qualifying place, 9th down, with no points. Each round the player gets one qualifying run and one retry (the better lap counts). A podium skips the next round's qualifying, unless the teammate finished ahead: the player starts from the place he finished, with no duel, no pole and no qualifying credit that round (`qualiExemption` in rules.js holds these rules). A player who misses the cut can use his retry or sit the round out (no race, no place money, a rating of the qualifying place with a -1.0 penalty). Expected places are of the 16: the teams in order, A seat then B, and two places in the rating weigh what one did on the old table of 8. A driver expected outside the eight gets a qualifying target as his round objective.
- Grid order = qualifying order. Before this format, `Field.grid()` always puts the hero last; the career needs an ordered grid (section 10.3). Without this change the player starts last every round, which makes a slow car miserable; with it, qualifying is worth playing.
- `parLap(track, car)` is stored per track and car (the AI solo lap from `testdrive.js balance()` / `npm run laps`). Until measured, it is `lapLength / avgSpeed(track)` with the Marina / Tokyo / India numbers above.

### 4.4 Points and standings

Three tables, all from the eight race entries:

| Table | Who scores | Rule |
|---|---|---|
| **Drivers'** | the driver who raced the entry | Feature points 25 / 18 / 15 / 12 / 10 / 8 / 6 / 4; pole +2, fastest lap +1 |
| **Teams'** | the team | same points, per entry |
| **Cups** (one per tier) | the team, among its tier | the tier's Teams' points; the Rookie Cup is a 3-team table |

Entries: the player's team enters the player every round. Each AI team nominates one of its two drivers per round with a seeded weighted pick: A seat 70% / B seat 30% for Rookies and Maestros, 80 / 20 for Legends (so all 16 drivers appear on the grid sometimes). Points go to whoever raced, so the Drivers' table is honest but shows partial seasons for the rotating drivers. The player's teammate scores no points; he exists in the duel, the Contract tab of the hub and the story (6.3).

### 4.5 Tracks the career wants next

The user is adding 2-3 smaller tracks. The three existing ones are long (5.47, 5.18, 2.99 km); a Feature race there takes 7.5 min and a season of 6 rounds takes 70 min of racing. What would serve the career, described by archetype and not by real place:

| Slot | Character | Length / lap | Why the career needs it |
|---|---|---|---|
| **Short technical** | tight, 10-14 corners, one long-ish straight, a hairpin, kerbs | 1.3-1.8 km, ~45-60 s | Rookie-tier home. Races of 7-10 laps with many overtaking chances (helpful because the AI does not defend, C5). Cheap qualifying |
| **Fast flowing** | 4-7 fast corners, long straights, a big braking zone | 2.0-2.6 km, ~55-70 s | Rewards the engine and the brakes upgrade, makes tier gaps visible; a showcase for Legends |
| **Slide track** | hairpins, elevation, a mountain or industrial setting, low-grip sections | 1.6-2.2 km, ~60-75 s | Rewards tyres and drift; natural host for Drift Attack in free play and Hayate's story |

Each new track must supply what `track.json` already has (centreline, `lapLength`, `corners`, 8 `gridSlots`, `sectors`, `weather.looks`) plus a `TRACKS` entry in `src/tracks.js`. The career adds one data row per track in `assets/career/calendar.json` (10.5): `parLap`, `character` tags, `lookWeights`, `featureMinutes` (optional override), and `bias` (`power`, `grip`, `brake`, each -1 to +1) which shifts the AI's expected result slightly (a power-biased track favours engine-heavy teams) and gives the briefing screen a sentence to show. Two to three new short tracks bring the season to 8 rounds (about 90 minutes of play), with Feature races of 7-10 laps on the short ones.

## 5. The player: progression, cars and money

### 5.1 No stat sheet for the driver

The player's speed is his hands. The career therefore does **not** give him a fake "pace" stat. What it tracks about him is *what he did*:

- **Career Level (CL)**, 1-25, from XP. It is the existing `playerLevel` and it gates things.
- **Round Rating (RR)**, 1-10 per round, and its rolling average (the *form rating*). It is a number about results versus the car. A win adds +0.5, and a qualifying skip earned by a podium scores its grid slot and a teammate-duel win's +0.4 instead of nothing (changed 2026-11-04 at the user's call).
- **Driving style**, derived from play (6 and 7): aggressor, technician or showman.
- Optional **perks** (Phase 3): small, bounded bonuses that touch levers the physics already has.

### 5.2 XP and levels

Cumulative XP to reach level L: `xp(L) = round(90 x (L - 1)^1.7)`.

| Level | 2 | 3 | 4 | 5 | 6 | 8 | 10 | 12 | 15 | 18 | 20 | 22 | 25 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Total XP | 90 | 292 | 583 | 950 | 1,388 | 2,460 | 3,771 | 5,304 | 7,992 | 11,117 | 13,431 | 15,923 | 19,980 |

XP per round, before the tier multiplier (x1.0 / 1.3 / 1.6):

| Source | XP |
|---|---|
| Finish place P1 to P8 | 145 / 120 / 100 / 85 / 70 / 60 / 50 / 45 |
| Each place above the expected finish | +25 (max +100) |
| Pole | +30 |
| Qualifying ahead of the expected grid slot | +10 per place |
| Teammate duel won | +25 |
| Fastest lap | +20 |
| Clean race | +20 |
| Mandatory objective | +60 |
| Optional objective | +40 each |
| Test day / sponsor day gold / silver / bronze | 120 / 80 / 40 |
| Assist set to **Pro** (the stricter preset) | x1.15 on the round |

Typical Rookie round: P5 against an expected P7, clean, mandatory met: 45 + 50 + 20 + 60 = about 175-220 XP. A Rookie season is ~1,300-1,700 XP, so CL 8 (2,460) lands after about two Rookie seasons, CL 15 near the end of a Maestro tenure, CL 25 near the end of a Legend tenure. **Career Level also unlocks cars in free play** (the existing rank thresholds 1 / 5 / 10 / 15 / 20 / 25): turn `testingUnlockAll` off at release and let the career be the way to earn the supercars for Race, Time Trial and Drift. Free-play sessions give 25% XP with a per-session cap, so unlocks are not grindable.

### 5.3 The Ladder

The "level by level" climb is seven rungs. A rung is a tier plus a seat; moving up a rung is the event the player works for.

| Rung | Tier / seat | Cars (examples) | Typical CL | Upgrade cap | Gate to the next rung |
|---|---|---|---|---|---|
| 1 | Rookie, B seat | Ford GT, AMG GT4, Nissan Z | 1-4 | 1 | Season duel won (6.3), trust >= 60: **promotion to the A seat** in the same team (or a Rookie offer) |
| 2 | Rookie, A seat | Blackbird, AMG ONE, Supra | 4-8 | 1 (+1 team package) | REP >= 200, form rating >= 6.5, CL >= 6: **Maestro offers** |
| 3 | Maestro, B seat | HU-10, 720S | 6-11 | 2 | Promotion to A seat |
| 4 | Maestro, A seat | AV-12, 918-S, Valkyrie | 10-15 | 2 | REP >= 600, form rating >= 7.3, CL >= 14: **Legend offers** |
| 5 | Legend, B seat | 488-R, Divo | 14-19 | 3 | Promotion to A seat |
| 6 | Legend, A seat | La Furari, Destrier | 18-23 | 3 | Titles and trust: **Number One** |
| 7 | Legend, Number One | same cars | 22-25 | 3 (+1 team package) | Legacy 1,000: Hall of Fame; Owner option (8) |

Rule so that a promotion never feels like a downgrade: an offer is not shown if its seat car is worse than the current car by more than **0.3 z** (the composite in 2.1) unless the player asks to see "all offers" (the warning "Bigger team, slower car" is shown on the card). That hides, for example, the Corvid Bentley seat from a player in the Mojave AMG ONE.

### 5.4 Upgrades

Same three categories and 0-3 levels as the garage today, with the same prices (`costOf(hp, level)`). Three career rules on top:

1. **Cap by tier**: 1 / 2 / 3 per category (table 2.3).
2. **CL gate**: level 1 needs CL 2, level 2 needs CL 8, level 3 needs CL 15. (The caps and the gates meet at the same moments, 5.3.)
3. **Team package**: at the start of each season, if Team Trust >= 50, the team gives one free level in a category the player picks (within the cap); two for a Number One.

Where the levels live: the save keeps `garage.upgrades[carKey]` (same shape as `store.data.upgrades`). When the player leaves a team, the car's levels are **sold back at 60% of what was paid**, shown on the contract screen ("Parts buy-back +1,260 U"); the new car starts at its team's baseline. Nothing is lost to a good move.

What a maxed car costs, from `economy.js` (3 categories x 3 levels):

| Class (hp) | Level 1 / 2 / 3 per category | All three categories at 1 | at 2 | at 3 | Max out |
|---|---|---|---|---|---|
| Tourer, under 500 hp (Nissan Z) | 550 / 1,350 / 2,900 | 1,650 | 4,050 | 8,700 | 14,400 |
| Sports, 500-800 hp (AMG GT4, HU-10, 720S, 488-R, AV-12, Supra) | 700 / 1,700 / 3,600 | 2,100 | 5,100 | 10,800 | 18,000 |
| Super, 800-1,100 hp (Blackbird, 918-S, La Furari, AMG ONE) | 950 / 2,300 / 4,850 | 2,850 | 6,900 | 14,550 | 24,300 |
| Hyper, 1,100 hp and up (Valkyrie, Divo, Destrier) | 1,250 / 3,050 / 6,500 | 3,750 | 9,150 | 19,500 | 32,400 |

The effect of all three at level 3 is measured in `PHYSICS.md`: 0-100 of the AV-12 2.86 to 2.62 s, 100-0 36.0 to 31.1 m; the lap-time effect is not measured (**assumed 3-4%**).

### 5.5 Money

One **career wallet** (`save.wallet.coins`), separate from the free-play `store.data.coins`, so a player cannot buy career upgrades with Time Trial grinding and the career cannot be broken by free play. (Open question 4: the alternative is one shared purse.)

Income per round:

| Line | Rookie | Maestro | Legend |
|---|---|---|---|
| Salary per round, B / A / Number One | 250-300 / 350-450 / n.a. | 600 / 900 / 1,200 | 1,200 / 1,800 / 2,600 |
| Race prize: `rewardFor()` place pay x prize multiplier | x0.7 | x1.2 | x2.0 |
| Per-lap pay, fastest lap, PB: same lines | x0.7 | x1.2 | x2.0 |
| Objective bonus (mandatory / optional) | 100 / 50 | 200 / 100 | 400 / 200 |
| Contract bonuses | podium 100, win 250, Cup 800 | x2 | x4 |
| Sponsor events | 150-400 | 300-900 | 600-1,800 |

Season income estimate with a 6-round season **(assumed)**: Rookie ~7,000 U, Maestro ~17,000 U, Legend ~32,000 U. A Rookie season buys the three level-1 upgrades (1,650-2,100 U) and leaves ~5,000 U for a release fee, a rainy day or negotiation; a Legend season buys a Hyper car's last level.

Sinks, and why: upgrades (the point), exit fees, optional "development fund" gifts to the team (a story event with a visible effect, 7.4), and the Owner buy-in (8; 120,000 U). If the wallet piles up, lower the prize multipliers: that is the dial, not a new sink.

## 6. Reputation, form, offers and getting dropped

### 6.1 The Round Rating

Every round ends with a **Round Rating (RR)**, 2.0 to 10.0, in the spirit of a match rating: it measures the result against the car, not against the podium.

- `expPos` of the player's entry = the team's `expPos` (2.2) + seat step (B seat +1, A seat 0), clamped 1 to 8.
- `posDelta` = `expPos` - finishing place, clamped to +/-5. `qualiDelta` = `expPos` - grid place, clamped to +/-4.

```
RR = 6.0 + 0.70 x posDelta + 0.30 x qualiDelta
         + 0.4 fastest lap of the field      + 0.3 clean race (0 spins, at most 1 crash event)
         + 0.4 teammate duel won (-0.4 lost; +/-0.6 if the margin is over 0.3%)
         + 0.3 per rival beaten (heat >= 40) + 0.3 Underdog seat (Liberty #66) when posDelta >= 0
         - 1.5 DNF or quit
```

| RR | Label |
|---|---|
| 9.0-10 | Masterclass |
| 8.0-8.9 | Outstanding |
| 7.0-7.9 | Strong |
| 6.0-6.9 | Solid |
| 5.0-5.9 | Poor |
| under 5.0 | Bad |

Worked example: the Mojave B seat, expected P8. Qualifies P7 (+1 x 0.3), finishes P6 (+2 x 0.7), clean, wins the duel: 6.0 + 1.4 + 0.3 + 0.3 + 0.4 = **8.4, Outstanding**, for sixth place. The same finish in the Aurum Destrier (expected P1) would be 6.0 - 3.5 = Poor.

`expPos` moves once a season: `expPos' = round(0.5 x expPos + 0.5 x final Teams' position)`, ties by tier and then by last season. Sarab, "rising", is expected to drift up if it keeps finishing ahead of Toro.

The inputs are all things `Session` already knows: finishing place and `results()` rows, best laps (fastest lap), the `crash` / `spin` / `offTrack` events, and the qualifying lap list.

### 6.2 Reputation, form and team trust

Three meters, deliberately separate so each answers one question.

| Meter | Range | Answers | Changes by |
|---|---|---|---|
| **Reputation (REP)** | 0-1000, never decays | "Who wants me?" (offers, Hall of Fame) | per round `(RR - 6.0) x 14` (positive part x tier scale 1.0 / 0.8 / 0.6) + bonuses |
| **Form** | -3 to +3 | "How hot am I?" (sponsor pay, offer interest, event weights, tone of the copy). **No effect on the car or the AI**, so skill stays honest | average RR of the last 3 rounds |
| **Team trust** | 0-100 per contract | "Will I keep the seat?" (promotion, packages, getting dropped) | per round `(RR - 6.0) x 4` + objectives + duel |

REP bonuses: win +12, podium +6, pole +3, fastest lap +2, **giant-kill** (finishing ahead of an entry from a higher tier that was expected ahead of you) +4 each up to +8 a round, a rival beaten +4 (x1.5 if his tier is higher), Cup title +40, Teams' title +80, Drivers' title +150. Losses: DNF -6, dropped -40, a leaked meeting -10, an offer withdrawn after haggling -5.

Form from the last-3 average RR: 8.5+ gives +3, 8.0+ gives +2, 7.2+ gives +1, 5.8-7.2 gives 0, up to 5.8 gives -1, up to 5.0 gives -2, up to 4.2 gives -3. Form changes sponsor pay by 5% a step.

Team trust starts at 55 (65 for a Number One). Per round `(RR - 6.0) x 4`, plus +8 for the mandatory objective met or -8 if missed, +3 per optional objective, +3 / -3 for the duel. Thresholds: **50** earns the season's free upgrade package, **60** makes the A seat promotion possible, **below 35** is a warning, **below 25** is a drop (6.7).

Rookie pace, six rounds: a stellar season (average RR 8.5, wins, the Cup) is 6 x 35 + ~30 in bonuses + 40 for the Cup = ~280; a strong one (RR 7.5, two podiums, the Cup) is 6 x 21 + 30 + 40 = ~200; a normal one (RR 6.8) is about 100. The Maestro gate is 200, so **a stellar Rookie year gets a Maestro offer at once, a strong one just clears it, a normal one gets it after year 2**. That is the intended pace.

### 6.3 The teammate duel

The teammate cannot be on the grid (C1), so the duel is run on the clock.

- Each round the player's best valid qualifying lap is compared with the lap the teammate sets on track beside him (4.3, his rating sets his pace, in his own car).
- Margin over 0.15%: won / lost; within 0.15%: level. The Contract tab shows the season score ("4-2") and the margin per round in thousandths.
- The result adds to RR (+/-0.4, +/-0.6 beyond a 0.3% margin), to trust (+/-3), and decides promotion to the A seat: win the season duel (4 of 6), trust 60 or more, then the A seat is offered and the old A driver swaps down to the B car. Rating of the teammate is visible and moves with age and form.
- Qualifying is therefore the one place the teammate is real. That is why the Time Trial becomes qualifying and not an extra.

### 6.4 Contracts and objectives

The contract record is in 3.3. Objectives, generated at the briefing from the player's `expPos`:

| Kind | Examples | Reward |
|---|---|---|
| **Mandatory** (one per round) | Finish at or above `expPos` (hard: one place above) | XP +60, trust +8 met / -8 missed |
| **Optional** (up to two from a pool) | Qualify ahead of the teammate's lap; fastest lap; gain 2 places from grid to flag; clean race; beat a named rival; podium (only if `expPos` is 4 or better) | XP +40, trust +3, U-coin bonus |
| **Season** (set by the contract) | Teams' table position, win the tier Cup, N podiums, win the duel | trust, REP, bonus U at the season review |

Renewal: in the last contract season, from round 4, a team with trust >= 50 offers a renewal. Release clause: another team can sign the player mid-contract by paying `release`; the player gets 20% as a transfer cut, his old team keeps the rest. Exit fee: a player who wants out against the team's wishes pays `exit` and takes -30 trust history with that team (a rivalry with the principal).

### 6.5 Offers

**When.** Two windows. **W1** after the middle round: poaching only, at most one offer, only if REP >= the team's gate + 50, the offering team pays the release clause, and the roll is halved. W2 after the finale: the market, up to four offers. Season 1 has no W1 (probation).

**Who.** A team makes an offer if all of these hold:

| Team | Tier | REP gate | Form rating gate (avg RR, last 6) | CL gate | Wants (`want`: the stat, and its norm) |
|---|---|---|---|---|---|
| Hayate | Rookie | 0 | 0 | 1 | qualifying precision (`duel`: duels won this season, 5) |
| Mojave | Rookie | 0 | 0 | 1 | improvement (`rrTrend`: the last 3 round ratings over the 3 before, 1.5) |
| Liberty | Rookie | 0 | 0 | 1 | grit (`fromBehind`: races finished 3+ places above the grid slot, 3) |
| Corvid | Maestro | 200 | 6.5 | 6 | clean races (`clean`: clean races this season, 6) |
| Sarab | Maestro | 200 | 6.5 | 6 | loyalty (`seasonsHere`: seasons with the current team, 3) |
| Toro | Maestro | 230 | 6.6 | 7 | overtakes and giant-kills (`gained`: places gained from the grid this season, 20) |
| Saetta | Legend | 600 | 7.3 | 14 | wins and poles (`poles`: poles this season, 3) |
| Aurum | Legend | 650 | 7.5 | 15 | titles (`cups`: cups and titles in the career, 2) |

plus: the seat is open to the player (`seatFor`, offers.js), and the seat's car is not more than 0.3 z worse than the current one (5.3).

**Seats.** A team offers a seat only when its driver is gone, their contract ends this season (1 season left), the player outrates them, or the team is keen enough to buy them out (interest 0.85+). A driver rated 90+ (`offers.star`) with more than one season left is never dropped for the player, whatever the player's rating. The seat follows interest (A at 0.6+); if that seat is not open, the other one is tried, under the same 0.3 z car rule. With both seats signed, the Deals tab tags the team "Both seats signed" and names who holds them, "Beaulieu to S3, Valois to S4" (the last season of each contract); an approach hears "Both seats are signed: Beaulieu to S3, Valois to S4".

**Market rating.** The player's rating on the AI drivers' scale, shown on every outside offer: for each qualifying duel this season, the teammate's rating plus the gap between them at `paceOf`'s 0.21 % of pace a point, averaged; with no duel yet, the teammate's rating; 60-99 (`playerRating`, rules.js). It is what "the player outrates him" compares against.

**Interest and the roll.**

```
interest = clamp( rep + rating + form + want - cool, 0, 1 )
  rep    = 0.5 x (REP - gate) / max(gate, 100)
  rating = 0.15 x (avgRR - rrGate)
  form   = 0.05 x form
  want   = 0.15 x clamp(stat / norm, 0, 1)                    the team's want, from this season's results (table above)
  cool   = min(0.3, 0.1 x what it remembers of a refusal)     ledger.js: a refusal weighs 2 and fades by 1 a season
offer made if  rng('offer', season, window, team) < 0.30 + 0.55 x interest
```

The roll is seeded, so reloading a save gives the same offers; an excellent year makes an offer likely, not certain, and a good-not-great year can still surprise. Terms scale with interest: salary = tier salary x (0.9 + 0.3 x interest); length 1-3 seasons, longer when interest is high; signing = 2-4 x salary; objectives from 6.4.

**Why.** Each outside offer says why in the team's words, from the two largest of rep, rating, form and want (`media.json` reasons, a seeded pick of three wordings each), for example "Toro want overtakes and giant-killing: you gained 31 places this season." A team that remembers a refusal adds a line of its own that names the season ("Corvid have not forgotten you walked out of talks in Season 2", `media.json` `callbacks.offer.spurned`). An offer also quotes the player's newest choice from this season or the last, from the ledger: a callout won, a bold press conference, a team order obeyed or ignored ("They saw you answer Okafor's callout in Season 3", 6.9). A rumour the player stoked raises that team's interest by 0.1 for the rest of the season (`lean`, 6.9).

**Refusals.** Only a real refusal is remembered: walking away from an offer, and pushing a haggle until the team walks away. An offer left to lapse, the other offers when the player signs elsewhere, and the other mid-season offers when one is signed count for nothing. The old rule (three declines, -0.2 interest for good) is gone; `teams[].declined` stays in old saves, unused.

**Two bids.** With two or more outside offers at the season end, the least of them (lowest tier, then lowest interest) answers the best one: +10 % salary, never above the best one's. When that reaches the best one's salary the line is "Sarab have matched Toro"; otherwise "Sarab have raised their offer 10 % to answer Toro". The cap keeps a match from outbidding the offer it matches; uncapped, the sim's pick by salary moved Legend offers at average skill from 19 % to 47 %.

**Counter-offer from the current team.** With at least one outside offer in hand and trust >= 50, the current team counters 60% of the time: +15% salary and a promised A seat. The choice is loyalty versus tier.

**Negotiation.** Three levers: salary (-10% to +30%), length (1-3), status (junior, second, lead, Number One). Plus a clause: livery freedom.

| Move | Demand points |
|---|---|
| Salary +10% | 1 |
| Status up one step | 2 |
| Livery clause | 1 |
| Length shorter than offered | 0.5 per season cut |

The team accepts if total demand <= leverage `L = 1 + 4 x interest + 1 x (other offers in hand)`, plus what this offer's tactics won or gave away (6.10). The lever the principal gives most on (their style's prize) counts at half: salary for a bidder, length for a warm principal, the signing bonus and status for a frugal one, nothing for hardball. Patience follows the style too: hardball 2 refusals, warm 4, the others 3. Otherwise it returns the nearest acceptable terms. Refuse twice and the offer is withdrawn with REP -5 ("unrealistic demands"); the haggle-and-leak risk is taken from the F1 career design (Appendix A). Declining outright is free, but the team remembers it for a while (Refusals, above).

**Unsigned.** If no offer is accepted before the season starts, the player is a free agent and takes a Rookie-team reserve seat at 60% salary (6.7).

### 6.6 Rivalries

Rivalries are earned on track, from the cars the player actually raced (`world.js` `heatAfter`, `tuning.json` `rivals`):

- **Rival heat** (0-100) per driver, per race the player is in: +6 for finishing next to a driver, +3 more for beating them; +8 for each contact (+14 over 30 km/h, from the session's `contact` event: a hard hit with a car within 6 m); +3 for each pass between the two (two at most a race, from the `position` event's `by`); +8 to the teammate for each qualifying duel in a round the player raced (none when they missed the cut or the duel was skipped), but the duel alone never lifts them past 35 (`duelMax`), short of a rival: a teammate becomes a rival only by also racing the player close, touching or passing them. Everyone cools by 4 a round (`decay`; by 1 in a round the player sat out: they never met), unless they finished next to the player or the duel added heat; contact and pass heat is added on top of the cooling, so a driver touched once far down the order nets +4. -10 to everyone when the player changes team. At 0 the rivalry is gone.
- **Tuning as measured** (`career-metrics.mjs 100 6`). The duel used to heat the teammate in every round, missed cuts included, up to 60, and to stop their cooling; with that the teammate was the nemesis in 62 % of the raced rounds with one at average skill. A driver touched or passed did not cool either, and at a realistic pass rate (a pass with every car within two places each race) that left 3.5-4.4 rivals at the end of a career. Now the duel counts only in raced rounds and stops at 35, contacts and passes cool like everything else, and the decay goes 5 -> 4 so a nemesis still appears: at average skill the teammate is the nemesis in 24 % of those rounds, a nemesis is on the grid in 25 % of raced rounds, and there are 1.85 rivals at the end (2.76 at the realistic pass rate; strong 2.44 and 2.79).
- **Causes and the record.** `save.career.rivalry[code] = { cause, since: [season, round], w, l }`. The first contact or pass starts it (cause `contact` or `pass`), and so do a duel (`teammate`) and a signing: the new teammate starts at heat 20 (`teammate`), the driver the player displaced at 30 (`displaced`). Heat that reaches 40 from racing close alone is `grid`, as are rivalries migrated from schema 7. `w`/`l` count the races both finished. The Driver tab's Rivals block shows the cause and the record ("Contact on track · 4-2 to you").
- **40 or more** is a rival: beating one pays REP +4 (x1.5 from a higher tier).
- **The nemesis** (`nemesisOf`): each weekend, the hottest driver on the grid at 70 or more (a seeded pick between equals), at most one. Everyone else is held at 79, so a *feud* (80+) is only ever the nemesis. Beating the nemesis pays REP x1.5 and XP +25; the race report names them and the Rivals block marks them.
- No effect on pace or on the player's car. Lore pairs from `teams.json` `rivals` feed the press, not the player's heat.
- **On track, near the player** (`driver.js` `AIDriver`, knobs in `tuning.json` `rivals.track`, each hook with its own `on`). `raceSetup` gives every AI car a profile `{ role, composure, seed, k }`: the role is the nemesis, else a rival (40+), else the teammate; composure is `0.35 + (rating - 70) x 0.02`, +0.1 past 30, within 0.2-0.95. The player's car never gets one, and a car without one drives exactly as before (`scripts/test-ai-rivalry.mjs`). Clear-air pace does not change.
  - *Defend* (the nemesis): with the player 1-15 m behind and within 3.5 m sideways on a straight (no braking zone ahead and the line bending under 3 degrees), it eases onto the player's line at 0.012 a tick, within the asphalt, once a straight; the move ends after 4 s, at the braking zone or bend, or once the player is alongside. The booth says its `defending` line, once in 30 s.
  - *Press* (a rival or the nemesis, following the player): it holds the player's speed from 1.0 m (not 1.5 m), at x0.95 inside 6 m (not x0.9), and moves out to pass at 0.03 a tick (not 0.02). The nemesis with the player 10-50 m up the road fires its stock nitro, one burst a lap, in any mode.
  - *Mistakes* (any profiled car): with the player within 0.6 s behind for more than 3 s, each corner entry rolls `0.05 x (1 - composure)` (x1.6 for a rival, x1.3 more for the nemesis), seeded by the car, the corner and the lap. A mistake is a lift (x0.95 speed for 0.5 s) or a run wide (0.8 m to the outside); the HUD names it.
  - *Team orders* (`rules.js` `ordersFor`): `toYou` when the player is in the A seat, or at trust 70+ with more duels won than lost: on the final lap the teammate, with the player within 1 s behind, lifts (x0.97 for 3 s) and steps 2 m aside, once, and the HUD says so. `toMate` when the player is in the B seat at trust under 40 and the teammate qualified ahead: if the teammate is behind the player when the final lap starts, the HUD asks the player to let them by, and that is the player's call. Finishing behind them is obeying: trust +4. Finishing ahead is ignoring: trust -6, the teammate's heat +15 (cause `orders` if new) and a story. A retirement settles nothing.
  - The race HUD's rival tile shows the nemesis, else the teammate, labelled as such, with the gap on the road; the round report says when the nemesis finished ahead (a beaten nemesis is already in the rival line) and what the team orders cost or earned; the booth says `side_by_side` after a second wheel to wheel with any car, once in 25 s.
- The REP and XP that used to come from rivals near the player in the 16-car classification (about 16 REP a race, and 400-700 XP a season from feuds for an average or strong driver) now come from the race itself: 18 REP per Round Rating point above 6.0 (was 9), a retirement costs 11 REP (was 6), and the finish places pay 25 XP more each (P1 145, was 120), so the Maestro and Legend offers, and the Number One seat, arrive when they did (`scripts/career-metrics.mjs`, `scripts/career-sim.mjs`).
- **The strong driver's Number One seat, bisected** (`career-sim.mjs 100 6` at every commit of the 10x career branch, skill 1.015). Base 987a185: Number One in 50 % of careers, 1.79 titles. 9e2ff44 (earned rivalries): 28 %, 1.45. The cause was a side effect, not the price of fairer rivals: the old heat paid feud XP from any rival near the player in the 16-car classification, about 680 XP a season for a strong driver; without it they reached the Legend level gate a season later (Legend offer in season 2: 49 % -> 5 %), so fewer had the Legend A seat, a title and trust 70 in time. 835b1cc gave it back through the race (finish places +25 XP, REP 18 per rating point): 47 %, 1.78. 05f6350 (Sponsor Challenge): 53 %, 1.82. bbebe62 (the AI market): 59 %, 2.08, and it has stayed there (60 %, 2.08 after the fixes in this section, 6.7 and 6.8). That is 10 points above the base, outside the spec's +-5 points for progression lines; the market's churn is where it comes from, and it has not been traced further.
- **Choices** (6.9) add heat too: a bold press conference +15 on the named driver (cause `bold` if new, shown as "You called them out in the press"), and an accepted callout makes the next round a second race with the nemesis. A team order obeyed or ignored goes in the ledger (`orders_obeyed`, `orders_ignored`), and the team principal quotes it in a story at the season-end market. The feud story after a race adds what started it, from the ledger ("It has been personal since the press conference in Season 2").
- `raceSetup` names the nemesis with `nemesisAmong`, which only looks: opening a session (practice, qualifying, an event) never changes anyone's heat. Only `heatAfter` holds the others at 79.

### 6.7 Getting dropped, and the way back

- **Review points**: after the mid-season round and after the finale. Trust under 35 gives a **warning** (a "seat review" event with a recovery objective: meet the mandatory objective in the next two rounds). Trust under 25 after a warning, or under 15 at any review, gives a **drop**.
- **Shield**: no drop before round 4 of the first contract.
- **Consequence**: REP -40, the seat is gone, the team keeps your upgrade levels (parts buy-back still pays 60%), and you enter the market as a free agent.
- **Never two tiers down**: a driver who loses a Legend seat (dropped, or not renewed) also gets a seat one tier down: the Maestro team keenest on them with an open seat, A first, at 90 % of its salary for one season (`offers.js` `fallbackOffer`). The Rookie reserve seat stays on the list.
- **The way back**: Rookie teams always have a reserve seat for a free agent: B seat, 60% salary, no Cup points until round 3, and an objective set one place easier. The player can climb again from rung 1. An unpaid school (Wrestling Revolution's start) would be too harsh for a racing game; a pay cut is enough.
- **Optional hard rule, off by default ("Iron Career")**: a third drop ends the career in a retirement card.

### 6.8 The AI market

Every AI driver has a contract (`world.contracts`: seasons left, this one included), 1-3 seasons at the start of a career, seeded per driver. Between seasons `marketMoves` (world.js) runs seeded phases:

1. Everyone is a year older and ratings drift by age (under 24 +2, 24-29 +1, 30-33 0, 34-37 -1, 38+ -2).
2. Drivers aged 38 or more retire with 50 % chance.
3. Contracts run down by one. A driver out of contract re-signs if rated at least the tier's average less `renewGap` and the team's roll is under `renew`; otherwise they go free.
4. A team drops a driver rated at or below the tier's average less `dropGap` whose teammate outscored them this season.
5. The open seats fill, the best team first and the A seat before the B. The shortlist is the free agents plus the drivers in their last season at a team that is expected lower; the best market score wins (rating + 2 x the season's form + a seeded +-1; form is a quarter point for each place finished above the expected, -1 to 1). A seated driver who moves opens their own seat, which joins the queue: a cascade of `maxMoves` seated moves at most. The driver the player displaced this window does not take the player's old seat while another seat is open.
6. Seats nobody takes go to the academy: the twelve named drivers in `drivers.json` first, then seeded names from `academyNames` (30 first names, 30 surnames, 12 nations), never one already in the paddock, rated 70-78, aged 19-22.

Every signing runs 2-3 seasons (`market.signing`). The press writes up each move ("Okafor moves to Toro"), each call-up and each retirement (`coverMoves`). The ratings themselves never change here beyond the age drift: no form drift, no budgets, no transfer fees.

**Rumours.** In the market week the inbox and the press name the seats at other teams whose driver has one season left (three at most, best team first), each with the top three by market score of the shortlist the season-end market will draw: the free agents and the drivers at lesser teams whose last season the market will see (two seasons left in the market week; contracts tick before phase 5). With the old list, drawn from drivers with one season left, which the market never shortlists, the seat went to a listed driver in 18-21 % of the rumoured seats that opened; now in 46-57 % (career-sim careers, 100 x 6). The player is on it when that team, in their tier or the one above, clears its bar for them. A rumoured seat opens at the season end unless its driver re-signs. A rival (heat 40+) who takes a seat the player was shortlisted for and wanted gains heat +30 (`rivals.seatLost`), and the rivalry's cause becomes `seat`. Wanted means the player approached that team or haggled over its offer, and did not walk away from it (`season.talked`); a team's offer the player let lapse or turned down does not count. The spec says "set heat to `seatLost`", which would lower a rival at 40+ to 30, so the heat is added instead. With the player on a shortlist, the press asks them about it that week (the rumour scene, 6.9).

**Tuning as measured** (`career-metrics.mjs 100 6`). The spec's first guesses were renew 0.6, renewGap 2, maxMoves 3. They move 3.1 AI drivers a season (target 1-3), and the extra churn puts the best drivers in the Legend cars (their average rating +1.25), which kept strong players under the Legend round-rating gate: Legend offers at skill 1.015 fell to 87 % (target 95 %+). Shipped: renew 0.9, renewGap 6, maxMoves 1, dropGap 6. Per season 1.2-1.4 AI-to-AI moves, the displaced driver in the player's old seat 7-19 %, 0.9-1.2 teams of 8 unchanged after six seasons, seated AI average rating 83.46.

**Legend got harder to hold, and the fix.** Before the market, a retired Legend driver's seat went to whichever free agent or academy rookie came first, so the Legend grid's average rating fell from 89.3 to 85.4 over six seasons. Now the best free agent or lesser-team driver takes it, and the Legend grid stays at 89-90. Average players (skill 0.995) who reach Legend finish lower than their team expects and lose trust; in a 400-career x 6-season probe 33 of 72 then lost the seat (22 dropped, 11 not renewed), all of them straight to the Rookie reserve seat, because nothing else is offered to a Legend driver in the A seat, against 12 of 73 before the market; the wallet at the end of Legend was 87 % of the baseline (WP3 guard 90-110 %). Two rules fix it. A Legend incumbent rated within `market.holdGap` 8 of the tier's seated average (`holdsSeat`: looser than an AI driver's `renewGap` 6, so the market moves AI drivers first) is not dropped, and at a contract's end with trust under 50 is renewed for one season at the same pay. One who still loses the seat gets a Maestro seat (6.7). Now 14 of 72 fall out of Legend in that probe, all to Maestro; the ones who fall are rated below every Legend AI driver. `career-metrics.mjs 100 6`: wallet at the end of Legend 96 %; career-sim 100 x 6 at average skill: final tiers 27 / 57 / 16 % (was 31 / 57 / 12).

**Loyalty, hidden** (`world.loyalty[code]`, 0-100, AI drivers only; never shown, never a number in a story, never in the UI). Seeded at 40-80 (`market.loyalty`); +8 for each season at the same team (`loyaltyGrow`), -15 when the team finished 2+ places under its expected place in the Teams' table (`loyaltyUnder`), -10 when the teammate outscored them (`loyaltyBeaten`); a move resets it to 30 (`loyaltyMove`), an academy call-up starts at 60. It changes at the start of `marketMoves`, from the season just ended.

**Sackings: lower teams fire.** After the renewals and the drops, a team that finished 2+ places under its expected place, or in the bottom half of its tier, may sack its lower scorer when they are rated under the tier average less `sackGap` 3 or scored under `sackShare` 60 % of the teammate's points. The chance is `sackChance` for the team's tier, +0.1 for each place beyond 2 under (`sackPerPlace`); at most `maxSacks` 2 a season. The player is never sacked here (that is the seat review, 6.7). The sacked driver goes free; the press writes "<team> sack <driver>" with a principal's line (`media.json` `window.sack`).

**Poaching: hiring from slightly better teams.** When an open seat is filled, the market first looks at drivers under contract at a team 1-3 expected places better (`poachGap`) whose loyalty is under `poachLoyalty`, when the move is a step up: their B seat for this A seat, a higher tier, or the same tier in a better car (`carZ`); never a step down a tier, never someone who signed in this same market, never the player, and never the player's teammate in the player's first season at a team (`poachable`). Best market score first, each candidate's own seeded roll at `poachScale[tier] x (poachLoyalty - loyalty) / poachLoyalty` decides; at most `maxPoach` 2 a season, apart from `maxMoves`. The driver's old seat opens and joins the cascade. The press: "<driver> walks out on <old team> for <new team>", the release fee paid, and the old principal's bitter line (`window.bitter`). The market week's rumours put poach targets on the shortlists too.

**The rivals who won a seat in the window** (6.10) take it before the open seats fill: their old seat opens, and whoever sat in the new one goes free.

**Tuning as measured** (`career-metrics.mjs 100 6`, seeds 1000-1099; main is bca10b9). The spec's numbers (sackChance 0.35 everywhere, poachLoyalty 45, a single roll on the best candidate) gave 0.29-0.40 sackings and 0.26-0.41 poaches a season but broke guards: Legend offers at strong skill 96 % -> 88 % (target 95 %+), the legend wallet at average skill 96 % -> 88 % of the baseline (target 90 %+), and the displaced driver took the player's old seat in 21 % of weak careers (target 20 % at most). The causes, measured one at a time: a two-team Legend tier always has a team "in the bottom half", so Legend sacked every season and filled its seats with the best drivers of the tier below, out of the player's reach; a poach from a better tier's B seat into a lower tier's A seat made the Rookie field stronger; and a driver who had just signed could be poached again, which reopened the player's old seat late. Shipped: the top tier neither sacks nor poaches ("lower teams fire", the user's words: `sackChance` [0.45, 0.45, 0], `poachScale` [6, 0.5, 0]), poaching never costs the driver a tier, a fresh signing is not poached, and `poachLoyalty` 60. Per season, weak / average / strong: sackings 0.38 / 0.51 / 0.45, poaches 0.33 / 0.47 / 0.54, all AI moves 2.06 / 2.35 / 2.51 (main 1.42 / 1.23 / 1.34; the target is now 1-5, the spec's "at most 5", where it was 1-3). Guards: Legend offer at strong skill 95 %, Maestro offer at average skill 92 % (main 95 %), Legend offer at average skill 17 % (main 22 %), the legend wallet 95 %, the displaced driver in the old seat 10 / 3 / 3 %.

**What the market changes on purpose in a career** (`career-sim.mjs 100 6`, main -> now): at weak skill the A-seat offer 72 % -> 62 %: a lower Rookie team's A seat now often holds a driver it poached from a better team, and the player's qualifying duel against them is harder to win. At average skill the final tiers 27 / 57 / 16 % -> 33 / 53 / 14 % and the Legend offer 22 % -> 17 %: the lower tiers hold better drivers, and the player climbs out of them a little later. Every other line moved by 3 points or less (Maestro offer at average skill 95 -> 92 %).

### 6.9 Choices with consequences

Two to five times a season a small decision arrives in the inbox, with one button per answer that says what it does (`choices.js`, the scenes in `assets/career/choices.json`). A scene arrives when its trigger holds on entering a week and the week's roll, `rng(seed, 'choice', season, week)`, is under its chance: one a week at most, five a season, stored in `season.choices`. Left unanswered, a scene takes its stated default when the week ends (Advance, or the race that ends a race week), and the inbox says so.

| Scene | Trigger, chance | Answers (default first) |
|---|---|---|
| Rumour | the market week's rumours (6.8) put the player on a shortlist; always | Deny it: trust +2. Keep them guessing: REP +4, trust -3, that team's interest +0.1 this season, a story |
| Callout | the nemesis (heat 70+) enters the next round and their composure is under 0.6 (all sixteen enter a Tour round or an Open; a Masters only its eight, and none when the player is not among them); one callout a round; 60 % | Let it go: REP -2. Accept: finish ahead of them at the next round for REP +12 (+18 if they drive for a higher tier) and XP +60; finish behind, or retire, for REP -4. The ledger keeps `callout_won` or `callout_lost`, and the press writes both the challenge and the result |
| Press | the week after a round the papers write the player up for: a podium, a finish 4 or more places either side of the expected one, a retirement or a missed cut; 45 % | Credit the team: trust +3. Take aim at the hottest rival (else the teammate): REP +5, their heat +15, the ledger keeps `bold_press`, a story. Put on a show: every sponsor's goodwill +1, within the Sponsor Challenge cap (1-5) |

Effects come only from a fixed list (`EFFECTS` in choices.js, each with the most it may move): trust, rep, xp, heat, interest, note (a ledger entry), flag (one race), mood (sponsor goodwill) and story. The callout's flag sits on `season.current`, which the next round replaces, so it lasts one race and pays once (`settleCallout`); it is judged on the round's classification, so a missed cut counts as finishing behind those who raced.

**Callbacks.** `media.json` `callbacks` quote the ledger back (`media.js callbackOf`, the newest matching entry from this season or the last): in an outside offer's reason and a cool team's line (6.5), in the team principal's story at the season-end market (team orders), and in the feud story after a race.

**Changed from the spec's first guesses** (`career-metrics.mjs 100 6` needs 2-5 scenes a season at every skill):
- The callout's composure bar is 0.6, not 0.5. Of the sixteen starting drivers only one is under 0.5, and with every chance at 1 no callout arrived in 240 seasons at any skill.
- The press scene also follows a finish 4 or more places above the expected one, a retirement and a missed cut, not only a podium or a finish 4 below. With the spec's two triggers a weak player (who misses the cut in most rounds) saw 0.6 scenes a season and an average one 1.2.
- `mood` is an effect of its own, for the Showman answer; the spec's list had no way to move a sponsor's goodwill.

Measured (100 careers x 6 seasons): 4.1 scenes a season at skill 0.975, 2.3 at 0.995, 3.6 at 1.015, never more than 5. The sim answers four scenes in five with a seeded option on dice of its own and leaves the rest to their default.

### 6.10 The transfer window

The season end is a window of `window.days` (3) days (`transfers.js`; `save.pending.window = { day, days, news, signed, reacted, closed }`). `endSeason` opens it unless a deal was signed in mid-season. The review screen shows "Day 1 of 3" with a dot a day, the last one the deadline, the news feed (newest first) and every offer with its chips; Advance day moves it on, and on deadline day the button is Close the window. Both ask for a second press when an offer would lapse or go to a rival (`windowWarnings`). Signing any offer ends the window, as before.

- **Outside offers** (`isOutside`: another team's, not the fallback or the reserve seat; your own team's keep, renewal and counter never lapse, 6.7) get their talks when the window opens or when an approach brings them in (`offers.js` `talksFor`, seeded on the offer):
  - a **deadline**, the last day to agree: hardball gives the day itself, a keen team (interest 0.6+, `window.keen`) the whole window, the others 1-2 days. Past it, an offer not agreed lapses, with a news line and an inbox post; a lapse is no refusal (6.5). The offer row and the deal screen say "Answer today" or "Answer by Day N".
  - on a seeded chance (`rivalChance` 0.6) a **rival**: the best market score on the seat's shortlist (`shortlistOf`, seated drivers allowed), never its own driver or the player. `rivalDay` is the day the team signs them unless terms are agreed first: 1-2 days on, a day sooner when the rival outscores the player's market rating, and each refusal brings it a day closer, never before tomorrow. When the rival signs, the offer goes, the news, the inbox and the press say "<rival> signs for <team>", and the rival takes that seat next season (`window.signed`, honoured by `marketMoves`, 6.8). The deal screen: "Also in talks: Ortega (rated 84). They want an answer before Day 2."
- **Your own team answers**, once, at the end of the first day you have talked to another team (`season.talked`): with trust 50+ (`trust.renew`) its counter rises a step (`counterStep` 10 %), or it makes one (the A seat for a B-seat driver), with the principal quoted; with less, the principal says so ("Go, if they want you").
- **Teams come back with more**: at most once per offer, a team with a rival on its list, interest 0.6+ and patience left raises its salary 10 % (`raise`) on a seeded roll (`raiseChance` 0.5) as a day starts.
- **Leaks**: a seeded chance a day (`leak` 0.35) that the press reports talks with a team you spoke to; a story, no effect at the season end.
- **When the window has closed**, approaching a team is shut too ("Window closed").
- **Mid-season** (the W1, approach and transfer-demand offers): the same rival and tactics; the market week is the window, so there are no days, and a rival signs for next season when the offer lapses (`season.signed`; that seat is then closed to the player at the season end).

**Principals' styles** (`tiers.json` `style`, `tuning.json` `window.styles`; no tier has two of a kind): Aurum and Hayate bid, Saetta and Toro play hardball, Sarab and Liberty are warm, Corvid and Mojave are frugal. The deal screen names the principal (`teams.json`) with a one-line read of the style ("Plays hardball: little patience, short deadlines", `media.json` `window.read`), never the numbers.

| Style | Patience | Gives most on (counts at half) | Deadline | Mention the other offer | Meet the principal | Set a deadline: bluff called |
|---|---|---|---|---|---|---|
| hardball | 2 | nothing | the day itself | no raise, no penalty | patience -1 ("I don't do coffee") | 1.5 x the chance |
| warm | 4 | length | 1-2 days (keen: all) | half the gap | leverage +1 for this offer | the chance |
| bidder | 3 | salary | 1-2 days (keen: all) | matches, up to +20 % | nothing more | never |
| frugal | 3 | signing bonus, status | 1-2 days (keen: all) | half the gap | nothing more | the chance |

**Tactics** (`useTactic`, `tacticInfo`; once each per offer, logged in the conversation with the principal's answer in their style's words, `media.json` `window.quotes`; each button carries a line about its risk, and says why when it cannot be used; at your own team each one costs `offers.ownTrust` trust, as a refusal does; sponsors have none). On the deal screen they sit under the conversation, in a row that wraps.
- **Mention the other offer** needs another team's live offer. If it pays more, the team answers by its style (table). If not, they see through it: patience -1, and the rival day a day closer.
- **Meet the principal** reveals the lever they give most on, in the log.
- **Set a deadline**: the team answers today with its best terms within leverage (`nearestTerms` from the top of every lever), the counter marked Final; Propose goes, and only those terms can be agreed. With a rival, the team may sign the rival instead: the chance is `bluff x clamp(0.5 + 0.05 x (rival's market score - your market rating), 0, 1)` (`window.bluff`, `bluffPerPoint`).
- **Say you want to be here**: patience +1 (+2 at a warm team), leverage -0.5 for this offer (`wantLeverage`).

**Determinism.** Every roll is `rng(save.seed, ...)` with its own tag (`talks`, `window`, `tactic`, and `market` `sack` and `poach`), so the same save and the same choices give the same window (`test-career.mjs`).

**The sim player** (`career-sim.mjs`) haggles over its pick on day 1, lets day 2 come and signs the best agreed offer, else the best left. Day 2 cost it 0.00 / 0.11 / 0.16 offers a window at weak / average / strong skill; its pick, agreed on day 1, never lapses.

## 7. Randomness and events

### 7.1 What the reference games teach

Wrestling Revolution shows how much personality a career gains from a steady drip of random backstage events (newspaper headlines, offers to join a stable, a rival asking for a favour, a contract clause fight). It also shows the traps: stories with no reliable trigger, one-match consequences that vanish, fines and firings that feel like luck, and a low-paid opening that is a grind (Appendix A). WCC3 contributes the opposite lesson: stakes (no replay of a match) and a path chosen by performance. F1 24 and FIFA contribute leverage (haggling that can backfire, secret meetings that leak, mandatory vs. optional objectives).

Design answer: **random in the meta game, fair in the race**. Events are drawn from the state the player is in (form, rivals, standings, offers), not from a flat table; every event shows its stakes before the choice; nothing a player can't undo in a season.

### 7.2 Seeding

- One `seed` per career in the save. A pure function `rng(seed, stream, ...keys)` (mulberry32 over a string hash such as cyrb53 of `seed|stream|keys`) returns a new generator; no global state.
- Streams: `cal` (conditions), `offer`, `event`, `ai` (qualifying jitter, nominations), `market`, `drift` (rating drift). A decision is rolled **when it is generated** and the outcome is stored in the save (`mail[]`, `season.results[]`), never re-rolled on load, so reloading cannot fish for a better roll.
- The race itself is not seeded by the career: the physics and AI run live. The career seeds everything *around* the race.

### 7.3 When events fire

| Rule | Value |
|---|---|
| Per round | at most 1; none in round 1 or the finale; about 4 a season |
| Candidates | events whose trigger matches the state, weighted; the same event waits 2 seasons |
| Positive guarantee | at least one event per season with a clearly good option |
| Bad-luck brake | after 2 events with negative outcomes in a row, the next draw cannot be negative |
| Help when low | with form -2 or worse, help events weigh +30% |
| Severity | small / medium / large; large events (leak, drop warning) need a state trigger, never a pure roll |

### 7.4 The catalogue (first 14)

Odds are shown in the dialog when an outcome is random.

| ID | Trigger | Choices and stakes | Notes |
|---|---|---|---|
| E01 `sponsor_shoot` | round 2-5, sponsor mood >= 0 | **Attend**: +250 U, uses the next free break. **Decline**: sponsor mood -1 (-5% sponsor pay) | the sponsor demand |
| E02 `bonus_clause` | form >= 0 | **Podium bonus** 2 x salary if you podium next round / **Win bonus** 5 x salary if you win / **Take 1 x salary now** | a visible gamble, expected value printed |
| E03 `teammate_demands` | duel lost twice or won three times in a row | **Share data** (trust +4, teammate mood up) / **Hold your ground** (next duel decides: win +8 trust, lose -8) | team politics |
| E04 `rival_callout` | rival heat >= 40 | **Accept**: beat him next race for REP +12 (x1.5 if higher tier), XP +60; lose: REP -4. **Decline**: REP -2 (free if he is from a lower tier) | the challenge calendar |
| E05 `quali_engine_map` | before qualifying | **Standard**. **Qualifying map**: +2% power in qualifying (via the existing `BOP` override); 15% chance the engine is changed: -3 grid places | mechanical gamble, meta penalty only |
| E06 `weather_call` | a round with a forecast chance of rain (Phase 3) | **Standard setup** / **Wet setup**: +0.06 wet grip kept, -3% dry grip; the weather is rolled at the briefing and shown | needs one small physics hook (a setup bias like `setUpgrades`) |
| E07 `press_conference` | after a win or a poor result | **Humble** (trust +3) / **Bold** (REP +5, rival heat +10, trust -2) / **Showman** (sponsor mood +1, style: showman) | also builds driving style |
| E08 `secret_meeting` | outside a window, REP >= an upper team's gate + 50 | **Take it**: 70% stays secret and next window's terms +10%; 30% leaks (trust -10, REP +5). **Decline**: trust +2 | the leak |
| E09 `test_day` | after round 2 and round 4 | **Run it**: a short Time Trial with a target lap; hit it for one free upgrade level early / a development bonus. **Skip**: nothing | Time Trial as test day |
| E10 `budget_freeze` | Rookie team, wallet >= 3,000 U | **Fund it** (-1,500 U): the team's next development step still happens. **Ignore**: that step is skipped for this team | a coin sink with a visible effect |
| E11 `raise_request` | form >= +1, contract has 1+ seasons left | **Ask**: chance 40% + 15% x form: salary +15%; fail: trust -5. **Keep quiet** | |
| E12 `invitational` | a giant-kill streak of 2 | **Accept**: a one-off exhibition race in the next tier's A-seat car (no standings): prize x2, podium REP +15. **Decline** | the underdog arc payoff |
| E13 `media_rumour` | an offer declined last window | **Deny** (trust +2) / **Stoke** (REP +4, trust -3, next window interest +0.1) | |
| E14 `charity_drift` | after a sponsor day | **Run an extra Drift Attack for charity**: no pay, REP +6, style: showman | |

Narrative notes (no choice, only mail): a driver retires and a seat opens; a team is promoted or demoted (living tiers); a sponsor changes.

### 7.5 Fairness rules and the one-try rule

1. Stakes and odds are on screen; the roll is stored.
2. No event changes physics except E05 for one session and E06 for one race, both announced.
3. The worst a pure-luck event can cost is 10 trust, 5 REP or 1,500 U. Never a seat, never the career.
4. No injury, no death.
5. Events that need playing are under 4 minutes.
6. **One try per race**: Restart is hidden in career races, and quitting a race counts as a DNF (RR -1.5, REP -6). Qualifying can be left and re-entered once per round. This is WCC3's no-replay rule and it is what makes a good round feel earned; it also needs the "Retire" wording in the pause menu.
7. **Pace coach** (optional, off by default): after three rounds below expectation, a visible prompt offers "AI pace -2%" for the next round; accepting costs 10% XP. The player decides, nothing adjusts silently (WCC3's dynamic difficulty, made honest).

## 8. The manager layer

### 8.1 What the references say

FIFA's Career Mode is two games: the manager one (board, transfer budget, scouts, tactics) and the player one (a created player rising). EA split them into separate experiences in FC 24, and reviews and forums show the cost of the manager side: opaque sackings, settings that do not work, a lot of numbers (Appendix A). WCC3 has no manager side. Wrestling Revolution has both (wrestler and booker) inside one shared universe, which is the useful shape.

### 8.2 Decision

Ultrack is a driving game, so a manager mode that does not drive is a spreadsheet. The layer is therefore **Driver-Principal**: the player keeps driving the entry every round and gains control of the team around him.

| Stage | Unlock | What the player controls | Worth building? |
|---|---|---|---|
| **Driver** (default) | start | nothing but the driving, contracts, upgrades | Phases 1-3 |
| **Driver-Principal (M1)** | Legend tier with REP >= 900, or buying a team (120,000 U) | the team's development budget split across engine / tyres / brakes; the second driver (hire from free agents and the academy list; his rating raises the team's development rate by up to 10%); one sponsor deal from three each season (income vs. obligations such as events); the board's priorities 1-5 (as in FIFA 22: domestic, development, finance...) and a confidence meter | **Yes, last and small** |
| M2 depth | later, only if M1 is loved | scouting, staff, contract haggling for AI drivers | **No** (a different game) |
| Pure manager | never | simulating races you do not drive | **No** |

Rules for M1: every decision must change something the player sees in the next race (car levels, a teammate, income) or the board's mood; no hidden multipliers; a board that sacks must warn first, show the score and never fire a winner. Effort: about a fifth of the whole career, after Phase 3.

### 8.3 The board (M1)

Five priorities, each 1 (critical) to 5 (nice to have): results, development, finance, prestige, youth. A confidence meter 0-100: it moves by meeting priorities; below 30 a warning, below 20 for two reviews the Principal is replaced and the career continues as a Driver (no game over). The board always shows the next review date.

## 9. Arcs and endgame

### 9.1 Titles and records

| Title | Who wins | Value |
|---|---|---|
| Cup (tier class table) | the best team of the player's tier | the Rookie Cup is the first goal |
| Teams' championship | the best entry-points team | |
| Drivers' championship | the best driver points | |
| Records | best lap per track and car (existing `store.bestLap` shape), wins, poles, giant-kills, longest podium run | shown in the Profile tab and the Records screen |

### 9.2 Legacy and becoming a Legend

Legacy points accumulate for the whole career: Drivers' title 250, Teams' title 150, Cup 60, win 20, podium 6, pole 5, giant-kill 15, feud won 30, three seasons at one team 40, a title won in a Rookie or Maestro car x1.5. **Legend status at 1,000.** Typical player: Legacy ~150 after the Rookie years, ~450 after the Maestro years, 1,000 about the middle of the Legend years (the pacing target).

### 9.3 Time to finish

Seasons of 6 rounds at ~11 minutes of racing plus menus:

| Stage | Seasons | Play time (est.) |
|---|---|---|
| Rookie | 2 | 3 h |
| Maestro | 3 | 4.5 h |
| Legend | 4 | 6 h |
| Total career | 9 | about 13 h (about 10 h with 8-round seasons and shorter races on the new tracks) |

### 9.4 Endings

At Legend status, and at any time after age 34, the player may **Retire** (a career card: titles, wins, records, a list of rivals, the cars driven) or **Buy a team** (Driver-Principal, 8.2), or play on. There is no forced ending. A season-by-season **chapter card** at the review names the arc that applies.

### 9.5 Arcs (state flags, not cutscenes)

| Arc | Trigger | Payoff |
|---|---|---|
| **Underdog** | 2 giant-kills in a season from a Rookie / Maestro seat | E12 invitational; chapter card |
| **Rival** | a feud (heat 80) | REP x1.5 against him; both of you featured in the briefings |
| **Prodigy** | CL 8 and a Cup title before the second season ends | early Maestro offers |
| **Fall and rise** | dropped, then a Cup or podium run within two seasons | REP +30, a comeback chapter |
| **Number One** | the A seat and trust >= 70 for a season | Number One status, development priority |
| **Dynasty** | three consecutive Teams' titles | Hall of Fame bonus |

## 10. Implementation map

### 10.1 Screens

Built from the existing components (`docs/ui-system.md` section 2). New screen ids are registered in `Game.screens` like the current ones. One primary button per screen.

| Screen | Purpose | Components | Notes |
|---|---|---|---|
| `careerStart` | create the driver, take the Shootout, pick one of three offers | Panel, Segmented (nation), Select cards (offers, like circuit cards), Stat readout, primary button | replaces the toast on the Career tile |
| `careerHub` | the Paddock | Tabs: **Paddock** (next round tile with the circuit still, conditions, objectives, Start weekend), **Calendar**, **Standings** (Drivers / Teams / Cup), **Garage** (existing garage, season rules), **Contract**, **Mail** (offers, events, news), **Profile** (CL, XP bar, REP, trust, form, records, achievements) | header shows the circuit and the career wallet |
| `weekend` | briefing: track, conditions, par, objectives, expected finish; launches Practice / Qualifying / Race | Panel, List rows (objectives with `check`), Stat readout | sets `track`, `look`, `weather`, `laps` without touching the free-play settings |
| `careerResults` | the Round report | the existing Results layout plus: Round Rating (big), the RR breakdown (like the itemised U-coin block), objectives, teammate duel row, XP bar, REP / trust deltas, standings movement | extends `ResultsScreen` |
| `offers` | an offer card and the contract negotiation | Select card, Slider (salary), Segmented (length, status), Toggle (livery), Modal (confirm), Stat readout (demand vs. leverage) | the leverage bar shows how far you can push |
| `event` | a random event | Modal with 2-3 choice buttons and a stakes line on each | |
| `seasonReview` | the end of season: table, Cup, objectives, chapter card, trust verdict, windows | Panel, List rows | |

New icons (via `scripts/make-ui-icons.mjs`): `mail`, `contract`, `calendar`, `rival`. Existing: `helmet`, `trophy`, `coin`, `lock`, `check`, `star`, `bolt`, `timer`, `lap`, `track`.

### 10.2 The save

A separate key `ultrack.career.v1` holding `{ slots: [save|null, save|null, save|null], active }`, guarded like `store.js` (every read and write in try/catch). Three slots, picked up, started or deleted on the screen the Career tile always opens first (with Manager career greyed, coming soon); autosave on every phase change. Versioned with `schema` and a `migrate(save)` as in `economy.js`.

```jsonc
{
  "schema": 1, "id": "c_9f31", "createdAt": "2026-11-02T10:12:00Z",
  "seed": 482910331,
  "rules": { "difficulty": "normal", "ironCareer": false, "paceCoach": false },
  "player": { "name": "A. Driver", "nation": "SUI", "number": 99, "age": 21, "helmet": ["#ff5a1f", "#ffffff"] },
  "clock": { "season": 1, "round": 0, "phase": "paddock", "window": null },   // paddock | quali | race | report | window | review
  "career": {
    "cl": 1, "xp": 0, "rep": 0, "form": 0, "trust": 55, "rr": [],             // rr: last 6 round ratings
    "heat": { "VAR": 0 }, "style": { "aggressor": 0, "technician": 0, "showman": 0 },
    "perks": [], "legacy": 0, "duel": { "won": 0, "lost": 0, "level": 0 }
  },
  "contract": { "team": "mojave", "seat": "bmw1", "status": "junior", "seasons": 2, "seasonsLeft": 2,
                "salary": 300, "signing": 900, "bonus": { "podium": 100, "win": 250, "cup": 800 },
                "release": 4800, "exit": 3600, "livery": false },
  "wallet": { "coins": 1900 },
  "garage": { "upgrades": { "bmw1": { "engine": 0, "tyres": 0, "brakes": 0 } }, "paid": { "bmw1": 0 } },
  "world": {
    "teams": { "aurum": { "tier": 3, "expPos": 1, "dev": [2, 2, 2], "sponsorMood": 0 } /* dev = [engine, tyres, brakes]; ...8 teams */ },
    "drivers": { "VAL": { "team": "aurum", "seat": "buggati", "rating": 94, "age": 31, "contractEnds": 3, "status": "lead" } /* ...16 + academy */ },
    "freeAgents": ["MIZ"], "retired": []
  },
  "season": {
    "calendar": [ { "round": 1, "track": "marina", "look": "dusk", "weather": "dry", "laps": 3, "name": "Corniche Opener" } ],
    "results": [ { "round": 1, "grid": 7, "finish": 6, "rr": 8.4, "xp": 215, "rep": 17, "trust": 10, "duel": "won", "entries": ["..."] } ],
    "objectives": [ { "id": "mand-1", "kind": "finish<=exp", "met": true } ]
  },
  "mail": [ { "id": "m12", "kind": "offer|event|news", "season": 1, "round": 3, "read": false, "payload": {} } ],
  "rng": { "event": 2, "offer": 1 },           // draw counters per stream, for audit only: outcomes are stored in mail/results
  "stats": { "starts": 0, "wins": 0, "podiums": 0, "poles": 0, "fastest": 0, "giantKills": 0, "titles": { "cup": 0, "teams": 0, "drivers": 0 } },
  "flags": {}
}
```

Size: under 100 KB even after 9 seasons if `season.results[].entries` is kept for the current season only (older seasons keep the summary row).

### 10.3 Modules and what they extend

New code (pure, node-testable, no DOM, `economy.js` style) in `src/game/career/`:

| Module | Job |
|---|---|
| `rng.js` | `rng(seed, stream, ...keys)` |
| `save.js` | slots, load, save, migrate, guarded storage |
| `world.js` | teams, seats, drivers, tiers; builds the world from `teams.json` + `assets/career/*.json` |
| `calendar.js` | builds a season from the track pool and the `cal` stream; lap counts |
| `rating.js` | Round Rating, XP, REP, form, trust, expPos update |
| `quali.js` | AI qualifying laps, the teammate lap, the duel, the grid order |
| `offers.js` | gates, interest, rolls, terms, counters, negotiation |
| `events.js` | state triggers, weights, brakes, outcomes |
| `market.js` | the AI market (6.8) |
| `economy.js` (career) | wallet, prize, salary, parts buy-back (imports `costOf`, `CATS`, `MAX_LEVEL`, `classOf` from `../economy.js`) |
| `career.js` | the facade the UI calls: `newCareer`, `nextRound`, `finishRound`, `endSeason`, `acceptOffer` |

Changes to existing files (all small):

| File | Change |
|---|---|
| `src/cars.js` `grid()` (line 532) | accept an ordered list of car keys (`field.gridOrder`) so the hero can sit in its qualifying slot; unchanged default |
| `src/cars.js` line 563 | use `field.paceFor?.(c.key) ?? 0.93 + 0.012 * k` so the career can pass rating-based pace |
| `src/game/game.js` `startSession(mode)` | accept `opts` (career entries, AI levels, laps, conditions, grid order); `racersFor()` gets a career variant; the AI levels go in through `applyUpgrades(levelsOf)` with no `onlyKey` |
| `src/game/game.js` `finish()`, `results()` | route a career session to `careerResults`; collect the events the rating needs (crash, spin, fastest lap, positions) |
| `src/game/session.js` `MODES` | add `quali` (Time Trial that ends after N valid laps and emits `qualiDone`); `laps` is already an option |
| `src/game/ui.js` PauseScreen | hide Restart and rename Quit "Retire" while a career session runs |
| `src/game/ui.js` MenuScreen (lines 198, 208) | open `careerStart` or `careerHub` instead of the toast; drop the lock icon |
| `src/game/progression.js` | `playerLevel` reads the highest `cl` across slots; release flips `testingUnlockAll` to false in `assets/teams/progression.json` |
| `src/physics/handling.js` | none for Phase 1-2. E05 uses the existing `BOP` override; E06 (Phase 3) adds a small `setSetup`-style bias |
| `store.js` | none: the career has its own store |

One hazard: `game.selectTrack()` loads a new circuit and `startSession` waits on it; the career should call it from the Paddock for the next round (so `preloadRace()` has the menu time) and restore the free-play track, look and weather when the player leaves the career (keep a snapshot of `store.settings`).

### 10.4 Phases

Effort: S about 1-3 days, M about a week, L two weeks or more (rough, **assumed**).

| Phase | Scope | Size | Done when |
|---|---|---|---|
| **P0 Foundations** | `rng`, `save`, `world` loader, `playerLevel` write path, the three engine touches (grid order, AI pace, career `startSession`), `quali` mode, Restart hidden, the **measurements** below | M | a scripted round runs from a dev console with career grid, pace and AI levels, and the measurements are in `assets/career/*.json` |
| **P1 MVP: First Season** | `careerStart` (create, Shootout, 3 offers), `careerHub` (Paddock, Calendar, Standings, Garage, Profile), the 6-round season, Qualifying + Feature, Round Rating, XP / CL, REP, trust, objectives, cap-1 upgrades, career wallet, end-of-season review with a promotion (A seat) offer, a Maestro offer for a standout year, accept / decline only | L | a fresh player can play a whole Rookie season, sees why they finished where they did, buys three upgrades, and gets a believable offer |
| **P2 The Ladder** | all three tiers and caps, offers and negotiation, counter-offers, W1 poaching, release / exit, the drop and the reserve way back, rivalries and heat, side events (sponsor, test day), CL-gated free-play unlocks, the AI market, 3 save slots | L | a career can run 9 seasons in the sim harness without a dead end |
| **P3 Texture** | events E01-E14, driving style and perks, press, achievements, living tiers, pace coach, the weather hook, the new tracks in the calendar (8-round seasons) | L | event pacing and fairness rules pass the sim harness; new tracks slot in by data only |
| **P4 Principal (M1)** | ownership buy-in, development budget, second-driver hire, sponsor picks, board | M-L | a Legend can buy a team and run it for a season |
| **P5 Stretch** | 16-car grid (teammate on track), career voice lines naming drivers, replays of key moments | L | only if the user wants it |

**P2 as built, where it differs from this document** (each is a smaller version that does the job; change them after a playtest):

- **W1 signs for next season.** A mid-season move would change tier, circuits and tables halfway through a championship, so the player finishes the season, gets his cut of the release clause at once, and joins the new team at the season end.
- **Drops happen at the finale only.** The middle round gives the warning, with its recovery objective; a mid-season drop has the same problem as a mid-season move. So the round 4 shield (3.4) has nothing left to protect.
- **The status lever never changes the car.** It moves junior to second, or lead to Number One. The A seat comes from the duel, an offer or a counter-offer, or a rookie could haggle his way into it on day one. Second driver starts trust at 60; Number One at 65, with two package levels.
- **An A seat in the same tier** needs an average rating of 7.0 and a half roll. With the Rookie gates at 0, the other two Rookie teams would otherwise offer one after any season.
- **The reserve target goes down to P8** ("just finish"), because P7 is no easier for a driver already expected last.
- **Not built:** the livery clause (nothing in the game reads it yet), the exit fee (every move is an offer from a team that pays the release clause, so nobody would pay to leave), Iron Career, and the rule that interest rises with other offers in hand (they raise leverage instead). `testingUnlockAll` stays true so free play is not locked during testing; `playerLevel` is written, and `canSelectCar` gates on it the moment that flag flips.

**The smallest fun career** is P1. It is fun if the first Rookie round already has a goal that is not "win": the briefing says "Finish P7 or better" and the report says "Outstanding: 8.4, sixth place from a slower car". If a playtest of P1 does not feel good, do not build P2 until it does.

**Measurements to take in P0** (all scriptable with `physics-harness.mjs` / `testdrive.js`):

1. AI solo par lap per track and per car at upgrade levels 0, 1, 2, 3 (replaces the **assumed** 3-4% effect and gives `parLap`).
2. India and the new tracks' lap times (the documented ones are Marina ~150 s and Tokyo 105.6 s).
3. A human baseline: 10 laps by the owner on each track against the AI par, to set `difficulty.normal` (does 1.00 pace feel fair?).
4. How many places a rating change moves an AI entry (does 0.01 of pace make one position of difference over a 4-lap race?).
5. Race durations at the computed lap counts.

### 10.5 Tuning data

All of this lives in JSON under `assets/career/` (the repo keeps game data in `assets/teams/*.json`) and is imported the same way `progression.json` is; nothing is hard-coded in the modules.

| File | Holds |
|---|---|
| `tiers.json` | tier of each team, caps, AI dev schedule, multipliers, salary table, bands, the A / B seats |
| `drivers.json` | the 16 ratings, ages, rivals (default from `teams.json`), the academy list |
| `calendar.json` | per track: `parLap`, tags, `lookWeights`, `featureMinutes`, `bias`; the season templates |
| `tuning.json` | every formula constant in this document |
| `offers.json` | gates, wants, negotiation costs, terms |
| `events.json` | the catalogue |

Skeleton of `tuning.json` with the values from this document:

```jsonc
{
  "version": 1,
  "series": { "featureMinutes": 7.5, "qualiValidLaps": 3, "roundsMax": 8,
              "points": [25, 18, 15, 12, 10, 8, 6, 4], "pole": 2, "fastestLap": 1, "finaleMult": 1.5 },
  "pace": { "base": 0.94, "perRating": 0.0021, "min": 0.94, "max": 1.02, "jitter": 0.003,
            "difficulty": { "easy": 0.97, "normal": 1.0, "hard": 1.02 } },
  "quali": { "noiseSigma": 0.012, "duelLevel": 0.0015, "duelBig": 0.003 },
  "xp": { "curve": [90, 1.7], "place": [120, 95, 75, 60, 45, 35, 25, 20], "perPlaceOverExp": 25, "overExpMax": 100,
          "pole": 30, "duel": 25, "fastest": 20, "clean": 20, "mandatory": 60, "optional": 40, "proAssist": 1.15,
          "tier": [1.0, 1.3, 1.6], "freePlayShare": 0.25 },
  "rating": { "base": 6.0, "pos": 0.7, "quali": 0.3, "fastest": 0.4, "clean": 0.3, "duel": 0.4, "duelBig": 0.6,
              "rival": 0.3, "underdog": 0.3, "dnf": -1.5, "min": 2.0, "max": 10.0 },
  "rep": { "perRR": 14, "tierScale": [1.0, 0.8, 0.6], "win": 12, "podium": 6, "pole": 3, "giantKill": 4, "gates": [0, 200, 600] },
  "trust": { "start": 55, "perRR": 4, "mandatory": 8, "optional": 3, "duel": 3, "package": 50, "promote": 60, "warn": 35, "drop": 25 },
  "money": { "prizeMult": [0.7, 1.2, 2.0], "salary": { "rookie": [250, 350], "maestro": [600, 900, 1200], "legend": [1200, 1800, 2600] },
            "buyback": 0.6, "ownerBuyIn": 120000 },
  "upgrades": { "cap": [1, 2, 3], "clGate": [2, 8, 15], "package": [1, 2] },
  "offers": { "base": 0.30, "slope": 0.55, "w1Halve": 0.5, "maxCarDropZ": 0.3, "counterChance": 0.6, "declineMemory": 0.2 },
  "events": { "perRound": 1, "cooldownSeasons": 2, "badLuckBrake": 2, "lowFormHelp": 1.3 },
  "drop": { "shieldRounds": 3, "reserveSalary": 0.6, "repLoss": 40 }
}
```

### 10.6 Tests and the simulation harness

- Unit tests (`npm test` style, no browser): `rng` determinism and independence of streams; `rating` worked examples from 6.1; `offers` gates and the car-drop rule; `calendar` rules (no back-to-back track, finale on the marquee track); `save` round-trip and `migrate`.
- `scripts/career-sim.mjs`: plays 200 seeded careers with a stub player whose finish is `expPos` plus noise at three skill levels (weak, average, strong) and prints: seasons to the first Maestro offer, seasons to a Legend offer, share dropped in season 1, wallet curve, events per season, offers per window. Targets: an average player is offered a Maestro seat in season 2 (median), a strong one in season 1 in over 30% of runs, under 10% are dropped in season 1, no wallet below 0, at most 1 event per round, and the same seed produces the same career.

- `scripts/career-metrics.mjs [careers=100] [seasons=6]`: plays the career-sim careers through wrapped career functions and prints PASS, FAIL or OPEN for each design target in docs/10x/career-spec.md; it exits 1 on any FAIL. Targets about racing a nemesis or a rival need races: a skill with fewer than 100 raced feature rounds (the weak stub misses the cut in nearly every round, 17 raced rounds of 6,000) still gates the ceiling of 3 rivals, but prints the spec's floor of 1 rival and the nemesis-on-the-grid target as OPEN when they are not met, and the last line lists them. **Open, for the user's decision:** at weak skill (0.975) the spec's "1.0-3.0 rivals at career end" and "a nemesis on the grid in 20-70 % of rounds" are not met (0.44 rivals; 17 raced rounds, too few to judge). Rivalries are earned in races, and that driver almost never makes a race. The choices are a heat source outside the race (the Last Chance or the Sponsor Challenge), or targets for the weak driver that count only the rounds they race. It also replays the careers with a pass against every car within two places each race and needs 1-3 rivals at the end there too, and needs the teammate to be the nemesis in at most 45 % of the raced rounds with one at average skill.

## 11. What not to build, and the risks

### 11.1 Not building

- Injury or death (Wrestling Revolution has both; they make a racing career a coin flip).
- A skill tree of driver stats that does not change how the car drives. The player's pace is his hands.
- Pit stops, tyre wear, reliability failures and fuel: none are modelled; fake versions would be randomness without agency. Reliability appears only as the meta penalty in E05.
- Simulating the races the player does not drive. Only the 8 entries race; the teammate and the AI market are cheap numbers.
- Daily rewards, timers, loot, paid skips, energy bars.
- Cutscenes and a voiced story before the music and commentary systems can name drivers (C8).
- A bidding market, scouting staff trees, facilities (M2 and beyond).
- Online leaderboards, multiplayer career.
- Free-play XP farming.
- A second purse that the player can fill by grinding Time Trial.

### 11.2 Risks

| # | Risk | Mitigation |
|---|---|---|
| R1 | The teammate is not on track (C1); players may find the duel abstract | The qualifying duel is on the clock, visible each round; a 16-car grid is Phase 5. Open question 1 |
| R2 | BoP flattens cars (C2), so tiers may not feel different | Three layers (AI upgrades, ratings, expectations); measure in P0; the briefing states the expected finish so a "slow car" is explicit |
| R3 | The human may be slower or faster than the AI at pace 1.00 | `difficulty` is data; the human baseline is a P0 measurement; the pace coach is optional |
| R4 | The AI does not defend (C5), so overtaking is cheap and finish positions may be noisier than the ratings imply | Keep the spread of AI pace modest; qualifying matters; calibrate in the sim with live races |
| R5 | An 8-minute race 6 to 8 times a season is a lot | Laps follow a duration target (`featureMinutes`, 7.5); lower it to 5 if playtests say so; short tracks keep the same duration with more laps |
| R6 | Content volume: 14 events, offers, names, copy, no recorded lines | Data-driven events; text only first; list voice lines as a P5 cost |
| R7 | No art for generated academy drivers | Plain team-colour portraits with initials; or only use the 16 existing drivers in P1-P2 |
| R8 | Naming collision: the "Rookie" assist preset vs. the Rookies tier (C9) | Rename the preset in career copy ("Assisted") |
| R9 | Tracks other than Marina lack venue pieces (C7) | The hub is a menu scene, never a paddock |
| R10 | Track load time between rounds (2-12 s today, GAME.md) | Preload the next round's circuit from the Paddock; reuse `preloadRace()` |
| R11 | Save-scumming | Precomputed outcomes; one try per race |
| R12 | Career overrides free-play settings (track, look, weather, laps) | Snapshot and restore `store.settings` around career sessions |
| R13 | Stat balance drifts after every BoP rebalance | The composite z in Appendix C is re-run by a script when `handling.json` changes; tiers are data and can be re-cut |
| R14 | `TEAMS.md` and `teams.json` disagree on some car names | `teams.json` and `carName()` are the truth; fix `TEAMS.md` when the career ships |
| R15 | The lore: the displaced Rookie drivers | Open question 2 |

## 12. Open questions for the user

1. **Teammate on track.** Is the qualifying duel (6.3) enough, or should the grid widen to 16 cars in a later phase? The 8-slot rule is in `track.json` (`gridSlots`) and the engine.
2. **Whose seat does the player take?** Default proposed: the B seat at Hayate (#23, Mizuno), Mojave (#9, Quintero) or Liberty (#66, Maddox); the displaced driver becomes a free agent. Alternatives: the player starts as a reserve driver who gets the entry in the rounds the team chooses; or the three offers are for new seats invented for the career.
3. **Tier names and assist names.** Keep "Rookies / Maestros / Legends" as you wrote them and rename the "Rookie" assist preset; or call the tiers classes ("Rookie Class")?
4. **One purse or two.** The career wallet is separate here. Do you want free-play coins and career coins to be one balance?
5. **Grid order.** OK to change `Field.grid()` so the player is no longer always last in career races?
6. **Race length.** Is 7.5 minutes per Feature right, or shorter (5)? The new short tracks will help.
7. **Living tiers.** Fixed 2 / 3 / 3 for the whole career, or teams promoted and demoted by results (Phase 3)?
8. **Sponsors in text.** The career copy would name the existing trackside brands (Sony, Rolex, Shell...). Fine for this local project?
9. **Voice.** Do you want recorded lines for career moments (the booth does not name drivers today)?
10. **New tracks.** How many (2 or 3), and are the three archetypes in 4.5 what you are building?
11. **Iron Career and the pace coach.** Offer them from day one, or later?
12. **Player look.** Name, nation, number and helmet colours only, or a portrait too (no art exists)?

## 13. The 360 overhaul (2026-11-02)

The user's words: "full screen UI polished like FC27, have proper segregation for weeks, events, modes, negotiations". The grammar is taken from a football career hub (status bar, tabs, Advance, staged deals with a tension gauge, one inbox). No names, art or layouts are copied, and the tokens are Ultrack's. Save schema 4 (`C.migrate` brings a schema 3 career onto the new calendar at the round it was on).

### 13.1 Weeks

`buildWeeks` (rules.js) turns a calendar into weeks: pre-season, then each round's race week with an open week between rounds, the market after the middle round, the review last. 6 rounds make 13 weeks, 8 make 17. `clock.week` is the index into `season.weeks`. `advanceWeek` moves on from any week but a race week, which ends with its race. `advanceWarnings` lists what a press would cost (a sponsor's goodwill, an offer lapsing); the first press shows it and the second goes. Nothing lapses or changes without a line in the inbox. A choice scene (6.9) left open takes its default as the week ends, with a note.

### 13.2 Events and modes

Three kinds, three columns on the Events tab. **Race weekends** are required. **Test days** (Time Trial against targets; gold is a free upgrade level) and **sponsor events** (the Sponsor Challenge, 4.2: a 2-lap race with three objectives, pays by medal) are optional, one per open week, at the next round's circuit, the team's favourite kind first; `event.result` or `event.skipped` stays on the calendar.

"Modes" was read as what the player can drive and when: Practice (new: Free Drive at the next round's circuit, nothing at stake), Qualifying, Race, Test day, Sponsor day, shown as tiles on Home, each open, next, locked or done with its reason. The race length is a tile beside them, because it changes between rounds.

### 13.3 Negotiations

`careerDeal` is one screen for contracts, offers, team moves and sponsors. Levers: salary, signing bonus, length, status (a sponsor: retainer, bonus). Accepted when the demand fits the leverage (6.5). Otherwise the team names the nearest terms it would sign and loses patience: 3 refusals (a sponsor: 2), and an ask past 1.5x the leverage costs two. Out of patience it walks: REP -5 and no more talks this window. Your own team refusing costs 3 trust each time. Walking away is free, but the team remembers it for a while (6.5, Refusals). The gauge says As offered, Comfortable, Pushing it, Too much or Unrealistic; "Pushing it" runs to 1.15x the leverage, so the limit is near what it shows but not exact. Their counter can always be accepted. Agreed terms still need Sign.

Team moves the player starts: in the market week or at the season end he can approach a team (`approach`). One try per team per window. Under their bar he hears the real reason; over it, a seeded roll on their interest. The tier above, or an A seat in his own tier with an average rating of 7.0. Not in the first season's market week. In mid-season a talk can leak (30 %: trust -5). A deal signed in mid-season starts next season and costs 8 trust; the release cut is paid at once. Unanswered, it lapses when the market closes.

### 13.4 Personal sponsors

`assets/career/sponsors.json`: brands from the sponsor folder by tier (no car makers, no political party). Slots: the tier's rank. Two offers before the season and in the market if a slot is free. A one-season deal: a retainer every round, a bonus on a target (top N, qualifying, podiums, a win, clean races, duels), and sponsor days: goodwill starts at 2, a skipped day costs 1, and at 0 the deal ends (REP -3). In the Sponsor Challenge the deal served gets +1 for gold and -1 for no medal, within 1 and 5 (4.2).

### 13.5 Screens

Everything is full screen on `.cx` (career.css): a still under a scrim, the status bar, the page's grid, a footer with the one primary. Hub tabs (Q/E, LB/RB; Media is 13.5.1): Home, Calendar, Events, Inbox, Deals, Standings, Garage, Driver. `row()` and tabs carry `data-adjust`, so on a `grid: true` screen Left/Right changes them and moves everywhere else. careerStart holds the slots, create, Shootout, first offers and the season review; careerReport fits one screen at 720p. An inbox message with a choice (6.9) shows one button per answer with its effect; once answered, it says what was chosen, or that the default was taken.

### 13.5.1 The Media tab
The paddock press (career/media.js): after each round a story on the winner, the player's day (win, podium, beating the car, a missed cut, a retirement), the teammate, a live feud with the player, and a seeded chance of drama from who really finished side by side (teammates: team orders; lore rivals: a row in the pit lane). Between seasons: who moved, who retired, who lost a seat to the player. Stories live in `save.media` (newest 40), read like the inbox. Home and the race report carry media bytes: three headline cards (the grammar of a football career hub's news tiles, in this UI's own style), and clicking one opens that story on the Media tab. The tab itself is a front page (the picture, headline, story, a pulled-out quote, who it is about) beside a feed with one tile per row. A picture is never cropped: the whole image sits over a blurred copy of itself. New art is landscape 3:2, so it fills the frame. Tiles and bytes load a 480 px thumbnail only as they scroll into view; only the front page loads the full image. Fan talk (`social` and `rumors` in `assets/career/media.json`) adds up to one post a round from what happened: rumours, anger after a bad day, love after a good one, wars between rival stands, leaks. Anger stays on driving and results, rumours are unconfirmed and never sexual. The player's signing with a new team, a mid-season hot seat and being sacked at the finale are stories too, shown with no face. A picture is chosen when drawn: a pair's shot, the driver in that mood, their portrait, the circuit's still, then nothing, and a file that fails to load falls back the same way. The player and academy rookies have no press photo, so their stories show the circuit. What exists is listed in `assets/career/media.json`; `scripts/make-driver-media.mjs` rebuilds it. Looks: `assets/teams/CHARACTERS.md`. Provenance: `assets/career/MEDIA-IMAGES.md`.

### 13.6 Balance, as retuned (career-sim, 80 careers each)

Rating above 8.5 counts half. Trust: per rating point 2, objective ±3, bonus objective 1, duel ±2. REP: per rating point 18, retirement -11, win 8, podium 4, Drivers' title 100, Teams' 60. XP: finish place 145 to 45, over-expected cap 60, quali per place 5, bonus objective 25, events 25 / 50 / 75. Prize multipliers 0.4 / 0.6 / 1.0, salaries Maestro 450 / 650, Legend 800 / 1,200 / 1,800, signing 1.5-3 x salary.

### 13.7 Fixed from the audit

Left/Right on form and negotiation rows, no way out of a sponsor day, the report's pay lines off screen at 720p, the review opening past its results, Sign and the levers below the fold, the Paddock's scroll, mid-season offers vanishing, events vanishing, Infinia at night (`calendar.json`), round names claiming an hour they do not run at, duplicate driver codes, "P12 / 8", a retirement keeping the fastest-lap point, the Shootout's pause copy, Esc from a new career leaving the career, offer copy like a debug line.

### 13.8 Not built

Simulating a race, more than one driver market at a time, exit fees, the livery clause, press and random events (7.4). A full-screen hub still renders the 3D lineup behind it, which costs GPU for nothing; a one-line skip in `main.js` would fix it once that file is free.

## Appendix A: lessons from the reference games

In my own words, from the sources in Appendix B. Where a source did not support a claim, it is said so.

| Reference | What it does | Take | Avoid |
|---|---|---|---|
| **Wrestling Revolution 3D** (MDickie) | A wrestler career in a living universe: start in an unpaid school or a small promotion, move up through promotions of different size and style, sign contracts (a "creative control" clause matters because without it the promoter can change your gimmick), take tasks from the promoter with a deadline (miss it and you can be sent back to school), meet relationships and offers (join a stable, buy painkillers or steroids for stats, be paid to attack someone, a rival holding your gear), read newspaper headlines about the league; interpromotional matches change a company's standing; careers end by retirement or death. The same universe has a booker side. The author's stated aim is that anything that happens in wrestling can happen in the game. Storylines are random with no reliable trigger, mostly last one match, and carry no cutscenes. *The sources I could read do not describe numeric "levels"; the nearest thing is the promotion ladder.* | a ladder with a low-paid entry; a contract clause that protects identity (livery); tasks with deadlines and a soft failure; a headline/mail feed that reports the world; the same universe supporting a player role and later a boss role; a steady drip of small human events | events with no trigger and no lasting consequence; fines and firings as pure luck; death; an unpaid grind |
| **WCC3** (World Cricket Championship 3) | A season-length career (three brackets, 25 series, 400+ matches) from local club up to league or international level, advancement decided by a performance decision system, a choice between a league and an international path, difficulty that adapts, no replay of a match, and cutscenes for selection and media | a ladder gated by performance; one try per match so results mean something; a visible choice of path (offers); adaptive help | hidden difficulty changes; a volume of 400 matches; a career turning on one mistake; cutscene cost |
| **EA FIFA / FC Player Career** | A created player: mandatory objectives set by the club (they decide whether you keep your place or earn a move) and optional ones (wages, awards); XP from match objectives and training turns into skill points; a personality type that unlocks play styles; a manager rating that sets minutes, bench or loan; an agent who proposes a stepping-stone club if your target is too ambitious; free agency by letting a contract run out | mandatory vs. optional objectives; a rating that sets seat status; a stepping-stone suggestion in offers; a personality derived from how you play | skill-tree numbers you cannot feel; a long climb with many meters; XP farmed in training sims |
| **EA FIFA / FC Manager Career** | A board with five categories (domestic, continental, brand, finance, youth), each with a priority 1 to 5, short and long goals, job security as a running score, sackings, and a lower club after a firing; many reports of sackings after winning, objectives that mis-fire, and a "no sacking" setting that does nothing; EA split manager and player into separate experiences in FC 24 | priorities and a job-security meter that warns first; a manager role that is a separate layer | opaque or buggy firings; manager complexity before the core is fun |
| **EA F1 24 driver career** | A recognition system that decides who wants you; teammate battle with perks; contract talks that go back and forth, secret meetings that can leak, unrealistic goals or low demands hurt your standing; objectives from the race engineer; optional R&D scenarios; events that change upgrade costs | haggling that can backfire; leaks; a teammate battle that matters; events that change the cost of things | deep R&D trees; a long list of specialists |

## Appendix B: sources

Read for this design (summaries only; no text reproduced). Status says how far I could verify a source.

| Source | Used for | Status |
|---|---|---|
| [The Smackdown Hotel: Wrestling Revolution 3D career mode guide](https://www.thesmackdownhotel.com/news/wrestling-revolution-3d-career-mode-guide) | promotions, contracts, creative control, tasks, random events, injuries and death | fetched and read |
| [Wrestledelphia: interview with Mat Dickie, part 1](https://wrestledelphia.com/wrestling-revolution-3d-creator-mat-dickie-speaks-with-wrestledelphia-part-i/) | the designer's aim, business side, emergent events | fetched and read |
| [App Store listing: Wrestling Revolution 3D](https://apps.apple.com/app/id923254516) | wrestler and booker careers in one universe | search summary only |
| [Digit: WCC3 to feature Career Mode](https://www.digit.in/press-release/gaming/world-cricket-championship-3-to-feature-career-mode-55188.html) | structure, performance system, dynamic difficulty, no replays | fetched and read |
| [AnimationXpress: WCC career mode](https://www.animationxpress.com/latest-news/wcc-rolls-out-a-comprehensive-career-mode-along-with-other-fresh-features) | brackets, series, path choice | fetched and read |
| [Sportskeeda: WCC3 career mode](https://sportskeeda.com/esports/news-wcc-s-new-career-mode-the-challenging-update-cricket-gameplay-till-date-stirs-excitement-among-110-million-wcc-fans) | corroboration of the WCC3 structure | search summary only (fetch refused) |
| [RealSport101: FC 24 Player Career explained](https://realsport101.com/article/ea-fc-24-player-career-mode) | objectives, agents, personality, free agency | fetched and read |
| [KeenGamer: FIFA 23 Player Career guide](https://www.keengamer.com/articles/guides/fifa-23-player-career-mode-guide/) | XP, skill points, manager rating, grind | fetched and read |
| [Dexerto: FIFA 22 board expectations](https://www.dexerto.com/fifa/fifa-22-career-mode-board-expectations-explained-1664950) | board priorities 1-5, objectives, consequences | fetched and read |
| [EA forums: manager sacked despite winning the league](https://forums.ea.com/idea/fc-26-bug-reports-en/manager-career-%E2%80%93-sacked-despite-winning-league--black-screen/13673740) and [FC 24 manager issues thread](https://forums.ea.com/discussions/fc-24-general-discussion-en/manager-career-mode-issues-continued/7680061) | complaints about sackings and objectives | search summaries only |
| [EA: FC 24 Career deep dive](https://www.ea.com/games/ea-sports-fc/news/fc-24-career-deep-dive) | the split into Manager and Player careers | search summary only (the page returned 404 when fetched) |
| [EA: FC 26 Career deep dive](https://forums.ea.com/blog/ea-sports-fc-game-info-hub-en/ea-sports-fc-26--pitch-notes---career-mode-deep-dive/12403787) | newer career features (not used for numbers) | listed in search; fetch refused (403) |
| [The Race: F1 24's overhauled career mode](https://www.the-race.com/formula-1/f1-24-game-overhauled-career-mode-explained/) | recognition, teammate battle, contracts, leaks | fetched and read |
| [Insider Gaming: F1 24 career mode details](https://insider-gaming.com/details-on-f1-24-career-mode-revealed/), [Charlie INTEL: F1 24 R&D](https://charlieintel.com/games/f1-24-career-mode-best-rd-upgrades-resource-points-specialists-328034) | reputation, resource points, events changing upgrade costs | search summaries only |

## Appendix C: how the tier numbers were derived

Source files: `assets/cars/handling.json` (bop, bopGrip, grip, brakeK), `assets/cars/specs.json` (real figures), `assets/cars/driving.json` (arcade `gripScale`), `assets/teams/progression.json` (ranks, status lines), `assets/teams/teams.json` (cars, drivers, numbers). The formulas are those of `src/physics/handling.js` `handling(key)`:

```
mass  = specs.massKg
top   = (250 + (specs.topSpeedKmh - 240) x 0.6) / 3.6                  // m/s
t100  = 2.6 + (specs.zeroTo100S - 2.6) x 0.75                           // s
power = mass x (27.78 / t100) x 27.78 x 0.7 x bop                       // W
grip  = (1.16 + (handling.grip - 1.16) x 0.45) x bopGrip x driving.gripScale
metrics = [ power / mass, top, -t100, grip ]
composite z(car) = mean over the four metrics of (value - mean of the 16 cars) / (standard deviation of the 16 cars)
team mean z = (z(A) + z(B)) / 2
```

Re-run this when `handling.json` changes (a BoP rebalance moves the z values by a few hundredths; the tier order held on both metrics at the time of writing). The progression rank levels are D=1, C=5, B=10, A=15, S=20, S+=25 (`progression.json` `ranks`).

Lap-time anchors: Marina AI solo laps 144-153 s (`PHYSICS.md`, after the arcade grip pass), Tokyo 105.6 s (`tracks/tokyo/README.md`), India not documented. Lap lengths: Marina 5,467.6 m, 16 corners; Tokyo 5,180 m, 8 corners; India 2,988.6 m, 12 corners (`public/assets/**/track.json`).
