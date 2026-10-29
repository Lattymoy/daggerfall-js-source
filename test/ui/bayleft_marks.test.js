// BAY-LEFT-MAPS (2026-10-27, the owner after AUDIT LEFT IN THE BAY: "Every single thing here needs to be addressed. No
// exceptions."; bible/10-UI/Held-Map-Arc.md BAY-LEFT-MAPS) - THE HELD MAP'S MARKS AND THE MAP'S FLAGS PAST THE BAY.
//
// C1: the held map read its party, its travellers, the trader's coin, the serpent's ring (and the Super dungeon's, the
// arch's, the Ketch's), the Motherlodes, the POIs, the raids and the stars against the Bay's 1000 x 500 (`this._size`,
// which no host hands), where the gates past the Bay, the bounties and the quests were read over the sheet's own box -
// so a member in Solitude was no mark. Every reader reads that box now (heldMap.js _marksBox), the Bay's own box the
// Bay's old bound to the pixel.
// C2: a waypoint (personal, party, guild) and WILD-WAYPOINT's remains flag were held to the Bay's map
// (systems/map/mapWaypoints.js onMap), so none stood past it - the open zone, Cyrodiil's since WW-C2, never had its
// remains flag. The world's grid now (net/wire.js worldPixelOk).
import '../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

import { readPartyMarks, readPartyMarksIn, readTravellerMarks, readTravellerMarksIn } from '../../src/ui/partyMapMarks.js';
import { readVendorMark, readVendorMarkIn } from '../../src/ui/vendor/vendorMapMark.js';
import { readGateMark, readGateMarkIn } from '../../src/ui/gate/gateMapMark.js';
import { readRaidMarks, readRaidMarksIn } from '../../src/ui/eventMapMarks.js';
import { HeldMapWindow } from '../../src/ui/heldMap.js';
import { tamrielFrameInBay, setTamrielFit } from '../../src/world/tamriel/tamrielFrame.js';
import { _resetForTests, setPref } from '../../src/systems/uiPrefs.js';
import { CLIMATES } from '../../src/formats/mapsFile.js';
import {
  addWaypoint, decodeWaypointLine, receiveWaypointLine, listWaypoints, waypointById, WP_WIRE_PREFIX, _resetWaypoints, WAYPOINT_STORE_KEY,
} from '../../src/systems/map/mapWaypoints.js';
import { WORLD_PIXEL_BOUND } from '../../src/net/wire.js';

const read = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const BAY = { width: 1000, height: 500 };
const BAY_BOX = { x0: 0, y0: 0, w: 1000, h: 500 };
const SOLITUDE = { px: 1569, py: -430 }, WHITERUN = { px: 1820, py: -300 }, BAY_TOWN = { px: 500, py: 250 };

/** Just enough document for the chrome (test/ui/heldmap.test.js fakeDocument's shape). */
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
const withDocument = (fn) => { globalThis.document = fakeDocument(); try { return fn(); } finally { delete globalThis.document; } };

