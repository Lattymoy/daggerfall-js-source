// EE9: the surface field - the lab's five laws and the game's own clock,
// pure and pinned before any of it touches a shader.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SurfaceField, warmthAt, baseSnowDepth, seasonWarmth, diurnalWarmth, CELLS_PER_TILE } from '../src/world/surfaceField.js';

const flatHeights = (tileDim, h = 100) => new Float32Array((tileDim + 1) * (tileDim + 1)).fill(h);

test('EE9: warmth - a desert winter holds nothing, a mountain winter holds it all', () => {
  const midwinter = 0, midsummer = 180;
  assert.ok(seasonWarmth(midwinter) < -0.39 && seasonWarmth(midsummer) > 0.39, 'the season swings a full 0.8');
  assert.ok(diurnalWarmth(240) < -0.1 && diurnalWarmth(960) > 0.1, 'pre-dawn is coldest, mid-afternoon warmest');
  // the calendar's base depth
  assert.equal(baseSnowDepth({ climateBase: 0, dayOfYear: midwinter }), 0, 'desert: none, even at midwinter');
  assert.ok(baseSnowDepth({ climateBase: 100, dayOfYear: midwinter }) > 0.9, 'mountain: all of it');
  const temperateWinter = baseSnowDepth({ climateBase: 300, dayOfYear: midwinter });
  assert.ok(temperateWinter > 0.3 && temperateWinter < 0.8, `temperate: some (${temperateWinter.toFixed(2)})`);
  assert.equal(baseSnowDepth({ climateBase: 300, dayOfYear: midsummer }), 0, 'and none by summer');
  // warmth decides melt: over 0.5 melts
  assert.ok(warmthAt({ climateBase: 300, dayOfYear: midwinter, minuteOfDay: 240 }) < 0.5, 'a temperate winter night holds');
  assert.ok(warmthAt({ climateBase: 300, dayOfYear: 90, minuteOfDay: 960 }) > 0.5, 'a temperate spring afternoon melts');
  assert.ok(warmthAt({ climateBase: 300, dayOfYear: 90, minuteOfDay: 960, cover: 1 }) < warmthAt({ climateBase: 300, dayOfYear: 90, minuteOfDay: 960 }), 'a deck costs warmth');
});

test('EE9: snow lies on the flat and pools in hollows - the terrain decides where', () => {
  const dim = 4; const hDim = dim + 1;
  const h = new Float32Array(hDim * hDim);
  for (let x = 0; x < hDim; x++) for (let z = 0; z < hDim; z++) h[x * hDim + z] = 100 + (x >= 3 ? (x - 2) * 20 : 0);   // flat, then a slope
  const f = new SurfaceField({ heights: h, tileDim: dim });
  assert.equal(f.dim, dim * CELLS_PER_TILE);
  const flatCell = f.flat[2 * f.dim + 2]; const slopeCell = f.flat[2 * f.dim + 14];
  assert.ok(flatCell > 0.9 && slopeCell < 0.5, `flatness reads the slope (${flatCell.toFixed(2)} vs ${slopeCell.toFixed(2)})`);
  // a hollow pools more than a rise
  const bowl = new Float32Array(hDim * hDim).fill(100); bowl[2 * hDim + 2] = 90;
  const g = new SurfaceField({ heights: bowl, tileDim: dim });
  const centre = g.pool[Math.floor(2 * CELLS_PER_TILE) * g.dim + Math.floor(2 * CELLS_PER_TILE)];
  const edge = g.pool[1 * g.dim + 1];
  assert.ok(centre > edge, `the hollow pools (${centre.toFixed(2)}) more than the flat (${edge.toFixed(2)})`);
});

test('EE9: a storm lays more on the flat than on the slope', () => {
  const dim = 4; const hDim = dim + 1;
  const h = new Float32Array(hDim * hDim);
  for (let x = 0; x < hDim; x++) for (let z = 0; z < hDim; z++) h[x * hDim + z] = 100 + (x >= 3 ? (x - 2) * 20 : 0);
  const f = new SurfaceField({ heights: h, tileDim: dim });
  for (let i = 0; i < 60; i++) f.tick(1, { snowRate: 1, warmth: 0.2 });
  const onFlat = f.snowAt(2 * 1.6 + 0.8, 2 * 1.6 + 0.8); const onSlope = f.snowAt(14 * 1.6 + 0.8, 2 * 1.6 + 0.8);
  assert.ok(onFlat > onSlope * 1.5, `the flat holds more (${onFlat.toFixed(2)} vs ${onSlope.toFixed(2)} on the slope)`);
});

