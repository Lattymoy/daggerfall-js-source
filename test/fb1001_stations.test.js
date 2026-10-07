// AUDIT 2026-10-01 part four (Mac: "...and also ensure the other professions are sound") - THE STATIONS' COUNTERS.
//
// CHARCOAL-BUY. The Forge says "Steel wants Charcoal: a log burns to it here (Logging's), and the smith sells it" - and the
// smith's stock was bought only from an anvil recipe short of one of its inputs. No anvil recipe takes Charcoal, so its
// counter never stood anywhere: a smith who fells no tree smelted no Steel (no chain, no Steel blade or plate, no Steel
// kit), though the service sells it (`/v1/prof/stock wood:charcoal`). Now the Forge offers it, at a smith's forge.
//
// COUNTER-GATES. AUDIT 32 P6 gave the loom's Weavers counter its gates - offered only while Marks are struck, the price
// held or said before the press - and the anvil's and the workbench's counters took neither: offered with Marks shut or
// none held, and refused after the press. Now every counter is one buy (ui/profPages.js counterBuy). The real Stores
// page over the DOM (test/audit32_pages's harness, lane 3's reproduction turned).
import './chargenDom.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { xpForRank, stockOf } from '../src/net/professionLaw.js';
import { setProfessionsPages, drawStoresPage, resetProfPages } from '../src/ui/profPages.js';
import { setPref } from '../src/systems/uiPrefs.js';

const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
const kit = { el, divider: (w) => el('h3', null, w), meter: () => el('div') };
/** The Stores page with Smithing and Carpentry at 60, `heldIn` in the Stores, the provider's doors `over`. */
function pages(over = {}, heldIn = {}) {
  resetProfPages();
  setPref('gentleActs', false);
  const held = new Map(Object.entries({ 'ingot:iron': 9, 'metal:copper': 9, ...heldIn }));
  const tracks = new Map([['smithing', { profession: 'smithing', xp: xpForRank(60), rank: 60, specs: { 50: null, 100: null } }], ['carpentry', { profession: 'carpentry', xp: xpForRank(60), rank: 60, specs: { 50: null, 100: null } }]]);
  const book = {
    state: { open: true, day: 1, character: 'c', account: 'a', readAt: Date.now(), stores: new Map(), tracks, today: {}, caps: {} }, stale: () => false, refresh: async () => ({ ok: true }),
    held: (k) => held.get(k) ?? 0, store: (k) => ({ material: k, own: held.get(k) ?? 0, bought: 0 }),
    track: (p) => tracks.get(p) ?? { profession: p, xp: 0, rank: 0, specs: { 50: null, 100: null } }, pendingWithdrawals: 0, pendingCrafts: 0,
  };
  const calls = [];
  setProfessionsPages({
    book, name: (k) => k, withdraw: async () => ({ ok: true, text: '' }), loom: () => null,
    smelt: async () => ({ ok: true, text: '' }), craft: async () => ({ ok: true, text: '' }),
    stock: async (m, n, c) => { calls.push(['stock', m, n, ...(c ? [c] : [])]); return { ok: true, text: 'bought' }; },
    heatBand: () => 1, planeBand: () => 1, purse: () => 1000, marks: () => 500, marksOpen: () => true, ...over,
  });
  let root = null;
  const draw = () => { root?.remove?.(); root = el('div'); document.body.append(root); drawStoresPage(root, draw, kit); };
  draw();
  const buttons = () => [...root.querySelectorAll('button')];
  const btn = (words) => buttons().find((b) => b.textContent.startsWith(words));
  return { calls, btn, text: () => root.textContent };
}
const done = () => { resetProfPages(); setProfessionsPages(null); };

