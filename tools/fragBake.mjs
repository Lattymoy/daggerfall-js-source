// THE BAKE FOR AN AUTHORED HERO FRAGMENT - one fragment of Mac's Blender scene into its law half and its mesh half.
//
//     node tools/fragBake.mjs --list <in.fbx>        every object as the bake reads it - a marker and what it says, or art
//
// EG6c (2026-10-12, bible/11-Multiplayer/Elite-Gates.md section 11.6 - "Authored hero fragments (EG6c, as Mac authors
// them), modelled in Blender"). A fragment has a LAW HALF the relay reads (section 11.5 - net/eliteGates/egFragLaw.js's record and its
// reader, egFragRecordFault) and a MESH HALF only the client draws. Mac authors both in one scene: the art as meshes wearing
// the band's dress, the law as NAMED MARKERS beside it. Each fragment has its own .fbx and its own bake script (the
// reference's is tools/bakeEgRefFrag.mjs), which hands bakeFrag its SPEC - `{ id, kit, class, variant, play, source }`:
// its name, its library kit (net/eliteGates/egFragLaw.js EG_FRAGS - its band, reverb, light and engine follow), its class, which hero
// of the kit it is, a chamber's play (section 11.4) - and writes the two JSONs a test re-bakes byte for byte.
//
// ONE DFU MEMBER, ONE EXPORT: nothing here re-reads what another bake already reads. tools/shipBake.mjs sceneObjects
// walks the scene (every root Mesh object in the scene's own metres, the export's axes refused by name when they are not
// Blender's, T*R*S only, a mirroring transform refused), fillFace cuts each polygon as Blender 5.1 cuts it (or refuses
// it), and tools/fbxMesh.mjs layerReader and cornerWelder read and weld each corner's normal and UV - the weld on the
// authored triple, so a hard edge or a UV seam keeps its split and a smooth run collapses.
//
// ═══ THE FRAME ═════════════════════════════════════════════════════════════════════════════════════════════════════
//
// Model the fragment along Blender's +Y, Z up, 1 Blender unit a metre: its mouth (`socket.in`) at its -Y end, its exits
// (`socket.out.*`) at its +Y end, X across. The fragment's frame is the hall's (section 8 - laid along +Z, y up, x across;
// world/mat4.js THE HANDEDNESS LAW): a scene point (X, Y, Z) is the fragment's ( X - x0, Z - z0, Y - y0 ), the origin the
// foot of the mouth - the middle of `socket.in`'s bottom edge. A MIRROR in the numbers, which keeps Mac's fragment his own
// in the left-handed world (tools/bakeGate.mjs's turn, for the same reason): each triangle is wound back through it and
// each normal goes through it as a vector. The law half is in whole centimetres (section 9's integers); the mesh in metres
// to 0.1 mm.
//
// ═══ THE MARKERS (section 11.6's list, whole) ══════════════════════════════════════════════════════════════════════
//
// A marker is a mesh object whose NAME says what it is; its geometry says where. Labels are letters, digits, _ and -;
// Blender's duplicate suffix (.001) may end any name. Markers carry no material and are never drawn.
//   floor.<label>                    a traversal floor - a flat plane (any faces: its OUTLINE is the floor), one height
//   floor.fight.<label>              a FIGHT floor (section 11.7 - blows land on it)
//   ramp.<label>                     a stair or slope: its outline, each corner at its own height (support, never fight)
//   ceil.<label>                     a ceiling: a flat plane over the floors it roofs (none over a floor: open to the sky)
//   open.<label>                     a box over floor edges open to the void, or onto a ramp or a lower floor - every
//                                    other floor edge is a WALL (one floor running on into another at its height is open
//                                    on its own)
//   socket.in                        the mouth: an upright plane across the course (its width and height the opening's)
//   socket.out.<label>               an exit, the same (one or more; the course leaves along +Y)
//   node.<label>                     a walk-graph node: a disc on the ground (its middle the node, half its width its reach)
//   edge.<label>                     a walk-graph edge: a strip from one node's disc to another's
//   anchor.<kind>.<label>            a place of the legion: rift, caster, lurker, niche, engine or hazard (a small box;
//                                    the middle of its foot)
//   hazard.<kind>.<label>[.per<ms>][.ph<ms>]   a hazard of net/eliteGates/egFragLaw.js EG_HAZARDS, in its kind's shape
//                                    (EG_HAZARD_SHAPES): a lane (fall, surge, slag) one rectangle along its length (its
//                                    bite the capsule inside it - the law's lanes are capsules); spots
//                                    (basalt, hammer, hammerline) one disc each, all one size; lanes (cascade) one rectangle
//                                    each, falling along +Y; a wisp's path (per required) its swing's rectangle; the mist a
//                                    plane at its line; the tide a disc; the Eclipse its moon-shafts' ring as a disc. `per`
//                                    its cycle where its law leaves one free, `ph` its phase
//   course.<kind>.<label>[.amp<cm>][.per<ms>][.ph<ms>][.beat<n>]   an inner piece (net/eliteGates/egLaw.js EG_STEP's kinds, the
//                                    Steps' records): a box whose top is the piece's top. A Drift and a Rail say amp and
//                                    per, a Pendulum, a Vent and a Gust per, a Drum amp (it rolls at the law's
//                                    EG_DRUM_MPS), a Moon branch ph and beat (cm - the beams' origin along +Y), a Beat beat
//                                    (ms); a slag crossing's clock is its law's
//   alcove.<seal>.<holds>.<label>    an alcove (section 11.10): seam or jump, holding lumen, shard or page (a box; its
//                                    floor's middle, to one side of the course)
//   light.<kind>.<label>             a light: band (the kit's colour), lava or moon (a small box; its middle)
//   collider.<label>                 the collider's low-poly PROXY (section 11.6 - never the drawn mesh)
//
// ═══ THE ART ═══════════════════════════════════════════════════════════════════════════════════════════════════════
//
// Every other object is art. Each of its faces wears a material NAMED for a record of its band's dress (world/eliteGates/egBandArt.js
// EG_DRESS: floor, brass, root, arena, cobble, edge, molten, pillar), so it draws under its band's archive
// (world/eliteGates/pseudoArchives.js EG_BAND_ARCHIVES) and needs no number of its own. Each art object carries normals and a UV map.
// The mesh half is one sub-mesh a record, lowest first (world/eliteGates/meshKit.js packs it so).
//
// ═══ WHAT IT REFUSES, BY NAME ══════════════════════════════════════════════════════════════════════════════════════
//
// An export no Blender 5.1 wrote (the port's own reference writer apart - FRAG_REF_WRITER), a marker name it cannot read, a
// floor or ceiling not flat or not one outline, a socket not upright across the course, an edge not between two nodes, a
// hazard not in its kind's shape, an inner piece whose clock its name does not say, art without the band's dress or without
// normals or UVs - and then every fault net/eliteGates/egFragLaw.js egFragRecordFault finds in the record (THE CEILING CLAMP, VOLUMES
// STAND APART, the budget, the hazard law, the sockets on the box's faces), and an inner course THE TIMED SOLVER does not
// prove (net/eliteGates/egSpanLaw.js egSpanProof). Never a guess: a refused scene is fixed in Blender.
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { readFbx, nodeAt, childNamed, property70 } from './fbxRead.mjs';
import { layerReader, cornerWelder } from './fbxMesh.mjs';
import { sceneObjects, assertBlenderFill, fillFace, round4 } from './shipBake.mjs';
import { isMain } from './lib/isMain.mjs';
import { EG_FRAGS, EG_HAZARDS, EG_HAZARD_SHAPES, EG_FRAG_ANCHORS, EG_FRAG_LIGHTS, EG_FRAG_SEALS, EG_ALCOVE_HOLDS, EG_FRAG_V, EG_FRAG_SOCKET_TOL_CM, EG_SLAG_LANE_CM, egFragArea2, egFragInPoly, egFragRecordFault, egFragSteps, egFragSwept, egFragHazardPlan } from '../src/net/eliteGates/egFragLaw.js';
import { EG_STEP } from '../src/net/eliteGates/egLaw.js';
import { egSpanProof, egRoadCross, EG_DRUM_MPS, EG_MOON_EVERY_S, EG_SLAG_CYCLE_S } from '../src/net/eliteGates/egSpanLaw.js';
import { EG_DRESS } from '../src/world/eliteGates/egBandArt.js';

