// CARP-YARD (2026-10-12, Mac: "Let's also redesign their buildings like we did with stables, etc", choosing a new
// Carpenter's Yard whose workbench is a Carpentry station; bible/03-World/Merchant-Yards.md CARP-YARD). THE JOINERY - a
// third yard on the Stables' and the Wagon Yards' machinery: its law (systems/merchantYards.js - the kind, its order after
// the port's places, its key after theirs, its one row, the bench as a station), its place (world/merchantYards/merchantYardSites.js
// craftYardSitesOn, scenes/world.js townPlacesFor), its timber and its pictures (world/merchantYards/merchantYardModels.js,
// world/merchantYards/merchantYardArt.js), the pool's press and its bench (scenes/merchantYardsHost.js), the town's talk, its map and the
// Overworld's glyph, and the street's workbench the Stores page reads (scenes/world.js workbenchHere, ui/professions/profPages.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  YARD_KINDS, YARD_KIND_ORDER, CRAFT_YARD_ORDER, ALL_YARD_KINDS, YARD_KEY_BASE, YARD_KEY_SLOT, YARD_BENCH, YARD_BENCH_ROW,
  CARPENTER_STEAL_TEXT, YARD_TALK_GROUPS, yardBuildingKey, yardStock, yardBuysItem, yardRowsFor, yardDirectoryRows, yardName,
  validYardKind,
} from '../../src/systems/merchantYards.js';
import { FOUND_KIND_ORDER, PORT_PLACE_ORDER, foundBuildingKey } from '../../src/systems/portPlaces.js';
import { WORKBENCH_FEE } from '../../src/net/professionLaw.js';
import { yardGround, yardSitesOn, craftYardSitesOn, YARD_FOOT, YARD_GAP_M, YARD_PAD_M } from '../../src/world/merchantYards/merchantYardSites.js';
import { buildYardModel, buildCarpenterModel, CARPENTER_YARD, SIGN_BOARD, signBoxOf, yardPoints, benchBoxOf, YARD_SINK } from '../../src/world/merchantYards/merchantYardModels.js';
import { yardArt, yardSignArt, YARD_ARCHIVE, YARD_REC, signGlyph, SAW_BLADE, SIGN_EMBLEM } from '../../src/world/merchantYards/merchantYardArt.js';
import { createMerchantYards, yardToScene, YARD_REACH, YARD_BENCH_RISE } from '../../src/scenes/merchantYardsHost.js';
import { yardTownBlocks, YARD_MAP_BYTE } from '../../src/world/merchantYards/merchantYardMap.js';
import { quarterOf } from '../../src/ui/town/townQuarters.js';
import { TopicTree, EN, QUESTION_TYPE } from '../../src/systems/topicTree.js';
import { yardGlyph, yardMarkKind } from '../../src/ui/travel/travelViewHud.js';
import { markGroup, isYardMark } from '../../src/systems/travel/travelViewFilters.js';
import { CAPSULE_HEIGHT } from '../../src/player/motor.js';
import { NAV_CELL } from '../../src/world/city/cityNavigation.js';
import { ROAD_WEIGHT } from '../../src/systems/gothwayBoards.js';

const read = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const KEEPER = { name: 'Aldric Thane', sex: 'male', variant: 2 };

