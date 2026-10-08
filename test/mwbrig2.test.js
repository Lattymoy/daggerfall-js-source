// MW-BRIG2 (2026-09-29, Mac on MW-BRIG1: "The texture was great, you just somehow moved the geometry in the
// process"): THE STEEL BRIGANDINE, SKINNED FROM THE BODY UNDER IT.
//
// MW-BRIG1 hung the brigandine rigid on the skeleton's Chest and Groin nodes. The body it covers is SKINNED to the
// spine and pelvis by its own NiSkinData (Morrowind-Rules.md rule 20), so once anything animated the torso moved by
// its bones and the brigandine by a node the body never uses. These pins hold the fix: the garment copies the body's
// skin (formats/mwSkinTransfer.js) and is drawn by the same skinBatch the body is, so it cannot come away from it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { parseNif } from '../src/formats/mwNifFile.js';
import { flattenNif } from '../src/formats/mwNifMesh.js';
import { decodeTextureImage } from '../src/formats/mwTexture.js';
import { buildSkeleton, poseSkeleton, skeletonSpaceMatrices, skinBatch, GRAPH_ROOT } from '../src/formats/mwSkin.js';
import { transferSkin, sourceSkin } from '../src/formats/mwSkinTransfer.js';
import { assembleFirstPersonArm, poseAssembly } from '../src/formats/mwFirstPerson.js';
import { composeWornArmor, itemMapCoverage } from '../src/formats/mwItemMap.js';
import { collectArmTextures } from '../src/combat/fpArm.js';
import { ARMOR_MATERIAL } from '../src/systems/armorMaterials.js';
import { RRI_TEMPLATES, rriVariantWord } from '../src/systems/rriItems.js';
import { OWN_MW_ARMOR, RRI_JERKIN_TEMPLATE, ownArmorModelFor, ownArmorModelPaths } from '../src/characters/ownArmorModels.js';
import { ownMwDataPath } from '../src/systems/ownMwAssets.js';
import { writeNif, meshToNif } from '../tools/nifWrite.mjs';
import { readPng } from '../tools/pngIO.mjs';
import { readFbx, nodeAt, childNamed } from '../tools/fbxRead.mjs';
import { polygonsOf, earClip, isConvexPolygon } from '../tools/fbxMesh.mjs';
import { OUT, SOURCE_FBX, SOURCE_PNG, TEXTURE_NAME, bakeBrigandine } from '../tools/bakeBrigandine.mjs';

const onDisk = (p) => new Uint8Array(readFileSync(new URL(`../${p}`, import.meta.url)));
const raw = (p) => readFileSync(new URL(`../${p}`, import.meta.url));
const sourceText = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const baked = bakeBrigandine(raw(SOURCE_FBX), raw(SOURCE_PNG));
const STEEL_JERKIN = Object.freeze({ templateIndex: RRI_JERKIN_TEMPLATE, material: ARMOR_MATERIAL.Steel });

// ── the skeleton: bones turned and lifted, and a Chest NODE the body does not use ──────────────────────────────
const deg = Math.PI / 180;
const rotZ = (a) => [Math.cos(a), -Math.sin(a), 0, Math.sin(a), Math.cos(a), 0, 0, 0, 1];
const rotX = (a) => [1, 0, 0, 0, Math.cos(a), -Math.sin(a), 0, Math.sin(a), Math.cos(a)];
function skeletonBytes() {
  return writeNif([
    { type: 'NiNode', name: 'Root', children: [1] },
    { type: 'NiNode', name: 'Bip01 Pelvis', translation: [0, 0, 60], rotation: rotZ(90 * deg), children: [2, 4] },
    { type: 'NiNode', name: 'Bip01 Spine', translation: [0, 0, 12], rotation: rotX(-20 * deg), children: [3] },
    // a clothing node, turned its own way at rest (as retail's stand like an idle frame over a T-posed body)
    { type: 'NiNode', name: 'Chest', translation: [0, 2, 14], rotation: rotX(90 * deg), children: [] },
    { type: 'NiNode', name: 'Groin', translation: [0, 0, -2], children: [] },
  ], [0]);
}
const quat = (axis, a) => [Math.cos(a / 2), ...axis.map((c) => c * Math.sin(a / 2))];
/** An idle-like pose: the spine bends one way, and the Chest NODE is keyed a very different way. */
const IDLE = { tracks: new Map([['bip01 spine', {}], ['chest', {}]]),
  sampleTrack: (t) => (t === IDLE.tracks.get('bip01 spine') ? { rotation: quat([1, 0, 0], 25 * deg) } : { rotation: quat([0, 1, 0], 70 * deg) }) };

