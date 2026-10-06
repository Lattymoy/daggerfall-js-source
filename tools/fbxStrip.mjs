// AN FBX, LESS SOME OF ITS OBJECTS - every record that stays copied byte for byte.
//
//     node tools/fbxStrip.mjs <in.fbx> <out.fbx> --drop=<Model>[,<Model>...]
//
// MW-STEEL1 (2026-10-06, Mac: "These 2 files are for the armor replacement of the morrowind steel armor"). Mac's
// steel-plate scenes carry, beside the armour, the body it was fitted on: two objects of a Breton man out of a
// "Morrowind_TPose_Models" pack - his head (`Breton_Male.003`) and his neck (`Breton_Male.006`), textured with
// Morrowind's own tx_b_n_breton_m_* pictures. They are Bethesda's meshes. The port never ships Morrowind data (it reads
// the player's own archives), and a public repository publishes every file it commits, so the source committed for
// the bake is Mac's export with those objects taken out - and nothing else changed.
//
// ═══ WHY BYTES AND NOT THE READER'S TREE ═══════════════════════════
//
// tools/fbxRead.mjs decodes every property into a JavaScript value, and a value has lost the type code it was written
// with: an int16, an int32 and a double all come back as a Number. A file re-written from that tree would be a
// different file wearing the same numbers. So the records are walked again here at the byte level, and a record that
// stays is copied exactly as it was written - its name, its property bytes (compressed arrays still compressed) and
// its children. The reader's tree, walked in the same order, is used only to READ: which objects are which, what
// connects them, how many there are.
//
// What is rewritten, and nothing else:
//   - every record's END OFFSET, which is an absolute file position, so every record after a removal moves;
//   - the Connections that name a removed object;
//   - the Definitions counts (each ObjectType's Count and the section's total), which count the objects;
//   - the footer's alignment padding, which depends on where the footer now starts (Blender's encode_bin.py rule:
//     pad to 16, a whole 16 when already aligned).
//
// A removed object takes with it what hangs ONLY from it - its geometry, its node attribute, a material no kept
// object wears, that material's textures, their videos. An object parented under a removed one is refused by name
// rather than orphaned.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { readFbx, childrenNamed, nodeAt, objectName } from './fbxRead.mjs';
import { isMain } from './lib/isMain.mjs';

/** The sixteen bytes Blender's encoder writes first in the footer (encode_bin.py _FOOT_ID). */
const FOOT_ID = Buffer.from('fabcab09d0c8d466b176fb831cf7267e', 'hex');
/** ...and the sixteen it ends the file with. */
const FOOT_MAGIC = Buffer.from('f85a8c6adef5d97eece90ce3758f290b', 'hex');

/** The byte-level record tree: each record's name, its property bytes as written, its children, and whether its
 *  child list closed with a null record. */
function rawRecords(buf) {
  const version = buf.readUInt32LE(23);
  const wide = version >= 7500;
  const HEAD = wide ? 25 : 13;
  const u = (o, i) => (wide ? Number(buf.readBigUInt64LE(o + i * 8)) : buf.readUInt32LE(o + i * 4));
  const isNull = (o) => { for (let k = 0; k < HEAD; k++) if (buf[o + k] !== 0) return false; return true; };
  function record(off) {
    const end = u(off, 0);
    const numProps = u(off, 1);
    const propLen = u(off, 2);
    const nameLen = buf.readUInt8(off + HEAD - 1);
    const name = buf.toString('latin1', off + HEAD, off + HEAD + nameLen);
    const pStart = off + HEAD + nameLen;
    const props = buf.subarray(pStart, pStart + propLen);
    const children = [];
    let p = pStart + propLen;
    let sentinel = false;
    while (p < end) {
      if (isNull(p)) { sentinel = true; p += HEAD; break; }
      const child = record(p);
      children.push(child);
      p = child.end;
    }
    if (p !== end) throw new Error(`record "${name}" at byte ${off} ends at ${end} but its contents end at ${p}`);
    return { name, numProps, props, children, sentinel, end };
  }
  const top = [];
  let p = 27;
  for (;;) {
    if (isNull(p)) { p += HEAD; break; }
    const r = record(p);
    top.push(r);
    p = r.end;
  }
  return { version, wide, HEAD, top, footerAt: p };
}

