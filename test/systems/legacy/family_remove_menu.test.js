// FAMILY-REMOVE (FIELD BUGS 2026-10-29b, "being able to remove old families"): the Online page offers every line no living
// realm character plays, and its Remove asks the realm's own route. Mutants: tools/mutants/family_remove.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spareLines } from '../../../src/systems/legacy/waitingHouses.js';
import { realmLineageRemove, realmRefusalText } from '../../../src/systems/realmSaves.js';
import { createRealmLine } from '../../../src/systems/legacy/realmLine.js';

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

test('FAMILY-REMOVE (AUDIT FB1029B F3, F5) the card stands only on a roster the realm answered, and a line the realm no longer holds is said removed', () => {
  const m = src('src/ui/enhanced/enhancedMenu.js');
  assert.match(m, /realmRows = r\.ok \? r\.characters : \[\];\n\s*realmRowsOk = !!r\.ok;/, 'a failed read is no roster');
  assert.match(m, /if \(!realmRows \|\| !realmRowsOk \|\| !realmLineIds\?\.length\) return null;/, 'and lists no line as played by no one');
  assert.match(m, /realmLineageRemove\(realmIoNow\(\), family\.id\)\.then\(\(r\) => \(r\?\.error === 'no-lineage' \? \{ ok: true \} : r\)\)/, 'a line already gone is removed');
});

test('FAMILY-REMOVE (AUDIT FB1029B F2) a line the realm removed is refused once, said once, and never sent again this session', async () => {
  const mem = new Map();
  const storage = { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k) };
  const said = [];
  let puts = 0;
  const line = createRealmLine({ io: () => ({}), storage: () => storage, put: async () => { puts++; return { ok: false, error: 'no-lineage' }; }, onRefused: (id, e) => said.push([id, e]) });
  const family = { v: 1, id: 'fam-a-aaaaaa', surname: 'Hlaalu', model: 'bloodline', rev: 2, people: [{ id: 1 }] };
  await line.push(family);
  assert.equal(await line.flush(), false);
  await line.push({ ...family, rev: 3 });
  await line.flush();
  assert.equal(puts, 1, 'never sent again');
  assert.deepEqual(said, [['fam-a-aaaaaa', 'no-lineage']]);
});
