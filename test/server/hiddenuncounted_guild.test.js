// AUDIT HIDDEN-UNCOUNTED C1 (2026-10-25, the owner, asked how a hidden staff member reads in their guild: "Last seen when
// hid"; bible/01-Overview/audits/Audit-Hidden-Uncounted.md) - THE GUILD'S "N ONLINE" COUNTS NO HIDDEN STAFF MEMBER. The
// Members page read each member's play beat (guilds.js viewOf, GUILD-SEEN), which a hidden staff member's game knocks as
// any game does (the seat, Renown and the play clock read it), so the Members tile said "2 online" and the row "Online" -
// to the staff member and to every guildmate. Over the real Worker on node:sqlite (test/accountDb.mjs): Hide me pressed
// and the game minted hidden, the member reads as last online the moment they hid (staffHidden.js hiddenSince, the mint's
// own "hidden now"), in a guildmate's view and in their own (`hidden` on the reader's row alone, guildBook.js
// guildMemberOnline); Show myself and they are at play again; an account that is no staff reads as it always did.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { standService } from '../accountDb.mjs';
import { staffWords, STAFF_SESSION_HEADER } from '../../server-account/src/staff.js';
import { GUILD_RANK_NAMES, guildNameOf, guildNameKey } from '../../src/net/guild/guildLaw.js';
import { guildMemberOnline } from '../../src/net/guild/guildBook.js';
import { guildOnlineText } from '../../src/ui/socialPanel.js';
import { PLAY_GRACE_S } from '../../src/net/playClock.js';

const { subtle } = globalThis.crypto;
const enc = new TextEncoder();
const nowS = () => Math.floor(Date.now() / 1000);
const PASSWORD = 'a good long one';
const b64url = (bytes) => Buffer.from(bytes).toString('base64url');
const claimsOf = (tok) => JSON.parse(Buffer.from(tok.split('.')[1], 'base64url').toString('utf8'));

