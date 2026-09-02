// ROAD-C c2/S9: THE INTERIOR-BUILDING AUTOMAP ARM.
//
// Every law here is DFU's, and most of them look like port bugs - which
// is exactly why they are pinned as LAWS and not as incidental
// agreement between two sets. A building's map is always in colour, it
// starts fully hidden with an entrance beacon that was lit and then put
// out one statement later, it has no micro-map, it opens in cutout, and
// nothing it records survives the door. A later reader who "fixes" any
// of those breaks parity, and each pin below names the C# that says so.
//
// THE SEQUENCE PINS ARE THE POINT. The entrance beacon's state is
// driven step by step - SetupBeacons, then HideAll, then the LOS tick -
// because three different orderings produce three different maps and
// only one of them is DFU's. A pin on the final state alone would pass
// against a port that never lit the beacon at all.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  enterInteriorAutomap, exitInteriorAutomap, getInteriorAutomap,
  setupInteriorEntranceBeacon, hideAllAutomap, automapEntranceTick,
  automapRevealTick, enterDungeonAutomap, getDungeonAutomap, automapDungeonKey,
  snapshotAutomap, resetAutomapStore, buildRevealIndex,
} from '../src/systems/automap.js';
import { INTERIOR_ELEMENT_NAMES, ELEMENT_MODELS, ELEMENT_DOORS } from '../src/systems/automapModel.js';
import {
  AutomapWindow, signalAutomapReset, resetAutomapWindowState,
  automapRenderMode, _setAutomapArt,
} from '../src/ui/automapWindow.js';
import { AUTOMAP_MODE } from '../src/render/renderer.js';
import { setValue, _resetForTests } from '../src/systems/settings.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = (p) => readFileSync(join(ROOT, p), 'utf8');
const ARENA2 = process.env.ARENA2_PATH;
const skipReal = !ARENA2 || !existsSync(ARENA2)
  ? 'ARENA2_PATH not set or missing - real-data validation skipped'
  : false;

// ── the window harness (the c2/S5 shape) ─────────────────────────────
const FONT = { fnt: { fixedWidth: 6, fixedHeight: 7, glyphWidth: () => 5 }, tex: 'atlas' };
const CANVAS = { width: 320, height: 200 };
const fakeArt = () => ({
  bg: { tex: 'AMAP00I0', w: 320, h: 200 },
  grid3d: { tex: 'AMAP01I0', w: 27, h: 19 },
  compass: { tex: 'COMPASS', w: 322, h: 13 },
  compassBox: { tex: 'COMPBOX', w: 69, h: 17 },
});

function stubRenderer(log) {
  return {
    canvas: CANVAS,
    uploadTexture: (a, k) => `tex:${a}/${k}`,
    releaseTexture: () => {},
    createBillboardBatch: () => ({}),
    destroyBillboardBatch: () => {},
    createMesh: (model) => ({ stub: true, subMeshes: model.subMeshes }),
    destroyMesh: () => {},
    drawBillboards: (...a) => log.push(['drawBillboards', ...a]),
    drawMesh: (...a) => log.push(['drawMesh', ...a]),
    drawMeshWire: (...a) => log.push(['drawMeshWire', ...a]),
    drawScreenQuad: (tex, dst, srcUv, color) => log.push(['quad', tex, { ...dst }, srcUv, color]),
    setClipY: (y) => log.push(['setClipY', y]),
    setAutomapMode: (m) => log.push(['setAutomapMode', m]),
    setAutomapWater: (lvl, rgba) => log.push(['setAutomapWater', lvl, rgba]),
    setFog: (m) => log.push(['setFog', m]),
    setLighting: (a, s) => log.push(['setLighting', [...a], s]),
    setMoonlight: (m) => log.push(['setMoonlight', m]),
    setLightDir: () => {}, setThirdLight: () => {}, uploadLighting: () => {},
    setPointLights: (d) => log.push(['setPointLights', d.length]),
    setIndirectLight: (p, range) => log.push(['setIndirectLight', [...p], range]),
    setWindowEmission: (e) => log.push(['setWindowEmission', [...e]]),
    panelFrame: ({ rect, setup }, body) => {
      log.push(['panelFrame', { ...rect }]);
      setup?.();
      body();
      log.push(['endPanelFrame']);
    },
  };
}

