// AUDIT TESA II F6 (AUDIT TESA-BIOME F6, RECORDED latent): the roaming bands past the Bay - the world host's bandOk admitted
// the Bay's map and the Eltheric Ocean's box alone, so no band was born past the Bay and its make's `fauna` (the zone's wild)
// never ran. Now land a zone answers, once the trace stands, off every place (systems/tamrielFauna.js bandGroundPastBay).
// bible/03-World/Tamriel-Biomes.md (the hosts).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { bandGroundPastBay, faunaBandAt, installTamrielFauna, biomeTable } from '../../src/systems/tamrielFauna.js';
import { bandsNear, bandMakeSeed, bandSizeOf, BAND_CELL_PX } from '../../src/systems/travel/travelBands.js';
import { seededRng } from '../../src/systems/wind/wind.js';
import { rollGroupComposition } from '../../src/systems/campEncounters.js';
import { _resetEncounterTableSelectors } from '../../src/characters/encounterTableDoor.js';
import { setTamrielTrace } from '../../src/world/tamriel/tamrielLand.js';
import { setTamrielFit, pictureToBay } from '../../src/world/tamriel/tamrielFrame.js';
import { arenaPixels, arenaPlaceOnPixel } from '../../src/world/arenaPlaces.js';
import { capitalOnPixel } from '../../src/world/tamrielCapitals.js';
import { tamrielBiomeAt } from '../../src/world/tamriel/tamrielBiomes.js';
import { tamrielClimateAt } from '../../src/world/tamriel/tamrielGround.js';
import { onBayOrEther } from '../../src/world/ethericSea.js';

const read = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');

/** Skyrim (picture 140..200 x 20..70), Morrowind east of it and Cyrodiil south (140..230 x 70..140), the sea about them -
 *  a trace's shape. */
function land() {
  const w = 320, h = 200, l = new Uint8Array(w * h), province = new Uint8Array(w * h);
  for (let y = 20; y < 70; y++) for (let x = 140; x < 260; x++) { l[y * w + x] = 1; province[y * w + x] = x < 200 ? 3 : 4; }
  for (let y = 70; y < 140; y++) for (let x = 140; x < 230; x++) { l[y * w + x] = 1; province[y * w + x] = 9; }
  return { w, h, land: l, province };
}

test('AUDIT TESA II F6: a band may stand past the Bay on land a zone answers, once the trace stands - never at sea, never on the Bay\'s map (its own law), never on a place: Arena\'s, a capital\'s, the countryside\'s or a lair\'s (mutants: the trace unasked; the places unread; the host\'s roll unread)', () => {
  setTamrielFit(null);
  const [x, y] = pictureToBay(170.5, 45.5).map(Math.floor), [sx, sy] = pictureToBay(170.5, 170.5).map(Math.floor);
  assert.equal(bandGroundPastBay(x, y), false, 'no trace: the authored rings are no client\'s shared land');
  try {
    setTamrielTrace(land());
    assert.ok(tamrielBiomeAt(x, y), 'Skyrim\'s land has its zone');
    assert.equal(bandGroundPastBay(x, y), true, 'the land past the Bay');
    assert.equal(bandGroundPastBay(sx, sy), false, 'the sea');
    assert.equal(bandGroundPastBay(500, 250), false, 'the Bay\'s map - its own law (onBayOrEther)');
    assert.equal(bandGroundPastBay(x, y, () => 'Old Bram\'s Farm'), false, 'a countryside\'s place or a lair (the host\'s roll)');
    const place = arenaPixels().stood.find((p) => p.province === 'Skyrim' && !capitalOnPixel(p.bx, p.by) && tamrielBiomeAt(p.bx, p.by));
    assert.ok(place, 'a place stands on the trace');
    assert.equal(bandGroundPastBay(place.bx, place.by), false, `never on ${place.name}'s pixel`);
    // a capital's own pixels - the Imperial City's slices about its centre, no Arena place on them
    const [x0, y0] = pictureToBay(140, 70).map(Math.floor), [x1, y1] = pictureToBay(230, 140).map(Math.floor);
    let slice = null;
    for (let py = y0; py <= y1 && !slice; py++) for (let px = x0; px <= x1 && !slice; px++) if (capitalOnPixel(px, py) && !arenaPlaceOnPixel(px, py) && tamrielBiomeAt(px, py)) slice = [px, py];
    assert.ok(slice, 'a capital\'s slice stands on the trace');
    assert.equal(bandGroundPastBay(...slice), false, `never on a capital's pixel (${slice})`);
  } finally { setTamrielTrace(null); }
});

