// Classic Daggerfall weapon/shield paperdoll art -> 3D voxel-piece wraps.
//
// Nothing derived from ARENA2 is committed. The user's TEXTURE.NNN records are
// decoded at runtime, dyed with the exact classic palette tables, traced into a
// geometry-owned canonical surface, and then expanded into an 8-direction atlas.
// Weapons use their OWN principal axis for UV projection, so a sword/axe/bow can
// be seated diagonally in the hand without smearing its art through world-Y.

import templates from '../../characters/itemTemplates.json' with { type: 'json' };
import { TextureFile } from '../../formats/textureFile.js';
import { DFPalette } from '../../formats/dfPalette.js';
import { getBytes } from '../../scenes/dataSource.js';
import { applyDyeToIndex, DYE_COLORS, DYE_TARGETS } from '../../characters/dyes.js';
import { weaponDyeColor } from '../../characters/weapons.js';
import { armorArchive, paperdollRecordOffset } from '../../characters/paperdollArt.js';
import { ARMOR_MATERIAL } from '../../systems/armorMaterials.js';
import { PAPERDOLL_W, PAPERDOLL_ORIGIN } from '../../ui/paperDoll.js';
import {
  canonicalizePaperdollTexture,
  generateDirectionalViews,
  CLOTHING_WRAP_DEGREES,
} from './clothingTexture.js';

const byIndex = new Map(templates.map((t) => [t.index, t]));
const WRAP_RADIANS = CLOTHING_WRAP_DEGREES.map((d) => d * Math.PI / 180);
const archiveCache = new Map();
let palettePromise = null;
const clamp01 = (v) => Math.max(0, Math.min(1, v));

async function classicPalette() {
  if (!palettePromise) {
    palettePromise = (async () => {
      const pal = new DFPalette();
      pal.load(await getBytes('ART_PAL.COL'), 'ART_PAL.COL');
      return pal;
    })();
  }
  return palettePromise;
}

async function classicArchive(archive) {
  if (archiveCache.has(archive)) return archiveCache.get(archive);
  const pending = (async () => {
    const pal = await classicPalette();
    const name = TextureFile.indexToFileName(archive);
    const tex = new TextureFile();
    if (!tex.load(await getBytes(name), name, pal)) throw new Error(`could not load ${name}`);
    return { tex, pal, name };
  })();
  archiveCache.set(archive, pending);
  try { return await pending; }
  catch (e) { archiveCache.delete(archive); throw e; }
}

function sourceBounds(bitmap) {
  let x0 = bitmap.width, y0 = bitmap.height, x1 = -1, y1 = -1;
  for (let y = 0; y < bitmap.height; y++) for (let x = 0; x < bitmap.width; x++) {
    const i = bitmap.data[y * bitmap.width + x];
    if (i === 0 || i === 0xff) continue;
    x0 = Math.min(x0, x); x1 = Math.max(x1, x);
    y0 = Math.min(y0, y); y1 = Math.max(y1, y);
  }
  return x1 >= x0 && y1 >= y0 ? { x0, y0, x1, y1 } : null;
}

const ARMOR_DYE = new Map([
  [ARMOR_MATERIAL.Iron, DYE_COLORS.Iron], [ARMOR_MATERIAL.Steel, DYE_COLORS.Steel],
  [ARMOR_MATERIAL.Silver, DYE_COLORS.Silver], [ARMOR_MATERIAL.Elven, DYE_COLORS.Elven],
  [ARMOR_MATERIAL.Dwarven, DYE_COLORS.Dwarven], [ARMOR_MATERIAL.Mithril, DYE_COLORS.Mithril],
  [ARMOR_MATERIAL.Adamantium, DYE_COLORS.Adamantium], [ARMOR_MATERIAL.Ebony, DYE_COLORS.Ebony],
  [ARMOR_MATERIAL.Orcish, DYE_COLORS.Orcish], [ARMOR_MATERIAL.Daedric, DYE_COLORS.Daedric],
]);
const armorDye = (m) => ARMOR_DYE.get(m) ?? DYE_COLORS.Unchanged;

