// BEAST-BOOTS (`02-Formats/Morrowind-Rules.md` BEAST-BOOTS): what a Khajiit or an Argonian wears on its feet and its
// head on the Morrowind figure, by the viewer's two switches (systems/features.js, Beast Footwear and Beast Helmets),
// As worn by default. Armor::canBeEquipped and Clothing::canBeEquipped refuse a Beast race any item whose part
// references name PRT_Head, PRT_LFoot or PRT_RFoot; Daggerfall equips the piece anyway, so the switches choose what the
// composer draws of it: footwear As worn, Shafts only (a boot's ankles over the beast's own foot - Beast Boots MWSE's
// judgement, rebuilt from the player's own records - and a shoe nothing) or Hidden (Morrowind's refusal); helmets As
// worn, Open only (Morrowind's refusal: no head part, the hair-slot coif kept) or Hidden (no helm at all). The records
// are crafted ESM bytes read by the readers the build reads them with, the pieces the equip door's own, and the part
// layouts Morrowind.esm's.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { armorRecords, clothingRecords } from '../../../src/formats/morrowind/mwFirstPerson.js';
import { composeWornArmor, composeWornModest, dfWornEquipment, ARMO_PART, CLOTHING_NAME, BEAST_WEAR_WORN } from '../../../src/formats/morrowind/mwItemMap.js';
import { armorOfMaterial, ARMOR_ENUM } from '../../../src/combat/enemyEquipment.js';
import { ARMOR_MATERIAL } from '../../../src/systems/armorMaterials.js';
import { EQUIP_SLOTS, equipItem, equipTableOf } from '../../../src/systems/equip.js';
import { wornVerdicts } from '../../../src/combat/fpArm.js';
import { FEATURES } from '../../../src/systems/features.js';
import { PREF_DEFAULTS } from '../../../src/systems/uiPrefs.js';

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
const compose = (pieces, beast, beastWear, extra = {}) => composeWornArmor({ pieces, armors: ARMORS, clothes: CLOTHES, bodyPool: BODIES, beast, ...(beastWear ? { beastWear } : {}), ...extra });
const drawn = (worn) => worn.adds.map((a) => a.partName).sort();
const FEET = (feet) => ({ ...BEAST_WEAR_WORN, feet });
const HELM = (helm) => ({ ...BEAST_WEAR_WORN, helm });
const shoesPiece = () => {
  const shoes = Number(Object.entries(CLOTHING_NAME).find(([, n]) => n === 'Shoes')[0]);
  const slots = equipTableOf({ items: [] });
  slots[EQUIP_SLOTS.Feet] = { templateIndex: shoes };
  return dfWornEquipment(slots, EQUIP_SLOTS, ARMOR_ENUM);
};

test('BEAST-BOOTS-1 the crafted records read as Morrowind\'s do - the fixture is the shape the build reads', () => {
  assert.deepEqual(ARMORS.find((r) => r.id === 'iron boots').parts.map((p) => ARMO_PART[p.part].name), BOOT);
  assert.deepEqual(CLOTHES.find((r) => r.id === 'common_shoes_01').parts.map((p) => ARMO_PART[p.part].name), ['right foot', 'left foot']);
});

test('BEAST-BOOTS-2 As worn by default: a beast with no switch thrown, or both As worn, draws its boots, shoes and closed helm as anyone does (mutant: a cut on the default)', () => {
  const pieces = [...wornPieces([iron(ARMOR_ENUM.Boots), iron(ARMOR_ENUM.Helm)]), ...shoesPiece()];
  const man = compose(pieces, false);
  for (const wear of [undefined, BEAST_WEAR_WORN]) {
    const beast = compose(pieces, true, wear);
    assert.deepEqual(drawn(beast), drawn(man));
    assert.deepEqual(beast.shadows.sort(), man.shadows.sort());
    assert.deepEqual(beast.notes, man.notes);
  }
  assert.deepEqual(BEAST_WEAR_WORN, { feet: 'worn', helm: 'worn' });
});

