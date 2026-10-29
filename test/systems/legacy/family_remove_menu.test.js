// FAMILY-REMOVE (FIELD BUGS 2026-10-29b, "being able to remove old families"): the Online page offers every line no living
// realm character plays, and its Remove asks the realm's own route. Mutants: tools/mutants/family_remove.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spareLines } from '../../../src/systems/legacy/waitingHouses.js';
import { realmLineageRemove, realmRefusalText } from '../../../src/systems/realmSaves.js';

const src = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');

test('FAMILY-REMOVE the spare lines: every line the roster does not play - a fallen\'s and a deleted character\'s alike', () => {
  const ids = ['fam-a-aaaaaa', 'fam-b-bbbbbb', 'fam-c-cccccc'];
  assert.deepEqual(spareLines(ids, [{ id: 'r1', lineage: 'fam-b-bbbbbb' }, { id: 'r2', lineage: null }]), ['fam-a-aaaaaa', 'fam-c-cccccc']);
  assert.deepEqual(spareLines(ids, []), ids, 'no characters left: every line is spare');
  assert.deepEqual(spareLines(null, null), []);
});

test('FAMILY-REMOVE the press asks the realm\'s route, and the cap\'s refusal names the way past it', async () => {
  let asked = null;
  const io = { base: 'https://a.invalid', secret: 's', storage: null, fetch: async (url, init) => { asked = { url, body: JSON.parse(init.body) }; return new Response('{"ok":true}', { status: 200, headers: { 'content-type': 'application/json' } }); } };
  assert.equal((await realmLineageRemove(io, 'fam-a-aaaaaa')).ok, true);
  assert.deepEqual(asked, { url: 'https://a.invalid/v1/realm/lineage/remove', body: { id: 'fam-a-aaaaaa' } });
  assert.match(realmRefusalText('too-many-lineages'), /Remove a family you no longer play to make room\./);
  assert.match(src('src/ui/enhanced/enhancedMenu.js'), /realmAct\(\(\) => realmLineageRemove\(realmIoNow\(\), family\.id\)/);
  assert.match(src('src/ui/enhanced/enhancedMenu.js'), /const spare = spareFamiliesCard\(\);\n\s*if \(spare\) box\.append\(spare\);/);
});