function decodeCrop(bitmap, pal, src, dye, target, paperdollMeta = null) {
  const width = src.x1 - src.x0 + 1, height = src.y1 - src.y0 + 1;
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const raw = bitmap.data[(src.y0 + y) * bitmap.width + src.x0 + x];
    if (raw === 0 || raw === 0xff) continue;
    const idx = applyDyeToIndex(raw, dye, target);
    const c = pal.get(idx), o = (y * width + x) * 4;
    data[o] = c.r; data[o + 1] = c.g; data[o + 2] = c.b; data[o + 3] = 255;
  }
  return { width, height, data, ...(paperdollMeta ? { paperdollMeta } : {}) };
}

async function loadWeaponArt({ templateIndex, material, gender = 'male', rightHand = false }) {
  const t = byIndex.get(templateIndex);
  if (!t) return null;
  const archive = t.playerTextureArchive - (gender === 'female' ? 1 : 0);
  const record = t.playerTextureRecord + (rightHand && t.isOneHanded ? 1 : 0);
  const { tex, pal, name } = await classicArchive(archive);
  const bitmap = tex.getDFBitmap(record, 0), src = bitmap ? sourceBounds(bitmap) : null;
  if (!src) return null;
  const dye = weaponDyeColor(material);
  return {
    source: decodeCrop(bitmap, pal, src, dye, DYE_TARGETS.WeaponsAndArmor),
    meta: Object.freeze({ templateIndex, archive, record, material, dye, rightHand, source: name }),
  };
}

async function loadShieldArt({ templateIndex, material, gender = 'male', race = 'Breton' }) {
  const t = byIndex.get(templateIndex);
  if (!t) return null;
  const archive = armorArchive(gender, race), record = t.playerTextureRecord;
  const { tex, pal, name } = await classicArchive(archive);
  const bitmap = tex.getDFBitmap(record, 0), src = bitmap ? sourceBounds(bitmap) : null;
  if (!src) return null;
  const offset = paperdollRecordOffset(tex, archive, record);
  const paperdollCentreX = (PAPERDOLL_W - 1) * 0.5;
  const layerX = (offset?.x ?? PAPERDOLL_ORIGIN[0]) - PAPERDOLL_ORIGIN[0] + src.x0;
  const dye = armorDye(material);
  return {
    source: decodeCrop(bitmap, pal, src, dye, DYE_TARGETS.WeaponsAndArmor, Object.freeze({
      axisX: paperdollCentreX - layerX,
      layerX,
      offsetX: offset?.x ?? PAPERDOLL_ORIGIN[0],
      offsetY: offset?.y ?? PAPERDOLL_ORIGIN[1],
    })),
    meta: Object.freeze({ templateIndex, archive, record, material, dye, source: name, offset: { ...offset } }),
  };
}

function rgbaAt(img, x, y) {
  x = Math.max(0, Math.min(img.width - 1, Math.round(x)));
  y = Math.max(0, Math.min(img.height - 1, Math.round(y)));
  const o = (y * img.width + x) * 4;
  return [img.data[o], img.data[o+1], img.data[o+2], img.data[o+3]];
}

function rowSpan(img, y) {
  let x0 = img.width, x1 = -1;
  for (let x = 0; x < img.width; x++) if (img.data[(y * img.width + x) * 4 + 3]) { x0 = Math.min(x0, x); x1 = x; }
  return x1 >= x0 ? [x0, x1] : null;
}

function nearestOpaqueInRow(img, y, x, span) {
  if (!span) return [0,0,0,0];
  for (let d = 0; d <= Math.max(img.width, 2); d++) {
    for (const sx of [x-d, x+d]) {
      if (sx < span[0] || sx > span[1]) continue;
      const c = rgbaAt(img, sx, y);
      if (c[3]) return c;
    }
  }
  return [0,0,0,0];
}

