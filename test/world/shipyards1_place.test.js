// SHIPYARDS (2026-10-11; Mac chose "Town's seaward edge" and "Climbable, with keeper"): WHERE A PORT TOWN'S SHIPYARD AND
// LIGHTHOUSE STAND AND WHAT THEY ARE - world/portSites.js (the town's own sea, the sea's bearing off the map, each place
// backing onto the water on what the yards left), world/shipyardModel.js and world/lighthouseModel.js (their timber and
// stone under the port's own art, world/portArt.js), and scenes/portHost.js (the pool: each place stood, its people,
// the press - the shipmaster's window and the tower's stair - the lamp lit and its beams turning, the Overworld's marks).
// Design: bible/03-World/Shipyards.md.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  PORT_FOOT, SEA_CELLS_MIN, FACE_K, LIGHT_APART_CAP, portSpans, townSeaOf, seaBearing, seaField, backMiddle, frontMiddle, portSite, portSitesOn,
  siteToLocation,
} from '../../src/world/portSites.js';
import { YARD_PAD_M, YARD_TURNS } from '../../src/world/merchantYards/merchantYardSites.js';
import { NAV_CELL, NAV_CELLS_PER_BLOCK } from '../../src/world/city/cityNavigation.js';
import { buildShipyardModel, SHIPYARD, shipsSignBox, hullBox, noticesBox, crewSignBox } from '../../src/world/shipyardModel.js';
import { buildLighthouseModel, LIGHTHOUSE, LIGHTHOUSE_POINTS, GALLERY_Y, guardBand, doorBox, hatchBox, lanternBox, towerR } from '../../src/world/lighthouseModel.js';
import { portArt, portSignArt, PORT_ARCHIVE, PORT_REC } from '../../src/world/portArt.js';
import { YARD_ARCHIVE, YARD_REC } from '../../src/world/merchantYards/merchantYardArt.js';
import {
  createPortHost, folkOf, peopleOf, feetInPort, beamPuffs, PORT_REACH, PORT_MARK_LIFT, LAMP_RANGE, OFFICE_LAMP_RANGE, BEAM_PUFFS, BEAM_PERIOD_S,
  BEAM_SEEN_M, SHIPYARD_ROWS, CREW_ROWS, CLIMB_ROWS, DOWN_ROWS, PORT_TEXT,
} from '../../src/scenes/portHost.js';
import { yardToScene } from '../../src/scenes/merchantYardsHost.js';
import { STATIC_NPC_ACTIVATION_DISTANCE, RAY_DISTANCE, presentNpcInfoText } from '../../src/player/activate.js';
import { PORT_PLACES } from '../../src/systems/portPlaces.js';
import { setTutorialHandler, _resetTutorialTriggerForTests } from '../../src/systems/tutorials.js';
import { _resetForTests as resetPrefs } from '../../src/systems/uiPrefs.js';

/** A town's ground (yardGround's shape) W x H cells: open, `blockedAt` closed, `roadAt` its roads. */
function ground(W, H, { blockedAt = () => false, roadAt = () => false } = {}) {
  const blocked = new Uint8Array(W * H), road = new Uint8Array(W * H);
  for (let gy = 0; gy < H; gy++) for (let gx = 0; gx < W; gx++) { blocked[gy * W + gx] = blockedAt(gx, gy) ? 1 : 0; road[gy * W + gx] = roadAt(gx, gy) ? 1 : 0; }
  return { width: W, height: H, blocked, road };
}
const cellsOf = (s) => { const out = []; for (let gy = s.gy; gy < s.gy + s.nz; gy++) for (let gx = s.gx; gx < s.gx + s.nx; gx++) out.push([gx, gy]); return out; };
/** A town by the sea: W x H cells, the sea east of column `shore` - the town's own (`townSea`) - a road across at row `roadRow`. */
function seaside({ W = 128, H = 96, shore = 104, roadRow = 48 } = {}) {
  const g = ground(W, H, { blockedAt: (gx) => gx >= shore, roadAt: (gx, gy) => gx < shore && gy === roadRow });
  const sea = new Uint8Array(W * H);
  let cells = 0;
  for (let gy = 0; gy < H; gy++) for (let gx = shore; gx < W; gx++) { sea[gy * W + gx] = 1; cells++; }
  return { g, field: seaField(W, H, { sea, cells }, [0, 0]), W, H, shore };
}