/** A skinned "body": part-local vertices (a torso near the ground, as retail authors it), weighted to the spine and
 *  pelvis, with inverse binds that are NOT the skeleton's rest - the bind a mesh was modelled in, not the rest a
 *  skeleton file stores. */
function skinnedBody(skeleton) {
  const pelvis = skeleton.byName.get('bip01 pelvis'); const spine = skeleton.byName.get('bip01 spine');
  const positions = []; const pel = { i: [], w: [] }; const spi = { i: [], w: [] };
  let n = 0;
  for (let z = 0; z <= 30; z += 3) for (let a = 0; a < 360; a += 30) {
    positions.push(8 * Math.cos(a * deg), 5 * Math.sin(a * deg), z);
    const s = z / 30;
    if (s < 1) { pel.i.push(n); pel.w.push(1 - s); }
    if (s > 0) { spi.i.push(n); spi.w.push(s); }
    n++;
  }
  const inv = (a, t) => ({ a: Float32Array.from(a), t });
  return {
    name: 'Tri Chest', skinned: true, positions: Float32Array.from(positions), normals: null, uvs: null, indices: new Uint16Array(0),
    skin: { skeletonRoot: GRAPH_ROOT, rootBone: GRAPH_ROOT, transform: { rotation: [1, 0, 0, 0, 1, 0, 0, 0, 1], translation: [0, 0, 0], scale: 1 }, shapeTransform: null,
      bones: [
        { ref: pelvis, name: 'bip01 pelvis', invBind: inv(rotZ(-80 * deg), [1, -3, -2]), indices: pel.i, weights: pel.w },
        { ref: spine, name: 'bip01 spine', invBind: inv(rotX(15 * deg), [0, -1, -9]), indices: spi.i, weights: spi.w },
      ] },
  };
}
const poseOf = (skeleton, p = null) => {
  const pose = poseSkeleton(skeleton, p?.tracks ?? null, p?.sampleTrack ?? null, 0, {});
  return { pose, mats: skeletonSpaceMatrices(skeleton, pose, GRAPH_ROOT) };
};
const skinned = (batch, skeleton, p) => { const { pose, mats } = poseOf(skeleton, p); const out = new Float32Array(batch.positions.length); skinBatch(batch, skeleton, pose, mats, out, null); return out; };

