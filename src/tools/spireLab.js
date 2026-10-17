// THE SPIRE LAB (EG-G2, 2026-10-12, Mac: "I said I want everything"; bible/11-Multiplayer/Elite-Gates.md section 25 - EG16's
// "the lab checks, frame-synced probes"). An Elite Breach's circle drawn by the game's own renderer and the Spire's own
// parts, with no game data - every piece of it is made in code: the halls (world/eliteGates/egHall.js) in their band's dress
// (world/eliteGates/egBandArt.js), the pieces batched and culled (scenes/eliteGates/egSpan.js, scenes/eliteGates/egPieceBatch.js), the waystones (world/
// egLook.js), the sky, the mist and THE EDGE LINE (scenes/eliteGates/egLookDraw.js), and a telegraph through the Spire's own stage
// in the shelf's danger palette (render/gate/gateTelegraph.js TELEGRAPH_FS_SPIRE, scenes/eliteGates/egFight.js egLookShapes). The frame is
// the dungeon arm's for a circle (scenes/worldModes.js: the Spire's trilight and key, its haze and the Hour's grade, its
// lamps, the circle and the dynamic draws, the cull before them, the sky after the solid geometry, the fight's pass last)
// in the same calls, so what this page shows is what a member in the Spire sees.
//
//   ?band=0-3        a circle of that band (its first: 1, 6, 11, 16)    ?c=<circle> instead      ?seed=<n> (7 by default)
//   ?h=<slot 0-4>    the hall of the circle the views stand in
//   ?view=plate|course|court|sky|over|edge|under|wide|spire|deep   a camera (the panel's list) - EG-LOOK: `under` a court's
//                    foundations from below its rim, `wide` the wreck and the Spire overhead from far out, `spire` the
//                    Spire's underside straight up from the plate, `deep` the wreck below over the plate's edge
//   ?wing=<n>        THE WRECK: view `wing` stands 70 m from the band's wing n, looking at it
//   ?piece=<kind>    EG-LOOK: the views `piece` (over its corner), `pieceback` (over its far one) and `pieceunder` (its foundation from under its side) at
//                    the circle's `?pi=`th step of that kind (still, ledge, drift, beat, riser, crumble, drop, rail, vent...;
//                    `isle` Grath's isle)
//   ?t=<seconds>     the shared clock, pinned           ?still the clock stopped     ?lane=off the classic set
//   ?palette=standard|contrast|deutan|tritan  ?fill=50-100   a danger disc on the court in that look (?shape=off: none)
//   ?mist            a circle with a Mist Stair or the Sinking Stair, the camera over its sheet, the clock at its surge
//   ?grey            the frame in grey (the lab check's)  ?nopanel the panel hidden (probes)
//   ?reduced         reduced motion (EG-LOOK: the air held still - scenes/eliteGates/egLookDraw.js drawAir)
//   ?door            the door open at the hall's end plate: its gold beam (render/eliteGates/egLightPass.js) and its foot's halo
//   ?frames=<n>      draw n frames and rest (a probe reads the last - tools/spireLabProbe.mjs)
//   ?view=map        THE ASCENT (LAW 9 - Elite-Gates-Ascent.md section 8): THE MAP - the hall straight down, in plan (an
//                    orthographic eye, no haze), its ROUTE drawn over it (src/tools/spireMap.js: links by kind and road, the
//                    main way's nodes, the plate, the door, the rooms named, the climbs' faces, the voids); ?route draws the
//                    route over any other view
//   ?view=room-<k>   THE ASCENT: inside the hall's first room of archetype k (stair, tower, gallery, cloister, broken,
//                    undercroft, crossing, corridor, switchback, scarp - the circle's, any hall), a body's eyes a step in from
//                    its mouth; `room-<k>-over` from over its middle, looking down across it
//   ?view=swatch (or ?swatch)   EG-LOOK: THE BAND'S PICTURES on a wall in the void beside the arrival plate - every record
//                    the band paints on a quad at its intended texels a metre, the right way up (world/eliteGates/egBandArt.js
//                    EG_KIT_MAP), lit by the band's own light and three of its lamps; ?rec=<record> the eye 5 m before one
// `window.__frame` counts drawn frames (the probes frame-sync on it - bible/Home.md's Process); `window.__lab` answers a
// probe's questions (the batch's stats, the look's state).
import { Renderer, WORLD_FRAME, INTERIOR_CLEAR } from '../render/renderer.js';
import { EL_LANE, dungeonFog, dungeonTrilight, exposureFor } from '../render/enhancedLighting.js';
import { applyFog } from '../render/underwaterFog.js';
import { skyGain } from '../render/deadlands.js';
import { GateTelegraphRenderer, TELEGRAPH_KIND, TELEGRAPH_STYLE, TELEGRAPH_EDGE_DAGON, TELEGRAPH_EDGE_SAFE, TELEGRAPH_POOL } from '../render/gate/gateTelegraph.js';
import { realmArt } from '../world/superDungeon/sdRealmArt.js';
import { SD_REALM_ARCHIVE } from '../world/superDungeon/sdRealm.js';
import { buildEgCircleModel, egCircleLights, egLightsWith, egHallLighting, egHallFog, egHallGrade, egToDungeon, egHallCentre } from '../world/eliteGates/egHall.js';
import { createEgGroundLook } from '../scenes/eliteGates/egGroundLook.js';   // EG-LOOK: the ruin and the wreck, as the circle's host stands them
import { EG_VISTA_PLACES, EG_VISTA_REACH } from '../world/eliteGates/egVista.js';   // EG-LOOK (THE WRECK): where a wing hangs, for ?wing
import { egRuinBands } from '../world/eliteGates/egRuin.js';   // EG-LOOK (THE RUIN): the bands a circle's ruin wears
import { egBandArt, egBandArchive, EG_BAND_RECORDS, EG_KIT_MAP, EG_DRESS } from '../world/eliteGates/egBandArt.js';
import { createMeshKit } from '../world/eliteGates/meshKit.js';   // EG-LOOK: the swatch wall
import { egAtmosOf } from '../world/eliteGates/egAtmos.js';
import { buildEgLookModel, egMistSheets } from '../world/eliteGates/egLook.js';
import { egPaletteOf, egFillOf } from '../ui/eliteGates/egAccess.js';   // the shelf's palette and fill, their one home
import { createEgSpan } from '../scenes/eliteGates/egSpan.js';
import { createEgLookDraw } from '../scenes/eliteGates/egLookDraw.js';
import { egLookShapes } from '../scenes/eliteGates/egFight.js';
import { egCircleSpecs, egFirstHallOf, egBandOfCircle } from '../net/eliteGates/egLaw.js';
import { egPieceAt } from '../net/eliteGates/egSpanLaw.js';   // EG-LOOK: a piece's view at a moment it stands
import { egIsleDisc } from '../world/eliteGates/egHall.js';
import { egMistAt } from '../net/eliteGates/egFragLaw.js';
import { EG_LIGHT_KIND, EG_DOOR_BEAM } from '../world/eliteGates/egLights.js';   // EG-LOOK: ?door - the beam and its foot's halo
import { INTERIOR_LIGHT_DIR } from '../world/interior/interiorLights.js';
import { perspective, lookAt, identity, mirrorProjectionX, ortho, multiply } from '../world/mat4.js';
import { egMapDraw, egRoomViews } from './spireMap.js';   // THE ASCENT: the map's route, the rooms' views

