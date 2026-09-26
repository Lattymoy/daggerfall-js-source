// MW-EARLY (Mac: "The player shouldnt load into the game and have to wait
// for the morrowind models to load") - THE ARMS START WITH THE LOAD, NOT
// AFTER IT. The world's load door knows the save it will restore the
// moment the boot begins, and the Morrowind build needs only that
// character and the attached files; it was asked for at the END of
// bootWorld, after every archive of the world was read and the save
// restored, so the player stood in the world on the classic sprite while
// the body built. Pins: the rig says whom a build under way is for
// (fpArm buildingFor - the queued one first, cleared on settle and on
// unload); armsStandFor counts a build under way for the same identity as
// standing, and never a different one; the save's entity carries exactly
// the build opts a restore's would (items through setItemFields, the
// table through fillEquipTable, the light by its index); the early door
// counts an uncounted store, builds, and never throws; autoBuildArms at
// the restore does not queue a second body behind the early one; and the
// world host wires it before the world's data is read, off the same pick
// its load door restores.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createFpArm, fpSkeletonPath, FP_CLIP_PATH } from '../src/combat/fpArm.js';
import { armsStandFor, armIdentityOf, armBuildOptsOf, saveArmsEntity, prebuildArmsForSave, autoBuildArms } from '../src/combat/weaponRig.js';
import { EQUIP_SLOTS, equipTableOf, rebuildEquipState, fillEquipTable } from '../src/systems/equip.js';
import { setItemFields } from '../src/systems/itemTemplates.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const rd = (p) => readFileSync(join(ROOT, p), 'utf8');
const f = (n) => new Uint8Array(readFileSync(join(ROOT, 'test/fixtures/mw', n)));

const LONGSWORD = 120, CUIRASS = 102, TORCH = 247;

/** The fixture rig's deps, with the archive open held until `release()` - so a build can be caught in flight. */
function heldRig() {
  const files = new Map([
    [fpSkeletonPath({}), f('armfp.nif')],
    [FP_CLIP_PATH, f('armfpidle.kf')],
    ['meshes/fixture/armfphand.nif', f('armfphand.nif')],
    ['meshes/fixture/armfparm.nif', f('armfparm.nif')],
  ]);
  let release;
  const gate = new Promise((r) => { release = r; });
  const deps = {
    loadMorrowindArchives: async () => { await gate; return [{ has: (p) => files.has(p), get: (p) => files.get(p) }]; },
    storedMorrowindNames: async () => ['armfp.esm'],
    loadMorrowindFile: async () => f('armfp.esm'),
  };
  return { deps, release };
}
const settle = async (until, tries = 400) => { for (let i = 0; i < tries && !until(); i++) await new Promise((r) => setTimeout(r, 5)); };

test('MW-EARLY buildingFor: null at rest, the identity of the build in flight, the QUEUED identity once one waits, null again on settle and on unload (mutant: never set, never cleared, the queue ignored)', async () => {
  const arm = createFpArm();
  assert.equal(arm.buildingFor(), null, 'no build: nobody');
  const held = heldRig();
  const first = arm.build({ race: 'fprace', faceIndex: 1, deps: held.deps });
  assert.deepEqual(arm.buildingFor(), { race: 'fprace', female: false, faceIndex: 1 }, 'the build in flight says whom it builds');
  const queued = await arm.build({ race: 'fprace', faceIndex: 2, deps: held.deps });
  assert.equal(queued.queued, true);
  assert.deepEqual(arm.buildingFor(), { race: 'fprace', female: false, faceIndex: 2 }, 'the queued one is who will stand once the queue drains');
  held.release();
  await first;
  await settle(() => arm.buildingFor() === null);
  assert.equal(arm.buildingFor(), null, 'settled: `built` answers now');
  assert.deepEqual(arm.builtFor(), { race: 'fprace', female: false, faceIndex: 2 });
  // an unload mid-build: the landing build stands for nobody, so a door after it builds again
  const again = heldRig();
  const inFlight = arm.build({ race: 'fprace', faceIndex: 5, deps: again.deps });
  assert.deepEqual(arm.buildingFor(), { race: 'fprace', female: false, faceIndex: 5 });
  arm.unload();
  assert.equal(arm.buildingFor(), null, 'unloaded: the build in flight lands dead');
  again.release();
  assert.match((await inFlight).error, /unloaded while building/);
});

