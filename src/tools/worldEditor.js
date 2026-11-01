// WG2 THE WORLD EDITOR ("Editing"): a designer's tool over a region's bake - the map
// from above to edit on (brushes, biome paint, settlements, a district made again, a building removed), the pixel under
// the last click in 3D through the game's own renderer, named layers, undo and redo, the checks a town and protected
// property must pass, the road from draft to published, and packages in and out. Every change is data in the
// document (world/gen2/edit/); the bake is never written. Nothing runs until the page boots it.
import { decodeBake } from '../world/gen2/bakeCodec.js';
import { regionSampler, kernelUnits } from '../world/gen2/regionSampler.js';
const PIXEL_M = TERRAIN_SIZE;   // a world pixel's metres
import { TEST_REGIONS } from '../world/gen2/testRegions.js';
import { BIOME_TABLE, SOILS, ROCKS } from '../world/gen2/tables.js';
import { newDoc, addOp, addLayer, withLayer, editedSampler, docStale } from '../world/gen2/edit/editLayers.js';
import { historyOf, commitEdit, undo, redo } from '../world/gen2/edit/editHistory.js';
import { newHistory, saveDraft, advanceRevision, rollback, docDiff, published } from '../world/gen2/edit/revisions.js';
import { propertyConflicts } from '../world/gen2/edit/propertyGuard.js';
import { exportPackage, importPackage } from '../world/gen2/edit/contentPackage.js';
import { generateSettlement, STYLES, SETTLEMENT_KINDS } from '../world/gen2/settle/settlementGen.js';
import { settlementProblems } from '../world/gen2/settle/settlementValidate.js';
import { mintIds, settlementMapId } from '../world/gen2/settle/buildingRecord.js';
import { gunzipped, bakeUrl } from '../scenes/gen2Host.js';
import { canonReady } from '../world/gen2/canon.js';
import { downstreamOf } from '../world/gen2/continent.js';
import { Renderer } from '../render/renderer.js';
import { buildTerrainGrid, buildTerrainIndices, convertTilemap, TERRAIN_TILE_DIM } from '../world/terrain/terrainSurface.js';
import { generateTileData, assignTiles } from '../world/terrain/terrainTiles.js';
import { HEIGHTMAP_DIMENSION, MAX_TERRAIN_HEIGHT, TERRAIN_SIZE, STREAMING_TERRAIN_SCALE } from '../world/terrain/terrainSampler.js';
import { perspective, lookAt, identity, mirrorProjectionX } from '../world/mat4.js';

const TOOLS = ['look', 'raise', 'lower', 'smooth', 'flatten', 'biome', 'road', 'river', 'settlement', 'district', 'remove'];

