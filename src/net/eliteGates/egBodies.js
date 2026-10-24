// @ts-check
// EG-FULL (2026-10-11, the Elite Gates arc; bible/11-Multiplayer/Elite-Gates.md sections 11.7, 12, 13 and 21): A HALL'S
// FIGHT AS THE RELAY HOLDS IT - one record for every body a hall stands (its lords and champions, its legion, its
// errands' objects - runes, gems, anchors, banners, hearts, seals, braziers, pillars, the relic, the rifts), the blows in
// flight and the ones THE UNION FLOOR holds, the tethers and the marks on members, and the words every screen draws them
// by:
//   `efs` - the whole fight (its bodies `b`, blows `bl`, tethers `tx`, marks `mk`, progress `pg`), at the wake, a hello
//          and every STATE_SEND_MS;
//   `ead` a body risen, `emv` the beat's walks, `ehp` health as it falls, `edie` gone, `efl` a body's flags;
//   `eb`  a blow (net/eliteGates/egShape.js - its FULL shape stamp), `ecut` a feint cut, `etx` the tethers, `emk` the marks;
//   EG-H1: `tell` a lord's blow told early to a Watchfire holder's company (`to` each), `untell` a told blow held.
// EG-ZJ (2026-10-12, Mac: "I said I want everything"; sections 11.7, 22 and 23): THE FIGHT WHOLE ON THE WIRE - every body
// carries its FEET (`y`, the fight ground under it - net/eliteGates/egWalkGraph.js egFeetAt - or a flier's own height) and its walk the
// height it ends at (`ty`), in whole centimetres, so every screen draws it where it stands; every body carries its state as
// the room last said it (`ws`, since `wsAt` - an object's `eob`, a lord's phase once it wakes, its fall); and the whole
// fight (`efs`) carries the live zones (`zs`) and each walk carried to its own instant, so a member who joins or reloads
// mid-fight sees what the company sees at once.
// EG-ZQ (2026-10-12; sections 13.2 and 14): a lord's SIZE on the wire (`sz` - Colossal's, net/eliteGates/egLords.js stand), and the fight
// keeps the company it woke with by account (`subs`) - each lord's fighters, whose shares its health is.
// AUDIT EG V (lane1 #7; sections 8.5 and 21): a body's FACING on the wire (`yw` - its row's nineteenth, a walk's tenth, and a turn
// said as a walk of its own, egFace): the relay judges the Kynreeve's Shield-Wall and a Shielded elite's back by it, and every
// screen draws the body facing it, so a member flanks by what their screen shows.
//
// A BODY: `{ i, role (0 lord, 1 add, 2 object), k (the lord's, the kind's, the object's number), pt (a part: the twin, a
// mirror, a rune's numeral), x, z, y (EG-ZJ: its feet), mv, hp, max, fl (flags), r (its radius), ws/wsAt (EG-ZJ: its state as
// said), ... }`. Its walk is said once and carried by every screen (the gate's law - net/gate/gateBrain.js hostAt). A blow is judged on the struck member's machine at its
// landing (co-op's law); a blow ON a body is the gate's hand and purse (spendBlow, spendPurse), a melee blow within
// MELEE_REACH of its body, from the fight floor (or, for an object off it - a pillar, a perch - from beside it).
//
// Pure: a record and a beat in, frames out. In the relay bundle. Not a DFU member. Ledger A (ELITE-GATES).
import { HIT_KINDS, MELEE_REACH, POSE_SLACK, MOVE_RESAY_M, MOVE_RESAY_MS, HP_SEND_MS, HOST_HP_MIN, dpsRef, spendBlow, spendPurse } from '../gate/gateBrain.js';
import { egKeepOnFight, egOnFight, egFloorTest, EG_BANDS } from './egLaw.js';
import { egBlowOf, egInBlow, egBlowOn, EG_BLOWS_MAX, EG_OUTLINE_MAX_MS } from './egShape.js';
import { egUnionHolds, egPlaceLandings, egBlowNear, EG_UNION_HOLD_TICKS } from './egFloor.js';
import { egZoneLandings, egFloorLess, egBurnsIn, egHavenCheck } from './egFloor.js';   // AUDIT EG V (lane1 #10): the fight's own zones in the set   // EG-H1: THE UNION FLOOR where the page says it lives, the place's landings in its set, Watchfire's reach
import { egFightView, egFeetAt } from './egWalkGraph.js';   // EG-ZJ: the fight ground a body's feet stand on
import { egByHeight, egFeetY, egOneStorey, egStoreyY } from './egWalkGraph.js';   // THE ASCENT - HEIGHT: a blow on its own storey
import { egGroundAt, EG_STRIKE_PAD_M } from './egWalkGraph.js';   // FIELD BUGS 2026-10-18f TURNED-BLOW: the fight ground a blow is struck from
import { egStacked } from './egWalkGraph.js';   // FB1018D BANNER-SHAFT: a shaft or a spell refused another storey's body only through a floor

/** A body's role. */
export const EG_ROLE = Object.freeze({ lord: 0, add: 1, obj: 2 });
/** A body's flags (`fl`): an elite, a friend of the company, dormant, flying, shielded (its ward up), stunned, a mirror,
 *  hidden (the Night-Stalker vanished), in fury, fallen, a Kynval squad's affixes, grounded. */
export const EG_FL = Object.freeze({ elite: 1, friend: 2, dormant: 4, fly: 8, ward: 16, stun: 32, mirror: 64, hidden: 128, fury: 256, fell: 512, searing: 1024, shielded: 2048, wrathful: 4096, unshaken: 8192, grounded: 16384, lit: 32768 });
/** The most bodies a fight stands at once on the wire (lords, legion and objects together). */
export const EG_BODIES_MAX = 64;
/** EG-ZJ (section 23): a walk is said again when the height it ends at moves past this, or its feet leave its line (m - a
 *  level's own band, net/eliteGates/egWalkGraph.js EG_LEVEL_M: a portal between two pieces of one level is no new word). */
