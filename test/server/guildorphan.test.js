// GUILD-ORPHAN (2026-10-30, the owner: "Ability to leave guild if it doesnt exist"; bible/11-Multiplayer/Guild-Shop.md
// section 12): a member row whose guild's row is gone held its character in a guild nobody could read - the window said
// "no guild", while founding and joining answered "already in a guild" and Leave was nowhere. The row is let go at the
// first look or act: the look says no guild, a leave is a leave, and the character may found or join again.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { standService, T0 } from '../accountDb.mjs';
import { seatRealm } from '../realmSeat.mjs';

const realNow = Date.now;
Date.now = () => T0 * 1000;
test.after(() => { Date.now = realNow; });

async function orphaned() {
  const s = await standService({});
  const raw = s.env.DB._raw;
  const gm = await s.registered('Aldric', { renown: 10 });
  gm.realm = await seatRealm(s.env, gm.secret, 'Aldric', { name: 'Aldric', level: 5, goldPieces: 20_000, items: [], bankAccounts: [{ accountGold: 0 }] });
  gm.character = gm.realm.id;
  raw.prepare('INSERT OR REPLACE INTO renown_tracks (player, char_id, name, xp, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)').run(gm.id, gm.character, 'Aldric', 1_000_000, T0, T0);
  const found = await s.call('/v1/guilds/found', { character: gm.character, name: 'The Iron Oath', tag: 'IRON', realm: gm.realm.at(), region: 0 }, gm.secret);
  assert.equal(found.status, 200, JSON.stringify(found.body));
  const member = await s.registered('Brenna');
  member.character = 'char-brenna1';
  assert.equal((await s.call('/v1/guilds/invite', { character: gm.character, handle: 'Brenna' }, gm.secret)).status, 200);
  assert.equal((await s.call('/v1/guilds/answer', { character: member.character, guild: found.body.guild.id, accept: true }, member.secret)).status, 200);
  // the guild's row gone under its members (a table rebuilt with its keys off, a hand in the console)
  raw.exec('PRAGMA foreign_keys = OFF');
  raw.prepare('DELETE FROM guilds WHERE id = ?').run(found.body.guild.id);
  raw.exec('PRAGMA foreign_keys = ON');
  assert.equal(raw.prepare('SELECT COUNT(*) AS n FROM guild_members').get().n, 2, 'the rows stand, their guild gone');
  return { s, raw, gm, member, gid: found.body.guild.id };
}
const rows = (raw, who) => raw.prepare('SELECT COUNT(*) AS n FROM guild_members WHERE player = ?').get(who.id).n;

test('GUILD-ORPHAN a leave from a guild that is gone is a leave: the row let go and the hub told, a second leave none (mutants: the row kept; the out order dropped)', async () => {
  const { s, raw, member, gid } = await orphaned();
  const r = await s.call('/v1/guilds/leave', { character: member.character }, member.secret);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.ok, true);
  assert.equal(typeof r.body.outOrder, 'string', 'the hub hears it as any leaving');
  assert.equal(rows(raw, member), 0);
  assert.equal((await s.call('/v1/guilds/leave', { character: member.character }, member.secret)).body.error, 'no-guild');
  assert.equal(raw.prepare('SELECT COUNT(*) AS n FROM guilds WHERE id = ?').get(gid).n, 0);
});

test('GUILD-ORPHAN the look lets it go too, and the character founds or joins again - the guildmaster of a gone guild among them (mutants: founding refused; the look keeping the row)', async () => {
  const { s, raw, gm, member } = await orphaned();
  const look = await s.call('/v1/guilds/mine', { character: gm.character }, gm.secret);
  assert.deepEqual([look.status, look.body.guild], [200, null]);
  assert.equal(rows(raw, gm), 0, 'the look let the row go');
  const again = await s.call('/v1/guilds/found', { character: gm.character, name: 'The Iron Oath', tag: 'IRON', realm: gm.realm.at(), region: 0 }, gm.secret);
  assert.equal(again.status, 200, JSON.stringify(again.body));
  // the member, never looked: an invitation answered straight away
  assert.equal((await s.call('/v1/guilds/invite', { character: gm.character, handle: 'Brenna' }, gm.secret)).status, 200);
  const join = await s.call('/v1/guilds/answer', { character: member.character, guild: again.body.guild.id, accept: true }, member.secret);
  assert.equal(join.status, 200, JSON.stringify(join.body));
  assert.equal(raw.prepare('SELECT guild_id FROM guild_members WHERE player = ?').get(member.id).guild_id, again.body.guild.id);
});
