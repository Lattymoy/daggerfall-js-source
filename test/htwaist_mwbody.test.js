// HT-WAIST (2026-09-24, Mac: "Let the lantern item be able to be hung at
// the waist ... a separate animated item on movement"). THE MORROWIND BODY.
//
// A lit lantern at the waist is drawn on the third-person Morrowind body:
// a carriable LIGH record named lantern (pickLanternRecord, the torch
// picker's own shape), bound as a rigid part at `Bip01 Pelvis` on the
// THIRD-PERSON rig alone, hung PLUMB from a hook fixed to the pelvis
// (mwFirstPerson.js hangAffine - the part hangs by its top, whatever the
// pelvis does) and swung by the one swing law off the body's motion. It is
// never hidden by the carried-left rule (it is in no hand), only by not
// being lit; the portrait shows it lit; a bind that fails is remembered;
// a light that arrives mid-build is queued; unload drops it.
//
// Driven through the real code: the formats' own assembly over Weapon
// Sheathing's vendored retail-shaped skeleton for the hang's geometry, and
// a whole createFpArm() rig for the doors, on the fixture body with a
// pelvis joined through the WS1 bone-addon door (a tiny addon NIF written
// here - the fixture skeleton is an arm and has none).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { pickLanternRecord, pickTorchRecord, assembleFirstPersonArm, poseAssembly, hangAffine, MW_LIGHT_CARRY } from '../src/formats/mwFirstPerson.js';
import {
  createFpArm, fpSkeletonPath, FP_CLIP_PATH, resolveHipLanternPart, hipLanternPartPaths, hangHipLight, effectPlacement,
  HIP_LIGHT_BONE, HIP_LIGHT_SLOT, HIP_LANTERN_HOOK,
} from '../src/combat/fpArm.js';
import { bodyRec, fixtureFile, countingRenderer } from './fixtures/mw/bodyRig.mjs';
import { createLanternSwing, lanternSwingMatrix } from '../src/systems/lanternSwing.js';

const rd = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const SKEL = new Uint8Array(readFileSync(new URL('../vendor/weapon-sheathing/Data Files/Animations/xbase_anim/xbase_anim_sh.nif', import.meta.url)));
const light = (id, flags = MW_LIGHT_CARRY, model = `l/${id}.nif`) => ({ id, model, name: id, carry: !!(flags & MW_LIGHT_CARRY), fire: false, flags });
const bbox = (pos) => {
  const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
  for (let v = 0; v < pos.length; v += 3) for (let i = 0; i < 3; i++) { mn[i] = Math.min(mn[i], pos[v + i]); mx[i] = Math.max(mx[i], pos[v + i]); }
  return { mn, mx, top: [(mn[0] + mx[0]) / 2, (mn[1] + mx[1]) / 2, mx[2]], mid: [(mn[0] + mx[0]) / 2, (mn[1] + mx[1]) / 2, (mn[2] + mx[2]) / 2] };
};
const close = (a, b, eps, msg) => { for (let i = 0; i < 3; i++) assert.ok(Math.abs(a[i] - b[i]) <= eps, `${msg}: ${a} vs ${b}`); };
/** The SHAPE of a placed piece - every vertex less the first - so two placements that differ only by where the
 *  hook is (a translation) compare equal, and any turn of the part does not. */
const shapeOf = (pos) => Array.from(pos, (v, i) => v - pos[i % 3]);
const sameShape = (a, b, eps, msg) => {
  const A = shapeOf(a), B = shapeOf(b);
  let worst = 0;
  for (let i = 0; i < A.length; i++) worst = Math.max(worst, Math.abs(A[i] - B[i]));
  assert.ok(worst <= eps, `${msg} (off by ${worst})`);
};

