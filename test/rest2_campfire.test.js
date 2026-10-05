// REST2 (2026-10-03, bible/06-Systems/Rest-Arc.md section 3; Mac: "New players now start with a campfire, which now is
// an item that can be pickup up and used multiple times with limited uses with more availability in shops"): THE
// CAMPFIRE IS A TOOL, NOT A MATCH. Template 541 keeps its index and becomes the Campfire: eight charges, placed free
// (it leaves the pack while it stands, as a tent does), a night its OWNER sleeps at it spending one, cold rather than
// gone when it burns down, relit while it has fuel, picked back up with its charges. The camp's actions are the loot
// plaque's rows. Online it is the rest's, not the arc's: usable, stocked and in the start kit with Climates & Calories
// Off too.
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  CAMP_KIND, CAMP_TEXT, FIRE_MINUTES, placeCampItem, packCamp, stokeFire, fireLit, campExpired, campMenu, spendCampNight, newCamp,
} from '../src/systems/survival/camp.js';
import { createSurvivalItem, CAMPFIRE_USES, startingProvisions, campfireStock, provisionsStock } from '../src/systems/survival/items.js';
import { TEMPLATE } from '../src/systems/survival/food.js';
import { templateByIndex } from '../src/systems/itemTemplates.js';
import { createCamps } from '../src/scenes/camps.js';
import { setSharedClock, setWorldMinutes, worldMinutes } from '../src/systems/worldTick.js';
import { setPref, _resetForTests } from '../src/systems/uiPrefs.js';
import { survivalInfoTokens } from '../src/systems/itemInfo.js';

const rd = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const flat = () => (o, d, m) => (d[1] < 0 && m >= o[1] ? o[1] : null);
afterEach(() => { setSharedClock(null); _resetForTests(); });

test('REST2 the item: template 541 is the Campfire - eight nights of fuel, base 40; a General Store\'s shelf two to four; a new character a full one', () => {
  const t = templateByIndex(TEMPLATE.Campfire);
  assert.deepEqual([t.name, t.hitPoints, t.basePrice, CAMPFIRE_USES], ['Campfire', 8, 40, 8]);
  const fire = startingProvisions().find((it) => it.templateIndex === TEMPLATE.Campfire);
  assert.equal(fire.currentCondition, 8, 'the start kit\'s is full, not two lights of a kit');
  for (const r of [0, 0.5, 0.999]) {
    const n = campfireStock(() => r).length;
    assert.ok(n >= 2 && n <= 4, `two to four (${n})`);
    assert.ok(provisionsStock(5, () => r).filter((it) => it.templateIndex === TEMPLATE.Campfire).length >= 2);
  }
  const card = survivalInfoTokens(fire).map((x) => x.text);
  assert.ok(card.includes('8 nights of fuel'), 'its card says nights of fuel');
});

test('REST2 placing spends nothing: the Campfire leaves the pack and its charges ride the camp (`w` on the wire); none left is no fire; a tent pitches free too', () => {
  const list = [createSurvivalItem(TEMPLATE.Campfire)];
  const fire = list[0];
  const r = placeCampItem(fire, list, { now: 100, feet: [0, 1, 0], probe: flat(), place: {}, standing: 0, id: 'me:1' });
  assert.equal(r.ok, true);
  assert.equal(r.camp.wear, 8, 'its eight charges');
  assert.equal(fire.currentCondition, 8, 'the item spends none');
  assert.deepEqual(list, [], 'and leaves the pack while it stands');
  const empty = createSurvivalItem(TEMPLATE.Campfire, { condition: 0 });
  assert.equal(placeCampItem(empty, [empty], { now: 0, feet: [0, 1, 0], probe: flat(), place: {}, standing: 0 }).text, CAMP_TEXT.noFuel);
  const gear = createSurvivalItem(TEMPLATE.CampingEquipment, { condition: 20 });
  const t = placeCampItem(gear, [gear], { now: 0, feet: [0, 1, 0], probe: flat(), place: {}, standing: 0 });
  assert.equal(t.camp.wear, 20, 'pitching free: the twenty uses ride the camp');
});

