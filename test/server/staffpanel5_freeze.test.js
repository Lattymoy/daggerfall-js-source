// STAFF-PANEL5-FREEZE (2026-10-22, mob: "the player can only look around"; design doc "DFO Staff Panel: design", Freeze
// player, and its weak spots) - FREEZE PLAYER AND THE STAFF CHAT, the account service's half (server-account/src/
// staffFreeze.js), driven through the real Worker on the node:sqlite database every account pin stands on
// (test/accountDb.mjs): an Admin's freeze with its reason, who set it and its order to the relay, the token's `fz`, ONE
// GATE that a modded client calling the service's doors itself still meets, the checkpoint and the beat under a pass
// minted before it, a fall and a market buy that name a frozen account, the staff chat stored here first, and a failed
// push said and tried again. The relay's half: test/net/staffpanel5_freeze_relay.test.js.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { standService, T0 } from '../accountDb.mjs';
import { seatRealm, freshSave, holdPieces } from '../realmSeat.mjs';
import { staffWords, STAFF_SESSION_HEADER } from '../../server-account/src/staff.js';
import {
  FREEZE_ROUTES, STAFF_CHAT_ROUTES, FREEZE_ALLOWED, FREEZE_MINUTES_MAX, FREEZES_PAGE, CHAT_PAGE, PLAYER_LINES_MAX, STAFF_LINES_KEEP_S,
  PUSH_RETRY_AFTER_S, HOME_WATCH, discordInvite, freezeRefusal, retryFreezePushes, sweepStaffChat, pushFreeze,
} from '../../server-account/src/staffFreeze.js';
import { ROUTES, STAFF_ROUTES, OPEN_ROUTES, PATREON_OPEN_ROUTES, SAFE_OPEN_ROUTES } from '../../server-account/src/service.js';
import { MINUTE_JOBS, HOUR_JOBS, runCron, CRON_MINUTE } from '../../server-account/src/cron.js';
import { verifyOrder, tokenBodyOf } from '../../src/net/identityToken.js';
import { mintWildReceipt } from '../../src/net/wild/wildReceipt.js';
import { SAFE_LAW_PATH, worldRoom } from '../../src/net/wire.js';
import { SESSION_PASS_HEADER } from '../../src/net/sessionPassLaw.js';

const { subtle } = globalThis.crypto;
const enc = new TextEncoder();
let _now = T0;
const realNow = Date.now;
Date.now = () => _now * 1000;
test.after(() => { Date.now = realNow; });
const nowS = () => _now;
const PASSWORD = 'a good long one';
const RELAY = 'https://relay.example' + SAFE_LAW_PATH;
const INVITE = 'https://discord.gg/QADbZYQ73j';
const b64url = (bytes) => Buffer.from(bytes).toString('base64url');
const DF = 17;
const HUBS = { [DF]: [207, 212] };
const PV = 'f5f5f5f5f5f5f5f0';
const CELL = worldRoom(400, 120);
let _rid = 0;
const rid = () => `sp5fz-${String(++_rid).padStart(10, '0')}`;

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

/** The Worker with the panel set up and the relay's door recorded (staffpanel2's stand): mob an Admin, Asynian a Moderator,
 *  and Troll and Sylvia, two players; the market's switches on. `s.relayDown(true)` makes the door fail. */
async function stand() {
  const mobKey = await extensionKey();
  const s = await standService({
    DEVELOPER_HANDLES: 'Lattymoy,SirMcMobdon', MODERATOR_HANDLES: 'Asynian', OWNER_HANDLES: 'Lattymoy,SirMcMobdon',
    OWNER_KEYS: `SirMcMobdon:${mobKey.pub}`, RELAY_LAW_URL: RELAY, DISCORD_INVITE_URL: INVITE,
    PROFESSIONS_OPEN: 'on', MARKS_OPEN: 'on', BOARD_OPEN: 'on',
  });
  const pushed = [];
  let down = false;
  const real = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    if (String(url) !== RELAY) return real(url, init);
    if (down) return new Response('no', { status: 503 });
    pushed.push(JSON.parse(init.body).order);
    return Response.json({ ok: true });
  };
  const staff = async (path, body = {}, token = null) => {
    const res = await s.fetch(`https://accounts.invalid${path}`, {
      method: 'POST', headers: { 'content-type': 'application/json', 'cf-connecting-ip': '203.0.113.1', ...(token ? { [STAFF_SESSION_HEADER]: token } : {}) }, body: JSON.stringify(body),
    });
    return { status: res.status, body: await res.json().catch(() => null) };
  };
  /** A game request as a page (or a modded client) makes it: `{ status, body, pass }`. */
  const ask = async (method, path, secret, body = {}, { pass = null, headers = {} } = {}) => {
    const res = await s.fetch(`https://accounts.invalid${path}`, {
      method, headers: { 'content-type': 'application/json', authorization: `Bearer ${secret}`, ...(pass ? { [SESSION_PASS_HEADER]: pass } : {}), ...headers },
      body: method === 'GET' ? undefined : JSON.stringify(body),
    });
    return { status: res.status, body: await res.json().catch(() => null), pass: res.headers.get(SESSION_PASS_HEADER) };
  };
  for (const h of ['SirMcMobdon', 'Asynian']) await s.registered(h);
  const troll = await s.registered('Troll');
  const sylvia = await s.registered('Sylvia');
  const raw = s.env.DB._raw;
  const mob = (await staff('/v1/staff/login', { handle: 'SirMcMobdon', password: PASSWORD, ...(await mobKey.proof('login', 'SirMcMobdon')) })).body;
  const inv = await staff('/v1/staff/invite', { handle: 'Asynian' }, mob.session);
  const asyKey = await extensionKey();
  const asy = (await staff('/v1/staff/enroll', { handle: 'Asynian', password: PASSWORD, invite: inv.body.invite, ...(await asyKey.proof('enroll', 'Asynian')) })).body;
  assert.ok(asy.session, 'the Moderator signed in');
  const idOf = (h) => raw.prepare('SELECT id FROM players WHERE handle = ?').get(h).id;
  const row = (id) => ({ ...raw.prepare('SELECT frozen_until, frozen_reason, frozen_by, frozen_at, freeze_rev, freeze_live FROM players WHERE id = ?').get(id) });
  const thread = (id) => { const t = raw.prepare('SELECT * FROM staff_chat_threads WHERE player = ?').get(id); return t ? { ...t } : null; };
  const audits = (act) => raw.prepare('SELECT role, act, target, outcome, detail FROM staff_audit WHERE act = ? ORDER BY id').all(act).map((r) => ({ ...r, detail: JSON.parse(r.detail ?? 'null') }));
  const freeze = (who, extra = {}, token = mob.session) => staff('/v1/staff/freeze', { target: who.id, minutes: 60, reason: 'botting in Daggerfall', ...extra }, token);
  const said = (path, who, body = {}) => s.call(path, body, who.secret);
  return { ...s, raw, staff, ask, mob, asy, troll, sylvia, idOf, row, thread, audits, freeze, said, pushed, relayDown: (v) => { down = v; }, restore: () => { globalThis.fetch = real; } };
}

