# Ultrack UI system

The production front end for the game: menus, garage, settings, loading, results and the race HUD. The look is the restraint
of a premium sim-racing front end: dark translucent panels over the live 3D scene, hairline rules, one accent colour,
condensed uppercase labels with wide tracking, tabular numerals, the game's own stills as hero imagery, and one SVG icon set.
It takes the grammar of that genre, never another game's assets, logos or layouts.

Source of truth:

| What | Where |
|---|---|
| Tokens | `src/game/ui-tokens.css` (imported first by `ui.css`) |
| Icons | `scripts/make-ui-icons.mjs` writes `public/assets/ui/icons/<name>.svg`, the sprite `public/assets/ui/icons.svg` and `qa/ui-icons.png` |
| Icon helper | `src/game/icons.js`: `icon(name, { cls, label })` |
| Stills | `scripts/make-ui-stills.mjs` writes `public/assets/ui/stills/{tracks,cars}/<id>.webp` |
| Checks | `scripts/qa-ui-icons.mjs` (icons and tokens in Chrome), `scripts/qa-ui-tour.mjs` (every screen, three sizes, DOM audit) |

## 1. Tokens

All sizes are design px on the 1600x900 canvas multiplied by `--u`, so a layout scales with the window:
`--u = clamp(0.8px, min(100vw/1600, 100vh/900), 1.35px)`. That gives 0.8 at 1280x720, 1 at 1600x900, 1.2 at 1920x1080, and a
cap of 1.35. Type tokens also have a px floor, so text never drops below a legible size at 720p. Every token name is prefixed
(`--c-`, `--fs-`, `--sp-`, `--r-`, `--dur-`). The older variables (`--red`, `--ink`, `--glass`, `--tile`, `--slant`) are retired
screen by screen and deleted in the last step.

### Colour: one accent

| Token | Value | Use |
|---|---|---|
| `--c-bg` | `#07090d` | The page behind the canvas |
| `--c-ink-1` | `#f4f2ee` | Primary text, icons, selected values |
| `--c-ink-2` | ink at 74 % | Secondary text and descriptions |
| `--c-ink-3` | ink at 56 % | Labels, kickers and hints (at least 4.5:1 on a panel) |
| `--c-ink-4` | ink at 32 % | Disabled controls and tick marks only. Never body text |
| `--c-ink-inv` | `#0b0d11` | Text on an ink fill (a selected segment) |
| `--c-accent` | `#e3141b` | **The only accent**, race red from the logo: focus, the primary action, "yours", errors, the redline, nitro while it fires |
| `--c-accent-hi` | `#ff2a31` | Accent hover and pressed |
| `--c-accent-wash` | accent at 14 % | Background of a focused row or tile |
| `--c-pos` | `#3fca7f` | A faster delta and an upgrade gain. Text and thin bars only, never a fill or a headline |
| `--c-panel` | `rgba(9,12,17,.74)` | Panels and tiles over the scene |
| `--c-panel-2` | `rgba(14,18,25,.9)` | Raised surfaces: modal, toast, dropdown |
| `--c-fill-1/2/3` | white at 5, 10 and 16 % | Control track at rest, hover, pressed or inactive bar |
| `--c-line` / `--c-line-2` | white at 10 and 20 % | Hairline and strong hairline |
| `--c-scrim` / `--c-scrim-edge` | | Full scrim (pause, modal) and the dark side of a directional scrim |

Rules:

- **Retired colours.** Gold `#f2c14e` (coins, assists, records), green `#3ddc84` (GO), cyan `#5ad1ff` (nitro, fastest lap),
  `#e8be74`, `#98d6ee`, `#f2b705` and `#758495` are all retired.
- **Coins** are ink with the `coin` icon.
- **Fastest lap** is ink with the `bolt` icon.
- **Nitro** is ink while charging and accent while it fires.
- **GO** is ink.
- **Links** are ink, underlined.
- **Team colours** are identity only: a 4 px bar, a logo, a car still. They never mark UI state. A team colour darker than
  luminance 0.12 shows its secondary colour instead, and it always carries a `--c-line-2` edge, so dark teams (Aurum, Hayate)
  stay distinct.
- **Selected vs focused.** A selected value is ink (an ink fill with `--c-ink-inv` text, or an ink underline). Focus is accent.
  The two never share a colour.

### Type

There are two families and only the weights that are loaded:

- **Barlow Condensed** 700 upright, plus 800 and 900 italic.
- **Anton** 400.

