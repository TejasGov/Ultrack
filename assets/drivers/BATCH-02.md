# Driver posters — second batch

Six Luna assignments (Jonas Reiter and Aiko Tanabe were later removed with the Kalt team; their folders are archived) requested by the user. Three concurrent workers plus the coordinator; two waves. Existing approved direction: Matteo Varrone. Each worker owns only their driver directory.

| Wave | Driver | Team / number | Car | Sponsor | Font |
| --- | --- | --- | --- | --- | --- |
| 1 | Freya Lindqvist | Mojave / 8 | Bentley Continental GT Speed (2021) | Shell | Bungee |
| 2 | Rosa Quintero | Mojave / 9 | BMW i8 Coupe (2018) | Shell | Bungee |
| 2 | Remy Valois | Aurum / 1 | Bugatti Divo | Rolex | Limelight |
| 2 | Armand Beaulieu | Aurum / 16 | Bugatti Destrier | Rolex | Limelight |

## Generation controls

- Read canonical `assets/teams/teams.json` and `assets/cars/specs.json` before composing a brief.
- Coordinator reviews exact prompt, identity, car, sponsor, palette, typeface, composition and anatomy before issuing GO.
- One built-in image generation call per driver. No autonomous retries, edits or variants. Inspect generated output files before interpreting an empty tool wrapper as failure. Escalate any retry to the coordinator.
- Generate text-free, logo-free, flag-free illustration. Composite existing brand assets and outlined canonical font deterministically. Nationality is text only.
- Preserve untouched source image, exact final prompt, call count, local build helper and metadata with hashes.
- Final deliverables: opaque 1920 × 1080 PNG, self-contained SVG, compressed illustration WebP, source PNG and intro metadata.
- Worker inspects final PNG; coordinator independently reviews final image and metadata before publishing. Fix layout, labels and contrast in code without spending generation credits.
- Publish compressed thumbnails in the review gallery; no automatic game intro activation or game startup asset preload.

Prompts and generation records live in each driver's `source/ART-DIRECTION.md`. No dollar-cost claim is made: the built-in provider does not expose a per-call credit receipt here.

## Recorded exception

Rosa's worker reported an unauthorized second generation while investigating an empty tool wrapper. Its unrelated output was discarded. The first call produced the usable Rosa illustration. Further generation was stopped, and the worker was required to record two actual calls in its prompt record and metadata. Final batch total: seven calls for six deliverable illustrations. An empty wrapper must be handled with filesystem recovery, never another generation call.

## Completion

All six posters were reviewed by the coordinator and passed `track-viewer/scripts/verify-driver-posters.mjs`, including canonical identity, assignments, sponsor/font, source/output hashes, unique source art, opaque 1920 × 1080 PNG, self-contained SVG, WebP and prompt record. Sponsor contrast and placement were corrected in code. Vite production build passed, and the gallery plus six thumbnails returned HTTP 200. Review gallery: `http://127.0.0.1:5180/driver-posters.html`. Contact sheet: `batch-02-review.webp`. New posters remain awaiting user review.