test('STAFF-PANEL5-FREEZE: the doors are listed - the panel\'s among the staff panel\'s, none open without a staff session; the player\'s own among the game\'s, behind its session; the clocks\' jobs named', async () => {
  for (const r of FREEZE_ROUTES) assert.ok(STAFF_ROUTES.has(r), r);
  for (const r of STAFF_CHAT_ROUTES) assert.ok(ROUTES.has(r) && !OPEN_ROUTES.has(r), r);
  assert.ok(HOUR_JOBS.some(([n]) => n === 'staff-chat'), 'the hour\'s sweep');
  const s = await stand();
  try {
    for (const r of FREEZE_ROUTES) {
      assert.deepEqual([(await s.staff(r, { target: s.troll.id })).status], [401], r);
      assert.equal((await s.staff(r, { target: s.troll.id }, s.troll.secret)).status, 401, `${r}: a game secret is no staff session`);
    }
    for (const r of STAFF_CHAT_ROUTES) assert.equal((await s.call(r, {})).status, 401, `${r}: behind the game's session`);
  } finally { s.restore(); }
});

test('STAFF-PANEL5-FREEZE: FREEZE IS AN ADMIN\'S ALONE - a Moderator is refused freeze, unfreeze, the list and a push again, each refusal written down; Talk, a thread read, a line and the open threads are both roles\' (mutants: the role unread; the refusal unwritten)', async () => {
  const s = await stand();
  try {
    for (const r of ['/v1/staff/freeze', '/v1/staff/unfreeze', '/v1/staff/freezes', '/v1/staff/freeze-push']) {
      const res = await s.staff(r, { target: s.troll.id, minutes: 60, reason: 'x' }, s.asy.session);
      assert.deepEqual([res.status, res.body], [403, { error: 'staff-admin' }], r);
    }
    assert.equal(s.row(s.troll.id).frozen_until, null, 'nothing frozen');
    const refused = s.audits('refused');
    assert.equal(refused.length, 4);
    assert.deepEqual([refused[0].role, refused[0].outcome, refused[0].detail], ['moderator', 'denied', { path: '/v1/staff/freeze', need: 'admin' }]);
    assert.equal((await s.staff('/v1/staff/talk', { target: s.sylvia.id }, s.asy.session)).status, 200);
    assert.equal((await s.staff('/v1/staff/chat', { target: s.sylvia.id }, s.asy.session)).status, 200);
    assert.equal((await s.staff('/v1/staff/chat-send', { target: s.sylvia.id, text: 'hello' }, s.asy.session)).status, 200);
    assert.equal((await s.staff('/v1/staff/chats', {}, s.asy.session)).status, 200);
    assert.equal((await s.staff('/v1/staff/chat-close', { target: s.sylvia.id }, s.asy.session)).status, 200);
  } finally { s.restore(); }
});

test('STAFF-PANEL5-FREEZE: A FREEZE - its minutes, its reason, never staff and never yourself, each refusal written down as failed; made, it is kept with who set it, its order (`freeze`, `fz` its end) pushed and marked live, its thread opened with the player in it, the act audited; the unfreeze lifts it (`fz` 0) and closes the thread (mutants: each check; the order\'s end; the thread unopened; the unfreeze\'s close)', async () => {
  const s = await stand();
  try {
    const bad = async (body, error, status = 400, who = s.troll) => {
      const r = await s.freeze(who, body);
      assert.deepEqual([r.status, r.body], [status, { error }], JSON.stringify(body));
    };
    await bad({ minutes: 0 }, 'bad-minutes');
    await bad({ minutes: FREEZE_MINUTES_MAX + 1 }, 'bad-minutes');
    await bad({ minutes: '60' }, 'bad-minutes');
    await bad({ reason: '' }, 'bad-reason');
    await bad({}, 'staff-self', 409, { id: s.idOf('SirMcMobdon') });
    await bad({}, 'protected', 403, { id: s.idOf('Asynian') });
    const un = await s.staff('/v1/staff/unfreeze', { target: s.troll.id }, s.mob.session);
    assert.deepEqual([un.status, un.body], [409, { error: 'not-frozen' }]);
    assert.deepEqual(s.audits('freeze').map((a) => [a.outcome, a.detail.error]), [['failed', 'bad-minutes'], ['failed', 'bad-minutes'], ['failed', 'bad-minutes'], ['failed', 'bad-reason'], ['failed', 'staff-self'], ['failed', 'protected']]);
    assert.deepEqual(s.audits('unfreeze').map((a) => [a.outcome, a.detail.error]), [['failed', 'not-frozen']]);
    assert.equal(s.pushed.length, 0, 'nothing pushed for a refusal');

    const until = nowS() + FREEZE_MINUTES_MAX * 60;
    const f = await s.freeze(s.troll, { minutes: FREEZE_MINUTES_MAX });
    assert.equal(f.status, 200, JSON.stringify(f.body));
    assert.deepEqual(f.body, { ok: true, target: s.troll.id, name: 'Troll', until, reason: 'botting in Daggerfall', live: true });
    assert.deepEqual(s.row(s.troll.id), { frozen_until: until, frozen_reason: 'botting in Daggerfall', frozen_by: s.idOf('SirMcMobdon'), frozen_at: nowS(), freeze_rev: 1, freeze_live: 1 });
    const v = await verifyOrder(s.pushed[0], s.identityPublic, { subtle, nowS: nowS(), kind: 'freeze' });
    assert.ok(v.ok, v.why);
    assert.deepEqual([v.claims.s, v.claims.fz], [s.troll.id, until]);
    const a = s.audits('freeze').at(-1);
    assert.deepEqual([a.role, a.target, a.outcome, a.detail], ['admin', s.troll.id, 'ok', { name: 'Troll', minutes: FREEZE_MINUTES_MAX, reason: 'botting in Daggerfall' }]);
    assert.deepEqual([s.thread(s.troll.id).why, s.thread(s.troll.id).player_in, s.thread(s.troll.id).closed_at], ['freeze', 1, null], 'A FREEZE OPENS THE THREAD, the player in it');

    _now += 10;
    const u = await s.staff('/v1/staff/unfreeze', { target: s.troll.id }, s.mob.session);
    assert.deepEqual(u.body, { ok: true, target: s.troll.id, name: 'Troll', until: 0, reason: null, live: true });
    assert.deepEqual(s.row(s.troll.id), { frozen_until: null, frozen_reason: null, frozen_by: s.idOf('SirMcMobdon'), frozen_at: nowS(), freeze_rev: 2, freeze_live: 1 });
    const lift = await verifyOrder(s.pushed[1], s.identityPublic, { subtle, nowS: nowS(), kind: 'freeze' });
    assert.deepEqual([lift.claims.s, lift.claims.fz], [s.troll.id, 0], 'the lift\'s order: fz 0');
    assert.deepEqual([s.thread(s.troll.id).closed_at, s.thread(s.troll.id).player_in], [nowS(), 0], 'the unfreeze closes the thread');
    assert.equal(s.audits('unfreeze').at(-1).outcome, 'ok');
  } finally { s.restore(); }
});

