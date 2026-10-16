// MW-HEADS1 (2026-10-13, the owner: "Everything we are doing is for the morrowwind model. This batch is for breton";
// asked, every Breton man wears them): THE PORT'S OWN HEADS - THE BRETON MEN'S THREE HEADS AND THREE HAIRS.
//
// One export of three objects, each a face and a hair in two paintings; baked into six rigid parts in the head's own
// frame (the source head's, which all three share), each painting held to the name the export gives its material; every
// hair over every head's scalp; the Breton men's pools wherever a face is chosen - the NPC walk, the curated table (the
// ten portraits, portrait 6 the eyepatch), the measured match - and every other race and sex the data's; and (AUDIT
// MW-HEADS1) only where the archives carry them: a page whose own archive did not load draws the data's, never none.
// MW-HEADS2 (2026-10-15, the owner: "some of the ingame heads are backwards on the body and omly the player Britons
// should recieve the new heads, not npcs"): baked turned half round about the crown (the face on -Y), and the port's
// own a player's alone - asked for (`own`, `ownHeads`); an NPC's walk, and every body not a player's, the data's.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { parseNif } from '../../src/formats/morrowind/mwNifFile.js';
import { flattenNif } from '../../src/formats/morrowind/mwNifMesh.js';
import { decodeTextureImage } from '../../src/formats/morrowind/mwTexture.js';
import { assembleFirstPersonArm, facePools, playerBodyRows, bodyParts, curatedAnswersFace } from '../../src/formats/morrowind/mwFirstPerson.js';
import { buildFpArm } from '../../src/combat/fpArm.js';
import { OWN_HEADS, ownFacePools, ownHeadModelPaths } from '../../src/characters/ownModels/ownHeadModels.js';
import { npcFaceOf, npcHint } from '../../src/characters/wardrobe.js';
import FACE_TABLE from '../../src/formats/mwFaceTable.json' with { type: 'json' };
import { readPng } from '../../tools/pngIO.mjs';
import { readFbx } from '../../tools/fbxRead.mjs';
import { meshModelNames } from '../../tools/fbxStrip.mjs';
import { bakeMesh, objectMaterials, basisMap } from '../../tools/fbxMesh.mjs';
import { objectTree, BOX_SLACK, SCENE_BODY } from '../../tools/bakeSteelPlate.mjs';
import { SOURCES, PAINTINGS, HEAD_PARTS, HEAD_FORWARD, HEAD_UP, bakeHeads, meshFile, partFrame, partMesh, textureFile, textureName } from '../../tools/bakeHeads.mjs';
import { retailSkeleton } from '../fixtures/mw/retailRig.mjs';
import { bodyRec, retailBodyDeps, shippedArchive } from '../fixtures/mw/bodyRig.mjs';

const raw = (p) => readFileSync(new URL(`../../${p}`, import.meta.url));
const onDisk = (p) => new Uint8Array(raw(p));
const sha = (p) => createHash('sha256').update(raw(p)).digest('hex');
const tree = readFbx(raw(SOURCES.breton));
const nifOf = (id) => flattenNif(parseNif(onDisk(meshFile(id))));
const HEADS = ['breton_m_head_h04', 'breton_m_head_h0411', 'breton_m_head_h0423'];
const HAIRS = ['breton_m_hair_01', 'breton_m_hair_0111', 'breton_m_hair_widow'];
/** Each part's polygons, as the export carries them on its material (the object's other picture's never baked in). */
const POLYGONS = { breton_m_head_h04: 1060, breton_m_hair_widow: 298, breton_m_head_h0411: 532, breton_m_hair_01: 302, breton_m_head_h0423: 502, breton_m_hair_0111: 390 };
const rd = (p) => raw(p).toString('utf8');
const cat = (...a) => { const out = new Uint8Array(a.reduce((n, b) => n + b.length, 0)); let o = 0; for (const b of a) { out.set(b, o); o += b.length; } return out; };
/** Is a Data Files path one the port ships (`src/assets/mw/` is that tree - systems/ownMwAssets.js)? */
const shipped = (p) => existsSync(new URL(`../../src/assets/mw/${p}`, import.meta.url));