// ---------------------------------------------------------------
// the record and the part
// ---------------------------------------------------------------
test('HT-WAIST pickLanternRecord: a CARRIABLE light named lantern whose mesh is attached, the shortest id first - never a torch, never a sconce (mutant: a rule of the pick dropped)', () => {
  const sconce = light('light_de_lantern_01', 0);
  const torch = light('torch');
  const blue = light('light_de_lantern_14_blue');
  const plain = light('lantern_01');
  assert.equal(pickLanternRecord([sconce, torch]), null, 'no carriable lantern: null, never the torch or a wall lantern');
  assert.equal(pickLanternRecord([blue, plain, sconce, torch]), plain, 'the shortest id: the base over its colours');
  assert.equal(pickLanternRecord([blue, plain], { has: (p) => p !== 'meshes/l/lantern_01.nif' }), blue, 'MW-D50: only a mesh the archives carry');
  assert.equal(pickTorchRecord([blue, plain, torch]), torch, 'and the torch picker is untouched by the shared shape');
  assert.equal(pickLanternRecord(null), null);
});

test('HT-WAIST resolveHipLanternPart: nothing unlit; a note, never a throw, for no record, no mesh or no pelvis; the part at Bip01 Pelvis with its own hang otherwise (mutant: the bone or the slot misspelled, the hang dropped)', () => {
  const rec = light('lantern_01');
  const bytes = new Uint8Array([1, 2, 3]);
  const find = (p) => (p === 'meshes/l/lantern_01.nif' ? { get: () => bytes } : null);
  const yes = () => true;
  assert.deepEqual(resolveHipLanternPart({ hipLight: false, allLights: [rec], find, hasBone: yes }), { parts: [], hipInfo: null, notes: [] });
  assert.deepEqual(hipLanternPartPaths({ hipLight: false, allLights: [rec] }), []);
  assert.deepEqual(hipLanternPartPaths({ hipLight: true, allLights: [rec] }), ['meshes/l/lantern_01.nif'], 'the one preload round names the mesh');
  assert.match(resolveHipLanternPart({ hipLight: true, allLights: [light('torch')], find, hasBone: yes }).notes[0], /^hiplight: your archives carry no carriable Morrowind lantern/);
  assert.match(resolveHipLanternPart({ hipLight: true, allLights: [rec], find: () => null, hasBone: yes }).notes[0], /^hiplight: meshes\/l\/lantern_01\.nif \(lantern_01\) is not in your archives$/);
  assert.match(resolveHipLanternPart({ hipLight: true, allLights: [rec], find, hasBone: () => false }).notes[0], /^hiplight: this skeleton has no "Bip01 Pelvis"/);
  const ok = resolveHipLanternPart({ hipLight: true, allLights: [rec], find, hasBone: (b) => b === HIP_LIGHT_BONE });
  assert.equal(ok.notes.length, 0);
  assert.equal(ok.parts.length, 1);
  assert.equal(ok.parts[0].slot, HIP_LIGHT_SLOT); assert.equal(HIP_LIGHT_SLOT, 'hiplight');
  assert.deepEqual(ok.parts[0].bones, ['Bip01 Pelvis']);
  assert.equal(ok.parts[0].preTransform, undefined, 'no hand attitude - it hangs, it is not held');
  assert.deepEqual([...ok.parts[0].hang.rot], [1, 0, 0, 0, 1, 0, 0, 0, 1], 'its own hang, plumb');
  assert.notEqual(ok.parts[0].bytes, bytes, 'a copy of the archive\'s bytes');
  assert.deepEqual(ok.hipInfo, { id: 'lantern_01', name: 'lantern_01', model: 'l/lantern_01.nif', bone: 'Bip01 Pelvis', fire: false });
});

// ---------------------------------------------------------------
// the hang, on a retail-shaped skeleton
// ---------------------------------------------------------------
async function hungOnRetailSkeleton() {
  const mesh = fixtureFile('weapon.nif');   // any rigid mesh stands in for the lantern's
  const res = resolveHipLanternPart({ hipLight: true, allLights: [light('lantern_01')], find: (p) => (p === 'meshes/l/lantern_01.nif' ? { get: () => mesh } : null), skeletonBytes: SKEL });
  assert.deepEqual(res.notes, [], 'Weapon Sheathing\'s copy of the retail Bip01 chain carries the pelvis');
  const arm = await assembleFirstPersonArm({ skeletonBytes: SKEL, parts: res.parts });
  assert.equal(arm.ok, true);
  const hang = hangHipLight(arm);
  assert.ok(hang, 'the bound hang is found and measured');
  return { arm, hang, piece: arm.pieces.find((p) => p.slot === HIP_LIGHT_SLOT) };
}

