// FIELD BUGS 2026-10-19f HEIR-WHOLE (a player's private report, build 0.0.245: their ancestor died in another player's
// dungeon - an instance - and the inheritance never appeared when they went to the death spot).
//
// A death records the size its dungeon was BUILT at (AUDIT FB1013d B1), and the remains stand only in a build of that
// size - another size is another layout. An instance is the dungeon whole, and the world builds about half its dungeons
// smaller in public (SD-ONLINE: it draws three in four smaller, and 2,005 of MAPS.BSA's 4,232 have the blocks to be laid
// anew - AUDIT FB1019f B1); another player's instance admits only its owner's party. So the heir's every visit was
// the public room's smaller layout, which stands none, and no door offered them a build that would. Now the death
// quest's place is "a dungeon with your quest": where the line's remains lie whole and the public room is laid smaller,
// the door offers the heir an instance of their own (systems/instancePlaces.js remainsWholeAt, remainsInstanceEpoch;
// scenes/instanceDoor.js), and its build - the dungeon whole, Daggerfall's own blocks - stands them where they fell.
//
// Fixtures from the producers: the Legacy host (createLegacyHost) - its founding, the death at the one damage door
// (hurtPlayer), the Succession and the birth; the real instance door (createInstanceDoor) with the real ChoiceWindow and
// digests, wired to the Legacy host by world.js's own `remains` dep (run off its text); the build an entry makes
// (worldModes.js dungeonTransition's `sized` and ownDungeonLocation, off their text, over the real dungeonLocationFor);
// the world host's own reads (legacyHere, legacyInDungeonOf, legacyAtPlace, anchorLanding, legacyRemainsFeet, the stand)
// and the dungeon's (its summary, its key, floorAt), each off its text over fakes of the world they read; a real ground
// pool (createDroppedLoot); the relay's own door (instanceAdmission).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { createLegacyHost, REMAINS_FLAT, LEGACY_TEXT } from '../../../src/scenes/legacyHost.js';
import { createRemainsStand } from '../../../src/scenes/legacyRemainsStand.js';
import { createDroppedLoot } from '../../../src/scenes/droppedLoot.js';
import { MODELS, familyRng } from '../../../src/systems/legacy/family.js';
import { _resetModSaveData } from '../../../src/systems/modSaveData.js';
import { LOCATION_TYPES, REGION_NAMES, MapsFile } from '../../../src/formats/mapsFile.js';
import { floorLanding } from '../../../src/player/enterExit.js';
import { hurtPlayer, setDeathListener } from '../../../src/characters/playerEntity.js';
import { planTake, applyTransfer } from '../../../src/systems/item/itemTransfer.js';
import { isRemainsItem } from '../../../src/systems/legacy/heirloom.js';
import { builtDungeonSize, dungeonLocationFor, onlineDungeonSize, dungeonSizeFor, builtSizeFor } from '../../../src/world/smallerDungeons.js';
import { createInstanceDoor, INSTANCE_TEXT, dungeonSite, siteBase } from '../../../src/scenes/instanceDoor.js';
import { remainsWholeAt, remainsInstanceEpoch } from '../../../src/systems/instancePlaces.js';
import { instanceRoomOf, instanceWord, instanceAdmission } from '../../../src/net/instanceRoom.js';
import { QuestMachine } from '../../../src/systems/quest/machine.js';
import { Place, SITE_TYPES } from '../../../src/systems/quest/place.js';
import { loadQuestTables } from '../../../src/systems/quest/tables.js';
{
  const dir = new URL('../../../vendor/dfu-quests/Tables/', import.meta.url);
  const sources = {};
  for (const f of readdirSync(dir)) if (f.endsWith('.txt')) sources[f.replace('.txt', '')] = readFileSync(new URL(f, dir), 'utf8').replace(/^﻿/, '');
  loadQuestTables(sources);
}

const rd =(f) => readFileSync(new URL(`../../../${f}`, import.meta.url), 'utf8');
const W = rd('src/scenes/world.js');
const DC = rd('src/scenes/dungeonContext.js');
const WM = rd('src/scenes/worldModes.js');
const hex = (s, bytes) => createHash('sha256').update(s).digest('hex').slice(0, bytes * 2);

