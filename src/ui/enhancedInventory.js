// ═══════════════════════════════════════════════════════════════════
// U53 — THE ENHANCED PACK, and THE SLOT MAP
//
// ui/inventoryDoor.js chooses; this draws. It answers ONE of the
// classic window's flows - open your pack, see what you are wearing,
// wear something else - and the door hands loot piles and reward
// pickers to the classic window, which is stated there.
//
// ── THE SIGNATURE ────────────────────────────────────────────────
//
// src/tools/enhancedUI.js's header calls the slot map the most
// Daggerfall thing in the game, and it is right: twenty-seven equip
// slots, TWO amulets, TWO bracelets, TWO marks, TWO crystals, and
// chest armour and chest clothes as separate layers. The classic
// paperdoll draws this as a picture of a person and you hunt for the
// slots by clicking at them.
//
// Here it is an information graphic. Every slot is a node on a body
// schematic, filled nodes are lit, and the whole state of a
// character's kit reads in one glance at any size. A picture of a
// person tells you how they look; this tells you what you are
// carrying, which is what the screen is for.
//
// IT IS INLINE SVG, NOT THE PROTOTYPE'S THREE.JS. `mountFigure` in
// tools/enhancedVisuals.js builds a small three.js scene and
// enhanced.html loads that library from a CDN - and the port's
// doctrine already carries exactly one third-party request (Ledger A,
// the web fonts), which is one more than it wants. Twenty-seven
// positioned nodes need no library at all, and an SVG scales to a
// phone where a fixed-size WebGL canvas does not.
//
// ── THE LAW IS BORROWED, NOT REWRITTEN ───────────────────────────
//
// Nothing about items is decided here. Equipping is systems/equip.js's
// `equipItem`, which carries DFU's whole chain - the two-hander
// clearing both hands, a shield bumping a held two-hander, the
// forbidden-material and broken-item refusals, the swap delay billed
// per transition, the armour-value table and the enchantment hooks.
// Taking something off is `unequipSlot`. The four tab pages are
// nativeInventory.js's own `TABS` and `filterByTab`. Weight,
// condition, material and damage strings are systems/itemInfo.js's,
// every one of them cited to DFU. This module positions nodes and
// prints rows.
//
// ── WHAT IT DOES NOT DRAW ────────────────────────────────────────
//
// THE ITEM ICONS. The classic window draws them from the TEXTURE
// archives through GL textures the host hands it (`icons:
// { getTexture, uploadRecord, textures }`), which a DOM list cannot
// use. The path a DOM screen would need - archive record to canvas
// through ui/bitmapCanvas.js - does not exist yet, and inventing a
// second icon pipeline in this file is how the port ends up with two.
// The PROTOTYPE hit the same wall and answered it the same way, with
// two initials and the real archive/record in the tile's title, which
// is what this does. Recorded as a real loss; it is the next
// inventory slice's first job.
// ═══════════════════════════════════════════════════════════════════

import { TABS, filterByTab, USE_PENDING } from './nativeInventory.js';
import { useItem } from '../systems/useItem.js';
import { EQUIP_SLOTS } from '../characters/paperdoll.js';
import { inventoryItemImage, templateByIndex } from '../systems/itemTemplates.js';
import { requestIcon } from './textureCanvas.js';
import {
  equipItem, unequipSlot, equipTableOf, isEquipped,
  isForbiddenEquip, isBrokenItem,
} from '../systems/equip.js';
import { itemWeight, isEnchanted } from '../systems/inventory.js';
import { maxEncumbrance } from '../combat/formulas.js';
import { liveStat } from '../systems/statMods.js';
import { conditionWord, conditionPercentage, materialName } from '../systems/itemInfo.js';
import { injectEnhancedStyle, injectEnhancedFonts } from './enhancedStyle.js';
import { repaintKeepingScroll } from './domRepaint.js';
import { overlayAction } from './input.js';