/** The port's own writer of the reference fragment (tools/egRefFragScene.mjs) as its SceneInfo names it: no Blender wrote
 *  that file, so no Blender's cut of its faces is in question - the port's is the only one there is. */
export const FRAG_REF_WRITER = 'daggerfall-js-source tools/egRefFragScene.mjs';
/** What a marker name's first word may be. */
export const FRAG_MARKERS = Object.freeze(['floor', 'ramp', 'ceil', 'open', 'socket', 'node', 'edge', 'anchor', 'hazard', 'course', 'alcove', 'light', 'collider']);
/** The clock words an inner piece's name says (`need` it must, `may` it may); every other piece keeps none. A Drum rolls
 *  at the law's EG_DRUM_MPS, a Moon branch's beams walk every EG_MOON_EVERY_S and a slag crossing pours every
 *  EG_SLAG_CYCLE_S, EG_SLAG_LANE_CM either side - so no name says those. */
export const FRAG_COURSE_CLOCK = Object.freeze({
  drift: { need: ['amp', 'per'], may: ['ph'] }, rail: { need: ['amp', 'per'], may: ['ph'] }, pend: { need: ['per'], may: ['ph'] }, vent: { need: ['per'], may: ['ph'] },
  gust: { need: ['per'], may: ['ph'] }, drum: { need: ['amp'], may: ['ph'] }, moon: { need: [], may: ['ph', 'beat'] }, beat: { need: [], may: ['beat'] }, slag: { need: [], may: ['ph'] },
});
/** How far apart (cm) a disc's two widths, or a set of spots' or lanes' sizes, may stand and still be one. */
export const FRAG_ROUND_CM = 10;

const LABEL = /^[A-Za-z0-9_-]+$/;
const BLENDER_COPY = /\.\d{3}$/;
/** A whole centimetre of metres `m`, a half away from nought either side (Math.round alone takes 350.5 up and -350.5 up
 *  too, so a mouth exactly 7.01 m wide would stand a centimetre off its own middle), never -0. */
