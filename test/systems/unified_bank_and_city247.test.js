import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createBankAccounts, EMPIRE_ACCOUNT_REGION, goldRegion,
  isUnifiedBankActive, depositGold, withdrawGold, accountTotal,
  foldEmpireAccounts, unfoldEmpireAccounts, syncUnifiedBankAccounts,
} from '../../src/systems/banking.js';
import { playerEntity } from '../../src/characters/playerEntity.js';
import { snapshotPlayer, restorePlayer } from '../../src/systems/save/save.js';
import {
  isCity247Active, isBuildingOpen, buildingHoursState, SHOP_STAFFING,
} from '../../src/systems/buildingLocks.js';
import { BUILDING_TYPES } from '../../src/world/buildingNames.js';
import { makeCityGate, updateCityGate } from '../../src/world/city/cityGate.js';
import { CITY_GATE_OPEN_MODEL_ID, CITY_GATE_CLOSED_MODEL_ID } from '../../src/world/rmbLayout.js';
import { setPref, getPref } from '../../src/systems/uiPrefs.js';

test('UNIFIED-BANK: offline pref toggles between regional and Empire-wide unified banking', () => {
  const accounts = createBankAccounts();
  const r = 5; // Daggerfall is 17

  setPref('unifiedBank', false);
  assert.equal(isUnifiedBankActive(), false);
  assert.equal(goldRegion(accounts, r), r, 'regional bank when unifiedBank is false');

  setPref('unifiedBank', true);
  assert.equal(isUnifiedBankActive(), true);
  assert.equal(goldRegion(accounts, r), EMPIRE_ACCOUNT_REGION, 'Empire account 17 when unifiedBank is true');

  // Test deposit into branch r goes into Empire account
  const player = {
    gold: () => 1000,
    deductGold: (n) => { player.goldPieces -= n; return 0; },
    addGold: (n) => { player.goldPieces += n; },
    goldPieces: 1000,
    carriedWeightKg: () => 10,
    maxEncumbranceKg: () => 100,
  };

  depositGold(accounts, r, 500, player);
  assert.equal(accountTotal(accounts, EMPIRE_ACCOUNT_REGION), 500);
  assert.equal(accountTotal(accounts, r), 0);

  // Test withdrawal from another branch 20 withdraws from Empire account
  withdrawGold(accounts, 20, 200, player);
  assert.equal(accountTotal(accounts, EMPIRE_ACCOUNT_REGION), 300);

  // Clean up
  setPref('unifiedBank', false);
});

test('CITY-247: optional 24/7 city infrastructure toggle keeps service buildings open around the clock', () => {
  setPref('city247', false);
  assert.equal(isCity247Active(), false);

  // At 23:00 (11 PM), Alchemist and Bank are normally closed offline
  const closedAlchemist = buildingHoursState(BUILDING_TYPES.Alchemist, { hour: 23 });
  assert.equal(closedAlchemist.open, false);
  assert.equal(isBuildingOpen(BUILDING_TYPES.Alchemist, 23), false);

  const closedBank = buildingHoursState(BUILDING_TYPES.Bank, { hour: 23 });
  assert.equal(closedBank.open, false);
  assert.equal(isBuildingOpen(BUILDING_TYPES.Bank, 23), false);

  // Enable 24/7 city infrastructure
  setPref('city247', true);
  assert.equal(isCity247Active(), true);

  const openAlchemist = buildingHoursState(BUILDING_TYPES.Alchemist, { hour: 23 });
  assert.equal(openAlchemist.open, true);
  assert.equal(openAlchemist.staffing, SHOP_STAFFING.ONLINE_SHIFT);
  assert.equal(isBuildingOpen(BUILDING_TYPES.Alchemist, 23), true);

  const openBank = buildingHoursState(BUILDING_TYPES.Bank, { hour: 23 });
  assert.equal(openBank.open, true);
  assert.equal(openBank.staffing, SHOP_STAFFING.ONLINE_SHIFT);
  assert.equal(isBuildingOpen(BUILDING_TYPES.Bank, 23), true);

  const openGuild = buildingHoursState(BUILDING_TYPES.GuildHall, { hour: 3 });
  assert.equal(openGuild.open, true);
  assert.equal(openGuild.staffing, SHOP_STAFFING.ONLINE_SHIFT);
  assert.equal(isBuildingOpen(BUILDING_TYPES.GuildHall, 3), true);

  // Clean up
  setPref('city247', false);
});

test('CITY-247: city gate remains open at night when 24/7 city infrastructure is active', () => {
  setPref('city247', false);
  const gate = makeCityGate(CITY_GATE_OPEN_MODEL_ID);

  // Night falls: gate toggles to closed
  const toggledClosed = updateCityGate(gate, true);
  assert.equal(toggledClosed, true);
  assert.equal(gate.isOpen, false);
  assert.equal(gate.modelId, CITY_GATE_CLOSED_MODEL_ID);

  // Enable 24/7 city infrastructure: gate forces open
  setPref('city247', true);
  const toggledOpen = updateCityGate(gate, true);
  assert.equal(toggledOpen, true);
  assert.equal(gate.isOpen, true);
  assert.equal(gate.modelId, CITY_GATE_OPEN_MODEL_ID);

  // Subsequent ticks at night keep gate open
  assert.equal(updateCityGate(gate, true), false);
  assert.equal(gate.isOpen, true);
  assert.equal(gate.modelId, CITY_GATE_OPEN_MODEL_ID);

  // Clean up
  setPref('city247', false);
});

