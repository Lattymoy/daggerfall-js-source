// FOUNDATION F3 (bible/03-World/Foundation-Arc.md): PROPERTY AS DATA (net/homeListingLaw.js, src/net/homeListings.json) -
// a row takes a building or a cell of a town off the market, or sets its price; the client's door and the account
// service read the same rows, and the world's atlas says which rows name nothing. A town past the Bay beside the Bay's.
// Pins mutation-checked (tools/mutants/foundation.json).
import '../chargenDom.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  HOME_LISTINGS, homeListingProblems, homeListingsOf, homeListingOf, homeListedOff, homeListedPrice, homeListings, setHomeListings, homeListingsUnplaced, homeKeyCell, homeGroundPrice,
} from '../../src/net/homeListingLaw.js';
import { makeBuildingKey, BUILDING_KEY_0 } from '../../src/systems/talk/talkTopics.js';
import { arenaHomeFor } from '../../src/systems/arena/arenaMove.js';
import { homePurchasable } from '../../src/systems/online/onlineHomes.js';
import { BUILDING_TYPES } from '../../src/world/buildingNames.js';
import { HOME_PRICE_MAX, HOME_ARENA_MAP_ID, homeOnlinePrice, homeGroundOk } from '../../src/net/homeLaw.js';
import { accountRefusalText } from '../../src/net/accountClient.js';
import { standService } from '../accountDb.mjs';
import { seatRealm } from '../realmSeat.mjs';

const key = (bx, by, rec) => (bx << 16) + (by << 8) + rec;   // talkTopics.js makeBuildingKey
const SKYRIM_TOWN = 873988097;   // Solitude's map id (world/tamrielCapitals.js), a place past the Bay
const ROWS = homeListingsOf({ listings: [
  { map: 77, cell: [2, 3], sale: false, note: 'a landmark cell' },
  { map: 77, key: key(2, 3, 4), price: 42_000, note: 'one house of it, curated' },
  { map: SKYRIM_TOWN, key: key(0, 0, 1), sale: false },
  { map: 77, key: 5, cell: [0, 0], sale: false },   // both: dropped
  { map: 77, key: 6 },   // says nothing: dropped
  { map: 77, key: 7, price: 123 },   // off the law's hundreds: dropped
] });

test('F3 the law: a row names a town and one building or one cell, and says it is off the market or what it costs - a bad row is dropped; a building\'s own row before its cell\'s; past the Bay as on it (mutants: a bad row kept, the cell unread, the key\'s row second)', () => {
  assert.deepEqual(ROWS.map((r) => r.map), [77, 77, SKYRIM_TOWN]);
  assert.deepEqual(homeListingProblems({ map: 77, key: 5, cell: [0, 0], sale: false }), ['key-or-cell']);
  assert.deepEqual(homeListingProblems({ map: 0, cell: [8, 0], sale: true }), ['map', 'cell', 'sale-false']);
  assert.equal(homeListingOf(77, key(2, 3, 9), ROWS)?.note, 'a landmark cell');
  assert.equal(homeListingOf(77, key(2, 3, 4), ROWS)?.price, 42_000, 'its own row first');
  assert.deepEqual([homeListedOff(77, key(2, 3, 9), ROWS), homeListedOff(77, key(2, 2, 9), ROWS), homeListedOff(SKYRIM_TOWN, key(0, 0, 1), ROWS)], [true, false, true]);
  // AUDIT FOUNDATION P1: block 0,0's record 0 is spelt 1 << 24 (talkTopics.js BUILDING_KEY_0) - its cell is 0,0
  const corner = homeListingsOf({ listings: [{ map: 77, cell: [0, 0], sale: false }] });
  assert.deepEqual([homeKeyCell(BUILDING_KEY_0), homeListedOff(77, makeBuildingKey(0, 0, 0), corner), homeListedOff(77, makeBuildingKey(0, 0, 1), corner)], [[0, 0], true, true]);
  assert.deepEqual([homeListedPrice(77, key(2, 3, 4), 9_000, ROWS), homeListedPrice(77, key(1, 1, 1), 9_000, ROWS)], [42_000, 9_000]);
  assert.equal(homeListedOff(78, key(2, 3, 9), ROWS), false, 'another town\'s cell');
  // AUDIT FOUNDATION II P6: a key row names its building in Daggerfall's own layout alone - in a town a pack lays out
  // anew the key is another building; a cell row stands in every layout
  const BV = 'beautiful-villages@1.4.2';
  assert.deepEqual([homeListedOff(SKYRIM_TOWN, key(0, 0, 1), ROWS, BV), homeListedPrice(77, key(1, 1, 1), 9_000, homeListingsOf({ listings: [{ map: 77, key: key(1, 1, 1), price: 42_000 }] }), BV)], [false, 9_000]);
  assert.deepEqual([homeListedOff(77, key(2, 3, 4), ROWS, BV), homeListedOff(77, key(2, 3, 4), ROWS, 'beautiful-cities@1.0.0+beautiful-villages@1.4.2')], [true, true], 'the cell\'s row read in any layout');
  assert.equal(homeListedOff(SKYRIM_TOWN, key(0, 0, 1), ROWS, null), true, 'Daggerfall\'s own');
});

