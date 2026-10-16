// MWNPC17 (2026-10-11, Mac: "We also need to hone in on what NPCs get what type of clothing/armor. General NPCs should
// have a procedural system where barely any 2 NPCs look alike" - bible/04-Characters/Morrowind-NPCs.md section 25): THE
// WARDROBE. A person is dressed from a ROLE off their own seed (characters/wardrobe.js dressPerson): the cut, the
// garments, the dyes, the cloak, the armour and its metal, the rung of Morrowind's clothing ladder; and the look's `npc`
// hint has the build pick each garment's record among the dye's nearest of that rung (mwItemMap.js mwClothingRecord) and
// walk the head and the hair each on its own (mwFirstPerson.js playerBodyRows). A player's look carries no hint and
// resolves as it always did.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  dressPerson, WARDROBE_ROLES, ROLE_NAMES, ARMOR_KITS, armorKit, npcHint, npcHintOf, npcKeyOf, npcGarmentPick, withNpcPicks, npcFaceOf,
  wornByRole, weighted, MENS, WOMENS, beastWorn, WARDROBE_BEAST_RACES,
} from '../../src/characters/wardrobe.js';
import { foeLook, rosterLook } from '../../src/characters/foeBodies.js';
import { folkLookOf, FOLK_DRESS } from '../../src/characters/folkBodies.js';
import { GENDERS } from '../../src/characters/nameHelper.js';
import { residentLook } from '../../src/characters/rosterBodies.js';
import { personLook, figureLook, KIND_ROLE } from '../../src/characters/peopleBodies.js';
import { createEquipTable } from '../../src/characters/equipTable.js';
import { SOCIAL_GROUPS, GUILD_GROUPS, FACTION_TYPES } from '../../src/formats/factionFile.js';
import { mwClothingRecord, clothingTierOf, CLOTH_PICK_NEAREST, CLOTH_PICK_BAND, CLOTHING_NAME, MW_CLOTHING_TYPE, dfWornEquipment, composeWornArmor, ARMO_PART } from '../../src/formats/morrowind/mwItemMap.js';
import { playerBodyRows } from '../../src/formats/morrowind/mwFirstPerson.js';
import { peerBuildOpts, peerBodyKey } from '../../src/net/peer/peerBodies.js';
import { peerStubEntity } from '../../src/net/remotePlayers.js';
import { EQUIP_SLOTS } from '../../src/systems/equip.js';
import { ARMOR_ENUM } from '../../src/combat/enemyEquipment.js';
import { ARMOR_MATERIAL } from '../../src/systems/armorMaterials.js';

const rd = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const seeds = (n, salt = 0) => Array.from({ length: n }, (_, i) => ((i + 1) * 2654435761 + salt) >>> 0);
const slotOf = (look, slot) => look.items.filter((it) => it.equipSlot === slot);
/** A role's rungs - the tiers it ever draws (its hint's `lo`..`hi`). */
const rungsOf = (role) => { const t = WARDROBE_ROLES[role].tiers; return [t.findIndex((w) => w > 0), t.length - 1 - [...t].reverse().findIndex((w) => w > 0)]; };

test('MWNPC17a dressPerson: one seed one person, every role dressed by its own table - its cut, its garments and dyes, a cloak at its odds; the cut a sprite shows honoured; robes cover the legs; armour\'s boots are the feet (mutants: the cut ignored; legs under a robe; shoes beside boots)', () => {
  for (const role of ROLE_NAMES) {
    for (const gender of ['male', 'female']) {
      for (const s of seeds(60, role.length)) {
        const d = dressPerson({ role, gender, seed: s });
        assert.deepEqual(dressPerson({ role, gender, seed: s }), d, 'pure: the same seed, the same person');
        assert.equal(d.role, role);
        assert.ok(wornByRole({ gender, items: d.items }, role), `${role} ${gender}: its own garments and dyes`);
        const legs = slotOf(d, EQUIP_SLOTS.LegsClothes), chest = slotOf(d, EQUIP_SLOTS.ChestClothes), feet = slotOf(d, EQUIP_SLOTS.Feet);
        assert.equal(chest.length, 1, 'one top or one robe');
        assert.equal(legs.length, d.cut === 'robe' ? 0 : 1, 'a robe hides the legs - nothing under it');
        assert.equal(feet.length, 1, 'one pair on the feet - the kit\'s boots or the cut\'s shoes, never both');
        assert.ok(d.tier >= 0 && d.tier <= 3 && WARDROBE_ROLES[role].tiers[d.tier] > 0, 'a rung the role climbs to');
        assert.deepEqual(d.npc, npcHint(s, d.tier, ...rungsOf(role)), 'its seed, its rung and its role\'s rungs');
      }
    }
  }
  // the cut a sprite already shows is the cut worn, where the role has it - and the nearest where it has not
  for (const s of seeds(40)) {
    assert.equal(dressPerson({ role: 'scholar', gender: 'male', seed: s, cut: 'robe' }).cut, 'robe');
    assert.equal(dressPerson({ role: 'commoner', gender: 'female', seed: s, cut: 'skirt' }).cut, 'skirt');
    assert.equal(dressPerson({ role: 'tradesman', gender: 'male', seed: s, cut: 'robe' }).cut, 'pants', 'a tradesman has no robe: his breeches');
  }
  assert.equal(dressPerson({ role: 'nonsense', seed: 1 }).role, 'commoner', 'an unknown role: the street\'s');
  // the cloak: a role's odds, roughly
  const cloaks = (role) => seeds(400).filter((s) => dressPerson({ role, seed: s }).items.some((it) => it.equipSlot === EQUIP_SLOTS.Cloak1)).length / 400;
  assert.ok(cloaks('traveller') > 0.45 && cloaks('commoner') < 0.2, `a traveller's cloak (${cloaks('traveller')}) and the street's rare one (${cloaks('commoner')})`);
});

