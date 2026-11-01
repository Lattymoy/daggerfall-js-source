// A tutorial that sends the player to a setting names a Settings tab that exists - Features is no door of its own, its
// rows stand on the tabs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TUTORIALS } from '../../src/systems/tutorialCatalogue.js';
import { CATEGORIES } from '../../src/ui/settings/settingsMap.js';

test('every "Settings > <tab>" a tutorial names is a tab of Settings: survival under Gameplay, the quest marks under Interface, and no Features (mutants: survival sent to Features; the marks sent to Features)', () => {
  const tabs = new Set(CATEGORIES.map((c) => c.title));
  const named = [];
  for (const t of TUTORIALS)
    for (const line of [...(t.body ?? []), ...(t.points ?? [])])
      for (const m of String(line).matchAll(/Settings > ([A-Z][a-z]+)/g)) named.push(`${t.id}:${m[1]}`);
  assert.deepEqual(named, ['quest-guide:Interface', 'survival:Gameplay']);
  for (const n of named) assert.ok(tabs.has(n.split(':')[1]), `${n}: a tab of Settings`);
});
