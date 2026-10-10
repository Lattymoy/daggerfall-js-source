// @ts-check
// ═════════════════════════════════════════════════════════════════════
// INT9 (2026-10-09, the INTEGRITY arc's lane 2 - bible/06-Systems/Integrity-Arc.md; Mac: "I want to do everything and
// do it properly"): THE OPEN ZONE REFEREED.
//
// WILD1 left a blow between two players in the zone to the defender's own machine and a fall to the fallen's own health
// - so a client that never took a blow never fell, and one that fell handed over what it chose. Now the relay that
// routes the zone's frames holds its fights:
//
//   - WHO FIGHTS. The relay cannot see the map (the zone is the POLITIC map's region 16, cut and kept out as
//     systems/wildZone.js builds it from the files every client holds), so a socket's zone is its own word: each says it
//     stands in it, and leaves it (`zone`). A blow lands only where BOTH fighters said so - a crafted client can opt out
//     of the zone's fights, never into another's: an honest player outside the zone is nobody's target. And never on a
//     party member or one under the party's truce (the hub's word), nor on the fighter's own duel opponent (the duel's
//     referee holds that one).
//   - THE VITALITY is the Royal Tourney's (300 + 2 x the Renown the token signs) - the zone's fights are the referee's
//     bar, as a siege's and a duel's are; the save's health is the foes' alone. A fighter no player has struck for
//     WILD_REF.mendMs is whole again.
//   - EVERY BLOW AND CAST is the referee's (refereeBlow, refereeCast - the weapon the striker's look holds, the arms its
//     token signs, the reach from both fighters' last BELIEVED places: a run the referee allows, never a teleport).
//   - A FALL is the referee's word: the fallen's vitality at none. The striker is its killer. The killer then has
//     WILD_REF.pickMs to choose one worn piece of the fallen's (`pick` - its place in the offer the fallen's game showed,
//     systems/wildDropLaw.js wornOffer); then the relay signs the fall (net/wildReceipt.js `f1`) and hands it to both, and
//     the account service takes the drop and that piece off the fallen's judged record against it.
//
// Pure: no clock (every `now` an argument), no socket, no storage - the relay's room keeps the state in its memory
// (DECIDED, the duel's: a room that restarts mid-fight forgets it; a fall already signed is the service's to settle).
// ═════════════════════════════════════════════════════════════════════
import { SIEGE_HIT, newFighter, refereeBlow, refereeCast, refereeStep } from './siegeRef.js';

/** The zone referee's own numbers: how long a fighter no player has struck - and that has stood in the zone as long - takes
 *  to be whole again; how long a killer has to pick a worn piece before the fall is signed without one; the party's truce
 *  (systems/wildZone.js WILD_PARTY_TRUCE_MS, pinned equal - the hub holds it for the relay); how long a fallen stays down
 *  before its word that it stands in the zone raises it (the death screen's WILD_DEATH_HOLD_S, pinned equal - AUDIT INT9:
 *  it rose on its next word, where it fell, whole), and how long one away from the zone that long comes back whole; how
 *  long a fighter whose pose jumped past any run strikes nothing (AUDIT INT9: a jump was never believed, so a gallop, a
 *  respawn or a reconnect left its place stale for good - now it is believed, and the jumper waits); the most fighters
 *  and falls a room keeps. */
export const WILD_REF = Object.freeze({ mendMs: 30_000, pickMs: 60_000, truceMs: 10 * 60_000, riseMs: 120_000, jumpMs: 2_000, fightersMax: 200, fallsMax: 64 });

/** A room's zone: its fighters by account, its falls waiting on a pick or a signature. */
export const newWildRef = () => ({ fighters: new Map(), falls: new Map() });

