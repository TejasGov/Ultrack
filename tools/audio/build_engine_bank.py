"""Build the measured engine bank from recordings/plan-v3.json. Writes engine-bank.json, engines/v3/ and the game's credits.json; the old bank is left alone.

Every loop comes from a stretch where the engine's pitch was tracked, is flattened to its own anchor rpm and woven into a seamless
2 s loop. Requires ffmpeg, numpy, scipy. Usage: python build_engine_bank.py [car ...] [--view DIR]
"""
import hashlib, json, subprocess, sys
from pathlib import Path
import numpy as np
from scipy import signal
from engine_dsp import RATE, HOP, track_line, runs, flatten, weave_loop, match_bands, flutter, centroid

ROOT = Path(__file__).resolve().parents[2]
BASE = ROOT / 'assets/audio'
WORK = BASE / 'recordings'
OUT = BASE / 'engines/v3'
SOURCES = [WORK / 'src', WORK / 'incoming']
CC = 'Creative Commons Attribution license (reuse allowed)'
ROLL = 0.12        # seconds of wrapped audio either side of the loop points: the codec's start-up error stays outside the loop
ANCHOR_RATIO = 1.3 # neighbours at most this far apart, so the mixer only bends pitch about +-14%
WIDTH = 0.07       # a frame belongs to an anchor when its rpm is within 7%
MIN_POOL = 0.14    # seconds of real audio an anchor needs
LOOP_SECONDS = 2.0


def source_file(video):
    for d in SOURCES:
        for f in d.glob(f'youtube-{video}.*'):
            if f.suffix != '.json':
                return f
    raise FileNotFoundError(video)


def decode(path):
    p = subprocess.run(['ffmpeg', '-v', 'error', '-i', str(path), '-ar', str(RATE), '-ac', '1', '-f', 'f32le', '-'], capture_output=True, check=True)
    return np.frombuffer(p.stdout, dtype='<f4').astype(float)


def credit(video):
    f = source_file(video)
    meta = json.loads(f.with_suffix('.info.json').read_text(encoding='utf8'))
    if meta.get('license') != CC:
        raise ValueError('Source has no verified CC reuse licence: ' + video)
    if 'do not own' in meta.get('description', '').lower():
        raise ValueError('Uploader disclaims ownership: ' + video)
    return {'author': meta['channel'], 'title': meta['title'], 'url': meta['webpage_url'], 'license': 'CC BY 3.0',
            'licenseUrl': 'https://creativecommons.org/licenses/by/3.0/', 'sourceSha256': hashlib.sha256(f.read_bytes()).hexdigest(),
            'changes': 'Trimmed, pitch flattened, rewoven into loops, filtered, level matched and encoded to Opus. Runtime pitch and load follow driving.'}


def analyse(car, audio):
    """every tracked frame of a car's segments: arrays of (video, t, rpm, set)"""
    tracks = []
    for seg in car['segments']:
        y = audio[seg['video']]
        t, hz, conf = track_line(y, seg['from'], seg['to'], *seg['hz'])
        rpm = hz * 60 / seg['order']
        slope = np.gradient(np.log(signal.savgol_filter(rpm, min(15, len(rpm) - (1 - len(rpm) % 2)), 2)), HOP)
        good = conf > np.median(conf) * .55
        tracks.append({'seg': seg, 't': t, 'rpm': rpm, 'slope': slope, 'good': good})
    return tracks


def pool_for(tracks, audio, anchor, wanted):
    """flattened pieces of real audio at the anchor's pitch, best-covered take first, stopping once there is enough"""
    pieces = []
    for tr in tracks:
        kind = tr['seg']['set']
        if kind == 'idle':
            continue
        direction = tr['slope'] < -.25 if wanted == 'off' else tr['slope'] > -.1
        if kind not in (wanted, 'auto'):
            continue
        mask = tr['good'] & (np.abs(np.log(tr['rpm'] / anchor)) < WIDTH)
        if kind == 'auto':
            mask &= direction
        for a, b in runs(mask, int(.06 / HOP)):
            piece = flatten(audio[tr['seg']['video']], tr['t'], tr['rpm'], anchor, tr['t'][a], tr['t'][b - 1])
            if len(piece) > 256:
                pieces.append(piece)
    pieces.sort(key=len, reverse=True)
    keep, total = [], 0
    for p in pieces:
        keep.append(p); total += len(p)
        if total > .9 * RATE:
            break
    return keep, total / RATE


