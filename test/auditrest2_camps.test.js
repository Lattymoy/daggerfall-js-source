// AUDIT REST II (2026-10-03, bible/06-Systems/Rest-Arc.md "AUDIT REST II"): the Campfire's lifecycle across the hosts,
// the saves and the shops, each finding pinned by execution where it can be. H1: a Recall out of a dungeon carries my
// Campfire out (only a load drops it), and the room hears a dropped fire go.
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createCamps } from '../src/scenes/camps.js';
import { createSurvivalItem } from '../src/systems/survival/items.js';
import { TEMPLATE } from '../src/systems/survival/food.js';
import { setPref, _resetForTests } from '../src/systems/uiPrefs.js';
import { setSharedClock, setWorldMinutes } from '../src/systems/worldTick.js';
import { teleportPlan, makeAnchor, WORLD_CONTEXT } from '../src/systems/teleportAnchor.js';
import { packSavedFires, CAMP_KIND, campMenu, CAMP_TEXT } from '../src/systems/survival/camp.js';
import { repairRefusal } from '../src/systems/repairService.js';
import { stockShopShelf } from '../src/systems/shopStock.js';
import { BUILDING_TYPES } from '../src/world/buildingNames.js';
import { provisionsStock } from '../src/systems/survival/items.js';
import { createRestItem, REST_ITEM, REST_ITEM_TEXT, litCandle, snuffCandle, _setRestItemsOnlineForTests } from '../src/systems/restItems.js';
import { itemUseHandler } from '../src/systems/itemTemplates.js';
import { applyCustoms, customsLines } from '../src/systems/realmCustoms.js';
import { newSurvival, survivalMinute } from '../src/systems/survival/needs.js';
import { restItemLines, restItemsStock } from '../src/systems/restItems.js';

const rd = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const flat = () => (o, d, m) => (d[1] < 0 && m >= o[1] ? o[1] : null);
afterEach(() => { setSharedClock(null); _resetForTests(); });
const pool = (entity, { said = [], place = {}, onChanged = null } = {}) => createCamps({
  entity, camera: () => ({ feet: [0, 1, 0], yaw: 0 }), collider: () => ({ raycast: flat() }), place: () => place,
  say: (l) => said.push(l), openRest: () => {}, showOverlay: () => {}, onChanged,
});

