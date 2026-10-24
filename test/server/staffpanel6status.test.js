// STAFF-PANEL6-STATUS (2026-10-22; design doc "DFO Staff Panel: design", build step 6) - THE PANEL'S SERVER STATUS, ITS
// ADMIN-SET LIMITS AND HOME (server-account/src/staffStatus.js), driven through the real Worker on the node:sqlite
// database every account pin stands on (test/accountDb.mjs): the tiles from what the game already records, kept for their
// windows; a tile amber or red only past a limit an Admin set; health red on a failed cron job, a relay or service that
// does not answer, or a failing reviewer; and Home's top of every watch the caller may see, worst first.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { standService } from '../accountDb.mjs';
import { staffWords, STAFF_SESSION_HEADER } from '../../server-account/src/staff.js';
import {
  STATUS_ROUTES, STATUS_METRICS, STATUS_FAST_S, STATUS_SLOW_S, STATUS_SLOW_MS, HOME_WATCHES, levelOf, homeOf, _resetStatusForTests, EG_LIVE_PATH as STATUS_EG_PATH,
} from '../../server-account/src/staffStatus.js';
import { HOME_WATCH as REPORTS_WATCH, AI_WAIT_S } from '../../server-account/src/staffCases.js';
import { STAFF_ROUTES } from '../../server-account/src/service.js';
import { SAFE_LAW_PATH } from '../../src/net/wire.js';
import { EG_LIVE_PATH } from '../../src/net/eliteGates/egDurable.js';
import { utcDay } from '../../src/net/marksLaw.js';

const { subtle } = globalThis.crypto;
const enc = new TextEncoder();
const nowS = () => Math.floor(Date.now() / 1000);
const PASSWORD = 'a good long one';
const RELAY = 'https://relay.example';
const ACCT = 'a'.repeat(32);
const b64url = (bytes) => Buffer.from(bytes).toString('base64url');

async function extensionKey() {
  const pair = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const pub = b64url(new Uint8Array(await subtle.exportKey('raw', pair.publicKey)));
  let last = 0;
  const proof = async (what, handle, ts = Math.max(nowS(), last + 1)) => {
    last = Math.max(last, ts);
    const sig = b64url(new Uint8Array(await subtle.sign({ name: 'Ed25519' }, pair.privateKey, enc.encode(staffWords(what, handle.toLowerCase(), ts)))));
    return { pub, ts, sig };
  };
  return { pub, proof };
}

/** The Worker with the panel set up: mob (an Admin and owner) and Asynian (a Moderator) signed in. `relay` answers the
 *  relay's public doors and `ae` the Analytics Engine SQL API (each `(url, init) => body` or a throw); every call is
 *  recorded in `asked`. */
async function stand(extra = {}) {
  _resetStatusForTests();
  const mobKey = await extensionKey();
  const s = await standService({
    DEVELOPER_HANDLES: 'Lattymoy,SirMcMobdon', MODERATOR_HANDLES: 'Asynian', OWNER_HANDLES: 'Lattymoy,SirMcMobdon',
    OWNER_KEYS: `SirMcMobdon:${mobKey.pub}`, RELAY_LAW_URL: RELAY + SAFE_LAW_PATH, ...extra,
  });
  const asked = [];
  const answers = {
    relay: (url) => (url.endsWith('/health') ? { ok: true, service: 'daggerfall-online', version: 'world245', t: Date.now() } : { live: 2, between: true, laws: [10], until: 0, drain: false }),
    ae: () => ({ data: [] }),
  };
  const real = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    const u = String(url);
    if (u.startsWith(RELAY)) { asked.push({ to: 'relay', url: u, init }); const b = answers.relay(u, init); return b instanceof Response ? b : Response.json(b); }
    if (u.startsWith('https://api.cloudflare.com/')) { asked.push({ to: 'ae', url: u, init }); const b = answers.ae(u, init); return b instanceof Response ? b : Response.json(b); }
    return real(url, init);
  };
  const staff = async (path, body = {}, token = null) => {
    const res = await s.fetch(`https://accounts.invalid${path}`, {
      method: 'POST', headers: { 'content-type': 'application/json', 'cf-connecting-ip': '203.0.113.1', ...(token ? { [STAFF_SESSION_HEADER]: token } : {}) }, body: JSON.stringify(body),
    });
    return { status: res.status, body: await res.json().catch(() => null) };
  };
  for (const h of ['SirMcMobdon', 'Asynian']) await s.registered(h);
  const raw = s.env.DB._raw;
  const mob = (await staff('/v1/staff/login', { handle: 'SirMcMobdon', password: PASSWORD, ...(await mobKey.proof('login', 'SirMcMobdon')) })).body;
  const inv = await staff('/v1/staff/invite', { handle: 'Asynian' }, mob.session);
  const key = await extensionKey();
  const asy = (await staff('/v1/staff/enroll', { handle: 'Asynian', password: PASSWORD, invite: inv.body.invite, ...(await key.proof('enroll', 'Asynian')) })).body;
  const audits = (act) => raw.prepare('SELECT * FROM staff_audit WHERE act = ? ORDER BY id').all(act);
  let n = 0;
  /** An open case on `who`, laid in by hand as safety.js lays one. */
  const caseOn = (who, cols = {}) => {
    const id = (++n).toString(16).padStart(16, 'c');
    const t = nowS();
    const row = { id, target: who.id, source: 'report', status: 'open', opened_at: t - 100 * n, updated_at: t, reports: 1, credible: 1, ai_state: 'off', discord_state: 'off', ...cols };
    raw.prepare(`INSERT INTO mod_cases (${Object.keys(row).join(', ')}) VALUES (${Object.keys(row).map(() => '?').join(', ')})`).run(...Object.values(row));
    return id;
  };
  return { ...s, raw, staff, mob, asy, answers, asked, audits, caseOn, restore: () => { globalThis.fetch = real; } };
}