def finish(loop):
    y = signal.sosfiltfilt(signal.butter(2, 28, fs=RATE, btype='highpass', output='sos'), np.tile(loop, 3))[len(loop):2 * len(loop)]
    y = signal.sosfiltfilt(signal.butter(2, 14000, fs=RATE, output='sos'), np.tile(y, 3))[len(y):2 * len(y)]
    rms = float(np.sqrt(np.mean(y * y)))
    if rms < 1e-5:
        raise ValueError('silent loop')
    return y * min(.115 / rms, .83 / np.max(np.abs(y)))


def encode(loop, path):
    n = round(ROLL * RATE)
    y = np.concatenate([loop[-n:], loop, loop[:n]]).astype('<f4')
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'f32le', '-ar', str(RATE), '-ac', '1', '-i', 'pipe:0', '-c:a', 'libopus', '-b:a', '96k', str(path)],
                   input=y.tobytes(), check=True)
    # the codec never returns the two ends identical: slide both points together to where the decoded ends agree best
    x = decode(path)
    a, b = n, n + len(loop)
    w = round(.004 * RATE)
    k = int(np.argmin(np.abs(x[a - w:a + w] - x[b - w:b + w]) + np.abs(np.diff(x[a - w:a + w + 1]) - np.diff(x[b - w:b + w + 1])))) - w
    return {'loopStart': round((a + k) / RATE, 6), 'loopEnd': round((b + k) / RATE, 6)}


def one_shots(key, car, audio):
    """real shift and pop transients, each a short cut with a fast fade, level matched"""
    made = {'shifts': [], 'pops': []}
    for kind, pre, length in (('shifts', .03, .19), ('pops', .004, .16)):
        for i, (video, at) in enumerate(car.get(kind, [])):
            y = audio[video][int((at - pre) * RATE):int((at - pre + length) * RATE)].copy()
            y = signal.sosfilt(signal.butter(2, 120, fs=RATE, btype='highpass', output='sos'), y)
            n = int(.003 * RATE)
            y[:n] *= np.linspace(0, 1, n)
            y *= np.linspace(1, 0, len(y)) ** 2
            y *= .7 / (np.max(np.abs(y)) + 1e-9)
            file = f'{key}-{kind[:-1]}-{i}.ogg'
            subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'f32le', '-ar', str(RATE), '-ac', '1', '-i', 'pipe:0', '-c:a', 'libopus', '-b:a', '96k', str(OUT / file)],
                           input=y.astype('<f4').tobytes(), check=True)
            made[kind].append(f'engines/v3/{file}')
    return made


def tyre_loop():
    """the BigSoundBank CC0 squeal as one seamless loop, from a held stretch of the clip; plan-v3.json 'tyres' says which"""
    t = json.loads((WORK / 'plan-v3.json').read_text(encoding='utf8'))['tyres']
    y = decode(WORK / 'incoming' / t['file'])[int(t['from'] * RATE):int(t['to'] * RATE)]
    fade = round(.25 * RATE)
    ramp = np.sin(np.linspace(0, np.pi / 2, fade)) ** 2
    loop = y[:-fade].copy()
    loop[:fade] = y[-fade:] * (1 - ramp) + loop[:fade] * ramp
    loop = finish(loop)
    (BASE / 'tyres').mkdir(exist_ok=True)
    return {'file': 'tyres/squeal-loop.ogg', 'source': t['source'], **encode(loop, BASE / 'tyres/squeal-loop.ogg')}


def measured(path, entry):
    """what the player will actually wrap: the decoded file between its loop points"""
    x = decode(path)
    a, b = round(entry['loopStart'] * RATE), round(entry['loopEnd'] * RATE)
    z = x[a:b]
    return {'seconds': round(len(z) / RATE, 3), 'rms': round(float(np.sqrt(np.mean(z * z))), 4), 'peak': round(float(np.max(np.abs(x))), 3),
            'wrapJump': round(float(abs(x[a] - x[b]) / (np.percentile(np.abs(np.diff(z)), 99) + 1e-9)), 2),
            'flutterDb': round(flutter(z), 1), 'centroid': round(centroid(z))}


