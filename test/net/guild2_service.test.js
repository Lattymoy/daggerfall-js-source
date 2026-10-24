// GUILD2 (2026-10-03) - THE GUILD PAGE'S OVERHAUL, ON THE SERVICE: a new name for a price (the guildmaster's, from the
// realm's gold in the treasury, through the name filter, a fortnight apart, never in a siege week) and the VAULT - a piece
// put in leaves the depositor's realm record in the vault's own batch, one taken out enters the taker's, each member's
// standing the guildmaster's grant or its rank's default, a withdrawer's day counted. Driven through the real Worker over
// the real migrations (test/accountDb.mjs, test/realmSeat.mjs). bible/11-Multiplayer/Guild-Overhaul.md.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { standService, T0 } from '../accountDb.mjs';
import { seatRealm, realmAt } from '../realmSeat.mjs';
import { GUILD_RENAME_GOLD, GUILD_RENAME_COOLDOWN_S, guildRenameOpen } from '../../src/net/guild/guildLaw.js';
import { vaultStanding, vaultMayTake, vaultGrantOf, VAULT_RANK_DEFAULTS, guildVaultSlots, GUILD_VAULT_SLOTS } from '../../src/net/guild/guildVaultLaw.js';
import { seatWeekOf } from '../../src/net/townSeatLaw.js';
import { REFUSALS } from '../../src/net/accountClient.js';
import { verifyOrder } from '../../src/net/identityToken.js';
import { heraldryLookup } from '../../src/ui/heraldrySwatch.js';
import { hallOfRecordsRoll } from '../../src/ui/hallOfRecords.js';

const realNow = Date.now;
let _now = T0;
Date.now = () => _now * 1000;
test.after(() => { Date.now = realNow; });

const sword = (extra = {}) => ({ templateIndex: 115, group: 'Weapons', name: 'Steel Longsword', material: 1, value: 300, currentCondition: 900, maxCondition: 1000, ...extra });
const arrows = (n) => ({ templateIndex: 131, group: 'Weapons', name: 'Arrow', value: 1, stackCount: n });

/** A service, and a guild founded by a realm character with gold enough, and a second realm character in it. */
async function stand(extra = {}) {
  const s = await standService({ MARKS_OPEN: 'on', DEVELOPER_HANDLES: 'Mac', ...extra });
  const raw = s.env.DB._raw;
  const gm = await s.registered('Aldric', { renown: 10 });
  gm.realm = await seatRealm(s.env, gm.secret, 'Aldric', { name: 'Aldric', level: 5, goldPieces: 20_000, items: [sword(), arrows(40)], bankAccounts: [{ accountGold: 0 }] });
  gm.character = gm.realm.id;
  raw.prepare('INSERT OR REPLACE INTO renown_tracks (player, char_id, name, xp, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)').run(gm.id, gm.character, 'Aldric', 1_000_000, T0, T0);
  const found = await s.call('/v1/guilds/found', { character: gm.character, name: 'The Iron Oath', tag: 'IRON', realm: gm.realm.at(), region: 0 }, gm.secret);
  assert.equal(found.status, 200, JSON.stringify(found.body));
  const gid = found.body.guild.id;
  const member = await s.registered('Brenna');
  member.realm = await seatRealm(s.env, member.secret, 'Brenna', { name: 'Brenna', level: 3, goldPieces: 50, items: [sword({ name: 'Brenna\'s Blade' })], bankAccounts: [{ accountGold: 0 }] });
  member.character = member.realm.id;
  assert.equal((await s.call('/v1/guilds/invite', { character: gm.character, handle: 'Brenna' }, gm.secret)).status, 200);
  assert.equal((await s.call('/v1/guilds/answer', { character: member.character, guild: gid, accept: true }, member.secret)).status, 200);
  const realmGold = (n) => raw.prepare("UPDATE guilds SET treasury = ?, realm_gold = ?, moved_by = 'seed', moved_at = ? WHERE id = ?").run(n, n, _now, gid);
  const record = async (who) => {
    const row = raw.prepare('SELECT obj FROM realm_characters WHERE id = ?').get(who.character);
    return JSON.parse(new TextDecoder().decode(s.env.SAVES._map.get(row.obj)));
  };
  const memberRow = (who) => raw.prepare('SELECT rowid AS rid FROM guild_members WHERE char_id = ?').get(who.character);
  return { ...s, raw, gm, member, gid, realmGold, record, memberRow };
}

// ─── THE LAWS ────────────────────────────────────────────────────────

