// SHED-REPLICA (2026-10-29, the account database overloaded from 01:15 UTC with its read replica serving none of it;
// bible/11-Multiplayer/Scale-Arc.md SHED-REPLICA). Overloaded, the primary outran its replica: no replica was as new as a
// page's bookmark, every read went to the primary, and the shed answered half the service 503. A replica read the
// isolate would shed now asks any instance (REPLICA_ANY) - a display its replica's lag old, never none; a busy read no
// replica may serve is shed as before. Each pin failed on the build before it. tools/mutants/shed_replica.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { standService } from '../accountDb.mjs';
import { noteOverload, _resetBusyShed, REPLICA_ANY } from '../../server-account/src/service.js';

const MARK = (n) => `${n.toString(16).padStart(8, '0')}-00000000-00000000-${'0'.repeat(32)}`;

test('SHED-REPLICA: while the isolate sheds, a replica read asks any instance - its bookmark or none - and answers; a busy read no replica may serve is still shed with no statement (mutants: the replica read shed; asked at the primary first; every busy read let through)', async () => {
  const S = await standService();
  try {
    const who = await S.registered('Aldric');
    const raw = S.env.DB;
    const post = (path, body, mark = null) => S.fetch(`https://accounts.invalid${path}`, {
      method: 'POST', headers: { authorization: `Bearer ${who.secret}`, 'content-type': 'application/json', ...(mark ? { 'x-d1-bookmark': mark } : {}) }, body: JSON.stringify(body),
    });
    noteOverload(Date.now());
    for (const mark of [MARK(3), null]) {
      const before = raw._sessions.length;
      const town = await post('/v1/homes/town', { mapId: 1 }, mark);
      assert.equal(town.status, 200, `answered, not shed (bookmark ${mark})`);
      assert.ok(Array.isArray((await town.json()).homes));
      const opened = raw._sessions.slice(before);
      assert.deepEqual(opened.map((s) => s.constraint), [REPLICA_ANY], 'one session, at any instance');
      assert.ok(opened[0].statements.length > 0, 'its statements the session\'s');
    }
    const prepare = raw.prepare.bind(raw);
    let asked = 0;
    raw.prepare = (sql) => { asked++; return prepare(sql); };
    const layouts = await post('/v1/homes/layouts', {});
    raw.prepare = prepare;
    assert.equal(layouts.status, 503, 'a busy read no replica may serve: shed');
    assert.equal(asked, 0, 'with no statement');
  } finally { _resetBusyShed(); }
});