export const EG_Y_RESAY_M = 0.6;
/** How a body left (`edie`'s `w`): slain, raised away or fed (a Sapper reaching its lord), crumbled (the hall's end). */
export const EG_GONE = Object.freeze({ slain: 0, fed: 1, crumbled: 2 });
/** How often the whole fight is said again (ms). */
export const EG_STATE_EVERY_MS = 2000;
/** The depth's weight on every body's health (section 18: 4% a circle). */
export const egDepthX = (c) => 1 + 0.04 * (c - 1);
/** The depth's weight on every blow's share (section 13.2: 2% a circle) - with fury and Vengeful, never past 1.5. */
export const EG_SHARE_X_MAX = 1.5;
export const egShareX = (c, extra = 1) => Math.min(EG_SHARE_X_MAX, (1 + 0.02 * (c - 1)) * extra);

const r2 = (v) => Math.round(v * 100) / 100;
const dist = (ax, az, bx, bz) => Math.hypot(ax - bx, az - bz);

/**
 * A HALL'S FIGHT, fresh at its wake: its hall, kind, circle and band, the living company that sizes it (`n`, their levels,
 * the company's reference damage `team` and its mean), its depth's weight, and nothing yet standing. EG-ZQ (section 13.2):
 * `subs` the company's accounts, in the order of their levels - each lord's fighters (net/eliteGates/egLords.js egLordsShare).
 * @param {any} spec @param {number} now @param {number[]} lvs @param {string[]} [subs]
 */
export function egFightNew(spec, now, lvs, subs = []) {
  const L = lvs.length ? lvs : [1], team = L.reduce((s, lv) => s + dpsRef(lv), 0);
  return egFightBind({
    h: spec.h, kind: spec.kind, variant: spec.variant, c: spec.c, band: spec.band, el: EG_BANDS[spec.band]?.el ?? 'fire', n: L.length, lvs: L, subs: lvs.length ? [...subs] : [], team, mean: team / L.length, X: egDepthX(spec.c),
    wokeAt: now, seq: 0, bl: 0, bodies: [], blows: [], held: [], tethers: [], marks: [], pg: {}, hSent: '', hAt: 0, stateAt: now, moves: [],
    /** a lord's or a hall's own memory (the brains keep their state here) */
    mem: {},
  }, egFightView(spec));
}
/** EG-ZJ: THE FIGHT GROUND a fight reads its bodies' feet on (net/eliteGates/egWalkGraph.js egFightView - the spec where its fight floor is
 *  all of it), kept on the fight unenumerated: storage keeps the fight, never its hall, so a woken room binds it again at its
 *  next beat (net/eliteGates/egBrain.js). Answers the fight. */
export function egFightBind(F, view) {
  if (F && F.view !== view) Object.defineProperty(F, 'view', { value: view, enumerable: false, writable: true, configurable: true });
  return F;
}
/** Health for `s` seconds of the company's MEAN reference damage (an add's), and for `s` of its whole (a team's - shared
 *  over `k`), at the fight's depth; never under HOST_HP_MIN. */
export const egHpMean = (F, s) => Math.max(HOST_HP_MIN, Math.round(s * F.mean * F.X));
export const egHpTeam = (F, s, k = 1) => Math.max(HOST_HP_MIN, Math.round((s * F.team * F.X) / Math.max(1, k)));

/** Where a body stands at `now`: its walk carried from its word, else where it stands. */
export function egBodyAt(b, now) {
  const m = b?.mv;
  if (!m || !(m.v > 0)) return [b.x, b.z];
  const len = Math.hypot(m.tx - m.x, m.tz - m.z);
  if (len < 1e-6) return [m.tx, m.tz];
  const along = Math.min(len, (Math.max(0, now - m.at) / 1000) * m.v);
  return [m.x + ((m.tx - m.x) / len) * along, m.z + ((m.tz - m.z) / len) * along];
}
/** EG-ZJ: a walk's height at `now` - from its start's (`y`) to its end's (`ty`) as its place goes (a stair climbed, a flier
 *  rising to its mark), its end's once it is there. */
export function egWalkY(m, now) {
  const len = Math.hypot(m.tx - m.x, m.tz - m.z), y0 = m.y ?? 0, y1 = m.ty ?? y0;
  if (!(m.v > 0) || len < 1e-6) return y1;
  return y0 + (y1 - y0) * Math.min(1, ((Math.max(0, now - m.at) / 1000) * m.v) / len);
}
/** Every body carried to `now` (its place set from its walk; EG-ZJ: and its height). */
export function egCarry(F, now) { for (const b of F.bodies) if (b.mv) { const [x, z] = egBodyAt(b, now); b.x = x; b.z = z; b.y = egWalkY(b.mv, now); } }
/** AUDIT EG V (lane1 #7): a body's facing as the relay judges it (net/eliteGates/egLegion.js egFromFront and egFromBehind read `yaw ?? 0`),
 *  in hundredths of a radian as the wire says it. */
export const egYawOf = (b) => r2(Number.isFinite(b?.yaw) ? b.yaw : 0);
/**
 * A body's array on the wire: `[i, role, k, pt, x, z, hp, max, fl, tx, tz, v, at, y, ty, st, sa, sz, yw]`. EG-ZJ (sections 22 and
 * 23): `y` its feet and `ty` its walk's end's (whole centimetres - the wire's heights are the law's), `st` its state as the room
 * last said it and `sa` since when (`ws`, `wsAt` - egSaid: an object's `eob`, a lord's phase and its fall; 0 for none). With
 * `now` (the whole fight's word) its walk is said carried to that instant - its place and height then, its `at` now - so a
 * screen that hears it there draws it where the room holds it, never its walk's head start again. EG-ZQ (section 14): `sz`
 * its size, thousandths of its look's (a Colossal lord's 1250, at rank II 1400 - net/eliteGates/egLords.js stand; 0 its look's own). AUDIT EG V
 * (lane1 #7): `yw` its facing (egYawOf).
 * @param {any} b @param {number} [now]
 */
