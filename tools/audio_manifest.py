"""Build manifest.json + CREDITS.md for D:/RaceUltimate/assets/audio from qa.json (measured) and the agents' reports.
Usage: python tools/audio_manifest.py qa.json <audio_root>"""
import json, sys, os

qa = {e["file"]: e for e in json.load(open(sys.argv[1]))}
root = sys.argv[2]

EL = "ElevenLabs Sound Effects v2 (flow {})"
EL_LIC = "ElevenLabs output, owned by the account holder; commercial use per the ElevenLabs plan terms"
SYN = "Synthesized locally (tools/synth_race_sfx.py)"
FLOW = {"A": "Wx3qSx2RYwCpxjsTYJdy", "B": "uBB7DNn414WC2zS5V9Mc", "X": "4fyCMWvOTbYgPjwIGNFk", "C": "jBXwc4f540OcA5MQrdlp"}

PROFILES = {
    "v8-flatplane": ("A", 8000, "Twin-turbo flat-plane V8 supercar: raspy snarl, turbo whistle", ["furari-488", "mclaren"],
                     dict(idle=1000, low=2400, mid=4800, high=7200, decel=4000)),
    "na-v12-screamer": ("A", 10500, "Naturally aspirated V12 hypercar: smooth metallic howl to a high shriek", ["lambo2", "aston-martin-valk", "nuvolari"],
                        dict(idle=1100, low=3200, mid=6300, high=9500, decel=5000)),
    "v8-crossplane": ("A", 7000, "Big cross-plane V8 muscle car: deep lumpy burble, thunderous roar", ["mustang"],
                      dict(idle=900, low=2100, mid=4200, high=6300, decel=3500)),
    "flat-six": ("A", 9000, "NA flat-six sports car: dry boxer clatter, metallic rasp, induction howl", ["porsche1"],
                 dict(idle=1000, low=2700, mid=5400, high=8100, decel=4500)),
    "w16-quadturbo": ("B", 6800, "Quad-turbo W16 hypercar: deep smooth roar under heavy turbo whoosh", ["buggati", "bentley-gt"],
                      dict(idle=1000, low=2000, mid=4100, high=6100, decel=3500)),
    "inline-six": ("B", 7500, "Turbo straight-six: silky even hum to a high metallic howl", ["bmw1", "jaguarxkjss"],
                   dict(idle=950, low=2250, mid=4500, high=6750, decel=4000)),
    "ev-performance": ("B", 20000, "Performance EV: motor and gear whine, inverter tone (motor rpm, ~20000 max)", ["tesla1"],
                       dict(idle=0, low=6000, mid=12000, high=18000, decel=10000)),
}
ENGINE_DESC = {
    "idle": "Idle loop", "load-low": "Light-load loop", "load-mid": "Mid-load loop", "load-high": "Full-throttle loop near redline",
    "decel": "Off-throttle overrun loop (crackle/burble; EV: regen whine)", "start": "Cold start settling to idle (one-shot; crossfade into idle)",
    "rev": "Stationary throttle blip and back (one-shot)",
}
ENGINE_NOTES = {
    "v8-flatplane/decel": "peak-capped, quieter", "v8-flatplane/start": "limiter-held, quieter", "v8-flatplane/rev": "starts high and falls, no clear rise: audition",
    "na-v12-screamer/start": "limiter-held, quieter", "flat-six/decel": "peak-capped, quieter", "w16-quadturbo/idle": "peak-capped, quieter",
    "ev-performance/idle": "standstill hum, ~428 Hz", "ev-performance/load-low": "~785 Hz", "ev-performance/load-mid": "~1265 Hz",
    "ev-performance/load-high": "~1360 Hz, barely above mid", "ev-performance/decel": "~1440 Hz, above mid",
    "ev-performance/start": "generic two-note chime then hum",
}
# engines-b prompts exist only in the agent report, so they are kept here (engines-a prompts are in each profile's manifest.json)
B_PROMPTS = {
    "w16-quadturbo/idle": "Seamless loop: quad-turbo W16 hypercar engine idling steadily at 1000 rpm, exterior rear perspective, deep smooth burbling exhaust, faint turbo whistle, constant level, no music, no voices",
    "w16-quadturbo/load-low": "Seamless loop: quad-turbo W16 hypercar engine under steady light throttle at a constant 2000 rpm, exterior chase perspective from behind, deep smooth exhaust roar with gentle turbo spool, constant pitch, no tyre noise, no gear shifts, no music, no voices",
    "w16-quadturbo/load-mid": "Seamless loop: quad-turbo W16 hypercar engine under steady heavy throttle at a constant 4100 rpm, exterior chase perspective from behind, deep smooth exhaust roar with heavy turbo whoosh, constant pitch, no tyre noise, no gear shifts, no music, no voices",
    "w16-quadturbo/load-high": "Seamless loop: quad-turbo W16 hypercar engine at full throttle held at a constant 6100 rpm, exterior chase perspective from behind, intense deep smooth roar with loud turbo whine and whoosh, constant pitch, no tyre noise, no gear shifts, no music, no voices",
    "w16-quadturbo/decel": "Seamless loop: quad-turbo W16 hypercar coasting off throttle at a steady 3500 rpm, exterior rear perspective, low burbling exhaust overrun with turbo flutter and light crackles, constant level, no tyre noise, no music, no voices",
    "w16-quadturbo/start": "Quad-turbo W16 hypercar cold start, exterior rear: starter motor whirr, deep ignition roar flaring to 2500 rpm, then settling to a smooth low burbling idle, no music, no voices",
    "w16-quadturbo/rev": "Stationary quad-turbo W16 hypercar single throttle blip: revs from idle up to 6500 rpm with turbo spool, then falls back to idle with a turbo blow-off whoosh, exterior, no music, no voices",
    "inline-six/idle": "Seamless loop: turbocharged straight-six sports car engine idling steadily at 950 rpm, exterior rear perspective, smooth even exhaust burble, faint turbo hiss, constant level, no music, no voices",
    "inline-six/load-low": "Seamless loop: turbocharged straight-six sports car engine under steady light throttle at a constant 2250 rpm, exterior chase perspective from behind, smooth silky exhaust hum with soft turbo hiss, constant pitch, no tyre noise, no gear shifts, no music, no voices",
    "inline-six/load-mid": "Seamless loop: turbocharged straight-six sports car engine under steady heavy throttle at a constant 4500 rpm, exterior chase perspective from behind, smooth silky howling exhaust with turbo hiss, constant pitch, no tyre noise, no gear shifts, no music, no voices",
    "inline-six/load-high": "Seamless loop: turbocharged straight-six sports car engine at full throttle held at a constant 6750 rpm, exterior chase perspective from behind, high smooth metallic howl with turbo whistle, constant pitch, no tyre noise, no gear shifts, no music, no voices",
    "inline-six/decel": "Seamless loop: turbocharged straight-six sports car coasting off throttle at a steady 4000 rpm, exterior rear perspective, smooth exhaust overrun with crackles and pops and turbo flutter, constant level, no tyre noise, no music, no voices",
    "inline-six/start": "Turbocharged straight-six sports car cold start, exterior rear: starter motor crank, engine catches with a sharp rev flare to 2500 rpm, then settles to a smooth even idle, no music, no voices",
    "inline-six/rev": "Stationary turbocharged straight-six sports car single throttle blip: revs from idle up to 7200 rpm with a silky howl, then falls back to idle with a turbo hiss, exterior, no music, no voices",
    "ev-performance/idle": "Seamless loop: electric performance car powered on at standstill, quiet steady electric motor hum and soft high inverter tone, subtle synthetic drone, constant level, no combustion engine, no music, no voices",
    "ev-performance/load-low": "Seamless loop: electric performance car under steady light acceleration, electric motor at a constant 6000 rpm, low steady motor whine with gear whine and inverter hum, constant pitch, exterior chase perspective, no combustion engine, no tyre noise, no wind, no music, no voices",
    "ev-performance/load-mid": "Seamless loop: electric performance car under steady hard acceleration, electric motor at a constant 12000 rpm, steady mid-pitch motor whine with gear whine and inverter tone, constant pitch, exterior chase perspective, no combustion engine, no tyre noise, no wind, no music, no voices",
    "ev-performance/load-high": "Seamless loop: electric performance car at full power, electric motor at a constant 18000 rpm, intense high-pitched steady motor whine with gear whine and synthetic inverter scream, constant pitch, exterior chase perspective, no combustion engine, no tyre noise, no wind, no music, no voices",
    "ev-performance/decel": "Seamless loop: electric car motor regenerative braking whine, clear steady high-pitched electric motor and gearbox whine at constant pitch, close exterior perspective, loud and present, no combustion engine, no tyre noise, no wind, no music, no voices",
    "ev-performance/start": "Electric car power-on: a short soft two-note synthetic chime, then a rising electric hum that settles into a quiet steady motor hum, futuristic, no combustion engine, no music, no voices",
    "ev-performance/rev": "Stationary electric performance car brief motor whine sweep: electric motor and inverter whine rising quickly to a high pitch, then falling back down to a quiet hum, no combustion engine, no music, no voices",
}

