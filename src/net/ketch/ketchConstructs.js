// @ts-check
// KETCH (bible/11-Multiplayer/Sky-Ketch.md section 5): THE KETCH'S CONSTRUCTS - the Rourken's brass crew, as the relay runs
// them (the gate's Legion-Lord's host and the Spire's legion's law: net/gate/gateBrain.js, net/eliteGates/egLegion.js):
// pure - the moment and a [0,1) source handed in - and every screen's to read (the page draws each body where its walk
// says and each blow where its stamps say).
//
//   THE DWARVEN SPHERE   quick, low: a LUNGE down a lane, a crackling SPARK about itself (shock)
//   THE DWARVEN SENTRY   a crossbow-turret on legs that keeps its range: a BOLT where its chosen stands, a VOLLEY at three (shock)
//   THE DWARVEN SPIDER   the hold's vermin, many and frail, quick to a carrier: a STING about itself (shock) - and a carrier
//                        it stings drops its cell
//   THE HAMMER WARDEN    the gun deck's two keepers: the HAMMER ahead of it, a SWEEP, a STEAM lane (fire)
//   THE WATCH-CAPTAIN    the Watch's last: a STOMP and the TONAL WAVE rolling out of it (jumped), a CLEAVE, a STEAM lane
//
// EVERY BLOW A FULL SHAPE STAMP (net/eliteGates/egShape.js egBlowOf - the Spire's own): its kind and every number, its wind-up
// held at THE WIND-UP FLOOR (no blow lands faster than a member at THE ESCAPE BUILD can leave it). A blow of an element is
// the struck member's own save; a plain one the relay's census counts too (net/ketch/ketchJudge.js); the Tonal Wave
// (`jp`) strikes only a body on the ground, which its own machine knows and the relay never counts.
// HEALTH: a construct's whole is `hpS` seconds of its crew's mean reference damage (net/gate/gateBrain.js dpsRef) - the
// Wardens and the Captain times the crew aboard, a share each (`crewX`); the frail ones by how many come.
//
// Not a DFU member. Ledger A (KETCH).
import { dpsRef, MELEE_REACH, POSE_SLACK, HIT_KINDS, THREAT_PICK, TARGET_HOLD_MS, BREATH_MS, MOVE_RESAY_M, MOVE_RESAY_MS, REPEAT_MAX, chooseAttack, wrapYaw, spendBlow, spendPurse } from '../gate/gateBrain.js';
import { egBlowOf, egFloorWindup, shDisc, shLaneAt, shCone, shRing } from '../eliteGates/egShape.js';
import { KT_ANCHOR, KT_WAIST, KT_LANDING, KT_GALLERY, KT_HOLD, KT_BRIDGE, KT_WAIST_COVER, KT_ENGINE, KT_CONSOLE, KT_LIFT, KT_MAIN_MAST, KT_BRIDGE_CRADLES, KT_HELM, KT_HELM_PEDESTAL_R, KT_GUN_ZS, KT_GUN_DEPTH, KT_SOCKET_R, KT_CRADLES, KT_ARCS, ketchBowHalf } from './ketchDeck.js';

/** THE KINDS, by the wire's number (`k`) - each its key (the page names a kind by it, systems/ketch/ketchWords.js
 *  ketchKindName: the relay keeps no name of its own). Each blow: its shape (`sh`), its numbers, its wind-up and
 *  recovery (ms), its share and base (`p`, `b`), its element (`el`), how near its chosen must stand (`range`, past the
 *  body), its weight. */
