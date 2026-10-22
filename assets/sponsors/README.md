# Venue logo artwork

Original logo artwork added for the user's local noncommercial Ultrack fan project
on 2026-10-20. These marks identify their respective owners; they are not Ultrack
branding and do not imply sponsorship or endorsement. Noncommercial use is not
recorded here as a blanket license grant.

| Former venue alias | Displayed brand | Artwork source |
| --- | --- | --- |
| VOLTRAVA | Red Bull | Simple Icons |
| KESTROVA | Pirelli | Pirelli official website |
| AZURINE | Emirates | Simple Icons |
| MERIDAX | HSBC | Simple Icons |
| DUNEFIZZ | Coca-Cola | Simple Icons |
| HALCYRA | Rolex | Wikimedia Commons, source Rolex SA |
| ORVANE | Shell | Simple Icons |

Car-brand boards use original Ferrari, McLaren, Lamborghini, Porsche, Aston Martin,
Bugatti, Mercedes-AMG and BMW M artwork from the
[car-logos-dataset](https://github.com/filippofilip95/car-logos-dataset).
The other vector collection is [Simple Icons](https://github.com/simple-icons/simple-icons).
Pirelli's source is [its official logo asset](https://www.pirelli.com/global/en-ww/assets/images/pirelli-logo.png).
Rolex uses the [original wordmark file](https://commons.wikimedia.org/wiki/File:Rolex_wordmark_logo.svg).

`manifest.json` records the exact download URL and SHA-256 of each retained source.
`sources/` holds originals; `logos/` contains normalized local PNGs; `boards/`
contains aspect-correct compositions. Logos retain their shape; light backgrounds
are used where the supplied black wordmarks need contrast. No runtime CDN is used.

Saetta's title sponsor is **Ray-Ban**, using the original artwork from the
[EssilorLuxottica Vision Source brand guide](https://visionsourceshowcase.luxottica.com/ray-ban-2/).
The retained JPG includes a footer; `sourceCrop` in the manifest selects the logo
panel for the normalized texture. This mark is used on team liveries and garage
headers (`usage: team-sponsor`, `venue: false`); the existing venue boards retain
their own brands. Liberty keeps Coca-Cola. Source URL and SHA-256 are recorded
alongside the other artwork.

The existing source venue was updated through `scripts/apply-venue-logos.py`:
67 shared mesh definitions / 349 placed sign instances were replaced, preserving
their object transforms. Coverage includes fence/LED boards, grandstand fascia,
billboards, bridge/gantry banners, pole banners and run-off paint. Ultrack and
Corniche Marina's own branding remains. Collision geometry is untouched.

`tracks/marina/brand_art.py` also supplies these assets to future source builds.
Both WebP and KTX2 exports contain the artwork. `test:sponsors` verifies all 15
brands, source hashes, UVs and removal of the former sponsor lettering.
