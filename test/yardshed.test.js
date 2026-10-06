// YARD-SHED (2026-10-06, the account service down for everyone - "D1_ERROR: D1 DB is overloaded. Requests queued for too
// long."): the accounts database answered 17.4 million reads the day before, 3.0 million of them a town's yards (43 rows
// each) behind their callers' session and player rows, and in 45 s of the outage 577 of the 930 requests the Worker saw
// were `/v1/homes/yards`. A town's yards are every caller's alike: the service answers them before a session, from one
// isolate's kept answer (server-account/src/decor.js yardsKept), and the client asks a town only while one of its homes is
// within reach and backs off on each failure (src/scenes/homeYards.js). Each pin failed on the build before it.
// tools/mutants/yardshed.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { standService } from './accountDb.mjs';
import { yardsKept, forgetYards, _resetYardsKept, YARDS_KEPT_S } from '../server-account/src/decor.js';
import { ACCOUNT_MAX } from '../server-account/src/accounts.js';
import { createHomeYards, YARD_ASK_M, YARD_RETRY_MS, YARD_RETRY_MAX_MS, yardRetryMs } from '../src/scenes/homeYards.js';
import { fakeDoc, fakeWin, fakeBlocks, rmb, TOWN, settle } from './decorFakes.mjs';

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

/** The service's database, counting the statements it is asked. */
function counted(db) {
  const c = { n: 0 };
  const wrap = Object.create(db);
  wrap.prepare = (sql) => {
    const inner = db.prepare(sql);
    const api = {
      bind: (...a) => { inner.bind(...a); return api; },
      first: (...a) => { c.n++; return inner.first(...a); },
      all: (...a) => { c.n++; return inner.all(...a); },
      run: (...a) => { c.n++; return inner.run(...a); },
      _result: () => inner._result(),
    };
    return api;
  };
  wrap.batch = (list) => { c.n++; return db.batch(list); };
  return { db: wrap, c };
}

test('YARD-SHED the service: a town\'s yards are answered with no session at all, the second ask within YARDS_KEPT_S costs the database nothing, two asks at one moment share one read, a bad town is refused, and an address past ACCOUNT_MAX asks a window is told to wait - none of it a write (mutants: the door before the session, the kept answer, the shared ask, the address\'s count)', async () => {
  const svc = await standService();
  const { db, c } = counted(svc.env.DB);
  svc.env.DB = db;
  const first = await svc.call('/v1/homes/yards', { mapId: 7 });
  assert.equal(first.status, 200, 'no secret, no session: answered');
  assert.deepEqual(first.body, { mapId: 7, yards: [] });
  assert.equal(c.n, 1, 'one read - the town\'s yards, no session or player row');
  assert.deepEqual((await svc.call('/v1/homes/yards', { mapId: 7 }, 'not-a-secret')).body, { mapId: 7, yards: [] }, 'a secret that opens nothing changes nothing');
  assert.equal(c.n, 1, 'the second ask: the kept answer');
  c.n = 0;
  const both = await Promise.all([svc.call('/v1/homes/yards', { mapId: 9 }), svc.call('/v1/homes/yards', { mapId: 9 })]);
  assert.ok(both.every((r) => r.status === 200));
  assert.equal(c.n, 1, 'two at one moment: one read');
  assert.equal((await svc.call('/v1/homes/yards', { mapId: -3 })).status, 400, 'a town that is none');
  _resetYardsKept();
  c.n = 0;
  let limited = null;
  for (let i = 0; i < 2 * ACCOUNT_MAX + 10 && limited == null; i++) {   // two windows' worth, should the clock turn one mid-loop
    const r = await svc.call('/v1/homes/yards', { mapId: 11 });
    if (r.status === 429) limited = i;
  }
  assert.ok(limited != null && limited <= 2 * ACCOUNT_MAX, `the address told to wait once its window's asks are spent (at ${limited})`);
  assert.equal(c.n, 1, 'and its every ask but the first the kept answer - no read, no write to count it');
});

test('YARD-SHED the kept answer: kept YARDS_KEPT_S and asked again after, forgotten by a decor write here - an answer asked before that write never kept - and every decor route forgets its town (mutants: the age, the forgetting, the write count)', async () => {
  _resetYardsKept();
  let reads = 0, rows = [];
  const ctx = { db: { prepare: () => ({ bind: () => ({ all: async () => { reads++; return { results: rows }; } }) }) } };
  await yardsKept(ctx, 7, 1000);
  await yardsKept(ctx, 7, 1000 + YARDS_KEPT_S - 1);
  assert.equal(reads, 1, 'kept');
  await yardsKept(ctx, 7, 1000 + YARDS_KEPT_S);
  assert.equal(reads, 2, 'asked again once it is YARDS_KEPT_S old');
  forgetYards(7);
  await yardsKept(ctx, 7, 1000 + YARDS_KEPT_S);
  assert.equal(reads, 3, 'a write here: asked again at once');
  // an ask in flight across a write is answered but not kept
  let release;
  const slow = { db: { prepare: () => ({ bind: () => ({ all: () => new Promise((r) => { release = () => { reads++; r({ results: rows }); }; }) }) }) } };
  forgetYards(7);
  const flying = yardsKept(slow, 7, 2000);
  forgetYards(7);
  release();
  await flying;
  await yardsKept(ctx, 7, 2000);
  assert.equal(reads, 5, 'the answer asked before the write was not kept');
  assert.match(src('server-account/src/index.js'), /: await removeDecor\(hctx, who\.player, body\);\n\s+forgetYards\(body\?\.mapId\);/, 'every decor write forgets its town');
  rows = [];
});