test('MWNPC17b who wears what: a noble never on the common rung and a commoner never past expensive - the person and EVERY GARMENT (a garment strays a rung from its wearer\'s, never past the role\'s own); a priest in robes, a scholar mostly; a knight\'s whole plate of one metal by his rank, a fighter\'s pieces mismatched and no chain Morrowind cannot draw, a rogue in leather alone; the street and the court never armoured (AUDIT MWNPC16-18 C F1: a noble\'s top fell to common one time in eleven, a commoner\'s garment to extravagant one in a hundred. Mutants: one metal for a fighter; a chain helm; a noble in common clothes; the stray unbounded; the role\'s rungs unread)', () => {
  const many = (role, gender = 'male', n = 300) => seeds(n, role.charCodeAt(0)).map((s) => dressPerson({ role, gender, seed: s }));
  assert.ok(many('noble').every((d) => d.tier >= 1), 'a noble: expensive and up');
  assert.ok(many('commoner').every((d) => d.tier <= 1), 'a commoner: common, now and then expensive');
  // every garment, as the build picks it (peerBuildOpts - each its rung)
  const rungs = (role, gender) => many(role, gender, 600).flatMap((d) => peerBuildOpts({ race: 'Breton', gender, faceIndex: 0, items: d.items, npc: d.npc }).armor.filter((p) => p.kind === 'clothing').map((p) => p.tier));
  for (const gender of ['male', 'female']) {
    const noble = rungs('noble', gender), common = rungs('commoner', gender);
    assert.ok(noble.every((t) => t >= 1), `a noble's garments never common (${gender})`);
    assert.ok(new Set(noble).size === 3, 'and still strays among the noble rungs');
    assert.ok(common.every((t) => t <= 1), `a commoner's never past expensive (${gender})`);
    assert.ok(common.includes(1), 'a commoner\'s good coat now and then');
  }
  // a hint whose role names no rungs (a foe's, the watch's: npcHint(seed, 0)) strays over the whole ladder's bottom
  assert.deepEqual(npcHint(5, 0), { seed: 5, tier: 0, lo: 0, hi: 3 });
  assert.deepEqual(npcHint(5, 2, 3, 1), { seed: 5, tier: 2, lo: 2, hi: 2 }, 'a range that leaves out its own tier is widened to it');
  assert.ok(many('priest').filter((d) => d.cut === 'robe').length > 220, 'a priest in robes most of all');
  for (const role of ['commoner', 'tradesman', 'traveller', 'scholar', 'merchant', 'noble', 'priest', 'mage']) assert.ok(many(role).every((d) => !d.items.some((it) => it.group === 'Armor')), `${role}: no armour`);
  for (const d of many('knight')) {
    const plate = d.items.filter((it) => it.group === 'Armor');
    for (const t of [ARMOR_ENUM.Cuirass, ARMOR_ENUM.Greaves, ARMOR_ENUM.Boots, ARMOR_ENUM.Left_Pauldron, ARMOR_ENUM.Right_Pauldron]) assert.ok(plate.some((it) => it.templateIndex === t), 'the whole plate');
    assert.equal(new Set(plate.map((it) => it.material)).size, 1, 'one metal');
    assert.ok(ARMOR_KITS.knight.metals[d.tier].some(([m]) => m === plate[0].material), 'his rank\'s');
  }
  const knightMetals = new Set(many('knight').map((d) => d.items.find((it) => it.group === 'Armor').material));
  assert.ok(knightMetals.size >= 4, `an order of knights is not one smith's (${[...knightMetals]})`);
  const fighters = many('fighter');
  assert.ok(fighters.filter((d) => new Set(d.items.filter((it) => it.group === 'Armor').map((it) => it.material)).size > 1).length > 60, 'a fighter\'s pieces come from more than one smith');
  for (const d of fighters) for (const it of d.items) if (it.material === ARMOR_MATERIAL.Chain) assert.ok([ARMOR_ENUM.Cuirass, ARMOR_ENUM.Greaves].includes(it.templateIndex), 'chain only where Morrowind draws it');
  for (const d of fighters) {
    const l = d.items.find((it) => it.templateIndex === ARMOR_ENUM.Left_Pauldron), r = d.items.find((it) => it.templateIndex === ARMOR_ENUM.Right_Pauldron);
    assert.equal(!!l, !!r, 'the pauldrons a pair');
  }
  assert.ok(many('rogue').every((d) => d.items.filter((it) => it.group === 'Armor').every((it) => it.material === ARMOR_MATERIAL.Leather)), 'a rogue\'s leathers');
  assert.ok(many('rogue').filter((d) => d.items.some((it) => it.group === 'Armor')).length > many('rogue').length / 4, 'and a rogue wears them (AUDIT MWNPC16-18 R2: the leather law held for a rogue in none)');
  // AUDIT MWNPC16-18 R2: A PRIEST AT THE TEMPLE'S DOOR IN THE ROBES HIS PICTURE WEARS - every one, never the role's odds
  // (a priest's table draws a robe about six times in seven: one seed passed whether or not the cut was forced)
  for (const s of seeds(200, 9)) for (const sex of ['male', 'female']) {
    const look = residentLook({}, { id: `T${s}`, cls: null, sex, gender: sex === 'female' ? 1 : 0, race: 'Breton', archive: 381, face: 0, job: 'priest' }, { still: true });
    assert.equal(slotOf(look, EQUIP_SLOTS.LegsClothes).length, 0, `a robe, nothing under it (${s} ${sex})`);
    assert.equal(slotOf(look, EQUIP_SLOTS.ChestClothes).length, 1);
  }
  assert.deepEqual(armorKit('nonsense', 1, 5), []);
  assert.equal(weighted([0, 0, 0], 7), 0);
  assert.equal(weighted([0, 5, 0], 123), 1);
});

