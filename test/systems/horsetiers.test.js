// HORSE-TIERS (2026-10-15, Mac: "Allow turn off. Rework this system to be more in line with how we handle climates and
// calories boons.") - HORSE CARE ON CLIMATES & CALORIES' MODEL (bible/06-Systems/Horse-Care.md, systems/upkeep/upkeepTiers.js):
// one key, three tiers - Off (DFU's plain horse), Boons (the default: care earns, neglect costs nothing, never below
// DFU's horse) and Hard (the system as it stood) - each player's own online, every reader asking the tier through one
// accessor (systems/upkeep/upkeepSwitch.js horseCareRules). Driven over the real switch, the real tile, the real shelf, the
// real upkeep and the real motor with the hosts' own walk and gallop installs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  HORSE_CARE_TIER_IDS, HORSE_CARE_DEFAULT, HORSE_CARE_STORED, HORSE_CARE_RULES, HORSE_CARE_HARD, horseCareTierOfStored, isStoredHorseCare,
} from '../../src/systems/upkeep/upkeepTiers.js';
import { horseCareRules, HORSE_CARE_PREF } from '../../src/systems/upkeep/upkeepSwitch.js';
import { getPref, setPref, loadPrefs, _resetForTests as resetPrefs } from '../../src/systems/uiPrefs.js';
import { FEATURES, FEATURE_PREF_DEFAULTS } from '../../src/systems/features.js';
import { onlineForcedPref, ONLINE_PLAYERS_OWN_PREFS } from '../../src/systems/online/onlineLane.js';
import { tileStates } from '../../src/ui/enhanced/enhancedMenu.js';
import { createUpkeep, registerUpkeepUses } from '../../src/systems/upkeep/upkeepRuntime.js';
import { steedStats, steedSpeedScale, teamDraftScale, stepBreath, bornStats, bondAt, feedHorse, HUNGER, MINUTES_A_DAY, STARVING_AFTER, OATS_TEMPLATE } from '../../src/systems/steedCare.js';
import { PlayerMotor } from '../../src/player/motor.js';
import { Collider } from '../../src/player/collider.js';
import { TRANSPORT_MODES, setRideWalk, setGallopGate, setCanRunOverride, canRunUnlessRiding, rideWalks } from '../../src/systems/transport.js';
import { saddleMeters } from '../../src/ui/enhanced/enhancedSaddle.js';
import { hungerLine, hungerTone } from '../../src/ui/holdingsPages.js';
import { itemUseHandler } from '../../src/systems/item/itemTemplates.js';

const SRC = fileURLToPath(new URL('../../src/', import.meta.url));
const rd = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const near = (a, b, e = 1e-6) => Math.abs(a - b) < e;
const T0 = 2_000_000;
const horse = (seed, extra = {}) => ({ group: 'Transportation', templateIndex: 94, horseSeed: seed, ...extra });
const oats = (n) => ({ group: 'UselessItems2', templateIndex: OATS_TEMPLATE, stackCount: n });
/** DFU's own numbers (PlayerSpeedChanger): the walk base 150, the ride base 375, the classic-to-Unity ratio 39.5. */
const WALK_50 = (50 + 150) / 39.5;
const RIDE_50 = (50 + 375) / 39.5;
const STILL = { forward: 0, strafe: 0, run: false, sneak: false, jump: false, up: false, down: false };
const ROW = FEATURES.find((f) => f.id === 'horse-care');
/** Seeds whose horses are born slow (Speed 30), middling and fast (Speed 71) - bornStats, the law's own. */
const SLOW = 55, FAST = 38;

