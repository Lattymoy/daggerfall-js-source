// MW-STEEL4 (2026-10-07, Mac: "I think the prior session to rig the new steel set on the morrowind model really
// fucked it up. How hard is it to switch it out?", and asked how: "You do it properly"): THE STEEL PLATE RIGGED AS
// RETAIL'S ARMOUR IS.
//
// Every piece ships skinned - weighted at bake time to Morrowind's own Bip01 bones in the pose retail's skins are
// bound in (the vendored skeleton's Tri Shadow), Mac's scene stood on that bind by SCENE_FROM_BIND - and the game
// takes it on the path it takes a retail armour mesh: rebound onto the wearer's skeleton by its bones' names, drawn by
// skinBatch. These pins stand it on retail's own skeleton (test/fixtures/mw/retailRig.mjs): the bind read off the Tri
// Shadow and the scene measured against it; every NIF the shape a retail piece has; through the binder retail's
// armour takes, the bind pose giving back the baked files exactly (Mac's scene, the open helm HELM_LIFT higher since
// MW-STEEL5) and retail's idle standing every piece on the bones it
// covers - the gauntlets on the hanging hands, where MW-STEEL2 stood them out at the shoulders and MW-STEEL3 over the
// helm; posed, each piece riding its bones; the first person's gauntlets by the arm's own bone names; and the rig's
// law, the skin writer and the runtime's having nothing left of MW-STEEL1-3's solve.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseNif } from '../src/formats/mwNifFile.js';
import { flattenNif } from '../src/formats/mwNifMesh.js';
import { buildSkeleton, poseSkeleton, skeletonSpaceMatrices, skinBatch, GRAPH_ROOT } from '../src/formats/mwSkin.js';
import { assembleFirstPersonArm, poseAssembly, shapeMatchesBone } from '../src/formats/mwFirstPerson.js';
import { composeWornArmor, fpWornAdds, ARMO_PART } from '../src/formats/mwItemMap.js';
import { ownBodyPart } from '../src/combat/fpArm.js';
import { ARMOR_MATERIAL } from '../src/systems/armorMaterials.js';
import { OWN_MW_ARMOR } from '../src/characters/ownArmorModels.js';
import { writeNif, skinnedMeshesToNif } from '../tools/nifWrite.mjs';
import { jointWeights, smoothstep, weldGroups } from '../tools/skinWeights.mjs';
import {
  PIECES, PLATE_RIG, SCENE_FROM_BIND, SCENE_BODY, RETAIL_SKELETON, retailBind, plateBind, rigSegments, meshFile, bakeObject, SOURCE,
} from '../tools/bakeSteelPlate.mjs';
import { readFbx } from '../tools/fbxRead.mjs';
import { RETAIL_SKELETON_PATH, RETAIL_SKELETON_BYTES, SHADOW_INVERSE_BINDS, retailSkeleton, bindPoseTracks } from './fixtures/mw/retailRig.mjs';

const raw = (p) => readFileSync(new URL(`../${p}`, import.meta.url));
const sourceText = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const STEEL = ARMOR_MATERIAL.Steel;
const SET = [102, 103, 104, 105, 106, 107, 108].map((templateIndex) => ({ templateIndex, material: STEEL }));
const BIND = plateBind(RETAIL_SKELETON_BYTES);
const trees = { set: readFbx(raw(SOURCE.set)), openHelm: readFbx(raw(SOURCE.openHelm)) };
const sceneMeshes = (id) => { const p = PIECES.find((q) => q.id === id); return p.shapes.map((s) => bakeObject(trees[p.file], s.object, s.box)); };
const nifOf = (id) => parseNif(new Uint8Array(raw(meshFile(id))));
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const apply = (m, p) => [0, 1, 2].map((r) => m.a[r * 3] * p[0] + m.a[r * 3 + 1] * p[1] + m.a[r * 3 + 2] * p[2] + m.t[r]);
const unapply = (m, p) => { const d = sub(p, m.t); return [0, 1, 2].map((c) => m.a[c] * d[0] + m.a[3 + c] * d[1] + m.a[6 + c] * d[2]); };
const segDist = (p, a, b) => { const d = sub(b, a); let t = ((p[0] - a[0]) * d[0] + (p[1] - a[1]) * d[1] + (p[2] - a[2]) * d[2]) / (d[0] * d[0] + d[1] * d[1] + d[2] * d[2]); t = Math.max(0, Math.min(1, t)); return len(sub(p, [a[0] + d[0] * t, a[1] + d[1] * t, a[2] + d[2] * t])); };
const vertsOf = (pieces) => pieces.flatMap((p) => Array.from({ length: p.positions.length / 3 }, (_, i) => [p.positions[i * 3], p.positions[i * 3 + 1], p.positions[i * 3 + 2]]));
const centroid = (vs) => [0, 1, 2].map((k) => vs.reduce((s, v) => s + v[k], 0) / vs.length);

/** The third-person build's own path for the plate: compose, and hand the binder each add as combat/fpArm.js does -
 *  ownBodyPart answering nothing for a piece shipped skinned. */