/** Date.now moved `ms` on for `fn`. */
async function later(ms, fn) {
  const real = Date.now;
  Date.now = () => real() + ms;
  try { return await fn(); } finally { Date.now = real; }
}

const tileOf = (body, id) => body.tiles.find((t) => t.id === id);
const checkOf = (body, id) => tileOf(body, 'health').checks.find((c) => c.id === id);

test('STAFF-PANEL6-STATUS: the doors are listed among the staff panel\'s, and none opens without a staff session', async () => {
  for (const r of STATUS_ROUTES) assert.ok(STAFF_ROUTES.has(r), r);
  assert.equal(STATUS_EG_PATH, EG_LIVE_PATH, 'the relay\'s breach list, where the relay serves it');
  const s = await stand();
  try {
    for (const r of STATUS_ROUTES) assert.deepEqual([(await s.staff(r)).status, (await s.staff(r, {}, 'x'.repeat(43))).status], [401, 401], r);
  } finally { s.restore(); }
});

test('STAFF-PANEL6-STATUS: a value takes a limit\'s colour at or past its line, and no limit or no number is grey', () => {
  const both = { amber: 10, red: 20 };
  assert.equal(levelOf(9, both), 'grey');
  assert.equal(levelOf(10, both), 'amber', 'at the amber line');
  assert.equal(levelOf(19.5, both), 'amber');
  assert.equal(levelOf(20, both), 'red', 'at the red line');
  assert.equal(levelOf(1e9, both), 'red');
  assert.equal(levelOf(25, { amber: null, red: 20 }), 'red', 'red alone');
  assert.equal(levelOf(15, { amber: null, red: 20 }), 'grey');
  assert.equal(levelOf(15, { amber: 10, red: null }), 'amber', 'amber alone');
  assert.equal(levelOf(100, undefined), 'grey', 'no limit');
  assert.equal(levelOf(null, both), 'grey', 'no number is no colour (its tile says missing)');
  assert.equal(levelOf(0, { amber: 0, red: null }), 'amber', 'a line at 0');
  assert.equal(levelOf(null, { amber: 0, red: 0 }), 'grey', 'no number is no colour, even past a line at 0');
});

test('STAFF-PANEL6-STATUS: server status is the Admins\' - a Moderator is refused, and the refusal written down', async () => {
  const s = await stand();
  try {
    for (const path of ['/v1/staff/status', '/v1/staff/limit/set']) {
      const r = await s.staff(path, { metric: 'load.rps', amber: 1, red: 2 }, s.asy.session);
      assert.deepEqual([r.status, r.body], [403, { error: 'staff-admin' }], path);
    }
    const denied = s.audits('refused');
    assert.deepEqual(denied.map((a) => [a.outcome, JSON.parse(a.detail).path, a.role]), [['denied', '/v1/staff/status', 'moderator'], ['denied', '/v1/staff/limit/set', 'moderator']]);
    assert.equal(s.raw.prepare('SELECT COUNT(*) AS n FROM staff_limits').get().n, 0, 'nothing set');
    assert.equal(s.asked.length, 0, 'a refused read asks nothing');
    // the limits themselves every staff member may read
    const lim = await s.staff('/v1/staff/limits', {}, s.asy.session);
    assert.equal(lim.status, 200);
    assert.deepEqual([lim.body.limits, Object.keys(lim.body.metrics)], [{}, Object.keys(STATUS_METRICS)]);
  } finally { s.restore(); }
});

