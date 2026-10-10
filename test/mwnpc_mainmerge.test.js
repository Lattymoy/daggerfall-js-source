// MW-NPC x MAIN (2026-10-10, the arc's merge of main #723-#744 - bible/04-Characters/Morrowind-NPCs.md section 22):
// what main learned while the arc was on its branch, met on the merged tree. MWNPC1 moved every third-person body's
// skin into the vertex shader, and three of main's slices since do per-pose work on the CPU skin that the GPU's pose
// never ran: MW-SMOOTH lights a mesh by its own normals, posed (pinned with the stream's law in
// mwnpc1_gpuskin.test.js MWNPC1b); MW-BOW1 re-poses a bow's limbs and its arrow on the weapon's own clock, writing the
// pieces' sources; AUDIT MW-CLOAK seats the cloak by swapping its batch and turns the stowed gear with it after every
// pose. And two of main's screens met the arc's lanes: WAGONS2 draws a seated companion grown under the Overworld, and
// ORG2 places every Features row on a tab.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseNif } from '../src/formats/mwNifFile.js';
import { flattenNif } from '../src/formats/mwNifMesh.js';
import { assembleFirstPersonArm, poseAssembly, posePartClocks, ARROW_FALLBACK_NODE } from '../src/formats/mwFirstPerson.js';
import { skinLayout, skinSamePieces, packSkinStream, writeSkinPalette, skinnedVertex, skinStreamCorner, restreamMovedRows } from '../src/formats/mwGpuSkin.js';
import { fitCloakOver, fitStowedGear, followCloak, seatCloak } from '../src/formats/mwCloakFit.js';
import { ARMOR_MATERIAL } from '../src/systems/armorMaterials.js';
import { createFpArm, pieceLanes } from '../src/combat/fpArm.js';
import { createExteriorFoes } from '../src/scenes/exteriorFoes.js';
import { ENEMY_BASICS } from '../src/characters/enemyBasics.js';
import { whereIs } from '../src/ui/settingsMap.js';
import { bowClip, T } from './fixtures/mw/bowClip.mjs';
import { fixtureBodyDeps, countingRenderer } from './fixtures/mw/bodyRig.mjs';
import { retailSkeleton } from './fixtures/mw/retailRig.mjs';
import { SHEATHED, isCloak, isGear, isUnder, body, turned } from './fixtures/mw/cloakRig.mjs';

const f = (n) => new Uint8Array(readFileSync(new URL(`./fixtures/mw/${n}`, import.meta.url)));
const rd = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const close = (a, b, tol = 2e-5) => Math.abs(a - b) <= tol * (1 + Math.abs(b));

