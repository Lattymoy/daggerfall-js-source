// @ts-check
// ═══════════════════════════════════════════════════════════════════
// SP1 (2026-09-21, a player on Discord: "my saves its all gone", and
// Mac: "we need parity between browser and the install"): SAVES MOVE
// BETWEEN THE WEBSITE AND THE APP.
//
// The website keeps a save in the browser's storage for its origin;
// the desktop app keeps the same save as files under
// <userData>/Saves/SAVE<n>/ (app/lib/fileStorage.cjs). They are two
// stores with one shape, and nothing carried a save from one to the
// other - a player who installed the app after playing on the site
// opened it and found every slot empty, and read that as loss. Nothing
// was lost. Nothing in either store deletes a save but the player's own
// Delete. They were in the other place.
//
// This module is the carrier. EXPORT writes every slot the store holds
// as ONE zip in the app's own on-disk layout - Saves/SAVE<n>/
// SaveData.txt, SaveInfo.txt, Screenshot.jpg - so the zip is also a
// backup a player can open, and can be unzipped straight into the
// app's Saves folder by hand. IMPORT takes that layout back (a zip, or
// a picked folder) and writes each slot into whatever store is under
// it: the browser's storage on the site, the file store in the app. A
// slot never overwrites another: it takes its own number when that
// number is free, the first free one when it is not, and a slot the
// store already holds (same character, same slot name, same game
// minute) is skipped rather than doubled.
//
// The zip is written here, STORED (method 0) - a save is a few hundred
// kilobytes of JSON and a 320x200 JPEG, and a dependency for a
// compressor nobody needs is not worth its weight. The reader is the
// port's own (scenes/dataSource.js readZipEntries), which takes methods
// 0 and 8, so a zip a player re-packed with compression still imports.
//
// Everything here is pure over a storage-shaped object and a list of
// {name, data} entries, so the pins drive a round trip in node.

import { SAVE_DATA_PREFIX, SAVE_INFO_PREFIX, SAVE_SHOT_PREFIX, firstFreeKey } from './saveSlots.js';

/** the app's on-disk spellings (app/lib/fileStorage.cjs, pinned equal) */
export const TRANSFER_DIR = 'Saves';
export const TRANSFER_DATA_FILE = 'SaveData.txt';
export const TRANSFER_INFO_FILE = 'SaveInfo.txt';
export const TRANSFER_SHOT_FILES = Object.freeze([
  ['Screenshot.jpg', 'image/jpeg'],
  ['Screenshot.png', 'image/png'],
  ['Screenshot.dataurl', null],
]);
/** the download's name */
export const TRANSFER_ZIP_NAME = 'DaggerfallEnhanced-Saves.zip';

// ── the slots a store holds ──────────────────────────────────────

/** Every slot with a parseable card: [{ key, data, info, shot }], data and
 *  info the stored strings, shot the stored data URL or null. */
export function slotsOf(storage) {
  const out = [];
  if (!storage) return out;
  for (let i = 0; i < storage.length; i++) {
    const k = storage.key(i);
    if (!k?.startsWith(SAVE_INFO_PREFIX)) continue;
    const tail = k.slice(SAVE_INFO_PREFIX.length);
    const key = Number(tail);
    if (!Number.isInteger(key) || key < 0 || String(key) !== tail) continue;
    const info = storage.getItem(k), data = storage.getItem(SAVE_DATA_PREFIX + key);
    if (!info || !data) continue;
    try { JSON.parse(info); } catch { continue; }
    out.push({ key, data, info, shot: storage.getItem(SAVE_SHOT_PREFIX + key) ?? null });
  }
  out.sort((a, b) => a.key - b.key);
  return out;
}

// ── bytes ────────────────────────────────────────────────────────

const enc = new TextEncoder(), dec = new TextDecoder();
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/** base64 -> bytes, with no atob (the app's preload has none and node's is not the browser's) */
export function base64ToBytes(s) {
  const clean = s.replace(/[^A-Za-z0-9+/]/g, '');
  const out = new Uint8Array(Math.floor(clean.length * 3 / 4));
  let o = 0, buf = 0, bits = 0;
  for (let i = 0; i < clean.length; i++) {
    buf = (buf << 6) | B64.indexOf(clean[i]); bits += 6;
    if (bits >= 8) { bits -= 8; out[o++] = (buf >> bits) & 255; }
  }
  return out.subarray(0, o);
}
/** bytes -> base64 */
export function bytesToBase64(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i], b = bytes[i + 1], c = bytes[i + 2];
    const n = (a << 16) | ((b ?? 0) << 8) | (c ?? 0);
    s += B64[(n >> 18) & 63] + B64[(n >> 12) & 63] + (b === undefined ? '=' : B64[(n >> 6) & 63]) + (c === undefined ? '=' : B64[n & 63]);
  }
  return s;
}

