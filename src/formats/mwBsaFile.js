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

export class MwBsaFile {
  /**
   * @param {Uint8Array} bytes - full BSA file contents.
   */
  constructor(bytes) {
    if (!(bytes instanceof Uint8Array)) {
      throw new TypeError('MwBsaFile expects a Uint8Array');
    }
    this._bytes = bytes;
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    if (bytes.byteLength < 12) throw new Error('MwBsaFile: too small to be a BSA');

    const magic = view.getUint32(0, true);
    if (magic !== 0x100) {
      throw new Error(`MwBsaFile: bad magic 0x${magic.toString(16)} (want 0x100)`);
    }
    const dirSize = view.getUint32(4, true);
    const fileCount = view.getUint32(8, true);
    // Each file needs a 12-byte directory footprint plus an 8-byte hash entry.
    if (12 + dirSize + 8 * fileCount > bytes.byteLength || dirSize < 12 * fileCount) {
      throw new Error('MwBsaFile: directory larger than archive');
    }

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

  /**
   * File bytes as a zero-copy subarray of the archive buffer.
   * @param {string} path - archive path, any case / slash style.
   * @returns {Uint8Array}
   */
  get(path) {
    const entry = this._entries.get(normalizeBsaPath(path));
    if (!entry) throw new Error(`MwBsaFile: no such file: ${path}`);
    const start = this._dataStart + entry.offset;
    if (start + entry.size > this._bytes.byteLength) {
      throw new Error(`MwBsaFile: entry overruns archive: ${path}`);
    }
    return this._bytes.subarray(start, start + entry.size);
  }
}
