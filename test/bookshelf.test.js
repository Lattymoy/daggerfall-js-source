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

import { BOOKSHELF_CAPACITY, populateBookshelf, bookshelfAccess, bookshelfTitles, isBookshelfBuilding } from '../src/systems/bookshelf.js';
import { healthStatusRows, YOU_ARE_HEALTHY_ID, YOU_HAVE_BEEN_POISONED_ID } from '../src/systems/healthStatus.js';
import { BOOK_ID_TITLES } from '../src/systems/booksData.js';
import { bookTitle } from '../src/systems/books.js';
import { contractedMessageRecord, DISEASES, startDisease, updateDiseases, diseaseCount } from '../src/systems/diseases.js';
import { createInfection } from '../src/systems/infection.js';
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
  // WORLD-HOVER lifted the GATE to systems/bookshelf.js, because the
  // world hover has to say which of the two a shelf is WITHOUT opening
  // it - and two producers of one DFU member is the violation the
  // bible names first. The click is a caller now; the gate is pinned
  // where it lives.
  assert.match(wm, /if \(isBookshelfBuilding\(b\.buildingType\)\) openBookshelf\(shelf, b\);/,
    'the click ASKS for the answer rather than keeping a second copy of it');
  assert.match(code('systems/bookshelf.js'),
    /export const isBookshelfBuilding = \(buildingType\) => buildingType === BUILDING_TYPES\.Library\n\s+\|\| buildingType === BUILDING_TYPES\.GuildHall \|\| buildingType === BUILDING_TYPES\.Temple;/,
    'the DaggerfallInterior.cs:808-814 building-type gate');
  assert.equal(isBookshelfBuilding(BUILDING_TYPES.Library), true);
  assert.equal(isBookshelfBuilding(BUILDING_TYPES.GuildHall), true);
  assert.equal(isBookshelfBuilding(BUILDING_TYPES.Temple), true);
  for (const t of [BUILDING_TYPES.GeneralStore, BUILDING_TYPES.Tavern, BUILDING_TYPES.House1, BUILDING_TYPES.Palace]) {
    assert.equal(isBookshelfBuilding(t), false, `building type ${t} makes loot shelves, not bookshelves`);
  }
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

test('F198: the health box decision, arm by arm - over the entries the PRODUCER mints (MAC-ILL1)', () => {
  // MAC-ILL1 (2026-09-21, a player: "apparently i am ill (based on the
  // fast travel warning), but when I press 'I' it doesn't list any
  // illnesses"): this pin used to build its entries by hand as
  // `{ kind: 'disease', diseaseType }` - the READER's invented shape -
  // while startDisease writes `disease`. Every arm passed and the box
  // drew empty in the game. TEST THE SHAPE THE PRODUCER MINTS.
  const seq = (...v) => { let i = 0; return () => v[Math.min(i++, v.length - 1)]; };
  const P = () => ({
    isPlayer: true, level: 5, career: {}, health: 40, maxHealth: 40, magicka: 30, fatigue: 6400,
    stats: { strength: 50, intelligence: 50, willpower: 50, agility: 50, endurance: 50, personality: 50, speed: 50, luck: 50 },
  });
  const sinks = { hurt() {}, drainFatigue() {}, drainMagicka() {} };
  // healthy: no diseases, no poisons
  assert.deepEqual(healthStatusRows({ activeEffects: [] }, rows), rows(YOU_ARE_HEALTHY_ID));
  assert.equal(YOU_ARE_HEALTHY_ID, 18);
  assert.equal(YOU_HAVE_BEEN_POISONED_ID, 117);
  // an INCUBATING disease (contracted today) shows nothing - and nothing
  // qualified means record 18 again (the `if (tokens == null)` tail);
  // the travel popup's condition (diseaseCount > 0) already warns - the
  // one DFU-faithful disagreement between the two texts
  const pc = P();
  const plague = startDisease(pc, DISEASES.Plague, 100);
  assert.ok(plague && plague.disease === DISEASES.Plague && plague.diseaseType === undefined, 'the producer\'s field is `disease`');
  assert.equal(diseaseCount(pc), 1, 'the travel warning fires');
  assert.deepEqual(healthStatusRows(pc, rows), rows(18), 'incubating: the healthy line, as CreateHealthStatusBox :1694-1697');
  // incubation over (the first day-crossing tick): the classic contracted
  // message, record 100 + type - THE line the player did not get
  updateDiseases(pc, 101, sinks, seq(0.5));
  assert.equal(plague.incubationOver, true);
  assert.deepEqual(healthStatusRows(pc, rows), rows(contractedMessageRecord(DISEASES.Plague)), 'mutants: a field nothing writes - an EMPTY box, not even the healthy line');
  // two ripe diseases concatenate, in order
  const pox = startDisease(pc, DISEASES.WitchesPox, 101);
  updateDiseases(pc, 102, sinks, seq(0.5));
  assert.equal(pox.incubationOver, true);
  assert.deepEqual(healthStatusRows(pc, rows),
    [...rows(contractedMessageRecord(DISEASES.Plague)), ...rows(contractedMessageRecord(DISEASES.WitchesPox))]);
  // an INFECTION entry (vampirism / lycanthropy) is Diseases.None: no
  // message ever (DiseaseEffect.cs:204-205), and alone it is the healthy line
  const bitten = P();
  bitten.activeEffects = [createInfection('vampirism', { day: 100 })];
  assert.equal(diseaseCount(bitten), 1, 'it counts for the travel warning (BundleTypes.Disease)');
  assert.deepEqual(healthStatusRows(bitten, rows), rows(18), 'mutants: NaN\'s record read for the null type');
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
  // and a reader whose record is EMPTY (a TEXT.RSC without the line) still never draws a blank box
  assert.deepEqual(healthStatusRows({ activeEffects: [plague] }, (id) => (id === 18 ? rows(18) : [])), rows(18), 'mutants: an empty append making `tokens` non-null');
});

test('F198: all four hosts hand the Status action a showStatus - the seam input.js:704 requires', () => {
  for (const h of ['scenes/world.js', 'scenes/exterior.js', 'scenes/dungeonContext.js', 'scenes/worldModes.js']) {
    const src = code(h);
    assert.match(src, /showStatus/, `${h} provides showStatus`);
    assert.match(src, /healthStatusRows\(playerEntity, /, `${h} builds the box from the live entity`);
  }
  // the action route itself still requires the seam
  assert.match(code('ui/input.js'), /case 'Status': return ctx\.showStatus \? \(ctx\.showStatus\(\), true\) : false;/);
});
