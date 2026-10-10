// @ts-check
// SEAT2a part four (2026-10-01, Mac: "Finish the seats"; "Or we could go ahead and do sieges"; "Continue"): THE SIEGE
// HUD AND THE RESULT CARD (bible/11-Multiplayer/Seats-Arc.md 19). The bar across the top - the seat, the holder against
// the challenger, the clock, each banner by name and mark, the Throne (SEAT2b part two (b): and the works - the
// Gatehouse, the Ram, the Walls) - each side's fighters up and down under it, and
// this fighter's own vitality and wave (a spectator's count instead); at the end, the result card over it, with the
// fighter's Honours once the service has answered its receipt.
//
// A READOUT, NOT A WINDOW (the gate's bar's law, ui/gateBossBar.js): no click but the card's Claim, one node made on the
// first update and UPDATED, NOT REBUILT - each line written only when it changes - hidden (never removed) when there is
// no battle. In every skin.
//
// `siegeHudModel` (net/siegeLink.js) is pure - the state, the battle and the clock in, the lines out; the pins read it.
//
// AUDIT-SEATS C1 (2026-10-01): AND A WAY OUT - the bar's own Leave (`onLeave`, a battle's or a Royal Tourney's: the world
// leaves whichever is entered), and the result card's Close, which dismisses the card by leaving the battle it ended.
// The two buttons and the card's Claim are the readout's only clicks.
//
// Not a DFU member. Ledger A (EVERY PALACE A SEAT's row).
import { siegeHudModel } from '../net/siegeLink.js';   // the lines (pure, beside the fold - net/siegeSession.js draws through it)
import { paintSwatch } from './heraldrySwatch.js';   // HERALDRY-SHOWN (Seats-Arc 8.1): each side's shield on the bar
export { siegeHudModel };

export const SIEGE_HUD_STYLE_ID = 'dagger-siege-hud-style';
export const SIEGE_HUD_CSS = `
.sg-hud { position: fixed; left: 50%; top: 58px; transform: translateX(-50%); width: 760px; max-width: 94vw; pointer-events: none;
  z-index: 30; font: 600 13px 'Cormorant', Georgia, serif; letter-spacing: 0.06em; color: #efe2c8; text-align: center;
  text-shadow: 0 0 3px #000, 0 0 8px rgba(0,0,0,0.9); white-space: pre; }
.sg-bar { position: relative; border: 1px solid rgba(220,190,120,0.55); background: rgba(10,8,6,0.55); padding: 3px 34px; }
.sg-arm { position: absolute; top: 4px; width: 22px; height: auto; filter: drop-shadow(0 0 2px #000); }
.sg-arm-defend { left: 6px; }
.sg-arm-attack { right: 6px; }
.sg-sides { margin-top: 3px; font-size: 12px; opacity: 0.9; }
.sg-works { margin-top: 2px; font-size: 12px; color: #e8c890; }
.sg-self { position: fixed; right: 24px; bottom: 120px; text-align: right; font-size: 13px; }
.sg-card { margin: 18px auto 0; width: 520px; max-width: 90vw; border: 1px solid rgba(240,210,140,0.8); background: rgba(14,10,6,0.85);
  padding: 10px 14px; pointer-events: auto; text-align: left; white-space: normal; }
.sg-card-title { font-size: 15px; letter-spacing: 0.12em; }
.sg-card button { margin-top: 8px; margin-left: 6px; float: right; font: inherit; cursor: pointer; }
.sg-leave { pointer-events: auto; margin-top: 3px; font: inherit; font-size: 12px; cursor: pointer; }
`;
/** AUDIT-SEATS C1: the readout's way out - the bar's button and the result card's. */
export const SIEGE_HUD_WORDS = Object.freeze({ leave: 'Leave', close: 'Close' });

/** The HUD on `doc` - `update(model)`, `hide()`, `destroy()`; `onClaim` the card's button; AUDIT-SEATS C1: `onLeave` the
 *  bar's Leave and the card's Close. */
