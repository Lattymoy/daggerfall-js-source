// STAFF-PANEL5-HIDDEN (2026-10-22, mob: "no tag no faint outline nothing just nothing", "true invis not lattys invis", "we
// want the player to have no idea we are wathcing them"; design doc "DFO Staff Panel: design", Invisible follow and Flat
// map's Hide me) - THE ACCOUNT SERVICE'S HALF (server-account/src/staffHidden.js), driven through the real Worker on the
// node:sqlite database every account pin stands on (test/accountDb.mjs): Hide me and Show myself (off by default since
// STAFF-HIDE-TOGGLE, migration 0165, the tests at the end; the rest press Hide me first, in stand()); the game's
// own token mint, for an Admin or a Moderator holding a live staff session while hidden, minting the spectator's token
// (`hd: 1`, a subject of the session's, no name of the account's) with an audit row each; a hide order pushed to the
// relay's door when the mark lapses; and the relay's signed note of a private home entered. tools/mutants/staff-panel5-hidden.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { standService } from '../accountDb.mjs';
import { staffWords, STAFF_SESSION_HEADER } from '../../server-account/src/staff.js';
import { STAFF_ROUTES } from '../../server-account/src/service.js';
import { HIDDEN_ROUTES, HIDDEN_NAME, HIDDEN_GLYPHS, hiddenSubOf } from '../../server-account/src/staffHidden.js';
import { SAFE_LAW_PATH } from '../../src/net/wire.js';
import { verifyToken, verifyOrder, mintToken, mintHideOrder, mintOrder, claimsValid, orderValid, ORDER_KINDS } from '../../src/net/identityToken.js';
import { sealHiddenSeen, hiddenSeenValid, openHiddenSeen, HIDDEN_SEEN_PATH, HIDDEN_SEEN_SIG_HEADER, HIDDEN_SEEN_V, HIDDEN_SEEN_AGE_MAX_MS, HIDDEN_SEEN_MAX_BYTES } from '../../src/net/hiddenSeen.js';

const { subtle } = globalThis.crypto;
const enc = new TextEncoder();
const nowS = () => Math.floor(Date.now() / 1000);
const PASSWORD = 'a good long one';
const RELAY = 'https://relay.example' + SAFE_LAW_PATH;
const b64url = (bytes) => Buffer.from(bytes).toString('base64url');
const claimsOf = (tok) => JSON.parse(Buffer.from(tok.split('.')[1], 'base64url').toString('utf8'));

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

/** The Worker with the panel set up (test/server/staffpanel2.test.js's own), the relay's door recorded: mob (an Admin and
 *  owner) signed in, Asynian and Tabbyvish (Moderators) invited and signed in, and Troll and Sylvia, two players.
 *  STAFF-HIDE-TOGGLE: with `hide` (the default here), each staff member signed in or enrolled presses Hide me - it is off
 *  until pressed (migration 0165), and every test before the toggle's own is of a hidden staff member. */
async function stand({ hide = true } = {}) {
  const mobKey = await extensionKey();
  const s = await standService({
    DEVELOPER_HANDLES: 'Lattymoy,SirMcMobdon', MODERATOR_HANDLES: 'Asynian,Tabbyvish', OWNER_HANDLES: 'Lattymoy,SirMcMobdon',
    OWNER_KEYS: `SirMcMobdon:${mobKey.pub}`, RELAY_LAW_URL: RELAY,
  });
  const pushed = [];
  const real = globalThis.fetch;
  globalThis.fetch = async (url, init) => { if (String(url) === RELAY) { pushed.push(JSON.parse(init.body).order); return Response.json({ ok: true }); } return real(url, init); };
  const staff = async (path, body = {}, token = null) => {
    const res = await s.fetch(`https://accounts.invalid${path}`, {
      method: 'POST', headers: { 'content-type': 'application/json', 'cf-connecting-ip': '203.0.113.1', ...(token ? { [STAFF_SESSION_HEADER]: token } : {}) }, body: JSON.stringify(body),
    });
    return { status: res.status, body: await res.json().catch(() => null) };
  };
  const game = {};
  for (const h of ['SirMcMobdon', 'Asynian', 'Tabbyvish', 'Troll', 'Sylvia']) game[h] = await s.registered(h);
  const raw = s.env.DB._raw;
  const mob = (await staff('/v1/staff/login', { handle: 'SirMcMobdon', password: PASSWORD, ...(await mobKey.proof('login', 'SirMcMobdon')) })).body;
  const hideOn = async (session) => { if (hide) assert.deepEqual((await staff('/v1/staff/hide', { on: true }, session)).body, { hidden: true }); };
  await hideOn(mob.session);
  const enrol = async (handle) => {
    const inv = await staff('/v1/staff/invite', { handle }, mob.session);
    const key = await extensionKey();
    const r = await staff('/v1/staff/enroll', { handle, password: PASSWORD, invite: inv.body.invite, ...(await key.proof('enroll', handle)) });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    await hideOn(r.body.session);
    return { ...r.body, key };
  };
  const asy = await enrol('Asynian');
  const tab = await enrol('Tabbyvish');
  /** The game's own mint, for `h`'s game session. */
  const mint = async (h) => (await s.call('/v1/auth/token', {}, game[h].secret));
  /** The hidden subjects `h`'s staff sessions mint - every one, newest first. */
  const subsOf = async (h) => Promise.all(raw.prepare('SELECT token_hash FROM staff_sessions WHERE player_id = ? ORDER BY created_at DESC').all(game[h].id).map((r) => hiddenSubOf(r.token_hash, subtle)));
  const audits = (act) => raw.prepare('SELECT * FROM staff_audit WHERE act = ? ORDER BY id').all(act);
  return { ...s, raw, staff, mob, mobKey, asy, tab, game, mint, subsOf, audits, enrol, pushed, restore: () => { globalThis.fetch = real; } };
}

