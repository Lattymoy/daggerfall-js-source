// Builds the standalone orbit viewer from the shared neutral body
// module (src/characters/neutralBody.js) - same geometry/shading the
// engine uses. Ramps are read from the sprite here (Node side) and
// passed in; the browser passes ramps from the loaded ART_PAL.
// Usage: ARENA2_PATH=... node tools/neutral/build-viewer.mjs out.html
import { readFileSync, writeFileSync } from 'node:fs';
import { ImgFile } from '../../src/formats/imgFile.js';
import { DFPalette } from '../../src/formats/dfPalette.js';
import { CifRciFile } from '../../src/formats/cifRciFile.js';
import { buildNeutralBody, WRIST_JUNCTION_Y, ARM_X, NECK_PIVOT_Y } from '../../src/characters/neutralBody.js';
import { ATTACKS_1H, ATTACKS_2H, ATTACKS_RANGED, DIRECTION_TO_STRIKE, STRIKES } from '../../src/characters/anims.js';
import { buildCuirass, STEEL_RAMP } from '../../src/characters/pieces/cuirass.js';
import { buildGreaves } from '../../src/characters/pieces/greaves.js';
import { CLOTH_RAMP, MAIL_RAMP, LEATHER_RAMP } from '../../src/characters/pieces/pieceLoft.js';
import { clothingZones } from '../../src/characters/clothing.js';
import { armorZones } from '../../src/characters/armorSet.js';
import { buildPauldrons } from '../../src/characters/pieces/pauldrons.js';
import { buildHelm } from '../../src/characters/pieces/helm.js';
import { buildHair, HAIR_RAMPS } from '../../src/characters/pieces/hair.js';
import { buildTail } from '../../src/characters/pieces/tail.js';
import { buildBodyScales, buildBodyFur, KHAJIIT_FUR, KHAJIIT_BELLY, ARGONIAN_HIDE } from '../../src/characters/pieces/bodyScales.js';
import { PALETTES } from '../../src/characters/palettes.js';
import { drapedPiece, drapedGrid, DRAPED_NAMES, BODY_CORE, DRAPE_MATERIAL } from '../../src/characters/pieces/draped.js';
import { POSES } from '../../src/characters/poses.js';
import { buildSword } from '../../src/characters/pieces/sword.js';
import { WEAPON_MATERIALS, weaponMaterialRamp, buildWeapon, WEAPONS } from '../../src/characters/weapons.js';
import { buildClaymore } from '../../src/characters/pieces/claymore.js';
import { buildLongBow, buildShortBow } from '../../src/characters/pieces/bow.js';

const A = process.env.ARENA2_PATH;
const pal = new DFPalette(); pal.load(readFileSync(A + '/ART_PAL.COL'), 'ART_PAL.COL');
const img = new ImgFile(); img.load(readFileSync(A + '/BODY00I0.IMG'), 'BODY00I0.IMG', pal);
const { width: W, data } = img.getDFBitmap();
const lum = (i) => { const c = pal.get(i); return 0.299*c.r + 0.587*c.g + 0.114*c.b; };
const rampOf = (r0, r1, keep) => { const m = new Map(); for (let y=r0;y<=r1;y++) for (let x=0;x<W;x++){ const i=data[y*W+x]; if(i&&(!keep||keep(x,y))) m.set(i,lum(i)); } return [...m.entries()].sort((a,b)=>a[1]-b[1]).map(e=>{const c=pal.get(e[0]);return [c.r,c.g,c.b];}); };
const ramps = { skin: rampOf(40, 60, (x)=>Math.abs(x-34)<14), boot: rampOf(132, 144) };
// Character FACE sprite (FACE00I0 record 0) projected onto the head front.
const cif = new CifRciFile(); cif.load(readFileSync(A + '/FACE00I0.CIF'), 'FACE00I0.CIF', pal);
const fb = cif.getDFBitmap(0, 0);
const faceRgb = []; for (let i = 0; i < fb.data.length; i++) { const idx = fb.data[i]; if (idx) { const c = pal.get(idx); faceRgb.push([c.r, c.g, c.b]); } else faceRgb.push(null); }
const face = { w: fb.width, h: fb.height, rgb: faceRgb };

