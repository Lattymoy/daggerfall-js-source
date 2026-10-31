// @ts-check
// PROFILE-SLOTS (2026-10-28, the owner: "a detailed character slot section ... an actual preview of either your
// morrowind/sprite"; bible/04-Characters/Aura-Armory.md section 10) - THE CHARACTER on the signed-in profile: its stage
// (render/characterStage.js, its body and plate as the world draws them) between its slots - the armory's five, the
// aura, the plate over the head and the portrait. A slot pressed opens its picker; a choice pointed at is TRIED ON the
// stage, pressed is worn through the account flow's own doors. The canvas and stage outlive the card's repaints. The
// stage, bodies and catalogue come in from enhancedMenu.js, so the card's module stays light. Not a DFU member.
import { t } from '../systems/textManager.js';
import { TITLE_TEXT, AURA_TEXT, badgeClass, glyphBadges, glyphArtNode } from './playerBadge.js';
import { setTitleFlame } from './titleFlame.js';
import { profileIconNode, ICON_TEXT } from './profileIcons.js';
import {
  ARMORY_SLOTS,
  ARMORY_PIECES,
  ARMORY_LINES,
  armoryPieceOf,
  armoryKitPieces,
  armoryKitWith,
  armoryLineKit,
} from '../net/armoryLaw.js';
import { armoryPieceName, armorySlotName, armoryLineName, ARMORY_LOOK } from './armoryText.js';
import { namePlateNode } from './namePlate.js';

/** THE SLOTS, in the stage's two columns: the body's five down the left, head to foot; over the head, the weapon, the
 *  portrait and the aura at the feet down the right. */
export const CHARACTER_SLOTS = Object.freeze([
  ...ARMORY_SLOTS.filter((s) => s !== 'weapon').map((s) => Object.freeze({ id: s, side: 'left', armory: s })),
  Object.freeze({ id: 'plate', side: 'right', armory: null }),
  Object.freeze({ id: 'weapon', side: 'right', armory: 'weapon' }),
  Object.freeze({ id: 'icon', side: 'right', armory: null }),
  Object.freeze({ id: 'aura', side: 'right', armory: null }),
]);
/** The stage's picture size when it is a Morrowind body (combat/fpArm.js stage()), in pixels - its canvas's shape. */
export const SLOTS_STAGE_PX = Object.freeze({ width: 300, height: 400 });

/** A class list of the parts given (false and empty left out). Pure. */
const cls = (/** @type {Array<string|false|null|undefined>} */ ...parts) => parts.filter(Boolean).join(' ');

const SLOT_TEXT = Object.freeze({
  plate: () => t('account.slots.plate', 'Over the head'),
  aura: () => t('account.wear.aura', 'Aura'),
  icon: () => t('account.slots.icon', 'Portrait'),
});
/** A slot's name in the player's words. */
export const characterSlotName = (/** @type {string} */ id) =>
  SLOT_TEXT[/** @type {keyof typeof SLOT_TEXT} */ (id)]?.() ?? armorySlotName(id);

/** What a wardrobe WEARS in a slot, as the tile says it: `{ word, key, kind }` - nothing worn, `key` null. Pure. */
export function slotWorn(/** @type {any} */ w, /** @type {string} */ id) {
  if (id === 'plate') {
    const k = typeof w?.title === 'string' && w.title ? w.title : null;
    return { kind: 'title', key: k, word: k ? (TITLE_TEXT[/** @type {keyof typeof TITLE_TEXT} */ (k)] ?? k) : null };
  }
  if (id === 'aura') {
    const k = typeof w?.aura === 'string' && w.aura ? w.aura : null;
    return { kind: 'aura', key: k, word: k ? (AURA_TEXT[/** @type {keyof typeof AURA_TEXT} */ (k)] ?? k) : null };
  }
  if (id === 'icon') {
    const k = typeof w?.icon === 'string' && w.icon ? w.icon : null;
    return { kind: 'icon', key: k, word: k ? (ICON_TEXT[/** @type {keyof typeof ICON_TEXT} */ (k)] ?? k) : null };
  }
  const k = armoryKitPieces(w?.armory)[id] ?? null;
  return { kind: 'armory', key: k, word: k ? armoryPieceName(k) : null };
}

/** The wardrobe as the stage shows it with `trial` tried on (`{ slot, key }`, key null to bare the slot; a glyph toggled
 *  as `{ slot: 'glyph', key }`) - its kit, its aura, and the plate's title and glyphs. Pure. */
