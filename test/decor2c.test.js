// DECOR2c (2026-09-25, Mac: "Also want to add a way to display your weapons"; asked, "Mounted" - a weapon or a shield
// hangs flat against the wall, shown as its detailed pack picture): THE MOUNTS. The law's mount (net/decorLaw.js: which
// items hang, the frame a mount's turn names, the archive bound for the port's own pictures), what of the pack hangs and
// as what (systems/decorItems.js), the placer setting one on a surface (systems/decorPlacer.js), the room hanging it on
// the decal pass (scenes/decorRoom.js), the tool's flight and its ghost (scenes/decorTool.js), the panel's line, and the
// host's wiring by source. The service's half is pinned with the service (decor1.test.js). `06-Systems/Online-Arc.md`
// DECOR2.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  decorIsMount, decorMountFrame, decorWhatOf, decorPieceOf, DECOR_MOUNT_LIFT, DECOR_ARCHIVE_MAX, DECOR_WEAPONS_GROUP, DECOR_ARMOR_GROUP,
  DECOR_ARROW_TEMPLATE, DECOR_SHIELD_TEMPLATES,
} from '../src/net/decorLaw.js';
import { decorMountOf, decorMountDye, decorOwnEntry, decorStandOf } from '../src/systems/decorItems.js';
import { itemDyeColor } from '../src/systems/itemDye.js';
import { inventoryItemImage } from '../src/systems/itemTemplates.js';
import { ITEM_GROUP_NAME_BY_CLASS } from '../src/systems/loot.js';
import { SURFACE_LIFT } from '../src/combat/bloodDecals.js';
import { createDecorPlacer } from '../src/systems/decorPlacer.js';
import { createDecorRoom, decorMountQuad, decorMountFloats } from '../src/scenes/decorRoom.js';
import { DECOR_MOUNT_NO_SURFACE } from '../src/scenes/decorTool.js';
import { DECOR_MOUNT_LINE, DECOR_OWN_LINE } from '../src/ui/decorPanel.js';
import { billboardSize } from '../src/world/rmbFlats.js';
import { RAY_DISTANCE } from '../src/player/activate.js';
import { settle, near, all, one, rows, toolRig } from './decorFakes.mjs';

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const sword = (extra = {}) => ({ templateIndex: 120, group: 'Weapons', material: 7, stackCount: 1, ...extra });   // an ebony longsword
const kite = () => ({ templateIndex: 111, group: 'Armor', material: 3, stackCount: 1 });
const nearAll = (a, b, eps = 1e-9) => a.length === b.length && a.every((v, i) => near(v, b[i], eps));
const panelOf = (rig) => rig.doc.body.children.find((c) => c.className === 'dfdecor');
const barOf = (rig) => rig.doc.body.children.find((c) => String(c.className).startsWith('dfdecor-bar'));
const btn = (root, label) => all(root, 'dfdecor-btn').find((b) => (typeof label === 'string' ? b.textContent === label : label.test(b.textContent)));
const tab = (root, re) => all(root, 'dfdecor-chip').find((c) => re.test(c.textContent));
const key = (rig, code) => rig.win.fire('keydown', { code, target: rig.doc.body });
const named = (root, name) => rows(root).find((r) => one(r, 'dfdecor-row-name').textContent.startsWith(name));

// ─── THE LAW ─────────────────────────────────────────────────────────────────────────────────────────────────────────