test('GUILD2 law: a rename waits a fortnight; a member stands at its rank\'s default until the guildmaster grants otherwise; the guildmaster always takes out, unlimited', () => {
  assert.equal(guildRenameOpen(null, T0), true);
  assert.equal(guildRenameOpen(T0, T0 + GUILD_RENAME_COOLDOWN_S - 1), false);
  assert.equal(guildRenameOpen(T0, T0 + GUILD_RENAME_COOLDOWN_S), true);
  assert.deepEqual(VAULT_RANK_DEFAULTS[1], { level: 'withdraw', limit: 10 });
  assert.deepEqual(vaultStanding(2, null), { level: 'deposit', limit: 0, granted: false });
  assert.deepEqual(vaultStanding(2, { level: 'withdraw', limit: 3 }), { level: 'withdraw', limit: 3, granted: true });
  assert.deepEqual(vaultStanding(0, { level: 'none', limit: 0 }), { level: 'withdraw', limit: 0, granted: false }, 'nobody grants the guildmaster');
  assert.equal(vaultMayTake({ level: 'withdraw', limit: 3 }, 2), true);
  assert.equal(vaultMayTake({ level: 'withdraw', limit: 3 }, 3), false);
  assert.equal(vaultMayTake({ level: 'withdraw', limit: 0 }, 999), true, '0 is no limit');
  assert.equal(vaultMayTake({ level: 'deposit', limit: 0 }, 0), false);
  assert.deepEqual(vaultGrantOf({ level: 'deposit', limit: 9 }), { level: 'deposit', limit: 0 }, 'a depositor has no limit to keep');
  assert.equal(vaultGrantOf({ level: 'admin' }), null);
  assert.deepEqual(vaultGrantOf({ level: null }), { level: null, limit: 0 }, 'revoked: back to the rank\'s');
  assert.equal(guildVaultSlots(false), GUILD_VAULT_SLOTS);
  assert.equal(guildVaultSlots(true), 100);
});

// ─── GUILD2a: THE RENAME ─────────────────────────────────────────────

test('GUILD2 service: a rename is the guildmaster\'s, from the realm\'s gold in the treasury - the row, the ledger line, the history and the hall\'s name in one batch; the new tag rides the badge', async () => {
  const s = await stand();
  const body = { character: s.gm.character, name: 'The Ember Oath', tag: 'EMBR' };
  assert.deepEqual((await s.call('/v1/guilds/rename', { ...body, character: s.member.character }, s.member.secret)).body, { error: 'guild-rank' });
  assert.deepEqual((await s.call('/v1/guilds/rename', body, s.gm.secret)).body, { error: 'guild-rename-gold' }, 'an empty treasury pays nothing');
  // gold in the treasury that no realm record paid in buys no new name (HALL-GOLD's rule)
  s.raw.prepare("UPDATE guilds SET treasury = ?, realm_gold = 0, moved_by = 'seed', moved_at = ? WHERE id = ?").run(GUILD_RENAME_GOLD * 2, _now, s.gid);
  assert.deepEqual((await s.call('/v1/guilds/rename', body, s.gm.secret)).body, { error: 'guild-rename-gold' });
  s.realmGold(GUILD_RENAME_GOLD + 500);
  s.raw.prepare("INSERT INTO homes (map_id, building_key, player, char_id, region, price, paid, bought_at, guild_id, owner_name) VALUES (1, 'b1', ?, ?, 0, 100, 100, 1, ?, 'The Iron Oath')").run(s.gm.id, s.gm.character, s.gid);
  const r = await s.call('/v1/guilds/rename', body, s.gm.secret);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(s.raw.prepare('SELECT owner_name FROM homes WHERE guild_id = ?').get(s.gid).owner_name, 'The Ember Oath', 'the hall says the new name, in the same batch');
  assert.deepEqual([r.body.guild.name, r.body.guild.tag, r.body.guild.treasury, r.body.cost], ['The Ember Oath', 'EMBR', 500, GUILD_RENAME_GOLD]);
  assert.equal(typeof r.body.order, 'string', 'the actor wears the new tag at once - its badge signed into an order for its rooms (GUILD1c)');
  // AUDIT2 D4: the order read - it carries the NEW tag, signed
  const sealed = await verifyOrder(r.body.order, s.identityPublic, { subtle: globalThis.crypto.subtle, nowS: _now, kind: 'guild' });
  assert.equal(sealed.ok, true, 'a signed guild order');
  assert.deepEqual([sealed.claims.gi, sealed.claims.gt], [s.gid, 'EMBR'], 'the new tag on the badge');
  assert.equal(r.body.guild.ledger[0].kind, 'rename');
  assert.equal(r.body.guild.renameAt, _now + GUILD_RENAME_COOLDOWN_S);
  const hist = s.raw.prepare('SELECT old_name, old_tag, new_name, new_tag, cost FROM guild_renames WHERE guild_id = ?').all(s.gid);
  assert.deepEqual(hist.map((h) => ({ ...h })), [{ old_name: 'The Iron Oath', old_tag: 'IRON', new_name: 'The Ember Oath', new_tag: 'EMBR', cost: GUILD_RENAME_GOLD }]);
  // a fortnight apart
  s.realmGold(GUILD_RENAME_GOLD * 2);
  assert.equal((await s.call('/v1/guilds/rename', { ...body, name: 'The Ash Oath' }, s.gm.secret)).body.error, 'guild-rename-soon');
  _now += GUILD_RENAME_COOLDOWN_S;
  assert.deepEqual((await s.call('/v1/guilds/rename', body, s.gm.secret)).body, { error: 'guild-rename-same' });
  const tagOnly = await s.call('/v1/guilds/rename', { character: s.gm.character, tag: 'ASH' }, s.gm.secret);
  assert.deepEqual([tagOnly.status, tagOnly.body.guild.name, tagOnly.body.guild.tag], [200, 'The Ember Oath', 'ASH'], 'a name left out keeps the one standing');
  _now = T0;
});

