// @ts-check
// CAPE-TOGGLE (2026-10-29, the owner: "add a cape/helmet toggle option in the inventory for people", then "Worn cloaks
// plus any aura", seen by everyone, the helmet later): WHETHER THIS PLAYER'S CAPES ARE DRAWN - a worn cloak (the
// Cloak1 and Cloak2 slots). Hidden, my body is drawn without it on my screen and on everyone's: the look leaves the
// cloak out and says `hc` (net/wire.js validLook). What is worn is unchanged. AURA-STAYS (2026-10-30, as the owner asked): the aura is no longer hidden with it - the
// switch takes the cloak off so the aura shows (scenes/auraHost.js).
// bible/04-Characters/Cape-Toggle.md. Not a DFU member: Daggerfall Unity has no such switch.
import { getPref, setPref } from './uiPrefs.js';
import { equipTableOf } from './equip.js';
import { EQUIP_SLOTS } from '../characters/paperdoll/paperdoll.js';

/** The pref the inventory's switch keeps, this device's: true draws the capes. */
export const CAPE_PREF = 'capeShown';
export const capeShown = () => getPref(CAPE_PREF) !== false;
export const setCapeShown = (/** @type {boolean} */ on) => setPref(CAPE_PREF, on !== false);
/** The slots a cloak is worn in. */
export const CAPE_SLOTS = Object.freeze([EQUIP_SLOTS.Cloak1, EQUIP_SLOTS.Cloak2]);

/** The equip table AS THE BODY IS DRAWN: the player's own with its cloak slots empty while capes are hidden, anyone
 *  else's as it is. Every drawer of a player's body reads this, never the table itself (the sprite's outfit, the
 *  Morrowind body's worn set, the look). A copy only when a cloak is taken out. */
export function drawnEquipTable(/** @type {any} */ entity, shown = capeShown()) {
  const table = equipTableOf(entity);
  if (shown || entity?.isPlayer !== true || !Array.isArray(table) || !CAPE_SLOTS.some((s) => table[s])) return table;
  const out = table.slice();
  for (const s of CAPE_SLOTS) out[s] = null;
  return out;
}

/** Whether a look says its player hides their capes (`hc`, validLook's). Pure. */
export const lookCapesHidden = (/** @type {any} */ look) => look?.hc === 1;
