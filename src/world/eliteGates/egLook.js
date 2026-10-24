// @ts-check
// EG-G2 (2026-10-12, Mac: "I said I want everything"; bible/11-Multiplayer/Elite-Gates.md section 25 - THE LOOK, EG16 - and
// what EG-D still owed the screen): THE SPIRE'S LOOK AS LAW - every number the Spire's own passes draw by, pure, so a test
// holds each one and a pass only draws it:
//   THE EDGE LINE (section 25.3) - every edge a member could fall from, as segments: each plate's, island's and court's
//     rim (the drawn rim's own 48 sides - world/superDungeon/sdRealm.js SD_ISLAND_SIDES - so the line never cuts inside the stone or
//     floats past it), each bridge's, walkway's and lane's two sides; never a passage's walled floor (its walls are its
//     kerbs), and never a piece that moves (its own line rides its mesh - scenes/eliteGates/egSpan.js);
//   THE PIECES' LAST TELLS (layer two's "still owed"): the Rail's and the Drum's dashed track under its whole travel (EG-ZL:
//     ticked across at each end), the Gust's streamers across its section from the breath's rise through the gust (the
//     Steps' own breathSeen), the
//     waystones lit (their own mesh - buildEgLookModel - with a gold cap that holds by emission, never a lamp of the cap);
//   THE STAIR (section 7) - the full fall at a band's first hall, the veil's dither everywhere else, a plain cut under
//     reduced motion;
//   THE SKIES (section 25.8's arch and stair, EG16's "the Spire's underside in every sky, smaller each band");
//   THE DANGER PALETTES' STYLE BIT (section 25.7 - the palettes themselves, the fill and the allies' row are the shelf's,
//     ui/eliteGates/egAccess.js, their one home: the colours ride the telegraph stage's uEdgeCol and uColor, the keyline and the
//     hatch its new style bit) and THE QUIET COMPANY (section 25.4);
//   READABLE IN THE DARK AND THE FOG (section 25.6) - the fog floor every telegraph, edge line and white hazard keeps;
//   THE LAB CHECK (section 25.2) - the colour science that tells the five lights apart under ?grey, deuteranopia,
//     protanopia and tritanopia, at 10 m and 30 m of the band's fog.
//
// Not a DFU member. Ledger A (ELITE-GATES).
import { egCircleSpecs, egBandOfCircle, EG_BRINK_HALLS } from '../../net/eliteGates/egLaw.js';
import { egMistAt } from '../../net/eliteGates/egFragLaw.js';
import { egTubeBand, egWallBand, egIsleDisc, egToDungeon, egLaneOpenEnds } from './egHall.js';
import { SD_ISLAND_SIDES } from '../superDungeon/sdRealm.js';
import { SD_STEP_THICK, breathSeen } from '../superDungeon/sdSteps.js';
import { createMeshKit } from './meshKit.js';
import { EG_DRESS, egBandArchive } from './egBandArt.js';
import { EG_CVD } from '../../ui/eliteGates/egAccess.js';
import { egRideOf } from '../../net/eliteGates/egFair.js';   // AUDIT EG V (h): THE TRAIL's points on a ridden piece kept on it
import { egPieceAt } from '../../net/eliteGates/egSpanLaw.js';   // the colour-vision matrices' one home (the shelf's pins and the lab check read the same)
import { egAtmosOf } from './egAtmos.js';   // EG-LOOK: the skies' colours, the band's air's (one home)

// ── THE EDGE LINE ──────────────────────────────────────────────────────────────────────────────────────────────
/** THE EDGE LINE (section 25.3): 2 px on a desktop, 3 on a phone (a screen this short or less); its gold's display
 *  luminance (0.3-0.45 - the ambient rung, never a signal's); how far over its floor it lies (m). It never pulses. */
export const EG_EDGE_LINE = Object.freeze({ px: 2, phonePx: 3, phoneH: 720, luma: 0.38, lift: 0.02, color: Object.freeze([1.0, 0.78, 0.4]) });
/** The line's width (px) on a drawing buffer `h` tall. */
export const egEdgeLinePx = (h) => (h > 0 && h <= EG_EDGE_LINE.phoneH ? EG_EDGE_LINE.phonePx : EG_EDGE_LINE.px);
/** The line's colour at its luminance: the gold scaled so its display luminance is EG_EDGE_LINE.luma (linear rgb). AUDIT EG
 *  III (lane4 #5, sections 25.2 and 25.7): `pal` the danger palette (ui/eliteGates/egAccess.js) - the Standard keeps the line's own gold,
 *  any other its safety, at the same luminance. */
