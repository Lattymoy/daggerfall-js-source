// SEAT2b part two (2026-10-01, Mac: "Finish the seats"; "Let's pick up 482"): THE WORKS AT PEACE ON THE CLIENT - the
// Watchtowers' word asked ten minutes apart and said once a challenger, a week and a share, kept on the device; the
// seats dressed in their works; the Seat tab's towers lines; a craft carrying the town its station stands in; the host's
// seams - a members' Harbour a Travel Options port, a coast the sea beside the town, the Ram Kit's words (bible/
// 11-Multiplayer/Seats-Arc.md 7.5; src/net/townSeatBook.js, src/net/profBook.js, src/ui/seatTab.js, src/ui/professions/profPages.js,
// src/scenes/world.js). `06-Systems/Online-Arc.md` SEAT2b part two.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { byClass } from '../chargenDom.mjs';
import { createTownSeatBook, SEAT_TOWERS_KEY, SEAT_TOWERS_SAID_MAX, SEAT_TOWERS_EVERY_MS } from '../../src/net/townSeatBook.js';
import { storedText } from '../../src/systems/smithItems.js';
import { SIEGE_STAYS_LINE, STOCK_STAYS_LINE } from '../../src/ui/professions/profPages.js';

const W = readFileSync(new URL('../../src/scenes/world.js', import.meta.url), 'utf8');
const memStore = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), m }; };
const SH = { id: 'gsh', name: 'The Silver Hand', tag: 'SH' };

test('SEAT2b part two THE WATCHTOWERS\' WORD: due only for a guild holding a seat whose towers stand, ten minutes apart; each challenger past a share said once a week - kept on the device past a reload, the newest SEAT_TOWERS_SAID_MAX - and said again at a new share or a new week (mutants: the due; the clock; the once; the store; the cap; the share)', async () => {
  let now = 1_000_000_000;
  let towers = [{ guild: 'geo', influence: 600, share: 0.5, name: 'Ebon Oath', tag: 'EO' }];
  let week = 40;
  const asked = [];
  const seats = [
    { key: 3021, name: 'Anticlere', holder: { guild: SH }, forts: { watchtowers: 1 } },
    { key: 3022, name: 'Ashfield', holder: { guild: SH }, forts: { forge: 1 } },
    { key: 3034, name: 'Alcaire Keep', holder: { guild: { id: 'gdg', name: 'Daggers', tag: 'DG' } }, forts: { watchtowers: 2 } },
  ];
  const door = {
    list: async () => ({ ok: true, data: { seats } }),
    standings: async (key, c) => { asked.push([key, c]); return { ok: true, data: { week, towers } }; },
  };
  const store = memStore();
  const book = createTownSeatBook({ door, storage: store, nowMs: () => now, character: () => 'c1' });
  assert.equal(book.towersDue('gsh'), false, 'the seats not read yet');
  await book.read();
  assert.deepEqual([book.towersDue('gsh'), book.towersDue('gdg'), book.towersDue('gic'), book.towersDue(null)], [true, true, false, false]);
  const said = [];
  assert.deepEqual(await book.towers('gsh', (t) => said.push(t)), ['The Watchtowers of Anticlere see Ebon Oath <EO> past half of our defense.']);
  assert.deepEqual(asked, [[3021, 'c1']], 'the towered seat alone, its standings read afresh');
  assert.deepEqual(said, ['The Watchtowers of Anticlere see Ebon Oath <EO> past half of our defense.']);
  assert.deepEqual(JSON.parse(store.getItem(SEAT_TOWERS_KEY)), ['40:3021:geo:0.5']);
  assert.equal(book.towersDue('gsh'), false, 'asked just now');
  now += SEAT_TOWERS_EVERY_MS - 1;
  assert.equal(book.towersDue('gsh'), false);
  now += 1;
  assert.equal(book.towersDue('gsh'), true, 'ten minutes on');
  assert.deepEqual(await book.towers('gsh', (t) => said.push(t)), [], 'said once');
  // a reload: the device remembers
  const book2 = createTownSeatBook({ door, storage: store, nowMs: () => now, character: () => 'c1' });
  await book2.read();
  assert.deepEqual(await book2.towers('gsh', (t) => said.push(t)), []);
  // past a quarter now - a new share; and a new week
  towers = [{ guild: 'geo', influence: 300, share: 0.25, name: 'Ebon Oath', tag: 'EO' }];
  assert.deepEqual(await book2.towers('gsh'), ['The Watchtowers of Anticlere see Ebon Oath <EO> past a quarter of our defense.']);
  week = 41;
  assert.equal((await book2.towers('gsh')).length, 1, 'a new week, said again');
  assert.equal(said.length, 1);
  // the cap: the newest kept
  towers = Array.from({ length: SEAT_TOWERS_SAID_MAX + 3 }, (_, i) => ({ guild: `g${i}`, influence: 900, share: 0.5, name: `G${i}`, tag: `T${i}` }));
  await book2.towers('gsh');
  const kept = JSON.parse(store.getItem(SEAT_TOWERS_KEY));
  assert.equal(kept.length, SEAT_TOWERS_SAID_MAX);
  assert.equal(kept.at(-1), `41:3021:g${SEAT_TOWERS_SAID_MAX + 2}:0.5`);
  // nothing answered: nothing said
  towers = null;
  assert.deepEqual(await book2.towers('gsh'), []);
});

