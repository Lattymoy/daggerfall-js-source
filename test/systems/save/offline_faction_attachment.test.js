import { test } from 'node:test';
import assert from 'node:assert/strict';
import { snapshotPlayer, restorePlayer } from '../../../src/systems/save/save.js';
import { setSharedClock, setOwnMinutes, hearSharedClock, normalizeAcross } from '../../../src/systems/worldTick.js';
import { attachFactionRep } from '../../../src/systems/faction/factionRep.js';
const W = 10080;
const faction = {id: 1, rep: -30, flags: 0, power: 1, parent: 0, type: 0, children: []};
const dict = new Map([[1, faction]]);
const player = () => ({isPlayer:true, name:'Test',level:5,health:60,maxHealth:60,magicka:10,maxMagicka:10,fatigue:6000,stats:{strength:50,endurance:50,willpower:50,agility:50,luck:50,intelligence:50,personality:50,speed:50},skills:30,skillUses:[],items:[],career:{},activeEffects:[],legalRep:{1:-30}});

for (const clockFirst of [false, true]) {
  for (const attachFirst of [false, true]) {
    test(`Offline faction recovery: clockFirst=${clockFirst}, attachFirst=${attachFirst}`, () => {
      try {
        setSharedClock(() => 1);
        setOwnMinutes(100);
        const original = player();
        attachFactionRep(original, dict);
        const snap = JSON.parse(JSON.stringify(snapshotPlayer(original, { classicMinutes: 100 })));
        const originalColumns = JSON.stringify(snap.factionRep);
        setSharedClock(() => 5 * W + 1);
        if (clockFirst) hearSharedClock();
        const loaded = player();
        if (attachFirst) attachFactionRep(loaded, dict);
        restorePlayer(loaded, snap);
        if (!clockFirst) hearSharedClock();
        assert.equal(loaded.legalRep[1], -25);
        // A save made before attachment must retain the paid recovery.
        const savedAgain = JSON.parse(JSON.stringify(snapshotPlayer(loaded, { classicMinutes: 100 })));
        if (!attachFirst) attachFactionRep(loaded, dict);
        assert.equal(loaded.factionRep.dict.get(1).rep, -25);
        const reloaded = player();
        restorePlayer(reloaded, savedAgain);
        attachFactionRep(reloaded, dict);
        assert.equal(reloaded.factionRep.dict.get(1).rep, -25, 'no loss or double recovery on reload');
        assert.equal(JSON.stringify(snap.factionRep), originalColumns, 'original snapshot remains reusable');
      } finally { setSharedClock(null); }
    });
  }
}
test('Deferred recovery preserves positive standing, stops at zero, and honors normalization shield', () => {
  const e = { savedFactionRep: { rep: [-30, -2, 0, 30] } };
  normalizeAcross(e, 1, 16 * W + 1);
  assert.deepEqual(e.savedFactionRep.rep, [-14, 0, 0, 30]);
  e.preventNormalizingReputations = true;
  normalizeAcross(e, 1, 16 * W + 1);
  assert.deepEqual(e.savedFactionRep.rep, [-14, 0, 0, 30]);
});
