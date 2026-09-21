// SOC6 - THE PARTY ON THE WORLD MAP (2026-09-16, Mac: "Party members
// should be able to be seen on the world map, regardless of their
// location").
//
// The slice is one seam and two drawings of it. The seam is a dep
// FUNCTION - `party: () => [{acct, name, px, py, in, loc, online,
// leader}]` - handed to whichever map the skin opens, read on that
// map's own refresh rather than snapshot at open, because a party
// changes while a map is up. The drawings are a green ring with a name
// under it on the enhanced map (ui/heldMap.js since MAP1; the relief map before it) and a green
// dot on the classic region page (ui/travelMapWindow.js).
//
// WHAT IS WORTH PINNING, AND WHAT IS NOT. The relief and the region
// art are pictures; what can be WRONG here is: the party read once and
// then frozen, a member hidden for being indoors, a mark at the wrong
// pixel (the half-pixel centre and the negated z are the same reading
// the player's own ring uses, so a mark that gets them wrong sits
// beside the player rather than on them), an offline member vanishing
// instead of greying, the classic page forgetting that a pixel belongs
// to ONE province's sheet, and - the expensive one - a friend walking
// one pixel east costing a rebuild of the whole bay's marker buffer.
// Every one of those is driven here.
//
// The harness is the one the map tests already use: node drives the
// enhanced window through the stub document the door tests wrote
// (test/heldmap.test.js fakeDocument), and the classic window
// through _setTravelMapArtForTests with a hand-built region
// (test/travelvisibility.test.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  readPartyMarks, partyMarksKey, partyHoverText, partyLabelText, partyPlaceWords,
  PARTY_DOT_RGB, PARTY_OFFLINE_DOT_RGB, PARTY_MARK_CSS, PARTY_OFFLINE_CSS, PARTY_LEGEND_TEXT,
} from '../src/ui/partyMapMarks.js';
import { PARTY_GREEN, PARTY_GREEN_CSS, SocialState } from '../src/net/social.js';
import { HeldMapWindow } from '../src/ui/heldMap.js';
import { toPaper, PEN, PARTY_LABEL_STACK } from '../src/ui/inkMap.js';
import { createTravelMapWindow } from '../src/ui/travelMapDoor.js';
import {
  TravelMapWindow, OFFSET_LOOKUP, REGION_W, REGION_H, _setTravelMapArtForTests, PARTY_POLL_S,
} from '../src/ui/travelMapWindow.js';
import { buildMapDict } from '../src/systems/mapDirectory.js';
import { REGION_NAMES, LOCATION_TYPES, CLIMATES, getMapPixelID } from '../src/formats/mapsFile.js';
import { MAP_WIDTH, MAP_HEIGHT } from '../src/formats/woodsFile.js';
import { resetTravelMapState } from '../src/systems/travelMapState.js';
import { restoreDiscovery } from '../src/systems/discovery.js';
import { _resetForTests } from '../src/systems/uiPrefs.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const skin = (v) => { _resetForTests(); globalThis.location = { search: `?skin=${v}` }; };

// ── THE ENHANCED HARNESS (test/heldmap.test.js's own) ────────────
//
// MAP1 (2026-09-18): the enhanced map is the HELD PARCHMENT
// (ui/heldMap.js + ui/inkMap.js); the 3D relief and its DOM labels are
// RETIRED. The party is INK now - a ring and a name on the sheet, drawn
// by paintInk through the same view transform as every other mark - so
// the pins below drive the window's party state and a recording 2D
// context in place of `_rings` and the label nodes. Every LAW held
// here is the one SOC6 wrote: the dep polled and never snapshot, the
// marks at the pixel's centre, offline grey and still drawn, the label
// riding the projection, the hover sentence, the marks never dirtying
// the map's own, the legend with the first member and gone with the
// last, and AUDIT SOC's stacking of a shared pixel.

/** Just enough document for the chrome: elements that append, listen
 *  and classList without rendering anything. */
function fakeDocument() {
  const node = () => {
    const n = {
      children: [], style: {}, dataset: {}, classList: {
        toggle() {}, add() {}, remove() {},
      },
      append(...k) { n.children.push(...k); },
      remove() { n.removed = true; },
      addEventListener() {}, removeEventListener() {},
      setPointerCapture() {}, querySelectorAll: () => [],
      set innerHTML(v) { n.children = []; }, get innerHTML() { return ''; },
    };
    return n;
  };
  const body = node();
  return {
    createElement: () => node(),
    getElementById: () => null,
    head: node(),
    body,
    addEventListener() {}, removeEventListener() {},
  };
}

function withDocument(fn) {
  globalThis.document = fakeDocument();
  try { return fn(globalThis.document); } finally { delete globalThis.document; }
}

const winDeps = (extra = {}) => ({
  getPlayerPixel: () => ({ x: 5, y: 5 }),
  getClimateIndex: () => CLIMATES.Woodlands,
  woods: { heightMapBuffer: new Uint8Array(100).fill(10) },
  mapSize: { width: 10, height: 10 },
  gold: () => 10000, goldPieces: () => 10000,
  hasHorse: false, hasCart: false, hasShip: false,
  diseaseCount: () => 0, poisonCount: () => 0,
  ...extra,
});

