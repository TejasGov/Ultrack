# Race startup, brake lights and showroom — 2026-10-20

Race startup failed because the intro accessed `Field.input` before `enablePhysics()` created it. The pre-intro input clear is now optional. The regression fixture deliberately starts without an input object. Enter skips the poster sequence, but the session clock stays at zero until renderer preparation and physics are ready.

Physics cars retained the starting grid flag after lights-out, so the lamp renderer forced braking to zero. The physics pose update now derives that flag from the starting hold and passes brake control through, including at low speed. The lamp regression checks grid release, braking, dedicated stop lamps and release.

Menus and garage now render a separate, lit room with the selected car. They do not render the circuit, run its AO/mirror passes, update its reflection captures or populate its crowd. The normal HTML preload list requests only track metadata; selected car assets load on demand. Circuit geometry, venue lights and sky load only when starting a driving session. Background rival-car prefetch has been removed; texture transcoding is capped at two workers. Garage orbit stays inside its walls, and showroom wheels/mirrors stay at full detail.

Race rendering changes:

- No hidden world rendering behind poster playback or while paused.
- First paint reflection, shader compilation, texture uploads and a warm render happen before the starting clock.
- The inactive viewer headlight does not cast shadows during chase driving.
- High uses one venue shadow light, 2x MSAA and wet reflections; Ultra retains additional shadow lights and AO.
- Dynamic paint reflection faces update every four frames on High and eight on Medium; Low uses the sky environment.
- Three-dimensional animated spectators are reserved for Ultra or the developer viewer.

## Observed browser evidence

On the same local browser/device with the Destrier selected, the old menu submitted 550 draw calls / 1,003,244 triangles per frame. The room submits approximately 53–57 calls / 115,000 triangles depending on orbit angle. Normal startup and opening the garage made zero `marina_visual` resource requests and loaded one car. `shots/garage-room.png` under `track-viewer` is a live browser screenshot.

The existing `viewer.bench(24, {width:1280,height:720})` was run with render scale fixed at 0.5 for both sides (640 × 360 actual render target), High/auto, night, KTX2, AMD Radeon RX 9060 XT. After one warm-up run:

| Render-only circuit sample | Before | After rendering policy changes |
| --- | ---: | ---: |
| Mean frame work | 12.40 ms | 10.42 ms |
| p95 frame work | 24.60 ms | 22.00 ms |
| Draw calls | 1,037 | 583 |
| Triangles | 1.548 million | 0.911 million |

These are bounded render-only observations, not a full driving FPS guarantee. The cold shader pass exposed additional hitches, motivating the renderer warm-up now performed before the race. The live game also reached a real seven-car physics session; Enter skip returned to the starting grid without console errors.

Validation: `test:driver-intro`, `test:brake-lights`, `test:v2`, loading unit tests and the production build. The intro integration test also checks that skipping waits for renderer readiness rather than starting the clock during warm-up.
