// @ts-check
// EG-FULL (2026-10-11, the Elite Gates arc; bible/11-Multiplayer/Elite-Gates.md sections 8.7, 12 and 14): THE LEGION -
// the relentless adds, one wave runner for every hall (net/eliteGates/egBodies.js holds their bodies and words): the nine kinds and
// the hall's own (a Kynval squad's elites, a Battlemage's ghost, the deserter, the Muster's standard-bearer, a slain
// add's vengeful shade, a Blood Thrall), each read by its silhouette (ROLE READS - the client's looks below), each blow a
// FULL shape stamp at or above THE WIND-UP FLOOR and at least THE WIDTH RULE's 4 m across.
//
//   0 HARRIER     runs at the member farthest from its anchor (in a Court, from the lord), hovering; Bite (disc r 2)
//   1 SAPPER      walks to its objective - a lord (heals it), a closed rift (reopens it at a third), a broken anchor
//   2 WARD-BEARER stands and holds a ward on what it guards; Pulse (disc r 3.5) at whoever comes near
//   3 BREAKER     winds a charge at a member, runs it, pushes 6 m (lane 4 x 14)
//   4 CASTER      stands off 10-18 m and throws a Bolt at a member's feet, leaving a pool (disc r 3)
//   5 DIVER       flies, circles, dives a lane at a member on ground at least 6 m wide (lane 4 x 10)
//   6 LURKER      dormant until a member passes within 6 m, then slow and heavy; Smash (disc r 3)
//   7 BINDER      stands back and raises the last fallen add of its wave once - a 6 s cast a tenth of its health breaks
//   8 WRAITH      drifts in and tethers the nearest member on a fight floor: 3% of max health a second within 8 m,
//                 broken at 10 m
//   9 DAEDRA LORD the Wellhead's elite add, one wave in six: five times the health, the Warden's Cleave
//
// Health is seconds of the company's reference damage (the gate's HARRIER_S law), times the depth; a wave's size counts
// the living company; the cadence and the cap are the hall's (net/eliteGates/egBrain.js). THE DECREES the legion bears are read
// here: Chained Blows, Twin Charge, Pyre-Bound, Vengeful Shades, Swarm-Mother, Kyn's Rally, Soul-Pools.
//
// EG-ZB (2026-10-12, Mac: "I said I want everything"; sections 8.2 and 11.7): THE LEGION HUNTS. The ground kinds WALK THE
// HALL'S GRAPH (net/eliteGates/egWalkGraph.js - an arch's walls, a chasm, a second floor's stair turn them) and the fliers go about the
// rock; on a SPAN the Harriers shadow the company along the course (over platforms they body-block and never bite: they
// bite only a member on an island or a plate) and the Divers wait over the island ahead and dive a member who lands on it;
// a member off the fight floors past the director's six seconds is HUNTED - the Harriers go to them first, along the graph
// to the floor's edge nearest them and on through the air, and their Bite carries `hn` (the census judges it off the floors
// for that member alone - net/bossRef.js judgeShapes).
// THE ASCENT (LAW 9, 2026-10-16; Elite-Gates-Ascent.md section 1): the Divers' island ahead is ahead along THE ROUTE
// (net/eliteGates/egRoute.js egRouteAlong - a hall that turns and doubles back), never along z; laws 4-8 read the numbers they did.
//
// Pure: a fight and a beat in, frames out. In the relay bundle (the looks are data the client reads). Not a DFU member.
// Ledger A (ELITE-GATES).
import { EG_ROLE, EG_FL, EG_GONE, egBodyNew, egWalk, egStop, egPlace, egAim, egGone, egHas, egSetFl, egHpMean, egHpTeam, egBodiesOf, egShareX } from './egBodies.js';
import { egCut } from './egBodies.js';   // AUDIT EG IV: a spotted add's wind-up cut
import { egFace } from './egBodies.js';   // AUDIT EG V (lane1 #7): an add's turn said
import { egRisen } from './egBodies.js';   // AUDIT FB1018f L3-4: a body risen said with its radius
import { shDisc, shLaneAt, shCone, egChainGapMs } from './egShape.js';
import { egKeepOnFight, egOnFight } from './egLaw.js';
import { egWalkNext, egAirNext, egAirKeep, egArchCut, egGroundAt, egWalkFeet, egFeetAt, egWayOn, EG_PIECE_TOUCH_M } from './egWalkGraph.js';   // EG-ZB: the walk graph and the air; EG-ZJ: the feet on it; EG-ZQ: the way on kept only while walked
import { egByHeight, egFeetY, egOneStorey, egStoreyY } from './egWalkGraph.js';   // THE ASCENT - HEIGHT: the legion keeps to its own storey
import { harrierCountFor } from '../gate/gateBrain.js';
import { ATTACKS, POOLS, HARRIER_S, HOST_RETARGET_MS, HARRIER_BITE_REACH } from '../gate/gateBrain.js';   // AUDIT EG IV (lane1 #16; ONE DFU MEMBER, ONE EXPORT): the gate's rows read, never copied - the Daedra Lord's Cleave, the Caster's burning ground, the Harrier's health, mark and bite
import { wrapAngle } from '../../world/mat4.js';   // the one wrap (ONCRASH1 C2) - already in the relay's graph
import { egRouteAlong } from './egRoute.js';   // THE ASCENT (LAW 9): the island ahead along the hall's route

/** The kinds by name. */
export const EG_KIND = Object.freeze({ harrier: 0, sapper: 1, bearer: 2, breaker: 3, caster: 4, diver: 5, lurker: 6, binder: 7, wraith: 8, dlord: 9, kynval: 10, ghost: 11, deserter: 12, standard: 13, shade: 14, thrall: 15 });
/**
 * THE KINDS (section 12): body (`r`, `h`), speed (m/s), health (`hpS` seconds of the company's mean reference damage;
 * `team` - of its whole, shared), its blow (a stamp's kind `t`, its numbers, its wind-up `wu` ms, the struck body's share
 * `p` and points `b`, `el` 'band' for the band's element), its bodies by band (`mob` - Daggerfall's MOBILE_TYPES), its
 * scale and hover (the client's look), its name and plural (the words).
 */
