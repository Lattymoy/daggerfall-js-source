// @ts-check
// THE ASCENT (LAW 9, 2026-10-16, Mac: "I just feel like we could do more to utilizing climbing sections, different
// elevations. Something that isnt just a straight line from point A to point B. Like, I want it to feel like you're actually
// traverversing corridors, different rooms, etc. This is just too simple"; bible/11-Multiplayer/Elite-Gates-Ascent.md
// sections 1, 3, 4, 5 and 7): A HALL IS A WAY THROUGH THE TORN ACADEMY - spec law 9's route planner. The hall law
// (net/eliteGates/egLaw.js layHall) hands it the hall's own laying (its closures, its die, its parts) and it lays the hall as a WAY:
// from the arrival plate along legs that turn (along x and z, back on themselves), climb and fall 10-30 m, and pass over and
// under one another, through ROOMS (net/eliteGates/egRoomLaw.js - the academy's rooms as code-built hero records), over BRIDGES and up
// STAIRS between them, round LANDINGS where the way turns, to the door - and the hall's own kind stands along it in COURSES
// (each a stretch laid along +z by the law the laws before laid every hall by: the span generator's runs and islands, its
// passages and set pieces, its decrees and THE FORK; a yard's court, a proving court, the Rampart's walk, the Athenaeum, a
// Deepway's fragments, a Court's lord's ground). A course is laid where it stands as it would be laid anywhere: its shape is
// measured first, laid only to be measured and taken back (the hall's die a tape, played again), and the way to it is planned
// to bring the company to its foot with room for it ahead.
//
// THE PLAN (deterministic, the hall's own): the kind's RECIPE (EG_ASCENT_RECIPES) - its courses and the rooms before, between
// and after them; a HEIGHT PROFILE off the planner's own die (a die of its own - the course's die never feels the plan): the
// way climbs to its height and comes down toward the door's, its whole fall and rise between EG_ASCENT_RISE_CM; each stretch
// between two courses planned as a PROGRAM of legs (a bridge, a stair, a landing that turns, a room entered by one socket and
// left by another) drawn and tried until one stands - every leg's volume EG_ASCENT_APART_CM from every other's but the legs it
// joins (stacked ways each a body's height and a floor apart: section 2's 4 m and more), inside the hall's bound (section 7 -
// EG_ASCENT_BOUND), the next course's whole shape clear ahead of its foot. A hall whose plan finds no way is laid again from
// the next try's dies (net/eliteGates/egLaw.js egHallOf), and the last try's recipe is the plainest.
//
// WHAT IT SAYS (net/eliteGates/egLaw.js says it in metres): THE ROUTE (`route` - nodes, links of section 1's kinds and roads, the main
// way), THE CLIMBS (each room's climb faces), THE VOIDS (where a fall would skip ahead along the way: under a leg the way takes
// earlier, over one it takes later; a room's well where it is taken downward), THE ROOMS (each room's archetype and its
// hero's number). And THE ROUTE'S SANITY (egAscentSane): every link walkable by its own kind's law, the main way connected from
// the plate to the door, crossing itself at most EG_ASCENT_CROSSINGS_MAX times, no longer than EG_ROUTE_LEN_MAX_M and crossed at
// THE SPAN BUILD inside EG_ROUTE_S_MAX.
//
// Pure, integer-exact (centimetres; no transcendental - test/net/eliteGates/egplay_law.test.js's sweep), in the relay's bundle. Not a DFU
// member. Ledger A (ELITE-GATES).
import { egRoomDraw, egRoomPairs, egRoomBuild, egRoomTurned, egRoomBox, egHeadingOf, egTurnFor, egStairRun, egIsqrt, EG_ROOM_NAMES } from './egRoomLaw.js';
import { EG_PASSAGE_KITS, EG_CHAMBER_KITS } from './egFragLaw.js';
import { EG_PEND_REACH, EG_PEND_HALF, egRouteCross } from './egSpanLaw.js';

/** THE HALL'S BOUND (section 7; cm): x within EG_ASCENT_BOUND.x of the hall's origin, z from z0 to z1 (EG_HALL_LEN_MAX), every
 *  floor's height within y - inside the wire's bound about its origin (net/wire.js GATE_COURT_BOUND, 160 m). */
export const EG_ASCENT_BOUND = Object.freeze({ x: 15000, z0: -1000, z1: 15800, y: 6000 });
/** The way's whole height between its lowest and its highest (cm - section 1's "climbs and falls 10-30 m"). */
export const EG_ASCENT_RISE_CM = Object.freeze([1000, 3000]);
/** Every two legs but those that join stand at least this far apart (cm - section 11.5's EG_FRAG_APART_CM), a leg's volume
 *  its floors and a body's headroom over them (EG_ASCENT_HEAD_CM) and what hangs under them: so two ways stacked in plan are a
 *  body's height and a floor apart and more (section 2's 4 m). */
export const EG_ASCENT_APART_CM = 200;
export const EG_ASCENT_HEAD_CM = 450;
/** What hangs under a span's piece (cm - net/eliteGates/egLaw.js EG_HANG_CM, the Hour's roots: nothing of the way stands under a course
 *  within it), under an island or a court's rock, under a bridge or a stair. */
export const EG_ASCENT_HANG_CM = Object.freeze({ step: 2200, disc: 600, band: 300 });
/** At most this many places where the way passes over itself (section 5). */
export const EG_ASCENT_CROSSINGS_MAX = 2;
/** THE ROUTE'S SANITY (this slice's own bound - section 7's "nothing unwalkable"): the main way from the plate to the door at
 *  most this long (m), and crossed at THE SPAN BUILD inside this (s - THE PROOFS' crossing over the route at its median:
 *  net/eliteGates/egSpanLaw.js egRouteCross, every link at its kind's pace and every pair waited for where the way brings a body to it). */
export const EG_ROUTE_LEN_MAX_M = 640;
export const EG_ROUTE_S_MAX = 300;
/** A climb link's foot and top stand at most this far apart in plan (m): its foot before its face, its ledges' setbacks, its top
 *  over its lip. */
export const EG_ROUTE_CLIMB_PLAN_M = 4;
/** How many rooms each kind's way passes through (section 3's "2-5 rooms a hall by kind"), the corridors, switchbacks and
 *  scarps among them. */
export const EG_ASCENT_ROOMS = Object.freeze({ yard: [2, 4], span: [2, 3], proving: [2, 3], rampart: [2, 3], court: [2, 3], athenaeum: [3, 5], deepway: [2, 3], brink: [2, 3], scriptorium: [3, 5] });
/** The hall's fragments' cap under spec law 9 (net/eliteGates/egLaw.js EG_FRAGS_MAX's, rooms counted - section 7: raised as the spec's
 *  size allows, its worst measured under EG_SPEC_SAID_MAX - test/net/eliteGates/law9_rooms.test.js). */
export const EG_ASCENT_FRAGS_MAX = 11;
/** A landing where the way turns (cm - its radius), a bridge between two legs (cm - its least and most), a stair's width. */
export const EG_ASCENT_LANDING_CM = 350;
export const EG_ASCENT_BRIDGE_CM = Object.freeze([500, 1400]);
export const EG_ASCENT_STAIR_HW = 200;
/** How far short of the hall's far bound a course ends (cm): room for the way on from it to go on and turn. */
export const EG_ASCENT_ROOM_ON_CM = 1600;

// EG-PERFECT - SPEC LAW 10, THE BROKEN WAY (2026-10-18, Mac: "Traversing between sections should present a challenge,
// platforming should be detailed"; bible/11-Multiplayer/Elite-Gates-Ascent.md section 8): law 9's way walked 48-69% of
// every hall on bridges, landings and stairs no foe or piece touched (the longest unbroken walk a median 180-390 m). From
// spec law 10 a bridge the way takes along +z, EG_BROKEN_MIN_CM long or more, is BROKEN where it stands clear: its middle
// fallen away and crossed on EG_BROKEN_PIECES of its band's pieces at the Steps' own timing (a gap, a Crumble's plank, a
// Drift, a Beat pair; a Pendulum's weight from the Shade, a Vent from the Deep) - a course of its own (its ground, proven by
// THE TIMED SOLVER where it stands like every course), its pieces off the planner's die so no course's draws move. THE
// FORK's Low Road linked by its own spans past its Drop (the Gale's islands never "a bridge 4.5 m up"); a fight hall's rooms
// all before its trial and its door straight after it (law 9 stood the door 177-243 m past the trial, out of the closing's
// reach); the plan its own tries before the plainest.
/** THE BROKEN WAY's law: the spec law from which a bridge breaks (in every heading), a fight hall's door follows its trial and
 *  the planner has its own tries - the laws before lay as they laid. */
export const EG_BROKEN_LAW = 10;
/** A bridge at least this long breaks (cm), keeping EG_BROKEN_FOOT_CM of bridge at either end to land on and leave from. */
export const EG_BROKEN_MIN_CM = 1000;
export const EG_BROKEN_FOOT_CM = 150;
/** A broken bridge's pieces: the fewest and the most drawn - and THE AUDIT's: a piece more for every EG_BROKEN_PER_CM of its
 *  room past EG_BROKEN_LONG_CM, up to EG_BROKEN_MOST (a 57 m bridge stood walked whole, its one centred break meeting a passage
 *  under its middle). */
export const EG_BROKEN_PIECES = Object.freeze([1, 3]);
export const EG_BROKEN_LONG_CM = 1200;
export const EG_BROKEN_PER_CM = 700;
export const EG_BROKEN_MOST = 6;
/** THE AUDIT: where along its bridge a break is tried (a fraction of the bridge's room left about it - its middle first), each
 *  with its pieces, then with one fewer, down to one, before the bridge is walked whole. */
const EG_BROKEN_SLIDES = Object.freeze([0.5, 0.25, 0.75, 0, 1]);
/** THE AUDIT: an approach's straight run is laid as bridges of at most this (cm), each broken on its own. */
export const EG_BROKEN_SPLIT_CM = 2500;
/** ...and of at least this (cm) where the run allows - a run halved to 13 m left room for one piece. */
export const EG_BROKEN_CHUNK_CM = 1800;
/** THE AUDIT: a break's sway stands this far clear of every leg, those it joins too (cm - a body's radius and a hand). */
const EG_BROKEN_CLEAR_CM = 40;
/** The pieces a broken bridge is crossed on, by band - each at the Steps' own timing (egSpanLaw.js egSpanOf's run). A Gust is
 *  a decree's and a Rail's travel asks room of what stands beside it: neither breaks a bridge. A bridge turned off +z breaks
 *  only onto pieces that keep still (EG_BROKEN_TURNED - a Drift swings across +z, a Pendulum's weight across its gap). */
export const EG_BROKEN_KINDS = Object.freeze([
  Object.freeze(['still', 'crumble', 'drift', 'beat']),
  Object.freeze(['still', 'crumble', 'drift', 'beat']),
  Object.freeze(['still', 'crumble', 'drift', 'beat', 'pend']),
  Object.freeze(['still', 'crumble', 'drift', 'beat', 'pend', 'vent']),
]);
export const EG_BROKEN_TURNED = Object.freeze(['still', 'crumble', 'beat', 'vent']);
/** The fight kinds whose rooms all stand before their trial and whose door follows it (spec law 10). The Rampart's walk keeps
 *  the plate's height (its march's line), so its rooms stay after it; a Court ends on its lord's ground. */
const FIGHT_FIRST = Object.freeze(['yard', 'athenaeum', 'scriptorium', 'proving']);

/** Why the last plans did not stand (a tool's and a test's reading - egAscentWhy; the law reads nothing of it). */
const _why = [];
const why = (w) => { if (_why.length >= 64) _why.shift(); _why.push(w); return null; };
/** The reasons the plans laid since the last ask did not stand (oldest first), and the list emptied. For a tool and a test. */
export const egAscentWhy = () => _why.splice(0, _why.length);
/** A reason a hall's try did not stand, noted for egAscentWhy (net/eliteGates/egLaw.js: THE TIMED SOLVER's, THE ROUTE'S SANITY's). */
export const egAscentNote = (w) => { why(w); };
/** The four headings (0 +z, 1 +x, 2 -z, 3 -x) as unit steps in plan. */
const DIR = Object.freeze([[0, 1], [1, 0], [0, -1], [-1, 0]]);
const between = (r, lo, hi) => lo + Math.floor(r() * (hi - lo + 1));
const half = (v) => Math.trunc(v / 2);

/** THE TAPE: a die whose draws are kept, so a stretch laid only to be measured is laid again with the same draws (`mark`,
 *  `rewind`). Its draws are the die's own, in its order. */
export function egTape(r) {
  const kept = [];
  let i = 0;
  const t = () => { if (i === kept.length) kept.push(r()); return kept[i++]; };
  t.mark = () => i;
  t.rewind = (k) => { i = k; };
  return t;
}

