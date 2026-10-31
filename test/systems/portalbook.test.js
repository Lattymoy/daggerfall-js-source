// PORTAL-BOOK (2026-10-31, as the owner asked; bible/06-Systems/Portal-Stone.md PORTAL-BOOK):
// the book's row and gift (systems/gate/gateSpoils.js), its law (systems/portalBook.js), the save, the wire's landing
// (systems/portalStone.js, scenes/portalGates.js), the house read indoors and the window (scenes/portalBookHost.js), and
// the stone opened on a kept door (scenes/portalStoneHost.js openToSpot).
import '../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { PORTAL_BOOK_TEMPLATE, PORTAL_BOOK_GIFT, isPortalBook, mintPortalBook, givePortalBookGift, portalStones } from '../../src/systems/gate/gateSpoils.js';
import {
  PORTAL_BOOK_MAX, PORTAL_BOOK_TEXT, readPortalSpot, readPortalBook, portalSpotOf, portalSpotLabel, keepPortalSpot, forgetPortalSpot, nativeOnPixel,
} from '../../src/systems/portalBook.js';
import { portalWire, validPortalRecord } from '../../src/systems/portalStone.js';
import { createPortalGates } from '../../src/scenes/portalGates.js';
import { bookHouseOf, createPortalBookHost, portalStonesIn } from '../../src/scenes/portalBookHost.js';
import { templateByIndex, itemUseHandler } from '../../src/systems/item/itemTemplates.js';
import { lawTemplate } from '../../src/systems/item/itemLaw.js';
import { isBound } from '../../src/systems/item/itemBound.js';
import { BOUND_TEMPLATES } from '../../src/net/realm/realmTradeLaw.js';
import { snapshotPlayer, restorePlayer } from '../../src/systems/save/save.js';
import { createBankAccounts, createHouses, SHIP_TYPES } from '../../src/systems/banking.js';
import { mapPixelToWorldCoords } from '../../src/world/streamingWorld.js';

const src = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
/** A native point inside map pixel (x, y), `dx`/`dz` units in from its corner. */
const onPixel = (x, y, dx = 5000, dz = 5000, h = 3) => { const c = mapPixelToWorldCoords(x, y); return [c.x + dx, h, c.z + dz]; };
const spot = (over = {}) => ({ k: 'friend', n: 'ExamplePlayer', t: 'Daggerfall', m: 1234, b: 99, d: [207, 213], a: onPixel(207, 213), w: 1.5, ...over });

test('PORTAL-BOOK the book: template 577, bound and pack-only, no weight, the Holy Tome\'s art; the item law knows it and the realm trade refuses it; its Use is the portal door\'s', () => {
  assert.equal(PORTAL_BOOK_TEMPLATE, 577);
  const t = templateByIndex(PORTAL_BOOK_TEMPLATE);
  assert.equal(t.name, 'Portal Book');
  assert.equal(t.bound, true); assert.equal(t.packOnly, true); assert.equal(t.hasNoEncumbrance, true);
  assert.deepEqual([t.worldTextureArchive, t.worldTextureRecord], [209, 0]);
  assert.equal(lawTemplate(PORTAL_BOOK_TEMPLATE)?.index, 577, 'the account service\'s law knows it');
  assert.ok(BOUND_TEMPLATES.includes(577));
  const book = mintPortalBook();
  assert.ok(isPortalBook(book)); assert.ok(isBound(book));
  assert.deepEqual(itemUseHandler(PORTAL_BOOK_TEMPLATE)?.(book), { kind: 'openPortal', item: book }, 'the readers route it as the stone');
});

