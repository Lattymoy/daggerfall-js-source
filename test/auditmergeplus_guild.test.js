// AUDIT MERGE-PLUS, LENS A (2026-09-26, the pre-merge audit of the guild merge - the guilds, Renown and the online
// homes): WHAT IT FOUND, PINNED. Each fix carries an `AUDIT MERGE-PLUS A<n>` comment beside it. A1: a second "Buy
// it" pressed while the first claim was out paid 42,000 twice for one house, and once it was bought the door's rows
// lit "Who may enter" in the buy row's slot, one click from opening the house to the party. A2: a member's leave
// answered only her own order, which only the page that acted carries, so her other tab stayed in the guild's chat
// and a token minted before the leave put a fresh socket straight back in. A lone guildmaster's leave (a disbanding)
// answered no out order either, so the hub never heard the guild gone. A3: the hub's held removals lived in
// instance memory and were forgotten whenever it slept. A4: the guild book read the Worker's own refusals (the
// account's rate above all) as "may have landed" and kept a deposit's gold. A5: an act pressed while a look was out
// ended on that older look.
// All of it is DRIVEN. The house runs against the real account Worker on node:sqlite. The host's buy is lifted out
// of worldModes.js and run over the real registry. The plaque goes through the real fold. The leave goes through
// the Worker, once with a race put between its read and its delete, and its out order is carried into the real
// Room. The sleep is fakeRoom's wake(). The book runs over the Worker's own rate and a fake door.
// A6 (the mint signs a guild only when asked) is pinned where it lives, in test/guild1c.test.js and
// test/renown1.test.js; its two records in `tools/mutants/auditmergeplus_guild.json` name those files.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import worker from '../server-account/src/index.js';
import { _resetKeyForTests } from '../server-account/src/signing.js';
import { ACCOUNT_MAX } from '../server-account/src/accounts.js';
import { GUILD_FOUND_RENOWN, GUILD_RANK_NAMES } from '../src/net/guildLaw.js';
import { renownXpFor } from '../src/net/renown.js';
import { mintToken, verifyOrder, mintGuildOrder, mintGuildOutOrder, MAX_TTL_S } from '../src/net/identityToken.js';
import { SOCIAL_ROOM } from '../src/net/wire.js';
import { accountGuilds, accountHomes, accountRefusalText, SESSION_KEY } from '../src/net/accountClient.js';
import { GuildBook, GUILD_FRESH_MS, guildRefused } from '../src/net/guildBook.js';
import {
  createOnlineHomes, buyOnlineHome, HOME_BUY_BUSY, HOME_BOUGHT_LINE, homeShortLine, homeSceneName, homeBuyRows, homeOwnerRows,
} from '../src/systems/onlineHomes.js';
import { createSceneCache, addPermanentScene, containsPermanentScene } from '../src/systems/sceneCache.js';
import { resolveHover, nextSelection } from '../src/systems/worldHover.js';
import { foldQuickLoot, quickLootWheel, plaqueActionFor, resetQuickLoot } from '../src/systems/quickLoot.js';
import { fakeRoom } from './fakeRoom.mjs';
import { withClock } from './placeWidest.mjs';   // the relay's gates on a clock the test turns - a second is a tick, not a wait

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const { subtle } = globalThis.crypto;
const nowS = () => Math.floor(Date.now() / 1000);
const ofType = (ws, t) => ws.sent.filter((m) => m.t === t);
const T = 206728581;   // a town's map id
const G1 = 'gaaaaaaaaaa';

// ─── THE RIGS ────────────────────────────────────────────────────────────────────────────────────────────────────────

const MIGRATIONS = readdirSync(new URL('../server-account/migrations', import.meta.url)).filter((f) => f.endsWith('.sql')).sort();
/** D1 over node:sqlite with every migration applied (test/guild1c.test.js's). */
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
/** The same database with a race put in it. `arm(fn)` runs `fn` (other players' acts, through the Worker) after
 *  the NEXT delete from the guild roster is prepared and before it runs. That is a leave's window between reading its
 *  own row and taking it. Whatever that delete says, it is the leave's: nothing else deletes from the roster while
 *  one is armed. */
function racing(db) {
  let armed = null;
  return {
    ...db,
    arm(fn) { armed = fn; },
    prepare(sql) {
      const st = db.prepare(sql);
      if (!armed || !/^DELETE FROM guild_members\b/.test(sql)) return st;
      const fn = armed;
      armed = null;
      const raced = {
        bind(...a) { st.bind(...a); return raced; },
        first: () => st.first(),
        all: () => st.all(),
        _result: () => st._result(),
        async run() { await fn(); return st.run(); },
      };
      return raced;
    },
  };
}
/** The account Worker over `db`, signing with `kp` (the hub's own key when a test carries its orders into a Room).
 *  `sent` is every path asked, in order. */
