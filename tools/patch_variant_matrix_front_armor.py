from pathlib import Path


def replace_once(path, old, new):
    p = Path(path)
    s = p.read_text()
    if old not in s:
        raise SystemExit(f'missing patch anchor in {path}: {old[:120]!r}')
    if s.count(old) != 1:
        raise SystemExit(f'non-unique patch anchor in {path}: {s.count(old)} matches')
    p.write_text(s.replace(old, new, 1))

# One home for mapping a concrete Daggerfall armor material to its geometry/art family.
replace_once(
    'src/systems/armorMaterials.js',
    "export const MATERIAL_FAMILY = Object.freeze({ Leather: 0, Chain: 1, Plate: 2 });\nconst MATERIAL_OF_FAMILY = [ARMOR_MATERIAL.Leather, ARMOR_MATERIAL.Chain, ARMOR_MATERIAL.Iron];",
    "export const MATERIAL_FAMILY = Object.freeze({ Leather: 0, Chain: 1, Plate: 2 });\nexport const armorFamilyOfMaterial = (material) =>\n  isLeather(material) ? MATERIAL_FAMILY.Leather\n  : isChain(material) ? MATERIAL_FAMILY.Chain\n  : MATERIAL_FAMILY.Plate;\nconst MATERIAL_OF_FAMILY = [ARMOR_MATERIAL.Leather, ARMOR_MATERIAL.Chain, ARMOR_MATERIAL.Iron];",
)

# Armor needs the same anatomical-axis front reconstruction as torso clothing,
# but it must preserve authored left/right detail instead of eventually replacing
# the whole weak side with a mirror of the strong side.
replace_once(
    'src/tools/paperdoll/clothingTexture.js',
    "  const torsoFront = profile === 'torso' || profile === 'open-torso';",
    "  const armorFront = profile === 'armor-front';\n  const torsoFront = profile === 'torso' || profile === 'open-torso' || armorFront;",
)
replace_once(
    'src/tools/paperdoll/clothingTexture.js',
    "  const openTorso = profile === 'open-torso';\n  const recoveryLo = openTorso ? 1.28 : 1.08;\n  const recoveryHi = openTorso ? 1.95 : 1.55;\n  const frontRecovery = clamp01((sideBias - recoveryLo) / Math.max(1e-6, recoveryHi - recoveryLo));\n  const mirrorDominantHalf = frontRecovery >= 0.985;",
    "  const openTorso = profile === 'open-torso';\n  const recoveryLo = armorFront ? 1.04 : openTorso ? 1.28 : 1.08;\n  const recoveryHi = armorFront ? 1.42 : openTorso ? 1.95 : 1.55;\n  const rawFrontRecovery = clamp01((sideBias - recoveryLo) / Math.max(1e-6, recoveryHi - recoveryLo));\n  // Armor is full of buckles, rivets, crests and trim. Rectify the paperdoll\n  // perspective aggressively, but never throw one authored half away and mirror\n  // the other as clothing may do for an almost side-on shirt. This keeps detail\n  // genuinely left/right while moving it into a front-facing material field.\n  const frontRecovery = armorFront ? Math.min(rawFrontRecovery, 0.58) : rawFrontRecovery;\n  const mirrorDominantHalf = !armorFront && frontRecovery >= 0.985;",
)

