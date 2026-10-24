// AUDIT of FIELD BUGS 2026-10-02 (Mac: "Audit this"): four lenses over the batch - the climb's mechanics, the climb on
// real geometry in the modes the probe never ran, the three non-climb fixes, and the records and their pins - each
// finding reproduced first and pinned red here. The record: bible/01-Overview/bugs/Field-Bugs-2026-10-02.md, "The audit".
import '../chargenDom.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

import { PlayerMotor, DIAGONAL_FACTOR } from '../../src/player/motor.js';
import { Collider } from '../../src/player/collider.js';
import { senseGrip, freeClimbSpeed, PARKOUR_CRACK, PARKOUR_CRACK_STEP } from '../../src/player/parkour.js';
import { scene } from '../csaScene.mjs';
import { MapsFile } from '../../src/formats/mapsFile.js';
import { BlocksFile } from '../../src/formats/blocksFile.js';
import { Arch3dFile } from '../../src/formats/arch3dFile.js';
import { dfMeshToModel } from '../../src/world/meshReader.js';
import { layoutDungeon } from '../../src/world/dungeon/dungeonLayout.js';
import { multiply } from '../../src/world/mat4.js';

const ARENA2 = process.env.ARENA2_PATH;
const skipReal = !ARENA2 || !existsSync(ARENA2) ? 'ARENA2_PATH not set or missing - real-data validation skipped' : false;
const src = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const I = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
const BOX_IDX = [0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7, 0, 1, 5, 0, 5, 4, 3, 7, 6, 3, 6, 2, 0, 4, 7, 0, 7, 3, 1, 2, 6, 1, 6, 5];
const boxAt = (x0, y0, z0, x1, y1, z1) => new Float32Array([x0, y0, z0, x1, y0, z0, x1, y1, z0, x0, y1, z0, x0, y0, z1, x1, y0, z1, x1, y1, z1, x0, y1, z1]);
const STEP = 1 / 60;
const FWD = { forward: 1, strafe: 0, jump: false };

function room(...boxes) {
  const col = new Collider(() => -Infinity);
  col.addMesh('floor', new Float32Array([-20, 0, -20, 20, 0, -20, 20, 0, 20, -20, 0, 20]), [0, 1, 2, 0, 2, 3], I);
  boxes.forEach((b, i) => col.addMesh(`b${i}`, boxAt(...b), BOX_IDX, I));
  return col;
}
const motor = (col, skill = 100) => new PlayerMotor(col, { speed: 50, running: 30 }, { parkour: { enabled: () => true, inputs: () => ({ climbing: skill, fatigue: 1 }), say: () => {}, tally: () => {} } });

// ---- the climb -------------------------------------------------------------------------------------------------------

test('AUDIT SEAM-STEP: a jamb over the body\'s middle - the search\'s fit admits the touch of its edge, the resolve refused it, and the climb stood 0.2 m along; it goes on along to where the body rises, and tops out (mutants: no going on)', () => {
  const col = room([-3, 0, 1, 3, 6.4, 3], [-0.02, 3.2, 0, 0, 6.4, 1]);
  const m = motor(col);
  m.spawn(0, 0.02, 0.6);
  for (let i = 0; i < 60 * 10 && !(m.grounded && m.pos[1] > 6.3); i++) m.update(STEP, FWD, 0);
  assert.ok(m.grounded && m.pos[1] > 6.3, `over the top (feet ${m.pos[1].toFixed(2)}, x ${m.pos[0].toFixed(3)})`);
});

test('AUDIT SEAM-STEP: the hands move along at the climb\'s diagonal pace, the nearest place found to 5 cm (mutants: the pace a diagonal too fast; the probe coarser)', () => {
  const col = room([-3, 0, 1, 3, 6.4, 3], [-0.27, 3.2, 0, -0.25, 6.4, 1]);
  const m = motor(col);
  m.spawn(0, 0.02, 0.6);
  let first = null, fastest = 0, px = m.pos[0];
  for (let i = 0; i < 60 * 10 && !(m.grounded && m.pos[1] > 6.3); i++) {
    const was = m._wall?.sidestep?.gone ?? 0;
    m.update(STEP, FWD, 0);
    const st = m._wall?.sidestep;
    if (st?.dir && first == null) first = st.want;
    if (st?.dir && st.gone > was) fastest = Math.max(fastest, Math.abs(m.pos[0] - px));
    px = m.pos[0];
  }
  assert.ok(Math.abs(first - 0.05) < 1e-9, `the jamb 0.1 m inside the body: the first place 5 cm along (${first})`);
  const pace = freeClimbSpeed(m.speed, 100) * DIAGONAL_FACTOR * STEP;
  assert.ok(fastest > 0 && fastest <= pace + 1e-4, `along no faster than the diagonal pace (${fastest.toFixed(4)} of ${pace.toFixed(4)} a step)`);
});

