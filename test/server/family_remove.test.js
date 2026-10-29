// FAMILY-REMOVE (FIELD BUGS 2026-10-29b, a one-life player: "i have no characters anymore and i still cannot make another
// bloodline", then "being able to remove old families"): a line no living character plays is let go, and LINEAGES_MAX has
// room again - the REAL Worker over the REAL migrations (test/accountDb.mjs). Deleted and fallen characters never freed a
// line, so forty one-life runs filled the account for good. Mutants: tools/mutants/family_remove.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { standService } from '../accountDb.mjs';
import { freshSave } from '../realmSeat.mjs';
import { ROUTES } from '../../server-account/src/service.js';
import { LINEAGES_MAX } from '../../server-account/src/legacy.js';

const record = (id, rev = 1, people = [{ id: 1 }, { id: 2 }]) => ({ v: 1, id, surname: 'Hlaalu', model: 'bloodline', rev, people });
const famOf = (i) => `fam-k${i.toString(36)}-abc123`;

async function stand() {
  const S = await standService();
  const g = await S.guest();
  const call = (path, body) => S.call(path, body, g.secret);
  const put = (id, lease, seq) => S.fetch(`https://accounts.invalid/v1/realm/${id}/data`, {
    method: 'PUT', body: JSON.stringify(freshSave()), headers: { authorization: `Bearer ${g.secret}`, 'x-realm-lease': lease, 'x-realm-seq': String(seq) },
  });
  const lines = async () => (await call('/v1/realm/lineages', {})).body.lineages.map((l) => l.id);
  return { S, g, call, put, lines };
}

test('FAMILY-REMOVE the route: behind a session', () => {
  assert.ok(ROUTES.has('/v1/realm/lineage/remove'));
});

test('FAMILY-REMOVE a line a living character plays stays; deleted or fallen, it goes - and its fallen stay fallen if it is founded again', async () => {
  const { call, put, lines } = await stand();
  const A = famOf(1), B = famOf(2);
  await call('/v1/realm/lineage', { id: A, record: record(A) });
  await call('/v1/realm/lineage', { id: B, record: record(B) });
  const a = (await call('/v1/realm/create', { name: 'Ysolde Hlaalu', lineage: A, person: 1 })).body;
  assert.equal((await put(a.id, a.lease, 1)).status, 200);
  const held = await call('/v1/realm/lineage/remove', { id: A });
  assert.deepEqual([held.status, held.body.error], [409, 'lineage-in-use'], 'a living character plays it');
  // fallen: the tombstone keeps no line
  assert.equal((await call('/v1/realm/die', { id: a.id, lease: a.lease })).status, 200);
  assert.deepEqual((await call('/v1/realm/lineage/remove', { id: A })).body, { ok: true });
  // deleted: nor does a character gone
  const b = (await call('/v1/realm/create', { name: 'Ilse Hlaalu', lineage: B, person: 1 })).body;
  assert.equal((await put(b.id, b.lease, 1)).status, 200);
  assert.equal((await call('/v1/realm/delete', { id: b.id })).status, 200);
  assert.deepEqual((await call('/v1/realm/lineage/remove', { id: B })).body, { ok: true });
  assert.deepEqual(await lines(), []);
  const gone = await call('/v1/realm/lineage/remove', { id: B });
  assert.deepEqual([gone.status, gone.body.error], [404, 'no-lineage'], 'removed once');
  assert.equal((await call('/v1/realm/lineage/remove', { id: 'nope' })).status, 400);
  // founded again from a device's copy: the fallen's person is still claimed - permadeath holds
  await call('/v1/realm/lineage', { id: A, record: record(A) });
  assert.equal((await call('/v1/realm/create', { name: 'Ysolde Hlaalu', lineage: A, person: 1 })).body.error, 'lineage-played');
  assert.equal((await call('/v1/realm/create', { name: 'Brin Hlaalu', lineage: A, person: 2 })).status, 200, 'its living kin are born');
});

test('FAMILY-REMOVE THE BOUND HAS ROOM AGAIN: at LINEAGES_MAX a founding is refused, a line removed and it is founded; another account\'s line is never this one\'s to remove', async () => {
  const { S, call, lines } = await stand();
  for (let i = 1; i <= LINEAGES_MAX; i++) assert.equal((await call('/v1/realm/lineage', { id: famOf(i), record: record(famOf(i)) })).status, 200);
  const over = 'fam-zzz-abc123';
  assert.equal((await call('/v1/realm/lineage', { id: over, record: record(over) })).body.error, 'too-many-lineages');
  const other = await S.guest();
  assert.equal((await S.call('/v1/realm/lineage/remove', { id: famOf(3) }, other.secret)).body.error, 'no-lineage', 'keyed by the account');
  assert.equal((await lines()).length, LINEAGES_MAX);
  assert.deepEqual((await call('/v1/realm/lineage/remove', { id: famOf(3) })).body, { ok: true });
  assert.deepEqual((await call('/v1/realm/lineage', { id: over, record: record(over) })).body, { ok: true, rev: 1 }, 'room for a new family');
});
