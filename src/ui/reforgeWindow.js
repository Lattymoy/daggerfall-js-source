// @ts-check
// LOOT9 (2026-10-01, the Loot arc - bible/06-Systems/Loot-Arc.md section 11; Mac: "Do you wanna turn this into an arc
// and do all of the above?" - "spend it at the Mages Guild to reroll one affix"): THE REFORGE'S WINDOW.
//
// Two pages over the player's own pack: REFORGE - every piece the Reforge takes (a Magic or Rare piece, an Exalted
// Legendary), a row each in its tier's frame; a row pressed shows the piece whole beside the list, and each line the
// Reforge may roll again carries its own press with the price on it (or why not, in a word or two: "Need 2 more
// shards", "Not identified") - and SALVAGE - every laddered piece that will break, what it breaks into, and a press
// that asks before it breaks it ("Break it" / "Keep"). The purse (the Welkynd Shards a press may spend, the gold) and
// the last word of a press stand in the header.
//
// THE BROKER'S SHAPE (ui/brokerWindow.js): a lazy chunk the door (ui/reforgeDoor.js) mounts in its own host -
// `mountReforgeWindow(host, deps)` answers `{ repaint, unmount }` - its rows the Broker's own classes, so both skins
// dress it as they dress his (the classic skin lays the Broker's own sheet, `brokerSkinCss`). Everything the window does
// to the world is handed in: the pack, the payer, the reforge and the salvage (systems/reforge.js, which the host
// calls) - this file draws and asks, and never touches a pack.
import { rarityAttr, affixLine, reforgeableLines, RARITIES, tierLabel, imprintLine, powerLine, powerOf, legendaryById, curseLine, honeableLines } from '../systems/lootRarity.js';
import { cursedKnown, liftPrice, liftRefusal } from '../systems/lootCurse.js';   // LOOT16: the temple's lifting
import { SCRY_FAMILIES, SCRY_FAMILY_WORDS, SCRY_PRICE, familyPlaces, scryRefusal } from '../systems/lootScry.js';   // LOOT19: scrying
import { foundAmong, hasSocket, socketsOf, emptySockets, gemLine, affixLabel, ALL_GEM_IDS, GEM_NAMES, SOCKET_EMPTY } from '../systems/lootRarity.js';   // LOOT20: the sockets; GEM1: a list of them, every grade of gem
import { gemsHeld, setGemRefusal, unsetGemRefusal, extractGemRefusal, extractPrice } from '../systems/reforge.js';   // GEM1: and the extraction
import { codexRows, codexSets, codexCount, codexGilded, imprintChoices, imprintRefusal, IMPRINT_PRICE } from '../systems/lootCodex.js';   // LOOT10: the codex's page and the imprint's - GILDED1: and the Gilded rung's rows
import { gildedById } from '../systems/gilded.js';
import { setById } from '../systems/sigilSets.js';
import { itemIsIdentified } from '../systems/tradeModes.js';
import { reforgePrice, reforgeRefusal, salvageShards, salvageRefusal, shardsHeld, shardsText, honePrice, honeRefusal } from '../systems/reforge.js';   // LOOT17: and the hone
import { inventoryItemImage } from '../systems/itemTemplates.js';
import { requestFittedIcon, fittedImg } from './textureCanvas.js';
import { SLOT_BOX, screenDpr } from './iconFit.js';
import { closeOnOutsideTap } from './enhancedOverlays.js';
import { overlayAction } from './input.js';
import { injectEnhancedStyle, injectEnhancedFonts } from './enhancedStyle.js';
import { brokerSkinCss, BROKER_SKIN_STYLE_ID } from './brokerWindow.js';
import { techniqueDetail } from '../systems/lootRarity.js';   // AUDIT TECH1: a technique line's "what a press does", as the card says it
import { REFORGE_CSS } from './enhancedPlusStyle.js';   // AUDIT LOOT F6: the window's own rules, beside the Broker's sheet
import { isEnhancedPlus } from '../systems/uiSkin.js';

/** @param {string} tag @param {string|null} [cls] @param {string|null} [text] */
const el = (tag, cls = null, text = null) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
};

/** The window's words. */
export const REFORGE_TITLE = 'The Reforge';
export const REFORGE_SUB = 'Welkynd Shards and gold roll one line again or hone it up its band · a piece salvaged breaks into shards';   // LOOT17: the hone
export const REFORGE_PAGES = Object.freeze({ reforge: 'Reforge', salvage: 'Salvage', imprint: 'Imprint', codex: 'Codex', scry: 'Scry', sockets: 'Sockets', lift: 'Lift Curse' });   // LOOT10: the imprint and the codex; LOOT16: the temple's lifting; LOOT19: scrying; LOOT20: sockets
/** The pages the guild's window shows when its host names none - never the temple's (LOOT16); LOOT19: and its scryers'. */
export const REFORGE_GUILD_PAGES = Object.freeze(['reforge', 'salvage', 'imprint', 'codex', 'scry', 'sockets']);   // LOOT20: and its sockets
/** LOOT20 (the Loot arc II, bible/06-Systems/Loot-II-Arc.md section 12): THE SOCKETS' PAGE - every piece of the pack with
 *  a socket; picked, its card - an empty socket offers each gem the pack holds, a set one its unsetting, asked first.
 *  GEM1 (bible/06-Systems/Gem-Sockets.md section 3): a row a socket of the piece, and a set one's EXTRACTION beside its
 *  unsetting - the gem out whole, for gold by its grade; setting is free (the pack's card sets too). */