/** A small world: town 7's homes by the player, town 8's far off; the yards asked counted by town. */
function world({ failing = () => false } = {}) {
  const asked = [];
  const clock = { t: 0 };
  const feet = { at: [18, 0, 10] };
  const near = new Map([[300, { at: [10, 0, 10], box: [6, 0, 7, 14, 6, 13] }]]);
  const far = new Map([[400, { at: [10, 0, 10], box: [6, 0, 7, 14, 6, 13] }]]);
  const built = new Map([['0,0', { px: 0, py: 0, homeTown: 7, homeFrames: near }], ['9,0', { px: 9, py: 0, homeTown: 8, homeFrames: far }]]);
  const api = {
    yards: async (mapId) => { asked.push(mapId); return failing(mapId) ? { ok: false } : { ok: true, data: { yards: [] } }; },
    place: async () => ({ ok: true, data: {} }), move: async () => ({ ok: true, data: {} }), remove: async () => ({ ok: true, data: {} }),
  };
  const yards = createHomeYards({
    api, homes: { homeAt: () => null }, built: () => built, translation: (px) => [px * 1000, 0, 0], feet: () => feet.at, outside: () => true,
    eye: () => [feet.at[0], 1.6, feet.at[2]], collider: () => ({ addMesh() {}, removeBucket() {}, surfaceHit: () => ({ dist: Infinity, normal: [0, 1, 0] }) }),
    meshes: { getGpuMesh: async (id) => id, cpuModels: new Map() }, renderer: { drawMesh() {}, createBillboardBatch: () => ({}), destroyBillboardBatch() {} },
    getTexture: async () => ({ recordCount: 1 }), uploadRecord() {},
    scanDeps: () => ({ blocks: fakeBlocks([{ type: TOWN, block: rmb([41000]) }]), isTownBlock: (x) => x === TOWN, modelRadius: () => 0.8, flatRadius: async () => 0.2 }),
    character: () => null, realm: () => null, wallet: () => null, regionOf: () => 17,
    doc: fakeDoc(), win: fakeWin(), canvas: null, touch: false, actionOf: () => null, locked: () => true, cursorOff() {}, stick: () => null,
    say() {}, refusal: (w) => w, openSlot() {}, now: () => clock.t,
  });
  const cam = { pos: [18, 1.6, 10], yaw: 0, pitch: 0 };
  const step = async (s) => { clock.t += s * 1000; yards.frame({ dt: s, cam, overlayUp: false }); await settle(); await settle(); };
  return { yards, asked, feet, clock, step };
}

test('YARD-SHED the client: a town is asked while one of its homes is within YARD_ASK_M of the player\'s feet - the streaming grid\'s far towns are not - and asked as the player comes within reach (mutants: the reach, the feet)', async () => {
  assert.ok(YARD_ASK_M > 300, 'beyond the draw distance, so a yard stands before it is in sight');
  const w = world();
  await w.step(1);
  assert.deepEqual(w.asked, [7], 'the town the player stands in, never the one 9 km off');
  w.feet.at = [9000 + 10 + YARD_ASK_M - 1, 0, 10];
  await w.step(1);
  assert.deepEqual(w.asked, [7, 8], 'within reach of its home: asked');
});

test('YARD-SHED the client\'s backoff: each failure in a row doubles a town\'s wait from YARD_RETRY_MS, to YARD_RETRY_MAX_MS - it was YARD_RETRY_MS every time, six times the asking of a database too slow to answer (mutants: the doubling, the cap, the count)', async () => {
  assert.deepEqual([1, 2, 3, 4].map(yardRetryMs), [YARD_RETRY_MS, 2 * YARD_RETRY_MS, 4 * YARD_RETRY_MS, 8 * YARD_RETRY_MS]);
  assert.equal(yardRetryMs(40), YARD_RETRY_MAX_MS);
  const w = world({ failing: (m) => m === 7 });
  const asksOf7 = () => w.asked.filter((m) => m === 7).length;
  await w.step(1);
  assert.equal(asksOf7(), 1);
  await w.step(YARD_RETRY_MS / 1000);
  assert.equal(asksOf7(), 2, 'the first wait');
  await w.step(YARD_RETRY_MS / 1000);
  assert.equal(asksOf7(), 2, 'the second failure: twice the wait');
  await w.step(YARD_RETRY_MS / 1000);
  assert.equal(asksOf7(), 3);
});