const cm = (m) => Math.sign(m) * Math.round(Math.abs(m) * 100) + 0;
/** A number to a millionth (a UV), never -0. */
const round6 = (v) => Math.round(v * 1e6) / 1e6 + 0;

/** The file was written by Blender 5.1 (tools/shipBake.mjs assertBlenderFill) or by the port's reference writer - or the
 *  bake refuses it, naming what wrote it. */
export function assertFragSource(tree) {
  const info = nodeAt(tree.nodes, 'FBXHeaderExtension', 'SceneInfo');
  const names = ['Original', 'LastSaved'].map((at) => String((info && property70(info, `${at}|ApplicationName`)?.[0]) ?? ''));
  if (names.every((n) => n === FRAG_REF_WRITER)) return 'port';
  assertBlenderFill(tree);
  return 'blender';
}

/**
 * WHAT AN OBJECT'S NAME SAYS: null for art, else the marker - `{ kind, label, ... }` (a floor's `fight`, an anchor's,
 * hazard's, course piece's or light's `of`, an alcove's `seal` and `holds`, a hazard's or piece's clock words) - or an
 * Error naming what it cannot read.
 */
export function fragMarker(name) {
  const t = name.replace(BLENDER_COPY, '').split('.');
  if (!FRAG_MARKERS.includes(t[0])) return null;
  const bad = (why) => { throw new Error(`${name}: ${why} - see the marker names in tools/fragBake.mjs`); };
  const label = (s) => (s !== undefined && LABEL.test(s) ? s : bad(`"${s ?? ''}" is no label (letters, digits, _ and -)`));
  const only = (n) => { if (t.length !== n) bad(`a ${t[0]} marker is ${n} words`); };
  const of = (list) => (list.includes(t[1]) ? t[1] : bad(`"${t[1] ?? ''}" is not one of ${list.join(', ')}`));
  const words = (from, may) => {
    const o = {};
    for (const w of t.slice(from)) {
      const m = /^(amp|per|ph|beat)(\d+)$/.exec(w);
      if (!m || !may.includes(m[1])) bad(may.length ? `"${w}" is not one of ${may.map((k) => `${k}<n>`).join(', ')}` : `"${w}": a ${t[1]} says no clock words`);
      if (m[1] in o) bad(`"${m[1]}" said twice`);
      o[m[1]] = Number(m[2]);
    }
    return o;
  };
  switch (t[0]) {
    case 'floor':
      if (t[1] === 'fight') { only(3); return { kind: 'floor', fight: 1, label: label(t[2]) }; }
      only(2); return { kind: 'floor', fight: 0, label: label(t[1]) };
    case 'socket':
      if (t[1] === 'in') { only(2); return { kind: 'socket', out: 0, label: 'in' }; }
      if (t[1] !== 'out') bad('a socket is socket.in or socket.out.<label>');
      only(3); return { kind: 'socket', out: 1, label: label(t[2]) };
    case 'anchor': only(3); return { kind: 'anchor', of: of(EG_FRAG_ANCHORS), label: label(t[2]) };
    case 'light': only(3); return { kind: 'light', of: of(EG_FRAG_LIGHTS), label: label(t[2]) };
    case 'alcove': {
      only(4);
      const seal = of(EG_FRAG_SEALS);
      return { kind: 'alcove', seal, holds: EG_ALCOVE_HOLDS.includes(t[2]) ? t[2] : bad(`"${t[2] ?? ''}" is not one of ${EG_ALCOVE_HOLDS.join(', ')}`), label: label(t[3]) };
    }
    case 'hazard': {
      const k = of(Object.keys(EG_HAZARDS));
      const clock = words(3, ['per', 'ph']);
      if (EG_HAZARD_SHAPES[k] === 'path' && !('per' in clock)) bad(`a ${k} says its cycle (per<ms>)`);
      return { kind: 'hazard', of: k, label: label(t[2]), clock };
    }
    case 'course': {
      const k = of(Object.keys(EG_STEP));
      const c = FRAG_COURSE_CLOCK[k] ?? { need: [], may: [] };
      const clock = words(3, [...c.need, ...c.may]);
      for (const w of c.need) if (!(w in clock)) bad(`a ${k} says its ${w}<n>`);
      return { kind: 'course', of: k, label: label(t[2]), clock };
    }
    default: only(2); return { kind: t[0], label: label(t[1]) };
  }
}

// ── the geometry of a marker ─────────────────────────────────────────────────────────────────────────────────────────

/** Each vertex of an object in the fragment's frame, whole centimetres. */
const cmPoints = (o, toFrag) => o.scene.map((p) => toFrag(p).map(cm));
/** The extents of points: `[x0, y0, z0, x1, y1, z1]`. */
function extentOf(pts) {
  const b = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
  for (const p of pts) for (let k = 0; k < 3; k++) { b[k] = Math.min(b[k], p[k]); b[k + 3] = Math.max(b[k + 3], p[k]); }
  return b;
}
/** A box's middle and half-size along axis k, snapped so both are whole (an inner piece's or an opening's). */
const snapped = (b, k) => [Math.round((b[k] + b[k + 3]) / 2), 2 * Math.round((b[k + 3] - b[k]) / 2)];

