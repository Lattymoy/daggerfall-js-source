// BS1 - THE GUILD LIBRARY BOOKSHELF (Internal/DaggerfallBookshelf.cs)
// and F198 - THE HEALTH STATUS BOX (DaggerfallUI.CreateHealthStatusBox
// :1631-1703). The two windows that finally consume two long-dormant
// producers: canAccessLibrary (guildServices.js) and
// contractedMessageRecord (diseases.js).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { BOOKSHELF_CAPACITY, populateBookshelf, bookshelfAccess, bookshelfTitles } from '../src/systems/bookshelf.js';
import { healthStatusRows, YOU_ARE_HEALTHY_ID, YOU_HAVE_BEEN_POISONED_ID } from '../src/systems/healthStatus.js';
import { BOOK_ID_TITLES } from '../src/systems/booksData.js';
import { bookTitle } from '../src/systems/books.js';
import { contractedMessageRecord, DISEASES } from '../src/systems/diseases.js';
import { BUILDING_TYPES } from '../src/world/buildingNames.js';

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..', 'src');
const code = (p) => readFileSync(join(SRC, p), 'utf8');

const rows = (id) => [{ text: `r${id}`, center: true }];

test('BS1: a shelf holds Start()\'s ten draws, and the empty-title drop is in the loop', () => {
  assert.equal(BOOKSHELF_CAPACITY, 10);
  // ten draws off a cycling roll - every id is a vendored book id
  let i = 0;
  const books = populateBookshelf(() => ((i += 7) % 100) / 100);
  assert.equal(books.length, 10);
  for (const id of books) assert.ok(BOOK_ID_TITLES.has(id), `id ${id} is a real book`);
  // the C# drops a draw whose title is EMPTY rather than redrawing
  // (:31-36) - unreachable through the vendored mapping, but the arm
  // is the law, so it is pinned in source.
  assert.match(code('systems/bookshelf.js'), /if \(\(bookTitle\(id\) \?\? ''\) !== ''\) books\.push\(id\);/);
  // and the picker rows are the titles, one per id
  assert.deepEqual(bookshelfTitles(books.slice(0, 2)), [bookTitle(books[0]), bookTitle(books[1])]);
});

test('BS1: ReadBook\'s gate - only a GuildHall or Temple consults the guild, a Library never', () => {
  const ACCESS_TEXT = 'You need to be a member of sufficient rank to access this.';   // Internal_Strings accessMembersOnly, verbatim
  // Mages Guild: rank >= 2 (MagesGuild.cs:129)
  const mages = { name: 'MagesGuild' };
  assert.equal(bookshelfAccess({ buildingType: BUILDING_TYPES.GuildHall, guild: mages, membership: { rank: 2 } }).allowed, true);
  const refused = bookshelfAccess({ buildingType: BUILDING_TYPES.GuildHall, guild: mages, membership: { rank: 1 } });
  assert.equal(refused.allowed, false);
  assert.equal(refused.text, ACCESS_TEXT);
  // Temple: the deity's own library rank (Temple.cs:466)
  const temple = { name: 'Akatosh', divine: true, services: { library: 3 } };
  assert.equal(bookshelfAccess({ buildingType: BUILDING_TYPES.Temple, guild: temple, membership: { rank: 3 } }).allowed, true);
  assert.equal(bookshelfAccess({ buildingType: BUILDING_TYPES.Temple, guild: temple, membership: { rank: 2 } }).allowed, false);
  // a nonmember (no membership) is refused in both
  assert.equal(bookshelfAccess({ buildingType: BUILDING_TYPES.GuildHall, guild: mages, membership: null }).allowed, false);
  // a hall the dict cannot name reads as the nonmember answer
  assert.equal(bookshelfAccess({ buildingType: BUILDING_TYPES.Temple, guild: null }).allowed, false);
  // a LIBRARY is public - no guild consulted at all
  assert.equal(bookshelfAccess({ buildingType: BUILDING_TYPES.Library, guild: null }).allowed, true);
});

