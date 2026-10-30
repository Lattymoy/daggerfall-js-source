// CSA-A (2026-09-27): A UNITY AUDIO CLIP'S FSB5 VORBIS, BACK TO AN OGG FILE -
// the packets untouched, only the container rebuilt.
//
// Unity imports an .ogg or .wav as Vorbis and stores it as an FMOD sound bank
// (FSB5) in the bundle's `.resource`, at the AudioClip's m_Resource offset.
// FMOD keeps the audio packets whole but drops the three Vorbis headers: the
// identification header's few numbers ride in the FSB5 sample header, the
// comment header is gone, and the setup header - the codebooks, several KB -
// is replaced by the CRC32 of it (the VORBISDATA chunk), since FMOD's encoder
// only ever writes a handful of them. So a clip comes back by:
//
//   1. the FSB5 container (vgmstream's `fsb5.c` layout): the header, the
//      sample's 64-bit mode word (rate index, channels, data offset, sample
//      count) and its chunks, of which VORBISDATA carries the setup's CRC;
//   2. the setup header whose CRC32 that is, supplied by the caller (the tool
//      vendors the three this mod needs - tools/data/fsb5-vorbis/);
//   3. the setup header PARSED to its mode table (Vorbis I, 4.2.4): each audio
//      packet's first bits name its mode, the mode's blockflag its block size
//      (256 or 2048, FMOD's), and a packet adds (previous + current) / 4
//      samples - which is what an Ogg page's granule position counts;
//   4. Ogg pages (RFC 3533): the identification header alone on the first
//      page, the comment and setup headers flushed on the next, then the
//      audio, a page closed once its body passes 4 KB, the last page's
//      granule the FSB5's own sample count (so a decoder trims the tail) and
//      its end-of-stream flag set.
//
// The output is a function of the input alone (a fixed serial number, a fixed
// vendor string), so the tool's files are byte-identical run to run.