const params = new URLSearchParams(location.search);
const canvas = document.getElementById('c');
const $ = (id) => document.getElementById(id);
if (params.has('nopanel')) $('panel').style.display = 'none';
if (params.has('grey')) canvas.style.filter = 'grayscale(1)';
canvas.getContext('webgl2', { antialias: false, preserveDrawingBuffer: true });
const renderer = new Renderer(canvas);
const gl = renderer.gl;

// ── the circle ─────────────────────────────────────────────────────────────────────────────────────────────────
const SEED = Number(params.get('seed') ?? 7) >>> 0;
/** The circle: ?c, or the first of ?band's, or (?mist) the first circle with a mist sheet. */
function pickCircle() {
  if (params.has('c')) return Number(params.get('c'));
  if (params.has('mist')) for (let c = 6; c <= 20; c++) if (egMistSheets(egCircleSpecs(SEED, c, 0)).length) return c;
  return [1, 6, 11, 16][Math.max(0, Math.min(3, Number(params.get('band') ?? 0)))];
}
const C = pickCircle(), BAND = egBandOfCircle(C), SPECS = egCircleSpecs(SEED, C, 0);
const MIST = params.has('mist') ? egMistSheets(SPECS)[0] ?? null : null;
const SLOT = MIST ? SPECS.indexOf(MIST.spec) : Math.max(0, Math.min(4, Number(params.get('h') ?? 0)));
const SPEC = SPECS[SLOT];
for (const [rec, art] of realmArt()) { renderer.uploadTexture(SD_REALM_ARCHIVE, rec, art.albedo); renderer.uploadEmissionTexture?.(SD_REALM_ARCHIVE, rec, art.emission, { white: true }); }
for (const [rec, art] of egBandArt(BAND)) { renderer.uploadTexture(egBandArchive(BAND), rec, art.albedo, art.cutout ? { cutout: true } : {}); renderer.uploadEmissionTexture?.(egBandArchive(BAND), rec, art.emission, { white: true }); }   // EG-LOOK: a cutout picture's holes asked (the host's way)
// THE RUIN: a Brink circle's band above too (world/eliteGates/egRuin.js egRuinBands - its first halls' ruin wears it), the host's way
for (const b of egRuinBands(C)) if (b !== BAND) for (const [rec, art] of egBandArt(b)) { renderer.uploadTexture(egBandArchive(b), rec, art.albedo, art.cutout ? { cutout: true } : {}); renderer.uploadEmissionTexture?.(egBandArchive(b), rec, art.emission, { white: true }); }
const circleMesh = renderer.createMesh(buildEgCircleModel(SEED, C, 0));
const lookModel = buildEgLookModel(SEED, C, 0), lookMesh = lookModel ? renderer.createMesh(lookModel) : null;
const lamps = egCircleLights(SEED, C, 0);
const dynamicDraws = [];
const span = createEgSpan({ renderer, seed: SEED, c: C, geo: 0 });
span.stand({ dynamicDraws, collider: null });
const ground = createEgGroundLook({ renderer, lite: params.has('lite') });   // EG-LOOK (?lite: the phones' tier)
for (const d of ground.stand(SEED, C, 0)) dynamicDraws.push(d);
const look = createEgLookDraw({ gl, lite: params.has('lite') });
look.setCircle(SEED, C, 0);
const telegraph = new GateTelegraphRenderer(gl, { spire: true });

