import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { SURVIVAL_RULES, SURVIVAL_STORED, SURVIVAL_OFF } from '../src/systems/survival/difficulty.js';
import { SURVIVAL_PREF } from '../src/systems/survival/switch.js';
import {
  newSurvival, survivalOf, survivalMinute, runSurvivalMinutes, pauseSurvival, shiftSurvival, survivalStatMods, hungerMinutes,
  awakeHours, drinkWater, settleLoan, ALIGN_GRACE_MINUTES, SURVIVAL_TEXT, NEED, WELL_FED_MINUTES,
} from '../src/systems/survival/needs.js';
import { survivalHudChips, survivalStatusLines, STATUS_TEXT } from '../src/systems/survival/status.js';
import { REST_KIND, REST_TEXT_SURVIVAL } from '../src/systems/survival/rest.js';
import { TEMPLATE, FOOD, eatLaw } from '../src/systems/survival/food.js';
import { createSurvivalItem, useSurvivalItem, SURVIVAL_USE_TEXT, startingProvisions } from '../src/systems/survival/items.js';
import { CAMP_TEXT, TENT_MODEL, FIRE_LIGHT_RANGE, FIRE_MINUTES, BY_FIRE_REACH } from '../src/systems/survival/camp.js';
import { TAVERN_MENU_TEXT, blackout } from '../src/systems/survival/tavernMenu.js';
import { createCamps, CAMP_LIGHT_REACH, CAMP_LIGHTS_MAX } from '../src/scenes/camps.js';
import { createRestDeps, createPlayerTicker } from '../src/scenes/shared.js';
import { TavernWindow } from '../src/ui/tavernWindow.js';
import { setPref, _resetForTests } from '../src/systems/uiPrefs.js';
import { setWorldMinutes, worldMinutes, setSharedClock } from '../src/systems/worldTick.js';
import { snapshotPlayer, restorePlayer } from '../src/systems/save.js';
import { assignStartingGear } from '../src/systems/startingGear.js';
import { seedStartingEquipment } from '../src/systems/equip.js';
import { StreamingWorldState } from '../src/world/streamingWorld.js';
import { TERRAIN_SIZE } from '../src/world/terrainSampler.js';
import { CLIMATES } from '../src/formats/mapsFile.js';
import { RACES } from '../src/systems/races.js';
import { renownFoeStruck, renownFoeDied } from '../src/net/renownTracker.js';   // RENOWN1: the kill door's stamps, in the harness's scope

// ═══ AUDIT SURV-TIERS, THE THIRD PASS (2026-09-23) ═══════════════════
//
// Mac: "Just do one more comprehensive audit and ensure everything is
// perfect and makes sense". Main merged in first (DISC6/DISC7), then five
// fresh lenses over the merged tree - the newest slices and the merge,
// the player's sense tier by tier, the laws fuzzed, the records and pins,
// and online and saves. Every finding was reproduced before it was fixed;
// each test here is one of them (bible/06-Systems/Climates-Calories.md,
// AUDIT SURV-TIERS, "The third pass").

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');
const CASUAL = SURVIVAL_RULES.casual;
const HARD = SURVIVAL_RULES.hard;
const STATS = Object.freeze({ strength: 50, intelligence: 50, willpower: 50, agility: 50, endurance: 50, personality: 50, speed: 50, luck: 50 });
/** A player whose pool is (50 + 50) x 64 = 6400 fatigue units, so Casual's floor is 3200. */
const body = (extra = {}) => ({ stats: { ...STATS }, raceId: RACES.Breton, items: [], activeEffects: [], health: 40, maxHealth: 40, fatigue: 6400, ...extra });
const sinksFor = (e, log = []) => ({
  drainFatigue: (n) => { log.push(['fatigue', n]); e.fatigue = Math.max(0, e.fatigue - n); },
  restoreFatigue: (n) => { log.push(['restore', n]); e.fatigue = Math.min(6400, e.fatigue + n); },
  hurt: (n) => { log.push(['hurt', n]); e.health = Math.max(0, e.health - n); },
  say: (t) => log.push(['say', t]),
});
const said = (log) => log.filter((l) => l[0] === 'say').map((l) => l[1]);
const minuteDeps = (e, log, rules, extra = {}) => ({ sinks: sinksFor(e, log), autoDrink: false, autoEat: false, rules, rolls: () => 0.5, ctx: { raceId: RACES.Breton }, ...extra });
/** A mountain night in winter, in the snow: deadly cold for anyone. */
const BLIZZARD = Object.freeze({ climateIndex: CLIMATES.Mountain, month: 0, hour: 2, weather: 'snow' });
/** Indoors in the woods in midsummer: a naked Breton feels exactly 5. */
const INDOORS = Object.freeze({ climateIndex: CLIMATES.Woodlands, month: 6, hour: 12, weather: 'sunny', insideBuilding: true });
const fireStub = { getTexture: async () => ({ getFrameCount: () => 3, getSize: () => ({ width: 40, height: 40 }) }), uploadRecordFrame: () => {} };
const tentMeshes = { getGpuMesh: async () => ({ gpu: true }), cpuModels: new Map([[TENT_MODEL, { positions: [-1, 0, -1, 1, 2, 1] }]]) };
const renderer = { createBillboardBatch: (a, r, size, at) => ({ at: at[0] }), destroyBillboardBatch: () => {} };
afterEach(() => { _resetForTests(); setWorldMinutes(0); setSharedClock(null); });

// ── THE CAMPS ─────────────────────────────────────────────────────────

