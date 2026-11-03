"""Build the category sound packs from recordings/plan-packs.json: one file per engine category, one shared file, and engine-packs.json.

A race then fetches one pack plus the shared file. Each loop comes from tracked real audio as in build_engine_bank.py. All loops sit in one
Opus stream with wrapped audio around their loop points, so the codec's start-up error stays outside. Requires ffmpeg, numpy, scipy.
Usage: python build_engine_packs.py [pack ...]
"""
import json, subprocess, sys
from pathlib import Path
import numpy as np
from build_engine_bank import BASE, WORK, RATE, ROLL, analyse, pool_for, source_file, decode, finish, credit
from scipy import signal
from engine_dsp import flatten, runs, weave_loop, match_bands, flutter, centroid

OUT = BASE / 'engines/packs'
BITRATE = '80k'
ON, OFF = 6, 3            # loops per set: neighbours about 1.4x apart at most, so playback bends pitch about +-18%
ON_SECONDS, OFF_SECONDS, IDLE_SECONDS = 1.5, 1.2, 2.0
MIN_POOL = 0.14
TRAFFIC_RPM = 5000        # the opponents' loop in each pack: the on-throttle anchor nearest this


def pick_anchors(tracks, audio, wanted, count, lowest):
    """the anchors nearest an even spread that have enough real audio; returns (rpm, pieces, seconds), low to high"""
    usable = [t for t in tracks if t['seg']['set'] in (wanted, 'auto') and t['good'].any()]
    if not usable:
        return []
    top = max(float(np.percentile(t['rpm'][t['good']], 99)) for t in usable)
    low = max(min(float(np.percentile(t['rpm'][t['good']], 1)) for t in usable), lowest)
    found = []
    for rpm in np.geomspace(low, top, 16):
        rpm = round(float(rpm), -1)
        pieces, secs = pool_for(tracks, audio, rpm, wanted)
        if secs >= MIN_POOL and any(len(p) > 1.2 * max(.045 * RATE, RATE * 120 / rpm * 1.5) for p in pieces):
            found.append((rpm, pieces, secs))
    if not found:
        return []
    spread = np.geomspace(found[0][0], found[-1][0], min(count, len(found)))
    chosen = {min(range(len(found)), key=lambda i: abs(np.log(found[i][0] / s))) for s in spread}
    return [found[i] for i in sorted(chosen)]


def one_shot(y, at, seconds, attack=.003, fade=None):
    """a real transient or start-up, faded so it can't click, level matched"""
    z = y[int(at * RATE):int((at + seconds) * RATE)].copy()
    n = int(attack * RATE)
    z[:n] *= np.linspace(0, 1, n)
    if fade:
        m = int(fade * RATE)
        z[-m:] *= np.linspace(1, 0, m)
    else:
        z *= np.linspace(1, 0, len(z)) ** 2
    return z * (.7 / (np.max(np.abs(z)) + 1e-9))


def write_stream(items, path):
    """items: dicts with 'kind' loop|shot and 'audio'. Encodes one stream, then returns where each ended up, loop points tuned on the decoded audio."""
    n = round(ROLL * RATE)
    parts, at = [], 0
    for it in items:
        y = it['audio']
        if it['kind'] == 'loop':
            parts.append(np.concatenate([y[-n:], y, y[:n]]))
            it['start'], it['end'] = at + n, at + n + len(y)
        else:
            parts.append(np.concatenate([y, np.zeros(round(.02 * RATE))]))
            it['start'], it['end'] = at, at + len(y)
        at += len(parts[-1])
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'f32le', '-ar', str(RATE), '-ac', '1', '-i', 'pipe:0', '-c:a', 'libopus', '-b:a', BITRATE, str(path)],
                   input=np.concatenate(parts).astype('<f4').tobytes(), check=True)
    x = decode(path)
    w = round(.004 * RATE)
    for it in items:
        a, b = it['start'], it['end']
        if it['kind'] == 'loop':
            k = int(np.argmin(np.abs(x[a - w:a + w] - x[b - w:b + w]) + np.abs(np.diff(x[a - w:a + w + 1]) - np.diff(x[b - w:b + w + 1])))) - w
            a, b = a + k, b + k
            z = x[a:b]
            it['stats'] = {'seconds': round(len(z) / RATE, 3), 'rms': round(float(np.sqrt(np.mean(z * z))), 4), 'wrapJump': round(float(abs(x[a] - x[b]) / (np.percentile(np.abs(np.diff(z)), 99) + 1e-9)), 2),
                           'flutterDb': round(flutter(z), 1), 'centroid': round(centroid(z))}
            it['ref'] = {'loopStart': round(a / RATE, 6), 'loopEnd': round(b / RATE, 6)}
        else:
            it['ref'] = {'at': round(a / RATE, 6), 'dur': round((b - a) / RATE, 6)}
    return float(np.max(np.abs(x)))