test('PORTAL-BOOK the gift: one book a character, once, and marked; a pack that holds one is given none; the kit holds one; the save carries the mark and the spots', () => {
  const fresh = { items: [] };
  assert.equal(givePortalBookGift(fresh), 1);
  assert.equal(fresh.items.filter(isPortalBook).length, 1);
  assert.equal(fresh.portalBookGift, PORTAL_BOOK_GIFT);
  assert.equal(givePortalBookGift(fresh), 0, 'once');
  assert.equal(givePortalBookGift({ items: [mintPortalBook()] }), 0, 'never a second book');
  for (const torn of [null, 7, 'x']) assert.equal(givePortalBookGift(torn), 0);
  const kit = src('src/systems/startingGear.js');
  assert.ok(kit.includes('if (givePortalBookGift(entity)) added.push(entity.items.find(isPortalBook));'), 'a new character\'s kit');
  // the save: a character from before the book is given it as it is restored, and its spots ride the save
  const character = { name: 'Example', gender: 'male', careerIndex: 4, level: 3, reflexes: 2, health: 22, maxHealth: 40, magicka: 15, maxMagicka: 30,
    startingLevelUpSkillSum: 90, currentLevelUpSkillSum: 120, readyToLevelUp: false, pendingLevel: null, chargenDone: true,
    stats: { strength: 55, luck: 60 }, skills: [30, 28], skillUses: [100, 0], career: { name: 'Healer', hitPointsPerLevel: 8 },
    items: [], spells: [], activeEffects: [], bankAccounts: createBankAccounts(), houses: createHouses(62), ownedShip: SHIP_TYPES.None,
    portalBook: [spot(), { junk: true }] };
  const snap = JSON.parse(JSON.stringify(snapshotPlayer(character, { position: [0, 0, 0], classicMinutes: 0, locationKey: 'world' })));
  assert.deepEqual(snap.portalBook, [spot()], 'a spot outside its law is not written');
  delete snap.portalBookGift;   // a save from before the book
  const back = { ...character, items: [], portalBook: undefined };
  restorePlayer(back, snap, new Map());
  assert.deepEqual(back.portalBook, [spot()]);
  assert.equal(back.items.filter(isPortalBook).length, 1, 'given as the save is restored');
  assert.equal(back.portalBookGift, PORTAL_BOOK_GIFT);
});

test('PORTAL-BOOK the spot\'s law: every field in its law or the spot is refused; the landing must stand on the spot\'s own pixel; one spot a house, ten at most', () => {
  assert.deepEqual(readPortalSpot(spot()), spot());
  for (const bad of [{ k: 'dungeon' }, { n: '' }, { k: 'home', n: 'Somebody' }, { n: 'x'.repeat(61) }, { t: '\u0007' }, { m: -1 }, { b: 1.5 }, { d: [207] }, { d: [207, 213.5] },
    { a: onPixel(208, 213) }, { a: [1, 2] }, { w: NaN }]) assert.equal(readPortalSpot(spot(bad)), null, JSON.stringify(bad));
  assert.ok(nativeOnPixel(onPixel(0, 499, 1, 1), [0, 499]));
  const many = Array.from({ length: 12 }, (_, i) => spot({ b: i }));
  assert.equal(readPortalBook([...many, spot({ b: 0, n: 'Again' })]).length, PORTAL_BOOK_MAX);
  assert.deepEqual(readPortalBook([spot(), spot({ n: 'Second' })]).map((s) => s.n), ['ExamplePlayer'], 'one a house: the first kept');
  assert.deepEqual(readPortalBook('nonsense'), []);
});

test('PORTAL-BOOK the keep and the forget: a new house is added, the same house again moves its spot in place, a full book refuses, a spot outside its law is refused; the book is never changed in place', () => {
  const book = [spot({ b: 1 })];
  const r = keepPortalSpot(book, spot({ b: 2 }));
  assert.equal(r.again, false); assert.deepEqual(r.book.map((s) => s.b), [1, 2]);
  assert.equal(book.length, 1, 'a copy');
  const moved = keepPortalSpot(r.book, spot({ b: 1, w: 0.25 }));
  assert.equal(moved.again, true); assert.deepEqual(moved.book.map((s) => [s.b, s.w]), [[1, 0.25], [2, 1.5]]);
  const full = Array.from({ length: PORTAL_BOOK_MAX }, (_, i) => spot({ b: i }));
  assert.deepEqual(keepPortalSpot(full, spot({ b: 50 })), { refused: 'full' });
  assert.equal(keepPortalSpot(full, spot({ b: 3, w: 2 })).again, true, 'a full book still moves a house it keeps');
  assert.deepEqual(keepPortalSpot(book, spot({ k: 'cave' })), { refused: 'spot' });
  assert.deepEqual(forgetPortalSpot(r.book, 0).map((s) => s.b), [2]);
});

test('PORTAL-BOOK the house\'s spot: my home (online, or a deed\'s), my guild\'s hall, another guild\'s hall, a friend\'s home - and none for a building no player owns', () => {
  const base = { mapId: 1234, buildingKey: 99, town: 'Daggerfall', pixel: { x: 207, y: 213 }, at: onPixel(207, 213), yaw: 1 };
  const of = (home, deed = false) => portalSpotOf({ ...base, home, deed });
  assert.deepEqual([of({ own: true }).k, of({ own: true }).n], ['home', '']);
  assert.deepEqual([of(null, true).k, of(null, true).n], ['home', ''], 'a Daggerfall deed');
  const mine = of({ hall: { name: 'The Silver Hand' }, member: true }), theirs = of({ hall: { name: 'The Silver Hand' } }), friend = of({ owner: 'ExamplePlayer' });
  assert.deepEqual([mine.k, mine.n, portalSpotLabel(mine)], ['hall', '', "Your guild's hall in Daggerfall"]);
  assert.deepEqual([theirs.n, portalSpotLabel(theirs)], ['The Silver Hand', "The Silver Hand's hall in Daggerfall"]);
  assert.deepEqual([friend.k, friend.n, portalSpotLabel(friend)], ['friend', 'ExamplePlayer', "ExamplePlayer's home in Daggerfall"]);
  assert.equal(of(null, false), null, 'nobody\'s house');
  assert.equal(portalSpotLabel(of({ own: true })), 'Your home in Daggerfall');
  assert.equal(portalSpotOf({ ...base, home: { own: true }, at: onPixel(1, 1) }), null, 'a landing off the town\'s pixel');
});

