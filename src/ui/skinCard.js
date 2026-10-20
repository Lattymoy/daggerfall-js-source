// @ts-check
// ═══════════════════════════════════════════════════════════════════
// DISC23-B2 — THE SKIN, ON THE PLAYER'S PROFILE.
//
// Mac (2026-09-24, over Gryphoth's and Scratchie's reports): "for the
// EoTB mod, I want to utilize it and make it a choosable skin system in
// the menu player profile system itself instead of it being hidden in
// the feature menu".
//
// WHO YOU ARE DRAWN AS is a fact about the player, not a feature of the
// game, so it sits on the profile window the door's profile mark opens -
// beside the account card and its wardrobe of titles - and not behind a
// Features tile's drawer. It is a PICKER OF PICTURES: every one of Eye of
// the Beholder's sixteen on-foot sets (and SKIN2's classes) and five riders as the sprite
// itself, front on and standing, with the name the set is known by
// (systems/modSettings.js `labels`, the mod's own preset titles and the
// art's own rule), and the one worn marked. A player chooses a look by
// looking at it; "Thief Mage (female)" is a caption, not a choice.
//
// THE STORE IS THE MOD'S. Pressing a tile writes Graphics.OnFoot /
// Graphics.OnHorse - the two keys the body reads (player/eyeOfTheBeholder/eotbBody.js
// look()) and the look sends (net/remotePlayers.js ownEotbSet, the wire's
// `eo`) - so there is one choice and every reader agrees on it. A set
// pressed here is a CHOSEN set: the look carries it, where the mod's
// untouched default is never sent.
//
// AND THE SWITCH THE SKIN RIDES ON. With the mod off the player has no
// sprite body at all, so the card says so and offers the switch rather
// than laying out a grid that would change nothing.
//
// SKIN2 (2026-09-25, Mac: "Reorganize the skin selector as 2 single
// panels for unmounted/mount that can be opened to view available
// skins"): with Daggerfall's twenty classes beside the mod's sixteen the
// grids had grown to fifty-seven pictures down the profile. The card is
// two panels now, ON FOOT and MOUNTED, each closed to the skin worn - its
// picture and its name, which is what the card is asked most - and
// opened on a press to the skins it offers (on foot, the mod's sets and
// the classes under their own headings). One opens at a time; choosing a
// skin wears it and closes the panel on it.
//
// LAYERED-GEAR (2026-10-18, the owner: "add a option between those two thats
// also called On foot Layered Gearing Skin (WIP) Female and Male"; 2026-10-19,
// merging it: "These need a proper toggle in the account profile for players
// to either equip skins or use this integration"): the card opens on a toggle,
// LOOK: SKINS | LAYERED GEARING (WIP). Skins is the two panels above. Layered
// Gearing draws the body on foot in the helmet, chest and leg armor it wears
// (player/eyeOfTheBeholder/layeredArmor.js), in the body chosen - Female or
// Male, two pictures - beside the Mounted panel: a rider has no layered art.
// The On foot panel is put away, as it is not what the player is drawn as on
// foot. Both write Graphics.LayeredGear (0 Skins, 1 female, 2 male, 3 the
// character's own body); the body reads it (eotbBody.js look()) and the look
// carries it (net/remotePlayers.js composeLook, `lg`). LAYERED-GEAR-ON (the
// owner: "Make sure this is on by default"): the default is 3, so the card
// opens on Layered Gearing in the character's own body until a body or Skins
// is chosen. Turned on again, it wears the body last chosen this session, else
// the character's own; turned off, the on-foot skin chosen before is worn
// again (bible/04-Characters/Layered-Gearing.md).
//
// Not a DFU member: Daggerfall Unity has no profile and no skins. The
// sprites are the vendored mod's (vendor/eye-of-the-beholder).
// ═══════════════════════════════════════════════════════════════════

import { MOD_SETTINGS, modSetting, setModSetting, storedModSetting } from '../systems/modSettings.js';
import { spriteFor, eotbSpriteUrl } from '../player/eyeOfTheBeholder/eotbSprite.js';
import { EOTB_FOOT_SET_COUNT } from '../player/classSkins.js';
import { layeredPreviewUrl, layeredGenderOf, LAYERED_OWN } from '../player/eyeOfTheBeholder/layeredArmor.js';   // LAYERED-GEAR
import { t } from '../systems/textManager.js';

const VENDOR = 'eye-of-the-beholder';
const FOOT = 'Graphics.OnFoot';
const HORSE = 'Graphics.OnHorse';
const LAYERED = 'Graphics.LayeredGear';   // LAYERED-GEAR: 0 off, 1 female, 2 male, LAYERED_OWN the character's own (the default)

/** LAYERED-GEAR: the body Layered Gearing was last worn in this session (1 female, 2 male; 0 none yet) - what turning
 *  it back on wears. */