/** A stored screenshot to its on-disk file: a decodable jpeg/png data
 *  URL becomes the image's own bytes under its own spelling; anything
 *  else is kept VERBATIM as text under the .dataurl spelling - the app's
 *  store makes the same choice (fileStorage.cjs setItem), because bytes
 *  under a name that lies about them are worse than a plain text file. */
export function shotToFile(shot) {
  if (!shot) return null;
  const m = /^data:(image\/(?:jpeg|png));base64,([A-Za-z0-9+/=\s]+)$/.exec(shot);
  if (m) {
    const spelling = TRANSFER_SHOT_FILES.find(([, mime]) => mime === m[1]);
    if (spelling) return { name: spelling[0], data: base64ToBytes(m[2]) };
  }
  return { name: 'Screenshot.dataurl', data: enc.encode(shot) };
}
/** ...and back: a file under one of the three spellings to the stored data URL */
export function fileToShot(name, data) {
  const spelling = TRANSFER_SHOT_FILES.find(([n]) => n === name);
  if (!spelling) return null;
  if (!spelling[1]) return dec.decode(data);
  return `data:${spelling[1]};base64,${bytesToBase64(data)}`;
}

// ── the zip, STORED ──────────────────────────────────────────────

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
  return t;
})();
export function crc32(bytes) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 255] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

/** entries [{ name, data: Uint8Array }] -> one zip, method 0, no zip64 */
export function zipStore(entries) {
  const locals = [], centrals = [];
  let offset = 0;
  const u16 = (v) => [v & 255, (v >> 8) & 255];
  const u32 = (v) => [v & 255, (v >> 8) & 255, (v >> 16) & 255, (v >>> 24) & 255];
  for (const { name, data } of entries) {
    const nameB = enc.encode(name), crc = crc32(data);
    const local = new Uint8Array([...u32(0x04034b50), ...u16(20), ...u16(0x0800), ...u16(0), ...u16(0), ...u16(0), ...u32(crc), ...u32(data.length), ...u32(data.length), ...u16(nameB.length), ...u16(0), ...nameB]);
    locals.push(local, data);
    centrals.push(new Uint8Array([...u32(0x02014b50), ...u16(20), ...u16(20), ...u16(0x0800), ...u16(0), ...u16(0), ...u16(0), ...u32(crc), ...u32(data.length), ...u32(data.length), ...u16(nameB.length), ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u32(0), ...u32(offset), ...nameB]));
    offset += local.length + data.length;
  }
  const centralSize = centrals.reduce((a, c) => a + c.length, 0);
  const eocd = new Uint8Array([...u32(0x06054b50), ...u16(0), ...u16(0), ...u16(entries.length), ...u16(entries.length), ...u32(centralSize), ...u32(offset), ...u16(0)]);
  const total = offset + centralSize + eocd.length;
  const out = new Uint8Array(total);
  let p = 0;
  for (const part of [...locals, ...centrals, eocd]) { out.set(part, p); p += part.length; }
  return out;
}

/** The store's slots as the app's layout: [{ name: 'Saves/SAVE3/SaveData.txt', data }] */
export function exportEntries(storage) {
  const entries = [];
  for (const s of slotsOf(storage)) {
    const dir = `${TRANSFER_DIR}/SAVE${s.key}/`;
    entries.push({ name: dir + TRANSFER_DATA_FILE, data: enc.encode(s.data) });
    entries.push({ name: dir + TRANSFER_INFO_FILE, data: enc.encode(s.info) });
    const shot = shotToFile(s.shot);
    if (shot) entries.push({ name: dir + shot.name, data: shot.data });
  }
  return entries;
}
/** ...and as one zip's bytes. Null when the store holds nothing. */
export function exportSavesZip(storage) {
  const entries = exportEntries(storage);
  return entries.length ? zipStore(entries) : null;
}

// ── import ───────────────────────────────────────────────────────

