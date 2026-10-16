// @ts-check
// ═══════════════════════════════════════════════════════════════════
// DW-E1 (2026-09-25): TransientObjectTracker.cs (Iliac Puddle No More
// 1.2.2, jet082) - the list a spawner keeps of what it stood in the world
// (the fish, the foes, the sunken loot), and the four things it does with
// it. An object is anything with `destroyed()` (Unity's `== null`: killed,
// picked up, destroyed from outside), `position()` (its world [x, y, z])
// and `destroy()`.
// ═══════════════════════════════════════════════════════════════════

/** @typedef {{ destroyed(): boolean, position(): number[], destroy(): void }} Transient */

export class TransientObjectTracker {
  constructor() {
    /** @type {Transient[]} */
    this.objects = [];
  }

  get count() { return this.objects.length; }

  /** Add: a live object joins the list (a null does not). @param {?Transient} go */
  add(go) { if (go) this.objects.push(go); }

  /** Clear: every live object destroyed now, last first, and the list emptied. */
  clear() {
    for (let i = this.objects.length - 1; i >= 0; i--) {
      const o = this.objects[i];
      if (o && !o.destroyed()) o.destroy();
    }
    this.objects.length = 0;
  }

  /**
   * Release: every object handed to the encounter pulse's destroy queue
   * (UnderwaterEncounterPulse.QueueDestroy - spread over frames), last
   * first, and the list emptied.
   * @param {(o: Transient) => void} queueDestroy
   */
  release(queueDestroy) {
    for (let i = this.objects.length - 1; i >= 0; i--) queueDestroy(this.objects[i]);
    this.objects.length = 0;
  }

  /**
   * Prune: the dead dropped and the far destroyed (flat distance past
   * `maxFlatDistance`), last first; then, while more than `maxCount`
   * remain, the farthest (the first dead one found wins outright).
   * @param {number[]} playerPos @param {number} maxFlatDistance @param {number} maxCount
   */
  prune(playerPos, maxFlatDistance, maxCount) {
    maxCount = Math.max(0, maxCount);
    const maxSq = maxFlatDistance * maxFlatDistance;
    const flatSq = (/** @type {Transient} */ o) => {
      const p = o.position();
      const dx = p[0] - playerPos[0], dz = p[2] - playerPos[2];
      return dx * dx + dz * dz;
    };
    for (let i = this.objects.length - 1; i >= 0; i--) {
      const o = this.objects[i];
      if (!o || o.destroyed()) { this.objects.splice(i, 1); continue; }
      if (flatSq(o) > maxSq) { o.destroy(); this.objects.splice(i, 1); }
    }
    while (this.objects.length > maxCount) {
      let far = -1, farSq = -1;
      for (let i = 0; i < this.objects.length; i++) {
        const o = this.objects[i];
        if (!o || o.destroyed()) { far = i; break; }
        const d = flatSq(o);
        if (d > farSq) { farSq = d; far = i; }
      }
      if (far < 0) break;
      const o = this.objects[far];
      if (o && !o.destroyed()) o.destroy();
      this.objects.splice(far, 1);
    }
  }
}
