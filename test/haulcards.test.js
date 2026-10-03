// HAUL-CARDS (2026-10-03, Mac: "Im wondering with popups for obtaining silver and harvest items. We need a better
// enhanced plus UI element for when people gather these items"; the mockup: "Dude this is sick") - A GATHER'S, A
// STRIKE'S AND A CLAIM'S CARDS (ui/haulCards.js, through ui/pickupFeed.js showHaul): the cards' data from each answer
// (the goods, their tier and Stores, the XP and its rank's bar; a Motherlode's one card; a claim's silver, deed and
// contracts; the cap's muted card), the feed's law (a bump sums and keeps the newest), the face drawn on the enhanced
// skin and nothing on the classic, the gathering host saying its lines only where no card stood, and the seams.
// bible/06-Systems/Professions-Arc.md 8 (HAUL-CARDS).
import './chargenDom.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  TIER_RARITY, tierRarity, rankProgress, storesHaul, harvestHauls, silverHaul, claimHauls, haulWords, materialImage,
  HAUL_HOLD_MS, LODE_HOLD_MS, HAUL_CAPPED_TEXT, HAUL_ICON_BOX, LODE_ICON_BOX,
} from '../src/ui/haulCards.js';
import { createPickupQueue, pickupFeedLayout, showHaul, showPickups, destroyPickupFeed, _setPickupFeedForTests, PICKUP_FEED_ID, PICKUP_FEED_CSS, PICKUP_FEED_FADE_MS } from '../src/ui/pickupFeed.js';
import { createProfBook } from '../src/net/profBook.js';
import { veins, utcDayOfMs, material } from '../src/net/nodeLaw.js';
import { MINE_ACT, xpForRank } from '../src/net/professionLaw.js';
import { MARKS_COMBAT } from '../src/net/marksLaw.js';
import { mineKind } from '../src/scenes/mineHost.js';
import { herbKind } from '../src/scenes/herbHost.js';
import { createGatherHost, aimAt, storesWhereLine } from '../src/scenes/gatherHost.js';
import { createToastQueue } from '../src/ui/profHud.js';
import { setForagingHost } from '../src/systems/foragingInstall.js';
import { FT } from '../src/systems/foragingLaw.js';
import { HEIGHTMAP_DIMENSION, TERRAIN_SIZE } from '../src/world/terrainSampler.js';
import { sharedClassicMinutes } from '../src/net/wire.js';
import { LOOT_RARITY_KEY } from '../src/systems/lootRarity.js';
import { setPref, PREF_DEFAULTS } from '../src/systems/uiPrefs.js';
import { mintMaterialItem } from '../src/systems/profItems.js';
import { inventoryItemImage } from '../src/systems/itemTemplates.js';

const rd = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const noWait = () => Promise.resolve();
const tick = () => new Promise((r) => setImmediate(r));


// ─── THE CARDS' DATA ─────────────────────────────────────────────────────────────────────────────────────────────────

test('HAUL-CARDS the law: a material\'s tier wears the loot\'s colours - 1 and 2 plain, 3 magic, 4 rare, 5 legendary, 6 artifact - and none with the loot\'s tiers off; a rank\'s bar is its progress to the next, full at the top; a gather card holds longer than a pickup, a Motherlode\'s longer still (mutants: a tier\'s colour; the bar\'s floor)', () => {
  assert.deepEqual([1, 2, 3, 4, 5, 6].map((t) => tierRarity(t, true)), [null, null, 'magic', 'rare', 'legendary', 'artifact']);
  assert.deepEqual([3, 6].map((t) => tierRarity(t, false)), [null, null], 'the loot\'s tiers off');
  assert.equal(TIER_RARITY.length, 7);
  assert.equal(rankProgress(xpForRank(34)), 0, 'a rank just reached');
  assert.equal(rankProgress((xpForRank(34) + xpForRank(35)) / 2), 0.5);
  assert.equal(rankProgress(xpForRank(100) + 5000), 1, 'the top rank');
  assert.ok(HAUL_HOLD_MS > 2500 && LODE_HOLD_MS > HAUL_HOLD_MS);
  assert.deepEqual([HAUL_ICON_BOX, LODE_ICON_BOX], [32, 38]);
  assert.equal(HAUL_CAPPED_TEXT, `No silver - the day's ${MARKS_COMBAT.perDay} for breaches and towns is reached`);
});