/** Slot id -> where it sits on the body, and what to call it.
 *
 *  THE FIGURE FACES THE READER, so the character's RIGHT arm is drawn
 *  on the LEFT of the schematic - the same convention the classic
 *  paperdoll uses, and getting it backwards would put a shield in the
 *  wrong hand at a glance.
 *
 *  The four MAGIC slots (marks, crystals) and DFU's two unnamed ones
 *  have no place on a body, so they sit in a row underneath rather
 *  than being hidden: a slot the player cannot see is a slot they
 *  cannot empty. */
export const SLOT_MAP = Object.freeze({
  [EQUIP_SLOTS.Head]: { x: 110, y: 32, label: 'Head' },
  [EQUIP_SLOTS.Amulet0]: { x: 94, y: 60, label: 'Amulet' },
  [EQUIP_SLOTS.Amulet1]: { x: 126, y: 60, label: 'Amulet' },
  [EQUIP_SLOTS.Cloak1]: { x: 72, y: 76, label: 'Cloak' },
  [EQUIP_SLOTS.Cloak2]: { x: 148, y: 76, label: 'Cloak' },
  [EQUIP_SLOTS.ChestClothes]: { x: 110, y: 92, label: 'Chest, clothes' },
  [EQUIP_SLOTS.ChestArmor]: { x: 110, y: 116, label: 'Chest, armour' },
  [EQUIP_SLOTS.RightArm]: { x: 64, y: 106, label: 'Right arm' },
  [EQUIP_SLOTS.LeftArm]: { x: 156, y: 106, label: 'Left arm' },
  [EQUIP_SLOTS.Bracer0]: { x: 56, y: 134, label: 'Bracer' },
  [EQUIP_SLOTS.Bracer1]: { x: 164, y: 134, label: 'Bracer' },
  [EQUIP_SLOTS.Bracelet0]: { x: 50, y: 160, label: 'Bracelet' },
  [EQUIP_SLOTS.Bracelet1]: { x: 170, y: 160, label: 'Bracelet' },
  [EQUIP_SLOTS.Ring0]: { x: 62, y: 186, label: 'Ring' },
  [EQUIP_SLOTS.Ring1]: { x: 158, y: 186, label: 'Ring' },
  [EQUIP_SLOTS.RightHand]: { x: 42, y: 190, label: 'Right hand' },
  [EQUIP_SLOTS.LeftHand]: { x: 178, y: 190, label: 'Left hand' },
  [EQUIP_SLOTS.Gloves]: { x: 110, y: 172, label: 'Gloves' },
  [EQUIP_SLOTS.LegsArmor]: { x: 110, y: 200, label: 'Legs, armour' },
  [EQUIP_SLOTS.LegsClothes]: { x: 110, y: 224, label: 'Legs, clothes' },
  [EQUIP_SLOTS.Feet]: { x: 110, y: 258, label: 'Feet' },
  [EQUIP_SLOTS.Mark0]: { x: 44, y: 296, label: 'Mark', off: true },
  [EQUIP_SLOTS.Mark1]: { x: 72, y: 296, label: 'Mark', off: true },
  [EQUIP_SLOTS.Crystal0]: { x: 148, y: 296, label: 'Crystal', off: true },
  [EQUIP_SLOTS.Crystal1]: { x: 176, y: 296, label: 'Crystal', off: true },
  // DFU names these nothing. They are drawn ONLY when something is in
  // them, because a node with no name and no contents is noise - but a
  // node with no name and an ITEM in it is a player's belonging they
  // would otherwise have no way to reach.
  [EQUIP_SLOTS.Unknown1]: { x: 104, y: 296, label: 'Unnamed', off: true, hidden: true },
  [EQUIP_SLOTS.Unknown2]: { x: 116, y: 296, label: 'Unnamed', off: true, hidden: true },
});

/** The stroked figure the nodes sit on. Deliberately a schematic and
 *  not a drawing of a person: this screen answers "what am I
 *  carrying", and the classic paperdoll already answers the other. */
const FIGURE = [
  'M110 16 a16 16 0 1 1 -0.1 0',            // head
  'M110 48 L110 60',                          // neck
  'M84 62 L136 62 L140 150 L80 150 Z',        // torso
  'M84 66 L58 132 L46 186',                   // right arm (reader's left)
  'M136 66 L162 132 L174 186',                // left arm
  'M92 150 L88 250 M128 150 L132 250',        // legs
  'M84 254 L136 254',                         // feet line
];

