import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createBankAccounts, EMPIRE_ACCOUNT_REGION, goldRegion,
  isUnifiedBankActive, depositGold, withdrawGold, accountTotal,
} from '../../src/systems/banking.js';
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