async function wear({ helmStyle = 'closed', pieces = SET, skeletonBytes = retailSkeleton(), only = null } = {}) {
  const worn = composeWornArmor({ pieces, armors: [], bodyPool: [], helmStyle });
  const adds = only ? only(worn.adds) : worn.adds;
  const parts = adds.map((a) => ({ slot: a.slot, partName: a.partName, bones: a.bones, bytes: new Uint8Array(raw(`src/assets/mw/meshes/${a.model}`)), ...ownBodyPart(a, [], () => null) }));
  const asm = await assembleFirstPersonArm({ skeletonBytes, parts });
  return { worn, asm };
}
const zone = (asm, slot) => asm.pieces.filter((p) => p.slot === slot);
const boneAt = (asm, name) => asm.mats.get(asm.skeleton.byName.get(name.toLowerCase()));

// ── the bind, and the scene on it ───────────────────────────────────────────────────────────────────────────────────

test('MW-STEEL4: the bind is retail\'s own - every bone the Tri Shadow binds at its inverse bind undone, a T-pose, and the scene is it moved by SCENE_FROM_BIND', () => {
  assert.equal(RETAIL_SKELETON, RETAIL_SKELETON_PATH, 'the bake and the pins read the one vendored skeleton');
  const bind = retailBind(RETAIL_SKELETON_BYTES);
  assert.equal(bind.size, 32);
  assert.deepEqual([...bind.keys()].sort(), [...SHADOW_INVERSE_BINDS.keys()].sort());
  for (const [name, ib] of SHADOW_INVERSE_BINDS) {
    const m = bind.get(name);
    for (const p of [[0, 0, 0], [10, 0, 0], [0, 10, 0], [0, 0, 10]]) {
      const back = apply(ib, apply(m, p));
      assert.ok(len(sub(back, p)) < 1e-4, `${name}: the bind undoes its inverse bind`);
    }
  }
  // a T-pose: the arms out level - the hands as high as the shoulders, 46.6 out - where the rest hangs them
  const at = (n) => bind.get(n).t;
  for (const s of ['R', 'L']) {
    assert.ok(Math.abs(at(`Bip01 ${s} Hand`)[2] - at(`Bip01 ${s} UpperArm`)[2]) < 2.5, `${s}: the hand level with the shoulder`);
    assert.ok(Math.abs(Math.abs(at(`Bip01 ${s} Hand`)[0]) - 46.55) < 0.05);
  }
  assert.deepEqual(SCENE_FROM_BIND, [0, 2.5, 98.55]);
  for (const [name, m] of BIND) {
    assert.deepEqual(m.a, Array.from(bind.get(name).a));
    assert.deepEqual(m.t, bind.get(name).t.map((v, k) => v + SCENE_FROM_BIND[k]));
  }
  assert.throws(() => retailBind(retailSkeleton({ shadow: false })), /no skinned "Tri Shadow"/);
});

test('MW-STEEL4: the scene stands on the bind - the forearm\'s bone line through the middle of each cuff, the neck bone in the scene\'s neck, the head bone in its head, the ankle 6.6 over the soles', () => {
  const at = (n) => BIND.get(n).t;
  for (const [id, s] of [['gauntlet_right', 'R'], ['gauntlet_left', 'L']]) {
    const [m] = sceneMeshes(id);
    const fore = at(`Bip01 ${s} Forearm`); const hand = at(`Bip01 ${s} Hand`);
    let slices = 0;
    for (let x = 34; x < 46; x += 1.5) {
      const xs = s === 'R' ? x : -x - 1.5;
      const mn = [Infinity, Infinity]; const mx = [-Infinity, -Infinity]; let n = 0;
      for (let v = 0; v < m.positions.length / 3; v++) {
        if (m.positions[v * 3] < xs || m.positions[v * 3] >= xs + 1.5) continue;
        n++;
        for (const k of [1, 2]) { mn[k - 1] = Math.min(mn[k - 1], m.positions[v * 3 + k]); mx[k - 1] = Math.max(mx[k - 1], m.positions[v * 3 + k]); }
      }
      if (n < 6) continue;
      slices++;
      const t = (xs + 0.75 - fore[0]) / (hand[0] - fore[0]);
      const line = [1, 2].map((k) => fore[k] + (hand[k] - fore[k]) * t);
      assert.ok(Math.abs((mn[0] + mx[0]) / 2 - line[0]) < 0.75 && Math.abs((mn[1] + mx[1]) / 2 - line[1]) < 0.75,
        `${id} at x ${xs}: the cuff is centred ${((mn[0] + mx[0]) / 2 - line[0]).toFixed(2)}, ${((mn[1] + mx[1]) / 2 - line[1]).toFixed(2)} off the forearm`);
    }
    assert.ok(slices >= 5, `${id}: ${slices} slices of the cuff read`);
  }
  const inside = (p, b) => [0, 1, 2].every((k) => p[k] > b.min[k] && p[k] < b.max[k]);
  assert.ok(inside(at('Bip01 Neck'), SCENE_BODY.neck), 'the neck bone stands in the scene\'s neck');
  assert.ok(inside(at('Bip01 Head'), SCENE_BODY.head), 'the head bone stands in the scene\'s head');
  assert.ok(Math.abs((at('Bip01 Neck')[1]) - (SCENE_BODY.neck.min[1] + SCENE_BODY.neck.max[1]) / 2) < 1, 'and mid-neck, front to back');
  for (const [id, s] of [['boot_right', 'R'], ['boot_left', 'L']]) {
    const [m] = sceneMeshes(id);
    assert.ok(Math.abs(at(`Bip01 ${s} Foot`)[2] - m.bounds.min[2] - 6.83) < 0.25, `${id}: the ankle over the sole (${(at(`Bip01 ${s} Foot`)[2] - m.bounds.min[2]).toFixed(2)})`);
  }
});

