// STAFF-PANEL5-FEEDS (2026-10-22, design doc "DFO Staff Panel: design": Network bursts, Monster watch, Bot check, Server
// load) - THE RELAY'S STAFF FEEDS, KEPT AND READ (server-account/src/staffNet.js, staffMonsters.js, staffReactions.js),
// driven through the real Worker on the node:sqlite database every account pin stands on (test/accountDb.mjs): the two
// doors in, by the relay's signature alone; Network bursts and Monster watch most urgent first, "not measured" while
// the batches say `ms` 0 (an older relay's, grantStrip off - STAFF-PANEL5-MONSTERS: a world248 relay always says 1); a Flag
// opening a case; a player's Reactions beside the population's, read in the audit log, kept as evidence; and the hourly
// sweeps.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { standService } from '../accountDb.mjs';
import { staffWords, STAFF_SESSION_HEADER } from '../../server-account/src/staff.js';
import { STAFF_ROUTES, ROUTES } from '../../server-account/src/service.js';
import { runCron, CRON_HOUR, HOUR_JOBS, SWEEP_ROWS, ROUNDS_MAX } from '../../server-account/src/cron.js';
import { NET_ROUTES, NET_FEED_PATH, STAFF_FEED_KEEP_S, HOME_WATCH as BURSTS, netUrgency, NET_REFUSED_HIGH } from '../../server-account/src/staffNet.js';
import { MONSTER_ROUTES, HOME_WATCH as OWNERS, askBudget, monsterUrgency } from '../../server-account/src/staffMonsters.js';
import { REACTION_ROUTES, REACTION_FEED_PATH, REACT_KEEP_S, REACT_ROWS_HOUR, REACT_PAGE, REACT_PATTERN, REACT_EVIDENCE_S, episodeRow, reactionSummary, _resetReactionsForTests } from '../../server-account/src/staffReactions.js';
import { sealStaffFeed, NET_FEED_V, REACT_FEED_V, STAFF_FEED_SIG_HEADER, STAFF_FEED_AGE_MAX_MS, FOE_HOT } from '../../server/src/staffFeedLaw.js';
import { importReceiptKey } from '../../src/net/gate/gateReceipt.js';
import { _resetKeyForTests } from '../../server-account/src/signing.js';

const { subtle } = globalThis.crypto;
const enc = new TextEncoder();
const nowS = () => Math.floor(Date.now() / 1000);
const PASSWORD = 'a good long one';
const b64url = (bytes) => Buffer.from(bytes).toString('base64url');
let ids = 0;
const hexId = () => (++ids).toString(16).padStart(16, '0');

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

/** The Worker with the panel set up: mob (an Admin) signed in, Asynian (a Moderator) signed in, and Troll, Sylvia and
 *  Grim, three players. */
async function stand() {
  _resetReactionsForTests();
  const mobKey = await extensionKey();
  const s = await standService({ DEVELOPER_HANDLES: 'SirMcMobdon', MODERATOR_HANDLES: 'Asynian', OWNER_HANDLES: 'SirMcMobdon', OWNER_KEYS: `SirMcMobdon:${mobKey.pub}` });
  const staff = async (path, body = {}, token = null) => {
    const res = await s.fetch(`https://accounts.invalid${path}`, {
      method: 'POST', headers: { 'content-type': 'application/json', 'cf-connecting-ip': '203.0.113.1', ...(token ? { [STAFF_SESSION_HEADER]: token } : {}) }, body: JSON.stringify(body),
    });
    return { status: res.status, body: await res.json().catch(() => null) };
  };
  for (const h of ['SirMcMobdon', 'Asynian']) await s.registered(h);
  const troll = await s.registered('Troll');
  const sylvia = await s.registered('Sylvia');
  const grim = await s.registered('Grim');
  const mob = (await staff('/v1/staff/login', { handle: 'SirMcMobdon', password: PASSWORD, ...(await mobKey.proof('login', 'SirMcMobdon')) })).body;
  const inv = await staff('/v1/staff/invite', { handle: 'Asynian' }, mob.session);
  const key = await extensionKey();
  const asy = (await staff('/v1/staff/enroll', { handle: 'Asynian', password: PASSWORD, invite: inv.body.invite, ...(await key.proof('enroll', 'Asynian')) })).body;
  assert.ok(asy.session, JSON.stringify(asy));
  /** A batch posted to a feed door, sealed as the relay seals it (or with `sig` in its place). */
  const post = async (path, batch, { key: k = s.gatePriv, sig = null } = {}) => {
    const sealed = await sealStaffFeed(batch, k, { subtle });
    assert.ok(sealed, 'the batch is one');
    const res = await s.fetch(`https://accounts.invalid${path}`, { method: 'POST', headers: { [STAFF_FEED_SIG_HEADER]: sig ?? sealed.sig }, body: sealed.body });
    return { status: res.status, body: await res.json().catch(() => null) };
  };
  const audits = (act) => s.env.DB._raw.prepare('SELECT actor_name, role, act, target, detail, outcome FROM staff_audit WHERE act = ? ORDER BY id').all(act).map((r) => ({ ...r }));
  return { ...s, staff, post, audits, mob: mob.session, asy: asy.session, troll, sylvia, grim, raw: s.env.DB._raw };
}

