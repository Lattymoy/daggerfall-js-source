// MW-CLOAK1 (2026-10-09, Mac: "2. The new cloak and its textures. Note: The new cloak will need bones to animate with
// the character movement. Ensure theres no clipping with weapons that are stowed"; asked, both cloaks wear it, Aquamarine
// and Yellow the nearest of his eight paintings, stowed gear is worn over it): MAC'S CLOAK, SKINNED, ON DAGGERFALL'S
// CASUAL AND FORMAL CLOAK - AND WHAT HANGS AROUND IT.
//
// One export, nothing of Bethesda's in it, committed as it came; eight paintings, a mesh each; skinned at bake time on
// the steel plate's machinery, riding the spine and clavicles and hanging over the thighs below the waist; worn by a
// garment's name and dye, claiming no slot. And the two fits a body takes once it is assembled (formats/mwCloakFit.js):
// the cloak eased back over the armour under it, and the Weapon Sheathing addon's stowed gear against it - slung gear
// over it, hip gear pitched under it - pinned on the addon's own scabbards, vendored.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { parseNif } from '../src/formats/mwNifFile.js';
import { flattenNif } from '../src/formats/mwNifMesh.js';
import { decodeTextureImage } from '../src/formats/mwTexture.js';
import { assembleFirstPersonArm, poseAssembly } from '../src/formats/mwFirstPerson.js';
import { composeWornArmor, composeWornModest, fpWornAdds, itemMapCoverage, mwItemReport, CLOTHING_NAME, DF_CLOTHING_DYE_RGB } from '../src/formats/mwItemMap.js';
import { ARMOR_MATERIAL } from '../src/systems/armorMaterials.js';
import { CLASSIC_ARMOR_TEMPLATE } from '../src/characters/ownArmorModels.js';
import { CLOAK_NAMES, CLOAK_PAINTINGS, CLOAK_DYE_PAINTING, ownCloakFor, ownCloakModelPaths, cloakModel, isCloakSlot } from '../src/characters/ownClothingModels.js';
import { CLOAK_CLEARANCE, CLOAK_PUSH_LIMIT, HIP_PITCH_LIMIT, SLUNG_PITCH_LIMIT, cloakSheet, sheetCellKey, fitCloakOver, fitStowedGear, surfaceSamples } from '../src/formats/mwCloakFit.js';
import { readPng } from '../tools/pngIO.mjs';
import { readFbx } from '../tools/fbxRead.mjs';
import { meshModelNames } from '../tools/fbxStrip.mjs';
import { smoothstep, jointWeights } from '../tools/skinWeights.mjs';
import { PLATE_RIG, RETAIL_SKELETON, bakeObject } from '../tools/bakeSteelPlate.mjs';
import { SOURCE, CLOAK_OBJECT, CLOAK_BOX, CLOAK_RIG, CLOAK_SUBDIVISIONS, PAINTING, bakeCloak, meshFile, textureFile, textureName } from '../tools/bakeCloak.mjs';
import { loopSubdivide } from '../tools/meshSubdivide.mjs';
import { retailSkeleton } from './fixtures/mw/retailRig.mjs';
import { SHEATHED, set, CLOAK, isCloak, isGear, isUnder, body, turned, through, crossings } from './fixtures/mw/cloakRig.mjs';