FS = "https://freesound.org/people/{}/sounds/{}"
CC0 = "Creative Commons 0"
# file -> (desc, source, license)
OTHER = {
    "exhaust/pop-1": ("Small sharp single exhaust tick (sparse: add gain in mixer)", "X"),
    "exhaust/pop-2": ("Medium punchy exhaust pop (take 2; faint noise floor in tail)", "X"),
    "exhaust/pop-3": ("Big deep exhaust bang with a short metallic ring", "X"),
    "exhaust/crackle-1": ("Lift-off crackle burst, rapid pops fading out (sparse: add gain)", "X"),
    "exhaust/crackle-2": ("Irregular sparse overrun crackle, bangs and ticks (sparse: add gain)", "X"),
    "exhaust/crackle-3": ("Short tight machine-gun crackle burst", "X"),
    "exhaust/burble-loop": ("Loop: mid-rpm overrun burble and crackle for long lifts", "X"),
    "exhaust/backfire-1": ("Loud single backfire bang with a deep flame whump", "X"),
    "exhaust/backfire-2": ("Violent gunshot-like backfire crack then fiery whoomph", "X"),
    "exhaust/shift-pop-1": ("Upshift ignition-cut bark plus one pop", "X"),
    "exhaust/shift-pop-2": ("Sequential flat-shift blip cut with a crisp exhaust crack", "X"),
    "nitro/nitro-start": ("Boost kick: pressurised gas whoosh plus engine surge", "X"),
    "nitro/nitro-loop": ("Loop: sustained boost, hissing jet roar over a strained engine", "X"),
    "nitro/nitro-end": ("Boost cut-off: pressure-drop hiss with a whoosh tail", "X"),
    "nitro/nitro-ready": ("Nitro armed: valve click plus a rising hiss", "X"),
    "crash/soft-1": ("Soft crash: low-speed bump into a plastic barrier", "C"),
    "crash/soft-2": ("Soft crash: two cars rubbing, carbon panel scrape and knock", "C"),
    "crash/soft-3": ("Soft crash: nudge into a foam barrier, muffled thump", "C"),
    "crash/scrape-loop": ("Loop: body grinding along a concrete wall, spark hiss", "C"),
    "crash/hard-1": ("Hard crash into a tyre wall: crunch, debris, glass shatter", "C"),
    "crash/hard-2": ("Hard crash into concrete: violent crunch, parts, glass shatter (source was hot: audition for clipping)", "C"),
    "crash/hard-3": ("Hard crash car into car: metal-on-metal, panels, glass (source was hot: audition for clipping)", "C"),
    "crash/glass-tinkle-1": ("Glass fragments crackling and settling, layer for hard crashes", "C"),
    "crash/glass-tinkle-2": ("Windscreen pieces falling and sliding, layer for hard crashes", "C"),
    "crash/tyre-wall-hit": ("Car thumping into a tyre stack, rubbery bounce thud", "C"),
    "race/count-3": ("Countdown beep 3 (880 Hz, stadium PA)", "S"),
    "race/count-2": ("Countdown beep 2 (identical to count-3)", "S"),
    "race/count-1": ("Countdown beep 1 (identical to count-3)", "S"),
    "race/count-go": ("GO tone, octave up at 1760 Hz", "S"),
    "race/count-tick": ("Soft dry 70 ms tick for menus and lap counters (too short for integrated LUFS; ~-21.8 by BS.1770 estimate)", "S"),
    "race/lights-on": ("Start-light clack with ballast hum, once per red light", "S"),
    "race/lights-out": ("Lights out: relay snap and low thunk", "S"),
    "race/horn-start": ("Race-start stadium air horn, 1.4 s blast", "S"),
    "race/horn-long": ("Air horn held 3 s, endurance start or finish", "S"),
    "race/checkpoint": ("HUD checkpoint cue, two rising bell notes", "S"),
    "race/lap-complete": ("Lap complete, rising three-note arpeggio", "S"),
    "race/best-lap": ("Best lap, brighter four-note rise", "S"),
    "race/position-up": ("Position gained, upward sweep into a blip", "S"),
    "race/position-down": ("Position lost, two falling notes", "S"),
    "race/pit-limiter-beep": ("Loop: pit-limiter nag, two beeps per second (-18 LUFS)", "S"),
    "race/final-lap-bell": ("Final-lap bell, one strike with stadium reverb", "S"),
    "crowd/ambience-loop": ("Loop: grandstand crowd murmur bed (-20 LUFS on purpose)", ("Soccer Stadium 10.wav by Sandermotions, " + FS.format("Sandermotions", 494360))),
    "crowd/cheer-big": ("Winner roar: goal roar layered with whistles and whoops", ("19 Football Crowd - Reaction To Goal.flac by D.jones, " + FS.format("D.jones", 528799) + " + crowd ext large cheering parade +whistling loud close Montreal, Canada.flac by kyles, " + FS.format("kyles", 637438))),
    "crowd/cheer-medium": ("Overtake/podium cheer swell", ("College Football Game.wav by timmyg62, " + FS.format("timmyg62", 328623))),
    "crowd/hoots": ("Scattered whistles, whoops and hoots over cheering", ("crowd ext cheering whistling crazy.flac by kyles, " + FS.format("kyles", 453863))),
    "crowd/applause": ("Sustained applause (theatre perspective, not open-air)", ("Applause Crowd Theater.wav by Jedo, " + FS.format("Jedo", 396549))),
    "crowd/groan": ("Disappointed 'ohhh' for crash or spin (small group)", ("crowd `oh - - disappointed.mp3 by mrrap4food, " + FS.format("mrrap4food", 619007))),
    "crowd/gasp": ("Sharp collective gasp for a near miss (small crowd)", ("R27-20-Small Crowd Gasps.wav by craigsmith, " + FS.format("craigsmith", 480774))),
    "fireworks/big-finale": ("Winner finale: barrage into three big salutes (faint motorbikes underneath)", ("finale.aif by Heigh-hoo, " + FS.format("Heigh-hoo", 21411))),
    "fireworks/small-1": ("Opening show A: medium-distance bursts with fizz (sparse: add ~6 dB)", ("Fireworks - explode and fizz.wav by soundmary, " + FS.format("soundmary", 117615))),
    "fireworks/small-2": ("Opening show B: two large shell bursts with crackling tails", ("Shells1.mp3 by Mr Sensible, " + FS.format("Mr%20Sensible", 14742))),
    "fireworks/crackle": ("Dense crackling-star tail, layer", ("MrSensibleFireworks.mp3 by Mr Sensible, " + FS.format("Mr%20Sensible", 27757))),
    "fireworks/whistle-rockets": ("Whistling rockets with pops", ("S18-18 Whistling rockets.wav by craigsmith, " + FS.format("craigsmith", 675779))),
    "fireworks/single-boom-1": ("Single loud aerial shell boom with far echo", ("NYE Single Boom.wav by LOVEBURD, " + FS.format("LOVEBURD", 376660))),
    "fireworks/single-boom-2": ("Single shell boom with long building reflections", ("Fireworks single.wav by pethr, " + FS.format("pethr", 552403))),
}