test('DECOR2c the law: a mount is a flat piece of one\'s own weapon (never the arrows) or shield - every client reads it off the item\'s own numbers; its turn names a frame (the surface\'s heading and tilt, then a spin, clockwise as its viewer sees it) whose right is that viewer\'s right; it hangs the blood marks\' own hair off the surface; the port\'s own pictures past archive 511 are within bounds (mutants: the arrows hung, any armour hung, a model hung, the frame mirrored, the spin backwards, the bound kept)', () => {
  assert.deepEqual([ITEM_GROUP_NAME_BY_CLASS[DECOR_WEAPONS_GROUP], ITEM_GROUP_NAME_BY_CLASS[DECOR_ARMOR_GROUP], DECOR_ARROW_TEMPLATE, [...DECOR_SHIELD_TEMPLATES]],
    ['Weapons', 'Armor', 131, [109, 110, 111, 112]], 'Daggerfall\'s own numbers');
  const hung = (item, extra = {}) => decorIsMount({ model: null, flat: [234, 12], item, ...extra });
  assert.equal(hung({ t: 120, g: 3 }), true, 'a longsword');
  assert.equal(hung({ t: 131, g: 3 }), false, 'never the arrows');
  assert.equal(hung({ t: 111, g: 2 }), true, 'a kite shield');
  assert.equal(hung({ t: 102, g: 2 }), false, 'a cuirass is no shield');
  assert.equal(hung({ t: 265, g: 10 }), false, 'a statue stands');
  assert.equal(hung({ t: 120, g: 3 }, { model: 41000 }), false, 'a model never hangs');
  assert.equal(hung({ t: 120, g: 3 }, { flat: null }), false);
  assert.equal(decorIsMount({ model: null, flat: [234, 12], item: null }), false);
  assert.equal(decorIsMount(null), false);
  // the frame: a wall facing +z is read by a viewer looking -z, whose right is -x
  const f0 = decorMountFrame([0, 0, 0]);
  assert.ok(nearAll(f0.normal, [0, 0, 1]) && nearAll(f0.right, [-1, 0, 0]) && nearAll(f0.up, [0, 1, 0]), JSON.stringify(f0));
  const fx = decorMountFrame([90, 0, 0]);
  assert.ok(nearAll(fx.normal, [1, 0, 0]) && nearAll(fx.right, [0, 0, 1]) && nearAll(fx.up, [0, 1, 0]), 'a wall facing +x: the viewer looks -x, right is +z');
  const floor = decorMountFrame([0, 90, 0]);
  assert.ok(nearAll(floor.normal, [0, 1, 0]) && nearAll(floor.right, [-1, 0, 0]) && nearAll(floor.up, [0, 0, -1]), 'on a floor, up runs away from the viewer');
  const spun = decorMountFrame([0, 0, 90]);
  assert.ok(nearAll(spun.right, [0, -1, 0]) && nearAll(spun.up, [-1, 0, 0]), 'spun a quarter clockwise: its top to the viewer\'s right');
  assert.equal(DECOR_MOUNT_LIFT, SURFACE_LIFT, 'the blood marks\' own hair');
  // the bound
  assert.equal(DECOR_ARCHIVE_MAX, 999);
  assert.deepEqual(decorWhatOf({ model: null, flat: [513, 2], item: { t: 513, g: 3 } })?.flat, [513, 2], 'Roleplay & Realism\'s own weapon picture');
  assert.equal(decorWhatOf({ model: null, flat: [1000, 0] }), null);
  const mount = { id: 'm1', model: null, flat: [234, 12], item: { t: 120, g: 3, m: 7 }, pos: [0, 1.5, 2], rot: [180, 0, 15], scale: 1, light: null, storage: false, paid: 0 };
  assert.deepEqual(decorPieceOf(mount)?.rot, [180, 0, 15]);
  assert.equal(decorPieceOf({ ...mount, paid: 10 }), null, 'one\'s own, free');
});

// ─── WHAT HANGS ──────────────────────────────────────────────────────────────────────────────────────────────────────

