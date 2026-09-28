// SEA-CAP (2026-09-26, SquidKamer on the Discord: "puddle no more is too aggressive ... I jumped in last night and it
// summoned an army of everything"; Mac, asked: "Yes, cap at 32"). Iliac Puddle No More's pulse fills every sea pixel
// within 200 m of an outdoor player from nothing to its cap in about two seconds - on a shore or a ship's deck as much
// as in the water - each foe made hostile and told where the player is. The mod ships the cap at 128; the port's
// default is 32, and the room forces the same online. The rules are the mod's, and so is the range: a player offline
// may still raise it to 256. What the spawner reads is the setting (scenes/deepWatersHost.js deepWatersEnemySettings).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { MOD_SETTINGS, setModSetting, _resetModSettings } from '../src/systems/modSettings.js';
import { ONLINE_ROOM_MOD_KEYS, onlineForcedModSetting } from '../src/systems/onlineLane.js';
import { deepWatersEnemySettings } from '../src/scenes/deepWatersHost.js';

const V = 'iliac-puddle-no-more', K = 'General.MaxLiveEnemies';

test('SEA-CAP: the port stands at most 32 of the deep\'s foes by default - the mod ships 128, and its range stays', () => {
  const shipped = JSON.parse(readFileSync(new URL(`../vendor/${V}/modsettings.json`, import.meta.url), 'utf8'))
    .Sections.find((s) => s.Name === 'General').Keys.find((k) => k.Name === 'MaxLiveEnemies');
  assert.equal(shipped.Value, 128, 'the mod\'s own value, recorded as the departure\'s other side');
  const def = MOD_SETTINGS[V].keys[K];
  assert.equal(def.default, 32);
  assert.equal(def.min, shipped.Min ?? 0);
  assert.equal(def.max, shipped.Max, 'a player may still ask the mod\'s whole range');
  _resetModSettings();
  try {
    assert.equal(deepWatersEnemySettings().maxLive, 32, 'the spawner\'s cap is the setting');
    setModSetting(V, K, 200);
    assert.equal(deepWatersEnemySettings().maxLive, 200, 'offline, raised by hand, it is raised');
  } finally { _resetModSettings(); }
});

test('SEA-CAP: online the room forces 32 - every client stands its own deep, so the room\'s floor is the port\'s default', () => {
  assert.equal(ONLINE_ROOM_MOD_KEYS[V][K], 32);
  assert.equal(onlineForcedModSetting(V, K, '?online=1'), 32);
  assert.equal(onlineForcedModSetting(V, K, ''), undefined, 'offline nothing is forced');
});