test('AUDIT SEAM-STEP: stuck under a slab with nowhere to step, the search is not asked again every step - 18 places, each a body\'s fit and a wall\'s, every frame the grip lasted (mutants: the failed search forgotten)', () => {
  const col = room([-3, 0, 1, 3, 9, 3], [-3, 3.2, 0, 3, 3.4, 1]);
  const m = motor(col);
  m.spawn(0, 0.02, 0.6);
  for (let i = 0; i < 120; i++) m.update(STEP, FWD, 0);
  assert.ok(m.onWall && m._wall.stuck, 'held under the slab');
  let fits = 0;
  const pen = col.penetrationAt.bind(col);
  col.penetrationAt = (...a) => { fits++; return pen(...a); };
  for (let i = 0; i < 60; i++) m.update(STEP, FWD, 0);
  assert.ok(fits <= 60, `the body's fit asked ${fits} times in 60 stuck steps (the search asks 18 a step)`);
});

test('AUDIT CORNER-TOP: the side is the look\'s as the hands take the wall - a view turned during the climb toward a crate or a fence beside it no longer mantles the climber sideways onto it, or over into the next yard (mutants: the look read each step)', () => {
  for (const [name, side] of [['a 1 m crate', [-1.35, 0, -0.5, -0.5, 1, 1]], ['a 1.2 m fence', [-0.55, 0, -4, -0.5, 1.2, 1]], ['a 4 m garden wall', [-0.8, 0, -4, -0.5, 4, 1]]]) {
    const m = motor(room([-6, 0, 1, 6, 12, 3], side));
    m.spawn(0, 0.02, 0.6);
    let move = null;
    for (let i = 0; i < 60 * 4; i++) {
      m.update(STEP, FWD, m.onWall ? -(25 * Math.PI) / 180 : 0);
      move ??= m._pkMove ? m._pkMove.kind : null;
    }
    assert.equal(move, null, `${name}: no move off the wall`);
    assert.ok(m.onWall && m.pos[1] > 3 && Math.abs(m.pos[0]) < 0.01, `${name}: on up the wall (feet ${m.pos[1].toFixed(2)}, x ${m.pos[0].toFixed(2)})`);
  }
});

test('AUDIT STEP-BACK: a save in the pass loads reaching for the face it was found at - it let go and fell 5.8 m, or stood on the step\'s edge; and a climb across (Forward and Right) passes the step too (mutants: the retake not reaching; across never passing)', () => {
  const lo = 5.75, col = room([-3, 0, 1, 3, lo, 3], [-3, lo, 1.2, 3, 9, 3]);
  for (const extra of [0, 2, 4]) {
    const m = motor(col);
    m.spawn(0, 0.02, 0.6);
    let i = 0;
    for (; i < 900 && !(m._wall?.seek && m._wall?.past != null && m.pos[1] > lo); i++) m.update(STEP, FWD, 0);   // over the step's top, the pass not yet over
    for (let k = 0; k < extra; k++) m.update(STEP, FWD, 0);
    assert.ok(i < 900, 'the pass began');
    const snap = JSON.parse(JSON.stringify(m.fallSnapshot()));
    const at = [...m.pos];
    const n = motor(col);
    n.spawn(at[0], at[1], at[2]);
    n.pos[0] = at[0]; n.pos[1] = at[1]; n.pos[2] = at[2];
    n.restoreFall(snap);
    let fell = 0;
    for (let k = 0; k < 60 * 8 && !(n.grounded && n.pos[1] > 8.9); k++) { n.update(STEP, FWD, 0); fell = Math.max(fell, n.landedFallDistance || 0); }
    assert.ok(n.grounded && n.pos[1] > 8.9 && fell < 0.5, `saved ${extra} steps into the pass: loaded and over the top (feet ${n.pos[1].toFixed(2)}, fell ${fell.toFixed(2)})`);
  }
  const across = motor(room([-6, 0, 1, 6, 3.0, 3], [-6, 3.0, 1.3, 6, 9, 3]));
  across.spawn(0, 0.02, 0.6);
  let high = 0;
  for (let i = 0; i < 60 * 10; i++) { across.update(STEP, { forward: 1, strafe: across.onWall ? 1 : 0, jump: false }, 0); high = Math.max(high, across.pos[1]); }
  assert.ok(high > 5, `across the wall and up past the step (rose to ${high.toFixed(2)})`);
});

