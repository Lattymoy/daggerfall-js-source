// S11: snapshot/restore round-trip, version gate, spell re-resolution.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { snapshotPlayer, restorePlayer, SAVE_VERSION, writeQuicksave, readQuicksave } from '../src/systems/save.js';
import { routeKey } from '../src/ui/input.js';

const mkEntity = () => ({
  name: 'Mac', gender: 'female', careerIndex: 4, level: 3, reflexes: 2,
  health: 22, maxHealth: 40, magicka: 15, maxMagicka: 30,
  startingLevelUpSkillSum: 90, currentLevelUpSkillSum: 120,
  readyToLevelUp: false, pendingLevel: null, chargenDone: true,
  stats: { strength: 55, luck: 60 },
  skills: [30, 28], skillUses: [100, 0],
  career: { name: 'Healer', hitPointsPerLevel: 8 },
  items: [{ group: 'Weapons', name: 'Short Bow', templateIndex: 129, material: 0 }],
  spells: [{ index: 97, name: 'Balyna\'s Balm' }],
  activeEffects: [{ kind: 'slowfall', roundsRemaining: 4 }],
});

test('save: round-trip restores everything; extras carried; deep copies', () => {
  const src = mkEntity();
  const world = { foes: [{ health: 5, dead: true, feet: [9, 0, 9], yaw: 1.5, items: [] }], piles: [], actions: [{ key: 'act:3', state: 'end', t: 1, activationCount: 2 }] };
  const snap = snapshotPlayer(src, { position: [1, 2, 3], classicMinutes: 77.5, readiedSpellIndex: 97, world, locationKey: 'dungeon:42' });
  const dst = {};
  const byIndex = new Map([[97, { index: 97, name: 'Balyna\'s Balm' }]]);
  const extras = restorePlayer(dst, snap, byIndex);
  assert.deepEqual(extras, { position: [1, 2, 3], classicMinutes: 77.5, readiedSpellIndex: 97, world, locationKey: 'dungeon:42' });   // S12: the world rides the envelope
  assert.equal(dst.name, 'Mac');
  assert.equal(dst.stats.luck, 60);
  assert.equal(dst.items[0].name, 'Short Bow');
  assert.equal(dst.spells[0].index, 97);                     // re-resolved
  assert.equal(dst.activeEffects[0].kind, 'slowfall');
  src.stats.luck = 1;                                        // deep copy: the snapshot is immune
  assert.equal(snap.stats.luck, 60);
  // version gate
  assert.equal(restorePlayer({}, { ...snap, v: SAVE_VERSION + 1 }), null);
  // storage round-trip through a fake localStorage
  const store = new Map();
  const fake = { setItem: (k, v) => store.set(k, v), getItem: (k) => store.get(k) ?? null };
  assert.ok(writeQuicksave(snap, fake));
  assert.equal(readQuicksave(fake).name, 'Mac');
  assert.equal(readQuicksave({ getItem: () => '{corrupt', setItem: () => {} }), null);
  // writeQuicksave must NOT throw when setItem throws (QuotaExceeded /
  // private-mode SecurityError) - it returns false so the caller
  // reports "save failed" instead of crashing the frame.
  const throwing = { setItem: () => { throw new Error('QuotaExceededError'); }, getItem: () => null };
  assert.equal(writeQuicksave(snap, throwing), false);
  assert.doesNotThrow(() => writeQuicksave(snap, throwing));
});

test('save: F11 pierces overlays (the death hint is true)', () => {
  const calls = [];
  const ctx = { uiOverlayActive: true, overlayInput: (a) => calls.push('ov:' + a), quickLoad: (fn) => calls.push('load:' + typeof fn) };
  // AUDIT 18: InputManager.SetupDefaults binds QuickLoad to F11, not F12.
  assert.ok(routeKey({ key: 'F11' }, ctx, () => ({}), 'APPLIER'));
  assert.ok(!routeKey({ key: 'F9' }, ctx, () => ({})));      // save stays gated under overlays
  assert.deepEqual(calls, ['load:string']);
});
