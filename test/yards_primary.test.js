// YARDS-PRIMARY (2026-10-16, acct146; bible/11-Multiplayer/Scale-Arc.md YARDS-PRIMARY): a town's yards are read on the
// binding (the primary) again - the account database's overload began some two hours after YARDS-REPLICA moved every yards
// read onto the one replica, and through it a replica's session waited 31 s on the database for every 5.6 s the binding
// did. YARDS-REPLICA's session stays behind the switch (server-account/src/decor.js YARDS_ON_REPLICA), its own pins
// asking it so (test/primary_trips.test.js). Each pin failed on the build before it. tools/mutants/yards_primary.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { standService } from './accountDb.mjs';
import { yardsKept, YARDS_ON_REPLICA, _resetYardsKept } from '../server-account/src/decor.js';

test('YARDS-PRIMARY: a town\'s yards are read on the binding - no session opened, the yards\' statement the binding\'s own - by the service\'s door and by yardsKept asked plainly (mutant: the switch back on)', async () => {
  assert.equal(YARDS_ON_REPLICA, false);
  const S = await standService();
  const who = await S.registered('Aldric');
  const raw = S.env.DB;
  const asked = [];
  const prep = raw.prepare.bind(raw);
  raw.prepare = (sql) => { asked.push(sql); return prep(sql); };
  raw._sessions.length = 0;
  const r = await S.fetch('https://accounts.invalid/v1/homes/yards', { method: 'POST', headers: { authorization: `Bearer ${who.secret}`, 'content-type': 'application/json' }, body: '{"mapId":1}' });
  assert.equal(r.status, 200, await r.clone().text());
  assert.deepEqual(raw._sessions.map((x) => x.constraint), [], 'no session');
  assert.ok(asked.some((q) => /FROM home_decor WHERE map_id = \? AND yard = 1/.test(q)), 'the yards read on the binding');
  _resetYardsKept();
  const opened = [];
  const db = { prepare: (sql) => ({ bind: () => ({ all: async () => { opened.push(sql); return { results: [] }; } }) }), withSession: () => { throw new Error('a session opened'); } };
  assert.deepEqual(await yardsKept({ db }, 2, 1_000), { mapId: 2, yards: [] });
  assert.equal(opened.length, 1, 'asked of the binding itself');
  _resetYardsKept();
});