let lastBody = 0;
/** The pins' reset: no body chosen yet this session. */
export function _resetSkinCardBody() { lastBody = 0; }
/** The choice turning Layered Gearing on writes: the body last chosen, else LAYERED_OWN - the character's own body,
 *  whichever character is played. */
export const layeredBodyToWear = () => lastBody || LAYERED_OWN;

/** The front-on standing view: orientation 0 of the idle table (EOTB's wheel, the record offset 0, unmirrored). */
const FRONT = 0;

/**
 * The sets the card offers, each with its name and its picture's URL - the idle table's front frame for a set on
 * foot, the mounted idle's for a rider. Pure off the declarations and the bundle's own index, so node pins it.
 * `key` is the bundle's own name for the picture (`<archive>_<record>-<frame>`); `url` the built asset's, null outside
 * a browser build (eotbSprite.js's glob), where the tile says the name alone.
 * LAYERED-GEAR: `layered` the setting's four - off, female, male, your own body - each body pictured in plain leather
 * (layeredArmor.js layeredPreviewUrl; off has no picture, and the card offers the two bodies).
 * @returns {{foot: Array<{index:number, name:string, key:string|null, url:string|null}>, horse: Array<{index:number, name:string, key:string|null, url:string|null}>, layered: Array<{index:number, name:string, key:string|null, url:string|null}>}}
 */
export function skinSets() {
  const keys = MOD_SETTINGS[VENDOR]?.keys ?? {};
  const of = (key, table, look) => (keys[key]?.labels ?? []).map((name, index) => {
    const s = spriteFor(table, FRONT, 0, look(index));
    return { index, name, key: s?.key ?? null, url: s ? eotbSpriteUrl(s.key) : null };
  });
  const layered = (keys[LAYERED]?.labels ?? []).map((name, index) => {
    const g = layeredGenderOf(index);
    return { index, name, key: null, url: g ? layeredPreviewUrl(g) : null };
  });
  return { foot: of(FOOT, 'Idle', (i) => ({ onFoot: i })), horse: of(HORSE, 'IdleHorse', (i) => ({ onHorse: i })), layered };
}

/** What the card says the player is wearing: the set's index, and whether they ever chose it (the look sends only a
 *  chosen set - net/remotePlayers.js ownEotbSet). */
export function wornSkin() {
  return {
    foot: modSetting(VENDOR, FOOT), horse: modSetting(VENDOR, HORSE), layered: modSetting(VENDOR, LAYERED) ?? 0,
    chosen: storedModSetting(VENDOR, FOOT) !== undefined,
    on: modSetting(VENDOR, 'Enabled') === true,
  };
}

/** SKIN2: the on-foot picker's two shelves - the mod's own sets, then Daggerfall's classes. */
export const FOOT_GROUPS = Object.freeze([
  Object.freeze({ label: 'Eye of the Beholder', from: 0, to: EOTB_FOOT_SET_COUNT }),
  Object.freeze({ label: 'Original classes', from: EOTB_FOOT_SET_COUNT, to: Infinity }),
]);

/**
 * The card. `doc` the document (the pins hand a fake); the card repaints itself on every press. SKIN2: two panels,
 * ON FOOT and MOUNTED, each closed to the one skin worn - its picture and its name - and opened on a press to the
 * skins it offers; one is open at a time, and a skin chosen closes it on the new one. `sets` the offer (skinSets; the
 * pins hand one with URLs, which only a browser build's glob has). LAYERED-GEAR: over them the Look toggle, and
 * `gender` the character's own body ('male' or 'female'; the menu hands playerEntity's), the one Layered Gearing
 * first wears.
 * @param {Document} doc
 * @param {{sets?: typeof skinSets, gender?: () => (string|null|undefined)}} [opts]
 */