/**
 * Trace an arbitrary held-item sprite into its own canonical material space.
 * The alpha silhouette supplies the principal axis; every authored pixel is
 * rotated with nearest-neighbour sampling. Transparent presentation gaps are
 * then repaired/edge-padded because the voxel mesh, not paperdoll alpha, owns
 * the 3D silhouette. This is the weapon equivalent of clothing V5 registration.
 */
export function traceWeaponSprite(source) {
  const pts = [];
  let cx = 0, cy = 0;
  for (let y = 0; y < source.height; y++) for (let x = 0; x < source.width; x++) {
    if (!source.data[(y * source.width + x) * 4 + 3]) continue;
    pts.push([x,y]); cx += x; cy += y;
  }
  if (!pts.length) return source;
  cx /= pts.length; cy /= pts.length;
  let xx = 0, xy = 0, yy = 0;
  for (const [x,y] of pts) { const dx=x-cx, dy=y-cy; xx+=dx*dx; xy+=dx*dy; yy+=dy*dy; }
  const theta = 0.5 * Math.atan2(2*xy, xx-yy);
  let lx = Math.cos(theta), ly = Math.sin(theta);
  // Canonical length runs top->bottom in image space. Stabilise the eigenvector
  // sign so the same source always traces identically.
  if (ly < 0 || (Math.abs(ly) < 1e-6 && lx < 0)) { lx=-lx; ly=-ly; }
  const wx = -ly, wy = lx;
  let s0=Infinity,s1=-Infinity,w0=Infinity,w1=-Infinity;
  for (const [x,y] of pts) {
    const dx=x-cx, dy=y-cy, s=dx*lx+dy*ly, w=dx*wx+dy*wy;
    s0=Math.min(s0,s); s1=Math.max(s1,s); w0=Math.min(w0,w); w1=Math.max(w1,w);
  }
  const width = Math.max(2, Math.ceil(w1-w0)+1), height = Math.max(2, Math.ceil(s1-s0)+1);
  const raw = { width, height, data: new Uint8ClampedArray(width*height*4) };
  for (let y=0; y<height; y++) for (let x=0; x<width; x++) {
    const s=s0+y, w=w0+x;
    const sx=cx + s*lx + w*wx, sy=cy + s*ly + w*wy;
    const c=rgbaAt(source,sx,sy), o=(y*width+x)*4;
    raw.data[o]=c[0]; raw.data[o+1]=c[1]; raw.data[o+2]=c[2]; raw.data[o+3]=c[3];
  }
  const spans = Array.from({length:height},(_,y)=>rowSpan(raw,y));
  const occupied = spans.map((s,i)=>s?i:-1).filter((i)=>i>=0);
  const nearestRow = (y) => {
    let best=occupied[0] ?? 0, bd=Infinity;
    for (const q of occupied) { const d=Math.abs(q-y); if (d<bd){bd=d;best=q;} }
    return best;
  };
  const out = { width, height, data:new Uint8ClampedArray(raw.data.length) };
  let repairedPixels=0, borrowedRows=0, edgePaddedPixels=0;
  for (let y=0;y<height;y++) {
    const sy=spans[y]?y:nearestRow(y); if (sy!==y) borrowedRows++;
    const span=spans[sy] || [0,width-1];
    for (let x=0;x<width;x++) {
      const sx=Math.max(span[0],Math.min(span[1],x));
      if (sx!==x) edgePaddedPixels++;
      const rawc=rgbaAt(raw,sx,sy);
      const c=rawc[3]?rawc:nearestOpaqueInRow(raw,sy,sx,span);
      if (!rawc[3]) repairedPixels++;
      const o=(y*width+x)*4;
      out.data[o]=c[0]; out.data[o+1]=c[1]; out.data[o+2]=c[2]; out.data[o+3]=255;
    }
  }
  const spanWidth = (y) => { const s=spans[Math.max(0,Math.min(height-1,y))]; return s ? s[1]-s[0]+1 : 0; };
  const band = Math.max(1, Math.floor(height*0.18));
  const avg = (a) => a.length ? a.reduce((x,y)=>x+y,0)/a.length : 0;
  const topSpan = avg(Array.from({length:band},(_,i)=>spanWidth(i)));
  const bottomSpan = avg(Array.from({length:band},(_,i)=>spanWidth(height-1-i)));
  out.canonicalMeta = Object.freeze({
    mode:'weapon-surface-v1', registration:'principal-axis-sprite-trace',
    axisRadians:theta, alphaOwner:'geometry', repairedPixels, borrowedRows,
    edgePaddedPixels, topSpan, bottomSpan,
  });
  return out;
}