export const SOCKETS_NONE = 'Nothing in your pack carries a socket - a weapon, a Rare or a Legendary found on a body or in a pile may.';
export const GEMS_NONE = 'No gem in your pack to set - a Ruby, an Emerald, a Sapphire, a Diamond, Jade, Turquoise, Malachite or Amber, of any grade.';
export const GEM_SET = (name, gem) => `Set: the ${GEM_NAMES[gem] ?? 'gem'} in ${name}.`;
export const UNSET_ASK = (gem) => `Unset the ${GEM_NAMES[gem] ?? 'gem'}? It shatters.`;
export const GEM_SHATTERED = (name, gem) => `The ${GEM_NAMES[gem] ?? 'gem'} in ${name} shatters; the socket is empty.`;
export const GEM_EXTRACTED = (name, gem, price) => `Extracted: the ${GEM_NAMES[gem] ?? 'gem'} out of ${name}, whole, for ${price} gold.`;
export const SOCKETS_NOTE = 'Setting a gem is free - the gem is the price. Unset, it shatters; the guild extracts it whole for gold by its grade.';
/** LOOT19 (the Loot arc II, bible/06-Systems/Loot-II-Arc.md section 11): THE SCRYERS' PAGE - a row a family, its dungeon
 *  kinds, the price, and a press that names the nearest of its haunts in the region not yet on the map (systems/
 *  lootScry.js); asked first of the region, so a family with nothing hidden says so before a coin is taken. */
export const SCRIED = (name, family) => `Scried: ${name} - a haunt of ${String(SCRY_FAMILY_WORDS[family] ?? 'them').toLowerCase()}, on your map now.`;
export const SCRY_FOR_KIN = 'Scry for its kin';
/** LOOT16 (the Loot arc II, bible/06-Systems/Loot-II-Arc.md section 8): THE TEMPLE'S PAGE - the window on its one page,
 *  opened by a temple's Cure Disease priest (scenes/worldModes.js openLift): every known cursed piece of the pack, its
 *  drawback named, its price, and a press that lifts it (systems/lootCurse.js liftCurse). */
export const LIFT_TITLE = 'Lift a Curse';
export const LIFT_SUB = 'The temple lifts a curse for gold - the drawback gone, the line it came with kept';
export const LIFT_NONE = 'Nothing cursed in your pack that the temple can see - a curse is known once the piece is identified.';
export const LIFTED = (name) => `Lifted: ${name} - the curse is gone, and its line stays.`;
/** Why a lifting is refused, by the law's word (lootCurse.js liftRefusal). */
export const LIFT_REFUSALS = Object.freeze({
  off: 'Loot rarity is off', not: 'No curse on it', unknown: 'Not yet identified - the guild identifies it first',
  worn: 'Take it off first', gold: 'Not enough gold', gone: 'No longer in your pack',
  damned: 'Damned - no temple can lift this curse',   // TRUE-CURSE
});
export const CODEX_TITLE = 'The Codex';
export const CODEX_SUB = 'Every Gilded, Legendary and Aetheric piece you have found - and where the rest are said to be';
/** LOOT10: the imprint's words. */
export const IMPRINTED = (name, rec, power) => `Imprinted: ${name} - ${power} (of ${rec}).`;
export const IMPRINT_NONE = 'Your codex holds no Legendary of its kind yet - find one, and its power may be taken.';
export const IMPRINT_ONCE = 'A Rare takes one power, once.';
/** The purse: the shards a press may spend, and the gold. */
export const reforgePurseText = (shards, gold) => `${shardsText(shards)} · ${Math.max(0, gold | 0)} gold`;
/** A price, said: "4 Welkynd Shards and 400 gold". */
export const reforgePriceText = (p) => (p ? `${shardsText(p.shards)} and ${p.gold} gold` : '');
/** The whole reason a press is refused (its title), by the law's word. */
export const REFORGE_REFUSALS = Object.freeze({
  off: 'Loot rarity is off', not: 'Nothing the Reforge can roll', unknown: 'Not yet identified - the guild identifies it first',
  worn: 'Take it off first', line: 'Only the line it was reforged on', shards: 'Not enough Welkynd Shards', gold: 'Not enough gold',
  top: 'At the top of its band',   // LOOT17
  imprinted: 'It has taken a power already', unfound: 'Not a power your codex holds for it',
  none: 'Nothing of theirs is hidden in this region', nowhere: 'No map to scry here', family: 'No such kin',   // LOOT19
  set: 'A gem is set in it - unset it first', nogem: 'None of that gem in your pack', empty: 'No gem in it',   // LOOT20
  gone: 'No longer in your pack', aetheric: 'An Aetheric piece is the Broker\'s to dismantle', gilded: 'A Gilded piece will not break', artifact: 'An artifact will not break',
  quest: 'A quest\'s item will not break', bound: 'Bound - it will not break', locked: 'Locked - unlock it first',
  gems: 'A gem is set in it - extract or unset it first',   // AUDIT GEM: salvage never breaks a set gem
});
/** A line's press word - "Reforge" (the imprint's "Imprint" - AUDIT LOOT F6: its presses said Reforge), or why not in a
 *  word or two that fits the button. */
export function reforgeLabel(why, price, have, verb = 'Reforge') {
  if (!why) return verb;
  if (why === 'shards') return `Need ${price.shards - have.shards} more shards`;
  if (why === 'gold') return `Need ${price.gold - have.gold} more gold`;
  if (why === 'unknown') return 'Not identified';
  if (why === 'worn') return 'Worn';
  if (why === 'imprinted') return 'Imprinted';
  if (why === 'none') return 'None hidden';   // LOOT19
  if (why === 'nowhere') return 'No map here';
  if (why === 'damned') return 'Damned';   // TRUE-CURSE
  return 'Cannot';
}
/** The last word of a press. */
export const REFORGED = (name, line) => `Reforged: ${name} - ${line}.`;
export const HONED = (name, line) => `Honed: ${name} - ${line}.`;   // LOOT17
/** LOOT17: the card's word on the hone's price. */
export const HONE_NOTE = (price) => `A hone costs ${reforgePriceText(price)} - it doubles with every hone the piece takes, and a line at the top of its band takes none.`;
export const SALVAGED = (name, n) => `Salvaged: ${name}, for ${shardsText(n)}.`;
export const BREAK_ASK = (name, n) => `Break ${name} for ${shardsText(n)}? It is gone for good.`;
/** LOOT18 (the Loot arc II, bible/06-Systems/Loot-II-Arc.md section 10): SALVAGE EVERY MAGIC - one press, asked first. */
export const EVERY_MAGIC = 'every-magic';
export const EVERY_MAGIC_LABEL = (n) => `Salvage every Magic (${n})`;
export const EVERY_MAGIC_ASK = (n, shards) => `Break all ${n} Magic pieces for ${shardsText(shards)}? They are gone for good.`;
export const SALVAGED_EVERY = (n, shards) => `Salvaged ${n} Magic piece${n === 1 ? '' : 's'}, for ${shardsText(shards)}.`;