const outfit = [...clothingZones(167), ...clothingZones(151)]; // Long Shirt + Casual Pants (under)
const armor = [...armorZones(102), ...armorZones(104), ...armorZones(103), ...armorZones(108)]; // full plate over it
const mats = { steel: STEEL_RAMP, mail: MAIL_RAMP, leather: LEATHER_RAMP };
const faces = buildNeutralBody(ramps, { face });
let minY = 1e9, maxY = -1e9;
for (const f of faces) for (let i=0;i<4;i++){ const y=f.p[i*3+1]; if(y<minY)minY=y; if(y>maxY)maxY=y; }
const GI = { body:0, head:1, armL:2, armR:3, legL:4, legR:5 };
const P=[], N=[], C=[], G=[], Ib=[];
for (const f of faces) {
  for (let i=0;i<4;i++) P.push(Math.round(f.p[i*3]*1000), Math.round(f.p[i*3+1]*1000), Math.round(f.p[i*3+2]*1000));
  N.push(Math.round(f.n[0]*127), Math.round(f.n[1]*127), Math.round(f.n[2]*127));
  C.push(f.c[0], f.c[1], f.c[2]);
  Ib.push(Math.round((f._i ?? 0.6) * 255));
  G.push(GI[f.g] ?? 0);
}
// armor pieces (separate meshes in the viewer, toggleable).
const packPiece = (pf) => { const pP=[], pN=[], pC=[], pG=[], pI=[]; for (const f of pf) { for (let i=0;i<4;i++) pP.push(Math.round(f.p[i*3]*1000), Math.round(f.p[i*3+1]*1000), Math.round(f.p[i*3+2]*1000)); pN.push(Math.round(f.n[0]*127), Math.round(f.n[1]*127), Math.round(f.n[2]*127)); pC.push(f.c[0], f.c[1], f.c[2]); pI.push(Math.round((f._i ?? 0.6) * 255)); pG.push(GI[f.g] ?? 0); } return { P: pP, N: pN, C: pC, G: pG, I: pI }; };
// Per-race hairstyle packs (haired races get multiple styles).
const HAIRSTYLES = { Human: ['short','buzz','medium','long','ponytail','topknot','mohawk','bald'], Elf: ['short','medium','long','ponytail','mohawk','bald'] };
const hairPacks = {};
for (const [race, styles] of Object.entries(HAIRSTYLES)) { hairPacks[race] = {}; for (const st of styles) hairPacks[race][st] = packPiece(buildHair(HAIR_RAMPS.brown, race, ramps.skin, st)); }
hairPacks.Khajiit = { default: packPiece(buildHair(KHAJIIT_FUR, 'Khajiit', KHAJIIT_FUR)) };
hairPacks.Argonian = { default: packPiece(buildHair(HAIR_RAMPS.brown, 'Argonian', ramps.skin)) };
// Per-race body colours: same geometry, re-shaded with the race hide/fur.
const colorsOf = (fs) => { const c=[]; for (const f of fs) c.push(f.c[0], f.c[1], f.c[2]); return c; };
const Ck = colorsOf(buildNeutralBody({ skin: KHAJIIT_FUR, boot: ramps.boot }, { face }));
const Ca = colorsOf(buildNeutralBody({ skin: ARGONIAN_HIDE, boot: ramps.boot }, { face }));
const CLOTH_D = [[58,48,38],[86,72,54],[118,100,74],[150,128,96],[180,158,122],[206,186,150]];
const drapeGridsOut = {}, drapedPacks = {};
for (const nm of DRAPED_NAMES) { const g = drapedGrid(nm);
  if (g) drapeGridsOut[nm] = { rows: g.rows, cols: g.cols, wrap: g.wrap, pos: Array.from(g.pos), faces: g.faces };
  else drapedPacks[nm] = packPiece(drapedPiece(nm, CLOTH_D)); }
