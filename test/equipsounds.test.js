// ES2 - THE EQUIP SOUND (2026-08-28). equip.js's header FLAGGED it
// since U8f: DFU rings a per-item clip at EquipItem's own moment
// (ItemEquipTable.cs:144-146, DaggerfallUI.PlayOneShot(item.
// GetEquipSound())). The switch is DaggerfallUnityItem.cs:820-841
// verbatim, the sink registers inside audio.ensure (every host's boot
// passes through it - the FOUR HOSTS RULE's structural arm), and the
// RESTORE path stays silent because rebuildEquipState refills slots
// directly - the port's shape of DFU's playEquipSounds=false load arm.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { getEquipSound, equipItem, setEquipSoundSink, rebuildEquipState, EQUIP_SLOTS } from '../src/systems/equip.js';
import { setEnchantmentHooks } from '../src/systems/equip.js';

const read = (p) => readFileSync(p, 'utf8');

test('ES2: GetEquipSound verbatim - clothing, jewellery, armor materials, the weapon table', () => {
  const s = (group, templateIndex, material = 0) => getEquipSound({ group, templateIndex, material });
  assert.equal(s('MensClothing', 53), 381);
  assert.equal(s('WomensClothing', 6), 381);
  assert.equal(s('Jewellery', 133), 383);
  assert.equal(s('Gems', 0), 383);
  // armor: a shield or the Helm is PLATE whatever its material
  assert.equal(s('Armor', 109, 0x0000), 419, 'a leather buckler still clanks - GetIsShield first');
  assert.equal(s('Armor', 107, 0x0000), 419, 'Armor.Helm (107)');
  // then the EXACT material
  assert.equal(s('Armor', 102, 0x0000), 417, 'Leather');
  assert.equal(s('Armor', 102, 0x0100), 418, 'Chain');
  assert.equal(s('Armor', 102, 0x0103), 419, "Chain2 falls to plate on C#'s own ==");
  assert.equal(s('Armor', 102, 0x0201), 419, 'Steel is plate');
  // weapons by template
  assert.equal(s('Weapons', 127), 415); assert.equal(s('Weapons', 128), 415);   // axes
  assert.equal(s('Weapons', 118), 378); assert.equal(s('Weapons', 121), 378);   // long blades
  assert.equal(s('Weapons', 122), 379); assert.equal(s('Weapons', 123), 379);   // 2H blades
  assert.equal(s('Weapons', 113), 377); assert.equal(s('Weapons', 116), 377);   // short blades
  assert.equal(s('Weapons', 125), 414);   // Flail
  assert.equal(s('Weapons', 124), 413); assert.equal(s('Weapons', 126), 413);   // Mace, Warhammer
  assert.equal(s('Weapons', 115), 380);   // Staff
  assert.equal(s('Weapons', 129), 416); assert.equal(s('Weapons', 130), 416);   // bows
  assert.equal(s('Weapons', 131), null, 'an Arrow is SoundClips.None');
  assert.equal(s('Books', 0), null, 'the default arm');
});

test('ES2: equipItem rings the sink BEFORE StartEquippedItem, and None rings nothing', () => {
  const order = [];
  setEquipSoundSink((clip) => order.push(['sound', clip]));
  setEnchantmentHooks({ onItemEquipped: () => order.push(['start']) });
  try {
    const e = { items: [] };
    equipItem(e, { group: 'Weapons', templateIndex: 113, name: 'Dagger' });
    assert.deepEqual(order, [['sound', 377], ['start']], "ItemEquipTable.cs:144-149 - the sound, THEN StartEquippedItem");
    order.length = 0;
    // an item whose GetEquipSound is None equips silently - here a
    // book has no slot at all, so nothing rings and nothing equips;
    // the null-clip gate is the getEquipSound pin above
  } finally {
    setEquipSoundSink(null);
    setEnchantmentHooks({});
  }
});

test('ES2: the RESTORE path is silent - rebuildEquipState never rings', () => {
  const rings = [];
  setEquipSoundSink((clip) => rings.push(clip));
  try {
    const e = { items: [{ group: 'Weapons', templateIndex: 113, equipSlot: EQUIP_SLOTS.RightHand }] };
    rebuildEquipState(e);
    assert.deepEqual(rings, [], "DFU's playEquipSounds=false load arm, structurally");
  } finally {
    setEquipSoundSink(null);
  }
});

test('ES2: the sink registers inside audio.ensure - no host can forget the wire', () => {
  const audio = read('src/systems/audio.js');
  assert.match(audio, /setEquipSoundSink\(\(clip\) => this\.playOneShot\(clip\)\);/,
    'the FOUR HOSTS RULE\'s structural arm: every boot passes through ensure');
  assert.ok(!/FLAGGED: equip sounds/.test(read('src/systems/equip.js')),
    'retiring a flag deletes the sentence');
});