test('SHIPYARDS THE FOOTPRINTS: each place a rectangle turned to one of the four axes - its cells spans across x and z, a quarter turn swapping them', () => {
  assert.deepEqual(PORT_FOOT.shipyard, { hx: 11, hz: 8 });
  assert.deepEqual(PORT_FOOT.lighthouse, { hx: 6.5, hz: 6.5 });
  assert.deepEqual(portSpans('shipyard', 0), [Math.ceil(22 / NAV_CELL - 1e-9), Math.ceil(16 / NAV_CELL - 1e-9)]);
  assert.deepEqual(portSpans('shipyard', 1), [...portSpans('shipyard', 0)].reverse());
  assert.deepEqual(portSpans('lighthouse', 3), portSpans('lighthouse', 0));
  // the back edge's middle and the front's: turn 0 fronts +z, 1 +x, 2 -z, 3 -x (YARD_TURNS)
  assert.deepEqual([backMiddle(10, 20, 8, 6, 0), frontMiddle(10, 20, 8, 6, 0)], [[14, 20], [14, 25]]);
  assert.deepEqual([backMiddle(10, 20, 8, 6, 3), frontMiddle(10, 20, 8, 6, 3)], [[17, 23], [10, 23]]);
});

test('SHIPYARDS BACK TO THE SEA: on a town whose own blocks hold the sea, the shipyard stands at the water\'s edge with its back to it (its slipway\'s end) and its gate to the town; the lighthouse backs onto it too, standing off the yard; neither on a road, a closed cell or the other, the same on every run (mutants: the face unread, the apart unread)', () => {
  const { g, field, shore } = seaside();
  assert.equal(field.kind, 'water');
  assert.equal(field.at(shore - 1, 10), 1);
  assert.equal(field.at(shore - 5, 10), 5);
  const sites = portSitesOn(g, field);
  assert.deepEqual(sites.map((s) => s.kind), ['shipyard', 'lighthouse']);
  const [yard, light] = sites;
  const pad = Math.ceil(YARD_PAD_M / NAV_CELL - 1e-9);
  for (const s of sites) {
    assert.equal(s.turn, 3, `${s.kind}: its front to the west, its back to the sea`);
    assert.equal(s.yaw, YARD_TURNS[3]);
    assert.ok(s.gx + s.nx + pad <= shore, `${s.kind}: off the water by its pad`);
    assert.ok(shore - (s.gx + s.nx) <= pad + 1, `${s.kind}: at the water's edge`);
    for (const [gx, gy] of cellsOf(s)) assert.ok(gy !== 48, `${s.kind} on no road`);
    assert.equal(s.x, (s.gx + s.nx / 2) * NAV_CELL);
  }
  const apart = Math.hypot(yard.gx + yard.nx / 2 - (light.gx + light.nx / 2), yard.gy + yard.nz / 2 - (light.gy + light.nz / 2));
  assert.ok(apart >= LIGHT_APART_CAP * 0.9, `the light stands off the yard (${apart.toFixed(1)} cells)`);
  const yc = new Set(cellsOf(yard).map(([x, y]) => `${x},${y}`));
  assert.ok(cellsOf(light).every(([x, y]) => !yc.has(`${x},${y}`)), 'never on the yard');
  const again = seaside();
  assert.deepEqual(portSitesOn(again.g, again.field), sites, 'the same on every client');
  assert.ok(FACE_K > 1);
});

test('SHIPYARDS THE SEA\'S BEARING: where the town\'s blocks hold no sea, the map\'s pixels round the town\'s say where it lies (two near, one far; the map\'s y south, the frame\'s z north) - the places stand on that side; no sea either way, the town\'s middle (mutants: the y unturned, the ring\'s weights)', () => {
  // the sea east of the town's pixel: three near (weight two, a pixel east), two far in the near column's corners and
  // five far in the next (weight one, one and two pixels east) - 6 + 2 + 10
  assert.deepEqual(seaBearing(10, 10, (x) => x > 10), [18, 0], 'east: x only');
  const [ex, ez] = seaBearing(10, 10, (x) => x > 10);
  assert.ok(ex > 0 && ez === 0, 'the sea to the east');
  const [nx, nz] = seaBearing(10, 10, (x, y) => y < 10);
  assert.ok(nz > 0 && nx === 0, 'the map\'s north is the frame\'s +z');
  assert.deepEqual(seaBearing(10, 10, (x, y) => x === 11 && y === 10), [2, 0], 'a near pixel weighs two');
  assert.deepEqual(seaBearing(10, 10, (x, y) => x === 12 && y === 10), [2, 0], 'a far one one, twice as far');
  assert.deepEqual(seaBearing(10, 10, () => false), [0, 0]);
  assert.deepEqual(seaBearing(10, 10, (x, y) => !(x === 10 && y === 10)), [0, 0], 'all round evenly: no bearing');
  const W = 96, H = 80;
  const f = seaField(W, H, null, [0, 5]);
  assert.equal(f.kind, 'bearing');
  assert.ok(f.at(40, H - 1) < f.at(40, 0), 'the north edge nearer the sea');
  assert.ok(f.at(W / 2, H - 1) < f.at(2, H - 1), 'the edge\'s middle nearest');
  const sites = portSitesOn(ground(W, H), f);
  assert.equal(sites.length, 2);
  for (const s of sites) { assert.equal(s.turn, 2, `${s.kind}: its front to the south, its back north to the sea`); assert.ok(s.gy + s.nz >= H - 8, `${s.kind}: at the north edge`); }
  const mid = seaField(W, H, { sea: new Uint8Array(W * H), cells: 0 }, [0, 0]);
  assert.equal(mid.kind, 'middle');
  assert.ok(mid.at(W / 2, H / 2) < mid.at(0, 0));
});