/** @typedef {{ id: number, key: string, name: string, plural: string, r: number, h: number, speed: number, hpS: number, team?: number, mob: number[], scale: number, hover: number, blow: any, fly?: number, friend?: number, wake?: number, raiseMs?: number, drain?: { pct: number, r: number, brk: number } }} EgKindRow */
/** @type {ReadonlyArray<EgKindRow>} */
export const EG_LEGION_KINDS = Object.freeze([
  Object.freeze({ id: 0, key: 'harrier', name: 'Harrier', plural: 'Harriers', r: 0.5, h: 1.5, speed: 5, hpS: HARRIER_S, mob: [1, 1, 3, 1], scale: 1, hover: 0.9, blow: Object.freeze({ nm: 'Bite', t: 'd', r: 2, wu: 900, rec: 900, p: 0.12, b: 4 }) }),
  Object.freeze({ id: 1, key: 'sapper', name: 'Sapper', plural: 'Sappers', r: 0.7, h: 2.3, speed: 1.6, hpS: 6, team: 1, mob: [35, 37, 38, 35], scale: 1.1, hover: 0, blow: null }),   // AUDIT EG III (ROLE READS): the Wellhead's a Fire Atronach - its Iron Atronach (36) is the Lurker's there
  Object.freeze({ id: 2, key: 'bearer', name: 'Ward-Bearer', plural: 'Ward-Bearers', r: 0.6, h: 2.2, speed: 0, hpS: 6, team: 1, mob: [25, 25, 25, 25], scale: 1.15, hover: 0, blow: Object.freeze({ nm: 'Ward Pulse', t: 'd', r: 3.5, wu: 1400, rec: 0, p: 0.18, b: 6, el: 'band', every: 6000 }) }),   // AUDIT EG IV (ROLE READS): a Frost Daedra in every band - the Daedra Seducer is the standard-bearer's
  Object.freeze({ id: 3, key: 'breaker', name: 'Breaker', plural: 'Breakers', r: 0.8, h: 2.4, speed: 3, hpS: 6, mob: [27, 27, 27, 27], scale: 1, hover: 0, blow: Object.freeze({ nm: 'Charge', t: 'l', w: 4, len: 14, wu: 1100, rec: 1200, p: 0.25, b: 8, pu: 6, run: 12 }) }),
  Object.freeze({ id: 4, key: 'caster', name: 'Caster', plural: 'Casters', r: 0.6, h: 2.2, speed: 2, hpS: 5, mob: [26, 32, 26, 26], scale: 1, hover: 0, blow: Object.freeze({ nm: 'Bolt', t: 'd', r: 3, wu: 1600, rec: 600, p: 0.2, b: 6, el: 'band', every: 6000, jitter: 3000, pool: 1 }) }),
  Object.freeze({ id: 5, key: 'diver', name: 'Diver', plural: 'Divers', r: 0.6, h: 1.5, speed: 6, hpS: 4, mob: [13, 13, 13, 34], scale: 1, hover: 7, fly: 1, blow: Object.freeze({ nm: 'Dive', t: 'l', w: 4, len: 10, wu: 1000, rec: 2400, p: 0.18, b: 5, every: 7000 }) }),
  Object.freeze({ id: 6, key: 'lurker', name: 'Lurker', plural: 'Lurkers', r: 0.9, h: 2.6, speed: 2.2, hpS: 8, mob: [22, 22, 22, 36], scale: 1, hover: 0, wake: 6, blow: Object.freeze({ nm: 'Smash', t: 'd', r: 3, wu: 1300, rec: 1200, p: 0.3, b: 10 }) }),
  Object.freeze({ id: 7, key: 'binder', name: 'Binder', plural: 'Binders', r: 0.6, h: 2.2, speed: 1.2, hpS: 5, mob: [33, 33, 33, 33], scale: 1, hover: 0, blow: null, raiseMs: 6000 }),
  Object.freeze({ id: 8, key: 'wraith', name: 'Wraith', plural: 'Wraiths', r: 0.5, h: 1.8, speed: 2.5, hpS: 4, mob: [23, 23, 23, 23], scale: 1, hover: 0.4, blow: null, drain: Object.freeze({ pct: 0.03, r: 8, brk: 10 }) }),   // AUDIT EG IV (ROLE READS): a Wraith in every band - the Ghost (18) is the Vengeful Shade's
  Object.freeze({ id: 9, key: 'dlord', name: 'Daedra Lord', plural: 'Daedra Lords', r: 1.2, h: 3, speed: 2, hpS: 15, mob: [31, 31, 31, 31], scale: 1.3, hover: 0, blow: Object.freeze({ nm: ATTACKS.cleave.name, t: 'c', r: ATTACKS.cleave.r, arc: ATTACKS.cleave.arc, wu: ATTACKS.cleave.windup, rec: ATTACKS.cleave.recover, p: ATTACKS.cleave.pct, b: ATTACKS.cleave.base, reach: ATTACKS.cleave.range }) }),   // AUDIT EG IV (lane1 #16): the Warden's Cleave, the gate's row
  Object.freeze({ id: 10, key: 'kynval', name: 'Kynval', plural: 'Kynval', r: 0.8, h: 2.4, speed: 3, hpS: 10, mob: [31, 31, 31, 31], scale: 1, hover: 0, blow: Object.freeze({ nm: 'Kynval Strike', t: 'c', r: 5, arc: 100, wu: 1200, rec: 900, p: 0.25, b: 8 }) }),
  Object.freeze({ id: 11, key: 'ghost', name: "Battlemage's Ghost", plural: 'Ghosts', r: 0.5, h: 1.8, speed: 4, hpS: 999, mob: [130, 130, 130, 130], scale: 1, hover: 0.3, blow: null, friend: 1 }),
  Object.freeze({ id: 12, key: 'deserter', name: 'The Deserter', plural: 'Deserters', r: 0.6, h: 2.2, speed: 3, hpS: 999, mob: [129, 129, 129, 129], scale: 1, hover: 0, blow: null, friend: 1 }),   // AUDIT EG IV (ROLE READS): a friend is a human shape no foe wears - the Ghost a Battlemage (130), the Deserter a Spellsword (129)
  Object.freeze({ id: 13, key: 'standard', name: 'Standard-Bearer', plural: 'Standard-Bearers', r: 0.8, h: 2.4, speed: 3, hpS: 20, team: 1, mob: [29, 29, 29, 29], scale: 1.2, hover: 0, blow: null }),   // AUDIT EG IV (ROLE READS): a Daedra Seducer bearing the Kyn's standard - the Dremora (31) is the elites' alone
  Object.freeze({ id: 14, key: 'shade', name: 'Vengeful Shade', plural: 'Shades', r: 0.4, h: 1.6, speed: 3, hpS: 999, mob: [18, 18, 18, 18], scale: 0.8, hover: 0.3, blow: Object.freeze({ nm: 'Shade Burst', t: 'd', r: 2, wu: 1000, rec: 0, p: 0.1, b: 0 }) }),
  Object.freeze({ id: 15, key: 'thrall', name: 'Blood Thrall', plural: 'Blood Thralls', r: 0.5, h: 1.5, speed: 3, hpS: 6, mob: [28, 28, 28, 28], scale: 1, hover: 0, blow: null }),   // AUDIT EG IV (ROLE READS): a Vampire, on its feet - the Giant Bat (3) is the Shade's Harrier
]);
/** Which kinds each band's waves draw (section 12): the Galleries' six, the Cairn's Binders and Wraiths, the Shade's
 *  Divers, and all of them in the Wellhead (its Daedra Lord one wave in six). */
export const EG_BAND_KINDS = Object.freeze([
  Object.freeze([0, 1, 2, 3, 4, 6]), Object.freeze([0, 1, 2, 3, 4, 6, 7, 8]), Object.freeze([0, 1, 2, 3, 4, 5, 6, 7, 8]), Object.freeze([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]),
]);
/** The kinds a wave leads with (the Sappers and Ward-Bearers rise only where they have work). */
const WAVE_LEADS = Object.freeze([EG_KIND.harrier, EG_KIND.breaker, EG_KIND.caster, EG_KIND.diver, EG_KIND.wraith]);
/** A Daedra Lord leads one Wellhead wave in this many (section 12); under THE MINGLED LEGION (AUDIT EG IV; section 18) one in
 *  EG_MINGLED_DLORD_EVERY, and every body of a wave is drawn among EG_MINGLED_LEADS - the lead kinds of every band. */
export const EG_DLORD_EVERY = 6;
export const EG_MINGLED_DLORD_EVERY = 3;
export const EG_MINGLED_LEADS = WAVE_LEADS;
/** A Harrier keeps its mark this long; it stops this short of the mark and Bites within reach; a Lurker wakes within its
 *  `wake`; a Caster keeps this far off; a Wraith's tether breaks at its `brk`; a shade follows this long. */
export const EG_RETARGET_MS = HOST_RETARGET_MS;   // AUDIT EG IV (lane1 #16): the gate's, read
export const EG_BITE_REACH = HARRIER_BITE_REACH;
export const EG_CASTER_RANGE = Object.freeze([10, 18]);
export const EG_SHADE_MS = 6000;
/** How long an add takes to rise out of the floor (ms) - seen rising on every screen. */
export const EG_ADD_RISE_MS = 900;
/** A Kynval squad's affixes (section 8.7). */
export const EG_AFFIXES = Object.freeze(['searing', 'shielded', 'wrathful', 'unshaken']);
/** A pool's tick (ms): a Caster's Bolt, a Searing strike, Soul-Pools. */
export const EG_POOL_TICK_MS = 1000;
/** EG-ZB (section 8.2): a span's Diver circles the island it waits at this far out (m), and dives only at ground at least
 *  this wide (m - the Diver's rule: its lane's 4 m and 2 m more; a span's island is 6 m across). */