test('STAFF-PANEL6-STATUS: an Admin sets, moves and clears a limit, each written down with what it was; a bad one is refused and written down failed', async () => {
  const s = await stand();
  try {
    const set = (body) => s.staff('/v1/staff/limit/set', body, s.mob.session);
    assert.deepEqual((await set({ metric: 'activity.minted', amber: 100, red: 500 })).body, { ok: true, metric: 'activity.minted', amber: 100, red: 500 });
    assert.deepEqual((await set({ metric: 'activity.minted', amber: null, red: 400 })).body, { ok: true, metric: 'activity.minted', amber: null, red: 400 });
    let lim = (await s.staff('/v1/staff/limits', {}, s.asy.session)).body.limits;
    assert.deepEqual(lim['activity.minted'], { amber: null, red: 400, by: s.raw.prepare("SELECT id FROM players WHERE handle = 'SirMcMobdon'").get().id, byName: 'SirMcMobdon', at: lim['activity.minted'].at });
    for (const bad of [{ metric: 'activity.minted', amber: 5, red: 4 }, { metric: 'activity.minted', amber: -1 }, { metric: 'activity.minted', red: '9' },
      { metric: 'nope', red: 1 }, { metric: 'activity.minted', amber: [1] }, { amber: 1 }, { metric: 'toString', red: 1 }]) {
      const r = await set(bad);
      assert.deepEqual([r.status, r.body], [400, { error: 'body' }], JSON.stringify(bad));
    }
    lim = (await s.staff('/v1/staff/limits', {}, s.mob.session)).body.limits;
    assert.equal(lim['activity.minted'].red, 400, 'a refused set changed nothing');
    assert.deepEqual((await set({ metric: 'activity.minted', amber: null, red: null })).body, { ok: true, metric: 'activity.minted', amber: null, red: null });
    assert.deepEqual((await s.staff('/v1/staff/limits', {}, s.mob.session)).body.limits, {}, 'both lines none: the limit is gone');
    const rows = s.audits('limit-set').map((a) => [a.outcome, JSON.parse(a.detail)]);
    assert.deepEqual(rows.filter(([o]) => o === 'ok').map(([, d]) => d), [
      { metric: 'activity.minted', amber: 100, red: 500, was: null },
      { metric: 'activity.minted', amber: null, red: 400, was: { amber: 100, red: 500 } },
      { metric: 'activity.minted', amber: null, red: null, was: { amber: null, red: 400 } },
    ]);
    assert.equal(rows.filter(([o, d]) => o === 'failed' && d.error === 'body').length, 7, 'every refused set, failed');
  } finally { s.restore(); }
});

