// A building's door shows a ring over the hotbar and steps the full loading screen aside. The ring takes no pointer.
import '../chargenDom.mjs';
import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { markInteriorLoad, syncInteriorLoad, interiorLoadOn } from '../../src/ui/interiorLoadMark.js';
import { loadingAside, loadingShown, syncLoading, removeLoadingScreen, _resetLoadingAsideForTests, APPEAR_MS, LOADING_ID } from '../../src/ui/loadingScreen.js';

const read = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const ring = () => document.body.querySelector('.int-load');
const screen = () => document.body.children.find((c) => c.id === LOADING_ID) ?? null;

test('INTERIOR-LOAD a building load is a ring over the hotbar that takes no pointer, and the full screen steps aside', () => {
  _resetLoadingAsideForTests();
  mock.timers.enable({ apis: ['setTimeout'] });
  const bottom = document.createElement('div');
  bottom.className = 'hud-bottom';
  const bar = document.createElement('div');
  bar.className = 'hud-hotdock';
  bottom.append(bar);
  document.body.append(bottom);
  try {
    assert.equal(markInteriorLoad(true), true);
    assert.equal(interiorLoadOn(), true);
    assert.equal(ring(), null, 'a door that has only just opened shows nothing');
    assert.equal(loadingAside(), true, 'the full screen is aside as soon as the door starts');
    mock.timers.tick(APPEAR_MS);
    assert.equal(bottom.children[0], ring(), 'the ring is the column\'s first child, over the hotbar');
    assert.equal(ring().style.pointerEvents, 'none');
    assert.equal(markInteriorLoad(false), false);
    assert.equal(ring(), null);
    assert.equal(loadingAside(), true, 'the screen stays aside until the frame ends the hold');
    syncInteriorLoad(false);
    assert.equal(loadingAside(), false);
    assert.equal(interiorLoadOn(), false);
  } finally {
    bottom.remove();
    markInteriorLoad(false);
    syncInteriorLoad(false);
    _resetLoadingAsideForTests();
    mock.timers.reset();
  }
});

test('INTERIOR-LOAD a transition that never began does not leave the ring up', () => {
  _resetLoadingAsideForTests();
  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    markInteriorLoad(true);
    mock.timers.tick(APPEAR_MS);
    assert.ok(ring());
    syncInteriorLoad(false);
    assert.equal(ring(), null);
    assert.equal(loadingAside(), false);
  } finally {
    syncInteriorLoad(false);
    _resetLoadingAsideForTests();
    mock.timers.reset();
  }
});

test('INTERIOR-LOAD a finished building leaves the full screen hidden through its fade', () => {
  _resetLoadingAsideForTests();
  mock.timers.enable({ apis: ['setTimeout', 'Date'] });
  try {
    removeLoadingScreen();
    markInteriorLoad(true);
    syncLoading(true);
    mock.timers.tick(APPEAR_MS);
    assert.equal(loadingShown(), true, 'a long door did raise the screen, kept aside');
    assert.equal(loadingAside(), true);
    markInteriorLoad(false);
    syncInteriorLoad(false);
    syncLoading(false);
    assert.equal(screen()?._keepHidden, true, 'the hold ended while the screen was still aside, so it does not appear over the built room');
  } finally {
    markInteriorLoad(false);
    syncInteriorLoad(false);
    removeLoadingScreen();
    _resetLoadingAsideForTests();
    mock.timers.reset();
  }
});

test('INTERIOR-LOAD the building door raises the ring and the frame lifts the aside before the hold ends (mutants: the ring never raised; the aside lifts after the hold)', () => {
  const modes = read('src/scenes/worldModes.js');
  assert.match(modes, /let _hccLanded = \(markInteriorLoad\(true\), false\);/);
  assert.match(modes, /transitioning = markInteriorLoad\(false\);/);
  assert.equal((modes.match(/transitioning = markInteriorLoad\(false\)/g) ?? []).length, 1, 'the dungeon door does not raise it');
  const world = read('src/scenes/world.js');
  const frame = world.slice(world.indexOf('  function frame(now) {'));
  const hold = frame.indexOf('syncLoading(_moving, { place: loadingPlaceNow, line: loadingLineNow });');
  const ask = frame.indexOf('syncInteriorLoad(!!modes?.transitioning);');
  assert.ok(ask > 0 && hold > ask, 'the aside lifts while the hold is still open');
});