/** Every kind of mark the held map polls, each one at Solitude or Whiterun and one on the Bay. */
const marksDeps = () => ({
  party: () => [{ acct: 'a', name: 'In Solitude', ...SOLITUDE }, { acct: 'b', name: 'In the Bay', ...BAY_TOWN }],
  travellers: () => [{ id: 'p1', name: 'Rider past the Bay', ...WHITERUN, fx: 0, fy: 0 }, { id: 'p2', name: 'Rider on the Bay', ...BAY_TOWN, fx: 0, fy: 0 }],
  vendor: () => ({ ...SOLITUDE, label: 'Trader', town: 'Solitude' }),
  serpent: () => ({ cx: SOLITUDE.px, cy: SOLITUDE.py, r: 12, label: 'Sea Serpent' }),
  sd: () => ({ cx: WHITERUN.px, cy: WHITERUN.py, r: 3, label: 'Super dungeon' }),
  arch: () => ({ cx: WHITERUN.px, cy: WHITERUN.py, r: 2, label: 'Arch' }),
  ketch: () => ({ cx: SOLITUDE.px, cy: SOLITUDE.py, r: 4, label: 'Sky-Ketch' }),
  lodes: () => [{ cx: WHITERUN.px + 0.5, cy: WHITERUN.py + 0.5, r: 4, label: 'Motherlode' }],
  pois: () => [{ cx: WHITERUN.px + 0.5, cy: WHITERUN.py + 0.5, r: 2, label: 'POI' }],
  raids: () => [{ px: WHITERUN.px, py: WHITERUN.py, label: 'Raid' }],
  stars: () => [{ px: SOLITUDE.px, py: SOLITUDE.py, label: 'Star' }],
  // read so before (WW2, LAIR-WORLD, START3) - the one box keeps them
  gates: () => [{ cx: WHITERUN.px, cy: WHITERUN.py, r: 3, label: 'Gate' }],
  bounties: () => [{ cx: WHITERUN.px + 0.5, cy: WHITERUN.py + 0.5, r: 1.5, label: 'Bounty' }],
  revenants: () => [{ cx: SOLITUDE.px + 0.5, cy: SOLITUDE.py + 0.5, r: 1.5, label: 'Lair' }],
  quests: () => [{ px: SOLITUDE.px, py: SOLITUDE.py, label: 'Quest', placeName: 'Solitude' }],
});
const mkWin = (extra = {}) => new HeldMapWindow({
  getPlayerPixel: () => ({ x: 5, y: 5 }), getClimateIndex: () => CLIMATES.Woodlands,
  woods: { heightMapBuffer: new Uint8Array(1000 * 500).fill(10) },
  gold: () => 0, goldPieces: () => 0, hasHorse: false, hasCart: false, hasShip: false, diseaseCount: () => 0, poisonCount: () => 0,
  ...marksDeps(), ...extra,
});
/** What the poll kept, kind by kind. */
const kept = (win) => ({
  party: win._party.map((m) => m.name), trav: win._trav.map((m) => m.name), vendor: win._vendor?.town ?? null,
  // PIN MOVED (AUDIT BAY-LEFT, its packages merged): WW5's Hollows and KETCH-EVERYWHERE's stations are lists (`_sds`, `_ketches`), each read over the sheet's box
  serpent: win._serpent?.label ?? null, sd: win._sds?.[0]?.label ?? null, arch: win._arch?.label ?? null, ketch: win._ketches?.[0]?.label ?? null,
  lodes: win._lodes.length, pois: win._pois.length, raids: win._raids.length, stars: win._stars.length,
  gates: win._gates.length, bounties: win._bounties.length, lairs: win._revenants.length, quests: win._quests.length,
});

