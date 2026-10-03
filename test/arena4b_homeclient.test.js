// ARENA4b (2026-10-03, Mac: "Move them to a new house"): AN ONLINE HOME THE ARENA DISPLACED, MOVED BY ITS OWNER'S
// CLIENT - the pick (systems/arenaMove.js arenaHomeFor), the boot's moves (systems/onlineHomes.js moveArenaHomes) driven
// headless and over the real service (test/accountDb.mjs), the rooms a move carried as the client reads them
// (systems/homeRent.js), and the host's wiring in scenes/world.js by source.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { standService, T0, sessionStorageOf } from './accountDb.mjs';
import { seatRealm, realmAt } from './realmSeat.mjs';
import { arenaHomeFor, arenaHouseFor, emptyArenaScene, ARENA_CRATE_KEY } from '../src/systems/arenaMove.js';
import { moveArenaHomes, createOnlineHomes, homeSceneName, ARENA_MOVE_TRIES } from '../src/systems/onlineHomes.js';
import { homeRooms, rentRoomsView, rentNoneLine, homeBedIsMine } from '../src/systems/homeRent.js';
import { accountHomes, SESSION_KEY } from '../src/net/accountClient.js';
import { createSceneCache, cacheScene, restoreCachedScene } from '../src/systems/sceneCache.js';
import { ARENA_TEXT } from '../src/systems/arenaText.js';
import { BUILDING_TYPES } from '../src/world/buildingNames.js';
import { HOME_ARENA_MAP_ID } from '../src/net/homeLaw.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const DF = HOME_ARENA_MAP_ID;
const key = (x, y, r) => (x << 16) | (y << 8) | r;
const OLD = key(4, 3, 5);
const house = (x, y, r, t = BUILDING_TYPES.House2, extra = {}) => ({ buildingKey: key(x, y, r), buildingType: t, name: `House ${x}${y}${r}`, ...extra });
const CITY = [house(1, 1, 0), house(2, 5, 3), house(6, 2, 0, BUILDING_TYPES.House1), house(5, 6, 2), house(4, 3, 9), house(7, 7, 1, BUILDING_TYPES.Tavern)];

/** The old online home's scene in the owner's save: his lute standing in it, a ring in the chest, an apple on the floor. */
function savedScenes() {
  const scenes = createSceneCache();
  cacheScene(scenes, homeSceneName(DF, OLD), {
    decorOwn: { mine1: { name: 'Lute' } }, decor: [], hiddenBase: ['m1:41105'],
    lootContainers: [{ key: 'container:0', items: [{ name: 'Gold ring' }] }], droppedPiles: [{ pos: [0, 0, 0], items: [{ name: 'Apple' }] }], frame: 'building',
  });
  return scenes;
}
const hooksInto = (log) => ({
  giveOwn: (items) => log.own.push(...items), credit: (g) => log.gold.push(g), discover: (k, hall) => log.found.push(hall ? [k, 'hall'] : k),
  notice: (lines) => log.notice.push([...lines]), note: (t) => log.notes.push(t), say: (l) => log.said.push(l),
});
const newLog = () => ({ own: [], gold: [], found: [], notice: [], notes: [], said: [] });

test('ARENA4b the pick is the offline move\'s over the houses an online home may be: of the old type, outside the cell, never held - and never a guild\'s House2, which the offline fallback admits (mutants: the online filter dropped; held unread)', () => {
  const o = { mapId: DF, oldKey: OLD, oldType: BUILDING_TYPES.House2 };
  assert.deepEqual(arenaHomeFor(o, CITY), arenaHouseFor(o, CITY), 'the same pick where every house may be a home');
  const held = new Set(CITY.map((s) => s.buildingKey).filter((k) => k !== key(5, 6, 2)));
  assert.equal(arenaHomeFor(o, CITY, { held }).buildingKey, key(5, 6, 2), 'every key a home holds left out');
  const guild = [house(3, 3, 3, BUILDING_TYPES.House2, { factionId: 42 }), house(6, 2, 0, BUILDING_TYPES.House1)];
  assert.equal(arenaHouseFor(o, guild).buildingKey, key(3, 3, 3), 'offline, the guild\'s house is a House2 like any');
  assert.equal(arenaHomeFor(o, guild).buildingKey, key(6, 2, 0), 'online, never sold to one player - any house instead');
  assert.equal(arenaHomeFor(o, [house(4, 3, 1), house(7, 7, 1, BUILDING_TYPES.Tavern)]), null, 'nothing a home can be');
});

