// @ts-check
// THE ASCENT (LAW 9, 2026-10-16, Mac: "I just feel like we could do more to utilizing climbing sections, different
// elevations. Something that isnt just a straight line from point A to point B. Like, I want it to feel like you're actually
// traverversing corridors, different rooms, etc."; bible/11-Multiplayer/Elite-Gates-Ascent.md sections 3, 4 and 5): THE
// ROOMS' LAW - the torn academy's rooms as CODE-BUILT HERO RECORDS. A room is a hero fragment's law half (net/eliteGates/egFragLaw.js
// section 11.5's record: its floors as polygons at their heights, its stairs, its ceilings and open edges, its sockets in
// and out, its walk graph, its alcoves and lights, its proof) made by the hall law from the hall's own die rather than baked,
// and laid by the hero's machinery (net/eliteGates/egLaw.js - the relay's fair trail, the client's hero clamp and every reader of a
// hall's `heroes` read it as they read a hero). Beside the hero's own fields a room carries what the hero form has no word
// for: its WALLS (a wall a plan segment and its heights - the windows to the void are its gaps), its CLIMBS (a climb face,
// its pitches and rest ledges - section 4), its WELLS (where a fall inside it would skip ahead of its own stair) and its
// WAYS (the route through it - node to node, a walk, a stair, a climb, a drop - spec law 9's `route`).
//
// THE ARCHETYPES (section 3), each in its NATURAL FRAME (centimetres, y up, a socket's yaw the bearing its opening faces
// out - 0 along +z, 90 along +x), drawn off the hall's die (egRoomDraw: a few whole numbers, `p`) and built from them alone
// (egRoomBuild - pure, so a client that holds only the spec builds the walls the relay never needs):
//   stair      THE STAIR HALL - a square hall, a grand stair round two walls to a gallery 5-8 m up along the third; the
//              floor fight-ready; from 5 to 5.8 m a climb up the gallery's face is the fast way and the stair the long way
//              round (road 1)
//   tower      THE TOWER - a square drum, its stair round its well in two to three turns (8-15 m), a landing at each corner
//              and a window at each; in at its foot or its head, out at the other
//   gallery    THE GALLERY HALL - the library's two levels: the floor, and a gallery round three sides on its columns, two
//              stairs up at its near end
//   cloister   THE CLOISTER - a sunk court and an arcade walk round three of its sides; in at one front corner, out at the
//              other, the way round the three sides (two turns)
//   broken     THE BROKEN HALL - its floor fallen into the undercroft: the way drops off the near ledge and climbs the far
//              wall (two pitches and a rest ledge), a broken stair up its side the long way round; open to the sky, and its
//              side wall climbed off the way to a vantage and a cache
//   undercroft THE UNDERCROFT - a vaulted low hall, in and out below, a stair up its side bay to an upper door
//   crossing   THE CROSSING - two ways at two heights: the floor along it, a bridge across it 5.5-7 m up, a stair between
//   corridor   A CORRIDOR THAT TURNS - an L of the band's passage kit, a window to the void in its outer wall every few metres
//   switchback A SWITCHBACK - a corridor up (or down) and back, two flights side by side about a landing
//   scarp      THE SCARP - a terrace wall climbed in one or two pitches, a stair round its side the long way
// Any of a room's sockets may be its way in (egRoomPlace turns and moves the room so that socket stands at the hall's port,
// facing the way the company comes); its way out any other, at any height and on any side - above its mouth too.
//
// CLIMBING (section 4): a climb ON THE WAY (road 0) is pitches of EG_CLIMB_PITCH_MIN_CM to EG_CLIMB_PITCH_CM, at most
// EG_CLIMB_PITCHES in a row with a rest ledge EG_CLIMB_LEDGE_CM deep between them - the grip's own arithmetic, its numbers
// THE PROOFS' (net/eliteGates/egRouteProof.js - the climbing motor's, restated there once and pinned equal to player/parkour.js): at
// Climbing 0 with its fatigue spent a hold lasts EG_CLIMB_GRIP_MS, THE SPAN BUILD free-climbs EG_CLIMB_MMPS, and a pitch is
// its hang's reach plus three quarters of that climb. Every climb on the way has a stair beside it in its room (road 1 - the long way round). Off the way (road 2) a climb
// runs EG_CLIMB_SIDE_CM, a pitch to EG_CLIMB_SIDE_PITCH_CM, to a vantage and a cache never asked of anyone.
//
// Integer-exact (whole centimetres, axis-aligned - no transcendental runs: test/net/eliteGates/egplay_law.test.js's sweep). Pure. In the
// relay's bundle (net/eliteGates/egLaw.js imports it). Not a DFU member. Ledger A (ELITE-GATES).
import { EG_FRAG_V, EG_FRAGS, EG_FRAG_HEADROOM_CM, EG_ALCOVE_HOLDS, egFragArea2, egFragInPoly, egFragCeilAt } from './egFragLaw.js';
import { EG_CLIMB_MPS, EG_GRIP_S, EG_CLIMB_HANG_M, EG_CLIMB_LEDGE_MIN_M } from './egRouteProof.js';

/** The room record's version (a change to a room's law is a spec law - net/eliteGates/egLaw.js EG_SPEC). */
export const EG_ROOM_V = 1;
/** THE ARCHETYPES (section 3) and the ways that turn and climb between them. */
export const EG_ROOMS = Object.freeze(['stair', 'tower', 'gallery', 'cloister', 'broken', 'undercroft', 'crossing']);
export const EG_ROOM_WAYS = Object.freeze(['corridor', 'switchback', 'scarp']);
export const EG_ROOM_KINDS = Object.freeze([...EG_ROOMS, ...EG_ROOM_WAYS]);
/** Each archetype's name (the hall's words - a room is a fragment of the academy). */
export const EG_ROOM_NAMES = Object.freeze({
  stair: 'the Stair Hall', tower: 'the Tower', gallery: 'the Gallery Hall', cloister: 'the Cloister', broken: 'the Broken Hall', undercroft: 'the Undercroft',
  crossing: 'the Crossing', corridor: 'the Turning Corridor', switchback: 'the Switchback', scarp: 'the Scarp',
});

// ── CLIMBING (section 4): the grip's own arithmetic in the law's integers, from THE PROOFS' motor numbers ──────────
/** The free climb holds the lip within the hang's reach (net/eliteGates/egRouteProof.js EG_CLIMB_HANG_M - parkour.js PARKOUR_HANG_DROP
 *  and motor.js's 4 cm): a climb's last stretch is that reach (cm). */
export const EG_CLIMB_HANG_CM = Math.round(EG_CLIMB_HANG_M * 100);
/** A hold at Climbing 0 with its fatigue spent (egRouteProof.js EG_GRIP_S - parkour.js gripSeconds(0, 0)), in ms. */
export const EG_CLIMB_GRIP_MS = Math.round(EG_GRIP_S * 1000);
/** THE SPAN BUILD's free climb at Climbing 0 (egRouteProof.js EG_CLIMB_MPS - parkour.js freeClimbSpeed(walkSpeed(10), 0)),
 *  in millimetres a second, floored. */
export const EG_CLIMB_MMPS = Math.floor(EG_CLIMB_MPS * 1000);
/** The share of the hold a pitch on the way may spend (the rest is THE PROOFS' slack and the catch's margin), in quarters. */
export const EG_CLIMB_GRIP_QUARTERS = 3;
/** A PITCH ON THE WAY: at least this (cm - under it a mantle, never a climb), at most the hang's reach plus three quarters
 *  of THE SPAN BUILD's climb on a spent grip (184 + 116 = 300; the law takes 290 - THE PROOFS prove to 332). */
export const EG_CLIMB_PITCH_MIN_CM = 250;
export const EG_CLIMB_PITCH_CM = 290;
/** At most this many pitches in a row on the way, a rest ledge this deep between them (cm - a body stands on it and its
 *  grip comes back: THE PROOFS' EG_CLIMB_LEDGE_MIN_M stands a body, this half again), and never a climb on the way longer
 *  than this (cm). */
export const EG_CLIMB_PITCHES = 2;
export const EG_CLIMB_LEDGE_CM = Math.max(120, Math.round(EG_CLIMB_LEDGE_MIN_M * 100));
export const EG_CLIMB_WAY_MAX_CM = 900;
/** A climb OFF the way (road 2): its height (cm, least and most) and a pitch's most. */
export const EG_CLIMB_SIDE_CM = Object.freeze([600, 1400]);
export const EG_CLIMB_SIDE_PITCH_CM = 600;
/** A stair's steepest: its rise over its run at most this many fifths (31 degrees - the motor's slope limit is 70). */
export const EG_STAIR_FIFTHS = 3;
/** THE LONG WAY ROUND (section 4 - THE PROOFS' design ask: the climb the fast way, so it means something): a climb on the way
 *  has its stair in a bay beside its room, the stair (its rise's steepest, egStairRun) rising AWAY from the climb and a walk
 *  back beside it at the top - so at THE SPAN BUILD (Climbing 0, its fatigue spent, a rest on every ledge) the way round is
 *  never the quicker, and a body that climbs at all well climbs (test/net/eliteGates/law9_rooms.test.js times both by THE PROOFS' own legs).
 *  Its strips' width, its bottom landing's depth (the door in from the lower floor), its middle landing's and its top
 *  landing's (the door back in above) (cm). */
export const EG_ROUND = Object.freeze({ sw: 300, land: 400, mid: 300, top: 400 });
/** A room's door (cm): its width and height; a room's roof over its highest floor; a balustrade's height. */
export const EG_ROOM_DOOR = Object.freeze({ w: 500, h: 400 });
export const EG_ROOM_HEAD_CM = 450;
export const EG_ROOM_RAIL_CM = 110;
/** A doorway's depth into its room (cm): a socket's way crosses it square before it turns (THE THRESHOLDS). */
export const EG_ROOM_THRESHOLD_CM = 150;
/** A window to the void in a wall (cm): its sill over the floor, its head, its width, the wall between two. */
export const EG_ROOM_WINDOW = Object.freeze({ sill: 110, head: 300, w: 200, pier: 300 });

const between = (r, lo, hi) => lo + Math.floor(r() * (hi - lo + 1));
const half = (v) => Math.trunc(v / 2);
/** The integer square root (Newton's - the law's integers). */
export function egIsqrt(n) {
  const m = Math.trunc(n);
  if (!(m > 0)) return 0;
  let q = m, r = Math.trunc((q + 1) / 2);
  while (r < q) { q = r; r = Math.trunc((q + Math.trunc(m / q)) / 2); }
  return q;
}
/** A stair's least run (cm) for a rise: EG_STAIR_FIFTHS. */
export const egStairRun = (rise) => Math.ceil((Math.abs(rise) * 5) / EG_STAIR_FIFTHS);