/** A retail-shaped CLOT set: each type's records on every rung (Morrowind's common_/expensive_/extravagant_/exquisite_
 *  ids), each measured a colour of its own. */
function clothes() {
  const out = [];
  const rungs = [['common', 7], ['expensive', 3], ['extravagant', 2], ['exquisite', 1]];
  for (const [type, name] of [[MW_CLOTHING_TYPE.Shirt, 'shirt'], [MW_CLOTHING_TYPE.Pants, 'pants'], [MW_CLOTHING_TYPE.Shoes, 'shoes'], [MW_CLOTHING_TYPE.Robe, 'robe'], [MW_CLOTHING_TYPE.Skirt, 'skirt']]) {
    for (const [rung, n] of rungs) for (let i = 1; i <= n; i++) for (const v of ['', '_a', '_b']) out.push({ id: `${rung}_${name}_0${i}${v}`, type, model: `c/${rung}_${name}_${i}${v}.nif` });
  }
  return out;
}
const colourOf = (c) => { let h = 0; for (const ch of c.id) h = Math.imul(h ^ ch.charCodeAt(0), 0x01000193) >>> 0; return [h & 255, (h >>> 8) & 255, (h >>> 16) & 255]; };

test('MWNPC17c the item map: a person\'s rung narrows the pool (the nearest rung that has records, the lower first; a mod\'s ids kept whole), a pick chooses among the dye\'s nearest few or the pool; no pick and no rung, the resolution it always was (mutants: the rung ignored; the pick over the whole pool by colour; the lower rung not first)', () => {
  const C = clothes();
  assert.deepEqual(['common_shirt_01', 'Expensive_robe_02', 'extravagant_pants_01_a', 'exquisite_shoes_01', 'tm_robe_01', 'gondolier_shirt'].map(clothingTierOf), [0, 1, 2, 3, -1, -1]);
  const before = mwClothingRecord(C, 'Short Shirt', { dye: 2, colourOf });
  assert.equal(mwClothingRecord(C, 'Short Shirt', { dye: 2, colourOf, pick: null, tier: null }).record, before.record, 'a player\'s garment: unchanged');
  assert.equal(mwClothingRecord(C, 'Short Shirt').record.id, 'common_shirt_01', 'no dye, no pick: the id-sorted first');
  for (let t = 0; t < 4; t++) for (let p = 0; p < 12; p++) {
    const r = mwClothingRecord(C, 'Long Shirt', { dye: 4, colourOf, tier: t, pick: p }).record;
    assert.equal(clothingTierOf(r.id), t, 'the person\'s rung');
  }
  // the dye's nearest few: every pick lands among them, and the picks reach all of them
  const rung = C.filter((c) => c.type === MW_CLOTHING_TYPE.Pants && clothingTierOf(c.id) === 0);
  const got = new Set();
  for (let p = 0; p < 30; p++) got.add(mwClothingRecord(C, 'Casual Pants', { dye: 3, colourOf, tier: 0, pick: p }).record.id);
  assert.equal(got.size, CLOTH_PICK_NEAREST, `the ${CLOTH_PICK_NEAREST} nearest the dye, each reached`);
  const best = mwClothingRecord(rung, 'Casual Pants', { dye: 3, colourOf }).record.id;
  assert.ok(got.has(best), 'the nearest among them');
  // no colours to measure: the pick over the rung
  const blind = new Set();
  for (let p = 0; p < 60; p++) blind.add(mwClothingRecord(C, 'Shoes', { dye: 3, tier: 1, pick: p }).record.id);
  assert.equal(blind.size, 9, 'every expensive pair reached');
  // a rung the data lacks: the nearest one that has records, the lower first
  const noExq = C.filter((c) => clothingTierOf(c.id) !== 3);
  assert.equal(clothingTierOf(mwClothingRecord(noExq, 'Plain Robes', { tier: 3, pick: 1 }).record.id), 2, 'exquisite wanted, extravagant worn');
  const onlyRich = C.filter((c) => clothingTierOf(c.id) >= 2);
  assert.equal(clothingTierOf(mwClothingRecord(onlyRich, 'Plain Robes', { tier: 0, pick: 1 }).record.id), 2, 'common wanted, the nearest there is');
  const midGap = C.filter((c) => clothingTierOf(c.id) !== 1);
  assert.equal(clothingTierOf(mwClothingRecord(midGap, 'Plain Robes', { tier: 1, pick: 1 }).record.id), 0, 'one down before one up');
  const modded = [{ id: 'tm_shirt_a', type: MW_CLOTHING_TYPE.Shirt, model: 'x' }, { id: 'tm_shirt_b', type: MW_CLOTHING_TYPE.Shirt, model: 'y' }];
  assert.equal(mwClothingRecord(modded, 'Short Shirt', { tier: 2, pick: 1 }).record.id, 'tm_shirt_b', 'ids with no rung: the pool whole');
  assert.ok(CLOTHING_NAME[MENS.priestRobes] === 'Priest Robes' && CLOTHING_NAME[WOMENS.eveningGown] === 'Evening Gown', 'the wardrobe names Daggerfall\'s own templates');
  // AUDIT MWNPC16-18 C F2: ON A THIN RUNG THE DYE STILL CHOOSES - two extravagant shirts, one red and one blue: a red dye
  // wears the red one whatever the pick (the three nearest were the whole rung), while two reds are both worn
  const rich = [{ id: 'extravagant_shirt_01', type: MW_CLOTHING_TYPE.Shirt, model: 'a' }, { id: 'extravagant_shirt_02', type: MW_CLOTHING_TYPE.Shirt, model: 'b' }, { id: 'extravagant_shirt_03', type: MW_CLOTHING_TYPE.Shirt, model: 'c' }];
  const hue = { extravagant_shirt_01: [200, 40, 40], extravagant_shirt_02: [40, 40, 200], extravagant_shirt_03: [185, 50, 45] };
  const worn = new Set();
  for (let p = 0; p < 40; p++) worn.add(mwClothingRecord(rich, 'Short Shirt', { dye: 2, colourOf: (c) => hue[c.id], tier: 2, pick: p }).record.id);
  assert.deepEqual([...worn].sort(), ['extravagant_shirt_01', 'extravagant_shirt_03'], 'the reds, both - never the blue');
  assert.deepEqual(CLOTH_PICK_BAND, [1.5, 32]);
  // and the composer hands a garment's rung and pick to the resolver - the worn body's own path
  const chest = ARMO_PART.findIndex((r) => r.name === 'cuirass');   // a shirt's part is the cuirass slot's (PRT_Cuirass)
  const shirts = C.filter((c) => c.type === MW_CLOTHING_TYPE.Shirt).map((c) => ({ ...c, parts: [{ part: chest, male: `b_${c.id}` }] }));
  const bodyPool = shirts.map((c) => ({ id: `b_${c.id}`, model: `${c.id}.nif` }));
  const put = (extra) => composeWornArmor({ pieces: [{ kind: 'clothing', templateIndex: MENS.shortShirts[0], name: 'Short Shirt', dye: 2, ...extra }], armors: [], clothes: shirts, bodyPool, female: false, colourOf }).adds[0].recordId;
  for (let t = 0; t < 4; t++) assert.equal(clothingTierOf(put({ tier: t, pick: 1 }).slice(2)), t, `composed: the person's rung (${t})`);
  assert.equal(put({}), `b_${mwClothingRecord(shirts, 'Short Shirt', { dye: 2, colourOf }).record.id}`, 'composed with neither: as it always was');
});