test('ARENA4b the boot\'s move, headless: the town read, my home in the cell picked and posted inside a realm act, the old scene emptied into the new INSIDE the act\'s apply - my things back, the chest\'s and the floor\'s in the new chest, the refund to the Daggerfall bank - the letter, the notebook, the lines, and the move said read; another character\'s home and one outside the cell untouched (mutants: emptied outside the act; the refund on a repeat; another character\'s moved; the letter unsaid)', async () => {
  const scenes = savedScenes();
  const town = new Map([
    [OLD, { buildingKey: OLD, mine: true, character: 'r-me' }],
    [key(4, 3, 6), { buildingKey: key(4, 3, 6), mine: true, character: 'r-other' }],
    [key(1, 1, 0), { buildingKey: key(1, 1, 0), mine: true, character: 'r-me' }],
    [key(2, 5, 3), { buildingKey: key(2, 5, 3), mine: false, character: null }],
  ]);
  const homes = { ensure: async () => true, homesIn: () => new Map(town) };
  const posted = [], seen = [], order = [];
  const api = {
    arenaMoves: async () => ({ ok: true, data: { moves: [] } }),
    arenaMove: async (b) => { posted.push(b); order.push('call'); return { ok: true, data: { ok: true, mapId: DF, from: b.from, to: b.to, refund: 700, pieces: 2, items: 1, tenancies: 1, withdrawn: 0, hidden: true, realm: { seq: 8 } } }; },
    arenaSeen: async (m, f) => { seen.push([m, f]); return { ok: true, data: { ok: true, seen: true } }; },
  };
  const log = newLog();
  const realm = { act: async (o) => { order.push('hold'); const r = await o.call({ id: 'r-me', lease: 'L', seq: 7 }); if (r.ok) { o.apply(r); order.push('applied'); } order.push('checkpoint'); return r; } };
  const out = await moveArenaHomes({
    homes, api, mapId: DF, character: 'r-me', realm,
    pick: (from, held) => arenaHomeFor({ mapId: DF, oldKey: from, oldType: BUILDING_TYPES.House2 }, CITY, { held }),
    nameOf: (k) => CITY.find((s) => s.buildingKey === k)?.name ?? '',
    emptyScene: (from, to) => { order.push('emptied'); return emptyArenaScene(scenes, homeSceneName(DF, from), homeSceneName(DF, to)); },
    hooks: hooksInto(log),
  });
  assert.equal(posted.length, 1, 'my home in the cell alone');
  const to = posted[0].to;
  assert.deepEqual([posted[0].from, posted[0].character, posted[0].realm], [OLD, 'r-me', { id: 'r-me', lease: 'L', seq: 7 }], 'the record named - the refund comes onto it');
  assert.ok(![...town.keys()].includes(to) && !(to >> 16 === 4 && ((to >> 8) & 255) === 3), 'a house nobody holds, outside the cell');
  assert.deepEqual(order, ['hold', 'call', 'emptied', 'applied', 'checkpoint'], 'emptied inside the act - its closing checkpoint holds it');
  assert.deepEqual(log.own, [{ name: 'Lute' }], 'my own thing back');
  assert.deepEqual(log.gold, [700], 'the pieces back whole, as the service paid the record');
  assert.equal(restoreCachedScene(scenes, homeSceneName(DF, OLD)), null, 'the old scene gone');
  const crate = restoreCachedScene(scenes, homeSceneName(DF, to)).lootContainers.find((c) => c.key === ARENA_CRATE_KEY);
  assert.deepEqual(crate.items.map((i) => i.name), ['Gold ring', 'Apple'], 'the chest\'s and the floor\'s in the new house\'s chest');
  assert.deepEqual(log.notice, [[...ARENA_TEXT.deedMoved]], 'the Daggerfall Bank\'s letter');
  assert.deepEqual(log.notes, [ARENA_TEXT.deedMovedNote.replace('%s', CITY.find((s) => s.buildingKey === to).name)]);
  assert.deepEqual(log.said, [ARENA_TEXT.homeMove.refund(700), ARENA_TEXT.homeMove.tenants(1)]);
  assert.deepEqual(log.found, [to]);
  assert.deepEqual(seen, [[DF, OLD]], 'the letter read');
  assert.deepEqual(out, [{ from: OLD, to, refund: 700, hall: false, made: true }]);
});

