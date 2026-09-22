// HEARTH1 (2026-09-19, Mac: "Does this version of C&C not let you use
// braziers as extra campfires to cook from?") - THE WORLD'S OWN FIRES
// ARE FIRES.
//
// SURV3 gave the survival law one fire: a camp somebody PLACED. Every
// brazier, fire bowl and tavern hearth in Daggerfall was a sprite and a
// point light, so a player standing over a roaring brazier was as cold,
// as wet and as roughly rested as one standing in a field, and had to
// burn a Campfire Kit two feet from it to cook a fish.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { HEARTH_ARCHIVE, HEARTH_RECORDS, HEARTH_NEAR, isHearthFlat, collectHearths, nearestHearth, hearthNear, hearthAabb } from '../src/systems/survival/hearth.js';
import { BY_FIRE_REACH, FIRE_FLAT, CAMP_REACH, CAMP_TEXT } from '../src/systems/survival/camp.js';
import { interiorLightProperties } from '../src/world/interiorLights.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('HEARTH1: the law is the lights archive, and the three records that are a fire you can stand over', () => {
  assert.equal(HEARTH_ARCHIVE, FIRE_FLAT.archive, 'the same archive a camp’s own fire comes from');
  assert.deepEqual([...HEARTH_RECORDS], [0, 1, 20], 'bowl with fire, the flame itself, the brazier torch');
  // THE FLAME ITSELF: record 1 is what camp.js stands, so a block that
  // places one is placing a campfire and the law must agree with itself.
  assert.ok(isHearthFlat(HEARTH_ARCHIVE, FIRE_FLAT.record), 'a camp’s own flat is a hearth wherever it stands');
  // THE EXCLUSIONS, and they are the load-bearing half. Every candle,
  // lantern and chandelier in the archive is OUT - and so are the two
  // WALL TORCHES, which are a real flame bracketed at head height:
  // counting them would make every lit corridor a kitchen.
  for (const r of [2, 3, 4, 5, 8, 9, 11, 13, 21, 22, 24, 25, 26, 27]) {
    assert.equal(isHearthFlat(HEARTH_ARCHIVE, r), false, `record ${r} is a candle, lantern or chandelier - not a cooking fire`);
  }
  for (const r of [6, 17]) {
    assert.equal(isHearthFlat(HEARTH_ARCHIVE, r), false, `record ${r} is a WALL torch - a flame you cannot stand over`);
  }
  // the records DFU's own switch leaves unnamed stay out with them
  for (const r of [7, 10, 12, 14, 15, 16, 18, 19, 23, 28, 29]) {
    assert.equal(isHearthFlat(HEARTH_ARCHIVE, r), false, `record ${r} is one of AddLight's unnamed "todo" arms - not evidence of a fire`);
  }
  // and no other archive is a hearth, whatever its record
  for (const a of [87, 199, 201, 210 + 1, 253]) {
    if (a === HEARTH_ARCHIVE) continue;
    for (const r of HEARTH_RECORDS) assert.equal(isHearthFlat(a, r), false, `archive ${a} is not the lights archive`);
  }
  // the three really are records AddLight knows - a hearth the light
  // switch has never heard of would be a record picked out of the air
  for (const r of HEARTH_RECORDS) assert.ok(interiorLightProperties(r), `record ${r} resolves a light`);
});

test('HEARTH1: collectHearths takes the fires out of a lantern list and leaves the lanterns', () => {
  const lights = [
    { record: 22, x: 0, y: 2, z: 0 },   // round lantern
    { record: 20, x: 5, y: 1, z: 0, foot: -0.6, w: 0.5, h: 1.6 },   // BRAZIER, with its sprite (FIX-D)
    { record: 3, x: 6, y: 1, z: 0 },    // candle
    { record: 0, x: 9, y: 1, z: 2 },    // bowl with fire
    { x: 1, y: 1, z: 1 },               // a dungeon RDB Light resource: NO record at all
  ];
  assert.deepEqual(collectHearths(lights), [
    { x: 5, y: 1, z: 0, foot: -0.6, w: 0.5, h: 1.6 },   // FIX-D: the sprite rides through...
    { x: 9, y: 1, z: 2, foot: undefined, w: undefined, h: undefined },   // ...and a light nobody measured stays unmeasured, never guessed
  ]);
  assert.deepEqual(collectHearths(null), [], 'no list is no fires, not a throw');
  assert.deepEqual(collectHearths([null, undefined]), [], 'and neither is a hole in one');
});

