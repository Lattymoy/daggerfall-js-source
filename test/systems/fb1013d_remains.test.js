// FIELD BUGS 2026-10-13d (Discord #bug-reports, TheHalfinStream: "[ANGRY] Died of fatigue in wayrest palace, character
// aged past limit and remains did not appear"; `01-Overview/bugs/Field-Bugs-2026-10-13d.md`).
//
// REMAINS-STAND. AUDIT LEGACY H1 made the remains a list the record owns, and nothing stood where the fallen fell: the
// list opened by itself within six paces of the very spot underground, with nothing in the world to say where that spot
// was - in Castle Wayrest's halls the heir walked past it. Now the remains stand as a body in the ground pool of the
// host the one played stands in, and the body's list IS the record's (scenes/legacyRemainsStand.js).
// LIVE-FIGHT. The remains' "never in a fight" read the street's foe pools in every mode, frozen while a dungeon or a
// building is mounted: one hostile street walker latched as the heir went in kept the whole visit "in a fight", and the
// list never opened even on the spot. Now the fight is the place the one played stands in.
//
// Fixtures from the producers: the Legacy host (createLegacyHost) over one storage and one tab - its founding, the death
// as the collapse decides it (exhaustionOutcome over areEnemiesNearby) at the one damage door it takes (hurtPlayer -
// SPENT-ASHORE's tenth at each drain since FIELD BUGS 2026-10-13e, where it was DFU's SetHealth(0)), the Succession, the birth, the save door (modSaveRecords, restoreModSaveRecords); a real ground pool
// (createDroppedLoot), the real transfer laws (planTake, planStore, applyTransfer) and the made dungeons' producers (a
// spawn, the Undercroft, the Arena's floor, a medium build); the world host's own reads (legacyHere, legacyInDungeonOf,
// legacyAtPlace, anchorLanding, legacyRemainsFeet, the stand's construction, inFight, the let-go, legacyStep) and the
// dungeon's (its summary, its key, floorAt) run off their own text - over fakes of the world they read: the streamer's
// frame, the colliders' floors, the ground and its lift (the spot's own), the foe pools (a foe there is the motor's
// sense fields, set by hand) and the fights beside them (AUDIT FB1013d C12).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createLegacyHost, REMAINS_FLAT, LEGACY_TEXT } from '../../src/scenes/legacyHost.js';
import { createRemainsStand, REMAINS_MARK, REMAINS_STAND_OWNER } from '../../src/scenes/legacyRemainsStand.js';
import { createDroppedLoot } from '../../src/scenes/droppedLoot.js';
import { createLootLines, setLootMarksLive } from '../../src/scenes/lootLines.js';
import { MODELS, familyRng } from '../../src/systems/legacy/family.js';
import { _resetModSaveData, modSaveRecords, restoreModSaveRecords } from '../../src/systems/modSaveData.js';
import { LOCATION_TYPES, REGION_NAMES } from '../../src/formats/mapsFile.js';
import { areEnemiesNearby } from '../../src/systems/encounters.js';
import { floorLanding } from '../../src/player/enterExit.js';
import { hurtPlayer, setDeathListener } from '../../src/characters/playerEntity.js';
import { exhaustionOutcome } from '../../src/systems/rest/rest.js';
import { planTake, planStore, applyTransfer } from '../../src/systems/item/itemTransfer.js';
import { isRemainsItem, isHeirloom } from '../../src/systems/legacy/heirloom.js';
import { setItemFields, mintCondition } from '../../src/systems/item/itemTemplates.js';
import { setSilverFinder, silverFindAt, _resetSilverFindsForTests } from '../../src/systems/silverFinds.js';
import { setPref, _resetForTests } from '../../src/systems/uiPrefs.js';
import { synthesizeDungeonLocation, WORLD_SALT } from '../../src/world/spawnedDungeons.js';
import { arenaFloorLocation } from '../../src/world/arena/arenaFloor.js';
import { ARENA_REGION, ARENA_LOCATION, undercroftLocation } from '../../src/world/arena/arenaCity.js';
import { builtDungeonSize, generateMediumDungeon } from '../../src/world/smallerDungeons.js';

const rd = (f) => readFileSync(new URL(`../../${f}`, import.meta.url), 'utf8');
const W = rd('src/scenes/world.js');
const DC = rd('src/scenes/dungeonContext.js');
/** The dungeon's summary as dungeonContext.js mints it (`abyss.location`), run off its own text. */
const summaryOf = (() => {
  const m = /\n\s+location: (\(\) => \(\{ regionIndex: dfLocation\.regionIndex[^\n]*\}\)),\n/.exec(DC);
  assert.ok(m, 'dungeonContext.js\'s abyss.location moved');
  return (dfLocation) => new Function('dfLocation', `return (${m[1]})();`)(dfLocation);
})();
/** The dungeon's floor under a point (`floorAt`), off its own text - over a collider of the test's floors. */
const DC_FLOOR_AT = (() => { const m = /\n\s+floorAt: (\(x, y, z\) => floorLanding\(collider, \[x, y \+ 0\.2, z\]\)),\n/.exec(DC); assert.ok(m, 'dungeonContext.js\'s floorAt moved'); return m[1]; })();
/** The dungeon's own key - its save's and its room's (`locationKey()`'s `_locationKey`) - run off its own text. */
const keyOf = (() => {
  const m = /\n {2}const _locationKey = ([^\n]*);\n/.exec(DC);
  assert.ok(m, 'dungeonContext.js\'s _locationKey moved');
  return (dfLocation) => new Function('dfLocation', `return ${m[1]};`)(dfLocation);
})();
const mem = () => { const m = new Map(); return { get length() { return m.size; }, key: (i) => [...m.keys()][i] ?? null, getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { m.set(k, String(v)); }, removeItem: (k) => { m.delete(k); } }; };

/** world.js's own text from `start` to the close of its statement (`\n  };` or `\n  });`). */
function cut(start, close = '\n  };') {
  const i = W.indexOf(start);
  assert.ok(i >= 0, `world.js moved: ${start}`);
  const j = W.indexOf(close, i);
  return W.slice(i, j + close.length);
}
const HERE = cut('  const legacyHere = (');
const IN_DUNGEON = (() => { const m = /\n( {2}const legacyInDungeonOf = [^\n]*;)\n/.exec(W); assert.ok(m, 'world.js\'s dungeon test moved'); return m[1]; })();
const AT_PLACE = cut('  const legacyAtPlace = (place) => {');
const FEET = cut('  const legacyRemainsFeet = (place) => {');
const ANCHOR = cut('  const anchorLanding = (a) => {');   // AUDIT FB1013d C14: the record's height stood again - one home
const STAND = cut('  const legacyRemainsStand = createRemainsStand({', '\n  });');
/** AUDIT FB1013d A2: the host's let-go dep and its slow tick, off world.js's text. */
const LET_GO = (() => { const m = /\n {4}letGoRemains: ([^\n]*?),\s+\/\/[^\n]*\n/.exec(W); assert.ok(m, 'world.js\'s letGoRemains moved'); return m[1]; })();
const STEP = cut('  function legacyStep(dt) {', '\n  }\n');
const FIGHT = (() => { const m = /\n {4}inFight: (\(\) => [^\n]*?),\n/.exec(W); assert.ok(m, 'world.js\'s inFight moved'); return m[1]; })();