Weights 500 and 600 are never requested, because the browser synthesises them. Arial and `system-ui` are never used. Every
number is `font-variant-numeric: tabular-nums` (`.tnum`; the HUD and every table and readout set it on their root).

| Token | Floor / design px | Face | Use |
|---|---|---|---|
| `--fs-micro` | 12 / 13 | Barlow 700, caps, `--track-label` | Key hints, units, tags |
| `--fs-label` | 12 / 14 | Barlow 700, caps, `--track-label` (0.2em) or `--track-wide` (0.28em) | Labels, kickers, column heads |
| `--fs-body` | 14 / 18 | Barlow 700, sentence case, `--lh-body` 1.3 | Descriptions, notes |
| `--fs-value` | 16 / 22 | Barlow 700, tabular | Control values, list rows, table cells, **all lap times** |
| `--fs-title` | 20 / 32 | Barlow 900 italic, caps, 0.01em | Panel titles, pause options |
| `--fs-display` | 30 / 56 | Barlow 900 italic, caps | Screen titles, the hero tile's word |
| `--fs-hero` | 48 / 96 | Barlow 900 italic or Anton | Results position, title-screen words |
| `--fs-num-l` | 32 / 46 | Anton | HUD position, gear |
| `--fs-num-xl` | 56 / 88 | Anton | HUD speed |

Rules:

- Anton is for numerals at 40 design px and up only. Times below that are Barlow 700, tabular, because Anton smudges at
  22 px.
- Labels are uppercase and tracked. Sentences are sentence case and never tracked.
- One kicker per tile, never numbered.
- No text below 12 px, ever.

### Spacing, shape, surfaces

- **Spacing.** `--sp-1..9` = 4, 8, 12, 16, 24, 32, 48, 64, 96 design px. `--gutter` = 64 is the screen edge to content. Every
  padding and gap is a scale step, with no ad-hoc 9, 10, 14, 18, 22 or 26.
- **Radii.** Rounded rectangles only; clip-path slants are retired.
  - `--r-1` 4 px: chips, tags, keycaps, swatches, bars.
  - `--r-2` 8 px: buttons, rows, segments, inputs.
  - `--r-3` 12 px: panels, tiles, toast, modal.
  - `--r-round`: toggle track, gauge discs.
- **Hairlines.** 1 px `--c-line` on every panel edge and divider. `--rule` (2 px) is for the accent edge of a focused tile and
  the active tab underline.
- **Surfaces.**
  - Panel: `--c-panel` with `backdrop-filter: var(--blur-panel)`, a 1 px `--c-line` border and `--r-3`, and no shadow.
  - Raised (toast, modal): `--c-panel-2` plus `--shadow-raised`.
  - The scrim under a modal or pause: `--c-scrim` plus `--blur-scrim`.
  - Menu scrims are directional: `--c-scrim-edge` on the content side, fading to clear over 40 % of the width.

### Motion

- **Durations.** `--dur-1` 150 ms for hover, press and focus moves. `--dur-2` 200 ms for control state and tab content.
  `--dur-3` 250 ms for screen fades, panel slides and the toast.
- **Easing.** `--ease-out` `cubic-bezier(.22,1,.36,1)`, no overshoot. Exits use `--ease-in` at about 70 % of the entry.
- **What moves.** Only opacity and transform. A slide is `--slide` (12 design px), never more.
- **What is banned.**
  - Infinite animations: the title pulse, wrong-way breathe and loading pulse all go.
  - Scale pops above 1.04.
  - `translateX` on hover.
  - Blinking or strobing of any kind.
- **Reduce motion.** The OS setting, or `html[data-motion=reduce]`, zeroes every duration and slide. The UI sets the attribute
  from `store.settings.reduceMotion` at boot and whenever the setting changes. Menus honour the in-game setting, not only the
  OS one.

### Focus

