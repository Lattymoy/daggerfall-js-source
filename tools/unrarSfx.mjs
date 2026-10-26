// ARN1: tools/fetch-arena.sh's extractor - Bethesda's Arena106.exe is a self-extracting RAR, and node-unrar-js (MIT,
// installed by the script beside the data, never a dependency of the game) opens the archive from its signature on.
//   node tools/unrarSfx.mjs <sfx.exe> <out dir> <node_modules holding node-unrar-js>
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, dirname, resolve } from 'node:path';

const [sfx, out, modules] = process.argv.slice(2);
if (!sfx || !out || !modules) {
  console.error('usage: node tools/unrarSfx.mjs <sfx.exe> <out dir> <node_modules>');
  process.exit(2);
}
const { createExtractorFromData } = createRequire(join(resolve(modules), 'x.js'))('node-unrar-js');
const bytes = readFileSync(sfx);
const at = bytes.indexOf(Buffer.from('Rar!\x1a\x07\x00', 'latin1'));
if (at < 0) throw new Error(`${sfx}: no RAR archive inside`);
const extractor = await createExtractorFromData({ data: Uint8Array.from(bytes.subarray(at)).buffer });
let n = 0;
for (const f of extractor.extract().files) {
  const dest = resolve(out, f.fileHeader.name.replace(/\\/g, '/'));
  if (!dest.startsWith(resolve(out))) throw new Error(`${f.fileHeader.name}: outside the output folder`);
  if (f.fileHeader.flags.directory) { mkdirSync(dest, { recursive: true }); continue; }
  mkdirSync(dirname(dest), { recursive: true });
  writeFileSync(dest, f.extraction);
  n++;
}
console.log(`${sfx}: ${n} files`);
