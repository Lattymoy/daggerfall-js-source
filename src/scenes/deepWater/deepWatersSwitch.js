// @ts-check
// BOOT-COMPILE (2026-10-25): the mod's vendor key and its switch, apart from the host (deepWatersHost.js re-exports
// both). The boot's program start (render/bootPrograms.js) asks the switch before any host loads, and the host's own
// module would bring the whole sea's graph onto that early door.
import { modSetting } from '../../systems/modSettings.js';

export const DEEP_WATERS_VENDOR = 'iliac-puddle-no-more';

/** The mod's switch (the port's Enabled). */
export function deepWatersOn() {
  return modSetting(DEEP_WATERS_VENDOR, 'Enabled') === true;
}
