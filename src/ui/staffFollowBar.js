// @ts-check
// STAFF-FOLLOW-UNLOCK (2026-10-24, mob: "follow needs a unlock button in game") and STAFF-HIDE-IN-GAME (mob: "when i ment
// hide button for chat i ment for invisble", "and hide me and unlock button?") - THE STAFF BAR ON THE GAME'S OWN SCREEN.
// Once a Staff Panel has spoken on the page, a small bar at the top says whether the staff member is hidden, with a Hide
// me or Show myself button (net/staffHook.js staffHide - the panel's worker says it on the staff session, and every game
// tab relinks); while a follow is locked it says "Following" too, with an Unlock that lets go at once (net/staffHook.js
// unlock - the host's own `held` then parks or rejoins as ever, scenes/staffFollowHost.js). One element, made on the
// first show and only shown or hidden after; its words written only when they change. Its buttons take a free cursor's
// press (Y frees it, as for every window), and the world under them hears nothing of it.
import { PIXEL_FONT_CSS, PIXEL_TEXT_SHADOW } from './pixelifyFive.js';
import { STAFF_TAG_COLORS } from './staffTags.js';
import { t } from '../systems/textManager.js';

const BAR_CSS = `position:fixed;left:50%;top:10px;transform:translateX(-50%);z-index:13;display:flex;gap:8px;align-items:center;${PIXEL_FONT_CSS}font-size:13px;color:${STAFF_TAG_COLORS.name};background:${STAFF_TAG_COLORS.plate};border:1px solid rgba(127,227,240,0.35);border-radius:3px;padding:3px 6px 3px 10px;text-shadow:${PIXEL_TEXT_SHADOW};pointer-events:auto;`;
const BUTTON_CSS = `${PIXEL_FONT_CSS}font-size:13px;color:${STAFF_TAG_COLORS.plain};background:rgba(127,227,240,0.12);border:1px solid rgba(127,227,240,0.45);border-radius:3px;padding:1px 8px;cursor:pointer;text-shadow:${PIXEL_TEXT_SHADOW};`;
const UNLOCK_CSS = `${BUTTON_CSS}background:rgba(224,80,60,0.35);border-color:${STAFF_TAG_COLORS.high};`;

/** @param {{ doc?: any, onUnlock: () => void, onHide?: (on: boolean) => void }} deps */
export function createStaffFollowBar({ doc = globalThis.document, onUnlock, onHide = () => {} }) {
  if (!doc?.createElement || !doc.body) return { show() {}, hide() {}, dispose() {} };
  let bar = /** @type {any} */ (null), words = /** @type {any} */ (null), hideBtn = /** @type {any} */ (null), unlock = /** @type {any} */ (null);
  let shown = false, hiddenNow = false;
  /** @type {Record<string, any>} */
  const said = {};
  const put = (/** @type {string} */ k, /** @type {any} */ v, /** @type {(v: any) => void} */ write) => { if (said[k] !== v) { said[k] = v; write(v); } };
  const button = (/** @type {string} */ css, /** @type {string} */ data, /** @type {() => void} */ run) => {
    const b = doc.createElement('button');
    b.setAttribute('type', 'button');
    b.setAttribute(data, '');
    b.style.cssText = css;
    for (const k of ['pointerdown', 'mousedown']) b.addEventListener?.(k, (/** @type {any} */ e) => e.stopPropagation?.());
    b.addEventListener?.('click', (/** @type {any} */ e) => { e.stopPropagation?.(); e.preventDefault?.(); run(); });
    return b;
  };
  function make() {
    bar = doc.createElement('div');
    bar.setAttribute('data-staff-follow-bar', '');
    bar.style.cssText = BAR_CSS;
    words = doc.createElement('span');
    hideBtn = button(BUTTON_CSS, 'data-staff-hide', () => onHide(!hiddenNow));
    unlock = button(UNLOCK_CSS, 'data-staff-unlock', onUnlock);
    unlock.textContent = t('net.staffFollow.unlock', 'Unlock');
    bar.append(words, hideBtn, unlock);
    doc.body.append(bar);
  }
  return {
    /** The bar this frame: `following` while a follow is locked (its target's `name` when the page knows it), `hidden`
     *  whether the game's links are hidden now, `asking` while a Hide me press waits on the panel, `seeing` whether the
     *  follow has found the target yet (FOLLOW-GROUND-HINT: locked and not yet seen says so, never a silent camera).
     *  @param {{ following?: boolean, name?: string, hidden?: boolean, asking?: boolean, seeing?: boolean }} [s] */
    show({ following = false, name = '', hidden = false, asking = false, seeing = true } = {}) {
      if (!bar) make();
      hiddenNow = hidden;
      const line = following && !seeing ? t('net.staffFollow.finding', 'Following - finding them…')
        : following ? (name ? t('net.staffFollow.following', 'Following {name}', { name }) : t('net.staffFollow.followingAnon', 'Following'))
        : hidden ? t('net.staffFollow.hidden', 'Hidden') : t('net.staffFollow.shown', 'Shown to players');
      put('line', line, (v) => { words.textContent = v; });
      put('hide', asking ? '…' : hidden ? t('net.staffFollow.showMe', 'Show myself') : t('net.staffFollow.hideMe', 'Hide me'), (v) => { hideBtn.textContent = v; });
      put('unlock', following, (v) => { unlock.style.display = v ? '' : 'none'; });
      if (!shown) { shown = true; bar.style.display = 'flex'; }
    },
    hide() { if (bar && shown) { shown = false; bar.style.display = 'none'; } },
    dispose() { bar?.remove(); bar = null; shown = false; for (const k of Object.keys(said)) delete said[k]; },
  };
}
