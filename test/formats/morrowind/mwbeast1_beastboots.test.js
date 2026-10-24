// BEAST-BOOTS (`02-Formats/Morrowind-Rules.md` BEAST-BOOTS): a Khajiit or an Argonian wears no head part and no foot
// part on the Morrowind figure - Armor::canBeEquipped and Clothing::canBeEquipped refuse a Beast race any item whose
// part references name PRT_Head, PRT_LFoot or PRT_RFoot. Daggerfall equips the piece anyway, so the composer draws what
// Morrowind allows of it: a closed helm not at all, a boot its ankles over the beast's own foot (Beast Boots MWSE's
// judgement, rebuilt from the player's own records), a shoe nothing. The records are crafted ESM bytes read by the
// readers the build reads them with, the pieces the equip door's own, and the part layouts Morrowind.esm's.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { armorRecords, clothingRecords } from '../../../src/formats/morrowind/mwFirstPerson.js';
import { composeWornArmor, composeWornModest, dfWornEquipment, ARMO_PART, CLOTHING_NAME } from '../../../src/formats/morrowind/mwItemMap.js';
import { armorOfMaterial, ARMOR_ENUM } from '../../../src/combat/enemyEquipment.js';
import { ARMOR_MATERIAL } from '../../../src/systems/armorMaterials.js';
import { EQUIP_SLOTS, equipItem, equipTableOf } from '../../../src/systems/equip.js';
import { wornVerdicts } from '../../../src/combat/fpArm.js';

const enc = (str) => Array.from(str, (c) => c.charCodeAt(0));
const u32 = (n) => [n & 255, (n >> 8) & 255, (n >> 16) & 255, (n >>> 24) & 255];
const sub = (name, payload) => [...enc(name), ...u32(payload.length), ...payload];
const rec = (type, subs) => { const body = subs.flat(); return [...enc(type), ...u32(body.length), 0, 0, 0, 0, 0, 0, 0, 0, ...body]; };
const z = (s) => [...enc(s), 0];
const P = (name) => ARMO_PART.findIndex((r) => r.name === name);
/** One part reference per named slot, its BODY id `<record>:<slot>`. */
const refs = (id, names) => names.flatMap((n) => [sub('INDX', [P(n)]), sub('BNAM', z(`${id}:${n}`))]);
const armo = (id, names) => rec('ARMO', [sub('NAME', z(id)), sub('MODL', z(`a\\${id}.nif`)), ...refs(id, names)]);
const clot = (id, type, names) => rec('CLOT', [sub('NAME', z(id)), sub('MODL', z(`c\\${id}.nif`)), sub('CTDT', [...u32(type), ...u32(0), 0, 0, 0, 0]), ...refs(id, names)]);

// Morrowind.esm's layouts: every boot a foot and an ankle a side, a closed helm the head, the imperial coif the hair, a
// shoe two feet and nothing else
const BOOT = ['left foot', 'left ankle', 'right foot', 'right ankle'];
const ESM = new Uint8Array([
  ...rec('TES3', [sub('HEDR', new Array(300).fill(0))]),
  ...armo('iron boots', BOOT), ...armo('iron_helmet', ['head']), ...armo('iron_cuirass', ['cuirass']),
  ...armo('imperial_chain_cuirass', ['cuirass']), ...armo('imperial_chain_coif_helm', ['hair']),
  ...clot('common_shoes_01', 1, ['right foot', 'left foot']), ...clot('common_shirt_01', 2, ['cuirass']),
]);
const ARMORS = armorRecords(ESM);
const CLOTHES = clothingRecords(ESM);
const BODIES = [...ARMORS, ...CLOTHES].flatMap((r) => r.parts.map((p) => ({ id: p.male, model: `${p.male}.nif` })));

/** What the equip door hands the composer for these items worn. */
function wornPieces(items) {
  const entity = { items };
  for (const item of items) assert.ok(equipItem(entity, item), `${item.templateIndex}: worn`);
  return dfWornEquipment(equipTableOf(entity), EQUIP_SLOTS, ARMOR_ENUM);
}
const iron = (t) => armorOfMaterial(t, ARMOR_MATERIAL.Iron);
const compose = (pieces, beast, extra = {}) => composeWornArmor({ pieces, armors: ARMORS, clothes: CLOTHES, bodyPool: BODIES, beast, ...extra });
const drawn = (worn) => worn.adds.map((a) => a.partName).sort();

test('BEAST-BOOTS-1 the crafted records read as Morrowind\'s do - the fixture is the shape the build reads', () => {
  assert.deepEqual(ARMORS.find((r) => r.id === 'iron boots').parts.map((p) => ARMO_PART[p.part].name), BOOT);
  assert.deepEqual(CLOTHES.find((r) => r.id === 'common_shoes_01').parts.map((p) => ARMO_PART[p.part].name), ['right foot', 'left foot']);
});

