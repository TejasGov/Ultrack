import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { readFile } from 'node:fs/promises';
const server = await createServer({ root: new URL('../', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'), configFile: false, server: { middlewareMode: true, hmr: false }, appType: 'custom' });
try {
  const teams = JSON.parse(await readFile(new URL('../../assets/teams/teams.json', import.meta.url), 'utf8'));
  const { carProgression, canSelectCar, playerLevel, teamHistory, testingUnlockAll } = await server.ssrLoadModule('/src/game/progression.js');
  const { store } = await server.ssrLoadModule('/src/game/store.js');
  assert.equal(testingUnlockAll, true);
  assert.equal(playerLevel({}), 1, 'Existing saves start at level 1');
  for (const t of teams.teams) {
    assert(teamHistory(t.id).story && teamHistory(t.id).status);
    for (const c of t.cars) {
      const { level, rank } = carProgression(c.key);
      assert(rank && Number.isInteger(level) && level > 0);
      assert(canSelectCar(c.key, {}), 'Every roster car is open during testing');
      assert.equal(canSelectCar(c.key, { playerLevel: level - 1 }, false), level === 1);
      assert(canSelectCar(c.key, { playerLevel: level }, false));
      assert(store.selectCar(c.key), 'Garage selection uses the shared access rule');
    }
  }
  assert.throws(() => carProgression('missing'));
  console.log(`PASS: all ${teams.teams.flatMap((t) => t.cars).length} cars, ${teams.teams.length} team histories, old saves, test unlocks and launch level boundaries.`);
} finally { await server.close(); }