- **Keyboard and pad focus** (Nav's `.sel` and `:focus-visible`) is one look everywhere: a `--focus-w` (2 px) accent ring,
  `outline-offset: var(--focus-offset)`, plus `--c-accent-wash` on rows and tiles.
- **Hover** is `--c-fill-2` and never moves Nav focus, so the mouse and the keyboard cannot fight. A click focuses.
- **Text inputs** show the ring while focused.
- **Contrast.** The ring sits outside the element, so it reads on any still.

## 2. Components

Every component has three states (rest, hover and focus) plus disabled where it applies. Disabled is `--c-ink-4` with no
hover, and the reason sits next to it (`lock` + "Level 4").

| Component | Rules |
|---|---|
| **Panel** | Surface as above, padding `--sp-6`. Title `--fs-title`, then sub `--fs-body` `--c-ink-2`, then content. `max-height: calc(100vh - 2 * var(--gutter))` and the body scrolls. Panels anchor to the top (`top: var(--gutter)` plus header height), never `translateY(-50%)`, so tab switches do not jump. Scrolling bodies get a 24 px bottom fade mask when more is below. |
| **Tile** (menu) | Panel surface, `--r-3`, padding `--sp-5`. Optional still as `object-fit: cover` under a bottom-up `--c-scrim-edge` gradient. Kicker (label), word (display), desc (body), and an `arrow-up-right` icon top-right, the same on every tile. Focus: 2 px accent ring plus wash. The hero tile keeps its still when focused (the focus style only adds a ring, it never replaces the background). |
| **Button, primary** | Accent fill, ink text, `--fs-value` 900 italic caps, `--r-2`, height 48 design px, leading icon optional. One per screen. Hover `--c-accent-hi`. Focus ring in ink (the accent fill already says "primary"). |
| **Button, secondary** | `--c-fill-1` with a 1 px `--c-line-2` edge, ink text. Hover `--c-fill-2`. |
| **Button, ghost** | No fill, ink-2 text with an icon. Hover ink plus `--c-fill-1`. For Back, Close and inline actions. |
| **Prompt** (key hint) | `<kbd>` keycap: `--r-1`, 1 px `--c-line-2`, `--fs-micro` caps, min-width 24 design px. Arrow keys are `arrow-*` icons inside the cap. Pad prompts are the `pad-*` icons at `--icon-m` with no cap. The footer shows keyboard or pad prompts by the **last input used**. Order: primary action first, Back last. No version strings. |
| **Tabs** | Text tabs with an optional icon, `--fs-label` `--track-wide`, `--c-ink-3`. Active: ink plus a 2 px accent underline. Tabs are Nav stops. Q/E and pad LB/RB switch them, with `pad-lb`/`pad-rb` (or Q/E caps) drawn at either end of the tab row. |
| **List row** | Height 44 design px, padding `--sp-3`, divider `--c-line`. Columns are a CSS grid shared with a header row (`--fs-label` `--c-ink-3`). Focus: wash plus a 2 px accent inset bar on the left. Selected (for example "your car"): an ink `check` icon, not colour. Rows are Nav stops when the list is navigable; Nav scrolls the focused row into view (`block: nearest`). |
| **Stat readout** | Label (`--fs-label`), value (`--fs-value` tabular, or Anton at hero sizes), unit (`--fs-micro` `--c-ink-3`, always present: KM/H, HP, KG, S, °). Empty is an em dash `—` in `--c-ink-4`, the same everywhere (records, results, HUD, garage). Never `-:--.---` or `0 PTS`. |
| **Bar** (stat, compare) | 6 design px high, `--r-1`. Track `--c-fill-1`, value ink. An upgrade gain is a `--c-pos` extension. Comparison markers are a 2 px ink tick. |
| **Segmented control** | `--r-2` group with a `--c-fill-1` track. The selected option is an ink fill with `--c-ink-inv` text. Options wrap to a grid of equal cells, never ragged lines. Left/right on a focused row changes it. |
| **Toggle** | `--r-round` track, 40x22 design px, with an "On" or "Off" word beside it, so the state never relies on colour. On: ink track with a dark knob. Off: `--c-fill-2` track with an ink-3 knob. |
| **Slider** | 4 design px `--c-fill-2` track with the value part in ink, a round 16 design px ink thumb, and the value with its unit (`85 %`, `+4°`) in `--fs-value` tabular. Left/right steps it. |
| **Select** (circuit, car pickers) | A card row: still, name, facts. Focus ring, selected `check`. Never a native `<select>`, and never a native colour input: the custom paint colour is a swatch that opens an HSV strip in the panel. |
| **Swatch** | 32 design px, `--r-1`, always a 1 px `--c-line-2` inset edge, so dark paints show. Selected: a 2 px ink ring with a `check` in contrasting ink. Swatches are Nav stops (a grid). |
| **Toast** | `--c-panel-2`, `--r-3`, raised, icon plus text plus an optional action. Bottom-centre **inside the footer band** (bottom `--sp-8`), never over tiles. Kinds: info (`info` icon) and error (`error` icon, accent edge, with an action where one exists, such as Reload). Info auto-dismisses after 4 s. Errors stay until acted on. In 250 ms slide-up, out 180 ms. |
| **Modal** (confirm) | A centred panel at 480 design px over `--c-scrim`, with title, body and two buttons (primary plus secondary). Focus is trapped and starts on the safe option. Used for Quit to menu and Restart mid-race. |
| **HUD readouts** | Tiles use the panel surface at `--r-3`, 1 px line, no blur over 4 px (performance). Labels are `--fs-label` caps. Numbers are tabular. Only textContent and transform change per frame, and only when the value changes; no innerHTML in the frame loop and no layout reads. Groups scale by `--s` as today. Empty values show `—`. Signal states use icons and the accent: nitro firing (accent bar, `nitro` icon), invalid lap (`invalid` icon plus accent text), wrong way (a static `wrong-way` icon panel with an opacity fade only). Lap and position messages sit on a panel strip, never as bare text on the sky. |

## 3. Icons

Rules:

- A 24 px grid with a 2 px live-area margin. 1.75 stroke (`--icon-stroke`), round caps and joins, `fill: none`,
  `currentColor`.
- Fills only for small solid details: dots and checker cells.
- No text inside icons except the stroked pad letters A, B, X, Y, L and R.
- Sizes:
  - `--icon-s` 16: inline in labels.
  - `--icon-m` 20: buttons and prompts.
  - `--icon-l` 24: tiles and tabs.
  - `--icon-xl` 32: empty states and toasts.
- Each icon is generic (what it shows), and this table maps the uses.
- `make-ui-icons.mjs` rejects an icon that does not parse, is empty, or reaches into the outer 1 px.
- **Unicode glyphs as icons are banned**: `↗ ← → ↑ ↓ ┄ ▮ ·` as structure, a letter U for coins, and emoji. The tour's
  `iconGlyphs` audit must come back empty.

| Icon | Used for |
|---|---|
| `arrow-left` `arrow-right` `arrow-up` `arrow-down` | Arrow keycaps, list hints, upgrade deltas (`→` goes) |
| `arrow-up-right` | Tile "go" mark (replaces `↗`), external links in credits |
| `chevron-left/right/up/down` | Steppers, segmented overflow, scroll hints, tab-row ends |
| `chevrons-up` | Upgrade level steps |
| `back` | Back buttons and the Esc hint |
| `close` | Close a modal or toast |
| `check` | Selected option, your car, "Saved", a valid lap |
| `plus` `minus` | Slider steppers, laps count |
| `play` | Resume, Start |
| `pause` | Pause hint in the HUD |
| `restart` | Restart, Retry, Reload |
| `quit` | Quit to menu, End session |
| `home` | Main menu |
| `settings` | Settings tile and pause option |
| `sliders` | Assists row, Picture options |
| `race` | Race mode, finish, chequered |
| `time-trial` | Time Trial mode |
| `drift` | Drift Attack mode |
| `free-drive` | Free Drive mode |
| `garage` | Garage tile |
| `track` | Circuit row, the circuit in records |
| `map` | Map overview (M) |
| `car` | Your car, the car list |
| `position` | Position, finishing order |
| `trophy` | Records, Victory |
| `lap` | Lap counter |
| `timer` | Lap time, Best |
| `speed` | Top speed stat |
| `gear` | Gearbox and drive stats |
| `nitro` | Nitro meter, the nitro key |
| `energy` | EV powertrain, battery |
| `bolt` | Fastest lap, ELECTRIC badge, acceleration |
| `lock` `unlock` | Locked car or upgrade, unlocked |
| `coin` | U-coins everywhere (replaces the "U" prefix and gold) |
| `upgrade` | Upgrades tab, buy an upgrade |
| `specs` | Specs tab |
| `paint` | Paint tab |
| `helmet` | Driver |
| `keyboard` `gamepad` `mouse` | Controls tab sections, the input-device hint, Drag to turn |
| `picture` | Picture tab |
| `steering` | Driving tab, Steer |
| `volume` `volume-off` | Sound tab, mute |
| `music` | Music volume |
| `camera` | Camera key, the camera label |
| `people` | Credits, crowd |
| `assists` | Assists preset |
| `star` | Personal best, new record |
| `warning` | Wrong way (with `wrong-way`), cautions |
| `info` | Info toast, notes |
| `error` | Error toast |
| `invalid` | Invalid lap |
| `wrong-way` | Wrong-way panel |
| `sun` `sunset` `moon-horizon` `moon` | Day, dusk, blue hour, night |
| `cloud` `cloud-drizzle` `cloud-rain` | Weather: overcast, damp, rain (dry = `sun`) |
| `pad-a` `pad-b` `pad-x` `pad-y` | Pad prompts: A confirm or handbrake, B back, X nitro, Y reset |
| `pad-lb` `pad-rb` `pad-lt` `pad-rt` | Tabs (LB/RB), camera (RB), brake (LT), throttle (RT) |
| `pad-ls` `pad-rs` `pad-menu` `pad-view` `pad-dpad` | Steer (left stick), pause (menu), view, navigate (d-pad) |

## 4. Stills

Everything is the game itself. Nothing is painted or generated. Regenerate with
`node scripts/qa-lock.mjs -- node scripts/make-ui-stills.mjs [tracks|cars|all]`. `PROBE=1` shoots candidates to reframe from.

- **Tracks** (`stills/tracks/<id>.webp`, 1600x900, opaque). These come from the dev viewer: orbit camera, dry, with the panel
  and overlays hidden. Views are centreline indices, so they follow a rebuilt track.

  | Track | Look | View |
  |---|---|---|
  | `marina` | Dusk | The start straight: pits, gantry, grandstand |
  | `tokyo` | Dusk | Temple street, cherry blossom, Fuji |
  | `india` | Day | The ghat road into the valley |

  Uses:
  - The menu's Race tile (the selected circuit).
  - The circuit cards in setup.
  - Records' circuit header.
  - The race-loading backdrop (replacing the illustrated slides).
  - The title screen backdrop until the live scene is dressed.
- **Cars** (`stills/cars/<key>.webp`, 1600x900, **alpha cutout** with its contact shadow). All 16 garage cars come from the
  garage room. Every car has the same front three-quarter camera (nose to the right, the longest car about 70 % of the width,
  car centred), so a car swap never shifts the layout.

  Uses:
  - The "Your car" tile.
  - Garage list thumbnails (cropped through `object-position` to the car's box).
  - The results podium (P1 to P3 cutouts side by side).
  - Pause context.
  - Records rows (small).
- **Not stills.** Team logos (`/assets/teams/logos`), driver posters and the brand logo (`/assets/brand/ultrack-alpha.webp`) stay
  as they are.
- **When to reshoot.** Reshoot when a car's livery or a circuit view changes. The QA tour shows a stale still next to the live
  garage.

## 5. Screens

The shared frame is:

- **Gutter** of 64 design px.
- **Header band**: the logo at 168 design px wide, top-left, plus the screen title.
- **Content**.
- **Footer band** at 56 design px: prompts on the left, the coin balance on the right where relevant. No version strings and
  no dev text.

Every screen fits 1280x720 to 2560x1440 with no clipping: panels clamp to the viewport height and scroll inside.

- **Title**
  - Backdrop: the live scene, or the Marina still, under a light scrim. The logo sits centred at 44 %.
  - Loading state: a 4 px bar 320 design px wide, with a stage name ("Loading garage", "Preparing cars") and a percentage.
  - Ready state: a single static prompt ("Press any key" with an `pad-a` or `Enter` cap). No pulse.
  - The corner version string goes. `index.html` gets the game font, a `--c-bg` body, and dev overlays styled only under
    `?dev=1`.
- **Menu (bento)**
  - The grid stays, at `--sp-3` gaps.
  - The Race tile (2 rows) carries the selected circuit's still, the circuit name and its facts (length, corners), with no
    `01` watermark.
  - The mode tiles carry their icon at `--icon-l` above the kicker.
  - "Your car" carries the car cutout over a team-tinted panel (team colour at 12 %), the name, the team logo and the driver.
    The huge number goes.
  - Records and credits are text tiles.
  - The header shows the circuit name and the coin balance (`coin` icon, ink).
  - Esc on the menu does nothing (the title is boot only). Quitting is a future modal.
  - Every tile is a Nav stop. `test-menu.mjs` still sees 9 `[data-nav]` buttons and "YOUR CAR".
- **Setup (race, trial, drift, free)**
  - The left panel is 560 design px wide and anchored to the top.
  - Rows in order: Circuit (cards, 3 across: still, name, length and corners), Laps (stepper), Time of day (icons plus
    words), Weather (icons plus words), Assists (segment plus a note in ink-2).
  - Start is the primary button at the bottom of the panel.
  - The car card goes. The car shows in the 3D scene, and the panel never covers it at 1280 wide.
  - Focus starts on the first row once the circuit row exists.
  - Free Drive's HUD hides the clock, so "No clock" is true.
- **Garage**
  - The car list sits on the left: grouped by team (logo header), rows with a small cutout, name, class and level, and a
    position indicator ("4 / 16").
  - Detail panel on the right:
    - Tabs with icons (Car, Specs, Upgrades, Paint) and LB/RB prompts.
    - A body that scrolls.
    - A **sticky action bar** at the bottom, so "Drive this car" is always visible.
  - The title is car and team, over a left-to-right scrim, never colliding with the scene.
  - Paint: swatch grids as Nav stops, the custom colour in-panel, wheels and calipers likewise.
  - Specs: icon legends (yours dashed, upgraded `--c-pos`). The size silhouette becomes the car's real side-view cutout from
    the still set, at true scale against yours.
  - "TEST BUILD" text goes.
  - Currency shows once, in the footer.
- **Settings and settings from pause**
  - The panel is anchored to the top. Tabs with icons are Nav stops, with LB/RB.
  - The Controls tab is a table: action, keyboard keycaps, pad glyphs. Rows are focusable.
  - Values carry units.
  - "Show FPS" moves under a dev section.
  - From pause, a full `--c-scrim` covers the race, and the camera label is hidden while any screen is up.
- **Records**
  - A circuit selector (cards).
  - A table with a header row: car (cutout and team bar), best lap, best drift. Empty values show `—`.
  - Rows are Nav stops and scroll into view.
  - Back is a ghost button in the footer, not a full-width bar.
- **Credits**
  - Grouped (Cars, Audio, Artwork, Fonts, Code) with headers. Links are ink and underlined, with `arrow-up-right`.
  - Internal provenance notes are not player copy, but they are licensing facts. See the release blocker in the risks.
- **Toast**
  - The component rules above, bottom-centre in the footer band.
  - `setBusy` keeps its markup. The kind and timeout come from the engine patch (H2).
- **Race loading**
  - The backdrop is the selected circuit's still (a slow 1.04 scale over the whole load, which reduce motion stops).
  - Copy is per track: kicker "Corniche Marina · Dusk", title, and the true field size ("Eight teams. One grid.").
  - Footer: a 4 px stage bar with the stage name and percentage, plus the `back` and Esc prompt at `--fs-micro`.
  - No Arial, no gold, no pulse. `test-race-loading.mjs` is updated with it (slide count and images).
- **Grid lights and countdown**
  - The lights tile stays.
  - Count digits are ink in Anton, fading in from 0.96 to 1 scale with an opacity fade (no 1.3 pop). GO is ink.
  - The controls hint becomes prompt components, one line, keyboard or pad.
- **Race HUD**
  - **Tower:** position `--fs-num-l` and a lap counter (`lap` icon). Standings rows carry team bars with a line edge and gaps
    to one decimal.
  - **Timing:** LAP TIME large, LAST and BEST tabular. A delta in `--c-pos` or accent appears only when a time exists.
  - **Gauge:**
    - The speed has no ghost leading zeros (the digits are right-aligned).
    - TCS, ABS and ESC become tags at `--fs-micro` that go ink when active.
    - The gear disc is `--r-round`.
    - Nitro: an ink bar that turns accent while it fires, with the `nitro` icon.
  - **Messages** sit on a panel strip under the timing tile. The delta is joined with a thin space and a sign.
  - **Wrong way:** a static panel with the `wrong-way` icon and an opacity fade. No breathe.
  - **Map overview:** a darker plate (`--c-panel-2`), corner numbers at least 12 px, N marker 12 px.
  - **Camera label:** the HUD tile style, bottom-left above the map, hidden while a screen is up.
  - Every label is at least 12 px at 1280x720.
- **Pause**
  - A full scrim with a centre panel at 480 design px.
  - A context strip: mode, circuit, position, lap, time.
  - Options as list rows with icons: Resume, Restart (modal confirm), Settings, End session (trial: "See laps"), Quit to menu
    (modal confirm).
  - Footer: Esc or `pad-menu` resumes.
- **Results**
  - Race: a podium hero (P1 to P3 car cutouts with position, driver and team) above the finishing table:
    - pos, team bar, driver, car, time or gap, best lap;
    - tabular, at `--fs-value`;
    - fastest lap marked with `bolt`;
    - a max-height table that scrolls.
  - Your row has the accent wash.
  - Trial: a lap list table (lap, time, delta to best, a valid `check` or `invalid` icon) beside the best-lap readout.
  - Drift: the score at hero size with the record beside it (`—` if none).
  - Earnings: a `coin` line, ink.
  - Again is primary, Menu secondary.
  - Fits 1280x720.
- **Trial, drift and free HUD**
  - The lone LAP tile joins the timing tile.
  - Invalid lap is an icon plus accent text at `--fs-label`.
  - Free shows only speed, gear and the map.
  - Drift tile:
    - the score in Anton;
    - "88 S" becomes a ring timer with seconds;
    - a chain multiplier `x1.0` always shown;
    - the chain bar on `--c-fill-1`.
- **Driver intro**
  - It is dead code. Archive `driver-intro.js` and its CSS to `_archive/2026-10-30/` with a MANIFEST line, and point
    `test-driver-intro.mjs` at nothing (it already only runs test-hoardings).

## 6. Engine handoff (patches the UI pass does not apply)

These are files the UI pass does not own. Each patch is exact text.

- **H1. `src/game/game.js` `cycleCamera()`: style the camera label in CSS.**
  - Old:

    ```js
    h('div', { id: 'cam-label', style: { position: 'absolute', left: '32px', bottom: '30px', padding: '9px 18px', font: 'italic 800 15px/1 var(--label)',
          letterSpacing: '0.26em', color: 'var(--ink)', background: 'rgba(9, 14, 22, 0.74)', border: '1px solid rgba(255, 255, 255, 0.12)', borderRadius: '10px', opacity: '0', pointerEvents: 'none' } })
    ```

  - New:

    ```js
    h('div', { id: 'cam-label', style: { opacity: '0' } })
    ```

  - Why: the label matches the HUD tiles through `#cam-label` in `hud.css`. Until this lands, `hud.css` styles it with
    `!important`. It is hidden over screens without an engine change, through
    `#ui:has(> .screen.on) #cam-label { visibility: hidden }`.
- **H2. `src/game/game.js` `setBusy()`: add a kind and a timeout to the toast.**
  - Old: `setBusy(message){`
  - New: `setBusy(message,{kind='info',ms=kind==='error'?0:4000}={}){clearTimeout(this.busyT);`
  - Then, after `this.busyEl.textContent=message;this.busyEl.hidden=!message;`, add:

    ```js
    this.busyEl.dataset.kind=kind;if(message&&ms)this.busyT=setTimeout(()=>{if(this.busyEl.textContent===message)this.busyEl.hidden=true;},ms);
    ```

  - Callers that report failures pass `{kind:'error'}`. That is game.js lines 110, 222, 262, plus `src/main.js`
    `game?.setBusy('Circuit could not load. Reload to retry.',{kind:'error'})`.
  - Why: the toast never dismissed, and errors looked like info.
- **H3. `src/game/game.js` `show()` and `hideScreens()`: match the new fade.**
  - Change `}, 450);` to `}, 260);` in both.
  - Why: the screen fade becomes `--dur-3` (250 ms). The 450 ms timer only kept a faded screen in the layout longer.
- **H4. `src/game/session.js` MODES.**
  - Copy stays unless the user wants it changed. Free Drive's "No clock" is made true by the HUD (no engine change), and
    the "Seven teams" error is in `race-loading.js` (UI).
- **Out of scope for the UI pass.**
  - The flat garage room behind the menus and garage (`garage-room.js`). It is the biggest remaining "placeholder" read, and
    the menus cover it with stills and scrims meanwhile.
  - The mid-race gap estimates (`session.results()`).

## 7. Risks to tell the user

- **Release blocker (credits).** The credits show provenance notes calling some car models probable rips from a mobile
  game. The `assets/cars/*/license.json` of aston-martin-valk, huracan, laferrari and porsche1 mention a mobile game. That is
  a licensing fact, not copy to polish. The UI pass groups and restyles the credits but does not reword or hide it. Those cars need
  replacing or a licence before any public release.
- **Real names and brands in stills.** The stills show the in-game sponsor boards and stand names (for example a driver-name
  banner at Marina). They are the game's own dressing, so they carry whatever clearance the boards themselves have.