// ── the builder ─────────────────────────────────────────────────────────────────────────────────────────────────────
/** The sides of an axis-aligned rectangle floor, in its edges' order (its outline counter-clockwise from (x0, z0)). */
const SIDES = Object.freeze(['-z', '+x', '+z', '-x']);
/** A rectangle's outline, counter-clockwise (x right, z up), from its two corners in any order. */
export const egRect = (xa, za, xb, zb) => { const x0 = Math.min(xa, xb), x1 = Math.max(xa, xb), z0 = Math.min(za, zb), z1 = Math.max(za, zb); return [[x0, z0], [x1, z0], [x1, z1], [x0, z1]]; };

/**
 * A ROOM'S BUILDER (cm, the natural frame). `s` mirrors it across x (1 or -1): every x the archetype says is multiplied by
 * it, and a side named for the unmirrored room ('-x', '+x') is turned with it, so one archetype lays both hands.
 * @param {number} s
 */
function builder(s) {
  /** @type {any} */
  const K = { floors: [], ramps: [], walls: [], ceil: [], sockets: [], nodes: [], links: [], climbs: [], wells: [], alcoves: [], lights: [], vantage: [] };
  const X = (x) => x * s;
  const side = (n) => (s < 0 && (n === '-x' || n === '+x') ? (n === '-x' ? '+x' : '-x') : n);
  K.X = X;
  /** a rectangle floor at `y`: `shut` the sides it is walled on (each '-x' | '+x' | '-z' | '+z', the unmirrored room's),
   *  the rest open (a drop, a stair, a door, a floor beside it); `fight` a floor the fight could stand on */
  K.floor = (y, xa, za, xb, zb, shut = '', fight = 0) => {
    const poly = egRect(X(xa), za, X(xb), zb), sh = (shut.match(/[-+][xz]/g) ?? []).map(side);
    K.floors.push({ y, poly, fight, open: SIDES.map((n, e) => (sh.includes(n) ? -1 : e)).filter((e) => e >= 0) });
    return K.floors.length - 1;
  };
  /** a floor of any outline (counter-clockwise once mirrored), its open edges by index */
  K.outline = (y, pts, open, fight = 0) => {
    let poly = pts.map(([x, z]) => [X(x), z]);
    let op = [...open];
    if (s < 0) { const n = poly.length; poly = [...poly].reverse(); op = op.map((e) => (((n - 2 - e) % n) + n) % n); }   // a mirror turns an outline: its edges renumbered
    K.floors.push({ y, poly, fight, open: op.sort((a, b) => a - b) });
    return K.floors.length - 1;
  };
  /** a rectangular stair from (xa, za) to (xb, zb), rising from y0 to y1 toward `dir` ('+x' | '-x' | '+z' | '-z', the
   *  unmirrored room's): its four corners each at its height, counter-clockwise */
  K.ramp = (xa, za, xb, zb, y0, y1, dir) => {
    const d = side(dir), poly = egRect(X(xa), za, X(xb), zb);
    const high = (p) => (d === '+x' ? p[0] === poly[1][0] : d === '-x' ? p[0] === poly[0][0] : d === '+z' ? p[1] === poly[2][1] : p[1] === poly[0][1]);
    K.ramps.push({ poly: poly.map((p) => [p[0], high(p) ? y1 : y0, p[1]]), y0, y1 });
    return K.ramps.length - 1;
  };
  /** a wall along (ax, az)-(bx, bz) from y0 to y1, its holes `[t0, t1, h0, h1]` (along it from a, cm; their heights) left
   *  open - a door, a window; `k` its kind ('w' a wall, 'r' a balustrade, 'c' a climb face, 'p' a pier) */
  K.wall = (ax, az, bx, bz, y0, y1, holes = [], k = 'w') => {
    const L = Math.abs(bx - ax) + Math.abs(bz - az);
    if (!(L > 0) || !(y1 > y0)) return;
    const cuts = [...new Set([0, L, ...holes.flatMap((h) => [Math.max(0, Math.min(L, h[0])), Math.max(0, Math.min(L, h[1]))])])].sort((a, b) => a - b);
    for (let i = 0; i + 1 < cuts.length; i++) {
      const t0 = cuts[i], t1 = cuts[i + 1], tm = (t0 + t1) / 2;
      let solid = [[y0, y1]];
      for (const h of holes) if (h[0] <= tm && tm <= h[1]) solid = solid.flatMap(([a, b]) => [[a, Math.min(b, h[2])], [Math.max(a, h[3]), b]]).filter(([a, b]) => b > a);
      const at = (t) => [ax + Math.trunc(((bx - ax) * t) / L), az + Math.trunc(((bz - az) * t) / L)];
      const [px, pz] = at(t0), [qx, qz] = at(t1);
      for (const [a, b] of solid) K.walls.push({ s: [X(px), pz, X(qx), qz], y0: a, y1: b, k });
    }
  };
  /** a ceiling (a roof's underside) at `y` over a rectangle */
  K.roof = (y, xa, za, xb, zb) => { K.ceil.push({ y, poly: egRect(X(xa), za, X(xb), zb) }); };
  /** a socket: its opening's middle at its foot (x, y, z), the bearing it faces out (`yaw`, the unmirrored room's), its
   *  width and height; `side` 1 for a side way's (road 2) - never the room's way in or out */
  K.sock = (x, y, z, yaw, w = EG_ROOM_DOOR.w, h = EG_ROOM_DOOR.h, sideWay = 0) => {
    const yw = s < 0 ? (360 - yaw) % 360 : yaw;
    K.sockets.push({ x: X(x), y, z, yaw: yw, w, h, side: sideWay, n: K.node(x, y, z) });
    return K.sockets.length - 1;
  };
  /** a node of the room's ways, and a link between two (`one` a way taken only from a to b - a drop, a climb; `climb` a climb
   *  link's climb, its number among the room's - THE PROOFS read a climb link's pitches off it) */
  K.node = (x, y, z) => { K.nodes.push([X(x), y, z]); return K.nodes.length - 1; };
  K.link = (a, b, kind, road = 0, one = 0, climb = -1) => { K.links.push({ a, b, kind, road, one, ...(climb >= 0 ? { climb } : {}) }); };
  /**
   * A CLIMB (section 4): its face along (ax, az)-(bx, bz) (the unmirrored room's), looking out toward (nx, nz), from its foot
   * `y0` up its `pitches` (cm each); between two pitches a rest ledge EG_CLIMB_LEDGE_CM deep, the next face that far back into
   * the wall. Lays the faces (walls of kind 'c') and the ledges (floors), records the climb, and answers the top face's line
   * (where the lip's floor begins), the climb's top and its number (`c` - its link's `climb`).
   */
  K.climb = (ax, az, bx, bz, nx, nz, y0, pitches, road = 0) => {
    let y = y0, off = 0;
    const ledges = [];
    pitches.forEach((h, k) => {
      const fx = -nx * off, fz = -nz * off;
      K.wall(ax + fx, az + fz, bx + fx, bz + fz, y, y + h, [], 'c');
      y += h;
      if (k + 1 < pitches.length) {
        const d = EG_CLIMB_LEDGE_CM, ex = -nx * d, ez = -nz * d;
        K.floor(y, ax + fx, az + fz, bx + fx + ex, bz + fz + ez, '');
        ledges.push(y);
        off += d;
      }
    });
    const fx = -nx * off, fz = -nz * off;
    K.climbs.push({ x0: X(ax), z0: az, x1: X(bx), z1: bz, y0, y1: y, ledges, face: [X(nx), nz], d: EG_CLIMB_LEDGE_CM, road });
    return { ax: ax + fx, az: az + fz, bx: bx + fx, bz: bz + fz, y, c: K.climbs.length - 1 };
  };
  /**
   * THE LONG WAY ROUND (EG_ROUND): a bay beside the room's wall at x = `xw` (outside it on +x when `dir` is 1, on -x when -1,
   * the unmirrored room's), two strips wide: from the room's lower floor `y0` through a door onto its bottom landing (ending at
   * z `zd`), up its stair `f` long along the wall AWAY from `zd`, across its middle landing, back along its outer strip at `y1`
   * to its top landing (from z `zd` to `zt` + its depth) and through a door onto the room's upper floor (which begins at z
   * `zt`). Never a floor over another: the stair, its landings and its walk stand side by side. Lays its floors, its stair, its
   * walls and its way (road 1); answers the doors' holes in the room's wall (`holes` - z along it, from and to, and their
   * heights) and its way's ends inside the room (`lo` by the bottom door, `hi` by the top).
   */
  K.round = (dir, xw, zd, zt, y0, y1, f) => {
    const { sw, land, mid, top } = EG_ROUND, xi = xw + dir * sw, xo = xw + 2 * dir * sw, ci = xw + dir * half(sw), co = xw + dir * (sw + half(sw));
    const zA = zd - land - f - mid, zE = zt + top, inS = dir > 0 ? '-x' : '+x', outS = dir > 0 ? '+x' : '-x', head = y1 + EG_ROOM_HEAD_CM;
    K.floor(y0, xw, zd - land, xi, zd, outS + '+z');   // the bottom landing (its door in on the room's side, its stair behind it)
    K.ramp(xw, zA + mid, xi, zd - land, y0, y1, '-z');   // the stair, rising away
    K.floor(y1, xw, zA, xo, zA + mid, '-z' + inS + outS);   // the middle landing
    K.floor(y1, xi, zA + mid, xo, zd, inS + outS);   // the walk back beside the stair
    K.floor(y1, xw, zd, xo, zE, outS + '+z');   // the top landing (its door back in on the room's side)
    K.wall(xo, zA, xo, zE, y0, head); K.wall(xw, zA, xo, zA, y0, head); K.wall(xw, zE, xo, zE, y0, head);
    K.wall(xi, zA + mid, xi, zd, y0, y1 + EG_ROOM_RAIL_CM);   // between the stair and the walk
    K.wall(xw, zd, xi, zd, y0, y1 + EG_ROOM_RAIL_CM);   // the bottom landing's end, the top landing's rail over it
    const zb = zd - half(land), zh = zt + half(top), sh = zA + half(mid);
    const lo = K.node(xw - dir * 100, y0, zb), b = K.node(ci, y0, zb), h = K.node(ci, y1, sh), m = K.node(co, y1, sh), t2 = K.node(co, y1, zh), t1 = K.node(ci, y1, zh), hi = K.node(xw - dir * 100, y1, zh);
    K.link(lo, b, 'walk', 1); K.link(b, h, 'stair', 1); K.link(h, m, 'walk', 1); K.link(m, t2, 'walk', 1); K.link(t2, t1, 'walk', 1); K.link(t1, hi, 'walk', 1);
    return { lo, hi, holes: [[zd - land + 50, zd - 50, y0, y0 + EG_ROOM_DOOR.h], [zt + 50, zE - 50, y1, y1 + EG_ROOM_DOOR.h]] };
  };
  /** a WELL (section 2's void zone, within a room): over a rectangle, from y0 to y1, where a fall from the room's upper ways
   *  lands ahead of its own stair - laid only when the room is taken downward */
  K.well = (xa, za, xb, zb, y0, y1) => { K.wells.push({ poly: egRect(X(xa), za, X(xb), zb), y0, y1 }); };
  /** an alcove (section 11.10): its point beyond a wall that faces along x (`side` the way out of the room it opens, the
   *  unmirrored room's), its floor's height, what it holds, its seal */
  K.alcove = (x, y, z, sd, holds, seal = 'seam') => { K.alcoves.push({ x: X(x), y, z, side: sd * s, holds, seal }); };
  K.light = (x, y, z, kind = 'band') => { K.lights.push([X(x), y, z, kind]); };
  /** a vantage (section 4's road 2 - the way ahead seen from over the hall): a place the side way ends at */
  K.look = (x, y, z) => { K.vantage.push([X(x), y, z]); };
  return K;
}