test('CARP-YARD THE LAW: the joinery a yard kind of its own - its title, its board\'s word, its trade at the furnisher\'s fee, its carpenter - placed after the two yards and the port\'s places and keyed after them, so every key before it stays; no counter (nothing sold, nothing bought), its one row the bench; its bench a shop\'s station at WORKBENCH_FEE, the carpenter paid (mutants: the key a shipyard\'s, the fee its own, a counter row)', () => {
  assert.deepEqual(YARD_KINDS.carpenter, { key: 'carpenter', title: 'Joinery', sign: 'JOINERY', trade: 'Carpentry at the workbench - 50 gold a craft or a saw', keeper: 'Carpenter', seed: 0xca4be7 });
  assert.deepEqual([...YARD_KIND_ORDER], ['stable', 'transport'], 'the two placed first, as they always were');
  assert.deepEqual([...CRAFT_YARD_ORDER], ['carpenter']);
  assert.deepEqual([...ALL_YARD_KINDS], ['stable', 'transport', 'carpenter']);
  assert.equal(validYardKind('carpenter'), 'carpenter');
  // the keys: the yards' two and the port's four as they were; the joinery's past them, its place in the found order
  assert.deepEqual(['stable', 'transport', 'carpenter'].map(yardBuildingKey), [YARD_KEY_BASE, YARD_KEY_BASE + 1, YARD_KEY_BASE + 6]);
  assert.deepEqual(PORT_PLACE_ORDER.map(foundBuildingKey), [2, 3, 4, 5].map((i) => YARD_KEY_BASE + i));
  for (const k of ALL_YARD_KINDS) assert.equal(yardBuildingKey(k), foundBuildingKey(k), `${k}: one key, the found order's`);
  assert.equal(YARD_KEY_SLOT.carpenter, FOUND_KIND_ORDER.indexOf('carpenter'));
  assert.equal(new Set(FOUND_KIND_ORDER.map(foundBuildingKey)).size, FOUND_KIND_ORDER.length, 'no two places share a key');
  assert.equal(YARD_TALK_GROUPS.carpenter, 'Carpenters');
  // no counter
  assert.deepEqual(yardStock('carpenter', { mapId: 7, day: 3, online: true }), []);
  assert.equal(yardBuysItem('carpenter', { templateIndex: 0 }), false);
  assert.deepEqual(yardRowsFor('carpenter'), [{ id: 'bench', label: 'Workbench' }]);
  assert.deepEqual(yardRowsFor('carpenter')[0], YARD_BENCH_ROW);
  assert.deepEqual(yardRowsFor('stable').map((r) => r.id), ['buy', 'sell'], 'the Stable\'s rows unchanged');
  assert.deepEqual(yardRowsFor('transport').map((r) => r.id), ['buy', 'sell', 'mend'], 'the Wagon Yard\'s unchanged');
  // the bench as a station
  assert.deepEqual(YARD_BENCH, { kind: 'shop', fee: 50, who: 'carpenter', yard: true });
  assert.equal(YARD_BENCH.fee, WORKBENCH_FEE, 'no bench a cheaper one');
  assert.equal(yardName('carpenter', KEEPER.name), 'Thane\'s Joinery');
});

/** A town of two blocks by two, open ground with a road along rows 64-65 (yardsfound1's own). */
const ground = (blockedRect = null) => yardGround({
  width: 128, height: 128,
  weightAt: (gx, gy) => (gx < 0 || gy < 0 || gx >= 128 || gy >= 128 ? 0
    : blockedRect && gx >= blockedRect[0] && gx < blockedRect[2] && gy >= blockedRect[1] && gy < blockedRect[3] ? 0
      : gy === 64 || gy === 65 ? ROAD_WEIGHT : 1),
});
const overlaps = (a, b, gap = 0) => a.gx < b.gx + b.nx + gap && b.gx < a.gx + a.nx + gap && a.gy < b.gy + b.nz + gap && b.gy < a.gy + a.nz + gap;