test('HT-WAIST the hang: the lantern hangs by its TOP from a hook on the RIGHT hip - the pelvis plus HIP_LANTERN_HOOK in the actor\'s own axes, clear of the scabbard at the left (mutant: the hook, the anchor or the side wrong)', async () => {
  const { arm, piece } = await hungOnRetailSkeleton();
  poseAssembly(arm);
  const pelvis = arm.mats.get(arm.skeleton.byName.get('bip01 pelvis')).t;
  close(pelvis, [0, 1.8, 76.4], 0.1, 'the retail pelvis');
  const b = bbox(piece.positions);
  close(b.top, [pelvis[0] + HIP_LANTERN_HOOK[0], pelvis[1] + HIP_LANTERN_HOOK[1], pelvis[2] + HIP_LANTERN_HOOK[2]], 1e-3, 'the top-centre at the hook');
  assert.ok(b.top[0] > 0, 'the actor\'s RIGHT (+X): the one-handed scabbard hangs at the left');
  const sheath = arm.mats.get(arm.skeleton.byName.get('bip01 longbladeonehand')).t;
  assert.ok(sheath[0] < 0, 'and the scabbard bone really is at the left');
  assert.ok(Math.abs(b.top[2] - sheath[2]) < 2, 'at the scabbard\'s own belt height');
  assert.ok(b.mx[2] - b.mn[2] > 0 && b.mid[2] < b.top[2], 'it hangs DOWN from the hook');
});

test('HT-WAIST the hang: PLUMB whatever the pelvis does - a pelvis turned 40 degrees carries the hook round and leaves the lantern upright; the swing tips it forward about the hook (mutant: the bone\'s rotation applied to the part, or the swing ignored)', async () => {
  const { arm, hang, piece } = await hungOnRetailSkeleton();
  poseAssembly(arm);
  const rest = bbox(piece.positions);
  const restPos = Float32Array.from(piece.positions);
  const height = rest.mx[2] - rest.mn[2];
  // the pelvis twisted: a real track on the real sampler seam
  const a = 40 * Math.PI / 180;
  const q = [Math.cos(a / 2), Math.sin(a / 2), 0, 0];
  const pelvisRef = arm.skeleton.byName.get('bip01 pelvis');
  const restRot = arm.skeleton.nodes.get(pelvisRef).rest.rotation;
  // compose onto the rest rotation so only the extra 40 degrees is the pose's
  const tracks = new Map([['bip01 pelvis', { q }]]);
  const sample = (track) => {
    const m = restRot;
    // quaternion of the rest rotation times the extra - built as a matrix and handed back as a quaternion
    const c = Math.cos(a), s = Math.sin(a);
    const rx = [1, 0, 0, 0, c, -s, 0, s, c];
    const r = [0, 1, 2].flatMap((i) => [0, 1, 2].map((j) => m[i * 3] * rx[j] + m[i * 3 + 1] * rx[3 + j] + m[i * 3 + 2] * rx[6 + j]));
    const w = Math.sqrt(Math.max(0, 1 + r[0] + r[4] + r[8])) / 2;
    return { rotation: [w, (r[7] - r[5]) / (4 * w), (r[2] - r[6]) / (4 * w), (r[3] - r[1]) / (4 * w)], track };
  };
  poseAssembly(arm, { tracks, sampleTrack: sample, time: 0 });
  const turned = bbox(piece.positions);
  assert.ok(Math.hypot(turned.top[0] - rest.top[0], turned.top[1] - rest.top[1], turned.top[2] - rest.top[2]) > 1, 'the hook rides the pelvis round');
  sameShape(piece.positions, restPos, 1e-3, 'the lantern still hangs straight down from it - moved, not turned');
  // the swing: forward 30 degrees about the hook
  const sw = createLanternSwing(); sw.fore = 30 * Math.PI / 180;
  lanternSwingMatrix(sw, hang.rot);
  poseAssembly(arm);
  const swung = bbox(piece.positions);
  const bottom = (() => { let lo = null; for (let v = 0; v < piece.positions.length; v += 3) if (!lo || piece.positions[v + 2] < lo[2]) lo = [piece.positions[v], piece.positions[v + 1], piece.positions[v + 2]]; return lo; })();
  assert.ok(bottom[1] > rest.top[1] + height * 0.3, 'the foot swings FORWARD (+Y)');
  assert.ok(Math.abs(swung.mx[2] - rest.top[2]) < height * 0.2, 'about the hook: the top stays near where it hung');
});

