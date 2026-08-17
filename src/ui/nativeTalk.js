// U8b: the NATIVE TALK WINDOW - real TALK01I0.IMG on the 320x200
// panel (DFU DaggerfallTalkWindow geometry, MIT Daggerfall
// Workshop). The button labels are BAKED in the art; DFU overlays
// invisible hit rects - so do we, through pointToNative. The window
// replaces the interim ChoiceWindow talk chain when the art is
// loaded; art-less sessions keep the old chain (never trap).
//
// Verbatim geometry (DaggerfallTalkWindow.cs):
//   buttons (x4, w107, h10): Tell me about y4 / Where is y14 /
//   Location y26 / People y36 / Things y46 / Work y56;
//   Okay (4,186,107,10); Goodbye (118,183,67,10);
//   topic list (6,71) 94x104; conversation (189,65) 114x126;
//   player-says label (123,8) 124x38; NPC name (117,52) 197x10;
//   portrait (119,65) 64x64 (TFAC faces PEND - the art's frame
//   shows); tone radios (258, 18/28/38) 6x6 (the TALK02/03
//   highlight art PENDS - an interim mark fills the active box).
//   Topic scroll arrows: up (102,69,9,16) down (102,161,9,16).
//
// Interaction: clicks/taps through the hit rects (the phone path),
// with the session's keyboard accelerators preserved - W opens
// Where-is > Location, T cycles tone, digits pick visible rows,
// N/P page, Esc/E goodbye. People/Things/Work are INTERIM no-ops
// (their topic sources pend quests/work).

import { loadImg, nativeMetrics, drawImg, drawRect, shadowText, SCREEN_DIM, pointToNative, DEFAULT_TEXT_COLOR } from './nativePanel.js';
import { wrapText } from './talkWindow.js';
import { measureText } from './text.js';

export const TALK_RECTS = Object.freeze({
  tellMeAbout: [4, 4, 107, 10],
  whereIs: [4, 14, 107, 10],
  categoryLocation: [4, 26, 107, 10],
  categoryPeople: [4, 36, 107, 10],
  categoryThings: [4, 46, 107, 10],
  categoryWork: [4, 56, 107, 10],
  okay: [4, 186, 107, 10],
  goodbye: [118, 183, 67, 10],
  topicList: [6, 71, 94, 104],
  conversation: [189, 65, 114, 126],
  npcName: [117, 52, 197, 10],
  tonePolite: [258, 18, 6, 6],
  toneNormal: [258, 28, 6, 6],
  toneBlunt: [258, 38, 6, 6],
  topicUp: [102, 69, 9, 16],
  topicDown: [102, 161, 9, 16],
});
export const TOPIC_ROW_H = 9;
export const TOPIC_ROWS = Math.floor(TALK_RECTS.topicList[3] / TOPIC_ROW_H);   // 11 visible

let _art = null;
export async function preloadTalkArt(deps) {
  if (_art) return;
  try { _art = await loadImg(deps, 'TALK01I0.IMG'); }
  catch { console.warn('[talk] TALK01I0.IMG unavailable; the text talk chain stands in'); }
}
export const talkArtLoaded = () => !!_art;

const inRect = ([rx, ry, rw, rh], x, y) => x >= rx && y >= ry && x < rx + rw && y < ry + rh;

/** The session seam: hooks = { categories() -> [{label, buildings}],
 *  answer(building) -> string, tone() -> 0|1|2, setTone(t),
 *  onClose() }. The conversation panel keeps the session history. */
export class NativeTalkWindow {
  constructor(greeting, hooks) {
    this.hooks = hooks;
    this.done = false;
    this.isChoiceWindow = true;      // raw codes through townTalk
    this.conversation = [greeting];  // classic: answers append here
    this.topics = [];                // current list rows
    this.topicMode = 'none';         // none | categories | buildings
    this.scroll = 0;
    this._category = null;
  }

  _openCategories() {
    this.topics = this.hooks.categories();
    this.topicMode = 'categories';
    this.scroll = 0;
  }
  _pick(i) {
    const it = this.topics[this.scroll + i];
    if (!it) return;
    if (this.topicMode === 'categories') {
      this._category = it;
      this.topics = it.buildings;
      this.topicMode = 'buildings';
      this.scroll = 0;
    } else if (this.topicMode === 'buildings') {
      this.conversation.push(this.hooks.answer(it));
    }
  }
  _page(d) {
    const max = Math.max(0, this.topics.length - TOPIC_ROWS);
    this.scroll = Math.max(0, Math.min(max, this.scroll + d * TOPIC_ROWS));
  }
  _close() { this.done = true; this.hooks.onClose?.(); }

