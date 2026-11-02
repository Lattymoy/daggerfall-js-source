// SEA-TOWN (FIELD BUGS 2026-10-11c, bible/01-Overview/bugs/Field-Bugs-2026-10-11c.md). A Discord report: frames fell in a
// crowded inland town (Chesterwark) with the World tab's "The sea & ships" mods on, and came back with them off - online,
// where the room holds three of the five on, so the switch that moved was Come Sail Away's. Measured in the real game
// (tools/frameProbe.mjs over the freeware ARENA2): with no boat owned the mods cost nothing there; with five boats owned,
// the world frame's JavaScript rose 12.9 -> 17.9 ms and its garbage 1.2 -> 3.3 MB a frame. The largest single part:
// every boat's Animators were found by walking her whole tree (a galleon is 1,228 nodes) on every frame - for every boat
// the player had ever placed, wherever it lay, and for every other player's boat. The step itself stays: an Animator asked
// while its boat stands nowhere returns at its first test, and that ask is how it starts over when she stands again. And
// the sea's two HUDs made their key names every frame ashore for windows that were not shown. Pinned here:
//
//   CACHE    boatAnimators answers the walk's own list, the same Animators in the same order, walking no tree again
//            while every tree's shape stands - and a new one when a shape changes (a node hung, a component added)
//   AWAY     Come Sail Away's animate asks every Animator of every placed boat once a frame off the kept list, a second
//            frame walking no tree - and a boat standing nowhere is asked too: her Animators start over from their
//            default state when she stands again (world/unityAnimator.js's law, Port-Ledger's Come Sail Away row (18))
//   HIDDEN   another player's boat posed off her kept list; under a hidden owner still asked, so she starts over shown
//   HUDS     the naval HUD and the helm panel, ashore with nothing to show, make no key's name and read none of the HUD's
//            rects - the host's own text, lifted from world.js and run
import '../../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createComeSailAwayPool } from '../../../src/scenes/comeSailAway/comeSailAwayPool.js';
import { createComeSailAwayPeers } from '../../../src/scenes/comeSailAway/comeSailAwayPeers.js';
import { comeSailAwayModels } from '../../../src/systems/comeSailAway/comeSailAwayModels.js';
import { Boat, boatAnimators, spawnBoat } from '../../../src/systems/comeSailAway/comeSailAwayBoat.js';
import { createComeSailAwayRuntime, NO_WATER_LEVEL } from '../../../src/systems/comeSailAway/comeSailAway.js';
import { PrefabNode } from '../../../src/world/prefabNode.js';
import { passengerCard } from '../../../src/scenes/naval/passageHelm.js';

const rd = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');
const DIR = new URL('../../../vendor/come-sail-away/Models/', import.meta.url);
const json = (f) => JSON.parse(readFileSync(new URL(f, DIR), 'utf8'));
const MODELS = comeSailAwayModels({ prefabs: json('prefabs.json'), meshes: json('meshes.json'), bin: new Uint8Array(readFileSync(new URL('meshes.bin', DIR))), materials: json('materials.json'), animation: json('animation.json') });

const fileFetch = async (url) => {
  const bytes = readFileSync(fileURLToPath(url));
  return { ok: true, json: async () => JSON.parse(bytes.toString('utf8')), arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.length) };
};
const renderer = {
  createMesh: (model) => ({ model, buffers: [{}, {}], bounds: [0, 0, 0, 0], subMeshes: model.subMeshes.map((s) => ({ ...s, _bounds: [0, 0, 0, 0] })) }),
  drawMesh() {}, updateMeshVertices() {}, createBillboardBatch: (archive, record, size) => ({ archive, record, size }), destroyBillboardBatch() {}, destroyMesh() {},
};
const texture = () => ({ recordCount: 100, getSize: () => ({ width: 40, height: 64 }), getScale: () => ({ width: 0, height: 0 }) });
const pipeline = { textureFiles: new Map(), cpuModels: new Map(), gpuMeshes: new Map(), getTexture: async () => texture(), uploadRecord() {}, getGpuMesh: async (id) => ({ classic: id }) };
async function readyPool() {
  const pool = createComeSailAwayPool({ renderer, pipeline, fetchFn: fileFetch, log: { warn() {} } });
  assert.equal(await pool.preload(), true);
  return pool;
}

