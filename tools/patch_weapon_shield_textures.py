from pathlib import Path


def rep(path, old, new):
    p = Path(path)
    s = p.read_text()
    if s.count(old) != 1:
        raise SystemExit(f'{path}: expected one anchor, found {s.count(old)}: {old[:120]!r}')
    p.write_text(s.replace(old, new, 1))

# Payload: every weapon carries its immutable template index, and the four shield
# geometries join the runtime-only paperdoll payload.
rep(
    'src/characters/paperdollPayload.js',
    "import { buildHaftedWeapon, HAFTED_SPECS } from './pieces/hafted.js';",
    "import { buildHaftedWeapon, HAFTED_SPECS } from './pieces/hafted.js';\nimport { buildShield, SHIELD_CATALOG } from './shields.js';",
)
rep(
    'src/characters/paperdollPayload.js',
    "{ name: 'Longsword', hands: '1h', pack: packPiece(buildSword(steel)), items: items(WEAPONS.Longsword) },\n        { name: 'Claymore', hands: '2h', pack: packPiece(buildClaymore(steel)), items: items(WEAPONS.Claymore) },\n        { name: 'Long Bow', hands: 'bow', pack: packPiece(buildLongBow(steel)), items: items(WEAPONS.Long_Bow) },\n        { name: 'Short Bow', hands: 'bow', pack: packPiece(buildShortBow(steel)), items: items(WEAPONS.Short_Bow) },",
    "{ name: 'Longsword', templateIndex: WEAPONS.Longsword, hands: '1h', pack: packPiece(buildSword(steel)), items: items(WEAPONS.Longsword) },\n        { name: 'Claymore', templateIndex: WEAPONS.Claymore, hands: '2h', pack: packPiece(buildClaymore(steel)), items: items(WEAPONS.Claymore) },\n        { name: 'Long Bow', templateIndex: WEAPONS.Long_Bow, hands: 'bow', pack: packPiece(buildLongBow(steel)), items: items(WEAPONS.Long_Bow) },\n        { name: 'Short Bow', templateIndex: WEAPONS.Short_Bow, hands: 'bow', pack: packPiece(buildShortBow(steel)), items: items(WEAPONS.Short_Bow) },",
)
rep(
    'src/characters/paperdollPayload.js',
    "list.push({ name: nm.replace('_', '-'), hands: BLADE_SPECS[nm].twoHand ? '2h' : '1h', pack: packPiece(buildBladeWeapon(steel, nm)), items: items(WEAPONS[nm]) });",
    "list.push({ name: nm.replace('_', '-'), templateIndex: WEAPONS[nm], hands: BLADE_SPECS[nm].twoHand ? '2h' : '1h', pack: packPiece(buildBladeWeapon(steel, nm)), items: items(WEAPONS[nm]) });",
)
rep(
    'src/characters/paperdollPayload.js',
    "list.push({ name: nm.replace('_', ' '), hands: HAFTED_SPECS[nm].twoHand ? '2h' : '1h', pack: packPiece(buildHaftedWeapon(steel, nm)), items: items(WEAPONS[nm]) });",
    "list.push({ name: nm.replace('_', ' '), templateIndex: WEAPONS[nm], hands: HAFTED_SPECS[nm].twoHand ? '2h' : '1h', pack: packPiece(buildHaftedWeapon(steel, nm)), items: items(WEAPONS[nm]) });",
)
rep(
    'src/characters/paperdollPayload.js',
    "    swordRamps: Object.fromEntries(Object.entries(WEAPON_MATERIALS).filter(([, v]) => v >= 0).map(([n, v]) => [n, weaponMaterialRamp(v, (i) => pal.get(i))])),",
    "    shieldPacks: SHIELD_CATALOG.map((s) => ({ ...s, pack: packPiece(buildShield(STEEL_RAMP, s.index)) })),\n    swordRamps: Object.fromEntries(Object.entries(WEAPON_MATERIALS).filter(([, v]) => v >= 0).map(([n, v]) => [n, weaponMaterialRamp(v, (i) => pal.get(i))])),",
)

# Viewer imports.
rep(
    'src/tools/paperdollViewer.js',
    "import { buildClassicBodyArmorSampler, buildClassicArmorPieceTexture } from './paperdoll/armorTexture.js';",
    "import { buildClassicBodyArmorSampler, buildClassicArmorPieceTexture } from './paperdoll/armorTexture.js';\nimport { buildClassicWeaponPieceTexture, buildClassicShieldPieceTexture } from './paperdoll/weaponTexture.js';",
)

