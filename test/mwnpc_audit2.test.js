// AUDIT MW-NPC II (2026-10-10, Mac: "Please audit and ensure perfection" - bible/04-Characters/Morrowind-NPCs.md
// section 23): the second audit's findings - five cold lenses over the arc at 154d59fd80 (the GPU skin, the lanes and
// the budget, the hosts, the looks, the proof) and the merge of main's MERCHANT-YARDS - each pinned where the code that
// fixes it lives, each red on the code before its fix (tools/mutants/auditmwnpc2.json).
import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createExteriorFoes } from '../src/scenes/exteriorFoes.js';
import { foeLook, foeSeed, foeWireLook, applyWireLook } from '../src/characters/foeBodies.js';
import { validFoeRecord, LOOK_GROUPS } from '../src/net/wire.js';
import { residentWalkerActor, residentLook } from '../src/characters/rosterBodies.js';
import { PEOPLE_WARDROBE } from '../src/characters/peopleBodies.js';
import { createMerchantYards } from '../src/scenes/merchantYardsHost.js';
import { PERSON_TEXTURES, GUARD_TEXTURE } from '../src/characters/mobilePerson.js';
import { createNpcBodies, createFrameBudget, holdNpcBodies, npcBodiesHeld, NPC_HOLD_MS, NPC_FRAME_TIERS } from '../src/characters/npcBodies.js';
import { PeerBodies, createBuildGate, gateBuild, BODY_GATE_STALL_MS, peerBodyKey, peerBuildOpts } from '../src/net/peerBodies.js';
import { buildFpArm, esmLoadOrder } from '../src/combat/fpArm.js';
import { creatureDeps, creaRec } from './fixtures/mw/creatureRig.mjs';
import { creatureLook } from '../src/characters/creatureBodies.js';
import { MOBILE_TYPES as M } from '../src/characters/mobileTypes.js';
import { CREA_FLAG, assembleFirstPersonArm, poseAssembly } from '../src/formats/mwFirstPerson.js';
import { skinLayout, writeSkinPalette, skinnedVertex, skinStreamFloats, SKIN_STATIC_FLOATS } from '../src/formats/mwGpuSkin.js';
import { parseNif } from '../src/formats/mwNifFile.js';
import { extractTracks, sampleTrack } from '../src/formats/mwAnim.js';
import { Renderer } from '../src/render/renderer.js';
import { SKIN_PALETTE_UNIT } from '../src/render/skinPalette.js';
import { body as cloakBody, isCloak, isUnder } from './fixtures/mw/cloakRig.mjs';
import { fitCloakOver } from '../src/formats/mwCloakFit.js';
import { ARMOR_MATERIAL } from '../src/systems/armorMaterials.js';
import { GUARD_MOBILE_TYPE } from '../src/scenes/cityGuards.js';

const rd = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const settle = () => new Promise((r) => setTimeout(r, 0));
const fx = (n) => new Uint8Array(readFileSync(new URL(`./fixtures/mw/${n}`, import.meta.url)));

// ---- the encounter pool on crafted data (WORLD6b's and WATCH1's rigs): a class's career and the room's net ----------
function craftCfg() { const b = new Uint8Array(74); const v = new DataView(b.buffer); b[10] = 8; v.setUint16(52, 4, true); for (let i = 0; i < 8; i++) v.setUint16(58 + i * 2, 50, true); return b; }
function craftMonsterBsa(records) {
  const NAME_FIELD = 14, ENTRY = 18;
  const dataLen = records.reduce((a, [, b]) => a + b.length, 0);
  const out = new Uint8Array(4 + dataLen + ENTRY * records.length); const v = new DataView(out.buffer);
  v.setInt16(0, records.length, true); v.setUint16(2, 0x0100, true);
  let pos = 4;
  for (const [, bytes] of records) { out.set(bytes, pos); pos += bytes.length; }
  for (const [name, bytes] of records) { for (let i = 0; i < name.length; i++) out[pos + i] = name.charCodeAt(i); v.setInt32(pos + NAME_FIELD, bytes.length, true); pos += ENTRY; }
  return out;
}
function classCfg() { const b = new Uint8Array(80); const v = new DataView(b.buffer); v.setUint16(52, 10, true); for (let i = 0; i < 8; i++) v.setUint16(58 + i * 2, 50, true); return b; }
const bsa = craftMonsterBsa([['ENEMY000.CFG', craftCfg()]]);
const stubTex = { getSize: () => ({ width: 64, height: 100 }), getScale: () => ({ width: 0, height: 0 }), recordCount: 8, getFrameCount: () => 4 };
const poolRig = () => ({
  renderer: { createBillboardBatch: () => ({}), destroyBillboardBatch: () => {}, textures: new Map() },
  collider: { raycast: () => Infinity, heightAt: () => 0, raycastHit: () => ({ dist: Infinity, normal: null }), sphereOverlaps: () => false },
  fetchBytes: async (n) => { if (n === 'MONSTER.BSA') return bsa; if (/^CLASS\d\d\.CFG$/.test(n)) return classCfg(); throw new Error(`no ${n} in this pin`); },
  getTexture: async () => stubTex, uploadRecordFrame: () => {}, currentMinute: () => 0, currentPixelKey: () => '3,12',
  playerEntity: { level: 5, reflexes: 2, skills: new Array(40).fill(20), skillUses: new Array(40).fill(0), items: [], activeEffects: [], stats: { strength: 50, agility: 50, luck: 50, speed: 50 } },
  audio: null, onPlayerHurt: () => {}, rolls: () => 0.5, rand: () => 0.5,
});
const netFor = (self) => ({ selfId: () => self, room: () => 'world:3,12', onPeerHit: () => true, toWire: (f) => [f[0], f[1], f[2]], toScene: (p) => [p[0], p[1], p[2]] });
const armour = (look) => look.items.filter((it) => it.group === 'Armor');
/** The owner's spawn on a seeded Math.random - the kit a class foe rolls (enemyEquipment's chances) the same every run. */
async function spawnSeeded(pool, mobileType, feet) {
  const rnd = Math.random;
  let s = 7;
  Math.random = () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
  try { return await pool.spawnFoe(mobileType, feet, { feetGiven: true }); } finally { Math.random = rnd; }
}