test('MWNPC17d the build reads the hint: each garment its rung and pick, the head and the hair walked each on its own - every one of a race\'s 8 x 6 pairs reached; a player\'s look and a wolf\'s take none; two people in one outfit are two bodies, the hint in the body key\'s memo (AUDIT MWNPC16-18 C F4: it was a new string per body a frame); a beast NPC stands barefoot and bareheaded, a beast player as dressed (AUDIT MWNPC16-18 C, the beasts. Mutants: the picks dropped; the face walked off one hash; the key without the hint; the beast\'s boots worn)', () => {
  const d = dressPerson({ role: 'merchant', gender: 'male', seed: 0xbeef });
  const look = { race: 'Breton', gender: 'male', faceIndex: 3, items: d.items, npc: d.npc };
  const o = peerBuildOpts(look);
  const garments = o.armor.filter((p) => p.kind === 'clothing');
  assert.ok(garments.length >= 3);
  for (const g of garments) {
    assert.deepEqual({ pick: g.pick, tier: g.tier }, npcGarmentPick(d.npc, g));
    assert.ok(Math.abs(g.tier - d.npc.tier) <= 1, 'a rung either side of the person\'s at most');
  }
  assert.deepEqual(o.npcFace, npcFaceOf(d.npc));
  const player = { race: 'Breton', gender: 'male', faceIndex: 3, items: d.items };
  const p = peerBuildOpts(player);
  assert.equal(p.npcFace, undefined, 'a player\'s look: no walk');
  assert.deepEqual(p.armor, dfWornEquipment(peerStubEntity(player).equip.slots, EQUIP_SLOTS, ARMOR_ENUM), 'and its garments as they always were');
  assert.equal(peerBuildOpts(look, { wb: 1 }).npcFace, undefined, 'a wolf has no face to walk');
  assert.notEqual(peerBodyKey(look), peerBodyKey({ ...look, npc: npcHint(0xbeef + 1, d.npc.tier) }), 'two people in one outfit: two bodies');
  assert.equal(peerBodyKey(player), peerBodyKey({ ...player }), 'a player\'s key as it was');
  assert.equal(npcKeyOf(player), '');
  for (const bad of [{ seed: -1, tier: 0, lo: 0, hi: 3 }, { seed: 1.5, tier: 0, lo: 0, hi: 3 }, { seed: 1, tier: 4, lo: 0, hi: 3 }, { seed: 2 ** 32, tier: 0, lo: 0, hi: 3 }, { seed: 1, tier: 0 }, { seed: 1, tier: 1, lo: 2, hi: 3 }, { seed: 1, tier: 2, lo: 0, hi: 1 }, { seed: 1, tier: 1, lo: -1, hi: 3 }, 'x', null]) assert.equal(npcHintOf({ npc: bad }), null, `a hint read as data: ${JSON.stringify(bad)}`);
  // PIN MOVED (MW-FOLK1): the memo's key carries a townsperson's outfit after the hint, both inside it
  assert.match(rd('src/net/peer/peerBodies.js'), /: lookKey\(look\)\) \+ npcKeyOf\(look\) \+ outfitKeyOf\(look\);\n {4}_bodyLookKeys\.set\(look, k\);/, 'the hint in the memo: one key a look, never a string a frame');
  // a beast: Morrowind dresses no Khajiit or Argonian in shoes, boots or a helm
  const kit = dressPerson({ role: 'knight', gender: 'male', seed: 4 });
  const helmed = { ...kit, items: [...kit.items.filter((it) => it.equipSlot !== EQUIP_SLOTS.Head), { templateIndex: ARMOR_ENUM.Helm, group: 'Armor', equipSlot: EQUIP_SLOTS.Head, material: ARMOR_MATERIAL.Steel }] };
  const street = dressPerson({ role: 'commoner', gender: 'female', seed: 9 });
  for (const race of WARDROBE_BEAST_RACES) {
    const knight = peerBuildOpts({ race, gender: 'male', faceIndex: 0, items: helmed.items, npc: kit.npc }).armor;
    assert.ok(!knight.some((p) => p.templateIndex === ARMOR_ENUM.Helm || p.templateIndex === ARMOR_ENUM.Boots), `a ${race} knight: no helm, no boots`);
    assert.ok(knight.some((p) => p.templateIndex === ARMOR_ENUM.Cuirass), 'the rest of his plate');
    const woman = peerBuildOpts({ race, gender: 'female', faceIndex: 0, items: street.items, npc: street.npc }).armor;
    assert.ok(!woman.some((p) => p.kind === 'clothing' && [WOMENS.shoes, WOMENS.boots, WOMENS.tallBoots, WOMENS.sandals].includes(p.templateIndex)), `a ${race} woman: barefoot`);
    const playerOwn = peerBuildOpts({ race, gender: 'male', faceIndex: 0, items: helmed.items }).armor;
    assert.ok(playerOwn.some((p) => p.templateIndex === ARMOR_ENUM.Helm), 'a player\'s look is never asked');
  }
  assert.ok(peerBuildOpts({ race: 'Nord', gender: 'male', faceIndex: 0, items: helmed.items, npc: kit.npc }).armor.some((p) => p.templateIndex === ARMOR_ENUM.Helm), 'a Nord keeps his helm');
  assert.equal(beastWorn([1], 'Breton')[0], 1, 'no beast: the list itself');
  // the walk: each slot its own step, over the race's pools. PIN MOVED (MW-HEADS1): a Nord's - the data's pools of a
  // race the port carries no heads for; a Breton man walks the port's own (test/tooling/mwheads1.test.js)
  const parts = [];
  for (let i = 0; i < 8; i++) parts.push({ id: `b_n_nord_m_head_0${i}`, race: 'nord', slot: 'head', skin: true, playable: true, firstPerson: false, female: false });
  for (let i = 0; i < 6; i++) parts.push({ id: `b_n_nord_m_hair_0${i}`, race: 'nord', slot: 'hair', skin: true, playable: true, firstPerson: false, female: false });
  const face = (walk) => { const rows = playerBodyRows(parts, 'nord', false, { faceIndex: 0, walk }); return ['head', 'hair'].map((s) => rows.find((r) => r.slot === s).record.id); };
  assert.deepEqual(face({ head: 3, hair: 4 }), ['b_n_nord_m_head_03', 'b_n_nord_m_hair_04']);
  assert.deepEqual(face({ head: 11, hair: 13 }), ['b_n_nord_m_head_03', 'b_n_nord_m_hair_01'], 'each modulo its own pool');
  assert.deepEqual(face(null), ['b_n_nord_m_head_00', 'b_n_nord_m_hair_00'], 'no walk: the face index\'s, as before');
  const pairs = new Set(seeds(400).map((s) => face(npcFaceOf(npcHint(s, 0))).join()));
  assert.equal(pairs.size, 48, 'a race\'s heads times its hairs, every pair reached');
  assert.match(rd('src/combat/fpArm.js'), /\} else if \(npcFace\) \{\n {4}faceMatch = \{ head: null, hair: null, reasons: \['an NPC: its head and hair walked off its seed'\] \};/, 'an NPC is no portrait: nothing measured');
});

