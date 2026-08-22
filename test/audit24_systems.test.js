// AUDIT 24 (the full-codebase parity sweep), systems group.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { snapshotPlayer, restorePlayer } from '../src/systems/save.js';
import { isForbiddenEquip } from '../src/systems/equip.js';
import { LEGAL_REP_MIN, LEGAL_REP_MAX } from '../src/systems/court.js';

test('audit24 systems: the legal-rep clamp runs AFTER the restore, not before it', () => {
  // SaveLoadManager.cs:1545 calls ClampLegalReputations at the very end
  // of RestoreSaveData - long after SerializablePlayer.cs:343-347 has
  // written RegionData (which carries LegalRep). The port clamped
  // first and then overwrote the map with the raw snapshot, so the
  // clamp could never pin anything: it was dead code standing over a
  // comment that claimed otherwise.
  const live = { items: [], stats: {}, skills: 30 };
  live.legalRep = { 17: -180, 3: 240, 9: -40 };
  const snap = JSON.parse(JSON.stringify(snapshotPlayer(live, {})));
  assert.equal(snap.legalRep['17'], -180, 'the SAVE keeps the raw value (DFU clamps on load)');
  const fresh = { items: [], stats: {} };
  restorePlayer(fresh, snap);
  assert.equal(fresh.legalRep['17'], LEGAL_REP_MIN, 'a beyond-band value loads back INTO the band');
  assert.equal(fresh.legalRep['3'], LEGAL_REP_MAX);
  assert.equal(fresh.legalRep['9'], -40, 'and an in-band value is untouched');
});

test('audit24 systems: a shield falls through to the forbidden-MATERIAL arm', () => {
  // DaggerfallInventoryWindow.cs:1345-1359 is a three-arm chain. Arm 1
  // is the shield-TYPE test and arm 2 the armor-TYPE test (guarded
  // `!item.IsShield`), but arm 3 - the plate-material test - has NO
  // shield guard, so a shield whose type bit is clear still meets it.
  const DAEDRIC = 0x0209;   // plate high byte 2, material index 9
  const IRON = 0x0200;
  const career = (shields, materials) => ({
    weaponArmorShieldsBitfield: (shields & 0x0f) << 9,
    forbiddenMaterialsFlags: materials,
  });
  const towerShield = (material) => ({ group: 'Armor', templateIndex: 112, material });
  const buckler = (material) => ({ group: 'Armor', templateIndex: 109, material });
  const noForbidden = career(0, 0);
  assert.equal(isForbiddenEquip(noForbidden, towerShield(DAEDRIC)), false, 'nothing forbidden, nothing refused');
  // the type bit clear, the MATERIAL bit set: DFU refuses (message 1068)
  const noDaedric = career(0, 1 << 9);
  assert.equal(isForbiddenEquip(noDaedric, towerShield(DAEDRIC)), true,
    'a Daedric tower shield meets arm 3 even though arm 1 passed it');
  assert.equal(isForbiddenEquip(noDaedric, buckler(DAEDRIC)), true, 'and so does a Daedric buckler');
  assert.equal(isForbiddenEquip(noDaedric, towerShield(IRON)), false, 'an iron one is fine');
  // the type bit alone still refuses, material or not (arm 1)
  const noTower = career(1 << 3, 0);
  assert.equal(isForbiddenEquip(noTower, towerShield(IRON)), true, 'arm 1 still stands');
  assert.equal(isForbiddenEquip(noTower, buckler(IRON)), false, 'and is per-type');
  // the plate-only gate holds: a leather-material shield (high byte 0)
  // never reaches the material flags, even with the bit set.
  assert.equal(isForbiddenEquip(career(0, 1 << 9), towerShield(0x0009)), false,
    'arm 3 is gated on the plate high byte, as DFU gates it');
});
