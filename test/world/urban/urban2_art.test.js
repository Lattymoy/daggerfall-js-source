// URBANIZER U2 (2026-10-26; bible/03-World/Urban-Fabric.md section 3): the towns' own pictures - each province's paving,
// cobbles and walls, and the cut stone, brick and half-timbering of the capitals' landmarks - painted at vanilla's detail
// (TESA-LORE's measure of the freeware's 475 wall and ground textures), and worn where the lore's stone is.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { urbanPictures, installUrbanArt, _resetUrbanArt } from '../../../src/world/urban/urbanArt.js';
import { URBAN_ARCHIVE, URBAN_KINDS, URBAN_ART, URBAN_STYLES, URBAN_STYLE_KEYS, PROVINCE_STYLE, styleOf, styleArt, urbanArt } from '../../../src/world/urban/urbanRecords.js';
import { CAPITAL_ARCHIVE } from '../../../src/world/capitalShapes.js';
import { PROVINCE_OF_ID } from '../../../src/world/tamriel/tamrielLand.js';
import { buildCastleDour, buildSolitudeDocks, WAREHOUSE_PLINTH, levelY } from '../../../src/world/capitalSolitude.js';
import { SOLITUDE_LEVELS } from '../../../src/world/solitudeRelief.js';
import { buildMournholdPalace } from '../../../src/world/capitalMournhold.js';
import { buildAlinorPalace } from '../../../src/world/capitalAlinor.js';
import { buildManeEstate } from '../../../src/world/capitalTorval.js';
import { SOLITUDE } from '../../../src/world/tamrielCapitals.js';

const S = 64;
/** A picture's detail as TESA-LORE measured the freeware's (test/tesalore_capitals.test.js's measure): its colours, the mean
 *  |dL| to the next texel on its row, its luminance's spread, and the mean |dL| over its wrap beside the strongest inside. */
const detail = (px) => {
  const L = (i) => 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2], at = (x, y) => ((y % S) * S + (x % S)) * 4;
  const set = new Set(), cols = new Float64Array(S), rows = new Float64Array(S);
  let hf = 0, s = 0, s2 = 0;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const i = at(x, y), l = L(i), dx = Math.abs(l - L(at(x + 1, y))), dy = Math.abs(l - L(at(x, y + 1)));
    set.add((px[i] << 16) | (px[i + 1] << 8) | px[i + 2]); hf += dx; s += l; s2 += l * l; cols[x] += dx / S; rows[y] += dy / S;
  }
  const n = S * S, m = s / n;
  return { colours: set.size, hf: hf / n, std: Math.sqrt(s2 / n - m * m), seam: [cols[S - 1], rows[S - 1]], inner: [Math.max(...cols.slice(0, S - 1)), Math.max(...rows.slice(0, S - 1))] };
};
const records = () => [...URBAN_STYLE_KEYS.flatMap((_, k) => Object.values(URBAN_KINDS).map((o) => k * 8 + o)), ...Object.values(URBAN_ART)];

test('URBANIZER U2 the pictures at vanilla\'s detail: every style\'s setts, flags, cobbles and wall and the shared cut stone, brick, half-timbering and log ends 64 x 64, opaque, within the freeware\'s band (16 to 84 colours, a texel 5.4 to 18.4 from the next, a spread of 11.3 to 41.6) and tiling without a seam (mutants: a law\'s contrast doubled; a stake\'s width off the side)', () => {
  const art = urbanPictures();
  assert.equal(art.size, records().length);
  for (const record of records()) {
    const img = art.get(record), name = `record ${record}`;
    assert.deepEqual([img.width, img.height], [S, S], name);
    for (let i = 3; i < img.data.length; i += 4) assert.equal(img.data[i], 255, `${name} opaque`);
    const d = detail(img.data);
    assert.ok(d.colours >= 16 && d.colours <= 84, `${name}: ${d.colours} colours`);
    assert.ok(d.hf >= 5.4 && d.hf <= 18.4, `${name}: ${d.hf.toFixed(1)} from texel to texel`);
    assert.ok(d.std >= 11.3 && d.std <= 41.6, `${name}: a spread of ${d.std.toFixed(1)}`);
    for (const a of [0, 1]) assert.ok(d.seam[a] <= d.inner[a] + 1, `${name} tiles ${a ? 'down' : 'across'}: ${d.seam[a].toFixed(1)} over its wrap, ${d.inner[a].toFixed(1)} inside`);
  }
});

test('URBANIZER U2 the pictures are every client\'s: the same bytes every time (fixed seeds), each picture its own (mutants: a seed off the clock; two styles one picture)', () => {
  const hash = (m) => createHash('sha256').update(Buffer.concat(records().map((r) => Buffer.from(m.get(r).data)))).digest('hex');
  const a = urbanPictures(), b = urbanPictures();
  assert.equal(hash(a), hash(b));
  const each = new Set(records().map((r) => createHash('sha256').update(a.get(r).data).digest('hex')));
  assert.equal(each.size, records().length - 1, 'every picture its own but the planks\' setts and flags (one boardwalk)');
});

