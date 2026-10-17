// CSA-A (2026-09-27) - COME SAIL AWAY'S SOUNDS: the FSB5 Vorbis remux
// (tools/lib/fsb5Vorbis.mjs) and what it wrote (vendor/come-sail-away/Sounds/).
// The five played clips are the bundle's own Vorbis packets in a rebuilt Ogg
// stream, so the pins are the container's: the setup headers are the ones
// their CRC32 names and parse to their modes, a bank is read as vgmstream
// lays it out, a packet's granule follows its mode's block size, and every
// vendored file's pages check, carry the vendored setup and end on the clip's
// own sample count. (The PCM was compared against libvorbis's own remux of
// the same banks in Chromium's decoder on 2026-09-27: identical, sample for
// sample - bible/03-World/Come-Sail-Away.md.)

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import zlib from 'node:zlib';
import {
  readFsb5, fsb5VorbisPackets, parseVorbisSetup, fsb5ToOgg, oggCrc, ilog, vorbisIdHeader,
  FSB5_CODEC, FSB5_CHUNK, REMUX_VENDOR, REMUX_SERIAL,
} from '../../tools/lib/fsb5Vorbis.mjs';
import { PLAYED_CLIPS } from '../../tools/comeSailAwayExtract.mjs';

const SETUPS = new URL('../../vendor/vorbis-fsb-setups/', import.meta.url);
const SOUNDS = new URL('../../vendor/come-sail-away/Sounds/', import.meta.url);
const setup = (crc) => new Uint8Array(readFileSync(new URL(`setup_${crc}.bin`, SETUPS)));

/** Every page of an Ogg stream, checked, and its packets reassembled. */
function readOgg(bytes) {
  const pages = [];
  const packets = [];
  let o = 0, pending = [];
  while (o < bytes.length) {
    assert.equal(String.fromCharCode(...bytes.subarray(o, o + 4)), 'OggS', `a page starts at ${o}`);
    const v = new DataView(bytes.buffer, bytes.byteOffset + o);
    const segs = bytes[o + 26];
    const lacing = [...bytes.subarray(o + 27, o + 27 + segs)];
    const bodyLen = lacing.reduce((a, b) => a + b, 0);
    const page = bytes.slice(o, o + 27 + segs + bodyLen);
    const crc = new DataView(page.buffer).getUint32(22, true);
    page[22] = page[23] = page[24] = page[25] = 0;
    assert.equal(oggCrc(page), crc, `page ${pages.length}'s checksum`);
    const granule = v.getBigUint64(6, true);
    pages.push({ flags: bytes[o + 5], granule, serial: v.getUint32(14, true), seq: v.getUint32(18, true), lacing });
    let b = o + 27 + segs;
    for (const l of lacing) {
      pending.push(bytes.subarray(b, b + l));
      b += l;
      if (l < 255) {
        const n = pending.reduce((a, c) => a + c.length, 0);
        const p = new Uint8Array(n);
        let k = 0;
        for (const c of pending) { p.set(c, k); k += c.length; }
        packets.push({ data: p, page: pages.length - 1 });
        pending = [];
      }
    }
    o += 27 + segs + bodyLen;
  }
  assert.equal(pending.length, 0, 'no packet is left open at the end');
  return { pages, packets };
}