test('SHIPYARDS THE TOWN\'S OWN SEA: open water cells of a body reaching the block grid\'s edge with SEA_CELLS_MIN cells at least - never a pond in the town, never a cell an automap byte covers; the rows flipped per block as the navgrid\'s are', () => {
  const N = NAV_CELLS_PER_BLOCK;
  /** one block: its automap 0, its tiles water where `wet(tx, ty)` (4 x 4 cells a tile), grass elsewhere */
  const block = (x, y, wet, built = () => false) => {
    const autoMapData = new Uint8Array(N * N);
    for (let cy = 0; cy < N; cy++) for (let cx = 0; cx < N; cx++) if (built(cx, cy)) autoMapData[cy * N + cx] = 5;
    const groundTiles = Array.from({ length: 16 }, (_, tx) => Array.from({ length: 16 }, (__, ty) => ({ textureRecord: wet(tx, ty) ? 0 : 2 })));
    return { x, y, dfBlock: { rmbBlock: { fldHeader: { autoMapData, groundData: { groundTiles } } } } };
  };
  const coast = townSeaOf({ width: 2, height: 1, blocks: [block(0, 0, () => false), block(1, 0, (tx) => tx >= 12)] });
  assert.equal(coast.width, 2 * N);
  assert.equal(coast.cells, 16 * N, 'the east block\'s last four tiles: its sea');
  assert.equal(coast.sea[5 * coast.width + 2 * N - 1], 1);
  assert.equal(coast.sea[5 * coast.width + N + 47], 0);
  const pond = townSeaOf({ width: 3, height: 3, blocks: [block(1, 1, (tx, ty) => tx >= 6 && tx <= 9 && ty >= 6 && ty <= 9)] });
  assert.equal(pond.cells, 0, 'a pond in the middle of the town is not the sea');
  const small = townSeaOf({ width: 1, height: 1, blocks: [block(0, 0, (tx, ty) => tx === 15 && ty <= 1)] });
  assert.ok(4 * 8 < SEA_CELLS_MIN && small.cells === 0, 'a body under SEA_CELLS_MIN');
  const built = townSeaOf({ width: 1, height: 1, blocks: [block(0, 0, (tx) => tx >= 12, (cx) => cx >= 48)] });
  assert.equal(built.cells, 0, 'a cell an automap byte covers is no water');
  // the rows: a block's first data row is its north edge (setBlockData's flip)
  const north = townSeaOf({ width: 1, height: 1, blocks: [block(0, 0, (tx, ty) => ty <= 3)] });
  assert.equal(north.sea[(N - 1) * N + 3], 1, 'the data\'s first rows the grid\'s last');
  assert.equal(north.sea[3], 0);
});

test('SHIPYARDS NO ROOM, NONE: a town whose ground has no open place stands none of it; one with room for the yard alone stands the yard', () => {
  const { field } = seaside();
  assert.deepEqual(portSitesOn(ground(128, 96, { blockedAt: () => true }), field), []);
  const tight = ground(40, 30);
  const sites = portSitesOn(tight, seaField(40, 30, null, [3, 0]));
  assert.ok(sites.length >= 1 && sites[0].kind === 'shipyard');
  assert.equal(portSite(null, 'shipyard', field), null);
  assert.equal(portSite(tight, 'stable', field), null, 'not a port place');
  // a site's frame in the location's: trs's turn (+90 takes +z to +x)
  assert.deepEqual(siteToLocation({ x: 10, z: 20, yaw: 90 }, 0, 2), [12, 20]);
  assert.deepEqual(siteToLocation({ x: 10, z: 20, yaw: 0 }, 1, 2), [11, 22]);
});

