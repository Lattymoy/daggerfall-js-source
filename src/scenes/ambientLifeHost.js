// @ts-check
// AMBIENT-LIFE (bible/07-Rendering/Ambient-Life.md): THE CREATURES IN A HOST - the one runtime both exterior hosts
// build. A host lends it the world (systems/ambientLife/ambientLife.js AmbientWorld), calls `frame` on each outdoor
// frame and `draw` once the opaque world stands, and moves it with the floating origin.
// THE FOUR HOSTS RULE (bible/Home.md): world.js and exterior.js build it. worldModes.js (the interiors) and
// dungeonContext.js (the dungeons) build none: there is no sky there, and their frames never call it.
import { getPref } from '../systems/uiPrefs.js';
import { pageParam, pageHas } from '../systems/pageQuery.js';
import { compiledPass } from '../render/glProgram.js';
import { AmbientLifePass, AMBIENT_LIFE_PROGRAMS } from '../render/ambientLifePass.js';
import { AmbientLife } from '../systems/ambientLife/ambientLife.js';
import { ambientCast, NO_CAST } from '../systems/ambientLife/ambientCast.js';
import { AL_INSTANCE_FLOATS, AL_MAX_INSTANCES } from '../systems/ambientLife/ambientBody.js';
import { isOutdoorWaterTile } from '../world/terrain/terrainSurface.js';

/** Real seconds between two reads of who stands (the hour, the weather and the climate move slowly). */
export const AL_CAST_EVERY_S = 0.5;

/** The `?wildlife=` door: 'off', a density 0..2 (`on` 1), or null for the player's switch. @param {string|null} v */
export function wildlifeDoor(v) {
  if (v === null || v === undefined) return null;
  const s = String(v).trim().toLowerCase();
  if (s === 'off') return 'off';
  if (s === 'on' || s === '') return 1;
  const n = Number(s);
  return Number.isFinite(n) ? Math.max(0, Math.min(2, n)) : null;
}

/** The density the creatures stand at now: 0 off (the `ambientLife` pref, or `?wildlife=off`). */
export function wildlifeDensity(search = globalThis.location?.search ?? '') {
  const door = wildlifeDoor(pageParam('wildlife', search));
  if (door === 'off') return 0;
  if (typeof door === 'number') return door;
  return getPref('ambientLife') ? 1 : 0;
}

const DOWN = Object.freeze([0, -1, 0]);
/** A host collider's roofs (player/collider.js raycast): the first mesh a ray down from `top` meets, -Infinity none. */
export function colliderRoof(collider, reach = 160) {
  const from = [0, 0, 0];
  return (x, z, top) => {
    from[0] = x; from[1] = top; from[2] = z;
    const d = collider.raycast(from, DOWN, reach);
    return Number.isFinite(d) ? top - d : -Infinity;
  };
}

/** The buildings of a host's built pixels (scenes/pixelBuild.js `buildings`, pixel-local boxes) as scene boxes now.
 *  `pixels()` the entries, `translation(p, out)` a pixel's scene origin. */
export function builtBoxes(pixels, translation) {
  const t = [0, 0, 0];
  return () => {
    const out = [];
    for (const p of pixels()) {
      if (!p.buildings?.length) continue;
      translation(p, t);
      for (const { aabb: { min, max } } of p.buildings) {
        out.push({ min: [min[0] + t[0], min[1] + t[1], min[2] + t[2]], max: [max[0] + t[0], max[1] + t[1], max[2] + t[2]] });
      }
    }
    return out;
  };
}

/** The streaming host's world (scenes/world.js): `heightAt` its walk ground, `seaY()` its sea's surface,
 *  `groundSampleAt(pos)` the tile under a point, its collider, its built pixels and their `state` (pixelTranslation). */
export function streamedWorld(heightAt, seaY, groundSampleAt, collider, built, state) {
  return {
    ground: (x, z) => heightAt(x, z),
    wet: (x, z) => {
      const g = heightAt(x, z);
      if (!Number.isFinite(g) || g < seaY()) return true;   // unbuilt ground is no place to stand either
      const t = groundSampleAt([x, 0, z]);
      return !!t && isOutdoorWaterTile(t.tile);
    },
    roof: colliderRoof(collider),
    boxes: builtBoxes(() => built.values(), (p, out) => state.pixelTranslation(p.px, p.py, out)),
  };
}

