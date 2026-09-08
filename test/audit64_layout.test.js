// AUDIT 64 - the BLOCK AND DUNGEON LAYOUT lane.
//
// Seven laws, each pinned against the REFERENCE's own value rather than
// against what the port happens to say:
//   F11 RMBLayout's StaticBuilding array + DaggerfallStaticBuildings.HasHit
//       + PlayerActivate.ActivateBuilding
//   F12 exterior EDITOR flats (archive 199) are stood but never rendered
//   F13 RDB NPC flats become StaticNPCs (Context.Dungeon) and click targets
//   F14 DaggerfallCityGate's 18:00/06:00 model swap
//   F15 FindClosestEnterMarker accepts Rest (199.4) as well as Enter (199.8)
//   F16 fixed treasure (archive 216) is placed at the marker, not grounded
//   F17 the ladder AND the furniture-action chain are ObjectType == 3 only
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { GLOBAL_SCALE } from '../src/world/meshReader.js';
import { staticBuildingBox, staticBuildingWorldAabb, staticBuildingsHasHit } from '../src/world/staticBuildings.js';
import { isCityGate, CITY_GATE_OPEN_MODEL_ID, CITY_GATE_CLOSED_MODEL_ID } from '../src/world/rmbLayout.js';
import { makeCityGate, updateCityGate } from '../src/world/cityGate.js';
import { collectBlockFlats, EDITOR_FLATS_ARCHIVE } from '../src/world/rmbFlats.js';
import { isNpcFlat, NPC_FLAT_ARCHIVES } from '../src/world/rdbLayout.js';
import { layoutInterior, INTERIOR_MARKER, PROP_MODEL_TYPE } from '../src/world/interiorLayout.js';
import { trs } from '../src/world/mat4.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = (p) => readFileSync(join(root, p), 'utf8');

// ---------------------------------------------------------------------------
// F11 - the StaticBuilding array and its hit test.
// ---------------------------------------------------------------------------

test('AUDIT 64 F11: the StaticBuilding box IS the model\'s world extent (Size and points share pointDivisor)', () => {
  // RMBLayout.cs:873-874:
  //   size   = new Vector3(DFMesh.Size.X, .Y, .Z) * MeshReader.GlobalScale
  //   centre = new Vector3(0, DFMesh.Size.Y / 2, 0) * GlobalScale
  //
  // DFMesh.Size and the DFMesh POINTS are divided by the SAME
  // Arch3dFile pointDivisor, so that box is the model's world
  // silhouette and nothing else. Chain, all in API/Arch3dFile.cs:
  //   :39        `const float pointDivisor = 256.0f`
  //   :695-697   the RAW native x/y/z go into PureMesh.Planes[].Points[]
  //   :711-713   size = (maxX / pointDivisor - minX / pointDivisor), off
  //              those same raw extremes
  //   :714/:846  PureMesh.Size -> records[record].DFMesh.Size
  //   :935/:941-943  WritePoint, "Vector coordinates are divided by
  //              256.0f", divides the SAME raw points by the SAME
  //              pointDivisor into the DFMesh point buffer
  // and MeshReader.cs:717 lays the vertices down off that buffer as
  // `new Vector3(dfPoint.X, -dfPoint.Y, dfPoint.Z) * scale`.
  //
  // So this pin holds the box against the REFERENCE's vertex extent,
  // recomputed here from the reference's own arithmetic: a box scaled
  // by any extra divisor (or sized off some other AABB convention) is
  // a departure, not a repair.
  const POINT_DIVISOR = 256;                 // Arch3dFile.cs:39
  const rawPoints = [                        // native ARCH3D point values
    { x: -512, y: 0, z: -256 },
    { x: 3584, y: 2048, z: -256 },
    { x: 3584, y: 2048, z: 768 },
    { x: -512, y: 700, z: 768 },
  ];
  const ext = (sel) => {
    const v = rawPoints.map(sel);
    return { min: Math.min(...v), max: Math.max(...v) };
  };
  const ex = ext((p) => p.x), ey = ext((p) => p.y), ez = ext((p) => p.z);
  // Arch3dFile.cs:711-713 - this is DFMesh.Size.
  const dfMeshSize = {
    x: ex.max / POINT_DIVISOR - ex.min / POINT_DIVISOR,
    y: ey.max / POINT_DIVISOR - ey.min / POINT_DIVISOR,
    z: ez.max / POINT_DIVISOR - ez.min / POINT_DIVISOR,
  };
  // MeshReader.cs:717 over the WritePoint-divided buffer - the vertices.
  const verts = rawPoints.map((p) => [
    (p.x / POINT_DIVISOR) * GLOBAL_SCALE,
    -(p.y / POINT_DIVISOR) * GLOBAL_SCALE,
    (p.z / POINT_DIVISOR) * GLOBAL_SCALE,
  ]);
  const vext = (k) => {
    const v = verts.map((q) => q[k]);
    return Math.max(...v) - Math.min(...v);
  };
  const b = staticBuildingBox(dfMeshSize);
  // The formula RMBLayout.cs:873-874 writes...
  assert.deepEqual(b.size, [
    dfMeshSize.x * GLOBAL_SCALE, dfMeshSize.y * GLOBAL_SCALE, dfMeshSize.z * GLOBAL_SCALE]);
  assert.deepEqual(b.centre, [0, (dfMeshSize.y / 2) * GLOBAL_SCALE, 0]);
  // ...IS the model's world extent, on all three axes.
  for (const k of [0, 1, 2]) {
    assert.ok(Math.abs(b.size[k] - vext(k)) < 1e-9,
      `axis ${k}: box ${b.size[k]} must equal the vertex extent ${vext(k)}`);
  }
  // A model this ARCH3D does not carry gives the zero box, C#'s struct
  // default - never a throw.
  assert.deepEqual(staticBuildingBox(null).size, [0, 0, 0]);
});