// ── volumes ─────────────────────────────────────────────────────────────────────────────────────────────────────────
/** Are two volumes ([x0, y0, z0, x1, y1, z1], cm) apart: EG_ASCENT_APART_CM across x or z, or one wholly over the other. */
export const egAscentApart = (a, b, M = EG_ASCENT_APART_CM) => a[3] + M <= b[0] || b[3] + M <= a[0] || a[5] + M <= b[2] || b[5] + M <= a[2] || a[4] <= b[1] || b[4] <= a[1];
/** Do two volumes overlap in plan (cm)? */
const overPlan = (a, b) => a[0] < b[3] && b[0] < a[3] && a[2] < b[5] && b[2] < a[5];
/** A volume inside the hall's bound (its plan; the floors' heights are held apart). */
const inBound = (b) => b[0] >= -EG_ASCENT_BOUND.x && b[3] <= EG_ASCENT_BOUND.x && b[2] >= EG_ASCENT_BOUND.z0 && b[5] <= EG_ASCENT_BOUND.z1;
const shift = (b, dx, dy, dz) => [b[0] + dx, b[1] + dy, b[2] + dz, b[3] + dx, b[4] + dy, b[5] + dz];
/** A floor's volume: its plan, what hangs under it and a body's headroom over it. */
const floorVol = (x0, z0, x1, z1, yLo, yHi, hang) => [Math.min(x0, x1), yLo - hang, Math.min(z0, z1), Math.max(x0, x1), yHi + EG_ASCENT_HEAD_CM, Math.max(z0, z1)];

/**
 * THE PARTS' VOLUMES laid since a mark (cm): every disc, band, lane, stair, passage, chamber's wall, hero and span piece of
 * `P` past the counts `n` (and the pieces of `steps` numbered from `i0`). Each `{ b, y }` - its volume and its floor's height.
 * @param {any} P @param {any} n @param {any[]} steps @param {number} i0
 */
function partsVols(P, n, steps, i0) {
  const out = [];
  for (const d of P.discs.slice(n.discs)) out.push({ b: floorVol(d.x - d.r, d.z - d.r, d.x + d.r, d.z + d.r, d.y, d.y, EG_ASCENT_HANG_CM.disc), y: d.y });
  for (const q of P.bands.slice(n.bands)) out.push({ b: floorVol(q.x - q.halfW, q.z0, q.x + q.halfW, q.z1, q.y, q.y, EG_ASCENT_HANG_CM.band), y: q.y });
  for (const l of P.lanes.slice(n.lanes)) out.push({ b: floorVol(Math.min(l.ax, l.bx) - l.hw, Math.min(l.az, l.bz) - l.hw, Math.max(l.ax, l.bx) + l.hw, Math.max(l.az, l.bz) + l.hw, l.y, l.y, EG_ASCENT_HANG_CM.band), y: l.y });
  for (const q of P.ramps.slice(n.ramps)) out.push({ b: floorVol(Math.min(q.ax, q.bx) - q.hw, Math.min(q.az, q.bz) - q.hw, Math.max(q.ax, q.bx) + q.hw, Math.max(q.az, q.bz) + q.hw, q.y0, q.y1, EG_ASCENT_HANG_CM.band), y: q.y0 });
  for (const q of P.caves.slice(n.caves)) out.push({ b: [q.x - q.halfW - 300, Math.min(q.y, q.yB) - 600, q.z0, q.x + q.halfW + 300, Math.max(q.y, q.yB) + Math.max(q.height, 0) + 100, q.z1], y: q.y });
  for (const d of P.deco.slice(n.deco)) if (d.t === 'wall' || d.t === 'tiers') out.push({ b: [d.x - d.r, (d.y ?? 0) - 100, d.z - d.r, d.x + d.r, (d.y ?? 0) + d.h, d.z + d.r], y: d.y ?? 0 }); else if (d.t === 'hall') out.push({ b: [d.x - d.hw, (d.y ?? 0) - 100, d.z0, d.x + d.hw, (d.y ?? 0) + d.h, d.z1], y: d.y ?? 0 }); else if (d.t === 'magma') out.push({ b: [d.x - d.r, (d.y ?? 0) - 100, d.z - d.r, d.x + d.r, (d.y ?? 0) + 150, d.z + d.r], y: d.y ?? 0 });
  for (const q of P.heroes.slice(n.heroes)) { const B = q.rec.box; out.push({ b: [q.x + B[0], q.y + B[1], q.z + B[2], q.x + B[3], q.y + B[4], q.z + B[5]], y: q.y }); }
  for (const s of steps) {
    if (s.i < i0) continue;
    const ax = s.kind === 'drift' || s.kind === 'slag' ? s.amp : s.kind === 'pend' ? Math.round((EG_PEND_REACH + EG_PEND_HALF) * 100) : 0, az = s.kind === 'rail' || s.kind === 'drum' ? s.amp : 0;
    out.push({ b: floorVol(s.x - half(s.w) - ax, s.z - half(s.d) - az - (s.kind === 'pend' ? s.gap : 0), s.x + half(s.w) + ax, s.z + half(s.d) + az, s.y - (s.kind === 'sink' ? 300 : 0), s.y, EG_ASCENT_HANG_CM.step), y: s.y });
  }
  return out;
}
/** The counts of parts `P` holds - a mark partsVols reads from. */
export const egPartsMark = (P) => ({ discs: P.discs.length, bands: P.bands.length, lanes: P.lanes.length, ramps: P.ramps.length, caves: P.caves.length, deco: P.deco.length, heroes: P.heroes.length });

// ── THE RECIPES: each kind's courses and the rooms before, between and after them ─────────────────────────────────────────
/**
 * A KIND'S COURSES (section 1 - "everything the Spire already is ... stands along the new ways"), laid each along +z from where
 * the hall stands (H's X, y, edge - the hall law's own closures), each ending on still ground (an island, a court's far rim, a
 * landing): spec law 8's laying of the kind, cut where the way leaves one course for the next. `courses(H)` answers the list
 * of course layers (each a function of H, laid where the plan brings the company).
 */
/** THE BROKEN WAY (spec law 10): AN APPROACH OF TWO KINDS - `n` pieces in two runs of two of the band's kinds (its whole set,
 *  a Drop aside; the first circle's a Drift and a Beat - law 9 laid its first circle `still` and every later approach of one
 *  kind, its first two), an island between them where `isle` asks (the Court from its sixth circle). */
const APPROACH_NOT = Object.freeze(['drop', 'riser', 'gust']);   // (THE AUDIT: a Gust a decree's piece, laid on its island - drawn after a Crumble run, its push 1 s in 6 met a body that could not wait: THE TIMED SOLVER weighs no gust)
function mixed(H, n, isle = false) {
  const { r, between: bt, c, pieces } = H, pool = pieces.filter((k) => !APPROACH_NOT.includes(k));
  const a = c <= 1 ? 'drift' : pool[bt(r, 0, pool.length - 1)], rest = pool.filter((k) => k !== a), b = c <= 1 ? 'beat' : rest[bt(r, 0, rest.length - 1)];
  const n1 = Math.max(2, n >> 1);
  H.run(a, n1);
  if (isle) H.island();
  H.run(b, Math.max(2, n - n1));
}
const RECIPES = {
  yard: (H) => [() => {
    const { r, between: bt, P } = H, R0 = bt(r, 22, 26) * 100, Hc = H.heroCourtAt(H.get().edge + 400), R = Hc ? Hc.R : R0;
    const zc = H.court(R, 'court', Hc), X = H.get().X;
    if (H.c >= 2 && r() * 3 < 1) H.chamberAt(zc, R);
    const turn = bt(r, -1, 1) * 5, v = H.variant;
    if (v === 'riftyard' || v === 'wellmouth') {
      const ra = v === 'riftyard' ? H.heroRifts(5) : null;
      if (ra) P.rifts.push(...ra);
      else for (const deg of [60, 240, 120, 300, 90]) { const [x, z] = H.polar(X, zc, R - 300, deg + turn); P.rifts.push({ x, z }); }
      if (v === 'wellmouth') for (let k = 0; k < 5; k++) for (const off of [-35, 0, 35]) { const [x, z] = H.polar(X, zc, R - 300, [60, 240, 120, 300, 90][k] + turn + off); H.spot('socket', x, z, { k }); }
    } else if (v === 'wellspring') {
      const [gx, gz] = H.polar(X, zc, half(R) - Math.trunc(R / 6), 0);
      P.rifts.push({ x: gx, z: gz });
      for (const deg of [60, 180, 300]) { const [x, z] = H.polar(X, zc, R - 400, deg + turn); H.spot('anchor', x, z); }
    } else if (v === 'muster') {
      for (const deg of [0, 120, 240]) { const [x, z] = H.polar(X, zc, R - 500, deg + turn); H.spot('rally', x, z); }
    } else if (v === 'holdfast') {
      H.spot('relic', X, zc, { r: 600 });
      const ra = H.heroRifts(5);
      if (ra) P.rifts.push(...ra);
      else for (const deg of [60, 180, 300, 120, 240]) { const [x, z] = H.polar(X, zc, R - 300, deg + turn); P.rifts.push({ x, z }); }
    }
  }],
  span: (H) => {
    const { r, between: bt, c, bnd, plain, pieces } = H, extra = H.gale + H.crumbling;
    const two = c <= 1 ? ['drift', 'beat'] : [pieces[bt(r, 0, pieces.length - 1)], pieces[bt(r, 0, pieces.length - 1)]];
    const set = plain ? null : H.setPieceOf(c, 'span', bnd);
    const first = () => {
      H.run(two[0], set ? 2 : extra >= 2 ? 2 : extra > 0 ? 3 : c <= 1 ? 5 : bt(r, 3, 4));
      H.crumbleTwo(); H.island();
      if (!set && (c <= 2 || r() < 0.5)) { H.cave(); H.island(bt(r, 200, 260)); }
    };
    // (THE BROKEN WAY - spec law 10: the fork's course first, where the hall's bound has room for its length - a deep span's
    // runs 110-120 m, and law 9 found it no foot past its first course in most of its deep halls - its first run after it; THE
    // AUDIT: the plan's own tries - `lean` - lay it after its first run again, as law 9 did, before the plainest takes its fork)
    if (c >= 2 && !plain && !set) return H.law >= EG_BROKEN_LAW && !H.lean ? [() => { H.fork(two, extra); H.meet(); }, first] : [first, () => { H.fork(two, extra); H.meet(); }];
    return [first, () => {
      if (set) { H.setPiece(set, extra > 0); H.island(bt(r, 200, 260)); }
      if (!(set && extra > 0)) H.run(two[1], set ? 2 : extra >= 2 ? 2 : extra > 0 ? 3 : c <= 1 ? 5 : bt(r, 3, 4));
      H.decreeSections();
      // (THE BROKEN WAY - spec law 10: its Reliquary Vault off the course's last island's side, its side span from that island's
      // rim - law 9 began it on the course's last piece, its lane over a timed step's gap)
      if (H.twist === 'vault' && H.law >= EG_BROKEN_LAW) { const zi = H.island(), { X, y } = H.get(), vx = X + 900; H.lane(X + H.ISLE_R - 50, zi, vx - 350, zi, H.BRIDGE_HALF, 'side', y); H.disc(vx, zi, 350, 'vault', y); H.spot('vault', vx, zi); return; }
      if (H.twist === 'vault') { const { X, y, edge } = H.get(); const [vx, vz] = [X + 900, edge - 300]; H.lane(X, edge - 300, vx, vz, H.BRIDGE_HALF, 'side', y); H.disc(vx, vz, 350, 'vault', y); H.spot('vault', vx, vz); }
      H.island();
    }];
  },
  proving: (H) => {
    const { r, between: bt, c, pieces } = H, extra = H.gale + H.crumbling;
    let walled = false;   // THE BROKEN WAY: a chamber's ring about its court (its Vault then stands off the second span's island)
    return [() => {
      if (H.law >= EG_BROKEN_LAW) mixed(H, extra >= 2 ? 3 : extra > 0 ? 4 : bt(r, 5, 7));   // THE BROKEN WAY: two of its band's kinds
      else H.run(c <= 1 ? 'still' : pieces[bt(r, 0, 1)], extra >= 2 ? 3 : extra > 0 ? 4 : bt(r, 4, 6));
      if (extra > 0) H.crumbleTwo();
      const g = H.gap(), { edge, y, X } = H.get(), Hc = H.heroCourtAt(edge + g), R = Hc ? Hc.R : 1400, zc = Hc ? Hc.zc : edge + g + R;
      if (!Hc) { H.disc(X, zc, R, 'court', y); H.flD(X, zc, R, y); }
      if (c >= 2 && r() * 3 < 1) { H.chamberAt(zc, R); walled = true; }
      H.P.foe = { x: X, z: zc + 400 };
      for (const deg of [0, 120, 240]) { const [x, z] = H.polar(X, zc, 900, deg + 60); H.spot('standard', x, z); }
      H.set({ edge: Hc ? Hc.z0 + Hc.L : zc + R });
      // (THE BROKEN WAY - spec law 10: the Proving Walk's Vault a side span's length off the court's rim, taken only by leaving the
      // fight - law 9 stood it 2 m off the rim behind a lane laid inside the court: taken mid-fight, through a chamber's wall)
      if (H.twist === 'vault' && H.law >= EG_BROKEN_LAW) { if (!walled && !Hc) { const vx = X - R - 1250; H.lane(X - R + 50, zc, vx + 350, zc, H.BRIDGE_HALF, 'side', y); H.disc(vx, zc, 350, 'vault', y); H.spot('vault', vx, zc); } }
      else if (H.twist === 'vault') { const [vx, vz] = [X - 900, zc]; H.lane(X - R, zc, vx - 350, vz, H.BRIDGE_HALF, 'side', y); H.disc(vx - 700, vz, 350, 'vault', y); H.spot('vault', vx - 700, vz); }
    }, () => {
      if (extra > 0) H.decreeSections();
      else if (H.law >= EG_BROKEN_LAW) mixed(H, bt(r, 4, 6));
      else H.run(c <= 1 ? 'drift' : pieces[bt(r, 0, 2)], bt(r, 4, 6));
      const zi = H.island();
      // (a walled court's Vault off the second span's last island, as a fork's stands off its island)
      if (H.twist === 'vault' && H.law >= EG_BROKEN_LAW && walled) { const { X, y } = H.get(), vx = X - 900; H.lane(X - H.ISLE_R + 50, zi, vx + 350, zi, H.BRIDGE_HALF, 'side', y); H.disc(vx, zi, 350, 'vault', y); H.spot('vault', vx, zi); }
    }];
  },
  rampart: (H) => [() => H.rampart()],
  athenaeum: (H) => {
    const { r, between: bt, c, pieces } = H;
    return [() => {
      if (H.law >= EG_BROKEN_LAW) mixed(H, bt(r, 4, 5)); else H.run(c <= 1 ? 'still' : pieces[bt(r, 0, 1)], bt(r, 3, 4));
      const { edge, y, X } = H.get(), R = 1600, zc = edge + H.gap() + R;
      H.disc(X, zc, R, 'court', y); H.flD(X, zc, R, y);
      H.chamberAt(zc, R, null);
      H.spot('orrery', X, zc);
      for (const deg of [30, 90, 150, 210, 270, 330]) { const [x, z] = H.polar(X, zc, 1100, deg); H.spot('stone', x, z); }
      H.set({ edge: zc + R });
    }];
  },
  deepway: (H) => {
    const { r, between: bt, c, bnd, plain } = H;
    return [() => {
      H.cave();
      const { edge, y, X } = H.get(), Hc = H.heroCourtAt(edge + 400), R = Hc ? Hc.R : 1600, zc = Hc ? Hc.zc : edge + 400 + R;
      H.band(edge - H.back(), Hc ? Hc.z0 : edge + 450, H.BRIDGE_HALF, 'bridge', y);
      if (!Hc) { H.disc(X, zc, R, 'court', y); H.flD(X, zc, R, y); }
      H.chamberAt(zc, R);
      const obj = bt(r, 0, 2);
      H.spot('chamber', X, zc, { obj });
      const ra = obj === 0 ? H.heroRifts(3) : null;
      if (ra) H.P.rifts.push(...ra);
      else if (obj === 0) for (const deg of [60, 180, 300]) { const [x, z] = H.polar(X, zc, R - 300, deg); H.P.rifts.push({ x, z }); }
      else if (obj === 1) H.P.foe = { x: X, z: zc + 400 };
      else H.spot('engine', X, zc);
      H.spot('niche', X + R - 200, zc);
      H.set({ edge: Hc ? Hc.z0 + Hc.L : zc + R });
    }, () => {
      const set = plain ? null : H.setPieceOf(c, 'deepway', bnd);
      const { edge, y } = H.get();
      H.band(edge - H.back(), edge + 300, H.BRIDGE_HALF, 'bridge', y); H.set({ edge: edge + 300 });
      if (set) { H.setPiece(set); H.island(bt(r, 200, 260)); } else H.shaft();
      H.cave();
      H.island();
    }];
  },
  brink: (H) => {
    const { r, between: bt, c, bnd, pieces } = H;
    const two = [pieces[bt(r, 0, pieces.length - 1)], pieces[bt(r, 0, pieces.length - 1)]];
    const set = H.plain ? null : H.setPieceOf(c, 'brink', bnd);
    return [() => { H.run('still', 2); H.island(); H.cave(H.FRAG_KITS[Math.max(0, bnd - 1)]); H.island(bt(r, 200, 260)); }, () => {
      H.run(two[0], 3); H.island();
      if (set) H.setPiece(set); else H.cave(H.FRAG_KITS[bnd]);
      if (set === 'sinking') H.set({ y: H.get().y - H.SINK_LOW });
      H.island(bt(r, 200, 260)); H.run(two[1], 2); H.island();
    }];
  },
  scriptorium: (H) => [() => {
    H.run('still', 3);
    const { edge, y, X } = H.get(), R = 1200, zc = edge + H.gap() + R;
    H.disc(X, zc, R, 'court', y); H.chamberAt(zc, R, null);
    H.spot('niche', X, zc);
    H.set({ edge: zc + R });
  }],
  court: (H) => [() => {
    const { r, between: bt, c, pieces } = H;
    if (H.law >= EG_BROKEN_LAW) mixed(H, bt(r, 5, 7), c >= 6); else H.run(c <= 1 ? 'still' : pieces[bt(r, 0, 1)], bt(r, 3, 5));
    H.set({ edge: H.get().edge + H.gap() });
    H.layGround(H.lordGround());
  }],
};
/** The kinds a court's lord's ground is its course's end (no door: the route ends on the ground's heart). */
const NO_DOOR = Object.freeze(['court']);

