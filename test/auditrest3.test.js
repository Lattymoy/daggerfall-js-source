// AUDIT REST III (2026-10-03, Mac: "Audit this and ensure its perfection" - bible/06-Systems/Rest-Arc.md "AUDIT REST
// III"): six fresh lenses over every AUDIT REST II fix, each finding verified before it was fixed. The fixes a file of
// their own pins (the dungeon fires' E1 rides test/auditrest2_fires.test.js's harness, the H8 draw its own test) are
// RUN here where they can be: the hosts' own statements sliced out of the source and mounted over stubs
// (test/restsync.test.js's harness), the systems called.
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as acorn from 'acorn';
import { setSharedClock } from '../src/systems/worldTick.js';
import { _resetForTests } from '../src/systems/uiPrefs.js';

const rd = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
afterEach(() => { setSharedClock(null); _resetForTests(); });

// ---- the hosts' own statements, mounted ----
const parsed = new Map();
function nodeOf(file, pred) {
  if (!parsed.has(file)) { const src = rd(file); parsed.set(file, { src, ast: acorn.parse(src, { ecmaVersion: 'latest', sourceType: 'module' }) }); }
  const { src, ast } = parsed.get(file);
  let hit = null;
  (function walk(n) {
    if (!n || typeof n.type !== 'string' || hit) return;
    if (pred(n)) { hit = n; return; }
    for (const k of Object.keys(n)) { const v = n[k]; if (Array.isArray(v)) v.forEach(walk); else if (v && typeof v.type === 'string') walk(v); }
  })(ast);
  assert.ok(hit, `${file} has the node`);
  return src.slice(hit.start, hit.end);
}
const fnOf = (file, name) => nodeOf(file, (x) => x.type === 'FunctionDeclaration' && x.id?.name === name);
const methodOf = (file, name) => nodeOf(file, (x) => x.type === 'Property' && x.method && x.key?.name === name);
const scoped = (state) => new Proxy(state, {
  has: (t, k) => k !== '__s',
  get: (t, k) => (k === Symbol.unscopables ? undefined : (k in t ? t[k] : globalThis[k])),
  set: (t, k, v) => { t[k] = v; return true; },
});
const mount = (body, state) => new Function('__s', `with (__s) { ${body} }`)(scoped(state));

test('AUDIT REST III A1: the same dungeon\'s own load (F9, the pause\'s Load underground) stands the save\'s camps outside, after the character - as the world host\'s dungeon load does; a save from another place is the world host\'s, which stands them itself (mutants: the dungeon\'s load never asks; the mode machine never forwards; the host never answers)', () => {
  const order = [];
  const extras = { world: { outerCamps: [] }, locationKey: 'dungeon:7' };
  const state = {
    opts: {
      dungeonOnline: () => false, loadRebuilds: () => false, worldLoad: (k) => order.push(['worldLoad', k]),
      modStartLoad() {}, onStartLoad() {}, modSaveLoad() {}, horseCartLoad() {}, modLoaded: () => order.push('modLoaded'),
      outerCampsLoad: (x) => order.push(['outerCampsLoad', x]),
    },
    loadSlot: () => state.snap, quickLoadSlot: () => state.snap, snap: { locationKey: 'dungeon:7' },
    playerEntity: { name: 'Mara' }, hudText: { add: (l) => order.push(l) }, _locationKey: 'dungeon:7',
    restorePlayer: () => extras, spellsByIndex: null, Promise,
  };
  const quickLoad = mount(`return ({ ${methodOf('src/scenes/dungeonContext.js', 'quickLoad')} }).quickLoad;`, state);
  quickLoad.call({ restoreSaved: () => order.push('restored') }, null);
  assert.deepEqual(order, ['restored', ['outerCampsLoad', extras], 'modLoaded'], 'the character first, then the save\'s camps outside, then OnLoad');
  // a save from another dungeon: handed up whole - the world host's load stands them (world.js standOuterCamps)
  order.length = 0; state.snap = { locationKey: 'dungeon:9' };
  quickLoad.call({ restoreSaved: () => order.push('restored') }, 'slot');
  assert.deepEqual(order, []);
  // the seam, through the mode machine to the world host's one home
  assert.match(rd('src/scenes/worldModes.js'), /outerCampsLoad: \(extras\) => host\.outerCampsLoad\?\.\(extras\),/);
  assert.match(rd('src/scenes/world.js'), /outerCampsLoad: \(extras\) => standSavedOuterCamps\(extras\),/);
});

