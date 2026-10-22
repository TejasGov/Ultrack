"""Ultrack race HUD / start-procedure SFX, synthesized from scratch (no samples).

    python tools/synth_race_sfx.py            -> assets/audio/race/src/*.wav (48 kHz float, loudness-normalised masters)

Every sound is deterministic (seeded noise). One-shots are mastered to about -16 LUFS integrated with true peak
<= -1.5 dBTP (headroom for the Opus encode), no leading silence and a short tail fade. pit-limiter-beep is a loop:
its edges are silent by construction, so it wraps without a click; it is mastered at -18 LUFS (a background nag).
Convert: ffmpeg -i src/x.wav -c:a libopus -b:a 128k -ar 48000 x.ogg   (loop: -ac 1 -b:a 112k)
"""
import os
import numpy as np
from scipy import signal
from scipy.io import wavfile

SR = 48000
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'assets', 'audio', 'race', 'src')
rng = np.random.default_rng(20261019)


def t_axis(sec):
    return np.arange(int(round(sec * SR))) / SR


def phase(freq):
    """Instantaneous frequency (array, Hz) -> phase (radians)."""
    return 2 * np.pi * np.cumsum(freq) / SR


def additive(freq, amp_of_k, fmax=16000.0):
    """Band-limited periodic wave from a frequency track: sum of sin(k*phase) with amplitude amp_of_k(k)."""
    ph = phase(freq)
    top = float(np.max(freq))
    out = np.zeros_like(ph)
    k = 1
    while k * top < fmax:
        a = amp_of_k(k)
        if a:
            out += a * np.sin(k * ph)
        k += 1
    return out


def square(freq, fmax=9000.0):
    return additive(freq, lambda k: (4 / np.pi) / k if k % 2 else 0, fmax)


def saw(freq, fmax=12000.0):
    return additive(freq, lambda k: (2 / np.pi) * (-1) ** (k + 1) / k, fmax)


def ar_env(n, attack, release_tau, hold=0.0):
    """Linear attack, optional hold, exponential release (seconds)."""
    t = np.arange(n) / SR
    e = np.minimum(1.0, t / max(attack, 1e-4))
    rel = np.where(t > attack + hold, np.exp(-(t - attack - hold) / release_tau), 1.0)
    return e * rel


def bp(x, lo, hi, order=2):
    return signal.sosfilt(signal.butter(order, [lo, hi], 'bandpass', fs=SR, output='sos'), x)


def lp(x, fc, order=2):
    return signal.sosfilt(signal.butter(order, fc, 'lowpass', fs=SR, output='sos'), x)


def hp(x, fc, order=2):
    return signal.sosfilt(signal.butter(order, fc, 'highpass', fs=SR, output='sos'), x)


def peak_eq(x, f0, q, gain):
    b, a = signal.iirpeak(f0, q, fs=SR)
    return x + gain * signal.lfilter(b, a, x)


def place(dst, src, at):
    i = int(round(at * SR))
    n = min(len(src), len(dst) - i)
    dst[i:i + n] += src[:n]
    return dst


def reverb_ir(rt60, predelay=0.02, damp=6000.0, echoes=(), seconds=None):
    """Stereo IR: decorrelated decaying noise, darker as it decays, plus discrete PA slap echoes [(t, gain)]."""
    seconds = seconds or rt60 * 1.1
    n = int(seconds * SR)
    t = np.arange(n) / SR
    decay = np.exp(-6.9 * t / rt60)
    irs = []
    for _ in range(2):
        noise = rng.standard_normal(n)
        bright = lp(noise, damp)
        dark = lp(noise, damp / 4)
        mix = np.exp(-t / (rt60 / 3))  # bright early, dark late
        ir = (bright * mix + dark * (1 - mix)) * decay
        ir = np.concatenate([np.zeros(int(predelay * SR)), ir])
        for et, eg in echoes:
            ir[int((et + rng.uniform(-0.004, 0.004)) * SR)] += eg * 40 / np.sqrt(SR)
        irs.append(ir / np.sqrt(np.sum(ir ** 2)))
    return irs


