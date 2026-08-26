from pathlib import Path

# clothingTexture.js: pack all eight generated views into one runtime atlas.
p = Path('src/tools/paperdoll/clothingTexture.js')
s = p.read_text()

old = '''function viewToCanvas(img) {
  const canvas = document.createElement('canvas');
  canvas.width = img.width; canvas.height = img.height;
  const ctx = canvas.getContext('2d');
  const out = ctx.createImageData(img.width, img.height);
  out.data.set(img.data);
  ctx.putImageData(out, 0, 0);
  return canvas;
}
'''
new = '''function viewToCanvas(img) {
  const canvas = document.createElement('canvas');
  canvas.width = img.width; canvas.height = img.height;
  const ctx = canvas.getContext('2d');
  const out = ctx.createImageData(img.width, img.height);
  out.data.set(img.data);
  ctx.putImageData(out, 0, 0);
  return canvas;
}

function viewsToAtlasCanvas(views, columns = 4) {
  if (!views?.length) return null;
  const w = views[0].width, h = views[0].height;
  const rows = Math.ceil(views.length / columns);
  const canvas = document.createElement('canvas');
  canvas.width = w * columns; canvas.height = h * rows;
  const ctx = canvas.getContext('2d');
  for (let i = 0; i < views.length; i++) {
    const cell = ctx.createImageData(w, h);
    cell.data.set(views[i].data);
    ctx.putImageData(cell, (i % columns) * w, Math.floor(i / columns) * h);
  }
  return canvas;
}
'''
assert s.count(old) == 1, 'viewToCanvas anchor drifted'
s = s.replace(old, new, 1)

old = '''/**
 * Draped garments still use their continuous cloth UVs for this pass, but the
 * same eight generated views are produced now and carried with the result. The
 * viewer mounts the authored 000/front view until the drape render mesh is split
 * at directional seams; doing that separately avoids corrupting the working
 * verlet topology merely to force an atlas across shared seam vertices.
 */
export async function buildClassicDrapeTextureCanvas({
  item, race = 'Breton', variant = 0, dye = DYE_COLORS.Blue,
}) {
  if (!item || item.kind !== 'drape') return null;
  const art = await loadIndexedArt({ item, race, variant, dye });
  if (!art) return null;
  const views = generateDirectionalViews(decodedCrop(art));
  return {
    canvas: viewToCanvas(views[0]),
    views,
    meta: Object.freeze({
      ...art.meta,
      wrapMode: 'generated-8-way-pending-drape-seams',
      directions: CLOTHING_WRAP_DEGREES,
    }),
  };
}
'''
new = '''/**
 * Draped garments use the same eight generated views, packed into a 4x2 runtime
 * atlas. paperdollViewer gives every render triangle independent UVs, so a robe
 * seam can cross from 315 back to 000 without interpolating through the other
 * six views. The physics mesh remains untouched; only the render copy is split.
 */
export async function buildClassicDrapeTextureCanvas({
  item, race = 'Breton', variant = 0, dye = DYE_COLORS.Blue,
}) {
  if (!item || item.kind !== 'drape') return null;
  const art = await loadIndexedArt({ item, race, variant, dye });
  if (!art) return null;
  const views = generateDirectionalViews(decodedCrop(art));
  const layout = Object.freeze({
    columns: 4,
    rows: 2,
    viewWidth: views[0].width,
    viewHeight: views[0].height,
  });
  return {
    canvas: viewsToAtlasCanvas(views, layout.columns),
    views,
    layout,
    meta: Object.freeze({
      ...art.meta,
      wrapMode: 'generated-8-way',
      directions: CLOTHING_WRAP_DEGREES,
    }),
  };
}
'''
assert s.count(old) == 1, 'drape function anchor drifted'
s = s.replace(old, new, 1)
p.write_text(s)

# paperdollViewer.js: seam-safe non-indexed render cloth + per-triangle 8-way UVs.
p = Path('src/tools/paperdollViewer.js')
s = p.read_text()