test('STAFF-PANEL5-HIDDEN: the door is listed among the staff panel\'s and opens for no game session; the claim and the order are the token module\'s own law (mutants: the route unlisted; `hd` any value; a hide order with more; `hd` on another order)', async () => {
  assert.deepEqual([...HIDDEN_ROUTES], ['/v1/staff/hide']);
  for (const r of HIDDEN_ROUTES) assert.ok(STAFF_ROUTES.has(r), r);
  assert.equal(HIDDEN_NAME, 'Staff member');
  assert.deepEqual([...HIDDEN_GLYPHS], ['dev', 'mod', 'dm', 'shadowfang']);
  assert.ok(ORDER_KINDS.includes('hide'));
  const kp = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const t = nowS();
  const base = { s: 'gH0st5ubAAAAAAAAAAAAAAAA', n: 'Staff member', k: 'linked', i: t, e: t + 60 };
  assert.equal(claimsValid({ ...base, hd: 1 }), true, 'the mark');
  for (const hd of [0, 2, true, '1', null]) assert.equal(claimsValid({ ...base, hd }), false, `hd ${JSON.stringify(hd)}`);
  const tok = await mintToken({ s: base.s, n: base.n, k: 'linked', hd: 1 }, kp.privateKey, { subtle, nowS: t });
  assert.equal((await verifyToken(tok, kp.publicKey, { subtle, nowS: t })).claims.hd, 1, 'minted and verified with it');
  assert.equal(claimsOf(await mintToken({ s: base.s, n: base.n, k: 'linked' }, kp.privateKey, { subtle, nowS: t })).hd, undefined, 'and without it, none');
  const order = await mintHideOrder({ s: base.s }, kp.privateKey, { subtle, nowS: t });
  assert.deepEqual(claimsOf(order), { o: 'hide', s: base.s, hd: 0, i: t, e: t + 60 }, 'the hide order\'s exact shape');
  assert.equal((await verifyOrder(order, kp.publicKey, { subtle, nowS: t, kind: 'hide' })).ok, true);
  assert.equal((await verifyOrder(order, kp.publicKey, { subtle, nowS: t, kind: 'mute' })).ok, false, 'never another kind');
  assert.equal(orderValid({ o: 'hide', s: base.s, hd: 0, i: t, e: t + 60, mu: 5 }), false, 'nothing more on it');
  assert.equal(orderValid({ o: 'hide', s: base.s, hd: 1, i: t, e: t + 60 }), false, 'its hd is 0');
  assert.equal(orderValid({ o: 'hide', s: base.s, i: t, e: t + 60 }), false, 'and said');
  assert.equal(orderValid({ o: 'mute', s: base.s, mu: t + 5, hd: 0, i: t, e: t + 60 }), false, 'no other order wears it');
  assert.equal(orderValid(claimsOf(await mintOrder({ s: base.s, mu: t + 5 }, kp.privateKey, { subtle, nowS: t }))), true, 'a mute is as it was');
  const s = await stand();
  try {
    assert.deepEqual([(await s.staff('/v1/staff/hide', {})).status, (await s.staff('/v1/staff/hide', {})).body], [401, { error: 'staff-session' }]);
    assert.equal((await s.staff('/v1/staff/hide', { on: false }, s.game.Troll.secret)).status, 401, 'a game secret is no staff session');
  } finally { s.restore(); }
});

