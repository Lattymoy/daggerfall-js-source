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
import { saveSlot, SCREENSHOT_W, SCREENSHOT_H } from './saveSlots.js';

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

/** .NET DateTime ticks (100ns since 0001-01-01, what SaveInfo_v1
 *  .dateAndTime.realTime is - SaveLoadManager.cs:901) -> Date.now()
 *  milliseconds, the slot card's own unit. The ticks arrive as a
 *  decimal string past 2^53; the divide loses under a millisecond. */
const TICKS_AT_UNIX_EPOCH_MS = 62135596800000;
export function ticksToUnixMs(ticks) {
  const n = Number(ticks);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n / 1e4 - TICKS_AT_UNIX_EPOCH_MS;
}

/**
 * The slot store's own picture size (SCREENSHOT_W x SCREENSHOT_H,
 * saveSlots.js's quota law): a DFU Screenshot.jpg is the whole screen
 * (SaveLoadManager.cs:1150-1151, EncodeToJPG of Screen.width x
 * Screen.height - a quarter to half a megabyte), and a browser's
 * localStorage holds about ten of those. Where a canvas exists the
 * bytes are decoded and drawn down to the slot size; where none does
 * (a headless run, an old browser) the bytes ride whole and the slot
 * store's own refusal, if it comes, drops only the picture.
 * @param {Uint8Array} bytes
 * @returns {Promise<string>} a data URL
 */
export async function screenshotDataUrl(bytes) {
  const g = /** @type {any} */ (globalThis);
  if (typeof g.createImageBitmap === 'function' && typeof g.OffscreenCanvas === 'function' && typeof g.Blob === 'function') {
    try {
      const bmp = await g.createImageBitmap(new g.Blob([bytes], { type: 'image/jpeg' }));
      const c = new g.OffscreenCanvas(SCREENSHOT_W, SCREENSHOT_H);
      c.getContext('2d').drawImage(bmp, 0, 0, SCREENSHOT_W, SCREENSHOT_H);
      const blob = await c.convertToBlob({ type: 'image/jpeg', quality: 0.7 });
      return bytesToDataUrl(new Uint8Array(await blob.arrayBuffer()));
    } catch (e) {
      console.warn('[dfuSaveDoor] screenshot downscale failed, the full picture rides:', e?.message ?? e);
    }
  }
  return bytesToDataUrl(bytes);
}

/**
 * @typedef {object} DfuImportResult
 * @property {number} index  the SAVE<n> the files came from
 * @property {string} folder  the folder the files came from (two SAVE0 folders are two saves)
 * @property {boolean} ok
 * @property {number} key  the port slot written (-1 when not)
 * @property {string} characterName
 * @property {string} saveName
 * @property {string[]} warnings  the converter's, in the player's words
 * @property {string|null} error  why the slot was not written
 */

/**
 * Import every collected DFU folder into the port's slot store. `saves`
 * is `collectDfuSaveFiles`'s shape (an array of `{ index, folder,
 * files }`, the files being file-likes with arrayBuffer()), or, when
 * `loaded` is true, the same array with `files` already the text/bytes
 * map `readDfuSave` takes. A folder that fails to read or convert is
 * reported and skipped; the rest still import (TryOpenSave's
 * log-and-continue, the classic list's own law). The slot card's
 * `realTime` is the save's own (SaveInfo_v1.dateAndTime.realTime), so
 * the Load window orders and dates them as DFU did (AUDIT-DFUSAVE R4);
 * `now` stands in only for a save without one.
 * @param {Array<{index:number, folder?:string, files:Record<string, any>}>} saves
 * @param {{ storage?: any, now?: number, loaded?: boolean }} [opts]
 * @returns {Promise<DfuImportResult[]>}
 */
export async function importDfuSaves(saves, { storage = undefined, now = Date.now(), loaded = false } = {}) {
  const results = [];
  for (const entry of saves) {
    const index = entry.index;
    const result = { index, folder: entry.folder ?? `SAVE${index}`, ok: false, key: -1, characterName: '', saveName: '', warnings: [], error: null };
    results.push(result);
    try {
      const files = loaded ? entry.files : await loadDfuSaveFiles(entry.files);
      const save = readDfuSave(index, files);
      const out = dfuSaveToSnapshot(save);
      result.characterName = out.characterName;
      result.saveName = out.saveName || `SAVE${index}`;
      result.warnings = out.warnings;
      const shot = out.screenshot ? await screenshotDataUrl(out.screenshot) : null;
      const stamp = ticksToUnixMs(save.info?.dateAndTime?.realTime) ?? now;
      const w = saveSlot(result.characterName, result.saveName, out.snap, { screenshot: shot, storage, now: stamp });
      if (!w.ok) { result.error = `the slot could not be written${w.error ? ` (${w.error})` : ''}`; continue; }
      if (w.screenshotDropped) result.warnings.push('the screenshot did not fit in the browser\'s storage; the save stands without it');
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
  if (bad.length) parts.push(`${bad.length} could not be read: ${bad.map((r) => `${r.folder ?? `SAVE${r.index}`} (${r.error})`).join('; ')}`);
  const warned = ok.filter((r) => r.warnings.length);
  if (warned.length) parts.push(`not carried: ${[...new Set(warned.flatMap((r) => r.warnings))].join('; ')}`);
  return parts.join('. ');
}
