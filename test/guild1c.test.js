// GUILD1c (2026-09-25, Mac: "Do guild1c"): THE TAG BESIDE THE NAME, AND THE GUILD'S CHAT. A character's guild rides
// its identity token (net/identityToken.js `gi`/`gt`/`gm`), read at the mint off the roster
// (server-account/src/guilds.js guildBadgeOf); every guild act that moves a membership answers a SIGNED order (the
// actor's guild now, or a member or a guild gone); the relay stamps the tag beside the level, takes the orders, holds
// a removal against older tokens, and fans a guild's line to its members alone (server/src/index.js). The service is
// the real Worker over node:sqlite with every migration applied; the relay is the real Room over the fake object.
// `06-Systems/Online-Arc.md` GUILD1c.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import worker from '../server-account/src/index.js';
import { _resetKeyForTests } from '../server-account/src/signing.js';
import { GUILD_FOUND_RENOWN } from '../src/net/guildLaw.js';
import { renownXpFor } from '../src/net/renown.js';
import {
  claimsValid, mintToken, verifyToken, orderValid, verifyOrder, guildClaimsValid, mintGuildOrder, mintGuildOutOrder,
  mintRenownOrder, mintOrder, ORDER_KINDS, ORDER_TTL_S, MAX_TTL_S,
} from '../src/net/identityToken.js';
import {
  parseClient, badged, readGuildTag, CHAT_LINE_CHANNELS, SOCIAL_ROOM, relaySupportsGuild, GUILD_RELAY_MIN, RELAY_VERSION,
  guildGate, GUILD_ORDER_HZ_MAX, GUILD_CHAT_ROOM_HZ_MAX,
} from '../src/net/wire.js';
import { fakeRoom } from './fakeRoom.mjs';
import { withClock } from './placeWidest.mjs';   // the relay's gates on a clock the test turns - a second is a tick, not a wait
import { fakeSocketClass } from './fakeSocket.mjs';
import { OnlineSession, GUILD_SEND_MS, GUILD_RESEND_MS } from '../src/net/online.js';
import { GuildBook, guildBadgeKey } from '../src/net/guildBook.js';
import { CHAT_TABS, NO_GUILD_TEXT, GUILD_OLD_RELAY_TEXT } from '../src/net/chat.js';
import { CHANNEL_COMMANDS, parseChatLine } from '../src/net/chatCommands.js';
import { guildRosterSource, rosterRows } from '../src/net/roster.js';
import { guildTagText } from '../src/net/guildLaw.js';
import { RemotePlayers } from '../src/net/remotePlayers.js';
import { measureText } from '../src/ui/text.js';
import { createNameLayer } from '../src/ui/nameLayer.js';
import { profileView } from '../src/ui/profileWindow.js';
import { accountTokenMinter, SESSION_KEY } from '../src/net/accountClient.js';
import { PEER_HEIGHT } from '../src/net/remotePlayers.js';
import { perspective, mirrorProjectionX, lookAt } from '../src/world/mat4.js';
import { r2, seatRealm } from './realmSeat.mjs';   // AUDIT REALM2 S2: a founding is a realm character's, paid on its record
import { ACCEPTED } from '../src/net/legalLaw.js';   // TERMS1: a request that makes an account carries the versions ticked

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const { subtle } = globalThis.crypto;
const ofType = (ws, t) => ws.sent.filter((m) => m.t === t);
const G1 = 'gaaaaaaaaaa', G2 = 'gbbbbbbbbbb';

// ─── THE LAW ─────────────────────────────────────────────────────────────────────────────────────────────────────────

test('GUILD1c the token: a character\'s guild rides it as three claims - its id, its tag and its member row - ALL THREE OR NONE, each a string of the law\'s own shape; the minter refuses a partial set rather than trimming it (mutants: two of the three admitted; a tag of the wrong shape signed; an array stringifying to a tag taken)', async () => {
  const base = { s: 'acct-0001', n: 'Mara', k: 'linked', i: 1000, e: 1100 };
  const g = { gi: G1, gt: 'HND', gm: 'm12' };
  assert.equal(claimsValid(base), true, 'none: a character in no guild, or a service before GUILD1c');
  assert.equal(claimsValid({ ...base, ...g }), true);
  for (const k of ['gi', 'gt', 'gm']) {
    const part = { ...base, ...g }; delete part[k];
    assert.equal(claimsValid(part), false, `without ${k}: all three or none`);
  }
  assert.equal(claimsValid({ ...base, ...g, gt: 'hnd' }), false, 'a tag is capitals and digits');
  assert.equal(claimsValid({ ...base, ...g, gt: 'TOOLONG' }), false);
  assert.equal(claimsValid({ ...base, ...g, gt: ['HND'] }), false, 'never coerced: an array that stringifies to a tag is not one');
  assert.equal(claimsValid({ ...base, ...g, gi: 'g123' }), false, 'a guild id is the law\'s own shape');
  assert.equal(claimsValid({ ...base, ...g, gm: 'x12' }), false, 'and so is a member row');
  assert.equal(guildClaimsValid({}), true);
  const kp = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const tok = await mintToken({ s: 'acct-0001', n: 'Mara', k: 'linked', ...g }, kp.privateKey, { subtle, nowS: 1000 });
  const v = await verifyToken(tok, kp.publicKey, { subtle, nowS: 1001 });
  assert.equal(v.ok, true);
  assert.deepEqual([v.claims.gi, v.claims.gt, v.claims.gm], [G1, 'HND', 'm12']);
  const none = await verifyToken(await mintToken({ s: 'acct-0001', n: 'Mara', k: 'linked' }, kp.privateKey, { subtle, nowS: 1000 }), kp.publicKey, { subtle, nowS: 1001 });
  assert.equal('gi' in none.claims || 'gt' in none.claims || 'gm' in none.claims, false, 'a character in no guild mints the bytes it always did');
  await assert.rejects(mintToken({ s: 'acct-0001', n: 'Mara', k: 'linked', gi: G1, gt: 'HND' }, kp.privateKey, { subtle, nowS: 1000 }), TypeError, 'a partial set refused at the minter');
});

test('GUILD1c the orders: `guild` says the carrier\'s guild now (all three or none), `guildout` a member removed (`gm`) or a guild gone (no `gm`) and never a tag; each kind carries its own fields and no other\'s, and the mute and renown orders carry none of a guild\'s; verifyOrder asks for its kind by name (mutants: a guild order read at the renown door; a guildout with a tag; a mute carrying a guild)', async () => {
  assert.deepEqual([...ORDER_KINDS], ['mute', 'renown', 'guild', 'guildout', 'siege']);   // SEAT2a: a battle's pass (PIN MOVED)
  const o = { s: 'acct-0001', i: 1000, e: 1000 + ORDER_TTL_S };
  assert.equal(orderValid({ o: 'guild', ...o, gi: G1, gt: 'HND', gm: 'm3' }), true);
  assert.equal(orderValid({ o: 'guild', ...o }), true, 'none: a leave, a disbanding');
  assert.equal(orderValid({ o: 'guild', ...o, gi: G1, gt: 'HND' }), false, 'all three or none');
  assert.equal(orderValid({ o: 'guild', ...o, gi: G1, gt: 'HND', gm: 'm3', lv: 5 }), false, 'nothing of another kind');
  assert.equal(orderValid({ o: 'guildout', ...o, gi: G1, gm: 'm3' }), true, 'a member removed');
  assert.equal(orderValid({ o: 'guildout', ...o, gi: G1 }), true, 'a guild gone');
  assert.equal(orderValid({ o: 'guildout', ...o }), false, 'a guildout names its guild');
  assert.equal(orderValid({ o: 'guildout', ...o, gi: G1, gt: 'HND' }), false, 'and never a tag, which names nobody');
  assert.equal(orderValid({ o: 'guildout', ...o, gi: G1, gm: 3 }), false, 'a member row is a string of its shape');
  assert.equal(orderValid({ o: 'mute', ...o, mu: 0, gi: G1, gt: 'HND', gm: 'm3' }), false, 'a mute carries no guild');
  assert.equal(orderValid({ o: 'renown', ...o, lv: 4, gi: G1, gt: 'HND', gm: 'm3' }), false, 'nor a renown order');
  const kp = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const nowS = 5000;
  const joined = await mintGuildOrder({ s: 'acct-0001', gi: G1, gt: 'HND', gm: 'm3' }, kp.privateKey, { subtle, nowS });
  const left = await mintGuildOrder({ s: 'acct-0001' }, kp.privateKey, { subtle, nowS });
  const removed = await mintGuildOutOrder({ s: 'acct-0002', gi: G1, gm: 'm4' }, kp.privateKey, { subtle, nowS });
  const gone = await mintGuildOutOrder({ s: 'acct-0001', gi: G1 }, kp.privateKey, { subtle, nowS });
  const read = (tok, kind) => verifyOrder(tok, kp.publicKey, { subtle, nowS: nowS + 1, kind });
  assert.deepEqual((await read(joined, 'guild')).claims, { o: 'guild', s: 'acct-0001', i: nowS, e: nowS + ORDER_TTL_S, gi: G1, gt: 'HND', gm: 'm3' });
  assert.deepEqual((await read(left, 'guild')).claims, { o: 'guild', s: 'acct-0001', i: nowS, e: nowS + ORDER_TTL_S });
  assert.deepEqual((await read(removed, 'guildout')).claims, { o: 'guildout', s: 'acct-0002', gi: G1, i: nowS, e: nowS + ORDER_TTL_S, gm: 'm4' });
  assert.equal((await read(gone, 'guildout')).claims.gm, undefined);
  assert.equal((await read(joined, 'renown')).ok, false, 'a guild order at the renown door is nothing');
  assert.equal((await read(joined, 'guildout')).ok, false, 'nor at the removal\'s');
  assert.equal((await read(removed, 'guild')).ok, false, 'and a removal is no join');
  assert.equal((await read(await mintRenownOrder({ s: 'acct-0001', lv: 3 }, kp.privateKey, { subtle, nowS }), 'guild')).ok, false);
  await assert.rejects(mintGuildOrder({ s: 'acct-0001', gi: G1 }, kp.privateKey, { subtle, nowS }), TypeError);
  await assert.rejects(mintGuildOutOrder({ s: 'acct-0001' }, kp.privateKey, { subtle, nowS }), TypeError);
});

