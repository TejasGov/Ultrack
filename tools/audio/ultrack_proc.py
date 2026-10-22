"""Process Ultrack exhaust/nitro SFX: trim, fade, loudness, loop seams, Ogg Opus encode.
usage: python -I ultrack_proc.py <audio_root>"""
import json, re, subprocess, sys
from pathlib import Path
import numpy as np

BIN = Path(r"C:\ffmpeg\ffmpeg-8.0-essentials_build\bin")
FF, SR = str(BIN / "ffmpeg.exe"), 48000
ROOT = Path(sys.argv[1])
TARGET_I, TP_MAX, LIMIT_DB = -16.0, -1.0, 5.0

def decode(path, ch):
    raw = subprocess.run([FF, "-v", "error", "-i", str(path), "-f", "f32le", "-ac", str(ch), "-ar", str(SR), "-"],
                         capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.float32).reshape(-1, ch).copy()

def encode(x, out, kbps, gain_db, limit=False):
    ch = x.shape[1]
    # limiter only on peaky one-shots; it shaves at most LIMIT_DB off transients (lookahead, no auto-level)
    af = f"volume={gain_db:.3f}dB" + (",alimiter=limit=0.7079:attack=1:release=40:level=0" if limit else "")
    subprocess.run([FF, "-v", "error", "-y", "-f", "f32le", "-ar", str(SR), "-ac", str(ch), "-i", "-",
                    "-af", af, "-c:a", "libopus", "-b:a", f"{kbps}k", "-ar", str(SR),
                    "-vbr", "on", "-application", "audio", str(out)],
                   input=x.astype(np.float32).tobytes(), check=True)

def measure(x):
    """Integrated LUFS and true peak via ebur128 (pads a short clip with silence so it gets a full gating block)."""
    ch = x.shape[1]
    pad = np.zeros((int(0.5 * SR), ch), np.float32)
    r = subprocess.run([FF, "-hide_banner", "-nostats", "-f", "f32le", "-ar", str(SR), "-ac", str(ch), "-i", "-",
                        "-af", "ebur128=peak=true", "-f", "null", "-"],
                       input=np.vstack([x, pad]).astype(np.float32).tobytes(), capture_output=True)
    s = r.stderr.decode(errors="replace").split("Summary:")[-1]
    I = float(re.search(r"I:\s+(-?[\d.]+|-inf)", s).group(1).replace("-inf", "-99"))
    tp = float(re.search(r"Peak:\s+(-?[\d.]+|-inf)", s).group(1).replace("-inf", "-99"))
    return I, tp

def rms_db(a):
    return 20 * np.log10(np.sqrt(np.mean(a.astype(np.float64) ** 2)) + 1e-12)

def seam(x):
    """Level step and sample jump across the loop point (end -> start), first channel."""
    n = int(0.02 * SR); m = x[:, 0].astype(np.float64)
    d = np.abs(np.diff(m)); typ = np.percentile(d, 99)
    return {"rms_head_db": round(rms_db(m[:n]), 2), "rms_tail_db": round(rms_db(m[-n:]), 2),
            "level_step_db": round(abs(rms_db(m[:n]) - rms_db(m[-n:])), 2),
            "dc_head": round(float(m[:n].mean()), 5), "dc_tail": round(float(m[-n:].mean()), 5),
            "wrap_jump_vs_p99": round(float(abs(m[0] - m[-1]) / (typ + 1e-12)), 2)}

def steady(x):
    w = int(0.25 * SR); m = x[:, 0]
    v = [rms_db(m[i:i + w]) for i in range(0, len(m) - w + 1, w)]
    return round(max(v) - min(v), 2)

def xfade_loop(x, ms=250):
    c = int(ms / 1000 * SR); n = len(x)
    t = np.linspace(0, np.pi / 2, c)[:, None]
    y = x[: n - c].copy()
    y[:c] = x[:c] * np.sin(t) + x[n - c:] * np.cos(t)  # equal-power: tail flows into head
    return y

def oneshot(src, out):
    x = decode(src, 2)
    peak = np.abs(x).max(axis=1)
    thr = max(peak.max() * 10 ** (-40 / 20), 10 ** (-60 / 20))
    on = int(np.argmax(peak > thr))
    lead = min(on, int(0.004 * SR))  # keep < 10 ms ahead of the transient
    x = x[on - lead:]
    # drop trailing near-silence, then a short fade on the tail
    above = np.nonzero(peak[on - lead:] > peak.max() * 10 ** (-60 / 20))[0]
    x = x[: above[-1] + 1 + int(0.02 * SR)]
    f = min(int(0.03 * SR), len(x) // 6)
    x[-f:] *= np.linspace(1, 0, f)[:, None] ** 2
    return finish(x, out, 128, {"lead_ms": round(lead / SR * 1000, 2), "trimmed_ms": round((on - lead) / SR * 1000, 1)})

def loop(src, out):
    x = decode(src, 1)
    info = {"seam_before": seam(x)}
    s = info["seam_before"]
    if s["level_step_db"] > 1.5 or s["wrap_jump_vs_p99"] > 1.0 or abs(s["dc_head"] - s["dc_tail"]) > 0.005:
        x = xfade_loop(x); info["crossfaded_ms"] = 250
    x = x - x.mean()  # no DC
    info["seam_after"] = seam(x); info["steady_range_db_250ms"] = steady(x)
    return finish(x, out, 112, info)

def finish(x, out, kbps, info):
    I, tp = measure(x)
    loopy = kbps == 112
    # limiter ceiling is -3 dBFS; allow up to LIMIT_DB of peak reduction above it on one-shots
    gain = min(TARGET_I - I, (TP_MAX - 0.5) - tp if loopy else -3.0 + LIMIT_DB - tp)
    for _ in range(4):
        encode(x, out, kbps, gain, limit=not loopy)
        y = decode(out, x.shape[1])
        I2, tp2 = measure(y)
        if tp2 <= TP_MAX: break
        gain -= (tp2 - TP_MAX) + 0.2
    info.update(src_I=round(I, 2), src_tp=round(tp, 2), gain_db=round(gain, 2), out_I=round(I2, 2),
                out_tp=round(tp2, 2), out_dur=round(len(y) / SR, 3), kbps=kbps, channels=x.shape[1])
    if kbps == 112: info["seam_encoded"] = seam(y)
    return info

report = {}
for cat in ("exhaust", "nitro"):
    for src in sorted((ROOT / cat / "src").glob("*.mp3")):
        out = ROOT / cat / (src.stem + ".ogg")
        report[f"{cat}/{out.name}"] = (loop if src.stem.endswith("-loop") else oneshot)(src, out)
print(json.dumps(report, indent=1))