test('HIDDEN-UNCOUNTED (AUDIT C1): a hidden staff member is at play to nobody in their guild - a guildmate\'s Members page and their own read them as last online the moment they hid, "1 online" for two at play; Show myself and they are back; an account that is no staff with the switch set reads as it always did (mutants: the run\'s start unread; the reader\'s own row still online; the role unasked; `hidden` said of another member)', async () => {
  const pair = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const pub = b64url(new Uint8Array(await subtle.exportKey('raw', pair.publicKey)));
  const proof = async (what, handle) => { const ts = nowS(); return { pub, ts, sig: b64url(new Uint8Array(await subtle.sign({ name: 'Ed25519' }, pair.privateKey, enc.encode(staffWords(what, handle.toLowerCase(), ts))))) }; };
  const s = await standService({ DEVELOPER_HANDLES: 'SirMcMobdon', OWNER_HANDLES: 'SirMcMobdon', OWNER_KEYS: `SirMcMobdon:${pub}` });
  const staff = async (path, body, token) => {
    const res = await s.fetch(`https://accounts.invalid${path}`, { method: 'POST', headers: { 'content-type': 'application/json', 'cf-connecting-ip': '203.0.113.1', ...(token ? { [STAFF_SESSION_HEADER]: token } : {}) }, body: JSON.stringify(body) });
    return { status: res.status, body: await res.json().catch(() => null) };
  };
  const raw = s.env.DB._raw;
  const mob = await s.registered('SirMcMobdon'), troll = await s.registered('Troll');
  const t0 = nowS();
  const n = guildNameOf('The Hound');
  raw.prepare('INSERT INTO guilds (id, name, name_key, tag, ranks, treasury, founded_at) VALUES (?, ?, ?, ?, ?, 0, ?)').run('g0123456789', n, guildNameKey(n), 'HND', JSON.stringify(GUILD_RANK_NAMES), t0);
  for (const [who, rank, at] of [[troll, 0, 1], [mob, 2, 2]]) raw.prepare('INSERT INTO guild_members (player, char_id, guild_id, rank, name, joined_at) VALUES (?, ?, ?, ?, ?, ?)').run(who.id, who.character, 'g0123456789', rank, who.handle, t0 - 100 + at);
  // both games at play, their beats running on past the moment the staff member hides (`later`: a beat after it)
  const later = t0 + 600;
  const beat = (at) => raw.prepare('UPDATE players SET played_at = ? WHERE id IN (?, ?)').run(at, mob.id, troll.id);
  const view = async (who) => { const r = await s.call('/v1/guilds/mine', { character: who.character }, who.secret); assert.equal(r.status, 200, JSON.stringify(r.body)); return r.body.guild.members; };
  const row = (members, who) => members.find((m) => m.name === who.handle);
  const at = (sec) => sec * 1000;
  beat(later);
  for (const who of [troll, mob]) {
    const members = await view(who);
    assert.deepEqual(members.map((m) => [m.name, m.seenAt, 'hidden' in m]), [['Troll', later, false], ['SirMcMobdon', later, false]], `${who.handle}: shown, both at play`);
    assert.equal(guildOnlineText(members, at(later + 30)), '2 online');
  }
  // Hide me, and the game mints hidden - the run starts at that mint
  const login = await staff('/v1/staff/login', { handle: 'SirMcMobdon', password: PASSWORD, ...(await proof('login', 'SirMcMobdon')) });
  assert.equal(login.status, 200, JSON.stringify(login.body));
  assert.deepEqual((await staff('/v1/staff/hide', { on: true }, login.body.session)).body, { hidden: true });
  const tok = await s.call('/v1/auth/token', {}, mob.secret);
  assert.equal(claimsOf(tok.body.token).hd, 1, 'the game minted hidden');
  const hidAt = raw.prepare("SELECT MIN(at) AS at FROM staff_audit WHERE actor = ? AND act = 'hidden-token'").get(mob.id).at;
  assert.ok(hidAt < later, 'hidden before the last beat');
  const sub = JSON.parse(raw.prepare("SELECT detail FROM staff_audit WHERE actor = ? AND act = 'hidden-token'").get(mob.id).detail).sub;
  const minted = (sec) => raw.prepare("INSERT INTO staff_audit (at, actor, role, act, outcome, detail) VALUES (?, ?, 'admin', 'hidden-token', 'ok', ?)").run(sec, mob.id, JSON.stringify({ sub }));
  minted(hidAt + 50);   // a later room's token in the same run: the run started at the first
  const seen = at(later + PLAY_GRACE_S + 60);   // past the grace from the moment they hid; both still beating
  beat(later + PLAY_GRACE_S + 60);
  const theirs = await view(troll);
  assert.deepEqual(theirs.map((m) => [m.name, m.seenAt, 'hidden' in m]), [['Troll', later + PLAY_GRACE_S + 60, false], ['SirMcMobdon', hidAt, false]], 'a guildmate: last online the moment they hid, and never told why');
  assert.equal(guildMemberOnline(row(theirs, mob), seen), false);
  assert.equal(guildOnlineText(theirs, seen), '1 online', 'the guildmate alone at play');
  const own = await view(mob);
  assert.deepEqual(row(own, mob), { ...row(own, mob), you: true, hidden: true, seenAt: hidAt }, 'their own row: theirs, hidden, last online when they hid');
  assert.equal('hidden' in row(own, troll), false);
  assert.equal(guildMemberOnline(row(own, mob), seen), false, 'not at play, even to themselves');
  assert.equal(guildOnlineText(own, seen), '1 online', 'their own "N online" leaves them out');
  // Show myself: at play again, to everyone
  assert.deepEqual((await staff('/v1/staff/hide', { on: false }, login.body.session)).body, { hidden: false });
  for (const who of [troll, mob]) {
    const members = await view(who);
    assert.deepEqual(members.map((m) => [m.name, m.seenAt, 'hidden' in m]), [['Troll', later + PLAY_GRACE_S + 60, false], ['SirMcMobdon', later + PLAY_GRACE_S + 60, false]], `${who.handle}: shown again`);
    assert.equal(guildOnlineText(members, seen), '2 online');
  }
  // Hide me again in the same staff session (its subject the same): the new run starts at its own first mint, never the
  // first run's - the Show myself between them ends that one
  assert.deepEqual((await staff('/v1/staff/hide', { on: true }, login.body.session)).body, { hidden: true });
  minted(later + 900);
  beat(later + 2000);
  assert.equal(row(await view(troll), mob).seenAt, later + 900, 'hidden again: last online when they hid again');
  // a run a sign-out ended (its session's subject), and the next session's own: the run is one session's, so the newer
  // reads from its own first mint - never the signed-out session's
  const ended = (sec, what) => raw.prepare("INSERT INTO staff_audit (at, actor, role, act, outcome, detail) VALUES (?, ?, 'admin', 'logout', 'ok', ?)").run(sec, mob.id, JSON.stringify(what));
  minted(later + 1200);
  ended(later + 1300, { sub });
  raw.prepare("INSERT INTO staff_audit (at, actor, role, act, outcome, detail) VALUES (?, ?, 'admin', 'hidden-token', 'ok', ?)").run(later + 1500, mob.id, JSON.stringify({ sub: 'n3xtSessi0nSubAAAAAAAAAA' }));
  assert.equal(row(await view(troll), mob).seenAt, later + 1500, 'the next session\'s run, from its own first mint');
  assert.deepEqual((await staff('/v1/staff/hide', { on: false }, login.body.session)).body, { hidden: false });
  // an account that is no staff, its switch set by hand and a hidden-token row of its own: the role is asked first
  raw.prepare('UPDATE players SET staff_hide_on = 1 WHERE id = ?').run(troll.id);
  raw.prepare("INSERT INTO staff_audit (at, actor, role, act, outcome, detail) VALUES (?, ?, 'moderator', 'hidden-token', 'ok', ?)").run(hidAt, troll.id, JSON.stringify({ sub: 'gH0st5ubAAAAAAAAAAAAAAAA' }));
  assert.equal(row(await view(mob), troll).seenAt, later + 2000, 'no staff, never hidden');
});
