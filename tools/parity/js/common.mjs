// Differential parity harness - shared JS helpers (AUDIT 18).
import { createHash } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import fs from 'node:fs';
import path from 'node:path';

export const ARENA2 = process.env.ARENA2_PATH || (process.env.ARENA2_PATH ?? '');
import { fileURLToPath as _f } from 'node:url';
import { dirname as _d, join as _j } from 'node:path';
// AUDIT 18: the port root derives from this file (tools/parity/js/), so the
// harness runs from any checkout. PORT_ROOT overrides it.
export const PORT = process.env.PORT_ROOT ?? _j(_d(_f(import.meta.url)), '..', '..', '..');

let chunks = [];
let stream = null;
export function openOut(file) {
  stream = createWriteStream(file);
  chunks = [];
}
export function out(key, val) {
  if (typeof val === 'boolean') val = val ? '1' : '0';
  chunks.push(key + '\t' + val + '\n');
  if (chunks.length >= 20000) { stream.write(chunks.join('')); chunks = []; }
}
export async function closeOut() {
  if (chunks.length) { stream.write(chunks.join('')); chunks = []; }
  await new Promise((res) => stream.end(res));
}

const f32 = new Float32Array(1);
const u32 = new Uint32Array(f32.buffer);
/** float32 bit pattern, identical encoding to the C# side. */
export function F(v) {
  f32[0] = v;
  return 'f' + u32[0].toString(16).padStart(8, '0');
}
const f64 = new Float64Array(1);
const bu = new BigUint64Array(f64.buffer);
export function D(v) {
  f64[0] = v;
  return 'd' + bu[0].toString(16).padStart(16, '0');
}
export function sha1(bytes) {
  if (bytes === null || bytes === undefined) return 'null';
  const h = createHash('sha1');
  h.update(Buffer.from(bytes.buffer ? bytes.buffer : bytes, bytes.byteOffset || 0, bytes.byteLength !== undefined ? bytes.byteLength : bytes.length));
  return h.digest('hex');
}
/** SHA-1 over an RGBA byte stream given as a Uint8ClampedArray of r,g,b,a. */
export function sha1Rgba(colors) {
  if (!colors) return 'null';
  return sha1(new Uint8Array(colors.buffer, colors.byteOffset, colors.byteLength));
}
export function S(s) {
  if (s === null || s === undefined) return '<null>';
  let r = '';
  for (const ch of String(s)) {
    const c = ch.codePointAt(0);
    if (ch === '\t') r += '\\t';
    else if (ch === '\n') r += '\\n';
    else if (ch === '\r') r += '\\r';
    else if (ch === '\\') r += '\\\\';
    else if (c < 32 || c > 126) r += '\\x' + c.toString(16).padStart(4, '0');
    else r += ch;
  }
  return r;
}
export function pad(n, w) { return String(n).padStart(w, '0'); }
export function read(name) { return new Uint8Array(fs.readFileSync(path.join(ARENA2, name))); }
export function files(re) {
  return fs.readdirSync(ARENA2).filter((f) => re.test(f)).sort();
}
/** Byte writer used to build deterministic checksum streams (matches C# BinaryWriter LE). */
export class BW {
  constructor() { this.buf = Buffer.alloc(1 << 16); this.len = 0; }
  _need(n) { if (this.len + n > this.buf.length) { const nb = Buffer.alloc(Math.max(this.buf.length * 2, this.len + n)); this.buf.copy(nb, 0, 0, this.len); this.buf = nb; } }
  i32(v) { this._need(4); this.buf.writeInt32LE(v | 0, this.len); this.len += 4; }
  u32(v) { this._need(4); this.buf.writeUInt32LE(v >>> 0, this.len); this.len += 4; }
  u8(v) { this._need(1); this.buf.writeUInt8(v & 0xff, this.len); this.len += 1; }
  bool(v) { this.u8(v ? 1 : 0); }
  f32(v) { this._need(4); this.buf.writeFloatLE(Math.fround(v), this.len); this.len += 4; }
  bytes() { return new Uint8Array(this.buf.buffer, this.buf.byteOffset, this.len); }
}
