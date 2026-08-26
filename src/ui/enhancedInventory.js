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

import { TABS, filterByTab } from './nativeInventory.js';
import { EQUIP_SLOTS } from '../characters/paperdoll.js';
import { getTemplate } from '../characters/paperdoll.js';
import {
  equipItem, unequipSlot, equipTableOf, isEquipped,
  isForbiddenEquip, isBrokenItem,
} from '../systems/equip.js';
import { itemWeight } from '../systems/inventory.js';
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

/** One item's line, from the modules that own each part of it. */
export function itemLine(item) {
  const t = getTemplate(item.templateIndex);
  const archive = t?.playerTextureArchive ?? t?.worldTextureArchive;
  const record = t?.playerTextureRecord ?? t?.worldTextureRecord;
  return {
    name: item.name ?? t?.name ?? 'Unknown',
    weight: itemWeight(item),
    condition: (item.maxCondition ?? 0) > 0 ? conditionPercentage(item) : null,
    word: (item.maxCondition ?? 0) > 0 ? conditionWord(item) : null,
    material: item.group === 'Armor' || item.group === 'Weapons' ? materialName(item) : null,
    stack: (item.stackCount ?? 1) > 1 ? item.stackCount : null,
    equipped: isEquipped(item),
    broken: isBrokenItem(item),
    // The real icon lives at TEXTURE.{archive} record {record}. It is
    // recorded here so the wiring point is visible rather than lost.
    icon: archive != null ? `TEXTURE.${archive} record ${record}` : null,
  };
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
function itemRow(item) {
  const line = itemLine(item);
  const row = el('button', `itemrow${picked === item ? ' on' : ''}`);
  const tile = el('span', 'tile', line.name.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase());
  if (line.icon) tile.title = `${line.name} — ${line.icon}`;
  row.append(tile);
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
  const line = itemLine(picked);
  const c = el('div', 'card');
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
  c.append(acts);
  col.append(c);
  if (line.icon) {
    col.append(el('p', 'iconnote', `Icon: ${line.icon} — not drawn yet; the DOM has no path to the texture archives.`));
  }
  return col;
}

function render() {
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
  refresh();
  render();
  keyHandler = onKey;
  globalThis.addEventListener('keydown', keyHandler, { capture: true });
  lockHandler = releaseLock;
  releaseLock();
  if (typeof document !== 'undefined') document.addEventListener('pointerlockchange', lockHandler);
  globalThis.__pack = () => JSON.stringify({
    tab, count: model.count, worn: model.worn.size,
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