// KETCH-LONGER (2026-10-25, the owner, from players: "the raid is too short and too easy"): every construct's health
// about two and a half times (hpS) and its blows a third again as hard (p) - a solo run of some fifteen minutes, a crew's
// some twenty, where the live run went in six (Sky-Ketch.md section 19)
export const KT_KINDS = Object.freeze({
  sphere: Object.freeze({ k: 0, key: 'sphere', r: 0.7, h: 1.6, speed: 4.6, hpS: 16, keep: 0, blows: Object.freeze([
    Object.freeze({ key: 'lunge', name: 'Lunge', sh: 'lane', len: 6, w: 2.4, wu: 900, rec: 700, p: 0.11, b: 6, el: null, range: 5.5, w8: 2 }),
    Object.freeze({ key: 'spark', name: 'Spark', sh: 'self', r: 2.6, wu: 1100, rec: 800, p: 0.09, b: 5, el: 'shock', range: 1.6, w8: 1 }),
  ]) }),
  sentry: Object.freeze({ k: 1, key: 'sentry', r: 0.8, h: 2.2, speed: 2.0, hpS: 24, keep: 12, blows: Object.freeze([
    Object.freeze({ key: 'bolt', name: 'Bolt', sh: 'at', r: 2.2, wu: 1500, rec: 900, p: 0.12, b: 6, el: 'shock', range: 24, w8: 2 }),
    Object.freeze({ key: 'volley', name: 'Volley', sh: 'ats', r: 1.8, max: 3, wu: 1800, rec: 1100, p: 0.09, b: 5, el: 'shock', range: 24, w8: 1 }),
  ]) }),
  spider: Object.freeze({ k: 2, key: 'spider', r: 0.45, h: 0.7, speed: 5.4, hpS: 5, keep: 0, blows: Object.freeze([
    Object.freeze({ key: 'sting', name: 'Sting', sh: 'self', r: 1.8, wu: 700, rec: 600, p: 0.07, b: 4, el: 'shock', range: 1.2, w8: 1 }),
  ]) }),
  warden: Object.freeze({ k: 3, key: 'warden', r: 1.3, h: 3.4, speed: 2.6, hpS: 72, crewX: 0.7, keep: 0, blows: Object.freeze([
    Object.freeze({ key: 'hammer', name: 'Hammer', sh: 'ahead', r: 3.4, ahead: 2, wu: 1400, rec: 900, p: 0.24, b: 10, el: null, range: 3.8, w8: 2 }),
    Object.freeze({ key: 'sweep', name: 'Sweep', sh: 'cone', r: 6, arc: 160, wu: 1300, rec: 900, p: 0.19, b: 8, el: null, range: 5, w8: 2 }),
    Object.freeze({ key: 'steam', name: 'Steam', sh: 'lane', len: 12, w: 4, wu: 1600, rec: 1000, p: 0.16, b: 6, el: 'fire', range: 11, w8: 1 }),
  ]) }),
  captain: Object.freeze({ k: 4, key: 'captain', r: 1.7, h: 4.6, speed: 2.4, hpS: 100, crewX: 0.8, keep: 0, blows: Object.freeze([
    Object.freeze({ key: 'stomp', name: 'Stomp', sh: 'self', r: 5, wu: 1700, rec: 1100, p: 0.27, b: 12, el: null, range: 4, w8: 2, wave: Object.freeze({ r1: 14, after: 800, p: 0.16, b: 6, name: 'Tonal Wave' }) }),
    Object.freeze({ key: 'cleave', name: 'Cleave', sh: 'cone', r: 8, arc: 140, wu: 1400, rec: 900, p: 0.22, b: 10, el: null, range: 6.5, w8: 2 }),
    Object.freeze({ key: 'steam', name: 'Steam', sh: 'lane', len: 14, w: 4.5, wu: 1700, rec: 1000, p: 0.16, b: 6, el: 'fire', range: 13, w8: 1 }),
  ]) }),
});
/** The kinds by their wire number. */
export const KT_KIND_BY_K = Object.freeze(Object.values(KT_KINDS).sort((a, b) => a.k - b.k));

/** The floors a construct walks: each a box (the deck's frame) and its height - a wider box past `wide.z0` where it has one.
 *  THE WAIST'S runs over the Anchor Deck too (its narrower beam, z 0 to 14): the Watch goes at a crew wherever it stands on
 *  the open deck, and a member on the Anchor Deck - the Watch's to strike (net/ketch/ketchBrain.js FLOOR_ZONES) - is never
 *  out of its reach (the live run found the spheres stopped at the waist's edge, short of a crew at the lift). */