/** Three interior rows, all REVEALED and NONE marked visited-this-run -
 *  the shape a naive port would paint grayscale. */
const threeRows = () => {
  const keys = ['int:0', 'int:1', 'int:2'];
  const drawList = keys.map((key, i) => ({ mesh: `mesh${i}`, matrix: `m${i}`, key, aabb: { min: [i, 0, 0], max: [i + 1, 2, 1] } }));
  const rec = {
    revealed: new Set(keys),
    visitedThisRun: new Set(),   // deliberately empty
    entranceDiscovered: false,
    notes: new Map(), teleporters: new Map(),
  };
  return { keys, drawList, rec };
};

const winDeps = (over = {}) => ({
  record: () => ({ revealed: new Set(), visitedThisRun: new Set(), entranceDiscovered: false, notes: new Map(), teleporters: new Map() }),
  model: { exploredPercentage: () => 0, length: 0, byKey: new Map() },
  drawList: [], dynamicDraws: [], texRemap: null,
  player: () => ({ feet: [10, 1, 20], eye: [10, 2.7, 20], yaw: 0 }),
  startMarker: null,
  blocks: [{ x: 0, z: 0, name: 'W0000000.RDB' }],
  arrowMesh: null,
  dungeonName: 'The Odd Blades',
  insideBuilding: true,
  ...over,
});

function freshWindow(over = {}) {
  _resetForTests();
  resetAutomapWindowState();
  _setAutomapArt(fakeArt());
  signalAutomapReset();
  return new AutomapWindow(winDeps(over));
}

// ─────────────────────────────────────────────────────────────────────
test('c2/S9 THE ENTRANCE BEACON AS A SEQUENCE: lit by SetupBeacons, put out by HideAll, re-lit by the LOS tick', () => {
  resetAutomapStore();
  try {
    // Step by step first, because the ORDER is the quirk. A pin on the
    // end state alone passes against a port that never lit it.
    const rec = { revealed: new Set(['int:0']), visitedThisRun: new Set(['int:0']), entranceDiscovered: false, notes: new Map(), teleporters: new Map() };
    // (1) SetupBeacons(door)'s building arm - "set do discovered" (:1457)
    assert.equal(setupInteriorEntranceBeacon(rec), true);
    assert.equal(rec.entranceDiscovered, true, 'SetupBeacons lights it');
    // (2) RestoreStateAutomapDungeon(true)'s FIRST statement, HideAll()
    // (:2355 -> :2450-2461) - which takes the beacon back out along
    // with every MeshRenderer.
    hideAllAutomap(rec);
    assert.equal(rec.entranceDiscovered, false, 'HideAll puts it out again');
    assert.equal(rec.revealed.size, 0, 'and hides the geometry with it');
    // (3) the LOS tick (:1196-1274) - it runs OUTSIDE the geometry
    // block, so it ticks indoors, and it is the only thing that can
    // light the beacon again.
    automapEntranceTick(rec, [0, 0, 0], [0, 0, 3], { raycast: () => null });
    assert.equal(rec.entranceDiscovered, true, 'a clear line of sight re-lights it');

    // ...and the composed entry runs exactly that order, ending DARK.
    const fresh = enterInteriorAutomap();
    assert.equal(fresh.entranceDiscovered, false, 'a building opens with an UNDISCOVERED entrance');
    assert.equal(fresh.revealed.size, 0, 'and a fully hidden map');

    // THE ORDER IS UNOBSERVABLE FROM THE END STATE - "lit then put out"
    // and "never lit at all" both finish dark - so it is pinned in the
    // source, statement against statement, with the two DFU call sites.
    const am = src('src/systems/automap.js');
    const body = am.match(/export function enterInteriorAutomap\([\s\S]*?\n\}/)[0];
    // anchored at the start of a line, so a commented-out call is not
    // mistaken for the statement it replaced
    const lit = body.search(/\n[ \t]*setupInteriorEntranceBeacon\(rec\);/);
    const out = body.search(/\n[ \t]*hideAllAutomap\(rec\);/);
    assert.ok(lit > 0, 'SetupBeacons runs on entry');
    assert.ok(out > lit, 'and HideAll runs AFTER it, never before or instead');
  } finally { resetAutomapStore(); }
});

