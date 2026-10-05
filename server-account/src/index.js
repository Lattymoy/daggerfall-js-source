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
//   POST /v1/auth/guest   { label?, terms, privacy } -> { id, secret, sessionId, name, kind }   (TERMS1: the versions ticked, legalLaw.js)
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
// CUSTOMS-PASS, a developer alone - one character of one account through customs (tools/customsPass.mjs):
//   POST /v1/mod/customs-pass { name | account, revoke? } -> { ok, target, name, open, changed }
// DUEL1, the duelling record. The caller of `loss` is the loser:
//   POST /v1/duel/loss   { winner }       -> { recorded, wins, losses }
//   POST /v1/duel/record { id }           -> { id, wins, losses, gates }
// WB5b, the gates closed. The caller is the account the receipt names:
//   POST /v1/serpent/claim { receipt, character, name?, cid? } -> { recorded, slain, renown, spoils, order }   (SERPENT1: a sea serpent's receipt)
//   POST /v1/gate/claim  { receipt, region?, character? } -> { recorded, stones, closed, seat? }   (WB12d: the row's embers, AUDIT WB12d A4; SEAT1b: `seat` the kill's influence)
// MARKS1, Marks - an account's alone, behind MARKS_OPEN (marks.js); `rid` the act's own id:
//   POST /v1/marks/balance {}                               -> { balance, today, bank }
//   POST /v1/marks/exchange { marks, rid }                  -> { ok, marks, gold, balance, exchangedToday } | { repeat, ... }
//   POST /v1/marks/guild/deposit { character, marks, rid }  -> { ok, marks, balance, guildMarks }
//   POST /v1/marks/guild/withdraw { character, marks, rid } -> { ok, marks, balance, guildMarks }
//   POST /v1/marks/report {}                                -> the week's report (a developer's)
//   and /v1/gate/claim's answer carries `marks` - the gate's strike - where it recorded
// NOTICE1, the Notice Board - read by anyone BOARD_OPEN lets in, written by registered accounts (board.js):
//   POST /v1/board/read { map }                                   -> { map, notices, notes, me }
//   POST /v1/board/pin { map, subject, body, days, button?, rid } -> { ok, note, live } | { ok, repeat, note }
//   POST /v1/board/take-down { id }                               -> { ok, id, live }
//   POST /v1/board/report { id }                                  -> { ok, id }
//   POST /v1/board/mod/remove { id } | /v1/board/mod/restore { id } -> { ok, id, act }   (a moderator's)
//   POST /v1/board/notice { subject, body, days } | /v1/board/notice/remove { id }       (a developer's)
// PROF1, the professions - a registered account's character's, behind PROFESSIONS_OPEN (professions.js); `rid` the act's id:
//   POST /v1/prof/state { character }                                  -> { tracks, today, taken, stores, writs, caps, hunt }   (PROF7: the account's hides today)
//   POST /v1/prof/pixels { character, pixels: [[x, y]...] }            -> { pixels: [{ x, y, state, climate?, region? }] }
//   POST /v1/prof/harvest { character, node, kind, climate, region, act, at, rid, foe? } -> { ok, material, qty, xp, track, today, store, gem?, extra?, extraQty?, hunt? } | { repeat, ... }   (PROF7: a body's `foe`, no ground)
//        BAG1: { carry: true, held, heldKey?, seen? } lands the goods in the carried count - `held` what the bag and pack
//        hold of `heldKey`, the count cut to it only when `seen` (the count the client last heard) is the service's own,
//        decided once a request (prof_carried_gate) - and a Motherlode's strike (PROF2b) the same  -> { ..., carry, carried }
//   POST /v1/prof/spec { character, profession, rank, spec, rid }      -> { ok, track, marks?, balance? }
//   POST /v1/prof/smelt { character, recipe, count, clean?, rid }      -> { ok, recipe, count, own, bought, xp, first?, clean?, track, stores } | { repeat, ... }   (PROF2; PROF4 the burns and saws; PROF7 the loom's cures and weave - a weave's `track` null; PROF11 the mason's bench's cut and mix - `clean` the chisel's, `first` its 500)
//   POST /v1/prof/craft { character, recipe, clean, name?, heartwood?, dye?, cracked?, rid } -> { ok, recipe, quality, count, seed, maker, marked, xp, first, heartwood, dye, hand?, pieces, track, stores } | { repeat, ... }   (PROF3 the anvil; PROF4 the workbench; PROF7 the loom and a garment's `dye`; PROF11 the Sculptor's stone decor; PROF9 the fire's dishes and a dish's `hand`; PROF10 the jeweller's bench - a piece's `hand`, a Lapidary's `cracked` gem)
//   POST /v1/prof/brew { character, potion, keys, seat?, rid } -> { ok, potion, keys, count, potent, unbruised, steps, xp, first, track, stores } | { repeat, ... }   (PROF12: Alchemy's brewing act - DFU's own recipe law on the Stores' cauldron; Potent rolled, the Apothecary's steps)
//   POST /v1/prof/disenchant { character, provenance, rid, realm? } -> { ok, provenance, recipe, points, essence, origin, xp, track, store, realm? } | { repeat, ... } | { error: 'prof-no-piece', why? }   (PROF12: a crafted piece into Arcane Essence, gone; AUDIT PROF-541 B2: a realm character's out of its record - `realm` where it stands, `realm.seq` the record's new sequence, `why: 'disenchanted'` a piece this account's disenchant took)
//   POST /v1/prof/stock { character, material, qty, rid }             -> { ok, ... } | { repeat, ... }   (PROF3 the smith's stock; PROF4 the furnisher's; PROF5 the Weavers')
//   POST /v1/stores/withdraw { character, material, qty, rid }         -> { ok, material, qty, store } | { repeat, ... }
//        BAG1: { carry: true, held, seen? } counts the units as carried -> { ..., carry, carried }
//   POST /v1/stores/deposit { character, material, qty, held, order, rid, seen? } -> { ok, material, qty, own, bought, gold, store, carried } | { repeat, ... }   (BAG1: `order` 'all' or 'spend'; a deposit made is answered as made, for good - prof_deposits)
//   POST /v1/writs/list { character, region }                          -> { region, day, endsAt, writs, today }
//   POST /v1/writs/deliver { character, id, rid }                      -> { ok, writ, pay, balance, track, store, today, renown, order } | { repeat, ... }
// RENOWN1, Renown. The caller's own character, by the id its
// save carries (RENOWN-CHAR: a track a character again - RENOWN-ACCOUNT
// kept one an account for a day); the level rides the token when the
// mint names one:
//   POST /v1/renown/xp { character, xp, name?, rid?, region? } -> { character, xp, level, credited, rose, order, max?, repeat? }   (SEAT1b: `region` where it was earned)
//   POST /v1/auth/token { character? }    -> { ..., level, xp }   (RENOWN4: xp, the track's total)
//   (REALM-DOOR: the token says whether that character is one of the account's realm characters, `rc`)
//   (ARENA4b: and, for a realm character, the level on its tile - its summary's - as `cl`, 1..1000)
// ARENA4b, the arena online's second half: a bout's Renown on its claim, and the homes the arena displaced:
//   POST /v1/arena/claim { receipt, character?, name? } -> { ...ARENA4's, renown?, order? }   (a ladder win, a rated players' win)
//   POST /v1/arena/attempt { tier, bout, room } -> { ticket, tier, bout, room, forfeits } | 409 { error: 'order', ladder } | 403 { error: 'ladder-needs-account' }   (AUDIT ARENA-LADDER: a ladder attempt's ticket, for one room)
//   POST /v1/homes/arena-move { mapId, from, to, character, realm? } -> { ok, from, to, refund, pieces, items, tenancies, withdrawn, hidden, hall?, realm?, repeat? }
//   POST /v1/homes/arena-moves { character }           -> { moves: [{ mapId, from, to, refund, movedAt, hall? }] }   (not yet read)
//   POST /v1/homes/arena-seen { mapId, from }          -> { ok, seen }
// FIELD BUGS 2026-10-04d KNIGHT-HOUSE, a deed the realm gave (a Knightly Order's house) held off the record, and its hold
// given up as the deed sells at the bank:
//   POST /v1/homes/deed { mapId, buildingKey, region, character, layout } -> { ok, home } | { ok, repeat }
//   POST /v1/homes/release { mapId, buildingKey, deed: true }  -> { ok, price: 0, decorCount: 0, decorBack: 0 }
// PATREON-LINK, a patron's own Patreon (patreon.js) - /v1/account's answer carries `patreon: { on, linked, titles,
// link }`, `link` the authorize URL with a state sealed for the account; the next three answer a browser and Patreon:
//   GET  /v1/patreon/callback ?code&state  -> a page asking which game account, with the yes's ticket
//   POST /v1/patreon/confirm  ticket=...   -> a page: linked, with what Patreon says NOW (a form, not JSON - the page posts it)
//   POST /v1/patreon/webhook  <member>     -> { ok, applied }   (X-Patreon-Signature: HMAC-MD5 under the webhook secret)
//   POST /v1/patreon/unlink   {}           -> { ok, titles, title, glyphs, auras, aura, insignia, patreon }   (an equip's shape)
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
  register, login, recover, changePassword, setEmail, overRate, overAccountRate,
  accountWardrobe, equipTitle, equipAura, equipGlyph, buyInsignia, insigniaPurse, creditPlay, muteAccount, isMuted, mutedUntil,
  duelRecordOf, reportDuelLoss, gateRecordOf, claimGate, legalRefusal,
  ACCOUNT_MAX, ACCOUNT_WINDOW_S,
} from './accounts.js';
import { mintToken, mintOrder, mintRenownOrder, mintGuildOrder, mintGuildOutOrder, MAX_TTL_S, TOKEN_V, ID_RE, SEAT_TITLES } from '../../src/net/identityToken.js';
import { ACCOUNT_VERSION, MAX_BODY_BYTES, ROUTES, OPEN_ROUTES, PATREON_OPEN_ROUTES, savePathOf, realmPathOf, SAVE_MAX_BYTES, SHOT_MAX_BYTES, maintaining } from './service.js';
import { listSaves, putCard, putBlob, getBlob, deleteSave, saveCardOf } from './saves.js';
import { signingKey, gatePublicKey } from './signing.js';
import { titleWorn, glyphsOf, glyphsHidden, auraWorn } from './titles.js';
import { claimArena, arenaAttempt, arenaBoardOf, arenaTeam, withArenaHonours, arenaRatingOf, ARENA_HONOUR_PATHS, ARENA_RENOWN_REGION } from './arena.js';   // ARENA4: the arena's records, its board, its banners, and the honours the mint reads
import { arenaSeasonOf } from '../../src/net/arenaLaw.js';
import { sendLetter, inboxOf, readLetter, deleteLetter } from './letters.js';   // MAIL1: the letters' routes
import { reportRenownXp, renownTrackOf, renownTracksOf, renownCharacterOk } from './renownTracks.js';   // RENOWN1: Renown's track - RENOWN-CHAR: a character's again
import { claimRaid, raidRecordOf } from './raids.js';   // RAID4: the towns defended
import { claimSerpent, serpentRecordOf } from './serpents.js';   // SERPENT1: the serpents slain
import { claimHome, releaseHome, setHomeEntry, homesInTown, homesOf, setHomeLook, homeLayouts, arenaMoveHome, arenaMovesOf, arenaMoveSeen, holdDeed } from './homes.js';   // HOME1: the online homes' routes; HOME-LOOK: its outside; WD3: the towns' layouts; ARENA4b: the homes the arena displaced, moved; FIELD BUGS 2026-10-04d KNIGHT-HOUSE: a deed held
import { roomsOf, offerRoom, withdrawRoom, rentRoom, collectRent } from './rent.js';   // HOME-RENT: a home's rooms, rented
import {
  foundGuild, guildOf, invitesOf, inviteToGuild, answerInvite, leaveGuild, removeFromGuild, rankGuildMember, renameGuildRanks,
  depositToGuild, withdrawFromGuild, handOverGuild, disbandGuild, guildBadgeOf,
  renameGuild,   // GUILD2a
} from './guilds.js';   // GUILD1: the guilds' routes; GUILD1c: the guild a token carries
import { vaultOf, vaultPut, vaultTake, vaultGrant } from './guildVault.js';   // GUILD2b: the guild's vault
import { buyHall, sellHall, setHallEntry, setHeraldry } from './halls.js';   // GUILD1d: the guild hall and heraldry
import { readGuildBoard, pinGuildNote, takeDownGuildNote } from './guildBoard.js';   // GUILD1e: a guild's own board
import { listSeats, witnessSeat, strikeSeat, seatsOpenFor } from './townSeats.js';   // SEAT1a: the seats' witnessed registry
import { pledgeSeat, claimWatch, creditGate, creditRenown, readStandings, payTribute, claimOrcCamp, readRecords } from './seatInfluence.js';   // SEAT1b: influence   // SEASON1 part two: an Orc Raid's camp
import { settleDue, seatsWithHolders, relinquishSeat, seatBadgeOf, seatTitlesOf } from './seatTurning.js';   // SEAT1c: the Turning, the Charters, their titles and glyphs
import { setTithe, proclaimEdict, claimBounty } from './seatHolding.js';   // SEAT1d: the holder's levers, a Bounty's camp
import { setWindow, signBattle, unsignBattle, hireSellsword, withdrawHire, siegesLive } from './seatBattles.js';   // SEAT2a: the battles' week
import { siegePass, claimSiege, voidSiege } from './seatSiege.js';   // SEAT2a part three: the pass, the result, Honours   // VOID: a moderator's void
import { royalPass, claimRoyal, keptTitleOf, KEPT_TITLES } from './seatRoyal.js';   // CROWN1 part two: the Royal Tourney's pass, its bouts, its champion's title (SEASON1: every title kept)
import { ribbonOf } from './seatRibbons.js';   // SEASON1 part two: a Season's banner ribbon, on the token
import { seatWeekOf, seasonOf, seasonZeroOf } from '../../src/net/townSeatLaw.js';   // SEASON1: the Season counted
import { offerFealty, acceptFealty, breakFealty, offerPact, breakPact, redOf } from './seatPolitics.js';   // CROWN2: fealty and Pacts, the red lines
import { fundFort, readForts } from './seatForts.js';   // SEAT2b: a seat's fortifications

