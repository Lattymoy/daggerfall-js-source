from pathlib import Path

p = Path('src/characters/paperdollPayload.js')
s = p.read_text()
old = "import { clothingZones } from './clothing.js';"
new = "import { clothingZones, CLOTHING_CATALOG } from './clothing.js';"
if old not in s:
    raise SystemExit('paperdollPayload clothing import seam moved')
s = s.replace(old, new, 1)

marker = "  // Per-race body colours: same geometry, re-shaded with the race hide/fur."
if marker not in s:
    raise SystemExit('paperdollPayload clothing insertion seam moved')
block = '''  // ── CLASSIC DAGGERFALL CLOTHING ────────────────────────────────
  // The item DB owns the roster. Body-hugging garments use the exact same
  // face list as the neutral body and ship as deltas; skirts/robes/cloaks
  // keep their standoff drape identity. Classic archive/record addressing
  // travels with each pack for the texture stage that follows this one.
  const clothingPacks = CLOTHING_CATALOG.map((item) => {
    if (item.kind === 'drape') {
      return {
        ...item,
        drape: { name: item.drape, fit: measureDrapeFit(faces, item.drape) },
        idx: [], P: [], C: [],
      };
    }
    const cf = buildNeutralBody(
      { ...ramps, cloth: CLOTH_RAMP },
      { face, clothZones: clothingZones(item.index), cloth: CLOTH_RAMP },
    );
    return { ...item, drape: null, ...villagerDelta(faces, cf) };
  });

'''
s = s.replace(marker, block + marker, 1)
old = "cloth: CLOTH_D, drapedNames: DRAPED_NAMES"
new = "cloth: CLOTH_D, clothing: clothingPacks, drapedNames: DRAPED_NAMES"
if old not in s:
    raise SystemExit('paperdollPayload payload seam moved')
s = s.replace(old, new, 1)
p.write_text(s)

p = Path('viewer.html')
s = p.read_text()
old = '  <button id="drape">drape: None</button>\n  <select id="villager"'
new = '  <button id="drape">drape: None</button>\n  <select id="clothing" title="classic Daggerfall clothing"></select>\n  <select id="villager"'
if old not in s:
    raise SystemExit('viewer clothing control seam moved')
s = s.replace(old, new, 1)
p.write_text(s)

p = Path('src/tools/paperdollViewer.js')
s = p.read_text()
marker = "// step the visible simulated cloth from the animation state"
if marker not in s:
    raise SystemExit('viewer classic clothing insertion seam moved')
block = '''// ── CLASSIC DAGGERFALL CLOTHING ──────────────────────────────────
// These are item-template garments, not editor-only villager designs.
// Body clothing owns existing body quads; hanging garments own a drape mesh.
let classicClothingOn = null;
function applyClassicClothing(c) {
  for (const t of Object.values(pieceTables)) hidePieces(t);
  pos.set(pristinePos);
  col.set(pristineCol);
  basePos.set(pos);
  geo.getAttribute('position').needsUpdate = true;
  geo.getAttribute('color').needsUpdate = true;
  shownLine = null; shownIdx = -1; shownDesign = null; beastAtk = null;
  villagerOn = null;

  // Clear spectral/fire state left by an inspected enemy. Piece materials
  // mirror effect state only; their texture ownership stays independent.
  mat.transparent = false;
  mat.opacity = 1;
  mat.depthWrite = true;
  mat.blending = THREE.NormalBlending;
  mat.needsUpdate = true;
  syncPieceEffectState();

  // Current race/tone is the skin compositor baseline. Garment faces written
  // after this become authored clothing overrides in their isolated tiles.
  applyTone();

  if (c && c.kind === 'body') {
    for (let k = 0; k < c.idx.length; k++) {
      const f = c.idx[k], pb = k * 12, cb = k * 3;
      const r = c.C[cb] / 255, g = c.C[cb + 1] / 255, b = c.C[cb + 2] / 255;
      let o = f * 18;
      for (const vi of TRI) {
        pos[o] = c.P[pb + vi * 3] / 1000;
        pos[o + 1] = c.P[pb + vi * 3 + 1] / 1000;
        pos[o + 2] = c.P[pb + vi * 3 + 2] / 1000;
        col[o] = r; col[o + 1] = g; col[o + 2] = b;
        o += 3;
      }
    }
  }
  basePos.set(pos);
  geo.getAttribute('position').needsUpdate = true;
  geo.getAttribute('color').needsUpdate = true;

  for (const nm in drapedMeshes) drapedMeshes[nm].visible = false;
  if (c && c.kind === 'drape' && c.drape) {
    const di = DRAPES.indexOf(c.drape.name);
    drapeIx = di >= 0 ? di : 0;
    setDrape();
    fitDrape(c);
  } else {
    drapeIx = 0;
    setDrape();
    fitDrape(null);
  }
  classicClothingOn = c || null;
  const db = document.getElementById('drape');
  if (db) db.textContent = 'drape: ' + DRAPES[drapeIx];
}

'''
s = s.replace(marker, block + marker, 1)

marker = "// ── ORC LINE picker (editor only) ────────────────────────────────"
if marker not in s:
    raise SystemExit('viewer clothing picker seam moved')
setup = '''// Classic Daggerfall clothing picker: item DB roster -> 3D garment pack.
{
  const sel = document.getElementById('clothing');
  if (sel) {
    const none = document.createElement('option');
    none.value = '';
    none.textContent = 'clothing: none';
    sel.appendChild(none);
    const groups = { body: document.createElement('optgroup'), drape: document.createElement('optgroup') };
    groups.body.label = 'body clothing';
    groups.drape.label = 'draped clothing';
    for (const c of (D.clothing || [])) {
      const opt = document.createElement('option');
      opt.value = String(c.index);
      opt.textContent = c.name + '  #' + c.index + (c.variants > 1 ? '  (' + c.variants + ' variants)' : '');
      groups[c.kind]?.appendChild(opt);
    }
    if (groups.body.children.length) sel.appendChild(groups.body);
    if (groups.drape.children.length) sel.appendChild(groups.drape);
    sel.onchange = () => {
      const c = (D.clothing || []).find((x) => String(x.index) === sel.value) || null;
      for (const other of ['villager', 'orc', 'undead', 'classes', 'atronach', 'beast', 'daedra']) {
        const o = document.getElementById(other);
        if (o) o.value = '';
      }
      applyClassicClothing(c);
      const hud = document.getElementById('hud');
      if (hud) hud.textContent = c
        ? c.name + ' · classic template ' + c.index + ' · ' + c.kind + ' · TEXTURE.' + String(c.playerTextureArchive).padStart(3, '0') + ' record ' + c.playerTextureRecord
        : 'NEUTRAL POSE prototype · drag to rotate · pinch to zoom';
    };
  }
}

'''
s = s.replace(marker, setup + marker, 1)
p.write_text(s)
