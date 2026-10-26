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
//     systems/wild/wildZone.js builds it from the files every client holds), so a socket's zone is its own word: each says it
//     stands in it, and leaves it (`zone`). A blow lands only where BOTH fighters said so - a crafted client can opt out
//     of the zone's fights, never into another's: an honest player outside the zone is nobody's target. And never on KIN
//     (wildKin, below): a party member or one under the party's truce (the hub's word), the fighter's own duel opponent
//     (the duel's referee holds that one), or - Mac's decision, 2026-10-14: "Guildmates are friends" - one of its guild.
//   - THE VITALITY is the Royal Tourney's (300 + 2 x the Renown the token signs) - the zone's fights are the referee's
//     bar, as a siege's and a duel's are; the save's health is the foes' alone. A fighter no player has struck for
//     WILD_REF.mendMs is whole again.
//   - EVERY BLOW AND CAST is the referee's (refereeBlow, refereeCast - the weapon the striker's look holds, the arms its
//     token signs, the reach from both fighters' last BELIEVED places: a run the referee allows, never a teleport).
//   - A FALL is the referee's word: the fallen's vitality at none. The striker is its killer. AUDIT FOE-KEEPS E2 (the owner,
//     2026-10-24, asked: "Credit the last player"): and a fighter that dies to anything else - a foe, a fall, the sea -
//     within WILD_REF.creditMs of a fair player's blow falls to that player (wildCredit): since FOE-KEEPS such a death drops
//     nothing, and dying to a foe at the last second denied the killer everything. The killer then has
//     WILD_REF.pickMs to choose one worn piece of the fallen's (`pick` - its place in the offer the fallen's game showed,
//     systems/wild/wildDropLaw.js wornOffer); then the relay signs the fall (net/wild/wildReceipt.js `f1`) and hands it to both, and
//     the account service takes the drop and that piece off the fallen's judged record against it.
//
// Pure: no clock (every `now` an argument), no socket, no storage - the relay's room keeps the state in its memory
// (DECIDED, the duel's: a room that restarts mid-fight forgets it; a fall already signed is the service's to settle).
// ═════════════════════════════════════════════════════════════════════
import { SIEGE_HIT, newFighter, refereeBlow, refereeCast, refereeStep } from '../siege/siegeRef.js';

/** The zone referee's own numbers: how long a fighter no player has struck - and that has stood in the zone as long - takes
 *  to be whole again; how long a killer has to pick a worn piece before the fall is signed without one; the party's truce
 *  (systems/wild/wildZone.js WILD_PARTY_TRUCE_MS, pinned equal - the hub holds it for the relay); how long a fallen stays down
 *  before its word that it stands in the zone raises it (the death screen's WILD_DEATH_HOLD_S, pinned equal - AUDIT INT9:
 *  it rose on its next word, where it fell, whole), and how long one away from the zone that long comes back whole; how
 *  long a fighter whose pose jumped past any run strikes nothing (AUDIT INT9: a jump was never believed, so a gallop, a
 *  respawn or a reconnect left its place stale for good - now it is believed, and the jumper waits); the most fighters
 *  and falls a room keeps; AUDIT FOE-KEEPS E2: how recent a fair player's blow names them the killer of a death the
 *  referee did not see (systems/wild/wildZone.js WILD_KILL_CREDIT_MS, pinned equal - "the player who brought you down"). */
export const WILD_REF = Object.freeze({ mendMs: 30_000, pickMs: 60_000, truceMs: 10 * 60_000, riseMs: 120_000, jumpMs: 2_000, fightersMax: 200, fallsMax: 64, creditMs: 10_000 });

/** MAC'S DECISION (2026-10-14, "Guildmates are friends"): ONE GUILD - two guilds' marks, each present and the same. A
 *  mark is the relay's verified guild id (the token's `gi`) or a client's guild tag (`gt` - a tag is one guild's alone,
 *  UNIQUE in the service's `guilds`), never one of each. */
export const sameGuild = (/** @type {unknown} */ a, /** @type {unknown} */ b) => typeof a === 'string' && a.length > 0 && a === b;

/**
 * MAC'S DECISION (2026-10-14): WHO IS KIN IN THE ZONE - never a fair foe, struck by nobody: one of my party or under its
 * truce (`party` - the hub's word at the relay, the social picture and the truce book on a client), my own duel's
 * opponent (`duel` - its blows are the duel's), or one of my guild (`guilds`, the two guilds' marks - sameGuild). ONE LAW,
 * BOTH ENDS: the referee asks it of every blow and cast (server/src/index.js `_wildBlow`, before wildBlow below), every
 * client door asks it of its targets (scenes/world.js wildFair), and the remains' friend law reads its guild half
 * (`_wildWord`, world.js canTake). Answers whether the two are kin.
 * @param {{ party?: boolean, duel?: boolean, guilds?: unknown[] | null }} o
 */