/** world.js's own text from `start` to the close of its statement. */
function cut(start, close = '\n  };') {
  const i = W.indexOf(start);
  assert.ok(i >= 0, `world.js moved: ${start}`);
  return W.slice(i, W.indexOf(close, i) + close.length);
}
const HERE = cut('  const legacyHere = (');
const IN_DUNGEON = (() => { const m = /\n( {2}const legacyInDungeonOf = [^\n]*;)\n/.exec(W); assert.ok(m, 'world.js\'s dungeon test moved'); return m[1]; })();
const AT_PLACE = cut('  const legacyAtPlace = (place) => {');
const FEET = cut('  const legacyRemainsFeet = (place) => {');
const ANCHOR = cut('  const anchorLanding = (a) => {');
const STAND = cut('  const legacyRemainsStand = createRemainsStand({', '\n  });');
const NEAR_DUNGEON = (() => { const m = /\n {2}const LEGACY_REMAINS_NEAR_DUNGEON = (\d+);/.exec(W); assert.ok(m, 'world.js\'s six paces moved'); return Number(m[1]); })();
/** world.js's own wiring of the door's `remains` (createInstanceDoor's dep), off its text - over a Legacy host. */
const REMAINS_DEP = (() => {
  const m = /\n {2}const instanceDoor = createInstanceDoor\(\{[^\n]*\n(?: {4}[^\n]*\n)*? {4}remains: ([^\n]*?) \}\);/.exec(W);
  assert.ok(m, 'world.js\'s instance door no longer hears where the line\'s remains lie');
  return (legacyHost) => new Function('legacyHost', `return ${m[1]};`)(legacyHost);
})();
/** The dungeon's summary (`abyss.location`), its key (`_locationKey`) and its floor (`floorAt`), off dungeonContext.js. */
const summaryOf = (() => {
  const m = /\n\s+location: (\(\) => \(\{ regionIndex: dfLocation\.regionIndex[^\n]*\}\)),\n/.exec(DC);
  assert.ok(m, 'dungeonContext.js\'s abyss.location moved');
  return (dfLocation) => new Function('dfLocation', `return (${m[1]})();`)(dfLocation);
})();
const keyOf = (() => {
  const m = /\n {2}const _locationKey = ([^\n]*);\n/.exec(DC);
  assert.ok(m, 'dungeonContext.js\'s _locationKey moved');
  return (dfLocation) => new Function('dfLocation', `return ${m[1]};`)(dfLocation);
})();
const DC_FLOOR_AT = (() => { const m = /\n\s+floorAt: (\(x, y, z\) => floorLanding\(collider, \[x, y \+ 0\.2, z\]\)),\n/.exec(DC); assert.ok(m, 'dungeonContext.js\'s floorAt moved'); return m[1]; })();
/** THE BUILD AN ENTRY MAKES, online: worldModes.js dungeonTransition's `sized` (the entry's `whole`) and its own copy
 *  (ownDungeonLocation), off their text - the location the dungeon context is built over (modes.dungeonLocation). */
const buildOf = (() => {
  const sized = /\n {4}const sized = (dungeonLocationFor\(hit\.dfLocation, \{[^}\n]*\}\));/.exec(WM);
  const own = /\n {2}const ownDungeonLocation = (\(loc\) => \(\{\n[\s\S]*?\n {2}\}\));\n/.exec(WM);
  assert.ok(sized && own, 'worldModes.js\'s dungeon build moved');
  const f = new Function('dungeonLocationFor', 'hit', 'questBridge', 'host', 'place', `const ownDungeonLocation = ${own[1]};\nreturn ownDungeonLocation(${sized[1]});`);
  return (dfLocation, entry) => f(dungeonLocationFor, { dfLocation }, null, { dungeonOnline: () => true }, entry);
})();

const raycastOver = (floors) => (o, d, max) => {
  let best = Infinity;
  for (const y of floors) { const dd = o[1] - y; if (dd >= 0 && dd <= max && dd < best) best = dd; }
  return best;
};
const renderer = () => ({ createBillboardBatch: () => ({}), destroyBillboardBatch: () => {} });
const stubTex = { getSize: () => ({ width: 64, height: 40 }), getScale: () => ({ width: 0, height: 0 }), recordCount: 64, getFrameCount: () => 1 };
const groundPool = () => createDroppedLoot({ renderer: renderer(), getTexture: async () => stubTex, uploadRecordFrame: () => {} });
const mem = () => { const m = new Map(); return { get length() { return m.size; }, key: (i) => [...m.keys()][i] ?? null, getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { m.set(k, String(v)); }, removeItem: (k) => { m.delete(k); } }; };

/** A ruin of thirteen blocks (nine interior, four caps) at Ruins of The Hold of Coppering's map id, which the world lays
 *  medium online (bible/11-Multiplayer/Instances.md section 1), on its pixel. */
const PIXEL = { x: 300, y: 200 };
const blocks = [...Array.from({ length: 9 }, (_, i) => ({ blockName: `N000000${i}.RDB`, x: i, z: 0, isStartingBlock: i === 0 })), ...Array.from({ length: 4 }, (_, i) => ({ blockName: `B000000${i}.RDB`, x: i, z: 1, isStartingBlock: false }))];
const ruinAt = (mapId, locationId = 8008) => ({ name: 'Ruins of The Hold of Coppering', regionName: 'Isle of Balfiera', regionIndex: 23, locationIndex: 12, hasDungeon: true, mapTableData: { mapId, locationType: LOCATION_TYPES.DungeonRuin }, dungeon: { recordElement: { header: { locationId } }, blocks } });
const RUINS = ruinAt(52646490);
/** A map id the world lays whole (a quarter of them), and another it lays smaller - the QUEST-ELSEWHERE test's search. */
const idOfSize = (want, from) => { let id = from; while (onlineDungeonSize({ mapTableData: { mapId: id } }) !== want) id++; return id; };
const WHOLE_ID = idOfSize('full', 52646491);
const OTHER_ID = idOfSize('medium', 52646491);
/** The entries a dungeon's door hands its build (scenes/instanceDoor.js): Ann's instance - another player's, which the
 *  heir is not of the party of - and the public room. */