/** The enhanced skin (horse care is Enhanced Plus's), offline or online, a fresh shelf; torn down after. */
function onPage(online, fn) {
  const had = Object.hasOwn(globalThis, 'location') ? globalThis.location : undefined;
  globalThis.location = { search: online ? '?skin=enhanced&online' : '?skin=enhanced' };
  resetPrefs();
  try { return fn(); } finally {
    resetPrefs();
    setRideWalk(null); setGallopGate(null); setCanRunOverride(null);
    if (had === undefined) delete globalThis.location; else globalThis.location = had;
  }
}
/** The tile's press, as the Settings screen presses it (ui/enhanced/enhancedMenu.js tileStates). */
const press = (label) => { const st = tileStates(ROW); assert.equal(st.locked, false, 'the tile takes the press'); st.set(st.labels.indexOf(label)); };
const pressed = () => { const st = tileStates(ROW); return st.labels[st.at]; };
/** A motor on a floor, standing, stats DFU's shape (Speed 50, Running 40). */
function motorOn() {
  const I = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  const col = new Collider(() => 0);
  col.addMesh('floor', new Float32Array([-500, 0, -500, 500, 0, -500, 500, 0, 500, -500, 0, 500]), new Uint32Array([0, 1, 2, 0, 2, 3]), I);
  const m = new PlayerMotor(col, { speed: 50, running: 40, agility: 50, strength: 50, endurance: 50, willpower: 50, swimming: 0, climbing: 0 });
  m.spawn(0, 0.1, 0);
  for (let f = 0; f < 5; f++) m.update(1 / 60, STILL, 0);
  m.transportMode = TRANSPORT_MODES.Horse;
  return m;
}
/** The upkeep as world.js and exterior.js build it - handed THE accessor - with their walk and gallop installed. */
function hostUpkeep(items, now = () => T0) {
  const up = createUpkeep({ items: () => items, now, horseCare: horseCareRules, wagonUpkeep: () => false });
  setCanRunOverride(null);
  setRideWalk((mode, runAsked) => up.rideWalks(mode, runAsked));
  setGallopGate((mode, mods) => up.gallopGate(mode, mods));
  return up;
}

test('HORSE-TIERS THE ONE KEY: Off, Boons and Hard on the `horseCare` key - the table to the value, the stored values, Boons the default the shelf takes from the row (never stored), and every tier the player\'s online; the row\'s words name the tiers and no longer say online is always on (mutants: the default back to the old system; a tier\'s field; the row forced online)', () => {
  assert.deepEqual(HORSE_CARE_TIER_IDS, ['off', 'boons', 'hard']);
  assert.equal(HORSE_CARE_DEFAULT, 'boons');
  assert.deepEqual({ ...HORSE_CARE_STORED }, { off: false, boons: 'boons', hard: 'hard' });
  assert.deepEqual(JSON.parse(JSON.stringify(HORSE_CARE_RULES)), {
    boons: { id: 'boons', hungerCosts: false, bondFades: false, paceFloor: true, draftDrags: false, refusedRunWalks: false },
    hard: { id: 'hard', hungerCosts: true, bondFades: true, paceFloor: false, draftDrags: true, refusedRunWalks: true },
  });
  assert.equal(HORSE_CARE_HARD, HORSE_CARE_RULES.hard, 'a law handed no rules runs the system as it stood');
  assert.deepEqual([false, 'boons', 'hard', true, 'Hard', undefined].map(horseCareTierOfStored), ['off', 'boons', 'hard', 'boons', 'boons', 'boons']);
  assert.deepEqual([false, 'boons', 'hard', true, 'off', 0].map(isStoredHorseCare), [true, true, true, false, false, false]);
  // the row: its segments write the stored values, in the table's order; its default is the table's; the player's online
  assert.deepEqual(ROW.control.tiers.map(([v]) => v), HORSE_CARE_TIER_IDS.map((k) => HORSE_CARE_STORED[k]));
  assert.deepEqual(ROW.control.tiers.map(([, l]) => l), ['Off', 'Boons', 'Hard']);
  assert.deepEqual([ROW.control.key, ROW.control.initial, ROW.control.online], [HORSE_CARE_PREF, HORSE_CARE_STORED[HORSE_CARE_DEFAULT], 'player']);
  assert.equal(FEATURE_PREF_DEFAULTS.horseCare, 'boons', 'the shelf takes its default from the row (RF4)');
  assert.equal(onlineForcedPref('horseCare', '?online'), undefined, 'nothing forced online');
  assert.ok(ONLINE_PLAYERS_OWN_PREFS.includes('horseCare'), 'the player\'s own, by name');
  assert.ok(!/always on/i.test(`${ROW.note} ${ROW.effect}`), 'RETIRING A FLAG DELETES THE SENTENCE');
  assert.match(ROW.note, /On Boons neglect costs nothing and it is never slower than the classic horse; on Hard a hungry horse is weaker; Off is the classic horse\.$/);
  assert.equal(ROW.effect, 'Takes effect at once. Online, each player picks their own.');
});