def view(key, car, tracks, audio, out):
    import matplotlib
    matplotlib.use('Agg')
    import matplotlib.pyplot as plt
    videos = sorted({s['video'] for s in car['segments']})
    fig, axes = plt.subplots(len(videos), 1, figsize=(17, 4.2 * len(videos)), squeeze=False)
    for ax, v in zip(axes[:, 0], videos):
        trs = [t for t in tracks if t['seg']['video'] == v]
        lo = min(t['seg']['from'] for t in trs) - 1; hi = max(t['seg']['to'] for t in trs) + 1
        x = signal.resample_poly(audio[v][int(max(lo, 0) * RATE):int(hi * RATE)], 8000, RATE)
        f, ts, s = signal.spectrogram(x, 8000, nperseg=1536, noverlap=1376)
        sel = f < 1500
        db = 10 * np.log10(s[sel] + 1e-12); mx = np.percentile(db, 99.8)
        ax.pcolormesh(ts + max(lo, 0), f[sel], db, vmin=mx - 50, vmax=mx, cmap='magma', rasterized=True)
        for tr in trs:
            hz = tr['rpm'] * tr['seg']['order'] / 60
            ax.plot(tr['t'], np.where(tr['good'], hz, np.nan), color={'on': '#00ff88', 'off': '#ffffff', 'idle': '#00d0ff', 'auto': '#ffee00'}[tr['seg']['set']], lw=1.2)
            ax.text(tr['t'][0], 1400, f"{tr['rpm'].min():.0f}-{tr['rpm'].max():.0f}", color='w', fontsize=7)
        ax.set_title(f'{key} {v}', loc='left'); ax.set_xticks(np.arange(int(lo), hi, 1)); ax.tick_params(labelsize=7)
    fig.tight_layout(); fig.savefig(Path(out) / f'bank-{key}.png', dpi=72); plt.close(fig)


def build_car(key, car, viewdir=None):
    videos = sorted({s['video'] for s in car['segments']})
    videos += sorted({v for kind in ('shifts', 'pops') for v, _ in car.get(kind, []) if v not in videos})
    audio = {v: decode(source_file(v)) for v in videos}
    tracks = analyse(car, audio)
    if viewdir:
        view(key, car, tracks, audio, viewdir)
    out = {'idle': None, 'on': [], 'off': [], 'report': [], **one_shots(key, car, audio)}
    for tr in tracks:
        if tr['seg']['set'] != 'idle':
            continue
        rpm = float(np.median(tr['rpm']))
        piece = flatten(audio[tr['seg']['video']], tr['t'], tr['rpm'], rpm, tr['t'][0], tr['t'][-1])
        cycle = RATE * 120 / rpm
        loop = finish(weave_loop([piece], cycle, 3.0, seed=7))
        file = f'{key}-idle.ogg'
        entry = {'file': f'engines/v3/{file}', 'rpm': round(rpm), **encode(loop, OUT / file)}
        entry['stats'] = measured(OUT / file, entry)
        out['idle'] = entry
    idle = out['idle']['rpm']
    for wanted in ('on', 'off'):
        rmax = max(float(np.percentile(t['rpm'][t['good']], 99)) for t in tracks if t['seg']['set'] in (wanted, 'auto') and t['good'].any())
        rmin = min(float(np.percentile(t['rpm'][t['good']], 1)) for t in tracks if t['seg']['set'] in (wanted, 'auto') and t['good'].any())
        rmin = max(rmin, idle * 1.15)
        n = max(1, int(np.ceil(np.log(rmax / rmin) / np.log(ANCHOR_RATIO * .92))))
        made = []
        for i, anchor in enumerate(np.geomspace(rmin, rmax, n + 1)):
            anchor = round(float(anchor), -1)
            pieces, secs = pool_for(tracks, audio, anchor, wanted)
            cycle = RATE * 120 / anchor
            if secs < MIN_POOL or not any(len(p) > 1.2 * max(.045 * RATE, cycle * 1.5) for p in pieces):
                out['report'].append(f'{wanted}@{anchor:.0f}: only {secs:.2f}s, skipped')
                continue
            made.append((i, int(anchor), secs, weave_loop(pieces, cycle, LOOP_SECONDS if wanted == 'on' else 1.5, seed=11 + i)))
        for (i, anchor, secs, _), loop in zip(made, match_bands([m[3] for m in made], [m[1] for m in made])):
            file = f'{key}-{wanted}-{i}.ogg'
            entry = {'file': f'engines/v3/{file}', 'rpm': anchor, **encode(finish(loop), OUT / file)}
            entry['stats'] = {**measured(OUT / file, entry), 'poolSeconds': round(secs, 2)}
            out[wanted].append(entry)
    return out