test('REST2 a night spends one charge; the last leaves the Campfire cold, standing; it relights while it has fuel; picked up it comes back with what is left', () => {
  const camp = { ...newCamp({ id: 'me:1', kind: CAMP_KIND.Fire, pos: [0, 0, 0], now: 0, wear: 2 }), fuel: true };
  assert.equal(campExpired(camp, 10_000), false, 'no Campfire burns away');
  assert.deepEqual(spendCampNight(camp, 50), { spent: true, empty: false });
  assert.equal(camp.wear, 1);
  assert.deepEqual(spendCampNight(camp, 60), { spent: true, empty: true });
  assert.equal(fireLit(camp, 61), false, 'the last charge: cold');
  assert.equal(stokeFire(camp, 70), false, 'no fuel, no relighting');
  camp.wear = 3; camp.litUntil = 0;
  assert.equal(stokeFire(camp, 70), true, 'with fuel it relights');
  assert.equal(camp.litUntil, 70 + FIRE_MINUTES);
  const back = packCamp(camp);
  assert.equal(back.item.templateIndex, TEMPLATE.Campfire);
  assert.equal(back.item.currentCondition, 3);
  assert.equal(back.text, CAMP_TEXT.pickedUp);
  assert.deepEqual(spendCampNight(newCamp({ id: 'x', kind: CAMP_KIND.Fire, pos: [0, 0, 0], now: 0, wear: 0 }), 0), { spent: false, empty: true });
});

test('REST2 the rows: rest and cook at any fire; your cold Campfire with fuel relights; yours picks up; a friend\'s rests and cooks only', () => {
  const lit = { ...newCamp({ id: 'a', kind: CAMP_KIND.Fire, pos: [0, 0, 0], now: 0, wear: 5 }), fuel: true };   // AUDIT REST-PARTY B5: a Campfire's own fuel (placeCampItem marks it)
  assert.deepEqual(campMenu(lit, 10, true).map((r) => r.key), ['rest', 'cook', 'pack']);
  assert.equal(campMenu(lit, 10, true).at(-1).text, CAMP_TEXT.menuPickUp);
  assert.deepEqual(campMenu(lit, 10, false).map((r) => r.key), ['rest', 'cook']);
  const cold = { ...lit, litUntil: 0 };
  assert.deepEqual(campMenu(cold, 10, true).map((r) => r.text), [CAMP_TEXT.menuRest, CAMP_TEXT.menuCook, CAMP_TEXT.menuRelight, CAMP_TEXT.menuPickUp]);
  assert.deepEqual(campMenu({ ...cold, wear: 0 }, 10, true).map((r) => r.key), ['rest', 'cook', 'pack'], 'no fuel: no relight');
});

function pool(entity, said = []) {
  return createCamps({
    entity, camera: () => ({ feet: [0, 1, 0], yaw: 0 }), collider: () => ({ raycast: flat() }), place: () => ({}),
    say: (l) => said.push(l), openRest: () => said.push('REST'), showOverlay: () => {},
  });
}