/** A one-sample FSB5 bank (version 1), the way vgmstream's fsb5.c reads one. */
function syntheticBank({ rateIndex, channels, numSamples, crc, packets }) {
  const data = [];
  for (const p of packets) data.push(p.length & 0xff, p.length >> 8, ...p);
  while (data.length % 32) data.push(0);
  const chunk = new Uint8Array(8);
  const cv = new DataView(chunk.buffer);
  cv.setUint32(0, (FSB5_CHUNK.VORBISDATA << 25) | (4 << 1) | 0, true);   // type, size 4, no more chunks
  cv.setUint32(4, crc, true);
  const headers = new Uint8Array(8 + chunk.length);
  const hv = new DataView(headers.buffer);
  const lo = 1 | (rateIndex << 1) | ((channels === 2 ? 1 : 0) << 5);   // chunks follow, rate, channels, data offset 0
  hv.setUint32(0, lo, true);
  hv.setUint32(4, numSamples << 2, true);
  headers.set(chunk, 8);
  const head = new Uint8Array(0x3c);
  const v = new DataView(head.buffer);
  head.set([0x46, 0x53, 0x42, 0x35]);   // FSB5
  v.setUint32(4, 1, true);
  v.setUint32(8, 1, true);
  v.setUint32(12, headers.length, true);
  v.setUint32(16, 0, true);
  v.setUint32(20, data.length, true);
  v.setUint32(24, FSB5_CODEC.VORBIS, true);
  const out = new Uint8Array(head.length + headers.length + data.length);
  out.set(head); out.set(headers, head.length); out.set(data, head.length + headers.length);
  return out;
}

test('CSA-A: each vendored setup header is the one its CRC32 names, and parses to its codebooks and its two modes - short and long - with the framing bit closing it', () => {
  const files = readdirSync(SETUPS).filter((f) => f.endsWith('.bin')).sort();
  assert.deepEqual(files, ['setup_8d00698d.bin', 'setup_d6e0bbd4.bin'], 'the two the played clips name, and no more');
  const want = { '8d00698d': [4020, 44], d6e0bbd4: [3771, 42] };
  for (const [crc, [size, books]] of Object.entries(want)) {
    const b = setup(crc);
    assert.equal(b.length, size);
    assert.equal((zlib.crc32(b) >>> 0).toString(16).padStart(8, '0'), crc);
    const s = parseVorbisSetup(b, 1);
    assert.equal(s.codebooks, books);
    assert.deepEqual(s.modes, [{ blockflag: 0, mapping: 0 }, { blockflag: 1, mapping: 1 }]);
    assert.ok(s.framingBit >= b.length * 8 - 8, 'the framing flag is in the packet\'s last byte');
    const unframed = b.slice();
    unframed[s.framingBit >> 3] &= ~(1 << (s.framingBit & 7));
    assert.throws(() => parseVorbisSetup(unframed, 1), /no framing bit/, 'a header whose framing flag is clear is refused');
    assert.throws(() => parseVorbisSetup(b.subarray(0, b.length - 64), 1), /past the packet|framing/, 'a cut header is refused, not half read');
  }
});

test('CSA-A: an FSB5 bank is read as vgmstream lays it out - the mode word\'s rate, channels, sample count and data offset, the VORBISDATA chunk\'s CRC, the u16-sized packets to the zero that ends them', () => {
  const pk = [[0x02, 1, 2], [0x00, 3], [0x02, 4, 5, 6]];
  const bank = syntheticBank({ rateIndex: 5, channels: 1, numSamples: 1234, crc: 0x8d00698d, packets: pk });
  const { version, codec, samples } = readFsb5(bank);
  assert.equal(version, 1);
  assert.equal(codec, FSB5_CODEC.VORBIS);
  assert.equal(samples.length, 1);
  const s = samples[0];
  assert.deepEqual([s.rate, s.channels, s.numSamples, s.dataOffset, s.vorbisCrc], [22050, 1, 1234, 0, 0x8d00698d]);
  assert.deepEqual(fsb5VorbisPackets(s.data).map((p) => [...p]), pk);
  assert.throws(() => readFsb5(new Uint8Array(64)), /not an FSB5/);
});

