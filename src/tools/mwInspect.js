// MW-D: THE DIAGNOSTIC, and it deliberately draws nothing.
//
// The Morrowind import arc was reverted whole on 2026-08-28 after three
// "fixes" that all failed. Every one failed the same way: a rule was
// guessed, verified against a fixture built from the same guess, and
// reported working. The reverted rig hardcoded `meshes\base_anim.1st.nif`
// - a name that appears NOWHERE in OpenMW's skeleton table, because
// base_anim.nif is the THIRD-person skeleton (bible/02-Formats/
// Morrowind-Rules.md, rule 6). Nothing ever said so out loud; the layer
// just fell back to the sprite for ever.
//
// So this module is the thing that should have existed first. It opens the
// player's OWN archives and reports what is genuinely inside them. It
// renders nothing, so it cannot be wrong about rendering, and every answer
// it gives is a fact about their files rather than a claim about ours.
//
// Every parse below cites the rule it implements. Where a routine is a
// HEURISTIC rather than a parse, it says so in its own name and its own
// output - the one thing this module must never do is sound certain.

/** Rule: Part V - the Morrowind BSA directory is ONE contiguous block.
 *  12-byte header of 3 uint32 LE (id must be 0x100, dirsize, filenum);
 *  then 3*filenum uint32 read as ONE run, indexed [i*2] size,
 *  [i*2+1] offset, [2*filenum + i] name offset; then the string buffer of
 *  (dirsize - 12*filenum) bytes of NUL-terminated names; then an
 *  8*filenum hash table WHICH THE ENGINE READS AND IGNORES. File data
 *  begins at 12 + dirsize + 8*filenum and every stored offset is relative
 *  to that. (components/bsa/bsafile.cpp:77-205) */
export function parseBsaIndex(bytes) {
  const size = bytes.byteLength;
  if (size < 12) throw new Error('file too small to be a BSA (under 12 bytes)');
  const dv = new DataView(bytes.buffer, bytes.byteOffset, size);
  const id = dv.getUint32(0, true);
  if (id !== 0x100) {
    throw new Error(`not a Morrowind BSA: header id is 0x${id.toString(16)}, expected 0x100`);
  }
  const dirsize = dv.getUint32(4, true);
  const filenum = dv.getUint32(8, true);

  // The engine's own corruption checks, copied rather than invented.
  if (filenum * 21 > size - 12) throw new Error('directory larger than the archive (file count)');
  if (dirsize + 8 * filenum > size - 12) throw new Error('directory larger than the archive (dir size)');

  const tableBytes = 12 * filenum;
  const stringStart = 12 + tableBytes;
  const stringLen = dirsize - tableBytes;
  if (stringLen < 0) throw new Error('directory smaller than its own offset table');
  const dataStart = 12 + dirsize + 8 * filenum;

  const u32 = (i) => dv.getUint32(12 + i * 4, true);
  const files = [];
  for (let i = 0; i < filenum; i++) {
    const fileSize = u32(i * 2);
    const offset = u32(i * 2 + 1) + dataStart;
    const nameOffset = u32(2 * filenum + i);
    if (nameOffset >= stringLen) throw new Error(`name offset outside the string buffer (entry ${i})`);
    let end = stringStart + nameOffset;
    while (end < stringStart + stringLen && bytes[end] !== 0) end++;
    if (end >= stringStart + stringLen) throw new Error(`unterminated name (entry ${i})`);
    files.push({
      // Rule: VFS normalisation is backslash -> slash then ASCII lowercase.
      name: latin1(bytes.subarray(stringStart + nameOffset, end)).replace(/\\/g, '/').toLowerCase(),
      size: fileSize,
      offset,
    });
  }
  return { fileCount: filenum, dirSize: dirsize, dataStart, files };
}

/** Windows-1252 is the ENGLISH release's default, not a property of the
 *  format - engine.cpp:373 seeds it and :1106 can change it, because
 *  localised releases ship other code pages (Part V). This decoder is
 *  therefore named for what it assumes. The five bytes Windows-1252 maps
 *  differently from Latin-1 in the 0x80-0x9F range are the ones a bone
 *  name would never use, so Latin-1 is the honest cheap approximation and
 *  is labelled as such rather than called a decode. */
export function latin1(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return s;
}

/** Rule: Part V - the NIF header is a PREFIX test on ONE '\n'-terminated
 *  line, then a raw uint32 BCD version. (niffile.cpp:539-562) */
export const NIF_MAGICS = Object.freeze(['NetImmerse File Format', 'Gamebryo File Format']);