const mkWin = (extra = {}) => new HeldMapWindow(winDeps(extra));

/** A recording 2D context: every call with the styles in force. */
function recordingCtx() {
  const calls = [];
  const state = {};
  return new Proxy({}, {
    get: (_, k) => {
      if (k === 'calls') return calls;
      if (k === 'measureText') return (t) => ({ width: t.length * 6 });
      if (k in state) return state[k];
      return (...args) => { calls.push({ fn: k, args, strokeStyle: state.strokeStyle, fillStyle: state.fillStyle }); };
    },
    set: (_, k, v) => { state[k] = v; return true; },
  });
}
/** The window's own paint, on a recording context: what the sheet
 *  would show for this window's party, view and selection. */
const paintOf = (win) => {
  const ctx = recordingCtx();
  win._chrome.ink.getContext = () => ctx;
  win._dirty = true;
  win._paint();
  delete win._chrome.ink.getContext;
  return ctx.calls;
};
/** The party's rings and names out of a paint: `arc` calls in the party
 *  colours, `fillText` calls in them. */
const partyInk = (calls) => ({
  rings: calls.filter((c) => c.fn === 'arc' && (c.strokeStyle === PARTY_MARK_CSS || c.strokeStyle === PARTY_OFFLINE_CSS)),
  names: calls.filter((c) => c.fn === 'fillText' && (c.fillStyle === PARTY_MARK_CSS || c.fillStyle === PARTY_OFFLINE_CSS)),
});
/** Lay the sheet out (the paper's size comes from the first layout, which
 *  the first tick runs) and aim the view by hand. */
const aimView = (win, ox, oy, scale) => { win._layout(); win._view = { ox, oy, scale }; win._goal = { ...win._view }; };

const member = (over = {}) => ({
  acct: 'a1', name: 'Nym', px: 3, py: 7, in: 0, loc: 'Daggerfall', online: true, leader: false, ...over,
});

// ── THE SEAM ─────────────────────────────────────────────────────

test('SOC6: the party dep is a FUNCTION the map keeps asking, and its absence draws nothing (mutants: party-read-once, party-snapshot-at-open, party-dep-required, party-poll-every-frame)', () => {
  skin('enhanced');
  withDocument(() => {
    // ABSENT IS ORDINARY: a solo player, an offline game and every host
    // that never heard of the hub pass no `party` at all.
    const solo = mkWin();
    solo._layout();
    assert.deepEqual(solo._party, [], 'no dep, no marks');
    assert.equal(partyInk(paintOf(solo)).rings.length, 0, 'and no ring on the sheet but the player\'s own mark');
    solo.dispose();

    let reads = 0;
    let roster = [member()];
    const win = mkWin({ party: () => { reads++; return roster; } });
    assert.equal(reads, 1, 'the marks stand WITH the window - not a poll later');
    assert.equal(win._party.length, 1);
    win.tick(0.3);
    assert.equal(reads, 2, 'the dep is re-read on the window\'s own poll');
    roster = [member(), member({ acct: 'a2', name: 'Fen', px: 8, py: 2 })];
    win.tick(0.05);
    assert.equal(reads, 2, 'and NOT every frame - the poll is rate-limited');
    assert.equal(win._party.length, 1, 'so the second member is not in yet');
    win.tick(0.25);
    assert.equal(reads, 3);
    assert.deepEqual(win._party.map((m) => m.name), ['Nym', 'Fen'], 'a member who joined while the map was up');
    roster = [];
    win.tick(0.3);
    assert.deepEqual(win._party, [], 'and one who left');
    win.dispose();
  });
});

test('SOC6: the marks drop what cannot be drawn and never clamp a member into the sea (mutants: clamp-to-bay, keep-nan-pixel, keep-poseless-row, drop-offline, drop-nameless)', () => {
  const size = { width: 1000, height: 500 };
  const marks = readPartyMarks(() => [
    member({ acct: 'in', px: 999, py: 499 }),
    member({ acct: 'east', px: 1000, py: 10 }),
    member({ acct: 'south', px: 10, py: 500 }),
    member({ acct: 'neg', px: -1, py: 10 }),
    // THE POSELESS SEAT. net/social.js keeps a member's `p` null until
    // their first pose lands, so world.js omits them; even if that
    // filter were dropped, a row with no pixel must not become 0,0 -
    // a friend reported in the Iliac Sea off Northmoor.
    { acct: 'none', name: 'Unposed' },
    null,
  ], size);
  assert.deepEqual(marks.map((m) => m.acct), ['in'], 'only the row with a real map pixel');
  assert.deepEqual([marks[0].px, marks[0].py], [999, 499], 'the far corner is IN, not clamped off');

  // offline is a mark, not an absence - where a friend logged out is
  // worth knowing
  const off = readPartyMarks(() => [member({ online: false })], size);
  assert.equal(off.length, 1);
  assert.equal(off[0].online, false);
  // a nameless seat still gets a mark: WHERE is what was asked for
  assert.equal(readPartyMarks(() => [member({ name: '' })], size)[0].name, 'Party member');
  // the dep's shapes that are not a list
  for (const bad of [undefined, null, () => null, () => 'nope', () => ({})]) {
    assert.deepEqual(readPartyMarks(bad, size), [], 'a dep that is not a list of rows draws nothing');
  }
  // the bay is MapsFile's own frame unless a caller says otherwise
  assert.deepEqual(readPartyMarks(() => [member({ px: MAP_WIDTH - 1, py: MAP_HEIGHT - 1 })]).length, 1);
  assert.deepEqual(readPartyMarks(() => [member({ px: MAP_WIDTH, py: 0 })]), []);

  // the signature is what a map repaints FOR: a moved, indoors, renamed
  // or logged-out member changes it; a pose that says the same thing
  // does not (the hub relays poses on a timer whether or not anyone
  // moved, and a map that repainted per pose would repaint forever)
  const key = (over) => partyMarksKey(readPartyMarks(() => [member(over)], size));
  // AUDIT SOC D6: `loc` IS worth a repaint - it is drawn (the enhanced label's second line and both maps' hover
  // sentence), and a member can walk from a town into the dungeon beside it without the map pixel moving at all,
  // because the pose carries the PLACE's own pixel. `leader` is not: no map draws it.
  assert.equal(key({}), key({ leader: true }), 'a pose that moved nothing drawable');
  for (const moved of [{ px: 4 }, { py: 8 }, { in: 1 }, { online: false }, { name: 'Other' }, { loc: 'Anywhere' }]) {
    assert.notEqual(key({}), key(moved), `${JSON.stringify(moved)} is worth a repaint`);
  }
});