/** The walk boatAnimators made every frame before SEA-TOWN - the reference its kept list must equal. */
const walked = (boat) => [...boat.GameObject.walk()].flatMap((n) => n.getComponents('Animator').map((c) => c.animator).filter(Boolean));
/** The same Animators, the same order - by identity. */
function sameList(got, want, msg) {
  assert.equal(got.length, want.length, `${msg}: as many Animators`);
  got.forEach((a, i) => assert.equal(a, want[i], `${msg}: Animator ${i} is the walk's own`));
}
/** Counts the walks started from the given roots while `fn` runs. */
function walksFrom(roots, fn) {
  const real = PrefabNode.prototype.walk;
  let n = 0;
  PrefabNode.prototype.walk = function walk() { if (roots.includes(this)) n++; return real.call(this); };
  try { fn(); } finally { PrefabNode.prototype.walk = real; }
  return n;
}
/** Each Animator's update counted, per boat - the step animate and the peers' pose make. */
function spySteps(boats) {
  const steps = new Map(boats.map((b) => [b, 0]));
  for (const b of boats) for (const a of walked(b)) a.update = () => steps.set(b, steps.get(b) + 1);
  return steps;
}

test('SEA-TOWN CACHE: boatAnimators answers the walk\'s own list for every hull - the same Animators in the same order - and walks no tree again while the shapes stand; a node hung under her (or anywhere) or a component added, and the next answer is the new walk\'s (mutants: the kept list never asked; the shape\'s stamp not asked)', async () => {
  const pool = await readyPool();
  const boats = [0, 1, 2, 3, 4].map((h) => pool.spawnSeaNow(new Boat(h, 0)));
  const counts = boats.map((b) => walked(b).length);
  assert.deepEqual(counts.map((n) => n > 0), [true, true, true, true, true], `every hull carries Animators (${counts})`);
  for (const b of boats) sameList(boatAnimators(b), walked(b), `hull ${b.hull}`);
  // the shapes standing, the second frame: the same list, no tree walked
  const first = boats.map((b) => boatAnimators(b));
  const n = walksFrom(boats.map((b) => b.GameObject), () => boats.forEach((b, i) => assert.equal(boatAnimators(b), first[i], `hull ${b.hull}: the kept list`)));
  assert.equal(n, 0, 'no boat\'s tree walked while the shapes stand');
  // a node hung under one of them, carrying an Animator: the next answer is the new walk's
  const node = new PrefabNode('SeaTownProbe', { components: [{ type: 'Animator', animator: { update() {} } }] });
  node.setParent(boats[2].MeshObject);
  sameList(boatAnimators(boats[2]), walked(boats[2]), 'a node hung under her');
  assert.ok(boatAnimators(boats[2]).includes(node.components[0].animator), 'the hung node\'s Animator is in it');
  // a component added to a node of hers: the same
  const extra = { type: 'Animator', animator: { update() {} } };
  boats[4].MeshObject.addComponent(extra);
  sameList(boatAnimators(boats[4]), walked(boats[4]), 'a component added');
  assert.ok(boatAnimators(boats[4]).includes(extra.animator), 'the added Animator is in it');
  // a shape changed elsewhere (another tree entirely) - every boat still answers the walk's list
  new PrefabNode('Elsewhere').setParent(new PrefabNode('OtherTree'));
  for (const b of boats) sameList(boatAnimators(b), walked(b), `hull ${b.hull} after a shape elsewhere`);
});

/** Come Sail Away's runtime over the vendored hulls - the seams its LateUpdate reads (test/systems/comeSailAway/csa_sailing.test.js's scene,
 *  cut to what a frame ashore asks). */
