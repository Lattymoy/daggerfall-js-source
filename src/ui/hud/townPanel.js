// @ts-check
// NOTICE-PANEL (bible/01-Overview/bugs/Field-Bugs-2026-10-29g.md; the owner: "a detailed drop down from the compass that
// shows the town name, guild control, prosperity and clickable notice board button"): THE TOWN'S PANEL, hung from the
// compass while the player is in a settlement. A view only - scenes/townPanelHost.js says what it shows and answers its
// presses. The kit (ui/enhanced/enhancedFrame.js FRAME_ROLES) paints its frame and buttons; this sheet lays them out.
import { t } from '../../systems/textManager.js';
import { FRAME_TONES, frameCss, scopeRules } from '../enhanced/enhancedFrame.js';
import { PIXEL_FONT_CSS } from '../pixelifyFive.js';
import { isEnhancedPlus } from '../../systems/uiSkin.js';
import { injectEnhancedFonts } from '../enhanced/enhancedStyle.js';
import { hudArranging } from './hudLayout.js';

export const TOWN_PANEL_TEXT = Object.freeze({
  get notice() {
    return t('town.panel.notice', 'Notice Board');
  },
  get bounty() {
    return t('town.panel.bounty', 'Bounty Board');
  },
  /** AUDIT FB1029g P10: the Notice Board's count of new notes, '' for none. @param {number} n */
  unseen: (n) => (n > 0 ? t('town.panel.new', '{n, plural, one {# new} other {# new}}', { n }) : ''),
});

const STYLE_ID = 'dftown-panel-css';
const KIT_ID = 'dftown-panel-kit';
const T = FRAME_TONES;
export const TOWN_PANEL_CSS = `
.dftown-panel { display: none; flex-direction: column; align-items: stretch; width: min(300px, 70vw); padding: 0 0 8px;
  ${PIXEL_FONT_CSS} color: #d8cfae; border-width: 2px; border-style: solid; transform-origin: top center; pointer-events: none; }
.dftown-panel.on { display: flex; animation: dftown-drop 160ms ease-out; }
.dftown-panel.fixed { position: fixed; left: 50%; top: 52px; transform: translateX(-50%); z-index: 12; }
.dftown-panel.fixed.on { animation: none; }
.dftown-panel.fixed.at-compass { left: auto; top: auto; transform: none; transform-origin: bottom right; }
@keyframes dftown-drop { from { opacity: 0; transform: translateY(-6px) scaleY(0.92); } to { opacity: 1; transform: none; } }
@media (prefers-reduced-motion: reduce) { .dftown-panel.on { animation: none; } }
.dftown-head { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; padding: 5px 10px 4px; margin: 0 0 6px;
  font: inherit; font-size: 13px; letter-spacing: 0.1em; text-transform: uppercase; color: #efe8d6; background: none; border: 0;
  border-bottom: 1px solid ${T.groove}; text-shadow: 1px 1px 0 ${T.outline}; cursor: pointer; pointer-events: auto; text-align: left; }
.dftown-fold { font-size: 10px; color: #b3a684; transition: transform 120ms; }
.dftown-panel.folded .dftown-head { margin: 0; border-bottom: 0; }
.dftown-panel.folded { padding-bottom: 0; }
.dftown-panel.folded .dftown-fold { transform: rotate(-90deg); }
.dftown-panel.folded .dftown-body { display: none; }
.dftown-body { display: flex; flex-direction: column; gap: 4px; padding: 0 10px; }
.dftown-line { margin: 0; font-size: 11px; line-height: 1.35; color: #c9bfa4; text-shadow: 1px 1px 0 ${T.outline}; }
.dftown-acts { display: flex; gap: 6px; margin-top: 4px; }
.dftown-btn { flex: 1 1 0; min-height: 24px; padding: 3px 6px; font: inherit; font-size: 11px; letter-spacing: 0.04em; color: #efe0b8;
  border-width: 2px; border-style: solid; pointer-events: auto; cursor: pointer; }
.dftown-new { margin-left: 5px; color: ${T.brassHi}; }
.dftown-new:empty { display: none; }
`;
/** The kit's rules cut to the panel's own selectors - the classic skin's copy of its Plus dress (navalHud.js's law). */
export const townPanelKitCss = () => scopeRules(frameCss(), (sel) => sel.includes('dftown'));

function addSheet(doc, id, text) {
  if (doc.getElementById?.(id)) return;
  const st = doc.createElement('style');
  st.id = id;
  st.textContent = text;
  (doc.head ?? doc.body)?.append(st);
}
function el(doc, tag, cls, text = null) {
  const n = doc.createElement(tag);
  n.className = cls;
  if (text != null) n.textContent = text;
  return n;
}

/**
 * The panel: `show(view)` with `{ name, lines, unseen, bounty }` - its heading, its lines (each a string), the Notice
 * Board's count of new notes and whether the Bounty Board is offered - `hide()` and `place(anchor)`. A press on a button
 * is the panel's alone (the hosts swing from a window mousedown); the heading folds the panel to its name.
 * @param {{ doc?: any, onNotice?: () => void, onBounty?: () => void, folded?: boolean, onFold?: (folded: boolean) => void }} [o]
 */
