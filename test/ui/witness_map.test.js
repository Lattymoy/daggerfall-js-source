// WITNESS-MAP (2026-10-31, Discord #feature-feedback, Sammy: "Display on the world map 'witnessed areas' for stuff like
// ores and pearls."; the original ask, FIELD BUGS 2026-10-11d: "how are we supposed to tell if higher tier veins have been
// unlocked in an area?"). The held map washes each pixel three accounts have confirmed, beside a legend row and a switch.
// PIN MOVED (AUDIT FB1031 W1-W4): the service's region read, its keep and its cap, the book's regions, the reader's
// sample and the overlay's paint gave way to the day's tiles - their pins are test/ui/fb1031_witness.test.js.
// bible/06-Systems/Professions-Arc.md section 61, bible/10-UI/Held-Map-Arc.md WITNESS-MAP. tools/mutants/witness_map.json.
import '../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { WITNESS_TINT_CSS, WITNESS_SWATCH_CSS, WITNESS_LEGEND_TEXT } from '../../src/ui/witnessMapMark.js';
import { HeldMapWindow } from '../../src/ui/heldMap.js';
import { travelMapFilters, resetTravelMapState, travelMapSaveData, restoreTravelMapSaveData } from '../../src/systems/travel/travelMapState.js';
import { CLIMATES as MAP_CLIMATES } from '../../src/formats/mapsFile.js';

const src = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const DAGGERFALL = 17;

function recordingCtx() {
  const calls = [];
  const state = {};
  return new Proxy({}, {
    get: (_, k) => {
      if (k === 'calls') return calls;
      if (k === 'measureText') return (txt) => ({ width: String(txt).length * 6 });
      if (k in state) return state[k];
      return (...args) => { calls.push({ fn: k, args, fillStyle: state.fillStyle }); };
    },
    set: (_, k, v) => { state[k] = v; return true; },
  });
}

// ─── THE HELD MAP ────────────────────────────────────────────────────

function fakeDocument() {
  const node = (tag = 'div') => {
    const n = {
      tagName: String(tag).toUpperCase(), children: [], style: {}, dataset: {}, attrs: {}, className: '', textContent: '', id: '', title: '',
      classList: { toggle() {}, add() {}, remove() {}, contains: () => false },
      append(...k) { n.children.push(...k); }, remove() { n.removed = true; },
      replaceChildren(...k) { n.children = [...k]; },
      addEventListener() {}, removeEventListener() {}, setPointerCapture() {}, querySelectorAll: () => [],
      setAttribute(k, v) { n.attrs[k] = v; },
      set innerHTML(v) { n.children = []; }, get innerHTML() { return ''; },
    };
    if (n.tagName === 'CANVAS') n.getContext = () => recordingCtx();
    return n;
  };
  return { createElement: (t) => node(t), getElementById: () => null, head: node(), body: node(), addEventListener() {}, removeEventListener() {} };
}
const withDocument = (fn) => { globalThis.document = fakeDocument(); try { return fn(); } finally { delete globalThis.document; } };
const texts = (n) => [n.textContent, ...(n.children ?? []).flatMap(texts)].filter(Boolean);

/** A held map over a host reader that answers `pixels` (one tile's) for any view, its professions `open`. */
function mapRig({ pixels = [[410, 152], [404, 152]], open = true, ore = null } = {}) {
  const asked = [];
  const read = { key: `k${pixels.length}`, tiles: pixels.length ? [{ tx: 6, ty: 2, pixels }] : [], x0: 256, y0: 0, x1: 640, y1: 320 };
  const witnessed = { open: () => open, read: (box) => { asked.push(box); return read; } };
  const win = new HeldMapWindow({
    getPlayerPixel: () => ({ x: 405, y: 150 }), getClimateIndex: () => MAP_CLIMATES.Woodlands,
    woods: { heightMapBuffer: new Uint8Array(1000 * 500).fill(10) }, mapSize: { width: 1000, height: 500 },
    maps: { getPoliticIndex: () => 128 + DAGGERFALL, regionCount: 62 },
    gold: () => 0, goldPieces: () => 0, hasHorse: false, hasCart: false, hasShip: false, diseaseCount: () => 0, poisonCount: () => 0,
    witnessed, oreAt: ore,
  });
  win._paper = { w: 600, h: 300, dpr: 1, k: 1 };
  win._view = { ox: 380, oy: 140, scale: 6 };
  return { win, asked };
}