# Resolve real material dyes + material-specific variant clamps in armor art.
replace_once(
    'src/tools/paperdoll/armorTexture.js',
    "import {\n  armorArchive,\n  armorVariant,\n  MATERIAL_FAMILY,\n  paperdollRecordOffset,\n} from '../../characters/paperdollArt.js';",
    "import { armorArchive, paperdollRecordOffset } from '../../characters/paperdollArt.js';\nimport { ARMOR_MATERIAL, armorFamilyOfMaterial, clampArmorVariant } from '../../systems/armorMaterials.js';",
)
replace_once(
    'src/tools/paperdoll/armorTexture.js',
    "function dyeForFamily(family) {\n  // Leather + chain use the classic identity metal table. The viewer's Plate\n  // family is surfaced as Steel, matching its existing steel procedural ramp.\n  return family === MATERIAL_FAMILY.Plate ? DYE_COLORS.Steel : DYE_COLORS.Unchanged;\n}\n\nfunction profileForArmor(item) {\n  switch (item?.slot) {\n    case 'cuirass': return 'torso';\n    case 'greaves': return 'legs';\n    case 'boots': return 'foot';\n    default: return 'sparse';\n  }\n}",
    "const ARMOR_DYE = new Map([\n  [ARMOR_MATERIAL.Iron, DYE_COLORS.Iron],\n  [ARMOR_MATERIAL.Steel, DYE_COLORS.Steel],\n  [ARMOR_MATERIAL.Silver, DYE_COLORS.Silver],\n  [ARMOR_MATERIAL.Elven, DYE_COLORS.Elven],\n  [ARMOR_MATERIAL.Dwarven, DYE_COLORS.Dwarven],\n  [ARMOR_MATERIAL.Mithril, DYE_COLORS.Mithril],\n  [ARMOR_MATERIAL.Adamantium, DYE_COLORS.Adamantium],\n  [ARMOR_MATERIAL.Ebony, DYE_COLORS.Ebony],\n  [ARMOR_MATERIAL.Orcish, DYE_COLORS.Orcish],\n  [ARMOR_MATERIAL.Daedric, DYE_COLORS.Daedric],\n]);\nfunction dyeForMaterial(material) { return ARMOR_DYE.get(material) ?? DYE_COLORS.Unchanged; }\n\n// Every armor record was authored on the oblique paperdoll. Even boots and\n// pauldrons need anatomical-axis registration before their detail can be trusted\n// as a 3D surface. armor-front uses V5's split-perspective rectification while\n// deliberately preserving both authored halves (rivets/crests must not mirror).\nfunction profileForArmor() { return 'armor-front'; }",
)
replace_once(
    'src/tools/paperdoll/armorTexture.js',
    "async function loadIndexedArmorArt({ item, race = 'Breton', gender = 'male', family = MATERIAL_FAMILY.Plate, variant = 0 }) {\n  if (!item) return null;\n  const archive = armorArchive(gender, race);\n  const useVariant = item.variants > 0 ? armorVariant(item.index, family, variant | 0) : 0;\n  const record = (item.playerTextureRecord || 0) + useVariant;\n  const { tex, pal, name } = await classicArchive(archive);\n  const bitmap = tex.getDFBitmap(record, 0);\n  if (!bitmap?.width || !bitmap?.height || !bitmap.data?.length) return null;\n  const src = sourceBounds(bitmap);\n  if (!src) return null;\n  const offset = paperdollRecordOffset(tex, archive, record);\n  const dye = dyeForFamily(family);\n  return {\n    bitmap, pal, src, offset, dye,\n    meta: Object.freeze({ archive, record, variant: useVariant, family, dye, source: name, offset: { ...offset } }),\n  };\n}",
    "async function loadIndexedArmorArt({ item, race = 'Breton', gender = 'male', material = ARMOR_MATERIAL.Steel, variant = 0 }) {\n  if (!item) return null;\n  const archive = armorArchive(gender, race);\n  const family = armorFamilyOfMaterial(material);\n  const useVariant = item.variants > 0 ? clampArmorVariant(item.index, material, variant | 0) : 0;\n  const record = (item.playerTextureRecord || 0) + useVariant;\n  const { tex, pal, name } = await classicArchive(archive);\n  const bitmap = tex.getDFBitmap(record, 0);\n  if (!bitmap?.width || !bitmap?.height || !bitmap.data?.length) return null;\n  const src = sourceBounds(bitmap);\n  if (!src) return null;\n  const offset = paperdollRecordOffset(tex, archive, record);\n  const dye = dyeForMaterial(material);\n  return {\n    bitmap, pal, src, offset, dye,\n    meta: Object.freeze({ archive, record, variant: useVariant, material, family, dye, source: name, offset: { ...offset } }),\n  };\n}",
)
replace_once(
    'src/tools/paperdoll/armorTexture.js',
    "export async function buildClassicBodyArmorSampler({ item, delta, D, race = 'Breton', gender = 'male', family = MATERIAL_FAMILY.Plate, variant = 0 }) {\n  if (!item || item.kind !== 'body' || !delta?.idx?.length) return null;\n  const wrap = await buildArmorWrapSet({ item, race, gender, family, variant });",
    "export async function buildClassicBodyArmorSampler({ item, delta, D, race = 'Breton', gender = 'male', material = ARMOR_MATERIAL.Steel, variant = 0 }) {\n  if (!item || item.kind !== 'body' || !delta?.idx?.length) return null;\n  const wrap = await buildArmorWrapSet({ item, race, gender, material, variant });",
)
replace_once(
    'src/tools/paperdoll/armorTexture.js',
    "export async function buildClassicArmorPieceTexture({ item, pack, race = 'Breton', gender = 'male', family = MATERIAL_FAMILY.Plate, variant = 0 }) {\n  if (!item || item.kind !== 'piece' || !pack?.P?.length) return null;\n  const wrap = await buildArmorWrapSet({ item, race, gender, family, variant });",
    "export async function buildClassicArmorPieceTexture({ item, pack, race = 'Breton', gender = 'male', material = ARMOR_MATERIAL.Steel, variant = 0 }) {\n  if (!item || item.kind !== 'piece' || !pack?.P?.length) return null;\n  const wrap = await buildArmorWrapSet({ item, race, gender, material, variant });",
)