const u32le = (b, o) => (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0;

/** FSB5's sample-rate index (the mode word's bits 1-4). */
export const FSB5_RATES = Object.freeze([4000, 8000, 11000, 11025, 16000, 22050, 24000, 32000, 44100, 48000, 96000]);
/** FSB5's codec numbers this reader knows. */
export const FSB5_CODEC = Object.freeze({ VORBIS: 15 });
/** FSB5's chunk types this reader reads (vgmstream fsb5.c). */
export const FSB5_CHUNK = Object.freeze({ CHANNELS: 1, FREQUENCY: 2, LOOP: 3, VORBISDATA: 11 });

/**
 * Read an FSB5 bank: its header and each sample's header and data.
 * @param {Uint8Array} b
 */
export function readFsb5(b) {
  if (String.fromCharCode(b[0], b[1], b[2], b[3]) !== 'FSB5') throw new Error('not an FSB5 bank');
  const version = u32le(b, 4);
  const count = u32le(b, 8);
  const headersSize = u32le(b, 12);
  const namesSize = u32le(b, 16);
  const dataSize = u32le(b, 20);
  const codec = u32le(b, 24);
  const base = version === 0 ? 0x40 : 0x3c;
  const dataStart = base + headersSize + namesSize;
  if (dataStart + dataSize > b.length)
    throw new Error(`FSB5: ${dataStart + dataSize} bytes declared, ${b.length} present`);
  const samples = [];
  let o = base;
  for (let i = 0; i < count; i++) {
    const lo = u32le(b, o),
      hi = u32le(b, o + 4);
    o += 8;
    const s = {
      rate: FSB5_RATES[(lo >>> 1) & 0x0f],
      channels: [1, 2, 6, 8][(lo >>> 5) & 0x03],
      dataOffset: (((hi & 0x03) << 25) | ((lo >>> 7) & 0x1ffffff)) * 32,
      numSamples: (hi >>> 2) & 0x3fffffff,
      loop: null,
      vorbisCrc: null,
    };
    if (lo & 1) {
      let more = 1;
      while (more) {
        const w = u32le(b, o);
        more = w & 1;
        const size = (w >>> 1) & 0xffffff;
        const type = (w >>> 25) & 0x7f;
        const at = o + 4;
        if (type === FSB5_CHUNK.CHANNELS) s.channels = b[at];
        else if (type === FSB5_CHUNK.FREQUENCY) s.rate = u32le(b, at);
        else if (type === FSB5_CHUNK.LOOP) s.loop = { start: u32le(b, at), end: size >= 8 ? u32le(b, at + 4) : null };
        else if (type === FSB5_CHUNK.VORBISDATA) s.vorbisCrc = u32le(b, at);
        o = at + size;
      }
    }
    samples.push(s);
  }
  for (let i = 0; i < samples.length; i++) {
    const end = i + 1 < samples.length ? samples[i + 1].dataOffset : dataSize;
    samples[i].data = b.subarray(dataStart + samples[i].dataOffset, dataStart + end);
  }
  return { version, codec, samples };
}

/** The audio packets of a sample's data: a u16 length, that many bytes; a zero length is padding and ends it. */
export function fsb5VorbisPackets(data) {
  const out = [];
  let o = 0;
  while (o + 2 <= data.length) {
    const n = data[o] | (data[o + 1] << 8);
    if (n === 0) break;
    if (o + 2 + n > data.length) throw new Error(`FSB5 Vorbis: a ${n}-byte packet at ${o} runs past the data`);
    out.push(data.subarray(o + 2, o + 2 + n));
    o += 2 + n;
  }
  return out;
}

// ---- the Vorbis setup header, to its mode table (Vorbis I, 4.2.4) ----------

/** The number of bits an unsigned value needs (the spec's ilog). */
export const ilog = (v) => {
  let n = 0;
  while (v > 0) {
    n++;
    v >>>= 1;
  }
  return n;
};

/** Vorbis reads its bits least significant first. */
class BitReader {
  constructor(b) {
    this.b = b;
    this.pos = 0;
  }
  read(n) {
    let v = 0;
    for (let i = 0; i < n; i++, this.pos++) {
      const byte = this.b[this.pos >> 3];
      if (byte === undefined) throw new Error('Vorbis setup: read past the packet');
      v += ((byte >> (this.pos & 7)) & 1) * 2 ** i;
    }
    return v;
  }
}

/** The greatest r with r^dimensions <= entries (the spec's lookup1_values). */
function lookup1Values(entries, dimensions) {
  let r = Math.floor(entries ** (1 / dimensions));
  while ((r + 1) ** dimensions <= entries) r++;
  while (r > 0 && r ** dimensions > entries) r--;
  return r;
}

/**
 * Parse a setup header far enough to know its modes: every codebook, floor,
 * residue and mapping is walked (the modes come last), and the framing bit
 * must close it.
 * @param {Uint8Array} setup the whole packet, `\x05vorbis` first
 * @param {number} channels the stream's (a mapping's coupling reads ilog(channels - 1) bits)
 * @returns {{ codebooks:number, floors:number, residues:number, mappings:number, modes: {blockflag:number, mapping:number}[], framingBit:number }}
 */
export function parseVorbisSetup(setup, channels) {
  if (setup[0] !== 5 || String.fromCharCode(...setup.subarray(1, 7)) !== 'vorbis')
    throw new Error('not a Vorbis setup header');
  const r = new BitReader(setup.subarray(7));
  const codebooks = r.read(8) + 1;
  for (let c = 0; c < codebooks; c++) {
    if (r.read(24) !== 0x564342) throw new Error(`Vorbis setup: codebook ${c} has no sync pattern`);
    const dimensions = r.read(16);
    const entries = r.read(24);
    if (r.read(1)) {
      // ordered
      let entry = 0;
      r.read(5);
      while (entry < entries) entry += r.read(ilog(entries - entry));
      if (entry > entries) throw new Error(`Vorbis setup: codebook ${c} orders past its entries`);
    } else {
      const sparse = r.read(1);
      for (let i = 0; i < entries; i++) if (!sparse || r.read(1)) r.read(5);
    }
    const lookup = r.read(4);
    if (lookup === 1 || lookup === 2) {
      r.read(32);
      r.read(32);
      const valueBits = r.read(4) + 1;
      r.read(1);
      const values = lookup === 1 ? lookup1Values(entries, dimensions) : entries * dimensions;
      for (let i = 0; i < values; i++) r.read(valueBits);
    } else if (lookup !== 0) throw new Error(`Vorbis setup: codebook ${c} lookup type ${lookup}`);
  }
  const times = r.read(6) + 1;
  for (let i = 0; i < times; i++)
    if (r.read(16) !== 0) throw new Error('Vorbis setup: a time-domain transform that is not 0');
  const floors = r.read(6) + 1;
  for (let f = 0; f < floors; f++) {
    const type = r.read(16);
    if (type === 0) {
      r.read(8);
      r.read(16);
      r.read(16);
      r.read(6);
      r.read(8);
      const books = r.read(4) + 1;
      for (let i = 0; i < books; i++) r.read(8);
    } else if (type === 1) {
      const partitions = r.read(5);
      const classList = [];
      let maxClass = -1;
      for (let i = 0; i < partitions; i++) {
        classList.push(r.read(4));
        maxClass = Math.max(maxClass, classList[i]);
      }
      const dims = [];
      for (let i = 0; i <= maxClass; i++) {
        dims.push(r.read(3) + 1);
        const subclasses = r.read(2);
        if (subclasses) r.read(8);
        for (let j = 0; j < 1 << subclasses; j++) r.read(8);
      }
      r.read(2);
      const rangeBits = r.read(4);
      for (let i = 0; i < partitions; i++) for (let j = 0; j < dims[classList[i]]; j++) r.read(rangeBits);
    } else throw new Error(`Vorbis setup: floor type ${type}`);
  }
  const residues = r.read(6) + 1;
  for (let i = 0; i < residues; i++) {
    const type = r.read(16);
    if (type > 2) throw new Error(`Vorbis setup: residue type ${type}`);
    r.read(24);
    r.read(24);
    r.read(24);
    const classifications = r.read(6) + 1;
    r.read(8);
    const cascade = [];
    for (let c = 0; c < classifications; c++) {
      const low = r.read(3);
      const high = r.read(1) ? r.read(5) : 0;
      cascade.push(high * 8 + low);
    }
    for (const bits of cascade) for (let j = 0; j < 8; j++) if (bits & (1 << j)) r.read(8);
  }
  const mappings = r.read(6) + 1;
  const chBits = ilog(channels - 1);
  for (let i = 0; i < mappings; i++) {
    if (r.read(16) !== 0) throw new Error('Vorbis setup: a mapping type that is not 0');
    const submaps = r.read(1) ? r.read(4) + 1 : 1;
    if (r.read(1)) {
      const steps = r.read(8) + 1;
      for (let s = 0; s < steps; s++) {
        r.read(chBits);
        r.read(chBits);
      }
    }
    if (r.read(2) !== 0) throw new Error("Vorbis setup: a mapping's reserved bits are set");
    if (submaps > 1) for (let c = 0; c < channels; c++) r.read(4);
    for (let s = 0; s < submaps; s++) {
      r.read(8);
      r.read(8);
      r.read(8);
    }
  }
  const modeCount = r.read(6) + 1;
  const modes = [];
  for (let i = 0; i < modeCount; i++) {
    const blockflag = r.read(1);
    if (r.read(16) !== 0 || r.read(16) !== 0)
      throw new Error('Vorbis setup: a mode whose window or transform is not 0');
    modes.push({ blockflag, mapping: r.read(8) });
  }
  const framingBit = 56 + r.pos; // the packet's bit the framing flag is
  if (r.read(1) !== 1) throw new Error('Vorbis setup: no framing bit after the modes');
  const left = setup.length * 8 - 56 - r.pos;
  if (left >= 8) throw new Error(`Vorbis setup: ${left} bits after the framing bit`);
  return { codebooks, floors, residues, mappings, modes, framingBit };
}

// ---- Ogg ---------------------------------------------------------------------

const OGG_CRC = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i << 24;
    for (let k = 0; k < 8; k++) c = c & 0x80000000 ? (c << 1) ^ 0x04c11db7 : c << 1;
    t[i] = c >>> 0;
  }
  return t;
})();
/** Ogg's page checksum: CRC-32, polynomial 0x04c11db7, unreflected, from 0. */
export function oggCrc(bytes) {
  let c = 0;
  for (let i = 0; i < bytes.length; i++) c = ((c << 8) ^ OGG_CRC[((c >>> 24) ^ bytes[i]) & 0xff]) >>> 0;
  return c >>> 0;
}

