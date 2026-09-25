// UXB1-N / UXB1-O (2026-09-25, the UX backlog: "If trivial, highlight private property titles with a different color
// to distinguish them from shop items for quick readability" and "If trivial, flag objects with generated loot since
// sometimes there can be tons in a scene and 'your character' would know which ones have open lids").
//
// World Tooltips names a Chest a Chest whoever owns it, so in a shop the owner's furniture read exactly like the
// stock beside it - and only the furniture is somebody's private property (PlayerActivate asks before it opens,
// :902-925). And a house full of drawers gave no sign of which ones this character had already been through. The
// plaque now carries a TONE (the title's colour) and says both on its sub-lines; the searched lid is stamped with the
// stock's own day and shut again by the daily restock.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { houseContainerHover, PRIVATE_PROPERTY_SUB, SEARCHED_SUB, PRIVATE_TONE } from '../src/systems/worldTooltips.js';
import { stockSearched, needsRestock } from '../src/systems/shopStock.js';
import { resolveHover, frameSignature } from '../src/systems/worldHover.js';
import { showWorldPlaque, destroyWorldPlaque } from '../src/ui/worldPlaque.js';
import { ENHANCED_CSS } from '../src/ui/enhancedStyle.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const hit = (key) => ({ key, distance: 1, reach: 3.2 });

test('UXB1-N/O: a house container\'s plaque - the owner\'s says only its word; anyone else\'s is private property, in its own tone, and says when it was searched', () => {
  assert.deepEqual(houseContainerHover('Chest', { owned: true, searched: true }), { title: 'Chest' }, 'your own storage says neither');
  assert.deepEqual(houseContainerHover('Chest'), { title: 'Chest', subs: [PRIVATE_PROPERTY_SUB], tone: PRIVATE_TONE });
  assert.deepEqual(houseContainerHover('Dresser', { searched: true }), { title: 'Dresser', subs: [PRIVATE_PROPERTY_SUB, SEARCHED_SUB], tone: PRIVATE_TONE });
  assert.equal(houseContainerHover(null), null, 'a container the ladder has no word for draws nothing, as before');
  assert.equal(PRIVATE_PROPERTY_SUB, 'Private property');
  assert.equal(SEARCHED_SUB, 'Searched');
});

test('UXB1-O: searched is THIS stock seen - opened on the day it was rolled, and neither rolled again since nor due to be', () => {
  const today = 2026001;
  assert.equal(stockSearched({ stockedDate: today, openedOn: today }, today), true);
  assert.equal(stockSearched({ stockedDate: today, openedOn: 0 }, today), false, 'never opened');
  assert.equal(stockSearched({ stockedDate: today }, today), false, 'a record from before the stamp');
  assert.equal(stockSearched({ stockedDate: today - 1, openedOn: today - 1 }, today), false, 'yesterday\'s stock is due a restock - the lid shuts with the new day');
  assert.equal(needsRestock({ stockedDate: today - 1 }, today), true, '(the same comparison the restock itself makes)');
  assert.equal(stockSearched({ stockedDate: today, openedOn: today - 1 }, today), false, 'restocked since it was opened: a new drawer');
  assert.equal(stockSearched(null, today), false);
});

test('UXB1-N: the frame carries a namer\'s tone - and only a namer that says one - and a tone that changes repaints', () => {
  const plain = resolveHover(hit('container:1'), { name: () => ({ title: 'Chest' }) });
  assert.equal('tone' in plain, false, 'every other frame keeps its shape');
  const priv = resolveHover(hit('container:1'), { name: () => houseContainerHover('Chest') });
  assert.equal(priv.tone, PRIVATE_TONE);
  assert.deepEqual(priv.subs, [PRIVATE_PROPERTY_SUB]);
  const same = { ...priv, subs: [...priv.subs] };
  delete same.tone;
  assert.notEqual(frameSignature(priv), frameSignature(same), 'the repaint guard sees the tone');
  assert.equal(frameSignature(plain), 'container:1|name||Chest|||0|', 'a toneless frame\'s signature is what it was (RENOWN1\'s empty Renown slot beside the kind)');
});