const ANN = hex('instance:account:acct-ann1', 8), HEIR = hex('instance:account:acct-heir', 8);
const ANN_ENTRY = Object.freeze({ instance: Object.freeze({ owner: ANN, epoch: '89abcdef' }), whole: true });
const PUBLIC = Object.freeze({ instance: null, whole: false });

/** THE WORLD HOST'S OWN READS over a world of fakes: where the one played stands (`w.mode`, `w.pos`, the build they are
 *  in, its pixel), the dungeon's pool - each read run off world.js's text, the dungeon's own off dungeonContext.js's. */
function worldOf(w) {
  const modes = {
    get mode() { return w.mode; },
    dungeonCtx: { abyss: { location: () => summaryOf(w.dungeonLoc) }, locationKey: () => keyOf(w.dungeonLoc), floorAt: new Function('floorLanding', 'collider', `return ${DC_FLOOR_AT};`)(floorLanding, { raycast: raycastOver([w.floorY]) }) },
    get dungeonLocation() { return w.dungeonLoc; },
    droppedPool: () => (w.mode === 'dungeon' ? w.dungeonPool : null),
  };
  const state = { compensation: [0, 0, 0], worldCoords: (p) => ({ x: p[0] * 40, z: p[2] * 40 }), localFromWorld: (x, z) => [x / 40, z / 40] };
  const locationIndex = new Map([[`${PIXEL.x},${PIXEL.y}`, w.at]]);
  const names = ['playerTravelPixel', 'maps', 'locationIndex', 'modes', 'walkMode', 'playerSpawned', 'player', 'cam', 'REGION_NAMES', 'state', 'heightAt', 'floorLanding', 'collider',
    'LEGACY_REMAINS_NEAR_DUNGEON', 'LEGACY_REMAINS_NEAR', 'createRemainsStand', 'droppedLoot', 'REMAINS_FLAT', 'groundFrameHeight', 'restandHeight', 'scaleOf', 'STREAMING_TERRAIN_SCALE', 'LEGACY_TEXT', 'builtDungeonSize'];
  const vals = [() => ({ ...PIXEL }), { getRegionIndexAt: () => 23 }, locationIndex, modes, true, true, { get pos() { return w.pos; } }, { pos: [0, 0, 0] }, REGION_NAMES, state, () => -Infinity, floorLanding, { raycast: () => Infinity },
    NEAR_DUNGEON, 2400, createRemainsStand, groundPool(), REMAINS_FLAT, (y) => y, (y) => y, () => 1, 1, LEGACY_TEXT, builtDungeonSize];
  return new Function(...names, `${HERE}\n${IN_DUNGEON}\n${AT_PLACE}\n${ANCHOR}\n${FEET}\n${STAND}\nreturn { legacyHere, legacyAtPlace, legacyRemainsStand };`)(...vals);
}

/** An Enduring house whose founder's span is spent, played in `at` - in the build `entry` makes of it. She falls there at
 *  her last position, and her heir is born; the world's reads around them. */
function fallenIn(at, entry) {
  _resetModSaveData();
  const w = { mode: 'dungeon', pos: [10, -5, 30], at, dungeonLoc: buildOf(at, entry), floorY: -5.4, dungeonPool: groundPool(), opened: [] };
  const world = worldOf(w);
  const e = {
    name: 'Ysolde Hlaalu', gender: 'female', race: 'Breton', faceIndex: 3, careerIndex: 5, career: { name: 'Nightblade', primarySkills: [28], majorSkills: [], minorSkills: [] },
    level: 20, characterId: 'c-ysolde', chargenDone: true, health: 50, maxHealth: 50, stats: { strength: 60, intelligence: 50, willpower: 50, agility: 50, endurance: 50, personality: 50, speed: 50, luck: 50 },
    skills: Array.from({ length: 35 }, () => 30), items: [], wagonItems: [], bagItems: [],
  };
  const storage = mem(), tab = mem();
  const host = createLegacyHost({
    entity: e, storage: () => storage, tab: () => tab, on: () => true, online: () => false, now: () => 500, own: () => 0,
    here: world.legacyHere, town: () => null, nearestTown: () => ({ region: 'Wayrest', loc: 'Wayrest' }), gold: () => 8000, say: () => {},
    boot: () => {}, search: () => '?world', loadCharacter: () => false, saveNow: () => true, inFight: () => false, rng: familyRng(3), killer: () => null,
    atPlace: (place) => world.legacyAtPlace(place), openRemains: (r, items) => { w.opened.push(items); return true; },
    carried: () => [...e.items, ...e.wagonItems, ...e.bagItems], atRest: () => false, askRest: () => false,
  });
  host.found(MODELS.enduring);
  host.current().toll = 200;   // the span spent: Arkay will not grant another
  setDeathListener('projectLegacy', () => host.onDeath());
  try {
    let died = false;
    for (let i = 0; !died && i < 20; i++) died = hurtPlayer(e, 10, { bypassShield: true });
    assert.equal(died, true);
  } finally { setDeathListener('projectLegacy', null); }
  assert.equal(host.deathOutcome().kind, 'fall');
  assert.equal(host.succeed({ newborn: true }), true);
  assert.ok(host.takeBorn(host.current().id));
  Object.assign(e, { characterId: 'c-heir', name: 'Heir', items: [], health: 40 });
  host.onBorn();
  assert.equal(host.family.pending, null);
  w.mode = 'exterior'; w.pos = [0, 0, 0];   // the heir, out in the world
  return { w, world, host, e, row: host.family.remains[0] };
}

