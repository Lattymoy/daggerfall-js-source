// THE GUN LAB'S MACHINE, MOVED (PISTOL-PORT, 2026-10-22; the owner: "I want the prototype itself implemented just like
// we did with thunderlock"). It was src/tools/gunLab.js's own - the Thunderlock's lab ran it and the game ran the classic
// machine on the lab's clock (FIELD-GUN7, pinned against it). The Dwarven Pistolet fires on IT now, one machine a pistol
// as the pistol lab fires them (combat/gun/pistolPair.js), so it is the game's, and both labs import it back from here.

import { FIRE_FRAMES } from './gunSheet.js';

/**
 * THE CYCLE. A gun is not a sword: WeaponManager's six directional
 * strikes and the drag-to-swing gesture have nothing to say here, so
 * the lab runs the smallest machine that can be judged -
 *
 *   Idle -> Firing (frames 0..5 at `fps`) -> Cooling (`cooldownMs`,
 *   the pump) -> Idle
 *
 * - and keeps the two things the classic machine DOES have that
 * matter: a hit frame the damage would land on (FPSWeapon.GetHitFrame,
 * 2 for melee) and a one-shot that cannot be interrupted
 * (FPSWeapon.OnAttackDirection's rule). `auto` holds the trigger.
 */
export function createGunMachine({ fps = 14, cooldownMs = 1700, hitFrame = 1 } = {}) {
  const m = {
    state: 'Idle', frame: 0, fps, cooldownMs, hitFrame,
    trigger: false, shots: 0,
    _t: 0, _cool: 0, _hitThisShot: false,
    /** How far into the pump we are, in ms - what a caller needs to
     *  land a sound or a second animation ON the reload rather than
     *  after it. Zero outside Cooling. */
    get cooledMs() { return m.state === 'Cooling' ? m._cool : 0; },
  };
  m.fire = () => {
    if (m.state !== 'Idle') return false;   // the one-shot cannot be replaced
    m.state = 'Firing'; m.frame = 0; m._t = 0; m._hitThisShot = false; m.shots++;
    return true;
  };
  /** Answers the event this step produced: 'hit' on the hit frame,
   *  'ready' when the pump finishes, null otherwise. */
  m.step = (dt) => {
    let event = null;
    if (m.state === 'Firing') {
      m._t += dt;
      const adv = Math.floor(m._t * m.fps);
      m.frame = Math.min(adv, FIRE_FRAMES - 1);
      if (!m._hitThisShot && m.frame >= m.hitFrame) { m._hitThisShot = true; event = 'hit'; }
      if (adv >= FIRE_FRAMES) { m.state = 'Cooling'; m._cool = 0; m.frame = 0; }
    } else if (m.state === 'Cooling') {
      m._cool += dt * 1000;
      if (m._cool >= m.cooldownMs) { m.state = 'Idle'; event = 'ready'; }
    } else if (m.trigger) {
      m.fire();
    }
    return event;
  };
  return m;
}
