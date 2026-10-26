// ARN1 (2026-10-26) - TES: ARENA'S PAL.COL. The same 776-byte shape as Daggerfall's .COL files, which DFPalette
// already reads (an 8-byte header, then 256 RGB triples); Arena's header is the file's length, 776, and the version
// 0xB123, both u32 - OpenTESArena (MIT, OpenTESArena/src/Assets/COLFile.cpp COLFile::init) refuses a palette that
// says otherwise, and so does this.

import { DFPalette } from '../dfPalette.js';

export const TES_ARENA_COL_LENGTH = 776;
export const TES_ARENA_COL_VERSION = 0xb123;

/** The palette, or a throw naming what is wrong with the file. */
export function loadTesArenaPalette(bytes, fileName = 'PAL.COL') {
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes.byteLength !== TES_ARENA_COL_LENGTH || v.getUint32(0, true) !== TES_ARENA_COL_LENGTH) throw new Error(`${fileName}: not a 776-byte palette`);
  if (v.getUint32(4, true) !== TES_ARENA_COL_VERSION) throw new Error(`${fileName}: version 0x${v.getUint32(4, true).toString(16)}, not 0xb123`);
  const p = new DFPalette();
  p.load(bytes, fileName);
  return p;
}