def build_pack(name, pack):
    videos = sorted({s['video'] for s in pack['segments']} | {v for k in ('shifts', 'pops') for v, _ in pack.get(k, [])} | ({pack['start'][0]} if pack.get('start') else set()))
    audio = {v: decode(source_file(v)) for v in videos}
    tracks = analyse(pack, audio)
    idle_track = next(t for t in tracks if t['seg']['set'] == 'idle')
    idle_rpm = float(np.median(idle_track['rpm']))
    idle_piece = flatten(audio[idle_track['seg']['video']], idle_track['t'], idle_track['rpm'], idle_rpm, idle_track['t'][0], idle_track['t'][-1])
    items = [{'kind': 'loop', 'role': 'idle', 'rpm': round(idle_rpm), 'audio': finish(weave_loop([idle_piece], RATE * 120 / idle_rpm, IDLE_SECONDS, seed=7))}]
    for wanted, count, seconds in (('on', ON, ON_SECONDS), ('off', OFF, OFF_SECONDS)):
        chosen = pick_anchors(tracks, audio, wanted, count, idle_rpm * 1.15)
        loops = [weave_loop(p, RATE * 120 / rpm, seconds, seed=11 + i) for i, (rpm, p, _) in enumerate(chosen)]
        for (rpm, _, secs), loop in zip(chosen, match_bands(loops, [c[0] for c in chosen])):
            items.append({'kind': 'loop', 'role': wanted, 'rpm': int(rpm), 'pool': round(secs, 2), 'audio': finish(loop)})
    for kind, pre, length in (('shifts', .03, .19), ('pops', .004, .16)):
        for video, at in pack.get(kind, []):
            items.append({'kind': 'shot', 'role': kind, 'audio': one_shot(audio[video], at - pre, length)})
    if pack.get('start'):
        video, at, secs = pack['start']
        items.append({'kind': 'shot', 'role': 'start', 'audio': one_shot(audio[video], at, secs, attack=.01, fade=.5)})
    file = f'engines/packs/{name}.ogg'
    peak = write_stream(items, OUT / f'{name}.ogg')
    role = lambda r: [it for it in items if it['role'] == r]
    entry = lambda it: {'file': file, 'rpm': it['rpm'], **it['ref']}
    shot = lambda it: {'file': file, **it['ref']}
    on = role('on')
    traffic = min(on, key=lambda it: abs(np.log(it['rpm'] / TRAFFIC_RPM)))
    report = {'bytes': (OUT / f'{name}.ogg').stat().st_size, 'peak': round(peak, 3), 'loops': [{'role': it['role'], 'rpm': it['rpm'], **it['stats'], 'pool': it.get('pool')} for it in items if it['kind'] == 'loop']}
    return {'file': file, 'order': pack['order'], 'idle': entry(role('idle')[0]), 'on': [entry(i) for i in on], 'off': [entry(i) for i in role('off')],
            'shifts': [shot(i) for i in role('shifts')], 'pops': [shot(i) for i in role('pops')], 'start': shot(role('start')[0]) if role('start') else None,
            'sources': [credit(v) for v in videos], 'label': pack['label']}, report, (traffic['rpm'], traffic['audio'])