/**
 * THE PACK, as data. Pure: no DOM, no mutation, every figure lifted
 * from the module that owns it.
 */
export function packModel(deps = {}) {
  const entity = deps.entity ?? {};
  const items = (deps.items?.() ?? []).filter(Boolean);
  const slots = equipTableOf(entity);
  const worn = new Map();
  for (const [slot, item] of Object.entries(slots ?? {})) {
    if (item) worn.set(Number(slot), item);
  }
  const carried = items.reduce((kg, it) => kg + itemWeight(it), 0);
  return {
    tabs: TABS.map((tab) => ({ tab, items: filterByTab(items, tab) })),
    worn,
    gold: items.find((it) => it.group === 'Currency')?.stackCount ?? 0,
    // FormulaHelper.MaxEncumbrance over LIVE strength, the same
    // expression the character sheet and the classic window use.
    encumbrance: { now: Math.trunc(carried), max: maxEncumbrance(liveStat(entity, 'strength')) },
    count: items.length,
  };
}

/**
 * One item's line, from the modules that own each part of it.
 *
 * THE ICON ADDRESS IS `inventoryItemImage`'s, AND U53 GOT THIS WRONG.
 * It read `playerTextureArchive ?? worldTextureArchive` off the
 * template, which looks like the same thing and is not: that one
 * expression is four ported laws, two of them with audits behind
 * them. GetItemImage draws the WORLD texture for UselessItems1,
 * ingredients, arrows, ReligiousItems and MiscItems - 111 of 288
 * templates differ (AUDIT 17e F9). The player archive is offset by the
 * WEARER's body morphology, or every list draws the morphology-0
 * Argonian row (AUDIT 17f). Variants index off the record, with cloaks
 * skipping their interior-first one and armour riding SetVariant's
 * material-family clamps (AUDIT 23 items-6). And katanas take +1 on
 * the inventory branch alone.
 *
 * `identity` is the wearer, and it matters for exactly the morphology
 * reason above - the classic drawer passes `hooks.entity` for it.
 */
export function itemLine(item, identity = undefined) {
  const img = inventoryItemImage(item, identity);
  // The TEMPLATE's name is the fallback, not 'Unknown'. A stack minted
  // by a loot roll or a quest can arrive with no name of its own, and
  // this dropped that fallback for one commit when the template read
  // it replaced went away with it.
  const t = templateByIndex(item.templateIndex);
  return {
    name: item.name ?? t?.name ?? 'Unknown',
    weight: itemWeight(item),
    condition: (item.maxCondition ?? 0) > 0 ? conditionPercentage(item) : null,
    word: (item.maxCondition ?? 0) > 0 ? conditionWord(item) : null,
    material: item.group === 'Armor' || item.group === 'Weapons' ? materialName(item) : null,
    stack: (item.stackCount ?? 1) > 1 ? item.stackCount : null,
    equipped: isEquipped(item),
    broken: isBrokenItem(item),
    // The address only. Fetching is the view's business, because a
    // model has no repaint to schedule.
    image: img,
  };
}

/**
 * WHAT TO DO WITH A `useItem` RESULT - decided once, performed by the
 * view.
 *
 * `systems/useItem.js` owns the LAW (which item does what); what the
 * classic window adds on top is presentation plus ONE ordering rule
 * that is not presentation at all, and this exists so that rule is
 * written down and testable rather than retyped from memory:
 *
 * THE TWO HAND-OFFS RUN IN OPPOSITE ORDERS, and that is deliberate in
 * the classic window rather than an accident to copy carelessly. Both
 * exist because DFU PUSHES those windows over the inventory - a window
 * stack - while the port's hosts hold ONE overlay slot, so the
 * inventory must run its own close law or the pile it was about to
 * drop never mints (AUDIT B-C1). But:
 *
 *   BOOK:      hand over, THEN close. The reader takes a failure
 *              callback, and "a failed open still reports on this
 *              window - it is the live overlay until the reader
 *              actually shows".
 *   SPELLBOOK: close, THEN hand over. There is no callback, so the
 *              slot is freed first.
 *
 * The first draft of this module gave both `closeFirst: true` and its
 * pin asserted the same thing, because the code and the pin were
 * written from one wrong reading. The browser found it: closing first
 * also cleared the deps the hook was about to be read from, so the
 * book arm threw `deps.openBook is not a function`.
 *
 * A host that handed no hook keeps its window and SAYS SO, which is
 * why `pending` exists and why the classic window's own USE_PENDING
 * strings are reused here rather than reworded.
 */
