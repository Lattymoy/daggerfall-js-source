// @ts-check
// EG-PLAY (2026-10-11, the Elite Gates arc; bible/11-Multiplayer/Elite-Gates.md sections 8 and 10): THE SPIRE'S SPANS ON
// THIS SCREEN - every step of a circle's courses where the hall law puts it (net/eliteGates/egLaw.js egHallOf's steps, the Unmoored
// Steps' own record), moving on the realm's anchored clock as the Steps move: a Drift swinging across, a Beat there on
// the beat alone, a Riser to run up, a Crumble that falls under my own foot and comes back, and the plain slabs (a
// Proving Walk's, a Court's approach, an Oblivion Caverns passage's ledges). Each step one mesh of its kind (the Steps'
// own - world/superDungeon/sdStepsModel.js buildStepModel; a plain slab for the still ones), drawn and stood in the collider as a
// moving bucket (the Steps' translation getter - the triangles never change, only where they stand). The step I stand on
// carries me.
//
// THE VOID (section 8): a body below EG_VOID_Y of the floor it last stood on is cast back to the last plate, island or
// floor it stood on - never a death: the host takes its cost (10% of the body's health, never below a quarter).
//
// EG-FULL, LAYER TWO (section 10.3): THE NEW PIECES MOVE, by the one law (net/eliteGates/egSpanLaw.js): a Rail travels along the
// course and carries its rider; a Pendulum's weight swings across the gap before its step and a touch is a cast-back
// (Iron Footing III shrugs it - systems/eliteGates/spireKit.js spireFooting); a Gust section pushes as the Steps' breath does
// (world/superDungeon/sdSteps.js gustAt, Iron Footing taking its share); a Drop's landing stands walled on its far side and flanks to
// EG_DROP_WALL_H. A Vent's tell and bite are the fight's (scenes/eliteGates/egFight.js - the telegraph pass).
//
// THE RAMPART'S GROUND (section 8.3): a FALLING WALL's walkway stands here as segments EG_WALL_SEG_M long (world/eliteGates/egHall.js
// leaves it out of the circle's mesh and collider), each falling once the fallen edge (net/eliteGates/egLaw.js egWallFallenZ - 20 s
// after the hall's wake, 1.5 m/s, systems/eliteGates/spireKit.js spireWake) passes it; a member caught is cast to the nearest standing
// segment ahead. A FORGE BRIDGE's walkway is a conveyor: whoever stands on it is carried toward the arrival plate at
// EG_BELT_MPS.
//
// EG-FULL, LAYER THREE (section 11 - THE FRAGMENTS): the fragments' own pieces move by the same law - a Bone bridge
// crumbles as a Crumble, a Moon branch stands only while a moonbeam lies on it, a Drum rolls along the course and carries
// its rider, a flight of the Sinking Stair sinks under my own foot at EG_SINK_MPS. THE COLLAPSING TUBE's floor and vault
// stand here as segments and fall behind the company at its fixed pace from its start after the hall's wake; a member
// caught is cast forward to the nearest standing segment ahead (section 11.3 - "cast forward to its last standing node").
// GRATH'S ISLANDS (section 13.3) stand here, each its own bucket, and crack (shaking 3.7 s) and fall for 15 s as the relay
// says (net/eliteGates/egLords.js - its `eob` state, read through systems/eliteGates/spireKit.js spireObjs); a cast-back from a fallen island
// lands on a standing one. A seam alcove's FALSE WALL stands in its doorway until the relay says it broken. And the hands
// this hall offers the activation ray: an Athenaeum's Orrery stones (a turn forward and back - `pz`), a chamber's engine
// (`use`), pressed through systems/eliteGates/spireKit.js spireAct.
//
// EG-ZC (2026-10-12, Mac: "I said I want everything"; sections 11.2 and 11.10): THE COOLING SLAG on this screen - each slag
// crossing's two spouts, each lane its molten sheet in the band's liquid (world/eliteGates/egBandArt.js EG_DRESS.molten) while it pours
// and its crust (a bucket, the cooled top over the still-glowing sides, THE EDGE LINE round it) while it holds, shaking its
// last second; its spill's bite is the fight's (scenes/eliteGates/egFight.js - the place's hazard on my own feet). A Moon branch the
// Moon-Mirror lights (the relay's haven over it - systems/eliteGates/spireKit.js spireObjs `lit`) stands while lit, beam or none.
// EG-ZG (2026-10-12, Elite-Gates.md section 25.8 - WEIGHT): A DROP'S LANDING is the fight's designed thud and dust
// (scenes/eliteGates/egFight.js), never DFU's hard-landing grunt: while my body falls onto a Drop the course asked for, `overDrop`
// says so, and the dungeon arm plays no FallHard for that landing (scenes/dungeonContext.js reportActivity).
// EG-ZL (2026-10-12, Elite-Gates.md sections 10.3, 10.8 and 25 - THE PIECES' TELLS): every piece shows what it will do
// next, the Steps' own look (scenes/superDungeon/sdSteps.js) on the Spire's pieces, batched a kind (scenes/eliteGates/egPieceBatch.js):
//   A DRIFT hangs on two chains from its band's anchor SD_PENDULUM.len over its deck - an arch rib, a ribcage, a
//     moon-shard, a crane hook - leaning with the law's own swing, the anchor rocking with them as the Hour's gear does
//     (a kind that turns, a kind a hall);
//   A BEAT runs the Steps' dial (its hand back to XII across its solid time - a kind a beat, so the pieces of one beat
//     share a frame), its last 0.4 s the place's own white in the danger palette's hazard, faltering once at
//     SD_BEAT_BLINK_HZ, dissolving out through the ordered dither and dithering back in - the dissolve made in its picture
//     (world/eliteGates/egBandArt.js egBeatWarnArt, egBeatBackArt: a cutout), so the kind stays one draw; gone, its gold GHOST hangs
//     where it returns, its hand running back (render/superDungeon/sdStepsPass.js - one pass for the circle);
//   A CRUMBLE (and a bone bridge, its law) under my foot grinds and flares its three crack stages across its shake, pours
//     grit, breaks into its chunks (two on a phone) that fall, drift and tumble while its ghost counts the return, and
//     in its last SD_CHUNK.rewind the chunks fly back up and click home - a shudder, whole. Reduced motion (ui/eliteGates/egAccess.js)
//     stills every shake here (a Crumble's, a slag crust's, Grath's isles'): the cracks still flare, the light still tells;
//   A PEER on a Crumble I have seen fall is drawn standing on a GHOST SLAB (section 10.8) - its ghost's top filled while
//     the peer's drawn feet stand on it (`peerOn`, the breach client's word off net/online.js `rideAt`);
//   EVERY ISLAND carries the Steps' waystone, lit gold while it is my cast-back point, dark otherwise; a GUST section's
//     islands carry the Steps' vane, swinging to point the coming push a second ahead, and the wind rises
//     (AmbientWindMoanDeep) with its clack, once a gust, over the section I stand in.
//
// EG6a (2026-10-12; Elite-Gates.md sections 10.1 and 10.3): THE STEPS' READERS ON THE SPIRE'S COURSES - the waystones
// above are read off the courses the span generator lays (net/eliteGates/egSpanLaw.js egSpanOf, read back a road at a time by
// egCourseOf - each course's checkpoints but the arrival plate: every island, the Low Road's its own). A Gust's push and its
// banners keep to a run of its pieces on its own road's line, its wind to that run's stretch (world/eliteGates/egLook.js
// egGustSections, EG_GUST_REACH_M).
//
// EG-ZR (2026-10-12; Elite-Gates.md section 15): FEATHERSTEP - a Crumble (and a Bone bridge) my foot sets waits its holder's
// 0.2, 0.35 or 0.5 s longer (systems/eliteGates/spireVestiges.js spireCrumbleWait, read as the foot lands), its cracks' stages spread
// across the wait; crumbles are each member's own, so nothing of it reaches the relay.
//
// AUDIT EG III (2026-10-13, lane 1 #7 / lane 3 #10; Elite-Gates.md section 15): SPIREBRIDGE ON THIS SCREEN - each plank the
// room raised over a gap in this circle's hall (`ebridge`, read through systems/eliteGates/spireKit.js spireObjs `br`) stands as its own
// draw and collider bucket, the relay's own plank (net/eliteGates/egSpanLaw.js egBridgeOf): gold, THE EDGE LINE round its top, laying
// itself across over EG_SB_GROW_S and faltering its last second (both still under reduced motion), holding from its raising
// to its end, its mesh and bucket freed at its end and with the circle.
//
// EG-LOOK (2026-10-15, Mac: "Literally everything, and no band aids"; bible/11-Multiplayer/Elite-Gates-Look.md "What was
// wrong" - "The span pieces wore the Steps' clock faces"): THE PIECES AS THE ACADEMY TORN - every piece a span stands is
// now a piece of the Battlemages' academy in its band's dress (world/eliteGates/egPlatformModel.js - its own stone off its own seed,
// egPieceSeed): a slab of the band's flags under THE EDGE LINE, the band's cornice under its rims, its foundation torn
// under it (the band's courses, bone and roots, glass stalactites or basalt prisms), a broken column or the band's
// hanging thing where its plan allows; a Riser a pier of ashlar, a Drop's landing walled in it, a Rail and a Drum
// carriages on their track, a Falling Wall's walk and a Collapsing Tube's floor segments of the same stone, Grath's isles
// the court's plates on the band's cornice (no gear teeth). Two tells keep the Steps' own law in the band's dress: a
// BEAT is the Steps' dial set in the band's stone (its frames, its white warning and its dissolve the dial's - its stone
// dissolving with it, world/eliteGates/egPlatformArt.js EG_BEAT_STONE_RECORDS), a CRUMBLE the Steps' own box and chunks in the band's
// flags cracking (egCrumbleArt - its stages, its cracks' light and its fall the law's). No Hour's clock on any other.
// Every collider is the law's as it was (egSlabTris, egDropTris, stepTris - the top you see is the top you stand on);
// THE PIECES STILL BATCH A KIND (scenes/eliteGates/egPieceBatch.js - now a kind of many models): the still ones (`slab`), the ones
// that move or come and go on the clock (`mover`), a Beat's phase, a Crumble's cracking and its chunks, the waystones, a
// Gust's banners and a hall's hangs - each one draw a record, a circle's kinds a handful (EG_SPAN_KINDS_MAX).
//
// Not a DFU member. Ledger A (ELITE-GATES).
import { realmToDungeon, dungeonToRealm } from '../../net/superDungeon/sdBrain.js';
import { egCircleSpecs, egWallFallenZ, egBandOfCircle, EG_VOID_Y, EG_BELT_MPS } from '../../net/eliteGates/egLaw.js';
import { stepTris, stepBox } from '../../world/superDungeon/sdStepsModel.js';
import { SD_CRUMBLE_DELAY, SD_CRUMBLE_BACK, SD_CRUMBLE_FALL_G, SD_STEP_THICK, SD_BEAT_CYCLE, SD_BEAT_SOLID, SD_BEAT_BLINK, SD_GUST_EVERY, gustAt } from '../../world/superDungeon/sdSteps.js';
import { ensureSdStepsArt, SD_STEPS_SOUNDS, SD_BEAT_FRAME_S, SD_BEAT_IN_S, SD_BEAT_OUT_STAGE_S, SD_CRUMBLE_SHAKE, SD_CRUMBLE_SEEN, SD_CHUNK, SD_BEAT_FRAMES, sdChunkWays, sdChunkMatrix } from '../superDungeon/sdSteps.js';
import { SD_PENDULUM, pendulumAngle, SD_BEAT_DISSOLVE, buildGritModel, SD_GRIT, buildWaystoneModel, buildVaneModel, vaneYawInto, sdWaystonesOf, sdVaneAt } from '../../world/superDungeon/sdStepsModel.js';   // EG-ZL: the Steps' own look parts
import { SD_STEPS_RECORD } from '../../world/superDungeon/sdStepsArt.js';   // EG-LOOK: a waystone's dark rune, its own record
import { egPiecePlan, egSegmentPlan, egPieceSeed, egPieceModel, egBeatModel, egRiserModel, egDropLookModel, egTubeLidModel, egIsleModel, egCrumbleModels } from '../../world/eliteGates/egPlatformModel.js';   // EG-LOOK: the academy torn
import { EG_BEAT_STONE_RECORDS, EG_PIECE_TELL_RECORDS, egCrumbleTellArt, egBeatStoneArt } from '../../world/eliteGates/egPlatformArt.js';   // EG-LOOK: a Crumble's band stages, a Beat's stone dissolving
import { SdStepsPass, SD_GHOST, sdStepsPrograms } from '../../render/superDungeon/sdStepsPass.js';   // EG-ZL: the ghosts' pass, the circle's
import { SD_SKY_STEPS } from '../../render/superDungeon/sdSky.js';
import { egAccessNow } from '../../ui/eliteGates/egAccess.js';   // EG-ZL: the danger palette's hazard on a Beat's warning; reduced motion stills the shakes
import { isTouchDevice } from '../../ui/touch/touchDevice.js';
import { createMeshKit } from '../../world/eliteGates/meshKit.js';
import { compiledPass, parallelCompile, startPrograms } from '../../render/glProgram.js';   // FIRST-USE (#1144): the ghosts built once their program is done
import { startEgLookPrograms } from './egLookDraw.js';   // FIRST-USE (#1144): and the look's programs started with the hall
import { EG_FOG_FLOOR, egGustSections } from '../../world/eliteGates/egLook.js';   // EG6a: the breath's sections, its one home (the streamers' too)
import { EG_RIDE_DOWN_M, EG_RIDE_UP_M } from '../../net/eliteGates/egFair.js';
import { egTubeEdgeIn, egVoidStep } from '../../net/eliteGates/egFair.js';   // EG-PERFECT: a routed hall's tube from the company at its mouth; the void zones
import { faces } from '../../world/gate/gateModel.js';
import { packRealmFaces, SD_REALM_ARCHIVE, SD_REALM_FLOOR_RECORD, SD_REALM_BRASS_RECORD, SD_REALM_EDGE_RECORD, SD_REALM_PILLAR_RECORD, SD_REALM_ROOT_RECORD, SD_ISLAND_SIDES } from '../../world/superDungeon/sdRealm.js';
import { identity } from '../../world/mat4.js';
import { egPieceAt, egPendAt, egPendHits, egBeatAt, egCourseOf, EG_PEND_HALF, EG_DROP_WALL_H, EG_CRUMBLE_KINDS, EG_SINK_MPS, EG_SINK_GONE_M, EG_BODY_R } from '../../net/eliteGates/egSpanLaw.js';
import { egBridgeOf } from '../../net/eliteGates/egSpanLaw.js';   // AUDIT EG III: Spirebridge's plank, the relay's own
import { egSlagState, egSlagX, EG_SLAG_SPOUTS, EG_SLAG_CRUST_S, EG_SLAG_WARN_S } from '../../net/eliteGates/egSpanLaw.js';   // EG-ZC: the Cooling Slag
import { egInShape } from '../../net/eliteGates/egShape.js';
import { EG_KIT_RECORD } from '../../world/eliteGates/egKit.js';   // EG-LOOK: the Galleries' anchor rib in the kit's voussoirs   // EG-ZC: a lit branch under the mirror's haven
import { EG_ENGINES } from '../../net/eliteGates/egFragLaw.js';
import { egOverDrop } from '../../world/eliteGates/egTelegraph.js';   // EG-ZG: a Drop's landing, the law
import { egNicheBoxes, egIsleDisc } from '../../world/eliteGates/egHall.js';
import { RAY_DISTANCE, DEFAULT_ACTIVATION_DISTANCE } from '../../player/activate.js';
import { spireFooting, spireWake, spireObjs, spireAct } from '../../systems/eliteGates/spireKit.js';
import { spireStoneName } from '../../systems/eliteGates/spireOrrery.js';   // FIELD BUGS 2026-10-17e (ORRERY-SIGHT): a handle names its stone
import { createEgOrrery } from './egOrrery.js';   // FIELD BUGS 2026-10-20f (ORRERY-STONES): an Athenaeum's stones stood, their levers the handles
import { SD_STONES } from '../../net/superDungeon/sdBrain.js';
import { SD_HALL_TEXT } from '../superDungeon/sdHall.js';   // ORRERY-SIGHT: the Hour's own words for a stone's hand
import { spireCrumbleWait } from '../../systems/eliteGates/spireVestiges.js';   // EG-ZR (Elite-Gates.md section 15): Featherstep - my crumbles wait longer
import { egBandDress, egBandArchive, EG_DRESS, egTellArchive, egBeatWarnArt, egBeatBackArt, egBeatTellMaps } from '../../world/eliteGates/egBandArt.js';   // EG-G2: the band's dress on every piece (EG-ZC: its liquid on the slag); EG-ZL: a Beat's warning
import { EG_BEAT_TELL_RECORDS } from '../../world/eliteGates/egBandArt.js';   // AUDIT EG III (lane4 #4): the Beat's records, freed at the breach's end
import { createEgPieceBatch, EG_BATCH_CULL_PAD } from './egPieceBatch.js';   // EG-G2: one draw a kind, culled
import { meshKitBounds } from '../../world/eliteGates/meshKit.js';
import { spherePlanes, sphereInPlanes } from '../../render/bounds.js';

