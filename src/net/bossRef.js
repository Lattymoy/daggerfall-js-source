// @ts-check
// INT11-INT13 (2026-10-10, the INTEGRITY arc's lane 3 - bible/06-Systems/Integrity-Arc.md section 6): THE BOSS'S BLOWS
// JUDGED WHERE THE CLIENT CANNOT SKIP THEM - each fight's own test of where a blow lands (net/gate/gateStrike.js,
// net/superDungeon/sdStrike.js's geometry in net/superDungeon/sdRemnant.js, systems/serpent/serpentStrike.js), run on the relay against the poses it
// already holds, at its beat. What each answers is the share the relay's count of the struck fighter takes
// (net/bossBody.js bodyStruck).
//
// WHAT IS COUNTED: the blows no saving throw answers - a plain blow (no element), Dagon's Wrath and Reckoning, the
// Hour's own (the Mantella Pulse, the Reset, the Hour's End), and every hurt the serpent does a hull (a hull keeps no
// save). An element's blow is the client's: its save is the client's own (systems/spellcast.js savingThrow), and a
// lawful character can be immune; its burning ground the same. A share is the blow's `pct` alone - its `base` points
// need a maximum health the relay does not hold, and leaving them out is the struck player's favour.
//
// IN THE STRUCK PLAYER'S FAVOUR, ALWAYS: a body is struck only standing BODY_MARGIN deep in a shape (bossBody.js
// deepIn) both where its last pose before the landing put it and where its first after does (`tr`, the relay's trail of
// its poses - its standing pose when it sent none: it has not moved), so a body that stepped out as it landed, or in
// after, is never counted; a blow over a span, the same at the beat's two ends. AUDIT INT11: a trail whose every pose
// came after the landing does not say where it stood at it - never counted (an empty one, `[]`, is the relay's word that
// it does not know). The Stomp's rolling ring (a jump lets
// it pass, and a pose says no ground) and any burning ground are never counted; a pillar's shade is taken at any
// height. The relay's count is what the body took at the least; the client's own is what it says.
//
// EACH BLOW ONCE: a blow judged at its landing is marked (`bj`); one that runs over a span - the Warden's charge, the
// Hour-Hand's sweep, the serpent's ram - is judged each beat of its span between the beat before (`f.bjAt`) and this
// one, each body struck once (`bh`), and marked when its span is done. The marks ride the blow's own record in the fight,
// so a fight checkpointed and woken judges nothing twice.
//
// PURE: a fight, its bodies (the relay's census, each `{sub, x, z, dead, tr?}` in the fight's own frame - `tr` its
// trail, `[[t, x, z], ...]` oldest first, the relay's clock), the clock in; `[{sub, share}]` out, the fight's blows
// marked in place. Not a DFU member. Ledger A (INT).
//
// EG-H1 (EG8d, 2026-10-12; bible/11-Multiplayer/Elite-Gates.md section 21): THE SPIRE'S JUDGE BESIDE THEM - judgeShapes,
// one judge for every FULL shape stamp, per fight floor, on SHARED-TIME trails (net/eliteGates/egFair.js's time law - `[t, x, y, z, h]`,
// `t` the pose's own send time on the relay's clock), and judgePlace, the hall's own hazards at their landing. The three
// above keep their arrival-timed trails: their enforcement is off (BODY_DEFAULT.enforce), so their error was never paid.
import { ATTACK_BY_ID, ATTACKS, profileOf, flameProfileOf, hostBlowUnder, screenJudged, wardTakes } from './gate/gateBrain.js';
import { inAttack, chargeStrikes, wheelStrikes, blowOf } from './gate/gateStrike.js';
import { SD_BLOW_BY_ID, SD_BLOWS, SD_RESET_PCT, SD_END_PCT, SD_ARENA_SLACK, blowShape, pulsePctOf, handSwept, behindPillar, inArena } from './superDungeon/sdRemnant.js';
import { SERPENT_ATTACK_BY_ID, SERPENT_ATTACK_TABLE, GRIP, CRUSH, MAEL_GRIND, MAEL_EYE_R, coilHolds, serpentShipsFighting, serpentOnShip } from './serpent/serpentBrain.js';
import { shapeMeets, fleetShare } from '../systems/serpent/serpentStrike.js';
import { deepIn, BODY_AFTER_MS } from './bossBody.js';
import { egInBlow, egInShape } from './eliteGates/egShape.js';   // EG-H1: the Spire's FULL shape stamps, one judge for them all
import { egTrailAt, egTrailAfter, egTrailNear, egTrailReady, egFightFloorAt, EG_POSE_WAIT_MS, EG_POSE_NEAR_MS, EG_TS_LAG_MAX_MS } from './eliteGates/egFair.js';   // EG-H1: THE TIME LAW's trails; AUDIT EG V: the edge a trail is whole to
import { egVentAt, EG_VENT_PCT } from './eliteGates/egLaw.js';
import { egStampFloors } from './eliteGates/egLaw.js';   // THE ASCENT - HEIGHT: a stamp lands on the floors of its own storey
import { egFeetY, egOneStorey } from './eliteGates/egWalkGraph.js';
import { egHazardParts, EG_HAZARDS } from './eliteGates/egFragLaw.js';

