// GUN-LORE (2026-10-24; bible/05-Combat/Dwarven-Thunderlock.md "GUN-LORE"; the owner: "A proper lore pass on both weapons
// and how their projectiles work according to the dweamer"). The laws pinned:
//   - EACH GUN AND ITS SHOT SAYS WHAT IT IS: the Thunderlock, the Pistolet and the Dwemer Pellet each register their own
//     words (systems/thunderlock.js GUN_LORE), read by templateLore for every item of the template - a Common, a Gilded,
//     a gun era's - and said in the Info box under the item's name; nothing of DFU's says any.
//   - THE WORDS AGREE WITH THE SHOT: the coil's one note wakes the Pellet's aetherium and throws it as lightning (the shock
//     orb), and a coil sung must be wound again (the reload).
//   - THE BOOKS: Rourken Thunder (418) and The Ketch That Never Lands (419) - port books above every classic id, their low
//     bytes no classic book's, in the BOK format's own bytes, eight pages each, by the line's antiquarian.
import '../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createThunderlock, createPellets, GUN_LORE, THUNDERLOCK_TEMPLATE, PELLET_TEMPLATE } from '../../src/systems/thunderlock.js';
import { createPistolet, PISTOLET_TEMPLATE } from '../../src/systems/pistolet.js';
import { templateLore, templateByIndex } from '../../src/systems/item/itemTemplates.js';
import { mintGilded, VOLENDRUNGS_ECHO, KETCHMASTERS_WORD } from '../../src/systems/gilded.js';
import { createWeapon } from '../../src/combat/enemyEquipment.js';
import { ROURKEN_THUNDER_ID, KETCH_BOOK_ID, PORT_BOOKS, openPortBook, portBookBytes, isPortBook } from '../../src/systems/portBooks.js';
import { BOOK_ID_TITLES } from '../../src/systems/booksData.js';
import { RSC } from '../../src/formats/textRsc.js';
import { itemInfoBoxes } from '../../src/ui/enhanced/enhancedInventory.js';

test('GUN-LORE EACH SAYS WHAT IT IS: the Thunderlock, the Pistolet and the Pellet each its own words, for every item of the template whatever its tier; a DFU weapon none (mutants: the Pistolet unregistered; the Pellet\'s words the gun\'s)', () => {
  assert.deepEqual(Object.keys(GUN_LORE), ['thunderlock', 'pistolet', 'pellet']);
  assert.equal(templateLore(createThunderlock()), GUN_LORE.thunderlock);
  assert.equal(templateLore(createPistolet()), GUN_LORE.pistolet);
  assert.equal(templateLore(createPellets(5)), GUN_LORE.pellet);
  assert.equal(templateLore(mintGilded(VOLENDRUNGS_ECHO)), GUN_LORE.thunderlock, 'a Gilded gun is the gun still');
  assert.equal(templateLore(mintGilded(KETCHMASTERS_WORD)), GUN_LORE.pistolet);
  assert.equal(templateLore(createWeapon(120, 1)), null, 'DFU\'s weapons carry no words of the port\'s');
  assert.equal(templateLore(null), null);
  assert.equal(new Set(Object.values(GUN_LORE)).size, 3, 'three things, three sayings');
  for (const [t, k] of [[THUNDERLOCK_TEMPLATE, 'thunderlock'], [PISTOLET_TEMPLATE, 'pistolet'], [PELLET_TEMPLATE, 'pellet']]) {
    assert.ok(templateByIndex(t), `${k}: its template stands`);
    assert.ok(GUN_LORE[k].length < 320, `${k}: a box's worth, not a book's`);
    assert.ok(/^[\x20-\x7e]+$/.test(GUN_LORE[k]), `${k}: plain text`);
  }
});

