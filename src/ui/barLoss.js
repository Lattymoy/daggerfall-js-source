// @ts-check
// VB2 / FRAME1 - A BAR'S LOSS, READ AT A GLANCE: the pale strip that holds where a bar WAS after a hit before it drains
// (`stepGhost`), and the bitten span breaking off as a piece that drops (`chunkFrame`). The vitals' and the foe bar's
// law (ui/enhanced/enhancedHud.js, where it was born), in a home of its own since AUDIT NAV1 (the presentation) gave the sea
// fight's target card the same readout (ui/naval/navalHud.js): a hit on her had only slid her bar for 160 ms. Pure.

/** VB2: how long the lost chunk stands before it drains (seconds), and
 *  how fast it drains once it goes (percent of the bar per second). */
export const GHOST_HOLD = 0.55;
export const GHOST_RATE = 70;
/** GHOST-CAP (2026-10-02, Discord "Fatigue Bar": "When you get your Fatigue damaged while fighting Daedra, the pending
 *  change on the fatigue bar is white ... you can die from it while fighting"): the longest the strip stands still
 *  (seconds) however the losses keep coming. Every fresh loss restarted the hold, so a bar losing a little every few
 *  frames - fatigue through a fight, a Daedra's drain - never drained its strip at all: it stood at the fight's first
 *  level, a full-looking bar over one nearly empty. */
export const GHOST_HOLD_MAX = 1.2;
/**
 * VB2: one frame of the lost chunk, pure. `g` is last frame's
 * { at, pct, hold, stood } (or null), `pct` the bar now, `dt` seconds. A gain
 * (or the first frame) snaps the chunk to the bar - there is nothing
 * lost to show. A fresh loss restarts the hold from wherever the chunk
 * stands, so a flurry of blows reads as one run of damage - but the chunk
 * stands no longer than GHOST_HOLD_MAX in all (`stood`) before it drains.
 */
export function stepGhost(g, pct, dt) {
  const p = Math.max(0, Math.min(100, pct));
  if (!g || p >= g.at) return { at: p, pct: p, hold: GHOST_HOLD, stood: 0 };
  const stood = (g.stood ?? 0) + dt;
  if (stood < GHOST_HOLD_MAX) {
    if (p < g.pct) return { at: g.at, pct: p, hold: GHOST_HOLD, stood };
    if (g.hold > 0) return { at: g.at, pct: p, hold: g.hold - dt, stood };
  }
  return { at: Math.max(p, g.at - GHOST_RATE * dt), pct: p, hold: 0, stood };
}
/**
 * FRAME1: which of a bar's two chunk pieces the n-th loss uses, and
 * which of the two identical animations it runs. Alternating the
 * animation NAME is what restarts it on a piece that already fell - a
 * class swap, with no forced reflow (the node tests' DOM has none).
 */
export const chunkFrame = (n) => ({ index: n % 2, cls: Math.floor(n / 2) % 2 ? 'fb' : 'fa' });