export const EG_DIVER_WAIT_R = 6;
export const EG_DIVE_GROUND_M = 6;
/** EG-ZB (section 11.7): a Harrier hunting a member off the floors leaves the graph for the air this near the floor's edge
 *  nearest them (m). */
export const EG_HUNT_LEAVE_M = 1.5;

/** EG-ZB (section 11.7): A GROUND WALKER'S WALK over the hall's graph (net/eliteGates/egWalkGraph.js egWalkNext) - to its next node, or to
 *  its goal `stop` short; said as net/eliteGates/egBodies.js egWalk says a walk (the point already kept on its region). EG-ZJ (section
 *  23): its FEET the graph's (net/eliteGates/egWalkGraph.js egWalkFeet) - set on the floor of a region it has just come into (a lip
 *  stepped off, a portal, a stair's top), its walk ending on its next node's floor (a stair climbed as it goes). EG-ZK: every
 *  lord's and champion's walk too (net/eliteGates/egLords.js lordWalk) - so a lord's feet ride the graph as the legion's do. EG-ZQ: the
 *  node it walked to kept only while it still walks there (net/eliteGates/egWalkGraph.js egWayOn - a Breaker set down at an arch's wall
 *  by its cut charge, a pushed or pulled walker, keeps none to walk straight to). */
export function walkGraph(F, view, a, gx, gz, stop, speed, now, gy = NaN) {
  if (view?.fl?.length) egWayOn(view, a);   // EG-ZQ (EG-ZK's departure 7): set down off its walk, it keeps no way on through a wall
  const fr = a.fr, [x, z, last] = egWalkNext(view, a, gx, gz, gy, a.r ?? 0.6), H = egWalkFeet(view, a);
  if (H && a.fr !== fr) a.y = H[0];
  egWalk(F, a, x, z, last ? stop : 0, speed, now, view, 0, true, H ? H[1] : NaN);
}
/** EG-ZJ (sections 11.7 and 23): A FLIER'S HEIGHT for its mark `m` (a member, an island: `{x, z, y?}`) - on the fight ground
 *  under it where its feet stand in that ground's band (a flier over a floor keeps to the floor, never to a jump), else at
 *  its own feet (a member on a span's platform, over the void); with no height known, the fight ground under its plan by
 *  the flier's own (net/eliteGates/egWalkGraph.js egFeetAt). Whole centimetres. */
export function egAirY(view, m, a) {
  if (!Number.isFinite(m?.y)) return egFeetAt(view, m.x, m.z, a.y ?? NaN, a.y ?? 0);
  const f = egGroundAt(view, m.x, m.y, m.z, EG_PIECE_TOUCH_M);
  return Math.round((f ? f.y ?? 0 : m.y) * 100) / 100;
}
/** EG-ZB: A FLIER'S WAY through the air about the rock (net/eliteGates/egWalkGraph.js egAirNext) - to its next way, or to its goal
 *  (kept out of a passage's rock) `stop` short. EG-ZJ: at its mark's height (egAirY - `m` the mark, its `y` the height). EG-ZK:
 *  a flying lord's too (net/eliteGates/egLords.js). */
export function walkAir(F, view, a, gx, gz, stop, speed, now, m = null) {
  const [tx, tz] = egAirKeep(view, gx, gz, a.y), [x, z] = egAirNext(view, a.x, a.z, tx, tz, a.y);   // THE ASCENT: the rock at its own height
  egWalk(F, a, x, z, x === tx && z === tz ? stop : 0, speed, now, view, 0, true, egAirY(view, m ?? { x: gx, z: gz }, a));
}

/** A kind's look for a band (its mobile, scale, hover - the client draws it). */
export const egKindLook = (k, band) => { const K = EG_LEGION_KINDS[k] ?? EG_LEGION_KINDS[0]; return { mobile: K.mob[Math.max(0, Math.min(3, band))], scale: K.scale, hover: K.hover, name: K.name, plural: K.plural }; };
/** An add's health in a fight. */
export const egKindHp = (F, k, team = 1) => { const K = EG_LEGION_KINDS[k]; return K.team ? egHpTeam(F, K.hpS, team) : egHpMean(F, K.hpS); };
const elOf = (F, el) => (el === 'band' ? F.el : el ?? null);
/** THE ASCENT (Elite-Gates-Ascent.md section 2): do body `a` and member (or body) `m` stand in one storey of hall `spec` - their
 *  fight floors' tops (net/eliteGates/egWalkGraph.js egStoreyY) under EG_STACK_M apart? Always, in a hall that judges in plan alone. A blow
 *  is thrown only at one of its own storey: it lands there alone. */
export const egSameStorey = (spec, a, m) => !egByHeight(spec) || !Number.isFinite(a?.y) || !Number.isFinite(m?.y) || egOneStorey(egStoreyY(spec, a.x, a.y, a.z), egStoreyY(spec, m.x, m.y, m.z));
/** THE ASCENT: a body's place as a spot `[x, z, y]` - its feet with it where the hall judges by height, `[x, z]` before. */
const spotOf = (spec, b) => (egByHeight(spec) && Number.isFinite(b.y) ? [b.x, b.z, b.y] : [b.x, b.z]);
const near = (b, here) => { let best = null, bd = Infinity; for (const m of here) { const d = Math.hypot(m.x - b.x, m.z - b.z); if (d < bd) { bd = d; best = m; } } return best ? { m: best, d: bd } : null; };
const far = (x, z, here) => { let best = null, bd = -1; for (const m of here) { const d = Math.hypot(m.x - x, m.z - z); if (d > bd) { bd = d; best = m; } } return best; };

/**
 * A WAVE (section 12): `size` bodies of the band's kinds - led by one kind at half its size, the rest Harriers (a Binder
 * with it under Swarm-Mother, two at rank II; one wave in six in the Wellhead a Daedra Lord leads it) - at `spots`.
 * Answers the kinds, one a spot. AUDIT EG III: held to `room` (the room the legion's cap leaves - egLegionRoom), the first
 * of them kept: a wave never stands the legion past its cap, whoever pours it.
 * AUDIT EG IV (lane1 #14, lane2 #3, lane10 #12; section 18) - THE MINGLED LEGION (a stratum, `F.mingled`): no wave is one kind
 * and Harriers - each body is drawn on its own among the lead kinds (EG_MINGLED_LEADS: a Diver only under the sky), and a
 * Daedra Lord leads one wave in three (EG_MINGLED_DLORD_EVERY), not six.
 * AUDIT EG V (L2-12; section 14: "every wave carries a Binder"): SWARM-MOTHER is the fight's own decree (`F.D.swarm`), read here
 * whoever pours the wave - the hall's, a lord's fury's and its Muster-Call's, a champion's escort, Kyn's Vigil's - unless a caller
 * names its own. (L3-20; section 8.4): `only` - a wave of that one kind (an Athenaeum's Harriers), its Binders beside it.
 * @param {any} F @param {() => number} rng @param {number} size @param {{ swarm?: number, waveNo?: number, sky?: boolean, room?: number, only?: number|null }} o
 */