test('GUILD1c the wire: the guild frames are shapes only, as the renown order\'s; a line may name the guild channel; `badged` stamps the TAG alone - never the guild\'s id nor the member row - and `readGuildTag` reads back only the law\'s shape; world113 is the first relay that knows either (mutants: the tag unstamped; the id leaking onto a row; a guild line sent to world112)', () => {
  assert.deepEqual(parseClient('{"t":"guild","order":"v1.a.b"}', { hasHello: true }), { t: 'guild', order: 'v1.a.b' });
  assert.deepEqual(parseClient('{"t":"guildout","order":"v1.a.b"}', { hasHello: true }), { t: 'guildout', order: 'v1.a.b' });
  assert.deepEqual(parseClient('{"t":"guild","order":"v1.a.b"}', { hasHello: false }), { error: 'guild before hello' });
  assert.deepEqual(parseClient(JSON.stringify({ t: 'guildout', order: 'x'.repeat(1025) }), { hasHello: true }), { error: 'bad guildout' });
  assert.deepEqual(parseClient(JSON.stringify({ t: 'guild', order: 7 }), { hasHello: true }), { error: 'bad guild' });
  assert.deepEqual([...CHAT_LINE_CHANNELS], ['party', 'guild']);
  assert.deepEqual(parseClient(JSON.stringify({ t: 'chat', text: 'hail', ch: 'guild' }), { hasHello: true }), { t: 'chat', text: 'hail', ch: 'guild' });
  assert.deepEqual(parseClient(JSON.stringify({ t: 'roll', n: 1, m: 6, k: 0, ch: 'guild' }), { hasHello: true }), { t: 'roll', n: 1, m: 6, k: 0, ch: 'guild' });
  assert.deepEqual(badged({ id: 'x' }, { gi: G1, gt: 'HND', gm: 'm3', lv: 4 }), { id: 'x', lv: 4, gt: 'HND' }, 'the tag beside the level, and nothing else of the guild');
  assert.deepEqual(badged({ id: 'x' }, { gt: 'hnd' }), { id: 'x' }, 'a tag the law does not admit is not stamped');
  assert.equal(readGuildTag({ gt: 'HND' }), 'HND');
  assert.equal(readGuildTag({ gt: '<b>' }), null, 'a stranger\'s word about themselves');
  assert.equal(readGuildTag({ gt: ['HND'] }), null);
  assert.equal(readGuildTag({}), null);
  assert.equal(RELAY_VERSION, 'world169');   // AUDIT ARENA-LADDER moved it on last (world169: the arena ladder audit - elite champions, telegraphed blows, a judging floor and the attempt ticket - world167 on its branch, renumbered past SHADOW-CLOAK and SERAPH-WINGS at the merges); SERAPH-WINGS moved it on (world168: the Seraph Wings join the aura vocabulary of the token - a relay before it refuses the token of a developer wearing them); SHADOW-CLOAK moved it on (world167: the Holo Shadow Cloak joins the token's aura vocabulary - a relay before it refuses SirMcMobdon's token once they wear it; world165 on its branch, renumbered past SERPENT1 and SERPENT2 at the merges); SERPENT2 moved it on (world166: the serpent herald - a serpent site word to the hub, its bells and its kill posted to Discord); SERPENT1 moved it on (world165: the serpent frame - a sea serpent fight in the cell of its site; world162 on its branch, renumbered past PRIMARCH (world162) and SUNBABY1 (world163), then PARTY-LEAD (world164), at the merges); PARTY-LEAD moved it on (world164: the hub's party.lead act - a leader hands the lead to a member); SUNBABY1 moved it on (world163: the hub's live events gain the sun baby's word - LIVE_EVENTS, no frame changes shape); PRIMARCH moved it on (world162: the Primarch's title and glyph and the Golden Radiance's aura join the token's vocabulary - a relay before it refuses GA00250's token); GUILD2 moved it on (world161: no wire change - the guild and heraldry laws moved under the relay); AEGIS moved it on (world160: the Aegis of Oblivion's title and glyph and the Oblivion Ward's aura join the token's vocabulary - a relay before it refuses Sureme's token); ARENA4 moved it on (world155: the arena rooms - the hall queue, the refereed bouts, the stands - and the arena titles and laurel on the token - world142 on its branch, renumbered past main's FRIENDS-SYNC, ELITE FOES, the Seats arc, WB12, GLYPH-WEAR, REVENANT-WIRE and BROKER-CAGE (world142-world154) at the merge); BROKER-CAGE moved it on (world154: the rite word says every one of the faithful fell, and the hub says the Broker cage open); REVENANT-WIRE moved it on (world153: the foe record carries a revenant's name, nm, and a beaten one's kneel, burning and oath, yd/ex/sp); GLYPH-WEAR moved it on (world152); WB12 moved it on (world151: Dagon's Breach - its words in the omen's lines and the herald's posts, the faithful's rite - main's CLIMB5 and CLIMB6, FRIENDS-SYNC, ELITE FOES and the Seats arc took world141-world150 first); before it SEAT2b part two (b) moved it on (world150: the works in battle); SEASON1 part two, the banner ribbon moved it on (world149: the banner ribbon - the Seats arc's six relays renumbered past main's HERALD, LOOT7, WB11 and CLIMB5 (world138-world141) at the merge); CROWN1 part two moved it on (world148: the Royal Tourney); SEAT2a moved it on (world147: the siege battle); PVP-REF moved it on (world146: the refereed siege room); SEAT1c moved it on (world145: the seats' titles and glyphs - five generic title ids, a `ts` claim beside them, four glyphs); SEAT1b moved it on (world144: the Watch's tick - a `watch` frame carrying a `k1` receipt the relay signs, net/watchReceipt.js); ELITE FOES moved it on (world143: the foe record carries an elite foe, z, so a puppet stands as one); before it FRIENDS-SYNC moved it on (world142: the hub account is the signed-in player - the token subject - and a browser profile list is merged into it once); before it CLIMB5 and CLIMB6 moved it on (world141: the pose's climb - `cl`, `cw` and a move's `ck`, `cy`, `cd`); before it WB11 moved it on (world140: the host of the Legion-Lord - the `ahit` blow on one of it, the words `ad`, `amv`, `aatk`, `ah` and `adie` of the room, `lg` in the state, `a` in a chart row, the brain law 5; GATE-HEAL's `heal` and a chart row's `hl` with it - main's HERALD and LOOT7 took world138 and world139 first); before it LOOT7 moved it on (world139: the street foe record field `cp`, a champion trait - HERALD took world138 first); before it HERALD moved it on (world138: `herald` joins the titles and glyphs a token carries, the Patreon tier between Disciple and Hierophant); before it KEPT-KILL moved it on (world137: the party pose field `qk`, the kills of quest foes a member held for a partner, counted by every copy of the quest); before it GATE-UX moved it on (world136: the damage chart made at the kill - every challenger and their part, ranked, on the `fell` word of the court and on the fall in the state (`dm`)); before it WB9 moved it on (world135: the three courts of the Warden and the Reckoning of Dagon - his court and the walkways laid in the state (`ct`, `xa`), the crystals, their breaking and the stun (`cx`, `cxh`, `cxb`, `stun`, `su`, `rk`) and a blow on a crystal (`xhit`), judged and fanned by the relay - main's PARTY-MAP took world134 first); before it PARTY-MAP moved it on (world134: the `amap` frame, the automap rows a Shared Cartography caster reveals, to the party alone); before it SOFTCAP1 moved it on (world133: the party pose `cl`, a member character level for mentor mode); before it STRIKE-SHARED moved it on (world132: the strike spell on a hit and the trapper on a dead foe, both read by the clients alone); before it MERGE 2 moved it on (world131: the professions branch, BOUNTY1 + AUDIT 28 - `bq` and `lv` on the party pose, `k`, `a` and `t` on a bounty row - world125 on its branch, never deployed, a number VOICE1 took on main); before it REALM-DOOR moved it on (world130: the door refuses a token the account service signed as naming no realm character); before it PENITENT's badge vocabulary (world129); before it WB8 moved it on (world128: marks on the gate state, the fed word - world126 on its branch, never deployed, renumbered past OW6L at the merge); before it OW6L (world127: the overworld ledger of a cell, the ow frame - never world125 (VOICE1, reverted) nor world126 (DISCORD-GATES on its branch)); before it TV8 (world124: the party's Overworld walk - world123 on its branch, renumbered past THE MERGE's); before it THE MERGE (world123: the raids, the gates and Discord - world122 to world126 on their branch, never deployed - one relay past main's TV3); before it TV3 (world122: a region's traveller marks); ONE-SEAT before it (world121 - world119, then world120, on its branch, renumbered past main's AUDIT SET (world119) and PARTY-BUFFS + REST-OPT (world120) at the merges: a hub hello's claim - one tab of an account online); before it PARTY-BUFFS + REST-OPT + the batch audit (world120 - world119, world120 and world121 on their branch, renumbered past main AUDIT SET at the merge: fx, rs and nr on the party pose, TRADE_REV_MAX and REST_OPT_RELAY_MIN named); before it AUDIT SET (world119 - world117 on its branch, renumbered past main's SHADOW-FANG (world117) and OWN1 + INVIS-NET (world118) at the merge: the dungeon foe record carries `v`, the joiner whose blow killed it); OWN1 + INVIS-NET moved it on before (world118 - world114 on their branch, renumbered past main's world114-117 at the merge); SHADOW-FANG's badge vocabulary moved it on before (world117 - world114 on its branch, world116 at its first merge; main's Oblivion Gate WBX took world116 first); the Oblivion Gate's WBX5, AUDIT WBX and AUDIT WBX2 moved it on (world116); GUILD1c was world115 - world113 on the branch; main's AUDIT WB (world113) and the Enhanced Plus patch (world114) took the numbers first
  assert.equal(relaySupportsGuild('world120'), true, 'the merged relay still routes the guild');
  assert.equal(relaySupportsGuild('world118'), true, 'a later relay still routes the guild');
  assert.equal(relaySupportsGuild('world116'), true);
  assert.equal(GUILD_RELAY_MIN, 115);
  assert.equal(relaySupportsGuild('world115'), true);
  assert.equal(relaySupportsGuild('world114'), false, 'the Enhanced Plus patch\'s relay routes no guild frame');
  assert.equal(relaySupportsGuild('world113'), false, 'main\'s AUDIT WB relay routes no guild frame');
  assert.equal(relaySupportsGuild('world112'), false);
  assert.equal(relaySupportsGuild(null), false);
  const g1 = guildGate(null, 1000);
  assert.equal(GUILD_ORDER_HZ_MAX, 1);
  assert.equal(g1.pass, true);
  assert.equal(guildGate(g1.bucket, 1100).pass, false);
});

