// GRANT2 (2026-10-18, Mac: "Lets build the plan"; bible/11-Multiplayer/Spawn-Grants.md section 12): THE SPAWN GRANTS'
// MEASURE, KEPT AND READ (server-account/src/grants.js) - a cell's window posted to /v1/mod/grant-feed under the relay's
// signature, kept once; refused unsigned, under another key, stale or misshapen; read by a developer from
// /v1/mod/realm-grants - per kind, an account's asks an hour, what the buckets and the ceiling would have refused, the
// cells' most live; and tools/realmReview.mjs `grants`.
import test from 'node:test';
import assert from 'node:assert/strict';
import { standService } from '../accountDb.mjs';
import { importReceiptKey } from '../../src/net/gate/gateReceipt.js';
import { newGrantMeasure, foldGrantAsk, grantMeasureBatch, sealGrantMeasure, grantMeasureValid, GRANT_MEASURE_SIG_HEADER, GRANT_MEASURE_ROWS, GRANT_MEASURE_AGE_MAX_MS } from '../../src/net/grantMeasure.js';
import { GRANT_CELL_CEILING } from '../../src/net/grantLaw.js';
import { ROUTES } from '../../server-account/src/service.js';
import { GRANT_FEED_PATH, GRANT_RATE_SPAN_MIN_S } from '../../server-account/src/grants.js';
import { reviewRequest, USAGE } from '../../tools/realmReview.mjs';

const { subtle } = globalThis.crypto;
const URL_ = `https://accounts.invalid${GRANT_FEED_PATH}`;

/** A cell's window as the relay folds it: Ann's encounters (eight, two over her bucket), Bo's one camp. */
function window(nowMs, q = 'world:25,9') {
  const w = newGrantMeasure(nowMs - 20 * 60_000);
  for (let i = 0; i < 8; i++) foldGrantAsk(w, 'acct-ann', 'enc', 2, i >= 6 ? 'bucket' : null, 2 * (i + 1));
  foldGrantAsk(w, 'acct-bo', 'camp', 5, null, 21);
  return grantMeasureBatch(w, [...crypto.getRandomValues(new Uint8Array(8))].map((x) => x.toString(16).padStart(2, '0')).join(''), q, nowMs);
}

test('GRANT2 THE WINDOW\'S LAW: an ask folded per account and kind - its asks, members, the bucket\'s and the ceiling\'s refusals, the most live; full at GRANT_MEASURE_ROWS; a batch read whole or not at all (mutants: a ceiling\'s refusal counted as the bucket\'s; members past the asks\' most believed)', () => {
  const now = 1_800_000_000_000;
  const b = window(now);
  assert.ok(grantMeasureValid(b));
  assert.deepEqual(b.rows, [
    { a: 'acct-ann', k: 'enc', asks: 8, members: 16, bucket: 2, ceiling: 0 },
    { a: 'acct-bo', k: 'camp', asks: 1, members: 5, bucket: 0, ceiling: 0 },
  ]);
  assert.equal(b.live, 21);
  const w = newGrantMeasure(now);
  foldGrantAsk(w, 'acct-ann', 'enc', 1, 'ceiling', 192);
  assert.deepEqual([...w.rows.values()][0], { a: 'acct-ann', k: 'enc', asks: 1, members: 1, bucket: 0, ceiling: 1 });
  let full = false;
  for (let i = 0; i < GRANT_MEASURE_ROWS && !full; i++) full = foldGrantAsk(w, `acct-${1000 + i}`, 'enc', 1, null, 1);
  assert.equal(w.rows.size, GRANT_MEASURE_ROWS, 'full at its bound');
  assert.equal(grantMeasureBatch(newGrantMeasure(now), 'a'.repeat(16), 'w:1:1', now), null, 'an empty window, no batch');
  for (const [why, bad] of [
    ['members past the asks\' most', { rows: [{ ...b.rows[0], members: 33 }] }], ['a refusal past the asks', { rows: [{ ...b.rows[0], bucket: 5, ceiling: 4 }] }],
    ['an unknown kind', { rows: [{ ...b.rows[0], k: 'raid' }] }], ['no rows', { rows: [] }], ['a window ending before it began', { from: now + 1 }],
    ['an account of bad shape', { rows: [{ ...b.rows[0], a: 'x' }] }], ['another version', { v: 'chat-feed1' }], ['an id of bad shape', { id: 'nope' }],
  ]) assert.equal(grantMeasureValid({ ...b, ...bad }), false, why);
});