export const KT_FLOORS = Object.freeze({
  waist: Object.freeze({ x0: KT_ANCHOR.x0, x1: KT_ANCHOR.x1, z0: KT_ANCHOR.z0, z1: KT_WAIST.z1, y: KT_WAIST.y, wide: KT_WAIST, bow: true }),   // AUDIT KETCH II L4-4: the bow's narrowing (keepOnFloor)
  landing: Object.freeze({ x0: KT_GALLERY.x0, x1: KT_GALLERY.x1, z0: 96, z1: KT_LANDING.z1, y: KT_LANDING.y, wide: KT_LANDING }),
  hold: Object.freeze({ ...KT_HOLD, y: KT_HOLD.y }),
  bridge: Object.freeze({ x0: KT_BRIDGE.x - KT_BRIDGE.core, x1: KT_BRIDGE.x + KT_BRIDGE.core, z0: KT_BRIDGE.z - KT_BRIDGE.core, z1: KT_BRIDGE.z + KT_BRIDGE.core, y: KT_BRIDGE.y, disc: KT_BRIDGE.core }),
});
/** What stands on each floor that a body walks round: discs `[x, z, r]` (a box by its circumscribed disc). */
export const KT_OBSTACLES = Object.freeze({
  waist: Object.freeze([...KT_WAIST_COVER.capstans.map((c) => Object.freeze([c.x, c.z, c.r])), ...KT_WAIST_COVER.covers.map((c) => Object.freeze([c.x, c.z, Math.hypot(c.w, c.d) / 2])),
    Object.freeze([KT_LIFT.x, KT_LIFT.z, KT_LIFT.half * Math.SQRT2 + 0.2]), Object.freeze([KT_MAIN_MAST.x, KT_MAIN_MAST.z, KT_MAIN_MAST.r + 0.2])]),   // the mast-lift's tower and the main mast beside it
  landing: Object.freeze(KT_GUN_ZS.flatMap((z) => [-1, 1].map((s) => Object.freeze([s * (KT_GALLERY.x1 - KT_GUN_DEPTH / 2), z, Math.hypot(KT_GUN_DEPTH, 1.1) / 2 + 0.1])))),   // the guns' carriages (AUDIT KETCH L4-11)
  // AUDIT KETCH II L4-8: the engine with its ring of sockets, the mast-lift's tower, the six cradles and the arc-coils'
  // posts - the engine's drum alone before, and a spider walked through every other
  hold: Object.freeze([Object.freeze([KT_ENGINE.x, KT_ENGINE.z, KT_SOCKET_R + 0.5]), Object.freeze([KT_LIFT.x, KT_LIFT.z, KT_LIFT.half * Math.SQRT2 + 0.2]),
    ...KT_CRADLES.map(([x, z]) => Object.freeze([x, z, 0.6 * Math.SQRT2 + 0.1])), ...KT_ARCS.z.flatMap((z) => [-1, 1].map((s) => Object.freeze([s * KT_ARCS.post, z, 0.6])))]),
  bridge: Object.freeze([Object.freeze([(KT_CONSOLE.x0 + KT_CONSOLE.x1) / 2, (KT_CONSOLE.z0 + KT_CONSOLE.z1) / 2, Math.hypot(KT_CONSOLE.x1 - KT_CONSOLE.x0, KT_CONSOLE.z1 - KT_CONSOLE.z0) / 2]),
    // AUDIT KETCH L4-10: and the helm's pedestal and the bridge's two cradles (a construct spawned inside one)
    Object.freeze([KT_HELM.x, KT_HELM.z, KT_HELM_PEDESTAL_R + 0.1]), ...KT_BRIDGE_CRADLES.map(([x, z]) => Object.freeze([x, z, 0.6 * Math.SQRT2 + 0.1]))]),
});

/** AUDIT KETCH II L1-6: how long a Sentry backs off from a member inside half its range before it shoots where it stands. */
export const KT_KEEP_BACK_MS = 2500;

