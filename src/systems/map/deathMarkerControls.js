// One current world's owner, shared across independently bundled mod/UI payloads.
// Retains no account/save data. A disposed/older world cannot clear a newer owner.
const key = /* @__PURE__ */ Symbol.for("keta.deathMarkerControls.v1");
const state = globalThis[key] ?? (globalThis[key] = { owner: null });
function registerDeathMarkerControls(owner) {
  state.owner = owner;
  return () => {
    if (state.owner === owner) state.owner = null;
  };
}
const deathMarkerControls = {
  list: () => state.owner?.history() ?? [],
  remove: (id) => state.owner?.remove(id) ?? false,
  clear: () => state.owner?.clear() ?? false,
  local: () => state.owner?.localPoints() ?? [],
  world: () => state.owner?.worldPoints() ?? [],
  absolute: () => state.owner?.absolutePoints() ?? [],
  circles: () => state.owner?.mapCircles() ?? []
};
export {
  deathMarkerControls,
  registerDeathMarkerControls
};