test('BEAST-BOOTS-2 a beast\'s boots draw their two ankles and no foot, and the bare feet are the skin\'s (mutants: the feet kept; the boot refused whole)', () => {
  const pieces = wornPieces([iron(ARMOR_ENUM.Boots)]);
  const beast = compose(pieces, true);
  assert.deepEqual(drawn(beast), ['left ankle', 'right ankle']);
  assert.deepEqual(beast.shadows.sort(), ['ankle:left', 'ankle:right']);
  assert.ok(beast.notes.some((n) => /^armor \d+: iron boots - a beast race's feet stay bare/.test(n)), beast.notes.join('; '));
  // the same boots on any other race: all four parts, both feet hidden under them
  const man = compose(pieces, false);
  assert.deepEqual(drawn(man), ['left ankle', 'left foot', 'right ankle', 'right foot']);
  assert.deepEqual(man.shadows.sort(), ['ankle:left', 'ankle:right', 'foot:left', 'foot:right']);
  assert.deepEqual(man.notes, []);
});

test('BEAST-BOOTS-3 a helm with a head part is not drawn on a beast and hides no hair; a hair-slot helm is worn as Morrowind lets one be (mutants: the hair rule before the cut; every helm refused)', () => {
  const closed = compose(wornPieces([iron(ARMOR_ENUM.Helm)]), true);
  assert.deepEqual(closed.adds, []);
  assert.deepEqual(closed.shadows, [], 'the head and the hair are the skin\'s');
  const [row] = wornVerdicts(wornPieces([iron(ARMOR_ENUM.Helm)]), closed);
  assert.match(row.reason, /^armor \d+: iron_helmet covers the head - a beast race wears no closed helm$/, 'the card says why');
  const coif = compose(wornPieces([armorOfMaterial(ARMOR_ENUM.Helm, ARMOR_MATERIAL.Chain)]), true);
  assert.deepEqual(drawn(coif), ['hair']);
  assert.deepEqual(coif.shadows, ['hair']);
  assert.deepEqual(drawn(compose(wornPieces([iron(ARMOR_ENUM.Helm)]), false)), ['head'], 'any other race wears it');
});

test('BEAST-BOOTS-4 a beast\'s shoes draw nothing and say so on the card; the rest of the outfit is untouched', () => {
  const shoes = Number(Object.entries(CLOTHING_NAME).find(([, n]) => n === 'Shoes')[0]);
  const slots = equipTableOf({ items: [] });
  slots[EQUIP_SLOTS.Feet] = { templateIndex: shoes };
  const pieces = [...dfWornEquipment(slots, EQUIP_SLOTS, ARMOR_ENUM), ...wornPieces([iron(ARMOR_ENUM.Cuirass)])];
  const beast = compose(pieces, true);
  assert.deepEqual(drawn(beast), ['cuirass']);
  assert.ok(!beast.shadows.some((s) => s.startsWith('foot')), 'bare feet');
  const [row] = wornVerdicts(pieces.slice(0, 1), beast);
  assert.match(row.reason, /^Shoes: common_shoes_01 - a beast race's feet stay bare/);
  assert.deepEqual(drawn(compose(pieces, false)), ['cuirass', 'left foot', 'right foot']);
});

test('BEAST-BOOTS-5 the port\'s own plate: a beast wears no closed steel helm and no one-piece boot, and the open helm on the hair (mutants: the `hides` test; the foot test)', () => {
  const steel = (t) => armorOfMaterial(t, ARMOR_MATERIAL.Steel);
  const pieces = wornPieces([steel(ARMOR_ENUM.Helm), steel(ARMOR_ENUM.Boots), steel(ARMOR_ENUM.Cuirass)]);
  const closed = compose(pieces, true, { helmStyle: 'closed' });
  assert.deepEqual(drawn(closed), ['cuirass', 'skirt']);
  assert.ok(!closed.shadows.some((s) => /^(head|hair|foot|ankle|knee)/.test(s)), `no helm and no boot hide the beast (${closed.shadows})`);
  const open = compose(pieces, true, { helmStyle: 'open' });
  assert.deepEqual(drawn(open), ['cuirass', 'hair', 'skirt']);
  const man = compose(pieces, false, { helmStyle: 'closed' });
  assert.deepEqual(drawn(man), ['cuirass', 'hair', 'left foot', 'right foot', 'skirt']);
});

test('BEAST-BOOTS-6 the modesty weld composes with the flag it was handed', () => {
  const pieces = wornPieces([iron(ARMOR_ENUM.Boots)]);
  const worn = composeWornModest({ pieces, armors: ARMORS, clothes: CLOTHES, bodyPool: BODIES, female: true, beast: true }, false);
  assert.deepEqual(drawn(worn), ['cuirass', 'left ankle', 'right ankle'], 'her shirt is added, her feet stay bare');
});

test('BEAST-BOOTS-7 every composition of a Morrowind figure in fpArm.js hands the race\'s Beast flag on - the werewolf\'s robe alone composes without it (mutant: a call site that drops it)', () => {
  const src = readFileSync(new URL('../../../src/combat/fpArm.js', import.meta.url), 'utf8');
  const calls = [...src.matchAll(/composeWorn(?:Armor|Modest)\(\{[^}]*\}/g)].map((m) => m[0]);
  const robe = calls.filter((c) => c.includes("reserve: 'robe'"));
  assert.equal(robe.length, 1, 'the werewolf composes one robe');
  const figure = calls.filter((c) => !robe.includes(c));
  assert.equal(figure.length, 4, 'the portrait, the colour probe, the body and the body without an unbound outfit');
  for (const c of figure) assert.match(c, /[,{]\s*beast\s*[,}]/, c);
});