test('AUDIT STEP-BACK: climbing down just past a step-back over a recess - the lowest contact ray, the one still on the wall, crossed the recess and met nothing: the climb froze there, or the hands let go 5.4 m up; climbing down now reaches for the wall under the hands as the grab does, and the move is held at that reach (mutants: down at the hold\'s contact; down held at contact)', () => {
  // N0000033's profile: the lower wall to 5.5, a 12 cm recess 0.25 m deep, a 11 cm band, the wall set 0.25 m back to 9
  const col = room([-3, 0, 1, 3, 5.5, 3], [-3, 5.5, 1.25, 3, 5.62, 3], [-3, 5.62, 1, 3, 5.73, 3], [-3, 5.73, 1.25, 3, 9, 3]);
  for (const up of [3.1, 3.15, 3.25, 3.3]) {
    const m = motor(col);
    m.spawn(0, 0.02, 0.6);
    for (let i = 0; i < up * 60; i++) m.update(STEP, FWD, 0);
    const at = m.pos[1];
    let fell = 0;
    for (let i = 0; i < 6 * 60; i++) { m.update(STEP, { forward: -1, strafe: 0, jump: false }, 0); fell = Math.max(fell, m.landedFallDistance || 0); }
    assert.ok(fell < 1, `Back from ${at.toFixed(2)}: no fall (${fell.toFixed(2)} m)`);
    // under the step's top Back climbs down to the floor; over it the climb stops on the wall above the step (CLIMB2's sill)
    if (at < 5.5) assert.ok(m.grounded && m.pos[1] < 0.05, `Back from ${at.toFixed(2)}: down on the floor (feet ${m.pos[1].toFixed(2)})`);
    else assert.ok(m.onWall && m.pos[1] > 5.5, `Back from ${at.toFixed(2)}: on the wall above the step (feet ${m.pos[1].toFixed(2)})`);
  }
});

test('AUDIT CRACK-LIP: the slot itself is measured - a 6 or 8 cm slot is a hold, a 2.5 cm crack is not (the first cut read slots to 9 cm as cracks by where its rung fell) (mutants: the probe a ray 4 cm over the open one; the foot unread)', () => {
  const geo = { radius: 0.35, stand: 1.8, crouch: 0.9, height: 1.8 };
  // (asked about 2.2125, a rung lands in the unit's slot - asked at 2.2, none does)
  const grip = (gap, lip = 2.2125) => senseGrip(room([-3, 0, 1, 3, 2.2, 3], [-3, 2.2 + gap, 1, 3, 6.4, 3]), [0, 2.2, 1], [0, 0, -1], lip, geo);
  assert.equal(grip(0.025), null, 'a unit\'s crack: no hold');
  assert.ok(grip(0.06, 2.2) && grip(0.08, 2.2), 'a 6 cm and an 8 cm slot: holds (asked at 2.2, a rung 1 cm under the slot\'s top)');
  assert.ok(PARKOUR_CRACK === 0.03 && PARKOUR_CRACK_STEP === 0.0025);
});

// ---- the boat's loops -----------------------------------------------------------------------------------------------

test('AUDIT HELM-HUSH: a crossfade stopped by a fade lands too - the loop it was bringing up heard whole, the other stopped - where both were left part-way and the wake never asked again (mutants: the crossfade unsettled)', () => {
  const s = scene();
  const boat = s.place();
  for (let i = 0; i < 6; i++) s.rt.endOfFrame();
  s.helm(boat);
  s.rt.state.MoveVectorCurrent = [0, 0, 1];
  s.rt.update();   // under way: PlayFast's crossfade begins
  s.rt.endOfFrame();
  assert.ok(boat.AudioSourceFast.volume > 0 && boat.AudioSourceFast.volume < 1 && boat.AudioSourceSlow.isPlaying, 'part-way');
  s.place(1, 0, [140, 34, 200]);   // a second boat: its fade stops the crossfade
  assert.equal(boat.AudioSourceSlow.isPlaying, false, 'the slow loop stopped');
  assert.ok(boat.AudioSourceFast.isPlaying && boat.AudioSourceFast.volume === 1, `the fast loop whole (${boat.AudioSourceFast.volume})`);
});

