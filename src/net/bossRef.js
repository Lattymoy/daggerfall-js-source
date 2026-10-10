// @ts-check
// INT11-INT13 (2026-10-10, the INTEGRITY arc's lane 3 - bible/06-Systems/Integrity-Arc.md section 6): THE BOSS'S BLOWS
// JUDGED WHERE THE CLIENT CANNOT SKIP THEM - each fight's own test of where a blow lands (net/gateStrike.js,
// net/sdStrike.js's geometry in net/sdRemnant.js, systems/serpentStrike.js), run on the relay against the poses it
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
import { ATTACK_BY_ID, ATTACKS, profileOf, hostBlowUnder } from './gateBrain.js';
import { inAttack, chargeStrikes, blowOf } from './gateStrike.js';
import { SD_BLOW_BY_ID, SD_BLOWS, SD_RESET_PCT, SD_END_PCT, SD_ARENA_SLACK, blowShape, pulsePctOf, handSwept, behindPillar, inArena } from './sdRemnant.js';
import { SERPENT_ATTACK_BY_ID, SERPENT_ATTACK_TABLE, GRIP, CRUSH, MAEL_GRIND, MAEL_EYE_R, coilHolds, serpentShipsFighting, serpentOnShip } from './serpentBrain.js';
import { shapeMeets, fleetShare } from '../systems/serpentStrike.js';
import { deepIn, BODY_AFTER_MS } from './bossBody.js';

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

/**
 * INT11 - THE GATE: his blow in flight (`f.atk`) and each of his host's (`f.lg.ads[].atk`, the Legion-Lord's), judged
 * at its landing (net/gateStrike.js inAttack - a charge down its lane between beats, chargeStrikes), each a plain blow's
 * or Dagon's share (blowOf - `saved`, an element's, is the client's).
 * @param {any} f @param {Array<{sub: string, x: number, z: number, dead: boolean}>} bodies the court's frame @param {number} now
 * @returns {Array<{sub: string, share: number}>}
 */
export function judgeGate(f, bodies, now) {
  if (f.fell || f.wrath) return [];
  const out = [], live = living(f, bodies), P = profileOf(f), prev = Math.max(f.bjAt ?? -Infinity, now - 1000);
  f.bjAt = now;
  const a = f.atk;
  if (a && !a.bj && now >= a.at) {
    const A = ATTACK_BY_ID[a.a], B = blowOf(a, P), share = B && !B.saved ? Math.min(1, B.pct) : 0;
    if (!A || !(share > 0)) a.bj = true;
    else if (A === ATTACKS.charge) sweep(a, live, Math.max(prev, a.at), now, a.at + A.active, share, (x, z, t0, t1) => chargeStrikes(a, x, z, t1, t0, P), out);
    else if (A.shape === 'all' || now >= a.at + BODY_AFTER_MS) landing(a, live, share, (x, z) => inAttack(a, x, z, P), out);
  }
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
 * share of her hull at the fleet's share (systems/serpentStrike.js fleetShare).
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