/** The groups of an object's faces that touch (a vertex in common, by place): each an island - a disc of a set of spots, a
 *  lane of a cascade. Lowest first by their first face. */
function islandsOf(o, pts) {
  const key = (vi) => pts[vi].join(',');
  const parent = o.polygons.map((_, i) => i);
  const find = (i) => { while (parent[i] !== i) i = parent[i] = parent[parent[i]]; return i; };
  const first = new Map();
  o.polygons.forEach((poly, f) => { for (const vi of poly) { const k = key(vi); if (first.has(k)) { const a = find(first.get(k)), b = find(f); if (a !== b) parent[Math.max(a, b)] = Math.min(a, b); } else first.set(k, f); } });
  const groups = new Map();
  o.polygons.forEach((_, f) => { const r = find(f); if (!groups.has(r)) groups.set(r, []); groups.get(r).push(f); });
  return [...groups.values()];
}

/**
 * THE OUTLINE of a set of an object's faces: the corners of its one boundary loop ([x, y, z] cm, the fragment's frame),
 * wound counter-clockwise in plan, no corner standing on the line between its neighbours. The boundary is every edge one
 * face uses (by place - two vertices on one spot are one), so any faces Mac drew make one floor. A set of faces with a
 * hole, or several, is refused: one outline, one floor.
 */
function outlineOf(o, pts, faces = o.polygons.map((_, i) => i)) {
  const key = (vi) => pts[vi].join(',');
  const count = new Map(), at = new Map();
  for (const f of faces) {
    const poly = o.polygons[f];
    for (let j = 0; j < poly.length; j++) {
      const a = key(poly[j]), b = key(poly[(j + 1) % poly.length]);
      if (a === b) continue;
      at.set(a, pts[poly[j]]);
      const e = a < b ? `${a}|${b}` : `${b}|${a}`;
      count.set(e, (count.get(e) ?? 0) + 1);
    }
  }
  const next = new Map();
  for (const [e, n] of count) {
    if (n !== 1) continue;
    const [a, b] = e.split('|');
    for (const [u, v] of [[a, b], [b, a]]) { if (!next.has(u)) next.set(u, []); next.get(u).push(v); }
  }
  if (!next.size) throw new Error(`${o.name}: no outline`);
  for (const [u, vs] of next) if (vs.length !== 2) throw new Error(`${o.name}: not one outline (a corner at ${u} cm meets ${vs.length} edges of it) - one marker, one outline, no hole`);
  const start = [...next.keys()].sort()[0];
  const loop = [start];
  for (let prev = null, cur = start; ;) {
    const nx = next.get(cur).find((v) => v !== prev && (loop.length > 1 || v === next.get(cur).slice().sort()[0]));
    if (nx === start) break;
    if (loop.includes(nx)) throw new Error(`${o.name}: not one outline`);
    loop.push(nx); prev = cur; cur = nx;
  }
  if (loop.length !== next.size) throw new Error(`${o.name}: not one outline (${next.size - loop.length} corners in another loop) - one marker, one outline, no hole`);
  let ring = loop.map((k) => at.get(k));
  if (egFragArea2(ring.map((p) => [p[0], p[2]])) < 0) ring.reverse();
  // corners on the line between their neighbours say nothing (two quads make one floor)
  for (let changed = true; changed && ring.length > 3;) {
    changed = false;
    for (let i = 0; i < ring.length; i++) {
      const a = ring[(i + ring.length - 1) % ring.length], b = ring[i], c = ring[(i + 1) % ring.length];
      const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - b[0], c[1] - b[1], c[2] - b[2]];
      if (u[1] * v[2] - u[2] * v[1] === 0 && u[2] * v[0] - u[0] * v[2] === 0 && u[0] * v[1] - u[1] * v[0] === 0) { ring.splice(i, 1); changed = true; break; }
    }
  }
  return ring;
}
/** A flat outline's one height (cm), or a refusal: its corners within a centimetre of each other. */
function flatY(o, ring) {
  const ys = ring.map((p) => p[1]);
  if (Math.max(...ys) - Math.min(...ys) > 1) throw new Error(`${o.name}: not flat (its corners stand ${Math.min(...ys)} to ${Math.max(...ys)} cm)`);
  return Math.min(...ys);
}
/** A RECTANGLE in plan (four corners, square to a 2% slant - and the whole centimetres its corners were taken to - its
 *  opposite sides one length to 2 cm): the line along its length (`[ax, az, bx, bz]`, the end nearer the mouth first), its
 *  width, and each end's height - or a refusal. */
