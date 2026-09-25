// @ts-check
// ═══════════════════════════════════════════════════════════════════
// DW-E3 (2026-09-25): ILIAC PUDDLE NO MORE'S FISH IN THE STREAMED WORLD
// (jet082, 1.2.2) - what a fish is once the spawner stands it
// (UnderwaterPassiveFishSpawner.SpawnPassiveFish), and the frame's pump
// of them all (PassiveFishBehaviour.PumpAll). The laws are world/
// passiveFish.js; the spawner's pixels and the pulse are scenes/
// deepWatersEncounters.js; the items and their pictures systems/
// deepWatersFishItems.js.
//
// A FISH IS A LOOT CONTAINER. SpawnPassiveFish makes a billboard (its
// height the species' x Range(min, max), its width that by the aspect,
// FaceY - turned to the camera, pitch and all), puts the mod's underwater
// material on it (cut-out 0.1), a trigger box of its size (depth max(0.35,
// a quarter of its width)) for the ray, a DaggerfallLoot (DroppedLoot)
// holding the species' item, and the fish's icon for the loot window
// (FishLootIcon). The player takes a fish as they take a pile: the ray
// meets its box, within the loot container's reach (3.2 m), and the
// window opens on it; once its item is gone the fish is.
//
// THE CLOCK. Time.time and Time.deltaTime are the game's: the host hands
// them in, and nothing moves while the game does not.
// ═══════════════════════════════════════════════════════════════════

import { PassiveFish, rangeFloat, fishBillboardSize, PASSIVE_FISH_SPECIES } from '../world/passiveFish.js';
import { createFishSpawner, createEncounterPulse, FISH_ATTEMPTS_PER_PIXEL_PER_TICK } from './deepWatersEncounters.js';
import { RAY_DISTANCE, TREASURE_ACTIVATION_DISTANCE } from '../player/activate.js';

/** The mod's cut-out for a fish (SpawnPassiveFish's `_Cutoff` 0.1, which ConfigureUnderwaterDecorationMaterial copies). */
export const FISH_CUTOFF = 0.1;
/** AddFishClickCollider's depth: at least 0.35 m, else a quarter of the width. */
export const fishBoxDepth = (w) => Math.max(0.35, w * 0.25);
/** The key prefix a fish's activation target carries. */
export const FISH_KEY_PREFIX = 'dwFish:';

/**
 * @param {object} deps
 * @param {() => {frequency: number, maxLive: number, waterDepth: number}} deps.settings
 * @param {() => boolean} deps.canRunHeavy
 * @param {() => boolean} deps.exteriorWaterContext
 * @param {() => ?number[]} deps.playerPosition
 * @param {() => Iterable<object>} deps.loadedPixels
 * @param {(entry: object) => boolean} deps.isWaterPixel
 * @param {(entry: object) => number[]} deps.pixelOrigin
 * @param {(entry: object) => string} deps.keyOf
 * @param {(entry: object) => number} deps.climateIndexOf
 * @param {{loaded: (species: object) => boolean, spawnable: () => object[]}} deps.pictures - LoadFishTexture's answers
 * @param {(species: object) => ?object} deps.makeItem - TryCreateFishItem
 * @param {() => void} [deps.updateInventoryState] - PassiveFishResources.UpdateInventoryState
 * @param {() => number} [deps.roll] - the unseeded UnityEngine.Random (Port-Ledger A, the engine-PRNG rule)
 * @param {?{spawner: any, canPopulate: () => boolean, attempts: number}} [deps.enemies] - DW-E4: the pulse's other lane, the deep's foes
 */