/**
 * A SOCKET'S WORD ON THE ZONE (`zone` - `z` true: it stands in the zone; false: it has left it): its fighter made or
 * kept (`id` its socket's id now, `lv` the Renown its token signs, `ci` its realm character), its place the pose it
 * stands at. A NEW fighter takes the vitality it CARRIES (`carry` - the hub's word on its last fight in another room:
 * `{ hp, max, down, downAt, at }`, AUDIT INT9: a step into another cell was a fresh bar), unless that word is older than
 * the mend. A fighter down rises whole on its word that it stands in the zone again once WILD_REF.riseMs has passed
 * (its respawn - never at once). One away from the zone WILD_REF.riseMs comes back whole; one back sooner keeps its bar
 * and mends only once it has stood in the zone WILD_REF.mendMs unstruck (AUDIT INT9: a word off and on was a heal).
 * Answers the fighter, or null (none made: a word off, a full room).
 */
export function wildZone(st, sub, { id, lv = 1, ci = '', carry = null }, z, pose, now) {
  let x = st.fighters.get(sub);
  if (!x) {
    if (!z) return null;
    if (st.fighters.size >= WILD_REF.fightersMax) for (const [k, v] of st.fighters) if (!v.zone && !v.down) { st.fighters.delete(k); break; }
    if (st.fighters.size >= WILD_REF.fightersMax) return null;
    x = { id, ci: ci || '', f: newFighter(lv, now), pose: pose ? { x: pose.x, y: Number.isFinite(pose.y) ? pose.y : 0, z: pose.z } : null, poseAt: now, zone: false, zoneAt: now, outAt: -Infinity, struckAt: -Infinity, down: false, downAt: -Infinity, jumpAt: -Infinity };
    takeCarry(x, carry, now);
    st.fighters.set(sub, x);
  } else if (z && !x.zone && carry && carry.at > x.outAt) takeCarry(x, carry, now);   // it fought in another room since it left this one
  x.id = id; if (ci) x.ci = ci;
  if (z && x.down && now - x.downAt >= WILD_REF.riseMs) { x.f = newFighter(lv, now); x.down = false; x.struckAt = -Infinity; }
  if (z && !x.zone) {
    if (now - x.outAt >= WILD_REF.riseMs && !x.down) { x.f.hp = x.f.max; x.struckAt = -Infinity; }
    x.zoneAt = now;
  }
  if (!z && x.zone) x.outAt = now;
  x.zone = !!z;
  return x;
}

/** A fighter takes the vitality it carries from another room (`carry` - wildCarry's word, kept by the hub), unless that word
 *  is older than the mend (or, for a fall, the rise). */
function takeCarry(x, carry, now) {
  if (!carry || !Number.isFinite(carry.at) || !(now - carry.at < Math.max(WILD_REF.mendMs, carry.down ? WILD_REF.riseMs : 0))) return;
  x.outAt = carry.at;   // it fought elsewhere a moment ago - never away from the zone
  if (carry.down && now - carry.downAt < WILD_REF.riseMs) { x.down = true; x.downAt = carry.downAt; x.f.down = true; x.f.hp = 0; return; }
  if (Number.isFinite(carry.hp) && carry.hp < x.f.max) { x.f.hp = Math.max(1, Math.min(x.f.max, Math.trunc(carry.hp))); x.struckAt = carry.at; }
}

/** INT9 (AUDIT): a hub's word on a fighter's carry, checked for the shape wildCarry writes - or null. */
export function wildCarryOf(v) {
  if (!v || typeof v !== 'object' || !Number.isFinite(v.at) || !Number.isFinite(v.hp) || !Number.isFinite(v.max)) return null;
  return { hp: Math.max(0, Math.trunc(v.hp)), max: Math.max(1, Math.trunc(v.max)), down: v.down === true, downAt: Number.isFinite(v.downAt) ? v.downAt : 0, at: v.at };
}

/** INT9 (AUDIT): A FALL WAITING ON ITS PICK is kept in the room's storage under this prefix (a relay object that restarts
 *  mid-wait signed it never - no drop at all), and read back the first time the restarted room's zone is asked. */