test('ARENA4b a house taken under the pick is picked again past it, a hall moves with no record and no gold to the keeper and is named nobody\'s residence, a move read again or answered as a repeat pays nothing, and is said read only once a checkpoint holds its emptied scene (mutants: the taken key not held; a hall\'s refund credited; a hall named a residence; read with the checkpoint refused; an unread move credited; a repeat credited)', async () => {
  // taken: the first house answered somebody's - the town's answer not caught up yet - and the next pick goes past it
  const town = new Map([[OLD, { buildingKey: OLD, mine: true, character: 'r-me' }]]);
  const homes = { ensure: async () => true, homesIn: () => new Map(town) };
  const posted = [];
  const api = {
    arenaMoves: async () => ({ ok: true, data: { moves: [] } }),
    arenaMove: async (b) => {
      posted.push(b.to);
      if (posted.length === 1) return { ok: false, error: 'home-taken' };
      return { ok: true, data: { from: b.from, to: b.to, refund: 0 } };
    },
    arenaSeen: async () => ({ ok: true, data: { seen: true } }),
  };
  const picks = [];
  const pick = (from, held) => { picks.push(new Set(held)); return arenaHomeFor({ mapId: DF, oldKey: from, oldType: BUILDING_TYPES.House2 }, CITY, { held }); };
  const log = newLog();
  await moveArenaHomes({ homes, api, mapId: DF, character: 'r-me', pick, emptyScene: () => null, hooks: hooksInto(log) });
  assert.equal(posted.length, 2);
  assert.notEqual(posted[1], posted[0]);
  assert.ok(picks[1].has(posted[0]), 'the taken house held');
  assert.ok(ARENA_MOVE_TRIES >= 2);
  // a move posted again answers the first (`repeat`): the act moved no record, so nothing is credited again
  const rlog = newLog();
  await moveArenaHomes({
    homes, mapId: DF, character: 'r-me', pick, emptyScene: () => null, hooks: hooksInto(rlog),
    api: { ...api, arenaMove: async (b) => ({ ok: true, data: { from: b.from, to: b.to, refund: 700, repeat: true } }) },
    realm: { act: async (o) => { const r = await o.call({ id: 'r-me', lease: 'L', seq: 9 }); if (r.ok) o.apply(r); return r; } },
  });
  assert.deepEqual(rlog.gold, [], 'a repeat pays nothing - its first move did');
  assert.deepEqual(rlog.said, [], 'nor says a refund');
  // a hall: the keeper's client posts it with no record, and no gold comes to the keeper
  const hallTown = new Map([[OLD, { buildingKey: OLD, mine: false, hall: { name: 'The Silver Hand' }, keeper: true }]]);
  const hposted = [];
  const hlog = newLog();
  let acted = false;
  await moveArenaHomes({
    homes: { ensure: async () => true, homesIn: () => new Map(hallTown) }, mapId: DF, character: 'r-me', pick,
    api: { ...api, arenaMove: async (b) => { hposted.push(b); return { ok: true, data: { from: b.from, to: b.to, refund: 450, hall: true } }; } },
    realm: { act: async () => { acted = true; return { ok: false }; } }, emptyScene: () => null, hooks: hooksInto(hlog),
  });
  assert.equal(acted, false, 'a hall\'s move is no realm act');
  assert.equal(hposted[0].realm, undefined);
  assert.deepEqual(hlog.gold, [], 'the treasury took it - not the keeper');
  assert.deepEqual(hlog.notice, [[...ARENA_TEXT.homeMove.hallMoved]], 'the hall\'s own letter');
  assert.deepEqual(hlog.found, [[hposted[0].to, 'hall']], 'found, and named nobody\'s residence');
  // a move made before and never read: emptied again, said, read - never paid again
  const scenes = savedScenes();
  const ulog = newLog();
  const useen = [];
  const unreadApi = { arenaMoves: async () => ({ ok: true, data: { moves: [{ mapId: DF, from: OLD, to: key(5, 6, 2), refund: 700, movedAt: T0 }] } }), arenaMove: async () => assert.fail('nothing to post'), arenaSeen: async (m, f) => { useen.push(f); return { ok: true }; } };
  // emptied outside any act: said read only once a checkpoint holds the emptied scene - a refused one leaves it unread,
  // and the next boot empties the record's old scene again
  await moveArenaHomes({
    homes: { ensure: async () => true, homesIn: () => new Map() }, mapId: DF, character: 'r-me', pick, api: unreadApi,
    emptyScene: () => null, hooks: { ...hooksInto(newLog()), checkpoint: () => false },
  });
  assert.deepEqual(useen, [], 'a checkpoint refused: unread');
  const out = await moveArenaHomes({
    homes: { ensure: async () => true, homesIn: () => new Map() }, mapId: DF, character: 'r-me', pick, api: unreadApi,
    emptyScene: (from, to) => emptyArenaScene(scenes, homeSceneName(DF, from), homeSceneName(DF, to)),
    hooks: { ...hooksInto(ulog), checkpoint: () => { assert.equal(restoreCachedScene(scenes, homeSceneName(DF, OLD)), null, 'the save written with the old scene emptied'); useen.push('saved'); return true; } },
  });
  assert.deepEqual(ulog.gold, [], 'the move\'s batch paid the record the join read');
  assert.deepEqual(ulog.own, [{ name: 'Lute' }], 'the old scene emptied now');
  assert.deepEqual(ulog.said, [], 'no refund said again');
  assert.deepEqual(useen, ['saved', OLD], 'the save written, then the move read');
  assert.deepEqual(out.map((m) => m.made), [false]);
});