test('BS1: the interior shelf click routes - bookshelf in the three types, loot shelves in a shop', () => {
  const wm = code('scenes/worldModes.js');
  assert.match(wm, /if \(b\.buildingType === BUILDING_TYPES\.Library \|\| b\.buildingType === BUILDING_TYPES\.GuildHall\n\s+\|\| b\.buildingType === BUILDING_TYPES\.Temple\) openBookshelf\(shelf, b\);/,
    'the DaggerfallInterior.cs:808-814 building-type gate');
  assert.ok(!wm.includes('Library/Guild/Temple bookshelves + owned-house storage pend'),
    'the old flag sentence is gone (the house half is re-flagged in place)');
  // the pick opens the reader on the id, through the one book hook
  assert.match(wm, /_openBookById\(\{ message: shelf\.books\[i\] \}\);/);
  assert.match(wm, /const _openBookById = makeOpenBookHook\(\{ fetchBytes, showReader: \(w\) => \{ interiorOverlay = w; \} \}\);/);
  // the shelf's book list is lazy and PER SHELF, the stock idiom
  assert.match(wm, /shelf\.books \?\?= populateBookshelf\(\);/);
  // the refusal is DFU's box, not a silent return
  assert.match(wm, /interiorOverlay = new ActionTextBox\(\[access\.text\]\);/);
});

test('F198: the health box decision, arm by arm', () => {
  // healthy: no diseases, no poisons
  assert.deepEqual(healthStatusRows({ activeEffects: [] }, rows), rows(YOU_ARE_HEALTHY_ID));
  assert.equal(YOU_ARE_HEALTHY_ID, 18);
  assert.equal(YOU_HAVE_BEEN_POISONED_ID, 117);
  // an INCUBATING disease shows nothing - and nothing qualified means
  // record 18 again (the `if (tokens == null)` tail)
  const incubating = { kind: 'disease', diseaseType: DISEASES.Plague, incubationOver: false };
  assert.deepEqual(healthStatusRows({ activeEffects: [incubating] }, rows), rows(18));
  // incubation over: the classic contracted message, record 100 + type
  const witch = { kind: 'disease', diseaseType: DISEASES.WitchesPox ?? 2, incubationOver: true };
  const one = healthStatusRows({ activeEffects: [witch] }, rows);
  assert.deepEqual(one, rows(contractedMessageRecord(witch.diseaseType)));
  // two ripe diseases concatenate, in order
  const plague = { kind: 'disease', diseaseType: DISEASES.Plague, incubationOver: true };
  assert.deepEqual(healthStatusRows({ activeEffects: [plague, witch] }, rows),
    [...rows(contractedMessageRecord(DISEASES.Plague)), ...rows(contractedMessageRecord(witch.diseaseType))]);
  // a WAITING poison is as silent as incubation
  const waiting = { kind: 'poison', state: 'waiting' };
  assert.deepEqual(healthStatusRows({ activeEffects: [waiting] }, rows), rows(18));
  // an ACTIVE poison appends record 117 - alone, or after the diseases
  const active = { kind: 'poison', state: 'active' };
  assert.deepEqual(healthStatusRows({ activeEffects: [active] }, rows), rows(117));
  assert.deepEqual(healthStatusRows({ activeEffects: [plague, active] }, rows),
    [...rows(contractedMessageRecord(DISEASES.Plague)), ...rows(117)]);
  // an ENDED entry counts for nothing
  assert.deepEqual(healthStatusRows({ activeEffects: [{ ...plague, ended: true }] }, rows), rows(18));
});

test('F198: all four hosts hand the Status action a showStatus - the seam input.js:184 requires', () => {
  for (const h of ['scenes/world.js', 'scenes/exterior.js', 'scenes/dungeonContext.js', 'scenes/worldModes.js']) {
    const src = code(h);
    assert.match(src, /showStatus/, `${h} provides showStatus`);
    assert.match(src, /healthStatusRows\(playerEntity, /, `${h} builds the box from the live entity`);
  }
  // the action route itself still requires the seam
  assert.match(code('ui/input.js'), /case 'Status': return ctx\.showStatus \? \(ctx\.showStatus\(\), true\) : false;/);
});