/** The heir's door - the real one, its `remains` world.js's own wiring over the Legacy host. */
function doorOf(t, { instanceOk = true, members = [] } = {}) {
  const shown = [], said = [];
  const m = new QuestMachine();
  const d = createInstanceDoor({
    online: () => true, instanceOk: () => instanceOk, account: () => 'acct-heir', character: () => 'c-heir', members: () => members,
    questMachine: () => m, openOverlay: (win, onClosed) => { shown.push({ win, onClosed }); return true; }, say: (l) => said.push(l), wild: () => false,
    remains: REMAINS_DEP(t.host),
  });
  return { d, m, shown, said };
}
/** Let the door's own awaits (the digests) run until `cond`. */
const until = async (cond, ms = 5000) => { const end = Date.now() + ms; while (!cond() && Date.now() < end) await new Promise((r) => setTimeout(r, 2)); };
/** The door asked, and the row `code` taken when the popup stands - or the rule's answer where none does. */
async function take(door, site, code) {
  const n = door.shown.length;
  const pending = door.d.choose(site);
  if (code == null) return pending;
  await until(() => door.shown.length > n);
  assert.equal(door.shown.length, n + 1, 'the popup stood');
  door.shown[n].win.input(code);
  return pending;
}
/** The heir goes in by `entry` and stands at `pos`: the bodies the world stands there. */
function enter(t, at, entry, pos = [10, -5, 30]) {
  t.w.mode = 'dungeon'; t.w.pos = pos; t.w.at = at; t.w.dungeonLoc = buildOf(at, entry);
  return t.world.legacyRemainsStand.frame(t.host.remainsToStand());
}
const pileOf = (t) => t.w.dungeonPool._piles.find((p) => p.items === t.row.items) ?? null;
/** A running quest of the heir's whose Place names the ruins (the instance door's own test's shape). */
function questAt(m, mapId) {
  const sym = (name) => ({ name, original: `_${name}_`, clone() { return sym(name); } });
  const q = m.parseQuestForLists(['Quest: __HW', 'QRC:', 'Message:  1011', ' x', '', 'QBN:', 'variable _done_'], 0, { rolls: () => 0 });
  m.startQuestImmediate(q);
  const p = new Place(q);
  p.symbol = sym('crypt');
  p.siteDetails = { siteType: SITE_TYPES.Dungeon, mapId, buildingKey: 0, regionIndex: 23, locationName: 'Ruins', magicNumberIndex: 0, selectedMarker: { targetResources: null }, questSpawnMarkers: null, questItemMarkers: null };
  q.resources.set('crypt', p);
  return q;
}