// ── the files ───────────────────────────────────────────────────────────────────────────────────────────────────────

test('MW-STEEL4: every piece ships skinned, the shape retail\'s armour has - a shape per painting named for its slot, over its own side\'s bones, each inverse bind the bind undone, every vertex\'s weights summing to one', () => {
  const slotOf = { cuirass: 'cuirass', skirt: 'skirt', pauldron_right: 'right pauldron', pauldron_left: 'left pauldron', gauntlet_right: 'right hand', gauntlet_left: 'left hand',
    greave_right: 'right upper leg', greave_left: 'left upper leg', boot_right: 'right foot', boot_left: 'left foot', helm_open: 'hair', helm_closed: 'hair' };
  assert.deepEqual(Object.keys(PLATE_RIG), PIECES.map((p) => p.id));
  for (const p of PIECES) {
    const nif = nifOf(p.id);
    const shapes = nif.records.filter((r) => r?.type === 'NiTriShape');
    assert.equal(shapes.length, p.shapes.length, `${p.id}: a shape per painting`);
    const batches = flattenNif(nif);
    const row = ARMO_PART.find((r) => r.name === slotOf[p.id]);
    const filter = row.name === 'hair' ? 'hair' : row.bones[0];
    const rigBones = new Set(PLATE_RIG[p.id].bones.map((b) => b.name.toLowerCase()));
    const side = /_right$/.test(p.id) ? ' r ' : /_left$/.test(p.id) ? ' l ' : null;
    batches.forEach((b, i) => {
      assert.equal(b.skinned, true, `${p.id}: skinned`);
      assert.equal(b.name, `${PLATE_RIG[p.id].shape} ${i}`);
      assert.ok(shapeMatchesBone(b.name, filter), `${p.id}: "${b.name}" passes rule 15's filter for ${filter}`);
      for (const other of ['right hand', 'left hand', 'right foot', 'chest', 'groin'].filter((f) => f !== filter)) {
        assert.equal(shapeMatchesBone(b.name, other), false, `${p.id}: and no other slot's`);
      }
      assert.deepEqual(Array.from(b.skin.transform.translation), [0, 0, 0]);
      assert.deepEqual(Array.from(b.skin.transform.rotation), [1, 0, 0, 0, 1, 0, 0, 0, 1]);
      const sum = new Float64Array(b.positions.length / 3);
      const count = new Uint8Array(b.positions.length / 3);
      for (const bone of b.skin.bones) {
        assert.ok(rigBones.has(bone.name), `${p.id}: ${bone.name} is one of its rig's bones`);
        if (side) assert.ok(!` ${bone.name} `.includes(side === ' r ' ? ' l ' : ' r '), `${p.id}: ${bone.name} is not the other side's`);
        const m = BIND.get([...BIND.keys()].find((n) => n.toLowerCase() === bone.name));
        const probe = [3, -2, 7];
        assert.ok(len(sub(apply(bone.invBind, apply(m, probe)), probe)) < 1e-4, `${p.id}: ${bone.name}'s inverse bind undoes its bind`);
        bone.indices.forEach((v, k) => { sum[v] += bone.weights[k]; count[v]++; });
      }
      for (let v = 0; v < sum.length; v++) {
        assert.ok(Math.abs(sum[v] - 1) < 1e-5, `${p.id} vertex ${v} weighs ${sum[v]}`);
        assert.ok(count[v] >= 1 && count[v] <= 3, `${p.id} vertex ${v}: ${count[v]} bones`);
      }
    });
  }
  // the helms ride the head alone; the gauntlets reach every finger Morrowind's hand has; the skirt both thighs
  const bonesOf = (id) => flattenNif(nifOf(id)).flatMap((b) => b.skin.bones.map((x) => x.name));
  assert.deepEqual([...new Set(bonesOf('helm_closed'))], ['bip01 head']);
  assert.deepEqual([...new Set(bonesOf('helm_open'))], ['bip01 head']);
  assert.deepEqual([...new Set(bonesOf('gauntlet_right'))].sort(), ['bip01 r finger0', 'bip01 r finger01', 'bip01 r finger1', 'bip01 r finger11', 'bip01 r finger2', 'bip01 r finger21', 'bip01 r forearm', 'bip01 r hand']);
  assert.deepEqual([...new Set(bonesOf('skirt'))].sort(), ['bip01 l thigh', 'bip01 pelvis', 'bip01 r thigh']);
  // the skirt hangs: the pelvis alone at the waist (z 84), the thighs' share growing to 0.7 at the hem (z 64.5)
  const [skirt] = flattenNif(nifOf('skirt'));
  const share = (v, name) => { const b = skirt.skin.bones.find((x) => x.name === name); const k = Array.from(b.indices).indexOf(v); return k < 0 ? 0 : b.weights[k]; };
  let hem = 0; let waist = 0;
  for (let v = 0; v < skirt.positions.length / 3; v++) {
    const z = skirt.positions[v * 3 + 2];
    const legs = 0.7 * smoothstep((84 - z) / (84 - 64.5));
    assert.ok(Math.abs(share(v, 'bip01 l thigh') + share(v, 'bip01 r thigh') - legs) < 1e-3, `the skirt's vertex ${v} (z ${z.toFixed(1)}) swings with the thighs by ${legs.toFixed(3)}`);
    if (legs > 0.6) hem++;
    if (z > 84) { waist++; assert.equal(share(v, 'bip01 pelvis'), 1, `the waist's vertex ${v} rides the pelvis`); }
  }
  assert.ok(hem > 10 && waist > 10, `${hem} hem and ${waist} waist vertices`);
  assert.deepEqual([...new Set(bonesOf('pauldron_left'))].sort(), ['bip01 l clavicle', 'bip01 l upperarm']);
});

