// @ts-check
// ═══════════════════════════════════════════════════════════════════
// ACC1e — THE ACCOUNT CARD, DRAWN.
//
// Mac: "please be detailed and match the enhanced aesthetic".
//
// THIS FILE DECIDES NOTHING. Every stage, every field, every refusal
// and every rule about what may be pressed lives in ui/accountFlow.js,
// which node can drive; this walks what the flow says and makes DOM
// out of it. That split is `ChargenFlow` / `enhancedChargen.js` again,
// and it is the reason an account screen can be tested at all.
//
// ═══ IT BORROWS THE SKIN RATHER THAN BRINGING ONE ══════════════════
//
// `.card`, `.tag`, `.acts`, `.act`, `.act.primary`, `label.field`,
// `.fieldlabel` - every one of these already exists and is already
// worn by the Online pane this card sits in. ONLINE1 built the two
// fields beside it; NAME-F2 built the `.bad` border and the reason
// under a refused field. Nothing here is a new design language, which
// is the whole point: enhancedStyle.js's own header says two copies of
// a design language is how the front door and the rooms behind it
// drift apart.
//
// THE THREE THINGS IT DOES ADD are in enhancedStyle.js beside the
// vocabulary they extend, not in a <style> here: the recovery code's
// plaque, the refusal line, and the signed-in fact list.
// ═══════════════════════════════════════════════════════════════════

import { STAGES, FIELDS, FIELD_SPEC, AGREEMENTS, AGREEMENT_SPEC, recoveryCodesText, recoveryCodesFileName } from '../accountFlow.js';   // RECOVERY-SET: the codes as the saved file says them
import { profileIconNode, ICON_TEXT } from '../profileIcons.js';   // WITCH1: the profile icons, worn in the portrait well
import { TITLE_TEXT, AURA_TEXT, glyphBadges, glyphArtNode, badgeClass } from '../playerBadge.js';   // ACC3c: the SAME table the name over a head reads, so the picker shows what a player will actually wear - the COLOUR is the skin's (this card may not style itself, and a pin holds that)
import { duelRecordText } from '../../net/duel/duelRecord.js';   // DUEL1: the account card's K/D row
import { renownText, renownProgressText, renownProgress } from '../../net/renown.js';   // RENOWN1: Renown, left of the name and in its rows
import { gateRecordText } from '../../net/gate/gateClaims.js';   // WB5b: and its gates-closed row
import { marksText } from '../../net/marksLaw.js';   // MARKS1: and its Marks row
import { raidRecordText } from '../../net/raid/raidClaims.js';   // RAID4: and its towns-defended row
import { t, localizedTable, intlLocale } from '../../systems/textManager.js';   // L10N4: the card's words in the player's language, read when it is drawn
import { serpentRecordText } from '../../net/serpent/serpentClaims.js';   // AUDIT SERPENT D4: and its serpents-slain row
import { sdRecordText } from '../../net/superDungeon/sdClaims.js';   // SD9b: and its Hours-broken row
import { ketchRecordText } from '../../net/ketch/ketchClaims.js';   // KETCH: and its voyages-sailed row
import { starRecordText } from '../../net/starfall/starClaims.js';   // STAR7: and its stars-held row

/** RENOWN-CHAR (Mac: "Can we make renown per character again"): the card's Renown tracks as the service sends them -
 *  its characters', the most recently played first - or none: none earned yet, or a service from RENOWN-ACCOUNT's day
 *  (which sent the account's one, `{ xp, level }`, not a list - no character's Renown, so none is drawn). */
export function renownTracksOfCard(r) {
  return Array.isArray(r) ? r.filter((t) => renownText(t?.level) && Number.isSafeInteger(t?.xp) && t.xp >= 0) : [];
}

/** NAME-AS: the two names the room may read, in the order the toggle draws them - the account's, then the character's. */
export const NAME_AS_CHOICES = Object.freeze([['account', 'Account name'], ['character', 'Character name']]);

/** COPY LIVES IN ONE TABLE, so a stage cannot be drawn with a heading
 *  from one slice and a paragraph from another. Keyed by stage, and a
 *  pin asserts every stage has an entry - a stage added without one
 *  would draw a card with no words on it. */
/** ACC3c: what a glyph is CALLED on the card. The name over a head is
 *  a picture and needs no word; a wardrobe is a list of things a player
 *  holds, and a coloured shape with nothing beside it is a list nobody
 *  can read. A pin walks GLYPHS and requires an entry. */
export const GLYPH_LABEL = localizedTable({   // L10N4: each word a getter, read when the wardrobe is drawn
  sprout: () => t('account.glyph.sprout', 'New account'),
  dev: () => t('account.glyph.dev', 'Developer'),
  mod: () => t('account.glyph.mod', 'Moderator'),
  dm: () => t('account.glyph.dm', 'Dungeon Master'),   // TITLE-N: the die beside the Dungeon Master's name
  disciple: () => t('account.glyph.disciple', 'Disciple'),   // TITLE-N: the Patreon tiers' marks, each its title's word
  apostle: () => t('account.glyph.apostle', 'Apostle'),
  hierophant: () => t('account.glyph.hierophant', 'Hierophant'),
  shadowfang: () => t('account.glyph.shadowfang', 'Shadow Fang'),   // SHADOW-FANG: the wolf's head beside SirMcMobdon's name
  penitent: () => t('account.glyph.penitent', 'Penitent'),   // PENITENT: the sword in its lozenge beside Diggleborf's name
  herald: () => t('account.glyph.herald', 'Herald'),   // HERALD: the herald's trumpet and its banner
  tower: () => t('account.glyph.tower', 'A seat\'s Charter'),   // SEAT1c: the tower of a guild holding a palace seat
  crownDF: () => t('account.glyph.crownDF', 'The Crown of Daggerfall'),   // SEAT1c: a crown seat's crown, its kingdom's
  crownWR: () => t('account.glyph.crownWR', 'The Crown of Wayrest'),
  crownSN: () => t('account.glyph.crownSN', 'The Crown of Sentinel'),
  laurel: () => t('account.glyph.laurel', 'Arena Champion'),   // ARENA4: the laurel, while its wearer is the season's #1
  aegis: () => t('account.glyph.aegis', 'Aegis of Oblivion'),   // AEGIS: the pillars through the ring over the void, beside Sureme's name
  primarch: () => t('account.glyph.primarch', 'Primarch'),   // PRIMARCH: the three-barred cross, beside GA00250's name
  crystalfist: () => t('account.glyph.crystalfist', 'Crystal Fist'),   // CRYSTAL-FIST: the three slashes, beside Flylighter's name
  wikimaid: () => t('account.glyph.wikimaid', 'WikiMaid'),   // WIKIMAID: the rabbit in its maid's headdress, beside SylviaBun's name
});