test('AUDIT 64 F11: `firstModel` is per PLACED BLOCK, so a repeated block still gets its buildings', () => {
  // RMBLayout.cs:819-820 `doorsOut = new List<StaticDoor>(); buildingsOut
  // = new List<StaticBuilding>();` - AddModels' output lists are FRESH on
  // every call, and AddModels is called once per placed block. :824-832
  // then puts `bool firstModel = true;` INSIDE the per-subrecord loop,
  // scoped to that one call. Nothing in DFU is keyed on
  // `blockData.Index` (the BLOCKS.BSA record), which is shared by every
  // grid cell holding the same block name - and RMB blocks repeat all
  // over a town. A location-wide latch keyed on that index therefore
  // gives the FIRST placement its buildings and every repeat none.
  // :187-193 settles it: the buildings AddModels returned are stamped
  // `MakeBuildingKey((byte)layoutX, (byte)layoutY, (byte)recordIndex)`,
  // so a building's identity is (cell x, cell y, subrecord).
  //
  // Both outdoor hosts carry the law, so both are checked: the latch is
  // declared INSIDE the per-block loop, and its key never mentions the
  // block-file index.
  const hosts = [
    ['src/scenes/exterior.js', 'firstModelOfRecord', 'for (const b of loc.blocks) {'],
    ['src/scenes/world.js', 'pixelFirstModel', 'for (const b of loc.blocks) {'],
  ];
  for (const [file, latch, loopOpen] of hosts) {
    const t = src(file);
    // Anchor on the READ, then walk backwards: the block loop this latch
    // is consulted inside, and the nearest declaration above it. Both
    // hosts open more than one `for (const b of loc.blocks)`.
    const use = t.indexOf(`${latch}.has(`);
    assert.ok(use > 0, `${file}: ${latch} is read`);
    const loop = t.lastIndexOf(loopOpen, use);
    const decl = t.lastIndexOf(`const ${latch} = new Set()`, use);
    assert.ok(loop > 0, `${file}: the per-block loop is above the latch`);
    assert.ok(decl > loop,
      `${file}: the ${latch} latch must be created INSIDE the per-block loop (RMBLayout.cs:824-832 puts \`firstModel\` in AddModels, which runs once per PLACED block with a fresh buildingsOut, :819-820) - a location-wide one strands every repeated block`);
    // The key is the subrecord index alone. `dfBlock.index` in it is the
    // exact collision this law forbids.
    const keyLine = t.slice(t.lastIndexOf('const rk =', use), use);
    assert.ok(!keyLine.includes('dfBlock.index'),
      `${file}: the StaticBuilding latch key must not be keyed on the BLOCKS.BSA record index`);
  }
});

