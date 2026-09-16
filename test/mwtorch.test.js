// MW-D51 + MW-D52 (2026-09-16, Mac: "Morrowind model needs a torch to
// hold when a torch is equipped" / "Morrowind crouch animation is
// missing").
//
// MW-D51: THE HELD TORCH. Morrowind's torch is a LIGH record with a
// mesh, carried at the Shield Bone (Slot_CarriedLeft, the shield's own
// slot) and raised by the "torch" group on the LEFT ARM's blend mask at
// Priority_Torch - the first animation in this port to win one mask
// while the frame's winner keeps the rest (rules 25+26, for one mask).
// Daggerfall's word for "a torch is equipped" is PlayerEntity
// .LightSource holding the Torch item, the read Handheld Torches' hand
// law already writes; weaponRig hands it to the arm per frame beside
// the weapon.
//
// MW-D52: THE SNEAK IDLE. refreshIdleAnims takes the idle STATE:
// sneaking on the ground is "idlesneak" where a source carries it, with
// no weapon suffix and no loop dice. The first-person .kf has no such
// group (the arms sink by rule 32(a) instead), so the change lands on
// the THIRD-PERSON body that shares the machine - the body that stood
// upright while the movement clips already sneaked.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  pickTorchRecord, blendMaskBones, overlayTracks, overlaySampler, MW_LIGHT_CARRY, MW_LIGHT_FIRE,
} from '../src/formats/mwFirstPerson.js';
import {
  resolveTorchPart, torchPartPaths, TORCH_BONE, TORCH_GROUP, idleBaseFor, FP_IDLE_SNEAK, FP_IDLE_BASE,
  createFpArm, fpSkeletonPath, FP_CLIP_PATH,
} from '../src/combat/fpArm.js';
import { armBuildOptsOf, isLitTorch } from '../src/combat/weaponRig.js';
import { TEMPLATES } from '../src/systems/useItem.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const rd = (p) => readFileSync(join(root, p), 'utf8');
const f = (n) => new Uint8Array(readFileSync(join(root, 'test/fixtures/mw', n)));

const light = (id, flags = MW_LIGHT_CARRY, model = `l/${id}.nif`) => ({ id, model, name: id, carry: !!(flags & MW_LIGHT_CARRY), fire: !!(flags & MW_LIGHT_FIRE), flags });

// ---------------------------------------------------------------
// MW-D51 - which torch
// ---------------------------------------------------------------
test('MW-D51 pickTorchRecord: a CARRIABLE light named torch, the plain `torch` first, then the shortest id, and only one whose mesh the archives carry (mutant: any rule dropped)', () => {
  const sconce = light('light_torch_sconce', 0);   // a wall torch: not carriable
  const t256y = light('torch_256_yellow');
  const t256 = light('torch_256');
  const plain = light('torch');
  const lantern = light('lantern_01');
  assert.equal(pickTorchRecord([sconce, lantern]), null, 'no carriable torch: null, never a lantern or a sconce');
  assert.equal(pickTorchRecord([sconce, t256y, t256, plain]), plain, 'the plain torch wins');
  assert.equal(pickTorchRecord([t256y, t256]), t256, 'else the shortest id - the base over its variants');
  assert.equal(pickTorchRecord([t256y, t256, plain], { has: (p) => p !== 'meshes/l/torch.nif' }), t256, 'MW-D50: a record whose mesh is not attached is not a candidate');
  assert.equal(pickTorchRecord(null), null);
  assert.equal(pickTorchRecord([{ id: 'torch', model: '', carry: true }]), null, 'a record with no model is no candidate');
});