/** AUDIT FB1013d C1: the landforms' lift is the SPOT's (the real one is landformLiftAt's field), so a read at another
 *  spot, in another frame or with x and z swapped stands the body on another floor or none. Scene metres. */
const liftAt = (x, z) => 6 - 1.5 * x + 0.6 * z;
/** Floors a downward ray finds - `[{ y, x0, x1, z0, z1 }]`, the nearest under the origin within `max` (a collider's raycast). */
const raycastOver = (floors) => (o, d, max) => {
  let best = Infinity;
  for (const f of floors()) {
    if (o[0] < f.x0 || o[0] > f.x1 || o[2] < f.z0 || o[2] > f.z1) continue;
    const dd = o[1] - f.y;
    if (dd >= 0 && dd <= max && dd < best) best = dd;
  }
  return best;
};
const everywhere = (y) => ({ y, x0: -1e6, x1: 1e6, z0: -1e6, z1: 1e6 });
/** A recording renderer: the pool's batches, made and freed. */
const renderer = () => { const r = { made: 0, freed: 0 }; return Object.assign(r, { createBillboardBatch: () => { r.made++; return {}; }, destroyBillboardBatch: () => { r.freed++; } }); };
const stubTex = { getSize: () => ({ width: 64, height: 40 }), getScale: () => ({ width: 0, height: 0 }), recordCount: 64, getFrameCount: () => 1 };
const groundPool = () => createDroppedLoot({ renderer: renderer(), getTexture: async () => stubTex, uploadRecordFrame: () => {} });

/**
 * THE WORLD HOST'S OWN READS over a world of fakes: where the one played stands (`w.mode`, `w.pos`, the castle they are
 * in), the street's pool and the mode's own, the street's foe pools and the mode's - each read run off world.js's text.
 */
function worldOf(w) {
  const modes = {
    get mode() { return w.mode; },
    dungeonCtx: { abyss: { location: () => w.castle }, locationKey: () => w.key, floorAt: new Function('floorLanding', 'collider', `return ${DC_FLOOR_AT};`)(floorLanding, { raycast: raycastOver(() => w.dungeonFloors) }), foes: [] },
    get dungeonLocation() { return w.dungeonLoc; },
    droppedPool: () => (w.mode === 'dungeon' ? w.dungeonPool : w.mode === 'interior' ? w.roomPool : null),
    insideFoes: () => (w.mode === 'exterior' ? [] : w.insideFoes),
  };
  const state = {
    get compensation() { return w.comp; }, current: { x: 300, y: 200 },
    worldCoords: (p) => ({ x: p[0] * 40 + 1000, z: p[2] * 40 + 2000 }),
    localFromWorld: (x, z) => [(x - 1000) / 40, (z - 2000) / 40],
  };
  const player = { get pos() { return w.pos; } };
  const maps = { getRegionIndexAt: () => 23 };
  const locationIndex = new Map([['300,200', { name: 'Wayrest', mapTableData: { locationType: LOCATION_TYPES.TownCity, mapId: 4242 } }]]);
  // AUDIT FB1013d C1: the ground is the built pixel's, about the one played in the scene's metres - a read at native
  // coordinates (thousands of metres off) finds none
  const heightAt = (x, z) => (w.built && Math.abs(x) < 400 && Math.abs(z) < 400 ? w.ground : -Infinity);
  const collider = { raycast: raycastOver(() => w.floors), heightAt };
  // AUDIT LANDFORMS C1 / TERRAIN-SCALE1: a record's height is DFU's frame - the landforms' lift at its spot off on the way
  // in, back on (and the ground it was measured on read off its stamp) on the way out; a wrong stamp stands it 100 m up
  const groundFrameHeight = (y, x, z) => { w.lifts += 1; return Number.isFinite(y) ? y - liftAt(x, z) : y; };   // the lift's kernel pass, counted
  const restandHeight = (y, x, z, was) => (Number.isFinite(y) ? y + liftAt(x, z) + (was === SCALE ? 0 : 100) : y);
  const scaleOf = (stamp) => (stamp > 0 ? stamp : 1.5);
  const exteriorFoes = { foes: w.streetFoes }, cityGuards = { guards: w.streetGuards };
  const exteriorFoePool = () => [...cityGuards.guards, ...exteriorFoes.foes];
  const names = ['playerTravelPixel', 'maps', 'locationIndex', 'modes', 'walkMode', 'playerSpawned', 'player', 'cam', 'REGION_NAMES', 'state',
    'heightAt', 'floorLanding', 'collider', 'LEGACY_REMAINS_NEAR_DUNGEON', 'LEGACY_REMAINS_NEAR', 'createRemainsStand', 'droppedLoot', 'REMAINS_FLAT',
    'areEnemiesNearby', 'exteriorFoePool', 'exteriorFoes', 'cityGuards', 'groundFrameHeight', 'restandHeight', 'scaleOf', 'STREAMING_TERRAIN_SCALE', 'LEGACY_TEXT',
    'builtDungeonSize', 'duelEnemyNear', 'navalHostileNear'];
  const vals = [() => ({ ...w.pixel }), maps, locationIndex, modes, true, true, player, { pos: [0, 0, 0] }, REGION_NAMES, state,
    heightAt, floorLanding, collider, 6, 2400, createRemainsStand, w.streetPool, REMAINS_FLAT,
    areEnemiesNearby, exteriorFoePool, exteriorFoes, cityGuards, groundFrameHeight, restandHeight, scaleOf, SCALE, LEGACY_TEXT,
    builtDungeonSize, () => !!w.duel, () => !!w.ship];   // a duel or the one played's own bout (duelEnemyNear); a hostile ship in reach (navalHostileNear)
  const body = `${HERE}\n${IN_DUNGEON}\n${AT_PLACE}\n${ANCHOR}\n${FEET}\n${STAND}\nconst inFight = ${FIGHT};\nconst letGoRemains = ${LET_GO};\nreturn { legacyHere, legacyAtPlace, legacyRemainsFeet, legacyRemainsStand, inFight, letGoRemains };`;
  return new Function(...names, body)(...vals);
}

const CASTLE = Object.freeze({ regionIndex: 23, locationIndex: 7 });
const CASTLE_KEY = 'dungeon:7007';   // its locationKey: `dungeon:<recordElement.header.locationId>`
/** The terrain's scale today (the world host's STREAMING_TERRAIN_SCALE). */
const SCALE = 1.25;
/** The fallen's worn sword - the heirloom, as the game mints one. */
const sword = () => ({ ...mintCondition(setItemFields({ group: 'Weapons', templateIndex: 120, material: 4, flags: 0, variant: 0, message: 0, stackCount: 1 })), equipSlot: 1 });