test('HEIR-WHOLE the report: the fallen dies in another player\'s instance of a ruin the world lays medium in public; at its door the heir is offered an instance of their own - their account\'s, the death quest\'s room - and its build, the dungeon whole, stands the remains on the floor under where she fell, the record\'s own list; the public room still stands none, and Ann\'s room still admits nobody but her party (mutants: the door never asks the remains; the world unwired; no epoch; the epoch not the line\'s, not the row\'s; the line unsaid)', async () => {
  assert.equal(onlineDungeonSize(RUINS), 'medium', 'the world lays the ruin medium');
  const t = fallenIn(RUINS, ANN_ENTRY);
  assert.equal(builtDungeonSize(t.w.dungeonLoc), 'full', 'Ann\'s instance: the dungeon whole');
  assert.deepEqual(t.row.place.dungeon, { regionIndex: 23, locationIndex: 12, key: 'dungeon:8008', size: 'full' }, 'the death records the size it was built at');
  assert.equal(t.row.place.mapId, RUINS.mapTableData.mapId, 'and the location she stood on');
  assert.deepEqual(t.row.place.pos, [10, -5, 30]);
  assert.equal(t.row.id, 'r1');
  // the heir at the ruins' door - no quest of theirs names it: the death quest does
  const door = doorOf(t);
  const site = door.d.dungeonSite(RUINS);
  assert.equal(site.relaid, true);
  const n = door.shown.length;
  const pub = door.d.choose(site);
  await until(() => door.shown.length > n);
  const { win } = door.shown[n];
  // PIN MOVED (FIELD BUGS 2026-10-26 QUEST-FIRST): the re-laid room stands none of the remains, so it is the LAST row
  assert.deepEqual(win.options.map((o) => o.label), [`1 - ${INSTANCE_TEXT.mine()}`, `2 - ${INSTANCE_TEXT.public()}`, `Esc - ${INSTANCE_TEXT.leave()}`], 'an instance of their own, or Public');
  assert.deepEqual(win.lines, ['Ruins of The Hold of Coppering', INSTANCE_TEXT.line(), INSTANCE_TEXT.questPublic()], 'said before the choice: the quest\'s business is in the instance alone');
  win.input('Digit2');
  assert.deepEqual(await pub, PUBLIC);
  assert.equal(enter(t, RUINS, PUBLIC), 0, 'the public room is laid medium - another layout: no body');
  assert.equal(builtDungeonSize(t.w.dungeonLoc), 'medium');
  assert.equal(t.world.legacyAtPlace(t.row.place), false, 'and no list opens on the very spot');
  // Your instance: the heir's account, the remains' own epoch - never Ann's room
  t.w.mode = 'exterior';
  const mine = await take(door, site, 'Digit1');
  const EPOCH = hex(`instance:epoch:${t.host.family.id}:r1:remains`, 4);
  assert.deepEqual(mine, { instance: { owner: HEIR, epoch: EPOCH }, whole: true });
  assert.equal(await remainsInstanceEpoch(t.host.remainsWhere()[0]), EPOCH);
  assert.equal(await remainsInstanceEpoch({ id: 'r1' }), null, 'no line, no room');
  assert.equal(await remainsInstanceEpoch(undefined), null);
  assert.equal(enter(t, RUINS, mine), 1, 'the dungeon whole: one body stands');
  assert.equal(builtDungeonSize(t.w.dungeonLoc), 'full');
  const pile = pileOf(t);
  assert.ok(pile, 'in the dungeon\'s own pool');
  assert.equal(pile.items, t.row.items, 'the record\'s own list');
  assert.deepEqual(pile.pos, [10, t.w.floorY, 30], 'on the floor under her last position');
  assert.equal(t.world.legacyAtPlace(t.row.place), true, 'where she fell');
  t.host.tick();
  assert.deepEqual(t.w.opened, [t.row.items], 'on the very spot, the list opens');
  // the relay's own door: Ann's room admits the heir no more than before; the heir's admits its owner, not Ann
  const base = siteBase(site);
  const kin = async () => false;   // nobody of anybody's party
  assert.equal(await instanceAdmission(instanceRoomOf(base, ANN_ENTRY.instance), 'acct-heir', { kin }), null, 'Ann\'s instance: closed to the heir');
  assert.equal(await instanceAdmission(instanceRoomOf(base, mine.instance), 'acct-heir', { kin }), 'owner');
  assert.equal(await instanceAdmission(instanceRoomOf(base, mine.instance), 'acct-ann1', { kin }), null, 'the heir\'s instance: closed to Ann');
});

test('HEIR-WHOLE the room is the remains\' while they lie: the same room every entry; a save in it loads back into it; every other way in takes it; with a quest of the heir\'s there the quest\'s room, which stands them too; at a relay with no instances the public room whole; the bones taken up, no offer, and a save in the room loads into the public room laid whole (mutants: the room not kept; a taken row offered)', async () => {
  const t = fallenIn(RUINS, ANN_ENTRY);
  const door = doorOf(t);
  const site = door.d.dungeonSite(RUINS);
  const first = await take(door, site, 'Digit1');   // PIN MOVED (QUEST-FIRST): the instance is the first row here
  assert.deepEqual(await take(door, site, 'Digit1'), first, 'one room, every entry');
  const word = instanceWord(first.instance);
  assert.deepEqual(await door.d.entryFor(site, { ins: word }), first, 'a save made in it: back into it');
  const shown = door.shown.length;
  assert.deepEqual(await door.d.entryFor(site), first, 'every other way in, never asked: the remains\' room');
  assert.equal(door.shown.length, shown);
  // an older relay: the public room whole (the quests' fallback) - which stands them
  const old = doorOf(t, { instanceOk: false });
  const whole = await take(old, site);
  assert.deepEqual(whole, { instance: null, whole: true });
  assert.equal(old.shown.length, 0);
  assert.equal(enter(t, RUINS, whole), 1, 'the public room laid whole stands her');
  // a quest of the heir's names the ruins: its room - the dungeon whole, so the remains stand in it as well
  t.w.mode = 'exterior';
  const quested = doorOf(t);
  const q = questAt(quested.m, RUINS.mapTableData.mapId);
  const questRoom = await take(quested, site, 'Digit1');
  assert.deepEqual(questRoom, { instance: { owner: HEIR, epoch: q.instanceEpoch }, whole: true }, 'the quest\'s own room');
  assert.notEqual(q.instanceEpoch, first.instance.epoch);
  assert.equal(enter(t, RUINS, questRoom), 1, 'and it stands her');
  assert.deepEqual(await quested.d.entryFor(site, { ins: word }), first, 'the remains\' room still held beside it');
  // the heir takes the bones up: the death quest's place is their keeping now
  const bones = t.row.items.find(isRemainsItem);
  applyTransfer(bones, planTake(bones, { bag: t.e.items, entity: t.e }), t.row.items, t.e.items, { entity: t.e, toPlayer: true });
  t.host.tick();
  assert.equal(t.row.state, 'taken');
  assert.deepEqual(t.host.remainsWhere(), []);
  t.w.mode = 'exterior';
  const after = doorOf(t);
  assert.deepEqual(await take(after, site), PUBLIC, 'no offer: the door opens as it always did');
  assert.equal(after.shown.length, 0);
  assert.deepEqual(await after.d.entryFor(site, { ins: word }), { instance: null, whole: true }, 'a save in the room: the public room, laid as it was taken');
});

