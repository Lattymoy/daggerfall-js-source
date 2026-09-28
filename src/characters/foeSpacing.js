// FOE-SPACING (2026-09-26, SquidKamer on the Discord: "no collision on monsters"; Mac, asked: "Yes, add it").
//
// DFU's foes are CharacterControllers: one that walks into another is stopped by it, so a pack spreads round whatever
// it hunts. The port's foes are not in the collider - nothing stops one at another - so a pack converged on one spot and
// stood there in one heap, every one of them swinging. Once a frame each pool pushes apart every two of its bodies
// whose capsules overlap: softly (each takes half the overlap, at most FOE_SPACING_SPEED a second), through the
// collider (no wall is crossed), and never off an edge (a walker the push would leave with no ground under its centre
// stays where it was - the drop the motor's own fall check refuses, EnemyMotor's FallCheck, characters/enemyMotor.js
// _fallCheck). A departure: DFU's controllers block, the port's pools push.
import { CAPSULE_HEIGHT, CAPSULE_RADIUS } from '../player/motor.js';
import { FALL_CHECK_DROP } from './enemyMotor.js';

/** How fast a body is pushed out of another, metres a second. */
export const FOE_SPACING_SPEED = 3;
/** Two capsules' centres closer than this overlap. */
export const FOE_SPACING_GAP = 2 * CAPSULE_RADIUS;

/** The default skip: the dead, and a puppet (another client poses it - its owner keeps it apart). */
export const spacingSkips = (f) => !!f?.dead || !!f?.puppet || !f?.ai?.feet;

let _push = new Float64Array(64);
let _live = new Uint8Array(32);
const _was = [0, 0, 0], _from = [0, 0, 0], DOWN = [0, -1, 0];

/** Ground under a walker's centre within the motor's fall reach - the ray the fall check casts ahead, cast where the
 *  body now stands; the collider's analytic floor (terrain) counts, as it does there. */
function supported(collider, ai, feet) {
  const h = ai.height ?? CAPSULE_HEIGHT;
  _from[0] = feet[0]; _from[1] = feet[1] + (ai.centreOffset ?? h / 2); _from[2] = feet[2];
  const reach = h * 0.5 + FALL_CHECK_DROP;
  if (Number.isFinite(collider.raycast?.(_from, DOWN, reach) ?? Infinity)) return true;
  return _from[1] - (collider.heightAt?.(feet[0], feet[2]) ?? -Infinity) <= reach;
}

/** Push a pool's overlapping bodies apart; answers how many moved.
 *  @param foes     the pool's records ({ ai: { feet, height, flies, swims, levitating }, dead, puppet })
 *  @param collider the pool's collider (the bodies' own)
 *  @param dt       the frame the pool hands its foes (0 under a held frame: nothing moves)
 *  @param skip     (f, i) => true for a body that neither pushes nor is pushed */
export function spaceFoes(foes, collider, dt, skip = spacingSkips) {
  const n = foes?.length ?? 0;
  if (n < 2 || !(dt > 0) || !collider?.move) return 0;
  if (_push.length < n * 2) _push = new Float64Array(n * 2);
  if (_live.length < n) _live = new Uint8Array(n);
  let live = 0;
  for (let i = 0; i < n; i++) { _live[i] = skip(foes[i], i) ? 0 : 1; live += _live[i]; }
  if (live < 2) return 0;
  _push.fill(0, 0, n * 2);
  let touched = false;
  for (let i = 0; i < n; i++) {
    if (!_live[i]) continue;
    const a = foes[i].ai.feet, ha = foes[i].ai.height ?? CAPSULE_HEIGHT;
    for (let j = i + 1; j < n; j++) {
      if (!_live[j]) continue;
      const b = foes[j].ai.feet, hb = foes[j].ai.height ?? CAPSULE_HEIGHT;
      if (!(a[1] < b[1] + hb && b[1] < a[1] + ha)) continue;   // one above the other: no contact
      const dx = b[0] - a[0], dz = b[2] - a[2];
      const d2 = dx * dx + dz * dz;
      if (d2 >= FOE_SPACING_GAP * FOE_SPACING_GAP) continue;
      const d = Math.sqrt(d2);
      let ux, uz;
      if (d > 1e-4) { ux = dx / d; uz = dz / d; }
      else { const ang = i * 2.399963229728653 + j; ux = Math.cos(ang); uz = Math.sin(ang); }   // standing in one spot: split them a fixed way
      const share = (FOE_SPACING_GAP - d) / 2;
      _push[i * 2] -= ux * share; _push[i * 2 + 1] -= uz * share;
      _push[j * 2] += ux * share; _push[j * 2 + 1] += uz * share;
      touched = true;
    }
  }
  if (!touched) return 0;
  const cap = FOE_SPACING_SPEED * dt;
  let moved = 0;
  for (let i = 0; i < n; i++) {
    let px = _push[i * 2], pz = _push[i * 2 + 1];
    const len = Math.hypot(px, pz);
    if (!(len > 1e-6)) continue;
    if (len > cap) { px *= cap / len; pz *= cap / len; }
    const ai = foes[i].ai, feet = ai.feet;
    const airborne = !!(ai.flies || ai.swims || ai.levitating);
    _was[0] = feet[0]; _was[1] = feet[1]; _was[2] = feet[2];
    const r = collider.move(feet, px, 0, pz, ai.height ?? CAPSULE_HEIGHT, !airborne);
    if (!airborne && ((r && !r.grounded) || !supported(collider, ai, feet))) { feet[0] = _was[0]; feet[1] = _was[1]; feet[2] = _was[2]; continue; }   // never off an edge
    moved++;
  }
  return moved;
}
