// @ts-check
// PVP-SET (systems/wild/pvpSet.js): THE PVP SET AND ITS MENU, on this page - the module the world host wires. While my
// flag is up in the open zone the hotbar shows and fires its second set (ui/enhanced/enhancedHotbar.js, the same slots);
// the menu makes toolkit spells (PVP-KIT, systems/wild/pvpKit.js) and fills the set by drag or click. The set is kept in
// this browser and an old bar (dfo.pvpKitBar.v1) is carried into it. The one host line is in scenes/world.js.
import { appStorage } from '../systems/appStorage.js';
import { t } from '../systems/textManager.js';
import { HOTBAR_SLOT_ACTIONS } from '../systems/inputActions.js';
import { eventActions, isTextEntryTarget, hostPaused } from './input.js';
import { spellIconUrl } from './enhanced/enhancedArt.js';
import { skillValue } from '../systems/skills.js';
import { CAST_PRESS } from '../combat/twoHands/spellHand.js';
import { CAST_RECOVER_S } from '../combat/fpsSpellCasting.js';
import { castRate } from '../systems/castSpeed.js';
import { calculateCastCost } from '../systems/spellcost.js';
import { CAST_LEVEL_MAX } from '../net/wire.js';
import { isEnhanced, forceHotbar } from '../systems/uiSkin.js';
import { holdCursor } from '../player/pointerLock.js';
import {
  useHotbarSet,
  hotbarSetEntries,
  restoreHotbarSet,
  lockHotbarSet,
  setHotbarKitPress,
  hotbarEntry,
  hotbarPress,
} from '../systems/quickslots.js';
import {
  setHotbarSecondSet,
  setHotbarDropMode,
  beginHotbarDrag,
  takeHotbarDragClick,
  armHotbarKit,
  hotbarArmedKit,
} from './enhanced/enhancedHotbar.js';
import {
  PVP_KIT,
  KIT_IDS,
  KIT_SPELLS,
  KIT_ELEMENTS,
  KIT_ATTRIBUTES,
  kitSlotOf,
  kitSlotName,
  kitBaseName,
  kitElementName,
  kitAttributeName,
  kitSpell,
  kitSchool,
  kitRefusal,
} from '../systems/wild/pvpKit.js';
import {
  pvpStoreOf,
  pvpStoreFromV1,
  makeKit,
  unmakeKit,
  kitTag,
  kitCostLine,
  pvpSetLockLine,
  pvpSlotMarks,
} from '../systems/wild/pvpSet.js';

export const PVP_SET_STORE = 'dfo.pvpBar.v2';
export const PVP_KIT_STORE_V1 = 'dfo.pvpKitBar.v1';
const ICONS = 69;
const OWNER = 'pvp-spells';
const COST_TTL_MS = 250;

const readJson = (key) => {
  try {
    return JSON.parse(appStorage()?.getItem(key) ?? 'null');
  } catch {
    return null;
  }
};
/** The saved set and made spells; no v2 record: the old bar carried in, beside the normal set's first two slots. */
export function loadPvpStore(main = [], { key = PVP_SET_STORE, old = PVP_KIT_STORE_V1 } = {}) {
  return pvpStoreOf(readJson(key)) ?? pvpStoreFromV1(readJson(old), main);
}
export function savePvpStore(store, key = PVP_SET_STORE) {
  try {
    appStorage()?.setItem(key, JSON.stringify({ v: 2, set: store.set, made: store.made }));
  } catch {
    /* a private window keeps it for the page */
  }
}

/** The spell a made slot casts for `entity` (`gift`: at an ally's frame level). */
function kitSpellFor(entity, slot, gift = false) {
  const s = kitSlotOf(slot);
  const level = Math.max(1, Math.trunc(entity?.level || 1));
  return kitSpell(s, {
    skill: skillValue(entity, kitSchool(s.id, s.pick)),
    level: gift ? Math.min(CAST_LEVEL_MAX, level) : level,
    maxHealth: entity?.maxHealth ?? 0,
    maxMagicka: entity?.maxMagicka ?? 0,
  });
}

/**
 * THE CAST: a made spell built at my skill, my level (an ally's frame's clamp when one is aimed at), my health and my
 * magicka, readied and fired through the cast engine. Answers what the engine did: 'cast', 'refused' or 'none'.
 * @param {{ magic: any, entity: any, allyAimed?: (reach: number) => boolean }} deps @param {any} slot
 */
