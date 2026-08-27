// AUDIT 26 - THE PER-MINUTE-LOOP BATCH (F083, F107; F085 and F086
// found already fixed by parallel lanes and struck as stale instead).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tickPlayerMinutes } from '../src/systems/worldTick.js';
import { FATIGUE_LOSS } from '../src/systems/statMods.js';
import { bootstrapRegionPower } from '../src/systems/regionPower.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const rd = (p) => readFileSync(join(root, p), 'utf8');

// ---------------------------------------------------------------
// F083 - DFU's per-minute fatigue band is climbing (22), else running
// (88), else the swimming arms, else 11 (PlayerEntity.cs:405-413,
// constants :109-113). The port tested running and swimming alone and
// FATIGUE_LOSS.Climbing had zero consumers - a climber paid half the
// classic drain.
// ---------------------------------------------------------------
test('audit26 F083: a climbing minute drains 22, and climbing HEADS the band', () => {
  const drain = (activity) => {
    const drained = [];
    const entity = { level: 3, health: 50, maxHealth: 50, fatigue: 3200, magicka: 0, maxMagicka: 0, stats: {}, skills: new Array(35).fill(30), skillUses: [], items: [], activeEffects: [] };
    tickPlayerMinutes({
      entity, classicMinutes: 59.99, dt: 0.05,   // crosses the minute boundary
      sinks: { drainFatigue: (n) => drained.push(n) },
      activity, fatigueMultiplier: 1, rolls: () => 0.99,
    });
    return drained.reduce((a, b) => a + b, 0);
  };
  assert.equal(drain({ climbing: true }), FATIGUE_LOSS.Climbing, 'the climbing arm drains 22');
  assert.equal(FATIGUE_LOSS.Climbing, 22, 'ClimbingFatigueLoss (:110)');
  assert.equal(drain({ climbing: true, running: true }), FATIGUE_LOSS.Climbing,
    'climbing HEADS the band - a running climber pays the climb rate (:405-408 order)');
  assert.equal(drain({ running: true }), FATIGUE_LOSS.Running, 'running still 88 alone');
  assert.equal(drain({}), FATIGUE_LOSS.Default, 'and the resting default still 11');
});

test('audit26 F083: every activity producer reports the climb flag', () => {
  for (const [p, needle] of [
    ['src/scenes/world.js', "climbing: !!player.climb?.isClimbing,   // AUDIT 26 F083"],   // the tick bag, not the __climb probe - the probe carries the same phrase
    ['src/scenes/exterior.js', 'climbing: !!player.climb?.isClimbing'],
    ['src/scenes/worldModes.js', 'climbing: !!player.climb?.isClimbing'],
    ['src/scenes/dungeon.js', 'climbing: !!player.climb?.isClimbing'],
    ['src/scenes/dungeonContext.js', '_activity.climbing = climbing;'],
  ]) {
    assert.ok(rd(p).includes(needle), `${p} reports climbing`);
  }
});

// ---------------------------------------------------------------
// F107 - InitializeRegionData's tail (PlayerEntity.cs:2211-2217):
// TWELVE iterations of RegionPowerAndConditionsUpdate(false) AND
// (true). (The Ledger row said "twelve false then one true"; the code
// is the law - both arms, twelve times each.) Without it every
// character started on raw FACTION.TXT powers, shifting the
// merchants-vs-region term of every regional price day.
// ---------------------------------------------------------------
test('audit26 F107: the bootstrap walks both arms twelve times each', () => {
  const calls = [];
  // a store shaped like the power walk expects: dict of factions -
  // drive through a stub by observing regionPowerUpdate's effects is
  // heavy, so pin the loop itself on a spy-shaped store: an empty
  // dict makes regionPowerUpdate answer {walked:0} without touching
  // anything, and the CALL COUNT is what the bootstrap owns.
  const store = { dict: null };
  // count via a proxy store: regionPowerUpdate returns early on a
  // null dict, so wrap it - the exported bootstrap calls the module's
  // own function, so instead pin the SOURCE loop and the wiring.
  void calls; void store;
  const s = rd('src/systems/regionPower.js');
  assert.match(s, /for \(let i = 0; i < 12; i\+\+\) \{\s*\n\s*regionPowerUpdate\(store, \{ rumorMill, rolls \}\);\s*\n\s*regionPowerUpdate\(store, \{ rumorMill, rolls, updateConditions: true, regionConditions \}\);\s*\n\s*\}/,
    'twelve iterations, both arms each - PlayerEntity.cs:2211-2217 verbatim');
  const c = rd('src/systems/chargenSession.js');
  assert.equal((c.match(/bootstrapRegionPower\(playerEntity\.factionRep, \{ regionConditions: playerEntity\.regionConditions \}\)/g) ?? []).length, 2,
    'BOTH construction paths run it - the wizard\'s and the ?class= copy (the second copy is where S25\'s store went missing once already)');
});

test('audit26 F107: the bootstrap actually moves powers on a real store shape', () => {
  // a minimal two-faction dict the walk can move
  const mk = (id, power) => [id, { id, power, ally1: 0, ally2: 0, ally3: 0, enemy1: 0, enemy2: 0, enemy3: 0, region: -1, type: 2, ggroup: 0, parent: 0, children: [] }];   // type 2 = Group, inside the rumor-mill validity set
  const store = { dict: new Map([mk(201, 40), mk(202, 60)]) };
  const before = [...store.dict.values()].map((f) => f.power);
  bootstrapRegionPower(store, { rolls: () => 0.7 });
  const after = [...store.dict.values()].map((f) => f.power);
  assert.notDeepEqual(after, before, 'twenty-four walk steps move a power somewhere');
});
