from pathlib import Path

p = Path('src/tools/paperdollViewer.js')
s = p.read_text()

old = "import { buildClassicBodyClothingSampler, buildClassicDrapeTextureCanvas } from './paperdoll/clothingTexture.js';\n"
new = old + "import { buildClassicBodyArmorSampler, buildClassicArmorPieceTexture } from './paperdoll/armorTexture.js';\n"
assert old in s, 'armor texture import seam drifted'
s = s.replace(old, new, 1)

old = """function setLoosePieces(on) {\n  if (!on) {\n    armorOn.clear();\n    for (const byFamily of Object.values(armorPieceMeshes))\n      for (const m of Object.values(byFamily)) if (m) m.visible = false;\n    for (const id of Object.keys(ARMOR_BUTTONS)) {\n      const btn = document.getElementById(id);\n      if (btn) btn.classList.remove('on');\n    }\n    return;\n  }\n  syncArmorPieceVisibility();\n}\n"""
new = """function setLoosePieces(on) {\n  if (!on) {\n    armorOn.clear();\n    classicArmorBodySamplers.clear();\n    ++classicArmorTextureToken;\n    clearAllArmorPieceTextures();\n    syncBodySurfaceSampler();\n    for (const byFamily of Object.values(armorPieceMeshes))\n      for (const m of Object.values(byFamily)) if (m) m.visible = false;\n    for (const id of Object.keys(ARMOR_BUTTONS)) {\n      const btn = document.getElementById(id);\n      if (btn) btn.classList.remove('on');\n    }\n    setDrape();\n    return;\n  }\n  syncArmorPieceVisibility();\n  setDrape();\n}\n"""
assert old in s, 'setLoosePieces seam drifted'
s = s.replace(old, new, 1)

old = """function armorPack(slot) {\n  return armorBySlot[slot]?.families?.[armorFamily] || null;\n}\n"""
new = """let classicClothingSampler = null;\nlet classicArmorTextureToken = 0;\nconst classicArmorBodySamplers = new Map();\nconst armorPieceTextureState = new Map();\n\nfunction armorPack(slot) {\n  return armorBySlot[slot]?.families?.[armorFamily] || null;\n}\nfunction armorBodyOwnerMap() {\n  const owner = new Map();\n  // Same inner->outer order as geometry; a later slot wins overlaps.\n  for (const slot of ['boots', 'greaves', 'gauntlets', 'cuirass']) {\n    if (!armorOn.has(slot)) continue;\n    const d = armorPack(slot);\n    if (!d?.idx) continue;\n    for (const f of d.idx) owner.set(f, slot);\n  }\n  return owner;\n}\nfunction syncBodySurfaceSampler() {\n  const armorOwner = armorBodyOwnerMap();\n  const clothing = classicClothingSampler;\n  if (!armorOwner.size && !clothing) { setBodyOverlaySampler(null); return; }\n  const sampler = (f, u, v) => {\n    const slot = armorOwner.get(f);\n    if (slot) {\n      const armor = classicArmorBodySamplers.get(slot);\n      return armor?.ownsFace?.(f) ? armor(f, u, v) : null;\n    }\n    return clothing?.ownsFace?.(f) ? clothing(f, u, v) : null;\n  };\n  sampler.ownsFace = (f) => {\n    const slot = armorOwner.get(f);\n    if (slot) return !!classicArmorBodySamplers.get(slot)?.ownsFace?.(f);\n    return !!clothing?.ownsFace?.(f);\n  };\n  setBodyOverlaySampler(sampler);\n}\nfunction clearArmorPieceTexture(slot, family) {\n  const key = `${slot}:${family}`;\n  const st = armorPieceTextureState.get(key);\n  if (!st) return;\n  st.mesh.material.map = null;\n  st.mesh.material.vertexColors = true;\n  st.mesh.material.needsUpdate = true;\n  st.texture?.dispose?.();\n  armorPieceTextureState.delete(key);\n}\nfunction clearAllArmorPieceTextures() {\n  for (const key of [...armorPieceTextureState.keys()]) {\n    const [slot, family] = key.split(':');\n    clearArmorPieceTexture(slot, Number(family));\n  }\n}\nfunction mountArmorPieceTexture(slot, family, art) {\n  const mesh = armorPieceMeshes[slot]?.[family];\n  if (!mesh || !art?.canvas || !art?.uv) return;\n  clearArmorPieceTexture(slot, family);\n  mesh.geometry.setAttribute('uv', new THREE.BufferAttribute(art.uv, 2));\n  const texture = new THREE.CanvasTexture(art.canvas);\n  texture.magFilter = THREE.NearestFilter;\n  texture.minFilter = THREE.NearestFilter;\n  texture.generateMipmaps = false;\n  mesh.material.map = texture;\n  mesh.material.vertexColors = false;\n  mesh.material.needsUpdate = true;\n  armorPieceTextureState.set(`${slot}:${family}`, { mesh, texture });\n}\nasync function syncSelectedArmorTextures() {\n  const token = ++classicArmorTextureToken;\n  const family = armorFamily, race = RACES[raceIx], useGender = gender;\n  classicArmorBodySamplers.clear();\n  clearAllArmorPieceTextures();\n  syncBodySurfaceSampler();\n  const tasks = [];\n  for (const slot of armorOn) {\n    const item = armorBySlot[slot], pack = armorPack(slot);\n    if (!item || !pack) continue;\n    if (item.kind === 'body') {\n      tasks.push((async () => {\n        try {\n          const sampler = await buildClassicBodyArmorSampler({ item, delta: pack, D, race, gender: useGender, family });\n          if (token !== classicArmorTextureToken || armorFamily !== family || !armorOn.has(slot)) return;\n          if (sampler) classicArmorBodySamplers.set(slot, sampler);\n          syncBodySurfaceSampler();\n        } catch { /* no ARENA2: flat procedural armour remains */ }\n      })());\n    } else {\n      tasks.push((async () => {\n        try {\n          const art = await buildClassicArmorPieceTexture({ item, pack, race, gender: useGender, family });\n          if (token !== classicArmorTextureToken || armorFamily !== family || !armorOn.has(slot)) return;\n          if (art) mountArmorPieceTexture(slot, family, art);\n        } catch { /* no ARENA2: flat procedural armour remains */ }\n      })());\n    }\n  }\n  await Promise.all(tasks);\n  if (token === classicArmorTextureToken) {\n    syncBodySurfaceSampler();\n    syncArmorPieceVisibility();\n  }\n}\n"""
assert old in s, 'armor manager seam drifted'
s = s.replace(old, new, 1)