export function slotsShown(/** @type {any} */ w, /** @type {{ slot: string, key: string|null }|null} */ trial) {
  let kit = typeof w?.armory === 'string' ? w.armory : null,
    aura = w?.aura ?? null,
    title = w?.title ?? null;
  const off = Array.isArray(w?.glyphsOff) ? w.glyphsOff : [];
  let glyphs = (Array.isArray(w?.glyphs) ? w.glyphs : []).filter((g) => !off.includes(g));
  if (trial?.slot === 'aura') aura = trial.key;
  else if (trial?.slot === 'plate') title = trial.key;
  else if (trial?.slot === 'glyph' && trial.key)
    glyphs = glyphs.includes(trial.key) ? glyphs.filter((g) => g !== trial.key) : [...glyphs, trial.key];
  else if (trial?.slot === 'set') kit = trial.key;
  else if (trial && ARMORY_SLOTS.includes(trial.slot)) kit = armoryKitWith(kit, trial.slot, trial.key);
  return { kit, aura, title, glyphs };
}

/**
 * THE SECTION, kept for the card's life: `node()` built afresh at each paint round the one canvas, `dispose()` the
 * stage let go. In: the stage (`start`), the bodies, the catalogue (`entryOf`), the glyphs' words, the card's focus
 * memory (`keyedAs`), the plate's name and Renown (`who`) and its clearance in CSS px (`gap`, the world's NAME_GAP_PX).
 * @param {Document} doc @param {any} flow
 * @param {{ start?: ((canvas: any, o: any) => any)|null, bodies?: any, entryOf?: (kind: string, key: string) => any, glyphLabel?: Record<string, string>,
 *   keyedAs?: (n: any, key: string) => any, who?: () => { name?: string, lv?: number|null }, gap?: number }} [o]
 */
