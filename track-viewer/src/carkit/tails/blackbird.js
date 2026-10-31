// blackbird (Blackbird-X, a Venom F5 model): per side a half-moon lamp, a U-shaped red light guide (a half torus) behind
// radial fins round a dark centre: the running light, brighter on the brake; red reflector bars low on the diffuser (unlit).
// The model is layered: tail|Material.008 is a 66 % red lens over the guide, tail|Material.009 the guide (base red, its
// emissive map a red-to-black gradient that shades the tube); keep|Material.006 the reflector bars (opaque red); the fins are
// keep|Material.004 (body grey). Before, the game lit the 66 % lens as an opaque lamp (pink-white discs on the brake, a halo
// over the fins) and the reflector bars kept their flat bright red. Here the lens is the smoked rearLens and the guide wears
// its own emissive map through `tex` (the gradient lights the tube's ridge, its inner face falls off), the bars a deep red.
// Judgement calls: one element per side (the model has no separate stop or reverse element, the real car's reverse lamp is
// not modelled), so the brake is the guide's step up; default levels (the U is a larger emitter than AV-12's guides, and
// brighter at night it went orange). QA 2026-10-30 (qa/taillights/blackbird-before|after, blackbird-before-after[-highlights]
// .jpg): day a smoked lens with a faint red U, brake a clear red U; dusk and night a red U, the brake step obvious at chase,
// red points with the pool at 20 m, red streaks on a wet road; no pink, no halo. Plain data, no imports: qa-taillights.mjs reads it.
export default {
  tail: [
    { material: /^tail\|Material\.008$/, part: 'lens' },
    { part: 'guide' },
  ],
  tex: { material: /^tail\|Material\.009$/, map: 'emissiveMap' },
  dark: /^keep\|Material\.006$/, darkColor: 0x4a0508,
  spill: true,
  qa: { macro: [2.33, 0.66, 0.66] },
};