// ── THE HELD MAP ─────────────────────────────────────────────────

test('SOC6: the held map rings a member at the pixel\'s CENTRE, through the sheet\'s own view transform, told from the player\'s mark by colour (mutants: ring-raw-pixel, ring-skips-party, ring-indistinct-from-player)', () => {
  skin('enhanced');
  withDocument(() => {
    const win = mkWin({ party: () => [member({ px: 3, py: 7 }), member({ acct: 'a2', name: 'Fen', px: 8, py: 2 })] });
    // the pixel's centre: what puts a member standing where the player
    // stands concentric with them
    assert.deepEqual(win._party.map((m) => [m.x, m.y]), [[3.5, 7.5], [8.5, 2.5]]);
    aimView(win, 0, 0, 20);
    const { rings } = partyInk(paintOf(win));
    assert.equal(rings.length, 2, 'one ring per member');
    assert.deepEqual(rings.map((r) => r.args.slice(0, 2)), [toPaper(win._view, 3.5, 7.5), toPaper(win._view, 8.5, 2.5)],
      'placed through toPaper - the SAME transform every mark on the sheet rides, so a pan or a zoom moves them for free');
    assert.equal(rings[0].strokeStyle, PARTY_MARK_CSS, 'the ONE green the slice draws a party in');
    assert.notEqual(rings[0].strokeStyle, PEN.player, 'told apart from the player\'s own mark by colour');
    win.dispose();
  });
});

test('SOC6: offline is grey and still drawn, in the ring, the name and the hover words (mutants: offline-hidden, offline-green, offline-label-plain)', () => {
  skin('enhanced');
  withDocument(() => {
    const win = mkWin({ party: () => [member({ online: false })] });
    assert.equal(win._party.length, 1, 'a member who logged out is still WHERE they logged out');
    aimView(win, 0, 0, 20);
    const { rings, names } = partyInk(paintOf(win));
    assert.equal(rings[0].strokeStyle, PARTY_OFFLINE_CSS, 'the life is out of the green');
    assert.equal(names[0].fillStyle, PARTY_OFFLINE_CSS);
    assert.match(partyHoverText(readPartyMarks(() => [member({ online: false })])[0]), /- offline$/,
      'and the hover line says so in words, not only in a colour');
    win.dispose();
  });
});

test('SOC6: the name rides the ring through a pan and a zoom, and neither is drawn while the mark is off the sheet (mutants: label-fixed-position, label-drops-name, label-ignores-view)', () => {
  skin('enhanced');
  withDocument(() => {
    const win = mkWin({ party: () => [member({ px: 3, py: 7, loc: 'Daggerfall' })] });
    aimView(win, 0, 0, 20);
    const at = () => { const { rings, names } = partyInk(paintOf(win)); return { ring: rings[0]?.args.slice(0, 2), name: names[0] }; };
    const first = at();
    assert.equal(first.name.args[0], 'Nym', 'the name is the label');
    assert.deepEqual(first.ring, toPaper(win._view, 3.5, 7.5));
    assert.equal(first.name.args[1], first.ring[0], 'centred under its ring');
    assert.equal(first.name.args[2], first.ring[1] + 9, 'nine px below it');
    aimView(win, 1, 2, 40);
    const second = at();
    assert.notDeepEqual(second.ring, first.ring, 'a pan and a zoom move the mark');
    assert.deepEqual(second.ring, toPaper(win._view, 3.5, 7.5), '...to where the view puts it');
    // off the sheet: neither the ring nor the name is inked
    aimView(win, 8, 8, 40);
    const gone = at();
    assert.equal(gone.ring, undefined);
    assert.equal(gone.name, undefined);
    win.dispose();
  });
});