export function readNifHeader(bytes) {
  let nl = -1;
  for (let i = 0; i < Math.min(bytes.length, 128); i++) if (bytes[i] === 0x0a) { nl = i; break; }
  if (nl < 0) return { ok: false, why: 'no newline in the first 128 bytes - not a NIF' };
  const line = latin1(bytes.subarray(0, nl)).replace(/\r$/, '');
  const magic = NIF_MAGICS.find((m) => line.startsWith(m));
  if (!magic) return { ok: false, why: `header line is ${JSON.stringify(line)}`, line };
  if (bytes.length < nl + 5) return { ok: false, why: 'file ends before the version field', line };
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const version = dv.getUint32(nl + 1, true);
  return {
    ok: true, magic, line, version,
    versionText: [24, 16, 8, 0].map((s) => (version >>> s) & 0xff).join('.'),
    // Rule: a NIF `bool` is int32 BELOW version 4.1.0.0 and int8 at or
    // above - the threshold is the rule, not the answer (Part V).
    boolBytes: version < 0x04010000 ? 4 : 1,
  };
}

/** The first-person skeletons OpenMW will actually ask for, by actor.
 *  getActorSkeleton + settings-default.cfg [Models] (rules 6 and 18).
 *  base_anim.1st.nif is in this table ONLY as the name the reverted arc
 *  used, so the report can say plainly whether it was ever there. */
export const FP_SKELETONS = Object.freeze([
  { path: 'meshes/xbase_anim.1st.nif', who: 'male, non-beast' },
  { path: 'meshes/base_anim_female.1st.nif', who: 'female' },
  { path: 'meshes/base_animkna.1st.nif', who: 'beast (Khajiit, Argonian)' },
  { path: 'meshes/wolf/skin.1st.nif', who: 'werewolf' },
  { path: 'meshes/xbase_anim.1st.kf', who: 'first-person animation source' },
  { path: 'meshes/base_anim.1st.nif', who: 'THE NAME THE REVERTED RIG HARDCODED' },
]);

/** Rule: TES3 records are name[4] + uint32 size + 8 bytes of header/flags,
 *  then `size` bytes of subrecords, each name[4] + uint32 size + data.
 *  Unlike NIF every record carries its size, so an unknown type is
 *  skippable by design - which is why this walk cannot desynchronise. */
export function walkEsm(bytes, { limit = Infinity } = {}) {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const out = [];
  let p = 0;
  while (p + 16 <= bytes.length && out.length < limit) {
    const type = latin1(bytes.subarray(p, p + 4));
    const size = dv.getUint32(p + 4, true);
    const body = p + 16;
    if (body + size > bytes.length) break;   // truncated tail, not a throw
    out.push({ type, start: body, size });
    p = body + size;
  }
  return out;
}

export function subrecords(bytes, rec) {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const out = [];
  let p = rec.start;
  const end = rec.start + rec.size;
  while (p + 8 <= end) {
    const name = latin1(bytes.subarray(p, p + 4));
    const len = dv.getUint32(p + 4, true);
    if (p + 8 + len > end) break;
    out.push({ name, start: p + 8, len });
    p = p + 8 + len;
  }
  return out;
}

const zstr = (bytes, s, n) => {
  let e = s;
  while (e < s + n && bytes[e] !== 0) e++;
  return latin1(bytes.subarray(s, e));
};

/** Morrowind's body-part slots, by BYDT index
 *  (components/esm3/loadbody.hpp MeshPart). ONE HOME: the ESM reader owns
 *  this table. The inspector carried its own copy while the format layer
 *  was reverted out of the tree; now that the layer is back, a second
 *  copy is exactly the duplicate-declaration the one-home audit exists to
 *  catch - and it caught it. Re-exported so this module's own API is
 *  unchanged for its page and its pins. */
export { MW_BODY_PARTS } from '../formats/mwEsmFile.js';
import { MW_BODY_PARTS } from '../formats/mwEsmFile.js';

/** The four parts allowed to fall back to a third-person mesh when the
 *  first-person record is missing (rule 3 / npcanimation.cpp:1217-1253).
 *  NOT the list of what gets shown - the reverted arc inverted exactly
 *  this and so rendered nothing else. */
export const ARM_PARTS = Object.freeze(['hand', 'wrist', 'forearm', 'upperarm']);

/** Rule 1: a first-person body part is a RECORD whose id ends in "1st"
 *  (loadbody.cpp:85-88) - NOT a mesh filename with .1st spliced in, which
 *  is the transform the reverted arc applied to the MODL path. */
export const isFirstPersonId = (id) => String(id).toLowerCase().endsWith('1st');

export function bodyParts(bytes) {
  const out = [];
  for (const rec of walkEsm(bytes)) {
    if (rec.type !== 'BODY') continue;
    const e = { id: '', model: '', race: '', part: -1, female: false, playable: true, skin: false };
    for (const sub of subrecords(bytes, rec)) {
      if (sub.name === 'NAME') e.id = zstr(bytes, sub.start, sub.len);
      else if (sub.name === 'MODL') e.model = zstr(bytes, sub.start, sub.len).replace(/\\/g, '/').toLowerCase();
      else if (sub.name === 'FNAM') e.race = zstr(bytes, sub.start, sub.len).toLowerCase();
      else if (sub.name === 'BYDT' && sub.len >= 4) {
        e.part = bytes[sub.start];
        const flags = bytes[sub.start + 2];
        e.female = (flags & 1) !== 0;            // BPF_Female = 1
        e.playable = (flags & 2) === 0;          // BPF_NotPlayable = 2
        e.skin = bytes[sub.start + 3] === 0;     // MT_Skin = 0
      }
    }
    e.slot = MW_BODY_PARTS[e.part] ?? `#${e.part}`;
    e.firstPerson = isFirstPersonId(e.id);
    out.push(e);
  }
  return out;
}