export function egBodyWire(b, now = 0) {
  const m = b.mv, live = !!m && now > 0;
  const [x, z] = live ? egBodyAt(b, now) : [b.x, b.z], y = live ? egWalkY(m, now) : b.y ?? 0;
  return [b.i, b.role, b.k, b.pt ?? 0, r2(x), r2(z), Math.max(0, Math.ceil(b.hp)), Math.ceil(b.max), b.fl | 0, m ? m.tx : r2(x), m ? m.tz : r2(z), m ? m.v : 0, m ? (live ? now : m.at) : 0,
    r2(y), m ? m.ty : r2(y), b.ws ?? 0, b.wsAt ?? 0, b.sz ?? 0, egYawOf(b)];
}
/** AUDIT FB1018f L3-4 - A BODY'S RADIUS ON THE WIRE (m, hundredths): its own `r`, the relay's - the reach a blow on it is
 *  judged to (egHitBody) and the floor an object is asked to stand on within (egStruckOff) - said BESIDE its row in every word
 *  that stands it (`ead`'s and `efs`'s `r`, one a row, in its order: egRisen, egFightState). Not by its kind: a Wellspring's
 *  spring is a rift twice a rift's size (net/eliteGates/egBrain.js). Not in the row: a build before this drops a word's field it
 *  does not know and keeps the word, where a twentieth in the row would have refused every body it heard (net/wire.js egBody). */
export const egRadiusWire = (b) => r2(Number.isFinite(b?.r) ? b.r : 0.6);
/** AUDIT FB1018f L3-4: the word that stands `bodies` (`ead`) - their rows, and their radii beside them (egRadiusWire). */
export const egRisen = (bodies, now) => ({ k: 'ead', a: bodies.map((b) => egBodyWire(b)), r: bodies.map(egRadiusWire), at: now });
/** EG-ZJ (section 22): A BODY'S STATE as the room says it, kept on the body (`ws`, and since when, `wsAt`) so the whole fight
 *  carries it to a member who joins (egBodyWire): an object's (`eob` - a Grath island cracked 1 and fallen 2, a soul-gem's
 *  souls, a rune lit 1 and stood on 2), a lord's phase once it wakes (`eph`; 0 asleep) - and at its fall, the fall's
 *  instant. */
export function egSaid(b, st, now) { b.ws = st; b.wsAt = now; }
/** EG-ZJ: an object's state said (`eob`) and kept (egSaid). */
export function egObSay(o, st, now, out) { egSaid(o, st, now); out.push({ k: 'eob', i: o.i, st, at: now }); }

/**
 * A body stood: its role, its number in that role's table, where, its health, its radius and flags; said (`ead`). EG-ZJ: its
 * feet `y` where the caller knows them (a member's height a flier rises at, an alcove's floor), else the fight ground under
 * it (net/eliteGates/egWalkGraph.js egFeetAt - the lowest that holds it).
 * @param {any} F @param {number} role @param {number} k @param {number} x @param {number} z @param {number} hp
 * @param {{ pt?: number, r?: number, fl?: number, up?: number, now?: number, out?: any, y?: number, [more: string]: any }} [o]
 * @returns {any}
 */
export function egBodyNew(F, role, k, x, z, hp, { pt = 0, r = 0.6, fl = 0, up = 0, now = 0, out = null, y = NaN, ...rest } = {}) {
  if (F.bodies.length >= EG_BODIES_MAX) return null;
  const h = Math.max(1, Math.round(hp));
  const b = { i: ++F.seq, role, k, pt, x: r2(x), z: r2(z), y: Number.isFinite(y) ? r2(y) : F.view ? egFeetAt(F.view, x, z) : 0, mv: null, hp: h, max: h, r, fl, up: now + up, atk: null, tg: null, tgAt: 0, next: now, at: now, ...rest };
  F.bodies.push(b);
  out?.push(egRisen([b], now));   // AUDIT FB1018f L3-4: its radius beside it
  return b;
}
/** Several stood in one word (EG-ZJ: a spot `[x, z, y]` stands its body at that height). */
export function egRaise(F, role, k, spots, hp, now, out, o = {}) {
  const made = [];
  for (const [x, z, y] of spots) { const b = egBodyNew(F, role, k, x, z, hp, { ...o, now, ...(Number.isFinite(y) ? { y } : {}) }); if (b) made.push(b); }
  if (made.length) out.push(egRisen(made, now));   // AUDIT FB1018f L3-4: their radii beside them
  return made;
}
/** A body's walk said to (gx, gz), `stop` short of it, at `speed`, kept to the fight floor `inset` in (none - free: a
 *  flyer, an object) - a new word only when its goal moved past MOVE_RESAY_M or MOVE_RESAY_MS has passed. EG-ZJ: the walk
 *  carries the body's height (`y`) and the height it ends at (`ty` - the caller's: a graph walker's next floor, a flier's
 *  mark; else the fight ground under its goal, net/eliteGates/egWalkGraph.js egFeetAt), and is said again when that end's height moves
 *  past EG_Y_RESAY_M or the body's feet left the walk's own line (a lip stepped off). `emv` says each
 *  `[i, x, z, tx, tz, v, at, y, ty, yw]` - AUDIT EG V (lane1 #7): its facing the tenth. */