test('HAUL-CARDS a harvest\'s cards: the goods one card - "+3", its material\'s name and tier, its picture the pack\'s own item, "Stores 41" (own, bought and gold\'s), the XP on it and the rank\'s bar, a clean act\'s words its head - and a gem and a second find each their own; nothing for an answer it cannot read (mutants: the Stores\' count; the XP off the card; the gem dropped; the head unsaid)', () => {
  setPref(LOOT_RARITY_KEY, true);
  try {
    const d = { material: 'metal:iron', qty: 3, xp: 60, track: { profession: 'mining', xp: xpForRank(34), rank: 34 }, store: { own: 38, bought: 2, gold: 1 }, gem: 'gem:amber', extra: 'gem:jade', extraQty: 2 };
    const [main, gem, extra] = harvestHauls(d, { note: ' (every strike on the glint)' });
    assert.deepEqual([main.key, main.haul, main.material, main.count, main.held, main.xp, main.rank, main.progress, main.head],
      ['stores\u0002metal:iron', 'stores', 'metal:iron', 3, 41, 60, 34, 0, 'every strike on the glint']);
    assert.equal(main.rarity, tierRarity(material('metal:iron').tier, true));
    assert.deepEqual(main.image, inventoryItemImage(mintMaterialItem('metal:iron')), 'the pack\'s own picture of it');
    assert.deepEqual(haulWords(main), { head: 'every strike on the glint', plus: '+3', name: 'Iron', sub: '', tag: 'Stores 41', end: '', row: { text: '+60 Mining XP', fill: 0, end: '34' }, lode: null });
    assert.deepEqual([gem.material, gem.count, gem.sub, gem.xp, haulWords(gem).tag], ['gem:amber', 1, 'a gem', undefined, 'Stores']);   // no gemStore in this answer: no count
    assert.deepEqual([extra.material, extra.count, haulWords(extra).name], ['gem:jade', 2, 'Jade']);
    assert.equal(gem.rarity, tierRarity(material('gem:amber').tier, true));
    assert.deepEqual([harvestHauls(null), harvestHauls({ qty: 3 }), harvestHauls({ material: 'metal:iron', qty: 0 })], [[], [], []]);
    // a kind's own name (PROF8's species): the card's name, the material its sub - and a card of its own
    const fish = harvestHauls({ material: 'food:fish', qty: 2, xp: 10, track: { profession: 'fishing', xp: 0, rank: 1 } }, { name: 'Largemouth Bass' })[0];
    assert.deepEqual([haulWords(fish).name, haulWords(fish).sub], ['Largemouth Bass', `as ${haulWords({ ...fish, name: null, sub: null }).name}`]);
    assert.notEqual(fish.key, harvestHauls({ material: 'food:fish', qty: 2 })[0].key);
  } finally { setPref(LOOT_RARITY_KEY, PREF_DEFAULTS[LOOT_RARITY_KEY]); }
});

test('HAUL-CARDS a Motherlode\'s one card (PROF2b): its ore, its silver and its twenty on it, "Motherlode" its head, never bumped into a vein\'s card, held the longer; no silver said where none was struck (mutants: the silver off; the twenty off; the key a vein\'s)', () => {
  const d = { motherlode: true, node: 'mlode:20833:0', material: 'ore:ebony', qty: 9, xp: 1380, track: { profession: 'mining', xp: xpForRank(36), rank: 36 }, store: { own: 9 }, marks: { struck: 10, balance: 60 }, lode: { struck: 4, strikers: 20 } };
  const cards = harvestHauls(d, { note: ' (every strike on the glint)' });
  assert.equal(cards.length, 1);
  const [c] = cards;
  assert.deepEqual([c.key, c.lode, c.head, c.silver, c.miners, c.hold], ['lode\u0002mlode:20833:0', true, 'Motherlode - every strike on the glint', 10, '4 / 20 miners', LODE_HOLD_MS]);
  const w = haulWords(c);
  assert.deepEqual([w.plus, w.name, w.tag, w.row.text, w.lode], ['+9', 'Ebony Ore', 'Stores 9', '+1,380 Mining XP', { silver: '+10 silver', held: 'you hold 60', miners: '4 / 20 miners' }]);   // AUDIT HAUL-CARDS B4 (PIN MOVED): the purse
  assert.equal(haulWords(harvestHauls({ ...d, marks: { struck: 0, balance: 10_000_000, why: 'full' } })[0]).lode.silver, '', 'a full purse: no silver said');
  assert.equal(harvestHauls({ ...d, motherlode: false })[0].key, 'stores\u0002ore:ebony');
});

test('HAUL-CARDS a claim\'s cards: a raid\'s 30 with the day\'s combat bar and the balance, the guild\'s deed into its treasury (brass, never the account\'s coin), each contract by its guild\'s tag with its tax; a gate at the cap one muted card; an old service\'s answer none (mutants: the bar\'s figures; the deed an account\'s; the tax unsaid; the cap unsaid)', () => {
  const data = { marks: { struck: 30, balance: 90, combat: { earned: 120, max: 150 } }, deed: { struck: 25, guild: { name: 'The HND Guild', tag: 'HND' } },
    contracts: [{ contract: 'c1', pay: 38, tax: 2, guild: { name: 'The HND Guild', tag: 'HND' } }, { contract: 'c2', pay: 0, tax: 0 }] };
  const [raid, deed, pay, ...rest] = claimHauls(data, 'raid');
  assert.deepEqual(rest, [], 'a contract that paid nothing has no card');
  assert.deepEqual(haulWords(raid), { head: '', plus: '+30', name: 'silver', sub: 'Town defended', tag: '', end: '90', row: { text: 'Combat today', fill: 0.8, end: '120 / 150' }, lode: null });
  assert.deepEqual([deed.tone, haulWords(deed).sub, haulWords(deed).plus], ['treasury', 'Guild deed - to The HND Guild', '+25']);
  assert.deepEqual([pay.tone, haulWords(pay).sub, haulWords(pay).plus], [undefined, 'Contract (2 tax) - [HND]', '+38']);   // AUDIT HAUL-CARDS C3 (PIN MOVED): the tax before the guild
  assert.equal(haulWords(claimHauls({ marks: { struck: 50, balance: 50 } }, 'gate')[0]).sub, 'Breach closed');
  const capped = claimHauls({ marks: { struck: 0, balance: 150, why: 'cap', combat: { earned: 150, max: 150 } } }, 'gate');
  assert.deepEqual(capped.map((c) => [c.haul, haulWords(c).note]), [['note', HAUL_CAPPED_TEXT]]);
  assert.deepEqual([claimHauls({ marks: { struck: 0, why: 'full', balance: 1 } }, 'gate'), claimHauls(null, 'raid'), claimHauls({}, 'raid'), silverHaul(null)], [[], [], [], null]);
});