/** SEAT1c: the account's row with the Charter titles it may wear laid on it (`seatTitles`, titles.js titlesHeld), while the
 *  seats are open to it - for the wardrobe's read and its write. */
const withSeatTitles = async (ctx, player, env) => (seatsOpenFor(player, env) ? { ...player, seatTitles: await seatTitlesOf(ctx.db, player.id) } : player);
import { decorOf, placeDecor, moveDecor, removeDecor, hideDecorBase, yardsOf } from './decor.js';   // DECOR1: an online home's decor; BASE-HIDE: what its owner took out
import { gateStrikeStatement, gateStrikeAnswer, raidStrikeStatement, combatStrikeAnswer, raidStrikeRid, deedStatements, deedAnswer, deedEvent, marksOf, marksCardOf, exchangeMarks, depositGuildMarks, withdrawGuildMarks, marksReport } from './marks.js';   // MARKS1: the server's currency; SILVER-WAYS: a raid's silver and a guild's deeds
import { readBoard, pinNote, takeDownNote, reportNote, moderateNote, postNotice, removeNotice } from './board.js';   // NOTICE1: the Notice Board
import { profState, profPixels, harvestNode, chooseSpec, withdrawStores, depositStores, smeltAtForge, craftAtAnvil, buyStock, listWrits, deliverWrit } from './professions.js';   // BAG1: a deposit   // PROF1: the professions; PROF2: the forge; PROF3: the anvil and the smith's stock
import { brewAtStation, disenchantPiece } from './alchemy.js';   // PROF12: Alchemy's brew, Enchanting's disenchant
import {
  writBoard, postGuildWrit, supplyGuildWrit, withdrawGuildWrit, setWritBudget, postCommission, fulfilCommission, cancelCommission, declineCommission,
  guildStores, depositGuildStores, withdrawGuildStores,
} from './writs.js';   // PROF6: guild writs, commissions and the guild Stores
import { contractBoard, postContract, withdrawContract, contractPayStatements, contractPaysOf } from './contracts.js';   // SILVER-WAYS: guild contracts
import { motherlodesRead, strikeMotherlode, isMotherlodeNode } from './motherlodes.js';   // PROF2b: the Motherlodes
import { marketRead, marketList, marketBuy, marketCancel, marketOrder, marketFill, marketUnorder, marketCollect, marketReport, marketRemove, marketAuction, marketBid, marketGoldCollect, marketVendor, marketVendors, marketMyVendors } from './market.js';   // PROF5: the market; PROF5b: its auctions; GOLD-MARKET: gold held collected
import {
  listRealm, createRealm, customsRealm, joinRealm, checkpointRealm, getRealmBlob, leaveRealm, deleteRealm, undoRealm,
  realmCharacterHeld, realmLevelOf, grantCustomsPass, REALM_CHARACTERS_MAX, REALM_MAX_BYTES, objectBytesOf,
} from './realm.js';   // REALM P1: the realm's characters; ARENA4b: the level on a realm character's tile, the token's `cl`
import { isGzip, gzipSizeOf, gunzipText, REALM_TEXT_MAX_BYTES } from '../../src/net/realmSaveCodec.js';   // REALM-GZIP: a save rides packed
import { tradeRealm, REALM_TRADE_BODY_MAX } from './realmTrade.js';   // REALM P2.1: a trade, settled here
import { measured } from './metrics.js';   // SCALE1: every request counted (Workers Analytics Engine)
import {
  patreonLinkOn, openPatreon, sealPatreon, patreonExchange, patreonIdentity, linkPatreon, unlinkPatreon, patreonWebhook,
  patreonCardOf, pledgeTitles, patreonHtml, patreonPage, patreonConfirmPage, patreonLinkedPage,
  PATREON_PAGES, PATREON_TICKET_S, PATREON_HOOK_MAX_BYTES, PATREON_CALLBACK_PATH,
} from './patreon.js';   // PATREON-LINK: a patron's own Patreon, linked

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
/** REALM P1: each realm refusal's status - a bad shape 400 (the default), a character that is not the caller's 404, a
 *  lease another tab holds or a sequence that is not the next 409 (the tab that lost it goes offline), the account's
 *  bound 409, customs refused 403/409, no storage 503. */
/** HOME-RENT: a room's refusals - a bad shape 400 (the default). */
const RENT_STATUS = Object.freeze({
  'rent-taken': 409, 'rent-held': 409, 'rent-rooms': 409, 'rent-none': 409, 'rent-own': 403, 'realm-only': 403,
  'rent-rate': 429, 'no-rent-room': 404, 'no-home': 404,
});
const REALM_STATUS = Object.freeze({
  'no-realm-character': 404, 'no-data': 404, lease: 409, seq: 409, 'too-many-characters': 409,
  'customs-never-online': 403, 'customs-other-account': 403, 'customs-already': 409, 'no-storage': 503,   // CUSTOMS-ELSEWHERE: the other account's
  'trade-spent': 409,   // REALM P2.1: a trade's sid another pair settled
  'guild-master-leaves': 409,   // AUDIT REALM L1-F7: a guildmaster deleted hands the guild over first
  'guild-treasury': 409,   // AUDIT REALM2 S8: and a lone one empties the treasury first
  'guild-hall': 409,   // AUDIT GUILD1d S1: and sells its guild's hall first
  'guild-vault': 409,   // AUDIT GUILD2 G2: and empties its guild's vault first
  'guild-seat': 409, 'guild-battle': 409,   // SEAT1c: and relinquishes its Charters, and fights the battle it is named in
  'realm-market-open': 409,   // PROF-DELETE: and one with market business open settles it first
  'home-tenants': 409, 'home-rent-due': 409,   // HOME-RENT: and one renting rooms out waits for its tenants and collects its rent
  'home-vendor-stocked': 409,   // HOME-VENDOR: and one whose trader still sells
  'realm-birth': 403, 'customs-allowance': 403,   // AUDIT REALM2 S1: a first save the realm's law refuses
});
/** CUSTOMS-PASS: a pass's refusals - a bad shape 400 (the default), a caller who is no developer 403, no such account
 *  404, a guest's name two accounts wear 409. */
const PASS_STATUS = Object.freeze({ 'not-developer': 403, 'no-player': 404, ambiguous: 409 });
/** GUILD1: each guild refusal's status - a bad shape 400 (the default), the wrong rank or too little Renown 403, a
 *  thing that is not there 404, a conflict with what is 409, the hour's writes spent 429. */
const GUILD_STATUS = Object.freeze({
  'guilds-need-account': 403, 'guild-rank': 403, 'guild-renown': 403,
  'no-guild': 404, 'no-invite': 404, 'no-member': 404, 'no-player': 404,
  'guild-already': 409, 'guild-name-taken': 409, 'guild-tag-taken': 409, 'guild-full': 409, 'guild-master-leaves': 409,
  'guild-treasury': 409, 'guild-treasury-full': 409, 'guild-treasury-short': 409, 'guild-treasury-old': 409, 'marks-full': 409,   // AUDIT REALM L1-F3: gold no record paid in
  'guild-stores': 409, 'guild-writs': 409,   // PROF6: a guild keeping its Stores or a writ does not go (Professions-Arc 18)
  'guild-writ-escrow': 409,   // AUDIT 31 A15: a closed writ's escrow waiting on a full treasury
  'guild-contracts': 409,   // AUDIT SILVER-WAYS B3: a guild with a contract standing does not go (its siblings' conflict, never a bad request)
  'guild-rate': 429,
  // GUILD1d (Seats-Arc 8): the hall - a building somebody owns, the guild's one hall already held, none held, one moved
  // under its sale, a guild kept from going by it; and the heraldry - the same again, changed meanwhile, the Drakes short
  'home-taken': 409, 'guild-hall-have': 409, 'guild-hall-moved': 409, 'guild-hall': 409, 'guild-hall-none': 404, 'home-rate': 429,
  'home-arena': 409,   // ARENA4b: a hall bought in the arena's cell - the arena stands there (halls.js buyHall)
  // AUDIT PRE-MERGE 1003 WD1: a hall in another layout of its town (answered with the town's, below), and one from a build
  // before the town mods - a home's claim's own words and statuses
  'home-layout': 409, 'home-update': 426,
  'heraldry-same': 409, 'heraldry-moved': 409, 'heraldry-drakes': 409, 'marks-closed': 403,
  'heraldry-siege': 409,   // AUDIT-SEATS S10 (Seats-Arc 8.1): a change in a week the guild fights for a seat
  // GUILD2a: a new name - the same as the old, a word the filter refuses, too soon after the last, a siege week, the
  // realm's gold short, moved under it; GUILD2b: the vault - the standing short, the day's limit, full, empty, moved,
  // a piece the record does not hold or may not leave, a guild kept from going by its vault
  'guild-rename-same': 409, 'guild-name-word': 400, 'guild-rename-soon': 409, 'guild-rename-siege': 409, 'guild-rename-gold': 409, 'guild-rename-moved': 409,
  'guild-vault-rank': 403, 'guild-vault-limit': 409, 'guild-vault-full': 409, 'guild-vault-empty': 404, 'guild-vault-moved': 409, 'vault-goods': 409, 'guild-vault': 409,
  'realm-only': 400, 'bad-vault-item': 400, 'bad-vault-count': 400, 'bad-vault-slot': 400, 'bad-vault-grant': 400,
  'guild-seat': 409, 'guild-battle': 409,   // SEAT1c: a guild holding a Charter, or named in a battle still to come, does not go
  // GUILD1e: the guild's board - the Notice Board's switch, a mute, no such note, the member's notes full, the hour spent
  'board-closed': 403, muted: 403, 'no-note': 404, 'notes-full': 409, 'board-rate': 429, 'board-ops-rate': 429,
  // REALM P2.2: a realm character's record moves with the act - where it stands, and whether it can pay
  'realm-needed': 400, 'realm-gold': 409, lease: 409, seq: 409, 'no-realm-character': 404, 'no-data': 404, 'no-storage': 503,
});
/** MARKS1: each Marks refusal's status - not this account's (a guest, the switch, a rank, a developer's) 403, no
 *  guild 404, short or capped 409, the hour's acts spent 429, a bad shape 400 (the default). */
const MARKS_STATUS = Object.freeze({
  'marks-need-account': 403, 'marks-closed': 403, 'not-developer': 403, 'guild-rank': 403, 'guilds-need-account': 403,
  'no-guild': 404,
  'marks-short': 409, 'marks-bank-cap': 409, 'marks-full': 409, 'guild-marks-short': 409, 'guild-marks-full': 409,
  'marks-rate': 429,
});
/** NOTICE1: each board refusal's status - not this account's (a guest, the switch, a mute, a moderator's or a
 *  developer's act) 403, no such note 404, the author's notes full 409, the hour's acts spent 429, a bad shape 400. */