test('MW-BOW1 x MWNPC1: a part re-posed on its own clock counts it, and the GPU stream re-writes that part\'s corners alone - where a fresh stream would put them, posed where the CPU places them', async () => {
  // the clock's count: a moving bow's piece is counted each time it is re-posed; one that does not move never
  const moving = parseNif(bowClip());
  const limb = flattenNif(moving)[0];
  const piece = { kind: 'rigid', slot: 'weapon', source: Float32Array.from(limb.positions), clip: { nif: moving, batch: limb } };
  assert.equal(posePartClocks({ pieces: [piece] }, T.maxAttack), 1);
  assert.equal(piece.sourceGen, 1, 'counted');
  posePartClocks({ pieces: [piece] }, T.release);
  assert.equal(piece.sourceGen, 2);
  // the arrow on the bow's ArrowBone - the clock's other branch (resolveWeaponParts' preClip) - counted the same
  const arrowLocal = flattenNif(parseNif(f('arrow.nif')))[0].positions;
  const arrow = { kind: 'rigid', slot: 'arrow', source: Float32Array.from(arrowLocal), preClip: { nif: moving, node: ARROW_FALLBACK_NODE, local: arrowLocal } };
  assert.equal(posePartClocks({ pieces: [arrow] }, T.maxAttack), 1);
  assert.equal(arrow.sourceGen, 1, 'the arrow counted');
  const still = parseNif(f('bowmesh.nif'));
  const stillPiece = { kind: 'rigid', slot: 'weapon', source: Float32Array.from(flattenNif(still)[0].positions), clip: { nif: still, batch: flattenNif(still)[0] } };
  posePartClocks({ pieces: [stillPiece] }, T.maxAttack);
  assert.equal(stillPiece.sourceGen, undefined, 'a part that does not move is never counted');

  // the stream: the fixture arm's mirrored rigid upper arm moves (a source the clock re-wrote)
  const arm = await assembleFirstPersonArm({ skeletonBytes: f('armskel.nif'), parts: [{ slot: 'hand', bytes: f('armhand.nif') }, { slot: 'upperarm', bytes: f('armcuff.nif') }] });
  const L = skinLayout(arm.pieces);
  const packed = packSkinStream(L, pieceLanes);
  assert.deepEqual(restreamMovedRows(L, pieceLanes), [], 'nothing moved: nothing re-written');
  const moved = arm.pieces.find((p) => p.kind === 'rigid' && p.mirrored);
  moved.source = Float32Array.from(moved.source, (x, i) => x * 1.5 + (i % 3) * 0.25);
  moved.sourceGen = (moved.sourceGen | 0) + 1;
  const out = [...restreamMovedRows(L, pieceLanes)];   // the list is the layout's, reused by the next call
  assert.equal(out.length, 1, 'the one moved part');
  const range = packed.ranges.find((r) => r.piece === moved);
  assert.equal(out[0].offset, range.first * packed.floats, 'at its range\'s first float');
  assert.equal(out[0].data.length, range.count * packed.floats, 'its corners and no more');
  const fresh = packSkinStream(skinLayout(arm.pieces), pieceLanes);
  assert.deepEqual([...out[0].data], [...fresh.stream.subarray(out[0].offset, out[0].offset + out[0].data.length)], 'what a stream laid out now would hold there');
  assert.deepEqual(restreamMovedRows(L, pieceLanes), [], 'and once: the next pose re-writes nothing');
  // drawn: the stream with the part put back, by the shader's law, where the CPU places the moved source
  const stream = Float32Array.from(packed.stream);
  stream.set(out[0].data, out[0].offset);
  poseAssembly(arm, { time: 0 });
  writeSkinPalette(L, arm);
  for (let c = range.first; c < range.first + range.count; c++) {
    const got = skinStreamCorner(stream, packed.floats, L.pairs, c, L.palette);
    const v = moved.indices[c - range.first];
    for (let k = 0; k < 3; k++) assert.ok(close(got[k], moved.positions[v * 3 + k]), `corner ${c}[${k}]: ${got[k]} vs ${moved.positions[v * 3 + k]}`);
  }
  // and its box moved with it (rule 42 off the palette): the GPU pose's box holds the CPU's exact fold
  const exact = { ...moved.box };
  poseAssembly(arm, { time: 0, skin: false });
  writeSkinPalette(L, arm);
  for (const [lo, hi] of [['minX', 'maxX'], ['minY', 'maxY'], ['minZ', 'maxZ']]) {
    assert.ok(moved.box[lo] <= exact[lo] + 1e-4 && moved.box[hi] >= exact[hi] - 1e-4, `${lo}/${hi}: the box holds the moved part`);
  }
});

/** the counting renderer with the skinned path, counting the streams a moved part re-writes */
function skinRenderer() {
  const r = countingRenderer();
  Object.assign(r.c, { skinMeshes: 0, palettes: 0, streams: [] });
  r.createSkinnedCharacterMesh = (stream, o) => { r.c.skinMeshes++; return { vao: {}, buffers: [], count: stream.length / o.floats, floats: o.floats, skin: { tex: {}, ...o } }; };
  r.updateSkinPalette = () => { r.c.palettes++; };
  r.updateSkinStream = (mesh, offset, data) => { r.c.streams.push({ mesh, offset, length: data.length }); };
  r.releaseCharacterSkin = () => {};
  return r;
}

test('MW-BOW1 x MWNPC1: the rig - a third-person body whose part moved on its own clock sends that part\'s corners into its mesh\'s range, and nothing else; a pose with nothing moved sends none', async () => {
  const renderer = skinRenderer();
  const arm = createFpArm();
  arm.attach(renderer, () => ({ pos: [0, 0, 0], yaw: 0, pitch: 0, move: { forward: 0, speed: 0, grounded: true } }));
  const res = await arm.build({ race: 'fprace', deps: fixtureBodyDeps() });
  assert.equal(res.ok, true, res.error);
  assert.equal(arm.setViewMode('third'), true);
  arm.update(1 / 60);
  arm.update(1 / 60);
  assert.equal(renderer.c.skinMeshes, 1);
  assert.deepEqual(renderer.c.streams, [], 'no part moved: no stream sent');
  const mesh = arm.thirdMesh();
  const range = mesh.ranges.find((r) => r.piece.kind === 'rigid');
  range.piece.source = Float32Array.from(range.piece.source, (x) => x * 1.1);
  range.piece.sourceGen = (range.piece.sourceGen | 0) + 1;
  arm.update(1 / 60);
  assert.deepEqual(renderer.c.streams, [{ mesh, offset: range.first * mesh.floats, length: range.count * mesh.floats }], 'the moved part\'s range, into the same mesh');
  assert.equal(renderer.c.skinMeshes, 1, 'never a new mesh for it');
  assert.equal(renderer.c.uploads, 0, 'nor a whole stream');
  arm.update(1 / 60);
  assert.equal(renderer.c.streams.length, 1, 'once');
});