const dist = (ax, az, bx, bz) => Math.hypot(ax - bx, az - bz);
/** The living bodies a fight counts (a fighter of its own, not dead by its census). */
const living = (f, bodies) => bodies.filter((b) => !b.dead && f.players?.[b.sub]);
/** Where body `b` stood at `t` by its trail: its last pose at or before `t`; no trail, where it stands (it sent no pose
 *  since the relay began keeping them - it has not moved). AUDIT INT11: a trail with none at or before `t` - its first
 *  pose came after (a socket new to the fight, a trail pruned past it, an instance's trails lost to its sleep: `[]`) - is
 *  null, NOT KNOWN: its first pose after `t` read as where it stood counted a body that stepped in after the landing.
 *  Pure. @param {{x: number, z: number, tr?: number[][]}} b @param {number} t @returns {number[] | null} */
export function posAt(b, t) {
  if (!b.tr) return [b.x, b.z];
  let q = null;
  for (const p of b.tr) { if (p[0] <= t) q = p; else break; }
  return q ? [q[1], q[2]] : null;
}
/** Where body `b` stood next after `t`: its first pose after it, else where it stands (it sent none since - it has not
 *  moved). Pure. @param {{x: number, z: number, tr?: number[][]}} b @param {number} t */
export function posAfter(b, t) {
  for (const p of b.tr ?? []) if (p[0] > t) return [p[1], p[2]];
  return [b.x, b.z];
}
/** EG-H3 (Elite-Gates.md sections 11.7 and 31, EG3): THE TRAILS KEEP Y - the height body `b` stood at by its trail at
 *  `t`: its last pose at or before `t` (an entry's fourth, `[t, x, z, y]` - the relay's _trailOf); no trail, its own `y`;
 *  null when that is not known (all after, or a trail that never said a height). posAt's twin for the per-floor judge
 *  (a member is on a floor while its height lies in the floor's band); posAt and posAfter are unchanged. Pure.
 *  @param {{y?: number, tr?: number[][]}} b @param {number} t @returns {number | null} */
export function posYAt(b, t) {
  if (!b.tr) return Number.isFinite(b.y) ? b.y : null;
  let q = null;
  for (const p of b.tr) { if (p[0] <= t) q = p; else break; }
  return q && Number.isFinite(q[3]) ? q[3] : null;
}
/** Is body `b` deep in `test` at `t` - before it and after it both (where it stood before not known: no)? */
const deepAt = (test, b, t) => { const p0 = posAt(b, t), [x1, z1] = posAfter(b, t); return !!p0 && deepIn(test, p0[0], p0[1]) && deepIn(test, x1, z1); };