test('SOC6: regardless of their location - a dungeon and a building mark the PLACE\'s pixel and the name says which (mutants: indoor-hidden, in-word-dropped, in-word-swapped)', () => {
  skin('enhanced');
  withDocument(() => {
    const roster = [
      member({ acct: 'd', name: 'Del', px: 3, py: 7, in: 1, loc: 'Privateers Hold' }),
      member({ acct: 'b', name: 'Bry', px: 3, py: 7, in: 2, loc: 'The Odd Blades' }),
      member({ acct: 'o', name: 'Oth', px: 3, py: 7, in: 0, loc: 'Daggerfall' }),
    ];
    const win = mkWin({ party: () => roster });
    assert.equal(win._party.length, 3, 'nobody is hidden for being indoors - that was the whole sentence');
    for (const m of win._party) {
      assert.equal(m.x, 3.5, 'all three mark the same place pixel - the pose carries the PLACE\'s own');
      assert.equal(m.y, 7.5);
    }
    assert.equal(partyPlaceWords(win._party[0]), 'dungeon');
    assert.equal(partyPlaceWords(win._party[1]), 'inside');
    assert.equal(partyPlaceWords(win._party[2]), '', 'open country has no word to add');
    assert.equal(partyLabelText(win._party[0]), 'Del (dungeon)');
    assert.equal(partyLabelText(win._party[1]), 'Bry (inside)');
    assert.equal(partyLabelText(win._party[2]), 'Oth');
    aimView(win, 0, 0, 20);
    assert.deepEqual(partyInk(paintOf(win)).names.map((n) => n.args[0]), ['Del (dungeon)', 'Bry (inside)', 'Oth'], 'and it is on the sheet, not only in a helper');
    win.dispose();
  });
});

test('SOC6: the hover line reads "Name - place (dungeon)" and beats the place under it (mutants: hover-location-first, hover-drops-kind, hover-drops-wilderness)', () => {
  assert.equal(partyHoverText(readPartyMarks(() => [member({ in: 1, loc: 'Privateers Hold' })])[0]),
    'Nym - Privateers Hold (dungeon)');
  assert.equal(partyHoverText(readPartyMarks(() => [member({ in: 2, loc: 'The Odd Blades' })])[0]),
    'Nym - The Odd Blades (inside)');
  assert.equal(partyHoverText(readPartyMarks(() => [member({ in: 0, loc: 'Daggerfall' })])[0]),
    'Nym - Daggerfall');
  assert.equal(partyHoverText(readPartyMarks(() => [member({ loc: '' })])[0]), 'Nym - the wilderness');

  skin('enhanced');
  withDocument(() => {
    const summary = { id: getMapPixelID(3, 7), mapID: 1, regionIndex: 17, mapIndex: 0, locationType: LOCATION_TYPES.TownCity, discovered: true };
    const win = mkWin({
      party: () => [member({ px: 3, py: 7, in: 1, loc: 'Privateers Hold' })],
      mapDict: new Map([[summary.id, summary]]),
      maps: { regionCount: 1, getRegion: () => ({ mapNames: ['Daggerfall'] }), getPoliticIndex: () => 128 },
    });
    aimView(win, 0, 0, 20);
    const p = toPaper(win._view, 3.5, 7.5);
    // a marker AND a place under the same cursor: the player pointed at
    // the green ring, and "who" is the answer they asked for
    assert.equal(win._markerAt(p[0], p[1])?.name, 'Daggerfall', 'the town IS under the cursor');
    assert.deepEqual(win._hoverLabel(p[0], p[1]),
      { label: 'Nym - Privateers Hold (dungeon)', cursor: 'pointer' });
    win.dispose();
  });
});

test('SOC6: a party that moves repaints its marks and NEVER the map\'s own (mutants: party-dirties-markers, party-rebuilds-chains, party-repaints-unchanged)', () => {
  skin('enhanced');
  withDocument(() => {
    let roster = [member({ px: 3, py: 7 })];
    const win = mkWin({ party: () => roster });
    const model = win._sheet.ensure();
    win._marksDirty = false;
    const marks = model.marks, coast = model.coast;

    win._dirty = false;
    assert.equal(win._refreshParty(), false, 'an unchanged party repaints nothing at all');
    assert.equal(win._dirty, false);
    roster = [member({ px: 4, py: 7 })];
    assert.equal(win._refreshParty(), true, 'a member who moved does');
    assert.equal(win._party[0].x, 4.5, 'to the new pixel');
    assert.equal(win._dirty, true, 'the sheet is repainted');
    assert.equal(win._marksDirty, false, 'and the bay\'s marks were NOT dirtied');
    assert.equal(win._sheet.ensure().marks, marks, '...nor rebuilt');
    assert.equal(win._sheet.ensure().coast, coast, '...nor the chains');
    win.dispose();
  });
});