export function castKitSlot({ magic, entity, allyAimed = () => false }, slot) {
  if (!magic || !entity) return 'none';
  const s = kitSlotOf(slot);
  const gift = s.id !== 'damage' && s.id !== 'resurrect' && allyAimed(PVP_KIT.reachM); // PVP-KIT-REZ: a body is raised, not given a frame
  const sp = kitSpellFor(entity, s, gift);
  if (magic.readySpell?.(sp) === false) return 'refused';
  if (!magic.spellArmed?.()) return 'cast'; // a CasterOnly spell cast at the ready (DFU's SetReadySpell)
  return magic.interceptAttack?.(true, CAST_PRESS) === true ? 'cast' : 'refused';
}

/** What a cast of a made slot charges `entity` now - the cost the engine bills, armour and all. */
export const kitCastCost = (entity, slot) => calculateCastCost(kitSpellFor(entity, slot), entity).sp;

/**
 * The set and the menu on this page. `host()` answers the host's lets as it reads them now: the live link, the street's
 * cast engine, the mode, the party member pick (`pick(eye, dir, reach)`), the camera and its forward. `flag` is the flag
 * host (scenes/pvpFlagHost.js): `on()`, and `fightLeft()` the combat lock left.
 * @param {() => any[]} host @param {{ on: () => boolean, fightLeft?: () => number }} flag @param {any} entity
 * @param {{ doc?: Document | null, now?: () => number }} [o]
 */
