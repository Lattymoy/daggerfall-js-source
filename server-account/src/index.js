// @ts-check
// ═══════════════════════════════════════════════════════════════════
// ACC1b — THE ACCOUNT SERVICE: a second Cloudflare Worker, over D1.
//
// Mac (2026-09-21): "cloud storage and account creation needed for
// accessing online mode" / "Im not rotating. Lets do this".
//
// ═══ WHY THIS IS NOT A ROUTE ON THE RELAY ══════════════════════════
//
// A relay deploy restarts every Durable Object and DROPS EVERY
// CONNECTED PLAYER. That is a fair price for changing the relay's own
// law and an absurd one for fixing the wording on a sign-in button -
// and it is not hypothetical: SLAM8 hashes the RAW BYTES of every file
// the relay bundles, comments included, so a one-line comment fix in
// `src/net/wire.js` was abandoned on 2026-09-21 rather than drop a
// room full of people (DEPLOY-PROSE). Accounts in that bundle would
// mean every auth tweak drops everyone mid-dungeon.
//
// So: two Workers, and the seam between them is a SIGNATURE. This
// service holds the private key; the relay holds the public half and
// can verify but never mint. Nothing here reaches the relay and nothing
// there reaches D1.
//
// ═══ THE WALL (ACC0) ═══════════════════════════════════════════════
//
// A GUEST GETS A TOKEN, exactly as a linked account does, and may
// connect, be seen, walk and chat. What a guest does not get is CLOUD
// SAVES - and ACC2 put that wall on the save routes below, which IS
// where the saves are: this service's job everywhere else is to say who
// somebody is, not to decide what they may do.
//
// THE REASON IS SHARPER THAN "the table says so": a guest account is
// one storage clear away from gone, which ACC0 records as the residue
// of the wall. A backup filed under a credential a player can lose by
// clearing their browser is a backup that cannot be restored, and that
// is the one promise a backup may not break.
//
//   GET  /v1/health                       -> { ok, v }
//   GET  /v1/pubkey                       -> { alg, key }   (not a secret)
//   POST /v1/auth/guest   { label? }      -> { id, secret, sessionId, name, kind }
//   POST /v1/auth/token   { secret }      -> { token, name, kind, expiresAt }
//   POST /v1/auth/session { secret, label? } -> { secret, sessionId }   (a second device)
//   GET  /v1/account      Authorization: Bearer <secret> -> { account, wardrobe, devices[] }
//   POST /v1/auth/logout  { secret, all? }-> { revoked, scope }
//
// ACC3, the wardrobe. A player HOLDS titles by derivation and WEARS at
// most one, which is the only part of it that is a choice:
//   POST /v1/account/title { title }      -> { ok, titles[], title, glyphs[] }
// ACC4, time played. A beat carries no number - this clock measures:
//   POST /v1/account/played {}            -> { playedS }
// MOD1, moderation. The caller must be a moderator or a developer:
//   POST /v1/mod/mute { target, minutes } -> { ok, target, name, until, order }
// DUEL1, the duelling record. The caller of `loss` is the loser:
//   POST /v1/duel/loss   { winner }       -> { recorded, wins, losses }
//   POST /v1/duel/record { id }           -> { id, wins, losses, gates }
// WB5b, the gates closed. The caller is the account the receipt names:
//   POST /v1/gate/claim  { receipt }      -> { recorded, closed }
// RENOWN1, Renown. The caller's own character, by the id its
// save carries; the level rides the token when the mint names one:
//   POST /v1/renown/xp { character, xp, name?, rid? } -> { character, xp, level, credited, rose, order, max?, repeat? }
//   POST /v1/auth/token { character? }    -> { ..., level }
//
// ACC2, and every one of them needs a REGISTERED account (the wall):
//   GET    /v1/saves                                   -> { saves[] }
//   PUT    /v1/saves/{charId}/{name}       <card JSON>  -> { ok, created }
//   PUT    /v1/saves/{charId}/{name}/data  <raw blob>   -> { ok, bytes }
//   PUT    /v1/saves/{charId}/{name}/shot  <raw blob>   -> { ok, bytes }
//   GET    /v1/saves/{charId}/{name}/data              -> the blob
//   GET    /v1/saves/{charId}/{name}/shot              -> the blob
//   DELETE /v1/saves/{charId}/{name}                   -> { ok }
//
// Bindings (wrangler.toml): env.DB (D1), env.ALLOWED_ORIGIN,
// env.ACCOUNT_VERSION, and the signing pair, which the deploy mints
// ONCE and puts in with `wrangler secret put` - never into the toml,
// which is committed:
//
//   env.IDENTITY_PRIVATE_KEY  base64 PKCS8 Ed25519. A SECRET. It is
//                             what makes a token believable and it is
//                             never read back out of Cloudflare.
//   env.IDENTITY_PUBLIC_KEY   base64url raw. NOT a secret - /v1/pubkey
//                             hands it to anybody who asks. It lives
//                             beside the private half because the pair
//                             is minted where no person is watching,
//                             and a verifying key nobody can read again
//                             would have to be re-minted, which
//                             invalidates every token already issued.
//
// THE SECRET IS A BEARER CREDENTIAL, so it rides in the
// `Authorization: Bearer` header, or in the BODY of a POST. NEVER in a
// query string - AUDIT-ACC F13 found `/v1/account` reading `?secret=`,
// excused at the time as "read-only, and a slice that makes it do more
// must move it". That excuse answers the wrong risk: the hazard is not
// that the route mutates, it is that a URL is written into Cloudflare's
// request logs, into a Referer, and into browser history. Read-only or
// not, the credential was in all three.
// ═══════════════════════════════════════════════════════════════════