export function createSiegeHud(doc, { onClaim = null, onLeave = null } = {}) {
  /** @type {any} */ let root = null;
  /** @type {Record<string, any>} */ const parts = {};
  const said = new Map();
  const put = (k, text) => { if (said.get(k) !== text) { said.set(k, text); parts[k].textContent = text; } };
  function make() {
    if (!doc.getElementById?.(SIEGE_HUD_STYLE_ID)) {
      const st = doc.createElement('style'); st.id = SIEGE_HUD_STYLE_ID; st.textContent = SIEGE_HUD_CSS; doc.head?.appendChild(st);
    }
    root = doc.createElement('div'); root.className = 'sg-hud';
    const bar = doc.createElement('div'); bar.className = 'sg-bar';
    parts.title = doc.createElement('div'); parts.banners = doc.createElement('div');
    parts.works = doc.createElement('div'); parts.works.className = 'sg-works'; parts.works.style.display = 'none';   // SEAT2b part two (b): the Gatehouse, the Ram, the Walls
    bar.appendChild(parts.title); bar.appendChild(parts.banners); bar.appendChild(parts.works);
    // HERALDRY-SHOWN: the defender's shield at the bar's left (named first), the challenger's at its right - hidden for none
    for (const side of ['defend', 'attack']) {
      const img = parts[`arm-${side}`] = doc.createElement('img');
      img.className = `sg-arm sg-arm-${side}`;
      bar.appendChild(img);
    }
    parts.sides = doc.createElement('div'); parts.sides.className = 'sg-sides';
    parts.self = doc.createElement('div'); parts.self.className = 'sg-self';
    parts.card = doc.createElement('div'); parts.card.className = 'sg-card'; parts.card.style.display = 'none';
    parts.cardTitle = doc.createElement('div'); parts.cardTitle.className = 'sg-card-title';
    parts.cardLine = doc.createElement('div'); parts.cardHonour = doc.createElement('div');
    parts.claim = doc.createElement('button'); parts.claim.textContent = 'Claim'; parts.claim.style.display = 'none';
    parts.claim.addEventListener?.('click', () => onClaim?.());
    // AUDIT-SEATS C1: the card's Close (the battle ended - dismissing it leaves), and the bar's Leave
    parts.close = doc.createElement('button'); parts.close.textContent = SIEGE_HUD_WORDS.close;
    parts.close.addEventListener?.('click', () => onLeave?.());
    parts.leave = doc.createElement('button'); parts.leave.className = 'sg-leave'; parts.leave.textContent = SIEGE_HUD_WORDS.leave;
    parts.leave.addEventListener?.('click', () => onLeave?.());
    for (const c of [parts.cardTitle, parts.cardLine, parts.cardHonour, parts.claim, parts.close]) parts.card.appendChild(c);
    for (const c of [bar, parts.leave, parts.sides, parts.self, parts.card]) root.appendChild(c);
    doc.body?.appendChild(root);
  }
  return {
    /** @param {ReturnType<typeof siegeHudModel>} m */
    update(m) {
      if (!root) make();
      root.style.display = '';
      put('title', m.bar[0]); put('banners', m.bar[1]); put('sides', m.sides); put('self', m.self.join('\n'));
      put('works', m.works ?? ''); parts.works.style.display = m.works ? '' : 'none';   // SEAT2b part two (b)
      paintSwatch(parts['arm-defend'], m.arms?.defend); paintSwatch(parts['arm-attack'], m.arms?.attack);   // HERALDRY-SHOWN: painted when it changes
      parts.card.style.display = m.card ? '' : 'none';
      parts.leave.style.display = m.card || !onLeave ? 'none' : '';   // AUDIT-SEATS C1: the card's Close stands for it once the battle has ended; INT9: a readout with nothing to leave (the open zone's) has none
      if (m.card) {
        put('cardTitle', m.card.title); put('cardLine', m.card.line); put('cardHonour', m.card.honour);
        parts.claim.style.display = m.card.claim ? '' : 'none';
      }
    },
    hide() { if (root) root.style.display = 'none'; },
    destroy() { root?.remove?.(); root = null; said.clear(); },
    get node() { return root; },
  };
}