# Viewer: expose every concrete armor material, every requested armor variant,
# and every classic clothing variant/dye without changing geometry ownership.
replace_once(
    'src/tools/paperdollViewer.js',
    "import { buildClassicBodyArmorSampler, buildClassicArmorPieceTexture } from './paperdoll/armorTexture.js';\nimport { buildPaperdollPayload } from '../characters/paperdollPayload.js';",
    "import { buildClassicBodyArmorSampler, buildClassicArmorPieceTexture } from './paperdoll/armorTexture.js';\nimport { ARMOR_MATERIAL, armorFamilyOfMaterial } from '../systems/armorMaterials.js';\nimport { CLOTHING_DYES } from '../characters/dyes.js';\nimport { buildPaperdollPayload } from '../characters/paperdollPayload.js';",
)
replace_once(
    'src/tools/paperdollViewer.js',
    "const ARMOR_FAMILY_NAMES = ['Leather', 'Chain', 'Plate'];\nlet armorFamily = D.armorFamilies?.Plate ?? 2;\nconst armorOn = new Set();",
    "const ARMOR_MATERIAL_OPTIONS = Object.freeze(Object.entries(ARMOR_MATERIAL).filter(([, value]) => value >= 0));\nlet armorMaterialIx = Math.max(0, ARMOR_MATERIAL_OPTIONS.findIndex(([name]) => name === 'Steel'));\nlet armorMaterial = ARMOR_MATERIAL_OPTIONS[armorMaterialIx][1];\nlet armorFamily = armorFamilyOfMaterial(armorMaterial);\nlet armorVariant = 0;\nconst armorVariantMax = Math.max(0, ...(D.armor || []).map((a) => Math.max(0, (a.variants || 1) - 1)));\nconst armorOn = new Set();",
)
replace_once(
    'src/tools/paperdollViewer.js',
    "  const token = ++classicArmorTextureToken;\n  const family = armorFamily, race = RACES[raceIx], useGender = gender;",
    "  const token = ++classicArmorTextureToken;\n  const family = armorFamily, material = armorMaterial, variant = armorVariant, race = RACES[raceIx], useGender = gender;",
)
replace_once(
    'src/tools/paperdollViewer.js',
    "          const sampler = await buildClassicBodyArmorSampler({ item, delta: pack, D, race, gender: useGender, family });\n          if (token !== classicArmorTextureToken || armorFamily !== family || !armorOn.has(slot)) return;",
    "          const sampler = await buildClassicBodyArmorSampler({ item, delta: pack, D, race, gender: useGender, material, variant });\n          if (token !== classicArmorTextureToken || armorFamily !== family || armorMaterial !== material || armorVariant !== variant || !armorOn.has(slot)) return;",
)
replace_once(
    'src/tools/paperdollViewer.js',
    "          const art = await buildClassicArmorPieceTexture({ item, pack, race, gender: useGender, family });\n          if (token !== classicArmorTextureToken || armorFamily !== family || !armorOn.has(slot)) return;",
    "          const art = await buildClassicArmorPieceTexture({ item, pack, race, gender: useGender, material, variant });\n          if (token !== classicArmorTextureToken || armorFamily !== family || armorMaterial !== material || armorVariant !== variant || !armorOn.has(slot)) return;",
)
replace_once(
    'src/tools/paperdollViewer.js',
    "  const matBtn = document.getElementById('armormat');\n  if (matBtn) matBtn.textContent = 'armor: ' + (ARMOR_FAMILY_NAMES[armorFamily] || 'Plate');",
    "  const matBtn = document.getElementById('armormat');\n  if (matBtn) matBtn.textContent = 'armor: ' + (ARMOR_MATERIAL_OPTIONS[armorMaterialIx]?.[0] || 'Steel');\n  const variantBtn = document.getElementById('armorvariant');\n  if (variantBtn) variantBtn.textContent = 'armor variant: ' + armorVariant;",
)