const r2 = (v) => Math.round(v * 100) / 100;
const dist = (ax, az, bx, bz) => Math.hypot(ax - bx, az - bz);
/** A point kept on floor `F`, `inset` inside its edge (and its obstacles' rims). */
export function keepOnFloor(F, x, z, inset = 0) {
  let px = x, pz = z;
  if (F.disc) {
    const d = dist(px, pz, KT_BRIDGE.x, KT_BRIDGE.z), R = F.disc - inset;
    if (d > R) { px = KT_BRIDGE.x + ((px - KT_BRIDGE.x) / d) * R; pz = KT_BRIDGE.z + ((pz - KT_BRIDGE.z) / d) * R; }
  } else {
    const B = F.wide && pz >= F.wide.z0 ? F.wide : F;
    pz = Math.max(F.z0 + inset, Math.min(F.z1 - inset, pz));
    const half = F.bow && B === F ? ketchBowHalf(pz) : Infinity;   // AUDIT KETCH II L4-4: the bow narrows inside its box
    px = Math.max(Math.max(B.x0, -half) + inset, Math.min(Math.min(B.x1, half) - inset, px));
  }
  return [px, pz];
}
/** Out of every obstacle's rim on its floor (pushed out the nearest way), `pad` beyond it. */
export function clearOf(floor, x, z, pad) {
  let px = x, pz = z;
  for (const [ox, oz, or] of KT_OBSTACLES[floor] ?? []) {
    const d = dist(px, pz, ox, oz), R = or + pad;
    if (d < R) { const k = d > 1e-6 ? R / d : 0; px = d > 1e-6 ? ox + (px - ox) * k : ox + R; pz = d > 1e-6 ? oz + (pz - oz) * k : oz; }
  }
  return [px, pz];
}
/** THE WAY ROUND: a walk from (x, z) to (tx, tz) on `floor` that would cross an obstacle goes first to the side of it the
 *  goal lies on - a waypoint at its rim, past its body. Answers the point to walk to now. Pure. */
export function steer(floor, x, z, tx, tz, pad) {
  const dx = tx - x, dz = tz - z, L = Math.hypot(dx, dz);
  if (L < 1e-6) return [tx, tz];
  for (const [ox, oz, or] of KT_OBSTACLES[floor] ?? []) {
    const t = Math.max(0, Math.min(1, ((ox - x) * dx + (oz - z) * dz) / (L * L)));
    const cx = x + dx * t, cz = z + dz * t, d = dist(cx, cz, ox, oz), R = or + pad;
    if (d >= R || t <= 0 || t >= 1) continue;
    // the side of the obstacle the segment passes on (its normal from the obstacle toward the closest point)
    let nx = cx - ox, nz = cz - oz;
    const n = Math.hypot(nx, nz);
    if (n < 1e-6) { nx = -dz / L; nz = dx / L; } else { nx /= n; nz /= n; }
    return [ox + nx * (R + 0.6), oz + nz * (R + 0.6)];
  }
  return [tx, tz];
}

/**
 * A construct born: kind `kind` on floor `floor` at (x, z), facing `yw`, its whole `m` (constructHp). `wake` false: it
 * stands until woken (the Hammer Wardens at their posts). `born` the instant it rises.
 * @param {number} id @param {string} kind @param {string} floor @param {number} x @param {number} z @param {number} yw
 * @param {number} m @param {number} now @param {{ wake?: boolean, upAt?: number }} [o]
 */
export function newConstruct(id, kind, floor, x, z, yw, m, now, { wake = true, upAt = now } = {}) {
  return { id, kind, floor, x, z, y: KT_FLOORS[floor].y, yw, h: m, m, mv: null, atk: null, until: 0, lastA: -1, runA: 0, freeAt: 0, nextAt: upAt, walkUntil: 0, tg: null, tgAt: 0, wake, born: now, upAt, downAt: 0 };
}
/** A construct's whole: `hpS` seconds of the crew's mean reference damage - the Wardens and the Captain times the crew
 *  aboard, `crewX` a member. @param {string} kind @param {number} lvMean @param {number} crew */
