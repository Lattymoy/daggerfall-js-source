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

import { STAGES, FIELDS, FIELD_SPEC, AGREEMENTS, AGREEMENT_SPEC } from './accountFlow.js';
import { TITLE_TEXT, AURA_TEXT, glyphBadges, glyphArtNode, badgeClass } from './playerBadge.js';   // ACC3c: the SAME table the name over a head reads, so the picker shows what a player will actually wear - the COLOUR is the skin's (this card may not style itself, and a pin holds that)
import { duelRecordText } from '../net/duelRecord.js';   // DUEL1: the account card's K/D row
import { renownText, renownProgressText } from '../net/renown.js';   // RENOWN1: Renown, left of the name and in its rows
import { gateRecordText } from '../net/gateClaims.js';   // WB5b: and its gates-closed row
import { marksText } from '../net/marksLaw.js';   // MARKS1: and its Marks row
import { raidRecordText } from '../net/raidClaims.js';   // RAID4: and its towns-defended row
import { serpentRecordText } from '../net/serpentClaims.js';   // AUDIT SERPENT D4: and its serpents-slain row

/** RENOWN-CHAR (Mac: "Can we make renown per character again"): the card's Renown tracks as the service sends them -
 *  its characters', the most recently played first - or none: none earned yet, or a service from RENOWN-ACCOUNT's day
 *  (which sent the account's one, `{ xp, level }`, not a list - no character's Renown, so none is drawn). */
export function renownTracksOfCard(r) {
  return Array.isArray(r) ? r.filter((t) => renownText(t?.level) && Number.isSafeInteger(t?.xp) && t.xp >= 0) : [];
}

/** COPY LIVES IN ONE TABLE, so a stage cannot be drawn with a heading
 *  from one slice and a paragraph from another. Keyed by stage, and a
 *  pin asserts every stage has an entry - a stage added without one
 *  would draw a card with no words on it. */
/** ACC3c: what a glyph is CALLED on the card. The name over a head is
 *  a picture and needs no word; a wardrobe is a list of things a player
 *  holds, and a coloured shape with nothing beside it is a list nobody
 *  can read. A pin walks GLYPHS and requires an entry. */
export const GLYPH_LABEL = Object.freeze({
  sprout: 'New account',
  dev: 'Developer',
  mod: 'Moderator',
  dm: 'Dungeon Master',   // TITLE-N: the die beside the Dungeon Master's name
  disciple: 'Disciple',   // TITLE-N: the Patreon tiers' marks, each its title's word
  apostle: 'Apostle',
  hierophant: 'Hierophant',
  shadowfang: 'Shadow Fang',   // SHADOW-FANG: the wolf's head beside SirMcMobdon's name
  penitent: 'Penitent',   // PENITENT: the sword in its lozenge beside Diggleborf's name
  herald: 'Herald',   // HERALD: the herald's trumpet and its banner
  tower: 'A seat\'s Charter',   // SEAT1c: the tower of a guild holding a palace seat
  crownDF: 'The Crown of Daggerfall',   // SEAT1c: a crown seat's crown, its kingdom's
  crownWR: 'The Crown of Wayrest',
  crownSN: 'The Crown of Sentinel',
  laurel: 'Arena Champion',   // ARENA4: the laurel, while its wearer is the season's #1
  aegis: 'Aegis of Oblivion',   // AEGIS: the pillars through the ring over the void, beside Sureme's name
  primarch: 'Primarch',   // PRIMARCH: the three-barred cross, beside GA00250's name
});

/** ACC4: THE TWO FACTS MAC ASKED FOR, as words. Pure, so node pins
 *  them. The date is the player's LOCAL day - an account made late on
 *  the 21st in California was made on the 21st to its player, whatever
 *  UTC says - and the month is a word, because 09/10 is two different
 *  days on two sides of an ocean. Null for no date: a guest has not
 *  registered, and 0 would print 1970. */
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export function registeredText(s) {
  if (!Number.isSafeInteger(s) || s <= 0) return null;
  const d = new Date(s * 1000);
  return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}
/** Hours and minutes, and never seconds: the service counts in beats
 *  of five minutes (net/playClock.js), so a seconds figure would claim
 *  a precision nothing measured. Under an hour reads in minutes alone. */