/** An Enduring house whose founder's span is spent, played in Castle Wayrest; the world's reads around it. */
function house() {
  _resetModSaveData();
  const w = {
    mode: 'dungeon', pos: [10, -5, 30], pixel: { x: 300, y: 200 }, castle: { ...CASTLE }, key: CASTLE_KEY, dungeonLoc: null, lifts: 0, floorY: -5.4, comp: [0, 0, 0], ground: 0, floors: [], built: true,
    streetPool: groundPool(), dungeonPool: groundPool(), roomPool: groundPool(), streetFoes: [], streetGuards: [], insideFoes: [],
    said: [], opened: [], storage: mem(), tab: mem(),
  };
  w.dungeonFloors = [everywhere(w.floorY), everywhere(w.floorY + 3)];   // the hall's floor, and a gallery three metres over it
  const world = worldOf(w);
  const e = {
    name: 'Ysolde Hlaalu', gender: 'female', race: 'Breton', faceIndex: 3, careerIndex: 5, career: { name: 'Nightblade', primarySkills: [28], majorSkills: [], minorSkills: [] },
    level: 20, characterId: 'c-ysolde', chargenDone: true, health: 50, maxHealth: 50, stats: { strength: 60, intelligence: 50, willpower: 50, agility: 50, endurance: 50, personality: 50, speed: 50, luck: 50 },
    skills: Array.from({ length: 35 }, (_, i) => (i === 28 ? 70 : 30)), items: [sword()], wagonItems: [], bagItems: [],
  };
  w.e = e;
  const host = createLegacyHost({
    entity: e, storage: () => w.storage, tab: () => w.tab, on: () => w.on !== false, online: () => false, now: () => 500, own: () => 0,
    here: world.legacyHere, town: () => null, nearestTown: () => ({ region: 'Wayrest', loc: 'Wayrest' }), gold: () => 8000, say: (l) => w.said.push(l),
    boot: () => {}, search: () => '?world', loadCharacter: () => false, saveNow: () => true, inFight: () => world.inFight(), rng: familyRng(3),
    killer: () => null, atPlace: (place) => world.legacyAtPlace(place), openRemains: (r, items) => { if (w.slotHeld) return false; w.opened.push(items); return true; }, letGoRemains: world.letGoRemains,   // a window up refuses the list's own door (openLootList's, the street's overlay)
    carried: () => [...e.items, ...e.wagonItems, ...e.bagItems], atRest: () => false, askRest: () => false,
    takeItem: (it) => { for (const k of ['items', 'wagonItems', 'bagItems']) e[k] = e[k].filter((x) => x !== it); },
  });
  host.found(MODELS.enduring);
  host.current().toll = 200;   // the span spent: Arkay will not grant another
  return { w, world, host, e };
}
/** The collapse kills - as the dungeon's own onExhausted asks it: exhaustionOutcome over areEnemiesNearby (no foe near,
 *  an hour on the ground; a hostile one that sees her, SPENT-ASHORE's tenth of her health at each drain to nothing,
 *  through the one damage door, until the drains have spent her) - and the line's Succession raises a newborn heir, who
 *  lands through the birth's own door. PIN MOVED (FIELD BUGS 2026-10-13e SPENT-ASHORE): DFU's OnExhausted SetHealth(0)s
 *  her at the first such collapse (TEXT.RSC 1072), and this helper stood her death on that one; the port's collapse among
 *  foes costs a tenth now, so she dies of the collapses as they come - the same death through the same door, the
 *  Legacy host hearing it as any death. */
function fallAndHeir(t) {
  const seen = { dead: false, ai: { wouldBeSpawned: true, detected: true, inSight: true, targetIsLocalPlayer: true, isHostile: true } };   // the castle turned on her
  assert.equal(exhaustionOutcome({ enemiesNearby: areEnemiesNearby([]), entity: t.e, day: false, inside: true }).kind, 'rest', 'no foe near: the collapse is an hour on the ground');
  const spent = exhaustionOutcome({ enemiesNearby: areEnemiesNearby([seen]), entity: t.e, day: false, inside: true });
  assert.equal(spent.kind, 'spent', 'a hostile foe near: the collapse costs a tenth of her health (SPENT-ASHORE)');
  setDeathListener('projectLegacy', () => t.host.onDeath());
  try {
    let died = false, drains = 0;
    while (!died && drains < 20) { died = hurtPlayer(t.e, spent.damage, { bypassShield: true }); drains++; }
    assert.equal(died, true, 'the collapses are a death');
    assert.equal(drains, Math.ceil(t.e.maxHealth / spent.damage), 'one at each drain to nothing, until her health is spent');
  } finally { setDeathListener('projectLegacy', null); }
  const out = t.host.deathOutcome();
  assert.equal(out.kind, 'fall');
  assert.equal(out.fallen.died.cause, 'years', 'dead of her years: the span was spent');
  assert.equal(t.host.succeed({ newborn: true }), true);
  assert.ok(t.host.takeBorn(t.host.current().id));
  Object.assign(t.e, { characterId: 'c-heir', name: 'Heir', items: [], health: 40 });
  t.host.onBorn();
  assert.equal(t.host.family.pending, null);
  return t.host.family.remains[0];
}
const frame = (t) => t.world.legacyRemainsStand.frame(t.host.remainsToStand());
const pileOf = (pool, row) => pool._piles.find((p) => p.items === row.items) ?? null;

