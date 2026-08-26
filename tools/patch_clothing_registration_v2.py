from pathlib import Path

# ---------------------------------------------------------------------------
# clothingTexture.js: replace destructive row-stretch canonicalization with
# width-preserving row registration, carry garment-class metadata, and expose
# runtime-only QA canvases (raw -> canonical -> 8-way atlas).
# ---------------------------------------------------------------------------
p = Path('src/tools/paperdoll/clothingTexture.js')
s = p.read_text()
start = s.index('// PAPERDOLL ART IS A PRESENTATION LAYER, NOT A SURFACE MAP.')
end = s.index('\nfunction makeSideView(front, side) {', start)
new_block = r'''// PAPERDOLL ART IS A PRESENTATION LAYER, NOT A SURFACE MAP.
//
// V1 removed the skew by stretching every occupied row to the full canonical
// width. That fixed diagonal drift but also changed the artwork's horizontal
// proportions row-by-row: narrow straps became broad bands and local details
// expanded whenever the classic silhouette narrowed.
//
// V2 removes ONLY the paperdoll registration error. We measure the centre of
// every occupied row, translate that row onto one common centreline, preserve
// its original pixel scale, then edge-pad the material field. Interior alpha is
// repaired from nearby authored cloth. The result is still opaque because the
// 3D geometry owns openings/silhouette, but authored widths and motifs survive.
const SOURCE_PROFILE_PATTERNS = Object.freeze([
  [/cloak/i, 'cloak'],
  [/(robe|dress|skirt|toga|surcoat|kimono|mummy|wrap|sash)/i, 'drape'],
  [/(strap|armband|brassiere|loincloth|sandal)/i, 'sparse'],
  [/(boot|shoe)/i, 'foot'],
  [/pants/i, 'legs'],
  [/(open tunic|vest)/i, 'open-torso'],
]);

export function clothingSourceProfile(item) {
  const name = item?.name || '';
  for (const [re, profile] of SOURCE_PROFILE_PATTERNS) if (re.test(name)) return profile;
  return 'torso';
}

export function canonicalizePaperdollTexture(src, profile = 'generic') {
  if (!src?.width || !src?.height || !src.data?.length) return src;
  const spans = new Array(src.height);
  const occupied = [];
  const centres = [];
  for (let y = 0; y < src.height; y++) {
    spans[y] = rowSpan(src, y);
    if (!spans[y]) continue;
    occupied.push(y);
    centres.push((spans[y][0] + spans[y][1]) * 0.5);
  }
  if (!occupied.length) return src;

  const sorted = centres.slice().sort((a, b) => a - b);
  const sourceCentre = sorted[Math.floor(sorted.length * 0.5)];
  const canonicalCentre = (src.width - 1) * 0.5;
  const shearPx = Math.max(...centres) - Math.min(...centres);

  const nearestOccupiedRow = (y) => {
    if (spans[y]) return y;
    for (let d = 1; d < src.height; d++) {
      if (y - d >= 0 && spans[y - d]) return y - d;
      if (y + d < src.height && spans[y + d]) return y + d;
    }
    return occupied[0];
  };

  const out = {
    width: src.width,
    height: src.height,
    data: new Uint8ClampedArray(src.data.length),
  };
  let repairedPixels = 0;
  let borrowedRows = 0;
  let edgePaddedPixels = 0;
  for (let y = 0; y < out.height; y++) {
    const sy = nearestOccupiedRow(y);
    if (sy !== y) borrowedRows++;
    const [x0, x1] = spans[sy];
    const rowCentre = (x0 + x1) * 0.5;
    // Translate the authored row onto the canonical centreline. Do not rescale.
    const rowOffset = rowCentre - canonicalCentre;
    for (let x = 0; x < out.width; x++) {
      const sxUnclamped = x + rowOffset;
      const sx = Math.max(x0, Math.min(x1, sxUnclamped));
      if (sx !== sxUnclamped) edgePaddedPixels++;
      const raw = pixel(src, sx, sy);
      const c = raw[3] ? raw : nearestOpaqueInRow(src, sy, Math.round(sx), x0, x1);
      const o = (y * out.width + x) * 4;
      if (!raw[3]) repairedPixels++;
      out.data[o] = c[3] ? c[0] : 0;
      out.data[o + 1] = c[3] ? c[1] : 0;
      out.data[o + 2] = c[3] ? c[2] : 0;
      out.data[o + 3] = 255;
    }
  }
  out.canonicalMeta = Object.freeze({
    mode: 'paperdoll-surface-v2',
    registration: 'row-centre-translate',
    widthPreserved: true,
    sourceCentre,
    canonicalCentre,
    shearPx,
    profile,
    alphaOwner: 'geometry',
    repairedPixels,
    borrowedRows,
    edgePaddedPixels,
  });
  return out;
}

function buildCanonicalWrapSet(art, item) {
  const source = decodedCrop(art);
  const profile = clothingSourceProfile(item);
  const canonical = canonicalizePaperdollTexture(source, profile);
  const views = generateDirectionalViews(canonical);
  const debug = {
    source: viewToCanvas(source),
    canonical: viewToCanvas(canonical),
    atlas: viewsToAtlasCanvas(views, 4),
  };
  return { source, canonical, views, debug };
}
'''
s = s[:start] + new_block + s[end:]