export function egWalk(F, b, gx, gz, stop, speed, now, spec, inset = b.r ?? 0.6, free = false, ty = NaN) {
  const dx = gx - b.x, dz = gz - b.z, d = Math.hypot(dx, dz), go = Math.max(0, d - stop);
  let tx = b.x + (d > 0 ? (dx / d) * go : 0), tz = b.z + (d > 0 ? (dz / d) * go : 0);
  if (!free) [tx, tz] = egKeepOnFight(spec, tx, tz, inset, b.y);   // THE ASCENT: kept to the floor its feet stand on
  const y = r2(b.y ?? 0), toY = Number.isFinite(ty) ? r2(ty) : egFeetAt(spec, tx, tz, y);
  const m = b.mv;
  if (m && Math.hypot(m.tx - tx, m.tz - tz) < MOVE_RESAY_M && now - m.at < MOVE_RESAY_MS && Math.abs(m.ty - toY) <= EG_Y_RESAY_M && Math.abs(egWalkY(m, now) - y) <= EG_Y_RESAY_M) return;
  if (!m && Math.hypot(tx - b.x, tz - b.z) < 0.05 && Math.abs(toY - y) <= EG_Y_RESAY_M) return;
  b.mv = { x: r2(b.x), z: r2(b.z), tx: r2(tx), tz: r2(tz), v: speed, at: now, y, ty: toY };
  b.x = b.mv.x; b.z = b.mv.z; b.y = y;
  if (d > 0) b.yaw = Math.atan2(dx, dz);
  F.moves.push([b.i, b.mv.x, b.mv.z, b.mv.tx, b.mv.tz, speed, now, y, toY, egYawOf(b)]);
}
/** A body stood still where it is. */
export function egStop(F, b, now) {
  if (!b.mv) return;
  b.mv = null;
  b.x = r2(b.x); b.z = r2(b.z); b.y = r2(b.y ?? 0);
  F.moves.push([b.i, b.x, b.z, b.x, b.z, 0, now, b.y, b.y, egYawOf(b)]);
}
/** A body set down at (x, z) at once (a leap's landing, a blink, a rift's wander) - said as a walk of no speed. EG-ZJ: on the
 *  fight ground there (egFeetAt - by the band about where it stood: a leap onto a higher island lands on it). */
export function egPlace(F, b, x, z, now) {
  b.mv = null; b.x = r2(x); b.z = r2(z);
  b.y = F.view ? egFeetAt(F.view, x, z, b.y ?? NaN, b.y ?? 0) : r2(b.y ?? 0);
  F.moves.push([b.i, b.x, b.z, b.x, b.z, 0, now, b.y, b.y, egYawOf(b)]);
}
/** AUDIT EG V (lane1 #7; section 8.5, the Kynreeve "turns to the top of threat"): A BODY TURNED to `yaw` - said (`emv`) as its walk
 *  again with the new facing (a body standing, where it stands), once it turns past a hundredth of a radian, so every screen draws
 *  it facing what the relay judges its blows by. */
export function egFace(F, b, yaw, now) {
  const was = egYawOf(b);
  b.yaw = yaw;
  if (egYawOf(b) === was) return;
  const m = b.mv;
  F.moves.push(m ? [b.i, m.x, m.z, m.tx, m.tz, m.v, m.at, m.y, m.ty, egYawOf(b)] : [b.i, r2(b.x), r2(b.z), r2(b.x), r2(b.z), 0, now, r2(b.y ?? 0), r2(b.y ?? 0), egYawOf(b)]);
}
/** The beat's walks in one word. */
export function egMovesOut(F, out) { if (F.moves.length) { out.push({ k: 'emv', m: F.moves }); F.moves = []; } }
/** A body's flags set (said once, when they change). */
export function egFlags(F, b, fl, out) { if ((b.fl | 0) === fl) return; b.fl = fl; out.push({ k: 'efl', i: b.i, fl }); }
export const egHas = (b, f) => ((b?.fl | 0) & f) !== 0;
export const egSetFl = (F, b, f, on, out) => egFlags(F, b, on ? (b.fl | f) : (b.fl & ~f), out);

/** Bodies of a role (the living ones). */
export const egBodiesOf = (F, role, k = null) => F.bodies.filter((b) => b.role === role && b.hp > 0 && (k == null || b.k === k));
export const egBodyById = (F, i) => F.bodies.find((b) => b.i === i) ?? null;

/** Bodies gone in one word (`edie` - by the striker's name, `w` how). */
export function egGone(F, bodies, w, name, now, out) {
  const is = bodies.map((b) => b.i);
  if (!is.length) return;
  F.bodies = F.bodies.filter((b) => !is.includes(b.i));
  F.tethers = F.tethers.filter((t) => !is.includes(t[0]) && !is.includes(t[1]));
  out.push({ k: 'edie', is, w, n: name || '', at: now });
}

/** EG-H1 (EG8d; section 15's Watchfire): every lord's blow is COMMITTED this long before its wind-up begins, whether or not
 *  anyone holds Watchfire - so a blow's timing never depends on who does; its word (`eb`) goes out when the wind-up does. */
export const EG_TELL_LEAD_MS = 400;
/** Watchfire reaches blows aimed within this of its holder, and a member sees another's Watchfire lines only for blows
 *  within this of themselves (m). */
export const EG_TELL_NEAR_M = 12;
/** Far Watch (Long Sight + Watchfire): the lead grows this much for a blow aimed at the Long Sight holder (ms), never past
 *  EG_TELL_LEAD_MS. */
export const EG_FARWATCH_MS = 50;

/**
 * A BLOW BEGUN (net/eliteGates/egShape.js - its stamps, its wind-up kept at THE WIND-UP FLOOR unless a CHECK). With no `lead`, its word
 * is due now (egSay). EG-H1: a lord's blow carries `lead` (EG_TELL_LEAD_MS) - committed now, its landing that much later,
 * kept pending (`F.pend`) until its word is due, told meanwhile to a Watchfire holder's company (egBlowsStep). Answers the
 * blow (said, or pending), or null (held).
 * @param {any} F @param {any} spec @param {any} o the blow (net/eliteGates/egShape.js egBlowOf's) @param {{sub: string, x: number, z: number, y?: number}[]} here
 * @param {number} now @param {any[]} out @param {number} [lead]
 */