test('ARENA4b the boot\'s move over the real service: the client\'s calls are the routes\' own shapes - the row moved to the house this client picked, the record paid in the act, the scene emptied, the move read; a second boot finds nothing (mutants: the call\'s body misnamed; the seen route unasked)', async (t) => {
  t.mock.method(Date, 'now', () => T0 * 1000);
  const S = await standService();
  const raw = S.env.DB._raw;
  const owner = await S.registered('Aldric');
  const R = await seatRealm(S.env, owner.secret, 'Aldric', { name: 'Aldric', level: 9, goldPieces: 500, items: [], bankAccounts: new Array(62).fill(0).map(() => ({ accountGold: 0 })) });
  raw.prepare(`INSERT INTO homes (map_id, building_key, player, char_id, owner_name, region, entry, price, bought_at, paid) VALUES (?, ?, ?, ?, 'Aldric', 17, 'private', 42000, ?, 42000)`).run(DF, OLD, owner.id, R.id, T0 - 100);
  raw.prepare(`INSERT INTO home_decor (map_id, building_key, id, model, place, placed_at, paid, yard) VALUES (?, ?, 'bench1', 41000, '{}', ?, 640, 0)`).run(DF, OLD, T0);
  const api = accountHomes({ fetch: S.fetch, storage: sessionStorageOf(SESSION_KEY, owner) });
  const homes = createOnlineHomes({ api, character: () => R.id });
  const realm = { act: async (o) => { const r = await o.call(realmAt(S.env, R.id)); if (r?.ok) o.apply?.(r); return r; } };
  const scenes = savedScenes();
  const log = newLog();
  const boot = () => moveArenaHomes({
    homes, api, mapId: DF, character: R.id, realm,
    pick: (from, held) => arenaHomeFor({ mapId: DF, oldKey: from, oldType: BUILDING_TYPES.House2 }, CITY, { held }),
    emptyScene: (from, to) => emptyArenaScene(scenes, homeSceneName(DF, from), homeSceneName(DF, to)), hooks: hooksInto(log),
  });
  const out = await boot();
  assert.equal(out.length, 1, JSON.stringify(out));
  const to = out[0].to;
  assert.equal(raw.prepare('SELECT char_id FROM homes WHERE map_id = ? AND building_key = ?').get(DF, to).char_id, R.id, 'the row at the picked house');
  assert.deepEqual(log.gold, [640]);
  assert.deepEqual(log.own, [{ name: 'Lute' }]);
  assert.ok(raw.prepare('SELECT seen_at FROM home_moves WHERE old_key = ?').get(OLD).seen_at > 0, 'read');
  assert.equal(homes.homeAt(DF, to)?.own ?? (await homes.ensure(DF, { force: true }), homes.homeAt(DF, to)?.own), true, 'the door says mine');
  assert.deepEqual(await boot(), [], 'nothing left to move or read');
});

