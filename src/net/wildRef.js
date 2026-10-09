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

/** The zone referee's own numbers: how long a fighter no player has struck takes to be whole again, how long a killer has
 *  to pick a worn piece before the fall is signed without one, the party's truce (systems/wildZone.js
 *  WILD_PARTY_TRUCE_MS, pinned equal - the hub holds it for the relay), and the most fighters and falls a room keeps. */
export const WILD_REF = Object.freeze({ mendMs: 30_000, pickMs: 60_000, truceMs: 10 * 60_000, fightersMax: 200, fallsMax: 64 });

/** A room's zone: its fighters by account, its falls waiting on a pick or a signature. */
export const newWildRef = () => ({ fighters: new Map(), falls: new Map() });

/**
 * A SOCKET'S WORD ON THE ZONE (`zone` - `z` true: it stands in the zone; false: it has left it): its fighter made or
 * kept (`id` its socket's id now, `lv` the Renown its token signs, `ci` its realm character), its place the pose it
 * stands at. A fighter down rises whole on its word that it stands in the zone again (its respawn). Answers the fighter.
 */
export function wildZone(st, sub, { id, lv = 1, ci = '' }, z, pose, now) {
  let x = st.fighters.get(sub);
  if (!x) {
    if (!z) return null;
    if (st.fighters.size >= WILD_REF.fightersMax) for (const [k, v] of st.fighters) if (!v.zone) { st.fighters.delete(k); break; }
    if (st.fighters.size >= WILD_REF.fightersMax) return null;
    x = { id, ci: ci || '', f: newFighter(lv, now), pose: pose ? { x: pose.x, y: Number.isFinite(pose.y) ? pose.y : 0, z: pose.z } : null, poseAt: now, zone: false, struckAt: -Infinity, down: false };
    st.fighters.set(sub, x);
  }
  x.id = id; if (ci) x.ci = ci;
  if (z && x.down) { const fresh = newFighter(lv, now); x.f = fresh; x.down = false; x.struckAt = -Infinity; }
  x.zone = !!z;
  return x;
}

/** A FIGHTER'S POSE (`{ x, y, z }`, the world frame): believed for reach only at a run the referee allows (refereeStep, on
 *  the fighter's own carried allowance). */
export function wildPose(st, sub, p, now) {
  const x = st.fighters.get(sub);
  if (!x || !p || !Number.isFinite(p.x) || !Number.isFinite(p.z)) return false;
  if (!x.pose || refereeStep(x.pose, p, now - x.poseAt, x.f)) { x.pose = { x: p.x, y: Number.isFinite(p.y) ? p.y : 0, z: p.z }; x.poseAt = now; }
  return true;
}

/** Whole again: a fighter no player has struck for WILD_REF.mendMs (never one down) - its vitality alone (INT10: its own
 *  casts' window is its rate, never mended - the striker is unstruck, and every cast it made would have cleared it). */
const mend = (x, now) => { if (!x.down && now - x.struckAt >= WILD_REF.mendMs) x.f.hp = x.f.max; };

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
  mend(a, now); mend(t, now);
  const res = r === SIEGE_HIT.Spell
    ? refereeCast(a.f, t.f, { from: a.pose, at: t.pose, d }, now)
    : refereeBlow(a.f, t.f, { from: a.pose, at: t.pose, held, d, r, wa }, now);
  if (!res.ok || !res.dealt) return { ok: res.ok, dealt: 0, fell: false, fall: null, why: res.why };
  t.struckAt = now;
  if (!res.fell) return { ok: true, dealt: res.dealt, fell: false, fall: null, why: null };
  t.down = true;
  if (st.falls.size >= WILD_REF.fallsMax) st.falls.delete(st.falls.keys().next().value);
  const fall = { r: rid, fallen: to, fallenId: t.id, ci: t.ci, killer: by, killerId: a.id, at: now, w: -1, picked: false };
  st.falls.set(rid, fall);
  return { ok: true, dealt: res.dealt, fell: true, fall, why: null };
}

/** THE KILLER'S PICK (`w` - its place in the fallen's worn offer): its own fall's, once, inside WILD_REF.pickMs. Answers
 *  the fall, now ready to sign, or null. */
export function wildPick(st, killer, rid, w, now) {
  const fall = st.falls.get(rid);
  if (!fall || fall.killer !== killer || fall.picked || now - fall.at > WILD_REF.pickMs) return null;
  if (!Number.isInteger(w) || w < -1 || w >= 16) return null;
  fall.w = w; fall.picked = true;
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