test('STAFF-PANEL6-STATUS: with no Analytics token the load says "not configured", never zero; players and activity come from the database, health from the relay', async () => {
  const s = await stand();
  try {
    const t = nowS();
    const ids = ['SirMcMobdon', 'Asynian'].map((h) => s.raw.prepare('SELECT id FROM players WHERE handle = ?').get(h).id);
    s.raw.prepare('UPDATE players SET played_at = ? WHERE id = ?').run(t - 30, ids[0]);
    s.raw.prepare('UPDATE players SET played_at = ? WHERE id = ?').run(t - 3600, ids[1]);   // long gone
    // the hour's activity: Marks minted and burned, a trade done, a guild's vault and store moves, a sale
    const line = (src, dst, amount, at, rid) => s.raw.prepare(`INSERT INTO marks_ledger (src_kind, src_id, dst_kind, dst_id, kind, amount, day, at, actor, who, rid)
      VALUES (?, ?, ?, ?, 'test', ?, ?, ?, ?, NULL, ?)`).run(src, src === 'mint' ? null : ids[0], dst, dst === 'burn' ? null : ids[0], amount, utcDay(at), at, ids[0], rid);
    line('mint', 'account', 70, t - 60, 'm1');
    line('mint', 'account', 5, t - 4000, 'm-old');   // past the hour
    line('account', 'burn', 30, t - 60, 'b1');
    s.raw.prepare("INSERT INTO realm_trades (sid, a_player, a_char, a_lease, a_seq, a_half, state, result, created_at) VALUES ('t1', ?, 'c', 'l', 1, 'h', 'done', '{}', ?)").run(ids[0], t - 60);
    s.raw.prepare("INSERT INTO realm_trades (sid, a_player, a_char, a_lease, a_seq, a_half, state, created_at) VALUES ('t2', ?, 'c', 'l', 1, 'h', 'waiting', ?)").run(ids[0], t - 60);
    s.raw.prepare("INSERT INTO guilds (id, name, name_key, tag, ranks, founded_at) VALUES ('g1', 'Guild', 'guild', 'GLD', '[]', 1)").run();
    s.raw.prepare("INSERT INTO guild_vault_log (guild_id, at, who, kind, name, count) VALUES ('g1', ?, 'x', 'put', 'a', 1), ('g1', ?, 'x', 'take', 'a', 1)").run(t - 60, t - 4000);
    s.raw.prepare("INSERT INTO guild_store_moves (player, rid, char_id, guild_id, kind, material, units, own, at, n) VALUES (?, 'r1', 'c', 'g1', 'deposit', 'iron', 3, 3, ?, 'n')").run(ids[0], t - 60);
    s.raw.prepare(`INSERT INTO market_sales (buyer, rid, char_id, listing, seller, kind, material, units, price, total, tax, from_region, to_region, arrives_at, at, day, n)
      VALUES (?, 's1', 'c', 'l1', ?, 'material', 'iron', 1, 5, 5, 0, 1, 1, ?, ?, ?, 'n')`).run(ids[0], ids[1], t, t - 60, utcDay(t - 60));

    const r = await s.staff('/v1/staff/status', {}, s.mob.session);
    assert.equal(r.status, 200, JSON.stringify(r.body));
    const { body } = r;
    assert.deepEqual(body.tiles.map((x) => x.id), ['players', 'load', 'activity', 'health']);
    assert.equal(body.level, 'grey', 'all well, no limits');
    const load = tileOf(body, 'load');
    assert.deepEqual([load.sources, load.values], [{ analytics: 'not-configured' }, { rps: null, slow: null, refused: null, errors: null, dbWait: null }]);
    const players = tileOf(body, 'players');
    assert.deepEqual(players.values, { registered: 1, tabs: null, breaches: 2 }, 'one at play; the breaches the relay\'s');
    assert.deepEqual(players.sources, { registered: 'ok', tabs: 'not-configured', breaches: 'ok', rooms: 'not-configured' });
    assert.deepEqual([players.rooms, players.unmeasured], [null, ['hub shards', 'layers', 'distinct accounts per room kind']]);
    assert.deepEqual(tileOf(body, 'activity').values, { listings: 0, sales: 1, vault: 1, store: 1, trades: 1, minted: 70, burned: 30 });
    const health = tileOf(body, 'health');
    assert.equal(health.level, 'grey');
    assert.deepEqual(health.checks.map((c) => [c.id, c.ok]), [['cron', null], ['relay', true], ['service', true], ['ai', null]]);
    assert.equal(checkOf(body, 'relay').version, 'world245');
    assert.deepEqual(s.asked.map((a) => a.url).sort(), [`${RELAY}/health`, `${RELAY}${EG_LIVE_PATH}`], 'the relay\'s two public doors, and no Analytics ask without a token');
  } finally { s.restore(); }
});