test('GUN-LORE THE WORDS AGREE WITH THE SHOT: a tonal coil, one note, the Pellet\'s aetherium thrown as lightning, the coil wound again; the Dwemer and the Rourken named as canon has them (mutants: a flint; powder)', () => {
  assert.match(GUN_LORE.thunderlock, /tonal coil/);
  assert.match(GUN_LORE.thunderlock, /one deep note/);
  assert.match(GUN_LORE.thunderlock, /aetherium in a Dwemer Pellet/);
  assert.match(GUN_LORE.thunderlock, /bound lightning/);
  assert.match(GUN_LORE.pistolet, /wound again by its key/);
  assert.match(GUN_LORE.pistolet, /braces of two/);
  assert.match(GUN_LORE.pellet, /mote of aetherium/);
  assert.match(GUN_LORE.pellet, /found, never bought/);
  for (const t of Object.values(GUN_LORE)) assert.ok(!/powder|gunpowder/i.test(t), 'no powder - the lock holds a coil');
  assert.ok(!/flint\b(?! but)/i.test(GUN_LORE.thunderlock.replace('holds no flint but', '')), 'no flint');
  assert.match(GUN_LORE.thunderlock + GUN_LORE.pistolet, /Rourken/);
});

test('GUN-LORE THE INFO BOX: the template\'s words a box of their own under the item\'s name, for a gun and its shot; none for a DFU weapon (mutants: the box never pushed)', () => {
  const rows = () => [{ text: '%it' }];   // every TEXT.RSC record the item's name - a box the classic Info popup would draw
  const d = { rows };
  const flat = (boxes) => boxes.flat().map((r) => String(r?.text ?? r));
  for (const it of [createThunderlock(), createPistolet(), createPellets(3)]) {
    const boxes = itemInfoBoxes(it, d);
    assert.ok(flat(boxes).includes(templateLore(it)), `${it.templateIndex}: its words said`);
    assert.ok(boxes.findIndex((b) => b.some((r) => r?.text === templateLore(it))) >= 1, 'under the name\'s box');
  }
  assert.ok(!flat(itemInfoBoxes(createWeapon(120, 1), d)).some((t) => Object.values(GUN_LORE).includes(t)));
});

test('GUN-LORE THE BOOKS: Rourken Thunder (418) and The Ketch That Never Lands (419) - above every classic id, their low bytes no classic book\'s; by Imrah Bel-Tavir; eight pages each in the BOK format\'s own bytes, every page closed; the coil, the bead and the eight-place lift said (mutants: an id a classic book\'s; a page left open)', () => {
  assert.deepEqual([ROURKEN_THUNDER_ID, KETCH_BOOK_ID], [418, 419]);
  const classic = [...BOOK_ID_TITLES.keys()];
  for (const id of [ROURKEN_THUNDER_ID, KETCH_BOOK_ID]) {
    assert.ok(isPortBook(id));
    assert.ok(classic.every((c) => c < id && (c & 0xff) !== (id & 0xff)), `${id}: its filename no classic book's`);
    const f = openPortBook(id);
    assert.equal(f.author, 'Imrah Bel-Tavir');
    assert.equal(f.pageCount, 8);
    const bytes = portBookBytes(id);
    for (let p = 0; p < f.pageCount; p++) {
      const end = f.pageOffsets[p + 1] ?? bytes.length;
      assert.equal(bytes[end - 1], RSC.EndOfPage, `${id} page ${p} closed`);
    }
  }
  assert.equal(openPortBook(ROURKEN_THUNDER_ID).title, 'Rourken Thunder');
  assert.equal(openPortBook(KETCH_BOOK_ID).title, 'The Ketch That Never Lands');
  const text = (id) => PORT_BOOKS.get(id).pages.flat().map((r) => (typeof r === 'string' ? r : r.text)).join(' ');
  const gun = text(ROURKEN_THUNDER_ID), ship = text(KETCH_BOOK_ID);
  for (const w of ['Volendrung', 'Volenfell', 'tonal architecture', 'coil', 'aetherium', 'lightning', 'The thunder you hear is the note', 'pistolet', 'thunderlock']) assert.ok(gun.includes(w), `Rourken Thunder says ${w}`);
  // PIN MOVED (AUDIT KETCH L5-3): 'Loredas' out - the Ketch keeps the real week, never the online calendar's day; the book
  // says her week is twelve of ours, and names no day. PIN MOVED (KETCH-EVERY): she comes every ten hours - the book says
  // every fifth day, five of the online calendar's
  assert.ok(!ship.includes('Loredas'), 'The Ketch That Never Lands names no day of the calendar');
  for (const w of ['Mzunthar', 'every fifth day', 'Daggerfall', 'holds eight and will not rise for nine', 'Gallery of Hammers', 'cells', 'Tonal Warden', 'resonators', 'tuning-forks', 'turns west']) assert.ok(ship.includes(w), `The Ketch That Never Lands says ${w}`);
});
