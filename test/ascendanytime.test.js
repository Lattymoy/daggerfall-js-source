import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { STAT_KEYS_ORDER } from '../src/systems/chargen.js';
import {
  viewOnlyScreen, levelUpFrame, levelUpCrown, levelProgress, rolloutRows, rolloutPool, canAscend,
  raiseAt, lowerAt, ascend,
} from '../src/ui/levelUpView.js';
import { crownTitle, ASK_VIEW } from '../src/ui/enhancedLevelUp.js';

// ASCEND-ANYTIME: the Ascension screen opens whenever the player asks. Nothing owed = a VIEW of the stars:
// a pool of zero, no star moves, Close, and no level / stats / pool is ever written.

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');

const hero = () => ({
  name: 'Tester', level: 7, race: 'Breton', career: { name: 'Mage' },
  stats: Object.fromEntries(STAT_KEYS_ORDER.map((k, i) => [k, 40 + i])),
  readyToLevelUp: false, pendingLevel: null, pendingBonusPool: null,
  currentLevelUpSkillSum: 100, startingLevelUpSkillSum: 80,
});

test('ASCEND-ANYTIME: the view-only screen has nothing to spend and no star will move', () => {
  const e = hero();
  const s = viewOnlyScreen(e);
  assert.equal(rolloutPool(s), 0);
  assert.ok(rolloutRows(s).every((r) => !r.canRaise && !r.canLower), 'no star can be raised or lowered');
  for (const k of STAT_KEYS_ORDER) {
    assert.equal(raiseAt(s, k), false);
    assert.equal(lowerAt(s, k), false);
  }
  assert.deepEqual(s.working, e.stats, 'it reads the character\'s own numbers');
});

test('ASCEND-ANYTIME: it WRITES NOTHING - no level, no stats, no bonus pool, and confirm only closes it', () => {
  const e = hero();
  const before = JSON.stringify(e);
  const s = viewOnlyScreen(e);
  for (const k of STAT_KEYS_ORDER) { raiseAt(s, k); lowerAt(s, k); }
  assert.equal(canAscend(s), true, 'the button is open: it closes');
  assert.equal(ascend(s), true);
  assert.equal(s.done, true);
  assert.equal(JSON.stringify(e), before, 'entity byte-for-byte unchanged (pendingBonusPool included: no free reroll)');
});

test('ASCEND-ANYTIME: the crown promises no level, and the window says so', () => {
  const e = hero();
  const s = viewOnlyScreen(e);
  const crown = levelUpCrown(e, s);
  assert.equal(crown.viewOnly, true);
  assert.equal(crown.to, crown.from);
  assert.equal(crownTitle(crown), 'Level 7', 'no arrow to a level that is not coming');
  assert.equal(levelUpFrame(e, s).crown.to, 7);
  assert.equal(ASK_VIEW, 'Your stars');
  // A real owed level still reads its arrow.
  e.pendingLevel = 8;
  assert.equal(crownTitle(levelUpCrown(e, { pool: 3, base: e.stats, working: e.stats })), 'Level 7 → 8');
});

test('ASCEND-ANYTIME: a mod-law character\'s view reads the mod\'s bar, a classic one the skill-sum bar', () => {
  const e = hero();
  assert.equal(levelProgress(e, viewOnlyScreen(e, false)).label, 'Skill sum toward the next');
  assert.equal(levelProgress(e, viewOnlyScreen(e, true)).label, 'Toward the next');
});