test('CARP-YARD THE PLACE: the joinery placed on what the two yards (and a port town\'s places) left - the Stable and the Wagon Yard stand exactly where they stood without it, the joinery clear of both by YARD_GAP_M; the host calls it after the port\'s places; a town with no room left stands none of it and moves nothing (mutants: placed first, the ground not closed)', () => {
  const before = yardSitesOn(ground());
  const g = ground(), two = yardSitesOn(g), [carp] = craftYardSitesOn(g);
  assert.deepEqual(two, before, 'the two yards where they always stood');
  assert.equal(carp.kind, 'carpenter');
  const gap = Math.ceil(YARD_GAP_M / NAV_CELL - 1e-9);
  for (const s of two) assert.equal(overlaps(carp, s, gap), false, `clear of the ${s.kind}`);
  const F = YARD_FOOT.carpenter;
  assert.deepEqual(F, { hx: 7, hz: 6 });
  assert.deepEqual([carp.nx, carp.nz].sort(), [Math.ceil((2 * F.hx) / NAV_CELL - 1e-9), Math.ceil((2 * F.hz) / NAV_CELL - 1e-9)].sort());
  // a placed joinery closes its ground: a second placing on the same ground finds another spot or none, never this one
  const [again] = craftYardSitesOn(g);
  if (again) assert.equal(overlaps(again, carp), false);
  // a cramped town: room for the two alone - the joinery stands nowhere, and the two are unmoved
  const cramped = ground([0, 0, 128, 128]);
  assert.deepEqual(craftYardSitesOn(cramped), []);
  // the host: the joinery after the port's places, on the same ground
  const w = read('src/scenes/world.js');
  const at = (t) => w.indexOf(t);
  assert.ok(at('const sites = g && yardTown ? yardSitesOn(g) : [];') > 0);
  assert.ok(at('ports = portSitesOn(g, seaField(') > at('const sites = g && yardTown ? yardSitesOn(g) : [];'));
  assert.ok(at('if (g && yardTown) sites.push(...craftYardSitesOn(g));') > at('ports = portSitesOn(g, seaField('), 'placed after the port\'s places');
  assert.ok(at('memo = { sig, sites, ports };') > at('if (g && yardTown) sites.push(...craftYardSitesOn(g));'));
});

