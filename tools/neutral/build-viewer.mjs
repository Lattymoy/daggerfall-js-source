// Builds the standalone orbit viewer from the shared neutral body
// module (src/characters/neutralBody.js) - same geometry/shading the
// engine uses. Ramps are read from the sprite here (Node side) and
// passed in; the browser passes ramps from the loaded ART_PAL.
// Usage: ARENA2_PATH=... node tools/neutral/build-viewer.mjs out.html
import { readFileSync, writeFileSync } from 'node:fs';
import { ImgFile } from '../../src/formats/imgFile.js';
import { DFPalette } from '../../src/formats/dfPalette.js';
import { buildNeutralBody } from '../../src/characters/neutralBody.js';
import { buildCuirass, STEEL_RAMP } from '../../src/characters/pieces/cuirass.js';
import { buildGreaves } from '../../src/characters/pieces/greaves.js';

const A = process.env.ARENA2_PATH;
const pal = new DFPalette(); pal.load(readFileSync(A + '/ART_PAL.COL'), 'ART_PAL.COL');
const img = new ImgFile(); img.load(readFileSync(A + '/BODY00I0.IMG'), 'BODY00I0.IMG', pal);
const { width: W, data } = img.getDFBitmap();
const lum = (i) => { const c = pal.get(i); return 0.299*c.r + 0.587*c.g + 0.114*c.b; };
const rampOf = (r0, r1, keep) => { const m = new Map(); for (let y=r0;y<=r1;y++) for (let x=0;x<W;x++){ const i=data[y*W+x]; if(i&&(!keep||keep(x,y))) m.set(i,lum(i)); } return [...m.entries()].sort((a,b)=>a[1]-b[1]).map(e=>{const c=pal.get(e[0]);return [c.r,c.g,c.b];}); };
const ramps = { skin: rampOf(40, 60, (x)=>Math.abs(x-34)<14), boot: rampOf(132, 144) };

const faces = buildNeutralBody(ramps, { cuirass: true, steel: STEEL_RAMP });
let minY = 1e9, maxY = -1e9;
for (const f of faces) for (let i=0;i<4;i++){ const y=f.p[i*3+1]; if(y<minY)minY=y; if(y>maxY)maxY=y; }
const GI = { body:0, head:1, armL:2, armR:3, legL:4, legR:5 };
const P=[], N=[], C=[], G=[];
for (const f of faces) {
  for (let i=0;i<4;i++) P.push(Math.round(f.p[i*3]*1000), Math.round(f.p[i*3+1]*1000), Math.round(f.p[i*3+2]*1000));
  N.push(Math.round(f.n[0]*127), Math.round(f.n[1]*127), Math.round(f.n[2]*127));
  C.push(f.c[0], f.c[1], f.c[2]);
  G.push(GI[f.g] ?? 0);
}
// armor pieces (separate meshes in the viewer, toggleable).
const packPiece = (pf) => { const pP=[], pN=[], pC=[], pG=[]; for (const f of pf) { for (let i=0;i<4;i++) pP.push(Math.round(f.p[i*3]*1000), Math.round(f.p[i*3+1]*1000), Math.round(f.p[i*3+2]*1000)); pN.push(Math.round(f.n[0]*127), Math.round(f.n[1]*127), Math.round(f.n[2]*127)); pC.push(f.c[0], f.c[1], f.c[2]); pG.push(GI[f.g] ?? 0); } return { P: pP, N: pN, C: pC, G: pG }; };
const payload = JSON.stringify({ n: faces.length, cy:(minY+maxY)/2, h:maxY-minY, P, N, C, G, greaves: packPiece(buildGreaves(STEEL_RAMP)) });
const dir = new URL('.', import.meta.url).pathname;
const tpl = readFileSync(dir + 'viewer-template.html', 'utf8');
writeFileSync(process.argv[2] || 'dagger-viewer.html', tpl.replace('__PAYLOAD__', payload));
console.log('viewer written (', faces.length, 'faces ) ->', process.argv[2] || 'dagger-viewer.html');
