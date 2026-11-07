# Startup, teams and venue artwork — 2026-10-20

## Startup changes

The current garage/renderer follow-up is documented in [runtime fixes](RUNTIME-FIXES.md). Menus and garage now use an independent lit room; the circuit model and venue lighting are requested only by a driving session. The bullets below describe the earlier venue-backed startup implementation.

- The menu accepts input while the venue is loading. Garage previews and session
  starts await venue readiness and show their loading state; records/credits and
  settings are available independently.
- Only the saved/current car is assembled for normal startup, instead of twelve.
  Garage browsing loads the requested car; a race loads its six-car lineup.
  Requests share an in-flight cache and decoding/assembly is bounded to two jobs.
- Distant LODs are deferred. Spectators load after the first car, during idle time.
- Rapier imports and initializes on first physics use, not when the menu loads.
- The selected sky starts in parallel with the venue and shares in-flight requests;
  a saved night setting no longer fetches dusk first.
- The UI logo is lossless WebP: 417,336 → 107,624 bytes.

The production initial JS bundle is about 2.73 MB, down from 7.06 MB; the 4.33 MB
physics chunk is now a dynamic import. This is a build/asset measurement, not a
claimed browser cold-load timing. No DevTools trace was available in this session.
See `assets/startup-budget.json` for the reproducible production asset budget.

The current venue remains a single selected map. Adding map files does not require
fetching them all at startup: future map selection should continue to request only
the active venue. This change does not add or prefetch two nonexistent maps.

## Teams

| Team | Cars |
| --- | --- |
| Saetta — red; the Ferrari team | Ferrari Furari 488, Ferrari La Furari (LaFerrari) |
| Toro — giallo yellow and black; the Lamborghini team | Lamborghini AV-12, Lamborghini HU-10 (Huracán STO) |
| Corvid | Aston Martin Valkyrie, Mercedes-AMG One |
| Mojave | Bentley Continental GT, BMW |
| Aurum | Bugatti Divo, Bugatti Destrier |
| Liberty — royal blue, red, white; royal-blue lights | Ford GT Mk II, Hennessey Blackbird |
| Sarab | McLaren 720S, Porsche |

