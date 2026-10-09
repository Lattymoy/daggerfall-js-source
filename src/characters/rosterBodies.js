// @ts-check
// MWNPC10 (2026-10-09, the MW-NPC arc's tenth slice - bible/04-Characters/Morrowind-NPCs.md section 15): AN ACTOR FOR A
// POPULATION THAT KEEPS NO FOE RECORD. The gate's boss and host, the siege's people, a ship's crew are driven by a relay
// or a roster, not by a foe pool: no `_atkA` attack count, no hit flash marks, no entity. What their hosts DO change is a
// key a frame - the relay's attack time, the time a blow met them - so the actor keeps its own counts on the record,
// one more each time a key changes to a new value (a NaN is no key, and a held value never counts twice), and the
// lane's swing and recoil follow them as they follow a foe's. The look is the caller's (a creature's off its mobile,
// characters/creatureBodies.js; a person's).

/** A key a host changed: a finite number or a string is one; null, undefined and NaN are none. */
const keyOf = (k) => (typeof k === 'string' || Number.isFinite(k) ? k : null);

/**
 * The actor the lane stands for `rec`, one object a record rewritten each frame (characters/npcBodies.js `stand`):
 * `swingKey` a value that changes when it strikes (the relay's attack time), `hitKey` one that changes when it is hurt,
 * `dead` 0 standing or the death's roll + 1, `scale` its size over its body's (the gate's boss stands three times
 * a man). Never sheathed - these are fighters or stand like them.
 * @param {any} rec
 * @param {{ id: any, look: any, feet: number[], yaw: number, moving?: boolean, running?: boolean, swingKey?: any,
 *   hitKey?: any, dead?: number, scale?: number }} o
 */
export function rosterActor(rec, { id, look, feet, yaw, moving = false, running = false, swingKey = null, hitKey = null, dead = 0, scale = 1 }) {
  const a = rec._mwActor ??= { id, look: null, feet: null, yaw: 0, moving: false, running: false, drawn: true, swings: 0, strike: 1, casts: 0, castRange: 2, hits: 0, dead: 0, scale: 1 };
  a.id = id; a.look = look; a.feet = feet; a.yaw = Number.isFinite(yaw) ? yaw : 0;
  a.moving = !!moving; a.running = !!moving && !!running;
  const sk = keyOf(swingKey), hk = keyOf(hitKey);
  if (sk !== rec._mwSwingKey) { if (sk !== null) a.swings = (a.swings + 1) & 0xffff; rec._mwSwingKey = sk; }
  if (hk !== rec._mwHitKey) { if (hk !== null) a.hits = (a.hits + 1) & 0xffff; rec._mwHitKey = hk; }
  a.strike = 1 + (a.swings % 6);   // POSE_STRIKES 1..6, off the count as a foe's is
  a.dead = dead > 0 ? dead | 0 : 0;
  a.scale = scale > 0 ? scale : 1;
  return a;
}
