// Arcade brake/reverse semantics. Thresholds are Ultrack tuning, not GTA handling constants.
export const REVERSE_MAX = 40 / 3.6;
export const REVERSE_DWELL = .35;
const clamp = n => Math.min(1, Math.max(0, Number(n) || 0));

export function resolvePedals(state, controls, forwardSpeed, lateralSpeed, dt) {
  const w = clamp(controls.throttle), s = clamp(controls.brake);
  const nearStop = Math.abs(forwardSpeed) < .35 && Math.abs(lateralSpeed) < 1;
  state.stopTime = nearStop ? (state.stopTime ?? 0) + dt : 0;
  const stopped = state.stopTime >= .12;                 // a held stop long enough to change direction (reverse -> forward)
  const stoppedForReverse = state.stopTime >= REVERSE_DWELL;   // braking only becomes reverse after a real standstill
  let drive = 0, brake = 0;
  if (controls.hold) brake = 1;
  else if (w > .05 && s > .05) brake = forwardSpeed < -.35 ? w : s;
  else if (s > .05) {
    if (forwardSpeed > .35 || (forwardSpeed >= -.35 && !stoppedForReverse) || controls.handbrake > .1) brake = s;
    else drive = -s;
  } else if (w > .05) {
    if (forwardSpeed < -.35 || (state.reverse && !stopped)) brake = w;
    else drive = w;
  }
  if (drive < 0) {
    // Smooth torque taper near 40 km/h; retain braking for downhill overspeed.
    drive *= Math.max(0, Math.min(1, (REVERSE_MAX + forwardSpeed) / 1.5));
    brake = Math.max(brake, Math.min(1, Math.max(0, -forwardSpeed - REVERSE_MAX) * .5));
  }
  drive=drive||0;
  const reverse = forwardSpeed < -.35 || drive < 0 || (state.reverse && !stopped && drive <= 0);
  state.reverse = reverse;
  state.driveInput = drive; state.serviceBrake = brake;
  return { drive, brake, reverse };
}