test('HT-WAIST the hang: a hanging part\'s particle system (a lantern\'s flame) is placed by the SAME hang its shapes take (mutant: effectPlacement riding the bone)', async () => {
  const { arm, hang } = await hungOnRetailSkeleton();
  poseAssembly(arm);
  const pelvisRef = arm.skeleton.byName.get('bip01 pelvis');
  const eff = { attachRef: pelvisRef, mirrored: false, boneOffset: null, pre: null, hang, desc: { world: { translation: [0, 0, 0], rotation: Float32Array.from([1, 0, 0, 0, 1, 0, 0, 0, 1]), scale: 1 } } };
  const m = effectPlacement(eff, arm.mats, arm.fns.attachmentTransform);
  const want = hangAffine(arm.fns.attachmentTransform(arm.mats, pelvisRef), hang);
  for (let i = 0; i < 3; i++) assert.ok(Math.abs(m.t[i] - want.t[i]) < 1e-4, 'the flame\'s origin is the hang\'s');
  const bone = arm.mats.get(pelvisRef);
  assert.ok(Math.hypot(m.t[0] - bone.t[0], m.t[1] - bone.t[1], m.t[2] - bone.t[2]) > 5, 'not the bare pelvis');
});

// ---------------------------------------------------------------
// the live rig
// ---------------------------------------------------------------
/** A NIF (4.0.0.2) of NiNodes and NiStringExtraData, written the way mwNifFile.js reads it. */
function nifBytes(records, roots) {
  const out = [];
  const u32 = (n) => { const b = new Uint8Array(4); new DataView(b.buffer).setUint32(0, n >>> 0, true); out.push(...b); };
  const i32 = (n) => { const b = new Uint8Array(4); new DataView(b.buffer).setInt32(0, n, true); out.push(...b); };
  const f32 = (n) => { const b = new Uint8Array(4); new DataView(b.buffer).setFloat32(0, n, true); out.push(...b); };
  const u16 = (n) => { out.push(n & 255, (n >> 8) & 255); };
  const str = (s) => { u32(s.length); for (const c of s) out.push(c.charCodeAt(0)); };
  for (const c of 'NetImmerse File Format, Version 4.0.0.2\n') out.push(c.charCodeAt(0));
  u32(0x04000002); u32(records.length);
  for (const r of records) {
    str(r.type);
    if (r.type === 'NiNode') {
      str(r.name); i32(r.extra ?? -1); i32(-1); u16(0);
      for (const v of r.translation ?? [0, 0, 0]) f32(v);
      for (const v of [1, 0, 0, 0, 1, 0, 0, 0, 1]) f32(v);
      f32(1); f32(0); f32(0); f32(0);
      u32(0); u32(0);   // no properties, no bounding volume
      u32(r.children?.length ?? 0); for (const c of r.children ?? []) i32(c);
      u32(0);   // no effects
    } else if (r.type === 'NiStringExtraData') {
      i32(-1); u32(r.string.length + 4); str(r.string);
    }
  }
  u32(roots.length); for (const r of roots) i32(r);
  return Uint8Array.from(out);
}
/** The WS1 addon that joins a pelvis to the fixture's Bip01: a BONE-marked node under a node named Bip01. */
const PELVIS_ADDON = nifBytes([
  { type: 'NiNode', name: 'pelvisaddon', children: [1] },
  { type: 'NiNode', name: 'Bip01', children: [2] },
  { type: 'NiNode', name: 'Bip01 Pelvis', extra: 3, translation: [0, 0, 10] },
  { type: 'NiStringExtraData', string: 'BONE' },
], [0]);