test('ARENA4b a room the move carried, as the client reads it: kept with no point and `moved`, listed apart in the owner\'s panel in the arena\'s words, its tenant told it runs out, its tenant\'s bed still theirs (mutants: the moved room dropped; the pointless offer matched to a room)', async () => {
  const api = { rooms: async () => ({ ok: true, data: { mine: true, owner: 'Aldric', now: 100, due: 0, rooms: [
    { room: 1, anchor: null, moved: true, price: 40, listed: false, taken: true, yours: true, until: 100 + 86400, tenant: 'Bran' },
    { room: 2, anchor: null, price: 40, listed: true, taken: false },
    { room: 3, anchor: [1, 0, 1], price: 50, listed: true, taken: false },
  ] } }) };
  const got = await homeRooms(api, DF, key(5, 6, 2), 'r-bran');
  assert.deepEqual(got.rooms.map((r) => [r.room, r.anchor, r.moved ?? false]), [[1, null, true], [3, [1, 0, 1], false]], 'the carried room kept, a pointless one the service never said moved dropped');
  let asked = 0;
  const rows = rentRoomsView([{ id: 1, name: 'Hall', eye: [1, 0, 1] }], got.rooms, (p) => { asked++; return p[0] === 1 ? { id: 1 } : null; }, [0, 0, 0]);
  assert.equal(rows.find((r) => r.offer?.room === 3).id, 1, 'a room with a point stands in its walls');
  const moved = rows.find((r) => r.offer?.room === 1);
  assert.deepEqual([moved.id, moved.name, moved.offerable], [null, ARENA_TEXT.homeMove.roomMoved(1), false], 'the carried room apart, in the arena\'s words');
  assert.ok(asked >= 1);
  assert.match(rentNoneLine(got.rooms, 100), /Room 1 is no longer offered/, 'its tenant: it runs out, never renewed');
  assert.equal(homeBedIsMine({ tenant: 100 + 86400 }, 100), true, 'the bed reads the tenancy, never the point');
});

test('ARENA4b the host: world.js moves the online homes once a boot, after the homes\' towns land and the world stands - picked by arenaHomeFor in the city as it stands, emptied by emptyArenaScene from the old OnlineHome scene into the new, inside the realm\'s act; offline unchanged (mutants: the call dropped from the landing; the checkpoint unhanded; the flag declared after the boot\'s first landing)', () => {
  const w = read('src/scenes/world.js');
  const landing = w.slice(w.indexOf('function takeHomeLayouts('), w.indexOf('function askHomeLayoutsAgain('));
  assert.ok(/_homeLayoutsApplied = true;[\s\S]{0,300}void moveArenaHomesOnline\(\);/.test(landing), 'after the pins stand - the town in its homes\' layout');
  assert.ok(w.indexOf('let _arenaHomesAsked = false;') < w.indexOf('const landing = takeHomeLayouts(heard);'), 'the flag stands before the boot\'s first landing reads it');
  const fn = w.slice(w.indexOf('async function moveArenaHomesOnline('), w.indexOf('async function moveArenaHomesOnline(') + 4000);
  assert.ok(fn.includes('!(playerSpawned && modes)'), 'once the world stands - its checkpoint can write');
  assert.ok(fn.includes('arenaHomeFor({ mapId: now.mapId, oldKey: from, oldType: now.oldTypeOf(from) }, now.summaries'), 'the offline rule over the city as it stands');
  assert.ok(fn.includes('emptyArenaScene(scenes, homeSceneName(now.mapId, from), homeSceneName(now.mapId, to))'), 'the online home\'s own scene');
  assert.ok(fn.includes('realmGoldAct({ ...o, session: realmSession, checkpoint: () => onlineCheckpoint() })'), 'inside the realm\'s act');
  assert.ok(fn.includes('credit: arenaRefund') && fn.includes('giveOwn: arenaGiveOwn'), 'the offline move\'s own doors');
  assert.ok(fn.includes('checkpoint: () => onlineCheckpoint(),   // the emptied scene in the save'), 'the save written before a move is said read');
  assert.ok(/if \(!homeLayoutsOnline\) moveArenaDeed\(\);/.test(w), 'offline, the deed\'s move as before');
});