/** EG-LOOK: the piece the `piece` views look at - the `?pi=`th step of kind `?piece=` in the circle (its hall, its rest); for
 *  a Beat or a Moon branch the clock moved on to a moment it stands; `?piece=isle` the first of Grath's isles. */
const PIECE = (() => {
  if (!params.has('piece')) return null;
  const kind = params.get('piece'), n = Number(params.get('pi') ?? 0);
  if (kind === 'isle') { for (const spec of SPECS) { const d = spec.discs.find((q) => egIsleDisc(spec, q)); if (d) return { spec, x: d.x - d.r * 0.72, y: d.y, z: d.z - d.r * 0.72, s: null }; } return null; }   // its rim, the eye off it
  const all = SPECS.flatMap((spec) => spec.steps.filter((q) => q.kind === kind).map((s) => ({ spec, s, x: s.x, y: s.y, z: s.z })));
  return all[Math.min(all.length - 1, n)] ?? null;
})();
// ── EG-LOOK: THE SWATCH WALL - every picture the band paints, on a quad, as its builders lay it ──────────────────────
const SWATCH = params.get('view') === 'swatch' || params.has('swatch') || params.has('rec');
/** The wall: in the void left of the arrival plate (x), facing +x, its records in rows of `cols` (the hall's frame). */
const SW = Object.freeze({ x: -34, z: (SPEC.arrive?.z ?? 0) + 4, y: 1, col: 4.6, row: 5.2, cols: 7 });
/** Repeats a quad shows of each record (u, v): a tiling picture twice (its seams seen), a laid-out one once. */
const SW_REP = Object.freeze({ [EG_DRESS.edge]: [8, 8], [EG_DRESS.molten]: [3, 3], [EG_DRESS.root]: [1, 1], 61: [2, 1], 63: [1, 1], 64: [1, 1], 67: [1, 1], 68: [1, 1], 69: [1, 1], 71: [1, 1], 81: [3, 3] });
/** Which way a record's v runs up the quad: the kit's own (EG_KIT_MAP), the walls' up (world/eliteGates/egHall.js), the rest from its top. */
const swUp = (rec) => (EG_KIT_MAP[rec] ? EG_KIT_MAP[rec].v === 'up' : rec === EG_DRESS.pillar);
/** Where record k's quad stands: its centre in the hall's frame. */
const swAt = (k) => [SW.x, SW.y + (2 - Math.floor(k / SW.cols)) * SW.row + 2.3, SW.z + ((k % SW.cols) - (SW.cols - 1) / 2) * SW.col];
let swatchMesh = null;
if (SWATCH) {
  const kit = createMeshKit(), arts = new Map(egBandArt(BAND));
  EG_BAND_RECORDS.forEach((rec, k) => {
    const { albedo } = arts.get(rec), [ru, rv] = SW_REP[rec] ?? [2, 2], w = (albedo.width / 32) * ru, h = (albedo.height / 32) * rv, [cx, cy, cz] = swAt(k);
    const P = (dz, dy) => egToDungeon(SPEC, cx + 0.02, cy + dy, cz + dz), up = swUp(rec);
    const vb = up ? 0 : rv, vt = up ? rv : 0;   // v at the quad's bottom and top
    kit.quad(rec, P(w / 2, -h / 2), P(-w / 2, -h / 2), P(-w / 2, h / 2), P(w / 2, h / 2), [1, 0, 0], true, [[0, vb], [ru, vb], [ru, vt], [0, vt]]);
    const b0 = egToDungeon(SPEC, cx - 0.3, cy - h / 2 - 0.15, cz - w / 2 - 0.15), b1 = egToDungeon(SPEC, cx, cy + h / 2 + 0.15, cz + w / 2 + 0.15);
    kit.box(EG_DRESS.pillar, b0, b1, { skip: ['px'] });   // its frame, the academy's wall
  });
  swatchMesh = renderer.createMesh(kit.pack(egBandArchive(BAND)));
  const tint = egAtmosOf(BAND).lamp;
  for (const dz of [-11, 0, 11]) { const p = egToDungeon(SPEC, SW.x + 4.5, SW.y + SW.row * 1.6, SW.z + dz); lamps.push({ x: p[0], y: p[1], z: p[2], range: 16, color: [...tint] }); }
}