test('MW-HEADS1: every head and hair re-made from the committed export and its six paintings byte for byte, each DDS its painting; the export the owner\'s as it came, each painting under the name the export gives its material', () => {
  const baked = bakeHeads({ sources: { breton: raw(SOURCES.breton) }, pngs: Object.fromEntries(Object.entries(PAINTINGS).map(([id, p]) => [id, raw(p)])) });
  assert.deepEqual(baked.parts.map((p) => p.id), ['breton_m_head_h04', 'breton_m_hair_widow', 'breton_m_head_h0411', 'breton_m_hair_01', 'breton_m_head_h0423', 'breton_m_hair_0111']);
  for (const p of baked.parts) {
    assert.equal(Buffer.compare(Buffer.from(p.nif), raw(meshFile(p.id))), 0, `${meshFile(p.id)} is not what tools/bakeHeads.mjs makes - re-run it`);
    assert.deepEqual(nifOf(p.id).map((b) => b.material.textureFile), [textureName(p.id)]);
  }
  for (const t of baked.textures) {
    assert.equal(Buffer.compare(Buffer.from(t.dds), raw(textureFile(t.id))), 0, `${textureFile(t.id)} is not what the bake makes`);
    assert.deepEqual(Array.from(decodeTextureImage(textureFile(t.id), onDisk(textureFile(t.id))).mips[0].rgba), Array.from(readPng(raw(PAINTINGS[t.id])).data), `the ${t.id} DDS is its painting`);
  }
  assert.deepEqual(baked.textures.map((t) => [t.id, t.png.width, t.png.height]), [['breton_m_head_h04', 256, 128], ['breton_m_hair_widow', 128, 128],
    ['breton_m_head_h0411', 256, 128], ['breton_m_hair_01', 128, 128], ['breton_m_head_h0423', 256, 128], ['breton_m_hair_0111', 128, 128]]);
  assert.equal(sha(SOURCES.breton), '657dfa95cb607b00f9fb786fad389e0aae7390e8ccf6934ecbc7a47ada009b18', 'daggerwind.fbx as it came');
  assert.deepEqual(meshModelNames(raw(SOURCES.breton)), ['b_n_breton_m_hair_widow', 'b_n_breton_m_head_05.002', 'b_n_breton_m_head_05.003']);
  // each painting as sent, under the part its export names it for (matched by what it is drawn for - Own-Heads.md)
  // PIN MOVED (MW-HEADS3 - the export's author: "its using the eyepatch on the wrong head"): the eyepatch's painting is
  // h0411's, the plain brown beard h0423's - the two files' names swapped, their bytes as sent
  assert.deepEqual(Object.fromEntries(Object.entries(PAINTINGS).map(([id, p]) => [id, sha(p).slice(0, 16)])), {
    breton_m_head_h04: '0dce24bce8854284', breton_m_head_h0411: '942fc18546e33b15', breton_m_head_h0423: '2761ddc06d78ec16',
    breton_m_hair_widow: 'e81078936d780b3d', breton_m_hair_01: '0bb984ce708a59e4', breton_m_hair_0111: 'feafc235bc1cb8e6',
  });
  assert.deepEqual(['b_n_breton_m_hair_widow', 'b_n_breton_m_head_05.002', 'b_n_breton_m_head_05.003'].map((o) => objectMaterials(tree, o)), [
    ['tx_b_n_breton_m_hair_widow.png', 'tx_b_n_breton_m_h04.png'], ['tx_b_n_breton_m_h0411.png', 'tx_b_n_breton_m_hair01.png'], ['tx_b_n_breton_m_h0423.png', 'tx_b_n_breton_m_hair0111.png'],
  ]);
  for (const p of HEAD_PARTS) assert.equal(objectMaterials(tree, p.object)[p.material], p.texture, `${p.id}: the material the export paints ${p.texture}`);
  assert.throws(() => partMesh(tree, { ...HEAD_PARTS[0], material: 0 }), /wears "tx_b_n_breton_m_hair_widow\.png" in material 0, not tx_b_n_breton_m_h04\.png/, 'a material read as another picture is refused');
  // PIN MOVED (MW-HEADS2): the boxes the turned frame reads
  assert.throws(() => partMesh(tree, { ...HEAD_PARTS[0], box: [[-4.78, -8.28, -7.89], [4.78, 6.95, 7.66]] }), /not where it was read/, 'a part off its box is refused');
  assert.throws(() => partMesh(tree, { ...HEAD_PARTS[0], box: [HEAD_PARTS[0].box[0], [4.78, 6.95, 8.66]] }), /not where it was read/, 'on either side of it - a crown a unit higher');
  assert.deepEqual(ownHeadModelPaths(), [...HEADS, ...HAIRS].map((id) => `meshes/${id}.nif`), 'every part the pools hold, and no other');
  for (const path of ownHeadModelPaths()) assert.ok(shipped(path), `${path} ships`);
});