/** The report the reverted arc never printed: for one race, which
 *  first-person arm records actually exist, and what each one would fall
 *  back to. Answers are about the PLAYER'S data, never about ours. */
export function armReport(parts, race, female) {
  const want = String(race || '').toLowerCase();
  const rows = [];
  for (const slot of ARM_PARTS) {
    const forSlot = parts.filter((p) => p.race === want && p.slot === slot && p.skin && p.playable);
    const fp = forSlot.filter((p) => p.firstPerson);
    const tp = forSlot.filter((p) => !p.firstPerson);
    const pick = (list) => list.find((p) => p.female === !!female) || list.find((p) => !p.female) || null;
    const chosenFp = pick(fp);
    const chosenTp = pick(tp);
    rows.push({
      slot,
      firstPerson: chosenFp,
      thirdPersonFallback: chosenTp,
      // Rule 3: only these four may fall back at all, and this IS one of them.
      verdict: chosenFp ? 'first-person record found'
        : chosenTp ? 'no .1st record - falls back to the third-person mesh (allowed for arms)'
          : 'NOTHING for this slot',
      counts: { firstPerson: fp.length, thirdPerson: tp.length },
    });
  }
  return rows;
}

/** MW-D2: IS THIS MESH SKINNED, OR RIGID?
 *
 * The question MW8's entire design rested on and nobody ever asked of a
 * real file. MW8 concluded Morrowind's arms are RIGID meshes hung off a
 * bone, from reading OpenMW's two attach branches. If they are actually
 * SKINNED, that fix was wrong in the same way MW7's was.
 *
 * THIS IS A SCAN, NOT A PARSE, and it is named so you cannot forget that.
 * A Morrowind NIF (4.0.0.2) stores each record's TYPE NAME as a sized
 * string immediately before the record, and there are no per-record sizes
 * - which is exactly why an unknown type is fatal to a real reader (rule:
 * niffile.cpp throws). A full walk therefore needs every record's layout.
 * But the type NAMES are recoverable without any of that: a uint32 length
 * followed by that many bytes of a NIF type name is a pattern a mesh's
 * other contents essentially never produce.
 *
 * So this answers "does a NiSkinInstance appear in this file" with high
 * confidence and answers NOTHING about geometry, transforms or bones. It
 * is a census, offered as a census.
 */
export function scanNifRecordTypes(bytes) {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const census = new Map();
  const NAME = /^[A-Z][A-Za-z0-9_]{2,39}$/;
  for (let i = 0; i + 4 < bytes.length; i++) {
    const len = dv.getUint32(i, true);
    if (len < 3 || len > 40 || i + 4 + len > bytes.length) continue;
    let ok = true;
    for (let j = i + 4; j < i + 4 + len; j++) {
      const c = bytes[j];
      if (c < 0x30 || c > 0x7a || (c > 0x39 && c < 0x41) || (c > 0x5a && c < 0x61 && c !== 0x5f)) { ok = false; break; }
    }
    if (!ok) continue;
    const name = latin1(bytes.subarray(i + 4, i + 4 + len));
    if (!NAME.test(name)) continue;
    // Morrowind's own vocabulary: almost everything is Ni*, plus a short
    // tail of engine markers. Anything else is far more likely to be a
    // coincidence in vertex data than a record type.
    if (!/^Ni/.test(name) && !['RootCollisionNode', 'AvoidNode'].includes(name)) continue;
    census.set(name, (census.get(name) || 0) + 1);
    i += 3 + len;
  }
  return census;
}

/** The verdict, with its own uncertainty attached. `skinned` is only ever
 *  true because a NiSkinInstance was SEEN - never inferred from absence of
 *  something else. */
export function skinVerdict(bytes) {
  const header = readNifHeader(bytes);
  if (!header.ok) return { ok: false, why: header.why };
  const census = scanNifRecordTypes(bytes);
  const skinInstances = census.get('NiSkinInstance') || 0;
  const shapes = (census.get('NiTriShape') || 0) + (census.get('NiTriStrips') || 0);
  return {
    ok: true,
    version: header.versionText,
    skinned: skinInstances > 0,
    skinInstances,
    shapes,
    census: [...census.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])),
    method: 'record-type SCAN, not a parse - it can tell you a NiSkinInstance is present, nothing more',
  };
}

