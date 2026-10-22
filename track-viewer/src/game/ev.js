// Electric cars (exhaust.json `electric: true`): silent engine, no gearbox shifts, "EV" in the garage. None ships today; tests add synthetic keys.
import EXHAUST from '../../../assets/cars/exhaust.json' with { type: 'json' };
export const EV = new Set(Object.entries(EXHAUST.cars).filter(([, s]) => s.electric).map(([k]) => k));