test('CARP-YARD THE TIMBER: the joinery the port\'s own geometry inside its ground, its logs\' and its block\'s faces out, in the yards\' pictures - its board, its shavings, its bark and its end grain; the board over a walker\'s head; the gate\'s way in open to a walker; the carpenter\'s place and the workbench clear of every face (mutants: a face wound in, the sign low, the way in blocked)', () => {
  const m = buildCarpenterModel(), F = YARD_FOOT.carpenter;
  assert.deepEqual(buildYardModel('carpenter'), m, 'the kind\'s model');
  assert.ok(m.positions.length > 0 && m.positions.every(Number.isFinite));
  assert.equal(m.indices.length, m.positions.length / 3);
  for (let i = 0; i < m.positions.length; i += 3) {
    assert.ok(Math.abs(m.positions[i]) <= F.hx + YARD_PAD_M && Math.abs(m.positions[i + 2]) <= F.hz + YARD_PAD_M, 'inside its ground and its ring (the eaves)');   // the Stable's own allowance (merchantyards1 THE TIMBER)
    assert.ok(Math.abs(m.positions[i]) <= F.hx + 0.31 && Math.abs(m.positions[i + 2]) <= F.hz + 0.21, 'and the eaves no farther than the lean-to\'s own overhang');
    assert.ok(m.positions[i + 1] >= -YARD_SINK - 1e-6 && m.positions[i + 1] < 4, 'from its sunk feet to its roof');   // a Float32Array's -0.3
  }
  // THE ROUND THINGS FACE OUT (the world pass culls a face's back): every face of bark or end grain - the five logs (their
  // axes along z) and the chopping block (its axis up) - looks away from the axis it is nearest, a sawn end out along its
  // own log, the block's top up
  const axes = [[-5.6, 0.28], [-5.0, 0.28], [-4.4, 0.28]];
  const up = Math.sqrt(0.56 ** 2 - 0.3 ** 2);
  axes.push([-5.3, 0.28 + up], [-4.7, 0.28 + up]);
  let round = 0;
  for (const sm of m.subMeshes.filter((x) => x.textureRecord === YARD_REC.bark || x.textureRecord === YARD_REC.endgrain)) {
    for (let t = sm.startIndex; t < sm.startIndex + sm.primitiveCount * 3; t += 3) {
      const c = [0, 1, 2].map((j) => (m.positions[t * 3 + j] + m.positions[(t + 1) * 3 + j] + m.positions[(t + 2) * 3 + j]) / 3);
      const n = [0, 1, 2].map((j) => m.normals[t * 3 + j]);
      // the nearest axis: a log's line along z, or the block's along y at (0.9, 0)
      let best = null, bestD = Infinity;
      for (const [ax, ay] of axes) { const d = Math.hypot(c[0] - ax, c[1] - ay); if (d < bestD) { bestD = d; best = [ax, ay, c[2]]; } }
      const dBlock = Math.hypot(c[0] - 0.9, c[2]);
      const onBlock = dBlock < bestD;
      if (onBlock) best = [0.9, c[1], 0];
      // bark out from its axis; a sawn end out along its log (the logs' middle z -0.6), the block's top up
      const out = sm.textureRecord === YARD_REC.bark ? [c[0] - best[0], c[1] - best[1], c[2] - best[2]] : onBlock ? [0, 1, 0] : [0, 0, c[2] + 0.6];
      assert.ok(n[0] * out[0] + n[1] * out[1] + n[2] * out[2] > 0, `a ${sm.textureRecord === YARD_REC.bark ? 'bark' : 'sawn'} face at ${c.map((v) => v.toFixed(2))} faces out`);
      round++;
    }
  }
  assert.ok(round > 150, 'the logs and the block measured');
  assert.ok(m.subMeshes.every((s) => s.textureArchive === YARD_ARCHIVE && Object.values(YARD_REC).includes(s.textureRecord)));
  const recs = m.subMeshes.map((s) => s.textureRecord);
  for (const r of [YARD_REC.signCarpenter, YARD_REC.shavings, YARD_REC.bark, YARD_REC.endgrain, YARD_REC.shingle]) assert.ok(recs.includes(r), `record ${r} worn`);
  assert.ok(!recs.includes(YARD_REC.signStable) && !recs.includes(YARD_REC.signTransport), 'its own board alone');
  // the board: hung from the gate's beam, over a walker's head; the press's box round it
  const sb = signBoxOf('carpenter');
  assert.ok(sb[1] > CAPSULE_HEIGHT + 0.3, 'the sign clears a walker');
  const G = CARPENTER_YARD.gate, z1 = CARPENTER_YARD.fence.z1;
  assert.ok(G.beamY - 0.2 - SIGN_BOARD.h > CAPSULE_HEIGHT + 0.3);
  // every vertex: none in the way in (the gate's opening up to a walker's height and a little), none in the carpenter's
  // place, none in the air over the workbench's front where the player stands at it
  const K = CARPENTER_YARD.keeper, B = CARPENTER_YARD.bench;
  const inBox = (p, b) => p[0] > b[0] && p[0] < b[3] && p[1] > b[1] && p[1] < b[4] && p[2] > b[2] && p[2] < b[5];
  const way = [-G.half + 0.25, 0.05, z1 - 1.5, G.half - 0.25, CAPSULE_HEIGHT + 0.3, z1 + 1.4];
  const keeper = [K[0] - 0.35, 0.05, K[1] - 0.35, K[0] + 0.35, 2, K[1] + 0.35];
  const standing = [B[0], 0.05, B[5] + 0.45, B[3], 2, B[5] + 1.6];
  for (let i = 0; i < m.positions.length; i += 3) {
    const p = [m.positions[i], m.positions[i + 1], m.positions[i + 2]];
    assert.ok(!inBox(p, way), `the way in open: ${p}`);
    assert.ok(!inBox(p, keeper), `the carpenter's place clear: ${p}`);
    assert.ok(!inBox(p, standing), `the bench's front clear: ${p}`);
  }
  // the workbench under the workshop's roof, its box the press's
  assert.ok(B[2] > CARPENTER_YARD.shop.z0 && B[5] < CARPENTER_YARD.shop.z1, 'the bench under the roof');
  const bb = benchBoxOf();
  assert.deepEqual(yardPoints('carpenter'), { keeper: K, horses: [], wagons: [], bench: bb });
  assert.ok(bb[0] <= B[0] && bb[3] >= B[3] && bb[2] <= B[2] && bb[5] >= B[5] && bb[4] > B[4], 'the press\'s box holds the bench');
  assert.equal(yardPoints('stable').bench, null);
  assert.equal(yardPoints('transport').bench, null);
});

