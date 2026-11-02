// SIT1 (2026-10-14, Mac: "Implement the ability to interact and sit on chairs. Morrowind model should use the sitting
// animation we use for the card game"). Pinned here: which models are sat on; the seat on one (its seat surface, its
// back, the way the sitter faces, the feet, the hands on the knees, the eye) off the room's probe; the card seat's pose
// SOLVED on retail's biped at a chair's lap; and the wiring - the room lists its chairs, the host's target, press, name,
// seat, eye, body, third-person pivot and every road up, the pose on the wire.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  CHAIR_MODELS, isChairModel, CHAIR_KIND, CHAIR_SEAT_MIN, CHAIR_SEAT_MAX, CHAIR_SEAT_DEFAULT, CHAIR_BACK_RISE, CHAIR_BACK_REACHES,
  CHAIR_LAP_TOP, CHAIR_PROBE_OVER, CHAIR_FLOOR_STEP, chairSeatOf, chairProbeOver,
} from '../../../src/world/chairSeat.js';
import { SEATED_EYE_HEIGHT, SEATED_HIP_HEIGHT, SEAT_ANKLE, seatRequestFor, seatTopByte, seatTopOf } from '../../../src/player/seatPose.js';
import { parseNif } from '../../../src/formats/morrowind/mwNifFile.js';
import { buildSkeleton, poseSkeleton, skeletonSpaceMatrices, GRAPH_ROOT } from '../../../src/formats/morrowind/mwSkin.js';
import { applyClimbRig, climbBones } from '../../../src/combat/climbRig.js';
import { MW_UNITS_PER_METER } from '../../../src/formats/morrowind/mwFirstPerson.js';
import { Collider } from '../../../src/player/collider.js';
import { worldAabb } from '../../../src/player/activate.js';
import { hostText } from '../../hostText.mjs';   // HOST-SPLIT 2 (AUDIT, the second read): its negatives read the host whole

const read = (p) => hostText(p);
const r3 = (v) => Math.round(v * 1000) / 1000;
const pt = (p) => p.map(r3);
const I = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
const turned = (yaw) => [Math.cos(yaw), 0, -Math.sin(yaw), 0, 0, 1, 0, 0, Math.sin(yaw), 0, Math.cos(yaw), 0, 0, 0, 0, 1];
/** A chair half a metre square on the floor at y 0, its seat at `seat`, and the column over (x, z) its back stands in
 *  rising to `backY` where `isBack(x, z)`. */
const chair = (seat, backY, isBack) => (x, z) => (isBack(x, z) ? backY : seat);
const box = { min: [0, 0, 0], max: [0.5, 1, 0.5] };

test('SIT1 THE CHAIRS: Daggerfall\'s chair, its benches and its thrones, by model id - the ones World of Daggerfall names and the arena\'s benches', () => {
  assert.deepEqual([...CHAIR_MODELS], [41100, 41105, 41106, 41122, 41123, 43307]);
  for (const id of CHAIR_MODELS) assert.equal(isChairModel(id), true);
  for (const id of [41000, 41001, 41002, 41108, 41116, 41409, 0]) assert.equal(isChairModel(id), false, `${id} is no seat`);
  assert.deepEqual({ ...CHAIR_KIND }, { 41100: 'chair', 41105: 'bench', 41106: 'bench', 41122: 'throne', 41123: 'throne', 43307: 'bench' });
  const lh = read('vendor/world-of-daggerfall/Scripts/LocationHelper.cs');
  for (const [id, name] of [[41100, 'Wooden Chair'], [41106, 'Wooden Bench Simple'], [41122, 'Wooden Throne'], [41123, 'Wooden Throne 2'], [43307, 'Wooden Bench']]) assert.ok(lh.includes(`{"${id}", "${name}"}`), `${id} named ${name}`);
});