def with_reverb(dry, ir, wet):
    """Mono dry -> stereo (dry centred + wet)."""
    tail = len(ir[0])
    d = np.concatenate([dry, np.zeros(tail - 1)])
    return np.stack([d + wet * signal.fftconvolve(dry, ir[c])[:len(d)] for c in range(2)])


# ---- mastering: BS.1770-4 loudness, true peak, trims --------------------------------------------------------
K1 = ([1.53512485958697, -2.69169618940638, 1.19839281085285], [1.0, -1.69065929318241, 0.73248077421585])
K2 = ([1.0, -2.0, 1.0], [1.0, -1.99004745483398, 0.99007225036621])


def lufs(x):
    x = np.atleast_2d(x)
    k = np.stack([signal.lfilter(*K2, signal.lfilter(*K1, ch)) for ch in x])
    blk, hop = int(0.4 * SR), int(0.1 * SR)
    if k.shape[1] < blk:
        k = np.pad(k, ((0, 0), (0, blk - k.shape[1])))
    z = np.array([np.mean(k[:, i:i + blk] ** 2, axis=1).sum() for i in range(0, k.shape[1] - blk + 1, hop)])
    lk = -0.691 + 10 * np.log10(z + 1e-20)
    z = z[lk > -70]
    rel = -0.691 + 10 * np.log10(z.mean()) - 10
    z = z[(-0.691 + 10 * np.log10(z)) > rel]
    return -0.691 + 10 * np.log10(z.mean())


def true_peak_db(x):
    x = np.atleast_2d(x)
    return 20 * np.log10(max(np.max(np.abs(signal.resample_poly(ch, 4, 1))) for ch in x))


def master(x, target=-16.0, tp_ceiling=-1.5, fade=0.015, trim_tail=True, loop=False, clip=0):
    """clip > 0: soft-clip transients (tanh) up to that many passes so clacky sounds reach the target under the ceiling."""
    x = np.atleast_2d(np.asarray(x, dtype=np.float64))
    x = x - x.mean(axis=1, keepdims=True) if loop else x
    if not loop:
        x = hp(x, 20)  # strip any DC / subsonic before trimming
        env = np.max(np.abs(x), axis=0)
        thr = env.max() * 10 ** (-60 / 20)
        start = int(np.argmax(env > thr))
        x = x[:, start:]
        if trim_tail:
            env = np.max(np.abs(x), axis=0)
            last = len(env) - int(np.argmax(env[::-1] > env.max() * 10 ** (-66 / 20)))
            x = x[:, :last]
        nf = int(fade * SR)
        x[:, -nf:] *= np.linspace(1, 0, nf) ** 2
    x = x * 10 ** ((target - lufs(x)) / 20)
    c = 10 ** ((tp_ceiling - 0.5) / 20)
    for _ in range(clip):
        if true_peak_db(x) <= tp_ceiling:
            break
        x = c * np.tanh(x / c)
        x = x * 10 ** ((target - lufs(x)) / 20)
    tp = true_peak_db(x)
    if tp > tp_ceiling:
        x = x * 10 ** ((tp_ceiling - tp) / 20)
    return x


def write(name, x):
    x = np.atleast_2d(x)
    assert np.all(np.isfinite(x)) and np.max(np.abs(x)) < 1.0, name
    wavfile.write(os.path.join(OUT, name + '.wav'), SR, x.T.astype(np.float32))
    print(f'{name:18s} {x.shape[0]}ch {x.shape[1] / SR:6.3f}s  {lufs(x):6.1f} LUFS  {true_peak_db(x):5.1f} dBTP')


# ---- sounds -------------------------------------------------------------------------------------------------
STADIUM = reverb_ir(1.6, predelay=0.025, damp=5000, echoes=[(0.14, 0.5), (0.31, 0.3), (0.52, 0.15)])
ROOM = reverb_ir(0.5, predelay=0.008, damp=8000)


def beep(f, dur, bright=0.0, drop=0.06, seed_detune=1.006):
    n = int(dur * SR)
    t = np.arange(n) / SR
    fr = f * (1 + drop * np.exp(-t / 0.012))  # short pitch drop into the note
    tone = 0.45 * square(fr, fmax=7000) + 0.35 * square(fr * seed_detune, fmax=7000) + 0.8 * np.sin(phase(fr))
    if bright:
        tone += bright * saw(fr * 2, fmax=14000)
    tone = lp(tone, 6500 + 4000 * bright)
    return np.tanh(1.3 * tone) * ar_env(n, 0.002, dur * 0.22, hold=dur * 0.45)


