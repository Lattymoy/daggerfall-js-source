import { test } from 'node:test';
import assert from 'node:assert/strict';
import { standService, T0 } from '../accountDb.mjs';
import { recipeById, RECIPES } from '../../src/net/recipeLaw.js';
import { MARKET_SHOWN, CRAFTED_FAMILIES } from '../../src/net/marketLaw.js';

async function checkView(view) {
  const realNow = Date.now;
  Date.now = () => T0 * 1000;
  try {
    const s = await standService({ PROFESSIONS_OPEN: 'on', MARKS_OPEN: 'on', BOARD_OPEN: 'on' });
    const buyer = await s.registered('Buyer'), db = s.env.DB._raw;
    for (let i = 0; i < 17; i++) db.prepare('INSERT INTO players(id,handle,handle_lc,guest_name,created_at,last_seen) VALUES(?,?,?,?,?,?)')
      .run(`s${i}`, `Seller${i}`, `seller${i}`, 'Fixture', T0, T0);
    const product = db.prepare('INSERT INTO products(provenance,owner,char_id,maker,recipe,template,material,quality,seed,record,made_at,listed) VALUES(?,?,?,?,?,?,?,?,?,?,?,1)');
    const listing = db.prepare("INSERT INTO market_listings(id,seller,char_id,region,kind,provenance,units,own,price,wear,fee,at,expires_at,rid,n) VALUES(?,?,?,17,'piece',?,1,1,?,1000,1,?,?,?,'')");
    const auction = db.prepare("INSERT INTO market_auctions(id,seller,char_id,region,provenance,wear,opening,fee,at,ends_at,rid,n) VALUES(?,?,?,17,?,1000,1,1,?,?,?,'')");
    const pv = i => i.toString(16).padStart(16, '0');
    const insert = (i, recipe, order = 1, at = T0) => {
      const seller = `s${Math.floor(i / 30)}`;
      const r = recipeById(recipe); assert.ok(r);
      product.run(pv(i), seller, `c${seller}`, 'Fixture', recipe, r.templateIndex, r.material ?? 0, 4, 4242, 'p1.x', T0);
      if (view === 'crafted') listing.run(`l${i}`, seller, `c${seller}`, pv(i), order, at, T0 + 86400, `r${i}`);
      else auction.run(`l${i}`, seller, `c${seller}`, pv(i), at, T0 + 3600 + order, `r${i}`);
    };
    //501 valid products, each seller inside the normal30-item cap; matching armour sorts after500 weapons.
    for (let i = 0; i < 501; i++) insert(i, i === 500 ? 'cuirass:mithril' : 'longsword:mithril', i === 500 ? 100 : 1);
    const query = [];
    const prepare = s.env.DB.prepare.bind(s.env.DB);
    s.env.DB.prepare = (sql) => {
      const statement = prepare(sql), bind = statement.bind;
      statement.bind = (...args) => {
        assert.ok(args.length <= 100, 'no request exceeds the D1 parameter bound');
        if (/FROM market_(listings l|auctions a) JOIN products p/.test(sql)) query.push({ sql, args });
        return bind(...args);
      };
      return statement;
    };
    const read = async (extra = {}) => {
      const r = await s.call('/v1/market/read', { character: buyer.character, region: 17, view, family: 'armour', hubs: {17:[207,212]}, ...extra }, buyer.secret);
      assert.equal(r.status, 200); return r.body.rows;
    };
    const rows = await read();
    assert.deepEqual(rows.map(r => r.id), ['l500'], `${view}: matching family remains visible beyond500 unrelated listings`);
    assert.equal(rows[0].piece.recipe, 'cuirass:mithril');
    assert.ok(rows[0].road, 'courier quote retained');
    const actual = query.at(-1);
    assert.ok(actual);
    const plan = db.prepare(`EXPLAIN QUERY PLAN ${actual.sql}`).all(...actual.args).map(r => r.detail).join(' | ');
    assert.match(plan, view === 'crafted' ? /SEARCH l USING INDEX idx_market_open/ : /SEARCH a USING INDEX idx_market_auctions_open/);
    assert.match(plan, /SEARCH p USING INDEX/);
    assert.doesNotMatch(plan, /SCAN [la]\b/);
    const unfiltered = await read({family:null});
    assert.equal(unfiltered.length, MARKET_SHOWN); assert.ok(unfiltered.every(r => r.id !== 'l500'));
    assert.equal((await read({family:'weapons'})).length, MARKET_SHOWN);
    for (const family of ['unknown', "armour' OR 1=1 --", {}, [], ['armour'], true, 42]) assert.deepEqual(await read({family}), []);
    for (const family of [false, 0, '']) assert.equal((await read({family})).length, MARKET_SHOWN);
    // Every public family uses the same recipe law; no hand-written SQL family catalogue can drift.
    for (const [family] of CRAFTED_FAMILIES) {
      const r = RECIPES.find(r => r.family === family); assert.ok(r);
      db.prepare('UPDATE products SET recipe=? WHERE provenance=?').run(r.id, pv(500));
      const selected = await read({family});
      assert.ok(selected.every(row => recipeById(row.piece.recipe)?.family === family));
      if (family !== 'weapons') assert.ok(selected.some(row => row.id === 'l500'), `${view}: ${family} is not hidden by the cutoff`);
    }
    db.prepare('UPDATE products SET recipe=? WHERE provenance=?').run('cuirass:mithril', pv(500));
    const table = view === 'crafted' ? 'market_listings' : 'market_auctions';
    const sort = view === 'crafted' ? 'price' : 'ends_at';
    db.prepare(`UPDATE ${table} SET ${sort}=?,at=? WHERE id='l500'`).run(view === 'crafted' ? 1 : T0 + 3601, T0 - 1);
    assert.equal((await read({family:null}))[0].id, 'l500', 'existing primary sort and older tie-break remain');
    db.prepare(`UPDATE ${table} SET state='cancelled' WHERE id='l500'`).run();
    assert.deepEqual(await read(), [], 'closed matching listing is hidden');
    db.prepare(`UPDATE ${table} SET state='open',${view === 'crafted' ? 'expires_at' : 'ends_at'}=? WHERE id='l500'`).run(T0 - 1);
    assert.deepEqual(await read(), [], 'expired matching listing is hidden');
    db.prepare(`UPDATE ${table} SET state='open',${view === 'crafted' ? 'expires_at' : 'ends_at'}=? WHERE id='l500'`).run(view === 'crafted' ? T0 + 86400 : T0 + 100);
    db.prepare('UPDATE products SET recipe=? WHERE provenance=?').run('{malformed recipe', pv(500));
    assert.equal(recipeById('{malformed recipe'), null);
    assert.deepEqual(await read(), [], 'malformed recipe cannot match a requested family');
    // Preserve prior all-family policy: crafted hides invalid recipes; auctions exposes persisted unknown pieces.
    assert.equal((await read({family:null})).some(r => r.id === 'l500'), view === 'auctions');
  } finally { Date.now = realNow; }
}

test('Crafted family selection precedes the500-row cutoff with sort, bounds, index and eligibility intact', async () => checkView('crafted'));
test('Auction family selection precedes the500-row cutoff with sort, bounds, index and eligibility intact', async () => checkView('auctions'));
