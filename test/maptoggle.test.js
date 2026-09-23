// MAP-TOGGLE + MAP-FIELD8 (2026-09-22, Mac: "is the enhanced map a toggle?"
// - "Yes needs to be a toggle. Along with this change, replace the
// current paperdoll integration with this replacement"): the held sheet
// is a Features switch under the enhanced skin, read by the three map
// doors through one gate, and the painting in the hands is the FOURTH.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { _resetForTests, setPref, getPref } from '../src/systems/uiPrefs.js';
import { enhancedMapOn, heldMapChosen, heldMapWorn } from '../src/ui/mapSkin.js';
import { travelMapDoorReady, createTravelMapWindow } from '../src/ui/travelMapDoor.js';
import { automapDoorReady, createAutomapWindow } from '../src/ui/automapDoor.js';
import { townMapDoorReady, createTownMapWindow } from '../src/ui/townMapDoor.js';
import { FEATURES } from '../src/systems/features.js';
import { SPRITE, PAPER, THUMB_ZONES, SPRITE_ART_FOOT, CUFF_BAND, HAND_CHROMA } from '../src/ui/heldMap.js';

const rd = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const skin = (v) => { _resetForTests(); globalThis.location = { search: `?skin=${v}` }; };
beforeEach(() => { skin('enhanced'); delete globalThis.document; });

test('MAP-TOGGLE, driven: the gate is the skin AND the switch - on by default, off takes every door to the classic arm under the enhanced skin, and the classic skin never wears the sheet whatever the switch says', () => {
  assert.equal(getPref('heldMap'), true, 'ships on: the held map is what the enhanced skin has drawn since MAP1');
  assert.equal(enhancedMapOn(), true); assert.equal(heldMapChosen(), true);
  assert.equal(heldMapWorn(), false, 'headless: chosen is not worn - no document to mount it in');
  assert.equal(travelMapDoorReady(), true, 'the travel door is ready wherever the sheet is chosen - it reads no ARENA2 art');
  assert.equal(automapDoorReady(), false, 'the automap door needs a DOM for the sheet, and there is no AMAP art in this container');
  assert.equal(townMapDoorReady(), false);
  setPref('heldMap', false);
  assert.equal(enhancedMapOn(), false); assert.equal(heldMapChosen(), false); assert.equal(heldMapWorn(), false);
  assert.equal(travelMapDoorReady(), false, 'off: the travel door is the classic arm, which needs TRAV0I00');
  assert.equal(createTravelMapWindow({}), null, 'off + no classic art = the classic null, as the pre-door factories answered');
  assert.equal(createAutomapWindow({}), null); assert.equal(createTownMapWindow({}), null);
  skin('classic'); setPref('heldMap', true);
  assert.equal(heldMapChosen(), false, 'the classic skin is never the sheet: the row\'s kinds say enhanced');
  assert.equal(travelMapDoorReady(), false);
});

test('MAP-TOGGLE, driven: with a document and the switch on, the doors hand out the HELD sheet; with it off, the classic arm (null here, art-less) - the switch is read on every open, never cached', () => {
  const mk = () => ({ className: '', style: {}, children: [], dataset: {}, classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    append(...c) { this.children.push(...c); }, appendChild(c) { this.children.push(c); return c; }, setAttribute() {}, getAttribute() { return null; }, addEventListener() {}, removeEventListener() {}, remove() {}, querySelector() { return null; }, getContext() { return null; } });
  globalThis.document = { createElement: mk, createElementNS: mk, getElementById: () => null, head: mk(), body: mk(), addEventListener() {}, removeEventListener() {}, baseURI: 'https://h.test/' };
  const prevW = globalThis.window; globalThis.window = { addEventListener() {}, removeEventListener() {}, innerWidth: 1600, innerHeight: 900, devicePixelRatio: 1 };
  try {
    assert.equal(heldMapWorn(), true);
    const held = createTravelMapWindow({});
    assert.ok(held && held.constructor.name === 'HeldMapWindow', 'on: the held sheet');
    held.dispose?.();
    setPref('heldMap', false);
    assert.equal(createTravelMapWindow({}), null, 'off, read live: the classic arm, art-less here');
    assert.equal(createAutomapWindow({}), null); assert.equal(createTownMapWindow({}), null);
    setPref('heldMap', true);
    const again = createTravelMapWindow({});
    assert.ok(again && again.constructor.name === 'HeldMapWindow', 'and back on');
    again.dispose?.();
  } finally { delete globalThis.document; globalThis.window = prevW; }
});

test('MAP-TOGGLE by source: the Features row - sight, enhanced-only, the player\'s own prefs switch, on by default, said in one or two sentences', () => {
  const row = FEATURES.find((f) => f.id === 'enhanced-map');
  assert.ok(row, 'the row exists');
  assert.equal(row.group, 'sight'); assert.deepEqual([...row.kinds], ['enhanced']);
  assert.deepEqual({ ...row.control }, { store: 'prefs', key: 'heldMap', initial: true, online: 'player' });
  assert.match(row.note, /Off is Daggerfall/, 'the note says what off is');
  const gate = rd('src/ui/mapSkin.js');
  assert.match(gate, /export const enhancedMapOn = \(\) => !!getPref\('heldMap'\);/);
  assert.match(gate, /export const heldMapChosen = \(\) => isEnhanced\(\) && enhancedMapOn\(\);/);
  assert.match(gate, /export const heldMapWorn = \(\) => heldMapChosen\(\) && typeof document !== 'undefined';/);
});

test('MAP-FIELD8: the FOURTH painting ships, and every constant that is a measurement of it was measured (tools/heldMapArtProbe.mjs, 20 checks) - wider than the third, the sheet inset on it, the thumbs where they rest, the art foot, the band in the cuff gap', () => {
  assert.ok(existsSync(new URL('../public/art/held-map.png', import.meta.url)));
  const png = readFileSync(new URL('../public/art/held-map.png', import.meta.url));
  assert.equal(png.readUInt32BE(16), 1648, 'the file\'s own width'); assert.equal(png.readUInt32BE(20), 1086, 'and height');
  assert.deepEqual(SPRITE, { w: 1648, h: 1086 });
  assert.deepEqual(PAPER, { x0: 0.226, x1: 0.775, y0: 0.196, y1: 0.704 });
  assert.deepEqual(THUMB_ZONES.map((z) => [z.x0, z.x1, z.y0, z.y1, z.side]), [[0.19, 0.3, 0.4, 0.725, 'left'], [0.7, 0.81, 0.4, 0.725, 'right']]);
  assert.equal(SPRITE_ART_FOOT, 0.872); assert.equal(CUFF_BAND, 0.827); assert.equal(HAND_CHROMA, 75);
  assert.ok(CUFF_BAND > 0.8158 && CUFF_BAND < 0.8379, 'the band sits in the gap the probe measured between the silhouette and the cut cuffs');
  assert.ok(SPRITE_ART_FOOT > CUFF_BAND);
});
