// DISC19 (2026-09-24, Mac, five in one message). bible/01-Overview/Field-Bugs-2026-09-23.md, DISC19.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { modSetting, setModSetting, _resetModSettings, SWITCH_RESETS, KEY_MIGRATIONS, MOD_SETTINGS } from '../src/systems/modSettings.js';
import { diverseWeaponsPresetOn } from '../src/combat/diverseWeapons.js';

// ── DISC19-E: "The weapon widget default toggle under diverse weapons should be set to off by default" ──
test('DISC19-E: Diverse Weapons\' Weapon Widget Preset ships off, and a value saved before this reset is let go once - the shipped off applies - while a choice made after it is kept across reloads (mutants: no reset; the reset every load; the stamp never written)', () => {
  const prevLs = globalThis.localStorage;
  const K = 'dfjs-mod-settings', V = 'diverse-weapons', P = 'WeaponWidgetPreset';
  try {
    let store = new Map();
    globalThis.localStorage = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) };
    assert.equal(MOD_SETTINGS[V].keys[P].default, false, 'the shipped default is off');
    // a file from before the reset: the preset saved on (DW-CLIP shipped it on), the mod's own switch beside it
    _resetModSettings();
    store.set(K, JSON.stringify({ [V]: { [P]: true, Enabled: true }, pcaao: { Enabled: false } }));
    assert.equal(modSetting(V, P), false, 'the saved on is let go: the shipped off applies');
    assert.equal(diverseWeaponsPresetOn(), false, 'and the weapon reads it off');
    assert.equal(modSetting(V, 'Enabled'), true, 'the mod\'s own switch is the player\'s');
    const written = JSON.parse(store.get(K));
    assert.deepEqual(written[V], { Enabled: true }, 'written back without it');
    assert.deepEqual(written.pcaao, { Enabled: false }, 'every other mod untouched');
    // the player turns it on AFTER the reset: stamped, and kept through a reload
    setModSetting(V, P, true);
    const saved = store.get(K);
    _resetModSettings(); store.set(K, saved);   // a reload: the memory dropped (the reset clears the fake's key, so the file is laid back)
    assert.equal(modSetting(V, P), true, 'a choice made after the reset stands');
    assert.equal(diverseWeaponsPresetOn(), true);
    const after = JSON.parse(store.get(K));
    assert.equal(after[V][P], true); assert.equal(after[V][SWITCH_RESETS[0].stamp], true, 'the stamp rides with it');
    // and off again, still the player's
    setModSetting(V, P, false);
    const saved2 = store.get(K);
    _resetModSettings(); store.set(K, saved2);
    assert.equal(modSetting(V, P), false);
    // a file that never mentioned the mod is not grown one
    _resetModSettings();
    store = new Map([[K, JSON.stringify({ pcaao: { Enabled: false } })]]);
    assert.equal(modSetting(V, P), false);
    assert.deepEqual(Object.keys(JSON.parse(store.get(K))), ['pcaao']);
    // the one entry, beside the value migrations
    assert.deepEqual(SWITCH_RESETS.map((r) => `${r.vendor}/${r.key}`), [`${V}/${P}`]);
    assert.equal(KEY_MIGRATIONS.length, 3, 'the value migrations are untouched');
  } finally {
    _resetModSettings();
    if (prevLs === undefined) delete globalThis.localStorage; else globalThis.localStorage = prevLs;
  }
});
