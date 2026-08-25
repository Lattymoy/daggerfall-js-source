// E-slice: RANDOM ENCOUNTERS. RandomEncounters.cs +
// PlayerEntity.IntermittentEnemySpawn + the RollRandomSpawn_* rolls
// + the enemy-alert state, verbatim.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ENCOUNTER_TABLES, chooseRandomEnemy, intermittentEnemySpawn, timeForSpawn,
  rollDungeon, setEnemyAlert, decayEnemyAlert, ALERT_DECAY_MINUTES,
  MIN_DUNGEON_SPAWN_DISTANCE, MIN_LOCATION_SPAWN_DISTANCE, MIN_WILDERNESS_SPAWN_DISTANCE,
} from '../src/systems/encounters.js';
import { CLIMATES } from '../src/formats/mapsFile.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const seq = (...vals) => { let i = 0; return () => vals[Math.min(i++, vals.length - 1)]; };

test('encounters: the 45 baked tables - shapes and known rows against the C# source', () => {
  assert.equal(ENCOUNTER_TABLES.length, 45, '0-18 dungeons, 19 underwater, 20-37 climate, 38 unused, 39-44 buildings');
  for (const t of ENCOUNTER_TABLES) assert.equal(t.length, 20, 'classic lists of 20');
  // Crypt (0) opens Rat, SkeletalWarrior, GiantBat and closes VampireAncient, Lich
  assert.deepEqual(ENCOUNTER_TABLES[0].slice(0, 3), [0, 15, 3]);
  assert.deepEqual(ENCOUNTER_TABLES[0].slice(18), [30, 32]);
  // Underwater (19) is wall-to-wall Slaughterfish-family
  assert.equal(ENCOUNTER_TABLES[19][0], 11, 'Slaughterfish leads the deep');
  // the class enemies ride 128+ ids (Cemetery 18 carries Thief 138? -
  // spot the presence of any class id in the human-heavy tables)
  assert.ok(ENCOUNTER_TABLES[18].some((id) => id >= 128), 'the cemetery has human visitors');
});

test('encounters: ChooseRandomEnemy - the table pick and the level band, verbatim', () => {
  // a town by day spawns nothing
  assert.equal(chooseRandomEnemy({ climateIndex: CLIMATES.Woodlands, inLocationRect: true, isDay: true }), -1);
  // an unknown climate (ocean) spawns nothing
  assert.equal(chooseRandomEnemy({ climateIndex: CLIMATES.Ocean, inLocationRect: false, isDay: true }), -1);
  // the level band: roll <= 80 -> [level-3, level+3]; level 1 -> min<0 -> [0,5]
  // rolls: Dice100 (0.5 -> 51), then the pick (0 -> index min)
  const low = chooseRandomEnemy({ dungeonType: 0, playerLevel: 1 }, seq(0.5, 0));
  assert.equal(low, ENCOUNTER_TABLES[0][0], 'level 1, plain roll: the band floors at [0,5]');
  const lowTop = chooseRandomEnemy({ dungeonType: 0, playerLevel: 1 }, seq(0.5, 0.999));
  assert.equal(lowTop, ENCOUNTER_TABLES[0][5], 'and tops at 5');
  // a high level clamps to [14,19]
  const high = chooseRandomEnemy({ dungeonType: 0, playerLevel: 30 }, seq(0.5, 0));
  assert.equal(high, ENCOUNTER_TABLES[0][14]);
  // roll > 95 at level <= 5: [0, level+2]
  const lucky = chooseRandomEnemy({ dungeonType: 0, playerLevel: 3 }, seq(0.96, 0.999));
  assert.equal(lucky, ENCOUNTER_TABLES[0][5], 'roll 97, level 3: max = 5');
  // roll > 95 above level 5 opens the whole list
  const wild = chooseRandomEnemy({ dungeonType: 0, playerLevel: 6 }, seq(0.96, 0.999));
  assert.equal(wild, ENCOUNTER_TABLES[0][19]);
  // buildings: a guildhall reads table 40, an unknown type the default 39
  assert.equal(chooseRandomEnemy({ buildingType: 10, playerLevel: 1 }, seq(0.5, 0)), ENCOUNTER_TABLES[40][0]);
  assert.equal(chooseRandomEnemy({ buildingType: 0, playerLevel: 1 }, seq(0.5, 0)), ENCOUNTER_TABLES[39][0]);
  // underwater forces table 19
  assert.equal(chooseRandomEnemy({ underwater: true, dungeonType: 4, playerLevel: 1 }, seq(0.5, 0)), ENCOUNTER_TABLES[19][0]);
});

