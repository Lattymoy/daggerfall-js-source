// SD26 (2026-10-08, the Super Dungeons arc; bible/11-Multiplayer/Super-Dungeons.md): AUDIT SD IV's sync and render
// lenses - each finding measured before it was fixed. Where the Rift stands read the doors open on the frame it was
// stood; the Hour's light was drawn under the flats that came after it; the Stomp's dust rose from the void past the
// arena's rim; the lamps' heads and the stones' caps were open underneath; the Hour's fog and trilight made garbage a
// frame; section 7 named six records fewer than the Hour's archive holds.
import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { realmArt } from '../src/world/sdRealmArt.js';
import { hallArt } from '../src/world/sdHallArt.js';
import { stepsArt } from '../src/world/sdStepsArt.js';
import { remnantArt } from '../src/world/sdRemnantArt.js';
import { sdRiftArt } from '../src/world/sdRiftArt.js';

const read = (p) => readFileSync(p, 'utf8');

test('AUDIT SD IV (R6): section 7 names every record the Hour\'s one pseudo-archive holds - its ranges are the art\'s own, each range one producer\'s, none left out (mutants: the Rift\'s red re-numbered; the Endings\' lights dropped from the sentence)', () => {
  const doc = read('bible/11-Multiplayer/Super-Dungeons.md').replace(/\s+/g, ' ');
  const said = /one pseudo-archive, 38151 - records (.*?)\) laid/.exec(doc);
  assert.ok(said, 'section 7 names the archive\'s records');
  const owner = new Map();
  for (const [who, art] of [['realm', realmArt()], ['hall', hallArt()], ['steps', stepsArt()], ['remnant', remnantArt()], ['rift', sdRiftArt()]]) {
    for (const [rec] of art) { assert.ok(!owner.has(rec), `record ${rec} made once`); owner.set(rec, who); }
  }
  const named = [];
  for (const [, a, b] of said[1].matchAll(/(\d+)-(\d+)/g)) {
    const run = [];
    for (let r = Number(a); r <= Number(b); r++) run.push(r);
    assert.equal(new Set(run.map((r) => owner.get(r))).size, 1, `${a}-${b} is one producer's`);
    named.push(...run);
  }
  assert.deepEqual(named.sort((x, y) => x - y), [...owner.keys()].sort((x, y) => x - y), 'the sentence\'s records are the archive\'s, every one');
});
