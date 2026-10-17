// EM3-3D MAP CHOICE (2026-09-27, Mac: "The dungeon map becomes the new default option, the current 2d enhanced
// becomes an option, not removed"). The 3D dungeon map (the patch's solid sheet) ships ON; the flat Enhanced plan is
// the Features row's Off; `?dungeonmap=flat` stays the kill door. Driven through the real door and window: the sheet
// the held map builds for a dungeon is solid or flat by the switch, read at each open.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { _resetForTests, setPref, getPref, PREF_DEFAULTS } from '../../../src/systems/uiPrefs.js';
import { dungeonMap3dOn } from '../../../src/ui/map/mapSkin.js';
import { createAutomapWindow } from '../../../src/ui/automap/automapDoor.js';
import { FEATURES } from '../../../src/systems/features.js';

const rd = (p) => readFileSync(new URL('../../../' + p, import.meta.url), 'utf8');
const at = (search) => { _resetForTests(); globalThis.location = { search }; };
beforeEach(() => { at('?skin=enhanced'); delete globalThis.document; });

test('EM3-3D map choice: the 3D map ships on; the switch takes it to the flat plan; ?dungeonmap=flat is the kill door either way (mutants: the pref ignored; the url ignored; shipped off)', () => {
  assert.equal(PREF_DEFAULTS.dungeonMap3d, true, 'the default is the row\'s own initial');
  assert.equal(getPref('dungeonMap3d'), true);
  assert.equal(dungeonMap3dOn(), true, 'on by default: the new default');
  setPref('dungeonMap3d', false);
  assert.equal(dungeonMap3dOn(), false, 'off: the flat Enhanced plan');
  setPref('dungeonMap3d', true);
  assert.equal(dungeonMap3dOn(), true, 'and back');
  at('?skin=enhanced&dungeonmap=flat');
  assert.equal(getPref('dungeonMap3d'), true);
  assert.equal(dungeonMap3dOn(), false, 'the url still turns it off, whatever the switch');
  at('?skin=enhanced&dungeonmap=solid');
  assert.equal(dungeonMap3dOn(), true, 'any other value is not the kill door');
});

test('EM3-3D map choice, driven: the dungeon sheet the held map builds is solid with the switch on and flat with it off, read at each open', () => {
  const mk = () => ({ className: '', style: {}, children: [], dataset: {}, classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    append(...c) { this.children.push(...c); }, appendChild(c) { this.children.push(c); return c; }, setAttribute() {}, getAttribute() { return null; }, addEventListener() {}, removeEventListener() {},
    querySelector() { return null; }, querySelectorAll() { return []; }, getContext() { return null; }, remove() {}, prepend(...c) { this.children.unshift(...c); }, textContent: '' });
  globalThis.document = { createElement: mk, createElementNS: mk, getElementById: () => null, head: mk(), body: mk(), addEventListener() {}, removeEventListener() {}, baseURI: 'https://h.test/' };
  const prevW = globalThis.window; globalThis.window = { addEventListener() {}, removeEventListener() {}, innerWidth: 1600, innerHeight: 900, devicePixelRatio: 1 };
  const deps = { record: () => null, model: null, player: () => null, title: 'Privateer’s Hold' };
  try {
    const on = createAutomapWindow(deps);
    assert.equal(on?.constructor.name, 'HeldMapWindow');
    assert.equal(on._sheets.get('automap').solid, true, 'on: the solid, turnable sheet');
    on.dispose?.();
    setPref('dungeonMap3d', false);
    const off = createAutomapWindow(deps);
    assert.equal(off._sheets.get('automap').solid, false, 'off: the flat Enhanced plan, not removed');
    off.dispose?.();
  } finally { delete globalThis.document; globalThis.window = prevW; }
});

test('EM3-3D map choice by source: the Features row - interface, enhanced-only, the player\'s own prefs switch, on by default, and the held map builds the sheet through the one gate', () => {
  const row = FEATURES.find((f) => f.id === 'dungeon-map-3d');
  assert.ok(row, 'the row exists');
  assert.equal(row.group, 'interface', 'beside the Enhanced map row it depends on');
  assert.deepEqual([...row.kinds], ['enhanced'], 'the held map is the enhanced skin\'s alone');
  assert.deepEqual({ ...row.control }, { store: 'prefs', key: 'dungeonMap3d', initial: true, online: 'player' });
  assert.match(row.note, /Off shows one flat floor at a time/, 'the note says what Off keeps');
  const i = FEATURES.findIndex((f) => f.id === 'enhanced-map');
  assert.equal(FEATURES[i + 1]?.id, 'dungeon-map-3d', 'listed right under the Enhanced map');
  assert.match(rd('src/ui/heldMap.js'), /createAutomapSheet\(\{ solid: dungeonMap3dOn\(\), /, 'the sheet is built through dungeonMap3dOn');
});
