// @ts-check
// WB14b (2026-10-19, bible/11-Multiplayer/Breach-Portents.md section 2): THE COURT STOOD INTO ITS CONTEXT - the dungeon
// arm's two court builders (WB3b's standCourt, WB6b's standDeadlands), moved out of scenes/worldModes.js whole (HOST-SPLIT:
// the host was a line under its ceiling, and a night's portents make the court's build the night's own). The host wires
// it; nothing here reads the host's scope but the seams it is handed.
//
// THE NIGHT'S PLAN. A portent's floors stand on its night alone (net/gate/gateBrain.js nightPlan): the court's mesh, its
// walkways' slabs and its collider are the plan's, the plan by the gate's day (world/gate/gateArena.js planOfDay - the
// relay draws the fight's with the same law), each mesh made once a plan and kept for the session as WB3b's one was.
//
// Not a DFU member. Ledger A (WB).
import { buildCourtModel, buildWalkSlabModel, walkSlabs, slabMatrix, courtFloorTris, planOfDay, COURT_ARCHIVE, COURT_TEXT } from '../../world/gate/gateArena.js';
import { buildDeadlandsLand, buildShardModel, deadlandsShards, shardMatrix } from '../../world/deadlandsLand.js';
import { gateArt, courtArt, GATE_ARCHIVE } from '../../world/gate/gateArt.js';
import { identity } from '../../world/mat4.js';

/** The collider's bucket for the court's floor. */
export const COURT_BUCKET = 'wb:court';
/** WB9b: no crossings heard - every walkway under the fire. */
export const NO_XA = Object.freeze([]);
/** WB9f: a court with no spoils on its floor stands no targets. */
const NO_TARGETS = Object.freeze([]);

/**
 * @param {{ renderer: any, host: any }} deps the dungeon host's renderer and its host's seams (gateFloor, spoilTargets,
 *   spoilName, deadlandsSeconds)
 */
