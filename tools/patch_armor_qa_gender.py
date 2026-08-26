from pathlib import Path


def rep(path, old, new):
    p = Path(path)
    s = p.read_text()
    if s.count(old) != 1:
        raise SystemExit(f'{path}: expected one anchor, found {s.count(old)}: {old[:100]!r}')
    p.write_text(s.replace(old, new, 1))

rep(
    'viewer.html',
    '  <button id="race">race: Human</button>\n  <button id="tone">tone: Pale</button>',
    '  <button id="gender">gender: male</button>\n  <button id="race">race: Human</button>\n  <button id="tone">tone: Pale</button>',
)

rep(
    'src/tools/paperdollViewer.js',
    'const classicArmorBodySamplers = new Map();\nconst armorPieceTextureState = new Map();',
    'const classicArmorBodySamplers = new Map();\nconst armorPieceTextureState = new Map();\nconst armorTextureDebug = new Map();',
)
rep(
    'src/tools/paperdollViewer.js',
    '  classicArmorBodySamplers.clear();\n  clearAllArmorPieceTextures();\n  syncBodySurfaceSampler();',
    '  classicArmorBodySamplers.clear();\n  armorTextureDebug.clear();\n  clearAllArmorPieceTextures();\n  syncBodySurfaceSampler();',
)
rep(
    'src/tools/paperdollViewer.js',
    '          if (sampler) classicArmorBodySamplers.set(slot, sampler);\n          syncBodySurfaceSampler();',
    '          if (sampler) {\n            classicArmorBodySamplers.set(slot, sampler);\n            armorTextureDebug.set(slot, { debug: sampler.debug, meta: sampler.meta });\n          }\n          syncBodySurfaceSampler();',
)
rep(
    'src/tools/paperdollViewer.js',
    '          if (art) mountArmorPieceTexture(slot, family, art);',
    '          if (art) {\n            mountArmorPieceTexture(slot, family, art);\n            armorTextureDebug.set(slot, { debug: art.debug, meta: art.meta });\n          }',
)
rep(
    'src/tools/paperdollViewer.js',
    '  if (token === classicArmorTextureToken) {\n    syncBodySurfaceSampler();\n    syncArmorPieceVisibility();\n  }',
    '  if (token === classicArmorTextureToken) {\n    syncBodySurfaceSampler();\n    syncArmorPieceVisibility();\n    const qaSlot = [...armorOn].at(-1);\n    const qa = qaSlot ? armorTextureDebug.get(qaSlot) : null;\n    if (qa) drawArmorTextureQA(qaSlot, qa);\n  }',
)

rep(
    'src/tools/paperdollViewer.js',
    "  if (panel && !debug) panel.classList.remove('ready');\n  if (panel && debug) panel.classList.add('ready');\n}\nasync function syncClassicClothingTexture(c = classicClothingOn) {",
    "  if (panel && !debug) panel.classList.remove('ready');\n  if (panel && debug) panel.classList.add('ready');\n}\nfunction drawArmorTextureQA(slot, qa) {\n  drawClassicTextureQA(qa?.debug);\n  const status = document.getElementById('clothqastatus');\n  if (!status || !qa?.meta) return;\n  const materialName = ARMOR_MATERIAL_OPTIONS[armorMaterialIx]?.[0] || 'Steel';\n  status.textContent = slot + ' · ' + materialName\n    + ' · variant ' + qa.meta.variant + (qa.meta.variant !== armorVariant ? ' (requested ' + armorVariant + ')' : '')\n    + ' · ' + qa.meta.source + ' record ' + qa.meta.record\n    + ' · front-registered · 8-way armor wrap';\n}\nasync function syncClassicClothingTexture(c = classicClothingOn) {",
)

rep(
    'src/tools/paperdollViewer.js',
    "window.__gender = (g) => { gender = (g === 'female') ? 'female' : 'male'; SKIN.setFacePick(0); loadFaceSet(); };",
    "async function setGender(g) {\n  gender = (g === 'female') ? 'female' : 'male';\n  SKIN.setFacePick(0);\n  loadFaceSet();\n  const b = document.getElementById('gender');\n  if (b) b.textContent = 'gender: ' + gender;\n  if (armorOn.size) await syncSelectedArmorTextures();\n}\nwindow.__gender = (g) => setGender(g);",
)

rep(
    'src/tools/paperdollViewer.js',
    "syncArmorButtons();\ndocument.getElementById('race').onclick",
    "syncArmorButtons();\ndocument.getElementById('gender').onclick = async () => { await setGender(gender === 'male' ? 'female' : 'male'); };\ndocument.getElementById('race').onclick",
)

# Extend the permanent matrix probe: gender is a real armor archive axis, and
# armor debug must expose raw/canonical/wrap output for visual honing.
rep(
    'tools/variantMatrixProbe.mjs',
    "for (const id of ['armormat', 'armorvariant', 'clothvariant', 'clothdye'])",
    "for (const id of ['gender', 'armormat', 'armorvariant', 'clothvariant', 'clothdye'])",
)
rep(
    'tools/variantMatrixProbe.mjs',
    "assert.ok(viewer.includes('CLOTHING_DYES[classicClothingDyeIx]'), 'viewer must apply clothing dyes');",
    "assert.ok(viewer.includes('CLOTHING_DYES[classicClothingDyeIx]'), 'viewer must apply clothing dyes');\nassert.ok(viewer.includes('if (armorOn.size) await syncSelectedArmorTextures()'), 'race/gender changes must refresh armor archives');\nassert.ok(viewer.includes('drawArmorTextureQA(qaSlot, qa)'), 'armor texture QA must expose the front-registration result');",
)