test('WITNESS-MAP the held map: the witnessed ground about the view read on the poll and painted, a legend row while any shows, a switch on the key (on by default) that hides it, none read in the far band; the ORE-MAP card still answers a witnessed pixel (mutants: the switch unread; the far band read; the legend row gone; the key row shown shut; the wash never painted)', () => withDocument(() => {
  resetTravelMapState();
  try {
    assert.equal(travelMapFilters().witnessed, false, 'shown by default (the store\'s inversion)');
    const card = { title: 'Ore here', lines: ['Witnessed ground: every vein can appear here'] };
    const { win, asked } = mapRig({ ore: () => card });
    win._refreshParty();
    assert.deepEqual(asked.at(-1), { x0: 380, y0: 140, x1: 480, y1: 190 }, 'the view\'s box in world pixels');
    assert.deepEqual(win._witnessed.flatMap((t) => t.pixels), [[410, 152], [404, 152]]);
    win._renderLegend();
    assert.ok(texts(win._chrome.legend).includes(WITNESS_LEGEND_TEXT), 'the legend names the wash');
    win._keySig = ''; win._renderKey();
    const sw = win._chrome.key.children.flatMap((r) => r.children?.[1]?.children ?? []).find((b) => b.dataset?.filter === 'witnessed');
    assert.ok(sw, 'the key\'s switch');
    assert.equal(sw.className.includes(' on'), true);
    // PIN MOVED (AUDIT FB1031 W2): the kept layer paints the ground - here, with no image data, each pixel's square
    const ctx = recordingCtx();
    win._paintWash(ctx, { view: win._view, paperW: 600, paperH: 300, dpr: 1 });
    assert.deepEqual(ctx.calls.filter((c) => c.fn === 'rect').map((c) => c.args), [[180, 72, 6, 6], [144, 72, 6, 6]], 'each its own map pixel');
    assert.equal(ctx.calls.filter((c) => c.fn === 'fill' && c.fillStyle === WITNESS_TINT_CSS).length, 1, 'in one fill of the wash');
    assert.match(WITNESS_TINT_CSS, /^rgba\(184, 98, 36, 0\.42\)$/);
    assert.equal(WITNESS_SWATCH_CSS, '#b86224');
    const leg = win._chrome.legend.children;
    const swatch = leg[leg.findIndex((n) => n.textContent === WITNESS_LEGEND_TEXT) - 1];
    assert.deepEqual([swatch.style.background, swatch.style.borderRadius], [WITNESS_SWATCH_CSS, '2px'], 'its swatch square, as the pixels it washes');
    // the switch hides it, and the poll lets it go
    win._phase = 'map';
    sw.onclick();
    assert.equal(travelMapFilters().witnessed, true);
    win._refreshParty();
    assert.deepEqual(win._witnessed, []);
    assert.equal(travelMapSaveData().filterWitnessed, true, 'kept with the save, as the roads\' switches are');
    restoreTravelMapSaveData({});
    assert.equal(travelMapFilters().witnessed, false, 'an older save shows it');
    // the far band reads none (AUDIT FB1031 W1: a tile is some 95 paper pixels at the Bay's fit), and its switch is dimmed
    const far = mapRig();
    far.win._view = { ox: 0, oy: 0, scale: 1 };
    far.win._refreshParty();
    assert.deepEqual([far.asked, far.win._witnessed], [[], []]);
    far.win._keySig = ''; far.win._renderKey();
    const fsw = far.win._chrome.key.children.flatMap((r) => r.children?.[1]?.children ?? []).find((b) => b.dataset?.filter === 'witnessed');
    assert.equal(fsw.className.includes('dim'), true, 'dimmed where it washes nothing');
    assert.equal(sw.className.includes('dim'), false);
    // the ORE-MAP card over a witnessed pixel
    const hover = win._hoverLabel(30 * 6 + 3, 12 * 6 + 3);
    assert.deepEqual(hover.tip?.lines, card.lines, 'the card, not the wash, answers the hover');
    // professions shut: no row on the key
    const shut = mapRig({ open: false });
    shut.win._keySig = ''; shut.win._renderKey();
    assert.equal(shut.win._chrome.key.children.flatMap((r) => r.children?.[1]?.children ?? []).some((b) => b.dataset?.filter === 'witnessed'), false);
  } finally { resetTravelMapState(); }
}));

test('WITNESS-MAP the wiring: the world host hands the held map its reader in one entry, online alone; the classic region page is left as it was', () => {
  const w = src('src/scenes/world.js');
  assert.match(w, /\n {6}witnessed: profBook \? witnessMapReader\(profBook\) : null,/);   // PIN MOVED (AUDIT FB1031 W1): no region, so no maps
  assert.equal([...w.matchAll(/witnessMapReader/g)].length, 2, 'the import and the one entry');
  assert.doesNotMatch(src('src/ui/travel/travelMapWindow.js'), /witness/i, 'the classic page paints no wash (Held-Map-Arc.md WITNESS-MAP)');
});
