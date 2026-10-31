// LOCK-RULES (a player's ask: an "Always lock" button on an item's menu): a NAME kept locked for every copy - systems/item/lockRules.js,
// the resolver the lock asks (systems/item/itemLock.js), and the pack's card and the settings drawer (by source).
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { setPref, resetPrefs, _resetForTests } from '../../src/systems/uiPrefs.js';
import { isLocked, setLocked, lockRefuses } from '../../src/systems/item/itemLock.js';
import { isAlwaysLocked, setAlwaysLock, toggleAlwaysLock, forgetAlwaysLock, alwaysLockNames, LOCK_ALWAYS_PREF } from '../../src/systems/item/lockRules.js';
import { setAlwaysJunk, isAlwaysJunk, isJunkNow } from '../../src/systems/item/junkRules.js';
import { isJunk, setJunk } from '../../src/systems/item/itemJunk.js';
import { canJunkInBatch } from '../../src/systems/item/junkRules.js';
import { FEATURES, resolveControl } from '../../src/systems/features.js';

beforeEach(() => { _resetForTests(); resetPrefs(); });
const rd = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const beads = (extra = {}) => ({ group: 'ReligiousItems', templateIndex: 301, name: 'Prayer Beads', ...extra });
const cup = (extra = {}) => ({ group: 'MiscItems', templateIndex: 300, name: 'Broken Cup', ...extra });

test('LOCK-RULES: a name always locked locks every copy - looted later, any case - with nothing written on the piece, and the lock\'s own refusals follow (mutants: the resolver unregistered; the name matched case-sensitively; the flag written)', () => {
  const a = beads();
  assert.equal(isLocked(a), false);
  assert.equal(toggleAlwaysLock(a), true, 'listed');
  assert.deepEqual(alwaysLockNames(), ['Prayer Beads']);
  assert.equal(isLocked(beads()), true, 'another copy');
  assert.equal(isLocked(beads({ name: 'PRAYER beads', stackCount: 4 })), true, 'any case, a stack');
  assert.equal(isLocked(cup()), false, 'another name');
  assert.equal(a.locked, undefined, 'nothing is written on the piece');
  for (const way of ['drop', 'sell', 'trade']) assert.equal(lockRefuses(beads(), way), true, way);
  assert.equal(lockRefuses(beads(), 'wear'), false, 'only the three ways out');
  assert.equal(canJunkInBatch(beads()), false, 'a sweep leaves it');
  setLocked(a, false);
  assert.equal(isLocked(a), true, 'unlocking the piece does not free a name that is always locked');
  assert.equal(toggleAlwaysLock(a), false, 'off again');
  assert.equal(isLocked(beads()), false);
  assert.equal(isLocked(cup({ locked: true })), true, 'the plain lock is as it was');
});

test('LOCK-RULES: the list is read afresh when it changes - a piece looked up once is looked up again - and a bad stored word reads as empty (mutants: the answer kept past a change; a garbage pref locking everything)', () => {
  const a = beads(), c = cup();
  assert.equal(isLocked(a), false);
  setAlwaysLock(c, true);
  assert.equal(isLocked(a), false, 'a different name');
  assert.equal(isLocked(c), true);
  setAlwaysLock(a, true);
  assert.equal(isLocked(a), true, 'the same piece, the list changed');
  forgetAlwaysLock('prayer BEADS');
  assert.equal(isLocked(a), false, 'the drawer\'s × takes a name off');
  assert.equal(isLocked(c), true);
  setPref(LOCK_ALWAYS_PREF, 'garbage');
  assert.deepEqual(alwaysLockNames(), []);
  assert.equal(isLocked(c), false);
  assert.equal(isAlwaysLocked(null), false);
  assert.equal(setAlwaysLock({ name: '' }, true), false, 'no name, no entry');
});

test('LOCK-RULES: the lock is the stronger word - a name put on the list comes off Always junk and its piece loses its junk mark (mutants: both words left standing)', () => {
  const a = beads();
  setAlwaysJunk(a, true);
  setJunk(a, true);
  assert.ok(isAlwaysJunk(a) && isJunk(a));
  setAlwaysLock(a, true);
  assert.equal(isAlwaysJunk(beads()), false, 'off the always-junk list');
  assert.equal(isJunk(a), false, 'the piece\'s mark lifted');
  assert.equal(isJunkNow(beads()), false);
  assert.equal(isLocked(beads()), true);
});

test('LOCK-RULES wiring: the card offers Always lock beside Lock and, for a name always locked, Stop always lock alone; the drawer lists the names; the rule is installed at the entry (by source)', () => {
  const inv = rd('src/ui/enhanced/enhancedInventory.js');
  assert.match(inv, /isAlwaysLocked\(picked\)\) \{\n\s*const al = el\('button', 'act', t\('inventory\.lockAlways\.stop', 'Stop always lock'\)\);/);
  assert.match(inv, /const al = el\('button', 'act', t\('inventory\.lockAlways\.start', 'Always lock'\)\);/);
  assert.match(inv, /canJunk\(picked\) && !isAlwaysLocked\(picked\)\) \{/, 'no Junk over an always-locked name');
  const c = resolveControl(FEATURES.find((f) => f.id === 'quick-loot'));
  assert.ok(c.parts.some((p) => p.key === 'lockAlways' && p.list === 'lock-names'));
  assert.deepEqual(c.also.find((a) => a.key === 'lockAlways').initial, []);
  const main = rd('src/main.js');
  assert.doesNotMatch(main, /^import .*lockRules/m, 'a dynamic import: the entry\'s reach is counted (BOOT2)');
  assert.match(main, /import\('\.\/systems\/item\/lockRules\.js'\);/);
});

test('LOCK-RULES rename: a piece renamed in place is judged by its new name - the kept answer follows the name as well as the list (mutants: the answer kept past a rename)', () => {
  const piece = beads();
  setAlwaysLock(beads(), true);
  assert.equal(isAlwaysLocked(piece), true, 'by its name');
  piece.name = 'Broken Cup';
  assert.equal(isAlwaysLocked(piece), false, 'renamed: no longer on the list');
  piece.name = 'PRAYER beads';
  assert.equal(isAlwaysLocked(piece), true, 'renamed back: locked again, any case');
});