test('AUDIT MW-NPC II K2: a peer\'s foe wears its OWNER\'S kit - the record carries the look (`ls` its seed, `lw` a person\'s worn kit) on its first word and every full frame, the puppet stands in its sprite until it has it, then is the owner\'s man in the owner\'s armour and blade (the pool\'s own puppet path)', async () => {
  const owner = createExteriorFoes(poolRig()); owner.setNet(netFor('mac-0001'));
  const reader = createExteriorFoes(poolRig()); reader.setNet(netFor('bob-0002'));
  const knight = await spawnSeeded(owner, M.Knight, [10, 0, 10]);
  assert.ok(armour(foeLook(knight)).length >= 3, 'the owner\'s battlemage stands in the kit he rolled');
  // a word without the look (an older frame, a frame the reader joined after) stands no body - its sprite
  const bare = owner.foesFrame(true);
  const rec = { ...bare.f[0] }; delete rec.ls; delete rec.lw;
  assert.equal(reader.applyFoes('mac-0001', { ...bare, f: [rec] }), true);
  await settle();
  const pup = reader.foes.find((f) => f.puppet === 'mac-0001');
  assert.ok(pup, 'his puppet stands here');
  assert.equal(pup.entity.items.length, 0, 'a puppet carries nothing of its own - its loot is the owner\'s grant');
  assert.equal(foeLook(pup), null, 'no body before the owner\'s word: never another man in another kit');
  // the owner's full frame says it again, and the puppet is the owner's man
  const full = owner.foesFrame(true);
  assert.equal(full.f[0].ls, foeSeed(knight));
  assert.deepEqual(validFoeRecord(full.f[0]).lw, full.f[0].lw, 'the kit through the wire\'s own door');
  assert.equal(reader.applyFoes('mac-0001', full), true);
  assert.deepEqual(foeLook(pup), foeLook(knight), 'one man, one kit, on both machines');
  assert.ok(armour(foeLook(pup)).length >= 3 && foeLook(pup).items.some((it) => it.group === 'Weapons'), 'his armour and his blade');
  // the look rides once: a delta after it carries none, a full frame carries it again
  knight.ai.feet[0] += 1;
  const delta = owner.foesFrame(false);
  assert.equal(delta.f.length, 1);
  assert.equal(delta.f[0].ls, undefined, 'a delta says no look it already said');
  assert.equal(delta.f[0].lw, undefined);
  assert.equal(owner.foesFrame(true).f[0].ls, foeSeed(knight), 'a full frame says it again (a joiner since learns it)');
  // a newer word landing while the puppet still builds keeps the look the first one carried (the pending record)
  const late = createExteriorFoes(poolRig()); late.setNet(netFor('cat-0003'));
  knight.ai.feet[0] += 1;
  late.applyFoes('mac-0001', owner.foesFrame(true));
  knight.ai.feet[0] += 1;
  late.applyFoes('mac-0001', owner.foesFrame(false));
  await settle();
  const latePup = late.foes.find((f) => f.puppet === 'mac-0001');
  assert.deepEqual(foeLook(latePup), foeLook(knight), 'built off the newest word, wearing the first one\'s look');
});

test('AUDIT MW-NPC II K2 (the wire): `ls` a u32, `lw` a piece a slot of [slot, group, template, material, dye, variant] - refused whole when out of bounds; a record without them is a record as ever', () => {
  assert.deepEqual(validFoeRecord({ i: 1, ls: 0xffffffff, lw: [[12, 2, 107, 0, -1, -1]] }), { i: 1, ls: 0xffffffff, lw: [[12, 2, 107, 0, -1, -1]] });
  for (const bad of [{ ls: -1 }, { ls: 2 ** 32 }, { ls: 1.5 }, { lw: [[27, 2, 1, 0, -1, -1]] }, { lw: [[1, LOOK_GROUPS.length, 1, 0, -1, -1]] }, { lw: [[1, 2, 1, 0, -2, -1]] }, { lw: [[1, 2, 1, 0, -1]] }, { lw: [[1, 2, 1.5, 0, -1, -1]] }, { lw: new Array(28).fill([1, 2, 1, 0, -1, -1]) }, { lw: 'x' }]) {
    assert.equal(validFoeRecord({ i: 1, ...bad }), null, JSON.stringify(bad).slice(0, 60));
  }
  assert.deepEqual(validFoeRecord({ i: 1, t: 0 }), { i: 1, t: 0 });
});

