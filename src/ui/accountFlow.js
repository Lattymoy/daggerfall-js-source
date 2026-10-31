// @ts-check
// ═══════════════════════════════════════════════════════════════════
// ACC1e — THE ACCOUNT SCREEN'S FLOW, WITH NO SCREEN IN IT.
//
// Mac (2026-09-21): "Should we go ahead and build the account creation
// screen" - "Yes, please be detailed".
//
// THE SPLIT IS THE PROJECT'S OWN, not an invention: `ChargenFlow` does
// the wizard's thinking and `enhancedChargen.js` draws it, and
// test/ui/enhanced/enhancedChargen.test.js says why - "node cannot draw them; what
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
// RECOVERY-SET: a SET of eight now, each spent alone, and the profile
// can mint a new set behind the password (the `codes` stage) - still
// shown once, because the service keeps only their hashes.
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
  openGuest,
  register,
  login,
  recover,
  readAccount,
  changePassword,
  logout,
  equipTitle,
  equipAura,
  equipArmory,
  equipArmoryKit,
  equipEffect,
  equipIcon,
  equipGlyph,
  adoptIdentity,
  unlinkPatreon,
  buyAurumWare, // AURUM: a ware bought for Aurum (AURUM-ONLY: any but a pack)
  passUnlock,
  passBuy, // PASS-PANELS: a premium track opened and a track's item bought, for Aurum
  newRecoveryCodes, // RECOVERY-SET: a new set of recovery codes, from the profile
  chooseNameAs, // NAME-AS: which name the room reads
  storedSession,
  keepSession,
  forgetSession,
  accountRefusalText,
  handleShapeOk,
  PASSWORD_MIN_LEN,
} from '../net/accountClient.js';
import { handleLooksLikeEmail } from '../net/handleShape.js'; // HANDLE-EMAIL: a new username is never an address
import { ACCEPTED, TERMS_URL, PRIVACY_URL } from '../net/legalLaw.js'; // TERMS1: the documents a new account agrees to
import { t, localizedTable } from '../systems/textManager.js'; // L10N4: the card's words in the player's language, read when they are drawn
import { AURA_TEXT, TITLE_TEXT } from './playerBadge.js'; // SHADOW-CLOAK (AUDIT): an aura's name in the card's note - COLLECTIONS-II: and a title's
import { ICON_TEXT } from './profileIcons.js'; // WITCH1: an icon's name in the card's note
import { armoryKitOk, armoryKitPieces } from '../net/armoryLaw.js'; // ARMORY: the kit a wardrobe states, and its pieces
import { armoryPieceName } from './armoryText.js'; // ARMORY: a piece's name in the card's note
import { effectKitOk, effectWorn } from '../net/effectLaw.js'; // STOREFRONT: the effects kit a wardrobe states
import { effectName, effectsHeldOf } from './effectText.js'; // STOREFRONT: an effect's name in the card's note
import { shopCardOf, shopWareById, SHOP_WARE_NAME } from '../net/shopLaw.js'; // SHOP: the shop's card on the account read
import { passCardOf, passSeasonById } from '../net/battlePassLaw.js'; // STOREFRONT: and the season's card beside it
import { passGrantName, PASS_SEASON_TEXT } from './passText.js'; // PASS-PANELS: an item's and a season's name in the card's note
import { aurumCardOf } from '../net/aurumLaw.js'; // AURUM: and the Aurum's

/** SHOP: a ware's name as the arrival's note says it - a piece's and an effect's in the player's language (STOREFRONT),
 *  the rest the shop's own. */
const arrivedName = (/** @type {string} */ id) => {
  const [kind, key] = id.split(':');
  if (kind === 'armory') return armoryPieceName(key);
  if (kind === 'kill' || kind === 'portal' || kind === 'mount') return effectName(kind, key);
  if (kind === 'icon') return ICON_TEXT[/** @type {keyof typeof ICON_TEXT} */ (key)] ?? key; // AURUM: the daily wares' own
  if (kind === 'title') return TITLE_TEXT[/** @type {keyof typeof TITLE_TEXT} */ (key)] ?? key;
  if (kind === 'aurum') return t('account.flow.aurumPack', '{n, number} Aurum', { n: Number(key) || 0 });
  return SHOP_WARE_NAME[/** @type {keyof typeof SHOP_WARE_NAME} */ (id)] ?? id;
};

/** Every stage this card can be on. Exported because a pin that
 *  enumerates them by hand is a pin that stops covering the one added
 *  on a Friday. */
export const STAGES = Object.freeze([
  'loading', // a stored session is being checked against the service
  'out', // no account on this device
  'register', // choosing a username and password
  'login', // signing in on this device
  'recover', // spending the recovery code
  'code', // THE CODE, readable once, and the only way on is to acknowledge it
  'in', // signed in
  'password', // changing the password from inside a session
  'codes', // RECOVERY-SET: a new set of recovery codes, behind the password
]);

/** The fields each stage asks for, in the order they are asked. The
 *  renderer walks THIS rather than carrying its own list, so a stage
 *  cannot grow a field the screen does not draw. */
export const FIELDS = Object.freeze({
  register: ['handle', 'password', 'confirm'],
  login: ['handle', 'password'],
  recover: ['handle', 'code', 'password', 'confirm'],
  password: ['oldPassword', 'password', 'confirm'],
  codes: ['oldPassword', 'code'], // RECOVERY-SET: the password, as changing it asks - AUDIT RECOVERY-SET A1: and a code the new set replaces
});

