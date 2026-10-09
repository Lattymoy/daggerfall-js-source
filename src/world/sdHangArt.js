// @ts-check
// SD-LOOK S11 (2026-10-09, the Abyss Dungeon's look; bible/11-Multiplayer/Super-Dungeons-Look.md section 6): THE HANG'S
// ART - the two pictures what hangs under the islands wears that the realm's own do not (the roots wear its strata strip,
// the gear rims its brass, the far islands its flags): painted through the Hour's paint box (world/sdPixelKit.js) from its
// ramps (world/sdLook.js SD_RAMP), records of the realm's archive (world/sdRealm.js SD_REALM_ARCHIVE) beside its own.
//
//   works - the Works' dark brass (world/sdWorksModel.js SD_WORKS_RECORD): one picture over a whole gear's face, its
//           grain and plates 4-8 texels wide (the gear is 40-80 m across, seen from 250 m - no finer grain survives
//           without mips); its first rows the tooth tips' rubbed brass, alight at the ambient rung - the Works' glints,
//           the only light they have. Metal is structure: the rest has none.
//   chain - the chains' links (world/sdIslandModel.js SD_CHAIN_RECORD): dark brass, its outer walls rubbed where the links
//           bear, verdigris in its inner bends. No light of its own.
//
// Not a DFU member. Ledger A (SUPER-DUNGEONS).
import { SD_RAMP } from './sdLook.js';
import { rng, noiseField, image, putTexel, scale, ramp, step, bevel, rivet, paletteOf, quantize } from './sdPixelKit.js';

/** The Works' tooth tips' light, of their colour (the ambient rung, L2 - a glint through 250 m of haze). */
export const SD_WORKS_TIP_GLOW = 0.42;
/** The rows of the Works' picture its tip band takes (world/sdWorksModel.js SD_WORKS_TIP_V reads inside them). */
export const SD_WORKS_TIP_ROWS = 7;

const { brass: Br, verdigris: Vg, void: Vo } = SD_RAMP;
/** Blackened brass: the void's dark steps under the brass's deepest - the Works stand black against the furnace. */
const BLACKENED = Object.freeze([Vo[1], Vo[2], Br[0], Br[1]]);

/** The Works' dark brass, 64 texels: the tip band's rubbed brass alight, then a gear's face in blackened plates - a broad
 *  grain, bevelled seams every 16 texels catching a line of brass, a rivet a plate, verdigris in the seams' corners. */
export function worksArt(seed = 0x5d1180) {
  const S = 64, albedo = image(S), emission = image(S), r = rng(seed);
  const broad = noiseField(seed, 4, S), grain = noiseField(seed + 1, 8, S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    if (y < SD_WORKS_TIP_ROWS) {
      const c = step(Br, y < 2 ? 5 : 4);
      putTexel(albedo, x, y, c); putTexel(emission, x, y, scale(c, SD_WORKS_TIP_GLOW));
      continue;
    }
    putTexel(albedo, x, y, ramp(BLACKENED, 0.1 + 0.32 * broad(x, y) + 0.16 * (grain(x, y) - 0.5), x, y)); putTexel(emission, x, y, [0, 0, 0]);
  }
  // the plates: 16-texel squares under the tip band, each bevelled (lit top-left), a rivet at a corner, verdigris in a seam
  for (let py = SD_WORKS_TIP_ROWS + 1; py + 16 <= S + 8; py += 16) for (let px = 0; px < S; px += 16) {
    const h = Math.min(16, S - py);
    if (h < 4) continue;
    bevel(albedo, px, py, 16, h, step(Br, 1), step(Vo, 0));
    if (h >= 8) rivet(albedo, px + 4, py + 4, step(Br, 1), step(Vo, 0), step(Br, 2));
    if (r() < 0.5) for (let k = 0; k < 4; k++) putTexel(albedo, px + 15, py + h - 1 - k, step(Vg, 0));
  }
  quantize(albedo, paletteOf(Br, Vg, Vo));
  return { albedo, emission };
}

/** The chains' links, 32 texels in four bands of eight rows (a link's faces, unused, its outer walls, its inner walls):
 *  dark brass, rubbed on the walls where the links bear, verdigris in the inner bends. */
export function chainArt(seed = 0x5d1181) {
  const S = 32, albedo = image(S), emission = image(S), tone = noiseField(seed, 4, S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const band = Math.floor(y / 8), t = tone(x, y);
    const c = band === 0 ? ramp(Br, 0.12 + 0.2 * t, x, y)
      : band === 2 ? ramp(Br, 0.3 + 0.25 * t, x, y)
        : band === 3 ? (t > 0.6 ? step(Vg, 1) : ramp(Br, 0.05 + 0.15 * t, x, y))
          : ramp(Br, 0.1 + 0.2 * t, x, y);
    putTexel(albedo, x, y, c); putTexel(emission, x, y, [0, 0, 0]);
  }
  for (let x = 0; x < S; x++) { putTexel(albedo, x, 0, step(Br, 3)); putTexel(albedo, x, 16, step(Br, 4)); putTexel(albedo, x, 7, step(Br, 0)); }
  quantize(albedo, paletteOf(Br, Vg));
  return { albedo, emission };
}

/** The hang's pictures, by record (world/sdWorksModel.js SD_WORKS_RECORD 80, world/sdIslandModel.js SD_CHAIN_RECORD 81) -
 *  the realm's art (world/sdRealmArt.js realmArt) carries them, so they go up with the realm's own. */
/** @returns {Array<[number, { albedo: import('./sdPixelKit.js').Img, emission: import('./sdPixelKit.js').Img }]>} */
export const hangArt = () => [[80, worksArt()], [81, chainArt()]];