/** Where an arm slot's mesh actually lives in the archive: the record the
 *  engine would use for this actor, then its own MODL under meshes/.
 *  Rule: the .1st RECORD carries its own mesh name; the path is never
 *  built by splicing .1st into a filename. */
export function armMeshPaths(rows) {
  return rows.map((row) => {
    const rec = row.firstPerson || row.thirdPersonFallback || null;
    return {
      slot: row.slot,
      record: rec ? rec.id : null,
      firstPerson: !!row.firstPerson,
      path: rec && rec.model ? `meshes/${rec.model}` : null,
    };
  });
}

/** MW-D3: PARSE THE MESH FOR REAL, AND SHOW IT.
 *
 * The scan above answers "is there a NiSkinInstance" without parsing. This
 * does the opposite: it runs the restored strict reader (parseNif +
 * flattenNif, MW-IMPORT slices 1-2) over an actual arm mesh and hands back
 * geometry a page can draw.
 *
 * IT IS ALLOWED TO FAIL, AND SAYING SO IS THE POINT. An unknown record
 * type throws and kills the whole file - that is the format, not a bug in
 * the reader (niffile.cpp has no skip path). A community-mesh sweep put
 * 602 such failures across 14 record types on the worklist. So a failure
 * here is a FACT about which records this file needs, reported with the
 * message, not swallowed into an empty view the way the reverted rig
 * swallowed everything.
 */
export async function parseMeshForPreview(bytes) {
  let parseNif; let flattenNif;
  try {
    ({ parseNif } = await import('../formats/mwNifFile.js'));
    ({ flattenNif } = await import('../formats/mwNifMesh.js'));
  } catch (err) {
    return { ok: false, error: `reader unavailable: ${err.message}` };
  }
  let nif;
  try {
    nif = parseNif(bytes);
  } catch (err) {
    return { ok: false, stage: 'parse', error: err.message };
  }
  let batches;
  try {
    batches = flattenNif(nif);
  } catch (err) {
    return { ok: false, stage: 'flatten', error: err.message };
  }
  const shapes = batches.map((b) => ({
    positions: b.positions,
    indices: b.indices,
    skinned: !!(b.skinned && b.skin),
    vertices: b.positions ? b.positions.length / 3 : 0,
    triangles: b.indices ? b.indices.length / 3 : 0,
  })).filter((s) => s.vertices > 0 && s.triangles > 0);
  if (!shapes.length) return { ok: false, stage: 'geometry', error: 'parsed, but it carries no drawable geometry' };
  return {
    ok: true,
    shapes,
    vertices: shapes.reduce((n, s) => n + s.vertices, 0),
    triangles: shapes.reduce((n, s) => n + s.triangles, 0),
    skinnedShapes: shapes.filter((s) => s.skinned).length,
    bounds: meshBounds(shapes),
  };
}

/** Axis-aligned bounds over every shape, for framing a preview.
 *  Morrowind is Z-UP, so a front view is x across and z up. */
export function meshBounds(shapes) {
  let minX = Infinity; let minY = Infinity; let minZ = Infinity;
  let maxX = -Infinity; let maxY = -Infinity; let maxZ = -Infinity;
  for (const s of shapes) {
    const p = s.positions;
    for (let i = 0; i < p.length; i += 3) {
      if (p[i] < minX) minX = p[i];
      if (p[i] > maxX) maxX = p[i];
      if (p[i + 1] < minY) minY = p[i + 1];
      if (p[i + 1] > maxY) maxY = p[i + 1];
      if (p[i + 2] < minZ) minZ = p[i + 2];
      if (p[i + 2] > maxZ) maxZ = p[i + 2];
    }
  }
  if (!Number.isFinite(minX)) return null;
  return { minX, minY, minZ, maxX, maxY, maxZ };
}

/** Fit the bounds into a w x h box, front view (x across, z up, z flipped
 *  because canvas y grows downward). Returns a point mapper. Uniform
 *  scale - a per-axis fit would make a hand look correct while hiding
 *  proportions that are actually wrong. */
export function frontViewMapper(bounds, w, h, pad = 8) {
  const spanX = Math.max(bounds.maxX - bounds.minX, 1e-6);
  const spanZ = Math.max(bounds.maxZ - bounds.minZ, 1e-6);
  const scale = Math.min((w - pad * 2) / spanX, (h - pad * 2) / spanZ);
  const cx = (bounds.minX + bounds.maxX) / 2;
  const cz = (bounds.minZ + bounds.maxZ) / 2;
  return (x, y, z) => [w / 2 + (x - cx) * scale, h / 2 - (z - cz) * scale];
}