test('SOC6: the legend names the mark, and only while there is a mark to name (mutants: legend-always-open, legend-text-dropped, legend-never-opens)', () => {
  skin('enhanced');
  withDocument(() => {
    let roster = [];
    const win = mkWin({ party: () => roster });
    assert.equal(win._chrome.legend.children.length, 0, 'a solo map explains a mark it does not draw');
    roster = [member()];
    win._refreshParty();
    const words = win._chrome.legend.children.map((c) => c.textContent).filter(Boolean);
    assert.deepEqual(words, [PARTY_LEGEND_TEXT], 'the legend says what the green ring is');
    assert.equal(win._chrome.legend.style.display, 'flex');
    assert.equal(win._chrome.legend.children[0].style.background, PARTY_MARK_CSS, 'beside the colour it explains');
    roster = [];
    win._refreshParty();
    assert.equal(win._chrome.legend.style.display, 'none', 'and it goes with the last member');
    win.dispose();
  });
});

// ── THE CLASSIC PAGE ─────────────────────────────────────────────

const DAGGERFALL = 17, WAYREST = 18;
const ORIGIN = OFFSET_LOOKUP['FMAP0I17.IMG'];
const mapIdOf = (x, y) => (DAGGERFALL << 20) | getMapPixelID(x, y);
const row = (x, y, locationType) => ({
  mapId: mapIdOf(x, y), longitude: x * 128, latitude: (499 - y) * 128,
  locationType, discovered: true, dungeonType: 255,
});

function classicWorld(extra = {}) {
  resetTravelMapState();
  const entries = [['Daggerfall', row(50, 120, LOCATION_TYPES.TownCity)]];
  const mapNames = entries.map((e) => e[0]);
  const mapTable = entries.map((e) => e[1]);
  const region = {
    name: REGION_NAMES[DAGGERFALL], locationCount: entries.length, mapNames, mapTable,
    mapNameLookup: new Map(mapNames.map((n, i) => [n, i])),
    mapIdLookup: new Map(mapTable.map((r, i) => [r.mapId, i])),
  };
  const maps = {
    regionCount: 62,
    getRegion: (i) => (i === DAGGERFALL ? region : null),
    getRegionByName: (n) => (n === region.name ? region : null),
    getRegionName: (i) => REGION_NAMES[i] ?? '',
    // one pixel of this rectangle belongs to Wayrest's sheet, which is
    // the page's own containment law
    getPoliticIndex: (x, y) => (x === 60 && y === 130 ? 128 + WAYREST : 128 + DAGGERFALL),
    getClimateIndex: () => CLIMATES.Woodlands,
  };
  return {
    maps, mapDict: buildMapDict(maps),
    getPlayerPixel: () => ({ x: 50, y: 120 }),
    getClimateIndex: () => CLIMATES.Woodlands,
    gold: () => 1000, diseaseCount: () => 0, onTravel: () => {},
    ...extra,
  };
}

const mountArt = () => _setTravelMapArtForTests({
  overworld: { tex: 't', w: 320, h: 200 },
  findAt: { tex: 't', w: 45, h: 22 },
  filterOn: { tex: 't', w: 179, h: 22 }, filterOff: { tex: 't', w: 179, h: 22 },
  downArrow: { tex: 't', w: 22, h: 20 }, upArrow: { tex: 't', w: 22, h: 20 },
  rightArrow: { tex: 't', w: 22, h: 20 }, leftArrow: { tex: 't', w: 22, h: 20 },
  border: { tex: 't', w: 320, h: 160 },
  pickerBitmap: { width: 320, height: 200, data: new Uint8Array(320 * 200) },
  fmapPalette: null, textRsc: null,
  locationPixelColors: new Array(14).fill(0).map((_, i) => 0xff000001 + i),
  identifyFlashColor: 0xff0f27a3, regionMaps: new Map(), deps: {},
});

const packed = (rgb) => (((255 << 24) >>> 0) | (rgb[2] << 16) | (rgb[1] << 8) | rgb[0]) >>> 0;
const dotAt = (w, mx, my) => w._dotsBuf[((REGION_H - (my - ORIGIN[1]) - 1) * REGION_W) + (mx - ORIGIN[0])];

test('SOC6: the classic page draws the member as a green dot, OVER the town they stand in (mutants: classic-party-dropped, classic-under-the-dots, classic-wrong-green, classic-offline-green)', () => {
  restoreDiscovery(null);
  mountArt();
  try {
    const w = new TravelMapWindow(classicWorld({
      party: () => [
        member({ acct: 'a1', name: 'Nym', px: 50, py: 120 }),          // standing in Daggerfall itself
        member({ acct: 'a2', name: 'Fen', px: 52, py: 121, in: 1 }),   // in a dungeon, on its pixel
        member({ acct: 'a3', name: 'Gil', px: 53, py: 121, online: false }),
      ],
    }));
    w._openRegionPanel(DAGGERFALL);
    // the green is derived from the ONE party green, not spelled twice
    assert.deepEqual(PARTY_DOT_RGB, [115, 255, 115], 'the bytes of net/social.js\'s own #73ff73');
    assert.equal(PARTY_GREEN_CSS, '#73ff73', '...which is the green a party member\'s name turns everywhere else');
    assert.equal(dotAt(w, 50, 120), packed(PARTY_DOT_RGB),
      'the member wins the pixel over the town\'s own dot - a town is on the page either way');
    assert.equal(dotAt(w, 52, 121), packed(PARTY_DOT_RGB),
      'and a member in a DUNGEON is on the page too - regardless of their location');
    assert.equal(dotAt(w, 53, 121), packed(PARTY_OFFLINE_DOT_RGB), 'offline greys and stays');
    assert.notEqual(packed(PARTY_DOT_RGB), packed(PARTY_OFFLINE_DOT_RGB));
  } finally { _setTravelMapArtForTests(null); restoreDiscovery(null); }
});

