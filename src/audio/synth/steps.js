// @ts-check
// THE STEPS, MADE. A footstep is two contacts - the heel, then the ball of the foot 60 to 110 ms
// on - and the ground answers each in its own way: a struck body on stone, tile and wood; a crowd of small cracks in
// grass, gravel, sand and snow; a slap, a suck and bubbles in mud and water. Armour rides over it (a chain's rings, a
// plate's ring, a leather creak), and the sway, the hard landing and the splash are made of the same parts. Each family
// draws its own numbers from the clip's seed, so the six of a set are six steps, not one. Pure (dsp.js).
import {
  addBubble,
  addBurst,
  addCreak,
  addGrains,
  addMode,
  between,
  canvas,
  crush,
  fadeEnds,
  filterAll,
  logBetween,
  loudnessTo,
  mulberry32,
  peakTo,
  pressSwell,
  quietBetween,
  toPcm,
} from './dsp.js';

/** @typedef {import('./dsp.js').Rng} Rng */
/** @typedef {{ buf: Float64Array, rate: number, dice: Rng, noise: Rng, dur: number, heavy: boolean }} Ctx */

// --- the parts ---------------------------------------------------------------------------------------------------

/** The weight of a body meeting the ground: a low mode, its overtone and a short low thump of air. @param {Ctx} ctx */
function thud(ctx, at, amp, freq, tau) {
  addMode(ctx.buf, ctx.rate, { at, freq, tau, amp });
  addMode(ctx.buf, ctx.rate, { at, freq: freq * between(ctx.dice, 1.6, 1.8), tau: tau * 0.5, amp: amp * 0.4 });
  addBurst(ctx.buf, ctx.rate, ctx.noise, { at, amp: amp * 0.6, decay: 0.012, stages: [['lowpass', 380, 0.7]] });
}

/** A hard contact's crack: noise in a band, gone in milliseconds. @param {Ctx} ctx */
function click(ctx, at, amp, centre, width, decay) {
  addBurst(ctx.buf, ctx.rate, ctx.noise, { at, amp, decay, stages: [['bandpass', centre, width]] });
}

/** A crowd of cracks in a band - a crunch, a crackle, a hiss of sand. @param {Ctx} ctx */
function grit(ctx, { from, to, peak, density, lo, hi, qLo = 1.5, qHi = 4, dLo = 0.001, dHi = 0.004, aLo = 0.02, aHi = 0.3 }) {
  addGrains(ctx.dice, {
    from,
    to,
    peak,
    density,
    grain: (at) =>
      click(ctx, at, quietBetween(ctx.dice, aLo, aHi), logBetween(ctx.dice, lo, hi), between(ctx.dice, qLo, qHi), between(ctx.dice, dLo, dHi)),
  });
}

/** Mail's rings: each ring two high modes, a little out of tune with each other. @param {Ctx} ctx */
function jingle(ctx, { from, to, peak, density, amp, lo = 2800, hi = 7500 }) {
  addGrains(ctx.dice, {
    from,
    to,
    peak,
    density,
    grain: (at) => {
      const freq = logBetween(ctx.dice, lo, hi);
      const a = quietBetween(ctx.dice, 0.15, 1) * amp;
      const tau = between(ctx.dice, 0.006, 0.02);
      addMode(ctx.buf, ctx.rate, { at, freq, tau, amp: a, phase: ctx.dice() * 6.28 });
      addMode(ctx.buf, ctx.rate, { at, freq: freq * between(ctx.dice, 1.37, 1.52), tau: tau * 0.7, amp: a * 0.6, phase: ctx.dice() * 6.28 });
    },
  });
}

/** A plate's ring: five modes at a struck plate's spread (not a bell's octaves), each a little off its place. */
const PLATE_RATIOS = Object.freeze([1, 2.31, 3.79, 5.12, 6.94]);
const PLATE_LEVELS = Object.freeze([1, 0.7, 0.5, 0.35, 0.25]);
const PLATE_TAUS = Object.freeze([0.18, 0.12, 0.09, 0.06, 0.045]);
/** @param {Ctx} ctx */
function clank(ctx, at, amp, base, tauScale = 1) {
  for (let i = 0; i < PLATE_RATIOS.length; i++) {
    const freq = base * PLATE_RATIOS[i] * between(ctx.dice, 0.97, 1.03);
    addMode(ctx.buf, ctx.rate, { at, freq, tau: PLATE_TAUS[i] * tauScale, amp: amp * PLATE_LEVELS[i], phase: ctx.dice() * 6.28 });
  }
  click(ctx, at, amp * 0.5, between(ctx.dice, 2600, 3600), 1.2, 0.004);
}