export function skinCard(doc, { sets: offer = skinSets, gender = () => null } = {}) {
  const el = (t, cls, txt) => {
    const n = doc.createElement(t);
    if (cls) n.className = cls;
    if (txt != null) n.textContent = txt;
    return n;
  };
  const root = el('div', 'card skincard');
  /** The panel open, by its setting's key, or null - the card's own state, kept across repaints. */
  let open = null;

  const art = (s) => {
    const img = el('img', 'skinart');
    img.src = s.url;
    img.alt = '';
    img.setAttribute('draggable', 'false');
    return img;
  };

  function grid(label, sets, key, worn) {
    const g = el('div', 'skingrid');
    g.setAttribute('role', 'group');
    g.setAttribute('aria-label', label);
    for (const s of sets) {
      const on = s.index === worn;
      const b = el('button', `skintile${on ? ' worn' : ''}`);
      b.type = 'button';
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
      b.title = on ? `Wearing ${s.name}` : `Wear ${s.name}`;
      if (s.url) b.append(art(s));
      b.append(el('span', 'skinname', s.name));
      b.onclick = () => { setModSetting(VENDOR, key, s.index); open = null; paint(); };
      g.append(b);
    }
    return g;
  }

  function panel(label, key, sets, worn, groups, noun = `${label.toLowerCase()} skin`) {
    const isOpen = open === key;
    const p = el('div', `skinpanel${isOpen ? ' open' : ''}`);
    const head = el('button', 'skinhead');
    head.type = 'button';
    head.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    const wearing = sets.find((s) => s.index === worn) ?? null;
    head.title = isOpen ? `Close ${noun}s` : `Choose ${noun}`;
    if (wearing?.url) head.append(art(wearing));
    const words = el('span', 'skinheadtext');
    words.append(el('span', 'fieldlabel', label));
    words.append(el('span', 'skinname', wearing?.name ?? ''));
    head.append(words);
    head.append(el('span', 'skinchev', isOpen ? '\u25b4' : '\u25be'));
    head.onclick = () => { open = isOpen ? null : key; paint(); };
    p.append(head);
    if (isOpen) {
      const body = el('div', 'skinbody');
      for (const g of groups) {
        const mine = sets.filter((s) => s.index >= g.from && s.index < g.to);
        if (!mine.length) continue;
        if (g.label) body.append(el('span', 'skingroup', g.label));
        body.append(grid(g.label || label, mine, key, worn));
      }
      p.append(body);
    }
    root.append(p);
  }

  /** LAYERED-GEAR: the Look toggle - Skins or Layered Gearing, one radio each; a press switches the look at once. */
  function lookToggle(layeredOn) {
    const row = el('div', 'skinmode');
    const word = t('skin.look', 'Look');
    row.append(el('span', 'fieldlabel', word));
    const set = el('div', 'skinmodeset');
    set.setAttribute('role', 'radiogroup');
    set.setAttribute('aria-label', word);
    for (const [on, name] of [[false, t('skin.mode.skins', 'Skins')], [true, t('skin.mode.layered', 'Layered Gearing (WIP)')]]) {
      const chosen = on === layeredOn;
      const b = el('button', `skinmodebtn${chosen ? ' on' : ''}`, name);
      b.type = 'button';
      b.setAttribute('role', 'radio');
      b.setAttribute('aria-checked', chosen ? 'true' : 'false');
      b.onclick = () => {
        if (chosen) return;
        setModSetting(VENDOR, LAYERED, on ? layeredBodyToWear() : 0);
        open = null;
        paint();
      };
      set.append(b);
    }
    row.append(set);
    root.append(row);
  }

  function paint() {
    root.textContent = '';
    root.append(el('h3', null, 'Skin'));
    const w = wornSkin();
    const sets = offer();
    if (!w.on) {
      root.append(el('p', 'meta', 'Your third-person look comes from Eye of the Beholder, which is off. Turn it on to choose a skin.'));
      const acts = el('div', 'acts');
      const b = el('button', 'act primary', 'Turn it on');
      b.type = 'button';
      b.onclick = () => { setModSetting(VENDOR, 'Enabled', true); paint(); };
      acts.append(b);
      root.append(acts);
      return;
    }
    root.append(el('p', 'meta', 'How you look in third person, and to other players who don\u2019t see you in a Morrowind body.'));
    const layeredOn = w.layered > 0;
    const own = w.layered === LAYERED_OWN;
    if (w.layered === 1 || w.layered === 2) lastBody = w.layered;
    lookToggle(layeredOn);
    if (layeredOn) {
      // LAYERED-GEAR: the body, drawn in the armor worn - the On foot panel put away, Mounted as ever
      root.append(el('p', 'meta', t('skin.layered.about', 'On foot you are drawn in the helmet, chest and leg armor you wear. On a horse you are drawn in your mounted skin.')));
      const bodyWord = t('skin.layered.body', 'Body');
      root.append(el('span', 'skingroup', bodyWord));
      // LAYERED-GEAR-ON: the character's own body marks the tile it is; a tile pressed is that body from then on
      const worn = own ? (layeredGenderOf(LAYERED_OWN, gender()) === 'female' ? 1 : 2) : w.layered;
      root.append(grid(bodyWord, (sets.layered ?? []).filter((s) => s.index === 1 || s.index === 2), LAYERED, worn));
      if (own) root.append(el('p', 'meta skinhint', t('skin.layered.own', 'Your character\'s own body, until you choose one.')));
    } else {
      // the look sends only a CHOSEN set, so until one is pressed the others see this player's class
      if (!w.chosen) root.append(el('p', 'meta skinhint', 'Until you choose one, other players see you as your class.'));
      panel('On foot', FOOT, sets.foot, w.foot, FOOT_GROUPS);
    }
    panel('Mounted', HORSE, sets.horse, w.horse, [{ label: '', from: 0, to: Infinity }]);
  }

  paint();
  return { root, paint };
}
