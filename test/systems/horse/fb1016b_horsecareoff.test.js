// FIELD BUGS 2026-10-16b HORSE-CARE-OFF (the Discord: "turning horse care off completely hides my other horses"). The
// Stable page drew every other horse owned - its card, its care, and "Ride this one" - only under a horse care tier: the
// upkeep's model built its list of horses only `if (care)`, and the page's loop read `care?.horseCare`. So Off (and the
// classic skin, where the one accessor answers null) the page drew the ridden horse alone, and no other could be chosen
// - though the choice itself (chooseRiddenHorse) was never the tier's. Now every horse owned has its card and the choice
// on every tier; only the care drops. Driven over the real accessor (systems/upkeep/upkeepSwitch.js horseCareRules, the
// player's own `horseCare` pref and the page's skin), the real upkeep (createUpkeep, as world.js and exterior.js build
// it), the hosts' provider seam (stableProviderFor) and the real page (drawStablePage). bible/06-Systems/Horse-Care.md,
// The Stable page; bible/01-Overview/bugs/Field-Bugs-2026-10-16b.md HORSE-CARE-OFF.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { horseCareRules, HORSE_CARE_PREF } from '../../../src/systems/upkeep/upkeepSwitch.js';
import { setPref, _resetForTests as resetPrefs } from '../../../src/systems/uiPrefs.js';
import { createUpkeep } from '../../../src/systems/upkeep/upkeepRuntime.js';
import { OATS_TEMPLATE } from '../../../src/systems/steedCare.js';
import { activeHorseItem, birthHorses, describeHorseLook, horseLookOf } from '../../../src/systems/horse/horseCoats.js';

globalThis.document = undefined;
const { drawStablePage, stableProviderFor, setHoldingsProvider, resetHoldingsPages, _setHoldingsIconForTests } = await import('../../../src/ui/holdingsPages.js');
_setHoldingsIconForTests(() => ({ src: 'data:x', w: 30, h: 30 }));

