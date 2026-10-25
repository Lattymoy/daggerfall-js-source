// FIELD BUGS 2026-10-25 ART-DOLL (Andink on Discord, #general: "My Daggerfall fashion is broken because artifacts like
// Spellbreaker looks like a typical Dwarven Tower Dorito instead of the unique texture (like in the thumbnail). I feel
// like all the artifacts may be using the wrong texture, the thumbnails are correct but not on the paper doll."). DFU's
// GetItemImage(forPaperDoll) reads the same InventoryTextureArchive/Record the list does (ItemHelper.cs:405-406), so an
// artifact wears its OWN layer: the MAGIC.DEF record SetArtifact wrote, in the artifact archive (432 male / 433 female,
// GetArtifactTextureIndices), undyed. The doll drew the base template's - a Tower Shield from the body's armor archive,
// dyed by the plate band's Dwarven. Every artifact is minted by the real producer (loot.js createArtifact over
// readMagicDef's records of DFU's own table) and equipped by the real equip table.
import '../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readMagicDef, MAGIC_ITEM_RECORD_SIZE } from '../../src/formats/magicDef.js';
import { createArtifact, ARTIFACT_TEXTURE_INDEX_MAPPINGS } from '../../src/systems/loot/loot.js';
import { equipItem, EQUIP_SLOTS } from '../../src/systems/equip.js';
import { inventoryItemImage, setItemFields } from '../../src/systems/item/itemTemplates.js';
import { paperdollItemImage } from '../../src/ui/paperDoll.js';
import { DYE_COLORS, DYE_TARGETS } from '../../src/characters/dyes.js';
import { DFU_MAGIC_ITEMS } from '../dfuMagicItems.mjs';

/** MAGIC.DEF's bytes from DFU's table - the tree carries no ARENA2 (test/honestItems.mjs's craft). */
function craft(records) {
  const buf = new Uint8Array(4 + records.length * MAGIC_ITEM_RECORD_SIZE);
  const v = new DataView(buf.buffer);
  v.setInt32(0, records.length, true);
  let o = 4;
  for (const r of records) {
    for (let i = 0; i < r.name.length && i < 31; i++) buf[o + i] = r.name.charCodeAt(i);
    o += 32;
    buf[o++] = r.type; buf[o++] = r.group; buf[o++] = r.groupIndex ?? 0;
    for (let i = 0; i < 10; i++) { v.setInt8(o++, r.ench?.[i]?.[0] ?? -1); v.setInt8(o++, r.ench?.[i]?.[1] ?? 0); }
    v.setInt16(o, r.uses ?? 100, true); o += 2;
    v.setInt32(o, r.value ?? 0, true); o += 4;
    buf[o++] = r.material ?? 0;
  }
  return buf;
}
const TEMPLATES = readMagicDef(craft(DFU_MAGIC_ITEMS));
const ARTIFACTS = TEMPLATES.filter((t) => t.type === 1 || t.type === 2);
const indexOf = (name) => { const i = ARTIFACTS.findIndex((t) => t.name === name); assert.ok(i >= 0, name); return i; };
/** An artifact minted for `gender` and equipped by a fresh entity's own table. */
function worn(name, gender = 'male') {
  const it = createArtifact(TEMPLATES, indexOf(name), { gender });
  equipItem({}, it);
  return it;
}
const look = ({ archive, record, dye, target }) => ({ archive, record, dye, target });

