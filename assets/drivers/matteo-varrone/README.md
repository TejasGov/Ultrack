# Driver intro concept 01 — Matteo Varrone

One driver for visual approval. Fictional Matteo Varrone, Saetta #7, Italian,
26, driving the Lamborghini Aventador / AV–12. Title partner: Ray-Ban.

The original illustration was generated with the built-in imagegen tool. It uses
the graphic, inked and cel-shaded visual language of GTA V loading screens, with
an original character rather than a real driver's likeness. The user's reference
images informed the title hierarchy and intro format; they were not face inputs.

Racing Sans One lettering is outlined from the team's actual bundled font.
Saetta, Ray-Ban and Lamborghini artwork comes from the existing project assets.
The name, branding, data and illustration remain separate in the web composition.

- `/driver-intro.html`: an 8-second motion preview, replay control and poster download.
- `poster-v1.png`: 1920×1080 final static frame for review.
- `poster-v1.svg`: self-contained layout with outlined lettering and embedded artwork.
- `illustration-v1.webp`: compressed web artwork (about 363 KB).
- `source/illustration-v1.png`: untouched generated source, excluded from public sync.
- `intro.json`: roster snapshot, source hash, output hashes and review status.

Motion is a camera settle and staggered graphic reveals. The illustrated driver
is not a skeletal character animation. Reduced-motion settings show the static
composition. This concept does not automatically play during races; the rest of
the driver series waits for the user's style approval.

Rebuild the composition without generating new art:

```powershell
node track-viewer/scripts/prepare-driver-intro.mjs
npm --prefix track-viewer run sync
```