test('SHIPYARDS THE MODELS: the shipyard and the lighthouse under the port\'s own archive, within their footprints; the yard\'s boards, notice board and hull boxes inside its fence; the tower\'s gallery at GALLERY_Y, its lamp over it, the gallery\'s spot on its sea side and the hatch on the town\'s, the guard a closed corridor round the gallery from its floor, a collider alone (mutants: the gallery\'s spot on the town side)', () => {
  const bounds = (m) => { const b = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity]; for (let i = 0; i < m.positions.length; i += 3) for (let k = 0; k < 3; k++) { b[k] = Math.min(b[k], m.positions[i + k]); b[k + 3] = Math.max(b[k + 3], m.positions[i + k]); } return b; };
  for (const [kind, m] of [['shipyard', buildShipyardModel()], ['lighthouse', buildLighthouseModel()]]) {
    assert.ok(m.subMeshes.length > 0 && m.subMeshes.every((s) => s.textureArchive === PORT_ARCHIVE), `${kind}: the port's archive`);
    assert.ok(m.indices.length / 3 > 1000, `${kind}: ${m.indices.length / 3} triangles`);
    const b = bounds(m), F = PORT_FOOT[kind];
    assert.ok(b[0] >= -F.hx && b[3] <= F.hx && b[2] >= -F.hz && b[5] <= F.hz, `${kind} within its footprint: ${b.map((v) => v.toFixed(2))}`);
    for (const p of m.positions) assert.ok(Number.isFinite(p));
  }
  const inFence = (box) => box[0] >= SHIPYARD.fence.x0 - 0.5 && box[3] <= SHIPYARD.fence.x1 + 0.5 && box[2] >= SHIPYARD.fence.z0 - 0.5 && box[5] <= SHIPYARD.fence.z1 + 0.5;
  for (const box of [shipsSignBox(), hullBox(), noticesBox(), crewSignBox()]) assert.ok(inFence(box), JSON.stringify(box));
  assert.ok(bounds(buildLighthouseModel())[4] > GALLERY_Y + 4, 'the lantern and its roof over the gallery');
  const T = LIGHTHOUSE.tower;
  assert.equal(GALLERY_Y, T.top);
  assert.ok(LIGHTHOUSE_POINTS.lamp[1] > GALLERY_Y);
  assert.ok(LIGHTHOUSE_POINTS.gallery[2] < T.z && LIGHTHOUSE_POINTS.hatch[2] > T.z, 'the gallery\'s spot to the sea, the hatch to the town');
  const rG = Math.abs(LIGHTHOUSE_POINTS.gallery[2] - T.z);
  assert.ok(rG > LIGHTHOUSE.lantern.r && rG < LIGHTHOUSE.gallery.parapetR, 'between the lantern and the parapet');   // PIN MOVED (BEACON-TOWER): the railing a parapet
  assert.ok(LIGHTHOUSE_POINTS.foot[2] > T.z + towerR(0), 'the foot before its door');
  // PIN MOVED (AUDIT SHIPYARDS L4-1): the guard was a band over the railing, open over its top - a climb crossed it and fell
  // 19.68 m; it is a closed corridor now, from the gallery's floor to guardH, lidded in to the lantern's faces
  const band = bounds(guardBand());
  assert.ok(Math.abs(band[1] - GALLERY_Y) < 1e-5 && Math.abs(band[4] - (GALLERY_Y + LIGHTHOUSE.gallery.guardH)) < 1e-5, 'from the floor to guardH (Float32)');
  const door = doorBox();
  assert.ok(door[2] > T.z && door[1] < LIGHTHOUSE.tower.plinthH, 'its door at its foot, to the town');
  assert.ok(hatchBox()[1] < GALLERY_Y && hatchBox()[4] > GALLERY_Y);
  assert.ok(lanternBox()[1] === GALLERY_Y);
});

test('SHIPYARDS THE ART: the port\'s own archive - the yards\' timber, straw, earth and iron at their own records, the stone, whitewash, slate, glass, rope, canvas, tar, sawdust, hull, cobbles, door, notices and brass besides, the two boards (an anchor and SHIPS, a coil and CREW), and the beacon\'s flame and embers (BEACON-TOWER, PIN MOVED: the red band and the copper gone with the tower that wore them)', () => {
  const art = new Map(portArt());
  for (const [k, rec] of Object.entries(YARD_REC)) if (k in PORT_REC) assert.equal(PORT_REC[k], rec, `${k} where the yards keep it`);
  assert.notEqual(PORT_ARCHIVE, YARD_ARCHIVE);
  for (const rec of Object.values(PORT_REC)) {
    const a = art.get(rec);
    assert.ok(a, `record ${rec}`);
    assert.equal(a.colors.length, a.width * a.height * 4);
  }
  assert.equal(art.size, Object.keys(PORT_REC).length);
  assert.deepEqual([art.get(PORT_REC.signShips).width, art.get(PORT_REC.signShips).height], [224, 96]);
  assert.notDeepEqual([...portSignArt('shipyard').colors], [...portSignArt('crewhall').colors], 'two boards');
  assert.deepEqual([...portSignArt('shipyard').colors], [...portSignArt('shipyard').colors], 'the same board every time');
});