/** The rooms each course is passed between (section 3 - before the first, between two, after the last), by kind, as the
 *  share of the kind's count each stretch takes, and the rooms each stretch prefers to be (archetypes, in the plan's bag). */
const BAGS = Object.freeze({
  climb: Object.freeze(['tower', 'stair', 'switchback', 'scarp', 'gallery', 'crossing', 'undercroft']),
  fall: Object.freeze(['tower', 'stair', 'switchback', 'gallery', 'undercroft', 'crossing', 'corridor']),
  level: Object.freeze(['cloister', 'broken', 'corridor', 'crossing', 'undercroft', 'scarp', 'gallery']),
});

// ── THE PLAN ────────────────────────────────────────────────────────────────────────────────────────────────────────────
/**
 * THE ASCENT LAID (spec law 9): hall `H` (net/eliteGates/egLaw.js layHall's own laying - see there) laid as a way through the torn
 * academy. Answers the plan's record (`{ nodes, links, legs, vols, climbs, wells, rooms, segs, crossings }`, cm) - or null where
 * no plan stands (the hall is laid again from its next try).
 * @param {any} H
 */
export function egAscentLay(H) {
  const { P, rp, kind } = H;
  const W = { nodes: [[0, 0, 0]], links: [], legs: 0, vols: [{ b: floorVol(-500, -500, 500, 500, 0, 0, EG_ASCENT_HANG_CM.disc), leg: 0, y: 0, kind: 'plate' }], climbs: [], wells: [], rooms: [], segs: [], legKind: ['plate'] };
  const courses = RECIPES[kind](H);
  const L10 = H.law >= EG_BROKEN_LAW, front = L10 && FIGHT_FIRST.includes(kind);
  // (THE BROKEN WAY - spec law 10: the plan's own tries past EG_RELAY_MAX `lean` - the kind's fewest rooms, never the deep
  // profile - its courses whole)
  const [lo, hi] = EG_ASCENT_ROOMS[kind], nRooms = H.plain || H.lean ? lo : between(rp, lo, hi);
  // the height profile: up to its height and back toward the door's - a hall in three climbs and comes down (one in four
  // goes down first into the deep and up again)
  const deep = rp() < 0.25 && kind !== 'rampart' && !H.lean;
  const peak = between(rp, 12, 26) * 100 * (deep ? -1 : 1), door = deep ? -between(rp, 0, 6) * 100 : between(rp, 2, 8) * 100;
  // the stretches: before the first course, between each two, after the last - the rooms spread over them. THE BROKEN WAY
  // (spec law 10): a fight hall's all before its first course - the way climbs to its trial, and its door follows it
  const stretches = courses.length + 1, share = Array(stretches).fill(0);
  for (let k = 0; k < nRooms; k++) share[kind === 'rampart' ? stretches - 1 : front ? 0 : between(rp, 0, stretches - 1)]++;   // the Rampart's walk stands off the plate (its march's line, x 0 and y 0)
  if (NO_DOOR.includes(kind) && share[stretches - 1]) { share[0] += share[stretches - 1]; share[stretches - 1] = 0; }
  // the target height at each course's foot and the door: the peak reached by the middle of the way (THE BROKEN WAY: a fight
  // hall's trial at its peak, and the way on from it level - its door where its trial ends)
  const targets = [];
  // (the Rampart's walk keeps the plate's height, so its one stretch after climbs to the peak and its door stands there)
  for (let k = 0; k < stretches; k++) targets.push(front ? (k === 0 ? peak : null) : k === stretches - 1 ? (kind === 'rampart' ? peak : door) : courses.length === 1 ? peak : Math.trunc((peak * (k + 1)) / courses.length));
  let port = { x: 0, y: 0, z: 500, h: 0 }, tail = 0;
  for (let k = 0; k <= courses.length; k++) {
    const last = k === courses.length;
    // the next course's shape, measured where the hall stands and taken back (its draws kept on the tape)
    const shape = last ? null : measure(H, courses[k]);
    if (!last && !shape) return why(`course ${k}: laid nothing`);
    const need = last ? (NO_DOOR.includes(kind) ? null : doorShape()) : shape;
    if (need) {
      let plan = stretch(H, W, port, share[k], (targets[k] ?? port.y) - (shape?.dy0 ?? 0), need, (k === 0 || front) && share[k] === 0);
      // (THE BROKEN WAY: a stretch whose rooms find no room planned again with one fewer, down to none - the hall keeps its
      // courses; law 9 laid the whole hall again, and past its tries the plainest)
      for (let less = share[k] - 1; !plan && L10 && less >= 0; less--) plan = stretch(H, W, port, less, (targets[k] ?? port.y) - (shape?.dy0 ?? 0), need, (k === 0 || front) && less === 0);
      if (!plan) return why(`stretch ${k} (${share[k]} rooms toward ${targets[k]} from ${JSON.stringify(port)}): no program stands - ${W.fails ? Object.entries(W.fails).map(([a, b]) => `${a} ${b}`).join(', ') : ''}`);
      W.part = (W.part ?? 0) + 1;
      for (const leg of plan.legs) commit(H, W, leg);
      port = plan.end;
    }
    if (last) break;
    // the course, laid where the way brings the company
    const at = layCourse(H, W, courses[k], port, shape, NO_DOOR.includes(kind) && k === courses.length - 1);
    if (!at) return why(`course ${k}: not laid at ${JSON.stringify(port)}`);
    port = at;
  }
  return finish(H, W);
}

/** A COURSE'S PORCH (cm): the half-width and the depth past its end kept clear where it is placed, so the way on leaves it. */
export const EG_ASCENT_PORCH_CM = Object.freeze({ w: 800, d: 1200 });
/** The door's shape: a bridge on and the end plate (its door along +z). */
const doorShape = () => ({ door: 1, vols: [], len: 1600, dy0: 0 });

/**
 * A COURSE MEASURED (section 1's plan): course `fn` laid from where the hall stands now at (0, 0, 0) - X, y and edge set there -
 * its volumes read and everything it laid taken back (the parts, the span generator, the hall's places, the die's tape).
 * `{ vols, dx, dy, dz, dy0 }` relative to its foot (its end where the next stretch begins), or null where it laid nothing.
 * @param {any} H @param {() => void} fn
 */
function measure(H, fn) {
  const snap = H.snap(), n = egPartsMark(H.P), i0 = H.S.save().n;
  H.set({ X: 0, y: 0, edge: 0, road: 0, xRoad: 0 }); H.S.floor(0);
  fn();
  const end = H.get();
  const vols = partsVols(H.P, n, H.S.lay(), i0).map((v) => ({ b: v.b, y: v.y }));
  H.undo(snap);
  if (!vols.length) return null;
  // and its porch: the ground past its end the next stretch leaves by (straight on and a landing's turn either way), kept clear
  // where the course is placed - never laid
  vols.push({ b: [end.X - EG_ASCENT_PORCH_CM.w, end.y - EG_ASCENT_HANG_CM.disc, end.edge, end.X + EG_ASCENT_PORCH_CM.w, end.y + EG_ASCENT_HEAD_CM, end.edge + EG_ASCENT_PORCH_CM.d], y: end.y });
  return { vols, dx: end.X, dy: end.y, dz: end.edge, dy0: 0 };
}
/** A course laid for real at `port` (heading +z): its volumes as one leg, its route's nodes and links (its islands and its
 *  floors along it), the place its end leaves the way at. The Court's (`fin` - the hall's last, no door after it): its way
 *  ends on its lord's ground, on its line, never past it at the course's far edge. */