test('MW-BRIG2: THE BUG - a garment fitted over a skinned body moves WITH it, where a Chest-node attach tears away', () => {
  const skeleton = buildSkeleton(parseNif(skeletonBytes()));
  const body = skinnedBody(skeleton);
  const restBody = skinned(body, skeleton, null);
  // The garment, fitted where the modeller saw it: laid ON the body at rest, one vertex per body vertex, so "moves
  // with it" is an exact, vertex-for-vertex question; in two-triangle strips so it has faces.
  const G = []; const I = [];
  const n = restBody.length / 3;
  for (let v = 0; v < n; v++) G.push(restBody[v * 3], restBody[v * 3 + 1], restBody[v * 3 + 2]);
  for (let v = 0; v + 13 < n; v++) if ((v + 1) % 12) I.push(v, v + 1, v + 12, v + 1, v + 13, v + 12);
  const garment = { name: 'Brigandine', positions: Float32Array.from(G), uvs: new Float32Array(n * 2), indices: Uint16Array.from(I), material: { twoSided: true } };
  const { pose, mats } = poseOf(skeleton, null);
  const parts = transferSkin(garment, [body], { skeleton, pose, mats, skinBatch });
  assert.equal(parts.length, 1);
  const g = parts[0];
  // AT REST: exactly where it was fitted.
  const atRest = skinned(g, skeleton, null);
  const idx = new Map(); g.indices.forEach((k) => idx.set(k, true));
  // map sub-batch vertex k back to its garment vertex by position at rest
  const back = [];
  for (let k = 0; k < atRest.length / 3; k++) {
    let best = -1; let bd = Infinity;
    for (let v = 0; v < n; v++) { const d = (atRest[k * 3] - G[v * 3]) ** 2 + (atRest[k * 3 + 1] - G[v * 3 + 1]) ** 2 + (atRest[k * 3 + 2] - G[v * 3 + 2]) ** 2; if (d < bd) { bd = d; best = v; } }
    assert.ok(bd < 1e-6, `garment vertex ${k} lands where it was fitted at rest (off by ${Math.sqrt(bd)})`);
    back.push(best);
  }
  // IN THE IDLE: every garment vertex is still ON its body vertex - it moved exactly as the body moved.
  const idleBody = skinned(body, skeleton, IDLE);
  const idleG = skinned(g, skeleton, IDLE);
  let worst = 0;
  for (let k = 0; k < back.length; k++) {
    const v = back[k];
    worst = Math.max(worst, Math.hypot(idleG[k * 3] - idleBody[v * 3], idleG[k * 3 + 1] - idleBody[v * 3 + 1], idleG[k * 3 + 2] - idleBody[v * 3 + 2]));
  }
  assert.ok(worst < 1e-3, `the garment stays on the body through the idle (worst ${worst.toFixed(5)})`);

  // AND THE WAY MW-BRIG1 DID IT DOES NOT: rigid on the Chest node, its rest taken back out. At rest it agrees; in
  // the idle it is dragged by a node the body never uses - the torso "moved".
  const chestRef = skeleton.byName.get('chest');
  const rest = poseOf(skeleton, null).mats.get(chestRef); const idle = poseOf(skeleton, IDLE).mats.get(chestRef);
  const apply = (m, p) => [0, 1, 2].map((r) => m.a[r * 3] * p[0] + m.a[r * 3 + 1] * p[1] + m.a[r * 3 + 2] * p[2] + m.t[r]);
  const invA = (m) => { const a = m.a; const det = a[0] * (a[4] * a[8] - a[5] * a[7]) - a[1] * (a[3] * a[8] - a[5] * a[6]) + a[2] * (a[3] * a[7] - a[4] * a[6]);
    const i = [(a[4] * a[8] - a[5] * a[7]) / det, -(a[1] * a[8] - a[2] * a[7]) / det, (a[1] * a[5] - a[2] * a[4]) / det, -(a[3] * a[8] - a[5] * a[6]) / det, (a[0] * a[8] - a[2] * a[6]) / det, -(a[0] * a[5] - a[2] * a[3]) / det, (a[3] * a[7] - a[4] * a[6]) / det, -(a[0] * a[7] - a[1] * a[6]) / det, (a[0] * a[4] - a[1] * a[3]) / det];
    return { a: i, t: [0, 1, 2].map((r) => -(i[r * 3] * m.t[0] + i[r * 3 + 1] * m.t[1] + i[r * 3 + 2] * m.t[2])) }; };
  const pre = invA(rest);
  let oldWorst = 0;
  for (let v = 0; v < n; v++) {
    const p = apply(idle, apply(pre, [G[v * 3], G[v * 3 + 1], G[v * 3 + 2]]));
    oldWorst = Math.max(oldWorst, Math.hypot(p[0] - idleBody[v * 3], p[1] - idleBody[v * 3 + 1], p[2] - idleBody[v * 3 + 2]));
  }
  assert.ok(oldWorst > 10, `a Chest-node attach tears away from the body in the idle (${oldWorst.toFixed(1)} units) - the MW-BRIG1 defect`);
});