export function playedText(s) {
  const m = Math.floor((Number.isFinite(s) && s > 0 ? s : 0) / 60);
  const h = Math.floor(m / 60);
  return h ? `${h}h ${m % 60}m` : `${m}m`;
}

export const STAGE_COPY = Object.freeze({
  // THE BLURBS WERE CUT (Mac: "there's uneeded text explaining what an
  // account is"). A sign-in window is not a place to be taught what an
  // account is - the two buttons say it. What survives is only what a
  // player CANNOT guess and would be hurt by not knowing: that recovery
  // signs every device out, and that the code is shown once.
  loading: { tag: 'Account', title: 'One moment', blurb: '' },
  out: { tag: 'Account', title: 'Your account', blurb: '' },
  register: { tag: 'Account', title: 'Create an account', blurb: '' },
  login: { tag: 'Account', title: 'Sign in', blurb: '' },
  recover: {
    tag: 'Account',
    title: 'Use your recovery code',
    // KEPT: this signs every device out, including the one being used.
    // A player who did not expect that has lost their other sessions.
    blurb: 'This signs every device out, including this one.',
  },
  code: {
    tag: 'Write this down',
    title: 'Your recovery code',
    // KEPT, and it is the only long line left on the card. Email is
    // optional, so this code IS the reset - a player who closes this
    // without writing it down has a forgotten password away from
    // losing the account.
    blurb: 'This is the only time this code is shown. Without it, a forgotten password means a lost account.',
  },
  in: { tag: 'Account', title: 'Signed in', blurb: '' },
  password: {
    tag: 'Account',
    title: 'Change your password',
    // KEPT: same reason as recovery - an unexpected sign-out elsewhere.
    blurb: 'Every other device will be signed out.',
  },
});

/** The button each stage submits with, and what the card offers beside
 *  it. Derived per stage rather than written at the call site, so a
 *  stage cannot end up with two primary buttons or none. */
export const STAGE_ACTS = Object.freeze({
  register: { submit: 'Create account', back: 'out' },
  login: { submit: 'Sign in', back: 'out' },
  recover: { submit: 'Set a new password', back: 'login' },
  password: { submit: 'Change password', back: 'in' },
});

/**
 * Build the card. Returns the element; call `paint()` to redraw it.
 *
 * @param {Document} doc
 * @param {ReturnType<typeof import('./accountFlow.js').AccountFlow>} flow
 */