test('AUDIT REST III A1: the world host\'s one home stands the save\'s camps outside - the page\'s own dropped first, each re-stood on today\'s ground when the save\'s terrain scale differs; a save from before carries none and what stands, stands', () => {
  const calls = [];
  const state = {
    camps: { dropOwn: () => calls.push('drop'), restore: (rows, from) => calls.push(['restore', rows, from]) },
    scaleOf: (s) => (s > 0 ? s : 1), STREAMING_TERRAIN_SCALE: 2, state: { localFromWorld: (x, z) => [x / 10, z / 10] },
    restandHeight: (y, x, z, was) => `y${y}@${x},${z}/${was}`, campFromNatives: 'fromNatives',
    landform: null,   // LANDFORM1: the row off - every height DFU's frame, no lift to put back on
  };
  const stand = mount(`${fnOf('src/scenes/world.js', 'standSavedOuterCamps')}\nreturn standSavedOuterCamps;`, state);
  stand({ world: {} });
  stand(undefined);
  assert.deepEqual(calls, [], 'a save from before AUDIT REST II H6 carries none: nothing dropped');
  const row = { id: 'me:1:1', pos: [100, 5, 200] };
  stand({ world: { outerCamps: [row] }, terrainScale: 2 });
  assert.deepEqual(calls, ['drop', ['restore', [row], 'fromNatives']], 'the same ground: the save\'s rows as they are');
  calls.length = 0;
  stand({ world: { outerCamps: [row] }, terrainScale: 1 });
  assert.deepEqual(calls[1][1], [{ id: 'me:1:1', pos: [100, 'y5@10,20/1', 200] }], 'another ground: re-stood');
});

test('AUDIT REST III D1: a held bounty\'s day moves with the lane - brought online, a bounty taken half an hour before keeps its day and its kills (the world months ahead of the offline calendar lapsed it, kills and all, on the first tick); taken offline again, the same; the minute a bounty was paid moves with it (mutants: the rows left on the old clock; the paid minutes left)', async () => {
  const { onlineCopyOf, offlineCopyOf, BOUNTY_RECORD_VENDOR } = await import('../src/systems/offlineCopy.js');
  const { BOUNTY_VENDOR, lapseBounties, bountyMinutesLeft, BOUNTY_LIFETIME_MINUTES } = await import('../src/systems/bountyBoard.js');
  assert.equal(BOUNTY_RECORD_VENDOR, BOUNTY_VENDOR, 'the record\'s own name');
  const own = 523530, world = 865550;
  const snap = { classicMinutes: own, modData: { [BOUNTY_VENDOR]: { held: [{ id: 'b1', takenAt: own - 30, killed: 2 }], paid: [], dropped: [], paidAt: { s1: own - 600 }, droppedKilled: {}, v: 2 } } };
  const on = onlineCopyOf(snap, world).modData[BOUNTY_VENDOR];
  assert.equal(on.held[0].takenAt, world - 30, 'taken half an hour before the click, on the world\'s clock');
  assert.equal(on.paidAt.s1, world - 600);
  assert.deepEqual(lapseBounties(on, world), [], 'nothing lapses on the first tick');
  assert.equal(on.held[0].killed, 2);
  assert.equal(bountyMinutesLeft(on.held[0], world), BOUNTY_LIFETIME_MINUTES - 30);
  assert.equal(snap.modData[BOUNTY_VENDOR].held[0].takenAt, own - 30, 'the offline slot keeps its own');
  const back = offlineCopyOf({ classicMinutes: own, worldMinutes: world, modData: { [BOUNTY_VENDOR]: on } }).modData[BOUNTY_VENDOR];
  assert.equal(back.held[0].takenAt, own - 30, 'and back on the character\'s clock');
  assert.equal(back.paidAt.s1, own - 600);
  const early = onlineCopyOf({ classicMinutes: 900, modData: { [BOUNTY_VENDOR]: { held: [{ id: 'b2', takenAt: 100, killed: 0 }], paidAt: { s: 50 } } } }, 10);
  assert.equal(early.modData[BOUNTY_VENDOR].held[0].takenAt, 0, 'never below the calendar\'s start');
  assert.equal(early.modData[BOUNTY_VENDOR].paidAt.s, 0);
});