// ── through the binder ──────────────────────────────────────────────────────────────────────────────────────────────

test('MW-STEEL4: through the binder retail\'s armour takes - every piece a skinned part on retail\'s skeleton, no note, and in the bind pose each vertex stands exactly where its file puts it - Mac\'s scene, the open helm HELM_LIFT higher (MW-STEEL5; MW-FIT1 left the closed one where Mac put it)', async () => {
  for (const helmStyle of ['closed', 'open']) {
    const { asm, worn } = await wear({ helmStyle });
    assert.ok(asm.ok, asm.error);
    assert.deepEqual(asm.notes, [], 'nothing skipped, nothing unmatched');
    for (const a of worn.adds) {
      const drawn = zone(asm, a.slot);
      // a shape per painting - the closed helm's shell and visor, the cuirass's breastplate and waist band (MW-STEEL5)
      assert.equal(drawn.length, PIECES.find((p) => meshFile(p.id).endsWith(`/${a.model}`)).shapes.length, `${a.slot} is drawn`);
      assert.ok(drawn.every((p) => p.kind === 'skinned'), `${a.slot}: a skinned part, drawn by skinBatch`);
    }
    const { tracks, sampleTrack, frame } = bindPoseTracks(retailSkeleton());
    poseAssembly(asm, { tracks, sampleTrack });
    const offset = frame.map((v, k) => v - SCENE_FROM_BIND[k]);
    let worst = 0; let n = 0;
    for (const p of asm.pieces) {
      for (let i = 0; i < p.positions.length; i += 3, n++) {
        for (let k = 0; k < 3; k++) worst = Math.max(worst, Math.abs(p.positions[i + k] - p.batch.positions[i + k] - offset[k]));
      }
    }
    assert.ok(n > 3000, `${n} vertices`);
    assert.ok(worst < 2e-3, `in the bind every vertex is the scene's, moved by the one frame (worst ${worst})`);
  }
});

test('MW-STEEL4: in retail\'s idle - its rest, the arms hanging, the right leg forward - every piece stands on the bones it covers: the gauntlets on the hanging hands, not out at the shoulders (MW-STEEL2) nor over the helm (MW-STEEL3)', async () => {
  const { asm } = await wear({});
  const B = (n) => boneAt(asm, n).t;
  for (const [slot, s] of [['right hand (daggerfall_steel_gauntlets)', 'R'], ['left hand (daggerfall_steel_gauntlets)', 'L']]) {
    const pieces = zone(asm, slot);
    // the cuff: every vertex the forearm alone carries lies on the forearm, the arm hanging
    let cuff = 0;
    for (const p of pieces) {
      for (const b of p.batch.skin.bones) {
        if (b.name !== `bip01 ${s.toLowerCase()} forearm`) continue;
        b.indices.forEach((v, k) => {
          if (b.weights[k] < 1) return;
          cuff++;
          const d = segDist([p.positions[v * 3], p.positions[v * 3 + 1], p.positions[v * 3 + 2]], B(`Bip01 ${s} Forearm`), B(`Bip01 ${s} Hand`));
          assert.ok(d < 7, `${slot}: a cuff vertex ${d.toFixed(1)} off the forearm`);
        });
      }
    }
    assert.ok(cuff > 100, `${slot}: ${cuff} cuff vertices`);
    const c = centroid(vertsOf(pieces));
    assert.ok(len(sub(c, B(`Bip01 ${s} Hand`))) < 8, `${slot}: on the hand, ${len(sub(c, B(`Bip01 ${s} Hand`))).toFixed(1)} off it`);
    assert.ok(len(sub(c, B(`Bip01 ${s} UpperArm`))) > 25, `${slot}: not at the shoulder (MW-STEEL2's T-pose)`);
    assert.ok(c[2] < B('Bip01 Neck')[2] - 25, `${slot}: nowhere near the helm (MW-STEEL3's V)`);
    assert.ok(Math.sign(c[0]) === (s === 'R' ? 1 : -1), `${slot}: on its own side`);
  }
  // the helm on the head, the boots on the feet, the greaves on the thighs, the pauldrons on the shoulders, the
  // breastplate on the chest
  const near = (slot, from, to, within) => {
    const c = centroid(vertsOf(zone(asm, slot)));
    const d = segDist(c, B(from), B(to));
    assert.ok(d < within, `${slot}: ${d.toFixed(1)} off ${from} - ${to}`);
  };
  const helm = vertsOf(zone(asm, 'hair (daggerfall_steel_helm)'));
  const head = B('Bip01 Head');
  assert.ok([0, 1, 2].every((k) => Math.min(...helm.map((v) => v[k])) < head[k] && Math.max(...helm.map((v) => v[k])) > head[k]), 'the head bone inside the helm');
  near('right foot (daggerfall_steel_boots)', 'Bip01 R Calf', 'Bip01 R Foot', 4);
  near('left foot (daggerfall_steel_boots)', 'Bip01 L Calf', 'Bip01 L Foot', 4);
  near('right upper leg (daggerfall_steel_greaves)', 'Bip01 R Thigh', 'Bip01 R Calf', 4);
  near('left upper leg (daggerfall_steel_greaves)', 'Bip01 L Thigh', 'Bip01 L Calf', 4);
  near('right pauldron (daggerfall_steel_right_pauldron)', 'Bip01 R UpperArm', 'Bip01 R Forearm', 6);
  near('left pauldron (daggerfall_steel_left_pauldron)', 'Bip01 L UpperArm', 'Bip01 L Forearm', 6);
  near('cuirass (daggerfall_steel_cuirass)', 'Bip01 Spine', 'Bip01 Neck', 4);
  near('skirt (daggerfall_steel_cuirass)', 'Bip01 Pelvis', 'Bip01 Spine', 6);
  // the right leg forward: its boot ahead of the left
  const ahead = centroid(vertsOf(zone(asm, 'right foot (daggerfall_steel_boots)')))[1] - centroid(vertsOf(zone(asm, 'left foot (daggerfall_steel_boots)')))[1];
  assert.ok(ahead > 2, `the right boot steps forward with the leg (${ahead.toFixed(1)})`);
});