/** What each field is called and how it behaves. `secret: true` is the
 *  difference between `type=password` and `type=text`, which is not a
 *  cosmetic choice: a recovery code read off a shoulder is the account. */
export const FIELD_SPEC = Object.freeze({
  // L10N4: the words are getters, read when the field is drawn
  handle: {
    get label() {
      return t('account.field.handle', 'Username');
    },
    secret: false,
    max: 24,
    get hint() {
      return t('account.field.handleHint', 'One word, 3 to 24 characters, starting with a letter.');
    },
  },
  password: {
    get label() {
      return t('account.field.password', 'Password');
    },
    secret: true,
    max: 200,
    get hint() {
      return t('account.field.passwordHint', 'At least {min} characters.', { min: PASSWORD_MIN_LEN });
    },
  },
  confirm: {
    get label() {
      return t('account.field.confirm', 'Repeat password');
    },
    secret: true,
    max: 200,
    hint: '',
  },
  oldPassword: {
    get label() {
      return t('account.field.oldPassword', 'Current password');
    },
    secret: true,
    max: 200,
    hint: '',
  },
  code: {
    get label() {
      return t('account.field.code', 'Recovery code');
    },
    secret: false,
    max: 40,
    get hint() {
      return t('account.field.codeHint', 'One of the recovery codes you wrote down.');
    },
  }, // RECOVERY-SET: one of a set
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
  terms: {
    get label() {
      return t('account.agree.terms', 'Terms of Service');
    },
    url: TERMS_URL,
  },
  privacy: {
    get label() {
      return t('account.agree.privacy', 'Privacy Policy');
    },
    url: PRIVACY_URL,
  },
});

/** THE CLIENT'S OWN REFUSALS - the ones the service cannot make,
 *  because it never sees them. `confirm` is not sent anywhere: the
 *  service takes one password and has no idea a second box existed. */
export const LOCAL_REFUSALS = localizedTable({
  // L10N4: each a getter, read when it is said
  'confirm-mismatch': () => t('account.local.confirmMismatch', 'Those two passwords are not the same.'),
  'handle-shape': () =>
    t(
      'account.local.handleShape',
      'A username is one word, 3 to 24 characters, starting with a letter, and no spaces.',
    ),
  'password-short': () =>
    t('account.local.passwordShort', 'A password is at least {min} characters.', { min: PASSWORD_MIN_LEN }),
  'code-empty': () => t('account.local.codeEmpty', 'Type the recovery code you were given.'),
  'password-empty': () => t('account.local.passwordEmpty', 'Type your password.'),
  'handle-empty': () => t('account.local.handleEmpty', 'Type your username.'),
  // TERMS1: one sentence a box, naming the document - "tick the boxes" under two boxes says nothing about which
  'terms-unticked': () =>
    t('account.local.termsUnticked', 'Read and agree to the Terms of Service to create an account.'),
  'privacy-unticked': () =>
    t('account.local.privacyUnticked', 'Read and agree to the Privacy Policy to create an account.'),
});

/** RECOVERY-SET: the codes an answer carries, as the card shows them - a set (`recoveryCodes`), or the one a service from
 *  before the set answers (`recoveryCode`), or none (a recovery that left the set's others standing). */
export function codesOf(d) {
  if (Array.isArray(d?.recoveryCodes)) return d.recoveryCodes.filter((c) => typeof c === 'string' && c);
  return typeof d?.recoveryCode === 'string' && d.recoveryCode ? [d.recoveryCode] : [];
}

/** RECOVERY-SET: the codes as a file the player keeps - "Save as a file" on the card. Plain text, a code a line,
 *  numbered as the card numbers them. */
export function recoveryCodesText(handle, codes) {
  return [
    t('account.codes.fileHead', 'DFO Online recovery codes for {name}', { name: handle || '?' }),
    t('account.codes.fileNote', 'Each code works once, if you forget your password. Keep this file somewhere safe.'),
    '',
    ...codes.map((c, i) => `${i + 1}. ${c}`),
    '',
  ].join('\n');
}

/** RECOVERY-SET: the file's name - the account's username in it, so two accounts' files never overwrite each other. */
export const recoveryCodesFileName = (handle) =>
  `dfo-recovery-codes-${
    String(handle || 'account')
      .replace(/[^\w-]+/g, '')
      .toLowerCase() || 'account'
  }.txt`;

/** NAME-AS: what the card says once the service has taken a choice of name - which name the room reads from now. */
export const NAME_AS_NOTE = Object.freeze({
  account: 'Others now see your account name.',
  character: 'Others now see the name of the character you play online.',
});

/**
 * The flow.
 *
 * @param {object} deps
 * @param {object} deps.io          `{ fetch, base }` - the account client's door
 * @param {object} deps.storage     appStorage, or anything with get/set/removeItem
 * @param {() => void} [deps.onChange]  called after every state change, so the
 *                                      renderer repaints without polling
 * @param {() => number} [deps.now]  the epoch clock, ms - NAME-AS's stamp
 */