test('CHARCOAL-BUY: at a smith\'s forge with no Charcoal held, the Forge offers the smith\'s - one Steel smelt\'s worth, bought through the stock door; at home, or with Charcoal held, no counter (mutants: the Forge offers none)', async () => {
  const sale = stockOf('wood:charcoal');
  assert.ok(sale, 'the smith sells Charcoal');
  const p = pages({ forge: () => ({ kind: 'shop', fee: 50 }), workbench: () => null });
  try {
    assert.match(p.text(), /Steel wants Charcoal: a log burns to it here \(Logging's\), and the smith sells it\./);
    const buy = p.btn('Buy 1 from the smith');
    assert.ok(buy, `the counter stands at the Forge: ${p.text().slice(0, 400)}`);
    assert.equal(buy.textContent, `Buy 1 from the smith - ${sale.marks} silver`);
    assert.equal(buy.disabled, false);
    await buy.onclick();
    assert.deepEqual(p.calls.at(-1), ['stock', 'wood:charcoal', 1], 'Charcoal, from the smith');
  } finally { done(); }
  const home = pages({ forge: () => ({ kind: 'home', fee: 0 }), workbench: () => null });
  try {
    assert.match(home.text(), /Steel wants Charcoal/);
    assert.equal(home.btn('Buy 1 from the smith'), undefined, 'your own forge has no counter');
  } finally { done(); }
  const stocked = pages({ forge: () => ({ kind: 'shop', fee: 50 }), workbench: () => null }, { 'wood:charcoal': 3 });
  try {
    assert.doesNotMatch(stocked.text(), /Steel wants Charcoal/);
    assert.equal(stocked.btn('Buy 1 from the smith'), undefined, 'Charcoal held: no word, no counter');
  } finally { done(); }
});

test('COUNTER-GATES: the anvil\'s and the workbench\'s counters keep the loom\'s gates - none with Marks shut; held and said with too few; offered with enough (mutants: the gates dropped)', async () => {
  // PIN MOVED (CRAFT2, Professions-Arc 41.5): the anvil lists its patterns, the material chosen in the box - the Longsword, in Iron
  const anvil = (o) => { const p = pages({ forge: () => ({ kind: 'shop', fee: 50 }), workbench: () => null, ...o }); p.btn('Weapons').onclick(); p.btn('Longsword').onclick(); p.btn('Iron').onclick(); return p; };
  const bench = (o) => { const p = pages({ forge: () => null, workbench: () => ({ kind: 'shop', fee: 50 }), ...o }, { 'plank:pine': 8 }); p.btn('Furniture').onclick(); p.btn('Plain Single Bed').onclick(); return p; };   // PIN MOVED (CRAFT2): the bed a pattern, its wood the box's
  for (const [who, open, words] of [['the anvil', anvil, 'Buy 1 from the smith'], ['the workbench', bench, 'Buy 2 from the furnisher']]) {
    let p = open({ marksOpen: () => false });
    try { assert.equal(p.btn(words), undefined, `${who}: Marks shut - no counter`); } finally { done(); }
    p = open({ marks: () => 0 });
    try {
      const buy = p.btn(words);
      assert.ok(buy, `${who}: offered`);
      assert.equal(buy.disabled, true, `${who}: 0 Drakes held - held`);
      assert.match(p.text(), /you hold 0 silver/, `${who}: and said`);
    } finally { done(); }
    p = open({});
    try {
      const buy = p.btn(words);
      assert.equal(buy?.disabled, false, `${who}: Marks enough - pressable`);
      await buy.onclick();
      assert.equal(p.calls.length, 1, `${who}: bought`);
    } finally { done(); }
  }
});

// ─── PAD-CLASSIC ─────────────────────────────────────────────────────

test('PAD-CLASSIC: on the classic skin the pad\'s A over the Stores page presses its button - the page is DOM on every skin; over a classic window (the canvas) A stays the canvas\'s (mutants: the page clicked under Plus alone)', async () => {
  const { createBindings, resetDefaults } = await import('../src/systems/inputActions.js');
  const { setBindings } = await import('../src/ui/input.js');
  const { attachGamepad } = await import('../src/ui/gamepadInput.js');
  const { _resetForTests: resetPrefs } = await import('../src/systems/uiPrefs.js');
  const { _resetForTests: resetSettings } = await import('../src/systems/settings.js');
  const hadWindow = 'window' in globalThis, prevWindow = globalThis.window, prevFrom = document.elementFromPoint;
  globalThis.window = { addEventListener() {}, removeEventListener() {}, dispatchEvent() {} };
  const heard = [];
  const button = { dispatchEvent: (e) => { heard.push(e.type); return true; }, closest: () => null };
  try {
    for (const [skin, under] of [['classic', button], ['enhanced', button], ['classic', null]]) {
      heard.length = 0;
      resetPrefs(); resetSettings();
      setPref('skin', skin);
      const store = createBindings(); resetDefaults(store); setBindings(store);
      const canvasEvents = [];
      const canvas = { dispatchEvent: (e) => { canvasEvents.push(e.type); return true; }, getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }), style: {} };
      document.elementFromPoint = () => under ?? canvas;
      const pad = { connected: true, mapping: 'standard', id: 'Xbox 360 Controller (XInput STANDARD GAMEPAD)', axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })) };
      const gp = attachGamepad(canvas, { overlayActive: () => true, paused: () => true, attack() {}, look() {} },
        { getPads: () => [pad], dispatch: () => {}, makeEvent: (type, init) => ({ type, ...init }) });
      for (let i = 0; i < 3; i++) gp.tick(1 / 60);
      pad.buttons[0] = { pressed: true, value: 1 }; gp.tick(1 / 60);   // A, the cursor over the page's button
      pad.buttons[0] = { pressed: false, value: 0 }; gp.tick(1 / 60);
      gp.dispose();
      const clicks = heard.filter((t) => !t.includes('move'));
      const onCanvas = canvasEvents.filter((t) => t !== 'pointermove');
      if (under) {
        assert.deepEqual(clicks, ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click'], `${skin}: the page's button is pressed`);
        assert.deepEqual(onCanvas, [], `${skin}: and the canvas hears nothing of it`);
      } else {
        assert.deepEqual(clicks, [], 'a classic window (the canvas under the cursor): no DOM click');
        assert.deepEqual(onCanvas, ['pointerdown', 'pointerup'], 'the canvas\'s, as ever');
      }
    }
  } finally {
    document.elementFromPoint = prevFrom;
    if (hadWindow) globalThis.window = prevWindow; else delete globalThis.window;
    resetPrefs(); resetSettings();
  }
});
