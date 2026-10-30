// CSA-A (2026-09-27): THE STRING LITERALS OF A .NET ASSEMBLY - its #US heap.
//
// Every string a C# method names in its code (`settings.GetBool("Waves",
// "Enable")`, a HUD line, a node's name) is an `ldstr` of one entry in the
// metadata's user-string heap (ECMA-335 II.24.2.4). So a key a mod ships in
// its modsettings.json and never names in that heap is a key no method of
// the assembly can read - which is how Come Sail Away's page proves its
// three unread keys (bible/03-World/Come-Sail-Away.md) off the shipped DLL
// rather than off a decompiler's word.
//
// The walk: the PE header to the CLI header (data directory 14), the
// CLI header to the metadata root, the root's stream table to `#US`, then
// the heap's blobs - a compressed length (II.23.2), that many bytes of
// UTF-16LE and one final byte, the last of which is the terminal flag.

const u16 = (b, o) => b[o] | (b[o + 1] << 8);
const u32 = (b, o) => (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0;

/** The file offset of an RVA, through the section table. */
function rvaToOffset(sections, rva) {
  for (const s of sections) if (rva >= s.va && rva < s.va + Math.max(s.vsize, s.rawSize)) return rva - s.va + s.raw;
  throw new Error(`RVA 0x${rva.toString(16)} is in no section`);
}

/** The PE's sections and CLI header offset. @param {Uint8Array} b */
function peLayout(b) {
  if (b[0] !== 0x4d || b[1] !== 0x5a) throw new Error('not a PE file (no MZ)');
  const pe = u32(b, 0x3c);
  if (u32(b, pe) !== 0x4550) throw new Error('not a PE file (no PE signature)');
  const coff = pe + 4;
  const nSections = u16(b, coff + 2);
  const optSize = u16(b, coff + 16);
  const opt = coff + 20;
  const magic = u16(b, opt);
  const dirs = opt + (magic === 0x20b ? 112 : 96); // PE32+ carries a wider optional header
  const cliRva = u32(b, dirs + 14 * 8);
  const sections = [];
  for (let i = 0, s = opt + optSize; i < nSections; i++, s += 40) {
    sections.push({ vsize: u32(b, s + 8), va: u32(b, s + 12), rawSize: u32(b, s + 16), raw: u32(b, s + 20) });
  }
  if (!cliRva) throw new Error('not a .NET assembly (no CLI header)');
  return { sections, cli: rvaToOffset(sections, cliRva) };
}

/** The metadata streams, by name: { offset, size } in file bytes. */
export function metadataStreams(bytes) {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const { sections, cli } = peLayout(b);
  const root = rvaToOffset(sections, u32(b, cli + 8));
  if (u32(b, root) !== 0x424a5342) throw new Error('no metadata root (BSJB)');
  const verLen = u32(b, root + 12);
  let o = root + 16 + verLen;
  const count = u16(b, o + 2);
  o += 4;
  const out = new Map();
  for (let i = 0; i < count; i++) {
    const offset = u32(b, o),
      size = u32(b, o + 4);
    let e = o + 8;
    while (b[e] !== 0) e++;
    const name = String.fromCharCode(...b.subarray(o + 8, e));
    out.set(name, { offset: root + offset, size });
    o = (e + 4) & ~3; // the name, its NUL, padded to four
  }
  return out;
}

/** Every string literal in the assembly's #US heap, in heap order. */
export function userStrings(bytes) {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const us = metadataStreams(b).get('#US');
  if (!us) return [];
  const out = [];
  let o = us.offset + 1; // entry 0 is the empty blob
  const end = us.offset + us.size;
  while (o < end) {
    const c = b[o];
    let len, head;
    if ((c & 0x80) === 0) {
      len = c;
      head = 1;
    } else if ((c & 0xc0) === 0x80) {
      len = ((c & 0x3f) << 8) | b[o + 1];
      head = 2;
    } else {
      len = ((c & 0x1f) << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3];
      head = 4;
    }
    if (len === 0) {
      o += head;
      continue;
    } // the heap's zero padding
    const chars = [];
    for (let i = 0; i + 1 < len; i += 2) chars.push(u16(b, o + head + i));
    out.push(String.fromCharCode(...chars));
    o += head + len;
  }
  return out;
}