test('MW-HEADS1: each part one rigid shape of its own material, in the head\'s own frame - the object\'s scene placement taken back off, nothing re-centred; the three faces share the source head\'s crown, sides and back; the owner\'s scene stood them where MW-STEEL5 read the game\'s head', () => {
  for (const p of HEAD_PARTS) {
    const [b, ...more] = nifOf(p.id);
    assert.equal(more.length, 0, `${p.id}: one shape`);
    assert.equal(b.skinned, false, `${p.id}: a rigid part, hung under the Head node as a retail head is`);
    // PIN MOVED (MW-HEADS2): the scene turned half round about its crown, and its translation with it
    assert.deepEqual([HEAD_FORWARD, HEAD_UP], ['-y', '+z']);
    const scene = bakeMesh(objectTree(tree, p.object), { name: p.id, placement: 'scene', forward: HEAD_FORWARD, up: HEAD_UP, material: p.material });
    const t = basisMap(HEAD_FORWARD, HEAD_UP)(scene.bake.sceneTranslation);
    let worst = 0;
    for (let k = 0; k < b.positions.length; k++) worst = Math.max(worst, Math.abs(b.positions[k] - (scene.positions[k] - t[k % 3])));
    assert.ok(worst < 1e-4, `${p.id}: the scene's placement, its translation taken off (worst ${worst})`);
    assert.equal(scene.bake.material, p.material);
    assert.equal(scene.bake.polygons, POLYGONS[p.id], `${p.id}: its material's polygons, and none of the other's`);
    const { min, max } = partFrame(scene).bounds;
    for (let k = 0; k < 3; k++) assert.ok(Math.abs(min[k] - p.box[0][k]) <= BOX_SLACK && Math.abs(max[k] - p.box[1][k]) <= BOX_SLACK, `${p.id}: read where its box says`);
  }
  // one frame between the three faces - the same crown, sides and back, though h04's is another mesh
  const faces = HEAD_PARTS.filter((p) => p.slot === 'head');
  for (const p of faces) {
    assert.equal(p.box[1][2], 7.66, `${p.id}: the crown`); assert.deepEqual([p.box[0][0], p.box[1][0]], [-4.78, 4.78], `${p.id}: the sides`);
    assert.equal(p.box[1][1], 6.95, `${p.id}: the back - behind the face, on +Y (MW-HEADS2)`);
  }
  assert.deepEqual(faces.map((p) => nifOf(p.id)[0].positions.length / 3), [616, 296, 290], 'three meshes');
  // UPRIGHT, FACING -Y, ABOUT THE SOURCE HEAD'S ORIGIN (AUDIT MW-HEADS1 L1-F8; PIN MOVED, MW-HEADS2): in each face's
  // frame the crown is its topmost point on the middle line, the nose its farthest forward under it, the chin its lowest,
  // ahead of the crown - the frame the export's source head carries, turned half round about the crown. The game's "Head"
  // node is not in the tree (test/fixtures/mw/retailRig.mjs hangs every part node at zero); the first bake faced +Y, and
  // in game the face hung backwards on the body (the owner, 2026-10-15) - Own-Heads.md
  const mark = (id) => {
    const P = nifOf(id)[0].positions; let top = 0, front = 0, low = 0;
    for (let v = 0; v < P.length / 3; v++) {
      if (P[v * 3 + 2] > P[top * 3 + 2]) top = v;
      if (P[v * 3 + 1] < P[front * 3 + 1]) front = v;
      if (P[v * 3 + 2] < P[low * 3 + 2]) low = v;
    }
    const at = (v) => [0, 1, 2].map((k) => +P[v * 3 + k].toFixed(2) + 0);
    return { crown: at(top), nose: at(front), chin: at(low) };
  };
  assert.deepEqual(Object.fromEntries(HEADS.map((id) => [id, mark(id)])), {
    breton_m_head_h04: { crown: [0, 2.17, 7.66], nose: [0, -8.28, -2.84], chin: [0, -5.51, -8.89] },
    breton_m_head_h0411: { crown: [0, 2.17, 7.66], nose: [0, -8.38, -2.59], chin: [0, -6.39, -8.4] },
    breton_m_head_h0423: { crown: [0, 2.17, 7.66], nose: [0, -7.92, -2.74], chin: [0, -6.58, -9.84] },
  });
  // where the owner's scene stood them: 125 over its floor - 3.46 over the T-posed scene's own head (SCENE_BODY), inside
  // the 3.24 to 4.25 MW-STEEL5 read the game drawing a retail head over it (tools/helmLiftProbe.mjs readLift)
  const placed = ['b_n_breton_m_hair_widow', 'b_n_breton_m_head_05.002', 'b_n_breton_m_head_05.003']
    .map((o) => bakeMesh(objectTree(tree, o), { placement: 'scene', forward: '+y', up: '+z' }).bake.sceneTranslation[2]);
  assert.deepEqual(placed, [125, 125, 125]);
  const over = [125 + faces[1].box[0][2] - SCENE_BODY.head.min[2], 125 + faces[1].box[1][2] - SCENE_BODY.head.max[2]];
  for (const d of over) assert.ok(d > 3.24 && d < 4.25, `the source head stands ${d.toFixed(2)} over the scene's`);
});

