// AUDIT 17f: the parity pass over the 17e waves + S3c/U9 + S3d
// themselves. Every pin below fails under a one-character mutation of
// the law it names (checked by hand at authoring time).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inventoryItemImage, templateByIndex } from '../src/systems/itemTemplates.js';
import { paperdollItemImage } from '../src/ui/paperDoll.js';
import {
  armorArchive as armorArchiveByMorphology, BODY_MORPHOLOGY, clampArmorVariant, ARMOR_MATERIAL,
} from '../src/systems/armorMaterials.js';
import { armorArchive, morphologyOfRace, armorVariant, MATERIAL_FAMILY, playerArchiveFor } from '../src/characters/paperdollArt.js';
import { assignStartingGear, STARTING_GOLD } from '../src/systems/startingGear.js';
import { GOLD_TEMPLATE, goldStack, itemWeight } from '../src/systems/inventory.js';
import { addGold } from '../src/systems/court.js';
import { snapshotPlayer, restorePlayer } from '../src/systems/save.js';
import { createChargenWindow, finishChargen } from '../src/systems/chargenSession.js';
import { ChargenFlow } from '../src/ui/chargen.js';
import { startingSpells, STARTING_SPELL_SETS } from '../src/systems/chargen.js';
import { SKILLS } from '../src/systems/skills.js';

const STARTING_SPELL_IDS = STARTING_SPELL_SETS[0] ?? [];

// ---- F1: SetRace reaches the INVENTORY LIST, not just the doll ----
test('17f F1: the item list addresses icons for the WEARER morphology', () => {
  // ItemBuilder.SetRace (:850-854) offsets item.PlayerTextureArchive by
  // GetBodyMorphology at creation, and GetInventoryTextureArchive
  // (DaggerfallUnityItem.cs:1728-1735) hands that SAME field back - so
  // the list icon carries the offset too. Nothing added it here, so
  // every list drew the morphology-0 (Argonian) row for every player.
  const shirtM = { group: 'MensClothing', templateIndex: 165, variant: 0 };
  const base = templateByIndex(165).playerTextureArchive;
  assert.equal(base, 239, "the TEMPLATE archive is the Argonian-row base");
  assert.equal(inventoryItemImage(shirtM, { gender: 'male', race: 'Breton' }).archive, base + BODY_MORPHOLOGY.Human);
  assert.equal(inventoryItemImage(shirtM, { gender: 'male', race: 'Khajiit' }).archive, base + BODY_MORPHOLOGY.Khajiit);
  assert.equal(inventoryItemImage(shirtM, { gender: 'male', race: 'Argonian' }).archive, base, 'only an Argonian sits on the base row');
  // armor replaces the archive outright (ApplyArmorSettings :466-485)
  const cuirass = { group: 'Armor', templateIndex: 102, material: ARMOR_MATERIAL.Iron, variant: 1 };
  assert.equal(inventoryItemImage(cuirass, { gender: 'female', race: 'HighElf' }).archive,
    armorArchiveByMorphology('female', BODY_MORPHOLOGY.Elf));
  // and the two windows must agree - the doll already had the law
  for (const id of [{ gender: 'male', race: 'Nord' }, { gender: 'female', race: 'WoodElf' }]) {
    assert.equal(inventoryItemImage(shirtM, id).archive, paperdollItemImage(shirtM, id).archive, JSON.stringify(id));
  }
});

test('17f F1: archive 0 stays 0 - the world-texture fallback survives', () => {
  // "Use world texture archive if inventory texture not set"
  // (ItemHelper.cs:424-430): offsetting the 0 sentinel would forge a
  // real archive number and break the fallback.
  assert.equal(templateByIndex(132).playerTextureArchive, 0, 'Spellbook has no player texture');
  assert.deepEqual(inventoryItemImage({ group: 'MiscItems', templateIndex: 132 }, { race: 'Khajiit' }),
    { archive: templateByIndex(132).worldTextureArchive, record: templateByIndex(132).worldTextureRecord });
  assert.equal(playerArchiveFor({ group: 'MensClothing' }, { playerTextureArchive: 0 }, { race: 'Khajiit' }), 0);
});