replace_once(
    'src/tools/paperdollViewer.js',
    "let classicClothingOn = null;\nlet classicTextureToken = 0;\nlet classicTextureDebug = null;",
    "let classicClothingOn = null;\nlet classicClothingVariant = 0;\nlet classicClothingDyeIx = 0;\nconst CLOTHING_DYE_NAMES = Object.freeze(['Blue','Grey','Red','Dark Brown','Purple','Light Brown','White','Aquamarine','Yellow','Green']);\nfunction syncClassicClothingControls() {\n  const c = classicClothingOn;\n  const vb = document.getElementById('clothvariant');\n  const db = document.getElementById('clothdye');\n  if (vb) vb.textContent = c\n    ? 'cloth variant: ' + classicClothingVariant + '/' + Math.max(0, (c.variants || 1) - 1)\n    : 'cloth variant: -';\n  if (db) db.textContent = 'cloth dye: ' + CLOTHING_DYE_NAMES[classicClothingDyeIx];\n}\nlet classicTextureToken = 0;\nlet classicTextureDebug = null;",
)
replace_once(
    'src/tools/paperdollViewer.js',
    "      const sampler = await buildClassicBodyClothingSampler({ item: c, D, race: RACES[raceIx] });",
    "      const sampler = await buildClassicBodyClothingSampler({ item: c, D, race: RACES[raceIx], variant: classicClothingVariant, dye: CLOTHING_DYES[classicClothingDyeIx] });",
)
replace_once(
    'src/tools/paperdollViewer.js',
    "      const art = await buildClassicDrapeTextureCanvas({ item: c, race: RACES[raceIx] });",
    "      const art = await buildClassicDrapeTextureCanvas({ item: c, race: RACES[raceIx], variant: classicClothingVariant, dye: CLOTHING_DYES[classicClothingDyeIx] });",
)
replace_once(
    'src/tools/paperdollViewer.js',
    "      const c = (D.clothing || []).find((x) => String(x.index) === sel.value) || null;\n      for (const other of ['villager', 'orc', 'undead', 'classes', 'atronach', 'beast', 'daedra']) {",
    "      const c = (D.clothing || []).find((x) => String(x.index) === sel.value) || null;\n      classicClothingVariant = 0;\n      for (const other of ['villager', 'orc', 'undead', 'classes', 'atronach', 'beast', 'daedra']) {",
)
replace_once(
    'src/tools/paperdollViewer.js',
    "      applyClassicClothing(c);\n      const hud = document.getElementById('hud');",
    "      applyClassicClothing(c);\n      syncClassicClothingControls();\n      const hud = document.getElementById('hud');",
)
replace_once(
    'src/tools/paperdollViewer.js',
    "}\n\n// ── ORC LINE picker (editor only) ────────────────────────────────",
    "}\nsyncClassicClothingControls();\n{\n  const btn = document.getElementById('clothvariant');\n  if (btn) btn.onclick = async () => {\n    const c = classicClothingOn;\n    if (!c) return;\n    const count = Math.max(1, c.variants || 1);\n    classicClothingVariant = (classicClothingVariant + 1) % count;\n    syncClassicClothingControls();\n    await syncClassicClothingTexture(c);\n  };\n}\n{\n  const btn = document.getElementById('clothdye');\n  if (btn) btn.onclick = async () => {\n    classicClothingDyeIx = (classicClothingDyeIx + 1) % CLOTHING_DYES.length;\n    syncClassicClothingControls();\n    if (classicClothingOn) await syncClassicClothingTexture(classicClothingOn);\n  };\n}\n\n// ── ORC LINE picker (editor only) ────────────────────────────────",
)
replace_once(
    'src/tools/paperdollViewer.js',
    "  if (btn) btn.onclick = async () => {\n    armorFamily = (armorFamily + 1) % 3;\n    await rebuildArmorWardrobe();\n  };\n}\nsyncArmorButtons();",
    "  if (btn) btn.onclick = async () => {\n    armorMaterialIx = (armorMaterialIx + 1) % ARMOR_MATERIAL_OPTIONS.length;\n    armorMaterial = ARMOR_MATERIAL_OPTIONS[armorMaterialIx][1];\n    armorFamily = armorFamilyOfMaterial(armorMaterial);\n    await rebuildArmorWardrobe();\n  };\n}\n{\n  const btn = document.getElementById('armorvariant');\n  if (btn) btn.onclick = async () => {\n    armorVariant = armorVariantMax ? (armorVariant + 1) % (armorVariantMax + 1) : 0;\n    await rebuildArmorWardrobe();\n  };\n}\nsyncArmorButtons();",
)

