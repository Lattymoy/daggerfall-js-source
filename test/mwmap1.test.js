// MW-MAP1 (2026-09-22, a player through Mac: "the morrowind map isnt
// showing"): THE HELD MAP'S HOLDER, IN ONE PLACE, ON EVERY DOOR. MAP3
// gave the enhanced held map a holder - the Morrowind arm's four doors -
// and wrote it inline in world.js's TRAVEL map builder alone. EM3/EM4
// then gave the same window its M-key doors (the town plan, the dungeon
// and building automaps) and none passed a holder, so every M-key sheet
// fell to the painted gauntlets: a player with Morrowind arms saw the
// Morrowind map on V outdoors and nowhere else. The holder is
// combat/weaponRig.js's `sheetHolderOf(rig)` now, every host with a rig
// hands it to every door it opens, and each of those doors goes into
// the head first (MAP-POV's law).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { sheetHolderOf } from '../src/combat/weaponRig.js';
import { createTownMapWindow } from '../src/ui/townMapDoor.js';
import { createAutomapWindow } from '../src/ui/automapDoor.js';
import { HeldMapWindow } from '../src/ui/heldMap.js';
import { setPref } from '../src/systems/uiPrefs.js';

const rd = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
function fakeDocument() {
  const node = () => ({ children: [], style: {}, dataset: {}, classList: { add() {}, remove() {}, toggle() {}, contains: () => false }, append() {}, appendChild() {}, remove() {}, replaceChildren() {}, setAttribute() {}, removeAttribute() {}, addEventListener() {}, removeEventListener() {}, querySelector: () => null, querySelectorAll: () => [], getBoundingClientRect: () => ({ width: 0, height: 0, left: 0, top: 0 }), focus() {}, blur() {}, getContext: () => null });
  const body = node();
  return { createElement: () => node(), createElementNS: () => node(), getElementById: () => null, head: node(), body, addEventListener() {}, removeEventListener() {}, activeElement: null };
}
function withDocument(fn) { globalThis.document = fakeDocument(); try { return fn(); } finally { delete globalThis.document; } }

/** a rig with the four doors, recording what it was asked */
const fakeRig = ({ available = true, drawn = true } = {}) => {
  const r = { calls: [], armsAvailable: () => { r.calls.push('available'); return available; }, armsDrawn: () => { r.calls.push('drawn'); return drawn; },
    holdPaper: (spec, opts) => { r.calls.push(['hold', spec, opts]); return true; }, releasePaper: () => { r.calls.push('release'); }, paperCorners: () => [[0, 0], [1, 0], [1, 1], [0, 1]] };
  return r;
};

test('MW-MAP1: sheetHolderOf - the four doors delegate to the rig the function answers NOW (a swapped rig answers, never a snapshot), corners only from a frame the arm drew, and a host with no rig answers no / false / nothing / null without throwing', () => {
  let rig = fakeRig();
  const h = sheetHolderOf(() => rig);
  assert.equal(h.available(), true); assert.equal(h.hold({ w: 1 }, { o: 2 }), true); assert.deepEqual(rig.calls.at(-1), ['hold', { w: 1 }, { o: 2 }]);
  assert.deepEqual(h.corners(), [[0, 0], [1, 0], [1, 1], [0, 1]]);
  h.release(); assert.equal(rig.calls.at(-1), 'release');
  const undrawn = fakeRig({ drawn: false }); rig = undrawn;
  assert.equal(h.corners(), null, 'the swapped rig is the one asked, and an undrawn arm answers no corners (AUDIT-MAP2)');
  assert.ok(!undrawn.calls.includes('corners'), 'paperCorners is never asked of an undrawn arm');
  rig = fakeRig({ available: false }); assert.equal(h.available(), false, 'a sheathed-and-hidden arm would not draw');
  rig = null;
  assert.equal(h.available(), false); assert.equal(h.hold({}, {}), false); assert.doesNotThrow(() => h.release()); assert.equal(h.corners(), null);
  rig = {};   // a rig without the doors (the classic body's)
  assert.equal(h.available(), false); assert.equal(h.hold({}, {}), false); assert.doesNotThrow(() => h.release()); assert.equal(h.corners(), null);
});