// ── THE ARCHETYPES ─────────────────────────────────────────────────────────────────────────────────────────────────────
/** The unmirrored bearing of a socket a builder stored (a mirror turns +x and -x). */
const yawOf = (K, q) => (K.X(1) < 0 ? (360 - q.yaw) % 360 : q.yaw);
/** A door cut for every used socket that opens in the wall from (ax, az) to (bx, bz) facing `yaw` (the unmirrored room's):
 *  its hole along the wall from a. */
function doorsIn(K, used, ax, az, bx, bz, yaw) {
  const holes = [];
  for (const so of used) {
    const q = K.sockets[so], ux = K.X(q.x);
    if (yawOf(K, q) !== yaw) continue;
    const along = az === bz ? q.z === az && Math.min(ax, bx) <= ux && ux <= Math.max(ax, bx) : ux === ax && Math.min(az, bz) <= q.z && q.z <= Math.max(az, bz);
    if (!along) continue;
    const t = az === bz ? Math.abs(ux - ax) : Math.abs(q.z - az);
    holes.push([t - half(q.w), t + half(q.w), q.y, q.y + q.h]);
  }
  return holes;
}
/** Windows to the void along a wall `L0` long at each storey `ys` (none within a metre of a door). */
function windowsIn(L0, ys, holes) {
  const out = [];
  for (const y of ys) for (let t = 400; t + EG_ROOM_WINDOW.w <= L0 - 300; t += EG_ROOM_WINDOW.w + EG_ROOM_WINDOW.pier) {
    if (holes.some((h) => h[0] < t + EG_ROOM_WINDOW.w + 100 && h[1] > t - 100 && h[2] < y + EG_ROOM_WINDOW.head && h[3] > y)) continue;
    out.push([t, t + EG_ROOM_WINDOW.w, y + EG_ROOM_WINDOW.sill, y + EG_ROOM_WINDOW.head]);
  }
  return out;
}
/** A rectangular room's four walls, x0 to x1 and z 0 to L (the unmirrored room's), from `foot` to `top`: every used
 *  socket's door cut, a window at every storey of `ys`, and on its +x and -x walls (`more[90]`, `more[270]`) the holes said
 *  by z (THE LONG WAY ROUND's doors - K.round's). */
function walls4(K, used, x0, x1, L, foot, top, ys = [], more = /** @type {Record<number, number[][]>} */ ({})) {
  for (const [ax, az, bx, bz, yaw] of [[x0, 0, x1, 0, 180], [x1, 0, x1, L, 90], [x1, L, x0, L, 0], [x0, L, x0, 0, 270]]) {
    const extra = (more[yaw] ?? []).map(([z0, z1, h0, h1]) => (yaw === 270 ? [L - z1, L - z0, h0, h1] : [z0, z1, h0, h1]));
    const holes = [...doorsIn(K, used, ax, az, bx, bz, yaw), ...extra], L0 = Math.abs(bx - ax) + Math.abs(bz - az);
    K.wall(ax, az, bx, bz, foot, top, [...holes, ...windowsIn(L0, ys, holes)]);
  }
}
/** A balustrade level at `y` along (ax, az)-(bx, bz), or climbing with a stair from `ya` to `yb`, in four lengths. */
function rail(K, ax, az, bx, bz, ya, yb = ya) {
  if (ya === yb) { K.wall(ax, az, bx, bz, ya, ya + EG_ROOM_RAIL_CM, [], 'r'); return; }
  const L = Math.abs(bx - ax) + Math.abs(bz - az), n = 4;
  const at = (t) => [ax + Math.trunc(((bx - ax) * t) / L), az + Math.trunc(((bz - az) * t) / L)], yAt = (t) => ya + Math.trunc(((yb - ya) * t) / L);
  for (let k = 0; k < n; k++) { const a = Math.trunc((L * k) / n), b = Math.trunc((L * (k + 1)) / n), [px, pz] = at(a), [qx, qz] = at(b); K.wall(px, pz, qx, qz, Math.min(yAt(a), yAt(b)), Math.max(yAt(a), yAt(b)) + EG_ROOM_RAIL_CM, [], 'r'); }
}

/**
 * Each archetype: `draw(r)` its whole numbers off the hall's die (its mirror last), `build(K, p, used)` the room from them -
 * its doors cut only where `used` (its sockets taken: its way in, its way out, its side ways) open; `pairs` the sockets a
 * company may enter by and leave by ([in, out], its own socket numbers - section 3's "its ways").
 */
const A = {};

/** THE STAIR HALL: p = [W, G, climb, mirror]. A square hall W across; a stair up the left wall to a landing, along the back
 *  wall to the gallery G up along the right; under the gallery a low way out to the side, under the back stair's high end
 *  a low way out ahead; from the gallery ways out to the side, back over the mouth, and ahead. With `climb` (G two pitches'
 *  height on the way) the gallery's face is climbed - the fast way - and the stair round three walls is the long way round
 *  (road 1): only where the way goes up from its mouth to the gallery's side or back over the mouth (sockets 0 to 3 or 4 - a
 *  climb is never taken down, and out ahead the stair's head is the gallery's own end, the quicker way). */
A.stair = {
  draw: (r) => { const G = between(r, 10, 16) * 50, climb = G <= 2 * EG_CLIMB_PITCH_CM && G >= 2 * EG_CLIMB_PITCH_MIN_CM && r() < 0.7 ? 1 : 0; return [between(r, 18, 22) * 100, G, climb, between(r, 0, 1)]; },
  build(K, [W, G, drawn], used) {
    const climb = drawn && used[0] === 0 && (used[1] === 3 || used[1] === 4) ? 1 : 0;
    const L = W, sw = 300, gw = 350, top = G + EG_ROOM_HEAD_CM, hw = half(W), D = EG_ROOM_DOOR, zs = half(L) - 300;
    K.floor(0, -hw, 0, hw, L, '-x', 1);
    K.ramp(-hw, 300, -hw + sw, L - sw, 0, half(G), '+z');
    K.floor(half(G), -hw, L - sw, -hw + sw, L, '-x+z');
    K.ramp(-hw + sw, L - sw, hw - gw, L, half(G), G, '+x');
    K.floor(G, hw - gw, 0, hw, L, '+x');
    K.roof(top, -hw, 0, hw, L);
    // the sockets: in below (0); out below ahead under the back stair's high end (1); out below to the side under the gallery
    // (2); the gallery's - to the side over it (3), back over the mouth (4), ahead (5)
    const xb = hw - gw - 200, dw = 300, run = W - sw - gw, under = half(G) + Math.trunc((half(G) * (xb - half(dw) - (-hw + sw))) / run) - 40;
    const s0 = K.sock(0, 0, 0, 180), s1 = K.sock(xb, 0, L, 0, dw, Math.min(D.h, under)), s2 = K.sock(hw, 0, zs, 90);
    const s3 = K.sock(hw, G, zs, 90), s4 = K.sock(hw - half(gw), G, 0, 180, gw - 50), s5 = K.sock(hw - half(gw), G, L, 0, gw - 50);
    const c = K.node(0, 0, half(L)), a0 = K.node(-hw + half(sw), 0, 200), a1 = K.node(-hw + half(sw), half(G), L - half(sw));
    const g1 = K.node(hw - half(gw), G, L - half(sw)), g0 = K.node(hw - half(gw), G, zs), g4 = K.node(hw - half(gw), G, 250);
    for (const so of [s0, s1, s2]) K.link(K.sockets[so].n, c, 'walk');
    K.link(c, a0, 'walk', climb ? 1 : 0); K.link(a0, a1, 'stair', climb ? 1 : 0); K.link(a1, g1, 'stair', climb ? 1 : 0);
    K.link(g1, g0, 'walk'); K.link(g0, g4, 'walk');
    K.link(K.sockets[s3].n, g0, 'walk'); K.link(K.sockets[s4].n, g4, 'walk'); K.link(K.sockets[s5].n, g1, 'walk');
    let z0 = L, z1 = L;
    if (climb) {
      // THE CLIMB (section 4): up the gallery's face in two pitches and a rest ledge - the gallery's block under it closed
      z0 = zs + 400; z1 = L - sw - 150;
      const p1 = half(G), t = K.climb(hw - gw - EG_CLIMB_LEDGE_CM, z1, hw - gw - EG_CLIMB_LEDGE_CM, z0, -1, 0, 0, [p1, G - p1], 0);
      const f = K.node(hw - gw - EG_CLIMB_LEDGE_CM - 60, 0, half(z0 + z1)), l = K.node(hw - gw + 50, G, half(z0 + z1));
      K.link(c, f, 'walk'); K.link(f, l, 'climb', 0, 1, t.c); K.link(l, g1, 'walk'); K.link(l, g0, 'walk');
      for (const z of [z0, z1]) { K.wall(t.ax, z, hw, z, 0, G); K.wall(hw - gw - EG_CLIMB_LEDGE_CM, z, hw - gw, z, 0, p1); }
    }
    walls4(K, used, -hw, hw, L, 0, top, [G]);
    rail(K, hw - gw, 0, hw - gw, Math.min(z0, L - sw), G); if (climb) rail(K, hw - gw, z1, hw - gw, L - sw, G);   // never across the back stair's head
    const r0 = 500, y0 = Math.trunc((half(G) * (r0 - 300)) / (L - sw - 300));   // its first 2 m unrailed (a way to its foot crosses its edge there)
    rail(K, -hw + sw, r0, -hw + sw, L - sw, y0, half(G)); rail(K, -hw + sw, L - sw, hw - gw, L - sw, half(G), G);
    K.light(-hw + 200, G + 250, half(L)); K.light(hw - 200, G + 250, 300); K.light(0, G + 300, L - 300);
    K.well(-hw + sw + 50, 50, hw - gw - (climb ? EG_CLIMB_LEDGE_CM + 50 : 50), L - sw - 50, 300, G - 50);
    K.alcoveAt = [[-hw - 120, 0, half(L), -1]];
  },
  pairs: [[0, 3], [0, 4], [0, 5], [0, 1], [0, 2], [3, 0], [4, 0], [5, 0], [4, 1], [5, 2], [3, 1]],
};

