// AUDIT 68 (2026-09-24) - cluster survival_u: src/systems/survival, the
// whole-tree quality sweep's survival slice. Each test names its finding's
// key and fails on the base (ad238de0) - the day's rot, the arrival's
// markers, the vampire's frozen needs, the water that never wet.
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import { FOOD, foodName, rotFoodDay } from '../src/systems/survival/food.js';
import { createSurvivalItem, VENDOR_ICON_FILES } from '../src/systems/survival/items.js';
import { newSurvival, survivalMinute, runSurvivalMinutes, survivalStatMods, shiftSurvival, hungerMinutes, hungerStage, awakeHours, NEED } from '../src/systems/survival/needs.js';
import { survivalHudChips } from '../src/systems/survival/status.js';
import { survivalFeed } from '../src/systems/survival/env.js';
import { SURVIVAL_RULES } from '../src/systems/survival/difficulty.js';
import { SURVIVAL_PREF } from '../src/systems/survival/switch.js';
import { stiffen, isStiff, REST_KIND } from '../src/systems/survival/rest.js';
import { huntRoll } from '../src/systems/survival/hunting.js';
import { inventoryItemImage } from '../src/systems/itemTemplates.js';
import { resolveItemName } from '../src/systems/itemInfo.js';
import { snapshotPlayer, restorePlayer } from '../src/systems/save.js';
import { setSharedClock, setWorldMinutes } from '../src/systems/worldTick.js';
import { setPref, _resetForTests } from '../src/systems/uiPrefs.js';
import { CLIMATES } from '../src/formats/mapsFile.js';
import { RACES } from '../src/systems/races.js';

const HARD = SURVIVAL_RULES.hard;
const STATS = Object.freeze({ strength: 50, intelligence: 50, willpower: 50, agility: 50, endurance: 50, personality: 50, speed: 50, luck: 50 });
const body = (extra = {}) => ({ stats: { ...STATS }, raceId: RACES.Breton, items: [], activeEffects: [], health: 40, maxHealth: 40, fatigue: 6400, ...extra });
/** A body save.js snapshots and restores whole. */
const player = (extra = {}) => ({ ...body(), isPlayer: true, level: 1, magicka: 0, maxMagicka: 20, skills: [20], career: {}, skillUses: new Array(35).fill(0), spells: [], ...extra });
const sinksFor = (e) => ({ drainFatigue: (n) => { e.fatigue = Math.max(0, e.fatigue - n); }, restoreFatigue: (n) => { e.fatigue = Math.min(6400, e.fatigue + n); }, hurt: (n) => { e.health = Math.max(0, e.health - n); }, say: () => {} });
const minuteDeps = (e, rules = HARD, extra = {}) => ({ sinks: sinksFor(e), autoDrink: false, autoEat: false, rules, rolls: () => 0.5, ctx: { raceId: RACES.Breton }, ...extra });
/** Indoors in the woods in midsummer: nothing wets or chills. */
const INDOORS = Object.freeze({ climateIndex: CLIMATES.Woodlands, month: 6, hour: 12, weather: 'sunny', insideBuilding: true });
/** The load arm online: `e` saved at `saved`, restored into a world standing at `world`. */
function loadOnline(e, saved, world) {
  const snap = JSON.parse(JSON.stringify(snapshotPlayer({ ...e, lastGameMinutes: saved }, { classicMinutes: saved })));
  setSharedClock(() => world);
  try {
    const r = player();
    restorePlayer(r, snap, null);
    return r;
  } finally { setSharedClock(null); }
}
afterEach(() => { _resetForTests(); setWorldMinutes(0); setSharedClock(null); });

test('AUDIT 68 S33-rot-day-undressed: the day\'s rot dresses what it spoils - the stage\'s name and, past stale, the mod\'s own picture, as the mint does', () => {
  for (const t of Object.keys(FOOD).map(Number).filter((k) => FOOD[k].keeps != null)) {
    const item = createSurvivalItem(t);
    for (let day = 0; day < 3; day++) rotFoodDay([[item]], day, () => 0.99);
    assert.equal(item.foodStage, 3, `${FOOD[t].name}: three bad days, rotten`);
    assert.equal(item.name, foodName(item), `${FOOD[t].name}: named by its stage`);
    assert.equal(resolveItemName(item), createSurvivalItem(t, { foodStage: 3 }).name, `${FOOD[t].name}: the inventory says what the mint would`);
    const img = inventoryItemImage(item);
    assert.deepEqual([img.archive, img.record], [t, 1], `${FOOD[t].name}: the rotten picture`);
    assert.ok(VENDOR_ICON_FILES.includes(`${img.archive}_${img.record}-0`), `${FOOD[t].name}: a picture the mod ships`);
  }
});