test('URBANIZER U2 the records: a pseudo-archive past the capitals\', a style\'s four in its eight, the shared ones past every style; a province\'s style its own stone, the Empire\'s where none is named (mutants: a style\'s record off its index; a province\'s style moved)', () => {
  assert.equal(URBAN_ARCHIVE, 38500);
  assert.ok(URBAN_ARCHIVE > CAPITAL_ARCHIVE);
  assert.deepEqual(styleArt('granite', 'setts'), [URBAN_ARCHIVE, 0]);
  assert.deepEqual(styleArt('imperial', 'wall'), [URBAN_ARCHIVE, URBAN_STYLE_KEYS.indexOf('imperial') * 8 + 3]);
  assert.deepEqual(urbanArt('halfTimber'), [URBAN_ARCHIVE, 201]);
  assert.ok(Math.min(...Object.values(URBAN_ART)) >= URBAN_STYLE_KEYS.length * 8, 'past every style');
  assert.deepEqual(PROVINCE_STYLE, { Skyrim: 'granite', HighRock: 'breton', Hammerfell: 'sandstone', Sumurset: 'limestone', Valenwood: 'planks', Elsweyr: 'redstone', BlackMarsh: 'planks', Morrowind: 'ochre', Imperial: 'imperial' });
  assert.deepEqual(Object.keys(PROVINCE_STYLE).sort(), Object.values(PROVINCE_OF_ID).sort());
  assert.equal(styleOf('Nowhere'), 'imperial');
  assert.equal(styleOf(null), 'imperial');
  assert.deepEqual(Object.fromEntries(URBAN_STYLE_KEYS.map((k) => [k, [URBAN_STYLES[k].wall, URBAN_STYLES[k].yard, URBAN_STYLES[k].carriage]])), {
    granite: ['rubble', 'fence', true], breton: ['brick', 'fence', true], sandstone: ['adobe', 'wall', true], redstone: ['adobe', 'wall', true],
    limestone: ['ashlar', 'wall', true], ochre: ['adobe', 'wall', true], imperial: ['brick', 'wall', true], planks: ['stakes', 'fence', false],
  });
});

test('URBANIZER U2 the install: every picture on the texture door once, painted when first asked (mutants: a record left off; installed twice)', async () => {
  _resetUrbanArt();
  const got = [];
  assert.equal(installUrbanArt({ addTextures: (e) => { got.push(...e); return e.length; } }), true);
  assert.equal(installUrbanArt({ addTextures: (e) => { got.push(...e); return e.length; } }), false);
  assert.deepEqual(got.map((e) => e.record).sort((a, b) => a - b), records().sort((a, b) => a - b));
  assert.ok(got.every((e) => e.archive === URBAN_ARCHIVE && e.standIn));
  const img = await got[0].build();
  assert.equal(img.width, 64);
  _resetUrbanArt();
});

/** The pictures a model's faces wear, as `archive_record` keys. */
const wears = (m) => new Set(m.subMeshes.map((s) => `${s.textureArchive}_${s.textureRecord}`));
const key = ([a, r]) => `${a}_${r}`;
test('URBANIZER U2 the capitals\' own buildings in cut stone, brick and half-timbering: Castle Dour\'s keep and the Emperor\'s Tower dressed stone, the docks\' warehouse timber-framed over plaster on its stone storey, Mournhold\'s palace dressed ochre, Alinor\'s terraces, keep and wings dressed white stone, the Mane\'s estate walled in sandstone brick (mutants: a building back in its rubble)', () => {
  assert.ok(wears(buildCastleDour()).has(key(urbanArt('ashlar'))));
  const docks = buildSolitudeDocks();
  assert.ok(wears(docks).has(key(urbanArt('halfTimber'))));
  // the warehouse's framing above its stone storey: every half-timber face over WAREHOUSE_PLINTH (PIN MOVED, SOLITUDE-RELIEF:
  // over the quay it stands on, at the water under the city's rock)
  const ht = docks.subMeshes.find((s) => s.textureArchive === URBAN_ARCHIVE && s.textureRecord === URBAN_ART.halfTimber);
  let low = Infinity;
  for (let t = ht.startIndex; t < ht.startIndex + ht.primitiveCount * 3; t++) low = Math.min(low, docks.positions[docks.indices[t] * 3 + 1]);
  assert.ok(Math.abs(low - (levelY(SOLITUDE_LEVELS.quay) + WAREHOUSE_PLINTH)) < 1e-4, `its framing from ${low}`);
  assert.ok(WAREHOUSE_PLINTH < SOLITUDE.docks.warehouse.h);
  assert.ok(wears(buildMournholdPalace()).has(key(urbanArt('ochreAshlar'))));
  assert.ok(wears(buildAlinorPalace()).has(key(urbanArt('whiteAshlar'))));
  assert.ok(wears(buildManeEstate()).has(key(urbanArt('sandBrick'))));
});