/**
 * A blow that runs over a span, judged this beat: each living body not yet struck that `hits` over `t0`..`t1` - where it
 * stood at the beat's start and at its end both - takes `share` (`bh` the struck), and the blow is marked done once the
 * beat passes its span's end.
 */
function sweep(a, bodies, t0, t1, end, share, hits, out) {
  a.bh ??= [];
  const test = (x, z) => hits(x, z, t0, t1);
  for (const b of bodies) {
    if (a.bh.includes(b.sub)) continue;
    const p0 = posAt(b, t0), p1 = posAt(b, t1);
    if (!p0 || !p1 || !deepIn(test, p0[0], p0[1]) || !deepIn(test, p1[0], p1[1])) continue;
    a.bh.push(b.sub);
    out.push({ sub: b.sub, share });
  }
  if (t1 >= end) a.bj = true;
}
/** A blow decided at its landing `t`: each living body deep in its shape before and after `t` takes `share`; the blow is
 *  marked. */
function landing(a, bodies, share, inside, out, t = a.at) {
  a.bj = true;
  if (!(share > 0)) return;
  for (const b of bodies) if (deepAt(inside, b, t)) out.push({ sub: b.sub, share });
}

/** INT11: one body's blow in flight, judged at its landing under its profile - a charge down its lane and (WB14a) the Wheel
 *  down its turn between beats, the rest in their shape (WB14d: his, the Blade's or the Flame's). */
function bodyBlow(a, live, P, prev, now, out) {
  if (!a || a.bj || now < a.at) return;
  const A = ATTACK_BY_ID[a.a], B = blowOf(a, P), share = B && !B.saved ? Math.min(1, B.pct) : 0;
  if (!A || !(share > 0) || screenJudged(A)) a.bj = true;   // WB14a: the Chains (a pull) and the Gaze (a camera) are the struck screen's alone
  else if (A === ATTACKS.charge) sweep(a, live, Math.max(prev, a.at), now, a.at + A.active, share, (x, z, t0, t1) => chargeStrikes(a, x, z, t1, t0, P), out);
  else if (A === ATTACKS.wheel) sweep(a, live, Math.max(prev, a.at), now, a.at + A.active, share, (x, z, t0, t1) => wheelStrikes(a, x, z, t1, t0, P), out);   // WB14a: the Wheel down its turn, as the charge down its lane
  else if (A.shape === 'all' || now >= a.at + BODY_AFTER_MS) landing(a, live, share, (x, z) => inAttack(a, x, z, P), out);
}

/**
 * INT11 - THE GATE: his blow in flight (`f.atk`) and each of his host's (`f.lg.ads[].atk`, the Legion-Lord's), judged
 * at its landing (net/gate/gateStrike.js inAttack - a charge down its lane between beats, chargeStrikes), each a plain blow's
 * or Dagon's share (blowOf - `saved`, an element's, is the client's).
 * @param {any} f @param {Array<{sub: string, x: number, z: number, dead: boolean}>} bodies the court's frame @param {number} now
 * @returns {Array<{sub: string, share: number}>}
 */
export function judgeGate(f, bodies, now) {
  if (f.fell || f.wrath) return [];
  const out = [], live = living(f, bodies), prev = Math.max(f.bjAt ?? -Infinity, now - 1000);
  f.bjAt = now;
  if (wardTakes(f.cp, f.atk)) f.atk.bj = true;   // WB14f: the Reckoning the Covenant's ward takes lands on no fighter
  bodyBlow(f.atk, live, profileOf(f), prev, now, out);
  if (f.sd) bodyBlow(f.sd.fl.atk, live, flameProfileOf(f), prev, now, out);   // WB14d: and his Flame's, by its own body
  const P = profileOf(f);
  for (const ad of f.lg?.ads ?? []) {
    const h = ad.atk;
    if (!h || h.bj || now < h.at + BODY_AFTER_MS) continue;
    const B = hostBlowUnder(ad.k, P);
    if (!B || B.el != null) { h.bj = true; continue; }
    landing(h, live, Math.min(1, B.pct), (x, z) => dist(x, z, h.x, h.z) <= B.r, out);
  }
  return out;
}

