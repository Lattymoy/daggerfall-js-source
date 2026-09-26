// HOME1 (2026-09-25, Mac: "allowing online players to purchase housing in any location"; asked: "Housing is
// exclusive. World is super large. Can revisit later if needed"; bought "At its front door"; a house bought offline
// "Stay[s] offline only"; who walks in, "Owner chooses"): AN ONLINE HOME, ONE OWNER A BUILDING, SERVER-WIDE. The law
// both ends read (net/homeLaw.js), the account service's registry driven through the real Worker over node:sqlite
// with every migration applied (server-account/src/homes.js), the client's door to it, and the deploy's wiring.
// `06-Systems/Online-Arc.md` HOME1.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import worker from '../server-account/src/index.js';
import { ROUTES, OPEN_ROUTES } from '../server-account/src/service.js';
import { _resetKeyForTests } from '../server-account/src/signing.js';
import {
  HOME_CAP, HOME_ENTRIES, HOME_ENTRY_DEFAULT, HOME_PRICE_MAX, HOME_CLAIMS_MAX, HOME_KEY_MAX,
  homeMapIdOk, homeBuildingKeyOk, homeRegionOk, homePriceOk, homeEntryOk, homeMayEnter,
} from '../src/net/homeLaw.js';
import { accountHomes, REFUSALS, SESSION_KEY } from '../src/net/accountClient.js';
import { claimHome } from '../server-account/src/homes.js';
import {
  HOME_TOWN_TTL_MS, HOME_RETRY_MS, HOME_ENTRY_WORDS, HOME_BANK_LINES, homeCandidate, homePurchasable, homeSceneName, homeRefund,
  homeDoorAnswer, homeDoorTitle, homeLockedLine, homeBelongsLine, homeEntryLine, homeForSaleLine, createOnlineHomes,
  buyOnlineHome, sellOnlineHome,
} from '../src/systems/onlineHomes.js';
import { interiorSceneName } from '../src/systems/sceneCache.js';
import { BUILDING_TYPES } from '../src/world/buildingNames.js';
import { mintInteriorShared, composeInteriorShared, applyInteriorShared, interiorActionRecords, interiorLocationKey } from '../src/world/interiorShared.js';
import { BankWindow, BANK_RECTS, BANK_PANEL_X, BANK_PANEL_Y } from '../src/ui/bankWindow.js';
import { createBankAccounts, housePrice } from '../src/systems/banking.js';
import { buildingDataForDoor, locationBuildings } from '../src/systems/talkTopics.js';

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
      let args = [];
      const api = {
        bind(...a) { args = a; return api; },
        async first() { return stmt.get(...args) ?? null; },
        async all() { return { results: stmt.all(...args) }; },
        async run() { const r = stmt.run(...args); return { meta: { changes: Number(r.changes) } }; },
        _rows() { return stmt.all(...args); },
      };
      return api;
    },
    async batch(list) {
      db.exec('BEGIN');
      try { const out = list.map((st) => ({ results: st._rows() })); db.exec('COMMIT'); return out; } catch (e) { db.exec('ROLLBACK'); throw e; }
    },
  };
}
async function stand() {
  _resetKeyForTests();
  const kp = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const pkcs8 = Buffer.from(new Uint8Array(await subtle.exportKey('pkcs8', kp.privateKey))).toString('base64');
  const env = { DB: d1(), IDENTITY_PRIVATE_KEY: pkcs8, ACCOUNT_VERSION: 'test1', ALLOWED_ORIGIN: '*' };
  const call = async (method, path, body, bearer = null) => {
    const res = await worker.fetch(new Request(`https://accounts.invalid${path}`, {
      method,
      headers: { ...(body !== undefined ? { 'content-type': 'application/json' } : {}), ...(bearer ? { authorization: `Bearer ${bearer}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    }), env);
    return { status: res.status, body: await res.json().catch(() => null) };
  };
  const registered = async (handle) => {
    const guest = (await call('POST', '/v1/auth/guest', {})).body;
    const reg = await call('POST', '/v1/auth/register', { secret: guest.secret, handle, password: 'a good long one' });
    assert.equal(reg.status, 200, `${handle} registers`);
    return guest.secret;
  };
  return { env, call, registered };
}
const T0 = 1_800_000_000;
const home = (extra = {}) => ({ mapId: 1291010263, buildingKey: 0x10203, region: 17, character: 'char-aldric', price: 42000, ...extra });

test('HOME1 the law: a home is a town\'s unsigned map id and a building key inside the key\'s widest value, a region 0..61, a whole price up to ten million; three a character; private until the owner says party or public; the owner always walks in, anyone when public, the owner\'s party when party (matched on the relay\'s handle, any case), nobody else (mutants: the cap, a bound, the party matched on nothing, private open)', () => {
  assert.equal(HOME_CAP, 3);
  assert.deepEqual(HOME_ENTRIES, ['private', 'party', 'public']);
  assert.equal(HOME_ENTRY_DEFAULT, 'private');
  assert.deepEqual([homeMapIdOk(1), homeMapIdOk(0xffffffff), homeMapIdOk(0), homeMapIdOk(-5), homeMapIdOk(2 ** 32), homeMapIdOk(1.5), homeMapIdOk('1')], [true, true, false, false, false, false, false]);
  assert.deepEqual([homeBuildingKeyOk(1), homeBuildingKeyOk(HOME_KEY_MAX), homeBuildingKeyOk(0), homeBuildingKeyOk(HOME_KEY_MAX + 1)], [true, true, false, false]);
  assert.equal(HOME_KEY_MAX, 1 << 24, 'talkTopics makeBuildingKey spells key 0 as 1<<24');
  assert.deepEqual([homeRegionOk(0), homeRegionOk(61), homeRegionOk(62), homeRegionOk(-1)], [true, true, false, false]);
  assert.deepEqual([homePriceOk(1), homePriceOk(HOME_PRICE_MAX), homePriceOk(0), homePriceOk(HOME_PRICE_MAX + 1), homePriceOk(2.5)], [true, true, false, false, false]);
  assert.deepEqual([homeEntryOk('party'), homeEntryOk('guild'), homeEntryOk(null)], [true, false, false], 'a guild\'s entry waits for guilds');
  const row = (entry, mine = false) => ({ owner: 'Aldric', entry, mine });
  assert.equal(homeMayEnter(null), true, 'a building nobody owns: its own law stands');
  assert.equal(homeMayEnter(row('private', true)), true, 'the owner');
  assert.equal(homeMayEnter(row('private'), { partyNames: ['Aldric'] }), false, 'private is the owner\'s alone - even to their party');
  assert.equal(homeMayEnter(row('public')), true);
  assert.equal(homeMayEnter(row('party'), { partyNames: ['Mara', 'aldric'] }), true, 'the owner in my party, any case');
  assert.equal(homeMayEnter(row('party'), { partyNames: ['Mara'] }), false);
  assert.equal(homeMayEnter(row('party')), false, 'no party');
  assert.equal(homeMayEnter(row('party'), { partyNames: [''] }), false, 'an empty name is nobody');
});

test('HOME1 the service: a town\'s homes are any session\'s to read (a guest\'s too) and nobody\'s without one; owning is an account\'s - a guest\'s claim is refused; ONE OWNER A BUILDING - a claim lands, a second player\'s claim of it is taken, the same character\'s again is answered as its claim; three a character, a fourth refused and another character free; the town says whose each is and marks the caller\'s own; entry the owner\'s to set; a release the owner\'s, answering the price, and the building free again; a deleted account\'s homes go with it (mutants: the route open to strangers, a guest owning, two owners, the cap unread, the cap per account, another\'s entry set, another\'s home released, the repeat refused)', async (t) => {
  t.mock.method(Date, 'now', () => T0 * 1000);
  const { env, call, registered } = await stand();
  for (const r of ['/v1/homes/town', '/v1/homes/mine', '/v1/homes/claim', '/v1/homes/release', '/v1/homes/entry']) {
    assert.ok(ROUTES.has(r) && !OPEN_ROUTES.has(r), `${r} behind a session`);
  }
  assert.equal((await call('POST', '/v1/homes/town', { mapId: 5 })).status, 401, 'a stranger reads nothing');
  const guest = (await call('POST', '/v1/auth/guest', {})).body.secret;
  const empty = await call('POST', '/v1/homes/town', { mapId: home().mapId }, guest);
  assert.equal(empty.status, 200);
  assert.deepEqual(empty.body, { mapId: home().mapId, homes: [] }, 'a guest reads a town');
  const g = await call('POST', '/v1/homes/claim', home(), guest);
  assert.deepEqual([g.status, g.body.error], [403, 'homes-need-account'], 'a guest owns nothing');
  assert.deepEqual(await claimHome({ db: env.DB, nowS: T0 }, { id: 'g1', handle: null, guest_name: 'Quiet Fox' }, home()), { error: 'homes-need-account' }, 'and the function asks again - a function that trusts its caller\'s wall is one refactor from having none');
  assert.equal((await call('GET', '/v1/homes/town', undefined, guest)).status, 405);
  const aldric = await registered('Aldric');
  const mara = await registered('Mara');
  // the claim
  const c = await call('POST', '/v1/homes/claim', home(), aldric);
  assert.equal(c.status, 200);
  assert.deepEqual(c.body, { ok: true, home: { mapId: home().mapId, buildingKey: home().buildingKey, region: 17, character: 'char-aldric', entry: 'private', price: 42000, boughtAt: T0 } });
  // one owner a building
  const taken = await call('POST', '/v1/homes/claim', home({ character: 'char-mara' }), mara);
  assert.deepEqual([taken.status, taken.body.error], [409, 'home-taken']);
  const again = await call('POST', '/v1/homes/claim', home(), aldric);
  assert.deepEqual([again.status, again.body.repeat, again.body.home.character], [200, true, 'char-aldric'], 'a claim sent again after a lost answer is answered as the claim');
  const otherChar = await call('POST', '/v1/homes/claim', home({ character: 'char-second' }), aldric);
  assert.deepEqual([otherChar.status, otherChar.body.error], [409, 'home-taken'], 'the same account\'s other character does not get it twice');
  // the town, as each sees it
  const asMara = (await call('POST', '/v1/homes/town', { mapId: home().mapId }, mara)).body.homes;
  assert.deepEqual(asMara, [{ buildingKey: home().buildingKey, owner: 'Aldric', entry: 'private', mine: false }], 'the handle on the door, never a character or a price');
  const asAldric = (await call('POST', '/v1/homes/town', { mapId: home().mapId }, aldric)).body.homes;
  assert.deepEqual(asAldric, [{ buildingKey: home().buildingKey, owner: 'Aldric', entry: 'private', mine: true, character: 'char-aldric' }]);
  // the cap, a character's
  for (const k of [2, 3]) assert.equal((await call('POST', '/v1/homes/claim', home({ buildingKey: k }), aldric)).status, 200);
  const fourth = await call('POST', '/v1/homes/claim', home({ buildingKey: 4 }), aldric);
  assert.deepEqual([fourth.status, fourth.body.error], [409, 'home-cap']);
  assert.equal((await call('POST', '/v1/homes/claim', home({ buildingKey: 4, character: 'char-second' }), aldric)).status, 200, 'another character has its own three');
  const mine = (await call('POST', '/v1/homes/mine', {}, aldric)).body;
  assert.equal(mine.homes.length, 4);
  assert.equal(mine.cap, 3);
  // entry: the owner's to set
  const e1 = await call('POST', '/v1/homes/entry', { mapId: home().mapId, buildingKey: home().buildingKey, entry: 'party' }, mara);
  assert.deepEqual([e1.status, e1.body.error], [404, 'no-home'], 'another\'s home is as absent as none');
  const e2 = await call('POST', '/v1/homes/entry', { mapId: home().mapId, buildingKey: home().buildingKey, entry: 'public' }, aldric);
  assert.deepEqual(e2.body, { ok: true, entry: 'public' });
  assert.equal((await call('POST', '/v1/homes/town', { mapId: home().mapId }, mara)).body.homes.find((h) => h.buildingKey === home().buildingKey).entry, 'public', 'the town reads it');
  const e3 = await call('POST', '/v1/homes/entry', { mapId: home().mapId, buildingKey: home().buildingKey, entry: 'guild' }, aldric);
  assert.deepEqual([e3.status, e3.body.error], [400, 'bad-entry']);
  // release: the owner's; the price back; the building free
  const r1 = await call('POST', '/v1/homes/release', { mapId: home().mapId, buildingKey: home().buildingKey }, mara);
  assert.deepEqual([r1.status, r1.body.error], [404, 'no-home']);
  const r2 = await call('POST', '/v1/homes/release', { mapId: home().mapId, buildingKey: home().buildingKey }, aldric);
  assert.deepEqual(r2.body, { ok: true, price: 42000, decorCount: 0, decorBack: 0 });   // DECOR1e: no pieces placed, none given back
  assert.equal((await call('POST', '/v1/homes/claim', home({ character: 'char-mara' }), mara)).status, 200, 'free again, and Mara\'s');
  // shapes
  assert.equal((await call('POST', '/v1/homes/claim', home({ buildingKey: 0 }), aldric)).body.error, 'bad-home');
  assert.equal((await call('POST', '/v1/homes/claim', home({ price: 0 }), aldric)).body.error, 'bad-home');
  assert.equal((await call('POST', '/v1/homes/claim', home({ region: 62 }), aldric)).body.error, 'bad-home');
  assert.equal((await call('POST', '/v1/homes/claim', home({ character: 'no spaces!' }), aldric)).body.error, 'home-character');
  assert.equal((await call('POST', '/v1/homes/town', { mapId: -1 }, aldric)).body.error, 'bad-home');
  // an account deleted takes its homes (the buildings stand free)
  const db = env.DB._raw;
  const before = db.prepare('SELECT COUNT(*) AS n FROM homes').get().n;
  db.prepare("DELETE FROM players WHERE handle = 'Aldric'").run();
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM homes').get().n, before - 3, 'CASCADE');
});

test('HOME1 the claim\'s rate: an account makes at most twenty claims an hour, answered home-rate - a cap stops a hoard, this stops a claim-and-release churn (mutants: the rate unread)', async (t) => {
  t.mock.method(Date, 'now', () => T0 * 1000);
  const { call, registered } = await stand();
  const me = await registered('Churner');
  for (let i = 0; i < HOME_CLAIMS_MAX; i++) {
    const r = await call('POST', '/v1/homes/claim', home({ buildingKey: 100 + (i % 2), character: 'char-churn' }), me);
    assert.equal(r.status, 200);
    if (r.body.home && !r.body.repeat) await call('POST', '/v1/homes/release', { mapId: home().mapId, buildingKey: 100 + (i % 2) }, me);
  }
  const over = await call('POST', '/v1/homes/claim', home({ buildingKey: 999, character: 'char-churn' }), me);
  assert.deepEqual([over.status, over.body.error], [429, 'home-rate']);
});

test('HOME1 the client\'s door: every call rides the one session as a Bearer header to its route, and no session is a word, not a throw; every refusal the service can say has a sentence (mutants: a route misspelt, the secret in the body)', async () => {
  const seen = [];
  const fetch = async (url, init) => { seen.push({ url, init }); return { ok: true, status: 200, json: async () => ({ ok: true }) }; };
  const storage = new Map([[SESSION_KEY, JSON.stringify({ secret: 'sek', id: 'p' })]]);
  const store = { getItem: (k) => storage.get(k) ?? null, setItem: (k, v) => storage.set(k, v), removeItem: (k) => storage.delete(k) };
  const api = accountHomes({ fetch, storage: store });
  await api.town(7);
  await api.mine();
  await api.claim({ ...home(), extra: 'dropped' });
  await api.release(7, 9);
  await api.entry(7, 9, 'party');
  assert.deepEqual(seen.map((s) => new URL(s.url).pathname), ['/v1/homes/town', '/v1/homes/mine', '/v1/homes/claim', '/v1/homes/release', '/v1/homes/entry']);
  for (const s of seen) {
    assert.equal(s.init.headers.authorization, 'Bearer sek');
    assert.equal(JSON.parse(s.init.body).secret, undefined, 'the credential rides the header alone');
  }
  assert.deepEqual(JSON.parse(seen[2].init.body), { mapId: home().mapId, buildingKey: home().buildingKey, region: 17, character: 'char-aldric', price: 42000 }, 'the claim names only what the service reads');
  assert.deepEqual(JSON.parse(seen[4].init.body), { mapId: 7, buildingKey: 9, entry: 'party' });
  const none = accountHomes({ fetch, storage: { getItem: () => null } });
  assert.deepEqual(await none.town(7), { ok: false, error: 'no-session' });
  for (const w of ['homes-need-account', 'home-taken', 'home-cap', 'home-rate', 'no-home', 'bad-home', 'home-character', 'bad-entry', 'no-session']) {
    assert.equal(typeof REFUSALS[w], 'string', `${w} has its sentence`);
  }
  assert.match(REFUSALS['home-cap'], /at most 3 homes/);
  // the deploy: the law is bundled, so a change to it deploys the Worker; and the smoke reads a town and refuses a guest
  const wf = src('.github/workflows/account-deploy.yml');
  assert.match(wf, /- "src\/net\/homeLaw\.js"/);
  assert.match(wf, /\$base\/v1\/homes\/town/);
  assert.match(wf, /grep -q '"homes-need-account"' \/tmp\/claim\.json/);
});

test('HOME1 the client\'s law: a home can be Daggerfall\'s for-sale house or an ordinary residence, never a faction\'s House2, a shop or a keyless building; bought only when no quest is set in it; its things live under a scene of its OWN (never the building\'s); it sells back at the deed\'s share; the door\'s one answer - nobody\'s, mine, open to me (public, my party holding the owner, my account\'s other character, my quest\'s building), shut; the words (mutants: a faction house for sale, the quest ignored, one scene for both, the share, public shut, the quest rung lost)', () => {
  const b = (buildingType, extra = {}) => ({ buildingType, buildingKey: 0x10203, factionId: 0, ...extra });
  for (const t of [BUILDING_TYPES.HouseForSale, BUILDING_TYPES.House1, BUILDING_TYPES.House2, BUILDING_TYPES.House3, BUILDING_TYPES.House4]) assert.equal(homeCandidate(b(t)), true, `type ${t}`);
  assert.equal(homeCandidate(b(BUILDING_TYPES.House2, { factionId: 42 })), false, 'a guild\'s house (the lock law keeps it for members)');
  assert.equal(homeCandidate(b(BUILDING_TYPES.House3, { factionId: 42 })), true, 'the lock law names House2 alone');
  for (const t of [BUILDING_TYPES.House5, BUILDING_TYPES.Tavern, BUILDING_TYPES.Bank, BUILDING_TYPES.Palace, BUILDING_TYPES.Alchemist]) assert.equal(homeCandidate(b(t)), false, `type ${t}`);
  assert.equal(homeCandidate(b(BUILDING_TYPES.House1, { buildingKey: 0 })), false, 'a building with no key is nobody\'s to own');
  assert.equal(homeCandidate(null), false);
  assert.equal(homePurchasable(b(BUILDING_TYPES.House1)), true);
  assert.equal(homePurchasable(b(BUILDING_TYPES.House1), { isActiveQuestBuilding: () => true }), false, 'a quest\'s building is not for sale (GetHousesForSale)');
  assert.equal(homeSceneName(-5, 9), 'OnlineHome [MapID=4294967291, BuildingKey=9]', 'the town unsigned');
  assert.notEqual(homeSceneName(7, 9), interiorSceneName(7, 9), 'never the building\'s own scene - offline, a stranger\'s cupboard restocks on the first open');
  assert.deepEqual([homeRefund(42000), homeRefund(1), homeRefund(0), homeRefund(-5), homeRefund(2.5)], [35700, 0, 0, 0, 0]);
  const row = (entry, extra = {}) => ({ owner: 'Aldric', entry, mine: false, own: false, ...extra });
  assert.equal(homeDoorAnswer(null), 'none');
  assert.equal(homeDoorAnswer(row('private', { mine: true, own: true })), 'own');
  assert.equal(homeDoorAnswer(row('private', { mine: true })), 'enter', 'my account\'s other character\'s: the account walks in, it is not this character\'s');
  assert.equal(homeDoorAnswer(row('public')), 'enter');
  assert.equal(homeDoorAnswer(row('party'), { partyNames: ['ALDRIC'] }), 'enter');
  assert.equal(homeDoorAnswer(row('party'), { partyNames: ['Mara'] }), 'locked');
  assert.equal(homeDoorAnswer(row('private')), 'locked');
  assert.equal(homeDoorAnswer(row('private'), { questSite: true }), 'enter', 'a quest must not strand its player - Daggerfall\'s own rung');
  assert.equal(homeDoorTitle(row('private', { own: true })), 'Your home');
  assert.equal(homeDoorTitle(row('private', { mine: true })), 'Aldric\'s home', 'your OTHER character\'s home is not this one\'s');
  assert.equal(homeLockedLine(row('private')), 'This is Aldric\'s home. The door is locked.');
  assert.equal(homeBelongsLine(row('public')), 'This belongs to Aldric.');
  assert.deepEqual(HOME_ENTRY_WORDS, { private: 'Only me', party: 'My party', public: 'Anyone' });
  assert.deepEqual([homeEntryLine('party'), homeEntryLine('guild')], ['Who may enter: My party.', 'Who may enter: Only me.']);
  assert.equal(homeForSaleLine(12800), 'Can be your home: 12800 gold');
});

/** A fake account service for the registry: its town answers are scripted, and every call is counted. */
function fakeHomesApi(homesByTown = new Map()) {
  const calls = [];
  const api = {
    calls,
    homesByTown,
    fail: false,
    hold: null,
    async town(mapId) {
      calls.push(['town', mapId]);
      if (api.hold) await api.hold;
      if (api.fail) return { ok: false, error: 'offline' };
      return { ok: true, data: { mapId, homes: (homesByTown.get(mapId) ?? []).map((h) => ({ ...h })) } };
    },
    claimAnswer: null,
    async claim(body) { calls.push(['claim', body]); return api.claimAnswer ?? { ok: true, data: { ok: true, home: { entry: 'private' } } }; },
    releaseAnswer: null,
    async release(mapId, buildingKey) { calls.push(['release', mapId, buildingKey]); return api.releaseAnswer ?? { ok: true, data: { ok: true, price: 42000 } }; },
    async entry(mapId, buildingKey, entry) { calls.push(['entry', mapId, buildingKey, entry]); return { ok: true, data: { ok: true, entry } }; },
  };
  return api;
}
const flush = () => new Promise((r) => setTimeout(r, 0));

test('HOME1 the client\'s registry: a town is asked once while its answer is out, believed for its time and asked again after; an unanswered ask keeps what was known and waits before the next; a home is `own` only to the character that bought it; a claim, a sale and an entry show at once and are read back from the service; a taken claim reads the town again; a door never waits on a slow town past its bound (mutants: two asks in flight, the time unread, a failure forgetting the town, own by account, the claim\'s character, no read-back)', async () => {
  let now = 1_000_000;
  let me = 'char-aldric';
  const T = 206728581;
  const api = fakeHomesApi(new Map([[T, [
    { buildingKey: 5, owner: 'Aldric', entry: 'private', mine: true, character: 'char-aldric' },
    { buildingKey: 6, owner: 'Aldric', entry: 'public', mine: true, character: 'char-other' },
    { buildingKey: 7, owner: 'Mara', entry: 'party', mine: false },
    { buildingKey: 0, owner: 'Bad', entry: 'public', mine: false },
    { buildingKey: 8, owner: 'Odd', entry: 'guild', mine: false },
  ]]]));
  const homes = createOnlineHomes({ api, character: () => me, now: () => now });
  assert.equal(homes.known(T), false);
  assert.equal(homes.homeAt(T, 5), null, 'an unknown town names nobody');
  const v0 = homes.version();
  const [a, b] = await Promise.all([homes.ensure(T), homes.ensure(-(2 ** 32) + T)]);
  assert.deepEqual([a, b], [true, true]);
  assert.equal(api.calls.filter((c) => c[0] === 'town').length, 1, 'one ask in flight - and a signed id is the same town');
  assert.ok(homes.version() > v0);
  assert.equal(homes.homeAt(T, 5).own, true);
  assert.equal(homes.homeAt(T, 6).own, false, 'my account\'s other character\'s home is not this character\'s');
  assert.equal(homes.homeAt(T, 6).mine, true);
  assert.equal(homes.homeAt(T, 7).own, false);
  assert.equal(homes.homeAt(T, 0), null, 'a malformed row is not believed');
  assert.equal(homes.homeAt(T, 8).entry, 'private', 'an entry the client does not know reads as the owner\'s alone');
  me = 'char-other';
  assert.equal(homes.homeAt(T, 6).own, true, 'own is read against the character playing NOW');
  me = 'char-aldric';
  await homes.ensure(T);
  assert.equal(api.calls.filter((c) => c[0] === 'town').length, 1, 'fresh: not asked again');
  now += HOME_TOWN_TTL_MS;
  await homes.ensure(T);
  assert.equal(api.calls.filter((c) => c[0] === 'town').length, 2, 'stale: asked again');
  api.fail = true;
  now += HOME_TOWN_TTL_MS;
  assert.equal(await homes.ensure(T), true, 'an unanswered ask keeps what was known');
  assert.equal(homes.homeAt(T, 7).owner, 'Mara');
  const n = api.calls.length;
  assert.equal(await homes.ensure(T), true);
  assert.equal(api.calls.length, n, 'and the next ask waits a little');
  now += HOME_RETRY_MS;
  await homes.ensure(T);
  assert.equal(api.calls.length, n + 1);
  assert.equal(await homes.ensure(99), false, 'a town never answered is unknown');
  api.fail = false;
  // the claim: my character's, shown at once, read back
  const towns = api.calls.filter((c) => c[0] === 'town').length;
  const r = await homes.claim({ mapId: T, buildingKey: 9, region: 17, price: 42000 });
  assert.deepEqual(r, { ok: true, repeat: false });
  assert.deepEqual(api.calls.find((c) => c[0] === 'claim')[1], { mapId: T, buildingKey: 9, region: 17, character: 'char-aldric', price: 42000 });
  assert.equal(homes.homeAt(T, 9).own, true, 'mine at once');
  await flush();
  assert.equal(api.calls.filter((c) => c[0] === 'town').length, towns + 1, 'and read back from the service');
  api.claimAnswer = { ok: false, error: 'home-taken' };
  assert.deepEqual(await homes.claim({ mapId: T, buildingKey: 7, region: 17, price: 42000 }), { ok: false, error: 'home-taken' });
  await flush();
  assert.equal(api.calls.filter((c) => c[0] === 'town').length, towns + 2, 'a taken claim reads the town again - the door should say whose');
  assert.deepEqual(await homes.setEntry(T, 5, 'public'), { ok: true, entry: 'public' });
  assert.equal(homes.homeAt(T, 5).entry, 'public');
  assert.deepEqual(await homes.release(T, 5), { ok: true, price: 42000, decorCount: 0, decorBack: 0 });   // DECOR1e: the pieces' answer too
  assert.equal(homes.homeAt(T, 5), null, 'gone at once');
  // the door's bound: a town whose answer never comes is not waited on
  api.hold = new Promise((res) => { setTimeout(res, 1500); });   // the town answers, but long after a door should wait
  const t0 = Date.now();
  assert.equal(await homes.waitFor(4242, 20), false);
  assert.ok(Date.now() - t0 < 1000, 'the door went on');
  api.hold = null;
});

test('HOME1 buying and selling: the purse is asked before the claim, the claim before the gold, and the purse again after it - a claim that can no longer be paid for is given back unpaid; a refused claim takes nothing; the sale is credited only once the service agrees, at the deed\'s share of what the SERVICE says was paid (mutants: paid before the claim, the second ask gone, a refusal paid for, the refund off the client\'s price)', async () => {
  const T = 206728581;
  const api = fakeHomesApi(new Map([[T, []]]));
  const homes = createOnlineHomes({ api, character: () => 'char-aldric' });
  await homes.ensure(T);
  let gold = 50000;
  const paid = [];
  const buy = (over = {}) => buyOnlineHome(homes, { mapId: T, buildingKey: 9, region: 17, price: 42000, afford: (p) => p <= gold, pay: (p) => { paid.push(p); gold -= p; }, ...over });
  assert.deepEqual(await buyOnlineHome(homes, { mapId: T, buildingKey: 9, region: 17, price: 0, afford: () => true, pay: () => paid.push('x') }), { ok: false, error: 'bad-home' });
  gold = 100;
  assert.deepEqual(await buy(), { ok: false, error: 'gold' });
  assert.equal(api.calls.filter((c) => c[0] === 'claim').length, 0, 'short of gold: the service is never asked');
  gold = 50000;
  api.claimAnswer = { ok: false, error: 'home-cap' };
  assert.deepEqual(await buy(), { ok: false, error: 'home-cap' });
  assert.deepEqual(paid, [], 'a refused claim takes nothing');
  api.claimAnswer = null;
  let asks = 0;
  const spent = await buyOnlineHome(homes, { mapId: T, buildingKey: 9, region: 17, price: 42000, afford: () => (++asks === 1), pay: (p) => paid.push(p) });
  assert.deepEqual(spent, { ok: false, error: 'gold' }, 'the purse emptied while the answer was out');
  assert.deepEqual(api.calls.at(-1)?.[0] === 'town' ? api.calls.at(-2) : api.calls.at(-1), ['release', T, 9], 'and the claim is given back');
  assert.deepEqual(paid, []);
  assert.deepEqual(await buy(), { ok: true });
  assert.deepEqual(paid, [42000], 'paid once, after the claim');
  assert.equal(homes.homeAt(T, 9).own, true);
  const credited = [];
  api.releaseAnswer = { ok: false, error: 'no-home' };
  assert.deepEqual(await sellOnlineHome(homes, { mapId: T, buildingKey: 9, credit: (n) => credited.push(n) }), { ok: false, error: 'no-home' });
  assert.deepEqual(credited, []);
  api.releaseAnswer = { ok: true, data: { ok: true, price: 30000 } };
  assert.deepEqual(await sellOnlineHome(homes, { mapId: T, buildingKey: 9, credit: (n) => credited.push(n) }), { ok: true, refund: 25500, decorBack: 0 });   // DECOR1e: no pieces, none back
  assert.deepEqual(credited, [25500], 'the service\'s price, at the deed\'s share');
});

test('HOME1 a home\'s room carries no loot: it IS a room (its owner and their guests stand in it together, and its doors are shared), but the memory names no cupboard, a peer\'s word about one never lands, and a refused act\'s records name none - an owned OFFLINE house keeps no room at all, as before (mutants: the home keeps no room, the loot composed, a peer\'s loot applied, the records naming a cupboard)', () => {
  const key = interiorLocationKey(206728581, 9);
  const ctx = () => ({
    shelves: [], containers: [{ items: [{ name: 'My Sword', templateIndex: 1 }], stockedDate: 1 }],
    actions: { records: [{ key: 'door:0', state: 'end', t: 1 }], restored: [], collectSaveData() { return this.records.map((r) => ({ ...r })); }, restoreSaveData(l) { this.restored.push(...l); } },
  });
  const bag = mintInteriorShared(key, { home: true });
  assert.equal(bag.locationKey, key, 'a room');
  assert.deepEqual([bag.owned, bag.home], [false, true]);
  bag.seen.add('container:0');
  const shared = composeInteriorShared(ctx(), bag);
  assert.deepEqual(shared.world.loot, [], 'the memory names no cupboard, even one marked seen');
  assert.deepEqual(shared.world.actions.map((a) => a.key), ['door:0'], 'the doors are the room\'s');
  const mine = ctx();
  const peer = { locationKey: key, stamp: 'other', world: { actions: [{ key: 'door:0', state: 'start', t: 0 }], loot: [{ k: 'container:0', r: [{ name: 'Rags', templateIndex: 2 }], d: 5 }] } };
  assert.equal(applyInteriorShared(mine, peer, { ...mintInteriorShared(key, { home: true }), today: 10 }), true);
  assert.deepEqual(mine.containers[0].items.map((i) => i.name), ['My Sword'], 'a peer\'s word never lands on the owner\'s chest');
  assert.equal(mine.actions.restored.length, 1, 'the doors do');
  const stranger = ctx();
  applyInteriorShared(stranger, peer, { ...mintInteriorShared(key), today: 10 });
  assert.deepEqual(stranger.containers[0].items.map((i) => i.name), ['Rags'], 'a stranger\'s building still takes the room\'s word (WORLD6a)');
  assert.equal(interiorActionRecords(ctx(), ['container:0'], { locationKey: key, home: true }), null, 'a refused act names no cupboard');
  assert.equal(interiorActionRecords(ctx(), ['container:0'], { locationKey: key })?.l?.length, 1);
  assert.equal(mintInteriorShared(key, { owned: true }).locationKey, null, 'an owned offline house keeps no room');
});

test('HOME1 the bank online: Buy House answers that a home is bought at its own front door - Mac chose the door, and the bank\'s list is Daggerfall\'s offline house; offline the bank is Daggerfall\'s (mutants: the bank selling online, the line lost)', () => {
  const mk = (onlineHomeLines) => new BankWindow({
    accounts: () => createBankAccounts(62), regionIndex: () => 17, level: () => 5, now: () => 1000,
    player: { gold: () => 0, totalGold: () => 0, deductGold: () => 0, addGold: () => {}, wagonGold: () => 0, takeWagonGold: () => {}, takeLetter: () => null, addLetter: () => {}, carriedWeightKg: () => 0, maxEncumbranceKg: () => 1e9 },
    wagonGold: () => 0, rows: (id) => [{ text: `#${id}`, center: true }], dueDateText: () => '',
    ownsHouse: () => false, ownsShip: () => false, ownedShip: () => -1, housesForSale: () => 3, isPortTown: () => false, houseSellPrice: () => 0,
    openPurchase: () => { opened++; return true; }, onClose: () => {}, onlineHomeLines,
  });
  let opened = 0;
  const click = (w) => { const [x, y, rw, rh] = BANK_RECTS.buyHouse; w.click(BANK_PANEL_X + x + rw / 2, BANK_PANEL_Y + y + rh / 2); };
  const on = mk(() => HOME_BANK_LINES);
  click(on);
  assert.deepEqual(on.box.rows.map((r) => r.text), ['Online, a home is bought', 'at its own front door.']);
  assert.equal(opened, 0, 'no purchase window online');
  const off = mk(() => null);
  click(off);
  assert.equal(opened, 1, 'offline, Daggerfall\'s own window');
});

test('HOME1 the wiring by source: the home answers at the door BEFORE Daggerfall\'s lock ladder and shuts it by no pick, bash or spell; Info at my own door is my menu and at a house for sale its offer, No going on to the door; the visit latches its home once, committed with the building and cleared at both teardowns; my home keeps its own scene, its bed and its storage, a visitor\'s cupboard is shut, and a home has no residents; its room is kept loot-free; the doors name it; the world builds the registry online alone, keys a door by its own town, asks a town on arrival, and no quest picks a home', () => {
  const m = src('src/scenes/worldModes.js');
  const door = m.slice(m.indexOf('async function activateStaticDoor('));
  const gate = door.indexOf('const door = homeDoorFor(bd, home);');
  assert.ok(gate > 0 && gate < door.indexOf('const unlocked = homeOpen || resolveBuildingUnlocked(bd);'), 'the home answers first');
  assert.match(door, /if \(door === 'locked'\) \{ townTalk\?\.say\?\.\(homeLockedLine\(home\)\); return true; \}/, 'shut: said, and the press ends - before the Open spell, the pick and the bash');
  assert.ok(door.indexOf("if (door === 'locked')") < door.indexOf('exteriorOpenSpellFor(playerEntity)'));
  // HOME-OFFER re-aim: which press asks is homeDoorPrompt's (test/homeoffer.test.js); the door does what it says
  assert.match(door, /const price = door === 'none' \? homeOfferPrice\(bd\) : 0;\s*const prompt = homeDoorPrompt\(\{ door, mode: getInteractionMode\(\), price, declined: _homeDeclined\.has\(homeKeyOf\(bd\)\), asked: homeAsked, isBash \}\);\s*if \(prompt === 'menu'\) \{ openHomeOwnerMenu\(bd, home, hit, entries\); return true; \}\s*if \(prompt === 'offer'\) \{ openHomeOffer\(bd, price, hit, entries\); return true; \}/);
  assert.match(m, /const homeOnward = \(hit, entries\) => \(\) => \{ activateStaticDoor\(hit, entries, false, \{ homeAsked: true \}\)/, 'No and Go in come back to the door, past the menu');
  assert.match(m, /houseOwned: home !== null \|\| isHouseOwned\(/, 'no greeting from residents a home does not have');
  assert.match(m, /interiorHome = home;   \/\/ HOME1/);
  assert.match(m, /if \(home\?\.own\) addPermanentScene\(sceneCache\(\), homeSceneName\(homeTownOf\(building\), building\.buildingKey\)\);/, 'my home\'s scene is kept whichever page bought it');
  assert.equal((m.match(/(?<!let )interiorHome = null;/g) ?? []).length, 2, 'cleared at both teardowns');
  assert.match(m, /if \(interiorHome\?\.own\) return homeSceneName\(homeTownOf\(interiorBuilding\), key\);/);
  assert.match(m, /if \(c && interiorHome && !interiorHome\.own\) \{ say\(homeBelongsLine\(interiorHome\)\); return true; \}/);
  assert.match(m, /isHouseOwned: \(key\) => home !== null \|\| isHouseOwned\(/, 'any home has no residents');
  assert.match(m, /if \(!s\?\.locationKey \|\| !canon \|\| !interiorCtx \|\| s\.home\) return false;/, 'no claim from a home\'s cupboard');
  assert.match(m, /\+ \(!_intShared\.home && Array\.isArray\(data\.l\) \? applyInteriorLoot\(/, 'no peer\'s word on one');
  assert.match(m, /addPermanentScene\(sceneCache\(\), homeSceneName\(mapId, bd\.buildingKey\)\);/, 'a bought home\'s scene is kept');
  assert.match(m, /removePermanentScene\(sceneCache\(\), homeSceneName\(mapId, bd\.buildingKey\)\);/, 'a sold one\'s is not');
  assert.match(m, /displayName: home \? homeDoorTitle\(home\) : db\.displayName,/, 'the hover names it');
  assert.match(m, /onlineHomeLines: \(\) => \(host\.onlineHomes \? HOME_BANK_LINES : null\),/);
  const w = src('src/scenes/world.js');
  assert.match(w, /const onlineHomes = params\.has\('online'\)\s*\? createOnlineHomes\(/, 'online alone, and built before any quest can ask');
  assert.ok(w.indexOf('const onlineHomes = ') < w.indexOf('isPlayerHome: (mapId, buildingKey) => !!onlineHomes?.homeAt(mapId, buildingKey),'));
  assert.match(w, /townMapId: \(dfLoc\.mapTableData\?\.mapId \?\? 0\) >>> 0,/, 'the door\'s own town');
  assert.match(w, /onlineHomes\?\.ensure\(_musicLoc\?\.mapTableData\?\.mapId\);/, 'the town asked on arrival');
  assert.match(w, /partyNames: \(\) => \(social\?\.others\?\.\(\) \?\? \[\]\)\.map\(\(m\) => m\.name\)/);
  assert.match(src('src/systems/quest/place.js'), /if \(world\.isPlayerHome\?\.\(location\.mapTableData\?\.mapId, buildingKey\)\) continue;/);
});

test('HOME1 the door knows its house\'s model: the record a door resolves to carries the model its price is measured from - the SAME model the town\'s directory names for that building (the first 3D object of its subrecord) - so a house bought at its door costs what Daggerfall\'s bank asks for it (mutants: the model unread at the door)', () => {
  const dfBlock = {
    name: 'HOME1TST.RMB', index: 7,
    rmbBlock: {
      fldHeader: {
        numBlockDataRecords: 2, otherNames: null,
        buildingDataList: [
          { buildingType: BUILDING_TYPES.House1, quality: 10, factionId: 0, nameSeed: 1 },
          { buildingType: BUILDING_TYPES.House3, quality: 12, factionId: 0, nameSeed: 2 },
        ],
      },
      subRecords: [
        { exterior: { block3dObjectRecords: [{ modelId: '524', modelIdNum: 524 }, { modelIdNum: 9 }] } },
        { exterior: { block3dObjectRecords: [{ modelId: '600', modelIdNum: 600 }] } },
      ],
    },
  };
  const blocks = [{ dfBlock, x: 1, y: 2, originX: 0, originZ: 0 }];
  const bd = buildingDataForDoor([], blocks, { dfBlock, recordIndex: 1, position: [10, 0, 10] });
  assert.equal(bd.modelIdNum, 600, 'the door\'s record names its building\'s model');
  const listed = locationBuildings([], blocks).find((x) => x.buildingKey === bd.buildingKey);
  assert.equal(listed.modelIdNum, bd.modelIdNum, 'the directory\'s model for the same building - one price, at the bank and at the door');
  assert.equal(buildingDataForDoor([], blocks, { dfBlock, recordIndex: 0, position: [10, 0, 10] }).modelIdNum, 524, 'the FIRST object of the subrecord');
  assert.equal(housePrice(40), 51200, 'Daggerfall\'s price: the radius x 1280');
});