export function egAim(F, spec, o, here, now, out, lead = 0) {
  const blow = egBlowOf({ ...o, i: ++F.bl });
  // THE ASCENT (Elite-Gates-Ascent.md section 2): in a hall that judges by height, THE HEIGHT IT LANDS AT (`y`, said with it) -
  // its own where its caller names it (`o.y`: a hall's blow at a member, an object's burst), else its thrower's feet - so it
  // lands on the floors of that storey alone (net/bossRef.js judgeShapes, the screens' verdict and telegraphs)
  if (egByHeight(spec)) { const y = Number.isFinite(o.y) ? o.y : o.o ? egBodyById(F, o.o)?.y : NaN; if (Number.isFinite(y)) blow.y = r2(y); }
  if (lead > 0) { blow.at = Math.max(blow.at + lead, now + lead + blow.wu); (F.pend ??= []).push({ b: blow, say: now + lead, told: [] }); return blow; }
  return egSay(F, spec, blow, here, now, out, []) ? blow : null;
}
/**
 * A BLOW'S WORD DUE: checked against THE UNION FLOOR (net/eliteGates/egFloor.js - the pending landings and the place's own) for every
 * member it could reach (`here`, the hall's frame) - HELD when it would leave one no floor, tried again each beat and
 * dropped after EG_UNION_HOLD_TICKS - else said (`eb`). Its landing is never sooner than its whole wind-up after its word
 * (EG-H1: a floored wind-up and a late beat lengthen the wait, never shorten what a screen shows). A blow Watchfire told
 * (`told`) and then held is untold at once (`untell`, to each it was told) - no ghost outline stays on the floor. Answers
 * whether it was said.
 * @param {any} F @param {any} spec @param {any} blow @param {{sub: string, x: number, z: number, y?: number}[]} here @param {number} now @param {any[]} out @param {string[]} told
 */
function egSay(F, spec, blow, here, now, out, told) {
  // EG-PERFECT (section 13.2, fury's chain): a chained shape (`after` - its first's number) is said only WITH its first: held while
  // its first is held or not yet said, dropped with it, and once its first is said its outline stands from now and its fill from
  // the first's landing (the gap its wind-up) - before, a first THE UNION FLOOR held left its chain said alone, a fury chain of one
  if (blow.after) {
    const first = F.blows.find((b) => b.i === blow.after);
    if (!first) {
      const waits = F.held.some((h) => h.b.i === blow.after) || (F.pend ?? []).some((p) => p.b.i === blow.after);
      for (const sub of told) out.push({ k: 'untell', to: sub, i: blow.i });
      F.held.push({ b: blow, ticks: waits ? 0 : EG_UNION_HOLD_TICKS, at: now });
      return false;
    }
    const ol = first.at - now;   // (THE AUDIT: a lead only while its first is still to land - the wire carries none at 0, egBlowOf's own rule)
    if (ol > 0) blow.ol = Math.min(EG_OUTLINE_MAX_MS, Math.round(ol)); else delete blow.ol;
    blow.at = first.at + blow.wu;
  }
  blow.at = Math.max(blow.at, now + blow.wu + (blow.ol ?? 0));   // AUDIT EG V (lane1 #18): a chained shape's outline lead kept whole too - its fill from the first's landing, however late their word
  if (egUnionHeld(F, spec, blow, here, now)) {
    for (const sub of told) out.push({ k: 'untell', to: sub, i: blow.i });
    F.held.push({ b: blow, ticks: 0, at: now });
    return false;
  }
  F.blows.push(blow);
  if (F.blows.length > EG_BLOWS_MAX) F.blows.shift();
  out.push({ k: 'eb', ...blow });
  return true;
}
/** EG-PERFECT (section 13.2): THE DUEL RING's floor - a member a lord's duel challenged (`F.mem.challenge.subs`, a ring standing
 *  at `F.pg.ring` `[x, z, r]`) is held inside it (the client's ringKeep), so THE UNION FLOOR plans their escape inside it too,
 *  never over the court beyond the fire (the audit: Garoth's Meteor on a duelist at the ring's heart left no cell and was not
 *  held). This much inside the rim - the client's keep. */
export const EG_RING_KEEP_M = 0.3;
/**
 * EG-PERFECT (sections 13.2 and 11.7) - WOULD THE UNION FLOOR HOLD `blow` at `now`, for any member it could reach (`here`)? The
 * pending landings - the fight's blows (a haven CHECK among them - net/eliteGates/egFloor.js egHavenCheck), the place's, the zones
 * coming down - out to the latest of them; the ground burning at each landing: the fight's burning zones, the pools the pending
 * blows will leave (`F.mem.pools`, net/eliteGates/egLords.js) and every blow still live past its landing (`sp`: a Burning Bridge, a
 * Charge's run), the new blow's own pool its own; a duelist's floor its ring (EG_RING_KEEP_M). Read when a blow's word is due
 * (egSay) and when a lord chooses one (net/eliteGates/egLords.js - a lord never commits to a blow that would be dropped). Pure.
 * @param {any} F @param {any} spec @param {any} blow @param {{sub: string, x: number, z: number, y?: number}[]} here @param {number} now
 */
