# Ultrack team identities

Eight original emblems and wordmarks use the colors and typefaces in `../teams.json`.
Lettering is outlined into SVG paths at build time. Masters contain no external
fonts, raster images or scripts. These original team identities are separate from
third-party sponsor logos.

| Team | Emblem | Lettering |
| --- | --- | --- |
| Saetta | Lightning bolt | Racing Sans One |
| Corvid | Angular raven | Cinzel 900 |
| Mojave | Desert sunrise | Bungee |
| Aurum | Art Deco A in a lozenge | Limelight |
| Liberty | Winged star | Graduate, reinforced strokes |
| Toro | Bull head | Unbounded Black |
| Sarab | Falcon above a dune | Lalezar |
| Hayate | Kazaguruma (wind pinwheel) mon crest | Dela Gothic One: 疾風 + HAYATE + ハヤテ |

Each identity has a horizontal lockup (1024×256) and emblem (256×256), with
`onTeam`, `onDark` and `onLight` variants. SVG masters, transparent PNG and
lossless WebP are retained. Typeface OFL notices remain with the bundled fonts
in `track-viewer/public/assets/fonts/`.

`manifest.json` records metadata and source/export hashes. `runtime.json` is a
compact registry with content-versioned WebP URLs. The canvas loader shares one
image request per team/variant; the browser caches the same assets for DOM logos.
The canvas pipeline no longer waits for the seven team fonts. Common fonts used
for numbers and other copy remain.

Liveries use the lockups on bonnet, rear deck and rear bumper. Garage headers,
pit-box markings, flags and team banners use the same artwork. Main-menu and
setup cards, garage headings and the garage list use the dark-background version.
Team names remain available as image alt text.

`scripts/build-team-logos.py` needs the Toro emblem entry in its `EMBLEMS` table (the bull head in the table above); the PNG/WebP, review sheet and gallery come from `prepare-team-logos.mjs`, whose title strings ("Seven teams", "7 original emblems") are hard-coded.

Rebuild from the project root:

```powershell
python scripts/build-team-logos.py
node track-viewer/scripts/prepare-team-logos.mjs
npm --prefix track-viewer run sync
npm --prefix track-viewer run test:team-logos
```

Python dependencies: fonttools and brotli. Raster exports use the project's sharp.
Review and download the identities at `/team-brand-guide.html`. `review.png` is a
contact sheet. Asset and canvas checks do not replace an in-game visual review
of placement on every model.

Hayate (Japanese, sponsor Sony) is built by `track-viewer/scripts/build-team-logo-hayate.py` (the root `scripts/build-team-logos.py` has no Hayate entry and
was left alone: do not rerun it expecting Hayate), then `prepare-team-logos.mjs` as above. Besides the usual three variants it has a `kanji` variant of
square 256 px decals that the livery draws (`num23`, `num37`: kanji number roundels; `katakana`: the ソニー plate), loaded through `loadTeamExtras()` in
`src/team-logos.js`. Its font file is a subset of Dela Gothic One (Latin plus the glyphs used; re-subset the full font from Google Fonts
before using a new glyph in a wordmark). No rising-sun motif is used anywhere.