/** Pair the byte-level tree with the reader's decoded one, record for record - the two walks must agree on every
 *  name, or the file is not one this tool understands. */
function pair(raw, decoded, path = '') {
  if (raw.length !== decoded.length) throw new Error(`${path || 'the file'}: ${raw.length} records read raw, ${decoded.length} decoded`);
  raw.forEach((r, i) => {
    const d = decoded[i];
    if (r.name !== d.name) throw new Error(`${path}/${i}: raw "${r.name}" against decoded "${d.name}"`);
    r.decoded = d;
    pair(r.children, d.children, `${path}/${r.name}`);
  });
}

/** An object's id as one key, whatever width the reader handed it back in. */
const idKey = (v) => String(v);

/**
 * Strip the named Models (by their Blender object name) out of an FBX, with what hangs only from them.
 * Returns `{ bytes, dropped: [{ kind, name, id }] }`. Throws on a name that is not a Model of the file, on an object
 * parented under a removed one, and on a footer this tool does not recognise.
 */
export function stripFbx(bytes, { drop = [] } = {}) {
  const buf = Buffer.from(bytes);
  const tree = readFbx(buf);
  const raw = rawRecords(buf);
  pair(raw.top, tree.nodes);

  const objectsRaw = raw.top.find((r) => r.name === 'Objects');
  const connRaw = raw.top.find((r) => r.name === 'Connections');
  if (!objectsRaw || !connRaw) throw new Error('this FBX has no Objects or no Connections section');
  const byId = new Map(objectsRaw.children.map((r) => [idKey(r.decoded.props[0]), r]));
  const links = connRaw.children.filter((r) => r.name === 'C').map((r) => ({ r, child: idKey(r.decoded.props[1]), parent: idKey(r.decoded.props[2]) }));

  const gone = new Set();
  for (const name of drop) {
    const model = objectsRaw.children.find((r) => r.name === 'Model' && objectName(r.decoded.props[1]) === name);
    if (!model) throw new Error(`no Model named "${name}" in this FBX`);
    gone.add(idKey(model.decoded.props[0]));
  }
  // A model under a removed one would be orphaned: refused, not guessed at.
  for (const l of links) {
    const child = byId.get(l.child);
    if (gone.has(l.parent) && child?.name === 'Model' && !gone.has(l.child)) {
      throw new Error(`${objectName(child.decoded.props[1])} is parented under a removed object - remove it too, or keep its parent`);
    }
  }
  // What hangs ONLY from removed objects goes with them, to a fixed point (model -> geometry/material -> texture ->
  // video). An object with a parent that stays, stays.
  for (let grew = true; grew;) {
    grew = false;
    for (const [id, r] of byId) {
      if (gone.has(id) || r.name === 'Model') continue;
      const parents = links.filter((l) => l.child === id).map((l) => l.parent);
      if (parents.length && parents.every((p) => gone.has(p))) { gone.add(id); grew = true; }
    }
  }
  const dropped = objectsRaw.children.filter((r) => gone.has(idKey(r.decoded.props[0])))
    .map((r) => ({ kind: r.name, name: objectName(r.decoded.props[1]), id: idKey(r.decoded.props[0]) }));

  objectsRaw.children = objectsRaw.children.filter((r) => !gone.has(idKey(r.decoded.props[0])));
  connRaw.children = connRaw.children.filter((r) => r.name !== 'C' || !(gone.has(idKey(r.decoded.props[1])) || gone.has(idKey(r.decoded.props[2]))));

  // THE DEFINITIONS COUNT THE OBJECTS: each ObjectType's Count, and the section's own total.
  const definitions = raw.top.find((r) => r.name === 'Definitions');
  if (definitions) {
    const lessBy = new Map();
    for (const d of dropped) lessBy.set(d.kind, (lessBy.get(d.kind) ?? 0) + 1);
    const setCount = (countRec, value) => {
      if (countRec.props[0] !== 'I'.charCodeAt(0) || countRec.props.length !== 5) throw new Error('a Definitions Count that is not one int32');
      const p = Buffer.alloc(5); p[0] = countRec.props[0]; p.writeInt32LE(value, 1);
      countRec.props = p;
    };
    for (const ot of definitions.children.filter((r) => r.name === 'ObjectType')) {
      const less = lessBy.get(ot.decoded.props[0]) ?? 0;
      if (!less) continue;
      const count = ot.children.find((r) => r.name === 'Count');
      if (count) setCount(count, count.decoded.props[0] - less);
    }
    const total = definitions.children.find((r) => r.name === 'Count');
    if (total && dropped.length) setCount(total, total.decoded.props[0] - dropped.length);
  }

  // THE FOOTER, as Blender writes it: its id, four zero bytes, zeros to the next 16 (16 when already there), the
  // version, 120 zeros, the closing magic. Anything else is a file this tool does not know.
  const foot = buf.subarray(raw.footerAt);
  if (!foot.subarray(0, 16).equals(FOOT_ID) || !foot.subarray(foot.length - 16).equals(FOOT_MAGIC)) {
    throw new Error('the footer is not the one Blender writes - this tool re-pads only that one');
  }

  const out = [];
  let at = 0;
  const push = (b) => { out.push(b); at += b.length; };
  const header = (end, numProps, propLen, name) => {
    const h = Buffer.alloc(raw.HEAD + name.length);
    if (raw.wide) { h.writeBigUInt64LE(BigInt(end), 0); h.writeBigUInt64LE(BigInt(numProps), 8); h.writeBigUInt64LE(BigInt(propLen), 16); }
    else { h.writeUInt32LE(end, 0); h.writeUInt32LE(numProps, 4); h.writeUInt32LE(propLen, 8); }
    h.writeUInt8(name.length, raw.HEAD - 1);
    h.write(name, raw.HEAD, 'latin1');
    return h;
  };
  const emit = (r) => {
    const slot = out.length;
    out.push(null);   // the header, written once the record's end is known
    at += raw.HEAD + Buffer.byteLength(r.name, 'latin1');
    push(r.props);
    for (const c of r.children) emit(c);
    if (r.sentinel) push(Buffer.alloc(raw.HEAD));
    out[slot] = header(at, r.numProps, r.props.length, r.name);
  };
  push(buf.subarray(0, 27));
  for (const r of raw.top) emit(r);
  push(Buffer.alloc(raw.HEAD));   // the top level's null record
  push(FOOT_ID);
  push(Buffer.alloc(4));
  let pad = ((at + 15) & ~15) - at;
  if (pad === 0) pad = 16;
  push(Buffer.alloc(pad));
  const v = Buffer.alloc(4); v.writeUInt32LE(raw.version, 0); push(v);
  push(Buffer.alloc(120));
  push(FOOT_MAGIC);
  return { bytes: Buffer.concat(out), dropped };
}

