// Morrowind ESM/ESP reader (TES3) - slice 6 of the import arc. Original
// implementation against the documented TES3 layout; OpenMW's
// components/esm3 used as behavioral reference only (GPL - no code
// ported). User-supplied at runtime like every Morrowind byte.
//
// Layout (little-endian):
//   Record: char[4] type, uint32 dataSize, uint32 unknown, uint32 flags,
//     then dataSize bytes of subrecords.
//   Subrecord: char[4] type, uint32 size, data.
//   'TES3' opens the file; HEDR carries version/company/description and
//   the record count.
//
// UNLIKE NIF, every record carries its size, so unknown types are
// SKIPPED - correctly and by design. Strictness lives inside the types
// this slice decodes (BODY, RACE, NPC_, CREA): a malformed known
// subrecord throws with the record id. Everything else is counted and
// passed over; the skip census is part of the parse result so nothing
// disappears silently.

const td = new TextDecoder('windows-1252');

class EsmStream {
  constructor(bytes) {
    this.bytes = bytes;
    this.view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    this.pos = 0;
  }
  u8() {
    return this.view.getUint8(this.pos++);
  }
  u32() {
    const v = this.view.getUint32(this.pos, true);
    this.pos += 4;
    return v;
  }
  i32() {
    const v = this.view.getInt32(this.pos, true);
    this.pos += 4;
    return v;
  }
  f32() {
    const v = this.view.getFloat32(this.pos, true);
    this.pos += 4;
    return v;
  }
  tag() {
    const s = td.decode(this.bytes.subarray(this.pos, this.pos + 4));
    this.pos += 4;
    return s;
  }
  /** Fixed-size zero-padded string field. */
  zstring(len) {
    const raw = this.bytes.subarray(this.pos, this.pos + len);
    this.pos += len;
    const nul = raw.indexOf(0);
    return td.decode(nul >= 0 ? raw.subarray(0, nul) : raw);
  }
}

/** Split one record's data into its subrecords. */
function* subrecords(bytes) {
  const s = new EsmStream(bytes);
  while (s.pos + 8 <= bytes.byteLength) {
    const type = s.tag();
    const size = s.u32();
    if (s.pos + size > bytes.byteLength) {
      throw new Error(`subrecord ${type} overruns its record`);
    }
    yield { type, data: bytes.subarray(s.pos, s.pos + size) };
    s.pos += size;
  }
}

const subString = (data) => new EsmStream(data).zstring(data.byteLength);

export const MW_BODY_PARTS = Object.freeze([
  'head', 'hair', 'neck', 'chest', 'groin', 'hand', 'wrist', 'forearm',
  'upperarm', 'foot', 'ankle', 'knee', 'upperleg', 'clavicle', 'tail',
]);
export const BODY_TYPE = Object.freeze({ skin: 0, clothing: 1, armor: 2 });

function decodeBody(rec) {
  const out = { id: null, model: null, race: null, part: -1, vampire: 0, female: false, playable: true, kind: -1 };
  for (const sub of subrecords(rec.data)) {
    if (sub.type === 'NAME') out.id = subString(sub.data).toLowerCase();
    else if (sub.type === 'MODL') out.model = subString(sub.data);
    else if (sub.type === 'FNAM') out.race = subString(sub.data).toLowerCase();
    else if (sub.type === 'BYDT') {
      if (sub.data.byteLength !== 4) throw new Error(`BODY ${out.id}: BYDT is ${sub.data.byteLength} bytes`);
      out.part = sub.data[0];
      out.vampire = sub.data[1];
      out.female = (sub.data[2] & 1) !== 0;
      out.playable = (sub.data[2] & 2) === 0;
      out.kind = sub.data[3];
    }
  }
  return out;
}

function decodeRace(rec) {
  const out = { id: null, name: null, playable: false, beast: false, height: [1, 1], weight: [1, 1] };
  for (const sub of subrecords(rec.data)) {
    if (sub.type === 'NAME') out.id = subString(sub.data).toLowerCase();
    else if (sub.type === 'FNAM') out.name = subString(sub.data);
    else if (sub.type === 'RADT') {
      if (sub.data.byteLength !== 140) throw new Error(`RACE ${out.id}: RADT is ${sub.data.byteLength} bytes`);
      const s = new EsmStream(sub.data);
      s.pos = 120; // 7 skill pairs (56) + 8x2 attributes (64)
      out.height = [s.f32(), s.f32()]; // male, female
      out.weight = [s.f32(), s.f32()];
      const flags = s.u32();
      out.playable = (flags & 1) !== 0;
      out.beast = (flags & 2) !== 0;
    }
  }
  return out;
}

