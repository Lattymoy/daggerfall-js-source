// @ts-check
// STAFF-PILOT (2026-10-26, mob: "could we do something were a staff can become a boss", "like play as a boss as attack
// players", the card's pick "Take over the boss", then "can we do this wouthout a relay update?" and "add it to the pr";
// bible/11-Multiplayer/Staff-Events.md section 10) - A STAFF MEMBER STEERS THEIR EVENT'S MINI BOSS. A departure from DFU,
// which has no such thing.
//
// The Staff Panel's Play as boss (net/staffHook.js `pilot`) names a live event. From then:
//   - THE RUN IS MINE. My claim on the event's raid says the oldest age the wire carries (RAID_CLAIM_AGE_MAX), so every
//     game in the place - an old page too, which reads the same oldest-claim law (world/raidShared.js raidRunnerOf) -
//     hands the run to me, and the next mini boss stands on my machine (systems/raidingParties.js runsRaid).
//   - MY BOSS IS ME. Each frame the boss's feet are my feet and its facing my camera's (`pilotSteer`, scenes/
//     exteriorFoes.js after the motor's step); its own decisions to swing or cast are held (`pilotHolds`). A left click
//     is its swing NOW (the brain's forced swing, ai._blowSwing - the wind-up path every foe's blow already rides to the
//     players, each judging the blow on their own feet), at the player nearest my facing within PILOT_TARGET_M; a right
//     click opens its spell decision for PILOT_CAST_MS. My own copy of it is not drawn - the camera stands inside it.
//   - MY BODY IS NO ONE. While I steer, my pose says concealment 7 (all three bits - systems/effects.js concealBits);
//     a game that knows this draws no body and no name for it (systems/combatVisuals.js peerDraw), an older one the
//     shimmer of an invisible player inside the boss. The foes do not sense me (playerEntity.staffHidden).
//   - IT ENDS when the boss falls (its reward and lines as ever), when the event ends, or at the panel's Leave boss -
//     the boss, if it still stands, goes back to its own brain where it stands.
// No relay, no account service: everything here rides words the wire already carries.

/** The oldest claim my word on the event says - the wire's bound (world/raidShared.js RAID_CLAIM_AGE_MAX). */
export const PILOT_CLAIM_AGE = 7_200_000;
/** My pose's concealment while I steer - invisible, blending and a shade at once, which no spell sets alone. */
export const PILOT_CONCEAL = 7;
/** How long a click stays a swing waiting for its frame, ms. */
export const PILOT_SWING_MS = 350;
/** How long a right click lets the boss's spell decision run, ms. */
export const PILOT_CAST_MS = 1500;
/** The farthest player a swing is aimed at (metres), and how far off my facing (degrees). */
export const PILOT_TARGET_M = 8;
export const PILOT_TARGET_DEG = 60;
/** How long Play as boss waits for its boss to stand on my machine before it gives up, ms. */
export const PILOT_WAIT_MS = 60_000;
/** The least the boss walked in a frame to be drawn walking (metres). */
const MOVING_M = 0.01;

/** @type {{ key: string, yaw: number, swingAt: number, castAt: number, had: boolean, at: number } | null} */
let _p = null;

/** Play as boss: the event `id` (the panel's), whose raid is `s.<id>`. A bad id is refused. @param {unknown} id @param {number} now ms */
export function pilotStart(id, now) {
  if (typeof id !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(id)) return false;
  _p = { key: `s.${id}`, yaw: _p?.yaw ?? 0, swingAt: -Infinity, castAt: -Infinity, had: false, at: now };
  return true;
}
/** Leave boss (or the boss fell, or the event ended). */
export function pilotStop() { _p = null; }
/** The event raid's key I steer the boss of, or null. */
export const pilotKey = () => _p?.key ?? null;
export const piloting = () => _p !== null;
/** The camera's facing, each frame (scenes/staffFollowHost.js). @param {number} yaw */
export function pilotYaw(yaw) { if (_p && Number.isFinite(yaw)) _p.yaw = yaw; }
/** A mouse press while I steer: 0 the swing, 2 the spell. @param {number} button @param {number} now ms */
export function pilotPress(button, now) {
  if (!_p) return false;
  if (button === 0) _p.swingAt = now;
  else if (button === 2) _p.castAt = now;
  else return false;
  return true;
}
/** Is this foe the boss I steer - mine (no puppet), standing, of my event? @param {any} f */
export const pilotFoe = (f) => !!_p && !!f && !f.puppet && !f.dead && f.raidKey === _p.key && !!f.entity?.staffBoss;

/** The boss's frame, after its motor stepped: my feet and my facing; a fresh click aims it. `peers` the players the
 *  pool sees ({ id, feet, health }). @param {any} f @param {number[]} feet @param {any[]} peers @param {number} now */
export function pilotSteer(f, feet, peers, now) {
  if (!pilotFoe(f) || !_p || !Array.isArray(feet)) return;
  _p.had = true;
  const a = f.ai, dx = feet[0] - a.feet[0], dz = feet[2] - a.feet[2];
  a.moving = Math.hypot(dx, dz) > MOVING_M;
  a.feet[0] = feet[0]; a.feet[1] = feet[1]; a.feet[2] = feet[2];
  a.yaw = _p.yaw;
  if (now - _p.swingAt > PILOT_SWING_MS) return;
  const t = pilotTarget(feet, _p.yaw, peers);
  if (t) a.target = t;
}
/** The player nearest my facing within reach - the one a swing is at. @param {number[]} feet @param {number} yaw @param {any[]} peers */
export function pilotTarget(feet, yaw, peers) {
  let best = null, bestD = Infinity;
  for (const c of peers ?? []) {
    if (!c || !(c.health > 0) || !Array.isArray(c.feet)) continue;
    const dx = c.feet[0] - feet[0], dz = c.feet[2] - feet[2], d = Math.hypot(dx, dz);
    if (d > PILOT_TARGET_M || d >= bestD) continue;
    let off = Math.atan2(dx, dz) - yaw;
    off = Math.atan2(Math.sin(off), Math.cos(off));
    if (Math.abs(off) <= (PILOT_TARGET_DEG * Math.PI) / 180) { best = c; bestD = d; }
  }
  return best;
}
/** Whether the boss's own decision of `kind` ('swing' | 'cast') is held this frame - always, but for a fresh click,
 *  which a swing spends (its forced swing set on the brain). Not my boss: never held. @param {any} f @param {'swing'|'cast'} kind @param {number} now */
export function pilotHolds(f, kind, now) {
  if (!pilotFoe(f) || !_p) return false;
  if (kind === 'cast') return now - _p.castAt > PILOT_CAST_MS;
  if (f.ai._blowSwing) return false;   // a swing set and not yet taken (the attack machine takes it on its next classic tick)
  if (now - _p.swingAt > PILOT_SWING_MS) return true;
  _p.swingAt = -Infinity;
  f.ai._blowSwing = true;
  f.ai._blowAt = null;
  return false;
}
/** Why the steering ends now, or null: 'fell' - my boss stood for me and stands no more (`mine` the boss of my event I
 *  stand now, or null); 'none' - none stood in PILOT_WAIT_MS. @param {any} mine @param {number} now ms @returns {'fell'|'none'|null} */
export function pilotLost(mine, now) {
  if (!_p) return null;
  if (mine && !mine.dead) { _p.had = true; return null; }
  return _p.had ? 'fell' : now - _p.at > PILOT_WAIT_MS ? 'none' : null;
}
/** Tests: back to no pilot. */
export function resetPilot() { _p = null; }
