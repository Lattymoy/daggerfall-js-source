// BOOT2 (2026-09-20, Mac: "overall performance improvements", after BOOT1):
// A CURSOR MUST NOT NEED THE HUD TO CONVERT A BITMAP. With the four hosts
// behind doors (BOOT1), the entry's static graph was still 259 files and
// 4.9 MB of source, and ONE edge carried 216 files / 4.1 MB of it:
// ui/cursor.js imported `bitmapToColor32` - a pure palette lookup - from
// ui/hud/hud.js, and the HUD imports the enhanced HUD, which imports the world
// tick, which imports the game. The helper is a formats concern and lives
// in formats/color32Order.js now, with every importer repointed and hud.js
// importing it back like everyone else.
//
// Three laws, each derived from the tree rather than listed:
//   1. ONE HOME - exactly one definition, in the leaf; nobody imports it
//      from hud.js and hud.js exports it to nobody (a re-export would put
//      the hub edge back for whoever took the shortcut).
//   2. The cursor is a LEAF - it imports formats and nothing under ui/.
//   3. The entry's static reach neither touches the two hubs this slice
//      found (ui/hud/hud.js, systems/worldTick.js) nor exceeds a ceiling that
//      the measurement set: 43 files after the cut, held under 60.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const rd = (p) => readFileSync(join(root, p), 'utf8');
const STATIC = /^\s*(?:import\s[^'"]*?from\s*|import\s*|export\s[^'"]*?from\s*)['"]([^'"]+)['"]/gm;
const resolveSpec = (from, spec) => { if (!spec.startsWith('.')) return null; const p = resolve(dirname(from), spec); for (const c of [p, p + '.js']) { try { if (statSync(c).isFile()) return c; } catch { /* next */ } } return null; };
const walk = (d, out = []) => { for (const n of readdirSync(d)) { const p = join(d, n); if (statSync(p).isDirectory()) walk(p, out); else if (/\.m?js$/.test(n)) out.push(p); } return out; };
function staticReach(entry) {
  const seen = new Set(); const q = [resolve(root, entry)];
  while (q.length) { const f = q.pop(); if (seen.has(f)) continue; seen.add(f); let s; try { s = readFileSync(f, 'utf8'); } catch { continue; } for (const m of s.matchAll(STATIC)) { const t = resolveSpec(f, m[1]); if (t && /\.m?js$/.test(t) && !seen.has(t)) q.push(t); } }
  return seen;
}

test('BOOT2: bitmapToColor32 has ONE home, the formats leaf - nobody takes it from the HUD and the HUD hands it to nobody', () => {
  const defs = walk(join(root, 'src')).filter((f) => /^export (?:function|const) bitmapToColor32\b/m.test(readFileSync(f, 'utf8'))).map((f) => relative(root, f));
  assert.deepEqual(defs, ['src/formats/color32Order.js'], 'the definition is in exactly one place, and it is the leaf');
  const hud = rd('src/ui/hud/hud.js');
  assert.doesNotMatch(hud, /export\s*\{[^}]*\bbitmapToColor32\b/, 'hud.js re-exports it - the hub edge is back for whoever takes the shortcut');
  assert.match(hud, /import \{ bitmapToColor32 \} from '\.\.\/\.\.\/formats\/color32Order\.js';/, 'hud.js imports it from the leaf like every other caller');
  const fromHud = [];
  for (const f of [...walk(join(root, 'src')), ...walk(join(root, 'test'))]) {
    const s = readFileSync(f, 'utf8');
    if (/import\s*\{[^}]*\bbitmapToColor32\b[^}]*\}\s*from\s*'[^']*\/hud\.js'/.test(s)) fromHud.push(relative(root, f));
  }
  assert.deepEqual(fromHud, [], 'these still import bitmapToColor32 from hud.js');
});

test('BOOT2: the cursor is a leaf - formats in, nothing from ui/', () => {
  const cursor = rd('src/ui/cursor.js');
  const imports = [...cursor.matchAll(STATIC)].map((m) => m[1]);
  assert.ok(imports.length >= 2, `cursor.js imports ${imports.length} modules - re-read this pin`);
  const fromUi = imports.filter((s) => /^\.\/|\/ui\//.test(s));
  assert.deepEqual(fromUi, [], 'ui/cursor.js imports from ui/ - the entry installs the cursor, so whatever it imports is on the boot path');
});

test('BOOT2: the entry\'s static reach touches neither hub and stays under the ceiling the cut measured', () => {
  const reach = new Set([...staticReach('src/main.js')].map((f) => relative(root, f)));
  for (const hub of ['src/ui/hud/hud.js', 'src/systems/worldTick.js', 'src/ui/enhanced/enhancedHud.js']) {
    assert.ok(!reach.has(hub), `${hub} is on the entry's static graph again (${reach.size} files reached)`);
  }
  // 259 before the cut, 43 after; the ceiling leaves room for a real need and none for a hub.
  // PERF-URL (2026-09-29): 61 - the renderer's own static graph had grown the reach to exactly 60 by then, and
  // systems/pageQuery.js (the one parse every URL door reads through - onlineLane, uiSkin, the render doors) is a leaf
  // that imports nothing, so it can bring no hub with it (the hub law above is what holds that). The ceiling moves to
  // 64: the same promise, room for a real need, measured again.
  // ECOTONE1 (2026-10-07): 66 - the terrain programs' border chunk (render/ecotoneGlsl.js, which TERRAIN_FS is built from
  // as the renderer loads) and the law it takes its numbers from (world/ecotone.js). Both are leaves - the chunk imports
  // the law alone and the law imports nothing - so neither can bring a hub, and the assertion below keeps them so. The
  // ceiling moves to 68: the same promise, room for a real need, measured again.
  // WINDFALL1 (2026-10-08): 69 - Windfall's wind law in the billboard program (render/windfallSway.js: the GLSL chunk BB_VS
  // is built from as the renderer loads, and the uniforms the renderer, the shadow pass and the air pass feed it). A leaf
  // that imports nothing, so it can bring no hub, and the assertion below keeps it so. The ceiling moves to 71.
  // RW1 (2026-10-09): 73 - the real windows' block in both mesh programs (render/realWindows.js: the GLSL FS and
  // EL_MESH_FS are built from as the renderer loads) and the rooms' art it paints from (world/windowRoomArt.js, a leaf).
  // realWindows.js reads only what is already on the path (the prefs, the skin, the page's query) beside the art; the
  // interior glass rule and its climate tables were split out to world/interior/interiorGlass.js to stay off it. The ceiling moves
  // to 73.
  // MWNPC1 (2026-10-09, met at the MW-NPC arc's merge of main, 2026-10-10): 74 - the GPU skin's palette shape
  // (render/skinPalette.js: the entries a row and the unit, which CHAR_SKIN_VS is built from as the renderer loads, and
  // which formats/morrowind/mwGpuSkin.js writes by). A leaf that imports nothing, so it can bring no hub, and the assertion below
  // keeps it so. The branch measured 70 under WINDFALL1's 71; RW1's 73 on main took the room. The ceiling moves to 74.
  // FAR-SEA1 (2026-10-10): 75 - the horizon's haze (render/horizonHaze.js: the GLSL the water surface and the lane's far
  // ring are built from as the renderer loads). A leaf that imports nothing, so it can bring no hub, and the assertion
  // below keeps it so. The ceiling moves to 75.
  // GATHER-FEEL II (2026-10-13, VEIN-CRACKS): 77 - a worked vein's crack (systems/veinCrack.js: the GLSL both billboard
  // programs are built from as the renderer loads, beside the batch field the gathering host writes - DISSOLVE's shape).
  // A leaf that imports nothing, so it can bring no hub, and the assertion below keeps it so. The ceiling moves to 77.
  // HORSE-TIERS (2026-10-15, PIN MOVED): 78 - the upkeep tiers (systems/upkeep/upkeepTiers.js: what the `horseCare` key - and,
  // WAGON-TIERS, the `wagonUpkeep` key - may hold, which the prefs shelf's load reads to move an old switch's value to
  // its tier and drop one that names none - SURV-TIERS' way, whose survival/difficulty.js the load reads beside it). A
  // leaf that imports nothing, so it can bring no hub, and the assertion below keeps it so. The ceiling moves to 78.
  // LIGHT-ID (2026-10-14, PIN MOVED at the FIELD BUGS 2026-10-14 merge): 79 - the frame's light list's one seam
  // (render/lightId.js: a light's identity beside its place, read by the renderer and the shadow pass as they load).
  // Its branch put it on the boot path and left the ceiling at 77 (78 reached there - this pin failed on it alone);
  // HORSE-TIERS' branch moved the ceiling to 78 without it; the merged tree reaches main's 77 and both - recounted on
  // the merged tree, 79. A leaf that imports nothing, so it can bring no hub, and the assertion below keeps it so. The
  // ceiling moves to 79.
  const importsOf = (p) => [...rd(p).matchAll(STATIC)].map((m) => m[1]);
  assert.deepEqual([importsOf('src/render/ecotoneGlsl.js'), importsOf('src/world/ecotone.js'), importsOf('src/render/windfallSway.js')], [['../world/ecotone.js'], [], []],
    'the border chunk and its law, and the wind law, stay leaves on the boot path');
  assert.deepEqual([importsOf('src/world/windowRoomArt.js'), importsOf('src/render/realWindows.js')], [[], ['../systems/uiPrefs.js', '../systems/uiSkin.js', '../systems/pageQuery.js', '../world/windowRoomArt.js']],
    'RW1: the rooms\' art a leaf, the windows\' block reading only the path it already stands on');
  assert.deepEqual(importsOf('src/render/skinPalette.js'), [], 'MWNPC1: the palette\'s shape a leaf');
  assert.deepEqual(importsOf('src/render/horizonHaze.js'), [], 'FAR-SEA1: the horizon\'s haze a leaf');
  assert.deepEqual(importsOf('src/systems/veinCrack.js'), [], 'GATHER-FEEL II: the vein\'s crack a leaf');
  assert.deepEqual(importsOf('src/systems/upkeep/upkeepTiers.js'), [], 'HORSE-TIERS / WAGON-TIERS: the upkeep tiers a leaf');
  assert.deepEqual(importsOf('src/render/lightId.js'), [], 'LIGHT-ID: the light list\'s seam a leaf');
  // WEAPON-GLOW1 (2026-10-16): 81 - a weapon's element drawn (render/weaponGlowGlsl.js: the GLSL and numbers the
  // renderer builds the sprite outline's and the Morrowind pass's programs from). A leaf that imports nothing, so it can
  // bring no hub, and the assertion below keeps it so. The ceiling moves to 81.
  assert.deepEqual(importsOf('src/render/weaponGlowGlsl.js'), [], 'WEAPON-GLOW1: the glow\'s drawing a leaf');
  // BANTHA1 (2026-10-18): 82 - the jungle's haze law (render/hazeGlsl.js: the GLSL the fog block, the far ring of both
  // lanes and the four skies are built from as the renderer loads - fogGlsl.js's one import). A leaf that imports
  // nothing, so it can bring no hub, and the assertion below keeps it so. The ceiling moves to 82.
  assert.deepEqual(importsOf('src/render/hazeGlsl.js'), [], 'BANTHA1: the jungle\'s haze law a leaf');
  // PRECIP4 (2026-10-19): 83 - the ground's snow (render/snowCoverGlsl.js: the GLSL both terrain programs are built from
  // as the renderer loads, and a twin set's summer half). A leaf that imports nothing, so it can bring no hub, and the
  // assertion below keeps it so. The ceiling moves to 83.
  assert.deepEqual(importsOf('src/render/snowCoverGlsl.js'), [], 'PRECIP4: the ground\'s snow a leaf');
  // BOOT-RECTS (2026-10-20): 84 - the world-data door's getter (formats/worldData/worldDataDoor.js), which the terrain
  // tiles' rect reader asks whether a layout pin stands where a walk reads (terrainTiles.js locationRectReader). A leaf
  // that imports nothing, so it can bring no hub, and the assertion below keeps it so. The ceiling moves to 84.
  assert.deepEqual(importsOf('src/formats/worldData/worldDataDoor.js'), [], 'BOOT-RECTS: the world-data door\'s getter a leaf');
  // MID-RING (2026-10-26): 86 - a just-built pixel's tint eased out (render/pixelFade.js: the law the ground's draw reads
  // as the renderer loads, the pixel's build stamps). A leaf that imports nothing, so it can bring no hub, and the
  // assertion below keeps it so. The ceiling moves to 86.
  assert.deepEqual(importsOf('src/render/pixelFade.js'), [], 'MID-RING: the pixel\'s ease a leaf');
  // PEAKS1 (2026-10-26, bible/03-World/Peaks.md): 87 - the bare face (render/snowCapGlsl.js: the GLSL both terrain programs
  // shed a steep face's snow to rock with, and the face's dials the law reads). A leaf that imports nothing, so it can
  // bring no hub, and the assertion below keeps it so. The ceiling moves to 87.
  assert.deepEqual(importsOf('src/render/snowCapGlsl.js'), [], 'PEAKS1: the bare face a leaf');
  // ROAD-LOOK (2026-10-27, bible/03-World/Roads.md ROAD-LOOK): 89 - a road's edge blended into its ground
  // (render/roadEdgeGlsl.js: the GLSL both terrain programs are built from as the renderer loads; world/road/roadEdge.js,
  // its law: the road's records, the dials, the water's records off the draw's table). Neither is a leaf: each imports
  // only what the path holds already (world/water/waterCorners.js, world/terrain/terrainTiles.js, and the switch's
  // systems/pageQuery.js and systems/uiSkin.js - the renderer's own reach), so they can bring no hub, and the assertion
  // below keeps them so. The ceiling moves to 89.
  assert.deepEqual([importsOf('src/render/roadEdgeGlsl.js'), importsOf('src/world/road/roadEdge.js')], [['../world/road/roadEdge.js', '../world/terrain/terrainTiles.js', '../systems/pageQuery.js', '../systems/uiSkin.js'], ['../water/waterCorners.js', '../terrain/terrainTiles.js']],
    'ROAD-LOOK: the road\'s edge and its law reach only the path\'s own modules');
  // COAST-LOOK (2026-10-28, bible/07-Rendering/Water-Arc.md COAST-LOOK): 92 - the ground's kinds blended and the sea cut on
  // their line (render/groundEdgeGlsl.js: the GLSL both terrain programs and the water's sheet are built from as the
  // renderer loads; world/terrain/groundEdge.js, its law: the transitions' corners off the marching squares' own table,
  // the dials). Neither is a leaf: each imports only what the path holds already (the tilemap's modules, the water's
  // corners, the road edge's noise, and the switch's systems/pageQuery.js and systems/uiSkin.js), so they can bring no
  // hub, and the assertion below keeps them so. The ceiling moves to 92.
  assert.deepEqual([importsOf('src/render/groundEdgeGlsl.js'), importsOf('src/world/terrain/groundEdge.js')], [['../world/terrain/groundEdge.js', '../world/terrain/terrainSurface.js', '../systems/pageQuery.js', '../systems/uiSkin.js'], ['./terrainTiles.js', './terrainSurface.js', '../water/waterCorners.js', '../road/roadEdge.js']],
    'COAST-LOOK: the ground\'s edge and its law reach only the path\'s own modules');
  // WL1 (2026-10-29, bible/07-Rendering/Real-Windows.md WL1): 94 - the windows' light (render/windowLight.js: the GLSL every
  // lit program of both sets is built from as the renderer loads, and the pass the renderer makes) and a mesh's glass
  // tile by tile (render/windowApertures.js, a leaf of no imports, which createMesh and a static batch's merge measure).
  // The first imports only what the path holds already beside it (LC1's grid, the rooms' art, the page's query), so
  // neither can bring a hub, and the assertion below keeps them so. The ceiling moves to 94.
  assert.deepEqual([importsOf('src/render/windowLight.js'), importsOf('src/render/windowApertures.js')], [['./lightClusters.js', '../world/windowRoomArt.js', '../systems/pageQuery.js', './windowApertures.js'], []],
    'WL1: the windows\' light reaches only the path\'s own modules, its apertures nothing');
  // 95 - the first ground set waits for a texture store still registering (systems/textureStoreGate.js). A leaf of no
  // imports, so it can bring no hub, and the assertion below keeps it so.
  assert.deepEqual(importsOf('src/systems/textureStoreGate.js'), [], 'the store gate a leaf');
  assert.ok(reach.size <= 95, `the entry statically reaches ${reach.size} files - BOOT2 measured 43, PERF-URL 61, ECOTONE1 66, WINDFALL1 69, RW1 73, MWNPC1 74, FAR-SEA1 75, LOOT-MARKS 76 (ui/lootTierMarks.js, a leaf of no imports: the enhanced sheet's quick-loot tier marks), GATHER-FEEL II 77 (systems/veinCrack.js, a leaf of no imports: a worked vein's crack), POI-2 78 (render/meshAlpha.js, a leaf of no imports: the mesh programs' translucency and a texture's own sampler - PIN MOVED), HORSE-TIERS 79 (systems/upkeep/upkeepTiers.js, a leaf of no imports: what the two upkeep keys may hold), LIGHT-ID 80 (render/lightId.js, a leaf of no imports: the frame's light list's one seam), WEAPON-GLOW1 81 (render/weaponGlowGlsl.js, a leaf of no imports: a weapon's element drawn), BANTHA1 82 (render/hazeGlsl.js, a leaf of no imports: the jungle's haze law), PRECIP4 83 (render/snowCoverGlsl.js, a leaf of no imports: the ground's snow), BOOT-RECTS 84 (formats/worldData/worldDataDoor.js, a leaf of no imports: the world-data door's getter), TOWN-SHAPES 85 (world/townShape.js, a leaf of no imports: a town's own outline, terrainTiles.js's), MID-RING 86 (render/pixelFade.js, a leaf of no imports: a just-built pixel's tint eased out), PEAKS1 87 (render/snowCapGlsl.js, a leaf of no imports: the bare face), ROAD-LOOK 89 (render/roadEdgeGlsl.js and world/road/roadEdge.js, a road's edge blended, reaching only the path's own modules), FLORA-GROUND 90 at their merge (world/lowPolyTrees.js, the sky's light a tree's faces take - its matte trees; the module imports nothing), COAST-LOOK 92 (render/groundEdgeGlsl.js and world/terrain/groundEdge.js, the ground's kinds blended, reaching only the path's own modules), WL1 94 (render/windowLight.js and render/windowApertures.js, the windows' light, reaching only the path's own modules), the store gate 95 (systems/textureStoreGate.js, a leaf of no imports: a texture store still registering), and holds the ceiling at 94`);   // PIN MOVED (GATHER-FEEL II): 76 -> 77; PIN MOVED (MID-RING): 85 -> 86; PIN MOVED (PEAKS1): 86 -> 87; PIN MOVED (ROAD-LOOK): 87 -> 89; PIN MOVED (FLORA-GROUND x ROAD-LOOK, at their merge into #1184): 89 -> 90; PIN MOVED (COAST-LOOK): 90 -> 92; PIN MOVED (WL1): 92 -> 94
});