test('AUDIT REST III C1: a night my own clock owes me is carried inside the party\'s minute - the party just off the road (the journey moved the clock, the next night due at once), a mate who rests 45 s after the first night sleeps me; a short rest still waits the minute out, and the debt is asked only of a move the minute holds back (mutants: the debt never asked; always owed)', async () => {
  const { createNightWatch, PARTY_NIGHT_GAP_MS } = await import('../src/systems/partyRestLaw.js');
  const w = createNightWatch();
  const t0 = 1_000_000;
  assert.equal(w.moved('a', true, t0 - 5000, t0, true), false, 'the first sight is a baseline');
  let asked = 0;
  const due = (v) => () => { asked++; return v; };
  assert.equal(w.moved('a', true, t0 + 1000, t0 + 1000, true, due(false)), true, 'the first night: carried');
  assert.equal(asked, 0, 'outside the minute the debt is never asked');
  assert.equal(w.moved('a', true, t0 + 46_000, t0 + 46_000, true, due(false)), false, 'inside the minute, owed nothing: a short rest waits');
  assert.equal(w.moved('a', true, t0 + 47_000, t0 + 47_000, true, due(true)), true, 'inside the minute, a night owed: carried');
  assert.equal(asked, 2);
  assert.equal(w.moved('a', true, t0 + 47_000, t0 + 47_500, true, due(true)), false, 'never the same stamp twice (P2\'s mark)');
  assert.equal(asked, 2, 'nor asked of a stamp that did not move');
  assert.equal(w.moved('a', true, t0 + 48_000 + PARTY_NIGHT_GAP_MS, t0 + 48_000 + PARTY_NIGHT_GAP_MS, true), true, 'past the minute, as before');
  assert.match(rd('src/scenes/world.js'), /_nightWatch\.moved\(m\.acct, !!m\.p, at, now, isNightStamp, \(\) => nightDue\(playerEntity, ownMinutes\(\)\)\)/, 'the host asks its own clock');
});