test('SEAT2b part two THE SEATS DRESSED IN THEIR WORKS: a derived seat carries the works the list said of it - none where it said none (mutants: the works kept)', async () => {
  const door = { list: async () => ({ ok: true, data: { seats: [{ key: 3021, holder: { guild: SH }, battle: null, forts: { harbour: 1 } }, { key: 3022, holder: null }] } }) };
  const book = createTownSeatBook({ door, storage: null });
  await book.read();
  assert.deepEqual(book.dressed({ key: 3021, name: 'Anticlere' }).forts, { harbour: 1 });
  assert.equal(book.dressed({ key: 3022, name: 'Ashfield' }).forts, null);
  assert.equal(book.dressed({ key: 9999, name: 'Elsewhere' }).forts, null);
});

test('SEAT2b part two THE SEAT TAB\'S TOWERS: the standings the service answered a holder\'s member carry the Watchtowers\' lines under the guilds; a reader with none sees none (mutants: the lines; the words)', async () => {
  const { createSeatTab } = await import('../../src/ui/seatTab.js');
  const SEAT = { key: 3021, name: 'Anticlere', region: 17, tier: 'palace' };
  const settle = async (n = 8) => { for (let i = 0; i < n; i++) await Promise.resolve(); };
  const rig = (towers) => {
    const data = { seat: SEAT, week: 6, phase: 'muster', reckoningAt: 1_800_003_600, turningAt: 1_800_086_400, defence: 1000, holder: { guild: { ...SH, heraldry: null }, since: 3, standing: 55, tithe: 6, edict: null },
      battle: null, chronicle: [], mine: { guild: 'gsh', rank: 2, seasoned: true, bound: 'gsh', pledges: [], influence: 0, tributeRoom: 0 },
      standings: [{ guild: { ...SH, heraldry: null }, influence: 1000, legacy: 0, holder: true }, { guild: { id: 'geo', name: 'Ebon Oath', tag: 'EO', heraldry: null }, influence: 600, legacy: 0, holder: false }],
      ...(towers ? { towers } : {}) };
    const book = { zero: null, standings: async () => ({ data, error: null }), forts: async () => ({ data: { works: {}, stockpile: [] }, error: null }) };
    const ui = { busy: () => false, run: (start) => start(), rerender: () => {}, nowS: () => 1_800_000_000, alive: () => true };
    return createSeatTab({ seat: SEAT, book, port: false, countName: (k) => k }, ui);
  };
  const tab = rig([{ guild: 'geo', influence: 600, share: 0.5, name: 'Ebon Oath', tag: 'EO' }]);
  await tab.open(); await settle();
  assert.deepEqual(byClass(tab.body(), 'notice-seat-towers').map((n) => n.textContent), ['The Watchtowers of Anticlere see Ebon Oath <EO> past half of our defense.']);
  const none = rig(null);
  await none.open(); await settle();
  assert.equal(byClass(none.body(), 'notice-seat-towers').length, 0);
});

test('SEAT2b part two A CRAFT CARRIES ITS TOWN: the book keeps the town the station stands in with the craft and asks the door with it - none where it named none or a bad one; the door posts it (mutants: the keep; the ask; the post)', async () => {
  const { createProfBook } = await import('../../src/net/profBook.js');
  const calls = [];
  const door = { account: () => 'p1', craft: async (...a) => { calls.push(a); return { ok: true, data: { pieces: [], stores: [], xp: 1, count: 1 } }; } };
  const book = createProfBook({ door, storage: null, character: () => 'c1', sleep: async () => {} });
  await book.craft('longsword:mithril', { clean: true, seat: 3021 }, () => {});
  await book.craft('longsword:mithril', { clean: true }, () => {});
  await book.craft('longsword:mithril', { clean: true, seat: -4 }, () => {});
  assert.deepEqual(calls.map((a) => a[7]), [3021, null, null]);
  const posted = [];
  const { accountProf } = await import('../../src/net/accountClient.js');
  const prof = accountProf({ fetch: async (u, i) => { posted.push([new URL(u).pathname, JSON.parse(i.body)]); return new Response('{"ok":true}', { status: 200 }); }, storage: { getItem: () => JSON.stringify({ id: 'p1', secret: 's' }), setItem() {}, removeItem() {} } });
  await prof.craft('c1', 'longsword:mithril', true, 'Hollin', 'rid-1', false, null, 3021);
  await prof.craft('c1', 'longsword:mithril', true, 'Hollin', 'rid-2');
  assert.deepEqual(posted.map(([p, b]) => [p, b.seat]), [['/v1/prof/craft', 3021], ['/v1/prof/craft', undefined]]);
});