// ── the pool ───────────────────────────────────────────────────────────────────────────────────────────────────────

const KEEPER = { name: 'Halbrecht Voss', sex: 'male', variant: 1 };
function rig({ feet = null, lit = false } = {}) {
  const log = { uploads: [], meshes: 0, drawn: 0, batches: [], destroyed: [], buckets: new Map(), opened: [], climbs: [], say: [], mid: [] };
  const renderer = {
    textures: new Map(),
    uploadTexture: (a, r) => log.uploads.push([a, r]),
    createMesh: () => { log.meshes++; return { mesh: log.meshes }; },
    destroyMesh: () => {},
    drawMesh: () => { log.drawn++; },
    createBillboardBatch: (a, r, size, centers) => { const b = { a, r, size, centers }; log.batches.push(b); return b; },
    destroyBillboardBatch: (b) => log.destroyed.push(b),
  };
  const collider = { addMesh: (key, pos, idx, m) => log.buckets.set(key, { pos, idx, m }), removeBucket: (key) => log.buckets.delete(key) };
  const tex = { getSize: () => ({ width: 40, height: 76 }), getScale: () => ({ width: 0, height: 0 }), getFrameCount: () => 3 };
  const st = {
    sites: [
      { key: '9:shipyard', kind: 'shipyard', x: 100, z: 50, yaw: 270, comp: 0, regionIndex: 17, race: 'Breton', name: 'Voss\'s Shipyard', keeper: KEEPER, crewmaster: { name: 'Anna Wayrest', sex: 'female', variant: 2 }, crewName: 'Wayrest\'s Crew Hall' },
      { key: '9:lighthouse', kind: 'lighthouse', x: 160, z: 20, yaw: 270, comp: 0, regionIndex: 17, race: 'Redguard', name: 'The Sentinel Light', keeper: { name: 'Jalib', sex: 'male', variant: 0 } },
    ],
    ground: 2, feet, lit, t: 1000, climb: true,
  };
  const deps = {
    renderer, collider: () => collider, getTexture: async () => tex, uploadRecordFrame: (a, r, f) => log.uploads.push([a, `${r}#${f}`]),
    sites: () => st.sites, groundAt: () => st.ground, feet: () => st.feet, lit: () => st.lit,
    open: (site, page) => { log.opened.push([site.key, page]); return true; },
    climb: (site, way, at) => { log.climbs.push([site.key, way, at]); return st.climb; },
    say: (t) => log.say.push(t), midText: (t) => log.mid.push(t), now: () => st.t,
  };
  return { log, st, deps };
}
const tick = () => new Promise((r) => setTimeout(r, 0));

test('SHIPYARDS THE POOL STANDS THEM: each on its site\'s ground under its own bucket, its model once a kind under the port\'s art, its people on the flats\' axis - the shipyard\'s shipmaster, crewmaster, three sailors and two shipwrights, the lighthouse\'s keeper; taken down when its town goes (mutants: no bucket, a person short)', async () => {
  const { log, st, deps } = rig();
  const p = createPortHost(deps);
  assert.equal(p.frame(), 2);
  await tick();
  p.frame();
  assert.deepEqual([...log.buckets.keys()].sort(), ['port:9:lighthouse', 'port:9:shipyard']);
  assert.equal(log.meshes, 3, 'one mesh a kind, and the beacon\'s flames');   // PIN MOVED (AUDIT SHIPYARDS L5-2; BEACON-TOWER): the beacon's flames a mesh of their own (the lantern's glass and the lamp's lens were), drawn casting nothing
  assert.ok(log.uploads.some(([a]) => a === PORT_ARCHIVE), 'the port\'s art uploaded');
  assert.deepEqual(peopleOf(st.sites[0]).map((x) => x.role), ['keeper', 'crewmaster', 'recruit', 'recruit', 'recruit', 'worker', 'worker']);
  assert.deepEqual(peopleOf(st.sites[1]).map((x) => x.role), ['keeper']);
  assert.equal(p.batches().length, 8, 'everyone on the flats\' axis');
  assert.deepEqual(folkOf('9:shipyard', 'recruit', 1), folkOf('9:shipyard', 'recruit', 1), 'the same sailors on every client');
  assert.equal(p.draw(deps.renderer), 2);
  assert.deepEqual(p.state().map((s) => [s.kind, s.collider, s.people]), [['shipyard', true, 7], ['lighthouse', true, 1]]);
  st.sites = [st.sites[0]];
  p.frame();
  assert.deepEqual([...log.buckets.keys()], ['port:9:shipyard'], 'the lighthouse\'s town gone');
  assert.equal(log.destroyed.length, 1, 'its keeper\'s batch freed');
  st.ground = NaN; st.sites = [{ ...st.sites[0], x: 101 }];
  p.frame();
  assert.equal(log.buckets.size, 0, 'no ground: none stands');
  p.destroyAll();
  assert.equal(p.state().length, 0);
});

