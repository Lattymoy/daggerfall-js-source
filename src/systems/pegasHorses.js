// ═══════════════════════════════════════════════════════════════════
// PH1 — THE HORSE IN THE WORLD. Pegas Horse Ranch's horse is a
// CREATURE (decision 3, Pegas-Arc): it stands where you left it, it
// idles, it can be walked up to and activated, it is saved with the
// world. This pool owns every such horse in the streaming host - the
// records, their assemblies (the vendored mesh and clips, MW-D41's
// build, one per horse), their idle law, their save shape, and the
// activation targets the host's ladder picks from.
//
// THE IDLE LAW is the script's `AiWander, 0, 0, 0, 60, 20, 10` (:103,
// :298, :945): distance 0 - the horse never wanders - and idle
// chances 60 / 20 / 10 for Idle2 / Idle3 / Idle4, the rest Idle.
// Morrowind re-rolls an idle when the current one ends; the port
// rolls on a fixed clock instead (IDLE_ROLL_SECONDS), because the
// assembly loops its clips - a recorded simplification, not a law.
// "Stay Put" (`AiWander 0 0 0 0 10 5 3`) and "Follow Me" (`AiFollow`)
// are PH2's; a PH1 horse stands.
//
// THE RIDDEN HORSE is not stepped here: the host's ride owns it (the
// motor is the horse's body, decision 4) and writes its position and
// facing back into the record each frame; this pool only draws the
// horses nobody rides and keeps the ridden one's record current.
// ═══════════════════════════════════════════════════════════════════

import { loadPegasHorse, horseModelMatrix } from './pegasHorse.js';
import { regenStanding } from './pegasRide.js';

/** The script's idle chances, per hundred, in the order it names them. */
export const IDLE_CHANCES = Object.freeze([['idle2', 60], ['idle3', 20], ['idle4', 10]]);
/** The port's roll clock (see the header). */
export const IDLE_ROLL_SECONDS = 4;
/** The activation box round a standing horse: the mod's lifesize build
 *  is ~1.7 m at the withers and ~2.7 m to the ear tips (MW-D42). */
export const HORSE_HALF_WIDTH = 1.2;
export const HORSE_HEIGHT = 2.7;
export const HORSE_ACTIVATION_DISTANCE = 3.5;

/** `hr_horse_stat_01`'s stat law for a horse the pen would sell
 *  (:21-32): the PH3 roll. PH1 spawns a plain common horse with the
 *  midpoint of that roll, so the numbers are the script's shape. */
export function defaultStats(breed = 1) {
  const strength = 55, endurance = 55, intelligence = 55, speed = 19;
  return { breed, sex: 0, strength, endurance, intelligence, speed, maxHealth: 3 * strength + endurance, health: 3 * strength + endurance };
}

/** The record shape the riding law reads (`horse.endurance`,
 *  `horse.stamina` - pegasRide.js), over a pool record whose numbers
 *  live in `stats`. One view for the pool's regen and the rider's
 *  machine, so both read the same endurance. */
export function horseRecord(h) {
  return {
    get speed() { return h.stats.speed; },
    get endurance() { return h.stats.endurance; },
    get stamina() { return h.stamina; },
    set stamina(v) { h.stamina = v; },
  };
}

/** A .kf keeps its group names as written (`Idle2`); the mod's
 *  script names them as Morrowind does, case-blind (mwAnim.js's
 *  note). The lookup is case-blind for the same reason. */
export function hasGroup(assembly, group) {
  const want = String(group).toLowerCase();
  return !!assembly && assembly.groups.some((g) => String(g).toLowerCase() === want);
}

/** The idle roll: a number in [0, 100) to a clip group. */
export function rollIdle(r100) {
  let acc = 0;
  for (const [group, chance] of IDLE_CHANCES) { acc += chance; if (r100 < acc) return group; }
  return 'idle';
}

let _nextId = 1;

/**
 * @param {object} deps
 *   renderer - the character mesh/texture doors
 *   archives - () => Promise<archives> - the MW-D50 composition (the
 *     player's own attach ahead of the vendored set)
 *   rolls - Math.random or a seeded stand-in
 */