test('STAFF-PANEL5-HIDDEN: HIDE ME (pressed - STAFF-HIDE-TOGGLE made it off by default) - an Admin\'s and a Moderator\'s game mint while their staff session is live is the spectator\'s token: `hd`, the session\'s own subject (never the account\'s), "Staff member", the staff glyphs alone, every mint a `hidden-token` row written before it (mutants: the switch unread; the session unread; the account\'s subject; the account\'s name; a cosmetic glyph; the row after the token or never)', async () => {
  const s = await stand();
  try {
    for (const [h, session] of [['SirMcMobdon', s.mob.session], ['Asynian', s.asy.session]]) {
      assert.deepEqual((await s.staff('/v1/staff/hide', {}, session)).body, { hidden: true }, `${h}: Hide me, pressed (stand)`);
      const r = await s.mint(h);
      assert.equal(r.status, 200);
      const [sub] = await s.subsOf(h);
      const c = (await verifyToken(r.body.token, s.identityPublic, { subtle, nowS: nowS() })).claims;
      assert.equal(c.hd, 1, `${h}: the spectator's mark`);
      assert.equal(c.s, sub, 'its subject the staff session\'s');
      assert.notEqual(c.s, s.game[h].id, 'never the account\'s');
      assert.equal(c.n, HIDDEN_NAME, 'and never its name');
      assert.equal(c.t, undefined, 'no title');
      for (const g of c.g ?? []) assert.ok(HIDDEN_GLYPHS.includes(g), `a staff glyph alone (${g})`);
      assert.equal(r.body.hidden, 1); assert.equal(r.body.sub, sub); assert.equal(r.body.name, HIDDEN_NAME);
      assert.equal(r.body.accountName, h, 'the staff member\'s own page still knows who it is');
      for (const k of ['title', 'guild', 'aura', 'icon', 'ribbon', 'house', 'level', 'xp']) assert.equal(r.body[k], null, k);
      const again = await s.mint(h);
      assert.equal(claimsOf(again.body.token).s, sub, 'the same subject for every socket of one session');
    }
    const rows = s.audits('hidden-token');
    assert.equal(rows.length, 4, 'every hidden token minted is a row');
    const mobSub = (await s.subsOf('SirMcMobdon'))[0];
    assert.equal(rows[0].actor, s.game.SirMcMobdon.id, 'the real account, in the audit log alone');
    assert.deepEqual(JSON.parse(rows[0].detail), { sub: mobSub });
    assert.equal(rows[0].role, 'admin'); assert.equal(rows[2].role, 'moderator');
    assert.ok(rows[0].key_id, 'with the key its session signed in by');
    // every other account: the token it always minted
    for (const h of ['Troll', 'Sylvia']) {
      const c = claimsOf((await s.mint(h)).body.token);
      assert.equal(c.hd, undefined, `${h}: no mark`); assert.equal(c.s, s.game[h].id);
    }
    // a staff member with no live staff session: a player's token
    s.raw.prepare('UPDATE staff_sessions SET last_act = 0 WHERE player_id = ?').run(s.game.Tabbyvish.id);
    const tab = claimsOf((await s.mint('Tabbyvish')).body.token);
    assert.equal(tab.hd, undefined, 'a session gone idle hides nobody');
    assert.equal(tab.s, s.game.Tabbyvish.id);
    s.raw.prepare('UPDATE staff_sessions SET expires_at = 0 WHERE player_id = ?').run(s.game.Asynian.id);
    // STAFF-PANEL5-HIDDEN-FIX: Asynian's game was minted hidden by the session now past its life - no token, never a shown one
    assert.deepEqual(await s.mint('Asynian'), { status: 409, body: { error: 'staff-session-lapsed' } }, 'nor one expired - and one that hid the game shows nobody');
    assert.equal(s.audits('hidden-token').length, 4, 'and writes no row');
    // a member the role lists no longer name, their session row still standing: a player's token
    const mods = s.env.MODERATOR_HANDLES;
    s.env.MODERATOR_HANDLES = 'Tabbyvish';
    s.raw.prepare('UPDATE staff_sessions SET expires_at = ?, last_act = ? WHERE player_id = ?').run(nowS() + 600, nowS(), s.game.Asynian.id);
    assert.equal(claimsOf((await s.mint('Asynian')).body.token).hd, undefined, 'no role, no mark');
    s.env.MODERATOR_HANDLES = mods;
    assert.equal(claimsOf((await s.mint('Asynian')).body.token).hd, 1, 'named again, hidden again');
    // an owner's session by a key the config no longer names stands no more (staff.js staffSession's law)
    const keys = s.env.OWNER_KEYS;
    s.env.OWNER_KEYS = 'SirMcMobdon:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
    assert.deepEqual(await s.mint('SirMcMobdon'), { status: 409, body: { error: 'staff-session-lapsed' } }, 'a key out of the config hides nobody - and, the game it hid, shows nobody either (STAFF-PANEL5-HIDDEN-FIX)');
    s.env.OWNER_KEYS = keys;
    assert.equal(claimsOf((await s.mint('SirMcMobdon')).body.token).hd, 1, 'and back in it, hidden again');
  } finally { s.restore(); }
});

test('STAFF-PANEL5-HIDDEN: SHOW MYSELF - the switch off is written with its row, the hidden sockets\' subjects are each pushed a hide order, and the next mint is the account\'s own; on again hides the same session again (mutants: the switch unwritten; the row unwritten; no order pushed; the order for the account\'s id)', async () => {
  const s = await stand();
  try {
    const [sub] = await s.subsOf('SirMcMobdon');
    const pressed = s.audits('hide').length;   // STAFF-HIDE-TOGGLE: stand()'s own Hide me, a row each member
    assert.equal(s.raw.prepare('SELECT staff_hide_on FROM players WHERE id = ?').get(s.game.SirMcMobdon.id).staff_hide_on, 1, 'pressed: on');
    assert.equal((await s.staff('/v1/staff/hide', { on: 'no' }, s.mob.session)).body.error, 'body');
    assert.deepEqual((await s.staff('/v1/staff/hide', { on: false }, s.mob.session)).body, { hidden: false });
    assert.equal(s.raw.prepare('SELECT staff_hide_on FROM players WHERE id = ?').get(s.game.SirMcMobdon.id).staff_hide_on, 0);
    assert.deepEqual(s.audits('hide').slice(pressed).map((r) => [r.actor, JSON.parse(r.detail)]), [[s.game.SirMcMobdon.id, { on: false }]]);
    assert.equal(s.pushed.length, 1, 'one hide order, for the one session');
    const o = await verifyOrder(s.pushed[0], s.identityPublic, { subtle, nowS: nowS(), kind: 'hide' });
    assert.equal(o.ok, true); assert.equal(o.claims.s, sub, 'naming the session\'s hidden subject');
    assert.deepEqual((await s.staff('/v1/staff/hide', {}, s.mob.session)).body, { hidden: false });
    const shown = claimsOf((await s.mint('SirMcMobdon')).body.token);
    assert.equal(shown.hd, undefined, 'shown'); assert.equal(shown.s, s.game.SirMcMobdon.id);
    assert.deepEqual((await s.staff('/v1/staff/hide', { on: true }, s.mob.session)).body, { hidden: true });
    assert.equal(s.pushed.length, 1, 'Hide me pushes nothing');
    assert.equal(claimsOf((await s.mint('SirMcMobdon')).body.token).s, sub, 'hidden again, as the same session');
    assert.deepEqual(s.audits('hide').slice(pressed).map((r) => JSON.parse(r.detail).on), [false, true]);
  } finally { s.restore(); }
});