// ─── THE FEED ────────────────────────────────────────────────────────────────────────────────────────────────────────

test('HAUL-CARDS the feed\'s law: a second harvest of the same goods inside its hold BUMPS its card - the counts and the XP add, the Stores, the rank and the bar the newest\'s; a card holds its own hold; a pickup\'s bump moves its count alone, as ever; a stack of cards each its own height (mutants: a bump\'s XP unsummed; the Stores kept stale; the card\'s hold unread; the heights unread)', () => {
  const q = createPickupQueue();
  const a = storesHaul('metal:iron', 3, { held: 41 });
  Object.assign(a, { xp: 60, rank: 34, progress: 0.2, adds: ['count', 'xp'], latest: ['held', 'rank', 'progress'] });
  const b = { ...storesHaul('metal:iron', 2, { held: 43 }), xp: 40, rank: 35, progress: 0.05, adds: ['count', 'xp'], latest: ['held', 'rank', 'progress'] };
  q.push([a], 0);
  q.push([b], 1000);
  const [c] = q.standing(1000);
  assert.deepEqual([c.count, c.xp, c.held, c.rank, c.progress, c.bumps], [5, 100, 43, 35, 0.05, 1]);
  assert.equal(q.standing(1000 + HAUL_HOLD_MS - 1)[0].fading, false, 'its own hold, not a pickup\'s');
  assert.equal(q.standing(1000 + HAUL_HOLD_MS)[0].fading, true);
  q.tick(1000 + HAUL_HOLD_MS + PICKUP_FEED_FADE_MS);
  assert.equal(q.size, 0);
  const p = createPickupQueue();
  p.push([{ key: 'k', name: 'Sword', count: 1, xp: 5 }], 0);
  p.push([{ key: 'k', name: 'Sword', count: 1, xp: 5 }], 10);
  assert.deepEqual([p.standing(10)[0].count, p.standing(10)[0].xp], [2, 5], 'a pickup sums its count alone');
  assert.deepEqual(pickupFeedLayout({ base: 500, lower: 640, cardH: 24, cardGap: 3, count: 3, heights: [44, 24, 24] }), { top: 500, shown: 3 });
  assert.deepEqual(pickupFeedLayout({ base: 500, upper: 450, lower: 600, cardH: 24, cardGap: 3, count: 3, heights: [44, 44, 44] }), { top: 462, shown: 3 }, 'three of 44 and two gaps: 138 above 600');
  assert.deepEqual(pickupFeedLayout({ base: 500, upper: 500, lower: 600, cardH: 24, cardGap: 3, count: 3, heights: [44, 44, 44] }), { top: 500, shown: 2 });
});

// ── A DOCUMENT, JUST ENOUGH OF ONE ───────────────────────────────

function fakeEl(tag, doc) {
  const classes = new Set();
  const props = {};
  const n = {
    tag, doc, children: [], dataset: {}, attrs: {}, parent: null,
    style: { setProperty(k, v) { props[k] = String(v); }, getPropertyValue: (k) => props[k] ?? '' },
    props,
    classList: {
      add: (...c) => c.forEach((x) => classes.add(x)),
      remove: (...c) => c.forEach((x) => classes.delete(x)),
      toggle: (c, on = !classes.has(c)) => { if (on) classes.add(c); else classes.delete(c); return on; },
      contains: (c) => classes.has(c),
    },
    get className() { return [...classes].join(' '); },
    set className(v) { classes.clear(); String(v).split(/\s+/).filter(Boolean).forEach((x) => classes.add(x)); },
    _text: '',
    get textContent() { return n._text + n.children.map((c) => c.textContent ?? '').join(''); },
    set textContent(v) { n.children.forEach((c) => { c.parent = null; }); n.children.length = 0; n._text = v == null ? '' : String(v); },
    get firstElementChild() { return n.children[0] ?? null; },
    append(...cs) { for (const c of cs) { c.parent?.children && c.parent !== n && c.remove(); if (c.parent === n) n.children.splice(n.children.indexOf(c), 1); c.parent = n; n.children.push(c); } },
    insertBefore(c, ref) {
      if (c.parent) c.parent.children.splice(c.parent.children.indexOf(c), 1);
      c.parent = n;
      const i = ref ? n.children.indexOf(ref) : -1;
      if (i < 0) n.children.push(c); else n.children.splice(i, 0, c);
      return c;
    },
    replaceChildren(...cs) { n.children.forEach((c) => { c.parent = null; }); n.children.length = 0; n.append(...cs); },
    remove() { if (n.parent) { const i = n.parent.children.indexOf(n); if (i >= 0) n.parent.children.splice(i, 1); n.parent = null; } n.removed = true; },
    setAttribute(k, v) { n.attrs[k] = v; },
    getBoundingClientRect: () => ({ top: 0, bottom: 0, height: 0, width: 0, left: 0, right: 0 }),
  };
  return n;
}
/** A document with a body and a head that keep their children, an id lookup over what was appended, and a selector
 *  answer the test may set (`doc.rects[selector] = { top, bottom, height }`). */