test('GUILD2 service: a new name passes the name filter (and now a founding\'s does too), is free of every other guild\'s, and waits out a week the guild fights for a seat; AUDIT2 S2/S7: the refusal names the word it caught and when the next new name may come, and a word is read as written - "The Iron Staff" and "The Dark Mood" are no server\'s words (mutants: the stretched reading per word; the word unsaid; `at` dropped)', async () => {
  const s = await stand();
  s.realmGold(GUILD_RENAME_GOLD * 3);
  const rename = (b) => s.call('/v1/guilds/rename', { character: s.gm.character, ...b }, s.gm.secret);
  assert.deepEqual((await rename({ name: 'Server Admins' })).body, { error: 'guild-name-word', why: 'server' }, 'a reserved word inside a name, word by word - named');
  assert.deepEqual((await rename({ tag: 'MODS' })).body, { error: 'guild-name-word', why: 'mod' });
  assert.deepEqual((await rename({ name: 'Server Staff' })).body, { error: 'guild-name-word', why: 'server' }, 'the server\'s word, standing alone as written');
  // AUDIT GUILD2 G3: a word with no letters is no word the filter reads - GUILD1's shapes admit it, so the filter must
  const digits = await rename({ name: 'The 22 Blades', tag: '22' });
  assert.equal(digits.status, 200, JSON.stringify(digits.body));
  assert.deepEqual([digits.body.guild.name, digits.body.guild.tag], ['The 22 Blades', '22']);
  // AUDIT2 S2: past the filter (the fortnight answers, not the word) - the letters' runs collapsed read "Staff" as `staf`
  // and "Mood" as `mod`, a handle's reading; and S7: the fortnight's end said
  for (const name of ['The Iron Staff', 'The Dark Mood']) {
    assert.deepEqual((await rename({ name })).body, { error: 'guild-rename-soon', at: T0 + GUILD_RENAME_COOLDOWN_S }, name);
  }
  assert.equal(REFUSALS['guild-name-word'] != null, true);
  _now += GUILD_RENAME_COOLDOWN_S;
  // another guild's name and tag are taken
  const other = await s.registered('Corin', { renown: 10 });
  other.realm = await seatRealm(s.env, other.secret, 'Corin', { name: 'Corin', level: 5, goldPieces: 20_000, items: [], bankAccounts: [{ accountGold: 0 }] });
  s.raw.prepare('INSERT OR REPLACE INTO renown_tracks (player, char_id, name, xp, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)').run(other.id, other.realm.id, 'Corin', 1_000_000, T0, T0);
  const theirs = await s.call('/v1/guilds/found', { character: other.realm.id, name: 'The Grey Hand', tag: 'GREY', realm: other.realm.at(), region: 0 }, other.secret);
  assert.equal(theirs.status, 200, JSON.stringify(theirs.body));
  assert.deepEqual((await rename({ name: 'the grey  hand' })).body, { error: 'guild-name-taken' });
  assert.deepEqual((await rename({ tag: 'grey' })).body, { error: 'guild-tag-taken' });
  // a founding through the filter, which it never passed before
  const filtered = await s.call('/v1/guilds/found', { character: s.member.character, name: 'Moderator Guild', tag: 'MODS', realm: realmAt(s.env, s.member.character), region: 0 }, s.member.secret);
  assert.equal(filtered.body.error, 'guild-name-word');
  // a seat battle this week
  s.raw.prepare("INSERT INTO town_seat_battles (week, key, kind, tier, attacker, defender, starts_at, ends_at, at) VALUES (?, 1, 'siege', 'palace', ?, ?, ?, ?, ?)")
    .run(seatWeekOf(_now * 1000), theirs.body.guild.id, s.gid, _now + 3600, _now + 7200, _now);
  assert.deepEqual((await rename({ name: 'The Ember Oath' })).body, { error: 'guild-rename-siege' });
  _now = T0;
});

// ─── GUILD2b: THE VAULT ──────────────────────────────────────────────