test('PORTAL-BOOK the wire: a kept door rides the portal\'s record as `a`, on the destination\'s pixel or the record is refused whole; a stone\'s plain portal carries none; a peer\'s portal keeps it as its landing', () => {
  const a = onPixel(207, 213, 1234.567, 890.123);
  const gate = { id: 'k1', native: [10, 1, 20], dest: { pixel: { x: 207, y: 213 }, name: 'Daggerfall', at: a }, until: 20_000 };
  const w = portalWire(gate, 0);
  assert.deepEqual(w.a, [Math.round(a[0] * 100) / 100, Math.round(a[1] * 100) / 100, Math.round(a[2] * 100) / 100]);
  assert.deepEqual(validPortalRecord(w)?.a, w.a);
  assert.equal(validPortalRecord({ ...w, a: onPixel(9, 9) }), null, 'off its pixel');
  assert.equal(validPortalRecord({ ...w, a: [1, 2, 'x'] }), null);
  const plain = portalWire({ ...gate, dest: { pixel: { x: 207, y: 213 }, name: 'Daggerfall' } }, 0);
  assert.equal('a' in plain, false); assert.equal('a' in validPortalRecord(plain), false);
  let t = 0;
  const pool = createPortalGates({ now: () => t, destOf: (x, y) => ({ pixel: { x, y }, name: 'Daggerfall' }), eventGround: false });
  assert.ok(pool.applyOwner('peer', w, [10, 1, 20]));
  assert.deepEqual(pool.gates[0].dest.at, w.a, 'the peer\'s step lands at the door');
  assert.deepEqual(pool.destOf(1, 2), { pixel: { x: 1, y: 2 }, name: 'Daggerfall' }, 'the pool names a place as it names a destination');
});

/** A door at `centre` facing `normal`, under the identity matrix. */
const door = (centre, normal) => ({ matrix: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1], centre: { x: centre[0], y: centre[1], z: centre[2] }, normal: { x: normal[0], y: normal[1], z: normal[2] } });

test('PORTAL-BOOK the house read indoors: the landing outside the front door nearest the feet, facing out; a cabin, a caravan, a rented room, nobody\'s house or no doors keep none', () => {
  const siblings = [{ door: door([0, 1, 0], [0, 0, 1]) }, { door: door([50, 1, 0], [1, 0, 0]) }];
  const h = bookHouseOf({ own: true }, false, { buildingKey: 99 }, 1234, siblings, [1, 0, 3], false);
  assert.deepEqual(h.landing.map((v) => Math.round(v * 100) / 100), [0, 1, 1.05]);
  assert.equal(h.yaw, 0, 'facing out along the door\'s normal');
  assert.deepEqual([h.mapId, h.buildingKey], [1234, 99]);
  assert.equal(Math.round(bookHouseOf(null, true, { buildingKey: 1 }, 1, siblings, [49, 0, 0], false).yaw * 1000), Math.round(Math.PI / 2 * 1000), 'the nearest door');
  assert.equal(bookHouseOf({ own: true }, false, { buildingKey: 99 }, 1, siblings, [0, 0, 0], true), null, 'a cabin or a rented room');
  assert.equal(bookHouseOf(null, false, { buildingKey: 99 }, 1, siblings, [0, 0, 0], false), null, 'nobody\'s');
  assert.equal(bookHouseOf({ own: true }, false, { buildingKey: 99 }, 1, [], [0, 0, 0], false), null);
});

/** The window's host, faked: what it said, the window it stood, the portal it asked for. */
function rig({ mode = 'exterior', house = null, book = [], items = [portalStones(3)] } = {}) {
  const said = [], opened = [], windows = [];
  const playerEntity = { portalBook: book, items };
  let saves = 0;
  const host = createPortalBookHost({
    townTalk: { say: (l) => said.push(l), showOverlay: (w) => windows.push(w) }, playerEntity, mode: () => mode, house: () => house,
    pixel: () => ({ x: 207, y: 213 }), townName: () => 'Daggerfall', campToWire: (p) => onPixel(207, 213, p[0] + 100, p[2] + 100, p[1]),
    openToSpot: (s) => { opened.push(s); return true; }, saved: () => { saves += 1; },
  });
  return { host, said, opened, windows, playerEntity, saves: () => saves };
}
const codes = (w) => w.options.map((o) => o.code);