/** ACC4: THE TWO FACTS MAC ASKED FOR, as words. Pure, so node pins
 *  them. The date is the player's LOCAL day - an account made late on
 *  the 21st in California was made on the 21st to its player, whatever
 *  UTC says - and the month is a word, because 09/10 is two different
 *  days on two sides of an ocean. Null for no date: a guest has not
 *  registered, and 0 would print 1970.
 *  L10N4: in the player's language's own order and month words (Intl's), which in English is the "Sep 21, 2026" this
 *  wrote out by hand. */
export function registeredText(s) {
  if (!Number.isSafeInteger(s) || s <= 0) return null;
  const d = new Date(s * 1000);
  return new Intl.DateTimeFormat(intlLocale(), { month: 'short', day: 'numeric', year: 'numeric' }).format(d);
}
/** Hours and minutes, and never seconds: the service counts in beats
 *  of five minutes (net/playClock.js), so a seconds figure would claim
 *  a precision nothing measured. Under an hour reads in minutes alone. */
export function playedText(s) {
  const m = Math.floor((Number.isFinite(s) && s > 0 ? s : 0) / 60);
  const h = Math.floor(m / 60);
  return h ? t('account.card.playedHours', '{h}h {m}m', { h, m: m % 60 }) : t('account.card.playedMinutes', '{m}m', { m });
}

/** The tag most stages wear - the card draws a stage's tag only where it is not this one (L10N4: compared as the player
 *  reads it, so it holds in every language). */
const ACCOUNT_TAG = 'Account';
const accountTag = () => t('account.card.tag', ACCOUNT_TAG);

export const STAGE_COPY = Object.freeze({   // L10N4: the words are getters, read when the card is drawn
  // THE BLURBS WERE CUT (Mac: "there's uneeded text explaining what an
  // account is"). A sign-in window is not a place to be taught what an
  // account is - the two buttons say it. What survives is only what a
  // player CANNOT guess and would be hurt by not knowing: that recovery
  // signs every device out, and that the codes are shown once.
  loading: { get tag() { return accountTag(); }, get title() { return t('account.card.title.loading', 'One moment'); }, blurb: '' },
  out: { get tag() { return accountTag(); }, get title() { return t('account.card.title.out', 'Your account'); }, blurb: '' },
  register: { get tag() { return accountTag(); }, get title() { return t('account.card.title.register', 'Create an account'); }, blurb: '' },
  login: { get tag() { return accountTag(); }, get title() { return t('account.card.title.login', 'Sign in'); }, blurb: '' },
  recover: {
    get tag() { return accountTag(); },
    get title() { return t('account.card.title.recover', 'Use your recovery code'); },
    // KEPT: this signs every device out, including the one being used.
    // A player who did not expect that has lost their other sessions.
    get blurb() { return t('account.card.blurb.recover', 'This signs every device out, including this one.'); },
  },
  code: {
    get tag() { return t('account.card.tag.code', 'Write these down'); },
    get title() { return t('account.card.title.code', 'Your recovery codes'); },
    // KEPT, and it is the only long line left on the card. Email is
    // optional, so these codes ARE the reset - a player who closes this
    // without writing them down has a forgotten password away from
    // losing the account. RECOVERY-SET: and the way to more is named,
    // because "only time" is no longer the whole truth.
    get blurb() { return t('account.card.blurb.code', 'These codes are shown only now. Each works once if you forget your password. You can make new ones from your profile.'); },
  },
  in: { get tag() { return accountTag(); }, get title() { return t('account.card.title.in', 'Signed in'); }, blurb: '' },
  password: {
    get tag() { return accountTag(); },
    get title() { return t('account.card.title.password', 'Change your password'); },
    // KEPT: same reason as recovery - an unexpected sign-out elsewhere.
    get blurb() { return t('account.card.blurb.password', 'Every other device will be signed out.'); },
  },
  // RECOVERY-SET: a new set from the profile - the one thing a player must know before pressing it
  codes: {
    get tag() { return accountTag(); },
    get title() { return t('account.card.title.codes', 'New recovery codes'); },
    // AUDIT RECOVERY-SET A1: a code the new set replaces is asked for too, and the card says so before the box does
    get blurb() { return t('account.card.blurb.codes', 'Type your password and one of your current recovery codes. Those codes will stop working.'); },
  },
});

/** The button each stage submits with, and what the card offers beside
 *  it. Derived per stage rather than written at the call site, so a
 *  stage cannot end up with two primary buttons or none. */
export const STAGE_ACTS = Object.freeze({   // L10N4: the button's word a getter, read when it is drawn
  register: { get submit() { return t('account.card.act.createAccount', 'Create account'); }, back: 'out' },
  login: { get submit() { return t('account.card.act.signIn', 'Sign in'); }, back: 'out' },
  recover: { get submit() { return t('account.card.act.setPassword', 'Set a new password'); }, back: 'login' },
  password: { get submit() { return t('account.card.act.changePassword', 'Change password'); }, back: 'in' },
  codes: { get submit() { return t('account.card.act.makeCodes', 'Make new codes'); }, back: 'in' },   // RECOVERY-SET
});

/**
 * Build the card. Returns the element; call `paint()` to redraw it.
 *
 * @param {Document} doc
 * @param {ReturnType<typeof import('../accountFlow.js').AccountFlow>} flow
 */
