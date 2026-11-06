# Part 1 (web performance): results

Branch `ten-x/web-perf`, measured on the build desktop on 2026-11-06. The spec is `perf-spec.md`; each kept package is one commit whose body holds the full numbers.

How to read the numbers:
- A is the old behaviour (`?perf=<flag>`, or the build before the change), B is the change. Values are medians over the rounds; "spread" is the larger arm's max - min.
- A change counts only when B - A is larger than the spread. Rows marked *point* are one run, not a median.
- Frame times move between sittings by more than any saving here (qingshan tick avg was 8.48 ms in the WP0 sitting and 5.8 to 7.7 ms in later ones), so compare A and B within one row only.
- Boot numbers come from a production build on `vite preview` under CDP throttling (50 Mbit/s down, 40 ms RTT). Frame, stills, leak and hash numbers come from the dev server.

## Every work package

| WP | What | Kept | Measure (A -> B, spread) | Source |
|---|---|---|---|---|
| WP0 | Measurement harness and baseline sitting | yes | Baseline, qingshan race: tick 8.48 avg / 12.6 p95 ms, main-pass draws 421, 12 programs created after the warm-up; leak +961 MB over 3 venue cycles; Start longest task 582 ms | `qa/perf/baseline/`, commit cb1dd77 |
| WP1 | Venue materials leave the singlePass registry on unload | yes | Leak over 3 cycles (llano/marina/qingshan): +960.9 MB -> +1.3 MB (*point*, one run each). Fence singlePass on a second Marina visit: canopy MAD night 0.036, day 0.060 / 0.065, the same as a first visit | `qa/perf/wp1-*.log`, commits a1fd0ae, 512d4eb |
| WP2 | Merge stand-in wheels and the far wheel proxy by material | **no** (patch kept) | Main-pass draws qingshan 416.1 -> 345.9 (spread 0.8), llano 331.9 -> 262.8 (0.2). Tick avg qingshan 6.75 -> 6.50 ms (spread 1.35, 6 rounds) and 7.73 -> 7.51 (7.02, 4 rounds); llano 8.96 -> 7.41 (6.6). Tick p95 qingshan 8.7 -> 8.5 (2.5). Pixels: MAD 0.000; geometry: triangles matched per material. Gate: tick avg beyond the spread. Failed. | `qa/10x-scratch/wp2/frame-*.json`; `docs/10x/wp2-merge-wheels.patch` |
| WP3 | At most one heavy GPU job per frame (`oneHeavy`) | **no** | field.update p95 qingshan 1.75 -> 1.65 ms (spread 0.4), llano 1.25 -> 1.20 (0.3); tick avg qingshan 5.78 -> 5.98 (0.65), llano 5.33 -> 5.37 (0.27); 0 frames over 20 ms in both arms. Gate: field.update p95 beyond the spread. Failed. | `qa/10x-scratch/wp3/frame-*-ab.json` |
| WP4 | The menu warm-up builds and readies every race program | yes | Programs created after the warm-up: 12 -> 0 (qingshan day/dusk, llano day/dusk, marina day/night), info-log reads after it 0. Qingshan, A B A B A B, one round each: Start longest task 309 -> 217 ms (spread 40), Start -> grid 1324 -> 748 ms (241), grid longest frame 75 -> 0 | `qa/10x-scratch/wp4/`, commit ef8d3b5 |
| WP5 | Collision load cached as a promise; void walls memoised per track | yes | Longest task in the 3 s after quitting, qingshan 3 rounds: 184 -> 0 ms (spread 6), world rebuild 184 -> 39 ms; llano 218 -> 0 (59). Collision hashes equal to the baseline on all nine tracks | `qa/perf/wp5/quit-qingshan.json`, commit 608f123 |
| WP6 | Showroom PMREM built during the first car download, not at module evaluation | yes | Marina: first /assets/ fetch 880 -> 380 ms (spread 23), game.loaded 2573 -> 2237 (88), title Ready 3189 -> 2840 (45), boot task 678 -> 181 (19). Qingshan: first fetch 888 -> 384 (41), title Ready 3219 -> 2833 (308), boot task 681 -> 178 (49). Title still MAD 0.000 | `qa/10x-scratch/wp6/`, commit b3d8d59 |
| WP7 | LOD1 car bodies wait for the venue download | yes | Qingshan: preloadDone 16337 -> 14780 ms (spread 176), venueReady 15256 -> 14032 (156), GO 27614 -> 26670 (884); LOD1 in at 15686 ms, before GO. With the garage opened at boot: the first LOD1 request went from 3916 ms (during the venue download) to 14999 / 14906 ms (after venue-ready 13652 / 13673). Race tick 6.44 -> 6.59 ms (spread 0.43): within noise | `qa/perf/wp7/`, `qa/10x-scratch/wp7-polish/`, commits db204b4, 26cd04c |
| WP8 | Venue and collision downloads start at the title; only the parse waits | yes | Qingshan: venueReady 14897 -> 13999 ms (spread 104), preloadDone 15941 -> 15004 (347), GO 27810 -> 26536 (639). Marina: venueReady 8718 -> 7626 (334), preloadDone 10347 -> 9443 (429), GO 22575 -> 21036 (943). One venue and one collision download in all 12 rounds; title task within noise; leak +0.7 MB | `qa/perf/wp8/boot-*.json`, commit 87bd329 |
| WP9 | Car LOD0 fetched ahead of the decode queue (`carPrefetch`) | **no** | Qingshan: preloadDone 15102 -> 15365 ms (spread 524), venueReady 13992 -> 13982 (112), car-ready 2076 -> 2059 (53). Gate: at least 300 ms off preloadDone. Failed. | `qa/perf/wp9/boot-qingshan.json` |
| WP10 | Freeze static venue matrices (`freezeVenue`) | **no** | Upper bound (every venue node frozen, no live-node registration): matrixWorld 0.35 -> 0.31 ms (spread 0.02), tick avg 6.25 -> 6.38 (0.73). Gate: at least 0.2 ms off matrixWorld. Even the upper bound misses it, so the full version was not built. | `qa/10x-scratch/wp10/frame-qingshan-ab-upper.json` |