test('REMAINS-STAND: the report - an Enduring elder whose span was spent collapses of fatigue in Castle Wayrest; the heir comes back and the remains STAND where she fell, the record\'s own list, seen across the hall - and nowhere else (mutants: no body; the body not the record\'s list; saved; stood in any dungeon)', () => {
  const t = house();
  const row = fallAndHeir(t);
  assert.equal(row.place.mode, 'dungeon');
  assert.deepEqual(row.place.dungeon, { ...CASTLE, key: CASTLE_KEY, size: 'full' }, 'laid in her own dungeon - its row, its own key, the size it was built at');
  assert.deepEqual(row.place.pos, [10, -5, 30], 'at her last position');
  assert.ok(row.items.some(isRemainsItem) && row.items.some(isHeirloom), 'the bones and the heirloom lie there');
  assert.match(t.host.questLogEntries()[0].messages[0][0], /fell at Wayrest, Wayrest, deep inside/);
  // the heir walks the castle's hall, thirty metres from where she fell: the list sleeps there (six paces), the body stands
  t.w.pos = [40, -5, 30];
  t.host.tick();
  assert.equal(t.w.opened.length, 0, 'thirty metres off: not opened');
  assert.equal(frame(t), 1, 'one body stands');
  const pile = pileOf(t.w.dungeonPool, row);
  assert.ok(pile, 'in the dungeon\'s own pool');
  assert.equal(pile.items, row.items, 'its list IS the record\'s - the same array');
  assert.deepEqual(pile.pos, [10, t.w.floorY, 30], 'on the floor under her last position');
  assert.deepEqual([pile.archive, pile.record], [REMAINS_FLAT.archive, REMAINS_FLAT.record], 'the remains\' own picture');
  assert.equal(pile.owner, REMAINS_STAND_OWNER);
  const key = `droppedLoot:${pile.id}`;
  assert.equal(t.w.dungeonPool.labelFor(key), 'The remains of Ysolde Hlaalu', 'the plaque names her');
  assert.equal(t.host.mapMarks()[0].label, t.w.dungeonPool.labelFor(key), 'the map\'s ring and the plaque: one name, one home (LEGACY_TEXT.remainsName)');
  assert.ok(t.w.dungeonPool.lootTargets().some((tg) => tg.key === key), 'the ray can take it - pressed, it opens as any pile');
  assert.equal(t.w.dungeonPool.pileFor(key), pile);
  assert.deepEqual(t.w.dungeonPool.lootFinds().find((f) => f.items === row.items)?.mark, REMAINS_MARK, 'its line of light');
  assert.deepEqual(t.w.dungeonPool.snapshotScene(), [], 'no scene cache carries it');
  assert.deepEqual(t.w.dungeonPool.snapshotWorld(() => ({ x: 0, z: 0 })), [], 'no save carries it');
  assert.equal(t.w.dungeonPool._piles.filter((p) => !p.unsaved).length, 0, 'nor the dungeon\'s own save (its droppedLoot filter)');
  // a second frame keeps the one body
  assert.equal(frame(t), 1);
  assert.equal(t.w.dungeonPool._piles.length, 1, 'never laid twice');
  // another dungeon: nothing; the street: nothing for a dungeon row
  t.w.castle = { regionIndex: 23, locationIndex: 8 };
  assert.equal(frame(t), 0, 'another dungeon stands none');
  assert.equal(t.w.dungeonPool._piles.length, 0, 'and the body let go');
  t.w.castle = { ...CASTLE }; t.w.mode = 'exterior'; t.w.pos = [0, 0, 0];
  assert.equal(frame(t), 0, 'the street stands none for a death underground');
  assert.equal(t.w.streetPool._piles.length, 0);
});

test('AUDIT FB1013d O1: a MADE dungeon is no table row - every spawn of a region is its locationIndex -1 - so where the fallen lie underground is their dungeon\'s row AND its pixel: a spawn of her region on another pixel stands no body and opens no list on the very spot, her own spawn does, and the Arena\'s floor on Daggerfall\'s pixel is not Castle Daggerfall - a row written before its key was kept included (mutants: a made dungeon by its row alone; the pixel\'s x or y unread; the row\'s index unread)', () => {
  // three spawns of one template in Wayrest's region, as the world mints them (world/spawnedDungeons.js), each on its pixel
  const template = { name: 'Ruins of Old Hold', regionIndex: 5, locationIndex: 40, hasDungeon: true, mapTableData: { mapId: 777 }, exterior: { exteriorData: { locationId: 9 } }, dungeon: { recordElement: { header: { locationId: 9 } }, blocks: [{}] } };
  const spawn = (px, py) => ({ loc: synthesizeDungeonLocation(template, { salt: WORLD_SALT, px, py, where: { regionIndex: 23 } }), pixel: { x: px, y: py } });
  const A = spawn(310, 205), B = spawn(310, 209), C = spawn(314, 205);
  assert.deepEqual([summaryOf(A.loc), summaryOf(B.loc), summaryOf(C.loc)].map((d) => d.locationIndex), [-1, -1, -1], 'no table row');
  assert.deepEqual(summaryOf(A.loc), summaryOf(B.loc), 'one summary for every spawn of the region');
  const enter = (t, d) => { t.w.castle = summaryOf(d.loc); t.w.key = keyOf(d.loc); t.w.pixel = { ...d.pixel }; };   // inside, the GPS is the dungeon's own pixel
  for (const before of [false, true]) {
    const t = house();
    enter(t, A);
    const row = fallAndHeir(t);
    assert.deepEqual(row.place.pixel, A.pixel, 'she fell in the spawn on her pixel');
    // a row written before the audit kept no key and no size: its row and its pixel still name her spawn
    if (before) { delete row.place.dungeon.key; delete row.place.dungeon.size; }
    // the heir in another spawn of the region, on the very coordinates she fell at: not where she lies
    for (const other of [B, C]) {
      enter(t, other); t.w.pos = [10, -5, 30];
      assert.equal(t.world.legacyAtPlace(row.place), false, `the spawn at ${other.pixel.x},${other.pixel.y} is not hers`);
      t.host.tick();
      assert.equal(t.w.opened.length, 0, 'no list opens there');
      assert.equal(frame(t), 0, 'no body stands there');
      assert.equal(t.w.dungeonPool._piles.length, 0);
    }
    // her own spawn: the body stands, and the list opens on the spot
    enter(t, A);
    assert.equal(frame(t), 1, 'her own spawn stands her');
    assert.ok(pileOf(t.w.dungeonPool, row));
    assert.equal(t.world.legacyAtPlace(row.place), true);
  }
  // the row's index still counts beside the pixel: the Arena's floor (made, -1) stands on Daggerfall's pixel, whose own
  // castle is the city's table row - a death in Castle Daggerfall lies in the castle, never on the arena's sand (a row from
  // before the key, where the row and the pixel are all there is)
  const d = house();
  const daggerfall = { x: 207, y: 213 };
  d.w.castle = { regionIndex: ARENA_REGION, locationIndex: ARENA_LOCATION }; d.w.pixel = { ...daggerfall };
  const castleRow = fallAndHeir(d);
  delete castleRow.place.dungeon.key; delete castleRow.place.dungeon.size;
  const sand = arenaFloorLocation({ city: { regionIndex: ARENA_REGION, regionName: 'Daggerfall' } });
  d.w.castle = summaryOf(sand); d.w.key = keyOf(sand); d.w.pixel = { ...daggerfall };
  assert.equal(d.world.legacyAtPlace(castleRow.place), false, 'the arena floor is not the castle');
  assert.equal(frame(d), 0, 'no body on the sand');
  d.w.castle = { regionIndex: ARENA_REGION, locationIndex: ARENA_LOCATION }; d.w.key = CASTLE_KEY;
  assert.equal(frame(d), 1, 'the castle stands her');
});

