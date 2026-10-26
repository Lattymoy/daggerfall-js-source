// STAFF-PANEL1 (2026-10-22, mob: a staff admin panel; design doc "DFO Staff Panel: design", build step 1) - THE PANEL'S
// SIGN-IN, SESSIONS, ROLES AND AUDIT LOG (server-account/src/staff.js), driven through the real Worker on the node:sqlite
// database every account pin stands on (test/accountDb.mjs). Three locks (mob, 06:18Z): the password, a key only the
// staff member's own extension holds, and the role lists.
//
// What these pins hold, beside the happy path, is each hole the design review found before a line was written:
// a lockout anyone could press to shut a staff member out (keyed per handle alone), a signature that works twice, a
// handle handed to another account by a rename carrying its role in, a session a poll keeps alive for ever, an audit row
// a route could edit, an unconfigured deploy standing open, and a game secret opening a staff door (or the reverse).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { standService } from '../accountDb.mjs';
import { staffRole, isOwner, ownerKeys, staffWords, STAFF_SESSION_HEADER, STAFF_IDLE_S, STAFF_TRY_MAX, STAFF_KEYS_MAX, STAFF_SIG_S, STAFF_READ_ROW_S, STAFF_AUDIT_KEEP_S } from '../../server-account/src/staff.js';
import { runCron, CRON_HOUR, HOUR_JOBS } from '../../server-account/src/cron.js';
import { STAFF_ROUTES, ROUTES } from '../../server-account/src/service.js';
import worker from '../../server-account/src/index.js';
import { canModerate, glyphsOf } from '../../server-account/src/titles.js';

const { subtle } = globalThis.crypto;
const enc = new TextEncoder();
const src = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const nowS = () => Math.floor(Date.now() / 1000);
const PASSWORD = 'a good long one';
const b64url = (bytes) => Buffer.from(bytes).toString('base64url');

/** An extension's key, as the extension makes it: an Ed25519 pair; `pub` the public half the service is shown. */
async function extensionKey() {
  const pair = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const pub = b64url(new Uint8Array(await subtle.exportKey('raw', pair.publicKey)));
  let last = 0;
  /** A signed body: `ts` a fresh second each call, as a real extension's clock gives one a sign-in. */
  const proof = async (what, handle, ts = Math.max(nowS(), last + 1)) => {
    last = Math.max(last, ts);
    const sig = b64url(new Uint8Array(await subtle.sign({ name: 'Ed25519' }, pair.privateKey, enc.encode(staffWords(what, handle.toLowerCase(), ts)))));
    return { pub, ts, sig };
  };
  return { pub, proof };
}

