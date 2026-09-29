// FIELD BUGS 2026-09-29d - MAP-KEY (Jigglehimmer on Discord, #suggestions: "Enhanced map needs filterable key like
// the default Daggerfall world map" - "cemeteries were red dots, and dungeons were orange dots"). The held map's KEY:
// the classic window's four filters as toggles on the SAME live store, through the classic window's own flip
// (ui/travelMapWindow.js flipTravelMapFilter, DFU's FilterButtonClickHandler); every glyph inked in its classic dot's
// hue walked toward the pen (ui/inkMap.js markInks over the colours the classic loader reads off FMAP_PAL.COL); and the
// key saying which glyph is which, in the ink the sheet lays it in. bible/10-UI/Held-Map-Arc.md MAP-KEY.
//
// The window is driven whole on a fake document whose canvases RECORD, so the pins read what the sheet really inks
// and what the key really shows. The palette is ARENA2 data: here it is an invented one fed through the real classic
// loader, and the one measurement that needs the player's own colours runs where ARENA2_PATH points at them.
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

import { HeldMapWindow } from '../src/ui/heldMap.js';
import {
  mapKeyGroups, markInks, markInk, markKind, quarterInk, paintGlyph, KIND_WORD, KEY_CHIP_PX,
  MARK_INK_MIX, QUARTER_INK_MIX, QUARTER_INK_A, QUARTER_INK_DE, QUARTER_INK_PAPER_DE, INK_RGB, PARCHMENT_RGB,
  PEN, toPaper, mixRgb, rgba,
} from '../src/ui/inkMap.js';
import {
  TravelMapWindow, flipTravelMapFilter, travelMapDotColors, preloadTravelMapArt, _setTravelMapArtForTests,
  LOCATION_PIXEL_COLOR_INDICES, FILTER_SRC,
} from '../src/ui/travelMapWindow.js';
import { travelMapFilters, travelMapSaveData, resetTravelMapState } from '../src/systems/travelMapState.js';
import { DFPalette } from '../src/formats/dfPalette.js';
import { CLIMATES, LOCATION_TYPES } from '../src/formats/mapsFile.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const code = (p) => read(p).replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

beforeEach(() => resetTravelMapState());
afterEach(() => _setTravelMapArtForTests(null));

// ── the harness: a document whose canvases record every call and the pens it was made in ─────────────────────────
function recordingCtx() {
  const calls = [];
  const state = {};
  return new Proxy({}, {
    get: (_, k) => {
      if (k === 'calls') return calls;
      if (k === 'measureText') return (t) => ({ width: String(t).length * 6 });
      if (k in state) return state[k];
      return (...args) => { calls.push({ fn: k, args, strokeStyle: state.strokeStyle, fillStyle: state.fillStyle, lineWidth: state.lineWidth }); };
    },
    set: (_, k, v) => { state[k] = v; return true; },
  });
}
function fakeDocument() {
  const node = (tag = 'div') => {
    const cls = new Set();   // the classes a window toggles on a node (className is what el() mints)
    const n = {
      tagName: String(tag).toUpperCase(), children: [], style: {}, dataset: {}, attrs: {},
      className: '', textContent: '', id: '',
      classList: {
        toggle(c, on) { const want = on === undefined ? !cls.has(c) : !!on; if (want) cls.add(c); else cls.delete(c); return want; },
        add(c) { cls.add(c); }, remove(c) { cls.delete(c); }, contains: (c) => cls.has(c),
      },
      append(...k) { n.children.push(...k); },
      remove() { n.removed = true; },
      addEventListener(t, fn) { (n.listeners ||= []).push([t, fn]); }, removeEventListener() {},
      setPointerCapture() {}, querySelectorAll: () => [],
      setAttribute(k, v) { n.attrs[k] = v; },
      set innerHTML(v) { n.children = []; }, get innerHTML() { return ''; },
    };
    if (n.tagName === 'CANVAS') { let ctx = null; n.getContext = () => (ctx ??= recordingCtx()); }
    return n;
  };
  return { createElement: (t) => node(t), getElementById: () => null, head: node(), body: node(), addEventListener() {}, removeEventListener() {} };
}
function withDocument(fn) {
  globalThis.document = fakeDocument();
  try { return fn(globalThis.document); } finally { delete globalThis.document; }
}