/** THE TOWER: p = [T, turns, q, mirror]. A square drum T inside, its stair round its well - a flight along each wall, a
 *  landing at each corner - `turns` times round, each flight rising q (two turns 8.8-14.8 m, three 12.6-15 m; a turn at least
 *  4 m over the one under it - 4 q, q at least 105); in at its foot through a door by the first flight's corner (its threshold
 *  passing under the first turn's last flight's head, 4 q up), out at its head through either wall of its top landing's
 *  corner; a window at every landing's corner, the one half way up a vantage over the hall. */
A.tower = {
  draw: (r) => { const turns = between(r, 2, 3), q = between(r, turns === 2 ? 22 : 21, turns === 2 ? 37 : 25) * 5; return [between(r, 9, 11) * 100, turns, q, between(r, 0, 1)]; },
  build(K, [T, turns, q], used) {
    const ht = half(T), sw = 250, n = 4 * turns, Ht = n * q, top = Ht + EG_ROOM_HEAD_CM;
    K.floor(0, -ht, 0, ht, T, '+x+z-x');
    K.roof(top, -ht, 0, ht, T);
    // a flight along each wall in turn, counter-clockwise from above (the +x wall going +z, the +z wall going -x, the -x wall
    // going -z, the -z wall going +x), each corner a landing
    const corners = [[ht - sw, T - sw, ht, T], [-ht, T - sw, -ht + sw, T], [-ht, 0, -ht + sw, sw], [ht - sw, 0, ht, sw]];
    const runs = [[ht - sw, sw, ht, T - sw, '+z'], [-ht + sw, T - sw, ht - sw, T, '-x'], [-ht, sw, -ht + sw, T - sw, '-z'], [-ht + sw, 0, ht - sw, sw, '+x']];
    const inner = [[ht - sw, sw, ht - sw, T - sw], [ht - sw, T - sw, -ht + sw, T - sw], [-ht + sw, T - sw, -ht + sw, sw], [-ht + sw, sw, ht - sw, sw]];
    const s0 = K.sock(ht - 240, 0, 0, 180, 480);   // the door as near the first flight's corner as it stands whole (its way under the flight's head)
    let prev = K.node(ht - half(sw), 0, sw - 50);
    K.link(K.sockets[s0].n, prev, 'walk');
    const landings = [];
    for (let k = 0; k < n; k++) {
      const w = k % 4, [xa, za, xb, zb, dir] = runs[w], [cx0, cz0, cx1, cz1] = corners[w];
      K.ramp(xa, za, xb, zb, k * q, (k + 1) * q, dir);
      K.floor((k + 1) * q, cx0, cz0, cx1, cz1, ['+x+z', '-x+z', '-x-z', '+x-z'][w]);
      const nd = K.node(half(cx0 + cx1), (k + 1) * q, half(cz0 + cz1));
      K.link(prev, nd, 'stair');
      prev = nd;
      landings.push([w, (k + 1) * q]);
      const [ia, ib, ic, id] = inner[w];
      K.wall(ia, ib, ic, id, k * q, (k + 1) * q + EG_ROOM_RAIL_CM, [], 'r');   // the well's rail, climbing with its flight
    }
    // the head: a door through either wall of the top landing's corner
    const w = landings[n - 1][0], [cx0, cz0, cx1, cz1] = corners[w], mx = half(cx0 + cx1), mz = half(cz0 + cz1);
    const outs = [[[ht, mz, 90], [mx, T, 0]], [[mx, T, 0], [-ht, mz, 270]], [[-ht, mz, 270], [mx, 0, 180]], [[mx, 0, 180], [ht, mz, 90]]][w];
    for (const [x, z, yaw] of outs) { const so = K.sock(x, Ht, z, yaw, sw - 10); K.link(K.sockets[so].n, prev, 'walk'); }
    // the drum: its four walls, the doors cut, a window at each landing's corner on that wall
    for (const [ax, az, bx, bz, yaw] of [[-ht, 0, ht, 0, 180], [ht, 0, ht, T, 90], [ht, T, -ht, T, 0], [-ht, T, -ht, 0, 270]]) {
      const holes = doorsIn(K, used, ax, az, bx, bz, yaw);
      for (const [lw, y] of landings) {
        const [a0, b0, a1, b1] = corners[lw], on = yaw === 180 ? b0 === 0 : yaw === 0 ? b1 === T : yaw === 90 ? a1 === ht : a0 === -ht;
        if (!on) continue;
        const t = yaw === 180 || yaw === 0 ? Math.abs(half(a0 + a1) - ax) : Math.abs(half(b0 + b1) - az);
        if (holes.some((h) => h[0] < t + 150 && h[1] > t - 150 && h[2] < y + EG_ROOM_WINDOW.head && h[3] > y)) continue;
        holes.push([t - 70, t + 70, y + EG_ROOM_WINDOW.sill, y + EG_ROOM_WINDOW.head]);
      }
      K.wall(ax, az, bx, bz, 0, top, holes);
    }
    const mid = landings[Math.max(0, n - 5)], [m0, n0, m1, n1] = corners[mid[0]];
    K.look(half(m0 + m1), mid[1], half(n0 + n1));
    K.light(0, half(Ht), half(T)); K.light(0, Ht + 200, half(T));
    K.well(-ht + sw + 30, sw + 30, ht - sw - 30, T - sw - 30, 300, Ht - 50);
  },
  pairs: [[0, 1], [0, 2], [1, 0], [2, 0]],
};

/** THE GALLERY HALL: p = [W, L, G, mirror]. The library's floor W by L, a gallery G up round three sides (its two long sides
 *  and its far end), a stair up each side wall at the near end onto it; ways out below at the far end, from the gallery to
 *  either side and over the far end. */
A.gallery = {
  draw: (r) => [between(r, 15, 18) * 100, between(r, 24, 30) * 100, between(r, 9, 11) * 50, between(r, 0, 1)],
  build(K, [W, L, G], used) {
    const hw = half(W), gw = 300, run = egStairRun(G) + 50, z0 = 250, zs = z0 + run, top = G + EG_ROOM_HEAD_CM;
    K.floor(0, -hw, 0, hw, L, '-x+x', 1);
    for (const sd of [-1, 1]) {
      K.ramp(sd * hw, z0, sd * (hw - gw), zs, 0, G, '+z');
      K.floor(G, sd * hw, zs, sd * (hw - gw), L - gw, sd < 0 ? '-x' : '+x');
      rail(K, sd * (hw - gw), z0, sd * (hw - gw), zs, 0, G); rail(K, sd * (hw - gw), zs, sd * (hw - gw), L - gw, G);
    }
    K.floor(G, -hw, L - gw, hw, L, '+z');
    rail(K, -hw + gw, L - gw, hw - gw, L - gw, G);
    K.roof(top, -hw, 0, hw, L);
    const zm = half(zs + L - gw);
    const s0 = K.sock(0, 0, 0, 180), s1 = K.sock(0, 0, L, 0, EG_ROOM_DOOR.w, Math.min(EG_ROOM_DOOR.h, G - 50));
    const s2 = K.sock(hw, G, zm, 90, gw - 40), s3 = K.sock(-hw, G, zm, 270, gw - 40), s4 = K.sock(hw - 900, G, L, 0, EG_ROOM_DOOR.w - 100);
    const c = K.node(0, 0, half(L));
    K.link(K.sockets[s0].n, c, 'walk'); K.link(c, K.sockets[s1].n, 'walk');
    for (const sd of [-1, 1]) {
      const f = K.node(sd * (hw - half(gw)), 0, z0 - 60), t = K.node(sd * (hw - half(gw)), G, zs + 60), g = K.node(sd * (hw - half(gw)), G, zm), b = K.node(sd * (hw - half(gw)), G, L - half(gw));
      K.link(K.sockets[s0].n, f, 'walk'); K.link(f, t, 'stair'); K.link(t, g, 'walk'); K.link(g, b, 'walk'); K.link(g, K.sockets[sd < 0 ? s3 : s2].n, 'walk');
      if (sd > 0) { const e = K.node(hw - 900, G, L - half(gw)); K.link(b, e, 'walk'); K.link(e, K.sockets[s4].n, 'walk'); }
    }
    walls4(K, used, -hw, hw, L, 0, top, [G]);
    K.light(0, G + 300, half(L)); K.light(hw - 150, G + 250, L - 200); K.light(-hw + 150, G + 250, L - 200);
    K.alcoveAt = [[hw + 120, 0, half(L) - 300, 1], [-hw - 120, 0, half(L) + 300, -1]];
    K.well(-hw + gw + 50, zs + 50, hw - gw - 50, L - gw - 50, 300, G - 50);
  },
  pairs: [[0, 1], [0, 2], [0, 3], [0, 4], [2, 0], [3, 0], [4, 0], [4, 1], [2, 1], [3, 1]],
};

/** THE CLOISTER: p = [C, sink, mirror]. A court C across sunk `sink` under an arcade walk round three of its sides (its near
 *  side a garden wall); in at the left walk's near end, round the left, the back and the right (two turns), out at the right
 *  walk's near end - back the way it came, beside its way in - or out of the right walk's side. The court a fight floor, a
 *  stair down into it from each side walk; off the way the arcade's roof over the back walk, climbed from the court's far
 *  side - a vantage over the cloister. */