function runtime() {
  const player = { position: [1, 2, 3] };
  const terrain = { mapPixelX: 10, mapPixelY: 20, position: [0, 0, 0], tileMap: new Uint8Array(128 * 128), sampleHeight: () => 20 };
  const deps = {
    pool: { models: MODELS, ready: () => true, spawnNow: (boat, p) => { spawnBoat(boat, { models: MODELS, player: () => p, billboardSize: () => [0.8, 1.6], modelBounds: () => ({ min: [-1, 0, -1], max: [1, 1, 1] }) }); return boat; }, remove() {} },
    player: () => ({ position: [...player.position], rotation: [0, 0, 0, 1] }),
    camera: () => ({ position: [0, 50, 0], forward: [0, -1, 0] }),
    currentMapPixel: () => ({ X: 10, Y: 20 }),
    isPlayerInside: () => false,
    blockWaterLevel: () => NO_WATER_LEVEL,
    iliacPuddleNoMore: () => false,
    raycast: () => null,
    playerTerrain: () => terrain, terrainAt: () => terrain, terrains: () => [terrain],
    heightMapValue: () => 255, worldCompensation: () => [0, 0, 0],
    hudText() {}, midScreenText() {}, log() {},
    random: { range: (min) => min },
    time: () => 0, dt: () => 0.25,
    persistentDungeonBoats: () => false,
    packedItems: { serialize: (items) => items, deserialize: (records) => records },
    setting: (key) => ({ 'Waves.Enable': false })[key],
    input: { has: () => false, started: () => false, horizontal: () => 0, vertical: () => 0, toggleAutorun: false },
    helm: { setPlayerPosition() {}, setFacing() {}, turnPlayer() {}, freeze() {}, frozen: () => false, stopRunning() {}, footsteps() {}, alignToGround() {} },
    transport: { isFoot: () => true, setFoot() {}, hasHorse: () => false, hasCart: () => false },
    ship: { owns: () => false, assign() {}, removePermanentScene() {} },
    entity: { isFemale: () => false, carriedWeight: () => 10, wagonWeight: () => 0, decreaseFatigue() {} },
    cargoWeight: () => 0, sphereCastAll: () => [], enemies: () => [],
    timeScale: () => 1, setTimeScale() {}, messageBox() {},
    items: { create: () => ({}), addToPlayer() {} },
  };
  const rt = createComeSailAwayRuntime(deps);
  return { rt, place: (hull, at) => rt.PlaceBoat(at, [0, 0, 1], hull, 0, terrain) };
}

test('SEA-TOWN AWAY: Come Sail Away\'s animate asks every Animator of every boat the player has placed, once a frame, off the kept list - a second frame walks no boat\'s tree - and a boat standing nowhere (UpdateBoatVisibility\'s, a pixel off) is asked too, so her Animators start over from their default state when she stands again (Port-Ledger, the Come Sail Away row, (18)) (mutants: the kept list never asked; a boat standing nowhere passed over)', () => {
  const { rt, place } = runtime();
  const near = place(1, [100, 34, 200]), far = place(1, [160, 34, 200]);
  const rudder = (b) => boatAnimators(b).find((a) => a.node.name === 'RudderObject');
  for (const b of [near, far]) rudder(b).Play('Sailing');
  rt.lateUpdate({ paused: false });
  assert.deepEqual([rudder(near).stateName, rudder(far).stateName], ['Sailing', 'Sailing'], 'both rudders played out of their default state');
  far.GameObject.setActive(false);   // setBoatActive's root switch, as UpdateBoatVisibility makes it
  const n = walksFrom([near.GameObject, far.GameObject], () => rt.lateUpdate({ paused: false }));
  assert.equal(n, 0, 'a second frame walks no boat\'s tree');
  assert.equal(rudder(near).stateName, 'Sailing', 'the boat that stands keeps her state');
  far.GameObject.setActive(true);
  rt.lateUpdate({ paused: false });
  assert.equal(rudder(far).stateName, 'Disembarked', 'stood again, hers starts over from its default state');
  assert.equal(rudder(near).stateName, 'Sailing', 'and the other\'s is untouched');
  // and each Animator once a frame, standing or not
  const steps = spySteps([near, far]);
  far.GameObject.setActive(false);
  rt.lateUpdate({ paused: false });
  assert.deepEqual([steps.get(near), steps.get(far)], [walked(near).length, walked(far).length], 'every Animator of both asked once');
});