test('MWNPC17e BARELY ANY TWO ALIKE: two hundred of one street - one race, one sex, one sprite - resolved as the build resolves them, garment records, head and hair; the same two hundred without the hint (the resolution before MWNPC17: a garment by its type and dye, a face by its index) are far fewer (mutants: the pick off; the walk off)', () => {
  const C = clothes();
  // PIN MOVED (MW-HEADS1): a Nord street - the data's 8 heads and 6 hairs of a race the port carries none for; a Breton
  // man's face is the port's own three and three (test/tooling/mwheads1.test.js)
  // PIN MOVED (AUDIT MW-FOLK1 L3-F2): the street a walker's picture still has the wardrobe dress, through the producer
  // that mints it (folkLookOf) - Nord women of picture 392. The commoner-in-trousers men this read were pictures 381,
  // 385 and 387, and every man of those wears his picture's own outfit now: one picture's walkers differ by their face
  // alone (a 387 street shows 48 people, the data's heads times its hairs; a 385 street the port's own 9 -
  // bible/04-Characters/Townsfolk-Outfits.md)
  const parts = [];
  for (let i = 0; i < 8; i++) parts.push({ id: `h${i}`, race: 'nord', slot: 'head', skin: true, playable: true, firstPerson: false, female: true });
  for (let i = 0; i < 6; i++) parts.push({ id: `r${i}`, race: 'nord', slot: 'hair', skin: true, playable: true, firstPerson: false, female: true });
  const seen = (look) => {
    const o = peerBuildOpts(look);
    const worn = o.armor.filter((p) => p.kind === 'clothing').map((p) => mwClothingRecord(C, p.name, { dye: p.dye, colourOf, tier: p.tier ?? null, pick: p.pick ?? null }).record?.id ?? '-');
    const rows = playerBodyRows(parts, 'nord', true, { faceIndex: look.faceIndex, walk: o.npcFace ?? null });
    return [...worn.sort(), rows.find((r) => r.slot === 'head').record.id, rows.find((r) => r.slot === 'hair').record.id].join('|');
  };
  const people = seeds(200, 77).map((s) => folkLookOf({ archive: 392, gender: GENDERS.Female, personFaceRecordId: 3 }, 'Nord', s));
  assert.ok(people.every((l) => !l.outfit && l.items.length > 0), 'the wardrobe dresses this picture');
  const distinct = new Set(people.map(seen));
  assert.ok(distinct.size >= 196, `two hundred women of one picture, ${distinct.size} distinct to the eye`);
  // the same two hundred without the hint - the resolution before this slice: far fewer
  const plain = new Set(people.map((l) => seen({ ...l, npc: undefined })));
  assert.ok(plain.size < distinct.size, `without it: ${plain.size}`);
});

