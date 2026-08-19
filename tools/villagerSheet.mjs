// The VILLAGER REFERENCE SHEET: every wandering-townsperson archive
// SetPerson can pick, as its idle record, on one bottom-aligned sheet.
// 3 races x 2 genders x 4 archives = 24, plus the city guard (399).
// The table is mobilePerson.js's own PERSON_TEXTURES, so the sheet
// cannot drift from what the game actually spawns.
//
// Usage: ARENA2_PATH=... node tools/villagerSheet.mjs [out.png]
//
// NOTE for anyone reusing the reader: TextureFile.getDFBitmap returns
// PALETTE INDICES, one byte per pixel, with 0 meaning transparent -
// NOT RGBA. Reading it at stride 4 yields a washed-out, 4x-squashed
// image that looks plausible enough to mistake for bad art.
import { PNG } from 'pngjs';
import { readFileSync, writeFileSync } from 'node:fs';
import { TextureFile } from '../src/formats/textureFile.js';
import { DFPalette } from '../src/formats/dfPalette.js';
import { PERSON_TEXTURES, GUARD_TEXTURE, PERSON_IDLE_RECORD, PERSON_GUARD_IDLE_RECORD } from '../src/characters/mobilePerson.js';
const A = process.env.ARENA2_PATH;
const pal = new DFPalette(); pal.load(readFileSync(`${A}/ART_PAL.COL`), 'ART_PAL.COL');

const rows = [];
for (const [race, g] of Object.entries(PERSON_TEXTURES))
  for (const [gender, arcs] of Object.entries(g))
    for (const a of arcs) rows.push({ race, gender, archive: a, record: PERSON_IDLE_RECORD });
rows.push({ race: 'Guard', gender: '-', archive: GUARD_TEXTURE, record: PERSON_GUARD_IDLE_RECORD });

const cells = rows.map((r) => {
  const name = `TEXTURE.${String(r.archive).padStart(3, '0')}`;
  const tf = new TextureFile();
  tf.load(readFileSync(`${A}/${name}`), name, pal);
  const rec = r.record < tf.recordCount ? r.record : 0;
  const bm = tf.getDFBitmap(rec, 0);
  return { ...r, name, w: bm.width, h: bm.height, idx: bm.data };
});

const SC = 3, COLS = 5;
const CW = Math.max(...cells.map((c) => c.w)) * SC + 10;
const CH = Math.max(...cells.map((c) => c.h)) * SC + 10;
const ROWS = Math.ceil(cells.length / COLS);
const png = new PNG({ width: CW * COLS, height: CH * ROWS });
for (let i = 0; i < png.data.length; i += 4) { png.data[i] = 24; png.data[i+1] = 26; png.data[i+2] = 30; png.data[i+3] = 255; }
cells.forEach((c, i) => {
  const ox = (i % COLS) * CW + Math.floor((CW - c.w * SC) / 2);
  const oy = Math.floor(i / COLS) * CH + CH - c.h * SC - 5;   // bottom-aligned: feet on a common line
  for (let y = 0; y < c.h * SC; y++) for (let x = 0; x < c.w * SC; x++) {
    const idx = c.idx[((y / SC) | 0) * c.w + ((x / SC) | 0)];
    if (!idx) continue;                                        // 0 = transparent
    const col = pal.get(idx);
    const di = ((oy + y) * png.width + (ox + x)) * 4;
    png.data[di] = col.r; png.data[di+1] = col.g; png.data[di+2] = col.b; png.data[di+3] = 255;
  }
});
writeFileSync(process.argv[2] || '/home/claude/villagers.png', PNG.sync.write(png));
console.log('wrote', png.width + 'x' + png.height, cells.length + ' cells');
cells.forEach((c, i) => console.log(String(i).padStart(2), c.race.padEnd(9), c.gender.padEnd(7), c.name, `${c.w}x${c.h}`));