export function createPegasHorses({ renderer, archives, rolls = Math.random }) {
  const horses = [];

  function spawn({ pos, yawDeg = 0, breed = 1, stats = null, stamina = null, id = null }) {
    const s = stats ?? defaultStats(breed);
    const h = {
      id: id ?? _nextId++, breed, pos: [pos[0], pos[1], pos[2]], yawDeg,
      stats: s, stamina: stamina ?? s.endurance,
      assembly: null, loadFailed: false, clip: 'idle', idleTimer: rolls() * IDLE_ROLL_SECONDS,
      ridden: false, dead: false,
    };
    if (id != null && id >= _nextId) _nextId = id + 1;
    horses.push(h);
    // the art, off the frame; a failed load leaves a record that is
    // real to the game (it can be mounted, saved) but draws nothing
    // and says so once
    Promise.resolve(archives()).then((arcs) => {
      if (h.disposed) return;
      const a = loadPegasHorse({ renderer, archives: arcs, variant: breed });
      if (!a.ok) { h.loadFailed = true; console.warn(`[pegas] horse ${h.id}: no art (${a.stage}): ${a.error ?? ''}`); return; }
      if (!a.setClip('Idle')) a.setClip(a.groups[0]);
      h.assembly = a;
    }).catch((e) => { h.loadFailed = true; console.warn(`[pegas] horse ${h.id}: load failed:`, e?.message ?? e); });
    return h;
  }

  /** The standing horses' frame: endurance back (:314-316), the idle roll. */
  function update(dt) {
    for (const h of horses) {
      if (h.dead || h.ridden) continue;
      regenStanding(horseRecord(h), dt);
      h.idleTimer -= dt;
      if (h.idleTimer <= 0) {
        h.idleTimer = IDLE_ROLL_SECONDS;
        // the roll is recorded whether or not the .kf carries the group;
        // a horse without it stands as it was (Morrowind plays nothing)
        h.idleRoll = rollIdle(rolls() * 100);
        if (hasGroup(h.assembly, h.idleRoll) && h.assembly.setClip(h.idleRoll)) h.clip = h.idleRoll;
      }
    }
  }

  /** Draw every horse nobody rides, at its own feet and facing. A
   *  paused game neither advances nor hides (the horse is scenery
   *  then, like a windmill). */
  function draw(dt, { paused = false } = {}) {
    for (const h of horses) {
      if (h.dead || h.ridden || !h.assembly) continue;
      h.assembly.advance(paused ? 0 : dt);
      renderer.drawCharacter(h.assembly.mesh, horseModelMatrix(h.pos, h.yawDeg * Math.PI / 180));
    }
  }

  /** The activation ladder's targets (pickActivatable's shape). */
  function targets() {
    return horses.filter((h) => !h.dead && !h.ridden).map((h) => ({
      key: `pegas:${h.id}`,
      aabb: [[h.pos[0] - HORSE_HALF_WIDTH, h.pos[1], h.pos[2] - HORSE_HALF_WIDTH], [h.pos[0] + HORSE_HALF_WIDTH, h.pos[1] + HORSE_HEIGHT, h.pos[2] + HORSE_HALF_WIDTH]],
      distance: HORSE_ACTIVATION_DISTANCE,
    }));
  }
  const byKey = (key) => horses.find((h) => `pegas:${h.id}` === key) ?? null;

  function offsetAll(offset) {
    for (const h of horses) { h.pos[0] += offset[0]; h.pos[1] += offset[1]; h.pos[2] += offset[2]; }
  }

  /** The save shape - natives for x/z like every pool, the record whole. */
  function snapshotWorld(toNative) {
    return horses.filter((h) => !h.dead).map((h) => {
      const wc = toNative(h.pos);
      return { id: h.id, breed: h.breed, nativeX: wc.x, nativeZ: wc.z, y: h.pos[1], yawDeg: h.yawDeg, stats: { ...h.stats }, stamina: h.stamina };
    });
  }
  function restoreWorld(saved, fromNative, yOffset = 0) {
    for (const sh of saved ?? []) {
      const [lx, lz] = fromNative(sh.nativeX, sh.nativeZ);
      spawn({ id: sh.id, breed: sh.breed, pos: [lx, sh.y + yOffset, lz], yawDeg: sh.yawDeg, stats: { ...sh.stats }, stamina: sh.stamina });
    }
  }

  function remove(h) {
    const i = horses.indexOf(h);
    if (i >= 0) horses.splice(i, 1);
    h.disposed = true;
    h.assembly?.dispose();
    h.assembly = null;
  }
  function destroy() { for (const h of [...horses]) remove(h); }

  return { horses, spawn, update, draw, targets, byKey, offsetAll, snapshotWorld, restoreWorld, remove, destroy };
}
