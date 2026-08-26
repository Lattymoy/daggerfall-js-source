// The BODY SKIN and the BAKED HEADS: everything that paints the figure's
// texture, lifted out of paperdollViewer.js whole.
//
// WHY IT IS A MODULE. The viewer was 1482 lines of interleaved concerns - the
// audit found `arena2` spanning lines 105..1475 and `geometry` 110..1475, so
// most of it does not cut cleanly. This block does: it is contiguous, and it
// reaches outside itself for exactly thirteen things, which are now declared
// parameters instead of ambient globals.
//
// WHAT IT OWNS
//   skin-intensity.png        the body's per-texel intensity, race-independent
//   skin-intensity-beast.png  the same map low-passed, for fur and scales
//   skin-uv.json              per-corner UVs in buildNeutralBody's face order
//   skin/heads/<race>-<n>.png one baked head cell per face, loaded ON DEMAND
//   <race>-skin-ramps.json    the body ramp each head implies
//
// NEVER TRAPS: every asset here is optional. No UVs or no intensity map and
// setBodySkin falls through to setBodyRamp; no head cell and the head falls
// through to the FACE*.CIF sprite; no beast map and fur uses the human one.
// The same law the title screen follows.

export function createSkin(ctx) {
  const { THREE, D, geo, mat, nf, TRI, RACES, RACE_KEY, snapRamp, setBodyRamp,
          getRaceIx, getGender, onReady } = ctx;
  // ── THE BAKED SKIN ────────────────────────────────────────────────────────
  // public/skin/ carries a per-TEXEL intensity map baked from our own generated
  // turnaround (tools/skin/README.md), plus per-corner UVs in buildNeutralBody's
  // own face order. It replaces the per-FACE `D.Ib` byte and nothing else: race
  // is still snapRamp(ramp, i), so every tone and both beast ramps apply unchanged.
  // NEVER TRAPS: if either file is absent, skinTex stays null and setBodySkin
  // falls through to setBodyRamp, exactly as the title screen falls back.
  let skinI = null, skinTexCanvas = null, skinTex = null, skinLayout = null;
  // The body atlas is baked from a HUMAN turnaround, so it carries human anatomy:
  // pectorals, abdominals, navel. Tinting that fur-brown leaves a Khajiit with a
  // six-pack, so the fur and scale races use a smoothed copy - broad form shading
  // kept, fine detail (measured amplitude 13-18 per texel) removed.
  let skinIBeast = null;
  const BEAST = { Khajiit: 1, Argonian: 1 };

  // THE RIG FINGERPRINT. Face count is not enough to certify a UV file: a sculpt
  // can move every vertex while preserving the number/order of quads. New skin
  // bakes carry an FNV-1a hash over the SAME packed positions and group ids D
  // carries. Old assets have no hash and keep the historical count-only fallback;
  // once regenerated, a stale atlas refuses to mount instead of wrapping the
  // wrong geometry and looking like a texture bug.
  function liveRigHash() {
    let h = 2166136261 >>> 0;
    const mix = (value) => {
      const u = value >>> 0;
      for (const shift of [0, 8, 16, 24]) {
        h ^= (u >>> shift) & 0xff;
        h = Math.imul(h, 16777619) >>> 0;
      }
    };
    mix(nf);
    for (let f = 0; f < nf; f++) {
      mix(D.G ? D.G[f] : 0);
      const b = f * 12;
      for (let i = 0; i < 12; i++) mix(D.P[b + i] || 0);
    }
    return h.toString(16).padStart(8, '0');
  }

  // THE BAKED HEADS. public/skin/heads/ carries one cell per face, baked from our
  // own generated turnarounds (tools/skin/head_bake.py) - no ARENA2, so they
  // ship. Each face also implies its own body ramp, because the ten are not one
  // skin tone (lit skin R 161..209), and the head is the authority on that.
  let headCells = null, skinRamps = null, headPick = 0, headRace = null;
  // ONE cell, on demand. The set is ten 1344x512 PNGs at ~400KB; loading all of
  // them cost 4 MB per race change and nine were thrown away every time.
  async function ensureHead(i) {
    if (!headRace || !headCells || headCells[i]) return;
    const key = headRace;
    try {
      const im = await new Promise((res, rej) => {
        const el = new Image(); el.onload = () => res(el); el.onerror = rej;
        el.src = `./skin/heads/${key}-${i}.png`;
      });
      if (headRace === key) headCells[i] = im;      // a later race may have won
    } catch { /* missing cell: the CIF sprite path still works */ }
  }
  const HEAD_SET = { Breton: 'breton', Redguard: 'redguard', Nord: 'nord',
    'Dark Elf': 'darkelf', 'High Elf': 'highelf', 'Wood Elf': 'woodelf',
    Argonian: 'argonian', Khajiit: 'khajiit' };
  async function loadHeads() {
    const key = HEAD_SET[RACES[getRaceIx()]];
    if (!key) { headCells = null; skinRamps = null; headRace = null; onReady(); return; }
    if (headRace === key) return;                                // already loaded
    headRace = key;
    try {
      skinRamps = await fetch(`./skin/${key}-skin-ramps.json`).then((r) => r.ok ? r.json() : null);
    } catch { skinRamps = null; }
    headCells = new Array(10).fill(null);
    await ensureHead(headPick);
      if (headRace === key) onReady();                           // a later race may have won
  }
  async function loadSkin() {
    try {
      const [uv, lay, img] = await Promise.all([
        fetch('./skin/skin-uv.json').then((r) => r.ok ? r.json() : Promise.reject()),
        fetch('./skin/skin-layout.json').then((r) => r.ok ? r.json() : Promise.reject()),
        new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i);
          i.onerror = rej; i.src = './skin/skin-intensity.png'; }),
      ]);
      // Every check happens BEFORE installing UVs. A partially compatible skin
      // must fall all the way back to per-face ramps, never half-mount.
      if (uv.n !== nf) return;
      if (!Array.isArray(uv.uv) || uv.uv.length !== nf * 8) return;
      if (uv.w !== img.width || uv.h !== img.height) return;
      if (uv.rigHash && uv.rigHash !== liveRigHash()) return;
      skinLayout = lay;
      const uvs = new Float32Array(nf * 6 * 2);
      let q = 0;
      for (let f = 0; f < nf; f++) for (const vi of TRI) {
        uvs[q++] = uv.uv[f * 8 + vi * 2]; uvs[q++] = uv.uv[f * 8 + vi * 2 + 1];
      }
      geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
      const c = document.createElement('canvas');
      c.width = img.width; c.height = img.height;
      const g2 = c.getContext('2d'); g2.drawImage(img, 0, 0);
      skinI = g2.getImageData(0, 0, c.width, c.height);
      try {
        const bi = await new Promise((res, rej) => { const i = new Image();
          i.onload = () => res(i); i.onerror = rej; i.src = './skin/skin-intensity-beast.png'; });
        if (bi.width !== c.width || bi.height !== c.height) {
          throw new Error('stale beast skin dimensions');
        }
        const bc = document.createElement('canvas');
        bc.width = bi.width; bc.height = bi.height;
        bc.getContext('2d').drawImage(bi, 0, 0);
        skinIBeast = bc.getContext('2d').getImageData(0, 0, bc.width, bc.height);
      } catch { skinIBeast = null; }   // no beast map: the human one still works
      skinTexCanvas = document.createElement('canvas');
      skinTexCanvas.width = c.width; skinTexCanvas.height = c.height;
      skinTex = new THREE.CanvasTexture(skinTexCanvas);
      skinTex.magFilter = THREE.NearestFilter; skinTex.minFilter = THREE.NearestFilter;
      skinTex.generateMipmaps = false;
      onReady();
    } catch { /* no skin assets: the ramp path still works */ }
  }
  // paint the intensity map through this race's ramp - the same snapRamp the
  // per-face path uses, so a race is still nothing more than a ramp swap
  // THE FACE IS A SPRITE, so it is composited at RUNTIME from the user's own
  // FACE*.CIF rather than baked into public/skin/ - a render of game data is
  // game data (test/doctrine.test.js). The head cell ships carrying geometry
  // shading only; this paints the chosen record into its FRONT ARC, so the
  // skull keeps its ramp all the way round and the face layers over the front.
  let facePick = 0;
  const faceCache = new Map();          // archive name -> decoded records
  let faceSet = D.faceSet || null;      // boot set (FACE00I0), replaced per race
  async function loadFaceSet() {
    const R = RACES[getRaceIx()];
    let name;
    try {
      const { raceArt } = await import('../../systems/races.js');
      name = raceArt(RACE_KEY[R], getGender()).heads;
    } catch { return; }
    if (faceCache.has(name)) { faceSet = faceCache.get(name); onReady(); return; }
    try {
      const [{ getBytes }, { DFPalette }, { CifRciFile }] = await Promise.all([
        import('../../scenes/dataSource.js'),
        import('../../formats/dfPalette.js'),
        import('../../formats/cifRciFile.js'),
      ]);
      const p2 = new DFPalette(); p2.load(await getBytes('ART_PAL.COL'), 'ART_PAL.COL');
      const c2 = new CifRciFile(); c2.load(await getBytes(name), name, p2);
      const set = [];
      for (let r = 0; r < 10; r++) {
        try {
          const b = c2.getDFBitmap(r, 0);
          const rgba = [];
          for (let i2 = 0; i2 < b.data.length; i2++) {
            const idx = b.data[i2];
            if (idx) { const c = p2.get(idx); rgba.push(c.r, c.g, c.b, 255); } else rgba.push(0, 0, 0, 0);
          }
          set.push({ w: b.width, h: b.height, rgba });
        } catch { break; }
      }
      if (!set.length) return;
      faceCache.set(name, set); faceSet = set; onReady();
    } catch { /* no ARENA2: the head keeps its ramp, as it always did */ }
  }
  function paintFace(ctx) {
    const c = (skinLayout || {}).head, set = faceSet;
    if (!c || !set || !set.length) return;
    const f = set[facePick % set.length];
    const [a0, a1] = c.faceArc || [0.25, 0.75];
    const dx = Math.round(c.x + a0 * c.w), dw = Math.max(1, Math.round((a1 - a0) * c.w));
    const src = ctx.createImageData(f.w, f.h);
    src.data.set(f.rgba);
    const tmp = document.createElement('canvas');
    tmp.width = f.w; tmp.height = f.h;
    tmp.getContext('2d').putImageData(src, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(tmp, dx, c.y, dw, c.h);
  }
  function setBodySkin(ramp) {
    if (!skinI || !skinTex) { setBodyRamp(ramp); return; }
    // each face's own head implies its own body tone, so the neck matches the jaw
    const rr = (skinRamps && skinRamps[headPick]) ? skinRamps[headPick] : ramp;
    ramp = rr;
    const beast = BEAST[RACES[getRaceIx()]] && skinIBeast;
    const src = (beast ? skinIBeast : skinI).data;
    const out = skinTexCanvas.getContext('2d').createImageData(skinI.width, skinI.height);
    for (let i = 0; i < src.length; i += 4) {
      const c = snapRamp(ramp, src[i]);
      out.data[i] = c[0]; out.data[i + 1] = c[1]; out.data[i + 2] = c[2]; out.data[i + 3] = 255;
    }
    const ctx = skinTexCanvas.getContext('2d');
    ctx.putImageData(out, 0, 0);
    // the baked head REPLACES the head cell's geometry shading
    const hc = skinLayout && skinLayout.head;
    if (hc && headCells && headCells[headPick]) {
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(headCells[headPick], hc.x, hc.y, hc.w, hc.h);
    } else {
      paintFace(ctx);          // no baked head: fall back to the CIF sprite
    }
    skinTex.needsUpdate = true;
    if (mat.map !== skinTex) { mat.map = skinTex; mat.vertexColors = false; mat.needsUpdate = true; }
  }

  return { loadSkin, loadHeads, loadFaceSet, ensureHead, setBodySkin,
           setHeadPick: (i) => { headPick = ((i % 10) + 10) % 10; },
           setFacePick: (i) => { facePick = ((i % 10) + 10) % 10; },
           getHeadPick: () => headPick };
}