/** MW-D4: DOES YOUR SKELETON HAVE THE BONES THE RULES NAME?
 *
 * Rule 5 records OpenMW's part-to-bone table verbatim - "Right Hand",
 * "Left Upper Arm", "Weapon Bone" and the rest - read out of
 * npcanimation.cpp:200-260. Rule 16 records that lookup is CASE-
 * INSENSITIVE, lowercased on both sides, and that duplicate names resolve
 * to the first in depth-first order.
 *
 * All of that came off source. None of it has been checked against a
 * skeleton in an actual archive. If a name is wrong, every attach silently
 * finds nothing and the rig draws an empty view - which is the failure
 * this whole effort keeps circling. So ask the file.
 */
export async function skeletonReport(bytes) {
  let parseNif; let buildSkeleton;
  try {
    ({ parseNif } = await import('../formats/mwNifFile.js'));
    ({ buildSkeleton } = await import('../formats/mwSkin.js'));
  } catch (err) {
    return { ok: false, error: `reader unavailable: ${err.message}` };
  }
  let skel;
  try {
    skel = buildSkeleton(parseNif(bytes));
  } catch (err) {
    return { ok: false, stage: 'parse', error: err.message };
  }
  const names = [...skel.nodes.values()].map((n) => n.name).filter(Boolean);
  return {
    ok: true,
    boneCount: skel.nodes.size,
    names,
    // Rule 16: lowercased on both sides. The report must use the SAME
    // comparison the binder will, or it answers a question nobody asked.
    has: (name) => skel.byName.has(String(name).toLowerCase()),
  };
}

/** The bones a first-person arm actually needs, per rule 5, plus the two
 *  weapon bones rule 17 says are chosen per weapon type. Names are given
 *  in the engine's own spelling; the lookup lowercases. */
export const FP_REQUIRED_BONES = Object.freeze([
  { name: 'Left Hand', why: 'hand, left side' },
  { name: 'Right Hand', why: 'hand, right side' },
  { name: 'Left Wrist', why: 'wrist, left side' },
  { name: 'Right Wrist', why: 'wrist, right side' },
  { name: 'Left Forearm', why: 'forearm, left side' },
  { name: 'Right Forearm', why: 'forearm, right side' },
  { name: 'Left Upper Arm', why: 'upper arm, left side' },
  { name: 'Right Upper Arm', why: 'upper arm, right side' },
  { name: 'Weapon Bone', why: 'every weapon type except the bow' },
  { name: 'Weapon Bone Left', why: 'the BOW, and only the bow (rule 8)' },
  { name: 'Bip01 Spine1', why: 'blend mask: Torso (rule 9)' },
  { name: 'Bip01 L Clavicle', why: 'blend mask: LeftArm' },
  { name: 'Bip01 R Clavicle', why: 'blend mask: RightArm' },
]);

/** Which of them this skeleton actually carries. A missing bone is
 *  reported as missing, never worked around - a silent fallback here is
 *  how an empty view gets called a working one. */
export function checkRequiredBones(report) {
  if (!report || !report.ok) return [];
  return FP_REQUIRED_BONES.map((b) => ({ ...b, present: report.has(b.name) }));
}

/** MW-D5: ASSEMBLE THE ARM.
 *
 * The first step that PLACES parts relative to one another rather than
 * examining them one at a time. Everything here is a recorded rule, and
 * the two the reverted arc got backwards are the two doing the work:
 *
 *  rule 12 - skinned and rigid parts take COMPLETELY different paths. A
 *    skinned part's geometry is skinned to the actor's skeleton and is
 *    never parented to a bone. A rigid part is placed AT a bone.
 *  rule 13 - a rigid part whose attach bone's name contains "Left" is
 *    drawn with x negated. One mesh serves both sides. MW8 attached the
 *    same mesh at both bones with no mirror, so its left hand was a
 *    second right hand.
 *  rule 15 - for a skinned part the bone name is ALSO a geometry filter:
 *    a case-insensitive prefix match on the shape name with Morrowind's
 *    "Tri " convention stripped. That is how a skinned part picks its
 *    side, where a rigid one uses the mirror.
 *
 * Rest pose only - no clip, no time. Animation is the next stage and
 * mixing them would make a failure ambiguous.
 */