test('encounters: the 144-minute cadence, the rolls, and the intermittent decision', () => {
  // (minutes/12) % 12 == 0: minutes 0..11 pass, 12..143 fail, 144..155 pass
  assert.equal(timeForSpawn(0), true);
  assert.equal(timeForSpawn(11), true);
  assert.equal(timeForSpawn(12), false);
  assert.equal(timeForSpawn(143), false);
  assert.equal(timeForSpawn(144), true);
  assert.equal(timeForSpawn(72), false, 'half the period is NOT a window - the modulus is 12, not 6');
  assert.equal(timeForSpawn(1728), true, 'the 12th window');
  // the dungeon roll is DEAD without the alert (returns 1, never 0)
  assert.equal(rollDungeon(false, 0), 1, 'no alert: never spawns');
  assert.equal(rollDungeon(true, 0), 0, 'alert + a 0 roll spawns');
  // the dungeon rest decision end to end
  const hit = intermittentEnemySpawn({
    gameMinutes: 144, inside: true, inDungeon: true, isResting: true,
    enemyAlertActive: true, dungeonType: 0, playerLevel: 1,
  }, seq(0, 0.5, 0));
  assert.ok(hit, 'the window + the roll spawn');
  assert.equal(hit.minDistance, MIN_DUNGEON_SPAWN_DISTANCE);
  assert.equal(hit.mobileType, ENCOUNTER_TABLES[0][0]);
  // not resting: nothing, whatever the rolls
  assert.equal(intermittentEnemySpawn({
    gameMinutes: 144, inside: true, inDungeon: true, isResting: false,
    enemyAlertActive: true, dungeonType: 0, playerLevel: 1,
  }, () => 0), null);
  // outside: a town at night rolls 1/24 at distance 10; by day nothing
  const night = intermittentEnemySpawn({
    gameMinutes: 1440 + 144, inside: false, inLocationRect: true,
    climateIndex: CLIMATES.Woodlands, playerLevel: 1,
  }, seq(0, 0.5, 0));
  assert.ok(night && night.minDistance === MIN_LOCATION_SPAWN_DISTANCE);
  const noon = intermittentEnemySpawn({
    gameMinutes: 1440 + 720, inside: false, inLocationRect: true,
    climateIndex: CLIMATES.Woodlands, playerLevel: 1,
  }, () => 0);
  assert.equal(noon, null, '720 is midday; towns spawn at night only');
  // the wilderness day window is 360..1080 inclusive at 1/36
  const wild = intermittentEnemySpawn({
    gameMinutes: 1440 + 720, inside: false, inLocationRect: false,
    climateIndex: CLIMATES.Woodlands, playerLevel: 1,
  }, seq(0, 0.5, 0));
  assert.ok(wild && wild.minDistance === MIN_WILDERNESS_SPAWN_DISTANCE);
});

test('encounters: the enemy alert - raise stamps the time, the 8-hour decay clears', () => {
  const e = {};
  setEnemyAlert(e, true, 1000);
  assert.equal(e.enemyAlertActive, true);
  assert.equal(e.lastEnemyAlertTime, 1000);
  decayEnemyAlert(e, 1000 + ALERT_DECAY_MINUTES);
  assert.equal(e.enemyAlertActive, true, 'exactly 8h: not yet (the C# compares with >)');
  decayEnemyAlert(e, 1000 + ALERT_DECAY_MINUTES + 1);
  assert.equal(e.enemyAlertActive, false, 'past 8h: cleared');
  assert.equal(ALERT_DECAY_MINUTES, 480);
});