test('AUDIT MW-NPC II K3/K4: a seed is minted ONCE and rides the wire - two owners\' number 1s of one species are two men; an heir\'s renumbering keeps the man; a dungeon\'s puppet (stood at its first streamed feet, its `marker`) is its owner\'s man', async () => {
  const man = (feet) => ({ id: 1, seq: 1, mobileType: GUARD_MOBILE_TYPE, gender: 'male', entity: { isClass: true, items: [] }, ai: { feet, yaw: 0 } });
  const mine = man([10, 0, 10]), theirs = man([40, 0, -25]);
  assert.notEqual(foeSeed(mine), foeSeed(theirs), 'each owner\'s watchman number 1 another man (they were twins off the number alone)');
  const s = foeSeed(mine);
  mine.seq = 9; mine.ai.feet = [99, 0, 99];
  assert.equal(foeSeed(mine), s, 'renumbered and walked: the same man');
  // the heir: a reader takes an owner's foe over (the dying owner's last frame names it) and keeps its man and kit
  const owner = createExteriorFoes(poolRig()); owner.setNet(netFor('mac-0001'));
  const heir = createExteriorFoes(poolRig()); heir.setNet(netFor('bob-0002'));
  const knight = await spawnSeeded(owner, M.Knight, [10, 0, 10]);
  heir.applyFoes('mac-0001', owner.foesFrame(true));
  await settle();
  const pup = heir.foes.find((f) => f.puppet === 'mac-0001');
  const look = foeLook(pup);
  heir.applyFoes('mac-0001', owner.foesFrame(true, true, () => 'bob-0002'));
  await settle();
  assert.equal(pup.puppet, null, 'taken over - the heir\'s own now');
  assert.deepEqual(foeLook(pup), look, 'the same man in the same kit, renumbered');
  const onward = heir.foesFrame(true).f.find((r) => r.i === pup.seq);
  assert.equal(onward.ls, foeSeed(knight), 'and the heir streams the very seed on');
  assert.deepEqual(onward.lw, owner.foesFrame(true).f[0].lw, 'and the very kit');
  // the dungeon: a copy stood off a record is its owner's man, not the man its first streamed feet would mint
  const host = { mobileType: 140, gender: 'male', marker: [3.2451, 0, 7.5], entity: { isClass: true, items: [] }, ai: { feet: [3.2451, 0, 7.5], yaw: 0 } };
  const copy = { mobileType: 140, gender: 'male', marker: [3.25, 0, 7.5], _mwWire: 'seed', entity: { isClass: true, items: [] }, ai: { feet: [3.25, 0, 7.5], yaw: 0 } };
  assert.equal(foeLook(copy), null, 'no body before the owner\'s seed');
  applyWireLook(copy, { ls: foeSeed(host) });
  assert.deepEqual(foeLook(copy), foeLook(host), 'the host\'s man');
  const d = rd('src/scenes/dungeonContext.js');
  assert.match(d, /const r = roomRecord\(f, f\._encId, full, true\);/, 'the room\'s encounters ride their seed');
  assert.match(d, /const r = roomRecord\(f, f\._ownSeq, full \|\| !!heirOf, true\);/, 'and a member\'s own foes');
  assert.match(d, /const r = roomRecord\(f, i, full\);/, 'never the layout\'s (every machine seeds those off the layout point - the frame\'s cap)');
  assert.equal((d.match(/f\._mwWire = 'seed'; applyWireLook\(f, newest\);/g) ?? []).length, 2, 'both puppet stands take the owner\'s seed');
  assert.match(d, /if \(f\._mwWire\) applyWireLook\(f, r\);/, 'and every record after');
  assert.match(d, /if \(seeded && \(full \|\| f\._lsSent === undefined\)\) \{ r\.ls = foeSeed\(f\); f\._lsSent = r\.ls; \}/, 'the owner says it on its first record and every full frame');
  assert.equal((d.match(/f\._maxSent = undefined; f\._lsSent = undefined; \}/g) ?? []).length, 2, 'a record the frame\'s cap cut owes its seed again (both lanes)');
  assert.equal((d.match(/\{ \.\.\.r, ls: r\.ls \?\? was\.ls \}/g) ?? []).length, 2, 'a newer word while a puppet builds keeps the seed the first carried (both lanes)');
});

