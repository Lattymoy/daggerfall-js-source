// OW-GATHER-TYPES (a player's ask: "gatherable by me", and "only show silver veins / only oak and ebony"): the
// Gathering refinements under the Overworld's Gathering switch - systems/travel/travelViewGatherFilters.js, and the
// panel's block in ui/travel/travelViewHud.js that shows only while Gathering is on.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  gatherSections, gatherTypeKey, gatherTypeShown, gatherNodeShown, travelViewGather, toggleGatherMine, toggleGatherType, setGatherSection,
  onTravelViewGather, _resetTravelViewGather, TV_GATHER_TEXT,
} from '../../../src/systems/travel/travelViewGatherFilters.js';
import { _resetTravelViewFilters, toggleTravelViewFilter, travelViewFilters } from '../../../src/systems/travel/travelViewFilters.js';
import { TIER_RANKS } from '../../../src/net/professionLaw.js';

const reset = () => { _resetTravelViewGather(); _resetTravelViewFilters(); };
const ebony = { kind: 'vein', what: 'vein', material: 'ore:ebony', tier: 6 };
const iron = { what: 'vein', material: 'metal:iron', tier: 1 };
const silver = { what: 'vein', material: 'metal:silver', tier: 3 };
const boulder = { what: 'boulder', material: 'stone:granite', tier: 1 };
const oak = { what: 'tree', material: 'log:oak', tier: 2 };
const herb = { herb: 8, tier: 1 };

test('OW-GATHER-TYPES key: a node is its kind and what it is - a vein its ore (surface or deep alike), the stone and a motherlode their own, a tree its wood, a patch its herb; a kind it does not know has none (mutants: the ore dropped from the key; a boulder keyed by its stone)', () => {
  assert.equal(gatherTypeKey('mine', ebony), 'mine:ore:ebony');
  assert.equal(gatherTypeKey('mine', { what: 'dvein', material: 'metal:silver' }), 'mine:metal:silver', 'a deep vein is its ore\'s type too');
  assert.equal(gatherTypeKey('mine', boulder), 'mine:boulder');
  assert.equal(gatherTypeKey('mine', { what: 'motherlode', material: 'ore:ebony' }), 'mine:motherlode');
  assert.equal(gatherTypeKey('tree', oak), 'tree:log:oak');
  assert.equal(gatherTypeKey('herb', herb), 'herb:8');
  assert.equal(gatherTypeKey('body', { foe: 3 }), null, 'hunting\'s bodies are never filtered');
  assert.equal(gatherTypeKey('mine', null), null);
  assert.equal(gatherTypeKey('herb', { herb: 'x' }), null);
});

test('OW-GATHER-TYPES catalogue: every type a player can pick is one the ground stands - the surface and deep ores, the stone, a motherlode, the seven woods, the herbs; each key once, each with words (mutants: a table left out; a duplicate key)', () => {
  const secs = gatherSections();
  assert.deepEqual(secs.map((s) => s.kind), ['mine', 'tree', 'herb']);
  const keys = secs.flatMap((s) => s.types.map((t) => t.key));
  assert.equal(new Set(keys).size, keys.length, 'no key twice');
  assert.ok(secs.flatMap((s) => s.types).every((t) => t.label && t.label.trim() === t.label), 'every type has its words');
  const mining = secs[0].types.map((t) => t.key);
  for (const k of ['mine:metal:iron', 'mine:metal:silver', 'mine:ore:ebony', 'mine:ore:adamantium', 'mine:boulder', 'mine:motherlode']) assert.ok(mining.includes(k), k);
  assert.equal(secs[0].types.find((t) => t.key === 'mine:ore:ebony').label, 'Ebony');
  assert.ok(mining.indexOf('mine:metal:iron') < mining.indexOf('mine:ore:ebony'), 'lowest tier first');
  assert.deepEqual(secs[1].types.map((t) => t.label), ['Pine', 'Oak', 'Cherry', 'Teak', 'Mahogany', 'Ironwood', 'Ghostwood']);
  assert.ok(secs[2].types.length >= 10, 'the herbs the climates grow');
  // every node the law can stand has a type the catalogue offers
  for (const n of [iron, silver, ebony, oak]) assert.ok(keys.includes(gatherTypeKey(n.what === 'tree' ? 'tree' : 'mine', n)), n.material);
});

test('OW-GATHER-TYPES law: everything shows by default; a type switched off hides its nodes and only those; a type the list never named stays shown (mutants: the default off; the hidden list read as the shown one)', () => {
  reset();
  for (const [kind, n] of [['mine', ebony], ['mine', boulder], ['tree', oak], ['herb', herb], ['body', {}]]) assert.equal(gatherNodeShown(kind, n, 0), true, `${kind} by default`);
  assert.equal(toggleGatherType('mine:ore:ebony'), false, 'switched off');
  assert.equal(gatherTypeShown('mine:ore:ebony'), false);
  assert.equal(gatherNodeShown('mine', ebony, 100), false, 'ebony hidden whatever my rank');
  assert.equal(gatherNodeShown('mine', silver, 100), true, 'silver untouched');
  assert.equal(gatherNodeShown('tree', oak, 100), true, 'the woods untouched');
  assert.equal(toggleGatherType('mine:ore:ebony'), true, 'and on again');
  assert.equal(gatherNodeShown('mine', ebony, 100), true);
  reset();
});