export function egWaveKinds(F, rng, size, { swarm = F?.D?.swarm ?? 0, waveNo = 0, sky = false, room = egLegionRoom(F), only = null } = {}) {
  const out = [];
  if (only != null) for (let i = 0; i < size; i++) out.push(only);
  else {
    const open = EG_BAND_KINDS[F.band] ?? EG_BAND_KINDS[0];
    const leads = WAVE_LEADS.filter((k) => open.includes(k) && (k !== EG_KIND.diver || sky));
    const lead = leads[Math.floor(rng() * leads.length)] ?? EG_KIND.harrier;
    const every = F.mingled ? EG_MINGLED_DLORD_EVERY : EG_DLORD_EVERY;
    if (F.band >= 3 && waveNo % every === every - 1) out.push(EG_KIND.dlord);
    const half = Math.ceil(size / 2);
    if (F.mingled) { const mix = EG_MINGLED_LEADS.filter((k) => k !== EG_KIND.diver || sky); while (out.length < size) out.push(mix[Math.floor(rng() * mix.length)] ?? lead); }
    else for (let i = out.length; i < size; i++) out.push(i < half ? lead : EG_KIND.harrier);
  }
  for (let s = 0; s < swarm; s++) out.push(EG_KIND.binder);
  return out.slice(0, Math.max(0, room));
}
/** How many a wave raises for n living members (the gate's harrierCountFor - 2 to 5). */
export const egWaveSize = (n) => harrierCountFor(n);
/** A champion's escort for n living members (section 8.5: `1 + ceil(n/3)` adds of its band, 2 to 4) - the Proving Walk's, and
 *  Kyn's Vigil's (section 14: doubled at rank II). */
export const egEscortOf = (n) => 1 + Math.ceil(n / 3);
/** THE LEGION'S CAP for a company of n living members at circle c (section 8.1), and the most of the legion standing at once
 *  on the wire. */
export const egLegionCap = (n, c) => Math.min(14, 2 + Math.ceil(1.5 * n) + Math.floor((c - 1) / 5));
export const EG_STANDING_MAX = 16;
/** AUDIT EG III - THE ROOM UNDER THE CAP: how many more of the legion fight `F` may stand now - its cap (halved in a Deepway's
 *  rift chamber, `halfCap`, section 8.8) less its standing foes (a friend is none). Every wave is held to it (egWaveKinds) - the
 *  director's, a lord's fury's and its summons' waves alike - and Hunting Pack's, a Kynval squad, the hunt's pair.
 *  AUDIT EG V (L2-3; sections 8.1, 8.8 and 12): A DORMANT LURKER IS NO PART OF IT - a fragment's statue in its wall's shadow
 *  (net/eliteGates/egBrain.js fragStand) counts from its waking, an ambush springing whatever the room; counted asleep, three statues in a
 *  lone member's Deepway rift chamber (its cap halved to two) held every wave for good. */
export function egLegionCapOf(F) { return Math.min(EG_STANDING_MAX, Math.floor(egLegionCap(F.n, F.c) / (F.halfCap ? 2 : 1))); }
export function egLegionRoom(F) {
  if (!Array.isArray(F?.bodies) || !Number.isFinite(F.n) || !Number.isFinite(F.c)) return Infinity;
  return Math.max(0, egLegionCapOf(F) - F.bodies.filter((b) => b.role === EG_ROLE.add && b.hp > 0 && !egHas(b, EG_FL.friend) && !egHas(b, EG_FL.dormant)).length);
}

/**
 * EG-PERFECT (2026-10-18; sections 11.4 and 11.7) - A CHAMBER'S FREE CASTER STAND for a Caster rising at (x, z) (`y` its height,
 * where the hall judges by it): the number in fight `F`'s stands (`F.stands`, `[x, z, y, ov, box]` each - net/eliteGates/egBrain.js
 * egCasterStands lays them at the wake) of the nearest whose chamber's reach (`box`) holds where it rises and no living Caster
 * holds (a Caster's `stand` is its number and one), or -1 (none laid, none in that chamber, or every one held). Pure.
 * @param {any} F @param {number} x @param {number} z @param {number} [y]
 */
export function egStandFree(F, x, z, y = NaN) {
  const S = F?.stands ?? [];
  let best = -1, bd = Infinity;
  for (let i = 0; i < S.length; i++) {
    const [sx, sz, , , q] = S[i];
    if (!q || x < q[0] || x > q[3] || z < q[2] || z > q[5] || (Number.isFinite(y) && (y < q[1] || y > q[4]))) continue;
    if (F.bodies.some((b) => b.stand === i + 1 && b.hp > 0)) continue;
    const d = Math.hypot(sx - x, sz - z);
    if (d < bd) { bd = d; best = i; }
  }
  return best;
}
/**
 * A WAVE RISEN at `spots` (one per kind in `kinds`), each at its kind's health (a team kind's shared over its own),
 * tagged with the wave's number (Kyn's Rally, a Binder's raise). Answers the bodies. EG-ZJ: a spot `[x, z, y]` raises its
 * body at that height (a span's shadows at their member's, its Divers at the island's); said as every body is
 * (net/eliteGates/egBodies.js egBodyWire). EG-PERFECT: a Caster risen in a chamber on its nearest free stand there
 * (egStandFree) - the same bodies, so THE LEGION'S CAP holds as it held.
 */
export function egLegionRaise(F, kinds, spots, now, out, { wave = 0, fl = 0, hpX = 1 } = {}) {
  const made = [];
  const counts = {};
  for (const k of kinds) counts[k] = (counts[k] ?? 0) + 1;
  kinds.forEach((k, j) => {
    const [x, z, y] = spots[j % spots.length];
    const K = EG_LEGION_KINDS[k];
    const hp = Math.round(egKindHp(F, k, counts[k]) * hpX);
    const f = fl | (K.fly ? EG_FL.fly : 0) | (K.friend ? EG_FL.friend : 0) | (k === EG_KIND.lurker ? EG_FL.dormant : 0) | (k === EG_KIND.shade ? EG_FL.ward : 0) | (k === EG_KIND.dlord ? EG_FL.elite : 0);
    // EG-PERFECT (section 11.7: "Casters stand at anchors.caster"): a Caster risen in a chamber rises on its free stand there,
    // at its raised floor's height, and keeps to it (pinned, as a Rampart's on its pillar) - the wave's own place where every
    // stand is held, or it rises out of the chamber
    const st = k === EG_KIND.caster ? egStandFree(F, x, z, y) : -1, S = st >= 0 ? F.stands[st] : null;
    const b = S ? egBodyNew(F, EG_ROLE.add, k, S[0], S[1], hp, { r: K.r, fl: f, up: EG_ADD_RISE_MS, now, wv: wave, h0: hp, rally: 0, y: S[2], pinned: 1, stand: st + 1, ...(Number.isFinite(S[3]) ? { ov: S[3] } : {}) })
      : egBodyNew(F, EG_ROLE.add, k, x + (j % 3) * 0.7 - 0.7, z + Math.floor(j / 3) * 0.7, hp, { r: K.r, fl: f, up: EG_ADD_RISE_MS, now, wv: wave, h0: hp, rally: 0, ...(Number.isFinite(y) ? { y } : {}) });
    if (b) made.push(b);
  });
  if (made.length) out.push(egRisen(made, now));   // AUDIT FB1018f L3-4: their radii beside them
  return made;
}
/**
 * AUDIT EG IV (lane1 #6; section 12: "Every wave is held to the room under the cap ... the hall's, a lord's fury's and its
 * summons'") - A SUMMONS HELD TO THE ROOM: `kinds` raised as egLegionRaise raises them, but no more of them than the room the
 * legion's cap leaves (egLegionRoom), the first kept - a lord's summons (Moonfall's Divers, the Soul Burst's Wraiths, the Last
 * Rites'), a Binder's raise, the Low Road's foes. The first `need` of them are a mechanic's own body (a chained odd member's
 * Wraith, a lone member's Blood Thrall): they stand whatever the room, and count against it after. Answers the bodies.
 * @param {any} F @param {number[]} kinds @param {any[]} spots @param {number} now @param {any[]} out @param {{ need?: number, wave?: number, fl?: number, hpX?: number }} [o]
 */