old = '''  const m = new THREE.Mesh(geo, makePieceMaterial()); m.position.y = -D.cy; m.visible = true; pivot.add(m);
  animTargets.push({ pos: pp, base: pp.slice(), vgrp: pg, geo }); // moves with the body
  m.userData.recolor = (ramp) => { if (!cp.I) return; let oo = 0; for (let f = 0; f < ncf; f++) { const c = snapRamp(ramp, cp.I[f]); const r=c[0]/255,g=c[1]/255,b=c[2]/255; for (let k=0;k<6;k++){ pc[oo]=r; pc[oo+1]=g; pc[oo+2]=b; oo+=3; } } geo.getAttribute('color').needsUpdate = true; };
'''
new = '''  const m = new THREE.Mesh(geo, makePieceMaterial()); m.position.y = -D.cy; m.visible = true; pivot.add(m);
  animTargets.push({ pos: pp, base: pp.slice(), vgrp: pg, geo }); // moves with the body
  // Directional clothing UVs are authored from REST geometry, never the posed
  // frame. Otherwise a sleeve texture would swim as the arm swings.
  m.userData.wrapRest = pp.slice();
  m.userData.recolor = (ramp) => { if (!cp.I) return; let oo = 0; for (let f = 0; f < ncf; f++) { const c = snapRamp(ramp, cp.I[f]); const r=c[0]/255,g=c[1]/255,b=c[2]/255; for (let k=0;k<6;k++){ pc[oo]=r; pc[oo+1]=g; pc[oo+2]=b; oo+=3; } } geo.getAttribute('color').needsUpdate = true; };
'''
assert s.count(old) == 1, 'buildPiece anchor drifted'
s = s.replace(old, new, 1)

marker = '''let classicDrapeTextureState = null;
'''
assert s.count(marker) == 1
helper = '''// Eight generated clothing views live in a 4x2 atlas. A drape triangle picks
// the view facing its REST normal, then projects its own vertices into that view.
// Render triangles are non-indexed below, so every face owns this UV choice and
// the 315->000 seam cannot interpolate through unrelated atlas cells.
const clampWrap01 = (v) => Math.max(0, Math.min(1, v));
const wrapProjectionX = (x, z, r) => x * Math.cos(r) - z * Math.sin(r);
function drapeWrapBounds(p, r) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (let i = 0; i < p.length; i += 3) {
    const sx = wrapProjectionX(p[i], p[i + 2], r), y = p[i + 1];
    x0 = Math.min(x0, sx); x1 = Math.max(x1, sx); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
  }
  return { x0, y0, x1, y1 };
}
function drapeTriangleDirection(p, i) {
  const ax=p[i], ay=p[i+1], az=p[i+2], bx=p[i+3], by=p[i+4], bz=p[i+5], cx=p[i+6], cy=p[i+7], cz=p[i+8];
  const ux=bx-ax, uy=by-ay, uz=bz-az, vx=cx-ax, vy=cy-ay, vz=cz-az;
  let nx=uy*vz-uz*vy, nz=ux*vy-uy*vx;
  const mx=(ax+bx+cx)/3, mz=(az+bz+cz)/3;
  // Ring grids can be wound inward. Texture direction is geometric outside, so
  // flip a horizontal normal that points through the character centre.
  if (nx*mx + nz*mz < 0) { nx = -nx; nz = -nz; }
  if (Math.hypot(nx, nz) < 1e-6) { nx = mx; nz = mz; }
  const a = Math.atan2(nx, nz);
  return ((Math.round(a / (Math.PI / 4)) % 8) + 8) % 8;
}
function setEightWayDrapeUV(g, positions, layout) {
  const p = positions || g?.getAttribute('position')?.array;
  if (!g || !p || p.length < 9 || !layout?.columns || !layout?.rows) { setPlanarDrapeUV(g, p); return; }
  // Exact per-triangle UV ownership requires non-indexed render geometry.
  if (g.index) { setPlanarDrapeUV(g, p); return; }
  const bounds = Array.from({ length: 8 }, (_, d) => drapeWrapBounds(p, d * Math.PI / 4));
  const uv = new Float32Array((p.length / 3) * 2);
  const eu = 0.5 / Math.max(1, layout.viewWidth || 1), ev = 0.5 / Math.max(1, layout.viewHeight || 1);
  for (let i = 0; i < p.length; i += 9) {
    const d = drapeTriangleDirection(p, i), r = d * Math.PI / 4, b = bounds[d];
    const col = d % layout.columns, row = Math.floor(d / layout.columns);
    for (let k = 0; k < 3; k++) {
      const q = i + k*3;
      let u = (wrapProjectionX(p[q], p[q+2], r) - b.x0) / Math.max(1e-6, b.x1 - b.x0);
      let v = 1 - (p[q+1] - b.y0) / Math.max(1e-6, b.y1 - b.y0);
      u = eu + clampWrap01(u) * (1 - 2*eu);
      v = ev + clampWrap01(v) * (1 - 2*ev);
      const o = (q / 3) * 2;
      uv[o] = (col + u) / layout.columns;
      uv[o+1] = ((layout.rows - 1 - row) + v) / layout.rows;
    }
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
}
'''
s = s.replace(marker, helper + marker, 1)