/** The cameras, in hall SPEC's frame (x across, y up, z along the course; yaw 0 down the course, degrees). */
const court = SPEC.fight ?? SPEC.discs.find((d) => d.role === 'court') ?? SPEC.end ?? SPEC.arrive;
const CAVE = SPEC.caves?.[0] ?? null, RING = (SPEC.deco ?? []).find((d) => d.t === 'wall' || d.t === 'tiers' || d.t === 'hall') ?? null;   // EG-LOOK HALLS: the hall's first passage and chamber
const VIEWS = {
  plate: { at: [0, 1.7, SPEC.arrive?.z ?? 0], yaw: 0, pitch: -6 },
  course: { at: [6, 7, (SPEC.len ?? 80) * 0.3], yaw: -12, pitch: -16 },
  court: { at: [court.x - 4, (court.y ?? 0) + 9, court.z - (court.r ?? 12) - 6], yaw: 8, pitch: -28 },
  sky: { at: [0, 1.7, SPEC.arrive?.z ?? 0], yaw: 0, pitch: 52 },
  over: { at: [40, 45, (SPEC.len ?? 80) * 0.2], yaw: -40, pitch: -30 },
  edge: { at: [(SPEC.arrive?.r ?? 5) - 1.5, 1.2, (SPEC.arrive?.z ?? 0) + 1], yaw: 70, pitch: -24 },
  mist: MIST ? { at: [(MIST.x0 + MIST.x1) / 2, MIST.hz.y + 6.5, MIST.z0 - 3], yaw: 0, pitch: -38 } : null,
  under: { at: [court.x + (court.r ?? 12) + 14, (court.y ?? 0) - 9, court.z - 6], yaw: -110, pitch: 18 },   // EG-LOOK: the court's foundations, from a span below its rim
  wide: { at: [-70, 26, (SPEC.len ?? 80) * 0.15], yaw: 55, pitch: 4 },   // EG-LOOK: the wreck drifting, the Spire overhead
  spire: { at: [0, 1.7, SPEC.arrive?.z ?? 0], yaw: 0, pitch: 76 },   // EG-LOOK (THE WRECK): the sealed Spire's underside, straight up from the plate
  deep: { at: [(SPEC.arrive?.r ?? 5) - 0.5, 1.7, SPEC.arrive?.z ?? 0], yaw: 100, pitch: -32 },   // EG-LOOK (THE WRECK): over the plate's edge, the wreck drifting in the deep
  wing: wingView(Number(params.get('wing') ?? -1)),
  // EG-LOOK (the spans' pieces): a close look at a piece of `?piece=<kind>` (the `?pi=`th of the circle's, any hall) - from
  // over its corner, and from under its side at its foundation; `?piece=isle` Grath's isle (circle 1's Court)
  ...(PIECE ? {
    piece: { spec: PIECE.spec, at: [PIECE.x - 3.9, PIECE.y + 2.3, PIECE.z - 3.5], yaw: 48, pitch: -24 },
    pieceunder: { spec: PIECE.spec, at: [PIECE.x - 5.0, PIECE.y - 2.6, PIECE.z - 2.6], yaw: 62, pitch: 20 },
    pieceback: { spec: PIECE.spec, at: [PIECE.x + 3.9, PIECE.y + 2.3, PIECE.z + 3.5], yaw: 228, pitch: -24 },   // its far corner
  } : {}),
  // EG-LOOK (THE RUIN): `ring` the court's column ring from beside its rim, `bridge` a way's arches from below its side;
  // ?eye=x,y,z,yaw,pitch any camera of the hall's frame
  ring: { at: [court.x + (court.r ?? 12) * 0.7, (court.y ?? 0) + 2.2, court.z - (court.r ?? 12) * 0.7], yaw: 40, pitch: 6 },
  bridge: (() => { const l = SPEC.lanes?.find((q) => Math.hypot(q.bx - q.ax, q.bz - q.az) > 8) ?? { ax: 0, az: 0, bx: 0, bz: 24, y: 0 }; return { at: [(l.ax + l.bx) / 2 + 13, (l.y ?? 0) - 7, (l.az + l.bz) / 2 - 6], yaw: -70, pitch: 14 }; })(),
  eye: params.has('eye') ? (([x, y, z, yaw, pitch]) => ({ at: [x, y, z], yaw, pitch }))(params.get('eye').split(',').map(Number)) : null,
  swatch: SWATCH ? (params.has('rec') ? (() => { const k = Math.max(0, EG_BAND_RECORDS.indexOf(Number(params.get('rec')))), c = swAt(k); return { at: [c[0] + 5.2, c[1], c[2]], yaw: -90, pitch: 0 }; })() : { at: [SW.x + 15.5, SW.y + SW.row * 1.5 + 0.8, SW.z], yaw: -90, pitch: 0 }) : null,   // EG-LOOK: the band's pictures
  // EG-LOOK HALLS (Elite-Gates-Look.md section 2): the ground's own - down a passage under its vault, the passage from outside,
  // a chamber's arcade from its floor, the end plate's door, a court's mosaic from over it
  passage: CAVE ? { at: [CAVE.x + 0.6, CAVE.y + 1.7, CAVE.z0 + 1.5], yaw: 3, pitch: 10 } : null,
  passout: CAVE ? { at: [CAVE.x + 16, CAVE.y + 5, (CAVE.z0 + CAVE.z1) / 2 - 12], yaw: -52, pitch: -6 } : null,
  chamber: RING ? { at: [RING.x - (RING.r ?? RING.hw) * 0.3, (RING.y ?? 0) + 1.7, (RING.z ?? (RING.z0 + RING.z1) / 2) - (RING.r ?? 12) * 0.55], yaw: 22, pitch: 12 } : null,
  door: { at: [SPEC.end?.x ?? 0, (SPEC.end?.y ?? 0) + 2.2, (SPEC.end?.z ?? 60) - 7.5], yaw: 0, pitch: 9 },
  mosaic: { at: [court.x, (court.y ?? 0) + 24, court.z - 9], yaw: 0, pitch: -66 },
  // THE ASCENT: THE MAP - straight down over the hall's bound (x ±150 m, z -10 to 158 m), over its highest ground
  map: { at: [0, Math.max(0, ...(SPEC.route?.nodes ?? [[0, 0, 0]]).map((n) => n[1])) + 90, 74], yaw: 0, pitch: -89.9 },
  // THE ASCENT: inside each room archetype (the circle's first of each, any hall), and over it
  ...Object.fromEntries(egRoomViews(SPECS).reverse().map((v) => [`room-${v.name}`, { spec: v.spec, at: v.at, yaw: v.yaw, pitch: v.pitch }])),
};
/** EG-LOOK (THE WRECK): ?wing=<n> - the camera 70 m from the band's wing n toward its hall (world/eliteGates/egVista.js EG_VISTA_PLACES,
 *  at the band's reach; a Court's place in a Court hall), looking at it. */
