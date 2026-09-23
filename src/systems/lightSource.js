// DISC7 (2026-09-23, Mac: "fix the known gaps" - DISC6's "a torch stowed from inside an open inventory keeps its
// sound until the window closes"): THE LIGHT IN HAND HAS ONE DOOR, AND IT SAYS WHEN IT CHANGES.
//
// PlayerEntity.LightSource is a single slot, and six places wrote it bare: the Use arm (light, douse, swap), the
// transfer that takes a lit torch out of the pack, the burn-out, the load, and Handheld Torches' own hand law. The
// mod's burning loop is started and stopped in its component's update - and a host holds its weapon rig's frame
// while a window is up, so a torch doused from the inventory went on crackling until the window closed and the rig
// ticked again. The loop answered the rig's clock instead of the torch. Every writer goes through
// `setLightSource` now, and a listener (the component's) hears the change the moment it is made.
//
// Listeners are called after the slot is written, only on a real change, each contained: a throwing listener is
// said once and never stops the write or the others.

const listeners = new Set();
let _faultSaid = false;

/** Write the entity's light in hand; tell every listener when it changed. */
export function setLightSource(entity, item) {
  if (!entity) return;
  const was = entity.lightSource ?? null;
  const now = item ?? null;
  entity.lightSource = now;
  if (was === now) return;
  for (const f of [...listeners]) {
    try { f(entity, now, was); } catch (e) {
      if (!_faultSaid) { _faultSaid = true; console.warn(`[light-source] a listener threw and was skipped: ${e?.message ?? e}`); }
    }
  }
}

/** Hear every change of any entity's light in hand. Returns the unsubscribe. */
export function addLightSourceListener(f) {
  listeners.add(f);
  return () => { listeners.delete(f); };
}

/** For tests: how many are listening. */
export const lightSourceListenerCount = () => listeners.size;
