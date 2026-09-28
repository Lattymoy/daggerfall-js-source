// UI2 (2026-09-27, the Plus UI pass - bible/10-UI/Slots-Hotbar-Status.md; Mac: "The hotbar also is missing sprite
// icons like spells, and you should be able to slot spells and different items").
//
// THE HOTBAR: any item on a slot, its press the pack's own primary act (systems/quickslots.js - a worn piece put on
// or taken off, anything else USED through the pack's Use and its three window doors, which every host now hands the
// quick use); a spell's slot showing its ICON00I0 icon (ui/enhancedArt.js spellIconPicture, fitted by UI1's law), the
// icon riding the entry so a forgotten spell keeps it, the spellbook's drag and the diamond's spell chip wearing it
// too; a stack's count on any slot, a worn piece's wear. What only a browser with the real ARENA2 can say is
// tools/uiHotbarProbe.mjs's.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as HB from '../src/systems/quickslots.js';
import { equipItem, isEquipped, equipTableOf, EQUIP_SLOTS } from '../src/systems/equip.js';
import { TEMPLATES, USE_PENDING } from '../src/systems/useItem.js';
import { createWeapon } from '../src/combat/enemyEquipment.js';
import { setItemFields, mintCondition } from '../src/systems/itemTemplates.js';
import { ARMOR_MATERIAL } from '../src/systems/armorMaterials.js';
import { createSurvivalItem } from '../src/systems/survival/items.js';
import { TEMPLATE as SURV } from '../src/systems/survival/food.js';
import { spellIconPicture, sheetCutUrl } from '../src/ui/enhancedArt.js';
import { _fittedKeys } from '../src/ui/textureCanvas.js';
import { fitCanvas } from '../src/ui/bitmapCanvas.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const armour = (t) => mintCondition(setItemFields({ group: 'Armor', templateIndex: t, material: ARMOR_MATERIAL.Steel, flags: 0 }));
const thing = (group, t, n = 1) => { const it = mintCondition(setItemFields({ group, templateIndex: t })); if (n > 1) it.stackCount = n; return it; };
const book = () => ({ ...thing('Books', 277), message: 1234 });
const spellbook = () => thing('MiscItems', TEMPLATES.Spellbook);
const body = (items) => ({ isPlayer: true, level: 5, career: { name: 'Spellsword' }, activeEffects: [], spells: [], stats: {}, items });
/** The host's quick use, as every host now builds it: the pack's Use (useQuickslot on c1) with the pack's own doors. */
const hostDoors = (me, said, opened) => ({
  quickUse: () => {
    HB.useQuickslot('c1', {
      entity: me, items: me.items, say: (l) => said.push(l),
      hooks: {
        openBook: (item, onFail) => { opened.push(['book', item, typeof onFail]); },
        openSpellbook: () => { opened.push(['spellbook']); },
        placeCamp: (item, list) => { opened.push(['camp', item, list]); },
      },
    });
    return true;
  },
});

test('UI2 kinds: any item goes on the bar - a worn piece (armour, clothing, jewellery, a gem\'s crystal) is WORN, everything else USED; the four kinds before stand as they were (mutants: a worn piece read as used; an item refused)', () => {
  assert.equal(HB.hotbarKindOf(null), null);
  assert.equal(HB.hotbarKindOf('Longsword'), null, 'not an item');
  assert.equal(HB.hotbarKindOf(createWeapon(120, 3)), 'weapon');
  assert.equal(HB.hotbarKindOf(armour(111)), 'shield', 'a kite shield keeps SHIELD1\'s slot');
  assert.equal(HB.hotbarKindOf(thing('UselessItems2', TEMPLATES.Torch)), 'light');
  for (const [what, it] of [['a cuirass', armour(102)], ['a helm', armour(107)], ['boots', armour(108)], ['a ring', thing('Jewellery', 135)],
    ['an amulet', thing('Jewellery', 133)], ['a ruby (a crystal slot)', thing('Gems', 0)], ['straps', thing('MensClothing', 141)]]) {
    assert.equal(HB.hotbarKindOf(it), 'wear', what);
  }
  const arrows = createWeapon(131, 3); arrows.stackCount = 40;
  for (const [what, it] of [['a book', book()], ['the spellbook', spellbook()], ['a map', thing('Maps', TEMPLATES.Map)], ['arrows', arrows],
    ['an ingredient', thing('PlantIngredients1', 10, 7)], ['camping equipment', createSurvivalItem(SURV.CampingEquipment, { condition: 10 })]]) {
    assert.equal(HB.hotbarKindOf(it), 'use', what);
  }
  assert.deepEqual([...HB.HOTBAR_KINDS], ['consumable', 'weapon', 'light', 'shield', 'wear', 'use']);
  const e = HB.hotbarEntryForItem(book());
  assert.equal(e.type, 'item'); assert.equal(e.kind, 'use'); assert.equal(typeof e.key, 'string'); assert.ok(e.name);
});

