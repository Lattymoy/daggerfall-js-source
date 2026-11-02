// IC-TOWNMAP (2026-10-26; the owner: "Curious how the town map will look"). A render audit of the town map in the
// Imperial City found two release bugs, both from the capitals' closed byte (world/tamrielCapitals.js CAPITAL_CLOSED_BYTE,
// 0xFE - a wall, a tower, a court the walkers may not cross, in no quarter and no show-all byte):
//
//   1. THE CLASSIC WINDOW PAINTED IT MAGENTA. Its ladder (ui/exteriorAutomapWindow.js buildExteriorLayout) gives a byte in
//      no group DFU's debug red (255, 0, byte) - (255, 0, 254) here: 118,671 of 262,144 pixels of a Market slice, the
//      White-Gold Tower and the palace solid magenta. It paints nothing now, as the held map's sheet paints it.
//   2. THE HELD MAP SHOWED NOTHING AT ALL on a slice with nothing built - no heading, no caret, no Find me cross (the
//      town sheet's plan was null with no chain, and the window paints nothing for a null model): 242 of the city's 442
//      slices, its whole Palace District.
//
// The blocks here are the producer's own: the Imperial City's off the world-data door (world/capitalModels.js
// installCapitals, the family's JSON the game reads), every other capital's off capitalPortBlocks.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

import { buildExteriorLayout } from '../../../src/ui/exteriorAutomapWindow.js';
import { createTownSheet } from '../../../src/ui/town/townSheet.js';
import { createTownMapWindow } from '../../../src/ui/town/townMapDoor.js';
import { TOWN_PEN, WORLD_PER_PX, BLOCK_PX } from '../../../src/ui/ink/inkTown.js';
import { quarterOf, isShowAllByte, QUARTERS, HOUSE_SET } from '../../../src/ui/town/townQuarters.js';
import { CARET_R, toPaper } from '../../../src/ui/ink/inkMap.js';
import { CAPITALS, CAPITAL_CLOSED_BYTE, capitalCentre, capitalPortBlocks } from '../../../src/world/tamrielCapitals.js';
import { installCapitals } from '../../../src/world/capitalModels.js';
import { imperialOwnName } from '../../../src/world/imperialBlocks.js';
import { IMPERIAL_SPAN } from '../../../src/world/imperialCity.js';
import { getDFBlockReplacementData, getNewDFBlockIndex } from '../../../src/formats/worldData/worldDataReplacement.js';
import { resetTravelMapState } from '../../../src/systems/travel/travelMapState.js';
import { setPref } from '../../../src/systems/uiPrefs.js';

const COLOURS = Object.freeze({ temple: 0xff457dc3, shop: 0xffbe5518, tavern: 0xff557530, house: 0xff453c28 });
const MODES = ['original', 'all', 'showall'];

/** The Imperial City's Palace District, its centre slice - the White-Gold Tower's - as its 8x8 grid of the door's own
 *  blocks, each at its place on the slice's grid (row 0 the north, as the location's grid runs). */
let palace = null;
function palaceSlice() {
  if (palace) return palace;
  installCapitals({ addTextures: () => 0 });
  const IC = CAPITALS.find((c) => c.family), s = capitalCentre(IC), N = IMPERIAL_SPAN;
  const sy = Math.floor(s / N), sx = s % N, blocks = [];
  for (let r = sy * 8; r < sy * 8 + 8; r++) {
    for (let c = sx * 8; c < sx * 8 + 8; c++) {
      const name = imperialOwnName(r, c), blk = getDFBlockReplacementData(getNewDFBlockIndex(name), name);
      blocks.push({ x: c - sx * 8, y: 7 - (r - sy * 8), autoMap: blk.rmbBlock.fldHeader.autoMapData, landmark: null });
    }
  }
  palace = { gridW: 8, gridH: 8, blocks };
  return palace;
}

/** The classic ladder as it stood before IC-TOWNMAP, for every byte but the capitals' closed one: the reference a Bay
 *  town's pixels are held to. */
function classicBefore(byte, mode) {
  if (mode !== 'all' && byte === 0xfb) return 0;
  if (byte === 0) return 0;
  const q = quarterOf(byte);
  if (q) return COLOURS[q];
  if (isShowAllByte(byte)) return mode === 'original' ? 0 : COLOURS.house;
  return (0xff000000 | (byte << 16) | 0x0000ff) >>> 0;
}

