// DISC10 - three Discord reports, fixed before the survival-tiers branch merges (2026-09-23, Mac: "Before we push
// this can you fix these"). Each was reproduced in node against the real modules before it was touched; each pin
// here fails at 110bce52 and passes with its fix (bible/01-Overview/Field-Bugs-2026-09-23.md, DISC10).
//
// ── DISC10-B: "Npc was supposed to mark it on the map. It is not on the map when I look." (Starempire42) ──
// Where is -> Person -> "... Right here. You can see The Woodfield Residence on your map" and the town map
// showed nothing. Driven through the real chain: TopicTree + AnswerPipeline + the talk MCP (%hnt -> 7332 -> %loc)
// -> the host's discoverBuilding shape -> discovery.js -> stampResidenceQuestNames -> the town sheet's ladder.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TopicTree, QUEST_INFO_RESOURCE_TYPE } from '../src/systems/topicTree.js';
import { AnswerPipeline, TALK_STRINGS } from '../src/systems/answerPipeline.js';
import { expandRandomTextRecord } from '../src/systems/talkMacros.js';
import { discoverBuilding, discoveredBuildings, undiscoverBuilding, restoreDiscovery } from '../src/systems/discovery.js';
import { stampResidenceQuestNames } from '../src/ui/exteriorAutomapWindow.js';
import { createTownSheet } from '../src/ui/townSheet.js';
import { BUILDING_TYPES } from '../src/world/buildingNames.js';

const MAP_ID = 4242, LOC = '17:Woodhearth', KEY = (1 << 16) + (2 << 8) + 5;
const HOUSE = { name: '', buildingType: BUILDING_TYPES.House2, factionId: 0, quality: 5, position: [100, 0, 100], buildingKey: KEY };
const RECORDS = { 7271: 'Mmm. Well, try %hnt.', 7332: '... Right here. You can see %loc on your map' };

function askWhereIsPerson({ hidePlace = false, seenBefore = false }) {
  restoreDiscovery(null);
  const quest = { uid: 7, resources: new Map(), getMessage: () => null };
  const place = { isPlace: true, symbol: { name: '_house_' }, getMessage: () => null,
    siteDetails: { siteType: 1, mapId: MAP_ID, buildingKey: KEY, buildingName: 'The Woodfield Residence' } };
  const person = { isPerson: true, isQuestor: false, symbol: { name: '_contact_' }, displayName: 'Dunyn Wicking',
    getMessage: () => null, getAssignedPlaceSymbol: () => ({ name: '_house_' }), parentQuest: quest };
  quest.resources.set('_house_', place).set('_contact_', person);
  quest.getPlace = (s) => quest.resources.get(s.name);
  const tree = new TopicTree({
    getQuest: () => quest, getAllActiveQuestIds: () => [7], currentMapId: () => MAP_ID,
    getBuildingList: () => [HOUSE], undiscoverBuilding: (k, n) => undiscoverBuilding(LOC, k, true, n ?? null),
  });
  const questSource = { currentMapID: () => MAP_ID, isBuildingQuestResource: (m, k) => tree.isBuildingQuestResource(m, k) };
  if (seenBefore) discoverBuilding(LOC, HOUSE, null, null);   // the door looked at / tried before the quest named it
  tree.addQuestTopicsForQuest(quest);
  if (hidePlace) {   // "dialog link for location _house_ person _contact_", then "add dialog for person _contact_"
    tree.dialogLinkForQuestInfoResource(7, '_house_', QUEST_INFO_RESOURCE_TYPE.Location, '_contact_', QUEST_INFO_RESOURCE_TYPE.Person);
    tree.dialogLinkForQuestInfoResource(7, '_contact_', QUEST_INFO_RESOURCE_TYPE.Person, '_house_', QUEST_INFO_RESOURCE_TYPE.Location);
    tree.addDialogForQuestInfoResource(7, '_contact_', QUEST_INFO_RESOURCE_TYPE.Person);
  }
  tree.assembleTopicLists();
  const item = tree.listTopicPerson.find((i) => i.caption === 'Dunyn Wicking');
  const session = { socialGroup: 0, isSpyMaster: false, numAnswersGivenTellMeAboutOrRumors: 0 };
  const ctx = { randomTokens: (id) => [{ text: RECORDS[id] ?? '' }], localizedText: (k) => TALK_STRINGS[k] ?? '', hooks: { world: {} } };
  const pipeline = new AnswerPipeline({
    tree, npcSession: () => session, npcsKnowEverything: () => true, localizedText: (k) => TALK_STRINGS[k] ?? '',
    expandRandomTextRecord: (id) => expandRandomTextRecord(id, ctx), isPlayerInside: () => false,
    // world.js's discoverBuilding seam, shape for shape
    discoverBuilding: (k) => discoverBuilding(LOC, tree.listBuildings.find((b) => b.buildingKey === k) ?? { buildingKey: k }, null, questSource),
    rolls: () => 0.1,   // <= 0.35: the 7332 map arm
    toneIndex: () => 1, reactionTier: () => 1,
  });
  ctx.pipeline = pipeline;
  pipeline.getQuestionText(item, 1);
  const answer = pipeline.getAnswerText(item, { npcSeed: 1 });
  // the M key: stamp at open, then the ladder
  const rows = [{ buildingKey: KEY, blockX: 1, blockY: 2, position: [30, 0, 30], buildingType: HOUSE.buildingType, isResidence: true, name: '' }];
  stampResidenceQuestNames(rows, discoveredBuildings(LOC),
    { getAllActiveQuestIds: () => [7], getQuest: () => quest, isBuildingQuestResource: questSource.isBuildingQuestResource }, MAP_ID);
  const names = createTownSheet({ gridW: 2, gridH: 3, blocks: [], buildings: () => rows, discovered: () => discoveredBuildings(LOC) })
    .names().map((n) => n.text);
  restoreDiscovery(null);
  return { answer, names };
}

