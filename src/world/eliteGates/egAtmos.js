// @ts-check
// EG-LOOK (2026-10-15, Mac: "Literally everything, and no band aids"; bible/11-Multiplayer/Elite-Gates-Look.md section 7):
// THE SPIRE'S AIR AND LIGHT, A BAND AT A TIME - every band breathed the Hour's one brown haze under one orange up-light
// (world/eliteGates/egHall.js's EG_HALL_FOG and its trilight, before). Each band is now its own realm's air: the Deadlands' ash over
// the fire-sea in the Galleries, the Ideal Masters' violet mist in the Soul Cairn, Nocturnal's near-black dusk under a
// silver moon in the Shade, the Wellhead's smoke over its magma. A row a band:
//   fog     the made level's haze (applyFog's shape: exp, its density and colour) - the far wings melt into it
//   tri     the dungeon trilight (sky, equator, ground): the ground term is the realm's light from below
//   key     the moonlight slot's key (direction toward the light, colour, scale): the Spire's lost sky, the moon's bearing
//   grade   the lane's grade (render/renderer.js setSceneGrade - world/superDungeon/sdLook.js SD_HOUR_GRADE's shape)
//   lamp    a lamp's tint (the band's fixtures' flame - the ruin's one emissive)
//   motes   THE AIR (render/eliteGates/egMotes.js): the band's kinds of mote (render/eliteGates/egMotes.js EG_MOTE_KINDS - how each moves), how
//           many of each, and each one's colour cool (`lo`) and hot (`hi`) - under L2 (display luminance 0.45) but for the
//           embers' and the sparks' hottest (L3, small - SD-LOOK's value ladder)
//   sky     the band's sky painter's own colours (render/eliteGates/egSkyMap.js): `zenith` the void overhead (L0), `horizon` the air
//           just over the line (the haze band - the line itself is the fog's), `deep` the realm below, `glow` its light,
//           and the realm's own (the ash lid and its lit belly, the spires' rock, the stars, the aurora, the moon); `up` the
//           light the realm below sends up (the stair's fall lights the Spire's underside by it - render/eliteGates/egStairPass.js)
// Telegraphs, edge lines and white hazards keep their fog floor under every band's fog (Elite-Gates.md section 25.6) -
// nothing here touches them.
//
// Pure: no DOM, no GL (the swap's worker reads the lamps' tint). Not a DFU member. Ledger A (ELITE-GATES).

const f3 = (a, b, c) => Object.freeze([a, b, c]);
const unit = (x, y, z) => { const n = Math.hypot(x, y, z); return f3(x / n, y / n, z / n); };

