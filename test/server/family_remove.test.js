// FAMILY-REMOVE (FIELD BUGS 2026-10-29e, a one-life player: "i have no characters anymore and i still cannot make another
// bloodline", then "being able to remove old families"): a line no living character plays is let go, and LINEAGES_MAX has
// room again - the REAL Worker over the REAL migrations (test/accountDb.mjs). Deleted and fallen characters never freed a
// line, so forty one-life runs filled the account for good. AUDIT FB1029e F1, F2, F4: never a line whose fall is held for
// a Resurrect, never founded again by a copy made from it, and never born into once gone. Mutants:
// tools/mutants/family_remove.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { standService } from '../accountDb.mjs';
import { freshSave } from '../realmSeat.mjs';
import { ROUTES } from '../../server-account/src/service.js';
import { LINEAGES_MAX, putLineage, removeLineage } from '../../server-account/src/legacy.js';
import { createRealm } from '../../server-account/src/realm.js';

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

test('FAMILY-REMOVE (AUDIT FB1029e F1) a line whose fall is held for a Resurrect stays - the raise would stand her up on no line; settled, it goes', async () => {
  const { call, put, lines } = await stand();
  const A = famOf(1);
  await call('/v1/realm/lineage', { id: A, record: record(A) });
  const a = (await call('/v1/realm/create', { name: 'Ysolde Hlaalu', lineage: A, person: 1 })).body;
  assert.equal((await put(a.id, a.lease, 1)).status, 200);
  assert.equal((await call('/v1/realm/die', { id: a.id, lease: a.lease, hold: true })).status, 200, 'the death door\'s fall, held');
  const held = await call('/v1/realm/lineage/remove', { id: A });
  assert.deepEqual([held.status, held.body.error], [409, 'lineage-in-use'], 'held for a Resurrect: in use');
  assert.equal((await call('/v1/realm/die', { id: a.id, lease: a.lease })).status, 200, 'the tab went on: the window closed');
  assert.deepEqual((await call('/v1/realm/lineage/remove', { id: A })).body, { ok: true });
  assert.deepEqual(await lines(), []);
});

test('FAMILY-REMOVE (AUDIT FB1029e F2) a copy made from a removed line never founds it again behind the player\'s back; a founding still founds', async () => {
  const { call, lines } = await stand();
  const A = famOf(1);
  await call('/v1/realm/lineage', { id: A, record: record(A) });
  assert.deepEqual((await call('/v1/realm/lineage/remove', { id: A })).body, { ok: true });
  const stale = await call('/v1/realm/lineage', { id: A, record: record(A, 7), base: 1 });
  assert.deepEqual([stale.status, stale.body.error], [404, 'no-lineage'], 'made from the stored copy, which is gone');
  assert.deepEqual(await lines(), []);
  assert.deepEqual((await call('/v1/realm/lineage', { id: A, record: record(A, 7) })).body, { ok: true, rev: 7 }, 'a founding, no base');
});

test('FAMILY-REMOVE (AUDIT FB1029e F4) a line removed between a birth\'s check and its write takes no birth', async () => {
  const S = await standService();
  const g = await S.guest();
  const db = S.env.DB, nowS = 1_800_000_000, A = famOf(1);
  assert.deepEqual(await putLineage({ db, nowS }, g.id, { id: A, record: record(A) }), { ok: true, rev: 1 });
  let removed = null;
  const racing = {
    ...db,
    prepare(sql) {
      const st = db.prepare(sql);
      if (/^\s*INSERT INTO realm_characters/.test(sql) && removed == null) {
        const bind = st.bind.bind(st);
        st.bind = (...a) => { const b = bind(...a); const run = b.run; b.run = async () => { removed = await removeLineage({ db }, g.id, { id: A }); return run(); }; return b; };
      }
      return st;
    },
  };
  const born = await createRealm({ db: racing, rand: (b) => globalThis.crypto.getRandomValues(b), nowS }, g.id, { name: 'Brin Hlaalu', lineage: A, person: 2 });
  assert.deepEqual(removed, { ok: true }, 'the removal landed between the two');
  assert.deepEqual(born, { error: 'no-lineage' });
  assert.equal(db._raw.prepare('SELECT COUNT(*) AS n FROM realm_characters WHERE player = ?').get(g.id).n, 0, 'no character on a line that is gone');
});

test('FAMILY-REMOVE (AUDIT FB1029e T11) another account\'s living character of a line of the same id holds nothing of this one\'s', async () => {
  const { S, call } = await stand();
  const A = famOf(1);
  await call('/v1/realm/lineage', { id: A, record: record(A) });
  const other = await S.guest();
  await S.call('/v1/realm/lineage', { id: A, record: record(A) }, other.secret);
  assert.equal((await S.call('/v1/realm/create', { name: 'Ysolde Hlaalu', lineage: A, person: 1 }, other.secret)).status, 200, 'the other account plays its own line');
  assert.deepEqual((await call('/v1/realm/lineage/remove', { id: A })).body, { ok: true }, 'this one\'s goes');
});

test('FAMILY-REMOVE (AUDIT FB1029f FAMILY F3) a remove that lands between a write\'s read and its UPDATE answers no-lineage, never a 500', async () => {
  const S = await standService();
  const g = await S.guest();
  const db = S.env.DB, nowS = 1_800_000_000, A = famOf(1);
  assert.deepEqual(await putLineage({ db, nowS }, g.id, { id: A, record: record(A) }), { ok: true, rev: 1 });
  let removed = null;
  const racing = {
    ...db,
    prepare(sql) {
      const st = db.prepare(sql);
      if (/^\s*UPDATE lineages SET record/.test(sql) && removed == null) {
        const bind = st.bind.bind(st);
        st.bind = (...a) => { const b = bind(...a); const run = b.run; b.run = async () => { removed = await removeLineage({ db }, g.id, { id: A }); return run(); }; return b; };
      }
      return st;
    },
  };
  const wrote = await putLineage({ db: racing, nowS }, g.id, { id: A, record: record(A, 2), base: 1 });
  assert.deepEqual(removed, { ok: true }, 'the removal landed between the two');
  assert.deepEqual(wrote, { error: 'no-lineage' }, 'F2\'s answer: the copy was made from a line that is gone');
  assert.equal(db._raw.prepare('SELECT COUNT(*) AS n FROM lineages WHERE player = ?').get(g.id).n, 0, 'not founded again');
});