test('AUDIT FB1013d B1: and the dungeon\'s own key and the size it was built at - the Arena\'s Undercroft is its city\'s row on its city\'s pixel, so a death there is no death in Castle Daggerfall nor one in the castle there; a dungeon built at another size (Smaller Dungeons) is another layout and stands none (mutants: the key unkept; the key unread; the size unkept; the size unread; a row without them read as none)', () => {
  // Daggerfall, its castle the city's own row and key, and the Undercroft the city mints (world/arena/arenaCity.js)
  const daggerfallPx = { x: 207, y: 213 };
  const city = {
    name: 'Daggerfall', regionName: 'Daggerfall', regionIndex: ARENA_REGION, locationIndex: ARENA_LOCATION, politic: 0, climate: { worldClimate: 227, climateType: 2 },
    mapTableData: { mapId: 4242, locationType: 0 }, exterior: { recordElement: { header: { x: 1, y: 2 } } },
    hasDungeon: true, dungeon: { recordElement: { header: { locationId: 7007 } }, blocks: [] },
  };
  const under = undercroftLocation(city);
  assert.deepEqual(summaryOf(under), summaryOf(city), 'the Undercroft wears its city\'s row');
  assert.notEqual(keyOf(under), keyOf(city), 'its own key');
  const enter = (t, loc) => { t.w.castle = summaryOf(loc); t.w.key = keyOf(loc); t.w.dungeonLoc = loc; t.w.pixel = { ...daggerfallPx }; };
  // fallen in the Undercroft: the heir in the castle stands none and opens nothing on the very spot; the Undercroft stands her
  let t = house();
  enter(t, under);
  let row = fallAndHeir(t);
  assert.deepEqual(row.place.dungeon, { ...summaryOf(under), key: keyOf(under), size: 'full' });
  enter(t, city);
  assert.equal(t.world.legacyAtPlace(row.place), false, 'the castle is not the Undercroft');
  t.host.tick();
  assert.equal(t.w.opened.length, 0);
  assert.equal(frame(t), 0, 'no body in the castle');
  enter(t, under);
  assert.equal(frame(t), 1, 'the Undercroft stands her');
  // and the other way: fallen in the castle, none in the Undercroft
  t = house();
  enter(t, city);
  row = fallAndHeir(t);
  enter(t, under);
  assert.equal(frame(t), 0, 'no body in the Undercroft');
  assert.equal(t.world.legacyAtPlace(row.place), false);
  enter(t, city);
  assert.equal(frame(t), 1, 'the castle stands her');
  // a row from before the key: its row and its pixel (nothing tells the two apart there - recorded, Audit-FB1013d.md)
  const old = { ...row.place, dungeon: { regionIndex: row.place.dungeon.regionIndex, locationIndex: row.place.dungeon.locationIndex } };
  assert.equal(t.world.legacyAtPlace(old), true, 'a row without a key still names its own dungeon');
  // SMALLER DUNGEONS: one location built whole and at the medium size (smallerDungeons.js's own regeneration) - two layouts
  const blocks = [...Array.from({ length: 8 }, (_, i) => ({ blockName: `N000000${i}.RDB`, x: i, z: 0, isStartingBlock: i === 0 })), ...Array.from({ length: 4 }, (_, i) => ({ blockName: `B000000${i}.RDB`, x: i, z: 1, isStartingBlock: false }))];
  const keep = { name: 'Old Keep', regionName: 'Wayrest', regionIndex: 23, locationIndex: 12, hasDungeon: true, mapTableData: { mapId: 123457 }, dungeon: { recordElement: { header: { locationId: 8008 } }, blocks } };
  const medium = generateMediumDungeon(keep);
  assert.deepEqual([builtDungeonSize(keep), builtDungeonSize(medium)], ['full', 'medium']);
  t = house();
  t.w.pixel = { x: 300, y: 200 }; t.w.castle = summaryOf(keep); t.w.key = keyOf(keep); t.w.dungeonLoc = keep;
  row = fallAndHeir(t);
  assert.equal(row.place.dungeon.size, 'full', 'she fell in the whole keep');
  t.w.dungeonLoc = medium;
  assert.equal(t.world.legacyAtPlace(row.place), false, 'the medium keep is another layout');
  assert.equal(frame(t), 0, 'no body stands in it - her floor position is some other room there, or none');
  t.w.dungeonLoc = keep;
  assert.equal(frame(t), 1, 'the whole keep stands her');
});

test('AUDIT FB1013d C4: a take through the body on the very spot is the heir\'s claim - the body\'s window holds the slot, so the list\'s own door is refused and the step makes the list ready every second; noted once, the take still reads as a change (mutant: the list noted again at every step)', () => {
  const t = house();
  const row = fallAndHeir(t);
  t.w.pos = [11, -5, 30];   // a pace from the body: inside the list's six paces and the press's reach
  assert.equal(frame(t), 1);
  const pile = pileOf(t.w.dungeonPool, row);
  t.w.slotHeld = true;   // the body's window is up
  t.host.tick();
  assert.equal(t.w.opened.length, 0, 'the list\'s own door refused');
  const heirloom = pile.items.find(isHeirloom);
  applyTransfer(heirloom, planTake(heirloom, { bag: t.e.items, entity: t.e }), pile.items, t.e.items, { entity: t.e, toPlayer: true });
  t.host.tick();
  assert.equal(row.by, t.host.current().id, 'taken through the body on the spot: the heir\'s claim');
});

test('AUDIT FB1013d A1: a claim that lapses as a body is stood - its claimant fallen for good in another tab, the death merged into this page\'s copy between the tick and the stand - lays the bones they carried off again at once, so the list is noted whole and their return is nobody\'s claim (mutant: the lapse lays no bones)', () => {
  const t = house();
  const row = fallAndHeir(t);
  const fam = t.host.family, me = t.host.current();
  // Bran, a living member played in another tab, claimed her remains and carried the bones home
  const bran = { ...JSON.parse(JSON.stringify(me)), id: 98, given: 'Bran', characterId: 'c-bran' };
  fam.people.push(bran);
  row.by = bran.id; row.state = 'taken'; row.items.splice(row.items.findIndex(isRemainsItem), 1);
  t.w.pos = [40, -5, 30];
  t.host.tick();
  assert.equal(frame(t), 0, 'Bran\'s claim: no body for the one played');
  // Bran falls for good there: the store's merge brings the death in after the tick's own read, before the stand
  bran.died = { at: 700, cause: 'fell' };
  assert.equal(frame(t), 1, 'the claim lapsed: the body stands');
  assert.equal(row.by, null);
  assert.equal(row.items.filter(isRemainsItem).length, 1, 'the bones Bran carried off lie again at once');
  assert.ok(pileOf(t.w.dungeonPool, row).items.some(isRemainsItem), 'in the body\'s list');
  t.host.tick(); frame(t); t.host.tick();
  assert.equal(row.by, null, 'nobody\'s - the one played touched nothing');
  assert.equal(row.items.filter(isRemainsItem).length, 1, 'one set of bones');
});

