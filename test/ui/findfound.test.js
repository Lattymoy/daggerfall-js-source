// FIND-FOUND (2026-10-31, from Discord: a quest sent a player to "Helbenar" in Morrowind and the find box had no such
// place; bible/10-UI/Held-Map-Arc.md FIND-FOUND). A countryside place or a lair past the Bay (TESA7, TESA8) is a pixel's
// roll and no list, so the box read the listed rows alone. It finds one now once the player has found it, as the Bay's
// box finds a discovered place: the store's name, the pixel read back off the map id.
import '../modsOff.js';
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import { HeldMapWindow } from '../../src/ui/heldMap.js';
import { tamrielFoundRows } from '../../src/ui/tamrielInk.js';
import { discoverLocation, foundMadePlaces, restoreDiscovery } from '../../src/systems/discovery.js';
import { countryOrdinal, countryPlaceId, countryPixelOfId } from '../../src/world/tamrielCountry.js';
import { lairCellOf, lairPlaceId, lairSite, lairPixelOfId } from '../../src/world/tamrielDungeons.js';
import { capitalPlaceId } from '../../src/world/tamrielCapitals.js';
import { inBay } from '../../src/world/tamriel/tamrielFrame.js';
import { _resetForTests } from '../../src/systems/uiPrefs.js';

afterEach(() => { _resetForTests(); restoreDiscovery(null); delete globalThis.location; delete globalThis.document; });

// near Mournhold, Morrowind - and a pixel in the Bay beside it
const MW = { x: 3820, y: 750 }, BAY = { x: 500, y: 200 };
const countryId = (p) => countryPlaceId(countryOrdinal(p.x, p.y));

test('FIND-FOUND THE IDS: a country place\'s and a lair\'s map id read back to their pixels; any other lane is null (mutants: the lair\'s lane test dropped; its cell not the site)', () => {
  assert.equal(inBay(MW.x, MW.y), false);
  assert.deepEqual(countryPixelOfId(countryId(MW)), MW);
  const c = lairCellOf(MW.x, MW.y), site = lairSite(c);
  assert.deepEqual(lairPixelOfId(lairPlaceId(c)), { x: site.px, y: site.py });
  assert.equal(lairPixelOfId(countryId(MW)), null, 'a country id is no lair');
  assert.equal(lairPixelOfId(capitalPlaceId(0, 0)), null, 'nor a capital slice');
  assert.equal(lairPixelOfId(200 * 1000 + 500), null, 'nor a Bay pixel id');
});

test('FIND-FOUND THE STORE: a place the port made, found by name, is listed with its whole id; a Bay place and a nameless one (an Arena place) are not (mutants: the made-place test dropped; the name test dropped)', () => {
  const id = countryId(MW);
  discoverLocation(id, { regionName: 'Morrowind', locationName: 'Helbenar' });
  discoverLocation(200 * 1000 + 500, { regionName: 'Daggerfall', locationName: 'Ashfield Hall' });
  discoverLocation(lairPlaceId(lairCellOf(MW.x + 40, MW.y)), { regionName: 'Morrowind', locationName: '' });
  assert.deepEqual(foundMadePlaces(), [{ mapId: id, regionName: 'Morrowind', locationName: 'Helbenar' }]);
});

test('FIND-FOUND THE ROWS: each found place past the Bay on its own pixel and its stored region; a country id on a Bay pixel and an id of another lane left out (mutants: the Bay test dropped; the lair arm dropped)', () => {
  const lair = lairPlaceId(lairCellOf(MW.x + 40, MW.y)), site = lairSite(lairCellOf(MW.x + 40, MW.y));
  const rows = tamrielFoundRows([
    { mapId: countryId(MW), regionName: 'Morrowind', locationName: 'Helbenar' },
    { mapId: lair, regionName: 'Morrowind', locationName: 'The Hold of Dren' },
    { mapId: countryId(BAY), regionName: 'Daggerfall', locationName: 'Not Past The Bay' },
    { mapId: capitalPlaceId(0, 0), regionName: 'Skyrim', locationName: 'A Listed Slice' },
  ]);
  assert.deepEqual(rows, [
    { name: 'Helbenar', regionName: 'Morrowind', x: MW.x, y: MW.y, port: false },
    { name: 'The Hold of Dren', regionName: 'Morrowind', x: site.px, y: site.py, port: false },
  ]);
});

