"""QA every delivered .ogg under the audio root: decode, codec, loudness, true peak, loop seams.
Usage: python tools/audio_qa.py <audio_root> <out.json>"""
import json, os, re, subprocess, sys
import numpy as np

root, out = sys.argv[1], sys.argv[2]
LOOPS = {"crash/scrape-loop.ogg", "crowd/ambience-loop.ogg", "exhaust/burble-loop.ogg",
         "nitro/nitro-loop.ogg", "race/pit-limiter-beep.ogg"}

def probe(p):
    r = subprocess.run(["ffprobe", "-v", "error", "-show_entries",
                        "stream=codec_name,channels,sample_rate:format=duration", "-of", "json", p],
                       capture_output=True, text=True)
    j = json.loads(r.stdout)
    s = j["streams"][0]
    return s["codec_name"], int(s["channels"]), int(s["sample_rate"]), float(j["format"]["duration"])

def loud(p):
    r = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", p, "-af", "ebur128=peak=true",
                        "-f", "null", "-"], capture_output=True, text=True)
    tail = r.stderr[r.stderr.rfind("Summary:"):]
    i = re.search(r"I:\s+(-?[\d.]+|-inf) LUFS", tail)
    tp = re.search(r"Peak:\s+(-?[\d.]+|-inf) dBFS", tail)
    f = lambda m: None if not m or "inf" in m.group(1) else float(m.group(1))
    return f(i), f(tp)

def decode(p):
    r = subprocess.run(["ffmpeg", "-v", "error", "-i", p, "-f", "f32le", "-ac", "1", "-ar", "48000", "-"],
                       capture_output=True)
    return np.frombuffer(r.stdout, dtype=np.float32)

def rms_db(x):
    return 20 * np.log10(np.sqrt(np.mean(x.astype(np.float64) ** 2)) + 1e-12)

def seam(x):
    n = 2400  # 50 ms at 48 kHz
    head, tail = rms_db(x[:n]), rms_db(x[-n:])
    steps = np.abs(np.diff(x))
    jump = abs(float(x[0]) - float(x[-1]))
    p99 = float(np.percentile(steps, 99))
    return {"head_db": round(head, 2), "tail_db": round(tail, 2), "level_step_db": round(abs(head - tail), 2),
            "wrap_jump": round(jump, 5), "p99_step": round(p99, 5), "click": bool(jump > 2 * p99 + 1e-4)}

res = []
for dp, dn, fn in os.walk(root):
    if "src" in os.path.relpath(dp, root).split(os.sep):
        continue
    for f in sorted(fn):
        if not f.endswith(".ogg"):
            continue
        p = os.path.join(dp, f)
        rel = os.path.relpath(p, root).replace(os.sep, "/")
        e = {"file": rel}
        try:
            e["codec"], e["channels"], e["rate"], e["probe_s"] = probe(p)
            e["lufs"], e["peak_dbtp"] = loud(p)
            x = decode(p)
            e["decoded_s"] = round(len(x) / 48000, 3)
            e["loop"] = rel.startswith("engines/") and not rel.endswith(("start.ogg", "rev.ogg")) or rel in LOOPS
            if e["loop"]:
                e["seam"] = seam(x)
        except Exception as ex:  # keep going, report the failure
            e["error"] = repr(ex)
        res.append(e)
        print(rel, e.get("codec"), e.get("lufs"), e.get("peak_dbtp"), e.get("decoded_s"), e.get("seam", ""), e.get("error", ""))

json.dump(res, open(out, "w"), indent=1)
print(len(res), "files")
