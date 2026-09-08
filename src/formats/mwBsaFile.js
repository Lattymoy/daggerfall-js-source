// Morrowind BSA container reader (version 0x100) - NOT the Daggerfall BSA
// (see bsaFile.js for that, entirely different format). Original
// implementation written against the documented layout; OpenMW's
// components/bsa/bsafile.cpp used as behavioral reference only (GPL - no
// code ported). Runtime reads immutable byte buffers only, same doctrine
// as the ARENA2 readers.
//
// Format:
//   Header (12 bytes): uint32 magic 0x100, uint32 dirSize, uint32 fileCount.
//     Little-endian throughout.
//   Directory block (dirSize bytes total):
//     fileCount x { uint32 size, uint32 offset }   - offset into data buffer
//     fileCount x uint32 nameOffset                - into the name buffer
//     name buffer (dirSize - 12*fileCount bytes)   - null-terminated strings
//   Hash table: fileCount x uint64 - ignored (names are authoritative).
//   Data buffer: rest of the archive; record offsets are relative to its start.
//
// Paths inside the archive use backslashes and mixed case
// ("meshes\\b\\B_N_Argonian_F_Skins.NIF"); lookups here normalize to
// lowercase forward-slash so callers never worry about it.

/** Normalize an archive path for lookup: lowercase, backslash to slash. */
export function normalizeBsaPath(path) {
  return String(path).toLowerCase().replace(/\\/g, '/');
}

// MW-LOAD (2026-09-08, Mac: "improve the load time when Morrowind
// assets are enabled"): THE ARCHIVE IS OPENED, NOT READ. A retail set is
// three archives of 150-300 MB and the store handed each one back as a
// whole ArrayBuffer - a structured clone of every byte, one to three
// seconds per archive measured, before a single mesh was asked for -
// and kept them resident for the session. The first-person arm needs a
// few dozen entries. So an archive opens off a Blob: the header and the
// directory come in by RANGE (a few megabytes, ~5 ms measured on a
// settled store), and an entry's bytes come in by range when it is
// LOADED (~1 ms each). `get` stays synchronous - it answers from what
// has been loaded, which is the contract every reader already speaks -
// and `load` is the one async door in front of it. The whole-buffer
// constructor stands for the fixtures and any caller that has bytes.
export class MwBsaFile {
  /**
   * @param {Uint8Array} bytes - full BSA file contents.
   */
  constructor(bytes) {
    if (!(bytes instanceof Uint8Array)) {
      throw new TypeError('MwBsaFile expects a Uint8Array');
    }
    this._bytes = bytes;
    this._blob = null;
    this._loaded = new Map();
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    if (bytes.byteLength < 12) throw new Error('MwBsaFile: too small to be a BSA');
    const { dirSize, fileCount } = MwBsaFile._header(view);
    // Each file needs a 12-byte directory footprint plus an 8-byte hash entry.
    if (12 + dirSize + 8 * fileCount > bytes.byteLength || dirSize < 12 * fileCount) {
      throw new Error('MwBsaFile: directory larger than archive');
    }
    this._readDirectory(bytes, view, dirSize, fileCount);
  }

  static _header(view) {
    const magic = view.getUint32(0, true);
    if (magic !== 0x100) {
      throw new Error(`MwBsaFile: bad magic 0x${magic.toString(16)} (want 0x100)`);
    }
    return { dirSize: view.getUint32(4, true), fileCount: view.getUint32(8, true) };
  }

  /**
   * MW-LOAD: open an archive off a Blob - the header and the directory
   * by range, the data buffer left where it is. `size` is the blob's.
   * @param {Blob} blob
   * @returns {Promise<MwBsaFile>}
   */
  static async open(blob) {
    if (!blob || typeof blob.slice !== 'function' || typeof blob.size !== 'number') {
      throw new TypeError('MwBsaFile.open expects a Blob');
    }
    if (blob.size < 12) throw new Error('MwBsaFile: too small to be a BSA');
    const head = new DataView(await blob.slice(0, 12).arrayBuffer());
    const { dirSize, fileCount } = MwBsaFile._header(head);
    if (12 + dirSize + 8 * fileCount > blob.size || dirSize < 12 * fileCount) {
      throw new Error('MwBsaFile: directory larger than archive');
    }
    // the directory block and the hash table, as one range
    const dirBytes = new Uint8Array(await blob.slice(0, 12 + dirSize + 8 * fileCount).arrayBuffer());
    const a = Object.create(MwBsaFile.prototype);
    a._bytes = null;
    a._blob = blob;
    a._loaded = new Map();
    a._readDirectory(dirBytes, new DataView(dirBytes.buffer, dirBytes.byteOffset, dirBytes.byteLength), dirSize, fileCount);
    return a;
  }