test('REST2 the pool: online a Campfire stands with the arc Off; a night at your own spends its charge (a friend\'s nothing); the plaque\'s rows name it and its fuel; the lit row is what a press does - Pick up hands it back', () => {
  _resetForTests(); setPref('survival', false);
  setWorldMinutes(1000);
  const entity = { items: [createSurvivalItem(TEMPLATE.Campfire), createSurvivalItem(TEMPLATE.Campfire)] };
  const said = [];
  const off = pool(entity, said);
  // PIN MOVED (ENDLESS PROVISIONS, 2026-10-04: a camp is every tier's): offline with the arc Off a Campfire stands too
  assert.equal(off.placeItem(entity.items[0], entity.items), true, 'offline with the arc Off: the Campfire stands');
  assert.notEqual(said.at(-1), CAMP_TEXT.arcOff);
  setSharedClock(() => 1000);
  const p = pool(entity, said);
  assert.equal(p.placeItem(entity.items[0], entity.items), true, 'online: the rest\'s tool, the arc Off');
  const [c] = p.camps;
  const key = `camp:${c.rec.id}`;
  const name = p.hoverName(key);
  assert.equal(name.title, 'Your Campfire');
  assert.deepEqual(name.subs, ['8 nights of fuel']);
  assert.deepEqual(name.actions.map((a) => a.id), ['rest', 'cook', 'pack']);
  assert.equal(p.spendNightNear([0, 1, 0]), true);
  assert.equal(c.rec.wear, 7);
  c.owner = 'peer';   // a friend's fire
  assert.equal(p.spendNightNear([0, 1, 0]), false, 'a friend\'s fire costs you nothing');
  c.owner = null;
  assert.equal(p.activate(key, 'grab', 'rest'), true);
  assert.equal(said.at(-1), 'REST', 'the lit Rest rests');
  assert.equal(p.activate(key, 'grab', 'pack'), true);
  assert.equal(p.camps.length, 0);
  assert.equal(entity.items.at(-1).templateIndex, TEMPLATE.Campfire);
  assert.equal(entity.items.at(-1).currentCondition, 7, 'back with its fuel');
  assert.equal(worldMinutes() >= 0, true);
});

test('REST2 a world fire rests too: its plaque rows are Rest and Cook; online the lit Rest rests', () => {
  setSharedClock(() => 1000);
  const said = [];
  const p = createCamps({ hearths: () => [{ pos: [0, 0, 0], record: 1 }], entity: { items: [] }, say: (l) => said.push(l), openRest: () => said.push('REST') });
  assert.deepEqual(p.hoverName('hearth:0').actions.map((a) => a.id), ['rest', 'cook']);
  p.activate('hearth:0', 'grab', 'rest');
  assert.equal(said.at(-1), 'REST');
});

test('REST2 by source: the hosts hand the plaque\'s lit row to the camps and spend a night\'s charge; the online night and the offline six-hour rest both call it; the start kit and the shelf carry the Campfire online with the arc Off', () => {
  for (const f of ['src/scenes/world.js', 'src/scenes/exterior.js']) assert.match(rd(f), /camps\.activate\(_campPick\.key, getInteractionMode\(\), plaqueActionFor\(_campPick\.key\)\)/, f);
  assert.match(rd('src/scenes/dungeonContext.js'), /camps\.activate\(key, mode, plaqueActionFor\(key\)\)/);
  for (const f of ['src/scenes/world.js', 'src/scenes/exterior.js']) assert.match(rd(f), /onNightSlept: \(\) => camps\.spendNightNear\(/, f);
  // AUDIT FB1005 B1: the dungeon's spends it unless the night was a bed's (a Bedroll or a Campfire laid by a bed keeps it)
  assert.match(rd('src/scenes/dungeonContext.js'), /onNightSlept: \(\) => \(_restFromBed \|\| bedInReach\(dungeonBeds, _fpFeet\) \? false : camps\.spendNightNear\(_fpFeet\)\),/, 'src/scenes/dungeonContext.js');
  assert.match(rd('src/scenes/shared.js'), /out\.onNightSlept\?\.\(\);/);
  assert.match(rd('src/ui/restWindow.js'), /if \(this\.mode !== 'loiter' && \(this\.session\?\.totalHours \?\? 0\) >= 6\) this\.deps\.onNightSlept\?\.\(\);/, 'AUDIT REST F5: a loiter is no night');
  assert.match(rd('src/ui/enhancedRest.js'), /if \(overlay\.mode !== 'loiter' && \(overlay\.session\?\.totalHours \?\? 0\) >= 6\) deps\.onNightSlept\?\.\(\);/);
  assert.match(rd('src/systems/startingGear.js'), /else if \(sharedClockOn\(\)\) \{ const it = startingCampfire\(\);/);
  assert.match(rd('src/systems/shopStock.js'), /else if \(sharedClockOn\(\) && shelfIndex === 0\) for \(const it of campfireStock\(rolls\)\) items\.push\(it\);/);   // AUDIT REST II H8 (PIN MOVED): the counter's shelf alone
});