test('IC-TOWNMAP 1: the classic town map paints a capital\'s closed cells as nothing - the Imperial City\'s Palace District (its tower and palace were solid magenta) and every other capital\'s own blocks, in every view mode: no pixel at all where the bytes are only street and closed (mutant: the closed byte back on the debug red)', () => {
  const pal = palaceSlice();
  const closed = pal.blocks.reduce((n, b) => n + b.autoMap.filter((v) => v === CAPITAL_CLOSED_BYTE).length, 0);
  assert.ok(closed > 60000, `the palace slice is mostly closed cells (${closed})`);
  for (const mode of MODES) {
    const lay = buildExteriorLayout(pal.gridW, pal.gridH, pal.blocks, mode, COLOURS);
    assert.equal(lay.colors.filter((c) => c !== 0).length, 0, `the Palace District, ${mode}: nothing painted`);
  }
  let others = 0;
  for (const b of capitalPortBlocks()) {
    const a = b.json.RmbBlock.FldHeader.AutoMapData;
    if (!a.includes(CAPITAL_CLOSED_BYTE)) continue;
    others++;
    const lay = buildExteriorLayout(1, 1, [{ x: 0, y: 0, autoMap: Uint8Array.from(a) }], 'all', COLOURS);
    assert.equal(lay.colors.filter((c) => c !== 0).length, 0, `${b.name}: nothing painted`);
  }
  assert.ok(others > 20, `every capital's closed blocks (${others})`);
});

test('IC-TOWNMAP 1: a Bay town\'s classic map is unchanged byte for byte - every byte but the capitals\' closed one is painted as the ladder painted it, in every mode (mutants: a byte past the closed one skipped; the debug red lost)', () => {
  for (const mode of MODES) {
    for (let byte = 0; byte < 256; byte++) {
      const grid = new Uint8Array(BLOCK_PX * BLOCK_PX).fill(byte);
      const lay = buildExteriorLayout(1, 1, [{ x: 0, y: 0, autoMap: grid }], mode, COLOURS);
      const want = byte === CAPITAL_CLOSED_BYTE ? 0 : classicBefore(byte, mode);
      assert.equal(lay.colors[0], want, `byte ${byte}, ${mode}`);
      assert.ok(lay.colors.every((c) => c === lay.colors[0]), `byte ${byte}, ${mode}: one colour across the block`);
    }
  }
  assert.ok(QUARTERS.length === 4);
});

const ARENA2 = process.env.ARENA2_PATH;
test('IC-TOWNMAP 1: no Daggerfall block writes the capitals\' closed byte - every RMB\'s automap grid in BLOCKS.BSA, so skipping it changes no Bay town', { skip: !ARENA2 || !existsSync(join(ARENA2, 'BLOCKS.BSA')) ? 'ARENA2_PATH not set - real-data validation skipped' : false }, async () => {
  const { BlocksFile } = await import('../../../src/formats/blocksFile.js');
  const bsa = new BlocksFile(); bsa.load(new Uint8Array(readFileSync(join(ARENA2, 'BLOCKS.BSA'))));
  let rmb = 0;
  for (let i = 0; i < bsa.count; i++) {
    if (!/\.RMB$/i.test(bsa.getBlockName(i) ?? '')) continue;
    const a = bsa.readClassicBlock(i)?.rmbBlock?.fldHeader?.autoMapData;
    if (!a) continue;
    rmb++;
    assert.ok(!a.includes(CAPITAL_CLOSED_BYTE), bsa.getBlockName(i));
  }
  assert.ok(rmb > 900, `${rmb} RMBs read`);
});

// ── 2: the held map on a slice with nothing drawn ─────────────────────────────────────────────────────────────────

