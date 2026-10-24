// WITCH1 (2026-10-20, bible/06-Systems/Witches-Festival.md): THE WITCHES' FESTIVAL ON THIS PAGE (src/systems/festival/
// festivalClient.js) - the finds a kill of mine and an act ask for, the pack restacked to the service's counts (its cakes
// and its bowls), a sale kept on the save until its answer lands and minted once whatever asks overlap, kept under the
// account that made it, the reason a guest is told, and nothing asked at all while the festival is not live here.
import { test, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import {
  bindFestival, askFind, festivalLive, festivalShut, festivalState, buyWare, pendingSale, refreshFestival, offeringMove, saleRid, wareItem,
  festivalQuestEnded, festivalBountyPaid, FESTIVAL_FIND, SALE_FINAL, _resetFestivalClientForTests,
} from '../../../src/systems/festival/festivalClient.js';
import { isSoulCake, isHearthOffering, soulCakesHeld, hearthOffering, restackSoulCakes, restackHearthOfferings, soulCakes, foldStrayFaces } from '../../../src/systems/festival/soulCake.js';
import { reportPlayerKill } from '../../../src/systems/playerKills.js';
import { isPackOnly, isBound } from '../../../src/systems/item/itemBound.js';
import { noteAct } from '../../../src/systems/questlines/qlActs.js';
import { SESSION_KEY, adoptIdentity } from '../../../src/net/accountClient.js';
import { ownIcon } from '../../../src/systems/ownGlyphs.js';
import { FESTIVALS, wareById } from '../../../src/net/festivalLaw.js';
import { isIliacCard } from '../../../src/systems/iliac/iliacItems.js';
import { MOBILE_TYPES } from '../../../src/characters/mobile/mobileTypes.js';

const store = new Map();
const mem = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => { store.set(k, String(v)); }, removeItem: (k) => { store.delete(k); } };
const seat = (kind = 'linked') => store.set(SESSION_KEY, JSON.stringify({ secret: 'sekrit', id: 'acct-alice', name: 'Alice', kind }));

/** A service door that answers as the test says, and keeps every ask. */
function fakeApi(answers = {}) {
  const asked = [];
  const door = (name) => async (...a) => { asked.push([name, ...a]); const r = answers[name]; return typeof r === 'function' ? r(...a) : r ?? { ok: false, error: 'offline' }; };
  return { asked, api: { ...Object.fromEntries(['mine', 'find', 'buy', 'town', 'set', 'fill', 'takeIn', 'take'].map((n) => [n, door(n)])), me: () => JSON.parse(store.get(SESSION_KEY) ?? 'null')?.id ?? null } };
}
let entity, saved, said;
const bind = (api, online = true) => bindFestival({ online: () => online, entity: () => entity, say: (l) => said.push(l), selfId: () => 'me', saved: () => { saved++; }, api });

beforeEach(() => {
  globalThis.localStorage = mem;
  store.clear();
  seat();
  mock.timers.enable({ apis: ['Date'], now: FESTIVALS[0].fromMs + 3600_000 });
  _resetFestivalClientForTests();
  entity = { isPlayer: true, items: [] };
  saved = 0;
  said = [];
});
afterEach(() => { mock.timers.reset(); _resetFestivalClientForTests(); delete globalThis.localStorage; });