test('c2/S9 the dictionary tail (:2362-2379): a mapped dungeon under the SAME location lights the shop-s beacon', () => {
  resetAutomapStore();
  try {
    // DFU looks the BUILDING up in the DUNGEON dictionary by the current
    // location's "RegionName/Name" - a town and the dungeon beneath it
    // share that string - and assigns the beacon that record's
    // entranceDiscovered BEFORE the locationName comparison returns.
    assert.equal(enterInteriorAutomap({ dungeonEntranceDiscovered: false }).entranceDiscovered, false);
    assert.equal(enterInteriorAutomap({ dungeonEntranceDiscovered: true }).entranceDiscovered, true,
      'the dungeon record-s entranceDiscovered reaches the building-s beacon');
    // ...and the arm is a READ. The lookup the host performs is
    // getDungeonAutomap over automapDungeonKey - both already exported,
    // neither writing.
    const wm = src('src/scenes/worldModes.js');
    assert.match(wm, /dungeonEntranceDiscovered: !!getDungeonAutomap\(\s*\n?\s*automapDungeonKey\(hit\.dfLocation\?\.regionIndex \?\? -1, hit\.dfLocation\?\.name \?\? ''\)\)\?\.entranceDiscovered/,
      'the host reads the dungeon dictionary by the location key');
  } finally { resetAutomapStore(); }
});

test('c2/S9 PER-VISIT LIFETIME: leaving and re-entering starts hidden, and nothing survives the door', () => {
  resetAutomapStore();
  try {
    const first = enterInteriorAutomap();
    first.revealed.add('int:4');
    first.visitedThisRun.add('int:4');
    setupInteriorEntranceBeacon(first);
    assert.equal(getInteriorAutomap(), first, 'the live record is the one just minted');

    exitInteriorAutomap();
    assert.equal(getInteriorAutomap(), null, 'the record goes with the room (OnTransitionToExterior)');

    const second = enterInteriorAutomap();
    assert.notEqual(second, first, 'a fresh record, not the old one warmed over');
    assert.equal(second.revealed.size, 0, 're-entering starts hidden');
    assert.equal(second.visitedThisRun.size, 0);
    assert.equal(second.entranceDiscovered, false);
  } finally { resetAutomapStore(); }
});