function fakeDocument() {
  const made = [];
  const doc = { made, rects: {} };
  doc.createElement = (t) => { const e = fakeEl(t, doc); made.push(e); return e; };
  doc.body = fakeEl('body', doc);
  doc.head = fakeEl('head', doc);
  const all = () => { const out = []; const walk = (x) => { for (const c of x.children) { out.push(c); walk(c); } }; walk(doc.head); walk(doc.body); return out; };
  doc.getElementById = (id) => all().find((e) => e.id === id) ?? null;
  doc.querySelector = (sel) => {
    const r = doc.rects[sel];
    if (!r) return null;
    const e = fakeEl('div', doc);
    e.textContent = r.text ?? 'x';
    e.getBoundingClientRect = () => ({ top: r.top, bottom: r.bottom, height: r.bottom - r.top, width: 100, left: 0, right: 100 });
    return e;
  };
  return doc;
}

/** The enhanced skin (or the classic) over a fake page, the feed's clock and frames in the test's hands. */
function withPage(fn, { skin = 'enhanced' } = {}) {
  const doc = fakeDocument();
  const frames = [];
  let now = 0;
  globalThis.document = doc;
  globalThis.location = { search: `?skin=${skin}` };
  globalThis.innerWidth = 1280;
  globalThis.innerHeight = 800;
  destroyPickupFeed();
  _setPickupFeedForTests({ now: () => now, raf: (f) => { frames.push(f); return frames.length; }, icon: () => null });
  const ctl = {
    doc,
    set now(v) { now = v; }, get now() { return now; },
    /** Run the frames that are queued (the ticker queues the next one as it runs). */
    frame() { const fs = frames.splice(0); for (const f of fs) f(); },
    queued: () => frames.length,
    feed: () => doc.getElementById(PICKUP_FEED_ID),
    cards: () => ctl.feed()?.children ?? [],
  };
  try { return fn(ctl); } finally {
    destroyPickupFeed();
    _setPickupFeedForTests({ now: null, raf: (f) => (typeof requestAnimationFrame === 'function' ? requestAnimationFrame(f) : null),
      schedule: (f, ms) => (typeof setTimeout === 'function' ? setTimeout(f, ms) : null),
      cancel: (t) => { if (t != null && typeof clearTimeout === 'function') clearTimeout(t); }, icon: null });
    delete globalThis.document; delete globalThis.location; delete globalThis.innerWidth; delete globalThis.innerHeight;
  }
}
/** Every node under `n` carrying the class. */
function find(n, cls, out = []) {
  if (n?.classList?.contains?.(cls)) out.push(n);
  for (const c of n?.children ?? []) find(c, cls, out);
  return out;
}