test('MW-EARLY armsStandFor: a build UNDER WAY for the same race, sex and face stands - before anything is ready; one for anybody else does not, even over a standing arm of the right identity; with none under way the old law holds', () => {
  const her = { race: 'Argonian', gender: 'female', faceIndex: 3 };
  const forHer = armIdentityOf(her);
  const other = { ...forHer, faceIndex: 4 };
  assert.equal(armsStandFor(her, { ready: () => false, builtFor: () => null, buildingFor: () => forHer }), true, 'her build is on its way: no second one');
  assert.equal(armsStandFor(her, { ready: () => false, builtFor: () => null, buildingFor: () => other }), false, 'another face on its way is not hers');
  assert.equal(armsStandFor(her, { ready: () => true, builtFor: () => forHer, buildingFor: () => other }), false, 'her arm stands, but a different one is about to replace it - her door queues her back');
  assert.equal(armsStandFor(her, { ready: () => false, builtFor: () => null, buildingFor: () => ({ ...forHer, female: false }) }), false, 'the male body on its way is not hers');
  assert.equal(armsStandFor(her, { ready: () => true, builtFor: () => forHer, buildingFor: () => null }), true, 'nothing under way: the standing arm answers');
  assert.equal(armsStandFor(her, { ready: () => false, builtFor: () => forHer, buildingFor: () => null }), false, 'nothing under way and nothing ready: no');
});

