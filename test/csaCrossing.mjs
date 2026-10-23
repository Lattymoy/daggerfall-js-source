// OWS2 (2026-09-28) - THE CROSSING'S SCENE: Come Sail Away's own runtime on open water (csa_sailing's scripted scene,
// trimmed), and the Overworld's hand sailing it to a mark through the helm's keys alone (systems/seaHelm.js - the rudder
// held, the sail key's edge, the autorun's oars), as scenes/world.js tvSeaSail presses them. Moved here whole from
// test/systems/travel/ows2_crossing.test.js by FB1020c OAR-RUNG, which sails it too (test/systems/comeSailAway/fb1020c_oarrung.test.js):
// `presses` - the helm's own keys pressed before the journey sets out (the rung the player left her on) - and `letGo`,
// the journey's end as world.js tvSeaFrame makes it.
import { readFileSync } from 'node:fs';
import { seaHelmStep, createSeaHelm, headingOf, squareOnly } from '../src/systems/seaHelm.js';
import { comeSailAwayModels } from '../src/systems/comeSailAway/comeSailAwayModels.js';
import { spawnBoat } from '../src/systems/comeSailAway/comeSailAwayBoat.js';
import { createComeSailAwayRuntime, NO_WATER_LEVEL, BOAT_ACTIONS, HANDLING } from '../src/systems/comeSailAway/comeSailAway.js';
import { quatRotate } from '../src/world/quat.js';

const DIR = new URL('../vendor/come-sail-away/Models/', import.meta.url);
const json = (f) => JSON.parse(readFileSync(new URL(f, DIR), 'utf8'));
export const MODELS = comeSailAwayModels({ prefabs: json('prefabs.json'), meshes: json('meshes.json'), bin: new Uint8Array(readFileSync(new URL('meshes.bin', DIR))), materials: json('materials.json'), animation: json('animation.json') });
export const ctxFor = (player) => ({ models: MODELS, player: () => player, billboardSize: () => [0.8, 1.6], modelBounds: () => ({ min: [-1, 0, -1], max: [1, 1, 1] }) });
const openWater = () => ({ mapPixelX: 10, mapPixelY: 20, position: [0, 0, 0], tileMap: new Uint8Array(128 * 128), sampleHeight: () => 20 });

/** csa_sailing's scripted scene, trimmed: open water everywhere, the keys held as a set, a quarter second a frame. */
export function sea({ ipnm = false, heights = () => 20 } = {}) {
  const held = new Set(), started = new Set();
  const player = { position: [1, 2, 3], yaw: 0, frozen: 0 };
  const t = { ...openWater(), sampleHeight: heights };
  const input = { has: (a) => held.has(a), started: (a) => started.has(a), horizontal: () => 0, vertical: () => 0, toggleAutorun: false };
  const out = { hud: [], fatigue: 0, packed: [], removed: [] };
  const rt = createComeSailAwayRuntime({
    pool: { models: MODELS, ready: () => true, spawnNow: (boat, p) => { spawnBoat(boat, ctxFor(p)); return boat; }, remove: (b) => out.removed.push(b) },
    player: () => ({ position: [...player.position], rotation: [0, Math.sin((player.yaw * Math.PI) / 360), 0, Math.cos((player.yaw * Math.PI) / 360)] }),
    camera: () => ({ position: [0, 50, 0], forward: [0, -1, 0] }),
    currentMapPixel: () => ({ X: 10, Y: 20 }), isPlayerInside: () => false, blockWaterLevel: () => NO_WATER_LEVEL, iliacPuddleNoMore: () => ipnm,
    raycast: () => null, playerTerrain: () => t, terrainAt: () => t, terrains: () => [t], heightMapValue: () => 255, worldCompensation: () => [0, 0, 0],
    hudText: (s) => out.hud.push(s), midScreenText: () => {}, log: () => {}, random: { range: (min) => min }, time: () => 0, persistentDungeonBoats: () => false,
    packedItems: { serialize: (i) => i, deserialize: (r) => r }, dt: () => 0.25, setting: (key) => ({ 'Waves.Enable': false })[key], input,
    helm: { setPlayerPosition: (p) => { player.position = [...p]; }, setFacing: (y) => { player.yaw = y; }, turnPlayer: (d) => { player.yaw += d; }, freeze: (s) => { player.frozen = s; }, frozen: () => player.frozen > 0, stopRunning: () => {}, footsteps: () => {}, alignToGround: () => {} },
    transport: { isFoot: () => true, setFoot: () => {}, hasHorse: () => false, hasCart: () => false },
    ship: { owns: () => true, assign: () => {}, removePermanentScene: () => {} },
    entity: { isFemale: () => false, carriedWeight: () => 10, wagonWeight: () => 0, decreaseFatigue: (n) => { out.fatigue += n; } },
    cargoWeight: () => 0, sphereCastAll: () => [], enemies: () => [], timeScale: () => 1, setTimeScale: () => {}, messageBox: () => {},
    items: { create: (templateIndex) => ({ templateIndex, UID: 900 + out.packed.length, message: 0 }), addToPlayer: (item) => out.packed.push(item) },
  });
  return { rt, held, started, input, out, player, terrain: t };
}