test('HAUL-CARDS the face: on the enhanced skin a harvest\'s cards stand under the crosshair - the goods\' card its head, "+3", its name, "Stores 41", the XP and the bar; a bump rewrites them; a claim\'s silver its coin, a deed its chest, the cap a muted card - and the classic skin draws nothing and answers false (mutants: the classic drawn; a bump unsaid; the bar unset)', () => {
  // chargenDom.mjs's frames run at once - the draw watchdog's frame counter would chase itself; the feed's own suite
  // runs under a frame source that waits, and so does this
  const raf0 = globalThis.requestAnimationFrame;
  globalThis.requestAnimationFrame = () => null;
  try {
    withPage((p) => {
      const d = { material: 'metal:iron', qty: 3, xp: 60, track: { profession: 'mining', xp: xpForRank(34) + 69, rank: 34 }, store: { own: 41 } };
      assert.equal(showHaul(harvestHauls(d, { note: ' (every strike on the glint)' })), true);
      const [card] = p.cards();
      assert.ok(card.classList.contains('haul') && card.classList.contains('is-stores'));
      const text = (cls) => find(card, cls)[0]?.textContent;
      assert.deepEqual([text('haul-head'), text('pickfeed-plus'), text('pickfeed-name'), text('haul-tag'), text('haul-text'), text('haul-rank')],
        ['every strike on the glint', '+3', 'Iron', 'Stores 41', '+60 Mining XP', '34']);
      assert.equal(find(card, 'haul-fill')[0].style.width, '10%', '69 of 34\'s 690 to 35');
      p.now = 500;
      showHaul(harvestHauls({ ...d, qty: 2, xp: 40, track: { profession: 'mining', xp: (xpForRank(34) + xpForRank(35)) / 2, rank: 34 }, store: { own: 43 } }));
      assert.equal(p.cards().length, 1, 'one card, bumped');
      assert.deepEqual([text('pickfeed-plus'), text('haul-tag'), text('haul-text')], ['+5', 'Stores 43', '+100 Mining XP']);
      assert.equal(find(card, 'haul-fill')[0].style.width, '50%');
      showHaul(claimHauls({ marks: { struck: 30, balance: 90, combat: { earned: 120, max: 150 } }, deed: { struck: 25, guild: { name: 'G', tag: 'G' } } }, 'raid'));
      showHaul(claimHauls({ marks: { struck: 0, balance: 150, why: 'cap' } }, 'gate'));
      const cards = p.cards();
      assert.deepEqual(cards.map((c) => ['is-note', 'is-treasury', 'is-silver', 'is-stores'].find((k) => c.classList.contains(k))), ['is-note', 'is-silver', 'is-treasury', 'is-stores'], 'the newest first: the cap, the raid, its deed, the goods');
      assert.equal(cards[0].textContent, HAUL_CAPPED_TEXT);
      assert.equal(find(p.feed(), 'haul-coin').length, 1, 'the account\'s coin');
      assert.equal(find(p.feed(), 'haul-chest').length, 1, 'the treasury\'s chest');
      assert.equal(cards.length, 4);
    });
    withPage((p) => {
      assert.equal(showHaul(harvestHauls({ material: 'metal:iron', qty: 3 })), false);
      assert.equal(p.feed(), null, 'the classic skin: no node at all');
    }, { skin: 'classic' });
    withPage(() => { assert.equal(showHaul([]), false); assert.equal(showHaul(null), false); });
    // the sheet: the haul's own rules in the feed's sheet, still under reduced motion
    assert.match(PICKUP_FEED_CSS, /\.pickfeed-card\.haul \{ align-items: center;/);
    assert.match(PICKUP_FEED_CSS, /\.pickfeed-card, \.pickfeed-count, \.pickfeed-name, \.pickfeed-plus, \.haul-fill \{ animation: none !important; transition: none !important; \}/);
    assert.match(PICKUP_FEED_CSS, /\.pickfeed-card\.haul\.is-silver \{ --pf-edge: #c9d1d9; \}/);
  } finally { globalThis.requestAnimationFrame = raf0; }
});

// ─── THE HOSTS ───────────────────────────────────────────────────────────────────────────────────────────────────────

const DAY = 86_400;
const WOODS = 231, GLENUMBRA = 59;
const hourAt = (s) => Math.floor((((Math.floor(sharedClassicMinutes(s * 1000)) % 1440) + 1440) % 1440) / 60);
const NOON = (() => {
  const d0 = 20500 * DAY;
  for (let s = d0 + 3600; s < d0 + 3 * 7200; s += 30) if (hourAt(s) === 12 && hourAt(s - 60) === 12 && hourAt(s + 60) === 12) return s;
  throw new Error('no noon');
})();
const memStorage = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)) }; };
const OUTSIDE = Object.freeze({ inside: false, insideDungeon: false, insideCastle: false, locationType: 0xffff, inLocationRect: false, hour: 12, climate: WOODS, region: GLENUMBRA, enemiesNear: false, carriedWeight: 0 });
/** The gathering host over one flat pixel's veins (test/gathersaid.test.js's rig), its card door `haul` the test's. */
function rig({ answer, haul, live = true }) {
  const day = utcDayOfMs(NOON * 1000);
  const samples = new Float32Array(HEIGHTMAP_DIMENSION * HEIGHTMAP_DIMENSION).fill(0.25);
  const law = veins({ x: 400, y: 150, day, climate: WOODS, region: GLENUMBRA });
  const rocks = law.map((v) => [v.u * TERRAIN_SIZE - 2, 0, v.v * TERRAIN_SIZE + 4, v.u * TERRAIN_SIZE + 2, 6, v.v * TERRAIN_SIZE + 8]);
  const entry = { px: 400, py: 150, samples, tilemap: new Uint8Array(128 * 128).fill(2), locationRect: null, batches: [], rocks };
  const clock = { ms: NOON * 1000 };
  const door = {
    account: () => 'acct-1',
    state: async () => ({ ok: true, data: { day, character: 'c1', tracks: [{ profession: 'mining', xp: xpForRank(49), rank: 49, specs: { 50: null, 100: null } }], today: {}, taken: [], stores: [], caps: { harvests: 60, stores: 5000 } } }),
    pixels: async (c, px) => ({ ok: true, data: { pixels: px.map(([x, y]) => ({ x, y, state: 'none' })), dungeons: [] } }),
    harvest: async (b) => answer(b),
  };
  const book = createProfBook({ door, storage: memStorage(), character: () => 'c1', now: () => clock.ms, sleep: noWait });
  const queue = createToastQueue();
  const said = [];
  const hud = { setPrompt: () => {}, setMeter: () => {}, banner: () => {}, setChip: () => {}, frame: () => {}, dispose: () => {}, toast: (t, o) => { said.push(t); queue.push(t, o); } };
  const built = new Map([['400,150', entry]]);
  const entity = { items: [{ templateIndex: FT.PickAxe, currentCondition: 50, maxCondition: 50 }], stats: {} };
  const feet = [0, 0, 0];
  const view = { yaw: 0, pitch: 0 };
  let input = { held: false, attack: false, choice: false };
  const host = createGatherHost({
    book, hud, kinds: [herbKind({ book }), mineKind({ book })],
    renderer: { createBillboardBatch: () => ({}), destroyBatch: () => {} }, getTexture: async () => ({ recordCount: 999 }), uploadRecord: () => {},
    billboardSize: () => ({ w: 0.3, h: 0.3 }), flatBatchAabb: () => [0, 0, 0, 0, 0, 0],
    built: () => built, pixelTranslation: (x, y, out) => { out[0] = 0; out[1] = 0; out[2] = 0; return out; },
    pixelInfo: () => ({ climate: WOODS, region: GLENUMBRA }), nowMs: () => clock.ms,
    eye: () => ({ pos: [feet[0], feet[1] + 1.6, feet[2]], dir: [Math.sin((view.yaw * Math.PI) / 180), Math.sin((view.pitch * Math.PI) / 180), Math.cos((view.yaw * Math.PI) / 180)] }),
    view: () => view, feet: () => feet, entity: () => entity, keyLabel: () => 'E', input: () => input, active: () => live.ok ?? live,
    ...(haul ? { haul } : {}),
  });
  const mine = async (i) => {
    const vs = host.nodesOf(400, 150).filter((n) => n.kind === 'mine' && n.what === 'vein');
    const [x, y, z] = vs[i].local;
    feet[0] = x; feet[1] = y; feet[2] = z - 1.5;
    const at = aimAt([x, y + 1.6, z - 1.5], [x, y + (vs[i].lift ?? 0.3), z], { yaw: 0, pitch: 0 });
    view.yaw = -at.yaw; view.pitch = -at.pitch;
    host.tick(0.016);
    assert.equal(host.press(), true);
    for (let k = 0; k < 12 && host.acting(); k++) { input = { held: false, attack: true, choice: false }; host.tick(MINE_ACT.swingS + 0.01); input = { held: false, attack: false, choice: false }; host.tick(0.01); }
    for (let k = 0; k < 4; k++) await tick();
  };
  const stand = async () => { await book.refresh(); host.onBuilt(entry); await tick(); await tick(); };
  return { host, said, stand, mine };
}
const iron = (b) => ({ ok: true, data: { node: b.node, kind: b.kind, material: 'metal:iron', qty: 3, xp: 33, track: { profession: 'mining', xp: xpForRank(49) + 33, rank: 49 }, today: 1, store: { material: 'metal:iron', own: 3, bought: 0 } } });
const outside = (fn) => async () => { setForagingHost({ world: () => OUTSIDE }); try { await fn(); } finally { setForagingHost(null); } };