test('WITCH1 NOT LIVE, NOTHING ASKED - AND SAID WHY: unbound or offline (`offline`), a guest\'s session (`guest`), outside the days or shut by the service (`closed`)', async () => {
  assert.equal(festivalShut(), 'offline', 'unbound');
  const { api, asked } = fakeApi({ find: { ok: true, data: { found: 1, cakes: 1 } }, mine: { ok: true, data: { cakes: 0, open: false } } });
  bind(api, false);
  assert.equal(await askFind('foe'), 0);
  bind(api, true);
  assert.equal(festivalLive(), true);
  seat('guest');
  assert.equal(festivalShut(), 'guest', 'a guest\'s cakes would be a cleared browser\'s');
  assert.deepEqual([(await buyWare('card:warlock')).text, (await offeringMove('take', { mapId: 1, buildingKey: 2 })).text], ['Link an account to keep Soul Cakes.', 'Link an account to keep Soul Cakes.'], 'a guest is told so, never that the festival is over (AUDIT WITCH1 F-M1)');
  seat();
  await refreshFestival();
  assert.equal(festivalShut(), 'closed', 'the service said it is shut for this account (FESTIVAL_OPEN)');
  _resetFestivalClientForTests();
  bind(api, true);
  mock.timers.setTime(FESTIVALS[0].toMs);
  assert.equal(festivalShut(), 'closed', 'the days are over');
  assert.equal(await askFind('foe'), 0);
  assert.deepEqual(asked.filter(([n]) => n === 'find'), []);
});

test('WITCH1 A KILL\'S FIND: my own blow\'s kill (every pool\'s word, playerKills.js) asks by the foe\'s kind, once a body; the cakes land in the pack, the count\'s face; the watch, an ally and a world boss\'s body never (AUDIT WITCH1 C1; AUDIT STARFALL: the master\'s find is its held star\'s)', async () => {
  const { api, asked } = fakeApi({ mine: { ok: true, data: { cakes: 3 } }, find: () => ({ ok: true, data: { found: 2, cakes: 5 } }) });
  bind(api);
  await refreshFestival();
  assert.equal(soulCakesHeld(entity.items), 3, 'the pack is the count\'s face');
  const skeleton = { mobileType: MOBILE_TYPES.SkeletalWarrior, items: [] };
  reportPlayerKill(skeleton, { kind: 'melee' });
  reportPlayerKill(skeleton, { kind: 'remote' });   // a body asks once, whichever pool says it
  reportPlayerKill({ mobileType: MOBILE_TYPES.Knight_CityWatch, items: [] }, {});   // the watch never pays
  reportPlayerKill({ mobileType: 1001, items: [], team: 'PlayerAlly' }, {});   // nor my own ally
  reportPlayerKill({ mobileType: MOBILE_TYPES.Lich, items: [], eliteFoe: true, worldBoss: true }, {});   // a Starfall's master: its held star is its find
  await askFind('world');   // the queue drains in order
  assert.deepEqual(asked.filter(([n]) => n === 'find').map(([, s]) => s), ['undead', 'world'], 'the dead walk: the skeleton\'s find is the undead\'s; a world boss\'s body asks none');
  assert.equal(skeleton.items.length, 0, 'nothing thrown on a body - a face there is one the count cannot see');
  assert.equal(soulCakesHeld(entity.items), 5, 'the pack is the count');
  assert.ok(said.some((l) => /\+2 Soul Cakes/.test(l)));
  assert.equal(festivalState().cakes, 5);
});

test('WITCH1 AN ACT, A QUEST AND A BOUNTY ask by their group: a fish caught is `gather`, a quest done and a bounty paid `world`; ONE DEED, ONE FIND - the acts one receipt says together ask once, an elite foe\'s act never beside its kill (AUDIT WITCH1 C10)', async () => {
  const { api, asked } = fakeApi({ find: { ok: true, data: { found: 0, cakes: 0 } } });
  bind(api);
  noteAct('fish-caught');
  festivalQuestEnded({ questSuccess: false });   // a failed quest finds nothing
  festivalQuestEnded({ questSuccess: true });
  await festivalBountyPaid();
  assert.deepEqual(asked.filter(([n]) => n === 'find').map(([, s]) => s), ['gather', 'world', 'world']);
  asked.length = 0;
  noteAct('breach-closed'); noteAct('rite-broken');   // one receipt, two acts (net/gate/gateClaims.js)
  await new Promise((r) => setTimeout(r, 0));
  noteAct('elite-foe-slain');   // its kill already asked its own
  await new Promise((r) => setTimeout(r, 0));
  noteAct('redoubt-taken');   // a later deed: its own find
  await askFind('world');
  assert.deepEqual(asked.filter(([n]) => n === 'find').map(([, s]) => s), ['endgame', 'endgame', 'world']);
  assert.equal(FESTIVAL_FIND, 'festival-find');
});