test('GUILD2 service: a piece put in leaves the depositor\'s realm record in the vault\'s own batch, one sequence on; taken out, it enters the taker\'s - never in both, never in neither', async () => {
  const s = await stand();
  const seq0 = s.gm.realm.at().seq;   // the founding paid on the record: one on already
  const put = await s.call('/v1/guilds/vault/put', { character: s.gm.character, realm: s.gm.realm.at(), pick: 0, item: sword() }, s.gm.secret);
  assert.equal(put.status, 200, JSON.stringify(put.body));
  assert.deepEqual([put.body.slot, put.body.item.name, put.body.realm.seq], [0, 'Steel Longsword', seq0 + 1]);
  let rec = await s.record(s.gm);
  assert.deepEqual(rec.items.map((i) => i.name), ['Arrow'], 'the sword left the record');
  // part of a stack
  const some = await s.call('/v1/guilds/vault/put', { character: s.gm.character, realm: s.gm.realm.at(), pick: 0, item: arrows(40), count: 15 }, s.gm.secret);
  assert.deepEqual([some.status, some.body.slot, some.body.item.stackCount], [200, 1, 15]);
  rec = await s.record(s.gm);
  assert.equal(rec.items[0].stackCount, 25);
  // the view: every slot, who put it there; the log
  const v = (await s.call('/v1/guilds/vault', { character: s.member.character }, s.member.secret)).body.vault;
  assert.deepEqual(v.items.map((i) => [i.slot, i.name, i.count, i.by]), [[0, 'Steel Longsword', 1, 'Aldric'], [1, 'Arrow', 15, 'Aldric']]);
  assert.deepEqual(v.log.map((l) => [l.kind, l.name, l.count]), [['put', 'Arrow', 15], ['put', 'Steel Longsword', 1]]);
  assert.deepEqual(v.me, { level: 'deposit', limit: 0, granted: false, taken: 0 }, 'a recruit puts in');
  // a recruit may not take out; granted, it may - its day counted
  const take = (who, b) => s.call('/v1/guilds/vault/take', { character: who.character, realm: who.realm.at(), ...b }, who.secret);
  assert.deepEqual((await take(s.member, { slot: 0 })).body, { error: 'guild-vault-rank' });
  const m = `m${s.memberRow(s.member).rid}`;
  assert.deepEqual((await s.call('/v1/guilds/vault/grant', { character: s.member.character, member: m, level: 'withdraw', limit: 1 }, s.member.secret)).body, { error: 'guild-rank' }, 'the leader\'s alone');
  const g = await s.call('/v1/guilds/vault/grant', { character: s.gm.character, member: m, level: 'withdraw', limit: 1 }, s.gm.secret);
  assert.deepEqual(g.body.vault, { level: 'withdraw', limit: 1, granted: true });
  const mseq = s.member.realm.at().seq;
  const got = await take(s.member, { slot: 1, count: 5 });
  assert.equal(got.status, 200, JSON.stringify(got.body));
  assert.deepEqual([got.body.item.stackCount, got.body.left, got.body.realm.seq], [5, 10, mseq + 1]);
  rec = await s.record(s.member);
  assert.deepEqual(rec.items.map((i) => [i.name, i.stackCount ?? 1]), [['Brenna\'s Blade', 1], ['Arrow', 5]]);
  assert.deepEqual((await take(s.member, { slot: 0 })).body, { error: 'guild-vault-limit' }, 'one a day, as granted');
  // revoked: back to the rank's - a recruit's put
  await s.call('/v1/guilds/vault/grant', { character: s.gm.character, member: m, level: null }, s.gm.secret);
  _now += 86_400;
  assert.deepEqual((await take(s.member, { slot: 0 })).body, { error: 'guild-vault-rank' });
  // the guildmaster takes the rest whole
  const all = await take(s.gm, { slot: 1 });
  assert.deepEqual([all.status, all.body.left], [200, 0]);
  assert.equal(s.raw.prepare('SELECT COUNT(*) AS n FROM guild_vault WHERE guild_id = ? AND slot = 1').get(s.gid).n, 0, 'the slot cleared');
  _now = T0;
});

