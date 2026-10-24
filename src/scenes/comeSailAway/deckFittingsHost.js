// @ts-check
// DECK-PROPS (2026-10-17; bible/03-World/Naval-Refit.md DECK-PROPS) - A SHIP'S FITTINGS STOOD ON HER DECK: each fitting
// (systems/naval/deckFittings.js) a classic model hung in her own tree as the mod's ModelHelpers hang theirs
// (systems/comeSailAway/comeSailAwayBoat.js createDaggerfallMeshGameObject - a MeshRenderer and a MeshCollider over the
// model) under one node of hers, DECK_FITTINGS_NODE, under her MeshObject - the frame her deck is baked in (systems/
// naval/navalDeck.js) and the one the swell rolls. So each is drawn with her (scenes/comeSailAway/comeSailAwayPool.js
// draw: a part of her tree), stands in her colliders (one walks round a crate, climbs a chest; the world's collider and
// the aboard ray read her tree's), and rocks and sails with her, whoever's she is: mine by the Fleet's ledger, a peer's
// by its owner's word.
//
// A fitting stands on her open deck under its place (the deck's own height there), its model's foot on the deck and its
// middle over the place (the model's box: SetupModelHelper's centring, alignment 1), turned about up. One whose place is
// no deck of hers (her deck baked otherwise since it was set) stands nowhere; one whose model is not loaded yet waits
// for it, and the boat is fitted again once it is - and only then (AUDIT 2026-10-17: her tree was made again every frame
// while one waited, for ever for a model that never loads).
import { PrefabNode } from '../../world/prefabNode.js';
import { quatAngleAxis } from '../../world/quat.js';
import { createDaggerfallMeshGameObject } from '../../systems/comeSailAway/comeSailAwayBoat.js';
import { fittingsKey, yawDegrees } from '../../systems/naval/deckFittings.js';

/** Her fittings' node's name, under her MeshObject. */
export const DECK_FITTINGS_NODE = 'DeckFittings';
const UP = Object.freeze([0, 1, 0]);

/**
 * Her fittings stood in her tree: the node of them made again whole (none, for none). Answers whether every one is
 * stood or stands nowhere for good - false while a model is not loaded (`ctx.modelBounds` has none yet).
 * @param {any} boat @param {{ m: number, x: number, z: number, yaw: number }[]} list
 * @param {{ ctx: any, deck: any }} o - `ctx` the spawn's context (its `modelBounds`), `deck` her hull's deck
 */
export function standFittings(boat, list, { ctx, deck }) {
  const frame = boat?.MeshObject;
  if (!frame) return false;
  const old = frame.children.find((c) => c.name === DECK_FITTINGS_NODE);
  if (old) old.setParent(null);
  if (!list.length) return true;
  const root = new PrefabNode(DECK_FITTINGS_NODE).setParent(frame);
  let all = true;
  for (const f of list) {
    const b = ctx.modelBounds?.(f.m);
    if (!b) { all = false; continue; }
    const y = deck?.heightAt?.(f.x, f.z);
    if (!Number.isFinite(y)) continue;
    const node = new PrefabNode(`Fitting-${f.m}`, { position: [f.x, y, f.z], rotation: quatAngleAxis(yawDegrees(f.yaw), UP) }).setParent(root);
    const mesh = createDaggerfallMeshGameObject(ctx, f.m, node);
    mesh.localPosition = [-(b.min[0] + b.max[0]) / 2, -b.min[1], -(b.min[2] + b.max[2]) / 2];
    mesh.localRotation = [0, 0, 0, 1];
    mesh.localScale = [1, 1, 1];
  }
  return all;
}

/** @type {any[]} */
const NO_FITTINGS = /** @type {any} */ (Object.freeze([]));
/**
 * The fitting-out, a frame: each boat whose fittings are not the ones she stands with is fitted again - their models
 * asked of the pipeline first (`load`, once each), and the boat marked fitted (`_fitted`, the list's key) once every one
 * stood. While a model is not loaded her tree is made again only as one more comes in (`_fitStage`, the key and how many
 * are loaded), never a frame it is the same. `fittingsOf(boat)` her fittings now (null: none) - a list the same as the
 * last frame's is not keyed again.
 * @param {any[]} boats @param {(boat: any) => any[] | null | undefined} fittingsOf
 * @param {{ ctx: any, deckOf: (hull: number) => any, load: (model: number) => void }} o
 */
export function fitBoats(boats, fittingsOf, { ctx, deckOf, load }) {
  for (const boat of boats) {
    const list = fittingsOf(boat) ?? NO_FITTINGS;
    if (!list.length) {
      if (boat._fitted == null || boat._fitted === '') { boat._fitted = ''; continue; }   // none to fit, none stood
    } else if (list === boat._fitList && boat._fitted === boat._fitKey) continue;   // the same list, stood
    const key = list === boat._fitList ? boat._fitKey : fittingsKey(list);
    boat._fitList = list; boat._fitKey = key;
    if (boat._fitted === key) continue;
    let loaded = 0;
    // AUDIT 2: asked for EVERY fitting, loaded or not - the ask is what pins its model (dataPipeline.js pinnedGpuMesh; `load`
    // asks once a model); a crate a house had loaded under its own hold was freed by the place cache four rooms on, and
    // her fitting went from the deck and its collider with it
    for (const f of list) { load(f.m); if (ctx.modelBounds?.(f.m)) loaded++; }
    const stage = `${key}#${loaded}`;
    if (boat._fitStage === stage) continue;   // nothing more loaded since she was last stood
    const deck = list.length ? deckOf(boat.hull) : null;
    if (list.length && !deck) continue;   // her deck not baked yet: the next frame
    boat._fitStage = stage;
    if (standFittings(boat, list, { ctx, deck })) boat._fitted = key;
  }
}