export async function assembleFirstPersonArm({ skeletonBytes, parts }) {
  const mod = {};
  try {
    ({ parseNif: mod.parseNif } = await import('../formats/mwNifFile.js'));
    ({ buildSkeleton: mod.buildSkeleton, poseSkeleton: mod.poseSkeleton,
      skeletonSpaceMatrices: mod.skelMats, skinBatch: mod.skinBatch,
      accumRootRef: mod.accumRootRef, trackBinding: mod.trackBinding } = await import('../formats/mwSkin.js'));
    ({ bindPart: mod.bindPart, attachmentTransform: mod.attachmentTransform } = await import('../formats/mwCharacter.js'));
    ({ PART_BONES: mod.PART_BONES } = await import('../formats/mwNpc.js'));
  } catch (err) {
    return { ok: false, error: `readers unavailable: ${err.message}` };
  }

  let skeleton;
  try {
    skeleton = mod.buildSkeleton(mod.parseNif(skeletonBytes));
  } catch (err) {
    return { ok: false, stage: 'skeleton', error: err.message };
  }
  const rootRef = [...skeleton.nodes.entries()].find(([, n]) => n.parent < 0)?.[0] ?? -1;

  const pieces = [];
  const notes = [];
  for (const part of parts) {
    // `part.bones` overrides the table so a test can drive real assembly
    // against a fixture skeleton whose bone names are not Morrowind's.
    const bones = part.bones ?? mod.PART_BONES[part.slot] ?? [];
    let nif;
    try {
      nif = mod.parseNif(part.bytes);
    } catch (err) {
      notes.push(`${part.slot}: ${err.message}`);
      continue;
    }
    // MW-D6: the nameless-shape extension binds ONCE for the part; a
    // NAMED shape binds once PER SIDE, filtered. See the block below.
    let tookNameless = false;
    for (const bone of bones.length ? bones : [null]) {
      if (bone && !skeleton.byName.has(bone.toLowerCase())) {
        notes.push(`${part.slot}: this skeleton has no bone "${bone}"`);
        continue;
      }
      let bound;
      try {
        bound = mod.bindPart(skeleton, nif, bone ? { attachBone: bone } : {});
      } catch (err) {
        notes.push(`${part.slot} @ ${bone}: ${err.message}`);
        continue;
      }

      // RULE 12 + 15: skinned geometry carries its own bones, so it is
      // never MIRRORED - it picks its side by the shape NAME. And it
      // binds ONCE PER SIDE, not once per part.
      //
      // MW-D6 CORRECTION. This block used to be wrapped in a
      // `if (!tookSkinned)` latch raised by the first bone that yielded
      // any skinned batch, so a two-bone slot - and every arm slot is one
      // (`PART_BONES.hand = ['left hand','right hand']`) - emitted the
      // LEFT hand and never asked for the right. The filter that exists
      // precisely to pick a side ran once and then was skipped, which on
      // retail data is a one-handed arm.
      //
      // Rule 4 is what the latch contradicted: sPartList is a MULTIMAP,
      // `{ MP_Hand, PRT_RHand }, { MP_Hand, PRT_LHand }` - one mesh part,
      // two slots, "each side its own part reference at its own bone".
      // The doc already warns that the first attempt "treated a part as
      // one mesh attached at two bones in one pass"; the latch was the
      // same error wearing the other face.
      //
      // A latch is still needed, but only for the port's own EXTENSION to
      // rule 15: a shape with no name matches every bone (OpenMW's
      // ciStartsWith("", filter) is false and the engine drops it), so a
      // nameless one-shape part would bind at every side and stack
      // duplicates in the same place. That one binds once.
      let namelessHere = false;
      for (const batch of bound.skinned) {
        const nameless = !String(batch.name || '').trim();
        if (nameless && tookNameless) continue;
        if (bone && !shapeMatchesBone(batch.name, bone)) continue;
        // MW-D7: the piece KEEPS its batch, and `positions` is its own
        // buffer - never an alias of batch.positions, which poseAssembly
        // reads every frame. Aliasing them is the runaway the viewer
        // documents at mwViewer.js:430-436.
        pieces.push({ slot: part.slot, bone, kind: 'skinned', mirrored: false,
          batch, source: null, attachRef: null,
          positions: new Float32Array(batch.positions.length), indices: batch.indices });
        if (nameless) namelessHere = true;
      }
      tookNameless = tookNameless || namelessHere;

      // RULE 12 + 13: a rigid part is PLACED at the bone, once per side,
      // with x negated on the left.
      if (bound.attached.length) {
        // The mirror is fixed HERE, at bind time, because it is a fact
        // about the bone's NAME, not about the pose. Re-deriving it per
        // frame invites a pose-dependent mirror, which is a left hand
        // that flips sides mid-clip.
        const mirror = !!(bone && /left/i.test(bone));
        for (const batch of bound.attached) {
          pieces.push({ slot: part.slot, bone, kind: 'rigid', mirrored: mirror,
            batch: null, source: batch.positions, attachRef: bound.attachRef,
            positions: new Float32Array(batch.positions.length), indices: batch.indices });
        }
      }
    }
  }
  const assembly = {
    ok: pieces.length > 0,
    pieces,
    notes,
    skeleton,
    rootRef,
    // The resolved readers ride along so the per-frame call is SYNCHRONOUS.
    // A dynamic import inside a requestAnimationFrame body is a promise per
    // frame; this function already paid for them once.
    fns: mod,
    bounds: null,
    error: pieces.length ? null : 'nothing bound - see the notes for why',
  };
  // THE REST POSE IS NOW "pose at t=0 with no tracks" - one home, and the
  // MW-D5/D6 pins keep seeing byte-identical numbers because they are the
  // same arithmetic, called once instead of inlined.
  return pieces.length ? poseAssembly(assembly) : assembly;
}