test('STAFF-PANEL5-HIDDEN: THE MARK LAPSES WITH THE SESSION - a sign-out (one session or all), a key forgotten, an owner\'s cut and a Moderator removed each push a hide order for the subjects of the sessions they end, and the next mint shows the account (mutants: each door\'s push dropped; a sign-out of one pushing all)', async () => {
  const s = await stand();
  try {
    const verify = async (o) => (await verifyOrder(o, s.identityPublic, { subtle, nowS: nowS(), kind: 'hide' })).claims?.s;
    // a sign-out of one session
    const [asySub] = await s.subsOf('Asynian');
    await s.staff('/v1/staff/logout', {}, s.asy.session);
    assert.deepEqual(await Promise.all(s.pushed.map(verify)), [asySub], 'the sign-out\'s session');
    assert.equal(claimsOf((await s.mint('Asynian')).body.token).hd, undefined, 'and the next mint shows her');
    // a cut
    const [tabSub] = await s.subsOf('Tabbyvish');
    s.pushed.length = 0;
    assert.equal((await s.staff('/v1/staff/cut', { handle: 'Tabbyvish' }, s.mob.session)).status, 200);
    // the cut member's hide order, beside the cut's own (STAFF-PANEL2-FIX's staffcut, which closes their visible sockets)
    assert.deepEqual(await Promise.all(s.pushed.map(verify)), [tabSub, undefined], 'the cut member\'s');
    assert.equal((await verifyOrder(s.pushed[1], s.identityPublic, { subtle, nowS: nowS(), kind: 'staffcut' })).claims?.s, s.raw.prepare('SELECT id FROM players WHERE handle = ?').get('Tabbyvish').id);
    // a Moderator the panel added, then removed
    assert.equal((await s.staff('/v1/staff/mod/add', { handle: 'Sylvia' }, s.mob.session)).status, 200);
    await s.enrol('Sylvia');
    assert.equal(claimsOf((await s.mint('Sylvia')).body.token).hd, 1, 'a panel Moderator is hidden too');
    const [sylSub] = await s.subsOf('Sylvia');
    s.pushed.length = 0;
    assert.equal((await s.staff('/v1/staff/mod/remove', { handle: 'Sylvia' }, s.mob.session)).status, 200);
    assert.deepEqual(await Promise.all(s.pushed.map(verify)), [sylSub], 'the removed Moderator\'s');
    assert.equal(claimsOf((await s.mint('Sylvia')).body.token).hd, undefined, 'no staff, no mark');
    // a key forgotten: its sessions' subjects
    const keys = (await s.staff('/v1/staff/keys', {}, s.mob.session)).body.keys;
    const [mobSub] = await s.subsOf('SirMcMobdon');
    s.pushed.length = 0;
    assert.equal((await s.staff('/v1/staff/key/forget', { id: keys[0].id }, s.mob.session)).status, 200);
    assert.deepEqual(await Promise.all(s.pushed.map(verify)), [mobSub], 'the forgotten key\'s session');
  } finally { s.restore(); }
});

test('STAFF-PANEL5-HIDDEN: A SIGN-OUT of one session pushes its order alone; of every session, one for each (mutants: one read as all; all read as one)', async () => {
  const s = await stand();
  try {
    const login = async () => (await s.staff('/v1/staff/login', { handle: 'SirMcMobdon', password: PASSWORD, ...(await s.mobKey.proof('login', 'SirMcMobdon')) })).body.session;
    const subs = async () => new Set(await s.subsOf('SirMcMobdon'));
    const one = await subs();
    const two = await login();
    const both = await subs();
    assert.equal(both.size, 2, 'two sessions, two subjects');
    await s.staff('/v1/staff/logout', {}, two);
    assert.deepEqual(s.pushed.map((o) => claimsOf(o).s), [...both].filter((x) => !one.has(x)), 'the one session\'s subject alone');
    s.pushed.length = 0;
    await login();
    const again = await subs();
    assert.equal(again.size, 2);
    await s.staff('/v1/staff/logout', { all: true }, s.mob.session);
    assert.deepEqual(new Set(s.pushed.map((o) => claimsOf(o).s)), again, 'every session\'s');
  } finally { s.restore(); }
});

test('STAFF-PANEL5-HIDDEN: A PRIVATE HOME ENTERED - the relay\'s signed note is a `hidden-home` row as the staff member whose session minted the subject, once a minute; a note unsigned, forged, stale or of another shape is refused (mutants: the signature unread; the age unread; the subject unmatched; the row never written)', async () => {
  const s = await stand();
  try {
    const [sub] = await s.subsOf('SirMcMobdon');
    const room = `owned:${'a'.repeat(32)}.${'b'.repeat(16)}:17.200`;
    const note = (o = {}) => ({ v: HIDDEN_SEEN_V, id: '0123456789abcdef', at: Date.now(), s: sub, r: room, ...o });
    assert.equal(hiddenSeenValid(note()), true);
    for (const bad of [note({ v: 'x' }), note({ id: 'xyz' }), note({ r: 'world:1,2' }), note({ s: 'a b' }), { ...note(), extra: 1 }, null]) assert.equal(hiddenSeenValid(bad), false, JSON.stringify(bad));
    const post = async (body, sig) => s.fetch(`https://accounts.invalid${HIDDEN_SEEN_PATH}`, { method: 'POST', headers: { 'content-type': 'application/json', ...(sig ? { [HIDDEN_SEEN_SIG_HEADER]: sig } : {}) }, body });
    const sealed = await sealHiddenSeen(note(), s.gatePriv, { subtle });
    assert.ok(sealed);
    assert.equal((await post(sealed.body, null)).status, 401, 'unsigned');
    const forger = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
    const forged = await sealHiddenSeen(note(), forger.privateKey, { subtle });
    assert.equal((await post(forged.body, forged.sig)).status, 401, 'forged');
    const stale = await sealHiddenSeen(note({ at: Date.now() - HIDDEN_SEEN_AGE_MAX_MS - 60_000 }), s.gatePriv, { subtle });
    assert.equal((await post(stale.body, stale.sig)).status, 400, 'stale');
    assert.equal((await s.fetch(`https://accounts.invalid${HIDDEN_SEEN_PATH}`, { method: 'GET' })).status, 405);
    assert.equal((await post(new Uint8Array(HIDDEN_SEEN_MAX_BYTES + 1), sealed.sig)).status, 413);
    assert.equal(s.audits('hidden-home').length, 0, 'nothing refused is written');
    const res = await post(sealed.body, sealed.sig);
    assert.equal(res.status, 202);
    const again = await sealHiddenSeen(note({ id: 'fedcba9876543210' }), s.gatePriv, { subtle });
    assert.equal((await post(again.body, again.sig)).status, 202);
    const rows = s.audits('hidden-home');
    assert.equal(rows.length, 1, 'once a minute a room');
    assert.equal(rows[0].actor, s.game.SirMcMobdon.id, 'as the staff member whose session minted it');
    assert.deepEqual(JSON.parse(rows[0].detail), { sub, room });
    // a subject no session minted any more: the subject alone
    const lone = await sealHiddenSeen(note({ s: 'nOb0dyAAAAAAAAAAAAAAAAAA' }), s.gatePriv, { subtle });
    assert.equal((await post(lone.body, lone.sig)).status, 202);
    assert.equal(s.audits('hidden-home').at(-1).actor, null);
    assert.equal(JSON.parse(s.audits('hidden-home').at(-1).detail).sub, 'nOb0dyAAAAAAAAAAAAAAAAAA');
    // the opener's own laws
    assert.deepEqual(await openHiddenSeen(sealed.body, sealed.sig, null, { subtle, nowMs: Date.now() }), { error: 'seen-closed' });
    assert.equal((await openHiddenSeen(new Uint8Array(0), sealed.sig, forger.publicKey, { subtle, nowMs: Date.now() })).error, 'seen-shape');
  } finally { s.restore(); }
});

