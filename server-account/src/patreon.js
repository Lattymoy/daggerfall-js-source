// @ts-check
// ═══════════════════════════════════════════════════════════════════
// PATREON-LINK (2026-10-01) — A PATRON'S TITLE FOLLOWS THEIR PLEDGE.
//
// Mac: "With patron and having to manually hand out titles. Im running
// into a workflow where its really hard to keep up with it" - and, asked
// whether patrons should link their own Patreon or he should press a
// grant button per patron: "Patreon auto-link".
//
// TITLE-N granted the three Patreon tiers by handle lists in
// wrangler.toml, so every new patron was a message to Mac, an edit, a
// review and a deploy - and a lapsed pledge was the same again, or it
// was nothing at all. Now a registered player presses Link Patreon on
// the account card, says yes on Patreon and once more here, and the
// tier their pledge pays for is a title they hold: upgraded, downgraded
// and lapsed by Patreon's own webhook, with nobody in the loop.
//
// ═══ THE GRANT IS STILL DERIVED; WHAT IS STORED IS PATREON'S WORD ═══
//
// ACC3's law holds: what a player HOLDS is read at every ask, never a
// column somebody remembers to clear. What this stores is the one thing
// that cannot be derived here - what Patreon last said about the
// player's membership (`patreon_tiers`, `patreon_status`, migration
// 0045), the way WB9g stores a sale. The title is read off that against
// PATREON_TIERS, the config's map of tier ids to titles, so a tier
// remapped in the config moves every patron on their next token, and a
// pledge Patreon says has ended stops being signed for on the next one.
//
// HELD ONLY WHILE PATREON SAYS `active_patron` AND THE TIER IS ONE THE
// MEMBER IS ENTITLED TO NOW (`currently_entitled_tiers`, Patreon's own
// answer to "what does this member get"). A declined card lapses the
// title until Patreon says the payment went through; a deleted pledge
// lapses it at once.
//
// ═══ FOUR DOORS, AND WHAT EACH ONE TRUSTS ══════════════════════════
//
//   the account read  carries `patreon.link`, the authorize URL with a
//                     STATE this service sealed for the account asking
//                     (an hour). No write: the card has it before it is
//                     pressed, so the press is a plain link - which every
//                     browser and the desktop app open (TERMS1's links
//                     already do), where a window opened after an await
//                     is a popup a phone's browser blocks.
//   /callback         Patreon sends the player back with a code. The
//                     state says which account; the code, spent here with
//                     the client secret, says which Patreon account. And
//                     then it ASKS - see below - and writes nothing.
//   /confirm          the player's yes, carrying a TICKET this service
//                     sealed at the callback (fifteen minutes): the
//                     account, the Patreon account, and the patron's own
//                     access token - so the yes asks Patreon AGAIN and
//                     writes what it says NOW. A pledge cancelled between
//                     the page and the press holds nothing, and a yes
//                     pressed twice is Patreon asked twice, never a stale
//                     word written twice. The one write of a link.
//   /webhook          Patreon's own word on a member, signed with the
//                     webhook's secret (HMAC-MD5 - Patreon's choice, and
//                     WebCrypto has no MD5, so it is computed below).
//
// ═══ WHY IT ASKS BEFORE IT LINKS ═══════════════════════════════════
//
// A state is a bearer: whoever opens the authorize URL finishes the link
// for the ACCOUNT IT NAMES. So a player could send a patron their own
// link ("free gold, click here"), and a patron who pressed Allow would
// move their pledge's title onto the sender's account. The browser that
// started a link is not the browser that finishes it (the desktop app
// hands it to the system browser), so there is no cookie to bind it to.
// What binds it is the patron reading, on a page of this service's, the
// one fact the attacker cannot hide: WHICH GAME ACCOUNT they are about
// to link - and pressing yes to it.
//
// ═══ ONE PATREON ACCOUNT, ONE GAME ACCOUNT ═════════════════════════
//
// A pledge is one person's. `patreon_user` is UNIQUE (0045), and linking
// a Patreon account that is already linked MOVES it - the confirm page
// says from where - so a patron who made a new game account takes their
// title with them, and one pledge never dresses two accounts.
// ═══════════════════════════════════════════════════════════════════

import { timingSafeEqual } from './password.js';
import { sealWith, openWith } from './sealed.js'; // SHOP: the sealing lifted out, one copy for both doors

