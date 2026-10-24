// CHAT-FIND-ALL (2026-10-14, Dudey: "searching players in chat looks like it only finds the ones that are shown in the
// list"): rosterRows answers every known row, sorted and uncut, beside the column's first ROSTER_ROWS_MAX - and the
// panel's search filters that.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { rosterRows, ROSTER_ROWS_MAX } from '../../src/net/roster.js';

test('CHAT-FIND-ALL a player past the column\'s cut is in `all` (mutant: `all` the cut list)', () => {
  const peers = new Map();
  for (let i = 0; i < ROSTER_ROWS_MAX + 50; i++) { const id = `p${String(i).padStart(4, '0')}x`; peers.set(id, { id, name: `Aaa${String(i).padStart(4, '0')}` }); }
  peers.set('zz01x', { id: 'zz01x', name: 'Zelda' });
  const r = rosterRows({ id: 'me01x', name: 'Me', peers });
  assert.equal(r.rows.length, ROSTER_ROWS_MAX);
  assert.ok(!r.rows.some((x) => x.name === 'Zelda'), 'past the cut in the column');
  assert.ok(r.all.some((x) => x.name === 'Zelda'), 'found by the search');
  assert.equal(r.all.length, ROSTER_ROWS_MAX + 52);
  assert.equal(rosterRows({ id: 'me01x', name: 'Me', peers }).all, r.all, 'the same frozen list while nothing moved');
});

test('CHAT-FIND-ALL the panel\'s search filters the uncut list', () => {
  const src = readFileSync(new URL('../../src/ui/chatPanel.js', import.meta.url), 'utf8');
  assert.match(src, /const rows = query \? everyone\.filter\(\(r\) => playerFound\(r\.name, r\.id, query\)\) : all;/);
});