/** EG-G2: the cull's view-projection and planes, kept (a frame makes nothing). */
const _vp = new Float32Array(16), _planes = new Float32Array(24);
/** `out` = a x b, column-major 4x4. */
function mul4(out, a, b) {
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) out[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
  return out;
}
/** Where a gone step's bucket waits (far under every floor). */
export const EG_STEP_GONE_Y = -400;
/** The bucket every step of a circle stands as. */
export const egStepKey = (h, i) => `eg:step:${h}:${i}`;
/** The floor's bucket (scenes/worldModes.js standEgHall): standing on it marks the cast-back's place. */
export const EG_FLOOR_KEY = 'eg:hall';

/** A plain slab (a still step, a ledge): its top's centre the origin, `w` across, `d` along, SD_STEP_THICK deep - the
 *  Hour's floor stone, a brass rim, the gold edge line round its top. */
export function egSlabModel(w, d) {
  const f = faces();
  slabFaces(f, w, d);
  return packRealmFaces(f);
}
/** A slab's faces into `f` (its top, its brass sides with their gold edge line, its underside). */
function slabFaces(f, w, d) {
  const x = w / 2, z = d / 2, h = SD_STEP_THICK;
  const P = (a, b, c) => [a, b, c];
  f.quad(SD_REALM_FLOOR_RECORD, P(-x, 0, -z), P(-x, 0, z), P(x, 0, z), P(x, 0, -z), [0, 0], [0, d / 2], [w / 2, d / 2], [w / 2, 0]);
  for (const [a, b, n] of [[P(-x, 0, -z), P(x, 0, -z), [0, 0, -1]], [P(x, 0, -z), P(x, 0, z), [1, 0, 0]], [P(x, 0, z), P(-x, 0, z), [0, 0, 1]], [P(-x, 0, z), P(-x, 0, -z), [-1, 0, 0]]]) {
    f.quad(SD_REALM_BRASS_RECORD, a, P(a[0], -h, a[2]), P(b[0], -h, b[2]), b, [0, 0], [0, 0.3], [1, 0.3], [1, 0]);
    const o = 0.02;
    f.quad(SD_REALM_EDGE_RECORD, P(a[0] + n[0] * o, 0.004, a[2] + n[2] * o), P(a[0] + n[0] * o, -0.05, a[2] + n[2] * o), P(b[0] + n[0] * o, -0.05, b[2] + n[2] * o), P(b[0] + n[0] * o, 0.004, b[2] + n[2] * o), [0, 0], [0, 1], [1, 1], [1, 0]);
  }
  f.quad(SD_REALM_FLOOR_RECORD, P(-x, -h, -z), P(x, -h, -z), P(x, -h, z), P(-x, -h, z), [0, 0], [1, 0], [1, 1], [0, 1]);
}
/** A slab's collider triangles (its own frame): its top and sides. */
export function egSlabTris(w, d) {
  const x = w / 2, z = d / 2, h = SD_STEP_THICK, out = [];
  const q = (a, b, c, e) => out.push(...a, ...b, ...c, ...a, ...c, ...e);
  q([-x, 0, -z], [x, 0, -z], [x, 0, z], [-x, 0, z]);
  q([-x, -h, -z], [x, -h, -z], [x, 0, -z], [-x, 0, -z]); q([-x, -h, z], [x, -h, z], [x, 0, z], [-x, 0, z]);
  q([-x, -h, -z], [-x, -h, z], [-x, 0, z], [-x, 0, -z]); q([x, -h, -z], [x, -h, z], [x, 0, z], [x, 0, -z]);
  const positions = new Float32Array(out), indices = new Uint16Array(positions.length / 3);
  for (let i = 0; i < indices.length; i++) indices[i] = i;
  return { positions, indices };
}
/** A DROP's landing (section 10.4): a slab `w` by `d` walled on its far side (+z) and both flanks to `H` over its top -
 *  a body that carries too far meets the wall and drops onto the landing. Its model and its collider triangles. LAYER
 *  THREE: the far wall keeps a doorway DROP_DOOR wide and high on the course's line (the course goes on through it - a
 *  wall whole across would end the road; the solver jumps on from the landing). */
const DROP_WALL_T = 0.3;
export const DROP_DOOR = Object.freeze({ w: 2.4, h: 3.0 });
export function egDropModel(w, d, H = EG_DROP_WALL_H) {
  const f = faces(), x = w / 2, z = d / 2, t = DROP_WALL_T;
  const P = (a, b, c) => [a, b, c];
  const box = (x0, x1, z0, z1, y0, y1) => {
    f.quad(SD_REALM_BRASS_RECORD, P(x0, y0, z0), P(x0, y1, z0), P(x1, y1, z0), P(x1, y0, z0), [0, 0], [0, y1 - y0], [x1 - x0, y1 - y0], [x1 - x0, 0]);
    f.quad(SD_REALM_BRASS_RECORD, P(x1, y0, z1), P(x1, y1, z1), P(x0, y1, z1), P(x0, y0, z1), [0, 0], [0, y1 - y0], [x1 - x0, y1 - y0], [x1 - x0, 0]);
    f.quad(SD_REALM_BRASS_RECORD, P(x0, y0, z1), P(x0, y1, z1), P(x0, y1, z0), P(x0, y0, z0), [0, 0], [0, y1 - y0], [z1 - z0, y1 - y0], [z1 - z0, 0]);
    f.quad(SD_REALM_BRASS_RECORD, P(x1, y0, z0), P(x1, y1, z0), P(x1, y1, z1), P(x1, y0, z1), [0, 0], [0, y1 - y0], [z1 - z0, y1 - y0], [z1 - z0, 0]);
    f.quad(SD_REALM_EDGE_RECORD, P(x0, y1, z0), P(x0, y1, z1), P(x1, y1, z1), P(x1, y1, z0), [0, 0], [0, 1], [1, 1], [1, 0]);
  };
  for (const [x0, x1, y0] of farWall(x, t)) box(x0, x1, z, z + t, y0, H);   // the far wall, its doorway open
  box(-x - t, -x, -z, z, -SD_STEP_THICK, H);   // the flanks
  box(x, x + t, -z, z, -SD_STEP_THICK, H);
  slabFaces(f, w, d);
  return packRealmFaces(f);
}
export function egDropTris(w, d, H = EG_DROP_WALL_H) {
  const { positions } = egSlabTris(w, d), x = w / 2, z = d / 2, t = DROP_WALL_T, out = [...positions];
  const q = (a, b, c, e) => out.push(...a, ...b, ...c, ...a, ...c, ...e);
  const box = (x0, x1, z0, z1, y0, y1) => {
    q([x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0]); q([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]);
    q([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]); q([x1, y0, z0], [x1, y0, z1], [x1, y1, z1], [x1, y1, z0]);
    q([x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]);
  };
  for (const [x0, x1, y0] of farWall(x, t)) box(x0, x1, z, z + t, y0, H);
  box(-x - t, -x, -z, z, -SD_STEP_THICK, H); box(x, x + t, -z, z, -SD_STEP_THICK, H);
  const pos = new Float32Array(out), indices = new Uint16Array(pos.length / 3);
  for (let i = 0; i < indices.length; i++) indices[i] = i;
  return { positions: pos, indices };
}
/** The far wall's pieces `[x0, x1, y0]` (to the wall's top): either side of the doorway, and its lintel. */
function farWall(x, t) {
  const h = DROP_DOOR.w / 2;
  return [[-x - t, -h, -SD_STEP_THICK], [h, x + t, -SD_STEP_THICK], [-h, h, DROP_DOOR.h]];
}
/** A PENDULUM's weight (section 10.3): a brass block EG_PEND_HALF either way on a chain to its anchor 6 m up. */
const PEND_CHAIN_H = 6;
export function egPendModel() {
  const f = faces(), h = EG_PEND_HALF, c = 0.06;
  const P = (a, b, cc) => [a, b, cc];
  const box = (rec, x0, x1, y0, y1, z0, z1) => {
    f.quad(rec, P(x0, y0, z0), P(x0, y1, z0), P(x1, y1, z0), P(x1, y0, z0), [0, 0], [0, 1], [1, 1], [1, 0]);
    f.quad(rec, P(x1, y0, z1), P(x1, y1, z1), P(x0, y1, z1), P(x0, y0, z1), [0, 0], [0, 1], [1, 1], [1, 0]);
    f.quad(rec, P(x0, y0, z1), P(x0, y1, z1), P(x0, y1, z0), P(x0, y0, z0), [0, 0], [0, 1], [1, 1], [1, 0]);
    f.quad(rec, P(x1, y0, z0), P(x1, y1, z0), P(x1, y1, z1), P(x1, y0, z1), [0, 0], [0, 1], [1, 1], [1, 0]);
    f.quad(rec, P(x0, y1, z0), P(x0, y1, z1), P(x1, y1, z1), P(x1, y1, z0), [0, 0], [0, 1], [1, 1], [1, 0]);
    f.quad(rec, P(x0, y0, z1), P(x0, y0, z0), P(x1, y0, z0), P(x1, y0, z1), [0, 0], [0, 1], [1, 1], [1, 0]);
  };
  box(SD_REALM_BRASS_RECORD, -h, h, 0, 2 * h, -h, h);
  box(SD_REALM_EDGE_RECORD, -c, c, 2 * h, 2 * h + PEND_CHAIN_H, -c, c);
  return packRealmFaces(f);
}
/** EG-ZC - A SLAG CRUST (section 11.2): one spout's platform (its top's centre the origin, `w` across, `d` along,
 *  SD_STEP_THICK deep) - the cooled crust (the band's root) on sides of the band's liquid still glowing, its underside the
 *  liquid too, THE EDGE LINE's gold round its top: gold on what you stand on means it holds. */
export function egSlagCrustModel(w, d) {
  const f = faces(), x = w / 2, z = d / 2, h = SD_STEP_THICK;
  const P = (a, b, c) => [a, b, c];
  f.quad(SD_REALM_ROOT_RECORD, P(-x, 0, -z), P(-x, 0, z), P(x, 0, z), P(x, 0, -z), [0, 0], [0, d / 2], [w / 2, d / 2], [w / 2, 0]);
  for (const [a, b, n] of [[P(-x, 0, -z), P(x, 0, -z), [0, 0, -1]], [P(x, 0, -z), P(x, 0, z), [1, 0, 0]], [P(x, 0, z), P(-x, 0, z), [0, 0, 1]], [P(-x, 0, z), P(-x, 0, -z), [-1, 0, 0]]]) {
    f.quad(EG_DRESS.molten, a, P(a[0], -h, a[2]), P(b[0], -h, b[2]), b, [0, 0], [0, 0.3], [1, 0.3], [1, 0]);
    const o = 0.02;
    f.quad(SD_REALM_EDGE_RECORD, P(a[0] + n[0] * o, 0.004, a[2] + n[2] * o), P(a[0] + n[0] * o, -0.05, a[2] + n[2] * o), P(b[0] + n[0] * o, -0.05, b[2] + n[2] * o), P(b[0] + n[0] * o, 0.004, b[2] + n[2] * o), [0, 0], [0, 1], [1, 1], [1, 0]);
  }
  f.quad(EG_DRESS.molten, P(-x, -h, -z), P(x, -h, -z), P(x, -h, z), P(-x, -h, z), [0, 0], [1, 0], [1, 1], [0, 1]);
  return packRealmFaces(f);
}
/** EG-ZC - A SLAG SPILL's molten lane over one spout's crossing while it pours: a sheet of the band's liquid just under the
 *  walk (no collider - magma is the void, section 11.8), `w` across and `d` along. */
export const EG_SLAG_MOLTEN_SINK = 0.15;
export function egSlagMoltenModel(w, d) {
  const f = faces(), x = w / 2, z = d / 2, y = -EG_SLAG_MOLTEN_SINK;
  f.quad(EG_DRESS.molten, [-x, y, -z], [-x, y, z], [x, y, z], [x, y, -z], [0, 0], [0, d / 2], [w / 2, d / 2], [w / 2, 0]);
  return packRealmFaces(f);
}
/** A COLLAPSING TUBE's vault over one segment (its own frame: the floor's top centre the origin): a slab of the vault's
 *  rock `height` up, the walls' width across - it falls with its floor. */
export function tubeLidModel(w, d, height) {
  const f = faces(), x = w / 2 + 0.6, z = d / 2, y0 = height, y1 = height + 1;
  const P = (a, b, c) => [a, b, c];
  f.quad(SD_REALM_ROOT_RECORD, P(-x, y0, -z), P(x, y0, -z), P(x, y0, z), P(-x, y0, z), [0, 0], [w / 2, 0], [w / 2, d / 2], [0, d / 2]);
  f.quad(SD_REALM_ROOT_RECORD, P(-x, y1, -z), P(-x, y1, z), P(x, y1, z), P(x, y1, -z), [0, 0], [0, d / 2], [w / 2, d / 2], [w / 2, 0]);
  for (const zz of [-z, z]) f.quad(SD_REALM_ROOT_RECORD, P(-x, y0, zz), P(-x, y1, zz), P(x, y1, zz), P(x, y0, zz), [0, 0], [0, 0.5], [w / 2, 0.5], [w / 2, 0]);
  return packRealmFaces(f);
}
/** A FALSE WALL in an alcove's doorway (section 11.10): a stone slab across the doorway (`door` its foot's middle, the
 *  dungeon's frame; `side` which way the niche runs along x), a faint gold seam down its face - its model and its collider
 *  triangles, both in the dungeon's frame. */
export function sealParts(door, side, y = door[1], along = /** @type {number[]|null} */ (null)) {
  // AUDIT EG V (lane5 #8): `along` - the wall's way in plan ([x, z], a hero alcove's - world/eliteGates/egHall.js egHeroDoor): the slab stands
  // flush in it, its thickness across it; a code-built niche's wall runs along z
  const f = faces(), u = along ?? [0, 1], n = along ? [u[1], -u[0]] : [1, 0], t = 0.2, hw = 1.0, h = 2.6, y0 = y, y1 = y + h;
  const C = (a, b, yy) => [door[0] + n[0] * a + u[0] * b, yy, door[2] + n[1] * a + u[1] * b];   // `a` across the wall, `b` along it
  const quads = [
    [C(-t, -hw, y0), C(-t, hw, y0), C(-t, hw, y1), C(-t, -hw, y1)], [C(t, hw, y0), C(t, -hw, y0), C(t, -hw, y1), C(t, hw, y1)],
    [C(-t, -hw, y0), C(-t, -hw, y1), C(t, -hw, y1), C(t, -hw, y0)], [C(t, hw, y0), C(t, hw, y1), C(-t, hw, y1), C(-t, hw, y0)],
    [C(-t, -hw, y1), C(-t, hw, y1), C(t, hw, y1), C(t, -hw, y1)],
  ];
  for (const q of quads) f.quad(SD_REALM_PILLAR_RECORD, q[0], q[1], q[2], q[3], [0, 0], [1, 0], [1, 1], [0, 1]);
  // the seam: a thin gold line down the face the passage sees (the face away from the niche)
  const as = (side > 0 ? -1 : 1) * (t + 0.004) * (n[0] < 0 ? -1 : 1);
  f.quad(SD_REALM_EDGE_RECORD, C(as, -0.03, y0 + 0.1), C(as, 0.03, y0 + 0.1), C(as, 0.03, y1 - 0.2), C(as, -0.03, y1 - 0.2), [0, 0], [1, 0], [1, 1], [0, 1]);
  const tris = [];
  for (const q of quads) tris.push(...q[0], ...q[1], ...q[2], ...q[0], ...q[2], ...q[3]);
  return { model: packRealmFaces(f), tris: new Float32Array(tris) };
}
const STEP_MESH_KIND = Object.freeze({ drift: 'drift', beat: 'beat', riser: 'riser', crumble: 'crumble', bone: 'crumble' });   // LAYER THREE: a Bone bridge wears the Crumble's cracks
/** EG-LOOK: the pieces that move or come and go on the clock (a Drift across, a Rail and a Drum along, a Moon branch with
 *  its beam; a Pendulum's weight and a slag's lanes stand with them) - one batch kind, apart from the still ones, so the
 *  still ones' vertices never go up with theirs. */