test('AUDIT 64 F11: HasHit is the WORLD AABB of the rotated 1.01 box, not an oriented box', () => {
  // DaggerfallStaticBuildings.cs:73-86 sets c.size = size * 1.01f on a
  // BoxCollider rotated by the model matrix and then asks
  // `c.bounds.Contains(point)` - and Collider.bounds is the world
  // AXIS-ALIGNED bounds of that rotated box. A 45-degree yaw therefore
  // WIDENS the test to the box's diagonal; an oriented-box test would be
  // tighter than DFU on every rotated shop.
  const box = { size: [2, 4, 2], centre: [0, 2, 0] };
  const flat = staticBuildingWorldAabb(box, trs(0, 0, 0, 0, 0, 0));
  assert.ok(Math.abs(flat.max[0] - 1.01) < 1e-6, 'axis aligned: half of size*1.01');
  assert.ok(Math.abs(flat.min[1] - (2 - 2.02)) < 1e-6, 'centre.y raises the box off the base');
  const spun = staticBuildingWorldAabb(box, trs(0, 0, 0, 0, 45, 0));
  assert.ok(spun.max[0] > flat.max[0] * 1.4,
    'the world AABB of a 45-degree box reaches its diagonal (an OBB test would not)');
  // HasHit takes the FIRST match and breaks (:82-87).
  const a = { aabb: { min: [0, 0, 0], max: [1, 1, 1] } };
  const b = { aabb: { min: [0, 0, 0], max: [2, 2, 2] } };
  assert.equal(staticBuildingsHasHit([a, b], [0.5, 0.5, 0.5]), a);
  assert.equal(staticBuildingsHasHit([a, b], [1.5, 1.5, 1.5]), b);
  assert.equal(staticBuildingsHasHit([a, b], [9, 9, 9]), null);
});

