// AUDIT 68 (2026-09-24), the whole-tree sweep - cluster combat_bf: the
// Morrowind rig (fpArm), the bow's draw, the overhaul's archery arm and the
// MW/classic format readers (mwFirstPerson, mwNpc, mwTexture, mwParticles).
// One pin per behavioural fix, each proven to fail on the base source; the
// refactors in the cluster (one sampler, one affine, one ReadCString, one
// part-reference reader) are guarded by the suites that already cover them.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as fpArmModule from '../src/combat/fpArm.js';
import { createFpArm, buildFpArm, collectArmTextures, fpSkeletonPath, FP_CLIP_PATH } from '../src/combat/fpArm.js';
import { pcaaoModules, installPcaao, uninstallPcaao } from '../src/combat/pcaao.js';
import { adjustWeaponHitChanceMod } from '../src/combat/formulas.js';
import { setModSetting, _resetModSettings } from '../src/systems/modSettings.js';
import { PlayerWeapon } from '../src/combat/playerWeapon.js';
import { MwBsaFile } from '../src/formats/mwBsaFile.js';
import { MW_WEAPON_TYPE, bodyParts, facePools, playerBodyRows } from '../src/formats/mwFirstPerson.js';
import { parseEsm } from '../src/formats/mwEsmFile.js';
import { indexSkins, assembleNpc } from '../src/formats/mwNpc.js';
import { decodeTga } from '../src/formats/mwTexture.js';
import { particleSystemsOf, interpColorKey } from '../src/formats/mwParticles.js';
import { bodyRec } from './fixtures/mw/bodyRig.mjs';

const f = (n) => new Uint8Array(readFileSync(new URL(`./fixtures/mw/${n}`, import.meta.url)));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const concat = (...parts) => {
  const out = new Uint8Array(parts.reduce((a, p) => a + p.length, 0));
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
};
/** Wait until the rig has settled: no busy-exit notification for 200 ms. */
async function quiet(count) {
  let last = count();
  for (let still = 0, i = 0; still < 20 && i < 500; i++) {
    await sleep(10);
    if (count() === last) still++;
    else { last = count(); still = 0; }
  }
}

// ── the fixture rig (fparm.test.js's MAC-S1 arrangement) ──────────────
const RIG_FILES = () => new Map([
  [fpSkeletonPath({}), f('armfp.nif')],
  [FP_CLIP_PATH, f('armfpidle.kf')],
  ['meshes/fixture/armfphand.nif', f('armfphand.nif')],
  ['meshes/fixture/armfparm.nif', f('armfparm.nif')],
  ['textures/tx_fixture.dds', f('fixture.dds')],
]);
function rigDeps({ gen = null, reads = null } = {}) {
  const files = RIG_FILES();
  const get = (p) => { if (reads && p === 'textures/tx_fixture.dds') reads.n++; return files.get(p); };
  return {
    loadMorrowindArchives: async () => [{ has: (p) => files.has(p), get }],
    storedMorrowindNames: async () => ['armfp.esm'],
    loadMorrowindFile: async () => f('armfp.esm'),
    ...(gen ? { morrowindDataGeneration: gen } : {}),
  };
}
async function builtRig(deps = rigDeps()) {
  const arm = createFpArm();
  let settled = 0;
  arm.subscribe(() => { settled++; });
  const res = await arm.build({ race: 'fprace', deps });
  assert.equal(res.ok, true, `the fixture rig must stand (${res.stage}: ${res.error})`);
  return { arm, settled: () => settled };
}
const KITE = [{ kind: 'armor', templateIndex: 111, material: 0x0200 }];
const CUIRASS = [{ kind: 'armor', templateIndex: 102, material: 0 }];
const DAGGER = { group: 'Weapons', templateIndex: 113, material: 0 };

// ── a LAZY archive: a real MwBsaFile opened off a Blob ────────────────
/** A Morrowind BSA v0x100 (the layout at the head of mwBsaFile.js; the
 *  writer mwload_fparm.test.js carries), so a lazily opened archive can
 *  carry the arm fixture. */