const GEAR = [['w_claymore_daedric_sh.nif', 'Bip01 LongBladeTwoClose'], ['w_iron_longsword_sh.nif', 'Bip01 LongBladeOneHand']];
const STRIDES = [{ 'bip01 r thigh': 35, 'bip01 l thigh': -30, 'bip01 l calf': 45 }, { 'bip01 l thigh': 35, 'bip01 r thigh': -30, 'bip01 r calf': 45 }];

test('AUDIT MW-CLOAK x MWNPC1: a seated cloak skins by another batch, so its layout is not the standing one\'s; and the gear goes with the cloak on a GPU pose as on a CPU one - placed by the palette where the CPU places it, the cloak alone skinned for it', async () => {
  const asm = await body(ARMOR_MATERIAL.Steel, GEAR);
  fitCloakOver(asm, { isCloak, isUnder });
  const gens = asm.pieces.filter(isGear).map((p) => p.sourceGen | 0);
  fitStowedGear(asm, { isCloak, isGear });
  assert.ok(asm.pieces.filter(isGear).some((p, i) => (p.sourceGen | 0) === gens[i] + 1), 'a source the fit replaced is counted - a stream laid out of the old one re-writes it');
  const follow = followCloak(asm, { isCloak, isGear });
  assert.ok(follow && follow.groups.length, 'the gear is tied to the cloak');

  // the seat: another batch, another layout; standing again, the first one's
  const L = skinLayout(asm.pieces);
  assert.equal(skinSamePieces(L, asm.pieces), true);
  assert.equal(seatCloak(asm, true, isCloak), true);
  assert.equal(skinSamePieces(L, asm.pieces), false, 'seated: the stream\'s weights are the standing cloak\'s - laid out again');
  seatCloak(asm, false, isCloak);
  assert.equal(skinSamePieces(L, asm.pieces), true, 'standing: the stream it has');

  // the follow, both ways, at each stride - the CPU pose's placed gear is what the palette places
  let turnedAny = false;
  for (const stride of STRIDES) {
    poseAssembly(asm, turned(asm, stride));
    const cpu = new Map(asm.pieces.filter(isGear).map((p) => [p, Float32Array.from(p.positions)]));
    poseAssembly(asm);   // rest between: the GPU pose must read the cloak where ITS pose puts it
    const before = new Map(asm.pieces.filter(isGear).map((p) => [p, Float32Array.from(p.positions)]));
    let skins = 0;
    const fns = asm.fns;
    asm.fns = { ...fns, skinBatch: (...a) => { skins++; return fns.skinBatch(...a); } };
    poseAssembly(asm, { ...turned(asm, stride), skin: false });
    asm.fns = fns;
    assert.equal(skins, 1, 'the cloak alone skinned on the CPU, for the follow to read');
    writeSkinPalette(L, asm);
    for (const [p, want] of cpu) {
      assert.deepEqual([...p.positions], [...before.get(p)], `${p.slot}: no gear placed on the CPU by a GPU pose`);
      for (let v = 0; v < want.length / 3; v++) {
        const got = skinnedVertex(L, p, v);
        for (let k = 0; k < 3; k++) assert.ok(close(got[k], want[v * 3 + k], 1e-4), `${p.slot} v${v}[${k}]: ${got[k]} vs ${want[v * 3 + k]}`);
      }
      const bare = asm.fns.attachmentTransform(asm.mats, p.attachRef);
      if (p.followAt && [...p.followAt.a].some((x, i) => Math.abs(x - bare.a[i]) > 1e-4)) turnedAny = true;
    }
  }
  assert.ok(turnedAny, 'and the follow turned gear at a stride - the pin reads a placement that differs from its bone\'s');

  // a body with no cloak: the follow lets go of every placement it left
  const bare = await assembleFirstPersonArm({ skeletonBytes: retailSkeleton(), parts: [{ slot: 'sheath', bones: ['Bip01 LongBladeOneHand'], bytes: SHEATHED('w_iron_longsword_sh.nif'), bare: true }] });
  bare.pieces[0].followAt = { a: [1, 0, 0, 0, 1, 0, 0, 0, 1], t: [9, 9, 9] };
  assert.equal(followCloak(bare, { isCloak, isGear }), null);
  assert.equal(bare.pieces[0].followAt, null, 'a placement the last follow left goes with it');
});

/** a lane that records what the pool offers it (mwnpc5_pool.test.js's) */
function recordingLane() {
  const L = { offered: [], standing: new Set() };
  Object.assign(L, {
    begin() { L.offered.length = 0; }, stand(lane, actor) { L.offered.push(actor.id); }, end() {}, has: () => false, draw() {}, drawVeiled() {}, destroy() {}, offsetAll() {},
  });
  return L;
}
const stubTex = { getSize: () => ({ width: 64, height: 100 }), getScale: () => ({ width: 0, height: 0 }), recordCount: 8 };