test('EE9: a storm builds, a footfall compresses, warmth CONVERTS snow to water, the sun dries it', () => {
  const f = new SurfaceField({ heights: flatHeights(4), tileDim: 4 });
  // it snows for a while, cold
  for (let i = 0; i < 200; i++) f.tick(1, { snowRate: 1, warmth: 0.2 });
  const afterSnow = f.census();
  assert.ok(afterSnow.snow > 0.5, `snow built (${afterSnow.snow.toFixed(2)})`);
  assert.equal(afterSnow.water, 0, 'and no water yet');
  // a footfall: compressed, not deleted, and packed
  // a foot lands on a cell's centre: (5.5 cells) = 8.8m on a 1.6m grid
  const x = 8.8, z = 8.8;
  const before = f.snowAt(x, z);
  f.stamp(x, z);
  const print = f.snowAt(x, z);
  assert.ok(print < before * 0.7, `the print sits lower (${print.toFixed(2)} < ${before.toFixed(2)})`);
  assert.ok(f.data[(Math.floor(z / f.cellSize) * f.dim + Math.floor(x / f.cellSize)) * 4 + 2] > 0.5, 'and is packed');
  assert.ok(f.snowAt(x + 4.8, z) >= before, 'three cells over is untouched, or lifted by the rim');
  // warmth: the snow becomes water, then dries
  // warmth on a WET-FREE start: the only water that can appear is the
  // melt's, so its presence proves the conversion
  let peakWater = 0;
  for (let i = 0; i < 400; i++) { f.tick(1, { warmth: 0.95 }); peakWater = Math.max(peakWater, f.census().water); }
  const melted = f.census();
  assert.ok(melted.snow < afterSnow.snow * 0.3, `the snow melted (${melted.snow.toFixed(3)})`);
  assert.ok(peakWater > 0.01, `the melt BECAME water rather than vanishing (peak ${peakWater.toFixed(3)})`);
  for (let i = 0; i < 2000; i++) f.tick(1, { warmth: 0.95 });
  assert.ok(f.census().water < 0.02, `the sun dried the puddles (${f.census().water.toFixed(3)})`);
});

test('EE9: the calendar is the base - the field fills toward it in the cold and settles back to it', () => {
  const f = new SurfaceField({ heights: flatHeights(4), tileDim: 4 });
  f.setBase(0.8);
  for (let i = 0; i < 3000; i++) f.tick(1, { warmth: 0.2 });
  assert.ok(f.census().snow > 0.5, `a cold midwinter fills toward the base (${f.census().snow.toFixed(2)})`);
  f.setBase(0);
  for (let i = 0; i < 6000; i++) f.tick(1, { warmth: 0.45 });
  assert.ok(f.census().snow < 0.15, `spring settles it back (${f.census().snow.toFixed(2)})`);
});

test('EE9: flush uploads only the rows that changed', () => {
  const f = new SurfaceField({ heights: flatHeights(4), tileDim: 4 });
  assert.equal(f.flush(), null, 'nothing changed, nothing to upload');
  f.stamp(8.8, 8.8);
  const span = f.flush();
  assert.ok(span && span.last - span.first <= 4, `a print touches a few rows (${JSON.stringify(span)})`);
  assert.equal(f.flush(), null, 'and they are clean after');
  assert.ok(f.pixels[(Math.floor(8.8 / f.cellSize) * f.dim + Math.floor(8.8 / f.cellSize)) * 4 + 2] > 100, 'the image carries the pack');
});