export const EG_SPAN_MOVERS = Object.freeze(['drift', 'rail', 'drum', 'moon']);
/** EG-LOOK: the most batch kinds a circle's spans stand (tools/spireLabProbe.mjs's "a handful of draws"): the still slabs,
 *  the movers, a Beat's phases, a Crumble's cracking and its chunks, the waystones, the Gust's banners, a hall's hangs, a
 *  Falling Wall's walk and a Collapsing Tube. */
export const EG_SPAN_KINDS_MAX = 16;
/** EG-LOOK: a waystone dark - the Steps' own, its rune the dark record (world/superDungeon/sdStepsArt.js SD_STEPS_RECORD.partsDark), so
 *  the lit and the dark stand in one kind. */
const darkStone = () => { const m = buildWaystoneModel(); return { ...m, subMeshes: m.subMeshes.map((sm) => (sm.textureRecord === SD_STEPS_RECORD.parts ? { ...sm, textureRecord: SD_STEPS_RECORD.partsDark } : sm)) }; };
const _at = { dx: 0, dz: 0, solid: true };
const _gust = { push: 0, warn: false };
/** A Falling Wall's segment (m along the walkway), and how fast a fallen one drops out of sight (m/s/s). */
export const EG_WALL_SEG_M = 2;
const WALL_FALL_G = 9.8;
/** The longest frame a Gust pushes for (s) - a hitch is not a gale (scenes/superDungeon/sdSteps.js's BREATH_DT_MAX). */
const EG_GUST_DT_MAX = 0.1;
/** EG6a: how far across a Gust section's line its push reaches (m - an island's 3 m and a body pushed off it). */
export const EG_GUST_REACH_M = 6;
/** THE ASCENT (spec law 9): how far over its course's top (m) and under its foot a Gust section still pushes - a body jumping
 *  on the course (its flight is a metre and a half), never a storey over it (THE ASCENT keeps EG_FRAG_HEADROOM_CM.course - 4.5 m
 *  - over a course; the sweep, seed 210: a bridge 21 m over a Gust's floor, pushed off it) or under it. */
export const EG_GUST_STOREY_M = Object.freeze({ over: 3, under: 2 });
/** Is the realm height `ry` on Gust section `g`'s storey? The laws before stack no storeys: every height is. */
export const egGustStorey = (g, ry) => (g.spec.law ?? 0) < 9 || (ry >= g.y - EG_GUST_STOREY_M.under && ry <= (g.y1 ?? g.y) + EG_GUST_STOREY_M.over);

// ── AUDIT EG III: SPIREBRIDGE'S PLANK (section 15) ────────────────────────────────────────────────────────────────
/** A Spirebridge's plank: how deep it stands (m), how long it takes to lay itself across (s - none under reduced motion), its
 *  last stretch (s) and how fast it falters through it (Hz - the Beat's last 0.4 s's grammar, under THE TELEGRAPH's 3 Hz; held
 *  still under reduced motion). */
export const EG_SB_THICK = 0.12;
export const EG_SB_GROW_S = 0.25;
export const EG_SB_LAST_S = 1;
export const EG_SB_FALTER_HZ = 2;
/** A PLANK's faces (its own frame - its near end's top centre the origin, +z across the gap): its top gold (the way, "it
 *  holds" - section 25.2) rising `dy` over its `len`, `w` across; brass sides under THE EDGE LINE (section 25.3, gold, never
 *  pulsing) round its top, as the Steps' slabs wear it (slabFaces). */
export function egBridgeModel(len, w, dy) {
  const f = faces(), x = w / 2, h = EG_SB_THICK;
  const P = (a, b, c) => [a, b, c];
  const A = P(-x, 0, 0), Bq = P(x, 0, 0), C = P(x, dy, len), D = P(-x, dy, len);
  f.quad(SD_REALM_EDGE_RECORD, A, D, C, Bq, [0, 0], [0, len / 2], [w / 2, len / 2], [w / 2, 0]);
  for (const [a, b, n] of [[A, Bq, [0, 0, -1]], [Bq, C, [1, 0, 0]], [C, D, [0, 0, 1]], [D, A, [-1, 0, 0]]]) {
    f.quad(SD_REALM_BRASS_RECORD, a, P(a[0], a[1] - h, a[2]), P(b[0], b[1] - h, b[2]), b, [0, 0], [0, 0.3], [1, 0.3], [1, 0]);
    const o = 0.02;
    f.quad(SD_REALM_EDGE_RECORD, P(a[0] + n[0] * o, a[1] + 0.004, a[2] + n[2] * o), P(a[0] + n[0] * o, a[1] - 0.05, a[2] + n[2] * o), P(b[0] + n[0] * o, b[1] - 0.05, b[2] + n[2] * o), P(b[0] + n[0] * o, b[1] + 0.004, b[2] + n[2] * o), [0, 0], [0, 1], [1, 1], [1, 0]);
  }
  f.quad(SD_REALM_FLOOR_RECORD, P(-x, -h, 0), P(x, -h, 0), P(x, dy - h, len), P(-x, dy - h, len), [0, 0], [1, 0], [1, 1], [0, 1]);
  return packRealmFaces(f);
}
/** A PLANK's collider triangles (its own frame, egBridgeModel's): its top and its sides. */
export function egBridgeTris(len, w, dy) {
  const x = w / 2, h = EG_SB_THICK, out = [];
  const q = (a, b, c, e) => out.push(...a, ...b, ...c, ...a, ...c, ...e);
  q([-x, 0, 0], [x, 0, 0], [x, dy, len], [-x, dy, len]);
  q([-x, -h, 0], [x, -h, 0], [x, 0, 0], [-x, 0, 0]); q([-x, dy - h, len], [x, dy - h, len], [x, dy, len], [-x, dy, len]);
  q([-x, -h, 0], [-x, dy - h, len], [-x, dy, len], [-x, 0, 0]); q([x, -h, 0], [x, dy - h, len], [x, dy, len], [x, 0, 0]);
  const positions = new Float32Array(out), indices = new Uint16Array(positions.length / 3);
  for (let i = 0; i < indices.length; i++) indices[i] = i;
  return { positions, indices };
}
/** A PLANK'S LOOK at relay ms `ms` (pure): `stand` - whether it holds (from its raising to its end), `grow` - how far across
 *  it has laid itself (0 to 1; whole at once under reduced motion), `seen` - whether it draws this frame (its last
 *  EG_SB_LAST_S faltering at EG_SB_FALTER_HZ, steady under reduced motion). */
export function egBridgeLook(q, ms, still = false) {
  const stand = ms >= q.from && ms < q.until, left = (q.until - ms) / 1000, since = (ms - q.from) / 1000;
  const grow = !stand ? 0 : still ? 1 : Math.max(0.05, Math.min(1, since / EG_SB_GROW_S));
  const falter = !still && left <= EG_SB_LAST_S && Math.floor(left * EG_SB_FALTER_HZ * 2) % 2 === 1;
  return { stand, grow, seen: stand && !falter };
}

// ── EG-ZL: THE PIECES' TELLS (sections 10.3 and 10.8) ─────────────────────────────────────────────────────────────
/** A DRIFT'S CHAINS (section 10.3: "hangs on two chains from an anchor 18 m up ... leaning as it swings"): a link's length,
 *  its width and its bar (m), every other link turned a quarter about the chain (each its two broad faces) - hung on the
 *  Steps' own pendulum's line (world/superDungeon/sdStepsModel.js SD_PENDULUM: SD_PENDULUM.foot either side of the deck's middle, clear
 *  of a body at its edge, from brackets SD_PENDULUM.into under its top up to the pivot SD_PENDULUM.len over it). */
export const EG_CHAIN = Object.freeze({ link: 0.9, w: 0.22, bar: 0.05 });
/** EG-PERFECT: how far each band's anchor stands over its pivot (m - egHangModel's own: the rib's crown, the ribcage's spine,
 *  the shard's tip, the crane's beam - its cable runs on up EG_HANG_CABLE_M); how far any anchor reaches about the pivot across
 *  and along, and down under it (the ribcage's ribs, the hook); and how far the chains reach about the deck's line (its foot
 *  and a link's width) (m). */
export const EG_HANG_TOP = Object.freeze([1.08, 0.22, 1.74, 0.45]);
export const EG_HANG_CABLE_M = 6;
export const EG_HANG_HALF = Object.freeze({ x: 3.5, z: 1.05, down: 1.6, chainX: SD_PENDULUM.foot + 0.25, chainZ: 0.25 });   // (EG-PERFECT's audit: down 1.4 left the first band's rib's lowest 0.17 m - 1.57 under its pivot - read at the chains' reach)
/** A floor's underside under its top (m - its slab and the first course of the ruin's foundation, world/eliteGates/egRuin.js), the
 *  shortest a capped hang's chains run (m), and how high over a deck a floor first stands over it (a body's height and more:
 *  ground nearer is a neighbour beside the course, never a floor over it). */
const EG_HANG_SLAB = 0.6, EG_HANG_MIN = 2.4, EG_HANG_OVER = 2.4;
/**
 * EG-PERFECT (2026-10-18, Mac: "...the design of the halls, and everything is absolutely perfect"; Elite-Gates.md section 10.3) -
 * A DRIFT'S HANG UNDER A FLOOR ABOVE: how long drift `s`'s chains (from its pivot to its deck's rest) and the crane's cable over
 * its beam are drawn in hall `spec` (band `band`'s anchor) - `{ len, over }`. LAW 9 stacks its ways, and 3.1% of its drifts
 * stood under a floor 12.9-17 m up that their 18 m chains and anchor passed through. The clearance is the lowest underside of
 * any floor more than EG_HANG_OVER over the deck that its chains would pass (their reach about the deck's travel - EG_HANG_HALF's
 * chainX, chainZ) or its anchor would (the anchor's wider reach, where the anchor hangs - from EG_HANG_HALF.down under the pivot
 * up): a plate or island, a passage's floor, a bridge, a stair, a room's floor or its whole box, a closed passage's vault the
 * deck stands in. The anchor hangs EG_HANG_TOP under it on chains that long (never under EG_HANG_MIN); the crane's cable runs
 * to it. With no floor in reach, SD_PENDULUM.len and EG_HANG_CABLE_M: the hang as it always was. The screen's alone - the
 * deck's swing is the law's (stepAt) whatever its chains, and the hang leans by its own length (hangLook). Pure.
 * @param {any} spec @param {any} s @param {number} band
 */
export function egHangReach(spec, s, band) {
  const top = EG_HANG_TOP[band] ?? EG_HANG_TOP[0], H = EG_HANG_HALF, a = s.amp ?? 0;
  let clear = Infinity;
  /** a floor whose plan's box is `ax0`-`ax1` by `az0`-`az1` (or a disc's, `r` about its middle) with its top at `y` */
  const over = (ax0, az0, ax1, az1, y, r = 0) => {
    const u = y - EG_HANG_SLAB - s.y, hi = u >= SD_PENDULUM.len - H.down, rx = a + (hi ? H.x : H.chainX), rz = hi ? H.z : H.chainZ;   // the anchor's reach where the anchor hangs, the chains' under it
    if (!(y - s.y > EG_HANG_OVER)) return;
    if (r > 0) { const cx = (ax0 + ax1) / 2, cz = (az0 + az1) / 2; if (Math.hypot(cx - Math.max(s.x - rx, Math.min(s.x + rx, cx)), cz - Math.max(s.z - rz, Math.min(s.z + rz, cz))) > r) return; }
    else if (!(ax0 < s.x + rx && ax1 > s.x - rx && az0 < s.z + rz && az1 > s.z - rz)) return;
    clear = Math.min(clear, u);
  };
  for (const d of spec.discs ?? []) over(d.x - d.r, d.z - d.r, d.x + d.r, d.z + d.r, d.y ?? 0, d.r);
  for (const b of spec.bands ?? []) over(b.x - b.halfW, b.z0, b.x + b.halfW, b.z1, b.y ?? 0);
  for (const l of spec.lanes ?? []) over(Math.min(l.ax, l.bx) - l.hw, Math.min(l.az, l.bz) - l.hw, Math.max(l.ax, l.bx) + l.hw, Math.max(l.az, l.bz) + l.hw, l.y ?? 0);
  for (const r of spec.ramps ?? []) over(Math.min(r.ax, r.bx) - r.hw, Math.min(r.az, r.bz) - r.hw, Math.max(r.ax, r.bx) + r.hw, Math.max(r.az, r.bz) + r.hw, Math.min(r.y0, r.y1));
  for (const q of spec.heroes ?? []) {
    for (const f of q.floors ?? []) { let fx0 = Infinity, fz0 = Infinity, fx1 = -Infinity, fz1 = -Infinity; for (const [px, pz] of f.poly) { fx0 = Math.min(fx0, px); fz0 = Math.min(fz0, pz); fx1 = Math.max(fx1, px); fz1 = Math.max(fz1, pz); } over(fx0, fz0, fx1, fz1, f.y ?? 0); }   // a room's floor: its polygon's box
    const B = q.box;
    if (B) over(B[0], B[2], B[3], B[5], B[1] + EG_HANG_SLAB);   // a room over it: its whole box (THE AUDIT: the hall's frame already, as its floors - egHeroDoor's, egRuin's)
  }
  for (const c of spec.caves ?? []) if (!c.open && Math.abs(s.x - c.x) <= c.halfW && s.z >= c.z0 && s.z <= c.z1 && s.y >= c.y - 0.5) over(c.x - c.halfW, c.z0, c.x + c.halfW, c.z1, c.y + c.height + EG_HANG_SLAB);   // its vault
  const crane = band === 3;   // its cable runs on over its beam, and shortens first
  if (!(clear < SD_PENDULUM.len + (crane ? EG_HANG_CABLE_M : top))) return { len: SD_PENDULUM.len, over: EG_HANG_CABLE_M };
  const len = Math.round(100 * Math.max(EG_HANG_MIN, Math.min(SD_PENDULUM.len, clear - top))) / 100;
  return { len, over: crane ? Math.round(100 * Math.max(0, Math.min(EG_HANG_CABLE_M, clear - len))) / 100 : EG_HANG_CABLE_M };
}
/**
 * A DRIFT'S HANG, band `band`'s, in the pendulum's own frame (its pivot the origin): its two chains, each with its bracket
 * out of the deck's side, in the band's metal (EG_DRESS.brass: gold leaf, bone, moon-silver, iron), and the ANCHOR they hang
 * from (section 10.3, in the order of world/eliteGates/egBandArt.js EG_BAND_RAMPS): the Galleries' broken arch rib (EG-LOOK: in the kit's
 * voussoirs - world/eliteGates/egKit.js EG_KIT_RECORD.voussoir), gold leaf on its crown; the Cairn's ribcage in bone; the Shade's moon-shard; the Wellhead's crane hook in iron, on its cable. The
 * whole turns about z with the law's own swing (pendulumAngle) - the anchor rocking with its chains, as the Hour's gear rocks
 * with its rods (scenes/superDungeon/sdSteps.js driftLook), never more than asin(2 / 18). EG-PERFECT (2026-10-18): `len` its
 * chains' length from the pivot to the deck's rest and `over` the crane's cable over its beam - SD_PENDULUM.len and
 * EG_HANG_CABLE_M where nothing stands over it, shorter under a floor (egHangReach).
 * @param {number} band @param {number} [len] @param {number} [over]
 */