export const egEdgeLineColor = (pal = null) => { const g = pal && pal.key !== 'standard' && Array.isArray(pal.safety) ? pal.safety : EG_EDGE_LINE.color, l = 0.2126 * g[0] + 0.7152 * g[1] + 0.0722 * g[2], k = EG_EDGE_LINE.luma / l; return [g[0] * k, g[1] * k, g[2] * k]; };
/** A line segment's kinds (the pass's `aM.z`): the edge line, a track's dash, a streamer; AUDIT EG V (h) THE TRAIL's ribbon. */
export const EG_LINE_KIND = Object.freeze({ edge: 0, track: 1, streamer: 2, trail: 3 });
/** A track's dash and its gap (m), and its depth under its piece's top. */
export const EG_TRACK = Object.freeze({ dash: 0.5, under: SD_STEP_THICK + 0.12 });

/**
 * THE CIRCLE'S EDGES - every segment of THE EDGE LINE and every track, in the dungeon's frame: `{ edge, track }`, each a
 * Float32Array of [ax, ay, az, bx, by, bz] six floats a segment. Pure: one seed and one circle, one set of lines.
 */
export function egCircleEdges(seed, c, geo = 0) {
  const edge = [], track = [];
  const seg = (out, a, b) => out.push(a[0], a[1], a[2], b[0], b[1], b[2]);
  for (const spec of egCircleSpecs(seed, c, geo)) {
    const lift = EG_EDGE_LINE.lift;
    // the rims: every plate, island, court, bastion, balcony - never Grath's isles (they fall: the spans' own)
    for (const d of spec.discs) {
      if (egIsleDisc(spec, d)) continue;
      for (let k = 0; k < SD_ISLAND_SIDES; k++) {
        const a0 = (k / SD_ISLAND_SIDES) * Math.PI * 2, a1 = ((k + 1) / SD_ISLAND_SIDES) * Math.PI * 2;
        seg(edge, egToDungeon(spec, d.x + Math.cos(a0) * d.r, (d.y ?? 0) + lift, d.z + Math.sin(a0) * d.r), egToDungeon(spec, d.x + Math.cos(a1) * d.r, (d.y ?? 0) + lift, d.z + Math.sin(a1) * d.r));
      }
    }
    // the bands' two sides - a passage's floor is walled (its kerbs), a Falling Wall's and a Collapsing Tube's move
    for (const b of spec.bands) {
      if (b.role === 'cave' || egWallBand(spec, b) || egTubeBand(b)) continue;
      const y = b.y + 0.124 + lift;
      for (const s of [-1, 1]) seg(edge, egToDungeon(spec, b.x + s * b.halfW, y, b.z0), egToDungeon(spec, b.x + s * b.halfW, y, b.z1));
    }
    for (const l of spec.lanes ?? []) {
      const dx = l.bx - l.ax, dz = l.bz - l.az, len = Math.hypot(dx, dz) || 1, nx = -dz / len, nz = dx / len, y = (l.y ?? 0) + lift;
      for (const s of [-1, 1]) seg(edge, egToDungeon(spec, l.ax + s * nx * l.hw, y, l.az + s * nz * l.hw), egToDungeon(spec, l.bx + s * nx * l.hw, y, l.bz + s * nz * l.hw));
      // (THE AUDIT: a lane's end over the void its line across it - world/eliteGates/egHall.js egLaneOpenEnds)
      const open = egLaneOpenEnds(spec, l);
      if (open & 1) seg(edge, egToDungeon(spec, l.ax + nx * l.hw, y, l.az + nz * l.hw), egToDungeon(spec, l.ax - nx * l.hw, y, l.az - nz * l.hw));
      if (open & 2) seg(edge, egToDungeon(spec, l.bx + nx * l.hw, y, l.bz + nz * l.hw), egToDungeon(spec, l.bx - nx * l.hw, y, l.bz - nz * l.hw));
    }
    // THE TRACKS: a Rail's and a Drum's whole travel, under both its sides
    for (const s of spec.steps) {
      if ((s.kind !== 'rail' && s.kind !== 'drum') || !(s.amp > 0)) continue;
      const y = s.y - EG_TRACK.under, z0 = s.z - s.amp - s.d / 2, z1 = s.z + s.amp + s.d / 2;
      for (const side of [-1, 1]) seg(track, egToDungeon(spec, s.x + side * (s.w / 2 - 0.2), y, z0), egToDungeon(spec, s.x + side * (s.w / 2 - 0.2), y, z1));
      // EG-ZL (section 10.3: "ticked at each end"): a dash across each side's track where its travel turns
      for (const side of [-1, 1]) for (const z of [z0, z1]) { const x = s.x + side * (s.w / 2 - 0.2); seg(track, egToDungeon(spec, x - EG_TRACK.dash / 2, y, z), egToDungeon(spec, x + EG_TRACK.dash / 2, y, z)); }
    }
  }
  return { edge: new Float32Array(edge), track: new Float32Array(track) };
}

