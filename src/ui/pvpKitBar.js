// @ts-check
// PVP-KIT (systems/wild/pvpKit.js): THE PVP SPELL BAR - eight slots on keys 3 to 0 (the hotbar's own slot actions, so a
// rebound key moves with them), shown and live only while my flag is up in the open zone ("flagged has a seperate hot
// barr"). Keys 1 and 2 stay the potions'. A press readies the slot's spell and fires it at once, the hotbar's way
// (systems/quickslots.js hotbarPress). With the mouse free, a click on a slot opens its picker: the spell, its element or
// attribute, its icon. The bar is kept in this browser (a viewer's convenience). The one host line is in scenes/world.js.
import { t } from '../systems/textManager.js';
import { HOTBAR_SLOT_ACTIONS } from '../systems/inputActions.js';
import { eventActions, isTextEntryTarget, hostPaused, bindings } from './input.js';
import { quickslotTag } from './quickslotTags.js';
import { claimHotbarKeys } from './enhanced/enhancedHotbar.js';
import { spellIconUrl } from './enhanced/enhancedArt.js';
import { skillValue } from '../systems/skills.js';
import { CAST_PRESS } from '../combat/twoHands/spellHand.js';
import { CAST_LEVEL_MAX } from '../net/wire.js';
import {
  PVP_KIT, KIT_IDS, KIT_SPELLS, KIT_ELEMENTS, KIT_ATTRIBUTES, kitBarOf, kitSlotOf, kitSlotName, kitBaseName, kitElementName,
  kitAttributeName, kitSpell, kitSchool, kitRefusal,
} from '../systems/wild/pvpKit.js';

/** The eight slot actions: the hotbar's 3 to 0 (QuickSpell, QuickOffHand, Hotbar5 .. Hotbar10). */
export const KIT_ACTIONS = Object.freeze(HOTBAR_SLOT_ACTIONS.slice(2, 2 + PVP_KIT.slots));
const STORE = 'dfo.pvpKitBar.v1';
const ICONS = 69;

/** The slot a key event presses, or -1. */
export const kitSlotOfEvent = (e) => eventActions(e).map((a) => KIT_ACTIONS.indexOf(a)).find((i) => i >= 0) ?? -1;

/** Read and write the saved bar; a blocked store leaves the default. */
export function loadKitBar(key = STORE) {
  try { return kitBarOf(JSON.parse(globalThis.localStorage?.getItem(key) ?? 'null')); } catch { return kitBarOf(null); }
}
export function saveKitBar(bar, key = STORE) {
  try { globalThis.localStorage?.setItem(key, JSON.stringify(bar)); } catch { /* a private window keeps it for the page */ }
}

/**
 * THE CAST: slot `i`'s spell built at my skill, my level (an ally's frame's clamp when one is aimed at), my health and my
 * magicka, readied and fired through the cast engine. Answers what the engine did: 'cast', 'refused' or 'none'.
 * @param {{ magic: any, entity: any, allyAimed?: (reach: number) => boolean }} deps @param {any} slot
 */
export function castKitSlot({ magic, entity, allyAimed = () => false }, slot) {
  if (!magic || !entity) return 'none';
  const s = kitSlotOf(slot);
  const gift = s.id !== 'damage' && allyAimed(PVP_KIT.reachM);
  const level = Math.max(1, Math.trunc(entity.level || 1));
  const sp = kitSpell(s, { skill: skillValue(entity, kitSchool(s.id, s.pick)), level: gift ? Math.min(CAST_LEVEL_MAX, level) : level,
    maxHealth: entity.maxHealth ?? 0, maxMagicka: entity.maxMagicka ?? 0 });
  if (magic.readySpell?.(sp) === false) return 'refused';
  if (!magic.spellArmed?.()) return 'cast';   // a CasterOnly spell cast at the ready (DFU's SetReadySpell)
  return magic.interceptAttack?.(true, CAST_PRESS) === true ? 'cast' : 'refused';
}

/**
 * The bar on this page. `host()` answers the host's lets as it reads them now (so the wiring is one line, and nothing is
 * read before the host declares it): the live link, the street's cast engine, the mode, the party member pick
 * (`pick(eye, dir, reach)`, scenes/world.js allyTargetPick), the camera and its forward. Live while my flag
 * (scenes/pvpFlagHost.js) is up in the open zone, on its streets and fields.
 * @param {() => any[]} host @param {{ on: () => boolean }} flag @param {any} entity @param {{ doc?: Document | null }} [o]
 */