test('UI2 spell entries: a slot keeps its spell\'s ICON00I0 icon, so a spell gone from the book keeps the picture it was slotted with; a save carries it and the two new kinds, and refuses a kind or an icon it does not know (mutants: the icon dropped at the entry; the save\'s kinds unwidened)', () => {
  try {
    HB.clearQuickslots();
    const fire = { index: 7, name: 'Fireball', icon: 12, element: 1, rangeType: 2 };
    assert.deepEqual(HB.hotbarEntryForSpell(fire), { type: 'spell', index: 7, name: 'Fireball', icon: 12 });
    assert.deepEqual(HB.hotbarEntryForSpell({ index: 8, name: 'Heal' }), { type: 'spell', index: 8, name: 'Heal' }, 'a record with no icon: none');
    assert.deepEqual(HB.hotbarEntryForSpell({ index: 8, name: 'Heal', icon: 300 }), { type: 'spell', index: 8, name: 'Heal' }, 'not a byte: none');
    HB.setHotbarSlot(0, HB.hotbarEntryForSpell(fire));
    const me = body([]); me.spells = [fire];
    assert.equal(HB.hotbarView(me)[0].icon, 12, 'the book\'s own');
    me.spells = [];
    const gone = HB.hotbarView(me)[0];
    assert.equal(gone.ghost, true); assert.equal(gone.icon, 12, 'the one it was slotted with');
    // the save: the icon, and a wear and a use slot, come back; a bogus kind and a bogus icon do not
    const cuirass = armour(102);
    HB.setHotbarSlot(1, HB.hotbarEntryForItem(cuirass));
    HB.setHotbarSlot(2, HB.hotbarEntryForItem(book()));
    const saved = HB.quickslotSaveData();
    assert.equal(saved.hotbar[0].icon, 12);
    HB.clearQuickslots();
    HB.restoreQuickslotSaveData(JSON.parse(JSON.stringify(saved)));
    assert.deepEqual(HB.hotbarEntry(0), { type: 'spell', index: 7, name: 'Fireball', icon: 12 });
    assert.equal(HB.hotbarEntry(1).kind, 'wear');
    assert.equal(HB.hotbarEntry(2).kind, 'use');
    HB.restoreQuickslotSaveData({ hotbar: [{ type: 'item', kind: 'throw', key: 'k', name: 'Rock' }, { type: 'spell', index: 3, name: 'X', icon: 'big' }] });
    assert.equal(HB.hotbarEntry(0), null, 'a kind the bar does not know');
    assert.deepEqual(HB.hotbarEntry(1), { type: 'spell', index: 3, name: 'X' }, 'an icon that is not a byte');
  } finally { HB.clearQuickslots(); }
});

test('UI2 the view: a stack shows its count on any slot (a single piece none; a consumable always), a worn piece its wear - a weapon, a shield, a light, armour, anything enchanted - and never a gem, a ring or a book (mutants: no count on a use slot; the wear on every piece)', () => {
  try {
    HB.clearQuickslots();
    const herbs = thing('PlantIngredients1', 10, 7);
    const one = book();
    const cuirass = armour(102);
    const ring = thing('Jewellery', 135);
    const magicRing = { ...thing('Jewellery', 136), enchantments: [{ type: 1, param: 1 }] };
    const rubies = thing('Gems', 0, 3);
    const me = body([herbs, one, cuirass, ring, magicRing, rubies]);
    [herbs, one, cuirass, ring, magicRing, rubies].forEach((it, i) => HB.setHotbarSlot(i, HB.hotbarEntryForItem(it)));
    const v = HB.hotbarView(me);
    assert.deepEqual(v.slice(0, 6).map((s) => s.count), [7, null, null, null, null, 3]);
    assert.deepEqual(v.slice(0, 6).map((s) => Number.isFinite(s.condition)), [false, false, true, false, true, false]);
  } finally { HB.clearQuickslots(); }
});