function layCourse(H, W, fn, port, shape, fin = false) {
  if (port.h !== 0) return null;
  const n = egPartsMark(H.P), i0 = H.S.save().n, nf = H.P.frags.length, ni = H.P.islands.length;
  H.set({ X: port.x, y: port.y, edge: port.z, road: 0, xRoad: 0 }); H.S.road(0); H.S.floor(port.y);
  fn();
  const end = H.get();
  if (end.X !== port.x + shape.dx || end.y !== port.y + shape.dy || end.edge !== port.z + shape.dz) return null;   // a course stands as it was measured
  // its foe, its lord's wake ring and its rifts at its ground's height (section 2 - a court's, a yard's, a lord's ground: the
  // height its course ends at), where the law laying them named none
  if (H.P.foe && H.P.foe.y == null) H.P.foe.y = end.y;
  if (H.P.ring && H.P.ring.y == null) H.P.ring.y = end.y;   // the lord's wake ring on its ground's floor (net/eliteGates/egBrain.js ringWake reads it by height)
  for (const q of H.P.rifts) if (q.y == null) q.y = end.y;
  const leg = ++W.legs;
  const vols = partsVols(H.P, n, H.S.lay(), i0);
  W.part = (W.part ?? 0) + 1;
  for (const v of vols) { if (!inBound(v.b) || Math.abs(v.y) > EG_ASCENT_BOUND.y) return null; W.vols.push({ b: v.b, leg, y: v.y, kind: 'course', part: W.part }); }
  W.legKind[leg] = 'course';
  // its route: along its line, a node at each island of the main road (and the fork's Low Road's own nodes), and its end
  const steps = H.S.lay().filter((s) => s.i >= i0);
  const g = fin ? H.P.ring ?? H.P.foe ?? null : null, onLine = !!g && g.x === port.x && g.z > port.z && g.z < end.edge;
  const isl = H.P.islands.slice(ni).filter((q) => (q.road ?? 0) === 0 && (!onLine || q.z < g.z));
  const pts = [...isl.map((q) => [q.x, q.y, q.z]), onLine ? [g.x, end.y, g.z] : [end.X, end.y, end.edge]].sort((a, b) => a[2] - b[2]);
  let from = W.tail ?? 0;
  for (const p of pts) {
    if (p[2] <= W.nodes[from][2] && p !== pts[pts.length - 1]) continue;
    const z0 = W.nodes[from][2], z1 = p[2], hasStep = steps.some((s) => (s.road ?? 0) === 0 && s.z > z0 && s.z < z1);
    from = link(W, from, node(W, p), hasStep ? 'span' : 'walk', 0);
  }
  const fork = H.P.fork;
  if (fork && !W.forked) {
    // THE FORK (section 5's general case): the Low Road its own way from the fork's island to the meeting
    W.forked = 1;
    const fz = fork.z, f = W.nodes.findIndex((q) => q[0] === port.x && Math.abs(q[2] - fz) <= 400);
    const isl1 = H.P.islands.filter((q) => q.road === 1);
    let a = f >= 0 ? f : nearestNode(W, [port.x, fork.y, fz]);
    // (THE BROKEN WAY - spec law 10: its first island across by its bridge, every later one - past its Drop, its passage, a
    // Gale's islands - by its own span; law 9 named them all bridges, and THE ROUTE'S SANITY refused "a bridge 4.5 m up" on
    // every Gale-Swept fork: 89-98% of them fell to the plainest)
    const L10 = H.law >= EG_BROKEN_LAW;
    for (const [n, q] of isl1.entries()) a = link(W, a, node(W, [q.x, q.y, q.z]), L10 && n > 0 ? 'span' : 'bridge', 1);
    const meet = nearestNode(W, [port.x, fork.yLow, fork.plate]);
    // its courses' last piece onto its bridge's foot (the Low Road's own line), and that bridge to the end plate - where the
    // ground stands (the real motor walks it: tools/egSpanSolve.mjs)
    const lb = H.P.lanes.find((l) => l.role === 'bridge' && l.ax === fork.lowX && l.bz === fork.plate);
    if (lb) {
      link(W, a, node(W, [fork.lowX, fork.yLow, lb.az]), 'span', 1);
      link(W, W.nodes.length - 1, node(W, [lb.bx, fork.yLow, lb.bz]), 'bridge', 1);
    } else link(W, a, node(W, [fork.lowX, fork.yLow, fork.plate - 600]), 'span', 1);
    link(W, W.nodes.length - 1, meet, 'bridge', 1);
  }
  W.tail = from;
  // the course's own ground (its plan and its floors' heights): where its pieces stand, read by THE TIMED SOLVER course by
  // course (net/eliteGates/egLaw.js egAscentCourses) and by the ground after each run
  const ext = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
  for (const v of vols) { ext[0] = Math.min(ext[0], v.b[0]); ext[3] = Math.max(ext[3], v.b[3]); ext[2] = Math.min(ext[2], v.b[2]); ext[5] = Math.max(ext[5], v.b[5]); ext[1] = Math.min(ext[1], v.y); ext[4] = Math.max(ext[4], v.y); }
  W.segs.push({ leg, x: port.x, y: port.y, z0: ext[2], z1: ext[5], x0: ext[0], x1: ext[3], y0: ext[1], y1: ext[4], frags: H.P.frags.length - nf });
  return { x: end.X, y: end.y, z: end.edge, h: 0 };
}
const node = (W, p) => { W.nodes.push([p[0], p[1], p[2]]); return W.nodes.length - 1; };
/** A link of the way from node a to node b: its kind and road, its length (cm, its plan and its height), whether it is taken
 *  only from a to b (a drop, a climb), a climb link's climb (its number in the plan's `climbs`). Answers b. */
function link(W, a, b, kind, road, one = 0, climb = -1) {
  const p = W.nodes[a], q = W.nodes[b], dx = q[0] - p[0], dy = q[1] - p[1], dz = q[2] - p[2];
  W.links.push({ a, b, kind, road, len: kind === 'climb' || kind === 'drop' ? Math.abs(dy) + egIsqrt(dx * dx + dz * dz) : egIsqrt(dx * dx + dy * dy + dz * dz), one, ...(climb >= 0 ? { climb } : {}) });
  return b;
}
const nearestNode = (W, p) => { let k = 0, bd = Infinity; W.nodes.forEach((q, i) => { const d = (q[0] - p[0]) ** 2 + (q[1] - p[1]) ** 2 + (q[2] - p[2]) ** 2; if (d < bd) { bd = d; k = i; } }); return k; };

// ── THE STRETCH: from one course's end to the next one's foot ───────────────────────────────────────────────────────────
/** THE GRID the way is planned on (cm - a cell; the way's least run between two landings, in cells, and from its start; what a
 *  turn costs and a cell over or under a leg already laid), and how many feet a stretch weighs, how many programs it draws at
 *  each, how many rooms' candidates it weighs at each room. */
export const EG_APPROACH = Object.freeze({ cell: 400, run: 3, first: 2, turn: 2, over: 3, rounds: 6, pops: 40000 });
/** THE BROKEN WAY (spec law 10): the approach comes into a course's foot along +z at least this many cells from its last
 *  landing - a run long enough to break (EG_BROKEN_MIN_CM and more); law 9's came in two. */
export const EG_BROKEN_RUN = 5;
export const EG_ASCENT_FEET = 8;
export const EG_ASCENT_DRAWS = 6;
export const EG_ASCENT_ROOM_CANDS = 16;
/**
 * A STRETCH PLANNED (section 1): from `port` through `rooms` rooms toward height `toY`, to a FOOT where `need` (the next
 * course's measured shape, or the door's) stands clear heading +z. The foot is chosen first (feetOf: fresh ground, the courses
 * low along +z so each runs its length and the way comes back down the hall to the next - the serpentine); each room is the
 * best of EG_ASCENT_ROOM_CANDS drawn (a way to it - a bridge, a stair toward the height, a landing that turns - and the room
 * entered by one socket and left by another), the nearest the foot it leaves the way; a stair toward the height; THE APPROACH
 * (A* over the hall's grid) to the foot. `{ legs, end, cross }`, or null.
 * @param {any} H @param {any} W @param {any} port @param {number} rooms @param {number} toY @param {any} need @param {boolean} direct
 */
function stretch(H, W, port, rooms, toY, need, direct) {
  const rp = H.rp;
  W.fails = {};
  if (direct && rooms === 0 && port.h === 0) {
    // (THE BROKEN WAY: a fight hall's door straight on from its trial's end, where its bridge and plate stand clear)
    const ahead = need.door ? doorLeg(port).vols : need.vols.map((v) => shift(v.b, port.x, port.y, port.z));
    if ((need.door || port.z + need.dz + EG_ASCENT_ROOM_ON_CM <= EG_ASCENT_BOUND.z1) && ahead.every((v) => inBound(v) && W.vols.every((q) => q.leg === W.legs || egAscentApart(v, q.b)))) return { legs: [], end: port, cross: 0 };
  }
  const feet = feetOf(W, need, port, rp, rooms);
  if (!feet.length) { W.fails.feet = 1; return null; }
  for (const foot of feet) for (let t = 0; t < (H.plain ? 3 * EG_ASCENT_DRAWS : EG_ASCENT_DRAWS); t++) {
    const prog = program(H, W, port, rooms, toY, need, foot);
    if (prog) return prog;
  }
  return null;
}
/**
 * THE FEET a course (or the door) may stand at (section 1's plan): cells of the hall's grid where its whole plan, a margin
 * about it, stands on fresh ground - no leg laid over it or under it - inside the bound, its end EG_ASCENT_ROOM_ON_CM short of the
 * far bound; a course's feet low along +z first and near across x (the serpentine), the door's near the way's end - the planner's
 * die between near equals. `[{ x, z }]`, the best EG_ASCENT_FEET.
 */
function feetOf(W, need, port, rp, rooms) {
  const C = EG_APPROACH.cell, B = EG_ASCENT_BOUND, M = EG_ASCENT_APART_CM;
  const i0 = -Math.floor((port.x + B.x) / C), i1 = Math.floor((B.x - port.x) / C), j0 = -Math.floor((port.z - B.z0) / C), j1 = Math.floor((B.z1 - port.z) / C);
  const NI = i1 - i0 + 1, NJ = j1 - j0 + 1, occ = new Uint8Array(NI * NJ);
  for (const q of W.vols) {
    const b = q.b, a0 = Math.max(i0, Math.floor((b[0] - M - port.x) / C)), a1 = Math.min(i1, Math.ceil((b[3] + M - port.x) / C)), c0 = Math.max(j0, Math.floor((b[2] - M - port.z) / C)), c1 = Math.min(j1, Math.ceil((b[5] + M - port.z) / C));
    for (let i = a0; i <= a1; i++) for (let j = c0; j <= c1; j++) occ[(i - i0) * NJ + (j - j0)] = 1;
  }
  // the ground held, summed (a cell's count the held cells below and before it), so a rectangle of it is read at once
  const sum = new Int32Array((NI + 1) * (NJ + 1));
  for (let a = 0; a < NI; a++) for (let c = 0; c < NJ; c++) sum[(a + 1) * (NJ + 1) + c + 1] = occ[a * NJ + c] + sum[a * (NJ + 1) + c + 1] + sum[(a + 1) * (NJ + 1) + c] - sum[a * (NJ + 1) + c];
  // the shape's plan, its boxes' cells about its foot (a door: its bridge and its plate)
  const shape = need.door ? doorLeg({ x: 0, y: 0, z: 0, h: 0 }).vols : need.vols.map((v) => v.b);
  const rects = shape.map((b) => [Math.floor(b[0] / C), Math.ceil(b[3] / C), Math.floor(b[2] / C), Math.ceil(b[5] / C)]);
  const free = (i, j) => rects.every(([a0, a1, c0, c1]) => {
    const p0 = i + a0 - i0, p1 = i + a1 - i0 + 1, q0 = j + c0 - j0, q1 = j + c1 - j0 + 1;
    if (p0 < 0 || q0 < 0 || p1 > NI || q1 > NJ) return false;
    return sum[p1 * (NJ + 1) + q1] - sum[p0 * (NJ + 1) + q1] - sum[p1 * (NJ + 1) + q0] + sum[p0 * (NJ + 1) + q0] === 0;
  });
  const out = [];
  for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
    const x = port.x + i * C, z = port.z + j * C;
    if (!need.door && z + need.dz + EG_ASCENT_ROOM_ON_CM > B.z1) continue;
    if (z - (EG_APPROACH.run + 1) * C < B.z0) continue;   // the way into its foot along +z inside the bound
    if (!free(i, j)) continue;
    // the rooms' room: a foot about as far off as the rooms between want (each some 25 m of the way)
    const far = Math.abs(x - port.x) + Math.abs(z - port.z), want = 1200 + rooms * 2600;
    out.push({ x, z, s: Math.abs(far - want) * 0.7 + (need.door ? 0 : (z - B.z0) * 0.5) + rp() * 1600 });
  }
  out.sort((a, b) => a.s - b.s);
  return out.slice(0, EG_ASCENT_FEET);
}
/** A PROGRAM (section 1): the legs from `port` to `foot` - its rooms, a stair toward its height, its approach - each checked
 *  as it is drawn; null where one does not stand. */
