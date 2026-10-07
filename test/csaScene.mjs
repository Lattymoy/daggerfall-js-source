// The scripted Come Sail Away scene - csa_wind.test.js's (csa_sailing's, with the wind's seams), one harness: the
// vendored hulls through the real SpawnBoat and runtime, Time.deltaTime a quarter second, every seam a stand-in.
// HELM-WAY's suite (test/helmway.test.js) drives the same runtime through it.
import { readFileSync } from 'node:fs';
import { comeSailAwayModels } from '../src/systems/comeSailAwayModels.js';
import { spawnBoat } from '../src/systems/comeSailAwayBoat.js';
import { createComeSailAwayRuntime, NO_WATER_LEVEL, WEATHER_TYPE } from '../src/systems/comeSailAway.js';

const DIR = new URL('../vendor/come-sail-away/Models/', import.meta.url);
const json = (f) => JSON.parse(readFileSync(new URL(f, DIR), 'utf8'));
// GALLEON (2026-10-01): hull 2 the new galleon over the mod's, as the game's loader stands her (comeSailAwayModels.js) -
// the pool's own models (navalSea.mjs, a file fetch) and these are one ship
const GALLEON = JSON.parse(readFileSync(new URL('../src/assets/galleon/galleon.json', import.meta.url), 'utf8'));
// SHIPS-2 (2026-10-07): and hull 4 the new carrack, hull 1 the new large boat, as the loader stands them
const ship = (f) => JSON.parse(readFileSync(new URL(`../src/assets/ships/${f}`, import.meta.url), 'utf8'));
export const MODELS = comeSailAwayModels({ prefabs: json('prefabs.json'), meshes: json('meshes.json'), bin: new Uint8Array(readFileSync(new URL('meshes.bin', DIR))), materials: json('materials.json'), animation: json('animation.json'), galleon: GALLEON, carrack: ship('carrack.json'), largeBoat: ship('largeBoat.json') });
export const ctxFor = (player) => ({ models: MODELS, player: () => player, billboardSize: () => [0.8, 1.6], modelBounds: () => ({ min: [-1, 0, -1], max: [1, 1, 1] }) });
/** SHIPS-2: the mod's own Carrack and Large Boat under the galleon - hulls 4 and 1 as the game stands them when the new
 *  ships' models do not load (test/navalSea.mjs modShipsPool's) - and a context over them. */
export const MOD_MODELS = comeSailAwayModels({ prefabs: json('prefabs.json'), meshes: json('meshes.json'), bin: new Uint8Array(readFileSync(new URL('meshes.bin', DIR))), materials: json('materials.json'), animation: json('animation.json'), galleon: GALLEON });
export const modCtxFor = (player) => ({ ...ctxFor(player), models: MOD_MODELS });

export function terrain(x, y, { tile = 0 } = {}) {
  return { mapPixelX: x, mapPixelY: y, position: [(x - 10) * 819.2, 0, -(y - 20) * 819.2], tileMap: new Uint8Array(128 * 128).fill(tile << 2), sampleHeight: () => 20 };
}