test('MW-HEADS1: one eyepatch - the one painting whose eyes differ side to side is worn by a layout that reads each side of the face from its own half; h04\'s mirrored layout, which reads both sides from one half, wears a face whose eyes match', () => {
  // the eye band of each face's painting, as the bake maps it (PAINTINGS - its DDS that painting, the first test): how
  // far its left half differs from its mirror image
  const eyeBand = (id) => {
    const { width: W, height: H, data: rgba } = readPng(raw(PAINTINGS[id]));
    let d = 0, m = 0;
    for (let y = Math.floor(0.3 * H); y < Math.floor(0.55 * H); y++) {
      for (let x = Math.floor(0.3 * W); x < W / 2; x++) {
        for (let k = 0; k < 3; k++) { d += Math.abs(rgba[(y * W + x) * 4 + k] - rgba[(y * W + W - 1 - x) * 4 + k]); m++; }
      }
    }
    return d / m;
  };
  // which half of the painting each side of the face reads: the share of one side's vertices left of the middle, and
  // of the other's right of it (a mirrored layout reads both sides from one half) - the sides the source head named
  // (PIN MOVED, MW-HEADS2: the half turn negated x, so its +x side is the frame's -x)
  const halves = (id) => {
    const { positions: P, uvs: UV } = nifOf(id)[0];
    const side = (sgn, left) => { let n = 0, k = 0; for (let v = 0; v < P.length / 3; v++) if (sgn * -P[v * 3] > 1) { n++; if ((UV[v * 2] < 0.5) === left) k++; } return k / n; };
    return [side(1, true), side(-1, false)];
  };
  const band = Object.fromEntries(HEADS.map((id) => [id, eyeBand(id)]));
  // PIN MOVED (MW-HEADS3): the eyepatch is h0411's
  assert.ok(band.breton_m_head_h0411 > 30, `the eyepatch's eyes differ side to side (${band.breton_m_head_h0411.toFixed(1)})`);
  assert.ok(band.breton_m_head_h04 < 12 && band.breton_m_head_h0423 < 12, `the plain faces' eyes match (${band.breton_m_head_h04.toFixed(1)}, ${band.breton_m_head_h0423.toFixed(1)})`);
  for (const id of ['breton_m_head_h0411', 'breton_m_head_h0423']) {
    const [r, l] = halves(id);
    assert.ok(r > 0.85 && l > 0.95, `${id}: each side of the face reads its own half (${r.toFixed(2)}, ${l.toFixed(2)})`);
  }
  const [r04, l04] = halves('breton_m_head_h04');
  assert.ok(r04 > 0.85 && l04 < 0.15, `h04's layout is mirrored - both sides read one half (${r04.toFixed(2)}, ${l04.toFixed(2)})`);
  // so no face whose eyes differ is worn where both sides read one half: one patch, never two
  for (const id of HEADS) {
    const [r, l] = halves(id);
    if (band[id] > 20) assert.ok(r > 0.85 && l > 0.95, `${id}: a one-sided face on a layout that shows it once`);
  }
});

test('MW-HEADS1: every hair sits on every head - no vertex of a scalp stands outside any of the three hairs', () => {
  const tris = (b) => { const out = []; for (let i = 0; i < b.indices.length; i += 3) out.push([0, 1, 2].map((k) => Array.from(b.positions.slice(b.indices[i + k] * 3, b.indices[i + k] * 3 + 3)))); return out; };
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  /** the farthest the ray from the frame's origin along `d` meets a triangle of `T` (0 if none) */
  const reach = (d, T) => {
    let far = 0;
    for (const [a, b, c] of T) {
      const e1 = sub(b, a), e2 = sub(c, a), p = cross(d, e2), det = dot(e1, p);
      if (Math.abs(det) < 1e-12) continue;
      const s = sub([0, 0, 0], a), u = dot(s, p) / det; if (u < 0 || u > 1) continue;
      const q = cross(s, e1), v = dot(d, q) / det; if (v < 0 || u + v > 1) continue;
      const t = dot(e2, q) / det; if (t > far) far = t;
    }
    return far;
  };
  for (const h of HEADS) {
    const P = nifOf(h)[0].positions;
    // the scalp: above the brow (z 2) and behind the face (y -4: the face on -Y, MW-HEADS2) - the hair's to cover
    const scalp = []; for (let i = 0; i < P.length; i += 3) if (P[i + 2] > 2 && P[i + 1] > -4) scalp.push([P[i], P[i + 1], P[i + 2]]);
    assert.ok(scalp.length > 60, `${h}: ${scalp.length} scalp vertices`);
    for (const r of HAIRS) {
      const T = tris(nifOf(r)[0]);
      const out = scalp.filter((p) => { const L = Math.hypot(...p); return reach(p.map((x) => x / L), T) < L - 0.05; });
      assert.equal(out.length, 0, `${h} under ${r}: ${out.length} scalp vertices stand outside the hair`);
    }
  }
});