export function createPvpSpellMenu(
  host,
  flag,
  entity,
  { doc = typeof document === 'undefined' ? null : document, now = Date.now } = {},
) {
  const lets = () => {
    try {
      return host() ?? [];
    } catch {
      return [];
    }
  }; // a let the host has not declared yet
  const active = () => {
    const [online, , mode] = lets();
    return !!online?.wildOk && flag.on() && (mode ?? 'exterior') === 'exterior';
  };
  const on = () => {
    try {
      return !!active();
    } catch {
      return false;
    }
  };
  const magic = () => lets()[1] ?? null;
  const allyAimed = (r) => {
    const [, , , pick, cam, fwd] = lets();
    try {
      return !!pick?.(cam?.pos, fwd?.(), r);
    } catch {
      return false;
    }
  };
  let store = /** @type {null | { set: any[], made: any[] }} */ (null),
    saved = '';
  let open = false,
    panel = /** @type {any} */ (null),
    release = /** @type {null | (() => boolean)} */ (null);
  let draft = kitSlotOf({ id: 'damage' }),
    note = '';
  let last = -1,
    castAt = -Infinity,
    recoverMs = 0;
  const costs = new Map(); // a slot's `id|pick` -> { at, sp }
  const inForce = () => on() || open;
  const lockLeft = () => {
    try {
      return Math.max(0, Number(flag.fightLeft?.()) || 0);
    } catch {
      return 0;
    }
  };
  const lockLine = () => (lockLeft() > 0 ? pvpSetLockLine(lockLeft()) : null);
  /** The store read once a set is first wanted (the normal set is the save's by then). */
  const ensure = () => {
    if (store) return;
    store = loadPvpStore(hotbarSetEntries('main'));
    restoreHotbarSet('pvp', store.set);
    keep();
  };
  const keep = () => {
    if (!store) return;
    store.set = hotbarSetEntries('pvp');
    const s = JSON.stringify(store);
    if (s !== saved) {
      saved = s;
      savePvpStore(store);
    }
  };
  /** The set in force: the PvP set while flagged in the zone or while the menu is open, else the normal set. */
  const sync = () => {
    const want = inForce();
    if (want) ensure();
    useHotbarSet(want ? 'pvp' : 'main');
    if (want) keep();
  };
  const press = (i, kit) => {
    const r = castKitSlot({ magic: magic(), entity, allyAimed }, kit);
    if (r === 'cast') {
      last = i;
      castAt = now();
      recoverMs = (CAST_RECOVER_S * 1000) / castRate(entity);
    }
    return r;
  };
  const costOf = (kit) => {
    const k = `${kit.id}|${kit.pick}`,
      c = costs.get(k),
      at = now();
    if (c && at - c.at < COST_TTL_MS) return c.sp;
    let sp = 0;
    try {
      sp = kitCastCost(entity, kit);
    } catch {
      sp = 0;
    }
    costs.set(k, { at, sp });
    return sp;
  };
  const marks = (v) => {
    if (v.empty) return lockLeft() > 0 ? { lock: true } : null;
    const kit = v.type === 'kit';
    const cost = kit ? costOf(v.kit) : 0;
    return pvpSlotMarks({
      kit,
      cost,
      magicka: entity?.magicka ?? 0,
      last: last === v.slot,
      castAt,
      recoverMs,
      now: now(),
      locked: lockLeft() > 0,
    });
  };

  // ── THE MENU ──
  const node = (tag, style = {}, text = null) => {
    const n = doc.createElement(tag);
    Object.assign(n.style, style);
    if (text != null) n.textContent = text;
    return n;
  };
  const button = (label, fn, chosen = false, disabled = false) => {
    const b = node(
      'button',
      {
        margin: '2px',
        padding: '2px 6px',
        font: '12px serif',
        background: chosen ? '#6b5a2e' : '#2a241c',
        color: '#e8dcc0',
        border: '1px solid #8a7246',
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? '0.5' : '1',
      },
      label,
    );
    b.type = 'button';
    b.disabled = disabled;
    b.addEventListener('click', fn);
    return b;
  };
  const icon = (n, size = 24) => {
    const img = node('img', { width: `${size}px`, height: `${size}px`, imageRendering: 'pixelated', flex: '0 0 auto' });
    const u = spellIconUrl(n);
    if (u) img.src = u;
    img.alt = '';
    img.draggable = false;
    return img;
  };
  const paintMenu = () => {
    if (!panel) return;
    panel.textContent = '';
    const locked = lockLeft() > 0;
    const head = node('div', {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: '4px',
    });
    head.append(
      node('strong', { font: 'bold 14px serif', color: '#e8b62c' }, t('pvp.set.title', 'PvP spells')),
      button(t('pvp.kit.close', 'Close'), () => close()),
    );
    panel.append(head);
    if (locked) {
      // the padlock, as the slots wear it
      const row = node('div', {
        margin: '6px 0 4px',
        color: '#f0b8ae',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
      });
      row.append(
        node('span', {
          width: '12px',
          height: '9px',
          background: '#c9b27a',
          borderRadius: '1px',
          boxShadow: '0 -5px 0 -2px #c9b27a',
          flex: '0 0 auto',
        }),
        node('span', {}, lockLine()),
      );
      panel.append(row);
    }
    // Make: the spell, its element or attribute, its icon
    const make = node('div', { borderBottom: '1px solid #5a4a2e', paddingBottom: '4px' });
    make.append(node('div', { margin: '2px 0' }, t('pvp.set.make', 'Make a spell')));
    const spells = node('div');
    for (const id of KIT_IDS)
      spells.append(
        button(
          kitBaseName(id),
          () => {
            draft = kitSlotOf({ id, icon: KIT_SPELLS[id].icon });
            paintMenu();
          },
          draft.id === id,
        ),
      );
    make.append(spells);
    const kind = KIT_SPELLS[draft.id].pick;
    if (kind) {
      const r = node(
        'div',
        { margin: '2px 0' },
        kind === 'element' ? t('pvp.kit.element', 'Element') : t('pvp.kit.attribute', 'Attribute'),
      );
      for (const p of kind === 'element' ? KIT_ELEMENTS : KIT_ATTRIBUTES) {
        r.append(
          button(
            kind === 'element' ? kitElementName(p) : kitAttributeName(p),
            () => {
              draft = kitSlotOf({ ...draft, pick: p });
              paintMenu();
            },
            draft.pick === p,
          ),
        );
      }
      make.append(r);
    }
    make.append(node('div', { margin: '2px 0' }, t('pvp.kit.icon', 'Icon')));
    const icons = node('div', { display: 'flex', flexWrap: 'wrap', maxHeight: '56px', overflowY: 'auto' });
    for (let n = 0; n < ICONS; n++) {
      const img = icon(n, 22);
      Object.assign(img.style, {
        margin: '1px',
        cursor: 'pointer',
        outline: n === draft.icon ? '2px solid #e8b62c' : '',
      });
      img.addEventListener('click', () => {
        draft = kitSlotOf({ ...draft, icon: n });
        paintMenu();
      });
      icons.append(img);
    }
    make.append(icons);
    make.append(
      button(`${t('pvp.set.makeIt', 'Make')}: ${kitSlotName(draft)}`, () => {
        const next = makeKit(store?.made ?? [], draft);
        note = next ? '' : t('pvp.set.full', 'Your list is full. Remove a spell first.');
        if (next && store) {
          store.made = next;
          keep();
        }
        paintMenu();
      }),
    );
    panel.append(make);
    // The made spells: drag one onto a slot, or click it and then a slot
    panel.append(node('div', { margin: '4px 0 2px' }, t('pvp.set.yours', 'Your spells')));
    const armed = hotbarArmedKit();
    (store?.made ?? []).forEach((s, i) => {
      const name = kitSlotName(s);
      const picked = !!armed && armed.kit.id === s.id && armed.kit.pick === s.pick && armed.kit.icon === s.icon;
      const row = node('div', {
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        padding: '2px 4px',
        cursor: locked ? 'default' : 'grab',
        touchAction: 'none',
        userSelect: 'none',
        background: picked ? '#4a3e22' : 'transparent',
        border: `1px solid ${picked ? '#e8b62c' : 'transparent'}`,
      });
      row.append(
        icon(s.icon),
        node('span', { flex: '1 1 auto' }, name),
        node('span', { color: '#cbbf9e', fontSize: '11px' }, kitCostLine(s.id)),
        node('span', { color: '#8fb4e8', fontSize: '11px' }, kitTag(s.id)),
      );
      const x = button('×', (e) => {
        e.stopPropagation();
        if (store) {
          store.made = unmakeKit(store.made, i);
          keep();
        }
        paintMenu();
      });
      x.title = t('pvp.set.remove', 'Remove');
      row.append(x);
      row.addEventListener('pointerdown', (e) => {
        if (locked || e.target === x) return;
        beginHotbarDrag(e, { kind: 'kit', kit: { ...s }, name }, { label: name, iconSrc: spellIconUrl(s.icon) });
      });
      row.addEventListener('click', () => {
        if (takeHotbarDragClick() || locked) return; // the release of a drag is not a pick
        armHotbarKit(picked ? null : { ...s }, name);
        note = picked ? '' : t('pvp.set.pick', 'Now click a slot on your hot bar.');
        paintMenu();
      });
      panel.append(row);
    });
    if (note) panel.append(node('div', { margin: '4px 0', color: '#e9d9b0' }, note));
  };
  const onEsc = (e) => {
    if (open && e.key === 'Escape') {
      e.preventDefault();
      e.stopImmediatePropagation();
      close();
    }
  };
  const openMenu = () => {
    if (!doc) return false;
    if (open) return true;
    open = true;
    sync();
    note = '';
    panel = node('div', {
      position: 'fixed',
      left: '50%',
      bottom: '150px',
      transform: 'translateX(-50%)',
      zIndex: '14',
      width: 'min(440px, calc(100vw - 32px))',
      maxHeight: '55vh',
      overflowY: 'auto',
      boxSizing: 'border-box',
      padding: '8px',
      background: '#1c1812ee',
      border: '2px solid #8a7246',
      color: '#e8dcc0',
      font: '13px serif',
    });
    panel.setAttribute('role', 'dialog');
    doc.body?.appendChild(panel);
    setHotbarDropMode(OWNER, true, entity);
    release = holdCursor();
    globalThis.addEventListener?.('keydown', onEsc, true);
    paintMenu();
    return true;
  };
  const close = () => {
    if (!open) return;
    open = false;
    armHotbarKit(null);
    panel?.remove();
    panel = null;
    setHotbarDropMode(OWNER, false);
    release?.();
    release = null;
    globalThis.removeEventListener?.('keydown', onEsc, true);
    sync();
  };

  /** The classic skin has no hotbar: there, keys whose slot holds a made spell cast it, and the rest stay the diamond's. */
  const onKey = (e) => {
    if (isEnhanced() || !on() || e.metaKey || isTextEntryTarget(e.target) || hostPaused() === true) return;
    const i =
      eventActions(e)
        .map((a) => HOTBAR_SLOT_ACTIONS.indexOf(a))
        .find((k) => k >= 0) ?? -1;
    if (i < 0) return;
    sync();
    if (hotbarEntry(i)?.type !== 'kit') return;
    e.preventDefault();
    e.stopImmediatePropagation();
    if (!e.repeat) hotbarPress(i, { entity });
  };

  forceHotbar(inForce);
  lockHotbarSet(() => lockLeft() > 0);
  setHotbarKitPress(press);
  setHotbarSecondSet({
    on: inForce,
    raised: () => open,
    lockLine,
    open: openMenu,
    changed: () => {
      note = '';
      paintMenu();
    },
    marks,
    label: () => t('pvp.set.title', 'PvP spells'),
    hint: () => t('pvp.set.hint', 'Drag a spell onto a slot. Drag a slot off the bar, or right-click it, to clear it.'),
    bookLine: () => t('pvp.set.book', 'Your PvP hot bar takes only your PvP spells and items.'),
  });
  if (doc) {
    globalThis.addEventListener?.('keydown', onKey, true);
    setInterval(() => {
      sync();
      if (open && panel) {
        const l = lockLeft() > 0;
        if (l !== panel._locked) {
          panel._locked = l;
          paintMenu();
        }
      }
    }, 250);
  }
  return {
    /** The cast engine's word on a spell (scenes/hostMagic.js spellRefusal): under the flag, the set's toolkit alone. */
    refusal: (sp) => kitRefusal(sp, on()),
    press,
    open: openMenu,
    close,
    sync,
    store: () => store,
  };
}