/** THE GUST'S STREAMERS (section 10.3's tell, layer two's "still owed"): how many a section, their length (m), their
 *  speed across the course (m/s) and how high over the course they fly. */
export const EG_STREAMERS = Object.freeze({ n: 7, len: 2.2, mps: 9, lo: 0.5, hi: 1.9, reach: 7 });
/** Each hall's Gust sections - the stretch its Gust pieces stand in, an island's reach either side - in the hall's frame:
 *  `[{ spec, road, span, x, y, z0, z1 }]`, the breath's one home (scenes/eliteGates/egSpan.js blows over them, the streamers fly in them).
 *  EG6a: a RUN of Gust pieces is a section (the pieces between two runs - a decree's Crumbles, a passage - stand in no
 *  breath), on its own road's line (THE FORK's other road, 15 m across and under it, is no span of theirs). The course
 *  sweep found both: a Low Road walker blown off its bridge by the High Road's breath, two runs blown as one. */
export function egGustSections(specs) {
  const out = [];
  for (const spec of specs) for (const road of [0, 1]) {
    let run = null;
    for (const q of spec.steps ?? []) {
      if ((q.road ?? 0) !== road) continue;
      if (q.kind !== 'gust') { run = null; continue; }
      // EG-SWEEP-RED: a run is one span link's - the next link's Gusts (spec law 10 lays two in a row: the first course's at
      // y 0 on its line, the next 12 m up on another) are its own section, never the first run's line stretched to their height
      if (run && q.span !== run.span) run = null;
      if (!run) { run = { spec, road, span: q.span, x: q.x, y: q.y, y1: q.y, z0: q.z - q.d / 2 - 4, z1: 0 }; out.push(run); }
      run.y = Math.min(run.y, q.y); run.y1 = Math.max(run.y1, q.y); run.z1 = q.z + q.d / 2 + 4;   // y1: its top (THE ASCENT's storey, scenes/eliteGates/egSpan.js egGustStorey)
    }
  }
  return out;
}
const _breath = { dir: 0, k: 0 };
/**
 * The streamers at `t` (the realm's anchored seconds - the gust's own clock) into `out` (six floats a segment, the
 * dungeon's frame, after them `alpha` per segment in `alphas`): blowing the way the breath will, from its rise through
 * the gust - none between. Answers how many. A frame makes nothing.
 * @param {ReturnType<typeof egGustSections>} sections @param {number} t @param {Float32Array} out @param {Float32Array} alphas
 */
export function egStreamersAt(sections, t, out, alphas) {
  breathSeen(t, _breath);
  if (!_breath.dir) return 0;
  const S = EG_STREAMERS, a = Math.min(1, _breath.k * 3) * (1 - Math.max(0, _breath.k - 0.85) / 0.15);
  let n = 0;
  for (const g of sections) for (let i = 0; i < S.n; i++) {
    if ((n + 1) * 6 > out.length) return n;
    const z = g.z0 + ((i + 0.5) / S.n) * (g.z1 - g.z0), y = g.y + S.lo + ((i * 0.618) % 1) * (S.hi - S.lo);
    const run = 2 * S.reach + S.len, x0 = -S.reach + (((t * S.mps + i * 3.7) % run) + run) % run - S.len;   // each its own lane, coming round
    const xa = _breath.dir > 0 ? x0 : -x0, xb = xa + _breath.dir * S.len;
    const A = egToDungeon(g.spec, g.x + xa, y, z), B = egToDungeon(g.spec, g.x + xb, y, z);
    out.set([A[0], A[1], A[2], B[0], B[1], B[2]], n * 6);
    alphas[n] = a;
    n++;
  }
  return n;
}