test('AUDIT REST III B2: "Bring online" keeps a rest supply standing as the owner\'s own decor offline too - the item and the piece it stood as leave the realm\'s copy (online, taking the piece down handed it to the pack); another piece and another own item stay (mutant: the decor unread; the piece left standing)', async () => {
  const { setPref } = await import('../src/systems/uiPrefs.js');
  const { applyCustoms } = await import('../src/systems/realmCustoms.js');
  const { createRestItem, REST_ITEM, _setRestItemsOnlineForTests } = await import('../src/systems/restItems.js');
  setPref('survival', true);
  const vase = { templateIndex: 205, group: 'Miscellaneous', value: 5 };
  const house = () => ({
    decor: [{ id: 'p1', pos: [0, 0, 0] }, { id: 'p2', pos: [1, 0, 0] }, { id: 'p3', pos: [2, 0, 0] }],
    decorOwn: { p1: createRestItem(REST_ITEM.Bedroll), p2: vase, p3: createRestItem(REST_ITEM.Candle) },
  });
  // REST-LOOT (2026-10-05): the sources are open, so this is the switch's way back - pinned with the switch shut
  _setRestItemsOnlineForTests(false);
  try {
    const scene = house();
    const snap = { level: 1, goldPieces: 0, items: [], wagonItems: [], bankAccounts: [], sceneCache: { scenes: [scene] } };
    const r = applyCustoms(snap);
    assert.deepEqual(Object.keys(scene.decorOwn), ['p2'], 'the supplies leave the copy\'s house');
    assert.deepEqual(scene.decor.map((p) => p.id), ['p2'], 'and the pieces they stood as');
    assert.equal(r.restKept, 2, 'and the realm says they stayed');
  } finally { _setRestItemsOnlineForTests(null); }
  const scene = house();
  assert.equal(applyCustoms({ level: 1, goldPieces: 0, items: [], wagonItems: [], bankAccounts: [], sceneCache: { scenes: [scene] } }).restKept, 0, 'REST-LOOT: open, the house keeps them');
  assert.deepEqual(scene.decor.map((p) => p.id), ['p1', 'p2', 'p3']);
});

test('AUDIT REST III B4: the line "Your rest supplies will stay..." is said of the character\'s own - a General Store\'s shelf in the scene cache, a dungeon\'s loot pile and a dead foe\'s pack are stripped from the copy all the same, and counted for nothing; a chest the character filled counts (mutant: every list counted)', async () => {
  const { setPref } = await import('../src/systems/uiPrefs.js');
  const { applyCustoms, customsLines } = await import('../src/systems/realmCustoms.js');
  const { createRestItem, REST_ITEM, _setRestItemsOnlineForTests } = await import('../src/systems/restItems.js');
  const { LOOT_CONTAINER_TYPES } = await import('../src/systems/sceneCache.js');
  setPref('survival', true);
  const shelf = { containerType: LOOT_CONTAINER_TYPES.ShopShelves, items: [createRestItem(REST_ITEM.Tonic), createRestItem(REST_ITEM.Firewood)] };
  const snap = {
    level: 1, goldPieces: 0, items: [], wagonItems: [], bankAccounts: [],
    sceneCache: { scenes: [{ lootContainers: [shelf] }] },
    world: { piles: [{ items: [createRestItem(REST_ITEM.EmberJar)] }], foes: [{ dead: true, items: [createRestItem(REST_ITEM.EmberJar)] }] },
  };
  // REST-LOOT (2026-10-05): the sources are open, so this is the switch's way back - pinned with the switch shut
  _setRestItemsOnlineForTests(false);
  try {
    const r = applyCustoms(snap);
    assert.deepEqual([shelf.items.length, snap.world.piles[0].items.length, snap.world.foes[0].items.length], [0, 0, 0], 'stripped from the copy all the same');
    assert.equal(r.restKept, 0, 'and none of it was the character\'s');
    assert.equal(customsLines(r, { before: true }).some((l) => /rest supplies/.test(l)), false, 'so nothing is said');
    const chest = { containerType: LOOT_CONTAINER_TYPES.HouseContainers, items: [createRestItem(REST_ITEM.Salts)] };
    const own = { level: 1, goldPieces: 0, items: [createRestItem(REST_ITEM.Tonic)], wagonItems: [], bankAccounts: [], sceneCache: { scenes: [{ lootContainers: [chest] }] } };
    assert.equal(applyCustoms(own).restKept, 2, 'the pack\'s and the chest the character filled');
  } finally { _setRestItemsOnlineForTests(null); }
  const kept = { level: 1, goldPieces: 0, items: [createRestItem(REST_ITEM.Tonic)], wagonItems: [], bankAccounts: [], world: { piles: [{ items: [createRestItem(REST_ITEM.EmberJar)] }] } };
  const r = applyCustoms(kept);
  assert.deepEqual([r.restKept, kept.items.length, kept.world.piles[0].items.length], [0, 1, 1], 'REST-LOOT: open, nothing is stripped and nothing is said');
  assert.equal(customsLines(r, { before: true }).some((l) => /rest supplies/.test(l)), false);
});