export function egHangModel(band, len = SD_PENDULUM.len, over = EG_HANG_CABLE_M) {
  const k = createMeshKit(), P = SD_PENDULUM, F = P.foot, L = EG_CHAIN.link, low = -(len + P.into), n = Math.ceil(-low / L), B = SD_REALM_BRASS_RECORD;
  for (const sx of [-1, 1]) {
    const x = sx * F;
    for (let i = 0; i < n; i++) {
      const y1 = -i * L + EG_CHAIN.bar, y0 = Math.max(low, -(i + 1) * L - EG_CHAIN.bar), flat = i % 2 === 0;   // each link over its neighbours' ends
      const hx = flat ? EG_CHAIN.w / 2 : EG_CHAIN.bar, hz = flat ? EG_CHAIN.bar : EG_CHAIN.w / 2;
      k.box(B, [x - hx, y0, -hz], [x + hx, y1, hz], { skip: flat ? ['top', 'bottom', 'nx', 'px'] : ['top', 'bottom', 'nz', 'pz'] });
    }
    const a = Math.min(sx * P.eye, x), b = Math.max(sx * P.eye, x), r = P.rod / 2;
    k.box(B, [a - r, low - r, -r], [b + r, low + r, r]);   // its bracket, out of the deck's side
  }
  const sq = (h, w = h) => [[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]];
  if (band === 1) {   // the ribcage: a spine across, five pairs of ribs curling down and out
    k.sweep(B, sq(0.22), [[-F - 0.8, 0.11, 0], [F + 0.8, 0.11, 0]]);
    for (let i = -2; i <= 2; i++) for (const s of [-1, 1]) { const x = (i / 2) * F; k.sweep(B, sq(0.12), [[x, 0.11, 0], [x, -0.2, 0.9 * s], [x, -1.3, 0.95 * s]]); }
  } else if (band === 2) {   // the moon-shard: a jagged crystal lying across, its tips past the chains
    const ring = (x, r, y) => Array.from({ length: 6 }, (_, j) => { const a = (j / 6) * Math.PI * 2 + x; return [x, y + Math.cos(a) * r * (j % 2 ? 0.8 : 1), Math.sin(a) * r * (j % 2 ? 0.8 : 1)]; });
    const pts = [[-F - 1.0, 0.7, 0], ring(-1.3, 0.55, 0.75), ring(0.15, 0.85, 0.9), ring(1.4, 0.5, 0.7), [F + 0.9, 0.65, 0.1]];
    const axis = (p) => [p[0], 0.75, 0];
    for (let r = 1; r < 4; r++) {
      const A = pts[r], Bn = r < 3 ? pts[r + 1] : null;
      for (let j = 0; j < 6; j++) {
        const a = A[j], b = A[(j + 1) % 6];
        if (r === 1) k.tri(B, pts[0], a, b, axis(a), false);
        if (Bn) k.quad(B, a, b, Bn[(j + 1) % 6], Bn[j], axis(a), false);
        else k.tri(B, a, b, pts[4], axis(a), false);
      }
    }
  } else if (band === 3) {   // the crane hook: an iron beam on its cable, the hook hanging from its middle
    k.box(B, [-F - 0.5, 0, -0.22], [F + 0.5, 0.45, 0.22]);
    if (over > 0.45) k.box(B, [-0.05, 0.45, -0.05], [0.05, over, 0.05]);   // EG-PERFECT: its cable up to the floor over it, where one stands
    k.sweep(B, sq(0.14), [[0, 0, 0], [0, -0.9, 0], [0.3, -1.25, 0], [0.62, -1.0, 0], [0.62, -0.82, 0]]);
  } else {   // the arch rib: a broken marble rib over the deck, its crown in gold leaf
    const R = 3.4, yc = -Math.sqrt(R * R - F * F), a0 = Math.acos(3.2 / R), crown = [];
    for (let i = 0; i <= 8; i++) { const a = a0 + ((Math.PI - 2 * a0) * i) / 8; crown.push([(R + 0.28) * Math.cos(a), yc + (R + 0.28) * Math.sin(a), 0]); }
    // EG-LOOK: its blocks the kit's voussoirs (world/eliteGates/egBandArt.js EG_KIT_MAP: u along the arc - a block each 0.5 m - v out
    // from its intrados), 0.5 m deep and 0.6 thick, its two broken ends closed
    const V = EG_KIT_RECORD.voussoir, ri = R - 0.25, ro = R + 0.25, zt = 0.3, ang = (i) => a0 + ((Math.PI - 2 * a0) * i) / 8;
    const Pt = (i, rr, z) => [rr * Math.cos(ang(i)), yc + rr * Math.sin(ang(i)), z], u = (i) => ((ang(i) - a0) * R) / 2;
    for (let i = 0; i < 8; i++) {
      const d = [Math.cos((ang(i) + ang(i + 1)) / 2), Math.sin((ang(i) + ang(i + 1)) / 2), 0], u0 = u(i), u1 = u(i + 1);
      k.quad(V, Pt(i, ro, -zt), Pt(i + 1, ro, -zt), Pt(i + 1, ro, zt), Pt(i, ro, zt), d, true, [[u0, 0.25], [u1, 0.25], [u1, 0.25], [u0, 0.25]]);
      k.quad(V, Pt(i, ri, -zt), Pt(i + 1, ri, -zt), Pt(i + 1, ri, zt), Pt(i, ri, zt), [-d[0], -d[1], 0], true, [[u0, 0], [u1, 0], [u1, 0], [u0, 0]]);
      for (const z of [-zt, zt]) k.quad(V, Pt(i, ri, z), Pt(i + 1, ri, z), Pt(i + 1, ro, z), Pt(i, ro, z), [0, 0, Math.sign(z)], true, [[u0, 0], [u1, 0], [u1, 0.25], [u0, 0.25]]);
    }
    for (const [i, s] of [[0, -1], [8, 1]]) { const t = [-Math.sin(ang(i)) * s, Math.cos(ang(i)) * s, 0]; k.quad(V, Pt(i, ri, -zt), Pt(i, ro, -zt), Pt(i, ro, zt), Pt(i, ri, zt), t, true, [[0, 0], [0, 0.25], [0.3, 0.25], [0.3, 0]]); }
    k.sweep(B, sq(0.06, 0.64), crown);
  }
  return k.pack(egBandArchive(band));   // EG-LOOK: in the band's archive (its metal the band's, its rib the kit's)
}
/** THE CIRCLE'S GHOSTS at most (render/superDungeon/sdStepsPass.js - its uniforms' count): under laws 4-9 the most any circle measured
 *  lays is 31 (eight seeds, forty circles, both grounds). EG-PERFECT's audit: spec law 10 lays up to 72 (21 of seeds 1-4's 320
 *  circles past this), never more than 29 in one hall - so a circle past it ghosts the hall I am in and the halls nearest it
 *  (createEgSpan's aimGhosts). */
export const EG_GHOSTS_MAX = 48;
/** A GHOST SLAB (section 10.8): how long a peer's word holds it lit (s - a few of its frames) and its top's light (a share
 *  of its ghost's). */
export const EG_GHOST_SLAB = Object.freeze({ hold: 0.3, fill: 0.35 });
/** A BEAT'S PICTURES UP (world/eliteGates/egBandArt.js egBeatWarnArt, egBeatBackArt - cutouts under band `band`'s tell archive) for
 *  palette `key` on `renderer`: uploaded the first time a renderer is asked for that band and palette, and kept while the
 *  breach stands (the band's own dress's law - EG-ZN: up once a breach, so a swap uploads nothing again; AUDIT EG III lane4
 *  #4: freed with it at the breach's end - egBeatTellDown). Answers whether they stand; a renderer with no upload holds
 *  none. */
const _tellUp = new WeakMap();
export function egBeatTellUp(renderer, band, key) {
  if (!renderer || typeof renderer !== 'object') return false;
  let up = _tellUp.get(renderer);
  if (!up) _tellUp.set(renderer, up = new Map());
  const k = `${band | 0}:${key}`, back = `${band | 0}:back`;
  if (!up.has(k)) {
    let ok = false;
    if (typeof renderer.uploadTexture === 'function') {
      try {
        for (const [rec, art] of [...egBeatWarnArt(key), ...(up.has(back) ? [] : egBeatBackArt())]) { renderer.uploadTexture(egTellArchive(band), rec, art.albedo, { cutout: true }); renderer.uploadEmissionTexture?.(egTellArchive(band), rec, art.emission, { white: true }); }
        up.set(back, true); ok = true;
      } catch (e) { console.warn('[eg] a Beat\'s pictures would not upload', e?.message ?? e); }
    }
    up.set(k, ok);
  }
  return up.get(k);
}
/** AUDIT EG III (lane4 #4, EVERY ALLOCATION HAS AN OWNER - section 29: "band textures are cached per band and freed at the
 *  breach's end"): every Beat's picture `renderer` holds (each band's tell archive, its warning stages and its return -
 *  world/eliteGates/egBandArt.js EG_BEAT_TELL_RECORDS - albedo and emission) freed, and the record of them let go, so the next breach
 *  uploads them again. The mode machine's band dress owner calls it (scenes/worldModes.js egBandsDown). Answers how many
 *  textures it freed. */
export function egBeatTellDown(renderer) {
  const up = renderer && typeof renderer === 'object' ? _tellUp.get(renderer) : null;
  if (!up?.size) return 0;
  const bands = new Set([...up.keys()].map((k) => Number(k.split(':')[0])));
  _tellUp.delete(renderer);
  let n = 0;
  for (const band of bands) {
    const arch = egTellArchive(band);
    for (const rec of [...[...EG_BEAT_TELL_RECORDS.warn.flat(), ...EG_BEAT_TELL_RECORDS.back], ...EG_PIECE_TELL_RECORDS]) { if (renderer.releaseTexture?.(arch, rec)) n++; if (renderer.evictEmissionTexture?.(`${arch}_${rec}`)) n++; }   // EG-LOOK: and a Crumble's stages, a Beat's stone
  }
  return n;
}
/**
 * EG-LOOK - THE PIECES' OWN PICTURES UP (world/eliteGates/egPlatformArt.js, under band `band`'s tell archive): a Crumble's four stages
 * in the band's flags (`crumble` - its rest and its three cracks, with their light) and a Beat's stone dissolving (`beat`
 * - the band's moulding and foundation cut by the dither, cutouts), each the first time a renderer is asked for that band,
 * kept while the breach stands and freed with the Beat's pictures (egBeatTellDown - the breach's end). Answers whether
 * what was asked for stands.
 * @param {any} renderer @param {number} band @param {{ crumble?: boolean, beat?: boolean }} want
 */
export function egPieceTellUp(renderer, band, { crumble = false, beat = false } = {}) {
  if (!renderer || typeof renderer !== 'object' || typeof renderer.uploadTexture !== 'function') return false;
  let up = _tellUp.get(renderer);
  if (!up) _tellUp.set(renderer, up = new Map());
  const arch = egTellArchive(band);
  const once = (k, list, cutout) => {
    if (!up.has(k)) {
      let ok = false;
      try { for (const [rec, art] of list()) { renderer.uploadTexture(arch, rec, art.albedo, cutout ? { cutout: true } : undefined); renderer.uploadEmissionTexture?.(arch, rec, art.emission, { white: true }); } ok = true; } catch (e) { console.warn('[eg] a piece\'s pictures would not upload', e?.message ?? e); }
      up.set(k, ok);
    }
    return up.get(k);
  };
  let ok = true;
  if (crumble) ok = once(`${band | 0}:crumble`, () => egCrumbleTellArt(band), false) && ok;
  if (beat) ok = once(`${band | 0}:stone`, () => egBeatStoneArt(band), true) && ok;
  return ok;
}
/** EG-LOOK: a Beat's maps in band `band` and palette `key` - the dial's (world/eliteGates/egBandArt.js egBeatTellMaps) with its stone's
 *  dissolving beside it (EG_BEAT_STONE_RECORDS): `{ warn, back }`, made once each. */
const _beatMaps = new Map();
function egBeatDressMaps(band, key) {
  const W = egBeatTellMaps(band, key), k = `${band | 0}:${key}`;
  let m = _beatMaps.get(k);
  if (!m || m.W !== W) {
    const arch = egBandArchive(band), tell = egTellArchive(band);
    const merge = (dial, stage, list) => new Map([...dial, ...EG_BEAT_STONE_RECORDS.map((q) => [`${arch}_${q.rec}`, `${tell}_${q[list][stage]}`])]);
    _beatMaps.set(k, m = { W, warn: Object.freeze(W.warn.map((d, s) => merge(d, s, 'warn'))), back: Object.freeze(W.back.map((d, s) => merge(d, s, 'back'))) });
  }
  return m;
}
/** AUDIT EG III (lane4 #5, sections 25.2 and 25.7): a ghost's line in the danger palette's safety - the Steps' own gold under
 *  the Standard (render/superDungeon/sdStepsPass.js SD_GHOST.color), the palette's safety under any other. Pure. */
export const egGhostRgb = (pal) => (pal && pal.key !== 'standard' && Array.isArray(pal.safety) ? pal.safety : SD_GHOST.color);
/** A Beat's kind: its beat (the pieces of one beat show one frame - their draw shares one picture map). */
const beatKind = (s) => `beat@${Math.round(s.beat * 1000)}`;
/** `out` made a turn by `yw` about y (0 faces +z, a quarter turn +x), then the move to (x, y, z) - in place (the Hour's
 *  vane's - scenes/superDungeon/sdSteps.js yawAbout). */
function yawAbout(out, yw, x, y, z) {
  const c = Math.cos(yw), s = Math.sin(yw);
  out.fill(0);
  out[0] = c; out[2] = -s; out[5] = 1; out[8] = s; out[10] = c; out[15] = 1;
  out[12] = x; out[13] = y; out[14] = z;
  return out;
}
const _vane = new Float64Array(2);
/**
 * AUDIT EG V (L6-10): THE COLLIDER A HOST HANDS THE SPANS - the two doors the spans use of `collider` (a step's, a lane's or a
 * plank's bucket in; a Spirebridge's plank out at its end), each key the spans stood kept in `keys`, so the host takes them
 * out again at THE SWAP (scenes/dungeonContext.js egRecircle) - a key taken out at a plank's end leaves the list with it.
 * The dungeon host's own wrapper had `addMesh` alone: a plank's draw and mesh went at its end and its bucket stood at its
 * last pose for the rest of the circle - an unseen bridge over the gap on every screen, while the relay's fair trail
 * (net/eliteGates/egFair.js egSupportAt, the plank's `until`) held a body on it as in the air.
 * @param {{ addMesh: Function, removeBucket: Function }} collider @param {string[]} keys
 */
export function egSpanCollider(collider, keys) {
  return {
    addMesh: (...a) => { keys.push(a[0]); return collider.addMesh(...a); },
    removeBucket: (k) => { const i = keys.indexOf(k); if (i >= 0) keys.splice(i, 1); return collider.removeBucket(k); },
  };
}

/**
 * A circle's spans.
 * @param {{ renderer?: any, audio?: any, seed: number, c: number, geo?: number, lite?: boolean }} deps - EG-ZL: `lite` the
 *   phone's tier (ui/touch/touchDevice.js isTouchDevice - its own by default): two chunks a Crumble, not four (the Hour's tier)
 */
