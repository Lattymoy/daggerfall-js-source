// @ts-check
// The Daggerfall Unity import DOOR (DFUSAVE3, 2026-09-20): a picked DFU
// `Saves` folder (or zip) becomes port SLOTS, one per SAVE<n>, and the
// ordinary Load window loads them. That is the one place a DFU save
// crosses over - DFU itself reads its saves in place (SaveLoadManager
// .LoadGame) and the port's slot store (systems/saveSlots.js) IS DFU's
// Saves/SAVE<n> layout on the desktop (DA2), so a converted save
// written as a slot is the port's own save from then on: listed by the
// Load window with the character's name, the save's name, the clock
// and the screenshot DFU took.
//
// The conversion is `dfuSaveToSnapshot` (systems/dfuSaveImport.js);
// this file is only the loop over the picked slots, the slot write and
// the report the picker shows - what came over, and what did not.
// The reader and the converter are pure; so is this, given a storage.

import { readDfuSave, loadDfuSaveFiles } from '../formats/dfuSave.js';
import { dfuSaveToSnapshot } from './dfuSaveImport.js';
import { saveSlot } from './saveSlots.js';

/**
 * Bytes -> a data URL, the slot store's screenshot form
 * (capturePendingScreenshot writes `canvas.toDataURL('image/jpeg')`;
 * the Load window decodes whatever URL it finds). Chunked, because
 * `String.fromCharCode(...bytes)` overflows the call stack on a 300KB
 * JPEG; Buffer where there is no btoa (a headless run).
 * @param {Uint8Array} bytes
 * @param {string} mime
 */
export function bytesToDataUrl(bytes, mime = 'image/jpeg') {
  let b64;
  const g = /** @type {any} */ (globalThis);
  if (typeof g.btoa === 'function') {
    let bin = '';
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, /** @type {any} */ (bytes.subarray(i, i + 0x8000)));
    b64 = g.btoa(bin);
  } else {
    b64 = g.Buffer.from(bytes).toString('base64');
  }
  return `data:${mime};base64,${b64}`;
}

/**
 * @typedef {object} DfuImportResult
 * @property {number} index  the SAVE<n> the files came from
 * @property {boolean} ok
 * @property {number} key  the port slot written (-1 when not)
 * @property {string} characterName
 * @property {string} saveName
 * @property {string[]} warnings  the converter's, in the player's words
 * @property {string|null} error  why the slot was not written
 */

/**
 * Import every collected DFU slot into the port's slot store. `saves`
 * is `collectDfuSaveFiles`'s shape (index -> UPPERCASE name -> file-like
 * with arrayBuffer()), or, when `loaded` is true, already the
 * text/bytes map `readDfuSave` takes. A slot that fails to read or
 * convert is reported and skipped; the rest still import (TryOpenSave's
 * log-and-continue, the classic list's own law).
 * @param {Record<number, Record<string, any>>} saves
 * @param {{ storage?: any, now?: number, loaded?: boolean }} [opts]
 * @returns {Promise<DfuImportResult[]>}
 */
export async function importDfuSaves(saves, { storage = undefined, now = Date.now(), loaded = false } = {}) {
  const results = [];
  for (const index of Object.keys(saves).map(Number).sort((a, b) => a - b)) {
    const result = { index, ok: false, key: -1, characterName: '', saveName: '', warnings: [], error: null };
    results.push(result);
    try {
      const files = loaded ? saves[index] : await loadDfuSaveFiles(saves[index]);
      const save = readDfuSave(index, files);
      const out = dfuSaveToSnapshot(save);
      result.characterName = out.characterName;
      result.saveName = out.saveName || `SAVE${index}`;
      result.warnings = out.warnings;
      const shot = out.screenshot ? bytesToDataUrl(out.screenshot) : null;
      const w = saveSlot(result.characterName, result.saveName, out.snap, { screenshot: shot, storage, now });
      if (!w.ok) { result.error = 'the slot could not be written'; continue; }
      result.key = w.key;
      result.ok = true;
    } catch (e) {
      result.error = e?.message ?? String(e);
    }
  }
  return results;
}

/** One line for the picker: what came over. */
export function importSummary(results) {
  const ok = results.filter((r) => r.ok);
  const bad = results.filter((r) => !r.ok);
  const parts = [];
  if (ok.length) parts.push(`imported ${ok.length} Daggerfall Unity save${ok.length === 1 ? '' : 's'}: ${ok.map((r) => `${r.characterName} - ${r.saveName}`).join('; ')}`);
  if (bad.length) parts.push(`${bad.length} could not be read: ${bad.map((r) => `SAVE${r.index} (${r.error})`).join('; ')}`);
  const warned = ok.filter((r) => r.warnings.length);
  if (warned.length) parts.push(`not carried: ${[...new Set(warned.flatMap((r) => r.warnings))].join('; ')}`);
  return parts.join('. ');
}
