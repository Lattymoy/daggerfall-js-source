// ROCK-SUNK (2026-10-02, the field: "Insane glitched geometry over at Hadus"; "yeahhh mountains be buggin rn").
// WOD-BUSH (2026-10-01) stood World of Daggerfall's model 60610 on the drawn ground, for the bandit camps' shrubs - but
// the rock fields build their outcrops of the same model: 157 of its 202 placements are boulders scaled 5.6 to 95 and
// set into the piles on purpose, and standing those on their lowest corner raised them as dark shards up to 377 m tall round every
// rock field (Hadus sits among them). The shrub alone is stood now: a Rocks or Mountains site keeps the mod's height
// (world/worldOfDaggerfall/wodLocationObjects.js isWodShrub, scenes/world.js's WoD loop). Pinned on the shipped layouts and packs through
// the real producer (WodWorld.picksFor / placements); with ARENA2_PATH, the lift the boulders took, off the real mesh.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

import { isWodShrub, WOD_BUSH_MODEL, WOD_ROCK_SITES, objectMatrix } from '../../../src/world/worldOfDaggerfall/wodLocationObjects.js';
import { WodWorld } from '../../../src/world/worldOfDaggerfall/worldOfDaggerfall.js';
import { loadLocationPrefab } from '../../../src/world/worldOfDaggerfall/wodLocationData.js';
import { decodeRegionPack } from '../../../src/world/worldOfDaggerfall/wodLocationPack.js';
import { LocationSession } from '../../../src/world/worldOfDaggerfall/wodLocationLoader.js';
import { transformedAabb } from '../../../src/render/frustum.js';
import { hostText } from '../../hostText.mjs';   // HOST-SPLIT 2: the world host whole

const V = new URL('../../../vendor/world-of-daggerfall/', import.meta.url).pathname;
const src = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');
const packOf = (r) => { try { return new Uint8Array(readFileSync(join(V, 'Locations', `${r}.bin`))); } catch { return null; } };
const prefabTexts = () => new Map(readdirSync(join(V, 'LocationPrefab')).map((f) => [f.replace('.txt', ''), readFileSync(join(V, 'LocationPrefab', f), 'utf8')]));
const ARENA2 = process.env.ARENA2_PATH;
const skipReal = !ARENA2 || !existsSync(ARENA2) ? 'ARENA2_PATH not set or missing - the real 60610 mesh skipped' : false;

/** Every 60610 placement of the shipped layouts, by layout. */
function bushPlacements() {
  const out = [];
  for (const [name, text] of prefabTexts()) {
    for (const o of loadLocationPrefab(text).obj) if (o.type === 0 && Number(o.name) === WOD_BUSH_MODEL) out.push({ name, o });
  }
  return out;
}

test('ROCK-SUNK: the camps\' shrub stands on the ground; a rock field\'s or a massif\'s boulder of the same model keeps the mod\'s height', () => {
  assert.deepEqual(WOD_ROCK_SITES, ['Rocks', 'Mountains']);
  for (const site of ['Bandits', 'Ruins', 'Shrine']) assert.equal(isWodShrub(WOD_BUSH_MODEL, site), true, `a ${site} site's 60610 is the shrub`);
  for (const site of ['Rocks', 'Mountains']) assert.equal(isWodShrub(WOD_BUSH_MODEL, site), false, `a ${site} site's 60610 is a boulder`);
  assert.equal(isWodShrub(60711, 'Bandits'), false, 'only the shrub model is stood');
});

test('ROCK-SUNK: the mod\'s own site names part the layouts - Rocks and Mountains stand exactly the rock layouts, and every 60610 those carry is a boulder', () => {
  const s = new LocationSession();
  for (const f of readdirSync(join(V, 'Locations'))) s.appendRegion(Number(f.replace('.bin', '')), decodeRegionPack(packOf(f.replace('.bin', ''))));
  const kind = new Map();   // prefab -> the site names that stand it
  for (let i = 0; i < s.count; i++) {
    const k = kind.get(s.prefab[i]) ?? new Set();
    k.add(s.name[i]); kind.set(s.prefab[i], k);
  }
  for (const [prefab, names] of kind) {
    assert.equal(names.size, 1, `${prefab} is stood under one name`);
    const rock = /^WOD_(?:Rocks_|Mountain_)/.test(prefab);
    assert.equal(WOD_ROCK_SITES.includes([...names][0]), rock, `${prefab} (${[...names][0]}) is ${rock ? '' : 'not '}a rock site`);
  }
  // the 202 placements: 45 shrubs in the camps, the nature spot and two ruins (scales 1.7 to 14.6, never sunk past 28 m);
  // 157 in the rock layouts (150 in the fields Rocks stands, 7 in the cave no instance names), scaled 5.6 to 95
  const all = bushPlacements();
  const rock = all.filter((p) => /^WOD_(?:Rocks_|Mountain_)/.test(p.name)), shrub = all.filter((p) => !/^WOD_(?:Rocks_|Mountain_)/.test(p.name));
  assert.deepEqual([all.length, shrub.length, rock.length], [202, 45, 157]);
  assert.equal(rock.filter((p) => kind.has(p.name)).length, 150, 'the stood fields carry 150 of them');
  const big = (o) => Math.max(Math.abs(o.scale.x), Math.abs(o.scale.y), Math.abs(o.scale.z));
  assert.ok(rock.every((p) => big(p.o) >= 5.5), 'a rock layout\'s 60610 is a boulder, 5.6 to 95 times the pebble');
  assert.ok(rock.filter((p) => p.o.pos.y < -50).length >= 50, 'and many sit deep in the ground on purpose');
  assert.ok(shrub.every((p) => big(p.o) <= 15 && p.o.pos.y > -28), 'a camp\'s is a shrub at the site\'s level');
});