export function createGateStand({ renderer, host }) {
  /** WB3b: the court's mesh - WB14b: one a night's plan (`key` -> mesh), each made once a session with the court's art and
   *  the gate stone's, uploaded once */
  const courtMeshes = new Map();
  let artUp = false;
  /** WB6b: the islands out in the fire and the one shard every floating piece of the floor is drawn from - made with the
   *  court, once a session. WB9b: and the one slab every walkway between the courts is laid in. */
  let landMesh = null, shardMesh = null, slabMesh = null;

  /** WB3b/WB14b: the court's mesh for a plan, made the first time it is asked (a court that will not build is no mesh). */
  function courtMeshOf(plan) {
    if (courtMeshes.has(plan.key) || !renderer?.createMesh) return courtMeshes.get(plan.key) ?? null;
    let m = null;
    try {
      if (!artUp) {
        for (const [rec, art] of courtArt()) { renderer.uploadTexture?.(COURT_ARCHIVE, rec, art.albedo); renderer.uploadEmissionTexture?.(COURT_ARCHIVE, rec, art.emission, { white: true }); }   // AUDIT GATE-FBX G4: the court's fire its own colour, never the dungeon arm's day tint (AUDIT SD II L2 F3's law)
        for (const [rec, art] of gateArt()) { renderer.uploadTexture?.(GATE_ARCHIVE, rec, art.albedo); renderer.uploadEmissionTexture?.(GATE_ARCHIVE, rec, art.emission, { white: true }); }
        artUp = true;
      }
      m = renderer.createMesh(buildCourtModel(plan.pt));
    } catch (e) { console.warn('[gate] the court would not build', e?.message ?? e); m = null; }
    if (m) courtMeshes.set(plan.key, m);   // a court that would not build is asked again at the next entry, as WB3b's was
    return m;
  }

  /** WB6b: THE DEADLANDS' LAND stood into the court's context, after the court (whose art it is cut from): the islands
   *  among its draws, and each of the floor's shards with a matrix of its own - moved every frame on the sky's clock
   *  (the dungeon arm, before its draws), so the drift is the same on every screen. Made once a session; a land that
   *  will not build costs the court its land, never the court. */
  function standDeadlands(ctx) {
    if (!landMesh && renderer?.createMesh) {
      try {
        const land = buildDeadlandsLand(), shard = buildShardModel();
        landMesh = renderer.createMesh(land);
        shardMesh = renderer.createMesh(shard);
      } catch (e) { console.warn('[gate] the Deadlands\' land would not build', e?.message ?? e); landMesh = null; shardMesh = null; }
    }
    if (landMesh) ctx.dynamicDraws.push({ gpu: landMesh, object: { matrix: identity() } });
    if (shardMesh) for (const s of deadlandsShards()) ctx.dynamicDraws.push({ gpu: shardMesh, object: { matrix: shardMatrix(s, host.deadlandsSeconds?.() ?? 0) }, shard: s });
  }

  /** WB3b: the court stood into a built context, before the start marker is read: its mesh among the context's own
   *  draws, its floor on the collider (the spawn lands on it), and the way home's name - GATE-FBX: on the portal that
   *  rises where he fell, the court's one door (scenes/gate/gateCourt.js lays it into the exit doors; the exit family's ray,
   *  ladder and wagon word take it - no family of its own). WB14b: the night's - `day` the gate's (its plan, planOfDay). */
  function standCourt(ctx, day = null) {
    const plan = planOfDay(day);
    const courtMesh = courtMeshOf(plan);
    if (courtMesh) ctx.dynamicDraws.push({ gpu: courtMesh, object: { matrix: identity() } });
    standDeadlands(ctx);   // WB6b: and the land round it, cut from the same stone
    // WB9b: THE WALKWAYS' SLABS - each a draw of the one slab with a matrix of its own, under the fire until a bound lays
    // its walkway, then rising stone by stone toward the court he leapt to (moved every frame in the dungeon arm, on the
    // relay's clock and the fight's crossings - host.gateFloor). WB14b: the night's walkways.
    if (!slabMesh && renderer?.createMesh) { try { slabMesh = renderer.createMesh(buildWalkSlabModel()); } catch (e) { console.warn('[gate] the walkways would not build', e?.message ?? e); slabMesh = null; } }
    if (slabMesh) { const fl = host.gateFloor?.() ?? null; for (const sl of walkSlabs(plan.pt)) ctx.dynamicDraws.push({ gpu: slabMesh, object: { matrix: slabMatrix(sl, fl?.xa ?? NO_XA, fl?.now ?? 0) }, slab: sl }); }
    const tris = courtFloorTris(plan.pt);
    const n = tris.length / 3;
    const idx = n > 65535 ? new Uint32Array(n) : new Uint16Array(n);
    for (let i = 0; i < n; i++) idx[i] = i;
    ctx.collider.addMesh(COURT_BUCKET, tris, idx, identity());
    // GATE-FBX: and NO door of its own - the bridge's membrane is gone; until he falls the court is left by death or the Wrath
    ctx.addActivationNamer((key) => (typeof key === 'string' && key.startsWith('exit:') ? { title: COURT_TEXT.wayHome } : null));   // before the dungeon exit's own namer, so it answers first
    // WB9f (Mac: "The player should be able to inspect and pick up the ground item, not just walk over it"): HIS SPOILS
    // ON THE FLOOR, PRESSED - each resting piece a target the one ray can win (the outer host's pool - scenes/spoilsPool.js
    // targets), named by its own word, its item listed on the plaque (the context's lootContents asks `spoilContents`)
    // and taken by the press (the dungeon arm's `spoil` rung)
    ctx.addActivationTargets(() => host.spoilTargets?.() ?? NO_TARGETS);
    ctx.addActivationNamer((key) => (typeof key === 'string' && key.startsWith('spoil') ? host.spoilName?.(key) ?? null : null));
  }

  return { standCourt, standDeadlands };
}