export function egUnionHeld(F, spec, blow, here, now) {
  if (blow.ch || !here.length) return false;
  const live = F.blows.filter((b) => (!b.ch || egHavenCheck(b)) && b.at > now);
  const until = Math.max(blow.at, ...live.map((b) => b.at));
  const pending = [...live, ...egPlaceLandings(spec, F.wokeAt, now, until), ...egZoneLandings(F.zones, now, until)];
  // the ground a blow leaves burning, as zones: its pool (from its landing), and a blow live past its landing over its stamps
  const left = (b) => {
    const out = [], pl = F.mem?.pools?.[b.i], y = Number.isFinite(b.y) ? { y: b.y } : {};
    if (pl) for (const st of b.s) if (st.length >= 3 && st[0] !== 'h' && st[0] !== 'a') out.push({ kind: 'burn', s: ['d', st[1], st[2], pl[0]], from: b.at, until: b.at + pl[1], ...y });
    if (b.sp > 0 && !b.ch) for (const st of b.s) out.push({ kind: 'burn', s: st, from: b.at, until: b.at + b.sp, ...y });
    return out;
  };
  const stand = [...(F.zones ?? []), ...F.blows.filter((b) => b !== blow && b.at + (b.sp ?? 0) > now).flatMap(left)], mine = left(blow);
  const ring = F.pg?.ring, duel = ring && ring[2] > 0 ? F.mem?.challenge?.subs ?? [] : [];
  const byH = egByHeight(spec);
  for (const m of here) {
    if (!blow.s.some((s) => s[0] === 'a' || s[0] === 'h' || (s.length >= 3 && Math.hypot(m.x - s[1], m.z - s[2]) < 40))) continue;
    // THE ASCENT (section 2): a member's union floor is its own storey's - a blow of another storey leaves it its floor, and
    // only the landings, burns and voids of its own floor take cells of it
    const H = byH ? egFeetY(spec, m.y) : NaN, st = Number.isFinite(H) ? egStoreyY(F.view ?? spec, m.x, H, m.z) : NaN;
    if (Number.isFinite(st) && !egOneStorey(st, blow.y)) continue;
    // EG-PERFECT (the audit): a member THE FINAL EXAMINATION cages (its mark 5 - every screen holds its feet) has no floor but
    // where it stands until the cage opens: a blow over it there holds
    const cage = egMarkOf(F, m.sub, 5);
    if (cage && cage[2] > now && egInBlow(blow, m.x, m.z)) return true;
    const base = egFloorLess(egFloorTest(spec, H), F.zones, now, until, H);
    // (THE AUDIT: and a member outside a duel kept out of its ring - every screen's ringKeep - has none of its inside)
    const onFloor = duel.includes(m.sub) ? (x, z) => base(x, z) && Math.hypot(x - ring[0], z - ring[1]) <= ring[2] - EG_RING_KEEP_M : duel.length ? (x, z) => base(x, z) && Math.hypot(x - ring[0], z - ring[1]) >= ring[2] + EG_RING_KEEP_M : base;
    const mineHere = Number.isFinite(st) ? pending.filter((b) => egOneStorey(st, b.y)) : pending;
    if (egUnionHolds(mineHere, blow, m.x, m.z, now, onFloor, egBurnsIn(stand, now, until, H), egBurnsIn(mine, now, until, H))) return true;
  }
  return false;
}
/**
 * WATCHFIRE'S COMPANY for a committed blow at `now` (section 15): the holders (`watch` - `{sub, x, z, lead, ls}`, `lead` its
 * rank's ms, `ls` the Long Sight holders it keeps Far Watch with) within EG_TELL_NEAR_M of the blow set its lead (the
 * greatest, Far Watch's EG_FARWATCH_MS more for a blow aimed at a Long Sight holder, never past EG_TELL_LEAD_MS); once its
 * word is that near (`say` less the lead), each holder and each member within EG_TELL_NEAR_M of it is told, with the lead
 * shown (`lead`). Pure.
 * @param {any} blow @param {{sub: string, x: number, z: number, lead: number, ls?: number[][]}[]} watch @param {{sub: string, x: number, z: number, y?: number}[]} here
 * @param {number} say @param {number} now
 */
export function egTellTo(blow, watch, here, say, now) {
  let lead = 0;
  const near = [];
  for (const w of watch) {
    if (!(w.lead > 0) || egBlowNear(blow, w.x, w.z) > EG_TELL_NEAR_M) continue;
    near.push(w.sub);
    lead = Math.max(lead, Math.min(EG_TELL_LEAD_MS, w.lead + ((w.ls ?? []).some((p) => egInBlow(blow, p[0], p[1])) ? EG_FARWATCH_MS : 0)));
  }
  if (!(lead > 0) || now < say - lead) return [];
  const subs = new Set(near);
  for (const m of here) if (egBlowNear(blow, m.x, m.z) <= EG_TELL_NEAR_M) subs.add(m.sub);
  return [...subs].map((sub) => ({ sub, lead }));
}
/** The beat's blows: the long landed forgotten; EG-H1: each committed blow told to its Watchfire company as the lead comes
 *  due (`tell`, its `sh` the lead shown) and said when its word is; THE UNION FLOOR's held blows tried again (their landing
 *  later by the wait) and dropped past their ticks. `watch` the Watchfire holders (egTellTo). */
export function egBlowsStep(F, spec, now, here, out, watch = []) {
  F.blows = F.blows.filter((b) => now <= b.at + Math.max(1, b.sp ?? 0) + 1500);
  if (F.pend?.length) {
    const pend = F.pend.sort((a, b) => (a.b.after ? 1 : 0) - (b.b.after ? 1 : 0));   // EG-PERFECT: a chained shape's word after its first's (egSay)
    F.pend = [];
    for (const p of pend) {
      for (const t of egTellTo(p.b, watch, here, p.say, now)) if (!p.told.includes(t.sub)) { p.told.push(t.sub); out.push({ k: 'tell', to: t.sub, sh: t.lead, ...p.b }); }
      if (now < p.say) F.pend.push(p);
      else egSay(F, spec, p.b, here, now, out, p.told);
    }
  }
  if (!F.held.length) return;
  const held = F.held;
  F.held = [];
  for (const h of held) {
    if (++h.ticks > EG_UNION_HOLD_TICKS) continue;
    h.b.at += now - h.at;
    if (!egSay(F, spec, h.b, here, now, out, [])) { const last = F.held[F.held.length - 1]; if (last) last.ticks = h.ticks; }
  }
}
/** EG-H1: A FEINT'S CUT (section 13.2: Feud-Arc section 7.3 exactly) - its mark fills to this share of its wind-up and is cut
 *  (`ecut` - the page's `cut`; ai/tells.js TELL.FEINT_AT, which carries the AI's own imports, pinned equal by
 *  test/net/eliteGates/egint_relay.test.js). The relay's `eb` carries no feint flag, so a modified client cannot read a feint early; an
 *  honest screen sounds a blow's WIND only past this share, uncut (scenes/eliteGates/egFight.js). */
export const EG_FEINT_AT = 0.55;
/** A blow cut (a feint, at FEINT_AT - section 13.2): gone, said. EG-PERFECT: with the instant it was cut at (`at` - its
 *  FEINT_AT, which the relay's beat passes up to EG_BEAT_TRIAL_MS late), so every screen freezes its fill there, at the share
 *  Feud-Arc section 7.3 cuts it - never at the beat's own (the audit: every cut came at 0.667 of its wind-up). */