A.cloister = {
  draw: (r) => [between(r, 14, 20) * 100, between(r, 4, 5) * 30, between(r, 0, 1)],
  build(K, [C, sink], used) {
    const w = 350, S = C + 2 * w, x0 = -half(w), x1 = x0 + S, top = EG_ROOM_HEAD_CM, roofY = top + 50, cx = x0 + half(S), zm = half(S);
    K.floor(0, x0, 0, x0 + w, S, '-x+z');
    K.floor(0, x0 + w, S - w, x1 - w, S, '+z');
    K.floor(0, x1 - w, 0, x1, S, '+z');
    K.floor(-sink, x0 + w, w, x1 - w, S - w, '-z', 1);
    const run = egStairRun(sink) + 30;
    K.ramp(x0 + w, zm - 150, x0 + w + run, zm + 150, -sink, 0, '-x');
    K.ramp(x1 - w - run, zm - 150, x1 - w, zm + 150, -sink, 0, '+x');
    for (const [xa, za, xb, zb] of [[x0, 0, x0 + w, S], [x0 + w, S - w, x1 - w, S], [x1 - w, 0, x1, S]]) K.roof(top, xa, za, xb, zb);
    const s0 = K.sock(0, 0, 0, 180, w - 40), s1 = K.sock(x1 - half(w), 0, 0, 180, w - 40), s2 = K.sock(x1, 0, w + 150, 90, 300);
    const a = K.node(0, 0, S - half(w)), b = K.node(x1 - half(w), 0, S - half(w));
    K.link(K.sockets[s0].n, a, 'walk'); K.link(a, b, 'walk'); K.link(b, K.sockets[s1].n, 'walk'); K.link(b, K.sockets[s2].n, 'walk');
    const ml = K.node(x0 + half(w), 0, zm), mr = K.node(x1 - half(w), 0, zm), m = K.node(cx, -sink, zm);
    K.link(K.sockets[s0].n, ml, 'walk', 2); K.link(ml, m, 'stair', 2); K.link(m, mr, 'stair', 2); K.link(mr, K.sockets[s1].n, 'walk', 2);
    // off the way: the arcade's roof over the back walk, climbed up a pier of its arcade from the court
    const h = roofY + sink, ps = h > EG_CLIMB_SIDE_PITCH_CM ? [half(h), h - half(h)] : [h], zc = S - w - (ps.length - 1) * EG_CLIMB_LEDGE_CM;
    const cl = K.climb(x1 - w - 500, zc, x1 - w - 200, zc, 0, -1, -sink, ps, 2);
    K.floor(roofY, x0 + w, S - w, x1 - w, S, '+z');
    const f = K.node(x1 - w - 350, -sink, zc - 80), lip = K.node(x1 - w - 350, roofY, S - w + 60), v = K.node(cx, roofY, S - half(w));
    K.link(m, f, 'walk', 2); K.link(f, lip, 'climb', 2, 1, cl.c); K.link(lip, v, 'walk', 2);
    K.look(cx, roofY, S - half(w));
    // the walls: the outer three (the doors cut), the garden wall on the court's near side and the near walks' ends, the
    // retaining walls round the sunk court with their rails (open at the two stairs), the vantage's parapet
    const outer = [[x0, S, x0, 0, 270], [x0, S, x1, S, 0], [x1, S, x1, 0, 90]];
    for (const [ax, az, bx, bz, yaw] of outer) K.wall(ax, az, bx, bz, -sink, yaw === 0 ? roofY + EG_ROOM_RAIL_CM : top, doorsIn(K, used, ax, az, bx, bz, yaw));
    K.wall(x0, 0, x0 + w, 0, 0, top, doorsIn(K, used, x0, 0, x0 + w, 0, 180));
    K.wall(x1 - w, 0, x1, 0, 0, top, doorsIn(K, used, x1 - w, 0, x1, 0, 180));
    K.wall(x0 + w, 0, x1 - w, 0, -sink, 150);
    K.wall(x0 + w, 0, x0 + w, w, -sink, top); K.wall(x1 - w, 0, x1 - w, w, -sink, top);
    for (const xs of [x0 + w, x1 - w]) { K.wall(xs, w, xs, zm - 150, -sink, EG_ROOM_RAIL_CM, [], 'r'); K.wall(xs, zm + 150, xs, S - w, -sink, EG_ROOM_RAIL_CM, [], 'r'); }
    K.wall(x0 + w, S - w, x1 - w - 500, S - w, -sink, EG_ROOM_RAIL_CM, [], 'r'); K.wall(x1 - w - 200, S - w, x1 - w, S - w, -sink, EG_ROOM_RAIL_CM, [], 'r');
    for (const xe of [x1 - w - 500, x1 - w - 200]) K.wall(xe, zc, xe, S - w, -sink, -sink + ps[0]);   // the buttress's sides
    rail(K, x0 + w, S - w, x1 - w - 600, S - w, roofY);
    K.light(cx, 300, S - half(w)); K.light(x0 + half(w), 300, zm); K.light(x1 - half(w), 300, zm);
    K.alcoveAt = [[x1 + 120, 0, S - w - 300, 1]];
  },
  pairs: [[0, 1], [0, 2], [1, 0], [2, 0]],
};

/** THE BROKEN HALL: p = [W, L, D, P, H, mirror]. Its floor fallen D into the undercroft: the near ledge, the drop off its
 *  edge, the undercroft, the far wall climbed P in two pitches and a rest ledge onto the far ledge (the fast way); THE LONG WAY
 *  ROUND in a bay beside its left wall (road 1 - K.round); open to the sky. Off the way the right wall climbed H from the
 *  undercroft to a high ledge - a vantage over the hall, a cache in its niche. */
A.broken = {
  draw: (r) => [between(r, 13, 16) * 100, between(r, 24, 30) * 100, between(r, 40, 45) * 10, between(r, 2 * EG_CLIMB_PITCH_MIN_CM / 10, 2 * EG_CLIMB_PITCH_CM / 10) * 10, between(r, 7, 10) * 100, between(r, 0, 1)],
  build(K, [W, L, D, P, H], used) {
    const hw = half(W), near = 400, far = 500, p1 = half(P), zf = L - far - EG_CLIMB_LEDGE_CM, E = P - D;
    K.floor(0, -hw, 0, hw, near, '-x+x');   // the near ledge (its far edge the drop)
    K.floor(-D, -hw, near, hw, zf, '-x+x', 1);   // the undercroft
    const t = K.climb(-hw, zf, hw, zf, 0, -1, -D, [p1, P - p1], 0);
    K.floor(E, -hw, t.az, hw, L, '-x+x');   // the far ledge, from the top face on - E over the near ledge
    const rd = K.round(-1, -hw, zf, t.az, -D, E, egStairRun(P));   // THE LONG WAY ROUND, beside the left wall
    const s0 = K.sock(0, 0, 0, 180), s1 = K.sock(0, E, L, 0), s2 = K.sock(hw, E, L - half(L - t.az), 90, 400);
    const e = K.node(0, 0, near - 60), u = K.node(0, -D, near + 200), f = K.node(0, -D, zf - 60), tp = K.node(0, E, t.az + 100);
    K.link(K.sockets[s0].n, e, 'walk'); K.link(e, u, 'drop', 0, 1); K.link(u, f, 'walk'); K.link(f, tp, 'climb', 0, 1, t.c);
    K.link(u, rd.lo, 'walk', 1); K.link(rd.hi, tp, 'walk', 1);
    K.link(tp, K.sockets[s1].n, 'walk'); K.link(tp, K.sockets[s2].n, 'walk');
    // off the way: the right wall climbed H from the undercroft to a high ledge - a vantage, a cache in its niche
    const zc = half(near + zf) - 100, ps = H > EG_CLIMB_SIDE_PITCH_CM ? [half(H), H - half(H)] : [H];
    const c = K.climb(hw - 300, zc + 250, hw - 300, zc - 250, -1, 0, -D, ps, 2);
    K.floor(c.y, c.ax, zc - 250, hw, zc + 250, '+x');
    const cf = K.node(hw - 380, -D, zc), cv = K.node(hw - 100, c.y, zc);
    K.link(u, cf, 'walk', 2); K.link(cf, cv, 'climb', 2, 1, c.c);
    K.look(hw - 100, c.y, zc);
    K.wall(c.ax, zc - 250, hw, zc - 250, -D, c.y); K.wall(c.ax, zc + 250, hw, zc + 250, -D, c.y);
    for (let k = 1; k < ps.length; k++) K.wall(hw - 300, zc - 250, hw - 300 + EG_CLIMB_LEDGE_CM * k, zc - 250, -D, -D + ps.slice(0, k).reduce((a, b) => a + b, 0));
    // the walls: round the box from the undercroft up (the doors cut - the way round's in the left wall), the near ledge's
    // broken face under its edge and a rail along it but where the way drops
    walls4(K, used, -hw, hw, L, -D, Math.max(500 + E, c.y + 250), [], { 270: rd.holes });
    K.wall(-hw, near, hw, near, -D, 0);
    rail(K, -hw, near, -250, near, 0); rail(K, 250, near, hw, near, 0);
    K.light(0, 300, near + 300); K.light(0, 250 + E, L - 300); K.light(hw - 150, c.y + 250, zc);
    K.alcoveAt = [[hw + 120, c.y, zc, 1, 'jump']];
  },
  pairs: [[0, 1], [0, 2]],
};

/** THE UNDERCROFT: p = [W, L, U, mirror]. A vaulted low hall W by L, in at its near end and out at its far, a side bay on
 *  its right whose stair climbs U to an upper door ahead or to the side (out above). */
A.undercroft = {
  draw: (r) => [between(r, 12, 15) * 100, between(r, 20, 26) * 100, between(r, 10, 12) * 50, between(r, 0, 1)],
  build(K, [W, L, U], used) {
    const hw = half(W), bay = 400, run = egStairRun(U) + 50, top = EG_ROOM_HEAD_CM, zb0 = L - run - 300, xb = hw + bay;
    K.floor(0, -hw, 0, hw, L, '-x', 1);
    K.roof(top, -hw, 0, hw, L);
    K.floor(0, hw, 0, xb, zb0, '+x-z');
    K.ramp(hw, zb0, xb, zb0 + run, 0, U, '+z');
    K.floor(U, hw, zb0 + run, xb, L, '');
    K.roof(U + top, hw, 0, xb, L);
    const s0 = K.sock(0, 0, 0, 180), s1 = K.sock(0, 0, L, 0), s2 = K.sock(hw + half(bay), U, L, 0, bay - 40), s3 = K.sock(xb, U, L - 150, 90, 260);
    const c = K.node(0, 0, half(L)), f = K.node(hw + half(bay), 0, zb0 - 200), h = K.node(hw + half(bay), U, zb0 + run + 60);   // its foot before the bay's rail
    K.link(K.sockets[s0].n, c, 'walk'); K.link(c, K.sockets[s1].n, 'walk'); K.link(c, f, 'walk'); K.link(f, h, 'stair'); K.link(h, K.sockets[s2].n, 'walk'); K.link(h, K.sockets[s3].n, 'walk');
    // the walls: the hall's (low, under its vault) and the bay's (tall, over its stair), the doors cut; the bay over the vault
    // closed off from the hall's roof up
    K.wall(-hw, 0, hw, 0, 0, top, doorsIn(K, used, -hw, 0, hw, 0, 180)); K.wall(hw, 0, xb, 0, 0, U + top);
    K.wall(hw, L, -hw, L, 0, top, doorsIn(K, used, hw, L, -hw, L, 0)); K.wall(xb, L, hw, L, 0, U + top, doorsIn(K, used, xb, L, hw, L, 0));
    K.wall(-hw, L, -hw, 0, 0, top);
    K.wall(xb, 0, xb, L, 0, U + top, doorsIn(K, used, xb, 0, xb, L, 90));
    K.wall(hw, 0, hw, L, top, U + top);
    K.wall(hw, zb0, hw, zb0 + run, 0, top, [], 'r');
    K.light(0, 300, half(L)); K.light(hw + half(bay), U + 250, L - 150);
    K.alcoveAt = [[-hw - 120, 0, half(L), -1]];
  },
  pairs: [[0, 1], [0, 2], [0, 3], [1, 0], [2, 0], [3, 0], [2, 1], [1, 2]],
};