function wingView(n) {
  const P = EG_VISTA_PLACES[n];
  if (!P) return null;
  const a = (P.bearing * Math.PI) / 180, d = P.d * EG_VISTA_REACH[BAND], y = SPEC.lord ? P.court ?? P.h : P.h, back = 70;
  return { at: [Math.sin(a) * (d - back), y + 12, (SPEC.len ?? 80) / 2 + Math.cos(a) * (d - back)], yaw: P.bearing, pitch: -10 };
}
const viewSel = $('view');
for (const k of Object.keys(VIEWS)) if (VIEWS[k]) { const o = document.createElement('option'); o.value = o.textContent = k; viewSel.append(o); }
viewSel.value = VIEWS.eye ? 'eye' : VIEWS[params.get('view')] ? params.get('view') : SWATCH ? 'swatch' : MIST ? 'mist' : 'plate';
if (params.get('lane') === 'off') $('lane').checked = false;
if (params.has('still') || params.has('t')) $('still').checked = true;
const cam = { pos: [0, 0, 0], yaw: 0, pitch: 0 };
function setView(name) {
  const v = VIEWS[name] ?? VIEWS.plate;
  cam.pos = egToDungeon(v.spec ?? SPEC, v.at[0], v.at[1], v.at[2]);   // EG-LOOK: a piece's view in its own hall
  cam.yaw = (v.yaw * Math.PI) / 180; cam.pitch = (v.pitch * Math.PI) / 180;
}
setView(viewSel.value);
viewSel.addEventListener('change', () => setView(viewSel.value));
/** The shared clock: ?t, or (?mist) the moment its surge stands highest, or running. */
let clock = Number(params.get('t') ?? 40);
if (MIST && !params.has('t')) { for (let k = 0; k < 4000; k++) if (egMistAt(MIST.hz, k / 100) >= 3) { clock = k / 100 + 1; break; } }
if (PIECE?.s && String(params.get('view') ?? '').startsWith('piece')) for (let k = 0; k < 400 && !egPieceAt(PIECE.s, clock).solid; k++) clock += 0.05;   // EG-LOOK: a Beat or a branch standing
$('t').value = String(clock);
$('t').addEventListener('input', () => { clock = Number($('t').value); });