function imageToCanvas(img) {
  const canvas=document.createElement('canvas'); canvas.width=img.width; canvas.height=img.height;
  const ctx=canvas.getContext('2d'), data=ctx.createImageData(img.width,img.height); data.data.set(img.data); ctx.putImageData(data,0,0); return canvas;
}
function viewsToAtlasCanvas(views, columns=4) {
  const w=views[0].width,h=views[0].height,rows=Math.ceil(views.length/columns);
  const canvas=document.createElement('canvas'); canvas.width=w*columns; canvas.height=h*rows;
  const ctx=canvas.getContext('2d');
  for(let i=0;i<views.length;i++){const d=ctx.createImageData(w,h);d.data.set(views[i].data);ctx.putImageData(d,(i%columns)*w,Math.floor(i/columns)*h);} return canvas;
}

const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const sub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
const mul=(a,k)=>[a[0]*k,a[1]*k,a[2]*k];
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const norm=(a)=>{const L=Math.hypot(...a)||1;return[a[0]/L,a[1]/L,a[2]/L];};

function packVertices(pack) {
  const out=[]; for(let i=0;i<pack.P.length;i+=3) out.push([pack.P[i]/1000,pack.P[i+1]/1000,pack.P[i+2]/1000]); return out;
}
function principalAxis3(pack) {
  const pts=packVertices(pack), c=[0,0,0]; for(const p of pts){c[0]+=p[0];c[1]+=p[1];c[2]+=p[2];} c[0]/=pts.length;c[1]/=pts.length;c[2]/=pts.length;
  const M=[[0,0,0],[0,0,0],[0,0,0]];
  for(const p of pts){const d=sub(p,c);for(let i=0;i<3;i++)for(let j=0;j<3;j++)M[i][j]+=d[i]*d[j];}
  let v=norm([1,1,1]);
  for(let k=0;k<16;k++) v=norm([dot(M[0],v),dot(M[1],v),dot(M[2],v)]);
  if (Math.abs(v[1])>1e-5 ? v[1]<0 : (Math.abs(v[2])>1e-5 ? v[2]<0 : v[0]<0)) v=mul(v,-1);
  return {axis:v,center:c,pts};
}
function radialBasis(axis) {
  let front=sub([1,0,0],mul(axis,dot([1,0,0],axis)));
  if(Math.hypot(...front)<0.15) front=sub([0,0,1],mul(axis,dot([0,0,1],axis)));
  front=norm(front); return {front,right:norm(cross(axis,front))};
}
function meshEndWidths(pts,center,axis,right) {
  const ss=pts.map((p)=>dot(sub(p,center),axis)), s0=Math.min(...ss),s1=Math.max(...ss),d=Math.max(1e-6,s1-s0),lo=[],hi=[];
  for(let i=0;i<pts.length;i++){const u=(ss[i]-s0)/d,w=dot(sub(pts[i],center),right);if(u<0.18)lo.push(w);if(u>0.82)hi.push(w);}
  const width=(a)=>a.length?Math.max(...a)-Math.min(...a):0; return {min:width(lo),max:width(hi)};
}
function orientedWeaponFrame(pack, canonical) {
  let {axis,center,pts}=principalAxis3(pack), basis=radialBasis(axis), ends=meshEndWidths(pts,center,axis,basis.right);
  const top=canonical.canonicalMeta?.topSpan??0,bottom=canonical.canonicalMeta?.bottomSpan??0;
  // UV v=0 is source TOP and axis MAX. Match the broader authored end to the
  // broader geometry end (guard/head vs tip) so swords, axes and flails do not
  // silently arrive upside-down. Symmetric bows/staves are unaffected.
  const defaultCost=Math.abs(top-ends.max)+Math.abs(bottom-ends.min);
  const flippedCost=Math.abs(top-ends.min)+Math.abs(bottom-ends.max);
  if(flippedCost+1e-6<defaultCost){axis=mul(axis,-1);basis=radialBasis(axis);ends=meshEndWidths(pts,center,axis,basis.right);}
  return {axis,center,pts,...basis,endWidths:ends};
}