const BOARD_STATUS = Object.freeze({
  'board-need-account': 403, 'board-closed': 403, 'muted': 403, 'not-moderator': 403, 'not-developer': 403, 'own-note': 403,
  'guild-rank': 403, 'guilds-need-account': 403,
  'no-note': 404, 'no-notice': 404, 'note-no-guild': 404,
  'notes-full': 409,
  'board-rate': 429, 'board-ops-rate': 429,
});
/** SEAT1a (SEAT1b): each seat refusal's status - not this account's (a guest, the switch, a developer's act) 403, a seat struck
 *  409, the hour's reports spent 429, a bad shape 400 (the default). */
const SEAT_STATUS = Object.freeze({
  'seats-need-account': 403, 'seats-closed': 403, 'not-developer': 403, 'seat-struck': 409, 'seats-rate': 429,
  'not-moderator': 403,   // VOID: `/siege void` asked by anyone but a moderator or a developer
  // SEAT1b: a rank, a guild or the Marks not this account's 403; no confirmed seat or guild 404; the week's phase, the
  // guild's reach, a pledge not there, Tribute's room, the treasury 409; no relay key 503
  'guild-rank': 403, 'guilds-need-account': 403, 'marks-closed': 403, 'no-guild': 404, 'seat-unconfirmed': 404,
  'seat-reckoning': 409, 'seat-pledges-full': 409, 'seat-no-pledge': 409, 'seat-tribute-cap': 409, 'guild-marks-short': 409,
  'no-gate-key': 503,
  'seat-not-held': 409, 'seat-held-here': 409,   // SEAT1c: a Charter not the guild's to give up; a region its Charter pledges
  // SEAT1d: the Tithe set this week already, an Edict two weeks running, none to take back, the balance's cap 409
  'tithe-this-week': 409, 'edict-twice': 409, 'seat-no-edict': 409, 'marks-full': 409, 'edict-tier': 409,
  // SEAT2a: no battle, no contract, no such account 404; a side not this guild's, a member hired 403; the rosters' close, a
  // side or its Sellswords full, the account's war, a Sellsword's cooling, a second signing or hire 409
  'battle-none': 404, 'hire-none': 404, 'no-such-account': 404, 'battle-not-side': 403, 'sellsword-member': 403,
  'sign-closed': 409, 'sign-new-member': 409, 'sign-unbound': 409, 'sign-bound-elsewhere': 409, 'side-full': 409,
  'sellswords-full': 409, 'sellsword-cooling': 409, 'sign-twice': 409, 'hire-twice': 409,
  // SEAT2a part three: the field's door, its window, an unsettled field, a second Honours 409; a receipt another account's
  // 403; a bad field, a receipt not the relay's, no character for the XP 400 (the default)
  'pass-early': 409, 'pass-late': 409, 'field-unsettled': 409, 'honours-twice': 409, 'not-yours': 403,
  // AUDIT-SEATS: a battle its Turning voided (S3), a window moved in the Reckoning (S10) 409
  'battle-void': 409, 'window-reckoning': 409,
  'battle-settled': 409,   // AUDIT 529 V5: a `/siege void` after the battle's week was settled
  // CROWN1 part two: no Royal Tourney here 404; its week's champion named, its ring unsettled 409
  'royal-none': 404, 'royal-over': 409, 'ring-unsettled': 409,
  // CROWN2: no such guild, offer or Pact 404; a pair that does not fit, one sworn or signed already, a pledge between them 409
  'guild-unknown': 404, 'fealty-none': 404, 'pact-none': 404, 'fealty-unfit': 409, 'fealty-sworn': 409, 'fealty-pledged': 409,
  'pact-signed': 409, 'pact-self': 409, 'pact-pledged': 409, 'fealty-pledge': 409, 'pact-pledge': 409,
  // SEAT2b: a work the seat may not raise, one building already, one at its last tier, a treasury short 409
  'fort-not-here': 409, 'fort-building': 409, 'fort-max': 409, 'seat-treasury': 409,
});
/** PROF1: each professions refusal's status - not this account's (a guest, the switch, the Marks' switch, the rank) 403,
 *  no such writ 404, a conflict with what stands (the day, the hour, the cap, the Stores, a node or writ taken) 409, the
 *  hour's acts spent 429, a bad shape 400 (the default). */
const PROF_STATUS = Object.freeze({
  'prof-need-account': 403, 'prof-closed': 403, 'marks-closed': 403, 'prof-rank': 403,
  'no-writ': 404, 'bad-recipe': 404,
  'prof-pixel': 409, 'prof-day': 409, 'prof-late': 409, 'prof-cap': 409, 'stores-full': 409, 'stores-short': 409,   // ANY-HOUR: no `prof-night` - no node keeps hours
  'prof-account-cap': 409, 'prof-deep-cap': 409, 'prof-spec-stale': 409, 'prof-spec-taken': 409,   // AUDIT 29
  'prof-no-pack-form': 409,   // PROF3: the smith's stock stays in the Stores until its professions' templates
  'carried-full': 409, 'carried-short': 409,   // BAG1: a carried count at its bound, or holding fewer than a deposit asks
  'prof-later': 409,   // PROF4: a recipe whose slice is to come - the Ram Kit (PROF0 25)
  'prof-hunt-cap': 409, 'prof-hunt-high': 409, 'prof-foe': 400, 'prof-dye': 400,   // PROF7: Hunting's day (30 hides, 3 of tiers 5-6), a body no knife skins, a dye asked of what takes none
  'prof-fish-cap': 409,   // PROF8: Fishing's day (40 hauls an account)
  'prof-sculptor': 403,   // PROF11: the stone decor is a Sculptor's - a skill's door, as the rank's
  'prof-lapidary': 403,   // PROF10: a Siege-cracked Gem is set as a gem by a Lapidary alone - a skill's door, as the Sculptor's
  // PROF12: a transmutation is a Transmuter's (a skill's door); a cauldron DFU's law answers with no such potion, a bad piece's id;
  // no such piece, another's; one listed, on the road or set down; one that makes no Essence
  'prof-transmuter': 403, 'bad-brew': 400, 'bad-piece': 400, 'prof-no-piece': 404, 'prof-not-yours': 403, 'prof-piece-busy': 409, 'prof-no-essence': 409,
  // AUDIT PROF-541 B2: a realm character's disenchant moves its record - a piece the record does not hold, and the record's own words
  'prof-piece-gone': 409, 'realm-needed': 400, lease: 409, seq: 409, 'no-realm-character': 404, 'no-data': 404, 'no-storage': 503,
  'node-taken': 409, 'writ-taken': 409, 'writ-expired': 409, 'writ-cap': 409, 'marks-full': 409, 'marks-short': 409, 'prof-respec-pending': 409,
  'prof-rate': 429,
  // PROF6: guild writs, commissions and the guild Stores
  'writs-closed': 403, 'guild-rank': 403, 'guilds-need-account': 403, 'commission-not-yours': 403, 'market-not-yours': 403,
  'no-guild': 404, 'commission-crafter': 404,
  'writ-gone': 409, 'writ-elsewhere': 409, 'writ-short': 409, 'writ-moved': 409, 'writ-budget': 409, 'guild-marks-short': 409,
  'guild-writs-max': 409, 'guild-stores-full': 409, 'guild-stores-short': 409, 'commissions-max': 409, 'commissions-crafter-max': 409,
  'commission-self': 409, 'commission-piece': 409, 'commission-not-made': 409, 'commission-worn': 409, 'market-listed': 409,
  'market-standing': 409,
  'writ-own-guild': 403, 'guild-stores-mine': 403, 'market-uncollected': 409, 'commission-unyielded': 409, 'market-no-record': 409,   // AUDIT 31
  'commission-elsewhere': 409, 'market-unyielded': 409,
  'writ-rate': 429,
  // SILVER-WAYS: guild contracts
  'marks-need-account': 403, 'no-contract': 404, 'contract-gone': 409, 'guild-contracts-max': 409,
  // PROF2b: a Motherlode's strike
  'motherlode-closed': 409, 'motherlode-watch': 409, 'motherlode-found': 409, 'motherlode-full': 409, 'no-gate-key': 503,
});
/** PROF5: each market refusal's status - not this account's (a guest, the switches, a moderator's act) 403, no such
 *  listing, order or delivery 404, a conflict with what stands (the Marks, the Stores, the units, the road, the price
 *  moved, one's own goods) 409, the hour's acts spent 429, a bad shape 400 (the default). */
const MARKET_STATUS = Object.freeze({
  'prof-need-account': 403, 'market-closed': 403, 'not-moderator': 403,
  'market-gone': 404,
  'marks-short': 409, 'marks-full': 409, 'stores-full': 409, 'stores-short': 409, 'market-own': 409, 'market-short': 409,
  'market-no-road': 409, 'market-price-moved': 409, 'market-seller-full': 409, 'market-listings-max': 409, 'market-orders-max': 409,
  'market-not-yours': 409, 'market-listed': 409, 'market-order-full': 409, 'market-elsewhere': 409, 'market-other-character': 409,
  'market-on-road': 409, 'market-courier-dear': 409,   // GLOBAL-MARKET: a fill from afar whose courier would take all its pay
  'market-taxed-out': 409,   // MARKET-AUDIT S2: a fill its tax would leave paying nothing
  'market-not-listable': 409, 'market-uncollected': 409, 'market-standing': 409, 'market-unyielded': 409,   // AUDIT 30
  'market-no-record': 409,   // AUDIT 31 H1
  'auction-not-masterwork': 409, 'auction-low': 409, 'auction-leading': 409, 'auction-bid-standing': 409,   // PROF5b
  'auction-moved': 409,   // AUDIT 31 S4
  // GOLD-MARKET: gold is a realm record's; what gold bought stays gold's (the wall); a record's own refusals
  'market-gold-realm': 409, 'market-currency': 409, 'market-gold-goods': 409, 'market-drakes-goods': 409, 'market-gold-none': 409, 'market-gold-full': 409,
  'stores-gold': 409, 'realm-gold': 409, lease: 409, 'realm-needed': 400, 'no-realm-character': 404, 'no-data': 404, 'no-storage': 503,
  // MARKET-ANY: a piece from the pack - the record's own piece, a crafted piece's own way
  'market-not-good': 409, 'market-good-gone': 409, 'market-piece-route': 409, 'market-goods-gold': 409,
  'market-rate': 429,
  // HOME-VENDOR: a trader's refusals
  'bad-vendor': 400, 'vendor-only': 409, 'vendor-not-here': 409, 'vendor-gone': 404, 'vendor-not-yours': 403, 'vendor-full': 409,   // MARKET-AUDIT
});
/** GUILD1c: A GUILD ACT'S ANSWER WITH ITS ORDERS SIGNED in place of what they say (guilds.js). `badge` - the actor's
 *  character's guild now, `{}` for none - becomes `order`, which the actor's own client carries to the rooms it is in;
 *  `out` - a member removed, or the guild disbanded - becomes `outOrder`, which the client carries to the hub, whose
 *  word reaches that member wherever they stand. A service with no key still acts, answering null for either: the rooms
 *  read the change off the next token. */
async function guildOrdersOf(r, s, env, subtle, nowS) {
  const { badge, out, ...answer } = r;
  if (badge === undefined && out === undefined) return answer;
  const key = await signingKey(env, subtle);
  if (badge !== undefined) answer.order = key ? await mintGuildOrder({ s, ...badge }, key, { subtle, nowS }) : null;
  if (out !== undefined) answer.outOrder = key ? await mintGuildOutOrder(out, key, { subtle, nowS }) : null;
  return answer;
}

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

async function readBody(request, max = MAX_BODY_BYTES) {
  const bytes = await readCapped(request, max);
  if (!bytes) return null;
  const text = new TextDecoder().decode(bytes);
  if (!text) return {};
  try { const v = JSON.parse(text); return v && typeof v === 'object' && !Array.isArray(v) ? v : null; } catch { return null; }
}