/** THE CROSSING: p = [S, B, mirror]. A hall S square where two ways cross at two heights - the floor along it, a bridge
 *  across it B up - and a stair up the right wall from the floor onto the bridge: so the way comes in below and leaves
 *  across the top, over its own way in. */
A.crossing = {
  draw: (r) => [between(r, 20, 24) * 100, between(r, 11, 13) * 50, between(r, 0, 1)],
  build(K, [S, B], used) {
    const hs = half(S), bw = 400, run = egStairRun(B) + 50, sw = 300, zb = 100 + run + half(bw), top = B + EG_ROOM_HEAD_CM;
    K.floor(0, -hs, 0, hs, S, '-x+x', 1);
    K.floor(B, -hs, zb - half(bw), hs, zb + half(bw), '');
    K.ramp(hs - sw, 100, hs, zb - half(bw), 0, B, '+z');
    K.roof(top, -hs, 0, hs, S);
    const s0 = K.sock(0, 0, 0, 180), s1 = K.sock(0, 0, S, 0), s2 = K.sock(-hs, B, zb, 270, bw - 40), s3 = K.sock(hs, B, zb, 90, bw - 40);
    const c = K.node(0, 0, zb + half(bw) + 300), f = K.node(hs - half(sw), 0, 40), t = K.node(hs - half(sw), B, zb), m = K.node(0, B, zb);
    K.link(K.sockets[s0].n, c, 'walk'); K.link(c, K.sockets[s1].n, 'walk'); K.link(K.sockets[s0].n, f, 'walk'); K.link(f, t, 'stair');
    K.link(t, K.sockets[s3].n, 'walk'); K.link(t, m, 'bridge'); K.link(m, K.sockets[s2].n, 'bridge');
    walls4(K, used, -hs, hs, S, 0, top, [B]);
    rail(K, -hs, zb - half(bw), hs - sw, zb - half(bw), B); rail(K, -hs, zb + half(bw), hs, zb + half(bw), B);
    rail(K, hs - sw, 100, hs - sw, zb - half(bw), 0, B);
    K.light(0, B + 250, zb); K.light(0, 300, zb + half(bw) + 400);
    K.alcoveAt = [[-hs - 120, 0, zb + half(bw) + 400, -1]];
    K.well(-hs + 50, zb + half(bw) + 100, hs - 50, S - 50, 300, B - 50);
    K.well(-hs + 50, 50, hs - sw - 50, zb - half(bw) - 100, 300, B - 50);
  },
  pairs: [[0, 2], [0, 3], [0, 1], [2, 0], [3, 0], [2, 3], [3, 2], [2, 1], [3, 1]],
};

/** A CORRIDOR THAT TURNS: p = [a, b, rise, mirror]. In at its foot along +z for `a`, turning right along +x for `b` to its
 *  door, its second leg a stair of `rise` (0 level, negative down); a window to the void every few metres in its outer
 *  walls. The band's passage kit dresses it. */
A.corridor = {
  draw: (r) => [between(r, 12, 22) * 100, between(r, 12, 22) * 100, r() < 0.4 ? 0 : between(r, -3, 4) * 50, between(r, 0, 1)],
  build(K, [a, b, rise], used) {
    const cw = 450, h = half(cw), run = b - h, xe = h + run + 150, y1 = EG_ROOM_HEAD_CM + Math.max(0, rise), lo = Math.min(0, rise);
    K.floor(0, -h, 0, h, a + h, '-x+z');
    if (rise) { K.ramp(h, a - h, h + run, a + h, lo, Math.max(0, rise), rise > 0 ? '+x' : '-x'); K.floor(rise, h + run, a - h, xe, a + h, '-z+z'); }
    else K.floor(0, h, a - h, xe, a + h, '-z+z');
    K.roof(y1, -h, 0, h, a + h); K.roof(y1, h, a - h, xe, a + h);
    const s0 = K.sock(0, 0, 0, 180, cw - 50), s1 = K.sock(xe, rise, a, 90, cw - 50);
    const c = K.node(0, 0, a), e = K.node(h + run + 70, rise, a);
    K.link(K.sockets[s0].n, c, 'walk'); K.link(c, e, rise ? 'stair' : 'walk'); K.link(e, K.sockets[s1].n, 'walk');
    const win = (L0, y) => windowsIn(L0, [y], []);
    K.wall(-h, 0, -h, a + h, lo, y1, win(a + h, 0));
    K.wall(-h, a + h, xe, a + h, lo, y1, win(xe + h, Math.max(0, rise)));
    K.wall(h, 0, h, a - h, lo, y1); K.wall(h, a - h, xe, a - h, lo, y1);
    K.wall(-h, 0, h, 0, lo, y1, doorsIn(K, used, -h, 0, h, 0, 180));
    K.wall(xe, a - h, xe, a + h, lo, y1, doorsIn(K, used, xe, a - h, xe, a + h, 90));
    K.light(0, 250, half(a)); K.light(h + half(run), 250 + Math.max(0, rise), a);
  },
  pairs: [[0, 1], [1, 0]],
};

/** A SWITCHBACK: p = [len, rise, mirror]. A corridor up a stair along +z, a landing, and back up a second stair along -z
 *  beside the first, out at the near end `rise` over its mouth - the way back the way it came, higher; windows to the void
 *  in its outer walls. Taken the other way it is the way down. */
A.switchback = {
  draw: (r) => [between(r, 16, 24) * 100, between(r, 9, 16) * 50, between(r, 0, 1)],
  build(K, [len, rise], used) {
    const cw = 400, h = half(cw), r1 = half(rise), land = 450, foot = 300, run = len - foot - land, x2 = h + cw, y1 = rise + EG_ROOM_HEAD_CM;
    K.floor(0, -h, 0, h, foot, '-x+x');
    K.ramp(-h, foot, h, foot + run, 0, r1, '+z');
    K.floor(r1, -h, foot + run, x2, len, '-x+z+x');
    K.ramp(h, foot + run, x2, foot, r1, rise, '-z');
    K.floor(rise, h, 0, x2, foot, '+x-x');
    K.roof(y1, -h, 0, x2, len);
    const s0 = K.sock(0, 0, 0, 180, cw - 50), s1 = K.sock(h + half(cw), rise, 0, 180, cw - 50);
    const a = K.node(0, 0, foot - 60), b = K.node(0, r1, foot + run + half(land)), c = K.node(h + half(cw), r1, foot + run + half(land)), d = K.node(h + half(cw), rise, foot - 60);
    K.link(K.sockets[s0].n, a, 'walk'); K.link(a, b, 'stair'); K.link(b, c, 'walk'); K.link(c, d, 'stair'); K.link(d, K.sockets[s1].n, 'walk');
    K.wall(-h, 0, -h, len, 0, y1, windowsIn(len, [r1], []));
    K.wall(x2, 0, x2, len, 0, y1, windowsIn(len, [r1], []));
    K.wall(x2, len, -h, len, 0, y1);
    K.wall(-h, 0, x2, 0, 0, y1, doorsIn(K, used, -h, 0, x2, 0, 180));
    K.wall(h, 0, h, foot + run, 0, y1);
    K.light(0, 250, half(len)); K.light(h + half(cw), r1 + 250, half(len));
  },
  pairs: [[0, 1], [1, 0]],
};

/** THE SCARP: p = [W, rise, mirror]. A foot yard, a terrace wall climbed in one or two pitches onto the terrace (the fast
 *  way), THE LONG WAY ROUND in a bay beside the yard's right side (road 1 - K.round); open to the sky, a parapet round the
 *  terrace; out ahead or to either side of the terrace (beyond the way round's top landing). */
A.scarp = {
  draw: (r) => { const two = r() < 0.6; return [between(r, 14, 18) * 100, two ? between(r, 2 * EG_CLIMB_PITCH_MIN_CM / 10, 2 * EG_CLIMB_PITCH_CM / 10) * 10 : between(r, EG_CLIMB_PITCH_MIN_CM / 10, EG_CLIMB_PITCH_CM / 10) * 10, between(r, 0, 1)]; },
  build(K, [W, rise], used) {
    const hw = half(W), terr = 700 + EG_ROUND.top, f0 = egStairRun(rise), F = EG_ROUND.land + f0 + EG_ROUND.mid + 200, two = rise > EG_CLIMB_PITCH_CM;
    K.floor(0, -hw, 0, hw, F, '-x+x');
    const t = K.climb(-hw, F, hw, F, 0, -1, 0, two ? [half(rise), rise - half(rise)] : [rise], 0);
    K.floor(rise, -hw, t.az, hw, t.az + terr, '');
    const rd = K.round(1, hw, F, t.az, 0, rise, f0);   // THE LONG WAY ROUND, beside the yard's right side
    const zt = t.az + EG_ROUND.top + half(terr - EG_ROUND.top);
    const s0 = K.sock(0, 0, 0, 180), s1 = K.sock(0, rise, t.az + terr, 0), s2 = K.sock(-hw, rise, zt, 270, 400), s3 = K.sock(hw, rise, zt, 90, 400);
    const f = K.node(-200, 0, F - 60), tp = K.node(-200, rise, t.az + 100), m = K.node(0, rise, zt);
    K.link(K.sockets[s0].n, f, 'walk'); K.link(f, tp, 'climb', 0, 1, t.c);
    K.link(K.sockets[s0].n, rd.lo, 'walk', 1); K.link(rd.hi, tp, 'walk', 1);
    K.link(tp, m, 'walk');
    for (const so of [s1, s2, s3]) K.link(m, K.sockets[so].n, 'walk');
    const ztop = t.az + terr;
    K.wall(-hw, ztop, -hw, 0, 0, rise + EG_ROOM_RAIL_CM, doorsIn(K, used, -hw, ztop, -hw, 0, 270));
    K.wall(hw, 0, hw, ztop, 0, rise + EG_ROOM_RAIL_CM, [...doorsIn(K, used, hw, 0, hw, ztop, 90), ...rd.holes]);
    K.wall(hw, ztop, -hw, ztop, rise, rise + EG_ROOM_RAIL_CM, doorsIn(K, used, hw, ztop, -hw, ztop, 0));
    K.wall(-hw, 0, hw, 0, 0, EG_ROOM_RAIL_CM, doorsIn(K, used, -hw, 0, hw, 0, 180));
    K.light(0, rise + 300, zt);
  },
  pairs: [[0, 1], [0, 2], [0, 3]],
};

/**
 * THE ROOM'S DIE (section 3): archetype `k`'s whole numbers off the hall's die `r` (egRoomBuild's `p`). Pure.
 * @param {string} k @param {() => number} r
 */
export function egRoomDraw(k, r) { return A[k].draw(r); }
/** The sockets an archetype may be entered by and left by: `[in, out]` pairs, its own socket numbers. */
export const egRoomPairs = (k) => A[k]?.pairs ?? [];

