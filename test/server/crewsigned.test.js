// CREW-SIGNED (2026-10-27, the SEA-OPEN slice; bible/03-World/Shipyards.md CREW-SIGNED): a crew hall's recruit signed once
// online - the law both ends read (src/net/crewSignLaw.js), the service's routes over the real Worker and its database
// (server-account/src/crewSigns.js, migrations/0180), the clock's sweep (cron.js `crew-signs`) and the client's door
// (net/accountClient.js accountCrewSigns) through the same Worker. tools/mutants/seaopen.json (CREW-).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { standService, sessionStorageOf } from '../accountDb.mjs';
import { accountCrewSigns, SESSION_KEY } from '../../src/net/accountClient.js';
import { crewSignOf, crewDayAt, crewDayOk, CREW_SIGN_SLOTS, CREW_SIGN_DAY_MAX, CREW_SIGN_DAY_SPAN, CREW_SIGN_KEEP_DAYS } from '../../src/net/crewSignLaw.js';
import { RECRUITS_A_DAY, recruitsOf } from '../../src/systems/crewHall.js';
import { sharedClassicMinutes } from '../../src/net/wire.js';
import { runCron } from '../../server-account/src/cron.js';
import { ROUTES } from '../../server-account/src/service.js';
import { hostText } from '../hostText.mjs';

/** AUDIT HORIZONTAL G5: the service's clock held at one instant - a crew day turns every two real hours, and a test that
 *  read the wall clock and then asked the service across the turn found its day either side of the law. */
const AT_MS = Date.UTC(2026, 9, 27, 12, 30);
const atOneInstant = (t) => t.mock.method(Date, 'now', () => AT_MS);
import { readFileSync } from 'node:fs';

test('CREW-SIGNED the law: a recruit\'s id is his hall\'s town, day and slot - the hall\'s own ids read, nothing else; the day is the shared clock\'s, a day either side asked (mutants: the slots, the span, the shared day)', () => {
  assert.equal(CREW_SIGN_SLOTS, RECRUITS_A_DAY, 'a hall\'s sailors');
  for (const r of recruitsOf({ mapId: 4242, day: 31000, regionIndex: 17 })) assert.deepEqual(crewSignOf(r.id), { town: 4242, day: 31000, slot: Number(r.id.split(':')[2]) });
  assert.deepEqual(crewSignOf('4294967295:0:5'), { town: 4294967295, day: 0, slot: 5 });
  for (const bad of ['4242:31000:6', '4294967296:1:0', '4242:31000', '-1:3:0', '4242:31000:0:1', 'a:b:c', '', null, 42, '4242:31000:0 ']) assert.equal(crewSignOf(bad), null, String(bad));
  const ms = Date.UTC(2026, 9, 27, 12);
  assert.equal(crewDayAt(ms), Math.floor(sharedClassicMinutes(ms) / 1440));
  assert.equal(CREW_SIGN_DAY_SPAN, 1);
  const d = crewDayAt(ms);
  assert.deepEqual([d - 2, d - 1, d, d + 1, d + 2].map((x) => crewDayOk(x, ms)), [false, true, true, true, false]);
});

