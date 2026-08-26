from pathlib import Path

# --- skin.js owns the atlas, so it owns the final overlay raster pass.
p = Path('src/tools/paperdoll/skin.js')
s = p.read_text()

old = "  let bodyFaceTile = null;\n  let lastRamp = null;"
new = "  let bodyFaceTile = null;\n  let lastRamp = null;\n  let bodyOverlaySampler = null; // classic clothing art; exact face -> source pixel"
assert s.count(old) == 1
s = s.replace(old, new, 1)

old = """    for (const [f, c] of colorOverrides) {
      if ((D.G ? D.G[f] : 0) === 1) return false; // wrapped head arc: vertex fallback
      const ti = bodyFaceTile[f];"""
new = """    for (const [f, c] of colorOverrides) {
      if ((D.G ? D.G[f] : 0) === 1) return false; // wrapped head arc: vertex fallback
      // Classic clothing now owns these face pixels explicitly. Do not flood
      // its tile with the old flat garment colour before the source-art pass.
      if (bodyOverlaySampler?.ownsFace?.(f)) continue;
      const ti = bodyFaceTile[f];"""
assert s.count(old) == 1
s = s.replace(old, new, 1)

marker = "  function paintSkinTexture(ramp) {\n"
assert s.count(marker) == 1
block = r'''  function paintBodyOverlay(ctx2) {
    const sample = bodyOverlaySampler;
    const b = skinLayout && skinLayout.body;
    if (!sample || !b || b.mode !== 'face-atlas' || !bodyFaceTile) return;

    // The gutter samples the nearest edge texel, exactly like the body baker's
    // duplicated gutters. That keeps neighbouring clothing tiles from bleeding
    // into each other under nearest sampling while the model spins.
    const pad = b.pad ?? Math.max(0, Math.floor((b.stride - (b.tile || b.stride)) / 2));
    const tile = b.tile || Math.max(1, b.stride - pad * 2);
    const image = ctx2.getImageData(0, 0, skinTexCanvas.width, skinTexCanvas.height);
    const dst = image.data, W = image.width;
    for (let f = 0; f < nf; f++) {
      if (!sample.ownsFace?.(f)) continue;
      const ti = bodyFaceTile[f];
      if (ti < 0) continue;
      const x0 = b.x + (ti % b.columns) * b.stride;
      const y0 = b.y + Math.floor(ti / b.columns) * b.stride;
      for (let iy = 0; iy < b.stride; iy++) {
        const t = Math.max(0, Math.min(1, (iy - pad) / Math.max(1, tile - 1)));
        for (let ix = 0; ix < b.stride; ix++) {
          const ss = Math.max(0, Math.min(1, (ix - pad) / Math.max(1, tile - 1)));
          const c = sample(f, ss, t);
          if (!c || c[3] === 0) continue; // a source hole reveals the already-painted skin
          const o = ((y0 + iy) * W + (x0 + ix)) * 4;
          dst[o] = c[0]; dst[o + 1] = c[1]; dst[o + 2] = c[2]; dst[o + 3] = 255;
        }
      }
    }
    ctx2.putImageData(image, 0, 0);
  }

'''
s = s.replace(marker, block + marker, 1)

old = """    if (!paintOverrides(ctx2)) {
      paintVertexFallback(ramp);
      return;
    }

    skinTex.needsUpdate = true;"""
new = """    if (!paintOverrides(ctx2)) {
      paintVertexFallback(ramp);
      return;
    }
    paintBodyOverlay(ctx2);

    skinTex.needsUpdate = true;"""
assert s.count(old) == 1
s = s.replace(old, new, 1)

old = """  return { loadSkin, loadHeads, loadFaceSet, ensureHead, setBodySkin,
           setHeadPick:"""
new = """  const setBodyOverlaySampler = (sampler) => {
    bodyOverlaySampler = sampler || null;
    if (skinTex && lastRamp) paintSkinTexture(lastRamp);
  };

  return { loadSkin, loadHeads, loadFaceSet, ensureHead, setBodySkin, setBodyOverlaySampler,
           setHeadPick:"""
assert s.count(old) == 1
s = s.replace(old, new, 1)
p.write_text(s)

# --- viewer: load a source sampler when a classic body garment is picked.
p = Path('src/tools/paperdollViewer.js')
s = p.read_text()

old = "import { createSkin } from './paperdoll/skin.js';"
new = "import { createSkin } from './paperdoll/skin.js';\nimport { buildClassicBodyClothingSampler } from './paperdoll/clothingTexture.js';"
assert s.count(old) == 1
s = s.replace(old, new, 1)