test('DISC10-B: "Where is <person>" answered on the 7332 map arm puts their quest residence on the town map', () => {
  for (const [label, opts] of [
    ['the Place still dialog-hidden', { hidePlace: true }],
    ['the house already discovered as a plain residence', { seenBefore: true }],
    ['the plain case (Place learned, house unseen)', {}],
  ]) {
    const { answer, names } = askWhereIsPerson(opts);
    assert.equal(answer, 'Mmm. Well, try ... Right here. You can see The Woodfield Residence on your map.', label);
    assert.deepEqual(names, ['The Woodfield Residence'], `${label}: the NPC said it was marked, so the map must show it`);
  }
});

// ── DISC10-A: "two wagons appear whenever you hitch it up, visual only" / "the Wagon tooltip can appear when it's
// trailing behind you and you're looking forward. it'll flash quickly" (kurkku) ──────────────────────────────────
// Two vendored mods each stand a cart for the Cart transport - Eye Of The Beholder's ShowCart (41239) and Horse Cart
// and Cargo's trailing wagon (41214) - and both ship on. Driven through the REAL HCC pool and runtime and the REAL
// EOTB cart behind the view seam, in world.js's frame order (mwViewFrame, the pool's frame, then the two draws).
import { createHorseCartPool } from '../src/scenes/horseCartPool.js';
import { createHorseCartRuntime } from '../src/systems/horseCart.js';
import { TRANSPORT, WAGON_MODEL_ID } from '../src/systems/horseCartLaw.js';
import { CARGO_DEFINITIONS } from '../src/systems/wagon41214.js';
import { syntheticWagon41214 } from './hccModel.mjs';
import * as mw from '../src/player/mwView.js';
import { eotbWagon, createEotbWagon, WAGON_MODEL, wagonHoverName } from '../src/player/eotbWagon.js';
import { eotbCamera } from '../src/player/eotbCamera.js';
import { mwCamera } from '../src/player/mwCamera.js';
import { _resetModSettings } from '../src/systems/modSettings.js';
import { RIDE_EYE_HEIGHT, EYE_HEIGHT, RIDE_HEIGHT, CAPSULE_HEIGHT } from '../src/player/motor.js';
import { pickActivatableHit, RAY_DISTANCE } from '../src/player/activate.js';
import { raceWinner } from '../src/player/activationRace.js';
import { resolveHover } from '../src/systems/worldHover.js';
import { readFileSync } from 'node:fs';

