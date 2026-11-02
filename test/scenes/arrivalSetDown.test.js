// HOLD-KEPT ON ARRIVAL (src/scenes/arrivalSetDown.js, AUDIT SHIP-REFIT): what a restored room can no longer hold is set
// down where the player stands once stood. Held here: a chest's things held and landed at the arrival, said once (a
// moved house's crate unsaid); a pile inside a closed solid held, one under a table or on the open floor answered, a
// scene's own container never moved; the host's order - held while restoring, landed after the spawn; and, with
// ARENA2_PATH, Daggerfall's own furniture read as the law reads it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createArrivalSetDown, insideSolid } from '../../src/scenes/arrivalSetDown.js';
import { Collider } from '../../src/player/collider.js';
import { MeshBuilder } from '../../src/world/detStandIns.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const ARENA2 = process.env.ARENA2_PATH;
const HAVE_ARENA2 = !!ARENA2 && existsSync(join(ARENA2, 'ARCH3D.BSA'));
const I = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

/** A room: a closed crate at the origin (1 m), a table at x 5 (a slab on four legs), a floor and walls round both. */
function room() {
  const m = new MeshBuilder();
  m.box([0, 0], [0, 0.5, 0], [1, 1, 1]);   // the crate
  m.box([0, 0], [5, 0.75, 0], [1.4, 0.06, 0.9]);   // the table's top
  for (const [x, z] of [[4.4, -0.4], [5.6, -0.4], [4.4, 0.4], [5.6, 0.4]]) m.box([0, 0], [x, 0.36, z], [0.06, 0.72, 0.06]);
  const col = new Collider(() => -Infinity);
  const built = m.build();
  col.addMesh('dungeon', built.positions, built.indices, I);
  return col;
}
/** A 1 m box at the origin with the faces `drop` names left out ('top', 'bottom', 'px', 'nx', 'pz', 'nz'). */
function openBox(drop) {
  const m = new MeshBuilder();
  m.box([0, 0], [0, 0.5, 0], [1, 1, 1]);
  const built = m.build();
  const p = built.positions, keep = [];
  const sideOf = (tri) => {
    const v = [0, 1, 2].map((k) => [p[tri[k] * 3], p[tri[k] * 3 + 1], p[tri[k] * 3 + 2]]);
    const all = (axis, val) => v.every((q) => Math.abs(q[axis] - val) < 1e-6);
    return all(1, 1) ? 'top' : all(1, 0) ? 'bottom' : all(0, 0.5) ? 'px' : all(0, -0.5) ? 'nx' : all(2, 0.5) ? 'pz' : 'nz';
  };
  for (let t = 0; t < built.indices.length; t += 3) {
    const tri = [built.indices[t], built.indices[t + 1], built.indices[t + 2]];
    if (!drop.includes(sideOf(tri))) keep.push(...tri);
  }
  const col = new Collider(() => -Infinity);
  col.addMesh('dungeon', p, new Uint32Array(keep), I);
  return col;
}
const rig = () => {
  const dropped = [], said = [];
  const s = createArrivalSetDown({ dropPile: (items, feet) => dropped.push({ items, feet }), say: (l) => said.push(l) });
  return { s, dropped, said };
};

test('HOLD-KEPT ON ARRIVAL a chest that stands no more: its things held, landed where the player stands, said once; a moved house\'s crate unsaid; a new room holds nothing of the last (mutants: ARRIVAL-*)', () => {
  const { s, dropped, said } = rig();
  s.hold([{ name: 'Ring' }]);
  s.hold([{ name: 'Sword' }, { name: 'Potion' }]);
  s.hold([]);
  assert.deepEqual(dropped, [], 'nothing set down while the room restores');
  assert.equal(s.land([1, 2, 3]), 1);
  assert.deepEqual(dropped.map((d) => [d.items.map((i) => i.name), d.feet]), [[['Ring'], [1, 2, 3]], [['Sword', 'Potion'], [1, 2, 3]]]);
  assert.deepEqual(said, ['A chest that stood here is gone. What it held was set down at your feet.']);
  assert.equal(s.land([0, 0, 0]), 0, 'landed once');
  const crate = rig();
  crate.s.hold([{ name: 'Lamp' }], { crate: true });
  crate.s.land([0, 0, 0]);
  assert.equal(crate.dropped.length, 1);
  assert.deepEqual(crate.said, [], 'a moved house\'s crate is no lost chest');
  const stale = rig();
  stale.s.hold([{ name: 'Old' }]);
  stale.s.reset();
  stale.s.land([0, 0, 0]);
  assert.deepEqual(stale.dropped, [], 'reset at each restore');
});

