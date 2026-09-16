// SOC6 - THE PARTY ON THE WORLD MAP (2026-09-16, Mac: "Party members
// should be able to be seen on the world map, regardless of their
// location").
//
// The slice is one seam and two drawings of it. The seam is a dep
// FUNCTION - `party: () => [{acct, name, px, py, in, loc, online,
// leader}]` - handed to whichever map the skin opens, read on that
// map's own refresh rather than snapshot at open, because a party
// changes while a map is up. The drawings are a green ring with a name
// under it on the enhanced overworld (ui/overworldMap.js) and a green
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
// (test/overworldmap.test.js fakeDocument), and the classic window
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
import { OverworldMapWindow } from '../src/ui/overworldMap.js';
import { createTravelMapWindow } from '../src/ui/travelMapDoor.js';
import {
  TravelMapWindow, OFFSET_LOOKUP, REGION_W, REGION_H, _setTravelMapArtForTests, PARTY_POLL_S,
} from '../src/ui/travelMapWindow.js';
import { buildMapDict } from '../src/systems/mapDirectory.js';
import { REGION_NAMES, LOCATION_TYPES, CLIMATES, getMapPixelID } from '../src/formats/mapsFile.js';
import { MAP_WIDTH, MAP_HEIGHT } from '../src/formats/woodsFile.js';
import { perspective, lookAt, mirrorProjectionX } from '../src/world/mat4.js';
import { resetTravelMapState } from '../src/systems/travelMapState.js';
import { restoreDiscovery } from '../src/systems/discovery.js';
import { _resetForTests } from '../src/systems/uiPrefs.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const skin = (v) => { _resetForTests(); globalThis.location = { search: `?skin=${v}` }; };

// ── THE ENHANCED HARNESS (test/overworldmap.test.js's own) ───────

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

const mkWin = (extra = {}) => new OverworldMapWindow(winDeps(extra));

/** The window's own camera, composed exactly as draw() composes it -
 *  so a label placed through _project is checked against the matrices
 *  the rings are actually drawn with, not against a second reading. */
const aimCamera = (win, tx, tz, dist) => {
  win._cam.tx = tx; win._cam.tz = tz; win._cam.dist = dist;
  win._vw = 800; win._vh = 600;
  win._proj = mirrorProjectionX(perspective(50 * Math.PI / 180, 800 / 600, 0.5, 6000));
  win._view = lookAt(win._eye(), [tx, win._groundY(), tz], [0, 1, 0]);
};

const member = (over = {}) => ({
  acct: 'a1', name: 'Nym', px: 3, py: 7, in: 0, loc: 'Daggerfall', online: true, leader: false, ...over,
});

const labels = (win) => win._chrome.party.children;
const labelText = (lab) => lab.children.map((c) => c.textContent).join(' | ');

// ── THE SEAM ─────────────────────────────────────────────────────