export const NPC_FLAG = Object.freeze({ female: 0x01, essential: 0x02, respawn: 0x04, autocalc: 0x10 });

function decodeNpc(rec) {
  const out = {
    id: null, name: null, model: null, race: null, cls: null, faction: null,
    head: null, hair: null, female: false, autocalc: false, level: 0,
  };
  for (const sub of subrecords(rec.data)) {
    if (sub.type === 'NAME') out.id = subString(sub.data).toLowerCase();
    else if (sub.type === 'FNAM') out.name = subString(sub.data);
    else if (sub.type === 'MODL') out.model = subString(sub.data);
    else if (sub.type === 'RNAM') out.race = subString(sub.data).toLowerCase();
    else if (sub.type === 'CNAM') out.cls = subString(sub.data);
    else if (sub.type === 'ANAM') out.faction = subString(sub.data);
    else if (sub.type === 'BNAM') out.head = subString(sub.data).toLowerCase();
    else if (sub.type === 'KNAM') out.hair = subString(sub.data).toLowerCase();
    else if (sub.type === 'FLAG') {
      const f = new EsmStream(sub.data).u32();
      out.female = (f & NPC_FLAG.female) !== 0;
      out.autocalc = (f & NPC_FLAG.autocalc) !== 0;
    } else if (sub.type === 'NPDT') {
      // 52-byte full stats or 12-byte autocalc; level leads both.
      if (sub.data.byteLength !== 52 && sub.data.byteLength !== 12) {
        throw new Error(`NPC_ ${out.id}: NPDT is ${sub.data.byteLength} bytes`);
      }
      out.level = new EsmStream(sub.data).view.getInt16(0, true);
    }
  }
  return out;
}

function decodeCreature(rec) {
  const out = { id: null, name: null, model: null };
  for (const sub of subrecords(rec.data)) {
    if (sub.type === 'NAME') out.id = subString(sub.data).toLowerCase();
    else if (sub.type === 'FNAM') out.name = subString(sub.data);
    else if (sub.type === 'MODL') out.model = subString(sub.data);
  }
  return out;
}

const DECODERS = { BODY: decodeBody, RACE: decodeRace, NPC_: decodeNpc, CREA: decodeCreature };

/**
 * Parse a TES3 .esm/.esp. Decodes the character-assembly record set into
 * id-keyed maps; every other type is skipped by size and CENSUSED.
 * @param {Uint8Array} bytes
 * @returns {{header: {version:number, company:string, description:string,
 *   declaredRecords:number}, bodies:Map, races:Map, npcs:Map,
 *   creatures:Map, skipped:Map<string,number>, recordCount:number}}
 */
export function parseEsm(bytes) {
  if (!(bytes instanceof Uint8Array)) throw new TypeError('parseEsm expects a Uint8Array');
  const s = new EsmStream(bytes);
  const out = {
    header: null,
    bodies: new Map(),
    races: new Map(),
    npcs: new Map(),
    creatures: new Map(),
    skipped: new Map(),
    recordCount: 0,
  };
  while (s.pos + 16 <= bytes.byteLength) {
    const type = s.tag();
    const size = s.u32();
    s.u32(); // unknown
    const flags = s.u32();
    if (s.pos + size > bytes.byteLength) throw new Error(`record ${type} overruns the file`);
    const data = bytes.subarray(s.pos, s.pos + size);
    s.pos += size;
    out.recordCount++;

    if (type === 'TES3') {
      for (const sub of subrecords(data)) {
        if (sub.type !== 'HEDR') continue;
        const h = new EsmStream(sub.data);
        out.header = {
          version: h.f32(),
          fileType: h.u32(),
          company: h.zstring(32),
          description: h.zstring(256),
          declaredRecords: h.u32(),
        };
      }
      continue;
    }
    const decoder = DECODERS[type];
    if (!decoder) {
      out.skipped.set(type, (out.skipped.get(type) ?? 0) + 1);
      continue;
    }
    if (flags & 0x0020) continue; // deleted
    const rec = decoder({ data });
    if (!rec.id) throw new Error(`${type} record without NAME at ${s.pos - size - 16}`);
    const map = { BODY: out.bodies, RACE: out.races, NPC_: out.npcs, CREA: out.creatures }[type];
    map.set(rec.id, rec);
  }
  if (!out.header) throw new Error('parseEsm: no TES3 header record');
  return out;
}
