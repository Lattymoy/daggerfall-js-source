// @ts-check
// REVENANT-FATE (2026-10-02, Mac: "the choice popup should reuse the loot menu") - THE CHOICE, IN THE LOOT WINDOW. A
// beaten revenant opens the window a body opens (ui/enhanced/enhancedInventory.js mountEnhancedInventory, its `fate` remote
// side): the same frame (`.loot-win`), the same head (`.remotehead` - the revenant's name over what it is), the same
// rows (`.itemrow` - KILL a row of the very weapon it will drop, its tile and its rarity's colour; SPARE a row of its
// portrait and where it would stand), the same buttons (`.act`), the same window motion, and the Plus kit's dress for
// every one of them by the roles the loot window already plays (ui/enhanced/enhancedFrame.js FRAME_ROLES) - this file adds only
// what a body has no need of: its plea, its portrait's well, the confirmation, the keys.
//
// A row is picked first and confirmed second (the reward tray's two steps: a one-way choice is never one stray click);
// K and S pick, a second press or Enter confirms, Back steps back out of a pick and then closes - the foe kneels on.

export const FATE_STYLE_ID = 'revenant-fate-style';
export const FATE_FACE_BOX = 40;
/** The fate side's own geometry and words' colours - the kit paints the frame, the rows, the wells and the buttons. */
export const FATE_CSS = `
.pack-shell .loot-win.fate { width: 380px; max-height: min(700px, 92dvh); overflow-y: auto; }   /* AUDIT (2026-10-02): the loot window's phone cap (40dvh) squeezed the rows to nothing under the confirm */
.pack-shell .fatecol .fatelist { flex: 0 0 auto; min-height: auto; }
.pack-shell .fatecol .remotehead { flex-direction: column; align-items: center; gap: 2px; }
.pack-shell .fatecol .remotewho h3 { margin: 0; text-align: center; }
.pack-shell .fatecol .remotewho .meta { text-align: center; }
.pack-shell .fate-mood { display: inline-block; margin-right: 6px; padding: 0 5px; border-width: 1px; border-style: solid; font-size: 9px; line-height: 1.5; letter-spacing: 0.12em; text-transform: uppercase; color: #e9c46a; vertical-align: 1px; }
.pack-shell .fate-plea { margin: 8px 12px 4px; font-size: 13px; line-height: 1.4; font-style: italic; color: #e9e4d9; text-align: center; overflow-wrap: anywhere; }
.pack-shell .fate-body { margin: 6px 12px 4px; font-size: 12px; line-height: 1.35; color: #b8b0a0; text-align: center; }
.pack-shell .fatelist { display: flex; flex-direction: column; gap: 6px; padding: 6px 10px; }
.pack-shell .fate-opt { display: grid; grid-template-columns: ${FATE_FACE_BOX + 8}px 1fr auto; align-items: center; gap: 10px; text-align: left; min-height: ${FATE_FACE_BOX + 12}px; }
.pack-shell .fate-opt .itemname > span:first-child { font-size: 14px; }
.pack-shell .loot-win .fate-opt.itemrow .itemname > span:first-child { color: #e9e4d9; }   /* the verb's row, not the weapon's: its rarity is the trophy's own word (below) */
.pack-shell .loot-win .fate-opt .itemname small:not(.fate-verb) { text-transform: none; letter-spacing: 0.02em; color: #b8b0a0; }   /* a sentence, not a tag - and legible (the loot meta's dim lost to it) */
.pack-shell .fate-opt .fate-trophy { color: #e9e4d9; font-weight: 600; }
.pack-shell .fate-opt[data-rarity="magic"] .fate-trophy { color: #6f9ee8; }
.pack-shell .fate-opt[data-rarity="rare"] .fate-trophy { color: #e4c34f; }
.pack-shell .fate-opt[data-rarity="legendary"] .fate-trophy { color: #e07a2e; }
.pack-shell .fate-opt.is-kill .fate-verb { color: #e07060; }
.pack-shell .fate-opt.is-spare .fate-verb { color: #8fc7a0; }
.pack-shell .fate-opt .fate-verb { font-size: 10px; letter-spacing: 0.16em; text-transform: uppercase; display: block; }
.pack-shell .fate-opt small { display: block; font-size: 11px; color: #b8b0a0; white-space: normal; }
.pack-shell .fate-opt[disabled] { opacity: 0.55; cursor: not-allowed; }
.pack-shell .fate-opt .fate-key { font-size: 11px; color: #8b8578; padding: 0 4px; }
.pack-shell .fate-face { position: relative; box-sizing: border-box; width: ${FATE_FACE_BOX + 8}px; height: ${FATE_FACE_BOX + 8}px; border-width: 2px; border-style: solid; display: flex; align-items: center; justify-content: center; overflow: hidden; }
.pack-shell .fate-face img.fit { image-rendering: pixelated; }
.pack-shell .fate-face .fate-glyph { font-size: 22px; color: #8b8578; }
.pack-shell .fate-confirm { margin: 4px 10px 6px; padding: 8px 10px; border-width: 1px; border-style: solid; text-align: center; }
.pack-shell .fate-confirm p { margin: 0 0 8px; font-size: 12px; line-height: 1.35; color: #e9e4d9; }
.pack-shell .fate-confirm .acts { display: flex; justify-content: center; gap: 8px; }
.pack-shell .fate-confirm .act.warn { color: #ff8a78; }   /* the cost said in its word's colour - the kit paints the button */
.pack-shell .fate-keys { margin: 2px 10px 8px; font-size: 10px; letter-spacing: 0.08em; color: #8b8578; text-align: center; }
:root[data-plus-theme="stone"] .pack-shell .fate-body, :root[data-plus-theme="stone"] .pack-shell .loot-win .fate-opt .itemname small:not(.fate-verb) { color: #efe8d8; }
:root[data-plus-theme="stone"] .pack-shell .fatecol .remotewho .meta, :root[data-plus-theme="stone"] .pack-shell .fate-keys, :root[data-plus-theme="stone"] .pack-shell .fate-opt .fate-key { color: #d9d0bd; }   /* AUDIT (2026-10-02): legible on the light stone */
@media (max-width: 520px) { .pack-shell .loot-win.fate { width: auto; } }
`;
/** The fate side's styles, once per document. */
export function ensureFateStyle(doc = typeof document === 'undefined' ? null : document) {
  if (!doc || doc.getElementById?.(FATE_STYLE_ID)) return;
  const st = doc.createElement('style');
  st.id = FATE_STYLE_ID;
  st.textContent = FATE_CSS;
  (doc.head ?? doc.body)?.appendChild(st);
}

