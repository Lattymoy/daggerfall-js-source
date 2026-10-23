// WORN-ARMOUR: build vendor/layered-armor/hoodfix/ from the hand-cleaned hooded frames.
//
// The hooded frames (worn_armour_all_frames, <body>/with-hood: every outfit with a cloak of no dye, Light Brown) were
// cleaned by hand on their own, so they are not always "body + cloak". For every strip this script composes the
// outfit with its cloak (layeredArmor.js, the vendored strips as they are) and compares it with the frame in each
// metal. Where they differ, the pixel goes into hoodfix/<body>/<combo>/<record>-<frame>.png, which composeStrip lays
// over the finished cloaked picture. A strip with no difference gets no file.
//
// A hoodfix strip has the body strip's first 9 tiles: base, slot map (red head, green top, blue legs), the 7 metals.
// A pixel the same in every metal is in the base; one that differs is in the metal tiles, on the slot whose metal it
// follows (as in strips_from_frames.py: the outfit with only that piece in plate shows the same colours there; else
// the body strip's nearest slot). The alpha says how the pixel is laid down:
//   255  the colour, and if it is the cloth's green it takes the cloak's dye (cloth is stored in the green ramp)
//   128  the colour exactly, never dyed
//     1  the pixel is cleared
// A frame colour counts as cloth when the cloaked picture already showed cloak cloth there and some green of the ramp
// dyes Light Brown to exactly that colour, or when fix_hood_fragments.py laid it as cloth (<frames>/<body>/clothmask).
//
// usage: node build_hoodfix.mjs <repo> <frames root with male/with-hood and female/with-hood>   (needs pngjs)
import { readFileSync, readdirSync, writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { PNG } from 'pngjs';

const [root, framesRoot] = process.argv.slice(2);
const LA = await import(pathToFileURL(`${root}/src/player/eyeOfTheBeholder/layeredArmor.js`).href);
const V = `${root}/vendor/layered-armor`;
const man = JSON.parse(readFileSync(`${V}/manifest.json`, 'utf8'));
const cman = JSON.parse(readFileSync(`${V}/cloak/manifest.json`, 'utf8'));
const METALS = man.metals, NT = man.tiles.length, FIX_TILES = 9, DYE = 5;
const SLOT_RGB = [[255, 0, 0], [0, 255, 0], [0, 0, 255]];
const fam = (t) => (t === 'leather' || t === 'chain' ? t : 'plate');
const piece = (t) => (t === 'leather' ? 'l' : t === 'chain' ? 'c' : `p${METALS.indexOf(t)}`);
const rd = (p) => PNG.sync.read(readFileSync(p));
const cloakOver = (body, rf) => { const rec = Number(rf.split('-')[0]), m = cman[body], of = m?.overFrames ?? []; return rec >= 20 ? of.includes(rf) : (m?.over ?? [3, 4]).includes(rec % 5) || of.includes(rf); };

function isCloth(r, g, b) {   // layeredArmor.js isCloth
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  if (d === 0 || mx < 31 || d / mx < 0.15) return false;
  let h;
  if (mx === r) h = (60 * (g - b)) / d; else if (mx === g) h = 120 + (60 * (b - r)) / d; else return false;
  if (h < 0) h += 360;
  return h >= 60 && h <= 165;
}
// Light Brown colour -> a green of the ramp that dyes to it
const UNDYE = new Map();
{
  const ramp = cman.ramp;
  for (let i = 0; i < ramp.length - 1; i++) for (let s = 0; s <= 64; s++) {
    const c = [0, 1, 2].map((k) => Math.round(ramp[i][k] + (ramp[i + 1][k] - ramp[i][k]) * s / 64));
    for (let dr = -2; dr <= 2; dr++) for (let dg = -2; dg <= 2; dg++) for (let db = -2; db <= 2; db++) {
      const g = [c[0] + dr, c[1] + dg, c[2] + db];
      if (g.some((v) => v < 0 || v > 255) || !isCloth(...g)) continue;
      const key = LA.dyeCloth(...g, DYE).join(',');
      if (!UNDYE.has(key)) UNDYE.set(key, g);
    }
  }
}

const stats = {};
for (const body of ['male', 'female']) {
  const sdir = `${framesRoot}/${body}/with-hood`;
  const groups = {};   // combo -> {metal|'': {folder, code}}
  for (const fo of readdirSync(sdir).sort()) {
    const [h, t, l] = /^(\w+)-helm_(\w+)-chest_(\w+)-legs$/.exec(fo).slice(1);
    const combo = [h, t, l].map(fam).join('_');
    const metal = [h, t, l].find((x) => fam(x) === 'plate') ?? '';
    (groups[combo] ??= {})[metal] = { fo, code: piece(h) + piece(t) + piece(l) };
  }
  const names = {};
  for (const g of Object.values(groups)) for (const { fo } of Object.values(g)) {
    names[fo] = {};
    for (const f of readdirSync(`${sdir}/${fo}`)) { const m = /_(\d+-\d+)\.png$/.exec(f); if (m) names[fo][m[1]] = f; }
  }
  const st = stats[body] = { files: 0, px: 0, px_per_metal: 0, cloth: 0, exact: 0, clear: 0, slot_single_piece: 0, slot_nearest: 0 };
  rmSync(`${V}/hoodfix/${body}`, { recursive: true, force: true });
  for (const rf of cman[body].frames) {
    const cs = rd(`${V}/cloak/${body}/${rf}.png`);
    const cloak = { strip: cs, over: cloakOver(body, rf), noSlivers: cman[body]?.noSlivers === true };
    // the frames and the cloaked / plain composition of every outfit
    const T = {}, C = {}, P = {}, strips = {}, MK = {};
    for (const [combo, g] of Object.entries(groups)) {
      strips[combo] = rd(`${V}/${body}/${combo}/${rf}.png`);
      T[combo] = {}; C[combo] = {}; P[combo] = {};
      for (const [metal, { fo, code }] of Object.entries(g)) {
        const t = rd(`${sdir}/${fo}/${names[fo][rf]}`).data;
        for (let i = 0; i < t.length; i += 4) if (!t[i + 3]) t[i] = t[i + 1] = t[i + 2] = 0;
        T[combo][metal] = t;
        const mp = `${framesRoot}/${body}/clothmask/${fo}/${names[fo][rf]}`;   // px fix_hood_fragments.py laid as the cloak's cloth
        (MK[combo] ??= {})[metal] = existsSync(mp) ? rd(mp).data : null;
        C[combo][metal] = LA.composeStrip(strips[combo], `${code}~${DYE}`, cloak).data;
        P[combo][metal] = LA.composeStrip(strips[combo], code).data;
      }
    }
    for (const [combo, g] of Object.entries(groups)) {
      const ks = Object.keys(g), plate = ks[0] !== '';
      const s0 = strips[combo], w = plate ? s0.width / NT : s0.width, h = s0.height, n = w * h;
      const eq = (a, b, i) => a[i] === b[i] && a[i + 1] === b[i + 1] && a[i + 2] === b[i + 2] && a[i + 3] === b[i + 3];
      const diffAt = (Cv, Tv, i) => !(Cv[i + 3] === 0 && Tv[i + 3] === 0) && !eq(Cv, Tv, i);
      const R = [];
      for (let p = 0; p < n; p++) if (ks.some((k) => diffAt(C[combo][k], T[combo][k], p * 4))) R.push(p);
      if (!R.length) continue;
      const tilesN = plate ? FIX_TILES : 1;
      const out = new PNG({ width: w * tilesN, height: h }); out.data.fill(0);
      const put = (tile, p, rgba) => { const o = ((Math.floor(p / w) * w * tilesN) + tile * w + (p % w)) * 4; out.data.set(rgba, o); };
      const enc = (k, p) => {
        const i = p * 4, t = T[combo][k], c = C[combo][k], pl = P[combo][k];
        if (!t[i + 3]) { st.clear++; return [0, 0, 0, 1]; }
        const mk = MK[combo]?.[k];
        const fromCloak = (c[i + 3] && !eq(c, pl, i)) || (mk && mk[i] > 0);
        const green = fromCloak ? UNDYE.get(`${t[i]},${t[i + 1]},${t[i + 2]}`) : null;
        if (green) { st.cloth++; return [...green, 255]; }
        st.exact++;
        return [t[i], t[i + 1], t[i + 2], isCloth(t[i], t[i + 1], t[i + 2]) ? 128 : 255];
      };
      // body strip's slot map, for the nearest-slot fallback
      const slotOf = (p) => { if (!plate) return -1; const o = (Math.floor(p / w) * s0.width + w + (p % w)) * 4; const d = s0.data; if (!d[o + 3]) return -1; return SLOT_RGB.findIndex(([r, gg, b]) => d[o] === r && d[o + 1] === gg && d[o + 2] === b); };
      const fams = combo.split('_');
      for (const p of R) {
        const e = ks.map((k) => enc(k, p));
        st.px++;
        if (e.every((x) => x.join() === e[0].join())) { put(0, p, e[0]); continue; }
        st.px_per_metal++;
        const plateSlots = fams.map((f, i) => (f === 'plate' ? i : -1)).filter((i) => i >= 0);
        const hits = plateSlots.filter((s) => {
          const others = plateSlots.filter((i) => i !== s);
          let repls = [[]];
          for (let j = 0; j < others.length; j++) repls = repls.flatMap((r) => [[...r, 'leather'], [...r, 'chain']]);
          return repls.some((repl) => {
            const f2 = [...fams]; others.forEach((i, j) => { f2[i] = repl[j]; });
            const ref = T[f2.join('_')];
            return ref && METALS.every((m) => eq(ref[m], T[combo][m], p * 4));
          });
        });
        let slot;
        if (hits.length === 1) { slot = hits[0]; st.slot_single_piece++; } else {
          let best = 1e9; slot = plateSlots[plateSlots.length - 1];
          const px = p % w, py = Math.floor(p / w);
          for (let q = 0; q < n; q++) { const s = slotOf(q); if (s < 0) continue; const d = (q % w - px) ** 2 + (Math.floor(q / w) - py) ** 2; if (d < best) { best = d; slot = s; } }
          st.slot_nearest++;
        }
        put(1, p, [...SLOT_RGB[slot], 255]);
        ks.forEach((k, j) => put(2 + METALS.indexOf(k), p, e[j]));
      }
      const o = `${V}/hoodfix/${body}/${combo}/${rf}.png`;
      mkdirSync(`${V}/hoodfix/${body}/${combo}`, { recursive: true });
      writeFileSync(o, PNG.sync.write(out, { colorType: 6 }));
      st.files++;
    }
  }
}
console.log(JSON.stringify(stats, null, 1));