test('SOC6: the classic dot keeps the page\'s own two containment laws (mutants: classic-ignores-politic, classic-ignores-origin, classic-clamps-to-page)', () => {
  restoreDiscovery(null);
  mountArt();
  try {
    const w = new TravelMapWindow(classicWorld({
      party: () => [
        member({ acct: 'a1', px: 60, py: 130 }),   // inside the rectangle, but Wayrest's province
        member({ acct: 'a2', px: 5, py: 5 }),      // west and north of the page's origin
        member({ acct: 'a3', px: 400, py: 400 }),  // past its far corner
        // THE TWO THAT WRAP. The page is a 320-wide strip of a
        // 1000-wide bay, and the offset is `row * 320 + x` - so a
        // member ONE pixel west of the origin (x = -1) computes a
        // texel at the END of the row above, and one pixel east of its
        // far edge (x = 320) computes the START of the row below. Both
        // land INSIDE the buffer, so only the bounds test refuses
        // them: without it a friend in Glenpoint draws a green dot in
        // the middle of Daggerfall's sheet, on the wrong row.
        member({ acct: 'a4', px: ORIGIN[0] - 1, py: ORIGIN[1] + 74 }),
        member({ acct: 'a5', px: ORIGIN[0] + REGION_W, py: ORIGIN[1] + 94 }),
      ],
    }));
    w._openRegionPanel(DAGGERFALL);
    assert.equal(dotAt(w, 60, 130), 0,
      'a pixel belongs to ONE province\'s sheet - Wayrest does not bleed onto Daggerfall\'s');
    assert.equal(w._dotsBuf.reduce((n, v) => n + (v === packed(PARTY_DOT_RGB) ? 1 : 0), 0), 0,
      'and nothing off the page is clamped onto its border, where it would name a place it is not');
    // AUDIT SOC D12: the assertion that used to stand here grepped for `const offset = Math.trunc(...)` - a line
    // that occurs THREE times in travelMapWindow.js, so it passed with the party walk deleted outright. The dotAt
    // assertions above and below are the ones that can tell a party dot from no party dot, and they are enough.
  } finally { _setTravelMapArtForTests(null); restoreDiscovery(null); }
});

test('SOC6: the classic page re-reads the party on a timer and rebuilds only on a CHANGE (mutants: classic-never-polls, classic-rebuilds-every-tick, classic-poll-below-the-popup, classic-polls-with-no-page)', () => {
  restoreDiscovery(null);
  mountArt();
  try {
    let roster = [member({ acct: 'a1', px: 52, py: 121 })];
    const w = new TravelMapWindow(classicWorld({ party: () => roster }));
    let builds = 0;
    const real = w._updateMapLocationDotsTexture.bind(w);
    w._updateMapLocationDotsTexture = () => { builds++; real(); };

    // no page up: there is no dots buffer to be wrong
    assert.equal(w.regionSelected, false);
    w.tick(PARTY_POLL_S + 0.1);
    assert.equal(builds, 0, 'the world map page has no dots to rebuild');

    w._openRegionPanel(DAGGERFALL);
    builds = 0;
    w.tick(PARTY_POLL_S + 0.1);
    assert.equal(builds, 0, 'a party that has not moved costs a string compare, not a buffer');

    roster = [member({ acct: 'a1', px: 53, py: 121 })];
    w.tick(PARTY_POLL_S / 2);
    assert.equal(builds, 0, 'the poll is rate-limited - a pose per frame cannot repaint per frame');
    w.tick(PARTY_POLL_S);
    assert.equal(builds, 1, 'and the move lands');
    assert.equal(dotAt(w, 52, 121), 0, 'the old pixel is clear');
    assert.equal(dotAt(w, 53, 121), packed(PARTY_DOT_RGB), 'the new one carries the dot');

    w.tick(PARTY_POLL_S + 0.1);
    assert.equal(builds, 1, 'and nothing moved since');

    // a popup, a box or the picker freezes this window's own animation;
    // it must not freeze another player walking
    w.popUp = { tick() {}, done: false };
    roster = [member({ acct: 'a1', px: 54, py: 121 })];
    w.tick(PARTY_POLL_S + 0.1);
    assert.equal(builds, 2, 'the page behind the box is still right when the box comes down');
    w.popUp = null;
  } finally { _setTravelMapArtForTests(null); restoreDiscovery(null); }
});

// ── THE HOST ─────────────────────────────────────────────────────

