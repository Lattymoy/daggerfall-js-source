import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { GRAVESTONE_PHRASES, randomEpitaph } from '../src/systems/gravestoneLore.js';

const src = (p) => readFileSync(new URL(`../src/${p}`, import.meta.url), 'utf8');

test('GRAVE1: randomEpitaph is a pure roll over the phrase table', () => {
  assert.ok(GRAVESTONE_PHRASES.length >= 10, 'a handful of phrases, not one or two');
  for (const p of GRAVESTONE_PHRASES) assert.equal(typeof p, 'string');
  assert.equal(randomEpitaph(() => 0), GRAVESTONE_PHRASES[0]);
  assert.equal(randomEpitaph(() => 0.999999), GRAVESTONE_PHRASES[GRAVESTONE_PHRASES.length - 1]);
  // a roll of exactly 1 must not read past the end of the table
  assert.equal(randomEpitaph(() => 1), GRAVESTONE_PHRASES[GRAVESTONE_PHRASES.length - 1]);
});

test('GRAVE1: both outdoor hosts read a gravestone only on a dead-end Info click inside a Graveyard location', () => {
  for (const host of ['scenes/world.js', 'scenes/exterior.js']) {
    const s = src(host);
    assert.ok(s.includes("import { randomEpitaph } from '../systems/gravestoneLore.js';"),
      `${host}: does not import the epitaph table`);
    const at = s.indexOf('modes.tryEnter().then((opened) => {');
    assert.ok(at > 0, `${host}: the door fallback no longer chains a .then`);
    const body = s.slice(at, s.indexOf('}).catch((e) => console.error(e));', at));
    assert.match(body, /if \(!opened && getInteractionMode\(\) === 'info' && _musicLocationType\(\) === LOCATION_TYPES\.Graveyard\)/,
      `${host}: the gate is not Info mode + Graveyard + nothing else activated`);
    assert.match(body, /townTalk\.say\(randomEpitaph\(\)\)/, `${host}: does not speak a random epitaph`);
  }
});