test('STAFF-PANEL6-STATUS: with the token, the load is read from Analytics Engine; a failed cron job turns health red', async () => {
  const s = await stand({ STAFF_ANALYTICS_TOKEN: 'tok-123', STAFF_ANALYTICS_ACCOUNT: ACCT });
  try {
    s.answers.ae = (url, init) => {
      const sql = String(init.body);
      if (sql.includes('daggerfall_relay')) return { data: [{ kind: 'world', sockets: 40 }, { kind: 'dungeon', sockets: '12' }, { kind: 'eg', sockets: 6 }, { kind: 'arena', sockets: 2 }] };
      if (sql.includes("blob2 = 'CRON'")) return { data: [{ job: 'cron:auctions', failed: 2 }, { job: 'cron:board', failed: 0 }] };
      return { data: [{ requests: 3000, slow: 52, r429: 10, r503: 5, r5xx: 15, d1_wait_ms: 60000, beats: 120 }] };
    };
    const { body } = await s.staff('/v1/staff/status', {}, s.mob.session);
    const ae = s.asked.filter((a) => a.to === 'ae');
    assert.equal(ae.length, 3, 'three questions');
    for (const a of ae) {
      assert.equal(a.url, `https://api.cloudflare.com/client/v4/accounts/${ACCT}/analytics_engine/sql`);
      assert.equal(a.init.headers.authorization, 'Bearer tok-123');
      assert.match(String(a.init.body), / FORMAT JSON$/);
    }
    assert.match(String(ae.find((a) => a.init.body.includes('requests')).init.body), new RegExp(`double1 >= ${STATUS_SLOW_MS}`));
    assert.deepEqual(tileOf(body, 'load').values, { rps: 10, slow: 10.4, refused: 3, errors: 2, dbWait: 20 }, '3000 in 5 min; 52 slow, 15 refused, 10 other 5xx a 5 min; 60 s of wait over 3000');
    const players = tileOf(body, 'players');
    assert.equal(players.values.tabs, 120);
    assert.deepEqual(players.rooms, { basis: '5-minute sockets', kinds: { world: 40, dungeon: 12, eg: 6, arena: 2 }, dungeons: 12, arenas: 2, breaches: 6 });
    const cron = checkOf(body, 'cron');
    assert.deepEqual([cron.ok, cron.why], [false, 'cron failed in the last hour: auctions']);
    assert.deepEqual([tileOf(body, 'health').level, body.level], ['red', 'red']);
  } finally { s.restore(); }
});

test('STAFF-PANEL6-STATUS: missing data is said so - an Analytics Engine or relay that does not answer is `missing`, and the relay not answering turns health red', async () => {
  const s = await stand({ STAFF_ANALYTICS_TOKEN: 'tok', STAFF_ANALYTICS_ACCOUNT: ACCT });
  try {
    s.answers.ae = () => new Response('no', { status: 500 });
    s.answers.relay = () => { throw new Error('down'); };
    const { body } = await s.staff('/v1/staff/status', {}, s.mob.session);
    assert.deepEqual(tileOf(body, 'load').sources, { analytics: 'missing' });
    assert.equal(tileOf(body, 'load').values.rps, null);
    assert.equal(tileOf(body, 'players').sources.breaches, 'missing');
    assert.equal(tileOf(body, 'players').values.breaches, null);
    assert.deepEqual([checkOf(body, 'relay').ok, checkOf(body, 'relay').why], [false, 'relay /health did not answer']);
    assert.equal(checkOf(body, 'cron').ok, null, 'a cron nobody could read is no verdict');
    assert.equal(tileOf(body, 'health').level, 'red');
  } finally { s.restore(); }
  // a relay that answers, but not ok
  const t = await stand();
  try {
    t.answers.relay = (url) => (url.endsWith('/health') ? { ok: false } : new Response('x', { status: 503 }));
    const { body } = await t.staff('/v1/staff/status', {}, t.mob.session);
    assert.deepEqual([checkOf(body, 'relay').ok, tileOf(body, 'health').level], [false, 'red']);
  } finally { t.restore(); }
  // the service's own database read failing is a service health failure
  const v = await stand();
  try {
    v.raw.exec('DROP TABLE mod_feed');
    const { body } = await v.staff('/v1/staff/status', {}, v.mob.session);
    assert.deepEqual([checkOf(body, 'service').ok, checkOf(body, 'service').why, tileOf(body, 'health').level], [false, 'the service\'s database read failed', 'red']);
    assert.deepEqual([tileOf(body, 'players').values.registered, tileOf(body, 'players').sources.registered], [null, 'missing']);
  } finally { v.restore(); }
  // an account named with no token asks nothing
  const w = await stand({ STAFF_ANALYTICS_ACCOUNT: ACCT });
  try {
    const { body } = await w.staff('/v1/staff/status', {}, w.mob.session);
    assert.equal(tileOf(body, 'load').sources.analytics, 'not-configured');
    assert.equal(w.asked.filter((a) => a.to === 'ae').length, 0);
  } finally { w.restore(); }
  // an account id that is not one never reaches the address
  const u = await stand({ STAFF_ANALYTICS_TOKEN: 'tok', STAFF_ANALYTICS_ACCOUNT: '../x' });
  try {
    const { body } = await u.staff('/v1/staff/status', {}, u.mob.session);
    assert.equal(tileOf(body, 'load').sources.analytics, 'not-configured');
    assert.equal(u.asked.filter((a) => a.to === 'ae').length, 0);
  } finally { u.restore(); }
});

