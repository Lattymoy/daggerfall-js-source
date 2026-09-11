// TI2 (2026-09-11): the home-screen icons, drawn here and committed
// under public/icons/ so the manifest has something to point at. No
// image library - a PNG is a zlib stream of filtered rows and a CRC,
// and Node has both. The mark is the landing page's night: the
// enhanced skin's ink ground, its brass, a pixel star field seeded
// the way pixelGround seeds its own, and a bone-white 'D' in blocks.
// Re-run: node scripts/makeIcons.mjs
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';

const INK = [0x0e, 0x10, 0x13], BRASS = [0xc0, 0x8a, 0x3e], BONE = [0xe9, 0xe4, 0xd9], SLATE = [0x17, 0x1b, 0x21];

function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(size, pixel) {
  const raw = Buffer.alloc((size * 3 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 3 + 1)] = 0;   // filter: none
    for (let x = 0; x < size; x++) {
      const [r, g, b] = pixel(x, y);
      const o = y * (size * 3 + 1) + 1 + x * 3;
      raw[o] = r; raw[o + 1] = g; raw[o + 2] = b;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;   // 8-bit RGB
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

// The 'D' on a 12x12 block grid, 1 = bone.
const D = [
  '111111110000',
  '111111111100',
  '111000001110',
  '111000000111',
  '111000000111',
  '111000000111',
  '111000000111',
  '111000000111',
  '111000000111',
  '111000001110',
  '111111111100',
  '111111110000',
];
// a small deterministic star field (an LCG, the same shape pixelGround uses)
let seed = 0x5eed;
const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
const stars = [];
for (let i = 0; i < 90; i++) stars.push([rnd(), rnd() * 0.55, rnd() < 0.2 ? 2 : 1]);

function mark(size, { maskable = false } = {}) {
  const pad = maskable ? 0.2 : 0.1;   // maskable: the safe zone is the inner 80%
  const inner = size * (1 - 2 * pad), off = size * pad;
  return png(size, (x, y) => {
    // the ground: ink up top fading to slate at the horizon line
    const t = y / size;
    let c = t > 0.78 ? SLATE : INK;
    for (const [sx, sy, r] of stars) {
      const px = sx * size, py = sy * size;
      if (Math.abs(x - px) < r && Math.abs(y - py) < r) c = t < 0.3 ? BONE : BRASS;
    }
    // the brass horizon
    if (y >= size * 0.78 - Math.max(1, size / 96) && y < size * 0.78) c = BRASS;
    // the D
    const gx = Math.floor((x - off) / (inner / 12)), gy = Math.floor((y - off) / (inner / 12));
    if (gx >= 0 && gx < 12 && gy >= 0 && gy < 12 && D[gy][gx] === '1') c = BONE;
    return c;
  });
}

mkdirSync('public/icons', { recursive: true });
writeFileSync('public/icons/icon-192.png', mark(192));
writeFileSync('public/icons/icon-512.png', mark(512));
writeFileSync('public/icons/icon-512-maskable.png', mark(512, { maskable: true }));
console.log('wrote public/icons/icon-192.png, icon-512.png, icon-512-maskable.png');
