// WOD4 - WORLD OF DAGGERFALL: THE CAMP AT PRIVATEER'S HOLD.
//
// DungeonExterior finds "DaggerfallBlock [CUSTAA30.RMB]" every frame and
// PrivateersHold.Start builds the camp in the block's frame. The table in
// world/wodPrivateersHold.js is that Start as data, so the first pins
// READ THE VENDORED C# - every live CreateDaggerfallMeshGameObject, its
// localPosition and its Rotate; every billboard and its FireLight; every
// foe - and hold the table to it, in order, as floats. Then the rolls
// against a scripted stream, the matrix in Unity's frame, and the two
// hosts by source.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  PRIVATEERS_HOLD_BLOCK, HOLD_MODELS, HOLD_FLATS, HOLD_FIRE_LIGHT, HOLD_FOES,
  holdModelMatrix, holdFireLights, rollHoldFoes,
} from '../src/world/wodPrivateersHold.js';
import { FOE_MALE_CHANCE } from '../src/world/wodSpawner.js';
import { MOBILE_TYPES } from '../src/characters/mobileTypes.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const rd = (p) => readFileSync(join(ROOT, p), 'utf8');

/** The C#'s own numbers: `-89.99001f`, `3.099442e-06f`, `-210`. */
const num = (t) => Math.fround(parseFloat(t.trim().replace(/f$/, '')));
const vec = (s) => s.split(',').map(num);

/** PrivateersHold.cs, read the way the compiler reads it: comments out. */
function readStart() {
  const lines = rd('vendor/world-of-daggerfall/Scripts/PrivateersHold.cs').replace(/\r/g, '').split('\n')
    .map((l) => l.trim()).filter((l) => l && !l.startsWith('//'));
  const models = [], flats = [], foes = [], lights = [];
  let chances = 0, chanceTests = 0;
  for (const l of lines) {
    let m;
    if ((m = l.match(/CreateDaggerfallMeshGameObject\((\d+), ExtraDetail\.transform\)/))) models.push({ modelId: +m[1], pos: null, yawDeg: 0 });
    else if ((m = l.match(/^AreaDetail\.transform\.localPosition = new Vector3\((.*)\);$/))) models.at(-1).pos = vec(m[1]);
    else if ((m = l.match(/^AreaDetail\.transform\.Rotate\((.*)\);$/))) {
      const [x, y, z] = vec(m[1]);
      assert.deepEqual([x, z], [0, 0], 'every live Rotate turns about y alone');
      models.at(-1).yawDeg = y;
    } else if ((m = l.match(/CreateDaggerfallBillboardGameObject\((\d+), (\d+), ExtraDetail\.transform\)/))) flats.push({ archive: +m[1], record: +m[2], pos: null, fireLight: false });
    else if ((m = l.match(/^BillboardDetail\.transform\.localPosition = new Vector3\((.*)\);$/))) flats.at(-1).pos = vec(m[1]);
    else if (l === 'lightObject.transform.parent = BillboardDetail.transform;') flats.at(-1).fireLight = true;
    else if ((m = l.match(/^lightObject\.transform\.localPosition = new Vector3\((.*)\);$/))) lights.push({ lift: vec(m[1]) });
    else if ((m = l.match(/^light\.(range|intensity) = (.*);$/))) lights.at(-1)[m[1]] = num(m[2]);
    else if ((m = l.match(/^light\.color = new Color\((.*)\);$/))) lights.at(-1).color = vec(m[1]);
    else if ((m = l.match(/CreateFoeGameObjects\(ExtraDetail\.transform\.position, MobileTypes\.(\w+), 1, MobileReactions\.Hostile, null, false\)/))) foes.push({ type: m[1], pos: null });
    else if ((m = l.match(/^enemy\[0\]\.transform\.localPosition = new Vector3\((.*)\);$/))) foes.at(-1).pos = vec(m[1]);
    else if (/enemyChance = UnityEngine\.Random\.Range\(0, 30\);$/.test(l)) chances++;
    else if (l === 'if (enemyChance > 20)') chanceTests++;
  }
  return { models, flats, foes, lights, chances, chanceTests, lines };
}

