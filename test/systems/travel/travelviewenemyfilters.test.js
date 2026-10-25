// OW-ENEMY-TYPES (a player's ask: "only see packs of wolves"): the creature types under the Overworld's Enemies switch -
// systems/travel/travelViewEnemyFilters.js, markShown's answer for a band or a camp, and the panel's block in
// ui/travel/travelViewHud.js that shows only while Enemies is on.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  enemyCatalogue, enemyTypeShown, toggleEnemyType, setEnemyTypes, travelViewEnemies, onTravelViewEnemies, _resetTravelViewEnemies,
} from '../../../src/systems/travel/travelViewEnemyFilters.js';
import { markShown, toggleTravelViewFilter, travelViewFilters, _resetTravelViewFilters } from '../../../src/systems/travel/travelViewFilters.js';
import { registerEncounterTableSelector, _resetEncounterTableSelectors } from '../../../src/characters/encounterTableDoor.js';
import { enemyDisplayName } from '../../../src/characters/enemy/enemyBasics.js';
import { groupCamps } from '../../../src/world/campShared.js';
import { createTravelView } from '../../../src/scenes/travelView.js';
import { forwardOf, TV_RISE_S } from '../../../src/player/travelCamera.js';

const reset = () => { _resetTravelViewEnemies(); _resetTravelViewFilters(); _resetEncounterTableSelectors(); };
const rd = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');
const band = (foe, extra = {}) => ({ key: `band:${foe}`, kind: 'band', foe, label: 'x', ...extra });

test('OW-ENEMY-TYPES catalogue: every creature a band or a camp can be, named as the map names it, alphabetical, each once - and a mod\'s table joins it when it registers (mutants: a table left out; the mod\'s never read; the list kept past a registration)', () => {
  reset();
  const types = enemyCatalogue();
  assert.ok(types.length >= 40, `the creatures: ${types.length}`);
  assert.equal(new Set(types.map((t) => t.key)).size, types.length, 'each once');
  assert.deepEqual(types.map((t) => t.label), [...types.map((t) => t.label)].sort((a, b) => a.localeCompare(b)), 'alphabetical');
  const named = (id) => types.find((t) => t.key === String(id));
  for (const id of [0, 6, 9, 128]) assert.equal(named(id)?.label, enemyDisplayName(id), `${id}: ${enemyDisplayName(id)}`);
  assert.equal(named(39), undefined, 'a creature no table rolls is not offered');
  // a mod writes a table with a creature DFU's tables never roll
  registerEncounterTableSelector({ table: () => null, choices: () => [[39, 6, 7]] });
  assert.equal(enemyCatalogue().find((t) => t.key === '39')?.label, enemyDisplayName(39), 'the mod\'s creature is offered');
  reset();
});

test('OW-ENEMY-TYPES law: a group is drawn while its creature is on - the switch off hides all of them, a chase and a mark with no creature are never filtered (mutants: the default off; a chase filtered; the type compared as a number to a string)', () => {
  reset();
  assert.equal(markShown(band(9)), true, 'by default every creature');
  assert.equal(toggleEnemyType('9'), false, 'the werewolf off');
  assert.equal(enemyTypeShown(9), false);
  assert.equal(enemyTypeShown('9'), false);
  assert.equal(markShown(band(9)), false, 'a werewolf band');
  assert.equal(markShown({ kind: 'camp', foe: 9, label: 'Werewolf camp, 4' }), false, 'a werewolf camp');
  assert.equal(markShown(band(6)), true, 'a spider band untouched');
  assert.equal(markShown({ kind: 'band chase', foe: 9 }), true, 'a band chasing me is never filtered');
  assert.equal(markShown({ kind: 'raider ship' }), true, 'a mark with no creature is never filtered');
  assert.equal(markShown({ kind: 'place', foe: 9 }), true, 'the filter is the Enemies\' alone');
  assert.equal(toggleEnemyType('9'), true, 'and on again');
  assert.equal(markShown(band(9)), true);
  // the Enemies switch still hides them all
  toggleTravelViewFilter('enemies');
  assert.equal(markShown(band(6)), false);
  reset();
});

