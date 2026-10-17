import { test } from 'node:test';
import assert from 'node:assert/strict';
import { standService, T0 } from '../../accountDb.mjs';
import { generateRandomLoot, LOOT_MATRICES, validLootList } from '../../../src/systems/loot/loot.js';
import { seededRng } from '../../../src/systems/wind/wind.js';
import { goodRefusal, goodFamily, GOOD_GROUP_FAMILIES, GOODS_FAMILIES, MARKET_SHOWN } from '../../../src/net/marketLaw.js';
test('Goods family filtering precedes bounded selection across 501 valid listings', async () => {
  const realNow = Date.now;
  Date.now = () => T0 * 1000;
  try {
    const service = await standService({ PROFESSIONS_OPEN: 'on', MARKS_OPEN: 'on', BOARD_OPEN: 'on' });
    const buyer = await service.registered('Buyer');
    const db = service.env.DB._raw;
    const loot = generateRandomLoot({ ...LOOT_MATRICES['-'], MinGold: 5, MaxGold: 5, WP: 100, AM: 100 }, { level: 10, gender: 'male' }, seededRng(11));
    const weapon = validLootList([loot.find((i) => i.group === 'Weapons' && i.templateIndex !== 18)])[0];
    const armour = validLootList([loot.find((i) => i.group === 'Armor')])[0];
    assert.equal(goodRefusal(weapon), null); assert.equal(goodRefusal(armour), null);
    assert.equal(goodFamily(weapon), 'weapons'); assert.equal(goodFamily(armour), 'armour');
    // Isolated in-memory fixture database. Keep every seller within the normal30-listing cap.
    for (let i = 0; i < 17; i++) db.prepare('INSERT INTO players (id, handle, handle_lc, guest_name, created_at, last_seen) VALUES (?, ?, ?, ?, ?, ?)')
      .run(`fixture-seller-${i}`, `Seller${i}`, `seller${i}`, 'Fixture Seller', T0 - 10000, T0);
    const insert = db.prepare(`INSERT INTO market_listings (id, seller, char_id, region, kind, units, price, fee, at, expires_at, rid, n, currency, item)
      VALUES (?, ?, ?, 17, 'item', 1, ?, 1, ?, ?, ?, '', 'gold', ?)`);
    for (let i = 0; i < 501; i++) {
      const seller = `fixture-seller-${Math.floor(i / 30)}`;
      insert.run(`listing-${i}`, seller, `char-${seller}`, i === 500 ? 100 : 1, T0, T0 + 86400, `request-${i}`, JSON.stringify(i === 500 ? armour : weapon));
    }
    assert.equal(db.prepare("SELECT COUNT(*) AS n FROM market_listings WHERE state='open' AND json_extract(item,'$.group')='Armor'").get().n, 1);
    const read = (extra = {}) => service.call('/v1/market/read', { character: buyer.character, region: 17, view: 'goods', family: 'armour', hubs: { 17: [207,212] }, ...extra }, buyer.secret);
    const result = await read();
    assert.equal(result.status, 200);
    assert.deepEqual(result.body.rows.map(r => r.id), ['listing-500'], 'expensive armour remains visible behind 500 cheaper weapons');
    assert.equal(result.body.rows[0].currency, 'gold');
    assert.ok(result.body.rows[0].road, 'courier quote remains attached');
    const all = await read({ family: null });
    assert.equal(all.body.rows.length, MARKET_SHOWN, 'unfiltered response remains bounded');
    assert.ok(all.body.rows.every(r => r.item.group === 'Weapons' && r.price === 1));
    const weapons = await read({ family: 'weapons' });
    assert.equal(weapons.body.rows.length, MARKET_SHOWN);
    // Closed/expired listings and malformed saved JSON must never replace the valid matching item.
    insert.run('expired', 'fixture-seller-16', 'char-fixture-seller-16', 1, T0 - 100, T0 - 1, 'expired-rid', JSON.stringify(armour));
    insert.run('closed', 'fixture-seller-16', 'char-fixture-seller-16', 1, T0 - 2, T0 + 86400, 'closed-rid', JSON.stringify(armour));
    db.prepare("UPDATE market_listings SET state='cancelled' WHERE id='closed'").run();
    insert.run('malformed', 'fixture-seller-16', 'char-fixture-seller-16', 1, T0 - 2, T0 + 86400, 'bad-rid', '{bad');
    assert.deepEqual((await read()).body.rows.map(r => r.id), ['listing-500']);
    assert.deepEqual((await read({ family: "armour' OR 1=1 --" })).body.rows, [], 'family is data, not SQL');
    for (const family of [{}, [], ['armour'], true, 42, 'unknown']) {
      const invalid = await read({ family });
      assert.equal(invalid.status, 200);
      assert.deepEqual(invalid.body.rows, [], 'unsupported family returns no rows without throwing');
    }
    for (const family of [null, false, 0, '']) {
      const unfiltered = await read({ family });
      assert.equal(unfiltered.status, 200);
      assert.ok(unfiltered.body.rows.length <= MARKET_SHOWN);
    }
    // The very same validated record at a lower price controls the sort path, then retires.
    db.prepare('UPDATE market_listings SET price=1, at=? WHERE id=?').run(T0 - 1, 'listing-500');
    assert.equal((await read({family:null})).body.rows[0].id, 'listing-500');
    db.prepare("UPDATE market_listings SET state='cancelled' WHERE id='listing-500'").run();
    // Exercise each group through the actual service and compare its family with the shared client law.
    // These classifier fixtures need only the persisted record shape; valid listing admission is covered above.
    for (const [group, family] of [...GOOD_GROUP_FAMILIES, ['Books','other'], ['constructor','other']]) {
      db.prepare("UPDATE market_listings SET state='open',item=? WHERE id='listing-500'").run(JSON.stringify({...armour,group}));
      assert.equal(goodFamily({group}),family);
      for (const [requested] of GOODS_FAMILIES) {
        const rows=(await read({family:requested})).body.rows;
        assert.equal(rows.some(r=>r.id==='listing-500'),requested===family,`${group} in ${requested}`);
      }
    }
  } finally { Date.now = realNow; }
});