test('SIT1 THE SEAT: the surface under its middle, the side its back rises on and the sitter facing away from it, the feet on the floor and the hips over the seat, the hands on the knees, the seated eye', () => {
  assert.deepEqual([CHAIR_SEAT_MIN, CHAIR_SEAT_MAX, CHAIR_SEAT_DEFAULT, CHAIR_BACK_RISE, [...CHAIR_BACK_REACHES], CHAIR_LAP_TOP, CHAIR_PROBE_OVER, CHAIR_FLOOR_STEP], [0.2, 0.9, 0.45, 0.25, [0.5, 0.75, 0.95], 0.64, 0.05, 0.6]);
  // its back on its local -z side: the sitter faces +z (yaw 0)
  const back = chair(0.45, 1.0, (x, z) => z < 0.1);
  const s = chairSeatOf(box, I, back, [3, 0, 3]);
  assert.equal(r3(s.yaw), 0, 'away from its back, whichever side the sitter came from');
  assert.deepEqual(pt(s.feet), [0.25, -SEAT_ANKLE, 0.25], 'at its middle; lowered toward the seat, never the ankles under the floor');
  assert.equal(s.top, CHAIR_LAP_TOP);
  assert.deepEqual(pt(s.eye), pt([0.25, -SEAT_ANKLE + SEATED_EYE_HEIGHT, 0.25]));
  assert.deepEqual([s.pitch, r3(s.seatY)], [0, 0.45]);
  // the same chair turned a quarter: its back on world +x, the sitter facing -x
  const q = chairSeatOf(box, turned(Math.PI / 2), chair(0.45, 1.0, (x) => x > 0.4), [3, 0, 3]);
  assert.equal(r3(q.yaw), r3(-Math.PI / 2));
  // a bench (no back): the side nearest the way the sitter came
  const dirOf = (yaw) => [r3(Math.sin(yaw)) + 0, r3(Math.cos(yaw)) + 0];
  assert.deepEqual(dirOf(chairSeatOf(box, I, chair(0.45, 0.45, () => false), [0.25, 0, -3]).yaw), [0, -1], 'came from -z, faces -z');
  assert.deepEqual(dirOf(chairSeatOf(box, I, chair(0.45, 0.45, () => false), [3, 0, 0.3]).yaw), [1, 0], 'came from +x, faces +x');
  // a rise under CHAIR_BACK_RISE is no back
  assert.deepEqual(dirOf(chairSeatOf(box, I, chair(0.45, 0.45 + CHAIR_BACK_RISE - 0.01, (x, z) => z < 0.1), [0.25, 0, -3]).yaw), [0, -1]);
  // a throne's high seat: the hips on it, the feet off the floor
  const t = chairSeatOf(box, I, chair(0.75, 1.6, (x, z) => z < 0.1), [3, 0, 3]);
  assert.equal(r3(t.feet[1]), r3(0.75 - SEATED_HIP_HEIGHT));
  // no surface met under its middle, or one past the seat's bounds: the default seat
  assert.equal(r3(chairSeatOf(box, I, () => null, [0, 0, 0]).seatY), CHAIR_SEAT_DEFAULT);
  assert.equal(r3(chairSeatOf(box, I, () => 1.2, [0, 0, 0]).seatY), CHAIR_SEAT_DEFAULT);
  assert.equal(r3(chairSeatOf(box, I, () => 0.1, [0, 0, 0]).seatY), CHAIR_SEAT_DEFAULT);
  assert.equal(chairSeatOf(null, I, () => 0.45, [0, 0, 0]), null);
  // the wire carries its lap as a seat's top, and back
  assert.equal(r3(seatTopOf(seatTopByte(CHAIR_LAP_TOP))), 0.65);
});