test('AUDIT MW-NPC II K1: a living resident walking the street stands in what the row WEARS NOW - the watch\'s uniform on duty and his own clothes off it, a guild member\'s or a priest\'s class gear, a still picture\'s kind\'s garments - read again when the dress changes; a beggar\'s picture keeps the street', () => {
  const watch = { id: 'L7.3a', job: 'guard', guard: true, archive: GUARD_TEXTURE, civvies: PERSON_TEXTURES.Nord.male[1], race: 'Nord', sex: 'male', gender: 0, face: 2, cls: null };
  const row = { living: { res: watch }, guard: true, cls: null, stillLook: null, stillRole: null, yaw: 0.5, state: 'move' };
  const onDuty = residentWalkerActor(row, [0, 0, 0]);
  assert.ok(armour(onDuty.look).length >= 5, 'on duty: the watch\'s steel, as his uniform is');
  row.guard = false;
  const off = residentWalkerActor(row, [0, 0, 0]);
  assert.equal(armour(off.look).length, 0, 'off duty: his own clothes (census mints every watchman civvies)');
  assert.equal(off.id, onDuty.id, 'one man');
  // a guild hall's member walks in the class livingTown armed him in
  const mage = { id: 'L7.9b', job: 'guildsman', faction: 40, cls: null, race: 'Breton', sex: 'female', gender: 1, archive: PERSON_TEXTURES.Breton.female[0], face: 1 };
  const row2 = { living: { res: mage }, guard: false, cls: M.Battlemage, stillLook: null, stillRole: null, yaw: 0, state: 'move' };
  const armed = residentWalkerActor(row2, [0, 0, 0]);
  assert.equal(armed.drawn, true, 'in the class\'s gear, carrying what its sprite carries');
  assert.deepEqual(armed.look, residentLook({}, mage, { cls: M.Battlemage }), 'the class\'s look in her own race and sex');
  row2.cls = null;
  assert.equal(residentWalkerActor(row2, [0, 0, 0]).drawn, false, 'out of it, her outfit');
  // a priest at the temple's door, a still picture: the priest's robes
  const priest = { id: 'L7.2c', job: 'priest', cls: null, race: 'Breton', sex: 'male', gender: 0, archive: PERSON_TEXTURES.Breton.male[0], face: 0 };
  const row3 = { living: { res: priest }, guard: false, cls: M.Healer, stillLook: { archive: 183, record: 12, frameCount: 1 }, stillRole: 'priest', yaw: 0, state: 'idle' };
  const still = residentWalkerActor(row3, [0, 0, 0]);
  assert.equal(still.look.items[0].templateIndex, PEOPLE_WARDROBE.priest.male[0], 'his robes, the picture\'s kind');
  row3.stillRole = 'beggar';
  assert.equal(residentWalkerActor(row3, [0, 0, 0]), null, 'a beggar sits or lies at their pitch - no body does');
  const town = rd('src/systems/livingWorld/livingTown.js');
  assert.ok(town.includes('if (look) p.still(look, role); }'), 'the town hands the picture\'s kind');
  assert.ok(town.includes('|| (want && (p.stillRole ?? null) !== role)) {'), 'and stills again when only the kind changed (two kinds share pictures)');
  const walker = rd('src/characters/residentWalker.js');
  assert.ok(walker.includes('    this.stillRole = look ? role : null;'), 'the walker keeps it while the picture stands');
  assert.ok(walker.includes('this.stillLook = null; this.stillRole = null; this._stillAnim = null; }'), 'and forgets it with the rest when dressed as another');
  assert.ok(rd('src/scenes/world.js').includes('if (a) folkStreet.offer(a, batch); else batch.castOnly = false;'), 'a row without a body shows its flat');
});

test('AUDIT MW-NPC II P1 (the merge of MERCHANT-YARDS): each yard\'s keeper stands in a body - the town\'s race in the outfit their picture wears, off the yard\'s own key (every client the same keeper), turned to the eye as a standing person is; world.js offers them on the street\'s people lane before it draws', async () => {
  const batches = [];
  const renderer = { textures: new Set(), uploadTexture() {}, createMesh: () => ({}), destroyMesh() {}, drawMesh() {}, createBillboardBatch: (a, r, size) => { const b = { a, r, size }; batches.push(b); return b; }, destroyBillboardBatch() {} };
  const tex = { getSize: () => ({ width: 40, height: 76 }), getScale: () => ({ width: 0, height: 0 }), getFrameCount: () => 3 };
  const deps = () => ({
    renderer, collider: () => ({ addMesh() {}, removeBucket() {} }), getTexture: async () => tex, uploadRecordFrame() {},
    sites: () => [{ key: '7:stable', kind: 'stable', x: 100, z: 50, yaw: 0, comp: 0, regionIndex: 17, race: 'Breton', keeper: { name: 'Gwynara Moorhart', sex: 'female', variant: 1 } },
      { key: '7:transport', kind: 'transport', x: 140, z: 50, yaw: 90, comp: 0, regionIndex: 17, race: 'Redguard', keeper: { name: 'Jalib', sex: 'male', variant: 2 } }],
    groundAt: () => 2, eye: () => [100, 3, 70], feet: () => null, horseArt: () => false, showWagon: () => true, wagonBox: () => null,
    open: () => true, say() {}, midText() {}, now: () => 1000,
  });
  const stand = async () => { const y = createMerchantYards(deps()); y.frame(); await settle(); y.frame(); const got = []; y.offerBodies((a, b) => got.push({ a: { ...a }, b }), [100, 1.7, 80], 1 / 60); return { y, got }; };
  const { y, got } = await stand();
  assert.equal(got.length, 2, 'both keepers');
  const [stable, wagon] = got;
  assert.deepEqual([stable.a.look.race, stable.a.look.gender, wagon.a.look.race, wagon.a.look.gender], ['Breton', 'female', 'Redguard', 'male']);
  assert.ok(y.batches().includes(stable.b), 'offered with the very flat the host draws');
  assert.equal(stable.a.feet, stable.b.origin, 'standing where the flat stands');
  assert.ok(Math.abs(stable.a.yaw - Math.atan2(100 - stable.a.feet[0], 80 - stable.a.feet[2])) < 1e-9, 'facing the eye');
  assert.notEqual(stable.a.id, wagon.a.id, 'two people');
  const again = await stand();
  assert.deepEqual(again.got[0].a.look, stable.a.look, 'the same keeper on another client');
  const w = rd('src/scenes/world.js');
  const offer = w.indexOf("    if (merchantYards && _mode() === 'exterior') merchantYards.offerBodies(offerStreetPerson, mwv.eye, townTalk.overlayActive ? 0 : dt);"), draw = w.indexOf('streetPeople.draw(canvas, proj, view, mwv.eye');
  assert.ok(offer > 0 && offer < draw && draw - offer < 400, 'offered on the people lane, just before it draws');
  assert.ok(w.includes("const offerStreetPerson = (a, b) => streetPeople.offer(a, b);"));
});