test('AUDIT STAR8 T1 A WYRD SISTER\'S WINDOW OPENED IS NO FIND: `wyrd-met` (The Thirteenth of Frostfall\'s letter waits on it) asks nothing, where a deed of its family asks its own (mutants: the window a find)', async () => {
  const { api, asked } = fakeApi({ find: { ok: true, data: { found: 0, cakes: 0 } } });
  bind(api);
  noteAct('wyrd-met');
  await new Promise((r) => setTimeout(r, 0));
  noteAct('raid-repelled');   // the world's family, a deed
  await askFind('sea');   // the queue drains in order
  assert.deepEqual(asked.filter(([n]) => n === 'find').map(([, s]) => s), ['world', 'sea']);
});

test('WITCH1 A SALE: asked by its own id, the piece minted on the answer; a lost answer (no line, or the service\'s fault) kept on the save and asked again by the same id, landing once', async () => {
  const sold = new Map();
  const buy = (ware, rid) => {
    if (sold.has(rid)) return { ok: true, data: { repeat: true, ware, cakes: 0, wares: [] } };
    sold.set(rid, ware);
    return { ok: true, data: { ware, cakes: 0, wares: [] } };
  };
  let lose = ['offline', 'server'];
  const { api, asked } = fakeApi({ buy: (ware, rid) => { const r = buy(ware, rid); const e = lose.shift(); return e ? { ok: false, error: e } : r; }, mine: { ok: true, data: { cakes: 0 } } });
  bind(api);
  const r = await buyWare('card:warlock');
  assert.equal(r.ok, false, 'the answer was lost');
  const rid = pendingSale()?.rid;
  assert.match(rid, /^[0-9a-f]{12}$/);
  assert.equal(pendingSale().account, 'acct-alice', 'kept under the account that made it');
  assert.equal(entity.items.filter(isIliacCard).length, 0, 'nothing minted on no answer');
  await refreshFestival();
  assert.equal(pendingSale()?.rid, rid, 'the service\'s fault says nothing of the sale: still kept (AUDIT WITCH1 C3)');
  await refreshFestival();
  assert.equal(pendingSale(), null, 'answered');
  assert.equal(entity.items.filter(isIliacCard).length, 1, 'minted once');
  assert.deepEqual(asked.filter(([n]) => n === 'buy').map(([, , id]) => id), [rid, rid, rid], 'the same id asked again');
  // a refusal that says the sale never happened lets it go and says why
  for (const final of SALE_FINAL) assert.ok(['ware', 'rid', 'owned', 'cakes', 'closed', 'rate'].includes(final));
  const { api: api2 } = fakeApi({ buy: { ok: false, error: 'cakes', cakes: 3 } });
  bind(api2);
  const no = await buyWare('piece:wyrd-athame');
  assert.deepEqual([no.ok, no.text], [false, 'You need more Soul Cakes.']);
  assert.equal(pendingSale(), null);
  assert.equal(festivalState().cakes, 3, 'the refusal\'s count learned');
  assert.equal((await buyWare('nothing')).text, 'The Wyrd Sister has no such thing.');
});

