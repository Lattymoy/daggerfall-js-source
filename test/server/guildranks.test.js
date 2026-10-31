// GUILD-RANKS and GUILD-REQUESTS (2026-10-30, the owner: "More guild ranks plus rank permission edits", "Player guild
// join requests"; bible/11-Multiplayer/Guild-Shop.md sections 13 and 14): a guild keeps four to eight ranks, a new member
// joins at the lowest, and the guildmaster sets which ranks hold each power it may give; a character in no guild asks a
// guild by its tag, and a rank that may invite answers.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { standService, T0 } from '../accountDb.mjs';
import { seatRealm } from '../realmSeat.mjs';
import { guildPowersOf, guildPowersEditOf, guildMay, guildMayMove, guildRankCount, GUILD_RANKS_MAX } from '../../src/net/guild/guildLaw.js';
import { guildPowerSql } from '../../server-account/src/guildPowerSql.js';
import { guildRankLines } from '../../src/net/guild/guildPowers.js';
import { requestLetter } from '../../server-account/src/guilds.js';

const realNow = Date.now;
Date.now = () => T0 * 1000;
test.after(() => { Date.now = realNow; });

async function guild() {
  const s = await standService({ MARKS_OPEN: 'on' });
  const raw = s.env.DB._raw;
  const gm = await s.registered('Aldric', { renown: 10 });
  gm.realm = await seatRealm(s.env, gm.secret, 'Aldric', { name: 'Aldric', level: 5, goldPieces: 20_000, items: [], bankAccounts: [{ accountGold: 0 }] });
  gm.character = gm.realm.id;
  raw.prepare('INSERT OR REPLACE INTO renown_tracks (player, char_id, name, xp, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)').run(gm.id, gm.character, 'Aldric', 1_000_000, T0, T0);
  const found = await s.call('/v1/guilds/found', { character: gm.character, name: 'The Iron Oath', tag: 'IRON', realm: gm.realm.at(), region: 0 }, gm.secret);
  assert.equal(found.status, 200, JSON.stringify(found.body));
  const join = async (handle) => {
    const p = await s.registered(handle);
    p.character = `char-${handle.toLowerCase()}`;
    assert.equal((await s.call('/v1/guilds/invite', { character: gm.character, handle }, gm.secret)).status, 200);
    const r = await s.call('/v1/guilds/answer', { character: p.character, guild: found.body.guild.id, accept: true }, p.secret);
    assert.equal(r.status, 200, JSON.stringify(r.body));
    p.member = r.body.guild.members.find((m) => m.you).member;
    return p;
  };
  return { s, raw, gm, gid: found.body.guild.id, join };
}
const rankOf = (raw, p) => raw.prepare('SELECT rank FROM guild_members WHERE player = ?').get(p.id)?.rank;