const raw = (p) => readFileSync(new URL(`../${p}`, import.meta.url));
const onDisk = (p) => new Uint8Array(raw(p));
const sha = (p) => createHash('sha256').update(raw(p)).digest('hex');
const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
test('MW-CLOAK1: every mesh and painting re-made from the committed export, its eight paintings and retail\'s skeleton byte for byte; the export Mac\'s as it came, with nothing of Bethesda\'s in it', () => {
  const baked = bakeCloak({ source: raw(SOURCE), pngs: Object.fromEntries(Object.entries(PAINTING).map(([p, f]) => [p, raw(f)])), skeleton: raw(RETAIL_SKELETON) });
  assert.deepEqual(baked.paintings.map((p) => p.painting), [...CLOAK_PAINTINGS]);
  for (const p of baked.paintings) {
    assert.equal(Buffer.compare(Buffer.from(p.nif), raw(meshFile(p.painting))), 0, `${meshFile(p.painting)} is not what tools/bakeCloak.mjs makes - re-run it`);
    assert.equal(Buffer.compare(Buffer.from(p.dds), raw(textureFile(p.painting))), 0, `${textureFile(p.painting)} is not what the bake makes`);
    assert.deepEqual(Array.from(decodeTextureImage(textureFile(p.painting), onDisk(textureFile(p.painting))).mips[0].rgba), Array.from(p.png.data), `the ${p.painting} DDS is its painting`);
    assert.equal(p.png.width, 256);
    const [batch, ...more] = flattenNif(parseNif(onDisk(meshFile(p.painting))));
    assert.equal(more.length, 0, 'one shape');
    assert.equal(batch.material.textureFile, textureName(p.painting), `the ${p.painting} mesh names its own painting`);
  }
  assert.equal(sha(SOURCE), '476df297763018942174de9e32ec7a3cc4614746c32de2bcc497dab6c9551c0f');
  assert.deepEqual(meshModelNames(raw(SOURCE)), [CLOAK_OBJECT]);
  assert.equal(raw(SOURCE).includes(Buffer.from('tx_')), false, 'no Morrowind painting named');
  assert.deepEqual(Object.fromEntries(Object.entries(PAINTING).map(([p, f]) => [p, sha(f).slice(0, 16)])), {
    blue: 'cfa3ceaf07898e3a', grey: '9647db19d96ea761', red: '5ba09e657c374a8b', dark_brown: '439568481d4021be',
    purple: 'b03ff57c60aeeaa9', light_brown: '44ab89ca4623df56', white: '28a58ead1db153ae', green: '346963f96aa29096',
  });
  for (const path of ownCloakModelPaths()) assert.ok(existsSync(new URL(`../src/assets/mw/${path}`, import.meta.url)), `${path} ships`);
});

