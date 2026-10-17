// @ts-check
// PROF-RETICLE (2026-10-01, Mac: "use the mechanics on something that doesnt cover the screen"): THE ACT ON THE
// CROSSHAIR, DRESSED - no plate, no frame, no picture: thin marks in the kit's own tones (enhancedFrame.js FRAME_TONES)
// round the crosshair's middle (ui/professions/profReticle.js), each edged in the outline ink so it reads over snow and night alike,
// the count's pips and one line of hint under it in the pixel face, the hint fading once it has stood. Appended to
// PROF_CSS (ui/enhanced/enhancedPlusStyle.js), after the old meter's rules it supersedes (every rule here under .prof-reticle);
// the profession HUD lays this sheet itself, so the classic skins wear it too. Still forms under reduced motion.
import { PIXEL_STACK } from '../pixelifyFive.js';
import { FRAME_TONES as T } from '../enhanced/enhancedFrame.js';

const S = 'var(--hud-scale, 1)';
const R = '.prof-meter.prof-reticle';
const INK = `drop-shadow(0 0 1px ${T.outline}) drop-shadow(0 0 1px ${T.outline})`;
const WATER = '#8fc9de';
const HURT = '#e0875a';

export const PROF_ACT_CSS = `/* ── PROF-RETICLE: the act on the crosshair ── */
${R} { position: fixed; left: var(--rx, 50%); top: var(--ry, 50%); transform: translate(-50%, -50%); z-index: 12;
  width: calc(150px * ${S}); height: calc(140px * ${S}); padding: 0; margin: 0; background: none; border: 0; box-shadow: none;
  pointer-events: none; font-family: ${PIXEL_STACK}; -webkit-font-smoothing: none; font-variant-ligatures: none;
  font-feature-settings: 'liga' 0, 'clig' 0; font-size: calc(11px * ${S}); color: #efe0b8; text-align: center;
  text-shadow: 1px 1px 0 ${T.outline}, -1px 1px 0 ${T.outline}, 1px -1px 0 ${T.outline}, -1px -1px 0 ${T.outline}; }
${R}[hidden] { display: none; }
${R} .prof-rc { position: absolute; left: 50%; top: 50%; width: 0; height: 0; }
${R} svg { position: absolute; left: 0; top: 0; overflow: visible; filter: ${INK}; }

/* under the crosshair: the count, the hint */
${R} .prof-under { position: absolute; left: 0; top: calc(20px * ${S}); transform: translateX(-50%); display: flex; flex-direction: column;
  align-items: center; gap: calc(3px * ${S}); white-space: nowrap; }
${R} .prof-under:empty { display: none; }
${R} .prof-pips { display: flex; justify-content: center; gap: calc(4px * ${S}); }
${R} .prof-pip, ${R} .prof-slot { width: calc(6px * ${S}); height: calc(6px * ${S}); transform: rotate(45deg); background: rgba(5,6,8,0.55);
  box-shadow: 0 0 0 1px ${T.outline}, inset 0 0 0 1px ${T.stoneMid}; }
${R} .prof-pip.on, ${R} .prof-slot.found { background: ${T.brass}; box-shadow: 0 0 0 1px ${T.outline}, inset 0 0 0 1px ${T.brassHi}; }
${R} .prof-slot.missed { background: #5a2a20; box-shadow: 0 0 0 1px ${T.outline}, inset 0 0 0 1px #8a4a3a; }
${R} .prof-slot.next { box-shadow: 0 0 0 1px ${T.outline}, inset 0 0 0 1px ${T.brassHi}; }
${R} .prof-slips { color: ${HURT}; font-size: calc(11px * ${S}); }
${R} .prof-slips:empty { display: none; }
${R} .prof-hint { position: absolute; left: 0; top: calc(34px * ${S}); transform: translateX(-50%); margin: 0; width: max-content;
  max-width: min(86vw, calc(330px * ${S})); white-space: normal; line-height: 1.3; color: #efe0b8; opacity: 1; transition: opacity 0.6s; }
${R} .prof-hint.faded { opacity: 0; }
${R}.fish-tug .prof-hint { color: ${T.brassHi}; }
${R}.bruised .prof-hint { color: ${HURT}; }

/* the marks: the face's points where they stand, the glint and the reach it counts in, the knife */
${R} .prof-face { position: absolute; left: 0; top: 0; width: 0; height: 0; margin: 0; overflow: visible; background: none; box-shadow: none; }
${R} .prof-point { position: absolute; width: calc(5px * ${S}); height: calc(5px * ${S}); aspect-ratio: auto; margin: calc(-2.5px * ${S}) 0 0 calc(-2.5px * ${S});
  border-radius: 50%; background: rgba(233,228,217,0.6); box-shadow: 0 0 0 1px ${T.outline}; }
${R} .prof-point.first { width: calc(7px * ${S}); height: calc(7px * ${S}); margin: calc(-3.5px * ${S}) 0 0 calc(-3.5px * ${S}); background: ${T.brassHi}; }
${R} .prof-glint { position: absolute; width: calc(9px * ${S}); height: calc(9px * ${S}); aspect-ratio: auto; margin: calc(-4.5px * ${S}) 0 0 calc(-4.5px * ${S});
  border-radius: 50%; background: #fff6d8; box-shadow: 0 0 0 1px ${T.outline}, 0 0 6px 2px rgba(243,207,134,0.75); animation: none; }
${R} .prof-glint::before { content: ''; position: absolute; left: 50%; top: 50%; width: 260%; height: 2px; transform: translate(-50%, -50%);
  background: linear-gradient(90deg, transparent, #fff6d8 40% 60%, transparent); animation: prof-twinkle 0.5s ease-in-out infinite alternate; }
${R} .prof-glint::after { content: ''; position: absolute; left: 50%; top: 50%; width: 2px; height: 260%; transform: translate(-50%, -50%);
  background: linear-gradient(180deg, transparent, #fff6d8 40% 60%, transparent); animation: prof-twinkle 0.5s ease-in-out infinite alternate-reverse; }
@keyframes prof-twinkle { from { opacity: 0.35; } to { opacity: 1; } }
${R} .prof-zone { display: none; position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); box-sizing: border-box;
  border-radius: 50%; border: 1px dashed rgba(243,207,134,0.7); box-shadow: 0 0 0 1px rgba(5,6,8,0.35); }
${R} .prof-glint > .prof-zone, ${R} .prof-point.first > .prof-zone { display: block; }
${R} .prof-aim { position: absolute; left: 0; top: 0; width: calc(3px * ${S}); height: calc(3px * ${S}); aspect-ratio: auto;
  margin: calc(-1.5px * ${S}) 0 0 calc(-1.5px * ${S}); border: 0; background: ${T.brassHi}; box-shadow: 0 0 0 1px ${T.outline}; }
${R} .prof-aim::after { content: none; }

/* the knife's line: the tolerance it is scored in, the line through the points, the line drawn */
${R} .prof-line, ${R} .prof-tube { position: absolute; inset: auto; left: 0; top: 0; width: 1px; height: 1px; }
${R} .prof-tube { filter: none; }
${R} .trace-tube { fill: none; stroke: rgba(243,207,134,0.12); stroke-linecap: round; stroke-linejoin: round; }
${R} .prof-line .trace-guide { fill: none; stroke: rgba(239,224,184,0.75); stroke-width: calc(1px * ${S}); stroke-dasharray: 4 3; vector-effect: none; }
${R} .prof-line .trace-drawn { fill: none; stroke: ${T.brassHi}; stroke-width: calc(2px * ${S}); stroke-linecap: round; stroke-linejoin: round; stroke-dasharray: none; }

/* the ring round the crosshair: the notch, the band, the ring closing */
${R} .prof-ring { width: calc(80px * ${S}); height: auto; aspect-ratio: 1; margin: 0; transform: translate(-50%, -50%); border-radius: 0; background: none; box-shadow: none; }
${R} .ring-notch { fill: none; stroke: rgba(233,228,217,0.8); stroke-width: 1.2; }
${R} .ring-band { fill: none; stroke: rgba(243,207,134,0.38); }
${R}.clean-cut .ring-band { stroke: rgba(243,207,134,0.8); }
${R} .ring-line { fill: none; stroke: #efe0b8; stroke-width: 1.4; }
${R} .ring-line.in-band { stroke: ${T.brassHi}; stroke-width: 2.2; }
${R} .prof-ringbar { position: absolute; left: 0; top: calc(11px * ${S}); width: calc(60px * ${S}); height: calc(5px * ${S}); margin: 0;
  transform: translateX(-50%); background: rgba(5,6,8,0.7); box-shadow: 0 0 0 1px ${T.outline}; }
${R} .prof-ringbar.in-band .prof-ringmark { background: ${T.brassHi}; }

/* the hold's arc, the throw's, the net's fill, the glint's time left */
${R} .prof-arc { height: auto; aspect-ratio: 1; transform: translate(-50%, -50%); }
${R} .arc-track { fill: none; stroke: rgba(5,6,8,0.3); stroke-width: 2.2; }
${R} .arc-fill { fill: none; stroke: ${T.brassHi}; stroke-width: 2.4; }
${R} .prof-hold.bruised .arc-fill { stroke: ${HURT}; }
${R} .prof-netfill .arc-fill { stroke: ${WATER}; }
${R} .prof-glint .prof-arc { left: 50%; top: 50%; filter: none; }
${R} .prof-glintclock .arc-track { stroke: rgba(5,6,8,0.35); stroke-width: 1.6; }
${R} .prof-glintclock .arc-fill { stroke: rgba(243,207,134,0.9); stroke-width: 1.6; }

/* the water's: the throw's metres, the float, the tug's ring, the haul's bar beside the crosshair */
${R} .prof-rlabel { position: absolute; left: calc(26px * ${S}); top: 0; transform: translateY(-50%); white-space: nowrap; color: #efe0b8; }
${R} .prof-float { position: absolute; left: 0; top: calc(13px * ${S}); width: calc(6px * ${S}); height: calc(8px * ${S}); margin-left: calc(-3px * ${S});
  border-radius: 50% 50% 45% 45%; background: linear-gradient(180deg, #c8553f 0 45%, #efe0b8 45%); box-shadow: 0 0 0 1px ${T.outline};
  animation: prof-bob 0.9s ease-in-out infinite alternate; }
${R} .prof-float.school { box-shadow: 0 0 0 1px ${T.outline}, 0 0 0 calc(4px * ${S}) rgba(143,201,222,0.3); }
${R} .prof-float.dip { translate: 0 calc(3px * ${S}); animation: none; background: linear-gradient(180deg, ${T.brassHi} 0 45%, #efe0b8 45%); }
@keyframes prof-bob { from { translate: 0 -1px; } to { translate: 0 1px; } }
${R} .prof-tugring { position: absolute; left: 0; top: 0; width: calc(36px * ${S}); height: calc(36px * ${S}); margin: calc(-18px * ${S}) 0 0 calc(-18px * ${S});
  box-sizing: border-box; border-radius: 50%; border: 2px solid ${T.brassHi}; box-shadow: 0 0 0 1px ${T.outline}, 0 0 8px 2px rgba(243,207,134,0.6);
  animation: prof-tug 0.45s ease-out infinite; }
@keyframes prof-tug { from { opacity: 1; transform: scale(0.7); } to { opacity: 0.2; transform: scale(1.25); } }
${R} .prof-haulbar { position: absolute; left: calc(24px * ${S}); top: calc(-30px * ${S}); width: calc(7px * ${S}); height: calc(60px * ${S}); margin: 0;
  background: rgba(5,6,8,0.7); box-shadow: 0 0 0 1px ${T.outline}; }
${R} .prof-haulband { left: 0; right: 0; top: auto; background: rgba(120,190,220,0.45); box-shadow: inset 0 0 0 1px rgba(170,220,240,0.8); }
${R} .prof-haulbar.slipping .prof-haulband { background: rgba(224,135,90,0.4); box-shadow: inset 0 0 0 1px ${HURT}; }
${R} .prof-haulweight { left: calc(-3px * ${S}); right: calc(-3px * ${S}); top: auto; width: auto; height: 3px; margin: 0 0 -1.5px 0;
  background: #efe0b8; box-shadow: 0 0 0 1px ${T.outline}; }

/* a flash where a blow, a chop, a find or a slip lands */
${R} .prof-burst { position: absolute; left: 0; top: 0; width: calc(24px * ${S}); height: calc(24px * ${S}); margin: calc(-12px * ${S}) 0 0 calc(-12px * ${S});
  border-radius: 50%; pointer-events: none; opacity: 0; background: radial-gradient(circle, rgba(255,246,216,0.95) 0 18%, rgba(239,224,184,0.45) 36%, transparent 68%); }
${R} .prof-burst.gold { background: radial-gradient(circle, #fff6d8 0 18%, rgba(243,207,134,0.8) 38%, transparent 70%); }
${R} .prof-nick { background: radial-gradient(circle, rgba(245,189,180,0.95) 0 16%, rgba(224,135,90,0.5) 36%, transparent 66%); }
${R} .prof-burst.on.a { animation: prof-flash-a 0.42s ease-out forwards; }
${R} .prof-burst.on.b { animation: prof-flash-b 0.42s ease-out forwards; }
@keyframes prof-flash-a { from { opacity: 1; transform: scale(0.4); } to { opacity: 0; transform: scale(1.4); } }
@keyframes prof-flash-b { from { opacity: 1; transform: scale(0.4); } to { opacity: 0; transform: scale(1.4); } }

@media (prefers-reduced-motion: reduce) {
  ${R} .prof-glint::before, ${R} .prof-glint::after, ${R} .prof-float, ${R} .prof-tugring { animation: none; }
  ${R} .prof-burst.on.a, ${R} .prof-burst.on.b { animation: none; opacity: 0.85; }
  ${R} .prof-hint { transition: none; }
}
`;