test('SEAT2b part two THE HOST\'S SEAMS: a members\' Harbour is the travel map\'s, the popup\'s, the held map\'s, Roleplay Realism\'s and the deed\'s port; the board\'s coast is the sea beside the town; a craft names the held town whose hall steps it; the Watchtowers asked from the frame; a Ram Kit\'s craft and its Stores say where it waits (mutants: each seam; the words)', () => {
  assert.match(W, /setSeatHarbours\(\(mapId\) => harbourPortFor\(seatHere\(mapId\), guildBook\?\.guild\?\.id \?\? null\)\);/);
  // PIN MOVED (AUDIT CAPTAIN'S SEA P10): past the Veil an isle's place answers by its own kind first, the Bay's as before
  assert.match(W, /portTown: \(loc\.ether \? loc\.etherKind === 'port' : modSetting\('travel-options', 'Enabled'\) === true \? hasPortFor\(loc\.mapTableData\?\.mapId\) :/);
  assert.match(W, /if \(hasPortFor\(summary\.id\)\) return true;/);
  for (const f of ['src/ui/travel/travelPopUp.js', 'src/ui/travel/travelMapOptions.js', 'src/ui/heldMap.js']) {   // TIDY2: whole paths, so a move rewrites them
    assert.match(readFileSync(new URL(`../../${f}`, import.meta.url), 'utf8'), /import \{ hasPortFor as hasPort \} from '(?:\.\.\/)+systems\/travel\/travelPorts\.js';/, f);
  }
  assert.match(readFileSync(new URL('../../src/systems/travel/travelOptions.js', import.meta.url), 'utf8'), /hasPort: \(mapId\) => hasPortFor\(mapId\),/);
  assert.match(W, /const seaPixel = \(x, y\) => isWaterPixel\(maps\.getClimateIndex\(x, y\), woods\.getHeightMapValue\(x, y\)\);/);
  assert.match(W, /port: coastalAt\(town\.px, town\.py, seaPixel, csaIsPortTown\(town\.px, town\.py\)\),/);
  assert.match(W, /const \{ seat \} = myHall\(recipeById\(recipe\)\?\.profession\);/);   // PIN MOVED (AUDIT PROF-541 R2-H1): fortLaw.js hallStepsFor (prof9_client.test.js drives it)
  assert.match(W, /const myHall = \(profession\) => hallStepsFor\(seatHere\(_musicLoc\?\.mapTableData\?\.mapId\), guildBook\?\.guild\?\.id \?\? null, profession\);/);
  assert.match(W, /name: typeof playerEntity\?\.name === 'string' \? playerEntity\.name : null, seat \}, profMintCraft\);/);
  assert.match(W, /\{ const g = guildBook\?\.guild\?\.id \?\? null; if \(g && seatBook\?\.towersDue\(g\)\) seatBook\.towers\(g, \(t\) => townTalk\.say\(t, 6\)\)\.catch\(\(\) => \{\}\); \}/);
  assert.match(W, /const made = rec\?\.kind === 'siege' \? storedText\(rec\.name, Number\(r\.data\.count\) \|\| 1\) : craftedText\(mintPieces\(r\.data\)\);/);
  assert.equal(storedText('Ram Kit'), 'You made a Ram Kit. It waits in your Stores');
  assert.equal(storedText('Ram Kit', 2), 'You made 2 Ram Kits. They wait in your Stores');
  assert.notEqual(SIEGE_STAYS_LINE, STOCK_STAYS_LINE);
  assert.match(SIEGE_STAYS_LINE, /Siege Camp/);
  // BAG1 (PIN MOVED): one law for the Stores page and the bag's page - the line chosen in `staysLine`, which both call;
  // PIN MOVED (L10N4): said through their readers
  const pp = readFileSync(new URL('../../src/ui/professions/profPages.js', import.meta.url), 'utf8');
  assert.match(pp, /: pick\.family === 'siege' \? siegeStaysLine\(\) : stockStaysLine\(\)\);/);
  assert.equal(pp.match(/: staysLine\(pick\)\)\);/g)?.length, 2, 'both pages say it');
});
