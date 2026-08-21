// FLATS.CFG - FlatsFile.cs (MIT, Daggerfall Workshop; original author
// Michael Rauter/Nystul), the port's TWELFTH format reader. A plain
// text config keyed by billboard, carrying the two things the port has
// been missing for every person in the world: the flat's CAPTION ("a
// young lady in green" - the quest macro =symbol_ resolves through it)
// and its FACE INDEX into TFAC00I0.RCI, which is the portrait the talk
// window draws.
//
// The format is BLOCKS separated by blank lines, six lines each:
//     <archive> <record>
//     <caption>
//     <gender>            "1" male, "2" female, a leading "?" meaning
//                         classic would censor the flat in ChildGard
//     <unknown2>
//     <unknown3>
//     <faceIndex>         index into TFAC00I0.RCI
//
// Two quirks are kept as written. The blank-line test runs on the RAW
// line and the trim happens AFTER it, so a line of spaces is NOT a
// block separator - it becomes an empty line inside the block and
// shifts every field below it. And a duplicate archive/record keeps
// the FIRST block: DFU's `if (!flatsDict.ContainsKey(flatID))` makes
// the first definition win, where a plain assignment would let the
// last one.

/** GetFlatID: the dictionary key is archive<<7 + record. Records run
 *  0..127, which is why seven bits. */
export const flatId = (archive, record) => (archive << 7) + record;

/** ReverseFlatID, verbatim. */
export const reverseFlatId = (id) => ({ archive: id >> 7, record: id & 0x7f });

export class FlatsFile {
  constructor() {
    /** @type {Map<number, {archive, record, caption, gender, unknown2, unknown3, faceIndex}>} */
    this.flats = new Map();
  }

  /**
   * @param {Uint8Array|string} bytes FLATS.CFG's contents
   * @param {string} [name] for the filename guard DFU applies
   */
  load(bytes, name = 'FLATS.CFG') {
    // Load(): `if (!filePath.EndsWith(Filename, InvariantCultureIgnoreCase)) return;`
    // - a wrong file is a silent no-op, not an error.
    if (!String(name).toUpperCase().endsWith('FLATS.CFG')) return this;
    const txt = typeof bytes === 'string' ? bytes : new TextDecoder().decode(bytes);
    this.flats.clear();

    // First pass: the blocks, in order.
    const blocks = [];
    let current = [];
    for (const raw of txt.split(/\r\n|\n|\r/)) {
      // IsNullOrEmpty on the RAW line - before the trim below.
      if (raw === '') {
        if (current.length) blocks.push(current);
        current = [];
        continue;
      }
      current.push(raw.trim());
    }
    if (current.length) blocks.push(current);

    // Second pass: parse each block; the FIRST definition of an
    // archive/record wins.
    for (const block of blocks) {
      const flat = parseFlatBlock(block);
      const id = flatId(flat.archive, flat.record);
      if (!this.flats.has(id)) this.flats.set(id, flat);
    }
    return this;
  }

  /** GetFlatData(flatID, out): the found/not-found form. */
  getFlatData(archive, record) {
    return this.flats.get(flatId(archive, record)) ?? null;
  }

  /** The caption the quest macro =symbol_ expands to, or null. */
  caption(archive, record) {
    return this.getFlatData(archive, record)?.caption ?? null;
  }

  /** The TFAC00I0.RCI portrait index for a billboard, or -1. */
  faceIndex(archive, record) {
    return this.getFlatData(archive, record)?.faceIndex ?? -1;
  }

  get count() { return this.flats.size; }
}

/** ParseFlatData, verbatim - including the six-line assumption and the
 *  two-part split that throws on anything else. A malformed CFG is a
 *  broken data set and says so here, the way the VID and FLIC readers
 *  do; the CONSUMERS carry the never-traps guard. */
function parseFlatBlock(block) {
  const parts = block[0].split(' ');
  if (parts.length !== 2) {
    throw new Error(`Invalid flat format for data ${block[0]}`);
  }
  if (block.length < 6) {
    throw new Error(`Invalid flat block for ${block[0]}: ${block.length} lines, expected 6`);
  }
  return {
    archive: parseIntStrict(parts[0]),
    record: parseIntStrict(parts[1]),
    caption: block[1],
    gender: block[2],
    unknown2: parseIntStrict(block[3]),
    unknown3: parseIntStrict(block[4]),
    faceIndex: parseIntStrict(block[5]),
  };
}

/** int.Parse: a value that is not a number THROWS - it does not answer
 *  NaN the way Number() would, and a silent NaN here would travel as a
 *  face index and pick a portrait at random. */
function parseIntStrict(value) {
  const s = String(value).trim();
  if (!/^[+-]?\d+$/.test(s)) throw new Error(`FLATS.CFG: "${value}" is not an integer`);
  return Number(s);
}

/** GENDER: "1" male, "2" female. A leading "?" marks a flat classic
 *  would censor in ChildGard mode - the port reads through it rather
 *  than dropping the flat, since ChildGard is not ported. */
export const flatGender = (gender) => {
  const g = String(gender ?? '').replace(/^\?/, '');
  return g === '2' ? 'female' : g === '1' ? 'male' : null;
};
export const flatCensored = (gender) => String(gender ?? '').startsWith('?');