/** Water struck: a burst of spray and a scatter of bubbles after it. @param {Ctx} ctx */
function splash(ctx, at, amp, { band = 2400, decay = 0.06, bubbles = 10, spread = 0.22, lo = 600, hi = 2600 } = {}) {
  addBurst(ctx.buf, ctx.rate, ctx.noise, {
    at,
    amp,
    attack: 0.001,
    decay,
    stages: [
      ['highpass', 600, 0.7],
      ['bandpass', band, 0.7],
      ['lowpass', 6000, 0.7],
    ],
  });
  addBurst(ctx.buf, ctx.rate, ctx.noise, { at, amp: amp * 0.25, decay: decay * 0.5, stages: [['bandpass', 4200, 0.8]] });
  for (let i = 0; i < bubbles; i++) {
    const freq = logBetween(ctx.dice, lo, hi);
    addBubble(ctx.buf, ctx.rate, {
      at: at + 0.01 + quietBetween(ctx.dice, 0, spread),
      freq,
      tau: Math.min(0.04, between(ctx.dice, 9, 16) / freq),
      amp: quietBetween(ctx.dice, 0.06, 0.4) * amp,
      rise: between(ctx.dice, 0.2, 0.9),
    });
  }
}

/** Where the heel and the ball land, fitted to the clip. @param {Ctx} ctx */
function gait(ctx, lo = 0.06, hi = 0.11) {
  const heel = between(ctx.dice, 0.004, 0.025);
  const ball = heel + Math.min(between(ctx.dice, lo, hi), ctx.dur * 0.32);
  return { heel, ball, second: between(ctx.dice, 0.45, 0.7) };
}

/** Boots on a hard path: the thud, the heel's knock, the crack and a little grit. The thud is kept under the knock:
 *  at full weight it held 94% of the power under 300 Hz, where Daggerfall's own stone steps hold 56 to 70%. @param {Ctx} ctx */
function hardStep(ctx, { body = 110, crack = 2200, crackAmp = 0.5, gritAmp = 0.12, weight = 0.45, knock = 0.55 } = {}) {
  const feet = gait(ctx);
  for (const [at, k] of [
    [feet.heel, 1],
    [feet.ball, feet.second],
  ]) {
    thud(ctx, at, k * weight, body * between(ctx.dice, 0.9, 1.15), between(ctx.dice, 0.03, 0.05));
    addBurst(ctx.buf, ctx.rate, ctx.noise, {
      at,
      amp: k * knock,
      decay: between(ctx.dice, 0.01, 0.018),
      stages: [['bandpass', between(ctx.dice, 450, 850), 1.1]],
    });
    click(ctx, at, k * crackAmp, crack * between(ctx.dice, 0.85, 1.2), between(ctx.dice, 0.8, 1.3), between(ctx.dice, 0.008, 0.014));
    grit(ctx, {
      from: at,
      to: at + 0.04,
      peak: 300,
      density: (time) => 300 * Math.exp(-(time - at) / 0.015),
      lo: 3000,
      hi: 6000,
      aLo: 0.01,
      aHi: gritAmp * k,
    });
  }
  return feet;
}

// --- the families --------------------------------------------------------------------------------------------------