let laneOn = null;
function syncLane() {
  const on = $('lane').checked;
  if (on === laneOn) return;
  laneOn = on;
  renderer.setLightingLane(on ? EL_LANE : null);
  if (on) { renderer.setExposure?.(exposureFor('')); renderer.setAir?.(true); }
}

// ── a danger disc on the court in the shelf's look (and a haven beside it) ─────────────────────────────────────
const LOOK = { palette: egPaletteOf(params.get('palette') ?? 'standard'), fill: egFillOf(Number(params.get('fill') ?? 100) / 100) };   // `?fill=` in percent, as the shelf's row says it
const centre = egHallCentre(SPEC);
function shapesNow(t) {
  if (params.get('shape') === 'off') return [];
  const base = { yaw: 0, halfArc: 0, body: 0, end: [0, 0], halfW: 0, r0: 0, r1: 0, points: [], n: 0, flash: 0, alpha: 1, court: 0, since: 0.8, span: 1.5, after: -1, runS: 0, look: 0, fillK: 1, fogFloor: null };
  const danger = { ...base, kind: TELEGRAPH_KIND.disc, origin: [court.x, court.z - 2], r: 5, t: ((t % 1.5) / 1.5), color: [1, 0.4, 0.1], edge: TELEGRAPH_EDGE_DAGON, style: TELEGRAPH_STYLE.fire, pool: TELEGRAPH_POOL.blow, mine: false };
  const haven = { ...base, kind: TELEGRAPH_KIND.disc, origin: [court.x + 8, court.z + 3], r: 3, t: 1, color: [1.0, 0.82, 0.38], edge: TELEGRAPH_EDGE_SAFE, style: TELEGRAPH_STYLE.weight, pool: TELEGRAPH_POOL.ground, mine: false };
  return egLookShapes([danger, haven], LOOK, 'trial');
}