test('CSA-A: the remux lays the packets into Ogg pages - the id header alone and first, the comment and setup flushed after it, each packet\'s granule the samples its block adds ((previous + current) / 4, the first none), the last page\'s the bank\'s own count, its end-of-stream flag set (mutants: the granule step, the clamp)', () => {
  // mode bit 1 = long (2048), 0 = short (256): the packets' blocks are long, short, short, long, long
  const modes = [1, 0, 0, 1, 1];
  const packets = modes.map((m, i) => [m << 1, i + 1, 0xaa, 0x55]);
  const bank = syntheticBank({ rateIndex: 8, channels: 1, numSamples: 2000, crc: 0xd6e0bbd4, packets });
  const r = fsb5ToOgg(bank, (crc) => (crc === 0xd6e0bbd4 ? setup('d6e0bbd4') : null));
  assert.deepEqual([r.channels, r.rate, r.numSamples, r.packets], [1, 44100, 2000, 5]);
  const { pages, packets: out } = readOgg(r.ogg);
  assert.equal(pages[0].flags & 2, 2, 'beginning of stream');
  assert.equal(pages.at(-1).flags & 4, 4, 'end of stream');
  assert.ok(pages.every((p) => p.serial === REMUX_SERIAL));
  assert.deepEqual(pages.map((p) => p.seq), pages.map((_, i) => i));
  assert.equal(out[0].page, 0);
  assert.equal(pages[0].lacing.length, 1, 'the identification header rides alone');
  assert.deepEqual([...out[0].data], [...vorbisIdHeader(1, 44100)]);
  assert.equal(new TextDecoder().decode(out[1].data.subarray(11, 11 + REMUX_VENDOR.length)), REMUX_VENDOR);
  assert.deepEqual([...out[2].data], [...setup('d6e0bbd4')]);
  assert.ok(out[3].page > out[2].page, 'the headers are flushed before the audio');
  assert.deepEqual(out.slice(3).map((p) => [...p.data]), packets);
  // 0, then +(2048+256)/4, +(256+256)/4, +(256+2048)/4, +(2048+2048)/4 = 2304 - clamped to the bank's 2000
  assert.equal(pages.at(-1).granule, 2000n);
  // unclamped, and a sequence whose sum depends on which block is long: long, long, short, short, short -
  // 0, +(2048+2048)/4, +(2048+256)/4, +(256+256)/4, +(256+256)/4 = 1856 (the first packet adds nothing)
  const lls = syntheticBank({ rateIndex: 8, channels: 1, numSamples: 100000, crc: 0xd6e0bbd4, packets: [1, 1, 0, 0, 0].map((m, i) => [m << 1, i]) });
  assert.equal(readOgg(fsb5ToOgg(lls, () => setup('d6e0bbd4')).ogg).pages.at(-1).granule, 1856n);
  assert.throws(() => fsb5ToOgg(bank, () => null), /no setup header with CRC32 0xd6e0bbd4/);
  assert.equal(ilog(0), 0); assert.equal(ilog(1), 1); assert.equal(ilog(255), 8); assert.equal(ilog(256), 9);
});

test('CSA-A: the five vendored clips are the five ComeSailAway.Start loads, each a checked Ogg stream carrying the setup its bank named, its id header the clip\'s channels and rate, its last granule the clip\'s own sample count', () => {
  const meta = JSON.parse(readFileSync(new URL('sounds.json', SOUNDS), 'utf8'));
  assert.deepEqual(meta.map((m) => m.name), [...PLAYED_CLIPS]);
  assert.deepEqual(readdirSync(SOUNDS).filter((f) => f.endsWith('.ogg')).sort(), PLAYED_CLIPS.map((n) => `${n}.ogg`).sort());
  for (const m of meta) {
    const bytes = new Uint8Array(readFileSync(new URL(`${m.name}.ogg`, SOUNDS)));
    const { pages, packets } = readOgg(bytes);
    const id = packets[0].data;
    assert.equal(id[11], m.channels, `${m.name}: channels`);
    assert.equal(new DataView(id.buffer, id.byteOffset).getUint32(12, true), m.frequency, `${m.name}: rate`);
    assert.deepEqual([...packets[2].data], [...setup(m.setup)], `${m.name}: the setup its bank names`);
    assert.equal(pages.at(-1).granule, BigInt(m.samples), `${m.name}: ends on its own count`);
    assert.ok(Math.abs(m.samples / m.frequency - m.length) < 0.01, `${m.name}: the count is the clip's length (${m.length} s)`);
    let prev = -1n;
    for (const p of pages) if (p.granule !== 0xffffffffffffffffn) { assert.ok(p.granule >= prev, `${m.name}: granules never fall`); prev = p.granule; }
  }
});