export function egCut(F, i, out, at = NaN) { F.blows = F.blows.filter((b) => b.i !== i); out.push({ k: 'ecut', i, ...(Number.isFinite(at) ? { at: Math.round(at) } : {}) }); }
/** The members a landed blow struck, by the relay's own reckoning of their poses (the census - section 21). AUDIT EG IV (lane1
 *  #5): a blow that names its members, those of them in the hall (net/eliteGates/egShape.js egBlowOn). */
export const egStruck = (blow, here) => here.filter((m) => egBlowOn(blow, m.sub, m.x, m.z));

/** The health of every body that moved since last said, at most every HP_SEND_MS (`ehp`). */
export function egHpOut(F, now, out, force = false) {
  if (!force && now - F.hAt < HP_SEND_MS) return;
  const key = F.bodies.map((b) => `${b.i}:${Math.ceil(b.hp)}`).join(',');
  if (key === F.hSent) return;
  F.hSent = key; F.hAt = now;
  if (F.bodies.length) out.push({ k: 'ehp', h: F.bodies.map((b) => [b.i, Math.max(0, Math.ceil(b.hp))]) });
}
/** The tethers said (`etx`: `[a, b, kind, r]` - a body to a member's sub or to another body; kind 0 drain, 1 blood,
 *  2 chain, 3 ward, 4 challenge). */
export function egTethersOut(F, out) { out.push({ k: 'etx', t: F.tethers.map((t) => [...t]) }); }
/** The marks on members said (`emk`: `[sub, mark, until, n]` - 0 the Scent, 1 a soul-mark, 2 fire-touched, 3 frost-touched,
 *  4 chained, 5 caged, 6 challenged, 7 hunted, 8 bound). */
export function egMarksOut(F, out) { out.push({ k: 'emk', m: F.marks.map((m) => [...m]) }); }
export const egMarkOf = (F, sub, mark) => F.marks.find((m) => m[0] === sub && m[1] === mark) ?? null;
export function egMark(F, sub, mark, until, n = 0) { F.marks = F.marks.filter((m) => !(m[0] === sub && m[1] === mark)); F.marks.push([sub, mark, until, n]); }
export function egUnmark(F, sub, mark) { F.marks = F.marks.filter((m) => !(m[0] === sub && (mark == null || m[1] === mark))); }

/** THE WHOLE FIGHT (`efs`). EG-ZJ (sections 22 and 23): every body at `now` (egBodyWire - its walk carried there, its feet, its
 *  state as said) and the zones still to burn (`zs` - burning ground, a fallen island's void, a Soul-Pool, a haven: what a
 *  screen draws and judges on its own feet), so a member who joins or reloads mid-fight holds the company's fight at once.
 *  AUDIT FB1018f L3-4: and every body's radius beside its row (`r` - egRadiusWire). */
export function egFightState(F, now) {
  const live = F.bodies.slice(0, EG_BODIES_MAX);
  return { k: 'efs', h: F.h, wk: F.wokeAt, b: live.map((b) => egBodyWire(b, now)), r: live.map(egRadiusWire), bl: F.blows.filter((b) => b.at + Math.max(1, b.sp ?? 0) + 400 >= now), tx: F.tethers.map((t) => [...t]), mk: F.marks.map((m) => [...m]), pg: { ...F.pg },
    zs: (F.zones ?? []).filter((z) => z.until > now).map((z) => ({ ...z, s: [...z.s] })) };
}

/**
 * FIELD BUGS 2026-10-18f TURNED-BLOW (Low_Poly_Gaming, "Weir Key Generated Elite Breach bugs": "Imps that follow you around
 * won't die after hitting several times. Its an exploit for heals if you have a vampiric weapon"): A BLOW STRUCK FROM OFF THE
 * FIGHT GROUND strikes nothing (EG-ZB, section 11.7 - a span's platform, a step, a ledge: traversal ground), but on an object
 * standing off it, which is struck from beside it. `view` the hall's fight ground (net/eliteGates/egWalkGraph.js egFightView),
 * (x, y, z) the striker's feet in the hall's frame. The relay refuses by it (net/eliteGates/egBrain.js egBlow) and every screen
 * asks it (egStrikeTurned): one law, so a screen never offers a body the relay will take nothing from. Pure.
 * @param {any} view @param {any} b @param {number} x @param {number} y @param {number} z
 */
export function egStruckOff(view, b, x, y, z) {
  return !egGroundAt(view, x, y, z, EG_STRIKE_PAD_M) && !(b?.role === EG_ROLE.obj && !egGroundAt(view, b.x, egFeetY(view, b.y), b.z, b.r ?? 1));
}
/**
 * AUDIT FB1018f L3-6 - A BODY ON ANOTHER STOREY (THE ASCENT, Elite-Gates-Ascent.md section 2): in a hall that judges by height
 * a blow struck from feet (x, y, z) reaches no body standing at (bx, by, bz) a storey over or under them - the storey each
 * stands in (egStoreyY: the fight ground its feet stand on, else the feet) EG_STACK_M or more apart (egOneStorey). Either
 * height unknown, or a law before THE ASCENT's: never apart. The relay refuses by it (egHitBody) and every screen turns by
 * it (egStrikeTurned): a Harrier on an island 14 m over mine was offered, sent and leeched, and the relay landed nothing. FB1018D
 * BANNER-SHAFT: a swing (`melee`) is refused by the storey alone; a shaft or a spell only where the two stand stacked, a floor
 * between them (egStacked). Pure.
 * @param {any} view @param {number} x @param {number} y @param {number} z @param {number} bx @param {number} by @param {number} bz
 * @param {boolean} [melee]
 */
export function egStoreyApart(view, x, y, z, bx, by, bz, melee = true) {
  const H = egFeetY(view, y);
  if (!Number.isFinite(H) || !Number.isFinite(by)) return false;
  const sm = egStoreyY(view, x, H, z), sb = egStoreyY(view, bx, by, bz);
  return !egOneStorey(sm, sb) && (melee || egStacked(view, x, sm, z, bx, sb, bz));   // FB1018D BANNER-SHAFT: a shaft or a spell through a floor alone
}
/** AUDIT FB1018f (found merging FB1018D): A BLOW FROM OFF THE FIGHT FLOOR reaches only so far - the feet (x, y, z) on no piece of
 *  hall `spec`'s own fight floor (a span's island or plate is the fight view's, never the floor's: egOnFight reads `spec.fl`) and
 *  body `b`'s edge, at (bx, bz), past MELEE_REACH + POSE_SLACK + 4: the relay lands nothing (egHitBody), and every screen turns it
 *  (egStrikeTurned) - a shaft from one island at a Harrier on another, 26 m off, was offered and leeched where the relay took
 *  none. Pure. */
