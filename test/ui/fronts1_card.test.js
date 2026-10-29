// AUDIT FRONTS B8, C2 (bible/01-Overview/audits/Audit-Fronts.md): the travel map's card says a province's turn - drawn by
// the real card (ui/heldMap.js _renderCard), not read off its source.
import '../modsOff.js';
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { _resetForTests } from '../../src/systems/uiPrefs.js';
import { HeldMapWindow } from '../../src/ui/heldMap.js';
import { frontStands, frontNextDay } from '../../src/net/frontLaw.js';
import { frontDayAt, frontDayStartMs } from '../../src/systems/frontWords.js';
import { localWhenText } from '../../src/systems/eventTimers.js';

afterEach(() => { _resetForTests(); delete globalThis.location; delete globalThis.document; });

/** Just enough document for the card (test/ui/owpastbay_walk.test.js's), each node keeping its class and its text. */
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
/** The card drawn for a selection, with the relay's clock `relayNow` (null offline) and the politic map's region. */
function cardLines(selected, { relayNow, region = 64 }) {
  _resetForTests();
  globalThis.location = { search: '?skin=enhanced' };
  globalThis.document = fakeDocument();
  const win = new HeldMapWindow({
    getPlayerPixel: () => ({ x: 5, y: 5 }), getClimateIndex: () => 231, woods: { heightMapBuffer: new Uint8Array(100).fill(10) }, mapSize: { width: 10, height: 10 },
    gold: () => 0, goldPieces: () => 0, hasHorse: false, hasCart: false, hasShip: false, diseaseCount: () => 0, poisonCount: () => 0,
    maps: { getPoliticIndex: () => 128 + region, getRegion: () => ({ mapNames: ['Daggerfall'] }) },
    fronts: () => relayNow,
  });
  win._selected = selected;
  win._phase = 'map';
  win._renderCard();
  return win._chrome.card.children.filter((c) => /\bhmfront\b/.test(c.className)).map((c) => c.textContent);
}

test('AUDIT FRONTS B8: a place past the Bay\'s card says its province\'s turn - now, or from its start in the player\'s own clock with the relay\'s offset taken out; a place on the Bay and an offline map say nothing (mutants: the line dropped; the region read off the politic map; the offset taken twice)', () => {
  const skew = 3 * 3_600_000;   // the relay three hours ahead of this machine
  const relayNow = Date.now() + skew, day = frontDayAt(relayNow);
  const solitude = { name: 'Solitude', coords: true, x: 1210.5, y: -89.5 };
  for (const [region, lane] of [[62, 1], [64, 3], [69, 8]]) {
    const lines = cardLines(solitude, { relayNow, region });
    const want = frontStands(day, lane) ? 'Gates, raids, stars and Abyss Dungeons start here now'
      : `Gates, raids, stars and Abyss Dungeons start here from ${localWhenText(frontDayStartMs(frontNextDay(day, lane)) - skew)}`;
    assert.deepEqual(lines, [want], `region ${region}`);
  }
  assert.deepEqual(cardLines(solitude, { relayNow, region: 70 }), [], 'the open zone is no front');
  assert.deepEqual(cardLines({ name: 'Daggerfall', x: 207.5, y: 213.5, summary: { regionIndex: 17, mapIndex: 0 } }, { relayNow }), [], 'a Bay place');
  assert.deepEqual(cardLines(solitude, { relayNow: null }), [], 'offline');
});