  _readDirectory(bytes, view, dirSize, fileCount) {

    const nameTableStart = 12 + 8 * fileCount + 4 * fileCount;
    const nameBufSize = dirSize - 12 * fileCount;
    this._dataStart = 12 + dirSize + 8 * fileCount;

    /** @type {Map<string, {size:number, offset:number, name:string}>} */
    this._entries = new Map();
    /** @type {string[]} */
    this._names = [];
    for (let i = 0; i < fileCount; i++) {
      const size = view.getUint32(12 + i * 8, true);
      const offset = view.getUint32(12 + i * 8 + 4, true);
      const nameOff = view.getUint32(12 + 8 * fileCount + i * 4, true);
      if (nameOff >= nameBufSize) throw new Error(`MwBsaFile: name offset out of range (file ${i})`);
      let end = nameTableStart + nameOff;
      const hardEnd = nameTableStart + nameBufSize;
      while (end < hardEnd && bytes[end] !== 0) end++;
      const raw = String.fromCharCode(...bytes.subarray(nameTableStart + nameOff, end));
      const name = normalizeBsaPath(raw);
      this._names.push(name);
      this._entries.set(name, { size, offset, name });
    }
  }

  /** @returns {number} */
  get fileCount() {
    return this._names.length;
  }

  /** All archive paths, normalized, in directory order. @returns {string[]} */
  list() {
    return this._names.slice();
  }

  /** @param {string} path @returns {boolean} */
  has(path) {
    return this._entries.has(normalizeBsaPath(path));
  }

  /** MW-LOAD: is this a lazily opened archive (a Blob behind it)? */
  get lazy() {
    return this._blob !== null;
  }

  /** MW-LOAD: are the entry's bytes in hand - always, off a whole buffer;
   *  off a Blob, once `load` has brought them in. */
  loaded(path) {
    if (this._bytes) return this._entries.has(normalizeBsaPath(path));
    return this._loaded.has(normalizeBsaPath(path));
  }

  /**
   * File bytes as a zero-copy subarray of the archive buffer, or the
   * loaded copy off a Blob. Synchronous: a lazily opened archive answers
   * only what `load` has brought in, and says so.
   * @param {string} path - archive path, any case / slash style.
   * @returns {Uint8Array}
   */
  get(path) {
    const key = normalizeBsaPath(path);
    const entry = this._entries.get(key);
    if (!entry) throw new Error(`MwBsaFile: no such file: ${path}`);
    if (!this._bytes) {
      const hit = this._loaded.get(key);
      if (!hit) throw new Error(`MwBsaFile: ${path} is not loaded - await load(path) first (MW-LOAD)`);
      return hit;
    }
    const start = this._dataStart + entry.offset;
    if (start + entry.size > this._bytes.byteLength) {
      throw new Error(`MwBsaFile: entry overruns archive: ${path}`);
    }
    return this._bytes.subarray(start, start + entry.size);
  }

  /**
   * MW-LOAD: the entry's bytes, by range off the Blob (cached, so a
   * second load is the first's answer), or `get`'s answer off a whole
   * buffer. The one async door.
   * @param {string} path
   * @returns {Promise<Uint8Array>}
   */
  async load(path) {
    const key = normalizeBsaPath(path);
    const entry = this._entries.get(key);
    if (!entry) throw new Error(`MwBsaFile: no such file: ${path}`);
    if (this._bytes) return this.get(path);
    const hit = this._loaded.get(key);
    if (hit) return hit;
    const start = this._dataStart + entry.offset;
    if (start + entry.size > this._blob.size) {
      throw new Error(`MwBsaFile: entry overruns archive: ${path}`);
    }
    const bytes = new Uint8Array(await this._blob.slice(start, start + entry.size).arrayBuffer());
    this._loaded.set(key, bytes);
    return bytes;
  }

  /** MW-LOAD: load every path in `paths` that this archive carries. */
  async loadAll(paths) {
    for (const p of paths) if (this.has(p)) await this.load(p);
  }

  /** MW-LOAD: drop the loaded entries (a rebuild that no longer needs them). */
  release() {
    this._loaded.clear();
  }
}