test('HEIR-WHOLE public-build remains keep their law: a death in the public room - laid smaller, or whole - offers nothing and stands where it fell in that room; a whole build of a re-laid ruin stands none of a death in its smaller public room; a row from before the size was kept, another ruin, and another line\'s door are offered nothing (mutants: every size offered; a whole public room offered; any dungeon offered)', async () => {
  // fallen in the public room, laid medium
  const t = fallenIn(RUINS, PUBLIC);
  assert.equal(t.row.place.dungeon.size, 'medium');
  const door = doorOf(t);
  const site = door.d.dungeonSite(RUINS);
  assert.deepEqual(await take(door, site), PUBLIC, 'no popup: the public room');
  assert.equal(door.shown.length, 0);
  assert.equal(enter(t, RUINS, PUBLIC), 1, 'the public room stands her');
  assert.deepEqual(pileOf(t).pos, [10, t.w.floorY, 30]);
  // the reverse: a whole build of the ruin (an instance - a quest's) is another layout: none there
  assert.equal(enter(t, RUINS, { instance: { owner: HEIR, epoch: '01234567' }, whole: true }), 0, 'the whole build stands none of a death in the medium one');
  assert.equal(t.world.legacyAtPlace(t.row.place), false);
  // fallen in Ann's instance of a ruin the world lays whole: its public room is that build - no instance needed
  const atWhole = ruinAt(WHOLE_ID, 8010);
  const w = fallenIn(atWhole, ANN_ENTRY);
  const wd = doorOf(w);
  assert.equal(wd.d.dungeonSite(atWhole).relaid, false);
  assert.deepEqual(await take(wd, wd.d.dungeonSite(atWhole)), PUBLIC, 'no popup: the public room is the dungeon whole');
  assert.equal(wd.shown.length, 0);
  assert.equal(enter(w, atWhole, PUBLIC), 1, 'and it stands her');
  // fallen in Ann's instance of the ruins: another ruin the world lays smaller offers nothing for her
  const r = fallenIn(RUINS, ANN_ENTRY);
  const other = ruinAt(OTHER_ID, 8011);
  const od = doorOf(r);
  assert.equal(od.d.dungeonSite(other).relaid, true);
  assert.deepEqual(await take(od, od.d.dungeonSite(other)), PUBLIC, 'another ruin: nothing');
  assert.equal(od.shown.length, 0);
  // a row from before the size was kept stands in any build: nothing to offer
  delete r.row.place.dungeon.size;
  assert.deepEqual(await take(od, od.d.dungeonSite(RUINS)), PUBLIC, 'a row with no size: the public room stands it');
  assert.equal(od.shown.length, 0);
  assert.equal(enter(r, RUINS, PUBLIC), 1);
  // another account's door - its own line, whose remains lie nowhere - is offered nothing of this line's
  const theirs = createInstanceDoor({ online: () => true, instanceOk: () => true, account: () => 'acct-ann1', character: () => 'c-ann', members: () => [], questMachine: () => new QuestMachine(),
    openOverlay: () => assert.fail('no popup'), say: () => {}, wild: () => false, remains: () => [] });
  assert.deepEqual(await theirs.choose(theirs.dungeonSite(RUINS)), PUBLIC);
  // the law itself, over the producers' rows
  const rows = t.host.remainsWhere();
  assert.deepEqual(rows, [{ line: t.host.family.id, id: 'r1', place: t.row.place }]);
  assert.deepEqual(remainsWholeAt(rows, site), [], 'medium remains: the public room\'s');
  const wholeRows = fallenIn(RUINS, ANN_ENTRY).host.remainsWhere();
  assert.equal(remainsWholeAt(wholeRows, site).length, 1);
  assert.deepEqual(remainsWholeAt(wholeRows, { ...site, relaid: false }), [], 'a public room laid whole stands them itself');
  assert.deepEqual(remainsWholeAt(wholeRows, { ...site, mapId: OTHER_ID }), [], 'another dungeon');
  assert.deepEqual(remainsWholeAt(null, site), []);
});