/** One place of every glyph on a ten-pixel bay - and the keep and the ruin, which share the labyrinth's glyph. */
const PLACES = [
  ['DungeonLabyrinth', 1, 2], ['DungeonKeep', 3, 2], ['DungeonRuin', 5, 2], ['Graveyard', 7, 2],
  ['Coven', 1, 4], ['HomeFarms', 3, 4], ['ReligionTemple', 5, 4], ['ReligionCult', 7, 4],
  ['Tavern', 1, 6], ['TownCity', 3, 6], ['TownHamlet', 5, 6], ['TownVillage', 7, 6],
];
const summaryOf = (x, y, locationType) => ({ id: y * 1000 + x, mapID: y * 1000 + x, regionIndex: 17, mapIndex: 3, locationType, discovered: true });
function placesDict() {
  const d = new Map();
  for (const [t, x, y] of PLACES) { const s = summaryOf(x, y, LOCATION_TYPES[t]); d.set(s.id, s); }
  return d;
}
const mkWin = (extra = {}) => new HeldMapWindow({
  getPlayerPixel: () => ({ x: 9, y: 9 }), getClimateIndex: () => CLIMATES.Woodlands,
  woods: { heightMapBuffer: new Uint8Array(100).fill(10) }, mapSize: { width: 10, height: 10 },
  mapDict: placesDict(), gold: () => 10000, goldPieces: () => 10000, hasHorse: false, hasCart: false, hasShip: false,
  diseaseCount: () => 0, poisonCount: () => 0, ...extra,
});
/** The sheet rises (MAP-FIELD7) - the key's presses are the MAP phase's. */
const open = (win) => { for (let i = 0; i < 20; i++) win.tick(0.05); return win; };

const rows = (win) => win._chrome.key.children;
const toggleOf = (win, f) => rows(win).map((r) => r.children[0]).find((b) => b.dataset.filter === f);
const itemsOf = (win) => rows(win).flatMap((r) => r.children[1].children);
const kindsOnSheet = (win) => [...new Set(win._sheets.get('world').ensure().marks.map((m) => m.kind))].sort();

/** An invented palette (never Daggerfall's): a distinct colour at each dot's FMAP_PAL entry, as a 776-byte .COL. */
const INVENTED = (b) => [30 + 15 * b, 220 - 12 * b, 60 + 9 * b];
function inventedCol() {
  const bytes = new Uint8Array(776);
  LOCATION_PIXEL_COLOR_INDICES.forEach((idx, b) => bytes.set(INVENTED(b), 8 + (idx * 3)));
  return bytes;
}
/** The REAL classic loader, fed the invented palette and blank art - the host's boot preload, in node. */
async function loadClassicArt(col = inventedCol()) {
  _setTravelMapArtForTests(null);
  await preloadTravelMapArt({
    renderer: { uploadTexture: () => 'tex', releaseTexture: () => {}, drawScreenQuad: () => {} },
    palette: new DFPalette(),
    fetchBytes: async (n) => {
      if (n === 'FMAP_PAL.COL') return col;
      if (n === 'TEXT.RSC') throw new Error('no text');
      return new Uint8Array(64000);
    },
  });
}
/** DFU's own table, GetPixelColorIndex (:1369-1431): each glyph kind's FIRST bucket. */
const HEAD = { dungeon: 0, graveyard: 3, coven: 4, home: 5, temple: 8, cult: 9, tavern: 10, city: 11, hamlet: 12, village: 13 };
const tintOf = (rgb) => rgba(mixRgb(rgb, INK_RGB, MARK_INK_MIX), QUARTER_INK_A);