/** Just enough document for the chrome (FINDME-TOWN's, test/ui/town/fb1019f_findme_town.test.js). */
function fakeDocument() {
  const made = [];
  const node = () => {
    const n = {
      children: [], style: {}, dataset: {}, classList: { toggle() {}, add() {}, remove() {}, contains: () => false },
      append(...k) { n.children.push(...k); }, appendChild(k) { n.children.push(k); }, remove() { n.removed = true; },
      addEventListener() {}, removeEventListener() {}, setPointerCapture() {}, querySelector: () => null, querySelectorAll: () => [],
      className: '', textContent: '', id: '', attrs: {}, setAttribute(k, v) { n.attrs[k] = v; }, removeAttribute() {},
      getBoundingClientRect: () => ({ width: 0, height: 0, left: 0, top: 0 }), focus() {}, blur() {},
      set innerHTML(v) { n.children = []; }, get innerHTML() { return ''; },
    };
    made.push(n);
    return n;
  };
  return { made, createElement: () => node(), createElementNS: () => node(), getElementById: () => null, head: node(), body: node(), addEventListener() {}, removeEventListener() {} };
}
function withDocument(fn) {
  resetTravelMapState();
  setPref('skin', 'enhanced');
  globalThis.document = fakeDocument();
  globalThis.innerWidth = 1600; globalThis.innerHeight = 900;
  try { return fn(globalThis.document); } finally { delete globalThis.document; setPref('dungeonMap3d', true); }
}
function recordingCtx() {
  const calls = [];
  const state = {};
  return new Proxy({}, {
    get: (_, k) => {
      if (k === 'calls') return calls;
      if (k === 'measureText') return (t) => ({ width: String(t).length * 6 });
      if (k in state) return state[k];
      return (...args) => { calls.push({ fn: k, args, fillStyle: state.fillStyle, strokeStyle: state.strokeStyle }); };
    },
    set: (_, k, v) => { state[k] = v; return true; },
  });
}
const paintOf = (win) => { const ctx = recordingCtx(); win._chrome.ink.getContext = () => ctx; win._staticKey = ''; win._paint(); delete win._chrome.ink.getContext; return ctx.calls; };
const CROSS_PEN = 'rgba(200,24,24,0.95)';
const crossOf = (calls) => {
  const pen = calls.filter((c) => c.strokeStyle === CROSS_PEN && (c.fn === 'moveTo' || c.fn === 'lineTo'));
  if (!pen.length) return null;
  const [h0, , v0] = pen.map((c) => c.args);
  return { x: v0[0], y: h0[1] };
};
const caretsOf = (calls) => calls.filter((c) => c.fn === 'moveTo' && c.fillStyle === TOWN_PEN.caret && c.strokeStyle === TOWN_PEN.halo);
const raise = (win) => { for (let i = 0; i < 21; i++) win.tick(0.05); assert.equal(win._phase, 'map'); return win; };
const pressFindMe = (doc) => { const b = doc.made.find((n) => n.className === 'act hmfindme'); assert.ok(b?.onclick, 'the Find me button'); b.onclick(); };

test('IC-TOWNMAP 2: the held map on the Palace District\'s centre slice (nothing built on it) still letters its heading, inks the player\'s caret and blinks Find me\'s cross through it - the plan empty, never null (mutant: the plan null with no chain)', () => withDocument((doc) => {
  const pal = palaceSlice();
  const sheet = createTownSheet({ gridW: pal.gridW, gridH: pal.gridH, blocks: pal.blocks });
  const plan = sheet.ensure();
  assert.ok(plan, 'a plan');
  assert.equal(plan.chains.length, 0, 'with nothing on it: no building in the slice');
  const W = 8 * BLOCK_PX * WORLD_PER_PX, at = [W / 2 + 30, W / 2 - 20];
  const win = raise(createTownMapWindow({
    locationName: 'The Imperial City', gridW: pal.gridW, gridH: pal.gridH, blocks: pal.blocks, buildings: () => [], discovered: () => [],
    playerPos: () => [at[0], 0, at[1]], playerYaw: () => 0,
    townPlayer: () => ({ x: at[0] / WORLD_PER_PX, y: at[1] / WORLD_PER_PX, yaw: 0 }),
  }));
  assert.equal(win._slot.live, 'town', 'the streets are up');
  const rest = paintOf(win);
  assert.ok(rest.some((c) => c.fn === 'fillText' && c.args[0] === 'Town'), 'the heading: the strip\'s Town tab');
  assert.equal(caretsOf(rest).length, 1, 'the player\'s caret');
  pressFindMe(doc);
  assert.equal(win._findMeT, 3, 'Find me answers');
  win.tick(0.25);
  const calls = [paintOf(win), (win.tick(0.25), paintOf(win))];
  const cross = calls.map(crossOf).find(Boolean);
  assert.ok(cross, 'the cross blinks');
  const [tip] = caretsOf(calls[0]).at(-1).args;
  assert.ok(Math.abs(cross.x - tip) < 1e-6, 'through the caret');
  const me = win._sheet.me(), [px, py] = toPaper(win._view, me.x, me.y);
  assert.ok(Math.abs(cross.x - px) < 1e-6 && Math.abs(cross.y - py) < 1e-6, 'through where the sheet says I stand');
  assert.ok(Math.abs(caretsOf(calls[0]).at(-1).args[1] + CARET_R - py) < 1e-6, 'and the caret is mine');
  win.dispose();
}));

test('IC-TOWNMAP 2: a Bay town\'s plan is the plan it was - built blocks, its chains; and a town with no blocks is still the quiet nothing', () => {
  const g = new Uint8Array(BLOCK_PX * BLOCK_PX);
  for (let y = 16; y < 48; y++) for (let x = 16; x < 48; x++) g[y * BLOCK_PX + x] = HOUSE_SET[0];
  const built = createTownSheet({ gridW: 1, gridH: 1, blocks: [{ x: 0, y: 0, autoMap: g }] });
  assert.ok(built.ensure()?.chains.length > 0);
  assert.equal(createTownSheet({ gridW: 0, gridH: 0, blocks: [] }).ensure(), null);
  assert.equal(createTownSheet().ensure(), null);
});
