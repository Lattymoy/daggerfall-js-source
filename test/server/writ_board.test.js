// WRIT-BOARD (2026-10-19, the account database overloaded again; bible/11-Multiplayer/Scale-Arc.md WRIT-BOARD; migration
// 0138) - A REGION'S WRITS READ BY THEIR OWNER: the board's two owners ('' and the caller's) each sought to its region on
// idx_writs_owner, where the table's UNIQUE index walked every member's own writs of the region's day; and a member's own
// writs of the day found by the member on the same index, where every region's writs of the day were walked - one index
// built for both (AUDIT LEAN-READS D2).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { d1 } from '../accountDb.mjs';

const src = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const lcg = (seed) => { let x = seed % 2147483647 || 1; return () => (x = (x * 48271) % 2147483647) / 2147483647; };
const BOARD = src('server-account/src/professions.js').match(/db\.prepare\("(SELECT \* FROM writs WHERE day = \?1 AND region = \?2 AND owner IN \([^"]*)"\)/)?.[1];
const BEFORE = "SELECT * FROM writs WHERE day = ?1 AND region = ?2 AND (owner = '' OR owner = ?3) ORDER BY kind, faction, slot";

test('WRIT-BOARD the board\'s read: the writs the read before it answered, in its order - the region\'s day posted to everyone and the caller\'s own - sought by their two owners to the region on idx_writs_owner, never walking the other members\' (mutants: the owners\' index, the order)', () => {
  assert.ok(BOARD, 'the board\'s read in professions.js');
  const db = d1();
  const raw = db._raw;
  const r = lcg(31337);
  const ins = raw.prepare(`INSERT OR IGNORE INTO writs (id, kind, day, region, faction, owner, slot, material, tier, qty, pay, renown, expires_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'iron', 1, 1, 1, 0, 0)`);
  const owners = ['', 'c-1', 'c-2', 'c-3', 'c-4'];
  for (let i = 0; i < 2000; i++) {
    const owner = owners[Math.floor(r() * owners.length)];
    ins.run(`w${i}`, owner ? 'member' : (r() < 0.5 ? 'court' : 'hall'), 100 + Math.floor(r() * 3), 17 + Math.floor(r() * 3), Math.floor(r() * 4), owner, Math.floor(r() * 30));
  }
  for (const day of [100, 101, 102]) for (const region of [17, 18, 19]) for (const owner of ['c-1', 'c-3', 'nobody']) {
    assert.deepEqual(raw.prepare(BOARD).all(day, region, owner), raw.prepare(BEFORE).all(day, region, owner), `${day} ${region} ${owner}`);
  }
  const plan = raw.prepare(`EXPLAIN QUERY PLAN ${BOARD}`).all(100, 17, 'c-1').map((p) => p.detail).join(' | ');
  assert.match(plan, /idx_writs_owner \(day=\? AND owner=\? AND region=\?\)/, plan);
  assert.equal(raw.prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE type = 'index' AND name LIKE 'idx_writs_%' AND sql LIKE '%(day, %'").get().n, 1, 'one index built (AUDIT LEAN-READS D2)');
  // a member's own writs of the day, every region's: found by the member
  const had = "SELECT faction FROM writs WHERE day = ?1 AND kind = 'member' AND owner = ?2";
  assert.ok(src('server-account/src/professions.js').includes(had), 'the member\'s read is professions.js\'s own');
  assert.match(raw.prepare(`EXPLAIN QUERY PLAN ${had}`).all(100, 'c-1').map((p) => p.detail).join(' | '), /idx_writs_owner/);
  assert.ok(src('server-account/src/professions.js').includes("SELECT 1 FROM writs WHERE day = ?2 AND kind = 'member' AND owner = ?5 AND faction = ?4"));
  assert.match(raw.prepare("EXPLAIN QUERY PLAN SELECT 1 FROM writs WHERE day = ?1 AND kind = 'member' AND owner = ?2 AND faction = ?3").all(100, 'c-1', 1).map((p) => p.detail).join(' | '), /idx_writs_owner/);
});