test('CARP-YARD THE ART: fourteen pictures by record, the joinery\'s four besides the yards\' ten; its board the hand saw and JOINERY - every letter drawn (J and Y the board\'s new two), the saw clear of the word, its own board the same twice and like no other (mutants: the saw over the word, a letter lost)', () => {
  const art = yardArt();
  assert.deepEqual(art.map(([r]) => r), [...Array(14).keys()]);
  assert.deepEqual([YARD_REC.signCarpenter, YARD_REC.shavings, YARD_REC.endgrain, YARD_REC.bark], [10, 11, 12, 13]);
  for (const ch of YARD_KINDS.carpenter.sign) assert.ok(signGlyph(ch), `"${ch}" is drawn`);
  assert.deepEqual(signGlyph('J'), ['..###', '....#', '....#', '....#', '#...#', '#...#', '.###.']);
  assert.deepEqual(signGlyph('Y'), ['#...#', '#...#', '.#.#.', '..#..', '..#..', '..#..', '..#..']);
  const board = yardSignArt('carpenter');
  assert.deepEqual(board.colors, yardSignArt('carpenter').colors);
  assert.notDeepEqual(board.colors, yardSignArt('stable').colors);
  assert.notDeepEqual(board.colors, yardSignArt('transport').colors);
  assert.ok(SAW_BLADE.x1 + 1 < SIGN_EMBLEM + 8, 'the saw\'s painted edge stops short of the word');
  // the blade is steel on the board: a texel in its middle is grey (its channels near each other), not the board's brown
  const at = (x, y) => { const i = (y * board.width + x) * 4; return [board.colors[i], board.colors[i + 1], board.colors[i + 2]]; };
  const mid = at(Math.round((SAW_BLADE.x0 + SAW_BLADE.x1) / 2), SAW_BLADE.back + 6);
  assert.ok(Math.max(...mid) - Math.min(...mid) < 20 && mid[0] > 90, `the blade grey: ${mid}`);
});

function rig(sites) {
  const log = { benches: [], say: [], mid: [], opened: [], buckets: new Map() };
  const renderer = {
    textures: new Set(), uploadTexture: () => {}, createMesh: () => ({}), destroyMesh: () => {}, drawMesh: () => {},
    createBillboardBatch: (a, r, size) => ({ a, r, size }), destroyBillboardBatch: () => {},
  };
  const collider = { addMesh: (key, pos, idx, m) => log.buckets.set(key, { pos, idx, m }), removeBucket: (key) => log.buckets.delete(key) };
  const tex = { getSize: () => ({ width: 40, height: 76 }), getScale: () => ({ width: 0, height: 0 }), getFrameCount: () => 3 };
  const y = createMerchantYards({
    renderer, collider: () => collider, getTexture: async () => tex, uploadRecordFrame: () => {},
    sites: () => sites, groundAt: () => 2, eye: () => [0, 3, 0], feet: () => null, horseArt: () => true,
    open: (site, mode) => { log.opened.push([site.key, mode]); return true; },
    say: (t) => log.say.push(t), midText: (t) => log.mid.push(t), now: () => 1000,
    bench: (site) => { log.benches.push(site.key); return true; },
  });
  return { y, log };
}