const netBatch = (o = {}) => ({ v: NET_FEED_V, id: hexId(), at: Date.now(), from: Date.now() - 600_000, q: 'cell:12,40', ms: 1, net: [], foe: [], ...o });
const netRow = (a, o = {}) => ({ a, n: 500, b: 50_000, p10: 450, pb10: 40_000, p60: 480, pb60: 45_000, k: [500, 0, 0, 0, 0, 0, 0], nr: 0, j: 0, c: 0, ...o });
const foeRow = (a, o = {}) => ({ a, o: 0, h: 0, r: 0, e: 0, bo: 0, s: 0, x: 0, ...o });
const reactBatch = (rows, o = {}) => ({ v: REACT_FEED_V, id: hexId(), at: Date.now(), q: 'cell:12,40', rows, ...o });
const episode = (a, o = {}) => ({ a, k: 'enc', n: 2, t: Date.now() - 70_000, ms: 60_000, ps: 300, w0: 0, mv: 50, tn: 314, p1: 200, wd: 500, ac: 900, hk: 1500, hu: 4000, ...o });

test('STAFF-PANEL5-FEEDS: the doors are listed once, the feeds behind no session, and the sweep keeps pace', () => {
  for (const r of [...NET_ROUTES, ...MONSTER_ROUTES, ...REACTION_ROUTES]) { assert.ok(STAFF_ROUTES.has(r), r); assert.ok(ROUTES.has(r), r); }
  assert.ok(ROUTES.has(NET_FEED_PATH) && !STAFF_ROUTES.has(NET_FEED_PATH), 'the net feed is the relay\'s door, never a staff session\'s');
  assert.ok(ROUTES.has(REACTION_FEED_PATH) && !STAFF_ROUTES.has(REACTION_FEED_PATH));
  assert.ok(REACT_ROWS_HOUR < SWEEP_ROWS * ROUNDS_MAX, 'an hour writes no more rows than an hour sweeps');
  assert.equal(REACT_KEEP_S, 14 * 86400);
  // a kind's budget: its burst and its rate over the hour
  assert.equal(askBudget('enc'), 66);
  assert.equal(askBudget('nothing'), 0);
  // the levels, pure
  assert.equal(netUrgency({ closes: 1, refused: 0, junk: 0, p10: 10 }).level, 'high');
  assert.equal(netUrgency({ closes: 0, refused: NET_REFUSED_HIGH, junk: 0, p10: 10 }).level, 'high');
  assert.equal(netUrgency({ closes: 0, refused: NET_REFUSED_HIGH - 1, junk: 0, p10: 10 }).level, 'medium');
  assert.equal(netUrgency({ closes: 0, refused: 0, junk: 1, p10: 10 }).level, 'medium');
  assert.equal(netUrgency({ closes: 0, refused: 0, junk: 0, p10: 10 }).level, 'low');
  const p = (o) => ({ stripped: 0, asks: [], others: { n: 0, readers: 0 }, live: null, hosted: 0, ...o });
  assert.equal(monsterUrgency(p({ hosted: 500 })).level, 'low', 'an indoor host alone is low, whatever N');
  assert.deepEqual(monsterUrgency(p({ hosted: 500 })).why, ['host of 500 monsters']);
  assert.equal(monsterUrgency(p({ live: { owned: FOE_HOT.own, elite: 0, boss: 0 } })).level, 'medium');
  assert.equal(monsterUrgency(p({ live: { owned: FOE_HOT.own - 1, elite: 0, boss: 0 } })).level, 'low');
  assert.equal(monsterUrgency(p({ stripped: 1 })).level, 'high');
  assert.equal(monsterUrgency(p({ asks: [{ kind: 'enc', asks: 67, budget: 66 }] })).level, 'medium');
  assert.equal(monsterUrgency(p({ asks: [{ kind: 'enc', asks: 66, budget: 66 }] })).level, 'low');
  assert.equal(monsterUrgency(p({ asks: [{ kind: 'enc', asks: 264, budget: 66 }] })).level, 'high');
  assert.equal(monsterUrgency(p({ others: { n: 5, readers: 3 } })).level, 'high');
  assert.equal(monsterUrgency(p({ others: { n: 5, readers: 2 } })).level, 'medium');
  // an episode as a row: struck before acting only by a blow taken before the first swing or cast
  assert.equal(episodeRow(episode('x')).struck, 0);
  assert.equal(episodeRow(episode('x', { hu: 800 })).struck, 1);
  assert.equal(episodeRow(episode('x', { ac: undefined })).struck, 1);
  assert.equal(episodeRow(episode('x', { hu: undefined })).struck, 0);
  assert.equal(episodeRow(episode('x', { hu: 900 })).struck, 0, 'a blow at the swing\'s own moment is not before it');
  assert.deepEqual([episodeRow(episode('x', { dd: 5000 })).dd_n, episodeRow(episode('x')).dd_n, episodeRow(episode('x', { wd: undefined })).wd_n], [1, 0, 0]);
  const sum = reactionSummary({ ...episodeRow(episode('x')), n: 2, ac: 1800, ac_n: 2, hk_n: 0, struck: 1, mv: 100, tn: 628 });
  assert.deepEqual([sum.actMs, sum.blowMs, sum.struckFirst, sum.movedM, sum.turnedDeg, sum.acted], [900, null, 0.5, 5, 180, 1]);
});