test('MW-STEEL4: posed, every piece rides the bones it is weighted to - a vertex one bone carries moves exactly as that bone does; the elbow, the knee, the head and the fingers turned', async () => {
  const { asm } = await wear({});
  const deg = Math.PI / 180;
  const turn = { 'bip01 r forearm': [0, 0, 1, 80], 'bip01 l calf': [0, 0, 1, 50], 'bip01 l thigh': [0, 0, 1, -35], 'bip01 head': [1, 0, 0, 40], 'bip01 r finger1': [0, 0, 1, 60], 'bip01 r finger11': [0, 0, 1, 50] };
  const sk = asm.skeleton;
  const restLocal = (n) => sk.nodes.get(sk.byName.get(n)).rest.rotation;
  const axisRot = ([x, y, z, d]) => { const a = d * deg, c = Math.cos(a), s = Math.sin(a); return [c + x * x * (1 - c), x * y * (1 - c) - z * s, x * z * (1 - c) + y * s, y * x * (1 - c) + z * s, c + y * y * (1 - c), y * z * (1 - c) - x * s, z * x * (1 - c) - y * s, z * y * (1 - c) + x * s, c + z * z * (1 - c)]; };
  const mul3 = (p, q) => [0, 1, 2].flatMap((r) => [0, 1, 2].map((c) => p[r * 3] * q[c] + p[r * 3 + 1] * q[3 + c] + p[r * 3 + 2] * q[6 + c]));
  const quat = (m) => { const w = Math.sqrt(Math.max(0, 1 + m[0] + m[4] + m[8])) / 2; return [w, (m[7] - m[5]) / (4 * w), (m[2] - m[6]) / (4 * w), (m[3] - m[1]) / (4 * w)]; };
  const rots = new Map(Object.entries(turn).map(([n, ax]) => [n, quat(mul3(Array.from(restLocal(n)), axisRot(ax)))]));
  const restMats = new Map(asm.mats);
  const rest = new Map(asm.pieces.map((p) => [p, Float32Array.from(p.positions)]));
  poseAssembly(asm, { tracks: new Map([...rots.keys()].map((k) => [k, k])), sampleTrack: (k) => ({ rotation: rots.get(k) }) });
  const checks = { 'bip01 r forearm': 0, 'bip01 l calf': 0, 'bip01 head': 0, 'bip01 r finger11': 0, 'bip01 l thigh': 0 };
  let worst = 0;
  for (const p of asm.pieces) {
    const weights = new Map();
    for (const b of p.batch.skin.bones) b.indices.forEach((v, k) => { if (!weights.has(v)) weights.set(v, []); weights.get(v).push([b, b.weights[k]]); });
    for (const [v, list] of weights) {
      if (list.length !== 1) continue;
      const [b] = list[0];
      if (!(b.name in checks)) continue;
      const r0 = rest.get(p);
      const want = apply(asm.mats.get(b.ref), unapply(restMats.get(b.ref), [r0[v * 3], r0[v * 3 + 1], r0[v * 3 + 2]]));
      worst = Math.max(worst, len(sub(want, [p.positions[v * 3], p.positions[v * 3 + 1], p.positions[v * 3 + 2]])));
      checks[b.name]++;
    }
  }
  for (const [n, c] of Object.entries(checks)) assert.ok(c > 10, `${c} vertices ride ${n} alone`);
  assert.ok(worst < 1e-3, `each rides its bone exactly (worst ${worst})`);
  const moved = (slot) => zone(asm, slot).some((p) => p.positions.some((x, i) => Math.abs(x - rest.get(p)[i]) > 3));
  for (const slot of ['right hand (daggerfall_steel_gauntlets)', 'left foot (daggerfall_steel_boots)', 'left upper leg (daggerfall_steel_greaves)', 'hair (daggerfall_steel_helm)', 'skirt (daggerfall_steel_cuirass)']) {
    assert.ok(moved(slot), `${slot} moved with the pose`);
  }
});