test('HAUL-CARDS the gathering host: where the card door answers true (the enhanced skin), the goods and the XP are its card and not the right\'s lines - the Stores\' way still said once; where it answers false (the classic skin, a face that cannot draw), the lines exactly as ever; a door that throws is a door that drew nothing (mutants: the lines said beside the card; the card asked with nothing; the fallback lost)', outside(async () => {
  const cards = [];
  const r = rig({ answer: iron, haul: (e) => { cards.push(e); return true; } });
  await r.stand();
  await r.mine(0);
  assert.equal(cards.length, 1);
  assert.deepEqual(cards[0].map((c) => [c.material, c.count, c.xp, c.held]), [['metal:iron', 3, 33, 3]]);
  assert.deepEqual(r.said, [storesWhereLine('E')], 'the card says the goods and the XP; the Stores\' way once');
  const off = rig({ answer: iron, haul: () => false });
  await off.stand();
  await off.mine(0);
  assert.equal(off.said[0], '+3 Iron to your Stores');
  assert.match(off.said[2], /^\+33 Mining XP/);
  const none = rig({ answer: iron });
  await none.stand();
  await none.mine(0);
  assert.equal(none.said[0], '+3 Iron to your Stores', 'no door: the lines');
  const thrown = rig({ answer: iron, haul: () => { throw new Error('a face'); } });
  await thrown.stand();
  await thrown.mine(0);
  assert.equal(thrown.said[0], '+3 Iron to your Stores', 'a door that throws: the lines');
}));

test('HAUL-CARDS the kinds: Mining\'s Motherlode answer under its card keeps the balance and says no silver line; without one, says it as ever; Fishing names its catch\'s species for the card (mutants: the silver said twice; the balance unkept; the species unnamed)', () => {
  const kept = [];
  const marks = { strikeLine: (m) => { kept.push(m.balance); return `${m.struck} silver struck to your account.`; } };
  const k = mineKind({ book: { taken: () => false, counting: () => false, state: {} }, lodes: { heard: () => {} }, marks });
  const said = [];
  const d = { motherlode: true, node: 'mlode:1:0', marks: { struck: 10, balance: 60 } };
  k.answered(d, (t) => said.push(t), { hauled: true });
  assert.deepEqual([said, kept], [[], [60]]);
  k.answered(d, (t) => said.push(t), { hauled: false });
  k.answered(d, (t) => said.push(t));
  assert.deepEqual(said, ['10 silver struck to your account.', '10 silver struck to your account.']);
  assert.match(rd('src/scenes/fishHost.js'), /haulName: \(d\) => speciesOfHaul\(d\.node, climateOf\(d\.node\)\)\?\.itemName \?\? null,/);
});

test('HAUL-CARDS the seams by source: the world host hands the gathering host the feed\'s door and shows a raid\'s and a gate\'s silver as cards beside the book\'s lines; the gathering host asks its kind\'s name and the act\'s words for the card, and tells the kind it was carded; a haul card\'s picture is fitted to its own box (mutants: each seam)', () => {
  const w = rd('src/scenes/world.js');
  assert.match(w, /import \{ showPickups, showHaul \} from '\.\.\/ui\/pickupFeed\.js'; import \{ claimHauls \} from '\.\.\/ui\/haulCards\.js';/);
  assert.match(w, /nowMs: \(\) => Date\.now\(\) \+ _sharedOffsetMs, haul: \(entries\) => showHaul\(entries\),/);
  assert.match(w, /onMarks: \(data\) => \{ showHaul\(claimHauls\(data, 'raid'\)\); return marksBook\?\.claimLines\(data, 'raid'\) \?\? null; \},/);
  assert.match(w, /onMarks: \(marks, data\) => \{ showHaul\(claimHauls\(data \?\? \{ marks \}, 'gate'\)\); return marksBook\?\.claimLines\(data \?\? \{ marks \}, 'gate'\) \?\? null; \},/);
  const g = rd('src/scenes/gatherHost.js');
  assert.match(g, /hauled = live && deps\.haul\?\.\(harvestHauls\(d, \{ name: k\?\.haulName\?\.\(d\) \?\? null, note \}\)\) === true;/);   // AUDIT HAUL-CARDS A3 (PIN MOVED): on a live world
  assert.match(g, /try \{ k\?\.answered\?\.\(d, \(t\) => hud\.toast\(t\), \{ hauled \}\); \}/);
  assert.match(rd('src/ui/pickupFeed.js'), /const box = line\.lode \? LODE_ICON_BOX : line\.haul \? HAUL_ICON_BOX : PICKUP_ICON_BOX;/);
  assert.ok(materialImage('metal:iron') === null || Number.isInteger(materialImage('metal:iron').archive), 'an address or none');
});