const T0 = 2_000_000;
const seeded = (s) => () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
/** A horse as a Stable sells it, fed: its look born by the law's own birth (birthHorses), on a seeded stream. */
const horse = () => ({ group: 'Transportation', templateIndex: 94, horseFed: T0 + 600 });
const oats = (n) => ({ group: 'UselessItems2', templateIndex: OATS_TEMPLATE, stackCount: n });
/** The page's makers, as the pause menu hands them (a DOM-less element: tag, classes, text, children, attributes). */
const fakeEl = (tag) => {
  const classes = new Set();
  const n = { tag, children: [], attrs: {}, title: '', isConnected: true,
    classList: { add: (...c) => c.forEach((x) => classes.add(x)), contains: (c) => classes.has(c), remove: (...c) => c.forEach((x) => classes.delete(x)) },
    get className() { return [...classes].join(' '); }, set className(v) { classes.clear(); String(v).split(/\s+/).filter(Boolean).forEach((x) => classes.add(x)); },
    _text: '', get textContent() { return n._text + n.children.map((c) => c.textContent ?? '').join(''); }, set textContent(v) { n._text = String(v ?? ''); },
    append(...cs) { for (const c of cs) n.children.push(c); }, setAttribute(k, v) { n.attrs[k] = v; } };
  return n;
};
const el = (t, cls, text) => { const n = fakeEl(t); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
const kit = { el, divider: (t) => el('h4', 'px-divider', t), meter: (now, max) => el('div', 'px-meter', `${Math.round(now)}/${max}`) };
const walk = (root, pick) => { const out = []; const go = (x) => { for (const c of x.children ?? []) { if (pick(c)) out.push(c); go(c); } }; go(root); return out; };
const buttons = (root, label) => walk(root, (c) => c.tag === 'button' && c.textContent.startsWith(label));
/** Each horse card's name and its line under it, in the page's order. */
const cards = (root) => walk(root, (c) => c.className.split(' ').includes('hld-row')).map((row) => {
  const [name] = walk(row, (c) => c.className === 'hld-name');
  const [sub] = walk(row, (c) => c.className === 'hld-sub');
  return [name?.textContent ?? null, sub?.textContent ?? null];
});
/** The ridden horse's card's line (holdingsPages.js stableWords - the mod off, the classic transport's). */
const RIDDEN_LINE = 'Ride from the Transport window.';
const lookName = (h) => { const s = describeHorseLook(horseLookOf(h)); return `${s[0].toUpperCase()}${s.slice(1)}`; };

/** The page on `skin` with the player's horse care pref `stored` (undefined: never touched - Boons), over three horses
 *  and a sack of oats; torn down after. */
function onStable(skin, stored, fn) {
  const had = Object.hasOwn(globalThis, 'location') ? globalThis.location : undefined;
  globalThis.location = { search: `?skin=${skin}` };
  resetPrefs();
  if (stored !== undefined) setPref(HORSE_CARE_PREF, stored);
  const items = [horse(), oats(2), horse(), horse()];
  birthHorses(items, seeded(1));
  const upkeep = createUpkeep({ items: () => items, now: () => T0, horseCare: horseCareRules });   // the hosts' own: THE accessor
  setHoldingsProvider(stableProviderFor({ runtime: null, on: () => false, hasHorse: () => true, hasCart: () => false, items: () => items, upkeep }));
  resetHoldingsPages();
  const draw = () => { const d = el('div', 'px-qdetail'); drawStablePage(d, () => {}, kit); return d; };
  try { return fn({ items, upkeep, draw }); } finally {
    setHoldingsProvider(null);
    resetPrefs();
    if (had === undefined) delete globalThis.location; else globalThis.location = had;
  }
}

test('HORSE-CARE-OFF: horse care turned Off (the player\'s own switch, through the one accessor) with three horses owned - the Stable page draws the ridden horse\'s card and an "Another horse of yours" card for each other, its look its name, each with "Ride this one"; no care - no Feed oats, Give an apple, bond, hunger or stats; and a press rides that horse, the page redrawn round it (mutants: Off lists no horse; the page\'s loop under a tier again; the Off card without its choice; the choice of another horse)', () => {
  onStable('enhanced', false, ({ items, upkeep, draw }) => {
    assert.equal(horseCareRules(), null, 'Off: the accessor answers no tier');
    const [a, b, c] = items.filter((x) => x.templateIndex === 94);
    assert.deepEqual([a, b, c].map(lookName), ['Bay with socks', 'Chestnut', 'Black roan'], 'three horses, three looks');
    assert.deepEqual(upkeep.model().horses, [
      { i: 0, ridden: true, name: null, look: describeHorseLook(horseLookOf(a)) },
      { i: 1, ridden: false, name: null, look: describeHorseLook(horseLookOf(b)) },
      { i: 2, ridden: false, name: null, look: describeHorseLook(horseLookOf(c)) },
    ], 'every horse owned, its place and its look - and nothing of its care');
    let d = draw();
    assert.deepEqual(cards(d), [['Your horse', RIDDEN_LINE], [lookName(b), 'Another horse of yours'], [lookName(c), 'Another horse of yours']]);
    assert.equal(buttons(d, 'Ride this one').length, 2, 'the choice on each other horse');
    assert.deepEqual([buttons(d, 'Feed oats').length, buttons(d, 'Give an apple').length], [0, 0], 'no care to give');
    for (const word of ['Bond', 'Stats', 'Speed', 'Hungry', 'Fed']) assert.equal(d.textContent.includes(word), false, `no ${word} on Off's page`);
    buttons(d, 'Ride this one')[1].onclick();
    assert.equal(activeHorseItem(items), c, 'the third horse ridden now');
    d = draw();
    assert.match(d.textContent, /You will ride that horse now\./);
    assert.deepEqual(cards(d), [['Your horse', RIDDEN_LINE], [lookName(a), 'Another horse of yours'], [lookName(b), 'Another horse of yours']], 'redrawn: the other two the others');
    buttons(d, 'Ride this one')[0].onclick();
    assert.equal(activeHorseItem(items), a, 'and back');
  });
});

test('HORSE-CARE-OFF: on the classic skin, where the one accessor answers null whatever the pref, the same - every horse its card and its choice; and a tier\'s page is unchanged: the same three cards, each other horse with its care and its choice (mutant: the classic skin\'s horses dropped)', () => {
  onStable('classic', 'hard', ({ items, upkeep, draw }) => {
    assert.equal(horseCareRules(), null, 'the classic skin\'s horse is DFU\'s');
    assert.equal(upkeep.model().horses.length, 3);
    const d = draw();
    assert.deepEqual(cards(d).map(([, sub]) => sub), [RIDDEN_LINE, 'Another horse of yours', 'Another horse of yours']);
    assert.deepEqual([buttons(d, 'Ride this one').length, buttons(d, 'Feed oats').length], [2, 0]);
    const second = items.filter((x) => x.templateIndex === 94)[1];
    buttons(d, 'Ride this one')[0].onclick();
    assert.equal(activeHorseItem(items), second, 'the second horse ridden now');
  });
  for (const stored of [undefined, 'hard']) {
    onStable('enhanced', stored, ({ upkeep, draw }) => {
      assert.equal(horseCareRules()?.id, stored ?? 'boons');
      assert.equal(upkeep.model().horses.every((h) => h.stats?.length === 4), true, 'each horse its care');
      const d = draw();
      assert.deepEqual(cards(d).map(([, sub]) => sub), [RIDDEN_LINE, 'Another horse of yours', 'Another horse of yours']);
      assert.deepEqual([buttons(d, 'Ride this one').length, buttons(d, 'Feed oats (2)').length], [2, 3], `${stored ?? 'boons'}: the choice on each other horse, oats on every horse`);
    });
  }
});