// ---- F8: ONE DFU MEMBER, ONE EXPORT (17e F32 stopped one file short)
test('17f F8: paperdollArt no longer defines a rival armorArchive/clamp', () => {
  // Two exports named `armorArchive` existed, one taking a RACE and
  // one a MORPHOLOGY - the same DFU member with incompatible
  // arguments. paperdollArt keeps the C6a signature as a WRAPPER.
  for (const race of ['Breton', 'Argonian', 'Khajiit', 'HighElf']) {
    assert.equal(armorArchive('male', race), armorArchiveByMorphology('male', morphologyOfRace(race)), race);
  }
  assert.equal(morphologyOfRace('Vampire'), BODY_MORPHOLOGY.Human, 'the transform pseudo-races fall back to Human');
  // the family-keyed clamps are now an adapter over the material law
  assert.equal(armorVariant(104, MATERIAL_FAMILY.Chain, 3), clampArmorVariant(104, ARMOR_MATERIAL.Chain, 3));
  assert.equal(armorVariant(102, MATERIAL_FAMILY.Leather, 3), clampArmorVariant(102, ARMOR_MATERIAL.Leather, 3));
  assert.equal(armorVariant(108, MATERIAL_FAMILY.Plate, 9), clampArmorVariant(108, ARMOR_MATERIAL.Iron, 9));
});

// ---- F4/F5/F12: AssignStartingGear, the three drifted details ----
test('17f F5: the spellbook heads the bag, as AddPosition.Back gives it', () => {
  // ItemHelper.cs:1300-1306 adds the Spellbook BEFORE the clothes and
  // ItemCollection.AddItem defaults to AddPosition.Back, so collection
  // order = draw order (ItemListScroller walks items[i] forward).
  const e = { gender: 'male', race: 'Breton' };
  assignStartingGear(e, { classIndex: 0, rolls: () => 0.5 });
  assert.deepEqual(e.items.slice(0, 4).map((i) => i.name),
    ['Spellbook', 'Short Shirt', 'Casual Pants', 'Shortsword']);
});

test('17f F4: the pants variant rolls over the TEMPLATE variant count', () => {
  // RandomizeClothingVariant is Random.Range(0, ItemTemplate.variants)
  // (ItemBuilder.cs:803-807). Women's Casual pants (190) has FIVE
  // variants where the men's (151) has four - the port hardcoded 4, so
  // a woman could never roll her last variant.
  assert.equal(templateByIndex(190).variants, 5);
  assert.equal(templateByIndex(151).variants, 4);
  const top = (gender) => {
    const e = { gender, race: 'Breton' };
    assignStartingGear(e, { classIndex: 0, rolls: () => 0.999 });
    return e.items.find((i) => i.name === 'Casual Pants').variant;
  };
  assert.equal(top('female'), 4);
  assert.equal(top('male'), 3);
});

test('17f F12: item names come from the TEMPLATE, not a hand copy', () => {
  // DaggerfallUnityItem.ItemName is ItemTemplate.name - the port's
  // hand-written "Short shirt"/"Casual pants" were lower-cased.
  const e = { gender: 'female', race: 'Khajiit' };
  assignStartingGear(e, { classIndex: 13, rolls: () => 0.1 });
  // E4: the kit's last row used to be a 'Gold Pieces' stack. Gold is
  // PlayerEntity.GoldPieces now (ItemHelper.cs:1354's `+= 100`), so
  // the bag ends at the arrows and the purse is a number.
  assert.deepEqual(e.items.map((i) => i.name),
    ['Spellbook', 'Short Shirt', 'Casual Pants', 'Long Bow', 'Battle Axe', 'Arrow']);
  assert.equal(e.items.find((i) => i.name === 'Arrow').stackCount, 24);
  assert.equal(e.goldPieces, STARTING_GOLD);
  assert.equal(e.items.filter((i) => i.group === 'Currency').length, 0);
});

// ---- F10 + F2: the modal contract, driven through the real flow ----
// TEST THE SHAPE THE PRODUCER MINTS: both pins walk a live ChargenFlow
// through createChargenWindow's own key seam rather than hand-building
// a result literal.
const CAREER = {
  name: 'Mage', hitPointsPerLevel: 8, advancementMultiplier: 1.0,
  strength: 40, intelligence: 65, willpower: 55, agility: 45,
  endurance: 40, personality: 50, speed: 50, luck: 50,
  primarySkills: [SKILLS.Destruction, SKILLS.Restoration, SKILLS.Thaumaturgy],
  majorSkills: [SKILLS.Mysticism, SKILLS.Illusion, SKILLS.Alteration],
  minorSkills: [SKILLS.Dodging, SKILLS.Running, SKILLS.Stealth, SKILLS.Etiquette, SKILLS.Streetwise, SKILLS.Medical],
};
/** Drive the window to done with real key codes. Returns the window. */
function walkChargen(onDone) {
  // AUDIT 17i: the window WRAPS a flow now - hosts no longer
  // construct one, so neither does the pin.
  const w = createChargenWindow(new ChargenFlow([{ name: 'Mage', career: CAREER }], () => 0), { onDone });
  const key = (code, n = 1) => { for (let i = 0; i < n; i++) w.input(code); };
  // U15: the CLASSIC ORDER - race, gender, class, biography, name,
  // face, stats, skills, reflexes.
  key('Enter');                       // race (Breton) -> gender
  key('Enter');                       // gender (male) -> U18's class method
  key('Enter');                       // method (choose from a list) -> class
  key('Enter');                       // class -> (no biog set) name
  for (const c of 'KeyM KeyA KeyC'.split(' ')) w.input(c);
  key('Enter');                       // name -> face
  key('Enter');                       // face 0 -> stats
  key('Equal', 6); key('Enter');      // spend the 6-point stat pool
  key('Equal', 6); key('ArrowDown', 3);
  key('Equal', 6); key('ArrowDown', 3);
  key('Equal', 6); key('Enter');      // the three skill pools -> reflexes
  key('Enter');                       // U13: the reflex pick -> U16's summary
  key('Enter');                       // U16: the summary's OK -> done
  return w;
}

