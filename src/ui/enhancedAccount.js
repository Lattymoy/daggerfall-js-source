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

/** COPY LIVES IN ONE TABLE, so a stage cannot be drawn with a heading
 *  from one slice and a paragraph from another. Keyed by stage, and a
 *  pin asserts every stage has an entry - a stage added without one
 *  would draw a card with no words on it. */
export const STAGE_COPY = Object.freeze({
  loading: {
    tag: 'Account',
    title: 'Checking your account',
    blurb: 'One moment.',
  },
  out: {
    tag: 'Account',
    title: 'Your account',
    // ACC0's wall, said at the door, and said HONESTLY: the saves are
    // ACC2 and the name is ACC1d, so neither is promised as working
    // today. A door that oversells is a door that gets a bug report.
    blurb: 'An account gives you a username nobody else can take, and a place to keep your saves. '
      + 'You can play online without one - you will be given a name of the Bay, and it will be yours only while you are here.',
  },
  register: {
    tag: 'Account',
    title: 'Create an account',
    blurb: 'Pick a username and a password. You will be given a recovery code afterwards - it is the only way back in if you forget the password, so have somewhere to write it down.',
  },
  login: {
    tag: 'Account',
    title: 'Sign in',
    blurb: 'Sign in on this device. Your other devices stay signed in.',
  },
  recover: {
    tag: 'Account',
    title: 'Use your recovery code',
    blurb: 'This sets a new password and signs every device out, including this one. You will be given a new recovery code.',
  },
  code: {
    tag: 'Write this down',
    title: 'Your recovery code',
    // THE STRONGEST SENTENCE ON THE CARD, because this is the only
    // moment it exists. Email is completely optional (Mac), so there is
    // no address to send a reset to and this code IS the reset.
    blurb: 'This is the only time this code will ever be shown. Without it, a forgotten password means a lost account - and the saves with it. Write it down somewhere that is not this computer.',
  },
  in: {
    tag: 'Account',
    title: 'Signed in',
    blurb: '',
  },
  password: {
    tag: 'Account',
    title: 'Change your password',
    blurb: 'Your current password is needed even here, so a borrowed device cannot lock you out. Every other device will be signed out.',
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
export function accountCard(doc, flow) {
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

  function paint() {
    root.textContent = '';
    const stage = STAGES.includes(flow.stage) ? flow.stage : 'out';
    const copy = STAGE_COPY[stage];

    root.append(el('span', `tag${stage === 'code' ? '' : ' grey'}`, copy.tag));
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
      root.append(rows);
      if (!flow.account.handle) {
        root.append(el('p', 'meta', 'This device has a guest account. Give it a username and a password and it keeps everything it already has - the same account, with a name on it.'));
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
      acts.append(act('Create an account', () => flow.go('register'), { primary: true, disabled: busy }));
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
    if (acts.children.length) root.append(acts);
  }

  paint();
  return { root, paint };
}