test('STAFF-PANEL6-STATUS: the AI reviewer failing turns health red - a failed read on an open case, or a read waiting past AI_WAIT_S; with it off, no verdict', async () => {
  const ai = { MOD_AI: 'shadow', ANTHROPIC_API_KEY: 'k' };
  const s = await stand(ai);
  try {
    const p = await s.registered('Troll');
    // a closed case left 'due' is nobody's read: no failure
    s.caseOn(await s.registered('Old'), { status: 'dismissed', ai_state: 'due', updated_at: nowS() - 10 * AI_WAIT_S });
    let body = (await s.staff('/v1/staff/status', {}, s.mob.session)).body;
    assert.deepEqual([checkOf(body, 'ai').ok, tileOf(body, 'health').level], [true, 'grey'], 'a closed case waits on nothing');
    _resetStatusForTests();
    const id = s.caseOn(p, { ai_state: 'failed' });
    body = (await s.staff('/v1/staff/status', {}, s.mob.session)).body;
    assert.deepEqual([checkOf(body, 'ai').ok, checkOf(body, 'ai').failed, tileOf(body, 'health').level], [false, 1, 'red']);
    assert.match(checkOf(body, 'ai').why, /1 open case the AI check failed to read/);
    s.raw.prepare("UPDATE mod_cases SET ai_state = 'due', updated_at = ? WHERE id = ?").run(nowS() - AI_WAIT_S + 30, id);
    body = await later(STATUS_FAST_S * 1000, async () => (await s.staff('/v1/staff/status', {}, s.mob.session)).body);
    assert.deepEqual([checkOf(body, 'ai').ok, tileOf(body, 'health').level], [true, 'grey'], 'waiting, not yet late');
    s.raw.prepare('UPDATE mod_cases SET updated_at = ? WHERE id = ?').run(nowS() - AI_WAIT_S - 60, id);
    body = await later(2 * STATUS_FAST_S * 1000, async () => (await s.staff('/v1/staff/status', {}, s.mob.session)).body);
    assert.deepEqual([checkOf(body, 'ai').ok, tileOf(body, 'health').level], [false, 'red'], 'a case read waiting too long');
    s.raw.prepare("UPDATE mod_cases SET ai_state = 'done' WHERE id = ?").run(id);
    s.raw.prepare("INSERT INTO mod_feed (id, at, lines, state) VALUES ('f1', ?, '[]', 'due')").run(nowS() - AI_WAIT_S - 60);
    body = await later(3 * STATUS_FAST_S * 1000, async () => (await s.staff('/v1/staff/status', {}, s.mob.session)).body);
    assert.deepEqual([checkOf(body, 'ai').ok, tileOf(body, 'health').level], [false, 'red'], 'a feed batch waiting too long');
  } finally { s.restore(); }
  const off = await stand();
  try {
    off.caseOn(await off.registered('Troll'), { ai_state: 'failed' });
    const { body } = await off.staff('/v1/staff/status', {}, off.mob.session);
    assert.deepEqual([checkOf(body, 'ai').ok, checkOf(body, 'ai').why, tileOf(body, 'health').level], [null, 'reviewer off', 'grey']);
  } finally { off.restore(); }
});

test('STAFF-PANEL6-STATUS: each part is kept for its window - a poll in ten seconds asks nothing again, and a limit set shows at once', async () => {
  const s = await stand({ STAFF_ANALYTICS_TOKEN: 'tok', STAFF_ANALYTICS_ACCOUNT: ACCT });
  const real = Date.now, T0 = real();
  let off = 0;
  Date.now = () => T0 + off;   // the service's clock held still, then moved by whole seconds
  try {
    const status = () => s.staff('/v1/staff/status', { poll: true }, s.mob.session);
    const first = (await status()).body;
    const count = () => ({ health: s.asked.filter((a) => a.url.endsWith('/health')).length, ae: s.asked.filter((a) => a.to === 'ae').length, eg: s.asked.filter((a) => a.url.endsWith(EG_LIVE_PATH)).length });
    assert.deepEqual(count(), { health: 1, ae: 3, eg: 1 });
    const again = (await status()).body;
    assert.deepEqual(count(), { health: 1, ae: 3, eg: 1 }, 'kept');
    assert.equal(again.tiles[0].asOf, first.tiles[0].asOf);
    off = (STATUS_FAST_S - 1) * 1000;
    await status();
    assert.deepEqual(count(), { health: 1, ae: 3, eg: 1 }, 'still inside the window');
    off = STATUS_FAST_S * 1000;
    await status();
    assert.deepEqual(count(), { health: 2, ae: 3, eg: 1 }, 'the fast part read again at its window\'s end; the slow part kept');
    off = STATUS_SLOW_S * 1000;
    await status();
    assert.deepEqual(count(), { health: 3, ae: 6, eg: 2 }, 'the slow part at its own');
    // a limit set in this isolate shows on the next read, not STATUS_FAST_S on
    s.raw.prepare('UPDATE players SET played_at = ? WHERE handle IS NOT NULL').run(nowS());
    await s.staff('/v1/staff/limit/set', { metric: 'players.registered', amber: 1, red: 3 }, s.mob.session);
    const now = (await status()).body;
    assert.deepEqual([tileOf(now, 'players').level, tileOf(now, 'players').values.registered], ['amber', 2]);
  } finally { Date.now = real; s.restore(); }
});