function axialBounds(pack, frame, d) {
  const a=WRAP_RADIANS[d], view=norm([frame.front[0]*Math.cos(a)+frame.right[0]*Math.sin(a),frame.front[1]*Math.cos(a)+frame.right[1]*Math.sin(a),frame.front[2]*Math.cos(a)+frame.right[2]*Math.sin(a)]), screen=norm(cross(frame.axis,view));
  let u0=Infinity,u1=-Infinity,v0=Infinity,v1=-Infinity;
  for(const p of frame.pts){const q=sub(p,frame.center),u=dot(q,screen),v=dot(q,frame.axis);u0=Math.min(u0,u);u1=Math.max(u1,u);v0=Math.min(v0,v);v1=Math.max(v1,v);} return {u0,u1,v0,v1,screen};
}
function axialFaceDirection(pack, f, frame) {
  const n0=[(pack.N?.[f*3]||0)/127,(pack.N?.[f*3+1]||0)/127,(pack.N?.[f*3+2]||0)/127];
  let n=sub(n0,mul(frame.axis,dot(n0,frame.axis))); if(Math.hypot(...n)<0.12) n=frame.front; else n=norm(n);
  const angle=Math.atan2(dot(n,frame.right),dot(n,frame.front)); return ((Math.round(angle/(Math.PI/4))%8)+8)%8;
}
function packAxialEightWayUV(pack, layout, canonical) {
  const TRI=[0,1,2,0,2,3], faces=Math.floor(pack.P.length/12), uv=new Float32Array(faces*12), frame=orientedWeaponFrame(pack,canonical), bounds=Array.from({length:8},(_,d)=>axialBounds(pack,frame,d));
  const eu=.5/Math.max(1,layout.viewWidth),ev=.5/Math.max(1,layout.viewHeight); let q=0;
  for(let f=0;f<faces;f++){
    const d=axialFaceDirection(pack,f,frame),b=bounds[d],col=d%layout.columns,row=Math.floor(d/layout.columns);
    for(const vi of TRI){const p0=f*12+vi*3,p=[pack.P[p0]/1000,pack.P[p0+1]/1000,pack.P[p0+2]/1000],r=sub(p,frame.center);let u=(dot(r,b.screen)-b.u0)/Math.max(1e-6,b.u1-b.u0),v=1-(dot(r,frame.axis)-b.v0)/Math.max(1e-6,b.v1-b.v0);u=eu+clamp01(u)*(1-2*eu);v=ev+clamp01(v)*(1-2*ev);uv[q++]=(col+u)/layout.columns;uv[q++]=((layout.rows-1-row)+v)/layout.rows;}
  }
  return {uv,frameMeta:Object.freeze({axis:frame.axis,endWidths:frame.endWidths})};
}