test('MW-BRIG2: across two body parts, a triangle keeps to one skin, and a rigid part is a one-bone skin', () => {
  const skeleton = buildSkeleton(parseNif(skeletonBytes()));
  const body = skinnedBody(skeleton);
  // A RIGID "groin" part at the Groin node: its skin is that bone alone, landing where the rigid path draws it.
  const groinRef = skeleton.byName.get('groin');
  const rigid = { name: '', positions: Float32Array.from([-6, 0, -10, 6, 0, -10, 0, 4, -14]), indices: Uint16Array.from([0, 1, 2]) };
  const asSkin = sourceSkin(rigid, { attachRef: groinRef });
  const { pose, mats } = poseOf(skeleton, null);
  const drawn = skinned(asSkin, skeleton, null);
  const at = mats.get(groinRef);
  for (let v = 0; v < 3; v++) {
    const p = [0, 1, 2].map((r) => at.a[r * 3] * rigid.positions[v * 3] + at.a[r * 3 + 1] * rigid.positions[v * 3 + 1] + at.a[r * 3 + 2] * rigid.positions[v * 3 + 2] + at.t[r]);
    for (let c = 0; c < 3; c++) assert.ok(Math.abs(p[c] - drawn[v * 3 + c]) < 1e-4, 'a rigid part as a skin lands where the rigid path puts it');
  }
  // mirrored on a Left bone, x negated first (rule 13)
  const m = skinned(sourceSkin(rigid, { attachRef: groinRef, mirrored: true }), skeleton, null);
  const pm = [0, 1, 2].map((r) => at.a[r * 3] * 6 + at.a[r * 3 + 1] * 0 + at.a[r * 3 + 2] * -10 + at.t[r]);
  for (let c = 0; c < 3; c++) assert.ok(Math.abs(pm[c] - m[c]) < 1e-4, 'the mirror is folded into the bind');
  // A garment spanning both: each of its triangles goes to ONE source, none is split.
  const restBody = skinned(body, skeleton, null);
  const top = [restBody[0], restBody[1], restBody[2] + 0.5, restBody[3], restBody[4], restBody[5] + 0.5, restBody[36], restBody[37], restBody[38] + 0.5];
  const bot = Array.from(drawn).map((x, i) => (i % 3 === 2 ? x - 0.5 : x));
  const garment = { name: 'g', positions: Float32Array.from([...top, ...bot]), uvs: null, indices: Uint16Array.from([0, 1, 2, 3, 4, 5]) };
  const parts = transferSkin(garment, [body, asSkin], { skeleton, pose, mats, skinBatch });
  assert.equal(parts.length, 2, 'one sub-batch per skin a triangle landed on');
  assert.deepEqual(parts.map((p) => p.indices.length), [3, 3]);
  assert.deepEqual(parts[1].skin.bones.map((b) => b.ref), [groinRef], 'the rigid part\'s triangle carries its one bone');
  assert.deepEqual(transferSkin(garment, [], { skeleton, pose, mats, skinBatch }), [], 'no body, no garment');
});