/**
 * INT12 - THE ABYSS DUNGEON: the Remnant's blow in flight, each Echo's, and the Hour's own (`f.clock` - the Pulse, the
 * End): the Stomp's disc at its landing, the Hour-Hand over its sweep (a pillar's shade spares), the Gear Volley's discs,
 * the Hour's own over the whole arena (never the Steps) - and the Reset only while its Hearts stand at its landing. A
 * blow its Hollow's marks gave an element is the client's.
 * @param {any} f @param {Array<{sub: string, x: number, z: number, dead: boolean}>} bodies the arena's frame @param {number} now
 * @returns {Array<{sub: string, share: number}>}
 */
export function judgeRemnant(f, bodies, now) {
  if (f.fell || f.lost) return [];
  const out = [], live = living(f, bodies), prev = Math.max(f.bjAt ?? -Infinity, now - 1000);
  f.bjAt = now;
  const blows = [f.rem?.atk, ...(f.ec ?? []).map((X) => X.body?.atk), f.clock];
  for (const a of blows) {
    if (!a || a.bj || now < a.at) continue;
    const A = SD_BLOW_BY_ID[a.a], S = A ? blowShape(a) : null;
    if (!A || !S || (S.el && A.shape !== 'all')) { if (a) a.bj = true; continue; }
    const end = a.at + Math.max(S.active, 0);
    if (A.shape === 'sweep') { sweep(a, live, Math.max(prev, a.at), now, end, A.pct, (x, z, t0, t1) => handSwept(a, x, z, t0, t1) && !behindPillar(a.x, a.z, x, z), out); continue; }
    if (A.shape === 'stomp' || A.shape === 'disc') {
      if (now < a.at + BODY_AFTER_MS) continue;
      if (A.shape === 'stomp') landing(a, live, A.pct, (x, z) => dist(x, z, a.x, a.z) <= S.r, out);
      else landing(a, live, A.pct, (x, z) => (a.tg ?? []).some((q) => dist(x, z, q[0], q[1]) <= S.r), out);
      continue;
    }
    a.bj = true;   // the Hour's own: at its landing (the Reset's Hearts are spent in the beat it lands)
    const share = A === SD_BLOWS.pulse ? pulsePctOf(a) : A === SD_BLOWS.reset ? (f.cx ? SD_RESET_PCT : 0) : SD_END_PCT;
    if (share > 0) for (const b of live) if (deepAt((x, z) => inArena(x, z, SD_ARENA_SLACK), b, a.at)) out.push({ sub: b.sub, share });
  }
  return out;
}

/**
 * INT13 - THE SERPENT, on each ship of her own afloat (her captain's pose her hull's place - a footprint the relay does
 * not hold, so her helm alone, the favour again): its blow at its landing (the ram down its lane over its run), the
 * coil's grip each second it holds the ship it closed about (her pose deep in its ring as it landed - her `esc` is her
 * word, the ring the relay's) and its crush as it lets her go crushed, and the Maelstrom's eye grinding her - each a
 * share of her hull at the fleet's share (systems/serpent/serpentStrike.js fleetShare).
 * @param {any} f @param {Array<{sub: string, x: number, z: number, dead: boolean}>} bodies the site's frame @param {number} now
 * @returns {Array<{sub: string, share: number}>}
 */