export function createTownPanel({
  doc = globalThis.document,
  onNotice = () => {},
  onBounty = () => {},
  folded = false,
  onFold = () => {},
} = {}) {
  addSheet(doc, STYLE_ID, TOWN_PANEL_CSS);
  if (!isEnhancedPlus()) addSheet(doc, KIT_ID, townPanelKitCss());
  if (doc.head) injectEnhancedFonts(doc);
  const root = el(doc, 'div', 'dftown-panel');
  root.setAttribute('role', 'region');
  const head = el(doc, 'button', 'dftown-head');
  head.type = 'button';
  const name = el(doc, 'span', 'dftown-name');
  head.append(name, el(doc, 'span', 'dftown-fold', '▾'));
  const body = el(doc, 'div', 'dftown-body');
  const lines = el(doc, 'div', 'dftown-lines');
  const acts = el(doc, 'div', 'dftown-acts');
  const notice = el(doc, 'button', 'dftown-btn primary');
  notice.type = 'button';
  const noticeWord = el(doc, 'span', 'dftown-word', TOWN_PANEL_TEXT.notice),
    noticeNew = el(doc, 'span', 'dftown-new');
  notice.append(noticeWord, noticeNew);
  const bounty = el(doc, 'button', 'dftown-btn', TOWN_PANEL_TEXT.bounty);
  bounty.type = 'button';
  acts.append(notice, bounty);
  body.append(lines, acts);
  root.append(head, body);
  let measured = -1;
  /** AUDIT FB1029g P6: its height, for the quest card it would stand under on a narrow screen (enhancedStyle.js --qt-town). */
  const measure = () => {
    const h = Math.round(root.offsetHeight || 0);
    if (h !== measured) {
      measured = h;
      doc.body?.style?.setProperty?.('--dftown-h', `${h}px`);
    }
  };
  const fold = (f) => {
    folded = !!f;
    root.classList.toggle('folded', folded);
    head.setAttribute('aria-expanded', String(!folded));
    measure();
  };
  fold(folded);
  for (const n of [head, notice, bounty]) {
    n.addEventListener('mousedown', (e) => {
      if (!hudArranging()) e.stopPropagation();
    });
    n.addEventListener('mouseup', (e) => {
      if (!hudArranging()) e.stopPropagation();
    });
  }
  // AUDIT FB1029g P14: the press lets go of the focus - a button kept focused takes the next Space or Enter as a press
  const press = (n, fn) =>
    n.addEventListener('click', (e) => {
      if (hudArranging()) return;
      e.stopPropagation();
      n.blur?.();
      fn();
    });
  press(head, () => {
    fold(!folded);
    onFold(folded);
  });
  press(notice, () => onNotice());
  press(bounty, () => onBounty());
  let drawn = '',
    anchored = '';
  /** The panel rides the compass's column where the enhanced HUD stands, else stands on its own. AUDIT FB1029g P4: seated
   *  from its making, so the HUD's editor has it to preview before the first town. */
  const seat = () => {
    const top = doc.querySelector?.('.hud .hud-top');
    const at = top ?? doc.body;
    if (root.parentNode !== at) at?.append(root);
    root.classList.toggle('fixed', !top);
  };
  seat();
  return {
    el: root,
    get shown() {
      return root.classList.contains('on');
    },
    get folded() {
      return folded;
    },
    /** @param {{ name: string, lines: string[], unseen?: number, bounty?: boolean }} view */
    show(view) {
      seat();
      const unseen = TOWN_PANEL_TEXT.unseen(view.unseen ?? 0);
      const key = JSON.stringify([
        view.name,
        view.lines,
        unseen,
        !!view.bounty,
        TOWN_PANEL_TEXT.notice,
        TOWN_PANEL_TEXT.bounty,
      ]);
      if (key !== drawn) {
        drawn = key;
        name.textContent = view.name;
        root.setAttribute('aria-label', view.name);
        head.title = view.name;
        lines.replaceChildren(...view.lines.map((l) => el(doc, 'p', 'dftown-line', l)));
        noticeWord.textContent = TOWN_PANEL_TEXT.notice;
        noticeNew.textContent = unseen;
        bounty.textContent = TOWN_PANEL_TEXT.bounty;
        bounty.hidden = !view.bounty;
        root.classList.add('on');
        measure();
      }
      root.classList.add('on');
    },
    /** AUDIT FB1029g P4: out of town its heading is the editor's preview (hudLayout.js), never the last town's. */
    hide() {
      root.classList.remove('on');
      if (drawn) {
        drawn = '';
        name.textContent = '';
        lines.replaceChildren();
      }
    },
    /** AUDIT FB1029g P6, P13: on the classic skin the panel stands on the compass (hud.js classicCompassAnchor: its right
     *  and bottom offsets), off the popup text it covered at the top; with no anchor, under the top edge.
     *  @param {{ right: number, bottom: number } | null} anchor */
    place(anchor) {
      seat();
      const a = anchor && root.classList.contains('fixed') ? `${anchor.right},${anchor.bottom}` : '';
      if (a === anchored) return;
      anchored = a;
      root.classList.toggle('at-compass', !!a);
      root.style.right = a ? `${anchor?.right}px` : '';
      root.style.bottom = a ? `${anchor?.bottom}px` : '';
    },
    dispose() {
      root.remove();
    },
  };
}
