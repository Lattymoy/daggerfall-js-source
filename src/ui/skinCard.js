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
// the Beholder's sixteen on-foot sets and five riders as the sprite
// itself, front on and standing, with the name the set is known by
// (systems/modSettings.js `labels`, the mod's own preset titles and the
// art's own rule), and the one worn marked. A player chooses a look by
// looking at it; "Thief Mage (female)" is a caption, not a choice.
//
// THE STORE IS THE MOD'S. Pressing a tile writes Graphics.OnFoot /
// Graphics.OnHorse - the two keys the body reads (player/eotbBody.js
// look()) and the look sends (net/remotePlayers.js ownEotbSet, the wire's
// `eo`) - so there is one choice and every reader agrees on it. A set
// pressed here is a CHOSEN set: the look carries it, where the mod's
// untouched default is never sent.
//
// AND THE SWITCH THE SKIN RIDES ON. With the mod off the player has no
// sprite body at all, so the card says so and offers the switch rather
// than laying out a grid that would change nothing.
//
// Not a DFU member: Daggerfall Unity has no profile and no skins. The
// sprites are the vendored mod's (vendor/eye-of-the-beholder).
// ═══════════════════════════════════════════════════════════════════

import { MOD_SETTINGS, modSetting, setModSetting, storedModSetting } from '../systems/modSettings.js';
import { spriteFor, eotbSpriteUrl } from '../player/eotbSprite.js';

const VENDOR = 'eye-of-the-beholder';
const FOOT = 'Graphics.OnFoot';
const HORSE = 'Graphics.OnHorse';

/** The front-on standing view: orientation 0 of the idle table (EOTB's wheel, the record offset 0, unmirrored). */
const FRONT = 0;

/**
 * The sets the card offers, each with its name and its picture's URL - the idle table's front frame for a set on
 * foot, the mounted idle's for a rider. Pure off the declarations and the bundle's own index, so node pins it.
 * `key` is the bundle's own name for the picture (`<archive>_<record>-<frame>`); `url` the built asset's, null outside
 * a browser build (eotbSprite.js's glob), where the tile says the name alone.
 * @returns {{foot: Array<{index:number, name:string, key:string|null, url:string|null}>, horse: Array<{index:number, name:string, key:string|null, url:string|null}>}}
 */
export function skinSets() {
  const keys = MOD_SETTINGS[VENDOR]?.keys ?? {};
  const of = (key, table, look) => (keys[key]?.labels ?? []).map((name, index) => {
    const s = spriteFor(table, FRONT, 0, look(index));
    return { index, name, key: s?.key ?? null, url: s ? eotbSpriteUrl(s.key) : null };
  });
  return { foot: of(FOOT, 'Idle', (i) => ({ onFoot: i })), horse: of(HORSE, 'IdleHorse', (i) => ({ onHorse: i })) };
}

/** What the card says the player is wearing: the set's index, and whether they ever chose it (the look sends only a
 *  chosen set - net/remotePlayers.js ownEotbSet). */
export function wornSkin() {
  return {
    foot: modSetting(VENDOR, FOOT), horse: modSetting(VENDOR, HORSE),
    chosen: storedModSetting(VENDOR, FOOT) !== undefined,
    on: modSetting(VENDOR, 'Enabled') === true,
  };
}

/**
 * The card. `doc` the document (the pins hand a fake); the card repaints itself on every press.
 * @param {Document} doc
 */
export function skinCard(doc) {
  const el = (t, cls, txt) => {
    const n = doc.createElement(t);
    if (cls) n.className = cls;
    if (txt != null) n.textContent = txt;
    return n;
  };
  const root = el('div', 'card skincard');

  function grid(label, sets, key, worn) {
    root.append(el('span', 'fieldlabel', label));
    const g = el('div', 'skingrid');
    g.setAttribute('role', 'group');
    g.setAttribute('aria-label', label);
    for (const s of sets) {
      const on = s.index === worn;
      const b = el('button', `skintile${on ? ' worn' : ''}`);
      b.type = 'button';
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
      b.title = on ? `Wearing ${s.name}` : `Wear ${s.name}`;
      if (s.url) {
        const img = el('img', 'skinart');
        img.src = s.url;
        img.alt = '';
        img.setAttribute('draggable', 'false');
        b.append(img);
      }
      b.append(el('span', 'skinname', s.name));
      b.onclick = () => { setModSetting(VENDOR, key, s.index); paint(); };
      g.append(b);
    }
    root.append(g);
  }

  function paint() {
    root.textContent = '';
    root.append(el('h3', null, 'Skin'));
    const w = wornSkin();
    const sets = skinSets();
    if (!w.on) {
      root.append(el('p', 'meta', 'Your third-person look is Eye of the Beholder’s. It is off, so you have no sprite body to dress.'));
      const acts = el('div', 'acts');
      const b = el('button', 'act primary', 'Turn it on');
      b.type = 'button';
      b.onclick = () => { setModSetting(VENDOR, 'Enabled', true); paint(); };
      acts.append(b);
      root.append(acts);
      return;
    }
    root.append(el('p', 'meta', 'How you look in third person, and to other players online who do not see you in a Morrowind body.'));
    // the look sends only a CHOSEN set, so until one is pressed the others see this player's class
    if (!w.chosen) root.append(el('p', 'meta skinhint', 'Until you choose one, other players see you as your class.'));
    grid('On foot', sets.foot, FOOT, w.foot);
    grid('Mounted', sets.horse, HORSE, w.horse);
  }

  paint();
  return { root, paint };
}