test('c2/S9 the interior record NEVER enters the dungeon dictionary, and evicts nothing', () => {
  resetAutomapStore();
  _resetForTests();
  try {
    // One remembered dungeon: the setting under which an extra record
    // would evict the one the player cares about.
    setValue('Map', 'AutomapNumberOfDungeons', 1);
    const key = automapDungeonKey(17, 'Privateer-s Hold');
    const dungeon = enterDungeonAutomap(key, 1000);
    dungeon.revealed.add('0:1234');
    dungeon.entranceDiscovered = true;

    const before = JSON.stringify(snapshotAutomap());
    const interior = enterInteriorAutomap();
    interior.revealed.add('int:0');
    interior.revealed.add('int:1');

    assert.equal(getDungeonAutomap(key), dungeon, 'the dungeon record is still there, unswapped');
    assert.deepEqual([...dungeon.revealed], ['0:1234'], 'and untouched');
    const after = snapshotAutomap();
    assert.equal(JSON.stringify(after), before, 'the snapshot is byte-identical - entering a shop wrote nothing');
    assert.deepEqual(Object.keys(after), [key], 'exactly one record, and it is the dungeon-s');
    for (const rowKey of Object.values(after).flatMap((r) => r.revealed)) {
      assert.equal(rowKey.startsWith('int:'), false, 'no interior key ever reaches the save');
    }
    // The key namespaces cannot collide by construction: a dungeon key
    // is `${blockIndex}:${blockLocalPosition}`, digits both sides.
    assert.match('0:1234', /^\d+:\d+$/);
    assert.doesNotMatch('int:0', /^\d+:\d+$/, 'the int: prefix is outside the dungeon key space');
    assert.match(src('src/scenes/interiorContext.js'), /const key = `int:\$\{pi\}`;/,
      'the interior mints its key with that prefix, off the PLACEMENT index');
  } finally { resetAutomapStore(); _resetForTests(); }
});

test('c2/S9 ALWAYS COLOUR: every revealed interior row draws in group 1 and mode 2 is never issued', () => {
  const { drawList, rec } = threeRows();
  const log = [];
  const w = freshWindow({ record: () => rec, drawList, model: { exploredPercentage: () => 0, length: 3, byKey: new Map() } });
  try {
    w.draw(stubRenderer(log), CANVAS, FONT, 1);
    const modes = log.filter((c) => c[0] === 'setAutomapMode').map((c) => c[1]);
    assert.ok(modes.includes(AUTOMAP_MODE.BELOW_COLOUR), 'the colour group ran');
    assert.equal(modes.includes(AUTOMAP_MODE.BELOW_GRAY), false,
      'RENDER_IN_GRAYSCALE is never enabled inside a building (AutomapModel.cs:46-72)');
    const drawn = log.filter((c) => c[0] === 'drawMesh').map((c) => c[1]);
    for (const d of drawList) assert.ok(drawn.includes(d.mesh), `${d.key} drew`);
  } finally { w.dispose(); _resetForTests(); resetAutomapWindowState(); }
});

test('c2/S9 ...and the mutant: the SAME record outside a building takes the grayscale tier', () => {
  const { drawList, rec } = threeRows();
  const log = [];
  const w = freshWindow({
    insideBuilding: false, record: () => rec, drawList,
    model: { exploredPercentage: () => 0, length: 3, byKey: new Map() },
  });
  try {
    w.draw(stubRenderer(log), CANVAS, FONT, 1);
    const modes = log.filter((c) => c[0] === 'setAutomapMode').map((c) => c[1]);
    assert.ok(modes.includes(AUTOMAP_MODE.BELOW_GRAY),
      'a dungeon paints revealed-but-not-visited-this-run grayscale - so the law above is the FLAG, not the fixture');
  } finally { w.dispose(); _resetForTests(); resetAutomapWindowState(); }
});

test('c2/S9 NO MICRO-MAP INDOORS (:1722-1748) - and the blocks list cannot talk it into one', () => {
  const microQuads = (log) => log.filter((c) => c[0] === 'quad' && String(c[1]).startsWith('tex:amap/micro-'));
  // The blocks list is handed in DELIBERATELY: the suppression is the
  // host's answer to IsPlayerInsideBuilding, not "there happened to be
  // no blocks".
  const inside = [];
  const w = freshWindow({ blocks: [{ x: 0, z: 0, name: 'W0000000.RDB' }, { x: 1, z: 0, name: 'B0000000.RDB' }] });
  try {
    w.draw(stubRenderer(inside), CANVAS, FONT, 1);
    assert.equal(microQuads(inside).length, 0, 'textureMicroMap is null in a building');
  } finally { w.dispose(); _resetForTests(); resetAutomapWindowState(); }

  const outside = [];
  const d = freshWindow({ insideBuilding: false, blocks: [{ x: 0, z: 0, name: 'W0000000.RDB' }, { x: 1, z: 0, name: 'B0000000.RDB' }] });
  try {
    d.draw(stubRenderer(outside), CANVAS, FONT, 1);
    assert.equal(microQuads(outside).length, 1, 'the same list DOES draw a micro-map in a dungeon');
  } finally { d.dispose(); _resetForTests(); resetAutomapWindowState(); }
});