test('AUDIT REST III B3: Firewood feeds the emptiest of my Campfires in reach that has room - a full one found first no longer takes the stick only to refuse it while a cold one beside it is empty (relit); all of them full still says full (mutants: room unasked; the first found; the full word lost)', async () => {
  const { setPref } = await import('../src/systems/uiPrefs.js');
  const { setWorldMinutes } = await import('../src/systems/worldTick.js');
  const { createCamps } = await import('../src/scenes/camps.js');
  const { createSurvivalItem } = await import('../src/systems/survival/items.js');
  const { TEMPLATE } = await import('../src/systems/survival/food.js');
  const { createRestItem, REST_ITEM, REST_ITEM_TEXT } = await import('../src/systems/restItems.js');
  const { fireLit } = await import('../src/systems/survival/camp.js');
  setPref('survival', true); setWorldMinutes(1000);
  const said = [];
  const entity = { items: [createSurvivalItem(TEMPLATE.Campfire), createSurvivalItem(TEMPLATE.Campfire), createSurvivalItem(TEMPLATE.Campfire)] };
  const p = createCamps({
    entity, camera: () => ({ feet: [0, 1, 0], yaw: 0 }), collider: () => ({ raycast: (o, d, m) => (d[1] < 0 && m >= o[1] ? o[1] : null) }),
    place: () => ({}), say: (l) => said.push(l), openRest: () => {}, showOverlay: () => {},
  });
  for (let i = 0; i < 3; i++) p.placeItem(entity.items[0], entity.items);
  assert.equal(p.camps.length, 3, 'three of mine stand in reach');
  const [full, half, cold] = p.camps;
  full.rec.wear = 8; half.rec.wear = 5; cold.rec.wear = 0; cold.rec.litUntil = 0;
  const wood = createRestItem(REST_ITEM.Firewood); wood.stackCount = 3;
  entity.items.push(wood);
  assert.equal(p.placeItem(wood, entity.items), true);
  assert.deepEqual([full.rec.wear, half.rec.wear, cold.rec.wear], [8, 5, 3], 'the empty cold one took it');
  assert.ok(fireLit(cold.rec, 1000), 'and was relit');
  assert.equal(p.placeItem(wood, entity.items), true);
  assert.deepEqual([full.rec.wear, half.rec.wear, cold.rec.wear], [8, 5, 6], 'the emptiest again');
  half.rec.wear = 8; cold.rec.wear = 8;
  assert.equal(p.placeItem(wood, entity.items), false);
  assert.equal(said.at(-1), REST_ITEM_TEXT.firewoodFull, 'every one full: the full word');
  assert.equal(wood.stackCount, 1, 'and the stick kept');
});

test('AUDIT REST III A2, A3: a tent\'s Stoke is its owner\'s - a friend\'s cold tent offers none (stoked on my screen alone, put out by its owner\'s next frame under the rest it promised); online my own cold tent keeps its Rest after its Stoke (the rest stokes it first, and was never refused); one worn out, neither; offline the list is as it was (mutants: the tent\'s stoke for anyone; the tent\'s rest dropped; any cold camp\'s rest kept)', async () => {
  const { campMenu, CAMP_KIND } = await import('../src/systems/survival/camp.js');
  const keys = (rows) => rows.map((r) => r.key);
  const coldTent = { kind: CAMP_KIND.Tent, wear: 30, litUntil: 5 };
  assert.deepEqual(keys(campMenu(coldTent, 10, false, { online: true })), ['cook'], 'a friend\'s cold tent: its embers, as a friend\'s cold fire');
  assert.deepEqual(keys(campMenu(coldTent, 10, true, { online: true })), ['stoke', 'rest', 'cook', 'pack'], 'mine: Stoke, then the Rest that stokes it');
  assert.deepEqual(keys(campMenu({ ...coldTent, wear: 0 }, 10, true, { online: true })), ['cook', 'pack'], 'worn out: neither');
  assert.deepEqual(keys(campMenu({ kind: CAMP_KIND.Fire, fuel: true, wear: 6, litUntil: 5 }, 10, true, { online: true })), ['stoke', 'cook', 'pack'], 'a cold Campfire still offers no rest (relight it first)');
  assert.deepEqual(keys(campMenu(coldTent, 10, true)), ['rest', 'cook', 'stoke', 'pack'], 'offline (every camp mine): as it was');
  assert.deepEqual(keys(campMenu({ ...coldTent, litUntil: 99 }, 10, false, { online: true })), ['rest', 'cook'], 'a friend\'s lit tent: rest and cook');
});