test('AUDIT 68 S33-align-ahead-markers: a save from further along than the world starts fresh on EVERY clock - no stiff morning, no hunt cooldown, and no minute stalled behind its own last one', () => {
  setPref(SURVIVAL_PREF, 'hard');
  const HUNT = { climateIndex: 232, outdoors: true };
  // a save at day 400 - stiff from a rough night, a hunt just rolled - loaded into a world at day 100
  const S = 400 * 1440 + 8 * 60, W = 100 * 1440 + 8 * 60;
  const e = player();
  e.survival = { ...newSurvival(S - 600), lastAte: S - 60, awakeSince: S - 120, lastMinute: S };
  stiffen(e, S - 40, REST_KIND.Rough, HARD);
  assert.ok(huntRoll(e.survival, { ...HUNT, minute: S }, () => 0), 'the save carries a hunt\'s cooldown');
  const a = loadOnline(e, S, W);
  assert.equal(isStiff(a.survival, W), false, 'the fresh start is a rested one');
  assert.deepEqual(survivalStatMods(a.survival, null, W, { rules: HARD }), {}, '...and costs nothing');
  assert.ok(huntRoll(a.survival, { ...HUNT, minute: W + 1 }, () => 0), 'and the hunt is the world\'s again');
  // a save ten hours ahead whose last meal was twelve hours before it: only its own clock is ahead
  const S2 = 100 * 1440 + 20 * 60, W2 = S2 - 600;
  const f = player();
  f.survival = { ...newSurvival(S2), lastAte: S2 - 720, awakeSince: S2 - 900, lastMinute: S2, thirst: 20 };
  const b = loadOnline(f, S2, W2);
  runSurvivalMinutes(b, W2, W2 + 540, INDOORS, minuteDeps(b));
  assert.equal(b.survival.lastMinute, W2 + 540, 'nine world-hours are nine hours of needs');
  assert.ok(b.survival.thirst > 0 && Number.isFinite(b.survival.felt), 'the thirst moved and the body felt the air');
  // and a relay correction moves the hunt's clock with the others
  const c = { survival: { ...newSurvival(1000), lastMinute: 1000, huntAt: 1300 } };
  shiftSurvival(c, 180);
  assert.equal(c.survival.huntAt, 1480, 'the cooldown rides the delta');
});

test('AUDIT 68 S33-vampire-hunger-ages: a vampire\'s hunger and wakefulness stand where the curse found them, so a cure wakes neither Starving nor sleepless', () => {
  const e = body();
  e.survival = { ...newSurvival(0), lastMinute: 0 };
  const DAY20 = 20 * 1440;
  // twenty days a vampire, the way the world tick walks them (two days a reading at most)
  for (let t = 0; t < DAY20; t += 2 * 1440) runSurvivalMinutes(e, t, t + 2 * 1440, INDOORS, minuteDeps(e, HARD, { ctx: { raceId: RACES.Breton, vampire: true } }));
  // cured: the first mortal minute
  runSurvivalMinutes(e, DAY20, DAY20 + 1, INDOORS, minuteDeps(e, HARD));
  const now = DAY20 + 1;
  assert.equal(hungerStage(hungerMinutes(e.survival, now)), 'fed', 'fed as when the curse took hold');
  assert.ok(awakeHours(e.survival, now) < NEED.AWAKE_FREE_HOURS, 'and awake no longer than then');
  assert.deepEqual(survivalHudChips(e, now).map((c) => c.key), [], 'the strip is empty');
  assert.equal(e.activeEffects.some((a) => a.kind === 'survival'), false, 'and Hard takes no attribute');
});

test('AUDIT 68 S33-water-never-wets: a swim soaks the swimmer - the law reads the water off the feed the hosts build', () => {
  setPref(SURVIVAL_PREF, 'casual');
  const e = body();
  e.survival = { ...newSurvival(1000), lastMinute: 1000 };
  // the exterior hosts' reading of a winter lake (world.js / exterior.js survivalEnvNow), through the one feed
  const feed = survivalFeed(e, { climateIndex: CLIMATES.Woodlands, month: 0, hour: 12, weather: 'sunny', inSunlight: true, swimming: true });
  const temp = survivalMinute(e, 1001, feed.env, { ...feed.deps, sinks: sinksFor(e), autoDrink: false, autoEat: false });
  assert.ok(temp.wetGain > 0, 'the water wets');
  assert.equal(e.survival.wet, NEED.WET_MAX, 'soaked at once');
  assert.ok(survivalHudChips(e, 1001).some((c) => c.key === 'wet' && c.text === 'Drenched'), 'and the strip says so');
});