function rectangleOf(o, ring) {
  if (ring.length !== 4) throw new Error(`${o.name}: not a rectangle (${ring.length} corners)`);
  const len = (a, b) => Math.hypot(b[0] - a[0], b[2] - a[2]);
  const e = [0, 1, 2, 3].map((i) => [ring[(i + 1) % 4][0] - ring[i][0], ring[(i + 1) % 4][2] - ring[i][2]]);
  const L = e.map((v) => Math.hypot(v[0], v[1]));
  if (Math.abs(e[0][0] * e[1][0] + e[0][1] * e[1][1]) > (0.02 + 1.5 / Math.min(L[0], L[1])) * L[0] * L[1] || Math.abs(L[0] - L[2]) > 2 || Math.abs(L[1] - L[3]) > 2) throw new Error(`${o.name}: not a rectangle`);
  // the short sides are the ends (a square's line is a point - laneOf)
  const alongFirst = L[0] < L[1];
  const [s0, s1] = alongFirst ? [[ring[0], ring[1]], [ring[2], ring[3]]] : [[ring[1], ring[2]], [ring[3], ring[0]]];
  const mid = (a, b) => [Math.round((a[0] + b[0]) / 2), Math.round((a[1] + b[1]) / 2), Math.round((a[2] + b[2]) / 2)];
  let [a, b] = [mid(...s0), mid(...s1)];
  if (b[2] < a[2] || (b[2] === a[2] && b[0] < a[0])) [a, b] = [b, a];
  return { line: [a[0], a[2], b[0], b[2]], w: Math.round(len(...s0)), ya: a[1], yb: b[1] };
}
/** A DISC in plan (its two widths within FRAG_ROUND_CM): its middle and its reach. */
function discOf(o, pts, faces) {
  const b = extentOf(faces.flatMap((f) => o.polygons[f].map((vi) => pts[vi])));
  if (Math.abs((b[3] - b[0]) - (b[5] - b[2])) > FRAG_ROUND_CM) throw new Error(`${o.name}: not a disc (${b[3] - b[0]} by ${b[5] - b[2]} cm)`);
  return { x: Math.round((b[0] + b[3]) / 2), z: Math.round((b[2] + b[5]) / 2), r: Math.round(Math.max(b[3] - b[0], b[5] - b[2]) / 2), y: b[1] };
}
/** A LANE from its rectangle: the law's lane is a capsule (net/eliteGates/egShape.js egInShape - every point within w/2 of its line),
 *  so its line is the rectangle's middle line drawn in by w/2 at each end - the capsule inside the rectangle Mac drew, its
 *  bite never past it (a rectangle no longer than it is wide is a disc, its line a point). */
function laneOf(r) {
  const [ax, az, bx, bz] = r.line, len = Math.hypot(bx - ax, bz - az), k = len > r.w ? r.w / 2 / len : 0.5;
  return [Math.round(ax + (bx - ax) * k), Math.round(az + (bz - az) * k), Math.round(bx - (bx - ax) * k), Math.round(bz - (bz - az) * k)];
}
/** One size of several (spots' reaches, lanes' widths): the largest, all within FRAG_ROUND_CM of each other. */
function oneSize(o, sizes) {
  if (Math.max(...sizes) - Math.min(...sizes) > FRAG_ROUND_CM) throw new Error(`${o.name}: its parts are not one size (${sizes.join(', ')} cm)`);
  return Math.max(...sizes);
}

/** A HAZARD's record (net/eliteGates/egFragLaw.js's fields, cm and ms) from its marker: its kind's shape (EG_HAZARD_SHAPES). */
function hazardOf(o, mk, pts) {
  const shape = EG_HAZARD_SHAPES[mk.of];
  const h = { kind: mk.of, x: 0, y: 0, z: 0, w: 0, r: 0, ring: 0, period: mk.clock.per ?? 0, phase: mk.clock.ph ?? 0, sh: null, spots: null, lanes: null, path: null };
  const isles = islandsOf(o, pts);
  const one = () => { if (isles.length !== 1) throw new Error(`${o.name}: a ${mk.of} is one ${shape} (${isles.length} parts)`); return isles[0]; };
  if (shape === 'sh') { const ring = outlineOf(o, pts, one()); const r = rectangleOf(o, ring); h.sh = laneOf(r); h.w = r.w; h.y = flatY(o, ring); }
  else if (shape === 'lanes') {
    const rs = isles.map((f) => { const ring = outlineOf(o, pts, f); return { ...rectangleOf(o, ring), y: flatY(o, ring) }; }).sort((a, b) => (a.line[1] + a.line[3]) - (b.line[1] + b.line[3]) || (a.line[0] + a.line[2]) - (b.line[0] + b.line[2]));
    h.lanes = rs.map(laneOf); h.w = oneSize(o, rs.map((r) => r.w)); h.y = Math.min(...rs.map((r) => r.y));
  } else if (shape === 'spots') {
    const ds = isles.map((f) => discOf(o, pts, f)).sort((a, b) => a.z - b.z || a.x - b.x);
    h.spots = ds.map((d) => [d.x, d.z]); h.r = oneSize(o, ds.map((d) => d.r)); h.y = Math.min(...ds.map((d) => d.y));
  } else if (shape === 'path') {
    const b = extentOf(pts);
    h.path = [Math.round((b[0] + b[3]) / 2), Math.round((b[2] + b[5]) / 2), Math.round((b[3] - b[0]) / 2), Math.round((b[5] - b[2]) / 2)]; h.y = b[1];
  } else if (shape === 'level') h.y = extentOf(pts)[1];
  else { const d = discOf(o, pts, one()); h.x = d.x; h.z = d.z; h.y = d.y; if (shape === 'disc') h.r = d.r; else h.ring = d.r; }
  return h;
}

/** An INNER PIECE's record (the Steps' record, cm and ms; its gap and the ground after it laid by bakeFrag) from its
 *  marker (fragMarker's) and its box (`[x0, y0, z0, x1, y1, z1]`, cm): the box's top, its footprint snapped whole, its
 *  clock - the name's, or the law's where the law fixes it. */