test('AUDIT REST III B5, H12 by behaviour (lens F8): an Ember Jar\'s fire is named as itself when looked at, as on its hover; online my cold Campfire\'s list leads with Relight and the plaque\'s Rest does not rest - the pool reads the lane on its own (mutants: the jar a Campfire; the lane unread)', async () => {
  const { setPref } = await import('../src/systems/uiPrefs.js');
  const { setWorldMinutes } = await import('../src/systems/worldTick.js');
  const { createCamps } = await import('../src/scenes/camps.js');
  const { createSurvivalItem } = await import('../src/systems/survival/items.js');
  const { TEMPLATE } = await import('../src/systems/survival/food.js');
  const { createRestItem, REST_ITEM } = await import('../src/systems/restItems.js');
  const { CAMP_TEXT, campInfoText, CAMP_KIND } = await import('../src/systems/survival/camp.js');
  assert.equal(campInfoText({ kind: CAMP_KIND.Fire, jar: true, wear: 1, litUntil: 99 }, 10, true), CAMP_TEXT.seeOwnJar);
  assert.equal(campInfoText({ kind: CAMP_KIND.Fire, jar: true, wear: 1, litUntil: 99 }, 10, false), CAMP_TEXT.seeJar);
  assert.equal(CAMP_TEXT.seeOwnJar, 'You see your Ember Jar fire.');
  assert.equal(campInfoText({ kind: CAMP_KIND.Fire, fuel: true, wear: 6, litUntil: 99 }, 10, true), CAMP_TEXT.seeOwnFire, 'a Campfire stays one');
  const pool = (entity, rests) => createCamps({
    entity, camera: () => ({ feet: [0, 1, 0], yaw: 0 }), collider: () => ({ raycast: (o, d, m) => (d[1] < 0 && m >= o[1] ? o[1] : null) }),
    place: () => ({}), say: () => {}, openRest: () => rests.push(1), showOverlay: () => {},
  });
  setPref('survival', true); setWorldMinutes(1000);
  const jarEntity = { items: [createRestItem(REST_ITEM.EmberJar)] };
  const said = [];
  const jp = createCamps({ entity: jarEntity, camera: () => ({ feet: [0, 1, 0], yaw: 0 }), collider: () => ({ raycast: (o, d, m) => (d[1] < 0 && m >= o[1] ? o[1] : null) }), place: () => ({}), say: (l) => said.push(l), openRest: () => {}, showOverlay: () => {} });
  jp.placeItem(jarEntity.items[0], jarEntity.items);
  jp.activate(`camp:${jp.camps[0].rec.id}`, 'info');
  assert.equal(said.at(-1), CAMP_TEXT.seeOwnJar, 'the pool says it too');
  for (const online of [false, true]) {
    setSharedClock(online ? () => 5_000_000 : null);
    const rests = [];
    const entity = { items: [createSurvivalItem(TEMPLATE.Campfire)] };
    const p = pool(entity, rests);
    assert.equal(p.placeItem(entity.items[0], entity.items), true);
    p.camps[0].rec.litUntil = 0;   // burned down, its fuel left
    const key = `camp:${p.camps[0].rec.id}`;
    assert.equal(p.hoverName(key).actions[0].id, online ? 'stoke' : 'rest', online ? 'online: Relight leads' : 'offline: as it was');
    p.activate(key, 'grab', 'rest');
    assert.equal(rests.length, online ? 0 : 1, online ? 'the plaque\'s Rest rests nobody at a cold fire online' : 'offline it rests, as DFU rests anywhere');
  }
});

