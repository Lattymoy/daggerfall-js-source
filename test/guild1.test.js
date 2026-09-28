// GUILD1 (2026-09-25, Mac, of the holdings: "future ownership for online guilds"; asked, founding takes "Gold and
// Renown", a guild is joined "Per character", its ranks are "Four, renamed by the guildmaster", and the treasury is the
// "Guildmaster only" to take from): THE GUILDS. The law both ends read (net/guildLaw.js), the account service's guilds
// driven through the real Worker over node:sqlite with every migration applied (server-account/src/guilds.js), and the
// client's door (net/accountClient.js accountGuilds). `06-Systems/Online-Arc.md` GUILD1.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import worker from '../server-account/src/index.js';
import { ROUTES } from '../server-account/src/service.js';
import { _resetKeyForTests } from '../server-account/src/signing.js';
import { mintGuildId } from '../server-account/src/guilds.js';
import {
  GUILD_FOUND_GOLD, GUILD_FOUND_RENOWN, GUILD_MEMBERS_MAX, GUILD_RANK_NAMES, GUILD_POWERS, GUILD_INVITE_TTL_S, GUILD_MOVE_MAX, GUILD_TREASURY_MAX,
  GUILD_ID_RE, GUILD_MEMBER_RE, guildMay, guildMayMove, guildOutranks, guildNameOf, guildNameKey, guildTagOf, guildRankNamesOf,
  guildGoldOk,
} from '../src/net/guildLaw.js';
import { renownXpFor } from '../src/net/renown.js';
import { accountGuilds, REFUSALS, SESSION_KEY } from '../src/net/accountClient.js';

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const { subtle } = globalThis.crypto;
const MIGRATIONS = readdirSync(new URL('../server-account/migrations', import.meta.url)).filter((f) => f.endsWith('.sql')).sort();
function d1() {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON');
  for (const f of MIGRATIONS) db.exec(src(`server-account/migrations/${f}`));
  return {
    _raw: db,
    prepare(sql) {
      const stmt = db.prepare(sql);
      const writes = /^\s*(INSERT|UPDATE|DELETE|REPLACE)\b/i.test(sql);
      let args = [];
      const api = {
        bind(...a) { args = a; return api; },
        async first() { return stmt.get(...args) ?? null; },
        async all() { return { results: stmt.all(...args) }; },
        async run() { const r = stmt.run(...args); return { meta: { changes: Number(r.changes) } }; },
        // as D1's batch answers each statement: its rows, and what it changed
        _result() { const results = stmt.all(...args); return { results, meta: { changes: writes ? Number(db.prepare('SELECT changes() AS c').get().c) : 0 } }; },
      };
      return api;
    },
    async batch(list) {
      db.exec('BEGIN');
      try { const out = list.map((st) => st._result()); db.exec('COMMIT'); return out; } catch (e) { db.exec('ROLLBACK'); throw e; }
    },
  };
}
const T0 = 1_800_000_000;
async function stand() {
  _resetKeyForTests();
  const kp = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const pkcs8 = Buffer.from(new Uint8Array(await subtle.exportKey('pkcs8', kp.privateKey))).toString('base64');
  const env = { DB: d1(), IDENTITY_PRIVATE_KEY: pkcs8, ACCOUNT_VERSION: 'test1', ALLOWED_ORIGIN: '*' };
  const call = async (path, body, bearer = null) => {
    const res = await worker.fetch(new Request(`https://accounts.invalid${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(bearer ? { authorization: `Bearer ${bearer}` } : {}) },
      body: JSON.stringify(body),
    }), env);
    return { status: res.status, body: await res.json().catch(() => null) };
  };
  const guest = async () => (await call('/v1/auth/guest', {})).body.secret;
  /** A registered account, and one of its characters seated at `renown` (the service's own track). */
  const registered = async (handle, { character = `char-${handle.toLowerCase()}`, renown = GUILD_FOUND_RENOWN } = {}) => {
    const secret = await guest();
    const reg = await call('/v1/auth/register', { secret, handle, password: 'a good long one' });
    assert.equal(reg.status, 200, `${handle} registers`);
    const id = env.DB._raw.prepare('SELECT id FROM players WHERE handle_lc = ?').get(handle.toLowerCase()).id;
    if (renown > 1) {
      env.DB._raw.prepare('INSERT OR REPLACE INTO renown_tracks (player, char_id, name, xp, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
        .run(id, character, handle, renownXpFor(renown), T0, T0);
    }
    return { secret, id, character, handle };
  };
  return { env, call, guest, registered };
}
const mine = async (call, who) => (await call('/v1/guilds/mine', { character: who.character }, who.secret)).body.guild;
/** GUILD1c: an answer with the orders it carries set aside - test/guild1c.test.js reads those. */
const bare = ({ order, outOrder, ...body }) => body;

// ─── THE LAW ─────────────────────────────────────────────────────────────────────────────────────────────────────────

test('GUILD1 the law: founding costs 10,000 gold and Renown 10; a guild holds 50; its name is 3 to 32 plain words and its tag 2 to 4 capitals or digits, one guild a name whatever its case or spaces; four ranks, the guildmaster\'s to rename, each acting only on ranks below its own - the treasury the guildmaster\'s alone to take from (mutants: a bound, an officer withdrawing, a rank moved to its mover\'s, the name key keeping case)', () => {
  assert.deepEqual([GUILD_FOUND_GOLD, GUILD_FOUND_RENOWN, GUILD_MEMBERS_MAX, GUILD_MOVE_MAX], [10_000, 10, 50, 1_000_000]);
  assert.deepEqual(GUILD_RANK_NAMES, ['Guildmaster', 'Officer', 'Member', 'Recruit']);
  assert.equal(guildNameOf('  The   Order of  the Hound '), 'The Order of the Hound', 'tidied');
  assert.equal(guildNameOf("Knights' Rest-2"), "Knights' Rest-2");
  for (const bad of ['ab', 'x'.repeat(33), '-Lead', 'Trail\'', 'Bad!Name', null, 7]) assert.equal(guildNameOf(bad), null, String(bad));
  assert.equal(guildNameKey('The  Hound'), guildNameKey('the hound'), 'one guild a name, its case and spaces aside');
  assert.equal(guildTagOf(' hnd '), 'HND');
  for (const bad of ['A', 'ABCDE', 'a-b', '', null]) assert.equal(guildTagOf(bad), null, String(bad));
  assert.deepEqual(guildRankNamesOf([' Lord ', 'Knight', 'Squire', 'Page']), ['Lord', 'Knight', 'Squire', 'Page']);
  for (const bad of [['A', 'a', 'B', 'C'], ['A', 'B', 'C'], ['A', '', 'B', 'C'], ['A', 'B', 'C', 'x'.repeat(21)], ['A', 'B!', 'C', 'D']]) assert.equal(guildRankNamesOf(bad), null, JSON.stringify(bad));
  // the powers
  assert.deepEqual(Object.fromEntries(Object.entries(GUILD_POWERS).map(([k, v]) => [k, [...v]])), {
    invite: [0, 1], remove: [0, 1], promote: [0, 1], deposit: [0, 1, 2, 3], withdraw: [0], renameRanks: [0], handOver: [0], disband: [0],
  });
  assert.deepEqual([guildMay(0, 'withdraw'), guildMay(1, 'withdraw'), guildMay(3, 'deposit'), guildMay(2, 'invite'), guildMay(0, 'nonsense')], [true, false, true, false, false]);
  assert.deepEqual([guildOutranks(1, 2), guildOutranks(1, 1), guildOutranks(2, 1), guildOutranks(0, 4)], [true, false, false, false]);
  assert.deepEqual([guildMayMove(0, 1, 2), guildMayMove(0, 3, 1), guildMayMove(1, 2, 3), guildMayMove(1, 3, 2)], [true, true, true, true], 'within the ranks below');
  assert.deepEqual([guildMayMove(1, 2, 1), guildMayMove(1, 1, 2), guildMayMove(2, 3, 2), guildMayMove(0, 2, 0), guildMayMove(0, 2, 2)], [false, false, false, false, false],
    'never to the mover\'s own rank, never an equal, never by a member, never a new guildmaster, never nothing');
  assert.deepEqual([guildGoldOk(1), guildGoldOk(GUILD_MOVE_MAX), guildGoldOk(0), guildGoldOk(GUILD_MOVE_MAX + 1), guildGoldOk(2.5)], [true, true, false, false, false]);
  let n = 0;
  const id = mintGuildId((b) => { for (let i = 0; i < b.length; i++) b[i] = (n++ * 37) % 256; });
  assert.match(id, GUILD_ID_RE);
  assert.ok(GUILD_MEMBER_RE.test('m12') && !GUILD_MEMBER_RE.test('12') && !GUILD_MEMBER_RE.test('m'));
});

// ─── FOUNDING ────────────────────────────────────────────────────────────────────────────────────────────────────────

test('GUILD1 founding: an account\'s character at Renown 10 on the service\'s own track founds a guild and is its guildmaster, the treasury empty and the ranks named by default; a guest, a character below Renown 10, one already in a guild, a name or a tag another guild bears and a bad shape are refused; a character in no guild reads none (mutants: the Renown asked of the client, the founder a recruit, two guilds a name)', async () => {
  const { call, guest, registered } = await stand();
  const g = await guest();
  assert.deepEqual((await call('/v1/guilds/found', { character: 'char-x', name: 'The Hound', tag: 'HND' }, g)), { status: 403, body: { error: 'guilds-need-account' } });
  assert.deepEqual((await call('/v1/guilds/invites', {}, g)).body, { ok: true, invites: [] }, 'a guest has none');
  assert.deepEqual(await call('/v1/guilds/mine', { character: 'char-x' }, g), { status: 403, body: { error: 'guilds-need-account' } });
  const low = await registered('Lowly', { renown: GUILD_FOUND_RENOWN - 1 });
  assert.deepEqual(await call('/v1/guilds/found', { character: low.character, name: 'The Hound', tag: 'HND', renown: 50 }, low.secret), { status: 403, body: { error: 'guild-renown' } }, 'the service\'s own track, never the word sent');
  const aldric = await registered('Aldric');
  assert.equal(await mine(call, aldric), null, 'in no guild');
  const r = await call('/v1/guilds/found', { character: aldric.character, name: '  The   Hound ', tag: 'hnd' }, aldric.secret);
  assert.equal(r.status, 200);
  const { guild } = r.body;
  assert.deepEqual([guild.name, guild.tag, guild.ranks, guild.treasury, guild.rank, guild.foundedAt], ['The Hound', 'HND', GUILD_RANK_NAMES, 0, 0, T0 > 0 ? guild.foundedAt : 0]);
  assert.match(guild.id, GUILD_ID_RE);
  assert.deepEqual(guild.members.map((m) => [m.name, m.rank, m.you]), [['Aldric', 0, true]], 'the founder is its guildmaster');
  assert.match(guild.members[0].member, GUILD_MEMBER_RE);
  assert.deepEqual([guild.invites, guild.ledger], [[], []]);
  assert.equal((await call('/v1/guilds/found', { character: aldric.character, name: 'Another', tag: 'ANO' }, aldric.secret)).body.error, 'guild-already');
  const mara = await registered('Mara');
  assert.deepEqual(await call('/v1/guilds/found', { character: mara.character, name: 'the hound', tag: 'MRA' }, mara.secret), { status: 409, body: { error: 'guild-name-taken' } });
  assert.deepEqual(await call('/v1/guilds/found', { character: mara.character, name: 'Mara Band', tag: 'hnd' }, mara.secret), { status: 409, body: { error: 'guild-tag-taken' } });
  assert.deepEqual(await call('/v1/guilds/found', { character: mara.character, name: 'x', tag: 'MRA' }, mara.secret), { status: 400, body: { error: 'bad-guild' } });
  assert.deepEqual(await call('/v1/guilds/found', { character: 'no such!', name: 'Mara Band', tag: 'MRA' }, mara.secret), { status: 400, body: { error: 'guild-character' } });
  assert.equal((await call('/v1/guilds/found', { character: mara.character, name: 'Mara Band', tag: 'MRA' }, mara.secret)).status, 200, 'her own');
  // a second character of the same account is free
  const second = { ...aldric, character: 'char-aldric-two' };
  assert.equal(await mine(call, second), null, 'per character: the account\'s other character belongs to none');
});

// ─── INVITATIONS ─────────────────────────────────────────────────────────────────────────────────────────────────────

test('GUILD1 invitations: an officer or the guildmaster invites an ACCOUNT by its handle; the invited account reads it, and whichever of its characters answers joins, as a recruit - the invitation spent by the join or by declining, and left standing when a join is refused, for another character or a free place; a member cannot invite, a handle nobody holds is refused, a character already in a guild cannot join, an invitation a week old is gone and swept by the guild\'s next, and a full guild takes nobody (mutants: a member inviting, a joiner not a recruit, an invitation answered twice, a refused join spending it, the cap unread, the week unread, the sweep taking a live one)', async (t) => {
  const clock = { now: T0 * 1000 };
  t.mock.method(Date, 'now', () => clock.now);
  const { env, call, registered } = await stand();
  const aldric = await registered('Aldric');
  const { guild } = (await call('/v1/guilds/found', { character: aldric.character, name: 'The Hound', tag: 'HND' }, aldric.secret)).body;
  const mara = await registered('Mara', { renown: 1 });
  assert.deepEqual(await call('/v1/guilds/invite', { character: aldric.character, handle: 'nobody-here' }, aldric.secret), { status: 404, body: { error: 'no-player' } });
  assert.deepEqual((await call('/v1/guilds/invite', { character: aldric.character, handle: 'mara' }, aldric.secret)).body, { ok: true });
  assert.deepEqual((await call('/v1/guilds/invites', {}, mara.secret)).body.invites, [{ guild: guild.id, name: 'The Hound', tag: 'HND', by: 'Aldric', at: T0 }]);
  assert.deepEqual((await mine(call, aldric)).invites, [{ name: 'Mara', by: 'Aldric', at: T0 }], 'the guild sees what it has out');
  const joined = await call('/v1/guilds/answer', { character: mara.character, guild: guild.id, accept: true }, mara.secret);
  assert.equal(joined.status, 200);
  assert.deepEqual(joined.body.guild.members.map((m) => [m.name, m.rank, m.you]), [['Aldric', 0, false], ['Mara', 3, true]], 'a recruit');
  assert.equal(joined.body.guild.invites.length, 0, 'a recruit sees no invitations');
  assert.deepEqual(await call('/v1/guilds/answer', { character: mara.character, guild: guild.id, accept: true }, mara.secret), { status: 404, body: { error: 'no-invite' } }, 'spent');
  // a recruit cannot invite
  const bran = await registered('Bran', { renown: 1 });
  assert.deepEqual(await call('/v1/guilds/invite', { character: mara.character, handle: 'bran' }, mara.secret), { status: 403, body: { error: 'guild-rank' } });
  // declined: spent
  await call('/v1/guilds/invite', { character: aldric.character, handle: 'bran' }, aldric.secret);
  assert.deepEqual([(await mine(call, mara)).invites, (await mine(call, aldric)).invites.map((i) => i.name)], [[], ['Bran']], 'what the guild has out is its officers\' to see');
  assert.deepEqual((await call('/v1/guilds/answer', { character: bran.character, guild: guild.id, accept: false }, bran.secret)).body, { ok: true, guild: null });
  assert.deepEqual((await call('/v1/guilds/invites', {}, bran.secret)).body.invites, []);
  // a character already in a guild: refused, and the invitation stands for another of the account's characters
  await call('/v1/guilds/invite', { character: aldric.character, handle: 'mara' }, aldric.secret);
  assert.deepEqual(await call('/v1/guilds/answer', { character: mara.character, guild: guild.id, accept: true }, mara.secret), { status: 409, body: { error: 'guild-already' } });
  assert.deepEqual(await call('/v1/guilds/answer', { character: 'bad char!', guild: guild.id, accept: true }, mara.secret), { status: 400, body: { error: 'guild-character' } });
  assert.equal((await call('/v1/guilds/invites', {}, mara.secret)).body.invites.length, 1, 'still standing');
  const alt = await call('/v1/guilds/answer', { character: 'char-mara-two', guild: guild.id, accept: true }, mara.secret);
  assert.deepEqual(alt.body.guild.members.map((m) => [m.name, m.rank, m.you]), [['Aldric', 0, false], ['Mara', 3, false], ['Mara', 3, true]], 'her other character takes it');
  assert.deepEqual((await call('/v1/guilds/invites', {}, mara.secret)).body.invites, [], 'spent by the join');
  // a week old: gone
  await call('/v1/guilds/invite', { character: aldric.character, handle: 'bran' }, aldric.secret);
  clock.now += (GUILD_INVITE_TTL_S - 1) * 1000;
  const raw = env.DB._raw;
  const cass = await registered('Cass', { renown: 1 });
  await call('/v1/guilds/invite', { character: aldric.character, handle: 'cass' }, aldric.secret);
  clock.now += 2 * 1000;
  assert.deepEqual((await call('/v1/guilds/invites', {}, bran.secret)).body.invites, []);
  assert.deepEqual(await call('/v1/guilds/answer', { character: bran.character, guild: guild.id, accept: true }, bran.secret), { status: 404, body: { error: 'no-invite' } });
  assert.deepEqual(raw.prepare('SELECT p.handle FROM guild_invites i JOIN players p ON p.id = i.player ORDER BY i.at').all().map((r) => r.handle), ['Bran', 'Cass'], 'the stale one lies there');
  await call('/v1/guilds/invite', { character: aldric.character, handle: 'mara' }, aldric.secret);
  assert.deepEqual(raw.prepare('SELECT p.handle FROM guild_invites i JOIN players p ON p.id = i.player ORDER BY i.at').all().map((r) => r.handle), ['Cass', 'Mara'], 'swept by the guild\'s next, and a live one kept');
  assert.deepEqual((await call('/v1/guilds/answer', { character: cass.character, guild: guild.id, accept: false }, cass.secret)).body, { ok: true, guild: null });
  // full
  for (let i = 0; i < GUILD_MEMBERS_MAX - 3; i++) {
    const pid = `filler${String(i).padStart(18, '0')}`.slice(0, 24);
    raw.prepare('INSERT INTO players (id, guest_name, created_at, last_seen) VALUES (?, ?, ?, ?)').run(pid, `Filler ${i}`, T0, T0);
    raw.prepare('INSERT INTO guild_members (player, char_id, guild_id, rank, name, joined_at) VALUES (?, ?, ?, 3, ?, ?)').run(pid, 'char-f', guild.id, `Filler ${i}`, T0);
  }
  assert.deepEqual(await call('/v1/guilds/invite', { character: aldric.character, handle: 'bran' }, aldric.secret), { status: 409, body: { error: 'guild-full' } });
  // an invitation out before it filled: the join is refused, and the invitation waits for a free place
  raw.prepare('INSERT OR REPLACE INTO guild_invites (guild_id, player, by_name, at) VALUES (?, ?, ?, ?)').run(guild.id, bran.id, 'Aldric', Math.floor(clock.now / 1000));
  assert.deepEqual(await call('/v1/guilds/answer', { character: bran.character, guild: guild.id, accept: true }, bran.secret), { status: 409, body: { error: 'guild-full' } }, 'the cap holds at the join too');
  assert.equal((await call('/v1/guilds/invites', {}, bran.secret)).body.invites.length, 1, 'still standing');
  raw.prepare('DELETE FROM guild_members WHERE player = ?').run(`filler${String(0).padStart(18, '0')}`.slice(0, 24));
  assert.equal((await call('/v1/guilds/answer', { character: bran.character, guild: guild.id, accept: true }, bran.secret)).status, 200, 'a place freed, it is taken');
  assert.equal(raw.prepare('SELECT COUNT(*) AS n FROM guild_members WHERE guild_id = ?').get(guild.id).n, GUILD_MEMBERS_MAX);
});

// ─── RANKS ───────────────────────────────────────────────────────────────────────────────────────────────────────────

async function guildOfThree() {
  const s = await stand();
  const { call, registered } = s;
  const gm = await registered('Aldric');
  const { guild } = (await call('/v1/guilds/found', { character: gm.character, name: 'The Hound', tag: 'HND' }, gm.secret)).body;
  const join = async (handle) => {
    const w = await registered(handle, { renown: 1 });
    await call('/v1/guilds/invite', { character: gm.character, handle }, gm.secret);
    await call('/v1/guilds/answer', { character: w.character, guild: guild.id, accept: true }, w.secret);
    return w;
  };
  const officer = await join('Mara');
  const member = await join('Bran');
  const recruit = await join('Cass');
  const id = async (who) => (await mine(call, gm)).members.find((m) => m.name === who.handle).member;
  assert.equal((await call('/v1/guilds/rank', { character: gm.character, member: await id(officer), rank: 1 }, gm.secret)).status, 200);
  assert.equal((await call('/v1/guilds/rank', { character: gm.character, member: await id(member), rank: 2 }, gm.secret)).status, 200);
  return { ...s, guild, gm, officer, member, recruit, id };
}

test('GUILD1 ranks: the guildmaster moves anyone below into any rank below; an officer moves members and recruits between those two and never to officer, nor an officer; a member moves nobody; the guildmaster renames the four ranks, and a bad set is refused; an officer removes a member or a recruit, never an officer or the guildmaster (mutants: an officer made by an officer, an equal moved, a rename by an officer, a removal upward)', async () => {
  const { call, gm, officer, member, recruit, id } = await guildOfThree();
  const rank = (who, target, r) => call('/v1/guilds/rank', { character: who.character, member: target, rank: r }, who.secret);
  assert.deepEqual((await mine(call, gm)).members.map((m) => [m.name, m.rank]), [['Aldric', 0], ['Mara', 1], ['Bran', 2], ['Cass', 3]]);
  assert.equal((await rank(officer, await id(recruit), 2)).status, 200, 'an officer lifts a recruit to member');
  assert.equal((await rank(officer, await id(recruit), 3)).status, 200, 'and back');
  assert.deepEqual(await rank(officer, await id(recruit), 1), { status: 403, body: { error: 'guild-rank' } }, 'never to officer');
  assert.deepEqual(await rank(officer, await id(officer), 2), { status: 403, body: { error: 'guild-rank' } }, 'never its own rank');
  assert.deepEqual(await rank(member, await id(recruit), 2), { status: 403, body: { error: 'guild-rank' } }, 'a member moves nobody');
  assert.deepEqual(await rank(gm, 'm999999', 2), { status: 404, body: { error: 'no-member' } });
  // rename
  assert.deepEqual((await call('/v1/guilds/ranks', { character: gm.character, ranks: ['Lord', 'Knight', 'Squire', 'Page'] }, gm.secret)).body, { ok: true, ranks: ['Lord', 'Knight', 'Squire', 'Page'] });
  assert.deepEqual((await mine(call, recruit)).ranks, ['Lord', 'Knight', 'Squire', 'Page'], 'every member reads them');
  assert.deepEqual(await call('/v1/guilds/ranks', { character: officer.character, ranks: ['A', 'B', 'C', 'D'] }, officer.secret), { status: 403, body: { error: 'guild-rank' } });
  assert.deepEqual(await call('/v1/guilds/ranks', { character: gm.character, ranks: ['A', 'A', 'B', 'C'] }, gm.secret), { status: 400, body: { error: 'bad-ranks' } });
  // remove
  const remove = (who, target) => call('/v1/guilds/remove', { character: who.character, member: target }, who.secret);
  assert.deepEqual(await remove(officer, await id(gm)), { status: 403, body: { error: 'guild-rank' } });
  assert.equal((await remove(officer, await id(recruit))).status, 200);
  assert.deepEqual((await mine(call, gm)).members.map((m) => m.name), ['Aldric', 'Mara', 'Bran']);
  assert.equal(await mine(call, recruit), null, 'removed, in no guild');
  assert.deepEqual(await remove(member, await id(officer)), { status: 403, body: { error: 'guild-rank' } });
});

// ─── THE TREASURY ────────────────────────────────────────────────────────────────────────────────────────────────────

test('GUILD1 the treasury: any member puts gold in; the guildmaster alone takes it out, never more than it holds; every movement is written with the balance after it, newest first, and a refused move writes nothing; the line is the schema\'s, so no write moves gold without one and gold that names no mover does not move; a bad amount is refused (mutants: an officer withdrawing, an overdraft, a line for gold that never moved, the balance unwritten, the kind or the amount miswritten)', async (t) => {
  t.mock.method(Date, 'now', () => (T0 + 5) * 1000);
  const { env, call, guild, gm, officer, recruit } = await guildOfThree();
  const raw = env.DB._raw;
  assert.throws(() => raw.prepare('UPDATE guilds SET treasury = 99 WHERE id = ?').run(guild.id), /NOT NULL/, 'gold naming no mover does not move');
  assert.equal(raw.prepare('SELECT treasury FROM guilds WHERE id = ?').get(guild.id).treasury, 0);
  const deposit = (who, gold) => call('/v1/guilds/deposit', { character: who.character, gold }, who.secret);
  const withdraw = (who, gold) => call('/v1/guilds/withdraw', { character: who.character, gold }, who.secret);
  assert.deepEqual((await deposit(recruit, 500)).body, { ok: true, treasury: 500 }, 'even a recruit');
  assert.deepEqual((await deposit(officer, 250)).body, { ok: true, treasury: 750 });
  assert.deepEqual(await withdraw(officer, 100), { status: 403, body: { error: 'guild-rank' } }, 'Mac: "Guildmaster only"');
  assert.deepEqual(await withdraw(gm, 751), { status: 409, body: { error: 'guild-treasury-short' } });
  assert.deepEqual((await withdraw(gm, 700)).body, { ok: true, treasury: 50 });
  assert.deepEqual(await deposit(recruit, 0), { status: 400, body: { error: 'bad-gold' } });
  assert.deepEqual(await deposit(recruit, GUILD_MOVE_MAX + 1), { status: 400, body: { error: 'bad-gold' } });
  const g = await mine(call, recruit);
  assert.equal(g.treasury, 50);
  assert.deepEqual(g.ledger.map((l) => [l.who, l.kind, l.amount, l.balance]), [['Aldric', 'withdraw', 700, 50], ['Mara', 'deposit', 250, 750], ['Cass', 'deposit', 500, 500]],
    'every movement, newest first, the balance after - and nothing for the refused ones');
  assert.ok(g.ledger.every((l) => l.at === T0 + 5), 'at the service\'s moment');
  raw.prepare('UPDATE guilds SET treasury = treasury, moved_by = ?, moved_at = ? WHERE id = ?').run('Nobody', T0, guild.id);
  raw.prepare('UPDATE guilds SET ranks = ranks WHERE id = ?').run(guild.id);
  assert.equal((await mine(call, recruit)).ledger.length, 3, 'a write that moves nothing writes nothing');
  raw.prepare('UPDATE guilds SET treasury = ?, moved_by = ?, moved_at = ? WHERE id = ?').run(GUILD_TREASURY_MAX - 10, 'Seed', T0 + 5, guild.id);
  assert.deepEqual(await deposit(recruit, 11), { status: 409, body: { error: 'guild-treasury-full' } });
  assert.deepEqual((await deposit(recruit, 10)).body, { ok: true, treasury: GUILD_TREASURY_MAX }, 'up to the cap');
});

// ─── LEAVING, HANDING ON, SUCCESSION ─────────────────────────────────────────────────────────────────────────────────

test('GUILD1 leaving and handing on: a member leaves; the guildmaster leaves only a guild with nobody else in it, and only once its treasury is empty - it goes; handed on, another member is guildmaster and the old one an officer; a guild whose guildmaster\'s account went is given its highest rank\'s longest-standing member; disbanding is the guildmaster\'s once the treasury is empty, and a guild nobody is left in gives its name and tag to the next founder (mutants: the guildmaster walking out on members, the treasury left to vanish, succession skipped, an orphaned name held)', async () => {
  const { env, call, registered, gm, officer, member, recruit, id } = await guildOfThree();
  assert.deepEqual(await call('/v1/guilds/leave', { character: gm.character }, gm.secret), { status: 409, body: { error: 'guild-master-leaves' } });
  assert.deepEqual(bare((await call('/v1/guilds/leave', { character: recruit.character }, recruit.secret)).body), { ok: true });
  assert.equal(await mine(call, recruit), null);
  // handed on
  assert.deepEqual(await call('/v1/guilds/handover', { character: officer.character, member: await id(member) }, officer.secret), { status: 403, body: { error: 'guild-rank' } });
  assert.equal((await call('/v1/guilds/handover', { character: gm.character, member: await id(member) }, gm.secret)).status, 200);
  assert.deepEqual((await mine(call, gm)).members.map((m) => [m.name, m.rank]), [['Bran', 0], ['Aldric', 1], ['Mara', 1]]);
  // the guildmaster's account goes: the highest rank's longest-standing member takes it
  env.DB._raw.prepare('DELETE FROM players WHERE id = ?').run(member.id);
  assert.deepEqual((await mine(call, officer)).members.map((m) => [m.name, m.rank]), [['Aldric', 0], ['Mara', 1]], 'Aldric joined first');
  // disband: the treasury first
  await call('/v1/guilds/deposit', { character: officer.character, gold: 10 }, officer.secret);
  assert.deepEqual(await call('/v1/guilds/disband', { character: officer.character }, officer.secret), { status: 403, body: { error: 'guild-rank' } });
  assert.deepEqual(await call('/v1/guilds/disband', { character: gm.character }, gm.secret), { status: 409, body: { error: 'guild-treasury' } });
  await call('/v1/guilds/withdraw', { character: gm.character, gold: 10 }, gm.secret);
  assert.deepEqual(bare((await call('/v1/guilds/disband', { character: gm.character }, gm.secret)).body), { ok: true });
  assert.deepEqual([await mine(call, gm), await mine(call, officer)], [null, null], 'everything of it went');
  // the lone guildmaster leaves: the guild goes - once its treasury is empty
  const solo = await registered('Solo');
  await call('/v1/guilds/found', { character: solo.character, name: 'Lone Wolf', tag: 'WOLF' }, solo.secret);
  await call('/v1/guilds/deposit', { character: solo.character, gold: 5 }, solo.secret);
  assert.deepEqual(await call('/v1/guilds/leave', { character: solo.character }, solo.secret), { status: 409, body: { error: 'guild-treasury' } });
  await call('/v1/guilds/withdraw', { character: solo.character, gold: 5 }, solo.secret);
  assert.deepEqual(bare((await call('/v1/guilds/leave', { character: solo.character }, solo.secret)).body), { ok: true, disbanded: true });
  // an orphaned guild's name and tag go to the next founder
  const lone = await registered('Loner');
  const { guild } = (await call('/v1/guilds/found', { character: lone.character, name: 'Orphans', tag: 'ORP' }, lone.secret)).body;
  env.DB._raw.prepare('DELETE FROM players WHERE id = ?').run(lone.id);
  assert.ok(env.DB._raw.prepare('SELECT 1 FROM guilds WHERE id = ?').get(guild.id), 'held for no one');
  const next = await registered('Next');
  assert.equal((await call('/v1/guilds/found', { character: next.character, name: 'orphans', tag: 'orp' }, next.secret)).status, 200, 'given up to the next founder');
});

test('GUILD1 raced: every write decides on what it read - a rank moves, and a member goes, only from the rank read; a join lands only while its invitation stands; a guild is handed on only while its giver still holds it, and the giver steps down only once the new guildmaster stands; nobody hands the guild to themselves (mutants: each guard dropped)', async () => {
  const { env, call, gm, officer, member, recruit, id } = await guildOfThree();
  const raw = env.DB._raw;
  const rankOf = (who) => raw.prepare('SELECT rank FROM guild_members WHERE player = ?').get(who.id)?.rank ?? null;
  /** Run `meanwhile` once, as the service readies the write `sql` begins with - after its reads, before the write. */
  const racing = (sql, meanwhile) => {
    const prepare = env.DB.prepare;
    env.DB.prepare = (q) => {
      if (q.trimStart().startsWith(sql)) { env.DB.prepare = prepare; meanwhile(); }
      return prepare.call(env.DB, q);
    };
  };
  // an officer lifts a recruit the guildmaster has meanwhile made an officer: nothing moves
  const cass = await id(recruit);
  racing('UPDATE guild_members SET rank = ?', () => raw.prepare('UPDATE guild_members SET rank = 1 WHERE player = ?').run(recruit.id));
  assert.deepEqual(await call('/v1/guilds/rank', { character: officer.character, member: cass, rank: 2 }, officer.secret), { status: 404, body: { error: 'no-member' } });
  assert.equal(rankOf(recruit), 1, 'an officer never demotes an officer');
  // an officer removes a member the guildmaster has meanwhile made an officer: nobody goes
  raw.prepare('UPDATE guild_members SET rank = 3 WHERE player = ?').run(recruit.id);
  const bran = await id(member);
  racing('DELETE FROM guild_members WHERE rowid', () => raw.prepare('UPDATE guild_members SET rank = 1 WHERE player = ?').run(member.id));
  assert.deepEqual(await call('/v1/guilds/remove', { character: officer.character, member: bran }, officer.secret), { status: 404, body: { error: 'no-member' } });
  assert.equal(rankOf(member), 1, 'an officer never removes an officer');
  raw.prepare('UPDATE guild_members SET rank = 2 WHERE player = ?').run(member.id);
  // an invitation withdrawn as it is answered: nobody joins
  const dana = await (async () => {
    const secret = (await call('/v1/auth/guest', {})).body.secret;
    await call('/v1/auth/register', { secret, handle: 'Dana', password: 'a good long one' });
    return { secret, character: 'char-dana', id: raw.prepare('SELECT id FROM players WHERE handle_lc = ?').get('dana').id };
  })();
  await call('/v1/guilds/invite', { character: gm.character, handle: 'dana' }, gm.secret);
  const guildId = (await mine(call, gm)).id;
  racing('INSERT INTO guild_members', () => raw.prepare('DELETE FROM guild_invites WHERE player = ?').run(dana.id));
  assert.deepEqual(await call('/v1/guilds/answer', { character: dana.character, guild: guildId, accept: true }, dana.secret), { status: 404, body: { error: 'no-invite' } });
  assert.equal(rankOf(dana), null, 'not joined');
  // handed to one gone in the meantime: the giver still holds it
  const gone = await id(recruit);
  racing(`UPDATE guild_members SET rank = 0 WHERE rowid`, () => raw.prepare('DELETE FROM guild_members WHERE player = ?').run(recruit.id));
  assert.deepEqual(await call('/v1/guilds/handover', { character: gm.character, member: gone }, gm.secret), { status: 404, body: { error: 'no-member' } });
  assert.equal(rankOf(gm), 0, 'the giver still holds it, never left to succession');
  // an earlier hand-over landed first: the giver hands nothing more
  const to = await id(member);
  racing(`UPDATE guild_members SET rank = 0 WHERE rowid`, () => {
    raw.prepare('UPDATE guild_members SET rank = 0 WHERE player = ?').run(officer.id);
    raw.prepare('UPDATE guild_members SET rank = 1 WHERE player = ?').run(gm.id);
  });
  assert.deepEqual(await call('/v1/guilds/handover', { character: gm.character, member: to }, gm.secret), { status: 404, body: { error: 'no-member' } });
  assert.deepEqual([rankOf(officer), rankOf(gm), rankOf(member)], [0, 1, 2], 'one guildmaster');
  // to oneself: refused, and nothing moves
  assert.deepEqual(await call('/v1/guilds/handover', { character: officer.character, member: await id(officer) }, officer.secret), { status: 404, body: { error: 'no-member' } });
  assert.equal(rankOf(officer), 0);
});

test('GUILD1 succession: a guild whose guildmaster\'s account went is given its highest rank\'s longest-standing member - before any read or write, the heir\'s own included, and once (mutants: the lowest rank first, the newest first, succession skipped, the heir read at its old rank)', async (t) => {
  const clock = { now: T0 * 1000 };
  t.mock.method(Date, 'now', () => clock.now);
  const { env, call, registered } = await stand();
  const gm = await registered('Aldric');
  const { guild } = (await call('/v1/guilds/found', { character: gm.character, name: 'The Hound', tag: 'HND' }, gm.secret)).body;
  const join = async (handle) => {
    clock.now += 60_000;
    const w = await registered(handle, { renown: 1 });
    await call('/v1/guilds/invite', { character: gm.character, handle }, gm.secret);
    await call('/v1/guilds/answer', { character: w.character, guild: guild.id, accept: true }, w.secret);
    return w;
  };
  const early = await join('Early');   // longest-standing, but a member
  const second = await join('Second'); // an officer, the earlier of the two
  const third = await join('Third');   // an officer, the later
  const id = async (who) => (await mine(call, gm)).members.find((m) => m.name === who.handle).member;
  await call('/v1/guilds/rank', { character: gm.character, member: await id(early), rank: 2 }, gm.secret);
  await call('/v1/guilds/rank', { character: gm.character, member: await id(third), rank: 1 }, gm.secret);
  await call('/v1/guilds/rank', { character: gm.character, member: await id(second), rank: 1 }, gm.secret);
  env.DB._raw.prepare('DELETE FROM players WHERE id = ?').run(gm.id);
  const heir = await mine(call, second);
  assert.deepEqual(heir.members.map((m) => [m.name, m.rank]), [['Second', 0], ['Third', 1], ['Early', 2]], 'the officer who joined first');
  assert.equal(heir.rank, 0, 'and the heir, reading first, reads itself the guildmaster');
  assert.equal((await call('/v1/guilds/ranks', { character: second.character, ranks: ['Lord', 'Knight', 'Squire', 'Page'] }, second.secret)).status, 200, 'and acts as one at once');
  assert.deepEqual((await mine(call, third)).members.map((m) => [m.name, m.rank]), [['Second', 0], ['Third', 1], ['Early', 2]], 'once');
});

// ─── THE WIRE ────────────────────────────────────────────────────────────────────────────────────────────────────────

test('GUILD1 the wire: every guild route is the service\'s and behind a session; the client\'s door posts each to its route with the session as a Bearer header and no session is a word, not a throw; every refusal has a sentence naming its bound; the deploy bundles the law (mutants: a route misspelt, a refusal unsaid)', async () => {
  const routes = ['mine', 'invites', 'found', 'invite', 'answer', 'leave', 'remove', 'rank', 'ranks', 'deposit', 'withdraw', 'handover', 'disband'].map((r) => `/v1/guilds/${r}`);
  for (const r of routes) assert.ok(ROUTES.has(r), r);
  const sent = [];
  const storage = new Map([[SESSION_KEY, JSON.stringify({ secret: 'sek' })]]);
  const fetch = async (url, init) => { sent.push([new URL(url).pathname, JSON.parse(init.body), init.headers.authorization]); return new Response(JSON.stringify({ ok: true }), { status: 200 }); };
  const door = accountGuilds({ fetch, storage: { getItem: (k) => storage.get(k) ?? null } });
  await door.mine('c1');
  await door.invites();
  await door.found({ character: 'c1', name: 'N', tag: 'T' });
  await door.invite('c1', 'mara');
  await door.answer({ character: 'c1', guild: 'g1', accept: true });
  await door.leave('c1');
  await door.remove('c1', 'm1');
  await door.rank('c1', 'm1', 2);
  await door.ranks('c1', ['a', 'b', 'c', 'd']);
  await door.deposit('c1', 5);
  await door.withdraw('c1', 5);
  await door.handOver('c1', 'm1');
  await door.disband('c1');
  assert.deepEqual(sent.map((s) => s[0]), routes);
  assert.ok(sent.every((s) => s[2] === 'Bearer sek'));
  assert.deepEqual(sent.map((s) => s[1]).slice(2, 5), [{ character: 'c1', name: 'N', tag: 'T' }, { character: 'c1', handle: 'mara' }, { character: 'c1', guild: 'g1', accept: true }]);
  assert.deepEqual(sent.map((s) => s[1]).slice(7, 11), [{ character: 'c1', member: 'm1', rank: 2 }, { character: 'c1', ranks: ['a', 'b', 'c', 'd'] }, { character: 'c1', gold: 5 }, { character: 'c1', gold: 5 }]);
  const none = accountGuilds({ fetch, storage: { getItem: () => null } });
  assert.equal((await none.mine('c1')).error, 'no-session');
  for (const w of ['guilds-need-account', 'guild-renown', 'guild-already', 'guild-name-taken', 'guild-tag-taken', 'no-guild', 'guild-rank', 'no-player', 'guild-full',
    'no-invite', 'guild-master-leaves', 'guild-treasury', 'no-member', 'bad-ranks', 'bad-gold', 'guild-treasury-full', 'guild-treasury-short', 'bad-guild', 'guild-character', 'guild-rate']) {
    assert.ok(typeof REFUSALS[w] === 'string' && REFUSALS[w].length > 10, w);
  }
  assert.match(REFUSALS['guild-renown'], /Renown 10/);
  assert.match(REFUSALS['guild-full'], /50/);
  assert.match(src('.github/workflows/account-deploy.yml'), /- "src\/net\/guildLaw\.js"/);
});