// ═══ STAFF-PANEL5-HIDDEN-FIX (the relay flaw review, findings 4/15 and 14) ═══

test('STAFF-PANEL5-HIDDEN-FIX: A HIDDEN SESSION THAT LAPSES SHOWS NOBODY - the game it hid, its session gone idle, past its 8 hours or deleted by the panel\'s own poll, is minted no token at all (409 staff-session-lapsed, a `hidden-lapsed` row a minute) and never a visible one; signed in again it is hidden again; only the staff member\'s own word shows it - a sign-out by that key, a sign-out of every session, or Show myself (mutants: the lapse unread; the refusal unwritten; the refusal a 200; any key\'s sign-out ends it; a sign-out of all unread; the own key\'s unread; Show myself unread; the oldest row read)', async () => {
  const s = await stand();
  try {
    const login = async () => (await s.staff('/v1/staff/login', { handle: 'SirMcMobdon', password: PASSWORD, ...(await s.mobKey.proof('login', 'SirMcMobdon')) })).body.session;
    const idle = (h) => s.raw.prepare('UPDATE staff_sessions SET last_act = 0 WHERE player_id = ?').run(s.game[h].id);
    const LAPSED = { status: 409, body: { error: 'staff-session-lapsed' } };
    // Tabbyvish: hidden by her first key's session; a second key's session signs out - her first's game stays hidden, then lapses
    assert.equal(claimsOf((await s.mint('Tabbyvish')).body.token).hd, 1);
    const tab2 = await s.enrol('Tabbyvish');
    await s.staff('/v1/staff/logout', {}, tab2.session);
    idle('Tabbyvish');
    assert.deepEqual(await s.mint('Tabbyvish'), LAPSED, 'another key\'s sign-out ends nothing of this one\'s');
    // a sign-out of every session, by any key, ends it
    const tab3 = await s.enrol('Tabbyvish');
    await s.staff('/v1/staff/logout', { all: true }, tab3.session);
    assert.equal(claimsOf((await s.mint('Tabbyvish')).body.token).s, s.game.Tabbyvish.id, 'every session signed out: shown');
    // mob: hidden, then idle - the panel's own poll deletes the dead session, and the game is still minted nothing
    assert.equal(claimsOf((await s.mint('SirMcMobdon')).body.token).hd, 1);
    idle('SirMcMobdon');
    assert.deepEqual(await s.mint('SirMcMobdon'), LAPSED, 'gone idle: nothing');
    assert.equal((await s.staff('/v1/staff/me', { poll: true }, s.mob.session)).status, 401);
    assert.equal(s.raw.prepare('SELECT COUNT(*) AS n FROM staff_sessions WHERE player_id = ?').get(s.game.SirMcMobdon.id).n, 0, 'the dead session deleted');
    assert.deepEqual(await s.mint('SirMcMobdon'), LAPSED, 'and still nothing');
    const lapsed = s.audits('hidden-lapsed');
    assert.deepEqual(lapsed.map((r) => [r.actor, r.role, r.outcome]), [[s.game.Tabbyvish.id, 'moderator', 'denied'], [s.game.SirMcMobdon.id, 'admin', 'denied']], 'written, once a minute a member');
    // signed in again: hidden again, its new session's subject; its own sign-out shows it
    const two = await login();
    const c2 = claimsOf((await s.mint('SirMcMobdon')).body.token);
    assert.equal(c2.hd, 1, 'hidden again');
    await s.staff('/v1/staff/logout', {}, two);
    assert.equal(claimsOf((await s.mint('SirMcMobdon')).body.token).s, s.game.SirMcMobdon.id, 'its own sign-out: shown, by the staff member\'s word');
    // hidden once more, lapsed: the newest hidden mint is the one read, the sign-out before it ends nothing after it
    const three = await login();
    assert.equal(claimsOf((await s.mint('SirMcMobdon')).body.token).hd, 1);
    idle('SirMcMobdon');
    assert.deepEqual(await s.mint('SirMcMobdon'), LAPSED, 'an older sign-out ends no newer hiding');
    void three;
    // Show myself ends it: signed in, shown, hidden again with no game mint between - then lapsed, the game was shown last
    const four = await login();
    await s.staff('/v1/staff/hide', { on: false }, four);
    await s.staff('/v1/staff/hide', { on: true }, four);
    idle('SirMcMobdon');
    assert.equal(claimsOf((await s.mint('SirMcMobdon')).body.token).s, s.game.SirMcMobdon.id, 'Show myself: shown');
    // never hidden, never held: Asynian's session lapses before any game mint
    idle('Asynian');
    assert.equal(claimsOf((await s.mint('Asynian')).body.token).s, s.game.Asynian.id, 'a staff member whose game was never hidden plays as ever');
    // nobody else reads it
    assert.equal(claimsOf((await s.mint('Troll')).body.token).s, s.game.Troll.id);
  } finally { s.restore(); }
});