def src_lic(code):
    if code in FLOW:
        return EL.format(FLOW[code]), EL_LIC
    if code == "S":
        return SYN, "Original work for Ultrack"
    return code, CC0

assets, missing_meta = [], []
for f, m in sorted(qa.items()):
    key = f[:-4]
    a = {"id": key, "file": f, "category": f.split("/")[0]}
    if f.startswith("engines/"):
        prof, kind = key.split("/")[1:]
        batch, redline, pdesc, cars, rpms = PROFILES[prof]
        a["category"] = "engine"
        a["profile"] = prof
        k = kind.replace("load-", "")
        if k in rpms:
            a["rpm"] = rpms[k]
        note = ENGINE_NOTES.get(f"{prof}/{kind}")
        desc = f"{prof} {ENGINE_DESC[kind].lower()}" + (f" ({note})" if note else "")
        source, lic = src_lic(batch)
    else:
        if key not in OTHER:
            missing_meta.append(f); continue
        desc, code = OTHER[key]
        source, lic = src_lic(code)
    a.update(loop=bool(m.get("loop")), seconds=m["decoded_s"],
             lufs=None if key == "race/count-tick" else m["lufs"], peak_dbtp=m["peak_dbtp"],
             channels=m["channels"], desc=desc, source=source, license=lic)
    if f.startswith("engines/") and f"{a['profile']}/{f.split('/')[2][:-4]}" in B_PROMPTS:
        a["prompt"] = B_PROMPTS[f"{a['profile']}/{f.split('/')[2][:-4]}"]
    assets.append(a)