// ═══ EE9: the field in the renderer and the host ════════════════════
test('EE9: snow is a HEIGHT in the terrain shader, the grass is buried by it, and the winter ground draws its summer materials', () => {
  const r = readFileSync('src/render/renderer.js', 'utf8');
  const vi = r.indexOf('const TERRAIN_VS = `'); const vs = r.slice(vi, r.indexOf('`;', vi));
  assert.match(vs, /uniform sampler2D uField;/, 'declared inside the vertex stage that reads it');
  assert.match(vs, /if \(uFieldAmt > 0\.0\) \{/, 'free when there is no field');
  // EE14: sampled per VERTEX still, and now the MINIMUM over the cells
  // around it, so a vertex touching a road stays at the road's level and
  // the snow ramps down to it
  assert.match(vs, /vec4 f = textureLod\(uField, fuv, 0\.0\);/, 'sampled per VERTEX for the displacement');
  assert.match(vs, /float depth = min\(f\.g, min\(min\(textureLod\(uField, fuv \+ vec2\(e, 0\.0\), 0\.0\)\.g/, 'a road vertex takes the road\u2019s depth, not the verge\u2019s');
  const ti = r.indexOf('const TERRAIN_FS = `'); const fs = r.slice(ti, r.indexOf('`;', ti));
  assert.match(fs, /uniform sampler2D uField;/, 'and inside the fragment stage, where the print is carried by colour and normal');
  assert.match(r, /setSurfaceField\(f\) \{ this\._field = f \?\? null; \}/, 'numbers and a texture handle - it binds nothing');
  assert.match(r, /updateFieldRows\(tex, dim, pixels, first, last\)/, 'only the rows that changed go up');
  const w = readFileSync('src/scenes/world.js', 'utf8');
  // the record carries its field and its climate - the census found it
  // carrying neither, so no pixel ever had one
  assert.match(w, /field, climateBase,   \/\/ EE9/);
  // winter draws the SUMMER ground archive under the field
  assert.match(w, /const groundSeason = fieldLive && season === SEASON\.Winter \? SEASON\.Summer : season;/, 'EE4\u2019s snow bridge is retired from the enhanced path');
  // round-robin: one field a slot, each carrying its own elapsed time
  assert.match(w, /fieldRobin = \(fieldRobin \+ 1\) % fields\.length;/, 'nine fields at 10 Hz crashed the page; one a slot does not');
  assert.match(w, /const dtField = Math\.min\(6, \(nowMs - \(f\.lastTickMs \?\? nowMs\)\) \/ 1000\) \* 60;/);
  // the stamp is immediate and per pixel, at the player's own feet
  assert.match(w, /f\.sim\.stamp\(lx \+ Math\.cos\(yaw\) \* side, lz - Math\.sin\(yaw\) \* side\);/);
  assert.match(w, /get\('field'\) === 'off'\) return null;/, 'the kill switch');
  assert.match(w, /window\.__fieldCensus = \(\) => \{/, 'the census the probe reads');
});

// ═══ EE10: roads under weather ══════════════════════════════════════
test('EE10: a walked road holds less snow than the field beside it, and sheets the rain', () => {
  const dim = 8; const hDim = dim + 1;
  const heights = new Float32Array(hDim * hDim).fill(100);          // flat, so only hardness differs
  const tilemap = new Uint8Array(dim * dim);
  for (let k = 0; k < dim * dim; k++) tilemap[k] = 2 << 2;          // lawn everywhere...
  for (let tx = 0; tx < dim; tx++) tilemap[3 * dim + tx] = 46 << 2; // ...and one road across row 3
  const mk = () => { const f = new SurfaceField({ heights, tileDim: dim }); f.setHard(tilemap, new Set([46, 47, 55])); return f; };
  const cellOf = (f, tx, tz) => ((tz * f.cells + 1) * f.dim + (tx * f.cells + 1)) * 4;   // an interior cell of the tile
  // roads start TRODDEN
  const f0 = mk();
  assert.ok(f0.data[cellOf(f0, 4, 3) + 2] >= 0.5, 'a road is packed before anyone walks it today');
  assert.equal(f0.data[cellOf(f0, 4, 5) + 2], 0, 'the lawn is not');
  // a midwinter base, filled in: the road holds a fraction of the lawn's
  const f1 = mk(); f1.setBase(1);
  for (let i = 0; i < 60; i++) f1.tick(60, { warmth: 0.1 });
  const roadSnow = f1.data[cellOf(f1, 4, 3) + 1]; const lawnSnow = f1.data[cellOf(f1, 4, 5) + 1];
  assert.ok(lawnSnow > 0.3, `the lawn fills toward the base (${lawnSnow.toFixed(2)})`);
  assert.ok(roadSnow < lawnSnow * 0.45, `the road holds far less (${roadSnow.toFixed(2)} vs ${lawnSnow.toFixed(2)})`);
  // a storm on both: the road still takes less
  // ONE REAL TICK - six world-seconds, the host's own 100ms slot - of
  // a storm and of a rain, before either surface reaches the cap. Snow:
  // the lawn takes over four times what the travelled road does. Rain:
  // the road wets twice as fast, because nothing soaks into stone.
  const f2 = mk(); f2.tick(6, { snowRate: 0.8, warmth: 0.1 });
  const rs = f2.data[cellOf(f2, 4, 3) + 1]; const ls = f2.data[cellOf(f2, 4, 5) + 1];
  assert.ok(ls > rs * 3, `a fall settles on the lawn (${ls.toFixed(3)}) and not on the road (${rs.toFixed(3)})`);
  const f3 = mk(); f3.tick(6, { rainRate: 0.6, warmth: 0.5 });
  const rw = f3.data[cellOf(f3, 4, 3)]; const lw = f3.data[cellOf(f3, 4, 5)];
  assert.ok(rw > lw * 1.5, `rain sheets on the road (${rw.toFixed(3)}) faster than it soaks the lawn (${lw.toFixed(3)})`);
  // and the shader's shine lives on the road's own records
  const r = readFileSync('src/render/renderer.js', 'utf8');
  const ti = r.indexOf('const TERRAIN_FS = `'); const fs = r.slice(ti, r.indexOf('`;', ti));
  assert.match(fs, /bool road = \(layer == 46 \|\| layer == 47 \|\| layer == 55\);/, 'the shine is keyed by the painter\u2019s three records');
  assert.match(fs, /lit \*= mix\(1\.0, 0\.68, wet\);/, 'darker: the pores fill');
  assert.match(fs, /pow\(max\(dot\(n, H3\), 0\.0\), 90\.0\) \* wet \* 0\.9;/, 'shinier: a tight sun highlight');
  const w = readFileSync('src/scenes/world.js', 'utf8');
  assert.match(w, /if \(tilemapBytes\) sim\.setHard\(tilemapBytes, ROAD_RECORDS\);/, 'the field\u2019s road is the tile\u2019s road');
});

// ═══ EE11: water holds nothing, NPCs tread, and snow is never flat ══
test('EE11: no snow on water, no blade under the sea, NPCs stamp the field, and the snow has drifts', async () => {
  const dim = 8; const hDim = dim + 1;
  const heights = new Float32Array(hDim * hDim).fill(100);
  for (let x = 0; x < hDim; x++) { heights[x * hDim] = 1; heights[x * hDim + 1] = 1; }   // the z=0 tile row lies under the sea
  const tilemap = new Uint8Array(dim * dim); for (let k = 0; k < dim * dim; k++) tilemap[k] = 2 << 2;
  tilemap[5 * dim + 5] = 0;                                                                // one water tile, by record
  const f = new SurfaceField({ heights, tileDim: dim });
  f.setWater(tilemap, new Set([0]), 5); f.setBase(1);
  for (let i = 0; i < 60; i++) f.tick(60, { warmth: 0.1, snowRate: 0.5, rainRate: 0.3 });
  const cellOf = (tx, tz) => ((tz * f.cells + 1) * f.dim + (tx * f.cells + 1)) * 4;
  assert.ok(f.data[cellOf(4, 4) + 1] > 0.5, 'the lawn holds snow');
  assert.equal(f.data[cellOf(5, 5) + 1], 0, 'a water tile holds none - it is water');
  assert.equal(f.data[cellOf(5, 5)], 0, 'and pools no rain - it is rain already');
  assert.equal(f.data[cellOf(4, 0) + 1], 0, 'a tile under the sea plane holds none either, whatever its record');
  // the grass: no blade rooted below the water
  const { placeGrass } = await import('../src/render/groundSurfaces.js');
  const g = placeGrass({ tilemap, grassOf: [0, 0, 1, 0], heights, tileDim: dim, tileSize: 6.4, waterLevel: 5 });
  for (let i = 0; i < g.count; i++) assert.ok(g.data[i * 8 + 1] > 5, 'a blade stands above the sea');
  const gAll = placeGrass({ tilemap, grassOf: [0, 0, 1, 0], heights, tileDim: dim, tileSize: 6.4 });
  assert.ok(gAll.count > g.count, 'the water level is what removed them');
  // the host: the sea plane in the placer's own units, the field's water
  // mask beside its roads, and the town's people stamping as they walk
  const w = readFileSync('src/scenes/world.js', 'utf8');
  assert.match(w, /waterLevel: SCALED_OCEAN_ELEVATION \* DEFAULT_TERRAIN_SCALE \+ 0\.5,/);
  assert.match(w, /sim\.setWater\(tilemapBytes, new Set\(\[0\]\), SCALED_OCEAN_ELEVATION \* DEFAULT_TERRAIN_SCALE \+ 0\.5\);/);
  assert.match(w, /for \(const it of p\.population\.pool\) \{\s*\n\s*if \(!it\.active \|\| !it\.visible \|\| !it\.person\?\.pos\) continue;/, 'active, visible people only');
  assert.match(w, /holder\._fieldStep = \[nx, nz\];/, 'each walker carries its own last footfall (EE12: one stride rule)');
  // the shader: drifts and sastrugi shape the NORMAL and the colour, and
  // a trodden print is dark enough to read
  const r = readFileSync('src/render/renderer.js', 'utf8');
  const ti = r.indexOf('const TERRAIN_FS = `'); const fs = r.slice(ti, r.indexOf('`;', ti));
  assert.match(fs, /float drift = tfbm\(vLocalXZ \* 0\.045\);/);
  assert.match(fs, /float sast = tfbm\(vLocalXZ \* vec2\(0\.42, 0\.11\) \+ 7\.0\);/, 'sastrugi are anisotropic - a comb, not a blob');
  assert.match(fs, /vec3 driftN = normalize\(vec3\(-\(dGx \* 9\.0 \+ sGx \* 4\.0\), 1\.0, -\(dGz \* 9\.0\)\)\);/, 'a drift is a shape before it is a shade');
  assert.match(fs, /vec3 packed2 = vec3\(0\.56, 0\.62, 0\.74\);/, 'a print is dark enough to see');
});

// ═══ EE12: deep, persistent deformation, for everyone who walks ═════
test('EE12: a step is a trench with walls that the calendar cannot refill - only new snow can', () => {
  const dim = 8; const hDim = dim + 1;
  const heights = new Float32Array(hDim * hDim).fill(100); const tilemap = new Uint8Array(dim * dim).fill(2 << 2);
  const f = new SurfaceField({ heights, tileDim: dim }); f.setBase(1);
  for (let i = 0; i < 60; i++) f.tick(60, { warmth: 0.1 });
  const cellOf = (tx, tz) => ((tz * f.cells + 1) * f.dim + (tx * f.cells + 1)) * 4;
  const before = f.data[cellOf(4, 4) + 1];
  f.stamp(4 * 6.4 + 2.4, 4 * 6.4 + 2.4);
  const after = f.data[cellOf(4, 4) + 1];
  assert.ok(after < before * 0.3, `a foot drives most of the way down (${before.toFixed(2)} -> ${after.toFixed(2)})`);
  assert.ok(f.data[cellOf(4, 4) + 2] > 0.8, 'and packs the cell in one step');
  // the rim: the cells around the print stand HIGHER than they did
  const rim = f.data[((4 * f.cells + 3) * f.dim + (4 * f.cells + 1)) * 4 + 1];
  assert.ok(rim >= before, 'what the foot took is thrown to the rim - the trench has walls');
  // an hour of cold, no fall: the calendar does NOT refill the trench
  for (let i = 0; i < 600; i++) f.tick(6, { warmth: 0.1 });
  const hourLater = f.data[cellOf(4, 4) + 1];
  assert.ok(hourLater < before * 0.5, `an hour later the print is still there (${hourLater.toFixed(2)} of ${before.toFixed(2)})`);
  // a storm: NEW snow fills it, and the pack heals under the fall
  for (let i = 0; i < 300; i++) f.tick(6, { warmth: 0.1, snowRate: 0.8 });
  assert.ok(f.data[cellOf(4, 4) + 1] > before * 0.9, 'a fall covers the trail');
  assert.ok(f.data[cellOf(4, 4) + 2] < 0.2, 'and the pack heals under it');
  // every walker stamps: the town's people, the guards, the foes - one rule
  const w = readFileSync('src/scenes/world.js', 'utf8');
  assert.match(w, /const stride = \(holder, wx, wz\) => \{/, 'one stride rule for everyone');
  assert.match(w, /for \(const foe of exteriorFoes\.foes\) \{\s*\n\s*if \(foe\.dead \|\| !foe\.ai\?\.feet\) continue;\s*\n\s*stride\(foe, foe\.ai\.feet\[0\], foe\.ai\.feet\[2\]\);/, 'foes tread');
  assert.match(w, /for \(const g of cityGuards\.guards\) \{\s*\n\s*if \(g\.dead \|\| !g\.ai\?\.feet\) continue;\s*\n\s*stride\(g, g\.ai\.feet\[0\], g\.ai\.feet\[2\]\);/, 'guards tread');
  assert.match(w, /stride\(it\.person, it\.person\.pos\[0\], it\.person\.pos\[2\]\);/, 'people tread');
});

test('AUDIT 48: the census measures what it means, and the classic skin carries nothing of the arc', () => {
  const w = readFileSync('src/scenes/world.js', 'utf8');
  // the print is judged against an UNTOUCHED cell beside the trail, not
  // against the cell the walker stamped when it booted
  assert.match(w, /out\.beside = p\.field\.sim\.snowAt\(Math\.min\(TERRAIN_SIZE - 1, lx \+ 4\.8\), lz\);/);
  const probe = readFileSync('tools/fieldCensusProbe.mjs', 'utf8');
  assert.match(probe, /trench < beside \* 0\.5 \|\| beside < 0\.02/, 'a trench is under half the untouched depth beside it');
  assert.ok(!/keyboard\.down\('w'\)/.test(probe), 'the walker walks by the world\u2019s own door, not a key the page may not hear');
  assert.match(probe, /window\.__warpTo\(\[x \+ 2\.2, 0, z - 2\.2\], 0\)/);
  // and the classic skin is proven EMPTY of the arc by the same probe
  assert.match(probe, /check\(`classic skin: NO pixel carries a field/);
  assert.match(probe, /check\(`classic skin: NO pixel carries grass/);
  assert.match(probe, /\$\{SKIN \? '&skin=' \+ SKIN : ''\}/, 'through the skin\u2019s real door');
  // the debug door that found the truth stays, and is read-only
  const dbg = w.slice(w.indexOf('window.__fieldDebug = () => {'), w.indexOf('window.__fieldCensus = () => {'));
  assert.ok(!/stamp\(|\] = /.test(dbg), 'a debug door reads and never writes');
});

// ═══ EE14: what Mac saw in play ═════════════════════════════════════
test('EE14: the season pins the calendar, roads keep their level, the trench shows, and the field fills in one pass', () => {
  const w = readFileSync('src/scenes/world.js', 'utf8');
  assert.match(w, /const dayPin = params\.has\('day'\) \? Math\.max\(0, Math\.min\(359, Number\(params\.get\('day'\)\) \|\| 0\)\) : null;/);
  assert.match(w, /const fieldDay = \(\) => dayPin \?\? Math\.floor\(worldMinutes\(\) \/ 1440\);/);
  assert.ok(!/const day = Math\.floor\(worldMinutes\(\) \/ 1440\);/.test(w), 'every calendar read goes through the pin');
  assert.match(w, /sim\.fillToBase\(\);/, 'one pass, not forty ticks');
  assert.ok(!/for \(let i = 0; i < 40; i\+\+\) sim\.tick\(60/.test(w));
  const menu = readFileSync('src/ui/enhancedMenu.js', 'utf8');
  assert.match(menu, /\[\['winter', 'winter', 0\], \['spring', 'rain', 90\], \['summer', 'summer', 180\], \['fall', 'summer', 300\]\]/,
    'a season is both the archive and the day - spring is the RAIN archive, not a name the pin ignores');
  assert.match(menu, /\['day', String\(day\)\]/, 'the door sends the day');
  const r = readFileSync('src/render/renderer.js', 'utf8');
  const ti = r.indexOf('const TERRAIN_FS = `'); const fs = r.slice(ti, r.indexOf('`;', ti));
  assert.match(fs, /float cavity = clamp\(\(\(sL \+ sR \+ sD \+ sU\) \* 0\.25 - f\.g\) \* 6\.0, 0\.0, 1\.0\) \* uFieldAmt;/, 'the trench floor is read as a cavity');
  assert.match(fs, /tex \*= 1\.0 - cavity \* 0\.45 \* max\(snowCov, f\.b\);/, 'and darkened like a floor in shadow');
  assert.match(r, /range = 200\) \{/, 'the proto\u2019s range');
  assert.match(w, /: 10;\n/, 'the proto\u2019s density');
  // fillToBase converges to the tick's own target
  const dim = 8; const hDim = dim + 1; const heights = new Float32Array(hDim * hDim).fill(100);
  const a = new SurfaceField({ heights, tileDim: dim }); a.setBase(0.7); a.fillToBase();
  // (the old forty ticks reached only 73% of the target - the one pass
  // is where the ticks CONVERGE, which two hundred of them do reach)
  const b = new SurfaceField({ heights, tileDim: dim }); b.setBase(0.7); for (let i = 0; i < 200; i++) b.tick(60, { warmth: 0.1 });
  const k = ((4 * a.cells + 1) * a.dim + (4 * a.cells + 1)) * 4 + 1;
  assert.ok(Math.abs(a.data[k] - b.data[k]) < 0.05, `one pass lands where the ticks converge (${a.data[k].toFixed(2)} vs ${b.data[k].toFixed(2)})`);
});
