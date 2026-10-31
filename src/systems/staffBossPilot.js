// @ts-check
// STAFF-PILOT (2026-10-26, mob: "like play as a boss as attack players"; Staff-Events.md section 10): a staff member
// steers their event's mini boss from the Staff Panel's Play as boss. My claim says the oldest age the wire carries, so
// every game hands me the raid's run. The boss takes my feet and facing; its own swings and casts are held, a left
// click swings at the player nearest my facing and a right click opens its cast. My body draws as concealment 7 and
// no foe senses it. Before a boss stands it is armed (PILOT-ARM). It ends when the boss falls, the event ends, or at Leave boss. No relay, no account change.

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
export function pilotStop() {
  _p = null;
}
/** The event raid's key I steer the boss of, or null. */
export const pilotKey = () => _p?.key ?? null;
export const piloting = () => _p !== null;
/** The camera's facing, each frame (scenes/staffFollowHost.js). @param {number} yaw */
export function pilotYaw(yaw) {
  if (_p && Number.isFinite(yaw)) _p.yaw = yaw;
}
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
 *  pool sees ({ id, feet, health }). Answers what its machines hold this frame (`pilotHolds`), which the pool lays on
 *  its brain as `ai._pilot` - the attack and the cast read it - or null when it is not my boss.
 *  @param {any} f @param {number[]} feet @param {any[]} peers @param {number} now @returns {{ swing: boolean, cast: boolean } | null} */
export function pilotSteer(f, feet, peers, now) {
  if (!pilotFoe(f) || !_p || !Array.isArray(feet)) return null;
  _p.had = true;
  const a = f.ai,
    dx = feet[0] - a.feet[0],
    dz = feet[2] - a.feet[2];
  a.moving = Math.hypot(dx, dz) > MOVING_M;
  a.feet[0] = feet[0];
  a.feet[1] = feet[1];
  a.feet[2] = feet[2];
  a.yaw = _p.yaw;
  if (now - _p.swingAt <= PILOT_SWING_MS) {
    const t = pilotTarget(feet, _p.yaw, peers);
    if (t) a.target = t;
  }
  return { swing: pilotHolds(f, 'swing', now), cast: pilotHolds(f, 'cast', now) };
}
/** The player nearest my facing within reach - the one a swing is at. @param {number[]} feet @param {number} yaw @param {any[]} peers */
export function pilotTarget(feet, yaw, peers) {
  let best = null,
    bestD = Infinity;
  for (const c of peers ?? []) {
    if (!c || !(c.health > 0) || !Array.isArray(c.feet)) continue;
    const dx = c.feet[0] - feet[0],
      dz = c.feet[2] - feet[2],
      d = Math.hypot(dx, dz);
    if (d > PILOT_TARGET_M || d >= bestD) continue;
    let off = Math.atan2(dx, dz) - yaw;
    off = Math.atan2(Math.sin(off), Math.cos(off));
    if (Math.abs(off) <= (PILOT_TARGET_DEG * Math.PI) / 180) {
      best = c;
      bestD = d;
    }
  }
  return best;
}
/** Whether the boss's own decision of `kind` ('swing' | 'cast') is held this frame - always, but for a fresh click,
 *  which a swing spends (its forced swing set on the brain). Not my boss: never held. @param {any} f @param {'swing'|'cast'} kind @param {number} now */
export function pilotHolds(f, kind, now) {
  if (!pilotFoe(f) || !_p) return false;
  if (kind === 'cast') return now - _p.castAt > PILOT_CAST_MS;
  if (f.ai._blowSwing) return false; // a swing set and not yet taken (the attack machine takes it on its next classic tick)
  if (now - _p.swingAt > PILOT_SWING_MS) return true;
  _p.swingAt = -Infinity;
  f.ai._blowSwing = true;
  f.ai._blowAt = null;
  return false;
}
/** Why the steering ends now, or null: 'fell' - my boss stood for me and stands no more (`mine` the boss of my event I
 *  stand now, or null). PILOT-ARM (2026-10-28: "we ether become the boss at kill", card "Both"): before one stood
 *  Play as boss is armed and waits - the meter's next boss (or Spawn mini boss now) stands on me - until Leave boss.
 *  @param {any} mine @param {number} _now ms @returns {'fell'|null} */
export function pilotLost(mine, _now) {
  if (!_p) return null;
  if (mine && !mine.dead) {
    _p.had = true;
    return null;
  }
  return _p.had ? 'fell' : null;
}
/** Tests: back to no pilot. */
export function resetPilot() {
  _p = null;
}
