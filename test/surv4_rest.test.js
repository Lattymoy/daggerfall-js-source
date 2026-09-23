import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  REST_KIND, REST_COST, STIFF_HOURS, STIFF_PENALTY, REST_TEXT_SURVIVAL, restKind, restCost, restHour, stiffen, isStiff, restBlock, installSurvivalRestGate,
} from '../src/systems/survival/rest.js';
import { newSurvival, survivalOf, survivalStatMods } from '../src/systems/survival/needs.js';
import { intermittentEnemySpawn } from '../src/systems/encounters.js';
import { createRestDeps, restVitals } from '../src/scenes/shared.js';
import { registerPreventRestCondition, getPreventedRestMessage, clearPreventRestConditions } from '../src/systems/restSession.js';
import { setPref, _resetForTests } from '../src/systems/uiPrefs.js';
import { setWorldMinutes } from '../src/systems/worldTick.js';
import { SKILLS } from '../src/systems/skills.js';

// ═══ SURV4 (2026-09-18): THE REST LAW ═══════════════════════════════
//
// Mac: "Campfires in dungeons/outside + beds should act as the go-to
// rest options ... Resting toggle both offline/online should always be
// a last resort option that comes with a cost." A bed or a fire sleeps
// whole; the window alone is ROUGH - half the hour's recovery, the
// resting roll asked twice, a stiff morning - and the felt temperature
// can refuse the sleep outright.

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');
const player = () => ({
  isPlayer: true, level: 1, health: 10, maxHealth: 40, magicka: 0, maxMagicka: 20, fatigue: 0,
  stats: { strength: 50, intelligence: 50, willpower: 50, agility: 50, endurance: 50, personality: 50, speed: 50, luck: 50 },
  skills: 20, career: {}, skillUses: { [SKILLS.Medical]: 0 }, activeEffects: [],
});

test('SURV4: the kind - a bed, a house or a ship sleep; a lit fire near is a camp; the rest is rough, and rough costs', () => {
  assert.equal(restKind({ bed: true }), REST_KIND.Bed);
  assert.equal(restKind({ houseOwned: true }), REST_KIND.Bed);
  assert.equal(restKind({ ship: true, byFire: true }), REST_KIND.Bed, 'a berth before a fire');
  assert.equal(restKind({ byFire: true }), REST_KIND.Camp);
  assert.equal(restKind({}), REST_KIND.Rough);
  assert.deepEqual(REST_COST.bed, { recovery: 1, encounters: 1, stiffHours: 0 });
  assert.deepEqual(REST_COST.camp, { recovery: 1, encounters: 1, stiffHours: 0 });
  assert.deepEqual(REST_COST.rough, { recovery: 0.5, encounters: 2, stiffHours: STIFF_HOURS });
  assert.equal(restCost('nonsense'), REST_COST.rough, 'an unknown kind is the costed one');
  assert.equal(STIFF_HOURS, 4); assert.equal(STIFF_PENALTY, 5);
});

test('SURV4: the hour - a bed or a camp keeps DFU\'s whole hour; a rough hour keeps half of what it gained and is never "healed" while it took some back', () => {
  const tick = (e, dh, df, dm) => () => { e.health += dh; e.fatigue += df; e.magicka += dm; return e.health >= e.maxHealth; };
  const a = player();
  assert.equal(restHour(a, REST_KIND.Bed, tick(a, 6, 640, 4)), false);
  assert.deepEqual([a.health, a.fatigue, a.magicka], [16, 640, 4], 'the whole hour');
  const b = player();
  assert.equal(restHour(b, REST_KIND.Rough, tick(b, 7, 640, 5)), false);
  assert.deepEqual([b.health, b.fatigue, b.magicka], [13, 320, 2], 'half, floored');
  const c = { ...player(), health: 39 };
  assert.equal(restHour(c, REST_KIND.Rough, tick(c, 1, 0, 0)), false, 'the tick said healed at 40, but the half took it back to 39');
  assert.equal(c.health, 39);
  const d = { ...player(), health: 40, fatigue: 100 };
  assert.equal(restHour(d, REST_KIND.Camp, tick(d, 0, 0, 0)), true, 'a camp answers the tick\'s own word');
  const e = { ...player(), health: 40 };
  assert.equal(restHour(e, REST_KIND.Rough, tick(e, 0, 0, 0)), true, 'nothing gained, nothing taken - the word stands');
});

