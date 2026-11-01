// The copy door's item filter (src/systems/item/knownItemsOnly.js): an item this build has no template for leaves the
// copy, a known one stays, the lit light follows its item, and every module that registers a template is loaded first.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dropUnknownItems } from '../../src/systems/item/knownItemsOnly.js';
import { templateByIndex } from '../../src/systems/item/itemTemplates.js';

const ROOT = new URL('../../', import.meta.url);
const files = (dir) => readdirSync(new URL(dir, ROOT), { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? files(`${dir}/${e.name}`) : e.name.endsWith('.js') ? [`${dir}/${e.name}`] : []));

test('an unknown item leaves every list of the copy, a known one stays, and the lit light keeps its item', () => {
  const known = [0, 1, 2, 3].find((i) => templateByIndex(i));
  const snap = { items: [{ templateIndex: known }, { templateIndex: 999999 }, { templateIndex: known, lit: true }], lightSourceIndex: 2, wagonItems: [{ templateIndex: 999998 }, { templateIndex: known }] };
  assert.equal(dropUnknownItems(snap), 2);
  assert.equal(snap.items.length, 2);
  assert.equal(snap.items[snap.lightSourceIndex].lit, true);
  assert.deepEqual(snap.wagonItems, [{ templateIndex: known }]);
});

test('every module that registers an item template is loaded before the filter reads one', () => {
  const door = readFileSync(new URL('src/systems/item/knownItemsOnly.js', ROOT), 'utf8');
  const callers = files('src').filter((f) => !/item\/(itemTemplates|knownItemsOnly)\.js$/.test(f) && /register(CustomTemplates|TemplateOverrides)\(/.test(readFileSync(new URL(f, ROOT), 'utf8').replace(/^export function .*$/gm, '')));
  const missing = callers.filter((f) => !f.endsWith('rriInstall.js') && !door.includes(`'../${f.replace(/^src\/systems\//, '')}'`));
  assert.deepEqual(missing, [], 'a registering module the copy door does not load: its pieces would read as unknown and be dropped');
});