const enc = (s) => Array.from(s, (c) => c.charCodeAt(0));
const u32b = (n) => [n & 255, (n >> 8) & 255, (n >> 16) & 255, (n >>> 24) & 255];
const sub = (name, payload) => [...enc(name), ...u32b(payload.length), ...payload];
const rec = (type, subs) => { const body = subs.flat(); return [...enc(type), ...u32b(body.length), 0, 0, 0, 0, 0, 0, 0, 0, ...body]; };
const z = (s) => [...enc(s), 0];
const lhdt = (flags) => { const b = new Uint8Array(24); new DataView(b.buffer).setInt32(20, flags, true); return Array.from(b); };
const LANTERN_LIGH = rec('LIGH', [sub('NAME', z('lantern_01')), sub('MODL', [...enc('l'), 0x5c, ...z('lantern_01.nif')]), sub('FNAM', z('Lantern')), sub('LHDT', lhdt(1 | 2))]);

/** The fixture body rig (bodyRig.mjs's), with the pelvis addon under the body's animations folder and the lantern's record and mesh. */
function bodyDeps({ lanternRecord = true, pelvis = true } = {}) {
  const f = fixtureFile;
  const files = new Map([
    [fpSkeletonPath({}), f('armfp.nif')], [FP_CLIP_PATH, f('armfpidle.kf')],
    ['meshes/fixture/armfphand.nif', f('armfphand.nif')], ['meshes/fixture/armfparm.nif', f('armfparm.nif')],
    ['meshes/xbase_anim.nif', f('armfp.nif')], ['meshes/xbase_anim.kf', f('armfpidle.kf')],
    ['meshes/l/lantern_01.nif', f('weapon.nif')],
  ]);
  if (pelvis) files.set('animations/xbase_anim/pelvisaddon.nif', PELVIS_ADDON);
  const esm = f('armfp.esm');
  const extra = [bodyRec('b_fprace_m_hand', 'fixture\\armfphand.nif', 'fprace', 5), bodyRec('b_fprace_m_upperarm', 'fixture\\armfparm.nif', 'fprace', 8)];
  if (lanternRecord) extra.push(Uint8Array.from(LANTERN_LIGH));
  const all = new Uint8Array(esm.length + extra.reduce((a, r) => a + r.length, 0));
  all.set(esm, 0); let o = esm.length; for (const r of extra) { all.set(r, o); o += r.length; }
  const counters = { opened: 0 };
  return {
    counters,
    loadMorrowindArchives: async () => { counters.opened++; return [{ has: (p) => files.has(p), get: (p) => files.get(p), list: () => [...files.keys()] }]; },
    storedMorrowindNames: async () => ['armfp.esm'],
    loadMorrowindFile: async () => all,
  };
}
const flush = () => new Promise((r) => setTimeout(r, 0));
async function liveBody(opts = {}, depsOpts = {}) {
  const deps = bodyDeps(depsOpts);
  const renderer = countingRenderer();
  renderer.updateParticleEffect = () => {};
  renderer.renderCharacterSpriteImage = () => ({});   // the portrait's one render
  const arm = createFpArm();
  const cam = { pos: [0, 1.6, 0], yaw: 0, move: { forward: 0, strafe: 0, speed: 0, running: false } };
  arm.attach(renderer, () => cam);
  const built = await arm.build({ race: 'fprace', deps, ...opts });
  assert.equal(built.ok, true, built.ok ? '' : `${built.stage}: ${built.error}`);
  assert.equal(built.third?.ok, true, 'the body stands');
  assert.equal(arm.setViewMode('third'), true);
  return { arm, cam, deps, built };
}
const hipRange = (arm) => arm.thirdMesh()?.ranges.find((r) => r.slot === HIP_LIGHT_SLOT);