import {
  createGuest, openSession, resolveSession, closeSession, closeAllSessions,
  devicesOf, accountView, displayName, accountKind,
  register, login, recover, changePassword, setEmail, overRate,
  accountWardrobe, equipTitle, creditPlay, muteAccount, isMuted, mutedUntil,
  duelRecordOf, reportDuelLoss, gateRecordOf, claimGate,
  ACCOUNT_MAX, ACCOUNT_WINDOW_S,
} from './accounts.js';
import { mintToken, mintOrder, mintRenownOrder, MAX_TTL_S, TOKEN_V, ID_RE } from '../../src/net/identityToken.js';
import { ACCOUNT_VERSION, MAX_BODY_BYTES, ROUTES, OPEN_ROUTES, savePathOf, SAVE_MAX_BYTES, SHOT_MAX_BYTES } from './service.js';
import { listSaves, putCard, putBlob, getBlob, deleteSave, saveCardOf } from './saves.js';
import { signingKey, gatePublicKey } from './signing.js';
import { titleWorn, glyphsOf } from './titles.js';
import { sendLetter, inboxOf, readLetter, deleteLetter } from './letters.js';   // MAIL1: the letters' routes
import { reportRenownXp, renownTrackOf, renownTracksOf, renownCharacterOk } from './renownTracks.js';   // RENOWN1: Renown's track
import { claimHome, releaseHome, setHomeEntry, homesInTown, homesOf } from './homes.js';   // HOME1: the online homes' routes
import {
  foundGuild, guildOf, invitesOf, inviteToGuild, answerInvite, leaveGuild, removeFromGuild, rankGuildMember, renameGuildRanks,
  depositToGuild, withdrawFromGuild, handOverGuild, disbandGuild,
} from './guilds.js';   // GUILD1: the guilds' routes
import { decorOf, placeDecor, moveDecor, removeDecor } from './decor.js';   // DECOR1: an online home's decor

// THIS MODULE EXPORTS `default` AND NOTHING ELSE, and that is a
// runtime requirement rather than a preference: in a module Worker
// every named export of the entrypoint is read as an entrypoint, and
// a plain constant is not one - workerd refuses to start. AUDIT-ACC
// F2 found it by booting the Worker; no node test could, because the
// tests imported the very names that were breaking it. What this
// service IS lives in service.js; what it signs with lives in
// signing.js; both are imported here and by the pins.

const json = (body, status = 200, origin = '*') => new Response(JSON.stringify(body), {
  status,
  headers: {
    'content-type': 'application/json; charset=utf-8',
    'access-control-allow-origin': origin,
    'cache-control': 'no-store',
  },
});

/** Every refusal is one word and the same shape. A client learns that
 *  it failed and not why somebody else's secret is wrong. */
const no = (why, status, origin) => json({ error: why }, status, origin);
/** GUILD1: each guild refusal's status - a bad shape 400 (the default), the wrong rank or too little Renown 403, a
 *  thing that is not there 404, a conflict with what is 409, the hour's writes spent 429. */
const GUILD_STATUS = Object.freeze({
  'guilds-need-account': 403, 'guild-rank': 403, 'guild-renown': 403,
  'no-guild': 404, 'no-invite': 404, 'no-member': 404, 'no-player': 404,
  'guild-already': 409, 'guild-name-taken': 409, 'guild-tag-taken': 409, 'guild-full': 409, 'guild-master-leaves': 409,
  'guild-treasury': 409, 'guild-treasury-full': 409, 'guild-treasury-short': 409,
  'guild-rate': 429,
});