const RATIO = 40;
const flush = async (n = 8) => { for (let i = 0; i < n; i++) await new Promise((res) => setTimeout(res, 0)); };
/** Flat ground at y = 0, as the host's collider. */
function flatCollider() {
  const floor = (o, d, max) => (d[1] < -1e-9 && o[1] > 0 ? (o[1] / -d[1] <= max ? o[1] / -d[1] : Infinity) : Infinity);
  return {
    buckets: new Map(), addMesh() {}, removeBucket() {},
    surfaceHit: (o, d, max) => { const t = floor(o, d, max); return Number.isFinite(t) ? { dist: t, key: null, normal: [0, 1, 0] } : { dist: Infinity, key: null, normal: null }; },
    raycast: (o, d, max) => floor(o, d, max), raycastHit: (o, d, max) => ({ dist: floor(o, d, max), key: null }), sphereCast: () => ({ dist: Infinity, key: null }),
  };
}
/** A rider with Eye Of The Beholder's lane open (no Morrowind body in node) and HCC's runtime, hitched to nothing yet. */
async function riderScene() {
  _resetModSettings();
  const col = flatCollider();
  const draws = [];
  const renderer = { createMesh: (model) => ({ name: model.name, model }), drawMesh: (gpu, m) => draws.push({ gpu, m: [...m] }), uploadTexture() {}, createBillboardBatch: () => ({}), destroyBillboardBatch() {} };
  const cpuModels = new Map([[WAGON_MODEL_ID, syntheticWagon41214()], [WAGON_MODEL, { positions: new Float32Array([-1, 0, -2, 1, 1, 2]) }]]);
  const gpu = new Map([[WAGON_MODEL_ID, { name: 'hcc' }], [WAGON_MODEL, { name: 'eotb' }]]);
  for (const d of CARGO_DEFINITIONS) gpu.set(d.modelId, { name: `cargo${d.modelId}` });
  const meshes = { getGpuMesh: async (id) => gpu.get(id) ?? null, cpuModels };
  mw.setEotbBodyReady(() => true);
  const w = { feet: [0, 0, 0], yaw: 0, mode: TRANSPORT.Foot, now: 0 };
  const riding = () => w.mode !== TRANSPORT.Foot;
  const height = () => (riding() ? RIDE_HEIGHT : CAPSULE_HEIGHT);
  const centre = () => [w.feet[0], w.feet[1] + height() / 2, w.feet[2]];
  const fwd = () => [Math.sin(w.yaw), 0, Math.cos(w.yaw)];
  const eye = () => [w.feet[0], w.feet[1] + (riding() ? RIDE_EYE_HEIGHT : EYE_HEIGHT), w.feet[2]];
  mw.setEotbPlayerState(() => ({ motion: { height: height(), forward: 0, standing: true } }));
  mwCamera.restore({ firstPerson: true, baseDistance: mwCamera.baseDistance() });
  eotbCamera.loadSettings(null); eotbCamera.toggleOffset(false);
  mw.mwViewAttachWagon({ getGpuMesh: meshes.getGpuMesh, cpuModels });
  const pool = createHorseCartPool({ renderer, meshes, collider: () => col, now: () => w.now, fetchFn: async () => ({ ok: false, status: 404 }), log: { error() {}, warn() {}, info() {} } });
  const rt = createHorseCartRuntime({
    ready: () => true,
    transport: { get: () => w.mode, set: (m) => { w.mode = m; }, hasCart: () => true, hasHorse: () => true, isOnShip: () => false },
    player: { position: centre, forward: fwd, movement: () => ({ position: centre(), forward: fwd() }) },
    gps: { worldX: () => 100000 + w.feet[0] * RATIO, worldZ: () => 200000 + w.feet[2] * RATIO, scenePosition: centre, currentMapPixel: () => ({ x: 0, y: 0 }) },
    streaming: { isReady: () => true, isInit: () => false, mapPixelX: () => 0, mapPixelY: () => 0, ratio: () => RATIO },
    enterExit: { isPlayerInside: () => false, isPlayerInsideDungeon: () => false, isPlayerInsideBuilding: () => false, buildingKey: () => 0, dungeonId: () => null },
    entity: { wagonWeight: () => 0, wagonKgLimit: () => 750 },
    activateMode: () => 'grab', fadeInProgress: () => false, say() {}, setMidScreenText() {}, tooFarText: () => '',
    settings: () => ({}), keyDown: () => false, now: () => w.now, travelOptionsActive: () => null,
    worldCoordToMapPixel: () => ({ x: 0, y: 0 }), openInventoryWithWagon() {}, openNamePrompt: () => ({ isOpen: () => false }),
    phys: pool.phys, presentation: pool.presentation, log: { warn() {}, error() {}, info() {} },
  });
  pool.attach(rt);
  pool.presentation.wagonParts();
  await flush();
  const frame = (dt = 1 / 30) => {
    w.now += dt;
    mw.mwViewFrame({ fpEye: eye(), feet: [...w.feet], yaw: w.yaw, pitch: 0, dt, riding: riding(), cart: w.mode === TRANSPORT.Cart, onExteriorPath: false, raycast: (o, d, m) => col.raycast(o, d, m), spherecast: () => null });
    pool.frame(dt, eye(), dt);
  };
  /** The world pass's two cart draws (world.js mwViewDrawWagon, then hcc.draw): the wagon BODIES drawn this frame. */
  const carts = () => {
    draws.length = 0; mw.mwViewDrawWagon(renderer); pool.draw(renderer);
    return draws.filter((d) => d.gpu.name === 'eotb' || d.gpu.name === 'TrailingWagon41214_Body').map((d) => d.gpu.name);
  };
  /** The plaque over a forward look at `pitch` degrees, raced as the host races the cart families. */
  const plaque = (pitch) => {
    const pr = pitch * Math.PI / 180, dir = [Math.sin(w.yaw) * Math.cos(pr), Math.sin(pr), Math.cos(w.yaw) * Math.cos(pr)];
    const wagon = pickActivatableHit(eye(), dir, mw.mwViewWagonTargets(RAY_DISTANCE), col), horseCart = pickActivatableHit(eye(), dir, pool.targets(), col);
    return resolveHover(raceWinner({ wagon, horseCart }), { name: (k) => wagonHoverName(k) ?? pool.hoverName(k) })?.title ?? null;
  };
  const cleanup = () => { eotbWagon.reset(); mw.mwViewAttachWagon(null); mw.setEotbBodyReady(null); mw.setEotbPlayerState(null); mw.setEotbCartYields(null); eotbCamera.toggleOffset(false); _resetModSettings(); };
  return { w, rt, fwd, frame, carts, plaque, cleanup };
}
/** Hitch, then ride a quarter turn each way with a U-turn in the middle: the most carts drawn in one frame, and the frames a forward look named "Wagon". */
async function hitchAndRide(yieldFn) {
  const s = await riderScene();
  try {
    mw.setEotbCartYields(yieldFn ? () => yieldFn(s) : null);
    s.frame(); s.rt.tryUseTransport(TRANSPORT.Cart);
    let most = 0, named = 0; const kinds = new Set();
    for (let i = 0; i < 600; i++) {
      s.w.yaw += (i < 300 ? 1 : -1) * (Math.PI / 2) / 300; const f = s.fwd(); s.w.feet[0] += f[0] * 0.07; s.w.feet[2] += f[2] * 0.07; s.frame();
      if (i === 300) { s.w.yaw += Math.PI; s.frame(); }
      const drawn = s.carts(); most = Math.max(most, drawn.length); drawn.forEach((k) => kinds.add(k));
      for (const p of [0, -10, -20, -30, -45]) if (s.plaque(p) === 'Wagon') named++;
    }
    return { most, named, kinds: [...kinds].sort() };
  } finally { s.cleanup(); }
}