function program(H, W, port, rooms, toY, need, foot) {
  const rp = H.rp, legs = [], placed = [], kinds = [];
  let cur = port;
  const used = new Set(W.rooms.map((q) => q.k));
  // a leg stands apart from every volume but those it joins: the leg before it (or the leg laid last before the program, for its
  // first), and the leg before that where the one between is a landing (a turn's two ways meet at its rim)
  const fitsAll = (vols, extra = [], extraK = []) => {
    const chain = [...placed, ...extra], ck = [...kinds, ...extraK], n = chain.length;
    const joined = (m) => m === n - 1 || (m === n - 2 && ck[n - 1] === 'landing');
    const adjW = n === 0 || (n === 1 && ck[0] === 'landing');
    // (THE AUDIT: a broken bridge's break - its pieces' sway - a body's width clear of the very leg it joins: a room laid on from
    // its far foot stood its wall in a Drift's swing)
    const near = (v, b, j) => (j ? !b.brk || egAscentApart(v, b, EG_BROKEN_CLEAR_CM) : egAscentApart(v, b));
    return vols.every((v) => inBound(v) && W.vols.every((q) => near(v, q.b, adjW && q.leg === W.legs)) && chain.every((pv, m) => pv.every((b) => near(v, b, joined(m)))));
  };
  const fail = (k) => { W.fails[k] = (W.fails[k] ?? 0) + 1; return false; };
  const take = (leg) => {
    if (!leg) return fail('none');
    if (!fitsAll(leg.vols)) return fail(leg.vols.every(inBound) ? `meets:${leg.kind}` : `bound:${leg.kind}`);
    legs.push(leg); placed.push(leg.vols); kinds.push(leg.kind); cur = leg.end; return true;
  };
  const toFoot = (p) => Math.abs(foot.x - p.x) + Math.abs(foot.z - p.z);
  // the foot's own ground and the way into it from -z: no room nor its way stands within a landing's reach of them, in plan
  const keepOff = (need.door ? doorLeg({ x: 0, y: 0, z: 0, h: 0 }).vols : need.vols.map((v) => v.b)).map((b) => shift(b, foot.x, 0, foot.z));
  keepOff.push([foot.x - 200, 0, foot.z - 3 * EG_APPROACH.cell, foot.x + 200, 0, foot.z]);
  const offFoot = (vols) => vols.every((v) => keepOff.every((b) => v[3] + 300 <= b[0] || b[3] + 300 <= v[0] || v[5] + 300 <= b[2] || b[5] + 300 <= v[2]));
  // THE BROKEN WAY (spec law 10): a bridge broken (in any heading) where its break stands apart from everything but the legs it joins (the
  // chain before it), else whole
  // (THE AUDIT: and its break - a swinging piece's sway - a body's width clear even of the legs it joins: a Drift's swing came
  // within a centimetre of a room's wall reached through a landing, never tested)
  const clear = (v, extra = []) => W.vols.every((q) => egAscentApart(v, q.b, EG_BROKEN_CLEAR_CM)) && [...placed, ...extra].every((pv) => pv.every((b) => egAscentApart(v, b, EG_BROKEN_CLEAR_CM)));
  const brk = (leg, chainV = [], chainK = [], off = true) => {
    const b = leg ? breakLeg(H, leg, (vols) => fitsAll(vols, chainV, chainK) && clear(vols[1], chainV) && (!off || offFoot(vols))) : null;
    return b ?? leg;
  };
  for (let k = 0; k < rooms; k++) {
    // the room's candidates: a way to it and the room, each drawn - of those that stand, the nearest the foot (the die between)
    let best = null;
    for (let c = 0; c < EG_ASCENT_ROOM_CANDS; c++) {
      // the way to it: a stair toward the height, a bridge, or a bridge and a landing that turns toward the foot (never a turn
      // off the ground it leaves, beside it)
      const left = toY - cur.y, pick = rp(), run = between(rp, EG_ASCENT_BRIDGE_CM[0] / 100, EG_ASCENT_BRIDGE_CM[1] / 100) * 100;
      const lead = [];
      if (pick < 0.3 && Math.abs(left) > 250) lead.push(stairLeg(cur, Math.sign(left) * Math.min(Math.abs(left), between(rp, 3, 6) * 100)));
      else { lead.push(brk(bridgeLeg(cur, run))); if (pick < 0.65) lead.push(turnToward(lead[0].end, foot, rp)); }
      let ok = true;
      for (let n = 0; n < lead.length && ok; n++) ok = !!lead[n] && fitsAll(lead[n].vols, lead.slice(0, n).map((q) => q.vols), lead.slice(0, n).map((q) => q.kind)) && offFoot(lead[n].vols);
      if (!ok) continue;
      const end = lead[lead.length - 1].end, room = roomLeg(H, end, toY - end.y, used, rp);
      if (!room || !fitsAll(room.vols, lead.map((q) => q.vols), lead.map((q) => q.kind)) || !offFoot(room.vols)) continue;
      // its way out open: a bridge's run on from its door stands (never a door that opens back onto the way it came by)
      const probe = bridgeLeg(room.end, 3 * EG_APPROACH.cell);
      if (!fitsAll(probe.vols, [...lead.map((q) => q.vols), room.vols], [...lead.map((q) => q.kind), 'room'])) continue;
      const sc = toFoot(room.end) + (room.end.h === 0 && foot.z < room.end.z ? 1500 : 0) + rp() * 1200;
      if (!best || sc < best.sc) best = { lead, room, sc };
    }
    if (!best) return fail('room') ? null : null;
    for (const q of best.lead) take(q);
    take(best.room);
    used.add(best.room.k);
  }
  // on toward the height still wanted, by a stair straight on
  const left = toY - cur.y;
  if (Math.abs(left) > 300) { const st = stairLeg(cur, Math.sign(left) * Math.min(Math.abs(left), 600)); if (st && fitsAll(st.vols)) take(st); }
  if (Math.abs(cur.y) > EG_ASCENT_BOUND.y - 300) { fail('height'); return null; }
  // THE APPROACH to the foot, and the course (or the door) clear there
  // the way's legs checked as they would be taken: the first that does not stand (its number), -1 - all stand and the course
  // (or the door) stands clear at their end; -2 - it does not
  const check = (way) => {
    for (let n = 0; n < way.length; n++) {
      const cv = way.slice(0, n).map((q) => q.vols), ck = way.slice(0, n).map((q) => q.kind);
      if (way[n].kind === 'bridge') way[n] = brk(way[n], cv, ck, false);   // THE BROKEN WAY: the way into a course's foot, its +z run broken
      if (!fitsAll(way[n].vols, cv, ck)) return n;
    }
    const at = way[way.length - 1].end;
    if (!need.door && at.z + need.dz + EG_ASCENT_ROOM_ON_CM > EG_ASCENT_BOUND.z1) return -2;
    const ahead = need.door ? doorLeg(at).vols : need.vols.map((v) => shift(v.b, at.x, at.y, at.z));
    return fitsAll(ahead, way.map((q) => q.vols), way.map((q) => q.kind)) ? -1 : -2;
  };
  // (THE BROKEN WAY - spec law 10: the long run in first, on a quarter of the search - else law 9's two cells, where any way
  // reaches the foot at all)
  const shape = need.door ? doorLeg({ x: 0, y: 0, z: 0, h: 0 }).vols : need.vols.map((v) => v.b);
  let way = null;
  if (H.law >= EG_BROKEN_LAW) { way = approach(W, placed, kinds, cur, foot, check, shape, EG_BROKEN_RUN, EG_APPROACH.pops >> 2, EG_BROKEN_SPLIT_CM); if (!way && !W.unreached) way = approach(W, placed, kinds, cur, foot, check, shape, 2, EG_APPROACH.pops, EG_BROKEN_SPLIT_CM); }
  else way = approach(W, placed, kinds, cur, foot, check, shape);
  if (!way) { fail('approach'); return null; }
  for (const leg of way) if (!take(leg)) return null;
  let cross = 0;
  for (const pv of placed) for (const v of pv) if (W.vols.some((q) => q.leg < W.legs && overPlan(v, q.b))) { cross++; break; }
  return { legs, end: cur, cross };
}
/** A landing that turns toward `foot` (across first where it lies across, else along). */
function turnToward(port, foot, rp) {
  const dx = foot.x - port.x, dz = foot.z - port.z, opts = [0, 1, 2, 3].filter((q) => q !== port.h && q !== (port.h + 2) % 4);
  opts.sort((a, b) => (DIR[b][0] * dx + DIR[b][1] * dz) - (DIR[a][0] * dx + DIR[a][1] * dz));
  return turnLeg(null, port, null, rp() < 0.8 ? opts[0] : opts[1]);
}
/** THE APPROACH's search, kept between its calls (it runs to its end in one call): its costs, its way back, its stamps and its
 *  heap - so a hall's many approaches make nothing new. */
const _A = { g: new Float64Array(0), prev: new Int32Array(0), seen: new Uint32Array(0), shut: new Uint32Array(0), gen: 0, heap: /** @type {number[]} */ ([]), fill: new Int32Array(0) };
/**
 * THE APPROACH (section 1): from `port`, at its height, a way of bridges and landings along the hall's grid (EG_APPROACH.cell,
 * centred on the port) to `foot` - snapped to the grid - heading +z, where `check` says the course (or the door) stands clear:
 * A* over cells, headings and the run since the last landing (a landing never within EG_APPROACH.run cells of the last, nor
 * EG_APPROACH.first of the port); a cell a leg already laid holds at this height (its volume, a landing's half-width and the
 * legs' margin about it) never entered, one over or under a leg a crossing's cost. Answers its legs, or null.
 * @param {any} W @param {any[][]} placed @param {string[]} kinds @param {any} port @param {{ x: number, z: number }} foot
 * @param {(way: any[]) => number} check @param {number[][]} shape @param {number} [into] the cells run into the foot along +z (THE
 * BROKEN WAY's EG_BROKEN_RUN) @param {number} [popMax] the search's bound
 */
