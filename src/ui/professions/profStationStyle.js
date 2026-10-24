// @ts-check
// PROF-STATIONS (2026-10-01, Mac: the stations kept simple - "leave them as the plain bars they were, only restyled"):
// THE STATIONS' ACTS, DRESSED - the heat at the anvil, the stitch's beat at the loom (both the heat's bar) and the plane
// at the workbench, on the Stores page, in the world plaque's own frame (ui/enhanced/enhancedStyle.js .wplaque: the ink ground,
// the 2px stone border) and the kit's tones (enhancedFrame.js FRAME_TONES): the bar a carved well, the band and the
// marker edged in ink, the strikes the gathering acts' diamond pips (ui/professions/profActStyle.js). No picture, no new markup -
// the same bars, the same rules. Appended to PROF_CSS (ui/enhanced/enhancedPlusStyle.js), after the rules it supersedes.
import { PIXEL_STACK } from '../pixelifyFive.js';
import { FRAME_TONES as T } from '../enhanced/enhancedFrame.js';

export const PROF_STATION_CSS = `/* ── PROF-STATIONS: the stations' acts, dressed ── */
.prof-craft { background: rgba(10,12,17,0.9); border: 2px solid #7d7460; box-shadow: 0 0 0 1px ${T.outline}, inset 0 0 0 1px rgba(0,0,0,0.55);
  font-family: ${PIXEL_STACK}; -webkit-font-smoothing: none; color: #d8cfae; text-shadow: 1px 1px 0 ${T.outline}; }
.prof-craft > b { color: #efe0b8; }
.prof-heatword { color: #d8cfae; }
.prof-heatbar { height: 14px; border: 0; margin: 4px 0;
  box-shadow: 0 0 0 1px ${T.outline}, 0 0 0 3px ${T.stoneLo}, 0 0 0 4px ${T.outline}, 0 0 calc(var(--heat) * 14px) rgba(246,160,60, calc(var(--heat) * 0.8)); }
.prof-heatband { top: -4px; bottom: -4px; border: 2px solid ${T.stoneHi}; box-shadow: 0 0 0 1px ${T.outline}, inset 0 0 0 1px ${T.outline}; }
.prof-heatbar.prof-inband .prof-heatband { border-color: ${T.brassHi}; box-shadow: 0 0 0 1px ${T.outline}, inset 0 0 0 1px ${T.outline}, 0 0 8px 1px rgba(243,207,134,0.8); }
.prof-heatmark { top: -6px; bottom: -6px; width: 3px; margin-left: -1.5px; background: #efe0b8; box-shadow: 0 0 0 1px ${T.outline}; }
.prof-strikes { gap: 7px; align-items: center; padding: 2px 3px; }
.prof-strike { display: inline-block; width: 8px; height: 8px; font-size: 0; color: transparent; text-shadow: none; transform: rotate(45deg);
  background: rgba(5,6,8,0.55); box-shadow: 0 0 0 1px ${T.outline}, inset 0 0 0 1px ${T.stoneMid}; }
.prof-strike.hit { color: transparent; background: ${T.brass}; box-shadow: 0 0 0 1px ${T.outline}, inset 0 0 0 1px ${T.brassHi}; }
.prof-strike.miss { color: transparent; background: #5a2a20; box-shadow: 0 0 0 1px ${T.outline}, inset 0 0 0 1px #8a4a3a; }
.prof-board { box-shadow: 0 0 0 1px ${T.outline}, 0 0 0 3px #7d7460, 0 0 0 4px ${T.outline}, inset 0 0 12px rgba(5,6,8,0.5); margin: 4px; }
.prof-trail { stroke: ${T.brassHi}; }
@media (prefers-reduced-motion: reduce) { .prof-heatbar { box-shadow: 0 0 0 1px ${T.outline}, 0 0 0 3px ${T.stoneLo}, 0 0 0 4px ${T.outline}; } }`;