test('CREW-SIGNED the service: the first account to sign a recruit holds him for his day - asked again, the same; another is refused `crew-taken`; the hall says whose; a release by another lets nothing go, by the holder frees him; a bad id, a far day, a squatter refused (mutants: the holder unread, the release unowned, the cap, the day)', async (t) => {
  atOneInstant(t);   // PIN MOVED (AUDIT HORIZONTAL G5): one instant, the service's and the day's
  const S = await standService();
  const day = crewDayAt(Date.now());
  const a = await S.registered('Ashby'), b = await S.registered('Brannoc');
  const id = `4242:${day}:3`;
  // PIN MOVED (AUDIT HORIZONTAL C8): every ask names the character (`registered`'s own) - the hold is the character's
  const sign = (who, x) => S.call('/v1/crew/sign', { id: x, character: who.character }, who.secret);
  const hall = (who, q) => S.call('/v1/crew/hall', { ...q, character: who.character }, who.secret);
  const release = (who, x) => S.call('/v1/crew/release', { id: x, character: who.character }, who.secret);
  assert.ok(ROUTES.has('/v1/crew/sign') && ROUTES.has('/v1/crew/hall') && ROUTES.has('/v1/crew/release'));
  assert.deepEqual(await sign(a, id), { status: 200, body: { signed: true, fresh: true } });
  assert.deepEqual(await sign(a, id), { status: 200, body: { signed: true, fresh: false } }, 'asked again: his already');
  assert.deepEqual(await sign(b, id), { status: 409, body: { error: 'crew-taken' } });
  assert.deepEqual((await hall(b, { town: 4242, day })).body, { taken: [3], mine: [] });
  assert.deepEqual((await hall(a, { town: 4242, day })).body, { taken: [], mine: [3] });
  assert.deepEqual((await hall(a, { town: 4243, day })).body, { taken: [], mine: [] }, 'another town\'s hall');
  assert.deepEqual((await release(b, id)).body, { released: false }, 'not his to let go');
  assert.deepEqual(await sign(b, id), { status: 409, body: { error: 'crew-taken' } });
  assert.deepEqual((await release(a, id)).body, { released: true });
  assert.deepEqual(await sign(b, id), { status: 200, body: { signed: true, fresh: true } }, 'back at the hall, signed by the next');
  // a row another account holds, however it came there
  S.env.DB._raw.prepare('INSERT INTO crew_signed (town, day, slot, player, at) VALUES (?, ?, ?, ?, ?)').run(4242, day, 0, `${b.id}:${b.character}`, 1);
  assert.deepEqual(await sign(a, `4242:${day}:0`), { status: 409, body: { error: 'crew-taken' } });
  // the refusals
  for (const bad of ['4242:1:9', 'nope', `4242:${day}:6`]) assert.deepEqual(await sign(a, bad), { status: 400, body: { error: 'crew-bad' } }, bad);
  assert.deepEqual(await sign(a, `4242:${day + CREW_SIGN_DAY_SPAN + 1}:1`), { status: 400, body: { error: 'crew-day' } });
  assert.deepEqual(await sign(a, `4242:${day - CREW_SIGN_DAY_SPAN - 1}:1`), { status: 400, body: { error: 'crew-day' } });
  assert.equal((await sign(a, `4242:${day - CREW_SIGN_DAY_SPAN}:1`)).status, 200, 'yesterday\'s, a clock a little behind');
  assert.equal((await hall(a, { town: 4242, day: day + 5 })).body.error, 'crew-day');
  assert.equal((await S.call('/v1/crew/sign', { id, character: a.character }, null)).status, 401, 'behind a session');
  for (const character of [undefined, '', 'x', 'a:b', 42]) {
    assert.deepEqual(await S.call('/v1/crew/sign', { id: `4242:${day}:4`, character }, a.secret), { status: 400, body: { error: 'crew-bad' } }, `no character: ${String(character)}`);
  }
  // the squatter: CREW_SIGN_DAY_MAX a day, then refused - his own again still answered
  let n = 0;
  for (let town = 1; n < CREW_SIGN_DAY_MAX; town++) for (let slot = 0; slot < CREW_SIGN_SLOTS && n < CREW_SIGN_DAY_MAX; slot++, n++) assert.equal((await sign(a, `${town}:${day}:${slot}`)).status, 200);
  assert.deepEqual(await sign(a, `999:${day}:0`), { status: 429, body: { error: 'crew-many' } });
  assert.deepEqual(await sign(a, `1:${day}:0`), { status: 200, body: { signed: true, fresh: false } });
  assert.equal((await sign(b, `999:${day}:0`)).status, 200, 'another account\'s day its own');
});

test('CREW-SIGNED the sweep: the clock lets a row go CREW_SIGN_KEEP_DAYS (3, the record\'s) past its day, never sooner (mutants: the keep, G9 the keep\'s 3)', async () => {
  assert.equal(CREW_SIGN_KEEP_DAYS, 3, 'AUDIT HORIZONTAL G9: the record says three days');
  const S = await standService();
  const nowS = Math.floor(Date.now() / 1000), day = crewDayAt(nowS * 1000);
  const put = S.env.DB._raw.prepare('INSERT INTO crew_signed (town, day, slot, player, at) VALUES (?, ?, ?, ?, ?)');
  for (const [i, d] of [day, day - CREW_SIGN_KEEP_DAYS, day - CREW_SIGN_KEEP_DAYS - 1, day - 40].entries()) put.run(7, d, i, 'p', 1);
  const jobs = (await import('../../server-account/src/cron.js')).HOUR_JOBS.filter(([name]) => name === 'crew-signs');
  assert.equal(jobs.length, 1);
  const [r] = await runCron(S.env, { cron: 'x', nowS, jobs });
  assert.equal(r.ok, true);
  assert.equal(r.changed, 2);
  assert.deepEqual(S.env.DB._raw.prepare('SELECT day FROM crew_signed ORDER BY day DESC').all().map((x) => x.day), [day, day - CREW_SIGN_KEEP_DAYS]);
});

test('CREW-SIGNED the door (accountClient.js accountCrewSigns): the hall, a sign and a release through the real Worker behind the device\'s session (mutants: the routes)', async (t) => {
  atOneInstant(t);
  const S = await standService();
  const a = await S.registered('Corwen'), b = await S.registered('Dalla');
  const day = crewDayAt(Date.now());
  const doorOf = (who) => accountCrewSigns({ fetch: S.fetch, storage: sessionStorageOf(SESSION_KEY, who) });
  const A = doorOf(a), B = doorOf(b);
  const id = `77:${day}:2`;
  const said = async (p) => { const r = await p; return r.ok ? { ok: true, data: r.data } : { ok: false, error: r.error, status: r.status }; };
  const ca = a.character, cb = b.character;
  assert.deepEqual(await said(A.sign({ id, character: ca })), { ok: true, data: { signed: true, fresh: true } });
  assert.deepEqual(await said(B.sign({ id, character: cb })), { ok: false, error: 'crew-taken', status: 409 });
  assert.deepEqual(await said(B.hall({ town: 77, day, character: cb })), { ok: true, data: { taken: [2], mine: [] } });
  assert.deepEqual(await said(A.release({ id, character: ca })), { ok: true, data: { released: true } });
  assert.deepEqual(await said(B.hall({ town: 77, day, character: cb })), { ok: true, data: { taken: [], mine: [] } });
});