test('GUILD2 service: what may not leave a pack never reaches the vault; a record that does not hold the offer moves nothing; a guild keeping pieces does not go', async () => {
  const s = await stand();
  const put = (b) => s.call('/v1/guilds/vault/put', { character: s.gm.character, realm: s.gm.realm.at(), ...b }, s.gm.secret);
  assert.deepEqual((await put({ pick: 0, item: sword({ name: 'Not My Sword' }) })).body, { error: 'vault-goods' }, 'the offer must be its record');
  assert.deepEqual((await put({ pick: 5, item: sword() })).body, { error: 'vault-goods' }, 'nothing at that place');
  assert.deepEqual((await put({ pick: 1, item: arrows(40), count: 41 })).body, { error: 'bad-vault-count' });
  // a worn piece, a quest's, a Materials Bag
  const s2 = await stand();
  const { layRecord } = await import('../realmSeat.mjs');
  layRecord(s2.env, s2.gm.character, { name: 'Aldric', level: 5, goldPieces: 0, items: [sword({ equipSlot: 'RightHand' }), { templateIndex: 600, group: 'UselessItems2', name: 'Materials Bag' }], bankAccounts: [] });
  const put2 = (b) => s2.call('/v1/guilds/vault/put', { character: s2.gm.character, realm: s2.gm.realm.at(), ...b }, s2.gm.secret);
  assert.deepEqual((await put2({ pick: 0, item: sword({ equipSlot: 'RightHand' }) })).body, { error: 'vault-goods' }, 'worn');
  assert.deepEqual((await put2({ pick: 1, item: { templateIndex: 600, group: 'UselessItems2', name: 'Materials Bag' } })).body, { error: 'vault-goods' }, 'BAG1: a bag stays with its owner');
  // the guild keeps its pieces: no disband, no lone guildmaster's leave, until they are taken out
  assert.equal((await put({ pick: 0, item: sword() })).status, 200);
  s.raw.prepare('DELETE FROM guild_members WHERE char_id = ?').run(s.member.character);
  assert.deepEqual((await s.call('/v1/guilds/disband', { character: s.gm.character }, s.gm.secret)).body, { error: 'guild-vault', keeps: ['guild-vault'] });   // PIN MOVED: GUILD3c (bible/11-Multiplayer/Guilds-Made-Plain.md) - the whole list beside the first
  assert.deepEqual((await s.call('/v1/guilds/leave', { character: s.gm.character }, s.gm.secret)).body, { error: 'guild-vault', keeps: ['guild-vault'] });   // PIN MOVED: GUILD3c (bible/11-Multiplayer/Guilds-Made-Plain.md) - the whole list beside the first
});

/** Holds the next realm record read (the take's prepareRealmRecord) until `release` - the take has read its slot and its
 *  standing, and its batch lands after whatever runs meanwhile. */
function holdNextRead(s) {
  const realGet = s.env.SAVES.get.bind(s.env.SAVES);
  let release = () => {}, reach = () => {};
  const gate = new Promise((r) => { release = r; });
  // AUDIT ONLINE 3 (CI): `reached` settles the moment the read is held - the callers slept 20 ms and hoped it had, and
  // a loaded runner's read came later (verify, PR #963: "true !== false" at G4's armed check)
  const reached = new Promise((r) => { reach = r; });
  const held = { armed: true, release: () => release(), reached: Promise.race([reached, new Promise((r) => setTimeout(r, 5000))]) };
  s.env.SAVES.get = async (k) => { if (held.armed) { held.armed = false; reach(); await gate; } return realGet(k); };
  held.restore = () => { s.env.SAVES.get = realGet; };
  return held;
}

test('GUILD2 service (AUDIT G1): a take holds the very piece it read - a slot emptied and filled again in the same second, with a stack of the same count, is never the one taken', async () => {
  const s = await stand();
  const m = `m${s.memberRow(s.member).rid}`;
  assert.equal((await s.call('/v1/guilds/vault/grant', { character: s.gm.character, member: m, level: 'withdraw', limit: 0 }, s.gm.secret)).status, 200);
  assert.equal((await s.call('/v1/guilds/vault/put', { character: s.gm.character, realm: s.gm.realm.at(), pick: 0, item: sword() }, s.gm.secret)).status, 200);
  const at = (await s.call('/v1/guilds/vault', { character: s.member.character }, s.member.secret)).body.vault.items[0].at;
  const hold = holdNextRead(s);
  const stale = s.call('/v1/guilds/vault/take', { character: s.member.character, realm: s.member.realm.at(), slot: 0, at }, s.member.secret);
  await hold.reached;
  assert.equal(hold.armed, false, 'the member\'s take has read the slot');
  // the same second: the guildmaster takes the sword back and puts one arrow in the slot it left
  assert.equal((await s.call('/v1/guilds/vault/take', { character: s.gm.character, realm: s.gm.realm.at(), slot: 0, at }, s.gm.secret)).status, 200);
  const arrow = await s.call('/v1/guilds/vault/put', { character: s.gm.character, realm: s.gm.realm.at(), pick: 0, item: arrows(40), count: 1 }, s.gm.secret);
  assert.deepEqual([arrow.status, arrow.body.slot], [200, 0]);
  hold.release();
  const r = await stale;
  hold.restore();
  assert.deepEqual([r.status, r.body.error], [409, 'guild-vault-moved'], 'the slot holds another piece now');
  assert.deepEqual((await s.record(s.member)).items.map((i) => i.name), ['Brenna\'s Blade'], 'no second sword');
  assert.deepEqual(s.raw.prepare('SELECT slot, name, count FROM guild_vault WHERE guild_id = ?').all(s.gid).map((x) => ({ ...x })), [{ slot: 0, name: 'Arrow', count: 1 }], 'the arrow put in stays');
});