const Q = [0, Math.sin(0.25), 0, Math.cos(0.25)];
const word = (o = {}) => [o.hull ?? 1, o.variant ?? 0, o.x ?? 10, o.y ?? 34, o.z ?? 20, ...(o.q ?? Q), o.sails ?? 0, o.helm ?? 0, o.light ?? 0];

test('SEA-TOWN HIDDEN: another player\'s boat is posed off her kept Animator list - her tree not walked again - and under a hidden owner (standing nowhere) her Animators are still asked, so each starts over from its default state when her owner is shown again (mutants: the hidden boat passed over; the tree walked every frame)', async () => {
  const pool = await readyPool();
  const peers = createComeSailAwayPeers({ pool, selfId: () => 'me' });
  let look = null;
  peers.setPeerLook(() => look);
  peers.applyOwner('ann', { b: [word({ hull: 2, helm: 1 })] }, (p) => p, 0);
  for (let i = 0; i < 4 && !pool.peerBoats.length; i++) peers.frame(1 / 60);
  const [boat] = pool.peerBoats;
  assert.ok(boat, 'her boat was built');
  const door = boatAnimators(boat).find((a) => a.node.name === 'CastleDoor');
  door.Play('Opened');
  const n = walksFrom([boat.GameObject], () => peers.frame(1 / 60));
  assert.equal(n, 0, 'posed off the kept list - her tree not walked');
  assert.equal(door.stateName, 'Opened', 'her door played open');
  look = 'hidden';
  peers.frame(1 / 60);
  assert.equal(boat.GameObject.activeSelf, false, 'under a hidden owner she stands nowhere');
  look = null;
  peers.frame(1 / 60);
  assert.equal(boat.GameObject.activeSelf, true, 'her owner shown: she stands');
  assert.equal(door.stateName, 'Closed', 'and her door starts over from its default state');
});

const WORLD = rd('src/scenes/world.js');
function cut(src, head, end) {
  const i = src.indexOf(head);
  assert.ok(i >= 0, `${head} is in the source`);
  const j = src.indexOf(end, i);
  assert.ok(j > i, 'and it ends');
  return src.slice(i, j + end.length);
}
function mount(scope, code, name) {
  const proxy = new Proxy(scope, {
    has: () => true,
    get: (t, k) => (k === Symbol.unscopables ? undefined : (k in t ? t[k] : globalThis[k])),
    set: (t, k, v) => { t[k] = v; return true; },
  });
  // eslint-disable-next-line no-new-func
  return new Function('__scope', `with (__scope) { ${code}\n return ${name}; }`)(proxy);
}