test('STAFF-PANEL6-STATUS: a tile goes amber or red past the limits an Admin set, says why, and the worst tile is the status\'s', async () => {
  const s = await stand();
  try {
    const t = nowS();
    const id = s.raw.prepare("SELECT id FROM players WHERE handle = 'SirMcMobdon'").get().id;
    s.raw.prepare(`INSERT INTO marks_ledger (src_kind, src_id, dst_kind, dst_id, kind, amount, day, at, actor, who, rid) VALUES ('mint', NULL, 'account', ?, 'test', 900, ?, ?, ?, NULL, 'big')`).run(id, utcDay(t), t - 10, id);
    const set = (metric, amber, red) => s.staff('/v1/staff/limit/set', { metric, amber, red }, s.mob.session);
    await set('activity.minted', 500, 1000);
    let { body } = await s.staff('/v1/staff/status', {}, s.mob.session);
    let act = tileOf(body, 'activity');
    assert.deepEqual([act.level, act.why, body.level], ['amber', ['Marks minted, last hour: 900 (amber at 500)'], 'amber']);
    await set('activity.minted', 500, 900);
    body = (await s.staff('/v1/staff/status', {}, s.mob.session)).body;
    act = tileOf(body, 'activity');
    assert.deepEqual([act.level, act.why, body.level], ['red', ['Marks minted, last hour: 900 (red at 900)'], 'red']);
    await set('activity.burned', 0, null);   // a second metric amber does not lower a red tile
    body = (await s.staff('/v1/staff/status', {}, s.mob.session)).body;
    assert.equal(tileOf(body, 'activity').level, 'red');
    assert.equal(tileOf(body, 'activity').why.length, 2);
    // Home's status watch: the red tile, high
    const home = (await s.staff('/v1/staff/home', { n: 3 }, s.mob.session)).body;
    const w = home.watches.find((x) => x.id === 'status');
    assert.deepEqual([w.items, w.high, w.total], [[{ level: 'high', why: tileOf(body, 'activity').why.join(' · '), sub: null, name: 'Game activity, last hour' }], 1, 1]);
  } finally { s.restore(); }
});

test('STAFF-PANEL6-STATUS: HOME - the top n of each watch the caller may see, worst first, "N high of M", a failed watch said so (mutants: the order, the role, the cut)', async () => {
  const w = (id, role, levels, total = levels.length, high = levels.filter((l) => l === 'high').length) => ({
    id, label: id, role, top: async (_c, _e, _w, n) => ({ items: levels.slice(0, n).map((level, i) => ({ level, why: `${id} ${i}`, sub: `p${i}`, name: `P${i}` })), high, total }),
  });
  const boom = { id: 'boom', label: 'boom', role: 'moderator', top: async () => { throw new Error('no'); } };
  const list = [w('quiet', 'moderator', []), w('lows', 'moderator', ['low', 'low']), w('admins', 'admin', ['high', 'medium']), boom,
    w('highs', 'moderator', ['high', 'high', 'high', 'low'], 9, 5), w('one-high', 'moderator', ['high']),
    // a watch that answers its whole list, whatever n: Home cuts it
    { ...w('long', 'moderator', []), top: async () => ({ items: ['low', 'low', 'low', 'low', 'low'].map((level) => ({ level, why: '', sub: null, name: '' })), high: 0, total: 5 }) }];
  const admin = await homeOf({}, {}, { player: {}, role: 'admin' }, 3, list);
  assert.deepEqual(admin.watches.map((x) => x.id), ['highs', 'admins', 'one-high', 'boom', 'lows', 'long', 'quiet'], 'worst first; then most high; then the usual order');
  assert.deepEqual([admin.watches[5].items.length, admin.watches[5].more], [3, 2], 'a watch that answered too many is cut to n');
  const highs = admin.watches[0];
  assert.deepEqual([highs.items.length, highs.high, highs.total, highs.more], [3, 5, 9, 6], 'the top n, and how many wait behind');
  assert.deepEqual(highs.items[0], { level: 'high', why: 'highs 0', sub: 'p0', name: 'P0' });
  assert.deepEqual(admin.watches.find((x) => x.id === 'boom'), { id: 'boom', label: 'boom', items: [], high: 0, total: 0, more: 0, failed: true });
  const mod = await homeOf({}, {}, { player: {}, role: 'moderator' }, 10, list);
  assert.ok(!mod.watches.some((x) => x.id === 'admins'), 'an Admin\'s watch is not a Moderator\'s');
  assert.deepEqual(HOME_WATCHES.map((x) => [x.id, x.role]), [['reports', 'moderator'], ['economy', 'admin'], ['gains', 'admin'], ['contested', 'admin'], ['bursts', 'admin'], ['monsters', 'admin'], ['freeze', 'admin'], ['watchlist', 'moderator'], ['status', 'admin']]);   // every staff module's watch, the design's Home order (PIN MOVED, STAFF-PANEL5: the feeds' two and the freeze's)
  assert.equal(HOME_WATCHES[0], REPORTS_WATCH);
});