/**
 * MW-D7: POSE THE ASSEMBLY. The one home for everything that changes when
 * time does - and the reason assembleFirstPersonArm's return value can be
 * re-posed at all.
 *
 * What is recomputed here, and nothing else:
 *   - the pose (one poseSkeleton over the whole skeleton);
 *   - the skeleton-space matrices, MEMOISED PER SKELETON ROOT. The
 *     assembly had been walking the chain once per skinned batch; the
 *     distinct roots are what the walk actually depends on, and on an arm
 *     that is one.
 *   - per skinned piece: skinBatch into the piece's own buffer;
 *   - per rigid piece: the attachment affine, which now carries the
 *     bone's ANIMATED rotation, so rigid parts move too. A stage that
 *     re-skinned the skinned half and left the rigid half at rest would
 *     draw a hand that animates inside a cuff that does not.
 *
 * What is NOT recomputed, because it is a fact about the files and not
 * about time: the parse, the skeleton, the bind, rule 15's shape filter,
 * rule 13's mirror, the attach ref, the output buffers, and the draw
 * mapper. A mapper that follows the per-frame bounds renormalises the
 * picture every frame and hides the very motion this stage exists to show.
 *
 * Mutates `assembly` in place and returns it.
 */
export function poseAssembly(assembly, { tracks = null, sampleTrack = null,
  time = 0, accumRoot = null } = {}) {
  const { fns, skeleton, rootRef, pieces } = assembly;
  if (!fns || !skeleton) return assembly;
  const pose = fns.poseSkeleton(skeleton, tracks, sampleTrack, time, { accumRoot });
  const byRoot = new Map([[rootRef, fns.skelMats(skeleton, pose, rootRef)]]);
  const matsFor = (root) => {
    if (!byRoot.has(root)) byRoot.set(root, fns.skelMats(skeleton, pose, root));
    return byRoot.get(root);
  };
  for (const p of pieces) {
    if (p.kind === 'skinned') {
      fns.skinBatch(p.batch, skeleton, pose, matsFor(p.batch.skin.skeletonRoot), p.positions, null);
    } else {
      const at = fns.attachmentTransform(byRoot.get(rootRef), p.attachRef);
      placeAtBone(p.source, at, p.mirrored, p.positions);
    }
  }
  assembly.pose = pose;
  assembly.time = time;
  assembly.bounds = pieces.length ? meshBounds(pieces) : null;
  return assembly;
}

/** MW-D6: one row per assembled piece, for the page's table and the
 *  probe's readback - so neither invents its own summary of the same
 *  data and the two can disagree.
 *
 *  KEYED BY SLOT **AND** BONE. Every arm slot is two-boned (rule 4's
 *  multimap), so a key of slot alone collides on exactly the case this
 *  stage exists to show. Bounds are PER PIECE, not the assembly's, which
 *  is what makes a left/right mix-up readable in a table as well as on
 *  the canvas. */
export function armPieceRows(pieces) {
  return (pieces ?? []).map((p) => ({
    key: `${p.slot} @ ${p.bone ?? '(no bone)'}`,
    slot: p.slot,
    bone: p.bone ?? null,
    kind: p.kind,
    mirrored: !!p.mirrored,
    vertices: p.positions ? p.positions.length / 3 : 0,
    triangles: p.indices ? p.indices.length / 3 : 0,
    bounds: meshBounds([p]),
  }));
}

/** RULE 15's filter, verbatim: a case-insensitive PREFIX match on the
 *  shape name, with Morrowind's "Tri " convention stripped first. A shape
 *  with NO name matches everything, because a nameless shape in a
 *  one-shape part file is the part. */
export function shapeMatchesBone(shapeName, bone) {
  const name = String(shapeName || '').trim().toLowerCase();
  if (!name) return true;
  const want = String(bone).toLowerCase();
  if (name.startsWith(want)) return true;
  return name.startsWith('tri ') && name.slice(4).startsWith(want);
}

/** RULE 13, alone and directly testable: place a rigid part's vertices at
 *  a bone, mirroring x first when the part is going on the LEFT.
 *
 *  Extracted because the mirror could not be reached end-to-end - no
 *  fixture skeleton carries a bone whose name contains "left", so an
 *  assembly test simply never took this branch and three mutants survived
 *  a full sweep. A rule that cannot be exercised is not pinned, whatever
 *  the test output says.
 */
export function placeAtBone(positions, at, mirror, out = new Float32Array(positions.length)) {
  for (let v = 0; v < positions.length; v += 3) {
    const x = mirror ? -positions[v] : positions[v];
    const y = positions[v + 1];
    const z = positions[v + 2];
    out[v] = at.a[0] * x + at.a[1] * y + at.a[2] * z + at.t[0];
    out[v + 1] = at.a[3] * x + at.a[4] * y + at.a[5] * z + at.t[1];
    out[v + 2] = at.a[6] * x + at.a[7] * y + at.a[8] * z + at.t[2];
  }
  return out;
}