test('MW-CLOAK1: the cloak is its object in the scene\'s placement (smoothed, MW-CLOAK2), one skinned shape over the steel breastplate\'s spine and clavicles and the thighs; from the waist down the thighs take their side\'s share, to 0.85 at the hem', () => {
  const scene = loopSubdivide(bakeObject(readFbx(raw(SOURCE)), CLOAK_OBJECT, CLOAK_BOX), CLOAK_SUBDIVISIONS);
  const [b] = flattenNif(parseNif(onDisk(meshFile('red'))));
  let worst = 0;
  assert.equal(b.positions.length, scene.positions.length);
  for (let k = 0; k < b.positions.length; k++) worst = Math.max(worst, Math.abs(b.positions[k] - scene.positions[k]));
  assert.ok(worst < 1e-4, `the scene's placement (worst ${worst})`);
  assert.equal(b.skinned, true);
  assert.equal(b.name, 'Tri Cloak 0');
  assert.deepEqual(CLOAK_RIG.bones.map((x) => x.name), [...PLATE_RIG.cuirass.bones.map((x) => x.name), 'Bip01 L Thigh', 'Bip01 R Thigh']);
  assert.ok(b.skin.bones.every((x) => !/arm|hand|head|calf|foot/i.test(x.name)), 'no arm, head or lower leg: it hangs from the shoulders');
  const n = b.positions.length / 3;
  const weight = (name, v) => { const bone = b.skin.bones.find((x) => x.name.toLowerCase() === name.toLowerCase()); const k = bone ? Array.from(bone.indices).indexOf(v) : -1; return k < 0 ? 0 : bone.weights[k]; };
  let hem = 0; let shoulders = 0;
  for (let v = 0; v < n; v++) {
    const x = b.positions[v * 3], z = b.positions[v * 3 + 2];
    const sum = b.skin.bones.reduce((s, bone) => s + Array.from(bone.indices).reduce((t, i, k) => t + (i === v ? bone.weights[k] : 0), 0), 0);
    assert.ok(Math.abs(sum - 1) < 1e-5, `vertex ${v} weighs ${sum}`);
    const legs = 0.85 * smoothstep((86 - z) / (86 - 29.28));
    const right = smoothstep((x + 10) / 20);
    assert.ok(Math.abs(weight('Bip01 L Thigh', v) - legs * (1 - right)) < 1e-3, `vertex ${v} (x ${x.toFixed(1)}, z ${z.toFixed(1)}): the left thigh's share`);
    assert.ok(Math.abs(weight('Bip01 R Thigh', v) - legs * right) < 1e-3, `vertex ${v}: the right thigh's share`);
    if (z < 32) hem++;
    if (z > 100) { shoulders++; assert.equal(weight('Bip01 L Thigh', v) + weight('Bip01 R Thigh', v), 0); }
  }
  assert.ok(hem > 5 && shoulders > 20, `${hem} hem and ${shoulders} shoulder vertices`);
  assert.deepEqual({ ...CLOAK_RIG.hang, legs: [...CLOAK_RIG.hang.legs] }, { mode: 'over', root: 'Bip01 Pelvis', legs: ['Bip01 L Thigh', 'Bip01 R Thigh'], top: 86, bottom: 29.28, share: 0.85, centre: 10 });
  // hung OVER its joints, a leg weighs in by the hang alone - never as the joint law's child blend at its own origin
  const rig = [{ name: 'P', from: [0, 0, 0], to: [0, 0, 10] }, { name: 'L', parent: 'P', from: [0, 0, 0], to: [0, 0, -40] }, { name: 'R', parent: 'P', from: [4, 0, 0], to: [4, 0, -40] }];
  assert.deepEqual(jointWeights([0, 0, -0.5], rig, { hang: { mode: 'over', root: 'P', legs: ['L', 'R'], top: -10, bottom: -40, share: 1, centre: 2 } }), [[['P', 1]]]);
  assert.deepEqual(jointWeights([0, 0, -0.5], rig).map((l) => l.map(([n]) => n).sort()), [['L', 'P']], 'the joint law alone blends into the leg there');
  // AUDIT MW-CLOAK: nor as a parent's blend - a bone hung under a leg (a calf) takes the vertex at its own origin, and
  // the leg comes in by the hang alone, once: its weight the hang's share exactly
  const deep = [...rig, { name: 'LC', parent: 'L', from: [-3, 0, -40], to: [-3, 0, -80] }];
  const [list] = jointWeights([-3, 0, -40.5], deep, { hang: { mode: 'over', root: 'P', legs: ['L', 'R'], top: -10, bottom: -60, share: 0.5, centre: 2 } });
  assert.deepEqual(list.map(([n]) => n).sort(), ['L', 'LC']);
  const share = smoothstep((-10 + 40.5) / 50) * 0.5;
  const w = Object.fromEntries(list);
  assert.ok(Math.abs(w.L - share) < 1e-6 && Math.abs(w.LC - (1 - share)) < 1e-6, `the thigh ${w.L} - the hang's ${share} alone`);
});

