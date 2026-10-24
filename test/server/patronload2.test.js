// PATRON-LOAD II (2026-10-11, the owner: "I think the database is overloaded"; bible/06-Systems/Living-World-II.md
// PATRON-LOAD II): read off the database (wrangler d1 insights, a day), the region's traders read (market.js
// marketVendors, /v1/market/vendors - every online client in a living town each PATRON_READ_S) was 4.2 billion of the
// day's 5.66 billion rows: its two statements walked every open listing in the market and, for each, every piece in its
// town (~720,000 rows a statement, ~860 ms), and the region was asked last. PATRON-LOAD (acct109) had taken the patrons'
// reckoning out of that read; the read itself was the weight. Migration 0107 indexes a trader's piece by its town and its
// id, and a region's open trader listings by their age; the read asks by the listing's own region (a trader's listing
// carries its home's - homevendor_service.test.js pins "in the home's region whatever the client says").
// Each pin failed on the build before it. tools/mutants/patronload2.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { marketVendors, marketVendor } from '../../server-account/src/market.js';
import { d1, T0 } from '../accountDb.mjs';

const ENV = { MARKS_OPEN: 'on', BOARD_OPEN: 'on', PROFESSIONS_OPEN: 'on' };
const READER = { id: 'p_reader', handle: 'reader', guest: 0, created_at: 1 };

/** The statements a route runs, as the real code asks them, each with its plan on the real migrations. */
async function plansOf(route, args) {
  const db = d1();
  const asked = [];
  const rec = { ...db, prepare(sql) { asked.push(sql); return db.prepare(sql); }, batch: db.batch.bind(db) };
  const out = await route({ db: rec, nowS: T0 }, READER, ENV, args);
  assert.ok(!out.error || out.error === 'vendor-gone', `the route answered ${out.error}`);
  return asked.map((sql) => {
    const n = Math.max(0, ...[...sql.matchAll(/\?(\d+)/g)].map((m) => Number(m[1])));
    return { sql, plan: db._raw.prepare(`EXPLAIN QUERY PLAN ${sql}`).all(...Array(n).fill(1)).map((r) => r.detail) };
  });
}

test('PATRON-LOAD II A: the region\'s traders read walks its own region\'s trader listings, newest first, and finds each one\'s piece by its town and its id - never every open listing in the market, never every piece in a town (mutants: either statement unnarrowed; the region index unwritten or without the age; the piece index unwritten or without the yard)', async () => {
  const reads = (await plansOf(marketVendors, { region: 17, character: 'c_reader' })).filter((s) => s.sql.includes('v_map'));
  assert.equal(reads.length, 2, 'the newest pieces and each house\'s newest');
  for (const { sql, plan } of reads) {
    const at = sql.includes('v_rank') ? 'each house\'s newest' : 'the newest';
    // PIN MOVED (AUDIT LEAN-READS B8, 2026-10-20): the region's open trader listings by their age or, for each house's
    // newest, by their end (idx_market_vendor_expiry, the board's next-to-run-out index - its range never wider)
    const byRegion = sql.includes('v_rank') ? /SEARCH l USING INDEX idx_market_vendor_(region \(region=\?\)|expiry \(region=\? AND expires_at>\?\))/ : /SEARCH l USING INDEX idx_market_vendor_region \(region=\?\)/;
    assert.ok(plan.some((p) => byRegion.test(p)), `${at}: by the region's trader listings - ${plan.join(' | ')}`);
    assert.ok(plan.some((p) => /SEARCH d USING INDEX idx_home_decor_piece \(map_id=\? AND id=\? AND yard=\?\)/.test(p)), `${at}: a piece by its town and id - ${plan.join(' | ')}`);
    assert.ok(!plan.some((p) => /idx_market_open|idx_home_decor_yard|SCAN l\b|SCAN d\b/.test(p)), `${at}: no walk of the market or a town - ${plan.join(' | ')}`);
  }
  // the newest, read in the index's own order: LIMIT stops it at VENDOR_BOARD_SHOWN, where a sort read them all first
  const newest = reads.find((s) => !s.sql.includes('v_rank'));
  assert.ok(!newest.plan.some((p) => /TEMP B-TREE FOR ORDER BY/.test(p)), newest.plan.join(' | '));
});

test('PATRON-LOAD II B: a stall\'s own read finds its trader by its town and its id - one piece, not every piece in the town (mutant: the piece index unwritten)', async () => {
  const stands = (await plansOf(marketVendor, { vendor: { map: 5, id: 'v1' } })).filter((s) => /FROM home_decor d/.test(s.sql));
  assert.equal(stands.length, 1, 'the stall\'s trader');
  assert.ok(stands[0].plan.some((p) => /SEARCH d USING INDEX idx_home_decor_piece \(map_id=\? AND id=\? AND yard=\?\)/.test(p)), stands[0].plan.join(' | '));
});