test('SIT1 THE POSE: the card table\'s seated body SOLVED on retail\'s biped at a chair\'s lap - the hips level with the knees, the hands down on the thighs by the knees, the head at the seated eye', () => {
  const U = MW_UNITS_PER_METER;
  const sk = buildSkeleton(parseNif(new Uint8Array(readFileSync(new URL('../../../vendor/weapon-sheathing/Data Files/Animations/xbase_anim/xbase_anim_sh.nif', import.meta.url)))));
  const b = climbBones(sk), pose = poseSkeleton(sk, null, null, 0);
  assert.ok(applyClimbRig(sk, pose, GRAPH_ROOT, skeletonSpaceMatrices, seatRequestFor({ feet: [0, 0, 0], yaw: 0, top: CHAIR_LAP_TOP }, { unitsPerMetre: U })));
  const m = skeletonSpaceMatrices(sk, pose, GRAPH_ROOT);
  const at = (ref) => { const v = m.get(ref).t; return [v[0] / U, v[2] / U, v[1] / U]; };   // right, up, forward
  const hip = at(b.root), knees = [at(b.L.calf), at(b.R.calf)], wrists = [at(b.L.hand), at(b.R.hand)], head = at(b.head);
  assert.ok(Math.abs(hip[1] - SEATED_HIP_HEIGHT) < 0.005, 'the hips at a seat\'s height');
  for (const k of knees) assert.ok(Math.abs(k[1] - hip[1]) < 0.02, 'the thighs level');
  for (const [i, w] of wrists.entries()) {
    const k = knees[i];
    assert.ok(Math.hypot(w[0] - k[0], w[2] - k[2]) < 0.16, 'each hand by its knee');
    assert.ok(w[1] > k[1] && w[1] - k[1] < 0.16, 'down on the thigh, not on a table');
    assert.ok(w[2] < k[2] && w[2] > hip[2], 'over the thigh, between the hips and the knee');
  }
  assert.ok(Math.abs(head[1] - SEATED_EYE_HEIGHT) < 0.1, 'the head about the seated eye');
});