/** The titles a Patreon tier may grant - TITLE-N's three and HERALD's, lowest first. A mapping in PATREON_TIERS to
 *  anything else (the Dungeon Master, a one-player title) is not read: those are granted by name, never by a pledge. */
export const PATREON_TITLES = Object.freeze(['disciple', 'apostle', 'herald', 'hierophant']);
/** Patreon's word for a member whose pledge is paid up (its `patron_status`). Anything else holds nothing. */
export const PATREON_ACTIVE = 'active_patron';
/** How long the link the account card carries may be followed: an hour, the card being open that long at most. */
export const PATREON_STATE_S = 60 * 60;
/** How long the confirm page may sit before its yes is pressed. */
export const PATREON_TICKET_S = 15 * 60;
/** Patreon's member payloads carry the campaign and the user beside the member; a quarter of a megabyte is room for
 *  any of them and still a bound read before a byte is believed. */
export const PATREON_HOOK_MAX_BYTES = 256 * 1024;
/** The member events this listens to. Any other event Patreon is set to send is acknowledged and changes nothing. */
export const PATREON_EVENTS = Object.freeze([
  'members:create',
  'members:update',
  'members:delete',
  'members:pledge:create',
  'members:pledge:update',
  'members:pledge:delete',
]);
/** An event that ends a membership: nothing is held after it, whatever the payload's figures say. */
const ENDS = new Set(['members:delete', 'members:pledge:delete']);

export const PATREON_AUTHORIZE = 'https://www.patreon.com/oauth2/authorize';
export const PATREON_TOKEN = 'https://www.patreon.com/api/oauth2/token';
/** The player's own Patreon user and, with only the `identity` scope, their membership of the campaign that owns this
 *  client - Mac's - with the tiers it is entitled to and its status. The includes are the form Patreon's own client
 *  library asks with (patreon-php's v2 identity call); the member resources come with them. */
export const PATREON_IDENTITY =
  'https://www.patreon.com/api/oauth2/v2/identity' +
  '?include=memberships.currently_entitled_tiers,memberships.campaign' +
  '&fields%5Buser%5D=full_name&fields%5Bmember%5D=patron_status';
/** Where Patreon sends the player back to, under whatever origin serves this Worker - read off the request, never typed
 *  (AUDIT-ACC F16's law), and it must be the redirect URI registered on the Patreon client, letter for letter. */
export const PATREON_CALLBACK_PATH = '/v1/patreon/callback';
const AGENT = 'daggerfall-accounts (Patreon link)';

const enc = new TextEncoder();
const dec = new TextDecoder();
/** A Patreon id - a user's or a tier's - is a run of digits. */
const PATREON_ID_RE = /^[0-9]{1,24}$/;

// ── CONFIG ──────────────────────────────────────────────────────────

/** Linking is open while the client is configured: its id (a var) and its secret (a secret the deploy puts). */
export const patreonLinkOn = (/** @type {any} */ env) =>
  typeof env?.PATREON_CLIENT_ID === 'string' &&
  !!env.PATREON_CLIENT_ID &&
  typeof env?.PATREON_CLIENT_SECRET === 'string' &&
  !!env.PATREON_CLIENT_SECRET;

/** THE TIERS, off the config: `PATREON_TIERS = "<tier id>:<title>,..."` - a tier id is the number in that tier's Join
 *  link (`rid=`). An entry that is not an id and one of PATREON_TITLES is not read. */
export function patreonTierMap(/** @type {any} */ env) {
  const map = new Map();
  const raw = env?.PATREON_TIERS;
  if (typeof raw !== 'string') return map;
  for (const entry of raw.split(',')) {
    const [id, title, extra] = entry.split(':').map((s) => s.trim());
    if (extra === undefined && PATREON_ID_RE.test(id ?? '') && PATREON_TITLES.includes(/** @type {string} */ (title)))
      map.set(id, title);
  }
  return map;
}

/** The tier ids a row stores, as a list (`patreon_tiers` is comma-joined; null or empty is none). */
export function tierIdsOf(/** @type {any} */ stored) {
  return typeof stored === 'string' && stored ? stored.split(',').filter((id) => PATREON_ID_RE.test(id)) : [];
}

/** The titles a membership holds - its entitled tier ids and its status, as Patreon states them - in the tiers' order:
 *  none unless the pledge is active, and only the tiers the config maps. */