/**
 * MW-D7: THE CLIP, READ AND REPORTED. One summary the page renders and the
 * probe reads back, so the two cannot invent different accounts of the
 * same file.
 *
 * `binding` is the field that earns its place. poseSkeleton answers an
 * unmatched bone with its rest transform, so a .kf keyed to bones this
 * skeleton does not have poses NOTHING and draws a clean, static,
 * entirely plausible arm. That failure is invisible in a picture and
 * invisible in a pixel count; it is only ever visible as a sentence.
 *
 * `tracks[].rotationType` is the second: it says how much of a player's
 * real file rides KEY_TYPE.constant, whose sampler this tree holds at the
 * previous key where the reference flips at the segment midpoint. That is
 * a different member with no fixture, deliberately not touched here - but
 * a player looking at their own data deserves to see how much of it is
 * affected rather than being told nothing.
 *
 * `legacy` is parseAnimGroups' answer to the same question, carried so
 * the page can show both. On the fixture they disagree by construction:
 * the listing reports Idle [1.00 -> 0.50], a range that runs backwards,
 * while the clip law reads [1.00 -> 3.00].
 */
export async function clipReport({ kfBytes, skeleton = null, group = 'Idle', clipOpts = {} } = {}) {
  const mod = {};
  try {
    ({ parseNif: mod.parseNif } = await import('../formats/mwNifFile.js'));
    ({ collectTextKeys: mod.collectTextKeys, normalizeTextKeys: mod.normalizeTextKeys,
      clipGroups: mod.clipGroups, resetClip: mod.resetClip, parseAnimGroups: mod.parseAnimGroups,
      extractTracks: mod.extractTracks } = await import('../formats/mwAnim.js'));
    ({ trackBinding: mod.trackBinding, accumRootRef: mod.accumRootRef } = await import('../formats/mwSkin.js'));
  } catch (err) {
    return { ok: false, error: `readers unavailable: ${err.message}` };
  }
  if (!kfBytes || !kfBytes.length) {
    return { ok: false, error: 'no animation file - the archive carries no first-person .kf' };
  }
  let nif;
  try {
    nif = mod.parseNif(kfBytes);
  } catch (err) {
    return { ok: false, error: err.message };
  }
  const rawKeys = mod.collectTextKeys(nif);
  const keys = mod.normalizeTextKeys(rawKeys);
  const tracks = mod.extractTracks(nif);
  const clip = mod.resetClip(keys, group, clipOpts);
  const legacyRaw = mod.parseAnimGroups(rawKeys).get(group);
  const channels = (t) => ({
    rotation: (t.rotationKeys?.length ?? 0) || (t.xyzRotations ? -1 : 0),
    translation: t.translations?.keys?.length ?? 0,
    scale: t.scales?.keys?.length ?? 0,
  });
  return {
    ok: true,
    header: readNifHeader(kfBytes),
    rawKeys,
    keys,
    groups: mod.clipGroups(keys),
    group,
    clip,
    // RULE 49's default loopStopTime is +Infinity, and JSON turns that
    // into null on its way through a page evaluation. The boolean is what
    // survives the trip, so a probe never asserts on a null it cannot read.
    loopStopFinite: !!clip.ok && Number.isFinite(clip.loopStopTime),
    legacy: legacyRaw
      ? { start: legacyRaw.start, stop: legacyRaw.stop,
        loopStart: legacyRaw.loopStart, loopStop: legacyRaw.loopStop }
      : null,
    tracks: [...tracks.entries()].map(([bone, t]) => ({
      bone,
      channels: channels(t),
      rotationType: t.rotationType,
      translationType: t.translations?.type ?? 0,
      startTime: t.startTime,
      stopTime: t.stopTime,
      frequency: t.frequency,
      phase: t.phase,
    })),
    binding: skeleton ? mod.trackBinding(skeleton, tracks) : null,
    accumRoot: skeleton ? mod.accumRootRef(skeleton, tracks) : null,
    trackMap: tracks,
  };
}

/** MW-D7: the draw mapper's bounds, over the WHOLE clip rather than one
 *  frame. A mapper recomputed per frame renormalises the picture every
 *  time the arm moves, which cancels out exactly the motion this stage
 *  exists to show - the arm would appear to hold still while its numbers
 *  changed underneath. Sample, union, fix the mapper once. */
export function clipUnionBounds(assembly, poseAt, times) {
  let acc = null;
  for (const t of times ?? []) {
    poseAt(t);
    const b = assembly.bounds;
    if (!b) continue;
    acc = acc ? {
      minX: Math.min(acc.minX, b.minX), minY: Math.min(acc.minY, b.minY), minZ: Math.min(acc.minZ, b.minZ),
      maxX: Math.max(acc.maxX, b.maxX), maxY: Math.max(acc.maxY, b.maxY), maxZ: Math.max(acc.maxZ, b.maxZ),
    } : { ...b };
  }
  return acc;
}