export function egLegionSummon(F, kinds, spots, now, out, o = {}) {
  const need = Math.max(0, Math.min(kinds.length, o.need ?? 0)), room = egLegionRoom(F);
  const take = [...kinds.slice(0, need), ...kinds.slice(need, need + Math.max(0, room - need))];
  return take.length ? egLegionRaise(F, take, spots, now, out, o) : [];
}

/**
 * A BLOW of an add's kind begun from body `a` at target point (tx, tz) - its stamp laid as its kind lays it (a disc at
 * its own feet or at the target's, a lane toward the target, a cone about its facing), its element the band's where it
 * takes one, its share by the depth (and Wrathful's tenth). Chained Blows (`chain` 1 or 2) chain a second (and third)
 * shape, outlined with the first, landing max(its wind-up, its floor + 0.3 s, 1.0 s) after it.
 */
function addBlow(F, spec, a, tx, tz, now, here, out, { chain = 0, twin = 0, atFeet = false, y = NaN } = {}) {
  const K = EG_LEGION_KINDS[a.k], B = K.blow;
  if (!B) return null;
  const yaw = Math.atan2(tx - a.x, tz - a.z);
  const stamp = (x, z) => (B.t === 'd' ? shDisc(atFeet ? tx : x, atFeet ? tz : z, B.r) : B.t === 'l' ? shLaneAt(x, z, yaw, B.len, B.w) : shCone(x, z, yaw, B.r, B.arc));
  const wrath = egHas(a, EG_FL.wrathful) ? 1.1 : 1;
  // EG-PERFECT: `y` the height it lands at where its caller names it (a stand's Caster's bolt, its mark's floor), else its thrower's
  const base = { o: a.i, wu: B.wu, p: B.p * egShareX(F.c, wrath * (F.mem.furyX ?? 1)), b: B.b, el: elOf(F, B.el), nm: B.nm, pu: B.pu ?? 0, sp: B.run ? Math.round((B.len / B.run) * 1000) : 0, ...(Number.isFinite(y) ? { y } : {}) };
  const first = egAim(F, spec, { ...base, s: [stamp(a.x, a.z)], at: now + B.wu }, here, now, out);
  if (!first) return null;
  a.atk = { i: first.i, at: first.at, until: first.at + (first.sp ?? 0) + (B.rec ?? 600) };
  egFace(F, a, yaw, now);   // AUDIT EG V (lane1 #7): its turn said - a Shielded elite's back is judged by the facing every screen draws
  let at = first.at;
  for (let c = 0; c < chain; c++) {
    const ox = tx + Math.sin(yaw) * 3 * (c + 1), oz = tz + Math.cos(yaw) * 3 * (c + 1);
    const s = B.t === 'l' ? shLaneAt(tx, tz, yaw, B.len, B.w) : shDisc(ox, oz, B.t === 'd' ? B.r : 3);
    const gap = egChainGapMs(first.wu, [s]);   // AUDIT EG III: the floor + 0.3 s term kept (net/eliteGates/egShape.js - one rule with fury's chain)
    at += gap;
    egAim(F, spec, { ...base, s: [s], at, wu: gap, ol: at - gap - now, nm: `${B.nm} (chained)` }, here, now, out);   // AUDIT EG V (lane1 #18): its fill from the shape before it lands, its dim outline from the word
  }
  for (let c = 0; c < twin; c++) {
    at += 1200;
    egAim(F, spec, { ...base, s: [shLaneAt(tx, tz, yaw, B.len, B.w)], at, wu: at - now, nm: 'Twin Charge' }, here, now, out);
  }
  if (B.run) {
    const L = Math.min(B.len, Math.hypot(tx - a.x, tz - a.z) + 4), [ex, ez] = egKeepOnFight(spec, a.x + Math.sin(yaw) * L, a.z + Math.cos(yaw) * L, K.r, a.y);   // THE ASCENT: its run ends on its own floor
    const cut = egArchCut(spec, a.x, a.z, ex, ez, a.y);   // EG-ZB (section 11.7): a charge run into an arch's wall ends at it
    a.runTo = cut ? [cut[0], cut[1] - Math.sign(ez - a.z) * (K.r + 0.4), first.at + first.sp] : [ex, ez, first.at + first.sp];
  }
  return first;
}

/**
 * THE LEGION'S BEAT on hall `spec`: each add carried, risen ones at their work - a Harrier at its mark, a Sapper at its
 * objective, a Ward-Bearer's Pulse, a Breaker's charge, a Caster's Bolt, a Diver's dive, a Lurker woken, a Binder's raise,
 * a Wraith's tether, the ghost and the deserter at the legion and the rifts, a shade at its slayer.
 * `here` the living members on the floor (the hall's frame); `ctx`: `anchor` (a Court's lord's place - the Harriers run
 * from it), `sapGoal(a)` (an add's objective: `[x, z]` or null) and `sapAt(a)` (it reached it), `decrees` (the circle's -
 * `{chained, twincharge, ...}` ranks), `ghostHit(a, target)`, `deserterHit(a)`. EG-ZB: `spec` is the hall's FIGHT GROUND
 * (net/eliteGates/egWalkGraph.js egFightView - the ground walkers keep to its graph); `span` (a Span's legion: the Harriers shadow
 * `shadow`, every living member in the hall, and bite only those in `here`; the Divers wait over `isles`, its islands and
 * plates), `hunted` (the members off the floors past six seconds - section 11.7: the Harriers hunt them first).
 * AUDIT EG III - FADE FOOLS EVERY KIND (section 15: "adds lose you"; `fadeOf(sub, t)`): every kind's pick of a member - a mark,
 * the nearest, a Bolt's target, the slayer a shade follows - is made among the members it sees, never one in its Fade; only an
 * Unshaken elite (section 8.7: "immune to push and to Fade") sees them all. A shape aimed at another lands on a Faded member
 * still, a dormant Lurker wakes at anyone's nearness, and a Wraith's tether once bound holds.
 * @param {any} F @param {any} spec @param {number} now @param {{sub: string, x: number, z: number}[]} here @param {() => number} rng
 * @param {any[]} out @param {any} ctx
 */
