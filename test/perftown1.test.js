// PERF-TOWN1 (2026-09-20, Mac: "the exterior is really heavy rn", and
// then "I'd rather not keep testing and go ahead and make performance
// improvements").
//
// WHAT THE READOUT SAID. `?perf=cpu`, outside, over seven lines:
//
//   cpu 19.12ms | world 8.51 | people 7.36 | sim 2.06 | flats 0.51 ...
//   cpu  9.30ms | sim 2.54 | world 2.45 | people 1.90 | flats 1.10 ...
//
// The frame is CPU-BOUND - nine to nineteen milliseconds of JavaScript
// against a ~19.7 ms frame - so no filtering term can be the cause,
// which is the question that was actually asked. And `people` swings
// 1.14 to 7.36 while `sim` sits at 2-3.
//
// A ZONE THAT VARIES FOURFOLD FRAME TO FRAME IS NOT DOING FOUR TIMES
// THE WORK. It is minting garbage and meeting the collector. The town
// loop minted about THIRTEEN objects per person per frame - two keys,
// four for the billboard size, a size, an origin, an activation row, a
// stop-options object, a closure, a frame record and a row to carry it
// - none of which outlived the frame. At sixty townspeople and sixty
// frames that is forty thousand allocations a second from one loop.
//
// These pins hold the seams that removed them. They are deliberately
// about IDENTITY and RE-READING rather than about speed: a timing
// assertion on a shared runner is what broke this repo's deploy the
// same afternoon (STREAM1), and "no new object" is the claim that
// actually made the frame cheaper.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mobileBillboardSize } from '../src/world/rmbFlats.js';
import { MobilePerson } from '../src/characters/mobilePerson.js';
import { CityNavigation } from '../src/world/cityNavigation.js';

const src = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const HOSTS = ['src/scenes/world.js', 'src/scenes/exterior.js'];

test('PERF-TOWN1: a sprite does not change size while you watch it - the size is cached per texture', () => {
  // `getSize` and `getScale` each mint a record and `scaledBillboardSize`
  // mints a third, for arithmetic that cannot answer differently for the
  // same texture and the same record.
  let sizeCalls = 0, scaleCalls = 0;
  const tex = {
    archive: 385,
    getSize() { sizeCalls++; return { width: 64, height: 100 }; },
    getScale() { scaleCalls++; return { width: 0, height: 0 }; },
  };
  const a = mobileBillboardSize(tex, 3);
  const b = mobileBillboardSize(tex, 3);
  assert.equal(sizeCalls, 1, 'the file is read once for that record');
  assert.equal(scaleCalls, 1);
  assert.equal(a, b, 'and the SAME record comes back - no allocation on the second call');
  assert.ok(a.w > 0 && a.h > 0);
  // a different record is its own entry
  mobileBillboardSize(tex, 4);
  assert.equal(sizeCalls, 2);
  mobileBillboardSize(tex, 4);
  assert.equal(sizeCalls, 2);

  // A REPLACEMENT THAT SWAPS THE FILE IN IS A DIFFERENT OBJECT, and so
  // gets a different entry: the cache is keyed on the texture itself,
  // which is why there is nothing to invalidate. Keying on the archive
  // NUMBER would have needed an invalidation seam and would have gone
  // stale the first time a pack replaced a sprite with a bigger one.
  const swapped = { archive: 385, getSize: () => ({ width: 128, height: 200 }), getScale: () => ({ width: 0, height: 0 }) };
  const c = mobileBillboardSize(swapped, 3);
  assert.notEqual(c, a);
  assert.ok(c.w > a.w, 'the new file is measured, not the old answer reused');

  // and the cache must not be a Map that pins every texture it has ever
  // seen in memory
  assert.match(src('src/world/rmbFlats.js'), /const _mobileSize = new WeakMap\(\);/);
  // the XML scale stays LIVE - it reads a per-vendor predicate, so a mod
  // toggled in the settings menu has to be seen on the next frame
  assert.match(src('src/world/rmbFlats.js'), /return textureReplacementEnabled\(\) \? applyBillboardXml\(t\?\.archive, record, size\) : size;/);
});

test('PERF-TOWN1: a person answers into its OWN row, and the pool refills one list', () => {
  const nav = new CityNavigation(1, 1);
  nav.setBlockData(0, 0, new Uint8Array(64 * 64), () => 2);
  const p = new MobilePerson(nav, { archive: 385, frameCount: () => 4, groundY: () => 0, rand: () => 0.5 });
  p.place(30, 30);
  const a = p.update(1 / 60, [0, 0, 0], false);
  const b = p.update(1 / 60, [0, 0, 0], false);
  assert.equal(a, b, 'the same record, written through - the caller reads three fields and drops them');
  assert.ok(Number.isInteger(b.record) && Number.isInteger(b.frame) && typeof b.flip === 'boolean');
  // ONE ROW PER PERSON, not one shared by all of them: the host collects
  // every row first and reads them afterwards, so a single shared record
  // would give every person the last one's frame.
  const q = new MobilePerson(nav, { archive: 385, frameCount: () => 4, groundY: () => 0, rand: () => 0.5 });
  q.place(40, 40);
  assert.notEqual(q.update(1 / 60, [0, 0, 0], false), b, 'two people, two rows');
  assert.match(src('src/systems/townPopulation.js'), /const out = this\._live \?\?= \[\];\s*\n\s*out\.length = 0;/,
    'and the LIST is the pool’s own, refilled rather than rebuilt');
});