def count_beeps():
    f = 880.0
    b = beep(f, 0.30)
    for name in ('count-3', 'count-2', 'count-1'):
        write(name, master(with_reverb(b, STADIUM, 0.22)))
    go = beep(f * 2, 0.95, bright=0.35, drop=0.04)
    write('count-go', master(with_reverb(go, STADIUM, 0.25)))


def count_tick():
    n = int(0.07 * SR)
    t = np.arange(n) / SR
    tone = np.sin(2 * np.pi * 1900 * t) * np.exp(-t / 0.012) + 0.4 * np.sin(2 * np.pi * 3800 * t) * np.exp(-t / 0.005)
    click = bp(rng.standard_normal(n), 2500, 7000) * np.exp(-t / 0.0015) * 0.3
    x = lp(tone + click, 9000)
    write('count-tick', master(x * np.minimum(1, t / 0.0005)))


def lights_on():
    n = int(0.9 * SR)
    t = np.arange(n) / SR
    clack = bp(rng.standard_normal(n), 1500, 5500) * np.exp(-t / 0.004) * 0.9
    clack += np.sin(2 * np.pi * 3200 * t) * np.exp(-t / 0.01) * 0.35
    body = np.sin(phase(140 * (1 + 0.4 * np.exp(-t / 0.01)))) * np.exp(-t / 0.035) * 0.9
    hum_f = 100 * np.ones(n)
    hum = additive(hum_f, lambda k: [0, 1, 0.5, 0.35, 0.2, 0.12, 0.06][k] if k < 7 else 0)
    hum = hum * np.minimum(1, t / 0.012) * np.exp(-np.maximum(0, t - 0.25) / 0.18) * 0.35
    x = (clack + body + hum) * np.minimum(1, t / 0.0004)
    write('lights-on', master(with_reverb(x, ROOM, 0.12), clip=6))


def lights_out():
    n = int(0.55 * SR)
    t = np.arange(n) / SR
    snap = bp(rng.standard_normal(n), 2000, 9000) * np.exp(-t / 0.0025) * 1.0
    thunk = np.sin(phase(55 + 70 * np.exp(-t / 0.018))) * np.exp(-t / 0.06) * 1.1
    whomp = lp(rng.standard_normal(n), 220, 4) * np.exp(-t / 0.09) * 1.5  # the air going dead
    x = (snap + thunk + whomp) * np.minimum(1, t / 0.0003)
    write('lights-out', master(with_reverb(x, ROOM, 0.07), clip=6))


def horn(dur, seed_sag=0.03):
    n = int(dur * SR)
    t = np.arange(n) / SR
    p = t / dur
    sag = 1 - seed_sag * p ** 1.5 + 0.004 * np.sin(2 * np.pi * 5.5 * t) * np.minimum(1, t / 0.3)
    swell = np.minimum(1, (t / 0.09)) ** 1.5 * (1 + 0.12 * np.exp(-t / 0.15))
    voices = [(232, 1.0), (236.5, 0.8), (293, 0.75), (297.5, 0.6), (466, 0.18)]
    x = sum(g * saw(f * sag * (1 + 0.015 * np.exp(-t / 0.05)), fmax=11000) for f, g in voices)
    x = peak_eq(x, 650, 2.0, 2.5)  # horn-bell formants
    x = peak_eq(x, 1750, 3.0, 1.6)
    x = peak_eq(x, 3100, 4.0, 0.7)
    x = lp(x, 7000)
    x += bp(rng.standard_normal(n), 900, 4000) * 0.06  # breath of the compressed air
    x = np.tanh(0.5 * x) * swell
    rel = int(0.12 * SR)
    x[-rel:] *= np.linspace(1, 0, rel) ** 1.5
    return x


def horns():
    write('horn-start', master(with_reverb(horn(1.4), STADIUM, 0.3)))
    write('horn-long', master(with_reverb(horn(3.0, 0.045), STADIUM, 0.3)))


