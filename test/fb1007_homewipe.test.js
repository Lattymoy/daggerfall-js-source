// FIELD BUGS 2026-10-07 HOME-WIPE and CRATE-LAYOUT (the Discord, Cruor: "Home storage randomly disappeared? ... all the
// stuff I kept in them seems to have disappeared!", an hour later "Still empty ... it ate a bunch of
// aetherics/legendaries"): A HOME THE ARENA MOVED KEEPS WHAT ITS OWNER PUT IN IT. moveArenaHomes empties every move it
// has not heard read again at each boot (systems/onlineHomes.js, "harmless: a scene emptied once is gone"), and a read
// lost to a refused checkpoint or a failed `arena-seen` - the account service's overloads of 2026-10-06 - left the move
// unread. With the old scene long gone, emptyArenaScene cached an empty record over the new home's own: its chests, its
// storage pieces, its owner's own things and its floor; and the boot's checkpoint wrote that to the realm. And the
// record a move makes was never stamped with its town's layout, so a city standing in Beautiful Cities held the crate
// back from its owner (worldModes.js restoreInteriorScene). Driven through the real moveArenaHomes, emptyArenaScene and
// moveArenaRecords over the real scene cache and the save's own round trip; the online host by source.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { emptyArenaScene, moveArenaRecords, ARENA_CRATE_KEY } from '../src/systems/arenaMove.js';
import { moveArenaHomes, homeSceneName } from '../src/systems/onlineHomes.js';
import { createSceneCache, cacheScene, addPermanentScene, interiorSceneName, snapshotSceneCache, restoreSceneCache, restoreCachedScene } from '../src/systems/sceneCache.js';
import { layoutsMatch } from '../src/systems/layoutPins.js';
import { arenaRecordDisplaced, ARENA_LOCATION_KEY, ARENA_REGION } from '../src/world/arenaCity.js';
import { createHouses } from '../src/systems/banking.js';
import { makeBuildingKey } from '../src/systems/talkTopics.js';
import { BUILDING_TYPES } from '../src/world/buildingNames.js';
import { HOME_ARENA_MAP_ID } from '../src/net/homeLaw.js';

const rd = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const DF = HOME_ARENA_MAP_ID;
const OLD = makeBuildingKey(4, 3, 5), NEW = makeBuildingKey(5, 6, 2);
const BC = 'beautiful-cities@0.5.0';
const names = (list) => (list ?? []).map((it) => it.name);
const saveOf = (scenes) => JSON.stringify(snapshotSceneCache(scenes));

/** The new home as its owner keeps it, long after the move: what the crate brought and what they put in it since. */
const lived = () => ({
  lootContainers: [
    { key: 'container:0', items: [{ name: 'Aetheric Cuirass', rarity: 'aetheric' }, { name: 'Legendary Katana', rarity: 'legendary' }], stockedDate: 1 },
    { key: 'container:2', items: [{ name: 'Ebony Dagger' }], stockedDate: 1, openedOn: 0 },
  ],
  decorItems: { chest7: [{ name: 'Ring of the Wild Hunt', rarity: 'legendary' }] },
  decorOwn: { lute1: { name: 'Lute' } },
  droppedPiles: [{ pos: [1, 0, 1], items: [{ name: 'Apple' }] }],
  hiddenBase: ['m1:41105'],
  frame: 'building',
  layout: BC,
});

test('HOME-WIPE the field\'s sequence: a move whose read was lost twice, emptied again at each boot - every save those boots wrote holds the new home whole, its chests, its storage piece, its owner\'s lute and its floor, and the visit after finds them (mutants: the owner\'s record written over; nothing carried still touches it)', async () => {
  const scenes = createSceneCache();
  const home = homeSceneName(DF, NEW);
  cacheScene(scenes, home, lived());
  addPermanentScene(scenes, home);
  const saved = saveOf(scenes);
  let asks = 0, emptied = 0;
  const read = [];
  const api = {
    arenaMoves: async () => ({ ok: true, data: { moves: read.length ? [] : [{ mapId: DF, from: OLD, to: NEW, refund: 0, movedAt: 1 }] } }),
    arenaMove: async () => assert.fail('nothing to post - the home stands outside the cell'),
    // the overload: the first two reads never land
    arenaSeen: async (m, f) => { asks++; if (asks < 3) return { ok: false, error: 'server' }; read.push([m, f]); return { ok: true, data: { seen: true } }; },
  };
  const written = [];
  const boot = () => moveArenaHomes({
    homes: { ensure: async () => true, homesIn: () => new Map() }, api, mapId: DF, character: 'r-me', pick: () => null,
    emptyScene: (from, to) => { emptied++; return emptyArenaScene(scenes, homeSceneName(DF, from), homeSceneName(DF, to), { layout: BC }); },
    hooks: { checkpoint: () => { written.push(saveOf(scenes)); return true; } },
  });
  for (let i = 0; i < 4; i++) await boot();
  assert.deepEqual([emptied, asks, read], [3, 3, [[DF, OLD]]], 'emptied again at each boot until a read landed, and never after');
  assert.equal(written.length, 3, 'each of those boots wrote its save');
  for (const w of written) assert.equal(w, saved, 'every save the replay wrote holds the new home as its owner left it');
  assert.equal(saveOf(scenes), saved);
  const visit = restoreCachedScene(scenes, home);
  assert.deepEqual(visit.lootContainers.map((c) => [c.key, names(c.items)]), [['container:0', ['Aetheric Cuirass', 'Legendary Katana']], ['container:2', ['Ebony Dagger']]]);
  assert.deepEqual(names(visit.decorItems.chest7), ['Ring of the Wild Hunt'], 'the storage piece\'s');
  assert.deepEqual(visit.decorOwn, { lute1: { name: 'Lute' } }, 'the owner\'s own thing standing in the room');
  assert.deepEqual(names(visit.droppedPiles[0].items), ['Apple'], 'the floor\'s');
  assert.deepEqual(visit.hiddenBase, ['m1:41105'], 'the furniture its owner took out');
  assert.equal(visit.layout, BC, 'its own stamp');
});