export function createEgSpan({ renderer = null, audio = null, seed, c, geo = 0, lite = isTouchDevice() }) {
  const specs = egCircleSpecs(seed, c, geo);
  /** every step of the circle: its spec record (the hall's frame) and its hall, its bucket and place, its draw. EG-ZL: its
   *  tells' slots - a Crumble's crack stages, chunks and grit, a Drift's hang (its chains and their anchor, about its
   *  `pivot`) - when my foot's Crumble came whole again (`back`), when a peer last stood on it fallen (`peerAt`), and its
   *  ghost's slot (-1 none) */
  const steps = [];
  for (const spec of specs) for (const s of spec.steps) steps.push({ s, spec, key: egStepKey(spec.h, s.i), T: [0, EG_STEP_GONE_Y, 0], was: [0, EG_STEP_GONE_Y, 0], solid: false, wasSolid: false, draw: null, pend: null, touched: null, wait: SD_CRUMBLE_DELAY, stages: null, chunks: null, grit: null, hang: null, pivot: null, len: SD_PENDULUM.len, back: -Infinity, peerAt: -Infinity, ghost: -1 });
  const byKey = new Map(steps.map((st) => [st.key, st]));
  /** @type {Map<string, any>} */
  const meshes = new Map();
  let draws = null;
  /** where my feet last stood on a floor or a solid step, and how high that floor was (the void's measure) */
  let safe = null, safeY = 0;
  /** EG-ZG: whether my body, this frame before the motor, falls onto a Drop the course asked for */
  let overDrop = false;
  /** EG-PERFECT (2026-10-18; Elite-Gates-Ascent.md section 2 - THE VOID ZONES): a fall's memory over the void zones of the hall I
   *  stand in (net/eliteGates/egFair.js egVoidStep - the relay's own law: the zone it passed), my feet last frame and this one (the
   *  hall's frame, two buffers swapped - nothing allocated a frame), the height I last stood at (any ground - the fair trail's
   *  last support), and that hall */
  const voidFall = { v: null }, EG_VOID_LEAP_M = 6;
  let voidA = [0, 0, 0], voidB = [0, 0, 0], voidHas = false, voidFromY = NaN, voidH = 0;
  /**
   * EG-PERFECT - INTO THE VOID: did my body at (rx, ry, rz) (the realm's frame), `grounded` or not, just fall through one of a
   * routed hall's void zones from the ground it last stood on (egVoidStep - EG_VOID_DROP_M under it, the zone's footprint read
   * widened by the step-off reach)? LAW 9 laid them "wherever a fall would skip ahead along the route" and nothing read them:
   * off the 49 m bridge 18.3 m up in seed 3's hall 27, a step landed 10.5 m down on a later leg, 290 m on along the way. A hall
   * that lays none (laws 4-8) answers false and keeps nothing.
   */
  function intoVoid(rx, ry, rz, grounded) {
    const hs = specs.find((q) => q.voids?.length && Math.abs(rx - q.x0) <= 160);
    if (!hs) { voidHas = false; voidFall.v = null; voidFromY = NaN; return false; }
    if (hs.h !== voidH) { voidH = hs.h; voidHas = false; voidFall.v = null; voidFromY = NaN; }
    const a = voidA; voidA = voidB; voidB = a;
    voidA[0] = rx - hs.x0; voidA[1] = ry; voidA[2] = rz;
    // a stretch wider in plan than any frame's run (a cast-back, a pull, a recall) is a place given, never a fall through one
    if (voidHas && Math.hypot(voidA[0] - voidB[0], voidA[2] - voidB[2]) > EG_VOID_LEAP_M) { voidHas = false; voidFall.v = null; }
    const hit = Number.isFinite(voidFromY) && !!egVoidStep(voidFall, hs, voidFromY, voidHas ? voidB : null, voidA, grounded);
    voidHas = true;
    if (grounded) voidFromY = ry;
    return hit;
  }
  const band = egBandOfCircle(c);   // EG-G2: every piece in its band's dress (the Steps' own faces keep the Hour's - world/eliteGates/egBandArt.js)
  const make = (model) => { if (!model || !renderer?.createMesh) return null; try { return renderer.createMesh(egBandDress(model, band)); } catch (e) { console.warn('[eg] a span would not build', e?.message ?? e); return null; } };
  const play = (rec, vol, pitch = 1) => { try { audio?.playOneShot?.(rec, vol, pitch); } catch { /* no sound */ } };
  const play3 = (rec, at, vol, pitch = 1) => { try { audio?.play3d?.(rec, at, vol, { maxDistance: 30, pitch }); } catch { /* no sound */ } };   // EG-ZL: where it stands (the Steps' grind and click home)
  /** EG-LOOK: a piece's batch kind - a Beat's its beat's (EG-ZL), the ones that move or come and go on the clock apart
   *  from the ones that hold still (a kind's vertices go up only when one of its copies moves) */
  const kindOf = (s) => (s.kind === 'beat' ? beatKind(s) : EG_SPAN_MOVERS.includes(s.kind) ? 'mover' : 'slab');
  /** EG-LOOK: a step's box as its collider has it (a Drift's, a Beat's, a Riser's - the Steps' own, stepTris) */
  const boxOf = (s) => (STEP_MESH_KIND[s.kind] ? stepBox(STEP_MESH_KIND[s.kind]) : { w: s.w, d: s.d });
  /** EG-LOOK: a step's own model - the academy torn in its band's dress, off its own seed (world/eliteGates/egPlatformModel.js) */
  const modelOf = (st) => {
    const s = st.s, B = boxOf(s), plan = egPiecePlan(st.spec, s, { seed: egPieceSeed(seed, c, st.spec.h, s.i), lite, band, w: B.w, d: B.d });
    return s.kind === 'beat' ? egBeatModel(band, plan) : s.kind === 'riser' ? egRiserModel(band, plan) : s.kind === 'drop' ? egDropLookModel(band, plan, EG_DROP_WALL_H, DROP_DOOR) : egPieceModel(band, plan);
  };
  const trisOf = (s) => (STEP_MESH_KIND[s.kind] ? stepTris(STEP_MESH_KIND[s.kind]) : s.kind === 'drop' ? egDropTris(s.w, s.d) : egSlabTris(s.w, s.d));
  /** each hall's Gust sections (world/eliteGates/egLook.js egGustSections - a run of Gusts, on its road's line) */
  const gusts = egGustSections(specs);
  /** EG-G2: the circle's pieces batched (scenes/eliteGates/egPieceBatch.js), or null (no renderer that moves vertices - a draw a piece) */
  let batch = null;
  /** @type {Map<string, any>} the batched kinds' models */
  const models = new Map();
  // ── EG-ZL: THE PIECES' TELLS ──
  /** @type {Map<string, any[]>} each kind's own draws, when there is no batch (its picture map set on each) */
  const plainOf = new Map();
  /** @type {Map<string, { s: any, map: any }>} THE BEATS: each beat's kind and the picture map its frame wears now */
  const beatKinds = new Map();
  /** THE GHOSTS: the circle's Beats and Crumbles (EG_GHOSTS_MAX at most) - their tops and states (render/superDungeon/sdStepsPass.js's
   *  two uniform arrays, written in place) and their pass, made the first time it draws and freed at the clear. EG-PERFECT's
   *  audit: a circle of more (spec law 10 breaks its bridges on Beats and Crumbles - 72 in seed 7's circle 5) has its slots
   *  stand for the hall I am in and the halls nearest it, aimed again as I cross into another (aimGhosts) - the circle's
   *  first EG_GHOSTS_MAX alone, its later halls drew none */
  const ghostAll = steps.filter((st) => st.s.kind === 'beat' || EG_CRUMBLE_KINDS.includes(st.s.kind));
  let ghostSteps = ghostAll.slice(0, EG_GHOSTS_MAX), ghostHall = ghostAll.length > EG_GHOSTS_MAX ? -1 : null;
  ghostSteps.forEach((st, k) => { st.ghost = k; });
  const ghostStep = new Float32Array(EG_GHOSTS_MAX * 4), ghostState = new Float32Array(EG_GHOSTS_MAX * 4);
  const ghostKinds = () => ghostSteps.map((st) => ({ kind: st.s.kind === 'beat' ? 'beat' : 'crumble' }));
  /** EG-PERFECT's audit: a circle past the slots - its ghosts the hall nearest realm x `rx` and the halls nearest it, in the
   *  circle's order within a hall; nothing to do while that hall's are stood (a circle within the slots keeps its own). */
  function aimGhosts(rx) {
    if (ghostHall === null) return;
    let hs = null;
    for (const q of specs) if (!hs || Math.abs(rx - q.x0) < Math.abs(rx - hs.x0)) hs = q;
    if (!hs || hs.h === ghostHall) return;
    ghostHall = hs.h;
    for (const st of ghostSteps) st.ghost = -1;
    const off = (st) => Math.abs(st.spec.x0 - hs.x0);
    ghostSteps = ghostAll.map((st, k) => ({ st, k })).sort((a, b) => off(a.st) - off(b.st) || a.k - b.k).slice(0, EG_GHOSTS_MAX).map((q) => q.st);
    ghostSteps.forEach((st, k) => { st.ghost = k; });
    ghostStep.fill(0); ghostState.fill(0);
    pass?.ghosts(ghostKinds());
  }
  /** @type {SdStepsPass | null} */
  let pass = null;
  // FIRST-USE (#1144): THE GHOSTS' PROGRAM and THE LOOK'S, started as the hall loads where the driver compiles beside the
  // frames - the look (egLookDraw.js) is made in the first frame drawn in the Spire. The ghosts are asked as needed (a ghost
  // is where a step returns), so the frame one is first drawn builds the pass whatever the driver says. Made again after a clear.
  const ghostOpts = { max: EG_GHOSTS_MAX, slab: true, fogFloor: EG_FOG_FLOOR };
  const ghostsDoor = () => (renderer?.gl ? compiledPass(renderer.gl, sdStepsPrograms(ghostOpts), () => new SdStepsPass(renderer.gl, ghostKinds(), ghostOpts), (e) => console.warn('[eg] the ghosts would not build', e?.message ?? e)) : null);
  let passOf = ghostsDoor();
  if (renderer?.gl && parallelCompile(renderer.gl)) { startPrograms(renderer.gl, sdStepsPrograms(ghostOpts)); startEgLookPrograms(renderer.gl); }
  /** THE CHUNKS a Crumble breaks into (two on a phone) and their ways (scenes/superDungeon/sdSteps.js sdChunkWays - the Hour's law). EG-LOOK:
   *  a Crumble's models in its band's dress (world/eliteGates/egPlatformModel.js egCrumbleModels - the Steps' own box and chunks in the
   *  band's flags cracking): its rest, its three stages, its chunks */
  const crumbleSet = egCrumbleModels(band, lite ? 2 : 4), chunkWays = sdChunkWays(crumbleSet.chunks);
  /** THE WAYSTONES: one on every island, at the Steps' own place beside its landing (world/superDungeon/sdStepsModel.js sdWaystonesOf) -
   *  each its lit draw and its dark; and the one my cast-back would stand me on. EG6a: read off the courses the generator
   *  laid (net/eliteGates/egSpanLaw.js egCourseOf - each road's checkpoints but the arrival plate, the Low Road's island its own) */
  const stones = [];
  for (const spec of specs) for (const road of [0, 1]) {
    const course = egCourseOf(spec, road);
    if (!course) continue;
    const at = sdWaystonesOf(course);
    for (let k = road === 0 ? 1 : 0; k < at.length; k++) stones.push({ spec, isl: course.checkpoints[k], at: realmToDungeon(spec.x0 + at[k][0], at[k][1], at[k][2]), lit: null, dark: null });
  }
  let litStone = null;
  /** THE GUST'S BANNERS: the Steps' vane on every island of a Gust section (sdVaneAt's place on it); each section heard
   *  over its islands too (`h0`-`h1`, the hall's z). EG6a: a section is a run of Gusts on its road's line (egGustSections),
   *  so its islands are the ones on that line - THE FORK's other road's island beside it stands in no breath of its */
  const vanes = [];
  for (const g of gusts) {
    g.h0 = g.z0; g.h1 = g.z1;
    for (const isl of g.spec.islands) if (isl.z + isl.r >= g.z0 && isl.z - isl.r <= g.z1 && Math.abs(isl.x - g.x) <= EG_GUST_REACH_M) { const v = sdVaneAt({ checkpoints: [isl, isl, isl] }); vanes.push({ at: realmToDungeon(g.spec.x0 + v[0], v[1], v[2]), draw: null }); g.h0 = Math.min(g.h0, isl.z - isl.r); g.h1 = Math.max(g.h1, isl.z + isl.r); }
  }
  /** the gust last heard (its number), the last ride's clock (s), the screen's settings this frame (ui/eliteGates/egAccess.js: the
   *  danger palette, reduced motion) */
  let lastWarned = null, lastT = -Infinity;
  let access = { palette: null, fill: 1, still: false };
  /** A Beat's dissolving pictures in the palette standing now: its picture maps (world/eliteGates/egBandArt.js egBeatTellMaps), its
   *  warning's art (and the return's) painted and uploaded under the band's tell archive as cutouts the first time this
   *  renderer is asked for that band and palette - the session's, as the band's own dress is (EG-G2), so a swap uploads
   *  nothing again - or null with no renderer to hold them. */
  function tellMaps() {
    const key = access.palette?.key ?? 'standard';
    if (!renderer || !egBeatTellUp(renderer, band, key)) return null;
    return egPieceTellUp(renderer, band, { beat: true }) ? egBeatDressMaps(band, key) : egBeatTellMaps(band, key);   // EG-LOOK: its stone dissolving with its dial
  }
  /** A step's tells stood, before the batch is built: a Beat's kind, a Crumble's crack stages, chunks and grit, a Drift's
   *  hang. */
  function standTells(st) {
    const s = st.s;
    if (s.kind === 'beat') {
      if (!beatKinds.has(beatKind(s))) beatKinds.set(beatKind(s), { s, map: undefined });
    } else if (EG_CRUMBLE_KINDS.includes(s.kind)) {
      st.stages = [1, 2, 3].map((n) => place('crack', `crumble:${n}`, () => crumbleSet.stages[n - 1]));   // EG-LOOK: its stages and its grit one kind (seen together, only while it shakes)
      st.chunks = crumbleSet.chunks.map((q, j) => place('chunk', `chunk:${j}`, () => q.model, { turns: true }));
      st.grit = place('crack', 'grit', () => buildGritModel());
    } else if (s.kind === 'drift') {
      // EG-PERFECT: its chains as long as the floor over it lets them hang (egHangReach) - its own model in the hall's kind
      const R = egHangReach(st.spec, s, band), full = R.len === SD_PENDULUM.len && R.over === EG_HANG_CABLE_M;
      st.len = R.len;
      st.pivot = realmToDungeon(st.spec.x0 + s.x, s.y + R.len, s.z);
      st.hang = place(`hang:${st.spec.h}`, full ? `hang:${st.spec.h}` : `hang:${st.spec.h}:${R.len}:${R.over}`, () => egHangModel(band, R.len, R.over), { turns: true });   // a kind a hall: a hall's swinging copies re-laid, never the circle's
    }
    for (const d of [...(st.stages ?? []), ...(st.chunks ?? []), st.grit, st.hang]) if (d) away(d);
  }
  /** EACH BEAT'S FRAME NOW (the Steps' - scenes/superDungeon/sdSteps.js beatLook), one picture map on its kind's draw: its dial's hand on
   *  the way back to XII across its solid time (SD_BEAT_FRAMES), dithering in over SD_BEAT_IN_S; over its last 0.4 s the
   *  place's own white in the palette's hazard, dissolving out a stage each SD_BEAT_OUT_STAGE_S, its light faltered for
   *  the last two (SD_BEAT_BLINK_HZ - once: shown, then out). With no pictures to hold it (no renderer), the Steps' own. */
  function beatFrames(t) {
    let W;
    for (const B of beatKinds.values()) {
      const u = egBeatAt(B.s, t), warned = u - (SD_BEAT_SOLID - SD_BEAT_BLINK), frame = Math.min(11, Math.floor(u / SD_BEAT_FRAME_S));
      let map = SD_BEAT_FRAMES[frame];
      if ((warned >= 0 && u < SD_BEAT_SOLID) || u < SD_BEAT_IN_S) {
        W ??= tellMaps();
        if (W && warned >= 0) map = W.warn[Math.min(SD_BEAT_DISSOLVE.keep.length - 1, Math.floor(warned / SD_BEAT_OUT_STAGE_S))];
        else if (W) map = W.back[2 - Math.floor((u / SD_BEAT_IN_S) * 3)];
      }
      if (map !== B.map) { B.map = map; kindRemap(beatKind(B.s), map); }
    }
  }
  /** A BEAT'S GHOST (the Steps'): while it is gone, its outline where it returns, its hand running back to the return,
   *  brightening over its last SD_GHOST.rise. */
  function beatLook(st, t, x, y, z, solid) {
    const u = egBeatAt(st.s, t);
    if (st.ghost < 0) return;
    const o = st.ghost * 4, left = SD_BEAT_CYCLE - u, kr = (SD_GHOST.rise - left) / SD_GHOST.rise, e = kr < 0 ? 0 : kr > 1 ? 1 : kr;
    ghostStep[o] = x; ghostStep[o + 1] = y; ghostStep[o + 2] = z;
    ghostState[o] = solid ? 0 : 1; ghostState[o + 1] = solid ? 0 : left / (SD_BEAT_CYCLE - SD_BEAT_SOLID); ghostState[o + 2] = SD_GHOST.base + (SD_GHOST.peak - SD_GHOST.base) * e * e * (3 - 2 * e); ghostState[o + 3] = 0;
  }
  /** MY CRUMBLE'S LOOK (the Steps'): its cracks' stage across the shake (the shake still under reduced motion), its grit
   *  pouring; then its chunks falling (drop, drift, tumble) out of sight past SD_CRUMBLE_SEEN while its ghost counts the
   *  return, and in the last SD_CHUNK.rewind flying back up the same way, eased out; whole again, a shudder. `since` the time
   *  since my foot (-1 none), `drop` the law's fall. Its ghost's top is lit while a peer stands on it fallen (peerOn). */
  function crumbleLook(st, t, x, y, z, since, solid, drop) {
    const shaking = solid && since >= 0, still = access.still, chunked = st.chunks.some(Boolean);
    let sx = 0, sz = 0;
    if (shaking && !still) { sx = SD_CRUMBLE_SHAKE * Math.sin(t * 71); sz = SD_CRUMBLE_SHAKE * Math.cos(t * 53); }
    else if (!shaking && since < 0 && t >= st.back && t - st.back < SD_CHUNK.shudder && !still) { const k = 1 - (t - st.back) / SD_CHUNK.shudder; sx = SD_CHUNK.settle * k * Math.sin(t * 83); sz = SD_CHUNK.settle * k * Math.cos(t * 61); }   // a shudder, and it is whole
    const n = shaking ? 1 + Math.min(2, Math.floor((since / st.wait) * 3)) : 0;   // EG-ZR: its stages across the wait my foot set (Featherstep's)
    if (st.draw && (solid || chunked)) { if (solid && n === 0) { translate(st.draw.object.matrix, x + sx, y, z + sz); st.draw.hidden = false; } else away(st.draw); }   // fallen, its chunks fall in its stead
    for (let k = 0; k < 3; k++) { const d = st.stages[k]; if (!d) continue; if (n === k + 1) { translate(d.object.matrix, x + sx, y, z + sz); d.hidden = false; } else away(d); }
    const g = st.grit;
    if (g) { if (shaking) { translate(g.object.matrix, x + sx, y - ((t * SD_GRIT.speed) % SD_GRIT.period), z + sz); g.hidden = false; } else away(g); }
    const f = solid ? -1 : since - st.wait, back = SD_CRUMBLE_BACK - SD_CHUNK.rewind;
    const r = f >= back ? 1 - (f - back) / SD_CHUNK.rewind : 0, tau = f >= back ? SD_CHUNK.rise * r * r : f, show = f >= back || (f >= 0 && drop < SD_CRUMBLE_SEEN);
    for (let j = 0; j < st.chunks.length; j++) { const d = st.chunks[j]; if (!d) continue; if (show) { sdChunkMatrix(d.object.matrix, chunkWays[j], tau, x, y, z); d.hidden = false; } else away(d); }
    if (st.ghost < 0) return;
    const o = st.ghost * 4, kr = (f - back) / SD_CHUNK.rewind, e = kr < 0 ? 0 : kr > 1 ? 1 : kr;
    ghostStep[o] = x; ghostStep[o + 1] = y; ghostStep[o + 2] = z;
    ghostState[o] = f >= 0 ? 1 : 0; ghostState[o + 1] = f >= 0 ? (SD_CRUMBLE_BACK - f) / SD_CRUMBLE_BACK : 0; ghostState[o + 2] = SD_GHOST.base + (SD_GHOST.peak - SD_GHOST.base) * e * e * (3 - 2 * e);
    ghostState[o + 3] = f >= 0 && t >= st.peerAt && t - st.peerAt <= EG_GHOST_SLAB.hold ? EG_GHOST_SLAB.fill : 0;   // A GHOST SLAB under a peer
  }
  /** A DRIFT'S HANG leaning with the law's own swing (`dx` the deck's offset - pendulumAngle, the Hour's turn about z),
   *  about its pivot SD_PENDULUM.len over the deck's rest. EG-PERFECT: a hang capped under a floor (egHangReach - `st.len`)
   *  leans by its own length, so its brackets stay beside the swung deck. */
  function hangLook(st, dx) {
    const m = st.hang.object.matrix, a = st.len < SD_PENDULUM.len ? Math.asin(Math.max(-1, Math.min(1, dx / st.len))) : pendulumAngle(dx), cs = Math.cos(a), sn = Math.sin(a), P = st.pivot;
    m.fill(0); m[0] = cs; m[1] = sn; m[4] = -sn; m[5] = cs; m[10] = 1; m[15] = 1; m[12] = P[0]; m[13] = P[1]; m[14] = P[2];
    st.hang.hidden = false;
  }
  /** The waystones (mine lit, the rest dark) and the Gust's banners (the vane's yaw on the breath's own clock -
   *  world/superDungeon/sdStepsModel.js vaneYawInto) where they stand now. */
  function poseMarks(t) {
    for (const g of stones) { const mine = g === litStone; if (g.lit) g.lit.hidden = !mine; if (g.dark) g.dark.hidden = mine; }
    if (!vanes.length) return;
    _vane[0] = t; vaneYawInto(_vane);
    for (const v of vanes) if (v.draw) { yawAbout(v.draw.object.matrix, _vane[1], v.at[0], v.at[1], v.at[2]); v.draw.hidden = false; }
  }
  /** The island whose waystone stands for my cast-back point `p` (the dungeon's frame), or null. */
  const stoneOf = (p) => {
    if (!p) return null;
    const [rx, ry, rz] = dungeonToRealm(p[0], p[1], p[2]);
    return stones.find((g) => Math.hypot(rx - g.spec.x0 - g.isl.x, rz - g.isl.z) <= g.isl.r + 0.5 && Math.abs(ry - g.isl.y) < 1.5) ?? null;
  };
  /** A piece of mesh kind `mk` stood: in the batch (its slot, the draw it replaces), or as its own draw - its model once a
   *  kind either way. Answers the slot or draw its pose writes, or null. */
  const place = (kind, mk, modelFn, { turns = false } = {}) => {   // EG-ZL: `turns` - a kind written through its slot's whole matrix
    // EG-LOOK: `kind` the batch's draw, `mk` the model's own key (a piece's own stone - many models a kind)
    if (!models.has(mk)) { const m = modelFn(); models.set(mk, m ? egBandDress(m, band) : null); }
    const model = models.get(mk);
    if (!model) return null;
    if (batch) {
      const slot = { object: { matrix: new Float32Array(16) }, hidden: false };
      return batch.add(kind, model, slot, { turns }) ? slot : null;
    }
    if (!meshes.has(mk)) meshes.set(mk, make(model));
    const gpu = meshes.get(mk);
    if (!gpu) return null;
    const d = { gpu, object: { matrix: new Float32Array(16) }, noShadow: true, texRemap: null };
    draws.push(d);
    if (!plainOf.has(kind)) plainOf.set(kind, []);
    plainOf.get(kind).push(d);   // EG-ZL: a kind's picture map, set on each of its own draws
    return d;
  };
  /** EG-ZL: kind `mk`'s picture map now - the batch's one draw of it, or each of its own. */
  const kindRemap = (mk, map) => { if (batch) batch.remap(mk, map); else for (const d of plainOf.get(mk) ?? []) d.texRemap = map; };
  /** EG-ZL: a slot or draw put away (a pose's zeros, hidden). */
  const away = (d) => { d.object.matrix.fill(0); d.hidden = true; };
  /** @type {any[]} */
  let targetList = [];
  /** FIELD BUGS 2026-10-20f (ORRERY-STONES): each Athenaeum's stones, stood by the span's own `place` */
  const orrery = createEgOrrery({ seed, specs, place });
  /** THE FALLING WALLS: each hall's walkway as segments, each its bucket, its draw and the moment it fell */
  const walls = [];
  for (const spec of specs) {
    if (spec.variant !== 'fallingwall' || !spec.walk) continue;
    const w = spec.walk, n = Math.max(1, Math.ceil((w.z1 - w.z0) / EG_WALL_SEG_M)), d = (w.z1 - w.z0) / n;
    for (let k = 0; k < n; k++) walls.push({ spec, k, z0: w.z0 + k * d, z1: w.z0 + (k + 1) * d, w: 2 * w.halfW, d, key: `eg:wall:${spec.h}:${k}`, T: [0, EG_STEP_GONE_Y, 0], draw: null, goneAt: null });
  }
  /** each hall's conveyor (a Forge Bridge's walkway) */
  const belts = specs.filter((q) => q.variant === 'forgebridge' && q.walk).map((q) => ({ spec: q, w: q.walk }));
  /** THE COLLAPSING TUBES (section 11.3): each tube's floor and vault as segments, each falling once the tube's fallen
   *  edge passes it */
  const tubes = [];
  for (const spec of specs) {
    const q = spec.tube;
    if (!q) continue;
    const n = Math.max(1, Math.ceil((q.z1 - q.z0) / EG_WALL_SEG_M)), d = (q.z1 - q.z0) / n;
    for (let k = 0; k < n; k++) tubes.push({ spec, k, z0: q.z0 + k * d, z1: q.z0 + (k + 1) * d, w: 2 * q.halfW, d, key: `eg:tube:${spec.h}:${k}`, T: [0, EG_STEP_GONE_Y, 0], draw: null, lid: null, goneAt: null });
  }
  /** A Collapsing Tube's fallen edge in hall `spec` at `t` (s): -Infinity before it begins, Infinity once its hall is past.
   *  EG-PERFECT (2026-10-18; Elite-Gates.md section 11.3): the relay's own law (net/eliteGates/egFair.js egTubeEdgeIn) - a routed hall's
   *  tube falls from the company's arrival at its mouth as the stage says it (`tm`), the laws before from the wake. */
  const tubeEdgeOf = (spec, t) => { const wk = spireWake(); return wk.h === spec.h && wk.hw > 0 ? egTubeEdgeIn(spec, wk.hw, wk.tm, t * 1000) : wk.h > spec.h ? Infinity : -Infinity; };
  /** GRATH'S ISLANDS (section 13.3): each its bucket and draw, its fall the relay's word */
  const isles = [];
  for (const spec of specs) for (const d of spec.discs) if (egIsleDisc(spec, d)) isles.push({ spec, d, key: `eg:isle:${spec.h}:${isles.length}`, T: [0, 0, 0], draw: null, st: 0, stAt: 0, drop: 0 });
  /** EG-ZC - THE COOLING SLAG (section 11.2): each slag crossing's spouts - each lane its crust (a bucket, stood while it
   *  holds) and its molten sheet (drawn while it pours) */
  const slags = [];
  for (const st of steps) if (st.s.kind === 'slag') for (let k = 0; k < EG_SLAG_SPOUTS; k++) slags.push({ st, s: st.s, spec: st.spec, k, key: `${st.key}:${k}`, T: [0, EG_STEP_GONE_Y, 0], crust: null, molten: null, state: 'gone' });
  /** EG-ZC (section 11.10): the Moon branches the Moon-Mirror lights now (the relay's havens over them) */
  const lit = new Set(), moons = steps.some((st) => st.s.kind === 'moon');
  /** AUDIT EG III - SPIREBRIDGES (section 15): the planks the room raised in this circle's hall standing now (systems/eliteGates/spireKit.js
   *  spireObjs `br` - each its gap, its raising and its end, relay ms), each its own draw and bucket from its word to its end -
   *  the relay's own plank (net/eliteGates/egSpanLaw.js egBridgeOf), its collider holding from its raising to its end, freed then */
  /** @type {Map<string, { key: string, spec: any, br: any, q: any, T: number[], at: number[], draw: any, gpu: any }>} */
  const planks = new Map();
  /** the collider the circle stood in (a plank stands in it after the stand) */
  let col = null;
  function standPlank(key, spec, q) {
    const br = egBridgeOf(spec, q.g);
    if (!br) return;
    const len = br.z1 - br.z0, dy = br.y1 - br.y0, at = realmToDungeon(spec.x0 + br.x, br.y0, br.z0);
    const P = { key, spec, br, q, T: [at[0], EG_STEP_GONE_Y, at[2]], at, draw: null, gpu: null };
    const model = egBridgeModel(len, br.w, dy), gpu = make(model);
    if (gpu && draws) { P.gpu = gpu; P.draw = { gpu, object: { matrix: identity() }, noShadow: true, texRemap: null, hidden: true }; draws.push(P.draw); }
    const { positions, indices } = egBridgeTris(len, br.w, dy);
    try { col?.addMesh?.(key, positions, indices, identity(), () => P.T); } catch (e) { console.warn('[eg] a Spirebridge\'s collider', e?.message ?? e); }
    planks.set(key, P);
  }
  function dropPlank(P) {
    planks.delete(P.key);
    if (P.draw && draws) { const i = draws.indexOf(P.draw); if (i >= 0) draws.splice(i, 1); }
    if (P.gpu) { try { renderer?.destroyMesh?.(P.gpu); } catch { /* gone */ } }
    try { col?.removeBucket?.(P.key); } catch { /* gone */ }
    P.draw = null; P.gpu = null;
  }
  /** The planks where the room has them at `t` (s): stood at their word, holding from their raising to their end, laid across
   *  over EG_SB_GROW_S and faltering their last second (both still under reduced motion), gone and freed at their end. */
  function posePlanks(t) {
    const O = spireObjs(), ms = t * 1000, want = new Set(), spec = specs.find((q) => q.h === O.h);
    if (spec) for (const q of O.br ?? []) {
      if (!(ms < q.until)) continue;
      const key = `eg:bridge:${O.h}:${q.g}:${q.from}`;
      want.add(key);
      if (!planks.has(key)) standPlank(key, spec, q);
    }
    for (const P of [...planks.values()]) {
      if (!want.has(P.key)) { dropPlank(P); continue; }
      const L = egBridgeLook(P.q, ms, access.still);
      P.T[1] = L.stand ? P.at[1] : EG_STEP_GONE_Y;
      if (P.draw) {
        const m = P.draw.object.matrix;
        if (L.seen) { translate(m, P.at[0], P.at[1], P.at[2]); m[10] = L.grow; } else m.fill(0);
        P.draw.hidden = !L.seen;
      }
    }
  }
  /** THE FALSE WALLS (section 11.10): one in each seam alcove's doorway, standing until the relay says it broken */
  const seals = [];
  for (const spec of specs) for (const nb of egNicheBoxes(spec)) if (nb.a.seal === 'seam') seals.push({ spec, a: nb.a, door: nb.door, side: nb.side, along: nb.along ?? null, key: `eg:seal:${spec.h}:${nb.a.i}`, T: [0, 0, 0], draw: null, up: true });   // AUDIT EG V: a hero alcove's wall's way (world/eliteGates/egHall.js egHeroDoor)
  /** A Falling Wall's fallen edge in hall `spec` at `t` (s): -Infinity until its hall wakes. */
  const fallenOf = (spec, t) => { const wk = spireWake(); return wk.h === spec.h && wk.hw > 0 ? egWallFallenZ(spec, wk.hw, t * 1000) : wk.h > spec.h ? Infinity : -Infinity; };
  function poseWalls(t) {
    for (const g of walls) {
      const edge = fallenOf(g.spec, t), gone = g.z1 <= edge;
      if (gone && g.goneAt == null) g.goneAt = t;
      if (!gone) g.goneAt = null;
      const [x, y, z] = realmToDungeon(g.spec.x0 + g.spec.walk.x, 0, (g.z0 + g.z1) / 2);
      g.T[0] = x; g.T[2] = z; g.T[1] = gone ? EG_STEP_GONE_Y : y;
      if (g.draw) {
        const drop = gone ? 0.5 * WALL_FALL_G * (t - g.goneAt) ** 2 : 0, seen = drop < 30;
        if (seen) translate(g.draw.object.matrix, x, y - drop, z); else g.draw.object.matrix.fill(0);
        g.draw.hidden = !seen;
      }
    }
  }
  const translate = (m, x, y, z) => { m.fill(0); m[0] = m[5] = m[10] = m[15] = 1; m[12] = x; m[13] = y; m[14] = z; return m; };
  function poseTubes(t) {
    for (const g of tubes) {
      const edge = tubeEdgeOf(g.spec, t), gone = g.z1 <= edge;
      if (gone && g.goneAt == null) g.goneAt = t;
      if (!gone) g.goneAt = null;
      const [x, y, z] = realmToDungeon(g.spec.x0 + g.spec.tube.x, g.spec.tube.y, (g.z0 + g.z1) / 2);
      g.T[0] = x; g.T[2] = z; g.T[1] = gone ? EG_STEP_GONE_Y : y;
      const drop = gone ? 0.5 * WALL_FALL_G * (t - g.goneAt) ** 2 : 0, seen = drop < 30;
      for (const dr of [g.draw, g.lid]) { if (!dr) continue; if (seen) translate(dr.object.matrix, x, y - drop, z); else dr.object.matrix.fill(0); dr.hidden = !seen; }
    }
  }
  /** The islands where the relay has them: whole, shaking while cracked (told 3.7 s), sunk while fallen, risen again. */
  function poseIsles(t) {
    if (!isles.length) return;
    const O = spireObjs(), objs = O.objs.filter((o) => o.t === 'isle');
    for (const g of isles) {
      const o = O.h === g.spec.h ? objs.find((q) => Math.hypot(q.x - g.d.x, q.z - g.d.z) < 1.5) : null;
      g.st = o?.st ?? 0; g.stAt = o?.stAt ?? 0;
      const since = Math.max(0, t * 1000 - g.stAt) / 1000;
      g.drop = g.st === 2 ? Math.min(40, 0.5 * WALL_FALL_G * since * since) : 0;
      const shake = g.st === 1 && !access.still ? 0.06 * Math.sin(t * 60) : 0;   // EG-ZL: still under reduced motion
      g.T[0] = 0; g.T[1] = g.st === 2 ? EG_STEP_GONE_Y : 0; g.T[2] = 0;   // the shake is the eye's alone - the ground holds still under a crack
      if (g.draw) { const seen = g.drop < 39; if (seen) translate(g.draw.object.matrix, shake, -g.drop, 0); else g.draw.object.matrix.fill(0); g.draw.hidden = !seen; }
    }
  }
  /** The false walls: standing while the relay keeps a false wall at their alcove, sunk once it falls. */
  function poseSeals() {
    if (!seals.length) return;
    const O = spireObjs();
    for (const g of seals) {
      const up = O.h !== g.spec.h ? O.h < g.spec.h : O.objs.some((o) => o.t === 'fwall' && o.pt === g.a.i);
      g.up = up;
      g.T[1] = up ? 0 : EG_STEP_GONE_Y;
      if (g.draw) { if (up) translate(g.draw.object.matrix, 0, 0, 0); else g.draw.object.matrix.fill(0); g.draw.hidden = !up; }
    }
  }

  /** EG-ZC: the slag's lanes where the law has them at `t` - a crust stood (shaking its last EG_SLAG_WARN_S, the eye's
   *  alone), a spill's molten sheet drawn, neither while its lane is told or gone. */
  function poseSlags(t) {
    for (const g of slags) {
      const S = egSlagState(g.s, g.k, t);
      g.state = S.st;
      const [x, y, z] = realmToDungeon(g.spec.x0 + egSlagX(g.s, g.k), g.s.y, g.s.z);
      const crust = S.st === 'crust', shake = crust && !access.still && (1 - S.k) * EG_SLAG_CRUST_S < EG_SLAG_WARN_S ? 0.05 * Math.sin(t * 60) : 0;   // EG-ZL: still under reduced motion
      g.T[0] = x; g.T[2] = z; g.T[1] = crust ? y : EG_STEP_GONE_Y;
      for (const [dr, on, dx] of /** @type {[any, boolean, number][]} */ ([[g.crust, crust, shake], [g.molten, S.st === 'molten', 0]])) {
        if (!dr) continue;
        if (on) translate(dr.object.matrix, x + dx, y, z); else dr.object.matrix.fill(0);
        dr.hidden = !on;
      }
    }
  }
  /** EG-ZC: the Moon branches lit now - each under a live haven the Moon-Mirror laid in its hall. */
  function poseLit(t) {
    lit.clear();
    if (!moons) return;
    const O = spireObjs(), ms = t * 1000, on = (O.lit ?? []).filter((q) => ms >= q.from && ms < q.until);
    if (on.length) for (const st of steps) if (st.s.kind === 'moon' && st.spec.h === O.h && on.some((q) => egInShape(q.s, st.s.x, st.s.z))) lit.add(st);
  }

  /** A step stood where the law has it at `t`: its bucket's place (sunk while it is gone) and its draw's. */
  function pose(st, t) {
    const s = st.s;
    st.was[0] = st.T[0]; st.was[1] = st.T[1]; st.was[2] = st.T[2];
    st.wasSolid = st.solid;
    const at = egPieceAt(s, t, _at);   // a Drift across, a Rail along, a Beat on its beat (net/eliteGates/egSpanLaw.js - the one law)
    const [x, y, z] = realmToDungeon(st.spec.x0 + s.x + at.dx, s.y, s.z + at.dz);
    let solid = at.solid || lit.has(st), drop = 0;   // EG-ZC: a branch the Moon-Mirror lit stands while lit
    let mine = -1;   // EG-ZL: how long since my foot stood on this Crumble (-1 none)
    if (EG_CRUMBLE_KINDS.includes(s.kind) && st.touched != null) {
      const since = t - st.touched, wait = st.wait;   // EG-ZR: the wait my foot set (Featherstep's longer)
      if (since >= wait + SD_CRUMBLE_BACK && since < wait + SD_CRUMBLE_BACK + 1) { st.back = st.touched + wait + SD_CRUMBLE_BACK; play3(SD_STEPS_SOUNDS.clack, [x, y, z], 0.7, 2.6); }   // EG-ZL: back - its chunks click home
      if (since < 0 || since >= wait + SD_CRUMBLE_BACK) st.touched = null;
      else { mine = since; if (since >= wait) { const f = since - wait; drop = 0.5 * SD_CRUMBLE_FALL_G * f * f; solid = false; } }
    }
    // a flight of the Sinking Stair: under my foot it sinks at EG_SINK_MPS (it carries me down), gone EG_SINK_GONE_M down,
    // and back after the Crumble's return
    let sunk = 0;
    if (s.kind === 'sink' && st.touched != null) {
      const since = t - st.touched, goneAt = EG_SINK_GONE_M / EG_SINK_MPS;
      if (since < 0 || since >= goneAt + SD_CRUMBLE_BACK) st.touched = null;
      else if (since >= goneAt) { solid = false; drop = 40; }
      else sunk = EG_SINK_MPS * since;
    }
    st.solid = solid;
    st.T[0] = x; st.T[2] = z; st.T[1] = solid ? y - sunk : EG_STEP_GONE_Y;
    if (st.draw) {
      const seen = s.kind === 'beat' || s.kind === 'moon' ? solid : drop < 30;
      if (seen) translate(st.draw.object.matrix, x, y - drop - sunk, z); else st.draw.object.matrix.fill(0);
      st.draw.hidden = !seen;
    }
    if (st.pend) { const w = egPendAt(s, t); const [px, py, pz] = realmToDungeon(st.spec.x0 + w.x, s.y, w.z); translate(st.pend.object.matrix, px, py, pz); }
    // EG-ZL: the tells (section 10.3)
    if (s.kind === 'beat') beatLook(st, t, x, y, z, solid);
    else if (st.stages) crumbleLook(st, t, x, y, z, mine, solid, drop);
    else if (st.hang) hangLook(st, at.dx);
  }

  /** A cast-back's landing kept off a fallen walkway: on a Falling Wall, the nearest standing segment ahead of its fallen
   *  edge (section 8.3 - "cast to the nearest standing segment ahead"). */
  function wallSafe(p, t) {
    const [rx, , rz] = dungeonToRealm(p[0], p[1], p[2]);
    // a Collapsing Tube: a landing behind its fallen edge is cast forward to the nearest standing segment ahead
    const ts = specs.find((q) => q.tube && Math.abs(rx - q.x0 - q.tube.x) <= 40 && rz <= q.tube.z1 + 1 && rz >= -10);
    if (ts) {
      const edge = tubeEdgeOf(ts, t);
      if (Number.isFinite(edge) && rz <= edge + 0.5) { const ahead = tubes.find((g) => g.spec === ts && g.z0 >= edge); if (ahead) return realmToDungeon(ts.x0 + ts.tube.x, ts.tube.y, (ahead.z0 + ahead.z1) / 2); }
    }
    // Grath's islands: a landing on a cracked or fallen one is cast onto the nearest standing one
    const lost = isles.find((g) => g.st !== 0 && Math.hypot(rx - g.spec.x0 - g.d.x, rz - g.d.z) <= g.d.r + 0.5);
    if (lost) {
      let best = null, bd = Infinity;
      for (const g of isles) if (g.spec === lost.spec && g.st === 0) { const dd = Math.hypot(rx - g.spec.x0 - g.d.x, rz - g.d.z); if (dd < bd) { bd = dd; best = g; } }
      if (best) return realmToDungeon(best.spec.x0 + best.d.x, best.d.y, best.d.z);
    }
    const spec = specs.find((q) => q.variant === 'fallingwall' && q.walk && Math.abs(rx - q.x0 - q.walk.x) <= q.walk.halfW + 1 && rz >= q.walk.z0 - 1 && rz <= q.walk.z1 + 1);
    if (!spec) return p;
    const edge = fallenOf(spec, t);
    if (rz > edge + 0.5) return p;
    const ahead = walls.find((g) => g.spec === spec && g.z1 > edge && g.z0 >= edge);
    return ahead ? realmToDungeon(spec.x0 + spec.walk.x, 0, (ahead.z0 + ahead.z1) / 2) : p;
  }
  return {
    /** Stand every step into the dungeon's draws and collider - once. */
    stand({ dynamicDraws, collider = null }) {
      if (draws) return false;
      draws = dynamicDraws;
      col = collider;   // AUDIT EG III: a Spirebridge stands in it after the stand
      ensureSdStepsArt(renderer);
      if (steps.some((st) => EG_CRUMBLE_KINDS.includes(st.s.kind))) egPieceTellUp(renderer, band, { crumble: true });   // EG-LOOK: a Crumble's stages in the band's flags
      // EG-G2 (section 11.9): with a renderer that moves a mesh's vertices, every piece of a kind is one batched draw
      // (scenes/eliteGates/egPieceBatch.js - the slot each pose writes is the draw it replaced); without one, a draw a piece as before
      batch = renderer?.createMesh && renderer?.updateMeshVertices ? createEgPieceBatch({ renderer }) : null;
      for (const st of steps) {
        if (st.s.kind === 'slag') continue;   // EG-ZC: a slag crossing stands as its spouts' lanes (below)
        // EG-LOOK: each piece its own stone (a Crumble's rest the band's one), batched with the ones that move as it does
        st.draw = EG_CRUMBLE_KINDS.includes(st.s.kind) ? place('slab', 'crumble', () => crumbleSet.rest) : place(kindOf(st.s), `piece:${st.key}`, () => modelOf(st));
        if (st.s.kind === 'pend') st.pend = place('mover', 'pend', () => egPendModel());
        standTells(st);   // EG-ZL: its tells
        const { positions, indices } = trisOf(st.s);
        try { collider?.addMesh?.(st.key, positions, indices, identity(), () => st.T); } catch (e) { console.warn('[eg] a step\'s collider', e?.message ?? e); }
      }
      for (const g of slags) {
        g.crust = place('mover', `slagc:${g.s.w}x${g.s.d}`, () => egSlagCrustModel(g.s.w, g.s.d));   // EG-LOOK: on the clock, with the movers
        g.molten = place('mover', `slagm:${g.s.w}x${g.s.d}`, () => egSlagMoltenModel(g.s.w, g.s.d));
        const { positions, indices } = egSlabTris(g.s.w, g.s.d);
        try { collider?.addMesh?.(g.key, positions, indices, identity(), () => g.T); } catch (e) { console.warn('[eg] a slag crust\'s collider', e?.message ?? e); }
      }
      for (const g of tubes) {
        // EG-LOOK: each segment its own stone, the vault over it the band's coffers - one kind, the tube's (it falls apart)
        g.draw = place('tube', `tube:${g.key}`, () => egPieceModel(band, egSegmentPlan('tube', g.w, g.d, { seed: egPieceSeed(seed, c, g.spec.h, 1000 + g.k), lite })));
        g.lid = place('tube', `lid:${g.w}x${g.d}:${g.spec.h}`, () => egTubeLidModel(band, g.w, g.d, (g.spec.caves.find((q) => q.z0 <= g.z0 && q.z1 >= g.z1)?.height ?? 5.2)));
        const { positions, indices } = egSlabTris(g.w, g.d);
        try { collider?.addMesh?.(g.key, positions, indices, identity(), () => g.T); } catch (e) { console.warn('[eg] a tube segment\'s collider', e?.message ?? e); }
      }
      for (const g of isles) {
        // EG-LOOK: the court's plates on the band's cornice (world/eliteGates/egPlatformModel.js egIsleModel - no gear teeth), laid where
        // it stands (the shake and the fall move its draw as before)
        const model = egIsleModel(band, g.d.r, { lite }), P = realmToDungeon(g.spec.x0 + g.d.x, g.d.y, g.d.z);
        for (let k = 0; k < model.positions.length; k += 3) { model.positions[k] += P[0]; model.positions[k + 1] += P[1]; model.positions[k + 2] += P[2]; }
        const gpu = make(model);
        if (gpu) { meshes.set(g.key, gpu); g.draw = { gpu, object: { matrix: identity() }, noShadow: true, texRemap: null, sphere: meshKitBounds(model.positions) }; draws.push(g.draw); }
        const tris = [];
        for (let k = 0; k < SD_ISLAND_SIDES; k++) {
          const a0 = (k / SD_ISLAND_SIDES) * Math.PI * 2, a1 = ((k + 1) / SD_ISLAND_SIDES) * Math.PI * 2;
          tris.push(...realmToDungeon(g.spec.x0 + g.d.x, g.d.y, g.d.z), ...realmToDungeon(g.spec.x0 + g.d.x + Math.cos(a1) * g.d.r, g.d.y, g.d.z + Math.sin(a1) * g.d.r), ...realmToDungeon(g.spec.x0 + g.d.x + Math.cos(a0) * g.d.r, g.d.y, g.d.z + Math.sin(a0) * g.d.r));
        }
        const positions = new Float32Array(tris), indices = new Uint16Array(positions.length / 3);
        for (let k = 0; k < indices.length; k++) indices[k] = k;
        try { collider?.addMesh?.(g.key, positions, indices, identity(), () => g.T); } catch (e) { console.warn('[eg] an island\'s collider', e?.message ?? e); }
      }
      for (const g of seals) {
        const { model, tris } = sealParts(g.door, g.side, g.a.y + 0, g.along);
        const gpu = make(model);
        if (gpu) { meshes.set(g.key, gpu); g.draw = { gpu, object: { matrix: identity() }, noShadow: true, texRemap: null, sphere: meshKitBounds(model.positions) }; draws.push(g.draw); }
        const indices = new Uint16Array(tris.length / 3);
        for (let k = 0; k < indices.length; k++) indices[k] = k;
        try { collider?.addMesh?.(g.key, tris, indices, identity(), () => g.T); } catch (e) { console.warn('[eg] a false wall\'s collider', e?.message ?? e); }
      }
      // the hands this circle offers the activation ray: each Athenaeum's Orrery stones, each engine. FIELD BUGS 2026-10-20f
      // (ORRERY-STONES): a stone stands as the Hour's, on its own floor (ORRERY-HEIGHT's law), and its two levers are its
      // handles (scenes/eliteGates/egOrrery.js) - they were boxes in the air beside a gold disc, with nothing drawn there
      const list = [...orrery.stand({ renderer, collider })];
      for (const spec of specs) {
        for (const e of spec.engines ?? []) { const c = realmToDungeon(spec.x0 + e.x, e.y + 1.0, e.z); list.push({ key: `egengine:${spec.h}:${e.i}`, aabb: { min: [c[0] - 0.6, c[1] - 1.0, c[2] - 0.6], max: [c[0] + 0.6, c[1] + 1.0, c[2] + 0.6] }, distance: RAY_DISTANCE, reach: DEFAULT_ACTIVATION_DISTANCE }); }
      }
      targetList = list;
      for (const g of walls) {
        g.draw = place('wall', `wall:${g.key}`, () => egPieceModel(band, egSegmentPlan('wall', g.w, g.d, { seed: egPieceSeed(seed, c, g.spec.h, 2000 + g.k), lite })));   // EG-LOOK: the walk's tesserae, its own stone a segment
        const { positions, indices } = egSlabTris(g.w, g.d);
        try { collider?.addMesh?.(g.key, positions, indices, identity(), () => g.T); } catch (e) { console.warn('[eg] a wall segment\'s collider', e?.message ?? e); }
      }
      // EG-ZL: every island's waystone (lit and dark) and every Gust island's banner; the crack stages' and the dark stone's
      // pictures; the Beat's warning in the palette standing now, painted while the circle stands, not at its first warning
      for (const g of stones) {
        g.lit = place('stone', 'stone', () => buildWaystoneModel()); g.dark = place('stone', 'stone:dark', () => darkStone());   // EG-LOOK: one kind, the dark its own record
        for (const d of [g.lit, g.dark]) if (d) { translate(d.object.matrix, g.at[0], g.at[1], g.at[2]); d.hidden = true; }
      }
      for (const v of vanes) { v.draw = place('vane', 'vane', () => buildVaneModel(null), { turns: true }); if (v.draw) yawAbout(v.draw.object.matrix, 0, v.at[0], v.at[1], v.at[2]); }
      access = egAccessNow();
      if (beatKinds.size) tellMaps();
      batch?.build(draws);
      return true;
    },
    /**
     * EG-G2 - THE CULL (section 11.9), this frame, before the dungeon's draws (scenes/worldModes.js): the batched pieces'
     * copies against the frustum (`proj` x `view`), and each island's and false wall's own draw `culled` outside it. Every
     * one is `noShadow`, so no shadow record moves with it. Answers how many batched kinds draw.
     */
    cull(proj, view) {
      if (!draws) return 0;
      let planes = null;
      if (proj && view) { mul4(_vp, proj, view); planes = spherePlanes(_vp, _planes); }
      for (const list of [isles, seals]) for (const g of list) {   // AUDIT EG III (lane4 #10): the two lists walked, never joined a frame
        const d = g.draw;
        if (!d?.sphere) continue;
        const M = d.object.matrix, c = d.sphere.centre;
        d.culled = !!planes && !sphereInPlanes(planes, c[0] + M[12], c[1] + M[13], c[2] + M[14], d.sphere.r + EG_BATCH_CULL_PAD);
      }
      return batch ? batch.cull(planes) : 0;
    },
    /** The batch's measure (tests, the budget): kinds, copies, what the last cull drew; null with no batch. */
    batchStats: () => batch?.stats() ?? null,
    /**
     * One frame, BEFORE the motor: `t` the realm's anchored seconds, `body` the motor, `live` whether it runs this frame.
     * Answers the landing of a cast-back (the dungeon's frame) - the last floor or solid step my feet stood on - or null.
     * @returns {number[] | null}
     */
    ride(t, dt, body = null, live = true) {
      if (!draws) return null;
      const key = body?.grounded && typeof body.groundKey === 'string' ? body.groundKey : null;
      const on = key ? byKey.get(key) ?? null : null;
      if (on && live && (EG_CRUMBLE_KINDS.includes(on.s.kind) || on.s.kind === 'sink') && on.touched == null) { on.touched = t; on.wait = SD_CRUMBLE_DELAY + spireCrumbleWait(); if (on.s.kind !== 'sink') play3(SD_STEPS_SOUNDS.grind, [on.T[0], on.T[1], on.T[2]], 1, 1.3); }   // EG-ZL: a Crumble grinds under my foot (the Steps')
      lastT = t; access = egAccessNow();   // EG-ZL: the frame's clock and the screen's settings (the danger palette, reduced motion)
      if (live && body?.pos) aimGhosts(dungeonToRealm(body.pos[0], body.pos[1], body.pos[2])[0]);   // EG-PERFECT's audit: the ghosts of the halls I am among
      poseLit(t);
      posePlanks(t);   // AUDIT EG III: the Spirebridges the room raised
      for (const st of steps) pose(st, t);
      beatFrames(t);   // EG-ZL: each beat's frame
      poseMarks(t);
      orrery.frame(dt);   // ORRERY-STONES: each Athenaeum's hands toward the hours the room said
      poseSlags(t);
      poseWalls(t);
      poseTubes(t);
      poseIsles(t);
      poseSeals();
      if (on && on.solid && on.wasSolid) {
        const dx = on.T[0] - on.was[0], dy = on.T[1] - on.was[1], dz = on.T[2] - on.was[2];
        if (dx || dy || dz) body.carryBy?.(dx, dy, dz);
      }
      overDrop = false;
      if (!live || !body?.pos) return null;
      const [rx, ry, rz] = dungeonToRealm(body.pos[0], body.pos[1], body.pos[2]);
      const voided = intoVoid(rx, ry, rz, !!body.grounded);   // EG-PERFECT: judged before this frame's ground becomes the cast-back's place
      if (!body.grounded) { const hs = specs.find((q) => Math.abs(rx - q.x0) <= ((q.law ?? 0) >= 9 ? 160 : 40)); overDrop = !!hs && egOverDrop(hs, rx - hs.x0, ry, rz); }   // EG-ZG (section 25.8); THE ASCENT (spec law 9): a hall's ground its whole bound (160 m), never its line's 40
      const footing = spireFooting();
      // THE GUST (section 10.3): the Steps' breath over a Gust section of the hall I stand in, Iron Footing taking its share
      if (dt > 0 && footing < 1) {
        const g = gusts.find((q) => Math.abs(rx - q.spec.x0 - q.x) <= EG_GUST_REACH_M && rz >= q.z0 && rz <= q.z1 && egGustStorey(q, ry));
        if (g) { gustAt(t, _gust); if (_gust.push) body.collider?.move?.(body.pos, _gust.push * (1 - footing) * Math.min(dt, EG_GUST_DT_MAX), 0, 0, body.height, !!body.grounded && !body.jumping); }
      }
      // EG-ZL - THE GUST'S WIND (section 10.3: "the wind rising (AmbientWindMoanDeep)"): a second before each gust over a Gust
      // section I stand in (its islands too), once a gust, with its banners' clack - the Steps' own two sounds
      const heard = gusts.find((q) => Math.abs(rx - q.spec.x0 - ((q.spec.law ?? 0) >= 9 ? q.x : 0)) <= 40 && rz >= q.h0 && rz <= q.h1);   // THE ASCENT (spec law 9): about the section's own line, wherever its course stands
      if (heard && gustAt(t, _gust).warn && lastWarned !== Math.floor(t / SD_GUST_EVERY)) { lastWarned = Math.floor(t / SD_GUST_EVERY); play(SD_STEPS_SOUNDS.moan, 0.9); play(SD_STEPS_SOUNDS.clack, 0.45, 2.2); }
      // THE FORGE BRIDGE (section 8.3): its walkway runs toward the arrival plate, carrying whoever stands on it
      if (dt > 0 && key === EG_FLOOR_KEY && body.grounded) {
        const bt = belts.find((q) => Math.abs(rx - q.spec.x0 - q.w.x) <= q.w.halfW && rz >= q.w.z0 && rz <= q.w.z1);
        if (bt) body.collider?.move?.(body.pos, 0, 0, -EG_BELT_MPS * Math.min(dt, EG_GUST_DT_MAX), body.height, true);
      }
      // THE PENDULUM (section 10.3): a touch of its weight is a cast-back - Iron Footing III stands it
      if (footing < 1) {
        for (const st of steps) {
          if (st.s.kind !== 'pend' || Math.abs(rx - st.spec.x0 - st.s.x) > 6) continue;
          if (egPendHits(st.s, t, rx - st.spec.x0, ry, rz, body.height) && safe) { play(107, 0.7, 0.8); return [safe[0], safe[1] + 0.2, safe[2]]; }   // EG-PERFECT: my body's height against the weight's drawn
        }
      }
      // EG-PERFECT - THE VOID ZONES (Elite-Gates-Ascent.md section 2): a fall into one is a fall into the void - cast back to the
      // last floor I stood on, at the void's cost (section 8), before the floor it landed on further along can become that place
      if (voided && safe) { play(107, 0.6, 0.6); const p = wallSafe(safe, t); return [p[0], p[1] + 0.2, p[2]]; }
      // the cast-back's place: the last floor I stood on (a plate, an island, a court, a bridge), or a still step
      const onWall = key ? walls.find((g) => g.key === key) ?? tubes.find((g) => g.key === key) ?? isles.find((g) => g.key === key && g.st === 0) : null;
      if (key === EG_FLOOR_KEY || onWall || (on && on.solid && (on.s.kind === 'still' || on.s.kind === 'ledge' || on.s.kind === 'drop' || on.s.kind === 'vent' || on.s.kind === 'gust'))) { safe = [body.pos[0], body.pos[1], body.pos[2]]; safeY = body.pos[1]; litStone = stoneOf(safe); }   // EG-ZL: and its waystone lit
      if (safe && body.pos[1] < safeY + EG_VOID_Y) { play(107, 0.6, 0.6); const p = wallSafe(safe, t); return [p[0], p[1] + 0.2, p[2]]; }
      return null;
    },
    /** Where the void would cast me back to now (the dungeon's frame), or null - and set it (a pull's landing). */
    safe: () => safe,
    /** EG-ZG (section 25.8): am I falling onto a Drop the course asked for (this frame, before the motor)? Its landing is the
     *  fight's thud and dust - the dungeon arm plays no hard-landing grunt for it. */
    overDrop: () => overDrop,
    setSafe(p) { safe = p ? [p[0], p[1], p[2]] : null; safeY = p ? p[1] : 0; litStone = stoneOf(safe); voidHas = false; voidFall.v = null; voidFromY = NaN; },   // EG-PERFECT: a place given is no fall
    /**
     * EG-ZL - A GHOST SLAB (section 10.8: "a peer on a crumble the viewer has seen fall is drawn on a ghost slab"): a peer's
     * drawn feet (x, y, z) (the dungeon's frame - the breach client's word off net/online.js `rideAt`) standing on a Crumble of this
     * circle that has fallen under my own foot - its ghost's top lit under them for EG_GHOST_SLAB.hold. Answers whether it
     * held one.
     */
    peerOn(x, y, z) {
      if (!draws || !Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) return false;
      const [rx, ry, rz] = dungeonToRealm(x, y, z);
      for (const st of ghostSteps) {
        if (!EG_CRUMBLE_KINDS.includes(st.s.kind) || st.solid || st.touched == null) continue;
        const s = st.s, dy = ry - s.y;
        if (Math.abs(rx - st.spec.x0 - s.x) <= s.w / 2 + EG_BODY_R && Math.abs(rz - s.z) <= s.d / 2 + EG_BODY_R && dy >= -EG_RIDE_DOWN_M && dy <= EG_RIDE_UP_M) { st.peerAt = lastT; return true; }
      }
      return false;
    },
    /**
     * EG-ZL - THE GHOSTS (render/superDungeon/sdStepsPass.js - built the first time, its program and buffer freed at the clear): the
     * circle's gone Beats and my fallen Crumbles outlined where they return, a peer's ghost slab filled, in `fog` and the
     * Spire's fog floor (world/eliteGates/egLook.js EG_FOG_FLOOR - section 25.6). Answers whether it drew (the host marks a foreign pass).
     */
    drawPass(proj, view, fog = null) {
      if (!draws || !renderer?.gl || !ghostSteps.length) return false;
      pass ??= passOf?.(true) ?? null;
      if (!pass) return false;
      const vp = renderer._worldViewportPx;   // the world image (px) - read, never copied
      return pass.draw(proj, view, ghostStep, ghostState, fog, renderer.lightingLane ? SD_SKY_STEPS.lane : SD_SKY_STEPS.classic, vp?.[2] ?? 0, vp?.[3] ?? 0, egGhostRgb(access?.palette));   // AUDIT EG III (lane4 #5): in the palette's safety
    },
    /** EG-ZL: the ghosts as the pass reads them (tests) - each slot's top and state, and the step each stands for. */
    get ghosts() { return { step: ghostStep, state: ghostState, of: ghostSteps.map((st) => ({ h: st.spec.h, i: st.s.i, kind: st.s.kind })) }; },
    /** EG-ZL: every step's tells' slots as they stand (tests) - its plate, its crack stages, chunks and grit, its hang -
     *  each its matrix and whether hidden, as its pose wrote them. */
    get slots() { return steps.map((st) => ({ h: st.spec.h, i: st.s.i, kind: st.s.kind, draw: st.draw, stages: st.stages, chunks: st.chunks, grit: st.grit, hang: st.hang, pivot: st.pivot })); },
    /** EG-ZL: the marks as they stand (tests) - each beat's picture map, the waystones (lit or dark) and the banners. */
    /** ORRERY-STONES: each Athenaeum's stones as they stand (tests) - scenes/eliteGates/egOrrery.js's. */
    get orrery() { return orrery.stones; },
    get marks() { return { beats: [...beatKinds.entries()].map(([k, B]) => ({ kind: k, map: B.map ?? null })), stones: stones.map((g) => ({ h: g.spec.h, x: g.isl.x, z: g.isl.z, lit: g.lit, dark: g.dark })), litStone: litStone ? { h: litStone.spec.h, x: litStone.isl.x, z: litStone.isl.z } : null, vanes: vanes.map((v) => v.draw) }; },
    /** The hands this circle offers the activation ray (an Orrery stone's levers, an engine) - after the stand. */
    targets: () => (draws ? targetList : []),
    /** A press on one of them: the breach client's (systems/eliteGates/spireKit.js spireAct - it sends the turn or the work). */
    press(key) { return typeof key === 'string' && (key.startsWith('egstone:') || key.startsWith('egengine:')) ? (spireAct(key), true) : false; },
    /** A target's words. */
    hoverName(key) {
      if (typeof key !== 'string') return null;
      const st = /^egstone:\d+:(\d):([fb])$/.exec(key);
      // FIELD BUGS 2026-10-17e (ORRERY-SIGHT): the stone named as the riddles name it, with its sign (the Hour's plaque -
      // scenes/superDungeon/sdHall.js hoverName), and the hour its hand stands at as the room last said it (`orr`, the breach
      // client's objs) - it said "Orrery stone 3" and no hour
      if (st) { const j = Number(st[1]), h = spireObjs().orr?.[j]; return { title: `${spireStoneName(j)} - ${SD_STONES[j]?.sign ?? ''}`, subs: [...(Number.isFinite(h) ? [SD_HALL_TEXT.hour(h)] : []), st[2] === 'f' ? 'Turn it forward an hour' : 'Turn it back an hour'] }; }
      const en = /^egengine:(\d+):(\d+)$/.exec(key);
      if (en) { const spec = specs.find((q) => q.h === Number(en[1])), e = spec?.engines?.[Number(en[2])], E = e ? EG_ENGINES[e.kind] : null; if (E) return { title: E.name.charAt(0).toUpperCase() + E.name.slice(1), subs: [E.what, E.once ? 'Work it' : 'Work it once every 30 seconds'] }; }   // AUDIT EG III: the Shelf topples once
      return null;
    },
    /** Every Collapsing Tube segment and every island as they stand (tests). */
    get tubes() { return tubes.map((g) => ({ h: g.spec.h, k: g.k, z0: g.z0, z1: g.z1, key: g.key, gone: g.T[1] === EG_STEP_GONE_Y })); },
    get isles() { return isles.map((g) => ({ h: g.spec.h, x: g.d.x, z: g.d.z, key: g.key, st: g.st, gone: g.T[1] === EG_STEP_GONE_Y })); },
    get seals() { return seals.map((g) => ({ h: g.spec.h, i: g.a.i, key: g.key, up: g.up })); },
    /** Every step as it stands (tests). */
    get steps() { return steps.map((st) => ({ h: st.spec.h, i: st.s.i, kind: st.s.kind, key: st.key, T: [...st.T], solid: st.solid })); },
    /** EG-ZC: every slag lane as it stands (tests): its hall, its step, its spout, its state, whether its crust is up. */
    get slags() { return slags.map((g) => ({ h: g.spec.h, i: g.s.i, k: g.k, key: g.key, state: g.state, up: g.T[1] !== EG_STEP_GONE_Y, T: [...g.T] })); },
    /** AUDIT EG III: the Spirebridges standing (tests): each one's bucket, its plank, whether it holds and whether it draws. */
    get planks() { return [...planks.values()].map((P) => ({ key: P.key, g: P.q.g, br: P.br, T: [...P.T], holds: P.T[1] !== EG_STEP_GONE_Y, drawn: !!P.draw && !P.draw.hidden, grow: P.draw?.object.matrix[10] ?? 0 })); },
    /** EG-ZC: the Moon branches lit now (tests): their hall and number. */
    get lit() { return [...lit].map((st) => ({ h: st.spec.h, i: st.s.i })); },
    /** Every Falling Wall segment as it stands (tests). */
    get walls() { return walls.map((g) => ({ h: g.spec.h, k: g.k, z0: g.z0, z1: g.z1, key: g.key, T: [...g.T], gone: g.T[1] === EG_STEP_GONE_Y })); },
    /** Gone with the level: every mesh freed. */
    clear() {
      for (const m of meshes.values()) if (m) { try { renderer?.destroyMesh?.(m); } catch { /* gone */ } }
      meshes.clear();
      batch?.clear(); batch = null;   // EG-G2: the batched kinds' meshes
      models.clear();
      // EG-ZL: the ghosts' pass and every tell's slot (the Beat's pictures are the breach's, freed at its end - egBeatTellDown)
      try { pass?.destroy(); } catch { /* gone */ }
      pass = null; passOf = ghostsDoor();
      plainOf.clear(); beatKinds.clear();
      ghostState.fill(0);
      for (const g of stones) { g.lit = null; g.dark = null; }
      for (const v of vanes) v.draw = null;
      orrery.clear();   // ORRERY-STONES: its parts' slots (their meshes freed above, with the span's)
      litStone = null;
      for (const st of steps) { st.draw = null; st.pend = null; st.stages = null; st.chunks = null; st.grit = null; st.hang = null; }
      for (const g of walls) g.draw = null;
      for (const g of tubes) { g.draw = null; g.lid = null; }
      for (const g of isles) g.draw = null;
      for (const g of seals) g.draw = null;
      for (const g of slags) { g.crust = null; g.molten = null; }
      lit.clear();
      for (const P of [...planks.values()]) dropPlank(P);   // AUDIT EG III: every plank's mesh and bucket freed
      col = null;
      targetList = [];
      draws = null; safe = null;
      voidHas = false; voidFall.v = null; voidFromY = NaN;   // EG-PERFECT: the fall's memory with the circle
    },
  };
}
