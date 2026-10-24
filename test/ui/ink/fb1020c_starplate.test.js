// FIELD BUGS 2026-10-20c STAR-PLATE (a player on the Discord, 2026-10-20: "citisens who mark locations on your map dont
// leave a mark").
//
// The mark itself is whole: a townsperson's 7332 answer runs %loc -> MarkKeySubjectLocationOnMap -> DiscoverBuilding, and
// the town map reads that record (driven over every Where-is row of 701 towns, 6,446 rows, every one named). What the
// Enhanced town sheet did with it on a crowded plan was the fault: the nameplate solver (ui/nameplateLayout.js
// resolveNameplates, ExteriorAutomap.cs ComputeNameplateOffsets) gives up on a plate it cannot clear, and DFU letters that
// plate "*" with its building's name as a zero-delay tooltip (DaggerfallExteriorAutomapWindow.cs:870-878, :900-904) - so
// does the port's classic window - while the sheet DROPPED it (`if (!s || s.replaced) return;`): a building an NPC had
// just marked could stand on the plan with no mark at all. Now a surrendered plate is the "*" (STAR_PLATE, one home in
// nameplateLayout.js), its name kept for the pointer.
//
// The fixture lays three names on one anchor (the solver places two and surrenders the third); the ARENA2 case opens the
// M key's real window (ui/town/townMapDoor.js createTownMapWindow -> HeldMapWindow, FINDME-TOWN's fake document and
// recording canvas) over Daggerfall with every named building found, and marks the one its solver gives up on last.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

import { createTownSheet } from '../../../src/ui/town/townSheet.js';
import { STAR_PLATE } from '../../../src/ui/nameplateLayout.js';
import { paintTownOverlay, TOWN_PEN } from '../../../src/ui/ink/inkTown.js';

const ARENA2 = process.env.ARENA2_PATH;
const skipReal = !ARENA2 || !existsSync(ARENA2) ? 'ARENA2_PATH not set or missing - real-data validation skipped' : false;
const src = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');

/** A canvas that writes down every call with the pens it was made in. */
function recordingCtx() {
  const calls = [];
  const state = {};
  return new Proxy({}, {
    get: (_, k) => {
      if (k === 'calls') return calls;
      if (k === 'measureText') return (t) => ({ width: String(t).length * 6 });
      if (k in state) return state[k];
      return (...args) => { calls.push({ fn: k, args, fillStyle: state.fillStyle }); };
    },
    set: (_, k, v) => { state[k] = v; return true; },
  });
}

// three shops on ONE anchor - the solver parts two and surrenders the third
const NAMES = ['The Rusty Nail', 'The Gilded Anvil', 'The Sleeping Griffin'];
const SHOPS = NAMES.map((name, i) => ({ buildingKey: i + 1, blockX: 0, blockY: 0, position: [50, 0, 50], buildingType: 9, name }));
const crowded = (found = SHOPS) => createTownSheet({
  gridW: 1, gridH: 1, blocks: [], buildings: () => SHOPS,
  discovered: () => found.map((b) => ({ buildingKey: b.buildingKey, displayName: b.name })),
});
const VIEW = { ox: 0, oy: 0, scale: 4 };

test('STAR-PLATE: a plate the solver gives up on is DFU\'s "*" where the solver left it, its building\'s name kept - every discovered building has a mark; the parted plates keep their words (mutants: the surrendered plate dropped again; lettered by its name; the "*" in its place unnamed)', () => {
  assert.equal(STAR_PLATE, '*', 'ExteriorAutomap\'s own placeholder');
  const s = crowded();
  const rows = s.platesAt(VIEW, 400, 300, null);
  assert.equal(s.names().length, 3, 'three discovered names to letter');
  assert.equal(rows.length, 3, 'all three stand on the plan - none dropped');
  const stars = rows.filter((r) => r.text === STAR_PLATE);
  assert.equal(stars.length, 1, 'the third, which no offset clears, is the star');
  assert.equal(stars[0].name, 'The Sleeping Griffin', 'and it is still the Griffin\'s plate');
  assert.deepEqual(rows.filter((r) => r.text !== STAR_PLATE).map((r) => [r.text, r.name]), [['The Rusty Nail', 'The Rusty Nail'], ['The Gilded Anvil', 'The Gilded Anvil']], 'a parted plate keeps its own words');
  // two discovered on the anchor: the solver parts them, and no star is drawn
  const two = crowded(SHOPS.slice(0, 2)).platesAt(VIEW, 400, 300, null);
  assert.deepEqual(two.map((r) => r.text), ['The Rusty Nail', 'The Gilded Anvil'], 'a star only where the solver surrendered');
});

