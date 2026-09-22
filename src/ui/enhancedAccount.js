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

import { STAGES, FIELDS, FIELD_SPEC } from './accountFlow.js';
import { TITLE_TEXT, GLYPH_PATH, GLYPH_STROKE, glyphBadges, badgeClass } from './playerBadge.js';   // ACC3c: the SAME table the name over a head reads, so the picker shows what a player will actually wear - the COLOUR is the skin's (this card may not style itself, and a pin holds that)

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

  /** One field, wearing exactly the shape ONLINE1 and NAME-F2 built. */
  function field(key) {
    const spec = FIELD_SPEC[key];
    const wrap = el('label', 'field');
    wrap.append(el('span', 'fieldlabel', spec.label));
    const input = el('input');
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

  function act(label, onclick, { primary = false, disabled = false } = {}) {
    const b = el('button', `act${primary ? ' primary' : ''}`, label);
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
   * no options is exactly that. The glyphs are shown BESIDE it and
   * are not pressable, because a glyph is TRUE of a player rather
   * than chosen by one; a control that cannot be operated would say
   * the opposite.
   */
  function wardrobe() {
    const w = flow.wardrobe;
    const held = Array.isArray(w?.titles) ? w.titles : [];
    const glyphs = glyphBadges(w);
    if (!held.length && !glyphs.length) return;

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
        const b = el('button', `acttitle ${badgeClass('tl', key)}${worn ? ' worn' : ''}`, TITLE_TEXT[key] ?? key);
        b.type = 'button';
        b.disabled = !!flow.busy;
        b.setAttribute('aria-pressed', worn ? 'true' : 'false');
        b.title = worn ? 'Wearing this - press to take it off' : `Wear ${TITLE_TEXT[key] ?? key}`;
        b.onclick = () => flow.equip(key);
        row.append(b);
      }
      box.append(row);
    }
    if (glyphs.length) {
      box.append(el('span', 'fieldlabel', 'Glyphs'));
      const row = el('div', 'acctwearrow');
      for (const g of glyphs) {
        // NOT A BUTTON. A glyph is a fact about the account - the
        // sprout is its age, the dev mark is a grant - and nothing
        // equips one, so nothing here can be pressed.
        const chip = el('span', `acctglyph ${badgeClass('gl', g.key)}`);
        const svg = doc.createElementNS?.('http://www.w3.org/2000/svg', 'svg');
        if (svg) {
          svg.setAttribute('class', 'acctglyphart');
          svg.setAttribute('viewBox', '0 0 16 16');
          svg.setAttribute('aria-hidden', 'true');
          const path = doc.createElementNS('http://www.w3.org/2000/svg', 'path');
          path.setAttribute('d', GLYPH_PATH[g.key] ?? '');
          if (GLYPH_STROKE[g.key]) {
            path.setAttribute('fill', 'none');
            path.setAttribute('stroke', 'currentColor');
            path.setAttribute('stroke-width', '1.6');
            path.setAttribute('stroke-linecap', 'round');
            path.setAttribute('stroke-linejoin', 'round');
          } else path.setAttribute('fill', 'currentColor');
          svg.append(path);
          chip.append(svg);
        }
        chip.append(el('span', null, GLYPH_LABEL[g.key] ?? g.key));
        row.append(chip);
      }
      box.append(row);
    }
    root.append(box);
  }

  function paint() {
    root.textContent = '';
    const stage = STAGES.includes(flow.stage) ? flow.stage : 'out';
    const copy = STAGE_COPY[stage];

    // The tag earns its place only where it is NOT a restatement of the
    // heading below it: "Write this down" over "Your recovery code" is
    // a different sentence; "Account" over "Your account" is the same
    // one twice.
    if (copy.tag !== 'Account') root.append(el('span', 'tag', copy.tag));
    root.append(el('h3', null, stage === 'in' ? (flow.account?.name ?? copy.title) : copy.title));
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
      root.append(rows);
      wardrobe();
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
      acts.append(act(busy ? 'Signing out…' : 'Sign out', () => flow.signOut(false), { disabled: busy }));
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
      acts.append(act(busy ? 'Working…' : spec.submit, () => flow.submit(), { primary: true, disabled: busy }));
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