test('MW-BRIG2: through the binder - a skinned-from-body part is drawn skinned, and with no body it is not drawn', async () => {
  // A rigid chest body at "Chest" (the binder takes it as rules 12-14 do) and the garment fitted 1 unit over it.
  const body = meshToNif({ name: 'body', positions: [-5, 0, 0, 5, 0, 0, 0, 0, 8], normals: null, uvs: null, indices: [0, 1, 2] }, { node: 'Body' });
  const skel = buildSkeleton(parseNif(skeletonBytes()));
  const { mats } = poseOf(skel, null);
  const at = mats.get(skel.byName.get('chest'));
  const fitted = [[-5, 0, 0], [5, 0, 0], [0, 0, 8]].map((p) => [0, 1, 2].map((r) => at.a[r * 3] * p[0] + at.a[r * 3 + 1] * p[1] + at.a[r * 3 + 2] * (p[2]) + at.t[r] + (r === 1 ? 1 : 0)));
  const garment = meshToNif({ name: 'Brigandine', positions: fitted.flat(), normals: null, uvs: [0, 0, 1, 0, 0, 1], indices: [0, 1, 2] }, { texture: 'x.dds', node: 'Brigandine' });
  const part = { slot: 'cuirass (daggerfall_brigandine_steel)', partName: 'cuirass', bones: ['chest'], bytes: garment, skinFrom: [{ slot: 'chest', bones: ['chest'], bytes: body }] };
  const asm = await assembleFirstPersonArm({ skeletonBytes: skeletonBytes(), parts: [{ slot: 'chest', bones: ['chest'], bytes: body }, part] });
  assert.ok(asm.ok, asm.error);
  const piece = asm.pieces.find((p) => p.slot === part.slot);
  const bodyPiece = asm.pieces.find((p) => p.slot === 'chest');
  assert.equal(piece.kind, 'skinned', 'drawn by skinBatch, the body\'s own door');
  for (let v = 0; v < 3; v++) for (let c = 0; c < 3; c++) assert.ok(Math.abs(piece.positions[v * 3 + c] - fitted[v][c]) < 1e-3, 'at rest, where it was fitted');
  poseAssembly(asm, { tracks: IDLE.tracks, sampleTrack: IDLE.sampleTrack, time: 0 });
  for (let v = 0; v < 3; v++) {
    const d = Math.hypot(...[0, 1, 2].map((c) => piece.positions[v * 3 + c] - bodyPiece.positions[v * 3 + c]));
    assert.ok(Math.abs(d - 1) < 1e-3, `posed, the garment keeps its 1-unit gap to the body (${d.toFixed(4)})`);
  }
  // No body to skin from: a note, and nothing drawn - never a garment floating free.
  const lone = await assembleFirstPersonArm({ skeletonBytes: skeletonBytes(), parts: [{ slot: 'chest', bones: ['chest'], bytes: body }, { ...part, skinFrom: [] }] });
  assert.equal(lone.pieces.filter((p) => p.slot === part.slot).length, 0);
  assert.ok(lone.notes.some((s) => /no body part to skin it from/.test(s)), lone.notes.join('; '));
});

test('MW-BRIG2: the item - the Steel Brigandine Jerkin, one piece worn as a cuirass, skinned from chest, groin, thighs and knees', () => {
  assert.equal(RRI_TEMPLATES.find((t) => t.index === RRI_JERKIN_TEMPLATE)?.name, 'Jerkin');
  assert.equal(rriVariantWord(STEEL_JERKIN), 'Brigandine ');
  for (const [name, m] of Object.entries(ARMOR_MATERIAL)) {
    if (m === ARMOR_MATERIAL.Steel) continue;
    assert.equal(ownArmorModelFor({ templateIndex: RRI_JERKIN_TEMPLATE, material: m }), null, `${name} jerkin keeps its retail cuirass`);
  }
  // MW-STEEL1: the classic Steel Cuirass wears Mac's steel plate now (mwsteel1.test.js) - its own model, never the brigandine
  assert.equal(ownArmorModelFor({ templateIndex: 102, material: ARMOR_MATERIAL.Steel })?.id, 'daggerfall_steel_cuirass', 'the classic Steel Cuirass is the steel plate\'s, not the brigandine\'s');
  const worn = composeWornArmor({ pieces: [STEEL_JERKIN], armors: [], bodyPool: [] });
  assert.deepEqual(worn.notes, []);
  assert.deepEqual(worn.adds.map((a) => [a.partName, a.bones.join(), a.model, [...a.skinFrom].join()]), [['cuirass', 'chest', 'brigandine_steel.nif', 'chest,groin,upperleg,knee']]);
  assert.deepEqual(worn.shadows, ['chest']);
  assert.equal(OWN_MW_ARMOR.every((a) => !('restPose' in a)), true, 'no rest-pose attach left');
  for (const path of ownArmorModelPaths()) {
    assert.ok(existsSync(new URL(`../src/assets/mw/${path}`, import.meta.url)), `${path} ships`);
    assert.equal(ownMwDataPath(`../assets/mw/${path}`), path);
  }
  assert.ok(itemMapCoverage().some((c) => c.kind === 'own' && c.own === 'ownArmorModels' && c.material === 'Steel'));
  // The build loads the body under it - shadowed or not - and hands it to the binder with the part, through
  // ownBodyPaths and ownBodyPart (MW-STEEL4: the third person's alone - no model skinned from the body reaches the first).
  const fp = sourceText('src/combat/fpArm.js');
  assert.match(fp, /  return \(add\.skinFrom \?\? \[\]\)\.flatMap\(\(slot\) => rows\n/);
  assert.match(fp, /const bodyUnder = \(add\) => ownBodyPaths\(add, rows\);/);
  assert.match(fp, /\.\.\.worn\.adds\.flatMap\(bodyUnder\)\.map\(\(b\) => b\.path\),   \/\/ MW-BRIG2/);
  assert.match(fp, /\.\.\.ownBodyPart\(row, rows, find\) \}\);/);
  assert.match(fp, /if \(!add\.skinFrom\) return \{\};\n  return \{\n    skinFrom: ownBodyPaths\(add, rows\)\.map\(\(b\) => \(\{ slot: b\.slot, bytes: find\(b\.path\)\?\.get\(b\.path\)\?\.slice\(\) \}\)\)\.filter\(\(b\) => b\.bytes\),/);
});