test('STAFF-PANEL5-FEEDS: the net feed is kept by the relay\'s signature alone, once', async () => {
  const s = await stand();
  const b = netBatch({ net: [netRow(s.troll.id)] });
  // another key, a broken signature, a stale batch, the wrong feed's batch at this door
  const other = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const otherKey = await importReceiptKey(Buffer.from(new Uint8Array(await subtle.exportKey('pkcs8', other.privateKey))).toString('base64'), { subtle });
  assert.equal((await s.post(NET_FEED_PATH, b, { key: otherKey })).status, 401);
  assert.equal((await s.post(NET_FEED_PATH, b, { sig: 'AAAA' })).status, 401);
  assert.equal((await s.post(NET_FEED_PATH, netBatch({ net: [netRow(s.troll.id)], at: Date.now() - STAFF_FEED_AGE_MAX_MS - 60_000, from: Date.now() - STAFF_FEED_AGE_MAX_MS - 120_000 }))).body.error, 'feed-stale');
  assert.equal((await s.post(NET_FEED_PATH, reactBatch([episode(s.troll.id)]))).status, 401, 'a reaction batch is never read as a net one');
  assert.equal(s.raw.prepare('SELECT COUNT(*) AS n FROM staff_net_rows').get().n, 0);
  const got = await s.post(NET_FEED_PATH, b);
  assert.equal(got.status, 202, JSON.stringify(got.body));
  assert.deepEqual(got.body, { ok: true, read: true });
  assert.deepEqual((await s.post(NET_FEED_PATH, b)).body, { ok: true, read: false }, 'a batch sent again under its id is read once');
  assert.equal(s.raw.prepare('SELECT COUNT(*) AS n FROM staff_net_rows').get().n, 1);
  // a GET, and a service with no relay key
  assert.equal((await s.fetch(`https://accounts.invalid${NET_FEED_PATH}`)).status, 405);
  delete s.env.GATE_PUBLIC_KEY;
  _resetKeyForTests();
  assert.equal((await s.post(NET_FEED_PATH, netBatch({ net: [netRow(s.troll.id)] }))).body.error, 'feed-closed');
});