test('SHIPYARDS THE POOL HOLDS A PLACE BACK from feet on its ground at its foot as it first rises - never feet up on the gallery, which it must stand under (mutants: the gallery\'s feet held)', () => {
  const site = { kind: 'lighthouse', yaw: 0 };
  assert.equal(feetInPort(site, [0, 0, 0], [1, 0.2, 1]), true);
  // PIN MOVED (AUDIT SHIPYARDS L4-5): [1, GALLERY_Y, -3] stands 1.64 m off the tower's axis - inside the lantern's ring
  // (1.72; BEACON-TOWER: its arches' faces stand 1.59 off it, so no body's middle on the walk comes within 1.94), never the
  // gallery's walk; a body there has risen up the hollow tower and is held back to the roof's point
  assert.equal(feetInPort(site, [0, 0, 0], LIGHTHOUSE_POINTS.gallery), false, 'up on the gallery');
  assert.equal(feetInPort(site, [0, 0, 0], [1, GALLERY_Y, -3]), true, 'inside the lantern');
  assert.equal(feetInPort(site, [0, 0, 0], [PORT_FOOT.lighthouse.hx + 0.3, 0, 0]), false);
  assert.equal(feetInPort({ kind: 'shipyard', yaw: 90 }, [0, 0, 0], [PORT_FOOT.shipyard.hz - 0.2, 0, 0]), true, 'turned: its depth along x');
  const { log, st, deps } = rig({ feet: [160, 2.1, 20] });
  const p = createPortHost(deps);
  p.frame();
  assert.deepEqual([...log.buckets.keys()], ['port:9:shipyard'], 'the tower held back over the feet at its foot');
  st.feet = [200, 2, 20];
  p.frame();
  assert.ok(log.buckets.has('port:9:lighthouse'), 'stood once they step off');
  const up = rig({ feet: [160, 2 + GALLERY_Y + 0.05, 24] });
  const q = createPortHost(up.deps);
  q.frame();
  assert.ok(up.log.buckets.has('port:9:lighthouse'), 'feet on the gallery (a load there): the tower stands under them');
});

test('SHIPYARDS THE PRESS: the shipmaster\'s rows open his window on that page (no row: Ships for sale); the crewmaster, the crew board, the notice board and a sailor open the crew hall; Info names who they are; Steal takes nothing; a shipwright says his work; every box in the ray at a static NPC\'s reach (mutants: the crew hall\'s page lost)', () => {
  const { log, deps } = rig();
  const p = createPortHost(deps);
  p.frame();
  const keys = p.targets().map((t) => t.key);
  for (const what of ['keeper', 'crewmaster', 'recruit.0', 'recruit.2', 'worker.1', 'sign', 'crewsign', 'notices', 'hull']) assert.ok(keys.includes(`port:9:shipyard|${what}`), what);
  for (const what of ['keeper', 'door', 'hatch', 'lamp']) assert.ok(keys.includes(`port:9:lighthouse|${what}`), what);
  assert.ok(p.targets().every((t) => t.reach === PORT_REACH && t.distance === RAY_DISTANCE));
  assert.equal(PORT_REACH, STATIC_NPC_ACTIVATION_DISTANCE);
  for (const r of SHIPYARD_ROWS) p.activate('port:9:shipyard|keeper', 'grab', r.id);
  p.activate('port:9:shipyard|sign', 'grab', null);
  for (const what of ['crewmaster', 'crewsign', 'notices', 'recruit.1']) p.activate(`port:9:shipyard|${what}`, 'grab', null);
  assert.deepEqual(log.opened.map(([, page]) => page), ['ships', 'fleet', 'yard', 'refits', 'ships', 'crew', 'crew', 'crew', 'crew']);
  p.activate('port:9:shipyard|keeper', 'info', null);
  p.activate('port:9:shipyard|crewmaster', 'info', null);
  assert.deepEqual(log.say, [presentNpcInfoText('Halbrecht Voss, the shipmaster'), presentNpcInfoText('Anna Wayrest, the crewmaster')]);
  p.activate('port:9:shipyard|hull', 'steal', null);
  assert.deepEqual(log.mid, [PORT_TEXT.steal]);
  p.activate('port:9:shipyard|worker.0', 'grab', null);
  assert.equal(log.say.at(-1), presentNpcInfoText('a shipwright at work'));
  assert.equal(log.opened.length, 9, 'a shipwright opens nothing');
  assert.equal(p.activate('board:0', 'grab', null), false, 'not the pool\'s');
  assert.equal(p.activate('port:9:nowhere|keeper', 'grab', null), false);
});

