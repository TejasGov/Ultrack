# Tokyo panorama: provenance

Generated 2026-10-22 with ElevenLabs (FLUX 3 Image, 4K, 21:9; 4,944 credits each, 29,667 credits for six, approved by the user in chat). Flow: https://elevenlabs.io/app/flows/KqPD39Snas8svCxDG82b

- **Day A, B, C:** three segments of a 360° Tokyo Bay skyline at late afternoon.
  - Day A has Tokyo Tower and a faint Fuji.
  - B continues to the right of A.
  - C closes the ring between B and A.
- **Night A, B, C:** the same layouts at night, each generated from its day segment as a reference, so dusk can blend day and night.

Originals are in `gen/` (6256×2688 PNG). The game band is built from them by stitching with cross-faded seams, taking the sky above the skyline to alpha so the game's own sky shows, and putting haze at the base.

The prompts are on the flow nodes.