test('HEIR-WHOLE a whole build of one dungeon is one layout, whoever builds it: Ann\'s instance, the heir\'s and the public room laid whole are Daggerfall\'s own blocks, drawn from nothing - the location\'s own, the same summary and key; a re-laid public room is seeded on its map id, the same every build, and another layout', () => {
  const ann = buildOf(RUINS, ANN_ENTRY);
  const heir = buildOf(RUINS, { instance: { owner: HEIR, epoch: '01234567' }, whole: true });
  const pub = buildOf(RUINS, { instance: null, whole: true });
  assert.equal(dungeonLocationFor(RUINS, { online: true, whole: true }), RUINS, 'the whole build is the location itself - no draw');
  for (const b of [ann, heir, pub]) {
    assert.notEqual(b, RUINS, 'each build its own copy (OH-E)');
    assert.deepEqual(b.dungeon.blocks, RUINS.dungeon.blocks, 'Daggerfall\'s own blocks, in place');
    assert.deepEqual([summaryOf(b), keyOf(b), builtDungeonSize(b)], [{ regionIndex: 23, locationIndex: 12 }, 'dungeon:8008', 'full']);
  }
  const m1 = buildOf(RUINS, PUBLIC), m2 = buildOf(RUINS, PUBLIC);
  assert.equal(builtDungeonSize(m1), 'medium');
  assert.deepEqual(m1.dungeon.blocks, m2.dungeon.blocks, 'the medium build: one layout every build');
  assert.notDeepEqual(m1.dungeon.blocks, RUINS.dungeon.blocks, 'and another layout than the whole');
});

// ── AUDIT FB1019f B1: `relaid` IS THE SIZE BUILT ──────────────────────────────────────────────────────────────────────
// A dungeon site's `relaid` (scenes/instanceDoor.js dungeonSite) read the size the world DRAWS (dungeonSizeFor online),
// and a dungeon at or under its size's threshold is never laid anew: its public room is the dungeon whole. A death there
// recorded `size: 'full'`, and the door offered the heir an instance with QUEST-ELSEWHERE's line - "The shared dungeon is
// smaller and has none of it" - over a public room that stood her; every other way in took the heir into the instance.
// It reads the size BUILT now (world/smallerDungeons.js builtSizeFor), the size the build an entry makes says.

/** A ruin of `n` blocks - its first `interior` interior (the first the starting block), the rest border - at the first
 *  map id from `from` the world draws `size`. */
const ruinOf = (size, n, interior, locationId, from = 52646491) => {
  const blocks = Array.from({ length: n }, (_, i) => ({ blockName: `${i < interior ? 'N' : 'B'}${String(i).padStart(7, '0')}.RDB`, x: i, z: 0, isStartingBlock: i === 0 }));
  const at = ruinAt(idOfSize(size, from), locationId);
  return { ...at, dungeon: { ...at.dungeon, blocks } };
};

test('HEIR-WHOLE AUDIT FB1019f B1: a dungeon site is re-laid where the world BUILDS its public room smaller - the size the entry\'s own build says - never where it only draws it smaller: the plus and the eight-block shape are already that small and are built whole (mutants: the drawn size; the thresholds swapped; the threshold off by one at either size)', () => {
  const cases = [
    // [drawn, blocks, interior, built]
    ['small', 5, 1, 'full'],    // The Tombs of Klerd's shape (below, on MAPS.BSA): the plus already
    ['small', 6, 2, 'small'],
    ['small', 8, 2, 'small'],
    ['medium', 5, 1, 'full'],
    ['medium', 8, 2, 'full'],   // the commonest shape a dungeon has (AUDIT DELVE): the medium size itself
    ['medium', 9, 3, 'medium'],
    ['full', 13, 9, 'full'],
  ];
  for (const [drawn, n, interior, built] of cases) {
    const loc = ruinOf(drawn, n, interior, 9000 + n);
    const what = `${n} blocks drawn ${drawn}`;
    assert.equal(dungeonSizeFor(loc, { online: true }), drawn, `${what}: the world's draw`);
    assert.equal(builtDungeonSize(buildOf(loc, PUBLIC)), built, `${what}: the public room's build, off worldModes.js's own entry`);
    assert.equal(builtSizeFor(loc, { online: true }), built, `${what}: the size built, asked without building`);
    assert.equal(dungeonSite(loc).relaid, built !== 'full', `${what}: re-laid where it is built smaller`);
  }
  assert.equal(builtSizeFor(ruinOf('medium', 13, 9, 9013), { online: true, whole: true }), 'full', 'an instance\'s build: the dungeon whole');
  assert.equal(builtSizeFor(null), 'full');
});