// SCALE1: THE SERVICE, and below it the handler workerd calls - which serves it and counts it (metrics.js). The
// service is a plain object, not an export: this module still exports `default` and nothing else.
const service = {
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
          'access-control-allow-headers': 'content-type, authorization, x-realm-lease, x-realm-seq, x-realm-summary',   // REALM P1: a checkpoint's lease, sequence and tile
          'access-control-max-age': '86400',
        },
      });
    }

    // SEAT2a part three: THE DEPLOY BLACKOUT'S QUESTION (Seats-Arc 17) - public, as the health is: whether any battle is
    // live or starts within thirty minutes, and the latest end among them. It names no guild.
    if (path === '/v1/seats/sieges/live') {
      if (request.method !== 'GET') return no('method', 405, origin);
      if (!env.DB) return no('no-database', 503, origin);
      return json(await siegesLive(env.DB, Math.floor(Date.now() / 1000)), 200, origin);
    }
    if (path === '/v1/health') return json({ ok: true, v: env.ACCOUNT_VERSION || ACCOUNT_VERSION, ...(maintaining(env) ? { maintenance: true } : {}) }, 200, origin);   // RESTORE: and whether it is held for maintenance

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

    // RESTORE (2026-09-29, Mac: "I want people to get their stuff back"): HELD FOR MAINTENANCE. The history restore
    // (.github/workflows/realm-restore.yml) rewinds the database for a minute to read what was lost, and puts it back;
    // anything written in between would vanish with the rewind. So the job deploys this Worker with MAINTENANCE = "1"
    // first, and every call but the two above is refused for that minute - 503, which a playing tab's checkpoint waits
    // out and sends again (systems/realmSaves.js), never a write that is silently lost. The job's own last step deploys
    // it again without the switch; any deploy does.
    if (maintaining(env)) return no('maintenance', 503, origin);

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
    const realmSlot = realmPathOf(path);   // REALM P1: a realm character's save, matched as a save slot is
    if (!ROUTES.has(path) && !slot && !realmSlot) return no('not-found', 404, origin);

    const db = env.DB;
    if (!db) return no('no-database', 503, origin);
    const ctx = { db, subtle, rand, nowS };

    try {
      // PATREON-LINK: THE THREE DOORS A BROWSER AND PATREON KNOCK AT. No session: each is proven by what it carries
      // (patreon.js says what, and why the link asks before it writes). Answered before the JSON ladder below, because
      // none of them is JSON going in - a callback is a GET a person reads, the confirm a form, and the webhook a body
      // whose signature covers its exact bytes.
      if (PATREON_OPEN_ROUTES.has(path)) {
        if (path === '/v1/patreon/webhook') {
          if (request.method !== 'POST') return no('method', 405, origin);
          const bytes = await readCapped(request, PATREON_HOOK_MAX_BYTES);
          if (!bytes) return no('too-large', 413, origin);
          const r = await patreonWebhook(ctx, env, new Uint8Array(bytes), request.headers.get('x-patreon-signature'), request.headers.get('x-patreon-event'));
          return 'error' in r ? no(r.error, r.error === 'patreon-closed' ? 503 : r.error === 'signature' ? 401 : 400, origin) : json(r, 200, origin);
        }
        const page = (/** @type {any} */ p, /** @type {number} */ status) => patreonHtml(patreonPage(p), status);
        if (!patreonLinkOn(env)) return page(PATREON_PAGES.off, 503);
        // The open routes' own bucket (one address, sixty a minute): a callback spends a code at Patreon and a confirm
        // writes, and neither is a thing one address gets to do without limit.
        if (await overRate(ctx, `ip:${request.headers.get('cf-connecting-ip') || 'unknown'}`, 60)) return page(PATREON_PAGES.rate, 429);
        const outbound = (/** @type {string} */ u, /** @type {any} */ init) => globalThis.fetch(u, init);
        if (path === PATREON_CALLBACK_PATH) {
          if (request.method !== 'GET') return no('method', 405, origin);
          const state = await openPatreon('state', url.searchParams.get('state'), env, { subtle, nowS });
          if (!state) return page(PATREON_PAGES.expired, 400);
          const code = url.searchParams.get('code');
          if (!code || url.searchParams.has('error')) return page(PATREON_PAGES.declined, 200);   // the player said no on Patreon
          const player = await db.prepare('SELECT id, handle FROM players WHERE id = ?1').bind(state.p).first();
          if (!player?.handle) return page(PATREON_PAGES.account, 403);
          const token = await patreonExchange(outbound, env, code, `${url.origin}${PATREON_CALLBACK_PATH}`);
          if ('error' in token) return page(PATREON_PAGES.down, 502);
          const who = await patreonIdentity(outbound, token.token);
          if ('error' in who) return page(PATREON_PAGES.down, 502);
          // NOTHING IS WRITTEN HERE. The page names the game account the state did, and the yes carries a sealed ticket -
          // so a link somebody else started is read by the patron before it can be finished.
          const from = await db.prepare('SELECT handle FROM players WHERE patreon_user = ?1 AND id <> ?2').bind(who.user, player.id).first();
          const ticket = await sealPatreon('ticket', { p: player.id, u: who.user, k: token.token, x: nowS + PATREON_TICKET_S }, env, { subtle, rand });
          return patreonHtml(patreonConfirmPage({ handle: player.handle, name: who.name, titles: pledgeTitles(who.tiers, who.status, env), ticket, from: from?.handle ?? null }));
        }
        // /v1/patreon/confirm - the page's own form
        if (request.method !== 'POST') return no('method', 405, origin);
        const bytes = await readCapped(request, MAX_BODY_BYTES);
        const ticket = await openPatreon('ticket', new URLSearchParams(bytes ? new TextDecoder().decode(bytes) : '').get('ticket'), env, { subtle, nowS });
        if (!ticket || typeof ticket.k !== 'string') return page(PATREON_PAGES.expired, 400);
        // THE YES WRITES WHAT PATREON SAYS NOW - asked again with the patron's own token, not what the page showed: a
        // pledge cancelled between the page and the press holds nothing, and a yes pressed twice is Patreon asked twice.
        const who = await patreonIdentity(outbound, ticket.k);
        if ('error' in who) return page(PATREON_PAGES.down, 502);
        if (who.user !== ticket.u) return page(PATREON_PAGES.expired, 400);   // the token answers for another Patreon account now
        const r = await linkPatreon(ctx, { p: ticket.p, u: who.user, t: who.tiers.join(','), s: who.status });
        if ('error' in r) return page(PATREON_PAGES.account, 403);
        const row = await db.prepare('SELECT handle FROM players WHERE id = ?1').bind(ticket.p).first();
        return patreonHtml(patreonLinkedPage({ handle: row?.handle ?? '', titles: pledgeTitles(who.tiers, who.status, env) }));
      }

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
          // TERMS1: NO ROW WITHOUT THE DOCUMENTS TICKED. A guest row IS an
          // account (0001's own words), and the Create account form opens
          // one only after its player ticked the Terms of Service and the
          // Privacy Policy - so the service asks the same, before it writes.
          const refused = legalRefusal(body);
          if (refused) return no(refused.error, 400, origin);
          const made = await createGuest(ctx, { deviceLabel: body.label ?? null, legal: { terms: body.terms, privacy: body.privacy } });
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
      // REALM P2.1: a trade's half carries two offers of up to sixteen records each - the one JSON route past 4 KiB
      const body = request.method === 'POST' ? await readBody(request, path === '/v1/realm/trade' ? REALM_TRADE_BODY_MAX : MAX_BODY_BYTES) : {};
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
      // ACCT-RATE-MEM: counted in the isolate's memory - a D1 upsert here made every read a write (accounts.js).
      if (overAccountRate(who.player.id, nowS, ACCOUNT_MAX, ACCOUNT_WINDOW_S)) {
        return no('rate', 429, origin);
      }

      // ARENA4: THE ARENA'S HONOURS ON THE ROW, where a badge is minted or a wardrobe read - the Grand Champion's row, the
      // season's #1 (server-account/src/arena.js arenaHonoursOf) - so titles.js derives `grandchampion`, `arenachampion`
      // and the laurel from the arena's rows as it derives the founder from a date. Only on the doors that read a badge.
      if (ARENA_HONOUR_PATHS.has(path)) who.player = await withArenaHonours(ctx, who.player, nowS);

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
        // SEAT1c (Seats-Arc 7.4): AND A CHARTER'S - its glyphs on every member of the named character's guild, and a seat
        // title worn only by the guildmaster character this token is minted for, with its claim (`ts`) beside it
        const seats = seatsOpenFor(who.player, env);
        const worn = seats ? { ...who.player, seatTitles: await seatTitlesOf(ctx.db, who.player.id) } : who.player;
        const zero = seasonZeroOf(env.SEASON_ZERO_WEEK);   // SEASON1: the Season on a title's claim
        const seatBadge = seats && renownCharacterOk(body.character) ? await seatBadgeOf(ctx.db, who.player.id, body.character, seasonOf(seatWeekOf(nowS * 1000), zero)?.n ?? 0) : null;
        const wornT = titleWorn(worn, env);
        // CROWN1 part two: the champion's is the account's own, kept for good - no guildmaster's; SEASON1: and so are a
        // Season's crowned and keeper (seatRoyal.js keptTitleOf)
        const kept = seats && KEPT_TITLES.includes(wornT) ? await keptTitleOf(ctx.db, who.player.id, wornT, zero) : null;
        const seatT = KEPT_TITLES.includes(wornT) ? (kept ? { t: wornT, ts: kept.ts } : {})
          : SEAT_TITLES.includes(wornT) ? (seatBadge?.title === wornT ? { t: wornT, ts: seatBadge.ts } : {}) : (wornT ? { t: wornT } : {});
        // SEASON1 part two (Seats-Arc 9.1): AND A SEASON'S BANNER RIBBON - the named character's, where its guild kept a
        // seat through the Season before and it was a member at that Season's last Turning (seatRibbons.js ribbonOf)
        const rb = seats && renownCharacterOk(body.character) ? await ribbonOf(ctx.db, who.player.id, body.character, seasonOf(seatWeekOf(nowS * 1000), zero)) : null;
        const wardrobe = {
          ...seatT,
          g: [...glyphsOf(who.player, env, nowS), ...(seatBadge?.glyphs ?? [])],
          au: auraWorn(who.player, env),   // WB9g: the aura worn, the title's law - absent for none; AEGIS: a list's read off the config
          ...(rb ? { rb } : {}),
        };
        // GLYPH-WEAR: the glyphs taken off ride BESIDE `g`, never out of it - `g` is what is true and what the relay's
        // rights read (/red, /dm); `gx` is paint, which every face that draws a badge leaves out. Absent for none.
        const gx = glyphsHidden(who.player, env, nowS);
        if (gx.length) wardrobe.gx = gx;
        // MOD1: A MUTE RIDES THE TOKEN, so a reconnect cannot shed one -
        // every room reads it off the signature at the hello. Only while
        // it runs: a mute that has ended is simply absent.
        const mu = isMuted(who.player, nowS) ? mutedUntil(who.player) : undefined;
        // RENOWN1: AND THE LEVEL, when the client names the character it is
        // bringing online - that character's, derived from its track now
        // (1 for a character that has earned nothing yet). The client's
        // word is only WHICH of its own characters; the number is this
        // service's. A mint naming none (an older build) carries none.
        // (RENOWN-CHAR: the named character's again - RENOWN-ACCOUNT read
        // the account's one track whichever was named.)
        // RENOWN4: and the track's TOTAL beside it in the answer (never in the token - a room needs the level, not the
        // XP): the page's own bar is drawn from it the moment the character comes online (ui/hudRenown.js).
        const track = renownCharacterOk(body.character) ? ((await renownTrackOf(ctx, who.player.id, body.character)) ?? { xp: 0, level: 1 }) : null;
        const lv = track ? track.level : undefined;
        // GUILD1c: AND THE GUILD, the named character's - its id, its tag and its member row off the roster as it
        // stands now - so a room reads the tag beside the name off the signature, and routes the guild's chat to its
        // own members alone. The client never says which guild; a mint naming no character carries none.
        // AUDIT MERGE-PLUS A6: AND ONLY A MINT THAT ASKS (`guild: true`). A build from before GUILD1c names its character
        // too (RENOWN1), and a token wearing a guild is what the hub routes the guild's lines to - that build knows no
        // guild channel and filed them on its World tab, where a reply goes to everyone. It wears no guild instead.
        const guild = renownCharacterOk(body.character) && body.guild === true ? await guildBadgeOf(ctx, who.player.id, body.character) : null;
        // REALM-DOOR (2026-09-29, the field): AND WHETHER THAT CHARACTER IS THE REALM'S. A realm-era tab goes online only
        // as a realm character and names it here; a build from before the realm names its offline character, or none.
        // The relay refuses a 0 at its door, so online is the realm's at the servers too. Stamped on every mint, a 0
        // included: a token with no `rc` is a service from before this, which the relay still admits.
        const rc = (await realmCharacterHeld(ctx, who.player.id, body.character)) ? 1 : 0;
        // ARENA4b: AND THAT REALM CHARACTER'S LEVEL, `cl` - the level on its tile (realm.js realmLevelOf: its summary, the
        // client's checkpoint's word, 1..1000), which the relay reads (a bout's vitality) as it reads `lv`. Absent for any
        // other character, none named, or a level out of the claim's bounds - a token without it is a token as before.
        const cl = rc ? await realmLevelOf(ctx, who.player.id, body.character) : null;
        // ARENA4: AND THE ACCOUNT'S ARENA RATING this season, for a registered account - the hall queues by it (net/arenaLaw.js
        // pairQueue), off the signature, never a word of the client's. A guest's token carries none (a guest is not queued).
        const ar = who.player.handle ? (await arenaRatingOf(ctx, who.player.id, arenaSeasonOf(nowS))).rating : undefined;
        const token = await mintToken(
          { s: who.player.id, n: displayName(who.player), k: accountKind(who.player), ...wardrobe, mu, lv, ...(guild ?? {}), rc, ...(ar !== undefined ? { ar } : {}), ...(cl != null ? { cl } : {}) },
          key, { subtle, nowS },
        );
        return json({
          token,
          name: displayName(who.player),
          kind: accountKind(who.player),
          title: wardrobe.t ?? null,
          ...(wardrobe.ts ? { ts: wardrobe.ts } : {}),   // SEAT1c: a seat title's claim, the client's to word
          glyphs: wardrobe.g,
          ...(wardrobe.gx ? { glyphsOff: wardrobe.gx } : {}),   // GLYPH-WEAR: the ones my own name leaves out, absent for none
          mutedUntil: mu ?? 0,
          level: lv ?? null,
          xp: track ? track.xp : null,
          guild: guild ? guild.gt : null,   // GUILD1c: the tag my own name wears, beside the token as the level is
          aura: wardrobe.au ?? null,   // WB9g: the aura at my own feet, beside the token as the title is
          ribbon: wardrobe.rb ?? null,   // SEASON1 part two: the ribbon under my own name, beside the token as the aura is
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
          // RENOWN1: and Renown's tracks, the most recently earned first (the card's level and its row) - RENOWN-CHAR: a
          // list of the characters' tracks again (RENOWN-ACCOUNT sent the account's one, `{ xp, level }`)
          // MARKS1: and the Marks balance, where Marks are this account's (null where not - a guest, the switch)
          account: { ...accountView(who.player, nowS), duels: await duelRecordOf(ctx, who.player.id), gates: await gateRecordOf(ctx, who.player.id), raids: await raidRecordOf(ctx, who.player.id), serpents: await serpentRecordOf(ctx, who.player.id), renown: await renownTracksOf(ctx, who.player.id), marks: await marksCardOf(ctx, who.player, env) },
          wardrobe: { ...accountWardrobe(await withSeatTitles(ctx, who.player, env), env, nowS), purse: await insigniaPurse(ctx, who.player) },   // SEAT1c: and a Charter's titles   // WB9g: and what the account's closed gates could still pay the Broker's insignia
          devices: await devicesOf(ctx, who.player.id),
          // PATREON-LINK: the card's Patreon row - whether linking is on, whether this account is linked, the titles its
          // pledge holds, and the link to follow (a state sealed for this account, under the origin that served this)
          patreon: await patreonCardOf(who.player, env, { subtle, rand, nowS, origin: url.origin }),
        }, 200, origin);
      }

      if (path === '/v1/patreon/unlink' && request.method === 'POST') {
        // PATREON-LINK: the account's Patreon taken off it, and nothing about the pledge kept. The answer is the wardrobe
        // after it (an equip's shape - a title the pledge held is no longer held, nor worn) and the card's row.
        await unlinkPatreon(ctx, who.player.id);
        const after = { ...(await withSeatTitles(ctx, who.player, env)), patreon_user: null, patreon_tiers: null, patreon_status: null, patreon_at: null };   // AUDIT SEATS-3 E2: a Charter's titles still held
        return json({ ok: true, ...accountWardrobe(after, env, nowS), patreon: await patreonCardOf(after, env, { subtle, rand, nowS, origin: url.origin }) }, 200, origin);
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
        return json({ id: body.id, ...(await duelRecordOf(ctx, body.id)), gates: await gateRecordOf(ctx, body.id), raids: await raidRecordOf(ctx, body.id), serpents: await serpentRecordOf(ctx, body.id) }, 200, origin);   // RAID4: and the towns defended; SERPENT1: and the serpents slain
      }

      if (path === '/v1/gate/claim' && request.method === 'POST') {
        // WB5b: THE ACCOUNT THE RECEIPT NAMES CARRIES IT HERE. The
        // relay signed it at the kill (src/net/gateReceipt.js); the
        // session says who is asking, never the body, and accounts.js
        // `claimGate` holds the rest - the signature, the account, the
        // one row a (day, account). No public half here yet is the
        // service's own gap, not the player's: 503, and the client keeps
        // the receipt for the week it carries.
        // SILVER-WAYS: and the guild's deed - the claiming character's guild, where three of its accounts closed this gate
        const character = typeof body.character === 'string' ? body.character : null;
        const r = await claimGate(ctx, who.player, body.receipt, await gatePublicKey(env, subtle), {
          strike: (d) => gateStrikeStatement(ctx, who.player, env, d), region: body.region ?? null,
          deeds: (d) => deedStatements(ctx, who.player, env, { kind: 'gate', event: deedEvent('gate', d), character, guard: [d] }),
        });
        // AUDIT WB A5: a refused receipt says WHICH rung refused it - the client keeps one the service can mend (its key
        // not the relay's pair, a clock) and lets go of one it cannot
        if (r.error) return json({ error: r.error, ...(r.why ? { why: r.why } : {}) }, r.error === 'no-gate-key' ? 503 : r.error === 'not-yours' ? 403 : 400, origin);
        // MARKS1: THE FIRST FAUCET - a receipt that made its row strikes the gate's Marks, in the row's own batch
        // (marks.js gateStrikeStatement: 50 under SILVER-WAYS' day's combat cap with the raids', the gate's own day its
        // line's id); `marks` null where Marks are not this account's
        const answer = { ...r };
        delete answer.day; delete answer.struck; delete answer.deedStruck;   // the service's own: the line's day and whether the batch struck
        if (r.recorded && !r.rite && r.deedStruck !== undefined) answer.deed = await deedAnswer(db, who.player, deedEvent('gate', r.day), r.deedStruck);   // SILVER-WAYS: where a deed was this claim's to try
        // SEAT1b (Seats-Arc 4.2): a kill recorded now is influence for the account's war-guild where it pledged in the
        // region the claim named (`seat` the answer: counted, or why not - the kill stands either way). WB12d: the rite
        // alone is no kill, and is no influence
        if (r.recorded && !r.rite && body.region != null) answer.seat = await creditGate(ctx, who.player, env, { character: body.character ?? null, day: r.day, region: body.region });
        return json(r.recorded && !r.rite ? { ...answer, marks: await gateStrikeAnswer(ctx, who.player, env, !!r.struck, r.day) } : answer, 200, origin);   // AUDIT WB12d (A2): the rite alone strikes no Drakes, and says none
      }

      if (path === '/v1/raid/claim' && request.method === 'POST') {
        // RAID4: THE ACCOUNT A RAID'S RECEIPT NAMES CARRIES IT HERE, with the character that fought it. The relay signed
        // it at the cleanse (src/net/raidReceipt.js); the session says who is asking, never the body, and raids.js
        // `claimRaid` holds the rest - the signature, the account, one row a (raid, account), the day's bound, the
        // Renown (RENOWN-CHAR: the fighting character's again). A level that ROSE comes back with a signed order, as a
        // Renown report's does.
        // SILVER-WAYS: the town's silver (30, under the day's combat cap), the guild's deed and the guild contracts the
        // raid's region posts, each in the claim's own batch and by its own row (raids.js)
        const r = await claimRaid(ctx, who.player, { receipt: body.receipt, character: body.character, name: body.name ?? null, cid: body.cid ?? null }, await gatePublicKey(env, subtle), {   // AUDIT RAID R4: `cid` - the device's claim, which the town's thanks are keyed to
          strike: (key, nonce) => raidStrikeStatement(ctx, who.player, env, key, nonce),
          deeds: (key, nonce, character) => deedStatements(ctx, who.player, env, { kind: 'raid', event: deedEvent('raid', key), character, guard: [key, nonce] }),
          contracts: (key, nonce) => contractPayStatements(ctx, who.player, env, { key, nonce }),
        });
        if (r.error) return json({ error: r.error, ...(r.why ? { why: r.why } : {}) }, r.error === 'no-gate-key' ? 503 : r.error === 'not-yours' ? 403 : 400, origin);
        let order = null;
        if (r.renown?.rose) {
          const key = await signingKey(env, subtle);
          if (key) order = await mintRenownOrder({ s: who.player.id, lv: r.renown.level }, key, { subtle, nowS });
        }
        const answer = { ...r };
        delete answer.key; delete answer.struck; delete answer.deedStruck;   // SILVER-WAYS: the service's own
        if (r.recorded) {
          const marks = await combatStrikeAnswer(ctx, who.player, env, !!r.struck, raidStrikeRid(r.key));
          if (marks) answer.marks = marks;
          if (r.deedStruck !== undefined) answer.deed = await deedAnswer(db, who.player, deedEvent('raid', r.key), r.deedStruck);
          const paid = await contractPaysOf(db, who.player, r.key);
          if (paid.length) answer.contracts = paid;
        }
        return json({ ...answer, order }, 200, origin);
      }

      if (path === '/v1/serpent/claim' && request.method === 'POST') {
        // SERPENT1: A SERPENT'S RECEIPT, CARRIED HERE BY THE ACCOUNT IT NAMES, with the character that fought it. The relay
        // signed it at the kill (src/net/serpentReceipt.js); the session says who is asking, never the body, and serpents.js
        // `claimSerpent` holds the rest - the signature, the account, one row a (day, account), the Renown, the device's
        // hoard. A level that ROSE comes back with a signed order, as a raid's does.
        const r = await claimSerpent(ctx, who.player, { receipt: body.receipt, character: body.character, name: body.name ?? null, cid: body.cid ?? null }, await gatePublicKey(env, subtle));
        if (r.error) return json({ error: r.error, ...(r.why ? { why: r.why } : {}) }, r.error === 'no-gate-key' ? 503 : r.error === 'not-yours' ? 403 : 400, origin);
        const key = r.renown?.rose ? await signingKey(env, subtle) : null;   // a level that rose: its signed order, for the rooms
        const signed = key ? await mintRenownOrder({ s: who.player.id, lv: r.renown.level }, key, { subtle, nowS }) : null;
        return json({ ...r, order: signed }, 200, origin);
      }

      if (path === '/v1/arena/claim' && request.method === 'POST') {
        // ARENA4: A BOUT'S RECEIPT, CARRIED HERE BY AN ACCOUNT IT NAMES. The relay refereed the bout and signed its result
        // (src/net/arenaReceipt.js); arena.js `claimArena` holds the rest - the signature, the account, one row a bout, a
        // ladder win only as the account's next bout, both ratings for a bout between players. A refusal says its rung, as
        // the gate's does (AUDIT WB A5): the client keeps a receipt the service can mend and lets go of one it cannot.
        // ARENA4b: and a won bout's Renown to the character the claim names (arena.js arenaRenownFor - the renown law's own
        // door, its hour and cap), with a signed order when the level rose and its influence in Daggerfall's region for a
        // pledged war-guild - as a Renown report's and a writ's are
        const r = await claimArena(ctx, who.player, body.receipt, await gatePublicKey(env, subtle), { character: body.character ?? null, name: body.name ?? null });
        if (r.error) return json({ error: r.error, ...(r.why ? { why: r.why } : {}) }, r.error === 'no-gate-key' || r.error === 'busy' ? 503 : r.error === 'not-yours' ? 403 : 400, origin);   // AUDIT PRE-MERGE 1003 S6: `busy` - a players' bout whose ratings kept moving under it: kept, carried again
        if (r.renown && r.renown.credited > 0 && !r.renown.repeat) await creditRenown(ctx, who.player, env, { character: body.character, region: ARENA_RENOWN_REGION, xp: r.renown.credited });
        if (r.renown?.rose) {
          const key = await signingKey(env, subtle);
          const order = key ? await mintRenownOrder({ s: who.player.id, lv: r.renown.level }, key, { subtle, nowS }) : null;   // a rise said in the rooms now
          return json({ ...r, order }, 200, origin);
        }
        return json(r, 200, origin);
      }

      if (path === '/v1/arena/attempt' && request.method === 'POST') {
        // AUDIT ARENA-LADDER: AN ATTEMPT AT THE ACCOUNT'S NEXT LADDER BOUT - its ticket, which the relay opens the bout for
        // and signs into the receipt; every attempt still open is forfeit first (arena.js arenaAttempt). 409 `order` with
        // the ladder for a device behind the climb.
        const r = await arenaAttempt(ctx, who.player, body.tier, body.bout, body.room);   // AUDIT ARENA-LADDER 2: for the room it is fought in
        if (r.error) return json({ error: r.error, ...(r.ladder ? { ladder: r.ladder } : {}) }, r.error === 'order' ? 409 : r.error === 'busy' ? 503 : r.error === 'ladder-needs-account' ? 403 : 400, origin);
        return json(r, 200, origin);
      }

      if (path === '/v1/arena/board' && request.method === 'POST') {
        // ARENA4: THE ARENA'S BOARDS (Mac: "view your ranking and even player leaderboards"), counted from the rows - the
        // season's ratings and its #1, the climb, the fastest Grand Champions, the banners and the Hall of Champions - and
        // the caller's own (`me`).
        return json(await arenaBoardOf(ctx, who.player, env), 200, origin);
      }

      if (path === '/v1/arena/team' && request.method === 'POST') {
        // ARENA4: A BANNER JOINED OR QUIT (`banner` 'red' | 'blue' | null). 403 for a guest; 409 for a banner the season
        // refuses (`season`) or one while another is worn (`joined`).
        const r = await arenaTeam(ctx, who.player, body.banner ?? null);
        if (r.error) return json({ error: r.error, ...(r.left ? { left: r.left } : {}), ...(r.banner ? { banner: r.banner } : {}) }, r.error === 'guest' ? 403 : r.error === 'bad-banner' ? 400 : 409, origin);
        return json(r, 200, origin);
      }

      if (path === '/v1/renown/xp' && request.method === 'POST') {
        // RENOWN1: WHAT ONE OF THE CALLER'S CHARACTERS EARNED ONLINE
        // (RENOWN-CHAR: credited to that character's track again). The
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
        // SEAT1b (Seats-Arc 4.2: "The Renown report grows `region`"): what this report CREDITED - never what it asked, and
        // nothing for a repeat - kept for the character's war-guild where it pledged in that region
        if (body.region != null && r.credited > 0 && !r.repeat) await creditRenown(ctx, who.player, env, { character: body.character, region: body.region, xp: r.credited });
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
          const r = await homesInTown(ctx, who.player, body, { seats: seatsOpenFor(who.player, env) });   // SEAT1d: Open Gates
          return 'error' in r ? no(r.error, 400, origin) : json(r, 200, origin);
        }
        if (path === '/v1/homes/mine') return json(await homesOf(ctx, who.player), 200, origin);
        if ((path === '/v1/homes/decor' || path.startsWith('/v1/homes/decor/')) && body?.seat === true && !seatsOpenFor(who.player, env)) return no('seats-closed', 403, origin);   // SEAT-HALL: a palace's Charter Room while the seats are open
        if (path === '/v1/homes/layouts') return json(await homeLayouts(ctx), 200, origin);   // WD3: every town holding a home, and the layout it keeps
        if (path === '/v1/homes/decor') {
          const r = await decorOf(ctx, who.player, body);
          return 'error' in r ? no(r.error, 400, origin) : json(r, 200, origin);
        }
        if (path === '/v1/homes/yards') {   // HOME-YARD: every yard of a town, read by anyone walking its streets
          const r = await yardsOf(ctx, who.player, body);
          return 'error' in r ? no(r.error, 400, origin) : json(r, 200, origin);
        }
        if (path === '/v1/homes/rooms') {   // HOME-RENT: a home's rooms, read by anyone at its door
          const r = await roomsOf(ctx, who.player, body);
          return 'error' in r ? no(r.error, r.error === 'no-home' ? 404 : 400, origin) : json(r, 200, origin);
        }
        if (accountKind(who.player) !== 'linked') return no('homes-need-account', 403, origin);
        // REALM P2.2b: a realm character's record is in R2, and moves with the act; a sequence refused says the service's own
        const hctx = { ...ctx, bucket: env.SAVES };
        const realmNo = (r) => (r.error === 'seq' ? json({ error: 'seq', seq: r.seq }, 409, origin) : r.error === 'lease' || r.error === 'realm-gold' ? no(r.error, 409, origin) : null);
        if (path.startsWith('/v1/homes/decor/')) {
          // DECOR1: a piece placed, moved or removed - the owner's character's alone (decor.js)
          const r = path === '/v1/homes/decor/place' ? await placeDecor(hctx, who.player, body)
            : path === '/v1/homes/decor/move' ? await moveDecor(hctx, who.player, body)
              : path === '/v1/homes/decor/hidden' ? await hideDecorBase(hctx, who.player, body)   // BASE-HIDE
                : await removeDecor(hctx, who.player, body);
          if (!('error' in r)) return json(r, 200, origin);
          const said = realmNo(r);
          if (said) return said;
          const status = r.error === 'decor-cap' || r.error === 'yard-cap' || r.error === 'decor-taken' || r.error === 'guild-treasury-full' || r.error === 'vendor-stocked' ? 409   // GUILD1d: a hall piece's half back, into a full treasury; HOME-VENDOR: a stocked trader stays
            : r.error === 'decor-rate' ? 429
              : r.error === 'no-home' || r.error === 'no-decor' ? 404 : 400;
          return no(r.error, status, origin);
        }
        if (path.startsWith('/v1/homes/rooms/')) {
          // HOME-RENT: a room offered or withdrawn (the owner's), rented (another's, their record paying), its rent collected
          const r = path === '/v1/homes/rooms/offer' ? await offerRoom(hctx, who.player, body)
            : path === '/v1/homes/rooms/withdraw' ? await withdrawRoom(hctx, who.player, body)
              : path === '/v1/homes/rooms/rent' ? await rentRoom(hctx, who.player, body)
                : await collectRent(hctx, who.player, body);
          if (!('error' in r)) return json(r, 200, origin);
          const said = realmNo(r);
          if (said) return said;
          if (r.error === 'rent-price') return json({ error: 'rent-price', price: r.price }, 409, origin);   // the price that stands, for the door to show
          const status = RENT_STATUS[r.error] ?? 400;
          return no(r.error, status, origin);
        }
        if (path === '/v1/homes/look') {   // HOME-LOOK: how a home looks outside - its owner's character's (GUILD-YARD: a hall's, its keepers')
          const r = await setHomeLook(hctx, who.player, body);
          if (!('error' in r)) return json(r, 200, origin);
          return no(r.error, r.error === 'no-home' ? 404 : r.error === 'decor-rate' ? 429 : 400, origin);
        }
        if (path === '/v1/homes/arena-move') {
          // ARENA4b: A HOME THE ARENA DISPLACED, MOVED to the house its owner's client picked (homes.js arenaMoveHome) - the
          // pieces' refund onto the owner's record in the move's own batch, a realm act's
          const r = await arenaMoveHome(hctx, who.player, body);
          if (!('error' in r)) return json(r, 200, origin);
          const said = realmNo(r);
          if (said) return said;
          const status = r.error === 'home-taken' || r.error === 'home-changed' || r.error === 'guild-treasury-full' ? 409 : r.error === 'no-home' ? 404 : 400;
          return no(r.error, status, origin);
        }
        if (path === '/v1/homes/arena-moves') {   // ARENA4b: the moves this character has not read - its letter, its old scene emptied
          const r = await arenaMovesOf(hctx, who.player, body);
          return 'error' in r ? no(r.error, 400, origin) : json(r, 200, origin);
        }
        if (path === '/v1/homes/arena-seen') {   // ARENA4b: a move's letter read
          const r = await arenaMoveSeen(hctx, who.player, body);
          return 'error' in r ? no(r.error, 400, origin) : json(r, 200, origin);
        }
        if (path === '/v1/homes/deed') {
          // FIELD BUGS 2026-10-04d KNIGHT-HOUSE: A DEED THE REALM GAVE, HELD - the building a realm character's record holds
          // Daggerfall's deed to (a Knightly Order's house) kept from anyone else's claim (homes.js holdDeed)
          const r = await holdDeed(hctx, who.player, body);
          if (!('error' in r)) return json(r, 200, origin);
          if (r.error === 'home-layout') return json({ error: 'home-layout', layout: r.layout ?? null }, 409, origin);   // as /v1/homes/claim answers it
          const status = r.error === 'home-taken' || r.error === 'home-arena' ? 409 : r.error === 'home-rate' ? 429 : r.error === 'no-deed' || r.error === 'no-realm-character' ? 404 : 400;
          return no(r.error, status, origin);
        }
        if (path === '/v1/homes/claim') {
          const r = await claimHome(hctx, who.player, body);
          if (!('error' in r)) return json(r, 200, origin);
          const said = realmNo(r);
          if (said) return said;
          if (r.error === 'home-layout') return json({ error: 'home-layout', layout: r.layout ?? null }, 409, origin);   // WD3 (AUDIT WD3 O1): the layout the town keeps, for the client to hear
          const status = r.error === 'home-taken' || r.error === 'home-cap' || r.error === 'home-arena' ? 409 : r.error === 'home-rate' ? 429 : r.error === 'home-update' ? 426 : 400;   // AUDIT WD3 B2: a build from before the town mods   // WD3: a town kept in another layout   // ARENA4b: the arena stands there
          return no(r.error, status, origin);
        }
        const r = path === '/v1/homes/release' ? await releaseHome(hctx, who.player, body) : await setHomeEntry(hctx, who.player, body);
        if ('error' in r) return realmNo(r) ?? no(r.error, r.error === 'bad-entry' || r.error === 'realm-needed' ? 400 : r.error === 'home-crossed' || r.error === 'home-tenants' || r.error === 'home-vendor-stocked' ? 409 : 404, origin);   // HOME-CROSSED; HOME-RENT: a sale waits for its tenants; HOME-VENDOR: and its stocked trader
        return json(r, 200, origin);
      }

      // ═══ GUILD1: THE GUILDS ═════════════════════════════════════
      //
      // A character's own guild and the account's invitations are read by
      // any session (a guest's reads none); every change is an account's -
      // guilds.js asks again, and holds the bounds.
      if (path.startsWith('/v1/guilds/')) {
        if (request.method !== 'POST') return no('method', 405, origin);
        if (path === '/v1/guilds/mine') {
          const r = await guildOf({ ...ctx, env }, who.player, body);   // AUDIT 28 M5: the switch says whether the Marks show
          return 'error' in r ? no(r.error, GUILD_STATUS[r.error] ?? 400, origin) : json(await guildOrdersOf(r, who.player.id, env, subtle, nowS), 200, origin);
        }
        if (path === '/v1/guilds/invites') return json(await invitesOf(ctx, who.player), 200, origin);
        if (accountKind(who.player) !== 'linked') return no('guilds-need-account', 403, origin);
        const act = {
          '/v1/guilds/found': foundGuild, '/v1/guilds/invite': inviteToGuild, '/v1/guilds/answer': answerInvite,
          '/v1/guilds/leave': leaveGuild, '/v1/guilds/remove': removeFromGuild, '/v1/guilds/rank': rankGuildMember,
          '/v1/guilds/ranks': renameGuildRanks, '/v1/guilds/deposit': depositToGuild, '/v1/guilds/withdraw': withdrawFromGuild,
          '/v1/guilds/handover': handOverGuild, '/v1/guilds/disband': disbandGuild,
          // GUILD1d: the hall bought and sold from the treasury, who may walk in, and the heraldry (halls.js)
          '/v1/guilds/hall/buy': buyHall, '/v1/guilds/hall/sell': sellHall, '/v1/guilds/hall/entry': setHallEntry, '/v1/guilds/heraldry': setHeraldry,
          // GUILD1e: the guild's own board - its notes, its members' alone (guildBoard.js, the Notice Board's switch)
          '/v1/guilds/board': (c, p, b) => readGuildBoard(c, p, env, b), '/v1/guilds/board/pin': (c, p, b) => pinGuildNote(c, p, env, b),
          '/v1/guilds/board/take-down': (c, p, b) => takeDownGuildNote(c, p, env, b),
          // GUILD2a: a new name, for a price; GUILD2b: the vault - a piece in and out on the realm record, the grants
          '/v1/guilds/rename': renameGuild, '/v1/guilds/vault': vaultOf, '/v1/guilds/vault/put': vaultPut, '/v1/guilds/vault/take': vaultTake,
          '/v1/guilds/vault/grant': vaultGrant,
        }[path];
        if (!act) return no('not-found', 404, origin);
        const r = await act({ ...ctx, env, bucket: env.SAVES }, who.player, body);   // REALM P2.2: a realm character's record is in R2; AUDIT 28 M5: the switch says whether the Marks show
        if (!('error' in r)) return json(await guildOrdersOf(r, who.player.id, env, subtle, nowS), 200, origin);
        if (r.error === 'seq') return json({ error: 'seq', seq: r.seq }, 409, origin);   // REALM P2.2: the service's own, as a checkpoint's
        if (r.error === 'home-layout') return json({ error: 'home-layout', layout: r.layout ?? null }, 409, origin);   // AUDIT PRE-MERGE 1003 WD1: the town's layout, as /v1/homes/claim answers it
        // AUDIT2 GUILD2 S2/S7: the word the filter caught (`why`, the door's own field for a refusal's reason), and when the
        // next new name may come - each dropped here, so the page could say neither
        if (r.error === 'guild-name-word' && typeof r.word === 'string') return json({ error: r.error, why: r.word }, GUILD_STATUS[r.error], origin);
        if (r.error === 'guild-rename-soon' && Number.isSafeInteger(r.at)) return json({ error: r.error, at: r.at }, GUILD_STATUS[r.error], origin);
        return no(r.error, GUILD_STATUS[r.error] ?? 400, origin);
      }

      // ═══ MARKS1: MARKS ═════════════════════════════════════════════
      //
      // An account's alone, and the switch's (marks.js asks both first). The Bank's exchange answers the gold for the
      // client to put in its purse - the service's part is the burn and its cap; nothing here takes gold in.
      if (path.startsWith('/v1/marks/')) {
        if (request.method !== 'POST') return no('method', 405, origin);
        const act = {
          '/v1/marks/balance': () => marksOf(ctx, who.player, env),
          '/v1/marks/exchange': () => exchangeMarks(ctx, who.player, env, body),
          '/v1/marks/guild/deposit': () => depositGuildMarks(ctx, who.player, env, body),
          '/v1/marks/guild/withdraw': () => withdrawGuildMarks(ctx, who.player, env, body),
          '/v1/marks/report': () => marksReport(ctx, who.player, env),
        }[path];
        if (!act) return no('not-found', 404, origin);
        const r = await act();
        return 'error' in r ? no(r.error, MARKS_STATUS[r.error] ?? 400, origin) : json(r, 200, origin);
      }

      // ═══ NOTICE1: THE NOTICE BOARD ═══════════════════════════════════
      //
      // A town's notes, read by anyone the switch lets in; pinned, taken down and reported by registered accounts; a
      // moderator's remove and restore; the developers' notices (board.js asks each its own question first).
      if (path.startsWith('/v1/board/')) {
        if (request.method !== 'POST') return no('method', 405, origin);
        const act = {
          '/v1/board/read': () => readBoard(ctx, who.player, env, body.map),
          '/v1/board/pin': () => pinNote(ctx, who.player, env, body),
          '/v1/board/take-down': () => takeDownNote(ctx, who.player, env, body.id),
          '/v1/board/report': () => reportNote(ctx, who.player, env, body.id),
          '/v1/board/mod/remove': () => moderateNote(ctx, who.player, env, body.id, 'remove'),
          '/v1/board/mod/restore': () => moderateNote(ctx, who.player, env, body.id, 'restore'),
          '/v1/board/notice': () => postNotice(ctx, who.player, env, body),
          '/v1/board/notice/remove': () => removeNotice(ctx, who.player, env, body.id),
        }[path];
        if (!act) return no('not-found', 404, origin);
        const r = await act();
        return 'error' in r ? no(r.error, BOARD_STATUS[r.error] ?? 400, origin) : json(r, 200, origin);
      }

      // ═══ SEAT1a: THE SEATS ════════════════════════════════════════════
      //
      // The witnessed registry (townSeats.js): the seats the witnesses confirmed, read by anyone the switch lets in; a
      // seat reported by the client standing in its town; a developer's strike. SEAT1b (seatInfluence.js): a guild's
      // pledge, a seat's standings, the Watch's receipts, Tribute.
      if (path.startsWith('/v1/seats/')) {
        if (request.method !== 'POST') return no('method', 405, origin);
        // SEAT1c (Seats-Arc 5.2): "the account service settles week N the first time anything asks about any seat after
        // N's boundary" - every Turning due, before the ask is answered (one read when none is)
        if (seatsOpenFor(who.player, env)) await settleDue(ctx.db, nowS, seasonZeroOf(env.SEASON_ZERO_WEEK));   // SEASON1: a Season's end at its Turning
        const act = {
          '/v1/seats/list': async () => {
            const r = await listSeats(ctx, who.player, env);
            return 'error' in r ? r : { ...r, seats: await seatsWithHolders(ctx.db, r.seats, nowS), red: await redOf(ctx.db, nowS), zero: seasonZeroOf(env.SEASON_ZERO_WEEK) };   // SEAT1c: each seat's holder and battle   // CROWN2: the server's red lines   // SEASON1 part two: the week Season 0 began, for the client's Tides
          },
          '/v1/seats/relinquish': () => relinquishSeat(ctx, who.player, env, body),   // SEAT1c: a Charter given up at its board
          '/v1/seats/witness': () => witnessSeat(ctx, who.player, env, body),
          '/v1/seats/strike': () => strikeSeat(ctx, who.player, env, body),
          // SEAT1b: influence - a guild's pledge, the standings at a seat, the Watch's ticks claimed, Tribute paid
          '/v1/seats/pledge': () => pledgeSeat(ctx, who.player, env, body),
          '/v1/seats/standings': () => readStandings(ctx, who.player, env, body),
          '/v1/seats/records': () => readRecords(ctx, who.player, env, body),   // SEASON1 part three (9.2): the Hall of Records
          '/v1/seats/watch': async () => claimWatch(ctx, who.player, env, body, await gatePublicKey(env, subtle)),
          '/v1/seats/tribute': () => payTribute(ctx, who.player, env, body),
          // SEAT1d: the holder's levers at its board - the Tithe, the coming week's Edict; a Bounty's camp paid
          '/v1/seats/tithe': () => setTithe(ctx, who.player, env, body),
          '/v1/seats/edict': () => proclaimEdict(ctx, who.player, env, body),
          '/v1/seats/bounty': () => claimBounty(ctx, who.player, env, body),
          '/v1/seats/orc-camp': () => claimOrcCamp(ctx, who.player, env, body),   // SEASON1 part two (9.3): an Orc Raid's camp cleared
          // SEAT2a: the battles' week - the holder's window; a side signed, unsigned; a Sellsword hired, withdrawn
          '/v1/seats/window': () => setWindow(ctx, who.player, env, body),
          '/v1/seats/siege/sign': () => signBattle(ctx, who.player, env, body),
          '/v1/seats/siege/unsign': () => unsignBattle(ctx, who.player, env, body),
          '/v1/seats/siege/hire': () => hireSellsword(ctx, who.player, env, body),
          '/v1/seats/siege/withdraw': () => withdrawHire(ctx, who.player, env, body),
          // SEAT2a part three: a battle's pass (the field the fighter's game derived); a fighter's receipt claimed
          '/v1/seats/siege/pass': async () => siegePass(ctx, who.player, env, body, await signingKey(env, subtle)),
          '/v1/seats/siege/claim': async () => claimSiege(ctx, who.player, env, body, await gatePublicKey(env, subtle)),
          '/v1/seats/siege/void': () => voidSiege(ctx, who.player, env, body),   // VOID (Seats-Arc 18): a moderator's `/siege void <key>`
          // CROWN1 part two: a Royal Tourney's pass (the ring the contender's game derived); a bout's receipt claimed
          '/v1/seats/royal/pass': async () => royalPass(ctx, who.player, env, body, await signingKey(env, subtle)),
          '/v1/seats/royal/claim': async () => claimRoyal(ctx, who.player, env, body, await gatePublicKey(env, subtle)),
          // CROWN2: fealty offered (as vassal or liege), accepted, broken; a Pact offered (or accepted) and broken
          '/v1/seats/fealty': () => offerFealty(ctx, who.player, env, body),
          '/v1/seats/fealty/accept': () => acceptFealty(ctx, who.player, env, body),
          '/v1/seats/fealty/break': () => breakFealty(ctx, who.player, env, body),
          '/v1/seats/pact': () => offerPact(ctx, who.player, env, body),
          '/v1/seats/pact/break': () => breakPact(ctx, who.player, env, body),
          // SEAT2b (7.5): the works read, a project begun
          '/v1/seats/forts': () => readForts(ctx, who.player, env, body),
          '/v1/seats/fort/fund': () => fundFort(ctx, who.player, env, body),
        }[path];
        if (!act) return no('not-found', 404, origin);
        const r = await act();
        return 'error' in r ? no(r.error, SEAT_STATUS[r.error] ?? 400, origin) : json(r, 200, origin);
      }

      // ═══ PROF1: THE PROFESSIONS ══════════════════════════════════════
      //
      // A registered account's character's alone, and the switch's (professions.js asks both first). A delivery that
      // raised the character's Renown level carries a signed order, as a Renown report's answer does (RENOWN1), so the
      // level beside its name moves in the rooms it is in now.
      if (path.startsWith('/v1/prof/') || path.startsWith('/v1/stores/') || path.startsWith('/v1/writs/')) {
        if (request.method !== 'POST') return no('method', 405, origin);
        const act = {
          '/v1/prof/state': () => profState(ctx, who.player, env, body),
          '/v1/prof/pixels': () => profPixels(ctx, who.player, env, body),
          // PROF2b: a Motherlode is struck through the harvest's own route - its node names it (motherlodes.js)
          '/v1/prof/harvest': () => (isMotherlodeNode(body?.node) ? strikeMotherlode(ctx, who.player, env, body) : harvestNode(ctx, who.player, env, body)),
          '/v1/prof/motherlodes': () => motherlodesRead(ctx, who.player, env, body),   // PROF2b: today's three
          '/v1/prof/spec': () => chooseSpec(ctx, who.player, env, body),
          '/v1/prof/smelt': () => smeltAtForge(ctx, who.player, env, body),   // PROF2
          '/v1/prof/craft': () => craftAtAnvil(ctx, who.player, env, body),   // PROF3: the anvil; PROF4: the workbench
          '/v1/prof/brew': () => brewAtStation(ctx, who.player, env, body),   // PROF12: the alchemy station's brew
          '/v1/prof/disenchant': () => disenchantPiece({ ...ctx, bucket: env.SAVES }, who.player, env, body),   // PROF12: an enchanting station's disenchant; AUDIT PROF-541 B2: a realm character's record, in R2
          '/v1/prof/stock': () => buyStock(ctx, who.player, env, body),   // PROF3: the smith's stock; PROF4: the furnisher's
          '/v1/stores/withdraw': () => withdrawStores(ctx, who.player, env, body),
          '/v1/stores/deposit': () => depositStores(ctx, who.player, env, body),   // BAG1: what is carried, into the Stores
          // PROF6: the Court's writs, and beside them this board's guild writs and commissions (writs.js writBoard)
          '/v1/writs/list': async () => {
            const r = await listWrits(ctx, who.player, env, body);
            return 'error' in r ? r : { ...r, ...(await writBoard(ctx, who.player, env, body)), ...(await contractBoard(ctx, who.player, env, body)) };   // SILVER-WAYS: and its guild contracts
          },
          '/v1/writs/deliver': () => deliverWrit(ctx, who.player, env, body),
          '/v1/writs/post': () => postGuildWrit(ctx, who.player, env, body),   // PROF6: a guild writ
          '/v1/writs/supply': () => supplyGuildWrit(ctx, who.player, env, body),
          '/v1/writs/withdraw': () => withdrawGuildWrit(ctx, who.player, env, body),
          '/v1/writs/budget': () => setWritBudget(ctx, who.player, env, body),
          '/v1/writs/contract': () => postContract(ctx, who.player, env, body),   // SILVER-WAYS: a guild contract
          '/v1/writs/contract-withdraw': () => withdrawContract(ctx, who.player, env, body),
          '/v1/writs/commission': () => postCommission(ctx, who.player, env, body),   // PROF6: a commission
          '/v1/writs/fulfil': () => fulfilCommission(ctx, who.player, env, body),
          '/v1/writs/cancel': () => cancelCommission(ctx, who.player, env, body),
          '/v1/writs/decline': () => declineCommission(ctx, who.player, env, body),
          '/v1/stores/guild': () => guildStores(ctx, who.player, env, body),   // PROF6: the guild Stores
          '/v1/stores/guild-deposit': () => depositGuildStores(ctx, who.player, env, body),
          '/v1/stores/guild-withdraw': () => withdrawGuildStores(ctx, who.player, env, body),
        }[path];
        if (!act) return no('not-found', 404, origin);
        const r = await act();
        // AUDIT PROF-541 B2: a realm record's sequence (a checkpoint's own word) and a refusal's `why` ride with it
        if ('error' in r) return json({ error: r.error, ...(typeof r.why === 'string' ? { why: r.why } : {}), ...(r.error === 'seq' && Number.isSafeInteger(r.seq) ? { seq: r.seq } : {}) }, PROF_STATUS[r.error] ?? 400, origin);
        if (r.renown?.rose) {
          const key = await signingKey(env, subtle);
          return json({ ...r, order: key ? await mintRenownOrder({ s: who.player.id, lv: r.renown.level }, key, { subtle, nowS }) : null }, 200, origin);
        }
        return json(r, 200, origin);
      }

      // ═══ PROF5: THE MARKET ══════════════════════════════════════════
      //
      // A registered account's, and the board's, the professions' and the Marks' switches together (market.js asks
      // each first); a moderator's removal. Every act carries its request id, and one asked twice is one.
      if (path.startsWith('/v1/market/')) {
        if (request.method !== 'POST') return no('method', 405, origin);
        const mctx = { ...ctx, bucket: env.SAVES };   // GOLD-MARKET: a gold buy or collect moves a realm record, in R2
        const act = {
          '/v1/market/read': () => marketRead(ctx, who.player, env, body),
          '/v1/market/list': () => marketList(mctx, who.player, env, body),   // MARKET-ANY: a pack's piece moves its seller's record
          '/v1/market/buy': () => marketBuy(mctx, who.player, env, body),
          '/v1/market/cancel': () => marketCancel(ctx, who.player, env, body),
          '/v1/market/order': () => marketOrder(ctx, who.player, env, body),
          '/v1/market/fill': () => marketFill(ctx, who.player, env, body),
          '/v1/market/unorder': () => marketUnorder(ctx, who.player, env, body),
          '/v1/market/collect': () => marketCollect(mctx, who.player, env, body),   // MARKET-ANY: ...and its collector's
          '/v1/market/report': () => marketReport(ctx, who.player, env, body),
          '/v1/market/remove': () => marketRemove(ctx, who.player, env, body),
          '/v1/market/auction': () => marketAuction(ctx, who.player, env, body),   // PROF5b
          '/v1/market/bid': () => marketBid(ctx, who.player, env, body),
          '/v1/market/gold': () => marketGoldCollect(mctx, who.player, env, body),   // GOLD-MARKET
          '/v1/market/vendor': () => marketVendor(ctx, who.player, env, body),   // HOME-VENDOR: a home's trader's stock
          '/v1/market/vendors': () => marketVendors(ctx, who.player, env, body),   // HOME-VENDOR: the region's traders
          '/v1/market/myvendors': () => marketMyVendors(ctx, who.player, env, body),   // HOME-VENDOR: the Vendor page's
        }[path];
        if (!act) return no('not-found', 404, origin);
        const r = await act();
        if (r.error === 'seq') return json({ error: 'seq', seq: r.seq }, 409, origin);   // GOLD-MARKET: the service's own, as a checkpoint's
        return 'error' in r ? no(r.error, MARKET_STATUS[r.error] ?? 400, origin) : json(r, 200, origin);
      }

      if (path === '/v1/account/title' && request.method === 'POST') {
        // EQUIP ONE, OR NONE. Mac: "tap the account icon to equip 1
        // feature along with signing out." An absent `title` and an
        // explicit `null` both mean take it off - a player may always
        // wear nothing, and there is nothing to refuse them for.
        //
        // 403 AND NOT 401 for `not-held`: the credential is good, the
        // title is simply not theirs. Same reading as the save wall.
        const r = await equipTitle(ctx, await withSeatTitles(ctx, who.player, env), env, body.title ?? null);   // SEAT1c: a Charter's titles held too
        return r.error ? no(r.error, r.error === 'not-held' ? 403 : 400, origin) : json(r, 200, origin);
      }

      if (path === '/v1/account/aura' && request.method === 'POST') {
        // WB9g: WEAR ONE AURA, OR NONE - the title's door at the feet. 403 for `not-held`, as the title's.
        const r = await equipAura(ctx, await withSeatTitles(ctx, who.player, env), env, body.aura ?? null);   // AUDIT SEATS-3 E2: the wardrobe it answers keeps a Charter's titles
        return r.error ? no(r.error, r.error === 'not-held' ? 403 : 400, origin) : json(r, 200, origin);
      }

      if (path === '/v1/account/glyph' && request.method === 'POST') {
        // GLYPH-WEAR: SHOW ONE GLYPH, OR HIDE IT - `{ glyph, on }`. 403 for `not-held`, as the title's.
        const r = await equipGlyph(ctx, who.player, env, body.glyph, body.on !== false);
        return r.error ? no(r.error, r.error === 'not-held' ? 403 : 400, origin) : json(r, 200, origin);
      }

      if (path === '/v1/account/insignia' && request.method === 'POST') {
        // WB9g: THE BROKER'S INSIGNIA, BOUGHT (accounts.js buyInsignia - one UPDATE, the account's closed gates paying).
        // 403 for a guest (the credential is good, the sale is not theirs to keep); 409 for one owned or one the gates
        // cannot pay - the row is as it was, and the answer says why (`purse`, `price` for `short`).
        const r = await buyInsignia(ctx, await withSeatTitles(ctx, who.player, env), env, body.item);   // AUDIT SEATS-3 E2: and so does this one
        if (r.error) return r.error === 'short' ? json({ error: 'short', purse: r.purse, price: r.price }, 409, origin) : no(r.error, r.error === 'guest' ? 403 : r.error === 'owned' ? 409 : 400, origin);
        return json(r, 200, origin);
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

      if (path === '/v1/mod/customs-pass' && request.method === 'POST') {
        // CUSTOMS-PASS (2026-09-29, Mac, asked what becomes of a character a build from before the realm stranded:
        // "Staff customs pass"): A DEVELOPER GRANTS ONE ACCOUNT ONE CHARACTER THROUGH CUSTOMS (realm.js). 403 for a
        // caller who is not one - the credential is good, the right is not theirs, as the save wall reads it.
        const r = await grantCustomsPass(ctx, who.player, env, { name: body.name, account: body.account, revoke: body.revoke });
        return r.error ? no(r.error, PASS_STATUS[r.error] ?? 400, origin) : json(r, 200, origin);
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
        //
        // TERMS1: and it asks what the guest route asks. A guest made
        // before the boxes existed has agreed to nothing, and naming it is
        // where it becomes the account the request means.
        const refused = legalRefusal(body);
        if (refused) return no(refused.error, 400, origin);
        const r = await register(ctx, who.player.id, { handle: body.handle, password: body.password, legal: { terms: body.terms, privacy: body.privacy } });
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

      // ═══ REALM P1: THE REALM'S CHARACTERS (realm.js) ═════════════
      //
      // An online character's truth, held here: listed, made (born online or brought in once through customs),
      // joined under a lease, checkpointed at the next sequence, left, deleted - and its save read back for a join's
      // load or a copy to offline. EVERY ACCOUNT, a guest's too: a guest plays online, and its characters are its
      // account's as its Renown is.
      if (path.startsWith('/v1/realm')) {
        const me = who.player.id;
        const rctx = { ...ctx, bucket: env.SAVES };
        const answer = (r, ok = 200) => (r.error ? no(r.error, REALM_STATUS[r.error] ?? 400, origin) : json(r, ok, origin));
        if (path === '/v1/realm') {
          if (request.method !== 'GET') return no('method', 405, origin);
          return json({ characters: await listRealm(rctx, me), max: REALM_CHARACTERS_MAX }, 200, origin);
        }
        if (realmSlot) {
          if (request.method === 'PUT') {
            // A RAW BODY against the save's own bound, as the save slots read theirs; the lease, the sequence and
            // the tile ride headers, since the body is the save.
            const raw = await readCapped(request, REALM_MAX_BYTES);
            if (!raw) return no('too-large', 413, origin);
            if (!raw.byteLength) return no('body', 400, origin);
            // REALM-GZIP: a packed save is bounded twice - the request above, and the text it says it opens to (its
            // trailer's word, unread; every opening keeps the bound itself, so a gzip that lies buys nothing)
            const packed = new Uint8Array(raw);
            if (isGzip(packed) && gzipSizeOf(packed) > REALM_TEXT_MAX_BYTES) return no('too-large', 413, origin);
            let summary = null;
            try { summary = JSON.parse(request.headers.get('x-realm-summary') || 'null'); } catch { summary = null; }
            const r = await checkpointRealm(rctx, me, {
              id: realmSlot.id, lease: request.headers.get('x-realm-lease'), seq: Number(request.headers.get('x-realm-seq')), summary,
            }, raw, raw.byteLength);
            // a sequence refused says the service's own, so a tab whose last answer was lost can resync (never a way in:
            // the write still needs the lease)
            if (r.error === 'seq') return json({ error: 'seq', seq: r.seq }, 409, origin);
            return answer(r);
          }
          if (request.method === 'GET') {
            const r = await getRealmBlob(rctx, me, realmSlot.id);
            if (r.error) return no(r.error, REALM_STATUS[r.error] ?? 404, origin);
            // REALM-GZIP: the save as stored, packed or plain, to a tab that asks for it so (it opens either); to one that
            // does not - a build from before - a packed save is opened here, and it reads the text it always read
            let body = r.object.body;
            if (url.searchParams.get('enc') !== 'gzip') {
              const bytes = await objectBytesOf(r.object);
              body = isGzip(bytes) ? await gunzipText(bytes, REALM_TEXT_MAX_BYTES) : bytes;
              if (body == null) return no('no-data', 404, origin);
            }
            return new Response(body, {
              status: 200,
              headers: {
                'content-type': 'application/octet-stream',
                'access-control-allow-origin': origin,
                'access-control-expose-headers': 'x-realm-seq',
                'x-realm-seq': String(r.seq),
                'cache-control': 'no-store',
              },
            });
          }
          return no('method', 405, origin);
        }
        if (request.method !== 'POST') return no('method', 405, origin);
        // REALM-GZIP: every answer that hands a tab a lease says this service opens a packed save - a tab packs only then,
        // so a new build before its service is deployed (or after one rolled back) sends the text it always sent
        const leased = (/** @type {any} */ r) => answer(r.error ? r : { ...r, gzip: true });
        if (path === '/v1/realm/create') return leased(await createRealm(rctx, me, { name: body.name, summary: body.summary }));
        if (path === '/v1/realm/customs') return leased(await customsRealm(rctx, me, { origin: body.origin, name: body.name, summary: body.summary }));   // AUDIT REALM L3-F2/F3: one guarded batch, and resumable
        if (path === '/v1/realm/join') return leased(await joinRealm(rctx, me, body.id));
        if (path === '/v1/realm/trade') {
          // REALM P2.1: a sequence refused says the service's own, as a checkpoint's does
          const r = await tradeRealm(rctx, me, body);
          if (r.error === 'seq') return json({ error: 'seq', seq: r.seq }, 409, origin);
          return answer(r);
        }
        if (path === '/v1/realm/leave') return answer(await leaveRealm(rctx, me, { id: body.id, lease: body.lease }));
        if (path === '/v1/realm/undo') return answer(await undoRealm(rctx, me, body.id));   // HOUSE-LOSS: a customs that never landed, undone
        return answer(await deleteRealm(rctx, me, body.id));   // /v1/realm/delete - HOUSE-LOSS: which undoes one too, for a door that asks a delete
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

export default {
  fetch: (request, env) => measured(request, env, service.fetch),
};
