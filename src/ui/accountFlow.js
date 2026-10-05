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
  openGuest, register, login, recover, readAccount, changePassword, logout, equipTitle, equipAura, equipGlyph, adoptIdentity, unlinkPatreon,
  storedSession, keepSession, forgetSession, accountRefusalText, handleShapeOk,
  PASSWORD_MIN_LEN,
} from '../net/accountClient.js';
import { ACCEPTED, TERMS_URL, PRIVACY_URL } from '../net/legalLaw.js';   // TERMS1: the documents a new account agrees to
import { AURA_TEXT } from './playerBadge.js';   // SHADOW-CLOAK (AUDIT): an aura's name in the card's note

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

/** TERMS1 — WHAT EACH STAGE ASKS A PLAYER TO AGREE TO, in the order it
 *  asks. "I wanna make sure these need to be reviewed and checked off by
 *  players before creating an account". Walked by the renderer as FIELDS
 *  is, so a stage cannot ask for a box the card does not draw.
 *
 *  ONLY REGISTERING ASKS. It is the one stage that makes an account - the
 *  guest row is opened inside it - and an account that already exists is
 *  not asked again on signing in (new accounts only, the request's own
 *  answer). The service asks the same question of both routes that make
 *  one (server-account/src/accounts.js `legalRefusal`), so a client that
 *  skipped the boxes would still make nothing. */
export const AGREEMENTS = Object.freeze({
  register: ['terms', 'privacy'],
});