test('STAFF-PANEL5-HIDDEN-FIX: A FOLLOW EYE IN A PRIVATE HOME is the staff member\'s - the relay\'s note of the follow token\'s subject is a `hidden-home` row as the Moderator whose session minted it, whatever room the token was asked for; and the follow row names that subject (mutants: the follow subject unmatched; the follow row\'s subject unwritten)', async () => {
  const s = await stand();
  try {
    const f = await s.staff('/v1/staff/follow', { sub: s.game.Troll.id, room: 'world:1,1' }, s.asy.session);
    assert.equal(f.status, 200, JSON.stringify(f.body));
    const eye = claimsOf(f.body.token).s;
    assert.ok(eye.startsWith('hd-'));
    assert.notEqual(eye, (await s.subsOf('Asynian'))[0], 'a follow eye\'s subject, not the Hide me game\'s');
    assert.deepEqual(JSON.parse(s.audits('follow')[0].detail), { sub: eye }, 'the follow row names its subject');
    const room = `owned:${'a'.repeat(32)}.${'b'.repeat(16)}:17.200`;
    const sealed = await sealHiddenSeen({ v: HIDDEN_SEEN_V, id: '0123456789abcdef', at: Date.now(), s: eye, r: room }, s.gatePriv, { subtle });
    const res = await s.fetch(`https://accounts.invalid${HIDDEN_SEEN_PATH}`, { method: 'POST', headers: { 'content-type': 'application/json', [HIDDEN_SEEN_SIG_HEADER]: sealed.sig }, body: sealed.body });
    assert.equal(res.status, 202);
    const [row] = s.audits('hidden-home');
    assert.deepEqual([row.actor, row.role, JSON.parse(row.detail)], [s.game.Asynian.id, 'moderator', { sub: eye, room }], 'as the Moderator who followed');
    assert.ok(row.key_id, 'with the key her session signed in by');
  } finally { s.restore(); }
});

// ═══ STAFF-PANEL5-HIDDEN-R2 (the relay fixes' second round: finding 14's regression and gap, finding 28's second half,
// the cut's follow eyes) ═══

test('STAFF-PANEL5-HIDDEN-R2: THE STAFF MEMBER\'S OWN WORD ENDS A HIDING, SESSION BY SESSION - the key that hid the game forgotten, from its own session, brings the game back as a normal player (never refused for good); another key forgotten ends nothing; of two sessions on one key, the older signing out ends nothing of the newer\'s, which lapsed is refused (mutants: the forget unread; any key\'s forget; a sign-out read by its key)', async () => {
  const s = await stand();
  try {
    const LAPSED = { status: 409, body: { error: 'staff-session-lapsed' } };
    const idle = (h) => s.raw.prepare('UPDATE staff_sessions SET last_act = 0 WHERE player_id = ?').run(s.game[h].id);
    // Asynian: hidden by her one key's session, which forgets that key - a normal player at once
    assert.equal(claimsOf((await s.mint('Asynian')).body.token).hd, 1);
    assert.equal((await s.staff('/v1/staff/key/forget', { id: s.asy.keyId }, s.asy.session)).status, 200);
    const back = await s.mint('Asynian');
    assert.equal(back.status, 200, JSON.stringify(back.body));
    assert.equal(claimsOf(back.body.token).s, s.game.Asynian.id, 'her key forgotten: shown, by her own word');
    // Tabbyvish: hidden by her first key's session; a second key forgotten ends nothing of the first's, which then lapses
    assert.equal(claimsOf((await s.mint('Tabbyvish')).body.token).hd, 1);
    const tab2 = await s.enrol('Tabbyvish');
    assert.equal((await s.staff('/v1/staff/key/forget', { id: tab2.keyId }, tab2.session)).status, 200);
    idle('Tabbyvish');
    assert.deepEqual(await s.mint('Tabbyvish'), LAPSED, 'another key forgotten: still nothing');
    // mob: two sessions on one key, the newer hid the game; the older signs out - its own subject's order alone
    s.raw.prepare('UPDATE staff_sessions SET created_at = created_at - 100 WHERE player_id = ?').run(s.game.SirMcMobdon.id);
    const [older] = await s.subsOf('SirMcMobdon');
    const newer = (await s.staff('/v1/staff/login', { handle: 'SirMcMobdon', password: PASSWORD, ...(await s.mobKey.proof('login', 'SirMcMobdon')) })).body.session;
    assert.ok(newer);
    const c = claimsOf((await s.mint('SirMcMobdon')).body.token);
    assert.equal(c.hd, 1);
    assert.equal(c.s, (await s.subsOf('SirMcMobdon'))[0], 'hidden by the newer session');
    s.pushed.length = 0;
    await s.staff('/v1/staff/logout', {}, s.mob.session);
    assert.deepEqual(s.pushed.map((o) => claimsOf(o).s), [older], 'the older session\'s subject alone');
    idle('SirMcMobdon');
    assert.deepEqual(await s.mint('SirMcMobdon'), LAPSED, 'the newer session lapsed: no visible token beside its open hidden sockets');
  } finally { s.restore(); }
});

