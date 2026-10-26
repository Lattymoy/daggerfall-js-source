// ARN1 (2026-10-26, Mac: "let's do arena") - TES: ARENA'S GLOBAL.BSA, the archive every asset of the 1994 game that is
// not loose on its disk lives in. Bethesda's freeware since 2004 (Arena 1.06, `tools/fetch-arena.sh`); like ARENA2 it
// is the player's own data, read at runtime and never carried (Port-Doctrine, Non-negotiables).
//
// NOT Daggerfall's BSA (formats/bsaFile.js): no directory type, a u16 count, the files packed from byte 2, and a footer
// of `count` 18-byte entries at the end of the file - a 12-byte DOS name (NUL-padded), a u16 compression flag and a
// u32 size - each file starting where the one before it ended. OpenTESArena (MIT, components/archives/bsaarchive.cpp
// BsaArchive::load and loadNamed) reads it so and refuses a compressed entry; no entry of 1.06's GLOBAL.BSA is one.

export const TES_ARENA_BSA_ENTRY_SIZE = 18;
const NAME_SIZE = 12;

export class TesArenaBsa {
  /** @param {Uint8Array} bytes the whole GLOBAL.BSA */
  constructor(bytes) {
    if (!(bytes instanceof Uint8Array)) throw new TypeError('TesArenaBsa expects a Uint8Array');
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const count = view.getUint16(0, true);
    const footer = bytes.byteLength - count * TES_ARENA_BSA_ENTRY_SIZE;
    if (footer < 2) throw new Error(`GLOBAL.BSA: ${count} entries do not fit ${bytes.byteLength} bytes`);
    this._bytes = bytes;
    /** @type {Map<string, { offset: number, size: number, compressed: boolean }>} by upper-case name */
    this._entries = new Map();
    let offset = 2;
    for (let i = 0; i < count; i++) {
      const at = footer + i * TES_ARENA_BSA_ENTRY_SIZE;
      let name = '';
      for (let k = 0; k < NAME_SIZE && bytes[at + k]; k++) name += String.fromCharCode(bytes[at + k]);
      const compressed = view.getUint16(at + NAME_SIZE, true) !== 0;
      const size = view.getUint32(at + NAME_SIZE + 2, true);
      if (offset + size > footer) throw new Error(`GLOBAL.BSA: ${name} runs past the footer`);
      this._entries.set(name.replace(/\\/g, '/').toUpperCase(), { offset, size, compressed });
      offset += size;
    }
    if (offset !== footer) throw new Error(`GLOBAL.BSA: the files end at ${offset}, the footer starts at ${footer}`);
  }

  get count() { return this._entries.size; }
  /** Every name, upper-case, in the footer's order. */
  get names() { return [...this._entries.keys()]; }
  has(name) { return this._entries.has(String(name).toUpperCase()); }

  /** The file's bytes (a view into the archive), or null for a name it does not hold. */
  get(name) {
    const e = this._entries.get(String(name).toUpperCase());
    if (!e) return null;
    if (e.compressed) throw new Error(`GLOBAL.BSA: ${name} is compressed, which no reader of Arena's handles`);
    return this._bytes.subarray(e.offset, e.offset + e.size);
  }
}