export function pledgeTitles(/** @type {string[]} */ tierIds, /** @type {any} */ status, /** @type {any} */ env) {
  if (status !== PATREON_ACTIVE) return [];
  const map = patreonTierMap(env);
  const held = new Set(tierIds.map((id) => map.get(id)).filter(Boolean));
  return PATREON_TITLES.filter((t) => held.has(t));
}

/**
 * THE TITLES THIS ROW HOLDS BY ITS PLEDGE. Registered accounts only (a guest cannot link, and a title never lands on a
 * row one storage clear from gone - ACC3), and only while Patreon's last word was an active pledge entitled to the tier.
 * @param {any} player the row
 * @param {any} env    the Worker's config
 */
export function patreonTitlesOf(player, env) {
  if (typeof player?.handle !== 'string' || !player.handle) return [];
  return pledgeTitles(tierIdsOf(player.patreon_tiers), player.patreon_status, env);
}

// ── THE SEALED STATE AND TICKET ─────────────────────────────────────
//
// Both are this service's own word, SEALED: AES-GCM under a key HKDF derives from the client secret (a key only this
// Worker and Patreon hold), one key a KIND - so a state can never be presented as a ticket or the other way, and a byte
// changed anywhere opens to nothing. Sealed rather than signed because a ticket carries the patron's own Patreon access
// token to the confirm, and a state names an account: neither is anybody's to read on the way past, Patreon's logs and
// a browser's history included.

const PATREON_SEAL_SALT = 'daggerfall-accounts patreon-link';

/** Seal `claims` (an object with `p`, the account, and `x`, its expiry in seconds) for `kind`, as one base64url run. */
export const sealPatreon = (
  /** @type {'state'|'ticket'} */ kind,
  /** @type {object} */ claims,
  /** @type {any} */ env,
  /** @type {any} */ io,
) => sealWith(String(env.PATREON_CLIENT_SECRET), PATREON_SEAL_SALT, kind, claims, io);

/** The claims a sealed value carries, or null: not this service's, not this kind, changed, malformed, or past its expiry. */
export async function openPatreon(
  /** @type {'state'|'ticket'} */ kind,
  /** @type {any} */ sealed,
  /** @type {any} */ env,
  /** @type {any} */ io,
) {
  if (!patreonLinkOn(env)) return null;
  return openWith(String(env.PATREON_CLIENT_SECRET), PATREON_SEAL_SALT, kind, sealed, io);
}

/** The authorize URL a player follows, for the account the state names. `identity` is the one scope asked: the user and
 *  their membership of this client's own campaign, which is everything a title needs and nothing else. */
export function patreonAuthorizeUrl(
  /** @type {any} */ env,
  /** @type {string} */ redirectUri,
  /** @type {string} */ state,
) {
  const q = new URLSearchParams({
    response_type: 'code',
    client_id: String(env.PATREON_CLIENT_ID),
    redirect_uri: redirectUri,
    scope: 'identity',
    state,
  });
  return `${PATREON_AUTHORIZE}?${q}`;
}

// ── PATREON, ASKED ──────────────────────────────────────────────────

/** Spend the code Patreon sent the player back with: `{ token }`, or `{ error: 'patreon-down' }` for anything else. */
export async function patreonExchange(
  /** @type {typeof fetch} */ fetch,
  /** @type {any} */ env,
  /** @type {string} */ code,
  /** @type {string} */ redirectUri,
) {
  try {
    const res = await fetch(PATREON_TOKEN, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json', 'user-agent': AGENT },
      body: new URLSearchParams({
        code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
        client_id: String(env.PATREON_CLIENT_ID),
        client_secret: String(env.PATREON_CLIENT_SECRET),
      }).toString(),
    });
    const data = res.ok ? await res.json() : null;
    return typeof data?.access_token === 'string' && data.access_token
      ? { token: data.access_token }
      : { error: 'patreon-down' };
  } catch {
    return { error: 'patreon-down' };
  }
}

/**
 * WHO THE PLAYER IS ON PATREON, and what their membership pays for: `{ user, name, tiers, status }`. A user with no
 * membership of the campaign is still a user - linked now, they hold their tier the moment the webhook says they
 * pledged.
 */