test('GRANT2 THE DOOR: a window under the relay\'s key is kept, once; another key\'s is 401, a stale one 400, a misshapen one 400; a developer reads the measure - per kind, the windows, asks, members, refusals and an account\'s asks an hour - and the cells\' most live beside the ceiling; anyone else is refused (mutants: the signature unchecked; a batch kept twice)', async () => {
  const s = await standService({ DEVELOPER_HANDLES: 'Mac' });
  assert.ok(ROUTES.has(GRANT_FEED_PATH) && ROUTES.has('/v1/mod/realm-grants'));
  const now = Date.now();
  const b = window(now);
  const sealed = await sealGrantMeasure(b, s.gatePriv, { subtle });
  const post = (body, sig) => s.fetch(URL_, { method: 'POST', headers: { [GRANT_MEASURE_SIG_HEADER]: sig }, body });
  const first = await post(sealed.body, sealed.sig);
  assert.equal(first.status, 202);
  assert.deepEqual(await first.json(), { ok: true, read: true });
  assert.deepEqual(await (await post(sealed.body, sealed.sig)).json(), { ok: true, read: false }, 'kept once');
  const other = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const forged = await sealGrantMeasure(window(now), await importReceiptKey(Buffer.from(new Uint8Array(await subtle.exportKey('pkcs8', other.privateKey))).toString('base64'), { subtle }), { subtle });
  assert.equal((await post(forged.body, forged.sig)).status, 401, 'another key');
  const stale = await sealGrantMeasure(window(now - GRANT_MEASURE_AGE_MAX_MS - 60_000), s.gatePriv, { subtle });
  assert.equal((await post(stale.body, stale.sig)).status, 400, 'stale');
  assert.equal((await s.fetch(URL_, { method: 'GET' })).status, 405);
  // a second cell's window, quieter
  const quiet = window(now, 'world:26,9');
  quiet.rows = [quiet.rows[1]];
  quiet.live = 5;
  const q = await sealGrantMeasure(quiet, s.gatePriv, { subtle });
  assert.equal((await post(q.body, q.sig)).status, 202);
  const mac = await s.registered('Mac');
  const read = await s.call('/v1/mod/realm-grants', { days: 7 }, mac.secret);
  assert.equal(read.status, 200, JSON.stringify(read.body));
  const [enc, camp] = read.body.kinds;
  assert.deepEqual([enc.kind, enc.windows, enc.asks, enc.members, enc.bucket, enc.ceiling], ['enc', 1, 8, 16, 2, 0]);
  assert.deepEqual([camp.kind, camp.windows, camp.asks, camp.members], ['camp', 2, 2, 10]);
  const span = Math.max(GRANT_RATE_SPAN_MIN_S, 20 * 60);
  assert.equal(enc.perHour.most, Math.round(8 * 3600 / span), 'eight asks in twenty minutes: twenty-four an hour');
  assert.deepEqual([read.body.cells.windows, read.body.cells.live.most, read.body.cells.ceiling], [2, 21, GRANT_CELL_CEILING]);
  const ann = await s.registered('Ann');
  assert.equal((await s.call('/v1/mod/realm-grants', { days: 7 }, ann.secret)).status, 403, 'a developer\'s alone');
  assert.deepEqual(reviewRequest(['grants', '7']), { path: '/v1/mod/realm-grants', body: { days: 7 } });
  assert.deepEqual(reviewRequest(['grants']), { path: '/v1/mod/realm-grants', body: { days: 7 } });
  assert.match(USAGE, /realmReview\.mjs grants \[days\]/);
});