test('OW-GATHER-TYPES law: "Workable by me" hides what my rank cannot work - tier by tier at professionLaw\'s ranks, the stone at any rank, a node with no tier left alone (mutants: the rank off by a tier; a rank compared as a tier; the switch ignored)', () => {
  reset();
  assert.equal(gatherNodeShown('mine', ebony, 0), true, 'off: every node, whatever the rank');
  assert.equal(toggleGatherMine(), true);
  assert.equal(TIER_RANKS[5], 70, 'ebony\'s tier is the rank the player named');
  assert.equal(gatherNodeShown('mine', ebony, 69), false, 'rank 69: not yet');
  assert.equal(gatherNodeShown('mine', ebony, 70), true, 'rank 70: workable');
  assert.equal(gatherNodeShown('mine', silver, TIER_RANKS[2] - 1), false);
  assert.equal(gatherNodeShown('mine', silver, TIER_RANKS[2]), true);
  assert.equal(gatherNodeShown('mine', iron, 0), true, 'tier 1 from the start');
  assert.equal(gatherNodeShown('mine', boulder, 0), true);
  assert.equal(gatherNodeShown('tree', oak, TIER_RANKS[1] - 1), false, 'a tree answers its own profession\'s rank');
  assert.equal(gatherNodeShown('tree', oak, TIER_RANKS[1]), true);
  assert.equal(gatherNodeShown('mine', { what: 'vein', material: 'metal:iron' }, 0), true, 'no tier: not judged');
  // the two refinements together: workable AND not hidden
  toggleGatherType('mine:metal:iron');
  assert.equal(gatherNodeShown('mine', iron, 100), false, 'workable but hidden');
  reset();
});

test('OW-GATHER-TYPES sections: All and None switch a profession\'s types at once and leave the others alone (mutants: None hides every profession; All forgets the section)', () => {
  reset();
  toggleGatherType('tree:log:oak');
  setGatherSection('mine', false);
  const mining = gatherSections()[0].types, woods = gatherSections()[1].types;
  assert.ok(mining.every((t) => !gatherTypeShown(t.key)), 'mining: none');
  assert.ok(gatherTypeShown('tree:log:pine'), 'logging: as it was');
  assert.ok(!gatherTypeShown('tree:log:oak'), '...and the oak still off');
  setGatherSection('mine', true);
  assert.ok(mining.every((t) => gatherTypeShown(t.key)), 'mining: all');
  setGatherSection('tree', true);
  assert.ok(woods.every((t) => gatherTypeShown(t.key)), 'logging: all');
  assert.equal(setGatherSection('nothing', false), travelViewGather(), 'no such section: nothing changes');
  reset();
});

test('OW-GATHER-TYPES store: a change is told to whoever listens until they stop, and is kept on the device - a bad word reads as the defaults (mutants: never told; told after stopping)', () => {
  reset();
  let told = 0;
  const stop = onTravelViewGather(() => { told++; });
  toggleGatherMine(); toggleGatherType('herb:8');
  assert.equal(told, 2);
  stop();
  toggleGatherMine();
  assert.equal(told, 2, 'a listener that stopped hears nothing');
  const kept = JSON.parse(globalThis.localStorage?.getItem?.('dfjs.overworld.gather') ?? 'null');
  if (kept) assert.deepEqual(kept.hidden, ['herb:8']);
  reset();
});

// ── the panel ───────────────────────────────────────────────────

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

test('OW-GATHER-TYPES panel: the block stands under the filters and shows only while Gathering is on; its presses are the store\'s; a fold opens onto its types and says how many are shown (mutants: shown with Gathering off; a type button that flips another; a fold that never opens)', async () => {
  reset();
  const hud = await import('../../../src/ui/travel/travelViewHud.js');
  const P = fakeDoc();
  hud.showTravelViewHud({}, P.doc);
  try {
    const box = P.find('tview-gather');
    assert.ok(box, 'the block is in the filters');
    assert.notEqual(box.style.display, 'none', 'Gathering is on: shown');
    toggleTravelViewFilter('gathering');
    assert.equal(travelViewFilters().gathering, false);
    assert.equal(box.style.display, 'none', 'Gathering off: the refinements go with it');
    toggleTravelViewFilter('gathering');
    assert.equal(box.style.display, '', 'and come back');
    // Workable by me
    const mine = box.children.find((c) => c.textContent === TV_GATHER_TEXT.mine);
    assert.ok(mine);
    mine.onclick({ preventDefault() {} });
    assert.equal(travelViewGather().mine, true);
    assert.match(mine.className, /\bon\b/, 'lit');
    // the folds
    const heads = box.children.filter((c) => String(c.className).includes('tview-gather-head'));
    assert.equal(heads.length, 3);
    const total = gatherSections()[0].types.length;
    assert.equal(heads[0].textContent, `▸ Mining ${total}/${total}`);
    const lists = box.children.filter((c) => c.className === 'tview-gather-list');
    assert.equal(lists[0].style.display, 'none', 'a fold starts shut');
    heads[0].onclick({ preventDefault() {} });
    assert.equal(lists[0].style.display, '', 'opened');
    assert.match(heads[0].textContent, /^▾ Mining/);
    // one type
    const ebonyBtn = P.all((n) => n.dataset?.gtype === 'mine:ore:ebony')[0];
    assert.equal(ebonyBtn.textContent, 'Ebony');
    ebonyBtn.onclick({ preventDefault() {} });
    assert.deepEqual(travelViewGather().hidden, ['mine:ore:ebony'], 'only the ebony');
    assert.doesNotMatch(ebonyBtn.className, /\bon\b/, 'unlit');
    assert.equal(heads[0].textContent, `▾ Mining ${total - 1}/${total}`);
    // None of a section
    lists[1].children[1].onclick({ preventDefault() {} });   // logging's None
    assert.ok(gatherSections()[1].types.every((t) => !gatherTypeShown(t.key)));
    assert.equal(heads[1].textContent, '▸ Logging 0/7');
  } finally { hud.disposeTravelViewHud(); reset(); }
});