/**
 * A ROOM BUILT (section 3; cm, its natural frame): archetype `k` from its whole numbers `p` (egRoomDraw's - the last is its
 * mirror), its `used` sockets (its way in first, then its ways out and its side ways: only these are cut through its walls),
 * in band `band`'s kit `kit`. `{ k, p, kit, band, cls, floors, ramps, ceil, walls, sockets, way, climbs, wells, alcoves,
 * lights, vantage }`. Pure: the hall law and a client holding only the spec build the same room.
 * @param {string} k @param {ReadonlyArray<number>} p @param {ReadonlyArray<number>} used @param {number} band @param {string} kit
 */
export function egRoomBuild(k, p, used, band, kit) {
  const mirror = p[p.length - 1] ? -1 : 1, K = builder(mirror);
  A[k].build(K, p, used);
  thresholds(K);
  const way = { nodes: K.nodes, links: K.links };
  const holds = EG_ALCOVE_HOLDS;
  const alcoves = (K.alcoveAt ?? []).map(([x, y, z, sd, seal], i) => ({ x: K.X(x), y, z, side: sd * mirror, holds: holds[(p[0] + i) % holds.length], seal: seal ?? 'seam' }));
  return { k, p: [...p], kit, band, cls: k === 'corridor' || k === 'switchback' || k === 'tower' ? 'passage' : 'chamber', floors: K.floors, ramps: K.ramps, ceil: K.ceil, walls: K.walls, sockets: K.sockets, way, climbs: K.climbs, wells: K.wells, alcoves, lights: K.lights, vantage: K.vantage };
}

/**
 * THE THRESHOLDS: every socket's way crosses its doorway square - its node on the wall's line (`n`, where the hall's way
 * joins it) and one EG_ROOM_THRESHOLD_CM inside (`ni`), every link of the room's own that met the doorway meeting the inside
 * one instead: so no way of a room runs along its wall from a door's very line (a body turning short of the threshold walks
 * the wall's outside - tools/egSpanSolve.mjs's real motor found it, in a cloister's side door).
 * @param {any} K
 */
function thresholds(K) {
  K.sockets.forEach((q) => {
    const u = q.n, [ix, iz] = [[0, -1], [-1, 0], [0, 1], [1, 0]][egHeadingOf(q.yaw)], at = K.nodes[u];
    K.nodes.push([at[0] + ix * EG_ROOM_THRESHOLD_CM, at[1], at[2] + iz * EG_ROOM_THRESHOLD_CM]);
    const ni = K.nodes.length - 1;
    let road = 2;
    for (const l of K.links) { if (l.a === u) { l.a = ni; road = Math.min(road, l.road); } if (l.b === u) { l.b = ni; road = Math.min(road, l.road); } }
    K.links.push({ a: u, b: ni, kind: 'walk', road, one: 0 });
    q.ni = ni;
  });
}

// ── PLACING A ROOM (cm) ─────────────────────────────────────────────────────────────────────────────────────────────────
/** A plan point turned `t` quarter turns (each +90 degrees of bearing: +z to +x) - exact in integers. */
export const egTurn = (t, x, z) => { const q = ((t % 4) + 4) % 4; return q === 0 ? [x, z] : q === 1 ? [z, -x] : q === 2 ? [-x, -z] : [-z, x]; };
/** A bearing turned `t` quarter turns. */
export const egTurnYaw = (t, yaw) => (((yaw + 90 * t) % 360) + 360) % 360;
/** The heading (0 +z, 1 +x, 2 -z, 3 -x) a socket of bearing `yaw` leads out along. */
export const egHeadingOf = (yaw) => ((Math.round(yaw / 90) % 4) + 4) % 4;
/** The quarter turns that stand socket bearing `yaw` facing back along heading `h` (the way the company comes along). */
export const egTurnFor = (yaw, h) => (((((90 * h + 180 - yaw) / 90) % 4) + 4) % 4);

/**
 * A ROOM PLACED (section 3): built room `R` turned `t` quarter turns and moved so its socket `inI` stands at the origin - its
 * way in at (0, 0, 0), every other point of it about there (the hero form's frame: the hall lays it at its port). Pure.
 * @param {any} R @param {number} inI @param {number} t
 */
export function egRoomTurned(R, inI, t) {
  const s = R.sockets[inI], [ox, oz] = egTurn(t, s.x, s.z), oy = s.y;
  const P = (x, z) => { const [a, b] = egTurn(t, x, z); return [a - ox, b - oz]; };
  const poly = (ps) => ps.map((q) => P(q[0], q[1]));
  return {
    ...R, t, inI,
    floors: R.floors.map((f) => ({ y: f.y - oy, poly: poly(f.poly), fight: f.fight, open: f.open })),
    ramps: R.ramps.map((q) => ({ poly: q.poly.map((c) => { const [x, z] = P(c[0], c[2]); return [x, c[1] - oy, z]; }), y0: q.y0 - oy, y1: q.y1 - oy })),
    ceil: R.ceil.map((c) => ({ y: c.y - oy, poly: poly(c.poly) })),
    walls: R.walls.map((w) => { const [ax, az] = P(w.s[0], w.s[1]), [bx, bz] = P(w.s[2], w.s[3]); return { s: [ax, az, bx, bz], y0: w.y0 - oy, y1: w.y1 - oy, k: w.k }; }),
    sockets: R.sockets.map((q) => { const [x, z] = P(q.x, q.z); return { ...q, x, z, y: q.y - oy, yaw: egTurnYaw(t, q.yaw) }; }),
    way: { nodes: R.way.nodes.map((n) => { const [x, z] = P(n[0], n[2]); return [x, n[1] - oy, z]; }), links: R.way.links },
    climbs: R.climbs.map((c) => { const [x0, z0] = P(c.x0, c.z0), [x1, z1] = P(c.x1, c.z1), [nx, nz] = egTurn(t, c.face[0], c.face[1]); return { ...c, x0, z0, x1, z1, y0: c.y0 - oy, y1: c.y1 - oy, ledges: c.ledges.map((y) => y - oy), face: [nx, nz] }; }),
    wells: R.wells.map((w) => ({ poly: poly(w.poly), y0: w.y0 - oy, y1: w.y1 - oy })),
    alcoves: R.alcoves.map((a) => { const [x, z] = P(a.x, a.z), [sx, sz] = egTurn(t, a.side, 0); return { ...a, x, z, y: a.y - oy, side: sx, sz }; }),
    lights: R.lights.map((l) => { const [x, z] = P(l[0], l[2]); return [x, l[1] - oy, z, l[3]]; }),
    vantage: R.vantage.map((v) => { const [x, z] = P(v[0], v[2]); return [x, v[1] - oy, z]; }),
  };
}
/** A placed room's box (cm, about its way in): every point of its law - floors, stairs, ceilings, walls, sockets' openings,
 *  lights - and a hand round them. */
export function egRoomBox(R) {
  const b = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
  const take = (x, y, z) => { b[0] = Math.min(b[0], x); b[1] = Math.min(b[1], y); b[2] = Math.min(b[2], z); b[3] = Math.max(b[3], x); b[4] = Math.max(b[4], y); b[5] = Math.max(b[5], z); };
  for (const f of R.floors) for (const p of f.poly) take(p[0], f.y, p[1]);
  for (const q of R.ramps) for (const c of q.poly) take(c[0], c[1], c[2]);
  for (const c of R.ceil) for (const p of c.poly) take(p[0], c.y, p[1]);
  for (const w of R.walls) { take(w.s[0], w.y0, w.s[1]); take(w.s[2], w.y1, w.s[3]); }
  for (const q of R.sockets) take(q.x, q.y + q.h, q.z);
  for (const l of R.lights) take(l[0], l[1], l[2]);
  return [b[0] - 50, b[1] - 50, b[2] - 50, b[3] + 50, b[4] + 50, b[5] + 50];
}

/**
 * THE ROOM AS A HERO RECORD (section 11.5's form, net/eliteGates/egFragLaw.js) for the hall law to lay (net/eliteGates/egLaw.js): placed room `R`
 * (egRoomTurned's) whose way out is socket `outI`, with its side ways `sides` - its floors (a fight floor laid as ground
 * the trial does not stand on: `fight` 0 - the kind's own trial stands on the kind's floors), its stairs (each corner at its
 * height), its open edges, its ceilings, its sockets (`in`, and `out` - its way out first, then its side ways), an empty walk
 * graph (no legion walks a room the trial does not stand in), its alcoves and lights, its proof (its way's length walked
 * at THE SPAN BUILD and THE FAST BUILD), its cost and its box; and the room's own words (`room` - its archetype, its numbers,
 * its sockets used and its turn: what a client builds its walls from). Pure.
 * @param {any} R @param {number} outI @param {number[]} sides @param {string} id
 */
export function egRoomHero(R, outI, sides, id) {
  const F = EG_FRAGS[R.kit] ?? EG_FRAGS.caverns;
  const outs = [outI, ...sides], so = (q) => ({ x: q.x, y: q.y, z: q.z, yaw: q.yaw, w: q.w, h: q.h });
  return {
    v: EG_FRAG_V, id, kit: R.kit, band: R.band, class: R.cls, variant: R.k, play: [],
    sockets: { in: so(R.sockets[R.inI]), out: outs.map((i) => so(R.sockets[i])) },
    floors: R.floors.map((f) => ({ y: f.y, poly: f.poly, fight: 0 })),
    ramps: R.ramps.map((q) => ({ poly: q.poly, y0: q.y0, y1: q.y1 })),
    open: R.floors.flatMap((f, i) => f.open.map((e) => [i, e])),
    ceil: R.ceil.length ? R.ceil : null,
    graph: { nodes: [], edges: [] },
    anchors: { rift: [], caster: [], lurker: [], niche: [], engine: [], hazard: [] }, hazards: [], course: [],
    alcoves: R.alcoves.filter((a) => a.sz === 0 && a.side !== 0).map((a) => ({ x: a.x, y: a.y, z: a.z, seal: a.seal, side: a.side, holds: a.holds })),   // a niche opens across x alone (world/eliteGates/egHall.js egNicheBoxes)
    proof: { crossFast: 0, crossSlow: 0, moves: 0 },
    cost: { tris: 400 + 12 * R.walls.length, collider: 2 * R.walls.length + 2 * R.floors.length + 2 * R.ramps.length + 2 * R.ceil.length, lights: R.lights.length, draws: 4 },
    reverb: F.reverb, lights: R.lights, box: egRoomBox(R),
    room: { k: R.k, p: R.p, u: [R.inI, ...outs], t: R.t },
  };
}