export function createDeepWatersFish({ settings, canRunHeavy, exteriorWaterContext, playerPosition, loadedPixels, isWaterPixel, pixelOrigin, keyOf, climateIndexOf, pictures, makeItem, updateInventoryState = () => {}, roll = Math.random, enemies = null }) {
  /** @type {Array<{id: number, key: string, fish: PassiveFish, species: object, size: {w: number, h: number}, active: boolean, gone: boolean}>} */
  const fishes = [];
  const byKey = new Map();
  let nextId = 0;
  /** The frame being pumped - a spawn stands on its clock. */
  let frame = { time: 0, roll };

  function remove(o) {
    o.gone = true;
    byKey.delete(o.key);
    const i = fishes.indexOf(o);
    if (i >= 0) fishes.splice(i, 1);
  }

  /** SpawnPassiveFish: the picture loaded and the item made, or nothing. */
  function makeFish({ pos, species, school }) {
    if (!pictures.loaded(species)) return null;
    const item = makeItem(species);
    if (!item) return null;
    const height = species.billboardHeight * rangeFloat(species.minHeightMultiplier, species.maxHeightMultiplier, roll);
    const size = fishBillboardSize(species, height);
    const loot = { items: [item] };
    const fish = new PassiveFish({
      position: pos, loot, cruiseMultiplier: species.cruiseSpeedMultiplier, fleeMultiplier: species.fleeSpeedMultiplier,
      school, dartHoldMin: species.fleeDartHoldMin, dartHoldMax: species.fleeDartHoldMax,
    }, { time: frame.time, roll });
    const id = ++nextId;
    const o = {
      id, key: `${FISH_KEY_PREFIX}${id}`, fish, species, size, loot, active: true, gone: false,
      // TransientObjectTracker's reads: Unity's `== null` (destroyed, its item taken), the position, Object.Destroy
      destroyed: () => o.gone || fish.destroyed,
      position: () => fish.position,
      destroy: () => remove(o),
      // UnderwaterEncounterPulse.QueueDestroy's SetActive(false): not pumped, not drawn, not clickable
      hide: () => { o.active = false; },
    };
    fishes.push(o);
    byKey.set(o.key, o);
    return o;
  }

  const spawner = createFishSpawner({ settings, spawnable: () => pictures.spawnable(), makeFish, pixelOrigin, climateIndexOf });
  const pulse = createEncounterPulse({
    canRunHeavy, exteriorWaterContext, playerPosition, loadedPixels, isWaterPixel, pixelOrigin, keyOf, updateInventoryState,
    fish: { spawner, canPopulate: () => settings().frequency > 0 && pictures.spawnable().length > 0, attempts: FISH_ATTEMPTS_PER_PIXEL_PER_TICK },
    enemies,
  });

  return {
    spawner, pulse,
    get count() { return fishes.length; },
    get fishes() { return fishes; },

    /**
     * The frame's work, in DeepWaters.Update's order: UnderwaterEncounterPulse.Pump,
     * then PassiveFishBehaviour.PumpAll.
     * @param {import('../world/passiveFish.js').FishFrame} f
     */
    pump(f) {
      frame = f;
      pulse.pump(f);
      for (let i = fishes.length - 1; i >= 0; i--) {
        const o = fishes[i];
        if (!o || o.gone || !o.active) continue;
        if (!o.fish.managedUpdate(f)) remove(o);   // its loot emptied: Object.Destroy
      }
    },

    /**
     * The visible fish's activation boxes - the trigger box turned as the
     * billboard is (to the camera), within the ray's reach and the loot
     * container's (MC-2's widened pick), no collider of their own
     * (noSurface: a wall in front blocks them, the eye inside one skips it).
     * @param {number[]} camRight @param {number[]} camUp @param {number[]} camBack - the camera's basis (the box's axes)
     */
    lootTargets(camRight, camUp, camBack) {
      const out = [];
      for (const o of fishes) {
        if (o.gone || !o.active || !o.fish.visible) continue;
        const p = o.fish.position, hw = o.size.w / 2, hh = o.size.h / 2, hd = fishBoxDepth(o.size.w) / 2;
        const m = [camRight[0], camRight[1], camRight[2], 0, camUp[0], camUp[1], camUp[2], 0, camBack[0], camBack[1], camBack[2], 0, p[0], p[1], p[2], 1];
        const ex = [0, 1, 2].map((k) => Math.abs(camRight[k]) * hw + Math.abs(camUp[k]) * hh + Math.abs(camBack[k]) * hd);
        out.push({
          key: o.key, obb: { m, box: [-hw, -hh, -hd, hw, hh, hd] },
          aabb: { min: [p[0] - ex[0], p[1] - ex[1], p[2] - ex[2]], max: [p[0] + ex[0], p[1] + ex[1], p[2] + ex[2]] },
          distance: RAY_DISTANCE, reach: TREASURE_ACTIVATION_DISTANCE, noSurface: true,
        });
      }
      return out;
    },

    /** The fish a key names, while it swims. */
    fishFor(key) {
      const o = typeof key === 'string' ? byKey.get(key) : null;
      return o && !o.gone && o.active && o.loot.items.length > 0 ? o : null;
    },

    /** What the loot window reads of a fish (DaggerfallLoot's defaults and the fish's icon). */
    lootHooks(o, { containerImage, iconImage }) {
      return {
        items: () => o.loot.items,
        playerOwned: false,
        textureArchive: 0,
        textureRecord: 0,
        containerImage,
        pos: [...o.fish.position],
        // FishLootIcon: UpdateFishLootIcon (LateUpdate) sets the remote panel's picture to the fish's icon
        remoteImage: () => iconImage(o.species),
      };
    },

    /** The frame's draw: a group per species, the visible fish's centres and sizes. */
    drawGroups(textureOf) {
      const groups = new Map();
      for (const o of fishes) {
        if (o.gone || !o.active || !o.fish.visible) continue;
        const tex = textureOf(o.species);
        if (!tex) continue;
        let g = groups.get(o.species);
        if (!g) { g = { texture: tex, fps: 0, born: 0, facing: 2, cutoff: FISH_CUTOFF, billboards: [] }; groups.set(o.species, g); }
        g.billboards.push({ centre: o.fish.position, width: o.size.w, height: o.size.h, start: 0 });
      }
      return [...groups.values()];
    },

    /** A recentre moved the world by `offset`: the fish and their schools with it (Port-Ledger A, the Iliac Puddle No More row). */
    offsetAll(offset) {
      const schools = new Set();
      for (const o of fishes) {
        o.fish.shift(offset);
        if (o.fish.school) schools.add(o.fish.school);
      }
      for (const s of schools) for (let i = 0; i < 3; i++) s.center[i] += offset[i];
    },

    /** OnTransientReset (UnderwaterEncounterPulse.ResetState, the spawner's ClearAll). */
    reset() { pulse.reset(); },

    get debug() { return { fish: fishes.length, live: spawner.liveCount, pending: spawner.pendingCount, destroys: pulse.pendingDestroyCount }; },
  };
}