export function useResultAction(r, { openBook = null, openSpellbook = null } = {}) {
  if (!r) return { kind: 'nothing' };
  if (r.kind === 'book') {
    return openBook
      ? { kind: 'openBook', item: r.item, failText: r.failText, closeFirst: false }
      : { kind: 'message', text: USE_PENDING.book };
  }
  if (r.kind === 'spellbook') {
    return openSpellbook
      ? { kind: 'openSpellbook', closeFirst: true }
      : { kind: 'message', text: USE_PENDING.spellbook };
  }
  // The classic window's own ladder, in its own order: an explicit
  // text, then a TEXT.RSC id, then the pending stand-in. AUDIT 22 F9:
  // `enchanted` is a RIDER on the arm's result, not a kind that
  // replaced it, so it only speaks when the arm itself said nothing.
  const out = { kind: 'message', text: null, textId: null,
    repaint: r.kind === 'variant', closesWindow: !!r.closesWindow };
  if (r.text) out.text = r.text;
  else if (r.textId) out.textId = r.textId;
  else if (r.pending) out.text = USE_PENDING[r.kind] ?? 'Nothing happens.';
  if (r.enchanted && !r.text && !r.textId) out.text = USE_PENDING.enchanted;
  return out;
}

// ── THE VIEW ─────────────────────────────────────────────────────

let host = null;
let deps = {};
let model = null;
let tab = TABS[0];
let picked = null;      // the selected item object
let notice = null;
let onExit = () => {};
let keyHandler = null;
let lockHandler = null;
// U54: how many times this screen has rebuilt itself. Every cold icon
// repaints when it lands, which is what makes the letters give way to
// the picture - so the count should be ROUGHLY the number of distinct
// icons and no more. A cache that forgot its in-flight records decodes
// each one once per repaint until the first lands, and the count
// doubles; the probe measures it, which is the only way that shows.
let repaints = 0;

const el = (t, cls, txt) => {
  const n = document.createElement(t);
  if (cls) n.className = cls;
  if (txt != null) n.textContent = txt;
  return n;
};
const svg = (t, attrs) => {
  const n = document.createElementNS('http://www.w3.org/2000/svg', t);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, String(v));
  return n;
};

const refresh = () => { model = packModel(deps); };

/** Wearing something, through the ONE chain. A refusal is REPORTED -
 *  the classic window pops TEXT.RSC for the same two cases, and a
 *  press that silently does nothing is what the anti-lie law forbids. */
function wear(item) {
  notice = null;
  if (isBrokenItem(item)) { notice = `${item.name} is broken and cannot be worn.`; return render(); }
  if (isForbiddenEquip(deps.entity?.career, item)) {
    notice = `A ${deps.entity?.career?.name ?? 'character'} may not use ${item.name}.`;
    return render();
  }
  if (equipItem(deps.entity, item) === null) { notice = `${item.name} cannot be worn.`; return render(); }
  refresh();
  return render();
}

/** USING something, through the ONE law. The deps are the classic
 *  window's own, hook for hook - a host that hands none leaves the arm
 *  silent in exactly the way it leaves the classic window's silent. */