test('STAFF-PANEL5-FEEDS: Network bursts - Admins alone, most urgent first, by window and kind, every read audited', async () => {
  const s = await stand();
  assert.equal((await s.staff('/v1/staff/net', {}, s.mob)).body.asOf, null, 'no window yet: no time, never "all quiet"');
  await s.post(NET_FEED_PATH, netBatch({ net: [
    netRow(s.sylvia.id, { n: 900, b: 900_000, p10: 600, pb10: 600_000, p60: 800, pb60: 800_000, k: [900, 0, 0, 0, 0, 0, 0] }),
    netRow(s.troll.id, { c: 1, w: 'too many poses', nr: 20, k: [400, 0, 0, 0, 0, 100, 0] }),
    netRow(s.grim.id, { nr: 3, j: 2 }),
  ] }));
  // the same player's other room in the same window is the same player
  await s.post(NET_FEED_PATH, netBatch({ q: 'cell:13,40', net: [netRow(s.grim.id, { n: 100, b: 1000, p10: 90, pb10: 900, p60: 95, pb60: 950, k: [100, 0, 0, 0, 0, 0, 0], nr: 1 })] }));
  // an older window of Grim's, within the read and past its newest's wave: not summed into it
  s.raw.prepare(`INSERT INTO staff_net_rows (batch, at, sub, frames, bytes, p10, pb10, p60, pb60, k_move, k_act, k_hit, k_trade, k_foe, k_chat, k_other, refused, junk, closes, close_why)
    VALUES ('old', ?, ?, 5000, 1, 1, 1, 1, 1, 5000, 0, 0, 0, 0, 0, 0, 0, 0, 0, NULL)`).run(nowS() - 900, s.grim.id);
  const mod = await s.staff('/v1/staff/net', {}, s.asy);
  assert.equal(mod.status, 403);
  assert.deepEqual(s.audits('refused').map((r) => [r.role, r.outcome, JSON.parse(r.detail).path]), [['moderator', 'denied', '/v1/staff/net']]);
  const r = await s.staff('/v1/staff/net', {}, s.mob);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.deepEqual(r.body.players.map((p) => [p.name, p.level]), [['Troll', 'high'], ['Grim', 'medium'], ['Sylvia', 'low']]);
  const grim = r.body.players[1];
  assert.deepEqual([grim.frames, grim.refused, grim.junk, grim.p10], [600, 4, 2, 450], 'its rooms together; the busiest 10 s the busiest room\'s');
  assert.equal(r.body.players[0].why[0], 'closed for too many poses');
  assert.deepEqual([r.body.total, r.body.high, r.body.next, r.body.windowS], [3, 1, null, 10]);
  assert.equal(r.body.players[2].perS.frames, 60);
  assert.ok(r.body.asOf > 0);
  // the minute, the ten minutes, one kind, the newest first
  assert.equal((await s.staff('/v1/staff/net', { window: '1m' }, s.mob)).body.players[2].perS.frames, 800 / 60);
  assert.equal((await s.staff('/v1/staff/net', { window: '10m' }, s.mob)).body.windowS, 600);
  assert.deepEqual((await s.staff('/v1/staff/net', { kind: 'chat' }, s.mob)).body.players.map((p) => p.name), ['Troll']);
  assert.equal((await s.staff('/v1/staff/net', { kind: 'nonsense', window: 'nonsense' }, s.mob)).body.total, 3);
  // read twice in its window: one row a window and view (onceIn)
  assert.deepEqual(s.audits('net-read').map((x) => JSON.parse(x.detail)), [{ window: '10s', kind: 'all' }, { window: '1m', kind: 'all' }, { window: '10m', kind: 'all' }, { window: '10s', kind: 'chat' }]);
  // the home roll-up's packet bursts
  const top = await BURSTS.top({ db: s.env.DB, nowS: nowS() }, s.env, { role: 'admin' }, 2);
  assert.deepEqual([top.items.map((i) => i.name), top.high, top.total], [['Troll', 'Grim'], 1, 3]);
  assert.ok(top.items[0].why.startsWith('closed for too many poses'));
  assert.deepEqual(await BURSTS.top({ db: s.env.DB, nowS: nowS() }, s.env, { role: 'moderator' }, 2), { items: [], high: 0, total: 0 });
});