test('AUDIT HAUL-CARDS B1-B4: "a gem" for a gem alone - a tree\'s Heartwood and a body\'s Big Tooth say none; each find its own Stores count off the answer\'s gemStore and extraStore; a bump says the newest act\'s words, a plain act after a clean one none; a Motherlode\'s card says the purse beside its silver (mutants: every find a gem; the finds\' counts unread; the head the first act\'s; the purse dropped)', () => {
  const tree = harvestHauls({ material: 'log:oak', qty: 3, gem: 'wood:heartwood', gemStore: { own: 2 }, extra: 'wood:resin', extraQty: 2, extraStore: { own: 7, bought: 1 } });
  assert.deepEqual(tree.slice(1).map((c) => [c.material, c.sub, haulWords(c).tag]), [['wood:heartwood', null, 'Stores 2'], ['wood:resin', null, 'Stores 8']]);
  const body = harvestHauls({ material: 'hide:bear', qty: 1, gem: 'part:tooth', gemStore: { own: 1 } });
  assert.deepEqual([body[1].sub, haulWords(body[1]).name], [null, 'Big Tooth']);
  const vein = harvestHauls({ material: 'metal:iron', qty: 1, gem: 'gem:amber', gemStore: { own: 4 } });
  assert.deepEqual([vein[1].sub, haulWords(vein[1]).tag], ['a gem', 'Stores 4']);
  const pearl = harvestHauls({ material: 'food:fish', qty: 1, gem: 'gem:pearl' });
  assert.equal(pearl[1].sub, 'a gem', 'the Pearl is a gem');
  // the head: each act's own, through the feed's bump
  const q = createPickupQueue();
  const act = (note, xp) => harvestHauls({ material: 'metal:iron', qty: 1, xp, track: { profession: 'mining', xp: xpForRank(34), rank: 34 } }, { note })[0];
  q.push([act('', 10)], 0);
  q.push([act(' (every strike on the glint)', 15)], 500);
  assert.equal(haulWords(q.standing(500)[0]).head, 'every strike on the glint', 'the clean act after a plain one');
  q.push([act('', 10)], 900);
  assert.equal(haulWords(q.standing(900)[0]).head, '', 'and a plain one after it says none');
  // the Motherlode's purse
  const lode = harvestHauls({ motherlode: true, node: 'mlode:1:0', material: 'ore:ebony', qty: 6, marks: { struck: 10, balance: 1380 }, lode: { struck: 3, strikers: 20 } })[0];
  assert.deepEqual(haulWords(lode).lode, { silver: '+10 silver', held: 'you hold 1,380', miners: '3 / 20 miners' });
  assert.equal(haulWords({ ...lode, silver: 0 }).lode.held, '', 'no silver struck, no purse said');
});

test('AUDIT HAUL-CARDS B4, the face: a Motherlode\'s card draws its silver, the purse beside it and its twenty (mutants: the purse unsaid)', () => {
  const raf0 = globalThis.requestAnimationFrame;
  globalThis.requestAnimationFrame = () => null;
  try {
    withPage((p) => {
      assert.equal(showHaul(harvestHauls({ motherlode: true, node: 'mlode:1:0', material: 'ore:ebony', qty: 6, marks: { struck: 10, balance: 1380 }, lode: { struck: 3, strikers: 20 } })), true);
      const [card] = p.cards();
      assert.ok(card.classList.contains('is-lode'));
      const row = find(card, 'haul-lode')[0];
      assert.deepEqual([find(row, 'haul-silver')[0].textContent, find(row, 'haul-sub')[0].textContent, find(row, 'haul-end')[0].textContent],
        ['+10 silver', 'you hold 1,380', '3 / 20 miners']);
    });
  } finally { globalThis.requestAnimationFrame = raf0; }
});

// ─── AUDIT HAUL-CARDS (2026-10-03, Mac: "Audit this") ───────────────────────────────────────────────────────────────

