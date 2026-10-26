// @ts-check
// A SAVE SET ASIDE ON THIS DEVICE HAS A WAY BACK (bible/06-Systems/Realm-Arc.md, STRANDED).
//
// A join sets the device's copy of a realm character aside when a put of it failed and the realm has since moved past
// it (realmSaves.js `dagger.realm.stranded.<id>`). The realm never plays it over the record: a trade or an act since may
// have moved goods, and the copy is the device's word alone. Until now nothing read it again, so the progress it held
// was kept and unreachable. Copy to offline is the one way back that moves nothing in the realm: the copy becomes a new
// offline character, exactly as Copy to offline makes one from the realm's own save (ui/enhanced/enhancedMenu.js
// copyToOffline) - a new id, the world's stamps rebased onto the character's clock, and marked as a copy, so it never
// comes back online.

import { readStranded, forgetStranded, unpackUnsent, REALM_STRANDED_PREFIX } from '../realmSaves.js';
import { offlineCopyOf } from '../offlineCopy.js';
import { mintCharacterId } from '../characterId.js';
import { REALM_COPY_SAVE_NAME } from '../realmCopyMark.js';
import { saveSlot } from '../save/saveSlots.js';

/**
 * Writes the save set aside for realm character `id` as a new offline character, then drops the set-aside copy. The
 * copy is dropped before the slot is written, so the slot has the room it held, and written back if the slot does not
 * fit.
 * @param {{ storage: any, id: string, name: string }} at `name` the realm character's, for a save that names none
 * @returns {Promise<{ ok: true } | { ok: false, error: 'no-data' | 'no-room' }>}
 */
export async function copyStrandedToOffline({ storage, id, name }) {
  const copy = readStranded(storage, id);
  if (!copy) return { ok: false, error: 'no-data' };
  const text = copy.packed ? await unpackUnsent(copy.packed) : copy.text;
  let snap = null;
  try { snap = JSON.parse(text ?? 'null'); } catch { snap = null; }
  if (!snap || typeof snap !== 'object') return { ok: false, error: 'no-data' };
  const offline = offlineCopyOf(snap);
  offline.characterId = mintCharacterId();
  const strandedText = storage.getItem(strandedTextKey(id));
  const strandedRecord = storage.getItem(strandedRecordKey(id));
  forgetStranded(storage, id);
  const written = saveSlot(offline.name || name, REALM_COPY_SAVE_NAME, offline, { storage });
  if (written.ok) return { ok: true };
  try {
    storage.setItem(strandedTextKey(id), strandedText);
    storage.setItem(strandedRecordKey(id), strandedRecord);
  } catch { /* no room to put it back either: the device had none left */ }
  return { ok: false, error: 'no-room' };
}

/** Whether this device holds a save set aside for realm character `id`. */
export const hasStranded = (/** @type {any} */ storage, /** @type {string} */ id) => {
  try { return storage?.getItem?.(strandedRecordKey(id)) != null; } catch { return false; }
};

/** realmSaves.js's own keys for a set-aside copy: its text, and its record beside it. */
const strandedTextKey = (/** @type {string} */ id) => `${REALM_STRANDED_PREFIX}${id}`;
const strandedRecordKey = (/** @type {string} */ id) => `${REALM_STRANDED_PREFIX}${id}.at`;