/** Boot the editor on a document (the page's own). @param {Document} doc */
export async function bootWorldEditor(doc) {
  const $ = (id) => /** @type {any} */ (doc.getElementById(id));
  const st = { bakes: new Map(), region: null, S: null, E: null, hist: null, revs: newHistory(), layer: 0, tool: 'look', towns: new Map(), books: new Map(), pick: null, course: [] };
  for (const r of TEST_REGIONS) $('region').append(new globalThis.Option(r.id, r.id));
  for (const b of BIOME_TABLE) $('biome').append(new globalThis.Option(b.name, String(b.id)));
  for (const t of SETTLEMENT_KINDS) $('stype').append(new globalThis.Option(t.name, t.key));
  for (const s of STYLES) $('sstyle').append(new globalThis.Option(s.name, s.key));
  for (const t of TOOLS) { const b = doc.createElement('button'); b.textContent = t; b.onclick = () => { st.tool = t; drawTools(); }; $('tools').append(b); }
  const drawTools = () => { st.course = []; [...$('tools').children].forEach((b) => b.classList.toggle('on', b.textContent === st.tool)); };
  drawTools();

  async function load(id) {
    if (!st.bakes.has(id)) {
      const res = await fetch(bakeUrl(`${id}.wg2`));
      st.bakes.set(id, decodeBake(await gunzipped(new Uint8Array(await res.arrayBuffer()))));
    }
    const d = st.bakes.get(id);
    st.region = d; st.S = regionSampler(d); st.hist = historyOf(newDoc(id, d.print)); st.layer = 0; st.towns.clear();
    refresh();
  }
  const docNow = () => st.hist.now;
  function change(next) { st.hist = commitEdit(st.hist, next); refresh(); }
  function refresh() {
    st.E = editedSampler(st.S, docNow());
    st.towns.clear();
    drawLayers(); drawMap(); check();
  }

  // ── the map from above
  const map = $('map'), ctx = map.getContext('2d');
  const view = () => { const r = st.region.header.rect, sc = Math.min(map.width / r.w, map.height / r.h); return { r, sc, ox: (map.width - r.w * sc) / 2, oy: (map.height - r.h * sc) / 2 }; };
  const toWorld = (ev) => { const b = map.getBoundingClientRect(), v = view(); return [v.r.x + ((ev.clientX - b.left) * (map.width / b.width) - v.ox) / v.sc, v.r.y + ((ev.clientY - b.top) * (map.height / b.height) - v.oy) / v.sc]; };
  function drawMap() {
    map.width = map.clientWidth * (globalThis.devicePixelRatio || 1); map.height = map.clientHeight * (globalThis.devicePixelRatio || 1);
    const f = st.region.fields, w = f.elev.w, h = f.elev.h, img = ctx.createImageData(w, h), show = $('show').value, [lo, hi] = f.elev.range();
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const k = j * w + i, x = f.elev.x0 + (i + 0.5) / f.elev.res, y = f.elev.y0 + (j + 0.5) / f.elev.res;
      const e = st.E.heightAt(x, y), shade = 0.75 + 0.25 * Math.max(-1, Math.min(1, (st.E.heightAt(x - 0.4, y - 0.4) - e) / 40));
      let c;
      const env = /** @type {any} */ (st.E.env(x, y));
      if (show === 'biome') c = BIOME_TABLE[env.biome].color;
      else if (show === 'soil') c = SOILS[f.soil.data[k]].color;
      else if (show === 'rock') c = ROCKS[f.rock.data[k]].color;
      else if (show === 'precip') { const v = Math.min(1, f.precip.data[k] / 2500); c = [255 * (1 - v), 200 * v + 40, 255 * v]; }
      else if (show === 'temp') { const v = Math.min(1, Math.max(0, (f.temp.data[k] + 10) / 40)); c = [255 * v, 80, 255 * (1 - v)]; }
      else { const v = (e - lo) / (hi - lo + 1); c = [90 + 140 * v, 110 + 110 * v, 70 + 120 * v]; }
      if (f.water.data[k] & 2) c = [50, 90, 140];
      img.data.set([c[0] * shade, c[1] * shade, c[2] * shade, 255], k * 4);
    }
    const tmp = doc.createElement('canvas'); tmp.width = w; tmp.height = h; tmp.getContext('2d').putImageData(img, 0, 0);
    const v = view();
    ctx.imageSmoothingEnabled = false; ctx.fillStyle = '#000'; ctx.fillRect(0, 0, map.width, map.height);
    ctx.drawImage(tmp, v.ox, v.oy, v.r.w * v.sc, v.r.h * v.sc);
    const P = (x, y) => [v.ox + (x - v.r.x) * v.sc, v.oy + (y - v.r.y) * v.sc];
    ctx.strokeStyle = '#5aa0e0'; ctx.lineWidth = 1.5;
    for (const rv of st.region.header.rivers) { ctx.beginPath(); rv.pts.forEach((p, n) => ctx[n ? 'lineTo' : 'moveTo'](...P(p[0], p[1]))); ctx.stroke(); }
    for (const [list, colour] of [[st.E.ways.roads, '#c8b48a'], [st.E.ways.rivers, '#3f7fd0']]) {
      ctx.strokeStyle = colour; ctx.lineWidth = 2.5;
      for (const c of list) { ctx.beginPath(); c.pts.forEach((p, n) => ctx[n ? 'lineTo' : 'moveTo'](...P(p[0], p[1]))); ctx.stroke(); }
    }
    if (st.course.length) { ctx.strokeStyle = '#ffffff'; ctx.setLineDash([4, 3]); ctx.beginPath(); st.course.forEach((p, n) => ctx[n ? 'lineTo' : 'moveTo'](...P(p[0], p[1]))); ctx.stroke(); ctx.setLineDash([]); }
    for (const t of [...(st.region.header.towns ?? []), ...towns()]) {   // the towns the bake ships, then the document's
      ctx.strokeStyle = '#e0c080'; ctx.lineWidth = 1;
      for (const r of t.roads) { ctx.beginPath(); r.pts.forEach((p, n) => ctx[n ? 'lineTo' : 'moveTo'](...P(p[0], p[1]))); ctx.stroke(); }
      ctx.fillStyle = '#d06040';
      for (const b of t.buildings) { const [x, y] = P(b.at.x, b.at.y), s = Math.max(1.5, (b.footprint[0] / PIXEL_M) * v.sc); ctx.fillRect(x - s / 2, y - s / 2, s, s); }
    }
  }

  // ── the settlements in the document: made from their specs on the edited ground, ids from each one's book
  function towns() {
    const out = [];
    let n = 0;
    for (const L of docNow().layers) if (L.visible) for (const op of L.ops) if (op.kind === 'settlement') {
      n++;
      const key = JSON.stringify(op.spec);
      if (!st.towns.has(key)) {
        const t = generateSettlement(st.E, op.spec), minted = mintIds(t.id, settlementMapId(n), t.buildings, st.books.get(t.id));
        st.books.set(t.id, minted.book);
        const removed = new Set(docNow().layers.flatMap((l) => l.ops.filter((o) => o.kind === 'building' && o.remove).map((o) => o.id)));
        st.towns.set(key, { ...t, buildings: minted.buildings.filter((b) => !removed.has(b.id)) });
      }
      out.push(st.towns.get(key));
    }
    return out;
  }

  // ── the tools
  map.addEventListener('click', (ev) => {
    const [x, y] = toWorld(ev), r = Number($('radius').value), s = Number($('strength').value);
    st.pick = [x, y];
    try {
      if (['raise', 'lower', 'smooth'].includes(st.tool)) change(addOp(docNow(), st.layer, { kind: st.tool, x, y, r, strength: s, falloff: 'smooth' }));
      else if (st.tool === 'flatten') change(addOp(docNow(), st.layer, { kind: 'flatten', x, y, r, level: Number($('level').value), falloff: 'smooth' }));
      else if (st.tool === 'biome') change(addOp(docNow(), st.layer, { kind: 'biome', x, y, r, biome: Number($('biome').value) }));
      else if (st.tool === 'road' || st.tool === 'river') { st.course.push([x, y]); drawMap(); }
      else if (st.tool === 'settlement') {
        const n = towns().length + 1, id = `set-ed-${st.region.header.id}-${n}`;
        change(addOp(docNow(), st.layer, { kind: 'settlement', spec: { id, name: `Settlement ${n}`, type: $('stype').value, style: $('sstyle').value, x, y, seed: Number($('seed').value) } }));
      } else if (st.tool === 'district' || st.tool === 'remove') editTown(x, y);
      else drawPreview(x, y);
    } catch (e) { $('out').textContent = String(/** @type {Error} */ (e).message); }
  });
  function editTown(x, y) {
    let best = null, bd = Infinity;
    for (const t of towns()) for (const b of t.buildings) { const d = (b.at.x - x) ** 2 + (b.at.y - y) ** 2; if (d < bd) { bd = d; best = { t, b }; } }
    if (!best) return;
    if (st.tool === 'remove') { change(addOp(docNow(), st.layer, { kind: 'building', id: best.b.id, remove: true })); return; }
    // the district made again: the settlement's op replaced by one that names it, with a new seed for that district
    const L = docNow().layers.findIndex((l) => l.ops.some((o) => o.kind === 'settlement' && o.spec.id === best.t.id));
    const ops = docNow().layers[L].ops.map((o) => (o.kind === 'settlement' && o.spec.id === best.t.id ? { ...o, spec: { ...o.spec, seed: o.spec.seed + 1, regenerate: [best.b.district], keep: { roads: best.t.roads, buildings: best.t.buildings, features: best.t.features, terrainOps: best.t.terrainOps } } } : o));
    change(withLayer(docNow(), L, { ...docNow().layers[L], ops: Object.freeze(ops) }));
  }

  // ── layers, undo, packages
  function drawLayers() {
    $('layers').replaceChildren(...docNow().layers.map((L, i) => {
      const row = doc.createElement('div'); row.className = i === st.layer ? 'active' : '';
      const vis = doc.createElement('input'); vis.type = 'checkbox'; vis.checked = L.visible; vis.onchange = () => change(withLayer(docNow(), i, { ...L, visible: vis.checked }));
      const lock = doc.createElement('button'); lock.textContent = L.locked ? 'locked' : 'open'; lock.onclick = () => change(withLayer(docNow(), i, { ...L, locked: !L.locked }));
      const name = doc.createElement('span'); name.textContent = `${L.name} (${L.ops.length})`; name.onclick = () => { st.layer = i; drawLayers(); };
      row.append(vis, lock, name);
      return row;
    }));
  }
  $('addLayer').onclick = () => change(addLayer(docNow(), `Layer ${docNow().layers.length + 1}`));
  $('undo').onclick = () => { st.hist = undo(st.hist); refresh(); };
  $('redo').onclick = () => { st.hist = redo(st.hist); refresh(); };
  // a road or a river: clicks lay its points, Enter (or a double click) finishes it, Escape drops it
  const finishCourse = () => {
    if (st.course.length < 2) { st.course = []; return; }
    const width = Number($('width').value), pts = st.course;
    st.course = [];
    try {
      change(addOp(docNow(), st.layer, st.tool === 'road' ? { kind: 'road', pts, width } : { kind: 'river', pts, width, depth: Number($('depth').value) }));
    } catch (e) { $('out').textContent = String(/** @type {Error} */ (e).message); }
  };
  map.addEventListener('dblclick', () => finishCourse());
  doc.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter') finishCourse();
    if (ev.key === 'Escape') { st.course = []; drawMap(); }
  });
  doc.addEventListener('keydown', (ev) => {
    if (!(ev.ctrlKey || ev.metaKey)) return;
    if (ev.key === 'z') { st.hist = undo(st.hist); refresh(); } else if (ev.key === 'y') { st.hist = redo(st.hist); refresh(); }
  });
  $('export').onclick = () => {
    const a = doc.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(exportPackage(docNow()), null, 1)], { type: 'application/json' }));
    a.download = `${st.region.header.id}-edit.json`; a.click();
  };
  $('import').onchange = async () => {
    const got = importPackage(JSON.parse(await $('import').files[0].text()), st.region.print);
    if (got.refused) { $('out').textContent = `Refused:\n${got.refused.join('\n')}`; return; }
    change(got.doc);
  };

  // ── the checks and the publishing
  function check() {
    const lines = [], stale = docStale(docNow(), st.region.header.rect, (r) => downstreamOf(st.region.header.fit, r));
    lines.push(`Stale for a re-bake: ${[...stale.keys()].join(', ') || 'nothing'}`);
    for (const t of towns()) {
      const p = settlementProblems(st.E, t, { minted: true });
      lines.push(`${t.name} (${t.type}, ${t.style}): ${t.buildings.length} buildings, ${p.length ? `${p.length} problems\n  ${p.slice(0, 8).join('\n  ')}` : 'sound'}`);
    }
    const conflicts = propertyConflicts(docNow(), []);
    lines.push(`Protected property: ${conflicts.length ? conflicts.map((c) => c.why).join('; ') : 'no conflict'}`);
    $('out').textContent = lines.join('\n');
    return lines.filter((l) => / problems/.test(l));
  }
  const at = () => new Date().toISOString().slice(0, 10);
  $('draft').onclick = () => { st.revs = saveDraft(st.revs, docNow(), { author: $('who').value, note: $('note').value, at: at() }); drawRevs(); };
  $('advance').onclick = () => {
    const last = st.revs.revisions[st.revs.revisions.length - 1];
    if (!last) return;
    const got = advanceRevision(st.revs, last.n, { by: $('who').value, at: at(), problems: check(), staged: true, conflicts: propertyConflicts(last.doc, []) });
    if (got.refused) $('out').textContent = `Refused:\n${got.refused.join('\n')}`; else { st.revs = got.history; drawRevs(); }
  };
  $('rollback').onclick = () => { const got = rollback(st.revs, { by: $('who').value, at: at() }); if (got.refused) $('out').textContent = got.refused.join('\n'); else { st.revs = got.history; drawRevs(); } };
  function drawRevs() {
    const live = published(st.revs);
    $('revs').textContent = st.revs.revisions.map((r) => `#${r.n} ${r.state} ${r.print} by ${r.author}: ${r.note}`).join('\n')
      + (live ? `\n\nLive: #${live.n}. Changes since: ${docDiff(live.doc, docNow()).map((d) => `${d.layer} +${d.added.length} -${d.removed.length}`).join(', ') || 'none'}` : '');
  }

  // ── the pixel in 3D, through the game's renderer: the edited ground at the kernel's 129 x 129, flat colours a biome
  const view3d = $('view3d');
  view3d.getContext('webgl2', { antialias: false });
  const renderer = new Renderer(view3d);
  const layers = BIOME_TABLE.map((b) => { const colors = new Uint8Array(64 * 64 * 4); for (let i = 0; i < 64 * 64; i++) colors.set([...b.color, 255], i * 4); return { width: 64, height: 64, colors }; });
  while (layers.length < 64) layers.push(layers[0]);
  renderer.uploadTileArray(900, layers);
  let surface = null, tilemapTex = null, spin = 0, centreY = 0;
  function drawPreview(x, y) {
    const px = Math.floor(x), py = Math.floor(y), D = HEIGHTMAP_DIMENSION, hm = new Float32Array(D * D), tm = new Uint8Array(TERRAIN_TILE_DIM * TERRAIN_TILE_DIM);
    for (let a = 0; a < D; a++) for (let b = 0; b < D; b++) hm[a * D + b] = kernelUnits(st.E.heightAt(px + a / (D - 1), py + 1 - b / (D - 1))) / MAX_TERRAIN_HEIGHT;
    const td = generateTileData(hm, 40, 40, D);
    assignTiles(td, tm, true);
    for (let j = 0; j < TERRAIN_TILE_DIM; j++) for (let i = 0; i < TERRAIN_TILE_DIM; i++) tm[j * TERRAIN_TILE_DIM + i] = /** @type {any} */ (st.E.env(px + (i + 0.5) / TERRAIN_TILE_DIM, py + 1 - (j + 0.5) / TERRAIN_TILE_DIM)).biome << 2;
    centreY = hm[(D >> 1) * D + (D >> 1)] * MAX_TERRAIN_HEIGHT * STREAMING_TERRAIN_SCALE;   // the camera rides the ground it looks at
    const grid = buildTerrainGrid(hm, 1);
    surface = renderer.createTerrainSurface(grid.positions, grid.normals, buildTerrainIndices(1));
    tilemapTex = renderer.uploadTilemapTexture(convertTilemap(tm), TERRAIN_TILE_DIM);
    st.pick = [px, py];
  }
  function frame() {
    if (surface) {
      const w = view3d.clientWidth, h = view3d.clientHeight;
      if (view3d.width !== w || view3d.height !== h) { view3d.width = w; view3d.height = h; }
      spin += 0.004;
      const c = TERRAIN_SIZE / 2, eye = [c + Math.sin(spin) * 900, centreY + 700, c + Math.cos(spin) * 900];
      const proj = mirrorProjectionX(perspective(1, w / h, 1, 8000)), viewM = lookAt(eye, [c, centreY, c], [0, 1, 0]);
      const light = new Float32Array([0.4, 0.8, 0.3]);
      renderer.setLighting(new Float32Array([0.45, 0.45, 0.48]), 0.8, new Float32Array([1, 0.95, 0.85]));
      renderer.setLightDir(light); renderer.setClearColor([0.05, 0.06, 0.08, 1]); renderer.setFog('exp2', 0.0001, 0, 0, [0.05, 0.06, 0.08]);
      renderer.beginFrame(proj, viewM, light);
      renderer.drawTerrain(surface, identity(), renderer.tileArrays.get(900), tilemapTex, 6.4);
    }
    globalThis.requestAnimationFrame(frame);
  }
  globalThis.requestAnimationFrame(frame);

  $('region').onchange = () => load($('region').value);
  $('show').onchange = () => drawMap();
  globalThis.addEventListener('resize', () => drawMap());
  await canonReady();   // the continent's drainage (the stale stages' basin) reads the relief
  await load(TEST_REGIONS[0].id);
}

if (globalThis.document) bootWorldEditor(globalThis.document).catch((e) => { globalThis.document.body.textContent = `The editor failed to start: ${e?.message ?? e}`; });