test('GUILD-RANKS the law: four to eight ranks; a guild\'s powers whole, the guildmaster in each; an edit only of the powers it may give, to ranks it has (mutants: the guildmaster left out; a rank past the count kept; a power not editable taken)', () => {
  assert.equal(guildRankCount(JSON.stringify(['A', 'B', 'C', 'D', 'E', 'F'])), 6);
  assert.equal(guildRankCount(JSON.stringify(['A', 'B', 'C'])), 4, 'three names is no guild\'s: the four');
  const p = guildPowersOf(JSON.stringify({ withdraw: [1, 7], invite: [], disband: [1] }), 6);
  assert.deepEqual([p.withdraw, p.invite, p.disband, p.deposit, p.hallEntry], [[0, 1], [0], [0], [0, 1, 2, 3, 4, 5], [0, 1]], 'rank 7 is none of six; disband is the guildmaster\'s whatever is written');
  assert.deepEqual([guildMay(1, 'withdraw', p), guildMay(1, 'invite', p), guildMay(1, 'invite')], [true, false, true]);
  assert.deepEqual(guildPowersEditOf({ withdraw: [2, 1, 2] }, 4), { withdraw: [1, 2] });
  assert.deepEqual([guildPowersEditOf({ disband: [1] }, 4), guildPowersEditOf({ withdraw: [4] }, 4), guildPowersEditOf({ withdraw: [0] }, 4), guildPowersEditOf([], 4)], [null, null, null, null]);
  assert.deepEqual([guildMayMove(1, 4, 5, null, 6), guildMayMove(1, 4, 6, null, 6), guildMayMove(0, 2, 7)], [true, false, true], 'the moves stay inside the guild\'s ranks');
  assert.match(guildPowerSql('notes', 'rank', '?2'), /^\(rank = 0 OR EXISTS \(SELECT 1 FROM guilds pg, json_each\(COALESCE\(json_extract\(pg\.powers, '\$\.notes'\), '\[0,1\]'\)\) pj/);
  assert.equal(GUILD_RANKS_MAX, 8);
  // the Members page's words: every rank of the guild, read off its own table
  const lines = guildRankLines(['GM', 'Captain', 'Blade', 'Member', 'Page', 'Squire'], { ...guildPowersOf(null, 6), withdraw: [0, 1] });
  assert.equal(lines.length, 6);
  assert.match(lines[1].text, /take gold and silver out of the treasuries/);
  assert.deepEqual([lines[5].name, lines[4].text], ['Squire', 'The same as the Squire.']);
});

test('GUILD-RANKS six ranks: a new member joins at the lowest; taken back to four, the members under move to the new lowest and the powers past it go (mutants: a join at the Recruit; a rank left past the count)', async () => {
  const { s, raw, gm, join } = await guild();
  const six = ['Guildmaster', 'Captain', 'Blade', 'Member', 'Page', 'Squire'];
  const named = await s.call('/v1/guilds/ranks', { character: gm.character, ranks: six }, gm.secret);
  assert.equal(named.status, 200, JSON.stringify(named.body));
  const set = await s.call('/v1/guilds/powers', { character: gm.character, powers: { invite: [1, 5] } }, gm.secret);
  assert.equal(set.status, 200, JSON.stringify(set.body));
  assert.deepEqual(set.body.guild.powers.invite, [0, 1, 5]);
  const brenna = await join('Brenna');
  assert.equal(rankOf(raw, brenna), 5, 'the Squire');
  const look = await s.call('/v1/guilds/mine', { character: gm.character }, gm.secret);
  assert.deepEqual(look.body.guild.ranks, six);
  const four = await s.call('/v1/guilds/ranks', { character: gm.character, ranks: ['Guildmaster', 'Captain', 'Blade', 'Member'] }, gm.secret);
  assert.deepEqual([four.status, four.body.demoted], [200, 1]);
  assert.equal(rankOf(raw, brenna), 3, 'moved to the new lowest');
  assert.equal(raw.prepare('SELECT powers FROM guilds').get().powers, JSON.stringify({ invite: [1] }), 'rank 5 is gone from the powers');
  assert.equal((await s.call('/v1/guilds/ranks', { character: gm.character, ranks: [...six, 'A', 'B', 'C'] }, gm.secret)).body.error, 'bad-ranks', 'nine is past the most');
});

test('GUILD-RANKS a power given: an Officer given the treasury takes from it and buys the hall\'s furniture; one taken from it, refused - in the read and in the statement; a member edits nothing (mutants: the default read over the guild\'s; the shop\'s rank list fixed)', async () => {
  const { s, raw, gm, gid, join } = await guild();
  const cass = await join('Cass');
  assert.equal((await s.call('/v1/guilds/rank', { character: gm.character, member: cass.member, rank: 1 }, gm.secret)).status, 200);
  assert.equal((await s.call('/v1/guilds/powers', { character: cass.character, powers: { withdraw: [1] } }, cass.secret)).body.error, 'guild-rank', 'the guildmaster\'s alone');
  assert.equal((await s.call('/v1/guilds/powers', { character: gm.character, powers: { withdraw: [4] } }, gm.secret)).body.error, 'bad-powers', 'a rank the guild lacks');
  raw.prepare('UPDATE guilds SET treasury = 500, moved_by = ?, moved_at = ? WHERE id = ?').run('Aldric', T0, gid);
  assert.equal((await s.call('/v1/guilds/withdraw', { character: cass.character, gold: 100 }, cass.secret)).body.error, 'guild-rank', 'by default the guildmaster\'s');
  assert.equal((await s.call('/v1/guilds/powers', { character: gm.character, powers: { withdraw: [1], shop: [1], hallEntry: [] } }, gm.secret)).status, 200);
  const took = await s.call('/v1/guilds/withdraw', { character: cass.character, gold: 100 }, cass.secret);
  assert.equal(took.status, 200, JSON.stringify(took.body));
  // the shop's own statement reads the guild's table (guildPowerSql)
  raw.prepare('INSERT OR REPLACE INTO guild_marks (guild_id, balance) VALUES (?, ?)').run(gid, 50_000);
  const bought = await s.call('/v1/guilds/shop/buy', { character: cass.character, ware: 'brazier', rid: 'r-brazier-0001' }, cass.secret);
  assert.equal(bought.status, 200, JSON.stringify(bought.body));
  assert.equal(raw.prepare('SELECT owned FROM guild_furniture WHERE guild_id = ?').get(gid).owned, 1);
  // the hall's door, an Officer's by default, taken from it: the statement refuses as the read does
  assert.equal((await s.call('/v1/guilds/hall/entry', { character: cass.character, entry: 'public' }, cass.secret)).body.error, 'guild-rank');
  const back = await s.call('/v1/guilds/powers', { character: gm.character, powers: {} }, gm.secret);
  assert.deepEqual([back.status, raw.prepare('SELECT powers FROM guilds').get().powers], [200, null], 'the defaults again');
  assert.equal((await s.call('/v1/guilds/withdraw', { character: cass.character, gold: 100 }, cass.secret)).body.error, 'guild-rank');
});

test('GUILD-RANKS a rank given the vault\'s grant grants only below its own (mutants: an Officer granting an Officer)', async () => {
  const { s, gm, join } = await guild();
  const cass = await join('Cass');
  const dag = await join('Dag');
  const eda = await join('Eda');
  for (const p of [cass, dag]) assert.equal((await s.call('/v1/guilds/rank', { character: gm.character, member: p.member, rank: 1 }, gm.secret)).status, 200);
  assert.equal((await s.call('/v1/guilds/powers', { character: gm.character, powers: { vaultGrant: [1] } }, gm.secret)).status, 200);
  assert.equal((await s.call('/v1/guilds/vault/grant', { character: cass.character, member: dag.member, level: 'none' }, cass.secret)).body.error, 'guild-rank');
  const r = await s.call('/v1/guilds/vault/grant', { character: cass.character, member: eda.member, level: 'none' }, cass.secret);
  assert.equal(r.status, 200, JSON.stringify(r.body));
});

test('GUILD-REQUESTS a request by tag: listed to a rank that invites, not to one that does not; accepted, the character joins at the lowest rank and its other requests go, a letter either way (mutants: the list shown to all; the other requests kept; no letter)', async () => {
  const { s, raw, gm, gid, join } = await guild();
  const recruit = await join('Cass');
  const other = await s.registered('Odo', { renown: 10 });
  other.realm = await seatRealm(s.env, other.secret, 'Odo', { name: 'Odo', level: 5, goldPieces: 20_000, items: [], bankAccounts: [{ accountGold: 0 }] });
  raw.prepare('INSERT OR REPLACE INTO renown_tracks (player, char_id, name, xp, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)').run(other.id, other.realm.id, 'Odo', 1_000_000, T0, T0);
  assert.equal((await s.call('/v1/guilds/found', { character: other.realm.id, name: 'The Pale Hand', tag: 'PALE', realm: other.realm.at(), region: 0 }, other.secret)).status, 200);
  const asker = await s.registered('Fen');
  const c = 'char-fen1';
  assert.equal((await s.call('/v1/guilds/request', { character: c, tag: 'nope' }, asker.secret)).body.error, 'no-guild-tag');
  const sent = await s.call('/v1/guilds/request', { character: c, tag: 'iron' }, asker.secret);
  assert.equal(sent.status, 200, JSON.stringify(sent.body));
  assert.deepEqual([sent.body.request.guild, sent.body.request.tag], [gid, 'IRON']);
  assert.equal((await s.call('/v1/guilds/request', { character: c, tag: 'PALE' }, asker.secret)).status, 200);
  const mine = await s.call('/v1/guilds/invites', {}, asker.secret);
  assert.deepEqual(mine.body.requests.map((q) => [q.tag, q.character]).sort(), [['IRON', c], ['PALE', c]]);
  const seen = (await s.call('/v1/guilds/mine', { character: gm.character }, gm.secret)).body.guild.requests;
  assert.deepEqual(seen.map((q) => q.name), ['Fen']);
  assert.equal((await s.call('/v1/guilds/mine', { character: recruit.character }, recruit.secret)).body.guild.requests, undefined, 'a Recruit invites nobody');
  assert.equal((await s.call('/v1/guilds/request/answer', { character: recruit.character, request: seen[0].id, accept: true }, recruit.secret)).body.error, 'guild-rank');
  const yes = await s.call('/v1/guilds/request/answer', { character: gm.character, request: seen[0].id, accept: true }, gm.secret);
  assert.equal(yes.status, 200, JSON.stringify(yes.body));
  assert.deepEqual({ ...raw.prepare('SELECT guild_id, rank, name FROM guild_members WHERE player = ?').get(asker.id) }, { guild_id: gid, rank: 3, name: 'Fen' });
  assert.equal(raw.prepare('SELECT COUNT(*) AS n FROM guild_requests WHERE player = ?').get(asker.id).n, 0, 'its request to the Pale Hand went with the join');
  assert.equal(raw.prepare("SELECT subject FROM server_post WHERE to_id = ?").get(asker.id).subject, 'You joined The Iron Oath [IRON]');
  assert.equal((await s.call('/v1/guilds/request', { character: c, tag: 'PALE' }, asker.secret)).body.error, 'guild-already');
});

test('GUILD-REQUESTS declined, withdrawn, and bounded: three a character, its own guild\'s invitation answered instead, a request gone answered no-request (mutants: a fourth kept; a decline with no letter)', async () => {
  const { s, raw, gm, gid } = await guild();
  const asker = await s.registered('Fen');
  const c = 'char-fen1';
  assert.equal((await s.call('/v1/guilds/request', { character: c, tag: 'IRON' }, asker.secret)).status, 200);
  const again = await s.call('/v1/guilds/request', { character: c, tag: 'IRON' }, asker.secret);
  assert.equal(again.status, 200, 'asked again, it stands anew');
  assert.equal(raw.prepare('SELECT COUNT(*) AS n FROM guild_requests').get().n, 1);
  const id = (await s.call('/v1/guilds/mine', { character: gm.character }, gm.secret)).body.guild.requests[0].id;
  const no = await s.call('/v1/guilds/request/answer', { character: gm.character, request: id, accept: false }, gm.secret);
  assert.equal(no.status, 200, JSON.stringify(no.body));
  assert.equal(raw.prepare('SELECT subject FROM server_post WHERE to_id = ?').get(asker.id).subject, 'The Iron Oath [IRON] turned down your request');
  assert.equal((await s.call('/v1/guilds/request/answer', { character: gm.character, request: id, accept: true }, gm.secret)).body.error, 'no-request');
  assert.equal((await s.call('/v1/guilds/request', { character: c, tag: 'IRON' }, asker.secret)).status, 200);
  assert.equal((await s.call('/v1/guilds/request/withdraw', { character: c, guild: gid }, asker.secret)).status, 200);
  assert.equal((await s.call('/v1/guilds/request/withdraw', { character: c, guild: gid }, asker.secret)).body.error, 'no-request');
  // three a character: the fourth refused
  for (const [i, tag] of ['AAA', 'BBB', 'CCC', 'DDD'].entries()) raw.prepare('INSERT INTO guilds (id, name, name_key, tag, ranks, treasury, founded_at) VALUES (?, ?, ?, ?, ?, 0, ?)').run(`gaaaaaaaaa${i}`, `Guild ${tag}`, `guild ${tag.toLowerCase()}`, tag, '["A","B","C","D"]', T0);
  for (const tag of ['AAA', 'BBB', 'CCC']) assert.equal((await s.call('/v1/guilds/request', { character: c, tag }, asker.secret)).status, 200);
  assert.equal((await s.call('/v1/guilds/request', { character: c, tag: 'DDD' }, asker.secret)).body.error, 'guild-requests-max');
  // the guild's own invitation stands: that is answered instead
  assert.equal((await s.call('/v1/guilds/invite', { character: gm.character, handle: 'Fen' }, gm.secret)).status, 200);
  assert.equal((await s.call('/v1/guilds/request', { character: c, tag: 'IRON' }, asker.secret)).body.error, 'guild-invited');
  assert.deepEqual(requestLetter(true, { name: 'X', tag: 'XX' })[0], 'You joined X [XX]');
});