test('STAFF-PANEL5-FEEDS: Monster watch - owners outdoors, hosts never owners, "not measured" while the batches say ms 0 (an older relay with grantStrip off), and a Flag', async () => {
  const s = await stand();
  assert.equal((await s.staff('/v1/staff/monsters', {}, s.mob)).body.monsters, 'no report');
  // an older relay's batch with grantStrip off: a window with no monsters read (a world248 relay always says ms 1)
  await s.post(NET_FEED_PATH, netBatch({ ms: 0, net: [netRow(s.grim.id, { nr: 1 })] }));
  assert.equal((await s.staff('/v1/staff/monsters', {}, s.mob)).body.monsters, 'not measured');
  await s.post(NET_FEED_PATH, netBatch({ foe: [
    foeRow(s.sylvia.id, { h: 120 }),
    foeRow(s.troll.id, { o: 40, r: 30, e: 6, bo: 2, s: 2 }),
    foeRow(s.grim.id, { x: 3 }),
  ] }));
  const now = nowS();
  // Sylvia asked well past her budget; another game refused Troll's monsters (the relay's own are its strips)
  s.raw.prepare("INSERT INTO grant_rows (batch, at, sub, kind, asks, members, bucket, ceiling, span_s) VALUES ('g1', ?, ?, 'enc', 300, 300, 0, 0, 600)").run(now - 60, s.sylvia.id);
  s.raw.prepare("INSERT INTO grant_rows (batch, at, sub, kind, asks, members, bucket, ceiling, span_s) VALUES ('g1', ?, ?, 'enc', 900, 900, 0, 0, 600)").run(now - 7200, s.grim.id);
  s.raw.prepare("INSERT INTO grant_tallies (batch, at, reader, sender, reason, n) VALUES ('g1', ?, ?, ?, 'stats', 4)").run(now - 60, s.grim.id, s.troll.id);
  s.raw.prepare("INSERT INTO grant_tallies (batch, at, reader, sender, reason, n) VALUES ('g1', ?, '~relay', ?, 'stats', 9)").run(now - 60, s.troll.id);
  assert.equal((await s.staff('/v1/staff/monsters', {}, s.asy)).status, 403);
  const r = await s.staff('/v1/staff/monsters', {}, s.mob);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.monsters, 'measured');
  assert.deepEqual(r.body.players.map((p) => [p.name, p.level]), [['Grim', 'high'], ['Sylvia', 'high'], ['Troll', 'medium']]);
  const [grim, sylvia, troll] = r.body.players;
  assert.equal(grim.stripped, 3);
  assert.deepEqual(grim.asks, [], 'an ask two hours old is no ask this hour');
  assert.deepEqual([sylvia.hosted, sylvia.live.owned, sylvia.asks], [120, 0, [{ kind: 'enc', asks: 300, budget: 66 }]]);
  assert.ok(sylvia.why.includes('host of 120 monsters'), sylvia.why.join());
  assert.ok(!sylvia.why.some((w) => w.startsWith('owns')), 'a host is never an owner');
  assert.deepEqual(troll.live, { owned: 40, regular: 30, elite: 6, boss: 2, sea: 2 });
  assert.deepEqual(troll.others, { n: 4, readers: 1 }, 'the relay\'s own refusals are its strips, not another game\'s');
  assert.deepEqual(s.audits('monsters-read').length, 1);
  const top = await OWNERS.top({ db: s.env.DB, nowS: nowS() }, s.env, { role: 'admin' }, 5);
  assert.deepEqual([top.items.map((i) => i.name), top.high, top.total], [['Grim', 'Sylvia', 'Troll'], 2, 3]);
  // THE FLAG: a case opened on the player, the line in its grant tab, the act audited with the case
  assert.equal((await s.staff('/v1/staff/monster/flag', { name: 'Troll' }, s.asy)).status, 403);
  assert.equal((await s.staff('/v1/staff/monster/flag', { name: 'Nobody' }, s.mob)).status, 404);
  const f = await s.staff('/v1/staff/monster/flag', { name: 'Troll', note: 'forty outdoors\u0007, two bosses' }, s.mob);
  assert.equal(f.status, 200, JSON.stringify(f.body));
  // one case, the spawn case an Admin reads (STAFF-PANEL2-FIX: a Moderator never sees it), the line in it
  const cs = s.raw.prepare('SELECT id, target, source, status, kind FROM mod_cases WHERE target = ?').all(s.troll.id);
  assert.deepEqual(cs.map((x) => ({ ...x })), [{ id: f.body.case, target: s.troll.id, source: 'review', status: 'open', kind: 'spawn' }]);
  const c = cs[0];
  const line = s.raw.prepare('SELECT tab, text FROM mod_case_lines WHERE case_id = ?').get(c.id);
  assert.equal(line.text, "flagged from the staff panel's Monster watch by SirMcMobdon: forty outdoors , two bosses");
  assert.deepEqual(s.audits('monster-flag').map((a) => [a.target, a.outcome, JSON.parse(a.detail)]), [[s.troll.id, 'ok', { name: 'Troll', note: 'forty outdoors , two bosses', case: c.id }]]);
  // STAFF-PANEL5-FEEDS-FIX: A FLAG INSIDE THE WINDOW OF A GRANT LINE WRITES ITS OWN, and touches the case (grantCaseLines'
  // one line a window is the automatic findings'); a line there this second already is said, never dropped
  s.raw.prepare('UPDATE mod_case_lines SET at = at - 60 WHERE case_id = ?').run(c.id);
  s.raw.prepare('UPDATE mod_cases SET updated_at = 0 WHERE id = ?').run(c.id);
  const again = await s.staff('/v1/staff/monster/flag', { name: 'Troll', note: 'spawning liches at the gate' }, s.mob);
  assert.deepEqual([again.status, again.body.case], [200, c.id], JSON.stringify(again.body));
  assert.deepEqual(s.raw.prepare('SELECT tab, text FROM mod_case_lines WHERE case_id = ? ORDER BY at').all(c.id).map((x) => [x.tab, x.text]), [
    ['grant', "flagged from the staff panel's Monster watch by SirMcMobdon: forty outdoors , two bosses"], ['grant', "flagged from the staff panel's Monster watch by SirMcMobdon: spawning liches at the gate"]]);
  assert.ok(s.raw.prepare('SELECT updated_at FROM mod_cases WHERE id = ?').get(c.id).updated_at > 0, 'the case touched');
  for (const at of [0, 1, 2]) s.raw.prepare("INSERT OR IGNORE INTO mod_case_lines (case_id, at, sub, name, tab, text) VALUES (?, ?, ?, 'Troll', 'grant', 'a finding')").run(c.id, nowS() + at, s.troll.id);
  const twice = await s.staff('/v1/staff/monster/flag', { name: 'Troll', note: 'once more' }, s.mob);
  assert.deepEqual([twice.status, twice.body.error], [500, 'flag-failed'], 'a line this second already');
  assert.equal(s.raw.prepare("SELECT COUNT(*) AS n FROM mod_case_lines WHERE text LIKE '%once more'").get().n, 0);
  assert.deepEqual(s.audits('monster-flag').map((a) => a.outcome), ['ok', 'ok', 'failed']);
  // a Flag whose case cannot open is audited failed, its error said
  s.raw.exec('DROP TABLE mod_case_lines');
  const bad = await s.staff('/v1/staff/monster/flag', { name: 'Sylvia' }, s.mob);
  assert.deepEqual([bad.status, bad.body.error], [500, 'flag-failed']);
  const failed = s.audits('monster-flag')[3];
  assert.deepEqual([failed.target, failed.outcome], [s.sylvia.id, 'failed']);
  assert.ok(JSON.parse(failed.detail).error, 'the error written down');
});