`qa/perf/wp*` and `qa/10x-scratch/` are local measurement folders (not committed); the commit bodies hold the same numbers.

## Spec targets (section 4)

| Measure | Target | Result |
|---|---|---|
| Qingshan race tick avg / p95 | <= 7.8 / <= 10.5 ms | Not reached by any change: WP2 and WP3 were within noise. Later sittings sat at 5.8-7.7 ms for A and B alike, which is machine state, not a saving. |
| Qingshan field.update p95 | <= 1.5 ms | Not reached (WP3 dropped). |
| Main-pass draws, qingshan race | <= 300 | 416 on the branch; 346 with the WP2 patch. |
| Llano frames over 20 ms | <= 5 | The WP0 sitting already had 1 of 721; not a gate here. |
| Programs created after the warm-up | 0 | 0 (WP4). |
| Leak, 3 cycles | < 40 MB | +1.3 MB (WP1). |
| Longest task 3 s after quit | <= 150 ms | 0 ms (WP5). |
| Qingshan 50 Mbit Enter -> preload done | <= 14 s | 15.0 s (WP8 sitting) and 14.8 s (WP7 re-run). Close, not reached. The baseline was 18.1 s. |
| First /assets/ request (50 Mbit) | <= 700 ms | 380 ms marina, 384 ms qingshan (WP6). |

## How to re-run

From `track-viewer`, with every browser run under the lock: `node D:/RaceUltimate/track-viewer/scripts/qa-lock.mjs -- node <script> ...`.