test('MW-BRIG2: the shipped files are re-made from the committed sources, byte for byte, and read back', () => {
  for (const [bytes, path] of [[baked.nif, OUT.mesh], [baked.dds, OUT.texture]]) {
    assert.equal(Buffer.compare(Buffer.from(bytes), Buffer.from(onDisk(path))), 0, `${path} is not what tools/bakeBrigandine.mjs makes - re-run it`);
  }
  const sha = (p) => createHash('sha256').update(onDisk(p)).digest('hex');
  assert.equal(sha(SOURCE_FBX), 'baa21240f2e38ca408531ef28efc951639279cde9ff0879953a00ee993aec36a');
  assert.equal(sha(SOURCE_PNG), 'cde8d2b8870dbb35833329e39d43ac7914f45d60dbf1791309f81cc44159a51c');
  assert.deepEqual(baked.mesh.bake.sceneTranslation, [0, 0, 64]);
  assert.equal(baked.mesh.bake.clipped, 6);
  const batches = flattenNif(parseNif(onDisk(OUT.mesh)));
  assert.equal(batches.length, 1);
  assert.equal(batches[0].material.twoSided, true);
  for (let i = 0; i < baked.mesh.positions.length; i++) assert.ok(Math.abs(batches[0].positions[i] - baked.mesh.positions[i]) < 1e-4);
  const files = new Map([[`textures/${TEXTURE_NAME}`, onDisk(OUT.texture)]]);
  const entry = collectArmTextures(batches, [{ has: (p) => files.has(p), get: (p) => files.get(p) }]).get(TEXTURE_NAME);
  assert.ok(entry?.ok, entry?.error);
  const png = readPng(raw(SOURCE_PNG));
  assert.deepEqual(Array.from(decodeTextureImage(OUT.texture, onDisk(OUT.texture)).mips[0].rgba), Array.from(png.data), 'the DDS is the PNG');
  // the six concave faces clip exactly
  const geo = nodeAt(readFbx(raw(SOURCE_FBX)).nodes, 'Objects', 'Geometry');
  const V = childNamed(geo, 'Vertices').props[0];
  let clipped = 0;
  for (const poly of polygonsOf(childNamed(geo, 'PolygonVertexIndex').props[0])) {
    const pts = poly.map((i) => [V[i * 3], V[i * 3 + 1], V[i * 3 + 2]]);
    if (pts.length > 3 && !isConvexPolygon(pts)) { assert.equal(earClip(pts).length, pts.length - 2); clipped++; }
  }
  assert.equal(clipped, 6);
});