function use(item) {
  notice = null;
  const r = useItem(item, deps.items?.() ?? [], {
    entity: deps.entity,
    // AUDIT 22 F4: the oil arm looks for its lantern in the LOCAL pack
    // whatever list the click came from, so the bag travels separately.
    localItems: deps.items?.() ?? [],
    spellCount: () => deps.entity?.spells?.length ?? 0,
    isEnchanted,
    nowMinute: deps.nowMinute?.() ?? 0,
    revealMap: deps.revealMap ?? null,
    drinkPotion: deps.drinkPotion ?? null,
  });
  const act = useResultAction(r, { openBook: deps.openBook, openSpellbook: deps.openSpellbook });
  // THE HOOKS ARE READ BEFORE ANYTHING CLOSES. `onExit` unmounts, and
  // unmounting clears `deps` - so a hook read after it is undefined.
  // That is not hypothetical: the first draft closed first and threw
  // `deps.openBook is not a function` on the first real press.
  if (act.kind === 'openBook') {
    const open = deps.openBook, fail = act.failText;
    // HAND OVER, THEN CLOSE - the reader's failure callback reports on
    // this window while it is still the live overlay.
    open(act.item, () => { notice = fail; render(); });
    onExit();
    return;
  }
  if (act.kind === 'openSpellbook') {
    const open = deps.openSpellbook;
    onExit();   // CLOSE, THEN HAND OVER - no callback, so free the slot
    open();
    return;
  }
  if (act.textId && deps.rows) {
    const rows = deps.rows(act.textId) ?? [];
    notice = rows.map((row) => (typeof row === 'string' ? row : row?.text ?? '')).join(' ').trim() || null;
  } else if (act.text) {
    notice = act.text;
  }
  refresh();
  if (act.closesWindow) { onExit(); return; }
  render();
}

function takeOff(slot) {
  notice = null;
  unequipSlot(deps.entity, slot);
  refresh();
  render();
}

function slotMap() {
  const wrap = el('div', 'slotmap');
  const s = svg('svg', { viewBox: '0 0 220 320', role: 'img', 'aria-label': 'Equipment slots' });
  const fig = svg('g', { class: 'figure' });
  for (const d of FIGURE) fig.append(svg('path', { d }));
  s.append(fig);

  for (const [id, at] of Object.entries(SLOT_MAP)) {
    const slot = Number(id);
    const item = model.worn.get(slot);
    if (at.hidden && !item) continue;
    const g = svg('g', {
      class: `node${item ? ' filled' : ''}${at.off ? ' off' : ''}`,
      tabindex: item ? '0' : '-1',
      role: item ? 'button' : 'presentation',
    });
    const title = svg('title', {});
    title.textContent = item ? `${at.label}: ${item.name} — click to take off` : `${at.label}: empty`;
    g.append(title, svg('circle', { cx: at.x, cy: at.y, r: item ? 7 : 4.5 }));
    if (item) {
      g.addEventListener('click', () => takeOff(slot));
      g.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); takeOff(slot); }
      });
    }
    s.append(g);
  }
  wrap.append(s);
  const filled = model.worn.size;
  const total = Object.keys(SLOT_MAP).length;
  wrap.append(el('p', 'slotcount', `${filled} of ${total} slots filled`));
  return wrap;
}

// NO "WORN" MARK ON A ROW, and the reason is DFU's: filterByTab is
// FilterLocalItems, and its first line drops every equipped item -
// worn kit leaves the list. A badge here could never render, and a
// decoration that cannot render is the same lie as a button that does
// nothing. Worn items live on the SLOT MAP, which is the whole
// argument this screen makes.
/**
 * The item's own icon, or its initials.
 *
 * THE INITIALS ARE THE FALLBACK NOW, not the answer. A screen with no
 * ARENA2 behind it - a test page, a failed archive, a record past the
 * end - still tells a Longsword from a Lockpick in a list you are
 * scanning, which is what the prototype's tile was for. When the real
 * record lands the whole screen repaints and the letters give way.
 */
function itemTile(line) {
  const src = line.image
    ? requestIcon(line.image.archive, line.image.record, { scale: 2, onReady: render })
    : null;
  if (src) {
    const tile = el('span', 'tile has-icon');
    const img = el('img');
    img.src = src;
    img.alt = '';
    // NO WIDTH ATTRIBUTE. These sprites are not square - a dagger is
    // tall and narrow, a cuirass wide - and forcing 30 across squashes
    // every one of them. The CSS caps both axes instead, which scales
    // to fit and keeps the shape.
    tile.append(img);
    tile.title = line.name;
    return tile;
  }
  const tile = el('span', 'tile', line.name.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase());
  tile.title = line.image
    ? `${line.name} — TEXTURE.${line.image.archive} record ${line.image.record}`
    : line.name;
  return tile;
}