export const egOutOfReach = (spec, x, y, z, b, bx, bz) => !egOnFight(spec, x, z, POSE_SLACK + 6, y) && dist(x, z, bx, bz) - (b?.r ?? 0.6) > MELEE_REACH + POSE_SLACK + 4;
/** TURNED-BLOW: the flags a body takes no blow through, whatever the blow claims - a friend's and a vanished lord's
 *  (egHitBody refuses both) and a ward's (egHitBody lands nothing through it, a lord's with it). */
export const EG_TURNS_FL = EG_FL.friend | EG_FL.hidden | EG_FL.ward;
/** TURNED-BLOW: a lord asleep (section 8.6: "a lord asleep takes no blow" - net/eliteGates/egLords.js egLordHitX's `up2`), as a
 *  screen holds it: no phase said yet (net/eliteGates/egLink.js egBodyOf's `ph`, 0 until its wake's word), never a mirror (stood
 *  awake). Pure. */
export const egLordAsleep = (b) => b?.role === EG_ROLE.lord && !egHas(b, EG_FL.mirror) && !(b.ph > 0);
/**
 * TURNED-BLOW - A BLOW THE LAW TURNS WHOLE, as a screen holds body `b` (net/eliteGates/egLink.js egBodyOf) struck from feet
 * (x, y, z) in the hall's frame - whatever its kind, its claim or its striker's purse: from off the fight ground (egStruckOff,
 * the relay's own rule), on a body its flags turn (EG_TURNS_FL), or on a lord asleep. The screen marks the body's stand-in
 * warded by it (scenes/eliteGates/egFight.js), so nothing a landed blow answers - a leech, a Vampiric Effect, a set's or a
 * martial power - answers a blow the relay will refuse, and the blow is never sent. AUDIT FB1018f L3-6: and on a body a storey
 * over or under the feet (egStoreyApart, the relay's own rule in egHitBody), where it stands at `now` (its walk carried as the
 * relay carries it - egBodyAt, egWalkY; the word's own place with none). Pure.
 * @param {any} view @param {any} b @param {number} x @param {number} y @param {number} z @param {number} [now] @param {any} [spec] the
 *  hall itself, whose own fight floor the reach off it is judged from (egOutOfReach); none, unjudged
 */
export function egStrikeTurned(view, b, x, y, z, now = 0, spec = null) {
  if (!b || ((b.fl | 0) & EG_TURNS_FL) !== 0 || egLordAsleep(b) || egStruckOff(view, b, x, y, z)) return true;
  const [bx, bz] = egBodyAt(b, now);
  if (spec && egOutOfReach(spec, x, y, z, b, bx, bz)) return true;   // AUDIT FB1018f: off the hall's own floor, past reach (the relay's egHitBody)
  // by the shaft's and the spell's storey rule: a swing's reach is under EG_STACK_M, so no swing meets a body a storey away
  return egStoreyApart(view, x, y, z, bx, b.mv ? egWalkY(b.mv, now) : b.y, bz, false);
}

/**
 * A BLOW ON A BODY from member purse `p` (the gate's: level, blow rate, bucket), standing at `pose` (the hall's frame),
 * of kind `r`, claiming `d` on body `i`, times `mult` (a stun's, a flank's - before the caps: the bucket still decides
 * what lands): the gate's hand and purse, a melee blow within MELEE_REACH of its body, from the fight floor - or, for a
 * body standing off it (a pillar's perch, a caster's pillar), from within reach of it. Answers what landed and the body.
 */
export function egHitBody(F, spec, p, i, d, r, pose, now, seq = null, mult = 1, bucketX = 1) {
  const b = Number.isSafeInteger(i) ? egBodyById(F, i) : null;
  if (!p || !b || !(b.hp > 0) || !Number.isFinite(d) || !(d > 0) || egHas(b, EG_FL.friend) || egHas(b, EG_FL.hidden)) return { got: 0, b: null };
  if (!spendBlow(p, now, seq, `e${i}`)) return { got: 0, b: null };
  if (!pose || !Number.isFinite(pose.x) || !Number.isFinite(pose.z)) return { got: 0, b: null };
  const [bx, bz] = egBodyAt(b, now), gap = dist(pose.x, pose.z, bx, bz) - (b.r ?? 0.6);
  if (egOutOfReach(spec, pose.x, pose.y, pose.z, b, bx, bz)) return { got: 0, b: null };   // THE ASCENT: by the member's feet; AUDIT FB1018f: the one law every screen asks too
  // THE ASCENT (Elite-Gates-Ascent.md section 2): in a hall that judges by height, a blow reaches no body a storey over or under
  // the member (a lord on the floor stacked over the member's, over its plan, is out of its reach). FB1018D BANNER-SHAFT: a
  // swing reaches its own storey alone; a shaft or a spell crosses the open air to a body of another storey, and is refused
  // only where the two stand stacked (egStacked) - so Ilthys's banners on the Rotunda's balconies, 4 m over the court, are
  // shot from the court as they were before the law judged by height. AUDIT FB1018f L3-6: the one storey law every screen
  // asks too (egStoreyApart)
  if (egStoreyApart(F.view ?? spec, pose.x, pose.y, pose.z, bx, b.y, bz, r === HIT_KINDS.Melee)) return { got: 0, b: null };
  if (r === HIT_KINDS.Melee && gap > MELEE_REACH + POSE_SLACK) return { got: 0, b: null };
  if (egHas(b, EG_FL.ward) || !(mult > 0)) return { got: 0, b };
  const got = spendPurse(p, d * mult, b.hp, now, bucketX);
  b.hp -= got;
  return { got, b };
}