export function createPvpKitBar(host, flag, entity, { doc = typeof document === 'undefined' ? null : document } = {}) {
  const lets = () => { try { return host() ?? []; } catch { return []; } };   // a let the host has not declared yet
  const active = () => { const [online, , mode] = lets(); return !!online?.wildOk && flag.on() && (mode ?? 'exterior') === 'exterior'; };
  const magic = () => lets()[1] ?? null;
  const allyAimed = (r) => { const [, , , pick, cam, fwd] = lets(); try { return !!pick?.(cam?.pos, fwd?.(), r); } catch { return false; } };
  let bar = loadKitBar();
  let root = /** @type {any} */ (null), picker = /** @type {any} */ (null);
  const on = () => { try { return !!active(); } catch { return false; } };
  const press = (i) => castKitSlot({ magic: magic(), entity, allyAimed }, bar[i]);
  const mine = (e) => on() && !e.metaKey && !isTextEntryTarget(e.target) && hostPaused() !== true && kitSlotOfEvent(e) >= 0;
  const onKey = (e) => {
    if (!mine(e)) return;
    const i = kitSlotOfEvent(e);
    e.preventDefault();
    e.stopImmediatePropagation();   // the hotbar, the diamond and the host's ladder never see a key the bar took
    if (!e.repeat) press(i);
  };
  const setSlot = (i, slot) => { bar = bar.map((s, j) => (j === i ? kitSlotOf(slot, i) : s)); saveKitBar(bar); paint(); };
  const iconOf = (img, icon) => { const u = spellIconUrl(icon); if (u && img.src !== u) img.src = u; };
  const paint = () => {
    if (!root) return;
    root.style.display = on() ? 'flex' : 'none';
    bar.forEach((s, i) => {
      const cell = root.children[i];
      iconOf(cell.firstChild, s.icon);
      const tag = quickslotTag(KIT_ACTIONS[i], { bindings: bindings() });
      cell.lastChild.textContent = tag?.kind === 'key' ? tag.text : '';
      cell.title = `${kitSlotName(s)} - ${t('pvp.kit.cost', '{n}% of your magicka', { n: KIT_SPELLS[s.id].cost })}`;
    });
  };
  const button = (label, fn, chosen = false) => {
    const b = doc.createElement('button');
    b.type = 'button';
    b.textContent = label;
    Object.assign(b.style, { margin: '2px', padding: '2px 6px', font: '12px serif', background: chosen ? '#6b5a2e' : '#2a241c', color: '#e8dcc0', border: '1px solid #8a7246', cursor: 'pointer' });
    b.addEventListener('click', fn);
    return b;
  };
  /** The picker for slot `i`: the spell, its element or attribute, its icon. */
  const openPicker = (i) => {
    picker?.remove();
    const s = bar[i];
    picker = doc.createElement('div');
    Object.assign(picker.style, { position: 'fixed', left: '50%', top: '50%', transform: 'translate(-50%, -50%)', zIndex: '60', maxWidth: '420px', padding: '8px', background: '#1c1812ee', border: '2px solid #8a7246', color: '#e8dcc0', font: '13px serif' });
    const row = (label) => { const r = doc.createElement('div'); r.style.margin = '4px 0'; r.textContent = label; picker.appendChild(r); return r; };
    const spells = row(t('pvp.kit.spell', 'Spell'));
    for (const id of KIT_IDS) spells.appendChild(button(kitBaseName(id), () => { setSlot(i, { id, pick: null, icon: KIT_SPELLS[id].icon }); openPicker(i); }, s.id === id));
    const kind = KIT_SPELLS[s.id].pick;
    if (kind === 'element') {
      const r = row(t('pvp.kit.element', 'Element'));
      for (const el of KIT_ELEMENTS) r.appendChild(button(kitElementName(el), () => { setSlot(i, { ...s, pick: el }); openPicker(i); }, s.pick === el));
    } else if (kind === 'attribute') {
      const r = row(t('pvp.kit.attribute', 'Attribute'));
      for (const a of KIT_ATTRIBUTES) r.appendChild(button(kitAttributeName(a), () => { setSlot(i, { ...s, pick: a }); openPicker(i); }, s.pick === a));
    }
    const icons = row(t('pvp.kit.icon', 'Icon'));
    for (let n = 0; n < ICONS; n++) {
      const img = doc.createElement('img');
      Object.assign(img.style, { width: '24px', height: '24px', margin: '1px', imageRendering: 'pixelated', cursor: 'pointer', outline: n === s.icon ? '2px solid #e8b62c' : '' });
      iconOf(img, n);
      img.addEventListener('click', () => { setSlot(i, { ...s, icon: n }); openPicker(i); });
      icons.appendChild(img);
    }
    picker.appendChild(button(t('pvp.kit.close', 'Close'), () => { picker?.remove(); picker = null; }));
    doc.body?.appendChild(picker);
  };
  if (doc) {
    globalThis.addEventListener?.('keydown', onKey, true);
    claimHotbarKeys(mine);   // the hotbar's 3 to 0 stand aside under the bar, whichever listener hears the key first
    root = doc.createElement('div');
    Object.assign(root.style, { position: 'fixed', left: '50%', bottom: '96px', transform: 'translateX(-50%)', zIndex: '40', display: 'none', gap: '3px' });
    root.title = t('pvp.kit.help', 'Your PvP spells. Free the mouse and click a slot to change it.');
    for (let i = 0; i < PVP_KIT.slots; i++) {
      const cell = doc.createElement('div');
      Object.assign(cell.style, { position: 'relative', width: '40px', height: '40px', background: '#2a241c', border: '2px solid #8a7246', cursor: 'pointer' });
      const img = doc.createElement('img');
      Object.assign(img.style, { width: '36px', height: '36px', imageRendering: 'pixelated' });
      const chip = doc.createElement('span');
      Object.assign(chip.style, { position: 'absolute', right: '1px', bottom: '0', font: '10px monospace', color: '#e8dcc0', textShadow: '1px 1px #000' });
      cell.append(img, chip);
      cell.addEventListener('click', () => openPicker(i));
      root.appendChild(cell);
    }
    doc.body?.appendChild(root);
    setInterval(() => {
      if (!on() && picker) { picker.remove(); picker = null; }
      paint();
    }, 250);
    paint();
  }
  return {
    /** The cast engine's word on a spell (scenes/hostMagic.js spellRefusal): under the flag, the bar's alone. */
    refusal: (sp) => kitRefusal(sp, on()),
    press,
    bar: () => bar,
    setSlot,
  };
}
