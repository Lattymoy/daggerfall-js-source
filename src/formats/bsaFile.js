// BSA container reader.
// 1:1 translation of Daggerfall Unity's BsaFile.cs (MIT, Daggerfall Workshop /
// Gavin Clayton). Logic and constants kept verbatim; Unity disk plumbing
// (FileProxy, RewriteRecord write-back, path extension checks) dropped because
// our runtime reads immutable byte buffers only. See bible/01-Overview/Port-Doctrine.md.
//
// Format:
//   Header (4 bytes): int16 directoryCount, uint16 directoryType. Little-endian.
//   Records: packed sequentially starting at offset 4.
//   Directory: at end of file.
//     NameRecord   (0x0100): 18 bytes/entry = 14-byte null-terminated name + int32 size.
//     NumberRecord (0x0200): 8 bytes/entry = uint32 id + int32 size.

export const DIRECTORY_TYPES = Object.freeze({
  NameRecord: 0x0100,
  NumberRecord: 0x0200,
});

const NAME_ENTRY_SIZE = 18;
const NAME_FIELD_SIZE = 14;
const NUMBER_ENTRY_SIZE = 8;

export class BsaFile {
  /**
   * @param {Uint8Array} bytes - full BSA file contents.
   */
  constructor(bytes) {
    if (!(bytes instanceof Uint8Array)) {
      throw new TypeError('BsaFile expects a Uint8Array');
    }
    this._bytes = bytes;
    this._view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

    // ReadHeader
    this._directoryCount = this._view.getInt16(0, true);
    this._directoryType = this._view.getUint16(2, true);
    this._firstRecordPosition = 4;

    // ReadDirectory
    this._directory = [];
    if (this._directoryType === DIRECTORY_TYPES.NameRecord) {
      let recordPosition = this._firstRecordPosition;
      let pos = bytes.byteLength - NAME_ENTRY_SIZE * this._directoryCount;
      this._directoryStart = pos;
      for (let i = 0; i < this._directoryCount; i++) {
        // DFU reads a null-terminated CString from the 14-byte name field.
        // Bounded at 14 here; identical for all valid data.
        const name = this._readCString(pos, NAME_FIELD_SIZE);
        const size = this._view.getInt32(pos + NAME_FIELD_SIZE, true);
        this._directory.push({ name, id: null, size, position: recordPosition });
        recordPosition += size;
        pos += NAME_ENTRY_SIZE;
      }
    } else if (this._directoryType === DIRECTORY_TYPES.NumberRecord) {
      let recordPosition = this._firstRecordPosition;
      let pos = bytes.byteLength - NUMBER_ENTRY_SIZE * this._directoryCount;
      this._directoryStart = pos;
      for (let i = 0; i < this._directoryCount; i++) {
        const id = this._view.getUint32(pos, true);
        const size = this._view.getInt32(pos + 4, true);
        this._directory.push({ name: String(id), id, size, position: recordPosition });
        recordPosition += size;
        pos += NUMBER_ENTRY_SIZE;
      }
    } else {
      throw new Error('BSA file has an invalid DirectoryType.');
    }
  }

  /** Number of records in the loaded BSA file. */
  get count() {
    return this._directoryCount;
  }

  /** Directory type of this BSA file (see DIRECTORY_TYPES). */
  get directoryType() {
    return this._directoryType;
  }

  /** Byte offset where the trailing directory begins. Used by validation tests. */
  get directoryStart() {
    return this._directoryStart;
  }

  /**
   * Finds index of a named record. NameRecord directories only.
   * @returns {number} index, or -1 if not found.
   */
  getRecordIndex(name) {
    if (this._directoryType !== DIRECTORY_TYPES.NameRecord) return -1;
    for (let i = 0; i < this._directoryCount; i++) {
      if (this._directory[i].name === name) return i;
    }
    return -1;
  }

  /** Length of a record in bytes, or 0 if index invalid. */
  getRecordLength(record) {
    if (record < 0 || record >= this._directoryCount) return 0;
    return this._directory[record].size;
  }

  /** Name of a record. For NumberRecord directories this is the id as a string. */
  getRecordName(record) {
    if (record < 0 || record >= this._directoryCount) return '';
    return this._directory[record].name;
  }

  /** ID of a number record. NumberRecord directories only, else 0. */
  getRecordId(record) {
    if (
      record < 0 ||
      record >= this._directoryCount ||
      this._directoryType !== DIRECTORY_TYPES.NumberRecord
    ) {
      return 0;
    }
    return this._directory[record].id;
  }

  /** Byte offset of record data within the file, or -1 if index invalid. */
  getRecordPosition(record) {
    if (record < 0 || record >= this._directoryCount) return -1;
    return this._directory[record].position;
  }

  /**
   * Record data as a fresh Uint8Array copy (matches DFU ReadBytes semantics),
   * or null if index invalid.
   */
  getRecordBytes(record) {
    if (record < 0 || record >= this._directoryCount) return null;
    const { position, size } = this._directory[record];
    return this._bytes.slice(position, position + size);
  }

  _readCString(offset, maxLength) {
    let end = offset;
    const limit = offset + maxLength;
    while (end < limit && this._bytes[end] !== 0) end++;
    let s = '';
    for (let i = offset; i < end; i++) s += String.fromCharCode(this._bytes[i]);
    return s;
  }
}