- Dev server for frame, stills, leak and hash: `npm run dev` (port 5180, the default of these scripts), or Vite on your own port and `--url`.
- Production build for boot: `npx vite build --outDir qa/10x-scratch/dist`, then `npx vite preview --host 127.0.0.1 --port 5391 --strictPort --outDir qa/10x-scratch/dist` (perf-boot's default URL).

| WP | Command |
|---|---|
| WP0 | `scripts/perf-frame.mjs qingshan --rounds 4`; `scripts/perf-frame.mjs qingshan --programs`; `scripts/perf-leak.mjs --cycles 3`; `scripts/perf-boot.mjs qingshan --rounds 3`; `npm run test:collision-hash` |
| WP1 | `scripts/perf-leak.mjs --cycles 3` (exit 0 under 40 MB); `scripts/perf-ab.mjs marina night,day --off singlePass --revisit llano --url <dev>`; `scripts/qa-track-switch.mjs <dev>` |
| WP2 | `git apply` the patch, then `scripts/perf-frame.mjs qingshan --ab-load mergeWheels --rounds 6` and the same for `llano`; pixels: `scripts/perf-stills.mjs qingshan --save <A> --query perf=mergeWheels --looks day,night`, the same without `--query` to `<B>`, `scripts/pixel-diff.mjs <A> <B>`; geometry: `perf-stills --dump-wheels` in both sessions, then `--compare-wheels` |
| WP3 | Not on the branch; the prototype lived in local scratch only. It was `perf-frame.mjs <track> --ab oneHeavy --rounds 6` |
| WP4 | `scripts/perf-frame.mjs <track> --look <look> --rounds 2 --programs` (exit 0); `scripts/perf-boot.mjs qingshan --rounds 1` against builds of the commit before and after, alternated |
| WP5 | `scripts/perf-frame.mjs qingshan --quit --rounds 3`; `npm run test:collision-hash` |
| WP6 | `scripts/perf-boot.mjs <track> --ab-load lazyRoomEnv --rounds 3`; `scripts/perf-stills.mjs qingshan --title` in two sessions |
| WP7 | `scripts/perf-boot.mjs qingshan --ab-load farAfterVenue --rounds 3`; `scripts/perf-boot.mjs qingshan --garage 8000 --rounds 2` (exit 1 if a LOD1 body is requested before venue-ready); `scripts/perf-frame.mjs qingshan --ab-load farAfterVenue --rounds 4 --frames 600` |
| WP8 | `scripts/perf-boot.mjs <track> --ab-load earlyBytes --rounds 3` (exit 1 unless one venue and one collision download per round); `scripts/perf-leak.mjs --cycles 3` |
| WP9, WP10 | Not on the branch. They were `perf-boot.mjs qingshan --ab-load carPrefetch --rounds 3` and `perf-frame.mjs qingshan --ab freezeVenue --rounds 6` |

Regression suite after each package: `npm run test:v2`, `test:loading` (now includes `test-first-use.mjs`), `test:race-loading`, `test:sectors`, `test:hud`, and the physics-harness output against `phys-base.txt`.

## Physics and driving feel

`src/physics/vehicle.js`, the assists, handling and step rate are unchanged. `src/carkit` is unchanged. `src/physics/world.js` did change (WP5 and WP8: the collision load is cached as a promise, void walls are memoised per track, and `PhysicsWorld.preload` starts the download early). It builds the same world: test-collision-hash matches the baseline hashes on all nine tracks for the first and second build, and the physics-harness output is byte-identical to the baseline.

## Still unmeasured

- Any device other than this desktop: no laptop, Mac or integrated-GPU frame times. The bench moves about 2.5 ms between runs on this machine, which hides savings under 1 ms here that a slower machine might show.
- A real network: every boot number is CDP throttling against `vite preview`, not the Vercel/R2 deployment with its redirects and caching.
- Players who stay on the title or in the menu longer than the harness: WP8 gains more for them (up to the venue's download time), not measured.
- Tracks other than qingshan, llano and marina for frame time and boot; the collision hash and track switch cover all nine.
- GPU time per pass: the frame numbers are CPU time around the calls.
- The spec's account-side proposals (R2 custom domain, gzip and cache headers, preconnect) and the `GL_INVALID_OPERATION` texture-format errors at race start: not started.