/** @type {Record<string, (ctx: Ctx) => void>} */
const FAMILIES = {
  /** Boots on a stone path or a stone floor. */
  path: (ctx) => {
    hardStep(ctx);
  },
  /** A dungeon's flags: short and sharp, the ball close on the heel. */
  stone: (ctx) => {
    const heel = between(ctx.dice, 0.003, 0.008);
    const ball = heel + Math.min(between(ctx.dice, 0.04, 0.06), ctx.dur * 0.35);
    for (const [at, k] of [
      [heel, 1],
      [ball, between(ctx.dice, 0.4, 0.6)],
    ]) {
      thud(ctx, at, k * 0.4, between(ctx.dice, 125, 160), between(ctx.dice, 0.018, 0.028));
      click(ctx, at, k * 0.55, between(ctx.dice, 550, 950), 1.2, between(ctx.dice, 0.008, 0.012));
      click(ctx, at, k * 0.7, between(ctx.dice, 2200, 3200), 1.2, between(ctx.dice, 0.006, 0.01));
      click(ctx, at, k * 0.2, between(ctx.dice, 4800, 6000), 2, 0.003);
    }
  },
  /** Glazed tile: a bright clack and the tile's short ring. */
  tile: (ctx) => {
    const feet = gait(ctx);
    const tone = between(ctx.dice, 1700, 2300);
    for (const [at, k] of [
      [feet.heel, 1],
      [feet.ball, feet.second],
    ]) {
      thud(ctx, at, k * 0.4, between(ctx.dice, 150, 180), 0.02);
      click(ctx, at, k * 0.9, between(ctx.dice, 3000, 4000), 1.5, between(ctx.dice, 0.005, 0.007));
      addMode(ctx.buf, ctx.rate, { at, freq: tone, tau: between(ctx.dice, 0.018, 0.03), amp: k * 0.25 });
      addMode(ctx.buf, ctx.rate, { at, freq: tone * 1.62, tau: 0.018, amp: k * 0.15 });
      addMode(ctx.buf, ctx.rate, { at, freq: tone * 2.4, tau: 0.012, amp: k * 0.1 });
    }
  },
  /** Boards: a hollow knock - the board's modes ringing under the heel - and now and then a creak. The lowest mode is
   *  kept under the board's middle ones (Daggerfall's own boards hold 47 to 78% of their power under 300 Hz). */
  wood: (ctx) => {
    const feet = gait(ctx);
    const freq = between(ctx.dice, 100, 140);
    for (const [at, k] of [
      [feet.heel, 1],
      [feet.ball, feet.second],
    ]) {
      addMode(ctx.buf, ctx.rate, { at, freq, tau: between(ctx.dice, 0.05, 0.065), amp: k * 0.5 });
      addMode(ctx.buf, ctx.rate, { at, freq: between(ctx.dice, 220, 300), tau: 0.05, amp: k * 0.6 });
      addMode(ctx.buf, ctx.rate, { at, freq: between(ctx.dice, 480, 720), tau: 0.03, amp: k * 0.6 });
      addMode(ctx.buf, ctx.rate, { at, freq: between(ctx.dice, 900, 1300), tau: 0.015, amp: k * 0.4 });
      click(ctx, at, k * 0.5, between(ctx.dice, 1300, 1900), 1, 0.008);
    }
    if (ctx.dice() < 0.5)
      addCreak(ctx.buf, ctx.rate, ctx.noise, {
        at: feet.ball + 0.02,
        len: between(ctx.dice, 0.08, 0.14),
        amp: 0.05,
        fromHz: between(ctx.dice, 60, 80),
        toHz: between(ctx.dice, 90, 120),
        centre: between(ctx.dice, 700, 1100),
        bandQ: 12,
      });
  },
  /** Grass: a soft thud under a swish of blades and a crackle of stems. */
  grass: (ctx) => {
    const feet = gait(ctx, 0.08, 0.13);
    for (const [at, k] of [
      [feet.heel, 1],
      [feet.ball, feet.second],
    ]) {
      thud(ctx, at, k * 0.45, between(ctx.dice, 80, 100), 0.04);
      addBurst(ctx.buf, ctx.rate, ctx.noise, {
        at,
        amp: k * 0.35,
        attack: between(ctx.dice, 0.015, 0.025),
        decay: between(ctx.dice, 0.06, 0.09),
        stages: [
          ['highpass', 1200, 0.7],
          ['bandpass', between(ctx.dice, 2500, 4500), 0.6],
          ['lowpass', 6000, 0.7],
        ],
      });
      grit(ctx, {
        from: at,
        to: at + 0.2,
        peak: 260,
        density: (time) => 260 * pressSwell(time, at, 0.02, 0.06),
        lo: 2000,
        hi: 5500,
        qLo: 1.5,
        qHi: 3,
        aHi: 0.25 * k,
      });
    }
  },
  /** Dry grass and stalks: louder cracks, longer, a crackle that settles after the foot. */
  crunchyGrass: (ctx) => {
    const feet = gait(ctx, 0.09, 0.14);
    for (const [at, k] of [
      [feet.heel, 1],
      [feet.ball, feet.second],
    ]) {
      thud(ctx, at, k * 0.35, between(ctx.dice, 80, 100), 0.04);
      addBurst(ctx.buf, ctx.rate, ctx.noise, {
        at,
        amp: k * 0.2,
        attack: 0.02,
        decay: 0.08,
        stages: [['bandpass', between(ctx.dice, 2500, 3800), 0.6]],
      });
      grit(ctx, {
        from: at,
        to: at + 0.45,
        peak: 650,
        density: (time) => 650 * pressSwell(time, at, 0.025, 0.1),
        lo: 2000,
        hi: 6500,
        qLo: 2,
        qHi: 5,
        aHi: 0.4 * k,
      });
    }
  },
  /** Gravel: a dense crunch of stones on stones and a knock or two of a bigger one. */
  gravel: (ctx) => {
    const feet = gait(ctx);
    for (const [at, k] of [
      [feet.heel, 1],
      [feet.ball, feet.second],
    ]) {
      thud(ctx, at, k * 0.6, between(ctx.dice, 90, 110), 0.035);
      grit(ctx, {
        from: at,
        to: at + 0.2,
        peak: 1500 * k,
        density: (time) => 1500 * k * pressSwell(time, at, 0.008, 0.04),
        lo: 1200,
        hi: 4500,
        qLo: 1.5,
        qHi: 4,
        dLo: 0.0015,
        dHi: 0.005,
        aHi: 0.45,
      });
      for (let i = 0; i < 2; i++)
        addMode(ctx.buf, ctx.rate, {
          at: at + between(ctx.dice, 0, 0.05),
          freq: between(ctx.dice, 900, 2500),
          tau: between(ctx.dice, 0.004, 0.008),
          amp: k * 0.3,
          phase: 1.57,
        });
    }
  },
  /** Sand: a soft press - a hush of fine grains and little weight. */
  sand: (ctx) => {
    const feet = gait(ctx, 0.1, 0.15);
    for (const [at, k] of [
      [feet.heel, 1],
      [feet.ball, feet.second],
    ]) {
      thud(ctx, at, k * 0.25, between(ctx.dice, 70, 90), 0.04);
      addBurst(ctx.buf, ctx.rate, ctx.noise, {
        at,
        amp: k * 0.3,
        attack: between(ctx.dice, 0.025, 0.04),
        decay: between(ctx.dice, 0.09, 0.14),
        stages: [
          ['bandpass', between(ctx.dice, 1200, 2000), 0.5],
          ['lowpass', 4000, 0.7],
        ],
      });
      grit(ctx, {
        from: at,
        to: at + 0.3,
        peak: 2500,
        density: (time) => 2500 * pressSwell(time, at, 0.03, 0.08),
        lo: 4000,
        hi: 8000,
        dLo: 0.0006,
        dHi: 0.0015,
        aLo: 0.01,
        aHi: 0.1 * k,
      });
    }
  },
  /** Snow: a muffled weight and a squeaking crunch as the snow packs under the foot. */
  snow: (ctx) => {
    const feet = gait(ctx, 0.1, 0.14);
    for (const [at, k] of [
      [feet.heel, 1],
      [feet.ball, feet.second],
    ]) {
      thud(ctx, at, k * 0.4, between(ctx.dice, 70, 90), 0.05);
      addBurst(ctx.buf, ctx.rate, ctx.noise, { at, amp: k * 0.25, attack: 0.04, decay: 0.1, stages: [['lowpass', 900, 0.7]] });
      const len = between(ctx.dice, 0.12, 0.2);
      grit(ctx, {
        from: at,
        to: at + len,
        peak: 1200,
        density: (time) => 1200 * Math.sin((Math.PI * (time - at)) / len),
        lo: 900,
        hi: 2600,
        qLo: 4,
        qHi: 9,
        dLo: 0.002,
        dHi: 0.005,
        aHi: 0.5 * k,
      });
    }
  },
  /** Mud: a wet slap, then the suck of the foot pulled out and a bubble or two. */
  mud: (ctx) => {
    const feet = gait(ctx);
    thud(ctx, feet.heel, 0.45, between(ctx.dice, 60, 85), between(ctx.dice, 0.05, 0.075));
    addBurst(ctx.buf, ctx.rate, ctx.noise, {
      at: feet.heel,
      amp: 0.6,
      attack: 0.002,
      decay: 0.03,
      stages: [['bandpass', between(ctx.dice, 500, 900), 1.2]],
    });
    for (let i = 0; i < 3; i++)
      addBubble(ctx.buf, ctx.rate, {
        at: feet.heel + between(ctx.dice, 0.01, 0.08),
        freq: between(ctx.dice, 250, 600),
        tau: between(ctx.dice, 0.015, 0.03),
        amp: 0.2,
        rise: 0.5,
      });
    const lift = feet.heel + Math.min(between(ctx.dice, 0.15, 0.22), ctx.dur * 0.5);
    const len = between(ctx.dice, 0.07, 0.11);
    const from = between(ctx.dice, 220, 300),
      to = between(ctx.dice, 900, 1200);
    // the suck: a narrow band gliding up through noise as the foot comes free
    const n = Math.round(len * ctx.rate);
    for (let i = 0, j = Math.round(lift * ctx.rate); i < n && j < ctx.buf.length; i += 64, j += 64) {
      const along = i / n;
      addBurst(ctx.buf, ctx.rate, ctx.noise, {
        at: j / ctx.rate,
        amp: 0.12 * Math.sin(Math.PI * along),
        attack: 0.0015,
        decay: 0.003,
        stages: [['bandpass', from + (to - from) * along, 6]],
      });
    }
    addBubble(ctx.buf, ctx.rate, { at: lift + len, freq: between(ctx.dice, 400, 800), tau: 0.02, amp: 0.25, rise: 0.8 });
  },
  /** Ankle-deep water: a splash at each contact and bubbles after. */
  shallowWater: (ctx) => {
    const feet = gait(ctx, 0.08, 0.12);
    splash(ctx, feet.heel, 0.7, { band: between(ctx.dice, 1800, 3000), decay: between(ctx.dice, 0.05, 0.08), bubbles: 10, spread: 0.18 });
    thud(ctx, feet.heel, 0.3, 120, 0.03);
    splash(ctx, feet.ball, 0.35, { band: between(ctx.dice, 1800, 3000), decay: 0.04, bubbles: 4, spread: 0.12 });
  },
  /** Deep water: a slow push of water, a slosh and a gurgle. */
  deepWater: (ctx) => {
    const at = between(ctx.dice, 0.005, 0.02);
    addBurst(ctx.buf, ctx.rate, ctx.noise, {
      at,
      amp: 0.6,
      attack: between(ctx.dice, 0.06, 0.1),
      decay: between(ctx.dice, 0.12, 0.18),
      stages: [
        ['lowpass', 1100, 0.7],
        ['bandpass', between(ctx.dice, 400, 600), 0.6],
      ],
    });
    addBurst(ctx.buf, ctx.rate, ctx.noise, { at: at + 0.12, amp: 0.25, attack: 0.04, decay: 0.08, stages: [['lowpass', 900, 0.7]] });
    splash(ctx, at + 0.03, 0.2, { band: 1500, decay: 0.05, bubbles: 0 });
    for (let i = 0; i < 16; i++) {
      const freq = logBetween(ctx.dice, 250, 1200);
      addBubble(ctx.buf, ctx.rate, {
        at: at + between(ctx.dice, 0.05, Math.max(0.06, ctx.dur * 0.75)),
        freq,
        tau: Math.min(0.04, between(ctx.dice, 10, 18) / freq),
        amp: quietBetween(ctx.dice, 0.05, 0.3),
        rise: between(ctx.dice, 0.2, 0.6),
      });
    }
  },
  /** A wade (Better Ambience's water): a longer splash, the leg's slosh and drips falling back. */
  wade: (ctx) => {
    const at = between(ctx.dice, 0.01, 0.03);
    splash(ctx, at, 0.6, { band: between(ctx.dice, 1500, 2500), decay: 0.09, bubbles: 14, spread: 0.4, lo: 400, hi: 2200 });
    addBurst(ctx.buf, ctx.rate, ctx.noise, {
      at: at + 0.05,
      amp: 0.35,
      attack: 0.08,
      decay: between(ctx.dice, 0.15, 0.22),
      stages: [['lowpass', 1000, 0.7]],
    });
    for (let i = 0; i < 6; i++) {
      const freq = logBetween(ctx.dice, 1500, 3500);
      addBubble(ctx.buf, ctx.rate, {
        at: between(ctx.dice, 0.3, ctx.dur * 0.85),
        freq,
        tau: 9 / freq,
        amp: quietBetween(ctx.dice, 0.04, 0.15),
        rise: 0.7,
      });
    }
  },
  /** Bare feet or soft shoes on a hard floor: a soft pat. */
  unarmored: (ctx) => {
    const feet = gait(ctx);
    for (const [at, k] of [
      [feet.heel, 1],
      [feet.ball, feet.second],
    ]) {
      thud(ctx, at, k * 0.35, between(ctx.dice, 80, 100), 0.03);
      addBurst(ctx.buf, ctx.rate, ctx.noise, {
        at,
        amp: k * 0.5,
        attack: 0.001,
        decay: between(ctx.dice, 0.01, 0.016),
        stages: [
          ['bandpass', between(ctx.dice, 600, 1100), 0.8],
          ['lowpass', 2500, 0.7],
        ],
      });
      click(ctx, at, k * 0.08, 2500, 1, 0.003);
    }
  },
  /** Leather soles on stone: a firm thud, a muted crack, a scuff, and at times a creak of the boot. */
  leather: (ctx) => {
    const feet = hardStep(ctx, { body: 110, crack: 1700, crackAmp: 0.35, gritAmp: 0.08 });
    addBurst(ctx.buf, ctx.rate, ctx.noise, {
      at: feet.heel + 0.01,
      amp: 0.12,
      attack: 0.01,
      decay: 0.025,
      stages: [['bandpass', 2500, 0.5]],
    });
    if (ctx.dice() < 0.4)
      addCreak(ctx.buf, ctx.rate, ctx.noise, {
        at: feet.ball,
        len: between(ctx.dice, 0.06, 0.1),
        amp: 0.08,
        fromHz: 50,
        toHz: 90,
        centre: between(ctx.dice, 1000, 1500),
        bandQ: 10,
      });
  },
  /** Mail boots: the step, and the mail's rings shaken at each contact. */
  chainmail: (ctx) => {
    const feet = hardStep(ctx, { body: 105, crackAmp: 0.4 });
    jingle(ctx, {
      from: feet.heel,
      to: Math.min(ctx.dur, feet.heel + 0.25),
      peak: 900,
      density: (time) => 900 * Math.exp(-(time - feet.heel) / 0.06) + (time > feet.ball ? 500 * Math.exp(-(time - feet.ball) / 0.05) : 0),
      amp: 0.18,
    });
  },
  /** Plate boots: a heavy thud and the plate's ring at each contact. */
  plate: (ctx) => {
    const feet = gait(ctx);
    const base = between(ctx.dice, 420, 600);
    thud(ctx, feet.heel, 0.9, between(ctx.dice, 80, 95), 0.05);
    clank(ctx, feet.heel, 0.5, base);
    thud(ctx, feet.ball, 0.5, between(ctx.dice, 85, 100), 0.04);
    clank(ctx, feet.ball, 0.3, base * between(ctx.dice, 1.03, 1.09), 0.8);
    jingle(ctx, {
      from: feet.heel,
      to: feet.heel + 0.08,
      peak: 200,
      density: () => 200,
      amp: 0.05,
      lo: 2000,
      hi: 5000,
    });
  },
  /** Leather armour in motion: a rustle and a creak or two. */
  swayLeather: (ctx) => {
    addBurst(ctx.buf, ctx.rate, ctx.noise, {
      at: 0.01,
      amp: 0.25,
      attack: between(ctx.dice, 0.1, 0.14),
      decay: between(ctx.dice, 0.12, 0.16),
      stages: [
        ['bandpass', between(ctx.dice, 1200, 2500), 0.5],
        ['lowpass', 4000, 0.7],
      ],
    });
    const creaks = ctx.dice() < 0.5 ? 1 : 2;
    for (let i = 0; i < creaks; i++) {
      const len = between(ctx.dice, 0.08, 0.16);
      addCreak(ctx.buf, ctx.rate, ctx.noise, {
        at: between(ctx.dice, 0.02, Math.max(0.03, ctx.dur - len - 0.05)),
        len,
        amp: 0.35,
        fromHz: between(ctx.dice, 35, 55),
        toHz: between(ctx.dice, 60, 80),
        centre: between(ctx.dice, 800, 1400),
        bandQ: 9,
      });
    }
    addMode(ctx.buf, ctx.rate, { at: between(ctx.dice, 0.05, 0.15), freq: 150, tau: 0.02, amp: 0.15 });
  },
  /** Mail in motion: a swing of rings over the clip. */
  swayChain: (ctx) => {
    const len = ctx.dur * 0.85;
    jingle(ctx, { from: 0.005, to: len, peak: 1200, density: (time) => 1200 * Math.sin((Math.PI * time) / len) ** 2, amp: 0.25 });
    addBurst(ctx.buf, ctx.rate, ctx.noise, { at: 0.02, amp: 0.05, attack: len * 0.4, decay: len * 0.2, stages: [['bandpass', 4000, 0.7]] });
  },
  /** Plate in motion: two or three soft clinks and a scrape of plate on plate. */
  swayPlate: (ctx) => {
    const n = ctx.dice() < 0.5 ? 2 : 3;
    const base = between(ctx.dice, 700, 1100);
    for (let i = 0; i < n; i++)
      clank(ctx, between(ctx.dice, 0.01, ctx.dur * 0.6), between(ctx.dice, 0.3, 0.6), base * between(ctx.dice, 0.95, 1.08), 0.5);
    addBurst(ctx.buf, ctx.rate, ctx.noise, {
      at: 0.02,
      amp: 0.08,
      attack: 0.04,
      decay: 0.06,
      stages: [['bandpass', between(ctx.dice, 2000, 4000), 2]],
    });
  },
  /** A light armour's clank on each step (Better Ambience): buckles and small plates, a few rings. */
  armorLight: (ctx) => {
    const n = 2 + Math.floor(ctx.dice() * 3);
    for (let i = 0; i < n; i++) {
      const at = between(ctx.dice, 0.005, 0.12);
      const base = between(ctx.dice, 1100, 1900);
      const a = between(ctx.dice, 0.3, 0.7);
      addMode(ctx.buf, ctx.rate, { at, freq: base, tau: between(ctx.dice, 0.06, 0.1), amp: a, phase: 1.57 });
      addMode(ctx.buf, ctx.rate, { at, freq: base * between(ctx.dice, 2.3, 2.5), tau: 0.05, amp: a * 0.5 });
      addMode(ctx.buf, ctx.rate, { at, freq: base * between(ctx.dice, 4, 4.3), tau: 0.03, amp: a * 0.3 });
    }
    jingle(ctx, { from: 0.005, to: 0.09, peak: 400, density: () => 400, amp: 0.12, lo: 4000, hi: 8000 });
    if (ctx.dice() < 0.3)
      addCreak(ctx.buf, ctx.rate, ctx.noise, { at: 0.1, len: 0.08, amp: 0.1, fromHz: 50, toHz: 80, centre: 1200, bandQ: 10 });
  },
};

