// CRAFT-SET and DECOR-SEEK (OVERLOAD-EASE 3, 2026-10-29; bible/11-Multiplayer/Scale-Arc.md CRAFT-SET): the Work tab's
// eligible read cost ~6M rows a run - the account's every craft scanned once a piece, and the whole decor index once a
// piece (`json_extract(...) = p.provenance` takes the column's TEXT affinity, so idx_home_decor_pv was scanned, never
// searched). Pinned by each statement's plan over the real migrations, and by the answer: a piece standing in a home
// still fills nothing, a piece of the second provenance of a craft still fills.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { d1, standService, T0 } from '../accountDb.mjs';
import { pieceOkSql } from '../../server-account/src/craftWrits.js';
import { pieceWaysRead } from '../../server-account/src/market.js';

const plan = (raw, sql) => raw.prepare(`EXPLAIN QUERY PLAN ${sql}`).all().map((r) => r.detail);
const decorSought = (rows) => rows.some((d) => /^SEARCH (home_decor|h) USING COVERING INDEX idx_home_decor_pv \(<expr>=\?\)/.test(d));
const decorScanned = (rows) => rows.some((d) => /^SCAN (home_decor|h)\b/.test(d));

/** The statements a request prepares whose SQL matches `re`. */
function capture(s, re) {
  const prep = s.env.DB.prepare.bind(s.env.DB), seen = [];
  s.env.DB.prepare = (sql) => { if (re.test(sql)) seen.push(sql); return prep(sql); };
  return seen;
}

test('CRAFT-SET: the Work tab\'s eligible read reads the crafts once and searches the decor index - its answer the same', async () => {
  Date.now = () => T0 * 1000;
  const s = await standService({ PROFESSIONS_OPEN: 'on', MARKS_OPEN: 'on', BOARD_OPEN: 'on' });
  const raw = s.env.DB._raw, P = (n) => n.toString(16).padStart(16, '0');
  const smith = await s.registered('Silverthorn'), pia = await s.registered('Pia');
  s.seedMarks(pia, 10_000);
  const piece = (pv, quality) => raw.prepare(`INSERT INTO products (provenance, owner, char_id, maker, recipe, template, material, quality, seed, record, made_at)
    VALUES (?, ?, ?, 'Silverthorn', 'longsword:mithril', 120, 5, ?, 4242, 'p1.x', ?)`).run(pv, smith.id, smith.character, quality, T0);
  for (const [pv, q] of [[P(0x41), 4], [P(0x42), 2], [P(0x43), 3], [P(0x44), 3]]) piece(pv, q);
  const craft = (pv, pv2) => raw.prepare(`INSERT INTO prof_crafts (player, rid, char_id, recipe, quality, count, provenance, provenance2, seed, xp, first, at, n)
    VALUES (?, ?, ?, 'longsword:mithril', 3, ?, ?, ?, 4242, 10, 0, ?, 'n')`).run(smith.id, `craft-${pv}`, smith.character, pv2 ? 2 : 1, pv, pv2, T0);
  craft(P(0x41), null);
  craft(P(0x40), P(0x42));   // a craft of two: its second piece is of this make too
  craft(P(0x43), null);      // made, but standing in a home
  // P(0x44): bought, of no craft of this account's
  raw.exec('PRAGMA foreign_keys = OFF');
  raw.prepare(`INSERT INTO home_decor (map_id, building_key, id, place, placed_at, item) VALUES (1, 1, 'd1', '{}', ?, ?)`).run(T0, JSON.stringify({ pv: P(0x43) }));
  raw.exec('PRAGMA foreign_keys = ON');
  const c = (await s.call('/v1/writs/commission', { character: pia.character, region: 17, crafter: 'Silverthorn', recipe: 'longsword:mithril', quality: 2, pay: 900, rid: 'cs-000001' }, pia.secret)).body.commission;
  assert.ok(c, 'the commission posted');
  const seen = capture(s, /FROM commissions c\s+JOIN products p/);
  const read = (await s.call('/v1/writs/list', { character: smith.character, region: 17 }, smith.secret)).body;
  assert.deepEqual(read.commissions.find((x) => x.id === c.id).eligible, [{ provenance: P(0x42), quality: 2 }, { provenance: P(0x41), quality: 4 }]);
  assert.equal(seen.length, 1, 'the eligible read ran');
  const rows = plan(raw, seen[0]);
  assert.ok(!/EXISTS \(SELECT 1 FROM prof_crafts/.test(seen[0]), 'no craft scan a piece');
  assert.ok(decorSought(rows) && !decorScanned(rows), `the decor index searched: ${rows.join(' | ')}`);
});

test('CRAFT-SET: a crafting writ\'s piece check reads the crafts once; DECOR-SEEK: it and the market\'s piece ways search the decor index', () => {
  const raw = d1()._raw;
  const ok = plan(raw, `SELECT pr.provenance FROM products pr WHERE pr.owner = ?1 AND ${pieceOkSql('?1', '?2', 'pr.provenance', '?3')}`);
  assert.ok(decorSought(ok) && !decorScanned(ok), `the decor index searched: ${ok.join(' | ')}`);
  assert.ok(!/cr\.provenance2 = pk\.provenance/.test(pieceOkSql('?1', '?2', 'x', '?3')), 'no craft scan a piece');
  let sql = '';
  pieceWaysRead({ prepare: (q) => { sql = q; return { bind: () => ({}) }; } }, ['0000000000000041']);
  const ways = plan(raw, sql);
  assert.ok(decorSought(ways) && !decorScanned(ways), `the decor index searched: ${ways.join(' | ')}`);
});