export function constructHp(kind, lvMean, crew) {
  const K = KT_KINDS[kind];
  const per = K.hpS * dpsRef(lvMean);
  return Math.round(K.crewX ? per * K.crewX * Math.max(1, crew) : per);
}
/** A body as the wire says it: [id, kind, x, y, z, yaw, health, whole]. */
export const bodyWord = (B) => [B.id, KT_KINDS[B.kind].k, r2(B.x), r2(B.y), r2(B.z), r2(B.yw), Math.ceil(B.h), Math.ceil(B.m)];
/** Its walk as the wire says it. */
export const mvWord = (B, now) => ({ k: 'mv', o: B.id, x: r2(B.mv ? B.mv.x : B.x), z: r2(B.mv ? B.mv.z : B.z), tx: r2(B.mv ? B.mv.tx : B.x), tz: r2(B.mv ? B.mv.tz : B.z), v: B.mv ? B.mv.v : 0, at: B.mv ? B.mv.at : now });
/** Where its said walk has it at `now` (in place). */
export function stepWalk(B, now) {
  const m = B.mv;
  if (!m) return;
  const len = dist(m.x, m.z, m.tx, m.tz);
  if (len < 1e-6) { B.x = m.tx; B.z = m.tz; return; }
  const along = Math.min(len, (Math.max(0, now - m.at) / 1000) * m.v);
  B.x = m.x + ((m.tx - m.x) / len) * along;
  B.z = m.z + ((m.tz - m.z) / len) * along;
}
/** The point a body's walk reaches at `now`, without moving it - the page's and the judge's. */
export function constructAt(B, now) {
  const m = B?.mv;
  if (!m) return [B?.x ?? 0, B?.z ?? 0];
  const len = dist(m.x, m.z, m.tx, m.tz);
  if (len < 1e-6) return [m.tx, m.tz];
  const along = Math.min(len, (Math.max(0, now - m.at) / 1000) * m.v);
  return [m.x + ((m.tx - m.x) / len) * along, m.z + ((m.tz - m.z) / len) * along];
}

/**
 * A construct's blow as the wire says it (egBlowOf - the Spire's own record): blow `A` of body `B` aimed at `target` (a
 * living body `{x, z}`) or at `targets` (a volley's), its number `i`. The Captain's Stomp answers two: the stomp and its
 * Tonal Wave a beat after (jumped - `jp`). Each blow's floor height `y`.
 * @returns {any[]}
 */
export function constructBlows(B, A, i, now, target, targets = []) {
  const K = KT_KINDS[B.kind];
  const yw = target ? Math.atan2(target.x - B.x, target.z - B.z) : B.yw;
  B.yw = yw;
  /** @type {any[]} */
  let s;
  if (A.sh === 'lane') s = [shLaneAt(B.x, B.z, yw, K.r + A.len, A.w)];
  else if (A.sh === 'self') s = [shDisc(B.x, B.z, A.r)];
  else if (A.sh === 'ahead') s = [shDisc(B.x + Math.sin(yw) * (K.r + A.ahead), B.z + Math.cos(yw) * (K.r + A.ahead), A.r)];
  else if (A.sh === 'cone') s = [shCone(B.x, B.z, yw, A.r, A.arc)];
  else if (A.sh === 'at') s = [shDisc(target?.x ?? B.x, target?.z ?? B.z, A.r)];
  else s = (targets.length ? targets : target ? [target] : []).slice(0, A.max ?? 3).map((q) => shDisc(q.x, q.z, A.r));
  if (!s.length) s = [shDisc(B.x, B.z, A.r ?? 1.5)];
  const wu = egFloorWindup(A.wu, s);   // THE WIND-UP FLOOR first, so its landing is that far off
  const blow = egBlowOf({ i, o: B.id, s, at: now + wu, wu, p: A.p, b: A.b, el: A.el, nm: A.name });
  const out = [{ ...blow, y: B.y }];
  if (A.wave) {
    const W = A.wave;
    out.push(/** @type {any} */ ({ ...egBlowOf({ i: i + 1, o: B.id, s: [shRing(B.x, B.z, A.r, W.r1)], at: blow.at + W.after, wu: blow.wu + W.after, p: W.p, b: W.b, el: null, nm: W.name }), y: B.y, jp: 1 }));   // `jp`: a jump lets it pass
  }
  return out;
}