test('HORSE-TIERS THE TIER SWITCH ONLINE TAKES EFFECT: on an online page the tile is not locked and every press reaches every door at once, as offline - Off makes the horse DFU\'s (no walk, no gallop, no pace of its own, no breath bar, no meters, nothing fed, the oats no use), Hard and Boons give the cared horse back under their own rules (mutants: the row forced online; the accessor read once)', () => {
  for (const online of [true, false]) {
    onPage(online, () => {
      const items = [horse(SLOW, { horseFed: T0 + 600 }), oats(4)];
      const up = hostUpkeep(items);
      registerUpkeepUses(up, { reach: () => ({ near: true, stabled: false, wagonNear: true, who: 'Your horse' }), pass: () => {}, horseCare: horseCareRules, wagonUpkeep: () => false });   // as the hosts register the oats' Use
      const reads = () => ({
        tier: horseCareRules()?.id ?? 'off', walks: rideWalks('Horse'), gallops: canRunUnlessRiding('Horse'), pace: up.rideScale('Horse'),
        bar: !!up.bar('Horse'), meters: saddleMeters({ ...up.saddle('Horse'), mode: 'Horse' }).map((m) => m.key), oatsUsable: !!itemUseHandler(OATS_TEMPLATE)?.usable?.(),
      });
      const where = online ? 'online' : 'offline';
      assert.equal(pressed(), 'Boons', `${where}: Boons, the default`);
      const boons = reads();
      assert.deepEqual(boons, { tier: 'boons', walks: true, gallops: true, pace: 1, bar: true, meters: ['breath', 'hunger', 'bond'], oatsUsable: true }, `${where}: Boons - and the slow horse never under DFU's pace`);
      press('Off');
      assert.deepEqual(reads(), { tier: 'off', walks: false, gallops: false, pace: 1, bar: false, meters: [], oatsUsable: false }, `${where}: Off is DFU's horse, at once`);
      assert.equal(up.act('feed', 0).ok, false, `${where}: nothing to feed`);
      assert.equal(getPref(HORSE_CARE_PREF), false, 'Off stored as the old switch\'s own false');
      press('Hard');
      const hard = reads();
      assert.equal(hard.tier, 'hard');
      assert.ok(near(hard.pace, steedSpeedScale(30, HORSE_CARE_HARD)) && hard.pace < 1, `${where}: Hard - the slow horse under DFU's pace, as the system stood (${hard.pace})`);
      press('Boons');
      assert.deepEqual(reads(), boons, `${where}: Boons again`);
      assert.equal(getPref(HORSE_CARE_PREF), 'boons');
    });
  }
});