test('AUDIT FB1013d A2: a load replaces every list (adopt) - a body stood over an old one goes at once, stood again over the new; and the world\'s slow tick opens no list and stands no body while the world is moved (mutants: the bodies kept over a load; the tick run while the world is moved)', () => {
  const t = house();
  const row = fallAndHeir(t);
  t.w.pos = [40, -5, 30];
  t.host.tick();
  const saved = modSaveRecords();   // a save here holds her row
  assert.equal(frame(t), 1);
  const stale = pileOf(t.w.dungeonPool, row);
  // the load lands its record (the dungeon's own load: modSaveLoad before restoreSaved - whose pool a save made at another
  // size never restores), and every row's list is a new one
  restoreModSaveRecords(saved);
  const row2 = t.host.family.remains[0];
  assert.notEqual(row2.items, row.items, 'the load replaced the list');
  assert.ok(!t.w.dungeonPool._piles.includes(stale), 'the body over the old list let go at the load, before any press could open it');
  assert.equal(t.w.dungeonPool._piles.length, 0, 'none stands');
  assert.equal(frame(t), 1, 'stood again');
  assert.equal(pileOf(t.w.dungeonPool, row2)?.items, row2.items, 'over the record\'s new list');
  // the world's own slow tick (legacyStep, off its text), while the world is moved (worldMoveBusy - a load's awaits)
  t.world.legacyRemainsStand.clear();
  let busy = true, ticks = 0;
  const host = { tick: () => { ticks += 1; return t.host.tick(); }, remainsToStand: () => t.host.remainsToStand() };
  const legacyStep = new Function('legacyHost', 'worldMoveBusy', 'setLootMarksLive', 'legacyRemainsStand', 'successionOpen', 'townTalk', 'modes', 'openLegacyDeadLoad', 'openLegacySuccession',
    `let _legacyT = 0;\n${STEP}\nreturn legacyStep;`)(host, () => busy, setLootMarksLive, t.world.legacyRemainsStand, () => false, { overlayActive: false }, null, () => {}, () => {});
  t.w.pos = [10, -5, 30];   // on the very spot: the list's own window would open
  for (let i = 0; i < 3; i++) legacyStep(1);
  assert.equal(ticks, 0, 'no tick while the world is moved');
  assert.equal(t.w.opened.length, 0, 'no list opened');
  assert.equal(t.w.dungeonPool._piles.length, 0, 'no body stood');
  busy = false;
  legacyStep(1);
  assert.equal(ticks, 1, 'the world still: the tick runs');
  assert.ok(pileOf(t.w.dungeonPool, row2), 'and the body stands');
  setLootMarksLive(false, 'legacy');
});

test('AUDIT FB1013d A3: the bones put back into their own list - through a window held open across the step that marked them carried - lie again there: the claim kept, the body stood again, the ring back, the line said (mutant: a taken row with its bones back in its list stays taken)', () => {
  const t = house();
  const row = fallAndHeir(t);
  t.w.pos = [40, -5, 30];
  frame(t);
  const list = pileOf(t.w.dungeonPool, row).items;   // the body's window holds this list open
  const bones = list.find(isRemainsItem);
  applyTransfer(bones, planTake(bones, { bag: t.e.items, entity: t.e }), list, t.e.items, { entity: t.e, toPlayer: true });
  t.host.tick();
  assert.equal(row.state, 'taken');
  const me = t.host.current().id;
  assert.equal(row.by, me);
  assert.equal(frame(t), 0, 'carried: no body');
  assert.equal(t.host.mapMarks().length, 0, 'carried: no ring');
  // back into the still-open window's list - its own mark lets them in (AUDIT LEGACY II H4)
  const plan = planStore(bones, { remote: list });
  assert.equal(plan.ok, true);
  applyTransfer(bones, plan, t.e.items, list, { entity: t.e, fromLocal: true });
  t.w.said.length = 0;
  t.host.tick();
  assert.equal(row.state, 'lying', 'they lie again where they are');
  assert.equal(row.by, me, 'the claim the claimant\'s');
  assert.deepEqual(t.w.said, [LEGACY_TEXT.remainsReturned(row.name)]);
  assert.equal(frame(t), 1, 'the body stands again');
  assert.equal(t.host.mapMarks().length, 1, 'the ring is back');
});

test('REMAINS-STAND: the body IS the record\'s list - a take from it is the heir\'s claim, the bones go back into it and into no other pile, carried home it is let go; stood again at every change of its pool or its list; none with the switch off, for a waiting Succession, on a page not the one played\'s, before chargen, for a dead current, or for another living member\'s claimed search (mutants: the frame\'s five lets-go; remainsToStand\'s guards - the past\'s recorded equivalent; AUDIT FB1013d C3: every row stood; C7: before chargen, for the dead)', () => {
  const t = house();
  const row = fallAndHeir(t);
  t.w.pos = [40, -5, 30];
  frame(t);
  let pile = pileOf(t.w.dungeonPool, row);
  // the window's take, on the body, of the heirloom: the record's list loses it, and the heir claims it
  const heirloom = pile.items.find(isHeirloom);
  const take = planTake(heirloom, { bag: t.e.items, entity: t.e });
  assert.equal(take.ok, true);
  applyTransfer(heirloom, take, pile.items, t.e.items, { entity: t.e, toPlayer: true });
  assert.ok(!row.items.includes(heirloom) && t.e.items.includes(heirloom), 'out of the record\'s list, into the pack');
  t.host.tick();
  assert.equal(row.by, t.host.current().id, 'changed through the body: the heir\'s claim');
  // the bones go back into it (they bear its mark) and into no other pile
  const bones = row.items.find(isRemainsItem);
  applyTransfer(bones, planTake(bones, { bag: t.e.items, entity: t.e }), pile.items, t.e.items, { entity: t.e, toPlayer: true });
  assert.equal(planStore(bones, { remote: pile.items }).ok, true, 'back into its own list');
  const other = t.w.dungeonPool.dropPile([sword()], [0, 0, 0]);
  assert.equal(planStore(bones, { remote: other.items }).ok, false, 'never into another pile');
  t.w.dungeonPool.removePile(other);
  // carried home: let go
  t.host.tick();
  assert.equal(row.state, 'taken');
  assert.equal(frame(t), 0, 'taken home: no body');
  assert.ok(!t.w.dungeonPool._piles.includes(pile), 'let go from its pool');
  // laid again (the heir dropped the bones nowhere they could keep them): the body stands again
  t.e.items = t.e.items.filter((it) => it !== bones);
  t.host.tick();
  assert.equal(row.state, 'lying');
  assert.equal(frame(t), 1);
  pile = pileOf(t.w.dungeonPool, row);
  assert.ok(pile);
  // its pile let go under it (a rebuild), or put away emptied (releaseEmptied): stood again from the record
  t.w.dungeonPool.removePile(pile);
  assert.equal(frame(t), 1);
  const again = pileOf(t.w.dungeonPool, row);
  assert.ok(again && again !== pile, 'stood again');
  again.inactive = true;
  assert.equal(frame(t), 1);
  assert.ok(pileOf(t.w.dungeonPool, row) && !pileOf(t.w.dungeonPool, row).inactive, 'an inactive one stood afresh');
  // another pool (the dungeon built anew): let go from the old, stood in the new
  const old = t.w.dungeonPool;
  t.w.dungeonPool = groundPool();
  assert.equal(frame(t), 1);
  assert.equal(old._piles.length, 0, 'let go from the old pool');
  assert.ok(pileOf(t.w.dungeonPool, row), 'stood in the new');
  // the record's list replaced (a load's merge): stood again over the new list
  const before = pileOf(t.w.dungeonPool, row);
  row.items = row.items.map((it) => ({ ...it }));
  assert.equal(frame(t), 1);
  assert.equal(pileOf(t.w.dungeonPool, row)?.items, row.items, 'the body\'s list is the record\'s new one');
  assert.ok(!t.w.dungeonPool._piles.includes(before), 'the old list\'s body gone');
  // the switch off: none; a waiting Succession: none; a page not the one played's: none (the past played back is such a
  // page - adopt leaves the line's current where it stands; its guard, the tick's own, is recorded as equivalent)
  t.w.on = false;
  assert.deepEqual(t.host.remainsToStand(), []);
  assert.equal(frame(t), 0);
  t.w.on = true;
  assert.equal(frame(t), 1);
  const fam = t.host.family;
  fam.pending = { fallenId: row.of, at: 1, estate: 0, bequest: [] };
  assert.deepEqual(t.host.remainsToStand(), [], 'a waiting Succession stands none');
  fam.pending = null;
  t.host.current().characterId = 'c-someone-else';
  assert.deepEqual(t.host.remainsToStand(), [], 'a page not the one played\'s stands none');
  t.host.current().characterId = 'c-heir';
  // chargen runs inside the world (world.js's boot walk), and a page with no character yet is everyone's (playedHere):
  // none before it is done (AUDIT FB1013d C7); nor for a current member dead with no Succession waiting
  t.e.chargenDone = false;
  assert.deepEqual(t.host.remainsToStand(), [], 'before chargen is done: none');
  t.e.chargenDone = true;
  t.host.current().died = { at: 900, cause: 'fell' };
  assert.deepEqual(t.host.remainsToStand(), [], 'a dead current: none');
  delete t.host.current().died;
  // AUDIT FB1013d C3: another living member's claimed search is theirs - the rows the one played may seek (openRemains),
  // never every row of the line: none stands for the one played, and nothing of it is theirs to empty
  const bran = { ...JSON.parse(JSON.stringify(t.host.current())), id: 98, given: 'Bran', characterId: 'c-bran' };
  fam.people.push(bran);
  const mine = row.by;
  row.by = bran.id;
  assert.deepEqual(t.host.remainsToStand(), [], 'Bran\'s search stands none for the one played');
  assert.equal(frame(t), 0);
  row.by = mine;
  assert.equal(frame(t), 1);
  t.world.legacyRemainsStand.clear();
  assert.equal(t.w.dungeonPool._piles.length, 0, 'clear lets every body go');
});