/** A body's bytes, or null past `max` - refused on the length it
 *  ANNOUNCES before a byte is read, and on the bytes that ARRIVE as
 *  they arrive. AUDIT 68 X8-account-body-cap-not-enforced-without-content-length:
 *  a chunked body announces nothing, and `request.text()` buffered all
 *  of it - pre-auth, before any limiter - to refuse it afterwards. */
async function readCapped(request, max) {
  const len = Number(request.headers.get('content-length') ?? '0');
  if (Number.isFinite(len) && len > max) return null;
  if (!request.body) return new ArrayBuffer(0);
  const reader = request.body.getReader();
  const parts = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > max) { await reader.cancel(); return null; }
    parts.push(value);
  }
  const out = new Uint8Array(size);
  let at = 0;
  for (const p of parts) { out.set(p, at); at += p.byteLength; }
  return out.buffer;
}

async function readBody(request) {
  const bytes = await readCapped(request, MAX_BODY_BYTES);
  if (!bytes) return null;
  const text = new TextDecoder().decode(bytes);
  if (!text) return {};
  try { const v = JSON.parse(text); return v && typeof v === 'object' && !Array.isArray(v) ? v : null; } catch { return null; }
}

export default {
  async fetch(request, env) {
    const subtle = crypto.subtle;
    const rand = (b) => crypto.getRandomValues(b);
    const nowS = Math.floor(Date.now() / 1000);
    const origin = env.ALLOWED_ORIGIN || '*';
    const url = new URL(request.url);
    const path = url.pathname;

    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'access-control-allow-origin': origin,
          'access-control-allow-methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'access-control-allow-headers': 'content-type, authorization',
          'access-control-max-age': '86400',
        },
      });
    }

    if (path === '/v1/health') return json({ ok: true, v: env.ACCOUNT_VERSION || ACCOUNT_VERSION }, 200, origin);

    // ACC1-CI: THE SERVICE PUBLISHES ITS OWN PUBLIC KEY, and that is the
    // whole point of it being public. The pair is minted by the deploy
    // and neither half is ever typed by a person, so without this the
    // public key would exist only in the run log that minted it - and a
    // verifying key nobody can read again is a verifying key that has to
    // be re-minted, which invalidates every token already issued.
    //
    // It is served openly, before any credential, because A PUBLIC KEY
    // CAN VERIFY AND CANNOT MINT. Anyone may check a token this service
    // signed; nobody may sign one.
    if (path === '/v1/pubkey') {
      const pub = String(env.IDENTITY_PUBLIC_KEY ?? '');
      return pub
        ? json({ alg: TOKEN_V, key: pub }, 200, origin)
        : no('no-signing-key', 503, origin);
    }

    // A PATH NOBODY SERVES IS A 404, and it is answered HERE - before
    // the credential is looked at. The first cut checked auth first,
    // which made every unknown path answer 401 to a caller with no
    // secret: technically a shade harder to enumerate, and in practice
    // a lie that costs an afternoon the first time somebody typos a
    // route. The paths this service serves are in this file and in the
    // repo; they are not the secret.
    // ACC2: a save route carries the slot IN the path, so it is matched
    // rather than looked up - and it is asked here, beside the Set, so
    // there is still exactly one place that decides a path is a 404.
    const slot = savePathOf(path);
    if (!ROUTES.has(path) && !slot) return no('not-found', 404, origin);

    const db = env.DB;
    if (!db) return no('no-database', 503, origin);
    const ctx = { db, subtle, rand, nowS };

    try {
      if (OPEN_ROUTES.has(path)) {
        if (request.method !== 'POST') return no('method', 405, origin);
        const body = await readBody(request);
        if (!body) return no('body', 400, origin);

        // ONE BUCKET PER CALLER for everything a stranger can reach, so
        // a single address cannot mint accounts or grind passwords
        // without limit. The per-HANDLE buckets inside login/recover
        // are the other half - one stops a flood, the other stops a
        // patient attacker with many addresses picking one account.
        const ip = request.headers.get('cf-connecting-ip') || 'unknown';
        if (await overRate(ctx, `ip:${ip}`, 60)) return no('rate', 429, origin);

        if (path === '/v1/auth/guest') {
          const made = await createGuest(ctx, { deviceLabel: body.label ?? null });
          return json(made, 200, origin);
        }
        if (path === '/v1/auth/login') {
          const r = await login(ctx, { handle: body.handle, password: body.password, deviceLabel: body.label ?? null });
          // A REFUSAL NAMES NO CAUSE a stranger could use: `bad-login`
          // is the same word for a handle nobody holds and a password
          // that is wrong, and the two cost the same time besides.
          return r.error ? no(r.error, r.error === 'rate' ? 429 : 401, origin) : json(r, 200, origin);
        }
        // /v1/auth/recover
        const r = await recover(ctx, { handle: body.handle, code: body.code, password: body.password });
        return r.error ? no(r.error, r.error === 'rate' ? 429 : 401, origin) : json(r, 200, origin);
      }

      // EVERY ROUTE BELOW NEEDS A SECRET, and resolving it is the same
      // one indexed lookup every time.
      const body = request.method === 'POST' ? await readBody(request) : {};
      if (!body) return no('body', 400, origin);
      // ═══ AUDIT-ACC F13: A CREDENTIAL DOES NOT GO IN A URL ══════
      //
      // This read `?secret=` on a GET, and the comment above defended
      // it as "read-only, and a slice that makes it do more must move
      // it". That answers the wrong risk. The hazard was never that the
      // route mutates - it is that A URL IS LOGGED: Cloudflare records
      // request URLs, a Referer carries them to any third party the
      // page links to, and a browser writes them into history. The
      // session secret was landing in all three.
      //
      // A HEADER IS NOT LOGGED BY DEFAULT and is never in a Referer, so
      // that is where a bearer credential belongs. A POST may still
      // carry it in the body - a body is in none of those places - and
      // the header wins if both are present, so there is one answer
      // when they disagree.
      const auth = request.headers.get('authorization') ?? '';
      const bearer = /^Bearer (.+)$/.exec(auth)?.[1];
      const secret = bearer ?? (request.method === 'POST' ? body.secret : null);
      const who = await resolveSession(ctx, secret);
      if (!who) return no('auth', 401, origin);

      // AUDIT-ACC F12: A CREDENTIAL IS NOT A LICENCE TO HAMMER. The
      // open routes were bounded per address and everything behind a
      // session was not, so one valid secret could mint signatures and
      // spend D1 without limit. Bounded per ACCOUNT rather than per
      // address, because the account is what the caller proved.
      //
      // 429 AND NOT 401. Telling a rate-limited player their
      // credentials are wrong sends them to reset a password that was
      // never the problem - Fight Life's own note beside the same
      // check, and the reason its limiter throws rather than returns.
      if (await overRate(ctx, `acct:${who.player.id}`, ACCOUNT_MAX, ACCOUNT_WINDOW_S)) {
        return no('rate', 429, origin);
      }

      if (path === '/v1/auth/token' && request.method === 'POST') {
        const key = await signingKey(env, subtle);
        // A service with no key can still hand out accounts; it just
        // cannot vouch for them. Said plainly rather than by minting
        // something the relay will refuse.
        if (!key) return no('no-signing-key', 503, origin);
        // ═══ ACC3: THE BADGE RIDES IN THE TOKEN ══════════════════
        //
        // A title and a glyph are read off the SIGNED claims and never
        // off anything a client says about itself - which is the exact
        // hole ACC1g closed one slice ago for the NAME, and a title is
        // a stronger thing to claim than a name is. A client that
        // announced "I am a Developer" over the wire would be believed
        // by every other client in the room; a client that announces it
        // here is simply not signed for.
        //
        // DERIVED AT MINT, so both are answered by the row and the
        // config AS THEY ARE NOW, and both lapse on their own: a
        // developer taken off the list, or a sprout that has aged past
        // two weeks, stops being signed for on the next token - with
        // no cron and no column to clear. A token lives MAX_TTL_S, so
        // the badge is at most five minutes stale.
        const wardrobe = {
          t: titleWorn(who.player, env),
          g: glyphsOf(who.player, env, nowS),
        };
        // MOD1: A MUTE RIDES THE TOKEN, so a reconnect cannot shed one -
        // every room reads it off the signature at the hello. Only while
        // it runs: a mute that has ended is simply absent.
        const mu = isMuted(who.player, nowS) ? mutedUntil(who.player) : undefined;
        // RENOWN1: AND THE LEVEL, when the client names the character it is
        // bringing online - that character's, derived from its track now
        // (1 for a character that has earned nothing yet). The client's
        // word is only WHICH of its own characters; the number is this
        // service's. A mint naming none (an older build) carries none.
        const lv = renownCharacterOk(body.character) ? ((await renownTrackOf(ctx, who.player.id, body.character))?.level ?? 1) : undefined;
        const token = await mintToken(
          { s: who.player.id, n: displayName(who.player), k: accountKind(who.player), ...wardrobe, mu, lv },
          key, { subtle, nowS },
        );
        return json({
          token,
          name: displayName(who.player),
          kind: accountKind(who.player),
          title: wardrobe.t ?? null,
          glyphs: wardrobe.g,
          mutedUntil: mu ?? 0,
          level: lv ?? null,
          expiresAt: nowS + MAX_TTL_S,
        }, 200, origin);
      }

      if (path === '/v1/auth/session' && request.method === 'POST') {
        // A SECOND DEVICE, admitted by a device that is already in.
        // This is the whole of "two devices at once" and it is why a
        // session is the credential rather than the player.
        const made = await openSession(ctx, who.player.id, body.label ?? null);
        return json(made, 200, origin);
      }

      if (path === '/v1/account' && request.method === 'GET') {
        // ACC3: THE WARDROBE IS ITS OWN FIELD and not folded into the
        // account, because it is a different KIND of fact. An account
        // view is the row; a wardrobe is the row read against this
        // service's config and clock, which is why it alone takes env.
        return json({
          // DUEL1: and the duelling record, counted off the results (the profile card's K/D); WB5b: and the gates closed
          // RENOWN1: and Renown's tracks, the most recently earned first (the card's level and its row)
          account: { ...accountView(who.player, nowS), duels: await duelRecordOf(ctx, who.player.id), gates: await gateRecordOf(ctx, who.player.id), renown: await renownTracksOf(ctx, who.player.id) },
          wardrobe: accountWardrobe(who.player, env, nowS),
          devices: await devicesOf(ctx, who.player.id),
        }, 200, origin);
      }

      if (path === '/v1/duel/loss' && request.method === 'POST') {
        // DUEL1: THE LOSER'S OWN REPORT. The caller is the loser - the
        // session says so, never the body - and `winner` is the account
        // the relay stamped on the winner's frames. accounts.js
        // `reportDuelLoss` holds the bounds inside its one INSERT.
        const r = await reportDuelLoss(ctx, who.player, body.winner);
        return r.error ? no(r.error, r.error === 'no-player' ? 404 : 400, origin) : json(r, 200, origin);
      }

      if (path === '/v1/duel/record' && request.method === 'POST') {
        // DUEL1: ANY account's record, for the Inspect card - asked by
        // a signed-in player of the account the relay stamped on the
        // card they were answered with. A record is two counts and is
        // no secret; the id rides the body, never the path (MAIL1's
        // law: an id is not a URL a log keeps).
        if (typeof body.id !== 'string' || !ID_RE.test(body.id)) return no('no-player', 404, origin);
        const known = await db.prepare('SELECT 1 AS x FROM players WHERE id = ?1').bind(body.id).first();
        if (!known) return no('no-player', 404, origin);
        // WB5b: the gates closed ride the same answer - the Inspect card asks once and says both
        return json({ id: body.id, ...(await duelRecordOf(ctx, body.id)), gates: await gateRecordOf(ctx, body.id) }, 200, origin);
      }

      if (path === '/v1/gate/claim' && request.method === 'POST') {
        // WB5b: THE ACCOUNT THE RECEIPT NAMES CARRIES IT HERE. The
        // relay signed it at the kill (src/net/gateReceipt.js); the
        // session says who is asking, never the body, and accounts.js
        // `claimGate` holds the rest - the signature, the account, the
        // one row a (day, account). No public half here yet is the
        // service's own gap, not the player's: 503, and the client keeps
        // the receipt for the week it carries.
        const r = await claimGate(ctx, who.player, body.receipt, await gatePublicKey(env, subtle));
        // AUDIT WB A5: a refused receipt says WHICH rung refused it - the client keeps one the service can mend (its key
        // not the relay's pair, a clock) and lets go of one it cannot
        if (r.error) return json({ error: r.error, ...(r.why ? { why: r.why } : {}) }, r.error === 'no-gate-key' ? 503 : r.error === 'not-yours' ? 403 : 400, origin);
        return json(r, 200, origin);
      }

      if (path === '/v1/renown/xp' && request.method === 'POST') {
        // RENOWN1: WHAT ONE OF THE CALLER'S CHARACTERS EARNED ONLINE. The
        // account is the session's, never the body's; the bounds are all
        // in renownTracks.js `reportRenownXp`. A level that ROSE comes back
        // with a signed order the client carries to the rooms it is in,
        // so the level beside its name moves there now rather than at its
        // next connection - and a service with no key still credits, it
        // just cannot vouch for the new level until then.
        // AUDIT RENOWN1 DATA-4: `rid` the report's own id, so a report sent again because its answer was lost is
        // answered again (`repeat`) rather than credited twice - and a repeat carries an order too, since the
        // answer that was lost may have been the one with the rise in it.
        const r = await reportRenownXp(ctx, who.player, { character: body.character, xp: body.xp, name: body.name ?? null, rid: body.rid ?? null });
        if (r.error) return no(r.error, r.error === 'renown-full' ? 409 : 400, origin);
        let order = null;
        if (r.rose || (r.repeat && r.level > 1)) {
          const key = await signingKey(env, subtle);
          if (key) order = await mintRenownOrder({ s: who.player.id, lv: r.level }, key, { subtle, nowS });
        }
        return json({ ...r, order }, 200, origin);
      }

      // ═══ HOME1: THE ONLINE HOMES ═════════════════════════════════
      //
      // A town's homes are anyone's to READ - a guest's session too, since
      // every door says whose a home is. Owning one is an account's: the
      // same wall as the letters' and the saves', with its own word (a
      // guest is a device, and a home held by one a cleared browser loses
      // is a building gone from the world). homes.js holds the bounds.
      if (path.startsWith('/v1/homes/')) {
        if (request.method !== 'POST') return no('method', 405, origin);
        if (path === '/v1/homes/town') {
          const r = await homesInTown(ctx, who.player, body);
          return 'error' in r ? no(r.error, 400, origin) : json(r, 200, origin);
        }
        if (path === '/v1/homes/mine') return json(await homesOf(ctx, who.player), 200, origin);
        if (path === '/v1/homes/decor') {
          const r = await decorOf(ctx, who.player, body);
          return 'error' in r ? no(r.error, 400, origin) : json(r, 200, origin);
        }
        if (accountKind(who.player) !== 'linked') return no('homes-need-account', 403, origin);
        if (path.startsWith('/v1/homes/decor/')) {
          // DECOR1: a piece placed, moved or removed - the owner's character's alone (decor.js)
          const r = path === '/v1/homes/decor/place' ? await placeDecor(ctx, who.player, body)
            : path === '/v1/homes/decor/move' ? await moveDecor(ctx, who.player, body)
              : await removeDecor(ctx, who.player, body);
          if (!('error' in r)) return json(r, 200, origin);
          const status = r.error === 'decor-cap' || r.error === 'decor-taken' ? 409
            : r.error === 'decor-rate' ? 429
              : r.error === 'no-home' || r.error === 'no-decor' ? 404 : 400;
          return no(r.error, status, origin);
        }
        if (path === '/v1/homes/claim') {
          const r = await claimHome(ctx, who.player, body);
          if (!('error' in r)) return json(r, 200, origin);
          const status = r.error === 'home-taken' || r.error === 'home-cap' ? 409 : r.error === 'home-rate' ? 429 : 400;
          return no(r.error, status, origin);
        }
        const r = path === '/v1/homes/release' ? await releaseHome(ctx, who.player, body) : await setHomeEntry(ctx, who.player, body);
        return 'error' in r ? no(r.error, r.error === 'bad-entry' ? 400 : 404, origin) : json(r, 200, origin);
      }

      // ═══ GUILD1: THE GUILDS ═════════════════════════════════════
      //
      // A character's own guild and the account's invitations are read by
      // any session (a guest's reads none); every change is an account's -
      // guilds.js asks again, and holds the bounds.
      if (path.startsWith('/v1/guilds/')) {
        if (request.method !== 'POST') return no('method', 405, origin);
        if (path === '/v1/guilds/mine') {
          const r = await guildOf(ctx, who.player, body);
          return 'error' in r ? no(r.error, GUILD_STATUS[r.error] ?? 400, origin) : json(r, 200, origin);
        }
        if (path === '/v1/guilds/invites') return json(await invitesOf(ctx, who.player), 200, origin);
        if (accountKind(who.player) !== 'linked') return no('guilds-need-account', 403, origin);
        const act = {
          '/v1/guilds/found': foundGuild, '/v1/guilds/invite': inviteToGuild, '/v1/guilds/answer': answerInvite,
          '/v1/guilds/leave': leaveGuild, '/v1/guilds/remove': removeFromGuild, '/v1/guilds/rank': rankGuildMember,
          '/v1/guilds/ranks': renameGuildRanks, '/v1/guilds/deposit': depositToGuild, '/v1/guilds/withdraw': withdrawFromGuild,
          '/v1/guilds/handover': handOverGuild, '/v1/guilds/disband': disbandGuild,
        }[path];
        if (!act) return no('not-found', 404, origin);
        const r = await act(ctx, who.player, body);
        if (!('error' in r)) return json(r, 200, origin);
        return no(r.error, GUILD_STATUS[r.error] ?? 400, origin);
      }

      if (path === '/v1/account/title' && request.method === 'POST') {
        // EQUIP ONE, OR NONE. Mac: "tap the account icon to equip 1
        // feature along with signing out." An absent `title` and an
        // explicit `null` both mean take it off - a player may always
        // wear nothing, and there is nothing to refuse them for.
        //
        // 403 AND NOT 401 for `not-held`: the credential is good, the
        // title is simply not theirs. Same reading as the save wall.
        const r = await equipTitle(ctx, who.player, env, body.title ?? null);
        return r.error ? no(r.error, r.error === 'not-held' ? 403 : 400, origin) : json(r, 200, origin);
      }

      if (path === '/v1/mod/mute' && request.method === 'POST') {
        // MOD1: THE ROW FIRST, THE ORDER SECOND. The row is the truth and
        // every later token carries it; the order is only how rooms that
        // are ALREADY holding the target hear it now. So a service with
        // no signing key still mutes - it just cannot tell live rooms,
        // and says so rather than pretending.
        const r = await muteAccount(ctx, who.player, env, { target: body.target, minutes: body.minutes });
        if (r.error) {
          const status = r.error === 'not-moderator' || r.error === 'protected' ? 403 : r.error === 'no-player' ? 404 : 400;
          return no(r.error, status, origin);
        }
        const key = await signingKey(env, subtle);
        const order = key ? await mintOrder({ s: r.target, mu: r.until }, key, { subtle, nowS }) : null;
        return json({ ...r, order }, 200, origin);
      }

      if (path === '/v1/account/played' && request.method === 'POST') {
        // ACC4: A BEAT, AND NOTHING IN IT IS READ. Whatever the body
        // says, the credit is the gap by THIS clock (accounts.js
        // `creditPlay`), so there is no field a client could inflate.
        return json(await creditPlay(ctx, who.player.id), 200, origin);
      }

      if (path === '/v1/auth/register' && request.method === 'POST') {
        // AN UPGRADE IN PLACE of the row this session already belongs
        // to - not a new account. The recovery code in the answer is
        // THE ONLY TIME IT IS EVER READABLE.
        const r = await register(ctx, who.player.id, { handle: body.handle, password: body.password });
        return r.error ? no(r.error, 400, origin) : json(r, 200, origin);
      }

      if (path === '/v1/account/password' && request.method === 'POST') {
        const r = await changePassword(ctx, who.player, who.session, { oldPassword: body.oldPassword, password: body.password });
        return r.error ? no(r.error, r.error === 'rate' ? 429 : r.error === 'bad-login' ? 401 : 400, origin) : json(r, 200, origin);
      }

      if (path === '/v1/account/email' && request.method === 'POST') {
        // COMPLETELY OPTIONAL (Mac). Nothing is gated behind it, and
        // `null` takes it off again.
        const r = await setEmail(ctx, who.player.id, body.email ?? null);
        return r.error ? no(r.error, 400, origin) : json(r, 200, origin);
      }

      if (path === '/v1/auth/logout' && request.method === 'POST') {
        // THIS DEVICE by default. Signing out of a laptop has never
        // dropped somebody's phone, and "everywhere" is a separate,
        // explicit act rather than a surprise.
        const r = body.all === true
          ? await closeAllSessions(ctx, who.player.id)
          : await closeSession(ctx, who.session.id);
        return json({ ...r, scope: body.all === true ? 'all' : 'this' }, 200, origin);
      }

      // ═══ MAIL1: LETTERS ═════════════════════════════════════════
      //
      // THE SAME WALL AS THE SAVES', with its own word for the same
      // reason theirs has one (below): a guest is a device, and neither
      // a reader a letter can find again nor a writer a mute can reach
      // (server-account/src/letters.js says both). 403, not 401: the
      // credential is good.
      if (path.startsWith('/v1/mail/')) {
        if (accountKind(who.player) !== 'linked') return no('mail-needs-account', 403, origin);
        if (path === '/v1/mail/inbox') {
          if (request.method !== 'GET') return no('method', 405, origin);
          return json(await inboxOf(ctx, who.player, env), 200, origin);
        }
        if (request.method !== 'POST') return no('method', 405, origin);
        if (path === '/v1/mail/send') {
          const r = await sendLetter(ctx, who.player, { to: body.to, subject: body.subject, body: body.body });
          if (!('error' in r)) return json(r, 200, origin);
          const status = r.error === 'muted' ? 403 : r.error === 'no-reader' ? 404 : r.error === 'mail-rate' ? 429 : r.error === 'inbox-full' ? 409 : 400;
          return no(r.error, status, origin);
        }
        const r = path === '/v1/mail/read' ? await readLetter(ctx, who.player, env, body.id) : await deleteLetter(ctx, who.player, body.id);
        return 'error' in r ? no(r.error, 404, origin) : json(r, 200, origin);
      }

      // ═══ ACC2: THE SAVES ═══════════════════════════════════════
      //
      // THE WALL, and the only place in this service that asks what an
      // account may DO rather than who it is. A guest is refused every
      // save route, read and write alike: an account that can be lost
      // by clearing a browser cannot hold a backup, because a backup
      // that cannot be restored is worse than none.
      //
      // ITS OWN WORD, not `not-registered`. That one already means "this
      // account has no password yet" at the sign-in routes, and the
      // refusal table maps one word to one sentence - so reusing it
      // would tell a player at the backup button to sign in again,
      // which is not what they need to do. 403 rather than 401 because
      // the credential is GOOD; there is nothing to sign in again with.
      if (path === '/v1/saves' || slot) {
        if (accountKind(who.player) !== 'linked') return no('saves-need-account', 403, origin);
        const me = who.player.id;

        if (path === '/v1/saves') {
          if (request.method !== 'GET') return no('method', 405, origin);
          return json({ saves: await listSaves(ctx, me) }, 200, origin);
        }

        const bucket = env.SAVES;
        const sctx = { ...ctx, bucket };

        if (!slot.part) {
          if (request.method === 'PUT') {
            // THE CARD, and it is what CREATES a slot - the blobs below
            // refuse to land without one (saves.js says why: it is
            // SAV4's "a slot is only real WITH its SaveInfo", and it is
            // also the only thing bounding R2).
            const card = saveCardOf(await readBody(request));
            if (!card) return no('body', 400, origin);
            const r = await putCard(sctx, me, { ...slot, card });
            return r.error ? no(r.error, r.error === 'too-many-saves' ? 409 : 400, origin) : json(r, 200, origin);
          }
          if (request.method === 'DELETE') {
            const r = await deleteSave(sctx, me, slot);
            return r.error ? no(r.error, 404, origin) : json(r, 200, origin);
          }
          return no('method', 405, origin);
        }

        if (request.method === 'PUT') {
          // A RAW BODY, AGAINST ITS OWN BOUND. `readBody` caps at
          // MAX_BODY_BYTES (4 KiB), which is right for every JSON route
          // this service has and would refuse every real save - so the
          // blob routes never touch it and carry the bound that fits
          // them instead. The length is checked BEFORE the body is
          // read, so a caller announcing a gigabyte costs nothing, and
          // as it arrives, so one announcing nothing costs the bound.
          const max = slot.part === 'shot' ? SHOT_MAX_BYTES : SAVE_MAX_BYTES;
          const body = await readCapped(request, max);
          if (!body) return no('too-large', 413, origin);
          if (!body.byteLength) return no('body', 400, origin);
          const r = await putBlob(sctx, me, slot, slot.part, body, body.byteLength);
          return r.error ? no(r.error, r.error === 'no-slot' ? 404 : 503, origin) : json(r, 200, origin);
        }

        if (request.method === 'GET') {
          const r = await getBlob(sctx, me, slot, slot.part);
          if (r.error) return no(r.error, r.error === 'no-storage' ? 503 : 404, origin);
          // THE BLOB ITSELF, not a JSON wrapper around a base64 copy of
          // it: a save is hundreds of kilobytes and base64 is a third
          // more of them, paid twice (once on the wire, once in the
          // string the client would have to hold whole).
          return new Response(r.object.body, {
            status: 200,
            headers: {
              'content-type': 'application/octet-stream',
              'access-control-allow-origin': origin,
              'cache-control': 'no-store',
            },
          });
        }
        return no('method', 405, origin);
      }

      // a path this service serves, reached with a method it does not
      return no('method', 405, origin);
    } catch (e) {
      // AUDIT ONLINE A17's law, on this side too: an uncaught error is
      // LOGGED, not lost, and a player is told nothing about it.
      console.error('[account]', path, e?.stack ?? String(e));
      return no('server', 500, origin);
    }
  },
};
