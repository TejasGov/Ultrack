// Run a browser QA command under a machine-wide lock, so parallel agents never run two headless Chromes at once
// (heat on this PC, and frame timings measured while another browser renders are worthless).
//   node scripts/qa-lock.mjs -- node scripts/qa-tokyo-views.mjs http://127.0.0.1:5180 night
// The lock is the directory qa/.browser-lock (mkdir is atomic); a lock older than 20 min is treated as stale.
import { mkdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const lock = join(dirname(fileURLToPath(import.meta.url)), '..', 'qa', '.browser-lock');
const cmd = process.argv.slice(process.argv.indexOf('--') + 1);
if (!cmd.length || process.argv.indexOf('--') < 0) { console.error('usage: node scripts/qa-lock.mjs -- <command...>'); process.exit(2); }

const take = () => {
  try { mkdirSync(lock); writeFileSync(join(lock, 'owner.txt'), `${process.pid} ${cmd.join(' ')}\n`); return true; } catch {}
  try { if (Date.now() - statSync(lock).mtimeMs > 20 * 60e3) { rmSync(lock, { recursive: true, force: true }); console.warn('qa-lock: removed a stale lock'); } } catch {}
  return false;
};
const t0 = Date.now();
while (!take()) {
  if (Date.now() - t0 > 60 * 60e3) { console.error('qa-lock: waited an hour, giving up'); process.exit(3); }
  await new Promise((r) => setTimeout(r, 3000));
}
if (Date.now() - t0 > 3000) console.log(`qa-lock: waited ${Math.round((Date.now() - t0) / 1000)} s`);
const release = () => rmSync(lock, { recursive: true, force: true });
process.on('SIGINT', () => { release(); process.exit(130); });
const child = spawn(cmd[0] === 'node' ? process.execPath : cmd[0], cmd.slice(1), { stdio: 'inherit' });   // no shell: arguments pass through intact (run node scripts, not npx)
child.on('exit', (code) => { release(); process.exit(code ?? 1); });