test('SEA-TOWN HUDS: the naval HUD with no ship near (or the HUD covered) is handed its clock and its cover alone - no key\'s name made, no HUD rect or compass box read - and with a ship near, all of it as before; the helm panel with no helm and aboard nothing goes without its key\'s name or the cover\'s reads (the host\'s own text, lifted from world.js; mutants: either early door taken away)', () => {
  const made = { keys: 0, rects: 0 };
  const drawn = [];
  const scope = {
    navalOn: () => true, _mode: () => 'exterior', model: null, paused: false,
    naval: { hudModel: () => scope.model },
    townTalk: { overlayActive: false, hudHidden: false, hudCovered: false },
    gamePaused: () => scope.paused,
    controllerLook: () => false, padFamily: () => null, navalPadCodes: () => null, hdGlyphName: () => 'X',
    navalKeyName: (a) => { made.keys++; return `[${a}]`; },
    enhancedHudScale: () => { made.rects++; return 1; }, enhancedHelmBar: () => { made.rects++; return null; },
    enhancedHudBottom: () => { made.rects++; return null; }, enhancedHudQuick: () => { made.rects++; return null; },
    isEnhanced: () => true, hudArt: null, classicCompassBox: () => { made.rects++; return null; }, touch: null,
    drawNavalHud: (m, opts) => drawn.push({ m, opts }),
    // PIN MOVED (THE CAPTAIN'S SEA, SPYGLASS - at the merge of main): the plate is handed the glass's state too (its
    // Glass brass while the glass is up), so the host's glass stands in its scope
    spyglass: { up: false },
    travelView: null,   // PIN MOVED (FIELD BUGS 2026-10-21d PASSAGE-PLATE): the plate goes under the Overworld's controls
  };
  const navalHud = mount(scope, cut(WORLD, 'function navalHud(dt = 0) {', '\n  }\n'), 'navalHud');
  navalHud(0.25);
  assert.deepEqual(drawn.pop(), { m: null, opts: { dt: 0.25, covered: false } }, 'no ship near: the clock and the cover alone');
  assert.deepEqual(made, { keys: 0, rects: 0 }, 'no key\'s name, no rect');
  scope.model = { plate: {} };
  scope.paused = true;
  navalHud(0.25);
  assert.deepEqual(drawn.pop(), { m: scope.model, opts: { dt: 0, covered: true } }, 'covered (a pause): its clock held, the plate down');
  assert.deepEqual(made, { keys: 0, rects: 0 }, 'still none made');
  scope.paused = false;
  navalHud(0.25);
  const full = drawn.pop();
  assert.equal(full.m, scope.model, 'a ship near: her model');
  assert.deepEqual(full.opts.keys, { aim: '[SwingWeapon]', board: '[Interact]', brace: '[Crouch]' }, 'and the keys\' names, as before');
  assert.equal(full.opts.dt, 0.25);
  assert.equal(full.opts.covered, false);
  assert.ok(made.keys === 3 && made.rects >= 4, `made for a plate that shows (${JSON.stringify(made)})`);
  assert.equal(full.opts.glassUp, false, 'the glass down: the plate\'s Glass brass not pressed');
  scope.spyglass.up = true;
  navalHud(0.25);
  assert.equal(drawn.pop().opts.glassUp, true, 'the glass up: its brass pressed');

  // the helm panel
  const helmDrawn = [];
  let labels = 0;
  const hs = {
    csaRuntime: { helmPanelState: () => hs.helm }, helm: null, csaOn: () => true, isEnhancedPlus: () => true, document: { pointerLockElement: null }, walkMode: true,
    enhancedHelmMounted: () => false, hideEnhancedHelm() {}, csaHelmInput: { held: new Set() }, csaCall: (fn) => fn(), navalOn: () => true, holdsCargo: (hull) => hull > 0,   // PIN MOVED (CARGO-ANYWHERE)
    csaAboard: { aboard: null }, peerName: (id) => id,
    townTalk: { hudCovered: false }, modes: null, gamePaused: () => false, hudRenderEnabled: () => true, travelView: null, _travelUIHolder: { ui: null },
    touch: null, cursorActive: () => false, pointerSurfaces: new Set(), csaHelmHooks: { hooks: true },
    csaKeyLabel: (a) => { labels++; return `[${a}]`; },
    drawEnhancedHelm: (state, hooks) => helmDrawn.push({ state, hooks }),
    passengerCard,   // FIELD BUGS 2026-10-21d PASSAGE-HANDS: the real card law (no charter here)
  };
  const csaDrawHelmPanel = mount(hs, cut(WORLD, 'function csaDrawHelmPanel() {', '\n  }\n'), 'csaDrawHelmPanel');
  csaDrawHelmPanel();
  assert.deepEqual(helmDrawn.pop(), { state: { helm: null, aboard: null }, hooks: hs.csaHelmHooks }, 'no helm, aboard nothing: the panel goes');
  assert.equal(labels, 0, 'no key\'s name made');
  hs.helm = { raised: 0 };
  csaDrawHelmPanel();
  const at = helmDrawn.pop();
  assert.deepEqual(at.state.helm, { raised: 0, orders: true, cargo: false, shot: null }, 'at the helm: the panel\'s state, as before (PIN MOVED, CARGO-ANYWHERE: her Hold - this stub names no hull; SHOT-KINDS: no naval host, no load)');
  assert.equal(at.state.freeKey, '[FreeMouse]', 'and its key\'s name');
  assert.equal(labels, 1);
  hs.helm = null;
  hs.csaAboard.aboard = { boat: { hull: 2 }, owner: 'ann' };
  csaDrawHelmPanel();
  assert.deepEqual(helmDrawn.pop().state.aboard, { hull: 2, owner: 'ann' }, 'aboard another\'s boat: as before');
});