test('BAY-LEFT-MAPS C1 THE BOX READERS: over the Bay\'s own box each reads exactly what its Bay reader reads, edge rows and broken rows alike; over the continent\'s frame a mark past the Bay stands at its own pixel (mutants: a box edge read as the Bay\'s; the box\'s far edge dropped)', () => {
  const party = () => [
    { acct: 'in', name: 'In', px: 999, py: 499 }, { acct: 'east', name: 'East', px: 1000, py: 10 }, { acct: 'neg', name: 'Neg', px: -1, py: 10 },
    { acct: 'none', name: 'Unposed' }, null, { acct: 's', name: 'Solitude', ...SOLITUDE },
  ];
  assert.deepEqual(readPartyMarksIn(party, BAY_BOX), readPartyMarks(party, BAY), 'the Bay\'s box is the Bay\'s bound, to the row');
  assert.deepEqual(readPartyMarks(party, BAY).map((m) => m.acct), ['in']);
  const f = { x0: -589, y0: -883.5, w: 4960, h: 3100 };   // the freeware's fit's frame
  assert.deepEqual(readPartyMarksIn(party, f).map((m) => m.acct), ['in', 'east', 'neg', 's']);
  assert.deepEqual(readPartyMarksIn(party, f).find((m) => m.acct === 's'), { acct: 's', name: 'Solitude', px: 1569, py: -430, in: 0, loc: '', online: true, leader: false });
  const trav = () => [{ id: 'a', name: 'A', px: 999.9, py: 0, fx: 3, fy: 4 }, { id: 'b', name: 'B', px: 1000, py: 0 }, { id: 'c', name: 'C', ...WHITERUN, fx: 255, fy: 0 }];
  assert.deepEqual(readTravellerMarksIn(trav, BAY_BOX), readTravellerMarks(trav, BAY));
  assert.deepEqual(readTravellerMarksIn(trav, f).map((m) => [m.id, m.x, m.y]), [['a', 999 + 3.5 / 256, 1 - 4.5 / 256], ['b', 1000.001953125, 0.998046875], ['c', 1820 + 255.5 / 256, -300 + 1 - 0.5 / 256]]);
  for (const v of [{ px: 0, py: 0 }, { px: 999, py: 499 }, { px: 1000, py: 0 }, { px: -1, py: 3 }, SOLITUDE, { px: 1.5, py: 2 }]) {
    const fn = () => ({ ...v, label: 'L', town: 'T' });
    assert.deepEqual(readVendorMarkIn(fn, BAY_BOX), readVendorMark(fn, BAY), `the vendor at ${v.px},${v.py}`);
  }
  assert.equal(readVendorMarkIn(() => ({ ...SOLITUDE, town: 'Solitude' }), f).key, '1569,-430|Trader waypoint|Solitude');
  assert.equal(readVendorMarkIn(() => ({ px: f.x0 + f.w, py: 0 }), { ...f, x0: -589 }), null, 'the box\'s far edge is out, as the Bay\'s 1000 is');
  for (const g of [{ cx: -3, cy: 4, r: 3 }, { cx: -3.01, cy: 4, r: 3 }, { cx: 1003, cy: 4, r: 3 }, { cx: 1003.01, cy: 4, r: 3 }, { cx: 4, cy: 503, r: 3 }, { cx: 4, cy: -3.5, r: 3 }, { cx: SOLITUDE.px, cy: SOLITUDE.py, r: 12 }]) {
    assert.deepEqual(readGateMarkIn(() => g, BAY_BOX), readGateMark(() => g, BAY), `the ring at ${g.cx},${g.cy}`);
  }
  assert.equal(readGateMarkIn(() => ({ cx: SOLITUDE.px, cy: SOLITUDE.py, r: 12, label: 'Sea Serpent' }), f).label, 'Sea Serpent');
  // west and north of the Bay's corner, inside the frame - and past its far edges, out
  assert.equal(readGateMarkIn(() => ({ cx: -200, cy: -300, r: 4 }), f)?.cx, -200, 'a ring west of the Bay\'s corner');
  assert.equal(readGateMarkIn(() => ({ cx: f.x0 - 5, cy: 0, r: 4 }), f), null, 'west of the frame');
  assert.equal(readGateMarkIn(() => ({ cx: f.x0 + f.w + 5, cy: 0, r: 4 }), f), null, 'east of the frame');
  assert.equal(readVendorMarkIn(() => ({ px: -200, py: -300, town: 'West' }), f)?.town, 'West', 'a trader west of the Bay\'s corner');
  assert.deepEqual(readTravellerMarksIn(() => [{ id: 'w', name: 'W', px: -200, py: -300 }], f).map((m) => m.id), ['w']);
  const raids = () => [{ px: 0, py: 0 }, { px: 999, py: 499 }, { px: 1000, py: 0 }, { px: -1, py: 0 }, { px: WHITERUN.px, py: WHITERUN.py, key: 'w' }];
  assert.deepEqual(readRaidMarksIn(raids, BAY_BOX), readRaidMarks(raids, BAY));
  assert.deepEqual(readRaidMarksIn(raids, f).map((m) => m.key), ['0,0', '999,499', '1000,0', '-1,0', 'w']);
});