// ── the frame ──────────────────────────────────────────────────────────────────────────────────────────────────
const NO_SHADOW = Object.freeze({ noShadow: true }), WITH_SHADOW = Object.freeze({ noShadow: false });
const EMPTY_LIT = { data: new Float32Array(0), colors: new Float32Array(0), carried: new Uint8Array(0) };
const fogNow = { mode: 'exp', density: 0, range: 0, color: [0, 0, 0], camPos: [0, 0, 0] };
const courtFogNow = () => { fogNow.mode = renderer._fogMode; fogNow.density = renderer._fogDensity; fogNow.range = renderer._fogRange; fogNow.color = renderer._fogColor; fogNow.camPos = renderer._camPos; return fogNow; };
const equator = (t) => { const e = t.equator; return new Float32Array([e[0], e[1], e[2]]); };
const floor = SPEC.fight ? { r: SPEC.fight.r + 6, courts: [[SPEC.fight.x, SPEC.fight.z]] } : { r: 40, courts: [[0, (SPEC.len ?? 80) / 2]] };
const keys = new Set();
addEventListener('keydown', (e) => keys.add(e.code));
addEventListener('keyup', (e) => keys.delete(e.code));
let drag = null;
canvas.addEventListener('pointerdown', (e) => { drag = [e.clientX, e.clientY]; canvas.setPointerCapture(e.pointerId); });
canvas.addEventListener('pointermove', (e) => { if (!drag) return; cam.yaw -= (e.clientX - drag[0]) * 0.005; cam.pitch = Math.max(-1.5, Math.min(1.5, cam.pitch - (e.clientY - drag[1]) * 0.005)); drag = [e.clientX, e.clientY]; });
canvas.addEventListener('pointerup', () => { drag = null; });
let last = performance.now();
window.__frame = 0;
window.__lab = { circle: C, band: BAND, hall: egFirstHallOf(C) + SLOT, batch: () => span.batchStats(), look: () => look.state(), air: () => look.airState(), stats: () => ({ ground: ground.stats(), air: look.airState(), draws: dynamicDraws.filter((d) => !d.hidden && !d.culled).length }), eye: (x, y, z, yawDeg, pitchDeg) => { cam.pos = [x, y, z]; cam.yaw = (yawDeg * Math.PI) / 180; cam.pitch = (pitchDeg * Math.PI) / 180; }, view: (n) => { viewSel.value = n; setView(n); } };

/** EG-LOOK: ?door - the door's beam over the hall's end plate, as world/eliteGates/egLights.js egSpireLights stands it through the
 *  closing (the way's gold), for its own pass and its foot's halo. */
const DOOR_AT = SPEC.end ? egToDungeon(SPEC, SPEC.end.x, SPEC.end.y ?? 0, SPEC.end.z) : null;
const LIGHTS = params.has('door') && DOOR_AT ? [{ k: EG_LIGHT_KIND.beam, x: DOOR_AT[0], y: DOOR_AT[1], z: DOOR_AT[2], h: EG_DOOR_BEAM.h, w: EG_DOOR_BEAM.w, r: 0, c: LOOK.palette.safety, a: 1, f: 0 }] : [];
const REDUCED = params.has('reduced');