/** One Ogg page. @param {{ flags:number, granule:number, serial:number, seq:number, lacing:number[], body:Uint8Array }} p */
function oggPage({ flags, granule, serial, seq, lacing, body }) {
  const head = 27 + lacing.length;
  const page = new Uint8Array(head + body.length);
  const v = new DataView(page.buffer);
  page.set([0x4f, 0x67, 0x67, 0x53], 0); // OggS
  page[4] = 0;
  page[5] = flags;
  v.setBigUint64(6, BigInt(granule), true);
  v.setUint32(14, serial, true);
  v.setUint32(18, seq, true);
  page[26] = lacing.length;
  page.set(lacing, 27);
  page.set(body, head);
  v.setUint32(22, oggCrc(page), true);
  return page;
}

/**
 * Lay packets into pages. Each packet is `{ data, granule }`; a page closes
 * when the next segment would pass 255 lacing values, or once its body is
 * past `pageBody` bytes at a packet's end, or where `flushAfter` says. A page
 * that no packet ends on carries granule -1, as RFC 3533 asks.
 */
function oggPages(packets, { serial, pageBody = 4096, flushAfter = () => false, bos = true }) {
  const pages = [];
  let lacing = [],
    chunks = [],
    size = 0,
    granule = -1,
    continued = false,
    seq = 0;
  const close = (last) => {
    const body = new Uint8Array(size);
    let o = 0;
    for (const c of chunks) {
      body.set(c, o);
      o += c.length;
    }
    const flags = (continued ? 1 : 0) | (bos && seq === 0 ? 2 : 0) | (last ? 4 : 0);
    pages.push(
      oggPage({ flags, granule: granule < 0 ? 0xffffffffffffffffn : granule, serial, seq: seq++, lacing, body }),
    );
    lacing = [];
    chunks = [];
    size = 0;
    granule = -1;
  };
  packets.forEach((p, i) => {
    let off = 0;
    const n = p.data.length;
    continued = false;
    // a packet's lacing: 255s, then the remainder (0 when it is a multiple of 255)
    for (;;) {
      const seg = Math.min(255, n - off);
      if (lacing.length === 255) {
        close(false);
        continued = off > 0;
      }
      lacing.push(seg);
      chunks.push(p.data.subarray(off, off + seg));
      size += seg;
      off += seg;
      if (seg < 255) break;
    }
    granule = p.granule;
    const last = i === packets.length - 1;
    if (last) close(true);
    else if (flushAfter(i) || size >= pageBody) {
      close(false);
      continued = false;
    }
  });
  return pages;
}