test('STAFF-PANEL5-FREEZE: THE TOKEN CARRIES THE FREEZE - `fz` its end while it stands, `frozenUntil` beside it for the freeze screen; an account not frozen mints none (mutants: the claim unminted; minted after its end)', async () => {
  const s = await stand();
  try {
    const claims = (t) => JSON.parse(Buffer.from(tokenBodyOf(t), 'base64url').toString());
    const before = await s.said('/v1/auth/token', s.troll);
    assert.equal(before.status, 200, JSON.stringify(before.body));
    assert.deepEqual([claims(before.body.token).fz, before.body.frozenUntil], [undefined, 0]);
    await s.freeze(s.troll, { minutes: 5 });
    const t = await s.said('/v1/auth/token', s.troll);
    assert.equal(t.status, 200, 'a frozen account still mints its token - it carries the freeze');
    assert.deepEqual([claims(t.body.token).fz, t.body.frozenUntil], [nowS() + 300, nowS() + 300]);
    assert.equal(claims((await s.said('/v1/auth/token', s.sylvia)).body.token).fz, undefined, 'another account: none');
    _now += 301;
    const after = await s.said('/v1/auth/token', s.troll);
    assert.deepEqual([claims(after.body.token).fz, after.body.frozenUntil], [undefined, 0], 'past its end: none');
  } finally { s.restore(); _now += 1000; }
});

test('STAFF-PANEL5-FREEZE: ONE GATE - A MODDED CLIENT that ignores the freeze screen and calls every door of the service itself is answered `frozen` (its end and reason) on all but signing out, its own account, the realm doors that load its character, the token and the staff chat; a realm record\'s own read passes; unfrozen, the doors open again (mutants: the gate gone; a door let through; the record read refused)', async () => {
  const s = await stand();
  try {
    const R = await seatRealm(s.env, s.troll.secret, 'Troll');
    await s.freeze(s.troll);
    const until = nowS() + 3600;
    const want = { error: 'frozen', until, reason: 'botting in Daggerfall' };
    // the doors that take no game session at all: a stranger's, the self-proving, and the public reads answered before one
    const selfProving = new Set([...OPEN_ROUTES, ...PATREON_OPEN_ROUTES, ...SAFE_OPEN_ROUTES, '/v1/auth/register', '/v1/pubkey', '/v1/relaykey', '/v1/mod/grant-feed', '/v1/mod/reaction-feed', '/v1/mod/hidden-seen', '/v1/homes/yards', '/v1/seats/sieges/live']);
    const shut = [...ROUTES].filter((r) => !r.startsWith('/v1/staff/') && !selfProving.has(r) && !FREEZE_ALLOWED.includes(r));
    assert.ok(shut.length > 100, `every game door (${shut.length})`);
    for (const r of ['/v1/market/buy', '/v1/market/list', '/v1/market/bid', '/v1/realm/trade', '/v1/realm/die', '/v1/wild/fall', '/v1/heartbeat', '/v1/account/played']) assert.ok(shut.includes(r), r);
    const leaks = [];
    for (const r of shut) {
      const res = await s.ask('POST', r, s.troll.secret, { character: R.id, rid: rid() });
      if (res.status !== 403 || JSON.stringify(res.body) !== JSON.stringify(want)) leaks.push(`${r} ${res.status} ${JSON.stringify(res.body)}`);
      if (res.pass) leaks.push(`${r}: handed a pass`);
    }
    assert.deepEqual(leaks, [], 'every game door shut to a frozen account');
    // the checkpoint: refused without a pass too
    const put = await s.ask('PUT', `/v1/realm/${R.id}/data`, s.troll.secret, freshSave({ name: 'Troll' }), { headers: { 'x-realm-lease': R.lease, 'x-realm-seq': '2' } });
    assert.deepEqual([put.status, put.body], [403, want], 'the checkpoint');
    // the doors left open
    assert.equal((await s.ask('GET', `/v1/realm/${R.id}/data`, s.troll.secret)).status, 200, 'its record read - the look-around loads it');
    assert.equal((await s.ask('GET', '/v1/realm', s.troll.secret)).status, 200, 'the realm\'s list');
    assert.equal((await s.ask('GET', '/v1/account', s.troll.secret)).status, 200, 'its own account');
    assert.equal((await s.said('/v1/auth/token', s.troll)).status, 200, 'its token');
    assert.equal((await s.said('/v1/staff-chat/read', s.troll)).status, 200, 'the staff chat');
    assert.equal((await s.said('/v1/safety/staff-messages', s.troll)).status, 200, 'a staff Message on screen (STAFF-PANEL5-MESSAGE)');
    assert.equal(freezeRefusal('/v1/market/buy', false, { frozen_until: nowS() + 1 }, nowS()).error, 'frozen');
    assert.equal(freezeRefusal('/v1/market/buy', false, { frozen_until: nowS() }, nowS()), null, 'at its end, open');
    assert.equal(freezeRefusal('/v1/market/buy', false, { frozen_until: null }, nowS()), null);
    assert.equal(freezeRefusal('/v1/realm/r00000000000000000000/data', true, { frozen_until: nowS() + 1 }, nowS()), null);
    // another account is not touched, and the unfreeze opens the doors
    assert.notEqual((await s.ask('POST', '/v1/market/read', s.sylvia.secret, { character: 'c', region: DF, view: 'mine', hubs: HUBS })).body?.error, 'frozen');
    await s.staff('/v1/staff/unfreeze', { target: s.troll.id }, s.mob.session);
    assert.notEqual((await s.ask('POST', '/v1/heartbeat', s.troll.secret, { beat: true })).body?.error, 'frozen');
    assert.equal((await s.said('/v1/auth/logout', s.troll)).status, 200, 'signing out');
  } finally { s.restore(); }
});

