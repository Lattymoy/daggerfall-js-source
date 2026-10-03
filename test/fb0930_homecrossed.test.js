// HOME-CROSSED (2026-09-30, FIELD BUGS 2026-09-30 - Seanobi's "Sold House for 600 K, Got Nothing Back": "Tried selling
// my house for about 600 K and got 0 gold back. Got a strange message in my notes"; bible/01-Overview/
// Field-Bugs-2026-09-30.md). A home customs carried into the realm (CUSTOMS-CARRY) was never paid for by a realm record
// (`homes.paid` 0, migration 0020), so the service's sale paid its deed share of nothing - and deleted it, house and
// pieces - while the door asked "Sell your home for 600100 gold?" off the client's own price. The notes held the sale's
// "You sold your home. 0 gold went to this region's bank account." and a second press's "The account service had a
// problem. Try again." (the realm act still out: `busy`). The law is RESTORE's (Mac: "Keep all, can't sell"): what
// came through customs is never bought back online - it stays a house.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { standService } from './accountDb.mjs';
import { seatRealm } from './realmSeat.mjs';
import { homeSaleRefund } from '../src/net/homeLaw.js';
import { accountRefusalText, REFUSALS } from '../src/net/accountClient.js';
import { createOnlineHomes, sellOnlineHome, HOME_CROSSED_LINES, HOME_SALE_OUT } from '../src/systems/onlineHomes.js';
import { CROSSED_DEED_LINES } from '../src/systems/banking.js';

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

/** A house customs carried in: the realm character's row with nothing paid, and a piece in it no record paid for. */
function carriedIn(env, playerId, charId, mapId = 77, buildingKey = 9) {
  env.DB._raw.prepare("INSERT INTO homes (map_id, building_key, player, char_id, owner_name, region, entry, price, bought_at) VALUES (?, ?, ?, ?, 'Seanobi', 17, 'private', 600100, 1)")
    .run(mapId, buildingKey, playerId, charId);
  env.DB._raw.prepare(`INSERT INTO home_decor (map_id, building_key, id, model, place, placed_at) VALUES (?, ?, 'p1', 41000, '{"pos":[0,0,0],"rot":[0,0,0],"scale":1,"paid":400}', 1)`)
    .run(mapId, buildingKey);
}

test('HOME-CROSSED the service: a realm character\'s sale of a house customs carried in is refused, and the house and its pieces stand; one its record bought still sells for its deed share (mutants: the refusal gone; a bought house refused)', async () => {
  const s = await standService();
  const who = await s.registered('Seanobi');
  const R = await seatRealm(s.env, who.secret, 'Seanobi', { name: 'Seanobi', level: 9, goldPieces: 200_000, items: [], bankAccounts: new Array(62).fill(0).map(() => ({ accountGold: 0 })) });
  carriedIn(s.env, who.id, R.id);
  const sale = await s.call('/v1/homes/release', { mapId: 77, buildingKey: 9, realm: R.at(), layout: null }, who.secret);
  assert.deepEqual([sale.status, sale.body?.error], [409, 'home-crossed'], 'refused, and said why');
  assert.ok(s.env.DB._raw.prepare('SELECT 1 FROM homes WHERE map_id = 77 AND building_key = 9').get(), 'the house stands');
  assert.ok(s.env.DB._raw.prepare('SELECT 1 FROM home_decor WHERE map_id = 77 AND building_key = 9').get(), 'and its pieces');
  // a house the record bought pays back the deed share of what it paid
  const bought = await s.call('/v1/homes/claim', { mapId: 55, buildingKey: 3, region: 17, character: R.id, price: 100_000, realm: R.at(), layout: null }, who.secret);
  assert.equal(bought.status, 200);
  const sold = await s.call('/v1/homes/release', { mapId: 55, buildingKey: 3, realm: R.at(), layout: null }, who.secret);
  assert.deepEqual([sold.status, sold.body?.refund], [200, homeSaleRefund(100_000)]);
});

