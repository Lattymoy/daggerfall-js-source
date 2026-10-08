// @ts-check
// SD15 (2026-10-07, the Super Dungeons arc; bible/11-Multiplayer/Super-Dungeons.md section 10 and section 16's SD15):
// THE HOUR'S CARD - the fight's turns large over the upper middle of the screen (scenes/sdArenaRead.js createSdBeats:
// its wake, the Dragon Break, the Last Moment, the Hour's last minute, its fall), as the Warden's card shows his
// (ui/gateTitleCard.js, WB13e) - but the Hour's own: brass and the Mantella's light, where his burns in Dagon's red
// (Mac, of the Hour: "not oblivion, something different"). The same readout's law: one node made on the first beat
// and updated, never rebuilt; hidden, never removed; hidden with the HUD. Its model is the Warden's own pure one
// (`titleCardModel`). Not a DFU member. Ledger A (SUPER-DUNGEONS).
import { injectEnhancedFonts } from './enhancedStyle.js';

export const SD_TITLE_STYLE_ID = 'dagger-sd-title-style';
/** The Hour's brass and its light. */
export const SD_TITLE_BRASS = '#e8c060';
export const SD_TITLE_CSS = `
.sd-title-card { position: fixed; left: 50%; top: 34%; transform: translate(-50%, -50%); width: min(720px, 92vw);
  pointer-events: none; z-index: 32; text-align: center; font: 600 15px 'Cormorant', Georgia, serif; color: #f5e7c4;
  text-shadow: 0 0 4px #000, 0 0 14px rgba(0,0,0,0.95); }
.sd-title-kicker { font-size: 14px; letter-spacing: 0.42em; text-transform: uppercase; color: ${SD_TITLE_BRASS}; min-height: 17px; }
.sd-title-main { font-size: 42px; line-height: 1.05; letter-spacing: 0.1em; text-transform: uppercase; color: #fff1cf;
  text-shadow: 0 0 4px #000, 0 0 18px rgba(232,192,96,0.55), 0 0 36px rgba(0,0,0,0.9); }
.sd-title-rule { height: 1px; width: 62%; margin: 7px auto 6px; background: linear-gradient(90deg, transparent, ${SD_TITLE_BRASS}, transparent);
  transform: scaleX(0); transition: transform 500ms cubic-bezier(.2,.7,.3,1); }
.sd-title-card.on .sd-title-rule { transform: scaleX(1); }
.sd-title-sub { font-size: 18px; letter-spacing: 0.06em; min-height: 22px; }
.sd-title-card.in .sd-title-main { animation: sd-title-in 420ms cubic-bezier(.2,.7,.3,1); }
@keyframes sd-title-in { from { opacity: 0; letter-spacing: 0.32em; } }
@media (max-width: 640px) { .sd-title-card { top: 40%; } .sd-title-main { font-size: 28px; } .sd-title-sub { font-size: 15px; } .sd-title-kicker { font-size: 12px; letter-spacing: 0.22em; } }
@media (max-height: 480px) { .sd-title-card { top: 46%; } .sd-title-main { font-size: 26px; } .sd-title-kicker { font-size: 12px; } }
/* AUDIT SD III (T2): clear of the Remnant's bar - a phone held upright stands the card under the bar's foot (at 30% it
   sat on the foot's chips); one held sideways has no room for both, so while a beat stands the foot's chips step aside */
@media (max-height: 480px) { body:has(.sd-title-card.on:not([style*="display: none"])) .wb-boss-foot { display: none; } }
`;

let root = null, parts = null;
const SHOWN = () => ({ vis: '', key: '', sub: null, alpha: -1, cls: '' });
let shown = SHOWN();

function build(doc) {
  if (doc.getElementById && !doc.getElementById(SD_TITLE_STYLE_ID)) {
    const st = doc.createElement('style');
    st.id = SD_TITLE_STYLE_ID;
    st.textContent = SD_TITLE_CSS;
    (doc.head ?? doc.body)?.append(st);
    if (doc.head) injectEnhancedFonts(doc);
  }
  const part = (cls) => { const n = doc.createElement('div'); n.className = cls; return n; };
  root = part('sd-title-card');
  root.setAttribute?.('aria-hidden', 'true');   // the Hour's voice says it in words
  const kicker = part('sd-title-kicker'), main = part('sd-title-main'), rule = part('sd-title-rule'), sub = part('sd-title-sub');
  root.append(kicker, main, rule, sub);
  (doc.body ?? doc.documentElement)?.append(root);
  parts = { kicker, main, rule, sub };
}

/** Draw the card for a model (ui/gateTitleCard.js titleCardModel's; null hides it); `hidden` the HUD's own hide. */
export function drawSdTitleCard(model, { hidden = false, doc = globalThis.document } = {}) {
  const want = !hidden && !!model;
  if (!root) {
    if (!want || !doc?.createElement) return;
    build(doc);
  }
  const vis = want ? 'on' : 'off';
  if (vis !== shown.vis) { shown.vis = vis; root.style.display = want ? '' : 'none'; }
  if (!want || !model) return;
  if (model.key !== shown.key) {
    shown.key = model.key;
    parts.kicker.textContent = model.kicker;
    parts.main.textContent = model.main;
    parts.main.style.color = model.color ?? '';
  }
  if (model.sub !== shown.sub) { shown.sub = model.sub; parts.sub.textContent = model.sub; }
  const cls = `sd-title-card on${model.fresh ? ' in' : ''}`;
  if (cls !== shown.cls) { shown.cls = cls; root.className = cls; }
  if (model.alpha !== shown.alpha) { shown.alpha = model.alpha; root.style.opacity = String(model.alpha); }
}

/** The page is going (a test's reset): the node leaves with it. */
export function destroySdTitleCard() {
  root?.remove?.();
  root = null; parts = null;
  shown = SHOWN();
}
