// MO1 (2026-09-12, Mac: "All mods should be enabled by default"). Every
// vendored mod's `Enabled` defaults TRUE now, and a suite that pins
// Daggerfall Unity's OWN numbers - FormulaHelper's, ItemBuilder's,
// EnemyEntity's - is a suite about the game WITHOUT its mods, which DFU
// gets by not listing them and the port gets here: import this first
// and every mod is off for the process, the way it was before MO1.
// Not a .test.js on purpose - the manifest counts suites, and this is
// a precondition, not one.
import { MOD_SETTINGS, setModSetting, _resetModSettings } from '../src/systems/modSettings.js';

export function modsOff() {
  _resetModSettings();
  for (const [vendor, def] of Object.entries(MOD_SETTINGS)) if (def.keys.Enabled) setModSetting(vendor, 'Enabled', false);   // Basic Roads has no switch: it is the road network itself
}

modsOff();
