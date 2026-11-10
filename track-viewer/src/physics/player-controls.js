// Pure input arbitration, shared by the browser driver and regression tests.
export const PAD_DEADZONE = 0.18;
// Speed-sensitive input (Assetto Corsa's "steering speed" and speed sensitivity): the wheel winds in more slowly and reaches
// less of the lock at speed; the return to centre stays fast, and parking-lot agility is untouched. speed in m/s.
const smooth=(x,a,b)=>{const t=Math.min(1,Math.max(0,(x-a)/(b-a)));return t*t*(3-2*t);};
// A crawl trim (the user's call, 2026-11-10: very low speed turned too eagerly): .8 of the lock below 14 km/h, all of it from 36 km/h (40-100 km/h is pinned).
export const steerScale=speed=>1-.12*smooth(speed,25,70)-.2*(1-smooth(speed,4,10));           // .8 below 14 km/h, 1 from 36 to 90 km/h, .88 of the lock from 250 km/h (the lock itself already follows the grip: arcade.js steeringLock)
// hold: { t, dir } kept by the caller (PlayerInput): how long this direction has been held. Above 100 km/h the ramp starts slow (a tap on a
// straight is a small nudge) and the rate climbs once the key stays down (a corner still turns decisively); without it the fast rate applies.
export function keyboardSteer(current,want,dt,speed=0,hold){
  if(hold){const d=Math.sign(want);hold.t=d&&d===hold.dir?hold.t+Math.max(0,dt):0;hold.dir=d;}
  const k=Math.min(1,Math.max(0,(speed-27.8)/9.7)),late=smooth(speed,37.5,50),slowRate=30*.085**k-.5*late,fastRate=30-2*k-3*late,
    from=.18*Math.min(1,Math.max(0,(speed-30.6)/6.9))**1.5,up=hold?smooth(hold.t,from,from+.1):1,rate=want===0?22*(1-.3*k):slowRate+(fastRate-slowRate)*up;   // 30/s (95% in .11 s) to 100 km/h; above it ~3/s for the first .12 s of a press, then climbing to ~18/s; release 22/s to 15/s, done in .2 s
  return current+(want*steerScale(speed)-current)*(1-Math.exp(-rate*Math.max(0,dt)));
}
// Digital brake: rises over ~.12 s (weight shifts onto the nose instead of a 0 -> 1 stamp) and releases in ~.06 s. Pad triggers are analog and bypass it.
export const BRAKE_RISE=.12,BRAKE_FALL=.06;
export function keyboardBrake(current,want,dt){
  const step=Math.max(0,dt)/(want>current?BRAKE_RISE:BRAKE_FALL);
  return want>current?Math.min(want,current+step):Math.max(want,current-step);
}
// the player's speed (m/s), written by Vehicle.step so the input layer can be speed-sensitive without the game passing it in
export const driving={speed:0};
export const neutralControls = () => ({ throttle: 0, brake: 0, steer: 0, handbrake: 0, nitro: 0, reset: false });
export function padSteer(x, deadzone = PAD_DEADZONE) {
  x = Number.isFinite(x) ? Math.max(-1, Math.min(1, x)) : 0;
  if(Math.abs(x)<=deadzone)return 0;
  return -Math.sign(x) * (Math.max(0, Math.abs(x) - deadzone) / (1 - deadzone)) ** 1.6;
}
export function padIntent(pad) {
  return !!pad && (Math.abs(pad.axes?.[0] ?? 0) > 0.35 || [0, 2, 3, 6, 7].some(i => (pad.buttons?.[i]?.value ?? 0) > 0.25));
}
