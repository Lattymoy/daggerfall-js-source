import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  interiorLightProperties, collectInteriorLights,
  INTERIOR_LIGHT_RANGE, INTERIOR_LIGHT_INTENSITY, INTERIOR_LIGHT_COLOR,
} from '../src/world/interiorLights.js';

// DaggerfallInterior.AddLight's SECOND per-record switch
// (DaggerfallInterior.cs:1034-1151, "adjust properties of light
// sources"). The RANGE column shipped at AUDIT 18; INTENSITY and
// COLOUR were the Port-Ledger's "per-light interior light INTENSITY
// and COLOUR" row and land here.
//
// THE TABLE IS PINNED WHOLE, not sampled: a table with one wrong cell
// is worse than no table, so every record 0-29 is transcribed a second
// time below straight from the C# and compared against what the law
// actually returns. Unassigned cells fall back to the DaggerfallLight
// [Interior] prefab ("Assets/Prefabs/Scene/DaggerfallLight
// [Interior].prefab":41-44 - m_Range 15, m_Intensity 1, m_Color
// {1,1,1,1}), so `light.range /= 3f` reads 5 and `light.range *= 1.2f`
// reads 18.
const B = [15, 1, 1, 1, 1];   // the prefab's light: range, intensity, r, g, b

// record -> [range, intensity, r, g, b], second transcription.
const CSHARP = [
  /*  0 Bowl with fire                */ [20.0, 1.1, 0.95, 0.91, 0.63],
  /*  1 Campfire                 todo */ B,
  /*  2 Skull candle                  */ [5, 0.6, 1.0, 0.99, 0.82],
  /*  3 Candle                        */ [5, 1, 1, 1, 1],
  /*  4 Candle with base              */ [5, 1, 1, 1, 1],
  /*  5 Candleholder w/ 3 candles     */ [7.5, 0.33, 1.0, 0.89, 0.61],
  /*  6 Skull torch                   */ [15.0, 0.75, 1.0, 0.93, 0.62],
  /*  7 Wooden chandelier, out   todo */ B,
  /*  8 Turkis lamp                   */ [15, 1, 0.68, 1.0, 0.94],
  /*  9 Metallic chandelier, lit      */ [15.0, 0.65, 1.0, 0.92, 0.6],
  /* 10 Metallic chandelier, out todo */ B,
  /* 11 Candle in lamp                */ [5.0, 0.5, 1, 1, 1],
  /* 12 Extinguished lamp        todo */ B,
  /* 13 Round lamp                    */ [18, 1.1, 0.93, 0.84, 0.49],
  /* 14 Standing lantern         todo */ B,
  /* 15 Standing lantern round   todo */ B,
  /* 16 Mounted torch, thin      todo */ B,
  /* 17 Mounted torch 1               */ [15, 0.8, 1.0, 0.97, 0.87],
  /* 18 Mounted torch 2          todo */ B,
  /* 19 Pillar with firebowl     todo */ B,
  /* 20 Brazier torch                 */ [12.0, 0.75, 1.0, 0.92, 0.72],
  /* 21 Standing candle               */ [5, 0.5, 1.0, 0.95, 0.67],
  /* 22 Round lantern, med chain      */ [15, 1.5, 1.0, 0.95, 0.78],
  /* 23 Wooden chandelier, lit   todo */ B,
  /* 24 Lantern with long chain       */ [15, 1.4, 1.0, 0.98, 0.64],
  /* 25 Lantern with med chain        */ [15, 1.4, 1.0, 0.98, 0.64],
  /* 26 Lantern with short chain      */ [15, 1.4, 1.0, 0.98, 0.64],
  /* 27 Lantern with no chain         */ [15, 1.4, 1.0, 0.98, 0.64],
  /* 28 Street lantern 1         todo */ B,
  /* 29 Street lantern 2         todo */ B,
];

const flat = (p) => [p.range, p.intensity, p.color[0], p.color[1], p.color[2]];

test('interior lights: AddLight\'s second switch, every record 0-29', () => {
  assert.equal(CSHARP.length, 30);
  assert.deepEqual(
    CSHARP.map((_, record) => flat(interiorLightProperties(record))),
    CSHARP);
});

test('interior lights: the prefab base is the fallback and there is no default arm', () => {
  assert.equal(INTERIOR_LIGHT_RANGE, 15);
  assert.equal(INTERIOR_LIGHT_INTENSITY, 1);
  assert.deepEqual([...INTERIOR_LIGHT_COLOR], [1, 1, 1]);
  // The C# switch has no `default:` arm, so a record it never names -
  // above 29, or a nonsense one - leaves the prefab light untouched.
  for (const record of [-1, 30, 31, 210, 1e9]) {
    assert.deepEqual(flat(interiorLightProperties(record)), B, `record ${record}`);
  }
  // ...and so does every "todo" arm inside the range.
  for (const record of [1, 7, 10, 12, 14, 15, 16, 18, 19, 23, 28, 29]) {
    assert.deepEqual(flat(interiorLightProperties(record)), B, `todo record ${record}`);
  }
});

test('interior lights: the table is frozen - callers cannot rewrite a record\'s light', () => {
  const p = interiorLightProperties(0);
  assert.throws(() => { p.intensity = 99; }, TypeError);
  assert.throws(() => { p.color[0] = 99; }, TypeError);
  assert.deepEqual(flat(interiorLightProperties(0)), [20.0, 1.1, 0.95, 0.91, 0.63]);
});

test('interior lights: the placement site hangs intensity and colour on every light', () => {
  // Drive the real collector: one archive-210 flat per record, plus a
  // non-210 flat that must not become a light at all.
  const flats = [{ archive: 199, record: 0, x: 0, y: 0, z: 0 }];
  for (let record = 0; record < 30; record++) {
    flats.push({ archive: 210, record, x: record, y: 0, z: 0 });
  }
  const lights = collectInteriorLights(flats, () => ({ w: 1, h: 0 }));
  assert.equal(lights.length, 30);
  assert.deepEqual(lights.map((l) => [l.range, l.intensity, ...l.color]), CSHARP);
  // The placement law is untouched by this: record order and position
  // still come from the flats.
  assert.deepEqual(lights.map((l) => l.x), CSHARP.map((_, i) => i));
});