  /** Keyboard accelerators (the session's established keys). */
  input(code) {
    if (code === 'Escape' || code === 'KeyE' || code === 'Enter') { this._close(); return; }
    if (code === 'KeyW') { this._openCategories(); return; }
    if (code === 'KeyT') { this.hooks.setTone((this.hooks.tone() + 1) % 3); return; }
    if (code === 'KeyN') { this._page(1); return; }
    if (code === 'KeyP') { this._page(-1); return; }
    const d = /^Digit([1-9])$/.exec(code);
    if (d) this._pick(Number(d[1]) - 1);
  }

  /** Pointer path (phone taps + mouse): virtual-space hit rects. */
  click(vx, vy) {
    const R = TALK_RECTS;
    if (inRect(R.goodbye, vx, vy) || inRect(R.okay, vx, vy)) { this._close(); return true; }
    if (inRect(R.whereIs, vx, vy) || inRect(R.categoryLocation, vx, vy)) { this._openCategories(); return true; }
    if (inRect(R.tonePolite, vx, vy)) { this.hooks.setTone(0); return true; }
    if (inRect(R.toneNormal, vx, vy)) { this.hooks.setTone(1); return true; }
    if (inRect(R.toneBlunt, vx, vy)) { this.hooks.setTone(2); return true; }
    if (inRect(R.topicUp, vx, vy)) { this._page(-1); return true; }
    if (inRect(R.topicDown, vx, vy)) { this._page(1); return true; }
    if (inRect(R.topicList, vx, vy)) { this._pick(Math.floor((vy - R.topicList[1]) / TOPIC_ROW_H)); return true; }
    // Tell me about / People / Things / Work: INTERIM no-ops (pend)
    return inRect(R.tellMeAbout, vx, vy) || inRect(R.categoryPeople, vx, vy)
      || inRect(R.categoryThings, vx, vy) || inRect(R.categoryWork, vx, vy);
  }

  draw(renderer, canvas, font) {
    if (!_art) { this._close(); return; }   // art gone mid-session: release the motor
    const m = nativeMetrics(canvas);
    renderer.drawScreenQuad(null, { x: 0, y: 0, w: canvas.width, h: canvas.height }, undefined, SCREEN_DIM);
    drawImg(renderer, _art, m, 0, 0);
    const R = TALK_RECTS;
    // NPC name (the seed-named person pends NPC names - the People
    // faction stands in)
    shadowText(renderer, font, this.hooks.npcName ?? '', m, R.npcName[0], R.npcName[1] + 1);
    // the active tone's interim mark (TALK02/03 highlight art pends)
    const toneRect = [R.tonePolite, R.toneNormal, R.toneBlunt][this.hooks.tone()];
    drawRect(renderer, m, toneRect[0] + 1, toneRect[1] + 1, 4, 4, DEFAULT_TEXT_COLOR);
    // topic rows, truncated to the list width
    const fit = (t, w) => { let s = t; while (s.length > 1 && measureText(font.fnt, s) > w) s = s.slice(0, -1); return s; };
    this.topics.slice(this.scroll, this.scroll + TOPIC_ROWS).forEach((it, i) =>
      shadowText(renderer, font, fit(it.label ?? it.name, R.topicList[2] - 2), m, R.topicList[0] + 1, R.topicList[1] + 1 + i * TOPIC_ROW_H));
    // conversation: wrapped, bottom-anchored in the panel
    const lineH = 8;
    const maxLines = Math.floor(R.conversation[3] / lineH);
    const wrapped = [];
    for (const c of this.conversation) wrapped.push(...wrapText(font.fnt, c, (R.conversation[2] - 2) * 1), '');
    const view = wrapped.slice(-maxLines);
    view.forEach((l, i) =>
      shadowText(renderer, font, l, m, R.conversation[0] + 1, R.conversation[1] + 1 + i * lineH, { color: [0.9, 0.9, 0.85, 1] }));
  }
}