test('c2/S9 the reset arm-s default render mode is CUTOUT in a building, TRANSPARENT in a dungeon (window :587-596)', () => {
  const w = freshWindow();
  assert.equal(automapRenderMode(), 'Cutout', '"floors above the current are often distracting"');
  w.dispose();
  const d = freshWindow({ insideBuilding: false });
  assert.equal(automapRenderMode(), 'Transparent', '"people that don-t know the map functionality often think cutout mode is a bug"');
  d.dispose();
  _resetForTests(); resetAutomapWindowState();
});

test('c2/S9 the DEAD restore is absent from the port, and the file says why', () => {
  const am = src('src/systems/automap.js');
  // The name appears exactly where it should: in the note explaining
  // that DFU's own function has no caller. Nothing implements it.
  assert.match(am, /NOTHING ANYWHERE CALLS\s*\n\/\/ RestoreStateAutomapInterior/,
    'the dead-code note names it');
  assert.equal(/export function restoreInteriorAutomap|restoreStateAutomapInterior/.test(am), false,
    'and no port function restores interior discovery');
  // ...nor is there an interior half of the save envelope anywhere.
  for (const f of ['src/systems/automap.js', 'src/scenes/interiorContext.js']) {
    assert.equal(/snapshotInterior|interiorSnapshot/.test(src(f)), false, `${f} invents no interior save`);
  }
  // The one DFU arm the port declines is recorded as a DEPARTURE with
  // its reason, which the doctrine test then requires a Ledger row for.
  assert.match(am, /DEPARTURE \(Port-Ledger, this file\): DFU has a FIFTH arm/,
    'the save-while-inside-a-building arm is recorded, not silently dropped');
});

test('c2/S9 the interior identity: one block, DFU-s two element nodes, the placement index as the model', () => {
  assert.deepEqual([...INTERIOR_ELEMENT_NAMES], [ELEMENT_MODELS, ELEMENT_DOORS],
    'AddModels creates "Models" then "Doors" (DaggerfallInterior.cs:398-401)');
  const ic = src('src/scenes/interiorContext.js');
  assert.match(ic, /blockIndex: 0,/, 'one block - the interior scene');
  assert.match(ic, /elementIndex: 0,\s*\n\s*elementName: INTERIOR_ELEMENT_NAMES\[0\],/,
    'every interior model addresses as element 0; "Doors" is the empty node');
  assert.match(ic, /waterLevel: null,/, 'AddWater is a dungeon block-s (Automap.cs:1982-2001)');
  // The model rows really do come out in that shape, and resolveAt
  // answers by point.
  const model = buildRevealIndex([
    { key: 'int:0', aabb: { min: [0, 0, 0], max: [1, 1, 1] }, blockIndex: 0, blockName: 'MAGEAA00.RMB:0', elementIndex: 0, elementName: INTERIOR_ELEMENT_NAMES[0], modelIndex: 0 },
    { key: 'int:2', aabb: { min: [4, 0, 0], max: [5, 1, 1] }, blockIndex: 0, blockName: 'MAGEAA00.RMB:0', elementIndex: 0, elementName: INTERIOR_ELEMENT_NAMES[0], modelIndex: 1 },
  ]);
  assert.equal(model.length, 2);
  assert.deepEqual([...model.blockNames], ['MAGEAA00.RMB:0']);
  assert.equal(model.resolveAt([0.5, 0.5, 0.5])?.key, 'int:0');
  assert.equal(model.resolveAt([4.5, 0.5, 0.5])?.key, 'int:2');
  assert.equal(model.resolveAt([2.5, 0.5, 0.5]), null, 'the GAP a skipped placement leaves is not owned by anyone');
});