test('MW-STEEL4: in first person the gauntlets ride the arm\'s own bones by name - on a rig whose arm rests elsewhere, at other refs, each sits on its forearm and hand exactly as on the third person\'s', async () => {
  const gauntlets = [{ templateIndex: 103, material: STEEL }];
  assert.deepEqual(fpWornAdds(composeWornArmor({ pieces: gauntlets, armors: [], bodyPool: [] }).adds).map((a) => a.partName), ['right hand', 'left hand'], 'the first person keeps the gauntlets');
  const turned = (axis, d) => { const a = d * Math.PI / 180, c = Math.cos(a), s = Math.sin(a); const [x, y, z] = axis;
    return [c + x * x * (1 - c), x * y * (1 - c) - z * s, x * z * (1 - c) + y * s, y * x * (1 - c) + z * s, c + y * y * (1 - c), y * z * (1 - c) - x * s, z * x * (1 - c) - y * s, z * y * (1 - c) + x * s, c + z * z * (1 - c)]; };
  const fpRig = retailSkeleton({ extra: ['Camera'], rest: { 'Bip01 R UpperArm': turned([0, 1, 0], 70), 'Bip01 R Forearm': turned([0, 0, 1], 85), 'Bip01 L UpperArm': turned([1, 0, 0], -50) } });
  const local = async (skeletonBytes) => {
    const { asm } = await wear({ pieces: gauntlets, skeletonBytes, only: fpWornAdds });
    assert.deepEqual(asm.notes, [], 'every bone the gauntlets name is on the rig');
    const out = [];
    for (const p of asm.pieces) {
      for (const b of p.batch.skin.bones) {
        const m = asm.mats.get(b.ref);
        b.indices.forEach((v, k) => { if (b.weights[k] === 1) out.push(unapply(m, [p.positions[v * 3], p.positions[v * 3 + 1], p.positions[v * 3 + 2]])); });
      }
    }
    return { out, asm };
  };
  const tp = await local(retailSkeleton());
  const fp = await local(fpRig);
  assert.notEqual(fp.asm.skeleton.byName.get('bip01 r forearm'), tp.asm.skeleton.byName.get('bip01 r forearm'), 'the two rigs\' bones stand at other refs');
  assert.ok(len(sub(boneAt(fp.asm, 'Bip01 R Hand').t, boneAt(tp.asm, 'Bip01 R Hand').t)) > 10, 'and the hand somewhere else');
  assert.equal(fp.out.length, tp.out.length);
  assert.ok(tp.out.length > 300);
  assert.ok(Math.max(...tp.out.map((v, i) => len(sub(v, fp.out[i])))) < 1e-3, 'in each bone\'s own frame, the same gauntlet');
});

// ── the law, the writer, and what is gone ───────────────────────────────────────────────────────────────────────────