test('CARP-YARD THE POOL: the joinery stood as a yard is - its timber under its bucket, its carpenter on the flats\' axis; the eye\'s boxes its carpenter, its board and its WORKBENCH; the plaque its name, the carpenter and the trade, its one row the bench; a press on the carpenter, the board or the bench - with no row lit or the bench\'s - is the host\'s bench, never a counter; Info names the carpenter; Steal takes nothing, in his word (mutants: the bench\'s box lost, a counter opened, the stable\'s steal word)', async () => {
  const site = { key: '7:carpenter', kind: 'carpenter', x: 100, z: 50, yaw: 90, comp: 0, regionIndex: 17, race: 'Breton', keeper: KEEPER };
  const { y, log } = rig([site]);
  y.frame(); await new Promise((r) => setTimeout(r, 0)); y.frame();
  assert.ok(log.buckets.has('yard:7:carpenter'), 'its timber in the collider');
  const keys = y.targets().map((t) => t.key);
  assert.deepEqual(keys, ['yard:7:carpenter|keeper', 'yard:7:carpenter|sign', 'yard:7:carpenter|bench']);
  const benchT = y.targets()[2];
  assert.equal(benchT.reach, YARD_REACH);
  const bb = benchBoxOf(), mid = yardToScene([100, 2, 50], 90, (bb[0] + bb[3]) / 2, 0, (bb[2] + bb[5]) / 2);
  assert.ok(Math.abs((benchT.aabb.min[0] + benchT.aabb.max[0]) / 2 - mid[0]) < 1e-9 && Math.abs((benchT.aabb.min[2] + benchT.aabb.max[2]) / 2 - mid[2]) < 1e-9, 'the bench\'s box where the bench stands, turned with the yard');
  assert.deepEqual(y.hoverName('yard:7:carpenter|keeper'), { title: 'Thane\'s Joinery', subs: ['Carpenter: Aldric Thane', YARD_KINDS.carpenter.trade], actions: [{ id: 'bench', label: 'Workbench' }] });
  assert.deepEqual(y.hoverName('yard:7:carpenter|bench'), { title: 'Workbench', subs: ['Thane\'s Joinery', YARD_KINDS.carpenter.trade], actions: [YARD_BENCH_ROW] });
  for (const [k, verb] of [['keeper', null], ['sign', null], ['bench', null], ['keeper', 'bench'], ['bench', 'bench']]) {
    assert.equal(y.activate(`yard:7:carpenter|${k}`, 'grab', verb), true);
  }
  assert.equal(log.benches.length, 5, 'every press the bench');
  assert.deepEqual(log.opened, [], 'never a counter');
  y.activate('yard:7:carpenter|keeper', 'info');
  assert.match(log.say.at(-1), /Aldric Thane, the carpenter/);
  y.activate('yard:7:carpenter|bench', 'steal');
  assert.equal(log.mid.at(-1), CARPENTER_STEAL_TEXT);
  assert.equal(log.benches.length, 5, 'neither Info nor Steal works the bench');
  assert.deepEqual(y.overworldMarks().map((m) => [m.label, m.kind]), [['Thane\'s Joinery', 'yard carpenter']]);
  y.dispose();
});