/** One frame of the mod's helm: Update and LateUpdate after the coroutines' frame end and FixedUpdate, as the host runs it. */
const frame = (s) => { s.rt.endOfFrame(); s.rt.fixedUpdate(); s.rt.update(); s.rt.lateUpdate(); };

/** The journey's hand at the mod's helm: the keys the helm says, pressed as the host presses them, until the boat is
 *  within 60 m of a mark `dist` metres off `markDeg`, the wind blowing toward `windDeg`. The game's seconds it took -
 *  or null, never there in `maxS`. FB1020c OAR-RUNG: `presses`, the helm's own keys pressed one a frame before the
 *  journey sets out (W, S, the arrows: the rung she is left on); the answer carries the helm's rung at the end and
 *  `letGo(seconds)` - the journey's end as world.js tvSeaFrame makes it (the hand off the helm, the sails lowered if
 *  they stand), then `seconds` of the helm left alone: `{ run }` the metres she made, `way` her way at the last, `rung`. */
export function sailTo(hull, windDeg, markDeg, { dist = 600, windLen = 1.5, maxS = 1500, presses = [] } = {}) {
  const s = sea();
  const boat = s.rt.PlaceBoat([0, 34, 0], [0, 0, 1], hull, 0, null);
  s.rt.StartSailing(boat);
  const wr = (windDeg * Math.PI) / 180, mr = (markDeg * Math.PI) / 180;
  const wind = () => {
    s.rt.state.windVectorTarget = [Math.sin(wr) * windLen, 0, Math.cos(wr) * windLen];
    s.rt.state.windVectorCurrent = [...s.rt.state.windVectorTarget];
  };
  for (const key of presses) { wind(); s.started.clear(); s.started.add(key); frame(s); s.started.clear(); }
  const mark = [Math.sin(mr) * dist, Math.cos(mr) * dist];
  const st = createSeaHelm();
  const dt = 0.25;
  for (let t = 0; t < maxS; t += dt) {
    wind();
    const p = boat.GameObject.position, fw = quatRotate(boat.GameObject.rotation, [0, 0, 1]);
    if (Math.hypot(mark[0] - p[0], mark[1] - p[2]) < 60) {
      const letGo = (seconds) => {
        s.held.clear(); s.started.clear(); s.input.toggleAutorun = false;   // tvSeaRelease
        if (s.rt.state.sailPosition > 0) { s.started.add(BOAT_ACTIONS.toggleSail); frame(s); s.started.clear(); }   // the sails down
        const from = [...boat.GameObject.position];
        for (let k = 0; k < seconds / dt; k++) { wind(); frame(s); }
        const q = boat.GameObject.position, v = s.rt.state.MoveVectorCurrent;
        return { run: Math.hypot(q[0] - from[0], q[2] - from[2]), way: Math.hypot(v[0], v[1], v[2]), rung: s.rt.state.oarThrottle };
      };
      return { t, fatigue: s.out.fatigue, rung: s.rt.state.oarThrottle, letGo };
    }
    const v = s.rt.state.velocityCurrent ?? [0, 0, 0], w = s.rt.state.windVectorCurrent, cargo = s.rt.state.boatCargoMod;
    const cmd = seaHelmStep(st, {
      heading: headingOf(fw[0], fw[2]), bearing: headingOf(mark[0] - p[0], mark[1] - p[2]), wind: [w[0], w[2]], hasSails: boat.Sails.length > 0,
      squareOnly: squareOnly(boat), sailsUp: s.rt.state.sailPosition > 0, canSail: s.rt.CanSail(boat), way: v[2], dt,
      crewed: boat.crewed, oarWay: HANDLING.moveSpeedOar * boat.modifierMoveSpeedOar * cargo, sailWay: HANDLING.moveSpeedSail * boat.modifierMoveSpeedSail * cargo * Math.hypot(w[0], w[2]),
    });
    s.held.clear(); s.started.clear();
    if (cmd.turn > 0) s.held.add('MoveRight'); else if (cmd.turn < 0) s.held.add('MoveLeft');
    s.input.toggleAutorun = cmd.row;
    if (cmd.sails) s.started.add(BOAT_ACTIONS.toggleSail);
    frame(s);
  }
  return null;
}
