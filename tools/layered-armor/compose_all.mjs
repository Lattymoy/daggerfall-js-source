// WORN-ARMOUR: compose every female outfit (each plate combo in all 7 metals, one metal for all its plate pieces), every frame, as
// the input of fix_hood_fragments.py and build_hoodfix.mjs:
// <out>/female/with-hood/<h>-helm_<t>-chest_<l>-legs/f_<rf>.png  (cloak dye 5 Light Brown + the current hood fix: the game's picture)
// <out>/female/no-hood/...  (no cloak)
// usage: node compose_all.mjs <repo> <out> [<record>-<frame>,...]   (needs pngjs)
import fs from 'fs'; import path from 'path'; import { PNG } from 'pngjs';
const [X, OUT, ONLY] = process.argv.slice(2);
const LA = await import(path.resolve(X, 'src/player/eyeOfTheBeholder/layeredArmor.js'));
const V = path.join(X, 'vendor/layered-armor');
const man = JSON.parse(fs.readFileSync(`${V}/manifest.json`)), cman = JSON.parse(fs.readFileSync(`${V}/cloak/manifest.json`));
const dec = (p) => { const b = PNG.sync.read(fs.readFileSync(p)); return { width: b.width, height: b.height, data: b.data }; };
const enc = (img, p) => { const png = new PNG({ width: img.width, height: img.height }); png.data = Buffer.from(img.data); fs.writeFileSync(p, PNG.sync.write(png)); };
const body = 'female', METALS = man.metals;
const cloakOver = (rf) => { const rec = Number(rf.split('-')[0]), m = cman[body], of = m?.overFrames ?? []; return rec >= 20 ? of.includes(rf) : (m?.over ?? [3, 4]).includes(rec % 5) || of.includes(rf); };
const frames = cman[body].frames.filter((rf) => !ONLY || ONLY.split(',').includes(rf));
let n = 0;
for (const combo of Object.keys(man[body].outfits).sort()) {
  const fam = combo.split('_'), plate = fam.includes('plate');
  for (const mi of plate ? METALS.map((_, i) => i) : [null]) {
    const names = fam.map((f) => (f === 'plate' ? METALS[mi] : f));
    const code = fam.map((f) => (f === 'plate' ? `p${mi}` : f[0])).join('');
    const fo = `${names[0]}-helm_${names[1]}-chest_${names[2]}-legs`;
    for (const k of ['with-hood', 'no-hood']) fs.mkdirSync(`${OUT}/${body}/${k}/${fo}`, { recursive: true });
    for (const rf of frames) {
      const strip = dec(`${V}/${body}/${combo}/${rf}.png`);
      const fp = `${V}/hoodfix/${body}/${combo}/${rf}.png`;
      const cloak = { strip: dec(`${V}/cloak/${body}/${rf}.png`), over: cloakOver(rf), noSlivers: cman[body]?.noSlivers === true, fix: fs.existsSync(fp) ? dec(fp) : null };
      enc(LA.composeStrip(strip, `${code}~5`, cloak), `${OUT}/${body}/with-hood/${fo}/f_${rf}.png`);
      enc(LA.composeStrip(strip, code), `${OUT}/${body}/no-hood/${fo}/f_${rf}.png`);
      n++;
    }
  }
}
console.log('outfit-frames', n);