/** The identification header FMOD dropped, from the FSB5 sample's own numbers. Bitrates unknown (0). */
export function vorbisIdHeader(channels, rate, short = 256, long = 2048) {
  const h = new Uint8Array(30);
  const v = new DataView(h.buffer);
  h[0] = 1;
  h.set([0x76, 0x6f, 0x72, 0x62, 0x69, 0x73], 1); // "vorbis"
  v.setUint32(7, 0, true);
  h[11] = channels;
  v.setUint32(12, rate, true);
  h[28] = ilog(short - 1) | (ilog(long - 1) << 4);
  h[29] = 1;
  return h;
}

/** A comment header with a vendor string and no comments. */
export function vorbisCommentHeader(vendor) {
  const vb = new TextEncoder().encode(vendor);
  const h = new Uint8Array(7 + 4 + vb.length + 4 + 1);
  const v = new DataView(h.buffer);
  h[0] = 3;
  h.set([0x76, 0x6f, 0x72, 0x62, 0x69, 0x73], 1);
  v.setUint32(7, vb.length, true);
  h.set(vb, 11);
  v.setUint32(11 + vb.length, 0, true);
  h[h.length - 1] = 1;
  return h;
}

export const REMUX_VENDOR = 'daggerfall-js FSB5 remux';
export const REMUX_SERIAL = 0x43534131; // "CSA1"

/**
 * An FSB5 Vorbis bank's first sample as an Ogg Vorbis file.
 * @param {Uint8Array} fsbBytes
 * @param {(crc:number) => Uint8Array|null} setupFor the setup header whose CRC32 is `crc`
 */
export function fsb5ToOgg(fsbBytes, setupFor) {
  const bank = readFsb5(fsbBytes);
  if (bank.codec !== FSB5_CODEC.VORBIS) throw new Error(`FSB5: codec ${bank.codec} is not Vorbis`);
  const s = bank.samples[0];
  if (s.vorbisCrc == null) throw new Error('FSB5: the sample carries no VORBISDATA chunk');
  const setup = setupFor(s.vorbisCrc);
  if (!setup) throw new Error(`FSB5: no setup header with CRC32 0x${s.vorbisCrc.toString(16).padStart(8, '0')}`);
  const { modes } = parseVorbisSetup(setup, s.channels);
  const modeBits = ilog(modes.length - 1);
  const audio = fsb5VorbisPackets(s.data);
  const packets = [
    { data: vorbisIdHeader(s.channels, s.rate), granule: 0 },
    { data: vorbisCommentHeader(REMUX_VENDOR), granule: 0 },
    { data: setup, granule: 0 },
  ];
  let prev = 0,
    granule = 0;
  for (const p of audio) {
    if (p[0] & 1) throw new Error('FSB5 Vorbis: an audio packet whose type bit is set');
    const mode = (p[0] >> 1) & ((1 << modeBits) - 1);
    if (mode >= modes.length) throw new Error(`FSB5 Vorbis: packet mode ${mode} of ${modes.length}`);
    const block = modes[mode].blockflag ? 2048 : 256;
    if (prev) granule += (prev + block) / 4;
    prev = block;
    packets.push({ data: p, granule });
  }
  // the last page ends where the clip does - a decoder trims the final block to it
  packets[packets.length - 1].granule = Math.min(granule, s.numSamples);
  const pages = oggPages(packets, { serial: REMUX_SERIAL, flushAfter: (i) => i === 0 || i === 2 });
  const out = new Uint8Array(pages.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of pages) {
    out.set(p, o);
    o += p.length;
  }
  return {
    ogg: out,
    channels: s.channels,
    rate: s.rate,
    numSamples: s.numSamples,
    packets: audio.length,
    crc: s.vorbisCrc,
  };
}