async function stand({ kp = null, db = d1() } = {}) {
  _resetKeyForTests();
  const keys = kp ?? await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const pkcs8 = Buffer.from(new Uint8Array(await subtle.exportKey('pkcs8', keys.privateKey))).toString('base64');
  const env = { DB: db, IDENTITY_PRIVATE_KEY: pkcs8, ACCOUNT_VERSION: 'test1', ALLOWED_ORIGIN: '*' };
  const sent = [];
  const fetch = (url, init) => { sent.push(new URL(url).pathname); return worker.fetch(new Request(url, init), env); };
  const call = async (path, body, bearer = null) => {
    const res = await fetch(`https://accounts.invalid${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(bearer ? { authorization: `Bearer ${bearer}` } : {}) },
      body: JSON.stringify(body),
    });
    return { status: res.status, body: await res.json().catch(() => null) };
  };
  /** A linked account at Renown `renown` on its character, and the page's session store the client's doors read. */
  const registered = async (handle, { character = `char-${handle.toLowerCase()}`, renown = GUILD_FOUND_RENOWN } = {}) => {
    const secret = (await call('/v1/auth/guest', {})).body.secret;
    assert.equal((await call('/v1/auth/register', { secret, handle, password: 'a good long one' })).status, 200);
    const id = env.DB._raw.prepare('SELECT id FROM players WHERE handle_lc = ?').get(handle.toLowerCase()).id;
    if (renown > 1) {
      env.DB._raw.prepare('INSERT OR REPLACE INTO renown_tracks (player, char_id, name, xp, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
        .run(id, character, handle, renownXpFor(renown), 1, 1);
    }
    const kept = new Map([[SESSION_KEY, JSON.stringify({ secret, id })]]);
    const storage = { getItem: (k) => kept.get(k) ?? null, setItem: (k, v) => kept.set(k, v), removeItem: (k) => kept.delete(k) };
    return { secret, id, character, handle, storage };
  };
  const claimsOf = async (order, kind) => {
    if (order == null) return null;
    const r = await verifyOrder(order, keys.publicKey, { subtle, nowS: nowS(), kind });
    assert.equal(r.ok, true, `a signed ${kind} order`);
    const { o, s, gi, gt, gm } = r.claims;
    return { o, s, gi, gt, gm };
  };
  return { env, fetch, call, registered, claimsOf, sent };
}

/** A guild as the service's viewOf answers it, read by Mara (test/guild1b.test.js's). */
const view = (over = {}) => ({
  id: 'g0123456789', name: 'The Hound', tag: 'HND', ranks: [...GUILD_RANK_NAMES], treasury: 0, foundedAt: 1, rank: 3,
  members: [{ member: 'm2', name: 'Mara', rank: 3, joinedAt: 1, you: true }], invites: [], ledger: [], ...over,
});
function fakeWallet(start) {
  const w = { gold: start, credited: [] };
  w.make = () => ({ gold: () => w.gold, pay: (n) => { w.gold -= n; }, credit: (n) => { w.gold += n; w.credited.push(n); } });
  return w;
}
/** A book over a door whose deposit answers what the test says (test/guild1b.test.js's bookOf, cut to the deposit). */
function bookOf(gold) {
  const w = fakeWallet(gold);
  const door = {
    said: null,
    mine: async () => ({ ok: true, data: { guild: view() } }),
    invites: async () => ({ ok: true, data: { invites: [] } }),
    deposit: async () => door.said,
  };
  return { door, w, book: new GuildBook({ door, character: () => 'char-mara', wallet: w.make }) };
}

// ─── A1: THE HOUSE ───────────────────────────────────────────────────────────────────────────────────────────────────

test('AUDIT MERGE-PLUS A1 the house: a second "Buy it" pressed while the first claim is out answers busy and asks nothing - one claim to the real Worker, 42,000 paid once where it was paid twice; the claim is held per HOUSE (two houses of one town at once both land) and let go when it answers - a purse emptied on the way gives the house back and the next press buys it - or throws (mutants: no hold; the hold per town; the hold never let go)', async () => {
  const { env, fetch, registered, sent } = await stand();
  const me = await registered('Aldric');
  let who = me.character;
  const homes = createOnlineHomes({ api: accountHomes({ fetch, storage: me.storage }), character: () => who });
  assert.equal(await homes.ensure(T), true, 'the town known, as the door asks it before it offers a house');
  let gold = 200_000;
  const paid = [];
  const buy = (buildingKey, over = {}) => buyOnlineHome(homes, {
    mapId: T, buildingKey, region: 17, price: 42_000, afford: (p) => p <= gold, pay: (p) => { paid.push(p); gold -= p; }, ...over,
  });
  const claims = () => sent.filter((p) => p === '/v1/homes/claim').length;
  const owner = (key) => env.DB._raw.prepare('SELECT char_id FROM homes WHERE map_id = ? AND building_key = ?').get(T, key)?.char_id ?? null;
  // the plaque's second "Buy it" lands while the first claim's answer is still out
  const [first, second] = await Promise.all([buy(9), buy(9)]);
  assert.equal(HOME_BUY_BUSY, 'busy');
  assert.deepEqual([first, second], [{ ok: true }, { ok: false, error: HOME_BUY_BUSY }], 'the first claim\'s answer speaks for both');
  assert.deepEqual(paid, [42_000], 'paid ONCE - the service answers a second claim of my own house `repeat`, and it was paid again');
  assert.equal(claims(), 1, 'the busy press asks the service nothing');
  assert.equal(owner(9), me.character);
  assert.equal(homes.homeAt(T, 9).own, true);
  // let go on the answer: the purse emptied while the claim was out, so the house was given back, and the next press buys it
  let asks = 0;
  assert.deepEqual(await buy(10, { afford: () => (++asks === 1) }), { ok: false, error: 'gold' });
  assert.equal(owner(10), null, 'given back unpaid');
  assert.deepEqual(await buy(10), { ok: true }, 'the hold went with the answer: this press is asked, and lands');
  assert.equal(owner(10), me.character);
  assert.equal(claims(), 3);
  // per house: two houses of one town at once (the account's other character - three homes a character)
  who = 'char-aldric-2';
  assert.deepEqual(await Promise.all([buy(11), buy(12)]), [{ ok: true }, { ok: true }], 'one claim a HOUSE at a time, not a town');
  assert.deepEqual([owner(11), owner(12)], ['char-aldric-2', 'char-aldric-2']);
  assert.deepEqual(paid, [42_000, 42_000, 42_000, 42_000]);
  // ...and let go on a throw (a door that is not `call`, which never throws): the next press is asked again
  let boom = true;
  const flaky = createOnlineHomes({
    api: {
      town: async (mapId) => ({ ok: true, data: { mapId, homes: [] } }),
      claim: async () => { if (boom) throw new Error('the line dropped'); return { ok: true, data: { ok: true, home: { entry: 'private' } } }; },
    },
    character: () => 'char-aldric',
  });
  const buyFlaky = () => buyOnlineHome(flaky, { mapId: T, buildingKey: 20, region: 17, price: 42_000, afford: () => true, pay: () => {} });
  await assert.rejects(buyFlaky(), /the line dropped/);
  boom = false;
  assert.deepEqual(await buyFlaky(), { ok: true }, 'a claim that threw holds the house no longer');
});

test('AUDIT MERGE-PLUS A1 the host: the door\'s buy (worldModes.js buyHomeAt, lifted out and run over the real registry) says NOTHING for a press answered busy - the first press\'s answer speaks for both: the home line once, the purse paid once, the home\'s scene kept; a refusal still speaks (mutants: the busy press said as "the account service had a problem")', async () => {
  const WM = src('src/scenes/worldModes.js');
  const at = WM.indexOf('  async function buyHomeAt(bd, price) {');
  assert.ok(at > 0, 'the host\'s buy');
  const body = WM.slice(at, WM.indexOf('\n  }\n', at) + 4);
  const lift = new Function('host', 'homeTownOf', 'bankPurse', 'homeAccount', 'buyOnlineHome', 'HOME_BUY_BUSY', 'townTalk', 'homeShortLine',
    'accountRefusalText', 'addPermanentScene', 'sceneCache', 'homeSceneName', 'HOME_BOUGHT_LINE', `${body}\nreturn buyHomeAt;`);
  // the registry over a door whose claims answer when the test says - every claim out, so a press that should never
  // have claimed is still answered and counted rather than left waiting
  const waiting = [];
  const answerAll = () => { for (const res of waiting.splice(0)) res(); };
  const claims = [];
  const api = {
    town: async (mapId) => ({ ok: true, data: { mapId, homes: [] } }),
    claim: async (b) => { claims.push(b); await new Promise((res) => { waiting.push(res); }); return { ok: true, data: { ok: true, home: { entry: 'private' } } }; },
    release: async () => ({ ok: true, data: { ok: true, price: 42_000 } }),
  };
  const homes = createOnlineHomes({ api, character: () => 'char-aldric' });
  let gold = 50_000;
  const account = { accountGold: 0 };
  const purse = { totalGold: () => gold, deductGold: (n) => { const take = Math.min(gold, n); gold -= take; return n - take; } };
  const said = [];
  const cache = createSceneCache();
  const buyHomeAt = lift({ onlineHomes: homes }, (b) => b.townMapId, () => purse, () => account, buyOnlineHome, HOME_BUY_BUSY,
    { say: (line) => said.push(line) }, homeShortLine, accountRefusalText, addPermanentScene, () => cache, homeSceneName, HOME_BOUGHT_LINE);
  const bd = { townMapId: T, buildingKey: 9, regionIndex: 17 };
  const presses = [buyHomeAt(bd, 42_000), buyHomeAt(bd, 42_000)];   // "Click again to buy", pressed again before the first claim answered
  await new Promise((res) => { setImmediate(res); });   // the busy press has had its answer by now
  assert.deepEqual(said, [], 'the busy press says nothing of its own - not "the account service had a problem"; its answer is the first press\'s to say');
  answerAll();
  await Promise.all(presses);
  assert.deepEqual(said, [HOME_BOUGHT_LINE], 'the home line, once');
  assert.equal(claims.length, 1);
  assert.equal(gold, 8_000, 'paid once');
  assert.equal(containsPermanentScene(cache, homeSceneName(T, 9)), true, 'the home\'s own scene kept');
  // a refusal still speaks: the purse short
  gold = 100;
  await buyHomeAt({ ...bd, buildingKey: 10 }, 42_000);
  assert.deepEqual(said, [HOME_BOUGHT_LINE, homeShortLine(42_000)]);
});

test('AUDIT MERGE-PLUS A1 the plaque: the buy lands and the door lists the owner\'s rows - the lit "Buy it" is gone from them, and what is lit is "Go in" at the top, never "Who may enter" clamped into its slot (a click there turned the house over to the party unasked); an unlit list goes back to unlit; a lit row still there keeps its row, and a row with NO id (a pile\'s) clamps as before (mutants: the gone row\'s neighbour lit; an unlit list lit at its top; the pile\'s row sent to the top)', () => {
  const hit = { key: 7, distance: 1, reach: 3 };
  const door = (actions) => resolveHover(hit, { name: () => ({ title: 'House', subs: [], actions }) });
  resetQuickLoot();
  try {
    const buying = door(homeBuyRows(42_000, true));
    foldQuickLoot(buying);
    assert.equal(quickLootWheel(120), true);
    foldQuickLoot(buying);
    assert.equal(plaqueActionFor(7), 'home-buy', '"Click again to buy" lit, and pressed');
    foldQuickLoot(door(homeOwnerRows('private')));
    assert.equal(plaqueActionFor(7), 'home-enter', '"Go in" - never "Who may enter", one click from opening the house to the party');
  } finally { resetQuickLoot(); }
  // the law itself
  const owned = door(homeOwnerRows('private'));
  assert.deepEqual(owned.rows.map((r) => r.id), ['home-enter', 'home-entry', 'home-sell']);
  const lit = { key: 7, row: 1, id: 'home-buy' };
  assert.deepEqual(nextSelection(lit, owned, 0), { key: 7, row: 0, id: 'home-enter' });
  assert.deepEqual(nextSelection(lit, owned, 1), { key: 7, row: 0, id: 'home-enter' }, 'a nudge in the same frame starts from the top too');
  // a player's verbs start unlit (AUDIT DISC7 A2): a lit verb gone leaves the list unlit
  const verbs = { key: 'peer:p', kind: 'actions', startUnlit: true, rows: [{ id: 'invite', name: 'Invite' }, { id: 'trade', name: 'Trade' }] };
  assert.deepEqual(nextSelection({ key: 'peer:p', row: 1, id: 'duel' }, verbs, 0), { key: 'peer:p', row: -1 }, 'nothing lit');
  assert.deepEqual(nextSelection({ key: 'peer:p', row: 1, id: 'trade' }, { ...verbs, rows: [{ id: 'trade', name: 'Trade' }] }, 0), { key: 'peer:p', row: 0, id: 'trade' }, 'a lit row still there keeps it (AUDIT DISC7 A3)');
  // a pile's rows have no id: a list that shrank under the highlight still pulls it back to the last row
  const pile = (n) => ({ key: 'pile:1', rows: Array.from({ length: n }, (_, i) => ({ name: `piece ${i}` })) });
  assert.deepEqual(nextSelection({ key: 'pile:1', row: 2 }, pile(2), 0), { key: 'pile:1', row: 1 }, 'the last row, as before');
});

// ─── A2: THE LEAVE ───────────────────────────────────────────────────────────────────────────────────────────────────

test('AUDIT MERGE-PLUS A2 the leave: a member\'s leave answers, beside her own none, the OUT ORDER of her member row; carried into the real hub it takes EVERY tab of hers off the guild\'s chat and is held against a token minted before the leave. A lone guildmaster\'s leave, a disbanding, answers the GUILD\'s out order, so every tab of his goes too (mutants: the leave telling the hub nothing; the lone master\'s telling it nothing; the lone master\'s naming one member)', () => withClock(async (tick) => {
  const h = fakeRoom(SOCIAL_ROOM);
  const kp = await h.signer();
  const { call, registered, claimsOf } = await stand({ kp });   // the Worker signs with the hub's own key
  const aldric = await registered('Aldric');
  const mara = await registered('Mara', { renown: 1 });
  const rowOf = (guild) => guild.members.find((m) => m.you).member;
  const found = (await call('/v1/guilds/found', { character: aldric.character, name: 'The Hound', tag: 'HND' }, aldric.secret)).body;
  const gi = found.guild.id;
  await call('/v1/guilds/invite', { character: aldric.character, handle: 'Mara' }, aldric.secret);
  const maraRow = rowOf((await call('/v1/guilds/answer', { character: mara.character, guild: gi, accept: true }, mara.secret)).body.guild);
  // the hub: each of them in their tab, wearing the guild its token was minted with. ONE-SEAT (2026-09-27): each in ONE -
  // this pin stood two tabs of each in the hub, and a player's second tab there is now refused (or, claiming, closes the
  // first), so "every tab of hers" is the one she holds the hub from
  const tabs = async (who, gm, ids) => {
    const out = [];
    for (const id of ids) { const ws = h.connect(); await h.hello(ws, id, null, { tokenSub: who.id, gi, gt: 'HND', gm }); out.push(ws); }
    return out;
  };
  const [al] = await tabs(aldric, rowOf(found.guild), ['aldr-0001']);
  const [ma] = await tabs(mara, maraRow, ['mara-0002']);
  const say = (ws, text) => h.room.webSocketMessage(ws, JSON.stringify({ t: 'chat', text, ch: 'guild' }));
  const heard = (ws) => ofType(ws, 'chat').filter((c) => c.ch === 'guild').map((c) => `${c.id}:${c.text}`);
  await say(al, 'hail');
  assert.deepEqual(heard(ma), ['aldr-0001:hail'], 'she hears the guild');
  tick(5000);
  // a token her client minted a moment before she left (a few minutes' life, spent at a hello)
  const preLeave = await mintToken({ s: mara.id, n: 'mara-0004', k: 'linked', gi, gt: 'HND', gm: maraRow }, kp.privateKey, { subtle, nowS: nowS() - 2 });
  const left = (await call('/v1/guilds/leave', { character: mara.character }, mara.secret)).body;
  assert.equal(left.ok, true);
  assert.deepEqual(await claimsOf(left.order, 'guild'), { o: 'guild', s: mara.id, gi: undefined, gt: undefined, gm: undefined }, 'she wears none');
  assert.deepEqual(await claimsOf(left.outOrder, 'guildout'), { o: 'guildout', s: mara.id, gi, gt: undefined, gm: maraRow }, 'and the hub hears her ROW taken off, as a removal says it');
  // her client carries the out order to the hub (world.js: the book's out order goes to the hub alone), down the tab that acted
  await h.room.webSocketMessage(ma, JSON.stringify({ t: 'guildout', order: left.outOrder }));
  assert.equal(ma.att.gi, undefined, 'her tab is taken off');
  assert.equal(al.att.gi, gi, 'the guild stays');
  tick(1100); await say(al, 'plans for the raid');
  tick(1100); await say(ma, 'still listening');
  assert.deepEqual(heard(ma), ['aldr-0001:hail'], 'she hears the guild no longer...');
  assert.equal(heard(al).includes('mara-0002:still listening'), false, '...and says nothing into it');
  // HELD: a fresh socket on the token minted before the leave does not come back in
  tick(1100);
  const back = h.connect(); await h.hello(back, 'mara-0004', null, { tok: preLeave, cl: 1 });   // ONE-SEAT: a fresh tab going online claims (her first tab holds the hub)
  assert.equal(back.att.id, 'mara-0004', 'let in...');
  assert.equal(back.att.gi, undefined, '...without the guild she left');
  // the lone guildmaster leaves: nobody else is in it and the treasury is empty, so the guild goes with him
  const alone = (await call('/v1/guilds/leave', { character: aldric.character }, aldric.secret)).body;
  assert.equal(alone.disbanded, true);
  assert.deepEqual(await claimsOf(alone.order, 'guild'), { o: 'guild', s: aldric.id, gi: undefined, gt: undefined, gm: undefined });
  assert.deepEqual(await claimsOf(alone.outOrder, 'guildout'), { o: 'guildout', s: aldric.id, gi, gt: undefined, gm: undefined }, 'the GUILD\'s out order - a disbanding\'s, never one member\'s');
  tick(1100);
  await h.room.webSocketMessage(al, JSON.stringify({ t: 'guildout', order: alone.outOrder }));
  assert.equal(al.att.gi, undefined, 'his tab - under ONE-SEAT the one he holds the hub from');
}));

test('AUDIT MERGE-PLUS A2 the leave\'s row: a leave takes the very row it read, by its rowid and its guild - a removal that lands between the read and the delete leaves it nothing to take, answered no-guild with no order signed, and a character removed and joined to ANOTHER guild in that window keeps the new guild (mutants: the leave deleting by the character, the new guild\'s row with it; a leave that took nothing answered as one)', async () => {
  const db = racing(d1());
  const { call, registered } = await stand({ db });
  const aldric = await registered('Aldric');
  const bran = await registered('Bran');
  const mara = await registered('Mara', { renown: 1 });
  const rowOf = (r) => r.body.guild.members.find((m) => m.you).member;
  const gi = (await call('/v1/guilds/found', { character: aldric.character, name: 'The Hound', tag: 'HND' }, aldric.secret)).body.guild.id;
  const wolves = (await call('/v1/guilds/found', { character: bran.character, name: 'The Wolves', tag: 'WLF' }, bran.secret)).body.guild.id;
  const join = async () => {
    await call('/v1/guilds/invite', { character: aldric.character, handle: 'Mara' }, aldric.secret);
    return rowOf(await call('/v1/guilds/answer', { character: mara.character, guild: gi, accept: true }, mara.secret));
  };
  const removed = (row) => call('/v1/guilds/remove', { character: aldric.character, member: row }, aldric.secret);
  const leave = () => call('/v1/guilds/leave', { character: mara.character }, mara.secret);
  const mine = async () => (await call('/v1/guilds/mine', { character: mara.character }, mara.secret)).body.guild;
  // removed between her read and her delete
  const row = await join();
  let mid = null;
  db.arm(async () => { mid = await removed(row); });
  const left = await leave();
  assert.equal(mid?.body?.ok, true, 'the removal landed between her read and her delete');
  assert.deepEqual([left.status, left.body], [404, { error: 'no-guild' }], 'her leave took nothing, so it is no leave - and signs nothing');
  // removed, and joined to the Wolves, in that window
  const row2 = await join();
  await call('/v1/guilds/invite', { character: bran.character, handle: 'Mara' }, bran.secret);
  let joinedWolves = null;
  db.arm(async () => {
    await removed(row2);
    joinedWolves = await call('/v1/guilds/answer', { character: mara.character, guild: wolves, accept: true }, mara.secret);
  });
  const left2 = await leave();
  assert.equal(joinedWolves?.body?.ok, true, 'she joined the Wolves between her read and her delete');
  assert.deepEqual([left2.status, left2.body], [404, { error: 'no-guild' }]);
  assert.equal((await mine())?.tag, 'WLF', 'the Wolves\' row stands: a leave of the Hound never takes it');
});

// ─── A3: THE SLEEP ───────────────────────────────────────────────────────────────────────────────────────────────────

test('AUDIT MERGE-PLUS A3 the sleep: the hub keeps its held removals in its storage, so a hub that slept (a new instance over the same storage) still turns away what was said before a removal - a token, the hello reading the holds first; a join order carried on a socket that came in wearing none, the order reading them first; and a removal heard after a sleep is written beside the ones before it, not over them (mutants: the holds never written; the hello reading none; the order reading none; the removal writing over the kept ones)', () => withClock(async (tick) => {
  const h = fakeRoom(SOCIAL_ROOM);
  const kp = await h.signer();
  const aldric = h.connect(); await h.hello(aldric, 'aldr-0001', null, { gi: G1, gt: 'HND', gm: 'm1' });
  const mara = h.connect(); await h.hello(mara, 'mara-0002', null, { gi: G1, gt: 'HND', gm: 'm2' });
  const cass = h.connect(); await h.hello(cass, 'cass-0003', null, { gi: G1, gt: 'HND', gm: 'm3' });
  tick(5000);
  const t = nowS();
  const sign = (claims, at) => mintToken({ s: 'acct-mara-0002', k: 'guest', ...claims }, kp.privateKey, { subtle, nowS: at });
  // what Mara holds from before her removal: a token from before she joined (no guild), her join's order, and two
  // tokens minted after she joined
  const bare = await sign({ n: 'mara-0005' }, t - 4);
  const joined = await mintGuildOrder({ s: 'acct-mara-0002', gi: G1, gt: 'HND', gm: 'm2' }, kp.privateKey, { subtle, nowS: t - 3 });
  const hoarded = [await sign({ n: 'mara-0006', gi: G1, gt: 'HND', gm: 'm2' }, t - 2), await sign({ n: 'mara-0007', gi: G1, gt: 'HND', gm: 'm2' }, t - 1)];
  const remove = async (s, gm) => h.room.webSocketMessage(aldric, JSON.stringify({
    t: 'guildout', order: await mintGuildOutOrder({ s, gi: G1, gm }, kp.privateKey, { subtle, nowS: nowS() }),
  }));
  await remove('acct-mara-0002', 'm2');
  assert.equal(mara.att.gi, undefined, 'removed');
  assert.deepEqual(h.store.get('guildouts'), { [`${G1}:m2`]: t }, 'and the hold written where the next instance reads it');
  // the hub sleeps; the first thing its next instance hears is a hello on a token minted before the removal
  h.wake();
  tick(1100);
  const back = h.connect(); await h.hello(back, 'mara-0006', null, { tok: hoarded[0], cl: 1 });   // ONE-SEAT: a fresh tab going online claims (her first tab holds the hub)
  assert.equal(back.att.id, 'mara-0006', 'let in...');
  assert.equal(back.att.gi, undefined, '...but not into the guild she was removed from');
  await h.room.webSocketMessage(aldric, JSON.stringify({ t: 'chat', text: 'she is gone', ch: 'guild' }));
  assert.deepEqual(ofType(back, 'chat'), [], 'its chat does not reach her');
  // it sleeps again and wakes to another removal: the kept holds are read before the new one is written
  h.wake();
  tick(1100);
  await remove('acct-cass-0003', 'm3');
  assert.equal(cass.att.gi, undefined);
  assert.deepEqual(Object.keys(h.store.get('guildouts')).sort(), [`${G1}:m2`, `${G1}:m3`], 'beside the first, not over it');
  // and a third time: a socket that came in wearing no guild carries her join, said before the removal
  h.wake();
  tick(1100);
  const plain = h.connect(); await h.hello(plain, 'mara-0005', null, { tok: bare, cl: 1 });
  assert.equal(plain.att.gi, undefined);
  await h.room.webSocketMessage(plain, JSON.stringify({ t: 'guild', order: joined }));
  assert.equal(plain.att.gi, undefined, 'the join is older than the removal the hub slept on');
  assert.deepEqual(ofType(plain, 'guild').at(-1), { t: 'guild', id: 'mara-0005' }, 'and its carrier hears that the room holds none');
  tick(1100);
  const again = h.connect(); await h.hello(again, 'mara-0007', null, { tok: hoarded[1], cl: 1 });
  assert.equal(again.att.gi, undefined, 'three sleeps and a second write on, the first hold stands');
}));

test('AUDIT MERGE-PLUS A3 the keeping: a hold is kept while anything said before it can still be carried in - a token\'s whole life past it and more - so a hub that slept through most of that life still turns the token away; and no longer: an hour on, the next write drops it from storage, and a copy the hub slept on past its keeping is not read back (mutants: the keeping cut to an order\'s minute; the storage copy never pruned; a stale copy read back)', () => withClock(async (tick) => {
  const h = fakeRoom(SOCIAL_ROOM);
  const kp = await h.signer();
  const aldric = h.connect(); await h.hello(aldric, 'aldr-0001', null, { gi: G1, gt: 'HND', gm: 'm1' });
  tick(5000);
  const hoarded = await mintToken({ s: 'acct-mara-0002', n: 'mara-0003', k: 'guest', gi: G1, gt: 'HND', gm: 'm2' }, kp.privateKey, { subtle, nowS: nowS() - 2 });
  const remove = async (s, gm) => h.room.webSocketMessage(aldric, JSON.stringify({
    t: 'guildout', order: await mintGuildOutOrder({ s, gi: G1, gm }, kp.privateKey, { subtle, nowS: nowS() }),
  }));
  await remove('acct-mara-0002', 'm2');
  // the hub sleeps through most of that token's life (it has seconds left) and wakes to it
  tick((MAX_TTL_S - 10) * 1000);
  h.wake();
  const back = h.connect(); await h.hello(back, 'mara-0003', null, { tok: hoarded });
  assert.equal(back.att.id, 'mara-0003', 'the token is still good...');
  assert.equal(back.att.gi, undefined, '...and the hold outlived the sleep');
  // an hour on, nothing said before it can be carried in: the next write drops it
  tick(3_600_000);
  await remove('acct-cass-0004', 'm4');
  assert.deepEqual(Object.keys(h.store.get('guildouts')), [`${G1}:m4`], 'the storage copy keeps only what can still matter');
  // and a copy the hub slept on past its keeping is not read back
  h.wake();
  tick(3_600_000);
  const al2 = h.connect(); await h.hello(al2, 'aldr-0009', null, { tokenSub: 'acct-aldr-0001', gi: G1, gt: 'HND', gm: 'm1', cl: 1 });   // a hello wearing the guild reads the holds - ONE-SEAT: a fresh tab going online, so it claims
  assert.equal(al2.att.gi, G1);
  assert.deepEqual([...h.room._guildOuts.keys()], [], 'the room holds nothing it can no longer need');
}));

// ─── A4: THE BOOK'S REFUSALS ─────────────────────────────────────────────────────────────────────────────────────────

test('AUDIT MERGE-PLUS A4 the book\'s refusals: a deposit the Worker refuses in its own words - the account\'s rate above all, asked ahead of every route - never landed, so the gold comes back and the refusal is said as itself; only what may have landed (offline, server, a word this build does not know) keeps it (mutants: the Worker\'s words read as may-have-landed; each word dropped)', async () => {
  // the field case, through the real Worker: the account's other traffic this minute has spent its bucket
  await withClock(async () => {
    const { env, fetch, call, registered } = await stand();
    const me = await registered('Aldric');
    const w = fakeWallet(50_000);
    const book = new GuildBook({ door: accountGuilds({ fetch, storage: me.storage }), character: () => me.character, wallet: w.make });
    assert.equal((await book.found('The Hound', 'HND')).ok, true);
    let n = 0;
    while ((await call('/v1/guilds/invites', {}, me.secret)).status !== 429) assert.ok(++n <= ACCOUNT_MAX, 'the account\'s bucket fills');
    const before = w.gold;
    assert.deepEqual(await book.deposit(5_000), { ok: false, error: 'rate' }, 'refused, and said so - not "the answer was lost"');
    assert.equal(w.gold, before, 'the gold comes back: the rate is asked before the route runs, so the treasury never had it');
    assert.equal(env.DB._raw.prepare('SELECT treasury FROM guilds').get().treasury, 0);
    assert.equal(env.DB._raw.prepare('SELECT COUNT(*) AS n FROM guild_ledger').get().n, 0, 'and the ledger has no line to read');
  });
  // every word the Worker says before a route of its own runs
  for (const word of ['rate', 'body', 'too-large', 'method', 'not-found', 'no-database', 'no-player']) {
    const { door, w, book } = bookOf(1000);
    door.said = { ok: false, error: word };
    assert.equal(guildRefused(word), true, word);
    assert.deepEqual(await book.deposit(300), { ok: false, error: word }, `${word}: a refusal, said as itself`);
    assert.deepEqual([w.gold, w.credited], [1000, [300]], `${word}: and the gold comes back`);
  }
  // ...and what may have landed still may have
  for (const lost of ['offline', 'server', 'guild-a-word-from-a-newer-service']) {
    const { door, w, book } = bookOf(1000);
    door.said = { ok: false, error: lost };
    assert.deepEqual(await book.deposit(300), { ok: false, error: 'guild-unsure' }, lost);
    assert.deepEqual([w.gold, w.credited], [700, []], `${lost}: the gold may be in the treasury, so it does not come back`);
  }
});

// ─── A5: THE LOOK IN FLIGHT ──────────────────────────────────────────────────────────────────────────────────────────

test('AUDIT MERGE-PLUS A5 the look in flight: "Join" pressed while the tab\'s look is still out ends on the JOIN - the act waits that older look out and takes its own after it, so the tab shows the guild and the rooms are told; a look that failed on the way is waited out, never answered for (mutants: the act\'s look handed the one in flight; the failed look failing the act)', async () => {
  const later = (v) => new Promise((res) => { setImmediate(() => res(v)); });   // a moment on the wire, read as the service stood when it ARRIVED
  const server = { guild: null };
  const invitation = { guild: 'g0123456789', name: 'The Hound', tag: 'HND', by: 'Aldric', at: 1 };
  let failNext = false;
  const door = {
    mine: () => {
      if (failNext) { failNext = false; return new Promise((_, rej) => { setImmediate(() => rej(new Error('the look fell over'))); }); }
      const g = server.guild;
      return later({ ok: true, data: { guild: g, order: g ? 'v1.in' : 'v1.none' } });
    },
    invites: () => { const g = server.guild; return later({ ok: true, data: { invites: g ? [] : [invitation] } }); },
    answer: async () => { server.guild = view(); return { ok: true, data: { ok: true, guild: server.guild, order: 'v1.in' } }; },
    invite: async () => ({ ok: true, data: { ok: true } }),
  };
  const handed = [];
  let now = 1_000_000;
  const book = new GuildBook({ door, character: () => 'char-mara', wallet: fakeWallet(0).make, now: () => now, onOrders: (o) => handed.push(o) });
  await book.refresh();
  assert.deepEqual([book.guild, book.invites.length, handed], [null, 1, [{ order: 'v1.none' }]], 'an earlier look: no guild, one invitation');
  now += GUILD_FRESH_MS;
  assert.equal(book.stale(), true, 'the tab opens: a look is due');
  const look = book.refresh();
  const r = await book.answer('g0123456789', true);   // "Join", pressed while that look is out
  await look;
  assert.equal(r.ok, true);
  assert.equal(book.guild?.tag, 'HND', 'the tab shows the guild joined, not the look that read it before the join');
  assert.deepEqual(book.invites, []);
  assert.deepEqual(handed, [{ order: 'v1.none' }, { order: 'v1.in' }], 'and the rooms are told she is in it');
  // a look that FAILED on the way (a door that is not `call`, which never throws) is waited out, and the act looks again
  failNext = true;
  const failing = book.refresh().then(() => 'answered', () => 'failed');
  const act = book.invite('Bran');
  await assert.doesNotReject(act, 'the act never fails for a look that failed before it');
  assert.equal(await failing, 'failed', 'the tab\'s look failed...');
  assert.deepEqual(await act, { ok: true, data: { ok: true } }, '...and the act did not: it took a look of its own');
  assert.equal(book.state, 'ready');
});
