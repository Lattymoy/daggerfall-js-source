// DaggerfallCityGate (Internal/DaggerfallCityGate.cs), verbatim - the
// component RMBLayout hangs on every standalone 446/447 placement
// (RMBLayout.cs:959-963). It is the WHOLE behaviour: a repo-wide sweep
// of the reference finds no other runtime caller of SetOpen/Toggle, so
// Update() is the law.
//
//   bool isOpen = true;                                       (:19)
//   void Update() {                                           (:44-51)
//     bool isNight = DaggerfallUnity.Instance.WorldTime.Now.IsNight;
//     if (isNight && isOpen || !isNight && !isOpen) Toggle();
//   }
//
// Two things about that state machine are easy to get wrong and are
// deliberately reproduced here:
//
//   - The INITIAL drawn model is the one the BLOCK DATA placed, not one
//     derived from the clock. `isOpen` is born true, so the first frame
//     of a DAY does nothing at all: a block that laid the CLOSED model
//     (447) at noon keeps 447 standing until the first 18:00 -> 06:00
//     cycle opens it. Only NIGHT acts on frame one (isNight && isOpen ->
//     Toggle -> 447). Mapping `!isNight => 446` directly would open that
//     gate a whole day early.
//   - The toggle must be evaluated on the FIRST frame too, not only on a
//     night/day transition, or a location built at 20:00 never closes.
//
// SetOpen (:21-38) swaps the model through
// GameObjectHelper.ChangeDaggerfallMeshGameObject (:217-253), which
// re-points the mesh filter, the material array AND the MeshCollider
// (:246-250) - a closed gate BLOCKS - and then re-runs
// mesh.ApplyCurrentClimate(). The hosts supply that swap; this leaf owns
// the state.
import { CITY_GATE_OPEN_MODEL_ID, CITY_GATE_CLOSED_MODEL_ID } from './rmbLayout.js';

/**
 * A freshly stood gate: `isOpen` true (DaggerfallCityGate.cs:19) and the
 * model the block placed.
 * @param {number} placedModelId - 446 or 447, as the block laid it.
 */
export function makeCityGate(placedModelId) {
  return { isOpen: true, modelId: placedModelId };
}

/**
 * One Update() tick (DaggerfallCityGate.cs:44-51). Returns true when the
 * gate toggled, having already moved `isOpen`/`modelId`; the caller does
 * the mesh + collider swap that SetOpen delegates to
 * ChangeDaggerfallMeshGameObject.
 * @param {{isOpen:boolean,modelId:number}} gate
 * @param {boolean} night - WorldTime.Now.IsNight
 *   (DaggerfallDateTime.cs:171-174: Hour < DawnHour || Hour >= DuskHour).
 */
export function updateCityGate(gate, night) {
  if (!((night && gate.isOpen) || (!night && !gate.isOpen))) return false;
  gate.isOpen = !gate.isOpen;
  gate.modelId = gate.isOpen ? CITY_GATE_OPEN_MODEL_ID : CITY_GATE_CLOSED_MODEL_ID;
  return true;
}