/** The hard landing's armour layer, by its set. @type {Record<string, (ctx: Ctx, at: number, k: number) => void>} */
const LANDING_ARMOUR = {
  Unarmored: (ctx, at, k) =>
    addBurst(ctx.buf, ctx.rate, ctx.noise, { at, amp: 0.3 * k, attack: 0.005, decay: 0.06, stages: [['bandpass', 800, 0.6]] }),
  Leather: (ctx, at, k) => {
    addBurst(ctx.buf, ctx.rate, ctx.noise, { at, amp: 0.3 * k, attack: 0.004, decay: 0.05, stages: [['bandpass', 1200, 0.6]] });
    addCreak(ctx.buf, ctx.rate, ctx.noise, { at: at + 0.03, len: 0.12, amp: 0.3 * k, fromHz: 40, toHz: 70, centre: 1100, bandQ: 9 });
  },
  Chainmail: (ctx, at, k) =>
    jingle(ctx, {
      from: at,
      to: Math.min(ctx.dur, at + 0.6),
      peak: 3000,
      density: (time) => 3000 * Math.exp(-(time - at) / 0.12),
      amp: 0.3 * k,
    }),
  Plate: (ctx, at, k) => {
    const base = between(ctx.dice, 300, 420);
    clank(ctx, at, 0.8 * k, base, 1.8);
    clank(ctx, at + between(ctx.dice, 0.06, 0.1), 0.45 * k, base * between(ctx.dice, 1.1, 1.25), 1.2);
  },
};