export function fragPiece(mk, b) {
  const [x, w] = snapped(b, 0), [z, d] = snapped(b, 2), c = mk.clock;
  const piece = { kind: mk.of, x, y: b[4], z, w, d, amp: c.amp ?? 0, period: c.per ?? 0, phase: c.ph ?? 0, beat: c.beat ?? 0, gap: 0, after: 0 };
  if (mk.of === 'drum') piece.period = Math.trunc((4 * piece.amp * 1000) / (EG_DRUM_MPS * 100));   // net/eliteGates/egFragLaw.js egFragPassage's roll
  if (mk.of === 'moon') piece.period = EG_MOON_EVERY_S * 1000;
  if (mk.of === 'slag') { piece.amp = EG_SLAG_LANE_CM; piece.period = EG_SLAG_CYCLE_S * 1000; }
  return piece;
}

/**
 * THE BAKE: the FBX's bytes in, `{ law, mesh }` out - the law half (net/eliteGates/egFragLaw.js's record, refused if its reader finds
 * a fault, its inner course proven by THE TIMED SOLVER) and the mesh half (positions, normals and UVs, a sub-mesh a dress
 * record, the collider's proxy). Pure. `tree` the bytes parsed (a test hands in one it changed, to see the bake refuse
 * it); `source` the FBX's path as the files record it.
 * @param {Uint8Array} fbxBytes
 * @param {{ id: string, kit: string, class: string, variant: string, play: string[], source: string }} spec
 */