test('HOME-WIPE what a move carries into a home its owner keeps joins that home\'s first chest - after its own things, never over them; a record with no first chest gets one; a stranger\'s visit is no home\'s record and goes (mutants: the chest\'s own dropped; the carried dropped; the crate mark lost)', () => {
  const FROM = homeSceneName(DF, OLD), TO = homeSceneName(DF, NEW);
  const s = createSceneCache();
  cacheScene(s, FROM, {
    lootContainers: [{ key: 'container:3', items: [{ name: 'Ruby' }] }], decorItems: { p1: [{ name: 'Potion of Healing' }] },
    droppedPiles: [{ pos: [0, 0, 0], items: [{ name: 'Torch' }] }], decorOwn: { o1: { name: 'Bed' } },
  });
  addPermanentScene(s, FROM);
  cacheScene(s, TO, {
    lootContainers: [{ key: 'container:0', items: [{ name: 'Gold ring' }], stockedDate: 1 }, { key: 'container:1', items: [{ name: 'Silver' }], stockedDate: 1 }],
    decorItems: { chest9: [{ name: 'Amulet' }] }, decorOwn: { own1: { name: 'Lute' } }, hiddenBase: ['m2:41000'], frame: 'building', layout: BC,
  });
  addPermanentScene(s, TO);
  const out = emptyArenaScene(s, FROM, TO, { layout: null });
  assert.deepEqual(out.own, [{ name: 'Bed' }], 'the owner\'s own things still answered, to give back');
  const to = s.scenes.get(TO);
  const first = to.lootContainers.find((c) => c.key === ARENA_CRATE_KEY);
  assert.deepEqual(names(first.items), ['Gold ring', 'Ruby', 'Potion of Healing', 'Torch'], 'its own first, then what was carried');
  // a chest the house no longer stands sets its things down where its owner walks in (restoreInteriorScene's crate arm)
  // rather than dropping them unseen
  assert.equal(first.crate, true);
  assert.equal(first.stockedDate, 1, 'still the owner\'s own chest');
  assert.deepEqual(to.lootContainers.map((c) => c.key), ['container:0', 'container:1']);
  assert.deepEqual(names(to.lootContainers[1].items), ['Silver']);
  assert.deepEqual([to.decorItems, to.decorOwn, to.hiddenBase, to.layout], [{ chest9: [{ name: 'Amulet' }] }, { own1: { name: 'Lute' } }, ['m2:41000'], BC], 'nothing else of the home moved - its stamp its own, never the call\'s');
  assert.ok(!s.scenes.has(FROM));
  assert.deepEqual([...s.permanent], [TO]);
  out.crate[0].name = 'changed';
  assert.equal(first.items[1].name, 'Ruby', 'copies, never the answer\'s');

  const n = createSceneCache();
  cacheScene(n, FROM, { lootContainers: [{ key: 'container:3', items: [{ name: 'Ruby' }] }] });
  addPermanentScene(n, FROM);
  cacheScene(n, TO, { lootContainers: [{ key: 'container:4', items: [{ name: 'Silver' }], stockedDate: 1 }], droppedPiles: [{ pos: [2, 0, 2], items: [{ name: 'Apple' }] }], frame: 'building' });
  addPermanentScene(n, TO);
  emptyArenaScene(n, FROM, TO);
  assert.deepEqual(n.scenes.get(TO).lootContainers, [
    { key: 'container:4', items: [{ name: 'Silver' }], stockedDate: 1 },
    { key: ARENA_CRATE_KEY, items: [{ name: 'Ruby' }], crate: true, stockedDate: 0 },
  ]);
  assert.deepEqual(names(n.scenes.get(TO).droppedPiles[0].items), ['Apple'], 'its floor kept');

  // an ordinary scene - a stranger's visit, which the world moving on would take: the move's record stands in its place
  const o = createSceneCache();
  cacheScene(o, FROM, { lootContainers: [{ key: 'container:3', items: [{ name: 'Ruby' }] }] });
  addPermanentScene(o, FROM);
  cacheScene(o, TO, { lootContainers: [{ key: 'container:0', items: [{ name: 'a stranger\'s stock' }], stockedDate: 9 }] });
  emptyArenaScene(o, FROM, TO);
  assert.deepEqual(o.scenes.get(TO).lootContainers, [{ key: ARENA_CRATE_KEY, items: [{ name: 'Ruby' }], crate: true, stockedDate: 0 }]);
  assert.deepEqual([...o.permanent], [TO], 'the owner\'s now');
});