test('BAY-LEFT-MAPS C1 THE HELD MAP\'S POLL: with the continent on, the party, the travellers, the trader\'s coin, the serpent\'s ring, a Super dungeon\'s, an arch\'s, the Ketch\'s, the Motherlodes, the POIs, the raids and the stars past the Bay are all kept; with it off the sheet is the Bay\'s and they drop, the Bay\'s own kept (mutants: the party read over the Bay; the travellers over the Bay; the vendor over the Bay; the serpent over the Bay; the lodes over the Bay; the POIs over the Bay; the box the continent\'s with the continent off)', () => {
  _resetForTests();
  setTamrielFit(null);
  withDocument(() => {
    const on = mkWin();
    assert.equal(on._tamriel, true, 'the continent is on by default');
    assert.deepEqual(on._marksBox(), tamrielFrameInBay(), 'the sheet\'s box is the continent\'s frame');
    on._refreshParty();
    assert.deepEqual(kept(on), {
      party: ['In Solitude', 'In the Bay'], trav: ['Rider past the Bay', 'Rider on the Bay'], vendor: 'Solitude',
      serpent: 'Sea Serpent', sd: 'Super dungeon', arch: 'Arch', ketch: 'Sky-Ketch', lodes: 1, pois: 1, raids: 1, stars: 1,
      gates: 1, bounties: 1, lairs: 1, quests: 1,
    });
    on.dispose();
    setPref('tamrielMap', false);
    const off = mkWin({ vendor: () => ({ ...BAY_TOWN, label: 'Trader', town: 'Bayton' }) });
    assert.deepEqual(off._marksBox(), BAY_BOX, 'the continent put away: the Bay\'s own sheet');
    off._refreshParty();
    assert.deepEqual(kept(off), {
      party: ['In the Bay'], trav: ['Rider on the Bay'], vendor: 'Bayton', serpent: null, sd: null, arch: null, ketch: null, lodes: 0, pois: 0, raids: 0, stars: 0,
      gates: 0, bounties: 0, lairs: 0, quests: 0,
    });
    off.dispose();
  });
  _resetForTests();
});

test('BAY-LEFT-MAPS C1: the held map reads no mark against the Bay\'s 1000 x 500 any more - every reader of its poll takes the sheet\'s box (a source sweep of _refreshParty)', () => {
  const src = read('src/ui/heldMap.js');
  const poll = src.slice(src.indexOf('  _refreshParty() {'), src.indexOf('    this._partyKey = key;'));
  assert.doesNotMatch(poll, /this\._size\b(?!, sheet)/, 'no reader bound by this._size (the quests\' size is their fallback beside the box)');
  assert.match(poll, /const sheet = this\._marksBox\(\);/);
  assert.equal([...poll.matchAll(/, sheet[,)]/g)].length, 17, 'seventeen readers over the one box - the gates, the rings, the bounties, the lairs, the lodes, the POIs, the raids, the stars, the fissures, the quests, the coin, the travellers and the party');   // PIN MOVED (STOREFRONT): the season\'s Brass Fissures
});

const fresh = () => { delete globalThis.localStorage; _resetWaypoints(); };

test('BAY-LEFT-MAPS C2 WAYPOINTS PAST THE BAY: a flag of mine, my party\'s and my guild\'s stands in Solitude and Torval, a party line naming one is heard, a kept one comes back from the device, and the world\'s edge - the wire\'s own - is the edge (mutants: the Bay\'s bound back; the world\'s bound a pixel short)', () => {
  fresh();
  const mine = addWaypoint({ kind: 'personal', mx: 1569.5, my: -429.5, name: 'Solitude' });
  assert.deepEqual([mine.waypoint.mx, mine.waypoint.my, mine.waypoint.name], [1569.5, -429.5, 'Solitude']);
  assert.ok(addWaypoint({ kind: 'party', mx: 1922.5, my: 1705.5, name: 'Torval' }), 'a party\'s past the Bay');
  assert.ok(addWaypoint({ kind: 'guild', mx: -200.25, my: 300, name: 'West' }), 'west of the Bay\'s corner');
  assert.ok(addWaypoint({ mx: WORLD_PIXEL_BOUND - 0.5, my: 1 - WORLD_PIXEL_BOUND }), 'the world\'s last pixels');
  assert.equal(addWaypoint({ mx: WORLD_PIXEL_BOUND, my: 0 }), null, 'off the world');
  assert.equal(addWaypoint({ mx: 0, my: -WORLD_PIXEL_BOUND }), null);
  assert.deepEqual(decodeWaypointLine(`${WP_WIRE_PREFIX} add abc123 1569.5 -429.5 red Solitude`), { op: 'add', id: 'abc123', mx: 1569.5, my: -429.5, color: 'red', name: 'Solitude' });
  assert.equal(receiveWaypointLine({ ch: 'party', text: `${WP_WIRE_PREFIX} add zz1 1820.5 -299.5 gold Whiterun`, id: 'peer', name: 'Ann' }), true);
  assert.deepEqual([waypointById('zz1').mx, waypointById('zz1').my, waypointById('zz1').by], [1820.5, -299.5, 'Ann']);
  // the device's word: a reload keeps the flags past the Bay (readState held them to the Bay and dropped them)
  const store = new Map();
  globalThis.localStorage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v), removeItem: (k) => store.delete(k) };
  _resetWaypoints();
  addWaypoint({ mx: 2069.5, my: 658.5, name: 'Imperial City' });
  assert.match(store.get(WAYPOINT_STORE_KEY), /"mx":2069.5/);
  _resetWaypoints();
  assert.deepEqual(listWaypoints().map((w) => w.name), ['Imperial City'], 'read back from the device');
  fresh();
});