test('AUDIT 64 F11: both exterior hosts stand the array, and the arm does NOT consume the click', () => {
  for (const p of ['src/scenes/exterior.js', 'src/scenes/world.js']) {
    const s = src(p);
    assert.ok(s.includes("from '../world/staticBuildings.js'"), `${p} builds the array`);
    assert.ok(/buildingTargets\(\)/.test(s) || /buildingTargets:/.test(s), `${p} exposes it`);
    assert.ok(s.includes('dfMeshSize(placed.modelIdNum)'),
      `${p} sizes the box from DFMesh.Size, the reference's own field`);
  }
  const m = src('src/scenes/worldModes.js');
  // PlayerActivate.cs:341-361 runs the building test on the ONE ray's hit
  // point and FALLS THROUGH to the static-door check at :364-368. A
  // `building:` key in the activation target set would let the enclosing
  // box out-distance the door it contains and swallow every entry click.
  assert.equal(/key: `building:/.test(m), false, 'the building never competes as a pick target');
  assert.ok(m.includes('staticBuildingsHasHit(list, ['), 'the box test runs on the ray hit point');
  assert.ok(m.includes("if (getInteractionMode() !== 'info') return;"),
    'ActivateBuilding is Info-only (PlayerActivate.cs:461)');
  const arm = m.slice(m.indexOf('function activateBuilding'), m.indexOf('async function tryEnter'));
  assert.ok(arm.includes('bd.buildingType < BUILDING_TYPES.Temple')
    && arm.includes('bd.buildingType !== BUILDING_TYPES.HouseForSale'),
  'the closed popup gate is :473-474');
  assert.ok(arm.includes('is closed. Open from ${OPEN_HOURS[bd.buildingType]}:00 to ${CLOSE_HOURS[bd.buildingType]}:00.'),
    'Internal_Strings.csv:36-37, ":00" suffixes and all');
  assert.ok(arm.includes("? 'Guild' : 'Store'"), 'GuildHall gets guildClosed, everything else storeClosed');
  // BuildingIsUnlocked is evaluated ONCE (PlayerActivate.cs:358) and
  // handed to both arms - one helper, never a thinner second copy.
  assert.equal((m.match(/buildingIsUnlocked\(bd, \{/g) ?? []).length, 1);
});

// ---------------------------------------------------------------------------
// F12 - editor flats are stood as data and never drawn.
// ---------------------------------------------------------------------------

test('AUDIT 64 F12: a MISC archive-199 flat is kept and flagged; a SUBRECORD one is never made', () => {
  const scenery = Array.from({ length: 16 }, () =>
    Array.from({ length: 16 }, () => ({ textureRecord: -1 })));
  const block = {
    rmbBlock: {
      fldHeader: { groundData: { groundScenery: scenery } },
      miscFlatObjectRecords: [
        // CUSTAA30.RMB's shape: the location START marker, 199/10.
        { textureArchive: EDITOR_FLATS_ARCHIVE, textureRecord: 10, xPos: 100, yPos: 50, zPos: 200, factionID: 0, flags: 0, position: 7 },
        { textureArchive: 201, textureRecord: 3, xPos: 10, yPos: 5, zPos: 20, factionID: 0, flags: 0, position: 8 },
      ],
      subRecords: [{
        xPos: 0, zPos: 0,
        exterior: { blockFlatObjectRecords: [{ textureArchive: EDITOR_FLATS_ARCHIVE, textureRecord: 10, xPos: 1, yPos: 1, zPos: 1 }] },
      }],
    },
  };
  const flats = collectBlockFlats(block, 504);
  // AddMiscBlockFlats (RMBLayout.cs:340-379) skips ONLY the lights
  // archive, so the marker is still stood - locationStartMarkers reads
  // exactly these. It is DaggerfallBillboard.Start that hides it
  // (:77-84, FlatTypes.Editor from MaterialReader.cs:980-981, and
  // StartGameBehaviour.cs:45 `ShowEditorFlats = false`).
  const marker = flats.find((f) => f.archive === EDITOR_FLATS_ARCHIVE && f.record === 10);
  assert.ok(marker, 'the 199/10 start marker survives collection');
  assert.equal(marker.editor, true);
  assert.equal(flats.find((f) => f.archive === 201).editor, false);
  // The SUBRECORD loop is a genuinely different law - RMBLayout.cs:409-410
  // never spawns that one at all - so exactly one 199 flat came back.
  assert.equal(flats.filter((f) => f.archive === EDITOR_FLATS_ARCHIVE).length, 1);
});

test('AUDIT 64 F12: neither exterior host batches a flat the Billboard would have hidden', () => {
  for (const p of ['src/scenes/exterior.js', 'src/scenes/world.js']) {
    assert.ok(src(p).includes('if (flat.editor) continue;'),
      `${p} keeps the editor flat out of its billboard batch (a rmbFlats-only pin would stay green here)`);
  }
  // ...and the marker path still reads them.
  assert.ok(src('src/world/locationEntrance.js').includes('199'),
    'locationStartMarkers still filters the very flats being hidden');
});

// ---------------------------------------------------------------------------
// F13 - RDB NPC flats.
// ---------------------------------------------------------------------------

test('AUDIT 64 F13: NPCFlatArchives is RDBLayout.cs:1250-1254, verbatim', () => {
  assert.deepEqual([...NPC_FLAT_ARCHIVES],
    [334, 346, 357, 175, 176, 177, 178, 179, 180, 181, 182, 183, 184]);
  assert.equal(isNpcFlat(334), true);
  assert.equal(isNpcFlat(184), true);
  assert.equal(isNpcFlat(185), false);
  assert.equal(isNpcFlat(199), false);
});

test('AUDIT 64 F13: the layout carries SetLayoutData(RdbObject) inputs, and the hosts click them', () => {
  const l = src('src/world/rdbLayout.js');
  // StaticNPC.cs:149-151 hashes the RAW, UN-NEGATED XPos/YPos/ZPos (the
  // billboard's -YPos is the render transform only), and :154 seeds the
  // name off the FLAT RESOURCE's stream position, not obj.Position.
  assert.ok(l.includes('rawX: obj.xPos, rawY: obj.yPos, rawZ: obj.zPos,'),
    'the un-negated record ints ride the flat');
  assert.ok(l.includes('flatPosition: fr.position,'),
    'nameSeed reads the flat resource offset, not the object offset');
  assert.ok(l.includes('factionID: fr.factionOrMobileId, flags: fr.flags,'));
  const d = src('src/scenes/dungeonContext.js');
  assert.ok(d.includes('context: NPC_CONTEXT.Dungeon,'),
    'StaticNPC.cs:159 - the ONLY producer of Context.Dungeon, which topicTree reads');
  assert.ok(d.includes('const setup = opts.setupStaticNpc?.(f, host);')
    && d.includes('if (setup === false) continue;'),
  'SetupIndividualStaticNPC runs at layout for EVERY flat with a faction, and the away arm withholds the billboard (RDBLayout.cs:1233-1236, QuestMachine.cs:1334-1341)');
  assert.ok(d.includes('npcTargets()'), 'the context exposes the people');
  // PlayerActivate.cs:745-751 - an NPC "carrying specific non-dialog
  // actions" is never activated as a person.
  assert.ok(d.includes('ACTION_FLAGS.ShowText') && d.includes('ACTION_FLAGS.ShowTextWithInput'));
  const m = src('src/scenes/worldModes.js');
  assert.ok(m.includes('const dNpcs = dungeonCtx.npcTargets?.() ?? [];'),
    'the dungeon ray carries person: targets at last');
  assert.ok(m.includes('activateStaticNpc(dNpcs[Number(key.split(\':\')[1])]);'));
  // ...and the hook reaches the DUNGEON mount specifically. A bare
  // `m.includes('setupStaticNpc,')` also matches the INTERIOR mount, so
  // it cannot see the dungeon one being deleted: slice the
  // buildDungeonContext call's own options block.
  const mountStart = m.indexOf('await buildDungeonContext(');
  assert.ok(mountStart > 0, 'worldModes mounts buildDungeonContext');
  const mount = m.slice(mountStart, m.indexOf('dungeonCtx = ctx;', mountStart));
  assert.ok(mount.includes('setupStaticNpc,'),
    'RDBLayout.cs:1233-1236 runs SetupIndividualStaticNPC for the DUNGEON layout too, so the hook must be in buildDungeonContext\'s own options');
});

test('AUDIT 64 F13: a dungeon static NPC\'s bootstrap behaviour reaches BOTH behaviour collectors', () => {
  // RDBLayout.cs:1228-1237 adds a StaticNPC component to every NPC flat
  // and then calls `QuestMachine.Instance.SetupIndividualStaticNPC(go,
  // factionID)` on that SAME GameObject, so the bootstrap
  // QuestResourceBehaviour it attaches is an ordinary scene component:
  //  - GameObjectHelper.cs:926 `Resources.FindObjectsOfTypeAll
  //    <QuestResourceBehaviour>()` - the list IsAlreadyPlaced reads, so
  //    a Person already bootstrapped onto a palace guard is NOT stood a
  //    second time by the marker walk; and
  //  - ActiveGameObjectDatabase.cs:308-311
  //    GetActiveStaticNPCQuestResourceBehaviours, which sees it because
  //    StaticNPC.cs:127 registers EVERY StaticNPC with the cache -
  //    Context.Dungeon ones included.
  // The dungeon context must therefore hand its raw people list out;
  // npcTargets() is the RAY's filtered view and serves neither.
  const d = src('src/scenes/dungeonContext.js');
  assert.ok(d.includes('\n    people,\n'),
    'buildDungeonContext exposes the raw static-NPC list, not only npcTargets()');
  const m = src('src/scenes/worldModes.js');
  const scene = m.slice(m.indexOf('const sceneBehaviours = () => {'), m.indexOf('const activeStaticNpcQuestBehaviours'));
  assert.ok(scene.includes('dungeonCtx?.people'),
    'FindObjectsOfTypeAll (GameObjectHelper.cs:926) sees the dungeon static NPCs too');
  const cache = m.slice(m.indexOf('const activeStaticNpcQuestBehaviours = () => {'));
  const cacheBody = cache.slice(0, cache.indexOf('\n  };'));
  assert.ok(cacheBody.includes('dungeonCtx?.people'),
    'the static-NPC cache (ActiveGameObjectDatabase.cs:308-311) holds them too - StaticNPC.cs:127 registers every StaticNPC');
});

// ---------------------------------------------------------------------------
// F14 - the city gates.
// ---------------------------------------------------------------------------

test('AUDIT 64 F14: IsCityGate accepts BOTH variants (RMBLayout.cs:1007-1011)', () => {
  assert.equal(CITY_GATE_OPEN_MODEL_ID, 446);
  assert.equal(CITY_GATE_CLOSED_MODEL_ID, 447);
  assert.equal(isCityGate(446), true);
  assert.equal(isCityGate(447), true);
  assert.equal(isCityGate(41739), false);
});

test('AUDIT 64 F14: DaggerfallCityGate.Update is a state machine, not an IsNight->model map', () => {
  // DaggerfallCityGate.cs:19 `bool isOpen = true`; :44-51
  //   if (isNight && isOpen || !isNight && !isOpen) Toggle();
  // A block that laid the CLOSED model at NOON therefore keeps 447
  // standing - the day arm does nothing on the first frame, and only the
  // first 18:00 -> 06:00 cycle opens it. A `!isNight => 446` mapping
  // would open that gate a whole day early.
  const closedByDay = makeCityGate(CITY_GATE_CLOSED_MODEL_ID);
  assert.equal(updateCityGate(closedByDay, false), false, 'daytime frame one: no toggle');
  assert.equal(closedByDay.modelId, CITY_GATE_CLOSED_MODEL_ID, 'the block data still decides');
  // Night acts on frame one, which is what closes a location entered at 20:00.
  const openAtDusk = makeCityGate(CITY_GATE_OPEN_MODEL_ID);
  assert.equal(updateCityGate(openAtDusk, true), true);
  assert.equal(openAtDusk.modelId, CITY_GATE_CLOSED_MODEL_ID);
  assert.equal(openAtDusk.isOpen, false);
  assert.equal(updateCityGate(openAtDusk, true), false, 'idempotent while the hour holds');
  assert.equal(updateCityGate(openAtDusk, false), true, 'dawn opens it again');
  assert.equal(openAtDusk.modelId, CITY_GATE_OPEN_MODEL_ID);
  // ...and the day-placed closed gate opens on its first NIGHT->day cycle.
  assert.equal(updateCityGate(closedByDay, true), true);
  assert.equal(closedByDay.modelId, CITY_GATE_CLOSED_MODEL_ID);
  assert.equal(updateCityGate(closedByDay, false), true);
  assert.equal(closedByDay.modelId, CITY_GATE_OPEN_MODEL_ID);
});

test('AUDIT 64 F14: both hosts swap the DRAW mesh AND the collider, in a bucket of the gate\'s own', () => {
  for (const p of ['src/scenes/exterior.js', 'src/scenes/world.js']) {
    const s = src(p);
    assert.ok(s.includes('updateCityGate(g.gate, night)'), `${p} runs Update()`);
    assert.ok(s.includes('collider.removeBucket(g.bucketKey);'),
      `${p} re-points the collider - GameObjectHelper.cs:246-250 changes the MeshCollider too, so a closed gate BLOCKS`);
    assert.ok(/gate:/.test(s), `${p} gives the gate a private collider bucket`);
    assert.ok(s.includes('tickCityGates(minute);'), `${p} ticks it every frame, as DFU's Update is`);
  }
  // Both variants resident before the first swap - the streaming loader
  // is async and a mid-frame fetch cannot swap in place.
  assert.ok(src('src/scenes/exterior.js').includes('modelIds.add(CITY_GATE_CLOSED_MODEL_ID);'));
  assert.ok(src('src/scenes/world.js').includes('const otherGpu = await getGpuMesh(otherId);'));
});

// ---------------------------------------------------------------------------
// F15 - the Rest-marker fallback.
// ---------------------------------------------------------------------------

test('AUDIT 64 F15: FindClosestEnterMarker accepts Rest (199.4) as well as Enter (199.8)', () => {
  // DaggerfallInterior.cs:63-69 gives the enum, :242-246 the clause:
  //   // Sometimes marker 199.4 is used where the 199.8 enter marker should be
  //   if (markers[i].type != Enter && markers[i].type != Rest) continue;
  assert.equal(INTERIOR_MARKER.REST, 4);
  assert.equal(INTERIOR_MARKER.ENTER, 8);
  const c = src('src/scenes/interiorContext.js');
  assert.ok(c.includes('.filter((m) => m.type === INTERIOR_MARKER.ENTER || m.type === INTERIOR_MARKER.REST)'),
    'the enterMarkers union, or a building carrying only a 199.4 marker finds no marker at all');
  // The other marker consumers still read `markers` by EXACT type - the
  // union is enterMarkers' alone.
  assert.ok(c.includes('.filter((m) => m.type === INTERIOR_MARKER.TREASURE)'));
});

// ---------------------------------------------------------------------------
// F16 - fixed treasure keeps the marker's exact position.
// ---------------------------------------------------------------------------

test('AUDIT 64 F16: a 216 pile is centred on its marker; only the RANDOM pile is grounded', () => {
  const d = src('src/scenes/dungeonContext.js');
  assert.ok(d.includes('lootPiles.push({ pos: [m.x + b.originX, m.y, m.z + b.originZ], record, items, isFixed, batch: null });'),
    'the flag survives onto the pile, which is its identity for the pickup box and the save re-mint');
  // AssignFixedTreasure passes adjustPosition:false (RDBLayout.cs:427,
  // "use exact position"), so :1583-1584's -randomTreasureMarkerDim/2,
  // :1619-1620's AlignBillboardToGround and GameObjectHelper.cs:686-687's
  // +Summary.Size.y/2 are ALL skipped.
  assert.ok(d.includes('? [pile.pos[0], pile.pos[1] - size.h / 2, pile.pos[2]]'),
    'the centred, unadjusted transform in this batch\'s bottom-anchored spelling');
  assert.ok(d.includes(': floorLanding(collider, [pile.pos[0], pile.pos[1] + 0.2, pile.pos[2]]);'),
    'the RANDOM arm keeps AlignBillboardToGround (RDBLayout.cs:1619-1620)');
  // pile.half is set BEFORE the branch, so lootTargets and restorePiles
  // read one consistent record.
  assert.ok(d.indexOf('pile.half = [size.w / 2, size.h / 2];') < d.indexOf('const g = pile.isFixed'));
});

// ---------------------------------------------------------------------------
// F17 - ObjectType == propModelType gates the ladder and the furniture.
// ---------------------------------------------------------------------------

test('AUDIT 64 F17: layoutInterior carries ObjectType, and 41409 climbs only as a prop', () => {
  assert.equal(PROP_MODEL_TYPE, 3);   // DaggerfallInterior.cs:31
  const model = { positions: new Float32Array([0, 1, 0, 0, -0.5, 0]), doors: [] };
  const dfBlock = {
    rmbBlock: {
      subRecords: [{
        interior: {
          header: { num3dObjectRecords: 2 },
          block3dObjectRecords: [
            // The windmill's own three ladders are ObjectType 3; this is
            // the pair DaggerfallInterior.cs:492 discriminates between.
            { modelIdNum: 41409, objectType: 3, xPos: 0, yPos: 0, zPos: 0, xRotation: 0, yRotation: 0, zRotation: 0 },
            { modelIdNum: 41409, objectType: 0, xPos: 40, yPos: 0, zPos: 0, xRotation: 0, yRotation: 0, zRotation: 0 },
          ],
          blockFlatObjectRecords: [],
          blockDoorRecords: [],
        },
      }],
    },
  };
  const out = layoutInterior(dfBlock, 0, 0, () => model);
  assert.deepEqual(out.placements.map((p) => p.objectType), [3, 0],
    'objectType rides every placement - DFU gates TWO clauses on it');
  const c = src('src/scenes/interiorContext.js');
  assert.ok(c.includes('if (p.modelIdNum === LADDER_MODEL_ID && p.objectType === PROP_MODEL_TYPE) {'),
    'DaggerfallInterior.cs:491-496 - :439 keeps EVERY 41409 standalone scenery, only the DaggerfallLadder is withheld');
  assert.ok(c.includes('if (p.objectType !== PROP_MODEL_TYPE) continue;'),
    'DaggerfallInterior.cs:500 gates the whole AddFurnitureAction chain on the same clause');
  assert.ok(c.indexOf('if (p.objectType !== PROP_MODEL_TYPE) continue;') < c.indexOf('if (isShopShelfModel(p.modelIdNum)) {'),
    'and it sits ahead of the shelf/house-container chain it gates');
});
