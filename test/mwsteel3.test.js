// MW-STEEL3 (2026-10-07, Mac: "Morrowind integration bugs. I am so tired of us not getting this right", over a
// player's screenshot: the steel gauntlets in a V over the helm, the arms hanging in the robe under them):
// THE BIND'S ANCHOR STANDS IN THE SKELETON'S FRAME.
//
// MW-STEEL2 read the bind pose off the skins (bindPoseMats) and placed each group's root-most bone with its skin's
// axes - a claim that the skin's MESH is authored in the skeleton's frame. The skeleton file's own "Tri Shadow" is;
// a retail body part is not (MW-D21: part-local), and a skin that lists a bone it does not weight - the pelvis, Bip01 -
// won the tie at the anchor, the body's skins coming first, and the whole bind turned with that part's frame.
// Every gauntlet copied the clavicle and stood off the arm. Every MW-STEEL2 pin stood on plateRig.mjs, whose bones are
// unturned and whose skins are authored in the skeleton's frame: the two frames coincided and nothing could tell.
// These pins stand on retail's own hierarchy and Tri Shadow (test/fixtures/mw/retailRig.mjs), its body part-local and
// listing the pelvis, and each fails on the MW-STEEL2 anchor.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseNif } from '../src/formats/mwNifFile.js';
import { buildSkeleton, poseSkeleton, skeletonSpaceMatrices, GRAPH_ROOT } from '../src/formats/mwSkin.js';
import { bindPoseMats, positionBounds } from '../src/formats/mwSkinTransfer.js';
import { affineMul } from '../src/formats/mwAffine.js';
import { assembleFirstPersonArm, poseAssembly, skeletonBindSkins } from '../src/formats/mwFirstPerson.js';
import { composeWornArmor, shadowSkinRows } from '../src/formats/mwItemMap.js';
import { PART_BONES } from '../src/formats/mwNpc.js';
import { ownBodyPart } from '../src/combat/fpArm.js';
import { ARMOR_MATERIAL } from '../src/systems/armorMaterials.js';
import { retailSkeleton, retailBody, bindOf, PART_LOCAL, RETAIL_SKELETON } from './fixtures/mw/retailRig.mjs';

const onDisk = (p) => new Uint8Array(readFileSync(new URL(`../${p}`, import.meta.url)));
const STEEL = ARMOR_MATERIAL.Steel;
const GAUNTLETS = [{ templateIndex: 103, material: STEEL }];
const IDENTITY_FRAME = { a: Float32Array.from([1, 0, 0, 0, 1, 0, 0, 0, 1]), t: [0, 0, 0] };

/** The third-person build's own path (mwsteel2.test.js's wear), on retail's skeleton and a retail-shaped body. */
async function wear({ pieces = GAUNTLETS, body = retailBody(), skeleton = retailSkeleton() } = {}) {
  const worn = composeWornArmor({ pieces, armors: [], bodyPool: [] });
  const files = new Map(body.map((r) => [`meshes/${r.slot}.nif`, r.bytes]));
  for (const a of worn.adds) files.set(`meshes/${a.model}`, onDisk(`src/assets/mw/meshes/${a.model}`));
  const rows = body.map((r) => ({ slot: r.slot, record: { model: `${r.slot}.nif` } }));
  const find = (p) => (files.has(p) ? { get: () => files.get(p) } : null);
  const skin = shadowSkinRows(rows.map((r) => ({ slot: r.slot, bones: PART_BONES[r.slot] ?? [], model: r.record.model })), worn.shadows);
  const parts = [...skin, ...worn.adds].map((row) => ({
    slot: row.slot, partName: row.partName, bones: row.bones, bytes: files.get(`meshes/${row.model}`), ...ownBodyPart(row, rows, find),
  }));
  const asm = await assembleFirstPersonArm({ skeletonBytes: skeleton, parts });
  const bare = await assembleFirstPersonArm({ skeletonBytes: skeleton, parts: rows.map((r) => ({ slot: r.slot, bones: PART_BONES[r.slot], bytes: files.get(`meshes/${r.record.model}`) })) });
  return { asm, bare };
}
const zone = (asm, prefix) => asm.pieces.filter((p) => p.slot.startsWith(prefix));
const flat = (pieces) => Float32Array.from(pieces.flatMap((p) => [...p.positions]));
/** Mean distance from each vertex of `ps` to the nearest of `qs`. */
function meanGap(ps, qs) {
  let sum = 0; let n = 0;
  for (let i = 0; i < ps.length; i += 3, n++) {
    let best = Infinity;
    for (let j = 0; j < qs.length; j += 3) best = Math.min(best, Math.hypot(ps[i] - qs[j], ps[i + 1] - qs[j + 1], ps[i + 2] - qs[j + 2]));
    sum += best;
  }
  return sum / n;
}
/** How many vertices each bone carries, by the influences' own lists (a listed bone with no weight carries none). */
const influences = (pieces) => {
  const out = {};
  for (const p of pieces) for (const b of p.batch.skin.bones) out[b.name] = (out[b.name] ?? 0) + b.weights.filter((w) => w > 0).length;
  return out;
};
/** One side's arm under the gauntlet, drawn bare at the same pose: its forearm, wrist and hand. */
function armOf(bare, side) {
  const all = flat(['forearm', 'wrist', 'hand'].flatMap((s) => zone(bare, s)));
  const out = [];
  for (let i = 0; i < all.length; i += 3) if (side === 'right' ? all[i] > 0 : all[i] < 0) out.push(all[i], all[i + 1], all[i + 2]);
  return out;
}