export function memberOfIdentity(/** @type {any} */ doc) {
  const user = doc?.data?.id;
  if (typeof user !== 'string' || !PATREON_ID_RE.test(user)) return null;
  const name = typeof doc.data.attributes?.full_name === 'string' ? doc.data.attributes.full_name.slice(0, 80) : '';
  const refs = Array.isArray(doc.data.relationships?.memberships?.data) ? doc.data.relationships.memberships.data : [];
  const ids = new Set(refs.map((/** @type {any} */ r) => r?.id));
  const member = (Array.isArray(doc.included) ? doc.included : []).find(
    (/** @type {any} */ r) => r?.type === 'member' && ids.has(r.id),
  );
  if (!member) return { user, name, tiers: [], status: null };
  const tiers = Array.isArray(member.relationships?.currently_entitled_tiers?.data)
    ? member.relationships.currently_entitled_tiers.data
        .map((/** @type {any} */ t) => t?.id)
        .filter((/** @type {any} */ id) => typeof id === 'string' && PATREON_ID_RE.test(id))
    : [];
  const status = typeof member.attributes?.patron_status === 'string' ? member.attributes.patron_status : null;
  return { user, name, tiers, status };
}

/** Ask Patreon with the player's own token: `{ user, name, tiers, status }`, or `{ error: 'patreon-down' }`. */
export async function patreonIdentity(/** @type {typeof fetch} */ fetch, /** @type {string} */ token) {
  try {
    const res = await fetch(PATREON_IDENTITY, {
      headers: { authorization: `Bearer ${token}`, accept: 'application/json', 'user-agent': AGENT },
    });
    const who = res.ok ? memberOfIdentity(await res.json()) : null;
    return who ?? { error: 'patreon-down' };
  } catch {
    return { error: 'patreon-down' };
  }
}

// ── THE ROW ─────────────────────────────────────────────────────────

/**
 * THE ONE WRITE OF A LINK: the ticket's Patreon account onto the ticket's game account, with what Patreon says it pays
 * for at the yes - and off any other account that held it, in the same batch. Both statements are guarded on the game account
 * being a registered one, so a ticket naming a row that is gone (or never registered) moves nothing anywhere.
 * `{ ok, moved }`, or `{ error: 'patreon-needs-account' }`.
 * @param {{ db: any, nowS: number }} ctx
 * @param {{ p: string, u: string, t: string, s: string|null }} c the account, and Patreon's word on the membership now
 */
export async function linkPatreon({ db, nowS }, c) {
  if (typeof c?.u !== 'string' || !PATREON_ID_RE.test(c.u)) return { error: 'patreon-needs-account' };
  const tiers = tierIdsOf(c.t).join(',');
  const status = typeof c.s === 'string' ? c.s.slice(0, 32) : null;
  const registered = 'EXISTS (SELECT 1 FROM players WHERE id = ?2 AND handle IS NOT NULL)';
  const [off, on] = await db.batch([
    db
      .prepare(
        `UPDATE players SET patreon_user = NULL, patreon_tiers = NULL, patreon_status = NULL, patreon_at = NULL
      WHERE patreon_user = ?1 AND id <> ?2 AND ${registered}`,
      )
      .bind(c.u, c.p),
    db
      .prepare(
        `UPDATE players SET patreon_user = ?1, patreon_tiers = ?3, patreon_status = ?4, patreon_at = ?5
      WHERE id = ?2 AND handle IS NOT NULL`,
      )
      .bind(c.u, c.p, tiers, status, nowS),
  ]);
  if (!(on?.meta?.changes > 0)) return { error: 'patreon-needs-account' };
  return { ok: true, moved: off?.meta?.changes > 0 };
}

/** Unlink: the four columns cleared, so nothing about a pledge is held or kept. */
export async function unlinkPatreon({ db }, /** @type {string} */ playerId) {
  await db
    .prepare(
      'UPDATE players SET patreon_user = NULL, patreon_tiers = NULL, patreon_status = NULL, patreon_at = NULL WHERE id = ?1',
    )
    .bind(playerId)
    .run();
  return { ok: true };
}

// ── THE WEBHOOK ─────────────────────────────────────────────────────

/** RFC 1321, over bytes. Patreon signs its webhooks with HMAC-MD5 and WebCrypto has no MD5; the pins hold this to
 *  node's own at every length that crosses a block boundary. */
