// Data source: the pure key rule. The canonical ARENA2 key is the
// UPPERCASE basename - real ARENA2 ships uppercase, user-picked
// folders vary in case and carry directory prefixes.
import { test } from 'node:test';
import assert from 'node:assert';
import { normalizeName } from '../src/scenes/dataSource.js';

test('normalizeName: uppercase basename across path styles', () => {
  assert.equal(normalizeName('body00i0.img'), 'BODY00I0.IMG');
  assert.equal(normalizeName('ARENA2/texture.001'), 'TEXTURE.001');
  assert.equal(normalizeName('C:\\games\\DF\\ARENA2\\Arch3D.BSA'), 'ARCH3D.BSA');
  assert.equal(normalizeName('MAPS.BSA'), 'MAPS.BSA');
});

// readZip: the mobile ingest path. A crafted zip exercises every
// branch: method 0 (store), method 8 (deflate-raw), the arena2/
// prefix filter dropping siblings, directory entries skipped, and
// byte-exact round-trips both ways.
import { deflateRawSync } from 'node:zlib';
import { readZip } from '../src/scenes/dataSource.js';

function craftZip(files) {   // files: [{ name, data (Buffer), store? }]
  const locals = [], centrals = [];
  let off = 0;
  for (const f of files) {
    const isDir = f.name.endsWith('/');
    const raw = isDir ? Buffer.alloc(0) : f.data;
    const comp = isDir || f.store ? raw : deflateRawSync(raw);
    const method = isDir || f.store ? 0 : 8;
    const name = Buffer.from(f.name);
    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0);
    lh.writeUInt16LE(method, 8);
    lh.writeUInt32LE(comp.length, 18);
    lh.writeUInt32LE(raw.length, 22);
    lh.writeUInt16LE(name.length, 26);
    locals.push(lh, name, comp);
    const ch = Buffer.alloc(46);
    ch.writeUInt32LE(0x02014b50, 0);
    ch.writeUInt16LE(method, 10);
    ch.writeUInt32LE(comp.length, 20);
    ch.writeUInt32LE(raw.length, 24);
    ch.writeUInt16LE(name.length, 28);
    ch.writeUInt32LE(off, 42);
    centrals.push(ch, name);
    off += 30 + name.length + comp.length;
  }
  const central = Buffer.concat(centrals);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(files.length, 8);
  eocd.writeUInt16LE(files.length, 10);
  eocd.writeUInt32LE(central.length, 12);
  eocd.writeUInt32LE(off, 16);
  return Buffer.concat([...locals, central, eocd]);
}
const asFile = (buf) => ({ arrayBuffer: async () => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) });

test('readZip: store + deflate round-trip, arena2/ filter, dirs skipped', async () => {
  const pal = Buffer.from([1, 2, 3, 4, 250, 251]);
  const bsa = Buffer.from('MAPS-BYTES-'.repeat(40));   // compressible
  const zip = craftZip([
    { name: 'arena2/', data: Buffer.alloc(0) },
    { name: 'arena2/art_pal.col', data: pal, store: true },
    { name: 'arena2/MAPS.BSA', data: bsa },
    { name: 'DAGGER/SETUP.EXE', data: Buffer.from('junk') },   // sibling: filtered
  ]);
  const entries = await readZip(asFile(zip));
  const keys = entries.map(([k]) => k).sort();
  assert.deepEqual(keys, ['ART_PAL.COL', 'MAPS.BSA']);          // filter + no dirs
  const byKey = Object.fromEntries(entries);
  assert.equal(Buffer.compare(Buffer.from(byKey['ART_PAL.COL']), pal), 0);   // store path byte-exact
  assert.equal(Buffer.compare(Buffer.from(byKey['MAPS.BSA']), bsa), 0);      // deflate path byte-exact
  // no arena2/ folder present -> every flat entry ingests
  const flat = craftZip([{ name: 'texture.001', data: pal, store: true }]);
  const e2 = await readZip(asFile(flat));
  assert.deepEqual(e2.map(([k]) => k), ['TEXTURE.001']);
});