test('REMAINS-STAND: in the open - the body stands at the native spot where she fell, at the height she stood (a roof), once its pixel is built, and dies with its pixel; a row laid before the height was kept stands on the ground; a building\'s death stands none; the height is the death\'s to ask, never the tick\'s (mutants: the height dropped; the pixel\'s key; a building row stood; AUDIT FB1013d B2: the lift on every read; the death\'s height unasked)', () => {
  const t = house();
  t.w.mode = 'exterior'; t.w.comp = [0, 3, 0]; t.w.pos = [5, 9, 7]; t.w.ground = 1;
  // a roof at nine metres over the spot, and a floor over it at twelve and a half (a tower's): a height read wrong either
  // way stands her on the floor above or on the ground below (AUDIT FB1013d C1)
  const roofed = (y) => ({ y, x0: 2, x1: 8, z0: 4, z1: 10 });
  t.w.floors = [roofed(9), roofed(12.5)];
  // AUDIT FB1013d B2: where the one played stands, as the slow tick asks it every second, is the spot alone - the lift (a
  // field's kernel pass on the first pixel the main thread asks it of) is the death's to ask
  assert.deepEqual(t.world.legacyHere().world, { x: 5 * 40 + 1000, z: 7 * 40 + 2000 }, 'the tick\'s read: no height');
  assert.equal(t.w.lifts, 0, 'no lift asked');
  const row = fallAndHeir(t);
  assert.equal(row.place.mode, 'exterior');
  assert.deepEqual(row.place.world, { x: 5 * 40 + 1000, z: 7 * 40 + 2000, y: 9 - 3 - liftAt(5, 7), terrainScale: SCALE }, 'the death\'s place: the native spot and the height she stood at - a record\'s: in DFU\'s frame (the spot\'s own lift off), on the ground it was measured on');
  assert.equal(t.w.lifts, 1, 'the death asked it, once');
  // the heir comes back on the pixel: the body stands on the roof she fell from
  t.w.pos = [60, 1, 60];
  t.host.tick();
  assert.equal(frame(t), 1);
  assert.equal(t.w.lifts, 1, 'the heir\'s tick and stand over her lying row ask no lift');
  let pile = pileOf(t.w.streetPool, row);
  assert.deepEqual(pile.pos, [5, 9, 7], 'where she fell, on the roof');
  assert.equal(pile.pixelKey, '300,200', 'it dies with its pixel');
  t.w.streetPool.collectPixel('300,200');
  assert.ok(!t.w.streetPool._piles.includes(pile), 'the pixel collected');
  t.w.built = false;
  assert.equal(frame(t), 0, 'its pixel not built: none stands');
  t.w.built = true;
  assert.equal(frame(t), 1, 'built again: stood again');
  pile = pileOf(t.w.streetPool, row);
  // an older row with no height kept: on the ground (a mesh under the ground's half metre would hold it)
  const flat = { ...row.place, world: { x: row.place.world.x, z: row.place.world.z } };
  assert.deepEqual(t.world.legacyRemainsFeet(flat), [5, 1, 7], 'on the ground');
  // AUDIT FB1013d C6: a death in the air (levitating, a fall) over open ground of the pixel lies on the ground - the
  // floor is found under where the height stands her, never the height itself
  const aloft = { ...row.place, world: { ...row.place.world, x: 20 * 40 + 1000, z: 30 * 40 + 2000, y: row.place.world.y + 30 } };
  assert.deepEqual(t.world.legacyRemainsFeet(aloft), [20, 1, 30], 'landed, never in the air');
  // a building's death: its law is the town's street (any spot of the pixel opens the list), and no body stands for it
  assert.equal(t.world.legacyRemainsFeet({ ...row.place, mode: 'interior', world: null }), null);
  t.w.mode = 'interior';
  assert.equal(t.world.legacyRemainsFeet(row.place), null, 'indoors no street body stands');
  assert.equal(frame(t), 0);
  assert.equal(t.w.roomPool._piles.length, 0);
});