test('MW-STEEL4: the rig\'s law - each vertex to the segment it is nearest, a smoothstep across a joint\'s width with the bone on its other side, a bias, a hang from the waist, and a weld weighted once', () => {
  assert.deepEqual([-1, 0, 0.25, 0.5, 1, 2].map(smoothstep), [0, 0, 0.15625, 0.5, 1, 1]);
  const A = { name: 'A', from: [0, 0, 0], to: [10, 0, 0] };
  const B = { name: 'B', from: [10, 0, 0], to: [20, 0, 0], parent: 'A', blend: 2 };
  const at = (...xs) => jointWeights(Float32Array.from(xs.flatMap((x) => [x, 1, 0])), [A, B]);
  assert.deepEqual(at(5, 10, 11, 12.5, 8.5), [
    [['A', 1]],
    [['A', 0.5], ['B', 0.5]],
    [['B', 0.84375], ['A', 0.15625]],
    [['B', 1]],
    [['A', 1 - 0.04296875], ['B', 0.04296875]],
  ]);
  // with no rig parent there is no joint: the nearest bone takes the vertex whole
  assert.deepEqual(jointWeights(Float32Array.from([11, 1, 0]), [A, { ...B, parent: undefined }]), [[['B', 1]]]);
  // a bias claims what another bone's geometry is nearer
  assert.deepEqual(jointWeights(Float32Array.from([5, 1, 0]), [A, { ...B, parent: undefined, bias: 6 }]), [[['B', 1]]]);
  // a weld is weighted once: two vertices at one position, one answer
  const welded = jointWeights(Float32Array.from([11, 1, 0, 11, 1, 0, 4, 1, 0]), [A, B]);
  assert.equal(welded[0], welded[1]);
  assert.deepEqual(weldGroups(Float32Array.from([1, 2, 3, 1, 2, 3.00001, 1, 2, 4])).rep, Int32Array.from([0, 0, 1]));
  // the hang: the root alone at the waist, the legs' share at the hem, divided by the side of the middle
  const hang = { root: 'P', legs: ['L', 'R'], top: 10, bottom: 0, share: 0.7, centre: 4 };
  const legs = [{ name: 'P', from: [0, 0, 10], to: [0, 0, 20] }, { name: 'L', from: [-5, 0, 10], to: [-5, 0, -20] }, { name: 'R', from: [5, 0, 10], to: [5, 0, -20] }];
  const hung = jointWeights(Float32Array.from([0, 0, 12, 8, 0, 0, -8, 0, 0, 0, 0, 0, 2, 0, 5]), legs, { hang });
  assert.deepEqual(hung[0], [['P', 1]]);
  assert.deepEqual(hung[1], [['R', 0.7], ['P', 0.30000000000000004]]);
  assert.deepEqual(hung[2], [['L', 0.7], ['P', 0.30000000000000004]]);
  assert.deepEqual(hung[3], [['L', 0.35], ['R', 0.35], ['P', 0.30000000000000004]], 'heaviest first');
  assert.deepEqual(hung[4].map(([n]) => n), ['P', 'R', 'L']);
  assert.throws(() => jointWeights(Float32Array.from([0, 0, 0]), [{ ...B, parent: 'Z' }]), /blends with "Z"/);
  assert.throws(() => jointWeights(Float32Array.from([0, 0, 0]), []), /no bones/);
  // each piece's rig names bones the bind has, and the bake's segments are where they say
  for (const [id, r] of Object.entries(PLATE_RIG)) {
    const segs = rigSegments(r.bones, BIND);
    for (const s of segs) assert.deepEqual(s.from, BIND.get(s.name).t, `${id}: ${s.name} starts at its origin`);
  }
  const hand = rigSegments(PLATE_RIG.gauntlet_right.bones, BIND).find((s) => s.name === 'Bip01 R Hand');
  assert.deepEqual(hand.to, [0, 1, 2].map((k) => (BIND.get('Bip01 R Finger1').t[k] + BIND.get('Bip01 R Finger2').t[k]) / 2), 'the hand ends at its knuckles');
});