Drivers move with their cars: Maddox (#66) drives the Ford GT Mk II for Liberty, Lindqvist (#8) the Bentley for
Mojave, and Varrone (#7) went with the AV-12 when it moved from Saetta to Toro. The two new cars bring two new drivers: Armand Beaulieu (#16, Bugatti Destrier, Aurum) and Wade Hollis
(#76, Hennessey Blackbird, Liberty). All sixteen cars and numbers are unique. The marina has 12 pit boxes for
the 14 cars (Kalt, the electric team, was removed 2026-10-22), so Mojave and Liberty have one box each (see assets/teams/TEAMS.md). Liberty's font (Graduate, SIL
OFL) is bundled in track-viewer/public/assets/fonts with its licence; its `light` colour is royal blue. New Ferrari paint defaults to Saetta red; custom saved paint is retained.

## Venue artwork and validation

See [logo provenance](../assets/sponsors/README.md). Original artwork replaces 349
placed signs and is also used on the car sponsor decals and garage headers.

Checks: `test:v2`, `test:loading`, `test:sponsors`, the packed-car checks, the track
collision/lap simulation, and a production build. Browser screenshots, wall-clock
cold-load times and an in-game visual approval were not collected in this pass.

## Teams: Toro, and La Furari for Saetta (2026-10-21)

- **Toro** is the eighth team (`toro`, TOR, Sant'Agata Bolognese; yellow, black and bone white; Unbounded Black, SIL OFL,
  bundled in track-viewer/public/assets/fonts; sponsor Red Bull). It takes the AV-12 (#7, Varrone) from Saetta and
  the new HU-10 (#63, Paloma Ortega). Its lore, with the rivalry and the reason Varrone moved, is in assets/teams/TEAMS.md.
- **Saetta** is now the Ferrari team: the Furari 488 (#17, Calderini) and the new La Furari (#27, Thiago Barreto). Its line is "Lightning strikes first."
- Seven teams, fourteen cars; a race runs one car per team (seven). Pit boxes: Aurum 1-2, Saetta 3-4, Toro 5-6, Sarab 7-8, Corvid 9-10,
  Mojave 11, Liberty 12; the second cars of Mojave and Liberty have no box.
- Venue: Toro's garage headers, floor panels, transporters, flags, crew, hospitality unit and canopy banner were added by
  `tracks/marina/apply_teams.py` (which also re-assigns every box to its owner) and the venue was repacked (`npm run pack`, `npm run sync`).
- Logos: `scripts/build-team-logos.py` needs the Toro emblem entry (see assets/teams/logos/README.md) before it can rebuild; the new
  teams use `colors.ink` (Toro) and the Toro lettering in `assets/teams/fonts/` for Blender text.
- Team tests with hard-coded counts (`test:team-logos` expects seven teams and 28 venue surfaces, `test:progression` and
  `test-loading` count fourteen cars) must say seven, 28 and fourteen.

## Hayate, the Japanese team, and Sony (2026-10-22)
- **Hayate** is the eighth team (`hayate`, HYT, Oyama, Shizuoka; murasaki violet, white and vermilion; Dela Gothic One): Nissan Z GT4 (#23, Kaito Mizuno) and Toyota GR Supra Super GT (#37, Rina Kuroda),
  sponsor Sony. Sixteen cars, one per team racing. Box 10 is Hayate's and Corvid keeps 9. The car folders (`nissan-z`, `supra`) come from the car pipeline; until they exist, tests that load models fail.
- Driver posters for Mizuno and Kuroda are not made (`test:hoardings` / `test:driver-intro` fail on the missing `poster-hoarding.webp`, as for any new driver).
- Logos: `track-viewer/scripts/build-team-logo-hayate.py` (see assets/teams/logos/README.md). Venue: `tracks/marina/add_hayate.py`. Sony boards: assets/sponsors/README.md.

## Norrsken, the Swedish hypercar team (2026-11-07)
- **Norrsken** is the ninth team and the third Legend team (`norrsken`, NRS, Ängelholm; graphite, aurora green and ice; Michroma): Koenigsegg Jesko (#10, Elin Hagberg) and
  Koenigsegg CC850 (#85, Jari Koskinen), sponsor Samsung (a brand already shipped for Cheongsan Park; `sponsors.js` lets a venue brand be a team's title sponsor). Eighteen cars.
- A quick race is one car per team, at most the eight grid slots every circuit has (`cars.js` `GRID`): with nine teams, the team furthest from the player's in the expected
  order sits out (`game.js` `racersFor`). The developer viewer still loads one car per team and races the first eight.
- No pit box (the Marina's twelve are taken) and no venue dress: `tracks/` was not changed. No driver posters or press photos yet: the hoardings put up no board for them
  and the press falls back to the circuit, as for any new driver.
- Logos: `track-viewer/scripts/build-team-logo-norrsken.py` (see assets/teams/logos/README.md). Car stills: `make-ui-stills.mjs` cars, side and thumbs with `ONLY=jesko,cc850`.
- The CC850 has its own livery places (`livery.js` `FIT`: a smaller bonnet logo, no deck sponsor, a smaller flank sponsor on the door clear of the side intake) and no Wheels paint row (its rims share a material with the tyres; `model-rims.js` `paintsRims`: a model car keeps the row only if its rim material is listed, a car-lab car such as the Continental GT always does).
  Known: in its side still the kept rear plate shows edge-on past the bumper; fixing it means moving the plate in `prepare-cars.py` `cc850()` and re-deriving the LODs.
- Career: schema 12 adds the team to an old save (`career.js` `addTeams`); the balance, the retune and the decisions left to the user are in track-viewer/docs/career-mode.md.
  QA shots at 1600x900: `track-viewer/qa/team-norrsken/shots.mjs`.

## Steelhead, the Detroit team (2026-11-07)
- **Steelhead** is the tenth team and the fourth Maestro team (`steelhead`, STH, Detroit; brushed steel, steelhead rose and near-black; Anton): Corvette ZR1 (#6, Grace Tolliver)
  and Corvette Stingray (#53, Etienne Lavoie), sponsor LG (a brand already shipped for Cheongsan Park, copied into `public/assets/sponsors/logos`; `sponsors.js` lets a venue
  brand be a team's title sponsor). Twenty cars. It starts in the Challenger Series, which now has ten cars.
- A quick race leaves the two teams furthest from the player's in the expected order out (`game.js` `racersFor`); the developer viewer still races the first eight.
- No pit box, no venue dress, no driver posters or press photos yet: `tracks/` was not changed, the hoardings put up no board for Tolliver and Lavoie, and the press falls back
  to the circuit. Livery places: `livery.js` `FIT.zr1` (the bonnet lockup on the nose, clear of the carbon hood vent) and `FIT.stingray` (the flank sponsor forward of the side intake).
- Logos: `track-viewer/scripts/build-team-logo-steelhead.py` (see assets/teams/logos/README.md). Car stills: `make-ui-stills.mjs` cars, side and thumbs with `ONLY=zr1,stingray`.
- Career: schema 14 adds the team to an old save, and the first season's grace keeps a new driver racing in the Challenger of ten; both and the balance are in
  track-viewer/docs/career-mode.md. QA shots at 1600x900 and 390x844: `track-viewer/qa/team-steelhead/shots.mjs`.
