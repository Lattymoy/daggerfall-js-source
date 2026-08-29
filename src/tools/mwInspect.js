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

/** Morrowind's body-part slots, by BYDT index.
 *  components/esm3/loadbody.hpp MeshPart. */
export const MW_BODY_PARTS = Object.freeze(['head', 'hair', 'neck', 'chest', 'groin', 'hand',
  'wrist', 'forearm', 'upperarm', 'foot', 'ankle', 'knee', 'upperleg', 'clavicle', 'tail']);

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