export function wildKin({ party = false, duel = false, guilds = null } = {}) {
  return !!party || !!duel || (Array.isArray(guilds) && sameGuild(guilds[0], guilds[1]));
}

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

/** INT9 (AUDIT): a hub's word on a fighter's carry, checked for the shape wildCarry writes - or null. AUDIT SEA VENTURES
 *  F1/A1: with its ship's where it has one (`sea` - net/sea/seaRef.js seaCarry: her bar's share and when a captain last
 *  struck her). */
export function wildCarryOf(v) {
  if (!v || typeof v !== 'object' || !Number.isFinite(v.at) || !Number.isFinite(v.hp) || !Number.isFinite(v.max)) return null;
  const sea = v.sea && typeof v.sea === 'object' && Number.isFinite(v.sea.h) && Number.isFinite(v.sea.at) ? { h: Math.max(0, Math.min(1, v.sea.h)), at: v.sea.at } : null;
  return { hp: Math.max(0, Math.trunc(v.hp)), max: Math.max(1, Math.trunc(v.max)), down: v.down === true, downAt: Number.isFinite(v.downAt) ? v.downAt : 0, at: v.at, ...(sea ? { sea } : {}) };
}

/** INT9 (AUDIT): A FALL WAITING ON ITS PICK is kept in the room's storage under this prefix (a relay object that restarts
 *  mid-wait signed it never - no drop at all), and read back the first time the restarted room's zone is asked. */