test('MW-D51 resolveTorchPart / torchPartPaths: nothing unlit; a note, never a throw, for no record, no mesh or no bone; the part at the Shield Bone otherwise (mutant: the bone or the slot misspelled)', () => {
  const plain = light('torch');
  const bytes = new Uint8Array([1, 2, 3]);
  const find = (p) => (p === 'meshes/l/torch.nif' ? { get: () => bytes } : null);
  const yes = () => true;
  assert.deepEqual(resolveTorchPart({ torch: false, allLights: [plain], find, hasBone: yes }), { parts: [], torchInfo: null, notes: [] }, 'unlit: nothing, no note');
  assert.deepEqual(torchPartPaths({ torch: false, allLights: [plain] }), []);
  assert.deepEqual(torchPartPaths({ torch: true, allLights: [plain] }), ['meshes/l/torch.nif'], 'the preload names the mesh');
  const none = resolveTorchPart({ torch: true, allLights: [], find, hasBone: yes });
  assert.equal(none.torchInfo, null); assert.match(none.notes[0], /^torch: your archives carry no carriable Morrowind torch/);
  const gone = resolveTorchPart({ torch: true, allLights: [plain], find: () => null, hasBone: yes });
  assert.match(gone.notes[0], /^torch: meshes\/l\/torch\.nif \(torch\) is not in your archives$/);
  const boneless = resolveTorchPart({ torch: true, allLights: [plain], find, hasBone: () => false });
  assert.equal(boneless.parts.length, 0); assert.match(boneless.notes[0], /^torch: this skeleton has no "Shield Bone"/);
  const ok = resolveTorchPart({ torch: true, allLights: [plain], find, hasBone: (b) => b === TORCH_BONE });
  assert.equal(ok.notes.length, 0);
  assert.equal(ok.parts.length, 1);
  assert.equal(ok.parts[0].slot, 'torch');
  assert.deepEqual(ok.parts[0].bones, ['Shield Bone'], 'PRT_Shield’s bone - Slot_CarriedLeft is the shield’s slot');
  assert.notEqual(ok.parts[0].bytes, bytes, 'a copy, as the weapon takes one (the archive’s view is not the rig’s)');
  assert.deepEqual(ok.torchInfo, { id: 'torch', name: 'torch', model: 'l/torch.nif', bone: 'Shield Bone', fire: false });
  assert.equal(TORCH_GROUP, 'torch');
});

// ---------------------------------------------------------------
// MW-D51 - rule 25's mask and rules 25+26's overlay
// ---------------------------------------------------------------
const skel = () => {
  // Bip01 > Spine1 > { L Clavicle > L UpperArm > L Forearm > L Hand > Shield Bone ; R Clavicle > R Hand } ; Pelvis > L Thigh
  const nodes = new Map();
  const add = (ref, name, parent) => nodes.set(ref, { ref, name, parent, rest: {} });
  add(0, 'Bip01', -1); add(1, 'Bip01 Spine1', 0); add(2, 'Bip01 L Clavicle', 1); add(3, 'Bip01 L UpperArm', 2);
  add(4, 'Bip01 L Forearm', 3); add(5, 'Bip01 L Hand', 4); add(6, 'Shield Bone', 5); add(7, 'Bip01 R Clavicle', 1);
  add(8, 'Bip01 R Hand', 7); add(9, 'Bip01 Pelvis', 0); add(10, 'Bip01 L Thigh', 9);
  return { nodes, byName: new Map([...nodes].map(([r, n]) => [n.name.toLowerCase(), r])) };
};

test('MW-D51 blendMaskBones: the LeftArm mask is every node under "Bip01 L Clavicle" by the parent walk, lowercased - the right arm, the spine and the legs are not in it (mutant: the walk stops early, or a wrong root)', () => {
  const left = blendMaskBones(skel());
  assert.deepEqual([...left].sort(), ['bip01 l clavicle', 'bip01 l forearm', 'bip01 l hand', 'bip01 l upperarm', 'shield bone'].sort());
  assert.deepEqual([...blendMaskBones(skel(), 'Bip01 R Clavicle')].sort(), ['bip01 r clavicle', 'bip01 r hand']);
  assert.equal(blendMaskBones(skel(), 'nothing').size, 0, 'no such root: the empty set, and the caller overlays nothing');
  assert.equal(blendMaskBones(null).size, 0);
});

test('MW-D51 overlayTracks + overlaySampler: a mask bone reads the overlay’s track at the OVERLAY’s clock, every other bone the base’s at the frame’s; a mask bone the overlay does not key falls to the base (mutant: the clock or the fallback dropped)', () => {
  const base = new Map([['bip01 l hand', 'base-hand'], ['bip01 r hand', 'base-rhand'], ['bip01 l forearm', 'base-forearm']]);
  const overlay = new Map([['bip01 l hand', 'torch-hand']]);
  const mask = new Set(['bip01 l hand', 'bip01 l forearm']);
  const tracks = overlayTracks(base, overlay, mask);
  const seen = [];
  const sample = overlaySampler((track, time) => { seen.push([track, time]); return { track, time }; }, 7.5);
  assert.deepEqual(sample(tracks.get('bip01 l hand'), 1.25), { track: 'torch-hand', time: 7.5 }, 'the overlay track at the torch’s own time');
  assert.deepEqual(sample(tracks.get('bip01 r hand'), 1.25), { track: 'base-rhand', time: 1.25 }, 'outside the mask: the base at the frame’s time');
  assert.deepEqual(sample(tracks.get('bip01 l forearm'), 1.25), { track: 'base-forearm', time: 1.25 }, 'in the mask but not keyed by the overlay: the base');
  assert.equal(tracks.get('nothing'), undefined);
  assert.equal(overlayTracks(null, overlay, mask).get('bip01 r hand'), undefined, 'no base: no track, as poseSkeleton expects for a rest bone');
  assert.deepEqual(sample(undefined, 2), { track: undefined, time: 2 }, 'the sampler passes a missing track through untouched');
});

