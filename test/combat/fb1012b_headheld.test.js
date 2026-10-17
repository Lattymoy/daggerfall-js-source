// FIELD BUGS 2026-10-12b HEAD-HELD - "morrowind NPCs missing heads" (Boistun, a knight in iron armour, a nub of neck
// above his collar and no head). composeWornArmor hides the head and the hair a helm takes (worn.shadows) before the
// helm's own mesh is read or bound; a helm that then bound nothing - its mesh not in the archives, no shape its bone
// takes, a parse that threw - was only a note, and the neck stood alone. The never-traps law ("every miss is a note and
// the skin stands"): the rows a helm hid and never covered come back. bible/01-Overview/bugs/Field-Bugs-2026-10-12b.md.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { bareHeadRows } from '../../src/combat/fpArm.js';
import { composeWornArmor } from '../../src/formats/morrowind/mwItemMap.js';
import { ARMOR_ENUM } from '../../src/combat/enemyEquipment.js';
import { ARMOR_MATERIAL } from '../../src/systems/armorMaterials.js';
import { PART_BONES } from '../../src/formats/morrowind/mwNpc.js';

// the producer's own verdict: an iron helm whose body part is the head (Boistun's knight's roll, wardrobe.js 0.3)
const helmed = () => composeWornArmor({
  pieces: [{ templateIndex: ARMOR_ENUM.Helm, material: ARMOR_MATERIAL.Iron }],
  armors: [{ id: 'iron_helmet', model: 'g.nif', name: '', enchanted: false, parts: [{ part: 0, male: 'b_helm', female: null }] }],
  bodyPool: [{ id: 'b_helm', model: 'a/helm.nif' }], female: false,
});
// the skin's rows as playerBodyRows mints them: a slot and its BODY record
const ROWS = [
  { slot: 'head', record: { id: 'b_n_nord_m_head_01', model: 'b/head.nif' } },
  { slot: 'hair', record: { id: 'b_n_nord_m_hair_01', model: 'b/hair.nif' } },
  { slot: 'neck', record: { id: 'b_n_nord_m_neck', model: 'b/neck.nif' } },
];

test('HEAD-HELD a helm that bound nothing gives back the head and hair it hid; one that bound a piece keeps them hidden (mutants: the rows never given back; given back under a helm that drew; the piece\'s slot unread)', () => {
  const worn = helmed();
  assert.ok(worn.shadows.includes('head') && worn.shadows.includes('hair'), 'the helm hides both before its mesh is bound');
  const cap = worn.adds.find((a) => a.partName === 'head');
  assert.ok(cap, 'the helm is a worn add on the head\'s part');
  assert.deepEqual(bareHeadRows(ROWS, worn, []), [
    { slot: 'head', bones: PART_BONES.head ?? [], model: 'b/head.nif' },
    { slot: 'hair', bones: PART_BONES.hair ?? [], model: 'b/hair.nif' },
  ], 'nothing of the helm bound: the head and the hair stand');
  assert.equal(bareHeadRows(ROWS, worn, [{ slot: 'neck', bone: 'Neck' }, { slot: 'cuirass (iron_cuirass)', bone: 'Chest' }]).length, 2, 'other pieces bound are no helm\'s: still given back');
  assert.deepEqual(bareHeadRows(ROWS, worn, [{ slot: cap.slot, bone: 'Head' }]), [], 'the helm drew: it covers them');
});

test('HEAD-HELD nothing hidden, nothing given back; the wolf\'s head is its own law; a row with no record is no row (mutants: the wolf given a head; a bare head with no helm)', () => {
  assert.deepEqual(bareHeadRows(ROWS, { shadows: [], adds: [] }, []), []);
  assert.deepEqual(bareHeadRows(ROWS, { shadows: ['left hand'], adds: [] }, []), [], 'a gauntlet hides no head');
  assert.deepEqual(bareHeadRows(ROWS, helmed(), [], true), [], 'the werewolf');
  assert.deepEqual(bareHeadRows([{ slot: 'head', record: null }, ROWS[1]], helmed(), []).map((r) => r.slot), ['hair']);
});

test('HEAD-HELD the third-person build asks it of the assembly and assembles again with the rows given back, saying so (mutants: never asked; the second assembly dropped)', () => {
  const src = readFileSync(new URL('../../src/combat/fpArm.js', import.meta.url), 'utf8');
  const body = src.slice(src.indexOf('async function buildTpBody('), src.indexOf('async function buildTpBody(') + 20000);
  // PIN MOVED (TWO-HANDS AUDIT): both assemblies ask for the left hand's weapon bone (`offWeaponBone: true` - the mirror
  // makes one where the skeleton has none), the second as the first
  const first = body.indexOf('let arm = await assembleFirstPersonArm({ skeletonBytes, parts: partBytes, boneSources, parseNif: parseNifOnce, offWeaponBone: true });');
  const ask = body.indexOf('const bare = bareHeadRows(rows, worn, arm.pieces, werewolf);');
  const again = body.indexOf('await assembleFirstPersonArm({ skeletonBytes, parts: [...partBytes, ...back], boneSources, parseNif: parseNifOnce, offWeaponBone: true })');
  const hang = body.indexOf('hangHipLight(arm);');
  assert.ok(first > 0 && first < ask && ask < again && again < hang, 'assembled, asked, assembled again, then hung');
  assert.match(body, /if \(again\?\.ok\) \{\n\s*arm = again;\n\s*skinRows\.push\(\.\.\.bare\);/);
});
