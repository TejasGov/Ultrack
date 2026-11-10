// Pure arcade controls. Values are our tuning; no impulses are applied in the air.
// Front wheel angle at full lock: the angle that holds the car at its grip limit (the kinematic angle for the grip's lateral
// acceleration, plus the extra the front axle needs over the stiffer rear to get there: the understeer allowance) with a margin
// to reach the limit quickly. A keyboard can only press the lock, so this is the whole steering: less leaves grip on the table,
// much more ploughs and sets the car weaving at speed. Slower than ~30 km/h the steering rack's own lock is the limit.
export function steeringLock(speed,wheelbase,grip,downforce,mass,tune){
  const mechanical=(tune.steeringLockDeg??35)*Math.PI/180;
  const parking=mechanical/(1+(speed/35)**2)+.025;
  const acceleration=grip*9.81*(1+.6*downforce*speed*speed/(mass*9.81));
  const understeer=(tune.steeringUnder??1)*Math.PI/180;
  const fast=Math.min(1,Math.max(0,(speed-33)/23)),margin=(tune.steeringMargin??2)*(1-.03*fast*fast*(3-2*fast));   // full authority at speed; only a slight shrink above 120 km/h
  const road=(Math.atan(acceleration*wheelbase/Math.max(speed*speed,1))+understeer)*margin;
  return Math.min(parking,road);
}
// When the driving aids act: not while the car is cornering or rotating (that is the driver's), only once it is really sliding.
// Below the tier's slide angle they do nothing; above it they fade in over SPIN_FADE, never a wall. The tier is the stability
// gain: Casual (1.5) 8 deg, Sport (1) 10 deg, Pro (.35) 24 deg.
export const SPIN_FADE=8*Math.PI/180;
export const spinStart=(stability=1)=>Math.max(6,stability>=1?9-2*(stability-1):9+23*(1-stability))*Math.PI/180;
export function spinGate(beta,stability=1){
  const x=Math.min(1,Math.max(0,(Math.abs(beta)-spinStart(stability))/SPIN_FADE));
  return x*x*(3-2*x);
}
// Backing up: the wheel angle that keeps the turn under ~.45 g, so full lock at reversing speed is a calm arc, not a donut
// (full parking lock below ~3 m/s)
export const reverseLock=(speed,wheelbase,lateralG=.45)=>Math.atan(lateralG*9.81*wheelbase/Math.max(speed*speed,1));
// ---- the arcade layer (vehicle.js): the tyres give weight and body motion, this decides how the car turns, aligns, drifts and brakes.
// Tier from the stability gain (store.js ASSISTS): Rookie (1.25) = k 1, Pro (.35) = k 0. grip: lateral g on dry asphalt; align: 1/s pulling the
// velocity in line with the heading; enter: slide angle (rad) under throttle that starts a drift; brake: g on the pedal.
export function arcadeTier(stability=1){
  const k=Math.min(1,Math.max(0,(stability-.35)/.65));
  return {grip:2.8+.3*k,align:14+16*k,enter:.55-.15*k,brake:1.8,catchYaw:2+2*k};
}
// available lateral acceleration (m/s2): the tier's g, scaled by the car's own grip (upgrades included), wet grip, surface and downforce
export const arcadeAccel=(tier,carGrip,wetF,surface,downforce,mass,speed)=>
  tier.grip*9.81*Math.min(1.12,Math.max(.88,carGrip/1.2))*wetF*Math.min(1,surface)*(1+.6*downforce*speed*speed/(mass*9.81));
// what a bought Aero adds to the lateral grip at `speed` (m/s): exactly 1 for a stock car, so the AI's corner speeds only move when downforce was bought
export const aeroGain=(stockDownforce,downforce,mass,speed)=>downforce===stockDownforce?1:(1+.6*downforce*speed*speed/(mass*9.81))/(1+.6*stockDownforce*speed*speed/(mass*9.81));
// the share of the turn rate kept at speed: all of it to 110 km/h, .9 at 135, .8 at 160, .74 at 240 (a straight-line twitch is not a turn); smooth, no step
const sm=(x,a,b)=>{const t=Math.min(1,Math.max(0,(x-a)/(b-a)));return t*t*(3-2*t);};
// The player's car keeps 14% more of it from 170 km/h (the user's call, 2026-11-10: 10-15% more turn at speed), fading in from 140 km/h so a tap on a
// straight at 135 is the same nudge. The AI keeps the plain fade, so its corner speeds and the par laps do not move (cars.js plans with yawFade(speed))
export const yawFade=(speed,player=false)=>(1-.2*sm(speed,30.6,44.4)-.06*sm(speed,44.4,66.7))*(player?1+.14*sm(speed,38.9,47.2):1);
// time constant (s) of the yaw controller: .025 to 110 km/h, .06 from 150 km/h
export const yawTau=speed=>.025+.035*sm(speed,30.6,41.7);
// yaw rate (rad/s) the steering asks for: the kinematic rate of the wheel angle, never more than the grip can turn
export const arcadeYaw=(speed,wheelAngle,wheelbase,aMax)=>Math.sign(wheelAngle)*Math.min(Math.abs(speed*Math.tan(wheelAngle)/wheelbase),aMax/Math.max(speed,3));
export function slidingForce(curve,angle,floor,drift){
  const x=Math.min(1,Math.max(0,(Math.abs(angle)-.15)/.3)),ramp=x*x*(3-2*x);
  return Math.sign(curve)*Math.max(Math.abs(curve),floor*ramp*(1-.25*drift));
}
// start / width: the slide (tan of the angle) where the recovery begins and where it is complete
export function recoveryAcceleration(lateralSpeed,speed,contacts,surfaceGrip,drift,assist,tune,start=.07,width=.15){
  if(contacts<3||surfaceGrip<.75||speed<6||drift>.05)return 0;
  const blend=Math.min(1,Math.max(0,(Math.abs(lateralSpeed)/Math.max(speed,1)-start)/width));
  return -Math.sign(lateralSpeed)*Math.min(Math.abs(lateralSpeed)*tune.slideRecovery,tune.slideRecoveryMaxG*9.81)*blend*Math.min(1.5,assist);
}