test('MW-EARLY autoBuildArms: the restore\'s door finds the early build under way and builds nothing - its default standing law IS armsStandFor, whose build-under-way arm answers (mutant: the arm dropped, or the door given another law)', async () => {
  const her = { race: 'Argonian', gender: 'female', faceIndex: 3, chargenDone: true, items: [] };
  let measured = 0;
  const opts = { dataCount: () => 1, measure: async () => { measured++; return 1; }, measured: () => 'print' };
  const underWay = (who) => (e) => armsStandFor(e, { ready: () => false, builtFor: () => null, buildingFor: () => who });
  assert.equal(await autoBuildArms(her, { ...opts, standing: underWay(armIdentityOf(her)) }), null, 'no second build of the same body');
  assert.equal(measured, 0, 'and nothing measured for it');
  assert.match(rd('src/combat/weaponRig.js'), /export async function autoBuildArms\(entity, \{ dataCount = morrowindDataCount, measure = registerMorrowindData, measured = morrowindDataFingerprint, standing = armsStandFor \} = \{\}\) \{/, 'the door\'s own standing law is armsStandFor');
});

test('MW-EARLY saveArmsEntity: the save\'s own race, sex, face and chargenDone; the items as restorePlayer reads them; the worn table by fillEquipTable (the first claim of a slot wins); the light by its index; exactly the build opts a restored entity gives (mutant: the table unfilled, the light dropped, the items raw)', () => {
  const items = [
    { group: 'Weapons', templateIndex: LONGSWORD, material: 2, equipSlot: EQUIP_SLOTS.RightHand, currentCondition: 800, maxCondition: 800 },
    { group: 'Armor', templateIndex: CUIRASS, material: 1, equipSlot: EQUIP_SLOTS.ChestArmor, currentCondition: 4096, maxCondition: 4096 },
    { group: 'Armor', templateIndex: CUIRASS, material: 3, equipSlot: EQUIP_SLOTS.ChestArmor, currentCondition: 4096, maxCondition: 4096 },   // a second claim of the chest: loses
    { group: 'UselessItems2', templateIndex: TORCH, currentCondition: 50, maxCondition: 50 },
  ];
  const snap = { race: 'Nord', gender: 'female', faceIndex: 6, chargenDone: true, items, lightSourceIndex: 3 };
  const e = saveArmsEntity(snap);
  assert.equal(e.race, 'Nord'); assert.equal(e.gender, 'female'); assert.equal(e.faceIndex, 6); assert.equal(e.chargenDone, true);
  const sent = items.map((it) => setItemFields(it));
  delete sent[2].equipSlot;   // the losing claim's mark, dropped by the fill (below)
  assert.deepEqual(e.items, sent, 'the items through setItemFields, as the restore sends them');
  const table = equipTableOf(e);
  assert.equal(table[EQUIP_SLOTS.RightHand], e.items[0]);
  assert.equal(table[EQUIP_SLOTS.ChestArmor], e.items[1], 'the first claim wins');
  assert.equal(e.items[2].equipSlot, undefined, 'and the loser loses its mark, as rebuildEquipState drops it');
  assert.equal(e.lightSource, e.items[3], 'the light is the record at the save\'s index');
  // the same opts a RESTORED entity gives - rebuildEquipState's table over the same items, the light relinked the same way
  const restored = { race: 'Nord', gender: 'female', faceIndex: 6, items: items.map((it) => setItemFields(it)) };
  rebuildEquipState(restored);
  const want = armBuildOptsOf({ ...restored, lightSource: restored.items[3] });
  assert.deepEqual(armBuildOptsOf(e), want);
  assert.equal(want.torch, true); assert.equal(want.weapon.templateIndex, LONGSWORD); assert.ok(want.armor.length > 0, 'the fixture wears what it should');
  // the snapshot is not written: a later restore reads it whole
  assert.equal(items[2].equipSlot, EQUIP_SLOTS.ChestArmor, 'the save\'s own records are untouched');
  assert.equal(saveArmsEntity(null), null);
  assert.equal(saveArmsEntity({ race: 'Nord' }), null, 'no pack: no entity');
  assert.equal(saveArmsEntity({ ...snap, lightSourceIndex: -1 }).lightSource, null, 'nothing lit');
});

test('MW-EARLY fillEquipTable: rebuildEquipState is it plus the armor values and the listeners - one fill law, two readers (mutant: a second copy of the loop)', () => {
  const slots = new Array(27).fill('stale');
  const a = { equipSlot: 19 }, b = { equipSlot: 19 }, c = { equipSlot: 18 }, d = {};
  assert.equal(fillEquipTable(slots, [a, b, c, d]), slots);
  assert.equal(slots[19], a); assert.equal(slots[18], c); assert.equal(b.equipSlot, undefined);
  assert.equal(slots.filter((s) => s === 'stale').length, 0, 'every slot emptied first');
  const src = rd('src/systems/equip.js');
  assert.match(src, /export function rebuildEquipState\(entity\) \{\n\s*const slots = fillEquipTable\(equipTableOf\(entity\), entity\.items\);/);
  assert.equal((src.match(/if \(slots\[it\.equipSlot\]\) \{ delete it\.equipSlot; continue; \}/g) ?? []).length, 1, 'the fill loop has one home');
});

test('MW-EARLY prebuildArmsForSave: counts a store nobody counted, builds the save\'s entity, and never throws - a null snapshot builds nothing', async () => {
  const snap = { race: 'Breton', gender: 'male', faceIndex: 2, chargenDone: true, items: [], lightSourceIndex: -1 };
  const calls = [];
  const res = await prebuildArmsForSave(snap, { counted: () => false, count: async () => { calls.push('count'); return 1; }, build: async (e) => { calls.push(['build', e.race, e.faceIndex]); return { ok: true }; } });
  assert.deepEqual(calls, ['count', ['build', 'Breton', 2]], 'counted first (a boot past the menu has not), then built');
  assert.deepEqual(res, { ok: true });
  calls.length = 0;
  await prebuildArmsForSave(snap, { counted: () => true, count: async () => { calls.push('count'); }, build: async () => { calls.push('build'); } });
  assert.deepEqual(calls, ['build'], 'a counted store is not counted again');
  calls.length = 0;
  assert.equal(await prebuildArmsForSave(null, { counted: () => false, count: async () => calls.push('count'), build: async () => calls.push('build') }), null);
  assert.deepEqual(calls, [], 'no save: nothing asked');
  const warn = console.warn; console.warn = () => {};
  try { assert.equal(await prebuildArmsForSave(snap, { counted: () => true, build: async () => { throw new Error('boom'); } }), null, 'a throwing build is a warning, never the boot\'s end'); }
  finally { console.warn = warn; }
});

test('MW-EARLY wiring: the world host starts the arms off the load door\'s own pick BEFORE the world\'s data is read, and the door restores that same pick (mutant: the early call moved below the reads, or a second pick law)', () => {
  const world = rd('src/scenes/world.js');
  const early = world.indexOf('if (bootLoadPick) prebuildArmsForSave(pickedSaveSnap(bootLoadPick));');
  const reads = world.indexOf("status('loading data');");
  assert.ok(early > 0 && reads > 0 && early < reads, 'the build starts before the first archive of the world is read');
  assert.ok(world.lastIndexOf('audio.ensure(fetchBytes);', early) > world.indexOf('export async function bootWorld('), 'inside the boot, beside the audio boot');
  assert.match(world, /function pickedSaveSnap\(\{ key = null, mostRecent = false \} = \{\}\) \{\n\s*return key != null \? loadSlot\(key\) : mostRecent \? \(mostRecentRestorable\(\)\?\.snap \?\? null\) : null;\n\s*\}/);
  assert.match(world, /await worldQuickLoad\(bootLoadPick\);/, 'the door restores the pick the early build read');
  assert.equal((world.match(/params\.has\('loadkey'\)/g) ?? []).length, 1, 'the load door\'s pick is decided in one place');
});