test('the third pass: mine is the POOL\'s word - a camp pitched online under another tab\'s id is still this player\'s: packed, named as theirs, counted, hidden when Off; a room\'s memory of it stands no twin', async () => {
  setWorldMinutes(100);
  const said2 = [], menus = [];
  const entity = body();
  const pool = createCamps({ renderer, ...fireStub, meshes: tentMeshes, entity, camera: () => ({ feet: [0, 0, 0], yaw: 0 }), selfId: () => 'pNEW', say: (l) => said2.push(l), showOverlay: (w) => menus.push(w) });
  pool.restore([{ id: 'pOLD:1:90', owner: 'pOLD', kind: 'tent', pos: [1, 0, 1], yaw: 0, litUntil: 500, wear: 7, placedAt: 0 }]);   // the save, from the tab that pitched it
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(pool.activate('camp:pOLD:1:90', 'info'), true);
  assert.deepEqual(said2, [CAMP_TEXT.seeOwnCamp], 'Info names it as this player\'s');
  pool.activate('camp:pOLD:1:90', 'grab');
  assert.ok(menus.at(-1).items.includes(CAMP_TEXT.menuPack), 'the menu offers to pack it');
  assert.deepEqual([pool.own().length, pool.wireRecords().length], [1, 1], 'it counts to the cap and rides the wire as this player\'s');
  setPref(SURVIVAL_PREF, SURVIVAL_STORED[SURVIVAL_OFF]);
  assert.deepEqual([pool.batches(), pool.lights(), pool.targets()], [[], [], []], 'with the arc Off it is out of sight, as this player\'s own camps are');
  _resetForTests();
  // a room's memory keys it by the old id: it is this player's, and stands once
  assert.equal(pool.applyOwner('pOLD', [{ i: 'pOLD:1:90', k: 0, p: [1, 0, 1], y: 0, u: 500, w: 7 }]), true);
  assert.equal(pool.camps.length, 1, 'the memory\'s copy of this player\'s own camp is not stood beside it');
  pool.activate('camp:pOLD:1:90', 'grab');
  menus.at(-1).onPick(menus.at(-1).items.indexOf(CAMP_TEXT.menuPack));
  assert.deepEqual([pool.camps.length, entity.items.filter((i) => i.templateIndex === TEMPLATE.CampingEquipment).length], [0, 1], 'packed: the gear is back');
});

test('the third pass: a LOAD drops the player\'s own camps before it stands the save\'s - the pitch after the save is undone, not kept beside the gear the load gave back; a peer\'s stays', async () => {
  setWorldMinutes(100);
  const entity = body({ items: [createSurvivalItem(TEMPLATE.CampingEquipment)] });
  const pool = createCamps({ entity, camera: () => ({ feet: [0, 0, 0], yaw: 0 }), collider: () => ({ surfaceHit: () => ({ dist: 0.5 }) }), place: () => ({}), selfId: () => null });
  const save = JSON.parse(JSON.stringify(pool.snapshot()));   // F5 with the gear in the pack
  const bag = JSON.parse(JSON.stringify(entity.items));
  assert.equal(pool.placeItem(entity.items[0], entity.items), true);
  pool.applyOwner('peer', [{ i: 'p:1', k: 1, p: [9, 0, 9], y: 0, u: 500, w: 0 }]);
  entity.items = bag;   // F9: the pack comes back from the save...
  pool.dropOwn(); pool.restore(save);   // ...and so do the camps (world.js worldQuickLoad, the dungeon's truncating load)
  assert.deepEqual(pool.camps.map((c) => c.owner), ['peer'], 'the save had no camp of mine; the peer\'s stands on their word');
  const world = read('src/scenes/world.js'), dc = read('src/scenes/dungeonContext.js');
  assert.match(world, /camps\.dropOwn\(\);[^\n]*\n\s+camps\.restore\(restandAt\('pos'\)\(w\.camps\), campFromNatives\);/, 'the world host\'s load drops mine first (the heights stood again on today\'s ground - TERRAIN-SCALE1, main\'s)');
  assert.match(dc, /if \(truncate\) \{ camps\.dropOwn\(\); camps\.restore\(w\.camps\); \}/, 'and the dungeon\'s');
});