test('UI2 a worn piece\'s press: put on, then taken off, in its own words - through the pack\'s equip, the pause billed; a shield keeps SHIELD1\'s words; broken and forbidden refused; none left said so (mutants: a wear slot used instead; the lines crossed)', () => {
  try {
    HB.clearQuickslots();
    const cuirass = armour(102);
    const me = body([cuirass]);
    HB.setHotbarSlot(0, HB.hotbarEntryForItem(cuirass));
    const said = [];
    const say = (l) => said.push(l);
    assert.equal(HB.hotbarPress(0, { entity: me, doors: {}, say }).kind, 'equipped');
    assert.ok(isEquipped(cuirass), 'on');
    assert.equal(equipTableOf(me)[EQUIP_SLOTS.ChestArmor], cuirass);
    assert.equal(HB.hotbarPress(0, { entity: me, doors: {}, say }).kind, 'unequipped');
    assert.ok(!isEquipped(cuirass), 'off');
    assert.match(said[0], /^You put on your .*Cuirass\.$/);
    assert.match(said[1], /^You take off your .*Cuirass\.$/);
    // two rings: the second finger
    const r1 = thing('Jewellery', 135), r2 = { ...thing('Jewellery', 135), material: 3 };
    const hands = body([r1, r2]);
    HB.setHotbarSlot(1, HB.hotbarEntryForItem(r1));
    HB.setHotbarSlot(2, HB.hotbarEntryForItem(r2));
    HB.hotbarPress(1, { entity: hands, doors: {}, say });
    HB.hotbarPress(2, { entity: hands, doors: {}, say });
    assert.ok(isEquipped(r1) && isEquipped(r2), 'both worn');
    assert.notEqual(r1.equipSlot, r2.equipSlot, 'on two fingers');
    // broken; none left
    const worn = armour(107); worn.currentCondition = 0;
    const b2 = body([worn]); const lines = [];
    HB.setHotbarSlot(3, HB.hotbarEntryForItem(worn));
    assert.equal(HB.hotbarPress(3, { entity: b2, doors: {}, say: (l) => lines.push(l) }).kind, 'refused');
    assert.match(lines[0], /^Your .*Helm is broken\.$/);
    b2.items = [];
    assert.equal(HB.hotbarPress(3, { entity: b2, doors: {}, say: (l) => lines.push(l) }).kind, 'gone');
    assert.match(lines[1], /^You have no .*Helm\.$/);
    // a shield keeps its words
    const kite = armour(111);
    const b3 = body([kite]); const sl = [];
    HB.setHotbarSlot(4, HB.hotbarEntryForItem(kite));
    HB.hotbarPress(4, { entity: b3, doors: {}, say: (l) => sl.push(l) });
    assert.match(sl[0], /^You strap on your .*Kite Shield\.$/);
    assert.equal(HB.HOTBAR_TEXT.wearForbidden('Ebony Cuirass'), 'You cannot wear your Ebony Cuirass.');
  } finally { HB.clearQuickslots(); }
});