/** A hard landing: the body's weight on the ground, grit thrown up, and the armour over it. `heavy` is the fall that hurt. @param {Ctx} ctx @param {string} armour */
function landing(ctx, armour) {
  const at = between(ctx.dice, 0.005, 0.015);
  const k = ctx.heavy ? 1 : 0.75;
  thud(ctx, at, k, between(ctx.dice, 55, 70), ctx.heavy ? 0.16 : 0.12);
  addMode(ctx.buf, ctx.rate, { at, freq: between(ctx.dice, 100, 120), tau: 0.06, amp: 0.4 * k });
  addBurst(ctx.buf, ctx.rate, ctx.noise, { at, amp: 0.6 * k, attack: 0.002, decay: 0.06, stages: [['lowpass', 1200, 0.7]] });
  grit(ctx, { from: at, to: at + 0.15, peak: 800, density: (time) => 800 * Math.exp(-(time - at) / 0.05), lo: 2000, hi: 5000 });
  LANDING_ARMOUR[armour]?.(ctx, at, k);
  if (ctx.heavy) {
    const second = at + between(ctx.dice, 0.09, 0.14);
    thud(ctx, second, 0.5, between(ctx.dice, 70, 90), 0.06);
    LANDING_ARMOUR[armour]?.(ctx, second, 0.4);
  }
}