/** The service's database with every statement answered a macrotask later - a round trip, as D1's are. */
function latent(db) {
  const prep = db.prepare.bind(db), tick = () => new Promise((res) => setImmediate(res));
  db.prepare = (sql) => {
    const st = prep(sql);
    const api = { bind(...x) { st.bind(...x); return api; }, async first() { await tick(); return st.first(); }, async all() { await tick(); return st.all(); }, async run() { await tick(); return st.run(); } };
    return api;
  };
}

test('AUDIT HORIZONTAL C2: asked in parallel through the real Worker, each statement a round trip, an account holds CREW_SIGN_DAY_MAX and no more - the cap and the hold one statement (mutants: the cap)', async (t) => {
  atOneInstant(t);
  const S = await standService();
  const a = await S.registered('Squire');
  latent(S.env.DB);
  const day = crewDayAt(Date.now());
  const ids = [];
  for (let town = 1; town <= 6; town++) for (let slot = 0; slot < CREW_SIGN_SLOTS; slot++) ids.push(`${town}:${day}:${slot}`);
  const rs = await Promise.all(ids.map((id) => S.call('/v1/crew/sign', { id, character: a.character }, a.secret)));
  const by = {};
  for (const r of rs) by[r.status] = (by[r.status] ?? 0) + 1;
  assert.deepEqual(by, { 200: CREW_SIGN_DAY_MAX, 429: ids.length - CREW_SIGN_DAY_MAX });
  assert.ok(rs.filter((r) => r.status === 429).every((r) => r.body.error === 'crew-many'));
  assert.equal(S.env.DB._raw.prepare('SELECT COUNT(*) AS n FROM crew_signed WHERE day = ?').get(day).n, CREW_SIGN_DAY_MAX);
});

test('AUDIT HORIZONTAL C8: the hold is the CHARACTER\'s - an account\'s second character is refused a man its first holds and sees him taken; the holder\'s pay-off lets him go, the other\'s lets nothing go; the day\'s cap is the account\'s across its characters (mutants: the holder an account, the cap a character\'s)', async (t) => {
  atOneInstant(t);
  const S = await standService();
  const a = await S.registered('Hollis'), c = await S.registered('Merrow');
  const day = crewDayAt(Date.now());
  const as = (character) => ({ ...a, character });
  const one = as('hollis-one'), two = as('hollis-two');
  const sign = (who, id) => S.call('/v1/crew/sign', { id, character: who.character }, who.secret);
  const id = `31:${day}:1`;
  assert.deepEqual(await sign(one, id), { status: 200, body: { signed: true, fresh: true } });
  assert.deepEqual(await sign(two, id), { status: 409, body: { error: 'crew-taken' } }, 'the account\'s other character');
  assert.deepEqual((await S.call('/v1/crew/hall', { town: 31, day, character: two.character }, a.secret)).body, { taken: [1], mine: [] });
  assert.deepEqual((await S.call('/v1/crew/hall', { town: 31, day, character: one.character }, a.secret)).body, { taken: [], mine: [1] });
  assert.deepEqual((await S.call('/v1/crew/release', { id, character: two.character }, a.secret)).body, { released: false }, 'not the other\'s to let go');
  assert.deepEqual(await sign(c, id), { status: 409, body: { error: 'crew-taken' } }, 'still held');
  assert.deepEqual((await S.call('/v1/crew/release', { id, character: one.character }, a.secret)).body, { released: true });
  assert.deepEqual(await sign(c, id), { status: 200, body: { signed: true, fresh: true } }, 'paid off by his holder: the next account\'s');
  // the cap: the account's, whichever of its characters asks
  let n = 0;
  for (let town = 100; n < CREW_SIGN_DAY_MAX; town++) for (let slot = 0; slot < CREW_SIGN_SLOTS && n < CREW_SIGN_DAY_MAX; slot++, n++) assert.equal((await sign(n % 2 ? one : two, `${town}:${day}:${slot}`)).status, 200);
  assert.deepEqual(await sign(as('hollis-three'), `999:${day}:0`), { status: 429, body: { error: 'crew-many' } });
});

test('AUDIT HORIZONTAL C8 the wiring: the world host hands the shipmaster its character\'s id while in the shared world, and the shipmaster\'s own book asks as it (mutants: the character unhanded, the host\'s book unaimed)', () => {
  assert.match(hostText('src/scenes/world.js'), /online: \(\) => _onlineWorldSession\(\) && characterIdOf\(playerEntity\),/);
  const yard = readFileSync(new URL('../../src/scenes/shipyardHost.js', import.meta.url), 'utf8');
  assert.match(yard, /createCrewSignBook\(\{ live: \(\) => !!deps\.online\?\.\(\), character: \(\) => deps\.online\?\.\(\) \|\| null \}\)/);
});
