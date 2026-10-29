// OFFSHORE-MARKS (2026-10-29, the owner: roads and places past the Bay "under the water" on the travel map;
// bible/03-World/Tamriel.md OFFSHORE-MARKS): a place past the Bay is inked where it stands, never at its model point.
// The model point was snapped to the trace's pixels; the smooth coast cuts their corners, so on the freeware's data 18
// of the 283 places' points lie in the sea, and 7 ports stand on a shore 7 to 114 pixels from theirs.
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { arenaInkCities } from '../../src/ui/tamrielInk.js';
import { arenaPlaces, arenaPixels, setArenaStanding } from '../../src/world/arenaPlaces.js';
import { setTamrielTrace } from '../../src/world/tamriel/tamrielLand.js';
import { setTamrielFit, bayToPicture } from '../../src/world/tamriel/tamrielFrame.js';

afterEach(() => { setTamrielTrace(null); setTamrielFit(null); setArenaStanding(false); });

/** A trace of whole provinces as rectangles of picture pixels: [id, x0, y0, x1, y1]. */
function rectTrace(rects) {
  const w = 320, h = 200, land = new Uint8Array(w * h), province = new Uint8Array(w * h);
  for (const [id, x0, y0, x1, y1] of rects) for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { land[y * w + x] = 1; province[y * w + x] = id; }
  return { w, h, land, province };
}

test('OFFSHORE-MARKS a place that stands is inked on its stood pixel, whatever its model point says; with no host standing the places, at its point (mutants: the model point inked; the pinned alone on their pixel)', () => {
  setTamrielFit({ ox: 400, oy: 500, ppu: 10 });
  setTamrielTrace(rectTrace([[3, 110, 20, 210, 50], [1, 60, 20, 100, 50]]));
  setArenaStanding(true);
  const stood = arenaPixels().stood.find((p) => !p.pinned);
  assert.ok(stood, 'a place stands');
  const own = arenaPlaces().places.find((p) => p.provinceIndex === stood.provinceIndex && p.id === stood.id);
  // its point moved a picture pixel and a half off the land: the sea, as a snapped corner's point lies past the smooth coast
  const [sx, sy] = bayToPicture(stood.bx + 0.5, stood.by + 0.5);
  const offshore = { ...own, px: sx, py: 10 };
  assert.ok(sy > 20, 'the land starts at picture row 20');
  const [city] = arenaInkCities({ places: [offshore] });
  assert.deepEqual([city.x, city.y], [stood.bx + 0.5, stood.by + 0.5], 'inked on the pixel it stands on');
  assert.deepEqual(city.pixel, { x: stood.bx, y: stood.by });
  setArenaStanding(false);
  const [lore] = arenaInkCities({ places: [offshore] });
  assert.equal(lore.pixel, null, 'nobody stands it');
  assert.ok(Math.abs(lore.y - (stood.by + 0.5)) > 10, 'with no host standing the places, its own point');
});