old = """async function rebuildArmorWardrobe() {\n  const c = classicClothingOn;\n  applyClassicClothing(c);\n  syncArmorPieceVisibility();\n  syncArmorButtons();\n  if (c) await syncClassicClothingTexture(c);\n}\n"""
new = """async function rebuildArmorWardrobe() {\n  const c = classicClothingOn;\n  applyClassicClothing(c);\n  syncArmorPieceVisibility();\n  syncArmorButtons();\n  await Promise.all([\n    c ? syncClassicClothingTexture(c) : Promise.resolve(null),\n    syncSelectedArmorTextures(),\n  ]);\n  setDrape();\n}\n"""
assert old in s, 'rebuildArmorWardrobe seam drifted'
s = s.replace(old, new, 1)

old = """const drapedMeshes = {}, clothSims = {}; const DRAPES = ['None', ...(D.drapedNames||[])];\n"""
new = """const drapedMeshes = {}, clothSims = {}; const DRAPES = ['None', ...(D.drapedNames||[])];\n// Drapes that are intentionally worn OUTSIDE armour. Dresses, robes, skirts,\n// wraps, sashes and similar body garments disappear as soon as armour is worn;\n// cloaks and heraldic surcoats remain valid outer layers.\nconst ARMOR_OUTER_DRAPES = new Set(['Casual Cloak', 'Formal Cloak', 'Dwynnen Surcoat', 'Anticlere Surcoat']);\n"""
assert old in s, 'drape declaration seam drifted'
s = s.replace(old, new, 1)

old = """let drapeIx = 0;\nconst setDrape = () => { for (const nm in drapedMeshes) drapedMeshes[nm].visible = false; const cur = DRAPES[drapeIx]; if (cur !== 'None' && drapedMeshes[cur]) drapedMeshes[cur].visible = true; };\n"""
new = """let drapeIx = 0;\nconst setDrape = () => {\n  for (const nm in drapedMeshes) drapedMeshes[nm].visible = false;\n  const cur = DRAPES[drapeIx];\n  const armorAllows = !armorOn.size || ARMOR_OUTER_DRAPES.has(cur);\n  if (cur !== 'None' && armorAllows && drapedMeshes[cur]) drapedMeshes[cur].visible = true;\n};\n"""
assert old in s, 'setDrape seam drifted'
s = s.replace(old, new, 1)

old = """let classicClothingOn = null;\nlet classicTextureToken = 0;\nlet classicTextureDebug = null;\n"""
new = """let classicClothingOn = null;\nlet classicTextureToken = 0;\nlet classicTextureDebug = null;\n"""
assert old in s, 'classic clothing declaration seam drifted'
# classicClothingSampler is deliberately declared in the armour layer manager.

old = """async function syncClassicClothingTexture(c = classicClothingOn) {\n  const token = ++classicTextureToken;\n  setBodyOverlaySampler(null);\n  clearClassicDrapeTexture();\n  drawClassicTextureQA(null);\n  if (!c) return null;\n"""
new = """async function syncClassicClothingTexture(c = classicClothingOn) {\n  const token = ++classicTextureToken;\n  classicClothingSampler = null;\n  syncBodySurfaceSampler();\n  clearClassicDrapeTexture();\n  drawClassicTextureQA(null);\n  if (!c) return null;\n"""
assert old in s, 'sync clothing prelude drifted'
s = s.replace(old, new, 1)