export function judgeSerpent(f, bodies, now) {
  if (f.fell || f.gone) return [];
  const out = [], prev = Math.max(f.bjAt ?? -Infinity, now - 1000), dtS = Math.max(0, now - prev) / 1000;
  f.bjAt = now;
  const ships = bodies.filter((b) => { const p = f.players?.[b.sub]; return p && !b.dead && !p.wreck && serpentOnShip(p); });
  const k = fleetShare(f.ships ?? serpentShipsFighting(f));
  const pt = (x, z) => ({ x, z, yw: 0, hl: 0, hw: 0 });
  const a = f.atk;
  if (a && !a.bj && now >= a.at) {
    const A = SERPENT_ATTACK_BY_ID[a.a], share = A ? A.hull * k : 0;
    if (!A || !(share > 0)) a.bj = true;
    else if (A === SERPENT_ATTACK_TABLE.ram) sweep(a, ships, Math.max(prev, a.at), now, a.at + A.active, share, (x, z, t0, t1) => shapeMeets(a, pt(x, z), t1), out);
    else if (now >= a.at + BODY_AFTER_MS) landing(a, ships, share, (x, z) => shapeMeets(a, pt(x, z), a.at), out);
  }
  const c = f.coil;
  if (c && c.s && now >= c.at) {
    const ship = ships.find((b) => b.sub === c.s);
    if (c.bg == null && now >= c.at + BODY_AFTER_MS) c.bg = !!ship && deepAt((x, z) => dist(x, z, c.x, c.z) <= SERPENT_ATTACK_TABLE.coil.r, ship, c.at);
    if (c.bg && ship && coilHolds(f, now) && dtS > 0) out.push({ sub: c.s, share: GRIP.hull * dtS * k });
    if (c.bg && c.why === 'crushed' && !c.bcr) { c.bcr = true; if (ship) out.push({ sub: c.s, share: CRUSH.hull * k }); }
  }
  const m = f.mael;
  if (m && now >= m.at && dtS > 0) for (const b of ships) if (deepAt((x, z) => dist(x, z, m.x, m.z) <= MAEL_EYE_R, b, prev)) out.push({ sub: b.sub, share: MAEL_GRIND.hull * dtS * k });
  return out;
}

// ── EG-H1 (EG8d, 2026-10-12; bible/11-Multiplayer/Elite-Gates.md section 21): THE SPIRE - ONE JUDGE FOR EVERY SHAPE ──
// Every Spire blow travels with its FULL shape stamp (net/eliteGates/egShape.js - its kind and every number), so one judge tests any
// blow a lord, an add, an engine or a decree throws, per fight floor (section 11.7 - net/eliteGates/egFair.js egFightFloorAt), against
// the member's SHARED-TIME trail (net/eliteGates/egFair.js - the time law: where it stood at the landing is its last pose SENT at or
// before it, where it stood after is the first SENT after it, waited for up to EG_POSE_WAIT_MS; no pose within
// EG_POSE_NEAR_MS of the landing, not counted), deep in it by THE WIDTH RULE's margin both times (deepIn). What it answers
// feeds net/bossBody.js's count (bodyStruck) and the census. WHAT IS COUNTED is the gate's law: a plain blow's share; an
// element's blow is the struck member's own save, so it is SEEN (the census) and takes nothing (`share` 0). Each blow
// once per body (`bh`), marked done (`bj`) once its wait is over.
/** THE ASCENT (Elite-Gates-Ascent.md section 2): does a trail entry `e` (`[t, x, y, z, h]`) stand in the storey of a blow
 *  landing at height `by` (net/eliteGates/egWalkGraph.js egOneStorey - its fight floor's top, else its feet)? Any when `by` is not
 *  known (a hall that judges in plan alone, a blow that says no height). */
const inStorey = (spec, e, by) => !Number.isFinite(by) || egOneStorey(egFightFloorAt(spec, e[1], e[2], e[3])?.y ?? e[2], by);
/**
 * Is a body on trail `tr` deep in `test` at the landing `at` in hall `h` - before it and after it both, on a fight floor of
 * one of `ys` (the heights the blow lands at; null any)? THE ASCENT (section 2): and in the storey of the blow's own height
 * `by` (a blow on a floor stacked over another never lands on a body on the one under it, nor the other way). Pure.
 */
