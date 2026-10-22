# Ultrack audio

## Current engine bank — 2026-10-20

The game now uses **real YouTube recordings for all 14 combustion cars** (9 recordings; the Porsche 918, Destrier, Blackbird, Huracan and LaFerrari share another car's, see `sharedWith` in the bank), selected from videos whose captured metadata explicitly allows Creative Commons reuse. Announcer recordings, scripts, PA processing, crowd, race cues and crashes are unchanged. Tesla and Audi retain their quiet procedural EV audio.

- `recorded-engine-bank.json`: active per-car idle/low/mid/high/overrun layers.
- `recordings/plan.json`: exact source video IDs, trim times and estimated RPM anchors.
- [Recording credits](recordings/CREDITS.md): authors, source links, CC BY 3.0 licence and modifications. The same credits appear in the game's Credits screen.
- `recordings/src/`: original audio and captured YouTube licence metadata, excluded from the shipped game.
- `recordings/receipts.json`: source/output SHA-256 hashes and measured sample levels.
- `engines/recorded/`: 45 mono Opus loops (~253 KB total) and 9 unlooped comparison excerpts (~1.6 MB). Gameplay requests only the selected car's five loops; excerpts load only on the listening page.

Generated V1 engine/exhaust/boost sounds have no runtime fallback and are excluded from public asset sync. Random added bangs/pops are disabled; shifts briefly dip the real engine level. Boost gives a small engine-level lift. The V1 masters (`engines/<profile>/`, `exhaust/`, `nitro/`) were moved on 2026-10-21 to `_archive/2026-10-21/assets/audio/` (see `_archive/2026-10-21/MANIFEST.md`); the retired Porsche 911 recording went with them.

Listen at **http://127.0.0.1:5180/audio-lab.html**. This uses the actual game mixer, manual RPM/throttle controls, an acceleration/lift preview and a source player. Source-derived previews still require listening review; decode/peak tests do not establish sound quality. In particular, the AMG ONE source only covers low-speed running: its high-RPM layers are transposed and need a better full-load recording. Other stated model/exhaust differences are in the bank's `match` fields. RPM anchors are estimates, not measured dyno data.

```powershell
python tools/audio/build_recorded_engines.py
npm --prefix track-viewer run sync
python tools/audio/verify_recorded_engines.py
npm --prefix track-viewer run test:v2
npm --prefix track-viewer run build
```

`find_recordings.py` searches the YouTube Creative Commons filter and captures metadata; it never downloads search hits. The builder requires captured CC permission and rejects uploaders explicitly disclaiming ownership. Original audio was fetched with yt-dlp in its best audio format, then encoded directly to Opus to avoid an additional MP3 transcode.

## Archived V1 documentation

The following describes the original bank retained for provenance. The `engines/<profile>/`, `exhaust/` and `nitro/` files it names now live in `_archive/2026-10-21/assets/audio/`; `crash/`, `crowd/`, `race/` and `fireworks/` are still here and in use. Its engine/exhaust/nitro usage and generation instructions are superseded by the active workflow above; do not regenerate or restore those effects.

104 game sounds as Ogg Opus, 48 kHz (about 6 MB), plus the announcer script. `manifest.json` lists every file with its id, category, loop flag, length, measured loudness (LUFS) and true peak (dBTP), and maps all 12 cars to 7 engine profiles. `CREDITS.md` gives the source and license of every file.

Nothing here has been checked by ear. The checks were by measurement only (decode, loudness, peaks, loop seams). Listen to everything before you ship it.

## Folder map

| folder | what | files |
|---|---|---|
| `engines/<profile>/` | idle, load-low, load-mid, load-high, decel (loops, mono) + start, rev (one-shots) | 7 profiles x 7 |
| `exhaust/` | pops, crackles, backfires, shift pops, burble-loop | 11 |
| `nitro/` | nitro-ready, nitro-start, nitro-loop, nitro-end | 4 |
| `crash/` | soft-1..3, hard-1..3 (glass already in them), glass-tinkle-1..2, tyre-wall-hit, scrape-loop | 10 |
| `race/` | countdown 3/2/1/GO, tick, start lights, air horns, checkpoint, lap, best lap, position up/down, pit limiter loop, final-lap bell | 16 |
| `crowd/` | ambience-loop, cheer-big, cheer-medium, hoots, applause, groan, gasp | 7 |
| `fireworks/` | small-1, small-2 (opening), big-finale (winner), crackle, whistle-rockets, single-boom-1..2 | 7 |
| `announcers/` | `script.json` (371 lines: Enzo Moretti 182, Alastair Finch 184, Kavya Iyer 5) and `SCRIPT.md`; `enzo/` and `alastair/` hold the voiced lines as `<id>.ogg`, listed in `voice_manifest.json` (file, seconds, speaker, category); `voice-previews/` mp3s | 366 voiced (182 + 184) |
| `*/src/` | originals (ElevenLabs MP3, Freesound previews, synth WAV masters) | not shipped |

## Engine profiles

| profile | cars | redline | loop rpm (idle / low / mid / high / decel) |
|---|---|---|---|
| v8-flatplane | furari-488, mclaren | 8000 | 1000 / 2400 / 4800 / 7200 / 4000 |
| na-v12-screamer | lambo2, aston-martin-valk | 10500 | 1100 / 3200 / 6300 / 9500 / 5000 |
| v8-crossplane | mustang | 7000 | 900 / 2100 / 4200 / 6300 / 3500 |
| flat-six | porsche1 | 9000 | 1000 / 2700 / 5400 / 8100 / 4500 |
| w16-quadturbo | buggati, bentley-gt | 6800 | 1000 / 2000 / 4100 / 6100 / 3500 |
| inline-six | bmw1, jaguarxkjss | 7500 | 950 / 2250 / 4500 / 6750 / 4000 |
| ev-performance | (none; the EV bank was never shipped) | ~20000 motor rpm | 0 / 6000 / 12000 / 18000 / 10000 |

The rpm values are what the prompts asked for. The generator does not guarantee pitch, so tune each layer's reference rpm by ear. The EV layers barely rise from mid to high (about 1265 Hz to 1360 Hz), so the pitch shift has to carry most of the rise there.

## How the game should use it

Use the Web Audio API: decode each file once into an `AudioBuffer` and play loops with `AudioBufferSourceNode.loop = true`. An `<audio>` element leaves a gap at the loop point.

**Engine.**
- Run idle, low, mid and high all the time.
- Crossfade between the two layers on either side of the current rpm with equal-power curves: `gainA = cos(x·π/2)`, `gainB = sin(x·π/2)`, where x is 0..1 between their reference rpms.
- Pitch each layer by `playbackRate = rpm / layerRpm`, clamped to ±15% (0.85 to 1.15).
- Throttle sets the overall level. All loops are mastered to about the same loudness, so the game sets the level of each layer. A few loops are quieter because the peak limit held them back (see `lufs` in the manifest).
- On lift-off, fade the decel layer in over the load layers. It is pitched the same way around its own rpm.
- `start` is a one-shot that ends still idling. Crossfade it into the idle loop over about 0.3 s. `rev` is the grid blip.

**Pops and crackles.** On lift-off above about 60% of redline, fire a random pick from `exhaust/pop-*`, `crackle-*` and `backfire-*` every 80-400 ms for about a second. Vary pitch ±5% and level ±3 dB. Fire `shift-pop-*` on upshifts. Use `burble-loop` for long lifts. pop-1, crackle-1 and crackle-2 are sparse and quieter (-22 to -25 LUFS), so add 6-8 dB of gain to them.

**Nitro.** Play `nitro-ready` when the tank fills. On boost, play `nitro-start`, then from about 0.8 s crossfade into `nitro-loop`. On release, fade the loop over 100 ms and play `nitro-end`.

**Crashes.**
- Pick by impact speed: under about 40 km/h, a random `soft-*` (or `tyre-wall-hit` on tyre barriers). Above that, a random `hard-*`.
- The hard crashes already contain glass. Layer `glass-tinkle-*` 150-300 ms later for a longer tail.
- Scale the level with speed, since soft and hard are mastered to similar loudness.
- Play `scrape-loop` while the car is in contact with a wall.

**Race flow.**
- Play `lights-on` for each red light and `lights-out` at the start, or use `count-3/2/1` and `count-go` for a countdown start.
- Play `horn-start` at the start and `horn-long` at the finish or for an endurance start.
- `checkpoint`, `lap-complete`, `best-lap`, `position-up` and `position-down` are HUD cues. `final-lap-bell` marks the last lap. `pit-limiter-beep` loops while the pit limiter is on.
- `count-tick` is for menus.

**Crowd.**
- Play `ambience-loop` under everything, at about -20 LUFS.
- Play `cheer-medium` or `hoots` on overtakes and podium places, and `cheer-big` with `applause` for the winner.
- Play `groan` on crashes and spins, and `gasp` on near misses.

**Fireworks.** For the opening, use `small-1` (add about 6 dB) or `small-2`, optionally with `whistle-rockets`. For the winner, use `big-finale`, with `single-boom-*` and `crackle` to layer or vary it.

**Announcers.**
- Pick lines from `announcers/script.json` by category, speaker, `when` and `mode`, with cooldowns and pair chains. `SCRIPT.md` explains how.
- Every line is voiced: look up a line id in `announcers/voice_manifest.json` for its file and length (mono Opus, about -16 LUFS). Not yet checked by ear.

## Browser support

Safari plays Ogg Opus only from version 18.4. If older Safari matters, ship an AAC (`.m4a`) fallback later, for example with `ffmpeg -i x.ogg -c:a aac -b:a 128k x.m4a`, and pick the format with `canPlayType`.

## Regenerate

From `D:\RaceUltimate`:

```
python tools/synth_race_sfx.py                      # race/src/*.wav masters (deterministic)
for f in assets/audio/race/src/*.wav; do n=$(basename "$f" .wav); ffmpeg -y -i "$f" -c:a libopus -b:a 128k -ar 48000 "assets/audio/race/$n.ogg"; done
#   pit-limiter-beep: add -ac 1 -b:a 112k
python tools/audio_qa.py assets/audio qa.json       # decode, codec, LUFS, true peak, loop seams
python tools/audio_manifest.py qa.json assets/audio # rewrites manifest.json and CREDITS.md
```

The ElevenLabs sounds can be re-run from their flows (the flow ids are in `CREDITS.md`). That spends credits, so get approval first. The CC0 sounds are cut from the originals in `crowd/src` and `fireworks/src`. The cut points were recorded in the build session's scratchpad, not here.