// ─── THE SERVICE ─────────────────────────────────────────────────────────────────────────────────────────────────────

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
async function stand() {
  _resetKeyForTests();
  const kp = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const pkcs8 = Buffer.from(new Uint8Array(await subtle.exportKey('pkcs8', kp.privateKey))).toString('base64');
  const env = { DB: d1(), SAVES: r2(), IDENTITY_PRIVATE_KEY: pkcs8, ACCOUNT_VERSION: 'test1', ALLOWED_ORIGIN: '*' };
  const call = async (path, body, bearer = null) => {
    const res = await worker.fetch(new Request(`https://accounts.invalid${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(bearer ? { authorization: `Bearer ${bearer}` } : {}) },
      body: JSON.stringify(body),
    }), env);
    return { status: res.status, body: await res.json().catch(() => null) };
  };
  /** AUDIT REALM2 S2: a founder is a REALM character (`realm: true`) - a founding is paid on its record - and `at()` where
   *  that record stands. */
  const registered = async (handle, { character = `char-${handle.toLowerCase()}`, renown = GUILD_FOUND_RENOWN, realm = false } = {}) => {
    const secret = (await call('/v1/auth/guest', { ...ACCEPTED })).body.secret;
    assert.equal((await call('/v1/auth/register', { secret, handle, password: 'a good long one', ...ACCEPTED })).status, 200);
    const id = env.DB._raw.prepare('SELECT id FROM players WHERE handle_lc = ?').get(handle.toLowerCase()).id;
    let at = null;
    if (realm) ({ id: character, at } = await seatRealm(env, secret, handle, { name: handle, level: 9, goldPieces: 100_000, items: [] }));
    if (renown > 1) {
      env.DB._raw.prepare('INSERT OR REPLACE INTO renown_tracks (player, char_id, name, xp, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
        .run(id, character, handle, renownXpFor(renown), 1, 1);
    }
    return { secret, id, character, handle, at };
  };
  const nowS = () => Math.floor(Date.now() / 1000);
  const claimsOf = async (order, kind) => {
    if (order == null) return null;
    const r = await verifyOrder(order, kp.publicKey, { subtle, nowS: nowS(), kind });
    assert.equal(r.ok, true, `a signed ${kind} order`);
    const { o, s, gi, gt, gm } = r.claims;
    return { o, s, gi, gt, gm };
  };
  return { env, call, registered, kp, nowS, claimsOf };
}

test('GUILD1c the service: the mint signs the NAMED character\'s guild in - its id, its tag and its member row off the roster now - and answers the tag beside the level; a character in no guild, another character of the same account, and a mint naming none carry none (mutants: the guild off the body; the account\'s guild for every character; the tag unanswered)', async () => {
  const { call, registered, kp, nowS } = await stand();
  const aldric = await registered('Aldric', { realm: true });
  const { guild } = (await call('/v1/guilds/found', { character: aldric.character, name: 'The Hound', tag: 'HND', realm: aldric.at() }, aldric.secret)).body;
  const rid = (await call('/v1/guilds/mine', { character: aldric.character }, aldric.secret)).body.guild.members.find((m) => m.you).member;
  const mint = async (body) => (await call('/v1/auth/token', body, aldric.secret)).body;
  const tokenOf = async (a) => (await verifyToken(a.token, kp.publicKey, { subtle, nowS: nowS() })).claims;
  const named = await mint({ character: aldric.character, guild: true, gi: G2, gt: 'FAKE', gm: 'm99' });
  const c = await tokenOf(named);
  assert.deepEqual([c.gi, c.gt, c.gm], [guild.id, 'HND', rid], 'the roster\'s own row, never the body\'s word');
  assert.equal(named.guild, 'HND', 'the answer carries the tag my own name wears');
  // AUDIT MERGE-PLUS A6: a mint that names the character and does not ASK for the guild (a RENOWN1-era build, which
  // knows no guild channel) wears none - its level still rides
  const unasked = await mint({ character: aldric.character });
  assert.equal((await tokenOf(unasked)).gi, undefined, 'a build that does not ask is sent no guild lines');
  assert.equal(unasked.guild, null);
  assert.equal((await mint({ character: aldric.character, guild: 'yes' })).guild, null, 'only true asks');
  const other = await mint({ character: 'char-aldric-2', guild: true });
  assert.equal((await tokenOf(other)).gi, undefined, 'the account\'s other character is in no guild');
  assert.equal(other.guild, null);
  const bare = await mint({});
  assert.equal((await tokenOf(bare)).gi, undefined, 'a mint naming no character (an older build) carries none');
  assert.equal(bare.guild, null);
  assert.equal(src('server-account/src/service.js').includes("export const ACCOUNT_VERSION = 'acct82'"), true);   // AUDIT ARENA-LADDER moved it on last (acct82: /v1/arena/attempt and migration 0082, the ladder attempt ticket - acct79 on its branch, renumbered past GLOBAL-MARKET, SHADOW-CLOAK and SERAPH-WINGS at the merges); SERAPH-WINGS moved it on (acct81: DEVELOPER_HANDLES grants the Seraph Wings - DEVELOPER_AURA); SHADOW-CLOAK moved it on (acct80: SHADOW_FANG_HANDLES grants the Holo Shadow Cloak with the title - acct78 on its branch, renumbered past SERPENT1 and GLOBAL-MARKET at the merges); GLOBAL-MARKET moved it on (acct79: buy orders the Bay's - the Orders view reads every board's, and a fill from another region pays its courier out of its pay; no migration); SERPENT1 moved it on (acct78: /v1/serpent/claim and the serpents slain on the cards, migration 0081 - acct75, acct76 then acct77 on its branch, renumbered past HOME-PRICE (acct75), PRIMARCH and FOUNDER4 (acct76) and KNIGHT-HOUSE (acct77) at the merges); FIELD BUGS 2026-10-04d KNIGHT-HOUSE moved it on (acct77: a deed the realm gave, held off the record - /v1/homes/deed and the release of a hold, migration 0079); PRIMARCH and FOUNDER4 moved it on (acct76: PRIMARCH_HANDLES grants the Primarch's title, glyph and aura; migration 0078 links an account to a row it shares a character with, for Founder - acct75 on its branch, which HOME-PRICE took first); HOME-PRICE moved it on (acct75: a home's price held to the online range, the town's sale refund; before it, BAG1 and GUILD2's acct74: the Materials Bag carried count and /v1/stores/deposit, migration 0076; a guild new name and its vault, /v1/guilds/rename and /v1/guilds/vault*, migration 0077); AEGIS moved it on (acct73: AEGIS_HANDLES grants the Aegis of Oblivion's title, glyph and aura); ARENA4, ARENA4b and WD3 moved it on (acct72 - acct66 on the arena branch, renumbered past PROF-541's acct70 and SILVER-WAYS' acct71 at its merges onto main: the arena records and the online homes it displaced - migrations 0074 and 0075 - and the layout a home was bought in - 0073); SILVER-WAYS and PROF2b before it (acct71: a raid's silver under the day's combat cap, guild deeds and guild contracts, the Motherlodes - migrations 0071 and 0072 - acct66 on its branch, renumbered past PROF-541's acct66-acct70 at the merge); AUDIT PROF-541 before it (acct70: the Alchemy audit's fixes, the hall door set by rank alone - hallEntry; a jewel's first craft its piece and base's; no migration); PROF12 before it (acct69: Alchemy's brew, the Apothecaries' counter, a Transmuter's transmutations, Disenchanting, the Apothecary opened; migration 0070); PROF10 before it (acct68: the jeweller's bench's pieces and the jeweller's hand, a Lapidary's cracked gem; no migration); PROF9 before it (acct67: the fire's dishes and a dish's cook's hand, migration 0069; acct67 past another branch's acct66); GUILD-YARD before it (acct65: a guild hall's outside and yard, its keepers'; no migration); AUDIT 529 before it (acct64: SIEGE-VOID's route and migration 0067, STANDING-TREND's standing rows, the void's audit); GLYPH-WEAR before it (acct63: a player shows or hides each glyph, migration 0068); WB12d moved it on (acct62: a receipt's rite and the rite's own receipt, the rows' embers - migration 0066 - main's part four and the Seats arc took acct46-acct61 first); before it SEAT2b part two moved it on (acct61: the works at peace); AUDIT-SEATS, PROF11 and SEAT2b before it (acct60: the audit, Masonry and the works - the Seats arc's fourteen renumbered past main's PATREON-LINK and part four (acct45, acct46) at the merge); SEASON1 part three before it (acct59: the Hall of Records); SEASON1 part two, the banner ribbon before it (acct58: the banner ribbon); SEASON1 part two, the client's before it (acct57: the Orc Raids and the stormy sea); SEASON1 part two, the economy before it (acct56: the economy's Tides); SEASON1 part two before it (acct55: the Tides); SEASON1 part one before it (acct54: the Seasons); CROWN2 before it (acct53: fealty and Pacts); CROWN1 part two before it (acct52: the Royal Tourney); CROWN1 before it (acct51: the crown Edicts); SEAT2a part three before it (acct50: the siege's pass and result); SEAT2a before it (acct49: the battles' week - the holder's window, the schedule, the sides and their Sellswords; migration 0052); SEAT1d before it (acct48: holding a seat - the upkeep, the Tithe, the Edicts; migration 0051); GUILD1d, GUILD1e and SEAT1a before it (acct47: the guild hall, its heraldry, the guild's own board and the seats' registry - migrations 0046, 0047 and 0048; acct42, then acct43, then acct44, then acct45, on their branch, renumbered past main's REALM-GZIP, SCALE1, MARKET-ANY and PATREON-LINK at the merges); FIELD BUGS 2026-10-01 part four before it (acct46: ANY-HOUR and HERB-XP - no hour refused, a herb at the rank's tier; acct45 on its branch, past PATREON-LINK at the merge); PATREON-LINK before it (acct45: a patron's own Patreon linked, its tier's title held by the pledge - migration 0045); MARKET-ANY before it (acct44: FIELD BUGS 2026-10-01 - a piece from the pack listed for gold, migration 0044); SCALE1 before it (acct43: the scaling audit's service half); REALM-GZIP before it (acct42: a realm save rides gzipped); PROF8 before it (acct41: Fishing with the net - migration 0042); GOLD-MARKET before it (acct40: the market in gold or Drakes - migration 0041); PINE-SHARE before it (acct39: Pine in every forest); WB9g before it (acct38: the Broker's insignia - a title and an aura bought, recorded on the row (0040) and paid for by the account's closed gates; the aura worn and signed (`au`)); HOUSING before it (acct37: HOME-RENT's rooms, HOME-LOOK's outside, HOME-YARD's yards - migrations 0037-0039); the PROF7 merge before it (acct36: past main's FIELD BUGS 2026-09-30, acct33, and the branch's acct33-acct35 never deployed); AUDIT 32 S1 before it (acct35: the Weavers' cloth alone lays on no first-craft XP); AUDIT 32 before it (acct34); PROF7 before it (acct33: Hunting, the Skinning Knife and Outfitting); PROF-DELETE before it (acct32: a deleted character's professions go with it); before it RENOWN-CHAR moved it on (acct31: Renown a character's again, migration 0035); before it MERGE 2 moved it on (acct30: the professions branch - Marks, the Notice Board, the professions, the market and its auctions, the guild writs - acct22 to acct29 on its branch, never deployed, its migrations 0025-0034 behind main's 0018-0024); before it HOUSE-LOSS and RESTORE moved it on (acct23 - acct20, then acct21 and acct22, on their branch, which TERMS1, PENITENT and REALM-DOOR took first); before it REALM-DOOR and CUSTOMS-PASS moved it on (acct22: the mint signs whether the named character is the realm's, and a developer's customs pass); before it PENITENT's title and glyph and a fifth Disciple moved it on last (acct21); before it acct12 on the branch; main's BASE-HIDE took acct12 first; GUILD1c shipped at acct13, and SHADOW-FANG (acct14 - acct12 on its branch) moved it on after, then FOUNDER3 (acct15)
  assert.match(src('server-account/wrangler.toml'), /ACCOUNT_VERSION = "acct82"/);
});

test('GUILD1c the service: every act that moves a membership answers a SIGNED order - founding, a join, a leave and the look say the actor\'s guild now (none after leaving), a removal an out order naming the member and its guild, a disbanding the guildmaster\'s none and an out order naming the guild; a declined invitation, a rank moved, a handover and the treasury answer none (mutants: a join answering none; a removal naming the remover; a disbanding naming one member; an order for an act that moved nobody)', async () => {
  const { call, registered, claimsOf } = await stand();
  const aldric = await registered('Aldric', { realm: true });
  const found = (await call('/v1/guilds/found', { character: aldric.character, name: 'The Hound', tag: 'HND', realm: aldric.at() }, aldric.secret)).body;
  const gi = found.guild.id;
  const ridOf = (view, handle) => view.members.find((m) => m.name === handle).member;
  assert.deepEqual(await claimsOf(found.order, 'guild'), { o: 'guild', s: aldric.id, gi, gt: 'HND', gm: ridOf(found.guild, 'Aldric') }, 'the founder wears the tag');
  assert.equal(found.outOrder, undefined);
  const mara = await registered('Mara', { renown: 1 });
  const bran = await registered('Bran', { renown: 1 });
  for (const w of [mara, bran]) await call('/v1/guilds/invite', { character: aldric.character, handle: w.handle }, aldric.secret);
  const declined = (await call('/v1/guilds/answer', { character: bran.character, guild: gi, accept: false }, bran.secret)).body;
  assert.equal('order' in declined, false, 'declining moves nobody');
  const joined = (await call('/v1/guilds/answer', { character: mara.character, guild: gi, accept: true }, mara.secret)).body;
  assert.deepEqual(await claimsOf(joined.order, 'guild'), { o: 'guild', s: mara.id, gi, gt: 'HND', gm: ridOf(joined.guild, 'Mara') }, 'the joiner wears it');
  const look = (await call('/v1/guilds/mine', { character: mara.character }, mara.secret)).body;
  assert.deepEqual(await claimsOf(look.order, 'guild'), { o: 'guild', s: mara.id, gi, gt: 'HND', gm: ridOf(look.guild, 'Mara') }, 'the look says the same');
  const nobody = (await call('/v1/guilds/mine', { character: bran.character }, bran.secret)).body;
  assert.deepEqual(await claimsOf(nobody.order, 'guild'), { o: 'guild', s: bran.id, gi: undefined, gt: undefined, gm: undefined }, 'and a character in none reads none');
  const maraRow = ridOf(look.guild, 'Mara');
  // the acts that move nobody
  for (const [path, body] of [['/v1/guilds/rank', { member: maraRow, rank: 2 }], ['/v1/guilds/deposit', { gold: 5 }], ['/v1/guilds/withdraw', { gold: 5 }], ['/v1/guilds/ranks', { ranks: ['A', 'B', 'C', 'D'] }]]) {
    const r = (await call(path, { character: aldric.character, ...body, ...(/deposit|withdraw/.test(path) ? { realm: aldric.at() } : {}) }, aldric.secret)).body;   // AUDIT REALM2 S2: the treasury moves on the record
    assert.equal(r.ok, true, path);
    assert.equal('order' in r || 'outOrder' in r, false, `${path} moves no membership`);
  }
  // a removal: the member it took off, for the hub
  const removed = (await call('/v1/guilds/remove', { character: aldric.character, member: maraRow }, aldric.secret)).body;
  assert.equal(removed.order, undefined, 'the remover\'s own guild did not move');
  assert.deepEqual(await claimsOf(removed.outOrder, 'guildout'), { o: 'guildout', s: mara.id, gi, gt: undefined, gm: maraRow }, 'the member removed, never the remover');
  // a leave
  await call('/v1/guilds/invite', { character: aldric.character, handle: 'Bran' }, aldric.secret);
  const bj = (await call('/v1/guilds/answer', { character: bran.character, guild: gi, accept: true }, bran.secret)).body;
  const handed = (await call('/v1/guilds/handover', { character: aldric.character, member: ridOf(bj.guild, 'Bran') }, aldric.secret)).body;
  assert.equal('order' in handed || 'outOrder' in handed, false, 'a handover moves ranks, not memberships');
  const left = (await call('/v1/guilds/leave', { character: aldric.character }, aldric.secret)).body;
  assert.deepEqual(await claimsOf(left.order, 'guild'), { o: 'guild', s: aldric.id, gi: undefined, gt: undefined, gm: undefined }, 'the leaver wears none');
  // a disbanding: none for the guildmaster, and the guild gone for the hub
  const gone = (await call('/v1/guilds/disband', { character: bran.character }, bran.secret)).body;
  assert.deepEqual(await claimsOf(gone.order, 'guild'), { o: 'guild', s: bran.id, gi: undefined, gt: undefined, gm: undefined });
  assert.deepEqual(await claimsOf(gone.outOrder, 'guildout'), { o: 'guildout', s: bran.id, gi, gt: undefined, gm: undefined }, 'every member, not one');
});

// ─── THE RELAY ───────────────────────────────────────────────────────────────────────────────────────────────────────

test('GUILD1c the relay: the hello\'s token guild stamps the TAG on the welcome\'s rows and the join, and never the id or the member row; a guild order is taken ONLY from a socket whose account it names and only when NEWER than what it wears - a changed tag fanned to a place room, the carrier included; the same order again, or one older than the token, answered to its carrier alone; a forged one, and one at the wrong door, nothing (mutants: an order carried for somebody else; an older order taken; the tag fanned when it did not move; the id on a row)', () => withClock(async (tick) => {
  const r = fakeRoom('town:m11');
  const mara = r.connect(); await r.hello(mara, 'mara-0001', null, { gi: G1, gt: 'HND', gm: 'm1', lv: 7 });
  const bob = r.connect(); await r.hello(bob, 'bobb-0002');
  const row = ofType(bob, 'welcome')[0].peers.find((p) => p.id === 'mara-0001');
  assert.equal(row.gt, 'HND', 'the welcome\'s row wears the tag');
  assert.equal(row.lv, 7, 'beside the level');
  assert.equal('gi' in row || 'gm' in row, false, 'the guild and the member row are the relay\'s alone');
  assert.equal(ofType(mara, 'join').find((j) => j.id === 'bobb-0002').gt, undefined, 'a token with no guild stamps none');
  assert.deepEqual([mara.att.gi, mara.att.gt, mara.att.gm], [G1, 'HND', 'm1']);
  const kp = await r.signer();
  const nowS = Math.floor(Date.now() / 1000);
  const carry = (ws, t, order) => r.room.webSocketMessage(ws, JSON.stringify({ t, order }));
  // Bob carries an order naming Mara: nothing
  await carry(bob, 'guild', await mintGuildOrder({ s: 'acct-mara-0001' }, kp.privateKey, { subtle, nowS }));
  assert.equal(ofType(mara, 'guild').length + ofType(bob, 'guild').length, 0, 'nobody carries another player\'s guild');
  // Bob joins: the room hears his tag
  tick(1100);
  const bobJoins = await mintGuildOrder({ s: 'acct-bobb-0002', gi: G1, gt: 'HND', gm: 'm2' }, kp.privateKey, { subtle, nowS });
  await carry(bob, 'guild', bobJoins);
  assert.deepEqual(ofType(mara, 'guild'), [{ t: 'guild', id: 'bobb-0002', gt: 'HND' }]);
  assert.deepEqual(ofType(bob, 'guild'), [{ t: 'guild', id: 'bobb-0002', gt: 'HND' }], 'the carrier too');
  assert.deepEqual([bob.att.gi, bob.att.gt, bob.att.gm], [G1, 'HND', 'm2']);
  // the same order again: not news - the carrier hears what the room holds, nobody else hears a thing
  tick(1100); await carry(bob, 'guild', bobJoins);
  assert.equal(ofType(mara, 'guild').length, 1);
  assert.deepEqual(ofType(bob, 'guild').at(-1), { t: 'guild', id: 'bobb-0002', gt: 'HND' });
  // a NEWER order that moves no tag (the guild tab's look, carried again): the carrier hears it, the room does not
  tick(1100);
  await carry(bob, 'guild', await mintGuildOrder({ s: 'acct-bobb-0002', gi: G1, gt: 'HND', gm: 'm2' }, kp.privateKey, { subtle, nowS: nowS + 1 }));
  assert.equal(ofType(mara, 'guild').length, 1, 'a tag that did not move is not fanned');
  assert.equal(ofType(bob, 'guild').length, 3);
  // Mara's leave, then an OLDER join replayed inside its minute: the leave stands
  tick(1100);
  await carry(mara, 'guild', await mintGuildOrder({ s: 'acct-mara-0001' }, kp.privateKey, { subtle, nowS: nowS + 1 }));
  assert.deepEqual(ofType(bob, 'guild').at(-1), { t: 'guild', id: 'mara-0001' }, 'a tag taken off is said with none');
  assert.equal(mara.att.gi, undefined);
  tick(1100);
  await carry(mara, 'guild', await mintGuildOrder({ s: 'acct-mara-0001', gi: G1, gt: 'HND', gm: 'm1' }, kp.privateKey, { subtle, nowS }));
  assert.equal(mara.att.gi, undefined, 'a replayed join older than the leave changes nothing');
  assert.deepEqual(ofType(mara, 'guild').at(-1), { t: 'guild', id: 'mara-0001' }, 'and its carrier hears the room holds none');
  // an order older than the token that let the socket in changes nothing
  const cass = r.connect(); await r.hello(cass, 'cass-0003', null, { gi: G2, gt: 'OTH', gm: 'm7' });
  await carry(cass, 'guild', await mintGuildOrder({ s: 'acct-cass-0003' }, kp.privateKey, { subtle, nowS: nowS - 100 }));
  assert.equal(cass.att.gi, G2, 'the token is newer');
  // forged, and the wrong kind at the door
  tick(1100);
  const stranger = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  await carry(cass, 'guild', await mintGuildOrder({ s: 'acct-cass-0003' }, stranger.privateKey, { subtle, nowS: nowS + 2 }));
  tick(1100);
  await carry(cass, 'guild', await mintRenownOrder({ s: 'acct-cass-0003', lv: 9 }, kp.privateKey, { subtle, nowS: nowS + 2 }));
  tick(1100);
  await carry(cass, 'renown', await mintGuildOrder({ s: 'acct-cass-0003' }, kp.privateKey, { subtle, nowS: nowS + 2 }));
  assert.equal(cass.att.gi, G2, 'a forged order, a renown order at the guild\'s door and a guild order at the renown\'s change nothing');
  assert.equal(cass.att.lv, undefined);
}));

test('GUILD1c the hub: a guild\'s line reaches every socket wearing the sender\'s guild and nobody else, its own tabs included; a sender in no guild says it to nobody; a guild line anywhere but the hub is junk; a REMOVAL takes the member off every socket of theirs - their line reaches nobody and the guild\'s no longer reaches them, and they alone hear it - and is HELD, so a token or a join order said before it cannot carry them back, while one said after it can; a DISBANDING takes everyone (mutants: the fan to everyone; the sender\'s guild off the frame; the removal not held against an older token; a disbanding taking one member; a guild line fanned in a place)', () => withClock(async (tick) => {
  const h = fakeRoom(SOCIAL_ROOM);
  const kp = await h.signer();
  const nowS = Math.floor(Date.now() / 1000);
  const aldric = h.connect(); await h.hello(aldric, 'aldr-0001', null, { gi: G1, gt: 'HND', gm: 'm1' });
  // ONE-SEAT (2026-09-27): a player holds the hub from ONE tab - Aldric's second tab stood here, and a second tab of his
  // is now refused (or, claiming, closes this one), so "its own tabs" is its own socket: the echo
  const mara = h.connect(); await h.hello(mara, 'mara-0002', null, { gi: G1, gt: 'HND', gm: 'm2' });
  const cass = h.connect(); await h.hello(cass, 'cass-0003', null, { gi: G2, gt: 'OTH', gm: 'm3' });
  const dave = h.connect(); await h.hello(dave, 'dave-0004');
  const say = (ws, text) => h.room.webSocketMessage(ws, JSON.stringify({ t: 'chat', text, ch: 'guild' }));
  const heard = (ws) => ofType(ws, 'chat').filter((c) => c.ch === 'guild').map((c) => `${c.id}:${c.text}`);
  await say(aldric, 'hail');
  assert.deepEqual([heard(aldric), heard(mara), heard(cass), heard(dave)], [['aldr-0001:hail'], ['aldr-0001:hail'], [], []]);
  await say(dave, 'anyone?');
  assert.equal([aldric, mara, cass, dave].every((ws) => !heard(ws).includes('dave-0004:anyone?')), true, 'a sender in no guild says it to nobody');
  // Aldric removes Mara: the order is carried to the hub by Aldric; Mara alone hears it
  await h.room.webSocketMessage(aldric, JSON.stringify({ t: 'guildout', order: await mintGuildOutOrder({ s: 'acct-mara-0002', gi: G1, gm: 'm2' }, kp.privateKey, { subtle, nowS }) }));
  assert.equal(mara.att.gi, undefined, 'taken off');
  assert.deepEqual(ofType(mara, 'guild'), [{ t: 'guild', id: 'mara-0002' }], 'and she hears it');
  assert.equal(ofType(aldric, 'guild').length + ofType(cass, 'guild').length + ofType(dave, 'guild').length, 0, 'the hub fans no tag to two thousand sockets');
  assert.equal(aldric.att.gi, G1, 'the rest of the guild stays');
  await h.chat(mara, 'still here?');   // a World line still goes
  await say(mara, 'let me back');
  assert.equal(heard(aldric).includes('mara-0002:let me back'), false, 'her guild line reaches nobody now');
  tick(1100);
  await say(aldric, 'she is gone');
  assert.deepEqual(heard(mara), ['aldr-0001:hail'], 'and the guild\'s no longer reaches her');
  // HELD: a hello with a token said BEFORE the removal does not put her back; nor does a join order said before it
  const maraAgain = h.connect(); await h.hello(maraAgain, 'mara-0002', null, { gi: G1, gt: 'HND', gm: 'm2' });
  assert.equal(maraAgain.att.gi, undefined, 'a token minted a moment before the removal cannot carry her back');
  await h.room.webSocketMessage(maraAgain, JSON.stringify({ t: 'guild', order: await mintGuildOrder({ s: 'acct-mara-0002', gi: G1, gt: 'HND', gm: 'm2' }, kp.privateKey, { subtle, nowS: nowS - 5 }) }));
  assert.equal(maraAgain.att.gi, undefined, 'nor a replayed join');
  tick(1100);
  await h.room.webSocketMessage(maraAgain, JSON.stringify({ t: 'guild', order: await mintGuildOrder({ s: 'acct-mara-0002', gi: G1, gt: 'HND', gm: 'm5' }, kp.privateKey, { subtle, nowS: nowS + 1 }) }));
  assert.equal(maraAgain.att.gi, G1, 'invited back and joined after it: she wears it again');
  // a row the store gave again and removed again: the newer removal is the one held (a token said between the two
  // removals cannot carry its holder back)
  tick(1100);
  const now2 = Math.floor(Date.now() / 1000);   // the waits have moved the clock on: the harness mints its tokens on it
  await h.room.webSocketMessage(aldric, JSON.stringify({ t: 'guildout', order: await mintGuildOutOrder({ s: 'acct-mara-0002', gi: G1, gm: 'm5' }, kp.privateKey, { subtle, nowS: now2 - 10 }) }));
  tick(1100);
  await h.room.webSocketMessage(aldric, JSON.stringify({ t: 'guildout', order: await mintGuildOutOrder({ s: 'acct-mara-0002', gi: G1, gm: 'm5' }, kp.privateKey, { subtle, nowS: now2 + 1 }) }));
  const maraThird = h.connect(); await h.hello(maraThird, 'mara-0002', null, { gi: G1, gt: 'HND', gm: 'm5' });
  assert.equal(maraThird.att.gi, undefined, 'the newer removal holds');
  // A DISBANDING takes everyone in it, and nobody outside it
  tick(1100);
  await h.room.webSocketMessage(aldric, JSON.stringify({ t: 'guildout', order: await mintGuildOutOrder({ s: 'acct-aldr-0001', gi: G1 }, kp.privateKey, { subtle, nowS: now2 + 2 }) }));
  assert.deepEqual([aldric.att.gi, maraThird.att.gi, cass.att.gi], [undefined, undefined, G2]);
  // a guild line in a place is junk: nothing fanned, a strike counted
  const t = fakeRoom('town:m11');
  const p1 = t.connect(); await t.hello(p1, 'pone-0001', null, { gi: G1, gt: 'HND', gm: 'm1' });
  const p2 = t.connect(); await t.hello(p2, 'ptwo-0002', null, { gi: G1, gt: 'HND', gm: 'm2' });
  await t.room.webSocketMessage(p1, JSON.stringify({ t: 'chat', text: 'here?', ch: 'guild' }));
  assert.equal(ofType(p2, 'chat').length + ofType(p1, 'chat').length, 0, 'a guild has no line in a place');
  assert.equal(p1.meters.junk, 1);
  assert.equal(GUILD_CHAT_ROOM_HZ_MAX, 40);
  assert.ok(MAX_TTL_S > ORDER_TTL_S);
}));

// ─── THE CLIENT ──────────────────────────────────────────────────────────────────────────────────────────────────────

test('GUILD1c the session: a peer\'s tag off the welcome and a guild frame, which may take it off; mine off the service\'s answer and a room\'s echo, and a room taking MINE off tells the host to look again; `guildTagOf` and the chat\'s badge by id; a guild order is KEPT and goes down each socket ONCE its own welcome names world113, one guild frame a second a socket - a removal first - and a newer order replaces the held one (mutants: an order sent to world112; the gate unread, so the relay drops the second; the held order never replaced; my own tag taken off in silence)', () => {
  const { FakeWS, sockets } = fakeSocketClass();
  let clock = 1_000_000;
  const s = new OnlineSession({ url: 'wss://relay.test', name: 'Mac', id: 'mac-0001', secret: 'secret-of-mac-0001', WebSocketImpl: FakeWS, now: () => clock });
  s.join('world:2,12', { x: 1, y: 2, z: 3, yaw: 0, pitch: 0, mv: 0 });
  const ws = sockets[0];
  ws.open();
  ws.receive({ t: 'welcome', id: 'mac-0001', peers: [{ id: 'bob-0002', name: 'Bob', gt: 'HND' }, { id: 'eve-0003', name: 'Eve', gt: '<b>' }], n: 3, v: 'world112' });
  assert.equal(s.guildTagOf('bob-0002'), 'HND');
  assert.equal(s.guildTagOf('eve-0003'), null, 'a tag the law does not admit is none');
  assert.deepEqual(s.badgeOf('bob-0002'), { title: null, glyphs: [], gt: 'HND' }, 'the chat line wears it too');
  ws.receive({ t: 'guild', id: 'eve-0003', gt: 'OTH' });
  assert.equal(s.guildTagOf('eve-0003'), 'OTH');
  ws.receive({ t: 'guild', id: 'bob-0002' });
  assert.equal(s.guildTagOf('bob-0002'), null, 'a frame with no tag takes it off');
  ws.receive({ t: 'guild', id: 'ghost-0009', gt: 'HND' });
  assert.equal(s.peers.has('ghost-0009'), false, 'a tag for a peer I do not hold stands nobody');
  // mine
  let gone = 0;
  s.onGuildGone = () => { gone++; };
  assert.equal(s.adoptIdentity({ name: 'Mac', guild: 'HND' }), true);
  assert.equal(s.guildTagOf('mac-0001'), 'HND');
  s.adoptIdentity({ name: 'Mac' });
  assert.equal(s.gt, 'HND', 'an answer from a service before acct13 says nothing about it');
  assert.equal(s.adoptIdentity({ name: 'Mac', guild: null }), true);
  assert.equal(s.gt, null, 'an answer naming none takes it off');
  s.adoptIdentity({ name: 'Mac', guild: 'HND' });
  ws.receive({ t: 'guild', id: 'mac-0001', gt: 'HND' });
  assert.equal(gone, 0, 'an echo that keeps my tag is no news');
  ws.receive({ t: 'guild', id: 'mac-0001' });
  assert.equal(s.gt, null);
  assert.equal(gone, 1, 'a room took my guild off: the host looks again');
  // the carrier
  const guildSent = (w) => w.sent.map((x) => JSON.parse(x)).filter((m) => m.t === 'guild' || m.t === 'guildout');
  assert.equal(s.sendGuildOrder('v1.join.a'), false, 'a world112 relay closes the socket on the frame');
  assert.deepEqual(guildSent(ws), []);
  ws.receive({ t: 'welcome', id: 'mac-0001', peers: [], n: 1, v: 'world115' });
  assert.deepEqual(guildSent(ws), [{ t: 'guild', order: 'v1.join.a' }], 'kept, and gone on this socket\'s own welcome');
  assert.equal(s.guildOk, true);
  // a removal and a newer order at once: one frame a socket every GUILD_SEND_MS (wider than the relay's second), the
  // removal first
  assert.equal(GUILD_SEND_MS, 1500);
  assert.equal(GUILD_RESEND_MS, 5000);
  assert.equal(s.sendGuildOut('v1.out.b'), false, 'the spacing: the relay would drop a second frame inside its second');
  assert.equal(s.sendGuildOrder('v1.leave.c'), false);
  clock += 1000; s.tick();
  assert.equal(guildSent(ws).length, 1, 'not yet: a second is the relay\'s gate, and the wire bunches frames');
  clock += 500; s.tick();
  assert.deepEqual(guildSent(ws).at(-1), { t: 'guildout', order: 'v1.out.b' }, 'the removal first');
  clock += 1500; s.tick();
  assert.deepEqual(guildSent(ws).at(-1), { t: 'guild', order: 'v1.leave.c' }, 'then my own guild - the newer order in the old one\'s place');
  clock += 1500; s.tick();
  assert.equal(guildSent(ws).length, 3, 'nothing again before GUILD_RESEND_MS');
  // ONCE MORE, each, GUILD_RESEND_MS after its first - for the one the relay dropped anyway - and never a third time
  clock += 2000; s.tick();
  assert.deepEqual(guildSent(ws).at(-1), { t: 'guildout', order: 'v1.out.b' });
  clock += 1500; s.tick();
  assert.deepEqual(guildSent(ws).at(-1), { t: 'guild', order: 'v1.leave.c' });
  for (let i = 0; i < 8; i++) { clock += 1500; s.tick(); }
  assert.equal(guildSent(ws).length, 5, 'twice each, and no more');
  // a halo welcomed later gets what is still held - a removal and my guild - and nothing past the keeping
  s.setHalo(['world:3,12']);
  const halo = sockets[1];
  halo.open();
  halo.receive({ t: 'welcome', id: 'mac-0001', peers: [], n: 1, v: 'world115' });
  clock += 1500; s.tick();
  assert.deepEqual(guildSent(halo).map((m) => m.order), ['v1.out.b', 'v1.leave.c']);
  clock += 60_000; s.tick();
  assert.equal(s._gdHeld.length, 0, 'past its keeping the order is dropped - the next hello carries the guild');
  assert.equal(s.sendGuildOrder(''), false);
  assert.equal(s.sendGuildOrder('x'.repeat(1025)), false);
});

test('GUILD1c the guild line: said on the guild channel only to a relay that routes it (world115 - the World link\'s own word, never the party\'s world102), and a guild line coming in is gated on the guilds\' own budget, apart from the room\'s and the parties\' (mutants: the party\'s flag read for the guild; the guild line on the room\'s bucket)', () => {
  const { FakeWS, sockets } = fakeSocketClass();
  let clock = 5_000_000;
  const link = new OnlineSession({ url: 'wss://relay.test', name: 'Mac', id: 'mac-0001', secret: 's', WebSocketImpl: FakeWS, now: () => clock, presence: false });
  link.join(SOCIAL_ROOM);
  const ws = sockets[0];
  ws.open();
  ws.receive({ t: 'welcome', id: 'mac-0001', peers: [], n: 1, v: 'world112' });
  assert.equal(link.chanOk, true);
  assert.equal(link.sendChat('hail', { ch: 'guild' }), false, 'a world112 hub routes parties, not guilds');
  assert.equal(link.sendChat('hail', { ch: 'party' }), true);
  ws.receive({ t: 'welcome', id: 'mac-0001', peers: [], n: 1, v: 'world115' });
  clock += 2000;
  assert.equal(link.sendChat('hail', { ch: 'guild' }), true);
  assert.deepEqual(JSON.parse(ws.sent.at(-1)), { t: 'chat', text: 'hail', ch: 'guild' });
  clock += 2000;
  assert.equal(link.sendRoll({ n: 1, m: 6, k: 0 }, { ch: 'guild' }), true);
  const got = [];
  link.onChat = (l) => got.push(l);
  for (let i = 0; i < GUILD_CHAT_ROOM_HZ_MAX + 5; i++) ws.receive({ t: 'chat', id: 'bob-0002', name: 'Bob', text: `g${i}`, at: clock, ch: 'guild' });
  assert.equal(got.length, GUILD_CHAT_ROOM_HZ_MAX, 'an honest hub never delivers more than its guild budget');
  assert.equal(got[0].ch, 'guild');
  ws.receive({ t: 'chat', id: 'bob-0002', name: 'Bob', text: 'world', at: clock });
  assert.equal(got.at(-1).text, 'world', 'the World\'s own lines are on the room\'s bucket, not the guilds\'');
});

test('GUILD1c the book: the look hands the membership it reads to the host when it differs from the last one handed on - the first look always - and a removal\'s or a disbanding\'s out order on the act that did it, a founding the purse could not pay included (mutants: every look handing an order; the first look handing none; the out order dropped; the founding-then-disband\'s out order dropped)', async () => {
  let mine = { ok: true, data: { guild: { id: G1, tag: 'HND', members: [{ member: 'm1', you: true }] }, order: 'v1.look.1' } };
  const acted = [];
  const door = {
    mine: async () => mine,
    invites: async () => ({ ok: true, data: { invites: [] } }),
    remove: async (c, m) => { acted.push(['remove', m]); return { ok: true, data: { ok: true, outOrder: 'v1.out.m2' } }; },
    disband: async () => { acted.push(['disband']); return { ok: true, data: { ok: true, order: 'v1.none', outOrder: 'v1.out.all' } }; },
    found: async () => ({ ok: true, data: { ok: true, order: 'v1.found' } }),
  };
  let gold = 20_000;
  const handed = [];
  const book = new GuildBook({ door, character: () => 'char-mac', wallet: () => ({ gold: () => gold, pay: (n) => { gold -= n; }, credit: (n) => { gold += n; } }), onOrders: (o) => handed.push(o) });
  await book.refresh();
  assert.deepEqual(handed, [{ order: 'v1.look.1' }], 'the first look: this page cannot know what its rooms were told');
  mine = { ok: true, data: { ...mine.data, order: 'v1.look.2' } };
  await book.refresh();
  assert.equal(handed.length, 1, 'the same membership again: no frame down every socket');
  assert.equal(guildBadgeKey(mine.data.guild), `${G1}|HND|m1`);
  await book.remove('m2');
  assert.deepEqual(handed.at(-1), { outOrder: 'v1.out.m2' }, 'the member removed, to the hub');
  mine = { ok: true, data: { guild: null, order: 'v1.none.3' } };
  await book.refresh();
  assert.deepEqual(handed.at(-1), { order: 'v1.none.3' }, 'a membership that moved - removed, disbanded - goes to the rooms');
  // a founding the purse can no longer pay: the guild goes again, and the hub hears it went
  const count = handed.length;
  door.found = async () => { gold = 0; return { ok: true, data: { ok: true, order: 'v1.found' } }; };
  assert.deepEqual(await book.found('The Hound', 'HND'), { ok: false, error: 'gold' });
  assert.deepEqual(handed.slice(count), [{ outOrder: 'v1.out.all' }], 'the out order of the disbanding, and never the founding\'s own');
  assert.equal(guildBadgeKey(null), '');
  // a page whose first look reads NO guild still hands it on - it cannot know what its rooms were told
  const first = [];
  const fresh = new GuildBook({ door: { ...door, mine: async () => ({ ok: true, data: { guild: null, order: 'v1.none.0' } }) }, character: () => 'char-mac', wallet: () => ({ gold: () => 0, pay() {}, credit() {} }), onOrders: (o) => first.push(o) });
  await fresh.refresh();
  assert.deepEqual(first, [{ order: 'v1.none.0' }]);
  // a host that throws costs the rooms their news, never the tab its look
  const loud = new GuildBook({ door, character: () => 'char-mac', wallet: () => ({ gold: () => 0, pay() {}, credit() {} }), onOrders: () => { throw new Error('boom'); } });
  const warn = console.warn; console.warn = () => {};
  try { assert.deepEqual(await loud.refresh(), { ok: true }); } finally { console.warn = warn; }
});

test('GUILD1c the chat: a Guild tab beside the Party tab - off the bar until the character is in a guild, its lines peeking over the world - `/guild` and `/gu` say a line on it (`/g` stays the World\'s), and its list is the hub\'s peers wearing my tag, with my own row (mutants: the tab shown to everyone; /g taken from the World; a member of another guild listed)', () => {
  const tab = CHAT_TABS.find((t) => t.id === 'guild');
  assert.deepEqual({ ...tab }, { id: 'guild', label: 'Guild', room: null, link: false, hint: 'Your guild alone', hidden: true, peekAll: true });
  assert.deepEqual(CHAT_TABS.map((t) => t.id), ['world', 'region', 'party', 'guild', 'local']);
  const cmd = CHANNEL_COMMANDS.find((c) => c.tab === 'guild');
  assert.deepEqual([...cmd.names], ['guild', 'gu']);
  assert.equal(CHANNEL_COMMANDS.find((c) => c.names.includes('g')).tab, 'world');
  assert.deepEqual(parseChatLine('/gu hail'), parseChatLine('/guild hail'));
  assert.equal(parseChatLine('/guild hail').tab, 'guild');
  const hub = { id: 'mac-0001', name: 'Mac', title: null, glyphs: [], gt: 'HND', peers: new Map([['bob-0002', { id: 'bob-0002', name: 'Bob', gt: 'HND' }], ['eve-0003', { id: 'eve-0003', name: 'Eve', gt: 'OTH' }], ['dan-0004', { id: 'dan-0004', name: 'Dan' }]]) };
  const src2 = guildRosterSource(hub, 'HND');
  assert.deepEqual([...src2.peers.keys()], ['bob-0002']);
  assert.equal(src2.label, 'Guild');
  assert.deepEqual(rosterRows(src2).rows.map((r) => [r.name, r.gt, r.me]), [['Bob', 'HND', false], ['Mac', 'HND', true]], 'my own row wears my tag too');
  assert.equal(guildRosterSource(hub, null).peers.size, 0, 'no guild: a list of one');
  assert.equal(NO_GUILD_TEXT, 'You are not in a guild.');
  assert.equal(GUILD_OLD_RELAY_TEXT, 'The guild channel needs the server\'s next update.');
});

test('GUILD1c the minter and the point: the mint\'s answer hands my guild\'s tag to the page (null for none, nothing from a service before acct13), and a peer\'s tag rides the name point both faces read (mutants: the minter dropping the tag; the point without it)', async () => {
  let answer = { token: 'v1.t.s', name: 'Mac', kind: 'linked', title: null, glyphs: [], level: 10, xp: 6000, guild: 'HND' };
  const fetch = async () => ({ ok: true, status: 200, json: async () => answer });
  const m = new Map([[SESSION_KEY, JSON.stringify({ id: 'p_me', name: 'Mac', kind: 'linked', sessionId: 's1', secret: 'SECRETSECRETSECRETSECRET' })]]);
  const storage = { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v), removeItem: (k) => m.delete(k) };
  const issued = [];
  const mint = accountTokenMinter({ fetch, storage, onIssued: (w) => issued.push(w), character: () => 'char-aaaa' });
  assert.equal(await mint(), 'v1.t.s');
  assert.equal(issued.at(-1).guild, 'HND');
  answer = { ...answer, guild: null };
  await mint();
  assert.equal(issued.at(-1).guild, null, 'none, said');
  const { guild: _drop, ...older } = answer;
  answer = older;
  await mint();
  assert.equal('guild' in issued.at(-1), false, 'a service before acct13 says nothing, and the page keeps what it knew');
  // the point
  const PROJ = mirrorProjectionX(perspective(Math.PI / 3, 16 / 9, 0.2, 6000));
  const VIEW = lookAt([0, 1.7, 0], [0, 1.7, -10], [0, 1, 0]);
  const rp = new RemotePlayers({ renderer: { drawScreenQuad() {} }, deps: null, compose: async () => null });
  rp.sync([{ id: 'peer-0001', name: 'MACK', title: null, glyphs: [], gt: 'HND', shown: { x: 0, y: 0, z: -10, yaw: 0 }, look: null }], (p) => [p.x, p.y, p.z], { bodyHeight: () => PEER_HEIGHT });
  const [pt] = rp.namePoints(PROJ, VIEW, 1600, 900, [0, 1.7, 0], (q) => [q.x, q.y, q.z]);
  assert.equal(pt.gt, 'HND', 'the tag rides the point, so both faces read one answer');
});

test('GUILD1c the faces: "<HND>" right of the name, before the glyphs - over a head in both faces (the bitmap face centred on the whole run), on a chat line, in the roster and on the profile card; a peer in no guild wears exactly the label it wore before (mutants: the tag left of the name; the run measured without it; the chat line\'s badge key blind to it)', () => {
  assert.equal(guildTagText('HND'), '<HND>');
  assert.equal(guildTagText('hnd'), null, 'drawn as signed, never mended');
  assert.equal(guildTagText(null), null);
  // the bitmap face
  const FNT = { glyphs: new Map(), ascent: 6, lineHeight: 8, fixedHeight: 8, fixedWidth: 6, glyphWidth: () => 5, glyphSpacing: 1 };
  const runs = [];
  const rec = { drawScreenQuad: () => {}, drawScreenQuadRun: (tex, qs) => runs.push(qs) };
  const rp = new RemotePlayers({ renderer: rec, deps: null, compose: async () => null });
  rp.drawNamePoints(rec, { fnt: FNT, tex: 'T' }, [{ id: 'p', name: 'Mack', x: 800, y: 400, scale: 1, title: null, glyphs: [], lv: 12, gt: 'HND' }], 1);
  const left = Math.min(...runs.flat().map((q) => q.dst.x));
  assert.equal(left, Math.round(800 - measureText(FNT, '[12] Mack <HND>') / 2), 'centred on the whole run');
  // the DOM face
  const node = (tag) => {
    const n = { tagName: tag.toUpperCase(), children: [], parent: null, attrs: {}, style: {}, dataset: {},
      append(...cs) { for (const c of cs) { c.parent = n; n.children.push(c); } },
      setAttribute(k, v) { n.attrs[k] = v; }, replaceChildren(...cs) { n.children.length = 0; n.append(...cs); },
      remove() { if (n.parent) n.parent.children.splice(n.parent.children.indexOf(n), 1); n.parent = null; }, addEventListener() {}, focus() {} };
    let text = '', cls = '';
    Object.defineProperty(n, 'textContent', { get: () => text, set: (v) => { text = String(v); n.children.length = 0; } });
    Object.defineProperty(n, 'className', { get: () => cls, set: (v) => { cls = String(v); } });
    return n;
  };
  const doc = { createElement: (t) => node(t), createElementNS: (ns, t) => node(t), head: node('head'), body: node('body'), getElementById: () => null };
  const layer = createNameLayer({ doc, now: () => 1000 });
  const at = (gt) => { layer.render({ points: [{ id: 'peer-0001', name: 'Mack', x: 400, y: 300, scale: 1, title: null, glyphs: [], lv: 3, gt }] }); return layer.tagFor('peer-0001'); };
  const t = at('HND');
  assert.deepEqual(t.tag.children.map((c) => c.className), ['dfname-renown', 'dfname-who', 'dfname-guild', 'dfname-glyphs'], 'right of the name, before the glyphs');
  assert.equal(t.guild.textContent, '<HND>');
  assert.equal(at(null).guild.textContent, '', 'none: the label it wore before (the :empty rule takes its room)');
  // the chat panel's badge key and the profile card
  const panel = src('src/ui/chatPanel.js');
  assert.match(panel, /const badgeKeyOf = \(b\) => \(b \? `\$\{b\.title \?\? ''\}\|\$\{\(Array\.isArray\(b\.glyphs\) \? b\.glyphs : \[\]\)\.join\('\+'\)\}\|\$\{b\.gt \?\? ''\}` : ''\);/);
  assert.match(panel, /const gt = guildTagText\(peer\?\.gt\);[^\n]*\n    if \(gt\) after\.push\(el\('span', `\$\{prefix\}-guild`, gt\)\);\n    for \(const g of glyphBadges\(peer\)\)/, 'the tag first after the name, then the glyphs');
  assert.match(panel, /\+ ':' \+ \(r\.gt \?\? ''\)\)\.join\(','\);/, 'the roster repaints when a tag moves');
  assert.equal(profileView({ name: 'Bran', peer: { gt: 'HND' } }).guild, '<HND>');
  assert.equal(profileView({ name: 'Bran', peer: {} }).guild, null);
});

test('GUILD1c the host: the hub\'s guild lines land on the Guild tab by the relay\'s own routing word; the tab rides the hub, is on the bar while the hub knows my tag, and says why it cannot talk; the book\'s orders go down every socket I hold and a removal to the hub alone; a room taking my guild off makes the book look again (mutants: a guild line on the World tab; the out order sent to the world rooms; the Guild tab shown in no guild)', () => {
  const w = src('src/scenes/world.js');
  assert.match(w, /link\.onChat = \(line\) => chatLog\.push\(tab\.room === SOCIAL_ROOM && \(line\.ch === 'party' \|\| line\.ch === 'guild'\) \? line\.ch : tab\.id, line\);/);
  assert.match(w, /link\.onRoll = \(line\) => chatLog\.push\(tab\.room === SOCIAL_ROOM && \(line\.ch === 'party' \|\| line\.ch === 'guild'\) \? line\.ch : tab\.id, line\);/);
  assert.match(w, /chatLog\.setShown\('guild', !!myGuildTag\(\)\);/);
  assert.match(w, /const myGuildTag = \(\) => socialLink\(\)\?\.gt \?\? null;/);
  assert.match(w, /if \(outOrder\) socialLink\(\)\?\.sendGuildOut\(outOrder\);\n        if \(order\) \{ online\?\.sendGuildOrder\(order\); for \(const link of chatLinks\?\.values\?\.\(\) \?\? \[\]\) link\.sendGuildOrder\(order\); \}/);
  assert.match(w, /const guildGone = \(\) => \{ guildBook\?\.refresh\(\); \};/);
  assert.match(w, /link\.onGuildGone = guildGone;/);
  assert.match(w, /online\.onGuildGone = guildGone;/);
  assert.match(w, /if \(tabId === 'guild'\) \{\n[^\n]*\n      if \(!myGuildTag\(\)\) return why\(NO_GUILD_TEXT\);\n      return socialLink\(\)\?\.sendChat\(text, \{ ch: 'guild', me \}\) \?\? false;/);
  assert.match(w, /if \(tabId === 'guild'\) return guildRosterSource\(s, myGuildTag\(\)\);/);
  assert.match(w, /if \(tabId === 'guild' && guildOld\(\)\) return GUILD_OLD_RELAY_TEXT;/);
  assert.match(w, /return s\?\.sendRoll\(spec, tabId === 'party' \|\| tabId === 'guild' \? \{ ch: tabId \} : \{\}\) \?\? false;/);
});