test('SURV4: the stiff morning - four hours of speed and agility off the survival entry after a rough night; a bed leaves you limber', () => {
  const e = player();
  assert.equal(stiffen(e, 1000, REST_KIND.Bed), false);
  assert.equal(e.survival, undefined, 'a bed writes nothing');
  assert.equal(stiffen(e, 1000, REST_KIND.Rough), true);
  assert.equal(survivalOf(e, 1000).stiffUntil, 1000 + STIFF_HOURS * 60);
  assert.equal(stiffen(e, 1100, REST_KIND.Rough), true); assert.equal(e.survival.stiffUntil, 1100 + STIFF_HOURS * 60, 'a second rough night extends from now');
  assert.equal(isStiff(e.survival, 1100 + STIFF_HOURS * 60 - 1), true); assert.equal(isStiff(e.survival, 1100 + STIFF_HOURS * 60), false);
  assert.equal(newSurvival(5).stiffUntil, 0, 'the record carries the marker');
  const mods = survivalStatMods({ ...newSurvival(0), stiffUntil: 100 }, { abs: 0 }, 50);
  assert.deepEqual(mods, { speed: -STIFF_PENALTY, agility: -STIFF_PENALTY });
  assert.deepEqual(survivalStatMods({ ...newSurvival(0), stiffUntil: 100 }, { abs: 0 }, 100), {}, 'and it lifts');
});

test('SURV4: the gate - too cold without a fire or a roof, too hot anywhere; DFU\'s own prevent-rest seam carries both words', () => {
  assert.equal(restBlock({ tempWord: 'freezing' }), REST_TEXT_SURVIVAL.tooCold);
  assert.equal(restBlock({ tempWord: 'deadly cold' }), REST_TEXT_SURVIVAL.tooCold);
  assert.equal(restBlock({ tempWord: 'freezing', byFire: true }), null, 'a fire is the answer');
  assert.equal(restBlock({ tempWord: 'freezing', insideBuilding: true }), null, 'so is a roof');
  assert.equal(restBlock({ tempWord: 'cold' }), null, 'merely cold sleeps');
  assert.equal(restBlock({ tempWord: 'scorching', byFire: true, insideBuilding: true }), REST_TEXT_SURVIVAL.tooHot, 'nothing answers the heat');
  assert.equal(restBlock({ tempWord: 'hot' }), null);
  clearPreventRestConditions();
  let env = { tempWord: 'comfortable' };
  let on = true;
  const [cold, hot] = installSurvivalRestGate(() => env, registerPreventRestCondition, { enabled: () => on });
  assert.equal(getPreventedRestMessage(), null);
  env = { tempWord: 'deadly cold' }; assert.equal(getPreventedRestMessage(), REST_TEXT_SURVIVAL.tooCold);
  env = { tempWord: 'deadly cold', byFire: true }; assert.equal(getPreventedRestMessage(), null);
  env = { tempWord: 'scorching' }; assert.equal(getPreventedRestMessage(), REST_TEXT_SURVIVAL.tooHot);
  on = false; assert.equal(getPreventedRestMessage(), null, 'the switch off, the gate is gone');
  assert.equal(hot(), false);
  env = { tempWord: 'deadly cold' }; assert.equal(getPreventedRestMessage(), null, 'the cold arm too'); assert.equal(cold(), false);
  clearPreventRestConditions();
});

test('SURV4: the roll - a rough rest asks the minute\'s decision twice and takes the first spawn; a bed, a camp or no rest asks once', () => {
  // a dungeon rest under an alert: rollDungeon passes on a 0 of 36 - the sequence below misses first and hits second
  const ctx = { gameMinutes: 1440 * 3, inside: true, inDungeon: true, isResting: true, enemyAlertActive: true, dungeonType: 0, playerLevel: 5 };   // rollDungeon passes on a 0 of 36 under an alert, never without one; timeForSpawn wants a minute on the twelfth twelve
  const seq = (vals) => { let i = 0; return () => vals[i++ % vals.length]; };
  const once = intermittentEnemySpawn(ctx, seq([0.9, 0.0, 0.5]));
  assert.equal(once, null, 'one ask, a miss');
  // SURV-TIERS: the host hands the rest's ASKS (stamped at the open by scenes/shared.js createRestDeps - Hard's rough night two)
  const twice = intermittentEnemySpawn({ ...ctx, restAsks: 2 }, seq([0.9, 0.0, 0.5]));
  assert.ok(twice && Number.isInteger(twice.mobileType), 'the second ask lands');
  assert.equal(intermittentEnemySpawn({ ...ctx, restAsks: 2 }, seq([0.9, 0.9, 0.9])), null, 'two misses are a miss');
  const first = intermittentEnemySpawn({ ...ctx, restAsks: 2 }, seq([0.0, 0.5, 0.0, 0.5]));
  assert.ok(first, 'a first-ask hit is taken as it is');
});