/** The pens the glyph at paper (x, y) was laid in: every path call paintGlyph makes there, halo pass and ink pass. */
function pensAt(calls, x, y) {
  const near = calls.filter((c) => ['moveTo', 'arc', 'rect'].includes(c.fn) && Math.abs(c.args[0] - x) <= 7 && Math.abs(c.args[1] - y) <= 7);
  return { stroke: [...new Set(near.map((c) => c.strokeStyle))].sort(), fill: [...new Set(near.map((c) => c.fillStyle))].sort(), n: near.length };
}
/** Repaint the kept static layer and answer what it inked. */
function repaint(win) {
  const calls = win._layer.getContext('2d').calls;
  calls.length = 0;
  win._staticKey = '';
  win._dirty = true;
  win.tick(0.016);
  return calls;
}

/** CIE76 over sRGB - townsheet.test.js's measure (test scaffolding: nothing at runtime measures a colour). */
function deltaE(p, q) {
  const lin = (v) => { const u = v / 255; return u <= 0.04045 ? u / 12.92 : ((u + 0.055) / 1.055) ** 2.4; };
  const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const lab = ([r, g, b]) => {
    const [R, G, B] = [lin(r), lin(g), lin(b)];
    const X = f((R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047);
    const Y = f(R * 0.2126 + G * 0.7152 + B * 0.0722);
    const Z = f((R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883);
    return [116 * Y - 16, 500 * (X - Y), 200 * (Y - Z)];
  };
  const [a, b] = [lab(p), lab(q)];
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

test('MAP-KEY: the key is the classic window\'s four filters, each with the kinds GetPixelColorIndex hides under it - asked of the law, never copied (mutants: FB0929D-MAPKEY-the-filter-asks-nothing, FB0929D-MAPKEY-the-label-is-the-store-word)', () => {
  // DFU's own ranges (DaggerfallTravelMapWindow.cs:1421-1430) through markKind's glyphs, in the bar's order (:122-125)
  assert.deepEqual(mapKeyGroups().map((g) => ({ ...g, buckets: [...g.buckets], kinds: [...g.kinds] })), [
    { filter: 'dungeons', label: 'Dungeons', buckets: [0, 1, 2, 3, 4], kinds: ['dungeon', 'graveyard', 'coven'] },
    { filter: 'temples', label: 'Temples', buckets: [8, 9], kinds: ['temple', 'cult'] },
    { filter: 'homes', label: 'Homes', buckets: [5, 6, 7], kinds: ['home'] },
    { filter: 'towns', label: 'Towns', buckets: [10, 11, 12, 13], kinds: ['tavern', 'city', 'hamlet', 'village'] },
  ]);
  assert.deepEqual(mapKeyGroups().map((g) => g.filter), Object.keys(FILTER_SRC), 'the classic bar\'s own four buttons, in its order');
  // the four hide every dot the classic window draws, and each dot is ONE filter's
  const all = mapKeyGroups().flatMap((g) => g.buckets);
  assert.deepEqual([...all].sort((a, b) => a - b), [...Array(14).keys()]);
  // and the key has a word for every glyph markKind can ink
  assert.deepEqual(Object.keys(KIND_WORD).sort(), [...new Set([...Array(14).keys()].map(markKind))].sort());
  assert.equal(KIND_WORD.graveyard, 'Graveyard');
  // no range table was typed into the ink module: the groups are ASKED
  assert.match(code('src/ui/inkMap.js'), /getPixelColorIndex\(t, \{ \[filter\]: true \}\) < 0/);
});

test('MAP-KEY: a press flips the LIVE store through the classic window\'s own flip - the sheet re-inks without the kinds, the save carries it, the classic window agrees both ways (mutants: FB0929D-MAPKEY-the-flip-only-hides, FB0929D-MAPKEY-the-flip-takes-any-name, FB0929D-MAPKEY-the-press-leaves-the-marks, FB0929D-MAPKEY-the-press-flips-a-copy, FB0929D-MAPKEY-the-classic-flips-its-own-copy)', () => {
  // the law itself: TRUE hides (DFU's inversion), a name that is no filter changes nothing
  const f = { dungeons: false, towns: true };
  assert.equal(flipTravelMapFilter(f, 'dungeons'), true);
  assert.equal(flipTravelMapFilter(f, 'towns'), true);
  assert.deepEqual(f, { dungeons: true, towns: false });
  assert.equal(flipTravelMapFilter(f, 'dragons'), false);
  assert.deepEqual(f, { dungeons: true, towns: false }, 'no new flag is minted by a stray name');
  assert.equal(flipTravelMapFilter(null, 'towns'), false);

  withDocument(() => {
    const win = open(mkWin());
    assert.equal(win.filters, travelMapFilters(), 'the key presses the store object itself, as the classic window does');
    assert.deepEqual(kindsOnSheet(win), ['city', 'coven', 'cult', 'dungeon', 'graveyard', 'hamlet', 'home', 'tavern', 'temple', 'village']);
    const keyBefore = win._sheets.get('world').staticKey();
    toggleOf(win, 'towns').onclick();
    assert.equal(travelMapFilters().towns, true, 'the store holds it');
    assert.equal(travelMapSaveData().filterTowns, true, 'and so the save does (TravelMapSaveData)');
    assert.deepEqual(kindsOnSheet(win), ['coven', 'cult', 'dungeon', 'graveyard', 'home', 'temple'], 'the towns are off the sheet');
    assert.notEqual(win._sheets.get('world').staticKey(), keyBefore, 'and the kept ink is stale, so it repaints');
    toggleOf(win, 'towns').onclick();
    assert.equal(travelMapFilters().towns, false, 'a second press shows them again');
    assert.equal(kindsOnSheet(win).length, 10);
    // the classic window reads the same store: a press there is seen by the next sheet, and one here by it
    toggleOf(win, 'dungeons').onclick();
    win.dispose();
    const classic = new TravelMapWindow({});
    assert.equal(classic.filters, travelMapFilters());
    assert.equal(classic.filters.dungeons, true, 'the classic window opens on what the sheet last showed');
    classic._filterButtonClick('homes');
    const next = open(mkWin());
    assert.deepEqual(kindsOnSheet(next), ['city', 'cult', 'hamlet', 'tavern', 'temple', 'village'], 'and the sheet on what the classic window set');
    assert.doesNotMatch(toggleOf(next, 'homes').className, /\bon\b/);
    next.dispose();
  });
  // ONE flip, both skins: the classic handler presses it, and the held map writes no flag of its own
  assert.match(read('src/ui/travelMapWindow.js'), /_filterButtonClick\(which\) \{\s*\n\s*if \(!flipTravelMapFilter\(this\.filters, which\)\) return;/);
  assert.doesNotMatch(code('src/ui/heldMap.js'), /filters\[[^\]]+\]\s*=[^=]/, 'no second copy of the flip');
});

test('MAP-KEY: the key holds none of the sheet\'s keys or presses - M and Escape still close, no toggle takes the focus, a press under a box or before the sheet is up does nothing, it steps aside for a phone\'s card, and it is the bay\'s alone (mutants: FB0929D-MAPKEY-a-toggle-takes-the-tab, FB0929D-MAPKEY-a-toggle-takes-the-focus, FB0929D-MAPKEY-a-box-does-not-hold-the-key, FB0929D-MAPKEY-the-key-sits-on-the-card, FB0929D-MAPKEY-the-key-stands-over-the-card, FB0929D-MAPKEY-the-key-stays-on-the-town, FB0929D-MAPKEY-the-key-never-comes-back, FB0929D-MAPKEY-the-key-lets-presses-through, FB0929D-MAPKEY-the-key-floats)', () => {
  withDocument(() => {
    const win = mkWin();
    // a press while the sheet is still rising is not a press on the map
    toggleOf(win, 'towns').onclick();
    assert.equal(travelMapFilters().towns, false, 'the sheet is still rising');
    open(win);
    const { root, stage, key } = win._chrome;
    const foot = root.children.find((c) => c.children.includes(key));
    assert.ok(foot && foot.className === 'hmfoot', 'the key is the foot\'s');
    const inStage = (n) => n === key || n.children.some(inStage);
    assert.equal(inStage(stage), false, 'and never the stage\'s, so no press on it pans, picks or marks the sheet');
    for (const f of Object.keys(FILTER_SRC)) {
      const b = toggleOf(win, f);
      assert.equal(b.type, 'button');
      assert.equal(b.tabIndex, -1, `${f}: out of the tab order`);
      let prevented = false;
      b.onpointerdown({ preventDefault: () => { prevented = true; } });
      assert.equal(prevented, true, `${f}: a press takes no focus, so Space or Enter never presses it again`);
    }
    // a box holds the whole sheet (AUDIT-MAP H6): the resume prompt, the I/H box
    win._top = 'resume';
    toggleOf(win, 'towns').onclick();
    assert.equal(travelMapFilters().towns, false, 'the resume prompt holds the key');
    win._top = null;
    win._info = { title: '', rows: ['x'], cells: [] };
    toggleOf(win, 'towns').onclick();
    assert.equal(travelMapFilters().towns, false, 'and so does the I box');
    win._info = null;
    toggleOf(win, 'towns').onclick();
    assert.equal(travelMapFilters().towns, true, 'with neither up, a press is a press');
    // a picked place's card: under 860px it rides up over where the key stands, so the key steps aside while it is up
    assert.equal(root.classList.contains('hmcardup'), false);
    win._select(win._sheets.get('world').ensure().marks[0]);
    assert.equal(root.classList.contains('hmcardup'), true, 'the card is up');
    win._select(null);
    assert.equal(root.classList.contains('hmcardup'), false, 'and the key is back the moment it goes');
    // the close ladder is untouched by it
    win.input('Escape', { preventDefault() {} });
    assert.equal(win._phase, 'closing', 'Escape still lowers the sheet');
    win.dispose();
  });
  withDocument(() => {
    // THE BAY'S CHROME: a town's plan claims no key, and the bay's tab brings it back
    const town = { gridW: 1, gridH: 1, blocks: [{ x: 0, y: 0, autoMap: new Uint8Array(64 * 64) }] };
    const win = open(mkWin({ town, where: () => ({ inLocation: true }), openOnSheet: 'town' }));
    assert.equal(win._slot.live, 'town');
    assert.equal(win._chrome.key.style.display, 'none', 'the plan of a town has no dots to filter');
    assert.equal(win._selectSheet('world'), true);
    assert.equal(win._chrome.key.style.display, '', 'the bay claims its key');
    win._selectSheet('town');
    assert.equal(win._chrome.key.style.display, 'none', 'and gives it back');
    win.dispose();
  });
  // it stands ON the foot (the row's own top edge), never at a guessed height, and it is a solid panel
  const css = read('src/ui/enhancedStyle.js');
  assert.match(css, /\.hmkey \{ position: absolute; left: 0; bottom: calc\(100% \+ 4px\);/);
  assert.match(css, /\.hmkey \{[^}]*pointer-events: auto; \}/);
  assert.match(css, /\.hmkeyflt \{ pointer-events: auto;/);
  assert.match(css, /@media \(max-width: 860px\) \{\s*\n\s*\.hmkey \{ max-width: calc\(100vw - 24px\); \}[\s\S]*?\.hmroot\.hmcardup \.hmkey \{ display: none; \}\s*\n\}/,
    'on a narrow screen the key steps aside for the card');
});

test('MAP-KEY: each glyph is inked in its classic dot\'s hue walked toward the pen - off the classic loader\'s own colours, its kind\'s FIRST bucket (the ruin in the labyrinth\'s), the halo the paper\'s; no palette, the pen (mutants: FB0929D-MAPKEY-the-unpack-swaps-green, FB0929D-MAPKEY-a-kind-takes-its-last-bucket, FB0929D-MAPKEY-the-mark-ink-is-the-quarters, FB0929D-MAPKEY-the-glyph-strokes-in-the-pen, FB0929D-MAPKEY-the-glyph-fills-in-the-pen, FB0929D-MAPKEY-the-paint-drops-the-inks, FB0929D-MAPKEY-the-sheet-hands-no-inks)', async () => {
  await loadClassicArt();
  // the door to the palette answers the loader's own colours, per bucket
  assert.deepEqual(travelMapDotColors(), LOCATION_PIXEL_COLOR_INDICES.map((_, b) => { const [r, g, bl] = INVENTED(b); return { r, g, b: bl }; }));
  // EM7's own hand, walked further: the quarter's law untouched, the mark's its law at MARK_INK_MIX
  const c = { r: 200, g: 100, b: 40 };
  assert.equal(quarterInk(c), rgba(mixRgb([200, 100, 40], INK_RGB, QUARTER_INK_MIX), QUARTER_INK_A));
  assert.equal(markInk(c), quarterInk(c, MARK_INK_MIX));
  const expected = Object.fromEntries(Object.entries(HEAD).map(([k, b]) => [k, tintOf(INVENTED(b))]));
  assert.deepEqual({ ...markInks(travelMapDotColors()) }, expected);
  assert.equal(markInks(null), null, 'no palette, no inks');
  withDocument(() => {
    const win = open(mkWin());
    const calls = repaint(win);
    const marks = win._sheets.get('world').ensure().marks;
    assert.equal(marks.length, PLACES.length);
    for (const m of marks) {
      const [x, y] = toPaper(win._view, m.x, m.y);
      const pens = pensAt(calls, x, y);
      assert.ok(pens.n >= 2, `${m.kind} at ${m.x},${m.y} was inked`);
      const want = [PEN.halo, expected[m.kind]].sort();
      assert.deepEqual(pens.stroke, want, `${m.kind} (bucket ${m.colorIndex}): stroked in the halo, then its kind's ink`);
      assert.deepEqual(pens.fill, want, `${m.kind} (bucket ${m.colorIndex}): filled likewise`);
    }
    // the keep and the ruin take the labyrinth's hue, not their own
    const ruin = marks.find((m) => m.colorIndex === 2);
    assert.equal(ruin.kind, 'dungeon');
    assert.notEqual(expected.dungeon, tintOf(INVENTED(2)));
    win.dispose();
  });
  // with no palette loaded the sheet keeps the pen it always had
  _setTravelMapArtForTests(null);
  withDocument(() => {
    const win = open(mkWin());
    const calls = repaint(win);
    for (const m of win._sheets.get('world').ensure().marks) {
      const [x, y] = toPaper(win._view, m.x, m.y);
      assert.deepEqual(pensAt(calls, x, y).stroke, [PEN.halo, PEN.line].sort(), `${m.kind}: the plain pen`);
    }
    win.dispose();
  });
});

test('MAP-KEY: a palette that lands after the sheet rose tints it at once - asked every tick until it answers, the kept ink and the key both repainted (mutants: FB0929D-MAPKEY-the-palette-is-asked-once, FB0929D-MAPKEY-the-kept-ink-ignores-the-palette, FB0929D-MAPKEY-the-landing-leaves-the-sheet-clean, FB0929D-MAPKEY-the-clock-never-asks)', async () => {
  withDocument(() => {
    _setTravelMapArtForTests(null);
    const win = open(mkWin());
    const dungeon = win._sheets.get('world').ensure().marks.find((m) => m.kind === 'dungeon');
    const [x, y] = toPaper(win._view, dungeon.x, dungeon.y);
    const layer = win._layer.getContext('2d').calls;
    assert.deepEqual(pensAt(layer, x, y).stroke, [PEN.halo, PEN.line].sort(), 'no palette yet: the pen');
    const chip = itemsOf(win).find((i) => i.dataset.kind === 'dungeon').children[0];
    assert.ok(chip.getContext('2d').calls.some((c) => c.strokeStyle === PEN.line), 'and the key\'s chip in the pen');
    for (let i = 0; i < 5; i++) win.tick(0.016);   // an idle sheet: nothing moves
    // the boot preload lands (world.js's preloadTravelMapArt), with the sheet up and nobody touching it
    _setTravelMapArtForTests({ locationPixelColors: LOCATION_PIXEL_COLOR_INDICES.map((_, b) => { const [r, g, bl] = INVENTED(b); return (((255 << 24) >>> 0) | (bl << 16) | (g << 8) | r) >>> 0; }) });
    layer.length = 0;
    win.tick(0.016);
    win.tick(0.016);
    const want = tintOf(INVENTED(HEAD.dungeon));
    assert.deepEqual(pensAt(layer, x, y).stroke, [PEN.halo, want].sort(), 'the sheet inks the dungeon orange without a pan');
    const chip2 = itemsOf(win).find((i) => i.dataset.kind === 'dungeon').children[0];
    assert.ok(chip2.getContext('2d').calls.some((c) => c.strokeStyle === want), 'and the key\'s chip with it');
    win.dispose();
  });
});

test('MAP-KEY: a key chip IS the sheet\'s glyph - paintGlyph\'s own path at the sheet\'s own size, haloed then inked in the kind\'s ink, on a square of the parchment (mutants: FB0929D-MAPKEY-the-chip-is-in-the-pen, FB0929D-MAPKEY-the-chip-has-no-paper)', async () => {
  await loadClassicArt();
  const inks = markInks(travelMapDotColors());
  withDocument(() => {
    const win = open(mkWin());
    const items = itemsOf(win);
    assert.deepEqual(items.map((i) => i.dataset.kind), ['dungeon', 'graveyard', 'coven', 'temple', 'cult', 'home', 'tavern', 'city', 'hamlet', 'village']);
    for (const item of items) {
      const kind = item.dataset.kind;
      const [chip, word] = item.children;
      assert.equal(word.textContent, KIND_WORD[kind]);
      assert.equal(chip.style.width, `${KEY_CHIP_PX}px`);
      const calls = chip.getContext('2d').calls;
      const paper = calls.find((c) => c.fn === 'fillRect');
      assert.deepEqual(paper?.args, [0, 0, KEY_CHIP_PX, KEY_CHIP_PX], `${kind}: the chip is a square of paper`);
      assert.equal(paper.fillStyle, rgba(PARCHMENT_RGB, 1));
      const ref = recordingCtx();
      paintGlyph(ref, kind, KEY_CHIP_PX / 2, KEY_CHIP_PX / 2, true);
      paintGlyph(ref, kind, KEY_CHIP_PX / 2, KEY_CHIP_PX / 2, false, inks[kind]);
      assert.deepEqual(calls.slice(calls.indexOf(paper) + 1), ref.calls, `${kind}: the sheet's own glyph, in its own ink`);
    }
    win.dispose();
  });
});

test('MAP-KEY: what the key says at each band - the far band inks the cities alone, so every other kind is dimmed with the reason; a hidden filter\'s row is struck; and it is rebuilt only when that changes (mutants: FB0929D-MAPKEY-the-key-reads-no-band, FB0929D-MAPKEY-the-toggle-lights-hidden, FB0929D-MAPKEY-the-key-is-rebuilt-every-tick, FB0929D-MAPKEY-the-dim-gives-no-reason)', () => {
  withDocument(() => {
    const win = open(mkWin());
    const dims = () => itemsOf(win).filter((i) => /\bdim\b/.test(i.className)).map((i) => i.dataset.kind);
    const at = (scale) => { win._view = { ox: 0, oy: 0, scale }; win._goal = { ...win._view }; win.tick(0.016); return dims(); };
    assert.deepEqual(at(1), ['dungeon', 'graveyard', 'coven', 'temple', 'cult', 'home', 'tavern', 'hamlet', 'village'], 'far: the cities alone are inked');
    const far = itemsOf(win).find((i) => i.dataset.kind === 'dungeon');
    assert.equal(far.title, 'Dungeon - zoom in to see');
    assert.equal(itemsOf(win).find((i) => i.dataset.kind === 'city').title, 'City');
    assert.deepEqual(at(3), ['graveyard', 'coven', 'home'], 'mid: towns, temples and dungeons, not the graveyards, covens and homes');
    assert.deepEqual(at(8), [], 'near: every kind');
    // lit while shown, struck while the store hides them
    for (const f of Object.keys(FILTER_SRC)) {
      assert.match(toggleOf(win, f).className, /\bon\b/);
      assert.equal(toggleOf(win, f).attrs['aria-pressed'], 'true');
    }
    const before = toggleOf(win, 'homes');
    win._renderKey();
    win.tick(0.016);
    assert.equal(toggleOf(win, 'homes'), before, 'nothing changed, so the button under the pointer is the same button');
    before.onclick();
    const after = toggleOf(win, 'homes');
    assert.notEqual(after, before);
    assert.doesNotMatch(after.className, /\bon\b/);
    assert.match(rows(win)[2].className, /\boff\b/, 'the Homes row is struck');
    assert.equal(after.title, 'Show homes');
    assert.equal(after.attrs['aria-pressed'], 'false');
    assert.doesNotMatch(rows(win)[0].className, /\boff\b/);
    win.dispose();
  });
});

// THE ONE MEASUREMENT THAT NEEDS THE PLAYER'S OWN COLOURS: the dots are FMAP_PAL.COL entries (ARENA2 data), so no
// colour is written in the port or in this file - the real loader reads them here, off ARENA2_PATH, as the game does.
const ARENA2 = process.env.ARENA2_PATH;
const skipReal = !ARENA2 || !existsSync(join(ARENA2, 'FMAP_PAL.COL')) ? 'ARENA2_PATH has no FMAP_PAL.COL' : false;
test('MAP-KEY (the player\'s FMAP_PAL.COL): every kind stands off the paper by EM7\'s floor at the SMALLEST mix that does; the dungeon and the graveyard stand apart by EM7\'s ink floor - where the ruin in its own hue could not (mutants: FB0929D-MAPKEY-the-mix-too-light, FB0929D-MAPKEY-the-mix-past-the-smallest)', { skip: skipReal }, async () => {
  _setTravelMapArtForTests(null);
  await preloadTravelMapArt({
    renderer: { uploadTexture: () => 'tex', releaseTexture: () => {}, drawScreenQuad: () => {} },
    palette: new DFPalette(),
    fetchBytes: async (n) => new Uint8Array(readFileSync(join(ARENA2, n))),
  });
  const dots = travelMapDotColors().map((c) => [c.r, c.g, c.b]);
  const inkAt = (mix) => Object.fromEntries(Object.entries(HEAD).map(([k, b]) => [k, mixRgb(dots[b], INK_RGB, mix)]));
  const ink = inkAt(MARK_INK_MIX);
  // what is measured is what is painted
  const painted = markInks(travelMapDotColors());
  for (const k of Object.keys(HEAD)) assert.equal(painted[k], rgba(ink[k], QUARTER_INK_A), `${k}: the measured ink is the painted one`);
  // every kind is INK: it stands off the parchment as EM7's inks must
  for (const k of Object.keys(HEAD)) {
    assert.ok(deltaE(ink[k], [...PARCHMENT_RGB]) >= QUARTER_INK_PAPER_DE,
      `${k} is ${deltaE(ink[k], [...PARCHMENT_RGB]).toFixed(1)} off the paper - a wash, not an ink`);
  }
  // ...and the mix is the smallest that keeps them so: a step lighter, and one of them is a wash
  const lighter = inkAt(MARK_INK_MIX - 0.01);
  assert.ok(Object.keys(HEAD).some((k) => deltaE(lighter[k], [...PARCHMENT_RGB]) < QUARTER_INK_PAPER_DE),
    'the mix has room to come down, so it spends hue it does not need to');
  // THE REPORT'S PAIR: a dungeon is told from a graveyard at a glance
  assert.ok(deltaE(ink.dungeon, ink.graveyard) >= QUARTER_INK_DE,
    `dungeon and graveyard ink to within ${deltaE(ink.dungeon, ink.graveyard).toFixed(1)}`);
  // ...which the keep or the ruin in its own hue could not be: classic's own ruin and graveyard dots are 10.9 apart,
  // and walked toward the pen both the keep's and the ruin's fall under the floor - why a kind takes its FIRST bucket
  assert.equal(deltaE(dots[2], dots[3]).toFixed(1), '10.9');
  for (const b of [1, 2]) {
    assert.ok(deltaE(mixRgb(dots[b], INK_RGB, MARK_INK_MIX), ink.graveyard) < QUARTER_INK_DE, `bucket ${b} in its own hue`);
  }
});