const MD5_S = [7, 12, 17, 22, 5, 9, 14, 20, 4, 11, 16, 23, 6, 10, 15, 21];
const MD5_K = Array.from({ length: 64 }, (_, i) => Math.floor(Math.abs(Math.sin(i + 1)) * 2 ** 32) >>> 0);
export function md5(/** @type {Uint8Array} */ bytes) {
  const n = bytes.length;
  const len = (((n + 8) >>> 6) + 1) * 16;
  const x = new Uint32Array(len);
  for (let i = 0; i < n; i++) x[i >> 2] |= bytes[i] << ((i % 4) * 8);
  x[n >> 2] |= 0x80 << ((n % 4) * 8);
  x[len - 2] = (n * 8) >>> 0;
  x[len - 1] = Math.floor((n * 8) / 2 ** 32) >>> 0;
  let a0 = 0x67452301;
  let b0 = 0xefcdab89;
  let c0 = 0x98badcfe;
  let d0 = 0x10325476;
  for (let off = 0; off < len; off += 16) {
    let a = a0;
    let b = b0;
    let c = c0;
    let d = d0;
    for (let i = 0; i < 64; i++) {
      let f;
      let g;
      if (i < 16) {
        f = (b & c) | (~b & d);
        g = i;
      } else if (i < 32) {
        f = (d & b) | (~d & c);
        g = (5 * i + 1) % 16;
      } else if (i < 48) {
        f = b ^ c ^ d;
        g = (3 * i + 5) % 16;
      } else {
        f = c ^ (b | ~d);
        g = (7 * i) % 16;
      }
      const sum = (a + f + MD5_K[i] + x[off + g]) | 0;
      const s = MD5_S[(i >> 4) * 4 + (i % 4)];
      a = d;
      d = c;
      c = b;
      b = (b + ((sum << s) | (sum >>> (32 - s)))) | 0;
    }
    a0 = (a0 + a) | 0;
    b0 = (b0 + b) | 0;
    c0 = (c0 + c) | 0;
    d0 = (d0 + d) | 0;
  }
  const out = new Uint8Array(16);
  [a0, b0, c0, d0].forEach((w, j) => {
    for (let k = 0; k < 4; k++) out[j * 4 + k] = (w >>> (8 * k)) & 0xff;
  });
  return out;
}

/** RFC 2104 over that MD5. */
export function hmacMd5(/** @type {Uint8Array} */ key, /** @type {Uint8Array} */ msg) {
  const block = new Uint8Array(64);
  block.set(key.length > 64 ? md5(key) : key);
  const inner = new Uint8Array(64 + msg.length);
  const outer = new Uint8Array(64 + 16);
  for (let i = 0; i < 64; i++) {
    inner[i] = block[i] ^ 0x36;
    outer[i] = block[i] ^ 0x5c;
  }
  inner.set(msg, 64);
  outer.set(md5(inner), 64);
  return md5(outer);
}

const hex = (/** @type {Uint8Array} */ b) => Array.from(b, (v) => v.toString(16).padStart(2, '0')).join('');

/** Is `signature` (the X-Patreon-Signature header: the hex HMAC-MD5 of the body under the webhook's secret) right? */
export function patreonSignatureOk(
  /** @type {string} */ secret,
  /** @type {Uint8Array} */ body,
  /** @type {any} */ signature,
) {
  const got = typeof signature === 'string' ? signature.trim().toLowerCase() : '';
  if (!/^[0-9a-f]{32}$/.test(got)) return false;
  return timingSafeEqual(enc.encode(got), enc.encode(hex(hmacMd5(enc.encode(secret), body))));
}

/**
 * WHAT A MEMBER PAYLOAD SAYS: `{ user, tiers, status }` - `tiers` and `status` undefined where the payload does not
 * state them, so a payload that leaves a field out leaves the stored one standing rather than reading as "none".
 */
export function memberOfHook(/** @type {any} */ doc) {
  const m = doc?.data;
  if (m?.type !== 'member') return null;
  const user = m.relationships?.user?.data?.id;
  if (typeof user !== 'string' || !PATREON_ID_RE.test(user)) return null;
  const rel = m.relationships?.currently_entitled_tiers;
  const tiers = Array.isArray(rel?.data)
    ? rel.data
        .map((/** @type {any} */ t) => t?.id)
        .filter((/** @type {any} */ id) => typeof id === 'string' && PATREON_ID_RE.test(id))
    : undefined;
  const attrs = m.attributes;
  const status =
    attrs && typeof attrs === 'object' && 'patron_status' in attrs
      ? typeof attrs.patron_status === 'string'
        ? attrs.patron_status.slice(0, 32)
        : null
      : undefined;
  return { user, tiers, status };
}