test('CARP-YARD THE BENCH IS A STATION WHERE THE FEET STAND AT IT: workbenchNear answers the joinery one of whose doors is within YARD_REACH across the ground and YARD_BENCH_RISE up or down - nothing farther, nothing above it on a roof, nothing with no feet; a Stable has no bench (mutants: the reach unread, the rise unread)', () => {
  const site = { key: '7:carpenter', kind: 'carpenter', x: 100, z: 50, yaw: 180, comp: 0, regionIndex: 17, race: 'Breton', keeper: KEEPER };
  const stable = { key: '7:stable', kind: 'stable', x: 140, z: 50, yaw: 0, comp: 0, regionIndex: 17, race: 'Breton', keeper: KEEPER };
  const { y } = rig([site, stable]);
  y.frame();
  const bb = benchBoxOf(), mid = yardToScene([100, 2, 50], 180, (bb[0] + bb[3]) / 2, 0, (bb[2] + bb[5]) / 2);
  assert.equal(y.workbenchNear([mid[0], 2, mid[2] + 1]), site, 'at the bench');
  // PIN MOVED (FB1020c BENCH-DOORS): the reach is measured to the nearest point of a door's box, never the bench's middle -
  // these two stand east of the bench's end, where the carpenter and the board are farther still
  const end = y.targets().find((t) => t.key === 'yard:7:carpenter|bench').aabb.max[0];
  assert.equal(y.workbenchNear([end + YARD_REACH - 0.01, 2, mid[2]]), site, 'at the reach');
  assert.equal(y.workbenchNear([end + YARD_REACH + 0.01, 2, mid[2]]), null, 'past it');
  assert.equal(y.workbenchNear([mid[0], 2 + YARD_BENCH_RISE + 0.01, mid[2]]), null, 'over it, on its roof');
  assert.equal(y.workbenchNear([mid[0], 2 - YARD_BENCH_RISE - 0.01, mid[2]]), null, 'under it');
  assert.equal(y.workbenchNear(null), null);
  assert.equal(y.workbenchNear([140, 2, 50]), null, 'the Stable stands no bench');
  y.dispose();
});

test('CARP-YARD FOUND AS A YARD IS: a row of the town\'s talk directory under its own key, a "Carpenters" group on the Where-is page after the port\'s, asked as a building; its ground in a shop\'s byte on both town maps and its name lettered; the Overworld\'s mark the board\'s saw, with the Towns switch (mutants: the group lost, the glyph a horseshoe)', () => {
  const site = { kind: 'carpenter', x: 60, z: 40, gx: 30, gy: 20, nx: 9, nz: 8, keeper: KEEPER };
  const [row] = yardDirectoryRows([site]);
  assert.deepEqual(row, { name: 'Thane\'s Joinery', buildingType: 'yard:carpenter', factionId: 0, quality: 10, position: [60, 0, 40], buildingKey: YARD_KEY_BASE + 6, yard: 'carpenter' });
  const tree = new TopicTree({
    getQuest: () => null, getAllActiveQuestIds: () => [], currentRegionIndex: () => 17, currentRegionName: () => 'Daggerfall',
    currentLocationName: () => 'Daggerfall', currentMapId: () => 7, isPlayerInside: () => false, isPlayerInsideBuilding: () => false,
    isPlayerInsideCastle: () => false, currentBuildingKey: () => -1, exteriorBuildings: () => [], factionName: (id) => `f:${id}`,
    getBuildingList: () => [...yardDirectoryRows([{ kind: 'stable', x: 10, z: 10, keeper: KEEPER }]), row],
  });
  tree.assembleTopicListLocation();
  assert.deepEqual(tree.listTopicLocation.map((g) => g.caption), ['Stables', 'Carpenters', EN.regional]);
  const g = tree.listTopicLocation.find((x) => x.caption === 'Carpenters');
  assert.deepEqual(g.listChildItems.slice(1).map((c) => [c.caption, c.questionType, c.buildingKey]), [['Thane\'s Joinery', QUESTION_TYPE.LocalBuilding, YARD_KEY_BASE + 6]]);
  // the town map
  const rows = [0, 1].flatMap((by) => [0, 1].map((bx) => ({ x: bx, y: by, autoMap: new Uint8Array(64 * 64), landmark: null })));
  const out = yardTownBlocks(rows, [site]);
  assert.equal(quarterOf(YARD_MAP_BYTE), 'shop');
  assert.ok(out.some((r) => r.autoMap.includes(YARD_MAP_BYTE)), 'its ground in a shop\'s byte');
  assert.deepEqual(out.flatMap((r) => (r.places ?? []).map((p) => p.name)), ['Thane\'s Joinery']);
  // the Overworld
  const m = { kind: 'yard carpenter' };
  assert.equal(yardMarkKind(m), 'carpenter');
  assert.equal(isYardMark(m), true);
  assert.equal(markGroup(m.kind), 'towns');
  const ops = (kind) => {
    const log = [];
    const ctx = new Proxy({ fillStyle: '#fff' }, { get: (t, k) => (k in t ? t[k] : (...a) => { log.push([k, ...a]); }), set: (t, k, v) => { t[k] = v; return true; } });
    yardGlyph(ctx, 50, 60, kind, '#c08a3e');
    return log.map(([k]) => k);
  };
  const saw = ops('carpenter'), shoe = ops('stable');
  assert.notDeepEqual(saw, shoe, 'not the Stable\'s horseshoe');
  assert.ok(saw.includes('rect') && saw.filter((k) => k === 'fillRect').length === 4, 'the saw: its handle and its four teeth');
});