test('HEARTH1: nearestHearth answers by distance and stops at the reach it is given', () => {
  const hearths = [{ x: 10, y: 0, z: 0 }, { x: 2, y: 0, z: 0 }, { x: 0, y: 0, z: 3.9 }];
  assert.deepEqual(nearestHearth(hearths, [0, 0, 0], BY_FIRE_REACH), { x: 2, y: 0, z: 0 }, 'the nearer of the two in reach');
  assert.equal(nearestHearth(hearths, [0, 0, 0], 1), null, 'nothing inside a metre');
  assert.equal(nearestHearth([], [0, 0, 0], BY_FIRE_REACH), null);
  assert.equal(nearestHearth(null, [0, 0, 0], BY_FIRE_REACH), null);
  // the y axis counts: a brazier on the floor below is not one you are at
  assert.equal(nearestHearth([{ x: 0, y: -8, z: 0 }], [0, 0, 0], BY_FIRE_REACH), null, 'a fire a storey down is not a fire you are standing at');
  // exactly AT the reach is in - the same closed bound nearestFire uses
  assert.ok(nearestHearth([{ x: BY_FIRE_REACH, y: 0, z: 0 }], [0, 0, 0], BY_FIRE_REACH), 'the bound is closed, as a camp’s is');
});

test('HEARTH1: the streaming cut-off clears every question the pool is asked', () => {
  // HEARTH_NEAR cuts the streaming host's walk. It has to clear BOTH
  // the warmth reach and the activation ray's, or the cut would answer
  // a question before the law did.
  assert.ok(HEARTH_NEAR > BY_FIRE_REACH, `${HEARTH_NEAR} must clear the warmth reach ${BY_FIRE_REACH}`);
  assert.ok(HEARTH_NEAR > CAMP_REACH, `${HEARTH_NEAR} must clear the ray's reach ${CAMP_REACH}`);
  assert.match(read('src/scenes/world.js'), /Math\.abs\(x - eye\[0\]\) > HEARTH_NEAR \|\| Math\.abs\(z - eye\[2\]\) > HEARTH_NEAR/, 'the streaming host cuts its walk by it');
});

test('HEARTH1: the two light collectors carry the record, which is the only thing that tells a brazier from a lantern', () => {
  const city = read('src/world/cityLights.js');
  // BOTH arms - the misc flats and the subrecord flats. One without the
  // other is a town whose braziers are fires on one side of the street.
  assert.equal((city.match(/record: obj\.textureRecord/g) ?? []).length, 2, 'the misc arm and the subrecord arm both carry it');
  assert.match(read('src/world/interiorLights.js'), /record: f\.record,/, 'and the interior collector');
});