test('STAFF-PANEL5-FEEDS: the bot check - episodes kept once, a player beside the population, per played hour, kept as evidence', async () => {
  const s = await stand();
  const bad = await s.post(REACTION_FEED_PATH, reactBatch([episode(s.troll.id)]), { sig: 'AAAA' });
  assert.equal(bad.status, 401);
  const b = reactBatch([episode(s.troll.id), episode(s.troll.id, { ac: undefined, hk: undefined, hu: 1000, dd: 9000, w0: 1, wd: undefined }), episode(s.sylvia.id, { ac: 300, hk: 700 })]);
  const got = await s.post(REACTION_FEED_PATH, b);
  assert.equal(got.status, 202, JSON.stringify(got.body));
  assert.deepEqual(got.body, { ok: true, read: true, rows: 3 });
  assert.deepEqual((await s.post(REACTION_FEED_PATH, b)).body, { ok: true, read: false, rows: 0 });
  assert.equal(s.raw.prepare('SELECT COUNT(*) AS n FROM encounter_reactions').get().n, 3);
  assert.equal((await s.post(REACTION_FEED_PATH, netBatch({ net: [netRow(s.troll.id)] }))).status, 401, 'a net batch is never read as episodes');
  // three hours' Renown in two played hours
  s.raw.prepare("INSERT INTO progress_hours (player, stream, hour, amount, played_s) VALUES (?, 'renown', ?, 3000, 7200)").run(s.troll.id, nowS() - 7200);
  s.raw.prepare("INSERT INTO progress_hours (player, stream, hour, amount, played_s) VALUES (?, 'prof', ?, 99999, 99999)").run(s.troll.id, nowS() - 7200);
  assert.equal((await s.staff('/v1/staff/reactions', { name: 'Troll' }, s.asy)).status, 403);
  assert.equal((await s.staff('/v1/staff/reactions', { name: 'Nobody' }, s.mob)).status, 404);
  const r = await s.staff('/v1/staff/reactions', { name: 'Troll' }, s.mob);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  const me = r.body.player;
  assert.deepEqual([me.episodes, me.actMs, me.blowMs, me.takenMs, me.struckFirst, me.drawnAtAsk, me.died, me.acted], [2, 900, 1500, 2500, 0.5, 0.5, 0.5, 0.5]);
  assert.deepEqual([r.body.population.players, r.body.population.episodes, r.body.population.actMs, r.body.population.struckFirst], [2, 3, 600, 0.333]);
  assert.equal(r.body.pattern, false, `fewer than ${REACT_PATTERN} episodes are no pattern`);
  assert.deepEqual(r.body.perHour, { days: 14, playedH: 2, encounters: 2, renown: 3000, encountersPerH: 1, renownPerH: 1500 });
  assert.equal(r.body.episodes.length, 2);
  assert.equal(r.body.next, null);
  assert.deepEqual(s.audits('reactions-read').map((a) => [a.target, JSON.parse(a.detail).name]), [[s.troll.id, 'Troll']]);
  // the population's numbers are cached (Server load): a new episode is in them after REACT_POP_CACHE_S, not before
  await s.post(REACTION_FEED_PATH, reactBatch([episode(s.grim.id)]));
  assert.equal((await s.staff('/v1/staff/reactions', { name: 'Troll' }, s.mob)).body.population.episodes, 3);
  _resetReactionsForTests();
  assert.equal((await s.staff('/v1/staff/reactions', { name: 'Troll' }, s.mob)).body.population.episodes, 4);
  // a page of episodes, newest first, and the next one by its cursor
  const many = Array.from({ length: REACT_PAGE + 5 }, (_, i) => episode(s.sylvia.id, { ac: 100 + i }));
  await s.post(REACTION_FEED_PATH, reactBatch(many));
  const p1 = (await s.staff('/v1/staff/reactions', { name: 'Sylvia' }, s.mob)).body;
  assert.equal(p1.pattern, true);
  assert.deepEqual([p1.episodes.length, p1.episodes[0].actMs, p1.player.episodes], [REACT_PAGE, 100 + REACT_PAGE + 4, REACT_PAGE + 6]);
  const p2 = (await s.staff('/v1/staff/reactions', { name: 'Sylvia', before: p1.next }, s.mob)).body;
  assert.deepEqual([p2.episodes.length, p2.next, p2.episodes.at(-1).actMs], [6, null, 300]);
  // KEPT AS EVIDENCE: the account's rows past their 14 days, until let go
  assert.equal((await s.staff('/v1/staff/reactions/keep', { name: 'Troll', keep: true }, s.asy)).status, 403);
  const k = await s.staff('/v1/staff/reactions/keep', { name: 'Troll', keep: true }, s.mob);
  assert.deepEqual([k.body.rows, k.body.keptUntil - nowS() <= REACT_EVIDENCE_S, k.body.keptUntil - nowS() > REACT_EVIDENCE_S - 60], [2, true, true]);
  assert.deepEqual(s.audits('reactions-keep').map((a) => JSON.parse(a.detail)), [{ name: 'Troll', keep: true, rows: 2 }]);
  // THE SWEEP: past 14 days every episode goes but the kept ones; past the evidence's time they go too
  const sweep = (at) => runCron(s.env, { cron: CRON_HOUR, nowS: at, jobs: HOUR_JOBS.filter(([n]) => n === 'reactions') });
  const left = () => s.raw.prepare('SELECT sub, COUNT(*) AS n FROM encounter_reactions GROUP BY sub ORDER BY sub').all().map((x) => [x.sub, x.n]);
  assert.deepEqual((await sweep(nowS() + REACT_KEEP_S - 3600)).map((x) => [x.name, x.ok, x.changed]), [['reactions', true, 0]]);
  await sweep(nowS() + REACT_KEEP_S + 3600);
  assert.deepEqual(left(), [[s.troll.id, 2]]);
  await s.staff('/v1/staff/reactions/keep', { name: 'Troll', keep: false }, s.mob);
  await sweep(nowS() + REACT_KEEP_S + 3600);
  assert.deepEqual(left(), []);
});

