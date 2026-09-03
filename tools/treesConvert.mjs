// TR1 — the trees converter.
//
// Reads the partner's Collada pack (a Unity project: Models/<archive>/
// <archive>_<record>.dae beside an atlas PNG per archive) and writes
// public/trees/<archive>.json: one mesh per flat record, ready to wear
// the player's own TEXTURE.<archive> sprite at runtime.
//
// ── WHAT SHIPS AND WHAT DOES NOT ─────────────────────────────────
//
// The GEOMETRY ships. It is our partner's Blender work: leaf-cards and
// crown-cards arranged into a tree, one model per classic flat record.
//
// The ATLAS DOES NOT SHIP, and this tool never copies a pixel of it.
// It is Daggerfall's own tree sprites - TEXTURE.500's records, cut out
// and packed - and Port-Doctrine's second non-negotiable is A RENDER OF
// GAME DATA IS GAME DATA. The atlas is read here for ONE thing: where
// each card's UVs land on it, so those UVs can be re-expressed in the
// SPRITE'S OWN 0..1 space. At runtime the port uploads the classic
// record exactly as it does for the billboard (uploadRecord), and the
// mesh samples that. The tree is the classic sprite, standing in 3D.
//
// ── HOW A CARD FINDS ITS SPRITE ──────────────────────────────────
//
// The atlas is islands of opaque pixels on transparency. Each card's UV
// rectangle sits inside one island. The island's bounding box is the
// sprite's opaque extent, so a card's UVs re-based onto that box are
// its UVs on the sprite's opaque box - and the runtime maps the opaque
// box onto the record's full texture, whose transparent margins it can
// measure once the record is in hand. No pixel matching, no ARENA2
// here: model <archive>_<n> is record n by the pack's own naming, and
// every island it touches is a view of that record.
//
// Cards are tagged by orientation: a VERTICAL card (normal near the
// horizontal plane) is a side view and wears the classic sprite; a
// HORIZONTAL card (normal near vertical) is a crown-top the partner
// synthesised - a view Daggerfall never drew. TR1 ships the tag and
// skips those cards at draw; TR2 synthesises the top from the sprite.
//
// Usage: node tools/treesConvert.mjs <pack>/Models <archive> [more...]
//   e.g. node tools/treesConvert.mjs /path/3D_Trees/Models 500

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
import { join, basename } from 'node:path';
import { PNG } from 'pngjs';

const [, , root, ...archives] = process.argv;
if (!root || !archives.length) {
  console.error('usage: node tools/treesConvert.mjs <pack>/Models <archive> [archive...]');
  process.exit(2);
}

/** Round to the mesh's precision: a tree's cards are metres across and
 *  a millimetre is below anything the eye or the wind will show. */
const r3 = (v) => Math.round(v * 1000) / 1000;
const r4 = (v) => Math.round(v * 10000) / 10000;

// ── Collada ──────────────────────────────────────────────────────

/** Parse one .dae into flat triangle lists: positions, normals, uvs,
 *  per triangle. Handles several <triangles> blocks per mesh and the
 *  per-input offsets Blender writes. Y is up in the data regardless of
 *  the <up_axis> the exporter claims - checked on the pack: the height
 *  runs along y and the crown spreads in x and z. */
function parseDae(text) {
  const arrays = new Map();
  for (const m of text.matchAll(/<float_array id="([^"]+)" count="\d+">([^<]+)<\/float_array>/g)) {
    arrays.set(m[1], m[2].trim().split(/\s+/).map(Number));
  }
  const src = (id) => arrays.get(id.replace(/^#/, '')) ?? arrays.get(id.replace(/^#/, '') + '-array');
  // vertices -> positions indirection
  const vertsMap = new Map();
  for (const m of text.matchAll(/<vertices id="([^"]+)">([\s\S]*?)<\/vertices>/g)) {
    const pos = m[2].match(/<input semantic="POSITION" source="#([^"]+)"/);
    vertsMap.set(m[1], pos[1]);
  }
  const tris = [];
  for (const m of text.matchAll(/<triangles ([^>]*)>([\s\S]*?)<\/triangles>/g)) {
    const inputs = [...m[2].matchAll(/<input semantic="(\w+)" source="#([^"]+)" offset="(\d+)"/g)]
      .map((i) => ({ sem: i[1], src: i[2], off: Number(i[3]) }));
    const stride = Math.max(...inputs.map((i) => i.off)) + 1;
    const idx = m[2].match(/<p>([^<]+)<\/p>/)[1].trim().split(/\s+/).map(Number);
    const by = (sem) => inputs.find((i) => i.sem === sem);
    const P = by('VERTEX'), N = by('NORMAL'), T = by('TEXCOORD');
    const pos = src(vertsMap.get(P.src) ?? P.src), nrm = N ? src(N.src) : null, uv = T ? src(T.src) : null;
    for (let t = 0; t + stride * 3 <= idx.length; t += stride * 3) {
      const tri = { p: [], n: [], uv: [] };
      for (let k = 0; k < 3; k++) {
        const b = t + k * stride;
        const pi = idx[b + P.off]; tri.p.push([pos[pi * 3], pos[pi * 3 + 1], pos[pi * 3 + 2]]);
        if (nrm) { const ni = idx[b + N.off]; tri.n.push([nrm[ni * 3], nrm[ni * 3 + 1], nrm[ni * 3 + 2]]); }
        if (uv) { const ui = idx[b + T.off]; tri.uv.push([uv[ui * 2], uv[ui * 2 + 1]]); }
      }
      tris.push(tri);
    }
  }
  return tris;
}

// ── the atlas: islands of opaque pixels ──────────────────────────

