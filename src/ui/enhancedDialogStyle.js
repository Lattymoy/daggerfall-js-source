// DLG1: the decision box's own layout (ui/enhancedDialog.js). A leaf
// module: ui/enhancedStyle.js appends it to the sheet.
import { PIXEL_STACK } from './pixelifyFive.js';

/** The dialog's own layout; its frame, buttons and bands are the kit's
 *  (ui/enhancedFrame.js lists .dlg-win, .dlg-btn and .dlg-acts). */
export const DIALOG_CSS = `
/* ── DLG1: THE DECISION BOX (ui/enhancedDialog.js) ───────────────── */
.dlg-shell { position: fixed; inset: 0; z-index: 40; display: flex; align-items: center; justify-content: center;
  padding: 24px; background: rgba(5,6,8,0.5); font-family: ${PIXEL_STACK};
  -webkit-font-smoothing: none; font-variant-ligatures: none; font-feature-settings: 'liga' 0, 'clig' 0;
  color: #d8cfae; }
.dlg-shell .dlg-win.px-win { width: auto; height: auto; min-width: min(340px, 92vw); max-width: min(560px, 92vw);
  max-height: 80dvh; }
.dlg-body { padding: 22px 28px 18px; overflow-y: auto; display: flex; flex-direction: column; gap: 2px;
  text-align: center; }
.dlg-row { margin: 0; font-size: 17px; line-height: 1.45; text-shadow: 2px 2px 0 rgba(0,0,0,0.85);
  overflow-wrap: anywhere; }
.dlg-row.hl { color: rgb(219,130,40); }
.dlg-row .dlg-cell + .dlg-cell { margin-left: 18px; }
.dlg-acts { display: flex; justify-content: center; flex-wrap: wrap; gap: 12px; padding: 12px 20px 14px;
  border-top: 2px solid rgba(125,116,96,0.55); }
.dlg-btn { display: inline-flex; align-items: center; justify-content: center; gap: 10px;
  min-width: 112px; min-height: 44px; padding: 6px 18px; border: 2px solid rgba(125,116,96,0.55);
  font: inherit; font-size: 16px; letter-spacing: 0.16em; text-indent: 0.16em; text-transform: uppercase;
  color: #d8cfae; cursor: pointer; text-shadow: 2px 2px 0 rgba(0,0,0,0.85); }
.dlg-btn:hover, .dlg-btn:focus-visible, .dlg-btn.primary { color: rgb(243,239,44); text-shadow: 2px 2px 0 rgb(93,77,12); }
.dlg-key { display: inline-flex; align-items: center; justify-content: center; min-width: 20px; height: 20px;
  padding: 0 4px; font-size: 12px; letter-spacing: 0; text-indent: 0; color: #0e1013; text-shadow: none;
  background: #c9bfa4; box-shadow: inset -2px -2px 0 #7a7260, inset 2px 2px 0 #efe8d6, 0 0 0 1px #050608; }
.dlg-btn.primary .dlg-key { background: #e2b064; box-shadow: inset -2px -2px 0 #7a5424, inset 2px 2px 0 #f3cf86, 0 0 0 1px #050608; }
`;