test('WOD4: the models are Start\'s, in its order - id, local position and Rotate(0, deg, 0), as floats', () => {
  const { models } = readStart();
  assert.equal(models.length, 33);
  assert.deepEqual(HOLD_MODELS.map((m) => ({ modelId: m.modelId, pos: [...m.pos], yawDeg: m.yawDeg })), models);
  assert.equal(HOLD_MODELS[5].yawDeg, 0, 'the one Rotate commented out (:92) stands unturned');
});

test('WOD4: the flats are Start\'s, centred where it puts them; a FireLight rides each of the five fires', () => {
  const { flats, lights } = readStart();
  assert.equal(flats.length, 17);
  assert.deepEqual(HOLD_FLATS.map((h) => ({ archive: h.archive, record: h.record, pos: [...h.pos], fireLight: h.fireLight })), flats);
  assert.equal(lights.length, 5);
  for (const l of lights) {
    assert.deepEqual(l.lift, [0, HOLD_FIRE_LIGHT.lift, 0]);
    assert.equal(l.range, HOLD_FIRE_LIGHT.range);
    assert.equal(l.intensity, HOLD_FIRE_LIGHT.intensity);
    assert.deepEqual(l.color, [...HOLD_FIRE_LIGHT.color]);
  }
  const fires = holdFireLights();
  assert.deepEqual(fires.map((l) => l.pos), HOLD_FLATS.filter((h) => h.fireLight).map((h) => [h.pos[0], h.pos[1] + 1, h.pos[2]]), 'one unit over each fire\'s CENTRE');
  assert.ok(fires.every((l) => l.range === 20 && l.color.join() === [...HOLD_FIRE_LIGHT.color].join()));
  assert.equal(PRIVATEERS_HOLD_BLOCK, 'CUSTAA30.RMB');
  assert.match(rd('vendor/world-of-daggerfall/Scripts/DungeonExterior.cs'), /PrivateHold = GameObject\.Find\("DaggerfallBlock \[CUSTAA30\.RMB\]"\);/);
});