test('ROCK-SUNK on the real producer: round Hadus a rock field\'s 60610s keep the mod\'s height and a bandit camp\'s are stood', async () => {
  const w = new WodWorld({ regions: () => [], pack: async (r) => packOf(r), prefabs: async () => prefabTexts() }, { warn: () => {}, schedule: () => {} });
  await w.open();
  w.noteRegion(46);   // Myrkwasa, Hadus's region
  await w.settle();
  const stood = (x, y) => {
    const picks = w.picksFor({ mapPixelX: x, mapPixelY: y, hasLocation: false, mapRegionIndex: -1, worldHeight: 20 });
    const bushes = w.placements(picks, picks.map(() => 0.17)).models.filter((m) => m.modelId === WOD_BUSH_MODEL);
    return { names: picks.map((p) => p.name), bushes: bushes.length, grounded: bushes.filter((m) => isWodShrub(m.modelId, picks[m.pick].name)).length };
  };
  // (297,427) and (296,427) stand the outcrops east of the town (WOD_Rocks_Large_03, _04r2), (297,428) a small field
  for (const [x, y] of [[297, 427], [296, 427], [297, 428]]) assert.deepEqual(stood(x, y), { names: ['Rocks'], bushes: 4, grounded: 0 }, `(${x},${y})`);
  assert.deepEqual(stood(291, 428), { names: ['Bandits'], bushes: 3, grounded: 3 }, 'WOD_BanditCamp_02 west of it');
});

test('ROCK-SUNK by source: the WoD loop asks isWodShrub with the pick\'s own site name, and the rock sites are one list', () => {
  const w = hostText('src/scenes/world.js');
  assert.match(w, /if \(isWodShrub\(m\.modelId, wodPicks\[m\.pick\]\?\.name\)\) \{[^\n]*\n\s+const dy = lowestGroundUnder\(samples, box\) - box\[1\];/);
  assert.match(w, /const rockPick = \(i\) => WOD_ROCK_SITES\.includes\(wodPicks\[i\]\?\.name\);/);
  assert.doesNotMatch(w, /=== 'Rocks'|=== 'Mountains'|WOD_BUSH_MODEL/, 'no second spelling of either');
});

test('ROCK-SUNK on the real mesh: WOD-BUSH raised the rock fields\' 60610s by tens to hundreds of metres', { skip: skipReal }, async () => {
  const { Arch3dFile } = await import('../../../src/formats/arch3dFile.js');
  const { dfMeshToModel } = await import('../../../src/world/meshReader.js');
  const arch = new Arch3dFile();
  arch.load(new Uint8Array(readFileSync(join(ARENA2, 'ARCH3D.BSA'))));
  const P = dfMeshToModel(arch.getMesh(arch.getRecordIndex(WOD_BUSH_MODEL)), () => ({ width: 64, height: 64 })).positions;
  const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
  for (let v = 0; v < P.length; v += 3) for (let k = 0; k < 3; k++) { mn[k] = Math.min(mn[k], P[v + k]); mx[k] = Math.max(mx[k], P[v + k]); }
  // on ground level with the site, WOD-BUSH's lift is the box's depth under it; the piece then stood its whole height
  const rows = bushPlacements().filter((p) => /^WOD_Rocks_/.test(p.name)).map(({ o }) => {
    const b = transformedAabb([...mn, ...mx], objectMatrix([o.pos.x, o.pos.y, o.pos.z], o.rot, o.scale));
    return { lift: -b[1], tall: b[4] - b[1] };
  });
  assert.equal(rows.filter((r) => r.lift > 100).length, 70, 'seventy raised more than 100 m');
  assert.ok(Math.abs(Math.max(...rows.map((r) => r.tall)) - 377) < 1, 'the tallest stood 377 m');
});