/**
 * PATREON'S WORD ON A MEMBER, written onto the account that member linked (if any). The signature first, before a byte
 * of the body is believed; then one UPDATE keyed on the Patreon user. A member nobody linked changes nothing and is
 * still acknowledged - Patreon retries what is refused, and it is not refused, it is simply nobody's yet (the link reads
 * Patreon afresh when it is made). `{ ok, applied }`, or `{ error }`: `patreon-closed`, `signature`, `body`.
 * @param {{ db: any, nowS: number }} ctx
 * @param {any} env
 * @param {Uint8Array} body the raw bytes Patreon signed
 * @param {any} signature X-Patreon-Signature
 * @param {any} event X-Patreon-Event
 */
export async function patreonWebhook({ db, nowS }, env, body, signature, event) {
  const secret = env?.PATREON_WEBHOOK_SECRET;
  if (typeof secret !== 'string' || !secret) return { error: 'patreon-closed' };
  if (!patreonSignatureOk(secret, body, signature)) return { error: 'signature' };
  let doc;
  try {
    doc = JSON.parse(dec.decode(body));
  } catch {
    return { error: 'body' };
  }
  if (!PATREON_EVENTS.includes(event)) return { ok: true, applied: 0 };
  const m = memberOfHook(doc);
  if (!m) return { ok: true, applied: 0 };
  const ended = ENDS.has(event);
  const tiers = ended ? '' : m.tiers === undefined ? null : m.tiers.join(',');
  const statusStated = ended || m.status !== undefined;
  const status = ended ? 'former_patron' : (m.status ?? null);
  const r = await db
    .prepare(
      `UPDATE players SET
      patreon_tiers = COALESCE(?2, patreon_tiers),
      patreon_status = CASE WHEN ?3 = 1 THEN ?4 ELSE patreon_status END,
      patreon_at = ?5
    WHERE patreon_user = ?1`,
    )
    .bind(m.user, tiers, statusStated ? 1 : 0, status, nowS)
    .run();
  return { ok: true, applied: r?.meta?.changes ?? 0 };
}

// ── WHAT THE CARD IS TOLD ───────────────────────────────────────────

/**
 * THE ACCOUNT CARD'S PATREON ROW: `{ on: false }` while linking is not configured (the card draws nothing), else
 * `{ on, linked, titles, link }` - whether this account is linked, the titles its pledge holds now, and the authorize
 * URL to follow (null for a guest, who cannot link).
 */
export async function patreonCardOf(/** @type {any} */ player, /** @type {any} */ env, { subtle, rand, nowS, origin }) {
  if (!patreonLinkOn(env)) return { on: false };
  const registered = typeof player?.handle === 'string' && !!player.handle;
  const state = registered
    ? await sealPatreon('state', { p: player.id, x: nowS + PATREON_STATE_S }, env, { subtle, rand })
    : null;
  return {
    on: true,
    linked: typeof player?.patreon_user === 'string' && !!player.patreon_user,
    titles: patreonTitlesOf(player, env),
    link: state ? patreonAuthorizeUrl(env, `${origin}${PATREON_CALLBACK_PATH}`, state) : null,
  };
}

// ── THE PAGES ───────────────────────────────────────────────────────
//
// The callback and the confirm are pages a person reads in a browser, not answers a client parses - so they are HTML,
// in the game's own dark and brass, with every word of a player's (a handle, a Patreon name) escaped, no script at all,
// and a policy that lets the one form post here and nothing frame it.

const esc = (/** @type {any} */ s) =>
  String(s).replace(
    /[&<>"']/g,
    (ch) =>
      /** @type {Record<string,string>} */ ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        ch
      ],
  );

/** The words a title is called on these pages - the account card's own (ui/playerBadge.js TITLE_TEXT says the same). */
export const PATREON_TITLE_TEXT = Object.freeze({
  disciple: 'Disciple',
  apostle: 'Apostle',
  herald: 'Herald',
  hierophant: 'Hierophant',
});
const titlesText = (/** @type {string[]} */ ts) =>
  ts.map((t) => /** @type {any} */ (PATREON_TITLE_TEXT)[t] ?? t).join(', ');