test('MW-MAP1: the two M-key doors hand the holder to the enhanced window - the town plan and the automap - and a door with none passes null (the sprite lane), which is what the ?interior probe host, with no rig, gets', () => {
  setPref('skin', 'enhanced');
  withDocument(() => {
    const holder = sheetHolderOf(() => fakeRig());
    const town = createTownMapWindow({ holder, locationName: 'Daggerfall', gridW: 1, gridH: 1, blocks: [], playerPos: () => [0, 0, 0], playerYaw: () => 0, buildings: () => [] });
    assert.ok(town instanceof HeldMapWindow, 'the enhanced skin opens the held window');
    assert.equal(town.deps.holder, holder, 'the town plan carries the holder');
    const auto = createAutomapWindow({ holder, record: () => ({}), player: () => ({ feet: [0, 0, 0], eye: [0, 0, 0], yaw: 0 }), model: [], dungeonName: 'Privateer\'s Hold' });
    assert.ok(auto instanceof HeldMapWindow); assert.equal(auto.deps.holder, holder, 'the automap carries the holder');
    const bare = createAutomapWindow({ record: () => ({}), player: () => ({ feet: [0, 0, 0], eye: [0, 0, 0], yaw: 0 }), model: [] });
    assert.equal(bare.deps.holder, null, 'no holder: the sprite lane, as the ?interior probe host (no rig) gets');
  });
});

test('MW-MAP1: by source - every host with a rig hands sheetHolderOf(() => its rig) to every door it opens and goes into the head first; the travel builder reads the same holder and keeps no inline one; the ?interior host passes none', () => {
  const w = rd('src/scenes/world.js');
  assert.match(w, /holder: sheetHolderOf\(\(\) => weaponRig\),\s*\n\s*\.\.\.extra,/, 'the V-key travel builder');
  assert.match(w, /if \(!townMapDoorReady\(\)\) return;[^\n]*\n\s*mwViewFirstPerson\(\);[^\n]*\n\s*townTalk\.showOverlay\(createTownMapWindow\(\{\s*\n\s*holder: sheetHolderOf\(\(\) => weaponRig\),/, 'the world host\'s M: into the head, then the town plan with the holder');
  assert.equal((w.match(/hold: \(spec, opts\)/g) ?? []).length, 0, 'no inline holder left in world.js');
  const e = rd('src/scenes/exterior.js');
  assert.match(e, /if \(!townMapDoorReady\(\)\) return;[^\n]*\n\s*mwViewFirstPerson\(\);[^\n]*\n\s*townTalk\.showOverlay\(createTownMapWindow\(\{\s*\n\s*holder: sheetHolderOf\(\(\) => weaponRig\),/, 'the ?exterior host\'s M');
  assert.match(e, /import \{[^}]*mwViewFirstPerson[^}]*\} from '\.\.\/player\/mwView\.js'/);
  const d = rd('src/scenes/dungeonContext.js');
  assert.match(d, /if \(!automapDoorReady\(\)\) return;\s*\n\s*mwViewFirstPerson\(\);[^\n]*\n\s*activeOverlay = createAutomapWindow\(\{\s*\n\s*holder: sheetHolderOf\(\(\) => weaponRig\),/, 'the dungeon\'s M');
  assert.match(d, /import \{ mwViewFirstPerson \} from '\.\.\/player\/mwView\.js'/);
  const m = rd('src/scenes/worldModes.js');
  assert.match(m, /if \(!automapDoorReady\(\)\) return;[^\n]*\n\s*mwViewFirstPerson\(\);[^\n]*\n\s*interiorOverlay = createAutomapWindow\(\{\s*\n\s*holder: sheetHolderOf\(\(\) => interiorWeapon\),/, 'a building\'s M, off the INTERIOR arm');
  const i = rd('src/scenes/interior.js');
  assert.doesNotMatch(i, /sheetHolderOf|holder:/, 'the ?interior probe host has no rig and hands none');
  for (const door of ['src/ui/townMapDoor.js', 'src/ui/automapDoor.js']) assert.match(rd(door), /holder: deps\.holder \?\? null,/, `${door} passes it through`);
});