test('PORTAL-BOOK the window indoors: "keep this house" in a house, the spot written and the save owed; a kept spot is not opened indoors (the stone\'s door is outdoors); a building that is no house says where to keep one', () => {
  const house = bookHouseOf({ own: true }, false, { buildingKey: 99 }, 1234, [{ door: door([0, 1, 0], [0, 0, 1]) }], [0, 0, 2], false);
  const r = rig({ mode: 'interior', house });
  r.host.open();
  const w = r.windows.pop();
  assert.deepEqual(codes(w), ['KeyK', 'Escape']);
  assert.ok(w.lines.includes(PORTAL_BOOK_TEXT.empty())); assert.ok(w.lines.includes(PORTAL_BOOK_TEXT.stones(3)));
  w.input('KeyK');
  assert.equal(r.playerEntity.portalBook.length, 1);
  assert.equal(r.playerEntity.portalBook[0].k, 'home'); assert.equal(r.saves(), 1);
  assert.equal(r.said.pop(), 'Kept: Your home in Daggerfall.');
  r.host.open();
  const again = r.windows.pop();
  assert.deepEqual(codes(again), ['KeyK', 'Digit1', 'KeyF', 'Escape']);
  again.input('Digit1');
  assert.deepEqual(r.opened, [], 'no portal indoors');
  assert.equal(r.said.pop(), PORTAL_BOOK_TEXT.indoors());
  const shop = rig({ mode: 'interior', house: null });
  shop.host.open();
  const sw = shop.windows.pop();
  assert.deepEqual(codes(sw), ['Escape']); assert.ok(sw.lines.includes(PORTAL_BOOK_TEXT.noHouse()));
});

test('PORTAL-BOOK the window outdoors: each kept spot a key (1..9, then 0), pressed it asks the stone\'s door for that spot; a spot forgotten through F; no keep outdoors; the stones counted across stacks', () => {
  const book = Array.from({ length: 10 }, (_, i) => spot({ b: i, n: `Friend${i}` }));
  const r = rig({ book, items: [portalStones(2), portalStones(5)] });
  r.host.open();
  const w = r.windows.pop();
  assert.deepEqual(codes(w), ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7', 'Digit8', 'Digit9', 'Digit0', 'KeyF', 'Escape']);
  assert.ok(w.lines.includes(PORTAL_BOOK_TEXT.stones(7)));
  assert.equal(portalStonesIn([portalStones(2), mintPortalBook()]), 2);
  w.input('Digit0');
  assert.deepEqual(r.opened.map((s) => s.n), ['Friend9']);
  r.host.open();
  r.windows.pop().input('KeyF');
  const forget = r.windows.pop();
  assert.equal(forget.options.length, 11);
  forget.input('Digit2');
  assert.equal(r.playerEntity.portalBook.length, 9); assert.ok(!r.playerEntity.portalBook.some((s) => s.n === 'Friend1'));
  assert.equal(r.said.pop(), "Forgot: Friend1's home in Daggerfall.");
});

test('PORTAL-BOOK the wiring: the pack\'s portal door opens the book for a book and the stone\'s map for a stone; the stone\'s host opens a kept door with one stone through the stone\'s own pick and lands at the door; the interior host reads the house; the save and the kit give the book', () => {
  const world = src('src/scenes/world.js'), host = src('src/scenes/portalStoneHost.js'), modes = src('src/scenes/worldModes.js'), save = src('src/systems/save/save.js');
  assert.ok(world.includes('openPortal: (item, list) => (isPortalBook(item) ? portalBook.open() : openPortalStone(item, list)),'));
  assert.ok(world.includes('const portalBook = createPortalBookHost({'));
  assert.ok(host.includes('standPortal({ pixel: { x: spot.d[0], y: spot.d[1] }, name: spot.t, mapId: spot.m, at: spot.a, yaw: spot.w }, stone, () => playerEntity.items ?? []);'), 'the stone\'s own pick: its holds, place and spend');
  assert.ok(host.includes('else if (g.dest.at) landAtDoor(g.dest);'), 'the step lands at the door once the town stands');
  assert.ok(modes.includes('portalBookHere: () => bookHouseOf(interiorHome,'));
  assert.ok(save.includes('givePortalBookGift(entity);'));
  assert.ok(save.includes('snap.portalBook = readPortalBook(entity.portalBook);'));
  assert.ok(save.includes('entity.portalBook = readPortalBook(snap.portalBook);'));
});