test('UI2 a used item\'s press: the pack\'s Use through the host\'s quick use - a book OPENED through the host\'s book door, the spellbook opened, a tent placed on the host\'s ground off the pack, and what cannot be used saying so - with no door, the stand-in saying why, refused; the diamond\'s slot is its own again after (mutants: the book door unasked; the spellbook door unasked; the camp door unasked; the stand-in silent)', () => {
  try {
    HB.clearQuickslots();
    const b = book(), sb = spellbook(), tent = createSurvivalItem(SURV.CampingEquipment, { condition: 10 });
    const beads = thing('ReligiousItems', 258);
    const me = body([b, sb, tent, beads]); me.spells = [{ index: 1, name: 'Heal' }];
    [b, sb, tent, beads].forEach((it, i) => HB.setHotbarSlot(i, HB.hotbarEntryForItem(it)));
    const said = [], opened = [];
    const doors = hostDoors(me, said, opened);
    assert.equal(HB.hotbarPress(0, { entity: me, doors, say: (l) => said.push(l) }).kind, 'used');
    assert.deepEqual(opened.shift(), ['book', b, 'function'], 'the book, handed to the host\'s reader with its failure line');
    HB.hotbarPress(1, { entity: me, doors, say: (l) => said.push(l) });
    assert.deepEqual(opened.shift(), ['spellbook']);
    HB.hotbarPress(2, { entity: me, doors, say: (l) => said.push(l) });
    const camp = opened.shift();
    assert.equal(camp[0], 'camp'); assert.equal(camp[1], tent); assert.equal(camp[2], me.items, 'off the pack it was used from');
    assert.deepEqual(said, [], 'nothing said over a window that opened');
    assert.equal(HB.hotbarPress(3, { entity: me, doors, say: (l) => said.push(l) }).kind, 'refused', 'the refusal\'s flash');
    assert.equal(opened.length, 0);
    assert.deepEqual(said, [`You cannot use your ${HB.hotbarEntry(3).name}.`], 'prayer beads have no use, and the slot says so');
    assert.equal(HB.quickslotEntry('c1'), null, 'the diamond\'s slot is its own again');
    // AUDIT UI B7: no host door - the pack's stand-in says why nothing opened, and the slot flashes the refusal (the leg
    // this stood in for had put the book on the diamond's consumable slot, which refused it, and counted that line)
    const plain = [];
    const bare = { quickUse: () => { HB.useQuickslot('c1', { entity: me, items: me.items, say: (l) => plain.push(l) }); return true; } };
    for (const [slot, kind] of [[0, 'book'], [1, 'spellbook'], [2, 'pitchCamp']]) {
      plain.length = 0;
      assert.equal(HB.hotbarPress(slot, { entity: me, doors: bare, say: (l) => plain.push(l) }).kind, 'refused', `${kind}: refused`);
      assert.deepEqual(plain, [USE_PENDING[kind]], `${kind}: the stand-in`);
    }
    assert.equal(opened.length, 0);
  } finally { HB.clearQuickslots(); }
});

test('UI2 AUDIT UI B1/B4/B6: a quest letter pressed from a slot is USED - its popup shown, its quest told - never "You cannot use"; a camp the ground refuses is refused, never struck gold; an enchanted thing to use (the Sanguine Rose\'s kind) wears its wear, as the pack draws it (mutants: a quest item refused; a refused camp used; the wear on worn pieces alone)', () => {
  try {
    HB.clearQuickslots();
    const letter = { ...thing('UselessItems2', TEMPLATES.Parchment), questItem: true, questUID: 7, questSymbol: 'letter' };
    const popups = [];
    const resource = { actionWatching: true, useClicked: false, usedMessageID: 1011 };
    const quest = { getItem: (sym) => (sym === 'letter' ? resource : null), showMessagePopup: (id) => popups.push(id) };
    const tent = createSurvivalItem(SURV.CampingEquipment, { condition: 10 });
    const rose = { ...thing('PlantIngredients1', 10), enchantments: [{ type: 2, param: 4 }], maxCondition: 1500, currentCondition: 900 };
    const me = body([letter, tent, rose]);
    [letter, tent, rose].forEach((it, i) => HB.setHotbarSlot(i, HB.hotbarEntryForItem(it)));
    const said = [];
    const doors = { quickUse: () => { HB.useQuickslot('c1', { entity: me, items: me.items, say: (l) => said.push(l), hooks: { getQuest: (uid) => (uid === 7 ? quest : null), placeCamp: () => false } }); return true; } };
    const res = HB.hotbarPress(0, { entity: me, doors, say: (l) => said.push(l) });
    assert.deepEqual(popups, [1011], 'the letter\'s used-message popup');
    assert.equal(resource.useClicked, true, 'the quest heard the use');
    assert.notEqual(res.kind, 'refused', 'no refusal flash');
    assert.ok(!said.some((l) => /cannot use/.test(l)), 'and no "cannot use"');
    assert.equal(HB.hotbarPress(1, { entity: me, doors, say: (l) => said.push(l) }).kind, 'refused', 'a refused camp is refused');
    const v = HB.hotbarView(me);
    assert.equal(Number.isFinite(v[2].condition), true, 'an enchanted thing to use wears its wear');
    assert.equal(Number.isFinite(v[1].condition), false, 'a tent none');
  } finally { HB.clearQuickslots(); }
});