def write_records(bank, plan):
    """measurements go to report-v3.json (the game never reads them); credits.json (the game's Credits screen) and CREDITS-v3.md list every source"""
    path = WORK / 'report-v3.json'
    report = json.loads(path.read_text(encoding='utf8')) if path.exists() else {}
    credits, lines = [], []
    for key, car in plan.items():
        p = bank['profiles'].get(key)
        if not p or 'sharedWith' in car:
            continue
        for e in [p['idle'], *p['on'], *p['off']]:
            if 'stats' in e:
                report.setdefault(key, {})[e['file']] = {'rpm': e['rpm'], **e.pop('stats')}
        for s in p['sources']:
            credits.append({'car': key, 'name': p['name'], **s})
        lines.append(f"- **{p['name']}**: {p['match']}. " + '; '.join(f"[{s['title']}]({s['url']}), {s['author']}, [{s['license']}]({s['licenseUrl']})" for s in p['sources']))
    t = bank['tyres']['source']
    credits.append({'car': 'all', 'name': 'Tyre squeal', **t})
    lines.append(f"- **Tyre squeal (all cars)**: [{t['title']}]({t['url']}), {t['author']}, [{t['license']}]({t['licenseUrl']})")
    shared = [f"{c['name']}" for c in plan.values() if 'sharedWith' in c]
    path.write_text(json.dumps(report, indent=1) + '\n', encoding='utf8')
    (WORK / 'credits.json').write_text(json.dumps(credits, indent=2, ensure_ascii=False) + '\n', encoding='utf8')
    (WORK / 'CREDITS-v3.md').write_text('# Measured engine bank: sources\n\nEvery source shows Creative Commons Attribution on YouTube as of 2026-11-02 (captured in its .info.json), except the CC0 tyre clip. That licence is the uploader\'s own claim. Credits refer to the recordings, not an endorsement.\n\n' + '\n'.join(lines) + '\n\nSharing a recording: ' + '; '.join(shared) + '.\n\nAll edits retain the source licence. Changes: trimmed, pitch flattened, rewoven into loops, tone matched across rpm, filtered, level matched, encoded to Opus; pitch and level follow driving at runtime.\n', encoding='utf8')


def main():
    args = sys.argv[1:]
    viewdir = None
    if '--view' in args:
        i = args.index('--view'); viewdir = args[i + 1]; del args[i:i + 2]
    plan = json.loads((WORK / 'plan-v3.json').read_text(encoding='utf8'))['cars']
    OUT.mkdir(parents=True, exist_ok=True)
    path = BASE / 'engine-bank.json'
    bank = json.loads(path.read_text(encoding='utf8')) if path.exists() else {'schemaVersion': 3, 'kind': 'measured-recordings', 'profiles': {}}
    for key, car in plan.items():
        if 'sharedWith' in car or (args and key not in args):
            continue
        r = build_car(key, car, viewdir)
        videos = sorted({s['video'] for s in car['segments']} | {v for kind in ('shifts', 'pops') for v, _ in car.get(kind, [])})
        v, start, secs = car['preview']
        y = decode(source_file(v))[round(start * RATE):round((start + secs) * RATE)]
        y *= min(.115 / np.sqrt(np.mean(y * y)), .83 / np.max(np.abs(y)))
        n = round(.02 * RATE); y[:n] *= np.linspace(0, 1, n); y[-n:] *= np.linspace(1, 0, n)
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'f32le', '-ar', str(RATE), '-ac', '1', '-i', 'pipe:0', '-c:a', 'libopus', '-b:a', '96k', str(OUT / f'{key}-source.ogg')],
                       input=y.astype('<f4').tobytes(), check=True)
        bank['profiles'][key] = {'name': car['name'], 'redline': car['redline'], 'cars': [key], 'idle': r['idle'], 'on': r['on'], 'off': r['off'], 'shifts': r['shifts'], 'pops': r['pops'],
                                 'sources': [credit(v) for v in videos], 'match': car['match'], 'quality': car.get('quality', 'measured'), 'preview': f'engines/v3/{key}-source.ogg'}
        print(key, 'shifts', len(r['shifts']), 'pops', len(r['pops']), 'idle', r['idle']['rpm'], 'on', [e['rpm'] for e in r['on']], 'off', [e['rpm'] for e in r['off']], *r['report'], flush=True)
    bank['tyres'] = tyre_loop()
    write_records(bank, plan)
    for key, car in plan.items():
        src = car.get('sharedWith')
        if src and src in bank['profiles']:
            bank['profiles'][key] = {**bank['profiles'][src], 'name': car['name'], 'redline': car['redline'], 'cars': [key], 'sharedWith': src}
    path.write_text(json.dumps(bank, indent=1) + '\n', encoding='utf8')


if __name__ == '__main__':
    main()