/**
 * One page. `lines` are sentences; `form`, when there is one, is the yes - a POST of the ticket to its `action`
 * (/v1/patreon/confirm unless it says another of this service's: SHOP's checkout).
 * @param {{ heading: string, lines?: string[], form?: { ticket: string, label: string, action?: string } | null }} page
 */
export function patreonPage({ heading, lines = [], form = null }) {
  const action = form?.action && /^\/v1\/[a-z/]+$/.test(form.action) ? form.action : '/v1/patreon/confirm';
  const body = [
    `<h1>${esc(heading)}</h1>`,
    ...lines.map((l) => `<p>${esc(l)}</p>`),
    form
      ? `<form method="post" action="${action}"><input type="hidden" name="ticket" value="${esc(form.ticket)}"><button type="submit">${esc(form.label)}</button></form>`
      : '',
  ].join('');
  return (
    '<!doctype html><html lang="en"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex">' +
    `<title>${esc(heading)} - DFO Online</title><style>` + // BR5: the product's name on the page a player is sent back to
    'body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#0f0d0b;color:#e8dcc4;' +
    'font:16px/1.5 Georgia,"Times New Roman",serif}main{max-width:30rem;margin:16px;padding:28px;border:1px solid #4a4036;' +
    'background:#17130f}h1{margin:0 0 14px;font-size:22px;color:#c9a45c;letter-spacing:.04em}p{margin:0 0 10px;color:#b8ab93}' +
    'button{margin-top:10px;padding:12px 20px;font:inherit;color:#c9a45c;background:transparent;border:1px solid #c9a45c;cursor:pointer}' +
    'button:hover{background:#c9a45c;color:#0f0d0b}' +
    `</style></head><body><main>${body}</main></body></html>`
  );
}

/** A page as a Response: HTML, never cached, never framed, sending no Referer, its one form posting only here - SHOP:
 *  and on to `formTo` (Stripe's checkout), where the form's answer sends the browser, which form-action also governs. */
export function patreonHtml(/** @type {string} */ html, status = 200, formTo = '') {
  const to = /^https:\/\/[a-z0-9.-]+$/.test(formTo) ? ` ${formTo}` : '';
  return new Response(html, {
    status,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store',
      'content-security-policy': `default-src 'none'; style-src 'unsafe-inline'; form-action 'self'${to}; frame-ancestors 'none'; base-uri 'none'`,
      'x-frame-options': 'DENY',
      'referrer-policy': 'no-referrer',
    },
  });
}

/** The pages a player can meet, each one sentence they can act on. */
export const PATREON_PAGES = Object.freeze({
  off: { heading: 'Patreon linking is off', lines: ['It is not switched on yet. Ask the developers on the Discord.'] },
  expired: {
    heading: 'This link has expired',
    lines: ['Open your account card in the game and press Link Patreon again.'],
  },
  declined: { heading: 'Not linked', lines: ['Patreon was not linked. You can close this page.'] },
  down: {
    heading: 'Patreon did not answer',
    lines: ['Nothing was linked. Press Link Patreon on your account card to try again.'],
  },
  rate: {
    heading: 'Too many tries',
    lines: ['Wait a few minutes, then press Link Patreon on your account card again.'],
  },
  account: {
    heading: 'This account needs a username',
    lines: ['Give your game account a username and a password, then link Patreon.'],
  },
});

/** The confirm page: whose Patreon, onto which game account, what it holds - and the one button that says yes. */
export function patreonConfirmPage({ handle, name, titles, ticket, from = null }) {
  return patreonPage({
    heading: 'Link Patreon',
    lines: [
      `Patreon account: ${name || 'yours'}`,
      `Game account: ${handle}`,
      titles.length
        ? `Your pledge holds: ${titlesText(titles)}.`
        : 'No pledge holds a title yet - it arrives the moment one does.',
      ...(from ? [`This Patreon is linked to ${from} now. Linking moves it to ${handle}.`] : []),
      'Not your game account? Close this page and nothing is linked.',
    ],
    form: { ticket, label: `Link to ${handle}` },
  });
}

/** And the page after the yes. */
export function patreonLinkedPage({ handle, titles }) {
  return patreonPage({
    heading: 'Patreon linked',
    lines: titles.length
      ? [`${handle} holds ${titlesText(titles)} now.`, 'Go back to the game and wear it from your account card.']
      : [`${handle} is linked. Your title arrives the moment your pledge holds one.`, 'You can close this page.'],
  });
}
