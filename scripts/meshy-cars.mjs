import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RESOURCE = 'multi-image-to-3d';
const COMMON = ['--output-schema', 'v1', '--format', 'json', '--no-update-check'];
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
function write(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(temp, JSON.stringify(data, null, 2) + '\n');
  fs.renameSync(temp, file);
}

export function parseArgs(args) {
  const options = { command: 'plan', limit: 3, ids: null, maxCredits: null };
  if (args[0] && !args[0].startsWith('--')) options.command = args.shift();
  if (!['plan', 'run', 'status', 'help'].includes(options.command)) throw Error('Use plan, run, status, or help.');
  while (args.length) {
    const flag = args.shift();
    const value = args.shift();
    if (!value || value.startsWith('--')) throw Error(`Missing value for ${flag}`);
    if (flag === '--limit') options.limit = Number(value);
    else if (flag === '--ids') options.ids = value.split(',');
    else if (flag === '--max-credits') options.maxCredits = Number(value);
    else throw Error(`Unknown option ${flag}`);
  }
  if (!Number.isInteger(options.limit) || options.limit < 1) throw Error('--limit must be a positive integer.');
  if (options.maxCredits !== null && (!Number.isFinite(options.maxCredits) || options.maxCredits < 0)) throw Error('Invalid --max-credits.');
  return options;
}

export function selectCars(cars, records, options) {
  const blocked = Object.entries(records).filter(([, r]) => ['submitting', 'submission_unknown'].includes(r.status));
  if (blocked.length) throw Error(`Resolve uncertain submission before proceeding: ${blocked.map(([id]) => id).join(', ')}. Inspect its operation ID and submission logs; do not create a replacement task.`);
  const existing = cars.filter(c => records[c.id]?.taskId && !['downloaded', 'failed'].includes(records[c.id].status));
  if (existing.length > 3) throw Error('More than three unfinished recorded cars; reconcile remote tasks before proceeding.');
  const wanted = options.ids ? new Set(options.ids) : null;
  if (wanted) {
    for (const id of wanted) if (!cars.some(c => c.id === id)) throw Error(`Unknown car ${id}`);
    const excluded = existing.filter(c => !wanted.has(c.id));
    if (excluded.length) throw Error(`Resume unfinished cars first: ${excluded.map(c => c.id).join(', ')}`);
  }
  if (existing.length > options.limit) throw Error('--limit must include all unfinished recorded cars.');
  const pending = cars.filter(c => (!wanted || wanted.has(c.id)) && !records[c.id]);
  // An existing failure is never turned into a new paid request automatically.
  return [...existing, ...pending.slice(0, Math.max(0, options.limit - existing.length))];
}

export async function runPool(items, concurrency, work) {
  if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 3) throw Error('Concurrency must be 1–3.');
  let next = 0;
  let stopped = false;
  const errors = [];
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (!stopped && next < items.length) {
      const item = items[next++];
      try { await work(item); }
      catch (error) { stopped = true; errors.push({ id: item.id, error }); }
    }
  });
  // Already running work is drained even if another car fails. Nothing new starts.
  await Promise.allSettled(workers);
  if (errors.length) throw new AggregateError(errors.map(e => e.error), errors.map(e => `${e.id}: ${e.error.message}`).join('\n'));
}

function resolveCli() {
  const output = process.platform === 'win32'
    ? execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', 'npm.cmd exec --yes --package=meshy-cli@0.4.0 -- where.exe meshy'], { encoding: 'utf8', windowsHide: true })
    : execFileSync('npm', ['exec', '--yes', '--package=meshy-cli@0.4.0', '--', 'which', 'meshy'], { encoding: 'utf8' });
  for (const line of output.split(/\r?\n/).map(s => s.trim()).filter(Boolean)) {
    const real = fs.realpathSync(line);
    const candidates = [path.resolve(path.dirname(line), '..', 'meshy-cli'), path.resolve(path.dirname(real), '..')];
    for (const dir of candidates) {
      const file = path.join(dir, 'package.json');
      if (!fs.existsSync(file)) continue;
      const pkg = read(file);
      if (pkg.name === 'meshy-cli' && pkg.version === '0.4.0') return path.resolve(dir, pkg.bin.meshy);
    }
  }
  throw Error('Cannot locate meshy-cli 0.4.0. Run npm exec --yes --package=meshy-cli@0.4.0 -- meshy --version.');
}

