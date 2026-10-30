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
  HOME_LISTINGS, homeListingProblems, homeListingsOf, homeListingOf, homeListedOff, homeListedPrice, homeListings, setHomeListings, homeListingsUnplaced,
} from '../../src/net/homeListingLaw.js';
import { homePurchasable } from '../../src/systems/online/onlineHomes.js';
import { BUILDING_TYPES } from '../../src/world/buildingNames.js';
import { HOME_PRICE_MAX } from '../../src/net/homeLaw.js';
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
  assert.deepEqual([homeListedPrice(77, key(2, 3, 4), 9_000, ROWS), homeListedPrice(77, key(1, 1, 1), 9_000, ROWS)], [42_000, 9_000]);
  assert.equal(homeListedOff(78, key(2, 3, 9), ROWS), false, 'another town\'s cell');
});

test('F3 the game\'s file: every row it holds is a good one, and both ends read it', () => {
  const raw = JSON.parse(readFileSync(new URL('../../src/net/homeListings.json', import.meta.url), 'utf8'));
  assert.equal(raw.version, 1);
  assert.equal(HOME_LISTINGS.length, raw.listings.length, 'no row of the game\'s is dropped');
  assert.equal(homeListings(), HOME_LISTINGS);
  const src = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
  assert.match(src('server-account/src/homes.js'), /if \(homeListedOff\(mapId, buildingKey\)\) return \{ error: 'home-unlisted' \};\n\s*if \(homeListedPrice\(mapId, buildingKey, price\) !== price\) return \{ error: 'home-update' \};/);
  assert.match(src('server-account/src/halls.js'), /if \(homeListedOff\(mapId, buildingKey\)\) return \{ error: 'home-unlisted' \};/);
  assert.match(src('src/scenes/worldModes.js'), /return homePriceOk\(price\) \? homeListedPrice\(homeTownOf\(bd\), bd\?\.buildingKey, price\) : 0;/);
});

test('F3 the door: a house its row takes off the market is not for sale; one beside it is (mutant: the row unasked)', () => {
  setHomeListings(ROWS);
  try {
    const house = (k) => ({ buildingKey: k, buildingType: BUILDING_TYPES.HouseForSale, townMapId: 77 });
    assert.deepEqual([homePurchasable(house(key(2, 3, 9))), homePurchasable(house(key(2, 2, 9)))], [false, true]);
  } finally { setHomeListings(); }
  assert.equal(accountRefusalText('home-unlisted'), 'That house is not for sale.');
});

test('F3 the service: a claim of a house off the market is refused and nothing is paid; a curated house at its row\'s price lands, at the law\'s refused (mutants: the row unread, the price unheld)', async () => {
  setHomeListings(ROWS);
  try {
    const s = await standService();
    const who = await s.registered('Aldric');
    const R = await seatRealm(s.env, who.secret, 'Aldric', { name: 'Aldric', level: 9, goldPieces: 2_000_000, items: [], bankAccounts: new Array(62).fill(0).map(() => ({ accountGold: 0 })) });
    const claim = (buildingKey, price) => s.call('/v1/homes/claim', { mapId: 77, buildingKey, region: 17, character: R.id, price, realm: R.at(), layout: null }, who.secret);
    assert.equal((await claim(key(2, 3, 9), 20_000)).body?.error, 'home-unlisted');
    assert.equal((await claim(key(2, 3, 4), HOME_PRICE_MAX)).body?.error, 'home-update', 'not its row\'s price');
    assert.equal((await claim(key(2, 3, 4), 42_000)).status, 200);
    assert.equal(s.env.DB._raw.prepare('SELECT price FROM homes WHERE building_key = ?').get(key(2, 3, 4))?.price, 42_000);
  } finally { setHomeListings(); }
});

test('F3 the atlas says which rows name nothing - a town no place is, a cell past its grid (mutants: the grid unread)', () => {
  const bundles = new Map([[77, { exterior: { w: 3, h: 4 } }], [SKYRIM_TOWN, { exterior: { w: 1, h: 1 } }]]);
  const rows = homeListingsOf({ listings: [...ROWS, { map: 99, cell: [0, 0], sale: false }, { map: SKYRIM_TOWN, cell: [1, 0], sale: false }] });
  assert.deepEqual(homeListingsUnplaced(rows, (m) => bundles.get(m) ?? null).map((u) => [u.row.map, u.why]), [[99, 'no such town'], [SKYRIM_TOWN, 'no such cell']]);
});

const ARENA2 = process.env.ARENA2_PATH;
const skipReal = !ARENA2 || !existsSync(join(ARENA2 ?? '', 'MAPS.BSA')) ? 'ARENA2_PATH not set or missing - real-data validation skipped' : false;

test('F3 with ARENA2: the game\'s rows against the world\'s atlas name only real towns and cells - and Daggerfall\'s corner cell stands where a hamlet\'s does not (mutant: the grid unread)', { skip: skipReal }, async () => {
  const { loadWorldAtlas } = await import('../../tools/atlasMeasure.mjs');
  const { atlas } = await loadWorldAtlas(/** @type {string} */ (ARENA2));
  assert.deepEqual(homeListingsUnplaced(HOME_LISTINGS, (m) => atlas.place(m)), []);
  const hamlet = atlas.bundles().find((b) => b.exterior && b.exterior.w === 1 && b.exterior.h === 1);
  const rows = homeListingsOf({ listings: [{ map: 1291010263, cell: [7, 7], sale: false }, { map: hamlet?.id, cell: [1, 1], sale: false }] });
  assert.deepEqual(homeListingsUnplaced(rows, (m) => atlas.place(m)).map((u) => u.why), ['no such cell']);
});