function deepShared(test, tr, at, h, spec, ys, free = false, by = NaN) {
  if (!egTrailNear(tr, at)) return false;
  const p0 = egTrailAt(tr, at), p1 = egTrailAfter(tr, at) ?? p0;
  if (!p0 || p0[4] !== h || p1[4] !== h) return false;
  if (!free) for (const p of [p0, p1]) { const f = egFightFloorAt(spec, p[1], p[2], p[3]); if (!f || (ys && !ys.includes(f.y ?? 0))) return false; }
  if (!inStorey(spec, p0, by) || !inStorey(spec, p1, by)) return false;
  return deepIn(test, p0[1], p0[3]) && deepIn(test, p1[1], p1[3]);
}
/**
 * EG-ZB (section 21): CAUGHT WHILE IT LASTS - a pose of trail `tr` sent in (`from`, `until`] (the shared ms a lingering field
 * stands: a charge's run, a burning bridge, a fire fall's burning) in hall `h` that stands in `test` - deep in it by THE
 * WIDTH RULE's margin on a fight floor of one of `ys` (an aimed blow's law); or `point`, at its feet within `band` m of the
 * field's height `y` wherever it stands (a traversal hazard's - the screens' own egHazardBites). Pure.
 */
function caughtWhile(test, tr, from, until, h, spec, ys, { free = false, point = false, y = null, band = 1.5, by = NaN } = {}) {
  for (const e of tr ?? []) {
    if (e[0] <= from || e[0] > until || e[4] !== h) continue;
    if (point) { if ((y == null || Math.abs(e[2] - y) <= band) && test(e[1], e[3])) return true; continue; }
    if (!free) { const f = egFightFloorAt(spec, e[1], e[2], e[3]); if (!f || (ys && !ys.includes(f.y ?? 0))) continue; }
    if (!inStorey(spec, e, by)) continue;   // THE ASCENT: the blow's own storey
    if (deepIn(test, e[1], e[3])) return true;
  }
  return false;
}
/** The fight floors' heights a stamp lands on: those whose plan holds its anchor (a CHECK's, every floor: null). EG-HERO-LAY: a
 *  hero's fight floor, its polygon. THE ASCENT (Elite-Gates-Ascent.md section 2): in a hall that judges by height, those of the
 *  storey of the blow's own height `y` alone (net/eliteGates/egLaw.js egStampFloors - the rule's one home). */
const floorsUnder = (spec, s, y = NaN) => egStampFloors(spec, s, y, 1);
/**
 * EG-H1 - THE SPIRE'S BLOWS (`F.blows`, net/eliteGates/egBodies.js - each said with its FULL stamp): each landed blow judged on each
 * living member's shared-time trail once its trail is ready (egTrailReady) - `[{sub, share, i, k: 0}]`, `share` the blow's
 * `p` for a plain blow (its points need a maximum health the relay does not hold: the struck member's favour), 0 for an
 * element's (seen, never counted). A feint never lands (its cut takes it off the fight). The blows marked in place.
 * EG-ZB (sections 11.7, 19 and 21): each hit says its blow's landing, thrower and name (`at`, `o`, `nm` - the census's
 * Vestiges and the feats read them); a blow with a span (`sp` - a charge's run, a burning bridge) also catches a body that
 * steps into it while it lasts; a hunted member's Bite (`hn`) is judged off the floors. `spec` the hall's fight ground
 * (net/eliteGates/egWalkGraph.js egFightView). AUDIT EG V (lane1 #9; section 13.2's CHECK class): a blow that NAMES its members (`on` - an
 * errand's failure blow: the Chain Snaps, a Soul Burst, the Cage Closes; net/eliteGates/egShape.js egBlowOn) is counted on exactly those
 * members, wherever their trail stands at its landing (in the hall, a pose near it - the time law), and on no one else: its
 * marks only ride them, so where they lie decides nothing - the screen's own verdict (egBlowVerdict).
 * @param {any} F the hall's fight @param {Array<{sub: string, tr?: number[][]}>} bodies the living members, each its trail
 * (`[t, x, y, z, h]` - the hall's frame, shared ms) @param {number} now @param {any} spec the hall
 * @returns {Array<{sub: string, share: number, i: number, k: number, at: number, o: number, nm: string}>}
 */
