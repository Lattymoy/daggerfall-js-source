// @ts-check
// AUDIT HCC U6 (2026-09-23, Mac: "any new notifications or UI elements are enhancified"): HORSE CART AND CARGO'S
// HorseNameTooltipController - the horse's name under the crosshair, on BOTH skins.
//
// The mod adds ONE TextLabel to the HUD's NativePanel (EnsureBound [IL_2fe1]: DaggerfallUI.AddTextLabel with the
// default font at TooltipPosition, `.cctor` [IL_30c1] (0, 112), HorizontalAlignment.Center) and each Update sets it
// to the runtime's HorseTargetLabel while the activation ray (3.2 m, the cursor's ray when the cursor is out) meets
// the player's OWN standing horse, else hides it. The port's first cut routed it through the world plaque alone -
// which is the enhanced skin's desktop face and nothing else - so on the classic skin, and on a phone, the name
// was gone. This is the label; the host decides each frame what it says (the ray, the reach, the ownership: the
// pool's pick), and the face is the skin's: DFU's bitmap line on the classic skin, the mid-screen label's DOM face
// on the enhanced one. Where the enhanced plaque is up it already names the horse, and the host says nothing here.
import { drawText, measureText } from './text.js';
import { nativeMetrics, NATIVE_W, DEFAULT_TEXT_COLOR } from './nativePanel.js';
import { isEnhanced } from '../systems/uiSkin.js';
import { drawEnhancedHudLabel, midTextTopPx } from './enhancedHudText.js';

/** HorseNameTooltipController.TooltipPosition's y [IL_30c6] - native rows on the 320x200 panel. */
export const HORSE_TOOLTIP_Y = 112;
export const ENHANCED_HORSE_TOOLTIP_ID = 'enhanced-horse-tooltip';

export class HorseNameTooltip {
  constructor() { this.text = ''; }
  /** Update's two ends: the label's Text and Enabled (set_Text / set_Enabled [IL_2e9d-IL_2ea9]); '' is Hide. */
  set(text) { this.text = typeof text === 'string' ? text : ''; }
  draw(renderer, canvas, font) {
    if (isEnhanced() && typeof document !== 'undefined') {
      drawEnhancedHudLabel(ENHANCED_HORSE_TOOLTIP_ID, { text: this.text, visible: true, top: midTextTopPx(canvas, HORSE_TOOLTIP_Y) });
      return;
    }
    if (!font || !this.text) return;
    const m = nativeMetrics(canvas);
    const x = (NATIVE_W - measureText(font.fnt, this.text)) / 2;
    drawText(renderer, font, this.text, m.ox + x * m.s, m.oy + HORSE_TOOLTIP_Y * m.s, m.s, DEFAULT_TEXT_COLOR);
  }
  /** A frame that draws no HUD says so (a DOM line stays painted - AUDIT 64 F37's law). */
  hide() {
    if (isEnhanced() && typeof document !== 'undefined') drawEnhancedHudLabel(ENHANCED_HORSE_TOOLTIP_ID, { text: '', visible: false });
  }
}

/** One label per game, as the mod's controller is one per runtime. */
export const horseNameTooltip = new HorseNameTooltip();