test('MW-STEEL3: on retail\'s own skeleton, a part-local body listing the pelvis - the gauntlets copy the forearm and the hand, each on its own side, and lie on the hanging arm', async () => {
  const { asm, bare } = await wear();
  for (const side of ['right', 'left']) {
    const g = zone(asm, `${side} hand (`);
    assert.ok(g.length && g.every((p) => p.kind === 'skinned'), `${side}: drawn, skinned`);
    const s = side === 'right' ? 'r' : 'l';
    const inf = influences(g);
    assert.ok((inf[`bip01 ${s} forearm`] ?? 0) + (inf[`bip01 ${s} hand`] ?? 0) > 2 * (inf[`bip01 ${s} upperarm`] ?? 0), `${side}: the forearm and the hand carry it (${JSON.stringify(inf)})`);
    assert.equal(inf[`bip01 ${s} clavicle`] ?? 0, 0, `${side}: nothing of the shoulder - the MW-STEEL2 anchor copied it`);
    const b = positionBounds(g.map((p) => p.positions));
    const mid = (b.min[0] + b.max[0]) / 2;
    assert.ok(side === 'right' ? mid > 5 : mid < -5, `${side}: on its own side of the body (x ${mid.toFixed(1)})`);
    const gap = meanGap(flat(g), armOf(bare, side));
    assert.ok(gap < 5, `${side}: drawn at retail's rest, ON the hanging arm (mean gap ${gap.toFixed(2)})`);
    assert.ok(b.max[2] - b.min[2] > b.max[0] - b.min[0], `${side}: and hangs with it - taller than it is wide`);
    assert.ok(b.max[2] < bindOf('Bip01 Neck').t[2], `${side}: under the neck, never over the helm (top ${b.max[2].toFixed(1)})`);
  }
  assert.ok(asm.notes.some((n) => n.startsWith('right hand (daggerfall_steel_gauntlets): solved in the body\'s bind pose (anchored at Bip01 Pelvis')), asm.notes.join('; '));
});

test('MW-STEEL3: posed by retail\'s turned bones, the gauntlet rides the forearm - a turn of the elbow carries it as it carries the skin under it', async () => {
  const { asm, bare } = await wear();
  const deg = Math.PI / 180;
  const keyed = new Map([['bip01 r forearm', [Math.cos(35 * deg), 0, 0, Math.sin(35 * deg)]]]);
  const pose = { tracks: new Map([...keyed.keys()].map((k) => [k, k])), sampleTrack: (t) => ({ rotation: keyed.get(t) }), time: 0 };
  const before = meanGap(flat(zone(asm, 'right hand (')), armOf(bare, 'right'));
  poseAssembly(asm, pose); poseAssembly(bare, pose);
  const after = meanGap(flat(zone(asm, 'right hand (')), armOf(bare, 'right'));
  assert.ok(after < 5 && Math.abs(after - before) < 0.6, `the gap holds through the pose (${before.toFixed(2)} -> ${after.toFixed(2)})`);
});

test('MW-STEEL3: the frame a body part is authored in moves nothing - the same gauntlet from a part-local body and from one in the skeleton\'s frame, with the Tri Shadow and without it', async () => {
  for (const shadow of [true, false]) {
    const local = await wear({ body: retailBody({ frame: PART_LOCAL }), skeleton: retailSkeleton({ shadow }) });
    const framed = await wear({ body: retailBody({ frame: IDENTITY_FRAME }), skeleton: retailSkeleton({ shadow }) });
    const a = flat(zone(local.asm, 'right hand (')); const b = flat(zone(framed.asm, 'right hand ('));
    const apart = Math.max(meanGap(a, b), meanGap(b, a));
    assert.ok(apart < 0.1, `${shadow ? 'with' : 'without'} the Tri Shadow: the same surface to ${apart.toExponential(1)}`);
    assert.ok(meanGap(a, armOf(local.bare, 'right')) < 5, `${shadow ? 'with' : 'without'} the Tri Shadow: on the arm`);
  }
});