old = "const { loadSkin, loadHeads, loadFaceSet, ensureHead, setBodySkin } = SKIN;"
new = "const { loadSkin, loadHeads, loadFaceSet, ensureHead, setBodySkin, setBodyOverlaySampler } = SKIN;"
assert s.count(old) == 1
s = s.replace(old, new, 1)

old = """function applyVillager(v) {
  pos.set(pristinePos); col.set(pristineCol);"""
new = """function applyVillager(v) {
  // Leaving the classic-clothing inspection state also releases its atlas
  // sampler. Every other design goes back through the ordinary delta colours.
  setBodyOverlaySampler(null);
  classicTextureToken++;
  classicClothingOn = null;
  const clothingSel = document.getElementById('clothing');
  if (clothingSel) clothingSel.value = '';
  pos.set(pristinePos); col.set(pristineCol);"""
assert s.count(old) == 1
s = s.replace(old, new, 1)

old = """let classicClothingOn = null;
function applyClassicClothing(c) {"""
new = r'''let classicClothingOn = null;
let classicTextureToken = 0;
async function syncClassicClothingTexture(c = classicClothingOn) {
  const token = ++classicTextureToken;
  if (!c || c.kind !== 'body') {
    setBodyOverlaySampler(null);
    return null;
  }
  try {
    const sampler = await buildClassicBodyClothingSampler({ item: c, D, race: RACES[raceIx] });
    // Async never drops AND never wins late: a slow TEXTURE archive from the
    // previous selection/race may finish after the user has already moved on.
    if (token !== classicTextureToken || classicClothingOn !== c) return null;
    setBodyOverlaySampler(sampler);
    return sampler?.meta || null;
  } catch {
    if (token === classicTextureToken && classicClothingOn === c) setBodyOverlaySampler(null);
    return null; // no ARENA2 in this browser: the proven flat-colour garment remains
  }
}
function applyClassicClothing(c) {'''
assert s.count(old) == 1
s = s.replace(old, new, 1)

old = """function applyClassicClothing(c) {
  for (const t of Object.values(pieceTables)) hidePieces(t);"""
new = """function applyClassicClothing(c) {
  ++classicTextureToken;
  setBodyOverlaySampler(null);
  for (const t of Object.values(pieceTables)) hidePieces(t);"""
assert s.count(old) == 1
s = s.replace(old, new, 1)

old = """    sel.onchange = () => {
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
    };"""
new = """    sel.onchange = async () => {
      const c = (D.clothing || []).find((x) => String(x.index) === sel.value) || null;
      for (const other of ['villager', 'orc', 'undead', 'classes', 'atronach', 'beast', 'daedra']) {
        const o = document.getElementById(other);
        if (o) o.value = '';
      }
      applyClassicClothing(c);
      const hud = document.getElementById('hud');
      if (hud) hud.textContent = c ? c.name + ' · loading classic texture…' : 'NEUTRAL POSE prototype · drag to rotate · pinch to zoom';
      const meta = await syncClassicClothingTexture(c);
      if (hud) hud.textContent = c
        ? c.name + ' · classic template ' + c.index + ' · ' + c.kind + (meta ? ' · ' + meta.source + ' record ' + meta.record + ' · source pixels' : c.kind === 'body' ? ' · flat-color fallback (ARENA2 texture unavailable)' : ' · drape texture pass next')
        : 'NEUTRAL POSE prototype · drag to rotate · pinch to zoom';
    };"""
assert s.count(old) == 1
s = s.replace(old, new, 1)

old = "document.getElementById('race').onclick = (e) => { raceIx = (raceIx+1)%RACES.length; syncRace(); e.target.textContent = 'race: '+RACES[raceIx]; const pal=(D.PALETTES||{})[PKEY[RACES[raceIx]]]; if(pal) document.getElementById('tone').textContent='tone: '+pal[toneIx[RACES[raceIx]]%pal.length].name;  };"
new = "document.getElementById('race').onclick = async (e) => { raceIx = (raceIx+1)%RACES.length; syncRace(); if (classicClothingOn?.kind === 'body') await syncClassicClothingTexture(classicClothingOn); e.target.textContent = 'race: '+RACES[raceIx]; const pal=(D.PALETTES||{})[PKEY[RACES[raceIx]]]; if(pal) document.getElementById('tone').textContent='tone: '+pal[toneIx[RACES[raceIx]]%pal.length].name;  };"
assert s.count(old) == 1
s = s.replace(old, new, 1)

p.write_text(s)