test('HT-WAIST the live rig: built with the lantern lit at the waist, the BODY carries it at the pelvis the addon joined - and the first-person arm does not (mutant: the build option or the part dropped)', async () => {
  const { arm, built } = await liveBody({ hipLight: true });
  assert.deepEqual(built.third.hipLight, { id: 'lantern_01', name: 'Lantern', model: 'l/lantern_01.nif', bone: 'Bip01 Pelvis', fire: false });
  assert.equal(built.third.arm.skeleton.byName.has('bip01 pelvis'), true, 'the WS1 door joined the pelvis');
  assert.ok(built.third.arm.pieces.some((p) => p.slot === HIP_LIGHT_SLOT && p.hang), 'the part, hanging');
  assert.ok(!built.arm.pieces.some((p) => p.slot === HIP_LIGHT_SLOT), 'the first-person arms have no hip to hang it on');
  arm.update(1 / 60);
  assert.equal(hipRange(arm)?.hidden, false, 'lit: shown');
  const s = arm.status();
  assert.equal(s.hipLit, true); assert.equal(s.hipShown, true);
  arm.unload();
  assert.equal(arm.status().hipLit, false, 'unload drops the light with the rig');
});

test('HT-WAIST the live rig: NOT the carried-left rule - a readied spell hides a held torch and leaves the lantern at the waist shown; put out, it hides, lit again it shows on the fast path (mutant: the hide reading torchVisible, or hipLit ignored)', async () => {
  const { arm, deps } = await liveBody({ hipLight: true });
  arm.update(1 / 60);
  assert.equal(arm.readySpell(true), true, 'a spell readied: the carried-left is hidden (Spell carries the TwoHanded bit)');
  arm.update(1 / 60);
  assert.equal(arm.status().torchShown, false, 'the carried-left rule is in force');
  assert.equal(hipRange(arm).hidden, false, 'the lantern at the waist is in no hand: still shown');
  const opened = deps.counters.opened;
  assert.equal(arm.setHipLight(false), true, 'put out');
  arm.update(1 / 60);
  assert.equal(hipRange(arm).hidden, true, 'hidden, not removed');
  assert.equal(arm.setHipLight(false), false, 'the same answer: nothing changed');
  assert.equal(arm.setHipLight(true), true, 'lit again: the fast path');
  assert.equal(deps.counters.opened, opened, 'no archive reopened for a lantern already hanging there');
  arm.update(1 / 60);
  assert.equal(hipRange(arm).hidden, false);
  arm.unload();
});

test('HT-WAIST the live rig: it SWINGS on the body\'s motion - a walk begun throws it back and the posed lantern with it; at rest it hangs plumb (mutant: the swing not stepped, or not written into the hang)', async () => {
  const { arm, cam, built } = await liveBody({ hipLight: true });
  for (let i = 0; i < 3; i++) arm.update(1 / 60);
  const piece = built.third.arm.pieces.find((p) => p.slot === HIP_LIGHT_SLOT);
  const rest = bbox(piece.positions);
  const restPos = Float32Array.from(piece.positions);
  assert.deepEqual(arm.status().hipSwing, { fore: 0, side: 0 }, 'standing still: plumb');
  cam.move = { forward: 1, strafe: 0, speed: 5, running: false };
  for (let i = 0; i < 12; i++) arm.update(1 / 60);
  const fore = arm.status().hipSwing.fore;
  assert.ok(fore < -0.05, `a walk begun: it lags back (${fore})`);
  const swung = bbox(piece.positions);
  assert.ok(swung.mid[1] < rest.mid[1] - 0.05, 'and the posed lantern with it: its middle is behind where it hung');
  // the PORTRAIT stands still: its lantern hangs plumb whatever the world body's swing is, and the swing survives it
  arm.figure();
  const portrait = bbox(piece.positions);
  sameShape(piece.positions, restPos, 1e-3, 'the portrait\'s lantern hangs straight down, as it did standing still');
  assert.ok(portrait.top[2] > portrait.mn[2], 'from its hook');
  assert.equal(arm.status().hipSwing.fore, fore, 'and the world body\'s swing is untouched by it');
  assert.equal(arm.thirdMesh().ranges.find((r) => r.slot === HIP_LIGHT_SLOT).hidden, false, 'the portrait shows the lit lantern');
  arm.unload();
});