test('UNIFIED-BANK: fold, unfold and proportional gold redistribution on toggle', () => {
  const E = EMPIRE_ACCOUNT_REGION;
  const accounts = createBankAccounts();
  accounts[5].accountGold = 5000;
  accounts[E].accountGold = 2000;
  accounts[20].accountGold = 3000;

  const snap = { bankAccounts: accounts };
  const folded = foldEmpireAccounts(snap);
  assert.deepEqual(folded, { gold: 8000, branches: 2 });
  assert.equal(snap.bankAccounts[E].accountGold, 10000);
  assert.equal(snap.bankAccounts[5].accountGold, 0);
  assert.equal(snap.bankAccounts[20].accountGold, 0);
  assert.deepEqual(snap.bankUnifiedSplit, { [E]: 2000, 5: 5000, 20: 3000 });

  // Unfold without gold changes: exactly original balances are restored
  const unfolded = unfoldEmpireAccounts(snap);
  assert.equal(unfolded.branches, 2);
  assert.equal(snap.bankAccounts[5].accountGold, 5000);
  assert.equal(snap.bankAccounts[E].accountGold, 2000);
  assert.equal(snap.bankAccounts[20].accountGold, 3000);
  assert.equal(snap.bankUnifiedSplit, undefined);

  // Fold again, then withdraw 4000 gold from unified account
  foldEmpireAccounts(snap);
  assert.equal(snap.bankAccounts[E].accountGold, 10000);
  snap.bankAccounts[E].accountGold -= 4000; // 6000 remains (ratio 0.6)

  // Unfold with less gold: proportional distribution, zero coins created or lost
  unfoldEmpireAccounts(snap);
  assert.equal(snap.bankAccounts[5].accountGold, 3000); // 5000 * 0.6
  assert.equal(snap.bankAccounts[20].accountGold, 1800); // 3000 * 0.6
  assert.equal(snap.bankAccounts[E].accountGold, 1200);  // 6000 - 3000 - 1800
  const totalRemaining = snap.bankAccounts.reduce((s, a) => s + a.accountGold, 0);
  assert.equal(totalRemaining, 6000);

  // Fold again, then deposit 9000 gold into unified account (total 15000)
  foldEmpireAccounts(snap);
  assert.equal(snap.bankAccounts[E].accountGold, 6000);
  snap.bankAccounts[E].accountGold += 9000; // 15000 total

  // Unfold with surplus: original regional amounts restored, surplus stays in Empire capital
  unfoldEmpireAccounts(snap);
  assert.equal(snap.bankAccounts[5].accountGold, 3000);
  assert.equal(snap.bankAccounts[20].accountGold, 1800);
  assert.equal(snap.bankAccounts[E].accountGold, 15000 - 3000 - 1800); // 10200
  const totalWithSurplus = snap.bankAccounts.reduce((s, a) => s + a.accountGold, 0);
  assert.equal(totalWithSurplus, 15000);
});

test('UNIFIED-BANK: setPref mid-game synchronizes playerEntity bank accounts and persists in save/restore', () => {
  const E = EMPIRE_ACCOUNT_REGION;
  playerEntity.bankAccounts = createBankAccounts();
  playerEntity.bankAccounts[5].accountGold = 4000;
  playerEntity.bankAccounts[E].accountGold = 1000;
  playerEntity.bankAccounts[30].accountGold = 5000;
  delete playerEntity.bankUnifiedSplit;

  setPref('unifiedBank', false);

  // Toggle ON in settings mid-game
  setPref('unifiedBank', true);
  assert.equal(playerEntity.bankAccounts[E].accountGold, 10000);
  assert.equal(playerEntity.bankAccounts[5].accountGold, 0);
  assert.equal(playerEntity.bankAccounts[30].accountGold, 0);
  assert.ok(playerEntity.bankUnifiedSplit);

  // Save character snapshot
  const snap = snapshotPlayer(playerEntity);
  assert.equal(snap.bankAccounts[E].accountGold, 10000);
  assert.deepEqual(snap.bankUnifiedSplit, { [E]: 1000, 5: 4000, 30: 5000 });

  // Toggle OFF in settings while game is running
  setPref('unifiedBank', false);
  assert.equal(playerEntity.bankAccounts[5].accountGold, 4000);
  assert.equal(playerEntity.bankAccounts[E].accountGold, 1000);
  assert.equal(playerEntity.bankAccounts[30].accountGold, 5000);
  assert.equal(playerEntity.bankUnifiedSplit, undefined);

  // Restore player while setting is OFF: accounts restored to regional form
  const restoredEntity = { isPlayer: true, race: 'Breton', items: [] };
  restorePlayer(restoredEntity, snap);
  assert.equal(restoredEntity.bankAccounts[5].accountGold, 4000);
  assert.equal(restoredEntity.bankAccounts[E].accountGold, 1000);
  assert.equal(restoredEntity.bankAccounts[30].accountGold, 5000);

  // Restore player while setting is ON: accounts remain unified in Empire account
  setPref('unifiedBank', true);
  const restoredUnified = { isPlayer: true, race: 'Breton', items: [] };
  restorePlayer(restoredUnified, snap);
  assert.equal(restoredUnified.bankAccounts[E].accountGold, 10000);
  assert.equal(restoredUnified.bankAccounts[5].accountGold, 0);
  assert.equal(restoredUnified.bankAccounts[30].accountGold, 0);

  // Clean up
  setPref('unifiedBank', false);
});