/**
 * THE ROOM'S READER (section 3 - net/eliteGates/egFragLaw.js egFragRecordFault's, for a room): what is wrong with placed room hero
 * `rec` (egRoomHero's) and placed room `R`, in words - none when it is sound. Every number whole; its archetype known; its
 * floors and ceilings counter-clockwise polygons and its stairs rising over their own corners, no steeper than
 * EG_STAIR_FIFTHS; its open edges real; THE CEILING CLAMP (a floor wholly under a ceiling EG_FRAG_HEADROOM_CM.passage over
 * it, or open to the sky); its sockets at least EG_ROOM_DOOR's least wide and a passage's headroom high, on its box; its way
 * in at the origin; its climbs - on the way two pitches at most, each EG_CLIMB_PITCH_MIN_CM to EG_CLIMB_PITCH_CM, a rest ledge
 * between, never past EG_CLIMB_WAY_MAX_CM, a stair the long way round; off the way within EG_CLIMB_SIDE_CM and its pitches
 * within EG_CLIMB_SIDE_PITCH_CM; its ways' nodes on its floors, stairs or climbs; everything inside its box. Pure.
 * @param {any} rec @param {any} R
 */
export function egRoomFault(rec, R) {
  const why = [];
  const whole = (v, at) => {
    if (typeof v === 'number') { if (!Number.isInteger(v)) why.push(`${at}: ${v} is not whole`); } else if (Array.isArray(v)) v.forEach((x, i) => whole(x, `${at}[${i}]`));
    else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) whole(x, `${at}.${k}`);
  };
  whole(rec, 'room');
  if (!EG_ROOM_KINDS.includes(rec.room?.k)) why.push(`${rec.room?.k}: no such room`);
  const B = rec.box;
  const holds = (x, y, z, at) => { if (x < B[0] || x > B[3] || y < B[1] || y > B[4] || z < B[2] || z > B[5]) why.push(`${at} stands outside the room's box`); };
  for (const [i, f] of rec.floors.entries()) { if (!(egFragArea2(f.poly) > 0)) why.push(`floors[${i}]: not a counter-clockwise polygon`); for (const p of f.poly) holds(p[0], f.y, p[1], `floors[${i}]`); }
  for (const [i, q] of rec.ramps.entries()) {
    const plan = q.poly.map((c) => [c[0], c[2]]), lo = q.poly.filter((c) => c[1] === q.y0), hi = q.poly.filter((c) => c[1] === q.y1);
    if (!(egFragArea2(plan) > 0)) why.push(`ramps[${i}]: not a counter-clockwise polygon`);
    if (!(q.y1 > q.y0) || lo.length !== 2 || hi.length !== 2) why.push(`ramps[${i}]: not a stair from ${q.y0} to ${q.y1}`);
    else { const mx = (ps) => [(ps[0][0] + ps[1][0]) / 2, (ps[0][2] + ps[1][2]) / 2], a = mx(lo), b = mx(hi), run = Math.abs(b[0] - a[0]) + Math.abs(b[1] - a[1]); if ((q.y1 - q.y0) * 5 > run * EG_STAIR_FIFTHS) why.push(`ramps[${i}]: ${q.y1 - q.y0} cm up over ${run} cm, steeper than ${EG_STAIR_FIFTHS} in 5`); }
    for (const c of q.poly) holds(c[0], c[1], c[2], `ramps[${i}]`);
  }
  for (const [i, oe] of rec.open.entries()) if (!rec.floors[oe[0]] || !(oe[1] >= 0 && oe[1] < rec.floors[oe[0]].poly.length)) why.push(`open[${i}]: no such edge`);
  const ceilRec = { ceil: rec.ceil };
  for (const c of rec.ceil ?? []) if (!(egFragArea2(c.poly) > 0)) why.push('a ceiling is not a counter-clockwise polygon');
  for (const [i, f] of rec.floors.entries()) {
    // its corners and its edges' middles, a twentieth of the way in toward its middle (where a body stands on it)
    const n = f.poly.length, pts = [], mx = f.poly.reduce((a, p) => a + p[0], 0) / n, mz = f.poly.reduce((a, p) => a + p[1], 0) / n, inw = (x, z) => [x + (mx - x) / 20, z + (mz - z) / 20];
    for (let k = 0; k < n; k++) { const p = f.poly[k], q = f.poly[(k + 1) % n]; pts.push(inw(p[0], p[1]), inw((p[0] + q[0]) / 2, (p[1] + q[1]) / 2)); }
    pts.push([mx, mz]);
    const over = pts.map((p) => egFragCeilAt(ceilRec, p[0], p[1], f.y)).filter((c) => c !== null);
    if (over.length && Math.min(...over) - f.y < EG_FRAG_HEADROOM_CM.passage) why.push(`floors[${i}]: ${Math.min(...over) - f.y} cm of headroom`);
  }
  const S = rec.sockets;
  if (!S?.in || S.in.x !== 0 || S.in.y !== 0 || S.in.z !== 0) why.push('sockets.in: the way in stands at the origin');
  for (const [k, o] of [['in', S.in], ...S.out.map((o, i) => [`out[${i}]`, o])]) {
    if (!(o.w >= 240) || !(o.h >= EG_FRAG_HEADROOM_CM.passage)) why.push(`sockets.${k}: ${o.w} by ${o.h} cm`);
    holds(o.x, o.y, o.z, `sockets.${k}`);
    if (!rec.floors.some((f) => Math.abs(f.y - o.y) <= 5 && egNearPoly(f.poly, o.x, o.z, 60))) why.push(`sockets.${k}: no floor at its foot`);
  }
  const ramps = rec.ramps;
  for (const c of R.climbs) {
    const pitches = [], ys = [c.y0, ...c.ledges, c.y1];
    for (let k = 0; k + 1 < ys.length; k++) pitches.push(ys[k + 1] - ys[k]);
    if (c.road === 0) {
      if (pitches.length > EG_CLIMB_PITCHES) why.push(`a climb on the way of ${pitches.length} pitches`);
      if (pitches.some((h) => h < EG_CLIMB_PITCH_MIN_CM || h > EG_CLIMB_PITCH_CM)) why.push(`a climb on the way pitched ${pitches.join(', ')} cm, outside ${EG_CLIMB_PITCH_MIN_CM}-${EG_CLIMB_PITCH_CM}`);
      if (c.y1 - c.y0 > EG_CLIMB_WAY_MAX_CM) why.push(`a climb on the way ${c.y1 - c.y0} cm long`);
      if (!R.way.links.some((l) => l.road === 1 && l.kind === 'stair')) why.push('a climb on the way with no stair the long way round');
      let reach = c.y0;
      for (const q of [...ramps].sort((a, b) => a.y0 - b.y0)) if (q.y0 <= reach + 5 && q.y1 > reach) reach = q.y1;
      if (reach < c.y1 - 5) why.push('a climb on the way with no stair up as far beside it');
    } else {
      if (c.y1 - c.y0 < EG_CLIMB_SIDE_CM[0] || c.y1 - c.y0 > EG_CLIMB_SIDE_CM[1]) why.push(`a climb off the way ${c.y1 - c.y0} cm, outside ${EG_CLIMB_SIDE_CM.join('-')}`);
      if (pitches.some((h) => h > EG_CLIMB_SIDE_PITCH_CM)) why.push(`a climb off the way pitched ${Math.max(...pitches)} cm`);
    }
    holds(c.x0, c.y0, c.z0, 'a climb'); holds(c.x1, c.y1, c.z1, 'a climb');
  }
  const onAny = (x, y, z) => rec.floors.some((f) => Math.abs(f.y - y) <= 60 && egNearPoly(f.poly, x, z, 80)) || ramps.some((q) => egNearPoly(q.poly.map((c) => [c[0], c[2]]), x, z, 80) && y >= q.y0 - 60 && y <= q.y1 + 60);
  for (const [i, n] of R.way.nodes.entries()) if (!onAny(n[0], n[1], n[2])) why.push(`way node ${i} at (${n.join(', ')}) stands on no floor or stair`);
  // no wall across a way, nor along it within a body's reach (a walk, a bridge, a stair - a body from 30 cm over its feet to
  // 180; a climb goes up its face and a Drop off its edge by their own law)
  const shut = new Set(R.sockets.filter((q, k) => !(rec.room?.u ?? []).includes(k)).map((q) => q.n));   // a doorway not cut is a wall
  for (const [i, l] of R.way.links.entries()) {
    if (l.kind === 'climb' || l.kind === 'drop' || shut.has(l.a) || shut.has(l.b)) continue;
    const a = R.way.nodes[l.a], b = R.way.nodes[l.b];
    for (const w of R.walls) {
      const t = wayWallNear(a, b, w.s);
      if (t < 0) continue;
      const y = a[1] + (b[1] - a[1]) * t;
      if (w.y0 < y + 180 && w.y1 > y + 30) { why.push(`way link ${i} (${l.kind}) meets a wall (${w.k}) ${Math.round(y)} cm up`); break; }
    }
  }
  for (const w of R.walls) { holds(w.s[0], w.y0, w.s[1], 'a wall'); holds(w.s[2], w.y1, w.s[3], 'a wall'); }
  return why;
}
/** Where along way segment a-b (plan, its x and z) wall `s` ([ax, az, bx, bz]) comes within a body's 30 cm of it - the
 *  segment's parameter (0-1) at the nearest approach - or -1 where it stays clear. */
function wayWallNear(a, b, s) {
  const P = [a[0], a[2]], Q = [b[0], b[2]], A = [s[0], s[1]], B = [s[2], s[3]];
  const side = (p, q, r) => Math.sign((q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]));
  const onto = (p, q, r) => { const dx = q[0] - p[0], dz = q[1] - p[1], L2 = dx * dx + dz * dz, u = L2 > 0 ? Math.max(0, Math.min(1, ((r[0] - p[0]) * dx + (r[1] - p[1]) * dz) / L2)) : 0, ex = p[0] + dx * u - r[0], ez = p[1] + dz * u - r[1]; return [ex * ex + ez * ez, u]; };
  if (side(P, Q, A) * side(P, Q, B) < 0 && side(A, B, P) * side(A, B, Q) < 0) {
    const dx = Q[0] - P[0], dz = Q[1] - P[1], ex = B[0] - A[0], ez = B[1] - A[1];
    return ((A[0] - P[0]) * ez - (A[1] - P[1]) * ex) / (dx * ez - dz * ex);
  }
  let best = 30 * 30, at = -1;
  for (const r of [A, B]) { const [d, u] = onto(P, Q, r); if (d < best) { best = d; at = u; } }
  for (const [r, u] of /** @type {Array<[number[], number]>} */ ([[P, 0], [Q, 1]])) { const [d] = onto(A, B, r); if (d < best) { best = d; at = u; } }
  return at;
}
/** Is (x, z) within `pad` (cm) of polygon `poly` (inside it, or by an edge)? */
export function egNearPoly(poly, x, z, pad = 0) {
  if (egFragInPoly(poly, x, z)) return true;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length], ex = b[0] - a[0], ez = b[1] - a[1], L2 = ex * ex + ez * ez;
    const t = L2 > 0 ? Math.max(0, Math.min(1, ((x - a[0]) * ex + (z - a[1]) * ez) / L2)) : 0, dx = x - (a[0] + ex * t), dz = z - (a[1] + ez * t);
    if (dx * dx + dz * dz <= pad * pad) return true;
  }
  return false;
}
