// FAMILY-FORGET (bible/01-Overview/bugs/Field-Bugs-2026-10-29.md; a player: "I cannot make more bloodline characters as
// my 'families for this account is maxed' ... I have no characters anymore", and "being able to remove old families").
// Every Bloodline or Enduring birth founds a line, and nothing let one go: a one-life player who deleted each character
// reached LINEAGES_MAX and every birth past it was refused. A line no living realm character plays can now be forgotten,
// which frees its place; one a living character plays, or a fall a Resurrect may still take back, never; its fallen's
// tombstones stay.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { standService } from '../accountDb.mjs';
import { freshSave } from '../realmSeat.mjs';
import { ROUTES } from '../../server-account/src/service.js';
import { LINEAGES_MAX } from '../../server-account/src/legacy.js';

const famOf = (i) => `fam-f${i.toString(36)}-abc123`;
const record = (id, rev = 1, people = [{ id: 1 }, { id: 2 }]) => ({ v: 1, id, surname: 'Hlaalu', model: 'bloodline', rev, people });

async function stand() {
  const S = await standService();
  const g = await S.guest();
  const call = (path, body, secret = g.secret) => S.call(path, body, secret);
  const put = async (id, lease, seq) => {
    const res = await S.fetch(`https://accounts.invalid/v1/realm/${id}/data`, {
      method: 'PUT', body: JSON.stringify(freshSave()), headers: { authorization: `Bearer ${g.secret}`, 'x-realm-lease': lease, 'x-realm-seq': String(seq) },
    });
    return res.status;
  };
  const found = (id) => call('/v1/realm/lineage', { id, record: record(id) });
  const born = async (id, person = 1) => {
    const a = (await call('/v1/realm/create', { name: 'Ysolde Hlaalu', lineage: id, person })).body;
    assert.equal(await put(a.id, a.lease, 1), 200, 'its first save');
    return a;
  };
  const ids = async () => (await call('/v1/realm/lineages', {})).body.lineages.map((l) => l.id).sort();
  return { S, g, call, found, born, ids, forget: (id, secret) => call('/v1/realm/lineage/forget', { id }, secret) };
}

test('FAMILY-FORGET the report: an account at LINEAGES_MAX with no characters forgets a line, and the next founding lands (mutant: the route unwired)', async () => {
  const { found, forget, ids } = await stand();
  assert.ok(ROUTES.has('/v1/realm/lineage/forget'));
  for (let i = 0; i < LINEAGES_MAX; i++) assert.equal((await found(famOf(i))).status, 200);
  assert.equal((await found(famOf(LINEAGES_MAX))).body.error, 'too-many-lineages', 'at the bound');
  const gone = await forget(famOf(3));
  assert.deepEqual([gone.status, gone.body], [200, { ok: true }]);
  assert.equal((await ids()).includes(famOf(3)), false);
  assert.equal((await found(famOf(LINEAGES_MAX))).status, 200, 'its place freed');
});

test('FAMILY-FORGET only a line no living character plays: one played is held; deleted, it goes; a fallen member\'s line goes and the tombstone stays (mutants: the living unread; a held fall read as gone)', async () => {
  const { S, g, call, found, born, forget, ids } = await stand();
  const A = famOf(1), B = famOf(2), C = famOf(3);
  for (const id of [A, B, C]) await found(id);
  const a = await born(A);
  const held = await forget(A);
  assert.deepEqual([held.status, held.body.error], [409, 'lineage-held'], 'its member is played');
  assert.ok((await ids()).includes(A), 'and kept');
  assert.equal((await call('/v1/realm/delete', { id: a.id })).status, 200);
  assert.equal((await forget(A)).status, 200, 'its character deleted: let go');
  // a fall a Resurrect may still take back is a living character's
  const b = await born(B);
  assert.equal((await call('/v1/realm/die', { id: b.id, lease: b.lease, hold: true })).status, 200);
  assert.equal((await forget(B)).body.error, 'lineage-held', 'a held fall');
  assert.equal((await call('/v1/realm/die', { id: b.id, lease: b.lease })).status, 200, 'it went on');
  assert.equal((await forget(B)).status, 200, 'the line of a fallen member: let go');
  assert.deepEqual([(await call('/v1/realm/join', { id: b.id })).body.error], ['dead'], 'the tombstone stays');
  assert.deepEqual(await ids(), [C]);
  // a bad id, one never founded, another account's
  assert.equal((await forget('nope')).status, 400);
  assert.deepEqual([(await forget(famOf(9))).status, (await forget(famOf(9))).body.error], [404, 'no-lineage']);
  const other = await S.guest();
  assert.equal((await forget(C, other.secret)).body.error, 'no-lineage', 'never another account\'s');
  assert.deepEqual(await ids(), [C]);
  assert.ok(g.id);
});

test('FAMILY-FORGET the client: the Online page offers the lines no living character plays; a forget lets the device\'s copy go, a refusal keeps it; the full house says its way out (mutants: a played line offered; the copy kept; the refusal unsaid)', async () => {
  const { SESSION_KEY } = await import('../../src/net/accountClient.js');
  const { realmIo, realmLineageForget, realmRefusalText } = await import('../../src/systems/realmSaves.js');
  const { storeFamily, loadFamily } = await import('../../src/systems/legacy/store.js');
  const { readFamily } = await import('../../src/systems/legacy/family.js');
  const { oldLines } = await import('../../src/systems/legacy/waitingHouses.js');
  const { S, g, found, born } = await stand();
  const m = new Map();
  const storage = { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), key: (i) => [...m.keys()][i] ?? null, get length() { return m.size; } };
  storage.setItem(SESSION_KEY, JSON.stringify({ id: g.id, secret: g.secret }));
  const io = realmIo({ fetch: (url, init) => S.fetch(url, init), storage });
  const A = famOf(1), B = famOf(2);
  for (const id of [A, B]) { await found(id); storeFamily(storage, readFamily(record(id)), null); }
  const b = await born(B);
  const families = [A, B].map((id) => loadFamily(storage, id));
  assert.ok(b.id);
  assert.deepEqual(oldLines(families, new Set([B])).map((f) => f.id), [A], 'the line played is not offered');
  assert.deepEqual(oldLines([...families, null], new Set()).map((f) => f.id), [A, B]);
  const held = await realmLineageForget(io, B);
  assert.equal(held.error, 'lineage-held');
  assert.ok(loadFamily(storage, B), 'a refusal keeps the copy');
  assert.equal(realmRefusalText('lineage-held'), 'A character of that family is still played online.');
  assert.equal((await realmLineageForget(io, A)).ok, true);
  assert.equal(loadFamily(storage, A), null, 'forgotten: the device\'s copy goes, so no push writes it back');
  assert.match(realmRefusalText('too-many-lineages'), /Forget an old family/);
});

test('FAMILY-FORGET the Online page wires it: the realm card adds the old families under the waiting houses, and each Forget asks first and sends the forget (mutant: the card unwired)', async () => {
  const { readFileSync } = await import('node:fs');
  const menu = readFileSync(new URL('../../src/ui/enhanced/enhancedMenu.js', import.meta.url), 'utf8');
  assert.match(menu, /for \(const card of waitingHouseCards\(\)\) box\.append\(card\);\n {2}const old = oldFamiliesCard\(\);\n {2}if \(old\) box\.append\(old\);/);
  assert.match(menu, /onClick: \(\) => ask\(t\('menu\.realm\.forgetAsk'[^\n]*realmAct\(\(\) => realmLineageForget\(realmIoNow\(\), family\.id\)/);
});