test('AUDIT MW-NPC II K5: the transformed Daedra Seducer FLIES, so her body is a creature whose record flies - the build asks the CREA Flies flag and a walker is refused at the record (her sprite stands); one that flies builds', async () => {
  assert.equal(creatureLook({ mobileType: M.DaedraSeducer, mobile: { specialTransformationCompleted: true } }).flies, true);
  assert.deepEqual(peerBuildOpts({ creature: ['winged twilight'], flies: true }), { creature: ['winged twilight'], reachSweep: false, flies: true });
  assert.notEqual(peerBodyKey({ creature: ['winged twilight'], flies: true }), peerBodyKey({ creature: ['winged twilight'] }), 'a flyer\'s body is not a walker\'s spare');
  const walks = await buildFpArm({ creature: 'fixture_beast', flies: true, deps: creatureDeps() });
  assert.equal(walks.ok, false);
  assert.equal(walks.stage, 'record');
  assert.match(walks.error, /does not fly/);
  const flier = await buildFpArm({ creature: 'fixture_beast', flies: true, deps: creatureDeps({ records: [creaRec('fixture_beast', 'r\\creature.nif', { flags: 0x48 | CREA_FLAG.Flies })] }) });
  assert.equal(flier.ok, true, flier.error);
  assert.equal((await buildFpArm({ creature: 'fixture_beast', deps: creatureDeps() })).ok, true, 'a walker asked to walk builds as ever');
});

test('AUDIT MW-NPC II G1: a vertex whose live weights sum to none or less lands where the CPU skin puts it - the post\'s translation - on the GPU too (the layout zeroes its influences; it blended a +0.5/-0.5 one the CPU collapsed)', async () => {
  const arm = await assembleFirstPersonArm({ skeletonBytes: fx('armskel.nif'), parts: [{ slot: 'hand', bytes: fx('armhand.nif') }] });
  const refs = [...arm.skeleton.nodes.keys()];
  const I = { rotation: [1, 0, 0, 0, 1, 0, 0, 0, 1], translation: [3, 4, 5], scale: 1 };
  const bone = (ref, idx, w) => ({ ref, indices: Uint16Array.from(idx), weights: Float32Array.from(w), invBind: { a: Float32Array.from([1, 0, 0, 0, 1, 0, 0, 0, 1]), t: [0.5, -1, 2] } });
  const piece = {
    slot: 'neg', kind: 'skinned', mirrored: false, source: null, attachRef: null, uvs: null, colors: null, material: null,
    batch: { positions: Float32Array.from([1, 2, 3, 4, 5, 6, 7, 8, 9]), normals: null, uvs: null, colors: null, material: null, indices: Uint16Array.from([0, 1, 2]),
      skin: { transform: I, shapeTransform: null, skeletonRoot: -1, rootBone: -1, bones: [bone(refs[1], [0, 1, 2], [0.5, -0.3, 1]), bone(refs[2], [0], [-0.5])] } },
    positions: new Float32Array(9), indices: Uint16Array.from([0, 1, 2]), normals: null,
  };
  arm.pieces.push(piece);
  poseAssembly(arm, { tracks: extractTracks(parseNif(fx('armidle.kf'))), sampleTrack, time: 0.3 });
  const layout = skinLayout(arm.pieces);
  writeSkinPalette(layout, arm);
  for (let v = 0; v < 3; v++) {
    const cpu = Array.from(piece.positions.subarray(v * 3, v * 3 + 3)), gpu = skinnedVertex(layout, piece, v);
    for (let k = 0; k < 3; k++) assert.ok(Math.abs(cpu[k] - gpu[k]) < 1e-4, `vertex ${v}: CPU ${cpu} GPU ${gpu}`);
  }
  assert.deepEqual(Array.from(piece.positions.subarray(0, 6)).map((x) => +x.toFixed(4)), [3, 4, 5, 3, 4, 5], 'the two collapsed onto the post');
  assert.equal(layout.byPiece.get(piece).collapse, true, 'and the box law knows it');
});

test('AUDIT MW-NPC II G2: the masters by their WHOLE names - a mod named like one ("Morrowind Patch.esm") loads after the masters, never before the master it patches', () => {
  assert.deepEqual(esmLoadOrder(['Bloodmoon.esm', 'Morrowind Patch.esm', 'Morrowind.esm', 'Tribunal.esm', 'Bloodmoon_fix.esm']),
    ['Morrowind.esm', 'Tribunal.esm', 'Bloodmoon.esm', 'Morrowind Patch.esm', 'Bloodmoon_fix.esm']);
  assert.deepEqual(esmLoadOrder(['data/TRIBUNAL.ESM', 'data/morrowind.esm']), ['data/morrowind.esm', 'data/TRIBUNAL.ESM'], 'any case, any folder');
});