test('STAFF-PANEL5-FREEZE: UNDER A PASS MINTED BEFORE THE FREEZE the checkpoint is refused in its own read and the beat credits nothing - a modded client keeping its old pass saves nothing and earns nothing (mutants: the checkpoint\'s freeze unread; the beat\'s)', async () => {
  const s = await stand();
  try {
    const R = await seatRealm(s.env, s.troll.secret, 'Troll');
    const put = (seq, pass) => s.ask('PUT', `/v1/realm/${R.id}/data`, s.troll.secret, freshSave({ name: 'Troll', goldPieces: 100 + seq }), { pass, headers: { 'x-realm-lease': R.lease, 'x-realm-seq': String(seq) } });
    const first = await put(2, null);
    assert.equal(first.status, 200, JSON.stringify(first.body));
    assert.ok(first.pass, 'a pass handed');
    await s.freeze(s.troll, { reason: 'duping' });
    const frozen = await put(3, first.pass);
    assert.deepEqual([frozen.status, frozen.body], [403, { error: 'frozen', until: nowS() + 3600, reason: 'duping' }], 'the save, under the pass');
    assert.equal(R.at().seq, 2, 'nothing saved');
    const played = () => ({ ...s.raw.prepare('SELECT played_s, played_at FROM players WHERE id = ?').get(s.troll.id) });
    const was = played();
    _now += 30;
    const beat = await s.ask('POST', '/v1/heartbeat', s.troll.secret, { beat: true }, { pass: first.pass });
    assert.equal(beat.status, 200, 'the pass\'s reads wait for its renewal');
    assert.deepEqual(played(), was, 'the beat credits a frozen account nothing');
    // unfrozen, the next beat credits again
    await s.staff('/v1/staff/unfreeze', { target: s.troll.id }, s.mob.session);
    _now += 30;
    await s.ask('POST', '/v1/heartbeat', s.troll.secret, { beat: true }, { pass: first.pass });
    assert.notDeepEqual(played(), was, 'unfrozen: credited');
  } finally { s.restore(); }
});

test('STAFF-PANEL5-FREEZE: A FROZEN ACCOUNT\'S GOODS SELL NOTHING - a buy of its listing and a bid on its auction are refused; unfrozen, they sell (mutants: the buy\'s seller unread; the bid\'s)', async () => {
  const s = await stand();
  try {
    const mac = await s.seated('Mac');
    const ann = await s.registered('Ann');
    const fund = (who, marks) => s.raw.prepare('INSERT INTO marks (account, balance) VALUES (?, ?) ON CONFLICT (account) DO UPDATE SET balance = excluded.balance').run(who.id, marks);
    const piece = (provenance, quality) => {
      s.raw.prepare(`INSERT INTO products (provenance, owner, char_id, maker, recipe, template, material, quality, seed, record, made_at)
        VALUES (?, ?, ?, 'Silverthorn', 'longsword:mithril', 120, 5, ?, 4242, 'p1.x', ?)`).run(provenance, mac.id, mac.character, quality, _now);
      s.raw.prepare(`INSERT INTO prof_crafts (player, rid, char_id, recipe, quality, count, provenance, seed, xp, first, at, n)
        VALUES (?, ?, ?, 'longsword:mithril', ?, 1, ?, 4242, 10, 0, ?, 'n')`).run(mac.id, `craft-${provenance}`, mac.character, quality, provenance, _now);
      s.raw.prepare("INSERT INTO item_uids (uid, player, char_id, seen_seq, state, fp, at) VALUES (?, ?, ?, 1, 'held', '120:5', ?)").run(provenance, mac.id, mac.character, _now);
    };
    fund(mac, 1_000);
    fund(ann, 5_000);
    const PV2 = 'e5e5e5e5e5e5e5e0';
    piece(PV, 2);
    piece(PV2, 4);
    holdPieces(s.env, mac.character, [{ provenance: PV, wear: 620 }, { provenance: PV2, quality: 4, wear: 700 }]);
    const l = await s.call('/v1/market/list', { character: mac.character, region: DF, kind: 'piece', provenance: PV, wear: 1000, price: 900, hubs: HUBS, rid: rid(), realm: mac.at() }, mac.secret);
    assert.equal(l.status, 200, JSON.stringify(l.body));
    const a = await s.call('/v1/market/auction', { character: mac.character, region: DF, provenance: PV2, wear: 1000, opening: 100, hubs: HUBS, rid: rid(), realm: mac.at() }, mac.secret);
    assert.equal(a.status, 200, JSON.stringify(a.body));
    await s.freeze(mac);
    const buy = () => s.call('/v1/market/buy', { character: ann.character, region: DF, listing: l.body.listing.id, max: 900, hubs: HUBS, rid: rid() }, ann.secret);
    const bid = () => s.call('/v1/market/bid', { character: ann.character, region: DF, auction: a.body.auction.id, amount: 100, hubs: HUBS, rid: rid() }, ann.secret);
    assert.deepEqual([(await buy()).status, (await buy()).body], [409, { error: 'market-seller-frozen' }]);
    assert.deepEqual([(await bid()).status, (await bid()).body], [409, { error: 'market-seller-frozen' }]);
    assert.equal(s.raw.prepare('SELECT owner FROM products WHERE provenance = ?').get(PV).owner, mac.id, 'nothing sold');
    await s.staff('/v1/staff/unfreeze', { target: mac.id }, s.mob.session);
    const sold = await buy();
    assert.equal(sold.status, 200, JSON.stringify(sold.body));
    assert.equal((await bid()).status, 200);
  } finally { s.restore(); }
});