test('LIVE-FIGHT: the remains\' fight is the place the one played stands in - a street walker latched as the heir went down keeps no visit "in a fight", and the list opens on the spot; the dungeon\'s and the building\'s own foes still hold it, and so do a duel and a hostile ship (mutants: the street\'s pools read underground; a building\'s pool unread; AUDIT FB1013d B3: the duel unread; the ship unread; C5: the watch unread outdoors)', () => {
  const t = house();
  const row = fallAndHeir(t);
  const latched = { dead: false, ai: { wouldBeSpawned: true, detected: false, inSight: false, isHostile: true } };   // sensed in the street as the heir went in, frozen since
  t.w.streetFoes.push(latched);
  t.w.pos = [12, -5, 31];
  assert.equal(t.world.legacyAtPlace(row.place), true, 'on the spot');
  assert.equal(t.world.inFight(), false, 'the street is not the castle');
  t.host.tick();
  assert.equal(t.w.opened.length, 1, 'the list opens where she fell');
  assert.equal(t.w.opened[0], row.items);
  // the castle's own hostile guard, seeing her: a fight
  const guard = { dead: false, ai: { wouldBeSpawned: true, detected: true, inSight: true, targetIsLocalPlayer: true, isHostile: true } };
  t.w.insideFoes = [guard];
  assert.equal(t.world.inFight(), true, 'the dungeon\'s own foe is the fight');
  // in the street the street's foes are the fight, and a building's own pool indoors
  t.w.insideFoes = [];
  t.w.mode = 'exterior';
  assert.equal(t.world.inFight(), true, 'outdoors the street walker counts');
  // AUDIT FB1013d C5: and the watch with them (exteriorFoePool) - a hostile guard outdoors, the walker gone
  t.w.streetFoes.length = 0; t.w.streetGuards.push({ ...guard });
  assert.equal(t.world.inFight(), true, 'outdoors a hostile guard counts');
  t.w.streetGuards.length = 0; t.w.streetFoes.push(latched);
  t.w.mode = 'interior';
  assert.equal(t.world.inFight(), false, 'indoors the street does not');
  t.w.insideFoes = [guard];
  assert.equal(t.world.inFight(), true, 'the building\'s own foe does');
  // AUDIT FB1013d B3: and the fights the host's rest refusal reads beside the pools, in every mode - a duel or the one
  // played's own bout (duelEnemyNear), a hostile ship in reach (navalHostileNear): no list opens, no switch, mantle or
  // wedding in them
  t.w.insideFoes = []; t.w.streetFoes.length = 0;
  for (const mode of ['exterior', 'interior', 'dungeon']) {
    t.w.mode = mode;
    assert.equal(t.world.inFight(), false, `${mode}: no fight`);
    t.w.duel = true;
    assert.equal(t.world.inFight(), true, `${mode}: a duel, or my bout on the sand`);
    t.w.duel = false; t.w.ship = true;
    assert.equal(t.world.inFight(), true, `${mode}: a hostile ship in reach`);
    t.w.ship = false;
  }
});

test('REMAINS-STAND: the line and the find - its own mark stands its line with the rarity row off, the open zone\'s word never puts it out; it holds no silver find; the hosts by source (mutants: the mark dropped from lootFinds; one word for every kind; the find rolled)', () => {
  _resetForTests(); setPref('lootRarity', false);
  const pool = groundPool();
  const items = [{ group: 'UselessItems2', templateIndex: 1810, name: 'The remains of X' }];
  const stand = createRemainsStand({ pool: () => pool, feetOf: () => [1, 0, 1], icon: REMAINS_FLAT, label: () => 'The remains of X' });
  assert.equal(stand.frame([{ id: 'r1', of: 1, state: 'lying', items, place: {} }]), 1);
  const pile = pool._piles[0];
  const finds = pool.lootFinds();
  assert.deepEqual(finds[0].mark, REMAINS_MARK);
  const calls = [];
  const gl = new Proxy({ ARRAY_BUFFER: 1, STATIC_DRAW: 2, FLOAT: 3, TRIANGLES: 4, BLEND: 5, ONE: 6, CULL_FACE: 7 }, {
    get(o, k) { if (k in o) return o[k]; return (...a) => { calls.push([k, ...a]); if (k === 'getShaderParameter' || k === 'getProgramParameter') return true; if (k === 'getUniformLocation') return a[1]; return {}; }; },
  });
  const pass = createLootLines(gl);
  const I = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  setLootMarksLive(true, 'legacy');
  setLootMarksLive(false);   // the open zone's word, every frame online: none of mine there
  assert.equal(pass.draw(() => pool.lootFinds(), I, I, [0, 1.6, 0], 1), true, 'the house\'s word keeps the pass: its line stands');
  assert.equal(pass.draw(() => pool.lootFinds(), I, I, [1, 1.6, 31], 1), true, 'seen across a hall: thirty metres off, its line stands (AUDIT FB1013d C8)');
  setLootMarksLive(false, 'legacy');
  assert.equal(pass.draw(() => pool.lootFinds(), I, I, [0, 1.6, 0], 1), false, 'no word left: off is DFU exactly');
  // no silver find in the remains
  _resetSilverFindsForTests();
  let asked = 0;
  setSilverFinder(() => { asked++; });
  assert.equal(silverFindAt('pile', pile, () => 0), false, 'the remains hold no find');
  assert.equal(silverFindAt('pile', { items: [] }, () => 0), true, 'another container still rolls');
  assert.equal(asked, 1);
  _resetSilverFindsForTests();
  // the hosts: the world host frames the stand after its tick (before any early answer), under the house's own word
  assert.match(W, /const said = legacyHost\.tick\(\);\n(?:\s*\/\/[^\n]*\n)*\s*setLootMarksLive\(legacyRemainsStand\.frame\(legacyHost\.remainsToStand\(\)\) > 0, 'legacy'\);\n\s*\/\/ AUDIT LEGACY A2/);
  assert.match(STAND, /pool: \(\) => \(\(modes\?\.mode \?\? 'exterior'\) === 'exterior' \? droppedLoot : \(modes\?\.droppedPool\?\.\(\) \?\? null\)\)/, 'the street\'s pool outdoors, the mode\'s own inside');
  assert.match(rd('src/scenes/worldModes.js'), /droppedPool\(\) \{ return mode === 'dungeon' \? \(dungeonCtx\?\.droppedPool\?\.\(\) \?\? null\) : mode === 'interior' \? interiorDropped : null; \}/, 'worldModes hands the dungeon\'s and the building\'s pools');
  const D = rd('src/scenes/dungeonContext.js');
  assert.match(D, /\n {4}floorAt: \(x, y, z\) => floorLanding\(collider, \[x, y \+ 0\.2, z\]\),/, 'the dungeon\'s floor under a point');
  assert.match(D, /droppedPool: \(\) => droppedLoot,/);
  assert.doesNotMatch(rd('src/scenes/exterior.js'), /createLegacyHost|createRemainsStand/, 'the fixed city keeps DFU\'s death: no house, no remains');
  _resetForTests();
});