/** The host standing now. A boot kills the loop before it, so the next host built lets this one's GL go (EVERY
 *  ALLOCATION HAS AN OWNER - snowfallHost.js's way: the teardown is on the path that ends it). */
let standing = /** @type {{ dispose(): void }|null} */ (null);

/**
 * The runtime. `gl` the renderer's context (none: nothing drawn), `world` the host's AmbientWorld, `random` a test's
 * stand-in, `density` the switch read each frame (wildlifeDensity).
 * @param {{ gl?: any, world: import('../systems/ambientLife/ambientLife.js').AmbientWorld, random?: () => number, density?: () => number }} opts
 */
export function createAmbientLifeHost({ gl = null, world, random = Math.random, density = () => wildlifeDensity() }) {
  standing?.dispose();
  const life = new AmbientLife(world, { random });
  const pass = gl ? compiledPass(gl, AMBIENT_LIFE_PROGRAMS, () => new AmbientLifePass(gl), (e) => console.warn('[wildlife] its program failed - no creatures are drawn', e?.message ?? e)) : null;
  const instances = new Float32Array(AL_MAX_INSTANCES * AL_INSTANCE_FLOATS);
  let cast = NO_CAST, castWait = 0, solid = 0, glow = 0, broken = false;
  const host = {
    life,
    get cast() { return cast; },
    get drawn() { return solid + glow; },
    /**
     * An outdoor frame. `dt` the game's seconds (none while paused), `feet` the player's, `minuteOfDay` the world clock's,
     * `weather` the word DFU's ambience hears (presetForExterior's), `climate` the player's pixel's index, `winter` the
     * climate season's. @param {number} dt @param {ArrayLike<number>} feet @param {number} minuteOfDay
     * @param {string} weather @param {number} climate @param {boolean} [winter]
     */
    frame(dt, feet, minuteOfDay, weather, climate, winter = false) {
      const d = broken ? 0 : density();
      if (!(d > 0)) { if (solid + glow) { life.clear(); solid = glow = 0; } return; }
      try {
        if ((castWait -= Math.max(0, dt)) <= 0) {
          castWait = AL_CAST_EVERY_S;
          cast = ambientCast({ minuteOfDay, weather, climate, winter: !!winter, town: life.town, coast: life.coast, density: d });
        }
        life.step(dt, feet, cast);
        ({ solid, glow } = life.write(instances));
      } catch (e) {
        // a fault stops the creatures, never the host's frame
        broken = true; life.clear(); solid = glow = 0;
        console.warn('[wildlife] a frame threw - the creatures stop here:', e?.stack ?? e);
      }
    },
    /** Drawn with the opaque world: `r` the renderer, `light` the flats' light at the player. Answers whether it drew
     *  (the host marks the foreign pass). */
    draw(r, proj, view, light) {
      if (broken || !(solid + glow)) return false;
      const p = pass?.();
      return !!p && p.draw(r, proj, view, light, instances, solid, glow, r.worldViewportPx?.[3] ?? gl.drawingBufferHeight);
    },
    /** The player struck or cast at `at`: what is near takes fright. */
    scare(at, radius) { if (!broken) life.scare(at, radius); },
    /** The floating origin moved the scene by `offset`. */
    offsetOrigin(offset) { life.offset(offset); },
    /** A load, a travel's landing: the next frame starts afresh. */
    clear() { life.clear(); solid = glow = 0; },
    /** EVERY ALLOCATION HAS AN OWNER: the pass's GL. */
    dispose() {
      if (standing === host) standing = null;
      if (pass?.settled) pass()?.dispose();
      broken = true; life.clear(); solid = glow = 0;
    },
  };
  standing = host;
  if (pageHas('shot')) globalThis.__wildlife = host;   // the probes' read (tools/wildlifeProbe.mjs), shot mode alone
  return host;
}