test('HOME-CROSSED the town\'s answer marks my own carried-in house `crossed` - never a bought one, never another account\'s - and the client keeps the mark (mutants: every house of mine crossed; the mark dropped by the client)', async () => {
  const s = await standService();
  const who = await s.registered('Seanobi');
  const other = await s.registered('Stranger');
  const R = await seatRealm(s.env, who.secret, 'Seanobi', { name: 'Seanobi', level: 9, goldPieces: 200_000, items: [], bankAccounts: new Array(62).fill(0).map(() => ({ accountGold: 0 })) });
  carriedIn(s.env, who.id, R.id, 77, 9);
  assert.equal((await s.call('/v1/homes/claim', { mapId: 77, buildingKey: 3, region: 17, character: R.id, price: 100_000, realm: R.at(), layout: null }, who.secret)).status, 200);
  const town = async (w) => (await s.call('/v1/homes/town', { mapId: 77 }, w.secret)).body.homes;
  const mine = await town(who);
  assert.deepEqual(mine.map((h) => [h.buildingKey, h.crossed === true]), [[3, false], [9, true]]);
  assert.ok((await town(other)).every((h) => !('crossed' in h)), 'another account learns nothing of what was paid');
  const homes = createOnlineHomes({ api: { town: async () => ({ ok: true, data: { homes: mine } }) }, character: () => R.id });
  await homes.ensure(77);
  assert.deepEqual([homes.homeAt(77, 9).crossed, homes.homeAt(77, 3).crossed], [true, false]);
});

test('HOME-CROSSED the words: the refusal is RESTORE\'s own for a deed, and a realm act still out is said as one, never "the account service had a problem" (mutants: the refusal unsaid; busy unsaid)', () => {
  assert.deepEqual(HOME_CROSSED_LINES, [...CROSSED_DEED_LINES, 'It stays your home.']);
  assert.equal(accountRefusalText('home-crossed'), HOME_CROSSED_LINES.join(' '));
  assert.notEqual(accountRefusalText('busy'), REFUSALS.server);
  assert.match(accountRefusalText('busy'), /still being settled/);
});

test('HOME-CROSSED the door: a carried-in home\'s Sell says the bank\'s refusal and asks nothing - no price the service would never pay; a second press while a sale is out says nothing of its own (mutants: the price asked of a crossed home; the second press said)', () => {
  const w = src('src/scenes/worldModes.js');
  const at = w.indexOf('function openHomeSale(bd)');
  const body = w.slice(at, w.indexOf('\n  }\n', at));
  assert.match(body, /const home = homeOf\(bd\);\n\s*if \(home\?\.crossed && host\.realmAct\) \{ townTalk\?\.showOverlay\?\.\(new ChoiceWindow\(\{ lines: HOME_CROSSED_LINES, options: \[\{ code: 'Escape', label: 'Esc - close', action: \(\) => \{\} \}\] \}\)\); return; \}/);
  assert.ok(body.indexOf('HOME_CROSSED_LINES') < body.indexOf('homeSaleLines('), 'refused before any price is asked');
  assert.match(w, /if \(r\.error === HOME_SALE_OUT\) return;[^\n]*\n\s*if \(!r\.ok\) \{ townTalk\?\.say\?\.\(accountRefusalText\(r\.error\)\); return; \}/, 'a second press says nothing of its own');
});

test('HOME-CROSSED one sale a house at a time: a second while the first is out answers `sale-out` and asks the service nothing; once the first answers, the house may be asked again (mutants: the guard gone; the guard never let go)', async () => {
  let asked = 0;
  /** @type {(v: any) => void} */
  let answer = () => {};
  const homes = { release: () => { asked++; return new Promise((r) => { answer = r; }); } };
  const act = async (/** @type {any} */ o) => { const r = await o.call({ id: 'r' + 'a'.repeat(20), lease: 'l', seq: 1 }); if (r.ok) o.apply(r.data ?? r); return r; };
  const credited = [];
  const first = sellOnlineHome(homes, { mapId: 77, buildingKey: 3, credit: (n) => credited.push(n), realm: { act } });
  const second = await sellOnlineHome(homes, { mapId: 77, buildingKey: 3, credit: (n) => credited.push(n), realm: { act } });
  assert.deepEqual([second.ok, second.error, asked], [false, HOME_SALE_OUT, 1]);
  answer({ ok: true, data: { refund: 85_000, decorBack: 0 } });
  assert.deepEqual(await first, { ok: true, refund: 85_000, decorBack: 0 });
  assert.deepEqual(credited, [85_000]);
  const third = sellOnlineHome(homes, { mapId: 77, buildingKey: 3, credit: () => {}, realm: { act } });
  assert.equal(asked, 2, 'let go once answered');
  answer({ ok: false, error: 'no-home' });
  assert.equal((await third).error, 'no-home');
});