test('DECOR2c what of the pack hangs, and as what: a weapon or a shield, as its own pack picture - the owner\'s body\'s, as the pack draws it - with no light and its own numbers; never the arrows, other armour, anything worn, a quest\'s or a summoned one; its dye read off its numbers alone (an artifact\'s its own); the panel\'s row says it hangs, and a thing that stands stands (mutants: a worn blade hung, the body ignored, the dye the template\'s, a statue hung)', () => {
  const m = decorMountOf(sword());
  assert.deepEqual(m, { flat: [234, 12], light: null, item: { t: 120, g: 3, m: 7, v: null, a: null, p: null } });
  assert.deepEqual(decorMountOf(sword(), { gender: 'female' })?.flat, [233, 12], 'the owner\'s own body\'s picture (ItemBuilder: a woman\'s weapons are 233)');
  const female = { gender: 'female' };
  assert.deepEqual(decorMountOf(sword(), female).flat, [inventoryItemImage(sword(), female).archive, inventoryItemImage(sword(), female).record], 'the pack\'s own');
  assert.deepEqual(decorMountOf(kite())?.flat, [251, 35]);
  for (const [why, item] of [
    ['arrows', { templateIndex: 131, group: 'Weapons', stackCount: 20 }],
    ['a cuirass', { templateIndex: 102, group: 'Armor' }],
    ['worn', sword({ equipSlot: 'RightHand' })],
    ['a quest\'s', sword({ questItem: true })],
    ['summoned', sword({ timeForItemToDisappear: 100 })],
    ['a statue', { templateIndex: 265, group: 'ReligiousItems' }],
    ['unknown', { templateIndex: 99999, group: 'Weapons' }],
  ]) assert.equal(decorMountOf(item), null, why);
  assert.equal(decorStandOf(sword()), null, 'a blade never stands');
  // the dye, off the numbers
  assert.equal(decorMountDye(m.item), itemDyeColor({ group: 'Weapons', material: 7 }));
  assert.equal(decorMountDye({ t: 111, g: 2, m: 3 }), itemDyeColor({ group: 'Armor', material: 3 }));
  assert.equal(decorMountDye({ t: 120, g: 3, m: 7, a: 4 }), itemDyeColor({ artifact: true }), 'an artifact wears its own colours');
  assert.notEqual(decorMountDye({ t: 120, g: 3, m: 7 }), decorMountDye({ t: 120, g: 3, m: 0 }), 'the material decides it');
  assert.equal(decorMountDye({ t: -1 }), null);
  // the row
  const e = decorOwnEntry(sword(), 2);
  assert.deepEqual([e.key, e.kind, e.mount, e.name, e.flat, e.light, e.storage], ['own:2', 'own', true, 'Ebony Longsword', [234, 12], null, false]);
  assert.deepEqual([e.icon.archive, e.icon.record], [234, 12], 'its pack picture');
  assert.equal(decorOwnEntry({ templateIndex: 265, group: 'ReligiousItems', stackCount: 1 }, 0).mount, false, 'a thing that stands stands');
});

// ─── THE PLACER ──────────────────────────────────────────────────────────────────────────────────────────────────────

test('DECOR2c the placer sets a mount ON the surface: its heading the surface\'s (a floor\'s the eye\'s, so it reads upright from where the owner stands), its tilt the surface\'s, the turn its spin; a hair off the surface; the grid snaps it across the surface and never off it, the owner\'s lift moves it up it; no surface, no mount; moved, it starts at its own spin; a piece that stands takes no notice of the surface (mutants: the surface\'s heading ignored, the lift off the wrong side, the grid off the surface, the spin lost, a mount hung in the air)', () => {
  const entry = { key: 'own:1', kind: 'own', model: null, flat: [234, 12], item: { t: 120, g: 3, m: 7, v: null, a: null, p: null }, mount: true, light: null };
  const pl = createDecorPlacer(entry, { free: true });
  assert.equal(pl.price(), 0, 'free');
  const wall = pl.pieceAt([12, 1.5, 13], [10, 0, 10], 'm1', [0, 0, -1], 0);
  assert.deepEqual([wall.pos, wall.rot, wall.flat, wall.item.t, wall.paid], [[2, 1.5, 2.98], [180, 0, 0], [234, 12], 120, 0], 'on the wall, a hair toward the eye');
  assert.equal(pl.pieceAt([12, 1.5, 13], [10, 0, 10], 'm1', null, 0), null, 'nothing to hang it on');
  assert.deepEqual(pl.pieceAt([12, 1.5, 13], [10, 0, 10], 'm1', [0, 0, -2], 0).pos, [2, 1.5, 2.98], 'the normal taken at its unit length');
  pl.turn(15);
  pl.toggleSnap();
  pl.raise(0.05);
  const snapped = pl.pieceAt([12.13, 1.37, 13], [10, 0, 10], 'm1', [0, 0, -1], 0);
  assert.deepEqual([snapped.pos, snapped.rot], [[2.25, 1.3, 2.98], [180, 0, 15]], 'snapped across the wall, lifted up it, spun - and still on it');
  const onFloor = pl.pieceAt([12, 0, 13], [10, 0, 10], 'm2', [0, 1, 0], Math.PI / 2);
  assert.deepEqual([onFloor.pos, onFloor.rot], [[2.05, 0.02, 3], [-90, 90, 15]], 'a floor\'s heading the eye\'s own, turned about');
  const side = createDecorPlacer(entry, { free: true }).pieceAt([12, 1.5, 13], [10, 0, 10], 'm3', [1, 0, 0], 0);
  assert.deepEqual([side.pos, side.rot], [[2.02, 1.5, 3], [90, 0, 0]], 'a wall facing +x');
  const moved = createDecorPlacer(entry, { free: true, from: { rot: [90, 0, -30], scale: 2 } });
  assert.deepEqual([moved.state().yaw, moved.state().scale], [-30, 2], 'a mount moved starts at its own spin');
  const statue = { key: 'own:2', kind: 'own', model: null, flat: [202, 5], item: { t: 265, g: 10 }, light: null };
  const stood = createDecorPlacer(statue, { free: true }).pieceAt([12, 1.5, 13], [10, 0, 10], 's1', [0, 0, -1], 0);
  assert.deepEqual([stood.pos, stood.rot], [[2, 1.5, 3], [0, 0, 0]], 'a thing that stands stands where the eye meets the room');
});