export function egLegionStep(F, spec, now, here, rng, out, ctx = {}) {
  const D = ctx.decrees ?? {};
  const chain = D.chained ?? 0, twin = D.twincharge ?? 0;
  const lost = (m) => !!ctx.fadeOf?.(m.sub, now);
  const seenAll = here.filter((m) => !lost(m)), shadowAll = (ctx.shadow ?? here).filter((m) => !lost(m)), huntedAll = (ctx.hunted ?? []).filter((m) => !lost(m));
  for (const a of [...F.bodies]) {
    if (a.role !== EG_ROLE.add || !(a.hp > 0)) continue;
    if (now < (a.up ?? 0)) continue;
    const K = EG_LEGION_KINDS[a.k];
    if (a.atk) {
      if (now < a.atk.until) { if (a.runTo && now >= a.runTo[2]) { egPlace(F, a, a.runTo[0], a.runTo[1], now); a.runTo = null; } continue; }
      if (a.runTo) { egPlace(F, a, a.runTo[0], a.runTo[1], now); a.runTo = null; }
      a.atk = null;
    }
    if (egHas(a, EG_FL.stun) && now < (a.stunUntil ?? 0)) { egStop(F, a, now); continue; }
    const sure = egHas(a, EG_FL.unshaken), seen = sure ? here : seenAll;   // the members it sees (an Unshaken elite sees them all)
    switch (a.k) {
      case EG_KIND.thrall: egStop(F, a, now); break;
      case EG_KIND.harrier: {
        // EG-ZB (section 11.7): the hunted first; on a span (section 8.2) every member in the hall is shadowed
        const hunted = sure ? ctx.hunted ?? [] : huntedAll;
        const pool = ctx.span ? (sure ? ctx.shadow ?? here : shadowAll) : seen;
        let mark = a.tg ? (hunted.length ? hunted : pool).find((m) => m.sub === a.tg) ?? null : null;
        if (!mark || now - a.tgAt >= EG_RETARGET_MS) {
          if (hunted.length) mark = near(a, hunted)?.m ?? null;
          else mark = ctx.anchor ? far(ctx.anchor[0], ctx.anchor[1], pool) : near(a, pool)?.m ?? null;
          a.tg = mark?.sub ?? null; a.tgAt = now;
        }
        if (!mark) { egStop(F, a, now); break; }
        const hunt = hunted.includes(mark);
        // a shadow over a platform body-blocks and never bites: only a member on the fight ground (an island, a plate)
        if (Math.hypot(a.x - mark.x, a.z - mark.z) <= EG_BITE_REACH && (hunt || !ctx.span || here.some((m) => m.sub === mark.sub)) && egSameStorey(spec, a, mark)) {
          egStop(F, a, now);
          const bl = addBlow(F, spec, a, a.x, a.z, now, here, out, { chain });
          if (bl && hunt) bl.hn = mark.sub;   // the census judges a hunted member's Bite off the floors (net/bossRef.js)
          break;
        }
        if (ctx.span) walkAir(F, spec, a, mark.x, mark.z, 1, K.speed, now, mark);
        else if (hunt) {
          // along the graph to the floor's edge nearest them, then on through the air
          const [kx, kz] = egKeepOnFight(spec, mark.x, mark.z, 0.5, a.y);   // THE ASCENT: the edge of its own storey's floor
          if (Math.hypot(a.x - kx, a.z - kz) <= EG_HUNT_LEAVE_M || !egGroundAt(spec, a.x, egFeetY(spec, a.y), a.z, 0.5)) walkAir(F, spec, a, mark.x, mark.z, 1, K.speed, now, mark);
          else walkGraph(F, spec, a, kx, kz, 0, K.speed, now);
        } else walkGraph(F, spec, a, mark.x, mark.z, 1, K.speed, now, mark.y);
        break;
      }
      case EG_KIND.sapper: {
        const goal = ctx.sapGoal?.(a);
        if (!goal) { egStop(F, a, now); break; }
        if (Math.hypot(a.x - goal[0], a.z - goal[1]) <= (goal[2] ?? 1.6)) { egStop(F, a, now); ctx.sapAt?.(a); break; }
        walkGraph(F, spec, a, goal[0], goal[1], (goal[2] ?? 1.6) * 0.8, K.speed, now);
        break;
      }
      case EG_KIND.bearer: {
        const n = near(a, seen);
        if (!n || n.d > 6 || now < (a.next ?? 0) || !egSameStorey(spec, a, n.m)) break;
        a.next = now + K.blow.every;
        addBlow(F, spec, a, a.x, a.z, now, here, out, { chain });
        break;
      }
      case EG_KIND.breaker: case EG_KIND.dlord: case EG_KIND.kynval: {
        const n = near(a, seen);
        if (!n) { egStop(F, a, now); break; }
        const reach = a.k === EG_KIND.breaker ? 14 : a.k === EG_KIND.dlord ? K.blow.reach : 3.5;   // AUDIT EG IV (lane1 #16): the Daedra Lord's the gate's Cleave's
        if (n.d <= reach && now >= (a.next ?? 0) && egSameStorey(spec, a, n.m)) {
          egStop(F, a, now);
          addBlow(F, spec, a, n.m.x, n.m.z, now, here, out, { chain, twin: a.k === EG_KIND.breaker ? twin : 0 });
          a.next = now + (a.k === EG_KIND.breaker ? 4000 : 2600);
          if (a.k === EG_KIND.kynval && egHas(a, EG_FL.searing) && ctx.pool) ctx.pool(a.x, a.z, 2.5, now + K.blow.wu, 6000, 0.05, 2, F.el, 'burn', a.y);
          break;
        }
        walkGraph(F, spec, a, n.m.x, n.m.z, a.k === EG_KIND.breaker ? 10 : 1.5, K.speed, now, n.m.y);
        break;
      }
      case EG_KIND.caster: {
        const n = near(a, seen);
        if (!n) { egStop(F, a, now); break; }
        if (n.d < EG_CASTER_RANGE[0] || n.d > EG_CASTER_RANGE[1]) {
          const want = (EG_CASTER_RANGE[0] + EG_CASTER_RANGE[1]) / 2, ux = (a.x - n.m.x) / (n.d || 1), uz = (a.z - n.m.z) / (n.d || 1);
          walkGraph(F, spec, a, n.m.x + ux * want, n.m.z + uz * want, 0.5, K.speed, now);
        } else egStop(F, a, now);
        // THE ASCENT: a bolt only at its own storey - EG-PERFECT: a Caster on its stand at the chamber floor its balcony
        // overlooks too (`ov` - a kit balcony stands up to 4 m over it, EG_STACK_M's own storey), its bolt landing at its
        // mark's feet on its mark's floor
        const overlooks = (m) => a.stand > 0 && Number.isFinite(a.ov) && Number.isFinite(m.y) && egOneStorey(a.ov, egStoreyY(spec, m.x, m.y, m.z));
        const mine = egByHeight(spec) ? seen.filter((m) => egSameStorey(spec, a, m) || overlooks(m)) : seen;
        if (now >= (a.next ?? 0) && mine.length) {
          const tgt = mine[Math.floor(rng() * mine.length)] ?? n.m;
          a.next = now + K.blow.every + Math.floor(rng() * K.blow.jitter);
          const bl = addBlow(F, spec, a, tgt.x, tgt.z, now, here, out, { chain, atFeet: true, y: a.stand > 0 && Number.isFinite(tgt.y) ? egStoreyY(spec, tgt.x, tgt.y, tgt.z) : NaN });
          if (bl && ctx.pool) ctx.pool(tgt.x, tgt.z, POOLS.hellfire.r, bl.at, POOLS.hellfire.ms, POOLS.hellfire.pct, POOLS.hellfire.base, F.el, 'burn', bl.y);   // AUDIT EG IV (lane1 #16): the gate's burning ground (POOLS' hellfire), never a copy
        }
        break;
      }
      case EG_KIND.diver: {
        if (ctx.span) { diverOnSpan(F, spec, a, K, now, here, out, ctx, chain, sure ? ctx.shadow ?? here : shadowAll); break; }
        const n = near(a, seen);
        if (!n) { egStop(F, a, now); break; }
        if (now >= (a.next ?? 0) && egOnFight(spec, n.m.x, n.m.z, -3, n.m.y)) {
          a.next = now + K.blow.every;
          egStop(F, a, now);
          addBlow(F, spec, a, n.m.x, n.m.z, now, here, out, { chain });
          break;
        }
        const t = (now / 1000) * 0.6 + a.i;
        walkAir(F, spec, a, n.m.x + Math.sin(t) * 8, n.m.z + Math.cos(t) * 8, 0.5, K.speed, now, n.m);
        break;
      }
      case EG_KIND.lurker: {
        if (egHas(a, EG_FL.dormant)) {
          const w = near(a, here);   // nearness wakes it, a Faded member's too (an ambush springs on whoever passes)
          if (w && w.d <= K.wake) egLurkerWake(F, a, now, out);
          break;
        }
        const n = near(a, seen);
        if (!n) { egStop(F, a, now); break; }
        if (n.d <= 2.5 && now >= (a.next ?? 0) && egSameStorey(spec, a, n.m)) { egStop(F, a, now); addBlow(F, spec, a, a.x, a.z, now, here, out, { chain }); a.next = now + 2500; break; }
        walkGraph(F, spec, a, n.m.x, n.m.z, 1.5, K.speed, now, n.m.y);
        break;
      }
      case EG_KIND.binder: {
        const n = near(a, seen);
        if (a.cast) {
          if (now >= a.cast.until) {
            const g = a.cast.g;
            a.cast = null; a.raised = 1;
            if (F.pg.raise?.[0] === a.i) F.pg.raise = null;
            if (egLegionSummon(F, [g.k], [Number.isFinite(g.y) ? [g.x, g.z, g.y] : [g.x, g.z]], now, out, { wave: a.wv }).length) out.push({ k: 'esay', w: 'raised' });   // AUDIT EG IV (lane1 #6): within the room under the cap
          }
          break;
        }
        if (n && n.d < 8) { const ux = (a.x - n.m.x) / (n.d || 1), uz = (a.z - n.m.z) / (n.d || 1); walkGraph(F, spec, a, a.x + ux * 4, a.z + uz * 4, 0.5, K.speed, now); }
        // AUDIT EG IV (lane1 #12; section 12: "raises the last fallen add of its wave once"): the body CLAIMED as the cast begins -
        // taken off the fallen, so no second Binder raises it - and begun only with room under the cap to raise it into
        const fallen = F.mem.fallen ?? [], g = !a.raised && egLegionRoom(F) > 0 ? fallen.filter((x) => x.wv === a.wv && x.k !== EG_KIND.binder).pop() : null;
        if (g) { fallen.splice(fallen.indexOf(g), 1); egStop(F, a, now); a.cast = { g, at: now, until: now + K.raiseMs, dmg: 0, max: a.max / 10 }; F.pg.raise = [a.i, now + K.raiseMs]; out.push({ k: 'efl', i: a.i, fl: a.fl | EG_FL.lit }); }
        break;
      }
      case EG_KIND.wraith: {
        const tied = F.tethers.find((t) => t[0] === a.i && t[2] === 0);
        if (!here.length) { egStop(F, a, now); break; }
        if (tied) {
          const m = here.find((x) => x.sub === tied[1]);
          if (!m || Math.hypot(m.x - a.x, m.z - a.z) > K.drain.brk) { F.tethers = F.tethers.filter((t) => t !== tied); F.mem.txDirty = 1; }
          else walkAir(F, spec, a, m.x, m.z, 5, K.speed, now, m);
          break;
        }
        const n = near(a, seen);
        if (!n) { egStop(F, a, now); break; }
        if (n.d <= K.drain.r) { F.tethers.push([a.i, n.m.sub, 0, K.drain.r * 100 + K.drain.brk]); F.mem.txDirty = 1; egStop(F, a, now); break; }
        walkAir(F, spec, a, n.m.x, n.m.z, 4, K.speed, now, n.m);
        break;
      }
      case EG_KIND.ghost: {
        const foes = egBodiesOf(F, EG_ROLE.add).filter((b) => !egHas(b, EG_FL.friend) && !egHas(b, EG_FL.ward));
        let best = null, bd = Infinity;
        for (const f of foes) { const d = Math.hypot(f.x - a.x, f.z - a.z); if (d < bd) { bd = d; best = f; } }
        if (!best) { egStop(F, a, now); break; }
        if (bd <= 2.5) { egStop(F, a, now); if (now >= (a.next ?? 0)) { a.next = now + 1500; ctx.ghostHit?.(a, best); } break; }
        if (ctx.span) walkAir(F, spec, a, best.x, best.z, 1.5, K.speed, now, best);   // AUDIT EG V (L3-19): a span's ghost keeps to the air, as its Harriers do (its islands are not joined)
        else walkGraph(F, spec, a, best.x, best.z, 1.5, K.speed, now);
        break;
      }
      case EG_KIND.deserter: {
        const goal = ctx.deserterGoal?.(a);
        if (!goal) { egStop(F, a, now); break; }
        if (Math.hypot(a.x - goal[0], a.z - goal[1]) <= 2.5) { egStop(F, a, now); if (now >= (a.next ?? 0)) { a.next = now + 1000; ctx.deserterHit?.(a); } break; }
        walkGraph(F, spec, a, goal[0], goal[1], 2, K.speed, now);
        break;
      }
      case EG_KIND.standard: {
        const pts = ctx.rally ?? [];
        if (!pts.length) break;
        if (!a.goal || now >= (a.goalAt ?? 0)) { a.ri = ((a.ri ?? -1) + 1) % pts.length; a.goal = pts[a.ri]; a.goalAt = now + 20_000; }
        walkGraph(F, spec, a, a.goal[0], a.goal[1], 0.5, K.speed, now);
        break;
      }
      case EG_KIND.shade: {
        if (now >= a.burstAt) {
          if (!a.burst) { a.burst = 1; const S = EG_LEGION_KINDS[EG_KIND.shade].blow; egAim(F, spec, { o: a.i, s: [shDisc(a.x, a.z, S.r)], at: now + S.wu, wu: S.wu, p: (D.shades >= 2 ? 0.15 : 0.1) * egShareX(F.c), b: 0, el: null, nm: S.nm }, here, now, out); a.atk = { at: now + S.wu, until: now + S.wu + 200 }; }
          else egGone(F, [a], EG_GONE.crumbled, '', now, out);
          break;
        }
        const m = seen.find((x) => x.sub === a.tg);
        if (m) walkAir(F, spec, a, m.x, m.z, 0.5, K.speed, now, m);
        break;
      }
      default: break;
    }
  }
}