test('STAFF-PANEL5-FREEZE: A FALL THAT NAMES A FROZEN ACCOUNT IS REFUSED - a killer filing the fall of a frozen player takes nothing; unfrozen, the filing goes on (mutant: the fallen\'s freeze unread)', async () => {
  const s = await stand();
  try {
    const R = await seatRealm(s.env, s.troll.secret, 'Troll', freshSave({ name: 'Troll', level: 9 }));
    const receipt = await mintWildReceipt({ f: s.troll.id, c: R.id, k: s.sylvia.id, r: '0123456789ab', w: 1 }, s.gatePriv, { subtle, nowS: nowS() - 60 });
    await s.freeze(s.troll);
    const fall = () => s.call('/v1/wild/fall', { receipt, room: CELL }, s.sylvia.secret);
    const r = await fall();
    assert.deepEqual([r.status, r.body], [409, { error: 'fallen-frozen' }]);
    assert.equal(s.raw.prepare('SELECT COUNT(*) AS n FROM wild_falls').get().n, 0, 'no fall recorded');
    await s.staff('/v1/staff/unfreeze', { target: s.troll.id }, s.mob.session);
    assert.notEqual((await fall()).body?.error, 'fallen-frozen', 'unfrozen: the filing is the fall\'s own law\'s again');
  } finally { s.restore(); }
});

test('STAFF-PANEL5-FREEZE: THE STAFF CHAT - Talk opens a thread outside a freeze and the player joins on the first staff line; every line stored here first, the audit naming it by id and length (never its words), a staff line\'s nudge pushed (`staffline`, `sl` its id); the player reads (the Discord invite beside) and answers, the open threads list the waiting first; staff close a Talk thread, never a freeze\'s (mutants: the join; the nudge; the words in the audit; the waiting order; the close)', async () => {
  const s = await stand();
  try {
    assert.deepEqual((await s.staff('/v1/staff/talk', { target: s.idOf('SirMcMobdon') }, s.mob.session)).body, { error: 'staff-self' });
    const t = await s.staff('/v1/staff/talk', { target: s.sylvia.id }, s.asy.session);
    assert.deepEqual(t.body, { ok: true, target: s.sylvia.id, name: 'Sylvia', why: 'talk', playerIn: false });
    assert.deepEqual([s.thread(s.sylvia.id).why, s.thread(s.sylvia.id).player_in, s.thread(s.sylvia.id).opened_by], ['talk', 0, s.idOf('Asynian')]);
    assert.equal(s.audits('chat-open').length, 1);
    // not in it yet: the player sees nothing, and can say nothing
    assert.deepEqual((await s.said('/v1/staff-chat/read', s.sylvia)).body, { open: false, frozen: null, lines: [], invite: INVITE });
    assert.deepEqual((await s.said('/v1/staff-chat/send', s.sylvia, { text: 'hi?' })).body, { error: 'no-thread' });
    assert.deepEqual((await s.staff('/v1/staff/chat-send', { target: s.sylvia.id, text: '   ' }, s.asy.session)).body, { error: 'bad-text' });
    const line = await s.staff('/v1/staff/chat-send', { target: s.sylvia.id, text: 'A word about your stall, please.' }, s.asy.session);
    assert.equal(line.status, 200, JSON.stringify(line.body));
    assert.deepEqual(line.body, { ok: true, target: s.sylvia.id, line: { id: line.body.line.id, at: nowS(), staff: true, text: 'A word about your stall, please.', by: 'Asynian' }, live: true });
    assert.equal(s.thread(s.sylvia.id).player_in, 1, 'THE PLAYER JOINS ON THE FIRST STAFF LINE');
    const nudge = await verifyOrder(s.pushed.at(-1), s.identityPublic, { subtle, nowS: nowS(), kind: 'staffline' });
    assert.ok(nudge.ok, nudge.why);
    assert.deepEqual([nudge.claims.s, nudge.claims.sl], [s.sylvia.id, line.body.line.id], 'the nudge names the thread and the line, never its words');
    const logged = s.audits('chat-line').at(-1);
    assert.deepEqual([logged.role, logged.detail], ['moderator', { name: 'Sylvia', line: line.body.line.id, len: 32 }]);
    assert.equal(JSON.stringify(s.audits('chat-line')).includes('stall'), false, 'no chat text in the log');
    // the player reads it, and answers
    const read = (await s.said('/v1/staff-chat/read', s.sylvia)).body;
    assert.deepEqual([read.open, read.lines.map((l) => [l.staff, l.text]), read.invite], [true, [[true, 'A word about your stall, please.']], INVITE]);
    _now += 5;
    const back = await s.said('/v1/staff-chat/send', s.sylvia, { text: 'Of course!' });
    assert.deepEqual([back.status, back.body.line.text, back.body.line.staff], [200, 'Of course!', false]);
    const theirs = s.audits('chat-line').at(-1);
    assert.deepEqual([theirs.role, theirs.target, theirs.detail], ['player', s.sylvia.id, { line: back.body.line.id, len: 10 }], 'the player\'s line in the audit log too - its id and length, never its words');
    assert.deepEqual((await s.said('/v1/staff-chat/read', s.sylvia, { after: line.body.line.id })).body.lines.map((l) => l.text), ['Of course!'], 'after its cursor');
    // the open threads: the one waiting on staff first
    await s.staff('/v1/staff/talk', { target: s.troll.id }, s.mob.session);
    const chats = (await s.staff('/v1/staff/chats', {}, s.mob.session)).body;
    assert.deepEqual(chats.chats.map((c) => [c.name, c.waiting, c.why]), [['Sylvia', true, 'talk'], ['Troll', false, 'talk']]);
    assert.equal(chats.next, null);
    // the staff read: newest first, who wrote it
    const thread = (await s.staff('/v1/staff/chat', { target: s.sylvia.id }, s.mob.session)).body;
    assert.deepEqual(thread.lines.map((l) => [l.text, l.by ?? null]), [['Of course!', null], ['A word about your stall, please.', 'Asynian']]);
    assert.deepEqual([thread.open, thread.why, thread.playerIn, thread.frozen, thread.next], [true, 'talk', true, null, null]);
    assert.equal(s.audits('chat-read').length, 1);
    await s.staff('/v1/staff/chat', { target: s.sylvia.id }, s.mob.session);
    assert.equal(s.audits('chat-read').length, 1, 'a read written once in its window');
    // closed by staff
    assert.deepEqual((await s.staff('/v1/staff/chat-close', { target: s.sylvia.id }, s.mob.session)).body, { ok: true, target: s.sylvia.id });
    assert.deepEqual((await s.said('/v1/staff-chat/send', s.sylvia, { text: 'wait' })).body, { error: 'no-thread' });
    assert.equal((await s.said('/v1/staff-chat/read', s.sylvia)).body.open, false);
    assert.deepEqual((await s.staff('/v1/staff/chat-send', { target: s.sylvia.id, text: 'x' }, s.mob.session)).body, { error: 'no-thread' });
    assert.deepEqual((await s.staff('/v1/staff/chat-close', { target: s.sylvia.id }, s.mob.session)).body, { error: 'no-thread' });
    // a freeze's thread closes with its unfreeze alone
    await s.freeze(s.troll);
    assert.deepEqual((await s.staff('/v1/staff/chat-close', { target: s.troll.id }, s.mob.session)).body, { error: 'freeze-thread' });
    assert.equal(s.audits('chat-close').at(-1).outcome, 'failed');
  } finally { s.restore(); }
});

