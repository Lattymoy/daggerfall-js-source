// @ts-check
// DRAGON5 (2026-10-29, bible/11-Multiplayer/Dwarven-Dragon.md section 10): A TAMED DRAGON'S FLIGHT ON THE MOTOR, ONE HOME
// for every host. Its law is systems/dragon/dragonFlight.js; here it hears each motor step (player/motor.js
// registerRideStep: the mode, the held jump, the ground), sets the levitating pace (registerFlySpeedMod) and the winded
// sink (registerFlySink), and answers whether the rider is aloft for the hosts' levitation term (scenes/shared.js).
// A dragon caught in the air un-flown (a cliff ridden off, a save made aloft) spreads its wings after DRAGON_CATCH_S.
// Not a DFU member. Ledger A (DRAGON).
import { createDragonFlight } from '../systems/dragon/dragonFlight.js';
import { TRANSPORT_MODES } from '../systems/transport.js';
import { registerFlySpeedMod, registerFlySink, registerRideStep } from './motor.js';

/** Airborne this long on the dragon, not flying, it takes to the air, s - longer than a mounted jump. */
export const DRAGON_CATCH_S = 1.2;

const flight = createDragonFlight();
let _winded = () => false;
let _falling = 0;
/** @type {((what: 'took-off' | 'landed') => void) | null} */
let _heard = null;

/** One motor step. @param {number} dt @param {any} motor @param {any} input */
export function dragonRideStep(dt, motor, input) {
  const mounted = motor?.transportMode === TRANSPORT_MODES.Dragon;
  const grounded = !!motor?.grounded;
  const what = flight.step(dt, { mounted, jump: !!input?.jump, grounded, winded: _winded() });
  _falling = mounted && !grounded && !flight.aloft() ? _falling + dt : 0;
  if (_falling >= DRAGON_CATCH_S && flight.lift()) { _falling = 0; _heard?.('took-off'); }
  if (what) _heard?.(what);
}
registerRideStep(dragonRideStep);
registerFlySpeedMod('dragonMount', flight.flyMult);
registerFlySink('dragonMount', flight.sink);

/** Whether the rider is in the air on the dragon (the hosts' levitation term). */
export const dragonAloft = () => flight.aloft();
/** Horse care's breath spent, for a takeoff and the glide (DRAGON5: systems/upkeep). @param {() => boolean} fn */
export function setDragonWinded(fn) { _winded = typeof fn === 'function' ? fn : () => false; }
/** Told 'took-off' and 'landed' (the host's sound). @param {((what: 'took-off' | 'landed') => void) | null} fn */
export function onDragonFlight(fn) { _heard = typeof fn === 'function' ? fn : null; }
/** For tests: on the ground, and nothing heard. */
export function _resetDragonRide() { flight.land(); _falling = 0; _winded = () => false; _heard = null; }
