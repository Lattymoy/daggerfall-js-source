import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  OFFLINE_RESPAWN_HOURS_MIN,
  OFFLINE_RESPAWN_HOURS_MAX,
  rollOfflineRespawnHours,
  timePassedText,
  offlineRespawnOn,
} from '../../src/systems/deathRespawn.js';
import { getPref, setPref } from '../../src/systems/uiPrefs.js';
import { DeathScreen } from '../../src/ui/deathScreen.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (p) => readFileSync(join(root, p), 'utf8');

test('offline-respawn: hours roll bounds and formatting', () => {
  assert.equal(OFFLINE_RESPAWN_HOURS_MIN, 4);
  assert.equal(OFFLINE_RESPAWN_HOURS_MAX, 24);

  for (let i = 0; i < 200; i++) {
    const hours = rollOfflineRespawnHours();
    assert.ok(Number.isInteger(hours), 'rolled hours must be an integer');
    assert.ok(hours >= 4 && hours <= 24, `hours ${hours} must be within [4, 24]`);
  }

  const oneHour = timePassedText(1);
  assert.ok(oneHour.includes('1'), 'must contain count 1');
  assert.ok(oneHour.includes('hour'), 'must format single hour');

  const multipleHours = timePassedText(12);
  assert.ok(multipleHours.includes('12'), 'must contain count 12');
  assert.ok(multipleHours.includes('hours'), 'must format multiple hours');
});

test('offline-respawn: preference toggle and default', () => {
  // Initial / default should be enabled
  assert.equal(offlineRespawnOn(), true, 'offline respawn is enabled by default');

  setPref('offlineRespawn', false);
  assert.equal(offlineRespawnOn(), false, 'offline respawn can be disabled');

  setPref('offlineRespawn', true);
  assert.equal(offlineRespawnOn(), true, 'offline respawn can be re-enabled');
});

test('offline-respawn: DeathScreen offline behavior with offlineRespawn enabled', () => {
  const entityWithGold = { goldPieces: 1000 };

  let resetTriggered = false;
  // Offline game with offlineRespawn enabled
  const dsOfflineOn = new DeathScreen({
    online: false,
    offlineRespawn: true,
    entity: entityWithGold,
    onReset: () => { resetTriggered = true; },
  });

  assert.equal(dsOfflineOn.offlineRespawn, true);
  assert.equal(dsOfflineOn.online, false);
  assert.equal(dsOfflineOn.goldLoss, 100, 'loses 10% of gold');
  assert.equal(typeof dsOfflineOn.respawnIn, 'number', 'countdown must be active');
  assert.equal(dsOfflineOn.respawnIn, 10, 'defaults to auto-rise countdown (10s)');
  assert.equal(dsOfflineOn.canRise, true, 'can rise with ENTER now');

  // Input confirm triggers reset immediately
  dsOfflineOn.input('confirm');
  assert.equal(resetTriggered, true, 'ENTER confirm triggers reset');

  // Offline game with offlineRespawn disabled (classic)
  const dsOfflineOff = new DeathScreen({
    online: false,
    offlineRespawn: false,
    entity: entityWithGold,
  });

  assert.equal(dsOfflineOff.offlineRespawn, false);
  assert.equal(dsOfflineOff.respawnIn, null, 'no countdown in classic mode');
  assert.equal(dsOfflineOff.goldLoss, 0, 'no gold penalty in classic mode');
});

test('offline-respawn: world.js integrates offline respawn with time advancement and quiet autosave', () => {
  const src = read('src/scenes/world.js');

  // Verify presenter wiring
  assert.match(
    src,
    /offlineRespawn:\s*offlineRespawnOn\(\)/,
    'world.js passes offlineRespawnOn() to death presenter'
  );

  // Verify onReset handles offlineRespawnOn()
  assert.match(
    src,
    /_deathWasOnline\s*\|\|\s*offlineRespawnOn\(\)/,
    'world.js triggers respawn on reset when offline respawn is enabled'
  );

  // Verify time advance in respawnOnlinePlayer
  assert.match(
    src,
    /rollOfflineRespawnHours\(\)/,
    'world.js rolls offline respawn hours'
  );
  assert.match(
    src,
    /playerTicker\.advance\(hoursPassed\s*\*\s*60\)/,
    'world.js advances time by rolled hours'
  );

  // Verify quiet autosave
  assert.match(
    src,
    /worldQuickSave\?\.\(['"]AutoSave['"],\s*\{\s*quiet:\s*true\s*\}\)/,
    'world.js triggers quiet AutoSave on respawn'
  );
});
