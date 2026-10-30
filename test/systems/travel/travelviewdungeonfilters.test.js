// OW-DUNGEON-TYPES (a player's ask: "dungeons separated into regular and elite - show one of the two or both"): the tiers and sizes of FOUND
// dungeons under the Overworld's Dungeons switch - systems/travel/travelViewDungeonFilters.js, markShown's answer, the marks' fields
// (scenes/travelViewMarks.js, carried through scenes/travelView.js) and the panel's block in ui/travel/travelViewHud.js.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  dungeonTypeShown, toggleDungeonTier, toggleDungeonSize, travelViewDungeons, onTravelViewDungeons, _resetTravelViewDungeons, dungeonTierRows, dungeonSizeRows,
} from '../../../src/systems/travel/travelViewDungeonFilters.js';
import { markShown, toggleTravelViewFilter, travelViewFilters, _resetTravelViewFilters } from '../../../src/systems/travel/travelViewFilters.js';
import { DUNGEON_TIERS } from '../../../src/systems/dungeon/dungeonTier.js';
import { createTravelView } from '../../../src/scenes/travelView.js';
import { forwardOf, TV_RISE_S } from '../../../src/player/travelCamera.js';

const reset = () => { _resetTravelViewDungeons(); _resetTravelViewFilters(); };
const rd = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');
const found = (dtier, dsize, kind = 'place dungeon') => ({ key: `d:${dtier}${dsize}`, kind, label: 'x', dtier, dsize });


test('OW-DUNGEON-TYPES law: a found dungeon is drawn while its tier AND its size are on - Regular, Elite and Abyss are the ladder\'s own three, a dungeon of unknown size is never hidden by size (mutants: the default off; a tier read as a size; the three tiers not the ladder\'s)', () => {
  reset();
  assert.deepEqual(dungeonTierRows().map(([k]) => k), [...DUNGEON_TIERS], 'the switches list the ladder\'s tiers');
  assert.deepEqual(dungeonSizeRows().map(([k]) => k), ['small', 'medium', 'large']);
  assert.equal(dungeonTypeShown('regular', 'large'), true, 'by default everything');
  assert.equal(toggleDungeonTier('elite'), false, 'Elite off');
  assert.equal(dungeonTypeShown('elite', 'small'), false);
  assert.equal(dungeonTypeShown('regular', 'small'), true);
  assert.equal(toggleDungeonSize('large'), false, 'Large off');
  assert.equal(dungeonTypeShown('regular', 'large'), false, 'a regular large one: its size is off');
  assert.equal(dungeonTypeShown('regular', null), true, 'a size not known is not judged');
  assert.equal(dungeonTypeShown(null, null), true, 'a mark with neither is not judged');
  assert.deepEqual(travelViewDungeons().tiers, ['elite']);
  assert.equal(toggleDungeonTier('elite'), true, 'and on again');
  assert.equal(dungeonTypeShown('elite', 'small'), true);
  let told = 0;
  const stop = onTravelViewDungeons(() => { told++; });
  toggleDungeonSize('large'); stop(); toggleDungeonSize('large');
  assert.equal(told, 1);
  reset();
});

test('OW-DUNGEON-TYPES marks: only a FOUND dungeon is judged - a lair ("?") carries neither field and stays the Dungeons switch\'s alone; the far and the near found ones answer alike; the switch off still hides all (mutants: a lair hidden with the elites; a far dungeon unjudged)', () => {
  reset();
  const lair = { key: 'lair:1', kind: 'lair', label: '?' };
  toggleDungeonTier('elite');
  assert.equal(markShown(found('elite', 'small')), false, 'an elite found one near');
  assert.equal(markShown(found('elite', 'large', 'far dungeon')), false, 'and far');
  assert.equal(markShown(found('regular', 'small')), true);
  assert.equal(markShown(found('regular', 'large', 'far dungeon')), true);
  assert.equal(markShown(lair), true, 'an unfound lair is not judged by tier');
  assert.equal(markShown({ kind: 'place', label: 'Daggerfall', dtier: 'elite' }), true, 'only the Dungeons group');
  toggleTravelViewFilter('dungeons');
  assert.equal(markShown(lair), false, 'the Dungeons switch off hides the lairs too');
  assert.equal(markShown(found('regular', 'small')), false);
  reset();
});