function approach(W, placed, kinds, port, foot, check, shape, into = 2, popMax = EG_APPROACH.pops, split = Infinity) {
  W.unreached = 0;
  const no = (k) => { W.fails[`approach:${k}`] = (W.fails[`approach:${k}`] ?? 0) + 1; return null; };
  const C = EG_APPROACH.cell, y = port.y, B = EG_ASCENT_BOUND;
  const i0 = -Math.floor((port.x + B.x) / C), i1 = Math.floor((B.x - port.x) / C), j0 = -Math.floor((port.z - B.z0) / C), j1 = Math.floor((B.z1 - port.z) / C);
  const gi = Math.round((foot.x - port.x) / C), gj = Math.round((foot.z - port.z) / C);
  if (gi < i0 || gi > i1 || gj < j0 || gj > j1 || (gi === 0 && gj === 0)) { W.unreached = 1; return no('oob'); }   // (no way at all: THE BROKEN WAY asks no second search)
  const NI = i1 - i0 + 1, NJ = j1 - j0 + 1, cells = NI * NJ, held = new Uint8Array(cells);
  const at = (i, j) => (i - i0) * NJ + (j - j0);
  // a cell held: 1 - no way through it (a bridge's half-width and the margin from a leg at this height); 3 - no landing on it (a
  // landing's half-width and the margin); 2 - a leg over or under it (a crossing's cost)
  const lo = y - EG_ASCENT_HANG_CM.disc, hi = y + EG_ASCENT_HEAD_CM, padB = EG_ASCENT_APART_CM + EG_ASCENT_STAIR_HW, padL = EG_ASCENT_APART_CM + EG_ASCENT_LANDING_CM;
  const [sx, sz] = DIR[port.h];
  const rank = [0, 4, 1, 3];   // a stronger hold over a weaker: through-blocked over landing-blocked over crossing
  const mark = (b, near) => {
    const over = b[4] <= lo || b[1] >= hi;
    const a0 = Math.max(i0, Math.ceil((b[0] - padL - port.x) / C)), a1 = Math.min(i1, Math.floor((b[3] + padL - port.x) / C));
    const c0 = Math.max(j0, Math.ceil((b[2] - padL - port.z) / C)), c1 = Math.min(j1, Math.floor((b[5] + padL - port.z) / C));
    for (let i = a0; i <= a1; i++) for (let j = c0; j <= c1; j++) {
      if (near && ((i === 0 && j === 0) || (i === sx && j === sz) || (i === 2 * sx && j === 2 * sz))) continue;   // the leg the way leaves, at its door
      const x = port.x + i * C, z = port.z + j * C, inB = x >= b[0] - padB && x <= b[3] + padB && z >= b[2] - padB && z <= b[5] + padB;
      const v = over ? 2 : inB ? 1 : 3, k = at(i, j);
      if (rank[v] > rank[held[k]]) held[k] = v;
    }
  };
  const n0 = placed.length, adjW = n0 === 0 || (n0 === 1 && kinds[0] === 'landing');
  for (const q of W.vols) mark(q.b, adjW && q.leg === W.legs);
  placed.forEach((pv, n) => { for (const b of pv) mark(b, n === n0 - 1 || (n === n0 - 2 && kinds[n0 - 1] === 'landing')); });
  // the course (or the door) at its foot holds its own ground too - but the way into its foot along +z
  const fx = port.x + gi * C, fz = port.z + gj * C, keep = [at(gi, gj), gj - 1 >= j0 ? at(gi, gj - 1) : -1, gj - 2 >= j0 ? at(gi, gj - 2) : -1];
  const was = keep.map((k) => (k >= 0 ? held[k] : 0));
  for (const b of shape) mark(shift(b, fx, y, fz), false);
  keep.forEach((k, n) => { if (k >= 0) held[k] = was[n]; });
  // the run since the last landing counted to R (its turns at EG_APPROACH.run, its foot reached at `into` - THE BROKEN WAY's
  // longer run in)
  const RT = EG_APPROACH.run, R = Math.max(RT, into), NS = cells * 4 * (R + 1), K = _A;
  if (K.g.length < NS) { K.g = new Float64Array(NS); K.prev = new Int32Array(NS); K.seen = new Uint32Array(NS); K.shut = new Uint32Array(NS); }
  if (K.fill.length < cells) K.fill = new Int32Array(cells);
  const g = K.g, prev = K.prev, seen = K.seen, shut = K.shut, heap = K.heap;
  const sid = (k, h, r) => (k * 4 + h) * (R + 1) + r;
  // (THE BROKEN WAY's longer run in: a cell off the foot's own line must reach that line at most `into` - 1 cells short of the
  // foot and run on along it - still never more than the way's true cost; law 9's the plain distance)
  const jIn = gj - into + 1;
  const est = into > 2
    ? (k) => { const i = Math.floor(k / NJ) + i0, j = (k % NJ) + j0; return i === gi && j <= gj ? gj - j : Math.abs(i - gi) + (j <= jIn ? gj - j : j - jIn + gj - jIn); }
    : (k) => { const i = Math.floor(k / NJ) + i0, j = (k % NJ) + j0; return Math.abs(i - gi) + Math.abs(j - gj); };
  // A* over (cell, heading, run since the last landing 0..R - the port's own run begun EG_APPROACH.first short of a landing's) -
  // again round a leg the exact law refuses (its cells held), a few times at most; a flood first, so a foot no way reaches costs
  // the search nothing
  for (let round = 0; round < EG_APPROACH.rounds; round++) {
    // the flood: every cell a way may reach from the port (its queue the cells' own order, `fill` the queue and `seen` its marks)
    const fl = K.fill, mk = ++K.gen;
    let qh = 0, qt = 0;
    fl[qt++] = at(0, 0); seen[at(0, 0)] = mk;
    while (qh < qt) {
      const k = fl[qh++], i = Math.floor(k / NJ) + i0, j = (k % NJ) + j0;
      for (let d = 0; d < 4; d++) { const ni = i + DIR[d][0], nj = j + DIR[d][1]; if (ni < i0 || ni > i1 || nj < j0 || nj > j1) continue; const nk = at(ni, nj); if (seen[nk] === mk || held[nk] === 1) continue; seen[nk] = mk; fl[qt++] = nk; }
    }
    if (seen[at(gi, gj)] !== mk) { W.unreached = 1; return no('unreached'); }
    const gen = ++K.gen;
    heap.length = 0;
    const key = (f, s) => f * NS + s;
    const push = (v) => { heap.push(v); let c = heap.length - 1; while (c > 0) { const p = (c - 1) >> 1; if (heap[p] <= heap[c]) break; const t = heap[p]; heap[p] = heap[c]; heap[c] = t; c = p; } };
    const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let c = 0; for (;;) { const l = 2 * c + 1, r2 = l + 1; let m = c; if (l < heap.length && heap[l] < heap[m]) m = l; if (r2 < heap.length && heap[r2] < heap[m]) m = r2; if (m === c) break; const t = heap[m]; heap[m] = heap[c]; heap[c] = t; c = m; } } return top % NS; };
    const start = sid(at(0, 0), port.h, RT - EG_APPROACH.first);
    g[start] = 0; prev[start] = -1; seen[start] = gen;
    push(key(est(at(0, 0)), start));
    let pops = 0, refused = false;
    const budget = popMax;
    while (heap.length && pops < budget) {
      const s = pop();
      if (shut[s] === gen) continue;
      shut[s] = gen; pops++;
      const r = s % (R + 1), h = Math.floor(s / (R + 1)) % 4, k = Math.floor(s / (4 * (R + 1)));
      const i = Math.floor(k / NJ) + i0, j = (k % NJ) + j0;
      if (i === gi && j === gj && h === 0 && r >= into) {
        const legs = wayLegs(prev, s, port, i0, j0, NJ, R, split);
        if (!legs) return no('legs');
        const bad = check(legs);
        if (bad === -1) return legs;
        if (bad === -2) return no('clear');
        // a leg the exact law refuses: its cells held, and the way found again
        const b = legs[bad].vols[0], a0 = Math.max(i0, Math.floor((b[0] - port.x) / C)), a1 = Math.min(i1, Math.ceil((b[3] - port.x) / C)), c0 = Math.max(j0, Math.floor((b[2] - port.z) / C)), c1 = Math.min(j1, Math.ceil((b[5] - port.z) / C));
        let marked = 0;
        for (let ii = a0; ii <= a1; ii++) for (let jj = c0; jj <= c1; jj++) { const kk = at(ii, jj); if (!(ii === 0 && jj === 0) && !(ii === gi && jj === gj) && held[kk] !== 1) { held[kk] = 1; marked++; } }
        if (!marked) return no('nomark');
        refused = true;
        break;
      }
      const step = (h2, r2, cost) => {
        const [dx, dz] = DIR[h2], ni = i + dx, nj = j + dz;
        if (ni < i0 || ni > i1 || nj < j0 || nj > j1) return;
        const nk = at(ni, nj);
        if (held[nk] === 1) return;
        const ns = sid(nk, h2, r2), d = g[s] + cost + (held[nk] === 2 ? EG_APPROACH.over : 0);
        if (seen[ns] !== gen || d < g[ns]) { seen[ns] = gen; g[ns] = d; prev[ns] = s; push(key(d + est(nk), ns)); }
      };
      step(h, Math.min(R, r + 1), 1);
      if (!(i === 0 && j === 0) && held[k] !== 3 && r >= RT) for (const h2 of [(h + 1) % 4, (h + 3) % 4]) step(h2, 1, 1 + EG_APPROACH.turn);
    }
    if (!refused) return no(pops >= budget ? 'pops' : 'unreached');
  }
  return no('rounds');
}
/** The legs of the way A* found to state `s`: a bridge along each run, a landing at each turn (its middle the turning cell's),
 *  the last bridge to the foot. */
function wayLegs(prev, s, port, i0, j0, NJ, R, split = Infinity) {
  const C = EG_APPROACH.cell, path = [];
  for (let q = s; q >= 0; q = prev[q]) path.unshift(q);
  const cellOf = (q) => { const k = Math.floor(q / (4 * (R + 1))); return [Math.floor(k / NJ) + i0, (k % NJ) + j0]; };
  const headOf = (q) => Math.floor(q / (R + 1)) % 4;
  const legs = [];
  let cur = port;
  for (let n = 1; n < path.length; n++) {
    if (headOf(path[n]) === headOf(path[n - 1])) continue;
    const [ci, cj] = cellOf(path[n - 1]), cx = port.x + ci * C, cz = port.z + cj * C;
    const run = Math.abs(cx - cur.x) + Math.abs(cz - cur.z) - EG_ASCENT_LANDING_CM;
    if (run < 0) return null;
    if (run > 0) cur = bridges(legs, cur, run, split);
    const t = turnLeg(null, cur, null, headOf(path[n]));
    if (!t) return null;
    legs.push(t); cur = t.end;
  }
  const [fi, fj] = cellOf(s), fx = port.x + fi * C, fz = port.z + fj * C, run = Math.abs(fx - cur.x) + Math.abs(fz - cur.z);
  if (cur.x !== fx && cur.z !== fz) return null;
  if (run > 0) cur = bridges(legs, cur, run, split);
  return legs.length ? legs : null;
}
/** A straight run of the approach as its bridges (cm): one, or (THE BROKEN WAY - THE AUDIT: `split`) as many of at most `split`
 *  end to end, each broken on its own - one break in a 136 m run left 47 m walked at either side of it. Answers the run's end. */
function bridges(legs, cur, run, split) {
  const n = Math.max(1, Math.min(Math.ceil(run / split), Math.floor(run / EG_BROKEN_CHUNK_CM)));
  for (let q = 0; q < n; q++) { const b = bridgeLeg(cur, q === n - 1 ? run - Math.floor(run / n) * (n - 1) : Math.floor(run / n)); legs.push(b); cur = b.end; }
  return cur;
}
/** A BRIDGE (a lane) `len` on from `port` along its heading, at its height. */
function bridgeLeg(port, len) {
  const [dx, dz] = DIR[port.h], hw = 200, bx = port.x + dx * len, bz = port.z + dz * len;
  return { kind: 'bridge', len, start: port, end: { ...port, x: bx, z: bz }, vols: [floorVol(Math.min(port.x, bx) - (dz ? hw : 0), Math.min(port.z, bz) - (dx ? hw : 0), Math.max(port.x, bx) + (dz ? hw : 0), Math.max(port.z, bz) + (dx ? hw : 0), port.y, port.y, EG_ASCENT_HANG_CM.band)] };
}
/**
 * THE BROKEN WAY (spec law 10): bridge `leg` BROKEN - in any heading, where it runs EG_BROKEN_MIN_CM or more - its middle fallen
 * away and crossed on EG_BROKEN_PIECES of one of its band's EG_BROKEN_KINDS, all off the planner's die (`H.rp` - no course's
 * draws move): each piece a gap of THE ENVELOPE past the last edge (EG_GAP_MIN_CM-EG_GAP_MAX_CM - the span generator's own),
 * at the Steps' own timing (a Drift's swing and period, Beats alternate a half cycle apart, a Pendulum's period, a Vent's
 * cycle - egSpanLaw.js egSpanOf's run, its numbers), a last gap onto the bridge on, and EG_BROKEN_FOOT_CM of bridge kept at
 * either end at the least (the slack shared between them). Its volumes: its two feet a bridge's, its break the pieces' (their
 * swing across, what hangs under a course - EG_ASCENT_HANG_CM.step). Null where it stays whole (too short for a piece).
 * @param {any} H @param {any} leg
 */
function breakLeg(H, leg, fits = (/** @type {number[][]} */ _v) => true) {
  if (!(H.law >= EG_BROKEN_LAW) || leg.kind !== 'bridge' || leg.br || leg.len < EG_BROKEN_MIN_CM) return null;
  const hd = leg.start.h, band = EG_BROKEN_KINDS[H.bnd] ?? EG_BROKEN_KINDS[0], kinds = hd ? band.filter((q) => EG_BROKEN_TURNED.includes(q)) : band;
  const rp = H.rp, room = leg.len - 2 * EG_BROKEN_FOOT_CM;
  const want = Math.min(EG_BROKEN_MOST, between(rp, EG_BROKEN_PIECES[0], EG_BROKEN_PIECES[1]) + Math.floor(Math.max(0, room - EG_BROKEN_LONG_CM) / EG_BROKEN_PER_CM));
  // (THE AUDIT: a lone piece never a still slab - 15% of the broken bridges stood one still slab, a step and no more)
  const pool = want === 1 && kinds.some((q) => q !== 'still') ? kinds.filter((q) => q !== 'still') : kinds;
  const k = pool[Math.floor(rp() * pool.length)], S = H.sizes[k], D = hd % 2 ? S.w : S.d;   // its depth along its heading (a turned piece keeps its top)
  const drawn = [];
  let used = 0;
  for (let q = 0; q < want; q++) {
    const g = between(rp, H.gapMin, H.gapMax);
    if (used + g + D + H.gapMin > room) break;
    const p = { k, gap: g, amp: 0, period: 0, phase: 0, beat: 0 };
    if (k === 'drift') { p.amp = between(rp, 100, 200); p.period = between(rp, 40, 70) * 100; p.phase = q * 900; }
    else if (k === 'beat') p.beat = (q % 2) * H.beatHalf;
    else if (k === 'pend') { p.period = between(rp, 30, 50) * 100; p.phase = q * 700; }
    else if (k === 'vent') { p.period = between(rp, 40, 60) * 100; p.phase = between(rp, 0, 39) * 100; }
    drawn.push(p);
    used += g + D;
  }
  if (!drawn.length) return null;
  const lastG = between(rp, H.gapMin, H.gapMax), s = leg.start, [ux, uz] = DIR[hd], pt = (t) => [s.x + ux * t, s.z + uz * t];
  const box = (t0, t1, hw, hang) => { const [ax, az] = pt(t0), [bx, bz] = pt(t1); return floorVol(Math.min(ax, bx) - (uz ? hw : 0), Math.min(az, bz) - (ux ? hw : 0), Math.max(ax, bx) + (uz ? hw : 0), Math.max(az, bz) + (ux ? hw : 0), s.y, s.y, hang); };
  // THE AUDIT: its pieces, then one fewer, down to one - each break tried along the bridge, its middle first, where it stands
  // apart (`fits` - the plan's own test); none standing anywhere, the bridge walked whole
  for (let n = drawn.length; n >= 1; n--) {
    const pieces = drawn.slice(0, n).map((p) => ({ ...p })), u = pieces.reduce((t, p) => t + p.gap + D, 0), last = Math.min(lastG, room - u), free = room - u - last;
    const sway = k === 'drift' ? Math.max(...pieces.map((p) => p.amp)) : k === 'pend' ? Math.round((EG_PEND_REACH + EG_PEND_HALF) * 100) : 0;
    const across = Math.max(200, half(hd % 2 ? S.d : S.w) + sway);   // its half-width across its heading: a bridge's, or its pieces' and their swing
    for (const f of EG_BROKEN_SLIDES) {
      // along its heading from its start: the break begins at `a`, ends at `b` (cm); each piece's middle along it
      const a = EG_BROKEN_FOOT_CM + (f === 0.5 ? half(free) : Math.floor(free * f)), b = a + u + last;
      let e = a;
      for (const p of pieces) { p.at = e + p.gap + half(D); e += p.gap + D; }
      const brk = box(a, b, across, EG_ASCENT_HANG_CM.step), vols = [box(0, a, 200, EG_ASCENT_HANG_CM.band), Object.assign(brk, { brk: 1 }), box(b, leg.len, 200, EG_ASCENT_HANG_CM.band)];   // (its break's box marked - fitsAll keeps every leg clear of it)
      if (fits(vols)) return { ...leg, br: { a, b, hd, D, x0: brk[0], x1: brk[3], z0: brk[2], z1: brk[5], pieces: pieces.map((p) => ({ ...p })) }, vols };
    }
  }
  return null;
}
/** A STAIR (a ramp) from `port` along its heading rising `rise` (negative: down) at the stair's steepest and a little more. */
function stairLeg(port, rise) {
  if (!rise) return null;
  const [dx, dz] = DIR[port.h], run = egStairRun(rise) + 100, hw = EG_ASCENT_STAIR_HW, bx = port.x + dx * run, bz = port.z + dz * run, y1 = port.y + rise;
  return { kind: 'stair', rise, run, start: port, end: { ...port, x: bx, y: y1, z: bz }, vols: [floorVol(Math.min(port.x, bx) - (dz ? hw : 0), Math.min(port.z, bz) - (dx ? hw : 0), Math.max(port.x, bx) + (dz ? hw : 0), Math.max(port.z, bz) + (dx ? hw : 0), Math.min(port.y, y1), Math.max(port.y, y1), EG_ASCENT_HANG_CM.band)] };
}
/** A LANDING where the way turns: a disc whose near rim is `port`, the way on leaving it from its rim along a new heading
 *  (`to` - one drawn, never back the way it came, toward the hall's open side). */
