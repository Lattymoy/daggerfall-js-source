// THE BINARY FBX WRITER - the container tools/fbxRead.mjs reads, written the other way.
//
// FIELD-GUN-MW1 wrote it inside test/tooling/fbxmesh.test.js, "forty lines of the same container tools/fbxRead.mjs reads, so the
// pin drives the reader against bytes this file's own reader wrote: if the two ever disagree about the format, one of
// them is wrong and the suite says so". EG6c (2026-10-12, bible/11-Multiplayer/Elite-Gates.md section 11.6) needs it
// outside a test: the reference hero fragment (tools/egRefFragScene.mjs) is a scene the port writes itself, committed as
// an .fbx so tools/fragBake.mjs bakes it exactly as it bakes one of Mac's. ONE EXPORT: the writer moved here whole and the
// test imports it, so the fixture and the reference are written by one writer. (The MW-FOLK1 audit's pins of
// tools/fbxStrip.mjs's cut needed it too and moved FIELD-GUN-MW1's copy to test/fixtures/fbxWrite.mjs on main; the merge
// of main into EG kept this one home and gave it that copy's `blender` footer.)
//
// A node is `{ name, props, children }`; a prop is `{ t, v }` in the reader's type codes - S a string (FBX's embedded
// NULs kept: "Name\0\x01Model"), D a double, I an int32, L an int64, and the arrays d (doubles) and i (int32s), each
// written RAW (encoding 0): no deflate, so the bytes are a function of the numbers alone on every machine and every zlib.
// The version is 7400 by default: the 32-bit record headers (>=7500 widens them, and nothing written here needs it).

import { FBX_MAGIC } from './fbxRead.mjs';
import { FOOT_ID, FOOT_MAGIC } from './fbxStrip.mjs';

/** The property constructors, by the reader's type codes. */
export const S = (v) => ({ t: 'S', v });
export const D = (v) => ({ t: 'D', v });
export const I = (v) => ({ t: 'I', v });
export const L = (v) => ({ t: 'L', v });
export const dArr = (v) => ({ t: 'd', v });
export const iArr = (v) => ({ t: 'i', v });

/** One property's bytes: its type code, then its value (a string's length first; an array's count, encoding and byte
 *  length first). */
export function encodeProp(p) {
  const head = Buffer.from(p.t, 'latin1');
  if (p.t === 'S') {
    const s = Buffer.from(p.v, 'latin1');
    const n = Buffer.alloc(4); n.writeUInt32LE(s.length);
    return Buffer.concat([head, n, s]);
  }
  if (p.t === 'D') { const b = Buffer.alloc(8); b.writeDoubleLE(p.v); return Buffer.concat([head, b]); }
  if (p.t === 'I') { const b = Buffer.alloc(4); b.writeInt32LE(p.v); return Buffer.concat([head, b]); }
  if (p.t === 'L') { const b = Buffer.alloc(8); b.writeBigInt64LE(BigInt(p.v)); return Buffer.concat([head, b]); }
  if (p.t !== 'd' && p.t !== 'i') throw new Error(`fbxWrite: no writer for property type ${JSON.stringify(p.t)}`);
  const wide = p.t === 'd';
  const body = Buffer.alloc(p.v.length * (wide ? 8 : 4));
  p.v.forEach((x, i) => (wide ? body.writeDoubleLE(x, i * 8) : body.writeInt32LE(x, i * 4)));
  const meta = Buffer.alloc(12);
  meta.writeUInt32LE(p.v.length, 0); meta.writeUInt32LE(0, 4); meta.writeUInt32LE(body.length, 8);   // encoding 0 = raw
  return Buffer.concat([head, meta, body]);
}

/** One node at a known absolute start offset; endOffset is absolute,
 *  which is why this cannot be built bottom-up without one. */
export function encodeNode(node, start) {
  const name = Buffer.from(node.name, 'latin1');
  const props = (node.props ?? []).map(encodeProp);
  const propBytes = Buffer.concat(props);
  const headLen = 13 + name.length;
  let at = start + headLen + propBytes.length;
  const kids = [];
  for (const c of node.children ?? []) { const b = encodeNode(c, at); kids.push(b); at += b.length; }
  if (kids.length) at += 13;   // the null record that closes a child list
  const head = Buffer.alloc(headLen);
  head.writeUInt32LE(at, 0);
  head.writeUInt32LE(props.length, 4);
  head.writeUInt32LE(propBytes.length, 8);
  head.writeUInt8(name.length, 12);
  name.copy(head, 13);
  return Buffer.concat([head, propBytes, ...kids, ...(kids.length ? [Buffer.alloc(13)] : [])]);
}

/** A whole file: the magic, the version, every root node, the closing null record. `blender` closes it with the footer
 *  Blender's encoder writes (encode_bin.py: its id, four zeros, zeros to the next 16 - a whole 16 when already there - the
 *  version, 120 zeros, the closing magic), the one footer the strip re-pads; without it the file ends at the null record,
 *  as every file this writer wrote before. */
export function writeFbx(roots, version = 7400, { blender = false } = {}) {
  const header = Buffer.alloc(27);
  header.write(FBX_MAGIC, 0, 'latin1');
  header.writeUInt8(0x1a, 20); header.writeUInt8(0x00, 21);
  header.writeUInt32LE(version, 23);
  const out = [header];
  let at = header.length;
  for (const r of roots) { const b = encodeNode(r, at); out.push(b); at += b.length; }
  out.push(Buffer.alloc(13));
  at += 13;
  if (blender) {
    out.push(FOOT_ID, Buffer.alloc(4));
    at += 20;
    let pad = ((at + 15) & ~15) - at;
    if (pad === 0) pad = 16;
    const v = Buffer.alloc(4); v.writeUInt32LE(version, 0);
    out.push(Buffer.alloc(pad), v, Buffer.alloc(120), FOOT_MAGIC);
  }
  return Buffer.concat(out);
}