/** An item's classic picture fitted to the row's box, or null while it loads (`onReady` repaints when it lands). */
function classicPicture(item, wearer, onReady) {
  const img = item ? inventoryItemImage(item, wearer ?? undefined) : null;
  return img?.archive ? requestFittedIcon(img.archive, img.record, { box: SLOT_BOX.broker, dpr: screenDpr(), dye: img.dye, dyeTarget: img.dyeTarget, onReady }) : null;
}

/** The classic skin wears the Broker's own sheet (its rows are his classes) - and, AUDIT LOOT F6, the window's own rules
 *  beside it, under their own id (the Broker's window may have laid his first). The Plus sheet carries both. */
export const REFORGE_SKIN_STYLE_ID = 'reforge-skin-style';
function injectSkinStyle(doc = document) {
  if (isEnhancedPlus()) return;
  const has = (id) => !!doc.getElementById?.(id) || [...(doc.head?.children ?? [])].some((c) => c.id === id);
  /** @type {Array<[string, () => string]>} */
  const sheets = [[BROKER_SKIN_STYLE_ID, brokerSkinCss], [REFORGE_SKIN_STYLE_ID, () => REFORGE_CSS]];
  for (const [id, css] of sheets) {
    if (has(id)) continue;
    const st = doc.createElement('style');
    st.id = id;
    st.textContent = css();
    (doc.head ?? doc.body).append(st);
  }
}

/**
 * Mount the window in the door's host.
 * @param {HTMLElement} host
 * @param {{
 *   items: () => any[], payer: () => any, gold: () => number,
 *   reforge: (item: any, line: number) => { ok: boolean, reason?: string|null, line?: any },
 *   salvage: (item: any) => { ok: boolean, reason?: string|null, shards?: number },
 *   picture?: ((item: any) => any) | null, wearer?: any, nameOf?: (item: any) => string, onExit?: (() => void) | null,
 *   page?: 'reforge'|'salvage'|'imprint'|'codex'|'lift'|'scry'|'sockets', pages?: string[] | null,
 *   imprint?: ((item: any, recordId: string) => { ok: boolean, reason?: string|null }) | null,
 *   lift?: ((item: any) => { ok: boolean, reason?: string|null }) | null,
 *   hone?: ((item: any, line: number) => { ok: boolean, reason?: string|null }) | null,
 *   scry?: ((family: string) => { ok: boolean, reason?: string|null, place?: any }) | null,
 *   scryWhere?: (() => any) | null,
 *   setGem?: ((item: any, gem: string, at?: number|null) => { ok: boolean, reason?: string|null }) | null,
 *   unsetGem?: ((item: any, at?: number|null) => { ok: boolean, reason?: string|null }) | null,
 *   extractGem?: ((item: any, at?: number|null) => { ok: boolean, reason?: string|null, price?: number }) | null,
 * }} deps
 *   LOOT10: `pages` the pages this window shows (the guild's all four; the pack's Codex its one), `imprint` the host's
 *   imprint (systems/lootCodex.js imprintPiece). LOOT16: the temple's `['lift']`, and its `lift` (systems/lootCurse.js
 *   liftCurse). LOOT17: `hone` the host's hone (systems/reforge.js honePiece). LOOT19: `scry` the host's scrying
 *   (systems/lootScry.js scryPlace) and `scryWhere` its region (scenes/world.js). LOOT20: `setGem` and `unsetGem` the
 *   host's (systems/reforge.js setGemPiece, unsetGemPiece); GEM1: `extractGem` too (extractGemPiece), and each
 *   takes the socket's index.
 * @returns {{ repaint: () => void, unmount: () => void }}
 */