test('c2/S9 the reveal law runs on an interior record through the same three-ray scan', () => {
  const model = buildRevealIndex([
    { key: 'int:0', aabb: { min: [-5, -1, -5], max: [5, 0, 5] } },   // the floor
  ]);
  const rec = enterInteriorAutomap();
  try {
    // One flat collider surface 2 units under the eye, in the 'interior'
    // bucket - the bucket buildInteriorContext really uses.
    const collider = { raycastHit: () => ({ dist: 2, key: 'interior' }) };
    const { rays } = automapRevealTick(rec, {
      eye: [0, 2, 0], fwd: [0, -1, 0], collider, model,
      isDoorBucket: (k) => k !== 'interior',
    });
    assert.ok(rays >= 3, 'three parallel rays per scan');
    assert.deepEqual([...rec.revealed], ['int:0']);
    // ...and revealed rows are visited rows, which is the record half of
    // the always-colour law.
    assert.deepEqual([...rec.visitedThisRun], ['int:0']);

    // An action door in front of the probe reveals NOTHING, indoors as
    // in a dungeon: the automap copy has no action doors at all
    // (DoLayoutAutomap calls AddModels alone).
    const rec2 = enterInteriorAutomap();
    automapRevealTick(rec2, {
      eye: [0, 2, 0], fwd: [0, -1, 0],
      collider: { raycastHit: () => ({ dist: 2, key: 'door:3' }) },
      model, isDoorBucket: (k) => String(k).startsWith('door:'),
    });
    assert.equal(rec2.revealed.size, 0, 'a door hit reveals nothing');
  } finally { resetAutomapStore(); }
});