test('SHIPYARDS THE STAIR: the lightkeeper\'s door (or the keeper) puts the player on the gallery\'s sea side facing the sea; the hatch down at the tower\'s foot facing the town; a refusal is the host\'s own words, a stair the host will not climb says the keeper keeps it shut (mutants: up facing the town)', () => {
  const { log, st, deps } = rig();
  const p = createPortHost(deps);
  p.frame();
  resetPrefs();
  _resetTutorialTriggerForTests();
  const noted = [];
  const off = setTutorialHandler((id) => { noted.push(id); return true; });
  p.activate('port:9:lighthouse|door', 'grab', 'climb');
  p.activate('port:9:lighthouse|hatch', 'grab', 'down');
  const [[k1, up, a], [, down, b]] = log.climbs;
  assert.deepEqual([k1, up, down], ['9:lighthouse', 'up', 'down']);
  const at = [160, 2, 20], G = LIGHTHOUSE_POINTS.gallery, F = LIGHTHOUSE_POINTS.foot;
  const want = yardToScene(at, 270, G[0], G[1] + 0.05, G[2]);
  a.feet.forEach((v, i) => assert.ok(Math.abs(v - want[i]) < 1e-9, 'on the gallery'));
  const wantFoot = yardToScene(at, 270, F[0], F[1], F[2]);
  b.feet.forEach((v, i) => assert.ok(Math.abs(v - wantFoot[i]) < 1e-9, 'at its foot'));
  // the tower turned 270: its sea side (-z of its frame) is the scene's +x
  const towerAt = yardToScene(at, 270, 0, 0, LIGHTHOUSE.tower.z);
  assert.ok(a.feet[0] > towerAt[0], 'the gallery\'s spot to the sea');
  const fwd = (yaw) => [Math.sin(yaw), Math.cos(yaw)];
  assert.ok(fwd(a.yaw)[0] > 0.99, 'up: facing the sea');
  assert.ok(fwd(b.yaw)[0] < -0.99, 'down: facing the town');
  st.climb = PORT_TEXT.riding;
  p.activate('port:9:lighthouse|door', 'grab', 'climb');
  st.climb = false;
  p.activate('port:9:lighthouse|door', 'grab', 'climb');
  assert.deepEqual(log.mid, [PORT_TEXT.riding, PORT_TEXT.shutStair]);
  p.activate('port:9:lighthouse|lamp', 'grab', null);
  assert.equal(log.say.at(-1), PORT_TEXT.lampDark);
  assert.equal(log.climbs.length, 4, 'the lamp climbs nothing');
  // TUT1: the lighthouse's page pops at a climb up the host made - never the way down, never a refused stair
  assert.deepEqual(noted, ['lighthouse']);
  off();
  _resetTutorialTriggerForTests();
});

