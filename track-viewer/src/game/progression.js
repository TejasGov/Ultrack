import DATA from '../../../assets/teams/progression.json';

export const testingUnlockAll = DATA.testingUnlockAll;
export const playerLevel = (profile) => Math.max(1, Math.floor(Number(profile?.playerLevel) || 1));
export function carProgression(key) {
  const rank = DATA.cars[key];
  if (!rank || !DATA.ranks[rank]) throw new Error(`Missing car progression: ${key}`);
  return { rank, ...DATA.ranks[rank] };
}
export const teamHistory = (id) => DATA.teams[id];
// Keep the launch rule independently testable while the prototype bypass is on.
export function canSelectCar(key, profile, unlockAll = testingUnlockAll) {
  const { level } = carProgression(key);
  return unlockAll || playerLevel(profile) >= level;
}