function cli(entry, args, outputRoot, logPrefix) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [entry, ...args, ...COMMON, '--workspace', outputRoot], {
      cwd: ROOT, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe']
    });
    let stdout = '', stderr = '';
    child.stdout.on('data', chunk => { stdout += chunk; });
    child.stderr.on('data', chunk => { stderr += chunk; });
    child.once('error', reject);
    child.once('close', code => {
      if (logPrefix) {
        fs.mkdirSync(path.dirname(logPrefix), { recursive: true });
        fs.writeFileSync(`${logPrefix}.stdout.json`, stdout);
        fs.writeFileSync(`${logPrefix}.stderr.log`, stderr);
      }
      let envelope;
      try { envelope = JSON.parse(stdout.trim()); }
      catch { return reject(Object.assign(Error(`Meshy returned no usable JSON (exit ${code}); inspect local logs.`), { exitCode: code })); }
      // An accepted JSON result survives a Node teardown error; never retry its POST.
      resolve({ code, envelope });
    });
  });
}

function requireOk(result, label) {
  if (!result.envelope?.ok) throw Object.assign(Error(`${label}: ${result.envelope?.error?.code ?? 'CLI error'}; inspect local logs.`), { exitCode: result.code, envelope: result.envelope });
  return result.envelope.result;
}

function fingerprint(car, generation) {
  return sha(JSON.stringify({ source: car.sourceSha256, views: car.views.map(v => v.sha256), generation }));
}

function validateInputs(cars) {
  for (const car of cars) {
    if (!/^[a-z0-9-]+$/.test(car.id)) throw Error('Invalid car ID.');
    if (sha(fs.readFileSync(path.resolve(ROOT, car.source))) !== car.sourceSha256) throw Error(`Source changed: ${car.id}. Prepare references again.`);
    if (car.views.length < 1 || car.views.length > 4 || car.views[0].view !== 'front') throw Error(`Invalid view order: ${car.id}`);
    for (const view of car.views) {
      if (sha(fs.readFileSync(path.resolve(ROOT, view.path))) !== view.sha256) throw Error(`Prepared view changed: ${car.id}/${view.view}. Prepare references again.`);
    }
  }
}