test('PERF-TOWN1: both outdoor hosts stopped minting per person per frame', () => {
  for (const f of HOSTS) {
    const s = src(f);
    // the activation rows and the batch's two vectors are written
    // through - all three are read within the frame and held by nothing
    assert.match(s, /const _personSeat = \(i\) => \(_personSeats\[i\] \?\?= \{ person: null, pos: null \}\);/, f);
    assert.match(s, /_livePersons\.length = 0;/, f);
    assert.doesNotMatch(s, /_livePersons = live\.map\(/, `${f} still rebuilds the activation list`);
    assert.match(s, /bs\.w = out\.flip \? -sz\.w : sz\.w; bs\.h = sz\.h;/, `${f} writes the size through`);
    // the stop question's options and its closure are hoisted
    assert.match(s, /return personWantsToStop\(_stopOpts\);/, f);
    assert.doesNotMatch(s, /\(person\) => personWantsToStop\(\{/, `${f} still mints the options per person`);
    // hypot is written to survive overflow at the extremes of the float
    // range; these are two world coordinates a few hundred units apart
    assert.match(s, /Math\.sqrt\(dx \* dx \+ dz \* dz\)/, f);
    assert.doesNotMatch(s, /distanceToPlayer: Math\.hypot\(/, `${f} still calls hypot per person`);
    // the texture key is memoised on the three numbers it is made of
    assert.match(s, /const personTextureKey = \(archive, record, frame\) => \{/, f);
    assert.match(s, /renderer\.textures\.has\(personTextureKey\(person\.archive, out\.record, out\.frame\)\)/, f);
    // ...and the key it builds is the one the uploader wrote, or every
    // frame would miss the cache and re-upload
    assert.match(s, /v = `\$\{archive\}_\$\{record\}#\$\{frame\}`;/, f);
    // ...and the index it memoises on carries all THREE fields. Drop
    // the frame and a walking sprite keeps the first frame's key for
    // ever: the `.has()` answers true, the upload never runs again, and
    // the animation freezes on whatever was uploaded first. The pin has
    // to be on the host's own line, because the widths are the fields.
    assert.match(s, /const k = \(archive \* 4096 \+ record\) \* 1024 \+ frame;/, f);
    // MAC4's shape is untouched: the record still CARRIES its frame
    assert.match(s, /const rkey = `\$\{out\.record\}#\$\{out\.frame\}`;/, f);
  }
});

test('PERF-TOWN1: the memoised texture key is byte-for-byte the one the uploader writes', () => {
  // The whole win is a cache HIT. A key that differs from the uploaded
  // one by so much as a separator would miss every frame and re-upload
  // every frame - slower than what it replaced, and invisible.
  const key = (archive, record, frame) => `${archive}_${record}#${frame}`;
  assert.equal(key(385, 2, 3), '385_2#3');
  // the same string the old two-step built
  const rkey = (record, frame) => `${record}#${frame}`;
  assert.equal(`${385}_${rkey(2, 3)}`, key(385, 2, 3));
  // AND THE NUMERIC INDEX IS INJECTIVE - over its FIELDS, which is the
  // honest claim and not "over all integers". Packing is positional:
  // 1024 frames to a record, 4096 records to an archive, and a record
  // of 4096 really would land on the next archive's slot. That is what
  // a field width is; a classic archive has tens of records and a
  // handful of frames, so the widths are three orders clear of the art.
  const R = 4096, F = 1024;
  const idx = (a, r, f) => (a * R + r) * F + f;
  assert.notEqual(idx(385, 2, 3), idx(385, 3, 2), 'record and frame cannot swap');
  assert.notEqual(idx(385, 0, 0), idx(384, 0, 0), 'nor can the archive slide into the record');
  // no two distinct triples inside the fields share a slot
  const seen = new Set();
  for (const a of [0, 1, 385, 511]) {
    for (const r of [0, 1, 63, R - 1]) {
      for (const f of [0, 1, 31, F - 1]) {
        const k = idx(a, r, f);
        assert.ok(!seen.has(k), `${a}/${r}/${f} collided`);
        seen.add(k);
      }
    }
  }
  assert.equal(seen.size, 4 * 4 * 4);
  assert.ok(Number.isSafeInteger(idx(1000, R - 1, F - 1)), 'and the widest key is still an exact integer');
});