test('STAR-PLATE: the "*" is inked as every name is - haloed, in its quarter\'s pen, its building ticked - and the pointer over it reads its building\'s name, as DFU\'s tooltip does (mutants: the hover answering the star; the star unpainted)', () => {
  const s = crowded();
  s.platesAt(VIEW, 400, 300, null);
  const ctx = recordingCtx();
  s.paintOverlay(ctx, { view: VIEW, paperW: 400, paperH: 300, dpr: 1, pulse: 0 });
  const lettered = ctx.calls.filter((c) => c.fn === 'fillText').map((c) => c.args[0]);
  assert.deepEqual([...lettered].sort(), ['*', 'The Gilded Anvil', 'The Rusty Nail'], 'the star is painted beside the two names');
  assert.ok(ctx.calls.some((c) => c.fn === 'strokeText' && c.args[0] === '*'), 'haloed');
  const star = s.platesAt(VIEW, 400, 300, null).find((r) => r.text === STAR_PLATE);
  assert.deepEqual(s.hoverLabel(star.x, star.y), { label: 'The Sleeping Griffin', cursor: 'pointer' });
  // the painter takes the rows as they come: a star and its name ride the same row, the star is what is lettered
  const own = recordingCtx();
  paintTownOverlay(own, VIEW, { paperW: 400, paperH: 300, plates: [{ text: STAR_PLATE, name: 'The Sleeping Griffin', quarter: 'shop', size: 13, x: 10, y: 10 }] });
  assert.deepEqual(own.calls.filter((c) => c.fn === 'fillText').map((c) => c.args[0]), ['*']);
  assert.notEqual(own.calls.find((c) => c.fn === 'fillText').fillStyle, TOWN_PEN.quest, 'a shop\'s star is no quest\'s');
});

test('STAR-PLATE by source: the sheet and the classic window letter the ONE "*" (nameplateLayout.js STAR_PLATE) - the classic window always did, the sheet dropped it (mutants: either map\'s own literal)', () => {
  const sheet = src('src/ui/town/townSheet.js');
  assert.match(sheet, /if \(!s\) return;\n/, 'a solved plate is never dropped for being surrendered');
  assert.doesNotMatch(sheet, /s\.replaced\) return/, 'the drop is gone');
  assert.match(sheet, /text: s\.replaced \? STAR_PLATE : n\.text, name: n\.text,/);
  assert.match(sheet, /return \{ label: p\.name \?\? p\.text, cursor: 'pointer' \};/);
  assert.match(src('src/ui/exteriorAutomapWindow.js'), /drawText\(renderer, font, r\.replaced \? STAR_PLATE : p\.text,/);
  assert.match(src('src/ui/nameplateLayout.js'), /export const STAR_PLATE = '\*';/);
});

// ── THE REPORT, on the game's own data: the M key's real window over Daggerfall ──────────────────────────────────────

function fakeDocument() {
  const node = () => {
    const n = {
      children: [], style: {}, dataset: {}, classList: { toggle() {}, add() {}, remove() {}, contains: () => false },
      append(...k) { n.children.push(...k); }, appendChild(k) { n.children.push(k); }, remove() { n.removed = true; },
      addEventListener() {}, removeEventListener() {}, setPointerCapture() {}, querySelector: () => null, querySelectorAll: () => [],
      className: '', textContent: '', id: '', attrs: {}, setAttribute(k, v) { n.attrs[k] = v; }, removeAttribute() {},
      getBoundingClientRect: () => ({ width: 0, height: 0, left: 0, top: 0 }), focus() {}, blur() {},
      set innerHTML(v) { n.children = []; }, get innerHTML() { return ''; },
    };
    return n;
  };
  return { createElement: () => node(), createElementNS: () => node(), getElementById: () => null, head: node(), body: node(), addEventListener() {}, removeEventListener() {} };
}

