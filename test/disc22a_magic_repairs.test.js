// DISC22-A (2026-09-24, Mac: "repair magical items should be enabled by default and required online").
//
// DFU ships Controls/AllowMagicRepairs False - a smith turns an enchanted item away (RepairsObjects' magic arm,
// systems/repairService.js repairRefusal). The port's default mends it now (settings.js PORT_DEFAULTS, over the
// generated DFU table, which is left exactly as DFU ships it), and online the lane forces it (onlineLane.js
// ONLINE_FORCED_SETTINGS - the fourth read path, asked first by settings.js getData), so a player's own False stands
// offline only. Driven through the real store and the real repair law.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULTS, getBool, setValue, effectiveSettings, _resetForTests, PORT_DEFAULTS } from '../src/systems/settings.js';
import { onlineForcedSetting, ONLINE_FORCED_SETTINGS } from '../src/systems/onlineLane.js';
import { repairRefusal } from '../src/systems/repairService.js';
import { readFileSync } from 'node:fs';

const enchanted = { templateIndex: 113, currentCondition: 10, maxCondition: 100, legacyMagic: [{ type: 1, param: 0 }], enchantments: [{ type: 1, param: 0 }], flags: 0x20 };
const withSearch = (search, fn) => {
  const prev = globalThis.location;
  globalThis.location = { search, href: `http://localhost/play/${search}` };
  try { return fn(); } finally { if (prev === undefined) delete globalThis.location; else globalThis.location = prev; }
};
const allow = () => getBool('Controls', 'AllowMagicRepairs');

test('DISC22-A: the port\'s default mends an enchanted item; DFU\'s own table is left as DFU ships it', () => {
  _resetForTests();
  withSearch('', () => {
    assert.equal(DEFAULTS.Controls.AllowMagicRepairs, 'False', 'the generated table is DFU\'s, verbatim');
    assert.equal(PORT_DEFAULTS.Controls.AllowMagicRepairs, 'True');
    assert.equal(allow(), true, 'a player who never touched the row reads the port\'s default');
    assert.equal(repairRefusal(enchanted, { allowMagicRepairs: allow() }) === 'magic', false, 'the smith takes it');
  });
  _resetForTests();
});

test('DISC22-A: offline, a player\'s own Off stands', () => {
  _resetForTests();
  withSearch('', () => {
    setValue('Controls', 'AllowMagicRepairs', 'False');
    assert.equal(allow(), false);
    assert.equal(repairRefusal(enchanted, { allowMagicRepairs: allow() }), 'magic');
  });
  _resetForTests();
});

test('DISC22-A: online it is required - the room\'s value wins over a stored Off, and the screen shows what the game reads', () => {
  _resetForTests();
  withSearch('', () => setValue('Controls', 'AllowMagicRepairs', 'False'));
  withSearch('?online', () => {
    assert.equal(onlineForcedSetting('Controls', 'AllowMagicRepairs'), 'True');
    assert.equal(allow(), true, 'forced on, whatever the store holds');
    assert.equal(effectiveSettings().Controls.AllowMagicRepairs, 'True', 'the settings pane draws the forced value');
    assert.equal(repairRefusal(enchanted, { allowMagicRepairs: allow() }) === 'magic', false);
    assert.equal(onlineForcedSetting('Controls', 'InstantRepairs'), undefined, 'only the room\'s own rule is forced');
  });
  withSearch('', () => assert.equal(allow(), false, 'offline again, the player\'s own choice returns - the store was never written'));
  assert.deepEqual(Object.keys(ONLINE_FORCED_SETTINGS), ['Controls']);
  _resetForTests();
});

test('DISC22-A: the settings row is shown locked online, with the reason, as every forced row is (onlinelane.test.js)', () => {
  const menu = readFileSync(new URL('../src/ui/enhancedMenu.js', import.meta.url), 'utf8');
  assert.match(menu, /if \(onlineForcedSetting\(_sec, _k\) !== undefined\) lockOnline\(b, null, \{ note: ONLINE_SETTING_NOTE, value: raw === 'True' \}\);/);
  assert.match(menu, /const ONLINE_SETTING_NOTE = '[^']+';/, 'the note names why');
});