test('CARP-YARD THE HOSTS: the street\'s workbench is the host\'s own question - a joinery\'s bench outdoors, the modes\' indoors - asked by the craft, the Stores page and the saw alike; the bench\'s press opens the Stores page on the workbench, or says the bench is bare where the page is not; the page names the joinery\'s carpenter and keeps the furnisher\'s Linen a Furniture Store\'s; the bench (exterior.js) stands no yard, worldModes\' street ray reaches every yard key (mutants: a call site still the modes\', the landing lost)', () => {
  const w = read('src/scenes/world.js');
  assert.match(w, /function workbenchHere\(\) \{\n\s+if \(_mode\(\) !== 'exterior'\) return modes\?\.workbenchHere\?\.\(\) \?\? null;\n\s+return merchantYards\?\.workbenchNear\?\.\(walkMode && playerSpawned \? player\.feetAt\(\) : null\) \? YARD_BENCH : null;\n\s+\}/);
  assert.equal((w.match(/modes\?\.workbenchHere\?\.\(\)/g) ?? []).length, 1, 'the modes\' asked from the host\'s question alone');
  assert.match(w, /here: \(\) => workbenchHere\(\), a: 'a workbench'/);
  assert.match(w, /workbench: \(\) => workbenchHere\(\),/);
  assert.match(w, /: bench \? workbenchHere\(\) : modes\?\.forgeHere\?\.\(\)\) \?\? null;/);
  assert.match(w, /bench: \(\) => openYardBench\(\),/);
  assert.match(w, /function openYardBench\(\) \{\n\s+if \(!forgeOffered\(\)\) \{ townTalk\.say\(stationColdLine\('workbench'\)\); return true; \}[^\n]*\n\s+focusStoresStation\('workbench'\);\n\s+hudCtx\.togglePause\(\{ at: 'stores' \}\);/);
  assert.match(w, /`The \$\{f\.who \?\? st\.who\} asks \$\{f\.fee\} gold for the use of the \$\{st\.noun\}\.`/);
  assert.match(w, /bench \? \(f\.who \?\? 'furnisher'\) : 'smith'/);
  const pp = read('src/ui/professions/profPages.js');
  assert.match(pp, /detail\.append\(stationHead\(divider, t\('prof\.page\.bench', 'The Workbench'\), 'workbench'\)\);/);
  assert.match(pp, /const who = bench\.who \?\? 'furnisher';/);
  assert.match(pp, /sale\?\.counter === 'furnisher' && have < inp\.n && bench\.kind === 'shop' && !bench\.yard\) counterBuy\(/);
  assert.doesNotMatch(read('src/scenes/exterior.js'), /merchantYards|craftYardSitesOn/, 'the bench stands no yard');
  assert.match(read('src/scenes/worldModes.js'), /if \(typeof key === 'string' && key\.startsWith\('yard:'\)\) \{/);
});