/** A plunge into water: the burst, the cavity's low note, the slosh, a cloud of bubbles and drips falling back. @param {Ctx} ctx */
function waterLanding(ctx) {
  const at = 0.01;
  addBurst(ctx.buf, ctx.rate, ctx.noise, {
    at,
    amp: 0.9,
    attack: 0.002,
    decay: 0.12,
    stages: [
      ['highpass', 200, 0.7],
      ['lowpass', 6000, 0.7],
    ],
  });
  addMode(ctx.buf, ctx.rate, { at, freq: 70, tau: 0.08, amp: 0.5 });
  addMode(ctx.buf, ctx.rate, { at, freq: 140, tau: 0.05, amp: 0.25 });
  addBurst(ctx.buf, ctx.rate, ctx.noise, { at, amp: 0.3, decay: 0.09, stages: [['bandpass', 4000, 0.6]] });
  addBurst(ctx.buf, ctx.rate, ctx.noise, { at: at + 0.05, amp: 0.35, attack: 0.08, decay: 0.25, stages: [['lowpass', 900, 0.7]] });
  for (let i = 0; i < 50; i++) {
    const time = quietBetween(ctx.dice, 0.02, 0.7);
    const freq = logBetween(ctx.dice, 250, 2500);
    addBubble(ctx.buf, ctx.rate, { at: at + time, freq, tau: Math.min(0.045, 14 / freq), amp: 0.35 * (1 - time), rise: 0.5 });
  }
  for (let i = 0; i < 7; i++) {
    const freq = logBetween(ctx.dice, 1500, 3500);
    addBubble(ctx.buf, ctx.rate, { at: between(ctx.dice, 0.3, ctx.dur * 0.9), freq, tau: 9 / freq, amp: 0.12, rise: 0.7 });
  }
}