# Keep shield texture in sync with the armor-material matrix. Function declarations
# are hoisted; the actual calls occur after shield state has been initialised.
rep(
    'src/tools/paperdollViewer.js',
    "    syncSelectedArmorTextures(),\n  ]);\n  setDrape();",
    "    syncSelectedArmorTextures(),\n    syncShieldTexture(),\n  ]);\n  setDrape();",
)

# Weapon source texture ownership + complete shield family.
rep(
    'src/tools/paperdollViewer.js',
    "let wpnIx = 0;\nconst activeWpn = () => WEAPON_DEFS[wpnIx];\nconst swordMesh = WEAPON_DEFS[0].mesh;   // legacy alias",
    "let wpnIx = 0;\nconst activeWpn = () => WEAPON_DEFS[wpnIx];\nlet weaponTextureToken = 0;\nlet weaponTextureState = null;\nfunction clearWeaponTexture() {\n  const st = weaponTextureState;\n  if (!st) return;\n  st.mesh.material.map = null;\n  st.mesh.material.vertexColors = true;\n  st.mesh.material.needsUpdate = true;\n  st.texture?.dispose?.();\n  weaponTextureState = null;\n}\nfunction mountWeaponTexture(w, art) {\n  clearWeaponTexture();\n  if (!w?.mesh || !art?.canvas || !art?.uv) return;\n  w.mesh.geometry.setAttribute('uv', new THREE.BufferAttribute(art.uv, 2));\n  const texture = new THREE.CanvasTexture(art.canvas);\n  texture.magFilter = THREE.NearestFilter;\n  texture.minFilter = THREE.NearestFilter;\n  texture.generateMipmaps = false;\n  w.mesh.material.map = texture;\n  w.mesh.material.vertexColors = false;\n  w.mesh.material.needsUpdate = true;\n  weaponTextureState = { mesh: w.mesh, texture };\n}\nfunction drawHeldTextureQA(kind, name, art) {\n  if (!art?.debug) return;\n  drawClassicTextureQA(art.debug);\n  const status = document.getElementById('clothqastatus');\n  if (status) status.textContent = kind + ' · ' + name + ' · ' + art.meta.source + ' record ' + art.meta.record\n    + ' · traced source → canonical 3D surface → 8-way voxel wrap';\n}\nasync function syncActiveWeaponTexture() {\n  const token = ++weaponTextureToken;\n  clearWeaponTexture();\n  if (swordIx < 0) return null;\n  const w = activeWpn(), matName = SWORD_MATS[swordIx], item = w?.items?.[matName];\n  if (!w?.pack || !item) return null;\n  try {\n    const art = await buildClassicWeaponPieceTexture({\n      templateIndex: w.templateIndex, pack: w.pack, material: item.nativeMaterialValue, gender,\n    });\n    if (token !== weaponTextureToken || w !== activeWpn() || swordIx < 0 || SWORD_MATS[swordIx] !== matName) return null;\n    if (art) { mountWeaponTexture(w, art); drawHeldTextureQA('weapon', w.name + ' · ' + matName, art); }\n    return art?.meta || null;\n  } catch { return null; }\n}\n\nconst SHIELD_DEFS = D.shieldPacks || [];\nconst shieldMeshes = SHIELD_DEFS.map((s) => { const m = s.pack ? buildPiece(s.pack) : null; if (m) m.visible = false; return m; });\nlet shieldIx = -1, shieldTextureToken = 0, shieldTextureState = null;\nfunction clearShieldTexture() {\n  const st = shieldTextureState;\n  if (!st) return;\n  st.mesh.material.map = null; st.mesh.material.vertexColors = true; st.mesh.material.needsUpdate = true;\n  st.texture?.dispose?.(); shieldTextureState = null;\n}\nfunction mountShieldTexture(mesh, art) {\n  clearShieldTexture();\n  if (!mesh || !art?.canvas || !art?.uv) return;\n  mesh.geometry.setAttribute('uv', new THREE.BufferAttribute(art.uv, 2));\n  const texture = new THREE.CanvasTexture(art.canvas); texture.magFilter = THREE.NearestFilter; texture.minFilter = THREE.NearestFilter; texture.generateMipmaps = false;\n  mesh.material.map = texture; mesh.material.vertexColors = false; mesh.material.needsUpdate = true; shieldTextureState = { mesh, texture };\n}\nasync function syncShieldTexture() {\n  const token = ++shieldTextureToken; clearShieldTexture();\n  if (shieldIx < 0) return null;\n  const s = SHIELD_DEFS[shieldIx], mesh = shieldMeshes[shieldIx]; if (!s?.pack || !mesh) return null;\n  try {\n    const art = await buildClassicShieldPieceTexture({ templateIndex: s.index, pack: s.pack, material: armorMaterial, gender, race: RACES[raceIx] });\n    if (token !== shieldTextureToken || SHIELD_DEFS[shieldIx] !== s) return null;\n    if (art) { mountShieldTexture(mesh, art); drawHeldTextureQA('shield', s.name, art); }\n    return art?.meta || null;\n  } catch { return null; }\n}\nfunction setShield(i) {\n  shieldIx = i;\n  shieldMeshes.forEach((m, k) => { if (m) m.visible = k === shieldIx; });\n  clearShieldTexture();\n  const sel = document.getElementById('shield'); if (sel) sel.value = String(i);\n  if (shieldIx >= 0) syncShieldTexture();\n}\n\nconst swordMesh = WEAPON_DEFS[0].mesh;   // legacy alias",
)