/** Just enough document for the held map's chrome (test/ui/bayleft_find.test.js's). */
globalThis.ImageData ??= class { constructor(d, w, h) { if (typeof d === 'number') { h = w; w = d; d = new Uint8ClampedArray(w * h * 4); } this.data = d; this.width = w; this.height = h ?? d.length / 4 / w; } };
const pen = () => new Proxy({}, {
  get: (t, k) => (k in t ? t[k] : k === 'createImageData' || k === 'getImageData' ? (w = 1, h = 1) => ({ data: new Uint8ClampedArray(Math.max(1, w * h * 4)), width: w, height: h })
    : k === 'measureText' ? () => ({ width: 1 }) : () => ({ addColorStop() {} })),
  set: (t, k, v) => { t[k] = v; return true; },
});
function fakeDocument() {
  const node = (tag) => {
    const n = {
      tag, children: [], style: {}, dataset: {}, classList: { toggle() {}, add() {}, remove() {} },
      append(...k) { n.children.push(...k); }, remove() { n.removed = true; },
      addEventListener() {}, removeEventListener() {}, setPointerCapture() {}, querySelectorAll: () => [],
      className: '', textContent: '', id: '', attrs: {}, setAttribute(k, v) { n.attrs[k] = v; },
      set innerHTML(v) { n.children = []; }, get innerHTML() { return ''; }, getContext: () => pen(), width: 0, height: 0,
    };
    return n;
  };
  return { createTextNode: (t) => ({ textContent: t, nodeType: 3 }), createElementNS: (_ns, t) => node(t), createElement: (t) => node(t), getElementById: () => null, head: node('head'), body: node('body'), addEventListener() {}, removeEventListener() {} };
}

test('FIND-FOUND THE BOX: with the continent on, a quest\'s town past the Bay is found by its name once found - the moment it is, the index read again - and picked as a place past the Bay; with the Bay\'s sheet alone it is not (mutants: the found rows unread; the index kept across a find)', () => {
  _resetForTests();
  globalThis.location = { search: '?skin=enhanced' };
  globalThis.document = fakeDocument();
  const win = new HeldMapWindow({
    getPlayerPixel: () => ({ x: 5, y: 5 }), getClimateIndex: () => 231, woods: { heightMapBuffer: new Uint8Array(100).fill(10) }, mapSize: { width: 10, height: 10 },
    gold: () => 1e6, goldPieces: () => 1e6, hasHorse: false, hasCart: false, hasShip: false, diseaseCount: () => 0, poisonCount: () => 0,
  });
  for (let i = 0; i < 20; i++) win.tick(0.05);
  win._tamriel = true;
  const helbenar = () => win._findLocations('Helbenar').filter((e) => e.pastBay && e.name === 'Helbenar');
  assert.deepEqual(helbenar(), [], 'not found yet: not in the box');
  discoverLocation(countryId(MW), { regionName: 'Morrowind', locationName: 'Helbenar' });
  const hit = helbenar();
  assert.deepEqual(hit.map((e) => [e.regionName, e.pos]), [['Morrowind', MW]], 'found while the sheet stands: in the box at once');
  win._focusOn = () => {};
  win._searchPick(hit[0]);
  assert.deepEqual([win._selected?.pastBay, win._selected?.name, win._selected?.x, win._selected?.y], [true, 'Helbenar', MW.x + 0.5, MW.y + 0.5]);
  win._tamriel = false;
  assert.deepEqual(helbenar(), [], 'the Bay\'s sheet alone: nothing past it');
});

test('AUDIT FIND-FOUND F1, F2 one name, many places: found homonyms past the Bay come nearest first, each with its way from the player in the board\'s words; a find reads the found rows again, never MAPS.BSA\'s (mutants: the homonyms unsorted; no way; the Bay\'s rows read on every find)', () => {
  _resetForTests();
  globalThis.location = { search: '?skin=enhanced' };
  globalThis.document = fakeDocument();
  const me = { x: 3700, y: 700 };
  const win = new HeldMapWindow({
    getPlayerPixel: () => me, getClimateIndex: () => 231, woods: { heightMapBuffer: new Uint8Array(100).fill(10) }, mapSize: { width: 10, height: 10 },
    gold: () => 1e6, goldPieces: () => 1e6, hasHorse: false, hasCart: false, hasShip: false, diseaseCount: () => 0, poisonCount: () => 0,
  });
  for (let i = 0; i < 20; i++) win.tick(0.05);
  win._tamriel = true;
  let rows = 0;
  const read = win._searchRows.bind(win);
  win._searchRows = (ink) => { rows++; return read(ink); };
  const far = { x: 3900, y: 900 }, near = { x: 3710, y: 700 };
  discoverLocation(countryId(far), { regionName: 'Morrowind', locationName: 'Helbenar' });
  win._findLocations('Helbenar');
  discoverLocation(countryId(near), { regionName: 'Morrowind', locationName: 'Helbenar' });
  const hits = win._findLocations('Helbenar').filter((e) => e.pastBay && e.name === 'Helbenar');
  assert.equal(rows, 1, 'MAPS.BSA\'s and the listed rows read once, across a find');
  assert.deepEqual(hits.map((e) => e.pos), [near, far], 'the nearest first');
  assert.deepEqual(hits.map((e) => e.way), ['8.2 km E', '232 km SE'], 'each its way, the board\'s words');
  win._renderSearch(hits);
  const shown = win._chrome.results.children.map((li) => li.children[0].children[1].textContent ?? li.children[0].children[1].children?.[0]?.textContent);
  assert.deepEqual(shown, ['Morrowind, 8.2 km E', 'Morrowind, 232 km SE']);
  win._renderSearch([{ name: 'Helbenar', regionName: '', way: '8.2 km E', pastBay: true, pos: near }]);
  assert.equal(win._chrome.results.children[0].children[0].children[1].textContent, '8.2 km E', 'AUDIT DRAGON-CELL II E8: no lone comma');
});
