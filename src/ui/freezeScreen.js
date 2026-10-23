// @ts-check
// STAFF-PANEL5-FREEZE (2026-10-22; design doc "DFO Staff Panel: design", Freeze player): THE "FROZEN BY STAFF" SCREEN - a
// banner over the top of the world while a staff freeze stands (net/staffChat.js paints it): why, until when, and the
// server's Discord invite with a Copy button. It holds nothing itself: the motor is held by the paralysis gates
// (characters/playerEntity.js staffFrozen), and the relay and the account service hold a game that never draws this.
// It takes no focus and no keys, so the mouse still looks around and the chat still opens on the Staff tab.
import { frozenTitleText, frozenBodyText, frozenUntilText, frozenReasonText, staffInviteText } from '../net/staffChat.js';
import { copyText } from '../net/chat.js';

// z 34: over the HUD's banners and title cards (30-32), under the game's windows and boxes (35-39) and the asset picker
// above every overlay (scenes/dataSource.js ASSET_PICKER_Z, test/scenes/mwattach.test.js MWFIX 1); no other overlay stands at 34
const CSS = `.dffreeze{position:fixed;top:12px;left:50%;transform:translateX(-50%);z-index:34;max-width:min(560px,calc(100vw - 32px));
padding:10px 16px;border:1px solid #8fb4d8;border-radius:6px;background:rgba(14,22,34,.88);color:#e8eef6;font:14px/1.4 system-ui,sans-serif;
text-align:center;pointer-events:none}
.dffreeze[hidden]{display:none}.dffreeze h2{margin:0 0 4px;font-size:18px;color:#b9d8ff}.dffreeze p{margin:2px 0}
.dffreeze .dffreeze-invite{pointer-events:auto;margin-top:6px;word-break:break-all}
.dffreeze button{margin-left:8px;padding:2px 10px;border:1px solid #8fb4d8;border-radius:4px;background:#1d2e44;color:#e8eef6;cursor:pointer}`;

/**
 * The screen, made hidden; `paint({ until, reason, invite })` shows it while `until` is set and hides it at 0.
 * @param {{ doc?: Document, win?: any }} [io]
 */
export function createFreezeScreen({ doc = document, win = globalThis } = {}) {
  const el = (/** @type {string} */ tag, /** @type {string} */ cls = '', text = '') => { const n = doc.createElement(tag); if (cls) n.className = cls; if (text) n.textContent = text; return n; };
  if (!doc.getElementById('dffreeze-css')) { const s = el('style'); s.id = 'dffreeze-css'; s.textContent = CSS; doc.head.append(s); }
  const root = el('div', 'dffreeze');
  root.hidden = true;
  root.setAttribute('role', 'status');
  const title = el('h2'), body = el('p'), until = el('p'), why = el('p'), invite = el('p', 'dffreeze-invite');
  const link = el('span'), copy = /** @type {HTMLButtonElement} */ (el('button'));
  copy.type = 'button';
  copy.tabIndex = -1;   // never the focus: the keys stay the game's
  let words = '';
  copy.addEventListener('click', (e) => { e.stopPropagation?.(); try { win.navigator?.clipboard?.writeText?.(words)?.catch?.(() => {}); } catch { /* the words stay on the screen to select */ } });
  invite.append(link, copy);
  root.append(title, body, until, why, invite);
  doc.body.append(root);
  return {
    root,
    /** @param {{ until: number, reason: string|null, invite: string|null }} s */
    paint({ until: u, reason, invite: url }) {
      root.hidden = !(u > 0);
      if (root.hidden) return;
      title.textContent = frozenTitleText();
      body.textContent = frozenBodyText();
      until.textContent = frozenUntilText(u);
      why.textContent = reason ? frozenReasonText(reason) : '';
      words = url ?? '';
      invite.hidden = !url;
      link.textContent = url ? staffInviteText(url) : '';
      copy.textContent = copyText();
    },
    destroy() { root.remove(); },
  };
}