test('17f F10: createChargenWindow fires onDone exactly once', () => {
  let fired = 0;
  const w = walkChargen(() => { fired++; });
  assert.ok(w.done, 'the walk reaches done');
  assert.equal(fired, 1);
  // every key AFTER done used to re-run applyCharacter and re-roll the
  // starting kit - the doc promised once, the code did not
  w.input('Enter'); w.input('KeyA'); w.input('Escape');
  assert.equal(fired, 1);
});

// ---- F2: the spellbook a town-created character was denied ----
test('17f F2: finishChargen fills the spellbook when given the table', () => {
  const spellsByIndex = new Map(STARTING_SPELL_IDS.map((i) => [i, { index: i, name: `spell${i}` }]));
  let result = null;
  walkChargen((r) => { result = r; });
  const entity = { gender: 'male', race: 'Breton' };
  finishChargen(entity, result, spellsByIndex);
  assert.ok(entity.spells.length > 0, 'a Mage created in a TOWN used to start with an empty book');
  assert.deepEqual(entity.spells.map((s) => s.index), startingSpells(0, spellsByIndex).map((s) => s.index));
  // and WITHOUT a table the port must not wipe an existing book
  const keep = { gender: 'male', race: 'Breton', spells: [{ index: 9 }] };
  finishChargen(keep, result, null);
  assert.deepEqual(keep.spells, [{ index: 9 }], 'a null table leaves the book alone');
  // the kit still lands on the town path
  assert.deepEqual(entity.items.slice(0, 2).map((i) => i.name), ['Spellbook', 'Short Shirt']);
});

// ---- F15: one gold mint (three producers, no template, two names) ----
test('17f F15: the gold stack is Currency.Gold_pieces, minted once', () => {
  // ItemEnums.cs:605-608. With no template index the stack drew NO
  // icon (GetItemImage had nothing to fall back from) and weighed
  // nothing through itemWeight, and the three hand-mints disagreed on
  // the name ("Gold Pieces" vs "Gold pieces").
  assert.equal(GOLD_TEMPLATE, 276);
  const g = goldStack(100);
  assert.equal(g.name, 'Gold Pieces');
  assert.equal(templateByIndex(GOLD_TEMPLATE).playerTextureArchive, 0, 'no player texture: the world pile is the icon');
  assert.deepEqual(inventoryItemImage(g), { archive: 216, record: 1 });
  assert.equal(itemWeight(g), 0.25, '0.0025 kg a piece, from the TEMPLATE');
  // E4 REPLACED THE MERGE WITH AN INVARIANT. The three producers no
  // longer mint a stack at all - PlayerEntity.Items cannot hold
  // Currency - so there is nothing left to disagree about: the
  // starting 100 and a later credit are one number.
  const e = { gender: 'male', race: 'Breton' };
  assignStartingGear(e, { classIndex: 0, rolls: () => 0.5 });
  addGold(e, 50);
  assert.equal(e.items.filter((i) => i.group === 'Currency').length, 0,
    'the pack can never hold Currency (DoTransferItem :1562-1571)');
  assert.equal(e.goldPieces, STARTING_GOLD + 50);
});

test('17f F15 / E4: a legacy save\'s gold STACK is absorbed into the counter', () => {
  // The 17f upgrade (stamp the template index on a pre-17f stack so
  // stacksWith would still merge it) is moot now and its successor is
  // pinned instead: restorePlayer takes every Currency stack out of
  // the restored bag and adds it to PlayerEntity.GoldPieces, which is
  // exactly what the transfer door does to a pile.
  const entity = {};
  const snap = snapshotPlayer({ items: [{ group: 'Currency', name: 'Gold pieces', stackCount: 7 }], stats: {}, skills: [] });
  delete snap.goldPieces;   // a save older than E4 carries no counter
  restorePlayer(entity, snap);
  assert.equal(entity.items.length, 0);
  assert.equal(entity.goldPieces, 7);
  addGold(entity, 3);
  assert.equal(entity.goldPieces, 10);
  assert.equal(entity.items.filter((i) => i.group === 'Currency').length, 0);
});