def fm_note(f, dur, index=1.2, ratio=2.0, tau=None):
    n = int(dur * SR)
    t = np.arange(n) / SR
    tau = tau or dur * 0.3
    mod = index * np.exp(-t / (tau * 0.4)) * np.sin(2 * np.pi * f * ratio * t)
    return np.sin(2 * np.pi * f * t + mod) * np.minimum(1, t / 0.0015) * np.exp(-t / tau)


def hud():
    def seq(notes, total, **kw):
        x = np.zeros(int(total * SR))
        for at, f, d, g in notes:
            place(x, g * fm_note(f, d, **kw), at)
        return x

    write('checkpoint', master(with_reverb(seq([(0, 1318.5, 0.25, 0.8), (0.065, 1760, 0.35, 1)], 0.5), ROOM, 0.18)))
    write('lap-complete', master(with_reverb(
        seq([(0, 987.8, 0.3, 0.7), (0.08, 1318.5, 0.3, 0.8), (0.16, 1661.2, 0.7, 1)], 0.9), ROOM, 0.2)))
    best = seq([(0, 1318.5, 0.4, 0.6), (0.07, 1661.2, 0.4, 0.7), (0.14, 1975.5, 0.5, 0.8), (0.21, 2637, 1.2, 1)], 1.5,
               index=1.6, ratio=3.0)
    best += 0.25 * seq([(0.21, 1318.5, 1.2, 1), (0.21, 1975.5, 1.2, 0.8)], 1.5, index=0.3)  # soft chord under the top
    write('best-lap', master(with_reverb(best, STADIUM, 0.15)))

    n = int(0.4 * SR)
    t = np.arange(n) / SR
    sweep = np.sin(phase(700 * 2 ** np.minimum(1, t / 0.08))) * np.minimum(1, t / 0.002) * np.exp(-t / 0.05) * 0.5
    up = place(sweep, fm_note(1760, 0.3, index=1.4), 0.07)
    write('position-up', master(with_reverb(up, ROOM, 0.18)))
    down = seq([(0, 880, 0.25, 1), (0.09, 659.3, 0.35, 0.9)], 0.5, index=0.7)
    write('position-down', master(with_reverb(lp(down, 5000), ROOM, 0.15)))


def pit_limiter():
    # 1.0 s loop, two dry beeps; silent edges so the wrap is seamless by construction
    x = np.zeros(SR)
    n = int(0.11 * SR)
    t = np.arange(n) / SR
    b = lp(0.5 * square(np.full(n, 1250.0), fmax=6000) + 0.5 * np.sin(2 * np.pi * 1250 * t), 5000)
    b *= np.minimum(1, t / 0.003) * np.minimum(1, (t[-1] - t) / 0.006)
    place(x, b, 0.06)
    place(x, b, 0.56)
    write('pit-limiter-beep', master(x, target=-18.0, loop=True))


def bell():
    dur = 3.2
    n = int(dur * SR)
    t = np.arange(n) / SR
    f = 784.0
    partials = [(0.5, 0.35, 2.2), (1.0, 1.0, 1.6), (1.19, 0.5, 1.1), (1.5, 0.35, 0.9), (2.0, 0.6, 0.8),
                (2.51, 0.3, 0.5), (2.66, 0.25, 0.45), (3.01, 0.2, 0.35), (4.0, 0.15, 0.25), (5.43, 0.08, 0.12)]
    x = np.zeros(n)
    for r, a, tau in partials:
        for det in (-0.4, 0.4):  # pairs a hair apart -> the slow shimmer of a real bell
            x += 0.5 * a * np.sin(2 * np.pi * (f * r + det) * t + rng.uniform(0, 6.28)) * np.exp(-t / tau)
    strike = bp(rng.standard_normal(n), 2000, 10000) * np.exp(-t / 0.003) * 0.6
    x = (x + strike) * np.minimum(1, t / 0.0008)
    write('final-lap-bell', master(with_reverb(x, STADIUM, 0.18)))


if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    for fn in (count_beeps, count_tick, lights_on, lights_out, horns, hud, pit_limiter, bell):
        fn()