test('GUILD2 service (AUDIT G4): a take holds the standing it read - a revoke landing between the read and the batch refuses it', async () => {
  const s = await stand();
  const m = `m${s.memberRow(s.member).rid}`;
  assert.equal((await s.call('/v1/guilds/vault/grant', { character: s.gm.character, member: m, level: 'withdraw', limit: 0 }, s.gm.secret)).status, 200);
  assert.equal((await s.call('/v1/guilds/vault/put', { character: s.gm.character, realm: s.gm.realm.at(), pick: 0, item: sword() }, s.gm.secret)).status, 200);
  const hold = holdNextRead(s);
  const take = s.call('/v1/guilds/vault/take', { character: s.member.character, realm: s.member.realm.at(), slot: 0 }, s.member.secret);
  await hold.reached;
  assert.equal(hold.armed, false);
  assert.equal((await s.call('/v1/guilds/vault/grant', { character: s.gm.character, member: m, level: 'none' }, s.gm.secret)).status, 200, 'the leader revokes');
  hold.release();
  const r = await take;
  hold.restore();
  assert.deepEqual([r.status, r.body.error], [403, 'guild-vault-rank']);
  assert.equal(s.raw.prepare('SELECT COUNT(*) AS n FROM guild_vault WHERE guild_id = ?').get(s.gid).n, 1, 'the sword stays in the vault');
  assert.deepEqual((await s.record(s.member)).items.map((i) => i.name), ['Brenna\'s Blade']);
});

test('GUILD2 service (AUDIT G2): a lone guildmaster deleting its realm character empties the vault first (`guild-vault`) - deleted, the guild stood memberless with pieces nobody could take out', async () => {
  const s = await stand();
  assert.equal((await s.call('/v1/guilds/vault/put', { character: s.gm.character, realm: s.gm.realm.at(), pick: 0, item: sword() }, s.gm.secret)).status, 200);
  assert.equal((await s.call('/v1/guilds/leave', { character: s.member.character }, s.member.secret)).status, 200);
  const del = await s.call('/v1/realm/delete', { id: s.gm.character }, s.gm.secret);
  assert.deepEqual([del.status, del.body.error], [409, 'guild-vault']);
  assert.equal(s.raw.prepare('SELECT COUNT(*) AS n FROM guild_members WHERE guild_id = ?').get(s.gid).n, 1, 'the guildmaster stays');
  assert.equal(typeof REFUSALS['guild-vault'], 'string', 'and is told so');
});

test('GUILD2 service: the guild\'s view carries the vault\'s shelves and every member\'s standing; a hall adds fifty', async () => {
  const s = await stand();
  const view = (await s.call('/v1/guilds/mine', { character: s.gm.character }, s.gm.secret)).body.guild;
  assert.deepEqual(view.vault, { used: 0, max: 50, me: { level: 'withdraw', limit: 0, granted: false, taken: 0 } });
  assert.deepEqual(view.members.map((m) => [m.name, m.vault.level]), [['Aldric', 'withdraw'], ['Brenna', 'deposit']]);
  assert.equal(view.renamedAt, null);
  s.raw.prepare("INSERT INTO homes (map_id, building_key, player, char_id, region, price, paid, bought_at, guild_id, owner_name) VALUES (1, 'b1', ?, ?, 0, 100, 100, 1, ?, 'x')").run(s.gm.id, s.gm.character, s.gid);
  const hall = (await s.call('/v1/guilds/mine', { character: s.gm.character }, s.gm.secret)).body.guild;
  assert.equal(hall.vault.max, 100);
});

// ─── THE SECOND AUDIT (Guild-Overhaul.md, the second audit) ─────────