test('STAFF-PANEL6-STATUS: HOME through the Worker - the Reports watch ranked as the Reports list ranks it; a Moderator sees Reports and their own Watchlist only; the read written down once', async () => {
  const s = await stand();
  try {
    const a = await s.registered('Troll'), b = await s.registered('Sylvia'), c = await s.registered('Quiet');
    s.caseOn(c, { ai_state: 'off' });
    s.caseOn(a, { ai_state: 'done', ai_category: 'harassment', ai_severity: 3 });
    s.caseOn(b, { ai_state: 'failed' });
    const r = await s.staff('/v1/staff/home', {}, s.asy.session);
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.equal(r.body.n, 5, 'five unsaid');
    assert.deepEqual(r.body.watches.map((x) => x.id).sort(), ['reports', 'watchlist'], 'a Moderator: Reports and their own Watchlist only');
    const rep = r.body.watches[0];
    assert.deepEqual([rep.high, rep.total, rep.more], [2, 3, 0]);
    // two high: the older first (staffCases.js: inside a level, oldest first)
    assert.deepEqual(rep.items.map((i) => [i.level, i.sub, i.name]), [['high', b.id, 'Sylvia'], ['high', a.id, 'Troll'], ['low', c.id, 'Quiet']]);
    assert.deepEqual(rep.items.map((i) => i.why).slice(0, 2), ['1 reporter · AI check failed', '1 reporter · AI check: harassment, high'], 'the why, one line');
    const cases = (await s.staff('/v1/staff/cases', {}, s.asy.session)).body;
    assert.deepEqual([cases.high, cases.cases.map((x) => x.target)], [2, rep.items.map((i) => i.sub)], 'the same ranking as the Reports list');
    const one = (await s.staff('/v1/staff/home', { n: 3 }, s.mob.session)).body;
    assert.deepEqual(one.watches.map((x) => [x.id, x.items.length]), [['reports', 3], ['economy', 0], ['gains', 0], ['contested', 0], ['bursts', 0], ['monsters', 0], ['freeze', 0], ['watchlist', 0], ['status', 0]], 'an Admin: every watch, the quiet ones in their usual order (PIN MOVED, STAFF-PANEL5: the feeds\' two and the freeze\'s)');
    for (const n of [4, 0, '5', 100]) assert.deepEqual((await s.staff('/v1/staff/home', { n }, s.mob.session)).body, { error: 'body' }, String(n));
    await s.staff('/v1/staff/home', { n: 10 }, s.asy.session);
    const rows = s.audits('home-read');
    assert.deepEqual(rows.map((x) => [x.role, x.outcome]), [['moderator', 'ok'], ['admin', 'ok'], ['moderator', 'ok']], 'once a view a window: a new n is a new view');
    await s.staff('/v1/staff/home', { n: 10 }, s.asy.session);
    assert.equal(s.audits('home-read').length, 3, 'the same view again inside its window writes nothing');
    assert.equal(s.audits('cases-read').length, 1, 'Home\'s Reports write no cases-read of their own (only the list read above)');
  } finally { s.restore(); }
});