function makeBsa(files) {
  const names = [...files.keys()];
  const enc = new TextEncoder();
  const nameBytes = names.map((n) => enc.encode(n.replace(/\//g, '\\')));
  let nameBufSize = 0;
  const nameOffsets = [];
  for (const nb of nameBytes) { nameOffsets.push(nameBufSize); nameBufSize += nb.length + 1; }
  const dirSize = 12 * names.length + nameBufSize;
  const dataSize = names.reduce((a, n) => a + files.get(n).length, 0);
  const out = new Uint8Array(12 + dirSize + 8 * names.length + dataSize);
  const dv = new DataView(out.buffer);
  dv.setUint32(0, 0x100, true); dv.setUint32(4, dirSize, true); dv.setUint32(8, names.length, true);
  let o = 12;
  let off = 0;
  for (const n of names) { dv.setUint32(o, files.get(n).length, true); dv.setUint32(o + 4, off, true); o += 8; off += files.get(n).length; }
  for (const no of nameOffsets) { dv.setUint32(o, no, true); o += 4; }
  for (const nb of nameBytes) { out.set(nb, o); o += nb.length; out[o++] = 0; }
  o += 8 * names.length;
  for (const n of names) { out.set(files.get(n), o); o += files.get(n).length; }
  return out;
}
const wpdt = (id, model, type) => {
  const A = (x) => [...x].map((c) => c.charCodeAt(0));
  const Z = (x) => [...A(x), 0];
  const U = (n) => [n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255];
  const sub = (n, d) => [...A(n), ...U(d.length), ...d];
  const w = new Uint8Array(32);
  new DataView(w.buffer).setInt16(8, type, true);
  const d = [...sub('NAME', Z(id)), ...sub('MODL', Z(model)), ...sub('FNAM', Z('W')), ...sub('WPDT', [...w])];
  return [...A('WEAP'), ...U(d.length), ...U(0), ...U(0), ...d];
};
const BOW_ARCHIVE = makeBsa(new Map([
  [fpSkeletonPath({}), f('armfp.nif')],
  [FP_CLIP_PATH, f('armfpweapon.kf')],
  ['meshes/fixture/armfphand.nif', f('armfphand.nif')],
  ['meshes/fixture/armfparm.nif', f('armfparm.nif')],
  ['meshes/w/bowmesh.nif', f('bowmesh.nif')],
  ['meshes/w/arrow.nif', f('arrow.nif')],
  ['meshes/w/weapon.nif', f('weapon.nif')],
  ['textures/tx_fixture.dds', f('fixture.dds')],
]));
const WEAP_ESM = Uint8Array.from([
  ...wpdt('long bow', 'w/bowmesh.nif', MW_WEAPON_TYPE.MarksmanBow),
  ...wpdt('iron arrow', 'w/arrow.nif', MW_WEAPON_TYPE.Arrow),
  ...wpdt('iron staff', 'w/weapon.nif', MW_WEAPON_TYPE.BluntTwoWide),
]);
const bowDeps = (archive) => ({
  loadMorrowindArchives: async () => [archive],
  storedMorrowindNames: async () => ['armfp.esm', 'weap.esm'],
  loadMorrowindFile: async (n) => (n === 'weap.esm' ? WEAP_ESM : f('armfp.esm')),
});

// ═══ S08: the overhaul's archery arm, the bow's draw ═══════════════════

test('AUDIT 68 S08-pcaao-rr-archery-dead-vendor-key: the overhaul reads Roleplay & Realism under its vendored id - on by default, off with the mod or its switch', () => {
  _resetModSettings();
  try {
    assert.equal(pcaaoModules().rolePlayRealismArchery, true, 'RR is vendored as roleplay-realism and on by default');
    setModSetting('roleplay-realism', 'advancedArchery', false);
    assert.equal(pcaaoModules().rolePlayRealismArchery, false, 'its advancedArchery switch off');
    setModSetting('roleplay-realism', 'advancedArchery', true);
    setModSetting('roleplay-realism', 'Enabled', false);
    assert.equal(pcaaoModules().rolePlayRealismArchery, false, 'the mod itself off: not loaded');
    _resetModSettings();
    // ...and the registered hook bends a snap shot by default
    installPcaao();
    const bow = { group: 'Weapons', templateIndex: 129, material: 1, flags: 0 };
    assert.equal(adjustWeaponHitChanceMod({ isPlayer: true }, {}, 30, 100, bow), -10, 'a 100 ms draw: -40');
  } finally {
    uninstallPcaao();
    _resetModSettings();
  }
});

test('AUDIT 68 S08-bow-draw-time-wallclock: the draw is the machine\'s held ticks (game time), and every bow release writes it', () => {
  const pw = new PlayerWeapon({ weapon: { group: 'Weapons', templateIndex: 130, material: 0 } });
  pw.sheathed = false;
  pw.update(0.001);
  assert.equal(pw.machine.isBow, true);
  const g = (held) => pw.gesture(0, 0, held, 0.07, 1000, { bowDrawback: true, swingMode: 0 });
  assert.equal(g(true), 'StrikeUp');
  for (let i = 0; i < 16; i++) { pw.update(0.07); g(true); }
  assert.equal(pw.machine.ticks, 16);
  assert.equal(g(false), 'StrikeDown');
  assert.equal(pw.lastDrawMs, 1000, '16 held ticks x 0.0625 s - GetAnimTime, not the wall clock between the two events');
  // the touch button's shot from Idle held nothing, and says so
  for (let i = 0; i < 100; i++) pw.update(0.05);
  assert.equal(pw.machine.state, 'Idle');
  pw.lastDrawMs = 1234;
  assert.equal(pw.clickAttack(), 'StrikeDown');
  assert.equal(pw.lastDrawMs, 0, 'the tap wrote its own draw time instead of inheriting the last shot\'s');
});

// ═══ S08 / X7: the Morrowind rig ═════════════════════════════════════

test('AUDIT 68 S08-fparm-busy-queue-drops-latest: mid-build, the LATEST request wins on every channel - worn X->Y->X, a weapon swap and back, a light lit and doused', async () => {
  // worn: X starts a rebuild, Y queues, X again must replace the queued Y
  {
    const { arm, settled } = await builtRig();
    const p = arm.setWorn(KITE);
    assert.ok(p && typeof p.then === 'function', 'the first table rebuilds');
    arm.setWorn(CUIRASS);
    arm.setWorn(KITE);
    await p;
    await quiet(settled);
    assert.equal(arm.setWorn(KITE), false, 'the body wears the LATEST table (X), not the queued Y');
  }
  // weapon: bare hands -> dagger (the slow path) -> bare hands while it runs
  {
    const { arm, settled } = await builtRig();
    const swap = arm.setWeapon(DAGGER, { hasAmmo: false });
    assert.ok(swap && typeof swap.then === 'function', 'the swap takes the slow path');
    assert.equal(arm.setWeapon(null, { hasAmmo: false }), false, 'queued behind the swap');
    await swap;
    await quiet(settled);
    assert.equal(arm.setWeapon(null, { hasAmmo: false }), false, 'the hand went back to bare');
  }
  // light: lit then doused while a rebuild holds the rig
  {
    const { arm, settled } = await builtRig();
    const p = arm.setWorn(KITE);
    arm.setTorch(true);
    arm.setTorch(false);
    await p;
    await quiet(settled);
    assert.equal(arm.status().torchLit, false, 'the douse was the last word');
  }
});

test('AUDIT 68 S08-fparm-ammocount-dropped / X7-pendingweapon-drops-ammocount: the quiver\'s count rides the queued swap and the equip-follow rebuild', async () => {
  // the rebuild a worn change runs carries the count the hand swap brought
  {
    const { arm } = await builtRig();
    assert.equal(await arm.setWeapon(DAGGER, { hasAmmo: true, ammoCount: 3 }), true);
    const seen = [];
    const real = arm.build;
    arm.build = (o) => { seen.push(o); return real.call(arm, o); };
    await arm.setWorn(KITE);
    assert.equal(seen.length, 1);
    assert.equal(seen[0].ammoCount, 3, 'lastBuildOpts carries the hand\'s quiver');
  }
  // the request queued behind a rebuild replays with its count
  {
    const { arm, settled } = await builtRig();
    const p = arm.setWorn(KITE);
    assert.equal(arm.setWeapon(DAGGER, { hasAmmo: true, ammoCount: 3 }), false, 'queued');
    const replays = [];
    const real = arm.setWeapon;
    arm.setWeapon = (item, opts) => { replays.push(opts); return real.call(arm, item, opts); };
    await p;
    await quiet(settled);
    assert.equal(replays.length, 1, 'the flush replays the queued hand');
    assert.equal(replays[0].ammoCount, 3, 'with its count');
  }
});

test('AUDIT 68 S08-fparm-gen-cache-leak: the decode memos hold ONE data generation - a new one drops the old, and so does an unload after the bump', async () => {
  let g = 6801;
  const reads = { n: 0 };
  const deps = rigDeps({ gen: () => g, reads });
  const counts = [];
  for (const gen of [6801, 6801, 6802, 6801]) {
    g = gen;
    reads.n = 0;
    const res = await buildFpArm({ race: 'fprace', deps });
    assert.equal(res.ok, true, `${res.stage}: ${res.error}`);
    counts.push(reads.n);
  }
  assert.deepEqual(counts, [1, 0, 1, 1], 'decoded, memoised, a new generation decodes - and the old one was DROPPED, not kept');
  // Remove data: the rig unloads after the store bumped (weaponRig's fpRecheck)
  const arm = createFpArm();
  g = 6803;
  assert.equal((await arm.build({ race: 'fprace', deps })).ok, true);
  assert.ok(fpArmModule._memoEntryCount() > 0, 'the build memoised');
  g = 6804;
  arm.unload();
  assert.equal(fpArmModule._memoEntryCount(), 0, 'the old generation went with the rig');
});

test('AUDIT 68 S08-fparm-gen-cache-leak: a texture whose load FAILED is not the generation\'s answer - the next ask decodes it', async () => {
  const res = await buildFpArm({ race: 'fprace', deps: rigDeps() });
  assert.equal(res.ok, true, `${res.stage}: ${res.error}`);
  const arc = await MwBsaFile.open(new Blob([BOW_ARCHIVE]));
  const gen = 'audit68-texture';
  const first = [...collectArmTextures(res.arm.pieces, [arc], gen).values()];
  assert.ok(first.length && first.every((e) => !e.ok), 'nothing loaded yet: the warning image stands in');
  await arc.load('textures/tx_fixture.dds');
  const second = [...collectArmTextures(res.arm.pieces, [arc], gen).values()];
  assert.ok(second.every((e) => e.ok), `the bytes arrived, so the texture decodes (${second.map((e) => e.error).join(' | ')})`);
});

test('AUDIT 68 X7-fparm-swap-rejection-unhandled: a swap whose mesh will not load settles false with a note, keeps the old weapon, and is not retried by the frame door', async () => {
  const real = await MwBsaFile.open(new Blob([BOW_ARCHIVE]));
  let staffLoads = 0;
  const archive = {
    has: (p) => real.has(p), loaded: (p) => real.loaded(p), get: (p) => real.get(p), list: () => real.list(),
    load: (p) => {
      if (/weapon\.nif$/.test(p)) { staffLoads++; return Promise.reject(new Error('Failed to fetch')); }
      return real.load(p);
    },
  };
  const arm = createFpArm();
  const built = await arm.build({ race: 'fprace', weapon: { templateIndex: 130 }, hasAmmo: true, deps: bowDeps(archive) });
  assert.equal(built.ok, true, `${built.stage}: ${built.error}`);
  const staff = { templateIndex: 115, material: 0 };
  const r = arm.setWeapon(staff, { hasAmmo: false });
  await assert.doesNotReject(r, 'no unhandled rejection - the CRASH overlay, once a frame');
  assert.equal(await r, false);
  assert.equal(arm.setWeapon(staff, { hasAmmo: false }), false, 'the failed key is remembered - no per-frame retry');
  assert.equal(staffLoads, 1, 'one fetch, not one a frame');
  const st = arm.status();
  assert.equal(st.weapon.id, 'long bow', 'the old weapon stands');
  assert.ok(st.notes.some((n) => /^weapon: the swap to this weapon failed/.test(n)), 'and the card says why');
});

// ═══ S11: the format readers ═════════════════════════════════════════

test('AUDIT 68 S11-faceid-case: a mixed-case head id the matcher or the table names is the head the body wears', () => {
  const parts = bodyParts(concat(
    bodyRec('B_Head_01', 'f\\h1.nif', 'fprace', 0),
    bodyRec('B_Head_02', 'f\\h2.nif', 'fprace', 0),
    bodyRec('B_Head_03', 'f\\h3.nif', 'fprace', 0),
    bodyRec('b_hair_01', 'f\\hair1.nif', 'fprace', 1),
  ));
  // the matcher measures facePools' records and answers their RAW id
  const matched = facePools(parts, 'fprace', false).heads[1].id;
  assert.equal(matched, 'B_Head_02');
  const head = (opts) => playerBodyRows(parts, 'fprace', false, { faceIndex: 0, faceTable: {}, ...opts }).find((r) => r.slot === 'head');
  const m = head({ faceMatch: { head: matched, hair: null } });
  assert.equal(m.record.id, 'B_Head_02', 'the measured likeness is kept');
  assert.match(m.verdict, /matched to the portrait/);
  const c = head({ faceTable: { fprace: { male: { 0: { head: 'B_Head_03' } } } } });
  assert.equal(c.record.id, 'B_Head_03', 'the curated id is found whatever its case');
  assert.match(c.verdict, /curated/);
});

test('AUDIT 68 S11-indexskins-1st: a skin\'s first-person twin never dresses the third-person body', () => {
  const esm = parseEsm(concat(
    f('fixture.esm'),
    bodyRec('b_test_hands', 'test\\hands.nif', 'testrace', 5),
    bodyRec('b_test_hands.1st', 'test\\hands.1st.nif', 'testrace', 5),
  ));
  assert.equal(indexSkins(esm.bodies).get('testrace').get(5).male.id, 'b_test_hands');
  const hand = assembleNpc(esm, 'test npc').parts.find((p) => p.slot === 'hand');
  assert.equal(hand.bodyId, 'b_test_hands', 'the NPC wears its third-person hands');
});

test('AUDIT 68 S11-tga-15bpp / S11-v-tga-grey16: a 15-bit pixel and colour map are two bytes, and 16-bit greyscale is grey plus alpha', () => {
  const tga = (o, data) => {
    const b = new Uint8Array(18 + data.length);
    b[1] = o.mapType ?? 0; b[2] = o.type;
    b[5] = o.mapLength ?? 0; b[7] = o.mapDepth ?? 0;
    b[12] = o.w; b[14] = o.h; b[16] = o.depth; b[17] = o.desc ?? 0x20;
    b.set(data, 18);
    return b;
  };
  const RED_BLUE = [255, 0, 0, 255, 0, 0, 255, 255];
  assert.deepEqual([...decodeTga(tga({ type: 2, w: 2, h: 1, depth: 15 }, [0x00, 0x7c, 0x1f, 0x00])).mips[0].rgba], RED_BLUE, 'true-colour 5-5-5');
  assert.deepEqual([...decodeTga(tga({ type: 1, mapType: 1, mapLength: 2, mapDepth: 15, w: 2, h: 1, depth: 8 }, [0x00, 0x7c, 0x1f, 0x00, 0, 1])).mips[0].rgba], RED_BLUE, 'a 15-bit colour map');
  assert.deepEqual([...decodeTga(tga({ type: 3, w: 1, h: 1, depth: 16, desc: 0x28 }, [0x80, 0x40])).mips[0].rgba], [128, 128, 128, 64], 'grey 0x80, alpha 0x40');
  assert.deepEqual([...decodeTga(tga({ type: 3, w: 1, h: 1, depth: 8 }, [0x80])).mips[0].rgba], [128, 128, 128, 255], '8-bit grey unchanged');
});

test('AUDIT 68 S11-colorkey-tbc: a TCB-keyed NiColorData ramps on the generated tangents, not linearly', () => {
  const I3 = Float32Array.from([1, 0, 0, 0, 1, 0, 0, 0, 1]);
  const node = (o) => ({ type: 'NiNode', name: '', flags: 0, translation: [0, 0, 0], rotation: I3, scale: 1, properties: [], children: [], effects: [], controller: -1, ...o });
  const slots = Array.from({ length: 4 }, () => ({ velocity: [0, 0, 0], rotationAxis: [0, 0, 0], age: 0, lifeSpan: 0, lastUpdate: 0, spawnGeneration: 0, code: 0 }));
  // readKeyGroupOf's TCB shape: {time, value, tbc} and no tangents
  const tcb = { type: 3, keys: [0, 1, 0].map((v, i) => ({ time: i * 0.5, value: [v, v, v, v], tbc: [0, 0, 0] })) };
  const nif = { roots: [0], records: [
    node({ name: 'Root', children: [1] }),
    { ...node({ name: 'Fire', flags: 0x20 | 0x80, children: [2] }), type: 'NiBSParticleNode' },
    { ...node({ name: 'Flame' }), type: 'NiAutoNormalParticles', data: 3, skin: -1, controller: 4 },
    { type: 'NiAutoNormalParticlesData', numVertices: 4, vertices: new Float32Array(12), normals: null, colors: null, uvSets: [], numParticles: 4, particleRadius: 1, numActive: 0, sizes: null },
    {
      type: 'NiParticleSystemController', next: -1, flags: 0x8, frequency: 1, phase: 0, startTime: 0, stopTime: 1e9, target: 2,
      speed: 1, speedVariation: 0, declination: 0, declinationVariation: 0, planarAngle: 0, planarAngleVariation: 0,
      initialNormal: [0, 0, 1], initialColor: [1, 1, 1, 1], initialSize: 1, emitStartTime: 0, emitStopTime: 1e9, resetParticleSystem: 0,
      birthRate: 0, lifetime: 1, lifetimeVariation: 0, useBirthRate: 0, spawnOnDeath: 0, emitterDimensions: [0, 0, 0], emitter: 1,
      numSpawnGenerations: 0, percentageSpawned: 0, spawnMultiplier: 0, spawnSpeedChaos: 0, spawnDirChaos: 0, numValid: 0, particles: slots,
      emitterModifier: -1, particleModifier: 5, particleCollider: -1, staticTargetBound: 0,
    },
    { type: 'NiParticleColorModifier', next: -1, controller: 4, colorData: 6 },
    { type: 'NiColorData', data: tcb },
  ] };
  const [d] = particleSystemsOf(nif);
  const colour = d.modifiers.find((m) => m.type === 'color');
  assert.ok(colour, 'the colour modifier is on the descriptor');
  const at = interpColorKey(colour.keys, 0.25, colour.interpolation);
  // generateTCBTangents with t=c=b=0: out0 = 1, in1 = 0 -> h(0.5) = 0.125 + 0.5 = 0.625
  assert.ok(at.every((v) => Math.abs(v - 0.625) < 1e-6), `TCB, not linear (0.5): ${at}`);
});