test('SHIPYARDS THE PLAQUES: a place by its name and its keeper\'s, and its rows - the shipmaster\'s four pages, the crew hall\'s one, the tower\'s climb and the hatch\'s way down', () => {
  const { st, deps } = rig();
  const p = createPortHost(deps);
  p.frame();
  assert.deepEqual(p.hoverName('port:9:shipyard|keeper'), { title: 'Voss\'s Shipyard', subs: ['Shipmaster: Halbrecht Voss', PORT_PLACES.shipyard.trade], actions: SHIPYARD_ROWS.map((r) => ({ ...r })) });
  assert.deepEqual(p.hoverName('port:9:shipyard|notices'), { title: 'Wayrest\'s Crew Hall', subs: ['Crewmaster: Anna Wayrest', PORT_PLACES.crewhall.trade], actions: CREW_ROWS.map((r) => ({ ...r })) });
  assert.equal(p.hoverName('port:9:shipyard|recruit.0').title, 'Sailor');
  assert.deepEqual(p.hoverName('port:9:shipyard|worker.0').actions, []);
  assert.deepEqual(p.hoverName('port:9:lighthouse|door'), { title: 'The Sentinel Light', subs: ['Lightkeeper: Jalib', PORT_TEXT.stair], actions: CLIMB_ROWS.map((r) => ({ ...r })) });
  assert.deepEqual(p.hoverName('port:9:lighthouse|hatch').actions, DOWN_ROWS.map((r) => ({ ...r })));
  assert.deepEqual(p.hoverName('port:9:lighthouse|lamp').subs, ['The Sentinel Light', PORT_TEXT.lampDark]);
  st.lit = true;
  assert.deepEqual(p.hoverName('port:9:lighthouse|lamp').subs, ['The Sentinel Light', PORT_TEXT.lampLit]);
  assert.equal(p.hoverName('yard:7:stable|keeper'), null);
});

test('SHIPYARDS THE LAMP: in the lanterns\' hours the lamp is a scene light at its glass and the shipyard\'s office lantern another; its glow and two beams of BEAM_PUFFS turning one round each BEAM_PERIOD_S, seen from BEAM_SEEN_M; by day nothing (mutants: lit by day, the beam unturned)', () => {
  const { st, deps } = rig();
  const p = createPortHost(deps);
  p.frame();
  assert.deepEqual(p.lights(), []);
  assert.deepEqual(p.glows([100, 3, 70], 5), []);
  st.lit = true;
  const L = p.lights();
  assert.deepEqual(L.map((l) => l.range).sort((a, b) => a - b), [OFFICE_LAMP_RANGE, LAMP_RANGE]);
  const lamp = L.find((l) => l.range === LAMP_RANGE), want = yardToScene([160, 2, 20], 270, ...LIGHTHOUSE_POINTS.lamp);
  assert.deepEqual([lamp.x, lamp.y, lamp.z].map((v) => +v.toFixed(9)), want.map((v) => +v.toFixed(9)));
  // PIN MOVED (AUDIT SHIPYARDS L4-2): the glows are the pool's own records written in place into one array - each call's
  // read before the next (a copy of where each stands)
  const copy = (G) => G.map((g) => ({ pos: [...g.pos], size: g.size, alpha: g.color[3], blend: g.blend, kind: g.kind }));
  const g0 = copy(p.glows([100, 3, 70], 5));
  assert.equal(g0.length, 1 + 2 * BEAM_PUFFS);
  assert.ok(g0.every((g) => g.blend === 'add' && g.kind === 'lamp'));
  const g1 = copy(p.glows([100, 3, 70], 5 + BEAM_PERIOD_S / 4)), g2 = copy(p.glows([100, 3, 70], 5 + BEAM_PERIOD_S));
  assert.notDeepEqual(g1[BEAM_PUFFS].pos, g0[BEAM_PUFFS].pos, 'turned');
  g2.forEach((g, i) => g.pos.forEach((v, k) => assert.ok(Math.abs(v - g0[i].pos[k]) < 1e-6, 'a round each period')));
  assert.deepEqual(p.glows([160 + BEAM_SEEN_M + 50, 3, 20], 5), [], 'too far to see');
  const puffs = beamPuffs([0, 20, 0], 0);
  assert.equal(puffs.length, BEAM_PUFFS);
  assert.ok(puffs.every((b, i) => i === 0 || (b.pos[2] > puffs[i - 1].pos[2] && b.size > puffs[i - 1].size && b.alpha < puffs[i - 1].alpha)), 'out from the lamp, wider and fainter');
});

test('SHIPYARDS-FOUND THE OVERWORLD\'S MARKS: each place standing, its name over it at PORT_MARK_LIFT, its kind the look\'s (`yard shipyard`, `yard lighthouse`) and the Towns switch\'s', () => {
  const { deps } = rig();
  const p = createPortHost(deps);
  assert.deepEqual(p.overworldMarks(), [], 'nothing stood yet');
  p.frame();
  assert.deepEqual(p.overworldMarks(), [
    { key: 'port:9:shipyard', at: [100, 2 + PORT_MARK_LIFT.shipyard, 50], label: 'Voss\'s Shipyard', kind: 'yard shipyard' },
    { key: 'port:9:lighthouse', at: [160, 2 + PORT_MARK_LIFT.lighthouse, 20], label: 'The Sentinel Light', kind: 'yard lighthouse' },
  ]);
});