test('F3 the game\'s file: every row it holds is a good one, and both ends read it', () => {
  const raw = JSON.parse(readFileSync(new URL('../../src/net/homeListings.json', import.meta.url), 'utf8'));
  assert.equal(raw.version, 1);
  assert.equal(HOME_LISTINGS.length, raw.listings.length, 'no row of the game\'s is dropped');
  assert.equal(homeListings(), HOME_LISTINGS);
  const src = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
  // PIN MOVED (AUDIT FOUNDATION II P6): each read in the town's layout - the claim's, the hall's, the door's
  assert.match(src('server-account/src/homes.js'), /if \(homeListedOff\(mapId, buildingKey, undefined, layout\)\) return \{ error: 'home-unlisted' \};\n\s*if \(homeListedPrice\(mapId, buildingKey, price, undefined, layout\) !== price\) return \{ error: 'home-update' \};/);
  assert.match(src('server-account/src/halls.js'), /if \(homeListedOff\(mapId, buildingKey, undefined, layout\)\) return \{ error: 'home-unlisted' \};[^\n]*\n\s*if \(homeListedPrice\(mapId, buildingKey, price, undefined, layout\) !== price\) return \{ error: 'home-update' \};/);
  assert.match(src('src/scenes/worldModes.js'), /return homePriceOk\(price\) \? homeListedPrice\(homeTownOf\(bd\), bd\?\.buildingKey, price, undefined, homeClaimLayout\(homeTownOf\(bd\)\)\) : 0;/);
  assert.match(src('src/systems/online/onlineHomes.js'), /=>\n\s*!homeListedOff\(mapId, bd\?\.buildingKey, undefined, homeClaimLayout\(mapId\)\) &&/);
  assert.match(src('src/systems/arena/arenaMove.js'), /!homeListedOff\(o\?\.mapId, s\.buildingKey, undefined, homeClaimLayout\(o\?\.mapId\)\),\n\s*\),\n\s*opts,\n\s*\);/);
  assert.match(src('server-account/src/decorAccess.js'), /homeGroundPrice\(mapId, buildingKey, Number\(home\.price\), ground, townBlocks, home\.layout \?\? null\)/);
});

test('F3 the door: a house its row takes off the market is not for sale; one beside it is (mutant: the row unasked)', () => {
  setHomeListings(ROWS);
  try {
    const house = (k) => ({ buildingKey: k, buildingType: BUILDING_TYPES.HouseForSale, townMapId: 77 });
    assert.deepEqual([homePurchasable(house(key(2, 3, 9))), homePurchasable(house(key(2, 2, 9)))], [false, true]);
  } finally { setHomeListings(); }
  assert.equal(accountRefusalText('home-unlisted'), 'That house is not for sale.');
});

test('F3 a home the arena displaced moves only to a house on the market - the owner\'s pick and the service alike (AUDIT FOUNDATION P3; mutant: the pick unasked)', () => {
  const house = (k) => ({ buildingKey: k, buildingType: BUILDING_TYPES.HouseForSale, hasInterior: true });
  const o = { mapId: HOME_ARENA_MAP_ID, oldKey: key(4, 3, 2), oldType: BUILDING_TYPES.HouseForSale };
  setHomeListings(homeListingsOf({ listings: [{ map: HOME_ARENA_MAP_ID, cell: [1, 1], sale: false }] }));
  try {
    for (let i = 0; i < 6; i++) assert.equal(arenaHomeFor({ ...o, oldKey: o.oldKey + i }, [house(key(1, 1, 1)), house(key(2, 2, 1))])?.buildingKey, key(2, 2, 1));
  } finally { setHomeListings(); }
  assert.match(readFileSync(new URL('../../server-account/src/homes.js', import.meta.url), 'utf8'), /if \(homeListedOff\(mapId, to, undefined, home\.layout \?\? null\)\) return \{ error: 'home-unlisted' \};/);   // PIN MOVED (AUDIT FOUNDATION II P6): in the town's layout
});

