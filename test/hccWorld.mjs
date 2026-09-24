// HCC: THE RUNTIME'S FAKE HOST - a flat world at y = 0 around a player who walks and mounts, the eight settings at
// their defaults, the hotkeys, the windows' questions. One home for test/hcc_runtime.test.js and the branch audit's
// pins (test/audit_hcc_branch.test.js). `w.noGround` takes the ground away (a spot the probe cannot hit yet).
import { createHorseCartRuntime } from '../src/systems/horseCart.js';
import { TRANSPORT } from '../src/systems/horseCartLaw.js';

export const RATIO = 40, WX0 = 100000, WZ0 = 200000;
export const PARTS = { wheelLeftPivot: [-0.9, 0.5, -0.6], wheelRightPivot: [0.9, 0.5, -0.6], wheelRadius: 0.5, bounds: { min: [-1, 0, -1.6], max: [1, 1.3, 1] } };

/** A flat world at y = 0 around a player who owns what `items` says, the mod's settings at their defaults. */
export function makeWorld({ cart = true, horse = true, settings = {}, ground = 0 } = {}) {
  const w = {
    mode: TRANSPORT.Foot, items: { cart, horse }, inside: false, dungeon: false, building: false, buildingKey: 7, dungeonId: 99,
    pos: [0, 0.9, 0], yaw: 0, said: [], mid: [], now: 0, keys: new Set(), prompt: null, openedInv: 0, activateMode: 'grab', travelOpt: null, changed: 0,
    threats: [], ready: true, ship: false, weight: 0, settings: { ...settings }, log: [],
  };
  const phys = {
    now: () => w.now,
    raycastAll: (o, d, max) => (!w.noGround && d[1] < 0 && o[1] >= ground && o[1] - ground <= max ? [{ point: [o[0], ground, o[2]], distance: o[1] - ground, normal: [0, 1, 0] }] : []),
    sphereCastClear: () => true, threats: () => w.threats,
  };
  const fwd = () => [Math.sin(w.yaw), 0, Math.cos(w.yaw)];
  const deps = {
    ready: () => w.ready,
    transport: { get: () => w.mode, set: (m) => { w.mode = m; }, hasCart: () => w.items.cart, hasHorse: () => w.items.horse, isOnShip: () => w.ship },
    player: { position: () => [...w.pos], forward: fwd, movement: () => ({ position: [...w.pos], forward: fwd() }) },
    gps: { worldX: () => WX0 + w.pos[0] * RATIO, worldZ: () => WZ0 + w.pos[2] * RATIO, scenePosition: () => [...w.pos], currentMapPixel: () => ({ x: 0, y: 0 }) },
    streaming: { isReady: () => true, isInit: () => false, mapPixelX: () => 0, mapPixelY: () => 0, ratio: () => RATIO },
    enterExit: { isPlayerInside: () => w.inside, isPlayerInsideDungeon: () => w.dungeon, isPlayerInsideBuilding: () => w.building, buildingKey: () => w.buildingKey, dungeonId: () => w.dungeonId },
    entity: { wagonWeight: () => w.weight, wagonKgLimit: () => 750 },
    activateMode: () => w.activateMode, fadeInProgress: () => false,
    say: (l) => w.said.push(l), setMidScreenText: (t) => w.mid.push(t), tooFarText: () => 'You are too far away...',
    settings: () => ({ ...w.settings }), keyDown: (n) => w.keys.has(n), now: () => w.now, travelOptionsActive: () => w.travelOpt,
    worldCoordToMapPixel: () => ({ x: 0, y: 0 }),
    openInventoryWithWagon: () => { w.openedInv++; },
    openNamePrompt: (o) => { w.prompt = { ...o, open: true }; return { isOpen: () => !!w.prompt?.open }; },
    phys, presentation: { wagonParts: () => PARTS, horseArt: { ensureStationary: () => true, ensureWalk: () => {}, hasWalk: () => true }, onChanged: () => { w.changed++; } },
    log: { warn: (m) => w.log.push(m), error: (m) => w.log.push(m), info: () => {} },
  };
  const rt = createHorseCartRuntime(deps);
  const step = (n = 1, dt = 1 / 30) => { for (let i = 0; i < n; i++) { w.now += dt; rt.lateUpdate(dt); w.keys.clear(); } };
  const walk = (dz, n = 60) => { for (let i = 0; i < n; i++) { w.pos[2] += dz / n; step(); } };
  const scene = (wx, wz) => [(wx - WX0) / RATIO, 0, (wz - WZ0) / RATIO];
  return { w, rt, step, walk, scene, state: () => rt._state() };
}
