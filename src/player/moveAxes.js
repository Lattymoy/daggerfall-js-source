// AUDIT 28 W8 - MOVEMENT ACCELERATION: InputManager.ApplyHorizontalForce
// / ApplyVerticalForce / ApplyFriction (MIT, Daggerfall Workshop,
// InputManager.cs:50, :478-482, :1445-1497, :1840-1852), wired from
// Controls/MovementAcceleration at :432. The setting ships False - the
// classic "just go / just stop" - and the port's hosts produced the
// axes as the bare held-key difference, so the setting sat stored.
//
// The law: every Update clears the four impulse flags, then the
// AUTORUN latch applies its own forward force (InputManager.cs:542-545,
// AUDIT 64 F3 - ahead of the keys, because :548 is where
// FindKeyboardActions runs), then each held movement action applies a
// force to its axis - with acceleration the
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
   * @param {{forwards?:boolean, backwards?:boolean, left?:boolean, right?:boolean, autorun?:boolean, analog?:{x:number,y:number}|null}} held
   *   `analog` is TI2's stick reading (ui/touchLook.js analogAxes): x
   *   strafe right +, y forward +, each -1..1. InputManager.Update's
   *   JOYSTICK arm, beside :548's FindKeyboardActions: the force's
   *   scale is the axis's own reading rather than the keyboard's +/-1,
   *   so under acceleration the axis climbs toward the throw and
   *   without it the axis IS the throw. A non-zero analog component
   *   REPLACES that axis's key forces for the frame - the touch layer
   *   synthesizes the stick's keys too (for the anim and reportInput),
   *   and summing both would count one thumb twice.
   * @returns {{forward:number, strafe:number}} the motor's axes
   */
  update(dt, held, { acceleration = getBool('Controls', 'MovementAcceleration') } = {}) {
    const ax = held.analog ? clamp(Number(held.analog.x) || 0, -1, 1) : 0;
    const ay = held.analog ? clamp(Number(held.analog.y) || 0, -1, 1) : 0;
    if (!acceleration) {
      // "just go" / "just stop": the axis is the held difference.
      this.horizontal = ax !== 0 ? ax : (held.right ? 1 : 0) - (held.left ? 1 : 0);
      // AUDIT 64 F3 - InputManager.cs:542-545, `if (ToggleAutorun)
      // ApplyVerticalForce(1);`, the half of autorun that MOVES the
      // player: the latch drives the vertical axis forward with no key
      // held. Without it AutoRun toggled the run MODE and nothing
      // walked. In this arm ApplyVerticalForce is `vertical = scale`
      // (:1466-1468), so the LAST write wins and the key forces (:548's
      // FindKeyboardActions, after :542) override the latch: autorun
      // alone is +1, autorun + MoveBackwards is -1 (the same GetKey
      // pass that zeroes ToggleAutorun at :1851 still applies its -1
      // this frame), autorun + MoveForwards is +1. Two opposing keys
      // keep the file's recorded neutral-difference answer above.
      this.vertical = ay !== 0 ? ay : (held.forwards || held.backwards)
        ? ((held.forwards ? 1 : 0) - (held.backwards ? 1 : 0))
        : (held.autorun ? 1 : 0);
      return { forward: this.vertical, strafe: this.horizontal };
    }
    let posH = false, negH = false, posV = false, negV = false;
    const force = (axis, scale) => clamp(axis + (MOVE_ACCELERATION_CONST * scale) * dt, -1, 1);
    // AUDIT 64 F3: the autorun force runs BEFORE the key forces,
    // because :542 precedes FindKeyboardActions at :548 - so a frame
    // with autorun AND MoveForwards sums two +1 forces, and autorun
    // with MoveBackwards nets zero change with both impulses raised.
    // Raising posV is load-bearing (:1472): without it ApplyFriction
    // (:1482-1483) decays the axis by the same 9.8/s every frame and
    // the net stays 0.
    if (held.autorun) { this.vertical = force(this.vertical, 1); posV = true; }
    // FindKeyboardActions (:1840-1852): right, left, forwards, backwards.
    // TI2: the joystick arm. A key is an IMPULSE toward +/-1; a throw
    // is a TARGET, so the axis climbs toward the throw at the same
    // 9.8/s and settles THERE, not at the rail (a half throw is half
    // speed, held). The impulse flag of its sign is raised so friction
    // leaves the settled axis alone. Departure of kind, recorded in
    // Ledger A under TI2: DFU's joystick reading reaches
    // ApplyHorizontalForce as the scale of the same impulse, which with
    // acceleration on would walk every throw to full speed.
    const toward = (axis, target) => axis + clamp(target - axis, -MOVE_ACCELERATION_CONST * dt, MOVE_ACCELERATION_CONST * dt);
    if (ax !== 0) { this.horizontal = toward(this.horizontal, ax); if (ax > 0) posH = true; else negH = true; }
    else {
      if (held.right) { this.horizontal = force(this.horizontal, 1); posH = true; }
      if (held.left) { this.horizontal = force(this.horizontal, -1); negH = true; }
    }
    if (ay !== 0) { this.vertical = toward(this.vertical, ay); if (ay > 0) posV = true; else negV = true; }
    else {
      if (held.forwards) { this.vertical = force(this.vertical, 1); posV = true; }
      if (held.backwards) { this.vertical = force(this.vertical, -1); negV = true; }
    }
    // ApplyFriction (:1477-1491): decay an axis whose impulse was not raised.
    const step = MOVE_ACCELERATION_CONST * dt;
    if (!posV && this.vertical > 0) this.vertical = clamp(this.vertical - step, 0, this.vertical);
    if (!negV && this.vertical < 0) this.vertical = clamp(this.vertical + step, this.vertical, 0);
    if (!posH && this.horizontal > 0) this.horizontal = clamp(this.horizontal - step, 0, this.horizontal);
    if (!negH && this.horizontal < 0) this.horizontal = clamp(this.horizontal + step, this.horizontal, 0);
    return { forward: this.vertical, strafe: this.horizontal };
  }
}