export function accountCard(doc, flow, { onClose = null, face = null, character = null } = {}) {
  const el = (t, cls, txt) => {
    const n = doc.createElement(t);
    if (cls) n.className = cls;
    if (txt != null) n.textContent = txt;
    return n;
  };

  const root = el('div', 'card acct');

  /**
   * AUDIT TERMS1 T3 — THE KEYBOARD SURVIVES A REDRAW. paint() builds the
   * card anew, and a control built anew is one the keyboard is no longer
   * on. A refusal is cleared by the first keystroke or tick that answers
   * it (flow.set, flow.agree), and that repaint came under the player's
   * fingers: after "Type your username" the rest of "Nystul" went nowhere
   * but its N, and a Space on the Terms box - the one answer its refusal
   * has - left the next Tab on Username. So every control is built under
   * a name (`keyed`), and the one that held the focus, with its caret, is
   * found again under that name. One the redraw disabled (a button while
   * its press is out) is kept in mind, and handed the focus back when the
   * card that follows has it again, if the player has not moved it.
   */
  let keyed = new Map();
  let wanted = null;   // { key, stage, caret } - the control the focus goes back to, on a card of that stage
  let painted = null;  // the stage the card on screen was built for
  const keyedAs = (n, key) => { n.acctKey = key; keyed.set(key, n); return n; };
  /** PROFILE-MENU: where a section's boxes land - the card itself, or the section being built. */
  let host = root;

  /**
   * PROFILE-MENU - THE PORTRAIT, the one the corner mark wears (ui/profileBadge.js): the face of the character last
   * played, handed in by the door as it hands the mark its own (`face`, loadFace's promise of a canvas), in a round well.
   * A hooded silhouette stands until the face lands, and for good with none - the mark's own NEVER TRAPS. The face is
   * drawn ONCE per card: a repaint moves the same canvas into the new well, never asks for another.
   */
  let faceArt = null;
  // AUDIT PROFILE-MENU P7: ONE SHAPE, the one the producer mints - loadFace is async, so the door hands a promise; a
  // canvas handed bare was a branch nothing in the game could reach
  if (face && typeof (/** @type {any} */ (face).then) === 'function') {
    /** @type {Promise<any>} */ (face).then((art) => { if (art) { faceArt = art; if (flow.stage === 'in') paint(); } }).catch(() => {});
  }
  function portrait() {
    // WITCH1: a profile icon worn stands in the well in the face's place (ui/profileIcons.js), the face kept for when it is
    // taken off
    const icon = typeof flow.wardrobe?.icon === 'string' ? profileIconNode(doc, flow.wardrobe.icon, 'accticon') : null;
    const well = el('div', icon || faceArt ? 'acctportrait hasface' : 'acctportrait');
    well.setAttribute?.('aria-hidden', 'true');
    well.append(icon ?? faceArt ?? el('span', 'acctsilhouette'));
    return well;
  }

  /**
   * PROFILE-MENU - UNDER THE NAME, WHAT IT WEARS AND WHO IT PLAYS: the title worn, in the colour it wears over a head
   * (the skin's class - this card brings no colour); the glyphs shown, each its own drawing; and the character the
   * portrait is (`character`, the corner mark's own line). Nothing worn, nothing drawn - no empty row.
   */
  function plateFacts(into) {
    const w = flow.wardrobe;
    const worn = typeof w?.title === 'string' && w.title ? w.title : null;
    const off = Array.isArray(w?.glyphsOff) ? w.glyphsOff : [];
    const shown = glyphBadges(w).filter((g) => !off.includes(g.key));
    if (worn || shown.length) {
      const line = el('div', 'acctworn');
      if (worn) {
        const t = el('span', `acctworntitle ${badgeClass('tl', worn)}`);
        t.append(el('span', 'acctwornword', TITLE_TEXT[worn] ?? worn));
        line.append(t);
      }
      for (const g of shown) {
        const chip = el('span', `acctglyph ${badgeClass('gl', g.key)}`);
        chip.title = GLYPH_LABEL[g.key] ?? g.key;
        const svg = glyphArtNode(doc, g, 'acctglyphart', 1.6);
        if (!svg) continue;
        chip.append(svg);
        line.append(chip);
      }
      into.append(line);
    }
    if (typeof character === 'string' && character) into.append(el('span', 'acctcharline', character));
  }

  /** One field, wearing exactly the shape ONLINE1 and NAME-F2 built. */
  function field(key) {
    const spec = FIELD_SPEC[key];
    const wrap = el('label', 'field');
    wrap.append(el('span', 'fieldlabel', spec.label));
    const input = keyedAs(el('input'), `field:${key}`);
    input.type = spec.secret ? 'password' : 'text';
    input.maxLength = spec.max;
    input.value = flow.values[key] ?? '';
    // AUTOCOMPLETE IS TOLD THE TRUTH, which is a real accessibility and
    // safety matter rather than a nicety: a password manager that is
    // told `new-password` offers to generate one, and one told
    // `current-password` offers the stored one. Left unset, browsers
    // guess - and a guess that fills the CURRENT password into the NEW
    // password box is a player locked out by their own manager.
    if (key === 'password') input.autocomplete = flow.stage === 'login' ? 'current-password' : 'new-password';
    else if (key === 'confirm') input.autocomplete = 'new-password';
    else if (key === 'oldPassword') input.autocomplete = 'current-password';
    else if (key === 'handle') input.autocomplete = 'username';
    else input.autocomplete = 'off';
    if (key === 'handle') { input.autocapitalize = 'off'; input.spellcheck = false; }
    input.oninput = () => flow.set(key, input.value);
    // ENTER SUBMITS. A form of four fields where the only way on is to
    // find the button is a form people abandon.
    input.onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); flow.submit(); } };
    wrap.append(input);
    if (spec.hint) wrap.append(el('span', 'fieldhint', spec.hint));
    return wrap;
  }

  /**
   * TERMS1 — ONE BOX, AND THE DOCUMENT IT AGREES TO.
   *
   * "I wanna make sure these need to be reviewed and checked off by
   * players before creating an account". So the box starts UNTICKED -
   * the flow wipes the ticks on every move, and nothing here sets one -
   * and the document's name beside it is a LINK to the whole text.
   *
   * THE LINK OPENS OUTSIDE THE GAME: a new tab on the web, the system
   * browser from the desktop app (app/main.cjs hands http(s) there), so
   * reading it loses nothing already typed. It sits inside the <label>,
   * and a click on a link inside a label follows the link without
   * toggling the box - the HTML rule for interactive content in a label -
   * so a player cannot tick what they only meant to open.
   */
  function agreement(key) {
    const spec = AGREEMENT_SPEC[key];
    const wrap = el('label', 'acctagree');
    const box = keyedAs(el('input'), `agree:${key}`);
    box.type = 'checkbox';
    box.checked = flow.agreed?.[key] === true;
    box.onchange = () => flow.agree(key, box.checked);
    const link = keyedAs(el('a', null, spec.label), `doc:${key}`);
    link.href = spec.url;
    link.target = '_blank';
    link.rel = 'noopener';
    const words = el('span');
    // L10N4: ONE SENTENCE, the link where the language puts the document's name - split at the name, never glued
    const [before, after = ''] = t('account.card.agree', 'I have read and agree to the {doc}', { doc: '\u0001' }).split('\u0001');
    words.append(el('span', null, before), link);
    if (after) words.append(el('span', null, after));
    wrap.append(box, words);
    return wrap;
  }

  function act(label, onclick, { primary = false, disabled = false, key = label } = {}) {
    const b = keyedAs(el('button', `act${primary ? ' primary' : ''}`, label), `act:${key}`);
    b.type = 'button';
    if (disabled) b.disabled = true;
    b.onclick = onclick;
    return b;
  }

  /**
   * ACC3c — THE WARDROBE, and it is a PICKER rather than a list.
   *
   * Mac: "Players can tap the account icon to equip 1 feature along
   * with signing out." So it sits on the signed-in card beside Sign
   * out, which is where he put it.
   *
   * IT DRAWS NOTHING WHERE THERE IS NOTHING TO CHOOSE. A player who
   * holds no title sees no picker - not an empty box with a heading
   * over it - because ACC1e's own correction was Mac's ("there's
   * uneeded text explaining what an account is") and a control with
   * no options is exactly that. GLYPH-WEAR (2026-10-02, Mac: "can we
   * make it where players can also equip/unequip their glyphs"): each
   * glyph is a button too - pressed off, pressed back on - though it
   * stays TRUE of the player: hiding one is paint, and what it grants
   * stays.
   */
  function wardrobe() {
    const w = flow.wardrobe;
    const held = Array.isArray(w?.titles) ? w.titles : [];
    const glyphs = glyphBadges(w);
    const icons = Array.isArray(w?.icons) ? w.icons : [];   // WITCH1: the profile icons held
    const auras = Array.isArray(w?.auras) ? w.auras : [];   // WB9g: the Broker's auras this account owns; AEGIS: and a listed title's (PRIMARCH: the Golden Radiance; SHADOW-CLOAK: the Holo Shadow Cloak; SERAPH-WINGS: a developer's Seraph Wings)
    if (!held.length && !glyphs.length && !auras.length && !icons.length) return;

    const box = el('div', 'acctwear');
    if (held.length) {
      box.append(el('span', 'fieldlabel', t('account.wear.title', 'Title')));
      const row = el('div', 'acctwearrow');
      for (const key of held) {
        // PRESSING THE ONE WORN TAKES IT OFF (the flow decides that,
        // not this), so the button says which way it will go rather
        // than leaving the player to guess from a highlight alone.
        const worn = w.title === key;
        // THE CLASS CARRIES THE COLOUR, not this file. enhancedStyle.js
        // writes one rule per title out of ui/playerBadge.js's own
        // table, so the gold here and the gold over a head are one
        // fact - and this card goes on bringing no design language of
        // its own, which is the rule ACC1e was built under.
        // SHADOW-FANG: the word in a span of its own, so a gradient title's paint clips to the letters and leaves
        // the button's border in its plain colour (ui/playerBadge.js badgeCss)
        const b = keyedAs(el('button', `acttitle ${badgeClass('tl', key)}${worn ? ' worn' : ''}`), `title:${key}`);
        b.append(el('span', 'acttitleword', TITLE_TEXT[key] ?? key));
        b.type = 'button';
        b.disabled = !!flow.busy;
        b.setAttribute('aria-pressed', worn ? 'true' : 'false');
        b.title = worn ? t('account.wear.worn', 'Worn. Press to take it off.') : t('account.wear.wear', 'Wear {name}', { name: TITLE_TEXT[key] ?? key });   // WB13b
        b.onclick = () => flow.equip(key);
        row.append(b);
      }
      box.append(row);
    }
    if (auras.length) {
      // WB9g: AN AURA IS WORN AS A TITLE IS - one at a time, pressed on, pressed off (the flow decides which), the fire at
      // the feet every other player sees once the next hello carries it
      box.append(el('span', 'fieldlabel', t('account.wear.aura', 'Aura')));
      const row = el('div', 'acctwearrow');
      for (const key of auras) {
        const worn = w.aura === key;
        const b = keyedAs(el('button', `acttitle actaura aura-${key}${worn ? ' worn' : ''}`), `aura:${key}`);
        b.append(el('span', 'actauraword', AURA_TEXT[key] ?? key));
        b.type = 'button';
        b.disabled = !!flow.busy;
        b.setAttribute('aria-pressed', worn ? 'true' : 'false');
        b.title = worn ? t('account.wear.worn', 'Worn. Press to take it off.') : t('account.wear.wear', 'Wear {name}', { name: AURA_TEXT[key] ?? key });
        b.onclick = () => flow.wearAura(key);
        row.append(b);
      }
      box.append(row);
    }
    if (icons.length) {
      // WITCH1: AN ICON IS WORN AS AN AURA IS - one at a time, pressed on, pressed off - in the portrait well
      box.append(el('span', 'fieldlabel', t('account.wear.icon', 'Icon')));
      const row = el('div', 'acctwearrow');
      for (const key of icons) {
        const worn = w.icon === key;
        const b = keyedAs(el('button', ['acttitle', 'acticon', ...(worn ? ['worn'] : [])].join(' ')), `icon:${key}`);
        const art = profileIconNode(doc, key, 'acticonart', 22);
        if (art) { art.setAttribute('aria-hidden', 'true'); b.append(art); }   // its word stands beside it: read once
        b.append(el('span', 'acticonword', ICON_TEXT[key] ?? key));
        b.type = 'button';
        b.disabled = !!flow.busy;
        b.setAttribute('aria-pressed', worn ? 'true' : 'false');
        b.title = worn ? t('account.wear.worn', 'Worn. Press to take it off.') : t('account.wear.wear', 'Wear {name}', { name: ICON_TEXT[key] ?? key });
        b.onclick = () => flow.wearIcon(key);
        row.append(b);
      }
      box.append(row);
    }
    if (glyphs.length) {
      box.append(el('span', 'fieldlabel', t('account.wear.glyphs', 'Glyphs')));
      const row = el('div', 'acctwearrow');
      const off = Array.isArray(w?.glyphsOff) ? w.glyphsOff : [];
      for (const g of glyphs) {
        // GLYPH-WEAR: A BUTTON NOW, worn as a title's is - full strength while shown, faded while hidden - and the
        // press asks the service (flow.toggleGlyph). Still a fact about the account: hidden, it grants what it did.
        const shown = !off.includes(g.key);
        const chip = keyedAs(el('button', `acctglyph ${badgeClass('gl', g.key)}${shown ? ' worn' : ''}`), `glyph:${g.key}`);
        chip.type = 'button';
        chip.disabled = !!flow.busy;
        chip.setAttribute('aria-pressed', shown ? 'true' : 'false');
        chip.title = shown ? t('account.wear.glyphShown', 'Shown. Press to hide it') : t('account.wear.glyphHidden', 'Hidden. Press to show it');
        chip.onclick = () => flow.toggleGlyph(g.key);
        // SHADOW-FANG: the one drawing's colourless half (ui/playerBadge.js glyphArtNode) - its shapes are
        // currentColor, which this chip's class colours; a gradient glyph brings its own fill and eye
        const svg = glyphArtNode(doc, g, 'acctglyphart', 1.6);
        if (svg) chip.append(svg);
        chip.append(el('span', null, GLYPH_LABEL[g.key] ?? g.key));
        row.append(chip);
      }
      box.append(row);
    }
    host.append(box);
  }

  function paint() {
    const stage = STAGES.includes(flow.stage) ? flow.stage : 'out';
    // AUDIT TERMS1 T3: what the keyboard is on, before the card it is on is taken down
    const on = /** @type {any} */ (doc.activeElement);
    if (on && typeof on.acctKey === 'string' && keyed.get(on.acctKey) === on) {
      wanted = { key: on.acctKey, stage: painted, caret: typeof on.selectionStart === 'number' ? [on.selectionStart, on.selectionEnd] : null };
    } else if (on && on !== doc.body && on !== doc.documentElement) wanted = null;   // the player moved it elsewhere
    keyed = new Map();
    root.textContent = '';
    build(stage);
    painted = stage;
    focusBack(stage);
  }

  /** AUDIT TERMS1 T3: the focus back where it was - the same control, the same caret - on a card of the same stage. */
  function focusBack(stage) {
    if (!wanted) return;
    if (wanted.stage !== stage) { wanted = null; return; }
    const n = keyed.get(wanted.key);
    if (!n || n.disabled || typeof n.focus !== 'function') return;   // kept for the card that has it again
    n.focus();
    if (wanted.caret && typeof n.setSelectionRange === 'function') {
      try { n.setSelectionRange(wanted.caret[0], wanted.caret[1]); } catch { /* a box or a button has no caret */ }
    }
    wanted = null;
  }

  /**
   * NAME-AS (2026-10-12, Mac: "I want to add an option to the profile menu where players can toggle to use their account
   * name or character name for ingame use") - THE NAME THE ROOM READS, a toggle of two: the account's (the plate's own
   * name) or the character's being played. A press asks the flow (chooseName: the service keeps the choice and every
   * later mint signs it), and the one chosen is pressed - `worn`, aria-pressed - as a title worn is, in the wardrobe's own
   * vocabulary (this card brings no design language of its own). One line under it says what the other players see: the
   * account's name, by name; or the character's, and the account's where the character's cannot be shown (the mint says
   * why, and the game says it once). A service from before NAME-AS states no choice, and gets no toggle.
   */
  function nameAsRow() {
    const a = flow.account;
    if (a?.nameAs !== 'account' && a?.nameAs !== 'character') return;
    const box = el('div', 'acctwear acctnameas');
    box.append(el('span', 'fieldlabel', 'Name in game'));
    const row = el('div', 'acctwearrow');
    for (const [as, label] of NAME_AS_CHOICES) {
      const on = a.nameAs === as;
      const b = keyedAs(el('button', `acttitle${on ? ' worn' : ''}`), `nameas:${as}`);
      b.append(el('span', 'acttitleword', label));
      b.type = 'button';
      b.disabled = !!flow.busy;
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
      b.title = on ? 'Shown in game now' : `Show your ${label.toLowerCase()} in game`;
      b.onclick = () => flow.chooseName(as);
      row.append(b);
    }
    box.append(row);
    box.append(el('p', 'meta', a.nameAs === 'character'
      ? `Others see the name of the character you play online, or ${a.name} where it cannot be shown.`
      : `Others see ${a.name} over your head and in chat.`));
    host.append(box);
  }

  /**
   * PATREON-LINK — THE PATRON'S OWN LINK (Mac: "having to manually hand out titles ... its really hard to keep up with
   * it"). A registered account, on a service with linking on, gets one row: Link Patreon, or Linked with what the
   * pledge holds, a Refresh (the same link - Patreon asked again) and an Unlink.
   *
   * THE LINK IS A LINK, not a button that asks for one: the service put it in the account read, so the press opens it
   * at once - a new tab on the web, the system browser from the desktop app (app/main.cjs hands http(s) there), exactly
   * as TERMS1's document links do. A window opened after an await is a popup a phone's browser blocks.
   */
  function patreonRow() {
    const p = flow.patreon;
    if (!p?.on || !flow.account?.handle) return;
    const titles = Array.isArray(p.titles) ? p.titles : [];
    const box = el('div', 'acctwear acctpatreon');
    box.append(el('span', 'fieldlabel', 'Patreon'));
    const row = el('div', 'acctwearrow');
    if (p.linked) row.append(el('span', 'acctpatreonstate', titles.length ? t('account.patreon.linked', 'Linked - {titles}', { titles: titles.map((k) => TITLE_TEXT[k] ?? k).join(', ') }) : t('account.patreon.noTier', 'Linked. No rank yet')));
    if (typeof p.link === 'string' && p.link.startsWith('https://')) {
      const a = keyedAs(el('a', 'act', p.linked ? t('account.patreon.refresh', 'Refresh') : t('account.patreon.link', 'Link Patreon')), 'patreon:link');
      a.href = p.link;
      a.target = '_blank';
      a.rel = 'noopener';
      a.onclick = () => flow.patreonOpened();
      row.append(a);
    }
    if (p.linked) row.append(act(t('account.patreon.unlink', 'Unlink'), () => flow.unlinkPatreon(), { disabled: !!flow.busy, key: 'patreon:unlink' }));
    box.append(row);
    host.append(box);
  }

  /**
   * RECOVERY-SET - THE CODES' ROW, in the Account section as the Patreon row is: how many recovery codes still open the
   * account (a count, never a code - the service keeps only hashes), and the press that makes a new set. AUDIT
   * RECOVERY-SET B3: in the section, not the window's foot - a fifth press there took the sticky foot to three rows (225px
   * of a 667px phone, 193px of a landscape one's 390). None for a guest, nor where the service counts no codes (a
   * service before acct131 has no route to make them).
   */
  function recoveryRow() {
    if (!flow.account?.handle || !Number.isSafeInteger(flow.account.recoveryLeft)) return;
    const box = el('div', 'acctwear acctrecovery');
    box.append(el('span', 'fieldlabel', t('account.card.recoveryCodes', 'Recovery codes')));
    const row = el('div', 'acctwearrow');
    row.append(el('span', 'acctrecoverystate', t('account.card.codesLeft', '{n, plural, one {# left} other {# left}}', { n: flow.account.recoveryLeft })));
    row.append(act(t('account.card.act.makeCodes', 'Make new codes'), () => flow.go('codes'), { disabled: !!flow.busy, key: 'codes' }));
    box.append(row);
    host.append(box);
  }

  /** PATREON-LINK: BACK FROM THE BROWSER, the account is read again - a link that landed, or a pledge that moved, is on
   *  the card the player comes back to. One listener a card, gone on the first focus after the card is. */
  const win = doc.defaultView;
  let off = () => {};   // MEM-AUDIT (2026-10-23): the card's owner lets it go when it draws the next - a repaint makes a card a render
  if (win && typeof win.addEventListener === 'function') {
    const onFocus = () => {
      if (!root.isConnected) { win.removeEventListener('focus', onFocus); return; }
      if (flow.stage === 'in' && flow.patreon?.on && typeof flow.refresh === 'function') Promise.resolve(flow.refresh()).catch(() => {});
    };
    win.addEventListener('focus', onFocus);
    off = () => win.removeEventListener('focus', onFocus);
  }

  function build(stage) {
    const copy = STAGE_COPY[stage];

    // PROFILE-MENU (2026-10-07, Mac: "organize and detail the player profile (the top right icon section)"): SIGNED
    // IN, THE CARD IS A PROFILE, not a list. It was one centred column of eleven key-and-value rows - who you are, what
    // you have done and what your account is, all at one weight, the Renown rows wrapping to three lines on a phone. Now
    // it reads in the order a player looks: WHO (the plate - the portrait the corner mark wears, the name with its
    // Renown, the title and glyphs worn, the character), then WHAT THEY HAVE DONE (the record, a tile a deed; each
    // character's Renown with how far into it they are, drawn), then WHAT THEY WEAR (the wardrobe), then THE ACCOUNT
    // (its facts and the Patreon link). Each in a section of its own under its own head; side by side where the window
    // is wide (enhancedStyle.js .acctgrid), one column on a phone. Every fact is the one the card already said - none is
    // new, and none is said twice.
    const signedIn = stage === 'in' && !!flow.account;
    root.className = signedIn ? 'card acct acctin' : 'card acct';
    host = root;
    let head = root;
    if (signedIn) {
      const plate = el('div', 'acctplate');
      plate.append(portrait());
      head = el('div', 'acctident');
      plate.append(head);
      root.append(plate);
    }

    // The tag earns its place only where it is NOT a restatement of the
    // heading below it: "Write these down" over "Your recovery codes" is
    // a different sentence; "Account" over "Your account" is the same
    // one twice.
    if (copy.tag !== accountTag()) root.append(el('span', 'tag', copy.tag));
    // RENOWN1 (Mac: "having their level appear on the left side of character name and profile main menu"): the
    // Renown of the character most recently played online, left of the name - the service's tracks come most
    // recently played first (AUDIT RENOWN1 UI-10: "earned" was never what it measured - a report the hour had spent
    // still marks its character played). None for an account that has not earned any yet, or a service before it.
    // RENOWN-CHAR: a character's again (RENOWN-ACCOUNT drew the account's one here).
    const tracks = stage === 'in' ? renownTracksOfCard(flow.account?.renown) : [];
    const heading = stage === 'in' ? (flow.account?.name ?? copy.title) : copy.title;
    const lvText = renownText(tracks[0]?.level);
    if (lvText) {
      const h = el('h3', null, null);
      const chip = el('span', 'acctrenown', lvText);
      chip.title = typeof tracks[0].name === 'string' && tracks[0].name ? t('account.card.renownWhose', 'Renown {level} - {name}', { level: tracks[0].level, name: tracks[0].name })
        : t('account.card.renownLevel', 'Renown {level}', { level: tracks[0].level });   // AUDIT RENOWN1 UI-10: whose Renown it is
      h.append(chip, el('span', 'acctname', heading));
      head.append(h);
    } else head.append(el('h3', null, heading));
    if (signedIn) plateFacts(head);
    if (copy.blurb) root.append(el('p', 'meta', copy.blurb));

    // ── THE SIGNED-IN PROFILE ───────────────────────────────────────
    if (signedIn) {
      const grid = el('div', 'acctgrid');
      const deeds = el('div', 'acctcol');
      const kept = el('div', 'acctcol');
      root.append(grid);
      /** A section: its head, and the list its rows go in - `row` writes a key and a value into the list in hand. It
       *  stands in its column only once a row is in it (`keep`): ACC1e's rule, no heading over an empty box. */
      let rows = null;
      let last = null;
      const section = (title, cls = '') => {
        const sec = el('section', 'acctsec');
        sec.append(el('h4', 'acctsechead', title));
        rows = el('ul', cls ? `acctfacts ${cls}` : 'acctfacts');
        sec.append(rows);
        return sec;
      };
      const keep = (into, sec) => { if (rows.children.length) into.append(sec); };
      const row = (k, v) => {
        const li = el('li');
        li.append(el('span', 'acctkey', k));
        li.append(el('span', 'acctval', v));
        rows.append(li);
        last = li;
      };
      /** Under the row just written, a bar: `value` of `max`, said in words for a reader that cannot see it. */
      const bar = (value, max, words) => {
        if (!last || !(max > 0)) return;
        const b = el('progress', 'acctbar');
        b.max = max;
        b.value = Math.max(0, Math.min(max, value));
        b.title = words;
        b.setAttribute?.('aria-label', words);
        last.append(b);
      };

      // THE RECORD - what the account has done, a tile a deed. A service from before a deed says nothing of it, and a
      // section with nothing in it is not drawn (ACC1e: no heading over an empty box).
      const record = section(t('account.card.record', 'Record'), 'acctrecord');
      // DUEL1 (Mac: "Add a dueling K/D to the profile menu"): the account's record, the service's count of the duels
      // it won and lost (net/duel/duelRecord.js says whose word each result is). A service from before it says nothing.
      const duels = duelRecordText(flow.account.duels);
      if (duels) row(t('account.card.duels', 'Duels'), duels);
      // PROFILE-MENU: and the wins' share of them, drawn - a K/D is a ratio, and a bar says it at a glance
      const won = Number.isSafeInteger(flow.account.duels?.wins) && flow.account.duels.wins > 0 ? flow.account.duels.wins : 0;
      const lost = Number.isSafeInteger(flow.account.duels?.losses) && flow.account.duels.losses > 0 ? flow.account.duels.losses : 0;
      if (duels && won + lost > 0) bar(won, won + lost, t('account.card.duelsWon', '{percent}% of duels won', { percent: Math.round((100 * won) / (won + lost)) }));
      // WB5b: the Oblivion Gates this account closed - each a kill the relay signed and this service counted once
      // (net/gate/gateClaims.js carries the receipts). A service from before it says nothing.
      const gates = gateRecordText(flow.account.gates);
      if (gates) row(t('account.card.gates', 'Breaches closed'), gates);   // WB12a
      // RAID4: the towns this account defended - each a raid's cleanse the relay signed and this service counted once
      // (net/raid/raidClaims.js carries the receipts). A service from before it says nothing.
      const raids = raidRecordText(flow.account.raids);
      if (raids) row(t('account.card.raids', 'Towns defended'), raids);
      // AUDIT SERPENT D4 (SERPENT1): the sea serpents this account helped slay - each a kill the relay signed and this
      // service counted once (net/serpent/serpentClaims.js carries the receipts). A service from before it says nothing.
      const serpents = serpentRecordText(flow.account.serpents);
      if (serpents) row(t('account.card.serpents', 'Serpents slain'), serpents);
      // SD9b: the Hours this account broke - each a Brass Remnant's fall the relay signed and this service counted once
      // (net/superDungeon/sdClaims.js carries the receipts). A service from before it says nothing.
      const hours = sdRecordText(flow.account.sds);
      if (hours) row(t('account.card.hours', 'Hours broken'), hours);
      // STAR7: the fallen stars this account held - each a master's fall the relay signed and this service counted once
      // (net/starfall/starClaims.js carries the receipts). A service from before it says nothing.
      const stars = starRecordText(flow.account.stars);
      if (stars) row(t('account.card.stars', 'Stars held'), stars);
      // KETCH: the voyages this account sailed to the Tonal Warden's fall - each a receipt the relay signed and this service
      // counted once a voyage (net/ketch/ketchClaims.js carries the receipts). A service from before it says nothing.
      const voyages = ketchRecordText(flow.account.ketch);
      if (voyages) row(t('account.card.voyages', 'Voyages sailed'), voyages);
      // MARKS1: the account's Marks - the server's currency, struck for acts a server witnessed (PROF0 10.5). Null where
      // Marks are not this account's (a guest, the service's switch), and a service from before it says nothing.
      if (Number.isSafeInteger(flow.account.marks)) row(t('account.card.silver', 'Silver'), marksText(flow.account.marks));
      keep(deeds, record);

      // RENOWN1: each character's Renown and how far into it they are - online's own level, never the save's. The
      // service sends the RENOWN_CARD_TRACKS (five) most recently played (RENOWN-CHAR: a row each again).
      // PROFILE-MENU: under a head of their own, each with the way to its next level drawn.
      const chars = section(t('account.card.characters', 'Characters'), 'acctchars');
      for (const tr of tracks) {
        row(t('account.card.renown', 'Renown'), t('account.card.renownRow', '{name} - Renown {level}, {progress}', { name: typeof tr.name === 'string' && tr.name ? tr.name : t('account.card.aCharacter', 'A character'), level: tr.level, progress: renownProgressText(tr.xp) }));
        const p = renownProgress(tr.xp);
        bar(p.need > 0 ? p.into : 1, p.need > 0 ? p.need : 1, renownProgressText(tr.xp));   // at the cap, a full bar
      }
      keep(deeds, chars);

      // THE WARDROBE (ACC3c) and THE PATRON'S LINK (PATREON-LINK), each under its head, where there is one to draw
      host = el('section', 'acctsec');
      host.append(el('h4', 'acctsechead', 'Wardrobe'));
      wardrobe();
      if (host.children.length > 1) kept.append(host);

      // THE ACCOUNT - what it is: the name it goes by, its kind, when it was made and the time played on it - NAME-AS: and
      // which name the room reads - and its Patreon link, which is the account's too.
      const account = section('Account');
      // A GUEST IS NOT A LESSER ACCOUNT, and the card says so rather
      // than showing an empty username and a nag. It is an account
      // with no username attached YET - ACC0's own framing, and the
      // reason registering migrates nothing.
      if (flow.account.handle) row(t('account.card.username', 'Username'), flow.account.handle);
      else row(t('account.card.name', 'Name'), t('account.card.guestName', '{name} (a guest)', { name: flow.account.guestName ?? flow.account.name }));
      if (flow.account.kind) row(t('account.card.kind', 'Kind'), flow.account.kind === 'linked' ? t('account.card.kindRegistered', 'Registered') : t('account.card.kindGuest', 'Guest'));
      // ACC4 (Mac: "registered date and time played"). A guest has no
      // registered date and gets no row for it, rather than a dash - the
      // Kind row above already says why. Time played is every account's,
      // guest time included: registering upgrades the same row.
      const joined = registeredText(flow.account.registeredAt);
      if (joined) row(t('account.card.registered', 'Registered'), joined);
      row(t('account.card.played', 'Time played'), playedText(flow.account.playedS));
      kept.append(account);
      host = account;
      nameAsRow();   // NAME-AS: the name the room reads - the account's own section, beside the name it goes by
      patreonRow();   // PATREON-LINK
      recoveryRow();   // RECOVERY-SET
      if (!flow.account.handle) {
        account.append(el('p', 'meta', t('account.card.guestNote', 'Adding a username keeps everything this account already has.')));
      }
      host = root;
      // AUDIT PROFILE-MENU P2: A COLUMN WITH NOTHING IN IT IS NOT DRAWN - a new guest, or an account a service before the
      // record knows, has no deeds, and its Account stood in the right half of the wide window beside an empty left one.
      // Two columns (and the wide window) only when both have something to say.
      const both = deeds.children.length > 0;
      grid.className = both ? 'acctgrid acctgrid2' : 'acctgrid';
      if (both) grid.append(deeds);
      grid.append(kept);
    }
    // ── THE CODES, THE ONE TIME THEY EXIST ──────────────────────────
    // RECOVERY-SET: a set, numbered - a code a line, each its own <code>
    // so one click takes one code whole.
    if (stage === 'code' && flow.recoveryCodes?.length) {
      const plaque = el('div', 'acctcode');
      const list = el('ol');
      flow.recoveryCodes.forEach((c, i) => {
        const li = el('li');
        li.append(el('span', 'acctcodeno', `${i + 1}.`), el('code', null, c));
        list.append(li);
      });
      plaque.append(list);
      root.append(plaque);
    }

    // ── THE FIELDS ──────────────────────────────────────────────────
    for (const key of FIELDS[stage] ?? []) root.append(field(key));

    // ── TERMS1: THE BOXES, under the fields and over the button ──────
    for (const key of AGREEMENTS[stage] ?? []) root.append(agreement(key));

    // ── WHAT WENT WRONG, OR WHAT WENT RIGHT ─────────────────────────
    // Two lines rather than one with a colour swap: a refusal and a
    // confirmation are different facts, and NAME-F2's own note applies
    // - the text the player typed stays readable, the border carries
    // the red, and the reason sits under the field it is about.
    if (flow.error) root.append(el('p', 'meta acctwhy bad', flow.error));
    else if (flow.note) root.append(el('p', 'meta acctwhy good', flow.note));

    // ── THE ACTIONS ─────────────────────────────────────────────────
    const acts = el('div', 'acts');
    const busy = flow.busy;
    if (stage === 'out') {
      acts.append(act(t('account.card.act.createAccount', 'Create account'), () => flow.go('register'), { primary: true, disabled: busy, key: 'register' }));   // L10N4: the key is the act's name, not its word - the focus's memory holds in every language
      acts.append(act(t('account.card.act.signIn', 'Sign in'), () => flow.go('login'), { disabled: busy, key: 'login' }));
    } else if (stage === 'in') {
      if (flow.account?.handle) {
        acts.append(act(t('account.card.act.changePassword', 'Change password'), () => flow.go('password'), { disabled: busy, key: 'password' }));
      } else {
        acts.append(act(t('account.card.act.giveUsername', 'Give it a username'), () => flow.go('register'), { primary: true, disabled: busy, key: 'username' }));
      }
      acts.append(act(busy ? t('account.card.act.signingOut', 'Signing out…') : t('account.card.act.signOut', 'Sign out'), () => flow.signOut(false), { disabled: busy, key: 'signout' }));
      acts.append(act(t('account.card.act.signOutAll', 'Sign out everywhere'), () => flow.signOut(true), { disabled: busy, key: 'signout-all' }));
    } else if (stage === 'code') {
      // RECOVERY-SET: the codes kept another way than paper - copied, or
      // saved as a text file (enhancedChargen.js's class export, the
      // same two doors). Neither leaves the stage.
      acts.append(act(t('account.card.act.copyCodes', 'Copy'), () => copyCodes(), { key: 'copy' }));
      acts.append(act(t('account.card.act.saveCodes', 'Save as a file'), () => saveCodes(), { key: 'save' }));
      // THE ONLY WAY OFF THIS STAGE. No cancel, no close, no second
      // route - the codes are dropped when this is pressed and nothing
      // anywhere can print them again.
      acts.append(act(t('account.card.act.wroteIt', 'I have written them down'), () => flow.acknowledgeCode(), { primary: true, key: 'acknowledge' }));   // AUDIT RECOVERY-SET B5: a set
    } else if (stage === 'loading') {
      // nothing to press yet
    } else {
      const spec = STAGE_ACTS[stage];
      acts.append(act(busy ? t('account.card.act.working', 'Working…') : spec.submit, () => flow.submit(), { primary: true, disabled: busy, key: 'submit' }));
      acts.append(act(t('account.card.act.back', 'Back'), () => flow.go(spec.back), { disabled: busy, key: 'back' }));
      if (stage === 'login') {
        acts.append(act(t('account.card.act.lostPassword', 'Lost your password?'), () => flow.go('recover'), { disabled: busy, key: 'recover' }));
      }
    }
    // ACC1f: CLOSE IS AN ACT, NOT A THIRD ROW. The window used to own
    // a foot of its own, which put Close on a row under the card's own
    // buttons - two stacked rows where one would do, and on a form
    // that already had a Back it was a second way to do the same
    // thing. One row, centred, Close last.
    // AUDIT RECOVERY-SET B1: BUT NOT OVER THE CODES. The host passes a Close, and on `code` it was a second way off the
    // stage the comment above calls the only one - after "Make new codes" had already killed the old set. Nor while a
    // press is out: its answer may be codes.
    if (onClose && stage !== 'code') acts.append(act(t('account.card.act.close', 'Close'), onClose, { key: 'close', disabled: busy }));
    if (acts.children.length) root.append(acts);
  }

  /** RECOVERY-SET: the codes on the clipboard - or, where the page may not write it, the sentence that says so. */
  async function copyCodes() {
    try {
      await globalThis.navigator.clipboard.writeText(recoveryCodesText(flow.codesFor, flow.recoveryCodes ?? []));
      flow.say(t('account.codes.copied', 'Copied. Paste them somewhere only you can read.'));
    } catch {
      flow.say(t('account.codes.copyRefused', 'The browser blocked copying to the clipboard. Save them as a file instead.'), true);
    }
  }

  /** RECOVERY-SET: the codes as a text file the player keeps, named for the account. */
  function saveCodes() {
    try {
      const name = recoveryCodesFileName(flow.codesFor);
      const url = URL.createObjectURL(new Blob([recoveryCodesText(flow.codesFor, flow.recoveryCodes ?? [])], { type: 'text/plain' }));
      const link = doc.createElement('a');
      link.href = url; link.download = name;
      doc.body.append(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      flow.say(t('account.codes.saved', 'Saving as {name}.', { name }));   // AUDIT RECOVERY-SET B7: asked, not known - a save dialog can be cancelled
    } catch {
      flow.say(t('account.codes.saveRefused', 'The file could not be saved. Copy them instead.'), true);
    }
  }

  paint();
  return { root, paint, off };
}