test('MW-HEADS1: the Breton men\'s pools are the port\'s own wherever a PLAYER\'s face is chosen - the curated ten (portrait 6 the eyepatch), the vampire\'s head over them - and an NPC\'s walk, every body not a player\'s, and every other race and sex the data\'s (MW-HEADS2)', () => {
  const own = ownFacePools('Breton', false);
  assert.deepEqual([own.heads.map((r) => r.id), own.hairs.map((r) => r.id)], [HEADS, HAIRS], 'id order - the walk\'s');
  // AUDIT MW-HEADS1 (L3-F4): each record IS what a BODY record of its id, its mesh, the race and its pool's part reads as
  // (readBodyPart, through bodyParts) - nothing the build could tell from one of the data's
  for (const [pool, part] of [[own.heads, 0], [own.hairs, 1]]) {
    for (const r of pool) assert.deepEqual(r, bodyParts(bodyRec(r.id, `${r.id}.nif`, 'Breton', part))[0], `${r.id}: the BODY record of MW_BODY_PARTS' ${part ? 'hair' : 'head'}`);
  }
  for (const [race, female] of [['Breton', true], ['Nord', false], ['Redguard', false], ['Dark Elf', false]]) assert.equal(ownFacePools(race, female), null, `${race} ${female ? 'women' : 'men'}: none`);
  assert.deepEqual(Object.keys(OWN_HEADS), ['breton']);
  // the data's own Breton heads and hairs - a man's never reached, a woman's still hers, a Nord's his - minted as the
  // data's are, BODY records read by the reader (AUDIT MW-HEADS1 L3-F19)
  const recs = [];
  for (const [race, female] of [['breton', false], ['breton', true], ['nord', false]]) {
    for (let i = 0; i < 4; i++) {
      for (const [slot, part] of [['head', 0], ['hair', 1]]) recs.push(bodyRec(`b_n_${race}_${female ? 'f' : 'm'}_${slot}_0${i}`, `b\\b_n_${race}_${slot}_0${i}.nif`, race, part, { female }));
    }
  }
  recs.push(bodyRec('b_v_breton_m_head_01', 'b\\b_v_breton_m_head_01.nif', 'breton', 0, { vampire: true, notPlayable: true }));
  const data = bodyParts(cat(...recs));
  // PIN MOVED (MW-HEADS2, the owner: "only the player Britons should recieve the new heads, not npcs"): asked for
  assert.deepEqual(facePools(data, 'breton', false, { own: true }), { heads: own.heads, hairs: own.hairs }, 'a Breton man who is a player: the port\'s own, the data\'s ignored');
  // AUDIT MW-HEADS1 (L2-F5): ONLY WHERE THE ARCHIVES CARRY THEM - every one of their meshes in the archives' directory,
  // or the data's pools whole, as before them (a page whose own archive did not load)
  const theirs = { heads: data.filter((p) => p.race === 'breton' && p.slot === 'head' && !p.female && p.playable), hairs: data.filter((p) => p.race === 'breton' && p.slot === 'hair' && !p.female) };
  assert.deepEqual(facePools(data, 'breton', false), theirs, 'not asked - an NPC\'s, any body not a player\'s: the data\'s (MW-HEADS2)');
  assert.deepEqual(facePools(data, 'breton', false, { has: shipped }), theirs, 'not asked, the archives carrying them: still the data\'s');
  assert.deepEqual(facePools(data, 'breton', false, { has: shipped, own: true }), { heads: own.heads, hairs: own.hairs }, 'the archives carry them: the port\'s own');
  assert.deepEqual(facePools(data, 'breton', false, { has: () => false, own: true }), theirs, 'none in the archives: the data\'s');
  assert.deepEqual(facePools(data, 'breton', false, { has: (p) => shipped(p) && p !== 'meshes/breton_m_hair_widow.nif', own: true }), theirs, 'one missing: the data\'s - all or none, so a face never walks a pool short of one');
  const counts = (opts) => playerBodyRows(data, 'breton', false, opts).filter((r) => r.slot === 'head' || r.slot === 'hair').map((r) => r.counts.all);
  assert.deepEqual([counts({ ownHeads: true }), counts({ has: () => false, ownHeads: true }), counts({})], [[3, 3], [4, 4], [4, 4]], 'each row counts the pool it chose among (L2-F7)');
  const [lostHead, lostHair] = ['head', 'hair'].map((sl) => playerBodyRows(data, 'breton', false, { faceIndex: 6, has: () => false, ownHeads: true }).find((r) => r.slot === sl));
  assert.deepEqual([lostHead.record.id, lostHair.record.id], ['b_n_breton_m_head_02', 'b_n_breton_m_hair_02'], 'the curated pair not there: the walk over the data\'s');
  assert.match(lostHead.verdict, /derived \(curated "breton_m_head_h0411" is not in these archives\)$/);
  // the match stands down only where the table answers BOTH halves among the pools (L2-F6): every Breton man's portrait
  // over the port's own; none over the data's; and a table that names one half leaves the other to the match
  assert.deepEqual(Array.from({ length: 10 }, (_, f) => curatedAnswersFace(own, 'Breton', false, f)), Array(10).fill(true));
  assert.equal(curatedAnswersFace(theirs, 'Breton', false, 6), false, 'the curated pair not among the data\'s');
  assert.equal(curatedAnswersFace(own, 'Breton', false, 6, { breton: { male: { 6: { head: 'breton_m_head_h0423' } } } }), false, 'a head and no hair');
  assert.equal(curatedAnswersFace(own, 'Breton', true, 6), false, 'no table for her');
  assert.deepEqual(facePools(data, 'breton', true).heads.map((r) => r.id), ['b_n_breton_f_head_00', 'b_n_breton_f_head_01', 'b_n_breton_f_head_02', 'b_n_breton_f_head_03']);
  assert.deepEqual(facePools(data, 'nord', false).hairs.map((r) => r.id), ['b_n_nord_m_hair_00', 'b_n_nord_m_hair_01', 'b_n_nord_m_hair_02', 'b_n_nord_m_hair_03']);
  const face = (opts) => { const rows = playerBodyRows(data, 'breton', false, opts); return ['head', 'hair'].map((s) => rows.find((r) => r.slot === s)); };
  // the player's ten portraits, curated by eye (bible/04-Characters/Own-Heads.md): each its table's pair, portrait 6 the eyepatch
  // PIN MOVED (MW-HEADS3): the brown beard's portraits on h0423, which wears it now; portrait 6 the eyepatch on h0411 in
  // its own object's hair, the 01 - never the headband ("it gave me the rambo hair")
  const want = { 0: ['h0423', '0111'], 1: ['h0423', 'widow'], 2: ['h04', '01'], 3: ['h04', 'widow'], 4: ['h0423', '0111'],
    5: ['h04', '0111'], 6: ['h0411', '01'], 7: ['h0423', '01'], 8: ['h0423', 'widow'], 9: ['h04', 'widow'] };
  for (let f = 0; f < 10; f++) {
    const [head, hair] = face({ faceIndex: f, ownHeads: true });
    assert.deepEqual([head.record.id, hair.record.id], [`breton_m_head_${want[f][0]}`, `breton_m_hair_${want[f][1]}`], `portrait ${f}`);
    assert.match(head.verdict, /curated$/); assert.match(hair.verdict, /curated$/);
  }
  assert.deepEqual(Object.keys(FACE_TABLE), ['breton']);
  assert.deepEqual(Object.keys(FACE_TABLE.breton.male), ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9']);
  // PIN MOVED (MW-HEADS2): an NPC's face walked off its seed over the DATA's pools - every one of their sixteen pairs
  // reached, and never the port's own (not even were they asked: an NPC is no player)
  const pairs = new Set(Array.from({ length: 300 }, (_, s) => face({ faceIndex: s % 10, walk: npcFaceOf(npcHint(s * 2654435761 >>> 0, 0)) }).map((r) => r.record.id).join()));
  assert.equal(pairs.size, 16, 'four heads times four hairs');
  assert.ok([...pairs].every((p) => /^b_n_breton_m_head_0\d,b_n_breton_m_hair_0\d$/.test(p)), 'the data\'s, every one');
  // a player's portrait not asked as one (an escort's face - ui/hud/hudEscortFaces.js): the data's, the curated pair absent
  const [npcHead] = face({ faceIndex: 6 });
  assert.match(npcHead.record.id, /^b_n_breton_m_head_0\d$/);
  // a Breton vampire's head is the race's vampire head, over his own; his hair his own
  const [vHead, vHair] = face({ faceIndex: 6, vampire: true, ownHeads: true });
  assert.equal(vHead.record.id, 'b_v_breton_m_head_01'); assert.equal(vHair.record.id, 'breton_m_hair_01');
  // a Breton woman: the data's, by her face index (no table for her)
  const her = playerBodyRows(data, 'breton', true, { faceIndex: 5 });
  assert.equal(her.find((r) => r.slot === 'head').record.id, 'b_n_breton_f_head_01');
  // the viewer's face sheet - the page the table is authored against - sheets no race and sex the port's own stand for
  assert.match(rd('src/tools/mwViewer.js'), /\n {6}if \(ownFacePools\(race\.id, female\)\) \{ own\.push\(`\$\{race\.id\} \$\{female \? 'female' : 'male'\}`\); continue; \}\n/);
});

test('MW-HEADS1: through the binder a retail head takes - every head and hair a rigid part under the Head node, unmirrored, its own geometry, no note', async () => {
  const parts = [...HEADS, ...HAIRS].map((id) => ({ slot: id.includes('_hair_') ? 'hair' : 'head', bones: ['head'], bytes: onDisk(meshFile(id)) }));
  const asm = await assembleFirstPersonArm({ skeletonBytes: retailSkeleton(), parts });
  assert.ok(asm.ok, asm.error);
  assert.deepEqual(asm.notes, []);
  assert.equal(asm.pieces.length, 6);
  for (const [i, id] of [...HEADS, ...HAIRS].entries()) {
    const piece = asm.pieces[i];
    assert.deepEqual([piece.kind, piece.bone, piece.mirrored], ['rigid', 'head', false], id);
    assert.deepEqual(Array.from(piece.source), Array.from(nifOf(id)[0].positions), `${id}: its own geometry, in the frame the Head node hangs it in`);
  }
});

/** AUDIT MW-HEADS1 (L2-F5): a Breton man's build deps - the fixture body rig on the retail skeleton (its Head node), the
 *  data's own Breton head and hair, and (`own`) the port's archive as the page serves it. `asked` counts the portrait
 *  reads (the measured match). */
const bretonDeps = ({ own, asked }) => retailBodyDeps({
  asked,
  before: own ? [shippedArchive([...HEADS, ...HAIRS].flatMap((id) => [`meshes/${id}.nif`, `textures/${id}.dds`]))] : [],
  // the data's head and hair: rigid parts a Head node takes (the port's own bytes, at the data's paths)
  files: [['meshes/b/b_n_breton_m_head_01.nif', onDisk(meshFile('breton_m_head_h04'))], ['meshes/b/b_n_breton_m_hair_01.nif', onDisk(meshFile('breton_m_hair_01'))]],
  records: [
    bodyRec('b_br_hand_1st', 'fixture\\armfphand.nif', 'Breton', 5), bodyRec('b_br_forearm_1st', 'fixture\\armfparm.nif', 'Breton', 7),
    bodyRec('b_n_breton_m_hand', 'fixture\\armfphand.nif', 'Breton', 5), bodyRec('b_n_breton_m_upperarm', 'fixture\\armfparm.nif', 'Breton', 8),
    bodyRec('b_n_breton_m_head_01', 'b\\b_n_breton_m_head_01.nif', 'Breton', 0), bodyRec('b_n_breton_m_hair_01', 'b\\b_n_breton_m_hair_01.nif', 'Breton', 1),
  ],
});

test('MW-HEADS1 (AUDIT): a real build - a Breton man wears the port\'s own head and hair where its archive loaded, and the data\'s where it did not, never none; where the curated table answers both halves nothing is measured (mutants: the own pools without their meshes; the match measured anyway)', async () => {
  const built = async (own) => {
    const asked = { n: 0 };
    const res = await buildFpArm({ race: 'Breton', faceIndex: 6, reachSweep: false, ownHeads: own !== 'npc', deps: bretonDeps({ own: !!own, asked }) });   // MW-HEADS2: a player's build asks
    assert.equal(res.third?.ok, true, res.third?.error);
    const row = (slot) => res.third.rows.find((r) => r.slot === slot);
    return { res, asked: asked.n, ids: [row('head').record?.id, row('hair').record?.id], bound: res.third.arm.pieces.filter((p) => p.bone === 'head').map((p) => p.slot) };
  };
  const ownBuilt = await built(true);
  assert.deepEqual(ownBuilt.ids, ['breton_m_head_h0411', 'breton_m_hair_01'], 'portrait 6, curated: the eyepatch (MW-HEADS3)');
  assert.deepEqual(ownBuilt.bound, ['head', 'hair'], 'both bound under the Head node');
  const faceNotes = (b) => b.res.third.notes.filter((n) => /^(head|hair)\b/.test(n));   // (the fixture carries no other skin: its slots' own notes)
  assert.deepEqual(faceNotes(ownBuilt), [], 'no note on the face');
  assert.equal(ownBuilt.asked, 0, 'the curated pair is worn whatever a match would say: no portrait read, nothing measured');
  assert.deepEqual(ownBuilt.res.face.reasons, ['the curated table names both halves - nothing measured']);
  const dataBuilt = await built(false);
  assert.deepEqual(dataBuilt.ids, ['b_n_breton_m_head_01', 'b_n_breton_m_hair_01'], 'no own archive: the data\'s Breton head and hair');
  assert.deepEqual(dataBuilt.bound, ['head', 'hair'], 'and he wears them - before, a head and a hair no archive carried, and none');
  assert.deepEqual(faceNotes(dataBuilt), [], 'no note on the face - none of "is not in your archives"');
  assert.equal(dataBuilt.asked, 1, 'the curated pair is not among these: the match is asked, as it was before the port\'s own');
  // MW-HEADS2: a body that is no player's - its own archive loaded - wears the data's head and hair
  const npcBuilt = await built('npc');
  assert.deepEqual(npcBuilt.ids, ['b_n_breton_m_head_01', 'b_n_breton_m_hair_01'], 'not a player: the data\'s, the port\'s own in the archives or not');
  assert.deepEqual(npcBuilt.bound, ['head', 'hair']);
});

test('MW-HEADS2: the port\'s own heads are a player\'s alone - the local player\'s build and every peer\'s ask for them, the people\'s lanes and an escort\'s face do not; the face-match memo keyed on the pools it measured', async () => {
  const { armBuildOptsOf } = await import('../../src/combat/weapon/weaponRig.js');
  const { peerBuildOpts, playerBuildOpts } = await import('../../src/net/peer/peerBodies.js');
  assert.equal(armBuildOptsOf({ race: 'Breton', gender: 'male', faceIndex: 6, items: [] }).ownHeads, true, 'the local player');
  const look = { race: 'Breton', gender: 'male', faceIndex: 6, items: [] };
  assert.equal(playerBuildOpts(look).ownHeads, true, 'another player');
  assert.equal(peerBuildOpts(look).ownHeads, undefined, 'the people\'s lanes: not asked');
  assert.deepEqual({ ...playerBuildOpts(look), ownHeads: undefined }, { ...peerBuildOpts(look), ownHeads: undefined }, 'and nothing else changed');
  const world = rd('src/scenes/world.js');
  assert.match(world, /peerBodies = new PeerBodies\(\{[^\n]*buildOpts: playerBuildOpts \}\);/, 'the peers\' bodies are players\'');
  assert.equal((world.match(/new PeerBodies\(\{/g) ?? []).length, 2, 'the peers\' and the quest people\'s - the people\'s lanes are npcBodies.js\'s');
  assert.doesNotMatch(rd('src/characters/npcBodies.js'), /playerBuildOpts|ownHeads/, 'the people\'s lanes never ask');
  const heads = rd('src/characters/headPortraits.js');
  assert.match(heads, /faceIndex: Number\.isInteger\(who\.faceIndex\) \? who\.faceIndex : 0, ownHeads: !who\.npc, px, ph,/, 'a player-shaped face asks - an NPC\'s (`npc`) does not');
  assert.match(heads, /skin: o\.skin, ownHeads: o\.ownHeads, px, ph \}\);/, 'a live player as its build');
  assert.doesNotMatch(heads.slice(heads.indexOf('export async function npcHeadImage(')), /ownHeads/, 'an NPC\'s talk-window face never asks');
  assert.match(rd('src/ui/hud/hudEscortFaces.js'), /playerHeadImage\(\{ race, gender, faceIndex: face\.faceIndex \| 0, npc: true \}/, 'an escort is an NPC');
  const fp = rd('src/combat/fpArm.js');
  assert.match(fp, /const fkey = `\$\{gen\}:\$\{race\}:\$\{female \? 'f' : 'm'\}:\$\{faceIndex \| 0\}:\$\{fnv\(measured\)\}`;/, 'a player\'s and an escort\'s verdicts are two');
  assert.match(fp, /vampire: !!vampire, walk: npcFace, ownHeads: !!ownHeads \}\);/, 'the third-person body asks as the build was asked');
});