// ─── THE ROOM ────────────────────────────────────────────────────────────────────────────────────────────────────────

function mountRoomRig({ origin = [100, 10, -50] } = {}) {
  const log = [];
  const lights = [];
  const decals = [];
  const textures = new Map();
  const uploads = [];
  const tex = { recordCount: 40, getSize: () => ({ width: 16, height: 48 }), getScale: () => ({ width: 0, height: 0 }), getFrameCount: () => 1 };
  const pool = createDecorRoom({
    meshes: { getGpuMesh: async () => null, cpuModels: new Map() },
    renderer: {
      textures,
      createBillboardBatch: (a, r) => { log.push(['batch', a, r]); return { a, r }; },
      destroyBillboardBatch: () => {},
      drawMesh: () => {},
      createDecalBatch: (cap) => { const b = { cap, writes: [], draws: [], destroyed: false }; decals.push(b); return b; },
      writeDecalSlot: (b, slot, floats) => { b.writes.push([slot, Array.from(floats)]); return true; },
      drawDecals: (b, t) => { b.draws.push(t); },
      destroyDecalBatch: (b) => { b.destroyed = true; },
    },
    getTexture: async (a) => (a === 234 || a === 251 ? tex : null),
    uploadRecord: (a, r, opts = {}) => {
      uploads.push([a, r, opts]);
      if (opts.mips !== false) return undefined;
      textures.set(`${a}_${r}#ui`, `tex:${a}.${r}`);
      return '#ui';
    },
    collider: () => ({ addMesh: () => log.push(['collider']), removeBucket: () => {} }),
    origin: () => origin,
    roomLights: () => lights,
  });
  return { pool, log, lights, decals, uploads, tex, origin };
}

