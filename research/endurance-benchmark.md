# Endurance benchmark: what makes it feel like a finished game

Played on 2026-10-21 at endurance-racing.vercel.app (Project Endurance by Anderson Mancini; WebGPU + three.js). The car was a McLaren GT3-style car, played in Free Drive in rain at dusk, with a keyboard, at 1600×900.

Reference frames are in `research/endurance/`. Copy their **techniques and qualities**, never their code or assets.

## Handling

- **Launch:** 0-100 km/h takes about 3.0 s in rain, 0-160 about 5 s. The car is quick, but the HUD and camera make it feel faster still.
- **Turn-in is immediate:** at 115 km/h, half a second of A turns the nose a lot (`end-turn-3.png`). The car rotates readily and stays catchable. TCS and ESC indicators flash, but **they never block rotation**: the car keeps turning and slides with a visible drift angle (`end-turn-7.png`). A drift score pops up as soon as the car is sideways.
- **The camera swings with the slide.** The chase camera lags behind the car's yaw, so during a turn you see the car's flank and its angle, which sells the rotation (`end-turn-7.png`, `end-hb.jpg`).
- **Handbrake:** Space plus steer at about 60 km/h rotates the car and scrubs speed (63 → 35 km/h in 0.9 s).
- **Launch control:** Space plus W at a standstill shows "LAUNCH CONTROL · hold SHIFT".
- **S at a standstill reverses immediately.** Reverse reaches about 50 km/h, and a white centre reverse lamp comes on.
- **Crashes scrub speed hard** (115 → 7 km/h into a wall) without bouncing the car around.
- **Gravel traps** slow the car strongly, and TCS lights up in gravel.

## Nitro (`end-06-nitro.png`, `end-07-nitro.png`)

- **The jet:** two **soft, wide, magenta-violet plasma streams**, several metres long, low behind the car. They have no crisp core, **so they never read as a solid beam**: they are smeared gas, fading out at the tail. Before boost there are violet particle puffs at the pipes (`end-turn-a.png`).
- **The rest of the screen does most of the work:**
  - a **strong radial zoom blur** towards the vanishing point;
  - white **speed lines**;
  - **chromatic aberration** at the edges;
  - a **wider field of view**;
  - the sun flare streaking.
- **Pull:** about 168 → 229 km/h in 1.4 s.

Ultrack's current nitro is a thin, crisp, white-blue quad with shock diamonds, so it reads as a "light saber". Make it soft, wide plasma gas plus the screen-space speed package.

## Exhaust, rain and the wet look

- **Exhaust:** thick, soft, **volumetric white steam** at idle from both pipes. It catches the sun, and at night it glows red in the tail lamps (`end-tod.jpg`). This is one of the most "real" cues.
- **Rain on the car:** **beaded droplets on the paint and glass**, as small specular sparkles all over the body (`end-03-start.png`, `end-12.png`).
- **Rain on screen:** droplets on the menu and title screen.
- **Wet road:** puddle **ripple rings**, streaky reflections of the sun and lights, darker wet asphalt, and **tyre spray and mist** behind the car.
- **Sky:**
  - a **sun starburst and lens flare**;
  - **god rays** through the steam and the rain;
  - dramatic layered clouds;
  - hot-air balloons and birds;
  - a time of day that cycles through dusk, night and day (`end-tod.jpg`).

## Lamps

- **Tail lamps:** thin bright red bars, plus a red centre rain lamp. On the brake they get brighter, with a hot core. At night the red bloom lights up the exhaust steam (`end-tod.jpg`).
- **Reverse lamp:** white, in the centre (`end-09-braketurn-2.png`).

## Camera (`end-cams.jpg`)

- **Five views:** chase-close (the default), chase, chase-far, hood and bumper. The view name flashes on screen when you switch.
- **The default view is low and close:** the wing fills the top of the car, and the car sits low in frame.

## Car on the road (why it doesn't look plastic)

- **Grounding:** the car sits low and planted. Its contact shadow and wet-road reflection sit under it, and the wheels never jitter.
- **Paint:** deep clearcoat paint with real environment reflections, rain beads, and a carbon wing.
- **Weight:** suspension and body motion are subtle.

## HUD and menus

- **Driving HUD:** minimal, with a circular minimap at the bottom left and a slim speedo-tacho arc at the bottom right. The speed is big and italic, with a gear circle and small TCS, ABS and ESC tags that light up when active.
- **Popups:** a small drift-score card at the top left, and drift points that pop up in the centre.
- **Menu:** a bento grid with screen rain droplets.

## Gaps for Ultrack, by priority

1. **Handling:** remove the spin blocking. Turn-in has to be immediate, rotation free up to the grip limit, and the assists may catch a slide but never block one. Add camera yaw lag so slides read on screen.
2. **Nitro:** replace the saber with soft violet plasma, plus the screen package: zoom blur, speed lines, a field-of-view kick and chromatic aberration.
3. **Exhaust steam** at idle and low speed: thick, soft and volumetric, lit by the lamps and the sun.
4. **The wet look:** droplets beading on the car, puddle ripples, tyre spray and mist.
5. **Car on the road:** no wheel jitter, solid grounding, deeper paint.
6. **Camera views:** add hood and bumper views, flash the view name on switch, and lag the camera into slides.
7. **Crashes:** a hard speed scrub with a short camera shake, and no bouncing.
8. **Sky:** a sun starburst and god rays.