export function accountCard(doc, flow, { onClose = null } = {}) {
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
    words.append(el('span', null, 'I have read and agree to the '), link);
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
    const auras = Array.isArray(w?.auras) ? w.auras : [];   // WB9g: the Broker's auras this account owns; AEGIS: and a listed title's (PRIMARCH: the Golden Radiance; SHADOW-CLOAK: the Holo Shadow Cloak; SERAPH-WINGS: a developer's Seraph Wings)
    if (!held.length && !glyphs.length && !auras.length) return;

    const box = el('div', 'acctwear');
    if (held.length) {
      box.append(el('span', 'fieldlabel', 'Title'));
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
        b.title = worn ? 'Worn. Press to take it off.' : `Wear ${TITLE_TEXT[key] ?? key}`;   // WB13b
        b.onclick = () => flow.equip(key);
        row.append(b);
      }
      box.append(row);
    }
    if (auras.length) {
      // WB9g: AN AURA IS WORN AS A TITLE IS - one at a time, pressed on, pressed off (the flow decides which), the fire at
      // the feet every other player sees once the next hello carries it
      box.append(el('span', 'fieldlabel', 'Aura'));
      const row = el('div', 'acctwearrow');
      for (const key of auras) {
        const worn = w.aura === key;
        const b = keyedAs(el('button', `acttitle actaura aura-${key}${worn ? ' worn' : ''}`), `aura:${key}`);
        b.append(el('span', 'actauraword', AURA_TEXT[key] ?? key));
        b.type = 'button';
        b.disabled = !!flow.busy;
        b.setAttribute('aria-pressed', worn ? 'true' : 'false');
        b.title = worn ? 'Worn. Press to take it off.' : `Wear ${AURA_TEXT[key] ?? key}`;
        b.onclick = () => flow.wearAura(key);
        row.append(b);
      }
      box.append(row);
    }
    if (glyphs.length) {
      box.append(el('span', 'fieldlabel', 'Glyphs'));
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
        chip.title = shown ? 'Showing this - press to hide it' : 'Hidden - press to show it';
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
    root.append(box);
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
    if (p.linked) row.append(el('span', 'acctpatreonstate', titles.length ? `Linked - ${titles.map((t) => TITLE_TEXT[t] ?? t).join(', ')}` : 'Linked - no tier yet'));
    if (typeof p.link === 'string' && p.link.startsWith('https://')) {
      const a = keyedAs(el('a', 'act', p.linked ? 'Refresh' : 'Link Patreon'), 'patreon:link');
      a.href = p.link;
      a.target = '_blank';
      a.rel = 'noopener';
      a.onclick = () => flow.patreonOpened();
      row.append(a);
    }
    if (p.linked) row.append(act('Unlink', () => flow.unlinkPatreon(), { disabled: !!flow.busy, key: 'patreon:unlink' }));
    box.append(row);
    root.append(box);
  }

  /** PATREON-LINK: BACK FROM THE BROWSER, the account is read again - a link that landed, or a pledge that moved, is on
   *  the card the player comes back to. One listener a card, gone on the first focus after the card is. */
  const win = doc.defaultView;
  if (win && typeof win.addEventListener === 'function') {
    const onFocus = () => {
      if (!root.isConnected) { win.removeEventListener('focus', onFocus); return; }
      if (flow.stage === 'in' && flow.patreon?.on && typeof flow.refresh === 'function') Promise.resolve(flow.refresh()).catch(() => {});
    };
    win.addEventListener('focus', onFocus);
  }

  function build(stage) {
    const copy = STAGE_COPY[stage];

    // The tag earns its place only where it is NOT a restatement of the
    // heading below it: "Write this down" over "Your recovery code" is
    // a different sentence; "Account" over "Your account" is the same
    // one twice.
    if (copy.tag !== 'Account') root.append(el('span', 'tag', copy.tag));
    // RENOWN1 (Mac: "having their level appear on the left side of character name and profile main menu"): the
    // Renown of the character most recently played online, left of the name - the service's tracks come most
    // recently played first (AUDIT RENOWN1 UI-10: "earned" was never what it measured - a report the hour had spent
    // still marks its character played). None for an account that has not earned any yet, or a service before it.
    // RENOWN-CHAR: a character's again (RENOWN-ACCOUNT drew the account's one here).
    const tracks = stage === 'in' ? renownTracksOfCard(flow.account?.renown) : [];
    const heading = stage === 'in' ? (flow.account?.name ?? copy.title) : copy.title;
    const lvText = renownText(tracks[0]?.level);
    if (lvText) {
      const head = el('h3', null, null);
      const chip = el('span', 'acctrenown', lvText);
      chip.title = `Renown ${tracks[0].level}${typeof tracks[0].name === 'string' && tracks[0].name ? ` - ${tracks[0].name}` : ''}`;   // AUDIT RENOWN1 UI-10: whose Renown it is
      head.append(chip, el('span', 'acctname', heading));
      root.append(head);
    } else root.append(el('h3', null, heading));
    if (copy.blurb) root.append(el('p', 'meta', copy.blurb));

    // ── THE SIGNED-IN FACTS ─────────────────────────────────────────
    if (stage === 'in' && flow.account) {
      const rows = el('ul', 'acctfacts');
      const row = (k, v) => {
        const li = el('li');
        li.append(el('span', 'acctkey', k));
        li.append(el('span', 'acctval', v));
        rows.append(li);
      };
      // A GUEST IS NOT A LESSER ACCOUNT, and the card says so rather
      // than showing an empty username and a nag. It is an account
      // with no username attached YET - ACC0's own framing, and the
      // reason registering migrates nothing.
      if (flow.account.handle) row('Username', flow.account.handle);
      else row('Name', `${flow.account.guestName ?? flow.account.name} (a guest)`);
      if (flow.account.kind) row('Kind', flow.account.kind === 'linked' ? 'Registered' : 'Guest');
      // ACC4 (Mac: "registered date and time played"). A guest has no
      // registered date and gets no row for it, rather than a dash - the
      // Kind row above already says why. Time played is every account's,
      // guest time included: registering upgrades the same row.
      const joined = registeredText(flow.account.registeredAt);
      if (joined) row('Registered', joined);
      row('Time played', playedText(flow.account.playedS));
      // DUEL1 (Mac: "Add a dueling K/D to the profile menu"): the account's record, the service's count of the duels
      // it won and lost (net/duelRecord.js says whose word each result is). A service from before it says nothing.
      const duels = duelRecordText(flow.account.duels);
      if (duels) row('Duels', duels);
      // WB5b: the Oblivion Gates this account closed - each a kill the relay signed and this service counted once
      // (net/gateClaims.js carries the receipts). A service from before it says nothing.
      const gates = gateRecordText(flow.account.gates);
      if (gates) row('Breaches closed', gates);   // WB12a
      // MARKS1: the account's Marks - the server's currency, struck for acts a server witnessed (PROF0 10.5). Null where
      // Marks are not this account's (a guest, the service's switch), and a service from before it says nothing.
      if (Number.isSafeInteger(flow.account.marks)) row('Silver', marksText(flow.account.marks));
      // RAID4: the towns this account defended - each a raid's cleanse the relay signed and this service counted once
      // (net/raidClaims.js carries the receipts). A service from before it says nothing.
      const raids = raidRecordText(flow.account.raids);
      if (raids) row('Towns defended', raids);
      // AUDIT SERPENT D4 (SERPENT1): the sea serpents this account helped slay - each a kill the relay signed and this
      // service counted once (net/serpentClaims.js carries the receipts). A service from before it says nothing.
      const serpents = serpentRecordText(flow.account.serpents);
      if (serpents) row('Serpents slain', serpents);
      // RENOWN1: each character's Renown and how far into it they are - online's own level, never the save's. The
      // service sends the RENOWN_CARD_TRACKS (five) most recently played (RENOWN-CHAR: a row each again).
      for (const t of tracks) {
        row('Renown', `${typeof t.name === 'string' && t.name ? t.name : 'A character'} - Renown ${t.level}, ${renownProgressText(t.xp)}`);
      }
      root.append(rows);
      wardrobe();
      patreonRow();   // PATREON-LINK
      if (!flow.account.handle) {
        root.append(el('p', 'meta', 'Adding a username keeps everything this account already has.'));
      }
    }

    // ── THE CODE, THE ONE TIME IT EXISTS ────────────────────────────
    if (stage === 'code' && flow.recoveryCode) {
      const plaque = el('div', 'acctcode');
      plaque.append(el('code', null, flow.recoveryCode));
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
      acts.append(act('Create account', () => flow.go('register'), { primary: true, disabled: busy }));
      acts.append(act('Sign in', () => flow.go('login'), { disabled: busy }));
    } else if (stage === 'in') {
      if (flow.account?.handle) {
        acts.append(act('Change password', () => flow.go('password'), { disabled: busy }));
      } else {
        acts.append(act('Give it a username', () => flow.go('register'), { primary: true, disabled: busy }));
      }
      acts.append(act(busy ? 'Signing out…' : 'Sign out', () => flow.signOut(false), { disabled: busy, key: 'signout' }));
      acts.append(act('Sign out everywhere', () => flow.signOut(true), { disabled: busy }));
    } else if (stage === 'code') {
      // THE ONLY WAY OFF THIS STAGE. No cancel, no close, no second
      // route - the code is dropped when this is pressed and nothing
      // anywhere can print it again.
      acts.append(act('I have written it down', () => flow.acknowledgeCode(), { primary: true }));
    } else if (stage === 'loading') {
      // nothing to press yet
    } else {
      const spec = STAGE_ACTS[stage];
      acts.append(act(busy ? 'Working…' : spec.submit, () => flow.submit(), { primary: true, disabled: busy, key: 'submit' }));
      acts.append(act('Back', () => flow.go(spec.back), { disabled: busy }));
      if (stage === 'login') {
        acts.append(act('Lost your password?', () => flow.go('recover'), { disabled: busy }));
      }
    }
    // ACC1f: CLOSE IS AN ACT, NOT A THIRD ROW. The window used to own
    // a foot of its own, which put Close on a row under the card's own
    // buttons - two stacked rows where one would do, and on a form
    // that already had a Back it was a second way to do the same
    // thing. One row, centred, Close last.
    if (onClose) acts.append(act('Close', onClose));
    if (acts.children.length) root.append(acts);
  }

  paint();
  return { root, paint };
}