export function AccountFlow({ io, storage, onChange = () => {}, now = () => Date.now() }) {
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
    /** SHOP: the shop's card as the service answers it (net/shopLaw.js shopCardOf) - its wares, what is held, a Buy link
     *  each - or null (nobody signed in, a service from before acct205) */
    shop: /** @type {any} */ (null),
    /** SHOP: the ware whose payment page the player went to, until the account read says it is held */
    shopWaiting: /** @type {string|null} */ (null),
    /** AURUM: the balance when a pack's page was followed - a pack is never held, so its arrival is the balance rising */
    shopWaitingFrom: /** @type {number|null} */ (null),
    /** AURUM: the Aurum's card (net/aurumLaw.js aurumCardOf) - the balance, the day's wares, the week's deeds - or null
     *  (nobody signed in, a guest, a service from before acct220) */
    aurum: /** @type {any} */ (null),
    /** STOREFRONT: the season's card (net/battlePassLaw.js passCardOf) - the tracks opened, the items bought, the day's
     *  Aurum found and the challenges - or null (nobody signed in, a guest, a service from before acct220) */
    pass: /** @type {any} */ (null),
    /** a sentence for the player, never a machine word */
    error: '',
    /** a sentence that is NOT a failure - "your password was changed" */
    note: '',
    /** readable once, held in memory only, never given to storage - RECOVERY-SET: the set shown, a code each */
    recoveryCodes: /** @type {string[]|null} */ (null),
    /** RECOVERY-SET: whose they are - the username the saved file names */
    codesFor: '',
    /** a submission is in flight; nothing else may start */
    busy: false,
    /** what the player has typed */
    values: /** @type {Record<string,string>} */ ({}),
    /** TERMS1: the boxes the player has ticked. Wiped on every move, as
     *  `values` is, so a box is only ever ticked by the player, on the
     *  stage in front of them - never carried in from one they left. */
    agreed: /** @type {Record<string,boolean>} */ ({}),
  };

  const changed = () => {
    onChange();
  };
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
    if (stage !== 'code') {
      self.recoveryCodes = null;
      self.codesFor = '';
    }
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
    self.wardrobe = null; // ACC3c: a wardrobe outliving its account is a title drawn for nobody
    self.patreon = null;
    self.patreonWaiting = false; // PATREON-LINK: and a link for nobody
    self.shop = null;
    self.shopWaiting = null;
    self.pass = null;
    self.aurum = null; // SHOP: and a Buy link for nobody; STOREFRONT: nor a season's card; AURUM: nor a balance
    self.busy = false;
    go('out', { error: message });
    return false;
  }

  /** Every call goes through here so `auth` is handled in exactly one
   *  place. A second place is a second chance to forget. */
  async function ask(fn) {
    const r = await fn();
    if (!r.ok && r.error === 'auth') {
      signedOut(accountRefusalText('auth'));
      return null;
    }
    return r;
  }

  self.set = (field, value) => {
    self.values[field] = value;
    // The error belongs to the press, not to the keystroke: it is
    // cleared as soon as the player starts fixing it, so a stale
    // sentence never sits under a field they have already corrected.
    if (self.error) {
      self.error = '';
      changed();
    }
  };

  /** TERMS1: a box ticked or unticked. Only `true` ticks it - a box is an
   *  agreement, and nothing that is merely truthy gets to be one. Clears a
   *  refusal as a keystroke does, for the same reason. */
  self.agree = (key, on) => {
    self.agreed[key] = on === true;
    if (self.error) {
      self.error = '';
      changed();
    }
  };

  self.go = (stage) => {
    if (self.busy) return; // a cancel mid-flight would strand the call
    go(stage);
  };

  /** Boot: if this device has a session, say who it belongs to. A
   *  device with none lands on `out` without a single request - a menu
   *  that cannot open until a network call returns is a menu that does
   *  not open on a train. */
  self.start = async () => {
    const asked = secret(); // AUDIT B4: the session this read describes
    if (!asked) {
      go('out');
      return;
    }
    self.stage = 'loading';
    changed();
    const r = await ask(() => readAccount(door()));
    if (!r) return; // `auth` already landed on `out`
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
    adoptIdentity(storage, {
      name: r.data.account?.name,
      kind: r.data.account?.kind,
      glyphs: r.data.wardrobe?.glyphs,
      glyphsOff: r.data.wardrobe?.glyphsOff,
      aura: auraStated(r.data.wardrobe),
      armory: armoryStated(r.data.wardrobe),
      effects: effectsStated(r.data.wardrobe),
      icon: iconStated(r.data.wardrobe),
      secret: asked,
    }); // SHADOW-FANG: and what is true of the account; AUDIT B4: into the session that asked; WB9g: and the aura worn
    // ACC3c: THE WARDROBE IS ITS OWN FIELD, exactly as the service
    // answers it - what this account HOLDS, what it WEARS, and what is
    // true of it. Held beside `account` rather than folded into it,
    // because they are different kinds of fact: an account view is the
    // row, a wardrobe is the row read against the service's config and
    // clock. A service too old to answer one leaves it null, and the
    // card then draws no picker at all rather than an empty one.
    self.wardrobe = r.data.wardrobe ?? null;
    self.patreon = r.data.patreon ?? null; // PATREON-LINK: the card's Patreon row, or none from a service before it
    self.shop = shopCardOf(r.data.shop); // SHOP: the shop's card, or none from a service before it
    self.pass = passCardOf(r.data.pass); // STOREFRONT: the season's card, or none
    self.aurum = aurumCardOf(r.data.aurum); // AURUM: the Aurum's card, or none
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
    self.note = t('account.flow.patreonFinish', 'Finish on Patreon, then come back here.');
    changed();
  };

  /** SHOP - THE PLAYER FOLLOWED A BUY LINK. Paying happens on Stripe's page in a browser, so all the window can do is
   *  say where the player is and read the account again when they come back (`refresh`, on the window's focus). */
  self.shopOpened = (/** @type {string} */ id) => {
    if (self.stage !== 'in' || !shopWareById(id)) return;
    self.shopWaiting = id;
    self.shopWaitingFrom = self.aurum?.balance ?? 0; // AURUM: a pack arrives as the balance rising past this
    self.error = '';
    self.note = t('account.flow.shopFinish', 'Finish paying in your browser, then come back here.');
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
    if (!r || !r.ok || self.stage !== 'in' || secret() !== asked) return false; // signed out, a blip, or another account since
    const was = self.patreon;
    const d = r.data;
    self.account = d.account;
    adoptIdentity(storage, {
      name: d.account?.name,
      kind: d.account?.kind,
      glyphs: d.wardrobe?.glyphs,
      glyphsOff: d.wardrobe?.glyphsOff,
      aura: auraStated(d.wardrobe),
      armory: armoryStated(d.wardrobe),
      effects: effectsStated(d.wardrobe),
      icon: iconStated(d.wardrobe),
      secret: asked,
    }); // `start`'s word, adopted as it adopts it
    self.wardrobe = d.wardrobe ?? null;
    self.patreon = d.patreon ?? null;
    self.shop = shopCardOf(d.shop);
    self.pass = passCardOf(d.pass); // STOREFRONT
    self.aurum = aurumCardOf(d.aurum); // AURUM
    // SHOP: back from paying, the ware the read says is held now - said once, where the player looks; AURUM: a pack's
    // arrival is the balance risen past where it stood when its page was followed
    const pack = shopWareById(self.shopWaiting)?.kind === 'aurum';
    if (
      self.shopWaiting &&
      (pack
        ? (self.aurum?.balance ?? -Infinity) > (self.shopWaitingFrom ?? Infinity)
        : self.shop?.wares.some((w) => w.id === self.shopWaiting && w.held))
    ) {
      self.note = t('account.flow.shopArrived', '{name} is on your account. A receipt is in your mailbox.', {
        name: arrivedName(String(self.shopWaiting)),
      });
      self.shopWaiting = null;
      self.shopWaitingFrom = null;
    }
    if (
      self.patreonWaiting &&
      self.patreon?.linked &&
      (!was?.linked || String(was.titles) !== String(self.patreon.titles))
    ) {
      self.patreonWaiting = false;
      self.note = self.patreon.titles?.length
        ? t('account.flow.patreonLinkedTitle', 'Patreon linked. Wear your title under Title.')
        : t('account.flow.patreonLinked', 'Patreon linked. Your title arrives when your pledge holds one.');
    }
    changed();
    return true;
  };

  /** PATREON-LINK - UNLINK: the account's Patreon off it. The answer is the wardrobe after it, as an equip's is - a title
   *  the pledge held is held no more, nor worn - and the card's row. */
  self.unlinkPatreon = async () => {
    if (self.busy || self.stage !== 'in') return false;
    const asked = secret();
    self.busy = true;
    self.error = '';
    self.note = '';
    changed();
    try {
      const r = await ask(() => unlinkPatreon(door()));
      if (!r) return false;
      if (!r.ok) return refuse(accountRefusalText(r.error));
      self.wardrobe = {
        ...(self.wardrobe ?? {}),
        titles: r.data.titles,
        title: r.data.title,
        glyphs: r.data.glyphs,
        ...glyphHalf(r.data),
        ...auraHalf(r.data),
      }; // the service's word whole: a tier's title gone with the link
      self.patreon = r.data.patreon ?? null;
      self.patreonWaiting = false;
      self.busy = false;
      self.note = t('account.flow.patreonUnlinked', 'Patreon unlinked.');
      adoptIdentity(storage, {
        glyphs: r.data.glyphs,
        glyphsOff: r.data.glyphsOff,
        aura: auraStated(r.data),
        armory: armoryStated(r.data),
        effects: effectsStated(r.data),
        icon: iconStated(r.data),
        secret: asked,
      }); // a lapsed tier's glyph off my own screen at once
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
    self.busy = true;
    self.error = '';
    self.note = '';
    changed();
    try {
      const r = await ask(() => equipTitle(door(), want));
      if (!r) return false; // `auth` already landed on `out`
      if (!r.ok) return refuse(accountRefusalText(r.error));
      // THE SERVICE'S OWN ANSWER, whole: it describes the row AFTER
      // the write, so nothing here has to guess what took and what did
      // not - and a title that lapsed comes back missing from `titles`
      // in the same breath as the refusal would have.
      self.wardrobe = {
        ...(self.wardrobe ?? {}),
        titles: r.data.titles,
        title: r.data.title,
        glyphs: r.data.glyphs,
        ...glyphHalf(r.data),
        ...auraHalf(r.data),
      }; // WB9g: the auras ride the same answer
      self.busy = false;
      self.note = want
        ? t('account.flow.wearing', 'Wearing {what}.', { what: TITLE_TEXT[want] ?? want })
        : t('account.flow.titleRemoved', 'Title removed.'); // COLLECTIONS-II: the title's name, never its key (the Collections page says this note)
      adoptIdentity(storage, {
        glyphs: r.data.glyphs,
        glyphsOff: r.data.glyphsOff,
        aura: auraStated(r.data),
        armory: armoryStated(r.data),
        effects: effectsStated(r.data),
        icon: iconStated(r.data),
        secret: asked,
      }); // WB9g: my own screen's word, from the answer (AUDIT B4: into the session that asked)
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
    const on = (self.wardrobe?.glyphsOff ?? []).includes(glyph); // hidden now, so this press shows it
    const asked = secret();
    self.busy = true;
    self.error = '';
    self.note = '';
    changed();
    try {
      const r = await ask(() => equipGlyph(door(), glyph, on));
      if (!r) return false;
      if (!r.ok) return refuse(accountRefusalText(r.error));
      self.wardrobe = {
        ...(self.wardrobe ?? {}),
        titles: r.data.titles,
        title: r.data.title,
        glyphs: r.data.glyphs,
        glyphsOff: r.data.glyphsOff ?? [],
        ...auraHalf(r.data),
      }; // absent is none
      self.busy = false;
      self.note = on ? t('account.flow.glyphShown', 'Glyph shown.') : t('account.flow.glyphHidden', 'Glyph hidden.');
      adoptIdentity(storage, {
        glyphs: r.data.glyphs,
        glyphsOff: r.data.glyphsOff,
        aura: auraStated(r.data),
        armory: armoryStated(r.data),
        effects: effectsStated(r.data),
        icon: iconStated(r.data),
        secret: asked,
      }); // my own screen's word: the shown glyphs dress my werewolf
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
  const auraHalf = (d) =>
    Array.isArray(d?.auras)
      ? {
          auras: d.auras,
          aura: d.aura ?? null,
          insignia: Array.isArray(d.insignia) ? d.insignia : [],
          ...iconHalf(d),
          ...armoryHalf(d),
          ...effectsHalf(d),
        }
      : {};
  /** WITCH1: the icon half of a wardrobe answer - the profile icons held and the one worn, or nothing from a service
   *  before acct162. */
  const iconHalf = (d) => (Array.isArray(d?.icons) ? { icons: d.icons, icon: d.icon ?? null } : {});
  /** ARMORY: the Aura Armory half of a wardrobe answer - the pieces held and the kit worn, or nothing from a service before
   *  it. */
  const armoryHalf = (d) =>
    Array.isArray(d?.armoryHeld) ? { armoryHeld: d.armoryHeld, armory: armoryKitOk(d.armory) ? d.armory : null } : {};
  /** STOREFRONT: the effects half of a wardrobe answer - the kill effects, portal skins and mount looks held (a slot's
   *  keys) and the kit worn - or nothing from a service before it. */
  const effectsHalf = (d) =>
    d?.effectsHeld && typeof d.effectsHeld === 'object'
      ? { effectsHeld: effectsHeldOf(d.effectsHeld), effects: effectKitOk(d.effects) ? d.effects : null }
      : {};
  /** STOREFRONT: the effects kit a wardrobe answer says is worn (null for none), or undefined from a service before it. */
  function effectsStated(d) {
    return d?.effectsHeld && typeof d.effectsHeld === 'object'
      ? effectKitOk(d.effects)
        ? d.effects
        : null
      : undefined;
  }
  /** ARMORY: the kit a wardrobe answer says is worn (null for none), or undefined from a service before it. */
  function armoryStated(d) {
    return Array.isArray(d?.armoryHeld) ? (armoryKitOk(d.armory) ? d.armory : null) : undefined;
  }
  /** WB9g: the aura a wardrobe answer says is worn (null for none), or undefined from a service before acct38. */
  function auraStated(d) {
    return Array.isArray(d?.auras) ? (d.aura ?? null) : undefined;
  }
  /** WITCH1: the icon a wardrobe answer says is worn (null for the face), or undefined from a service before acct162. */
  function iconStated(d) {
    return Array.isArray(d?.icons) ? (d.icon ?? null) : undefined;
  }
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
    self.busy = true;
    self.error = '';
    self.note = '';
    changed();
    try {
      const r = await ask(() => equipAura(door(), want));
      if (!r) return false;
      if (!r.ok) return refuse(accountRefusalText(r.error));
      self.wardrobe = {
        ...(self.wardrobe ?? {}),
        titles: r.data.titles,
        title: r.data.title,
        glyphs: r.data.glyphs,
        ...glyphHalf(r.data),
        ...auraHalf(r.data),
      };
      self.busy = false;
      self.note = want
        ? t('account.flow.wearing', 'Wearing {what}.', { what: AURA_TEXT[want] ?? want })
        : t('account.flow.auraRemoved', 'Aura removed.'); // SHADOW-CLOAK (AUDIT): the aura's name, never its key
      adoptIdentity(storage, {
        glyphs: r.data.glyphs,
        glyphsOff: r.data.glyphsOff,
        aura: auraStated(r.data),
        armory: armoryStated(r.data),
        effects: effectsStated(r.data),
        icon: iconStated(r.data),
        secret: asked,
      });
      changed();
      return true;
    } catch {
      return refuse(accountRefusalText('offline'));
    }
  };

  /**
   * ARMORY (bible/04-Characters/Aura-Armory.md) - WEAR ONE PIECE IN ITS SLOT, OR EMPTY IT: the aura's law, a slot at a time.
   * It asks; the service decides what is held; the answer replaces the wardrobe; pressing the piece worn in its slot takes
   * it off. The stored session learns the kit (adoptIdentity), so my own body shows it at once, and the room at once
   * (scenes/auraHost.js says hello again on a kit the room's token did not carry).
   */
  const armoryWore = async (/** @type {() => Promise<any>} */ call, /** @type {string} */ note) => {
    if (self.busy || self.stage !== 'in') return false;
    const asked = secret();
    self.busy = true;
    self.error = '';
    self.note = '';
    changed();
    try {
      const r = await ask(call);
      if (!r) return false;
      if (!r.ok) return refuse(accountRefusalText(r.error));
      self.wardrobe = {
        ...(self.wardrobe ?? {}),
        titles: r.data.titles,
        title: r.data.title,
        glyphs: r.data.glyphs,
        ...glyphHalf(r.data),
        ...auraHalf(r.data),
      };
      self.busy = false;
      self.note = note;
      adoptIdentity(storage, {
        glyphs: r.data.glyphs,
        glyphsOff: r.data.glyphsOff,
        aura: auraStated(r.data),
        armory: armoryStated(r.data),
        effects: effectsStated(r.data),
        icon: iconStated(r.data),
        secret: asked,
      });
      changed();
      return true;
    } catch {
      return refuse(accountRefusalText('offline'));
    }
  };
  self.wearArmory = (/** @type {string} */ slot, /** @type {string|null} */ piece) => {
    const want = armoryKitPieces(self.wardrobe?.armory)[slot] === piece ? null : (piece ?? null);
    return armoryWore(
      () => equipArmory(door(), slot, want),
      want
        ? t('account.flow.wearing', 'Wearing {what}.', { what: armoryPieceName(want) })
        : t('account.flow.armoryRemoved', 'Piece removed.'),
    );
  };
  /** ARMORY: A WHOLE KIT AT ONCE - the Eternal set's Wear - or `null`, every piece off. */
  self.wearArmoryKit = (/** @type {string|null} */ kit) =>
    armoryWore(
      () => equipArmoryKit(door(), kit),
      kit
        ? t('account.flow.wearingSet', 'Wearing the whole set.')
        : t('account.flow.armoryRemovedAll', 'Every piece removed.'),
    );
  /** STOREFRONT (bible/06-Systems/Storefront.md): WEAR ONE EFFECT IN ITS SLOT - a kill effect, a portal skin, a mount look -
   *  the armory's door a slot at a time; pressing the one worn bares the slot. The stored session learns the kit, so my own
   *  kills, portals and horse show it at once, and the room at once (auraHost.js says hello again). */
  self.wearEffect = (/** @type {string} */ slot, /** @type {string|null} */ key) => {
    const want = effectWorn(self.wardrobe?.effects, slot) === key ? null : (key ?? null);
    return armoryWore(
      () => equipEffect(door(), slot, want),
      want
        ? t('account.flow.wearing', 'Wearing {what}.', { what: effectName(slot, want) })
        : t('account.flow.effectRemoved', 'Taken off.'),
    );
  };

  /**
   * WITCH1 (bible/06-Systems/Witches-Festival.md) - WEAR ONE PROFILE ICON, OR NONE: the aura's law, in the portrait well.
   * It asks; the service decides what is held; the answer replaces the wardrobe; pressing the one worn takes it off (the
   * character's face again). The stored session learns it (adoptIdentity), so the corner mark and the card show it at
   * once; another player's Inspect card from the next hello, as a title.
   */
  self.wearIcon = async (icon) => {
    if (self.busy || self.stage !== 'in') return false;
    const want = self.wardrobe?.icon === icon ? null : (icon ?? null);
    const asked = secret();
    self.busy = true;
    self.error = '';
    self.note = '';
    changed();
    try {
      const r = await ask(() => equipIcon(door(), want));
      if (!r) return false;
      if (!r.ok) return refuse(accountRefusalText(r.error));
      self.wardrobe = {
        ...(self.wardrobe ?? {}),
        titles: r.data.titles,
        title: r.data.title,
        glyphs: r.data.glyphs,
        ...glyphHalf(r.data),
        ...auraHalf(r.data),
      };
      self.busy = false;
      self.note = want
        ? t('account.flow.wearing', 'Wearing {what}.', { what: ICON_TEXT[want] ?? want })
        : t('account.flow.iconRemoved', 'Icon removed.');
      adoptIdentity(storage, {
        glyphs: r.data.glyphs,
        glyphsOff: r.data.glyphsOff,
        aura: auraStated(r.data),
        armory: armoryStated(r.data),
        effects: effectsStated(r.data),
        icon: iconStated(r.data),
        secret: asked,
      });
      changed();
      return true;
    } catch {
      return refuse(accountRefusalText('offline'));
    }
  };

  /**
   * AURUM (bible/06-Systems/Aurum.md) - A WARE BOUGHT FOR AURUM (AURUM-ONLY: any but a pack) at the `price` the window
   * showed: it asks, the service decides (the sale, the day's deals, the balance, what is held) in one transaction, and
   * the answer is the wardrobe after it and the Aurum's card. A ware no longer sold, one held already or one whose price
   * moved reads the account again so the window shows the shop as it is.
   */
  self.buyWare = async (/** @type {string} */ ware, /** @type {number|undefined} */ price) => {
    if (self.busy || self.stage !== 'in') return false;
    const asked = secret();
    self.busy = true;
    self.error = '';
    self.note = '';
    changed();
    try {
      const r = await ask(() => buyAurumWare(door(), ware, price));
      if (!r) return false;
      if (!r.ok) {
        refuse(accountRefusalText(r.error));
        if (
          r.error === 'aurum-sale' ||
          r.error === 'aurum-held' ||
          r.error === 'aurum-price' ||
          r.error === 'aurum-short'
        )
          await self.refresh(); // AUDIT AURUM-SPEND F6: the balance read again
        return false;
      }
      self.wardrobe = {
        ...(self.wardrobe ?? {}),
        titles: r.data.titles,
        title: r.data.title,
        glyphs: r.data.glyphs,
        ...glyphHalf(r.data),
        ...auraHalf(r.data),
      };
      self.aurum = aurumCardOf(r.data.aurum) ?? self.aurum;
      self.busy = false;
      self.note = t('account.flow.aurumBought', '{name} is yours. Wear it here or from your profile.', {
        name: arrivedName(ware),
      });
      adoptIdentity(storage, {
        glyphs: r.data.glyphs,
        glyphsOff: r.data.glyphsOff,
        aura: auraStated(r.data),
        armory: armoryStated(r.data),
        effects: effectsStated(r.data),
        icon: iconStated(r.data),
        secret: asked,
      });
      changed();
      void self.refresh(); // the shop's card again: the ware held there, and a bundle's price that held part of it
      return true;
    } catch {
      return refuse(accountRefusalText('offline'));
    }
  };

  /**
   * PASS-PANELS (bible/06-Systems/Battle-Pass.md) - A SEASON'S PREMIUM TRACK OPENED, OR AN ITEM ON ITS TRACKS BOUGHT, FOR
   * AURUM: it asks, the service decides (the balance, the track, the panel, what is bought) in one transaction, and the
   * answer is the wardrobe after it, the Aurum's card and the pass's. A refusal the window may be behind on reads the
   * account again. Answers `{ ok, error? }` - `error` the service's word, for the window.
   */
  const passAct = async (/** @type {() => Promise<any>} */ asking, /** @type {() => string} */ noted) => {
    if (self.busy || self.stage !== 'in') return { ok: false, error: 'pass-busy' }; // AUDIT-STOREFRONT III C10: a word the refusals' table says
    const asked = secret();
    self.busy = true;
    self.error = '';
    self.note = '';
    changed();
    try {
      const r = await ask(asking);
      if (!r) return { ok: false, error: 'auth' }; // signed out: the card says why
      if (!r.ok) {
        refuse(accountRefusalText(r.error));
        if (['pass-held', 'pass-track', 'pass-panel', 'pass-short'].includes(r.error)) await self.refresh();
        return { ok: false, error: String(r.error ?? 'server') };
      }
      self.wardrobe = {
        ...(self.wardrobe ?? {}),
        titles: r.data.titles,
        title: r.data.title,
        glyphs: r.data.glyphs,
        ...glyphHalf(r.data),
        ...auraHalf(r.data),
      };
      self.aurum = aurumCardOf(r.data.aurum) ?? self.aurum;
      self.pass = passCardOf(r.data.pass) ?? self.pass;
      self.busy = false;
      self.note = noted();
      adoptIdentity(storage, {
        glyphs: r.data.glyphs,
        glyphsOff: r.data.glyphsOff,
        aura: auraStated(r.data),
        armory: armoryStated(r.data),
        effects: effectsStated(r.data),
        icon: iconStated(r.data),
        secret: asked,
      });
      changed();
      return { ok: true };
    } catch {
      refuse(accountRefusalText('offline'));
      return { ok: false, error: 'offline' };
    }
  };
  self.passUnlock = (/** @type {string} */ season) =>
    passAct(
      () => passUnlock(door(), season),
      () =>
        t('account.flow.passUnlocked', 'The Gilded Folio of {season} is unlocked.', {
          season:
            PASS_SEASON_TEXT[/** @type {keyof typeof PASS_SEASON_TEXT} */ (passSeasonById(season)?.id ?? '')]?.() ??
            season,
        }),
    );
  self.passBuy = (/** @type {string} */ season, /** @type {string} */ grant) =>
    passAct(
      () => passBuy(door(), season, grant),
      () =>
        t('account.flow.passBought', '{name} is yours. Wear it here or from your profile.', {
          name: passGrantName(grant),
        }),
    );

  /**
   * NAME-AS (2026-10-12, Mac: "I want to add an option to the profile menu where players can toggle to use their account
   * name or character name for ingame use") - WHICH NAME THE ROOM READS: the account's, or the character's being played.
   * It asks, as a wear does; the service keeps the choice and every later mint signs it - a character's name only where it
   * can be worn, the mint saying why where it cannot (the game says it once: scenes/world.js adoptIssued). Pressing the
   * one already chosen asks nothing. A choice the service took STAMPS the stored session (`nameAsAt`, forward only), and
   * the world host, seeing its stamp move, says hello again on fresh tokens - the room reads the new name now
   * (scenes/world.js nameAsFrame), whichever host mode the player stands in.
   */
  self.chooseName = async (as) => {
    if (self.busy || self.stage !== 'in' || !self.account) return false;
    if ((self.account.nameAs ?? 'account') === as) return false;
    const asked = secret();
    self.busy = true;
    self.error = '';
    self.note = '';
    changed();
    try {
      const r = await ask(() => chooseNameAs(door(), as));
      if (!r) return false; // `auth` already landed on `out`
      if (!r.ok) return refuse(accountRefusalText(r.error));
      const nameAs = r.data?.nameAs === 'character' ? 'character' : 'account'; // the service's word, as a wear's answer is
      self.account = { ...self.account, nameAs };
      self.busy = false;
      self.note = NAME_AS_NOTE[nameAs];
      const was = storedSession(storage)?.nameAsAt;
      adoptIdentity(storage, { nameAsAt: Math.max(now(), Number.isSafeInteger(was) ? was + 1 : 0), secret: asked }); // AUDIT B4: into the session that asked
      changed();
      return true;
    } catch {
      return refuse(accountRefusalText('offline'));
    }
  };

  /** THE ONE SUBMISSION DOOR. Dispatches on the stage, so a button
   *  never decides what it means. */
  self.submit = async () => {
    if (self.busy) return false; // ONE PRESS IS ONE ACCOUNT
    self.busy = true;
    self.error = '';
    self.note = '';
    changed();
    try {
      if (self.stage === 'register') return await doRegister();
      if (self.stage === 'login') return await doLogin();
      if (self.stage === 'recover') return await doRecover();
      if (self.stage === 'password') return await doPassword();
      if (self.stage === 'codes') return await doNewCodes();
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
    if (fields.includes('password') && [...pw('password')].length < PASSWORD_MIN_LEN)
      return LOCAL_REFUSALS['password-short'];
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
    // HANDLE-EMAIL: a new username is never an address - asked here alone, so one chosen before still signs in
    if (handleLooksLikeEmail(v('handle'))) return refuse(accountRefusalText('handle-email'));

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

    // THE ONE MOMENT THE CODES ARE READABLE.
    self.recoveryCodes = codesOf(r.data);
    self.codesFor = typeof r.data.handle === 'string' ? r.data.handle : v('handle');
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
   * recovered.
   *
   * RECOVERY-SET: the code typed is spent and the set's others still
   * work, so the card lands signed in and says how many are left. A
   * single code from before the set, or the last of one, comes back as
   * a NEW set - shown on `code`, because a player left with no way back
   * in has had the same cliff moved one step.
   */
  async function doRecover() {
    const bad = localRefusal(FIELDS.recover);
    if (bad) return refuse(bad);
    const r = await ask(() => recover(io, v('handle'), v('code'), pw('password')));
    if (!r) return false;
    if (!r.ok) return refuse(accountRefusalText(r.error));
    keepSession(storage, r.data);
    const codes = codesOf(r.data);
    if (!codes.length) {
      await self.start();
      if (self.stage === 'in' && !self.error && Number.isSafeInteger(r.data.codesLeft)) {
        self.note = t(
          'account.flow.recoveredLeft',
          'Your password was set. {n, plural, one {# recovery code is} other {# recovery codes are}} left.',
          { n: r.data.codesLeft },
        );
        changed();
      }
      return true;
    }
    self.recoveryCodes = codes;
    self.codesFor = typeof r.data.handle === 'string' ? r.data.handle : v('handle'); // AUDIT RECOVERY-SET B6: the row's own casing
    self.stage = 'code';
    self.values = {};
    self.error = '';
    changed();
    return true;
  }

  /**
   * RECOVERY-SET - A NEW SET, FROM THE PROFILE. The request: players
   * "click and see their account recovery code in their profile". The
   * service keeps only hashes, so what is shown is a NEW set, once, on
   * `code` - the password asked first, as changing it asks, and (AUDIT
   * RECOVERY-SET A1) one of the codes it replaces, so a stolen password
   * alone cannot kill them; the old set dead with the answer.
   */
  async function doNewCodes() {
    const bad = localRefusal(FIELDS.codes);
    if (bad) return refuse(bad);
    const r = await ask(() => newRecoveryCodes(door(), pw('oldPassword'), v('code')));
    if (!r) return false;
    if (!r.ok) return refuse(accountRefusalText(r.error));
    const codes = codesOf(r.data);
    if (!codes.length) return refuse(accountRefusalText('server'));
    self.recoveryCodes = codes;
    self.codesFor = self.account?.handle ?? '';
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
    go('in', {
      note: t('account.flow.passwordChanged', 'Your password was changed. Every other device has been signed out.'),
    });
    return true;
  }

  /** Leaving `code`. The only way off that stage, and it is deliberate:
   *  the code is dropped here and nothing anywhere can print it again. */
  self.acknowledgeCode = async () => {
    if (self.stage !== 'code') return;
    self.recoveryCodes = null;
    self.codesFor = '';
    self.note = '';
    self.error = ''; // AUDIT RECOVERY-SET B4: "Copied." belonged to the codes, not to the card after them
    await self.start();
  };

  /** RECOVERY-SET: a sentence the card says of its own act - the codes copied, or saved as a file, or why not. AUDIT
   *  RECOVERY-SET B4: said only while the codes are up - a clipboard that answers after "I have written it down" says
   *  nothing on the card that follows. */
  self.say = (sentence, bad = false) => {
    if (self.stage !== 'code') return;
    self.error = bad ? sentence : '';
    self.note = bad ? '' : sentence;
    changed();
  };

  /** THIS device by default. `all` is separate and explicit, because
   *  signing out of a laptop has never dropped somebody's phone. */
  self.signOut = async (all = false) => {
    if (self.busy) return;
    self.busy = true;
    changed();
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
      self.patreon = null;
      self.patreonWaiting = false; // PATREON-LINK
      self.shop = null;
      self.shopWaiting = null;
      self.pass = null;
      self.aurum = null; // SHOP; STOREFRONT; AURUM
      self.busy = false;
      go('out', {
        note: all
          ? t('account.flow.signedOutAll', 'Signed out everywhere.')
          : t('account.flow.signedOut', 'Signed out.'),
      });
    }
  };

  return self;
}
