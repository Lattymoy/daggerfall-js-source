// LV2: THE ASCEND SCREEN, IN STONE AND BRASS - and the marks a click on a
// star leaves. Layout is the screen's own (ui/enhancedStyle.js, the six
// pinned bands); this only dresses it, so nothing here moves a band:
// the crown and the foot become lit stone bands, the pool a brass
// plaque, and the skill ribbon sits in a sunk channel. The stars' own
// numbers stay plain text. A leaf module; the sheet appends it before the kit.
import { FRAME_TONES as T } from './enhancedFrame.js';

const RAISED = `${T.stoneLit} ${T.stoneDim} ${T.stoneDark} ${T.stoneMid}`;
const BRASS = `${T.brassHi} ${T.brassLo} #5c3f1a ${T.brass}`;

export const LV2_CSS = `
/* ── LV2: THE ASCEND SCREEN (ui/levelUpStyle.js) ─────────────────── */
/* PLUS2c: the sky stays a sky under every colour. A Plus theme dims (or, textured, hides
   outright) the same .px-ground the rest of the enhanced skin uses as a backdrop behind its
   windows, which read fine dimmed since a window's own ground sits over it. The Ascend screen has
   no window ground of its own - the sky IS the screen - so that dimming reads as "the stars went
   missing" the moment a theme other than Slate is picked. The root also wears \`.px-home\`
   (ui/enhancedLevelUp.js's \`el('div', 'px-home lv-sky')\`), so keying on both lifts this to FOUR
   classes of specificity against the theme rule's three (:root[attr] + .px-ground) - it wins by
   weight, not by injection order, and needs no !important. */
:root .px-home.lv-sky .px-ground { opacity: 1; }
.lv-sky .lv-crown, .lv-sky .lv-foot {
  background: linear-gradient(180deg, rgba(24,27,34,0.92), rgba(12,14,18,0.9)); }
.lv-sky .lv-crown { box-shadow: 0 1px 0 ${T.groove}, 0 4px 0 rgba(0,0,0,0.35); }
.lv-sky .lv-foot { box-shadow: inset 0 1px 0 ${T.groove}, 0 -4px 0 rgba(0,0,0,0.25); }

/* the pool: a brass plaque */
/* bevels drawn as inset shadows, so no plaque adds a pixel to its band */
.lv-plate .lv-count { display: inline-block; min-width: 64px; padding: 0 14px; background: rgba(20,16,10,0.88);
  box-shadow: 0 0 0 1px ${T.outline}, inset 2px 2px 0 ${T.brassHi}, inset -2px -2px 0 #5c3f1a, 3px 3px 0 1px rgba(0,0,0,0.45); }
.lv-plate.spent .lv-count { background: rgba(12,14,18,0.88);
  box-shadow: 0 0 0 1px ${T.outline}, inset 2px 2px 0 ${T.stoneLit}, inset -2px -2px 0 ${T.stoneDark}, 3px 3px 0 1px rgba(0,0,0,0.45); }

/* a star: the gem, the name and its value - plain numbers, no plaque */
.lv-star .lv-gem { display: inline-block; }
.lv-star .lv-val { display: inline-block; }
.lv-star.raised .lv-val { color: rgb(243,239,44); text-shadow: 2px 2px 0 rgb(93,77,12); }

/* the chosen attribute, under the figure */
.lv-choice .lv-pickname { padding: 0 14px; background: rgba(12,14,18,0.8);
  box-shadow: 0 0 0 1px ${T.outline}, inset 2px 2px 0 ${T.stoneLit}, inset -2px -2px 0 ${T.stoneDark}; }
.lv-plate .lv-howto { position: absolute; right: 26px; top: 50%; transform: translateY(-50%); max-width: 250px; margin: 0;
  font-size: 12px; line-height: 1.5; text-align: right; color: #8f8670; text-shadow: 2px 2px 0 rgba(0,0,0,0.8); }
@media (max-width: 900px) { .lv-plate .lv-howto { display: none; } }

/* the ribbon: a sunk channel */
.lv-sky .lv-ribbonwrap { background: rgba(0,0,0,0.3); border-top-color: ${T.outline};
  box-shadow: inset 0 2px 0 rgba(0,0,0,0.45), 0 -1px 0 ${T.groove}; }

/* ── LV2: WHAT A CLICK LEAVES ──────────────────────────────────── */
@keyframes lv-pick { 0% { transform: scale(1.6); } 50% { transform: scale(1.25); } 100% { transform: scale(1); } }
@keyframes lv-flash { 0% { transform: scale(1.9); color: #fffbe0; } 40% { transform: scale(1.4); } 100% { transform: scale(1); } }
@keyframes lv-dim { 0% { transform: scale(0.6); opacity: 0.5; } 100% { transform: scale(1); } }
@keyframes lv-shake { 0%, 100% { translate: 0 0; } 25% { translate: -3px 0; } 50% { translate: 3px 0; } 75% { translate: -2px 0; } }
@keyframes lv-rise { 0% { transform: translate(-50%, 0); opacity: 1; } 70% { opacity: 1; } 100% { transform: translate(-50%, -26px); opacity: 0; } }
@keyframes lv-fall { 0% { transform: translate(-50%, 0); opacity: 1; } 70% { opacity: 1; } 100% { transform: translate(-50%, 20px); opacity: 0; } }
.lv-star.fx-pick .lv-gem { animation: lv-pick 240ms steps(3, end); }
.lv-star.fx-up .lv-gem { animation: lv-flash 320ms steps(4, end); }
.lv-star.fx-down .lv-gem { animation: lv-dim 260ms steps(3, end); }
.lv-star.fx-no .lv-val { animation: lv-shake 240ms steps(4, end); }
.lv-pop { position: absolute; left: 50%; top: 0; pointer-events: none; font-size: 16px; line-height: 1;
  letter-spacing: 0; text-indent: 0; }
.lv-pop.up { color: rgb(243,239,44); text-shadow: 2px 2px 0 rgb(93,77,12); animation: lv-rise 640ms steps(8, end) forwards; }
.lv-pop.down { color: #e0584a; text-shadow: 2px 2px 0 #3a0f0b; top: auto; bottom: 0; animation: lv-fall 560ms steps(7, end) forwards; }
@media (prefers-reduced-motion: reduce) {
  .lv-star.fx-pick .lv-gem, .lv-star.fx-up .lv-gem, .lv-star.fx-down .lv-gem, .lv-star.fx-no .lv-val { animation: none; }
  .lv-pop { display: none; }
}
`;
