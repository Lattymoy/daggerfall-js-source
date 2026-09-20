// THE BINARY FBX READER, and nothing else.
//
// FIELD-GUN-MW1 (2026-09-20, Mac: "texturing and rigging this for the
// morrowind model"): the Dwarven Thunderlock is THE PORT'S OWN WEAPON
// (systems/thunderlock.js) and Morrowind has no firearm, so the MW
// first-person lane - which resolves every mesh out of the PLAYER'S
// install by search token - can never find a model for it. The model
// has to be ours, and Mac authors in Blender, which exports FBX.
//
// ═══ WHY THIS IS A TOOL AND NOT A FORMAT ══════════════════════════
//
// src/formats/ is the runtime's parsers: they ship in the bundle
// because the bytes they read are on the player's disk and can only be
// read when the game runs. An FBX is not that. It is a SOURCE asset
// that exists once, on Mac's machine, and the game never sees it - so
// a runtime FBX parser would be dead weight in every player's download
// to read a file that is never fetched. It is baked instead, here,
// beside tools/gunPaperdoll.mjs, which does exactly the same thing one
// dimension down: Mac's raw art in scratch/, the port's own asset out
// in public/art/, the source never committed.
//
// ═══ WHAT IS IMPLEMENTED, AND WHAT IS REFUSED ═════════════════════
//
// The binary container only (7000-7999, both the 32-bit and the
// >=7500 64-bit record headers), which is what "Kaydara FBX Binary"
// means. ASCII FBX is a different file entirely and is REFUSED by
// name rather than mis-read - an ASCII export that silently produced
// an empty mesh is the failure this would otherwise ship.
//
// Property types are the full set the specification defines, because a
// reader that skips one cannot find the NEXT property either: the
// records are length-prefixed as a stream, so an unknown type is not a
// value this reader ignores, it is a cursor this reader has lost. An
// unknown type THROWS for that reason.
import { inflateSync } from 'node:zlib';

/** The scalar property types, by their FBX type code: how many bytes,
 *  and which DataView read gets them. */
const SCALAR = {
  Y: [2, (b, o) => b.readInt16LE(o)],
  C: [1, (b, o) => !!b.readUInt8(o)],
  I: [4, (b, o) => b.readInt32LE(o)],
  F: [4, (b, o) => b.readFloatLE(o)],
  D: [8, (b, o) => b.readDoubleLE(o)],
  L: [8, (b, o) => b.readBigInt64LE(o)],
};

/** The array property types: element width and reader. `b` and `c` are
 *  both single bytes - the specification gives 'b' as bool and 'c' as
 *  byte, and neither is signed. */
const ARRAY = {
  f: [4, (b, o) => b.readFloatLE(o)],
  d: [8, (b, o) => b.readDoubleLE(o)],
  l: [8, (b, o) => b.readBigInt64LE(o)],
  i: [4, (b, o) => b.readInt32LE(o)],
  b: [1, (b, o) => !!b.readUInt8(o)],
  c: [1, (b, o) => b.readUInt8(o)],
};

export const FBX_MAGIC = 'Kaydara FBX Binary  ';

/**
 * Read a binary FBX into a tree of `{ name, props, children }`.
 *
 * `props` holds JavaScript values: numbers for scalars, strings for S
 * (and for R, whose raw bytes are handed back as a Buffer), and plain
 * Arrays for the array types. Arrays are DECODED here, deflate and all,
 * because every consumer wants the numbers and none of them wants to
 * know that FBX compresses per-property.
 */
