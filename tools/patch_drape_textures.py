from pathlib import Path

p = Path('src/tools/paperdollViewer.js')
s = p.read_text()

old = "import { buildClassicBodyClothingSampler } from './paperdoll/clothingTexture.js';"
new = "import { buildClassicBodyClothingSampler, buildClassicDrapeTextureCanvas } from './paperdoll/clothingTexture.js';"
assert s.count(old) == 1
s = s.replace(old, new, 1)

old = "const drapedMeshes = {}, clothSims = {}; const DRAPES = ['None', ...(D.drapedNames||[])];"
new = r'''const drapedMeshes = {}, clothSims = {}; const DRAPES = ['None', ...(D.drapedNames||[])];
// Draped garments are already authored as continuous cloth surfaces, so unlike
// body clothing they do not need isolated face tiles. Their topology owns one
// planar UV field derived from the garment's own rest vertices.
function setPlanarDrapeUV(g, positions = null) {
  if (!g || g.getAttribute('uv')) return;
  const p = positions || g.getAttribute('position')?.array;
  if (!p || p.length < 3) return;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (let i = 0; i < p.length; i += 3) {
    x0 = Math.min(x0, p[i]); x1 = Math.max(x1, p[i]);
    y0 = Math.min(y0, p[i + 1]); y1 = Math.max(y1, p[i + 1]);
  }
  const dx = Math.max(1e-6, x1 - x0), dy = Math.max(1e-6, y1 - y0);
  const uv = new Float32Array((p.length / 3) * 2);
  for (let i = 0, q = 0; i < p.length; i += 3) {
    uv[q++] = (p[i] - x0) / dx;
    uv[q++] = 1 - (p[i + 1] - y0) / dy;
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
}
let classicDrapeTextureState = null;
function clearClassicDrapeTexture() {
  const st = classicDrapeTextureState;
  if (!st) return;
  const m = st.mesh.material;
  m.map = st.map;
  m.vertexColors = st.vertexColors;
  m.alphaTest = st.alphaTest;
  m.transparent = st.transparent;
  m.needsUpdate = true;
  st.texture?.dispose?.();
  classicDrapeTextureState = null;
}
function mountClassicDrapeTexture(c, art) {
  clearClassicDrapeTexture();
  if (!c?.drape?.name || !art?.canvas) return;
  const mesh = drapedMeshes[c.drape.name];
  if (!mesh) return;
  setPlanarDrapeUV(mesh.geometry);
  const texture = new THREE.CanvasTexture(art.canvas);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  const m = mesh.material;
  classicDrapeTextureState = {
    mesh, texture, map: m.map, vertexColors: m.vertexColors,
    alphaTest: m.alphaTest, transparent: m.transparent,
  };
  m.map = texture;
  // The classic bitmap already contains the garment's colour and painted light.
  // Multiplying it by the procedural vertex ramp would dye the source twice.
  m.vertexColors = false;
  m.alphaTest = 0.5;
  m.transparent = false;
  m.needsUpdate = true;
}
'''
assert s.count(old) == 1
s = s.replace(old, new, 1)

old = """  geo.setAttribute('position', new THREE.BufferAttribute(posArr, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(cloth.V*3), 3));"""
new = """  geo.setAttribute('position', new THREE.BufferAttribute(posArr, 3));
  setPlanarDrapeUV(geo, posArr); // REST pose: UVs do not swim while verlet cloth deforms
  geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(cloth.V*3), 3));"""
assert s.count(old) == 1
s = s.replace(old, new, 1)

old = """function applyVillager(v) {
  // Leaving the classic-clothing inspection state also releases its atlas
  // sampler. Every other design goes back through the ordinary delta colours.
  setBodyOverlaySampler(null);"""
new = """function applyVillager(v) {
  // Leaving the classic-clothing inspection state releases both texture paths.
  setBodyOverlaySampler(null);
  clearClassicDrapeTexture();"""
assert s.count(old) == 1
s = s.replace(old, new, 1)

start = s.index("async function syncClassicClothingTexture(c = classicClothingOn) {")
end = s.index("\nfunction applyClassicClothing(c) {", start)
old_block = s[start:end]
new_block = r'''async function syncClassicClothingTexture(c = classicClothingOn) {
  const token = ++classicTextureToken;
  setBodyOverlaySampler(null);
  clearClassicDrapeTexture();
  if (!c) return null;
  try {
    if (c.kind === 'body') {
      const sampler = await buildClassicBodyClothingSampler({ item: c, D, race: RACES[raceIx] });
      // Async never wins late: a slow archive from a previous item/race may
      // finish after the user has already selected something else.
      if (token !== classicTextureToken || classicClothingOn !== c) return null;
      setBodyOverlaySampler(sampler);
      return sampler?.meta || null;
    }
    if (c.kind === 'drape') {
      const art = await buildClassicDrapeTextureCanvas({ item: c, race: RACES[raceIx] });
      if (token !== classicTextureToken || classicClothingOn !== c) return null;
      mountClassicDrapeTexture(c, art);
      return art?.meta || null;
    }
  } catch {
    if (token === classicTextureToken && classicClothingOn === c) {
      setBodyOverlaySampler(null);
      clearClassicDrapeTexture();
    }
  }
  return null; // no ARENA2 here: the proven procedural garment remains
}'''
s = s[:start] + new_block + s[end:]

old = """function applyClassicClothing(c) {
  ++classicTextureToken;
  setBodyOverlaySampler(null);"""
new = """function applyClassicClothing(c) {
  ++classicTextureToken;
  setBodyOverlaySampler(null);
  clearClassicDrapeTexture();"""
assert s.count(old) == 1
s = s.replace(old, new, 1)

old = """      if (hud) hud.textContent = c
        ? c.name + ' · classic template ' + c.index + ' · ' + c.kind + (meta ? ' · ' + meta.source + ' record ' + meta.record + ' · source pixels' : c.kind === 'body' ? ' · flat-color fallback (ARENA2 texture unavailable)' : ' · drape texture pass next')
        : 'NEUTRAL POSE prototype · drag to rotate · pinch to zoom';"""
new = """      if (hud) hud.textContent = c
        ? c.name + ' · classic template ' + c.index + ' · ' + c.kind + (meta ? ' · ' + meta.source + ' record ' + meta.record + ' · source pixels' : ' · procedural fallback (ARENA2 texture unavailable)')
        : 'NEUTRAL POSE prototype · drag to rotate · pinch to zoom';"""
assert s.count(old) == 1
s = s.replace(old, new, 1)

old = "if (classicClothingOn?.kind === 'body') await syncClassicClothingTexture(classicClothingOn);"
new = "if (classicClothingOn) await syncClassicClothingTexture(classicClothingOn);"
assert s.count(old) == 1
s = s.replace(old, new, 1)

p.write_text(s)