export function judgeShapes(F, bodies, now, spec) {
  const out = [];
  if (!F) return out;
  for (const a of F.blows ?? []) {
    if (a.bj || now < a.at) continue;
    a.bh ??= [];
    // THE ASCENT (section 2): the blow's own height (`y` - its thrower's storey, net/eliteGates/egBodies.js egAim) in a hall that judges by height
    const by = egFeetY(spec, a.y), share = a.el == null ? Math.min(1, Math.max(0, a.p)) : 0, ys = floorsUnder(spec, a.s?.[0], by), sp = Math.max(0, a.sp ?? 0), test = (x, z) => egInBlow(a, x, z);
    for (const b of bodies) {
      if (a.bh.includes(b.sub)) continue;   // caught, or judged at its landing
      // EG-ZB (section 11.7): a Harrier's Bite on a member it HUNTS (`hn`) is judged off the floors for that member alone
      const free = a.hn === b.sub, hit = { sub: b.sub, share, i: a.i, k: 0, at: a.at, o: a.o ?? 0, nm: a.nm ?? '' };
      if (a.on) {   // AUDIT EG V (lane1 #9): the members it names, wherever they stand - never another
        if (!a.on.includes(b.sub)) { a.bh.push(b.sub); continue; }
        if (!egTrailReady(b.tr, a.at, now)) continue;
        a.bh.push(b.sub);
        if (egTrailNear(b.tr, a.at) && egTrailAt(b.tr, a.at)?.[4] === F.h) out.push(hit);
        continue;
      }
      if (sp > 0) {
        // EG-ZB (section 21): A LINGERING FIELD (a charge's run, a burning bridge) catches at its landing as a blow does, or by
        // any pose sent inside it while it lasts - the screens' own verdict (net/eliteGates/egShape.js egBlowVerdict's span)
        a.bl ??= {}; a.bt ??= {};
        if (!a.bl[b.sub]) { if (!egTrailReady(b.tr, a.at, now)) continue; a.bl[b.sub] = 1; if (deepShared(test, b.tr, a.at, F.h, spec, ys, free, by)) { a.bh.push(b.sub); out.push(hit); continue; } }
        // AUDIT EG V (lane4 L4-1; section 21): read to the edge the trail is whole to - a pose is placed up to
        // EG_TS_LAG_MAX_MS before it arrives, and the room's stand-ins for a silent body stand that far back - so a pose
        // still on its way when the read went past its instant is never skipped
        const from = a.bt[b.sub] ?? a.at, upto = Math.max(from, Math.min(now - EG_TS_LAG_MAX_MS, a.at + sp));
        if (caughtWhile(test, b.tr, from, upto, F.h, spec, ys, { free, by })) { a.bh.push(b.sub); out.push(hit); }
        a.bt[b.sub] = upto;
        continue;
      }
      if (!egTrailReady(b.tr, a.at, now)) continue;
      a.bh.push(b.sub);
      if (deepShared(test, b.tr, a.at, F.h, spec, ys, free, by)) out.push(hit);
    }
    if (now >= a.at + sp + EG_POSE_WAIT_MS) a.bj = 1;
  }
  return out;
}
/**
 * EG-H1 - THE HALL'S OWN HAZARDS, judged at their landing on a fight floor (section 21: "a modified client that ignores
 * vents and magma is seen"): a Rampart vent's every eruption (net/eliteGates/egLaw.js egVentAt - from the hall's wake `hw`) and each
 * fragment hazard's live part aimed at a fight floor or a CHECK's (net/eliteGates/egFragLaw.js egHazardParts - its key once), found at
 * the beat they are live (`F.hzq`, the queue; `F.hzk`, the keys seen) and judged on each living member's trail as a blow
 * is, within the hazard's own height (egHazardBites' band) - `[{sub, share, i: 0, k: 1}]`, `share` a plain hazard's (the
 * basalt, the cascade, the hammers), 0 for an element's (seen). The screens judge their own feet as they did; this is the
 * relay's count and census beside them. EG-ZB: a traversal hazard's part too (a fire fall's burning, seen; the Forge Line's
 * hammers, counted), wherever a body stands in it while it burns; each hit says its landing and the hazard's name (`at`,
 * `nm`). Pure but for the fight's marks.
 * @param {any} F @param {any} spec @param {number} hw @param {Array<{sub: string, tr?: number[][]}>} bodies @param {number} now
 */