function glbSummary(file) {
  const bytes = fs.readFileSync(file);
  if (bytes.toString('ascii', 0, 4) !== 'glTF' || bytes.readUInt32LE(4) !== 2 || bytes.readUInt32LE(8) !== bytes.length) throw Error('Invalid downloaded GLB header.');
  let doc;
  for (let offset = 12; offset + 8 <= bytes.length;) {
    const length = bytes.readUInt32LE(offset), kind = bytes.readUInt32LE(offset + 4);
    if (offset + 8 + length > bytes.length) throw Error('Truncated GLB chunk.');
    if (kind === 0x4e4f534a) { doc = JSON.parse(bytes.toString('utf8', offset + 8, offset + 8 + length)); break; }
    offset += 8 + length;
  }
  if (!doc) throw Error('Missing GLB JSON.');
  const meshes = (doc.meshes ?? []).map(mesh => (mesh.primitives ?? []).reduce((sum, p) => {
    const accessor = p.indices ?? p.attributes?.POSITION;
    const count = doc.accessors?.[accessor]?.count ?? 0;
    const mode = p.mode ?? 4;
    return sum + (mode === 4 ? Math.floor(count / 3) : [5, 6].includes(mode) ? Math.max(0, count - 2) : 0);
  }, 0));
  const triangles = (doc.nodes ?? []).reduce((sum, n) => sum + (meshes[n.mesh] ?? 0), 0);
  return {
    bytes: bytes.length, trianglesAcrossMeshNodes: triangles,
    meshes: meshes.length, materials: (doc.materials ?? []).length,
    nodeNames: (doc.nodes ?? []).map(n => n.name ?? ''),
    hasNormalMap: (doc.materials ?? []).some(m => !!m.normalTexture),
    hasMetallicRoughnessMap: (doc.materials ?? []).some(m => !!m.pbrMetallicRoughness?.metallicRoughnessTexture),
    warning: 'Structural inspection only. Wheel separation/pivots, glass, normals and moving reflections require visual review. Mesh nodes include inactive scenes; GPU instancing is not expanded.'
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.command === 'help') {
    console.log('node scripts/meshy-cars.mjs plan [--limit 3] [--ids furari-488,lambo2,mclaren]\nnode scripts/meshy-cars.mjs run --limit 3 --max-credits 90\nnode scripts/meshy-cars.mjs status\nRun resumes unfinished tasks and selects the next unsubmitted cars, up to --limit. It never automatically regenerates failures.');
    return;
  }
  const config = read(path.join(ROOT, 'meshy', 'cars.json'));
  const prepared = read(path.join(ROOT, 'meshy_output', 'prepared-references.json'));
  if (config.concurrency !== 3) throw Error('This queue is configured for exactly three worker slots.');
  const outputRoot = path.resolve(ROOT, config.outputRoot);
  fs.mkdirSync(outputRoot, { recursive: true });
  const stateFile = path.join(outputRoot, 'queue-state.json');
  const state = fs.existsSync(stateFile) ? read(stateFile) : { schemaVersion: 1, cars: {} };
  const cars = config.cars.map(c => {
    const ref = prepared.cars.find(p => p.id === c.id && p.source === c.source);
    if (!ref) throw Error(`Missing prepared reference: ${c.id}`);
    const cropConfig = p => JSON.stringify([p.cropPixels ?? null, p.cropBoxes ?? null]);
    if (cropConfig(ref) !== cropConfig(c)) throw Error(`Crop configuration changed: ${c.id}. Prepare references again.`);
    return { ...ref, ...c };
  });
  if (options.command === 'status') {
    console.table(cars.map(c => ({ car: c.id, status: state.cars[c.id]?.status ?? 'pending', task: state.cars[c.id]?.taskId ?? '', credits: state.cars[c.id]?.consumedCredits ?? 'unknown' })));
    return;
  }
  validateInputs(cars);
  for (const car of cars) {
    const record = state.cars[car.id];
    if (record && record.fingerprint !== fingerprint(car, config.generation)) throw Error(`Inputs/settings changed for recorded car ${car.id}; restore its settings or create a separately approved variant. Do not reset its state.`);
  }
  const selected = selectCars(cars, state.cars, options);
  const fresh = selected.filter(c => !state.cars[c.id]);
  const estimate = fresh.length * config.estimatedCreditsPerCar;
  console.table(selected.map(c => ({ car: c.id, action: state.cars[c.id] ? 'resume' : 'new generation', views: c.views.map(v => v.view).join('/'), targetTriangles: config.generation.target_polycount })));
  console.log(`Maximum active cars: 3. Estimated NEW charges: ${estimate} credits. Source: ${config.pricingSource} (checked ${config.pricingChecked}).`);
  if (options.command === 'plan') { console.log('Dry run only: no API calls or submissions.'); return; }
  if (!selected.length) { console.log('No pending cars in this selection.'); return; }
  if (options.maxCredits === null || estimate > options.maxCredits) throw Error(`Pass --max-credits ${estimate} or higher for this run. No API request was made.`);
  const lock = path.join(outputRoot, 'queue.lock');
  let lockFd;
  try { lockFd = fs.openSync(lock, 'wx'); fs.writeFileSync(lockFd, `${process.pid}\n`); }
  catch { throw Error('Queue lock exists. Check whether its process is still running before removing the stale lock. Never start overlapping queue runners.'); }
  const save = () => { state.updatedAt = new Date().toISOString(); write(stateFile, state); };
  try {
    // A runner may have completed between our plan read and acquiring the lock.
    const latestState = fs.existsSync(stateFile) ? read(stateFile) : { schemaVersion: 1, cars: {} };
    if (JSON.stringify(latestState) !== JSON.stringify(state)) throw Error('Queue state changed while planning. Run the command again to use the latest task IDs. Nothing was submitted.');
    const g = config.generation;
    if (g.ai_model !== 'meshy-7.1' || g.geometry_resolution !== 'standard' || g.texture_resolution !== '4k' || g.should_texture !== true || config.estimatedCreditsPerCar !== 30) {
      throw Error('Generation pricing assumptions changed. Recheck published pricing and update the planner before submitting.');
    }
    const entry = resolveCli();
    const balanceResult = await cli(entry, ['balance'], outputRoot, path.join(outputRoot, 'logs', `balance-${Date.now()}`));
    const balance = requireOk(balanceResult, 'Balance check').balance;
    if (!Number.isFinite(balance) || balance < estimate) throw Error(`Insufficient or unavailable credit balance; ${estimate} estimated new credits required.`);
    console.log(`Balance verified: ${balance} credits. Starting ${selected.length} car(s).`);
    await runPool(selected, 3, async car => {
      let record = state.cars[car.id];
      const workDir = path.join(outputRoot, car.id);
      fs.mkdirSync(workDir, { recursive: true });
      const log = label => path.join(workDir, 'logs', `${label}-${Date.now()}`);
      try {
        if (!record) {
          const payloadFile = path.join(workDir, 'request.json');
          write(payloadFile, { ...config.generation, image_urls: car.views.map(v => path.resolve(ROOT, v.path)) });
          record = state.cars[car.id] = {
            status: 'submitting', fingerprint: fingerprint(car, config.generation),
            operationId: crypto.randomUUID(), resource: RESOURCE, requestFile: payloadFile,
            estimatedCredits: config.estimatedCreditsPerCar, consumedCredits: null,
            source: car.source, startedAt: new Date().toISOString()
          };
          save();
          console.log(`[${car.id}] Submitting one textured multi-view job.`);
          const response = await cli(entry, [RESOURCE, 'create', '--data', `@${payloadFile}`, '--async', '--operation-id', record.operationId], outputRoot, log('submission'));
          const submission = response.envelope.result?.submission;
          record.taskId = submission?.task_id ?? response.envelope.result?.task?.task_id ?? null;
          record.status = record.taskId ? 'accepted' : 'submission_unknown';
          save(); // Persist the task even when the CLI reports a local error after acceptance.
          requireOk(response, `Submission for ${car.id}`);
          if (!record.taskId) throw Error('Submission has no task ID. Reconcile the operation journal; do not resubmit.');
        }
        if (!record.projectDir) {
          const initialized = await cli(entry, ['project', 'init', '--root', workDir, '--name', car.id, '--task-id', record.taskId, '--task-type', RESOURCE], outputRoot, log('project-init'));
          record.projectDir = requireOk(initialized, 'Project initialization').project_dir;
          save();
        }
        if (record.status !== 'ready') {
          console.log(`[${car.id}] Waiting on ${record.taskId}; generation normally takes minutes.`);
          let result;
          do {
            result = await cli(entry, [RESOURCE, 'wait', record.taskId, '--timeout', '600', '--project', record.projectDir, '--stage', 'generation'], outputRoot, log('wait'));
            if (result.code === 8) console.log(`[${car.id}] Still running; resuming the same task wait.`);
          } while (result.code === 8);
          const task = result.envelope.result?.task;
          record.consumedCredits = task?.consumed_credits ?? record.consumedCredits ?? null;
          if (task?.status && ['FAILED', 'CANCELED', 'CANCELLED'].includes(task.status)) { record.status = 'failed'; save(); }
          requireOk(result, `Generation for ${car.id}`);
          if (task?.status !== 'SUCCEEDED') throw Error('Task did not report SUCCEEDED; resume its recorded ID.');
          record.status = 'ready';
          save();
        }
        const listed = requireOk(await cli(entry, ['download', '--resource', RESOURCE, '--task-id', record.taskId, '--list'], outputRoot, log('assets')), 'Asset list');
        const assets = listed.assets ?? [];
        const selectedAssets = assets.filter(a => a.key === 'model.glb' || a.key === 'model.pre_remeshed_glb' || ['texture', 'thumbnail'].includes(a.kind));
        if (!selectedAssets.some(a => a.key === 'model.glb')) throw Error('Successful task has no GLB asset.');
        const assetDir = path.join(record.projectDir, 'assets');
        fs.mkdirSync(assetDir, { recursive: true });
        for (const asset of selectedAssets) {
          const file = path.join(assetDir, path.basename(asset.filename));
          if (fs.existsSync(file) && fs.statSync(file).size > 0) continue;
          requireOk(await cli(entry, ['download', '--resource', RESOURCE, '--task-id', record.taskId, '--asset', asset.key, '--output', file, '--project', record.projectDir, '--stage', 'delivery'], outputRoot, log('download')), `Download ${asset.key}`);
        }
        const model = path.join(assetDir, 'model.glb');
        const inspection = glbSummary(model);
        const warnings = [];
        if (inspection.trianglesAcrossMeshNodes > config.generation.target_polycount * 1.2) warnings.push('Triangle count exceeds target by more than 20%.');
        if (inspection.meshes < 5) warnings.push('Wheel separation is not established; inspect mesh components before game integration.');
        if (!inspection.hasNormalMap || !inspection.hasMetallicRoughnessMap) warnings.push('Expected PBR channels missing from GLB; inspect downloaded textures/material mapping.');
        if (!assets.some(a => a.key === 'model.pre_remeshed_glb')) warnings.push('Higher-detail source GLB was not returned. Reuse this task; do not regenerate automatically.');
        write(path.join(record.projectDir, 'review.json'), {
          car: car.id, resource: RESOURCE, taskId: record.taskId,
          consumedCredits: record.consumedCredits, inspection, warnings,
          visualReview: 'pending', gameReady: false,
          checklist: ['Compare silhouette and proportions with the concept', 'Inspect all four wheels and underside', 'Separate wheels and set pivots if needed', 'Inspect paint, glass, rubber and light material regions', 'Rotate glossy lighting to inspect panel normals and baked highlights', 'Check scale, orientation and ground contact', 'Measure performance in the game scene']
        });
        record.status = 'downloaded';
        record.modelFile = model;
        record.previewFiles = selectedAssets.filter(a => a.kind === 'thumbnail').map(a => path.join(assetDir, path.basename(a.filename)));
        record.finishedAt = new Date().toISOString();
        delete record.lastError;
        save();
        console.log(`[${car.id}] Downloaded. Triangles: ${inspection.trianglesAcrossMeshNodes}. Actual credits: ${record.consumedCredits ?? 'unknown'}. Visual/material/wheel review pending.`);
      } catch (error) {
        if (record) {
          if (!record.taskId) record.status = 'submission_unknown';
          record.lastError = { message: error.message, at: new Date().toISOString() };
          save();
        }
        throw error;
      }
    });
    console.log('Batch complete. Review the downloaded previews and review.json before generating more cars.');
  } finally {
    fs.closeSync(lockFd);
    fs.unlinkSync(lock);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