test('DISC10-A: one cart - while Horse Cart and Cargo trails its wagon, the Eye Of The Beholder cart gives way: a hitch, a ride through two turns and a U-turn draw ONE wagon a frame, and no forward look names "Wagon"', async () => {
  const before = await hitchAndRide(null);   // the seam with nothing registered: what the report saw
  assert.equal(before.most, 2, 'unyielded, both mods stand a cart for the Cart transport - the report\'s two wagons');
  assert.ok(before.named > 0, 'and the EOTB cart\'s box named "Wagon" over the road');
  const after = await hitchAndRide((s) => s.rt.showTrailingWagon);   // world.js and exterior.js register exactly this, HCC on
  assert.deepEqual([after.most, after.kinds], [1, ['TrailingWagon41214_Body']], 'one wagon a frame, and it is HCC\'s');
  assert.equal(after.named, 0, 'HCC\'s trailing wagon takes no activation, so riding names nothing');
  const W = readFileSync(new URL('../src/scenes/world.js', import.meta.url), 'utf8'), E = readFileSync(new URL('../src/scenes/exterior.js', import.meta.url), 'utf8');
  for (const [label, src] of [['world.js', W], ['exterior.js', E]]) {
    assert.match(src, /hcc\.attach\(hccRuntime\);\n\s*setEotbCartYields\(\(\) => hccOn\(\) && hccRuntime\.showTrailingWagon\);/, `${label} registers the yield beside the runtime it reads`);
  }
});