test('BEAST-BOOTS-3 Shafts only: a beast\'s boots draw their two ankles and no foot, the bare feet the skin\'s; a shoe draws nothing and says so (mutants: the feet kept; the boot refused whole; the shoe\'s cut unsaid)', () => {
  const boots = wornPieces([iron(ARMOR_ENUM.Boots)]);
  const beast = compose(boots, true, FEET('shafts'));
  assert.deepEqual(drawn(beast), ['left ankle', 'right ankle']);
  assert.deepEqual(beast.shadows.sort(), ['ankle:left', 'ankle:right']);
  assert.ok(beast.notes.some((n) => /^armor \d+: iron boots - a beast race's feet stay bare$/.test(n)), beast.notes.join('; '));
  // the same boots on any other race, the switch thrown: all four parts, both feet hidden under them
  const man = compose(boots, false, FEET('shafts'));
  assert.deepEqual(drawn(man), ['left ankle', 'left foot', 'right ankle', 'right foot']);
  assert.deepEqual(man.notes, []);
  const pieces = [...shoesPiece(), ...wornPieces([iron(ARMOR_ENUM.Cuirass)])];
  const shod = compose(pieces, true, FEET('shafts'));
  assert.deepEqual(drawn(shod), ['cuirass']);
  assert.ok(!shod.shadows.some((s) => s.startsWith('foot')), 'bare feet');
  assert.match(wornVerdicts(pieces.slice(0, 1), shod)[0].reason, /^Shoes: common_shoes_01 - a beast race's feet stay bare$/);
});

test('BEAST-BOOTS-4 Footwear Hidden: no boot and no shoe is drawn on a beast - Morrowind\'s own refusal - and the card says why (mutants: hidden read as shafts; the refusal unsaid)', () => {
  const pieces = [...wornPieces([iron(ARMOR_ENUM.Boots), iron(ARMOR_ENUM.Cuirass)]), ...shoesPiece()];
  const beast = compose(pieces, true, FEET('hidden'));
  assert.deepEqual(drawn(beast), ['cuirass']);
  assert.ok(!beast.shadows.some((s) => /^(foot|ankle)/.test(s)), `bare feet and ankles: ${beast.shadows}`);
  const rows = wornVerdicts(pieces, beast);
  assert.match(rows.find((r) => r.label.startsWith(`armor ${ARMOR_ENUM.Boots}`)).reason, /^armor \d+: iron boots - a beast race wears no footwear$/);
  assert.match(rows.find((r) => r.label === 'Shoes').reason, /^Shoes: common_shoes_01 - a beast race wears no footwear$/);
});

test('BEAST-BOOTS-5 Helmets Open only: a helm with a head part is not drawn on a beast and hides no hair; the hair-slot coif is worn, as Morrowind lets one be (mutants: the hair rule before the cut; every helm refused)', () => {
  const helm = wornPieces([iron(ARMOR_ENUM.Helm)]);
  const closed = compose(helm, true, HELM('open'));
  assert.deepEqual(closed.adds, []);
  assert.deepEqual(closed.shadows, [], 'the head and the hair are the skin\'s');
  assert.match(wornVerdicts(helm, closed)[0].reason, /^armor \d+: iron_helmet covers the head - a beast race wears no closed helm$/, 'the card says why');
  const coif = compose(wornPieces([armorOfMaterial(ARMOR_ENUM.Helm, ARMOR_MATERIAL.Chain)]), true, HELM('open'));
  assert.deepEqual(drawn(coif), ['hair']);
  assert.deepEqual(coif.shadows, ['hair']);
  assert.deepEqual(drawn(compose(helm, false, HELM('open'))), ['head'], 'any other race wears it');
});

test('BEAST-BOOTS-6 Helmets Hidden: no helm at all on a beast, the coif too, and the hair is the skin\'s (mutants: hidden read as open; the hair hidden by a helm not drawn)', () => {
  for (const material of [ARMOR_MATERIAL.Iron, ARMOR_MATERIAL.Chain]) {
    const helm = wornPieces([armorOfMaterial(ARMOR_ENUM.Helm, material)]);
    const worn = compose(helm, true, HELM('hidden'));
    assert.deepEqual(worn.adds, []);
    assert.deepEqual(worn.shadows, []);
    assert.match(wornVerdicts(helm, worn)[0].reason, /^armor \d+: a beast race wears no helmet$/);
    assert.ok(compose(helm, false, HELM('hidden')).adds.length, 'any other race wears it');
  }
});

test('BEAST-BOOTS-7 the port\'s own plate: Open only refuses the closed steel helm and keeps the open one; Hidden refuses both; Shafts only and Hidden take the one-piece boots whole (mutants: the `hides` test; the foot test)', () => {
  const steel = (t) => armorOfMaterial(t, ARMOR_MATERIAL.Steel);
  const pieces = wornPieces([steel(ARMOR_ENUM.Helm), steel(ARMOR_ENUM.Boots), steel(ARMOR_ENUM.Cuirass)]);
  const both = (feet, helm) => ({ feet, helm });
  assert.deepEqual(drawn(compose(pieces, true, both('worn', 'worn'), { helmStyle: 'closed' })), ['cuirass', 'hair', 'left foot', 'right foot', 'skirt']);
  const closed = compose(pieces, true, both('shafts', 'open'), { helmStyle: 'closed' });
  assert.deepEqual(drawn(closed), ['cuirass', 'skirt']);
  assert.ok(!closed.shadows.some((s) => /^(head|hair|foot|ankle|knee)/.test(s)), `no helm and no boot hide the beast (${closed.shadows})`);
  assert.deepEqual(drawn(compose(pieces, true, both('hidden', 'open'), { helmStyle: 'open' })), ['cuirass', 'hair', 'skirt']);
  assert.deepEqual(drawn(compose(pieces, true, both('worn', 'hidden'), { helmStyle: 'open' })), ['cuirass', 'left foot', 'right foot', 'skirt']);
});

test('BEAST-BOOTS-8 the modesty weld composes with the switches it was handed', () => {
  const pieces = wornPieces([iron(ARMOR_ENUM.Boots)]);
  const worn = composeWornModest({ pieces, armors: ARMORS, clothes: CLOTHES, bodyPool: BODIES, female: true, beast: true, beastWear: FEET('shafts') }, false);
  assert.deepEqual(drawn(worn), ['cuirass', 'left ankle', 'right ankle'], 'her shirt is added, her feet stay bare');
});

test('BEAST-BOOTS-9 every composition of a Morrowind figure in fpArm.js hands on the race\'s Beast flag and the two switches - the werewolf\'s robe alone composes without them (mutant: a call site that drops them)', () => {
  const src = readFileSync(new URL('../../../src/combat/fpArm.js', import.meta.url), 'utf8');
  const calls = [...src.matchAll(/composeWorn(?:Armor|Modest)\(\{[^}]*\}/g)].map((m) => m[0]);
  const robe = calls.filter((c) => c.includes("reserve: 'robe'"));
  assert.equal(robe.length, 1, 'the werewolf composes one robe');
  const figure = calls.filter((c) => !robe.includes(c));
  assert.equal(figure.length, 4, 'the portrait, the colour probe, the body and the body without an unbound outfit');
  for (const c of figure) assert.match(c, /[,{]\s*beast,\s*beastWear(: beastWearPref\(\))?\s*[,}]/, c);
  assert.match(src, /const beastWearPref = \(\) => \(\{ feet: getPref\('mwBeastFeet'\), helm: getPref\('mwBeastHelm'\) \}\);/);
});

test('BEAST-BOOTS-10 the two switches: three ways each, As worn by default, the viewer\'s own, and the tile rebuilds the body (mutants: a default thrown; a way missing; the rebuild unwired)', () => {
  const row = (id) => FEATURES.find((f) => f.id === id);
  const feet = row('beast-footwear'), helm = row('beast-helmets');
  assert.deepEqual([feet.control.key, feet.control.initial, feet.control.tiers.map(([v]) => v)], ['mwBeastFeet', 'worn', ['worn', 'shafts', 'hidden']]);
  assert.deepEqual([helm.control.key, helm.control.initial, helm.control.tiers.map(([v]) => v)], ['mwBeastHelm', 'worn', ['worn', 'open', 'hidden']]);
  assert.deepEqual([feet.control.tiers.map(([, l]) => l), helm.control.tiers.map(([, l]) => l)], [['As worn', 'Shafts only', 'Hidden'], ['As worn', 'Open only', 'Hidden']]);
  assert.deepEqual([PREF_DEFAULTS.mwBeastFeet, PREF_DEFAULTS.mwBeastHelm], ['worn', 'worn'], 'the stores\' defaults are the rows\'');
  for (const f of [feet, helm]) assert.equal(f.control.online, 'player');
  const menu = readFileSync(new URL('../../../src/ui/enhanced/enhancedMenu.js', import.meta.url), 'utf8');
  for (const key of ['mwBeastFeet', 'mwBeastHelm']) assert.match(menu, new RegExp(`\\n {2}${key}: rebuildMorrowindBody,`), `${key} rebuilds the body`);
});