// ---- on the real dungeons ---------------------------------------------------------------------------------------------

function dungeonCollider(region, name) {
  const blocks = new BlocksFile(); blocks.load(new Uint8Array(readFileSync(join(ARENA2, 'BLOCKS.BSA'))));
  const arch = new Arch3dFile(); arch.load(new Uint8Array(readFileSync(join(ARENA2, 'ARCH3D.BSA'))));
  const maps = new MapsFile();
  maps.load(new Uint8Array(readFileSync(join(ARENA2, 'MAPS.BSA'))), new Uint8Array(readFileSync(join(ARENA2, 'CLIMATE.PAK'))), new Uint8Array(readFileSync(join(ARENA2, 'POLITIC.PAK'))));
  const cache = new Map();
  const getModel = (id) => { if (!cache.has(id)) cache.set(id, dfMeshToModel(arch.getMesh(arch.getRecordIndex(id)), () => ({ width: 1, height: 1 }))); return cache.get(id); };
  const d = layoutDungeon(maps.getLocationByName(region, name), blocks, getModel);
  const col = new Collider(() => -Infinity);
  for (const b of d.blocks) {
    const om = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, b.originX, 0, b.originZ, 1];
    for (const p of b.layout.placements) { const m = getModel(p.modelIdNum); if (m) col.addMesh('dungeon', m.positions, m.indices, multiply(om, p.matrix)); }
    for (const dr of b.layout.actionDoors) { if (dr.disabled) continue; const m = getModel(dr.modelIdNum); if (m) col.addMesh('dungeon', m.positions, m.indices, multiply(om, dr.matrix)); }
  }
  return col;
}
function topsOut(col, [x, y, z], yaw, top) {
  const m = motor(col);
  m.spawn(x, y + 0.02, z);
  let lets = 0, was = false;
  for (let i = 0; i < 60 * 12; i++) {
    m.update(STEP, FWD, yaw);
    if (was && !m.onWall && !m._pkMove && !m.grounded) lets++;
    was = m.onWall;
    if (m.grounded && m.pos[1] > top - 0.3) return { ok: true, lets, y: m.pos[1] };
  }
  return { ok: false, lets, y: m.pos[1] };
}

test('AUDIT on ARENA2: CRACK-LIP on the Pit of Sahoth\'s N0000008, STEP-BACK on the Mordywyr Mines\' N0000033 and CORNER-TOP in Ruins of Old Carololda\'s Farm\'s N0000090 pit - each wall topped, with no let-go; and no fall under N0000008\'s leaning top (mutants: the hold turned unasked)', { skip: skipReal }, () => {
  const pit = topsOut(dungeonCollider('Dragontail Mountains', 'The Pit of Sahoth'), [34.5, 19.2, 31.5], 0, 25.6);
  assert.ok(pit.ok && pit.lets === 0, `N0000008's cracked wall (feet ${pit.y.toFixed(2)}, ${pit.lets} let-gos)`);
  const mines = topsOut(dungeonCollider('Wrothgarian Mountains', 'The Mordywyr Mines'), [-32.7, 38.4, 0.5], Math.PI / 2, 44.8);
  assert.ok(mines.ok, `N0000033's step-back (feet ${mines.y.toFixed(2)})`);
  const corner = topsOut(dungeonCollider('Daggerfall', "Ruins of Old Carololda's Farm"), [13.75, 6.4, -70.65], 5.49, 12.8);
  // the hold turned onto a face it cannot hold along: under the leaning top of N0000008's 11.5 m wall the hands let go
  // at 10.96 m (and with Forward held climbed and fell again); they hold now
  const sahoth = dungeonCollider('Dragontail Mountains', 'The Pit of Sahoth');
  for (const yaw of [-2.6483, -2.9101, -3.1719]) {
    const m = motor(sahoth);
    m.spawn(12.5, 0.02, 14.5);
    let fell = 0;
    for (let i = 0; i < 60 * 8; i++) { m.update(STEP, FWD, yaw); fell = Math.max(fell, m.landedFallDistance || 0); }
    assert.ok(fell < 1, `N0000008 at ${yaw}: no fall (${fell.toFixed(2)} m)`);
  }
  assert.ok(corner.ok, `N0000090's corner (feet ${corner.y.toFixed(2)})`);
});