export function mountReforgeWindow(host, deps) {
  injectEnhancedStyle();
  injectEnhancedFonts();
  injectSkinStyle();
  const nameOf = deps.nameOf ?? ((it) => String(it?.name ?? ''));
  const exit = () => deps.onExit?.();
  const pages = (deps.pages ?? REFORGE_GUILD_PAGES).filter((id) => REFORGE_PAGES[id]);   // LOOT16: the guild's four unless the host names its own
  let page = pages.includes(deps.page ?? '') ? deps.page : pages[0] ?? 'reforge';
  const codexOnly = pages.length === 1 && pages[0] === 'codex';
  const liftOnly = pages.length === 1 && pages[0] === 'lift';   // LOOT16: the temple's
  const titleText = codexOnly ? CODEX_TITLE : liftOnly ? LIFT_TITLE : REFORGE_TITLE;
  let picked = null;
  let asking = null;
  let askingAt = null;   // GEM1: which of the asked piece's sockets the Shatter press waits on
  /** The last press's word, and whether it was done (a refusal is read in the refusal's colour). */
  let note = null;
  const shell = el('div', 'broker-shell reforge-shell');
  shell.id = 'reforge';
  shell.setAttribute('role', 'dialog');
  shell.setAttribute('aria-label', titleText);
  const win = el('div', 'broker-win');
  shell.append(win);
  const head = el('header', 'broker-head');
  const title = el('div', 'broker-title');
  const sub = el('p', 'broker-sub', codexOnly ? CODEX_SUB : liftOnly ? LIFT_SUB : REFORGE_SUB);
  const noteLine = el('p', 'broker-note');
  noteLine.setAttribute('aria-live', 'polite');
  title.append(el('h2', null, titleText), sub, noteLine);
  const purse = el('span', 'broker-purse');
  const close = el('button', 'act broker-close', 'Close');
  close.setAttribute('type', 'button');
  close.onclick = (e) => { e.stopPropagation(); exit(); };
  head.append(title, purse, close);
  const tabs = el('nav', 'reforge-tabs');
  tabs.setAttribute('role', 'tablist');
  const tabOf = {};
  if (pages.length < 2) tabs.setAttribute('hidden', '');
  for (const id of pages) {
    const t = el('button', 'act reforge-tab', REFORGE_PAGES[id]);
    t.setAttribute('type', 'button');
    t.setAttribute('role', 'tab');
    t.dataset.page = id;
    t.onclick = (e) => { e.stopPropagation(); page = /** @type {any} */ (id); picked = null; dropAsk(); render(); };
    tabOf[id] = t;
    tabs.append(t);
  }
  const body = el('div', 'broker-body');
  const list = el('ul', 'broker-offers');
  list.setAttribute('role', 'list');
  body.append(list);
  win.append(head, tabs, body);
  let card = null;
  let alive = true;
  const pressable = (row, pick) => {
    row.setAttribute('role', 'button');
    row.setAttribute('tabindex', '0');
    row.onclick = pick;
    row.onkeydown = (e) => { if (e.target === row && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault?.(); pick(); } };
  };
  const frameOf = (item, picture) => {
    const r = rarityAttr(item);
    const frame = el('span', 'broker-frame');
    if (r) frame.dataset.rarity = r;
    const tile = el('span', 'tile');
    const pic = picture?.(item) ?? null;
    if (pic && typeof pic === 'object') tile.append(fittedImg(pic));
    else if (pic) { const img = el('img'); img.setAttribute('src', pic); img.setAttribute('alt', ''); tile.append(img); } else tile.textContent = nameOf(item).split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
    frame.append(tile);
    return frame;
  };
  const say = (ok, text) => { note = { ok, text }; };
  /** AUDIT LOOT II B4: a pending ask let go - another page, another piece - takes its question with it ("Break all 3 Magic
   *  pieces...?" stood over the next page); any other word stays. */
  const dropAsk = () => { if (asking) note = null; asking = null; };
  const drawNote = () => {
    noteLine.textContent = note ? note.text : '';
    noteLine.className = `broker-note${note?.ok ? ' ok' : ''}`;
    if (!note) noteLine.setAttribute('hidden', ''); else noteLine.removeAttribute?.('hidden');
  };
  const render = () => {
    if (!alive) return;
    const items = deps.items() ?? [];
    const payer = deps.payer();
    const have = { shards: shardsHeld(items), gold: deps.gold() };
    const picture = deps.picture !== undefined ? deps.picture : (it) => classicPicture(it, deps.wearer, () => render());
    purse.textContent = reforgePurseText(have.shards, have.gold);
    drawNote();
    for (const [id, t] of Object.entries(tabOf)) { t.setAttribute('aria-selected', id === page ? 'true' : 'false'); t.classList.toggle('on', id === page); }   // AUDIT LOOT F6: the chosen page the kit's brass
    for (const c of [...list.children]) c.remove();
    card?.remove();
    card = null;
    if (page === 'codex') { renderCodex(); return; }   // LOOT10
    if (page === 'imprint') { renderImprint(items, payer, have, picture); return; }
    if (page === 'lift') { renderLift(items, payer, have, picture); return; }   // LOOT16
    if (page === 'scry') { renderScry(payer, have); return; }   // LOOT19
    if (page === 'sockets') { renderSockets(items, payer, have, picture); return; }   // LOOT20
    const rows = page === 'reforge'
      ? items.filter((it) => reforgePrice(it) && reforgeableLines(it).length)
      : items.filter((it) => salvageShards(it) > 0 && !['aetheric', 'gilded', 'artifact', 'quest', 'off'].includes(salvageRefusal(it) ?? ''));
    if (!rows.includes(picked)) picked = page === 'reforge' ? rows[0] ?? null : null;
    if (page === 'salvage') everyMagic(rows);   // LOOT18
    if (!rows.length) {
      const empty = el('li', 'broker-insignia-head reforge-empty', page === 'reforge' ? 'Nothing in your pack the Reforge takes - a Magic or Rare piece, or an Exalted Legendary.' : 'Nothing in your pack that will break - a Magic piece or better the ladder graded.');
      empty.setAttribute('role', 'presentation');
      list.append(empty);
    }
    for (const it of rows) {
      const r = rarityAttr(it);
      const row = el('li', `broker-offer${it === picked ? ' on' : ''}`);
      row.setAttribute('aria-pressed', it === picked ? 'true' : 'false');
      if (r) row.dataset.rarity = r;
      const text = el('div', 'broker-offer-body');
      text.append(el('span', 'broker-name', nameOf(it)), el('span', 'broker-set', tierLabel(it) || RARITIES[r ?? 'common']?.label || ''));
      if (page === 'reforge') {
        row.append(frameOf(it, picture), text, el('span', 'broker-price', reforgePriceText(reforgePrice(it))));
        pressable(row, () => { picked = it; render(); });
      } else {
        const n = salvageShards(it);
        const why = salvageRefusal(it);
        const btn = el('button', 'act broker-buy', why ? (why === 'worn' ? 'Worn' : why === 'locked' ? 'Locked' : why === 'gems' ? 'Gem set' : 'Cannot') : asking === it ? 'Break it' : 'Salvage');
        btn.setAttribute('type', 'button');
        btn.setAttribute('aria-label', why ? `${nameOf(it)}: ${REFORGE_REFUSALS[why] ?? ''}` : asking === it ? BREAK_ASK(nameOf(it), n) : `Salvage ${nameOf(it)} for ${shardsText(n)}`);
        if (why) { btn.setAttribute('disabled', ''); btn.setAttribute('title', REFORGE_REFUSALS[why] ?? ''); }
        btn.onclick = (e) => {
          e.stopPropagation();
          if (why) return;
          if (asking !== it) { asking = it; say(false, BREAK_ASK(nameOf(it), n)); render(); return; }
          asking = null;
          const done = deps.salvage(it);
          if (done?.ok) say(true, SALVAGED(nameOf(it), done.shards ?? n)); else say(false, REFORGE_REFUSALS[done?.reason ?? ''] ?? 'It will not break.');
          render();
        };
        row.append(frameOf(it, picture), text, el('span', 'broker-price', shardsText(n)), btn);
        if (asking === it) {
          const keep = el('button', 'act broker-buy reforge-keep', 'Keep');
          keep.setAttribute('type', 'button');
          keep.onclick = (e) => { e.stopPropagation(); asking = null; note = null; render(); };
          row.append(keep);
        }
      }
      list.append(row);
    }
    if (page !== 'reforge' || !picked) return;
    // THE PIECE, WHOLE: its tier's lines, and on each line the Reforge may roll its own press
    const it = picked;
    card = el('div', 'card broker-card reforge-card');
    const r = rarityAttr(it);
    if (r) card.dataset.rarity = r;
    card.append(el('h3', null, nameOf(it)));
    const may = reforgeableLines(it);
    const price = reforgePrice(it);
    const hone = honeableLines(it);   // LOOT17
    const hp = honePrice(it);
    const ul = el('ul', 'rarity');
    ul.append(el('li', null, tierLabel(it)));
    if (!itemIsIdentified(it)) {   // its lines are not known yet - the guild's Identify first, and the card says nothing of them
      ul.append(el('li', null, 'Unidentified'));
      card.append(ul, el('p', 'boundline', REFORGE_REFUSALS.unknown));
      body.append(card);
      return;
    }
    (it.affixes ?? []).forEach((_, i) => {
      const li = el('li', 'reforge-line', affixLine(it, i));
      li.dataset.line = String(i);
      const told = techniqueDetail(it.affixes[i]);   // AUDIT TECH1: a technique's line says what a press does - read before it is reforged or honed, as the card says it
      if (told) li.append(el('span', 'reforge-detail', told));
      if (may.includes(i)) {
        const why = reforgeRefusal(it, i, payer);
        const btn = el('button', 'act broker-buy reforge-press', reforgeLabel(why, price, have));
        btn.setAttribute('type', 'button');
        btn.setAttribute('aria-label', why ? `${affixLine(it, i)}: ${REFORGE_REFUSALS[why] ?? ''}` : `Reforge ${affixLine(it, i)} for ${reforgePriceText(price)}`);
        if (why) { btn.setAttribute('disabled', ''); btn.setAttribute('title', REFORGE_REFUSALS[why] ?? ''); }
        btn.onclick = (e) => {
          e.stopPropagation();
          if (why) return;
          const done = deps.reforge(it, i);
          if (done?.ok) say(true, REFORGED(nameOf(it), affixLine(it, i))); else say(false, REFORGE_REFUSALS[done?.reason ?? ''] ?? 'The Reforge will not take that.');
          render();
        };
        li.append(btn);
      }
      if (hp && hone.includes(i)) {   // LOOT17: the hone, beside the line's Reforge - a line under its band's top
        const why = honeRefusal(it, i, payer);
        const hb = el('button', 'act broker-buy hone-press', reforgeLabel(why, hp, have, 'Hone'));
        hb.setAttribute('type', 'button');
        hb.setAttribute('aria-label', why ? `${affixLine(it, i)}: ${REFORGE_REFUSALS[why] ?? ''}` : `Hone ${affixLine(it, i)} for ${reforgePriceText(hp)}`);
        if (why) { hb.setAttribute('disabled', ''); hb.setAttribute('title', REFORGE_REFUSALS[why] ?? ''); }
        hb.onclick = (e) => {
          e.stopPropagation();
          if (why) return;
          const done = deps.hone?.(it, i) ?? { ok: false, reason: 'not' };
          if (done.ok) say(true, HONED(nameOf(it), affixLine(it, i))); else say(false, REFORGE_REFUSALS[done.reason ?? ''] ?? 'The Reforge will not take that.');
          render();
        };
        li.append(hb);
      }
      ul.append(li);
    });
    card.append(ul);
    if (Number.isInteger(it.reforged)) card.append(el('p', 'boundline', 'Reforged once - only that line may be rolled again.'));
    else if (price) card.append(el('p', 'boundline', `A reforge costs ${reforgePriceText(price)}. Once a line is reforged, only it may be again.`));
    if (hp && hone.length) card.append(el('p', 'boundline hone-note', HONE_NOTE(hp)));   // LOOT17
    body.append(card);
  };
  /** LOOT18: SALVAGE EVERY MAGIC, at the head of the Salvage page - every Magic piece the page could break now (not worn,
   *  locked or bound), in one press that asks first ("Break them all" / "Keep"), through the host's own salvage a piece
   *  at a time. Two at the least: one is its own row's press. */
  function everyMagic(rows) {
    const magics = rows.filter((it) => it.rarity === 'magic' && !salvageRefusal(it));
    if (magics.length < 2) { if (asking === EVERY_MAGIC) { dropAsk(); drawNote(); } return; }   // the ask lapsed under it (B4: its question drawn away now - the line was drawn before the page)
    const shards = magics.reduce((n, it) => n + salvageShards(it), 0);
    const head = el('li', 'broker-insignia-head salvage-every');
    head.setAttribute('role', 'presentation');
    const btn = el('button', 'act broker-buy every-magic', asking === EVERY_MAGIC ? 'Break them all' : EVERY_MAGIC_LABEL(magics.length));
    btn.setAttribute('type', 'button');
    btn.setAttribute('aria-label', asking === EVERY_MAGIC ? EVERY_MAGIC_ASK(magics.length, shards) : `${EVERY_MAGIC_LABEL(magics.length)} for ${shardsText(shards)}`);
    btn.onclick = (e) => {
      e.stopPropagation();
      if (asking !== EVERY_MAGIC) { asking = EVERY_MAGIC; say(false, EVERY_MAGIC_ASK(magics.length, shards)); render(); return; }
      asking = null;
      let n = 0, got = 0;
      for (const it of magics) { const done = deps.salvage(it); if (done?.ok) { n++; got += done.shards ?? salvageShards(it); } }
      say(n > 0, n ? SALVAGED_EVERY(n, got) : 'Nothing would break.');
      render();
    };
    head.append(btn);
    if (asking === EVERY_MAGIC) {
      const keep = el('button', 'act broker-buy reforge-keep', 'Keep');
      keep.setAttribute('type', 'button');
      keep.onclick = (e) => { e.stopPropagation(); asking = null; note = null; render(); };
      head.append(keep);
    }
    list.append(head);
  }
  /** LOOT10: THE CODEX - every Legendary record, found and not, then the Aetheric sets; a row pressed shows it whole.
   *  GILDED1: the Gilded rung's records first, over them all, as the rung stands. */
  let pickedRec = null;
  const head2 = (text) => { const h = el('li', 'broker-insignia-head codex-head', text); h.setAttribute('role', 'presentation'); return h; };
  function renderCodex() {
    const n = codexCount();
    purse.textContent = `${n.gilded} of ${n.gildeds} Gilded · ${n.legendary} of ${n.legendaries} Legendaries · ${n.aetheric} of ${n.aetherics} Aetheric`;
    const gold = codexGilded();
    list.append(head2(`Gilded - ${n.gilded} of ${n.gildeds} found`));
    for (const g of gold) {
      const row = el('li', `broker-offer codex-gilded${g.found ? ' found' : ''}${pickedRec === g.id ? ' on' : ''}`);
      row.dataset.record = g.id;
      if (g.found) row.dataset.rarity = 'gilded';
      const text = el('div', 'broker-offer-body');
      text.append(el('span', 'broker-name', g.found ? g.name : 'Unfound'), el('span', 'broker-set', g.found ? `${g.group} · found on day ${g.day}` : `${g.group} · ${g.hint}`));
      row.append(text);
      pressable(row, () => { pickedRec = g.id; render(); });
      list.append(row);
    }
    list.append(head2(`Legendaries - ${n.legendary} of ${n.legendaries} found`));
    const rows = codexRows();
    for (const r of rows) {
      const row = el('li', `broker-offer codex-row${r.found ? ' found' : ''}${pickedRec === r.id ? ' on' : ''}`);
      row.dataset.record = r.id;
      if (r.found) row.dataset.rarity = 'legendary';
      const text = el('div', 'broker-offer-body');
      text.append(el('span', 'broker-name', r.found ? r.name : 'Unfound'), el('span', 'broker-set', r.found ? `${r.group} · found on day ${r.day}` : `${r.group} · ${r.hint}`));
      row.append(text);
      pressable(row, () => { pickedRec = r.id; render(); });
      list.append(row);
    }
    for (const s of codexSets()) {
      const got = s.pieces.filter((p) => p.found).length;
      list.append(head2(`${setById(s.set)?.name ?? s.set} - ${got} of ${s.pieces.length}`));
      const row = el('li', 'broker-offer codex-set');
      row.dataset.set = s.set;
      const text = el('div', 'broker-offer-body');
      text.append(el('span', 'broker-set', s.pieces.map((p) => (p.found ? p.name : '?')).join(' · ')));
      row.append(text);
      list.append(row);
    }
    const r = rows.find((x) => x.id === pickedRec) ?? gold.find((x) => x.id === pickedRec);
    if (!r) return;
    card = el('div', 'card broker-card codex-card');
    if (r.found) card.dataset.rarity = r.kind;
    card.append(el('h3', null, r.found ? r.name : 'Unfound'));
    const ul = el('ul', 'rarity');
    ul.append(el('li', null, `${RARITIES[r.kind]?.label ?? 'Legendary'} · ${r.group}`));
    if (r.found) {
      const rec = r.kind === 'gilded' ? gildedById(r.id) : legendaryById(r.id);
      for (const a of rec?.affixes ?? []) { const line = affixLine({ rarity: r.kind, affixes: [a] }, 0); if (line) ul.append(el('li', null, line)); }
      if (r.power) ul.append(el('li', null, powerLine(r.power)));
      if (r.lore) ul.append(el('li', null, r.lore));
      ul.append(el('li', null, `First found on day ${r.day}`));
    } else ul.append(el('li', null, 'Not yet found'));
    card.append(ul, el('p', 'boundline', r.hint));
    const kin = !r.found && r.kind === 'legendary' ? foundAmong(r.id) : null;   // LOOT19: an unfound record's family, to the scryers' page (GILDED1: a Legendary's - the Hour is scried by no one)
    if (kin && pages.includes('scry') && SCRY_FAMILIES.includes(kin)) {
      const go = el('button', 'act broker-buy scry-kin', SCRY_FOR_KIN);
      go.setAttribute('type', 'button');
      go.onclick = (e) => { e.stopPropagation(); page = 'scry'; scryKin = kin; note = null; render(); };
      card.append(go);
    }
    body.append(card);
  }
  /** LOOT10: THE IMPRINT - a Rare of the pack takes the power of a found Legendary of its group. */
  function renderImprint(items, payer, have, picture) {
    const rows = items.filter((it) => it?.rarity === 'rare');
    if (!rows.includes(picked)) picked = rows[0] ?? null;
    if (!rows.length) list.append(head2('Nothing in your pack to imprint - a Rare piece takes a Legendary\'s power.'));
    for (const it of rows) {
      const row = el('li', `broker-offer${it === picked ? ' on' : ''}`);
      row.dataset.rarity = 'rare';
      const text = el('div', 'broker-offer-body');
      text.append(el('span', 'broker-name', nameOf(it)), el('span', 'broker-set', imprintLine(it) ? 'Imprinted' : tierLabel(it)));
      row.append(frameOf(it, picture), text, el('span', 'broker-price', reforgePriceText(IMPRINT_PRICE)));
      pressable(row, () => { picked = it; render(); });
      list.append(row);
    }
    if (!picked) return;
    const it = picked;
    card = el('div', 'card broker-card imprint-card');
    card.dataset.rarity = 'rare';
    card.append(el('h3', null, nameOf(it)));
    const now = imprintLine(it);
    if (now) { card.append(el('p', null, now), el('p', 'boundline', IMPRINT_ONCE)); body.append(card); return; }
    const choices = imprintChoices(it);
    const ul = el('ul', 'rarity');
    ul.append(el('li', null, tierLabel(it)));   // AUDIT LOOT F6: the tier's line first, as the Reforge's card - the first choice wore its header's dress
    if (!choices.length) ul.append(el('li', null, IMPRINT_NONE));
    for (const rec of choices) {
      const p = powerOf(rec.id);
      const li = el('li', 'imprint-choice', `${p?.name ?? ''} (of ${rec.name})${p?.brief ? ` - ${p.brief}` : ''}`);
      li.dataset.record = rec.id;
      const why = imprintRefusal(it, rec.id, payer);
      const btn = el('button', 'act broker-buy imprint-press', reforgeLabel(why, IMPRINT_PRICE, have, 'Imprint'));
      btn.setAttribute('type', 'button');
      btn.setAttribute('aria-label', why ? `${p?.name ?? rec.name}: ${REFORGE_REFUSALS[why] ?? ''}` : `Imprint ${p?.name ?? rec.name} on ${nameOf(it)} for ${reforgePriceText(IMPRINT_PRICE)}`);   // AUDIT LOOT F6: said, as the Reforge's press is
      if (why) { btn.setAttribute('disabled', ''); btn.setAttribute('title', REFORGE_REFUSALS[why] ?? ''); }
      btn.onclick = (e) => {
        e.stopPropagation();
        if (why) return;
        const done = deps.imprint?.(it, rec.id) ?? { ok: false, reason: 'not' };
        if (done.ok) say(true, IMPRINTED(nameOf(it), rec.name, p?.name ?? '')); else say(false, REFORGE_REFUSALS[done.reason ?? ''] ?? 'The Reforge will not take that.');
        render();
      };
      li.append(btn);
      ul.append(li);
    }
    card.append(ul, el('p', 'boundline', `An imprint costs ${reforgePriceText(IMPRINT_PRICE)}. ${IMPRINT_ONCE}`));
    body.append(card);
  }
  /** LOOT20: THE SOCKETS - a row a socketed piece; its card sets a gem the pack holds, or unsets one (asked first).
   *  GEM1: a line a socket, each set one's extraction and its unsetting; the gems offered set in the first empty one. */
  function renderSockets(items, payer, have, picture) {
    const rows = items.filter((it) => hasSocket(it));
    if (!rows.includes(picked)) picked = rows[0] ?? null;
    if (!rows.length) list.append(head2(SOCKETS_NONE));
    for (const it of rows) {
      const r = rarityAttr(it);
      const row = el('li', `broker-offer socket-row${it === picked ? ' on' : ''}`);
      if (r) row.dataset.rarity = r;
      const text = el('div', 'broker-offer-body');
      const sockets = socketsOf(it);
      const said = sockets.map((v) => (v === SOCKET_EMPTY ? 'empty' : GEM_NAMES[v])).join(', ');
      text.append(el('span', 'broker-name', nameOf(it)), el('span', 'broker-set', `${tierLabel(it)} · ${sockets.length === 1 && sockets[0] === SOCKET_EMPTY ? 'an empty socket' : said}`));
      row.append(frameOf(it, picture), text);
      pressable(row, () => { picked = it; dropAsk(); render(); });
      list.append(row);
    }
    if (!picked) return;
    const it = picked;
    card = el('div', 'card broker-card socket-card');
    const r = rarityAttr(it);
    if (r) card.dataset.rarity = r;
    card.append(el('h3', null, nameOf(it)));
    const ul = el('ul', 'rarity');
    ul.append(el('li', null, tierLabel(it)));
    const fail = (done) => say(false, REFORGE_REFUSALS[done.reason ?? ''] ?? 'The Reforge will not take that.');
    socketsOf(it).forEach((gem, at) => {
      if (gem === SOCKET_EMPTY) return;
      const li = el('li', 'socket-gem', `${GEM_NAMES[gem]}: ${affixLabel(/** @type {any} */ (gemLine(it, gem)))}`);
      li.dataset.socket = String(at);
      // GEM1: the extraction - the gem whole into the pack, its grade's price
      const price = extractPrice(it, at) ?? 0;
      const xwhy = extractGemRefusal(it, payer, at);
      const x = el('button', 'act broker-buy extract-press', reforgeLabel(xwhy, { shards: 0, gold: price }, have, `Extract · ${price} gold`));
      x.setAttribute('type', 'button');
      x.setAttribute('aria-label', xwhy ? `${GEM_NAMES[gem]}: ${REFORGE_REFUSALS[xwhy] ?? ''}` : `Extract the ${GEM_NAMES[gem]} whole for ${price} gold`);
      if (xwhy) { x.setAttribute('disabled', ''); x.setAttribute('title', REFORGE_REFUSALS[xwhy] ?? ''); }
      x.onclick = (e) => {
        e.stopPropagation();
        if (xwhy) return;
        asking = null;
        const done = deps.extractGem?.(it, at) ?? { ok: false, reason: 'not' };
        if (done.ok) say(true, GEM_EXTRACTED(nameOf(it), gem, done.price ?? price)); else fail(done);
        render();
      };
      const why = unsetGemRefusal(it, at);
      const ask = asking === it && askingAt === at;
      const btn = el('button', 'act broker-buy unset-press', why ? reforgeLabel(why, null, have) : ask ? 'Shatter it' : 'Unset');
      btn.setAttribute('type', 'button');
      btn.setAttribute('aria-label', why ? `${GEM_NAMES[gem]}: ${REFORGE_REFUSALS[why] ?? ''}` : UNSET_ASK(gem));
      if (why) { btn.setAttribute('disabled', ''); btn.setAttribute('title', REFORGE_REFUSALS[why] ?? ''); }
      btn.onclick = (e) => {
        e.stopPropagation();
        if (why) return;
        if (!ask) { asking = it; askingAt = at; say(false, UNSET_ASK(gem)); render(); return; }
        asking = null;
        const done = deps.unsetGem?.(it, at) ?? { ok: false, reason: 'not' };
        if (done.ok) say(true, GEM_SHATTERED(nameOf(it), gem)); else fail(done);
        render();
      };
      li.append(x, btn);
      ul.append(li);
    });
    const empty = emptySockets(it);
    if (empty) {
      ul.append(el('li', null, empty === 1 ? 'Socket: empty' : `Sockets: ${empty} empty`));
      const held = gemsHeld(items);
      const kinds = ALL_GEM_IDS.filter((g) => held[g] > 0);
      if (!kinds.length) ul.append(el('li', null, GEMS_NONE));
      for (const g of kinds) {
        const li = el('li', 'socket-choice', `${GEM_NAMES[g]} (${held[g]}) - ${affixLabel(/** @type {any} */ (gemLine(it, g)))}`);
        li.dataset.gem = g;
        const why = setGemRefusal(it, g, payer);
        const btn = el('button', 'act broker-buy set-press', reforgeLabel(why, null, have, 'Set'));
        btn.setAttribute('type', 'button');
        btn.setAttribute('aria-label', why ? `${GEM_NAMES[g]}: ${REFORGE_REFUSALS[why] ?? ''}` : `Set the ${GEM_NAMES[g]} in ${nameOf(it)}`);
        if (why) { btn.setAttribute('disabled', ''); btn.setAttribute('title', REFORGE_REFUSALS[why] ?? ''); }
        btn.onclick = (e) => {
          e.stopPropagation();
          if (why) return;
          asking = null;
          const done = deps.setGem?.(it, g) ?? { ok: false, reason: 'not' };
          if (done.ok) say(true, GEM_SET(nameOf(it), g)); else fail(done);
          render();
        };
        li.append(btn);
        ul.append(li);
      }
    }
    card.append(ul, el('p', 'boundline', SOCKETS_NOTE));
    body.append(card);
  }
  /** LOOT19: THE SCRYERS - a row a family; a press names the nearest of its haunts not yet on the map. */
  let scryKin = null;
  function renderScry(payer, have) {
    purse.textContent = reforgePurseText(have.shards, have.gold);
    const where = deps.scryWhere?.() ?? null;
    for (const f of SCRY_FAMILIES) {
      const row = el('li', `broker-offer scry-row${scryKin === f ? ' on' : ''}`);
      row.dataset.family = f;
      const text = el('div', 'broker-offer-body');
      const places = familyPlaces(f);
      text.append(el('span', 'broker-name', SCRY_FAMILY_WORDS[f]), el('span', 'broker-set', places.charAt(0).toUpperCase() + places.slice(1)));
      const why = scryRefusal(payer, f, where);
      const btn = el('button', 'act broker-buy scry-press', reforgeLabel(why, SCRY_PRICE, have, 'Scry'));
      btn.setAttribute('type', 'button');
      btn.setAttribute('aria-label', why ? `${SCRY_FAMILY_WORDS[f]}: ${REFORGE_REFUSALS[why] ?? ''}` : `Scry a haunt of ${SCRY_FAMILY_WORDS[f].toLowerCase()} for ${reforgePriceText(SCRY_PRICE)}`);
      if (why) { btn.setAttribute('disabled', ''); btn.setAttribute('title', REFORGE_REFUSALS[why] ?? ''); }
      btn.onclick = (e) => {
        e.stopPropagation();
        if (why) return;
        const done = deps.scry?.(f) ?? { ok: false, reason: 'nowhere' };
        if (done.ok && done.place) say(true, SCRIED(done.place.name, f)); else say(false, REFORGE_REFUSALS[done.reason ?? ''] ?? 'The scryers see nothing.');
        scryKin = f;
        render();
      };
      row.append(text, el('span', 'broker-price', reforgePriceText(SCRY_PRICE)), btn);
      pressable(row, () => { scryKin = f; render(); });
      list.append(row);
    }
  }
  /** LOOT16: THE TEMPLE'S LIFTING - every known cursed piece of the pack, its drawback and its price; a press lifts it. */
  function renderLift(items, payer, have, picture) {
    purse.textContent = `${Math.max(0, have.gold | 0)} gold`;
    const rows = cursedKnown(items);
    if (!rows.length) list.append(head2(LIFT_NONE));
    for (const it of rows) {
      const r = rarityAttr(it);
      const price = /** @type {number} */ (liftPrice(it));
      const why = liftRefusal(it, payer);
      const row = el('li', 'broker-offer lift-row');
      if (r) row.dataset.rarity = r;
      const text = el('div', 'broker-offer-body');
      text.append(el('span', 'broker-name', nameOf(it)), el('span', 'broker-set', `${tierLabel(it)} · ${curseLine(it)}`));
      const btn = el('button', 'act broker-buy lift-press', reforgeLabel(why, { shards: 0, gold: price }, have, 'Lift'));
      btn.setAttribute('type', 'button');
      btn.setAttribute('aria-label', why ? `${nameOf(it)}: ${LIFT_REFUSALS[why] ?? ''}` : `Lift the curse on ${nameOf(it)} for ${price} gold`);
      if (why) { btn.setAttribute('disabled', ''); btn.setAttribute('title', LIFT_REFUSALS[why] ?? ''); }
      btn.onclick = (e) => {
        e.stopPropagation();
        if (why) return;
        const done = deps.lift?.(it) ?? { ok: false, reason: 'not' };
        if (done.ok) say(true, LIFTED(nameOf(it))); else say(false, LIFT_REFUSALS[done.reason ?? ''] ?? 'The priest will not lift that.');
        render();
      };
      row.append(frameOf(it, picture), text, el('span', 'broker-price', why === 'damned' ? '-' : `${price} gold`), btn);   // AUDIT FB1010 D2: no price for what no temple lifts
      list.append(row);
    }
  }
  render();
  host.append(shell);
  const onKey = (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (overlayAction(e) === 'back') { e.preventDefault(); e.stopPropagation(); exit(); }
  };
  globalThis.addEventListener('keydown', onKey, { capture: true });
  const offOutside = closeOnOutsideTap(shell, '.broker-win', exit);
  return {
    repaint: () => render(),
    unmount() {
      if (!alive) return;
      alive = false;
      globalThis.removeEventListener('keydown', onKey, { capture: true });
      offOutside();
      shell.remove();
    },
  };
}