test('BAY-LEFT-MAPS C2 AN OLDER CLIENT: a line naming a point it cannot place is decoded as no waypoint and still TAKEN off the chat - nothing stored, nothing shown (the line off the world stands in for a point past the old Bay bound)', () => {
  fresh();
  const line = `${WP_WIRE_PREFIX} add old1 9000.5 1 red Far`;
  assert.equal(decodeWaypointLine(line), null);
  assert.equal(receiveWaypointLine({ ch: 'party', text: line, id: 'peer' }), true, 'a waypoint line, never a chat line');
  assert.deepEqual(listWaypoints(), []);
  fresh();
});

test('BAY-LEFT-MAPS C2 WILD-WAYPOINT IN CYRODIIL: a death in the open zone by the Imperial City and by Bruma plants the remains\' followed flag (mutants: the Bay\'s bound back)', async () => {
  fresh();
  const W = await import('../../src/systems/wild/wildRemainsWaypoint.js');
  const until = Date.now() + 3600e3;
  const ic = W.markRemains({ mx: 2069.5, my: 658.5, until });
  assert.ok(ic && waypointById(ic), 'by the Imperial City');
  assert.deepEqual([waypointById(ic).mx, waypointById(ic).my, waypointById(ic).name], [2069.5, 658.5, W.WILD_WP_NAME]);
  const bruma = W.markRemains({ mx: 2030.5, my: 560.5, until });
  assert.ok(bruma && waypointById(bruma) && !waypointById(ic), 'by Bruma - the last flag gone first');
  W.clearRemainsMark();
  fresh();
});