test('STAFF-PANEL5-FREEZE: A MUTED AND FROZEN PLAYER still talks to staff in their thread - and only there; their lines are counted (PLAYER_LINES_MAX a window); a staff thread read pages by its cursor (mutants: the mute shutting it; the rate unread; the page cursor)', async () => {
  const s = await stand();
  try {
    s.raw.prepare('UPDATE players SET muted_until = ? WHERE id = ?').run(nowS() + 86400, s.troll.id);
    await s.freeze(s.troll);
    const read = (await s.said('/v1/staff-chat/read', s.troll)).body;
    assert.deepEqual([read.open, read.frozen, read.lines], [true, { until: nowS() + 3600, reason: 'botting in Daggerfall' }, []], 'a freeze: in at once');
    for (let i = 0; i < PLAYER_LINES_MAX; i++) assert.equal((await s.said('/v1/staff-chat/send', s.troll, { text: `line ${i}` })).status, 200, `line ${i}`);
    const over = await s.said('/v1/staff-chat/send', s.troll, { text: 'one more' });
    assert.deepEqual([over.status, over.body], [429, { error: 'rate' }]);
    for (let i = 0; i < CHAT_PAGE; i++) await s.staff('/v1/staff/chat-send', { target: s.troll.id, text: `answer ${i}` }, s.mob.session);
    const p1 = (await s.staff('/v1/staff/chat', { target: s.troll.id }, s.mob.session)).body;
    assert.equal(p1.lines.length, CHAT_PAGE);
    assert.equal(p1.lines[0].text, `answer ${CHAT_PAGE - 1}`);
    const p2 = (await s.staff('/v1/staff/chat', { target: s.troll.id, before: p1.next }, s.mob.session)).body;
    assert.deepEqual([p2.lines.length, p2.lines[0].text, p2.next], [PLAYER_LINES_MAX, `line ${PLAYER_LINES_MAX - 1}`, null]);
    assert.deepEqual(p2.frozen, { until: nowS() + 3600, reason: 'botting in Daggerfall' });
  } finally { s.restore(); }
});

test('STAFF-PANEL5-FREEZE: A FAILED PUSH IS SAID AND TRIED AGAIN - the act saved but `live` false, listed first and on the home roll-up; the minute\'s clock pushes a fresh order once the act is PUSH_RETRY_AFTER_S old and marks it live; the panel\'s own push again; a push marks only its own revision (mutants: live always; the list\'s order; the retry\'s age; the revision unread)', async () => {
  const s = await stand();
  try {
    await s.freeze(s.sylvia);
    s.relayDown(true);
    _now += 100;
    const f = await s.freeze(s.troll, { reason: 'spam' });
    assert.deepEqual([f.status, f.body.live], [200, false], 'saved, not live yet');
    assert.deepEqual([s.row(s.troll.id).frozen_until, s.row(s.troll.id).freeze_live], [nowS() + 3600, 0]);
    const list = (await s.staff('/v1/staff/freezes', {}, s.mob.session)).body;
    assert.deepEqual(list.freezes.map((r) => [r.name, r.live, r.frozen]), [['Troll', false, true], ['Sylvia', true, true]], 'not live first');
    assert.deepEqual(list.freezes[0].by, 'SirMcMobdon');
    assert.deepEqual(list.freezes[0].chat, { open: true, lastAt: nowS(), waiting: false });
    assert.equal(s.audits('freezes-read').length, 1);
    const home = await HOME_WATCH.top({ db: s.env.DB, nowS: nowS() }, s.env, {}, 10);
    assert.deepEqual(home, { items: [{ level: 'high', why: 'saved, not live yet', sub: s.troll.id, name: 'Troll' }], high: 1, total: 1 });
    // the panel's push again, the door still down
    const again = await s.staff('/v1/staff/freeze-push', { target: s.troll.id }, s.mob.session);
    assert.deepEqual([again.body.live, s.audits('freeze-push').at(-1).outcome], [false, 'failed']);
    s.relayDown(false);
    const n = s.pushed.length;
    assert.equal(await retryFreezePushes({ db: s.env.DB, nowS: nowS() + PUSH_RETRY_AFTER_S - 1 }, s.env), 0, 'too young: its own push had its chance');
    _now += PUSH_RETRY_AFTER_S;
    const ran = await runCron(s.env, { cron: CRON_MINUTE, nowS: nowS(), jobs: MINUTE_JOBS.filter(([n]) => n === 'safety') });
    assert.ok(ran[0].ok && ran[0].changed >= 1, `the sanctions' minute pushed it again: ${JSON.stringify(ran)}`);
    assert.equal(s.row(s.troll.id).freeze_live, 1);
    const fresh = await verifyOrder(s.pushed[n], s.identityPublic, { subtle, nowS: nowS(), kind: 'freeze' });
    assert.deepEqual([fresh.ok, fresh.claims.i, fresh.claims.fz], [true, nowS(), nowS() - PUSH_RETRY_AFTER_S + 3600], 'a FRESH order, its end the act\'s');
    assert.equal(await retryFreezePushes({ db: s.env.DB, nowS: nowS() }, s.env), 0, 'nothing waits');
    assert.equal(await retryFreezePushes({ db: s.env.DB, nowS: nowS() }, { ...s.env, RELAY_LAW_URL: undefined }), 0);
    const live = await s.staff('/v1/staff/freeze-push', { target: s.troll.id }, s.mob.session);
    assert.deepEqual([live.body.live, s.pushed.length], [true, n + 1], 'live already: nothing pushed');
    // a push marks only its own revision live - and pushes the newer act's row after its own (STAFF-PANEL5-FREEZE-FIX)
    s.raw.prepare('UPDATE players SET freeze_live = 0, freeze_rev = 7 WHERE id = ?').run(s.troll.id);
    const k = s.pushed.length;
    assert.equal(await pushFreeze({ db: s.env.DB, nowS: nowS(), subtle }, s.env, { id: s.troll.id, frozen_until: nowS() + 60, freeze_rev: 6 }), true);
    const [older, newer] = await Promise.all(s.pushed.slice(k).map((o) => verifyOrder(o, s.identityPublic, { subtle, nowS: nowS(), kind: 'freeze' })));
    assert.deepEqual([s.pushed.length - k, older.claims.fz, newer.claims.fz], [2, nowS() + 60, s.row(s.troll.id).frozen_until], 'an older act\'s order, then the row as it stands');
    assert.equal(s.row(s.troll.id).freeze_live, 1, 'the newer act live by the push after');
    // a list past its page answers `next`
    for (let i = 0; i < FREEZES_PAGE; i++) s.raw.prepare('INSERT INTO players (id, guest_name, created_at, last_seen, frozen_until, freeze_live, frozen_at) VALUES (?, ?, 1, 1, ?, 1, ?)').run(`p_frz${String(i).padStart(5, '0')}`, `Frozen ${i}`, nowS() + 60, i);
    const p1 = (await s.staff('/v1/staff/freezes', {}, s.mob.session)).body;
    assert.deepEqual([p1.freezes.length, p1.next], [FREEZES_PAGE, FREEZES_PAGE]);
    const p2 = (await s.staff('/v1/staff/freezes', { from: p1.next }, s.mob.session)).body;
    assert.deepEqual([p2.freezes.length, p2.next], [2, null]);
  } finally { s.restore(); }
});