test('OW-ENEMY-TYPES law: All and None switch the whole list; the store tells its listeners until they stop (mutants: None leaves one; a listener told after stopping)', () => {
  reset();
  let told = 0;
  const stop = onTravelViewEnemies(() => { told++; });
  setEnemyTypes(false);
  assert.ok(enemyCatalogue().every((t) => !enemyTypeShown(t.key)), 'none');
  assert.equal(markShown(band(0)), false);
  setEnemyTypes(true);
  assert.deepEqual(travelViewEnemies().hidden, [], 'all');
  assert.equal(told, 2);
  stop();
  toggleEnemyType('0');
  assert.equal(told, 2);
  reset();
});

test('OW-ENEMY-TYPES camps and bands carry their creature: groupCamps keeps the first member\'s type, and the marks name it as `foe` - never a rite\'s (by source; mutants: the type dropped; a rite filtered)', () => {
  const g = groupCamps([{ camp: 'me:1', kind: 'pack', type: 3, feet: [0, 0, 0] }, { camp: 'me:1', kind: 'pack', type: 7, feet: [1, 0, 0] }], () => 'Wolf');
  assert.equal(g[0].type, 3, 'the label\'s own creature');
  const src = rd('src/scenes/travelViewMarks.js');
  assert.match(src, /kind: chasing \? 'band chase' : 'band', foe: mk\.mobileTypes\[0\]/, 'a band: its first member, the creature its label names');
  assert.match(src, /kind: 'camp', foe: c\.kind === 'rite' \? undefined : c\.type/, 'a camp: its type, a rite\'s faithful none');
  assert.match(rd('src/systems/travel/travelViewFilters.js'), /g === 'enemies' && !enemyTypeShown\(m\?\.foe\)/, 'markShown asks it');
});

function fakeDoc() {
  const win = { devicePixelRatio: 1, innerWidth: 1200, innerHeight: 800, addEventListener() {}, removeEventListener() {} };
  const doc = { defaultView: win, fonts: null };
  const mk = (tag) => {
    const n = {
      tagName: tag.toUpperCase(), className: '', textContent: '', id: '', children: [], style: { setProperty() {} }, ownerDocument: doc, dataset: {},
      attrs: {}, setAttribute(k, v) { this.attrs[k] = v; }, getAttribute(k) { return this.attrs[k]; },
      append(...c) { this.children.push(...c); }, replaceChildren(...c) { this.children = c; }, remove() {}, addEventListener() {}, isConnected: true,
      contains(x) { return x === this || this.children.some((c) => c.contains?.(x)); },
      width: 0, height: 0, getBoundingClientRect() { return { width: 120, height: 40 }; },
    };
    if (tag === 'canvas') n.getContext = () => new Proxy({}, { get: (t, k) => (k in t ? t[k] : k === 'measureText' ? () => ({ width: 10 }) : k === 'createLinearGradient' ? () => ({ addColorStop() {} }) : () => {}), set: (t, k, v) => { t[k] = v; return true; } });
    return n;
  };
  Object.assign(doc, { createElement: mk, createElementNS: (_, tag) => mk(tag), getElementById: () => null, head: mk('head'), body: mk('body') });
  const find = (cls, n = doc.body) => (String(n.className).split(' ').includes(cls) ? n : (n.children ?? []).map((c) => find(cls, c)).find(Boolean) ?? null);
  const all = (pred, n = doc.body) => [...(pred(n) ? [n] : []), ...(n.children ?? []).flatMap((c) => all(pred, c))];
  return { doc, find, all };
}