test('SOC6: the party dep is a FUNCTION the map keeps asking, and its absence draws nothing (mutants: party-read-once, party-snapshot-at-open, party-dep-required, party-poll-every-frame)', () => {
  skin('enhanced');
  withDocument(() => {
    // ABSENT IS ORDINARY: a solo player, an offline game and every host
    // that never heard of the hub pass no `party` at all.
    const solo = mkWin();
    assert.deepEqual(solo._party, [], 'no dep, no marks');
    assert.equal(solo._rings().length, 1, 'and the only ring is the player\'s own');
    solo.dispose();

    let reads = 0;
    let roster = [member()];
    const win = mkWin({ party: () => { reads++; return roster; } });
    assert.equal(reads, 1, 'the marks stand WITH the window - not a poll later');
    assert.equal(win._party.length, 1);
    // ...and the window keeps asking, because the party changes while
    // the map is open. A snapshot at open would freeze it here.
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
  assert.equal(key({}), key({ loc: 'Anywhere', leader: true }), 'a pose that moved nothing drawable');
  for (const moved of [{ px: 4 }, { py: 8 }, { in: 1 }, { online: false }, { name: 'Other' }]) {
    assert.notEqual(key({}), key(moved), `${JSON.stringify(moved)} is worth a repaint`);
  }
});

// ── THE ENHANCED MAP ─────────────────────────────────────────────

test('SOC6: the overworld rings a member in the player\'s own pass, at the pixel\'s CENTRE (mutants: ring-raw-pixel, ring-wrong-z-sign, ring-skips-party, ring-indistinct-from-player)', () => {
  skin('enhanced');
  withDocument(() => {
    const win = mkWin({ party: () => [member({ px: 3, py: 7 }), member({ acct: 'a2', name: 'Fen', px: 8, py: 2 })] });
    const rings = win._rings();
    assert.equal(rings.length, 3, 'the player, and one per member - the SAME pass, so the mark rides pan/zoom/flight');
    const [me, first, second] = rings;
    // the pixel's centre and the negated z: the player ring's own
    // reading (x + 0.5, -(y + 0.5)), which is what puts a member
    // standing where the player stands concentric with them
    assert.equal(first.center[0], 3.5);
    assert.equal(first.center[2], -7.5);
    assert.equal(second.center[0], 8.5);
    assert.equal(second.center[2], -2.5);
    assert.equal(first.center[1], win._heightAt(3.5, -7.5) + 0.3, 'and on the ground it stands on');
    // the green is the ONE green the slice draws a party in
    assert.deepEqual(first.color.slice(0, 3), [...PARTY_GREEN].slice(0, 3));
    assert.notDeepEqual(first.color, me.color, 'told apart from the player\'s white ring by colour');
    assert.ok(first.size < me.size, '...and by size, so the two never read as one mark');
  });
});

test('SOC6: offline is grey and still drawn, in the ring and in the label (mutants: offline-hidden, offline-green, offline-label-plain)', () => {
  skin('enhanced');
  withDocument(() => {
    const win = mkWin({ party: () => [member({ online: false })] });
    assert.equal(win._party.length, 1, 'a member who logged out is still WHERE they logged out');
    const ring = win._rings()[1];
    assert.notDeepEqual(ring.color.slice(0, 3), [...PARTY_GREEN].slice(0, 3), 'the life is out of the green');
    assert.equal(labels(win).length, 1);
    assert.equal(labels(win)[0].style.color, PARTY_OFFLINE_CSS);
    assert.match(partyHoverText(readPartyMarks(() => [member({ online: false })])[0]), /- offline$/,
      'and the hover line says so in words, not only in a colour');
    win.dispose();
  });
});

test('SOC6: the label names the member and rides _project through a pan (mutants: label-fixed-position, label-drops-name, label-ignores-projection, label-clamped-to-edge)', () => {
  skin('enhanced');
  withDocument(() => {
    const win = mkWin({ party: () => [member({ px: 3, py: 7, loc: 'Daggerfall' })] });
    win._phase = 'map';
    aimCamera(win, 5.5, -5.5, 40);
    win._positionPartyLabels();
    const lab = labels(win)[0];
    assert.match(labelText(lab), /Nym/, 'the name is the label');
    assert.match(labelText(lab), /Daggerfall/, 'and the place it names is under it');
    const at = () => [lab.style.left, lab.style.top];
    const projected = () => {
      const m = win._party[0];
      const p = win._project(m.x, m.y, m.z);
      return [`${Math.round(p[0])}px`, `${Math.round(p[1] + 17)}px`];
    };
    assert.deepEqual(at(), projected(), 'placed through the SAME projection the ring is drawn with');
    const before = at();
    // pan and zoom: the label must follow, because it is projected and
    // not pinned to a screen corner
    aimCamera(win, 2.0, -2.0, 120);
    win._positionPartyLabels();
    assert.notDeepEqual(at(), before, 'a pan moves the mark');
    assert.deepEqual(at(), projected(), '...to where the projection puts it');
    assert.equal(lab.style.display, 'block');
    // no camera yet (the veil's first frames, before draw has run):
    // hidden, never clamped to the border where it would name a place
    // it is not
    win._proj = null;
    win._positionPartyLabels();
    assert.equal(lab.style.display, 'none');
    // and the whole layer is down while the window is not the map
    win._phase = 'rise';
    win._positionPartyLabels();
    assert.equal(win._chrome.party.style.display, 'none');
    win.dispose();
  });
});

test('SOC6: regardless of their location - a dungeon and a building mark the PLACE\'s pixel and the label says which (mutants: indoor-hidden, in-word-dropped, in-word-swapped)', () => {
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
      assert.equal(m.z, -7.5);
    }
    assert.equal(partyPlaceWords(win._party[0]), 'dungeon');
    assert.equal(partyPlaceWords(win._party[1]), 'inside');
    assert.equal(partyPlaceWords(win._party[2]), '', 'open country has no word to add');
    assert.equal(partyLabelText(win._party[0]), 'Del (dungeon)');
    assert.equal(partyLabelText(win._party[1]), 'Bry (inside)');
    assert.equal(partyLabelText(win._party[2]), 'Oth');
    assert.match(labelText(labels(win)[0]), /Del \(dungeon\)/, 'and it is on the map, not only in a helper');
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
  // between locations the pose carries no place name - the wilderness
  // is named rather than left as a dangling dash
  assert.equal(partyHoverText(readPartyMarks(() => [member({ loc: '' })])[0]), 'Nym - the wilderness');

  skin('enhanced');
  withDocument(() => {
    const win = mkWin({ party: () => [member({ px: 3, py: 7, in: 1, loc: 'Privateers Hold' })] });
    win._phase = 'map';
    aimCamera(win, 3.5, -7.5, 40);
    const p = win._project(win._party[0].x, win._party[0].y, win._party[0].z);
    // a marker AND a place under the same cursor: the player pointed at
    // the green ring, and "who" is the answer they asked for
    win._markers = [{ x: 3.5, y: win._party[0].y, z: -7.5, colorIndex: 0, summary: { regionIndex: 17, name: 'Daggerfall' } }];
    win._hoverLabel(p[0], p[1]);
    assert.equal(win._chrome.label.textContent, 'Nym - Privateers Hold (dungeon)');
    assert.equal(win._chrome.root.style.cursor, 'pointer');
    win.dispose();
  });
});

test('SOC6: a party that moves repaints its marks and NEVER the map\'s own marker buffer (mutants: party-dirties-markers, party-rebuilds-relief, party-repaints-unchanged)', () => {
  skin('enhanced');
  withDocument(() => {
    let roster = [member({ px: 3, py: 7 })];
    const win = mkWin({ party: () => roster });
    // the location markers are a GL buffer built from the WHOLE mapDict;
    // a friend walking one pixel east must not cost that rebuild
    win._markersDirty = false;
    const markerBuffer = win._markers;
    let terrain = 0;
    win._ensureTerrain = () => { terrain++; };

    assert.equal(win._refreshParty(), false, 'an unchanged party repaints nothing at all');
    const labBefore = labels(win)[0];
    roster = [member({ px: 4, py: 7 })];
    assert.equal(win._refreshParty(), true, 'a member who moved does');
    assert.equal(win._party[0].x, 4.5, 'to the new pixel');
    assert.notEqual(labels(win)[0], labBefore, 'the label was re-minted');
    assert.equal(win._markersDirty, false, 'and the bay\'s dots were NOT dirtied');
    assert.equal(win._markers, markerBuffer, '...nor rebuilt');
    assert.equal(terrain, 0, '...nor the relief');
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
    // the offset is DFU's own indexing, shared with the dots above -
    // the same spelling travelmapwindow.test.js pins
    assert.ok(read('src/ui/travelMapWindow.js')
      .includes('const offset = Math.trunc((((height - y - 1) * width) + x) * this.scale);'),
    'the party walk reuses the dots walk\'s offset law rather than inventing one');
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
    assert.ok(win instanceof OverworldMapWindow);
    assert.equal(win._party.length, 1, 'the enhanced skin - which is the one online forces (OL1)');
    win.dispose();
  });
  // both windows name the dep in their own contract, so a host reading
  // either door's doc finds it
  assert.match(read('src/ui/travelMapDoor.js'), /party: \(\) => \[\{acct, name, px, py, in, loc, online, leader\}\]/);
  assert.match(read('src/ui/travelMapWindow.js'), /SOC6, an optional/);
  assert.match(read('src/ui/overworldMap.js'), /SOC6: and an optional `party:/);
});