/** THE WAYSTONES LIT (section 8.3, layer two's "still owed"): a stone post bolted to the walkway's outer side (off the
 *  walk - nothing to stumble on, no collider owed), hanging `below` under the deck and standing `h` over it, and a gold
 *  cap that holds by its own light. */
export const EG_WAYSTONE = Object.freeze({ side: 0.5, h: 1.1, below: 0.9, cap: 0.36, capH: 0.22, off: 0.3 });
/**
 * THE LOOK'S OWN MESH for a circle (renderer.createMesh's shape, in the band's dress - built with world/eliteGates/meshKit.js): each
 * Rampart's waystones beside the walkway. Null when the circle has none.
 */
export function buildEgLookModel(seed, c, geo = 0) {
  const kit = createMeshKit(), W = EG_WAYSTONE;
  for (const spec of egCircleSpecs(seed, c, geo)) {
    for (const w of spec.waystones ?? []) {
      const side = (spec.walk ? spec.walk.halfW : 0) + W.off + W.side / 2;
      const p = egToDungeon(spec, w.x + side, 0, w.z), h = W.side / 2;
      kit.box(EG_DRESS.pillar, [p[0] - h, p[1] - W.below, p[2] - h], [p[0] + h, p[1] + W.h, p[2] + h]);
      const q = W.cap / 2;
      kit.box(EG_DRESS.edge, [p[0] - q, p[1] + W.h, p[2] - q], [p[0] + q, p[1] + W.h + W.capH, p[2] + q], { skip: ['bottom'] });
    }
  }
  return kit.vertexCount ? kit.pack(egBandArchive(egBandOfCircle(c))) : null;
}

// ── THE TRAIL (section 8.2) ──────────────────────────────────────────────────────────────────────────────────────────
/** AUDIT EG V (h; lane3 L3-10 (b), section 8.2) - THE TRAIL: once a span's door opens, the first across's route draws as a faint
 *  gold ribbon for the others - a point each `step` m of its route, at most `max` a member a hall, at `alpha` of THE EDGE LINE's
 *  gold, `width` times its width, `lift` over the feet. */
export const EG_TRAIL = Object.freeze({ step: 1, max: 240, alpha: 0.4, width: 2, lift: 0.05 });
/**
 * A point of a member's route in hall `spec` (its frame - the feet at (x, y, z)) at shared second `tS`, kept in `route` (the
 * member's list for the hall): a point on a ridden piece is kept on its piece (`{ pl }`, net/eliteGates/egFair.js egRideOf's `[i, dx, dy,
 * dz]`), so the ribbon rides it as the route did; any other where it stood (`{ at }`). One each EG_TRAIL.step along the route
 * at most, EG_TRAIL.max in all (the first kept). Answers whether it was kept.
 * @param {any[]} route @param {any} spec @param {number} x @param {number} y @param {number} z @param {number} tS
 */
export function egRibbonPush(route, spec, x, y, z, tS) {
  if (route.length >= EG_TRAIL.max) return false;
  const last = route.at(-1);
  if (last && trailAt(spec, last, tS, _trailP) && Math.hypot(x - _trailP[0], y - _trailP[1], z - _trailP[2]) < EG_TRAIL.step) return false;
  const ride = egRideOf(spec, x, y, z, tS);
  route.push(ride ? { pl: ride } : { at: [x, y, z] });
  return true;
}
const _trailP = [0, 0, 0], _trailQ = [0, 0, 0], _trailPiece = { dx: 0, dz: 0, solid: true };
/** Where a trail point stands at `tS` (the hall's frame), into `o`: its piece's place on the clock plus its offset, or where it
 *  was laid. False for a piece the hall has not. */