/** stub rigs that count their skins */
function countingRig(c) {
  return () => { const r = { mode: 'first', skinned: false, attach() {}, async build() { c.builds = (c.builds | 0) + 1; await settle(); return { ok: true }; }, canThirdPerson: () => true, raceHeightScale: () => 1, setViewMode(m) { r.mode = m; return true; }, thirdActive: () => r.mode === 'third' && r.skinned, update(dt, o) { if (o?.pose !== false) { r.skinned = true; c.skins++; } }, drawThird: () => true, unload() {}, setSheathed() {}, revive() {}, die() {} }; return r; };
}
const person = (id, x, z, face = id) => ({ id, look: { race: 'Breton', gender: 'male', faceIndex: face % 10, items: [] }, feet: [x, 0, z], yaw: 0, dead: 0 });

test('AUDIT MW-NPC II H2: under the Overworld no NPC lane stands a body - the hold (world.js, every frame the travel view is up) lets every body fall to its sprite and lapses on its own when no frame asks it', async () => {
  const c = { skins: 0 };
  let t = 0;
  const lane = createNpcBodies({ renderer: {}, tier: () => 'near', createRig: countingRig(c), now: () => t, budget: createFrameBudget() });
  const crowd = [person(1, 0, -4), person(2, 3, -6)];
  const frame = async () => { t += 16; lane.begin(); for (const a of crowd) lane.stand('folk', a); lane.end(1 / 60, [0, 0, 0]); await settle(); await settle(); return crowd.map((a) => lane.has('folk', a.id)); };
  try {
    for (let i = 0; i < 10; i++) await frame();
    assert.deepEqual(await frame(), [true, true], 'on the ground: their bodies');
    holdNpcBodies(true);
    assert.equal(npcBodiesHeld(), true);
    assert.deepEqual(await frame(), [false, false], 'under the Overworld: none - their flats');
    holdNpcBodies(false);
    for (let i = 0; i < 5; i++) await frame();
    assert.deepEqual(await frame(), [true, true], 'down again: their bodies');
    holdNpcBodies(true, performance.now() - NPC_HOLD_MS - 1);
    assert.equal(npcBodiesHeld(), false, 'a hold no frame renewed has lapsed (a room\'s frame, a dungeon\'s, never asks it)');
  } finally { holdNpcBodies(false); lane.destroy(); }
  const w = rd('src/scenes/world.js');
  const tvf = w.indexOf('const tvf = travelView?.frame(dt'), hold = w.indexOf('holdNpcBodies(!!tvf);'), lanes = w.indexOf('const _peopleOn = streetPeople.frame();');
  assert.ok(tvf > 0 && hold > tvf && hold < lanes, 'asked each frame from the view, before any lane stands its people');
});

test('AUDIT MW-NPC II H3: in the dungeon a corpse flat minted under a standing body casts alone from its first frame, and one whose body went this frame (the cut, the switch) is drawn on the foes\' pass after the sync - the level\'s pass draws the flats before drawFoes marks them (by source)', () => {
  const d = rd('src/scenes/dungeonContext.js');
  assert.match(d, /f\.corpseBatch = batch;[^\n]*\n\s*batch\.castOnly = !!_npcLane\?\.has\('foe', foeId\(f\)\);[^\n]*\n\s*billboardBatches\.push\(batch\);/, 'minted cast-only where the body stands');
  const was = d.indexOf('if (f.corpseBatch?.castOnly) _corpseWasCast.push(f.corpseBatch);'), reset = d.indexOf('if (f.corpseBatch) f.corpseBatch.castOnly = false;', was);
  assert.ok(was > 0 && reset > was && reset - was < 120, 'what the level\'s pass drew cast-only, read before the reset');
  const mark = d.indexOf("for (const f of _npcStood) { const b = f.dead ? f.corpseBatch : f.batch; if (b) b.castOnly = npcLane.has('foe', foeId(f)); }");
  const late = d.indexOf('for (const b of _corpseWasCast) if (!b.castOnly) _corpseLate.push(b);'), drawn = d.indexOf('if (_corpseLate.length) renderer.drawBillboards(_corpseLate,');
  assert.ok(mark > 0 && late > mark && drawn > late, 'after the sync\'s marks, the flats whose body went drawn this frame');
});

test('AUDIT MW-NPC II H4/H5: the gate\'s host - a body first seen falling keeps its own number (two were `host:undefined`, one body); the boss\'s and his host\'s bodies carry WB13d\'s hit flash their cast-only billboards hold (by source)', () => {
  const g = rd('src/scenes/gateHost.js'), c = rd('src/scenes/gateCourt.js');
  assert.match(g, /const b = bodies\.get\(g\.i\) \?\? \{ i: g\.i, look: hostLookOf\(g\.k, P\.aspect\.id\),/);
  assert.match(g, /dead: dead \? 1 \+ \(\(b\.i \| 0\) % 3\) : 0 \}\), b\.batch,\s*null, b\.batch\.hitFlash \|\| 0\);/);
  assert.match(c, /scale: \(body\.scale \?\? 1\) \* \(profileOf\(s\)\.size \?\? 1\) \}\), shown, null, shown\.hitFlash \|\| 0\);/);
});