test('DECOR2c the room hangs a mount on the decal pass: its picture uploaded as the pack\'s own (the cut-out, no mip chain, its dye), sized as a flat of its archive and scaled, one quad centred at its place and framed by its turn - never a billboard, never a collider; drawn by drawMounts; its eye target the box round its corners, a hair thick, answering the ray alone; a lit one\'s light at its middle; moved or removed it takes its quad with it, and one gone while it loaded never hangs (mutants: a billboard stood, the quad unwritten, the dye dropped, the target solid, the light at its foot, a stale load hanging, the quad left behind)', async () => {
  const { pool, log, lights, decals, uploads, tex, origin } = mountRoomRig();
  const piece = { id: 'm1', model: null, flat: [234, 12], item: { t: 120, g: 3, m: 7, v: null, a: null, p: null }, pos: [1, 1.5, 2], rot: [180, 0, 15], scale: 2, light: null, storage: false, paid: 0 };
  pool.put(piece);
  assert.equal(decals.length, 0, 'not yet loaded');
  await settle();
  assert.deepEqual(uploads, [[234, 12, { mips: false, removeMask: true, dye: decorMountDye(piece.item) }]], 'the pack\'s own upload, its dye off its numbers');
  const size = billboardSize(tex, 12);
  const quad = decorMountQuad(piece, origin, { w: size.w * 2, h: size.h * 2 });
  assert.equal(decals.length, 1);
  assert.deepEqual([decals[0].cap, decals[0].writes], [1, [[0, Array.from(decorMountFloats(quad))]]], 'one quad, framed and sized');
  assert.ok(nearAll(quad.centre, [101, 11.5, -48]), 'centred at its place');
  assert.deepEqual([pool.batches(), log.filter((l) => l[0] === 'collider')], [[], []], 'no billboard, no collider');
  assert.equal(pool.drawMounts(), 1);
  assert.deepEqual(decals[0].draws, ['tex:234.12'], 'drawn with its own picture');
  const [target] = pool.targets();
  const cs = quad.corners;
  const lo = [0, 1, 2].map((i) => Math.min(...cs.map((c) => c[i])) - DECOR_MOUNT_LIFT);
  const hi = [0, 1, 2].map((i) => Math.max(...cs.map((c) => c[i])) + DECOR_MOUNT_LIFT);
  assert.deepEqual(target, { key: 'decor:m1', aabb: { min: lo, max: hi }, distance: RAY_DISTANCE, reach: target.reach, noSurface: true }, 'the box round its corners, answering the ray alone');
  // lit: at its middle
  pool.put({ ...piece, light: { color: [1, 0.85, 0.6], range: 6, intensity: 1 } });
  assert.equal(decals[0].destroyed, true, 'the old quad goes with the move');
  await settle();
  assert.deepEqual([lights.length, lights[0].y], [1, 11.5], 'a lit mount\'s light at its middle');
  pool.remove('m1');
  assert.deepEqual([decals[1].destroyed, lights.length, pool.drawMounts()], [true, 0, 0]);
  // gone while it loaded
  pool.put({ ...piece, id: 'm2' });
  pool.remove('m2');
  await settle();
  assert.equal(decals.length, 2, 'never hung');
  // a shield of the room's other archive, and a picture the archive lacks
  pool.put({ ...piece, id: 'm3', flat: [251, 35], item: { t: 111, g: 2, m: 3 } });
  pool.put({ ...piece, id: 'm4', flat: [251, 99], item: { t: 111, g: 2, m: 3 } });
  await settle();
  assert.equal(decals.length, 3, 'the shield hangs; a record the archive lacks does not');
});

// ─── THE TOOL ────────────────────────────────────────────────────────────────────────────────────────────────────────

async function openAll(rig) {
  rig.frame();
  assert.equal(rig.tool.openPanel(), true);
  for (let i = 0; i < 6; i++) { rig.frame({ overlayUp: true }); await settle(); }
}
const flight = async (rig) => { rig.frame(); await settle(); rig.frame(); };