const payload = JSON.stringify({ n: faces.length, Ck, Ca, Ib, PALETTES, draped: drapedPacks, drapeGrids: drapeGridsOut, drapeMaterials: DRAPE_MATERIAL, bodyCore: BODY_CORE, poses: POSES, wristY: WRIST_JUNCTION_Y * 0.9, armX: ARM_X, neckY: NECK_PIVOT_Y * 0.9, attacks: ATTACKS_1H, attacks2H: ATTACKS_2H, attacksRanged: ATTACKS_RANGED, strikes: STRIKES, dirToStrike: DIRECTION_TO_STRIKE,
  sword: packPiece(buildSword(weaponMaterialRamp(WEAPON_MATERIALS.Steel, (i) => pal.get(i)))),
  claymore: packPiece(buildClaymore(weaponMaterialRamp(WEAPON_MATERIALS.Steel, (i) => pal.get(i)))),
  claymoreItems: Object.fromEntries(Object.entries(WEAPON_MATERIALS).filter(([, v]) => v >= 0).map(([n, v]) => [n, buildWeapon(WEAPONS.Claymore, v)])),
  longbow: packPiece(buildLongBow(weaponMaterialRamp(WEAPON_MATERIALS.Steel, (i) => pal.get(i)))),
  longbowItems: Object.fromEntries(Object.entries(WEAPON_MATERIALS).filter(([, v]) => v >= 0).map(([n, v]) => [n, buildWeapon(WEAPONS.Long_Bow, v)])),
  shortbow: packPiece(buildShortBow(weaponMaterialRamp(WEAPON_MATERIALS.Steel, (i) => pal.get(i)))),
  shortbowItems: Object.fromEntries(Object.entries(WEAPON_MATERIALS).filter(([, v]) => v >= 0).map(([n, v]) => [n, buildWeapon(WEAPONS.Short_Bow, v)])),
  swordRamps: Object.fromEntries(Object.entries(WEAPON_MATERIALS).filter(([, v]) => v >= 0).map(([n, v]) => [n, weaponMaterialRamp(v, (i) => pal.get(i))])),
  swordItems: Object.fromEntries(Object.entries(WEAPON_MATERIALS).filter(([, v]) => v >= 0).map(([n, v]) => [n, buildWeapon(WEAPONS.Longsword, v)])), cloth: CLOTH_D, drapedNames: DRAPED_NAMES, cy:(minY+maxY)/2, h:maxY-minY, P, N, C, G, pauldrons: packPiece(buildPauldrons(STEEL_RAMP)), helm: packPiece(buildHelm(STEEL_RAMP)), hair: hairPacks, tail: packPiece(buildTail(ramps.skin,'argonian')), tailCat: packPiece(buildTail(KHAJIIT_FUR,'khajiit')), bodyScales: packPiece(buildBodyScales(faces, ramps.skin)), bodyFurCoat: packPiece(buildBodyFur(faces, KHAJIIT_FUR, KHAJIIT_BELLY, 'coat')), bodyFurBelly: packPiece(buildBodyFur(faces, KHAJIIT_FUR, KHAJIIT_BELLY, 'belly')) });
const dir = new URL('.', import.meta.url).pathname;
let clothSrc = readFileSync(dir + '../../src/characters/clothSim.js', 'utf8').replace(/^export /gm, '');
let animsSrc = readFileSync(dir + '../../src/characters/anims.js', 'utf8').replace(/^export /gm, '');
const tpl = readFileSync(dir + 'viewer-template.html', 'utf8').replace('/*__CLOTHSIM__*/', clothSrc).replace('/*__ANIMS__*/', animsSrc);
writeFileSync(process.argv[2] || 'dagger-viewer.html', tpl.replace('__PAYLOAD__', payload));
console.log('viewer written (', faces.length, 'faces ) ->', process.argv[2] || 'dagger-viewer.html');