function turnLeg(H, port, rp, to = -1) {
  const R = EG_ASCENT_LANDING_CM, [dx, dz] = DIR[port.h], cx = port.x + dx * R, cz = port.z + dz * R;
  let h = to;
  if (h < 0) {
    const opts = [0, 1, 2, 3].filter((q) => q !== (port.h + 2) % 4 && q !== port.h);
    // the open side: toward the middle of the bound across x, and back down z where the hall stands deep in it
    opts.sort((a, b) => score(b) - score(a));
    function score(q) { const [ux, uz] = DIR[q]; return -ux * Math.sign(cx) * (Math.abs(cx) > 6000 ? 2 : 0.5) - uz * (cz > 9000 ? 1 : -0.5) + rp() * 1.2; }
    h = opts[0];
  }
  if (h === (port.h + 2) % 4) return null;
  const [ex, ez] = DIR[h];
  return { kind: 'landing', start: port, c: [cx, cz], end: { x: cx + ex * R, y: port.y, z: cz + ez * R, h }, vols: [floorVol(cx - R, cz - R, cx + R, cz + R, port.y, port.y, EG_ASCENT_HANG_CM.disc)] };
}
/** A ROOM (section 3) on the way at `port`: an archetype from the stretch's bag (one the hall has not passed yet first), its
 *  numbers off the planner's die, a way in and a way out of its pairs whose rise goes toward `left` - placed (its way in at
 *  the port, facing back along the company's way), its box its volume. */
function roomLeg(H, port, left, used, rp) {
  const bag = Math.abs(left) < 300 ? BAGS.level : left > 0 ? BAGS.climb : BAGS.fall;
  const fresh = bag.filter((k) => !used.has(k)), pool = fresh.length ? fresh : bag;
  // (THE BROKEN WAY - spec law 10: any of the fresh pool alike - law 9 drew from its first four, and the bag's order stood a tower
  // in 82% of its halls, two halls running in 66%)
  const k = H.law >= EG_BROKEN_LAW ? pool[Math.floor(rp() * pool.length)] : pool[Math.min(pool.length - 1, Math.floor(rp() * Math.min(pool.length, 4)))];
  const p = egRoomDraw(k, rp), kit = k === 'corridor' || k === 'switchback' ? EG_PASSAGE_KITS[H.bnd][0] : EG_CHAMBER_KITS[H.bnd][0];
  const R0 = egRoomBuild(k, p, [0], H.bnd, kit);
  const pairs = egRoomPairs(k).map(([i, o]) => ({ i, o, rise: R0.sockets[o].y - R0.sockets[i].y }));
  const want = pairs.filter((q) => (Math.abs(left) < 300 ? Math.abs(q.rise) <= 250 : Math.sign(q.rise) === Math.sign(left)));
  const cands = want.length ? want : pairs;
  const pr = cands[Math.floor(rp() * cands.length)];
  // placed as built with its way in and its way out cut (its sockets are its doors' whatever the doors cut; a room's ways may
  // be its pair's - the stair hall's climb only up - so the way through it is read off the room commit builds)
  const R1 = egRoomBuild(k, p, [pr.i, pr.o], H.bnd, kit);
  if (!roomMain(R1, R1.way.links, R1.sockets[pr.i].n, R1.sockets[pr.o].n)) return null;   // a way through it, in to out
  const t = egTurnFor(R1.sockets[pr.i].yaw, port.h), R = egRoomTurned(R1, pr.i, t);
  const box = egRoomBox(R), o = R.sockets[pr.o];
  const end = { x: port.x + o.x, y: port.y + o.y, z: port.z + o.z, h: egHeadingOf(o.yaw) };
  return { kind: 'room', k, p, kit, pr, t, start: port, end, vols: [shift(box, port.x, port.y, port.z)], down: pr.rise < 0 };
}
/** THE DOOR (section 7's door): a bridge on from `port` and the end plate (r 5 m) at its end. */
function doorLeg(port) {
  const b = bridgeLeg(port, 500), [dx, dz] = DIR[port.h], cx = b.end.x + dx * 500, cz = b.end.z + dz * 500;
  return { kind: 'door', b, c: [cx, cz], vols: [...b.vols, floorVol(cx - 500, cz - 500, cx + 500, cz + 500, port.y, port.y, EG_ASCENT_HANG_CM.disc)] };
}
/** A leg laid for real: its parts into the hall (the hall law's closures), its volumes, its route. */
function commit(H, W, leg) {
  const id = ++W.legs, s = leg.start;
  W.legKind[id] = leg.kind;
  const y = Math.min(s.y, leg.end?.y ?? s.y);
  // a CROSSING (section 5): this leg over or under a leg of another part of the way (a course, a stretch) it does not join -
  // counted once a pair of parts
  const joined = (q) => q.leg === id - 1 || (q.leg === id - 2 && W.legKind[id - 1] === 'landing');
  for (const v of leg.vols) {
    for (const q of W.vols) if (!joined(q) && q.part !== W.part && overPlan(v, q.b)) (W.crossed ??= new Set()).add(`${q.part}:${W.part}`);
    W.vols.push({ b: v, leg: id, y: leg.kind === 'room' ? v[1] + 50 : y, kind: leg.kind, part: W.part });
  }
  const from = W.tail ?? 0;
  if (leg.kind === 'bridge' && leg.br) {
    // THE BROKEN WAY (spec law 10): its near foot, its pieces where they stand (a course of the hall's one count, its own ground
    // - THE TIMED SOLVER proves it where it stands; along +z through the span generator's road, along another heading laid off
    // every road's line, egSpanPairs reading it along its heading), its far foot; the way a bridge, a span and a bridge
    const B = leg.br, [ux, uz] = DIR[B.hd], at = (t) => [s.x + ux * t, s.z + uz * t], [ax, az] = at(B.a), [bx, bz] = at(B.b);
    H.lane(s.x, s.z, ax, az, 200, 'bridge', s.y);
    if (B.hd === 0) {
      H.set({ X: s.x, y: s.y, edge: az, road: 0, xRoad: 0 }); H.S.road(0); H.S.floor(s.y);
      for (const p of B.pieces) H.step(p.k, p.gap, { x: 0, amp: p.amp, period: p.period, phase: p.phase, beat: p.beat });
    } else B.pieces.forEach((p, q) => { const [px, pz] = at(p.at); H.S.put(p.k, { x: px, y: s.y, z: pz, gap: p.gap, period: p.period, phase: p.phase, beat: p.beat, hd: B.hd, after: q === B.pieces.length - 1 ? B.b - p.at - half(B.D) : 0 }); });
    H.lane(bx, bz, leg.end.x, leg.end.z, 200, 'bridge', s.y);
    const a = link(W, from, node(W, [ax, s.y, az]), 'bridge', 0), b = link(W, a, node(W, [bx, s.y, bz]), 'span', 0);
    W.tail = link(W, b, node(W, [leg.end.x, leg.end.y, leg.end.z]), 'bridge', 0);
    W.segs.push({ leg: id, x: s.x, y: s.y, z0: B.hd === 0 ? s.z : B.z0, z1: B.hd === 0 ? leg.end.z : B.z1, x0: B.x0, x1: B.x1, y0: s.y, y1: s.y, frags: 0, broken: 1 });
  } else if (leg.kind === 'bridge') {
    H.lane(s.x, s.z, leg.end.x, leg.end.z, 200, 'bridge', s.y);
    W.tail = link(W, from, node(W, [leg.end.x, leg.end.y, leg.end.z]), 'bridge', 0);
  } else if (leg.kind === 'stair') {
    const up = leg.rise > 0, a = up ? s : leg.end, b = up ? leg.end : s;
    H.P.ramps.push({ ax: a.x, az: a.z, bx: b.x, bz: b.z, hw: EG_ASCENT_STAIR_HW, y0: a.y, y1: b.y });
    W.tail = link(W, from, node(W, [leg.end.x, leg.end.y, leg.end.z]), 'stair', 0);
  } else if (leg.kind === 'landing') {
    H.disc(leg.c[0], leg.c[1], EG_ASCENT_LANDING_CM, 'landing', s.y);
    const c = link(W, from, node(W, [leg.c[0], s.y, leg.c[1]]), 'walk', 0);
    W.tail = link(W, c, node(W, [leg.end.x, leg.end.y, leg.end.z]), 'walk', 0);
  } else if (leg.kind === 'room') {
    const R = egRoomTurned(egRoomBuild(leg.k, leg.p, [leg.pr.i, leg.pr.o], H.bnd, leg.kit), leg.pr.i, leg.t), hero = H.roomLay(R, leg.pr.o, s.x, s.y, s.z, `room:${leg.k}`);
    W.rooms.push({ k: leg.k, hero, at: [s.x, s.y, s.z], down: leg.down, leg: id });
    // its ways: its main way by its own one-way links from its way in to its way out (through any of its nodes - an unused
    // doorway's node is a point of its floor), and every other link of the room's own between sockets it uses (a link to a
    // doorway it does not use leads to a wall)
    const usedS = new Set([R.inI, leg.pr.o]), sockN = new Map(R.sockets.flatMap((q, i) => [[q.n, i], [q.ni, i]]));   // a doorway's two nodes, its threshold's
    const ids = new Map();
    const nid = (n) => { if (!ids.has(n)) ids.set(n, n === R.sockets[R.inI].n ? from : node(W, [s.x + R.way.nodes[n][0], s.y + R.way.nodes[n][1], s.z + R.way.nodes[n][2]])); return ids.get(n); };
    const main = roomMain(R, R.way.links, R.sockets[R.inI].n, R.sockets[leg.pr.o].n);
    if (!main) return;
    const onMain = new Set([R.sockets[R.inI].n]);
    for (const q of main) { onMain.add(q.l.a); onMain.add(q.l.b); }
    const open = R.way.links.filter((l) => main.some((q) => q.l === l) || [l.a, l.b].every((n) => !sockN.has(n) || usedS.has(sockN.get(n)) || onMain.has(n)));
    // and of those, the ones the main way reaches (a way cut off by a doorway's wall is no way)
    const reach = new Set(onMain);
    for (let grew = true; grew;) { grew = false; for (const l of open) if (reach.has(l.a) !== reach.has(l.b)) { reach.add(l.a); reach.add(l.b); grew = true; } }
    const keep = open.filter((l) => reach.has(l.a) && reach.has(l.b));
    // a climb link names its climb (THE PROOFS - net/eliteGates/egRouteProof.js egRouteClimbOf): its number among the plan's climbs
    const c0 = W.climbs.length, cl = (l) => (l.climb ?? -1) >= 0 ? c0 + l.climb : -1;
    for (const l of keep) {
      const m = main.find((q) => q.l === l);
      if (m) link(W, nid(m.rev ? l.b : l.a), nid(m.rev ? l.a : l.b), l.kind, 0, l.one, cl(l));   // the main way's, along the way
      else link(W, nid(l.a), nid(l.b), l.kind, l.road === 0 ? 1 : l.road, l.one, cl(l));   // the room's other ways: the long way round, a side way
    }
    W.tail = nid(R.sockets[leg.pr.o].n);
    for (const c of R.climbs) W.climbs.push({ ...c, x0: c.x0 + s.x, z0: c.z0 + s.z, x1: c.x1 + s.x, z1: c.z1 + s.z, y0: c.y0 + s.y, y1: c.y1 + s.y, ledges: c.ledges.map((y) => y + s.y) });
    if (leg.down) for (const w of R.wells) W.wells.push({ poly: w.poly.map((p) => [p[0] + s.x, p[1] + s.z]), y0: w.y0 + s.y, y1: w.y1 + s.y });
  }
}
/** A room's main way (its links from node `a` to node `b`, by the fewest centimetres, a one-way link only its own way): each
 *  link marked `rev` where the way takes it from its b to its a. */
