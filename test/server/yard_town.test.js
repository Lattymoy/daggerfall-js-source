// YARD-TOWN (2026-10-25, players: "Decorative items placed in any house yard in that area disappear after restarting the
// game, even when the Saved to the Realm notification pops up") - A TOWN'S YARDS ARE BOUND AT THE PLACEMENT, NOT CUT AT
// THE READ. Through the real Worker: a yard piece past DECOR_YARDS_TOWN_MAX in its town is refused, in its own word
// (`yard-town-full`), whichever way it is paid; another town's pieces never count, a room's piece is never refused for
// it, and one taken away makes room again. Over the real build: a town at the bound, every row as wide as Daggerfall's
// widest, is kept in its built row (keptBoard.js KEPT_BOARD_MAX_BYTES), so the bound is never one the read walks.
// `06-Systems/Online-Arc.md` YARD-TOWN.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { d1, standService, T0 } from '../accountDb.mjs';
import { settleYards, yardRowsOf } from '../../server-account/src/decor.js';
import { DECOR_YARDS_TOWN_MAX } from '../../src/net/decorLaw.js';
import { accountRefusalText } from '../../src/net/accountClient.js';

const piece = (over = {}) => ({ id: 'yard1', model: 41000, flat: null, pos: [8, 0, 2], rot: [0, 0, 0], scale: 1, light: null, storage: false, paid: 120, ...over });
const PLACE = JSON.stringify({ pos: [8, 0, 2], rot: [0, 0, 0], scale: 1, light: null, storage: false, paid: 0 });

test('YARD-TOWN a yard piece past DECOR_YARDS_TOWN_MAX in its town is refused as `yard-town-full`, paid on the record or free; another town\'s pieces never count, a room\'s piece is never refused for it, one taken away makes room; the client says the bound (mutants: the town unasked; every town counted; the room counted; the word lost on either path)', async (t) => {
  t.mock.method(Date, 'now', () => T0 * 1000);
  const svc = await standService();
  const raw = svc.env.DB._raw;
  const owner = await svc.registered('Olga');
  const o = await svc.seatHome(owner, { mapId: 7, buildingKey: 300, region: 17, price: 5000 });
  const at = () => ({ id: o.character, ...raw.prepare('SELECT lease, seq FROM realm_characters WHERE id = ?').get(o.character) });
  const place = (body) => svc.call('/v1/homes/decor/place', { mapId: 7, buildingKey: 300, character: o.character, realm: at(), ...body }, owner.secret);
  // the town's other yards: a neighbour's home (301) holding all but one of the town's pieces, and a home in another town
  const copyHome = raw.prepare('INSERT INTO homes (map_id, building_key, player, char_id, owner_name, region, price, bought_at) SELECT ?, ?, player, char_id, owner_name, region, price, bought_at FROM homes WHERE map_id = 7 AND building_key = 300');
  copyHome.run(7, 301);
  copyHome.run(8, 300);
  const fill = raw.prepare('INSERT INTO home_decor (map_id, building_key, id, model, place, placed_at, paid, yard) VALUES (?, ?, ?, 41000, ?, ?, 0, 1)');
  for (let i = 0; i < DECOR_YARDS_TOWN_MAX - 1; i++) fill.run(7, 301, `n${i}`, PLACE, T0);
  for (let i = 0; i < 50; i++) fill.run(8, 300, `m${i}`, PLACE, T0);
  const last = await place({ piece: piece({ id: 'last' }), yard: true });
  assert.equal(last.status, 200, `the town's last piece: ${JSON.stringify(last.body)}`);
  assert.equal(raw.prepare('SELECT COUNT(*) AS n FROM home_decor WHERE map_id = 7 AND yard = 1').get().n, DECOR_YARDS_TOWN_MAX);
  const paid = await place({ piece: piece({ id: 'over' }), yard: true });
  assert.equal(paid.body.error, 'yard-town-full', 'past the town, paid on the record');
  const free = await place({ piece: piece({ id: 'free', paid: 0 }), yard: true });
  assert.equal(free.body.error, 'yard-town-full', 'past the town, a free piece');
  assert.equal(raw.prepare("SELECT COUNT(*) AS n FROM home_decor WHERE id IN ('over', 'free')").get().n, 0, 'nothing written past it');
  const room = await place({ piece: piece({ id: 'room1' }) });
  assert.equal(room.status, 200, 'a room\'s piece is never the town\'s yards\'');
  raw.prepare("DELETE FROM home_decor WHERE map_id = 7 AND building_key = 301 AND id = 'n0'").run();
  const again = await place({ piece: piece({ id: 'again' }), yard: true });
  assert.equal(again.status, 200, 'one taken away makes room');
  assert.match(accountRefusalText('yard-town-full'), new RegExp(`\\b${DECOR_YARDS_TOWN_MAX}\\b`), 'the client names the bound');
});

test('YARD-TOWN a town at DECOR_YARDS_TOWN_MAX, every row as wide as Daggerfall\'s widest, is kept in its built row - never past KEPT_BOARD_MAX_BYTES and read every time (mutant: the bound past what a built row keeps)', async () => {
  const db = d1();
  const raw = db._raw;
  raw.prepare('INSERT INTO players (id, guest_name, created_at, last_seen) VALUES (?, ?, 0, 0)').run('p-owner', 'owner');
  // a building key as long as any (block 7,7, record 255) and the widest place a yard's law takes
  const bk = (7 << 16) + (7 << 8) + 255;
  raw.prepare("INSERT INTO homes (map_id, building_key, player, char_id, owner_name, region, price, bought_at) VALUES (7, ?, 'p-owner', 'c', 'Owner', 17, 1, 1)").run(bk);
  const wide = JSON.stringify({ pos: [-47.125, 3.875, -47.125], rot: [-179.9, -89.9, -179.9], scale: 3.875, light: null, storage: false, paid: 400 });
  const put = raw.prepare('INSERT INTO home_decor (map_id, building_key, id, model, place, placed_at, paid, yard) VALUES (7, ?, ?, 999999, ?, 1792926824, 400, 1)');
  for (let i = 0; i < DECOR_YARDS_TOWN_MAX; i++) put.run(bk, String(i).padStart(24, 'w'), wide);
  await settleYards(db, 7);
  const row = raw.prepare('SELECT rows FROM home_yards WHERE map_id = 7').get();
  assert.notEqual(row?.rows, null, 'the town kept in its built row');
  const rows = yardRowsOf(row.rows);
  assert.equal(rows.length, DECOR_YARDS_TOWN_MAX);
  // Daggerfall's widest live row is 187 bytes in the built row (2026-10-25): the fixture's are no narrower
  assert.ok(Buffer.byteLength(JSON.stringify(Object.values(rows[0]))) >= 187, 'as wide as the widest real row');
});