/**
 * THE FATE COLUMN: `fate` the model (systems/revenant/revenantFate.js fateModel), `picked` the row picked ('kill'|'spare'|null).
 * `kit`: `el(tag, cls, text)` (the window's own maker), `trophyTile(row, item)` (the window's item tile - the trophy
 * drawn exactly as a looted weapon is), `portrait(face, p)` (the revenant's picture into its well), `onPick(id)`,
 * `onChoose(id)`.
 */
export function fateColumn(fate, picked, { el, trophyTile = null, portrait = null, onPick, onChoose }) {
  const col = el('section', 'packcol packremote fatecol');
  const head = el('div', 'remotehead');
  const who = el('div', 'remotewho');
  who.append(el('h3', null, fate.name));
  const meta = el('p', 'meta', fate.sub ?? '');
  if (fate.mood) meta.insertBefore(el('span', 'fate-mood', fate.mood), meta.firstChild ?? null);
  who.append(meta);
  head.append(who);
  col.append(head);
  if (fate.plea?.speech) col.append(el('p', 'fate-plea', `“${fate.plea.speech}”`));
  else if (fate.plea?.body) col.append(el('p', 'fate-body', fate.plea.body));
  const list = el('div', 'remotelist fatelist');
  list.setAttribute?.('role', 'listbox');
  list.setAttribute?.('aria-label', `The fate of ${fate.name}`);
  for (const o of fate.options) {
    const row = el('button', `itemrow fate-opt is-${o.id}${picked === o.id ? ' on' : ''}`);
    row.setAttribute?.('role', 'option');
    row.setAttribute?.('aria-selected', picked === o.id ? 'true' : 'false');
    if (o.disabled) row.setAttribute?.('disabled', '');
    if (o.id === 'kill' && fate.trophy && trophyTile) trophyTile(row, fate.trophy);
    else {
      const face = el('span', 'fate-face');
      if (!(portrait && portrait(face, fate.portrait))) face.append(el('span', 'fate-glyph', o.id === 'kill' ? '☠' : '✦'));
      row.append(face);
    }
    const mid = el('span', 'itemname');
    mid.append(el('span', null, o.title));
    mid.append(el('small', 'fate-verb', o.label));
    if (o.id === 'kill' && fate.trophy?.name && o.detail.includes(fate.trophy.name)) {
      // the weapon's name in its rarity's colour, inside the sentence that says what the kill gives
      const at = o.detail.indexOf(fate.trophy.name);
      const line = el('small', null, o.detail.slice(0, at));
      line.append(el('span', 'fate-trophy', fate.trophy.name));
      line.append(el('span', null, o.detail.slice(at + fate.trophy.name.length)));
      mid.append(line);
    } else mid.append(el('small', null, o.detail));
    row.append(mid);
    row.append(el('span', 'fate-key', o.key));
    if (!(o.id === 'kill' && fate.trophy && trophyTile)) row.title = o.detail;   // the trophy's row has its item card on the hover
    row.onclick = () => { if (o.disabled) return; if (picked === o.id) onChoose(o.id); else onPick(o.id); };
    list.append(row);
  }
  col.append(list);
  const opt = fate.options.find((o) => o.id === picked && !o.disabled);
  if (opt) {
    const box = el('div', 'fate-confirm');
    box.append(el('p', null, opt.confirm));
    const acts = el('div', 'acts');
    const go = el('button', `act ${opt.tone === 'warn' ? 'warn' : 'primary'}`, opt.verb);
    go.onclick = () => onChoose(opt.id);
    const back = el('button', 'act', 'Back');
    back.onclick = () => onPick(null);
    acts.append(go, back);
    box.append(acts);
    col.append(box);
  }
  col.append(el('p', 'fate-keys', fate.options.filter((o) => !o.disabled).map((o) => `${o.key} ${o.label.toLowerCase()}`).concat('Esc leave it kneeling').join(' · ')));   // a key it cannot take is not offered
  return col;
}

/**
 * THE KEYS: K and S pick (a second press confirms), Enter confirms the pick, Back steps out of a pick - and, with
 * none, is not this side's (the window closes as ever). Answers whether the key was taken.
 */
export function fateKey(e, fate, picked, { onPick, onChoose }) {
  const k = String(e?.key ?? '').toLowerCase();
  const byKey = fate.options.find((o) => o.key.toLowerCase() === k && !o.disabled);
  if (byKey) { if (picked === byKey.id) onChoose(byKey.id); else onPick(byKey.id); return true; }
  // AUDIT (2026-10-02): Enter on a focused button is that button's (Back, the other row) - never the pick's confirmation
  if (k === 'enter' && picked && !e?.target?.closest?.('button')) { onChoose(picked); return true; }
  if (k === 'escape' && picked) { onPick(null); return true; }
  return false;
}