/** The blows a body allows at a chosen `gap` metres past its body - the last left out when another is open, never a
 *  REPEAT_MAX+1th time running. */
export function constructAllows(kind, gap, lastA, run) {
  const K = KT_KINDS[kind];
  const out = K.blows.filter((A) => gap <= A.range);
  const fresh = out.filter((A) => K.blows.indexOf(A) !== lastA);
  return fresh.length ? fresh : run >= REPEAT_MAX ? [] : out;
}

/**
 * Whom a body goes at among `here` ({sub, x, z, carry?} - the living crew on its floor): a spider at a carrier THREAT_PICK
 * of the time when one stands on its floor; otherwise the most threat that often, else anyone.
 */
export function chooseFor(B, here, threat, rng) {
  if (!here.length) return null;
  if (B.kind === 'spider') {
    const carriers = here.filter((q) => q.carry);
    if (carriers.length && rng() < THREAT_PICK) return carriers[Math.floor(rng() * carriers.length) % carriers.length];
  }
  if (rng() < THREAT_PICK) {
    let best = null, t = 0;
    for (const q of here) { const v = threat[q.sub] ?? 0; if (v > t) { t = v; best = q; } }
    if (best) return best;
  }
  return here[Math.floor(rng() * here.length) % here.length];
}

/**
 * ONE CONSTRUCT'S BEAT: its blow in flight held to its recovery's end; a breath; its chosen (held TARGET_HOLD_MS); then a
 * blow its gap allows - a sentry keeping its range first (in when too far, back when too near) - else a walk in, round the
 * floor's obstacles. Answers nothing; pushes the frames (`mv`, `bl`) onto `out` and each blow begun onto `blows`.
 * @param {any} B @param {number} now @param {any[]} here @param {Record<string, number>} threat @param {() => number} rng
 * @param {{ seq: number }} S the ship's blow count (`seq`), moved @param {any[]} out @param {any[]} blows
 */