test('encounters: the dungeon host arm - the rest loop, the sight raise, the kill clear, the closed leg', () => {
  const src = readFileSync(join(root, 'src/scenes/dungeonContext.js'), 'utf8');
  const i = src.indexOf('const _restAdvance = (n) => {');
  // The window ends at the NEXT rest dep, not at a character count: wave 30
  // grew this arm by thirty lines and a fixed 900-char slice stopped reaching
  // the spawn loop, so the pin failed for the one reason a pin must not -
  // the code moved, not changed.
  // S40 pulled the OTHER five rest deps out to shared.js' one
  // composition, so the window ends at this function's own close.
  const fn = src.slice(i, src.indexOf('\n  };', i));
  assert.ok(i > 0 && fn.length > 200 && fn.length < 3000, 'the rest advance arm was found whole');
  assert.ok(fn.includes('intermittentEnemySpawn({'), 'the rest advance runs the catch-up loop');
  assert.ok(fn.includes('enemyAlertActive: !!playerEntity.enemyAlertActive'), 'gated on the alert');
  assert.ok(fn.includes('_spawnEncounter(hit); break;'), 'one spawn per advance, as the C# break');
  assert.ok(src.includes('if (f.ai.inSight && f.ai.detected && !f.dead) setEnemyAlert(playerEntity, true'), 'sight raises');
  assert.ok(src.includes("if (foe.ai?.detected) setEnemyAlert(playerEntity, false)"), 'the targeting kill clears');
  // S40 moved the rest OPEN GATE to systems/restSession.js - DFU raises
  // it from one scene-free handler and three more hosts can rest now -
  // so this pin follows it: the gate must still say `alert` on the
  // enemies arm, and this host must still act on it. Pinned in BOTH
  // places, because a gate that reports the alert and a host that
  // ignores it is the same closed leg reopening.
  // MERGED: the gate is `restDecision` and answers a KIND rather than
  // an `alert` flag - the enemies arm IS the alert arm, which is
  // tighter than a boolean beside it.
  const rest = readFileSync(join(root, 'src/systems/restSession.js'), 'utf8');
  assert.ok(rest.includes("if (enemiesNearby) return { kind: 'enemies', textId: REST_TEXT.enemiesNearby };"),
    'the open gate refuses on enemies, and that arm is the alert arm');
  assert.ok(src.includes("if (d.kind === 'enemies') setEnemyAlert(playerEntity, true, classicMinutesRef.value);"),
    'the rest refusal raises (the old routed leg closed)');
  // ...and so do the hosts the rest lanes gave rest to.
  for (const f of ['src/scenes/world.js', 'src/scenes/exterior.js']) {
    const h = readFileSync(join(root, f), 'utf8');
    assert.ok(h.includes("if (d.kind === 'enemies') setEnemyAlert(playerEntity, true, Math.floor(worldMinutes()));"), f);
  }
  // AUDIT 24 (wave 36): the 8-hour decay MOVED. PlayerEntity.Update
  // :380-384 runs it in every context, and the dungeon frame body was
  // its only caller - so an alert raised above ground (exteriorFoes has
  // raised one since the X-slice) never decayed and permanently armed
  // this very roll. It lives in createPlayerTicker now, which every
  // host already calls, and the dungeon's own call is gone so it
  // cannot tick twice.
  assert.equal(src.includes('decayEnemyAlert('), false, 'the dungeon no longer decays it itself');
  const shared = readFileSync(join(root, 'src/scenes/shared.js'), 'utf8');
  assert.ok(shared.includes('decayEnemyAlert(entity, r.classicMinutes);'), 'the entity tick does, for every host');
  assert.ok(src.includes('await buildFoeAt({ mobileType, gender'), 'the spawner mints through the load chain');
});