test('HORSE-TIERS BOONS NEVER DROPS BELOW THE PLAIN HORSE: over the real motor with the hosts\' walk and gallop - every horse, slow to fast, fed, hungry or starving, fresh or winded - Run held is never slower than DFU\'s horse on Boons, where on Hard a slow, hungry, starving or winded horse falls under it; the walk with Run let go is the owner\'s HORSE-WALK in both; and the horse itself is never charged on Boons - no stat off for hunger, no breath slowed, no bond faded, no team dragging a load (mutants: a refused gallop walked; the motor\'s walk asked without the run; its base asked without the run; the pace unfloored; the hunger\'s penalty paid; the breath slowed; the draft dragging; the bond faded on Boons; the fade taken at a Boons meal)', () => {
  assert.equal(bornStats(SLOW).speed, 30);
  assert.equal(bornStats(FAST).speed, 71);
  const offRun = onPage(false, () => { setPref(HORSE_CARE_PREF, false); const up = hostUpkeep([horse(SLOW)]); const m = motorOn(); m.rideSpeedScale = up.rideScale('Horse'); m.update(1 / 60, { ...STILL, forward: 1, run: true }, 0); return m.speed; });
  assert.ok(near(offRun, RIDE_50), `Off: DFU's one pace with Run held - no gallop in the saddle (${offRun})`);
  const hunger = { fed: T0 + 600, hungry: T0 - 60, starving: T0 - STARVING_AFTER - 60 };
  const cases = [];
  for (const tier of ['boons', 'hard']) {
    for (const seed of [SLOW, 2, FAST]) {
      for (const [h, fed] of Object.entries(hunger)) {
        for (const winded of [false, true]) {
          onPage(false, () => {
            setPref(HORSE_CARE_PREF, tier);
            const items = [horse(seed, { horseFed: fed })];
            const up = hostUpkeep(items);
            up.tick(0, { mode: 'Horse' });
            if (winded) up.tick(600, { mode: 'Horse', galloping: true, moving: true });
            assert.equal(up.breathOf().winded, winded, `${tier} ${seed} ${h}: winded as asked`);
            const m = motorOn();
            m.rideSpeedScale = up.rideScale('Horse');
            m.update(1 / 60, { ...STILL, forward: 1, run: true }, 0);
            const run = m.speed;
            m.update(1 / 60, { ...STILL, forward: 1 }, 0);
            cases.push({ tier, seed, h, winded, run, walk: m.speed, walking: m.rideWalking, scale: m.rideSpeedScale });
          });
        }
      }
    }
  }
  const boons = cases.filter((c) => c.tier === 'boons'), hard = cases.filter((c) => c.tier === 'hard');
  for (const c of boons) {
    assert.ok(c.run >= RIDE_50 - 1e-9, `Boons, Run held: never under DFU's horse - ${JSON.stringify(c)}`);
    assert.ok(c.scale >= 1, `Boons: the pace never under DFU's - ${JSON.stringify(c)}`);
    assert.ok(c.walking && near(c.walk, WALK_50 * c.scale), `Boons, Run let go: the walk, at the horse's pace - ${JSON.stringify(c)}`);
    if (c.winded || c.h === 'starving') assert.ok(near(c.run, RIDE_50 * c.scale), `Boons: a gallop refused rides DFU's own pace, never the walk - ${JSON.stringify(c)}`);
    else assert.ok(c.run > RIDE_50 * 1.5, `Boons: the gallop earned - ${JSON.stringify(c)}`);
  }
  const under = hard.filter((c) => c.run < RIDE_50 - 1e-9);
  assert.ok(under.some((c) => c.winded) && under.some((c) => c.h === 'starving'), 'Hard: a winded or starving horse is held to the walk with Run held, under DFU\'s horse');
  assert.ok(hard.some((c) => c.seed === SLOW && c.scale < 1), 'Hard: a born-slow horse rides under DFU\'s pace');
  // the horse itself: never charged on Boons
  const st = (tier, fed) => steedStats(horse(SLOW, { horseFed: fed, horseBond: 400 }), T0, HORSE_CARE_RULES[tier]);
  assert.deepEqual(st('boons', hunger.starving).stats, st('boons', hunger.fed).stats, 'Boons: a starving horse\'s stats are a fed one\'s');
  assert.equal(st('boons', hunger.starving).penalty, 0);
  assert.equal(st('hard', hunger.starving).penalty, HUNGER.starving.penalty);
  assert.equal(st('boons', T0 - STARVING_AFTER - 5 * MINUTES_A_DAY).bond, 40, 'Boons: a bond never faded, five days starving');
  assert.ok(st('hard', T0 - STARVING_AFTER - 5 * MINUTES_A_DAY).bond < 40, 'Hard: faded');
  const fedFrom = (tier) => { const h = horse(SLOW, { horseFed: T0 - STARVING_AFTER - 5 * MINUTES_A_DAY, horseBond: 400 }); const its = [h, oats(1)]; feedHorse(its, h, 'oats', T0, 'Your horse', { rules: HORSE_CARE_RULES[tier] }); return h.horseBond; };
  assert.equal(fedFrom('boons'), 430, 'Boons: fed after five starving days, the bond only grows - a day\'s food, three points');
  assert.equal(fedFrom('hard'), 330, 'Hard: the fade taken first (ten points for five days), then the meal\'s three');
  const back = (tier, hungerKey) => 1000 - stepBreath({ spent: 1000, winded: true }, { stats: bornStats(2), hunger: hungerKey, dt: 10, rules: HORSE_CARE_RULES[tier] }).spent;
  assert.equal(back('boons', 'starving'), back('boons', 'fed'), 'Boons: a hungry breath comes back as fast');
  assert.ok(back('hard', 'starving') < back('hard', 'fed'), 'Hard: slower');
  assert.deepEqual([teamDraftScale(20, 1, HORSE_CARE_RULES.boons), teamDraftScale(100, 1, HORSE_CARE_RULES.boons)], [1, 1], 'Boons: no team drags a wagon - DFU\'s');
  assert.ok(teamDraftScale(20, 1, HORSE_CARE_RULES.hard) < 1);
  assert.deepEqual([steedSpeedScale(20, HORSE_CARE_RULES.boons), steedSpeedScale(50, HORSE_CARE_RULES.boons), steedSpeedScale(100, HORSE_CARE_RULES.boons)], [1, 1, 1.15], 'Boons: the pace floored at DFU\'s, a fast horse\'s earned');
});