test('DISC10-A: the Eye Of The Beholder cart alone (HCC off) is struck where its TURNED body is - trailing at a diagonal, a forward look over the road names nothing; turned round to face it, it is still named; and a box that holds the eye names nothing by the ground inside it', async () => {
  const floor = (o, d, m) => (d[1] < -1e-9 && o[1] > 0 && o[1] / -d[1] <= m ? o[1] / -d[1] : Infinity);
  const col = { raycast: floor, raycastHit: (o, d, m) => ({ dist: floor(o, d, m), key: null }) };
  const cart = createEotbWagon();
  cart.attach({ getGpuMesh: () => null, cpuModels: new Map([[WAGON_MODEL, { positions: new Float32Array([-1, 0, -2, 1, 1, 2]) }]]) });
  await flush();
  const feet = [0, 0, 0]; let yaw = Math.PI / 4;
  let behindNamed = 0, behindLooks = 0, aheadNamed = 0, aheadLooks = 0;
  for (let i = 0; i < 700; i++) {
    if (i === 600) yaw += Math.PI;   // a U-turn: the cart stands ahead of the rider now
    const f = [Math.sin(yaw), 0, Math.cos(yaw)];
    if (i !== 600) { feet[0] += f[0] * 0.06; feet[2] += f[2] * 0.06; }
    const st = cart.tick(1 / 30, { feet, yaw, height: 2.6, cart: true, raycast: floor });
    const behind = (st.pos[0] - feet[0]) * f[0] + (st.pos[2] - feet[2]) * f[2] < 0;
    const eye = [feet[0], 2.51, feet[2]];
    for (const p of [0, -10, -20, -30, -45]) {
      const pr = p * Math.PI / 180, dir = [f[0] * Math.cos(pr), Math.sin(pr), f[2] * Math.cos(pr)];
      const hit = pickActivatableHit(eye, dir, cart.targets(RAY_DISTANCE), col);
      const named = !!hit && hit.distance <= hit.reach;
      if (behind && i < 600) { behindLooks++; behindNamed += named; }
      if (!behind && i >= 600 && i < 620) { aheadLooks++; aheadNamed += named; }
    }
  }
  assert.ok(behindLooks > 1000, 'it trailed the whole ride');
  assert.equal(behindNamed, 0, 'behind the rider at 45 degrees: the axis-aligned box had bulged forward over the road, the turned one does not');
  assert.ok(aheadLooks > 0 && aheadNamed > 0, 'where it truly stands ahead, a look still names it');
  const [t] = cart.targets(RAY_DISTANCE);
  assert.deepEqual([!!t.obb, t.noSurface], [true, true], 'its own box, and no surface of its own: a box holding the eye names nothing by the ground or a wall inside it');
});

test('DISC10-A: `rayObb` is the slab test in the box\'s own frame - its entry distance is the one a walk along the ray finds, and a ray through the axis-aligned box\'s bulge, clear of the turned body, meets nothing', async () => {
  const { rayObb, rayAabb } = await import('../src/player/activate.js');
  const { trs } = await import('../src/world/mat4.js');
  const { transformedAabb } = await import('../src/render/frustum.js');
  const box = [-1, 0, -2, 1, 1, 2];
  for (const yawDeg of [0, 30, 45, 120, 200]) {
    const m = trs(10, 0, 10, 0, yawDeg, 0);
    const inside = (p) => {   // world -> local by the transpose, then the local box
      const rx = p[0] - m[12], ry = p[1] - m[13], rz = p[2] - m[14];
      const l = [rx * m[0] + ry * m[1] + rz * m[2], rx * m[4] + ry * m[5] + rz * m[6], rx * m[8] + ry * m[9] + rz * m[10]];
      return l[0] >= box[0] && l[0] <= box[3] && l[1] >= box[1] && l[1] <= box[4] && l[2] >= box[2] && l[2] <= box[5];
    };
    const walk = (o, d) => { for (let t = 0; t <= 20; t += 0.001) if (inside([o[0] + d[0] * t, o[1] + d[1] * t, o[2] + d[2] * t])) return t; return null; };
    for (const [o, d] of [[[10, 0.5, 2], [0, 0, 1]], [[3, 0.5, 9], [1, 0, 0]], [[6, 0.5, 6], [Math.SQRT1_2, 0, Math.SQRT1_2]]]) {
      const want = walk(o, d), got = rayObb(o, d, m, box);
      if (want === null) assert.equal(got, null, `yaw ${yawDeg}: a miss`);
      else assert.ok(got !== null && Math.abs(got - want) < 0.002, `yaw ${yawDeg} from ${o}: entered at ${want}, rayObb says ${got}`);
    }
  }
  // the bulge: at 45 degrees the axis-aligned box's corner stands clear of the body - a ray through it
  const m45 = trs(10, 0, 10, 0, 45, 0);
  const aabb = transformedAabb(box, m45);
  const o = [aabb[0] + 0.1, 5, aabb[2] + 0.1], d = [0, -1, 0];   // straight down through the corner a 45-degree turn leaves empty
  assert.ok(rayAabb(o, d, { min: aabb.slice(0, 3), max: aabb.slice(3) }) !== null, 'the axis-aligned box is struck');
  assert.equal(rayObb(o, d, m45, box), null, 'the cart itself is not');
});