export function bakeFrag(fbxBytes, spec, tree = readFbx(fbxBytes), source = spec.source) {
  const writer = assertFragSource(tree);
  const objects = sceneObjects(tree).sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  const marks = objects.map((o) => ({ o, mk: fragMarker(o.name) }));
  // ── THE FRAME: the foot of the mouth
  const mouths = marks.filter((m) => m.mk?.kind === 'socket' && !m.mk.out);
  if (mouths.length !== 1) throw new Error(`a fragment has one mouth (socket.in) and this scene has ${mouths.length}`);
  const mb = [0, 1, 2].map((k) => [Math.min(...mouths[0].o.scene.map((p) => p[k])), Math.max(...mouths[0].o.scene.map((p) => p[k]))]);
  const origin = [(mb[0][0] + mb[0][1]) / 2, (mb[1][0] + mb[1][1]) / 2, mb[2][0]];
  const toFrag = (p) => [p[0] - origin[0], p[2] - origin[2], p[1] - origin[1]];
  const F = EG_FRAGS[spec.kit];
  if (!F) throw new Error(`kit ${spec.kit}: no such fragment (net/eliteGates/egFragLaw.js EG_FRAGS)`);

  // ── THE LAW HALF: each marker read
  const by = (kind) => marks.filter((m) => m.mk?.kind === kind).map((m) => ({ ...m, pts: cmPoints(m.o, toFrag) }));
  const socketOf = (m, yaw) => {
    const b = extentOf(m.pts);
    if (b[5] - b[2] > 1) throw new Error(`${m.o.name}: a socket stands upright across the course (it runs ${b[5] - b[2]} cm along it)`);
    const [x, w] = snapped(b, 0);
    return { x, y: b[1], z: Math.round((b[2] + b[5]) / 2), yaw, w, h: b[4] - b[1] };
  };
  const sockets = { in: socketOf(by('socket').find((m) => !m.mk.out), 180), out: by('socket').filter((m) => m.mk.out).map((m) => socketOf(m, 0)) };
  const floors = by('floor').map((m) => { const ring = outlineOf(m.o, m.pts); return { y: flatY(m.o, ring), poly: ring.map((p) => [p[0], p[2]]), fight: m.mk.fight }; });
  const ramps = by('ramp').map((m) => { const ring = outlineOf(m.o, m.pts), ys = ring.map((p) => p[1]); return { poly: ring, y0: Math.min(...ys), y1: Math.max(...ys) }; });
  const ceils = by('ceil').map((m) => { const ring = outlineOf(m.o, m.pts); return { y: flatY(m.o, ring), poly: ring.map((p) => [p[0], p[2]]) }; });
  // the open edges: under an open marker, or running on into another floor at its height
  const opens = by('open').map((m) => ({ m, b: extentOf(m.pts), used: 0 }));
  const T = EG_FRAG_SOCKET_TOL_CM;
  const open = [];
  floors.forEach((f, fi) => f.poly.forEach((p, e) => {
    const q = f.poly[(e + 1) % f.poly.length], mid = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
    const under = opens.filter((u) => [p, q].every((c) => c[0] >= u.b[0] - T && c[0] <= u.b[3] + T && c[1] >= u.b[2] - T && c[1] <= u.b[5] + T) && f.y >= u.b[1] - T && f.y <= u.b[4] + T);
    for (const u of under) u.used++;
    const runsOn = floors.some((g, gi) => gi !== fi && g.y === f.y && [p, q, mid].every((c) => egFragInPoly(g.poly, c[0], c[1])));
    if (under.length || runsOn) open.push([fi, e]);
  }));
  for (const u of opens) if (!u.used) throw new Error(`${u.m.o.name}: opens no floor's edge (both ends of an edge inside it, at the floor's height)`);
  // the walk graph
  const nodeMarks = by('node');
  const nodes = nodeMarks.map((m) => { const d = discOf(m.o, m.pts, m.o.polygons.map((_, i) => i)); return [d.x, d.y, d.z, d.r]; });
  const edges = by('edge').map((m) => {
    const r = rectangleOf(m.o, outlineOf(m.o, m.pts));
    const ends = [[r.line[0], r.ya, r.line[1]], [r.line[2], r.yb, r.line[3]]].map((p) => {
      const hit = nodes.map((n, i) => (Math.hypot(p[0] - n[0], p[2] - n[2]) <= n[3] && Math.abs(p[1] - n[1]) <= 100 ? i : -1)).filter((i) => i >= 0);
      if (hit.length !== 1) throw new Error(`${m.o.name}: an end of it meets ${hit.length} nodes - an edge runs from one node's disc to another's`);
      return hit[0];
    });
    if (ends[0] === ends[1]) throw new Error(`${m.o.name}: both its ends on one node`);
    return ends[0] < ends[1] ? ends : [ends[1], ends[0]];
  }).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const anchors = Object.fromEntries(EG_FRAG_ANCHORS.map((k) => [k, []]));
  for (const m of by('anchor')) { const b = extentOf(m.pts); anchors[m.mk.of].push([Math.round((b[0] + b[3]) / 2), b[1], Math.round((b[2] + b[5]) / 2)]); }
  const hazards = by('hazard').map((m) => hazardOf(m.o, m.mk, m.pts));
  // the inner course along +Z: each piece's gap from what stands before it, and the ground after the last of a run
  const course = by('course').map((m) => fragPiece(m.mk, extentOf(m.pts))).sort((a, b) => a.z - b.z);
  const groundEnds = floors.map((f) => { const zs = f.poly.map((p) => p[1]); return [Math.min(...zs), Math.max(...zs)]; });
  course.forEach((c, i) => {
    const near = c.z - c.d / 2, far = c.z + c.d / 2, prev = course[i - 1], next = course[i + 1];
    const before = Math.max(prev ? prev.z + prev.d / 2 : -Infinity, ...groundEnds.map(([, z1]) => (z1 <= near ? z1 : -Infinity)), sockets.in.z <= near ? sockets.in.z : -Infinity);
    const after = Math.min(...groundEnds.map(([z0]) => (z0 >= far ? z0 : Infinity)), ...sockets.out.map((s) => (s.z >= far ? s.z : Infinity)));
    if (!(before > -Infinity)) throw new Error(`course.${c.kind}: nothing before it to leave from`);
    c.gap = near - before;
    if (!next || next.z - next.d / 2 > after) {
      if (!(after < Infinity)) throw new Error(`course.${c.kind}: no ground after it to land on`);
      c.after = after - far;
    }
  });
  const alcoves = by('alcove').map((m) => {
    const b = extentOf(m.pts), x = Math.round((b[0] + b[3]) / 2);
    if (x === 0) throw new Error(`${m.o.name}: an alcove stands to one side of the course`);
    return { x, y: b[1], z: Math.round((b[2] + b[5]) / 2), seal: m.mk.seal, side: x > 0 ? 1 : -1, holds: m.mk.holds };
  });
  const lights = by('light').map((m) => { const b = extentOf(m.pts); return [Math.round((b[0] + b[3]) / 2), Math.round((b[1] + b[4]) / 2), Math.round((b[2] + b[5]) / 2), m.mk.of]; });

  // ── THE MESH HALF: the art, welded, a sub-mesh a dress record; the collider's proxy
  const out = { positions: [], normals: [], uvs: [] };
  const byRecord = new Map();
  let tris = 0;
  for (const { o, mk } of marks) {
    if (mk) continue;
    const readNormal = layerReader(childNamed(o.geo, 'LayerElementNormal'), 3, 'Normals', 'NormalsIndex');
    const readUv = layerReader(childNamed(o.geo, 'LayerElementUV'), 2, 'UV', 'UVIndex');
    if (!readNormal || !readUv) throw new Error(`${o.name}: art carries no ${readNormal ? 'UV map' : 'normals'} - export it with its normals and its UV map`);
    const weld = cornerWelder({ readNormal, readUv, out, position: (i) => toFrag(o.scene[i]), normal: (n) => { const v = o.normal(n); return [v[0], v[2], v[1]]; } });
    let corner = 0;
    o.polygons.forEach((poly, k) => {
      const name = o.polyMaterial[k] >= 0 ? o.materials[o.polyMaterial[k]] : null;
      const dress = name?.replace(BLENDER_COPY, '');
      if (!dress || !Object.hasOwn(EG_DRESS, dress)) throw new Error(`${o.name} polygon #${k}: it wears ${name ? `"${name}"` : 'no material'} - art wears a record of its band's dress (${Object.keys(EG_DRESS).join(', ')}), or name it as a marker`);
      const ring = poly.map((vi, j) => weld.corner(corner + j, vi));
      corner += poly.length;
      const rec = EG_DRESS[dress];
      if (!byRecord.has(rec)) byRecord.set(rec, { name: dress, indices: [] });
      for (const [a, b, c] of fillFace(o, k)) { byRecord.get(rec).indices.push(ring[a], ring[c], ring[b]); tris++; }   // Blender's cut, wound back through the mirror
    });
  }
  const indices = [], subMeshes = [];
  for (const rec of [...byRecord.keys()].sort((a, b) => a - b)) {
    const g = byRecord.get(rec);
    subMeshes.push({ material: g.name, record: rec, startIndex: indices.length, primitiveCount: g.indices.length / 3 });
    indices.push(...g.indices);
  }
  const collider = [];
  for (const m of by('collider')) {
    const o = m.o;
    o.polygons.forEach((poly, k) => { for (const [a, b, c] of fillFace(o, k)) for (const vi of [poly[a], poly[c], poly[b]]) collider.push(...toFrag(o.scene[vi]).map(round4)); });
  }
  const positions = out.positions.map(round4);
  const drawn = extentOf(Array.from({ length: positions.length / 3 }, (_, i) => positions.slice(i * 3, i * 3 + 3)));

  // ── VOLUMES STAND APART: the box over every drawn vertex, every marker and every inner piece's travel
  const all = [];
  for (let i = 0; i < positions.length; i += 3) all.push([cm(positions[i]), cm(positions[i + 1]), cm(positions[i + 2])]);
  for (const { o, mk } of marks) if (mk) all.push(...cmPoints(o, toFrag));
  for (const c of course) { const s = egFragSwept(c); all.push([s[0], s[1], s[2]], [s[3], s[4], s[5]]); }
  for (const s of [sockets.in, ...sockets.out]) all.push([s.x - s.w / 2, s.y, s.z], [s.x + s.w / 2, s.y + s.h, s.z]);
  for (const h of hazards) { const p = egFragHazardPlan(h); if (p) all.push([p[0], h.y, p[1]], [p[2], h.y, p[3]]); }
  const box = extentOf(all).map((v) => Math.round(v) + 0);

  const sha256 = createHash('sha256').update(fbxBytes).digest('hex');
  const law = {
    bake: { tool: 'tools/fragBake.mjs', source, sha256 },
    v: EG_FRAG_V, id: spec.id, kit: spec.kit, band: F.band, class: spec.class, variant: spec.variant, play: [...spec.play],
    sockets, floors, ramps, open, ceil: ceils.length ? ceils : null, graph: { nodes, edges }, anchors, hazards, course, alcoves,
    proof: { crossFast: 0, crossSlow: 0, moves: 0 },
    cost: { tris, collider: collider.length / 9, lights: lights.length, draws: subMeshes.length },
    reverb: F.reverb, lights, box,
  };
  // ── THE TIMED SOLVER (section 10.5): the inner course proven, its bounds the proof
  if (course.length) {
    const steps = egFragSteps(law), P = egSpanProof({ steps });
    if (!P.ok) throw new Error(`${spec.id}: its inner course is not proven - ${P.why.join('; ')}`);
    const c = egRoadCross({ steps }, 0);
    law.proof = { crossFast: Math.round(c.fast * 1000), crossSlow: Math.round(c.median * 1000), moves: c.n };
  }
  const faults = egFragRecordFault(law);
  if (faults.length) throw new Error(`${spec.id}: the law half is refused - ${faults.join('; ')}`);
  const mesh = {
    bake: { tool: 'tools/fragBake.mjs', source, sha256, creator: childNamed(tree.nodes, 'Creator')?.props[0] ?? null, writer },
    id: spec.id, band: F.band, origin: origin.map(round4),
    bounds: { min: drawn.slice(0, 3), max: drawn.slice(3) },
    positions, normals: out.normals.map(round4), uvs: out.uvs.map(round6), indices, subMeshes, collider,
  };
  return { law, mesh };
}

