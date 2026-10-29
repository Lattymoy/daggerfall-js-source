// @ts-check
// DRAGON5 (2026-10-29, bible/11-Multiplayer/Dwarven-Dragon.md section 10): A TAMED DRAGON'S FLIGHT ON THE MOTOR, ONE HOME
// for every host. Its law is systems/dragon/dragonFlight.js; here it hears each motor step (player/motor.js
// registerRideStep: the mode, the held jump, the ground), sets the levitating pace (registerFlySpeedMod) and the sink
// (registerFlySink), and answers whether the rider is aloft for the hosts' levitation term (scenes/shared.js).
// A dragon caught in the air un-flown (a cliff ridden off, a save made aloft) spreads its wings after DRAGON_CATCH_S.
// Not a DFU member. Ledger A (DRAGON).
import { createDragonFlight } from '../systems/dragon/dragonFlight.js';
import { TRANSPORT_MODES } from '../systems/transport.js';
import { registerFlySpeedMod, registerFlySink, registerRideStep } from './motor.js';

/** Airborne this long on the dragon, not flying, it takes to the air, s - longer than a mounted jump. */
export const DRAGON_CATCH_S = 1.2;
/** AUDIT DRAGON: a rider off the dragon in the air (a flag's dismount, a pick of Foot) is SET DOWN, never dropped: they
 *  sink at this many of the levitating pace until the ground meets them - jump held slows it, never stops it. */
export const DRAGON_SET_DOWN_SINK = 2;

const flight = createDragonFlight();
let _falling = 0;
let _settling = false;
/** @type {((what: 'took-off' | 'landed') => void) | null} */
let _heard = null;

/** One motor step. @param {number} dt @param {any} motor @param {any} input */
export function dragonRideStep(dt, motor, input) {
  const mounted = motor?.transportMode === TRANSPORT_MODES.Dragon;
  const grounded = !!motor?.grounded;
  const wasAloft = flight.aloft();
  const what = flight.step(dt, { mounted, jump: !!input?.jump, grounded });
  if (what === 'landed' && wasAloft && !mounted && !grounded) _settling = true;   // off it in the air: set down
  if (_settling && (grounded || mounted)) _settling = false;
  _falling = mounted && !grounded && !flight.aloft() ? _falling + dt : 0;
  if (_falling >= DRAGON_CATCH_S && flight.lift()) { _falling = 0; _heard?.('took-off'); }
  if (what) _heard?.(what);
}
registerRideStep(dragonRideStep);
registerFlySpeedMod('dragonMount', flight.flyMult);
registerFlySink('dragonMount', () => (_settling ? DRAGON_SET_DOWN_SINK : flight.sink()));

/** Whether the rider is in the air on the dragon, or being set down off it (the hosts' levitation term). */
export const dragonAloft = () => flight.aloft() || _settling;
/** Told 'took-off' and 'landed' (the host's sound). @param {((what: 'took-off' | 'landed') => void) | null} fn */
export function onDragonFlight(fn) { _heard = typeof fn === 'function' ? fn : null; }
/** For tests: on the ground, and nothing heard. */
export function _resetDragonRide() { flight.land(); _falling = 0; _settling = false; _heard = null; }