test('STAFF-PANEL5-FEEDS: past an hour\'s rows, a player-hour is one row of sums', async () => {
  const s = await stand();
  const hour = nowS() - (nowS() % 3600);
  s.raw.prepare("INSERT INTO rate_limits (key, window_start, count) VALUES ('react-rows', ?, ?)").run(hour, REACT_ROWS_HOUR - 1);
  const t = Date.now() - 70_000;
  await s.post(REACTION_FEED_PATH, reactBatch([episode(s.troll.id, { t })]));   // the hour's last row of its own
  await s.post(REACTION_FEED_PATH, reactBatch([episode(s.troll.id, { t }), episode(s.troll.id, { t, ac: 1100, hu: 500 }), episode(s.sylvia.id, { t })]));
  await s.post(REACTION_FEED_PATH, reactBatch([episode(s.troll.id, { t, ac: 700 })]));
  const rows = s.raw.prepare('SELECT id, sub, n, ac, ac_n, struck, members FROM encounter_reactions ORDER BY rowid').all().map((x) => ({ ...x }));
  const askHour = Math.floor(t / 1000) - (Math.floor(t / 1000) % 3600);
  assert.equal(rows.length, 3);
  assert.deepEqual(rows[0].n, 1);
  assert.deepEqual(rows[1], { id: `h:${s.troll.id}:${askHour}`, sub: s.troll.id, n: 3, ac: 2700, ac_n: 3, struck: 1, members: 6 });
  assert.deepEqual([rows[2].id, rows[2].n], [`h:${s.sylvia.id}:${askHour}`, 1]);
  const r = (await s.staff('/v1/staff/reactions', { target: s.troll.id }, s.mob)).body;
  assert.deepEqual([r.player.episodes, r.player.actMs, r.player.struckFirst], [4, 900, 0.25], 'a player-hour reads as its episodes');
  assert.deepEqual([r.episodes[0].episodes, r.episodes[0].actMs], [3, 900]);
  // a new hour's window starts its count again
  s.raw.prepare("UPDATE rate_limits SET window_start = ? WHERE key = 'react-rows'").run(hour - 3600);
  await s.post(REACTION_FEED_PATH, reactBatch([episode(s.grim.id)]));
  assert.ok(s.raw.prepare('SELECT id FROM encounter_reactions WHERE sub = ?').get(s.grim.id).id.includes(':0'), 'a row of its own again');
  assert.equal(s.raw.prepare("SELECT count FROM rate_limits WHERE key = 'react-rows'").get().count, 1, 'the new hour counted from its own');
});

