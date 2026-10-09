// LEGACY7 (2026-10-06, bible/06-Systems/Legacy-Arc.md section 9; Mac: "online integration with permadeath (Bloodline)
// or non-permadeath (Enduring)"): PROJECT LEGACY ONLINE, SERVICE SIDE - the REAL Worker over the REAL migrations
// (test/accountDb.mjs): an account's lines (server-account/src/legacy.js, migration 0084), written only past their rev;
// a realm character born as a living member of the account's own line, never one another played; and the tombstone - a
// fallen character never joined, checkpointed or counted against the roster again.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { standService } from './accountDb.mjs';
import { freshSave } from './realmSeat.mjs';
import { ROUTES, ACCOUNT_VERSION } from '../server-account/src/service.js';
import { REALM_CHARACTERS_MAX, realmCharacterHeld } from '../server-account/src/realm.js';
import { LINEAGES_MAX, LINEAGE_MAX_BYTES, lineageRecordOf } from '../server-account/src/legacy.js';

const FAM = 'fam-k1x2y3-abc123';
const record = (rev, people = [{ id: 1 }], extra = {}) => ({ v: 1, id: FAM, surname: 'Hlaalu', model: 'bloodline', rev, people, ...extra });

async function stand() {
  const S = await standService();
  const g = await S.guest();
  const put = async (id, lease, seq, save = freshSave()) => {
    const res = await S.fetch(`https://accounts.invalid/v1/realm/${id}/data`, {
      method: 'PUT', body: JSON.stringify(save), headers: { authorization: `Bearer ${g.secret}`, 'x-realm-lease': lease, 'x-realm-seq': String(seq) },
    });
    return { status: res.status, body: await res.json().catch(() => null) };
  };
  return { S, g, call: (path, body) => S.call(path, body, g.secret), put };
}

test('LEGACY7 the routes: the lines, a line written, the tombstone - behind a session, and the service moved on', () => {
  for (const r of ['/v1/realm/lineages', '/v1/realm/lineage', '/v1/realm/die']) assert.ok(ROUTES.has(r), r);
  assert.equal(ACCOUNT_VERSION, 'acct102');   // PIN MOVED: acct102, the Chapters (CHAP1-CHAP7b) past BAG-CRAFT's acct101, INT1-INT6's acct100, CARDS9-CARDS10's acct99, PERMADEATH-HOUSES' acct98, SERVER-POST's acct97, TAVERN CARDS' acct96 and SCALE4's acct95 at the merges; acct85 at first, past SERPENT-SET's acct84; renumbered past main's YARD-SHED (acct85) and YARD-HEIGHT (acct86) at the merges; STORM-SHED moved it on (acct88), STORM-SHED 2 (acct89), TEXT-F1 (acct90), CAP-OFF (acct91), FOUNDER5 (acct92), CRAFT2-CRAFT5 (acct93), SD9b (acct94 - acct91 on its branch, renumbered past CAP-OFF, FOUNDER5 and CRAFT2-CRAFT5 at the merges), SCALE4a-c (acct95 - acct94 on its branch, renumbered past SD9b at the merge)
});

test('LEGACY7 a line: founded, written only past its rev - a stale write answered with the stored record to merge into - its model the founder\'s for good', async () => {
  const { call, S } = await stand();
  assert.deepEqual((await call('/v1/realm/lineages', {})).body, { lineages: [] });
  assert.deepEqual((await call('/v1/realm/lineage', { id: FAM, record: record(3) })).body, { ok: true, rev: 3 });
  const stale = await call('/v1/realm/lineage', { id: FAM, record: record(3, [{ id: 1 }, { id: 2 }]) });
  assert.equal(stale.status, 409);
  assert.equal(stale.body.error, 'lineage-stale');
  assert.equal(stale.body.rev, 3);
  assert.deepEqual(stale.body.record.people, [{ id: 1 }], 'the stored one, to merge into');
  // PIN MOVED (AUDIT LEGACY III A2): a write lands only on the copy it was made from (`base`) - past the stored rev alone
  // is a copy that ran its own counter past a write it never read
  assert.equal((await call('/v1/realm/lineage', { id: FAM, record: record(9, [{ id: 1 }, { id: 2 }]) })).body.error, 'lineage-stale', 'ahead, but made from nothing it read');
  assert.equal((await call('/v1/realm/lineage', { id: FAM, record: record(9, [{ id: 1 }, { id: 2 }]), base: 2 })).body.error, 'lineage-stale', 'made from an older copy');
  assert.deepEqual((await call('/v1/realm/lineage', { id: FAM, record: record(5, [{ id: 1 }, { id: 2 }]), base: 3 })).body, { ok: true, rev: 5 });
  const listed = (await call('/v1/realm/lineages', {})).body.lineages;
  assert.equal(listed.length, 1);
  assert.deepEqual([listed[0].id, listed[0].surname, listed[0].model, listed[0].rev, listed[0].record.people.length], [FAM, 'Hlaalu', 'bloodline', 5, 2]);
  const model = await call('/v1/realm/lineage', { id: FAM, record: record(6, [{ id: 1 }], { model: 'enduring' }) });
  assert.deepEqual([model.status, model.body.error], [409, 'lineage-model'], 'a Bloodline is never written Enduring');
  for (const bad of [{ id: 'nope', record: record(9) }, { id: FAM, record: { ...record(9), id: 'fam-other-abc123' } }, { id: FAM, record: { ...record(9), v: 2 } },
    { id: FAM, record: record(9, []) }, { id: FAM, record: record(0) }, { id: FAM, record: record(9, [{ id: 'x' }]) }]) {
    assert.equal((await call('/v1/realm/lineage', bad)).status, 400, JSON.stringify(bad).slice(0, 60));
  }
  assert.equal(lineageRecordOf({ ...record(1), pad: 'x'.repeat(LINEAGE_MAX_BYTES) }, FAM), null, 'bounded');
  // another account never reads nor writes this one's
  const other = await S.guest();
  assert.deepEqual((await S.call('/v1/realm/lineages', {}, other.secret)).body.lineages, []);
  assert.deepEqual((await S.call('/v1/realm/lineage', { id: FAM, record: record(2) }, other.secret)).body, { ok: true, rev: 2 }, 'its own line of the same id - keyed by the account');
  assert.equal((await call('/v1/realm/lineages', {})).body.lineages[0].rev, 5);
  // the bound
  for (let i = 1; i < LINEAGES_MAX; i++) {
    const id = `fam-k${i.toString(36)}-abc123`;
    assert.equal((await call('/v1/realm/lineage', { id, record: { ...record(1), id } })).status, 200);
  }
  const over = 'fam-zzz-abc123';
  assert.equal((await call('/v1/realm/lineage', { id: over, record: { ...record(1), id: over } })).body.error, 'too-many-lineages');
});