test('AUDIT HAUL-CARDS A1: a card the band puts out keeps its own last height - a tall harvest card under three pickups in a band too short for all four stays out, frame after frame, where it stood and went every frame (mutants: the hidden card read as the first\'s height)', () => {
  const raf0 = globalThis.requestAnimationFrame;
  globalThis.requestAnimationFrame = () => null;
  try {
    withPage((p) => {
      // every card its height, nothing while the band has put it out; the plaque's foot and the HUD's top make a 140 px band
      const mk = p.doc.createElement;
      p.doc.createElement = (t) => {
        const e = mk(t);
        e.getBoundingClientRect = () => {
          const h = !e.classList.contains('pickfeed-card') || e.classList.contains('pf-over') ? 0 : e.classList.contains('haul') ? 56 : 30;
          return { top: 0, bottom: h, height: h, width: 100, left: 0, right: 100 };
        };
        return e;
      };
      p.doc.rects['.wplaque.on'] = { top: 400, bottom: 564 };
      p.doc.rects['.hud .hud-bottom'] = { top: 720, bottom: 800 };
      assert.equal(showHaul(harvestHauls({ material: 'metal:iron', qty: 3, xp: 10, track: { profession: 'mining', xp: 0, rank: 1 } })), true);
      p.now = 100;
      const sword = (n) => ({ name: `Sword ${n}`, group: 'Weapons', templateIndex: 121 + n });
      showPickups([{ item: sword(0), count: 1 }, { item: sword(1), count: 1 }, { item: sword(2), count: 1 }]);
      const seen = [];
      for (let i = 0; i < 6; i++) { p.now += 16; p.frame(); seen.push(p.cards().map((c) => (c.classList.contains('pf-over') ? 'out' : 'in')).join(' ')); }
      assert.deepEqual(new Set(seen.slice(1)).size, 1, `one layout frame after frame: ${seen.join(' | ')}`);
      assert.equal(seen.at(-1), 'in in in out', 'the three pickups in, the tall card out');
    });
  } finally { globalThis.requestAnimationFrame = raf0; }
});

test('AUDIT HAUL-CARDS A2/A5/C1-C4/C7, the sheet and the words: the cap\'s note wraps in its card and keeps the theme\'s veil; a card\'s width is the screen\'s before the HUD\'s scale; the source line gives way before "silver"; a contract\'s tax before its guild, grouped; a light theme (Stone) veils the feed in its ink, the dark ones their panel; the tag\'s border readable; a Motherlode with no silver shows no coin (mutants: the note unwrapped; the width unscaled; the sub not first to give; the veil Stone\'s panel; the tax ungrouped; the coin kept)', () => {
  const css = PICKUP_FEED_CSS;
  assert.match(css, /\.pickfeed-card\.haul\.is-note \{ color: #c2b79a; font-size: 13px; padding-left: 10px; white-space: normal; \}/);
  assert.doesNotMatch(css, /\.pickfeed-card\.haul\.is-note \{[^}]*background/, 'the note wears the theme\'s veil');
  assert.match(css, /\.pickfeed-card \{ display: flex; align-items: center; gap: 6px; box-sizing: border-box; max-width: min\(440px, calc\(88vw \/ var\(--hud-scale, 1\)\)\);/);
  assert.match(css, /max-width: calc\(92vw \/ var\(--hud-scale, 1\)\);/);
  assert.match(css, /\.haul-sub \{ flex: 0 1000 auto; min-width: 0;/);
  assert.match(css, /\.pickfeed-card\.haul\.is-silver \.pickfeed-name, \.pickfeed-card\.haul\.is-treasury \.pickfeed-name \{ flex-shrink: 0; \}/);
  assert.match(css, /border: 1px solid #9a9079; \}/, 'the tag\'s border the lit stone');
  assert.match(css, /:root\[data-plus-theme="stone"\] \.pickfeed-card \{ background-color: rgba\(60,60,56, 0\.9\); \}/, 'Stone: its ink');
  assert.match(css, /:root\[data-plus-theme="iron"\] \.pickfeed-card \{ background-color: rgba\(40,48,58, 0\.9\); \}/, 'Iron: its panel, as before');
  const [, , pay] = claimHauls({ marks: { struck: 1, balance: 1 }, deed: { struck: 1, guild: { name: 'G' } }, contracts: [{ contract: 'c', pay: 12345, tax: 1234, guild: { name: 'The Most Honourable Company of Wayrest Defenders' } }] }, 'raid');
  assert.equal(haulWords(pay).sub, 'Contract (1,234 tax) - The Most Honourable Company of Wayrest Defenders');
  const raf0 = globalThis.requestAnimationFrame;
  globalThis.requestAnimationFrame = () => null;
  try {
    withPage((p) => {
      showHaul(harvestHauls({ motherlode: true, node: 'mlode:1:0', material: 'ore:ebony', qty: 6, marks: { struck: 0, balance: 10_000_000, why: 'full' }, lode: { struck: 3, strikers: 20 } }));
      assert.equal(find(p.cards()[0], 'haul-coin')[0].hidden, true, 'no silver, no coin');
      showHaul(harvestHauls({ motherlode: true, node: 'mlode:1:1', material: 'ore:ebony', qty: 6, marks: { struck: 10, balance: 70 }, lode: { struck: 4, strikers: 20 } }));
      assert.equal(find(p.cards()[0], 'haul-coin')[0].hidden, false);
    });
  } finally { globalThis.requestAnimationFrame = raf0; }
});

test('AUDIT HAUL-CARDS A3: a harvest answered while the world is not live (a window over it) says its lines, never a card the window\'s door takes down unseen (mutants: the card asked on a held world)', outside(async () => {
  const cards = [];
  const r = rig({ answer: iron, haul: (e) => { cards.push(e); return true; } });
  await r.stand();
  await r.mine(0);
  assert.equal(cards.length, 1, 'a live world: the card');
  // the act ends on a live world; its answer lands after a window opened over it
  const world = { ok: true };
  const slow = rig({ answer: async (b) => { world.ok = false; return iron(b); }, haul: (e) => { cards.push(e); return true; }, live: world });
  await slow.stand();
  await slow.mine(0);
  assert.equal(cards.length, 1, 'no card on a held world');
  assert.equal(slow.said[0], '+3 Iron to your Stores', 'its lines instead');
}));