// PIN MOVED (OW-PLACE-WALK, 2026-10-28; bible/03-World/Arena-Provinces.md): "Travel here" on a flag past the Bay was never offered
// (TESA-NO-FAST). OW-PAST-BAY made a press on that land a walk, so a flag on it is walked to the same way - never one on the sea.
test('BAY-LEFT-MAPS C2 THE HELD MAP\'S RIGHT CLICK: the add menu opens on a point past the Bay while the continent is shown, and on the Bay\'s sheet alone while it is not; "Travel here" is offered on a flag on the Bay, on one on the land past it, and never on one on the sea past it (mutants: the menu held to the Bay; Travel here held to the Bay; the sea flag walked)', async () => {
  _resetForTests();
  setTamrielFit(null);
  fresh();
  const menu = await import('../../src/ui/waypointMenu.js');
  /** Every text the document holds, the menu's buttons among them. */
  const texts = (n, out = []) => { if (n?.textContent) out.push(n.textContent); for (const c of n?.children ?? []) texts(c, out); return out; };
  const armed = (win) => { win._phase = 'map'; win._paperPoint = (x, y) => [x, y]; win._onSheet = () => true; win._view = { ox: 0, oy: 0, scale: 1 }; win._it = null; win._to = { settings: { targetCoordsAllowed: true } }; return win; };
  withDocument(() => {
    const win = armed(mkWin());
    win._waypointAt = () => null;
    assert.equal(win._waypointContext(1569.5, -429.5), true, 'past the Bay, the continent shown');
    assert.ok(texts(globalThis.document.body).includes('New waypoint'));
    assert.equal(win._waypointContext(500, 250), true, 'on the Bay');
    assert.equal(win._waypointContext(9000, 0), false, 'off the frame');
    const far = addWaypoint({ mx: 1569.5, my: -429.5, name: 'Solitude' }).waypoint;
    const near = addWaypoint({ mx: 500.5, my: 250.5, name: 'Bayside' }).waypoint;
    win._waypointAt = () => near;
    globalThis.document.body.children.length = 0;
    win._waypointContext(0, 0);
    assert.ok(texts(globalThis.document.body).includes('Travel here'), 'a flag on the Bay: its journey');
    win._waypointAt = () => far;
    globalThis.document.body.children.length = 0;
    win._waypointContext(0, 0);
    const said = texts(globalThis.document.body);
    assert.ok(said.includes('Follow') && said.includes('Travel here'), 'a flag on the land past the Bay: walked to, as a press there is (OW-PAST-BAY)');
    const sea = addWaypoint({ mx: -299.5, my: 250.5, name: 'Offshore' }).waypoint;
    win._waypointAt = () => sea;
    globalThis.document.body.children.length = 0;
    win._waypointContext(0, 0);
    const wet = texts(globalThis.document.body);
    assert.ok(wet.includes('Follow') && !wet.includes('Travel here'), 'a flag on the sea past the Bay: no walk there');
    win._tamriel = true;
    win._waypointTravel(far);
    assert.deepEqual([win._selected?.pastBay, win._selected?.walk, win._selected?.door, win._selected?.x, win._panel], [true, true, false, 1569.5, 'travel'], 'its journey: the walk to its bare pixel (TRAVEL-EVERYWHERE)');
    menu.closeWaypointMenu();
    win.dispose();
    setPref('tamrielMap', false);
    const off = armed(mkWin());
    off._waypointAt = () => null;
    assert.equal(off._waypointContext(1569.5, -429.5), false, 'the continent put away: the Bay\'s sheet alone');
    assert.equal(off._waypointContext(500, 250), true);
    menu.closeWaypointMenu();
    off.dispose();
  });
  fresh();
  _resetForTests();
});

// ── ON THE PLAYER'S DATA ──────────────────────────────────────────────────────────────────────────────────────────

const ARENA2 = process.env.ARENA2_PATH ?? '';
const HAS = !!ARENA2 && existsSync(join(ARENA2, 'TAMRIEL2.IMG')) && existsSync(join(ARENA2, 'TMAP00I0.IMG'));

test('BAY-LEFT-MAPS C1 on the player\'s data: over the freeware\'s trace and fit, the held map keeps every mark at Solitude\'s and Whiterun\'s own pixels (lane C\'s probe p3: 1 party mark of 2, 1 traveller of 2, no coin, no ring, 0 Motherlodes before)', { skip: !HAS && 'no ARENA2_PATH' }, async () => {
  const bytes = (n) => new Uint8Array(readFileSync(join(ARENA2, n)));
  const { DFPalette } = await import('../../src/formats/dfPalette.js');
  const { preloadTamrielTrace } = await import('../../src/ui/tamrielTrace.js');
  const { setTamrielTrace } = await import('../../src/world/tamriel/tamrielLand.js');
  const pal = new DFPalette(); pal.load(bytes('ART_PAL.COL'), 'ART_PAL.COL');
  setTamrielTrace(await preloadTamrielTrace({ fetchBytes: async (n) => bytes(n), palette: pal, indexedDBRef: null }));
  setTamrielFit({ ox: 38 * 15.5, oy: 57 * 15.5, ppu: 15.5 });
  _resetForTests();
  withDocument(() => {
    const win = mkWin();
    assert.deepEqual(win._marksBox(), { x0: -589, y0: -883.5, w: 4960, h: 3100 });
    win._refreshParty();
    assert.deepEqual(kept(win), {
      party: ['In Solitude', 'In the Bay'], trav: ['Rider past the Bay', 'Rider on the Bay'], vendor: 'Solitude',
      serpent: 'Sea Serpent', sd: 'Super dungeon', arch: 'Arch', ketch: 'Sky-Ketch', lodes: 1, pois: 1, raids: 1, stars: 1,
      gates: 1, bounties: 1, lairs: 1, quests: 1,
    });
    win.dispose();
  });
  setTamrielFit(null);
  _resetForTests();
});