/** The scripted scene (csa_sailing.test.js's, with the wind's seams): Time.deltaTime a quarter second. */
export function scene(opts = {}) {
  const out = { hud: [], mid: [], log: [], timeScales: [], wind: [], boxes: [] };
  const held = new Set(opts.held ?? []);
  const started = new Set();
  const player = { position: [1, 2, 3], yaw: 0, frozen: 0, transport: 'Foot' };
  const terrains = opts.terrains ?? [terrain(10, 20)];
  const world = { inside: false, hour: opts.hour ?? 12, weather: opts.weather ?? WEATHER_TYPE.Sunny, pixelY: opts.pixelY ?? 20, time: 0 };
  const rolls = { float: opts.float ?? [], int: opts.int ?? [] };
  const input = {
    has: (a) => held.has(a), started: (a) => started.has(a),
    horizontal: () => (held.has('MoveRight') ? 1 : 0) - (held.has('MoveLeft') ? 1 : 0),
    vertical: () => (held.has('MoveForwards') ? 1 : 0) - (held.has('MoveBackwards') ? 1 : 0),
    toggleAutorun: false,
  };
  let timeScale = opts.timeScale ?? 1;
  const deps = {
    // SHIPS-2: `opts.mod` - the mod's own Carrack and Large Boat (MOD_MODELS), as the game stands them when the new ships' models do not load
    pool: { models: opts.mod ? MOD_MODELS : MODELS, ready: () => true, spawnNow: (boat, p) => { spawnBoat(boat, (opts.mod ? modCtxFor : ctxFor)(p)); return boat; }, remove: () => {} },
    player: () => ({ position: [...player.position], rotation: [0, Math.sin((player.yaw * Math.PI / 180) / 2), 0, Math.cos((player.yaw * Math.PI / 180) / 2)] }),
    camera: () => ({ position: [0, 50, 0], forward: [0, -1, 0] }),
    currentMapPixel: () => ({ X: 10, Y: world.pixelY }),
    isPlayerInside: () => world.inside,
    blockWaterLevel: () => NO_WATER_LEVEL,
    iliacPuddleNoMore: () => false,
    raycast: () => null,
    playerTerrain: () => terrains[0],
    terrainAt: (x, y) => terrains.find((t) => t.mapPixelX === x && t.mapPixelY === y) ?? null,
    terrains: () => terrains,
    heightMapValue: opts.heightMapValue ?? (() => 255),   // CSA-F: WOODS.WLD all land - the waves lay nothing, and cast no ray
    worldCompensation: () => [0, 0, 0],
    hudText: (t) => out.hud.push(t),
    midScreenText: (t, s) => out.mid.push([t, s]),
    log: (t) => out.log.push(t),
    random: {
      range: (min, max) => (rolls.int.length ? rolls.int.shift() : min),
      rangeFloat: (min, max) => (rolls.float.length ? rolls.float.shift() : min),
    },
    time: () => world.time,
    weatherType: () => world.weather,
    hour: () => world.hour,
    persistentDungeonBoats: () => false,
    packedItems: { serialize: (items) => items.map((it) => ({ ...it })), deserialize: (records) => records.map((it) => ({ ...it })) },
    dt: () => 0.25,
    setting: (key) => ({ 'Waves.Enable': false, ...opts.settings })[key],   // CSA-F: the helm measured with no current - FixedUpdate writes none with the waves off (csa_waves pins it)
    input,
    helm: {
      setPlayerPosition: (p) => { player.position = [...p]; }, setFacing: (yaw) => { player.yaw = yaw; }, turnPlayer: (d) => { player.yaw += d; },
      freeze: (s) => { player.frozen = s; }, frozen: () => player.frozen > 0, stopRunning: () => {}, footsteps: () => {}, alignToGround: () => {},
    },
    transport: { isFoot: () => true, setFoot: () => {}, hasHorse: () => false, hasCart: () => false },
    ship: { owns: () => true, assign: () => {}, removePermanentScene: () => {} },
    entity: { isFemale: () => false, carriedWeight: () => 10, wagonWeight: () => 0, decreaseFatigue: () => {} },
    cargoWeight: () => 0,
    sphereCastAll: () => [],
    enemies: () => [],
    timeScale: () => timeScale,
    setTimeScale: (s) => { timeScale = s; out.timeScales.push(s); },
    messageBox: (t) => out.boxes.push(t),
    packBoat: () => {},
  };
  const rt = createComeSailAwayRuntime(deps);
  rt.on('OnUpdateWind', (v) => out.wind.push(v));
  // HELM-LADDER: a key that goes down is a press that frame (the world's latch edge) - and one held as the helm is taken
  // is pressed at the helm, so a held W puts her oars to pulling ahead, one rung (test/csa_sailing.test.js's own)
  let downBefore = new Set();
  const frame = ({ press = [] } = {}) => {
    started.clear();
    for (const a of press) started.add(a);
    for (const a of held) if (!downBefore.has(a)) started.add(a);
    rt.endOfFrame();
    rt.fixedUpdate();
    rt.update();
    rt.lateUpdate();
    started.clear();
    downBefore = rt.isSailing() ? new Set(held) : new Set();
    world.time += 0.25;
  };
  const place = (hull = 1, variant = 0, position = [100, 34, 200], direction = [0, 0, 1]) => rt.PlaceBoat(position, direction, hull, variant, terrains[0]);
  const helm = (boat) => { rt.StartSailing(boat); return boat; };
  return { rt, out, player, held, frame, place, helm, world, rolls, deps, terrains };
}
