// C6 art-reference extractor: dump a wearable's classic paperdoll art
// as a labeled sheet - variant rows x dye columns, colors resolved
// through the C5b band swap + ART_PAL, 3x nearest for review.
// Usage: ARENA2_PATH=... node tools/paperdoll-ref.mjs <templateIndex> [out.png]
import { readFileSync, writeFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import { TextureFile } from '../src/formats/textureFile.js';
import { DFPalette } from '../src/formats/dfPalette.js';
import { getTemplate } from '../src/characters/paperdoll.js';
import { resolvePaperdollRecord } from '../src/characters/paperdollArt.js';
import { DYE_COLORS, DYE_TARGETS, CLOTHING_DYES, applyDyeToIndex } from '../src/characters/dyes.js';

const A = process.env.ARENA2_PATH;
const tplIndex = Number(process.argv[2]);
const out = process.argv[3] || `/tmp/paperdoll-${tplIndex}.png`;
const tpl = getTemplate(tplIndex);
if (!tpl) { console.error('unknown template', tplIndex); process.exit(1); }

// Armor sheets are MATERIAL-CORRECT (C6a fix, caught by the band pin):
// leather + chain rows undyed on their own variant rows; plate designs
// x the ten metal tables. Gender/race pick the archive (human male
// default). Clothing keeps the ten clothing dyes.
import { armorArchive, armorVariant, MATERIAL_FAMILY } from '../src/characters/paperdollArt.js';
const isArmor = tplIndex >= 102 && tplIndex <= 112;
const gender = process.env.PD_GENDER || 'male';
const race = process.env.PD_RACE || 'Breton';
const pal = new DFPalette();
pal.load(readFileSync(`${A}/ART_PAL.COL`), 'ART_PAL.COL');
const tex = new TextureFile();
const archive = isArmor ? armorArchive(gender, race) : tpl.playerTextureArchive;
const fname = `TEXTURE.${String(archive).padStart(3, '0')}`;
tex.load(readFileSync(`${A}/${fname}`), fname, pal);

let rows;
if (isArmor) {
  const plate = [1, 2, 3].map((v) => armorVariant(tplIndex, MATERIAL_FAMILY.Plate, v));
  rows = [
    { label: 'leather', rec: resolvePaperdollRecord(tpl, armorVariant(tplIndex, MATERIAL_FAMILY.Leather, 0)), dyed: false },
    { label: 'chain', rec: resolvePaperdollRecord(tpl, armorVariant(tplIndex, MATERIAL_FAMILY.Chain, 0)), dyed: false },
    ...[...new Set(plate)].map((v, i) => ({ label: `plate${i + 1}`, rec: resolvePaperdollRecord(tpl, v), dyed: true })),
  ];
} else {
  rows = Array.from({ length: Math.max(1, tpl.variants) }, (_, v) => (
    { label: `v${v}`, rec: resolvePaperdollRecord(tpl, v), dyed: true }));
}
const DYES = isArmor
  ? [['Iron', DYE_COLORS.Iron], ['Steel', DYE_COLORS.Steel], ['Silver', DYE_COLORS.Silver], ['Elven', DYE_COLORS.Elven], ['Dwarven', DYE_COLORS.Dwarven], ['Mithril', DYE_COLORS.Mithril], ['Adamantium', DYE_COLORS.Adamantium], ['Ebony', DYE_COLORS.Ebony], ['Orcish', DYE_COLORS.Orcish], ['Daedric', DYE_COLORS.Daedric]]
  : Object.entries(DYE_COLORS).filter(([, v]) => CLOTHING_DYES.includes(v)).slice(0, 10);
const target = isArmor ? DYE_TARGETS.WeaponsAndArmor : DYE_TARGETS.Clothing;
const frames = rows.map((r) => ({ ...r, bmp: tex.getDFBitmap(r.rec, 0) }));
let maxW = 0, maxH = 0;
for (const f of frames) { maxW = Math.max(maxW, f.bmp.width); maxH = Math.max(maxH, f.bmp.height); }
const S = 3, PAD = 6, LABEL = 12;
const cols = DYES.length;
const sheet = new PNG({ width: PAD + cols * (maxW * S + PAD), height: LABEL + PAD + frames.length * (maxH * S + PAD) });
sheet.data.fill(30);
for (let i = 3; i < sheet.data.length; i += 4) sheet.data[i] = 255;
frames.forEach((f, r) => {
  for (let d = 0; d < (f.dyed ? cols : 1); d++) {
    const dye = DYES[d][1];
    const ox = PAD + d * (maxW * S + PAD);
    const oy = LABEL + PAD + r * (maxH * S + PAD);
    for (let y = 0; y < f.bmp.height; y++) for (let x = 0; x < f.bmp.width; x++) {
      const idx = f.bmp.data[y * f.bmp.width + x];
      if (idx === 0) continue;
      const c = pal.get(f.dyed ? applyDyeToIndex(idx, dye, target) : idx);
      for (let sy = 0; sy < S; sy++) for (let sx = 0; sx < S; sx++) {
        const o = ((oy + y * S + sy) * sheet.width + ox + x * S + sx) * 4;
        sheet.data[o] = c.r; sheet.data[o + 1] = c.g; sheet.data[o + 2] = c.b; sheet.data[o + 3] = 255;
      }
    }
  }
});
writeFileSync(out, PNG.sync.write(sheet));
console.log(`${tpl.name}: ${frames.length} rows x ${cols} dyes -> ${out} (${sheet.width}x${sheet.height}); rows [${frames.map((f) => f.label + ':' + f.rec).join(' ')}] of ${fname}`);
