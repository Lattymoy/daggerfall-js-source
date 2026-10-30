// @ts-check
// DRAGON5 (2026-10-29, bible/11-Multiplayer/Dwarven-Dragon.md section 10): A TAMED DRAGON'S FLIGHT ON THE MOTOR, ONE HOME
// for every host. Its law is systems/dragon/dragonFlight.js; here it hears each motor step (player/motor.js
// registerRideStep: the mode, the held jump, the ground), sets the levitating pace (registerFlySpeedMod) and the sink
// (registerFlySink), and answers whether the rider is aloft for the hosts' levitation term (scenes/shared.js).
// A dragon caught in the air un-flown (a cliff ridden off, a save made aloft) spreads its wings after DRAGON_CATCH_S.
// DRAGON6: an Overworld journey flown on it CRUISES - taken up, held at DRAGON_CRUISE_M over what is under it by the
// motor's fly hold, and brought down when the journey ends. Not a DFU member. Ledger A (DRAGON).
import { createDragonFlight } from '../systems/dragon/dragonFlight.js';
import { cruiseHold } from '../systems/dragon/dragonJourney.js';
import { TRANSPORT_MODES } from '../systems/transport.js';
import { registerFlySpeedMod, registerFlySink, registerRideStep, registerFlyHold } from './motor.js';

/** Airborne this long on the dragon, not flying, it takes to the air, s - longer than a mounted jump. */
export const DRAGON_CATCH_S = 1.2;
/** AUDIT DRAGON: a rider off the dragon in the air (a flag's dismount, a pick of Foot) is SET DOWN, never dropped: they
 *  sink at this many of the levitating pace until the ground meets them - jump held slows it, never stops it. */
export const DRAGON_SET_DOWN_SINK = 2;

const flight = createDragonFlight();
let _falling = 0;
let _settling = false;
let _mounted = false;
let _mode = /** @type {string | null} */ (null); // DRAGON5b: the last step's transport mode
/** DRAGON6: 'cruise' while a journey flies it, 'down' from its end until the ground meets it, else null. */
/** @type {'cruise' | 'down' | null} */
let _cruise = null;
let _over = Infinity; // m over the ground or the sea under the rider, the last step's
/** @type {((what: 'took-off' | 'landed') => void) | null} */
let _heard = null;
/** DRAGON5c: horse care's word on its breath (systems/upkeep/upkeepRuntime.js) - winded, it will not take off, and aloft it glides. */
let _windedSrc = /** @type {(() => boolean) | null} */ (null);
export function setDragonWindedSource(fn) {
  _windedSrc = typeof fn === 'function' ? fn : null;
}

/** One motor step. @param {number} dt @param {any} motor @param {any} input */
export function dragonRideStep(dt, motor, input) {
  const mounted = motor?.transportMode === TRANSPORT_MODES.Dragon;
  _mode = motor?.transportMode ?? null;
  const grounded = !!motor?.grounded;
  _mounted = mounted;
  _over = heightOver(motor);
  const winded = !!_windedSrc?.(); // DRAGON5c
  if (_cruise === 'cruise' && mounted && !winded && !flight.aloft() && flight.lift()) _heard?.('took-off'); // DRAGON6: a flown journey takes it up (DRAGON5c: never winded)
  const wasAloft = flight.aloft();
  const what = flight.step(dt, { mounted, jump: !!input?.jump, grounded, winded });
  if (_cruise === 'down' && !flight.aloft()) _cruise = null;
  if (what === 'landed' && wasAloft && !mounted && !grounded) _settling = true; // off it in the air: set down
  if (_settling && (grounded || mounted)) _settling = false;
  _falling = mounted && !grounded && !flight.aloft() ? _falling + dt : 0;
  if (_falling >= DRAGON_CATCH_S && flight.lift()) {
    _falling = 0;
    _heard?.('took-off');
  }
  if (what) _heard?.(what);
}
registerRideStep(dragonRideStep);
registerFlySpeedMod('dragonMount', flight.flyMult);
registerFlySink('dragonMount', () => (_settling ? DRAGON_SET_DOWN_SINK : flight.sink()));
registerFlyHold(() =>
  !flight.aloft() || !_mounted || _windedSrc?.()
    ? null
    : _cruise === 'cruise'
      ? cruiseHold(_over)
      : _cruise === 'down'
        ? -1
        : null,
); // DRAGON5c: winded, the glide's sink rules

/** m over the ground or the sea under the motor's feet (Infinity where neither is known). @param {any} motor */
function heightOver(motor) {
  const p = motor?.pos;
  if (!p) return Infinity;
  const ground = Number(motor.collider?.heightAt?.(p[0], p[2]));
  const sea = Number(motor.waterSurfaceY);
  const under = Math.max(Number.isFinite(ground) ? ground : -Infinity, Number.isFinite(sea) ? sea : -Infinity);
  return Number.isFinite(under) ? p[1] - under : Infinity;
}
/** DRAGON6: the Overworld's word each frame - a flown leg walked now (on) or not; off after on brings it down.
 *  @param {boolean} on */
export function setDragonCruise(on) {
  if (on) {
    if (_mounted) _cruise = 'cruise';
  } else if (_cruise === 'cruise') _cruise = 'down';
}
/** Whether the rider sits the dragon (the last motor step's word) - the Overworld plans a flown journey for them. */
export const dragonMounted = () => _mounted;
/** DRAGON5b: the transport mode the last motor step saw (the keep watches the mount and the dismount). */
export const rideModeNow = () => _mode;
/** DRAGON5b: the mount rig's way onto the dragon (player/mountRig.js - the one place the mode changes), for the keep. */
let _mountDragon = /** @type {(() => void) | null} */ (null);
export function setDragonMounter(fn) {
  _mountDragon = typeof fn === 'function' ? fn : null;
}
export const rideDragon = () => _mountDragon?.();
/** DRAGON6: whether a journey cruises it now. */
export const dragonCruising = () => _cruise === 'cruise';

/** Whether the rider is in the air on the dragon, or being set down off it (the hosts' levitation term). */
export const dragonAloft = () => flight.aloft() || _settling;
/** Told 'took-off' and 'landed' (the host's sound). @param {((what: 'took-off' | 'landed') => void) | null} fn */
export function onDragonFlight(fn) {
  _heard = typeof fn === 'function' ? fn : null;
}
/** For tests: on the ground, and nothing heard. */
export function _resetDragonFlight() {
  flight.land();
  _falling = 0;
  _settling = false;
  _heard = null;
  _mounted = false;
  _mode = null;
  _cruise = null;
  _over = Infinity;
}