test('MW-CLOAK1: the Casual and Formal Cloak, a man\'s and a woman\'s, wear it in their dye\'s painting - Aquamarine the blue, Yellow the light brown - claiming no slot and hiding nothing; one cloak drawn of two', () => {
  assert.deepEqual(Object.entries(CLOTHING_NAME).filter(([, n]) => CLOAK_NAMES.includes(n)).map(([i]) => Number(i)), [154, 155, 191, 192]);
  assert.equal(CLOAK_DYE_PAINTING.length, DF_CLOTHING_DYE_RGB.length);
  assert.deepEqual(CLOAK_DYE_PAINTING.map((p, dye) => ownCloakFor({ kind: 'clothing', name: 'Formal Cloak', dye }).model), CLOAK_DYE_PAINTING.map(cloakModel));
  assert.equal(ownCloakFor({ kind: 'clothing', name: 'Casual Cloak', dye: 7 }).painting, 'blue', 'Aquamarine');
  assert.equal(ownCloakFor({ kind: 'clothing', name: 'Casual Cloak', dye: 8 }).painting, 'light_brown', 'Yellow');
  assert.equal(ownCloakFor({ kind: 'clothing', name: 'Casual Cloak', dye: 99 }).painting, 'blue', 'a dye out of range wears Daggerfall\'s default');
  assert.equal(ownCloakFor({ kind: 'clothing', name: 'Plain Robes', dye: 0 }), null);
  assert.equal(ownCloakFor({ templateIndex: 102, material: ARMOR_MATERIAL.Steel }), null);
  // claimed by no slot: the plate under it all drawn, the cloak added last, shadowing nothing
  const plate = composeWornArmor({ pieces: set(ARMOR_MATERIAL.Steel), armors: [], bodyPool: [] });
  const cloaked = composeWornArmor({ pieces: [...set(ARMOR_MATERIAL.Steel), CLOAK], armors: [], bodyPool: [] });
  assert.deepEqual(cloaked.adds.slice(0, -1), plate.adds);
  assert.deepEqual(cloaked.shadows, plate.shadows);
  assert.deepEqual(cloaked.notes, []);
  const add = cloaked.adds.at(-1);
  assert.deepEqual({ ...add, piece: null }, { slot: 'cloak (daggerfall_cloak)', partName: 'cloak', bones: [], model: 'cloak_red.nif', recordId: 'daggerfall_cloak', piece: null });
  assert.equal(add.piece, CLOAK);
  assert.ok(isCloakSlot(add.slot) && !isCloakSlot('cuirass (daggerfall_steel_cuirass)'));
  assert.deepEqual(fpWornAdds(cloaked.adds), fpWornAdds(plate.adds), 'the first person never draws it');
  // a bare body under it: the cloak and nothing else, nothing hidden; a woman's chest takes the weld under it
  const bare = composeWornArmor({ pieces: [{ kind: 'clothing', templateIndex: 192, name: 'Formal Cloak', dye: 9 }], armors: [], bodyPool: [], female: true });
  assert.deepEqual(bare.adds.map((a) => a.model), ['cloak_green.nif']);
  assert.deepEqual(bare.shadows, []);
  assert.ok(composeWornModest({ pieces: [CLOAK], armors: [], clothes: [{ id: 'common_shirt_01', model: 's.nif', type: 2, enchanted: false, parts: [{ part: 3, male: 'b_shirt', female: null }] }], bodyPool: [{ id: 'b_shirt', model: 'm/s.nif' }], female: true }, false).shadows.includes('chest'));
  // two cloaks: the first drawn, the second named
  const two = composeWornArmor({ pieces: [{ kind: 'clothing', templateIndex: 154, dye: 2 }, { kind: 'clothing', templateIndex: 155, dye: 0 }], armors: [], bodyPool: [] });   // named by their templates alone
  assert.deepEqual(two.adds.map((a) => a.model), ['cloak_red.nif']);
  assert.deepEqual(two.notes, ['Formal Cloak: a second cloak - the first (Casual Cloak) is the one drawn']);
  // the census and the report say whose it is
  const own = itemMapCoverage().filter((c) => c.own === 'ownClothingModels');
  assert.deepEqual(own.map((c) => c.index), [154, 155, 191, 192]);
  assert.ok(own.every((c) => c.kind === 'own' && c.model === CLOAK_PAINTINGS.map(cloakModel).join(' + ')));
  const rows = mwItemReport([], { clothes: [] }).filter((r) => r.family === 'clothing' && r.item.endsWith('Casual Cloak'));
  assert.deepEqual(rows.map((r) => r.found[0]), CLOAK_DYE_PAINTING.map(cloakModel));
  assert.ok(rows.every((r) => /the port's own cloak/.test(r.note) && r.reserve === null));
});

test('MW-CLOAK1: through the binder on retail\'s rig the cloak moves with the body - the shoulders on the spine, the hem with the leg stepping back; as baked the stride\'s trailing boot reaches into the hem, and fitted (AUDIT MW-CLOAK) it does not', async () => {
  const asm = await body(ARMOR_MATERIAL.Steel);
  const cloak = () => asm.pieces.find(isCloak);
  assert.equal(cloak().kind, 'skinned');
  const verts = (pred) => { const P = cloak().positions; const out = []; for (let v = 0; v < P.length / 3; v++) { const p = [P[v * 3], P[v * 3 + 1], P[v * 3 + 2]]; if (pred(p)) out.push(p); } return out; };
  const centroid = (vs) => [0, 1, 2].map((k) => vs.reduce((s, v) => s + v[k], 0) / vs.length);
  const B = (n) => asm.mats.get(asm.skeleton.byName.get(n)).t;
  // at rest: behind the spine, from the shoulders down past the knees
  const spine = B('bip01 spine2');
  const all = verts(() => true);
  assert.ok(all.every((v) => v[1] < spine[1] + 2), 'wholly behind the spine');
  assert.ok(Math.max(...all.map((v) => v[2])) > B('bip01 neck')[2] - 6 && Math.min(...all.map((v) => v[2])) < B('bip01 l calf')[2] - 10, 'the shoulders to below the knees');
  const restShoulders = centroid(verts((v) => v[2] > 105));
  const leftHem = (v) => v[2] < 40 && v[0] < -8;
  const restLeftHem = centroid(verts(leftHem));
  // a stride: the left leg back, its knee bent - the left hem goes back with it, the shoulders stay
  poseAssembly(asm, turned(asm, { 'bip01 r thigh': 35, 'bip01 l thigh': -30, 'bip01 l calf': 45 }));
  assert.ok(Math.hypot(...centroid(verts((v) => v[2] > 105)).map((c, k) => c - restShoulders[k])) < 1e-3, 'the shoulders stay');
  const hemNow = centroid(verts((v) => v[0] < -8 && v[2] < 60).sort((a, b) => a[2] - b[2]).slice(0, 6));
  assert.ok(hemNow[1] < restLeftHem[1] - 8, `the left hem went back with the leg (${restLeftHem[1].toFixed(1)} to ${hemNow[1].toFixed(1)})`);
  // the stride's trailing boot, its knee bent 45 degrees, rises behind the middle of the hem - where the thighs split
  // the cloak - and reaches into it no more than this; a walk's (back 20, the knee 30) not at all
  const trailing = (p) => /left (upper leg|foot)/.test(p.slot);
  assert.ok(through(asm, trailing) < 2.5, `the stride's trailing boot ${through(asm, trailing).toFixed(2)} into the hem`);
  poseAssembly(asm, turned(asm, { 'bip01 r thigh': 22, 'bip01 l thigh': -20, 'bip01 l calf': 30 }));
  assert.equal(through(asm, trailing), 0, 'a walk\'s trailing greave and boot stay in front of it');
  assert.equal(crossings(asm, trailing), 0);
  // AUDIT MW-CLOAK: fit 1 holds the cloak over the stride too - the hem's middle eased back past the boot it reached
  fitCloakOver(asm, { isCloak, isUnder });
  for (const stride of [{ 'bip01 r thigh': 35, 'bip01 l thigh': -30, 'bip01 l calf': 45 }, { 'bip01 l thigh': 35, 'bip01 r thigh': -30, 'bip01 r calf': 45 }]) {
    poseAssembly(asm, turned(asm, stride));
    assert.equal(crossings(asm, isUnder), 0, 'fitted, no leg through the hem in either stride');
  }
});

test('MW-CLOAK1: the cloak eases back over the armour under it - the ebony pauldrons through its shoulders, then behind it in every pose; the cloak\'s batch replaced, never written into', async () => {
  const asm = await body(ARMOR_MATERIAL.Ebony);
  const before = through(asm, isUnder);
  assert.ok(before > 2, `the ebony pauldrons stand ${before.toFixed(2)} through the cloak as baked`);
  const cloak = asm.pieces.find(isCloak);
  const baked = cloak.batch.positions; const copy = Float32Array.from(baked);
  const fit = fitCloakOver(asm, { isCloak, isUnder });
  // the furthest is the poses' (an arm swung back, a stride's boot), more than the rest's pauldrons alone ask
  assert.ok(fit.pushed > 0 && fit.most > before + CLOAK_CLEARANCE && fit.most < CLOAK_PUSH_LIMIT && fit.deep === 0, `${fit.pushed} vertices eased back, the furthest ${fit.most.toFixed(2)}`);
  assert.notEqual(cloak.batch.positions, baked, 'a new array');
  assert.deepEqual(Array.from(baked), Array.from(copy), 'the parsed batch is untouched');
  // the live pose re-skinned at once: the next pose of the same rest moves nothing
  const live = Float32Array.from(cloak.positions);
  poseAssembly(asm);
  assert.ok(live.every((x, k) => Math.abs(x - cloak.positions[k]) < 1e-4), 'the live cloak already the fitted one');
  assert.ok(through(asm, isUnder) <= 0, 'nothing of the body stands behind it at rest');
  assert.equal(crossings(asm, isUnder), 0);
  // it rides the bones: a walk, and an arm swung back, keep the shoulders clear
  for (const pose of [{ 'bip01 r thigh': 22, 'bip01 l thigh': -20, 'bip01 l calf': 30 }, { 'bip01 l upperarm': 20 }, { 'bip01 r upperarm': -20 }]) {
    poseAssembly(asm, turned(asm, pose));
    assert.equal(crossings(asm, (p) => /pauldron/.test(p.slot)), 0);
  }
  // a second fit finds nothing; a body without a cloak is not a cloak's
  assert.deepEqual(fitCloakOver(asm, { isCloak, isUnder }), { pushed: 0, most: 0, deep: 0 });
  assert.equal(fitCloakOver({ ...asm, pieces: asm.pieces.filter((p) => !isCloak(p)) }, { isCloak, isUnder }), null);
  // a FOLDED cloak - a second layer three units behind the first, skinned as it is: the layer in front is the one the
  // pauldrons come through, and both end behind them (a pass per fold uncovered)
  const folded = await body(ARMOR_MATERIAL.Ebony);
  const c = folded.pieces.find(isCloak); const b = c.batch; const n = b.positions.length / 3;
  const pos = new Float32Array(n * 6); pos.set(b.positions);
  for (let v = 0; v < n; v++) for (let k = 0; k < 3; k++) pos[(n + v) * 3 + k] = b.positions[v * 3 + k] - (k === 1 ? 3 : 0);
  const idx = Uint32Array.from([...b.indices, ...Array.from(b.indices, (i) => i + n)]);
  const skin = { ...b.skin, bones: b.skin.bones.map((x) => ({ ...x, indices: [...x.indices, ...Array.from(x.indices, (i) => i + n)], weights: [...x.weights, ...x.weights] })) };
  c.batch = { ...b, positions: pos, indices: idx, skin, normals: null }; c.indices = idx; c.positions = new Float32Array(pos.length); c.normals = null;
  poseAssembly(folded);
  assert.ok(through(folded, isUnder) > 2, 'the folded cloak\'s front layer as pierced as the plain one');
  fitCloakOver(folded, { isCloak, isUnder });
  poseAssembly(folded);
  assert.ok(through(folded, isUnder) <= 0, 'both layers behind the pauldrons');
  // the steel plate it was fitted on asks less of it than the ebony's bigger pauldrons
  const steel = await body(ARMOR_MATERIAL.Steel);
  assert.ok(fitCloakOver(steel, { isCloak, isUnder }).most < fit.most);
});

test('MW-CLOAK1: stowed gear against the cloak, on the addon\'s own scabbards - the greatsword and the bow slung OVER it, the longsword pitched UNDER it, the dagger left as it hangs; none through it', async () => {
  const GEAR = [['w_claymore_daedric_sh.nif', 'Bip01 LongBladeTwoClose'], ['w_longbow_sh.nif', 'Bip01 MarksmanBow'], ['w_iron_longsword_sh.nif', 'Bip01 LongBladeOneHand'], ['w_iron_dagger_sh.nif', 'Bip01 ShortBladeOneHand']];
  const asm = await body(ARMOR_MATERIAL.Steel, GEAR);
  fitCloakOver(asm, { isCloak, isUnder });
  poseAssembly(asm);
  const gearAt = (bone) => asm.pieces.filter((p) => isGear(p) && p.bone === bone);
  assert.ok(crossings(asm, (p) => gearAt('Bip01 LongBladeTwoClose').includes(p)) > 50, 'the greatsword through the cloak as the addon slings it');
  assert.ok(crossings(asm, (p) => gearAt('Bip01 LongBladeOneHand').includes(p)) > 0, 'the longsword\'s tip through its side');
  const dagger = gearAt('Bip01 ShortBladeOneHand')[0].source;
  const sword = gearAt('Bip01 LongBladeOneHand')[0].source; const swordCopy = Float32Array.from(sword);
  const swordNormals = gearAt('Bip01 LongBladeOneHand')[0].sourceNormals;
  const rows = fitStowedGear(asm, { isCloak, isGear });
  const by = Object.fromEntries(rows.map((r) => [r.bone, r]));
  assert.deepEqual(rows.map((r) => [r.bone, r.slung, r.how]), [
    ['Bip01 LongBladeTwoClose', true, 'over'], ['Bip01 MarksmanBow', true, 'over'], ['Bip01 LongBladeOneHand', false, 'pitched'], ['Bip01 ShortBladeOneHand', false, 'clear'],
  ]);
  assert.ok(by['Bip01 LongBladeTwoClose'].by < 6 && Math.abs(by['Bip01 LongBladeTwoClose'].deg) <= SLUNG_PITCH_LIMIT, `the greatsword lies along the cloak - ${by['Bip01 LongBladeTwoClose'].by.toFixed(1)} back, turned ${by['Bip01 LongBladeTwoClose'].deg}`);
  assert.ok(by['Bip01 MarksmanBow'].by < 10);
  assert.ok(by['Bip01 LongBladeOneHand'].by >= 10 && by['Bip01 LongBladeOneHand'].by <= 20, `the longsword nearer plumb by ${by['Bip01 LongBladeOneHand'].by} degrees`);
  assert.equal(gearAt('Bip01 ShortBladeOneHand')[0].source, dagger, 'the dagger untouched');
  assert.deepEqual(Array.from(sword), Array.from(swordCopy), 'a moved source is replaced, never written into');
  // the pitched sword's normals turned with it: each still meets its vertex's edges at the angle it did
  const pitched = gearAt('Bip01 LongBladeOneHand')[0];
  assert.ok(swordNormals && pitched.sourceNormals !== swordNormals, 'its normals replaced');
  let bent = 0;
  for (let t = 0; t < pitched.indices.length; t += 3) for (let e = 0; e < 3; e++) {
    const a = pitched.indices[t + e] * 3, b = pitched.indices[t + (e + 1) % 3] * 3;
    const cos = (P, N) => { const d = [P[b] - P[a], P[b + 1] - P[a + 1], P[b + 2] - P[a + 2]]; return (d[0] * N[a] + d[1] * N[a + 1] + d[2] * N[a + 2]) / (Math.hypot(...d) || 1); };
    bent = Math.max(bent, Math.abs(cos(swordCopy, swordNormals) - cos(pitched.source, pitched.sourceNormals)));
  }
  assert.ok(bent < 1e-3, `a normal off its turned edges by ${bent.toFixed(4)}`);
  assert.equal(crossings(asm, isGear), 0, 'the live pose re-placed at once');
  // and from here on every pose places them so
  for (const pose of [{}, turned(asm, { 'bip01 spine1': 8 })]) {
    poseAssembly(asm, pose);
    assert.equal(crossings(asm, isGear), 0, 'no stowed piece through the cloak');
  }
  poseAssembly(asm);
  const cloak = asm.pieces.find(isCloak); const sheet = cloakSheet(cloak.positions, cloak.indices);
  for (const p of asm.pieces.filter(isGear)) {
    const pts = surfaceSamples(p.positions, p.indices);
    for (let v = 0; v < pts.length; v += 3) {
      const c = sheet.get(sheetCellKey(pts[v], pts[v + 2]));
      if (!c) continue;
      if (p.bone === 'Bip01 LongBladeTwoClose' || p.bone === 'Bip01 MarksmanBow') assert.ok(pts[v + 1] <= c.back - CLOAK_CLEARANCE + 1e-3, `${p.bone} wholly over the cloak`);
      else assert.ok(pts[v + 1] >= c.front + CLOAK_CLEARANCE - 1e-3, `${p.bone} wholly under it`);
    }
  }
  // fitted once: a second fit moves nothing
  assert.ok(fitStowedGear(asm, { isCloak, isGear }).every((r) => r.how === 'clear' || (r.how === 'over' && r.by < 1e-3 && r.deg === 0)));
  assert.equal(HIP_PITCH_LIMIT, 60);
  // no cloak: nothing to answer and nothing moved
  const bare = await assembleFirstPersonArm({ skeletonBytes: retailSkeleton(), parts: [{ slot: 'sheath', bones: ['Bip01 LongBladeOneHand'], bytes: SHEATHED('w_iron_longsword_sh.nif'), bare: true }] });
  const was = bare.pieces[0].source;
  assert.equal(fitStowedGear(bare, { isCloak, isGear }), null);
  assert.equal(bare.pieces[0].source, was);
});

test('MW-CLOAK1 by source: the third-person build fits the cloak over the body\'s skin and what it wears, once it is assembled, and ties the stowed gear to it; a weapon swap fits the new holster; a seated body seats its cloak; a cloak\'s icon is its own', () => {
  const fp = src('src/combat/fpArm.js');
  assert.match(fp, /hangHipLight\(arm\);[^\n]*\n\s*const cloakFit = fitThirdPersonCloak\(arm, new Set\(\[\.\.\.skinRows, \.\.\.worn\.adds\]\.map\(\(row\) => row\.slot\)\)\);/);
  assert.match(fp, /\.\.\.resolvedHolster\.notes, \.\.\.cloakFit\.notes,/);
  assert.match(fp, /bindPartsInto\(t\.arm, \[\.\.\.tResolved\.parts, \.\.\.tHolster\.parts\]\);\s*const tFit = fitThirdPersonCloak\(t\.arm, null\);[^\n]*\n\s*t\.holster = tHolster\.info;\s*t\.notes = \[\.\.\.\(t\.notes \|\| \[\]\)\.filter\(\(n\) => !\/\^holster\[ :@\]\/\.test\(n\)\), \.\.\.tHolster\.notes, \.\.\.tFit\.notes\];/);
  assert.match(fp, /export function fitThirdPersonCloak\(arm, underSlots\) \{\s*const isCloak = \(p\) => isCloakSlot\(p\.slot\);\s*const isGear = \(p\) => HOLSTER_SLOTS\.includes\(p\.slot\);\s*const covered = \(slot\) => underSlots\.has\(slot\) && slot !== 'tail' && !\/\^shield\\b\/\.test\(slot\);\s*seatCloak\(arm, false, isCloak\);[^\n]*\n\s*const cloak = underSlots \? fitCloakOver\(arm, \{ isCloak, isUnder: \(p\) => covered\(p\.slot\) \}\) : null;\s*const gear = fitStowedGear\(arm, \{ isCloak, isGear \}\);\s*const follow = followCloak\(arm, \{ isCloak, isGear \}\);/);
  assert.match(fp, /if \(t\.cloaked\) seatCloak\(t\.arm, !!\(cam && cam\.seat\)\);\n(\s*\/\/[^\n]*\n)*\s*if \(pose\) \{\s*posePartClocks\(t\.arm, [^\n]*\n\s*poseAssembly\(t\.arm, \{/);   // PIN MOVED (MW-BOW1): the weapon's clock poses first
  assert.match(fp, /cloaked: !!cloakFit\.follow \|\| !!cloakFit\.cloak,/);
  assert.match(fp, /const cloak = ownCloakFor\(\{ kind: 'clothing', name: CLOTHING_NAME\[item\.templateIndex\], dye: item\.dye \?\? 0 \}\);\s*if \(cloak\) return \{ id: `\$\{cloak\.id\}_\$\{cloak\.painting\}`, model: cloak\.model \};/);
  assert.match(fp, /if \(\(item\.group === 'MensClothing' \|\| item\.group === 'WomensClothing'\) && !ownCloakFor\(/);
  assert.match(src('src/formats/mwFirstPerson.js'), /assembly\.time = time;[\s\S]{0,400}if \(assembly\.afterPose\) assembly\.afterPose\(assembly\);\s*assembly\.bounds = /);
});