export const WILD_FALL_PREFIX = 'wildfall:';
/** A fall read back from storage, checked for the shape wildBlow writes - or null. */
export function wildFallOf(v) {
  if (!v || typeof v !== 'object' || typeof v.r !== 'string' || typeof v.fallen !== 'string' || typeof v.killer !== 'string' || !Number.isFinite(v.at)) return null;
  return { r: v.r, fallen: v.fallen, fallenId: typeof v.fallenId === 'string' ? v.fallenId : '', ci: typeof v.ci === 'string' ? v.ci : '', killer: v.killer, killerId: typeof v.killerId === 'string' ? v.killerId : '', kc: typeof v.kc === 'string' ? v.kc : '', m: typeof v.m === 'string' ? v.m : '', at: v.at,
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
 * A BLOW OR A CAST in the zone - `by` and `to` accounts, `kin` the caller's wildKin over the two (one party or its truce,
 * a duel's two, one guild - asked by the relay before it): landed only between two fighters
 * that both stand in the zone, neither down, never kin; judged by the referee (a strike on the weapon `held` its look
 * carries and the arms `wa` its token signs; a cast, `r` SIEGE_HIT.Spell, to its harm's most and rate). A fall makes the
 * fall record (`r` the remains' id the caller minted) - its killer the striker, `room` the room that refereed it (SEA-BOUNTY:
 * signed into its receipt, `m`). Answers `{ ok, dealt, fell, fall, why }`.
 * @param {any} st @param {string} by @param {string} to
 * @param {{ d?: number, r?: number, held?: any, wa?: any, kin?: boolean, rid?: string, room?: string }} o
 * @param {number} now
 */
export function wildBlow(st, by, to, { d = 0, r = SIEGE_HIT.Melee, held = null, wa = null, kin = false, rid = '', room = '' } = {}, now) {
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
  t.by = { sub: by, at: now, room: typeof room === 'string' ? room : '' };   // AUDIT FOE-KEEPS E2: the last fair player's blow
  if (!res.fell) return { ok: true, dealt: res.dealt, fell: false, fall: null, why: null };
  const { fall, evicted } = fallOf(st, rid, to, t, by, a, room, now);
  return { ok: true, dealt: res.dealt, fell: true, fall, evicted, why: null };
}

/** A fighter `t` (account `to`) down at `a`'s hand (account `by`): its fall record under `rid` (the caller's), the room
 *  `room` that refereed it. A full room's oldest fall is SIGNED without its pick, never forgotten (AUDIT INT9: one pushed
 *  out was never signed - no drop at all): the caller signs `evicted`. */
function fallOf(/** @type {any} */ st, /** @type {string} */ rid, /** @type {string} */ to, /** @type {any} */ t, /** @type {string} */ by, /** @type {any} */ a, /** @type {unknown} */ room, /** @type {number} */ now) {
  t.down = true; t.downAt = now; t.by = null;
  // WILD-REJOIN: where the body lies, kept with the fighter after the fall is signed and forgotten - a fallen whose game
  // closed and comes back to this room is told it (wildDownWord), so the drop it takes is laid where it fell
  t.fell = { r: rid, at: now, pose: t.pose ? { ...t.pose } : null };
  let evicted = null;
  if (st.falls.size >= WILD_REF.fallsMax) { evicted = st.falls.values().next().value; evicted.picked = true; st.falls.delete(evicted.r); }
  const fall = { r: rid, fallen: to, fallenId: t.id, ci: t.ci, killer: by, killerId: a.id, kc: a.ci || '', m: typeof room === 'string' ? room : '', at: now, w: -1, wt: null, picked: false };   // SEA-BOUNTY: the killer's character and the room, for the receipt
  st.falls.set(rid, fall);
  return { fall, evicted };
}

/** AUDIT FOE-KEEPS E2 (the owner, 2026-10-24, asked: "Credit the last player"): A DEATH THE REFEREE DID NOT SEE - the
 *  fighter's own word that it died (`zone` 0 with `dd`: a foe, a fall, the sea, a hall's trap) - is the kill of the last
 *  fair player whose blow landed on it within WILD_REF.creditMs, as the duel's referee counts a fighter fallen to
 *  something else its opponent's win and the sea's credits a wreck to a captain's shot: its fall made as a blow's is, in
 *  the room that last blow was refereed in. None when no player struck it that lately, it is down already, or its striker
 *  has left the room's memory. Answers `{ fall, evicted }` or null. */
export function wildCredit(/** @type {any} */ st, /** @type {string} */ sub, /** @type {string} */ rid, /** @type {number} */ now) {
  const t = st.fighters.get(sub), by = t?.by;
  if (!t || t.down || !by || !(now - by.at <= WILD_REF.creditMs)) return null;
  const a = st.fighters.get(by.sub);
  if (!a || by.sub === sub) return null;
  return fallOf(st, rid, sub, t, by.sub, a, by.room, now);
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

/** WILD-REJOIN: the least time a fallen must still have to lie for the referee to tell it so, ms. Its own game counts its
 *  two minutes from the fall on its own clock, and a death in a hall rises in a town of the zone - so a risen fallen
 *  can stand in the zone a moment before the referee's clock lets it up. Under this margin the word would kill it again. */
export const WILD_DOWN_SAY_MIN_MS = 5_000;

/**
 * WILD-REJOIN (FIELD BUGS 2026-10-25h, "if you die in the wilderness and alt f4 before you are looted ... you can also skip
 * the death timer this way"): THE REFEREE'S WORD TO A FALLEN THAT IS STILL DOWN. A fall lives in the referee and on the
 * dying game's screen alone: the account service's record is the last save from before it (a dead character is never
 * saved), so a game closed on the death screen came back alive. The referee keeps the fighter down for WILD_REF.riseMs -
 * here, or by the hub's carry in another room - and answers `{ k: 'down', ms, r?, p? }` for the socket that says it
 * stands in the zone: how long the death has left, and, where the fall was refereed in this room, its remains' id and
 * where the body lies (`[x, y, z]`, the room's frame). Null for a fighter up, unknown, or with less than
 * WILD_DOWN_SAY_MIN_MS to lie.
 * @param {any} st @param {string} sub @param {number} now
 * @returns {{ k: 'down', ms: number, r?: string, p?: number[] } | null}
 */
export function wildDownWord(st, sub, now) {
  const fighter = st.fighters.get(sub);
  if (!fighter || !fighter.down) return null;
  const left = WILD_REF.riseMs - (now - fighter.downAt);
  if (left < WILD_DOWN_SAY_MIN_MS) return null;
  const word = { k: /** @type {'down'} */ ('down'), ms: Math.ceil(left) };
  // a fall carried from another room (takeCarry) has its downAt and no body here
  const body = fighter.fell && fighter.fell.at === fighter.downAt ? fighter.fell : null;
  if (!body) return word;
  const where = body.pose ? { p: [body.pose.x, body.pose.y, body.pose.z] } : {};
  return { ...word, r: body.r, ...where };
}

/** The fighters' vitality as the referee's word says it: `[[id, hp, max], [id, hp, max]]` for `a` and `b`. */
export const wildVitals = (st, a, b) => [a, b].map((sub) => { const x = st.fighters.get(sub); return [x.id, Math.max(0, x.f.hp), x.f.max]; });