export function characterSlots(
  doc,
  flow,
  {
    start = null,
    bodies = null,
    entryOf = () => null,
    glyphLabel = {},
    keyedAs = (n) => n,
    who = () => ({}),
    gap = 0,
  } = {},
) {
  const el = (
    /** @type {string} */ tag,
    /** @type {string|null} */ cls = null,
    /** @type {string|null} */ txt = null,
  ) => {
    const n = doc.createElement(tag);
    if (cls) n.className = cls;
    if (txt != null) n.textContent = txt;
    return n;
  };
  let picked = 'head';
  /** @type {{ slot: string, key: string|null }|null} */
  let trial = null;
  let kind = null;
  /** @type {any} */
  let canvas = null,
    stage = null,
    plateHost = null,
    plateKey = '',
    raf = 0,
    alive = true;
  /** @type {Map<string, Promise<any>>} */
  const bodyOf = new Map();
  /** the look each kind's body was asked in (bodies.lookKey), and the frames since it was last read */
  const lookOf = new Map();
  let looked = 0;
  /** the choice last pressed - the card's repaint gives it the focus back, which tries nothing on */
  let lastPress = '';
  /** @type {any} */
  let lookLine = null;

  const ensureStage = () => {
    // a stage whose canvas left the page (the card's password or codes pages) stopped itself: a new one when it is back
    if (canvas && stage && stage.alive?.() === false) {
      canvas = null;
      stage = null;
      plateHost = null;
      plateKey = '';
      if (raf) globalThis.cancelAnimationFrame?.(raf);
      raf = 0;
    }
    if (canvas) return;
    canvas = el('canvas', 'slots-canvas');
    canvas.setAttribute?.('aria-hidden', 'true');
    canvas.width = SLOTS_STAGE_PX.width;
    canvas.height = SLOTS_STAGE_PX.height;
    plateHost = el('div', 'slots-platehost');
    plateHost.setAttribute?.('aria-hidden', 'true');
    if (typeof canvas.getContext !== 'function' || !start) return; // no canvas, or no stage handed in: the slots alone
    const ask = () => {
      const s = slotsShown(flow.wardrobe, trial);
      try {
        stage = start(canvas, { kit: s.kit, aura: s.aura });
      } catch {
        stage = null;
      }
      if (!stage) return;
      loadBody();
      const follow = () => {
        raf = 0;
        if (!alive || !stage || stage.alive?.() === false) return;
        if (++looked >= 30) {
          looked = 0;
          freshLook();
        }
        placePlate();
        raf = globalThis.requestAnimationFrame?.(follow) ?? 0;
      };
      follow();
    };
    // the stage starts once the canvas stands in the page - a canvas off the page stops its own clock
    globalThis.requestAnimationFrame
      ? globalThis.requestAnimationFrame(() => {
          if (alive) ask();
        })
      : ask();
  };
  /** The body of the kind chosen (the world's first where none is), asked once a kind and taken in as it lands. */
  function loadBody() {
    const kinds = bodies?.kinds?.() ?? [];
    if (!kinds.length) return;
    if (!kinds.includes(kind)) kind = kinds[0];
    const k = kind;
    if (!bodyOf.has(k)) {
      lookOf.set(k, bodies.lookKey?.(k) ?? '');
      bodyOf.set(
        k,
        Promise.resolve(bodies.of(k, SLOTS_STAGE_PX)).catch(() => null),
      );
    }
    const asked = bodyOf.get(k),
      st = stage;
    asked?.then((b) => {
      if (alive && stage === st && kind === k && bodyOf.get(k) === asked) stage.setBody(b);
    });
  }
  /** The body asked again when its look changed beside it (the skin card, in the same window): read a few times a second. */
  function freshLook() {
    const k = kind,
      now = k ? bodies?.lookKey?.(k) : undefined;
    if (k && now !== undefined && bodyOf.has(k) && now !== lookOf.get(k)) {
      bodyOf.delete(k);
      loadBody();
    }
  }
  /** The plate over the head as the world stands it (nameLayer.js): its bottom `gap` over the head point the stage
   *  answers, the world's own label, redrawn when it changes. */
  function placePlate() {
    if (!plateHost || !stage) return;
    const s = slotsShown(flow.wardrobe, trial),
      me = who() ?? {};
    const key = `${s.title}|${s.glyphs.join(',')}|${me.name ?? ''}|${me.lv ?? ''}`;
    if (key !== plateKey) {
      plateKey = key;
      plateHost.textContent = '';
      plateHost.append(
        namePlateNode(doc, { title: s.title, glyphs: s.glyphs, name: me.name ?? '', lv: me.lv ?? null }),
      );
    }
    const at = stage.headAt();
    const node = plateHost.firstChild;
    if (node?.style)
      node.style.transform = at
        ? `translate(${Math.round(at.x)}px, ${Math.round(at.y - gap)}px) translate(-50%, -100%)`
        : 'translate(-9999px, 0)';
  }
  /** The stage told what the wardrobe wears with the trial on it. */
  function show() {
    const s = slotsShown(flow.wardrobe, trial);
    stage?.setKit(s.kit);
    stage?.setAura(s.aura);
    plateKey = '';
    if (lookLine) lookLine.textContent = lookText();
  }
  const tryOn = (/** @type {{ slot: string, key: string|null }|null} */ next) => {
    trial = next;
    show();
  };

  /** A slot's tile: its name, what it wears in that thing's own paint, pressed to open its picker. */
  function tile(/** @type {{ id: string, armory: string|null }} */ s) {
    const w = flow.wardrobe,
      worn = slotWorn(w, s.id);
    const line = worn.kind === 'armory' && worn.key ? armoryPieceOf(worn.key)?.line : null;
    const paint =
      worn.kind === 'title' && worn.key
        ? cls('acttitle', badgeClass('tl', worn.key))
        : worn.kind === 'aura' && worn.key
          ? cls('acttitle', 'actaura', badgeClass('aura', worn.key))
          : line
            ? cls('acttitle', 'actaura', badgeClass('aura', line))
            : '';
    const b = keyedAs(
      el('button', cls('slottile', paint, picked === s.id && 'on', !worn.key && 'empty')),
      `slot:${s.id}`,
    );
    b.type = 'button';
    b.setAttribute?.('aria-pressed', picked === s.id ? 'true' : 'false');
    b.append(el('span', 'slotname', characterSlotName(s.id)));
    const word = el(
      'span',
      cls('slotworn', worn.kind === 'title' ? 'acttitleword' : paint && 'actauraword'),
      worn.word ?? t('account.slots.none', 'None'),
    );
    if (worn.kind === 'title' && worn.key) setTitleFlame(word, worn.key);
    if (worn.kind === 'icon' && worn.key) {
      const art = profileIconNode(doc, worn.key, 'sloticon', 18, { arms: null });
      if (art) {
        art.setAttribute?.('aria-hidden', 'true');
        b.append(art);
      }
    } // AUDIT GUILD-SHOP C6: a slot's Guild Crest is no one guild's - the plain shield
    b.append(word);
    if (s.id === 'plate') {
      const run = el('span', 'slotglyphs');
      for (const g of glyphBadges({ glyphs: slotsShown(w, null).glyphs })) {
        const chip = el('span', cls('acctglyph', badgeClass('gl', g.key)));
        const svg = glyphArtNode(doc, g, 'acctglyphart', 1.6);
        if (svg) {
          chip.append(svg);
          run.append(chip);
        }
      }
      if (run.children?.length) b.append(run);
    }
    b.title = t('account.slots.open', '{slot}: press to choose', { slot: characterSlotName(s.id) });
    b.onclick = () => {
      picked = s.id;
      trial = null;
      show();
      repaint();
    };
    return b;
  }

  let repaint = () => {};
  /** One choice in the picker: pressed, worn through the flow; pointed at or focused, tried on. */
  function choice(
    /** @type {any} */ b,
    /** @type {{ slot: string, key: string|null }} */ on,
    /** @type {() => any} */ wear,
    locked = false,
  ) {
    b.type = 'button';
    b.disabled = !!flow.busy && !locked;
    b.onpointerenter = () => tryOn(on);
    const keyOf = () => b.acctKey ?? `${on.slot}:${on.key}`;
    b.onfocus = () => {
      if (keyOf() === lastPress) {
        lastPress = '';
        return;
      }
      tryOn(on);
    }; // the card's repaint giving the press its focus back
    b.onpointerleave = () => {
      if (trial === on) tryOn(null);
    };
    b.onblur = () => {
      if (trial === on) tryOn(null);
    };
    b.onclick = () => {
      if (locked) {
        tryOn(on);
        return false;
      }
      trial = null;
      lastPress = keyOf();
      return wear();
    }; // the flow's answer, for whoever pressed
    return b;
  }
  /** The None at the head of a picker: the slot bared (the face, for the portrait). */
  function none(/** @type {string} */ slot, /** @type {boolean} */ worn, /** @type {() => any} */ wear) {
    const b = keyedAs(el('button', cls('acttitle', 'actnone', worn && 'worn')), `pick:${slot}:none`);
    b.append(
      el(
        'span',
        'acttitleword',
        slot === 'icon' ? t('account.slots.face', 'Your face') : t('account.slots.none', 'None'),
      ),
    );
    b.setAttribute?.('aria-pressed', worn ? 'true' : 'false');
    return choice(b, { slot, key: null }, wear);
  }
  /** What the picker says under its choices: the look of what is tried on, or how a piece not held is had. */
  function lookText() {
    const slot = trial?.slot ?? picked;
    const key = trial ? trial.key : slotWorn(flow.wardrobe, picked).key;
    if (!key) return t('account.slots.hint', 'Point at a choice to see it on you. Press it to wear it.');
    if (ARMORY_SLOTS.includes(slot)) {
      const look = ARMORY_LOOK[/** @type {keyof typeof ARMORY_LOOK} */ (key)]?.() ?? '';
      const held = (flow.wardrobe?.armoryHeld ?? []).includes(key);
      const where =
        slot === 'weapon' ? ` ${t('account.slots.weaponNote', 'It shows on the weapon in your hand.')}` : ''; // the weapon glow's (law 7), never the stage's
      return held ? `${look}${where}` : `${look}${where} ${entryOf('armory', key)?.how?.() ?? ''}`.trim();
    }
    if (slot === 'set') return t('account.slots.setLook', 'Every piece of the set at once.');
    if (slot === 'aura') return entryOf('aura', key)?.look?.() ?? '';
    return '';
  }

  /** THE PICKER of the slot pressed: every choice held, the one worn pressed - the wardrobe's own buttons. */
  function picker() {
    const w = flow.wardrobe ?? {};
    const box = el('div', 'acctwear slots-picker');
    const head = el('div', 'slots-pickhead');
    head.append(el('span', 'slots-pickname', characterSlotName(picked)));
    box.append(head);
    const row = el('div', 'acctwearrow');
    if (picked === 'plate') {
      box.append(el('span', 'fieldlabel', t('account.wear.title', 'Title')));
      const titles = Array.isArray(w.titles) ? w.titles : [];
      row.append(none('plate', !w.title, () => flow.equip(null)));
      for (const key of titles) {
        const worn = w.title === key;
        const b = keyedAs(el('button', cls('acttitle', badgeClass('tl', key), worn && 'worn')), `title:${key}`);
        const word = el('span', 'acttitleword', TITLE_TEXT[/** @type {keyof typeof TITLE_TEXT} */ (key)] ?? key);
        setTitleFlame(word, key); // SHOP: Genesis on its fire
        b.append(word);
        b.setAttribute?.('aria-pressed', worn ? 'true' : 'false');
        b.title = worn
          ? t('account.wear.worn', 'Worn. Press to take it off.')
          : t('account.wear.wear', 'Wear {name}', {
              name: TITLE_TEXT[/** @type {keyof typeof TITLE_TEXT} */ (key)] ?? key,
            });
        row.append(choice(b, { slot: 'plate', key }, () => flow.equip(key)));
      }
      box.append(row);
      const glyphs = glyphBadges(w);
      if (glyphs.length) {
        box.append(el('span', 'fieldlabel', t('account.wear.glyphs', 'Glyphs')));
        const grow = el('div', 'acctwearrow');
        const off = Array.isArray(w.glyphsOff) ? w.glyphsOff : [];
        for (const g of glyphs) {
          // GLYPH-WEAR: pressed off and on, full strength while shown, faded while hidden - true of the account either way
          const shown = !off.includes(g.key);
          const chip = keyedAs(
            el('button', cls('acctglyph', badgeClass('gl', g.key), shown && 'worn')),
            `glyph:${g.key}`,
          );
          chip.setAttribute?.('aria-pressed', shown ? 'true' : 'false');
          chip.title = shown
            ? t('account.wear.glyphShown', 'Shown. Press to hide it')
            : t('account.wear.glyphHidden', 'Hidden. Press to show it');
          const svg = glyphArtNode(doc, g, 'acctglyphart', 1.6);
          if (svg) chip.append(svg);
          chip.append(el('span', null, glyphLabel[g.key] ?? g.key));
          grow.append(choice(chip, { slot: 'glyph', key: g.key }, () => flow.toggleGlyph(g.key)));
        }
        box.append(grow);
      }
    } else if (picked === 'aura') {
      const auras = Array.isArray(w.auras) ? w.auras : [];
      row.append(none('aura', !w.aura, () => flow.wearAura(null)));
      for (const key of auras) {
        const worn = w.aura === key;
        const b = keyedAs(
          el('button', cls('acttitle', 'actaura', badgeClass('aura', key), worn && 'worn')),
          `aura:${key}`,
        );
        b.append(el('span', 'actauraword', AURA_TEXT[/** @type {keyof typeof AURA_TEXT} */ (key)] ?? key));
        b.setAttribute?.('aria-pressed', worn ? 'true' : 'false');
        b.title = worn
          ? t('account.wear.worn', 'Worn. Press to take it off.')
          : t('account.wear.wear', 'Wear {name}', {
              name: AURA_TEXT[/** @type {keyof typeof AURA_TEXT} */ (key)] ?? key,
            });
        row.append(choice(b, { slot: 'aura', key }, () => flow.wearAura(key)));
      }
      box.append(row);
    } else if (picked === 'icon') {
      const icons = Array.isArray(w.icons) ? w.icons : [];
      row.append(none('icon', !w.icon, () => flow.wearIcon(null)));
      for (const key of icons) {
        const worn = w.icon === key;
        const b = keyedAs(el('button', cls('acttitle', 'acticon', worn && 'worn')), `icon:${key}`);
        const art = profileIconNode(doc, key, 'acticonart', 22);
        if (art) {
          art.setAttribute?.('aria-hidden', 'true');
          b.append(art);
        }
        b.append(el('span', 'acticonword', ICON_TEXT[/** @type {keyof typeof ICON_TEXT} */ (key)] ?? key));
        b.setAttribute?.('aria-pressed', worn ? 'true' : 'false');
        row.append(choice(b, { slot: 'icon', key }, () => flow.wearIcon(key)));
      }
      box.append(row);
    } else {
      // ARMORY: the slot's pieces - held ones worn on a press, the rest tried on and told how they are had
      const held = Array.isArray(w.armoryHeld) ? w.armoryHeld : [];
      const worn = armoryKitPieces(w.armory)[picked] ?? null;
      row.append(none(picked, !worn, () => flow.wearArmory(picked, null)));
      for (const p of ARMORY_PIECES.filter((x) => x.slot === picked)) {
        const own = held.includes(p.key),
          on = worn === p.key;
        const b = keyedAs(
          el(
            'button',
            cls('acttitle', 'actaura', 'actarmory', badgeClass('aura', p.line), on && 'worn', !own && 'locked'),
          ),
          `armory:${p.key}`,
        );
        b.append(el('span', 'actauraword', armoryPieceName(p.key)));
        b.setAttribute?.('aria-pressed', on ? 'true' : 'false');
        if (!own) b.setAttribute?.('aria-disabled', 'true');
        b.title = !own
          ? t('account.slots.notHeld', 'Not yours yet. Point at it to try it on.')
          : on
            ? t('account.wear.worn', 'Worn. Press to take it off.')
            : t('account.wear.wear', 'Wear {name}', { name: armoryPieceName(p.key) });
        row.append(choice(b, { slot: picked, key: p.key }, () => flow.wearArmory(picked, p.key), !own));
      }
      box.append(row);
      // a line held whole: its every piece at once (the set's own door)
      const whole = ARMORY_LINES.filter((line) => {
        const of = ARMORY_PIECES.filter((p) => p.line === line);
        return of.length > 1 && of.every((p) => held.includes(p.key));
      }); // GUILD-SHOP: a line of one piece is no set
      if (whole.length) {
        const sets = el('div', 'acctwearrow slots-sets');
        for (const line of whole) {
          const kit = armoryLineKit(line),
            on = w.armory === kit;
          const b = keyedAs(
            el('button', cls('acttitle', 'actaura', badgeClass('aura', line), on && 'worn')),
            `set:${line}`,
          );
          b.append(
            el(
              'span',
              'actauraword',
              on
                ? t('account.slots.setOff', '{line}: take off the whole set', { line: armoryLineName(line) })
                : t('account.slots.setOn', '{line}: wear the whole set', { line: armoryLineName(line) }),
            ),
          );
          b.setAttribute?.('aria-pressed', on ? 'true' : 'false');
          sets.append(choice(b, { slot: 'set', key: on ? null : kit }, () => flow.wearArmoryKit(on ? null : kit)));
        }
        box.append(sets);
      }
    }
    lookLine = el('p', 'meta slots-look', lookText());
    box.append(lookLine);
    return box;
  }

  /** The stage's choice of body where there are two (the Morrowind body, the sprite). */
  function bodySwitch() {
    const kinds = bodies?.kinds?.() ?? [];
    if (kinds.length < 2) return null;
    if (!kinds.includes(kind)) kind = kinds[0];
    const row = el('div', 'slots-bodies');
    for (const k of kinds) {
      const b = keyedAs(el('button', cls('acttitle', kind === k && 'worn')), `body:${k}`);
      b.append(
        el(
          'span',
          'acttitleword',
          k === 'mw' ? t('account.slots.mw', 'Morrowind') : t('account.slots.sprite', 'Sprite'),
        ),
      );
      b.type = 'button';
      b.setAttribute?.('aria-pressed', kind === k ? 'true' : 'false');
      b.onclick = () => {
        kind = k;
        loadBody();
        repaint();
      };
      row.append(b);
    }
    return row;
  }

  return {
    /** The section, built afresh around the one canvas. `paint` asks the card to draw again (a slot pressed). */
    node(/** @type {() => void} */ paint = () => {}) {
      repaint = paint;
      ensureStage();
      const sec = el('section', 'acctsec acctslots');
      sec.append(el('h4', 'acctsechead', t('account.slots.head', 'Character')));
      const grid = el('div', 'slots-stage');
      const col = (/** @type {string} */ side) => {
        const c = el('div', cls('slots-col', side === 'left' ? 'slots-left' : 'slots-right'));
        for (const s of CHARACTER_SLOTS.filter((x) => x.side === side)) c.append(tile(s));
        return c;
      };
      const mid = el('div', 'slots-mid'),
        fig = el('div', 'slots-figure');
      fig.append(canvas, plateHost);
      mid.append(fig);
      const sw = bodySwitch(); // under the stage, never over the ring at its feet
      if (sw) mid.append(sw);
      grid.append(col('left'), mid, col('right'));
      sec.append(grid, picker());
      plateKey = '';
      show();
      return sec;
    },
    /** The section's choices, for a pin: the slot open and what is tried on. */
    state: () => ({ picked, trial, kind }),
    dispose() {
      alive = false;
      if (raf) globalThis.cancelAnimationFrame?.(raf);
      stage?.stop?.();
      stage = null;
    },
  };
}