test('STAFF-PANEL5-HIDDEN-R2: A MODERATOR REMOVED AND A STAFF MEMBER CUT ARE ORDERED OUT OF EVERY HIDDEN SOCKET THEY COULD HOLD - each Hide me game\'s and each follow eye\'s subject the log names, its staff session deleted by the panel\'s poll, a sign-in\'s prune or a new password, as one still live; a removal pushes no staffcut (mutants: the removal reads live sessions alone; the follow rows unread; the follow-home rows unread; a removal\'s staffcut)', async () => {
  const s = await stand();
  try {
    const hides = () => s.pushed.map(claimsOf).filter((o) => o.o === 'hide').map((o) => o.s);
    const SYL = s.game.Sylvia;
    assert.equal((await s.staff('/v1/staff/mod/add', { handle: 'Sylvia' }, s.mob.session)).status, 200);
    const syl = await s.enrol('Sylvia');
    const login = async () => {
      const r = await s.staff('/v1/staff/login', { handle: 'Sylvia', password: PASSWORD, ...(await syl.key.proof('login', 'Sylvia')) });
      assert.equal(r.status, 200, JSON.stringify(r.body));
      return r.body.session;
    };
    const idle = () => s.raw.prepare('UPDATE staff_sessions SET last_act = 0 WHERE player_id = ?').run(SYL.id);
    const subjects = [];
    const hid = async () => { const c = claimsOf((await s.mint('Sylvia')).body.token); assert.equal(c.hd, 1); subjects.push(c.s); };
    const follow = async (session, room) => {
      const f = await s.staff('/v1/staff/follow', { sub: s.game.Troll.id, room }, session);
      assert.equal(f.status, 200, JSON.stringify(f.body));
      subjects.push(claimsOf(f.body.token).s);
    };
    // her first session hides her game and follows Troll; gone idle, the panel's own poll deletes it
    await hid();
    await follow(syl.session, 'world:1,1');
    idle();
    assert.equal((await s.staff('/v1/staff/me', { poll: true }, syl.session)).status, 401);
    // her second: hidden, following Troll into his home (a `follow-home` row alone); idle, the next sign-in prunes it
    const second = await login();
    await hid();
    await follow(second, `owned:${'a'.repeat(32)}.${'b'.repeat(16)}:17.200`);
    idle();
    const third = await login();
    // her third: hidden; a new password ends it
    await hid();
    assert.equal((await s.call('/v1/account/password', { oldPassword: PASSWORD, password: 'another good long one' }, SYL.secret)).status, 200);
    assert.equal(s.raw.prepare('SELECT COUNT(*) AS n FROM staff_sessions WHERE player_id = ?').get(SYL.id).n, 0, 'every row deleted, each by its own door');
    void third;
    assert.equal(new Set(subjects).size, 5, 'three Hide me subjects and two follow eyes');
    s.pushed.length = 0;
    assert.equal((await s.staff('/v1/staff/mod/remove', { handle: 'Sylvia' }, s.mob.session)).status, 200);
    assert.deepEqual(new Set(hides()), new Set(subjects), 'each ordered closed');
    assert.equal(s.pushed.length, subjects.length, 'and nothing else: a removal is no cut');
    // a cut: Asynian's Hide me game and her follow eye, her session deleted by the panel's poll before it
    const asyHid = claimsOf((await s.mint('Asynian')).body.token).s;
    const f = await s.staff('/v1/staff/follow', { sub: s.game.Troll.id }, s.asy.session);
    const eye = claimsOf(f.body.token).s;
    s.raw.prepare('UPDATE staff_sessions SET last_act = 0 WHERE player_id = ?').run(s.game.Asynian.id);
    assert.equal((await s.staff('/v1/staff/me', { poll: true }, s.asy.session)).status, 401);
    s.pushed.length = 0;
    assert.equal((await s.staff('/v1/staff/cut', { handle: 'Asynian' }, s.mob.session)).status, 200);
    assert.deepEqual(new Set(hides()), new Set([asyHid, eye]), 'her hidden game\'s and her follow eye\'s');
    assert.deepEqual(s.pushed.map(claimsOf).filter((o) => o.o !== 'hide').map((o) => [o.o, o.s]), [['staffcut', s.game.Asynian.id]]);
  } finally { s.restore(); }
});

// ═══ STAFF-HIDE-TOGGLE (2026-10-23, mob: "i cant talk in chat?", "i need to be bale to talk in chat", "need hide to be a
// toggle") - Hide me off by default for every staff member, the accounts that stand today included (migration 0165), and a
// press that takes effect at the very next mint (the game remakes its links at once: test/net/staffpanel5hook.test.js).
// tools/mutants/staff-hide-toggle.json ═══