old = '''  setPlanarDrapeUV(mesh.geometry);
  const texture = new THREE.CanvasTexture(art.canvas);
'''
new = '''  setEightWayDrapeUV(mesh.geometry, mesh.userData.wrapRest, art.layout);
  const texture = new THREE.CanvasTexture(art.canvas);
'''
assert s.count(old) == 1, 'mount UV anchor drifted'
s = s.replace(old, new, 1)

old = '''// Simulated (grid) drapes: real verlet cloth, pinned at the top row.
for (const nm in (D.drapeGrids||{})) {
  const g = D.drapeGrids[nm]; g.pos = Float32Array.from(g.pos);
  const cloth = buildCloth(g, nm.indexOf('Cloak') >= 0 ? 2 : 1);
  const tris = []; for (const f of g.faces) { tris.push(f[0],f[1],f[2], f[0],f[2],f[3]); }
  const geo = new THREE.BufferGeometry();
  const posArr = new Float32Array(cloth.pos);
  geo.setAttribute('position', new THREE.BufferAttribute(posArr, 3));
  setPlanarDrapeUV(geo, posArr); // REST pose: UVs do not swim while verlet cloth deforms
  geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(cloth.V*3), 3));
  const mat = (D.drapeMaterials||{})[nm] || { ramp: CLOTH_RAMP, sheen: 0, rim: 0 };
  geo.setIndex(tris); geo.computeVertexNormals(); shadeClothGeo(geo, mat);
  const clothRenderMat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide });
  pieceMaterials.add(clothRenderMat); copyBodyEffectState(clothRenderMat);
  const m = new THREE.Mesh(geo, clothRenderMat);
  m.position.y = -D.cy; m.visible = false; pivot.add(m);
  drapedMeshes[nm] = m; clothSims[nm] = { cloth, geo, posArr, mat };
}
'''
new = '''// Simulated (grid) drapes: real verlet cloth, pinned at the top row.
// Physics keeps its shared grid. Rendering gets an independent non-indexed copy
// so every triangle can own one of the eight directional texture cells without
// a shared seam vertex forcing two incompatible UVs.
for (const nm in (D.drapeGrids||{})) {
  const g = D.drapeGrids[nm]; g.pos = Float32Array.from(g.pos);
  const cloth = buildCloth(g, nm.indexOf('Cloak') >= 0 ? 2 : 1);
  const renderIndex = [];
  for (const f of g.faces) renderIndex.push(f[0],f[1],f[2], f[0],f[2],f[3]);
  const posArr = new Float32Array(renderIndex.length * 3);
  for (let i = 0; i < renderIndex.length; i++) {
    const a = renderIndex[i] * 3, o = i * 3;
    posArr[o] = cloth.pos[a]; posArr[o+1] = cloth.pos[a+1]; posArr[o+2] = cloth.pos[a+2];
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(posArr, 3));
  setPlanarDrapeUV(geo, posArr); // fallback UV before a classic 8-way atlas mounts
  geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(posArr.length), 3));
  const mat = (D.drapeMaterials||{})[nm] || { ramp: CLOTH_RAMP, sheen: 0, rim: 0 };
  geo.computeVertexNormals(); shadeClothGeo(geo, mat);
  const clothRenderMat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide });
  pieceMaterials.add(clothRenderMat); copyBodyEffectState(clothRenderMat);
  const m = new THREE.Mesh(geo, clothRenderMat);
  m.userData.wrapRest = posArr.slice();
  m.position.y = -D.cy; m.visible = false; pivot.add(m);
  drapedMeshes[nm] = m; clothSims[nm] = { cloth, geo, posArr, mat, renderIndex };
}
'''
assert s.count(old) == 1, 'sim cloth anchor drifted'
s = s.replace(old, new, 1)

old = '''  cs.posArr.set(cs.cloth.pos); cs.geo.attributes.position.needsUpdate = true;
  cs.geo.computeVertexNormals(); shadeClothGeo(cs.geo, cs.mat);
'''
new = '''  for (let i = 0; i < cs.renderIndex.length; i++) {
    const a = cs.renderIndex[i] * 3, o = i * 3;
    cs.posArr[o] = cs.cloth.pos[a]; cs.posArr[o+1] = cs.cloth.pos[a+1]; cs.posArr[o+2] = cs.cloth.pos[a+2];
  }
  cs.geo.attributes.position.needsUpdate = true;
  cs.geo.computeVertexNormals(); shadeClothGeo(cs.geo, cs.mat);
'''
assert s.count(old) == 1, 'cloth step anchor drifted'
s = s.replace(old, new, 1)

p.write_text(s)