/** AUDIT EG IV (lane1 #12; section 12: "raises the last fallen add of its wave once, a 6 s cast broken by blows"): A BINDER'S
 *  RAISE BROKEN - by the blows that land a tenth of its health in its cast (net/eliteGates/egBrain.js egBlow), or a Spotter's arrow
 *  (egSpotted): the cast ended, its raise SPENT (the claimed body is gone with it), its bar taken down, said. Answers whether a
 *  cast was broken. */
export function egBinderBroken(F, a, out) {
  if (!a?.cast) return false;
  a.cast = null; a.raised = 1;
  if (F.pg.raise?.[0] === a.i) F.pg.raise = null;
  out.push({ k: 'esay', w: 'raisebroken' });
  return true;
}
/**
 * AUDIT EG IV (lane10 #13; section 15) - SPOTTED: a Spotter's arrow from beyond 12 m newly marking add `a` (net/eliteGates/egRun.js
 * egMarkFoe) breaks what it is winding - every blow of its still to land cut (`ecut`, its outline gone from every screen; one
 * the union floor holds dropped), its charge's run with it - and a Binder's raise. Once a mark: a foe spotted is not spotted
 * again while its mark stands. Answers whether anything was broken.
 * @param {any} F @param {any} a @param {number} now @param {any[]} out
 */
export function egSpotted(F, a, now, out) {
  if (!a || a.role !== EG_ROLE.add || !(a.hp > 0) || egHas(a, EG_FL.friend)) return false;
  let broke = false;
  for (const b of F.blows.filter((x) => x.o === a.i && x.at > now)) { egCut(F, b.i, out); broke = true; }
  const held = (F.held ?? []).filter((h) => h.b?.o === a.i);
  if (held.length) { F.held = F.held.filter((h) => !held.includes(h)); broke = true; }
  if (broke) { a.atk = null; a.runTo = null; }
  return egBinderBroken(F, a, out) || broke;
}
/** A DORMANT LURKER WAKES (section 12's ROLE READS): its dormancy lifted, risen over 0.6 s, *Something stirs.* once a hall - at
 *  a member's nearness (egLegionStep) and, AUDIT EG III, at a blow that lands on it (net/eliteGates/egBrain.js egBlow - Spotter's arrows
 *  wake it at any range so). Answers whether it woke. */