function roomMain(R, links, a, b) {
  const N = R.way.nodes.length, dist = Array(N).fill(Infinity), prev = Array(N).fill(null);
  dist[a] = 0;
  const len = (l) => { const p = R.way.nodes[l.a], q = R.way.nodes[l.b]; return egIsqrt((p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2 + (p[2] - q[2]) ** 2) + (l.road > 0 ? 400 : 0); };
  const done = Array(N).fill(false);
  for (;;) {
    let u = -1;
    for (let i = 0; i < N; i++) if (!done[i] && dist[i] < Infinity && (u < 0 || dist[i] < dist[u])) u = i;
    if (u < 0 || u === b) break;
    done[u] = true;
    for (const l of links) {
      if (l.a === u && dist[u] + len(l) < dist[l.b]) { dist[l.b] = dist[u] + len(l); prev[l.b] = { l, rev: false, from: u }; }
      if (!l.one && l.b === u && dist[u] + len(l) < dist[l.a]) { dist[l.a] = dist[u] + len(l); prev[l.a] = { l, rev: true, from: u }; }
    }
  }
  if (a !== b && !prev[b]) return null;
  const out = [];
  for (let v = b; prev[v]; v = prev[v].from) out.unshift({ l: prev[v].l, rev: prev[v].rev });
  return out;
}

// ── THE PLAN'S END ──────────────────────────────────────────────────────────────────────────────────────────────────────
/** The door laid (its bridge and the end plate), the route's main way found, THE VOIDS laid and the plan's laws held: the
 *  way's whole height inside EG_ASCENT_RISE_CM, its crossings at most EG_ASCENT_CROSSINGS_MAX, its fragments inside
 *  EG_ASCENT_FRAGS_MAX. */
function finish(H, W) {
  // the door: its bridge and the end plate at the way's end (the stretch before it brought the way to +z)
  if (!NO_DOOR.includes(H.kind)) {
    const tail = W.nodes[W.tail], port = { x: tail[0], y: tail[1], z: tail[2], h: 0 }, d = doorLeg(port);
    const id = ++W.legs;
    for (const v of d.vols) W.vols.push({ b: v, leg: id, y: port.y, kind: 'door' });
    H.lane(port.x, port.z, d.b.end.x, d.b.end.z, 200, 'bridge', port.y);
    H.P.end = H.disc(d.c[0], d.c[1], 500, 'end', port.y);
    W.tail = link(W, W.tail, node(W, [d.c[0], port.y, d.c[1]]), 'bridge', 0);
    W.door = W.tail;
  } else {
    // the Court: the way ends on the lord's ground's heart (its wake ring's - the Redoubt's beacon stands there)
    const g = H.P.ring ?? H.P.foe ?? null, t = W.nodes[W.tail];
    if (g && (t[0] !== g.x || t[2] !== g.z)) { const y = H.get().y; W.tail = link(W, W.tail, node(W, [g.x, y, g.z]), 'walk', 0); }
    W.door = W.tail;
  }
  W.main = egRouteMainOf(W.nodes, W.links, 0, W.door);
  if (!W.main) return why('no main way from the plate to the door');
  const ys = W.main.map((i) => W.nodes[i][1]), rise = Math.max(...ys) - Math.min(...ys);
  if (rise < EG_ASCENT_RISE_CM[0] || rise > EG_ASCENT_RISE_CM[1]) return why(`the way's height ${rise} cm`);
  W.crossings = W.crossed?.size ?? 0;
  if (W.crossings > EG_ASCENT_CROSSINGS_MAX) return why(`${W.crossings} crossings`);
  if (H.P.frags.length > EG_ASCENT_FRAGS_MAX) return why(`${H.P.frags.length} fragments`);
  W.voids = voidsOf(W, H.law >= EG_BROKEN_LAW);
  W.rise = rise;
  return W;
}
/**
 * THE ROUTE'S MAIN WAY (section 1's `main`): the node path from node `a` (the arrival plate) to node `b` (the door) over road 0's
 * links, a one-way link only its own way - by the fewest centimetres. Null where road 0 does not reach.
 * @param {number[][]} nodes @param {any[]} links @param {number} a @param {number} b
 */
export function egRouteMainOf(nodes, links, a, b) {
  const N = nodes.length, dist = Array(N).fill(Infinity), prev = Array(N).fill(-1), done = Array(N).fill(false);
  dist[a] = 0;
  for (;;) {
    let u = -1;
    for (let i = 0; i < N; i++) if (!done[i] && dist[i] < Infinity && (u < 0 || dist[i] < dist[u])) u = i;
    if (u < 0 || u === b) break;
    done[u] = true;
    for (const l of links) {
      if (l.road !== 0) continue;
      if (l.a === u && dist[u] + l.len < dist[l.b]) { dist[l.b] = dist[u] + l.len; prev[l.b] = u; }
      if (!l.one && l.b === u && dist[u] + l.len < dist[l.a]) { dist[l.a] = dist[u] + l.len; prev[l.a] = u; }
    }
  }
  if (dist[b] === Infinity) return null;
  const out = [];
  for (let v = b; v >= 0; v = prev[v]) out.unshift(v);
  return out;
}
/** THE VOIDS (section 2): where a leg the way takes earlier stands over one it takes later (a fall from it skips ahead), the
 *  lower leg's plan under the upper's (and 3 m about it - a fall's drift), from 3 m over the lower's floor to under the upper's;
 *  and each room taken downward its wells. THE AUDIT (THE BROKEN WAY, spec law 10 - `plate`): the arrival plate too - a law 10
 *  way that runs under it was skipped by a step off its edge (seed 2's hall 3: a 19.3 m fall to 166 m of its 449). */
function voidsOf(W, plate = false) {
  const out = [...W.wells];
  for (const u of W.vols) for (const d of W.vols) {
    if (!(u.leg < d.leg - 1) || u.y - d.y < 500 || !overPlan(u.b, d.b) || (u.kind === 'plate' && !plate)) continue;
    const x0 = Math.max(u.b[0] - 300, d.b[0]), z0 = Math.max(u.b[2] - 300, d.b[2]), x1 = Math.min(u.b[3] + 300, d.b[3]), z1 = Math.min(u.b[5] + 300, d.b[5]);
    // from over the lower leg's reach (its floor's headroom, or its roof's) to under the upper leg's lowest floor
    const y0 = d.b[4] - 150, y1 = u.y - 50;
    if (x1 - x0 < 100 || z1 - z0 < 100 || y1 - y0 < 100) continue;
    out.push({ poly: [[x0, z0], [x1, z0], [x1, z1], [x0, z1]], y0, y1 });
  }
  return out;
}

/**
 * THE ROUTE'S SANITY (this slice's own law - section 7's "nothing unwalkable is emitted", ahead of THE PROOFS slice's): why
 * hall `spec`'s route (spec law 9 - metres) is not a way a body can walk - '' when it is. Its main way runs from its first node
 * (the arrival plate) to its last; every link's ends are nodes, its kind section 1's, its road 0, 1 or 2; a walk and a bridge
 * level within 0.6 m; a stair no steeper than its law (net/eliteGates/egRoomLaw.js EG_STAIR_FIFTHS, with a hand's slack); a climb's
 * plan within EG_ROUTE_CLIMB_PLAN_M of its height's line; a drop no deeper than a Drop (4.6 m); the main way crossing itself at
 * most EG_ASCENT_CROSSINGS_MAX times (egRouteCrossings), no longer than EG_ROUTE_LEN_MAX_M, and crossed at THE SPAN BUILD inside
 * EG_ROUTE_S_MAX (THE PROOFS' crossing over the route at its median - net/eliteGates/egSpanLaw.js egRouteCross). Pure.
 * @param {any} spec
 */
export function egAscentSane(spec) {
  const R = spec?.route;
  if (!R || !Array.isArray(R.nodes) || !Array.isArray(R.links) || !Array.isArray(R.main) || R.main.length < 2) return 'no route';
  const N = R.nodes.length;
  if (R.main[0] !== 0) return 'the main way does not begin at the arrival plate';
  for (const [i, l] of R.links.entries()) {
    if (!(l.a >= 0 && l.a < N && l.b >= 0 && l.b < N)) return `link ${i}: not two nodes`;
    if (!['walk', 'stair', 'climb', 'drop', 'span', 'bridge'].includes(l.kind) || ![0, 1, 2].includes(l.road)) return `link ${i}: a ${l.kind} on road ${l.road}`;
    const p = R.nodes[l.a], q = R.nodes[l.b], dy = Math.abs(q[1] - p[1]), dx = Math.round((q[0] - p[0]) * 100), dz = Math.round((q[2] - p[2]) * 100), plan = egIsqrt(dx * dx + dz * dz) / 100;   // the law's integers (cm), never a float root
    if ((l.kind === 'walk' || l.kind === 'bridge') && dy > 0.6) return `link ${i}: a ${l.kind} ${dy.toFixed(2)} m up`;
    if (l.kind === 'stair' && dy * 5 > (plan + 0.6) * 3) return `link ${i}: a stair ${dy.toFixed(2)} m up over ${plan.toFixed(2)} m`;
    if (l.kind === 'climb' && plan > EG_ROUTE_CLIMB_PLAN_M) return `link ${i}: a climb ${plan.toFixed(2)} m from its line`;
    if (l.kind === 'drop' && (dy > 4.6 || q[1] > p[1])) return `link ${i}: a drop of ${dy.toFixed(2)} m`;
  }
  for (let k = 0; k + 1 < R.main.length; k++) {
    const a = R.main[k], b = R.main[k + 1];
    if (!R.links.some((l) => l.road === 0 && ((l.a === a && l.b === b) || (!l.one && l.b === a && l.a === b)))) return `the main way leaps from node ${a} to node ${b}`;
  }
  const x = egRouteCrossings(spec);
  if (x > EG_ASCENT_CROSSINGS_MAX) return `the main way crosses itself ${x} times, past ${EG_ASCENT_CROSSINGS_MAX}`;
  const len = egRouteLength(spec);
  if (len > EG_ROUTE_LEN_MAX_M) return `the main way runs ${len.toFixed(0)} m, past ${EG_ROUTE_LEN_MAX_M}`;
  const s = egRouteCross(spec, 0).median;
  if (!(s <= EG_ROUTE_S_MAX)) return `the main way takes ${s.toFixed(0)} s at the span build, past ${EG_ROUTE_S_MAX}`;
  return '';
}
/**
 * THE CROSSINGS (section 5's "at most two crossings"): how many times hall `spec`'s main way passes over or under itself - its
 * links' lines crossing in plan, a pair of PARTS once (a room's own links one part - a tower's stair round its own walk is the
 * room's, never a crossing - a course's own links one part, every other link its own), in the law's centimetres. Pure.
 * @param {any} spec
 */
export function egRouteCrossings(spec) {
  const R = spec?.route;
  if (!R?.main?.length) return 0;
  const cm = (/** @type {number} */ v) => Math.round(v * 100), N = R.nodes.map((n) => n.map(cm)), ml = mainLinks(R);
  const boxes = (spec.rooms ?? []).map((q) => spec.heroes?.[q.h]?.box).filter(Boolean).map((b) => b.map(cm));
  const grounds = (R.courses ?? []).map((g) => [g.x0, g.y0, g.z0, g.x1, g.y1, g.z1].map(cm));
  // a room's box holds a node within a centimetre in plan and half a metre in height; a course's ground within a metre
  const holds = (b, p, d, dy) => p[0] >= b[0] - d && p[0] <= b[3] + d && p[2] >= b[2] - d && p[2] <= b[5] + d && p[1] >= b[1] - dy && p[1] <= b[4] + dy;
  const part = ml.map((l, i) => {
    if (!l) return `l${i}`;
    const a = N[l.a], b = N[l.b], r = boxes.findIndex((B) => holds(B, a, 1, 50) && holds(B, b, 1, 50));
    if (r >= 0) return `r${r}`;
    const c = grounds.findIndex((g) => holds(g, a, 100, 100) && holds(g, b, 100, 100));
    return c >= 0 ? `c${c}` : `l${i}`;
  });
  const side = (p, q, r) => Math.sign((q[0] - p[0]) * (r[2] - p[2]) - (q[2] - p[2]) * (r[0] - p[0]));
  const pairs = new Set();
  for (let i = 0; i < ml.length; i++) for (let j = i + 2; j < ml.length; j++) {
    if (!ml[i] || !ml[j] || part[i] === part[j]) continue;
    const a0 = N[ml[i].a], a1 = N[ml[i].b], b0 = N[ml[j].a], b1 = N[ml[j].b];
    if (side(a0, a1, b0) * side(a0, a1, b1) < 0 && side(b0, b1, a0) * side(b0, b1, a1) < 0) pairs.add(part[i] < part[j] ? `${part[i]}|${part[j]}` : `${part[j]}|${part[i]}`);
  }
  return pairs.size;
}
/** The main way's links in order (each the road-0 link between two of its nodes, either way it runs). */
const mainLinks = (R) => R.main.slice(1).map((b, k) => { const a = R.main[k]; return R.links.find((l) => l.road === 0 && ((l.a === a && l.b === b) || (l.b === a && l.a === b))); });
/** The main way's length (m): its links' lengths. */
export const egRouteLength = (spec) => mainLinks(spec.route).reduce((s, l) => s + (l?.len ?? 0), 0);
/** Each room's name (the hall's words). */
export const egRoomName = (k) => EG_ROOM_NAMES[k] ?? '';