test('STAR-PLATE with ARENA2: Daggerfall with every named building found - the M key\'s real window at rest letters every one on its paper, the solver\'s surrenders as "*"; the building it gives up on, marked last by a townsperson (the talk seam\'s record), is painted and named under the pointer where before the fix it stood on the plan with no mark (mutants: the surrendered plate dropped again)', { skip: skipReal }, async () => {
  const { MapsFile } = await import('../../../src/formats/mapsFile.js');
  const { BlocksFile } = await import('../../../src/formats/blocksFile.js');
  const { layoutLocation } = await import('../../../src/world/locationLayout.js');
  const { buildingSummaries } = await import('../../../src/world/buildingSummaries.js');
  const D = await import('../../../src/systems/discovery.js');
  const { createTownMapWindow } = await import('../../../src/ui/town/townMapDoor.js');
  const { WORLD_PER_PX } = await import('../../../src/ui/ink/inkTown.js');
  const { resetTravelMapState } = await import('../../../src/systems/travel/travelMapState.js');
  const { setPref } = await import('../../../src/systems/uiPrefs.js');
  const bytes = (f) => new Uint8Array(readFileSync(join(/** @type {string} */ (ARENA2), f)));
  const maps = new MapsFile(); maps.load(bytes('MAPS.BSA'), bytes('CLIMATE.PAK'), bytes('POLITIC.PAK'));
  const blocks = new BlocksFile(); blocks.load(bytes('BLOCKS.BSA'));
  const loc = maps.getLocationByName('Daggerfall', 'Daggerfall');
  assert.equal(loc?.name, 'Daggerfall');
  const log = console.log; console.log = () => {};   // the layout names every block it reads
  let lay;
  try { lay = layoutLocation(loc, maps, blocks, { enhanced: true, windmills: true }); } finally { console.log = log; }
  const locId = `${loc.regionIndex}:${loc.name}`;   // the talk seam's key and the M key's (scenes/world.js), one shape
  const summaries = buildingSummaries(loc.exterior.buildings, lay.blocks, { locationName: loc.name, regionName: maps.getRegionName(loc.regionIndex), locationIndex: loc.locationIndex ?? 0 });
  const named = summaries.filter((b) => !b.isResidence && b.name);
  assert.ok(named.length > 100, `a city's worth of named buildings (${named.length})`);
  const found = (b) => D.discoverBuilding(locId, { buildingKey: b.buildingKey, name: b.name, buildingType: b.buildingType, factionId: b.factionId, quality: b.quality });
  resetTravelMapState(); setPref('skin', 'enhanced');
  globalThis.document = fakeDocument(); globalThis.innerWidth = 1600; globalThis.innerHeight = 900;
  const open = () => {
    const win = createTownMapWindow({
      locationName: loc.name, locationId: locId, gridW: loc.exterior.exteriorData.width, gridH: loc.exterior.exteriorData.height,
      blocks: lay.blocks.map((bl) => ({ x: bl.x, y: bl.y, autoMap: bl.dfBlock?.rmbBlock?.fldHeader?.autoMapData, landmark: null })),
      playerPos: () => [200, 0, 200], playerYaw: () => 0, buildings: () => summaries, directory: () => [], discovered: () => D.discoveredBuildings(locId),
      where: () => ({ inLocation: true }), townPlayer: () => ({ x: 200 / WORLD_PER_PX, y: 200 / WORLD_PER_PX, yaw: 0 }),
    });
    for (let i = 0; i < 21; i++) win.tick(0.05);
    const ctx = recordingCtx();
    win._chrome.ink.getContext = () => ctx; win._staticKey = ''; win._paint(); delete win._chrome.ink.getContext;
    // the plates as the window laid them for this paint: its paper, the strip's band and the gauntlets' (heldMap.js env)
    const rows = win._sheet.platesAt(win._view, win._paper.w, win._paper.h, null, win._strip?.h ?? 0, win._handRects(win._paper.w, win._paper.h));
    const out = { rows, lettered: ctx.calls.filter((c) => c.fn === 'fillText').map((c) => c.args[0]), names: new Map(rows.map((r) => [r.name, win._sheet.hoverLabel(r.x, r.y).label])) };
    win.dispose?.();
    return out;
  };
  try {
    D.restoreDiscovery(null);
    for (const b of named) found(b);
    const all = open();
    const stars = all.rows.filter((r) => r.text === STAR_PLATE);
    assert.ok(stars.length > 0, 'a city this crowded makes the solver give up on some plates at rest');
    for (const r of all.rows) assert.ok(named.some((b) => b.name === r.name), `${r.name}: a found building's plate`);
    assert.ok(all.rows.length > all.rows.length - stars.length, 'the stars are plates the sheet used to drop');
    assert.equal(all.lettered.filter((t) => t === STAR_PLATE).length, stars.length, 'every star is painted');
    // THE REPORT: the building the solver gives up on, the last one a townsperson marked - before the mark it is nowhere
    const unique = (r) => named.filter((b) => b.name === r.name).length === 1;   // a city's walls share one name; a shop's is its own
    const last = stars.filter(unique).at(-1)?.name;
    assert.ok(last, 'a named shop among the surrendered');
    D.restoreDiscovery(null);
    for (const b of named) if (b.name !== last) found(b);
    const before = open();
    assert.ok(!before.rows.some((r) => r.name === last), `${last}: not yet found, no plate`);
    found(named.find((b) => b.name === last));   // the NPC's MarkKeySubjectLocationOnMap -> DiscoverBuilding
    const after = open();
    const plate = after.rows.find((r) => r.name === last);
    assert.ok(plate, `${last}: marked, and its mark stands on the plan`);
    assert.ok([STAR_PLATE, last].includes(plate.text), 'its name, or the solver\'s "*" for it');
    assert.equal(after.names.get(last), last, 'and the pointer over it reads its name');
  } finally {
    D.restoreDiscovery(null);
    delete globalThis.document;
  }
});