// --- the door ------------------------------------------------------------------------------------------------------

/** Every family a clip can be made of: the steps', the sways', 'landing:<Set>' and 'waterLanding'. */
export const STEP_FAMILIES = Object.freeze([
  ...Object.keys(FAMILIES),
  ...Object.keys(LANDING_ARMOUR).map((a) => `landing:${a}`),
  'waterLanding',
]);

/** The loudest sample each kind is made to before `loudness` sets its level: the retro quality's 8 bits are taken here,
 *  near full scale, so a quiet clip keeps all 256 steps. */
export const STEP_PEAK = Object.freeze({ step: 0.6, sway: 0.35, landing: 0.85 });
/** The retro quality: the clip under 7 kHz and held to 8 bits, as Daggerfall's own sounds are. */
export const RETRO = Object.freeze({ lowpassHz: 7000, bits: 8 });

/**
 * A CLIP: `family` made `seconds` long at `rate` from `seed` - the same seed the same clip at any rate - and, `retro`,
 * at the retro quality. `heavy` is a landing's hurt fall. `loudness` (dsp.js loudnessOf, dB) is its level at the end;
 * without it the clip stands at its peak. Answers mono Float32 PCM.
 * @param {string} family
 * @param {{ seed: number, seconds: number, rate: number, retro?: boolean, heavy?: boolean, peak?: number, loudness?: number }} o
 */
export function stepSound(family, { seed, seconds, rate, retro = false, heavy = false, peak, loudness }) {
  const buf = canvas(seconds, rate);
  /** @type {Ctx} */
  const ctx = { buf, rate, dice: mulberry32(seed), noise: mulberry32(seed ^ 0x9e3779b9), dur: seconds, heavy };
  if (family.startsWith('landing:')) landing(ctx, family.slice(8));
  else if (family === 'waterLanding') waterLanding(ctx);
  else if (FAMILIES[family]) FAMILIES[family](ctx);
  else throw new Error(`no step family ${family}`);
  const kind = family.startsWith('sway') ? 'sway' : /^(landing:|waterLanding)/.test(family) ? 'landing' : 'step';
  filterAll(buf, rate, [['highpass', 30, 0.7]]);
  const level = peak ?? STEP_PEAK[kind];
  if (retro) filterAll(buf, rate, [['lowpass', RETRO.lowpassHz, 0.707]]);
  fadeEnds(peakTo(buf, level), rate);
  if (retro) crush(buf, RETRO.bits);
  if (loudness != null) loudnessTo(buf, rate, loudness);
  return toPcm(buf);
}