s = s.replace(
    "const { canonical, views } = buildCanonicalWrapSet(art);",
    "const { canonical, views, debug } = buildCanonicalWrapSet(art, item);",
)
# One body call + one drape call expected.
assert s.count("const { canonical, views, debug } = buildCanonicalWrapSet(art, item);") == 2

body_anchor = "  sampler.ownsFace = (f) => owned.has(f);\n  sampler.wrapIndexForFace = (f) => owned.has(f) ? faceDir[f] : -1;\n"
assert s.count(body_anchor) == 1
s = s.replace(body_anchor, body_anchor + "  sampler.debug = debug;\n", 1)

# Add profile to both body/drape metadata through canonical metadata, and expose
# the same debug triplet on the drape result.
drape_anchor = "  return {\n    canvas: viewsToAtlasCanvas(views, layout.columns),\n    views,\n    layout,\n"
assert s.count(drape_anchor) == 1
s = s.replace(drape_anchor, "  return {\n    canvas: viewsToAtlasCanvas(views, layout.columns),\n    views,\n    layout,\n    debug,\n", 1)
p.write_text(s)

# ---------------------------------------------------------------------------
# clothingCanonicalProbe: V2 must de-skew by translation WITHOUT changing
# authored row scale. Existing alpha/back assertions remain useful.
# ---------------------------------------------------------------------------
p = Path('tools/clothingCanonicalProbe.mjs')
s = p.read_text()
s = s.replace("assert.equal(canonical.canonicalMeta.mode, 'paperdoll-surface-v1');",
              "assert.equal(canonical.canonicalMeta.mode, 'paperdoll-surface-v2');")
s = s.replace(
"// Row unwrapping must remove the source's rightward shear: the same normalized\n// left-edge sample should stay materially stable from top to bottom.\n",
"// Row registration must remove the source's rightward shear without scaling\n// each row. The same authored material sample stays aligned top-to-bottom.\n")
needle = "assert.deepEqual(rgb(canonical, 1, 1), rgb(canonical, 1, 10));\n"
assert s.count(needle) == 1
extra = needle + "assert.equal(canonical.canonicalMeta.widthPreserved, true);\nassert.equal(canonical.canonicalMeta.registration, 'row-centre-translate');\nassert.ok(canonical.canonicalMeta.shearPx >= 3, 'synthetic shear must be measured');\n\n// A two-pixel red centre motif must remain roughly two pixels wide after\n// registration; V1 row stretching expanded narrow details on narrow rows.\nconst redCount = (img, y) => {\n  let n = 0;\n  for (let x = 0; x < img.width; x++) {\n    const [r,g,b] = rgb(img, x, y);\n    if (r > 180 && g < 70 && b < 70) n++;\n  }\n  return n;\n};\nassert.ok(Math.abs(redCount(canonical, 2) - redCount(canonical, 9)) <= 1);\n"
s = s.replace(needle, extra, 1)
p.write_text(s)

# ---------------------------------------------------------------------------
# paperdollViewer.js: retain runtime-only QA canvases and fill the panel whenever
# a clothing texture finishes. No ARENA2-derived pixels are committed.
# ---------------------------------------------------------------------------
p = Path('src/tools/paperdollViewer.js')
s = p.read_text()
anchor = "let classicClothingOn = null;\nlet classicTextureToken = 0;\n"
assert s.count(anchor) == 1
helper = r'''let classicTextureDebug = null;
function drawClassicTextureQA(debug) {
  classicTextureDebug = debug || null;
  const panel = document.getElementById('clothqapanel');
  const status = document.getElementById('clothqastatus');
  const copy = (id, src) => {
    const dst = document.getElementById(id);
    if (!dst) return;
    const g = dst.getContext('2d');
    if (!src) { dst.width = 1; dst.height = 1; g.clearRect(0,0,1,1); return; }
    dst.width = src.width; dst.height = src.height;
    g.imageSmoothingEnabled = false;
    g.clearRect(0, 0, dst.width, dst.height);
    g.drawImage(src, 0, 0);
  };
  copy('clothqa-source', debug?.source);
  copy('clothqa-canonical', debug?.canonical);
  copy('clothqa-atlas', debug?.atlas);
  if (status) status.textContent = debug ? 'raw paperdoll → registered surface → 8-way atlas' : 'select classic clothing with ARENA2 data';
  if (panel && !debug) panel.classList.remove('ready');
  if (panel && debug) panel.classList.add('ready');
}
'''
s = s.replace(anchor, "let classicClothingOn = null;\nlet classicTextureToken = 0;\n" + helper, 1)