test('HORSE-TIERS THE OLD SWITCH MIGRATED, through a real shelf: a player who turned horse care off is on Off with nothing converted (the old switch\'s own false, kept for an older build); one who never touched it stored nothing and plays the new default, Boons; an On written to the shelf chose the system as it stood and lands on Hard, written so at the next save; a chosen tier is kept, the default stores nothing, and any other value is dropped at the load (mutants: the old On read as the default; junk kept)', () => {
  const KEY = 'dagger.ui.v1';
  let store = new Map();
  const had = Object.hasOwn(globalThis, 'localStorage'), saved = globalThis.localStorage;
  const loc = Object.hasOwn(globalThis, 'location') ? globalThis.location : undefined;
  globalThis.localStorage = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) };
  globalThis.location = { search: '?skin=enhanced' };
  const withShelf = (blob) => { store = new Map([[KEY, JSON.stringify(blob)]]); resetPrefs(); loadPrefs(); };
  const shelf = () => JSON.parse(store.get(KEY) ?? '{}');
  const tier = () => horseCareRules()?.id ?? 'off';
  try {
    withShelf({ horseCare: false });
    assert.equal(tier(), 'off', 'turned off before the tiers: Off');
    setPref('showFps', true);   // any write saves the shelf
    assert.equal(shelf().horseCare, false, 'kept as the very value it was');
    withShelf({});
    assert.equal(tier(), 'boons', 'never touched: the new default, Boons');
    withShelf({ horseCare: true });
    assert.equal(tier(), 'hard', 'an On written to the shelf: the system as it stood');
    setPref('showFps', true);
    assert.equal(shelf().horseCare, 'hard', 'written as its tier at the next save');
    withShelf(shelf());
    assert.equal(tier(), 'hard', 'and Hard across every reload after');
    withShelf({ horseCare: 'boons' });
    assert.equal(tier(), 'boons');
    setPref('showFps', true);
    assert.equal(Object.hasOwn(shelf(), 'horseCare'), false, 'the default stores nothing (PREF1)');
    for (const junk of ['false', 'off', 'Hard', 'casual', 7, null]) {
      withShelf({ horseCare: junk });
      assert.equal(tier(), HORSE_CARE_DEFAULT, `${JSON.stringify(junk)} names no tier - the default`);
      setPref('showFps', true);
      assert.equal(Object.hasOwn(shelf(), 'horseCare'), false, `${JSON.stringify(junk)} was dropped at the load`);
    }
  } finally {
    if (had) globalThis.localStorage = saved; else delete globalThis.localStorage;
    if (loc === undefined) delete globalThis.location; else globalThis.location = loc;
    resetPrefs();
  }
});