export const WILD_FALL_PREFIX = 'wildfall:';
/** A fall read back from storage, checked for the shape wildBlow writes - or null. */
export function wildFallOf(v) {
  if (!v || typeof v !== 'object' || typeof v.r !== 'string' || typeof v.fallen !== 'string' || typeof v.killer !== 'string' || !Number.isFinite(v.at)) return null;
  return { r: v.r, fallen: v.fallen, fallenId: typeof v.fallenId === 'string' ? v.fallenId : '', ci: typeof v.ci === 'string' ? v.ci : '', killer: v.killer, killerId: typeof v.killerId === 'string' ? v.killerId : '', at: v.at,
    w: Number.isInteger(v.w) ? v.w : -1, wt: Array.isArray(v.wt) && v.wt.length === 2 ? [v.wt[0], v.wt[1]] : null, picked: v.picked === true };
}

/** A FIGHTER'S SOCKET GONE from the room (no other of its account's left): out of the zone, and its place in a full room
 *  any newcomer's (AUDIT INT9: a closed tab kept its `zone` for good, and a room of 200 such refused every newcomer). */
export function wildGone(st, sub, now) {
  const x = st.fighters.get(sub);
  if (x && x.zone) { x.zone = false; x.outAt = now; }
}

/** What a fighter CARRIES out of this room (the hub keeps it for the next room it stands in): its vitality and its fall. */
export const wildCarry = (st, sub, now) => { const x = st.fighters.get(sub); return x ? { hp: Math.max(0, x.f.hp), max: x.f.max, down: x.down, downAt: Number.isFinite(x.downAt) ? x.downAt : 0, at: now } : null; };

/** A FIGHTER'S POSE (`{ x, y, z }`, the world frame): believed at a run the referee allows (refereeStep, on the fighter's
 *  own carried allowance); past it - a gallop, a respawn, a teleport - believed too, and the fighter JUMPED: it strikes
 *  nothing for WILD_REF.jumpMs (AUDIT INT9: a pose past the run was never believed, and the place stayed stale for good). */
export function wildPose(st, sub, p, now) {
  const x = st.fighters.get(sub);
  if (!x || !p || !Number.isFinite(p.x) || !Number.isFinite(p.z)) return false;
  if (x.pose && !refereeStep(x.pose, p, now - x.poseAt, x.f)) x.jumpAt = now;
  x.pose = { x: p.x, y: Number.isFinite(p.y) ? p.y : 0, z: p.z }; x.poseAt = now;
  return true;
}

/** Whole again: a fighter no player has struck for WILD_REF.mendMs that has stood in the zone as long (never one down) - its
 *  vitality alone (INT10: its own casts' window is its rate, never mended - the striker is unstruck, and every cast it made
 *  would have cleared it). */
const mend = (x, now) => { if (!x.down && now - x.struckAt >= WILD_REF.mendMs && now - x.zoneAt >= WILD_REF.mendMs) x.f.hp = x.f.max; };

/**
 * A BLOW OR A CAST in the zone - `by` and `to` accounts, `kin` the caller's word that the two are of one party or under its
 * truce, or duel each other (the hub's and the duel's - asked by the relay before it): landed only between two fighters
 * that both stand in the zone, neither down, never kin; judged by the referee (a strike on the weapon `held` its look
 * carries and the arms `wa` its token signs; a cast, `r` SIEGE_HIT.Spell, to its harm's most and rate). A fall makes the
 * fall record (`r` the remains' id the caller minted) - its killer the striker. Answers `{ ok, dealt, fell, fall, why }`.
 * @param {any} st @param {string} by @param {string} to
 * @param {{ d?: number, r?: number, held?: any, wa?: any, kin?: boolean, rid?: string }} o
 * @param {number} now
 */