test('c2/S9 SOURCE PINS: BOTH interior hosts tick the probes and route AutoMap, the way the dungeon hosts do', () => {
  // The context owns the arm; a host that mounts one owes it a tick and
  // a door. Same rule, same shape, as the four-hosts pointer pin.
  const ic = src('src/scenes/interiorContext.js');
  assert.match(ic, /automapTick\(dt, eye, fwd\) \{/, 'the context carries the 5 Hz gate');
  assert.match(ic, /automapRecord: \(\) => automapRec,/);
  assert.match(ic, /automapEntranceTick\(automapRec, automapEntrance, eye, collider\)/,
    'the entrance LOS check ticks indoors too (:1196-1274)');
  assert.match(ic, /exitInteriorAutomap\(\);/, 'and the record dies with the room');

  const wm = src('src/scenes/worldModes.js');
  assert.match(wm, /if \(!overlayHeld\) interiorCtx\.automapTick\?\.\(dt, cam\.pos, fwd\);/, 'worldModes ticks the probes');
  assert.match(wm, /toggleAutomap\(\) \{\s*\n\s*if \(interiorOverlay \|\| !interiorCtx\) return;/, 'worldModes routes AutoMap');
  assert.match(wm, /insideBuilding: true,\s+\/\/ IsPlayerInsideBuilding/, 'and tells the window where it is');
  assert.match(wm, /signalAutomapReset\(\);/, 'and raises the reset signal on entry (:2486)');

  const ij = src('src/scenes/interior.js');
  assert.match(ij, /ctx\.automapTick\?\.\(dt, cam\.pos, fwd\);/, 'the standalone interior host ticks them too');
  assert.match(ij, /if \(e\.code === 'KeyM'\) \{ toggleAutomap\(\); e\.preventDefault\(\); return; \}/, 'and routes the key');
  assert.match(ij, /insideBuilding: true,/);

  // THE POINTER SEAM, the c2/S4 rule applied to the slot this window
  // now lands in: a host that routes `down` but not `up` latches the
  // drag and the map spins for ever.
  for (const phase of ['down', 'move', 'up']) {
    assert.ok(new RegExp(`interiorOverlay\\.pointer\\?\\.\\('${phase}'`).test(wm), `worldModes routes '${phase}' to the interior slot`);
    assert.ok(new RegExp(`overlay\\.pointer\\?\\.\\('${phase}'`).test(ij), `interior.js routes '${phase}'`);
  }

  // The dial's fourth door - the note that said there was no automap
  // inside a building is retired, not merely edited around.
  assert.equal(/no automap inside a building/.test(wm), false, 'the stale note is gone');
  assert.match(wm, /\{ id: 'map', label: 'Map', dir: 's', open: \(\) => interiorKeyCtx\.toggleAutomap\(\) \}/, 'the rose gained the map arm');
});

// ── DATA-GATED ───────────────────────────────────────────────────────
test('c2/S9 a real building interior: one automap row per draw entry, and the probe reveals the room it stands in',
  { skip: skipReal }, async () => {
    const { BlocksFile } = await import('../src/formats/blocksFile.js');
    const { Arch3dFile } = await import('../src/formats/arch3dFile.js');
    const { dfMeshToModel } = await import('../src/world/meshReader.js');
    const { buildInteriorContext } = await import('../src/scenes/interiorContext.js');

    const blocks = new BlocksFile();
    blocks.load(new Uint8Array(readFileSync(join(ARENA2, 'BLOCKS.BSA'))));
    const arch = new Arch3dFile();
    arch.load(new Uint8Array(readFileSync(join(ARENA2, 'ARCH3D.BSA'))));

    const cpuModels = new Map();
    const getGpuMesh = async (id) => {
      if (!cpuModels.has(id)) {
        const idx = arch.getRecordIndex(id);
        if (idx < 0) { cpuModels.set(id, null); return null; }
        cpuModels.set(id, dfMeshToModel(arch.getMesh(idx), () => ({ width: 1, height: 1 })));
      }
      const cpu = cpuModels.get(id);
      if (!cpu) return null;
      return { gpu: id };
    };
    const deps = {
      renderer: { createBillboardBatch: () => ({}), destroyBatch: () => {}, destroyMesh: () => {} },
      getGpuMesh, cpuModels,
      getTexture: async () => ({ recordCount: 0, getSize: () => ({ width: 1, height: 1 }), getScale: () => ({ x: 0, y: 0 }) }),
      uploadRecord: () => {}, uploadRecordFrame: () => {}, palette: null,
    };

    const index = blocks.getBlockIndex('MAGEAA00.RMB');
    const ctx = await buildInteriorContext(deps, blocks.getBlock(index), index, 0, 300, 0);
    try {
      assert.ok(ctx.drawList.length > 0, 'the building stood');
      assert.equal(ctx.automapModel.length, ctx.drawList.length,
        'one automap row per draw entry - the map filters the LIVE list, it does not copy the building');
      assert.equal(new Set(ctx.drawList.map((d) => d.key)).size, ctx.drawList.length, 'the keys are distinct');
      for (const d of ctx.drawList) assert.match(d.key, /^int:\d+$/);

      // The reveal tick, driven from an enter marker: a probe standing
      // in the room marks the row under its feet, and the record is the
      // interior one.
      const rec = ctx.automapRecord();
      assert.equal(rec.revealed.size, 0, 'a building opens fully hidden');
      const spawn = ctx.enterMarkers[0] ?? [ctx.drawList[0].matrix[12], 1, ctx.drawList[0].matrix[14]];
      ctx.automapTick(1, [spawn[0], spawn[1] + 1.6, spawn[2]], [0, -1, 0]);
      assert.ok(rec.revealed.size > 0, 'the floor under the spawn is revealed');
      for (const key of rec.revealed) assert.equal(rec.visitedThisRun.has(key), true, 'and it is a VISITED row - always colour');
    } finally { ctx.destroy(); resetAutomapStore(); }
  });