test('HOLD-KEPT ON ARRIVAL a pile inside a closed solid is held for the arrival; under a table, on the open floor or a scene\'s own container, it stays', () => {
  const col = room();
  assert.equal(insideSolid(col, [0, 0.02, 0]), true, 'inside the crate');
  assert.equal(insideSolid(col, [5, 0.02, 0]), false, 'under the table: open at the sides');
  assert.equal(insideSolid(col, [2.5, 0.02, 0]), false, 'the open floor');
  assert.equal(insideSolid(openBox(['bottom', 'pz']), [0, 0.02, 0]), true, 'a wardrobe: open at its back, against its wall');
  assert.equal(insideSolid(openBox(['bottom', 'top']), [0, 0.02, 0]), false, 'a bin open above: reachable');
  assert.equal(insideSolid(openBox(['bottom', 'px', 'nx']), [0, 0.02, 0]), false, 'a tunnel - a top and two walls: reachable');
  const { s, dropped, said } = rig();
  const piles = [
    { pos: [0, 0.02, 0], items: [{ name: 'Buried' }] },
    { pos: [5, 0.02, 0], items: [{ name: 'Under table' }] },
    { pos: [0, 0.02, 0], items: [{ name: 'Treasure' }], container: true },
    { pos: [0, 0.02, 0], items: [] },
  ];
  const kept = s.unburied(piles, col);
  assert.deepEqual(kept.map((p) => p.items[0]?.name ?? null), ['Under table', 'Treasure', null]);
  s.land([9, 0, 9]);
  assert.deepEqual(dropped.map((d) => [d.items[0].name, d.feet]), [['Buried', [9, 0, 9]]]);
  assert.deepEqual(said, ['Furniture now stands where you left some things. They were set down at your feet.']);
  assert.equal(s.unburied(null, col), null, 'a scene with no list stays one (restorePiles clears on it)');
});

test('HOLD-KEPT ON ARRIVAL the host: held while the room restores, the restored piles read for burial, landed after the spawn at the spot it stood the player', () => {
  const wm = readFileSync(join(ROOT, 'src/scenes/worldModes.js'), 'utf8');
  assert.match(wm, /const arrivalSetDown = createArrivalSetDown\(\{ dropPile: \(items, feet\) => interiorDropped\.dropPile\(items, feet\), say: \(line\) => say\(line\) \}\);/);
  assert.match(wm, /_keptHidden = \[\];[^\n]*\n\s+arrivalSetDown\.reset\(\);/);
  assert.match(wm, /interiorDropped\.restorePiles\(data\.droppedPiles \? arrivalSetDown\.unburied\(data\.droppedPiles\.map\(\(p\) => \(\{ \.\.\.p, pos: place\(p\.pos\) \}\)\), interiorCtx\.collider\) : data\.droppedPiles\);/);
  assert.match(wm, /player\.spawn\(spot\[0\], spot\[1\], spot\[2\]\);\n\s+arrivalSetDown\.land\(spot\);/);
  assert.ok(wm.indexOf('restoreInteriorScene();\n') < wm.indexOf('arrivalSetDown.land(spot);'), 'landed after the restore');
  assert.doesNotMatch(wm, /f = player\.pos;\n\s+data\.droppedPiles/, 'never the position the player held before the door');
});

test('HOLD-KEPT ON ARRIVAL with ARENA2: every chest, crate, bed, bunk and wardrobe of Daggerfall\'s encloses a pile; its tables, benches and chairs do not', { skip: HAVE_ARENA2 ? false : 'ARENA2_PATH not set' }, async () => {
  const { Arch3dFile } = await import('../../src/formats/arch3dFile.js');
  const { dfMeshToModel } = await import('../../src/world/meshReader.js');
  const arch = new Arch3dFile();
  arch.load(new Uint8Array(readFileSync(join(ARENA2, 'ARCH3D.BSA'))));
  const at = (id) => {
    const m = dfMeshToModel(arch.getMesh(arch.getRecordIndex(id)), () => ({ width: 64, height: 64 }));
    const col = new Collider(() => -Infinity);
    col.addMesh('dungeon', m.positions, m.indices, I);
    const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < m.positions.length; i += 3) for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], m.positions[i + k]); hi[k] = Math.max(hi[k], m.positions[i + k]); }
    return insideSolid(col, [(lo[0] + hi[0]) / 2, lo[1] + 0.02, (lo[2] + hi[2]) / 2]);
  };
  for (const id of [41811, 41812, 41813, 41815, 41818, 41822, 41827, 41831, 41832, 41834, 41000, 41001, 41002, 41003]) assert.equal(at(id), true, `${id} encloses`);
  for (const id of [41108, 41109, 41106, 41112, 41121, 41102]) assert.equal(at(id), false, `${id} is open`);
});