test('OW-DUNGEON-TYPES the marks carry their tier and size: the producers set them on found dungeons only, and the travel view\'s copy of the marks keeps them (by source, and through the real view; mutants: the field dropped in the copy)', () => {
  const src = rd('src/scenes/travelViewMarks.js');
  assert.match(src, /kind: isDungeon \? 'place dungeon' : 'place', \.\.\.\(isDungeon && dl \? \{ dtier: dl\.tier, dsize: dl\.size\?\.toLowerCase\(\) \?\? null \} : \{\}\)/, 'a found dungeon in the grid');
  assert.match(src, /kind: 'far dungeon', \.\.\.\(dl \? \{ dtier: dl\.tier, dsize: dl\.size\?\.toLowerCase\(\) \?\? null \} : \{\}\)/, 'a found dungeon past it');
  assert.doesNotMatch(src, /kind: 'lair'[^\n]*dtier/, 'a lair has none');
  reset();
  let seen = null;
  const tv = createTravelView({
    canvas: {}, win: { addEventListener() {}, removeEventListener() {} },
    feet: () => [0, 0, 0], headView: () => ({ eye: [0, 1.7, 0], fwd: forwardOf(0, 0) }),
    yaw: () => 0, setYaw: () => {}, heightAt: () => 0, cloudBase: () => null,
    allowed: () => ({ ok: true }), windowUp: () => false, actionsOf: () => [],
    project: (p) => ({ x: 100 + p[0], y: 100 - p[2], front: true }),
    marks: () => [{ key: 'd:1', at: [5, 2, 5], label: 'The Circle of Stallthia', kind: 'place dungeon', dtier: 'regular', dsize: 'large' }, { key: 'lair:1', at: [6, 2, 6], label: '?', kind: 'lair' }],
    hud: { show() {}, hide() {}, update: (f) => { seen = f; } },
    schedule: () => null, cancel: () => {},
  });
  tv.enter();
  for (let i = 0; i < 90; i++) tv.frame(TV_RISE_S / 60);
  tv.drawHud();
  assert.equal(seen.marks[0].dtier, 'regular');
  assert.equal(seen.marks[0].dsize, 'large');
  assert.equal('dtier' in seen.marks[1], false, 'a lair carries none');
  toggleDungeonSize('large');
  assert.deepEqual(seen.marks.filter((m) => markShown(m)).map((m) => m.key), ['lair:1'], 'and the filter reads them there');
  reset();
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

test('OW-DUNGEON-TYPES panel: the block stands under the filters and shows only while Dungeons is on; its switches are the store\'s and light while shown (mutants: shown with Dungeons off; a size switch that flips a tier)', async () => {
  reset();
  const hud = await import('../../../src/ui/travel/travelViewHud.js');
  const P = fakeDoc();
  hud.showTravelViewHud({}, P.doc);
  try {
    const box = P.find('tview-dungeons');
    assert.ok(box, 'the block is in the filters');
    assert.notEqual(box.style.display, 'none', 'Dungeons is on: shown');
    toggleTravelViewFilter('dungeons');
    assert.equal(travelViewFilters().dungeons, false);
    assert.equal(box.style.display, 'none', 'Dungeons off: the types go with it');
    toggleTravelViewFilter('dungeons');
    assert.equal(box.style.display, '', 'and come back');
    const btn = (id) => P.all((n) => n.dataset?.dtype === id)[0];
    assert.deepEqual(['tier:regular', 'tier:elite', 'tier:super', 'size:small', 'size:medium', 'size:large'].map((id) => btn(id).textContent), ['Regular', 'Elite', 'Abyss', 'Small', 'Medium', 'Large']);
    assert.match(btn('tier:elite').className, /\bon\b/, 'lit while shown');
    btn('tier:elite').onclick({ preventDefault() {} });
    assert.deepEqual(travelViewDungeons().tiers, ['elite']);
    assert.deepEqual(travelViewDungeons().sizes, [], 'a tier switch is no size switch');
    assert.doesNotMatch(btn('tier:elite').className, /\bon\b/, 'unlit');
    assert.match(btn('tier:regular').className, /\bon\b/);
    btn('size:large').onclick({ preventDefault() {} });
    assert.deepEqual(travelViewDungeons().sizes, ['large']);
    assert.equal(markShown(found('regular', 'large')), false);
  } finally { hud.disposeTravelViewHud(); reset(); }
});