// ---------------------------------------------------------------
// MW-D52 - the sneak idle
// ---------------------------------------------------------------
test('MW-D52 idleBaseFor: "idlesneak" while sneaking on the ground where a source carries it; the plain idle in the air or without the group (mutant: any term dropped)', () => {
  const has = (g) => g === 'idlesneak';
  assert.equal(idleBaseFor({ sneaking: true, inJump: false, hasGroup: has }), FP_IDLE_SNEAK);
  assert.equal(idleBaseFor({ sneaking: true, inJump: true, hasGroup: has }), FP_IDLE_BASE, 'the jump owns the air');
  assert.equal(idleBaseFor({ sneaking: false, inJump: false, hasGroup: has }), FP_IDLE_BASE);
  assert.equal(idleBaseFor({ sneaking: true, inJump: false, hasGroup: () => false }), FP_IDLE_BASE, 'the first-person .kf has no sneak idle: plain, as hasAnimation’s miss');
  assert.equal(idleBaseFor(), FP_IDLE_BASE);
  assert.equal(FP_IDLE_SNEAK, 'idlesneak');
});

// ---------------------------------------------------------------
// The machine, on the fixture rig
// ---------------------------------------------------------------
test('MW-D51 setTorch on a built arm: the fast path flips the light and the card; no LIGH record means no archive reopens; the sneak stance reaches refreshIdle (mutant: the flag not stored, or the doused torch still "shown")', async () => {
  const files = new Map([
    [fpSkeletonPath({}), f('armfp.nif')],
    [FP_CLIP_PATH, f('armfpidle.kf')],
    ['meshes/fixture/armfphand.nif', f('armfphand.nif')],
    ['meshes/fixture/armfparm.nif', f('armfparm.nif')],
  ]);
  let opened = 0;
  const deps = {
    loadMorrowindArchives: async () => { opened++; return [{ has: (p) => files.has(p), get: (p) => files.get(p) }]; },
    storedMorrowindNames: async () => ['armfp.esm'],
    loadMorrowindFile: async () => f('armfp.esm'),
  };
  const renderer = {
    gl: null,
    createCharacterMesh: () => ({ vao: {}, buffers: [] }),
    updateCharacterMesh: () => {},
    renderCharacterSprite: () => ({ tex: {} }),
    drawScreenOverlayQuad: () => {},
    createCharacterTexture: (mips) => ({ mips }),
  };
  const arm = createFpArm();
  assert.equal(arm.setTorch(true), false, 'nothing built: nothing to light, nothing thrown');
  let sneak = false;
  arm.attach(renderer, () => ({ pos: [0, 1.6, 0], yaw: 0, sneaking: sneak }));
  const built = await arm.build({ race: 'fprace', deps, torch: true });
  assert.equal(built.ok, true, built.ok ? '' : `${built.stage}: ${built.error}`);
  assert.equal(built.torch, null, 'the fixture master carries no LIGH record');
  assert.ok(built.notes.some((n) => /^torch: your archives carry no carriable Morrowind torch/.test(n)), 'and the build says so');
  assert.deepEqual(built.allLights, []);
  assert.equal(built.leftArm.size, 0, 'the fixture rig is cut down to an arm: no clavicle, no LeftArm mask, no overlay');
  let s = arm.status();
  assert.equal(s.torchLit, true, 'the build was asked for a lit torch');
  assert.equal(s.torchShown, true, 'sheathed: the carried-left is visible');
  assert.equal(s.torchGroup, null, 'the fixture .kf has no "torch" group');
  assert.ok(s.clipNotes.some((n) => /^torch: no source gives "torch"/.test(n)), 'asked once, said once');
  const before = opened;
  assert.equal(arm.setTorch(true), false, 'same state: the fast path answers false');
  assert.equal(arm.setTorch(false), true, 'doused');
  assert.equal(arm.status().torchLit, false);
  assert.equal(arm.status().torchShown, false);
  assert.equal(arm.setTorch(true), true, 'lit again - no LIGH record to bind, so no slow path');
  assert.equal(opened, before, 'the archives were not reopened for a light that has no record');
  for (let i = 0; i < 3; i++) if (arm.ready()) arm.update(1 / 60);
  assert.equal(arm.frames, 3, 'the frame runs with the torch slot empty');
  assert.ok(arm.mesh().ranges.every((r) => r.slot !== 'torch'), 'no torch range on this rig');
  // MW-D52: the stance reaches the idle refresh; the fixture .kf has no
  // sneak idle, so the group stays plain - the law is in idleBaseFor.
  sneak = true;
  arm.update(1 / 60);
  s = arm.status();
  assert.equal(s.sneaking, true);
  assert.equal(s.idleGroup, 'idle', 'no "idlesneak" in the fixture: the plain idle, as hasAnimation’s miss');
  arm.unload();
  assert.equal(arm.status().torchLit, false, 'unload drops the light with the rig');
});