test('OW-ENEMY-TYPES panel: the block stands under the filters and shows only while Enemies is on; its fold opens onto the creatures and counts them; a press is the store\'s (mutants: shown with Enemies off; a creature\'s button that flips another; None that leaves the count)', async () => {
  reset();
  const hud = await import('../../../src/ui/travel/travelViewHud.js');
  const P = fakeDoc();
  hud.showTravelViewHud({}, P.doc);
  try {
    const box = P.find('tview-enemies');
    assert.ok(box, 'the block is in the filters');
    assert.notEqual(box.style.display, 'none', 'Enemies is on: shown');
    toggleTravelViewFilter('enemies');
    assert.equal(travelViewFilters().enemies, false);
    assert.equal(box.style.display, 'none', 'Enemies off: the creatures go with it');
    toggleTravelViewFilter('enemies');
    assert.equal(box.style.display, '', 'and come back');
    const total = enemyCatalogue().length;
    const head = box.children.find((c) => String(c.className).includes('tview-enemies-head'));
    const list = box.children.find((c) => c.className === 'tview-enemies-list');
    assert.equal(head.textContent, `▸ Creatures ${total}/${total}`);
    assert.equal(list.style.display, 'none', 'a fold starts shut');
    head.onclick({ preventDefault() {} });
    assert.equal(list.style.display, '', 'opened');
    assert.equal(list.children.length, total + 2, 'All, None and a button a creature');
    const wolfLike = P.all((n) => n.dataset?.etype === '9')[0];
    assert.equal(wolfLike.textContent, enemyDisplayName(9));
    wolfLike.onclick({ preventDefault() {} });
    assert.deepEqual(travelViewEnemies().hidden, ['9'], 'only that creature');
    assert.doesNotMatch(wolfLike.className, /\bon\b/, 'unlit');
    assert.equal(head.textContent, `▾ Creatures ${total - 1}/${total}`);
    list.children[1].onclick({ preventDefault() {} });   // None
    assert.equal(head.textContent, `▾ Creatures 0/${total}`);
    list.children[0].onclick({ preventDefault() {} });   // All
    assert.equal(head.textContent, `▾ Creatures ${total}/${total}`);
    // a mod registers a table: its creature is offered at the next paint
    registerEncounterTableSelector({ table: () => null, choices: () => [[39, 6]] });
    toggleEnemyType('6'); toggleEnemyType('6');
    assert.equal(list.children.length, enemyCatalogue().length + 2, 'the list was made again');
    assert.ok(P.all((n) => n.dataset?.etype === '39').length === 1, 'the mod\'s creature has its button');
  } finally { hud.disposeTravelViewHud(); reset(); }
});

test('OW-ENEMY-TYPES reaches the readout: the travel view\'s own copy of the marks carries `foe` - it was dropped there, and no creature was ever filtered (mutant: the field left out of the copy)', () => {
  reset();
  let seen = null;
  const tv = createTravelView({
    canvas: {}, win: { addEventListener() {}, removeEventListener() {} },
    feet: () => [0, 0, 0], headView: () => ({ eye: [0, 1.7, 0], fwd: forwardOf(0, 0) }),
    yaw: () => 0, setYaw: () => {}, heightAt: () => 0, cloudBase: () => null,
    allowed: () => ({ ok: true }), windowUp: () => false, actionsOf: () => [],
    project: (p) => ({ x: 100 + p[0], y: 100 - p[2], front: true }),
    marks: () => [{ key: 'band:1', at: [5, 2, 5], label: 'Wolf, 3', kind: 'band', foe: 9 }, { key: 'band:2', at: [6, 2, 6], label: 'Rat', kind: 'band' }],
    hud: { show() {}, hide() {}, update: (f) => { seen = f; } },
    schedule: () => null, cancel: () => {},
  });
  tv.enter();
  for (let i = 0; i < 90; i++) tv.frame(TV_RISE_S / 60);
  tv.drawHud();
  assert.equal(seen.marks[0].foe, 9, 'the creature rides to the readout');
  assert.equal('foe' in seen.marks[1], false, 'a mark with none carries none');
  toggleEnemyType('9');
  assert.deepEqual(seen.marks.filter((m) => markShown(m)).map((m) => m.key), ['band:2'], 'and the filter reads it there');
  reset();
});

test('OW-ENEMY-TYPES the world\'s band sprites answer the creature too: a band of a switched-off creature is not stood as sprites (by source)', () => {
  assert.match(rd('src/scenes/world.js'), /if \(!mk\?\.mobileTypes\?\.length \|\| !markShown\(\{ kind: chasing \? 'band chase' : 'band', foe: mk\.mobileTypes\[0\] \}\)\) continue;/);
});