function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000); last = now;
  if (!$('still').checked) { clock += dt; $('t').value = String(clock); }
  $('tV').textContent = clock.toFixed(1);
  syncLane();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = Math.floor(canvas.clientWidth * dpr), h = Math.floor(canvas.clientHeight * dpr);
  if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
  const fwd = [Math.sin(cam.yaw) * Math.cos(cam.pitch), Math.sin(cam.pitch), Math.cos(cam.yaw) * Math.cos(cam.pitch)];
  const right = [Math.cos(cam.yaw), 0, -Math.sin(cam.yaw)];
  const sp = (keys.has('ShiftLeft') || keys.has('ShiftRight') ? 24 : 6) * dt;
  const mv = (v, s) => { cam.pos[0] += v[0] * s; cam.pos[1] += v[1] * s; cam.pos[2] += v[2] * s; };
  if (keys.has('KeyW')) mv(fwd, sp); if (keys.has('KeyS')) mv(fwd, -sp);
  if (keys.has('KeyD')) mv(right, -sp); if (keys.has('KeyA')) mv(right, sp);
  if (keys.has('KeyE')) cam.pos[1] += sp; if (keys.has('KeyQ')) cam.pos[1] -= sp;
  const view = lookAt(cam.pos, [cam.pos[0] + fwd[0], cam.pos[1] + fwd[1], cam.pos[2] + fwd[2]], [0, 1, 0]);
  // THE ASCENT: THE MAP's eye in plan - the hall's bound whole on the frame
  const MAPV = viewSel.value === 'map', mapH = Math.max(92, 158 / (w / h));
  const proj = mirrorProjectionX(MAPV ? ortho(mapH * (w / h), mapH, 0.1, 2000) : perspective((65 * Math.PI) / 180, w / h, 0.1, 2000));
  const lane = !!renderer.lightingLane;
  // the circle, as the dungeon arm draws it (scenes/worldModes.js - the Spire's light, its haze, the Hour's grade, its lamps)
  const L = egHallLighting(C), T = dungeonTrilight(lane, L.tri);
  renderer.setLighting(equator(T), 0, undefined, T);
  renderer.setMoonlight(L.key);
  applyFog(renderer, MAPV ? { ...dungeonFog(lane, egHallFog(C)), density: 0, start: 1e6, end: 2e6 } : dungeonFog(lane, egHallFog(C)));   // THE ASCENT: the map unhazed
  renderer.setSceneGrade?.(egHallGrade(C));
  ground.frame(cam.pos, clock);   // EG-LOOK: the eye's hall's ruin drawn, the wreck placed about it (scenes/eliteGates/egCircleHost.js egCircleFrame)
  const lit = egLightsWith(EMPTY_LIT, [], lamps, cam.pos);
  renderer.setPointLights(lit.data, null, lit.colors);
  renderer.setClearColor(INTERIOR_CLEAR);
  span.ride(clock, dt, null, false);
  renderer.beginFrame(proj, view, INTERIOR_LIGHT_DIR, WORLD_FRAME);
  renderer.drawMesh(circleMesh, identity(), null);
  span.cull(proj, view);   // the dungeon arm's own line, before its draws
  if (lookMesh) renderer.drawMesh(lookMesh, identity(), null, NO_SHADOW);
  if (swatchMesh) renderer.drawMesh(swatchMesh, identity(), null, NO_SHADOW);   // EG-LOOK: the band's pictures
  for (const d of dynamicDraws) if (!d.hidden && !d.culled) renderer.drawMesh(d.gpu, d.object.matrix, d.texRemap ?? null, d.noShadow ? NO_SHADOW : WITH_SHADOW);
  if (look.drawSky(proj, view, clock, courtFogNow(), skyGain(renderer._fogColor, egHallFog(C).color))) renderer.markForeignPass();
  // the fight's pass: the sky's next quadrant, the mist, THE AIR, the telegraphs, the lines last (scenes/eliteGates/egClient.js drawPass)
  if (look.paintSky(renderer._worldViewportPx ?? null, lane, clock)) renderer.markForeignPass();   // EG-LOOK: painted for the next frame's fetch
  if (look.drawUnder(proj, view, cam.pos, clock, courtFogNow())) renderer.markForeignPass();
  if (look.drawAir(proj, view, cam.pos, clock, courtFogNow(), lane, REDUCED, LIGHTS, renderer._worldViewportPx?.[3] ?? 0)) renderer.markForeignPass();   // EG-LOOK: the motes and the halos
  for (const sh of shapesNow(clock)) { telegraph.draw(sh, proj, view, cam.pos, clock, courtFogNow(), centre, null, floor); if (telegraph.drawn > 0) renderer.markForeignPass(); }
  if (params.get('lines') !== 'off' && look.drawOver(proj, view, cam.pos, clock, courtFogNow())) renderer.markForeignPass();   // ?lines=off: the probe's frame without them, to tell the line pass's own pixels
  if (look.drawLights(proj, view, cam.pos, clock, courtFogNow(), LIGHTS, REDUCED)) renderer.markForeignPass();   // EG-LOOK: ?door's beam, over the lines
  renderer.resolveFrame();
  if (MAPV || params.has('route')) drawRoute(proj, view); else if (routeOn) { mapCtx.clearRect(0, 0, mapCanvas.width, mapCanvas.height); routeOn = false; }
  window.__frame++;
  if (params.has('frames') && window.__frame >= Number(params.get('frames'))) return;   // a probe's still: the frames it reads, then the page rests (SwiftShader draws a circle in seconds)
  requestAnimationFrame(frame);
}
// ── THE ASCENT: THE ROUTE over the frame (src/tools/spireMap.js), each point by the frame's own eye ────────────────────────
const mapCanvas = /** @type {HTMLCanvasElement} */ ($('map')), mapCtx = mapCanvas.getContext('2d');
let routeOn = false;
function drawRoute(proj, view) {
  const w = canvas.width, h = canvas.height, vp = multiply(proj, view);
  if (mapCanvas.width !== w || mapCanvas.height !== h) { mapCanvas.width = w; mapCanvas.height = h; }
  const project = (x, y, z) => {
    const [px, py, pz] = egToDungeon(SPEC, x, y, z);
    const cw = vp[3] * px + vp[7] * py + vp[11] * pz + vp[15];
    if (!(cw > 1e-6)) return null;
    return [((vp[0] * px + vp[4] * py + vp[8] * pz + vp[12]) / cw * 0.5 + 0.5) * w, (1 - ((vp[1] * px + vp[5] * py + vp[9] * pz + vp[13]) / cw * 0.5 + 0.5)) * h];
  };
  window.__labMap = egMapDraw(mapCtx, SPEC, project, w, h);
  routeOn = true;
}
requestAnimationFrame(frame);