export function judgePlace(F, spec, hw, bodies, now) {
  const out = [];
  if (!F || !spec) return out;
  F.hzq ??= []; F.hzk ??= [];
  const seen = (key) => { if (F.hzk.includes(key)) return true; F.hzk.push(key); if (F.hzk.length > 256) F.hzk.shift(); return false; };
  if (hw > 0) for (const [j, v] of (spec.vents ?? []).entries()) {
    const st = egVentAt(v, hw, now);
    if (st.st === 'fire' && !seen(`v${j}:${st.at}`)) F.hzq.push({ s: ['l', v.x - v.halfW, v.z, v.x + v.halfW, v.z, v.d], at: st.at, p: EG_VENT_PCT, el: 'fire', y: null, band: 1.5 });
  }
  for (const hz of spec.hazards ?? []) {
    const L = EG_HAZARDS[hz.kind];
    if (!L || (L.aim !== 'fight' && L.aim !== 'check' && L.aim !== 'trav') || hz.kind === 'wisp' || !(L.pct > 0)) continue;
    // EG-ZB (section 21; EG-H1's departure 11 closed): a TRAVERSAL hazard (a fire fall, the Forge Line's hammers) is judged
    // wherever a body stands in it while its part burns (`tv` - its live span), at its feet, as the screens judge it
    for (const p of egHazardParts(hz, now / 1000)) if (p.st === 'live' && !seen(`h${p.key}`)) F.hzq.push({ s: p.sh, at: now, p: p.pct, el: p.el, y: hz.kind === 'eclipse' ? null : hz.y ?? 0, band: hz.kind === 'fall' ? 2.5 : 1.5, nm: L.name, ...(L.aim === 'trav' ? { tv: L.live } : {}) });
  }
  const keep = [];
  for (const q of F.hzq) {
    q.bh ??= [];
    const share = q.el == null ? Math.min(1, q.p) : 0, test = (x, z) => egInShape(q.s, x, z);
    for (const b of bodies) {
      if (q.bh.includes(b.sub)) continue;
      if (q.tv) {
        // its live span from the beat it was first seen: each pose sent inside it, once a body
        if (caughtWhile(test, b.tr, q.at - EG_POSE_NEAR_MS, Math.min(now, q.at + q.tv), F.h, spec, null, { point: true, y: q.y, band: q.band })) { q.bh.push(b.sub); out.push({ sub: b.sub, share, i: 0, k: 1, at: q.at, nm: q.nm ?? '' }); }
        continue;
      }
      if (!egTrailReady(b.tr, q.at, now)) continue;
      q.bh.push(b.sub);
      const p0 = egTrailAt(b.tr, q.at);
      if (q.y != null && (!p0 || Math.abs(p0[2] - q.y) > q.band)) continue;
      if (deepShared(test, b.tr, q.at, F.h, spec, null)) out.push({ sub: b.sub, share, i: 0, k: 1, at: q.at, nm: q.nm ?? '' });
    }
    if (now < q.at + (q.tv ?? 0) + EG_POSE_WAIT_MS) keep.push(q);
  }
  F.hzq = keep.slice(-64);
  return out;
}