def build_common(plan, traffic):
    """opponent engine loops, the tyre squeal and the crash set, all in one shared file"""
    items = [{'kind': 'loop', 'role': 'traffic', 'pack': name, 'rpm': rpm, 'audio': y} for name, (rpm, y) in traffic.items()]
    t = plan['tyres']
    # the clip is a row of separate screeches with silence between: weave only the loud parts, or the squeal stutters
    y = decode(WORK / 'incoming' / t['file'])
    hop = round(.03 * RATE)
    env = np.array([np.sqrt(np.mean(y[i:i + hop] ** 2)) for i in range(0, len(y) - hop, hop)])
    loud = [y[a * hop:b * hop] for a, b in runs(env > .45 * np.percentile(env, 95), int(.25 / .03))]
    loop = weave_loop(loud, .16 * RATE, 3.0, seed=5)
    items.append({'kind': 'loop', 'role': 'tyres', 'rpm': 0, 'audio': finish(loop)})
    used = []
    def clip(video, at, secs):
        used.append(video)
        return one_shot(decode(source_file(video)), at, secs, attack=.004, fade=.25)
    for f in plan['crash']:   # a name is the existing file, a dict is a cut from a recording
        items.append({'kind': 'shot', 'role': 'crash', 'name': f, 'audio': decode(BASE / 'crash' / f'{f}.ogg')} if isinstance(f, str) else {'kind': 'shot', 'role': 'crash', 'name': f['name'], 'audio': clip(f['video'], f['at'], f['secs'])})
    for video, at, secs in plan['nitro']:
        items.append({'kind': 'shot', 'role': 'nitro', 'audio': clip(video, at, secs)})
    for video, at, secs in plan['turboSounds']['blow']:
        items.append({'kind': 'shot', 'role': 'blow', 'audio': clip(video, at, secs)})
    video, at, secs = plan['turboSounds']['whistle']
    used.append(video)
    fade = round(.25 * RATE)
    ramp = np.sin(np.linspace(0, np.pi / 2, fade)) ** 2
    w = decode(source_file(video))[int(at * RATE):int((at + secs) * RATE)]
    w = signal.sosfilt(signal.butter(4, 1800, fs=RATE, btype='highpass', output='sos'), w)[RATE // 10:]   # just the turbo: the engine below it would fight the car's own
    loop = w[:-fade].copy()
    loop[:fade] = w[-fade:] * (1 - ramp) + loop[:fade] * ramp
    items.append({'kind': 'loop', 'role': 'whistle', 'rpm': 0, 'audio': finish(loop)})
    write_stream(items, OUT / 'common.ogg')
    file = 'engines/packs/common.ogg'
    return {'file': file,
            'traffic': {i['pack']: {'file': file, 'rpm': i['rpm'], **i['ref']} for i in items if i['role'] == 'traffic'},
            'tyres': {'file': file, 'source': t['source'], **next(i for i in items if i['role'] == 'tyres')['ref']},
            'nitro': [{'file': file, **i['ref']} for i in items if i['role'] == 'nitro'],
            'turbo': {'whistle': {'file': file, **next(i for i in items if i['role'] == 'whistle')['ref']}, 'blow': [{'file': file, **i['ref']} for i in items if i['role'] == 'blow']},
            'sources': [credit(v) for v in sorted(set(used))],
            'crash': {i['name']: {'file': file, **i['ref']} for i in items if i['role'] == 'crash'}}, {'bytes': (OUT / 'common.ogg').stat().st_size, 'loops': [{'role': i['role'], 'rpm': i['rpm'], **i['stats']} for i in items if i['kind'] == 'loop']}


def main():
    only = sys.argv[1:]
    plan = json.loads((WORK / 'plan-packs.json').read_text(encoding='utf8'))
    OUT.mkdir(parents=True, exist_ok=True)
    path = BASE / 'engine-packs.json'
    old = json.loads(path.read_text(encoding='utf8')) if path.exists() else {}
    rpath = WORK / 'report-packs.json'
    report = json.loads(rpath.read_text(encoding='utf8')) if rpath.exists() else {}
    packs, traffic = old.get('packs', {}), {}
    for name, pack in plan['packs'].items():
        if only and name not in only and name in packs:
            continue
        packs[name], report[name], traffic[name] = build_pack(name, pack)
        print(name, 'idle', packs[name]['idle']['rpm'], 'on', [e['rpm'] for e in packs[name]['on']], 'off', [e['rpm'] for e in packs[name]['off']], 'shifts', len(packs[name]['shifts']), 'pops', len(packs[name]['pops']), report[name]['bytes'] // 1024, 'KB', flush=True)
    common = old.get('common')
    if len(traffic) == len(plan['packs']):   # a partial rebuild keeps the shared file: it needs every pack's opponent loop
        common, report['common'] = build_common(plan, traffic)
    else:
        print('common.ogg kept: rebuild all packs to refresh it')
    profiles = {}
    for key, car in plan['cars'].items():
        profiles[key] = {'name': car['name'], 'redline': car['redline'], 'pitch': round(car['order'] / plan['packs'][car['pack']]['order'], 4), 'pack': car['pack'], 'turbo': car['turbo'], 'cars': [key],
                         'match': packs[car['pack']]['label'], 'quality': 'category-pack', 'preview': f"engines/v3/{plan['previews'].get(key, key)}-source.ogg"}
    bank = {'schemaVersion': 4, 'kind': 'category-packs', 'packs': packs, 'common': common, 'tyres': common['tyres'], 'crash': common['crash'], 'traffic': common['traffic'], 'nitro': common['nitro'], 'turbo': common['turbo'], 'profiles': profiles}
    path.write_text(json.dumps(bank, indent=1, ensure_ascii=False) + '\n', encoding='utf8')
    rpath.write_text(json.dumps(report, indent=1) + '\n', encoding='utf8')
    seen, credits = set(), []
    for name, p in packs.items():
        for s in p['sources']:
            if (name, s['url']) not in seen:
                seen.add((name, s['url']))
                credits.append({'car': name, 'name': p['label'], **s})
    for s in common['sources']:
        credits.append({'car': 'all', 'name': 'Nitro, turbo and crash sounds', **s})
    credits.append({'car': 'all', 'name': 'Tyre squeal', **common['tyres']['source']})
    (WORK / 'credits.json').write_text(json.dumps(credits, indent=2, ensure_ascii=False) + '\n', encoding='utf8')
    print('total', sum(f.stat().st_size for f in OUT.glob('*.ogg')) // 1024, 'KB')


if __name__ == '__main__':
    main()