function itemRow(item) {
  const line = itemLine(item, deps.entity);
  const row = el('button', `itemrow${picked === item ? ' on' : ''}`);
  row.append(itemTile(line));
  const mid = el('span', 'itemname');
  mid.append(el('span', null, line.name + (line.stack ? ` ×${line.stack}` : '')));
  const sub = [line.material, line.word].filter(Boolean).join(' · ');
  if (sub) mid.append(el('small', null, sub));
  row.append(mid);
  row.append(el('span', 'itemwt', `${line.weight.toFixed(2)} kg`));
  row.onclick = () => { picked = item; notice = null; render(); };
  return row;
}

function listCol() {
  const col = el('section', 'packcol');
  const tabs = el('div', 'packtabs');
  for (const t of TABS) {
    const b = el('button', `packtab${t === tab ? ' on' : ''}`, t[0].toUpperCase() + t.slice(1));
    const n = model.tabs.find((x) => x.tab === t)?.items.length ?? 0;
    b.append(el('span', 'count', String(n)));
    b.onclick = () => { tab = t; picked = null; render(); };
    tabs.append(b);
  }
  col.append(tabs);
  const rows = model.tabs.find((x) => x.tab === tab)?.items ?? [];
  if (!rows.length) {
    col.append(el('p', 'packempty', 'Nothing in this pack answers to that page.'));
  }
  for (const it of rows) col.append(itemRow(it));
  return col;
}

// `packdetail`, NOT `detail`. The settings pane's phone sheet already
// owns `.detail` in the same stylesheet - `position: fixed;
// transform: translateY(101%)` - so this column inherited it and sat
// 101% below the fold on every phone, with the Wear button in it. The
// desktop was perfect and the source read correctly; only a browser
// could see it. A generic class name in a shared stylesheet is a
// collision waiting for the second screen that wants the word.
//
// THE PHONE WANTS A SHEET ANYWAY, which is why the collision was so
// easy to miss: three columns do not fit one phone, and the settings
// pane answered the same problem the same way (AUDIT F8). So this is
// that behaviour written deliberately - the detail rises when an item
// is picked and closes back down - rather than borrowed by accident.
function detailCol() {
  const col = el('section', `packcol packdetail${picked ? ' open' : ''}`);
  const close = el('button', 'sheet-close', 'Close');
  close.onclick = () => { picked = null; render(); };
  col.append(close);
  if (!picked) {
    col.append(el('p', 'packempty', 'Pick something to read it.'));
    return col;
  }
  const line = itemLine(picked, deps.entity);
  const c = el('div', 'card');
  // The detail draws it BIGGER - this is the one place there is room
  // to see what the thing actually looks like.
  const big = line.image
    ? requestIcon(line.image.archive, line.image.record, { scale: 4, onReady: render })
    : null;
  if (big) {
    const fig = el('div', 'bigicon');
    const img = el('img');
    img.src = big;
    img.alt = '';
    fig.append(img);
    c.append(fig);
  }
  c.append(el('h3', null, line.name));
  const meta = [line.material, line.stack ? `${line.stack} of them` : null].filter(Boolean).join(' · ');
  if (meta) c.append(el('p', 'meta', meta));
  const dl = el('dl', 'stats');
  const pair = (k, v) => { if (v != null) dl.append(el('dt', null, k), el('dd', null, String(v))); };
  pair('Weight', `${line.weight.toFixed(2)} kg`);
  pair('Condition', line.condition != null ? `${line.word} · ${line.condition}%` : null);
  pair('Worn', line.equipped ? 'yes' : 'no');
  c.append(dl);
  const acts = el('div', 'acts');
  // REACHABLE, unlike a badge on a row: the selection survives the
  // press, so the item you just wore is still here and can come
  // straight back off. Every OTHER way to take something off is the
  // slot map.
  if (line.equipped) {
    const b = el('button', 'act primary', 'Take off');
    b.onclick = () => takeOff(picked.equipSlot);
    acts.append(b);
  } else {
    const b = el('button', 'act primary', 'Wear');
    b.onclick = () => wear(picked);
    acts.append(b);
  }
  // USE is offered for EVERYTHING, exactly as the classic window's Use
  // mode is: `useItem` has an arm for every group and the honest answer
  // for a thing with no use is its own "Nothing happens." A button that
  // appeared only for items this screen believed were usable would be
  // this screen making a judgement the law already makes.
  const u = el('button', 'act', 'Use');
  u.onclick = () => use(picked);
  acts.append(u);
  c.append(acts);
  col.append(c);
  // The address, for the player who wants it and the developer who
  // needs it - the same place the classic window's own info panel
  // would never put it. Shown only when the picture is NOT here, so it
  // reads as an explanation rather than as clutter.
  if (line.image && !big) {
    col.append(el('p', 'iconnote',
      `No picture for this one yet — TEXTURE.${line.image.archive} record ${line.image.record}.`));
  }
  return col;
}

