// bmw1 (Mercedes-AMG GT4 model): per side a slim wing-shaped lamp wrapping the corner: two thin red light guides (the running
// light, brighter on the brake) above and below a row of LEDs in a red reflector body (the brake); a third brake light across
// the deck edge, red reflectors low on the bumper. The model is layered: tail|emiss_Lights the two guide strips (28 %, map and
// emissive map), keep|Lights the lamp body, the third brake light, the star badge and the reflectors (one atlas),
// keep|light_glass the lamp lens (44 % black). Before, only the strips lit (pink-white on the brake) and the body stayed an
// unlit texture. Here keep|Lights is adopted behind x 1.5 and outside the centre (adopt.box, |z| > 0.3): the body (one
// component) is the brake fill, lit through its atlas (`tex`), the strips the guides, the lens smoked; the star badge and the
// third brake light keep the model's own material (they were adopted as unlit lamp parts before 2026-10-31; the stills show
// no difference, the badge is simply no lamp element any more).
// Judgement calls and limits: the atlas's LED row is pink-white, so `tex` (red texels only) leaves those dots as darker cups in
// the lit body (visible only up close); the third brake light is a grey clear-lens texture `tex` cannot light, so it stays
// unlit, like the reflectors (tex.base white keeps their look as the model drew it); no
// reverse lamp (none on the model, and white `tex` texels would light the star and the stop bar). The atlas reds are dark
// (hi 0.15) and the strips 2 cm tall (run raised). LOD 1 (45 m+) lights the strips only (the body merges below minTris).
// QA 2026-10-30 (qa/taillights/bmw1-before|after, bmw1-before-after[-highlights].jpg): day a red textured lamp under a glossy
// smoked lens, brake the body red with LED dots; dusk and night the guides running, a clear brake step at chase, red points
// and the pool at 20 m, red streaks on a wet road; no pink, no halo. A large warm glow low on the bumper at night (standing
// still) is in the before too. Plain data, no imports: qa-taillights.mjs reads it.
export default {
  tail: [
    { material: /^tail\|/, part: 'guide', glow: 0.4 },                 // the two light guides
    { material: /^keep\|Lights$/, minTris: 200, part: 'fill', glow: 0.3 },   // the lamp body
    { part: 'off' },                                                    // the reflectors low on the bumper
  ],
  adopt: { material: /^keep\|Lights$/, minX: 1.5, box: [[1.5, 0, 0.3], [2.4, 1.2, 1.2]] },   // the lamp bodies and reflectors; the star and the third brake light (|z| < 0.3) stay the model's
  tex: { base: 0xffffff, hi: 0.15 },     // unlit, the atlas shows as the model drew it; its reds are dark (linear ~0.15): full weight there
  lens: { material: /^keep\|light_glass$/, minX: 1.5 },
  spill: true,
  levels: { run: [0.13, 0.6] },          // the guides are 2 cm strips: at AV-12's level they vanished after dark
  qa: { macro: [2.03, 0.73, 0.64] },
};
