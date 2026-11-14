// Quick race difficulty (store.settings.difficulty; the race setup's Easy / Medium / Hard). A rival's pace is the share of the AI speed plan it
// drives (src/physics/driver.js). Rivals hold the speed of the car ahead rather than pass it, so the grid order decides the race: with the slowest
// rival on pole the whole pack runs at its pace and the player, who passes at will, wins from last (Easy, the quick race before this setting).
// Medium and Hard put the quickest rival on pole and the rest in falling pace behind it, so the leader is a real target; Hard's rivals fire nitro on
// the straights too. Grid index k is 1-7 from the front (cars.js grid: the player starts last). Tuned with scripts/race-sim.mjs (2026-11-13,
// 12 races a row: India, Shajawa, Dry Lake, Tokyo, 3 laps). The sim's player is the AI driver at pace 1.03 (it overdrives above that); a player who
// finds Easy a 92% win in the Jesko is that plus 1.8 s a lap, and wins: Easy 92% Jesko / 25% BMW, Medium 67% / 17%, Hard 42% / 0%
// (the Jesko is the quickest car, the BMW the entry car; a quick race's rivals are the nearest teams' first cars, so the BMW meets hypercars).
export const DIFFICULTY = {
  easy: { label: 'Easy', fastFirst: false, base: 0.93, step: 0.012, rivalNitro: false, desc: 'The pack stays together behind a steady leader. Room to learn.' },
  medium: { label: 'Medium', fastFirst: true, top: 0.98, step: 0.01, rivalNitro: false, desc: 'The quickest rival starts on pole. Catch it to win.' },
  hard: { label: 'Hard', fastFirst: true, top: 1.0, step: 0.006, rivalNitro: true, desc: 'Rivals as quick as you, with nitro. Wins are rare.' },
};
export const difficultyOf = (k) => DIFFICULTY[k] ?? DIFFICULTY.medium;
/** a quick-race rival's pace at grid index k (1 = pole) */
export const rivalPace = (cfg, k) => (cfg.fastFirst ? cfg.top - cfg.step * (k - 1) : cfg.base + cfg.step * k);