test('GUILD2 service (AUDIT2 S3/S4): a put holds what it read - the standing (a revoke between the read and the batch refuses it), and the vault\'s bound as the batch finds it (a hall sold under a put into its fifty takes nothing); the piece stays in the record (mutants: the standing unheld; the bound by the read alone)', async () => {
  const s = await stand();
  const m = `m${s.memberRow(s.member).rid}`;
  const put = (who, b) => s.call('/v1/guilds/vault/put', { character: who.character, realm: who.realm.at(), ...b }, who.secret);
  // S4: Brenna puts in (a member's default); the guildmaster takes it away between her read and her batch
  let hold = holdNextRead(s);
  const racing = put(s.member, { pick: 0, item: sword({ name: 'Brenna\'s Blade' }) });
  await hold.reached;
  assert.equal(hold.armed, false, 'the put has read its standing');
  assert.equal((await s.call('/v1/guilds/vault/grant', { character: s.gm.character, member: m, level: 'none' }, s.gm.secret)).status, 200);
  hold.release();
  const r = await racing;
  hold.restore();
  assert.deepEqual([r.status, r.body.error], [403, 'guild-vault-rank']);
  assert.equal(s.raw.prepare('SELECT COUNT(*) AS n FROM guild_vault WHERE guild_id = ?').get(s.gid).n, 0);
  assert.deepEqual((await s.record(s.member)).items.map((i) => i.name), ['Brenna\'s Blade'], 'the blade stays hers');
  // S3: fifty pieces on the shelves and a hall's fifty more; the hall sold while a put into the fifty-first is out
  for (let i = 0; i < GUILD_VAULT_SLOTS; i++) {
    s.raw.prepare('INSERT INTO guild_vault (guild_id, slot, rec, name, count, dep_player, dep_char, dep_name, at) VALUES (?, ?, ?, ?, 1, ?, ?, ?, ?)')
      .run(s.gid, i, JSON.stringify(arrows(1)), 'Arrow', s.gm.id, s.gm.character, 'Aldric', _now);
  }
  s.raw.prepare(`INSERT INTO homes (map_id, building_key, player, char_id, owner_name, region, entry, price, bought_at, paid, guild_id)
    VALUES (1, 1, ?, ?, 'The Iron Oath', 17, 'guild', 20000, ?, 20000, ?)`).run(s.gm.id, `g:${s.gid}`, _now, s.gid);
  hold = holdNextRead(s);
  const into = put(s.gm, { pick: 0, item: sword() });
  await new Promise((res) => setTimeout(res, 20));
  assert.equal(hold.armed, false, 'the put has read a hall\'s hundred');
  s.raw.prepare('DELETE FROM homes WHERE guild_id = ?').run(s.gid);   // sold
  hold.release();
  const full = await into;
  hold.restore();
  assert.deepEqual([full.status, full.body.error], [409, 'guild-vault-full']);
  assert.equal(s.raw.prepare('SELECT COUNT(*) AS n FROM guild_vault WHERE guild_id = ?').get(s.gid).n, GUILD_VAULT_SLOTS);
  assert.equal((await s.record(s.gm)).items.some((i) => i.name === 'Steel Longsword'), true, 'the sword stays in the record');
});

test('GUILD2 service (AUDIT2 S5/S6): a grant holds its granter\'s rank - a guildmaster who handed the guild over between the read and the write grants nothing; a withdrawer\'s grant that names no limit stands at ten a day, never none (mutants: the granter unheld; no limit for none named)', async () => {
  const s = await stand();
  const m = `m${s.memberRow(s.member).rid}`;
  const grant = (b) => s.call('/v1/guilds/vault/grant', { character: s.gm.character, member: m, ...b }, s.gm.secret);
  const g = await grant({ level: 'withdraw' });
  assert.equal(g.status, 200, JSON.stringify(g.body));
  assert.deepEqual(g.body.vault, { level: 'withdraw', limit: 10, granted: true });
  assert.equal(Number(s.raw.prepare('SELECT vault_limit FROM guild_members WHERE char_id = ?').get(s.member.character).vault_limit), 10);
  assert.equal((await grant({ level: 'withdraw', limit: 0 })).body.vault.limit, 0, 'no limit, as the guildmaster chose it');
  assert.equal(vaultGrantOf({ level: 'withdraw', limit: null }).limit, 10);
  assert.equal(vaultGrantOf({ level: 'deposit' }).limit, 0);
  // S5: the granter's rank moved under the write (a hand-over landing between the read and the UPDATE)
  const realPrepare = s.env.DB.prepare.bind(s.env.DB);
  s.env.DB.prepare = (sql) => {
    if (/^UPDATE guild_members SET vault_level/.test(sql)) s.raw.prepare('UPDATE guild_members SET rank = 1 WHERE char_id = ?').run(s.gm.character);
    return realPrepare(sql);
  };
  const moved = await grant({ level: 'none' });
  s.env.DB.prepare = realPrepare;
  assert.deepEqual([moved.status, moved.body.error], [403, 'guild-rank']);
  assert.equal(s.raw.prepare('SELECT vault_level FROM guild_members WHERE char_id = ?').get(s.member.character).vault_level, 'withdraw', 'nothing granted');
});

test('GUILD2 service (AUDIT2 G3): a divided field, its second colour and the device\'s own ride the service whole - raised, read back as raised; arms the law refuses are refused there too (mutants: field2 or charge dropped on the way; a border of the second colour stored)', async () => {
  const s = await stand();
  const arms = { field: 'azure', border: 'gold', device: 'owl', division: 'quarterly', field2: 'crimson', charge: 'argent' };
  const bad = await s.call('/v1/guilds/heraldry', { character: s.gm.character, heraldry: { ...arms, field2: 'gold' } }, s.gm.secret);
  assert.equal(bad.body.error, 'bad-heraldry', 'a border of the second colour');
  const r = await s.call('/v1/guilds/heraldry', { character: s.gm.character, heraldry: arms }, s.gm.secret);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  const mine = await s.call('/v1/guilds/mine', { character: s.gm.character }, s.gm.secret);
  assert.deepEqual(mine.body.guild.heraldry, arms);
  assert.deepEqual(JSON.parse(s.raw.prepare('SELECT heraldry FROM guilds WHERE id = ?').get(s.gid).heraldry), arms);
});