test('SURV4: the composed deps - the kind is read at the open and rides the entity; a rough hour pays half; the morning is stiff and said once; the switch off is DFU\'s hour', () => {
  _resetForTests(); setPref('survival', 'hard'); setWorldMinutes(6000);   // SURV-TIERS: the half hour and the stiff morning are Hard's rough price
  const said = [];
  const e = player();
  let kind = 'rough';
  const d = createRestDeps(e, { advanceMinutes: () => {}, endLines: () => [], say: (l) => said.push(l), restKind: () => kind, day: () => false, inside: () => true });
  d.setResting(true);
  assert.equal(e.isResting, true); assert.equal(e.restKind, 'rough', 'the entity says how it sleeps');
  const full = player(); restVitals(full, { day: false, inside: true });
  d.tickVitals();
  assert.equal(e.health, 10 + Math.trunc((full.health - 10) / 2), 'half of DFU\'s hour');
  assert.equal(e.fatigue, Math.trunc(full.fatigue / 2));
  d.setResting(false);
  assert.equal(e.restKind, null);
  assert.equal(said[0], REST_TEXT_SURVIVAL.stiff, 'the morning is said on the way out'); assert.equal(e.survival.stiffUntil, 6000 + STIFF_HOURS * 60);
  d.onRestFinished(); d.setResting(false);
  assert.equal(said.filter((l) => l === REST_TEXT_SURVIVAL.stiff).length, 1, 'said once - the hours were spent');
  kind = 'camp'; const c = player();
  const dc = createRestDeps(c, { advanceMinutes: () => {}, endLines: () => [], say: (l) => said.push(l), restKind: () => kind, day: () => false, inside: () => true });
  dc.setResting(true); assert.equal(c.restKind, 'camp'); dc.tickVitals();
  assert.equal(c.health, full.health, 'a camp is the whole hour'); dc.setResting(false); dc.onRestFinished();
  assert.equal(c.survival, undefined, 'and no stiff morning');
  const dn = createRestDeps(player(), { advanceMinutes: () => {} });
  dn.setResting(true); assert.equal(dn.tickVitals !== undefined, true);
  setPref('survival', 'off');
  const off = player();
  const doff = createRestDeps(off, { advanceMinutes: () => {}, restKind: () => 'rough', day: () => false, inside: () => true });
  doff.setResting(true); assert.equal(off.restKind, 'bed', 'the mod off, every rest is DFU\'s bed');
  doff.tickVitals(); assert.equal(off.health, full.health);
  _resetForTests(); setWorldMinutes(0);
});

test('SURV4: by source - the four hosts name their kind, the three rolls carry the rest\'s asks, the law is pure', () => {
  const w = read('src/scenes/world.js'), x = read('src/scenes/exterior.js'), dc = read('src/scenes/dungeonContext.js'), wm = read('src/scenes/worldModes.js');
  assert.match(w, /restKind: \(\) => \(camps\.byFire\(walkMode && playerSpawned \? player\.pos : cam\.pos\) \? 'camp' : 'rough'\),/);
  assert.match(x, /restKind: \(\) => \(camps\.byFire\(walkMode \? player\.pos : cam\.pos\) \? 'camp' : 'rough'\),/);
  assert.match(dc, /restKind: \(\) => \(_fpFeet && camps\.byFire\(_fpFeet\) \? 'camp' : 'rough'\),/);
  assert.match(wm, /restKind: \(\) => \{ const p = interiorRestPlaceHere\(\); return p\.houseOwned \|\| p\.isShip \|\| !!p\.room \? 'bed' : 'rough'; \},/);
  // SURV-TIERS: the three rolls hand the rest's asks, its kind priced by the player's tier at the open (scenes/shared.js)
  assert.match(w, /restAsks: playerEntity\.isResting \? playerEntity\.restAsks : 1,/);
  assert.match(x, /restAsks: playerEntity\.isResting \? playerEntity\.restAsks : 1,/);
  assert.match(dc, /isResting: true,\s*\n\s*restAsks: playerEntity\.restAsks,/);
  const sh = read('src/scenes/shared.js');
  assert.match(sh, /restKind = \(\) => REST_KIND\.Rough, \.\.\.rest/, 'a host that says nothing sleeps rough');
  // PARTY-REST4b/10 (the party-rest drop): the override slot and the rough-carry reset both live inside this same `if (b)` arm now - narrowed to the one invariant this test holds
  // SURV-TIERS: the tier is read at the open beside the kind - null (the mod off) is DFU's bed
  assert.match(sh, /_rules = survivalRules\(\);[^\n]*\n\s*_kind = _rules \? \(_restKindOverride \?\? restKind\)\(\) : REST_KIND\.Bed; _roughHours = 0;/, 'read at the open, DFU\'s bed with the mod off');
  const law = read('src/systems/survival/rest.js');
  assert.doesNotMatch(law, /from '\.\.\/\.\.\/scenes\/|from '\.\.\/\.\.\/ui\/|from '\.\.\/\.\.\/combat\/|from '\.\.\/spellcast|from '\.\.\/diseases|from '\.\.\/effects|from '\.\.\/worldTick|document\.|window\./);
});