function trailAt(spec, q, tS, o) {
  if (!q.pl) { o[0] = q.at[0]; o[1] = q.at[1]; o[2] = q.at[2]; return true; }
  const s = spec?.steps?.[q.pl[0]];
  if (!s) return false;
  egPieceAt(s, tS, _trailPiece);
  o[0] = s.x + _trailPiece.dx + q.pl[1]; o[1] = s.y + q.pl[2]; o[2] = s.z + _trailPiece.dz + q.pl[3];
  return true;
}
/**
 * THE TRAIL's segments at shared second `tS`: each two points of `route` that stand (trailAt) a segment in the dungeon's frame
 * (world/eliteGates/egHall.js egToDungeon), EG_TRAIL.lift over the feet, written into `out` (six floats a segment) - at most `out`'s room.
 * Answers how many. Nothing is made but the hall's origin.
 * @param {any[]} route @param {any} spec @param {number} tS @param {Float32Array} out
 */
export function egTrailSegs(route, spec, tS, out) {
  if (!route?.length || !spec) return 0;
  const o = egToDungeon(spec, 0, EG_TRAIL.lift, 0), room = Math.floor(out.length / 6);
  let n = 0, had = false;
  for (const q of route) {
    if (n >= room) break;
    const ok = trailAt(spec, q, tS, _trailQ);
    if (ok && had) {
      const k = n * 6;
      out[k] = o[0] + _trailP[0]; out[k + 1] = o[1] + _trailP[1]; out[k + 2] = o[2] + _trailP[2];
      out[k + 3] = o[0] + _trailQ[0]; out[k + 4] = o[1] + _trailQ[1]; out[k + 5] = o[2] + _trailQ[2];
      n++;
    }
    if (ok) { _trailP[0] = _trailQ[0]; _trailP[1] = _trailQ[1]; _trailP[2] = _trailQ[2]; }
    had = ok;
  }
  return n;
}
// ── THE MIST ───────────────────────────────────────────────────────────────────────────────────────────────────
/** THE MIST (section 11.2): its top stops `below` metres under the landing it serves (the law's surge rises EG_MIST.rise
 *  over its floor, which lies that far under the landing - net/eliteGates/egFragLaw.js), its colour (linear - the Cairn's pale
 *  violet-grey), the margin a sheet runs past what it covers (m). */
export const EG_MIST = Object.freeze({ below: 0.3, rise: 3, color: Object.freeze([0.5, 0.5, 0.58]), pad: 3 });
/**
 * Each mist surge of a circle as a sheet (the hall's frame): `[{ spec, hz, x0, z0, x1, z1, rect, oy }]` - over its Mist
 * Stair's passage (the cave of kit `mist` its surge begins at), or over the Sinking Stair's flights (the `sink` steps past
 * it). AUDIT EG V (L6-4): `rect` its box in the scene's frame and `oy` the frame's height, made once a circle, so a frame's
 * sheets are only written (egMistSheetsAt).
 */
export function egMistSheets(specs) {
  const out = [];
  for (const spec of specs) for (const hz of spec.hazards ?? []) {
    if (hz.kind !== 'mist') continue;
    const q = spec.caves.find((c) => c.kit === 'mist' && hz.z >= c.z0 - 1 && hz.z <= c.z1);
    if (q) { out.push(sheetOf({ spec, hz, x0: q.x - q.halfW, z0: q.z0, x1: q.x + q.halfW, z1: q.z1 })); continue; }
    const fl = spec.steps.filter((t) => t.kind === 'sink' && t.z >= hz.z - 1);
    if (!fl.length) continue;
    const P = EG_MIST.pad;
    out.push(sheetOf({ spec, hz, x0: Math.min(...fl.map((t) => t.x - t.w / 2)) - P, z0: Math.min(...fl.map((t) => t.z - t.d / 2)) - P, x1: Math.max(...fl.map((t) => t.x + t.w / 2)) + P, z1: Math.max(...fl.map((t) => t.z + t.d / 2)) + P }));
  }
  return out;
}
/** A sheet with its scene-frame box (`rect`) and the frame's height (`oy`) - once a circle. */
function sheetOf(m) {
  const a = egToDungeon(m.spec, m.x0, 0, m.z0), b = egToDungeon(m.spec, m.x1, 0, m.z1);
  return { ...m, rect: [Math.min(a[0], b[0]), Math.min(a[2], b[2]), Math.max(a[0], b[0]), Math.max(a[2], b[2])], oy: a[1] };
}
/** AUDIT EG V (L6-4): each kept list's sheet slots, by the list (so a frame with none risen lets no slot go). */
const _sheetSlots = new WeakMap();
/** The sheets at `t` (the shared clock, s) in the scene's frame: `{ rect: [x0, z0, x1, z1], y, alpha }` - its line the
 *  surge's (net/eliteGates/egFragLaw.js egMistAt), never past EG_MIST.below under its landing; none while the mist lies low. AUDIT EG
 *  V (L6-4): into `out` when given (scenes/eliteGates/egLookDraw.js keeps it - each sheet's slot written, never made), else a new list.
 *  Pure but for `out`. */