test('HORSE-TIERS OFF\'S MINUTES ARE NOBODY\'S NEEDS, AND BOONS OWES NO FADE: days Off carry each horse\'s food clock with the clock, so on again it stands where Off found it - neither starved nor faded; a horse starving on Boons is held at the starving line, so a turn to Hard owes no fade for the Boons days and fades from the turn on (mutants: Off\'s clock left running; the starving line unheld)', () => {
  onPage(false, () => {
    let t = T0;
    const h = horse(2, { horseFed: T0 + 600, horseBond: 300 });
    const up = hostUpkeep([h], () => t);
    up.tick(0, { mode: 'Horse' });
    setPref(HORSE_CARE_PREF, false);
    for (let d = 1; d <= 6; d++) { t = T0 + d * MINUTES_A_DAY; up.tick(1, { mode: 'Foot' }); }
    setPref(HORSE_CARE_PREF, 'hard');
    up.tick(1, { mode: 'Foot' });
    const st = steedStats(h, t, HORSE_CARE_HARD);
    assert.deepEqual([st.hunger, Math.round((h.horseFed - t) / 60), st.bond], ['fed', 10, 30], 'six days Off: still fed for its ten hours, the bond whole');
  });
  onPage(false, () => {
    let t = T0;
    const h = horse(2, { horseFed: T0 - STARVING_AFTER, horseBond: 300 });
    setPref(HORSE_CARE_PREF, 'boons');
    const up = hostUpkeep([h], () => t);
    for (let d = 0; d <= 5; d++) { t = T0 + d * MINUTES_A_DAY; up.tick(1, { mode: 'Foot' }); }
    assert.equal(steedStats(h, t, HORSE_CARE_RULES.boons).hunger, 'starving', 'Boons: Starving still - the same world');
    assert.equal(t - h.horseFed, STARVING_AFTER, 'held at the starving line');
    setPref(HORSE_CARE_PREF, 'hard');
    assert.equal(bondAt(h, t), 30, 'turned to Hard: no fade owed for the Boons days');
    t += 2 * MINUTES_A_DAY;
    up.tick(1, { mode: 'Foot' });
    assert.equal(bondAt(h, t), 26, 'and Hard fades from the turn on - two days, four points');
  });
});