test('MW-STEEL3: bindPoseMats - the skeleton\'s own skin anchors first, whatever a body skin lists; a body skin\'s group stands on its anchor\'s rest', () => {
  const nif = parseNif(onDisk(RETAIL_SKELETON));
  const skeleton = buildSkeleton(nif);
  const rest = skeletonSpaceMatrices(skeleton, poseSkeleton(skeleton, null, null, 0, {}), GRAPH_ROOT);
  const ref = (n) => skeleton.byName.get(n.toLowerCase());
  const shadow = skeletonBindSkins(nif, skeleton);
  assert.deepEqual(shadow.map((s) => s.skin.frame), ['skeleton'], 'the file\'s own skin says its frame is the skeleton\'s');
  // a part-local body skin over the arm, listing Bip01 - a bone shallower than any the Tri Shadow binds
  const inv = (m) => { const r = Float32Array.from([m.a[0], m.a[3], m.a[6], m.a[1], m.a[4], m.a[7], m.a[2], m.a[5], m.a[8]]); return { a: r, t: [0, 1, 2].map((k) => -(r[k * 3] * m.t[0] + r[k * 3 + 1] * m.t[1] + r[k * 3 + 2] * m.t[2])) }; };
  const arm = ['Bip01', 'Bip01 R Clavicle', 'Bip01 R UpperArm', 'Bip01 R Forearm', 'Bip01 R Hand'];
  const body = { positions: Float32Array.from([1, 2, 3]), skin: { bones: arm.map((n) => ({ ref: ref(n), name: n.toLowerCase(), invBind: affineMul(inv(bindOf(n)), PART_LOCAL) })) } };
  const bp = bindPoseMats(skeleton, [body, ...shadow], rest);
  assert.equal(bp.anchors[0], 'Bip01 Pelvis', `the Tri Shadow's pelvis, not the body skin's Bip01 (${bp.anchors.join(', ')})`);
  for (const n of ['Bip01 R UpperArm', 'Bip01 R Forearm', 'Bip01 R Hand', 'Bip01 Head']) {
    const got = bp.mats.get(ref(n)).t; const want = bindOf(n).t;
    assert.ok(Math.hypot(got[0] - want[0], got[1] - want[1], got[2] - want[2]) < 1e-2, `${n} bound where retail binds it (${Array.from(got).map((v) => v.toFixed(1))})`);
  }
  assert.ok(bp.spread < 1e-2, `the body skin agrees with the Tri Shadow (${bp.spread})`);
  // no skeleton skin: the body skin's group anchors at its root-most bone's whole rest, and runs out from there
  const alone = bindPoseMats(skeleton, [body], rest);
  assert.deepEqual(alone.anchors, ['Bip01']);
  assert.deepEqual(Array.from(alone.mats.get(ref('Bip01')).a), Array.from(rest.get(ref('Bip01')).a), 'the anchor on its rest, axes and all - a part-local frame claims none');
  const hand = alone.mats.get(ref('Bip01 R Hand')).t;
  assert.ok(Math.hypot(...[0, 1, 2].map((k) => hand[k] - bindOf('Bip01 R Hand').t[k])) < 1, `and the arm bound out level from it (${Array.from(hand).map((v) => v.toFixed(1))})`);
});

test('MW-STEEL3: the rest of the plate on the same body - the breastplate and its skirt stand on the torso, centred, the skirt under the breastplate (the MW-STEEL2 anchor stood the skirt beside the left shoulder)', async () => {
  const { asm } = await wear({ pieces: [{ templateIndex: 102, material: STEEL }] });
  const box = (prefix) => positionBounds(zone(asm, prefix).map((p) => p.positions));
  const cuirass = box('cuirass'); const skirt = box('skirt');
  assert.ok(cuirass && skirt, asm.notes.join('; '));
  for (const [name, b] of [['the breastplate', cuirass], ['the skirt', skirt]]) {
    const mid = (b.min[0] + b.max[0]) / 2;
    assert.ok(Math.abs(mid) < 3, `${name} centred on the body (x ${mid.toFixed(1)})`);
  }
  assert.ok(skirt.max[2] < cuirass.max[2] && skirt.min[2] < cuirass.min[2], `the skirt under the breastplate (z ${skirt.min[2].toFixed(1)}..${skirt.max[2].toFixed(1)} against ${cuirass.min[2].toFixed(1)}..${cuirass.max[2].toFixed(1)})`);
  assert.ok(skirt.min[2] < bindOf('Bip01 Pelvis').t[2] && skirt.max[2] > bindOf('Bip01 Pelvis').t[2], 'and about the pelvis');
  assert.ok(cuirass.max[2] < bindOf('Bip01 Head').t[2], 'the breastplate under the head');
});