export function egLurkerWake(F, a, now, out) {
  if (!a || !egHas(a, EG_FL.dormant)) return false;
  egSetFl(F, a, EG_FL.dormant, false, out);
  a.up = now + 600;
  if (!F.mem.stirred) { F.mem.stirred = 1; out.push({ k: 'esay', w: 'stirs' }); }
  return true;
}
/** EG-ZB (section 8.2): the island (or plate) a body at progress `s` stands on or comes to next along the course - of
 *  `isles`, the nearest whose far edge lies past it; null past the last. THE ASCENT (LAW 9): with its hall's `spec`, each
 *  island's progress is its centre's along THE ROUTE (net/eliteGates/egRoute.js egRouteAlong) and `s` the body's; with none, the
 *  course's z (laws 4-8: the same numbers). */
export function egIsleAhead(isles, s, spec = null) {
  let isle = null, ia = 0;
  for (const d of isles ?? []) {
    const a = spec ? egRouteAlong(spec, d) : d.z;
    if (a + d.r > s && (!isle || a < ia)) { isle = d; ia = a; }
  }
  return isle;
}
/**
 * EG-ZB (section 8.2): A SPAN'S DIVER waits at the island (or plate) the member it follows (`ctx.shadow`, the nearest) stands
 * on or comes to next, circling it EG_DIVER_WAIT_R out through the air, and dives a lane at that member once they stand on
 * it - ground at least EG_DIVE_GROUND_M wide (the Diver's rule) within its lane's reach - at its kind's cadence; never at a
 * platform.
 */
function diverOnSpan(F, view, a, K, now, here, out, ctx, chain, shadow = ctx.shadow ?? here) {
  const m = near(a, shadow)?.m ?? null;
  if (!m) { egStop(F, a, now); return; }
  const isle = egIsleAhead(ctx.isles, egRouteAlong(view, m), view) ?? { t: 'd', x: m.x, z: m.z, r: 0, y: 0 };   // THE ASCENT: ahead along the route
  const on = here.some((q) => q.sub === m.sub) && egGroundAt({ fl: [isle] }, m.x, m.y, m.z, 0.3);
  if (on && 2 * isle.r >= EG_DIVE_GROUND_M && Math.hypot(a.x - m.x, a.z - m.z) <= K.blow.len && now >= (a.next ?? 0)) {
    a.next = now + K.blow.every;
    egStop(F, a, now);
    addBlow(F, view, a, m.x, m.z, now, here, out, { chain });
    return;
  }
  const t = (now / 1000) * 0.6 + a.i;
  walkAir(F, view, a, isle.x + Math.sin(t) * EG_DIVER_WAIT_R, isle.z + Math.cos(t) * EG_DIVER_WAIT_R, 0.5, K.speed, now, isle);   // EG-ZJ: at the island's height
}

/**
 * AN ADD SLAIN by `sub` (`name`): its fall remembered for the Binders, and the decrees on a slaying - Pyre-Bound's burst,
 * Vengeful Shades' shade at the slayer, Kyn's Rally's strength to its wave, Soul-Pools' pool.
 */
export function egAddSlain(F, spec, a, sub, now, here, out, ctx = {}) {
  const D = ctx.decrees ?? {};
  (F.mem.fallen ??= []).push({ k: a.k, x: a.x, z: a.z, wv: a.wv, ...(egByHeight(spec) && Number.isFinite(a.y) ? { y: a.y } : {}) });   // THE ASCENT: the floor it fell on
  if (F.mem.fallen.length > 24) F.mem.fallen.shift();
  if (D.pyre) egAim(F, spec, { o: 0, s: [shDisc(a.x, a.z, D.pyre >= 2 ? 3.5 : 2.5)], at: now + (D.pyre >= 2 ? 1200 : 1000), wu: D.pyre >= 2 ? 1200 : 1000, p: (D.pyre >= 2 ? 0.15 : 0.1) * egShareX(F.c), b: 0, el: 'fire', nm: 'Pyre', y: a.y }, here, now, out);   // THE ASCENT: on the floor it fell on
  if (D.shades && a.k !== EG_KIND.shade && sub) { const s = egLegionRaise(F, [EG_KIND.shade], [spotOf(spec, a)], now, out, {}); if (s[0]) { s[0].tg = sub; s[0].burstAt = now + EG_SHADE_MS; s[0].up = now; } }
  if (D.rally) {
    const x = D.rally >= 2 ? 0.15 : 0.1;
    for (const b of egBodiesOf(F, EG_ROLE.add)) if (b.wv === a.wv && b !== a && (b.rally ?? 0) < 3) { b.rally = (b.rally ?? 0) + 1; const add = Math.round(b.h0 * x); b.max += add; b.hp += add; }
  }
  if (D.soulpools && ctx.pool) ctx.pool(a.x, a.z, D.soulpools >= 2 ? 3.5 : 2.5, now, 8000, 0, 0, null, 'soul', a.y);
}
/** A Kynval squad (section 8.7): four elites in place of a wave, each with one affix - AUDIT EG V (h, A2 NEW-1; section 12): a
 *  mechanic's body, as the Honour Horn's Kynval is (egLegionSummon `need`): all four stand whatever the room the legion's cap
 *  leaves, and count against it after. AUDIT EG III had held it to the room, its first affixes kept - a company of three's
 *  Rampart stood three of the four section 8.7 names (seed 19, Hall 16). */
export function egSquad(F, spots, now, out) {
  return EG_AFFIXES.map((af, j) => {
    const flag = { searing: EG_FL.searing, shielded: EG_FL.shielded, wrathful: EG_FL.wrathful, unshaken: EG_FL.unshaken }[af];
    const [b] = egLegionSummon(F, [EG_KIND.kynval], [spots[j % spots.length]], now, out, { need: 1, fl: EG_FL.elite | flag });
    if (b && af === 'shielded') b.shield = Math.round(b.max / 4);
    return b;
  }).filter(Boolean);
}
/**
 * AUDIT EG V (L2-7; section 8.7: "a shield of a quarter of its health that only blows from behind break") - A SHIELDED ELITE'S
 * SHIELD, one law for a member's blow (net/eliteGates/egBrain.js egBlow) and every host hit the room strikes for it (hostStrike: Sweeping
 * Arc, Bladestorm, Kindled Steel, Deadeye, Spillover): a blow from (px, pz) on add `b` while its shield stands TURNS on its
 * front - nothing lands (egShieldTurns); one from behind lands and the shield takes it first, what it soaks given back to the
 * body's health, its mark dropped as it breaks (egShieldSoak, answering the soak).
 */
export const egShieldTurns = (b, px, pz) => b?.role === EG_ROLE.add && egHas(b, EG_FL.shielded) && (b.shield ?? 0) > 0 && !egFromBehind(b, px, pz);
export function egShieldSoak(F, b, got, out) {
  if (!(got > 0) || b?.role !== EG_ROLE.add || !((b.shield ?? 0) > 0)) return 0;
  const soak = Math.min(b.shield, got);
  b.shield -= soak; b.hp += soak;
  if (b.shield <= 0) egSetFl(F, b, EG_FL.shielded, false, out);
  return soak;
}
/** A body's facing toward the struck pose - a blow from within 60 degrees of behind it (a shield-wall's, a Shielded
 *  elite's law). */
export function egFromBehind(b, px, pz) {
  const yaw = b.yaw ?? 0, at = Math.atan2(px - b.x, pz - b.z);
  return Math.abs(wrapAngle(at - yaw)) > (2 * Math.PI) / 3;
}
/** A blow from within the front 120 degrees. */
export function egFromFront(b, px, pz) {
  const yaw = b.yaw ?? 0, at = Math.atan2(px - b.x, pz - b.z);
  return Math.abs(wrapAngle(at - yaw)) <= Math.PI / 3;
}
