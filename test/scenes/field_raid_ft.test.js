// FIELD-RAID-FT (2026-09-28, Discord, lumin: "Fast traveled to a raid and got a crash" - "TypeError: Cannot read
// properties of null (reading 'filter') at Object.peersInTown"). A fast travel leaves the old cell's room before the
// new one opens, and `peersNear()` answers null while no room is open; the raids' host seam walked it, so arriving in
// a raided town (the raid's Update runs its election the first frame the player stands in the town) threw out of the
// frame. Walking in never met the gap: the room was open all the way. Mounted here: world.js's own peersNear and the
// raid host's peersInTown, the room closed and open.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const WORLD = readFileSync(new URL('../../src/scenes/world.js', import.meta.url), 'utf8');
// PIN MOVED (WW6): the raid host's seams moved verbatim out of bootWorld to scenes/raidHost.js (HOST-SPLIT), where the
// host's live names are read as `host.<name>`
const RAID_HOST = readFileSync(new URL('../../src/scenes/raidHost.js', import.meta.url), 'utf8');
const lineOf = (head) => { const i = RAID_HOST.indexOf(head); assert.ok(i >= 0, head); return RAID_HOST.slice(i, RAID_HOST.indexOf('\n', i)); };

test('FIELD-RAID-FT: with no room open (a fast travel between rooms) the raid\'s peersInTown is nobody, not a crash; with one open, the peers in the town\'s rect', () => {
  assert.match(WORLD, /const peersNear = \(\{ presenceOnly = false \} = \{\}\) => \{\n\s*if \(!online \|\| !online\.room \|\| online\.status !== 'open'\) return null;/, 'peersNear answers null between rooms');
  const seam = lineOf('    peersInTown: () =>').trim().replace(/,\s*\/\/.*$/, '').replace(/,$/, '');
  const make = (peers) => new Function('host', '_foeInTownRect', `return ({ ${seam} }).peersInTown;`)({ peersNear: () => peers }, (f) => f.ai.feet[0] < 10);
  assert.deepEqual(make(null)(), [], 'the room closed: nobody in town');
  assert.deepEqual(make([{ id: 'a', feet: [1, 0, 0] }, { id: 'b', feet: [50, 0, 0] }])(), ['a'], 'the room open: the peers in the rect');
});