test('UI2 the hosts: every host hands its quick use the pack\'s own three window doors, one bag with the pack\'s (mutants: a host\'s hotbar Use without them)', () => {
  for (const [f, hooks] of [
    ['src/scenes/world.js', /const quickslotHooks = \(rig = weaponRig\) => \(\{[\s\S]{0,500}?\.\.\.packDoors,   \/\/ UI2/],
    ['src/scenes/exterior.js', /hooks: \{ \.\.\.useHooks, isEnchanted, hand: \(\) => quickslotHand\(rig\), \.\.\.packDoors \}/],
    ['src/scenes/dungeonContext.js', /hooks: \{ \.\.\.useHooks, isEnchanted, hand: \(\) => quickslotHand\(weaponRig\), \.\.\.packDoors \}/],
  ]) {
    const s = read(f);
    assert.match(s, hooks, `${f}: the quick use carries the doors`);
    assert.match(s, /const packDoors = \{\n\s+openBook: openBookHook,[^\n]*\n\s+placeCamp: \(item, list\) => camps\.placeItem\(item, list \?\? playerEntity\.items \?\? \[\]\),[\s\S]{0,900}?openSpellbook: \(\) => \{ const b = makeSpellbookWindow\(\); if \(b\) /, `${f}: the three doors`);
    assert.match(s, /createInventoryWindow\(\{\n\s+\.\.\.packDoors,/, `${f}: and the pack's builder spreads the same bag`);
  }
});

// ── THE PICTURES ────────────────────────────────────────────────────

test('UI2 spell icons: a spell\'s icon is ICON00I0\'s 16px tile FITTED to its slot, whole and untrimmed - an index past the sheet is none (mutants: a spell icon trimmed; an index past the sheet cut)', () => {
  assert.equal(spellIconPicture(-1, { box: 38 }), null);
  assert.equal(spellIconPicture(69, { box: 38 }), null, 'sixty-nine icons: 0-68');
  assert.equal(spellIconPicture(1.5, { box: 38 }), null);
  assert.equal(spellIconPicture(undefined, { box: 38 }), null);
  assert.equal(spellIconPicture(12, { box: 38, dpr: 1 }), null, 'null while the sheet loads (node has none)');
  assert.ok(_fittedKeys().includes('spellicon12@38x1c4w'), 'asked whole (untrimmed) at the slot\'s box');
  assert.ok(!_fittedKeys().some((k) => k.startsWith('spellicon69@')), 'no ask past the sheet');
  // the untrimmed fit: the whole 16px tile, its dark border and all
  const made = [];
  const saved = globalThis.document;
  globalThis.document = { createElement: () => { const c = { width: 0, height: 0, draws: [] }; c.getContext = () => ({ getImageData: (x, y, w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }), drawImage: (...a) => c.draws.push(a), imageSmoothingEnabled: true }); made.push(c); return c; } };
  try {
    const tile = globalThis.document.createElement('canvas'); tile.width = 16; tile.height = 16;
    tile.getContext = () => ({ getImageData: (x, y, w, h) => { const d = new Uint8ClampedArray(w * h * 4); for (let j = 2; j < 14; j++) for (let i = 2; i < 14; i++) d[(j * w + i) * 4 + 3] = 255; return { data: d }; } });
    const out = fitCanvas(tile, { box: 38, dpr: 1, trim: false });
    assert.deepEqual([out.canvas.width, out.cssW, out.smooth], [32, 32, false], 'the whole tile, twice its size');
    assert.deepEqual(out.canvas.draws[0].slice(1, 5), [0, 0, 16, 16], 'from its corner, not its opaque middle');
    const trimmed = fitCanvas(tile, { box: 38, dpr: 1 });
    assert.deepEqual(trimmed.canvas.draws[0].slice(1, 5), [2, 2, 12, 12], 'an item picture is trimmed (UI1)');
  } finally { if (saved === undefined) delete globalThis.document; else globalThis.document = saved; }
});

test('UI2 wiring: the bar\'s slots draw fitted pictures at a measured box - an item\'s by its dye, a spell\'s icon (its initials only while it loads) - the spellbook\'s drag and the diamond\'s spell chip wear the icon, the drop hint says any item; the box off a slot of the picture\'s own kind, the ratio off the bar (mutants: a spell slot back on its initials; the drag without its icon; the chip without its icon; every picture at slot 1\'s box; a spell fitted at an item\'s box; the ratio off a slot)', () => {
  const bar = read('src/ui/enhancedHotbar.js');
  assert.match(bar, /const drew = iconFor\(s, v\.slot, null, entity, v\.icon\);\n\s+const sig = spellSigil\(v\.name\);\n\s+s\.glyph\.textContent = drew \? '' : sig;/);
  assert.match(bar, /pic = spellIconPicture\(spellIcon, \{ box: fit\.box, dpr: fit\.dpr, onReady: again \}\);/);
  assert.match(bar, /requestFittedIcon\(image\.archive, image\.record, \{ box: fit\.box, dpr: fit\.dpr, dye: image\.dye, dyeTarget: image\.dyeTarget, onReady: again \}\)/);   // MERGE (UI2 x DYE-ICON): and the swatch
  assert.match(bar, /const key = kind \? `\$\{kind\}@\$\{fit\.box\}x\$\{fit\.dpr\}` : '';/, 'a new size draws them anew');
  assert.match(bar, /faceFit\[k\] = \{ box: Math\.max\(8, layout - 4\), dpr \};/, 'the face less two a side');
  // AUDIT UI B2/B3: the face of a slot of the picture's own kind, the ratio off the bar (never a slot the crossbar scales)
  assert.match(bar, /const s = slots\.find\(\(x\) => x\.face\?\.offsetWidth > 0 && !!x\.node\.classList\?\.contains\('hb-spell'\) === spell\);/);
  assert.match(bar, /const barShown = barLayout > 0 \? \(bar\.getBoundingClientRect\?\.\(\)\.width \?\? barLayout\) : 0;/);
  assert.match(bar, /const fit = slotFit\(!item && spellIcon != null\);/);
  assert.match(bar, /const HINT_DROP = 'Drag any item or a spell onto a slot\. Drag a slot off the bar to clear it\.';/);
  assert.match(bar, /if \(hbDrag\.icon\?\.src\) tile\.append\(fittedImg\(hbDrag\.icon\)\);/);
  assert.match(bar, /icon: slotPicture\(s\.icon\),/, 'a slot carried keeps its picture');
  const book = read('src/ui/enhancedSpellbook.js');
  assert.match(book, /icon: spellIconPicture\(r\.spell\?\.icon, \{ box: SPELL_DRAG_BOX \}\) \}\);/);
  const hud = read('src/ui/enhancedHud.js');
  assert.match(hud, /const pic = sp\?\.spell \? spellIconPicture\(sp\.spell\.icon, \{ box: SPELL_CHIP_BOX, dpr: clampDpr\(screenDpr\(\) \* \(last\.scale \?\? 1\)\), onReady: \(\) => \{ last\.qspell = null; \} \}\) : null;/);
  assert.match(hud, /spellChip\.append\(spellTag, spellIcon, spellName\);/);
  // the diamond's cells: fitted too, their boxes the sheet's caps less two a side
  const E = read('src/ui/enhancedStyle.js');
  assert.match(E, /\.hud-qicon \{ display: block; max-width: 44px; max-height: 44px;/);
  assert.match(E, /@media \(max-width: 860px\) \{[\s\S]{0,4000}?\.hud-qicon \{ max-width: 32px; max-height: 32px; \}/);
  assert.match(hud, /const QUICK_BOX = 40, QUICK_BOX_NARROW = 28;\nconst QUICK_NARROW = '\(max-width: 860px\)';/);
  assert.match(hud, /const key = `\$\{iconKeyOf\(item\)\}@\$\{box\}x\$\{dpr\}`;/, 'a new size or scale draws it anew');
  const art = read('src/ui/enhancedArt.js');
  assert.match(art, /return requestFittedPicture\(`spellicon\$\{index\}`, \(wake\) => sheetCutUrl\('ICON00I0\.IMG', rect, 1, wake\), \{ box, dpr, trim: false, onReady \}\);/);
});

test('UI2 the sheet cutter tells every screen that waited on it: a spell icon is cut from ICON00I0 once its sheet lands, and each asker hears it once - a fitted icon asks second (mutant: a waiter not heard)', async () => {
  // a synthetic ICON00I0 (headerless 320x64) and ART_PAL.COL (776 bytes), served by a stubbed fetch; canvases that
  // remember their size; no IndexedDB (the data door falls through to the network, as a fresh browser does)
  const saved = { fetch: globalThis.fetch, document: globalThis.document, ImageData: globalThis.ImageData, hadDoc: 'document' in globalThis };
  const sheet = new Uint8Array(20480); for (let i = 0; i < sheet.length; i += 7) sheet[i] = 5;
  globalThis.fetch = async (url) => {
    const name = String(url).split('/').pop();
    const body = name === 'ART_PAL.COL' ? new Uint8Array(776) : name === 'ICON00I0.IMG' ? sheet : null;
    return body ? { ok: true, status: 200, arrayBuffer: async () => body.buffer.slice(0) } : { ok: false, status: 404 };
  };
  globalThis.ImageData = class { constructor(data, w, h) { this.data = data; this.width = w; this.height = h; } };
  globalThis.document = { createElement: () => { const c = { width: 0, height: 0 }; c.getContext = () => ({ putImageData() {}, drawImage() {}, imageSmoothingEnabled: true }); c.toDataURL = () => `data:image/png;cut-${c.width}x${c.height}`; return c; } };
  try {
    const told = { a: 0, b: 0, c: 0 };
    assert.equal(sheetCutUrl('ICON00I0.IMG', [16, 0, 16, 16], 1, () => told.a++), null, 'cold');
    assert.equal(sheetCutUrl('ICON00I0.IMG', [16, 0, 16, 16], 1, () => told.b++), null, 'in flight');
    for (let i = 0; i < 40 && told.a === 0; i++) await new Promise((r) => setTimeout(r, 5));
    assert.deepEqual(told, { a: 1, b: 1, c: 0 }, 'both screens told, once');
    assert.equal(sheetCutUrl('ICON00I0.IMG', [16, 0, 16, 16], 1, () => told.c++), 'data:image/png;cut-16x16', 'warm: the tile at its own size');
    await new Promise((r) => setTimeout(r, 5));
    assert.equal(told.c, 0, 'a warm cut tells no one');
  } finally {
    globalThis.fetch = saved.fetch; globalThis.ImageData = saved.ImageData;
    if (saved.hadDoc) globalThis.document = saved.document; else delete globalThis.document;
  }
});

test('UI2 AUDIT UI B5: the diamond\'s cells are fitted again when the HUD\'s scale changes - a new scale asks each cell\'s picture at the new ratio, where it had kept the old one until a count changed (mutant: the size left out of the block\'s signature)', async () => {
  const mk = () => ({
    className: '', textContent: '', children: [], dataset: {}, alt: '', src: '',
    style: { setProperty(k, v) { this[k] = v; }, removeProperty(k) { delete this[k]; } },
    classList: { _s: new Set(), add(...c) { c.forEach((x) => this._s.add(x)); }, remove(...c) { c.forEach((x) => this._s.delete(x)); },
      toggle(c, on) { if (on) this._s.add(c); else this._s.delete(c); }, contains(c) { return this._s.has(c); } },
    attrs: {}, setAttribute(k, v) { this.attrs[k] = String(v); }, getAttribute(k) { return this.attrs[k]; },
    removeAttribute(a) { delete this.attrs[a]; }, remove() {}, append(...c) { this.children.push(...c); },
    appendChild(c) { this.children.push(c); return c; }, replaceChildren(...c) { this.children = c; }, addEventListener() {},
  });
  const prev = globalThis.document;
  globalThis.document = { createElement: mk, createElementNS: () => mk(), getElementById: () => null, head: mk(), body: mk() };
  const { drawEnhancedHud, destroyEnhancedHud } = await import('../src/ui/enhancedHud.js');
  const { setPref, getPref } = await import('../src/systems/uiPrefs.js');
  const was = getPref('hudScale');
  try {
    HB.clearQuickslots();
    const sword = createWeapon(120, 3);
    const me = body([sword]);
    Object.assign(me, { health: 40, maxHealth: 80, magicka: 0, maxMagicka: 10, fatigue: 100, equip: { slots: {} }, lightSource: null });
    setPref('hudScale', 1);
    drawEnhancedHud(me, 0, 0, { weapon: sword, weaponSheathed: false });   // the main cell: the weapon in hand
    const before = new Set(_fittedKeys());
    setPref('hudScale', 2);
    drawEnhancedHud(me, 0, 0, { weapon: sword, weaponSheathed: false });
    const asked = _fittedKeys().filter((k) => !before.has(k));
    assert.ok(asked.some((k) => /@40x2c4$/.test(k)), `the cell asked at twice the ratio (${asked.join(', ') || 'nothing asked'})`);
  } finally {
    setPref('hudScale', was);
    destroyEnhancedHud();
    HB.clearQuickslots();
    globalThis.document = prev;
  }
});

test('UI2 x DYE-ICON (AUDIT FINAL F2, the merge with main): a garment\'s slot draws the garment it shows, in its own dye - Blue and Red Straps are one kind and one name, and DYE-ICON dyes the cloth, so the slot asks the shown item\'s own picture and repaints when the shown item\'s dye changes (mutants: the picture keyed by its kind alone; the dye out of the bar\'s signature)', async () => {
  await import('./modsOff.js');
  const { withDom } = await import('./invdrag.mjs');
  const { mountHotbarDock, drawEnhancedHotbar } = await import('../src/ui/enhancedHotbar.js');
  const { setPref, _resetForTests } = await import('../src/systems/uiPrefs.js');
  const { inventoryItemImage } = await import('../src/systems/itemTemplates.js');
  const { iconName } = await import('../src/ui/textureCanvas.js');
  const prev = globalThis.location;
  _resetForTests();
  globalThis.location = { search: '?skin=enhanced' };
  setPref('quickbarStyle', 'hotbar');
  try {
    withDom((dom) => {
      const make = dom.doc.createElement;
      dom.doc.createElement = (tag) => Object.assign(make(tag), { removeAttribute(k) { delete this.attrs[k]; } });
      const dock = dom.mk('div'); dom.body.append(dock);
      mountHotbarDock(dock);
      HB.clearHotbar();
      const straps = (dye) => ({ name: 'Straps', group: 'MensClothing', templateIndex: 141, stackCount: 1, dye, currentCondition: 200, maxCondition: 200 });
      const blue = straps(0), red = straps(2);
      const e = { ...body([blue, red]), name: 'A', stats: { strength: 50, endurance: 48 }, goldPieces: 10 };
      const nm = (it) => { const im = inventoryItemImage(it, e); return iconName(im.archive, im.record, im.dye, im.dyeTarget); };
      assert.notEqual(nm(blue), nm(red), 'two pictures');
      assert.equal(HB.quickslotKey(blue), HB.quickslotKey(red), 'one kind');
      HB.setHotbarSlot(0, HB.hotbarEntryForItem(red));
      const asked = () => _fittedKeys().map((k) => k.split('@')[0]);
      drawEnhancedHotbar(e, { paused: false });
      assert.ok(asked().includes(nm(blue)), 'the slot shows the first of its kind: the blue');
      // the shown item changes to one of another dye and nothing else - the name, the count, the wear, the state all
      // the same: the bar's signature reads the dye, or the slot keeps the old colour
      e.items = [red, blue];
      drawEnhancedHotbar(e, { paused: false });
      assert.equal(HB.hotbarView(e)[0].item, red, 'the red first now');
      assert.ok(asked().includes(nm(red)), 'repainted in its own dye');
      equipItem(e, red);
      assert.equal(HB.hotbarView(e)[0].item, red, 'worn, the red is the one it shows');
      drawEnhancedHotbar(e, { paused: false });
      assert.ok(asked().includes(nm(red)), 'and its picture is the red one\'s');
      // the shown item changes to one of another dye and nothing else - the name, the count, the wear and the state
      // all the same: the bar's signature reads the dye, or the slot keeps the old colour
      const green = straps(5);
      e.items = [green, blue];
      drawEnhancedHotbar(e, { paused: false });
      assert.equal(HB.hotbarView(e)[0].item, green, 'the first of its kind now');
      assert.ok(asked().includes(nm(green)), 'repainted in its own dye');
      HB.clearHotbar();
    });
  } finally { globalThis.location = prev; _resetForTests(); }
});
