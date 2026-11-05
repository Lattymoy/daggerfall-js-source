import '../modsOff.js';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  isOfflineFirmamentActive,
  createOfflineFirmamentBook,
  initOfflineRenown,
  onOfflineFoeKilled,
  onOfflineQuestEnded,
  offlineKillXp,
  offlineQuestXp,
  OFFLINE_RENOWN_BOOST,
  _resetOfflineFirmamentForTests,
} from '../../src/systems/offlineFirmament.js';

import {
  FIRM_RESPEC_GOLD,
  starsFor,
  pathTo,
} from '../../src/net/firmament/firmamentLaw.js';

import {
  setFirmamentTree,
  setFirmamentOnline,
  setFirmamentOffline,
  isFirmamentOffline,
  firmamentInForce,
  firmamentStatus,
  _resetFirmamentLiveForTests,
} from '../../src/systems/firmamentLive.js';

beforeEach(() => {
  _resetFirmamentLiveForTests();
  _resetOfflineFirmamentForTests();
});

test('offline firmament: preference and flag activation', () => {
  // Flag is true in forkFlags. By default uiPrefs returns true unless disabled.
  const active = isOfflineFirmamentActive();
  assert.equal(typeof active, 'boolean');
});

test('offline firmament: firmamentLive responds to offline state', () => {
  assert.equal(firmamentInForce(), false);
  assert.equal(isFirmamentOffline(), false);

  const warriorTree = { start: 'wr.start', keys: ['wr.s1'] };
  setFirmamentTree(warriorTree);

  // With tree set but neither online nor offline active:
  assert.equal(firmamentInForce(), false);
  assert.equal(firmamentStatus({ read: true, dueling: false }), 'seat');

  // Set offline active:
  setFirmamentOffline(true);
  assert.equal(isFirmamentOffline(), true);
  assert.equal(firmamentInForce(), true);
  assert.equal(firmamentStatus({ read: true, dueling: false }), 'active');

  // Turn offline off:
  setFirmamentOffline(false);
  assert.equal(isFirmamentOffline(), false);
  assert.equal(firmamentInForce(), false);
});

test('offline firmament: XP calculations and offline multiplier', () => {
  assert.equal(OFFLINE_RENOWN_BOOST, 1.5);

  // Kill XP scaled by foe level and 1.5x boost
  const xpLow = offlineKillXp(2, 1);
  const xpHigher = offlineKillXp(10, 1);
  assert.ok(xpLow > 0);
  assert.ok(xpHigher > xpLow, 'higher level foe yields more renown');

  // Quest XP
  const questXp = offlineQuestXp(5, 1);
  assert.ok(questXp > 0);
});

test('offline firmament: stars per renown level', () => {
  assert.equal(starsFor(1), 0);
  assert.equal(starsFor(2), 2);
  assert.equal(starsFor(5), 8);
  assert.equal(starsFor(10), 18);
});

test('offline firmament: offline book creation, star allocation, respec, and events', async () => {
  let gold = 20_000;
  const fakeEntity = {
    characterId: 'test_hero_' + Date.now(),
    name: 'Grom',
  };
  const fakeWallet = () => ({
    gold: () => gold,
    pay: (cost) => { gold -= cost; },
  });

  const book = createOfflineFirmamentBook({ entity: fakeEntity, wallet: fakeWallet });
  assert.ok(book);
  assert.ok(book.state);

  const readOk = await book.read();
  assert.equal(readOk, true);
  assert.equal(book.state.open, true);
  assert.equal(book.state.renown, 1);

  let changeNotified = false;
  book.onChange((st) => {
    changeNotified = true;
  });

  // Start with warrior sign
  const commitRes = await book.commit({ start: 'wr.start', keys: [] });
  assert.equal(commitRes.ok, true);
  assert.ok(changeNotified);
  assert.equal(book.state.tree.start, 'wr.start');

  // Respec
  const respecRes = await book.respec();
  assert.equal(respecRes.ok, true);
  assert.equal(book.state.tree.start, null);
  assert.equal(book.state.tree.keys.length, 0);
  assert.equal(gold, 10_000, 'respec deducted 10,000 gold');
});