export function beatConstruct(B, now, here, threat, rng, S, out, blows) {
  if (B.h <= 0 || !B.wake) return;
  const K = KT_KINDS[B.kind], F = KT_FLOORS[B.floor];
  if (B.atk != null) {   // a blow in flight (its index - the first is 0)
    if (now < B.until) return;
    B.runA = B.atk === B.lastA ? B.runA + 1 : 1;
    B.lastA = B.atk;
    B.atk = null;
    B.freeAt = now;
    B.nextAt = now + BREATH_MS;
  }
  if (now < B.nextAt) { stepWalk(B, now); return; }
  let target = B.tg ? here.find((q) => q.sub === B.tg) ?? null : null;
  if (!target || now - B.tgAt >= TARGET_HOLD_MS) {
    target = chooseFor(B, here, threat, rng);
    B.tg = target?.sub ?? null;
    B.tgAt = now;
  }
  stepWalk(B, now);
  if (!target) { if (B.mv) { B.mv = null; out.push(mvWord(B, now)); } return; }
  const gap = dist(target.x, target.z, B.x, B.z) - K.r;
  // a sentry keeps its range: back off when its chosen stands within half of it - AUDIT KETCH II L1-6: for KT_KEEP_BACK_MS at
  // most, then it shoots where it stands (a member chasing it, or one that pinned it in a corner, was never shot at all)
  if (K.keep > 0 && gap < K.keep * 0.5) {
    B.nearAt ??= now;
    if (now - B.nearAt < KT_KEEP_BACK_MS) {
      const away = Math.atan2(B.x - target.x, B.z - target.z);
      walkTo(B, F, B.x + Math.sin(away) * 4, B.z + Math.cos(away) * 4, now, out);
      return;
    }
  } else B.nearAt = null;
  const can = constructAllows(B.kind, gap, B.lastA, B.runA);
  if (!can.length || (now < B.walkUntil && gap > K.r + MELEE_REACH)) {
    const stop = Math.max(0, dist(target.x, target.z, B.x, B.z) - (K.r + (K.keep > 0 ? K.keep : 0.9)));
    const a = Math.atan2(target.x - B.x, target.z - B.z);
    walkTo(B, F, B.x + Math.sin(a) * stop, B.z + Math.cos(a) * stop, now, out);
    return;
  }
  if (B.mv) { B.mv = null; out.push(mvWord(B, now)); }
  const A = chooseAttack(can.map((q) => ({ ...q, w: q.w8 })), rng);
  const j = K.blows.findIndex((q) => q.key === A.key);
  const vol = A.sh === 'ats' ? shuffle([...here], rng).slice(0, A.max ?? 3) : [];
  const made = constructBlows(B, K.blows[j], S.seq + 1, now, target, vol);
  S.seq += made.length;
  for (const bl of made) { blows.push(bl); out.push({ k: 'bl', b: bl }); }
  B.atk = j;
  B.nearAt = null;   // AUDIT KETCH II L1-6: a shot taken, it backs off again
  B.until = made[0].at + K.blows[j].rec + (made[1] ? K.blows[j].wave.after : 0);
  if (A.sh === 'lane' || A.sh === 'at' || A.sh === 'ats') B.walkUntil = now + 2500;
}
function shuffle(a, rng) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)) % (i + 1); const t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
/** A walk toward (tx, tz) on floor F, round its obstacles - a new segment said when the goal moved far or long enough ago. */
function walkTo(B, F, tx, tz, now, out) {
  const K = KT_KINDS[B.kind];
  let [gx, gz] = keepOnFloor(F, tx, tz, K.r + 0.3);
  [gx, gz] = steer(B.floor, B.x, B.z, gx, gz, K.r + 0.2);
  [gx, gz] = clearOf(B.floor, gx, gz, K.r + 0.2);
  [gx, gz] = keepOnFloor(F, gx, gz, K.r + 0.3);
  const m = B.mv;
  if (m && dist(m.tx, m.tz, gx, gz) < MOVE_RESAY_M && now - m.at < MOVE_RESAY_MS) return;
  if (dist(B.x, B.z, gx, gz) < 0.05) { if (m) { B.mv = null; out.push(mvWord(B, now)); } return; }
  B.mv = { x: B.x, z: B.z, tx: gx, tz: gz, v: K.speed, at: now };
  B.yw = wrapYaw(Math.atan2(gx - B.x, gz - B.z));
  out.push(mvWord(B, now));
}

/**
 * A BLOW ON A CONSTRUCT from crew member `p` (its record in the voyage - the hand and the purse: net/gate/gateBrain.js
 * spendBlow, spendPurse) standing at `pose` ({x, y, z}, the deck's frame), of kind `r`, claiming `d`. Refused: a body down
 * or not yet up, past the blow rate, a pose off the body's floor (its height a storey off), a melee blow out of reach.
 * Answers what landed (the caller says its fall).
 */
export function hitConstruct(B, p, d, r, pose, now, seq = null) {
  if (!B || !p || !(B.h > 0) || now < (B.upAt ?? 0) || !Number.isFinite(d) || !(d > 0)) return 0;
  if (!spendBlow(p, now, seq, `c${B.id}`)) return 0;
  if (!pose || !Number.isFinite(pose.x) || !Number.isFinite(pose.z) || !Number.isFinite(pose.y) || Math.abs(pose.y - B.y) > 4) return 0;
  const [bx, bz] = constructAt(B, now);
  if (r === HIT_KINDS.Melee && dist(pose.x, pose.z, bx, bz) - KT_KINDS[B.kind].r > MELEE_REACH + POSE_SLACK) return 0;
  const got = spendPurse(p, d, B.h, now);
  B.h -= got;
  if (!B.wake && got > 0) B.wake = true;   // a Warden struck wakes
  return got;
}