/** What each box agrees to, and where that document is read. */
export const AGREEMENT_SPEC = Object.freeze({
  terms: { label: 'Terms of Service', url: TERMS_URL },
  privacy: { label: 'Privacy Policy', url: PRIVACY_URL },
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
  // TERMS1: one sentence a box, naming the document - "tick the boxes" under two boxes says nothing about which
  'terms-unticked': 'Read and agree to the Terms of Service to create an account.',
  'privacy-unticked': 'Read and agree to the Privacy Policy to create an account.',
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
    /** PATREON-LINK: the card's Patreon row as the service answers it - `{ on, linked, titles, link }` - or null (nobody
     *  signed in, or a service from before acct45), which draws no row. */
    patreon: /** @type {any} */ (null),
    /** PATREON-LINK: the link was followed and the player has not come back to a linked account yet */
    patreonWaiting: false,
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
    /** TERMS1: the boxes the player has ticked. Wiped on every move, as
     *  `values` is, so a box is only ever ticked by the player, on the
     *  stage in front of them - never carried in from one they left. */
    agreed: /** @type {Record<string,boolean>} */ ({}),
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
    self.agreed = {};
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
    self.patreon = null; self.patreonWaiting = false;   // PATREON-LINK: and a link for nobody
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

  /** TERMS1: a box ticked or unticked. Only `true` ticks it - a box is an
   *  agreement, and nothing that is merely truthy gets to be one. Clears a
   *  refusal as a keystroke does, for the same reason. */
  self.agree = (key, on) => {
    self.agreed[key] = on === true;
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
    const asked = secret();   // AUDIT B4: the session this read describes
    if (!asked) { go('out'); return; }
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
    // NAME-ADOPT: AND THE STORED SESSION LEARNS IT. `register` answers
    // the handle and a recovery code - not a session - so the session
    // this device keeps was still written with the GUEST's name, and the
    // top-right button reads the stored session. This is the next answer
    // that states the name after a registration (acknowledging the code
    // lands here), and it is the service's own word, so it is adopted.
    adoptIdentity(storage, { name: r.data.account?.name, kind: r.data.account?.kind, glyphs: r.data.wardrobe?.glyphs, glyphsOff: r.data.wardrobe?.glyphsOff, aura: auraStated(r.data.wardrobe), secret: asked });   // SHADOW-FANG: and what is true of the account; AUDIT B4: into the session that asked; WB9g: and the aura worn
    // ACC3c: THE WARDROBE IS ITS OWN FIELD, exactly as the service
    // answers it - what this account HOLDS, what it WEARS, and what is
    // true of it. Held beside `account` rather than folded into it,
    // because they are different kinds of fact: an account view is the
    // row, a wardrobe is the row read against the service's config and
    // clock. A service too old to answer one leaves it null, and the
    // card then draws no picker at all rather than an empty one.
    self.wardrobe = r.data.wardrobe ?? null;
    self.patreon = r.data.patreon ?? null;   // PATREON-LINK: the card's Patreon row, or none from a service before it
    go('in');
  };

  /**
   * PATREON-LINK - THE PLAYER FOLLOWED THE LINK. Linking happens in a browser (a new tab, or the system browser from the
   * desktop app) and ends on a page of the service's, so all the card can do is say where the player is and read the
   * account again when they come back (`refresh`, which the card calls when the window has the focus again).
   */
  self.patreonOpened = () => {
    if (self.stage !== 'in') return;
    self.patreonWaiting = true;
    self.error = '';
    self.note = 'Finish on Patreon, then come back here.';
    changed();
  };

  /**
   * PATREON-LINK - THE ACCOUNT READ AGAIN, ON THE CARD THAT IS UP. `start` without its `loading` stage: the card stays
   * drawn while the service is asked, and a blip leaves it as it was (`start`'s own rule - a failed read says nothing
   * about the session). A link that landed, or a pledge that moved, comes back in the wardrobe and the Patreon row.
   */
  self.refresh = async () => {
    if (self.busy || self.stage !== 'in') return false;
    const asked = secret();
    if (!asked) return false;
    const r = await ask(() => readAccount(door()));
    if (!r || !r.ok || self.stage !== 'in' || secret() !== asked) return false;   // signed out, a blip, or another account since
    const was = self.patreon;
    const d = r.data;
    self.account = d.account;
    adoptIdentity(storage, { name: d.account?.name, kind: d.account?.kind, glyphs: d.wardrobe?.glyphs, glyphsOff: d.wardrobe?.glyphsOff, aura: auraStated(d.wardrobe), secret: asked });   // `start`'s word, adopted as it adopts it
    self.wardrobe = d.wardrobe ?? null;
    self.patreon = d.patreon ?? null;
    if (self.patreonWaiting && self.patreon?.linked && (!was?.linked || String(was.titles) !== String(self.patreon.titles))) {
      self.patreonWaiting = false;
      self.note = self.patreon.titles?.length ? 'Patreon linked. Wear your title under Title.' : 'Patreon linked. Your title arrives when your pledge holds one.';
    }
    changed();
    return true;
  };

  /** PATREON-LINK - UNLINK: the account's Patreon off it. The answer is the wardrobe after it, as an equip's is - a title
   *  the pledge held is held no more, nor worn - and the card's row. */
  self.unlinkPatreon = async () => {
    if (self.busy || self.stage !== 'in') return false;
    const asked = secret();
    self.busy = true; self.error = ''; self.note = ''; changed();
    try {
      const r = await ask(() => unlinkPatreon(door()));
      if (!r) return false;
      if (!r.ok) return refuse(accountRefusalText(r.error));
      self.wardrobe = { ...(self.wardrobe ?? {}), titles: r.data.titles, title: r.data.title, glyphs: r.data.glyphs, ...glyphHalf(r.data), ...auraHalf(r.data) };   // the service's word whole: a tier's title gone with the link
      self.patreon = r.data.patreon ?? null;
      self.patreonWaiting = false;
      self.busy = false;
      self.note = 'Patreon unlinked.';
      adoptIdentity(storage, { glyphs: r.data.glyphs, glyphsOff: r.data.glyphsOff, aura: auraStated(r.data), secret: asked });   // a lapsed tier's glyph off my own screen at once
      changed();
      return true;
    } catch {
      return refuse(accountRefusalText('offline'));
    }
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
    const asked = secret();
    self.busy = true; self.error = ''; self.note = ''; changed();
    try {
      const r = await ask(() => equipTitle(door(), want));
      if (!r) return false;                 // `auth` already landed on `out`
      if (!r.ok) return refuse(accountRefusalText(r.error));
      // THE SERVICE'S OWN ANSWER, whole: it describes the row AFTER
      // the write, so nothing here has to guess what took and what did
      // not - and a title that lapsed comes back missing from `titles`
      // in the same breath as the refusal would have.
      self.wardrobe = { ...(self.wardrobe ?? {}), titles: r.data.titles, title: r.data.title, glyphs: r.data.glyphs, ...glyphHalf(r.data), ...auraHalf(r.data) };   // WB9g: the auras ride the same answer
      self.busy = false;
      self.note = want ? `Wearing ${want}.` : 'Title removed.';
      adoptIdentity(storage, { glyphs: r.data.glyphs, glyphsOff: r.data.glyphsOff, aura: auraStated(r.data), secret: asked });   // WB9g: my own screen's word, from the answer (AUDIT B4: into the session that asked)
      changed();
      return true;
    } catch {
      return refuse(accountRefusalText('offline'));
    }
  };

  /**
   * GLYPH-WEAR (2026-10-02, Mac: "can we make it where players can also equip/unequip their glyphs") - PRESS A GLYPH
   * TO TAKE IT OFF, PRESS IT AGAIN TO PUT IT BACK. Paint alone: the service still signs every glyph that is true, so
   * what a glyph grants (/red, /dm, /mute, the staff commands) stays. It asks, as the title does; the answer replaces
   * the wardrobe. Others see it from the next hello, as a title.
   */
  self.toggleGlyph = async (glyph) => {
    if (self.busy || self.stage !== 'in') return false;
    const on = (self.wardrobe?.glyphsOff ?? []).includes(glyph);   // hidden now, so this press shows it
    const asked = secret();
    self.busy = true; self.error = ''; self.note = ''; changed();
    try {
      const r = await ask(() => equipGlyph(door(), glyph, on));
      if (!r) return false;
      if (!r.ok) return refuse(accountRefusalText(r.error));
      self.wardrobe = { ...(self.wardrobe ?? {}), titles: r.data.titles, title: r.data.title, glyphs: r.data.glyphs, glyphsOff: r.data.glyphsOff ?? [], ...auraHalf(r.data) };   // absent is none
      self.busy = false;
      self.note = on ? 'Glyph shown.' : 'Glyph hidden.';
      adoptIdentity(storage, { glyphs: r.data.glyphs, glyphsOff: r.data.glyphsOff, aura: auraStated(r.data), secret: asked });   // my own screen's word: the shown glyphs dress my werewolf
      changed();
      return true;
    } catch {
      return refuse(accountRefusalText('offline'));
    }
  };

  /** GLYPH-WEAR: the glyphs a wardrobe answer says are taken off - none from a service before acct50. */
  const glyphHalf = (d) => (Array.isArray(d?.glyphsOff) ? { glyphsOff: d.glyphsOff } : {});
  /** WB9g: the aura half of a wardrobe answer - what a service since acct38 says (its auras held, the one worn, the
   *  Broker's insignia owned), or nothing from one before it. */
  const auraHalf = (d) => (Array.isArray(d?.auras) ? { auras: d.auras, aura: d.aura ?? null, insignia: Array.isArray(d.insignia) ? d.insignia : [] } : {});
  /** WB9g: the aura a wardrobe answer says is worn (null for none), or undefined from a service before acct38. */
  function auraStated(d) { return Array.isArray(d?.auras) ? (d.aura ?? null) : undefined; }
  /**
   * WB9g - WEAR ONE AURA, OR NONE: `equip`'s law at the feet (Mac: "an animated burning ground aura that circles the
   * ground where your character stands"). It asks; the service decides what is held; the answer replaces the wardrobe;
   * pressing the one worn takes it off. The stored session learns it (net/accountClient.js adoptIdentity), so the fire
   * at the player's own feet lights or goes out at once - and the room's at once (AURA-LIVE: world.js auraFrame - online.js rehello).
   */
  self.wearAura = async (aura) => {
    if (self.busy || self.stage !== 'in') return false;
    const want = self.wardrobe?.aura === aura ? null : (aura ?? null);
    const asked = secret();
    self.busy = true; self.error = ''; self.note = ''; changed();
    try {
      const r = await ask(() => equipAura(door(), want));
      if (!r) return false;
      if (!r.ok) return refuse(accountRefusalText(r.error));
      self.wardrobe = { ...(self.wardrobe ?? {}), titles: r.data.titles, title: r.data.title, glyphs: r.data.glyphs, ...glyphHalf(r.data), ...auraHalf(r.data) };
      self.busy = false;
      self.note = want ? `Wearing ${AURA_TEXT[want] ?? want}.` : 'Aura removed.';   // SHADOW-CLOAK (AUDIT): the aura's name, never its key
      adoptIdentity(storage, { glyphs: r.data.glyphs, glyphsOff: r.data.glyphsOff, aura: auraStated(r.data), secret: asked });
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
  function localRefusal(fields, agreements = []) {
    if (fields.includes('handle') && !v('handle')) return LOCAL_REFUSALS['handle-empty'];
    if (fields.includes('handle') && !handleShapeOk(v('handle'))) return LOCAL_REFUSALS['handle-shape'];
    if (fields.includes('code') && !v('code')) return LOCAL_REFUSALS['code-empty'];
    if (fields.includes('oldPassword') && !pw('oldPassword')) return LOCAL_REFUSALS['password-empty'];
    if (fields.includes('password') && !pw('password')) return LOCAL_REFUSALS['password-empty'];
    if (fields.includes('password') && [...pw('password')].length < PASSWORD_MIN_LEN) return LOCAL_REFUSALS['password-short'];
    if (fields.includes('confirm') && pw('password') !== pw('confirm')) return LOCAL_REFUSALS['confirm-mismatch'];
    // TERMS1: the boxes sit under the fields, so they are met after them.
    // NO REQUEST LEAVES WITHOUT BOTH - the guest row the service opens
    // first is itself an account, and a player who has not agreed is
    // not one the form may make.
    for (const key of agreements) if (self.agreed[key] !== true) return LOCAL_REFUSALS[`${key}-unticked`];
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
    const bad = localRefusal(FIELDS.register, AGREEMENTS.register);
    if (bad) return refuse(bad);

    // TERMS1: both requests carry the versions the player just ticked -
    // the service opens no row, and names none, without them.
    if (!secret()) {
      const made = await ask(() => openGuest(io, null, ACCEPTED));
      if (!made) return false;
      if (!made.ok) return refuse(accountRefusalText(made.error));
      // KEPT BEFORE THE UPGRADE IS ATTEMPTED. If `register` fails on
      // `handle-taken`, the guest row and its session are real and this
      // device owns them - dropping the secret here would strand a row
      // and make the next press open another.
      keepSession(storage, made.data);
    }

    const r = await ask(() => register(door(), v('handle'), pw('password'), ACCEPTED));
    if (!r) return false;
    if (!r.ok) return refuse(accountRefusalText(r.error));

    // THE ONE MOMENT THE CODE IS READABLE.
    self.recoveryCode = r.data.recoveryCode;
    self.stage = 'code';
    self.values = {};
    self.agreed = {};
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
      self.patreon = null; self.patreonWaiting = false;   // PATREON-LINK
      self.busy = false;
      go('out', { note: all ? 'Signed out everywhere.' : 'Signed out.' });
    }
  };

  return self;
}