/** The Worker with the panel set up: the lists, the owners, and mob's extension key named as an owner's. */
async function stand(extra = {}) {
  const mobKey = await extensionKey();
  const s = await standService({
    DEVELOPER_HANDLES: 'Lattymoy,SirMcMobdon', MODERATOR_HANDLES: 'Asynian', SHADOW_FANG_HANDLES: 'SirMcMobdon,Fangy',
    OWNER_HANDLES: 'Lattymoy,SirMcMobdon', OWNER_KEYS: `SirMcMobdon:${mobKey.pub}`,
    ...extra,
  });
  /** A staff door, as the panel asks it: POST, JSON, the staff header, an address. */
  const staff = async (path, body = {}, { token = null, ip = '203.0.113.1' } = {}) => {
    const res = await s.fetch(`https://accounts.invalid${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'cf-connecting-ip': ip, ...(token ? { [STAFF_SESSION_HEADER]: token } : {}) },
      body: JSON.stringify(body),
    });
    return { status: res.status, body: await res.json().catch(() => null) };
  };
  const login = async (handle, key, more = {}, opts = {}) => staff('/v1/staff/login', { handle, password: PASSWORD, ...(await key.proof('login', handle)), ...more }, opts);
  const enrol = async (handle, key, invite, more = {}) => staff('/v1/staff/enroll', { handle, password: PASSWORD, invite, ...(await key.proof('enroll', handle)), ...more });
  /** mob signs in with the key the config names, and invites `handle`, whose own new extension registers its key. */
  const mobIn = async () => {
    const r = await login('SirMcMobdon', mobKey);
    assert.equal(r.status, 200, JSON.stringify(r.body));
    return r.body;
  };
  const invited = async (handle, owner) => {
    const inv = await staff('/v1/staff/invite', { handle }, { token: owner.session });
    assert.equal(inv.status, 200, JSON.stringify(inv.body));
    const key = await extensionKey();
    const r = await enrol(handle, key, inv.body.invite, { label: `${handle}'s laptop` });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    return { ...r.body, key, invite: inv.body.invite };
  };
  return { ...s, staff, login, enrol, mobKey, mobIn, invited, raw: s.env.DB._raw };
}

test('STAFF-PANEL1: every door is listed once, beside the game\'s, and none is behind the game\'s session', async () => {
  for (const r of STAFF_ROUTES) assert.ok(ROUTES.has(r), r);
  assert.deepEqual([...STAFF_ROUTES].sort(), ['/v1/staff/audit', '/v1/staff/cut', '/v1/staff/enroll', '/v1/staff/invite', '/v1/staff/key/forget',
    '/v1/staff/keys', '/v1/staff/login', '/v1/staff/logout', '/v1/staff/me', '/v1/staff/mod/add', '/v1/staff/mod/remove', '/v1/staff/mods', '/v1/staff/team',
    // STAFF-PANEL2: the reports (staffCases.js)
    '/v1/staff/ban', '/v1/staff/case', '/v1/staff/cases', '/v1/staff/claim', '/v1/staff/dismiss', '/v1/staff/mute', '/v1/staff/release', '/v1/staff/strikes', '/v1/staff/unban',
    // STAFF-BANNED: the Banned tab (staffCases.js)
    '/v1/staff/banned',
    // STAFF-PANEL3-DESK: notes, the watchlist, your settings, the notice, the scorecard, the reported notes and listings (staffDesk.js)
    '/v1/staff/notes', '/v1/staff/notes/add', '/v1/staff/watch', '/v1/staff/watch/add', '/v1/staff/watch/remove', '/v1/staff/watch/events',
    '/v1/staff/settings', '/v1/staff/settings/save', '/v1/staff/notice', '/v1/staff/ai-score', '/v1/staff/board/reported', '/v1/staff/board/moderate',
    '/v1/staff/market/reported',
    // STAFF-PANEL3-PLAYERS: the players (staffPlayers.js)
    '/v1/staff/players', '/v1/staff/player', '/v1/staff/player/devices', '/v1/staff/player/signout', '/v1/staff/player/rename',
    // STAFF-PANEL6-STATUS: server status, its limits and Home (staffStatus.js)
    '/v1/staff/home', '/v1/staff/limit/set', '/v1/staff/limits', '/v1/staff/status',
    // STAFF-PANEL3-REALM: trade holds, rollbacks, fixes, gains and removals (staffRealm.js); STAFF-SET-BANK: a bank set - PIN MOVED
    '/v1/staff/trade-holds', '/v1/staff/findings', '/v1/staff/trade-hold', '/v1/staff/trade-unhold', '/v1/staff/rollback', '/v1/staff/fix/repair',
    '/v1/staff/fix/mend', '/v1/staff/fix/bank', '/v1/staff/fix/letter', '/v1/staff/gains', '/v1/staff/market/pull', '/v1/staff/market/remove', '/v1/staff/item/take', '/v1/staff/item/purge-dupes', '/v1/staff/evidence',
    '/v1/staff/evidence/return',
    // STAFF-GIVE: Add an item (staffGive.js)
    '/v1/staff/item/catalogue', '/v1/staff/item/give',
    // STAFF-PANEL4-CENSUS: the census and the contested pieces (staffCensus.js)
    '/v1/staff/census/find', '/v1/staff/census', '/v1/staff/census/jumps', '/v1/staff/contested', '/v1/staff/contested/piece', '/v1/staff/contested/trail',
    // STAFF-PANEL3-ECON: the economy (staffEconomy.js)
    '/v1/staff/econ/economy', '/v1/staff/econ/guilds', '/v1/staff/econ/harvests', '/v1/staff/econ/stream',
    // STAFF-PANEL5-FOLLOW: a follow token (staffFollow.js)
    '/v1/staff/follow',
    // STAFF-PANEL5-MESSAGE: Message on screen (staffMessage.js)
    '/v1/staff/message', '/v1/staff/messages',
    // STAFF-EVENT: the Events page (staffEvents.js) - PIN MOVED
    '/v1/staff/event', '/v1/staff/events',
    // STAFF-PANEL5-FEEDS: Network bursts, Monster watch and its Flag, the bot check (the relay's /v1/staff/net-feed takes no session)
    '/v1/staff/net', '/v1/staff/monsters', '/v1/staff/monster/flag', '/v1/staff/reactions', '/v1/staff/reactions/keep',
    // STAFF-PANEL5-HIDDEN: Hide me and Show myself (staffHidden.js) - PIN MOVED
    '/v1/staff/hide',
    // STAFF-PANEL5-FREEZE: freeze and the staff chat (staffFreeze.js)
    '/v1/staff/freeze', '/v1/staff/unfreeze', '/v1/staff/freezes', '/v1/staff/freeze-push', '/v1/staff/talk', '/v1/staff/chat', '/v1/staff/chat-send',
    '/v1/staff/chat-close', '/v1/staff/chats'].sort());
  // no secret to set anywhere: the config holds the lists and a public key, and nothing else of the panel's
  const toml = src('server-account/wrangler.toml');
  assert.match(toml, /^OWNER_HANDLES = "Lattymoy,SirMcMobdon"$/m);
  // mob pasted the key his panel showed: that pair alone, and every key named a raw 32-byte Ed25519 public key
  assert.match(toml, /^OWNER_KEYS = "SirMcMobdon:1c9fniJJmmIwXevvrTVajM6SeIFagO8KEzYiAM08mYM"$/m);
  for (const k of ownerKeys({ OWNER_KEYS: toml.match(/^OWNER_KEYS = "([^"]*)"$/m)?.[1] }).values()) {
    await crypto.subtle.importKey('raw', Buffer.from(k, 'base64url'), { name: 'Ed25519' }, false, ['verify']);
  }
  // mob, 06:33Z: "add me to the dev and my shadow fang just becomes vanity and i gain admin as well"
  assert.match(toml, /^DEVELOPER_HANDLES = "[^"]*,SirMcMobdon,kpblca_1"$/m);
  assert.match(toml, /^SHADOW_FANG_HANDLES = "SirMcMobdon"$/m);
});

test('STAFF-PANEL1: unconfigured is shut - with no owner key named, nobody can sign in', async () => {
  const s = await stand({ OWNER_KEYS: '' });
  await s.registered('SirMcMobdon');
  const r = await s.login('SirMcMobdon', s.mobKey);
  assert.deepEqual([r.status, r.body], [401, { error: 'staff-login' }]);
  assert.equal((await s.staff('/v1/staff/me', {}, { token: 'x'.repeat(43) })).status, 401);
});

test('STAFF-PANEL1: three locks - the password, the extension\'s key and the list - and every refusal is the same word', async () => {
  const s = await stand();
  await s.registered('SirMcMobdon');
  await s.registered('Player1');
  const me = await s.mobIn();
  assert.deepEqual([me.role, me.owner, me.handle], ['admin', true, 'SirMcMobdon']);
  assert.equal(typeof me.session, 'string');
  // Admin is the Developers list alone, and OWNER_HANDLES opens nothing by itself (mutants: an owner as Admin; an owner as staff)
  const sir = { handle: 'SirMcMobdon' };
  assert.equal(staffRole(sir, { ...s.env, DEVELOPER_HANDLES: 'Lattymoy' }), 'moderator', 'off the Developers list a Shadow Fang is a Moderator');
  const none = { ...s.env, DEVELOPER_HANDLES: 'Lattymoy', SHADOW_FANG_HANDLES: 'Fangy' };
  assert.deepEqual([staffRole(sir, none), isOwner(sir, none)], [null, false], 'an owner off every role list');
  const wrongKey = { proof: async (what, handle) => {
    const pair = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
    const ts = nowS();
    return { pub: s.mobKey.pub, ts, sig: b64url(new Uint8Array(await subtle.sign({ name: 'Ed25519' }, pair.privateKey, enc.encode(staffWords(what, handle.toLowerCase(), ts))))) };
  } };
  for (const [why, r] of [
    ['wrong password', await s.staff('/v1/staff/login', { handle: 'SirMcMobdon', password: 'not it at all', ...(await s.mobKey.proof('login', 'SirMcMobdon')) })],
    ['mob\'s public key, another key\'s signature', await s.login('SirMcMobdon', wrongKey)],
    ['no key at all', await s.staff('/v1/staff/login', { handle: 'SirMcMobdon', password: PASSWORD })],
    ['a stale signature', await s.login('SirMcMobdon', { proof: (w, h) => s.mobKey.proof(w, h, nowS() - 600) })],
    ['an enrol signature for a login', await s.staff('/v1/staff/login', { handle: 'SirMcMobdon', password: PASSWORD, ...(await s.mobKey.proof('enroll', 'SirMcMobdon')) })],
    ['not on any list', await s.login('Player1', s.mobKey)],
    ['no such handle', await s.login('NoSuchHandle', s.mobKey)],
  ]) assert.deepEqual([r.status, r.body], [401, { error: 'staff-login' }], why);
});

test('STAFF-PANEL1: a signature works once', async () => {
  const s = await stand();
  await s.registered('SirMcMobdon');
  const proof = await s.mobKey.proof('login', 'SirMcMobdon');
  const body = { handle: 'SirMcMobdon', password: PASSWORD, ...proof };
  assert.equal((await s.staff('/v1/staff/login', body)).status, 200);
  assert.equal((await s.staff('/v1/staff/login', body)).status, 401, 'the same signed second again');
  const older = await s.mobKey.proof('login', 'SirMcMobdon', proof.ts - 1);
  assert.equal((await s.staff('/v1/staff/login', { ...body, ...older })).status, 401, 'an older second');
  const rows = s.raw.prepare("SELECT detail FROM staff_audit WHERE act = 'login-refused'").all().map((r) => JSON.parse(r.detail).why);
  assert.deepEqual(rows, ['replayed', 'replayed'], 'and an owner sees it tried');
});

test('STAFF-PANEL1: a staff token opens no game door and a game secret no staff door', async () => {
  const s = await stand();
  const who = await s.registered('SirMcMobdon');
  const me = await s.mobIn();
  assert.equal((await s.staff('/v1/staff/me', {}, { token: who.secret })).status, 401, 'a game secret in the staff header');
  assert.equal((await s.call('/v1/account', {}, me.session)).status, 401, 'a staff token as a game bearer');
  const r = await s.staff('/v1/staff/me', {}, { token: me.session });
  assert.equal(r.status, 200);
  assert.deepEqual([r.body.handle, r.body.role, r.body.owner, r.body.idleS], ['SirMcMobdon', 'admin', true, STAFF_IDLE_S]);
});

test('STAFF-PANEL1: an owner invites; the invite registers one extension once; Moderators keep their part and are no owners', async () => {
  const s = await stand();
  await s.registered('SirMcMobdon');
  await s.registered('Asynian');
  await s.registered('Fangy');
  await s.registered('Player1');
  const me = await s.mobIn();
  const tok = { token: me.session };
  assert.equal((await s.staff('/v1/staff/invite', { handle: 'Player1' }, tok)).body.error, 'no-staff', 'only a listed handle');
  const mod = await s.invited('Asynian', me);
  assert.deepEqual([mod.role, mod.owner], ['moderator', false]);
  // spent: the same invite registers no second key
  const again = await s.enrol('Asynian', await extensionKey(), mod.invite);
  assert.equal(again.status, 401);
  // the registered key signs in from then on
  assert.equal((await s.login('Asynian', mod.key)).status, 200);
  // a key registered to one account opens no other: Fangy cannot sign in with Asynian's extension
  const fang = await s.invited('Fangy', me);
  assert.equal(fang.role, 'moderator', 'a Shadow Fang moderates, so is a Moderator here (mob, 06:20Z: "mods still get theres")');
  assert.equal((await s.login('Fangy', mod.key)).status, 401);
  // a Moderator is no owner: the team, invites, cuts and the audit log are refused
  for (const path of ['/v1/staff/team', '/v1/staff/invite', '/v1/staff/cut', '/v1/staff/audit']) {
    const r = await s.staff(path, { handle: 'Fangy' }, { token: mod.session });
    assert.deepEqual([r.status, r.body.error], [403, 'staff-owner'], path);
  }
  const team = await s.staff('/v1/staff/team', {}, tok);
  const by = Object.fromEntries(team.body.team.map((m) => [m.handle, m]));
  assert.deepEqual([by.Asynian.role, by.Asynian.keys, by.SirMcMobdon.owner, by.Lattymoy], ['moderator', 1, true, undefined], 'Lattymoy has no account in this database');
});

test('STAFF-PANEL1: a cut is at once, and a key forgotten takes its sessions with it', async () => {
  const s = await stand();
  await s.registered('SirMcMobdon');
  await s.registered('Asynian');
  const me = await s.mobIn();
  const mod = await s.invited('Asynian', me);
  assert.equal((await s.staff('/v1/staff/cut', { handle: 'SirMcMobdon' }, { token: me.session })).body.error, 'staff-self');
  assert.equal((await s.staff('/v1/staff/cut', { handle: 'Asynian' }, { token: me.session })).status, 200);
  assert.equal((await s.staff('/v1/staff/me', {}, { token: mod.session })).status, 401, 'their open session ends');
  assert.equal((await s.login('Asynian', mod.key)).status, 401, 'and their key is gone');
  // back in with a new invite and a new key; then they forget it themselves
  const back = await s.invited('Asynian', me);
  const keys = await s.staff('/v1/staff/keys', {}, { token: back.session });
  assert.deepEqual(keys.body.keys.map((k) => [k.label, k.current]), [['Asynian\'s laptop', true]]);
  assert.equal((await s.staff('/v1/staff/key/forget', { id: back.keyId }, { token: back.session })).status, 200);
  assert.equal((await s.staff('/v1/staff/me', {}, { token: back.session })).status, 401);
  assert.equal((await s.login('Asynian', back.key)).status, 401);
});

test(`STAFF-PANEL1: at most ${STAFF_KEYS_MAX} extensions an account`, async () => {
  const s = await stand();
  await s.registered('SirMcMobdon');
  await s.registered('Asynian');
  const me = await s.mobIn();
  for (let i = 0; i < STAFF_KEYS_MAX; i++) await s.invited('Asynian', me);
  const inv = await s.staff('/v1/staff/invite', { handle: 'Asynian' }, { token: me.session });
  const r = await s.enrol('Asynian', await extensionKey(), inv.body.invite);
  assert.deepEqual([r.status, r.body.error], [409, 'staff-keys-full']);
});

test('STAFF-PANEL1: off the list, banned or renamed away is off the panel at the next click', async () => {
  const s = await stand();
  await s.registered('SirMcMobdon');
  const asy = await s.registered('Asynian');
  const me = await s.mobIn();
  const mod = await s.invited('Asynian', me);
  s.env.MODERATOR_HANDLES = '';
  assert.equal((await s.staff('/v1/staff/me', {}, { token: mod.session })).status, 401, 'off the list');
  assert.equal(s.raw.prepare('SELECT COUNT(*) AS n FROM staff_sessions WHERE player_id = ?').get(asy.id).n, 0, 'and the dead session deleted');
  assert.equal((await s.login('Asynian', mod.key)).status, 401, 'and no sign-in');
  s.env.MODERATOR_HANDLES = 'Asynian';
  const back = await s.login('Asynian', mod.key);
  assert.equal(back.status, 200, 'back on the list, the same extension works');
  s.raw.prepare('UPDATE players SET banned_until = ? WHERE id = ?').run(nowS() + 3600, asy.id);
  assert.equal((await s.staff('/v1/staff/me', {}, { token: back.body.session })).status, 401, 'banned');
  assert.equal((await s.login('Asynian', mod.key)).status, 401);
  s.raw.prepare('UPDATE players SET banned_until = NULL WHERE id = ?').run(asy.id);
  // A RENAME HANDS NO ROLE ON: the enrolled account, renamed away, no longer holds the handle its key names; and the
  // listed handle, now another account's, has no key registered to it
  const third = await s.login('Asynian', mod.key);
  assert.equal(third.status, 200);
  s.raw.prepare("UPDATE players SET handle = 'OldAsy', handle_lc = 'oldasy' WHERE id = ?").run(asy.id);
  await s.registered('Asynian');
  assert.equal((await s.staff('/v1/staff/me', {}, { token: third.body.session })).status, 401, 'renamed away');
  assert.equal((await s.login('Asynian', mod.key)).status, 401, 'the new holder of the handle, with the old key');
});

test('STAFF-PANEL1: tries are bounded per address and per handle from one address - never per handle alone', async () => {
  const s = await stand();
  await s.registered('SirMcMobdon');
  for (let i = 0; i < STAFF_TRY_MAX; i++) {
    assert.equal((await s.staff('/v1/staff/login', { handle: 'SirMcMobdon', password: 'guess guess guess' }, { ip: '192.0.2.66' })).status, 401);
  }
  const shut = await s.login('SirMcMobdon', s.mobKey, {}, { ip: '192.0.2.66' });
  assert.deepEqual([shut.status, shut.body.error], [429, 'rate'], 'the guessing address is shut out');
  const mine = await s.login('SirMcMobdon', s.mobKey, {}, { ip: '203.0.113.9' });
  assert.equal(mine.status, 200, 'the staff member from their own address is not');
  // a guess with neither lock is noise and writes nothing; a right password with no key is somebody holding it
  assert.equal(s.raw.prepare("SELECT COUNT(*) AS n FROM staff_audit WHERE act = 'login-refused'").get().n, 0);
  await s.staff('/v1/staff/login', { handle: 'SirMcMobdon', password: PASSWORD }, { ip: '198.51.100.3' });
  const audit = await s.staff('/v1/staff/audit', { act: 'login-refused' }, { token: mine.body.session });
  assert.deepEqual(audit.body.rows.map((r) => r.detail.why), ['key'], 'the password was right, the key was not');
});

test('STAFF-PANEL1: idle means the staff member, not the panel\'s polling; eight hours is the end either way', async () => {
  const s = await stand();
  await s.registered('SirMcMobdon');
  const me = await s.mobIn();
  const act = () => s.raw.prepare('SELECT last_act FROM staff_sessions').get().last_act;
  s.raw.prepare('UPDATE staff_sessions SET last_act = ?').run(nowS() - 600);
  const was = act();
  assert.equal((await s.staff('/v1/staff/me', { poll: true }, { token: me.session })).status, 200);
  assert.equal(act(), was, 'a poll does not touch it');
  assert.equal((await s.staff('/v1/staff/me', {}, { token: me.session })).status, 200);
  assert.ok(act() > was, 'an act does');
  s.raw.prepare('UPDATE staff_sessions SET last_act = ?').run(nowS() - STAFF_IDLE_S - 1);
  assert.equal((await s.staff('/v1/staff/me', { poll: true }, { token: me.session })).status, 401, 'idle past 30 minutes');
  const live = await s.mobIn();
  s.raw.prepare('UPDATE staff_sessions SET expires_at = ?').run(nowS() - 1);
  assert.equal((await s.staff('/v1/staff/me', {}, { token: live.session })).status, 401, 'past its whole life');
});

test('STAFF-PANEL1: the audit log is append-only, read by owners alone, and its reads are rows too', async () => {
  const s = await stand();
  await s.registered('SirMcMobdon');
  await s.registered('Asynian');
  const me = await s.mobIn();
  await s.invited('Asynian', me);
  const read = await s.staff('/v1/staff/audit', {}, { token: me.session });
  assert.equal(read.status, 200);
  assert.deepEqual(read.body.rows.map((r) => [r.act, r.actorName]), [['enrolled', 'Asynian'], ['invite', 'SirMcMobdon'], ['login', 'SirMcMobdon']], 'newest first');
  assert.equal(read.body.rows[0].detail.by, s.raw.prepare("SELECT id FROM players WHERE handle_lc = 'sirmcmobdon'").get().id, 'who let them in');
  assert.equal((await s.staff('/v1/staff/audit', {}, { token: me.session })).body.rows[0].act, 'audit-read', 'the read before is a row');
  assert.throws(() => s.raw.prepare("UPDATE staff_audit SET act = 'nothing'").run(), /append-only/);
  assert.throws(() => s.raw.prepare('DELETE FROM staff_audit').run(), /append-only/);
});

test('STAFF-PANEL1 (mob, 12:08Z, a review of the PR: "Audit log reads generate additional audit entries", "don\'t distinguish successful and failed operations", "No retention"; 12:12Z: "only keep for one month"): a read of the log, the team or the moderators is a row once in STAFF_READ_ROW_S a member and a view, whatever its page (the fourth review: a `before` wrote no row at all, and a member\'s window hid every other member\'s read); every row says ok, denied or failed - a key forgotten that was not there, or another member\'s, failed, a role\'s door refused denied, a refused sign-in denied; and the hourly job deletes rows past STAFF_AUDIT_KEEP_S, the trigger every newer (mutants: every read a row; a `before` no row; one member\'s window everyone\'s; one view\'s window every view\'s; another\'s key forgotten done; a failed act ok; a forgotten key\'s outcome turned; the outcome unsaid; a refusal unwritten; a refused sign-in ok; the read\'s outcome unread; the month unkept; the job deleting the month; the trigger\'s month moved; the month a year)', async (t) => {
  const t0 = Date.now();
  let off = 0;
  t.mock.method(Date, 'now', () => t0 + off);
  const s = await stand();
  await s.registered('SirMcMobdon');
  await s.registered('Asynian');
  await s.registered('Lattymoy');
  const me = await s.mobIn();
  const tok = { token: me.session };
  const rows = (act) => s.raw.prepare('SELECT outcome, detail FROM staff_audit WHERE act = ? ORDER BY id').all(act);
  const reads = () => ['audit-read', 'team-read', 'mods-read'].map((a) => rows(a).length);
  // reads: once in STAFF_READ_ROW_S a member and a view, whatever the page
  await s.staff('/v1/staff/audit', {}, tok);
  await s.staff('/v1/staff/audit', {}, tok);
  await s.staff('/v1/staff/audit', { before: 1_000_000 }, tok);
  await s.staff('/v1/staff/team', {}, tok);
  await s.staff('/v1/staff/team', {}, tok);
  await s.staff('/v1/staff/mods', {}, tok);
  assert.deepEqual(reads(), [1, 1, 1], 'a read again inside STAFF_READ_ROW_S, and a page of it, write nothing');
  assert.deepEqual(JSON.parse(rows('audit-read')[0].detail), { actor: null, target: null, act: null }, 'the row is the view, never its page');
  await s.staff('/v1/staff/audit', { target: 'acct-someone' }, tok);
  assert.equal(rows('audit-read').length, 2, 'another view of the log inside the window: a row of its own');
  const latty = await s.invited('Lattymoy', me);
  await s.staff('/v1/staff/audit', {}, { token: latty.session });
  await s.staff('/v1/staff/team', {}, { token: latty.session });
  await s.staff('/v1/staff/mods', {}, { token: latty.session });
  assert.deepEqual(reads(), [3, 2, 2], 'another member\'s read inside the first\'s window: theirs, written');
  off += STAFF_READ_ROW_S * 1000 + 1000;
  assert.equal((await s.staff('/v1/staff/audit', { before: Number.MAX_SAFE_INTEGER }, tok)).status, 200);
  await s.staff('/v1/staff/team', {}, tok);
  assert.deepEqual(reads(), [4, 3, 2], 'past it, the next read is a row - one naming a `before` too (any past the newest row is the first page)');
  // outcomes: done, changed nothing, refused
  const mod = await s.invited('Asynian', me);
  assert.equal((await s.staff('/v1/staff/team', {}, { token: mod.session })).body.error, 'staff-owner');
  assert.equal((await s.staff('/v1/staff/mods', {}, { token: mod.session })).body.error, 'staff-admin');
  assert.deepEqual(rows('refused').map((r) => [r.outcome, JSON.parse(r.detail).path, JSON.parse(r.detail).need]),
    [['denied', '/v1/staff/team', 'owner'], ['denied', '/v1/staff/mods', 'admin']], 'a role\'s door refused: written, denied');
  assert.equal((await s.login('Asynian', await extensionKey())).status, 401);
  assert.deepEqual(rows('login-refused').map((r) => r.outcome), ['denied'], 'a refused sign-in: denied');
  assert.equal((await s.staff('/v1/staff/key/forget', { id: 'no-such-key' }, { token: mod.session })).body.error, 'no-key');
  assert.deepEqual(rows('key-forget').map((r) => r.outcome), ['failed'], 'a key that was not there: failed, never done');
  const [theirs] = (await s.staff('/v1/staff/keys', {}, { token: latty.session })).body.keys;
  assert.equal((await s.staff('/v1/staff/key/forget', { id: theirs.id }, { token: mod.session })).body.error, 'no-key');
  assert.deepEqual(rows('key-forget').map((r) => r.outcome), ['failed', 'failed'], 'another member\'s key: failed, never done');
  assert.deepEqual((await s.staff('/v1/staff/keys', {}, { token: latty.session })).body.keys.map((k) => k.id), [theirs.id], 'and still theirs');
  const [own] = (await s.staff('/v1/staff/keys', {}, { token: mod.session })).body.keys;
  assert.equal((await s.staff('/v1/staff/key/forget', { id: own.id }, { token: mod.session })).body.ok, true);
  assert.deepEqual(rows('key-forget').map((r) => r.outcome), ['failed', 'failed', 'ok']);
  assert.ok([...rows('invite'), ...rows('enrolled'), ...rows('login')].every((r) => r.outcome === 'ok'));
  const read = await s.staff('/v1/staff/audit', { act: 'key-forget' }, tok);
  assert.deepEqual(read.body.rows.map((r) => r.outcome), ['ok', 'failed', 'failed'], 'the read says it, newest first');
  // the month: the hourly job deletes rows past it, and nothing deletes a newer one
  const real = Math.floor(t0 / 1000) + Math.floor(off / 1000);
  const put = s.raw.prepare("INSERT INTO staff_audit (at, act) VALUES (?, 'old')");
  put.run(real - STAFF_AUDIT_KEEP_S - 60); put.run(real - STAFF_AUDIT_KEEP_S + 3 * 3600);
  assert.throws(() => s.raw.prepare("DELETE FROM staff_audit WHERE act = 'old' AND at > ?").run(real - STAFF_AUDIT_KEEP_S), /append-only/, 'a row inside the month: nobody deletes it');
  const ran = await runCron(s.env, { cron: CRON_HOUR, nowS: real, jobs: HOUR_JOBS.filter(([n]) => n === 'staff-audit') });
  assert.deepEqual(ran.map((r) => [r.name, r.ok, r.changed]), [['staff-audit', true, 1]]);
  assert.deepEqual(s.raw.prepare("SELECT at FROM staff_audit WHERE act = 'old'").all().map((r) => r.at), [real - STAFF_AUDIT_KEEP_S + 3 * 3600], 'the row past the month gone, the one inside it kept');
  assert.ok(s.raw.prepare('SELECT COUNT(*) AS n FROM staff_audit WHERE act != ?').get('old').n > 10, 'today\'s rows all kept');
  // the trigger's number is the month less an hour for the two clocks
  assert.match(src('server-account/migrations/0144_staff_panel.sql'), new RegExp(`WHEN OLD\\.at > CAST\\(strftime\\('%s', 'now'\\) AS INTEGER\\) - ${STAFF_AUDIT_KEEP_S - 3600}\\n`));
  assert.equal(STAFF_AUDIT_KEEP_S, 30 * 24 * 3600, 'mob: "only keep for one month"');
});

// ═══ AUDIT STAFF-PANEL1 (the step's flaw review, 2026-10-22): each hole it found, pinned shut ═══

test('AUDIT STAFF-PANEL1: a refusal\'s audit row is written off the answer\'s path - a right password costs a wrong one\'s time', async () => {
  const s = await stand();
  await s.registered('SirMcMobdon');
  const later = [];
  const ask = (body) => worker.fetch(new Request('https://accounts.invalid/v1/staff/login', {
    method: 'POST', headers: { 'content-type': 'application/json', 'cf-connecting-ip': '198.51.100.7' }, body: JSON.stringify(body),
  }), s.env, { waitUntil: (p) => later.push(p) });
  const junk = { pub: s.mobKey.pub, ts: nowS(), sig: b64url(new Uint8Array(64)) };
  assert.equal((await ask({ handle: 'SirMcMobdon', password: 'not it at all', ...junk })).status, 401);
  assert.equal(later.length, 0, 'neither lock: nothing to write');
  assert.equal((await ask({ handle: 'SirMcMobdon', password: PASSWORD, ...junk })).status, 401);
  assert.equal(later.length, 1, 'the password right, the key not: the row handed to waitUntil, never awaited before the answer');
  await Promise.all(later);
  assert.equal(s.raw.prepare("SELECT COUNT(*) AS n FROM staff_audit WHERE act = 'login-refused'").get().n, 1, 'and it lands');
});

test('AUDIT STAFF-PANEL1: an owner\'s config key, cut or forgotten, stays out - and its spent sign-ins stay spent', async () => {
  const s = await stand({ OWNER_KEYS: 'placeholder' });
  const latty = await extensionKey();
  s.env.OWNER_KEYS = `SirMcMobdon:${s.mobKey.pub},Lattymoy:${latty.pub}`;
  await s.registered('SirMcMobdon');
  await s.registered('Lattymoy');
  const me = await s.mobIn();
  const lat = await s.login('Lattymoy', latty);
  assert.equal(lat.status, 200);
  assert.equal((await s.staff('/v1/staff/cut', { handle: 'SirMcMobdon' }, { token: lat.body.session })).status, 200);
  assert.equal((await s.staff('/v1/staff/me', {}, { token: me.session })).status, 401, 'cut: the session ends');
  assert.equal((await s.login('SirMcMobdon', s.mobKey)).status, 401, 'and the config key does not bring them back');
  // forget: a body already used once is not used again once its key is forgotten
  const body = { handle: 'Lattymoy', password: PASSWORD, ...(await latty.proof('login', 'Lattymoy')) };
  const again = await s.staff('/v1/staff/login', body);
  assert.equal(again.status, 200);
  const keyId = again.body.keyId;
  assert.equal((await s.staff('/v1/staff/key/forget', { id: keyId }, { token: again.body.session })).status, 200);
  assert.equal((await s.staff('/v1/staff/login', body)).status, 401, 'the spent body, replayed after the forget');
  assert.equal((await s.login('Lattymoy', latty)).status, 401, 'and a fresh one from the forgotten key');
  assert.equal(s.raw.prepare('SELECT COUNT(*) AS n FROM staff_keys WHERE revoked_at IS NOT NULL').get().n, 2, 'revoked, never deleted');
});

test('AUDIT STAFF-PANEL1: a config key stands only while the config names it, for an owner', async () => {
  const s = await stand();
  await s.registered('SirMcMobdon');
  await s.registered('Asynian');
  const me = await s.mobIn();
  s.env.OWNER_KEYS = '';
  assert.equal((await s.staff('/v1/staff/me', {}, { token: me.session })).status, 401, 'taken out of the config: its session ends');
  assert.equal((await s.login('SirMcMobdon', s.mobKey)).status, 401, 'and it signs in no more');
  // a Moderator named in OWNER_KEYS is no owner, so the config key opens nothing for them
  const asyKey = await extensionKey();
  s.env.OWNER_KEYS = `Asynian:${asyKey.pub}`;
  assert.equal((await s.login('Asynian', asyKey)).status, 401);
});

test('AUDIT STAFF-PANEL1: the signed second is within STAFF_SIG_S either way, from a key\'s first sign-in', async () => {
  for (const [off, want] of [[STAFF_SIG_S + 1, 401], [-(STAFF_SIG_S + 1), 401], [-(STAFF_SIG_S - 5), 200]]) {
    const s = await stand();
    await s.registered('SirMcMobdon');
    const r = await s.login('SirMcMobdon', { proof: (w, h) => s.mobKey.proof(w, h, nowS() + off) });
    assert.equal(r.status, want, `signed ${off} s from now`);
  }
});

test('AUDIT STAFF-PANEL1: invites - one live a member, 24 hours, and one key from one invite however the enrolments race', async () => {
  const s = await stand();
  await s.registered('SirMcMobdon');
  const asy = await s.registered('Asynian');
  const me = await s.mobIn();
  const first = await s.staff('/v1/staff/invite', { handle: 'Asynian' }, { token: me.session });
  const second = await s.staff('/v1/staff/invite', { handle: 'Asynian' }, { token: me.session });
  assert.equal((await s.enrol('Asynian', await extensionKey(), first.body.invite)).status, 401, 'the first invite, replaced by the second');
  s.raw.prepare('UPDATE staff_invites SET expires_at = ? WHERE player_id = ?').run(nowS() - 1, asy.id);
  assert.equal((await s.enrol('Asynian', await extensionKey(), second.body.invite)).status, 401, 'past its 24 hours');
  const third = await s.staff('/v1/staff/invite', { handle: 'Asynian' }, { token: me.session });
  const [a, b] = await Promise.all([s.enrol('Asynian', await extensionKey(), third.body.invite), s.enrol('Asynian', await extensionKey(), third.body.invite)]);
  assert.deepEqual([a.status, b.status].sort(), [200, 401], 'two at once: one key');
  assert.equal(s.raw.prepare('SELECT COUNT(*) AS n FROM staff_keys WHERE player_id = ?').get(asy.id).n, 1);
});

test('AUDIT STAFF-PANEL1: renamed onto another listed handle, a key opens nothing', async () => {
  const s = await stand();
  await s.registered('SirMcMobdon');
  const asy = await s.registered('Asynian');
  const me = await s.mobIn();
  const mod = await s.invited('Asynian', me);
  s.raw.prepare("UPDATE players SET handle = 'Fangy', handle_lc = 'fangy' WHERE id = ?").run(asy.id);
  assert.equal((await s.staff('/v1/staff/me', {}, { token: mod.session })).status, 401, 'the open session ends');
  assert.equal((await s.login('Fangy', mod.key)).status, 401, 'Fangy is listed, but this key was registered as Asynian');
});

test('STAFF-PANEL1: an Admin adds and removes Moderators from the panel (mob, 07:42Z: "add it so admins can add or remove moderatoers") - the account\'s, so a rename keeps it; the config\'s own stay the config\'s; a Moderator may not; removed is off the panel at once, keys and all; each change written ok (mutants: a mod added read failed; a mod removed read failed)', async () => {
  const s = await stand({ DEVELOPER_HANDLES: 'Lattymoy,SirMcMobdon,Roderic' });
  await s.registered('SirMcMobdon');
  await s.registered('Roderic');
  await s.registered('Asynian');
  const p1 = await s.registered('Player1');
  const b1 = await s.registered('Banned1');
  const me = await s.mobIn();
  const admin = await s.invited('Roderic', me);
  assert.deepEqual([admin.role, admin.owner], ['admin', false], 'an Admin who is no owner');
  const as = (path, body = {}, who = admin) => s.staff(path, body, { token: who.session });
  const row = () => s.raw.prepare('SELECT * FROM players WHERE id = ?').get(p1.id);
  assert.deepEqual([canModerate(row(), s.env), staffRole(row(), s.env)], [false, null]);
  const add = await as('/v1/staff/mod/add', { handle: 'player1' });
  assert.deepEqual([add.status, add.body], [200, { ok: true, handle: 'Player1' }]);
  assert.deepEqual([canModerate(row(), s.env), staffRole(row(), s.env)], [true, 'moderator'], 'they moderate - mute, ban, the reports - and are a Moderator on the panel');
  assert.ok(glyphsOf(row(), s.env, nowS()).includes('mod'), 'and wear the shield, as a listed one does');
  assert.deepEqual([(await as('/v1/staff/mod/add', { handle: 'Player1' })).body.error, (await as('/v1/staff/mod/add', { handle: 'Asynian' })).body.error, (await as('/v1/staff/mod/add', { handle: 'Roderic' })).body.error], ['staff-already', 'staff-already', 'staff-already'], 'twice is once; a listed Moderator and an Admin are staff already');
  assert.deepEqual([(await as('/v1/staff/mod/add', { handle: 'Nobody' })).status, (await as('/v1/staff/mod/add', {})).body.error], [404, 'no-player']);
  s.raw.prepare('UPDATE players SET banned_until = ? WHERE id = ?').run(nowS() + 3600, b1.id);
  assert.equal((await as('/v1/staff/mod/add', { handle: 'Banned1' })).body.error, 'staff-banned');
  const list = await as('/v1/staff/mods');
  assert.deepEqual(list.body.mods.map((m) => m.handle), ['Player1']);
  assert.ok(list.body.config.includes('asynian') && !list.body.config.includes('roderic'), 'the config\'s Moderators named apart, its Admins not among them');
  const team = await s.staff('/v1/staff/team', {}, { token: me.session });
  assert.equal(team.body.team.find((m) => m.handle === 'Player1')?.role, 'moderator', 'the owners\' team shows them');
  // the account's, not the handle's: a rename keeps it, and the handle it left gives nothing to its next holder
  s.raw.prepare("UPDATE players SET handle = 'Player2', handle_lc = 'player2' WHERE id = ?").run(p1.id);
  assert.equal(canModerate(row(), s.env), true);
  const next = await s.registered('Player1');
  assert.equal(canModerate(s.raw.prepare('SELECT * FROM players WHERE id = ?').get(next.id), s.env), false);
  s.raw.prepare("UPDATE players SET handle = 'Player1B', handle_lc = 'player1b' WHERE id = ?").run(next.id);
  s.raw.prepare("UPDATE players SET handle = 'Player1', handle_lc = 'player1' WHERE id = ?").run(p1.id);
  // a key the usual way: an owner's invite
  const mod = await s.invited('Player1', me);
  assert.equal(mod.role, 'moderator');
  for (const path of ['/v1/staff/mods', '/v1/staff/mod/add', '/v1/staff/mod/remove']) {
    const r = await as(path, { handle: 'Player1' }, mod);
    assert.deepEqual([r.status, r.body.error], [403, 'staff-admin'], `a Moderator may not: ${path}`);
  }
  // the config's own are the config's to remove
  assert.deepEqual([(await as('/v1/staff/mod/remove', { handle: 'Asynian' })).body.error, (await as('/v1/staff/mod/remove', { handle: 'Roderic' })).body.error, (await as('/v1/staff/mod/remove', { handle: 'Banned1' })).body.error], ['staff-config', 'staff-config', 'no-staff']);
  s.env.MODERATOR_HANDLES = 'Asynian,Player1';
  assert.equal((await as('/v1/staff/mod/remove', { handle: 'Player1' })).body.error, 'staff-config', 'listed as well: the config holds them still');
  s.env.MODERATOR_HANDLES = 'Asynian';
  // removed: off at once, its keys, sessions and invites with it
  assert.deepEqual((await as('/v1/staff/mod/remove', { handle: 'Player1' })).body, { ok: true, handle: 'Player1' });
  assert.deepEqual([canModerate(row(), s.env), row().staff_mod], [false, 0]);
  assert.equal((await s.staff('/v1/staff/me', {}, { token: mod.session })).status, 401, 'their open session ends');
  assert.equal((await s.login('Player1', mod.key)).status, 401, 'and their key opens nothing');
  assert.equal(s.raw.prepare('SELECT COUNT(*) AS n FROM staff_keys WHERE player_id = ? AND revoked_at IS NULL').get(p1.id).n, 0);
  assert.equal((await as('/v1/staff/mod/remove', { handle: 'Player1' })).body.error, 'no-staff', 'twice is once');
  const acts = s.raw.prepare('SELECT act, target FROM staff_audit WHERE actor = ? ORDER BY id').all(admin.id ?? s.raw.prepare("SELECT id FROM players WHERE handle_lc = 'roderic'").get().id).map((a) => a.act);
  assert.deepEqual(acts.filter((a) => a.startsWith('mod')), ['mod-add', 'mods-read', 'mod-remove'], 'every change and read a row');
  assert.deepEqual(s.raw.prepare("SELECT outcome FROM staff_audit WHERE act LIKE 'mod-%' ORDER BY id").all().map((r) => r.outcome), ['ok', 'ok'], 'done, and said so');
});