test('WITCH1 ONE SALE, ONE PIECE: the window\'s refresh lands while the buy is out - one ask in flight, and only the answer to the sale still pending mints (AUDIT WITCH1 C2/E1)', async () => {
  let release;
  const gate = new Promise((r) => { release = r; });
  const sold = new Set();
  const { api, asked } = fakeApi({
    buy: async (ware, rid) => { await gate; const repeat = sold.has(rid); sold.add(rid); return { ok: true, data: { ...(repeat ? { repeat } : {}), ware, cakes: 0, wares: [] } }; },
    mine: { ok: true, data: { cakes: 20 } },
  });
  bind(api);
  const buying = buyWare('piece:wyrd-athame');
  const refreshes = [refreshFestival(), refreshFestival()];   // the window opened twice while the answer is out
  await new Promise((r) => setTimeout(r, 0));
  release();
  await Promise.all([buying, ...refreshes]);
  assert.equal(asked.filter(([n]) => n === 'buy').length, 1, 'one ask of the sale in flight');
  const athames = entity.items.filter((it) => it.aetheric === 'wyrd-athame');
  assert.equal(athames.length, 1, 'one piece for one sale');
  assert.equal(isBound(athames[0]), true, 'bound to its buyer, as the Sigil Broker\'s are (AUDIT WITCH1 F-M2)');
  assert.equal(pendingSale(), null);
});

test('WITCH1 A KEPT SALE IS ITS ACCOUNT\'S: another account signed in on the device never asks it (it would be a new sale, charged to them) - its own asks it again (AUDIT WITCH1 C3/A9)', async () => {
  let up = false;
  const { api, asked } = fakeApi({ buy: () => (up ? { ok: true, data: { repeat: true, ware: 'card:warlock', cakes: 0, wares: [] } } : { ok: false, error: 'offline' }), mine: { ok: true, data: { cakes: 0 } } });
  bind(api);
  await buyWare('card:warlock');
  const kept = pendingSale();
  assert.ok(kept);
  up = true;
  store.set(SESSION_KEY, JSON.stringify({ secret: 'other', id: 'acct-bob', name: 'Bob', kind: 'linked' }));
  await refreshFestival();
  assert.equal(asked.filter(([n]) => n === 'buy').length, 1, 'not asked under Bob');
  assert.equal(pendingSale(), kept);
  seat();
  await refreshFestival();
  assert.equal(pendingSale(), null);
  assert.equal(entity.items.filter(isIliacCard).length, 1);
});

test('WITCH1 THE WARES\' PIECES: a set piece (bound), a card - an account ware and the Hearth Offering mint nothing, the service holds them', () => {
  assert.equal(wareItem(wareById('title:witchwarden')), null);
  assert.equal(wareItem(wareById('icon:twinmoons')), null);
  assert.equal(wareItem(wareById('item:offering')), null, 'a bowl is the account\'s count');
  assert.equal(wareItem(wareById('piece:wyrd-athame'))?.aetheric, 'wyrd-athame');
  assert.equal(isBound(wareItem(wareById('piece:wyrd-robe'))), true);
  assert.equal(isIliacCard(wareItem(wareById('card:spectre-of-lysandus'))), true);
  let i = 0;
  assert.equal(saleRid(() => [0.0, 0.99, 0.5][i++ % 3]), '0f80f80f80f8');
});

test('WITCH1 THE OFFERING\'S BOWLS: the pack\'s Hearth Offerings are the account\'s bowls - set out, the answer\'s count; taken in, the same; a refusal\'s count learned too', async () => {
  const { api } = fakeApi({
    set: { ok: true, data: { ok: true, stock: 0, bowls: 1 } },
    takeIn: { ok: true, data: { ok: true, returned: 4, cakes: 4, bowls: 2 } },
    mine: { ok: true, data: { cakes: 4, bowls: 2 } },
  });
  bind(api);
  const at = { mapId: 1, buildingKey: 2, character: 'char-a' };
  assert.equal((await offeringMove('set', at)).text, 'You have no Hearth Offering.');
  restackHearthOfferings(entity.items, 2);
  assert.equal((await offeringMove('set', at)).ok, true);
  assert.equal(entity.items.find(isHearthOffering).stackCount, 1, 'one set out');
  assert.equal((await offeringMove('takeIn', at)).ok, true);
  assert.equal(entity.items.find(isHearthOffering).stackCount, 2, 'back in the pack');
  assert.equal(soulCakesHeld(entity.items), 4);
  // a refusal carries the count: the service holds no bowl, so the pack shows none
  const { api: api2 } = fakeApi({ set: { ok: false, error: 'item', bowls: 0 }, take: { ok: false, error: 'none' } });
  bind(api2);
  assert.equal((await offeringMove('set', at)).text, 'You have no Hearth Offering.');
  assert.equal(entity.items.some(isHearthOffering), false);
  assert.equal((await offeringMove('take', at)).text, 'This offering has been taken in.');
});

