// FileProxy.ReadCString (DaggerfallConnect's FileProxy.cs:380-391, MIT,
// Daggerfall Workshop) - the classic records' one C-string law, in ONE
// home (AUDIT 68 S11-cstring-dup, 2026-09-24): SAVETREE.DAT and its
// character and magic records, SAVEVARS.DAT's faction names and
// RUMOR.DAT's quest names each carried a copy. A leaf, so a small reader
// takes it without the save tree's imports.

/** FileProxy.ReadCString with a non-zero readLength: the FULL length is
 *  consumed and only TRAILING NULs trim - an embedded NUL and whatever
 *  follows it stay in the string (the AUDIT 24 formats law rumorFile.js
 *  records). Classic bytes decode as latin1, the readers' charter. */
export function readCStringFixed(bytes, start, length) {
  let s = '';
  for (let i = start; i < start + length; i++) s += String.fromCharCode(bytes[i]);
  return s.replace(/\0+$/, '');
}

/** FileProxy.ReadCString with readLength 0: scan to the first NUL and
 *  read exactly that many bytes (the NUL itself is NOT consumed). */
export function readCStringScan(bytes, start) {
  let end = start;
  while (end < bytes.length && bytes[end] !== 0) end++;
  let s = '';
  for (let i = start; i < end; i++) s += String.fromCharCode(bytes[i]);
  return s;
}
