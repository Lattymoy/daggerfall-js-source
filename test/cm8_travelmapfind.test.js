// CM8: DaggerfallTravelMapWindow's Find button pushes a
// DaggerfallInputMessageBox. The map no longer owns the edit field.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TravelMapWindow } from '../src/ui/classicTravelMapWindow.js';
import { InputMessageBoxWindow } from '../src/ui/inputMessageBox.js';
import { FIND_PROMPT, FIND_MAX_CHARACTERS } from '../src/ui/travelMapWindow.js';

const make = () => {
  const w = new TravelMapWindow({});
  w.selectedRegion = 17;
  w._click = () => {};
  return w;
};

test('CM8: Find pushes the shared classic input box', () => {
  const w = make();
  w._findLocationButtonClick();

  assert.ok(w.findBox instanceof InputMessageBoxWindow);
  assert.equal(w.findBox.label, FIND_PROMPT);
  assert.equal(w.findBox.value, '');
  assert.equal(w.findBox.maxCharacters, FIND_MAX_CHARACTERS);
  assert.equal(w.top, null, 'the base inline find state is no longer armed');
});

test('CM8: Return hands the input back to the map find law', () => {
  const w = make();
  let searched = null;
  w._handleLocationFindEvent = (text) => { searched = text; };
  w._findLocationButtonClick();
  w.findBox.value = 'Daggerfall';
  w.input('Enter');

  assert.equal(w.findBox, null);
  assert.equal(searched, 'Daggerfall');
});

test('CM8: Escape cancels Find without running a search', () => {
  const w = make();
  let searched = false;
  w._handleLocationFindEvent = () => { searched = true; };
  w._findLocationButtonClick();
  w.findBox.value = 'Discard Me';
  w.input('Escape');

  assert.equal(w.findBox, null);
  assert.equal(searched, false);
});