test('AUDIT REST II H1: a Recall or an anchor teleport out of a dungeon carries my Campfire out - only a load, said by its own flag, drops it; the room hears a dropped fire go (mutants: the camps arm read off cacheScene; the load unsaid; dropOwn silent)', () => {
  // the trap: a dungeon caches nothing, so every teleport out of one passes cacheScene false - as the load does
  const plan = teleportPlan(makeAnchor({ worldContext: WORLD_CONTEXT.Exterior, pixel: { x: 1, y: 1 }, nativeX: 0, nativeZ: 0 }), { insideDungeon: true });
  assert.equal(plan.kind, 'cross');
  assert.equal(plan.cacheScene, null, 'a dungeon caches nothing (Teleport.cs :145-151)');
  const wm = rd('src/scenes/worldModes.js');
  assert.match(wm, /forceExitToExterior\(\{ cacheScene = true, load = false \} = \{\}\) \{/);
  assert.match(wm, /\n {6}if \(dungeonCtx\) \{ if \(load\) dungeonCtx\.camps\?\.dropOwn\?\.\(\); else carried = dungeonCtx\.camps\?\.packOwnFires\?\.\(\{ quiet: true \}\) \?\? 0; \}\n {6}if \(dungeonCtx\) \{\n {8}host\.onDungeonLeave\?\.\(\);/,
    'the forced exit packs unless it is a load - before the leave hook publishes the room');
  // the load says so, and nothing else does: every forced exit in the tree, by its flags
  const calls = ['world.js', 'exterior.js', 'worldModes.js'].flatMap((f) => [...rd(`src/scenes/${f}`).matchAll(/forceExitToExterior\??\.?\(([^)]*)\)/g)].map((m) => [f, m[1]]));
  const loads = calls.filter(([, a]) => /load: true/.test(a));
  assert.deepEqual(loads, [['world.js', '{ cacheScene: false, load: true }']], 'one load, the quickload\'s');
  assert.match(rd('src/scenes/world.js'), /\/\/ above\), and DFU's load path deregisters rather than\n\s+\/\/ serializes it \(:464\)\.\n\s+if \(\(modes\?\.mode \?\? 'exterior'\) !== 'exterior'\) modes\?\.forceExitToExterior\(\{ cacheScene: false, load: true \}\);/, 'at the load (IS1\'s arm)');
  for (const f of ['world.js', 'exterior.js']) assert.match(rd(`src/scenes/${f}`), /modes\?\.forceExitToExterior\(\{ cacheScene: plan\.cacheScene === 'building' \}\);/, `${f}'s Recall is no load`);
  // the pool: a load's drop tells the room (a walk out's pack always did), and a drop of nothing says nothing
  _resetForTests(); setPref('survival', true); setWorldMinutes(1000);
  let told = 0;
  const fire = createSurvivalItem(TEMPLATE.Campfire);
  const entity = { items: [fire] };
  const p = pool(entity, { place: { insideDungeon: true }, onChanged: () => told++ });
  assert.equal(p.placeItem(fire, entity.items), true);
  told = 0;
  p.dropOwn();
  assert.deepEqual([p.camps.length, told], [0, 1], 'dropped, and the room told');
  p.dropOwn();
  assert.equal(told, 1, 'nothing dropped, nothing said');
});

test('AUDIT REST II H2: a building\'s hearth rests as every host\'s does - its pool opens the rest (the picker leaving the slot first) and its click carries the plaque\'s lit row (mutants: no openRest; the plaque row dropped)', () => {
  const wm = rd('src/scenes/worldModes.js');
  const pool = wm.slice(wm.indexOf('const interiorCamps = createCamps({'), wm.indexOf('});', wm.indexOf('const interiorCamps = createCamps({')));
  assert.match(pool, /hearths: \(\) => interiorHearths,/, 'the interior\'s own pool');
  assert.match(pool, /openRest: \(\) => \{ if \(interiorOverlay\?\.done\) \{ interiorOverlay = null; interiorWindows\.reconcile\(null\); \} interiorKeyCtx\.toggleRest\(\); \},/);
  assert.match(wm, /if \(key\.startsWith\('hearth:'\)\) \{ interiorCamps\.activate\(key, getInteractionMode\(\), plaqueActionFor\(key\)\); return true; \}/);
  // and on the pool, the lit Rest row opens the rest whether or not the arc's clock is shared - offline it is DFU's rest
  let rests = 0;
  for (const online of [false, true]) {
    setSharedClock(online ? () => 1000 : null);
    _resetForTests(); setPref('survival', true);
    const p = createCamps({ entity: { items: [] }, hearths: () => [{ x: 0, y: 1, z: 0 }], camera: () => ({ feet: [0, 1, 0], yaw: 0 }), say: () => {}, showOverlay: () => {}, openRest: () => rests++ });
    assert.equal(p.activate('hearth:0', 'grab', 'rest'), true);
  }
  assert.equal(rests, 2, 'Rest here rests, online and off - never the cooking list');
});

test('AUDIT REST II H3: a dungeon rest tends my Campfire through the night - its frame is held under the rest, so the tending is asked by the rest\'s own advance; offline the fire is lit at the wake and the night spends its charge (mutants: the advance never tends; tend a no-op)', () => {
  assert.match(rd('src/scenes/dungeonContext.js'), /const _restAdvance = \(n\) => \{[\s\S]{0,1200}?\n {4}advanceOwnMinutes\(n\);[^\n]*\n {4}camps\.tend\(\);/, 'the dungeon\'s advance tends');
  _resetForTests(); setPref('survival', true); setWorldMinutes(1000);
  const fire = createSurvivalItem(TEMPLATE.Campfire);
  const entity = { items: [fire], isResting: false, restKind: null };
  const p = pool(entity);
  assert.equal(p.placeItem(fire, entity.items), true);
  const rec = p.camps[0].rec;
  entity.isResting = true; entity.restKind = 'camp';
  for (let m = 1010; m <= 1490; m += 10) { setWorldMinutes(m); p.tend(); }   // the rest's advance, no frame between
  entity.isResting = false; entity.restKind = null;
  assert.equal(p.spendNightNear([0, 1, 0]), true, 'lit at the wake');
  assert.equal(rec.wear, 7, 'and the night paid');
});

test('AUDIT REST II H4: "You take your Campfire with you." is said where it can be seen - packed quiet, then said on the HUD that is up once the mode is outside, on the walk out and on a teleport; a load says nothing (mutants: said into the dying dungeon; never said outside)', () => {
  const wm = rd('src/scenes/worldModes.js');
  const walk = wm.slice(wm.indexOf('function exitDungeonNow() {'), wm.indexOf('host.applyWeaponPose?.(pose);', wm.indexOf('function exitDungeonNow() {')));
  assert.match(walk, /const carried = dungeonCtx\.camps\?\.packOwnFires\?\.\(\{ quiet: true \}\) \?\? 0;[\s\S]*\n {4}setMode\('exterior'\);\n {4}host\.unlockOn\?\.\(\);[^\n]*\n {4}if \(carried\) say\(CAMP_TEXT\.carriedOut\);/);
  const forced = wm.slice(wm.indexOf('forceExitToExterior({ cacheScene = true, load = false } = {}) {'), wm.indexOf('climbFeel.reset();', wm.indexOf('forceExitToExterior({ cacheScene = true, load = false } = {}) {')));
  assert.match(forced, /let carried = 0;[\s\S]*\n {6}setMode\('exterior'\);\n {6}host\.unlockOn\?\.\(\);[^\n]*\n {6}if \(carried\) say\(CAMP_TEXT\.carriedOut\);/);
  // the pool: quiet packs and says nothing; the default still says it once
  _resetForTests(); setPref('survival', true); setWorldMinutes(1000);
  for (const [quiet, want] of [[true, 0], [false, 1]]) {
    const said = [];
    const fire = createSurvivalItem(TEMPLATE.Campfire);
    const entity = { items: [fire] };
    const p = pool(entity, { said, place: { insideDungeon: true } });
    assert.equal(p.placeItem(fire, entity.items), true);
    said.length = 0;
    assert.equal(p.packOwnFires({ quiet }), 1, 'packed either way');
    assert.equal(said.filter((l) => /take your Campfire/.test(l)).length, want, quiet ? 'quiet: the caller says it' : 'the default says it');
  }
});

test('AUDIT REST II H5: a load that does not enter the dungeon carries my Campfires out of the save - an online page woken at a temple, a dungeon this world cannot find, one with no entrance here - with their fuel, never an Ember Jar\'s or a kit fire (mutants: the fires left in the save; a jar or a kit fire minted)', () => {
  const items = packSavedFires([
    { id: 'me:1:1', kind: CAMP_KIND.Fire, fuel: true, wear: 5, pos: [0, 0, 0] },
    { id: 'me:2:1', kind: CAMP_KIND.Fire, jar: true, wear: 1, pos: [0, 0, 0] },   // an Ember Jar's, as placeCampItem writes it: no fuel of its own
    { id: 'me:3:1', kind: CAMP_KIND.Fire, wear: 3, pos: [0, 0, 0] },
    { id: 'me:4:1', kind: CAMP_KIND.Tent, wear: 40, pos: [0, 0, 0] },
    null,
  ]);
  assert.deepEqual(items.map((it) => [it.templateIndex, it.currentCondition]), [[TEMPLATE.Campfire, 5]], 'the fuelled Campfire alone, its five nights with it');
  assert.deepEqual(packSavedFires(undefined), []);
  const w = rd('src/scenes/world.js');
  const branch = w.slice(w.indexOf("} else if (String(extras.locationKey ?? '').startsWith('dungeon:')) {"), w.indexOf("} else if (extras.locationKey && extras.locationKey !== 'world') {"));
  assert.match(branch, /const carrySavedFires = \(\) => \{\n\s+const items = packSavedFires\(extras\.world\?\.camps\);\n\s+if \(!items\.length\) return;\n\s+\(playerEntity\.items \?\?= \[\]\)\.push\(\.\.\.items\);\n\s+townTalk\.say\(CAMP_TEXT\.carriedOut\);/);
  assert.match(branch, /\n\s+if \(!pixel\) \{ standOuterCamps\(\); carrySavedFires\(\); \}/, 'a dungeon this world cannot find');
  assert.match(branch, /townTalk\.say\(undergroundWakeText\(wake\.kind\)\);\n\s+csaElsewhere = true;\n\s+standOuterCamps\(\); carrySavedFires\(\);/, 'the online wake at a temple');
  assert.match(branch, /\n\s+if \(!entered\) carrySavedFires\(\);/, 'a dungeon with no entrance here');
  assert.equal((branch.match(/carrySavedFires\(\)/g) ?? []).length, 3, 'three arms - and never the arm that enters (the dungeon stands them)');
});

test('AUDIT REST II H6: a dungeon save carries the camps I left standing outside, and every dungeon load stands the save\'s - no Campfire placed after the save beside the pack\'s restored one, none lost on a fresh page; a save from before carries none and what stands, stands (mutants: the composer drops them; the load never stands them; the host never hands them)', () => {
  assert.match(rd('src/scenes/dungeonContext.js'), /world: \{ \.\.\.collectWorld\(\), outerCamps: opts\.outerCampsSave\?\.\(\) \?\? null \},/);
  assert.match(rd('src/scenes/worldModes.js'), /outerCampsSave: \(\) => host\.outerCampsSave\?\.\(\) \?\? null,/);
  const w = rd('src/scenes/world.js');
  // AUDIT LANDFORMS C1 MOVED THIS PIN: in natives, with the height in DFU's frame (campToRecord - the Landforms row's lift
  // taken off, so a build without the row reads it as it always did)
  assert.match(w, /outerCampsSave: \(\) => camps\.snapshot\(campToRecord\),/);
  const branch = w.slice(w.indexOf("} else if (String(extras.locationKey ?? '').startsWith('dungeon:')) {"), w.indexOf("} else if (extras.locationKey && extras.locationKey !== 'world') {"));
  // AUDIT REST III A1 (RE-AIMED): the stand has one home now, the dungeon's own load's too - standSavedOuterCamps
  const stand = w.slice(w.indexOf('function standSavedOuterCamps(extras) {'), w.indexOf('camps.dropOwn(); camps.restore(rows, campFromNatives);') + 60);
  assert.match(stand, /const outer = extras\?\.world\?\.outerCamps;\n\s+if \(!Array\.isArray\(outer\)\) return;/, 'a save from before stands nothing new');
  assert.match(stand, /camps\.dropOwn\(\); camps\.restore\(rows, campFromNatives\);/);
  assert.match(branch, /const standOuterCamps = \(\) => standSavedOuterCamps\(extras\);/);
  assert.match(branch, /\n\s+if \(!entered\) carrySavedFires\(\);[^\n]*\n\s+standOuterCamps\(\);/, 'the arm that enters - in or out');
  assert.equal((branch.match(/standOuterCamps\(\)/g) ?? []).length, 3, 'every arm: lost, woken, entered');
  // the merge the load relies on: dropOwn then restore stands the save's own and nothing of the page's
  _resetForTests(); setPref('survival', true); setWorldMinutes(1000);
  const fire = createSurvivalItem(TEMPLATE.Campfire);
  const entity = { items: [fire] };
  const p = pool(entity);
  assert.equal(p.placeItem(fire, entity.items), true);
  const placedAfterSave = p.camps[0].rec.id;
  p.dropOwn(); p.restore([{ id: 'me:7:900', kind: CAMP_KIND.Fire, fuel: true, wear: 6, pos: [5, 1, 5], yaw: 0, litUntil: 1200, placedAt: 900 }]);
  assert.deepEqual(p.camps.map((c) => c.rec.id), ['me:7:900'], 'the save\'s camp, and not the one placed after it');
  assert.notEqual(placedAfterSave, 'me:7:900');
});

test('AUDIT REST II H7: no repair counter refills a Campfire\'s fuel or a supply\'s charges - "This cannot be repaired." for the Campfire, the Bedroll, the Candle and the Salts; C&C\'s own Camping Equipment mends as the mod has it (mutants: the flag off either row)', () => {
  const spent = (it, left) => { it.currentCondition = left; return it; };
  assert.equal(repairRefusal(spent(createSurvivalItem(TEMPLATE.Campfire), 0)), 'notRepairable', 'an empty Campfire: Firewood refuels it, not a smith');
  for (const k of [REST_ITEM.Bedroll, REST_ITEM.Candle, REST_ITEM.Salts]) assert.equal(repairRefusal(spent(createRestItem(k), 1)), 'notRepairable', `supply ${k}`);
  const tent = spent(createSurvivalItem(TEMPLATE.CampingEquipment), 10);
  assert.equal(repairRefusal(tent), null, 'the mod\'s tent is mended at a counter, as C&C has it');
});

test('AUDIT REST II H8: a General Store sells two to four Campfires, on the counter\'s shelf - not two to four on every shelf model; the C&C shelf still draws its count on every shelf, so each shelf\'s later draws are its own (mutants: every shelf stocks them, either arm)', () => {
  let seed = 7;
  const rolls = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  for (const [online, cc] of [[true, false], [true, true], [false, true]]) {
    setSharedClock(online ? () => 1000 : null);
    _resetForTests(); setPref('survival', cc);
    const counts = [0, 1, 2, 3].map((shelfIndex) => stockShopShelf({ buildingType: BUILDING_TYPES.GeneralStore, quality: 10 }, { level: 5, gender: 'male' }, { rolls, shelfIndex })
      .filter((it) => it.templateIndex === TEMPLATE.Campfire).length);
    assert.deepEqual(counts.slice(1), [0, 0, 0], `online ${online}, C&C ${cc}: the other shelves none`);
    assert.ok(counts[0] >= 2 && counts[0] <= 4, `online ${online}, C&C ${cc}: the counter two to four (${counts[0]})`);
  }
  // the draw stays on a shelf without them: the same rolls give the same rest of the shelf, and take as many draws -
  // counted, and at a low quality too, where the gear's dice follow the count (AUDIT III B1: at quality 10 both
  // short-circuit, no draw follows, and a skipped draw went unseen)
  const R = [0.3, 0.7, 0.1, 0.9, 0.5, 0.2, 0.8, 0.4];
  const run = (quality, on) => {
    let i = 0;
    const names = provisionsStock(quality, () => R[i++ % R.length], { campfires: on })
      .filter((it) => it.templateIndex !== TEMPLATE.Campfire).map((it) => it.templateIndex);
    return { names, draws: i };
  };
  for (const quality of [1, 4, 10]) assert.deepEqual(run(quality, false), run(quality, true), `quality ${quality}`);
});

test('AUDIT REST II H9: "Bring online" keeps a supply left with a repairer offline too - the counter\'s list crosses with the character (save.js otherItems), so customs strips it there as from the pack, the wagon and the stashes (mutant: the counter unread)', () => {
  _resetForTests(); setPref('survival', true);
  const sword = { templateIndex: 113, group: 'Weapons', value: 10 };
  // REST-LOOT (2026-10-05): the sources are open, so this is the switch's way back - pinned with the switch shut
  _setRestItemsOnlineForTests(false);
  try {
    const snap = { level: 1, goldPieces: 0, items: [], wagonItems: [], bankAccounts: [], otherItems: [createRestItem(REST_ITEM.Bedroll), sword] };
    const r = applyCustoms(snap);
    assert.deepEqual(snap.otherItems, [sword], 'the copy\'s counter holds none');
    assert.equal(r.restKept, 1, 'and the realm says it stayed');
  } finally { _setRestItemsOnlineForTests(null); }
  const open = { level: 1, goldPieces: 0, items: [], wagonItems: [], bankAccounts: [], otherItems: [createRestItem(REST_ITEM.Bedroll), sword] };
  assert.equal(applyCustoms(open).restKept, 0, 'REST-LOOT: open, the counter\'s supply crosses with the character');
  assert.equal(open.otherItems.length, 2);
});

test('AUDIT REST II H10: a Meditation Candle lights from the pack alone - one used from the wagon is refused with words, never "lit" with no kneel after it (mutants: the pack unasked; the ladder\'s entity dropped)', () => {
  _resetForTests(); setPref('survival', true);
  const h = itemUseHandler(REST_ITEM.Candle);
  const candle = createRestItem(REST_ITEM.Candle);
  const entity = { items: [], wagonItems: [candle] };
  snuffCandle();
  assert.deepEqual(h(candle, entity.wagonItems, { entity }), { kind: 'text', text: REST_ITEM_TEXT.candleNotCarried });
  assert.equal(litCandle(entity), null, 'nothing lit');
  entity.items.push(entity.wagonItems.pop());
  assert.equal(h(candle, entity.items, { entity }).text, REST_ITEM_TEXT.candleLit);
  assert.equal(litCandle(entity)?.item, candle, 'lit, and the next rest kneels by it');
  snuffCandle();
});

test('AUDIT REST II H11: Firewood feeds the emptiest Campfire in the pack that has ROOM - a full old five-use kit no longer takes the stick only to refuse it beside a Campfire at six; full everywhere still says full, none says none (mutants: room unasked; the full word lost)', () => {
  _resetForTests(); setPref('survival', true); setWorldMinutes(1000);
  const oldKit = createSurvivalItem(TEMPLATE.Campfire); oldKit.maxCondition = 5; oldKit.currentCondition = 5;
  const fire = createSurvivalItem(TEMPLATE.Campfire); fire.currentCondition = 6;
  const wood = createRestItem(REST_ITEM.Firewood);
  const said = [];
  const entity = { items: [oldKit, fire, wood] };
  const p = pool(entity, { said });
  assert.equal(p.placeItem(wood, entity.items), true, 'fed');
  assert.deepEqual([oldKit.currentCondition, fire.currentCondition], [5, 8], 'the Campfire took it, to its eight');
  assert.ok(!entity.items.includes(wood), 'one stick spent');
  const wood2 = createRestItem(REST_ITEM.Firewood);
  entity.items.push(wood2);
  assert.equal(p.placeItem(wood2, entity.items), false);
  assert.equal(said.at(-1), REST_ITEM_TEXT.firewoodFull, 'all full: the full word');
  const lone = { items: [createRestItem(REST_ITEM.Firewood)] };
  const q = pool(lone, { said });
  assert.equal(q.placeItem(lone.items[0], lone.items), false);
  assert.equal(said.at(-1), REST_ITEM_TEXT.firewoodNone, 'no Campfire: the none word');
});

test('AUDIT REST II H12: online a cold camp offers no Rest - it is no rest point, and the row only refused with "Find a fire or a bed" - and its own act leads (Relight, Stoke), the row a click takes; a friend\'s cold fire says its embers; offline the list is as it was, and the pool reads the lane (mutants: the cold arm off; the lane unpassed)', () => {
  const coldFire = { kind: CAMP_KIND.Fire, fuel: true, wear: 6, litUntil: 5 };
  const litFire = { ...coldFire, litUntil: 99 };
  const coldTent = { kind: CAMP_KIND.Tent, wear: 30, litUntil: 5 };
  const keys = (rows) => rows.map((r) => r.key);
  assert.deepEqual(keys(campMenu(coldFire, 10, true, { online: true })), ['stoke', 'cook', 'pack'], 'my cold Campfire: Relight first');
  assert.equal(campMenu(coldFire, 10, true, { online: true })[0].text, CAMP_TEXT.menuRelight);
  assert.deepEqual(keys(campMenu({ ...coldFire, wear: 0 }, 10, true, { online: true })), ['cook', 'pack'], 'no fuel: pick it up');
  assert.deepEqual(keys(campMenu(coldFire, 10, false, { online: true })), ['cook'], 'a friend\'s cold fire: its embers');
  assert.deepEqual(keys(campMenu(coldTent, 10, true, { online: true })), ['stoke', 'rest', 'cook', 'pack'], 'a cold tent: Stoke first (AUDIT REST III A3 re-aim: its Rest kept - it stokes the tent first)');
  assert.deepEqual(keys(campMenu(litFire, 10, true, { online: true })), ['rest', 'cook', 'pack'], 'lit: as ever');
  assert.deepEqual(keys(campMenu(coldFire, 10, true)), ['rest', 'cook', 'stoke', 'pack'], 'offline: as it was');
  const c = rd('src/scenes/camps.js');
  assert.equal((c.match(/campMenu\(c\.rec, now\(\), mine\(c\), \{ online: sharedClockOn\(\) \}\)/g) ?? []).length, 3, 'the hover, the plaque and the list all read the lane');
  assert.equal((c.match(/campMenu\(/g) ?? []).length, 3);
});

test('AUDIT REST II H13: the words agree - "Campfire" as the item names it in every camp line, Firewood\'s card in the notes\' words, the customs line\'s "rest supplies" (Tonics and Salts are no camping gear), and an Ember Jar\'s fire hovers as what it is, with no fuel to count (mutant: the jar titled a Campfire)', () => {
  assert.deepEqual([CAMP_TEXT.menuPickUp, CAMP_TEXT.pickedUp, CAMP_TEXT.noFuel, CAMP_TEXT.outOfFuel, CAMP_TEXT.carriedOut],
    ['Pick up the Campfire', 'You pick up your Campfire.', 'Your Campfire has no fuel left.', 'Your Campfire burns the last of its fuel.', 'You take your Campfire with you.']);
  assert.ok(!Object.values(CAMP_TEXT).some((v) => typeof v === 'string' && /\byour campfire\b/.test(v)), 'yours is the item, named as the item - "a campfire" stays any fire');
  assert.deepEqual(restItemLines(createRestItem(REST_ITEM.Firewood)), ['Adds 3 nights of fuel to a Campfire.']);
  assert.ok(customsLines({ called: 0, owed: 0, wealth: 0, allowance: 0, taken: 0, restKept: 1 }).some((l) => /^Your rest supplies stayed with your offline character/.test(l)));
  _resetForTests(); setPref('survival', true); setWorldMinutes(1000);
  const jar = createRestItem(REST_ITEM.EmberJar);
  const entity = { items: [jar] };
  const p = pool(entity);
  assert.equal(p.placeItem(jar, entity.items), true);
  const name = p.hoverName(`camp:${p.camps[0].rec.id}`);
  assert.equal(name.title, 'Your Ember Jar fire');
  assert.equal(name.subs, undefined, 'no fuel line - a jar\'s night is its embers');
});

test('AUDIT REST II H14: no offline shelf sells a Bedroll - offline every rest is DFU\'s, anywhere, and its rough night is the bare ground\'s; the shelf\'s other draws are unmoved (mutant: the offline Bedroll stocked)', () => {
  _resetForTests(); setPref('survival', true);
  const seq = () => { let i = 0; const R = [0.99, 0.5, 0.7, 0.3, 0.9, 0.1]; return () => R[i++ % R.length]; };
  const offline = restItemsStock('GeneralStore', 10, seq(), { online: false });
  assert.equal(offline.filter((it) => it.templateIndex === REST_ITEM.Bedroll).length, 0, 'no Bedroll offline');
  // the Jar, the Firewood and the Tonic as their own draws give them (the Bedroll's draw taken first, unshelved)
  assert.ok(offline.some((it) => it.templateIndex === REST_ITEM.EmberJar) && offline.some((it) => it.templateIndex === REST_ITEM.Firewood));
  const counts = (list, k) => list.filter((it) => it.templateIndex === k).length;
  assert.deepEqual([counts(offline, REST_ITEM.EmberJar), counts(offline, REST_ITEM.Firewood), counts(offline, REST_ITEM.Tonic)], [1 + Math.floor(0.5 * 3), 2 + Math.floor(0.7 * 4), Math.floor(0.3 * 3)], 'the draws after the Bedroll\'s, unmoved');
});

test('AUDIT REST II H15: the Waking Salts hold the exhausted drain on stamina, run through the needs\' own minute - with the salts held an exhausted character spends no fatigue to it, without them it does (the source pin\'s clause was optional, so nothing held it) (mutant: the hold dropped)', () => {
  _resetForTests(); setPref('survival', true);
  const NOON = { climateIndex: 232, month: 6, hour: 12, weather: 'sunny', inSunlight: false, insideBuilding: true };
  const spent = (salted) => {
    const e = { fatigue: 200, maxFatigue: 200, stats: { endurance: 50, strength: 50 }, items: [], survival: newSurvival(1000) };
    e.survival.sleepDebt = 14;   // exhausted
    e.survival.lastAte = 1000; e.survival.lastDrank = 1000;
    if (salted) e.survival.wakingUntil = 1060;
    let n = 0;
    survivalMinute(e, 1001, NOON, { sinks: { drainFatigue: (d) => { n += d; }, restoreFatigue: () => {}, hurt: () => {}, say: () => {} } });
    return n;
  };
  assert.ok(spent(false) > 0, 'exhausted: the drain bites');
  assert.equal(spent(true), 0, 'the salts held: nothing to it');
  assert.match(rd('test/to1_travelOptions.test.js'), /if \\\(sleepNow === 'exhausted' && !resting && !wakingHeld\\\(s, now\\\)\\\) tire/, 'and the source pin asks the clause again');
});