test('WAGONS2 x MWNPC5c: a companion drawn grown on a wagon under the Overworld keeps its sprite - the far view\'s - and the same companion at its true seat is offered its body', () => {
  let lane = null;
  const pool = createExteriorFoes({
    renderer: { createBillboardBatch: () => ({}), destroyBillboardBatch: () => {}, textures: new Map() },
    collider: { raycast: () => 0.5, heightAt: () => 0 }, fetchBytes: async () => { throw new Error('none'); }, getTexture: async () => stubTex,
    uploadRecordFrame: () => {}, currentMinute: () => 1000, playerEntity: { level: 1, items: [], stats: {} }, audio: null, onPlayerHurt: () => {},
    wantNpcBodies: () => true, makeNpcBodies: () => (lane = recordingLane()),
  });
  let g = 6;
  const seated = {
    mobileType: 130, gender: 'male', dead: false, seq: 3,
    entity: { health: 10, maxHealth: 10, items: [], activeEffects: [], isClass: true },
    ai: { feet: [2, 0, 3], yaw: 0, moving: false, isHostile: false, detected: false, height: 1.8, seatDraw: () => ({ feet: [20, 4, 30], g }), offsetOrigin() {} },
    tex: stubTex, archive: ENEMY_BASICS[130].maleTexture, batch: {}, _mout: { record: 0, frame: 0, flip: false }, mobile: { basics: { behaviour: 'General' } },
  };
  pool.foes.push(seated);
  pool.batches();
  assert.deepEqual(lane.offered, [], 'grown under the Overworld: its sprite, drawn where the wagon is');
  assert.deepEqual(seated.batch.origin, [20, 4, 30]);
  g = 1;
  pool.batches();
  assert.deepEqual(lane.offered, [3], 'on the ground at its seat: its body');
});

test('RW1 x MWNPC8b/8c: the view out through a building\'s glass draws no Morrowind body, so every flat it draws is shown - a standing person\'s never left cast-only by the street frame\'s last mark (by source: both exterior hosts\' view outs; the interiors\' host draws its exterior host\'s, and a dungeon has no glass)', () => {
  const world = rd('src/scenes/world.js');
  const out = world.slice(world.indexOf('  const drawOutsideStreet = (r, planes) => {'), world.indexOf('  const outsideView = (doorMatrix) => ({'));
  assert.match(out, /fb\.origin = t;\n(\s*\/\/[^\n]*\n)*\s*fb\.castOnly = false;\n\s*flats\.push\(fb\);/, 'world.js: each flat shown before it joins the view out\'s draw');
  assert.ok(out.indexOf('fb.castOnly = false;') < out.indexOf('r.drawBillboards(flats'), 'and before the draw');
  const ext = rd('src/scenes/exterior.js');
  const extOut = ext.slice(ext.indexOf('  const outsideView = (doorMatrix) => ({'), ext.indexOf('  var modes = createWorldModes({'));
  assert.match(extOut, /const flats = billboardBatches\.filter\([^\n]*\n\s*for \(const b of flats\) b\.castOnly = false;[^\n]*\n\s*if \(flats\.length\) r\.drawBillboards\(flats,/, 'exterior.js: the same');
  // the people are in what the view outs draw: the street's standing people's batches are the pixel's (world.js) and the
  // town's (exterior.js) flats - so a mark left on them is a person missing from the glass
  assert.match(world, /pn\.standBatch = batch;\n\s*entry\.npcBatches\.push\(batch\);\n\s*entry\.batches\.push\(batch\);/);
  assert.match(ext, /billboardBatches\.push\(batch\);\n\s*flatCount\+\+;\n\s*person\.standBatch = batch;/);
  assert.match(rd('src/scenes/worldModes.js'), /scene: host\.outsideView\?\.\(/, 'the interiors draw their exterior host\'s view out');
  assert.doesNotMatch(rd('src/scenes/dungeonContext.js'), /outsideView/, 'a dungeon has none');
});

test('ORG2 x MWNPC5b: the Morrowind People row stands on the one Settings screen, in Combat\'s Morrowind section beside the Steel Helm and the spell effects', () => {
  const at = whereIs('feat:mw-npc-bodies');
  assert.equal(at?.tab.id, 'combat');
  assert.equal(at.section.id, 'morrowind');
  assert.deepEqual(at.section.items, ['feat:mod-weapon-sheathing', 'feat:steel-helm', 'feat:mw-spell-effects', 'feat:mw-npc-bodies']);
});