/** THE BANDS' AIR, by band index (0 the Broken Galleries, 1 the Soul Cairn, 2 the Shade Perilous, 3 the Havoc Wellhead). */
export const EG_ATMOS = Object.freeze([
  Object.freeze({   // the Broken Galleries - the academy's upper halls over the Deadlands' fire-sea
    fog: Object.freeze({ mode: 'exp', density: 0.005, color: f3(0.16, 0.05, 0.03) }),
    tri: Object.freeze({ sky: f3(0.3, 0.27, 0.3), equator: f3(0.3, 0.2, 0.14), ground: f3(0.9, 0.34, 0.1) }),
    key: Object.freeze({ scale: 0.75, dir: unit(0.2, 0.75, 0.6), color: f3(0.9, 0.9, 0.95) }),
    grade: Object.freeze({ adaptKey: 0.12, adaptMax: 1.15, bloom: 0.8, vignette: 0.34, contrast: 1.08 }),
    lamp: f3(1.0, 0.76, 0.4),
    motes: Object.freeze([   // embers off the fire-sea rising, ash drifting down
      Object.freeze({ kind: 'ember', n: 600, lo: f3(0.42, 0.08, 0.03), hi: f3(1.0, 0.66, 0.26) }),
      Object.freeze({ kind: 'ash', n: 360, lo: f3(0.12, 0.1, 0.09), hi: f3(0.3, 0.24, 0.21) }),
    ]),
    sky: Object.freeze({ zenith: f3(0.1, 0.014, 0.011), horizon: f3(0.34, 0.05, 0.03), deep: f3(0.2, 0.045, 0.02), glow: f3(0.9, 0.38, 0.07),
      lid: f3(0.07, 0.02, 0.016), lit: f3(0.6, 0.19, 0.06), rock: f3(0.012, 0.004, 0.004), up: f3(0.85, 0.28, 0.05) }),
  }),
  Object.freeze({   // the Soul Cairn - the Ideal Masters' realm of the dead, a sea of mist
    fog: Object.freeze({ mode: 'exp', density: 0.0075, color: f3(0.1, 0.09, 0.14) }),
    tri: Object.freeze({ sky: f3(0.8, 0.76, 1.02), equator: f3(0.64, 0.58, 0.82), ground: f3(0.9, 0.84, 1.18) }),
    key: Object.freeze({ scale: 0.62, dir: unit(-0.3, 0.8, 0.4), color: f3(0.75, 0.82, 0.98) }),
    grade: Object.freeze({ adaptKey: 0.13, adaptMax: 1.45, bloom: 0.85, vignette: 0.36, contrast: 1.06 }),
    lamp: f3(0.55, 0.85, 1.0),
    motes: Object.freeze([   // soul-motes drifting slowly up, breathing
      Object.freeze({ kind: 'soul', n: 800, lo: f3(0.2, 0.26, 0.4), hi: f3(0.32, 0.47, 0.54) }),
    ]),
    sky: Object.freeze({ zenith: f3(0.024, 0.014, 0.05), horizon: f3(0.14, 0.1, 0.22), deep: f3(0.08, 0.07, 0.13), glow: f3(0.3, 0.28, 0.42),
      star: f3(0.78, 0.84, 1.0), soul: f3(0.42, 0.9, 1.0), aurora: f3(0.5, 0.46, 0.72), hem: f3(0.5, 0.88, 0.92), rock: f3(0.02, 0.016, 0.03), up: f3(0.42, 0.44, 0.5) }),
  }),
  Object.freeze({   // the Shade Perilous - Nocturnal's dusk under a great moon
    fog: Object.freeze({ mode: 'exp', density: 0.006, color: f3(0.022, 0.026, 0.044) }),
    tri: Object.freeze({ sky: f3(1.1, 1.2, 1.6), equator: f3(0.75, 0.8, 1.05), ground: f3(0.4, 0.42, 0.58) }),
    key: Object.freeze({ scale: 1.35, dir: unit(-0.55, 0.45, 0.7), color: f3(0.75, 0.8, 0.98) }),
    grade: Object.freeze({ adaptKey: 0.14, adaptMax: 2.0, bloom: 0.75, vignette: 0.36, contrast: 1.08 }),
    lamp: f3(0.78, 0.84, 1.0),
    motes: Object.freeze([   // moon-dust falling, silver, glinting
      Object.freeze({ kind: 'dust', n: 800, lo: f3(0.2, 0.22, 0.28), hi: f3(0.4, 0.43, 0.5) }),
    ]),
    sky: Object.freeze({ zenith: f3(0.003, 0.0035, 0.008), horizon: f3(0.022, 0.026, 0.046), deep: f3(0.004, 0.005, 0.009), glow: f3(0.5, 0.55, 0.66),
      moon: f3(0.42, 0.45, 0.52), mare: f3(0.22, 0.24, 0.29), high: f3(0.56, 0.6, 0.68), halo: f3(0.09, 0.11, 0.17), star: f3(0.62, 0.66, 0.76), aurora: f3(0.5, 0.55, 0.62), rock: f3(0.004, 0.004, 0.007), up: f3(0.01, 0.01, 0.015) }),
  }),
  Object.freeze({   // the Havoc Wellhead - the muster-ground over the magma
    fog: Object.freeze({ mode: 'exp', density: 0.009, color: f3(0.14, 0.05, 0.02) }),
    tri: Object.freeze({ sky: f3(1.05, 0.68, 0.52), equator: f3(1.25, 0.68, 0.4), ground: f3(2.1, 0.74, 0.2) }),
    key: Object.freeze({ scale: 0.62, dir: unit(0.4, 0.7, -0.5), color: f3(1.0, 0.76, 0.56) }),
    grade: Object.freeze({ adaptKey: 0.14, adaptMax: 1.6, bloom: 0.9, vignette: 0.36, contrast: 1.08 }),
    lamp: f3(1.0, 0.52, 0.18),
    motes: Object.freeze([   // sparks rising thick, heavy ash falling
      Object.freeze({ kind: 'spark', n: 600, lo: f3(0.5, 0.12, 0.03), hi: f3(1.0, 0.72, 0.3) }),
      Object.freeze({ kind: 'cinder', n: 400, lo: f3(0.1, 0.08, 0.07), hi: f3(0.24, 0.19, 0.16) }),
    ]),
    sky: Object.freeze({ zenith: f3(0.1, 0.022, 0.011), horizon: f3(0.42, 0.12, 0.03), deep: f3(0.06, 0.022, 0.015), glow: f3(0.92, 0.38, 0.07),
      lid: f3(0.085, 0.032, 0.02), lit: f3(0.68, 0.26, 0.06), rock: f3(0.032, 0.024, 0.022), fire: f3(1.0, 0.62, 0.22), up: f3(1.0, 0.36, 0.06) }),
  }),
]);

/** Band `band`'s air (clamped to 0-3). */
export const egAtmosOf = (band) => EG_ATMOS[Math.max(0, Math.min(3, band | 0))];
