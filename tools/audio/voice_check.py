"""Check recorded booth lines against script.json with local Whisper (faster-whisper, CPU).

python -I tools/audio/voice_check.py <dir-of-mp3-or-ogg> [--out report.json]
Each file is named <line id>.<ext>. For every file: transcript, word match against the script text (audio tags removed),
words the script has that the audio lacks (skipped), words the audio has that the script lacks (added, e.g. a tag read aloud),
and peak / mean level. Exit code 1 if any line needs a listen.
"""
import json, re, subprocess, sys
from difflib import SequenceMatcher
from pathlib import Path

SCRIPT = Path('D:/RaceUltimate/assets/audio/announcers/script.json')
TAGS = re.compile(r'\[[^\]]+\]')
# Whisper spells these differently; compare by sound, not spelling.
ALIASES = {'metres': 'meters', 'penalised': 'penalized', 'parmigiano': 'parmesan', 'favourite': 'favorite', 'harbour': 'harbor',
           'tyres': 'tires', 'tyre': 'tire', 'breaks': 'brakes', 'braking': 'braking', 'breaking': 'braking', 'past': 'passed',
           'alistair': 'alastair', 'cornish': 'corniche', 'mateo': 'matteo', 'leyla': 'layla', 'laila': 'layla'}
JOINS = {'buona sera': 'buonasera', 'andi amo': 'andiamo', 'mama mia': 'mamma mia', 'mamma mia': 'mamma mia'}
ONES = 'zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen'.split()
TENS = 'x x twenty thirty forty fifty sixty seventy eighty ninety'.split()


def spell(n):  # 0-99 as words, so "66" and "sixty-six" compare equal
    n = int(n)
    return ONES[n] if n < 20 else TENS[n // 10] + ('' if n % 10 == 0 else ' ' + ONES[n % 10]) if n < 100 else str(n)


def words(text):
    text = TAGS.sub(' ', text).lower().replace('-', ' ')
    text = re.sub(r'\b\d{1,2}\b', lambda m: spell(m.group()), text)
    for a, b in JOINS.items():
        text = text.replace(a, b)
    return [ALIASES.get(w, w) for w in re.findall(r"[a-z0-9']+", text)]


def level(path):
    err = subprocess.run(['ffmpeg', '-hide_banner', '-i', str(path), '-af', 'volumedetect', '-f', 'null', '-'],
                         capture_output=True, text=True).stderr
    get = lambda k: float(re.search(k + r': (-?[\d.]+) dB', err).group(1))
    return get('mean_volume'), get('max_volume')


def main():
    src = Path(sys.argv[1])
    out = Path(sys.argv[sys.argv.index('--out') + 1]) if '--out' in sys.argv else src / 'check.json'
    lines = {l['id']: l for l in json.loads(SCRIPT.read_text(encoding='utf-8'))['lines']}
    global np
    import numpy as np
    from faster_whisper import WhisperModel
    model = WhisperModel('small.en', device='cpu', compute_type='int8', cpu_threads=6)
    report, bad = [], 0
    for f in sorted(p for p in src.iterdir() if p.suffix in ('.mp3', '.ogg')):
        line = lines.get(f.stem)
        if not line:
            continue
        pcm = subprocess.run(['ffmpeg', '-v', 'error', '-i', str(f), '-ac', '1', '-ar', '16000', '-f', 'f32le', '-'],
                             capture_output=True, check=True).stdout  # ffmpeg, not PyAV: the installed av rejects faster-whisper's open()
        segs, _ = model.transcribe(np.frombuffer(pcm, np.float32), language='en', beam_size=5, vad_filter=False,
                                   initial_prompt='Saetta, Corvid, Kalt, Mojave, Aurum, Sarab, Varrone, Calderini, Ashcombe, '
                                                  'Whitlow, Reiter, Tanabe, Maddox, Quintero, Valois, Lindqvist, Kareem, Qasimi.')
        heard = ' '.join(s.text.strip() for s in segs)
        a, b = words(line['text']), words(heard)
        sm = SequenceMatcher(None, a, b, autojunk=False)
        skipped = [w for op, i1, i2, j1, j2 in sm.get_opcodes() if op in ('delete', 'replace') for w in a[i1:i2]]
        added = [w for op, i1, i2, j1, j2 in sm.get_opcodes() if op in ('insert', 'replace') for w in b[j1:j2]]
        tag_words = set(words(' '.join(t.strip('[]') for t in TAGS.findall(line['text']))))
        tag_read = sorted(tag_words & set(added))
        mean, peak = level(f)
        ratio = round(sm.ratio(), 3)
        flag = ratio < 0.9 or tag_read or skipped or mean < -30
        bad += bool(flag)
        report.append({'id': f.stem, 'match': ratio, 'flag': bool(flag), 'skipped': skipped, 'added': added, 'tag_read': tag_read,
                       'mean_db': mean, 'peak_db': peak, 'heard': heard, 'script': line['text']})
        print(f"{'LISTEN' if flag else 'ok    '} {ratio:.3f} {mean:6.1f}dB {f.stem}  skipped={skipped} added={added}", flush=True)
    out.write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding='utf-8')
    print(f'{len(report)} checked, {bad} to listen to -> {out}')
    sys.exit(1 if bad else 0)


if __name__ == '__main__':
    main()