assert not missing_meta, missing_meta
assert len(assets) == len(qa)

profiles = {}
for p, (batch, redline, desc, cars, rpms) in PROFILES.items():
    loops = {}
    for k, r in rpms.items():
        f = f"engines/{p}/{'load-' + k if k in ('low', 'mid', 'high') else k}.ogg"
        assert f in qa, f
        loops[k] = {"file": f, "rpm": r}
    profiles[p] = {"desc": desc, "redline": redline, "cars": cars, "loops": loops,
                   "start": f"engines/{p}/start.ogg", "rev": f"engines/{p}/rev.ogg"}
allcars = sorted(c for v in PROFILES.values() for c in v[3])
assert len(allcars) == 12 and len(set(allcars)) == 12

man = {"version": 1, "format": "ogg/opus 48k", "assets": assets, "engineProfiles": profiles}
json.dump(man, open(os.path.join(root, "manifest.json"), "w", encoding="utf-8", newline="\n"), indent=1, ensure_ascii=False)

# CREDITS.md
L = ["# Ultrack audio: credits", "",
     "Every delivered file, its source and its license. Measured values are in `manifest.json`.", "",
     "- **ElevenLabs Sound Effects v2** outputs are owned by the account holder; commercial use per the ElevenLabs plan terms. Flows: engines A `Wx3qSx2RYwCpxjsTYJdy`, engines B `uBB7DNn414WC2zS5V9Mc`, exhaust + nitro `4fyCMWvOTbYgPjwIGNFk`, crash `jBXwc4f540OcA5MQrdlp`. Prompts: engines A in `engines/<profile>/manifest.json`, engines B in `manifest.json` (`prompt`), exhaust/nitro/crash in their folder `CREDITS.md`. Originals (MP3) in each folder's `src/`.",
     "- **CC0 recordings** from Freesound, each licence checked on its Freesound page (Creative Commons 0). Originals (Freesound HQ previews) in `crowd/src` and `fireworks/src`. Attribution is not required but is given.",
     "- **Synthesized** race sounds: original work for Ultrack, made by `tools/synth_race_sfx.py` (masters in `race/src`).", "",
     "| file | source | license |", "|---|---|---|"]
for a in assets:
    L.append(f"| {a['file']} | {a['source']} | {a['license']} |")
L += ["", "Not audio assets yet: `announcers/script.json` and `SCRIPT.md` are an original script for Ultrack. `announcers/voice-previews/*.mp3` are voice previews whose provenance is not recorded here; they are not listed in the manifest."]
open(os.path.join(root, "CREDITS.md"), "w", encoding="utf-8", newline="\n").write("\n".join(L) + "\n")
print(len(assets), "assets;", len(profiles), "profiles")
