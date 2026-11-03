import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { FORK_FLAGS } from '../../src/config/forkFlags.js';

const root = new URL('../..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const read = (f) => readFileSync(join(root, f), 'utf8');

test('FORK-TASK-CLOUD-SAVES: FORK_FLAGS.ENABLE_CLOUD_SAVES is disabled and hides cloud backup in enhancedMenu', () => {
  assert.equal(FORK_FLAGS.ENABLE_CLOUD_SAVES, false, 'cloud saves feature flag is false');
  const menu = read('src/ui/enhanced/enhancedMenu.js');
  assert.match(menu, /function ensureCloud\(\) \{\s*if \(!FORK_FLAGS\.ENABLE_CLOUD_SAVES\) return;/);
  assert.match(menu, /function cloudFor\(save, \{ restore = false \} = \{\}\) \{\s*if \(!FORK_FLAGS\.ENABLE_CLOUD_SAVES\) return \{ state: 'off', when: null, why: null, actions: \[\] \};/);
  assert.match(menu, /function cloudForCard\(card\) \{\s*if \(!FORK_FLAGS\.ENABLE_CLOUD_SAVES\) return \{ state: 'off', when: null, why: null, actions: \[\] \};/);
  assert.match(menu, /function cloudOnlyGrid\(saves\) \{\s*if \(!FORK_FLAGS\.ENABLE_CLOUD_SAVES\) return null;/);
});