test('SOC6: world.js hands the ONE dep bag a party function, and a seatless pose is omitted (mutants: partyMarkers-keeps-poseless, partyMarkers-snapshot, partyMarkers-includes-me, bag-loses-a-key)', () => {
  const src = read('src/scenes/world.js');
  assert.equal([...src.matchAll(/createTravelMapWindow\(\{/g)].length, 1, 'still ONE construction seam');
  const bag = src.slice(src.indexOf('createTravelMapWindow({'));
  // U61's pins, intact: the additions went on new lines
  assert.match(bag, /\bwoods,/, 'the relief still rides the one bag');
  assert.match(bag, /getPlayerPixel: playerTravelOrigin/, 'and so does the player pixel');
  assert.match(bag, /party: \(\) => partyMarkers\(\),/, 'and now the party, as a FUNCTION read on each refresh');

  // the composer: the members OTHER than me (my own seat is the
  // player's own mark on both maps), and only those whose pose has
  // arrived
  const fn = src.slice(src.indexOf('const partyMarkers = ()'), src.indexOf('const partyFrame = '));
  assert.match(fn, /social\?\.others\(\) \?\? \[\]/, 'the party\'s OTHER members - never my own seat twice');
  assert.match(fn, /\.filter\(\(m\) => !!m\.p\)/, 'a seat with no pose yet is omitted');
  assert.match(fn, /px: m\.p\.px, py: m\.p\.py, in: m\.p\.in \?\? 0, loc: m\.p\.loc \?\? ''/,
    'the pose\'s own travel pixel, and `in` beside it');

  // WHY the filter is load-bearing, driven on the real picture: a
  // member takes their seat before their first pose lands, and
  // net/social.js holds `p` null until it does - so the unfiltered map
  // would read `m.p.px` off null and take the travel map down with it.
  const social = new SocialState();
  social.apply({
    t: 'social', k: 'state', acct: 'me', name: 'Me', friends: [], in: [], out: [], invites: [],
    party: {
      id: 'p1',
      leader: 'me',
      members: [
        { acct: 'me', name: 'Me', online: true, seen: null, peers: [], p: null },
        { acct: 'a1', name: 'Nym', online: true, seen: null, peers: [], p: null },
      ],
    },
  });
  assert.deepEqual(social.others().map((m) => m.p), [null], 'the seat is taken, the pose is not in yet');
  assert.throws(() => social.others().map((m) => ({ px: m.p.px })), TypeError,
    'which is what the filter stands between the map and');
  social.applyParty('a1', { px: 3, py: 7, in: 1, loc: 'Privateers Hold' });
  assert.deepEqual(social.others().filter((m) => !!m.p).map((m) => m.p.px), [3], 'and once it lands, the mark can be drawn');
});

test('SOC6: the door carries the party to whichever skin the host wears (mutants: door-strips-party, door-forks-the-bag)', () => {
  skin('enhanced');
  withDocument(() => {
    const win = createTravelMapWindow(winDeps({ party: () => [member()] }));
    assert.ok(win instanceof HeldMapWindow);
    assert.equal(win._party.length, 1, 'the enhanced skin - which is the one online forces (OL1)');
    win.dispose();
  });
  // both windows name the dep in their own contract, so a host reading
  // either door's doc finds it
  assert.match(read('src/ui/travelMapDoor.js'), /party: \(\) => \[\{acct, name, px, py, in, loc, online, leader\}\]/);
  assert.match(read('src/ui/travelMapWindow.js'), /SOC6, an optional/);
  assert.match(read('src/ui/heldMap.js'), /SOC6: and an optional `party:/);
});


// ── THE AUDIT'S OWN PINS ─────────────────────────────────────────

test('AUDIT SOC D2: members on ONE pixel stack rather than stand on top of each other - three distinct name lines in seat order, and a hover line that names all three (mutants: the stagger dropped, so three names draw as one smear; the hover naming the nearest only; the stagger applied to members who are NOT on the same pixel)', () => {
  skin('enhanced');
  withDocument(() => {
    const together = [
      member({ acct: 'a1', name: 'Nym', px: 3, py: 7, loc: 'Daggerfall' }),
      member({ acct: 'a2', name: 'Del', px: 3, py: 7, in: 1, loc: 'Privateers Hold' }),
      member({ acct: 'a3', name: 'Bry', px: 3, py: 7, in: 2, loc: 'The Odd Blades' }),
      member({ acct: 'a4', name: 'Oth', px: 8, py: 2, loc: 'Wayrest' }),
    ];
    const win = mkWin({ party: () => together });
    aimView(win, 0, 0, 20);
    // the stack index is the hub's seat order among the members sharing that pixel, and nobody else's
    assert.deepEqual(win._party.map((m) => m.stack), [0, 1, 2, 0], 'the fourth is alone on its own pixel');
    const { names } = partyInk(paintOf(win));
    const tops = names.slice(0, 3).map((n) => n.args[2]);
    assert.equal(new Set(tops).size, 3, 'three DISTINCT lines - this is the whole finding');
    const p = toPaper(win._view, 3.5, 7.5);
    assert.deepEqual(tops, [0, 1, 2].map((i) => p[1] + 9 + i * PARTY_LABEL_STACK), 'each one label further down than the last');
    // ...and the one standing elsewhere is not pushed down by them
    const q = toPaper(win._view, 8.5, 2.5);
    assert.equal(names[3].args[2], q[1] + 9);
    // THE HOVER NAMES EVERY MEMBER ON THAT PIXEL.
    const line = win._hoverLabel(p[0], p[1]).label;
    for (const who of ['Nym', 'Del', 'Bry']) assert.match(line, new RegExp(who), `${who} is named`);
    assert.equal(line.split(' / ').length, 3, 'joined with " / ", one clause each');
    assert.match(line, /Del - Privateers Hold \(dungeon\)/, 'and each clause is that member\'s own sentence');
    assert.doesNotMatch(line, /Oth/, 'the member on another pixel is not in it');
    assert.equal(win._hoverLabel(q[0], q[1]).label, 'Oth - Wayrest');
    win.dispose();
  });
});

test('AUDIT SOC C16/C17 (MAP1): the party is INK - no label node, no title, no clamp; the name is placed by the same transform as its ring (mutants: a DOM label layer put back; the name placed by a second transform)', () => {
  // C16/C17 were about DOM labels over a GL relief - a pointer-transparent layer whose `title` could never show, and a
  // label cut by the root's overflow. MAP1 draws the party ON THE SHEET, so there is no label node to carry a title and
  // no window edge to be cut by: the canvas IS the paper, and what is off the paper is simply not drawn.
  const src = read('src/ui/heldMap.js');
  assert.doesNotMatch(src, /lab\.title = |_partyLabels|_positionPartyLabels/, 'no label nodes at all');
  assert.match(src, /partyHoverText/, 'the sentence lives on in the hover line');
  const ink = read('src/ui/inkMap.js');
  assert.match(ink, /const \[x, y\] = toPaper\(view, m\.x, m\.y\);\s*\n\s*ctx\.strokeStyle = m\.color;[\s\S]{0,400}ctx\.fillText\(m\.name, x, y \+ 9 \+ \(m\.stack \?\? 0\) \* PARTY_LABEL_STACK\);/,
    'ring and name from ONE toPaper read');
  assert.doesNotMatch(read('src/ui/enhancedStyle.js'), /\.ovparty|\.hmparty/, 'and no layer in the stylesheet either');
});

test('AUDIT SOC C10/D5 (MAP1): the legend is a flex child of the FOOT row, beside the hint and the band, so it wraps with them instead of landing on them (mutants: the legend floated at a guessed height again; the legend appended to the root)', () => {
  const style = read('src/ui/enhancedStyle.js');
  assert.match(style, /\.hmlegend \{\s*position: static; flex: none; display: none;/, 'a chip, not a floating box');
  assert.doesNotMatch(style, /\.hmlegend \{[^}]*bottom: 70px/, 'no guess about how tall the row happens to be');
  assert.match(style, /\.hmfoot \{\s*position: absolute; left: 18px; bottom: 18px; display: flex; gap: 12px;/, 'the row it lives in');
  assert.match(style, /@media \(max-width: 860px\) \{[\s\S]*?\.hmfoot \{ left: 12px; bottom: 12px; flex-wrap: wrap;/, '...and still the row that wraps');
  assert.match(read('src/ui/heldMap.js'), /const legend = el\('div', 'hmlegend'\);[\s\S]{0,400}?foot\.append\(hint, band, legend, ports\);/, 'appended INTO the foot (MAP2 put the ports button beside it)');
  skin('enhanced');
  withDocument(() => {
    const win = mkWin({ party: () => [member()] });
    const foot = win._chrome.root.children.find((c) => c.children.includes(win._chrome.legend));
    assert.ok(foot, 'the legend is a child of the foot row, not of the root');
    assert.equal(win._chrome.root.children.includes(win._chrome.legend), false);
    assert.equal(win._chrome.legend.style.display, 'flex');
    win.dispose();
  });
});

test('AUDIT SOC D7/D9: the offline grey is DERIVED from the dot bytes rather than typed twice, and the hover radius says 18 and why (mutants: the CSS grey typed back by hand, so the label and the classic dot drift again; the comment claiming the markers\' own 16)', () => {
  const hex = (rgb) => '#' + rgb.map((v) => v.toString(16).padStart(2, '0')).join('');
  assert.equal(PARTY_OFFLINE_CSS, hex(PARTY_OFFLINE_DOT_RGB), 'the DOM grey IS the buffer grey');
  assert.equal(PARTY_OFFLINE_CSS, '#8c948c');
  assert.equal(PARTY_MARK_CSS, PARTY_GREEN_CSS, 'and the live one was always derived, as it still is');
  const marks = read('src/ui/partyMapMarks.js');
  assert.match(marks, /export const PARTY_OFFLINE_CSS = hex\(PARTY_OFFLINE_DOT_RGB\);/, 'derived, not spelled');
  const bare = marks.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');
  assert.doesNotMatch(bare, /#8c9/, 'the literal is not in the module\'s code at all - only the derivation is');
  // D9: the radius, and the reason for it - on the held map now
  const src = read('src/ui/heldMap.js');
  assert.match(src, /_partyAt\(sx, sy\) \{\s*\n\s*let best = null, bestD = 18 \* 18;/);
  assert.match(src, /radius of 18[\s\S]{0,400}WIDER than the location markers/, 'the comment says the number it uses and why it is not the markers\' own');
  assert.match(src, /_markerAt\(sx, sy\) \{\s*\n\s*let best = null, bestD = 16 \* 16;/, 'and the markers still pick at 16');
});