test('DECOR2c hanging a blade from "Your things": its row says it hangs; the flight\'s ghost is the picture itself, hanging where the blade will - or, with no surface in reach, nowhere, the bar saying why; the turn spins it on the wall; set down it stands as the ghost did, free, the blade into the room\'s keeping and the ghost gone; moved it keeps its spin and hangs anew; taken down it is back in the pack (mutants: the ghost a billboard, the ghost left drawn, the spin lost, a mount set in the air, the pack\'s words)', async () => {
  const rig = toolRig({ gold: 0 });
  const blade = sword();
  rig.pack.push(blade, { templateIndex: 265, group: 'ReligiousItems', stackCount: 1 });
  await openAll(rig);
  let root = panelOf(rig);
  tab(root, /^Your things/).fire('click');
  assert.deepEqual([one(named(root, 'Ebony Longsword'), 'dfdecor-row-sub').textContent, one(named(root, 'Small Statue'), 'dfdecor-row-sub').textContent], [DECOR_MOUNT_LINE, DECOR_OWN_LINE]);
  named(root, 'Ebony Longsword').fire('click');
  btn(root, 'Place').fire('click');
  await flight(rig);
  // no surface: nothing to hang it on
  assert.equal(rig.tool.why(), DECOR_MOUNT_NO_SURFACE);
  const ghostBatch = rig.decals.at(-1);
  assert.deepEqual(ghostBatch.writes.at(-1), [0, Array.from(decorMountFloats(null))], 'the ghost hangs nowhere');
  assert.equal(rig.tool.drawMounts(rig.renderer), false);
  // a wall
  rig.state.normal = [0, 0, -1];
  rig.frame();
  const ghost = rig.tool.ghost();
  assert.deepEqual([ghost.pos, ghost.rot, ghost.flat, ghost.paid], [[0, 1.6, 1.98], [180, 0, 0], [234, 12], 0]);
  const size = billboardSize({ getSize: () => ({ width: 16, height: 32 }), getScale: () => ({ width: 0, height: 0 }) }, 12);
  assert.deepEqual(ghostBatch.writes.at(-1), [0, Array.from(decorMountFloats(decorMountQuad(ghost, [10, 0, 10], size)))], 'the ghost is the picture, where it will hang');
  assert.equal(one(barOf(rig), 'dfdecor-bar-what').textContent, 'Ebony Longsword - free');
  assert.deepEqual([rig.tool.drawMounts(rig.renderer), rig.draws.at(-1)?.tex], [true, 'tex:234.12']);
  assert.deepEqual(rig.tool.batches(), [], 'never a billboard');
  key(rig, 'ArrowRight');
  rig.frame();
  assert.equal(rig.tool.ghost().rot[2], 15, 'the turn spins it on the wall');
  key(rig, 'KeyE');
  await settle();
  const piece = rig.standing[0];
  assert.deepEqual([piece.rot, piece.pos, rig.w.paid], [[180, 0, 15], [0, 1.6, 1.98], []]);
  assert.deepEqual([rig.owned.get(piece.id), rig.pack.includes(blade), ghostBatch.destroyed], [blade, false, true], 'into the room\'s keeping, the ghost gone');
  // moved: its spin kept, hung anew on another wall
  rig.frame();
  root = panelOf(rig);
  tab(root, /^In this room/).fire('click');
  rows(root).find((r) => r.dataset.key === piece.id).fire('click');
  btn(root, 'Move').fire('click');
  await flight(rig);
  assert.equal(rig.tool.ghost().rot[2], 15, 'its own spin');
  rig.state.normal = [1, 0, 0];
  rig.frame();
  key(rig, 'KeyE');
  await settle();
  assert.deepEqual([rig.standing[0].rot, rig.standing[0].paid], [[90, 0, 15], 0]);
  // taken down
  rig.frame();
  rows(panelOf(rig)).find((r) => r.dataset.key === piece.id).fire('click');
  btn(panelOf(rig), 'Take down').fire('click');
  await settle();
  assert.deepEqual([rig.standing.length, rig.pack.includes(blade), rig.said.at(-1)], [0, true, 'Ebony Longsword is back in your pack.']);
});

// ─── THE HOST ────────────────────────────────────────────────────────────────────────────────────────────────────────

test('DECOR2c the host (worldModes.js) by source: the room\'s mounts and the one being hung are drawn on the decal pass, after the room\'s solid models and before its billboards; the room is handed the renderer whose decal pass and texture cache hang them (mutants: the mounts undrawn, the ghost undrawn)', () => {
  const m = src('src/scenes/worldModes.js');
  assert.match(m, /decorTool\.draw\(renderer, interiorCtx\.texRemap\);[^\n]*\n\s*interiorDecor\.drawMounts\(renderer\);[^\n]*\n\s*decorTool\.drawMounts\(renderer\);/);
  assert.ok(m.indexOf('interiorDecor.drawMounts(renderer)') < m.indexOf('renderer.drawBillboards([...interiorCtx.billboardBatches'), 'before the billboards');
  assert.match(m, /const interiorDecor = createDecorRoom\(\{\n\s*meshes: \{ getGpuMesh, cpuModels \}, renderer, getTexture, uploadRecord,/);
});