test('AUDIT REST III E2: a mirrored placement\'s floor looks up to the collider as the world pass draws it - its winding turned back (staticBatch.js WOD5), so `back` is the game\'s own face on every placement; the normal faces the ray either way (mutant: the mirror unread)', async () => {
  const { Collider } = await import('../src/player/collider.js');
  const positions = [-1, 0, -1, -1, 0, 1, 1, 0, 1, 1, 0, -1];   // a floor, wound to look up
  const indices = [0, 1, 2, 0, 2, 3];
  const I = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  const MX = [-1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];   // an x mirror (scale -1)
  for (const [name, m] of [['as placed', I], ['mirrored', MX]]) {
    const c = new Collider(() => -Infinity);
    c.addMesh('dungeon', positions, indices, m);
    const down = c.raycastHit([0.2, 2, 0.3], [0, -1, 0], 5);
    assert.equal(down.dist, 2, name);
    assert.equal(down.back, false, `${name}: a floor's top, seen from above, is its front`);
    assert.deepEqual(down.normal.map((v) => Math.round(v * 1000) / 1000 + 0), [0, 1, 0], `${name}: the normal faces the ray`);
    const up = c.raycastHit([0.2, -2, 0.3], [0, 1, 0], 5);
    assert.equal(up.back, true, `${name}: from under, its back`);
  }
});

test('AUDIT REST III D2: a time limit the text sets keeps its days online - K0C00Y07\'s ransom and B0B71Y03\'s daughter read their number, not "a few", beside the deadline that kept its own; offline as ever (mutants: either out of the table)', async () => {
  const { QuestMachine } = await import('../src/systems/quest/machine.js');
  const { PLAYED_STEP_MAX_SECONDS } = await import('../src/systems/quest/clock.js');
  const { loadQuestTables } = await import('../src/systems/quest/tables.js');
  const { readdirSync } = await import('node:fs');
  const bare = (p) => rd(p).replace(/^\uFEFF/, '');
  const sources = {};
  for (const f of readdirSync(new URL('../vendor/dfu-quests/Tables', import.meta.url))) if (f.endsWith('.txt')) sources[f.replace('.txt', '')] = bare(`vendor/dfu-quests/Tables/${f}`);
  loadQuestTables(sources);
  const parse = (name, online) => {
    const lines = bare(`vendor/dfu-quests/Quests/${name}.txt`).split(/\r?\n/);
    return new QuestMachine({
      nowSeconds: () => 0, raisedSeconds: () => 0, questClockStepMax: () => (online ? PLAYED_STEP_MAX_SECONDS : Infinity),
      showPopup() {}, getQuestSourceLines: () => lines, sharedClock: () => online,
    }).parseQuestShape(name);
  };
  const log = console.log; console.log = () => {};
  try {
    for (const [quest, clock] of [['K0C00Y07', '2ransom'], ['B0B71Y03', 'finddaughter']]) {
      const on = parse(quest, true).resources.get(clock), off = parse(quest, false).resources.get(clock);
      assert.equal(on.isDeadline, true, `${quest}:${clock} a deadline`);
      assert.equal(on.waitsShort, false, 'no short wait online');
      assert.match(String(on.expandMacro(5)), /^\d+$/, `${quest}: online "=${clock}_ days" reads its number`);
      assert.equal(on.expandMacro(5), off.expandMacro(5), 'the same number offline');
    }
  } finally { console.log = log; }
});
