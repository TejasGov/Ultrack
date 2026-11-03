"""Engine recording DSP: RPM tracking, pitch flattening and seamless loop synthesis. Used by build_engine_bank.py."""
import numpy as np
from scipy import signal
from scipy.interpolate import CubicSpline

RATE = 48000
TRACK_RATE = 8000
HOP = 0.02   # tracker frame step, seconds


def track_line(y, t0, t1, hz_lo, hz_hi, rate=RATE):
    """Follow the strongest engine line between hz_lo and hz_hi over [t0, t1]: Viterbi over a whitened spectrogram.

    Returns absolute times, line frequency per frame and a confidence (line height over the local spectrum). The caller says which
    engine order the line is, because a harmonic comb alone cannot tell (real engines put energy on every half order).
    """
    a, b = int(t0 * rate), int(t1 * rate)
    x = signal.resample_poly(y[a:b], TRACK_RATE, rate)
    hop = round(HOP * TRACK_RATE)
    f, t, s = signal.stft(x, TRACK_RATE, nperseg=1024, nfft=4096, noverlap=1024 - hop, boundary=None, padded=False)
    mag = np.log1p(np.abs(s) * 200)
    mag -= signal.medfilt2d(mag, (81, 1))   # whitening: lines stand up, road noise and overall level do not
    grid = np.exp(np.linspace(np.log(hz_lo), np.log(hz_hi), 300))
    k = np.clip(np.round(grid / (f[1] - f[0])).astype(int), 0, len(f) - 1)
    k2 = np.clip(k * 2, 0, len(f) - 1)
    score = mag[k] + .5 * mag[k2]
    step = np.log(grid[1] / grid[0])
    reach = max(1, int(np.log(1.04) / step))   # about 4% per 20 ms frame: fast enough for a rev blip, too slow to jump lines
    penalty = .25 * (np.arange(-reach, reach + 1) / reach) ** 2
    best = score[:, 0].copy()
    back = np.zeros(score.shape, dtype=int)
    n = len(grid)
    for j in range(1, score.shape[1]):
        c = np.full((n, 2 * reach + 1), -1e9)
        for d in range(-reach, reach + 1):
            lo, hi = max(0, d), n + min(0, d)
            c[lo:hi, d + reach] = best[lo - d:hi - d] - penalty[d + reach]
        pick = np.argmax(c, axis=1)
        best = c[np.arange(n), pick] + score[:, j]
        back[:, j] = np.arange(n) - (pick - reach)
    path = np.zeros(score.shape[1], dtype=int)
    path[-1] = int(np.argmax(best))
    for j in range(score.shape[1] - 1, 0, -1):
        path[j - 1] = np.clip(back[path[j], j], 0, n - 1)
    return t + t0, signal.medfilt(grid[path], 5), score[path, np.arange(score.shape[1])]


def runs(mask, min_frames):
    """(start, end) frame ranges of True runs at least min_frames long"""
    edges = np.flatnonzero(np.diff(np.concatenate([[0], mask.astype(int), [0]])))
    return [(a, b) for a, b in zip(edges[::2], edges[1::2]) if b - a >= min_frames]


def flatten(y, t, rpm, target, start, end, rate=RATE):
    """Audio between start and end (seconds) resampled in time so its pitch sits exactly at target rpm"""
    a, b = int(start * rate), int(end * rate)
    src = np.arange(a, b)
    r = np.interp(src / rate, t, rpm)
    pos = np.concatenate([[0], np.cumsum(r / target)[:-1]])   # output sample index reached at each source sample
    n = int(pos[-1])
    if n < 64:
        return np.zeros(0)
    return CubicSpline(pos, y[a:b])(np.arange(n))


