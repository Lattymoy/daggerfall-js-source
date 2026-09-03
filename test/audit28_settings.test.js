import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { setValue, resetToDefaults, LIVE, tierOf } from '../src/systems/settings.js';
import { RumorMill } from '../src/systems/rumorMill.js';
import { sayEnemyDied } from '../src/scenes/corpseMarker.js';
import { dungeonAmbientFor, DUNGEON_AMBIENT, CASTLE_AMBIENT, SPECIAL_AREA_AMBIENT } from '../src/world/dungeonLights.js';

// AUDIT 28 - WAVE 1: SETTINGS DFU READS THAT THE PORT ANSWERED WITH THE
// DEFAULT (2026-08-30).
//
// The sweep: every key in settings.js tiered `stored` has, in DFU, a
// consumer; for each, does the port's consumer READ it? Four modules
// quoted the setting in their own header comment and then hard-coded
// its default: the rumor weight (TalkManager :1452), the kill notice
// gate (EnemyDeath :82), the plain-dungeon ambient scale
// (PlayerAmbientLight :89) and the night ambient scale (:123). Every
// slider moved and nothing changed. These pins hold the read at the
// DFU site, the range DFU's getter clamps to, and the tier that says
// so on the settings screen.

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');

test('AUDIT 28 W1: the four keys are LIVE, at the module that reads them', () => {
  assert.equal(LIVE['GUI/QuestRumorWeight'], 'src/systems/rumorMill.js');
  assert.equal(LIVE['GUI/DisableEnemyDeathAlert'], 'src/scenes/corpseMarker.js');
  assert.equal(LIVE['Enhancements/DungeonAmbientLightScale'], 'src/world/dungeonLights.js');
  assert.equal(LIVE['Enhancements/NightAmbientLightScale'], 'src/scenes/world.js');
  for (const k of Object.keys(LIVE)) assert.equal(tierOf(k), 'live', k);
});

test('AUDIT 28 W1: QuestRumorWeight - WeightedRandomRumor reads the setting, clamped 1..100 as SettingsManager :512', () => {
  resetToDefaults();
  const mill = new RumorMill({ rolls: () => 0 });
  // With rolls at 0, r = 0 >= totalWeight only for the FIRST entry, so
  // the pick is deterministic; what the setting changes is the WEIGHT
  // that totalWeight accumulates, observable through the second draw.
  // Drive it directly: a quest rumor at weight W and an ambient at 1.
  const entries = [{ questID: 0, text: 'ambient' }, { questID: 7, text: 'quest' }];
  const weightOf = () => {
    let last = null;
    mill._range = (n) => { last = n; return 0; };
    mill.weightedRandomRumor(entries);
    return last;   // totalWeight + weight on the LAST step = 1 + questWeight
  };
  assert.equal(weightOf(), 1 + 50, 'the default is 50');
  setValue('GUI', 'QuestRumorWeight', 5);
  assert.equal(weightOf(), 1 + 5, 'the setting is not read');
  setValue('GUI', 'QuestRumorWeight', 999);
  assert.equal(weightOf(), 1 + 100, 'GetInt clamps to 100');
  setValue('GUI', 'QuestRumorWeight', 0);
  assert.equal(weightOf(), 1 + 1, 'GetInt clamps to 1');
  resetToDefaults();
  // The test seam still wins when a test supplies it.
  const seamed = new RumorMill({ rolls: () => 0, questRumorWeight: 3 });
  let n = null; seamed._range = (v) => { n = v; return 0; }; seamed.weightedRandomRumor(entries);
  assert.equal(n, 4);
});

test('AUDIT 28 W1: DisableEnemyDeathAlert - the kill notice is silent when the setting says so (EnemyDeath :82)', () => {
  resetToDefaults();
  const said = [];
  sayEnemyDied((l) => said.push(l), 0);   // Rat
  assert.equal(said.length, 1, 'the default speaks');
  setValue('GUI', 'DisableEnemyDeathAlert', true);
  assert.equal(sayEnemyDied((l) => said.push(l), 0), null);
  assert.equal(said.length, 1, 'the notice spoke through the gate');
  resetToDefaults();
});

test('AUDIT 28 W1: DungeonAmbientLightScale scales the PLAIN arm only, 0..1 (PlayerAmbientLight :82-90)', () => {
  resetToDefaults();
  assert.deepEqual([...dungeonAmbientFor({})], [...DUNGEON_AMBIENT]);
  setValue('Enhancements', 'DungeonAmbientLightScale', 0.5);
  assert.deepEqual([...dungeonAmbientFor({})].map((v) => +v.toFixed(6)), [...DUNGEON_AMBIENT].map((v) => +(v * 0.5).toFixed(6)));
  assert.equal(dungeonAmbientFor({ inCastle: true }), CASTLE_AMBIENT, 'the castle arm is not scaled');
  assert.equal(dungeonAmbientFor({ inSpecialArea: true }), SPECIAL_AREA_AMBIENT, 'the special-area arm is not scaled');
  setValue('Enhancements', 'DungeonAmbientLightScale', 4);
  assert.deepEqual([...dungeonAmbientFor({})], [...DUNGEON_AMBIENT], 'GetFloat clamps to 1');
  resetToDefaults();
});

test('AUDIT 28 W1: NightAmbientLightScale reaches exteriorAmbient in BOTH exterior hosts, 0..1', () => {
  for (const host of ['src/scenes/exterior.js', 'src/scenes/world.js']) {
    const h = read(host);
    assert.equal((h.match(/exteriorAmbient\(minute, /g) || []).length, 1, `${host}: one exterior ambient call`);
    assert.match(h, /exteriorAmbient\(minute, getFloat\('Enhancements', 'NightAmbientLightScale', 0, 1\), wxNow\.sun\)/,   // WX2: the weather scale rides the front
      `${host}: the night scale is not read`);
  }
});

test('AUDIT 28 W1: the settings this wave found are the ones whose consumer names them and never read them', () => {
  // A regression guard for the SHAPE of the finding: a module that
  // names a Settings key in a comment must also read it (or record why
  // not, as playerTorch.js does for PlayerTorchLightScale). The sweep
  // walks the consumers this wave touched.
  for (const [file, key, reader] of [
    ['src/systems/rumorMill.js', 'QuestRumorWeight', /getInt\('GUI', 'QuestRumorWeight', 1, 100\)/],
    ['src/scenes/corpseMarker.js', 'DisableEnemyDeathAlert', /getBool\('GUI', 'DisableEnemyDeathAlert'\)/],
    ['src/world/dungeonLights.js', 'DungeonAmbientLightScale', /getFloat\('Enhancements', 'DungeonAmbientLightScale', 0, 1\)/],
  ]) {
    const s = read(file);
    assert.match(s, new RegExp(key), `${file} no longer names ${key}`);
    assert.match(s, reader, `${file} names ${key} and does not read it`);
  }
});