test('AUDIT MW-NPC II L1: the page\'s build gate builds one body at a time, a player\'s (a peer\'s, the family\'s) ahead of every NPC build still waiting; a build that holds it past BODY_GATE_STALL_MS lets the next go', async (t) => {
  const gate = createBuildGate(), order = [];
  let open;
  gateBuild(gate, async () => { order.push('npcA+'); await new Promise((r) => { open = r; }); order.push('npcA-'); }, true);
  gateBuild(gate, () => { order.push('npcB'); }, true);
  gateBuild(gate, () => { order.push('npcC'); }, true);
  gateBuild(gate, () => { order.push('peer'); }, false);
  await settle();
  assert.deepEqual(order, ['npcA+'], 'one at a time');
  open();
  for (let i = 0; i < 6; i++) await settle();
  assert.deepEqual(order, ['npcA+', 'npcA-', 'peer', 'npcB', 'npcC'], 'the peer next, ahead of the street\'s queue');
  assert.match(rd('src/net/peerBodies.js'), /if \(this\._gate\) this\._queue = gateBuild\(this\._gate, build, this\._buildInRange\);/, 'an NPC lane\'s builds wait low');
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const g2 = createBuildGate(), o2 = [];
  gateBuild(g2, () => new Promise(() => { o2.push('wedged'); }), true);
  gateBuild(g2, () => { o2.push('next'); }, false);
  const micro = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); };
  await micro();
  assert.deepEqual(o2, ['wedged']);
  t.mock.timers.tick(BODY_GATE_STALL_MS);
  await micro();
  assert.deepEqual(o2, ['wedged', 'next'], 'the stalled build no longer holds every body behind it');
  t.mock.timers.reset();
});

test('AUDIT MW-NPC II L2: a frozen frame in an NPC lane (a talk window holds the street) keeps the bodies\' skins - the frame it shuts poses no more than the frame\'s budget, never every body at once', async () => {
  const c = { skins: 0 };
  let t = 0;
  const lane = createNpcBodies({ renderer: {}, tier: () => 'near', createRig: countingRig(c), now: () => t, budget: createFrameBudget() });
  const crowd = Array.from({ length: 20 }, (_, i) => person(i, Math.cos(i) * (3 + i), Math.sin(i) * (3 + i)));
  const frame = async (dt) => { t += 16; c.skins = 0; lane.begin(); for (const a of crowd) lane.stand('folk', a); lane.end(dt, [0, 0, 0]); await settle(); await settle(); return c.skins; };
  for (let i = 0; i < 120; i++) await frame(1 / 60);
  const standing = crowd.filter((a) => lane.has('folk', a.id)).length;
  assert.ok(standing > NPC_FRAME_TIERS.near.skins, `more bodies than a frame's skins (${standing})`);
  for (let i = 0; i < 10; i++) await frame(0);
  const shut = await frame(1 / 60);
  assert.ok(shut <= NPC_FRAME_TIERS.near.skins, `the frame the window shuts: ${shut} skins, the budget ${NPC_FRAME_TIERS.near.skins}`);
  lane.destroy();
});

test('AUDIT MW-NPC II L3: a living newcomer takes a far body\'s slot - unseen, its sprite already stands - before a standing corpse\'s, whatever the pool\'s order (B3\'s law, which the party-mate branch skipped)', async () => {
  let t = 0;
  const tiers = { off: null, near: { max: 3, range: 30, skinBudget: 4, spareMax: 4 }, all: null };
  const lane = createNpcBodies({ renderer: {}, tier: () => 'near', tiers, createRig: countingRig({ skins: 0 }), now: () => t, budget: createFrameBudget(), frameTiers: { off: null, near: { bodies: 3, skins: 4 }, all: null } });
  const d = person('d', 0, -5, 1), a = person('a', 0, -6, 2), f = person('f', 0, -12, 3), n = person('n', 0, -7, 4);
  const frame = async (actors) => { t += 1000 / 60; lane.begin(); for (const x of actors) lane.stand('foe', x); lane.end(1 / 60, [0, 0, 0]); await settle(); await settle(); return Object.fromEntries(actors.map((x) => [x.id, lane.has('foe', x.id)])); };
  for (let i = 0; i < 30; i++) await frame([d, a, f]);
  d.dead = 1;
  for (let i = 0; i < 10; i++) await frame([d, a, f]);
  const r = await frame([d, a, f, n]);
  assert.equal(r.d, true, 'the corpse keeps its body');
  assert.equal(r.f, false, 'the far one gave its slot');
  lane.destroy();
});

test('AUDIT MW-NPC II (lens 1\'s latent): a sprite batch opened inside an open one joins it - the inner flush draws nothing, the outer draws every body queued in both (an inner begin dropped the outer\'s queue)', () => {
  const quads = [];
  const r = Object.create(Renderer.prototype);
  Object.assign(r, { _spriteBatch: { items: [], open: false, depth: 0 }, stats: { spriteBinds: 0 }, _renderCharacterSpriteTiles: () => 'tiles', drawCharacterSpriteQuad: (...q) => quads.push(q) });
  const item = (k) => ({ k, pw: 8, ph: 8, quad: { at: [k, 0, 0], halfW: 1, halfH: 1, right: [1, 0, 0], hitFlash: 0, conceal: null, up: null, fx: null } });
  r.beginCharacterSpriteBatch();
  r.queueCharacterSprite(item(1));
  r.beginCharacterSpriteBatch();
  r.queueCharacterSprite(item(2));
  assert.equal(r.flushCharacterSpriteBatch(), 0, 'the inner flush is the outer\'s to make');
  assert.equal(r.characterSpriteBatchOpen, true);
  assert.equal(quads.length, 0);
  assert.equal(r.flushCharacterSpriteBatch(), 1);
  assert.deepEqual(quads.map((q) => q[1][0]), [1, 2], 'both bodies drawn, in one bind');
  assert.equal(r.characterSpriteBatchOpen, false);
});