def weave_loop(pool, cycle, seconds, seed=1, rate=RATE):
    """Build a seamless loop from short flattened pieces: random cycle-aligned grains overlap-added with waveform matching.

    pool = list of flattened arrays at one pitch; cycle = samples per engine cycle. Random grain order removes the fixed repeat of
    a short cut; waveform matching keeps harmonics in phase across each join, and the ending is matched back onto the beginning.
    """
    rng = np.random.default_rng(seed)
    grain = max(int(.045 * rate), int(cycle * 1.5))   # at least a whole cycle, to keep the engine's own firing rhythm
    pool = [p for p in pool if len(p) >= 1.2 * grain]
    if not pool:
        raise ValueError('pool shorter than one grain')
    weights = np.array([len(p) - grain for p in pool], float)
    weights /= weights.sum()
    hop = grain // 2
    win = np.hanning(grain + 1)[:-1]
    total = int(seconds * rate)
    out = np.zeros(total + 2 * grain)
    norm = np.zeros_like(out)
    reach = max(8, int(cycle))
    level = np.sqrt(np.mean(np.concatenate(pool) ** 2)) + 1e-9
    pos = 0
    p = pool[int(rng.choice(len(pool), p=weights))]
    at = int(rng.integers(0, len(p) - grain + 1))
    while pos < total + grain:
        seg = p[at:at + grain]
        if len(seg) < grain:
            break
        gain = np.clip(level / (np.sqrt(np.mean(seg ** 2)) + 1e-9), .5, 2)   # near and far grains of a passing car must not pump
        out[pos:pos + grain] += seg * gain * win
        norm[pos:pos + grain] += win
        pos += hop
        p = pool[int(rng.choice(len(pool), p=weights))]
        lo = int(rng.integers(0, max(1, len(p) - grain - 2 * reach)))
        # match the new grain to what its first half will overlap
        ref = out[pos:pos + hop] / np.maximum(norm[pos:pos + hop], 1e-3)
        ref = ref - ref.mean()
        best, at = -np.inf, lo
        for k in range(0, 2 * reach, 2):
            w = p[lo + k:lo + k + hop]
            if len(w) < hop or lo + k + grain > len(p):
                break
            v = float(np.dot(ref, w - w.mean())) / (np.linalg.norm(w - w.mean()) + 1e-9)
            if v > best:
                best, at = v, lo + k
    z = out[:pos] / np.maximum(norm[:pos], 1e-3)
    # circular close: find the tail position that matches the head best, then crossfade it onto the head
    fade = grain
    head = z[:fade] - z[:fade].mean()
    best, end = -np.inf, total
    for k in range(total - int(cycle) - 2, total + 1):
        w = z[k:k + fade]
        if len(w) < fade:
            break
        v = float(np.dot(head, w - w.mean())) / (np.linalg.norm(w - w.mean()) + 1e-9)
        if v > best:
            best, end = v, k
    tail = z[end:end + fade]
    ramp = np.sin(np.linspace(0, np.pi / 2, fade)) ** 2
    loop = z[:end].copy()
    loop[:fade] = tail * (1 - ramp) + loop[:fade] * ramp
    return loop


def match_bands(loops, rpms, limit=8, rate=RATE):
    """Even out tone between neighbouring anchors: per third-octave band, fit level against log rpm across the set and pull each
    loop onto that line, at most limit dB. Filtering in the circular domain keeps every loop seamless."""
    if len(loops) < 3:
        return loops
    edges = 100 * 2 ** (np.arange(0, 22) / 3)
    centre = np.sqrt(edges[:-1] * edges[1:])
    specs = [np.fft.rfft(l) for l in loops]
    freqs = [np.fft.rfftfreq(len(l), 1 / rate) for l in loops]
    L = np.array([[10 * np.log10(np.mean(np.abs(s[(f >= a) & (f < b)]) ** 2) / len(f) ** 2 + 1e-14) for a, b in zip(edges[:-1], edges[1:])] for s, f in zip(specs, freqs)])
    x = np.log(np.array(rpms, float))
    slope, base = np.polyfit(x, L, 1)
    d = np.clip(np.outer(x, slope) + base - L, -limit, limit)
    out = []
    for l, s, f, g in zip(loops, specs, freqs, d):
        db = np.interp(np.log(np.maximum(f, 1)), np.log(centre), g, left=0, right=g[-1])
        out.append(np.fft.irfft(s * 10 ** (db / 20), len(l)))
    return out


def flutter(x, rate=RATE):
    """Share of the level envelope's modulation that sits at 1.5-12 Hz, in dB against the mean level: 0 dB = fully pumping, lower = steadier."""
    env = np.abs(signal.hilbert(signal.sosfilt(signal.butter(2, 60, fs=rate, btype='highpass', output='sos'), x)))
    e = signal.resample_poly(env, 200, rate)
    e = np.tile(e, max(1, int(np.ceil(8 * 200 / max(len(e), 1)))))   # hear it the way the loop runs: repeated
    bp = signal.sosfiltfilt(signal.butter(2, [1.5, 12], fs=200, btype='band', output='sos'), e - e.mean())
    return float(20 * np.log10(np.sqrt(np.mean(bp ** 2)) / (e.mean() + 1e-9) + 1e-9))


def wrap_jump(x):
    """loop wrap step relative to the clip's own 99th percentile sample step; about 1 or below is inaudible"""
    return float(abs(x[0] - x[-1]) / (np.percentile(np.abs(np.diff(x)), 99) + 1e-9))


def centroid(x, rate=RATE):
    s = np.abs(np.fft.rfft(x * np.hanning(len(x))))
    fr = np.fft.rfftfreq(len(x), 1 / rate)
    return float((s * fr).sum() / (s.sum() + 1e-12))
