// TL3 (2026-09-08, Mac, the second report: "when traveling, sometimes
// you'll spawn inside building geometry").
//
// THE ROOT: the fast-travel arrival never asked for the reposition.
// DaggerfallTravelPopUp.performTravel teleports WITH a reposition
// method and StreamingWorld's PositionPlayerToLocation then stands the
// player just outside the location's rectangle or at its nearest start
// marker (locationEntrance.js, ported for the court release and the
// ship). fastTravelTo passed none, so the arrival took the teleport's
// DEFAULT point - the map pixel's centre, which for every location is
// the centre of the town, and for many the middle of a building - and
// TL2's roof guard, gated on a landing that was always null there,
// never ran on the one path it was written for.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { REPOSITION } from '../src/systems/ship.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (f) => readFileSync(join(ROOT, f), 'utf8');

test('TL3: the fast-travel arrival takes DFU\'s reposition - the start marker or the edge, never the pixel\'s centre - so TL2\'s roof guard is live on it', () => {
  const w = read('src/scenes/world.js');
  const fn = w.slice(w.indexOf('async function fastTravelTo('), w.indexOf('async function fastTravelTo(') + 4000);
  assert.match(fn, /await _teleportToPixel\(pick\.pixel\.x, pick\.pixel\.y, null,\s*\n\s*\{ arriveMinutes: worldMinutes\(\) \+ computed\.minutes, reposition: REPOSITION\.RandomStartMarker \}\);/, 'the arrival asks for the start-marker landing');
  assert.equal(REPOSITION.RandomStartMarker, 'RandomStartMarker');
  // the teleport core: the landing is computed only for that method, the default point is the pixel's centre,
  // and the roof guard runs only with a landing - which the arrival now always has
  const core = w.slice(w.indexOf('async function _teleportToPixel('), w.indexOf('async function _teleportToPixel(') + 9000);
  assert.match(core, /const landing = reposition === REPOSITION\.RandomStartMarker \? locationLandingFor\(px, py\) : null;/);
  assert.match(core, /const raw = local \?\? \[TERRAIN_SIZE \/ 2, dest\.centerHeight \+ state\.compensation\[1\] \+ 2, TERRAIN_SIZE \/ 2\];/, 'the default point is the centre of the pixel - the town\'s middle');
  assert.match(core, /if \(walkMode && landing && pos\[1\] - raw\[1\] > OBSTRUCTED_ABOVE\) \{/, 'TL2\'s guard, gated on the landing');
  assert.match(core, /if \(landing\) cam\.yaw = landing\.yaw;/, 'and the facing lands with the position');
  // the three arms DFU sends through PositionPlayerToLocation all ask for it now: the court release, the ship, the travel
  assert.match(w, /_teleportToPixel\(px\.x, px\.y, null, \{ reposition: REPOSITION\.RandomStartMarker \}\)/, 'the court release asks for it the same way');
  assert.ok((w.match(/REPOSITION\.RandomStartMarker/g) || []).length >= 3, 'the landing test, the court release and the fast travel (the ship\'s arm carries its own name)');
  assert.match(read('src/world/locationEntrance.js'), /Two callers reach it in DFU and the port owes both: the fast-travel\s*\n\/\/ arrival, and DaggerfallCourtWindow\.PositionPlayerAtLocationEntrance/, 'the record named the travel as an owed caller');
});
