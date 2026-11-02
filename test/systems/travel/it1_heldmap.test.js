// IT1 (2026-10-04): IMMERSIVE TRAVEL ON THE ENHANCED SHEET (ui/heldMap.js) - the skin every online player wears. A
// driver's map bills the mod's fare, refuses where the driver will not go, never remembers its toggles and commits a
// trip the host knows as a driver's (`opts.immersive`); the player's own map under Disable Normal Travel refuses a
// place outright; a captain's map shows only docks with ShowOnlyDocks.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { HeldMapWindow } from '../../../src/ui/heldMap.js';
import { CLIMATES, LOCATION_TYPES } from '../../../src/formats/mapsFile.js';
import { travelMapPopUpState, resetTravelMapState } from '../../../src/systems/travel/travelMapState.js';
import { MOD_SETTINGS } from '../../../src/systems/modSettings.js';
import { readImmersiveTravelSettings, carriageTripCost, IT_POPUP, IT_TEXT, IMMERSIVE_TRAVEL_VENDOR, DOCK_PIXEL_IDS, CAPITAL_MAP_IDS } from '../../../src/systems/immersiveTravel.js';
import { calculateTravelTime } from '../../../src/systems/travel/travel.js';

function fakeDocument() {
  const node = () => {
    const n = {
      children: [], style: {}, dataset: {}, classList: { toggle() {}, add() {}, remove() {} },
      append(...k) { n.children.push(...k); }, remove() { n.removed = true; },
      addEventListener() {}, removeEventListener() {}, setPointerCapture() {}, querySelectorAll: () => [],
      className: '', textContent: '', id: '', attrs: {}, setAttribute(k, v) { n.attrs[k] = v; },
      set innerHTML(v) { n.children = []; }, get innerHTML() { return ''; },
    };
    return n;
  };
  return { createElement: () => node(), getElementById: () => null, head: node(), body: node(), addEventListener() {}, removeEventListener() {} };
}
function withDocument(fn) {
  globalThis.document = fakeDocument();
  try { return fn(globalThis.document); } finally { delete globalThis.document; }
}
function settings(over = {}) {
  const all = { ...Object.fromEntries(Object.entries(MOD_SETTINGS[IMMERSIVE_TRAVEL_VENDOR].keys).map(([k, d]) => [k, d.default])), ...over };
  return readImmersiveTravelSettings((v, k) => (v === 'roads-hazelnut' ? true : all[k]));
}
const summaryOf = (x, y, locationType, extra = {}) => ({ id: y * 1000 + x, mapID: y * 1000 + x, regionIndex: 17, mapIndex: 3, locationType, discovered: true, ...extra });
const mkWin = (extra = {}) => new HeldMapWindow({
  getPlayerPixel: () => ({ x: 5, y: 5 }), getClimateIndex: () => CLIMATES.Mountain,
  woods: { heightMapBuffer: new Uint8Array(100).fill(10) }, mapSize: { width: 10, height: 10 },
  gold: () => 10000, goldPieces: () => 10000, hasHorse: false, hasCart: false, hasShip: false,
  diseaseCount: () => 0, poisonCount: () => 0,
  maps: { getPoliticIndex: () => 128 + 17 }, itHere: () => ({ x: 5, y: 5, mapId: 1, locationType: LOCATION_TYPES.TownCity, regionIndex: 17 }),
  ...extra,
});

test('IT1 the sheet, a driver\'s map: the mod\'s defaults and fare, its refusals as the panel\'s notice, every click heard, nothing remembered - and the commit is a driver\'s', () => {
  resetTravelMapState();
  withDocument(() => {
    const s = settings();
    let committed = null;
    const win = mkWin({ immersive: { kind: IT_POPUP.carriage, settings: s }, onTravel: (pick, opts, c) => { committed = { pick, opts, c }; } });
    win._selected = { summary: summaryOf(9, 5, LOCATION_TYPES.TownVillage), name: 'Far', x: 9.5, y: 5.5 };
    win._openPanel('travel');
    const st = win._panelState;
    assert.equal(st.it, IT_POPUP.carriage);
    assert.deepEqual({ ...st.opts }, { speedCautious: true, travelShip: false, sleepModeInn: true }, 'the mod popup\'s own OnPush');
    const t = calculateTravelTime({ x: 5, y: 5 }, { x: 9, y: 5 }, { ...st.opts, hasHorse: false, hasCart: false }, () => CLIMATES.Mountain);
    assert.deepEqual([st.trip.minutes, st.trip.totalCost, st.trip.walked], [t.minutes, carriageTripCost(t.minutes, t.oceanPixels, st.opts, s).totalCost, false]);
    // the lit "By land" clicked again is still the mod's handler: refused
    win._itPress('transportClick', { ship: false });
    assert.equal(st.notice, IT_TEXT.mustFindShip);
    win._toggleOpt('sleepModeInn');   // N: the inn button's toggle
    assert.equal(st.opts.sleepModeInn, false);
    assert.equal(st.notice, null, 'the next press clears the box');
    win._closePanel();
    assert.deepEqual(travelMapPopUpState(), { speedCautious: true, travelShip: true, sleepModeInn: true }, 'the store never learns a driver\'s toggles');
    win._openPanel('travel');
    win._begin();
    assert.equal(committed, null);
    win._fireCommit();
    assert.equal(committed?.opts.immersive, IT_POPUP.carriage);
    assert.equal(committed?.opts.playerControlled, false);
    assert.equal(committed?.c.totalCost, carriageTripCost(t.minutes, t.oceanPixels, { sleepModeInn: true }, s).totalCost);
    win.dispose();
  });
});

