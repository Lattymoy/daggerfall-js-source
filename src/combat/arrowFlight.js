// C13: arrow flight for the hosts WITHOUT the dungeon missile system
// (worldModes interiors, the exterior walk hosts). The dungeon's
// arrows are full S5 missiles (foe seeking, BowDamage recovery);
// out here there are no live targets yet, and DFU's law for an
// arrow that meets geometry is simply LOST - so this module owns
// the visible flight only: the 99800 arrow model oriented along its
// direction, MISSILE_SPEED with the swept geometry raycast (the
// sweep covers the whole step - raw dt cannot tunnel), the
// MISSILE_LIFESPAN retire. Constants single-source from the S5
// missile system (spellcast.js); the matrix law mirrors
// dungeonContext's arrowMatrix verbatim. When exterior foes land
// (random encounters), the dungeon's seeking path is the model to
// fold toward - recorded in Combat.md.

import { MISSILE_SPEED, MISSILE_COLLIDER_RADIUS, MISSILE_LIFESPAN_S } from '../systems/spellcast.js';
import { trs } from '../world/mat4.js';

export const ARROW_MODEL_ID = 99800;

/** The oriented arrow transform (dungeonContext.arrowMatrix law). */
export function arrowMatrix(pos, dir) {
  const yaw = Math.atan2(dir[0], dir[2]) * 180 / Math.PI;
  const pitch = Math.asin(-Math.max(-1, Math.min(1, dir[1]))) * 180 / Math.PI;
  return trs(pos[0], pos[1], pos[2], pitch, yaw, 0);
}

export class ArrowFlight {
  /**
   * @param getGpuMesh (modelId) => gpu mesh (async ok - the host's
   *                   pipeline function)
   * @param collider   Collider, or () => Collider for hosts whose
   *                   collider rebuilds (the weaponRig canvas rule)
   */
  constructor({ getGpuMesh, collider = null }) {
    this.getGpuMesh = getGpuMesh;
    this._collider = collider;
    this.arrows = [];
  }

  /** X2-slice: `meta` rides the arrow record - an ENEMY arrow
   *  carries { enemy: true, shooterFoe, weapon } and hunts the
   *  player through update's impact arm. Player arrows stay the
   *  visible-flight-only law (their FOE impacts resolve at the fire
   *  host's own hit chain, not here). */
  fire(from, dir, meta = {}) {
    this.arrows.push({ pos: [...from], dir: [...dir], age: 0, gpu: null, dead: false, ...meta });
  }

  update(dt, { playerFeet = null, onPlayerHit = null } = {}) {
    let live = 0;
    const c = typeof this._collider === 'function' ? this._collider() : this._collider;
    for (const m of this.arrows) {
      if (m.dead) continue;
      live++;
      if (m.gpu === null) {   // lazy model fetch, in-flight guard
        m.gpu = false;
        Promise.resolve(this.getGpuMesh(ARROW_MODEL_ID)).then((g) => { if (g && !m.dead) m.gpu = g; });
      }
      m.age += dt;
      if (m.age > MISSILE_LIFESPAN_S) { m.dead = true; continue; }
      const step = MISSILE_SPEED * dt;
      const hit = c ? c.raycast(m.pos, m.dir, step + MISSILE_COLLIDER_RADIUS) : Infinity;
      if (Number.isFinite(hit) && hit <= step + MISSILE_COLLIDER_RADIUS) { m.dead = true; continue; }   // met geometry: the arrow is LOST (DFU)
      m.pos[0] += m.dir[0] * step;
      m.pos[1] += m.dir[1] * step;
      m.pos[2] += m.dir[2] * step;
      // X2-slice: an enemy arrow tests the player mid-capsule per
      // step - the dungeon missile's exact contact law
      // (MISSILE_COLLIDER_RADIUS + the 0.45 body).
      if (m.enemy && playerFeet && onPlayerHit) {
        const dx = playerFeet[0] - m.pos[0], dy = playerFeet[1] + 0.9 - m.pos[1], dz = playerFeet[2] - m.pos[2];
        if (Math.hypot(dx, dy, dz) <= MISSILE_COLLIDER_RADIUS + 0.45) {
          onPlayerHit(m);
          m.dead = true;
          continue;
        }
      }
      // The mesh raycast never sees bare TERRAIN (the collider's
      // heightAt fallback floor) - an arrow at or under it has landed.
      if (c && m.pos[1] <= c.heightAt(m.pos[0], m.pos[2])) m.dead = true;
    }
    if (!live && this.arrows.length) this.arrows.length = 0;
  }

  /** Draw every live arrow (the host's mesh pass, after update). */
  draw(renderer, texRemap = undefined) {
    for (const m of this.arrows) {
      if (!m.dead && m.gpu) renderer.drawMesh(m.gpu, arrowMatrix(m.pos, m.dir), texRemap);
    }
  }
}
