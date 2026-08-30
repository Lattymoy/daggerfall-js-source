import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { openState, hasCart, SMALL_CART_TEMPLATE } from '../src/systems/inventorySession.js';
import { ServiceFlowWindow } from '../src/ui/guildServiceWindows.js';
import { LIVE } from '../src/systems/settings.js';

// AUDIT 28 - W2c: THE EXIT-DOOR WAGON PROMPT (PlayerActivate.cs:649-664
// + DungeonWagonAccess_OnButtonClick :1133-1145), a default-ON DFU flow
// the port lacked - and the PRODUCER inventorySession's NT3 note had
// been waiting for: a dungeon exit with a Small_cart in the pack asks
// TEXT.RSC 38; No leaves, Yes pre-sets AllowDungeonWagonAccess and opens
// the inventory in Remove mode showing the wagon, Escape closes the box
// and nothing happens.

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');
const cart = { group: 'Transportation', templateIndex: SMALL_CART_TEMPLATE };

test('AUDIT 28 W2c: CheckWagonAccess\'s FIRST arm - the pre-set flag selects Remove and shows the wagon, wherever the player stands', () => {
  assert.ok(hasCart([cart]), 'the fixture cart is a cart');
  const prompted = openState({ items: () => [cart], dungeon: { inside: true, wagonPrompt: true, nearExit: () => false } });
  assert.deepEqual(prompted, { mode: 'remove', usingWagon: true, allowDungeonWagonAccess: true, chooseOne: null });
  // The proximity arm (:1089-1096) still only SHOWS the wagon and keeps
  // OnPush's mode - the NT3 distinction.
  const near = openState({ items: () => [cart], dungeon: { inside: true, nearExit: () => true } });
  assert.deepEqual(near, { mode: 'equip', usingWagon: true, allowDungeonWagonAccess: true, chooseOne: null });
  const far = openState({ items: () => [cart], dungeon: { inside: true, nearExit: () => false } });
  assert.equal(far.usingWagon, false);
});

test('AUDIT 28 W2c: Escape on a box that names onEscape is a CANCEL - neither Yes nor No', () => {
  const log = [];
  const w = new ServiceFlowWindow([{ rows: [{ text: 'wagon?' }], buttons: 'YesNo',
    onYes: () => { log.push('yes'); return null; }, onNo: () => { log.push('no'); return null; }, onEscape: () => { log.push('esc'); return null; } }]);
  w.input('Escape');
  assert.deepEqual(log, ['esc']);
  assert.equal(w.done, true, 'the box closed');
  // Without onEscape, Escape is still No (the guild offers' shape).
  const log2 = [];
  const w2 = new ServiceFlowWindow([{ rows: [{ text: 'x' }], buttons: 'YesNo', onYes: () => null, onNo: () => { log2.push('no'); return null; } }]);
  w2.input('Escape');
  assert.deepEqual(log2, ['no']);
});

test('AUDIT 28 W2c: the exit door asks first - cart + setting, TEXT.RSC 38, No exits, Yes opens the wagon inventory, Escape does nothing', () => {
  const modes = read('src/scenes/worldModes.js');
  const fn = modes.slice(modes.indexOf('function tryExitDungeon()'), modes.indexOf('function exitDungeonNow()'));
  assert.match(fn, /if \(hasCart\(playerEntity\.items \?\? \[\]\) && getBool\('GUI', 'DungeonExitWagonPrompt'\)\) \{/, 'the gate is the cart AND the setting');
  assert.match(fn, /rscLines\?\.\(38\)/, 'record 38');
  assert.match(fn, /onYes: \(\) => \{ dungeonCtx\.openInventoryWithWagon\(\); return null; \}/);
  assert.match(fn, /onNo: \(\) => \{ exitDungeonNow\(\); return null; \}/);
  assert.match(fn, /onEscape: \(\) => null,/);
  assert.match(fn, /return mountSpellWindow\(prompt\);/, 'the box goes into the dungeon slot and the activation returns');
  assert.match(fn, /\n    return exitDungeonNow\(\);\n/, 'no cart or no setting: the exit is immediate');
  const ctx = read('src/scenes/dungeonContext.js');
  assert.match(ctx, /openInventoryWithWagon\(\) \{[\s\S]*?openInventory\(null, null, \{ wagonPrompt: true \}\)/);
  assert.match(ctx, /wagonPrompt,\s+\/\/ AUDIT 28 W2c/, 'the flag reaches the inventory\'s dungeon deps');
  assert.equal(LIVE['GUI/DungeonExitWagonPrompt'], 'src/scenes/worldModes.js');
});