test('CRATE-LAYOUT a record a move makes is stamped with the layout its town is visited in - so the visit restores it, and the save carries it; Daggerfall\'s own is no stamp; offline the deed\'s own layout (mutants: the record unstamped; the offline deed\'s layout unhanded)', () => {
  const FROM = homeSceneName(DF, OLD), TO = homeSceneName(DF, NEW);
  const s = createSceneCache();
  cacheScene(s, FROM, { lootContainers: [{ key: 'container:0', items: [{ name: 'Ruby' }] }], layout: BC });
  addPermanentScene(s, FROM);
  emptyArenaScene(s, FROM, TO, { layout: BC });
  const rec = s.scenes.get(TO);
  assert.equal(rec.layout, BC);
  // the visit's own question (worldModes.js restoreInteriorScene: layoutsMatch(data.layout, the town's layout now)) - an
  // unstamped record reads as Daggerfall's own town, and a city in Beautiful Cities held it back
  assert.equal(layoutsMatch(rec.layout, BC), true);
  assert.equal(layoutsMatch(undefined, BC), false);
  const round = restoreSceneCache(createSceneCache(), JSON.parse(saveOf(s)));
  assert.equal(round.scenes.get(TO).layout, BC, 'the save carries the stamp');
  assert.deepEqual([...round.permanent], [TO]);
  assert.deepEqual(names(round.scenes.get(TO).lootContainers[0].items), ['Ruby']);
  for (const layout of ['classic', null]) {
    const c = createSceneCache();
    cacheScene(c, FROM, { lootContainers: [{ key: 'container:0', items: [{ name: 'Ruby' }] }] });
    addPermanentScene(c, FROM);
    emptyArenaScene(c, FROM, TO, { layout });
    assert.equal('layout' in c.scenes.get(TO), false, `Daggerfall's own town is no stamp (${layout})`);
  }

  // OFFLINE: the deed's own layout - the one the save's pins stand its town in (the move runs before they are read)
  const houses = createHouses(62);
  Object.assign(houses[ARENA_REGION], { mapId: DF, buildingKey: OLD, layout: BC });
  const scenes = createSceneCache();
  cacheScene(scenes, interiorSceneName(DF, OLD), { lootContainers: [{ key: 'container:2', items: [{ name: 'gold' }] }], layout: BC });
  addPermanentScene(scenes, interiorSceneName(DF, OLD));
  const CITY = [{ buildingKey: makeBuildingKey(1, 1, 0), buildingType: BUILDING_TYPES.House2, name: 'House 110' }];
  const r = moveArenaRecords({
    houses, summaries: CITY, oldTypeOf: () => BUILDING_TYPES.House2, scenes,
    displaced: (rec) => arenaRecordDisplaced(rec, (m) => (m === DF ? ARENA_LOCATION_KEY : null)),
  });
  const moved = scenes.scenes.get(interiorSceneName(DF, r.to));
  assert.equal(moved.layout, BC, 'stamped with the deed\'s layout');
  assert.deepEqual(names(moved.lootContainers[0].items), ['gold']);
  assert.equal(houses[ARENA_REGION].layout, BC, 'the deed keeps its own');
});

test('CRATE-LAYOUT the online host: the boot\'s move stamps the new home\'s record with the layout the homes\' towns stand in - the city it was picked in (mutant: the host\'s layout dropped)', () => {
  const w = rd('src/scenes/world.js');
  const fn = w.slice(w.indexOf('async function moveArenaHomesOnline('), w.indexOf('async function holdRealmDeedsOnline('));
  assert.ok(fn.includes('emptyScene: (from, to) => emptyArenaScene(scenes, homeSceneName(now.mapId, from), homeSceneName(now.mapId, to), { layout: layoutStampOfMapId(now.mapId) }),'));
  assert.match(w, /^import \{[^}]*\blayoutStampOfMapId\b[^}]*\} from '\.\.\/systems\/layoutPins\.js';/m, 'the pins\' own reading');
  // the move waits for the homes' towns: their layouts are applied before it reads the city
  const landing = w.slice(w.indexOf('function takeHomeLayouts('), w.indexOf('function askHomeLayoutsAgain('));
  assert.ok(/_homeLayoutsApplied = true;[\s\S]{0,300}void moveArenaHomesOnline\(\);/.test(landing));
});