test('IT1 the sheet: a place the driver will not go is the mod\'s box and no panel - by type, and region-locked away from the capital', () => {
  withDocument(() => {
    const win = mkWin({ immersive: { kind: IT_POPUP.carriage, settings: settings() } });
    win._selected = { summary: summaryOf(9, 5, LOCATION_TYPES.DungeonKeep), name: 'Keep', x: 9.5, y: 5.5 };
    win._openPanel('travel');
    assert.deepEqual([win._panel, win._itRefusal], [null, IT_TEXT.wrongType]);
    win._select({ summary: summaryOf(8, 5, LOCATION_TYPES.TownCity, { regionIndex: 40 }), name: 'Away', x: 8.5, y: 5.5 });
    assert.equal(win._itRefusal, null, 'a new pick clears it');
    win.dispose();
    const locked = mkWin({ immersive: { kind: IT_POPUP.carriage, settings: settings({ 'General.RegionLockedCarriages': true }) } });
    locked._selected = { summary: summaryOf(8, 5, LOCATION_TYPES.TownCity, { regionIndex: 40 }), name: 'Away', x: 8.5, y: 5.5 };
    locked._openPanel('travel');
    assert.equal(locked._itRefusal, IT_TEXT.regionLocked);
    locked.dispose();
    const fromCapital = mkWin({ immersive: { kind: IT_POPUP.carriage, settings: settings({ 'General.RegionLockedCarriages': true }) }, itHere: () => ({ x: 5, y: 5, mapId: CAPITAL_MAP_IDS[0] }) });
    fromCapital._selected = { summary: summaryOf(8, 5, LOCATION_TYPES.TownCity, { regionIndex: 40 }), name: 'Away', x: 8.5, y: 5.5 };
    fromCapital._openPanel('travel');
    assert.equal(fromCapital._itRefusal, IT_TEXT.capitalOnly);
    fromCapital.dispose();
  });
});

test('IT1 the sheet, the player\'s own map: Disable Normal Travel refuses a place with the mod\'s words; off (the port\'s default) the map is Travel Options\' and DFU\'s as before', () => {
  withDocument(() => {
    const on = mkWin({ immersiveSettings: () => settings({ 'General.DisableNormalTravel': true }) });
    on._selected = { summary: summaryOf(9, 5, LOCATION_TYPES.TownCity), name: 'Far', x: 9.5, y: 5.5 };
    on._openPanel('travel');
    assert.deepEqual([on._panel, on._itRefusal], [null, IT_TEXT.mustTakeCarriage]);
    on._select({ summary: summaryOf(8, 5, LOCATION_TYPES.Graveyard), name: 'Yard', x: 8.5, y: 5.5 });
    on._openPanel('travel');
    assert.equal(on._itRefusal, IT_TEXT.cannotTravelType);
    on.dispose();
    const off = mkWin({ immersiveSettings: () => settings() });
    off._selected = { summary: summaryOf(9, 5, LOCATION_TYPES.TownCity), name: 'Far', x: 9.5, y: 5.5 };
    off._openPanel('travel');
    assert.deepEqual([off._panel, off._itRefusal, off._panelState.it], ['travel', null, null]);
    off.dispose();
  });
});

test('IT1 the sheet, a captain\'s map: ship and camping forced, the captain\'s fare; only the docks with Show Only Docks; no bare-pixel journeys on either of the mod\'s maps', () => {
  withDocument(() => {
    const s = settings({ 'ShipTravel.ShowOnlyDocks': true, 'ShipTravel.LimitedRangeInSmallDocks': false });
    const win = mkWin({ immersive: { kind: IT_POPUP.seafarer, settings: s }, travelOptions: () => ({ settings: { targetCoordsAllowed: true } }) });
    const dock = DOCK_PIXEL_IDS[0];
    const dx = dock % 1000, dy = (dock - dx) / 1000;
    assert.equal(win._discovered(summaryOf(dx, dy, LOCATION_TYPES.TownVillage)), true);
    assert.equal(win._discovered(summaryOf(1, 1, LOCATION_TYPES.TownVillage)), DOCK_PIXEL_IDS.some((p) => [1001, 1, 1002, 2001, 1000].includes(p)));
    // the mod's maps are DFU's window under the mod, never Travel Options': its ports filter hides nothing on them
    const cart = mkWin({ immersive: { kind: IT_POPUP.carriage, settings: settings() } });
    cart.portsFilter = true;
    assert.equal(cart._discovered(summaryOf(9, 5, LOCATION_TYPES.TownCity)), true, 'a driver\'s map under the ports filter');
    cart.dispose();
    assert.equal(win._coordsAllowedHere(), false);
    win._selected = { summary: summaryOf(dx, dy, LOCATION_TYPES.TownVillage), name: 'Port', x: dx + 0.5, y: dy + 0.5 };
    win._openPanel('travel');
    const st = win._panelState;
    assert.deepEqual({ ...st.opts }, { speedCautious: true, travelShip: true, sleepModeInn: false });
    win._itPress('sleepClick', { inn: true });
    assert.equal(st.notice, IT_TEXT.noInnsAtSea);
    win._toggleOpt('travelShip');
    assert.equal(st.notice, IT_TEXT.cannotDisableShip);
    assert.equal(st.trip.minutes, 51 * Math.max(Math.abs(dx - 5), Math.abs(dy - 5)));
    win.dispose();
  });
});