test('AUDIT TESA II F6 by source: the world host\'s bandOk admits it beside the Bay\'s map and the Eltheric box, the land past the Bay\'s switch and the host\'s place roll handed in; a band\'s make rolls its pixel\'s zone\'s wild', () => {
  const w = read('src/scenes/world.js');
  assert.match(w, /return \(onBayOrEther\(px, py\) \|\| \(tamrielLand && bandGroundPastBay\(px, py, tamrielPlaceName\)\)\) && !tvWater\(px, py\) && !_bandPlacePixels\.has\(`\$\{px\},\$\{py\}`\) && !etherPlaceIsle\(px, py\);/);
  assert.match(w, /const hit = rollGroupComposition\(\{ climateIndex: maps\.getClimateIndex\(px, py\), fauna: maps\.getFaunaBand\?\.\(px, py\),/);
  assert.match(w, /maps\.getFaunaBand = faunaBandAt;/);
});

const ARENA2 = process.env.ARENA2_PATH;
const HAVE = !!ARENA2 && ['TMAP00I0.IMG', 'TAMRIEL2.IMG', 'MAP.PAL', 'ART_PAL.COL'].every((f) => existsSync(join(ARENA2, f)));
test('AUDIT TESA II F6 with ARENA2: on the player\'s own trace bands are born in Skyrim\'s High Peaks\' country and Cyrodiil\'s jungle, each made of its zone\'s own wild', { skip: HAVE ? false : 'ARENA2_PATH not set' }, async () => {
  const fetchBytes = async (n) => new Uint8Array(readFileSync(join(ARENA2, n)));
  const { DFPalette } = await import('../../src/formats/dfPalette.js');
  const { preloadTamrielTrace } = await import('../../src/ui/tamrielTrace.js');
  const pal = new DFPalette(); pal.load(await fetchBytes('ART_PAL.COL'), 'ART_PAL.COL');
  setTamrielTrace(await preloadTamrielTrace({ fetchBytes, palette: pal }));
  setTamrielFit({ ox: 38 * 15.5, oy: 57 * 15.5, ppu: 15.5 });
  _resetEncounterTableSelectors();
  installTamrielFauna();
  try {
    const ok = (x, z) => { const px = Math.floor(x / 32768), py = 499 - Math.floor(z / 32768); return onBayOrEther(px, py) || bandGroundPastBay(px, py); };
    let made = 0;
    for (const [picX, picY] of [[170, 66], [185, 101]]) {
      const [mx, my] = pictureToBay(picX, picY).map(Math.floor);
      const bands = [];
      for (let life = 1000; life < 1040 && !bands.length; life++) bands.push(...bandsNear({ at: { x: mx, y: 499 - my }, ms: life * 12 * 60 * 1000, night: false, ok, reach: BAND_CELL_PX * 2 }));
      assert.ok(bands.length, `a band past the Bay about picture ${picX}, ${picY}`);
      for (const b of bands) {
        const px = Math.floor(b.born.x / 32768), py = 499 - Math.floor(b.born.z / 32768);
        const fauna = faunaBandAt(px, py);
        assert.ok(fauna, `${b.id} born on a zone's land (${tamrielBiomeAt(px, py)?.key})`);
        const hit = rollGroupComposition({ climateIndex: tamrielClimateAt(px, py), fauna, playerLevel: 10, inLocationRect: false, gameMinutes: 720, size: bandSizeOf(b), local: true }, seededRng(bandMakeSeed(b)));
        if (!hit?.mobileTypes?.length) continue;
        const wild = new Set(fauna.flatMap((i) => biomeTable(i)));
        for (const m of hit.mobileTypes) assert.ok(wild.has(m), `${b.id}'s ${m} its zone's (${tamrielBiomeAt(px, py)?.key})`);
        made++;
      }
    }
    assert.ok(made > 0, 'a band made of its zone\'s wild');
  } finally { _resetEncounterTableSelectors(); setTamrielTrace(null); setTamrielFit(null); }
});