# Gender is a real classic weapon archive axis as well as armor/shields.
rep(
    'src/tools/paperdollViewer.js',
    "  if (armorOn.size) await syncSelectedArmorTextures();",
    "  if (armorOn.size) await syncSelectedArmorTextures();\n  if (swordIx >= 0) await syncActiveWeaponTexture();\n  if (shieldIx >= 0) await syncShieldTexture();",
)

# Weapon material toggle keeps procedural ramp as fallback, then asynchronously
# replaces it with the traced classic source texture when ARENA2 is available.
rep(
    'src/tools/paperdollViewer.js',
    "  document.getElementById('sword').textContent = 'sword: ' + (on ? name : 'off');",
    "  document.getElementById('sword').textContent = 'weapon: ' + (on ? name : 'off');",
)
rep(
    'src/tools/paperdollViewer.js',
    "    swordInfo.textContent = `${name} ${it.name} · dmg ${it.minDamage}–${it.maxDamage} · mat ${mod} · hit ${it.toHitModifier >= 0 ? '+' : ''}${it.toHitModifier} · ${it.weightInKg.toFixed(2)}kg · ${it.value}g · cond ${it.maxCondition}`;\n  } else swordInfo.textContent = '';\n};",
    "    swordInfo.textContent = `${name} ${it.name} · dmg ${it.minDamage}–${it.maxDamage} · mat ${mod} · hit ${it.toHitModifier >= 0 ? '+' : ''}${it.toHitModifier} · ${it.weightInKg.toFixed(2)}kg · ${it.value}g · cond ${it.maxCondition}`;\n    syncActiveWeaponTexture();\n  } else { clearWeaponTexture(); swordInfo.textContent = ''; }\n};",
)

# Populate/select the four shields alongside the complete weapon registry.
rep(
    'src/tools/paperdollViewer.js',
    "window.__setWeapon = (i) => { wpnIx = i % WEAPON_DEFS.length; document.getElementById('wpn').value = wpnIx; setSword(swordIx); arrowVisible(); };\n// Attacks:",
    "window.__setWeapon = (i) => { wpnIx = i % WEAPON_DEFS.length; document.getElementById('wpn').value = wpnIx; setSword(swordIx); arrowVisible(); };\n{ const sel = document.getElementById('shield');\n  const none = document.createElement('option'); none.value = '-1'; none.textContent = 'shield: none'; sel.appendChild(none);\n  SHIELD_DEFS.forEach((s, i) => { const o = document.createElement('option'); o.value = String(i); o.textContent = s.name + ' #' + s.index; sel.appendChild(o); });\n  sel.value = '-1'; sel.onchange = (e) => setShield(+e.target.value);\n}\nwindow.__setShield = setShield;\n// Attacks:",
)

# Viewer controls.
rep(
    'viewer.html',
    '  <select id="wpn"></select>\\n  <button id="fpv">view: orbit</button>',
    '  <select id="wpn" title="all classic Daggerfall weapons"></select>\n  <select id="shield" title="all classic Daggerfall shields"></select>\n  <button id="fpv">view: orbit</button>',
)
rep(
    'viewer.html',
    '  <button id="sword">sword: off</button>',
    '  <button id="sword">weapon: off</button>',
)
