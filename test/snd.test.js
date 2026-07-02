import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { SndFile, SAMPLE_RATE } from '../src/formats/sndFile.js';
import { DIRECTORY_TYPES } from '../src/formats/bsaFile.js';

const ARENA2 = process.env.ARENA2_PATH;
const skipReal = !ARENA2 || !existsSync(ARENA2)
  ? 'ARENA2_PATH not set or missing - real-data validation skipped'
  : false;

// ---------------------------------------------------------------------------
// Synthetic - always run.
// ---------------------------------------------------------------------------

function buildNumberBsa(records) {
  const dataSize = records.reduce((n, r) => n + r.bytes.length, 0);
  const out = new Uint8Array(4 + dataSize + 8 * records.length);
  const view = new DataView(out.buffer);
  view.setInt16(0, records.length, true);
  view.setUint16(2, DIRECTORY_TYPES.NumberRecord, true);
  let pos = 4;
  for (const r of records) {
    out.set(r.bytes, pos);
    pos += r.bytes.length;
  }
  for (const r of records) {
    view.setUint32(pos, r.id, true);
    view.setInt32(pos + 4, r.bytes.length, true);
    pos += 8;
  }
  return out;
}

test('snd: synthesized PCM header is byte-exact', () => {
  const pcm = new Uint8Array([128, 130, 126, 128]);
  const s = new SndFile();
  assert.equal(s.load(buildNumberBsa([{ id: 3, bytes: pcm }])), true);
  assert.equal(SAMPLE_RATE, 11025);

  const snd = s.getSound(0);
  assert.equal(snd.name, '3');
  assert.deepEqual(snd.waveData, pcm);

  const h = snd.waveHeader;
  const v = new DataView(h.buffer);
  assert.equal(String.fromCharCode(...h.slice(0, 4)), 'RIFF');
  assert.equal(v.getInt32(4, true), 4 + 36); // fileLength
  assert.equal(String.fromCharCode(...h.slice(8, 12)), 'WAVE');
  assert.equal(String.fromCharCode(...h.slice(12, 16)), 'fmt ');
  assert.equal(v.getInt32(16, true), 16); // fmt length
  assert.equal(v.getInt16(20, true), 1); // PCM
  assert.equal(v.getInt16(22, true), 1); // mono
  assert.equal(v.getInt32(24, true), 11025); // sample rate
  assert.equal(v.getInt32(28, true), 11025); // avg bytes/sec
  assert.equal(v.getInt16(32, true), 1); // block align
  assert.equal(v.getInt16(34, true), 8); // bits per sample
  assert.equal(String.fromCharCode(...h.slice(36, 40)), 'data');
  assert.equal(v.getInt32(40, true), 4); // data length

  // Stream concatenates header + data; cache returns the same object.
  const stream = s.getStream(0);
  assert.equal(stream.length, 44 + 4);
  assert.deepEqual(Array.from(stream.slice(44)), Array.from(pcm));
  assert.equal(s.getSound(0), snd);

  assert.equal(s.getSound(-1), null);
  assert.equal(s.getStream(99), null);
  assert.equal(s.isValidIndex(0), true);
  assert.equal(s.isValidIndex(1), false);
  assert.equal(s.getRecordIndex(3), 0);
  assert.equal(s.getRecordIndex(4), -1);
});

// ---------------------------------------------------------------------------
// Real ARENA2 data.
// ---------------------------------------------------------------------------

test('snd: DAGGER.SND full corpus with header consistency', { skip: skipReal }, () => {
  const s = new SndFile();
  assert.equal(s.load(new Uint8Array(readFileSync(join(ARENA2, 'DAGGER.SND')))), true);
  assert.equal(s.count, 459);

  let totalBytes = 0;
  const zeroLength = [];
  for (let i = 0; i < s.count; i++) {
    const snd = s.getSound(i);
    assert.ok(snd, `sound ${i}`);
    totalBytes += snd.waveData.length;
    if (snd.waveData.length === 0) zeroLength.push(i);
    const v = new DataView(snd.waveHeader.buffer);
    assert.equal(v.getInt32(4, true), snd.waveData.length + 36, `sound ${i} fileLength`);
    assert.equal(v.getInt32(40, true), snd.waveData.length, `sound ${i} dataLength`);
  }

  // Pinned corpus totals from the original data. Record 5 ships with zero
  // bytes of PCM - a real data quirk, still a valid (silent) record.
  assert.equal(totalBytes, 7658090);
  assert.deepEqual(zeroLength, [5]);
});

test('snd: pinned records and id lookup', { skip: skipReal }, () => {
  const s = new SndFile();
  s.load(new Uint8Array(readFileSync(join(ARENA2, 'DAGGER.SND'))));

  const s0 = s.getSound(0);
  assert.equal(s0.name, '3');
  assert.equal(s0.waveData.length, 39363);

  const s3 = s.getSound(3);
  assert.equal(s3.name, '6');
  assert.equal(s3.waveData.length, 2259);
  assert.equal(s3.waveData.reduce((a, b) => a + b, 0), 290579);
  assert.equal(s.getRecordIndex(6), 3);

  const stream = s.getStream(3);
  assert.equal(stream.length, 44 + 2259);
  assert.equal(String.fromCharCode(...stream.slice(0, 4)), 'RIFF');
  assert.equal(String.fromCharCode(...stream.slice(8, 12)), 'WAVE');
});
