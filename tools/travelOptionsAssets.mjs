// TO1: THE THREE TEXTURES, OUT OF THE MOD'S OWN BUNDLE.
//
// Travel Options ships one file - `traveloptions.dfmod`, a Unity
// 2019.4.40f1 AssetBundle - and the PNGs it was built from are not in
// it: the bundle carries them as Texture2D objects in RGB24. The three
// under `vendor/travel-options/Textures/` are therefore RE-ENCODES: the
// author's pixels, this encoder's bytes (vendor/travel-options/
// README.md says so in as many words, and test/vendorIntegrity.test.js
// pins the re-encodes' hashes).
//
// This script is what reproduces them, so the claim is checkable by
// anyone holding the shipped zip rather than taken on trust:
//
//   node tools/travelOptionsAssets.mjs <path-to>/traveloptions.dfmod [outDir]
//
// Default outDir is vendor/travel-options/Textures. It also prints the
// bundle's five text assets' sizes, which is how the vendored
// modsettings.json / modpresets.json / CSV were taken.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { readUnityBundle } from '../src/formats/unityBundle.js';

const CRC = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c; }
  return t;
})();
const crc32 = (buf) => { let c = -1; for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ -1) >>> 0; };

/** A minimal RGBA8 PNG: one IHDR, one deflated IDAT of filter-0 rows, one IEND. */
export function encodePng(w, h, rgba) {
  const stride = w * 4;
  const raw = Buffer.alloc((stride + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (stride + 1)] = 0;   // filter type 0 (None)
    Buffer.from(rgba.buffer, rgba.byteOffset + y * stride, stride).copy(raw, y * (stride + 1) + 1);
  }
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
    return Buffer.concat([len, td, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;    // bit depth
  ihdr[9] = 6;    // colour type 6 = RGBA
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0)),
  ]);
}

const bundlePath = process.argv[2];
if (!bundlePath) {
  console.error('usage: node tools/travelOptionsAssets.mjs <traveloptions.dfmod> [outDir]');
  process.exit(2);
}
const outDir = process.argv[3] ?? fileURLToPath(new URL('../vendor/travel-options/Textures', import.meta.url));
const bundle = readUnityBundle(new Uint8Array(readFileSync(bundlePath)));
mkdirSync(outDir, { recursive: true });

for (const t of bundle.textAssets) console.log(`text asset ${t.name.padEnd(24)} ${t.bytes.length} bytes`);
for (const t of bundle.textures) {
  const img = t.rgba();   // decodeTexture2D returns { width, height, data } top-down
  const png = encodePng(img.width, img.height, img.data);
  const file = `${outDir}/${t.name}.png`;
  writeFileSync(file, png);
  console.log(`${t.name.padEnd(24)} ${img.width}x${img.height} format ${t.format}  sha256 ${createHash('sha256').update(png).digest('hex')}  -> ${file}`);
}