test('ASCEND-ANYTIME by source: the Stats page carries the door, the sheet overlay swaps in place, and nothing else moved', () => {
  const menu = read('src/ui/enhancedMenu.js');
  const at = menu.indexOf('function pauseStats(body)');
  const fn = menu.slice(at, menu.indexOf('\nfunction ', at + 10));
  assert.match(fn, /if \(typeof hooks\.openAscend === 'function'\) \{/, 'drawn only when a host handed the hook');
  assert.match(fn, /b\.onclick = \(\) => hooks\.openAscend\(\);/, 'it does NOT resume first: the overlay it lives in swaps in place');
  const door = read('src/ui/charSheetDoor.js');
  assert.match(door, /return enhancedSheetPageOverlay\(hooks, deps\.entity, deps\.pause \?\? null\);/);   // F5-QUESTS: and the host's pause bag
  assert.match(door, /openAscend: entity \? openAscend : undefined,/);
  assert.match(door, /load: \(\) => import\('\.\/enhancedLevelUp\.js'\),\s*\n\s*alive: \(\) => !fired && ascendHost === h,/, 'through the one lazy-chunk door, so a failed load says so');
  assert.match(door, /ascendView\?\.destroy\?\.\(\); \} catch \{ \/\* already gone \*\/ \}   \/\/ ASCEND-ANYTIME: the sheet key closes whatever is on top/, 'close() takes the Ascension down with the sheet');
  assert.doesNotMatch(door, /^import \{[^}]*viewOnlyScreen[^}]*\} from '\.\/levelUpView\.js'/m, 'reached through the lazy chunk, not the boot bundle');
  // A level OWED still opens the real window first - the feature adds a way in, it never replaces that one.
  assert.match(door, /if \(deps\.entity\?\.readyToLevelUp\) \{/);
});

test('ASCEND-ANYTIME by source: the pause window (Tab\'s dial, Escape) hands the Stats page its Ascend door too', () => {
  const door = read('src/ui/pauseDoor.js');
  // The page draws the button only when a door hands the hook over - F5's door always did, this one never had.
  assert.match(door, /openAscend: \(\) => openAscend\(\),/, 'the pause door hands the hook to the menu');
  // Nothing owed: swap in place, through the ONE lazy-chunk door, and come back on the Stats page.
  assert.match(door, /load: \(\) => import\('\.\/enhancedLevelUp\.js'\),\s*\n\s*alive: \(\) => !fired && ascendHost === h,/,
    'lazy, and through the chunk door, so a failed load says so and the pause window stays up behind the notice');
  assert.match(door, /seams\.mountEnhancedMenu\(host, \{ mode: 'pause', hooks, onAction: act, at: 'stats' \}\)/,
    'closing the Ascension puts the pause window back on Stats');
  assert.doesNotMatch(door, /^import .*(enhancedLevelUp|levelUpView)\.js/m, 'the window stays out of the boot bundle');
  // A level OWED is still the real level-up: the pause window puts itself away first (the Pack button\'s order), then
  // the sheet key\'s own door answers - the feature adds a way in and never replaces the rollout.
  assert.match(door, /if \(playerEntity\.readyToLevelUp\) \{\s*\n\s*act\('resume'\);[^\n]*\n\s*show\(createCharSheetWindow\(\{ entity: playerEntity \}\)\);/);
  // Whatever is on top of the pause window goes with it.
  const close = door.slice(door.indexOf('const close = ()'), door.indexOf('const overlay = {'));
  assert.ok(close.indexOf('dropAscend();') > 0 && close.indexOf('dropAscend();') < close.indexOf('view?.unmount()'),
    'close() takes the Ascension down before the window it sits on');
});

// ASCEND-ANYTIME via the pause window (Tab's dial / Escape): the same Stats page, now with the door handed over.
test('ASCEND-ANYTIME pause door: it hands the Stats page the hook, and close() takes the Ascension down first', () => {
  const src = read('src/ui/pauseDoor.js');
  assert.match(src, /openAscend: \(\) => openAscend\(\),/);
  const close = src.slice(src.indexOf('const close = ()'), src.indexOf('const overlay = {'));
  assert.ok(close.indexOf('dropAscend();') > 0 && close.indexOf('dropAscend();') < close.indexOf('view?.unmount()'));
});

test('ASCEND-ANYTIME pause door: a level OWED goes to the real sheet door, nothing owed swaps in a view', () => {
  const src = read('src/ui/pauseDoor.js');
  assert.match(src, /if \(playerEntity\.readyToLevelUp\) \{\s*\n\s*act\('resume'\);[^\n]*\n\s*show\(createCharSheetWindow\(\{ entity: playerEntity \}\)\);/);
  assert.match(src, /load: \(\) => import\('\.\/enhancedLevelUp\.js'\),\s*\n\s*alive: \(\) => !fired && ascendHost === h,/);
});

test('ASCEND-ANYTIME pause door: the level-up window stays a lazy chunk, not a boot import', () => {
  assert.doesNotMatch(read('src/ui/pauseDoor.js'), /^import .*(enhancedLevelUp|levelUpView)\.js/m);
});