test('HEARTH1: all four hosts answer with their own fires - THE FOUR HOSTS RULE', () => {
  // the streaming world and the fixed city split them off the lantern
  // walk they already do; the dungeon has no lantern list to split (its
  // lights are RDB Light RESOURCES with no texture) so it reads its own
  // flats; the interior takes the light list its context built.
  const world = read('src/scenes/world.js'), ex = read('src/scenes/exterior.js');
  const dung = read('src/scenes/dungeonContext.js'), wm = read('src/scenes/worldModes.js');
  assert.match(world, /if \(isHearthFlat\(LIGHTS_ARCHIVE, light\.record\)\) pixelHearths\.push\(\[lp\[0\], lp\[1\], lp\[2\], locLocal\[1\] \+ light\.foot, light\.w, light\.h\]\);/);
  assert.match(world, /hearths: hearthsNear,/, 'the streaming host hands its door to the pool');
  assert.match(ex, /if \(isHearthFlat\(LIGHTS_ARCHIVE, light\.record\)\) cityHearths\.push\(\{ \.\.\.l, foot: light\.foot, w: light\.w, h: light\.h \}\);/);
  assert.match(ex, /hearths: \(\) => cityHearths,/);
  assert.match(dung, /if \(isHearthFlat\(f\.archive, f\.record\)\) \{[^}]*dungeonHearths\.push\(/);
  assert.match(dung, /hearths: \(\) => dungeonHearths,/);
  assert.match(wm, /interiorHearths\.push\(\.\.\.collectHearths\(ctx\.lights\)\);/, 'AUDIT F4: through the law\u2019s own collection, not a fourth copy of its test');
  assert.match(wm, /hearths: \(\) => interiorHearths,/);
  // and the room's fires leave with the room
  // ...and they leave on EVERY way out. HT1 learned this the hard way
  // (AUDIT 66 F6: its pool was the one that never joined the
  // quest-teleport / load list, and a room's torches burned on in the
  // ear after the player had gone), so the COUNT is pinned rather than
  // the presence of one line - four teardown sites, each ending the
  // pool and emptying the list in the same breath.
  const _tears = wm.match(/interiorCamps\.destroyAll\(\); interiorHearths\.length = 0;/g) ?? [];
  assert.equal(_tears.length, 4, `the room's fires leave on every way out, not ${_tears.length} of them`);
  assert.equal((wm.match(/interiorCamps\.destroyAll\(\)/g) ?? []).length, _tears.length, 'and the pool is never ended without the list, or the next room inherits a hearth');
  assert.ok((wm.match(/interiorTorches\.destroyAll\(\)/g) ?? []).length <= _tears.length, 'no torch teardown path is missing its hearth twin');
  // the streaming host's are PIXEL-LOCAL and ride the floating origin,
  // like every other coordinate it carries
  assert.match(world, /const t = state\.pixelTranslation\(p\.px, p\.py, _hearthT\);/, 'translated at the moment they are asked for');
  assert.match(world, /const x = h\[0\] \+ t\[0\], y = h\[1\] \+ t\[1\], z = h\[2\] \+ t\[2\];/,
    '...and the translation is really APPLIED - a pin that only checks it was computed passes over a brazier left on its pixel');
});

test('HEARTH1: the interior’s byFire was a hard false and is the pool’s answer now', () => {
  const wm = read('src/scenes/worldModes.js');
  assert.doesNotMatch(wm, /swimming: false, byFire: false \}/, 'the hard false is gone');
  assert.match(wm, /byFire: interiorCamps\.byFire\(player\.pos\)/, 'the room answers for itself');
  // ...and the pool it answers from can never STAND anything: camping
  // indoors is refused, and it is handed no texture door to mount with.
  assert.match(wm, /const interiorCamps = createCamps\(\{\n(?:[^\n]*\n){0,8}?\s*place: \(\) => \(\{ insideBuilding: true \}\),/, 'the pool refuses to pitch');
  assert.doesNotMatch(wm, /const interiorCamps = createCamps\(\{[\s\S]{0,400}?uploadRecordFrame/, 'and has no upload door to mount a fire with');
});

test('HEARTH1: a world fire is nobody’s - it opens the cooking list and nothing else', () => {
  const c = read('src/scenes/camps.js');
  // Info and Talk name it; every other mode cooks. It cannot be rested
  // at as an ACT (the rest window reads byFire and already sees it),
  // stoked, or packed - there is no record to pack.
  assert.match(c, /if \(mode === 'info' \|\| mode === 'dialogue'\) \{ say\(CAMP_TEXT\.seeHearth\); return true; \}\s*\n\s*openCook\(null\);/,
    'named, or cooked on');
  assert.ok(CAMP_TEXT.seeHearth && CAMP_TEXT.seeHearth !== CAMP_TEXT.seeFire, 'and it says it is not your campfire');
  // openCook takes a NULL camp for it, and skips the burn-down test a
  // camp needs - a brazier does not go out.
  assert.match(c, /if \(c && !fireLit\(c\.rec, now\(\)\)\) \{ say\(CAMP_TEXT\.cold\); return null; \}/, 'the embers test is the CAMP’s');
  // byFire asks both pools
  assert.match(c, /const byFire = \(pos\) => !!nearestFire\(camps\.map\(\(c\) => c\.rec\), pos, now\(\)\)\n\s*\|\| hearthNear\(worldFires\(\), pos, BY_FIRE_REACH\);/, 'both pools, the cheap question of the big one (AUDIT F2)');
  // ...and campAt does NOT - a hearth is not a camp, and the menu,
  // the pack and the online record all key on a camp record.
  assert.match(c, /const campAt = \(pos\) => nearestFire\(camps\.map\(\(c\) => c\.rec\), pos, now\(\)\);/, 'campAt stays the camps’ own');
  // a host that passes no door has no world fires, which is every
  // caller's behaviour before this shipped
  assert.match(c, /const worldFires = \(\) => \(survivalOn\(\) && hearths \? hearths\(\) : null\);/, 'and a host that passes no door has no world fires - as every caller did before this shipped');
});

test('HEARTH1: the pool really does answer byFire and cook off a bare hearth list', async () => {
  const { createCamps } = await import('../src/scenes/camps.js');
  const hearths = [{ x: 10, y: 0, z: 10, foot: -1.6, w: 0.8, h: 1.6 }];
  const said = [];
  const pool = createCamps({ hearths: () => hearths, say: (l) => said.push(l), entity: { items: [] } });
  assert.equal(pool.byFire([10, 0, 10]), true, 'standing in it');
  assert.equal(pool.byFire([10, 0, 10 + BY_FIRE_REACH - 0.01]), true, 'within the reach');
  assert.equal(pool.byFire([10, 0, 10 + BY_FIRE_REACH + 1]), false, 'and out of it');
  assert.equal(pool.campAt([10, 0, 10]), null, 'but it is not a CAMP - nothing to pack, stoke or publish');
  // the ray sees it, at a camp's own reach
  const t = pool.targets();
  assert.equal(t.length, 1, 'one target for one fire');
  assert.equal(t[0].key, 'hearth:0');
  assert.equal(t[0].reach, CAMP_REACH);
  assert.deepEqual(t[0].aabb, hearthAabb(hearths[0]), 'FIX-D: the box is the SPRITE its collector measured, standing on its foot');
  // Info names it; a cook with nothing raw says so rather than throwing
  assert.equal(pool.activate('hearth:0', 'info'), true);
  assert.equal(said.at(-1), CAMP_TEXT.seeHearth);
  assert.equal(pool.activate('hearth:0', 'grab'), true);
  assert.equal(said.at(-1), CAMP_TEXT.nothingToCook);
  assert.equal(pool.activate('hearth:9', 'grab'), true, 'a stale index still resolves to the cooking list, never a throw');
  // and a pool with NO door is exactly what it was before
  const bare = createCamps({ entity: { items: [] } });
  assert.equal(bare.byFire([0, 0, 0]), false);
  assert.deepEqual(bare.targets(), []);
});

test('HEARTH1: a hearth makes a rest a CAMP rest, which is the whole of SURV4 reading byFire', async () => {
  const { restKind, REST_KIND } = await import('../src/systems/survival/rest.js');
  assert.equal(restKind({ byFire: true }), REST_KIND.Camp, 'a fire is a camp’s rest, wherever the fire came from');
  assert.equal(restKind({ byFire: false }), REST_KIND.Rough);
  // ...and the three hosts that own a camp pool read it through the
  // same `camps.byFire`, so none of them needed a second wire
  for (const [f, what] of [['src/scenes/world.js', 'the streaming host'], ['src/scenes/exterior.js', 'the fixed city'], ['src/scenes/dungeonContext.js', 'the dungeon']]) {
    assert.match(read(f), /camps\.byFire\(/, `${what} reads the pool`);
  }
});

test('HEARTH1: warmth and drying follow, because they are the same reader', async () => {
  const { feltTemperature } = await import('../src/systems/survival/temperature.js');
  const base = { climateIndex: 231, month: 11, hour: 2, weather: 'snow', inSunlight: false };
  const cold = feltTemperature({ ...base, byFire: false });
  const warm = feltTemperature({ ...base, byFire: true });
  assert.ok(warm.felt > cold.felt, 'a fire is warmer than no fire');
  assert.equal(cold.fire, 0, 'no fire is no term');
  assert.equal(warm.fire, 15, 'and it is the law’s own fifteen degrees, not a new number');
  assert.match(read('src/systems/survival/needs.js'), /if \(env\.byFire \|\| env\.insideBuilding\) dry \+= 2;/, 'the drying rides the same flag');
});


// ---- AUDIT HEARTH1 (2026-09-19) - four findings over the slice ------------

test('AUDIT HEARTH1 F1: the world\u2019s fires are behind the mod\u2019s own switch', async () => {
  const { createCamps } = await import('../src/scenes/camps.js');
  const { setPref } = await import('../src/systems/uiPrefs.js');
  const { SURVIVAL_PREF, survivalOn } = await import('../src/systems/survival/switch.js');
  // The camps never needed a gate here: nothing can be PLACED with the
  // mod off, so the pool is empty and answers no by itself. A brazier is
  // in the world either way - without the gate a fire bowl answered the
  // activation ray with a cooking list and reported byFire to a law
  // nobody had turned on. "Off, every seam is DFU's" is the arc's own
  // sentence, and this is where it was about to stop being true.
  const before = survivalOn();
  const pool = createCamps({ hearths: () => [{ x: 0, y: 0, z: 0, foot: -1, w: 1, h: 1 }], entity: { items: [] }, say: () => {} });
  try {
    setPref(SURVIVAL_PREF, true);
    assert.equal(pool.byFire([0, 0, 0]), true, 'with the mod ON, a fire is a fire');
    assert.equal(pool.targets().length, 1, '...and the ray sees it');
    setPref(SURVIVAL_PREF, false);
    assert.equal(pool.byFire([0, 0, 0]), false, 'with the mod OFF, there is no such law to answer');
    assert.deepEqual(pool.targets(), [], '...and nothing to activate');
  } finally { setPref(SURVIVAL_PREF, before); }
  assert.match(read('src/scenes/camps.js'), /const worldFires = \(\) => \(survivalOn\(\) && hearths \? hearths\(\) : null\);/, 'one gate, at the one door');
});

test('AUDIT HEARTH1 F2: byFire takes the FIRST fire in reach, because it runs every frame', () => {
  // `nearestHearth` cannot stop - it has to see every entry to know
  // which is nearest - and byFire does not want the nearest, it wants a
  // yes. The player ticker calls its host's survivalEnv on EVERY frame
  // (the ticker decides whether a minute rolled, not the caller), so a
  // city's lantern list was being walked end to end sixty times a second
  // for a question whose answer was in the first entry.
  let seen = 0;
  const list = [];
  for (let i = 0; i < 500; i++) list.push({ get x() { seen++; return i === 0 ? 0 : 900; }, y: 0, z: 0 });
  assert.equal(hearthNear(list, [0, 0, 0], BY_FIRE_REACH), true);
  assert.equal(seen, 1, `stopped at the first fire in reach, after ${seen} reads`);
  // ...and it agrees with nearestHearth everywhere it is asked
  const fires = [{ x: 9, y: 0, z: 0 }, { x: 3, y: 0, z: 0 }, { x: 0, y: 0, z: 30 }];
  for (const p of [[0, 0, 0], [3, 0, 0], [6, 0, 0], [50, 0, 50], [0, 0, 26]]) {
    assert.equal(hearthNear(fires, p, BY_FIRE_REACH), !!nearestHearth(fires, p, BY_FIRE_REACH), `the two agree at ${p}`);
  }
  // the live-count argument, for a caller that refills a pool
  const pooled = [{ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }];
  assert.equal(hearthNear(pooled, [0, 0, 0], BY_FIRE_REACH, 0), false, 'nothing live is no fire, whatever the pool still holds');
  assert.equal(nearestHearth(pooled, [0, 0, 0], BY_FIRE_REACH, 0), null);
  assert.match(read('src/scenes/camps.js'), /\|\| hearthNear\(worldFires\(\), pos, BY_FIRE_REACH\)/, 'byFire asks the cheap question');
  // and the streaming host's walk is a POOL, not a fresh list a frame
  const w = read('src/scenes/world.js');
  assert.match(w, /const _hearthStore = \[\];/, 'the objects are kept');
  assert.match(w, /_hearthStore\[n\] \?\? \(_hearthStore\[n\] = \{ x: 0, y: 0, z: 0, foot: 0, w: 0, h: 0 \}\)/, '...and refilled in place');
  assert.doesNotMatch(w, /const out = \[\];\n\s*const eye = walkMode/, 'the per-frame array is gone');
});

test('AUDIT HEARTH1 F3: the three hosts measure a hearth\u2019s height differently, and each says where its SPRITE stands', () => {
  // Each collector puts its light where DFU's AddLight puts it, and
  // that is a different height on the sprite in each case - they are
  // each right about where the FLAME is. FIX-D: so the eye's box is not
  // hung off the flame at all. Each collector hands the sprite's base
  // in its own convention, beside the light it already placed.
  assert.match(read('src/world/cityLights.js'), /y: -obj\.yPos \* GLOBAL_SCALE \+ size\.h,/, 'the exterior pair: the light at the TOP of the flat');
  assert.match(read('src/world/cityLights.js'), /foot: -obj\.yPos \* GLOBAL_SCALE, w: size\.w, h: size\.h,/, '...and the flat standing on -yPos');
  assert.match(read('src/world/interiorLights.js'), /y: f\.y \+ h \/ 2 \+ offset,/, 'the interior: the centre, plus a per-record offset');
  assert.match(read('src/world/interiorLights.js'), /foot: f\.y, w, h,/, '...and the flat standing on its y');
  assert.match(read('src/scenes/dungeonContext.js'), /const based = centers\.map\(\(\[x, y, z\]\) => \[x, y - size\.h \/ 2, z\]\);/, 'a dungeon flat\u2019s stored y is its CENTRE - its own batch shifts down to find the base');
  assert.match(read('src/scenes/dungeonContext.js'), /foot: size \? f\.y - size\.h \/ 2 : undefined/, '...and the hearth takes the same half-height down');
  assert.match(read('src/systems/survival/hearth.js'), /AUDIT HEARTH1 F3 - WHERE A HEARTH IS, VERTICALLY/, 'and the law says so');
});

test('AUDIT HEARTH1 F4: the law\u2019s collection is used, not exported for its own test', () => {
  // `collectHearths` shipped exported and called by nothing but this
  // file, beside three hand-written copies of the test it performs.
  assert.match(read('src/scenes/worldModes.js'), /collectHearths\(ctx\.lights\)/, 'the interior takes the law\u2019s own');
  assert.equal(collectHearths([{ record: 20, x: 1, y: 2, z: 3 }, { record: 22, x: 0, y: 0, z: 0 }]).length, 1);
});