/** 'Saves/SAVE3/SaveData.txt', 'SAVE3/SaveInfo.txt', 'x/y/SAVE12/Screenshot.jpg' -> { n, file } or null */
export function slotPathOf(name) {
  const m = /(?:^|\/)SAVE(\d+)\/([^/]+)$/.exec(name);
  if (!m || String(Number(m[1])) !== m[1]) return null;
  return { n: Number(m[1]), file: m[2] };
}

/** entries [{ name, data: Uint8Array|ArrayBuffer }] -> the slots they carry,
 *  [{ n, data, info, shot }] with data/info as strings and shot a data URL
 *  or null; a slot without both its data and a parseable card is not a slot. */
export function collectSlots(entries) {
  const byN = new Map();
  for (const e of entries) {
    const at = slotPathOf(e.name);
    if (!at) continue;
    const bytes = e.data instanceof Uint8Array ? e.data : new Uint8Array(e.data);
    const slot = byN.get(at.n) ?? { n: at.n, data: null, info: null, shot: null, shotSpelling: -1 };
    if (at.file === TRANSFER_DATA_FILE) slot.data = dec.decode(bytes);
    else if (at.file === TRANSFER_INFO_FILE) slot.info = dec.decode(bytes);
    else {
      const idx = TRANSFER_SHOT_FILES.findIndex(([n]) => n === at.file);
      // the first spelling wins when a crash left two (the app reads the newest; a zip has no mtimes to read)
      if (idx >= 0 && (slot.shotSpelling < 0 || idx < slot.shotSpelling)) { slot.shot = fileToShot(at.file, bytes); slot.shotSpelling = idx; }
    }
    byN.set(at.n, slot);
  }
  const out = [];
  for (const s of [...byN.values()].sort((a, b) => a.n - b.n)) {
    if (!s.data || !s.info) continue;
    try { JSON.parse(s.info); JSON.parse(s.data); } catch { continue; }
    out.push({ n: s.n, data: s.data, info: s.info, shot: s.shot });
  }
  return out;
}

/** the identity a store already holds: same character, same slot name, same game minute */
const sameSave = (a, b) => (a?.characterName ?? '') === (b?.characterName ?? '') && (a?.saveName ?? '') === (b?.saveName ?? '')
  && (a?.dateAndTime?.gameTime ?? -1) === (b?.dateAndTime?.gameTime ?? -1);

/**
 * Write the collected slots into a store. A slot keeps its own number
 * when that number is free, takes the first free one otherwise, and is
 * skipped when the store already holds the same save. The card is
 * written LAST, as saveSlots.saveSlot writes it - a slot is real when
 * its card is - and a write that throws (quota) leaves nothing half
 * done: the data and the shot of a slot whose card never landed are
 * removed.
 * @returns {{ imported: number[], skipped: number, failed: number }}
 */
export function importSlots(slots, storage) {
  const result = { imported: [], skipped: 0, failed: 0 };
  if (!storage) return result;
  const held = slotsOf(storage).map((s) => { try { return JSON.parse(s.info); } catch { return null; } });
  for (const s of slots) {
    let info;
    try { info = JSON.parse(s.info); } catch { result.failed++; continue; }
    if (held.some((h) => sameSave(h, info))) { result.skipped++; continue; }
    const taken = storage.getItem(SAVE_DATA_PREFIX + s.n) != null || storage.getItem(SAVE_INFO_PREFIX + s.n) != null;
    const key = taken ? firstFreeKey(storage) : s.n;
    try {
      storage.setItem(SAVE_DATA_PREFIX + key, s.data);
      if (s.shot) storage.setItem(SAVE_SHOT_PREFIX + key, s.shot);
      storage.setItem(SAVE_INFO_PREFIX + key, s.info);
      held.push(info);
      result.imported.push(key);
    } catch {
      try { storage.removeItem(SAVE_DATA_PREFIX + key); storage.removeItem(SAVE_SHOT_PREFIX + key); } catch { /* storage gone */ }
      result.failed++;
    }
  }
  return result;
}

/** A picked FOLDER's files (input webkitdirectory, or a drop walk) to entries -
 *  only the three save files under a SAVE<n> segment are read, so a whole
 *  userData folder or a whole browser download folder can be picked. */
export async function entriesFromFiles(files) {
  const out = [];
  for (const f of files) {
    const name = f.webkitRelativePath || f.name;
    if (!slotPathOf(name)) continue;
    out.push({ name, data: new Uint8Array(await f.arrayBuffer()) });
  }
  return out;
}
