# Final driver poster batch

Four Luna agents prepared prompts, canonical metadata and reproducible compositors. The coordinator alone made the four built-in image generation calls: one per driver, no retries, edits or discarded generations. Agents did not call any image generation service. This separates generation from parallel composition and prevents repeated calls during output recovery.

| Driver | Team / number | Car | Sponsor | Font | Exact prompt |
| --- | --- | --- | --- | --- | --- |
| Cole Maddox | Liberty / 66 | Ford Mustang GT (2018) | Coca-Cola | Graduate | [Prompt](cole-maddox/source/prompt-used.txt) |
| Wade Hollis | Liberty / 76 | Hennessey Blackbird | Coca-Cola | Graduate | [Prompt](wade-hollis/source/prompt-used.txt) |
| Zayn Kareem | Sarab / 3 | McLaren 720S | Emirates | Lalezar | [Prompt](zayn-kareem/source/prompt-used.txt) |
| Layla Qasimi | Sarab / 33 | Porsche 911 Turbo S (992) | Emirates | Lalezar | [Prompt](layla-qasimi/source/prompt-used.txt) |

Each driver directory contains an untouched generated source PNG, art direction record, own build helper, opaque 1920 × 1080 final PNG, self-contained SVG, compressed WebP and canonical metadata with SHA-256 hashes. Names and brand marks use local font outlines and assets. The coordinator reviewed all final posters and adjusted text contrast/weight and sponsor layout in code, without regenerating art.

Review: http://127.0.0.1:5180/driver-posters.html — all 14 roster drivers now have posters. New additions await user review. This gallery is separate from automatic game intro playback; the game does not preload these posters at startup.

Validation: `node track-viewer/scripts/verify-driver-posters.mjs cole-maddox wade-hollis zayn-kareem layla-qasimi`. Contact sheet: `batch-03-review.webp`.