test('LEGACY7 the birth: a realm character born as a living member of the account\'s own line - never one dead, retired, wed in or a minor, never one another played; one whose first save never landed taken up again', async () => {
  const { call, put } = await stand();
  const people = [{ id: 1 }, { id: 2, died: { at: 5 } }, { id: 3, retired: 9 }, { id: 4, kind: 'resident' }, { id: 5, minor: true }, { id: 6 }];
  const make = (person, lineage = FAM) => call('/v1/realm/create', { name: 'Ysolde Hlaalu', lineage, person });
  assert.deepEqual([(await make(1)).status, (await make(1)).body.error], [404, 'no-lineage'], 'the line first');
  await call('/v1/realm/lineage', { id: FAM, record: record(1, people) });
  for (const p of [2, 3, 4, 5, 99]) assert.equal((await make(p)).body.error, 'lineage-person', `person ${p}`);
  assert.equal((await make('1')).status, 400);
  const born = await make(1);
  assert.equal(born.status, 200);
  // a birth whose first save never landed is taken up again - the same row, a new lease
  const again = await make(1);
  assert.deepEqual([again.status, again.body.id, again.body.resumed], [200, born.body.id, true]);
  assert.notEqual(again.body.lease, born.body.lease);
  assert.equal((await put(again.body.id, again.body.lease, 1)).status, 200, 'its first save');
  assert.equal((await make(1)).body.error, 'lineage-played', 'one character a person');
  const plain = await call('/v1/realm/create', { name: 'Stranger' });
  assert.equal(plain.status, 200, 'a character of no line is born as before');
});

test('LEGACY7 the tombstone: under the lease, once; never joined, checkpointed or held again, and its slot freed', async () => {
  const { S, g, call, put } = await stand();
  await call('/v1/realm/lineage', { id: FAM, record: record(1, [{ id: 1 }, { id: 2 }]) });
  const a = (await call('/v1/realm/create', { name: 'Ysolde Hlaalu', lineage: FAM, person: 1 })).body;
  assert.equal((await put(a.id, a.lease, 1)).status, 200, 'its first save');
  assert.deepEqual([(await call('/v1/realm/die', { id: a.id, lease: 'f'.repeat(32) })).status], [409], 'only the playing tab\'s lease');
  const died = await call('/v1/realm/die', { id: a.id, lease: a.lease });
  assert.equal(died.status, 200);
  assert.ok(Number.isSafeInteger(died.body.deadAt));
  assert.deepEqual((await call('/v1/realm/die', { id: a.id, lease: a.lease })).body, died.body, 'a retry whose answer was lost: the same stamp');
  const join = await call('/v1/realm/join', { id: a.id });
  assert.deepEqual([join.status, join.body.error], [410, 'dead'], 'never played past a death');
  const cp = await put(a.id, a.lease, 2);
  assert.deepEqual([cp.status, cp.body.error], [410, 'dead'], 'nothing of the dead written again');
  assert.equal(await realmCharacterHeld({ db: S.env.DB }, g.id, a.id), false, 'the relay\'s door refuses it');
  const list = async () => (await S.fetch('https://accounts.invalid/v1/realm', { headers: { authorization: `Bearer ${g.secret}` } }).then((r) => r.json())).characters;
  assert.deepEqual((await list()).map((c) => c.id), [], 'off the roster');
  // the line's heir is born; the fallen's person is never born again
  assert.equal((await call('/v1/realm/create', { name: 'Ysolde Hlaalu', lineage: FAM, person: 1 })).body.error, 'lineage-played');
  const heir = (await call('/v1/realm/create', { name: 'Ilse Hlaalu', lineage: FAM, person: 2 })).body;
  assert.equal((await put(heir.id, heir.lease, 1)).status, 200, 'the heir\'s first save');
  const listed = await list();
  assert.deepEqual(listed.map((c) => [c.id, c.lineage, c.person]), [[heir.id, FAM, 2]], 'the line and the person on the tile');
  // the slot: the dead count for nothing
  for (let i = 1; i < REALM_CHARACTERS_MAX; i++) assert.equal((await call('/v1/realm/create', { name: `Filler ${i}` })).status, 200);
  assert.equal((await call('/v1/realm/create', { name: 'One too many' })).body.error, 'too-many-characters', `${REALM_CHARACTERS_MAX} living`);
  assert.equal((await call('/v1/realm/create', { name: 'Ilse Hlaalu', lineage: FAM, person: 2 })).body.error, 'lineage-played', 'a person played is said so, whatever the roster - never "too many characters"');
  assert.equal((await list()).length, REALM_CHARACTERS_MAX, 'every living one listed - the dead never crowd one out');
});