test('MWNPC17f EVERY PRODUCER\'S LOOK CARRIES ITS HINT - a class foe\'s and a roster\'s off their shared seed, the watch\'s man in his uniform, a resident\'s still picture and a walker, a standing person and a placed figure - each a hint the build reads (npcHintOf), the same person the same hint (AUDIT MWNPC16-18 E3: only the wardrobe\'s own were pinned. Mutants: each producer\'s hint dropped)', () => {
  const hinted = (look, who) => { assert.ok(look && npcHintOf(look), `${who}: a hint`); return look.npc; };
  const foe = (marker) => ({ mobileType: 130, marker, gender: 'male', entity: { isClass: true, race: undefined, equip: createEquipTable(), items: [] }, ai: { feet: [0, 0, 0], yaw: 0 } });
  const a = hinted(foeLook(foe([3, 0, 7])), 'a class foe');
  assert.deepEqual(hinted(foeLook(foe([3, 0, 7])), 'its copy'), a, 'the same foe, the same man');
  hinted(rosterLook({}, { mobileType: 130, gender: 'female', seed: 77 }), 'a roster\'s');
  hinted(folkLookOf({ guard: true, archive: 0, gender: 0 }, 'Nord', 5), 'the watch');
  hinted(folkLookOf({ archive: 182, gender: 0, personFaceRecordId: 2 }, 'Breton', 6), 'a walker');
  hinted(residentLook({}, { id: 'r1', sex: 'male', job: 'priest', race: 'Breton', archive: 182 }, { still: true }), 'a still picture');
  hinted(personLook({}, { race: 1, gender: 0, nameSeed: 3, hash: 4, factionID: 0, billboardArchiveIndex: 182, billboardRecordIndex: 1 }, { type: FACTION_TYPES.Generic, sgroup: SOCIAL_GROUPS.Commoners, ggroup: GUILD_GROUPS.None }), 'a standing person');
  hinted(figureLook({ piece: { id: 'f1', flat: [182, 3] } }, { flats: { getFlatData: () => ({ gender: '1', caption: 'merchant' }) } }), 'a placed figure');
});