/** Label the atlas's opaque islands (4-connected, alpha > 8) and return
 *  each island's bounding box in atlas pixels, plus a label map. Read
 *  for geometry only: the pixels are never written anywhere. */
function islands(png) {
  const { width: W, height: H, data } = png;
  const label = new Int32Array(W * H).fill(-1);
  const boxes = [];
  const stack = [];
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (label[i] >= 0 || data[i * 4 + 3] <= 8) continue;
      const id = boxes.length;
      const box = { x0: x, y0: y, x1: x, y1: y, n: 0 };
      boxes.push(box); label[i] = id; stack.push(i);
      while (stack.length) {
        const j = stack.pop(); const jx = j % W, jy = (j / W) | 0;
        box.n++;
        if (jx < box.x0) box.x0 = jx; if (jx > box.x1) box.x1 = jx;
        if (jy < box.y0) box.y0 = jy; if (jy > box.y1) box.y1 = jy;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = jx + dx, ny = jy + dy;
          if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
          const k = ny * W + nx;
          if (label[k] >= 0 || data[k * 4 + 3] <= 8) continue;
          label[k] = id; stack.push(k);
        }
      }
    }
  }
  // Sprites are drawn with small detached specks (a leaf, a label
  // digit). Merge any island that sits inside another's box into it,
  // and drop the digits - the numbers the partner wrote beside each
  // record are tiny and never under a card.
  const big = boxes.map((b, i) => ({ ...b, id: i })).filter((b) => b.n >= 24);
  return { label, boxes: big, W, H };
}

/** The island under a card: the one whose box contains the card's UV
 *  centre, else the nearest box by centre distance (a card's UVs can
 *  overhang an island by a texel of filtering margin). */
function islandFor(atlas, u, v) {
  const px = u * atlas.W, py = (1 - v) * atlas.H;     // Collada v is up; PNG rows are down
  let best = null, bestD = Infinity;
  for (const b of atlas.boxes) {
    const inside = px >= b.x0 - 1 && px <= b.x1 + 1 && py >= b.y0 - 1 && py <= b.y1 + 1;
    const cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2;
    const d = inside ? 0 : Math.hypot(px - cx, py - cy);
    if (d < bestD) { bestD = d; best = b; }
  }
  return best;
}

// ── convert ──────────────────────────────────────────────────────

for (const archive of archives) {
  const dir = join(root, String(archive));
  const atlasPath = readdirSync(dir).find((f) => /atlas\.png$/i.test(f) && !/opaque/i.test(f))
    ?? readdirSync(dir).find((f) => /\.png$/i.test(f) && !/opaque/i.test(f));
  if (!atlasPath) { console.error(`${archive}: no atlas`); continue; }
  const atlas = islands(PNG.sync.read(readFileSync(join(dir, atlasPath))));
  const out = { archive: Number(archive), records: {}, stats: { models: 0, tris: 0, sideCards: 0, topCards: 0 } };

  for (const f of readdirSync(dir).filter((n) => n.endsWith('.dae')).sort()) {
    const m = f.match(/_(\d+)\.dae$/); if (!m) continue;
    const record = Number(m[1]);
    const tris = parseDae(readFileSync(join(dir, f), 'utf8'));
    if (!tris.length) continue;

    // Group triangles into CARDS: a card is a run of triangles sharing
    // one island and one facing. Facing from the normal: |n.y| > 0.7 is
    // a horizontal card (a crown top), else vertical (a side view).
    const side = { pos: [], uv: [] }, top = { pos: [], uv: [] };
    let minY = Infinity, maxY = -Infinity, radius = 0;
    for (const t of tris) {
      const n = t.n[0] ?? [0, 0, 1];
      const horizontal = Math.abs(n[1]) > 0.7;
      const cu = (t.uv[0][0] + t.uv[1][0] + t.uv[2][0]) / 3, cv = (t.uv[0][1] + t.uv[1][1] + t.uv[2][1]) / 3;
      const isl = islandFor(atlas, cu, cv);
      const bx = isl.x0, bw = Math.max(1, isl.x1 - isl.x0), by = isl.y0, bh = Math.max(1, isl.y1 - isl.y0);
      const dst = horizontal ? top : side;
      for (let k = 0; k < 3; k++) {
        const [x, y, z] = t.p[k];
        dst.pos.push(r3(x), r3(y), r3(z));
        if (y < minY) minY = y; if (y > maxY) maxY = y;
        const rr = Math.hypot(x, z); if (rr > radius) radius = rr;
        // Re-base onto the island's box: 0..1 across the sprite's opaque
        // extent, v measured DOWN from the sprite's top (texture rows).
        const [u, v] = t.uv[k];
        const su = (u * atlas.W - bx) / bw;
        const sv = ((1 - v) * atlas.H - by) / bh;
        dst.uv.push(r4(Math.min(1.02, Math.max(-0.02, su))), r4(Math.min(1.02, Math.max(-0.02, sv))));
      }
    }
    out.records[record] = {
      height: r3(maxY - minY), base: r3(minY), radius: r3(radius),
      side: { pos: side.pos, uv: side.uv }, top: { pos: top.pos, uv: top.uv },
    };
    out.stats.models++; out.stats.tris += tris.length;
    out.stats.sideCards += side.pos.length / 9; out.stats.topCards += top.pos.length / 9;
  }

  mkdirSync('public/trees', { recursive: true });
  const dest = `public/trees/${archive}.json`;
  writeFileSync(dest, JSON.stringify(out));
  const kb = Math.round(readFileSync(dest).length / 1024);
  console.log(`${archive}: ${out.stats.models} models, ${out.stats.tris} tris (${out.stats.sideCards | 0} side / ${out.stats.topCards | 0} top tris) -> ${dest} ${kb} KB`);
}
