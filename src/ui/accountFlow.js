// @ts-check
// ═══════════════════════════════════════════════════════════════════
// ACC1e — THE ACCOUNT SCREEN'S FLOW, WITH NO SCREEN IN IT.
//
// Mac (2026-09-21): "Should we go ahead and build the account creation
// screen" - "Yes, please be detailed".
//
// THE SPLIT IS THE PROJECT'S OWN, not an invention: `ChargenFlow` does
// the wizard's thinking and `enhancedChargen.js` draws it, and
// test/enhancedChargen.test.js says why - "node cannot draw them; what
// IS testable is the part that does arithmetic". Everything a player
// can get WRONG about an account is arithmetic: which stage they are
// on, whether two passwords match, what a refusal means, whether the
// button may be pressed twice. All of it is here, and none of it needs
// a DOM to be driven.
//
// ═══ THE RECOVERY CODE IS THE WHOLE REASON THIS IS CAREFUL ═════════
//
// ACC1c: email is completely optional, so there is no address to send
// a reset link to. The recovery code IS the reset link, it is readable
// exactly once, and if the player closes the card without writing it
// down it is gone - along with the account and the cloud saves behind
// it, which are the only reason the account exists.
//
// So `code` is a STAGE rather than a line in a corner. It is the only
// stage with no way back to the game except an explicit "I have
// written it down", the code is never handed to storage, and leaving
// it needs the acknowledgement. A toast would have been one scroll
// from lost.
//
// ═══ ONE PRESS IS ONE ACCOUNT ══════════════════════════════════════
//
// `busy` is not a spinner's flag. Registering is TWO calls - open a
// guest row, then upgrade it - and a second press between them opens a
// second guest row that nothing will ever adopt: a row in D1 with no
// handle, no password and no way back to it. So every submission
// refuses to start while one is running, and the pins drive exactly
// that race.
// ═══════════════════════════════════════════════════════════════════

import {
  openGuest, register, login, recover, readAccount, changePassword, logout, equipTitle,
  storedSession, keepSession, forgetSession, accountRefusalText, handleShapeOk,
  PASSWORD_MIN_LEN,
} from '../net/accountClient.js';

/** Every stage this card can be on. Exported because a pin that
 *  enumerates them by hand is a pin that stops covering the one added
 *  on a Friday. */
export const STAGES = Object.freeze([
  'loading',    // a stored session is being checked against the service
  'out',        // no account on this device
  'register',   // choosing a username and password
  'login',      // signing in on this device
  'recover',    // spending the recovery code
  'code',       // THE CODE, readable once, and the only way on is to acknowledge it
  'in',         // signed in
  'password',   // changing the password from inside a session
]);

/** The fields each stage asks for, in the order they are asked. The
 *  renderer walks THIS rather than carrying its own list, so a stage
 *  cannot grow a field the screen does not draw. */
export const FIELDS = Object.freeze({
  register: ['handle', 'password', 'confirm'],
  login: ['handle', 'password'],
  recover: ['handle', 'code', 'password', 'confirm'],
  password: ['oldPassword', 'password', 'confirm'],
});

/** What each field is called and how it behaves. `secret: true` is the
 *  difference between `type=password` and `type=text`, which is not a
 *  cosmetic choice: a recovery code read off a shoulder is the account. */
export const FIELD_SPEC = Object.freeze({
  handle: { label: 'Username', secret: false, max: 24, hint: 'One word, 3 to 24 characters, starting with a letter.' },
  password: { label: 'Password', secret: true, max: 200, hint: `At least ${PASSWORD_MIN_LEN} characters.` },
  confirm: { label: 'Repeat password', secret: true, max: 200, hint: '' },
  oldPassword: { label: 'Current password', secret: true, max: 200, hint: '' },
  code: { label: 'Recovery code', secret: false, max: 40, hint: 'The code shown once when you registered.' },
});

/** THE CLIENT'S OWN REFUSALS - the ones the service cannot make,
 *  because it never sees them. `confirm` is not sent anywhere: the
 *  service takes one password and has no idea a second box existed. */