/** The Mesh Models of an FBX by name - what a strip keeps, for the record. */
export function meshModelNames(bytes) {
  const objects = nodeAt(readFbx(Buffer.from(bytes)).nodes, 'Objects');
  return childrenNamed(objects, 'Model').filter((m) => m.props[2] === 'Mesh').map((m) => objectName(m.props[1]));
}

if (isMain(import.meta.url)) {
  const args = process.argv.slice(2);
  const files = args.filter((a) => !a.startsWith('--'));
  const dropArg = args.find((a) => a.startsWith('--drop='))?.slice('--drop='.length) ?? '';
  if (files.length !== 2 || !dropArg) {
    console.error('usage: node tools/fbxStrip.mjs <in.fbx> <out.fbx> --drop=<Model>[,<Model>...]');
    process.exit(2);
  }
  const { bytes, dropped } = stripFbx(readFileSync(files[0]), { drop: dropArg.split(',').map((s) => s.trim()).filter(Boolean) });
  mkdirSync(dirname(files[1]), { recursive: true });
  writeFileSync(files[1], bytes);
  console.log(`${files[0]} -> ${files[1]}  ${bytes.length} bytes`);
  for (const d of dropped) console.log(`  dropped ${d.kind} "${d.name}"`);
  console.log(`  kept: ${meshModelNames(bytes).join(', ')}`);
}