old = """      setBodyOverlaySampler(sampler);\n      drawClassicTextureQA(sampler?.debug);\n"""
new = """      classicClothingSampler = sampler || null;\n      syncBodySurfaceSampler();\n      drawClassicTextureQA(sampler?.debug);\n"""
assert old in s, 'body clothing sampler seam drifted'
s = s.replace(old, new, 1)

old = """      setBodyOverlaySampler(null);\n      clearClassicDrapeTexture();\n"""
new = """      classicClothingSampler = null;\n      syncBodySurfaceSampler();\n      clearClassicDrapeTexture();\n"""
assert old in s, 'clothing catch seam drifted'
s = s.replace(old, new, 1)

old = """function applyClassicClothing(c) {\n  ++classicTextureToken;\n  setBodyOverlaySampler(null);\n  clearClassicDrapeTexture();\n"""
new = """function applyClassicClothing(c) {\n  ++classicTextureToken;\n  classicClothingSampler = null;\n  syncBodySurfaceSampler();\n  clearClassicDrapeTexture();\n"""
assert old in s, 'applyClassicClothing prelude drifted'
s = s.replace(old, new, 1)

old = """document.getElementById('race').onclick = async (e) => { raceIx = (raceIx+1)%RACES.length; syncRace(); if (classicClothingOn) await syncClassicClothingTexture(classicClothingOn); e.target.textContent = 'race: '+RACES[raceIx]; const pal=(D.PALETTES||{})[PKEY[RACES[raceIx]]]; if(pal) document.getElementById('tone').textContent='tone: '+pal[toneIx[RACES[raceIx]]%pal.length].name;  };\ndocument.getElementById('tone').onclick = (e) => { const R=RACES[raceIx], pal=(D.PALETTES||{})[PKEY[R]]; if(!pal)return; toneIx[R]=(toneIx[R]+1)%pal.length; applyTone(); e.target.textContent='tone: '+pal[toneIx[R]%pal.length].name; };\n"""
new = """document.getElementById('race').onclick = async (e) => { raceIx = (raceIx+1)%RACES.length; syncRace(); await rebuildArmorWardrobe(); e.target.textContent = 'race: '+RACES[raceIx]; const pal=(D.PALETTES||{})[PKEY[RACES[raceIx]]]; if(pal) document.getElementById('tone').textContent='tone: '+pal[toneIx[RACES[raceIx]]%pal.length].name;  };\ndocument.getElementById('tone').onclick = async (e) => { const R=RACES[raceIx], pal=(D.PALETTES||{})[PKEY[R]]; if(!pal)return; toneIx[R]=(toneIx[R]+1)%pal.length; applyTone(); if (classicClothingOn || armorOn.size) await rebuildArmorWardrobe(); e.target.textContent='tone: '+pal[toneIx[R]%pal.length].name; };\n"""
assert old in s, 'race/tone controls seam drifted'
s = s.replace(old, new, 1)

p.write_text(s)

# Static probe: validates the three ownership contracts without requiring ARENA2.
p = Path('tools/armorTextureLayersProbe.mjs')
p.write_text("""import assert from 'node:assert/strict';\nimport fs from 'node:fs';\n\nconst viewer = fs.readFileSync(new URL('../src/tools/paperdollViewer.js', import.meta.url), 'utf8');\nconst armorTex = fs.readFileSync(new URL('../src/tools/paperdoll/armorTexture.js', import.meta.url), 'utf8');\n\nfor (const api of ['buildClassicBodyArmorSampler', 'buildClassicArmorPieceTexture'])\n  assert.ok(armorTex.includes(`export async function ${api}`), `missing ${api}`);\nassert.ok(armorTex.includes('DYE_TARGETS.WeaponsAndArmor'), 'armor must use the classic weapons/armor dye band');\nassert.ok(armorTex.includes('armorArchive(gender, race)'), 'armor must resolve the classic gender/race archive');\nassert.ok(armorTex.includes('armorVariant(item.index, family'), 'armor must use classic material-family variant clamps');\n\nassert.ok(viewer.includes('armorBodyOwnerMap()'), 'body armor needs explicit face ownership');\nassert.ok(viewer.includes("return armor?.ownsFace?.(f) ? armor(f, u, v) : null"), 'armor must suppress clothing on owned faces');\nassert.ok(viewer.includes("ARMOR_OUTER_DRAPES = new Set(['Casual Cloak', 'Formal Cloak', 'Dwynnen Surcoat', 'Anticlere Surcoat'])"), 'outer drape exception set missing');\nassert.ok(viewer.includes('const armorAllows = !armorOn.size || ARMOR_OUTER_DRAPES.has(cur)'), 'non-outer drapes must hide under armor');\nassert.ok(viewer.includes('buildClassicArmorPieceTexture({ item, pack, race, gender: useGender, family })'), 'piece armor must receive source textures');\nconsole.log('armor texture/layer probe: PASS');\n""")
