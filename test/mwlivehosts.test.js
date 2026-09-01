// NPC4b: THE LANE HAS TO REACH THE HOST THE GAME ACTUALLY BOOTS.
//
// NPC2b, NPC3a and NPC3b each landed their seam in exterior.js - the
// ?exterior dev route - and in dungeonContext. main.js sends real play
// to bootWorld (:127, :217), so for three slices the wandering crowd
// and the city watch were still sprites in every session anyone
// actually played, and the above-ground encounter pool had never been
// seamed at all.
//
// That is not a bug in any one slice; it is a bug in how a slice
// decides it is finished. This file is the gate: EVERY host that draws
// actors is enumerated here, and a new one has to be added to the list
// before its pin can pass.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const rd = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

/** Every file that draws living actors, and what it draws. */
const HOSTS = [
  ['src/scenes/world.js', 'the streaming world - the host main.js boots for real play'],
  ['src/scenes/exterior.js', 'the ?exterior location scene'],
  ['src/scenes/worldModes.js', 'the interior/dungeon mode machine'],
  ['src/scenes/dungeonContext.js', 'the dungeon context'],
  ['src/scenes/cityGuards.js', 'the city watch pool'],
  ['src/scenes/exteriorFoes.js', 'the encounter pool - above ground AND inside buildings'],
];

test('NPC4b: every host that draws actors takes the Morrowind body seam', () => {
  for (const [path, what] of HOSTS) {
    const src = rd(path);
    assert.match(src, /from '\.\.\/characters\/mwActorRig\.js'/,
      `${what} (${path}) draws actors and never asks for a body`);
    assert.match(src, /requestMwBody\(/, `${path} imports the seam and does not use it`);
    assert.match(src, /drawMwActor\(/, `${path} asks for a body and never draws it`);
  }
});

test('NPC4b: the LIVE host draws the crowd, the watch and the encounter foes as bodies', () => {
  const w = rd('src/scenes/world.js');
  // The crowd. Its feet are the batch's WORLD-space origin, not
  // `person.pos` - this host streams, and a person's own position is
  // local to their map pixel.
  assert.match(w, /requestMwBody\(person, townMwBodyOpts\(person\.archive, person\._mwSeed\), -1\)/,
    'the wandering crowd never asks for a body in the live host');
  assert.match(w, /feet: batch\.origin,/,
    'the crowd\'s bodies stand at pixel-local feet - they will drift as the world recenters');
  assert.match(w, /\}\)\) continue;\s*\n\s*livePersonBatches\.push\(batch\);/,
    'a townsperson who drew as a body still pushes their sprite');
  // The watch and the encounter pool each take the frame's render
  // context; without it their own seams can never fire.
  assert.match(w, /cityGuards\.update\([\s\S]{0,200}?\{ canvas, proj, view, eye: mwv\.eye \}\)\)/,
    'the city watch gets no render context in the live host');
  assert.match(w, /exteriorFoes\.batches\(\{ canvas, proj, view, eye: mwv\.eye \}, dt\)/,
    'the above-ground encounter pool gets no render context');
});

test('NPC4b: the seed is the person\'s own, assigned once, and never from DFU\'s PRNG', () => {
  // srand/rand is ONE stream that names, loot and quests all pull
  // from. A draw spent on a shirt shifts every later roll in the game.
  const w = rd('src/scenes/world.js');
  assert.match(w, /person\._mwSeed \?\?= \(_mwTownSeed = \(_mwTownSeed \+ 0x9e3779b9\) \| 0\);/,
    'the crowd\'s wardrobe seed is not the once-per-person step');
  // The counter must live ABOVE the frame loop, or every frame starts
  // it at zero again and every newly spawned person in the town shares
  // one seed - a street of identical shirts.
  // ...and it must EXIST before it can be compared: `indexOf` answers
  // -1 for a line that is gone, and -1 is less than every real index,
  // so an ordering check on its own passes for a counter that was
  // deleted outright. MEASURED - that mutant reported green here.
  assert.ok(w.includes('let _mwTownSeed = 0;'), 'the seed counter is gone');
  assert.ok(w.indexOf('let _mwTownSeed = 0;') < w.indexOf('function frame(now)'),
    'the seed counter resets every frame');
  // ...and the whole lane is comment-stripped before the scan, because
  // the prose above explains srand and a word-scan would match itself
  // (MW-D23's failure, and NPC3b hit it again).
  const code = w.split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');
  const seam = code.slice(code.indexOf('person._mwSeed'), code.indexOf('livePersonBatches.push(batch)'));
  assert.ok(!/\bsrand\b|\brand\(/.test(seam), 'the wardrobe seed pulls from DFU\'s shared PRNG');
});

test('NPC4b: an encounter foe holds its frame when paralysed - sprite AND body', () => {
  // S19 FreezeAnims. The dungeon pool has honoured it since wave 32;
  // this pool - the SAME factory, serving above ground and inside
  // buildings - advanced its sprite regardless, so a held foe went on
  // swinging in the street. The body must not be the one thing in the
  // frame that disagrees, in either direction.
  const src = rd('src/scenes/exteriorFoes.js');
  assert.match(src, /f\._mout = f\.mobile\.update\(_fParalyzed \? 0 : dt,/,
    'the sprite advances through a paralysis');
  assert.match(src, /_drawMwFoe\(f, entityIsParalyzed\(f\.entity\) \? 0 : dt, mw\)/,
    'the body advances through a paralysis');
});

test('NPC4b: a body that drew does not also push a sprite, in either pool', () => {
  // The whole no-double-draw story is one `continue`, and it is the
  // same shape in every pool.
  assert.match(rd('src/scenes/exteriorFoes.js'),
    /if \(mw && _drawMwFoe\(f, .*\)\) continue;/, 'the encounter pool double-draws');
  assert.match(rd('src/scenes/cityGuards.js'),
    /if \(mw && _drawMwGuard\(g, .*\)\) continue;/, 'the watch double-draws');
  // ...and a DEAD foe is the classic death sprite in every lane: the
  // body gate sits after the dead check, never before it.
  const src = rd('src/scenes/exteriorFoes.js');
  const b = src.slice(src.indexOf('function batches(mw = null, dt = 0)'));
  assert.ok(b.indexOf('if (f.dead || !f._mout) continue;') < b.indexOf('_drawMwFoe'),
    'a corpse can draw as a standing body');
});