function fakeEl(tag, body) {
  const classes = new Set();
  const n = {
    tag, children: [], dataset: {}, attrs: {}, style: { setProperty() {} },
    classList: {
      add: (...c) => c.forEach((x) => classes.add(x)), remove: (...c) => c.forEach((x) => classes.delete(x)),
      toggle: (c, on) => (on ? classes.add(c) : classes.delete(c)), contains: (c) => classes.has(c),
    },
    get className() { return [...classes].join(' '); },
    set className(v) { classes.clear(); String(v).split(/\s+/).filter(Boolean).forEach((x) => classes.add(x)); },
    get textContent() { return n.children.map((c) => c.textContent ?? '').join(''); },
    set textContent(v) { n.children.length = 0; if (v) n.children.push({ textContent: v, children: [] }); },
    append(...cs) { for (const c of cs) n.children.push(c); },
    setAttribute(k, v) { n.attrs[k] = v; },
    remove() { const i = body.indexOf(n); if (i >= 0) body.splice(i, 1); },
  };
  return n;
}

test('UXB1-N: the plaque wears the tone - somebody else\'s container in its own colour, the next plain frame without it', () => {
  const body = [];
  const made = [];
  globalThis.document = {
    createElement: (t) => { const e = fakeEl(t, body); made.push(e); return e; },
    body: { append: (...cs) => body.push(...cs) }, head: { append() {}, appendChild() {}, querySelector: () => null },
    querySelector: () => null, getElementById: () => null,
  };
  globalThis.location = { search: '?skin=enhanced&touch=off' };
  globalThis.window = { location: globalThis.location, matchMedia: () => ({ matches: false }) };
  destroyWorldPlaque();
  try {
    showWorldPlaque(resolveHover(hit('container:1'), { name: () => houseContainerHover('Chest', { searched: true }) }));
    const root = made.find((e) => e.classList.contains('wplaque'));
    assert.ok(root.classList.contains('tone-private'), 'the private tone is on the plaque');
    const subs = root.children.filter((c) => c.classList?.contains('wplaque-sub')).map((c) => c.textContent);
    assert.deepEqual(subs, [PRIVATE_PROPERTY_SUB, SEARCHED_SUB]);
    showWorldPlaque(resolveHover(hit('shelf:1'), { name: () => ({ title: 'Shop Shelf' }) }));
    assert.equal(root.classList.contains('tone-private'), false, 'the shop\'s shelf beside it is not private property');
  } finally {
    destroyWorldPlaque();
    delete globalThis.document; delete globalThis.window; delete globalThis.location;
  }
  // the colour is its own: not the plain title's
  const plainTitle = ENHANCED_CSS.match(/\.wplaque-title \{[^}]*color: (#[0-9a-f]{6});/)[1];
  const privTitle = ENHANCED_CSS.match(/\.wplaque\.tone-private \.wplaque-title \{ color: (#[0-9a-f]{6}); \}/)[1];
  assert.notEqual(privTitle, plainTitle);
});

test('UXB1-N/O: the interior host names by the ONE ownership predicate the press uses, stamps the lid when a stranger\'s window opens, and carries it in the scene cache', () => {
  const wm = read('src/scenes/worldModes.js');
  assert.match(wm, /return houseContainerHover\(t, \{ owned: ownsThisInterior\(b\), searched: stockSearched\(c, stockedToday\(\)\) \}\);/, 'the plaque');
  assert.match(wm, /const owned = ownsThisInterior\(b\);/, 'the press');
  assert.equal((wm.match(/ownsShip\(playerEntity\)\)\n\s+\|\| \(interiorHome && b === interiorBuilding \? interiorHome\.own : isHouseOwned\(playerEntity\.houses/g) ?? []).length, 1, 'and the predicate is written once (HOME1: it knows the online home)');
  assert.match(wm, /if \(win && privateProperty\) c\.openedOn = c\.stockedDate;/, 'a stranger\'s container, opened: this stock is seen');
  assert.match(wm, /openedOn: c\.openedOn \?\? 0,/, 'the scene cache carries it out of the door');
  assert.match(wm, /if \(target && kind === 'container'\) target\.openedOn = c\.openedOn \?\? 0;/, '...and back in');
});