# Clear QA whenever the classic clothing texture state is cleared.
clear_anchor = "  setBodyOverlaySampler(null);\n  clearClassicDrapeTexture();\n  if (!c) return null;\n"
assert s.count(clear_anchor) == 1
s = s.replace(clear_anchor, "  setBodyOverlaySampler(null);\n  clearClassicDrapeTexture();\n  drawClassicTextureQA(null);\n  if (!c) return null;\n", 1)

body = "      setBodyOverlaySampler(sampler);\n      return sampler?.meta || null;\n"
assert s.count(body) == 1
s = s.replace(body, "      setBodyOverlaySampler(sampler);\n      drawClassicTextureQA(sampler?.debug);\n      return sampler?.meta || null;\n", 1)

drape = "      mountClassicDrapeTexture(c, art);\n      return art?.meta || null;\n"
assert s.count(drape) == 1
s = s.replace(drape, "      mountClassicDrapeTexture(c, art);\n      drawClassicTextureQA(art?.debug);\n      return art?.meta || null;\n", 1)
p.write_text(s)

# ---------------------------------------------------------------------------
# viewer.html: add one QA button + in-browser comparison panel. This shows only
# pixels loaded from the user's own runtime data store.
# ---------------------------------------------------------------------------
p = Path('viewer.html')
s = p.read_text()
style_anchor = "  button.on { background: #3a3a48; color: #fff; }\n"
assert s.count(style_anchor) == 1
style = style_anchor + r'''  #clothqapanel { position:fixed; z-index:5; top:48px; right:12px; width:min(94vw,520px); max-height:calc(100vh - 140px); overflow:auto; display:none; gap:10px; padding:12px; background:rgba(20,20,26,.96); border:1px solid #34343f; border-radius:12px; color:#b8b8c8; font-size:11px; pointer-events:auto; touch-action:pan-y; }
  #clothqapanel.open { display:grid; }
  #clothqapanel .qaimgs { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:8px; align-items:start; }
  #clothqapanel figure { min-width:0; }
  #clothqapanel figcaption { margin-bottom:4px; color:#8a8a99; }
  #clothqapanel canvas { width:100%; height:auto; min-height:48px; background:#0d0d11; image-rendering:pixelated; border:1px solid #2e2e38; }
'''
s = s.replace(style_anchor, style, 1)
button_anchor = '  <button id="wrapdir" title="snap through the eight generated clothing wrap directions">wrap: free</button>\n'
assert s.count(button_anchor) == 1
s = s.replace(button_anchor, button_anchor + '  <button id="clothtexqa" title="compare raw Daggerfall paperdoll art, registered material surface, and generated wraps">texture QA</button>\n', 1)
body_anchor = '<div id="pxrow" style="position:fixed;'
assert s.count(body_anchor) == 1
panel = r'''<div id="clothqapanel">
  <div id="clothqastatus">select classic clothing with ARENA2 data</div>
  <div class="qaimgs">
    <figure><figcaption>raw paperdoll</figcaption><canvas id="clothqa-source"></canvas></figure>
    <figure><figcaption>registered surface</figcaption><canvas id="clothqa-canonical"></canvas></figure>
    <figure><figcaption>8-way atlas</figcaption><canvas id="clothqa-atlas"></canvas></figure>
  </div>
</div>
'''
s = s.replace(body_anchor, panel + body_anchor, 1)
script_anchor = "  window.__setWrapDirection = show;\n})();\n"
assert s.count(script_anchor) == 1
script = "  window.__setWrapDirection = show;\n  const qa = document.getElementById('clothtexqa');\n  const qap = document.getElementById('clothqapanel');\n  qa.addEventListener('click', () => { qap.classList.toggle('open'); qa.classList.toggle('on', qap.classList.contains('open')); });\n})();\n"
s = s.replace(script_anchor, script, 1)
p.write_text(s)