test('WITCH1 THE ICON WORN IS KEPT ON THE DEVICE\'S SESSION: this device\'s own corner mark wears it (ownGlyphs.js ownIcon), and the face again once it is taken off (AUDIT WITCH1 B2)', () => {
  assert.equal(adoptIdentity(mem, { icon: 'twinmoons' }), true);
  assert.equal(ownIcon(mem), 'twinmoons');
  assert.equal(adoptIdentity(mem, { icon: 'twinmoons' }), false, 'the same again writes nothing (a write is a storage event every tab hears)');
  adoptIdentity(mem, { icon: null });
  assert.equal(ownIcon(mem), null);
});

test('WITCH1 THE FACES NEVER LEAVE THE PACK: the rows pack-only, and one a save holds anywhere else folded away at load (KEY-FACE\'s law, AUDIT WITCH1 B3)', () => {
  assert.equal(isPackOnly(soulCakes(3)), true);
  assert.equal(isPackOnly(hearthOffering()), true);
  const wagon = [soulCakes(5), { templateIndex: 1, group: 'Weapons' }], chest = [hearthOffering(2)];
  const room = { a: soulCakes(1), b: { templateIndex: 1, group: 'Weapons' } };
  assert.equal(foldStrayFaces([wagon, chest], [room]), 8);
  assert.deepEqual([wagon.length, chest.length, Object.keys(room)], [1, 0, ['b']]);
});

test('WITCH1 THE RESTACK: the pack\'s Soul Cakes one stack of the count, or none', () => {
  const items = [soulCakes(2), soulCakes(1), { templateIndex: 1, group: 'Weapons' }];
  assert.equal(restackSoulCakes(items, 7), true);
  assert.equal(items.filter(isSoulCake).length, 1);
  assert.equal(soulCakesHeld(items), 7);
  assert.equal(restackSoulCakes(items, 7), false, 'already the count');
  assert.equal(restackSoulCakes(items, 0), true);
  assert.equal(soulCakesHeld(items), 0);
  assert.equal(items.length, 1);
  assert.equal(restackSoulCakes(items, -1), false);
});

test('WITCH1 THE STATE IS ITS ACCOUNT\'S: unheard, every count unknown (never a known nought); heard, the account\'s; another account signed in hears none of it until its own answer (AUDIT WITCH1 G2)', async () => {
  const alice = { ok: true, data: { cakes: 7, bowls: 1, wares: ['title:witchwarden'], given: 4, taken: 2, offerings: [], open: true } };
  const { api } = fakeApi({ mine: () => (api.me() === 'acct-bob' ? { ok: true, data: { cakes: 2 } } : alice) });
  assert.deepEqual([festivalState().cakes, festivalState().given, festivalState().taken], [null, null, null], 'unheard');
  bind(api);
  await refreshFestival();
  assert.deepEqual([festivalState().cakes, festivalState().given, festivalState().taken, festivalState().wares], [7, 4, 2, ['title:witchwarden']]);
  store.set(SESSION_KEY, JSON.stringify({ secret: 'other', id: 'acct-bob', name: 'Bob', kind: 'linked' }));
  assert.deepEqual([festivalState().cakes, festivalState().given, festivalState().wares], [null, null, []], 'Bob is told nothing of Alice\'s');
  await refreshFestival();
  assert.deepEqual([festivalState().cakes, festivalState().given, festivalState().wares], [2, null, []], 'his own answer heard - none of hers under it');
  seat();
  assert.equal(festivalState().cakes, null, 'and Alice back hears nothing of his');
});