test('HORSE-TIERS NO RED WHERE HUNGER COSTS NOTHING, AND EACH TIER\'S WORDS: the saddle panel\'s and the Stable page\'s hunger stop at amber on Boons and say only the gallop a starving horse has not earned; on Hard they say what hunger takes, red at Starving (mutants: the chip red on Boons; the Stable card\'s chip red on Boons; Boons said in Hard\'s words)', () => {
  const read = (hungerCosts, hungerKey, hungerWord) => saddleMeters({ mode: 'Horse', horse: { breath: 1, winded: false, hunger: hungerWord, hungerKey, fedHours: 0, full: false, tier: 'Wary', bond: 0, tierAt: 0, next: { name: 'Accepting', at: 15 }, hungerCosts }, wagon: null, load: null }).find((m) => m.key === 'hunger').tone;
  assert.deepEqual([read(false, 'starving', 'Starving'), read(false, 'hungry', 'Hungry'), read(true, 'starving', 'Starving'), read(undefined, 'starving', 'Starving')], ['warn', 'warn', 'low', 'low'], 'Boons amber; Hard - and a read that does not say - red');
  const boons = { hungerCosts: false }, hard = { hungerCosts: true };
  assert.deepEqual([hungerTone({ hungerKey: 'starving' }, boons), hungerTone({ hungerKey: 'starving' }, hard), hungerTone({ hungerKey: 'hungry' }, boons)], ['is-hurt', 'is-lost', 'is-hurt'], 'the Stable card\'s chip: amber on Boons');
  assert.deepEqual([hungerLine({ hungerKey: 'starving' }, boons), hungerLine({ hungerKey: 'hungry' }, boons)], ['Starving. It will not gallop until it eats. Feed it.', 'Hungry, but no penalty yet.']);
  assert.deepEqual([hungerLine({ hungerKey: 'starving' }, hard), hungerLine({ hungerKey: 'starving' })], ['Starving: every attribute 25 lower, no gallop, and your bond is fading. Feed it.', 'Starving: every attribute 25 lower, no gallop, and your bond is fading. Feed it.']);
  onPage(false, () => {
    const up = hostUpkeep([horse(2, { horseFed: T0 - STARVING_AFTER - 60 })]);
    assert.deepEqual([up.saddle('Horse').horse.hungerCosts, up.model().hungerCosts, up.model().tier], [false, false, 'boons']);
    setPref(HORSE_CARE_PREF, 'hard');
    assert.deepEqual([up.saddle('Horse').horse.hungerCosts, up.model().hungerCosts, up.model().tier], [true, true, 'hard']);
  });
});

test('HORSE-TIERS THE ONE ACCESSOR AND THE FOUR HOSTS: no module but the switch reads the horse care key, the old boolean switch is gone, and every reader is handed the one accessor - world.js and exterior.js hand it to the upkeep (the keep, the breath, the gallop gate, the walk, the pace, the HUD\'s bar, the Stable page, the saddle panel) and to the oats\' Use; worldModes.js prices a Stable\'s horses by it; dungeonContext.js stands no transport and reads nothing', () => {
  const files = [];
  const walk = (dir) => { for (const f of readdirSync(dir)) { const p = join(dir, f); if (statSync(p).isDirectory()) walk(p); else if (f.endsWith('.js')) files.push(p); } };
  walk(SRC);
  const rel = (p) => p.slice(SRC.length);
  assert.deepEqual(files.filter((p) => /getPref\((HORSE_CARE_PREF|'horseCare')\)/.test(readFileSync(p, 'utf8'))).map(rel), ['systems/upkeep/upkeepSwitch.js'], 'one reader of the key');
  assert.deepEqual(files.filter((p) => /\bhorseCareOn\b/.test(readFileSync(p, 'utf8'))).map(rel), [], 'the boolean switch is gone');
  for (const host of ['world.js', 'exterior.js']) {
    const s = rd(`src/scenes/${host}`);
    assert.match(s, /import \{ horseCareRules, wagonUpkeepRules \} from '\.\.\/systems\/upkeep\/upkeepSwitch\.js';/, host);
    assert.match(s, /horseCare: horseCareRules, wagonUpkeep: wagonUpkeepRules,\n\s*where: /, `${host}: the upkeep`);
    assert.match(s, /reach: \(\) => upkeepReach\(hccRuntimeOn\(\), !!hccRuntimeOn\(\)\), horseCare: horseCareRules, wagonUpkeep: wagonUpkeepRules,/, `${host}: the oats' Use`);
    assert.match(s, /setRideWalk\(\(mode, runAsked\) => [^\n]*upkeep\.rideWalks\(mode, runAsked\)\);/, `${host}: the walk told the run asked`);
  }
  assert.match(rd('src/scenes/worldModes.js'), /priced: !!horseCareRules\(\),/, 'worldModes.js: a Stable\'s prices');
  assert.ok(!/horseCare/.test(rd('src/scenes/dungeonContext.js')), 'dungeonContext.js: no transport');
  assert.match(rd('src/player/motor.js'), /this\.rideWalking = rideBase != null && !this\.isRunning && rideWalks\(this\.transportMode, this\._runMode\);/, 'the motor asks the walk with the run it asks');
});