function render() {
  repaints++;
  repaintKeepingScroll(host, () => {
    host.innerHTML = '';
    const shell = el('div', 'pack-shell');
    const head = el('header', 'pack-id');
    const who = el('div');
    who.append(el('h2', null, 'Pack'));
    who.append(el('p', 'meta',
      `${model.count} items · ${model.encumbrance.now} / ${model.encumbrance.max} kg · ${model.gold.toLocaleString()} gold`));
    head.append(who);
    const close = el('button', 'act', 'Close');
    close.onclick = () => onExit();
    head.append(close);
    shell.append(head);
    const grid = el('div', 'pack');
    grid.append(slotMap(), listCol(), detailCol());
    shell.append(grid);
    if (notice) shell.append(el('p', 'sheet-notice', notice));
    host.append(shell);
  });
}

// ── THE KEYBOARD ─────────────────────────────────────────────────
// ESCAPE AND F6, the two keys the classic window closes on. F6 is a
// host BINDING rather than overlay vocabulary, so it is read from the
// event and CLAIMED - the same law U52's sheet applies to F5.
function onKey(e) {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const t = e.target;
  if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
  if (overlayAction(e) !== 'back' && e.key !== 'F6') return;
  e.preventDefault();
  e.stopPropagation();
  onExit();
}

function releaseLock() {
  try {
    if (typeof document !== 'undefined' && document.pointerLockElement) document.exitPointerLock();
  } catch { /* a browser that refuses is a browser with no lock to drop */ }
}

export function mountEnhancedInventory(hostEl, d = {}) {
  injectEnhancedStyle();
  injectEnhancedFonts();
  host = hostEl;
  deps = d;
  onExit = d.onExit ?? (() => {});
  tab = TABS[0];
  picked = null;
  notice = null;
  repaints = 0;
  refresh();
  render();
  keyHandler = onKey;
  globalThis.addEventListener('keydown', keyHandler, { capture: true });
  lockHandler = releaseLock;
  releaseLock();
  if (typeof document !== 'undefined') document.addEventListener('pointerlockchange', lockHandler);
  globalThis.__pack = () => JSON.stringify({
    tab, repaints, count: model.count, worn: model.worn.size,
    rows: [...hostEl.querySelectorAll('.itemrow')].length,
    nodes: [...hostEl.querySelectorAll('.node')].length,
    filled: [...hostEl.querySelectorAll('.node.filled')].length,
    picked: picked?.name ?? null, notice,
  });
  return {
    repaint() { refresh(); render(); },
    unmount() {
      // EVERY LISTENER HAS AN OWNER, and this one claims F6 - an orphan
      // eats the key that opens the pack, for the rest of the session.
      if (keyHandler) globalThis.removeEventListener('keydown', keyHandler, { capture: true });
      if (lockHandler && typeof document !== 'undefined') document.removeEventListener('pointerlockchange', lockHandler);
      keyHandler = null;
      lockHandler = null;
      hostEl.innerHTML = '';
      host = null;
      deps = {};
      onExit = () => {};
      delete globalThis.__pack;
    },
  };
}