/** WebGL2 as a recorder (mwnpc2_onepass.test.js's) */
function recordingGl() {
  const calls = [];
  let ids = 0;
  const consts = { TEXTURE0: 33984, TEXTURE_2D: 3553, TEXTURE_2D_ARRAY: 35866, FRAMEBUFFER: 36160, ARRAY_BUFFER: 34962, RGBA32F: 34836 };
  const gl = new Proxy({}, {
    get(_, k) {
      if (k in consts) return consts[k];
      if (k === 'getProgramParameter' || k === 'getShaderParameter') return () => true;
      if (k === 'getUniformLocation') return (_p, n) => n;
      if (k === 'getAttribLocation') return () => 0;
      if (k === 'checkFramebufferStatus') return () => 36053;
      if (typeof k === 'string' && k.startsWith('create')) return () => ({ id: ++ids });
      if (k === 'getParameter') return () => new Float32Array(4);
      if (typeof k === 'string' && k.toUpperCase() === k) return 1;
      return (...args) => { calls.push([k, ...args]); };
    },
  });
  return { gl, calls, canvas: { getContext: () => gl, clientWidth: 640, clientHeight: 480, width: 640, height: 480 } };
}

test('AUDIT MW-NPC II P2: the GPU skin\'s GL on a real Renderer - the stream\'s attributes where packSkinStream writes them (one pair and two), the palette an RGBA32F texture on its own unit, a pose its texSubImage2D, a moved part\'s corners its bufferSubData at the float offset, and the release putting the identity back before the delete', () => {
  for (const pairs of [1, 2]) {
    const { calls, canvas } = recordingGl();
    const r = new Renderer(canvas);
    calls.length = 0;
    const floats = skinStreamFloats(pairs);
    const mesh = r.createSkinnedCharacterMesh(new Float32Array(floats * 3), { floats, pairs, width: 12, height: 2 });
    const attrs = calls.filter((c) => c[0] === 'vertexAttribPointer').map((c) => [c[1], c[2], c[5], c[6]]);
    const want = [[0, 3, floats * 4, 0], [1, 3, floats * 4, 12], [2, 3, floats * 4, 24], [3, 2, floats * 4, 36], [4, 3, floats * 4, 44]];
    for (let p = 0; p < pairs; p++) want.push([5 + 2 * p, 4, floats * 4, 4 * (SKIN_STATIC_FLOATS + 8 * p)], [6 + 2 * p, 4, floats * 4, 4 * (SKIN_STATIC_FLOATS + 4 + 8 * p)]);
    want.push([9, 1, floats * 4, (floats - 1) * 4]);
    assert.deepEqual(attrs, want, `${pairs} pair(s): each attribute where the stream holds it`);
    const unit = calls.findIndex((c) => c[0] === 'activeTexture' && c[1] === 33984 + SKIN_PALETTE_UNIT);
    const made = calls.findIndex((c) => c[0] === 'texImage2D');
    assert.ok(unit >= 0 && made > unit, 'made on the palette\'s unit');
    assert.deepEqual(calls[made].slice(1, 6), [3553, 0, 34836, 12, 2], 'RGBA32F, width x height');
    calls.length = 0;
    const pal = new Float32Array(12 * 2 * 4);
    r.updateSkinPalette(mesh, pal);
    const sub = calls.find((c) => c[0] === 'texSubImage2D');
    assert.ok(sub && sub[5] === 12 && sub[6] === 2 && sub[9] === pal, 'a pose: the palette re-sent whole');
    calls.length = 0;
    const corners = new Float32Array(floats);
    r.updateSkinStream(mesh, 10, corners);
    assert.deepEqual(calls.find((c) => c[0] === 'bufferSubData').slice(1), [34962, 40, corners], 'the moved corners at their byte offset');
    calls.length = 0;
    const tex = mesh.skin.tex;
    r.releaseCharacterSkin(mesh);
    const bind = calls.findIndex((c) => c[0] === 'bindTexture' && c[2] !== tex), del = calls.findIndex((c) => c[0] === 'deleteTexture' && c[1] === tex);
    assert.ok(bind >= 0 && del > bind, 'the identity on the unit before the palette goes');
  }
});

test('AUDIT MW-NPC II P5: a FITTED cloak whose authored normals do not match its vertices is lit by its faces on the GPU as on the CPU - its batch\'s normals rebuilt full length by the fit, its piece\'s posed normals none (the mwnpcmerge record called "equivalent" was not)', async () => {
  const asm = await cloakBody(ARMOR_MATERIAL.Steel);
  const cloak = asm.pieces.find(isCloak);
  cloak.batch = { ...cloak.batch, normals: cloak.batch.normals.slice(0, cloak.batch.normals.length - 3) };
  cloak.normals = null;
  fitCloakOver(asm, { isCloak, isUnder });
  assert.equal(cloak.normals, null, 'its posed normals none');
  assert.equal(cloak.batch.normals.length, cloak.batch.positions.length, 'its batch\'s rebuilt full length by the fit');
  assert.equal(skinLayout(asm.pieces).byPiece.get(cloak).nrm, null, 'face-lit on the GPU, as packFpArm lights it');
});