test('STAFF-HIDE-TOGGLE: HIDE ME, OFF BY DEFAULT - an Admin and a Moderator who never pressed it are shown, though 0159\'s `staff_hide` still says 1 on their rows; Hide me hides the very next mint and pushes nothing; Show myself orders the hidden subject closed and shows the next mint, as before (mutants: the default on; 0159\'s column read; the switch read as 0159 read it; the press written to 0159\'s column)', async () => {
  const s = await stand({ hide: false });
  try {
    for (const [h, session] of [['SirMcMobdon', s.mob.session], ['Asynian', s.asy.session]]) {
      const id = s.game[h].id;
      const row = s.raw.prepare('SELECT staff_hide, staff_hide_on FROM players WHERE id = ?').get(id);
      assert.deepEqual([row.staff_hide, row.staff_hide_on], [1, 0], `${h}: 0159's column says hidden, as on every row that stands - the switch says off`);
      assert.deepEqual((await s.staff('/v1/staff/hide', {}, session)).body, { hidden: false }, `${h}: Hide me, off by default`);
      const tokens = s.audits('hidden-token').length;
      const shown = await s.mint(h);
      assert.equal(shown.status, 200, JSON.stringify(shown.body));
      assert.deepEqual([claimsOf(shown.body.token).hd, claimsOf(shown.body.token).s, shown.body.hidden], [undefined, id, undefined], `${h}: shown, as the account`);
      assert.equal(s.audits('hidden-token').length, tokens, 'no hidden token minted');
      // Hide me: the very next mint is hidden - nothing waits for the game's next connection - and nothing is pushed
      assert.deepEqual((await s.staff('/v1/staff/hide', { on: true }, session)).body, { hidden: true });
      assert.equal(s.pushed.length, 0, 'Hide me pushes nothing');
      const [sub] = await s.subsOf(h);
      const hid = claimsOf((await s.mint(h)).body.token);
      assert.deepEqual([hid.hd, hid.s, hid.n], [1, sub, HIDDEN_NAME], `${h}: hidden at the next mint`);
      assert.deepEqual((await s.staff('/v1/staff/hide', {}, session)).body, { hidden: true });
      // Show myself: the hidden subject's order, and the next mint shown
      assert.deepEqual((await s.staff('/v1/staff/hide', { on: false }, session)).body, { hidden: false });
      assert.deepEqual(await Promise.all(s.pushed.map(async (o) => (await verifyOrder(o, s.identityPublic, { subtle, nowS: nowS(), kind: 'hide' })).claims?.s)), [sub], 'its hidden subject ordered closed');
      s.pushed.length = 0;
      assert.equal(claimsOf((await s.mint(h)).body.token).s, id, `${h}: shown at the next mint`);
    }
  } finally { s.restore(); }
});

test('STAFF-HIDE-TOGGLE: MIGRATION 0165 - every account that stands is shown, but one whose newest press since 0159 was Hide me: never pressed, Show myself last, Hide me then Show myself, a player, and an account made after it all shown; Show myself then Hide me kept hidden; 0159\'s column left as it was (mutants: the default on; the carry dropped; any press carried; the oldest press read; the newest row of any act read)', () => {
  const dir = new URL('../../server-account/migrations/', import.meta.url);
  const files = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
  const at = files.indexOf('0165_staff_hide_off.sql');
  assert.ok(at > 0, 'the migration stands');
  const db = new DatabaseSync(':memory:');
  for (const f of files.slice(0, at)) db.exec(readFileSync(new URL(f, dir), 'utf8'));
  const add = (id) => db.prepare('INSERT INTO players (id, guest_name, created_at, last_seen) VALUES (?, ?, 1, 1)').run(id, id);
  const row = (actor, act, detail) => db.prepare('INSERT INTO staff_audit (at, actor, act, detail) VALUES (1, ?, ?, ?)').run(actor, act, detail);
  const press = (actor, on) => row(actor, 'hide', JSON.stringify({ on }));
  for (const id of ['never', 'shown', 'kept', 'flipped', 'player']) add(id);
  press('shown', false);
  press('kept', false); press('kept', true); row('kept', 'logout', '{"all":false}');   // a later row of another act is no press
  press('flipped', true); press('flipped', false);
  row('player', 'follow', '{"on":true}');   // a row of another act that happens to read so is no press either
  const before = db.prepare('SELECT id, staff_hide FROM players ORDER BY id').all();
  assert.ok(before.every((r) => r.staff_hide === 1), 'before it: 0159 hides every row');
  db.exec(readFileSync(new URL(files[at], dir), 'utf8'));
  add('newcomer');
  const now = Object.fromEntries(db.prepare('SELECT id, staff_hide_on FROM players').all().map((r) => [r.id, r.staff_hide_on]));
  assert.deepEqual(now, { never: 0, shown: 0, kept: 1, flipped: 0, player: 0, newcomer: 0 }, 'off by default, the newest Hide me kept');
  assert.ok(db.prepare('SELECT staff_hide FROM players').all().every((r) => r.staff_hide === 1), '0159\'s column as it was, for an older Worker');
});

test('STAFF-HIDE-TOGGLE: A GAME HIDDEN BEFORE 0165 TURNED ITS SWITCH OFF IS NEVER LEFT WITH NO TOKEN - its session idle, and no Show myself row written for the move, it is minted its own visible token; a game the switch still hides is refused as ever (STAFF-PANEL5-HIDDEN-FIX) (mutants: the lapse read off the log alone)', async () => {
  const s = await stand();
  try {
    const idle = (h) => s.raw.prepare('UPDATE staff_sessions SET last_act = 0 WHERE player_id = ?').run(s.game[h].id);
    for (const h of ['SirMcMobdon', 'Asynian']) assert.equal(claimsOf((await s.mint(h)).body.token).hd, 1, `${h}: hidden`);
    // 0165's move for mob: the switch off, and no audit row says so
    s.raw.prepare('UPDATE players SET staff_hide_on = 0 WHERE id = ?').run(s.game.SirMcMobdon.id);
    idle('SirMcMobdon'); idle('Asynian');
    const back = await s.mint('SirMcMobdon');
    assert.equal(back.status, 200, JSON.stringify(back.body));
    assert.equal(claimsOf(back.body.token).s, s.game.SirMcMobdon.id, 'shown: his switch says off');
    assert.deepEqual(await s.mint('Asynian'), { status: 409, body: { error: 'staff-session-lapsed' } }, 'hers on: no token, never a shown one');
  } finally { s.restore(); }
});
