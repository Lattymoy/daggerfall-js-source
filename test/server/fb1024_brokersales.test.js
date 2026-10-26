// BROKER-RID (AUDIT FB1024, 2026-10-25; bible/01-Overview/bugs/Field-Bugs-2026-10-24.md) - THE BROKER'S SALES BY THEIR
// REQUEST IDS, on the service's side (server-account/src/brokerSales.js, migration 0174): a press with a request id writes
// it beside its sale, in its own batch; the same press asked again answers its sale; /v1/broker/settle answers the sale an
// id wrote - and which ask came first - or fences the id, so the press can never write after. A press without an id (a
// client before this one) sells as it always did.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { standService } from '../accountDb.mjs';
import { ROUTES } from '../../server-account/src/service.js';
import { brokerRidOk } from '../../server-account/src/brokerSales.js';
import { EG_PANOPLY_IDS, EG_SINK_EMBERS } from '../../src/net/eliteGates/egPay.js';
import { INSIGNIA, BROKER_RID_RE, mintBrokerRid } from '../../src/net/insignia.js';
import { arenaWeekOf } from '../../src/net/arena/arenaLaw.js';

const src = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const AURA = INSIGNIA.find((o) => o.kind === 'aura');
const P = EG_PANOPLY_IDS[1];

async function stood(embers = 200) {
  const S = await standService({});
  const raw = S.env.DB._raw;
  const me = await S.registered('Seller');
  for (let i = 0; i < embers; i++) raw.prepare('INSERT INTO serpent_kills (day, account, boss, hull, char_id, xp, nonce, at, stones) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run(5001 + i, me.id, 'sethrakul', 4, me.character, 0, `s${i}`, Math.floor(Date.now() / 1000), 1);
  const spent = () => Number(raw.prepare('SELECT insignia_spent FROM players WHERE id = ?').get(me.id).insignia_spent);
  const rows = () => raw.prepare('SELECT rid, kind, item, settled, asked_by FROM broker_sales WHERE account = ? ORDER BY at, rid').all(me.id).map((r) => ({ ...r }));
  return { S, raw, me, spent, rows, call: (path, body) => S.call(path, body, me.secret) };
}

test('BROKER-RID the request id: `b` and fifteen to thirty-one of base 36, minted from crypto\'s randomness; the service reads it by the client\'s own law (mutants: any string an id)', () => {
  const rid = mintBrokerRid();
  assert.match(rid, /^b[a-z0-9]{15}$/);
  assert.notEqual(mintBrokerRid(), rid);
  for (const ok of [rid, 'b' + 'z'.repeat(31)]) assert.equal(brokerRidOk(ok), true, ok);
  for (const bad of ['', 'x' + 'a'.repeat(15), 'b' + 'a'.repeat(14), 'b' + 'a'.repeat(32), 'b' + 'A'.repeat(15), 'b' + 'a'.repeat(14) + ' ', null, 7]) assert.equal(brokerRidOk(bad), false, String(bad));
  assert.equal(String(BROKER_RID_RE), String(/^b[a-z0-9]{15,31}$/));
});

test('BROKER-RID THE PANOPLY: a press with an id writes it beside its sale; asked again, its sale again (nothing spent twice); a bad id refused; a press without one sells as it did (mutants: the id unwritten; asked again sold again; the id never checked)', async () => {
  const W = await stood();
  const rid = mintBrokerRid();
  const sold = await W.call('/v1/eg/sink', { piece: P, rid });
  assert.deepEqual([sold.status, sold.body.ok, sold.body.piece], [200, true, P]);
  assert.deepEqual(W.rows(), [{ rid, kind: 'panoply', item: P, settled: 0, asked_by: null }]);
  const again = await W.call('/v1/eg/sink', { piece: P, rid });
  assert.deepEqual([again.status, again.body.ok, again.body.piece, again.body.again, again.body.week], [200, true, P, true, sold.body.week]);
  assert.equal(W.spent(), EG_SINK_EMBERS, 'spent once');
  assert.deepEqual([(await W.call('/v1/eg/sink', { piece: P, rid: 'nope' })).status, (await W.call('/v1/eg/sink', { piece: P, rid: 'nope' })).body.error], [400, 'rid']);
  // another press, another id, the same week: the week's piece is bought - no row written for it
  const twice = await W.call('/v1/eg/sink', { piece: EG_PANOPLY_IDS[2], rid: mintBrokerRid() });
  assert.deepEqual([twice.status, twice.body.error, W.rows().length], [409, 'bought', 1]);
  // a client before the id: sells as it always did, and writes no row
  const W2 = await stood();
  const old = await W2.call('/v1/eg/sink', { piece: P });
  assert.deepEqual([old.status, old.body.ok, W2.rows()], [200, true, []]);
});

test('BROKER-RID THE SETTLE: the sale an id wrote answers `held`, its kind, its item and its FIRST ask\'s nonce, every time it is asked; an id with no row is fenced - a press of it landing late writes nothing, the Panoply\'s or the insignia\'s; a guest and a bad id or nonce refused (mutants: no fence; the latest ask as `by`; a fence answered held)', async () => {
  const W = await stood();
  const rid = mintBrokerRid(), n1 = mintBrokerRid(), n2 = mintBrokerRid();
  await W.call('/v1/eg/sink', { piece: P, rid });
  const first = await W.call('/v1/broker/settle', { rid, nonce: n1 });
  assert.deepEqual([first.status, first.body], [200, { held: true, kind: 'panoply', item: P, by: n1, week: arenaWeekOf(Math.floor(Date.now() / 1000)) }]);
  assert.equal((await W.call('/v1/broker/settle', { rid, nonce: n2 })).body.by, n1, 'the first ask, whoever asks');
  // an id the service never wrote: fenced - and its press, landing late, writes nothing and spends nothing
  const ghost = mintBrokerRid(), ghost2 = mintBrokerRid();
  assert.deepEqual((await W.call('/v1/broker/settle', { rid: ghost, nonce: n1 })).body, { held: false });
  assert.deepEqual((await W.call('/v1/broker/settle', { rid: ghost, nonce: n2 })).body, { held: false }, 'a fence stays a fence');
  const W2 = await stood();
  assert.deepEqual((await W2.call('/v1/broker/settle', { rid: ghost, nonce: n1 })).body, { held: false });
  const late = await W2.call('/v1/eg/sink', { piece: P, rid: ghost });
  assert.deepEqual([late.status, late.body.error, W2.spent(), W2.raw.prepare('SELECT COUNT(*) AS n FROM eg_sink').get().n], [409, 'fenced', 0, 0]);
  assert.deepEqual((await W2.call('/v1/broker/settle', { rid: ghost2, nonce: n1 })).body, { held: false });
  const lateIns = await W2.call('/v1/account/insignia', { item: AURA.id, rid: ghost2 });
  assert.deepEqual([lateIns.status, lateIns.body.error, W2.spent()], [409, 'fenced', 0]);
  // refused
  const g = await W.S.guest();
  assert.equal((await W.S.call('/v1/broker/settle', { rid, nonce: n1 }, g.secret)).status, 403);
  for (const body of [{ rid: 'x', nonce: n1 }, { rid, nonce: 'x' }, { rid }, {}]) assert.equal((await W.call('/v1/broker/settle', body)).status, 400, JSON.stringify(body));
  assert.ok(ROUTES.has('/v1/broker/settle'));
});

test('BROKER-RID THE INSIGNIA: a press with an id writes it; asked again, its sale again before `owned` (which its own sale made true); the settle carries the account\'s wardrobe (mutants: asked again refused owned; no wardrobe)', async () => {
  const W = await stood();
  const rid = mintBrokerRid();
  const sold = await W.call('/v1/account/insignia', { item: AURA.id, rid });
  assert.deepEqual([sold.status, sold.body.ok, sold.body.bought], [200, true, AURA.id]);
  const again = await W.call('/v1/account/insignia', { item: AURA.id, rid });
  assert.deepEqual([again.status, again.body.again, again.body.insignia], [200, true, [AURA.id]]);
  assert.equal(W.spent(), AURA.price, 'spent once');
  assert.deepEqual([(await W.call('/v1/account/insignia', { item: AURA.id, rid: mintBrokerRid() })).body.error], ['owned'], 'another press: owned');
  const st = (await W.call('/v1/broker/settle', { rid, nonce: mintBrokerRid() })).body;
  assert.deepEqual([st.held, st.kind, st.item, st.insignia], [true, 'insignia', AURA.id, [AURA.id]]);
  assert.equal((await W.call('/v1/account/insignia', { item: AURA.id, rid: 'nope' })).status, 400);
});

test('BROKER-RID the migration and the route\'s word', () => {
  const m = src('server-account/migrations/0174_broker_sales.sql');
  assert.match(m, /CREATE TABLE IF NOT EXISTS broker_sales \(\n  account TEXT NOT NULL,\n  rid     TEXT NOT NULL,\n  kind    TEXT NOT NULL,\n  item    TEXT,\n  at      INTEGER NOT NULL,\n  settled INTEGER NOT NULL DEFAULT 0,\n  asked_by TEXT,\n  PRIMARY KEY \(account, rid\),/);
  assert.match(src('server-account/src/index.js'), /\/\/   POST \/v1\/broker\/settle \{ rid, nonce \}/);
  assert.match(src('.github/workflows/account-deploy.yml'), /- "src\/net\/insignia\.js"/, 'the Worker bundles the id\'s law');
});