# Viewer controls for the two complete matrices.
replace_once(
    'viewer.html',
    "  <button id=\"armormat\">armor: Plate</button>\n  <button id=\"armor-cuirass\">cuirass</button>",
    "  <button id=\"armormat\">armor: Steel</button>\n  <button id=\"armorvariant\">armor variant: 0</button>\n  <button id=\"armor-cuirass\">cuirass</button>",
)
replace_once(
    'viewer.html',
    "  <select id=\"clothing\" title=\"classic Daggerfall clothing\"></select>\n  <button id=\"wrapdir\"",
    "  <select id=\"clothing\" title=\"classic Daggerfall clothing\"></select>\n  <button id=\"clothvariant\">cloth variant: -</button>\n  <button id=\"clothdye\">cloth dye: Blue</button>\n  <button id=\"wrapdir\"",
)

# Update the existing regression probe to the concrete-material path.
replace_once(
    'tools/armorTextureLayersProbe.mjs',
    "assert.ok(armorTex.includes('armorVariant(item.index, family'), 'armor must use classic material-family variant clamps');",
    "assert.ok(armorTex.includes('clampArmorVariant(item.index, material'), 'armor must use the concrete classic material variant clamp');\nassert.ok(armorTex.includes(\"profileForArmor() { return 'armor-front'; }\"), 'armor must use detail-preserving front registration');",
)
replace_once(
    'tools/armorTextureLayersProbe.mjs',
    "assert.ok(viewer.includes('buildClassicArmorPieceTexture({ item, pack, race, gender: useGender, family })'), 'piece armor must receive source textures');",
    "assert.ok(viewer.includes('buildClassicArmorPieceTexture({ item, pack, race, gender: useGender, material, variant })'), 'piece armor must receive concrete material + variant source textures');",
)