test('MWNPC17g THE PATCH NOTES\' CLAIMS, AGAINST LITERALS - who is which role, the Dark Brotherhood\'s dark dyes, a knight\'s metals by his rank, a merchant\'s station on the ladder, the formal cloak of a court, the helm now and then, the lower half matching the top as often as its table says, a garment\'s rung one down in four and up in eight, and the record picked off the seed (AUDIT MWNPC16-18 R2: the pins read the wardrobe\'s own tables back - wornByRole, the hint against npcGarmentPick - so any of these could be turned and nothing failed. Mutants: the underworld a commoner; a scholar a commoner; a tradesman\'s sprite a commoner\'s; bright dyes for the dark; the top rank in iron; a merchant always common; the cloaks swapped; a helm always; the lower never matching; the stray gone; one record for all)', () => {
  // who is which role: the standing people's kinds and the walkers' sprites, as judged
  assert.deepEqual({ ...KIND_ROLE }, { priest: 'priest', mage: 'mage', knight: 'knight', fighter: 'fighter', noble: 'noble', merchant: 'merchant', underworld: 'rogue', scholar: 'scholar', common: 'commoner' });
  assert.deepEqual(JSON.parse(JSON.stringify(FOLK_DRESS)), {
    male: [{ role: 'commoner', cut: 'pants' }, { role: 'tradesman', cut: 'pants' }, { role: 'traveller', cut: 'pants' }, { role: 'scholar', cut: 'robe' }],
    female: [{ role: 'commoner', cut: 'skirt' }, { role: 'tradesman', cut: 'pants' }, { role: 'scholar', cut: 'robe' }, { role: 'commoner', cut: 'skirt' }],
  });
  const n = 3000;
  const crowd = (role, gender = 'male', salt = 0) => seeds(n, salt + role.length * 31).map((s) => dressPerson({ role, gender, seed: s }));
  const share = (list, f) => list.filter(f).length / list.length;
  // the Dark Brotherhood in dark clothes: grey, dark brown, purple and green (characters/dyes.js), never a bright one
  const DARK = [1, 3, 4, 9];
  for (const g of ['male', 'female']) for (const d of crowd('rogue', g)) for (const it of d.items) if (it.group !== 'Armor') assert.ok(DARK.includes(it.dye), `a rogue's ${it.templateIndex} in dye ${it.dye}`);
  // a knight's whole plate of one metal by rank: iron and steel at the bottom, up to dwarven, orcish and ebony
  const metalsAt = (t) => new Set(seeds(n, 5).flatMap((s) => { const k = armorKit('knight', t, s); assert.equal(new Set(k.map((it) => it.material)).size, 1, 'one metal'); return k.map((it) => it.material); }));
  assert.deepEqual([...metalsAt(0)].sort(), [ARMOR_MATERIAL.Iron, ARMOR_MATERIAL.Steel].sort(), 'the lowest rank: iron and steel');
  const top = metalsAt(3);
  for (const m of [ARMOR_MATERIAL.Dwarven, ARMOR_MATERIAL.Orcish, ARMOR_MATERIAL.Ebony]) assert.ok(top.has(m), `the highest rank wears ${m}`);
  assert.ok(!top.has(ARMOR_MATERIAL.Iron) && !top.has(ARMOR_MATERIAL.Steel), 'and no iron or steel');
  // a merchant's station: common and expensive about evenly, extravagant or better about one in ten
  const merchants = crowd('merchant');
  const at = (t) => share(merchants, (d) => d.tier === t);
  assert.ok(at(0) > 0.38 && at(0) < 0.52 && at(1) > 0.38 && at(1) < 0.52, `common ${at(0)}, expensive ${at(1)}`);
  assert.ok(at(2) + at(3) > 0.06 && at(2) + at(3) < 0.15, `extravagant or exquisite ${at(2) + at(3)}`);
  // a court's cloak is the formal one, the street's never
  const cloakOf = (d) => d.items.find((it) => it.equipSlot === EQUIP_SLOTS.Cloak1);
  const nobleCloaks = crowd('noble').map(cloakOf).filter(Boolean);
  assert.ok(share(nobleCloaks, (c) => c.templateIndex === MENS.formalCloak) > 0.75, 'a noble\'s cloak, formal');
  assert.ok(crowd('commoner').map(cloakOf).filter(Boolean).every((c) => c.templateIndex === MENS.casualCloak), 'the street\'s, casual');
  // the helm now and then: about three knights in ten
  const helms = share(seeds(n, 11).map((s) => armorKit('knight', 1, s)), (k) => k.some((it) => it.templateIndex === ARMOR_ENUM.Helm));
  assert.ok(helms > 0.22 && helms < 0.38, `a helm on ${helms}`);
  // the lower half takes the top's dye as often as the street's table says (a fifth, and one dye in ten by chance)
  const legsMatch = share(crowd('commoner').filter((d) => d.cut === 'pants'), (d) => slotOf(d, EQUIP_SLOTS.LegsClothes)[0].dye === slotOf(d, EQUIP_SLOTS.ChestClothes)[0].dye);
  assert.ok(legsMatch > 0.22 && legsMatch < 0.34, `the breeches the shirt's dye on ${legsMatch}`);
  // a garment's rung: one down in four, one up in eight, the person's else
  const rungs = [0, 0, 0, 0];
  for (const s of seeds(n, 13)) for (const templateIndex of [MENS.breeches, MENS.formalTunic, MENS.boots]) rungs[npcGarmentPick(npcHint(s, 1, 0, 3), { templateIndex }).tier]++;
  const all = rungs.reduce((a, b) => a + b, 0);
  assert.ok(rungs[0] / all > 0.2 && rungs[0] / all < 0.3, `one down ${rungs[0] / all}`);
  assert.ok(rungs[2] / all > 0.09 && rungs[2] / all < 0.16, `one up ${rungs[2] / all}`);
  assert.equal(rungs[3], 0, 'never two');
  // the record among its candidates, off the seed: three candidates, every one picked
  const picks = new Set(seeds(200, 17).map((s) => npcGarmentPick(npcHint(s, 1, 0, 3), { templateIndex: MENS.breeches }).pick % 3));
  assert.equal(picks.size, 3, 'every candidate picked by someone');
});