test('HEIR-WHOLE AUDIT FB1019f B1: a death in the public room of a ruin drawn smaller but built whole is the public room\'s - no popup and no line, every other way in its public room, and the public room stands her where she fell; a death there in Ann\'s instance too; a quest there is offered its instance without the line that the shared dungeon has none of it (mutant: the drawn size)', async () => {
  const TINY = ruinOf('small', 5, 1, 9005);
  const t = fallenIn(TINY, PUBLIC);
  assert.equal(builtDungeonSize(t.w.dungeonLoc), 'full', 'the public room: the dungeon whole');
  assert.equal(t.row.place.dungeon.size, 'full', 'so the death records it whole');
  const door = doorOf(t);
  const site = door.d.dungeonSite(TINY);
  assert.equal(site.relaid, false);
  assert.deepEqual(remainsWholeAt(t.host.remainsWhere(), site), [], 'no remains its public room cannot stand');
  assert.deepEqual(await take(door, site), PUBLIC, 'no popup: the door opens as it always did');
  assert.equal(door.shown.length, 0);
  assert.deepEqual(await door.d.entryFor(site), PUBLIC, 'every other way in: the public room, never an instance of the heir\'s');
  assert.equal(enter(t, TINY, PUBLIC), 1, 'and the public room stands her');
  assert.deepEqual(pileOf(t).pos, [10, t.w.floorY, 30], 'on the floor under where she fell');
  // fallen in Ann's instance of it: the dungeon whole, the layout its public room lays - nothing to offer either
  const a = fallenIn(TINY, ANN_ENTRY);
  const ad = doorOf(a);
  assert.deepEqual(await take(ad, ad.d.dungeonSite(TINY)), PUBLIC);
  assert.equal(ad.shown.length, 0);
  assert.equal(enter(a, TINY, PUBLIC), 1, 'the public room stands a death in another\'s instance of it');
  // a quest of the heir's at an eight-block ruin drawn medium: its instance offered, as every quest's place - but the
  // shared dungeon is the dungeon whole and holds the quest's things (questMountsHere on the build), so no line says it
  const EIGHT = ruinOf('medium', 8, 2, 9008);
  const quested = doorOf(t);
  questAt(quested.m, EIGHT.mapTableData.mapId);
  const n = quested.shown.length;
  const pending = quested.d.choose(quested.d.dungeonSite(EIGHT));
  await until(() => quested.shown.length > n);
  assert.deepEqual(quested.shown[n].win.lines, ['Ruins of The Hold of Coppering', INSTANCE_TEXT.line()], 'the popup, without the line');
  quested.shown[n].win.input('Escape');
  await pending;
});

const ARENA2 = process.env.ARENA2_PATH;
const skipReal = !ARENA2 || !existsSync(ARENA2) ? 'ARENA2_PATH not set or missing - real-data validation skipped' : false;

test('HEIR-WHOLE AUDIT FB1019f B1 on MAPS.BSA: every one of the 4,232 dungeons\' sites is re-laid exactly where the public room\'s build is smaller - 2,005 of them, of the 3,133 the world draws smaller; at The Tombs of Klerd (five blocks, drawn medium, built whole) a death in the public room is offered nothing and stands there (mutants: the drawn size; the thresholds swapped; the threshold off by one)', { skip: skipReal }, async () => {
  const maps = new MapsFile();
  maps.load(new Uint8Array(readFileSync(join(ARENA2, 'MAPS.BSA'))), new Uint8Array(readFileSync(join(ARENA2, 'CLIMATE.PAK'))), new Uint8Array(readFileSync(join(ARENA2, 'POLITIC.PAK'))));
  let dungeons = 0, drawn = 0, built = 0, wrong = 0;
  for (let r = 0; r < maps.regionCount; r++) {
    const region = maps.getRegion(r);
    for (let l = 0; region && l < region.locationCount; l++) {
      const loc = maps.getLocation(r, l);
      if (!loc?.hasDungeon) continue;
      dungeons++;
      const size = builtDungeonSize(buildOf(loc, PUBLIC));
      if (dungeonSizeFor(loc, { online: true }) !== 'full') drawn++;
      if (size !== 'full') built++;
      if (dungeonSite(loc).relaid !== (size !== 'full') || builtSizeFor(loc, { online: true }) !== size) wrong++;
    }
  }
  assert.deepEqual({ dungeons, drawn, built, wrong }, { dungeons: 4232, drawn: 3133, built: 2005, wrong: 0 });
  const KLERD = maps.getLocationByName("Alik'r Desert", 'The Tombs of Klerd');
  assert.deepEqual([KLERD.dungeon.blocks.length, onlineDungeonSize(KLERD), builtDungeonSize(buildOf(KLERD, PUBLIC))], [5, 'medium', 'full']);
  const t = fallenIn(KLERD, PUBLIC);
  assert.equal(t.row.place.dungeon.size, 'full');
  const door = doorOf(t);
  const site = door.d.dungeonSite(KLERD);
  assert.equal(site.relaid, false);
  assert.deepEqual(await take(door, site), PUBLIC, 'no popup');
  assert.equal(door.shown.length, 0);
  assert.deepEqual(await door.d.entryFor(site), PUBLIC);
  assert.equal(enter(t, KLERD, PUBLIC), 1, 'the public room stands her');
});