/** A bake as its file holds it: one key a line, so a re-bake that moves a part is one line of the diff. */
export function fragJson(o) {
  return `{\n${Object.entries(o).map(([k, v]) => `  ${JSON.stringify(k)}: ${JSON.stringify(v)}`).join(',\n')}\n}\n`;
}

/** The scene's objects as the bake reads them - each marker and what its name says, or art and what it wears - read
 *  before a fragment's bake script is written (`--list`). */
export function listFrag(bytes) {
  return sceneObjects(readFbx(bytes)).map((o) => {
    let mk;
    try { mk = fragMarker(o.name); } catch (err) { return `${o.name.padEnd(28)} REFUSED: ${err.message}`; }
    return `${o.name.padEnd(28)} ${mk ? `${mk.kind}${mk.of ? ` ${mk.of}` : ''}${mk.fight ? ' (fight)' : ''}` : `art: ${[...new Set(o.materials)].join(', ') || 'no material'}`}  ${o.polygons.length} faces`;
  });
}

if (isMain(import.meta.url)) {
  const args = process.argv.slice(2);
  const file = args.find((a) => !a.startsWith('--'));
  if (!args.includes('--list') || !file) {
    console.error('usage: node tools/fragBake.mjs --list <in.fbx>   (each fragment\'s own bake script bakes it - tools/bakeEgRefFrag.mjs is the reference\'s)');
    process.exit(2);
  }
  for (const line of listFrag(readFileSync(file))) console.log(line);
}