test('ART-DOLL SPELL BREAKER WEARS ITS OWN LAYER: the doll draws its MAGIC.DEF record (22) in the artifact archive, undyed - the record its thumbnail draws - never the Tower Shield from the body\'s armor archive dyed Dwarven (mutants: the carve-out gone; the record the template\'s; the archive the body\'s; the Dwarven dye kept)', () => {
  const it = worn('Spell Breaker');
  assert.equal(it.group, 'Armor');
  assert.equal(it.equipSlot, EQUIP_SLOTS.LeftHand, 'a shield, in the left hand');
  assert.equal(ARTIFACT_TEXTURE_INDEX_MAPPINGS[indexOf('Spell Breaker')], 22);
  assert.deepEqual(look(paperdollItemImage(it, { gender: 'male', race: 'Breton' })), { archive: 432, record: 22, dye: DYE_COLORS.Unchanged, target: null });
  const thumb = inventoryItemImage(it);
  assert.deepEqual([thumb.archive, thumb.record], [432, 22], 'the thumbnail\'s own address, which the doll now shares');
});

test('ART-DOLL EVERY WORN ARTIFACT, BOTH GENDERS: each armor and weapon artifact\'s doll layer is its own record in 432 (male) or 433 (female), undyed (mutants: the female archive the male\'s; the weapons left out)', () => {
  let n = 0;
  for (const t of ARTIFACTS) {
    for (const gender of ['male', 'female']) {
      const it = createArtifact(TEMPLATES, indexOf(t.name), { gender });
      if (it.group !== 'Armor' && it.group !== 'Weapons') continue;
      equipItem({}, it);
      const r = paperdollItemImage(it, { gender, race: 'Breton' });
      assert.equal(r.archive, gender === 'female' ? 433 : 432, `${t.name} (${gender})`);
      assert.equal(r.target, null, `${t.name} undyed`);
      n++;
    }
  }
  assert.equal(n, 2 * 12, 'four armor artifacts and eight weapons, each gender');
});

test('ART-DOLL A WEAPON ARTIFACT IN THE RIGHT HAND: an Either-hand one draws record + 1 (GetItemImage forPaperDoll, ItemHelper.cs:412-414 - TEXTURE.432\'s gaps 6, 11 and 14 are the Ebony Blade\'s, the Mace of Molag Bal\'s and the Mehrunes Razor\'s), a two-handed one its own (mutants: the bump dropped; the bump on every hand)', () => {
  const left = worn('The Mehrunes Razor');
  assert.equal(left.equipSlot, EQUIP_SLOTS.RightHand, 'the first hand a weapon takes');
  assert.equal(paperdollItemImage(left).record, 13 + 1);
  const razor = createArtifact(TEMPLATES, indexOf('The Mehrunes Razor'));
  razor.equipSlot = EQUIP_SLOTS.LeftHand;
  assert.equal(paperdollItemImage(razor).record, 13, 'the left hand, its own record');
  assert.equal(paperdollItemImage(worn('Ebony Blade')).record, 5 + 1);
  assert.equal(paperdollItemImage(worn('The Mace of Molag Bal')).record, 10 + 1);
  assert.equal(paperdollItemImage(worn('Volendrung')).record, 24, 'a two-handed hammer is never bumped');
});

test('ART-DOLL THE WEARER\'S GENDER (a departure from GetArtifactTextureIndices, which keeps the minter\'s): an artifact minted for a man and worn by a woman draws 433, as an item here changes hands (mutant: the item\'s own archive)', () => {
  const it = worn('Spell Breaker', 'male');
  assert.equal(it.playerTextureArchive, 432, 'minted male');
  assert.equal(paperdollItemImage(it, { gender: 'female', race: 'Breton' }).archive, 433);
});

test('ART-DOLL THE MUNDANE TOWER SHIELD IS UNMOVED: a Dwarven Tower Shield that is no artifact still draws the body\'s armor archive, dyed by its metal (mutant: the carve-out taken by every shield)', () => {
  const spell = worn('Spell Breaker');
  const shield = setItemFields({ group: 'Armor', templateIndex: spell.templateIndex, material: spell.material });
  equipItem({}, shield);
  const r = paperdollItemImage(shield, { gender: 'male', race: 'Breton' });
  assert.notEqual(r.archive, 432);
  assert.equal(r.dye, DYE_COLORS.Dwarven);
  assert.equal(r.target, DYE_TARGETS.WeaponsAndArmor);
});