/**
 * LoadFishTexture's pictures: each species' own, fetched and decoded once,
 * edge-cleaned (the fish's underwater material is made from its billboard
 * material by CopyTextureAndTransform, which cleans it), rows turned to
 * the GPU's bottom-up, on the GPU as a one-layer array. A species whose
 * picture never comes never spawns (the mod's warning, once).
 * @param {object} deps
 * @param {(name: string) => Promise<Uint8Array>} deps.fetchBytes
 * @param {(bytes: Uint8Array) => Promise<{width: number, height: number, data: Uint8Array}>} deps.decode - top-down RGBA
 * @param {(img: object) => boolean} deps.clean - GetEdgeCleanedTexture's flood (underwaterDecorations.clearEdgeBlackPixels)
 * @param {(frames: object[]) => ?{tex: any, frames: number}} deps.createTexture
 */
export function createFishPictures({ fetchBytes, decode, clean, createTexture }) {
  const textures = new Map();
  const failed = new Set();
  let started = false;
  function start() {
    if (started) return;
    started = true;
    for (const s of PASSIVE_FISH_SPECIES) {
      (async () => {
        const img = await decode(await fetchBytes(s.textureName));
        const rows = new Uint8Array(img.width * img.height * 4);
        for (let y = 0; y < img.height; y++) rows.set(img.data.subarray((img.height - 1 - y) * img.width * 4, (img.height - y) * img.width * 4), y * img.width * 4);
        const frame = { width: img.width, height: img.height, data: rows };
        clean(frame);
        const t = createTexture([frame]);
        if (!t) throw new Error('no texture');
        textures.set(s, t);
      })().catch((e) => {
        failed.add(s);
        console.warn(`[DeepWaters] Could not load fish texture for '${s.itemName}': ${e?.message ?? e}; the species will not spawn.`);
      });
    }
  }
  return {
    start,
    loaded: (s) => textures.has(s),
    texture: (s) => textures.get(s) ?? null,
    /** BuildSpawnableCache: a weight and a picture, in the catalog's order. */
    spawnable: () => PASSIVE_FISH_SPECIES.filter((s) => s.spawnWeight > 0 && textures.has(s)),
    get failed() { return failed.size; },
  };
}