test('SIT1 THE WIRING: the room lists its chairs (hidden with their piece); the host\'s target, press, name, seat and eye, the body drawn on the chair and posed by the rig, the third person round it, every road up, and the pose on the wire', () => {
  const ctx = read('src/scenes/interiorContext.js'), modes = read('src/scenes/worldModes.js');
  assert.match(ctx, /if \(isChairModel\(classicModelIdOf\(p\.modelIdNum\)\)\) \{\n\s*const chair = \{ cpu, matrix, modelId: classicModelIdOf\(p\.modelIdNum\), aabb \};[^\n]*\n\s*chairs\.push\(chair\);\n\s*if \(baseKey\) base\.furnish\(baseKey, chair\);/);
  assert.ok(ctx.indexOf('chairs.push(chair)') < ctx.indexOf('    if (p.objectType !== PROP_MODEL_TYPE) {\n      if (isBedModel('), 'listed whatever its ObjectType, before the furniture gate');
  assert.match(ctx, /^ {4}chairs, {4}\/\/ SIT1/m);
  const has = (s, why) => assert.ok(modes.includes(s), why ?? s);
  has("    if (!cardSeat && !chairSeat) interiorCtx.chairs?.forEach((ch, i) => {   // SIT1", 'none while seated');
  has('      if (ch.hidden) return;   // BASE-HIDE: taken out of the room\n      targets.push({ key: `chair:${i}`, aabb: ch.aabb ?? worldAabb(ch.cpu.positions, ch.matrix), distance: RAY_DISTANCE, reach: DEFAULT_ACTIVATION_DISTANCE, surface: true });');
  has('    if (chairSeat) return [];   // SIT1 (AUDIT FIVE-ASKS C5)', 'seated, the plaque names nothing - every press stands you up');
  has("      if (key.startsWith('chair:')) {\n        (decorTool.flying() && !decorTool.ghost() && plaqueActionFor(key) === 'out' ? decorTool.act('out', interiorCtx.chairs?.[Number(key.split(':')[1])]?.baseKey) : sitOnChair(Number(key.split(':')[1])));   // SIT1");
  has("(key) => (typeof key !== 'string' ? null : key.startsWith('chair:') ? decorBuiltInPlaque(chairName(interiorCtx?.chairs?.[Number(key.split(':')[1])]), interiorCtx?.chairs?.[Number(key.split(':')[1])], decorTool.flying() && !decorTool.ghost()) : (key.startsWith('bed:') && decorTool.flying() && !decorTool.ghost() ? decorBuiltInPlaque('Bed', interiorCtx?.beds?.[Number(key.split(':')[1])], true) : null))");
  has("    if (Math.abs(aabb.min[1] - player.pos[1]) > CHAIR_FLOOR_STEP) { setMidScreenText(tooFarAwayText()); return; }", 'never a chair on another floor (C6)');
  has("    const seat = chairSeatOf(aabb, ch.matrix, chairProbeOver(interiorCtx?.collider, aabb), player.pos);", 'the room\'s own collider');
  has("    if (takenSeats([{ x: seat.feet[0], z: seat.feet[2] }], host.seatedPeers?.() ?? []).length) { say(t('chair.taken', 'Someone is already sitting there.')); return; }", 'another player\'s chair is theirs');
  has("    chairSeat = null;   // the slot first (THE SLOT IS EMPTIED BEFORE THE OCCUPANT IS TOLD)\n    player.drawFeet = null;\n    player.drawYaw = null;\n    cam.pos = player.eyeAt();");
  // the roads up - each beside the card seat's own
  has("    if (chairSeat) { standFromChair(); return true; }   // SIT1", 'the press');
  has("    if (chairSeat && !overlayHeld && leavesSeat(mv, jumpHeld || !!player.toggleAutorun || swingKey)) standFromChair();", 'a step, a jump, the stick, the autorun');
  has("    if (chairSeat && isSwingButton(e.button) && !modalWindowUp()) { standFromChair(); return; }", 'a swing');
  has("    if (mode === 'interior' && chairSeat && actionOf(e, keys) === 'Escape' && !interiorKeyCtx.uiOverlayActive) { standFromChair(); e.preventDefault(); return; }", 'Escape');
  has("  registerPlayerHurtListener('chair-seat', (_e, hurt) => { if (chairSeat && hurt.after < hurt.before && !tickInFlight()) standFromChair(); });", 'a blow');
  has("    if (chairSeat && !(playerEntity.health > 0)) standFromChair();", 'death');
  assert.equal(modes.split('standFromChair();   // SIT1: nor on a chair').length - 1, 2, 'a room left, a new room');
  has('  modesApi.attackInput = (dx, dy, held) => { if (held && chairSeat && !decorTool.flying()) { standFromChair(); return; } touchSwing(dx, dy, held); };', 'a touch swing (C1)');
  has('    if (_act.cast && chairSeat) standFromChair();', 'a cast, before it leaves the eye (C3)');
  has('    if (chairSeat && (decorTool.flying() || decorTool.panelOpen() || interiorCtx?.chairs?.[chairSeat.key]?.hidden)) standFromChair();', 'the decorator, or the chair taken out of the room (C2)');
  has("        standFromChair();   // SIT1: off a chair too\n        standFromCardTable({ cashOut: !load });", 'the forced road out');
  // the view and the body
  has("    if (mode === 'interior' && chairSeat && !(interiorOverlay instanceof DeathScreen)) { cam.pos = chairSeat.eye.slice(); player.drawFeet = chairSeat.feet; player.drawYaw = chairSeat.yaw; }");
  has("      seat: chairSeat ? { feet: chairSeat.feet, yaw: chairSeat.yaw, top: chairSeat.top } : null,   // SIT1", 'the rig poses the body seated (fpArm thirdSeat)');
  has('      ...(chairSeat ? { feet: chairSeat.feet } : {}),', 'the third person orbits the chair the body is drawn on (C0)');
  assert.equal(modes.includes('if (chairSeat) mwv.eye = cam.pos;'), false, 'never forced into first person - the third person sees the body seated');
  has("  const cardSeatPose = modesApi.seatPose;\n  modesApi.seatPose = () => cardSeatPose() ?? (mode === 'interior' && chairSeat ? { feet: chairSeat.feet, yaw: chairSeat.yaw, st: seatTopByte(chairSeat.top) } : null);", 'others see it seated - the card seat\'s door first');
  for (const other of ['src/scenes/exterior.js', 'src/scenes/world.js', 'src/scenes/dungeonContext.js']) assert.doesNotMatch(read(other), /chairSeat|sitOnChair|`chair:/, `${other} seats nobody on a chair`);
});

test('SIT1 THE ROOM\'S PROBE (AUDIT FIVE-ASKS C4/C8): over a real collider - a thin back and a tall throne\'s back found at the reaches, the sitter facing away; a table over the seat never taken for it; a miss is none', () => {
  const I = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  const box = (x0, y0, z0, x1, y1, z1, P, Ix) => {
    const b = P.length / 3;
    for (const p of [[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0], [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]]) P.push(...p);
    for (const t of [[0, 1, 2], [0, 2, 3], [4, 6, 5], [4, 7, 6], [0, 4, 5], [0, 5, 1], [3, 2, 6], [3, 6, 7], [0, 3, 7], [0, 7, 4], [1, 5, 6], [1, 6, 2]]) Ix.push(b + t[0], b + t[1], b + t[2]);
  };
  const seated = (parts, from, extra = []) => {
    const col = new Collider(() => -Infinity);
    const mesh = (list) => { const P = [], Ix = []; for (const p of list) box(...p, P, Ix); return [new Float32Array(P), new Uint32Array(Ix)]; };
    col.addMesh('floor', ...mesh([[-5, -0.1, -5, 5, 0, 5]]), I);
    if (extra.length) col.addMesh('extra', ...mesh(extra), I);
    const [pos, idx] = mesh(parts);
    col.addMesh('chair', pos, idx, I);
    const aabb = worldAabb(pos, I);
    return { s: chairSeatOf(aabb, I, chairProbeOver(col, aabb), from), probe: chairProbeOver(col, aabb), aabb };
  };
  const dirOf = (yaw) => [r3(Math.sin(yaw)) + 0, r3(Math.cos(yaw)) + 0];
  const legs = [[0, 0, 0, 0.04, 0.4, 0.04], [0.41, 0, 0, 0.45, 0.4, 0.04], [0, 0, 0.41, 0.04, 0.4, 0.45], [0.41, 0, 0.41, 0.45, 0.4, 0.45]];
  const seatSlab = [0, 0.4, 0, 0.45, 0.45, 0.45];
  // a 4 cm back on -z, the sitter coming from +x: the back is found, the sitter faces +z
  const thin = seated([...legs, seatSlab, [0, 0.45, 0, 0.45, 1.0, 0.04]], [3, 0, 0.2]);
  assert.equal(r3(thin.s.seatY), 0.45);
  assert.deepEqual(dirOf(thin.s.yaw), [0, 1], 'away from a thin back, whichever side the sitter came from');
  // a throne 2.1 m tall, its back on -z: probed from over its top
  const throne = seated([...legs, seatSlab, [0, 0.45, 0, 0.45, 2.1, 0.1]], [3, 0, 0.2]);
  assert.deepEqual(dirOf(throne.s.yaw), [0, 1], 'a tall back found from over the box');
  // a tall chair (its seat 0.5 m) under a shelf at 1.0 m: the seat's probe starts at the band's top, not the box's, and
  // passes under it
  const tabled = seated([...legs, [0, 0.4, 0, 0.45, 0.5, 0.45], [0, 0.5, 0, 0.45, 2.1, 0.1]], [0.2, 0, 3], [[-0.5, 1.0, -0.5, 1.0, 1.05, 1.0]]);
  assert.equal(r3(tabled.s.seatY), 0.5, 'the seat, not the shelf over it');
  assert.equal(r3(tabled.probe(0.2, 0.2, 1.5)), 1.05, 'from over the table, the table');
  assert.equal(thin.probe(6, 6, 0.95), null, 'past the floor\'s edge, nothing to the chair\'s foot: none');
  assert.equal(chairProbeOver(null, thin.aabb)(0, 0, 1), null, 'no collider: none');
});