test('STAFF-PANEL5-FREEZE: TWO ADMINS AT ONCE - an act read at a revision another act moved lands nothing: `freeze-moved`, no order pushed, its audit row failed, and the thread follows the act that landed (a lost unfreeze never closes the winning freeze\'s thread) (mutants: the race unsaid; the thread unguarded)', async () => {
  const s = await stand();
  try {
    /** The next batch runs after another Admin's act moved the player's revision - `then` that act's own write. */
    const race = (then) => {
      const batch = s.env.DB.batch;
      s.env.DB.batch = async (list) => { s.env.DB.batch = batch; then(); return batch.call(s.env.DB, list); };
    };
    const bump = (sql = '') => s.raw.prepare(`UPDATE players SET freeze_rev = freeze_rev + 1${sql} WHERE id = ?`).run(s.troll.id);
    race(() => bump());
    let res = await s.freeze(s.troll);
    assert.deepEqual([res.status, res.body], [409, { error: 'freeze-moved' }], 'the lost freeze');
    assert.deepEqual([s.pushed.length, s.row(s.troll.id).frozen_until, s.thread(s.troll.id)], [0, null, null], 'no order, no freeze, no thread');
    assert.equal(s.audits('freeze').at(-1).outcome, 'failed');
    assert.equal((await s.freeze(s.troll)).status, 200);
    const pushed = s.pushed.length;
    // an unfreeze loses to a fresh freeze landing first: that freeze's thread stays open
    race(() => bump(', frozen_at = frozen_at + 1'));
    res = await s.staff('/v1/staff/unfreeze', { target: s.troll.id }, s.mob.session);
    assert.deepEqual([res.status, res.body], [409, { error: 'freeze-moved' }], 'the lost unfreeze');
    assert.deepEqual([s.pushed.length, s.thread(s.troll.id).closed_at, s.thread(s.troll.id).player_in], [pushed, null, 1], 'the winning freeze\'s thread open');
    assert.equal(s.audits('unfreeze').at(-1).outcome, 'failed');
  } finally { s.restore(); }
});

test('STAFF-PANEL5-FREEZE: THE HOUR\'S SWEEP closes a freeze\'s thread whose freeze ran out and deletes the lines past STAFF_LINES_KEEP_S; the home roll-up names a frozen player waiting on staff (mutants: the sweep\'s freeze unread; a Talk thread swept; the keep)', async () => {
  const s = await stand();
  try {
    await s.freeze(s.troll, { minutes: 1 });
    await s.said('/v1/staff-chat/send', s.troll, { text: 'why?' });
    const home = await HOME_WATCH.top({ db: s.env.DB, nowS: nowS() }, s.env, {}, 10);
    assert.deepEqual(home.items, [{ level: 'medium', why: 'frozen, waiting on a staff answer', sub: s.troll.id, name: 'Troll' }]);
    assert.equal((await s.staff('/v1/staff/talk', { target: s.sylvia.id }, s.mob.session)).status, 200, 'a Talk thread beside it');
    s.raw.prepare("INSERT INTO staff_chat_lines (player, at, author, staff, text) VALUES (?, ?, ?, 0, 'old')").run(s.sylvia.id, nowS() - STAFF_LINES_KEEP_S - 1, s.sylvia.id);
    assert.equal(await sweepStaffChat(s.env.DB, nowS(), 100), 1, 'the old line alone: the freeze stands');
    assert.equal(s.thread(s.troll.id).closed_at, null);
    _now += 61;
    assert.equal((await s.said('/v1/staff-chat/read', s.troll)).body.open, false, 'a freeze\'s thread is open only while it stands');
    assert.equal(await sweepStaffChat(s.env.DB, nowS(), 100), 1);
    assert.equal(s.thread(s.troll.id).closed_at, nowS());
    assert.equal(s.thread(s.sylvia.id).closed_at, null, 'a Talk thread is no freeze\'s: the sweep leaves it open');
    assert.deepEqual(s.raw.prepare('SELECT text FROM staff_chat_lines ORDER BY id').all().map((r) => r.text), ['why?'], 'lines inside the keep stay');
  } finally { s.restore(); }
});

