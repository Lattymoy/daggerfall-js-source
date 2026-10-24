import '../modsOff.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { MOBILE_TYPES } from '../../src/characters/mobile/mobileTypes.js';

const store = new Map();
globalThis.localStorage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) };
const { setPref } = await import('../../src/systems/uiPrefs.js');
const N = await import('../../src/systems/revenant/revenant.js');
const RC = await import('../../src/systems/revenant/revenantCompanions.js');
const { modSaveRecords, restoreModSaveRecords } = await import('../../src/systems/modSaveData.js');

test('audit544: a mirrored companion rest completes after eight hours on an older save and stays corrected after reload', () => {
  setPref('lootRarity', true);
  N._resetRevenantForTests(); RC._resetRetinueForTests(); store.clear();
  const me = { isPlayer: true, name: 'Audit', characterId: 'audit-rest', level: 8, health: 100, maxHealth: 100 };
  RC.setRetinuePlayer(me);
  const e = { mobileType: MOBILE_TYPES.Orc, level: 6, champion: 'mighty', unquiet: true, health: 5, maxHealth: 50, team: 'Orcs' };   // UNQUIET (Revenants.md section 46): marked - only a marked foe rises
  const r = N.revenantDeed(me, e, 'fled', { now: 0, rolls: () => 0 });
  N.revenantSpared(me, { revenant: { id: r.id } }, { state: 'with' });
  let wakes = 0;
  const party = RC.revenantParty({ onWake: () => wakes++ });
  const olderSave = structuredClone(modSaveRecords());
  assert.equal(party.knock('rv', r.id, 9520), true);
  assert.equal(RC.restUntil(N.revenantRecord(me, r.id), 9700), 10000, 'ordinary recovery is unchanged');
  restoreModSaveRecords(olderSave); RC.forgetSwornMember();
  assert.equal(N.revenantRecord(me, r.id).companion.until, 10000);
  party.wake(5000);
  assert.equal(N.revenantRecord(me, r.id).companion.until, 5480);
  assert.equal(RC.callRefusal(N.revenantRecord(me, r.id), 5240), 'Still recovering.');
  assert.equal(RC.restUntil(N.revenantRecord(me, r.id), 5240) - 5240, 240, 'the remaining time counts down');
  restoreModSaveRecords(olderSave); RC.forgetSwornMember();
  assert.equal(N.revenantRecord(me, r.id).companion.until, 5480, 'the corrected mirror wins after another load');
  party.wake(5479);
  assert.equal(N.revenantRecord(me, r.id).companion.state, 'resting');
  party.wake(5480); party.wake(5481);
  assert.equal(N.revenantRecord(me, r.id).companion.state, 'away');
  assert.equal(wakes, 1);
  assert.equal(RC.callRevenant(r.id, 5480), null);
  assert.equal(party.party.length, 1);
});