test('WOD4: the foes are Start\'s seven, one Range(0, 30) > 20 each; the loot containers are commented out', () => {
  const { foes, chances, chanceTests, lines } = readStart();
  assert.deepEqual([chances, chanceTests], [7, 7]);
  assert.deepEqual(HOLD_FOES.map((h) => ({ type: Object.keys(MOBILE_TYPES).find((k) => MOBILE_TYPES[k] === h.mobileType), pos: [...h.pos] })), foes);
  assert.ok(!lines.some((l) => /KamerCreateLootContainer\(1, 10/.test(l)), 'no live call reaches KamerCreateLootContainer');
});

const script = (...vals) => { let i = 0; return () => { if (i >= vals.length) throw new Error('rolled more than scripted'); return vals[i++]; }; };
const pick = (n, min, max) => (n - min + 0.5) / (max - min);

test('WOD4: the rolls - 21..29 of 0..29 stand a foe, which rolls CreateFoeGameObjects\' gender and then the facing', () => {
  const none = Array(7).fill(pick(20, 0, 30));
  assert.deepEqual(rollHoldFoes(script(...none)), [], '20 stands nobody, and no gender or facing is rolled');
  const out = rollHoldFoes(script(
    pick(21, 0, 30), FOE_MALE_CHANCE - 0.01, pick(179, 0, 180),   // the Thief at (83.2, 1, 38)
    pick(20, 0, 30),                                              // no Assassin
    0.999999, FOE_MALE_CHANCE, pick(0, 0, 180),                   // the top of Range(0, 30) is 29: a Thief
    pick(0, 0, 30), pick(0, 0, 30), pick(0, 0, 30), pick(0, 0, 30)));
  assert.deepEqual(out, [
    { mobileType: MOBILE_TYPES.Thief, pos: HOLD_FOES[0].pos, gender: 'male', yawDeg: 179 },
    { mobileType: MOBILE_TYPES.Thief, pos: HOLD_FOES[2].pos, gender: 'female', yawDeg: 0 },
  ]);
});

test('WOD4: a model\'s matrix is T * Euler(0, deg, 0) in Unity\'s frame - a quarter turn takes +z to +x', () => {
  const at = (m, v) => [0, 1, 2].map((r) => m[r] * v[0] + m[4 + r] * v[1] + m[8 + r] * v[2] + m[12 + r] * v[3]);
  const close = (a, b) => a.every((x, i) => Math.abs(x - b[i]) < 1e-6);
  const q = holdModelMatrix({ pos: [1, 2, 3], yawDeg: 90 });
  assert.ok(close(at(q, [0, 0, 1, 0]), [1, 0, 0]), 'forward turns right, clockwise from above');
  assert.ok(close(at(q, [1, 0, 0, 0]), [0, 0, -1]));
  assert.ok(close(at(q, [0, 0, 0, 1]), [1, 2, 3]), 'the local position');
  const a = holdModelMatrix({ pos: [0, 0, 0], yawDeg: -210 }), b = holdModelMatrix({ pos: [0, 0, 0], yawDeg: 150 });
  assert.ok(close([...a], [...b]), '-210 is 150');
});

test('WOD4: the streaming host stands the camp on the block, climate and colliders and all, and rolls on the first exterior frame', () => {
  const w = rd('src/scenes/world.js');
  assert.match(w, /if \(wod && b\.blockName === PRIVATEERS_HOLD_BLOCK\) holdBlocks\.push\(originMatrix\);   \/\/ WOD4/);
  const block = w.slice(w.indexOf('    let privateersHold = null;'), w.indexOf('    // SIB1: DaggerfallTerrain.OnInstantiateTerrain'));
  assert.match(block, /await remapSubMeshes\(gpu\.subMeshes, texRemap, climateArchive, pipeline\);/, 'the location re-skins every mesh under its blocks');
  assert.match(block, /const local = multiply\(origin, holdModelMatrix\(hm\)\);/);
  assert.match(block, /staticBuilder\.add\(cpu, local, resolveTexKey\);/);
  assert.match(block, /collider\.addMesh\(key, cpu\.positions, cpu\.indices, local, holdBucket\);/);
  assert.match(block, /addFlat\(hf\.archive, hf\.record, \.\.\.centredBase\(\[origin\[12\] \+ hf\.pos\[0\], origin\[13\] \+ hf\.pos\[1\], origin\[14\] \+ hf\.pos\[2\]\], billboardSize\(t, hf\.record\)\)\);/, 'no AlignToBase: centred');
  assert.match(block, /for \(const l of holdFireLights\(\)\) pixelWodLights\.push\(/, 'at every hour, on the per-light channel');
  assert.ok(w.indexOf('    let privateersHold = null;') < w.indexOf('const staticMerged = await staticBuilder.finishSliced('), 'into the batch before it is merged');   // PERF-EXT-C4: the merge breathes
  assert.match(w, /privateersHold,   \/\/ WOD4/);
  assert.match(w, /if \(p\.privateersHold && !p\.privateersHold\.state\.rolled\) \{[^\n]*\n[^\n]*\n[^\n]*\n\s*else \{ standHold\(p, hs\); wodSprang\(hs\); \}/);   // WOD7: unless a peer rolled it
  assert.match(w, /function standHold\(p, site = null\) \{\n\s*const st = p\.privateersHold\.state;\n\s*st\.rolled = true;/, 'Start runs once');
  assert.match(w, /exteriorFoes\.spawnFoe\(r\.mobileType, \[o\[0\] \+ r\.pos\[0\] \+ t\[0\], o\[1\] \+ r\.pos\[1\] \+ t\[1\], o\[2\] \+ r\.pos\[2\] \+ t\[2\]\], \{ yaw: r\.yawDeg \* Math\.PI \/ 180, gender: r\.gender, placed: true, groundAlign: \{ hitDist: null \}, site \}\)/, 'the local transform, placed');
  assert.match(w, /\.then\(\(f\) => \{ if \(!f\) return; if \(st\.gone\) exteriorFoes\.removeFoe\(f\); else st\.foes\.push\(f\); \}\)/, 'a foe that lands after its block went goes with it');
});

test('WOD4: an unload takes the camp\'s foes; a rebuild the reference never makes carries the markers and the camp; a sweep drops the carry', () => {
  const w = rd('src/scenes/world.js');
  assert.match(w, /if \(collectLoose && p\.privateersHold\) \{ p\.privateersHold\.state\.gone = true; for \(const f of p\.privateersHold\.state\.foes\) exteriorFoes\.removeFoe\(f\); \}/, 'an unload takes the camp\'s foes');
  assert.match(w, /\} else \{\n\s*if \(p\.wodSite\) _wodSiteWas\.add\(key\);[^\n]*\n\s*if \(p\.wodSpawners \|\| p\.privateersHold\) carryWodSite\(p, key, \{ hold: p\.privateersHold\?\.state \?\? null \}\);/, 'a rebuild carries the markers and the camp');
  assert.match(w, /wodCarry\.set\(key, \{ spawners, hold, piles, life: p\.wodLife \}\);/);
  assert.match(w, /const carried = wodCarry\.get\(key\) \?\? null;[^\n]*\n\s*wodCarry\.delete\(key\);/);
  assert.match(w, /state: \{ rolled: false, foes: \[\], gone: false \} \};[^\n]*\n/, 'a fresh roll...');
  assert.match(w, /if \(privateersHold && carried\.hold\) privateersHold\.state = carried\.hold;/, '...which a carried one replaces at publish (AUDIT BRANCH (WoD) m4)');
  const tp = w.slice(w.indexOf('async function _teleportToPixel('), w.indexOf('queue.length = 0;', w.indexOf('async function _teleportToPixel(')));
  assert.match(tp, /exteriorFoes\.clearLive\(\);\n\s*wodCarry\.clear\(\);/, 'the sweep is an unload');
});

test('WOD4: the probe host stands the same camp in its fixed frame, lights it at every hour in its own colour, and rolls once; THE FOUR HOSTS', () => {
  const x = rd('src/scenes/exterior.js');
  assert.match(x, /if \(holdOn && b\.blockName === PRIVATEERS_HOLD_BLOCK\) \{\n\s*for \(const hm of HOLD_MODELS\) modelIds\.add\(hm\.modelId\);\n\s*for \(const hf of HOLD_FLATS\) archives\.add\(hf\.archive\);/, 'the loads');
  assert.match(x, /if \(holdOn && b\.blockName === PRIVATEERS_HOLD_BLOCK\) holdBlocks\.push\(originMatrix\);   \/\/ WOD4/);
  assert.match(x, /collider\.addMesh\('world', cpu\.positions, cpu\.indices, matrix\);   \/\/ CreateDaggerfallMeshGameObject's MeshCollider/);
  assert.match(x, /flatGroups\.get\(k\)\.push\(centredBase\(\[origin\[12\] \+ hf\.pos\[0\], origin\[13\] \+ hf\.pos\[1\], origin\[14\] \+ hf\.pos\[2\]\], billboardSize\(t, hf\.record\)\)\);/);
  assert.match(x, /const lit = withPlayerLights\(holdSel \? holdSel\.data : lightsOn/);
  assert.match(x, /holdSel \? wodLightColors\(lit\.length \/ 4, lit\.length \/ 4 - holdSel\.data\.length \/ 4, holdSel\.colors, CITY_LIGHT_COLOR_F32\) : null\);/);
  assert.match(x, /if \(!lanternsOn\) return nearestLights\(holdLights, eye, renderer\.maxPointLights, _holdOnlyRanges, \(l\) => l\.color\);/, 'the fires by day, the lanterns only at night');
  assert.match(x, /tickHold\(\);   \/\/ WOD4[^\n]*\n\s*tickCityGates\(minute\);/);
  assert.match(x, /if \(holdRolled \|\| !holdBlocks\.length\) return;\n\s*holdRolled = true;/, 'once');
  assert.match(x, /exteriorFoes\.spawnFoe\(r\.mobileType, \[o\[12\] \+ r\.pos\[0\], o\[13\] \+ r\.pos\[1\], o\[14\] \+ r\.pos\[2\]\], \{ yaw: r\.yawDeg \* Math\.PI \/ 180, gender: r\.gender, placed: true, groundAlign: \{ hitDist: null \} \}\)/);
  // worldModes.js and dungeonContext.js stand interiors and dungeons - no exterior block, no camp
  for (const f of ['src/scenes/worldModes.js', 'src/scenes/dungeonContext.js']) assert.doesNotMatch(rd(f), /PRIVATEERS_HOLD_BLOCK|wodPrivateersHold/, `${f} is flagged, not wired`);
  assert.match(rd('bible/03-World/World-Of-Daggerfall.md'), /## The camp at Privateer's Hold \(WOD4\)/);
});