test('GUILD2 service (AUDIT2 G1): a Chronicle row names a guild as it was that day, and a guild renamed since carries `now` - so its old lines keep its arms, and a new guild founded with the old name and tag wears only its own (mutants: no `now`; the row\'s time unread - the new guild\'s lines given to the old)', async () => {
  const s = await stand({ SEATS_OPEN: 'on' });
  const KEY = 3021;
  const IRON = { name: 'The Iron Oath', tag: 'IRON' };
  const history = (data, at) => s.raw.prepare("INSERT INTO town_seat_history (key, week, kind, data, at) VALUES (?, 1, 'claim', ?, ?)").run(KEY, JSON.stringify(data), at);
  history({ guild: IRON, total: 6000 }, _now - 10);
  s.realmGold(GUILD_RENAME_GOLD);
  assert.equal((await s.call('/v1/guilds/rename', { character: s.gm.character, name: 'The Ember Oath', tag: 'EMB' }, s.gm.secret)).status, 200);
  // the old name and tag free again - another guild takes them, and its own claim follows
  const other = await s.registered('Corin', { renown: 10 });
  other.realm = await seatRealm(s.env, other.secret, 'Corin', { name: 'Corin', level: 5, goldPieces: 20_000, items: [], bankAccounts: [{ accountGold: 0 }] });
  s.raw.prepare('INSERT OR REPLACE INTO renown_tracks (player, char_id, name, xp, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)').run(other.id, other.realm.id, 'Corin', 1_000_000, T0, T0);
  const b = await s.call('/v1/guilds/found', { character: other.realm.id, name: IRON.name, tag: IRON.tag, realm: other.realm.at(), region: 0 }, other.secret);
  assert.equal(b.status, 200, JSON.stringify(b.body));
  history({ guild: IRON, total: 6100 }, _now + 10);
  const r = await s.call('/v1/seats/records', { key: KEY }, s.gm.secret);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.deepEqual(r.body.rows.map((x) => x.data.guild), [{ ...IRON, now: { name: 'The Ember Oath', tag: 'EMB' } }, IRON], 'the first line the Ember Oath\'s, the second the new Iron Oath\'s');
  // and the book's Roll of Arms finds each by it
  const armsOf = heraldryLookup(() => [
    { tag: 'EMB', name: 'The Ember Oath', heraldry: { field: 'azure', border: 'gold', device: 'owl' } },
    { tag: 'IRON', name: 'The Iron Oath', heraldry: { field: 'crimson', border: 'sable', device: 'wolf' } },
  ]);
  assert.deepEqual(hallOfRecordsRoll(r.body.rows, { key: KEY, name: 'Anticlere', region: 21, tier: 'palace' }, armsOf), [
    'The Iron Oath <IRON> (now the Ember Oath <EMB>): Azure bordered Gold, an Owl.',
    'The Iron Oath <IRON>: Crimson bordered Sable, a Wolf.',
  ]);
});

test('GUILD2 service (AUDIT2 D3): two renames racing pay once - the batch holds the row it read (its name and tag) and the fortnight, never the early read alone', async () => {
  const s = await stand();
  s.realmGold(GUILD_RENAME_GOLD * 2);
  const realBatch = s.env.DB.batch.bind(s.env.DB);
  let held = null;
  s.env.DB.batch = async (list) => {   // the first rename's batch waits until the second has made its own reads
    if (list.length > 4 && held === null) { let go; held = new Promise((res) => { go = res; }); held.go = go; await held; return realBatch(list); }
    if (list.length > 4 && held) { try { return await realBatch(list); } finally { held.go(); } }
    return realBatch(list);
  };
  const [a, b] = await Promise.all([
    s.call('/v1/guilds/rename', { character: s.gm.character, name: 'The Ember Oath' }, s.gm.secret),
    s.call('/v1/guilds/rename', { character: s.gm.character, name: 'The Ash Oath' }, s.gm.secret),
  ]);
  s.env.DB.batch = realBatch;
  assert.deepEqual([a.status, b.status].sort(), [200, 409], JSON.stringify([a.body, b.body]));
  assert.equal([a, b].find((x) => x.status === 409).body.error, 'guild-rename-soon');
  assert.equal(Number(s.raw.prepare('SELECT realm_gold FROM guilds WHERE id = ?').get(s.gid).realm_gold), GUILD_RENAME_GOLD, 'paid once');
  assert.equal(s.raw.prepare('SELECT COUNT(*) AS n FROM guild_renames WHERE guild_id = ?').get(s.gid).n, 1);
});
