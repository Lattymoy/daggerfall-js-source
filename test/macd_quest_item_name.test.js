// ---------------------------------------------------------------------------
// MAC-D - A QUEST NAMES WHAT IT ASKS FOR (2026-09-17, Mac: "I was given a
// quest to find a book, but the book's name was just *Book*").
//
// `Item.ExpandMacro` (Item.cs:236-260) answers `_symbol_` and `=symbol_`
// with `GetLongName(item)`, and `GetLongName` (:304-307) is one line:
// `ItemHelper.ResolveItemLongName(item, false)`. The port returned the
// raw `name` field instead, under a note that said so and gave its
// reason: "ResolveItemLongName's material/condition prefix half is the
// inventory arc's label maker; the port's shop windows speak the same
// plain template name today, so the long name here is name ?? template
// name - one convention."
//
// That was true when it was written and stopped being true at D7, which
// ported ResolveItemLongName whole. Nothing came back to the quest
// machine, so it went on naming a Daedric Broadsword "Broadsword", a
// potion "Glass Bottle", a quest letter "Parchment" - and a book "Book",
// which is the one a player read out loud.
//
// The book is the loudest because `ResolveItemName` treats Books as a
// case of their own (ItemHelper.cs:277-279): a book's name IS its title,
// and the template name is only the fallback for an id no BOOK file
// backs. The port already had that arm; the quest machine simply was not
// asking it.
// ---------------------------------------------------------------------------
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Item as QuestItem } from '../src/systems/quest/item.js';
import { bookTitle, BOOK_TEMPLATE } from '../src/systems/books.js';
import { BOOK_ID_TITLES } from '../src/systems/booksData.js';
import { itemLongName } from '../src/systems/itemInfo.js';
import { WEAPONS } from '../src/characters/weapons.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const rd = (p) => readFileSync(join(root, p), 'utf8');

/** A quest Item resource wrapped round an already-minted item - the
 *  shape `_symbol_` expands through, with the mint itself out of scope. */
function resource(dfItem, { artifact = false, parentQuest = null } = {}) {
  const it = Object.create(QuestItem.prototype);
  it.daggerfallUnityItem = dfItem;
  it.artifact = artifact;
  it.parentQuest = parentQuest;
  return it;
}

test('MAC-D: a quest book is named by its TITLE, not by the word "Book"', () => {
  const id = [...BOOK_ID_TITLES.keys()].find((b) => (bookTitle(b) ?? '') !== '');
  assert.ok(id != null, 'the port maps at least one book id to a title');
  const title = bookTitle(id);
  assert.notEqual(title, 'Book', 'the fixture must not be the fallback itself');
  const book = { group: 'Books', templateIndex: BOOK_TEMPLATE, name: 'Book', message: id };
  assert.equal(resource(book).expandMacro(1), title, '_symbol_ says what the quest is asking for');
  assert.equal(resource(book).expandMacro(5), title, '...and so does =symbol_ (DetailsMacro)');
});

test('MAC-D: an id no BOOK file backs keeps the template name, which is what the fallback is FOR', () => {
  const book = { group: 'Books', templateIndex: BOOK_TEMPLATE, name: 'Book', message: 999999 };
  assert.equal(resource(book).expandMacro(1), 'Book',
    'GetBookTitle falls back to the short name (ItemHelper.cs:279) - "Book" is right here and wrong above');
});

test('MAC-D: and the OTHER arms the raw field was flattening', () => {
  // a material prefix - the thing ResolveItemLongName exists for
  const sword = { group: 'Weapons', templateIndex: WEAPONS.Broadsword, name: 'Broadsword', nativeMaterialValue: 0x0500 };
  const named = resource(sword).expandMacro(1);
  assert.equal(named, itemLongName(sword, { differentiatePlantIngredients: false }),
    'the quest machine and the item lists now say the same words');
  assert.notEqual(named, 'Broadsword', 'a material prefix is part of the name DFU gives');
});

test('MAC-D: the two arms that are NOT the long name still are not', () => {
  // an ARTIFACT is its shortName and nothing else (Item.cs:244-245)
  const art = { group: 'Artifacts', name: 'Artifact', shortName: 'Volendrung' };
  assert.equal(resource(art, { artifact: true }).expandMacro(1), 'Volendrung');
  // GOLD is its stack count (:247)
  const gold = { group: 'Currency', templateIndex: 276, stackCount: 412 };
  assert.equal(resource(gold).expandMacro(1), '412');
  // and an unsupported macro is still `false`, which is what lets the
  // caller fall through to another resource.
  assert.equal(resource(gold).expandMacro(2), false);
  // no minted item, no answer
  assert.equal(resource(null).expandMacro(1), false);
});

test('MAC-D: it is Item.cs:306’s call, arguments and all', () => {
  const s = rd('src/systems/quest/item.js');
  assert.match(s, /const long = itemLongName\(it, \{/, 'ResolveItemLongName, not the raw field');
  assert.match(s, /differentiatePlantIngredients: false,/,
    ':306 passes FALSE - a quest asking for a plant names the plant, not its (northern) variant');
  assert.match(s, /getQuest: \(uid\) => \(uid === this\.parentQuest\?\.uid \? this\.parentQuest : null\)/,
    'the letter arm names its OWN quest’s signoff');
  // ...and the old note is gone, because the thing it excused is.
  assert.ok(!/so the\n\s+\*\s+long name here is name \?\? template name - one convention/.test(s),
    'a note excusing behaviour the module no longer has is a lie with a citation');
});