test('MW-STEEL4: a written skin reads back as the reader reads retail\'s - instance, data, bones by name, inverse binds, weights - and skinnedMeshesToNif\'s file is its own bind pose', () => {
  const bytes = writeNif([
    { type: 'NiNode', name: 'Part', children: [1, 5, 6] },
    { type: 'NiTriShape', name: '', data: 2, skin: 3 },
    { type: 'NiTriShapeData', positions: [0, 0, 0, 1, 0, 0, 0, 1, 0], normals: null, uvs: null, indices: [0, 1, 2] },
    { type: 'NiSkinInstance', data: 4, skeletonRoot: 0, bones: [5, 6] },
    { type: 'NiSkinData', transform: { translation: [0, 0, 1] }, bones: [
      { transform: { translation: [-1, -2, -3], scale: 2 }, center: [0.5, 0, 0], radius: 1, indices: [0, 1], weights: [1, 0.25] },
      { transform: { rotation: [0, -1, 0, 1, 0, 0, 0, 0, 1] }, indices: [1, 2], weights: [0.75, 1] },
    ] },
    { type: 'NiNode', name: 'Bip01 R Forearm' },
    { type: 'NiNode', name: 'Bip01 R Hand' },
  ]);
  const nif = parseNif(new Uint8Array(bytes));
  const [batch] = flattenNif(nif);
  assert.equal(batch.skinned, true);
  assert.deepEqual(batch.skin.bones.map((b) => [b.name, Array.from(b.indices), Array.from(b.weights)]), [['bip01 r forearm', [0, 1], [1, 0.25]], ['bip01 r hand', [1, 2], [0.75, 1]]]);
  assert.deepEqual(Array.from(batch.skin.bones[0].invBind.a), [2, 0, 0, 0, 2, 0, 0, 0, 2], 'rotation times scale');
  assert.deepEqual(Array.from(batch.skin.bones[0].invBind.t), [-1, -2, -3]);
  assert.deepEqual(Array.from(batch.skin.bones[1].invBind.a), [0, -1, 0, 1, 0, 0, 0, 0, 1]);
  assert.deepEqual(Array.from(batch.skin.transform.translation), [0, 0, 1]);
  const sk = buildSkeleton(nif);
  const pose = poseSkeleton(sk, null, null, 0, {});
  const out = new Float32Array(9);
  const bound = { ...batch, skin: { ...batch.skin, bones: batch.skin.bones.map((b) => ({ ...b, ref: sk.byName.get(b.name) })), skeletonRoot: GRAPH_ROOT, rootBone: GRAPH_ROOT } };
  skinBatch(bound, sk, pose, skeletonSpaceMatrices(sk, pose, GRAPH_ROOT), out, null);
  assert.deepEqual(Array.from(out.slice(0, 3)), [-1, -2, -2], 'the bind takes the origin to (-1, -2, -3), and the skin\'s own transform lifts it by 1 - rule 20\'s order');
  // skinnedMeshesToNif: shapes first in meshesToNif's own order, a skin after each, the bones last at their binds - so
  // skinned against its own nodes the file gives back what was authored
  const turn = [0, -1, 0, 1, 0, 0, 0, 0, 1];
  const mesh = { name: 'm', positions: Float32Array.from([10, 0, 0, 12, 1, 0, 14, 0, 1]), normals: null, uvs: null, indices: Uint16Array.from([0, 1, 2]) };
  const file = parseNif(new Uint8Array(skinnedMeshesToNif([{ mesh, texture: 't.dds', name: 'Tri Right Hand 0', weights: [[['b1', 1]], [['b1', 0.5], ['b2', 0.5]], [['b2', 1]]] }],
    { node: 'Part', bones: [{ name: 'b0', bind: { a: [1, 0, 0, 0, 1, 0, 0, 0, 1], t: [0, 0, 0] } }, { name: 'b1', bind: { a: turn, t: [10, 0, 0] } }, { name: 'b2', bind: { a: [1, 0, 0, 0, 1, 0, 0, 0, 1], t: [13, 0, 0] } }] })));
  assert.deepEqual(file.records.map((r) => r.type), ['NiNode', 'NiTriShape', 'NiTriShapeData', 'NiMaterialProperty', 'NiTexturingProperty', 'NiStencilProperty', 'NiSourceTexture', 'NiSkinInstance', 'NiSkinData', 'NiNode', 'NiNode']);
  assert.deepEqual(file.records.slice(9).map((r) => r.name), ['b1', 'b2'], 'a bone nothing weights is not written');
  const [fb] = flattenNif(file);
  assert.equal(fb.name, 'Tri Right Hand 0');
  assert.deepEqual(fb.skin.bones.map((b) => b.name), ['b1', 'b2']);
  const fsk = buildSkeleton(file);
  const fpose = poseSkeleton(fsk, null, null, 0, {});
  const got = new Float32Array(9);
  skinBatch({ ...fb, skin: { ...fb.skin, bones: fb.skin.bones.map((b) => ({ ...b, ref: fsk.byName.get(b.name) })), skeletonRoot: GRAPH_ROOT, rootBone: GRAPH_ROOT } }, fsk, fpose, skeletonSpaceMatrices(fsk, fpose, GRAPH_ROOT), got, null);
  assert.ok(Array.from(got).every((v, i) => Math.abs(v - mesh.positions[i]) < 1e-5), `at its own bind it is what was authored: ${Array.from(got)}`);
  assert.throws(() => skinnedMeshesToNif([{ mesh, weights: [[['zz', 1]], [['b1', 1]], [['b1', 1]]] }], { bones: [{ name: 'b1', bind: { a: turn, t: [0, 0, 0] } }] }), /"zz", which is not one of the part's bones/);
});

test('MW-STEEL4: the plate is a part like any retail part - its adds carry nothing for a runtime solve, the build hands the binder its mesh alone, and MW-STEEL1-3\'s fit and bind solve are gone', () => {
  const worn = composeWornArmor({ pieces: SET, armors: [], bodyPool: [], helmStyle: 'open' });
  for (const a of worn.adds) {
    for (const k of ['skinFrom', 'fitTo', 'fit', 'fitFrom', 'solvePose']) assert.equal(k in a, false, `${a.slot} carries no ${k}`);
    assert.deepEqual(ownBodyPart(a, [{ slot: 'chest', record: { model: 'c.nif' } }], () => ({ get: () => Uint8Array.of(1) })), {}, `${a.slot}: the binder gets its mesh alone`);
  }
  for (const own of OWN_MW_ARMOR.filter((o) => o.id.startsWith('daggerfall_steel_'))) {
    assert.deepEqual(Object.keys(own).sort(), ['id', 'material', 'name', 'parts', 'templateIndex', ...(own.styles ? ['styles'] : [])].sort(), `${own.id} is its parts`);
  }
  // the brigandine keeps its runtime skin (MW-BRIG2/3) - the one own model that is not shipped skinned
  const brig = composeWornArmor({ pieces: [{ templateIndex: 520, material: STEEL }], armors: [], bodyPool: [] }).adds[0];
  assert.deepEqual([[...brig.skinFrom], brig.fitTo], [['chest', 'groin', 'upperleg', 'knee'], 'chest']);
  const transfer = sourceText('src/formats/mwSkinTransfer.js');
  assert.deepEqual([...transfer.matchAll(/^export function (\w+)/gm)].map((m) => m[1]), ['sourceSkin', 'fitLift', 'liftBatch', 'transferSkin']);
  const binder = sourceText('src/formats/mwFirstPerson.js');
  for (const gone of ['solvePose', 'solveOn', 'bindPoseMats', 'skeletonBindSkins', 'fitShift', 'rebindSkin', 'skeletonNif']) assert.equal(binder.includes(gone), false, `mwFirstPerson.js: no ${gone}`);
  const fp = sourceText('src/combat/fpArm.js');
  for (const gone of ['tpSkeletonBytes', 'ownFp', 'fitFrom', 'solvePose']) assert.equal(fp.includes(gone), false, `fpArm.js: no ${gone}`);
  assert.match(fp, /partBytes\.push\(\{ slot: add\.slot, partName: add\.partName, bones: add\.bones, bytes: arc\.get\(path\)\.slice\(\) \}\);/, 'the first person\'s adds go to the binder as retail\'s do');
});