test('F3 the service: a claim of a house off the market is refused before anything is read; a curated house at its row\'s price lands with the ground its price covers, at the law\'s refused, and a ground the price does not cover is not kept (AUDIT FOUNDATION II P5; mutants: the row unread, the price unheld, the ground held to the row, the ground uncovered)', async () => {
  setHomeListings(ROWS);
  try {
    const s = await standService();
    const who = await s.registered('Aldric');
    const R = await seatRealm(s.env, who.secret, 'Aldric', { name: 'Aldric', level: 9, goldPieces: 2_000_000, items: [], bankAccounts: new Array(62).fill(0).map(() => ({ accountGold: 0 })) });
    const claim = (buildingKey, price) => s.call('/v1/homes/claim', { mapId: 77, buildingKey, region: 17, character: R.id, price, realm: R.at(), layout: null }, who.secret);
    assert.equal((await claim(key(2, 3, 9), 20_000)).body?.error, 'home-unlisted');
    assert.equal((await claim(key(2, 3, 4), HOME_PRICE_MAX)).body?.error, 'home-update', 'not its row\'s price');
    const ok = await s.call('/v1/homes/claim', { mapId: 77, buildingKey: key(2, 3, 4), region: 17, character: R.id, price: 42_000, realm: R.at(), layout: null, ground: 40, townBlocks: 9 }, who.secret);
    assert.equal(ok.status, 200);
    // AUDIT FOUNDATION P2: a curated price keeps the ground its law's price would (the decor's room) - the ground held to
    // the law, the price to the row; AUDIT FOUNDATION II P5: while the price paid covers it, never more room than bought
    assert.deepEqual({ ...s.env.DB._raw.prepare('SELECT price, ground FROM homes WHERE building_key = ?').get(key(2, 3, 4)) }, { price: 42_000, ground: 40 });
    assert.equal(homeGroundPrice(77, key(2, 3, 4), 42_000, 40, 9), homeOnlinePrice(40, 9));
    assert.ok(homeOnlinePrice(2000, 64) > 42_000 && !homeGroundOk(2000, 64, homeGroundPrice(77, key(2, 3, 4), 42_000, 2000, 64)), 'the largest ground on a 42,000 house: not kept');
    assert.equal(homeGroundPrice(77, key(1, 1, 1), 9_000, 140, 9), 9_000, 'no row: the price paid');
  } finally { setHomeListings(); }
});

test('F3 the atlas says which rows name nothing - a town no place is, a cell past its grid (mutants: the grid unread)', () => {
  const bundles = new Map([[77, { exterior: { w: 3, h: 4 } }], [SKYRIM_TOWN, { exterior: { w: 1, h: 1 } }]]);
  const rows = homeListingsOf({ listings: [...ROWS, { map: 99, cell: [0, 0], sale: false }, { map: SKYRIM_TOWN, cell: [1, 0], sale: false }] });
  assert.deepEqual(homeListingsUnplaced(rows, (m) => bundles.get(m) ?? null).map((u) => [u.row.map, u.why]), [[99, 'no such town'], [SKYRIM_TOWN, 'no such cell']]);
});

const ARENA2 = process.env.ARENA2_PATH;
const skipReal = !ARENA2 || !existsSync(join(ARENA2 ?? '', 'MAPS.BSA')) ? 'ARENA2_PATH not set or missing - real-data validation skipped' : false;

test('F3 with ARENA2: the game\'s rows against the world\'s atlas name only real towns and cells - Daggerfall\'s corner cell and Solitude\'s stand where a hamlet\'s does not (AUDIT FOUNDATION II P7: the served world\'s atlas, its places past the Bay listed, so a row there is a town; mutant: the grid unread)', { skip: skipReal }, async () => {
  const { loadWorldAtlas } = await import('../../tools/atlasMeasure.mjs');
  const { atlas } = await loadWorldAtlas(/** @type {string} */ (ARENA2), { served: true });
  assert.deepEqual(homeListingsUnplaced(HOME_LISTINGS, (m) => atlas.place(m)), []);
  const hamlet = atlas.bundles().find((b) => b.exterior && b.exterior.w === 1 && b.exterior.h === 1 && b.place.theatre === 0);
  const rows = homeListingsOf({ listings: [{ map: 1291010263, cell: [7, 7], sale: false }, { map: SKYRIM_TOWN, cell: [7, 7], sale: false }, { map: hamlet?.id, cell: [1, 1], sale: false }] });
  assert.deepEqual(homeListingsUnplaced(rows, (m) => atlas.place(m)).map((u) => [u.row.map, u.why]), [[hamlet?.id, 'no such cell']]);
});