test('STAFF-PANEL5-FEEDS-FIX: a batch whose rows failed to write is kept whole when the relay sends it again under its id - the id, its rows and the hour\'s count in one transaction, at both doors (mutants: the id kept before its rows, alone; the hour\'s count kept before them; the net batch\'s id kept before its rows)', async () => {
  const s = await stand();
  const n = (t) => s.raw.prepare(`SELECT COUNT(*) AS n FROM ${t}`).get().n;
  const b = reactBatch([episode(s.troll.id), episode(s.sylvia.id)]);
  s.raw.exec("CREATE TRIGGER overloaded BEFORE INSERT ON encounter_reactions BEGIN SELECT RAISE(ABORT, 'D1 overloaded'); END");
  const failed = await s.post(REACTION_FEED_PATH, b);
  assert.ok(failed.status >= 500, `the relay keeps it to send again (${failed.status})`);
  assert.deepEqual([n('reaction_batches'), n('encounter_reactions'), n('rate_limits WHERE key = \'react-rows\'')], [0, 0, 0], 'nothing kept');
  s.raw.exec('DROP TRIGGER overloaded');
  assert.deepEqual((await s.post(REACTION_FEED_PATH, b)).body, { ok: true, read: true, rows: 2 }, 'sent again: read');
  assert.deepEqual([n('reaction_batches'), n('encounter_reactions'), s.raw.prepare("SELECT count FROM rate_limits WHERE key = 'react-rows'").get().count], [1, 2, 2], 'counted once');
  assert.deepEqual((await s.post(REACTION_FEED_PATH, b)).body, { ok: true, read: false, rows: 0 });
  // the net door alike
  const nb = netBatch({ net: [netRow(s.troll.id)], foe: [foeRow(s.troll.id, { h: 200 })] });
  s.raw.exec("CREATE TRIGGER overloaded BEFORE INSERT ON staff_foe_rows BEGIN SELECT RAISE(ABORT, 'D1 overloaded'); END");
  assert.ok((await s.post(NET_FEED_PATH, nb)).status >= 500);
  assert.deepEqual([n('staff_net_batches'), n('staff_net_rows')], [0, 0]);
  s.raw.exec('DROP TRIGGER overloaded');
  assert.deepEqual((await s.post(NET_FEED_PATH, nb)).body, { ok: true, read: true });
  assert.deepEqual([n('staff_net_batches'), n('staff_net_rows'), n('staff_foe_rows')], [1, 1, 1]);
  assert.deepEqual((await s.post(NET_FEED_PATH, nb)).body, { ok: true, read: false });
});

test('STAFF-PANEL5-FEEDS: the hourly sweep takes the feed\'s day and nothing newer', async () => {
  const s = await stand();
  await s.post(NET_FEED_PATH, netBatch({ net: [netRow(s.troll.id)], foe: [foeRow(s.troll.id, { h: 200 })] }));
  await s.post(REACTION_FEED_PATH, reactBatch([episode(s.troll.id)]));
  const count = () => ['staff_net_rows', 'staff_foe_rows', 'staff_net_batches', 'reaction_batches', 'encounter_reactions'].map((t) => s.raw.prepare(`SELECT COUNT(*) AS n FROM ${t}`).get().n);
  const sweep = (at) => runCron(s.env, { cron: CRON_HOUR, nowS: at, jobs: HOUR_JOBS.filter(([n]) => n === 'staff-feeds') });
  assert.deepEqual((await sweep(nowS() + STAFF_FEED_KEEP_S - 60)).map((x) => [x.name, x.ok, x.changed]), [['staff-feeds', true, 0]]);
  assert.deepEqual(count(), [1, 1, 1, 1, 1]);
  assert.deepEqual((await sweep(nowS() + STAFF_FEED_KEEP_S + 60)).map((x) => [x.name, x.ok, x.changed]), [['staff-feeds', true, 4]]);
  assert.deepEqual(count(), [0, 0, 0, 0, 1], 'the episodes keep their own 14 days');
});
