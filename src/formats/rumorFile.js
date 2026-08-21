// RUMOR.DAT reader (TK-i). 1:1 translation of DaggerfallConnect's
// RumorFile.cs (MIT, Daggerfall Workshop) - the classic save's rumor
// records, which TalkManager.ImportClassicRumor seeds the mill from
// on a new game. The file is GAME DATA (it ships in a classic save's
// ARENA2 sibling set), so the reader is fixture-pinned and the mill
// idles headless without it - the standing charter.
//
// The record layout (ReadRumors, :137-160), little-endian throughout:
//   u16 faction1, u16 faction2, u32 type, u8 regionID, u8 flags,
//   u8 questID, 9-byte CString questName (the cursor advances the
//   FULL 9 whatever the NUL position), u16 unknown, u32 npcID,
//   u32 textLength, u32 timeLimit, then textLength bytes of rumor
//   text in the classic TEXT.RSC token encoding (readTokens'
//   charter).

const latin1 = (bytes, start, end) => {
  let s = '';
  for (let i = start; i < end; i++) s += String.fromCharCode(bytes[i]);
  return s;
};

/** RumorFile.RumorTypes (:44-56). */
export const CLASSIC_RUMOR_TYPES = Object.freeze({
  Plague: 4, Famine: 7, WitchBurnings: 10, CrimeWave: 11, NewRuler: 12,
  PersecutedTemple: 18, AllianceSignMessage: 26, EnemySignMessage: 27,
  WarSignMessage: 28, FactionRumor: 100,
});

export class RumorFile {
  constructor() {
    this.rumors = [];
  }

  /** Load from raw bytes (ArrayBuffer or Uint8Array). Steps records
   *  until the stream ends, exactly as ReadRumors' while loop. */
  load(buffer) {
    const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
    const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    this.rumors = [];
    let pos = 0;
    while (pos < bytes.length) {
      const faction1 = v.getUint16(pos, true); pos += 2;
      const faction2 = v.getUint16(pos, true); pos += 2;
      const type = v.getUint32(pos, true); pos += 4;
      const regionID = bytes[pos]; pos += 1;
      const flags = bytes[pos]; pos += 1;
      const questID = bytes[pos]; pos += 1;
      // ReadCString(position, 9): read to the NUL (or the 9-byte cap);
      // the reader's cursor advances the full 9 regardless.
      let nul = pos;
      while (nul < pos + 9 && bytes[nul] !== 0) nul++;
      const questName = latin1(bytes, pos, nul);
      pos += 9;
      const unknown = v.getUint16(pos, true); pos += 2;
      const npcID = v.getUint32(pos, true); pos += 4;
      const textLength = v.getUint32(pos, true); pos += 4;
      const timeLimit = v.getUint32(pos, true); pos += 4;
      const rumorText = bytes.slice(pos, pos + textLength); pos += textLength;
      this.rumors.push({ faction1, faction2, type, regionID, flags, questID, questName, unknown, npcID, textLength, timeLimit, rumorText });
    }
    return this;
  }
}