export function egMistSheetsAt(sheets, t, out = []) {
  let pool = _sheetSlots.get(out), n = 0;
  if (!pool) _sheetSlots.set(out, (pool = []));
  for (const m of sheets) {
    const line = egMistAt(m.hz, t);
    if (!(line > 0.05)) continue;
    const top = Math.min(line, EG_MIST.rise - EG_MIST.below), r = (m.rect ??= sheetOf(m).rect), s = (pool[n] ??= { rect: [0, 0, 0, 0], y: 0, alpha: 0 });
    out[n++] = s;
    s.rect[0] = r[0]; s.rect[1] = r[1]; s.rect[2] = r[2]; s.rect[3] = r[3];
    s.y = (m.oy ??= sheetOf(m).oy) + m.hz.y + top; s.alpha = Math.min(1, line / 1.5);
  }
  out.length = n;
  return out;
}

// ── THE STAIR ──────────────────────────────────────────────────────────────────────────────────────────────────
/** THE STAIR (section 7): the veil's dither each way (s), and the halls that open a band (the full fall plays there). */
export const EG_STAIR = Object.freeze({ dither: 0.8, bandFirst: Object.freeze([1, ...EG_BRINK_HALLS]) });
/** How a step down to hall `h` is shown: 'fall' (the full fall past the Spire's underside - a band's first hall), 'veil'
 *  (the dither in and out with the band's chime, the hall's number held), or 'cut' (a plain dither cut - reduced motion,
 *  the port's own setting or the system's). */
export const egStairOf = (h, reduced = false) => (reduced ? 'cut' : EG_STAIR.bandFirst.includes(h) ? 'fall' : 'veil');

// ── THE SKIES ──────────────────────────────────────────────────────────────────────────────────────────────────
/**
 * THE SKIES (EG16): each band's sky in linear rgb - its zenith, its horizon, the deep below (the Galleries' fire-sea, the
 * Cairn's sea of mist, the Shade's dark, the Wellhead's molten glow), its moon, its embers' rate - and THE SPIRE'S
 * UNDERSIDE overhead in every one, smaller each band as the halls fall further down the legions' road: its angular radius
 * (radians) and how far it leans from the zenith toward the course (+z). EG-LOOK (Elite-Gates-Look.md section 6): the sky
 * itself is painted (render/eliteGates/egSkyMap.js) and its colours are the band's air's (world/eliteGates/egAtmos.js `sky` - one home): the
 * zenith and the horizon are the painter's, the deep the light the realm sends up (`up` - the stair's underside lit by it,
 * render/eliteGates/egStairPass.js); the underside is the wreck's model at this angular size (world/eliteGates/egVista.js), never painted.
 */
export const EG_SKIES = Object.freeze([
  { moon: 0, embers: 1.0, underside: 0.34, lean: 0.18 },
  { moon: 0, embers: 0.15, underside: 0.22, lean: 0.24 },
  { moon: 1, embers: 0, underside: 0.13, lean: 0.3 },
  { moon: 0, embers: 1.6, underside: 0.07, lean: 0.36 },
].map((s, b) => { const k = egAtmosOf(b).sky; return Object.freeze({ zenith: k.zenith, horizon: k.horizon, deep: k.up, ...s }); }));
/** A circle's sky. */
export const egSkyOf = (c) => EG_SKIES[egBandOfCircle(c)];

// ── THE DANGER PALETTES, THE FILL, THE QUIET COMPANY ───────────────────────────────────────────────────────────
/** The telegraph pass's style bits (render/gate/gateTelegraph.js uLook): the double keyline, the 45° hatch in the fill; EG-ZD
 *  (section 13.2) a cut feint's mark dashed as it fades (scenes/eliteGates/egFight.js lays it on a cut blow, never a palette). */
export const EG_LOOK_BIT = Object.freeze({ keyline2: 1, hatch: 2, dash: 4 });
/** The style bits a shelf palette lays on (ui/eliteGates/egAccess.js EG_DANGER_PALETTES - `keyline` 2 the double keyline, `hatch`
 *  the 45-degree hatch). Pure. */