export function wildBlow(st, by, to, { d = 0, r = SIEGE_HIT.Melee, held = null, wa = null, kin = false, rid = '' } = {}, now) {
  const a = st.fighters.get(by), t = st.fighters.get(to);
  if (!a || !t || by === to) return { ok: false, dealt: 0, fell: false, fall: null, why: 'no-fighter' };
  if (!a.zone || !t.zone) return { ok: false, dealt: 0, fell: false, fall: null, why: 'zone' };
  if (a.down || t.down) return { ok: false, dealt: 0, fell: false, fall: null, why: 'down' };
  if (kin) return { ok: false, dealt: 0, fell: false, fall: null, why: 'kin' };
  if (now - a.jumpAt < WILD_REF.jumpMs) return { ok: false, dealt: 0, fell: false, fall: null, why: 'jump' };
  mend(a, now); mend(t, now);
  const res = r === SIEGE_HIT.Spell
    ? refereeCast(a.f, t.f, { from: a.pose, at: t.pose, d }, now)
    : refereeBlow(a.f, t.f, { from: a.pose, at: t.pose, held, d, r, wa }, now);
  if (!res.ok || !res.dealt) return { ok: res.ok, dealt: 0, fell: false, fall: null, why: res.why };
  t.struckAt = now;
  if (!res.fell) return { ok: true, dealt: res.dealt, fell: false, fall: null, why: null };
  t.down = true; t.downAt = now;
  // a full room's oldest fall is SIGNED without its pick, never forgotten (AUDIT INT9: one pushed out was never signed - no
  // drop at all): the caller signs `evicted`
  let evicted = null;
  if (st.falls.size >= WILD_REF.fallsMax) { evicted = st.falls.values().next().value; evicted.picked = true; st.falls.delete(evicted.r); }
  const fall = { r: rid, fallen: to, fallenId: t.id, ci: t.ci, killer: by, killerId: a.id, at: now, w: -1, wt: null, picked: false };
  st.falls.set(rid, fall);
  return { ok: true, dealt: res.dealt, fell: true, fall, evicted, why: null };
}

/** THE KILLER'S PICK (`w` - its place in the fallen's worn offer; `wt` - the piece's template and material as the offer
 *  showed it, `[t, m]`, which the service matches against what the fallen really wears, AUDIT INT9: the place alone was an
 *  index into a list the fallen built): its own fall's, once, inside WILD_REF.pickMs. Answers the fall, now ready to
 *  sign, or null. */
export function wildPick(st, killer, rid, w, now, wt = null) {
  const fall = st.falls.get(rid);
  if (!fall || fall.killer !== killer || fall.picked || now - fall.at > WILD_REF.pickMs) return null;
  if (!Number.isInteger(w) || w < -1 || w >= 16) return null;
  fall.w = w; fall.picked = true;
  if (Array.isArray(wt) && wt.length === 2 && wt.every((n) => Number.isSafeInteger(n) && n >= 0 && n < 65536)) fall.wt = [wt[0], wt[1]];
  return fall;
}

/** A FALL SIGNED AT ONCE, without its pick - where no body is searched (a building's or a dungeon's room: the worn offer is
 *  the open country's). Answers the fall, or null. */
export function wildSignNow(st, rid) {
  const fall = st.falls.get(rid);
  if (!fall || fall.picked) return null;
  fall.picked = true;
  return fall;
}

/** A fall SIGNED: forgotten here (the receipt is the service's from now). */
export const wildSigned = (st, rid) => { st.falls.delete(rid); };

/** ONE BEAT (the relay calls it on the frames the room takes - no alarm): every fall whose killer has not picked inside
 *  WILD_REF.pickMs is ready to sign without a piece. Answers them. */
export function wildStep(st, now) {
  const out = [];
  for (const fall of st.falls.values()) if (!fall.picked && now - fall.at > WILD_REF.pickMs) { fall.picked = true; out.push(fall); }
  return out;
}

/** The fighters' vitality as the referee's word says it: `[[id, hp, max], [id, hp, max]]` for `a` and `b`. */
export const wildVitals = (st, a, b) => [a, b].map((sub) => { const x = st.fighters.get(sub); return [x.id, Math.max(0, x.f.hp), x.f.max]; });
