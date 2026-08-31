import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { specialDungeonName, SPECIAL_DUNGEON_TEXT_ID } from '../src/systems/answerPipeline.js';

// THE COMPREHENSIVE AUDIT, 2026-08-31: the optional-hook sweep - every
// `x?.()` whose method no module defines - found that NO HOST supplied
// `specialDungeonName` or `dungeonRegionName`, so GetAnswerWhereAmI's
// DUNGEON arm (TalkManager :1537-1541) formatted with two EMPTY
// STRINGS. Ask an NPC "Where am I?" underground and the answer had two
// holes in it.

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');

test('GetSpecialDungeonName: the three capitals take a TEXT.RSC line, everything else its own name (:255-266)', () => {
  assert.deepEqual({ ...SPECIAL_DUNGEON_TEXT_ID }, { Daggerfall: 475, Wayrest: 476, Sentinel: 477 });
  const line = (id) => `line${id}`;
  assert.equal(specialDungeonName('Daggerfall', 'Daggerfall', line), 'line475');
  assert.equal(specialDungeonName('Wayrest', 'Wayrest', line), 'line476');
  assert.equal(specialDungeonName('Sentinel', 'Sentinel', line), 'line477');
  // The match is region AND location - a dungeon called Daggerfall in
  // another region, or another dungeon in Daggerfall, is not special.
  assert.equal(specialDungeonName('Daggerfall', 'Privateer\'s Hold', line), 'Privateer\'s Hold');
  assert.equal(specialDungeonName('Betony', 'Daggerfall', line), 'Daggerfall');
  assert.equal(specialDungeonName('Menevia', 'Lysandus\' Tomb', line), 'Lysandus\' Tomb');
  // A missing TEXT.RSC line falls back to the location's name rather
  // than to nothing - the never-traps law.
  assert.equal(specialDungeonName('Wayrest', 'Wayrest', () => null), 'Wayrest');
  assert.equal(specialDungeonName('X', undefined, line), '');
});

test('the world host supplies BOTH hooks, so the answer has no holes', () => {
  const world = read('src/scenes/world.js');
  assert.match(world, /specialDungeonName: \(\) => specialDungeonName\(/);
  assert.match(world, /dungeonRegionName: \(\) => questWorld\.currentRegionName\(\),/);
  // The pipeline's dungeon arm reads exactly these two.
  assert.match(read('src/systems/answerPipeline.js'),
    /return format\(tmpl, this\.deps\.specialDungeonName\?\.\(\) \?\? '', this\.deps\.dungeonRegionName\?\.\(\) \?\? ''\);/);
});