export function readFbx(buf) {
  const magic = buf.toString('latin1', 0, FBX_MAGIC.length);
  if (magic !== FBX_MAGIC) {
    // An ASCII FBX starts with "; FBX <version> project file". Say which
    // one this is rather than "bad magic", because the fix differs: an
    // ASCII export is re-exported, a truncated file is re-copied.
    const ascii = buf.toString('latin1', 0, 64);
    throw new Error(/^;\s*FBX/.test(ascii)
      ? 'this is an ASCII FBX; re-export from Blender with "Binary" format (this reader is the binary container only)'
      : `not an FBX: expected ${JSON.stringify(FBX_MAGIC)}, got ${JSON.stringify(magic)}`);
  }
  const version = buf.readUInt32LE(23);
  // >=7500 widened the three record-header integers from uint32 to
  // uint64 and nothing else. Everything below is the same file.
  const wide = version >= 7500;
  const HEAD = wide ? 25 : 13;
  const u = (o, i) => (wide ? Number(buf.readBigUInt64LE(o + i * 8)) : buf.readUInt32LE(o + i * 4));

  function readNode(off) {
    const end = u(off, 0);
    // The NULL RECORD - thirteen (or twenty-five) zero bytes - is how a
    // child list ends. Its end-offset is 0, which no real record has.
    if (end === 0) return null;
    const nProps = u(off, 1);
    let p = off + HEAD;
    const nameLen = buf.readUInt8(p - 1);
    const name = buf.toString('latin1', p, p + nameLen);
    p += nameLen;

    const props = [];
    for (let i = 0; i < nProps; i++) {
      const t = String.fromCharCode(buf.readUInt8(p));
      p += 1;
      if (SCALAR[t]) {
        const [w, rd] = SCALAR[t];
        props.push(rd(buf, p));
        p += w;
      } else if (t === 'S' || t === 'R') {
        const n = buf.readUInt32LE(p);
        p += 4;
        // S is a string whose EMBEDDED NULs are real: FBX spells a
        // qualified object name "Cylinder.003\0\x01Geometry". Read it
        // whole; a caller that wants the leaf splits on '\0'.
        props.push(t === 'S' ? buf.toString('latin1', p, p + n) : Buffer.from(buf.subarray(p, p + n)));
        p += n;
      } else if (ARRAY[t]) {
        const count = buf.readUInt32LE(p);
        const encoding = buf.readUInt32LE(p + 4);
        const compressedLength = buf.readUInt32LE(p + 8);
        p += 12;
        let raw = buf.subarray(p, p + compressedLength);
        p += compressedLength;
        if (encoding === 1) raw = inflateSync(raw);
        else if (encoding !== 0) throw new Error(`FBX array encoding ${encoding} is not 0 (raw) or 1 (deflate)`);
        const [w, rd] = ARRAY[t];
        if (raw.length < count * w) throw new Error(`FBX array ${t} claims ${count} elements but carries ${raw.length} bytes`);
        const out = new Array(count);
        for (let k = 0; k < count; k++) out[k] = rd(raw, k * w);
        props.push(out);
      } else {
        // Not skippable: the stream has no way past a property whose
        // width this reader does not know.
        throw new Error(`unknown FBX property type ${JSON.stringify(t)} at byte ${p - 1}`);
      }
    }

    const children = [];
    while (p < end) {
      const child = readNode(p);
      if (!child) { p += HEAD; break; }   // the null record closes the list
      children.push(child);
      p = child.__end;
    }
    return { name, props, children, __end: end };
  }

  const nodes = [];
  let p = 27;
  while (p < buf.length) {
    const n = readNode(p);
    if (!n) break;
    nodes.push(n);
    p = n.__end;
  }
  return { version, nodes };
}

/** Every child of `node` (or of a root list) with this name. */
export const childrenNamed = (node, name) =>
  (Array.isArray(node) ? node : node?.children ?? []).filter((c) => c.name === name);

/** The FIRST child with this name, or null. */
export const childNamed = (node, name) => childrenNamed(node, name)[0] ?? null;

/** Walk a path of names: `nodeAt(tree.nodes, 'Objects', 'Geometry')`. */
export function nodeAt(from, ...path) {
  let at = from;
  for (const name of path) {
    at = childNamed(at, name);
    if (!at) return null;
  }
  return at;
}

/** An FBX object name, without the "\0\x01Class" suffix the file
 *  appends to every one of them. */
export const objectName = (s) => String(s ?? '').split('\0')[0];

/** A Properties70 `P` row by name: the row's VALUES, after the four
 *  (name, type, subtype, flags) header strings. */
export function property70(node, name) {
  const p70 = childNamed(node, 'Properties70');
  for (const row of childrenNamed(p70, 'P')) {
    if (row.props[0] === name) return row.props.slice(4);
  }
  return null;
}