test('HT-WAIST the live rig: lit AFTER the build binds it on the body (the slow path, once); a body with no lantern record says so and is not asked again; a light arriving mid-build is queued, not dropped (mutant: hipLightTried dropped, the queue dropped, lastBuildOpts not carried)', async () => {
  const { arm, deps } = await liveBody({ hipLight: false });
  assert.equal(arm.built().third.hipLight, null, 'built without it');
  const opened = deps.counters.opened;
  const p = arm.setHipLight(true);
  assert.ok(p && typeof p.then === 'function', 'a record to bind: the slow path');
  assert.equal(await p, true);
  assert.equal(deps.counters.opened, opened + 1, 'the archives reopened once');
  assert.equal(arm.built().third.hipLight?.id, 'lantern_01', 'bound on the body');
  arm.update(1 / 60);
  assert.equal(hipRange(arm)?.hidden, false, 'and shown');
  arm.unload();
  // no record: a note, and the refusal remembered
  const none = await liveBody({ hipLight: false }, { lanternRecord: false });
  const o2 = none.deps.counters.opened;
  assert.equal(none.arm.setHipLight(true), true, 'no LIGH lantern to bind: the fast path, nothing to open');
  assert.equal(none.deps.counters.opened, o2);
  assert.equal(none.arm.status().hipShown, false, 'nothing shown for a lantern that is not there');
  none.arm.unload();
  // no pelvis: the bind runs once and the refusal is remembered on the body
  const flat = await liveBody({ hipLight: false }, { pelvis: false });
  const o3 = flat.deps.counters.opened;
  assert.equal(await flat.arm.setHipLight(true), true);
  assert.ok(flat.arm.built().third.notes.some((n) => /^hiplight: this skeleton has no "Bip01 Pelvis"/.test(n)), 'the body says why');
  assert.equal(flat.arm.setHipLight(false), true); assert.equal(flat.arm.setHipLight(true), true, 're-lit: the fast path');
  assert.equal(flat.deps.counters.opened, o3 + 1, 'no second reopen for a bind that already failed here');
  flat.arm.unload();
  // mid-build: the latest light waits for the build and runs
  const q = createFpArm();
  q.attach(countingRenderer(), () => ({ pos: [0, 1.6, 0], yaw: 0 }));
  const d = bodyDeps();
  await q.build({ race: 'fprace', deps: d, hipLight: false });
  const rebuilding = q.build({ race: 'fprace', deps: d, hipLight: false, faceIndex: 1 });
  assert.equal(q.setHipLight(true), false, 'busy: queued');
  await rebuilding;
  for (let i = 0; i < 20 && !q.built()?.third?.hipLight; i++) await flush();
  assert.equal(q.status().hipLit, true, 'the queued light ran');
  assert.equal(q.built().third.hipLight?.id, 'lantern_01');
  q.unload();
});

test('HT-WAIST the wiring: the weapon rig hands the lantern at the waist over per frame beside the torch, and to the sprite body; the portrait shows it lit (mutant: a door dropped)', () => {
  const rig = rd('src/combat/weaponRig.js');
  assert.match(rig, /fpArm\.setTorch\(isLitTorch\(entity\?\.lightSource\)\);\n(?:\s*\/\/[^\n]*\n)*\s*fpArm\.setHipLight\(lanternAtWaist\(entity\?\.lightSource\)\);/, 'per frame, beside the torch');
  assert.match(rig, /hipLight: lanternAtWaist\(entity\.lightSource\),/, 'and at the build');
  assert.match(rig, /hipLantern: !!entity && lanternAtWaist\(entity\.lightSource\),/, 'and to the Eye Of The Beholder body\'s frame state');
  const fp = rd('src/combat/fpArm.js');
  assert.match(fp, /else if \(r\.slot === HIP_LIGHT_SLOT\) r\.hidden = !hipLit;/, 'the portrait shows what you carry, lit');
  assert.match(fp, /else if \(r\.slot === HIP_LIGHT_SLOT\) r\.hidden = !hipVisible\(\);/, 'the world body hides it only unlit');
  assert.match(fp, /if \(eff\.slot === HIP_LIGHT_SLOT\) return !hipVisible\(\);/, 'its flame with it');
  const peers = rd('src/net/peerBodies.js');
  assert.doesNotMatch(peers, /setHipLight|hipLight/, 'peers hold no light on the wire (Morrowind-Rules.md) - not faked here either');
});