export const LOCAL_REFUSALS = Object.freeze({
  'confirm-mismatch': 'Those two passwords are not the same.',
  'handle-shape': 'A username is one word, 3 to 24 characters, starting with a letter, and no spaces.',
  'password-short': `A password is at least ${PASSWORD_MIN_LEN} characters.`,
  'code-empty': 'Type the recovery code you were given.',
  'password-empty': 'Type your password.',
  'handle-empty': 'Type your username.',
});

/**
 * The flow.
 *
 * @param {object} deps
 * @param {object} deps.io          `{ fetch, base }` - the account client's door
 * @param {object} deps.storage     appStorage, or anything with get/set/removeItem
 * @param {() => void} [deps.onChange]  called after every state change, so the
 *                                      renderer repaints without polling
 */
export function AccountFlow({ io, storage, onChange = () => {} }) {
  const self = {
    stage: /** @type {string} */ ('loading'),
    /** the account view from /v1/account, when signed in */
    account: /** @type {any} */ (null),
    /** ACC3c: `{ titles, title, glyphs }` from the same answer - what
     *  this account HOLDS, WEARS and is TRUE of. Null when nobody is
     *  signed in, and null from a service too old to answer one, which
     *  the card reads as "draw no picker" rather than "draw an empty
     *  one". */
    wardrobe: /** @type {any} */ (null),
    /** a sentence for the player, never a machine word */
    error: '',
    /** a sentence that is NOT a failure - "your password was changed" */
    note: '',
    /** readable once, held in memory only, never given to storage */
    recoveryCode: /** @type {string|null} */ (null),
    /** a submission is in flight; nothing else may start */
    busy: false,
    /** what the player has typed */
    values: /** @type {Record<string,string>} */ ({}),
  };

  const changed = () => { onChange(); };
  /** The session on this device, read fresh each time. Never cached in
   *  a local: `forgetSession` can run from any arm and a stale copy is
   *  how a signed-out card goes on sending a dead credential. */
  const secret = () => storedSession(storage)?.secret ?? null;
  const door = () => ({ ...io, secret: secret() });

  /** Move, clearing what belonged to the stage being left. The values
   *  are WIPED on every move, which is the point: a password left in a
   *  field is a password left in the DOM. */
  function go(stage, { error = '', note = '' } = {}) {
    self.stage = stage;
    self.error = error;
    self.note = note;
    self.values = {};
    if (stage !== 'code') self.recoveryCode = null;
    changed();
  }

  /** A refusal that ends a submission: the sentence shows, the stage
   *  stays, and what was typed SURVIVES - a player who mistyped one of
   *  four fields should not retype the other three. */
  function refuse(error) {
    self.error = error;
    self.busy = false;
    changed();
    return false;
  }

  /** The service says the credential is dead. That is not an error to
   *  show on this stage - the stage is gone. Forget it and land on
   *  `out` saying why, or a card would go on offering "Change
   *  password" for an account nobody is signed in to. */
  function signedOut(message) {
    forgetSession(storage);
    self.account = null;
    self.wardrobe = null;   // ACC3c: a wardrobe outliving its account is a title drawn for nobody
    self.busy = false;
    go('out', { error: message });
    return false;
  }

  /** Every call goes through here so `auth` is handled in exactly one
   *  place. A second place is a second chance to forget. */
  async function ask(fn) {
    const r = await fn();
    if (!r.ok && r.error === 'auth') { signedOut(accountRefusalText('auth')); return null; }
    return r;
  }

  self.set = (field, value) => {
    self.values[field] = value;
    // The error belongs to the press, not to the keystroke: it is
    // cleared as soon as the player starts fixing it, so a stale
    // sentence never sits under a field they have already corrected.
    if (self.error) { self.error = ''; changed(); }
  };

  self.go = (stage) => {
    if (self.busy) return;   // a cancel mid-flight would strand the call
    go(stage);
  };

  /** Boot: if this device has a session, say who it belongs to. A
   *  device with none lands on `out` without a single request - a menu
   *  that cannot open until a network call returns is a menu that does
   *  not open on a train. */
  self.start = async () => {
    if (!secret()) { go('out'); return; }
    self.stage = 'loading'; changed();
    const r = await ask(() => readAccount(door()));
    if (!r) return;                       // `auth` already landed on `out`
    if (!r.ok) {
      // NOT a sign-out. `offline` and `server` say nothing about
      // whether the credential is good, and throwing away a working
      // session because a Worker had a bad second would be a player
      // signed out by a blip.
      go('in', { error: accountRefusalText(r.error) });
      self.account = storedSession(storage);
      changed();
      return;
    }
    self.account = r.data.account;
    // ACC3c: THE WARDROBE IS ITS OWN FIELD, exactly as the service
    // answers it - what this account HOLDS, what it WEARS, and what is
    // true of it. Held beside `account` rather than folded into it,
    // because they are different kinds of fact: an account view is the
    // row, a wardrobe is the row read against the service's config and
    // clock. A service too old to answer one leaves it null, and the
    // card then draws no picker at all rather than an empty one.
    self.wardrobe = r.data.wardrobe ?? null;
    go('in');
  };

  /**
   * ACC3c — WEAR ONE, OR NONE. Mac: "Players can tap the account icon
   * to equip 1 feature along with signing out."
   *
   * IT ASKS; IT DOES NOT DECIDE. The grant is derived at the service
   * (a founder cutoff, a config list) and can lapse between this card
   * being drawn and this button being pressed - a developer taken off
   * the list is the real case - so `not-held` is a sentence a player
   * can meet and the answer REPLACES the wardrobe rather than patching
   * it. A client that kept its own idea of what is held would be a
   * client that can wear anything, which is the hole ACC1g shut one
   * field over.
   *
   * PRESSING THE ONE ALREADY WORN IS TAKING IT OFF, because a picker
   * where the only way to wear nothing is a separate button is a
   * picker with a button that does nothing most of the time.
   */
  self.equip = async (title) => {
    if (self.busy || self.stage !== 'in') return false;
    const want = self.wardrobe?.title === title ? null : (title ?? null);
    self.busy = true; self.error = ''; self.note = ''; changed();
    try {
      const r = await ask(() => equipTitle(door(), want));
      if (!r) return false;                 // `auth` already landed on `out`
      if (!r.ok) return refuse(accountRefusalText(r.error));
      // THE SERVICE'S OWN ANSWER, whole: it describes the row AFTER
      // the write, so nothing here has to guess what took and what did
      // not - and a title that lapsed comes back missing from `titles`
      // in the same breath as the refusal would have.
      self.wardrobe = { titles: r.data.titles, title: r.data.title, glyphs: r.data.glyphs };
      self.busy = false;
      self.note = want ? `Wearing ${want}.` : 'Title removed.';
      changed();
      return true;
    } catch {
      return refuse(accountRefusalText('offline'));
    }
  };

  /** THE ONE SUBMISSION DOOR. Dispatches on the stage, so a button
   *  never decides what it means. */
  self.submit = async () => {
    if (self.busy) return false;          // ONE PRESS IS ONE ACCOUNT
    self.busy = true; self.error = ''; self.note = ''; changed();
    try {
      if (self.stage === 'register') return await doRegister();
      if (self.stage === 'login') return await doLogin();
      if (self.stage === 'recover') return await doRecover();
      if (self.stage === 'password') return await doPassword();
      return refuse('');
    } finally {
      // Whatever happened, the card is pressable again. A `busy` left
      // true by a throw is a screen a player has to reload out of.
      self.busy = false;
      changed();
    }
  };

  const v = (k) => (self.values[k] ?? '').trim();
  /** A password is NOT trimmed. Leading and trailing spaces are
   *  characters a player may have chosen deliberately, and trimming
   *  one here while the service hashes what it was sent is a login
   *  that works today and fails from another client tomorrow. */
  const pw = (k) => self.values[k] ?? '';

  /** The checks the service cannot make, in the order a player meets
   *  them. Done BEFORE the request, because a round trip to learn the
   *  two boxes differ is a round trip that told nobody anything. */
  function localRefusal(fields) {
    if (fields.includes('handle') && !v('handle')) return LOCAL_REFUSALS['handle-empty'];
    if (fields.includes('handle') && !handleShapeOk(v('handle'))) return LOCAL_REFUSALS['handle-shape'];
    if (fields.includes('code') && !v('code')) return LOCAL_REFUSALS['code-empty'];
    if (fields.includes('oldPassword') && !pw('oldPassword')) return LOCAL_REFUSALS['password-empty'];
    if (fields.includes('password') && !pw('password')) return LOCAL_REFUSALS['password-empty'];
    if (fields.includes('password') && [...pw('password')].length < PASSWORD_MIN_LEN) return LOCAL_REFUSALS['password-short'];
    if (fields.includes('confirm') && pw('password') !== pw('confirm')) return LOCAL_REFUSALS['confirm-mismatch'];
    return null;
  }

  /**
   * REGISTERING IS AN UPGRADE IN PLACE, and that is why it is two
   * calls. `/v1/auth/register` needs a session, because it fills a
   * handle and a password onto the guest row THAT SESSION OWNS. A
   * device with no session has no row to upgrade, so one is opened
   * first - and a device that already has a guest session upgrades
   * that one rather than opening a second.
   */
  async function doRegister() {
    const bad = localRefusal(FIELDS.register);
    if (bad) return refuse(bad);

    if (!secret()) {
      const made = await ask(() => openGuest(io));
      if (!made) return false;
      if (!made.ok) return refuse(accountRefusalText(made.error));
      // KEPT BEFORE THE UPGRADE IS ATTEMPTED. If `register` fails on
      // `handle-taken`, the guest row and its session are real and this
      // device owns them - dropping the secret here would strand a row
      // and make the next press open another.
      keepSession(storage, made.data);
    }

    const r = await ask(() => register(door(), v('handle'), pw('password')));
    if (!r) return false;
    if (!r.ok) return refuse(accountRefusalText(r.error));

    // THE ONE MOMENT THE CODE IS READABLE.
    self.recoveryCode = r.data.recoveryCode;
    self.stage = 'code';
    self.values = {};
    self.error = '';
    changed();
    return true;
  }

  async function doLogin() {
    const bad = localRefusal(FIELDS.login);
    if (bad) return refuse(bad);
    const r = await ask(() => login(io, v('handle'), pw('password')));
    if (!r) return false;
    if (!r.ok) return refuse(accountRefusalText(r.error));
    keepSession(storage, r.data);
    await self.start();
    return true;
  }

  /**
   * RECOVERY SIGNS EVERY DEVICE OUT, including this one - the reason
   * somebody is recovering may be that another person has their
   * password. The service opens a fresh session for the device that
   * recovered and mints a NEW recovery code, because a player left
   * with no way back in has had the same cliff moved one step.
   */
  async function doRecover() {
    const bad = localRefusal(FIELDS.recover);
    if (bad) return refuse(bad);
    const r = await ask(() => recover(io, v('handle'), v('code'), pw('password')));
    if (!r) return false;
    if (!r.ok) return refuse(accountRefusalText(r.error));
    keepSession(storage, r.data);
    self.recoveryCode = r.data.recoveryCode;
    self.stage = 'code';
    self.values = {};
    self.error = '';
    changed();
    return true;
  }

  /** The old password is required even from inside a live session, so
   *  a stolen device cannot lock its owner out. Every OTHER device is
   *  signed out; this one stays. */
  async function doPassword() {
    const bad = localRefusal(FIELDS.password);
    if (bad) return refuse(bad);
    const r = await ask(() => changePassword(door(), pw('oldPassword'), pw('password')));
    if (!r) return false;
    if (!r.ok) return refuse(accountRefusalText(r.error));
    go('in', { note: 'Your password was changed. Every other device has been signed out.' });
    return true;
  }

  /** Leaving `code`. The only way off that stage, and it is deliberate:
   *  the code is dropped here and nothing anywhere can print it again. */
  self.acknowledgeCode = async () => {
    if (self.stage !== 'code') return;
    self.recoveryCode = null;
    await self.start();
  };

  /** THIS device by default. `all` is separate and explicit, because
   *  signing out of a laptop has never dropped somebody's phone. */
  self.signOut = async (all = false) => {
    if (self.busy) return;
    self.busy = true; changed();
    try {
      // The answer is not checked, and that is deliberate: the session
      // is being abandoned either way. A service that cannot be reached
      // must not leave a player stuck signed in on a device they are
      // trying to leave - the row expires on its own (SESSION_IDLE_S).
      await logout(door(), all).catch(() => {});
    } finally {
      forgetSession(storage);
      self.account = null;
      self.wardrobe = null;
      self.busy = false;
      go('out', { note: all ? 'Signed out everywhere.' : 'Signed out.' });
    }
  };

  return self;
}