test('STAFF-PANEL5-FREEZE: the Discord invite is the setting\'s, an https address alone', () => {
  assert.equal(discordInvite({ DISCORD_INVITE_URL: INVITE }), INVITE);
  assert.equal(discordInvite({ DISCORD_INVITE_URL: ` ${INVITE} ` }), INVITE);
  for (const bad of [undefined, '', 'http://discord.gg/x', 'javascript:alert(1)', 'https://discord.gg/x?y=<b>', 'https://discord.gg', 7]) assert.equal(discordInvite({ DISCORD_INVITE_URL: bad }), null, String(bad));
  assert.equal(discordInvite(undefined), null);
});

test('STAFF-PANEL5-FREEZE-FIX A STALE PUSH NEVER HAS THE LAST WORD (a review: a retry read before an unfreeze landed after that unfreeze\'s order, and the hub held the freeze while the panel said unfrozen and live): a push whose revision moved on pushes the row as it stands after it, and one that fails leaves that act for the clock; an order\'s time is its mint\'s; the clock reads each row as it stands at its push; at most `tries` pushes after (mutants: no push after; a push after for its own revision; the failed push after said live; the order\'s time the request\'s; the firing\'s read pushed; the tries)', async () => {
  const s = await stand();
  const f = globalThis.fetch;
  let before = null, failFrom = Infinity, n = 0;
  globalThis.fetch = async (u, i) => {
    if (String(u) !== RELAY) return f(u, i);
    const k = n++;
    if (before) { const h = before; before = null; await h(); }
    return k >= failFrom ? new Response('no', { status: 503 }) : f(u, i);
  };
  const claims = async (from = 0) => (await Promise.all(s.pushed.slice(from).map((o) => verifyOrder(o, s.identityPublic, { subtle, nowS: nowS(), kind: 'freeze' })))).map((r) => r.claims);
  try {
    // THE FINDING'S CASE: the clock's retry of a freeze whose push failed, and an Admin's unfreeze committed and pushed
    // while the retry's own order was on its way - landing first
    s.relayDown(true);
    await s.freeze(s.troll);
    s.relayDown(false);
    _now += PUSH_RETRY_AFTER_S;
    let from = s.pushed.length;
    before = async () => { assert.equal((await s.staff('/v1/staff/unfreeze', { target: s.troll.id }, s.mob.session)).body.live, true); };
    assert.equal(await retryFreezePushes({ db: s.env.DB, nowS: nowS() }, s.env), 1);
    let c = await claims(from);
    assert.deepEqual(c.map((x) => x.fz), [0, nowS() - PUSH_RETRY_AFTER_S + 3600, 0], 'the unfreeze, the stale freeze after it, then the row as it stands');
    assert.ok(c[2].i >= c[1].i, 'the last word no older than the stale one (the hub takes a tie by its later arrival)');
    assert.deepEqual([s.row(s.troll.id).frozen_until, s.row(s.troll.id).freeze_live], [null, 1]);
    // a push of its own revision, live already, pushes nothing after
    await s.freeze(s.troll);
    from = s.pushed.length;
    const r = s.row(s.troll.id);
    assert.equal(await pushFreeze({ db: s.env.DB, nowS: nowS(), subtle }, s.env, { id: s.troll.id, ...r }), true);
    assert.equal(s.pushed.length - from, 1, 'its own revision: nothing after');
    // the push after fails: the newer act is left waiting for the clock, never said live
    before = async () => { s.raw.prepare('UPDATE players SET freeze_rev = freeze_rev + 1, freeze_live = 1 WHERE id = ?').run(s.troll.id); failFrom = n; };
    assert.equal(await pushFreeze({ db: s.env.DB, nowS: nowS(), subtle }, s.env, { id: s.troll.id, ...r }), true, 'its own went');
    assert.equal(s.row(s.troll.id).freeze_live, 0, 'the newer act waits for the clock');
    failFrom = Infinity;
    s.raw.prepare('UPDATE players SET freeze_live = 1 WHERE id = ?').run(s.troll.id);
    // AN ORDER'S TIME IS ITS MINT'S: an act whose commit came a second after its request was read
    const batch = s.env.DB.batch;
    s.env.DB.batch = async (list) => { s.env.DB.batch = batch; _now += 2; return batch.call(s.env.DB, list); };
    const asked = nowS();
    from = s.pushed.length;
    assert.equal((await s.staff('/v1/staff/unfreeze', { target: s.troll.id }, s.mob.session)).status, 200);
    c = await claims(from);
    assert.deepEqual([c[0].i, s.row(s.troll.id).frozen_at], [asked + 2, asked], 'minted after the commit; the act kept at its request');
    // THE CLOCK READS EACH ROW AT ITS OWN PUSH: Sylvia's push first, and Troll's freeze lifted by an Admin meanwhile
    await s.freeze(s.troll);
    await s.freeze(s.sylvia);
    s.raw.prepare('UPDATE players SET freeze_live = 0, frozen_at = ? WHERE id = ?').run(nowS() - 100, s.sylvia.id);
    s.raw.prepare('UPDATE players SET freeze_live = 0, frozen_at = ? WHERE id = ?').run(nowS() - 50, s.troll.id);
    _now += PUSH_RETRY_AFTER_S;
    before = async () => { s.raw.prepare('UPDATE players SET frozen_until = NULL, freeze_rev = freeze_rev + 1 WHERE id = ?').run(s.troll.id); };
    from = s.pushed.length;
    assert.equal(await retryFreezePushes({ db: s.env.DB, nowS: nowS() }, s.env), 2);
    c = await claims(from);
    assert.deepEqual(c.map((x) => [x.s, x.fz > 0]), [[s.sylvia.id, true], [s.troll.id, false]], 'Troll pushed once, as his row stands');
    // at most `tries` pushes after: a revision that moves at every push
    before = null;
    const hook = () => { before = async () => { s.raw.prepare('UPDATE players SET freeze_rev = freeze_rev + 1 WHERE id = ?').run(s.troll.id); hook(); }; };
    hook();
    from = s.pushed.length;
    assert.equal(await pushFreeze({ db: s.env.DB, nowS: nowS(), subtle }, s.env, { id: s.troll.id, ...s.row(s.troll.id) }), true);
    before = null;
    assert.equal(s.pushed.length - from, 4, 'its own and three after');
  } finally { s.restore(); }
});