export const egPaletteBits = (P) => ((P?.keyline ?? 1) >= 2 ? EG_LOOK_BIT.keyline2 : 0) | (P?.hatch ? EG_LOOK_BIT.hatch : 0);
/**
 * THE QUIET COMPANY (section 25.4), during a trial: cosmetic auras at nothing (back on the plates, at the rests and in
 * the recap), allies' effects at 60% with no light of their own, allies' numbers off unless the shelf says Full, a
 * Vestige aura one thin blue ring of 0.6 m, a shape aimed at another member filled at 0.55, another's Watchfire lines
 * only for blows within 12 m. `stage` the hall's (net/eliteGates/egLink.js `sg`); `full` the shelf's `allyEffects` is Full.
 */
export function egQuietCompany(stage, full = true) {
  const trial = stage === 'trial';
  return { auras: trial ? 0 : 1, allyAlpha: trial ? 0.6 : 1, allyGlow: trial ? 0 : 1, allyNumbers: !trial || full, vestigeRing: 0.6, aimedOther: trial ? 0.55 : 1, watchfireM: trial ? 12 : Infinity };
}

// ── READABLE IN THE DARK AND THE FOG ───────────────────────────────────────────────────────────────────────────
/** Section 25.6: within `within` metres every telegraph, edge line and white hazard keeps a fog visibility of at least
 *  `floor`, eased out over `ease` past it. */
export const EG_FOG_FLOOR = Object.freeze({ floor: 0.85, within: 30, ease: 4 });
/** The fog visibility a Spire signal keeps at `d` metres where the world's own is `f` (0-1). Pure - the shaders' text
 *  reads the same numbers (render/eliteGates/egLinePass.js, render/gate/gateTelegraph.js uFogFloor). */
export function egFogKept(f, d) {
  const F = EG_FOG_FLOOR, t = Math.max(0, Math.min(1, (d - F.within) / F.ease)), ease = 1 - t * t * (3 - 2 * t);
  return Math.max(f, F.floor * ease);
}

// ── THE LAB CHECK (section 25.2) ───────────────────────────────────────────────────────────────────────────────
export { EG_CVD };   // Machado, Oliveira and Fernandes (2009), full severity, on linear rgb (ui/eliteGates/egAccess.js)
/** A linear colour seen under a colour vision deficiency ('deutan', 'protan', 'tritan'), or in grey ('grey' - ?grey's
 *  luminance), clamped. */
export function egSeen(c, how) {
  if (how === 'grey') { const l = 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; return [l, l, l]; }
  const M = EG_CVD[how];
  if (!M) return [c[0], c[1], c[2]];
  const cl = (v) => Math.max(0, Math.min(1, v));
  return [cl(M[0] * c[0] + M[1] * c[1] + M[2] * c[2]), cl(M[3] * c[0] + M[4] * c[1] + M[5] * c[2]), cl(M[6] * c[0] + M[7] * c[1] + M[8] * c[2])];
}
/** A linear colour through `d` metres of exponential fog of `density` toward `fog`, its visibility floored by THE FOG
 *  FLOOR when `kept` (a Spire signal - egFogKept). */
export function egThroughFog(c, d, density, fog, kept = false) {
  let f = Math.exp(-density * d);
  if (kept) f = egFogKept(f, d);
  return [c[0] * f + fog[0] * (1 - f), c[1] * f + fog[1] * (1 - f), c[2] * f + fog[2] * (1 - f)];
}
/** CIE L*a*b* of a linear rgb colour (D65). */
export function egLab(c) {
  const X = 0.4124 * c[0] + 0.3576 * c[1] + 0.1805 * c[2], Y = 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2], Z = 0.0193 * c[0] + 0.1192 * c[1] + 0.9505 * c[2];
  const f = (t) => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116);
  const fx = f(X / 0.95047), fy = f(Y), fz = f(Z / 1.08883);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}
/** How far apart two linear colours read (CIE76 ΔE). */
export const egDeltaE = (a, b) => { const p = egLab(a), q = egLab(b); return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]); };
/** THE LAB CHECK's threshold: two lights told apart at a glance (ΔE), and in grey by luminance alone (L* apart). */
export const EG_LAB = Object.freeze({ deltaE: 12, greyL: 8 });