const projectionX=(x,z,r)=>x*Math.cos(r)-z*Math.sin(r);
function shieldBounds(pack,r){let x0=Infinity,x1=-Infinity,y0=Infinity,y1=-Infinity;for(let i=0;i<pack.P.length;i+=3){const x=pack.P[i]/1000,y=pack.P[i+1]/1000,z=pack.P[i+2]/1000,s=projectionX(x,z,r);x0=Math.min(x0,s);x1=Math.max(x1,s);y0=Math.min(y0,y);y1=Math.max(y1,y);}return{x0,x1,y0,y1};}
function shieldFaceDir(pack,f){let nx=(pack.N?.[f*3]||0)/127,nz=(pack.N?.[f*3+2]||0)/127;if(Math.hypot(nx,nz)<.15){const b=f*12;nx=nz=0;for(let v=0;v<4;v++){nx+=pack.P[b+v*3]||0;nz+=pack.P[b+v*3+2]||0;}}const a=Math.atan2(nx,nz);return((Math.round(a/(Math.PI/4))%8)+8)%8;}
function packShieldEightWayUV(pack,layout){const TRI=[0,1,2,0,2,3],faces=Math.floor(pack.P.length/12),uv=new Float32Array(faces*12),bounds=WRAP_RADIANS.map((r)=>shieldBounds(pack,r)),eu=.5/layout.viewWidth,ev=.5/layout.viewHeight;let q=0;for(let f=0;f<faces;f++){const d=shieldFaceDir(pack,f),r=WRAP_RADIANS[d],b=bounds[d],col=d%layout.columns,row=Math.floor(d/layout.columns);for(const vi of TRI){const p=f*12+vi*3,x=pack.P[p]/1000,y=pack.P[p+1]/1000,z=pack.P[p+2]/1000;let u=(projectionX(x,z,r)-b.x0)/Math.max(1e-6,b.x1-b.x0),v=1-(y-b.y0)/Math.max(1e-6,b.y1-b.y0);u=eu+clamp01(u)*(1-2*eu);v=ev+clamp01(v)*(1-2*ev);uv[q++]=(col+u)/layout.columns;uv[q++]=((layout.rows-1-row)+v)/layout.rows;}}return uv;}

export async function buildClassicWeaponPieceTexture({ templateIndex, pack, material, gender='male', rightHand=false }) {
  if(!pack?.P?.length)return null; const art=await loadWeaponArt({templateIndex,material,gender,rightHand}); if(!art)return null;
  const canonical=traceWeaponSprite(art.source),views=generateDirectionalViews(canonical),atlas=viewsToAtlasCanvas(views,4),layout=Object.freeze({columns:4,rows:2,viewWidth:views[0].width,viewHeight:views[0].height}),mapped=packAxialEightWayUV(pack,layout,canonical);
  return {canvas:atlas,layout,uv:mapped.uv,debug:Object.freeze({source:imageToCanvas(art.source),canonical:imageToCanvas(canonical),atlas}),meta:Object.freeze({...art.meta,wrapMode:'generated-8-way-axial',sourceMode:'classic-weapon-paperdoll-trace',canonical:canonical.canonicalMeta,frame:mapped.frameMeta,directions:CLOTHING_WRAP_DEGREES})};
}

export async function buildClassicShieldPieceTexture({ templateIndex, pack, material=ARMOR_MATERIAL.Steel, gender='male', race='Breton' }) {
  if(!pack?.P?.length)return null; const art=await loadShieldArt({templateIndex,material,gender,race}); if(!art)return null;
  const canonical=canonicalizePaperdollTexture(art.source,'armor-front'),views=generateDirectionalViews(canonical),atlas=viewsToAtlasCanvas(views,4),layout=Object.freeze({columns:4,rows:2,viewWidth:views[0].width,viewHeight:views[0].height});
  return {canvas:atlas,layout,uv:packShieldEightWayUV(pack,layout),debug:Object.freeze({source:imageToCanvas(art.source),canonical:imageToCanvas(canonical),atlas}),meta:Object.freeze({...art.meta,wrapMode:'generated-8-way-shield',sourceMode:'classic-shield-paperdoll-surface',canonical:canonical.canonicalMeta,directions:CLOTHING_WRAP_DEGREES})};
}
