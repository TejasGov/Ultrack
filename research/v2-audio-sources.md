# V2 audio sources and recording handoff

Checked 2026-10-19. No new paid generation, sample-library purchase or bulk sound
download was performed. Current combustion loops and other V1 one-shots remain
until replacement recordings are selected and auditioned.

## Engine Simulator

[Upstream source](https://github.com/ange-yaghi/engine-sim) and its
[MIT license](https://github.com/ange-yaghi/engine-sim/blob/master/LICENSE).
The upstream repository tree was checked through the GitHub API. Useful included
scripts are under `assets/engines/atg-video-2/`:

| Layout | Script | State |
| --- | --- | --- |
| V12 | `12_ferrari_412_t2.mr` | Upstream script exists; record/audition before assigning |
| V10 | `10_lfa_v10.mr` | Upstream script exists; record/audition |
| Flat-plane V8 | `08_ferrari_f136_v8.mr` | Upstream script exists; record/audition |
| Cross-plane V8 | `07_gm_ls.mr` | Upstream script exists; record/audition |
| Flat-six | Porsche boxer-six entries in [Parts Catalog](https://catalog.engine-sim.parts/) | A suitable exact script/version and permission still need selection |
| W16 | Community W16 entries exist in [Parts Catalog](https://catalog.engine-sim.parts/parts?page=83&q=F+W) | No production script selected; verify geometry, sound and permission |

Community scripts do not automatically inherit the simulator's MIT license.
Follow the [community engine loading instructions](https://github.com/Engine-Simulator/engine-sim-community-edition/blob/master/tutorial/02_using_community_engines/02_using_community_engines.md).
Capture stable idle/low/mid/high holds and an overrun/decel take with no voice,
music or UI sounds. Record the actual RPM, script author/version and take timings
in the import plan. A race V12 or LFA simulation is a layout reference, not an
exact recording of a different production car. Mercedes-AMG One also needs a
suitable hybrid V6 source; it should not be assigned the old Jaguar recording
as a final replacement.

## Other effects

[Sonniss GDC archive](https://sonniss.com/gameaudiogdc/) is the planned free route.
The [current bundle license](https://sonniss.com/gdc-bundle-license/) permits
personal/commercial synchronized game use without attribution, but prohibits
standalone sound redistribution and AI training/development uses. Retain the
download-date license and publisher/track provenance for chosen sounds. No year
or vehicle track has been selected yet, so this document makes no per-file claims.

Freesound recordings require per-file checks. Prefer CC0/CC BY where the source
and attribution are clear. No paid library is needed for the code delivered here.