// ---------------------------------------------------------------
// The wiring, by source
// ---------------------------------------------------------------
test('MW-D51/52 pins: the rig hands the lit light over per frame and at the build; the arm hides the torch on the carried-left rule, overlays it on both rigs, re-picks it on a view switch; the idle reads the stance (mutant: a door dropped)', () => {
  const rig = rd('src/combat/weaponRig.js');
  assert.match(rig, /torch: isLitTorch\(entity\.lightSource\),/, 'armBuildOptsOf carries the lit light');
  assert.match(rig, /fpArm\.setWeapon\(playerWeapon\.weapon, \{ hasAmmo: hasDaggerfallArrows\(entity\?\.items\) \}\);\n(?:\s*\/\/[^\n]*\n)*\s*fpArm\.setTorch\(isLitTorch\(entity\?\.lightSource\)\);/, 'the per-frame hand-over, beside the weapon');
  assert.equal(isLitTorch({ templateIndex: TEMPLATES.Torch }), true);
  assert.equal(isLitTorch({ templateIndex: TEMPLATES.Lantern }), false, 'a lantern is the classic lane’s');
  assert.equal(isLitTorch(null), false);
  const opts = armBuildOptsOf({ race: 'Argonian', gender: 'male', faceIndex: 0, items: [], lightSource: { templateIndex: TEMPLATES.Torch } });
  assert.equal(opts.torch, true);
  const arm = rd('src/combat/fpArm.js');
  assert.match(arm, /function torchVisible\(\) \{\n\s+if \(!torchLit \|\| !built \|\| !built\.ok\) return false;\n\s+const drawn = animWeaponType\(built\.mwType, sheathed, spellReady\);\n\s+return !\(isRealWeapon\(drawn\) && \(weaponFlags\(drawn\) & MW_TWO_HANDED\)\);/, 'updateCarriedLeftVisible: a REAL two-handed weapon drawn hides it; a spell and fists keep it');
  assert.equal((arm.match(/else if \(r\.slot === 'torch'\) r\.hidden = !torchVisible\(\);/g) ?? []).length, 2, 'both world meshes hide on the rule');
  assert.match(arm, /else if \(r\.slot === 'torch'\) r\.hidden = !torchLit;/, 'the portrait shows the lit light whatever the hand holds');
  assert.equal((arm.match(/overlayTracks\((?:tBase|fBase), torchSource\.trackMap, (?:t|built)\.leftArm\)/g) ?? []).length, 2, 'the overlay on both rigs’ own LeftArm sets');
  assert.equal((arm.match(/overlaySampler\(sampleTrack, torchState\.time\)/g) ?? []).length, 2, 'sampled at the torch’s own clock, both rigs');
  assert.match(arm, /resetIdle\(\);\n\s+refreshTorch\(true\);\s+\/\/ MW-D51/, 'setViewMode re-picks the torch on the new rig’s sources');
  assert.match(arm, /refreshTorch\(\);\n\s+if \(torchState\) advanceClip\(torchState, \(torchSource \|\| rig\(\)\)\.keys, dt, null\);/, 'the torch’s own clock, on its own keys');
  assert.match(arm, /pickAnimSource\(r\.sources, TORCH_GROUP, resetClip, \{ loopFallback: true \}\)/, '"torch", start to stop, looping');
  assert.match(arm, /const base = idleBaseFor\(\{ sneaking, inJump: !!jumpState, hasGroup \}\);/, 'MW-D52: refreshIdle takes the state');
  assert.match(arm, /const short = base === FP_IDLE_SNEAK \? null : weaponShortGroup\(type\);/, 'the sneak idle rolls no loop dice');
  assert.match(arm, /if \(pendingTorch !== null\) \{ const l = pendingTorch; pendingTorch = null; api\.setTorch\(l\); \}/, 'a light that arrived mid-build is not dropped (MAC-S1’s law)');
  const menu = rd('src/ui/enhancedMenu.js');
  assert.match(menu, /\['Torch', armState\.torch/, 'the card names the carried light beside the weapon');
  const peers = rd('src/net/peerBodies.js');
  assert.doesNotMatch(peers, /torch:/, 'a peer’s look carries no light on the wire yet - recorded, not faked');
});
