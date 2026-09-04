// AUDIT 28 W8 - MOVEMENT ACCELERATION: InputManager.ApplyHorizontalForce
// / ApplyVerticalForce / ApplyFriction (MIT, Daggerfall Workshop,
// InputManager.cs:50, :478-482, :1445-1497, :1840-1852), wired from
// Controls/MovementAcceleration at :432. The setting ships False - the
// classic "just go / just stop" - and the port's hosts produced the
// axes as the bare held-key difference, so the setting sat stored.
//
// The law: every Update clears the four impulse flags, then each held
// movement action applies a force to its axis - with acceleration the
// axis climbs at moveAccelerationConst (9.8) per second toward +/-1,
// without it the axis IS the scale - and raises the impulse flag for
// its sign; then friction runs, decaying an axis whose impulse was NOT
// raised this frame back toward 0 at the same 9.8/s (or snapping it to
// 0 without acceleration). PlayerMotor reads Horizontal/Vertical as
// the movement vector; the port's motor takes {forward, strafe} the
// same way, scalar.
//
// Classic mode with two opposing keys held: DFU's forces run in the
// keybind dictionary's iteration order, so "last wins" is whichever
// bind enumerates last - unspecified. The port's shipped answer is
// the neutral difference (forward - backward = 0), kept as it was.
// With acceleration both forces sum to zero change and both impulses
// hold the axis where it is, which is exactly DFU's arithmetic.

import { getBool } from '../systems/settings.js';

/** InputManager.cs:50. */
export const MOVE_ACCELERATION_CONST = 9.8;

const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);

export class MoveAxes {
  constructor() {
    this.horizontal = 0;   // strafe: right +, left -
    this.vertical = 0;     // forward +, backward -
  }

  /**
   * One Update: flags cleared, forces for the held actions, friction.
   * @param {number} dt - Time.deltaTime
   * @param {{forwards?:boolean, backwards?:boolean, left?:boolean, right?:boolean}} held
   * @returns {{forward:number, strafe:number}} the motor's axes
   */
  update(dt, held, { acceleration = getBool('Controls', 'MovementAcceleration') } = {}) {
    if (!acceleration) {
      // "just go" / "just stop": the axis is the held difference.
      this.horizontal = (held.right ? 1 : 0) - (held.left ? 1 : 0);
      this.vertical = (held.forwards ? 1 : 0) - (held.backwards ? 1 : 0);
      return { forward: this.vertical, strafe: this.horizontal };
    }
    let posH = false, negH = false, posV = false, negV = false;
    const force = (axis, scale) => clamp(axis + (MOVE_ACCELERATION_CONST * scale) * dt, -1, 1);
    // FindKeyboardActions (:1840-1852): right, left, forwards, backwards.
    if (held.right) { this.horizontal = force(this.horizontal, 1); posH = true; }
    if (held.left) { this.horizontal = force(this.horizontal, -1); negH = true; }
    if (held.forwards) { this.vertical = force(this.vertical, 1); posV = true; }
    if (held.backwards) { this.vertical = force(this.vertical, -1); negV = true; }
    // ApplyFriction (:1477-1491): decay an axis whose impulse was not raised.
    const step = MOVE_ACCELERATION_CONST * dt;
    if (!posV && this.vertical > 0) this.vertical = clamp(this.vertical - step, 0, this.vertical);
    if (!negV && this.vertical < 0) this.vertical = clamp(this.vertical + step, this.vertical, 0);
    if (!posH && this.horizontal > 0) this.horizontal = clamp(this.horizontal - step, 0, this.horizontal);
    if (!negH && this.horizontal < 0) this.horizontal = clamp(this.horizontal + step, this.horizontal, 0);
    return { forward: this.vertical, strafe: this.horizontal };
  }
}