test('the third pass: a TELEPORT re-anchors the scene frame, and the camps go through natives across it - a tent pitched by one town stands where it was, not beside the traveller in the next', () => {
  _resetForTests(); setWorldMinutes(100);
  const state = new StreamingWorldState();
  state.init(200, 200);
  const entity = body({ items: [createSurvivalItem(TEMPLATE.CampingEquipment)] });
  const pool = createCamps({ entity, camera: () => ({ feet: [TERRAIN_SIZE / 2, 0, TERRAIN_SIZE / 2], yaw: 0 }), collider: () => ({ surfaceHit: () => ({ dist: 0.5 }) }), place: () => ({}), selfId: () => null });
  // world.js's own two converters (campToNatives / campFromNatives)
  const toNatives = (pos) => { const wc = state.worldCoords(pos); return [wc.x, pos[1] - state.compensation[1], wc.z]; };
  const fromNatives = (p) => { const [lx, lz] = state.localFromWorld(p[0], p[2]); return [lx, p[1] + state.compensation[1], lz]; };
  const natives = () => pool.snapshot(toNatives).map((r) => r.pos.map(Math.round));
  pool.placeItem(entity.items[0], entity.items);
  const pitched = natives();
  // _teleportToPixel: held in natives, the frame re-anchored, stood again
  const held = pool.snapshot(toNatives); pool.destroyAll();
  state.init(420, 90);
  pool.restore(held, fromNatives);
  assert.deepEqual(natives(), pitched, 'a fast travel leaves the tent where it was pitched');
  const w = read('src/scenes/world.js');
  assert.match(w, /const campsHeld = camps\.snapshot\(campToNatives\);\n\s+camps\.destroyAll\(\);\n\s+for \(const key of \[\.\.\.built\.keys\(\)\]\) \{[\s\S]{0,200}?queue\.push\(\.\.\.state\.init\(px, py\)\);\n(?:[^\n]*\n){0,2}?\s+camps\.restore\(campsHeld, campFromNatives\);/,
    'the world host\'s teleport holds them across state.init');
});

test('the third pass: the camps\' lights are the NEAREST few in reach of the eye - four peers\' fires far off no longer put out a town\'s lamps', () => {
  setWorldMinutes(100);
  let feet = [0, 0, 0];
  const pool = createCamps({ entity: body(), camera: () => ({ feet, yaw: 0 }), selfId: () => 'me' });
  const peers = [];
  for (let o = 0; o < 4; o++) peers.push([`q${o}`, [0, 1, 2, 3].map((k) => ({ i: `q${o}:${k}`, k: 1, p: [850 + o * 3, 0, k * 3], y: 0, u: 500, w: 0 }))]);
  for (const [owner, recs] of peers) pool.applyOwner(owner, recs);
  assert.equal(pool.lights().length, 0, 'sixteen fires eight hundred metres off take no slot');
  pool.applyOwner('near', [0, 1, 2, 3].map((k) => ({ i: `near:${k}`, k: 1, p: [5 + k * 10, 0, 0], y: 0, u: 500, w: 0 })));
  pool.applyOwner('nearer', [{ i: 'nearer:0', k: 1, p: [2, 0, 0], y: 0, u: 500, w: 0 }]);
  const xs = pool.lights().map((l) => l.x);
  assert.deepEqual(xs, [2, 5, 15, 25], `the nearest ${CAMP_LIGHTS_MAX}, nearest first, within ${CAMP_LIGHT_REACH} m`);
  assert.ok(pool.lights().every((l) => l.range === FIRE_LIGHT_RANGE));
  feet = [850, 0, 0];
  assert.equal(pool.lights().length, CAMP_LIGHTS_MAX, 'walk to them and they light the ground');
});

test('the third pass: a camp id goes on from the save\'s - a new page\'s counter began at nought, and a camp pitched in the saved one\'s minute stood under its id', () => {
  setWorldMinutes(500);
  const entity = body({ items: [createSurvivalItem(TEMPLATE.Campfire), createSurvivalItem(TEMPLATE.Campfire)] });
  const pool = createCamps({ entity, camera: () => ({ feet: [0, 0, 0], yaw: 0 }), collider: () => ({ surfaceHit: () => ({ dist: 0.5 }) }), place: () => ({}), selfId: () => null });
  pool.restore([{ id: 'me:3:500', kind: 'fire', pos: [40, 0, 40], yaw: 0, litUntil: 900, wear: 0, placedAt: 500 }]);
  pool.placeItem(entity.items[0], entity.items);
  const ids = pool.camps.map((c) => c.rec.id);
  assert.equal(new Set(ids).size, 2, `two camps, two ids (${ids})`);
  assert.equal(ids[1], 'me:4:500', 'the counter goes on from the save\'s');
});

test('the third pass: "Rest here" is the fire\'s rest - refused in words beyond its reach (the menu reaches seven metres, the fire warms four), a cold tent of your own is stoked for it, and a camp\'s rest at your tent keeps its fire', async () => {
  setWorldMinutes(1000);
  let feet = [0, 0, -6.4];
  const said2 = [], menus = [], rested = [];
  const entity = body();
  const pool = createCamps({ renderer, ...fireStub, meshes: tentMeshes, entity, camera: () => ({ feet, yaw: 0 }), selfId: () => null, say: (l) => said2.push(l), showOverlay: (w) => menus.push(w), openRest: (rec) => rested.push(rec.id) });
  pool.restore([{ id: 'me:1:900', kind: 'tent', pos: [0, 0, 0], yaw: 0, litUntil: 1300, wear: 0, placedAt: 900 }]);
  await new Promise((r) => setTimeout(r, 0));
  const restFromMenu = () => { pool.activate('camp:me:1:900', 'grab'); const m = menus.at(-1); m.onPick(m.items.indexOf(CAMP_TEXT.menuRest)); };
  restFromMenu();
  assert.deepEqual([rested, said2], [[], [CAMP_TEXT.restCloser]], 'from the tent\'s far side: move closer, no rest opened');
  feet = [0, 0, -BY_FIRE_REACH + 0.5]; said2.length = 0;
  restFromMenu();
  assert.deepEqual([rested, said2], [['me:1:900'], []], 'by the fire: the rest opens, the camp\'s');
  // a cold tent of your own: the rest stokes it first (SURV3: "a rest will")
  pool.camps[0].rec.litUntil = 990; rested.length = 0; said2.length = 0;
  restFromMenu();
  assert.deepEqual([rested, said2, pool.camps[0].rec.litUntil], [['me:1:900'], [CAMP_TEXT.stoked], 1000 + FIRE_MINUTES], 'stoked, said, and the rest opens');
  // resting at the camp keeps the fire: it never runs down under the sleeper
  pool.camps[0].rec.litUntil = 1010;
  entity.isResting = true; entity.restKind = REST_KIND.Camp;
  pool.tick(0);
  assert.equal(pool.camps[0].rec.litUntil, 1000 + FIRE_MINUTES, 'tended for its full span');
  entity.restKind = REST_KIND.Rough; pool.camps[0].rec.litUntil = 1010; pool.tick(0);
  assert.equal(pool.camps[0].rec.litUntil, 1010, 'a rest that is not the camp\'s tends nothing');
  setPref(SURVIVAL_PREF, 'hard'); entity.restKind = REST_KIND.Camp; pool.tick(0);
  assert.equal(pool.camps[0].rec.litUntil, 1000 + FIRE_MINUTES, 'every tier that uses the camp tends it');
  setPref(SURVIVAL_PREF, SURVIVAL_STORED[SURVIVAL_OFF]); pool.camps[0].rec.litUntil = 1010; pool.tick(0);
  assert.equal(pool.camps[0].rec.litUntil, 1010, 'with the arc Off nothing is tended');
  _resetForTests();
  // a kit's fire cannot be stoked, rest or no rest
  const kit = createCamps({ entity, camera: () => ({ feet: [0, 0, 1], yaw: 0 }), selfId: () => null });
  kit.restore([{ id: 'me:2:900', kind: 'fire', pos: [0, 0, 0], yaw: 0, litUntil: 1010, wear: 0, placedAt: 900 }]);
  kit.tick(0);
  assert.equal(kit.camps[0].rec.litUntil, 1010, 'a kit fire burns its own span');
});

// ── WHAT THE PLAYER IS TOLD ───────────────────────────────────────────

test('the third pass: a stage line is said when the need WORSENS, never on the way back - a sleep paying off Exhausted, a drink from Dehydrated and a warming morning say nothing; a new side of the temperature does', () => {
  // the sleep: exhausted to rested in a bed, not a word of the stages passed through
  let e = body(); let log = [];
  Object.assign(survivalOf(e, 0), { sleepDebt: 20, lastMinute: 0 });
  survivalMinute(e, 1, INDOORS, minuteDeps(e, log, CASUAL));
  assert.deepEqual(said(log), [SURVIVAL_TEXT.exhausted], 'the stage it stands in is said once');
  log.length = 0;
  runSurvivalMinutes(e, 1, 12 * 60, { ...INDOORS, resting: true, sleeping: 'bed' }, minuteDeps(e, log, CASUAL));
  assert.deepEqual(said(log).filter((t) => [SURVIVAL_TEXT.tired, SURVIVAL_TEXT.drowsy, SURVIVAL_TEXT.exhausted].includes(t)), [], 'a sleep says nothing as the debt falls');
  // the drink: dehydrated, a skin, then thirsty - silent
  e = body({ items: [createSurvivalItem(TEMPLATE.Waterskin)] }); log = [];
  Object.assign(survivalOf(e, 0), { thirst: 110, lastMinute: 0 });
  survivalMinute(e, 1, INDOORS, minuteDeps(e, log, CASUAL));
  drinkWater(e, 1);
  log.length = 0;
  survivalMinute(e, 2, INDOORS, minuteDeps(e, log, CASUAL));
  assert.equal(e.survival.notes.thirst, 'thirsty');
  const stageLines = (l) => said(l).filter((t) => [SURVIVAL_TEXT.thirsty, SURVIVAL_TEXT.parched, SURVIVAL_TEXT.dehydrated].includes(t));
  assert.deepEqual(stageLines(log), [], 'a drink from Dehydrated does not say "You are getting thirsty" (the loan\'s repaid line may speak: the red lifted)');
  // ...and getting worse again is said
  e.survival.thirst = 100; survivalMinute(e, 3, INDOORS, minuteDeps(e, log, CASUAL));
  assert.deepEqual(stageLines(log), [SURVIVAL_TEXT.dehydrated], 'Dehydrated again is news');
  // the temperature: deadly to comfortable says nothing; then the heat, the other side, is said
  e = body(); log = [];
  survivalMinute(e, 1, BLIZZARD, minuteDeps(e, log, CASUAL));
  assert.ok(said(log).includes(SURVIVAL_TEXT.deadly));
  log.length = 0;
  survivalMinute(e, 2, { climateIndex: CLIMATES.Mountain, month: 0, hour: 12, weather: 'sunny' }, minuteDeps(e, log, CASUAL));
  assert.deepEqual(said(log).filter((t) => [SURVIVAL_TEXT.cold, SURVIVAL_TEXT.freezing].includes(t)), [], 'a warming morning does not say the cold is seeping in');
  survivalMinute(e, 3, { climateIndex: CLIMATES.Desert, month: 6, hour: 14, weather: 'sunny' }, minuteDeps(e, log, CASUAL));
  assert.ok([SURVIVAL_TEXT.warm, SURVIVAL_TEXT.hot, SURVIVAL_TEXT.scorching].some((t) => said(log).includes(t)), 'the heat is a new side, and said');
});

test('the third pass: what a jump says, it says ONCE, as it lands - three days on the road arrive with each line once and the stages where they stand, not thirty lines of the road', () => {
  const e = body({ items: [createSurvivalItem(TEMPLATE.Waterskin), createSurvivalItem(TEMPLATE.Waterskin), createSurvivalItem(TEMPLATE.Rations, { stackCount: 3 })] });
  const log = [];
  Object.assign(survivalOf(e, 0), { lastMinute: 0 });
  runSurvivalMinutes(e, 0, 3 * 1440, { climateIndex: CLIMATES.Desert, month: 6, hour: 12, weather: 'sunny' }, { ...minuteDeps(e, log, CASUAL), autoDrink: true, autoEat: true });
  const lines = said(log);
  assert.equal(new Set(lines).size, lines.length, `every line once (${lines.length}: ${lines.join(' | ')})`);
  assert.equal(lines.filter((t) => t === SURVIVAL_TEXT.drank).length <= 1, true, 'the skin is drunk from many times and said once');
  assert.ok(lines.length <= 12, `a handful of lines, not thirty (${lines.length})`);
});

test('the third pass: beside a lit fire in Casual the cold is felt, not paid - its chip is amber and the page says what the fire does; Hard\'s fire warms nothing and its chip stays red; Hard\'s warm band has a chip; a vampire has no thirst chip', () => {
  for (const [rules, level, line] of [[CASUAL, 'warn', STATUS_TEXT.warmedByFire], [HARD, 'danger', STATUS_TEXT.temp('deadly cold')]]) {
    const e = body(); survivalOf(e, 0);
    survivalMinute(e, 1, { ...BLIZZARD, byFire: true }, minuteDeps(e, [], rules));
    const chip = survivalHudChips(e, 1).find((c) => c.key === 'temp');
    assert.deepEqual([chip.text, chip.level], ['Deadly cold', level], `${rules.id}: the same word, ${level}`);
    assert.ok(survivalStatusLines(e, 1).includes(line), `${rules.id}: "${line}"`);
  }
  const e = body(); survivalOf(e, 0);
  survivalMinute(e, 1, BLIZZARD, minuteDeps(e, [], CASUAL));
  assert.equal(survivalHudChips(e, 1).find((c) => c.key === 'temp').level, 'danger', 'away from the fire the cold is red, and charged');
  const warm = body(); Object.assign(survivalOf(warm, 0), { felt: 25 });
  assert.deepEqual(survivalHudChips(warm, 0).filter((c) => c.key === 'temp').map((c) => [c.text, c.level]), [['Warm', 'warn']], 'Warm, the Cold\'s twin');
  const vamp = body(); Object.assign(survivalOf(vamp, 0), { thirst: 110 });
  assert.equal(survivalHudChips(vamp, 0, { vampire: true }).some((c) => c.key === 'thirst'), false, 'a vampire\'s frozen thirst shows no chip');
  // and Drenched is RED as a warning - it costs through the felt temperature, not a stamina charge of its own - while
  // Soaked stays amber (status.js HUD_NEED_WORDS; lens D found the red unpinned)
  const wetChip = (wet) => { const w = body(); Object.assign(survivalOf(w, 0), { wet }); return survivalHudChips(w, 0).find((c) => c.key === 'wet'); };
  assert.deepEqual([wetChip(NEED.WET_DRENCHED), wetChip(NEED.WET_SOAKED)].map((c) => [c.text, c.level]), [['Drenched', 'danger'], ['Soaked', 'warn']]);
});

test('the third pass: the words - one "waterskin", the empty skin names the sources that fill one, and Rations eat at the first Peckish minute; no meal writes a marker in the future', () => {
  assert.equal(SURVIVAL_USE_TEXT.drankLow, SURVIVAL_TEXT.drankLow, 'the hand\'s drink and the automatic one say it alike');
  assert.doesNotMatch(SURVIVAL_USE_TEXT.emptySkin, /stream/, 'no stream fills a skin');
  assert.match(SURVIVAL_USE_TEXT.emptySkin, /fountain, a well or a trough/);
  assert.equal(FOOD[TEMPLATE.Rations].satiety, 240);
  const r = eatLaw(createSurvivalItem(TEMPLATE.Rations), { lastAte: 0, now: 240 });
  assert.equal(r.ok, true, 'Peckish (four hours) and the sack goes down');
  for (const tpl of Object.keys(FOOD).map(Number)) {
    const out = eatLaw(createSurvivalItem(tpl), { lastAte: 0, now: 100000 });
    assert.ok(out.ok && out.lastAte <= 100000, `${FOOD[tpl].name}: the marker is never ahead of the clock (${out.lastAte})`);
  }
});

test('the third pass: a Casual rough night that leaves the sleeper short says so; a rested one says nothing; Hard\'s says its stiff morning', () => {
  for (const [tier, debt, expect] of [['casual', 12, [REST_TEXT_SURVIVAL.sleptPoorly]], ['casual', 0, []], ['hard', 12, [REST_TEXT_SURVIVAL.stiff]]]) {
    _resetForTests(); setPref(SURVIVAL_PREF, tier); setWorldMinutes(6000);
    const lines = [];
    const e = { ...body(), isPlayer: true, level: 1, magicka: 0, maxMagicka: 20, skills: 20, career: {}, skillUses: [] };
    Object.assign(survivalOf(e, 6000), { sleepDebt: debt });
    const d = createRestDeps(e, { advanceMinutes: () => {}, endLines: () => [], say: (l) => lines.push(l), restKind: () => 'rough', day: () => false, inside: () => true });
    d.setResting(true); d.tickVitals(); d.setResting(false);
    assert.deepEqual(lines, expect, `${tier}, debt ${debt}`);
  }
});

test('the third pass: a Hard blackout says the waking - the classic window\'s box carries it after the fall, and the law hands it', () => {
  assert.deepEqual(blackout({ drunk: 60 }, 23 * 60, { endurance: 50 }).text, TAVERN_MENU_TEXT.woke);
  setPref(SURVIVAL_PREF, 'hard');
  const now = 1440 * 10 + 23 * 60;
  const entity = { name: 'Mac', goldPieces: 100, health: 20, maxHealth: 40, stats: { endurance: 50 }, rentedRooms: [], items: [], activeEffects: [], lastTimePlayerAteOrDrankAtTavern: 0, survival: { ...newSurvival(now), drunk: 45 } };
  const hooks = {
    rows: (id) => [{ text: `r${id}`, center: true }], now: () => now, mapId: () => 1, buildingKey: () => 2, buildingName: () => 'The Lamp',
    quality: () => 10, bedCount: () => 2, freeRooms: () => false, skills: () => ({ mercantile: 50, personality: 50 }),
    heal: () => {}, rolls: () => 0.5, climateIndex: () => 232, advanceMinutes: () => {}, endurance: () => 50,
  };
  const w = new TavernWindow({ entity, ...hooks, onTalk: () => {}, onClose: () => {} });
  w._food();
  const i = w.flow.top.picker.findIndex((t) => /Rye Liquor/.test(t));
  const box = w.flow.top.onPick(i);
  assert.deepEqual(box[0].rows.map((r) => r.text), [TAVERN_MENU_TEXT.blackout, TAVERN_MENU_TEXT.woke], 'the fall and the waking');
  assert.match(read('src/ui/enhancedTavern.js'), /say\(b \? \[\.\.\.line\(r\.text\), \.\.\.line\(b\.text\)\] : line\(r\.text\)\);/, 'the enhanced window says both, as the classic one does');
  assert.doesNotMatch(STATUS_TEXT.stiff, /ground/, 'the page\'s stiff line fits the tavern floor too');
});

// ── THE LAWS ──────────────────────────────────────────────────────────

test('the third pass: a short Off span wears off the drink and dries the soaking - twenty hours Off in an inn come back sober and dry, with the needs where they stood', () => {
  _resetForTests(); setWorldMinutes(50 * 1440);
  const e = { ...body(), isPlayer: true, name: 'P', level: 3, magicka: 10, maxMagicka: 20, skills: [20], career: {}, skillUses: new Array(35).fill(0), spells: [], equip: { slots: new Array(27).fill(null) }, chargenDone: true };
  const t = createPlayerTicker(e, { say: () => {}, isInside: () => true, survivalEnv: () => INDOORS });
  t.tick(5);
  Object.assign(e.survival, { drunk: 48, wet: 285 });
  const hunger = hungerMinutes(e.survival, Math.floor(worldMinutes()));
  setPref(SURVIVAL_PREF, SURVIVAL_STORED[SURVIVAL_OFF]);
  t.advance(20 * 60);
  _resetForTests();
  t.tick(5);
  const chips = survivalHudChips(e, Math.floor(worldMinutes())).map((c) => c.key);
  assert.deepEqual([chips.includes('drunk'), chips.includes('wet')], [false, false], `sober and dry (${chips})`);
  assert.ok(hungerMinutes(e.survival, Math.floor(worldMinutes())) - hunger <= 6, 'the hunger stood where it was');
});

test('the third pass: a Casual loan is settled only by a REFILL - a pool whose ceiling fell (a Drain, a ring off) still owes it, and the meal gives it back; a bed still settles it; an uneven cut never owes more than the room', () => {
  // the ceiling falls and rises again: the stamina the hunger took comes back with the meal
  const e = body({ fatigue: 6400 }); const log = [];
  Object.assign(survivalOf(e, 0), { lastAte: -3 * 1440, lastMinute: 0 });
  runSurvivalMinutes(e, 0, 120, INDOORS, minuteDeps(e, log, CASUAL));
  const owed = e.survival.borrowed.hunger;
  assert.ok(owed > 0);
  e.stats.endurance = 20; e.fatigue = Math.min(e.fatigue, 70 * 64);   // a Drain: the pool's ceiling falls, the stamina with it
  survivalMinute(e, 121, INDOORS, minuteDeps(e, log, CASUAL));
  assert.ok(e.survival.borrowed.hunger >= owed, 'the loan stands - nothing refilled the pool');
  e.stats.endurance = 50;   // cured
  e.survival.lastAte = 121;   // fed
  const before = e.fatigue;
  survivalMinute(e, 122, INDOORS, minuteDeps(e, log, CASUAL));
  assert.ok(e.fatigue - before >= owed, `the meal gave back what the hunger took (${e.fatigue - before} of ${owed})`);
  // a bed refills: the loan is cut to the room
  const b = body({ fatigue: 6400 });
  Object.assign(survivalOf(b, 0), { lastAte: -3 * 1440, lastMinute: 0 });
  runSurvivalMinutes(b, 0, 120, INDOORS, minuteDeps(b, [], CASUAL));
  b.fatigue = 6400;   // eight hours in a bed
  survivalMinute(b, 121, INDOORS, minuteDeps(b, [], CASUAL));
  assert.ok(!b.survival.borrowed || Object.values(b.survival.borrowed).reduce((a, v) => a + v, 0) <= 6400 - b.fatigue + 64, 'the refilled pool owes at most its room (and this minute\'s own charge)');
  // an uneven cut: two needs owed one each, the pool one short - at most one owed, never two (the settle's own law)
  const u = { borrowed: { thirst: 1, sleep: 1 } };
  settleLoan(u, 1);
  const total = Object.values(u.borrowed ?? {}).reduce((a, v) => a + v, 0);
  assert.ok(total <= 1, `owed ${total} with the pool one short`);
  const v = { borrowed: { hunger: 300, temp: 100 } };
  settleLoan(v, 200);
  assert.deepEqual(v.borrowed, { hunger: 150, temp: 50 }, 'each need\'s share cut in proportion');
});

test('the third pass: the fed hour\'s refund is a refill too - a fed but dehydrated Casual player\'s loan is settled by it the next minute, and a fight after it is not repaid by the drink', () => {
  const e = body({ fatigue: 6400 }); const log = [];
  Object.assign(survivalOf(e, 0), { lastAte: 0, thirst: NEED.DEHYDRATED, lastMinute: 0 });
  runSurvivalMinutes(e, 0, 10, INDOORS, minuteDeps(e, log, CASUAL));
  const loan = () => Object.values(e.survival.borrowed ?? {}).reduce((a, v) => a + v, 0);
  assert.ok(e.survival.borrowed?.thirst > 0 && loan() === 6400 - e.fatigue, 'the thirst\'s loan is what it took');
  e.survival.fed = WELL_FED_MINUTES - 1;
  survivalMinute(e, 11, INDOORS, minuteDeps(e, log, CASUAL));   // the fed hour: the refund comes back in the minute
  assert.ok(loan() > 6400 - e.fatigue, 'the refund came after the minute\'s settle');
  survivalMinute(e, 12, INDOORS, minuteDeps(e, log, CASUAL));
  assert.ok(loan() <= 6400 - e.fatigue, `the next minute settled the refund's share (owed ${loan()}, room ${6400 - e.fatigue})`);
  e.fatigue -= 500;   // a fight
  e.survival.thirst = 0;   // a long drink at a fountain
  survivalMinute(e, 13, INDOORS, minuteDeps(e, log, CASUAL));
  assert.equal(e.fatigue, 5900, 'the drink gave back what the thirst took, and the fight stands - not the refund a second time');
  assert.equal(e.survival.borrowed, undefined);
});

test('the third pass: a VAMPIRE\'s needs cost no attribute in Hard - the frozen hunger, thirst and sleep drained two a day from every one, down to twenty', () => {
  const s = { ...newSurvival(0), lastAte: -10 * 1440, thirst: 150, sleepDebt: 30 };
  assert.ok(Object.values(survivalStatMods(s, null, 0, { rules: HARD })).some((v) => v < 0), 'a mortal starving, parched and sleepless pays');
  assert.deepEqual(survivalStatMods(s, null, 0, { rules: HARD, vampire: true }), {}, 'a vampire pays nothing for them');
  const e = body(); Object.assign(survivalOf(e, 0), { lastAte: -10 * 1440, thirst: 150, sleepDebt: 30, lastMinute: 0 });
  survivalMinute(e, 1, INDOORS, minuteDeps(e, [], HARD, { ctx: { raceId: RACES.Breton, vampire: true } }));
  assert.equal(e.activeEffects.some((a) => a.kind === 'survival'), false, 'through the minute law too');
});

test('the third pass: a long Off leaves no `offFor` behind; a relay correction moves the needs\' markers by its own delta; an Off player\'s online absence pauses the needs, as an Off span does', () => {
  const s = { ...newSurvival(0), lastMinute: 0 };
  pauseSurvival({ survival: s }, 0, ALIGN_GRACE_MINUTES + 60);
  assert.equal('offFor' in s, false, 'a long Off is a fresh start and leaves no mark');
  const c = { survival: { ...newSurvival(1000), lastAte: 990, awakeSince: 900, lastMinute: 1000, stiffUntil: 1100 } };
  assert.equal(shiftSurvival(c, 180), true);
  assert.deepEqual([c.survival.lastAte, c.survival.awakeSince, c.survival.lastMinute, c.survival.stiffUntil], [1170, 1080, 1180, 1280], 'the correction moves them all by its delta');
  assert.equal(shiftSurvival({ survival: { ...newSurvival(0), stiffUntil: 0 } }, 60), true);
  assert.equal(shiftSurvival({}, 60), false, 'no record, nothing moved');
  // the load arm, online, Off: the absence is Off's
  for (const [tier, hungrier] of [[false, 0], ['casual', 720]]) {
    _resetForTests(); setPref(SURVIVAL_PREF, tier);
    const S = 100 * 1440 + 8 * 60;
    const e = { ...body(), isPlayer: true, level: 1, magicka: 0, maxMagicka: 20, skills: [20], career: {}, skillUses: new Array(35).fill(0), spells: [], lastGameMinutes: S };
    e.survival = { ...newSurvival(S), lastAte: S - 60, awakeSince: S - 120, lastMinute: S };
    const snap = JSON.parse(JSON.stringify(snapshotPlayer(e, { classicMinutes: S })));
    setSharedClock(() => S + 720);
    try {
      const r = { ...body(), isPlayer: true, level: 1, magicka: 0, maxMagicka: 20, skills: [20], career: {}, skillUses: new Array(35).fill(0), spells: [] };
      restorePlayer(r, snap, null);
      assert.equal(hungerMinutes(r.survival, S + 720) - 60, hungrier, `${tier === false ? 'Off' : tier}: twelve hours away are ${hungrier} minutes hungrier`);
      assert.equal(awakeHours(r.survival, S + 720), tier === false ? 2 : 14);
    } finally { setSharedClock(null); }
  }
});

// ── THE PINS THE LENSES FOUND MISSING ─────────────────────────────────

test('the third pass: a Hard character sets out with the kit too, on the wizard\'s mint and the fallback; an Off one with DFU\'s bag alone (Mac: "No, not off")', () => {
  const kit = startingProvisions().map((i) => i.templateIndex);
  for (const [tier, has] of [['hard', true], ['casual', true], [SURVIVAL_STORED[SURVIVAL_OFF], false]]) {
    _resetForTests(); setPref(SURVIVAL_PREF, tier);
    const born = { items: [], gender: 'male', stats: { ...STATS }, career: {}, activeEffects: [] };
    assignStartingGear(born, { classIndex: 0, rolls: () => 0.5 });
    const f = { items: [] }; seedStartingEquipment(f);
    for (const [name, bag] of [['the wizard', born.items], ['the fallback', f.items]]) {
      assert.equal(kit.every((t) => bag.some((i) => i.templateIndex === t)), has, `${tier}: ${name} ${has ? 'packs' : 'does not pack'} the kit`);
    }
  }
});

test('the third pass: the WORLD\'s fires answer the rest\'s place in every tier and warm only a tier that uses them; a Hard rest beside a fire is free of the band', () => {
  const pool = createCamps({ hearths: () => [{ x: 10, y: 0, z: 10, foot: -1.6, w: 0.8, h: 1.6 }], entity: { items: [] } });
  for (const tier of ['casual', 'hard', SURVIVAL_STORED[SURVIVAL_OFF]]) {
    _resetForTests(); setPref(SURVIVAL_PREF, tier);
    assert.equal(pool.fireNear([10, 0, 10 + BY_FIRE_REACH - 0.01]), true, `${tier}: a brazier is the rest's place`);
    assert.equal(pool.fireNear([10, 0, 10 + BY_FIRE_REACH + 1]), false, `${tier}: and only within its reach`);
    assert.equal(pool.byFire([10, 0, 10]), tier !== false, `${tier}: it warms ${tier !== false ? 'a tier that uses it' : 'nobody Off'}`);
  }
  const e = body({ fatigue: 4000 }); const log = [];
  survivalOf(e, 0);
  runSurvivalMinutes(e, 0, 480, { ...BLIZZARD, resting: true, sleeping: 'camp', byFire: true }, minuteDeps(e, log, HARD));
  assert.deepEqual([log.filter((l) => l[0] === 'fatigue').length, log.filter((l) => l[0] === 'hurt').length], [0, 0], 'eight hours asleep by a fire in a blizzard: no band, no wound');
});

// ── CORPSE-FOOD: THE THIRD PASS'S OPEN ITEM, ANSWERED ─────────────────

test('CORPSE-FOOD (Mac: "It needs to be accessible with people with it on"): online a body\'s food is the room\'s - minted whatever the tier of the machine that raises the death, and rolled by a joiner\'s own copy of a dungeon body; offline it is the tier\'s', async () => {
  const { corpseFoodOn } = await import('../src/systems/survival/switch.js');
  const { installSurvivalLoot, uninstallSurvivalLoot, addCorpseFood } = await import('../src/systems/survival/loot.js');
  const { raiseEnemyDeath } = await import('../src/scenes/corpseMarker.js');
  const { MOBILE_TYPES } = await import('../src/characters/mobileTypes.js');
  // the switch: the tier offline, every tier online
  for (const [tier, offline] of [[SURVIVAL_OFF, false], ['casual', true], ['hard', true]]) {
    _resetForTests(); setPref(SURVIVAL_PREF, SURVIVAL_STORED[tier]);
    assert.deepEqual([corpseFoodOn(''), corpseFoodOn('?online')], [offline, true], `${tier}: offline ${offline}, online always`);
  }
  // a kill raised on an Off machine online - a cell foe's owner, a dungeon's host - carries the food for the party
  const bear = () => ({ mobileType: MOBILE_TYPES.GrizzlyBear, basics: { affinity: 'Animal' }, items: [] });
  let online = true;
  uninstallSurvivalLoot();
  installSurvivalLoot({ enabled: () => corpseFoodOn(online ? '?online' : '') });
  try {
    _resetForTests(); setPref(SURVIVAL_PREF, SURVIVAL_STORED[SURVIVAL_OFF]);
    const b = bear(); raiseEnemyDeath(b, { rolls: () => 0.99, luck: 50 });
    assert.ok(b.items.length > 0 && b.items.every((i) => i.templateIndex === TEMPLATE.RawMeat), 'an Off host\'s bear carries meat');
    online = false;
    const c = bear(); raiseEnemyDeath(c, { rolls: () => 0.99, luck: 50 });
    assert.deepEqual(c.items, [], 'offline, Off mints none');
    assert.equal(addCorpseFood(bear(), { rolls: () => 0.99 }), 0, '...through either door');
    // a joiner's copy: the door the dungeon's stream and arrival call rolls into the copy's own list
    online = true;
    const d = bear();
    assert.equal(addCorpseFood(d, { rolls: () => 0.99, luck: 50 }), d.items.length);
    assert.ok(d.items.length > 0, 'the joiner\'s copy carries its own roll');
  } finally {
    uninstallSurvivalLoot();
    installSurvivalLoot({ enabled: corpseFoodOn });   // as the boot left it (worldTick.js)
  }
  // ...and the dungeon calls it on the stream's first death and on an arrival's body that came without the room's list
  const dc = read('src/scenes/dungeonContext.js');
  assert.match(dc, /if \(r\.d === 1 && !f\.dead\) addCorpseFood\(f\.entity, \{ luck: liveStat\(playerEntity, 'luck'\) \}\);\n\s*if \(r\.d === 1\) \{ if \(!f\.dead\)/, 'the stream\'s death: the joiner\'s copy rolls its own');
  assert.match(dc, /if \(wire && sf\.dead && !f\.dead && sf\.items == null\) addCorpseFood\(f\.entity, \{ luck: liveStat\(playerEntity, 'luck'\) \}\);/, 'an arrival\'s body without the room\'s list: its own roll, food and all');
});

test('CORPSE-FOOD, mounted: the dungeon\'s own `applyFoeRecord` rolls a joiner\'s copy of the body its food on the stream\'s first word of the death - once, and never for a foe the word keeps alive', async () => {
  const acorn = await import('acorn');
  const { validFoeRecord } = await import('../src/net/wire.js');
  const { addCorpseFood } = await import('../src/systems/survival/loot.js');
  const { MOBILE_TYPES } = await import('../src/characters/mobileTypes.js');
  const D = read('src/scenes/dungeonContext.js');
  const ast = acorn.parse(D, { ecmaVersion: 'latest', sourceType: 'module' });
  let fn = null;
  (function walk(n) {
    if (!n || typeof n.type !== 'string' || fn) return;
    if (n.type === 'FunctionDeclaration' && n.id?.name === 'applyFoeRecord') { fn = D.slice(n.start, n.end); return; }
    for (const k of Object.keys(n)) { const v = n[k]; if (Array.isArray(v)) v.forEach(walk); else if (v && typeof v.type === 'string') walk(v); }
  })(ast);
  assert.ok(fn, 'dungeonContext.js has applyFoeRecord');
  const state = { validFoeRecord, addCorpseFood, liveStat: () => 50, playerEntity: {}, foes: [], _layoutFoes: 1, _retyping: new Set(), retypeFoe: async () => false, console, renownFoeDied };   // RENOWN1: the stream's death asks whether I fought it
  const scope = new Proxy(state, { has: (t, k) => k !== '__s', get: (t, k) => (k === Symbol.unscopables ? undefined : (k in t ? t[k] : globalThis[k])) });
  const { applyFoeRecord } = new Function('__s', `with (__s) { const setFoeDead = (f, d) => { f.dead = !!d; }; ${fn} return { applyFoeRecord }; }`)(scope);
  const bear = { mobileType: MOBILE_TYPES.GrizzlyBear, dead: false, entity: { mobileType: MOBILE_TYPES.GrizzlyBear, basics: { affinity: 'Animal' }, health: 5, items: [] }, ai: { feet: [0, 0, 0], yaw: 0, moving: false, isHostile: true } };
  state.foes.push(bear);
  const word = (dead) => ({ i: 0, t: 0, f: [1, 0, 1], y: 0, h: dead ? 0 : 5, d: dead ? 1 : 0, a: 0, m: 0, g: '', c: 0, s: 0 });
  _resetForTests();   // Casual: the switch says roll
  applyFoeRecord(bear, word(false));
  assert.deepEqual([bear.dead, bear.entity.items.length], [false, 0], 'alive: nothing rolled');
  applyFoeRecord(bear, word(true));
  const n = bear.entity.items.length;
  assert.ok(bear.dead && n >= 3 && bear.entity.items.every((i) => i.templateIndex === TEMPLATE.RawMeat), `the host's word of the death: the joiner's copy carries its own meat (${n})`);
  applyFoeRecord(bear, word(true));
  assert.equal(bear.entity.items.length, n, 'the stream says it again every frame; the body is rolled once');
});
