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
// NAME-AS, which name the room reads - the account's, or the realm character's the mint is for; the token's answer
// says both (`name` the room's, `accountName` the account's), the choice (`nameAs`) and, where the character's could
// not be worn, why (`nameWhy`, `nameWord`):
//   POST /v1/account/name { as }          -> { ok, nameAs }
// ACC4, time played. A beat carries no number - this clock measures:
//   POST /v1/account/played {}            -> { playedS }
// MOD1, moderation. The caller must be a moderator or a developer:
//   POST /v1/mod/mute { target, minutes } -> { ok, target, name, until, order }   (SAFE4: and its act in the record, the order pushed to the relay's door)
// SAFE1-SAFE8 (bible/11-Multiplayer/Chat-Safety-Arc.md), THE CHAT'S SAFETY:
//   POST /v1/safety/blocks {}                        -> { ok, blocks: [{ sub, name, at }] }   (SAFE1: my block list)
//   POST /v1/safety/block { target }                 -> { ok, blocks }   /v1/safety/unblock { target } the same
//   POST /v1/safety/report { target, reason, note?, lines: [{ tab, sub, name, at, text, sg }] } -> { ok, case, repeat?, muted?, order? }   (SAFE3: every line's stamp checked)
//   POST /v1/safety/conduct { v }                    -> { ok, conduct }   (SAFE7: the code of conduct agreed)
//   POST /v1/safety/staff-messages {}                -> { ok, messages: [{ id, from, text, at }] }   (STAFF-PANEL5-MESSAGE: staff's, waiting)
//   POST /v1/safety/staff-message-ok { id }          -> { ok, marked }   (STAFF-PANEL5-MESSAGE: the player pressed OK)
//   POST /v1/mod/ban { target?, name?, days, reason? } -> { ok, target, name, until, reason, order }   (SAFE4: a moderator's; days 0 for good)
//   POST /v1/mod/unban { target?, name? }            -> { ok, target, name, until: 0, order }
//   POST /v1/mod/strikes { target?, name? }          -> { ok, target, name, strikes, next, mutedUntil, bannedUntil, banReason, history }
//   POST /v1/mod/feed  <batch>                       -> { ok, read }   (SAFE5: the relay's public lines, signed - x-relay-feed-sig)
//   POST /v1/mod/grant-feed  <batch>                 -> { ok, read }   (GRANT2: a cell's window of spawn grant asks, signed - x-relay-grant-sig)
//   POST /v1/discord/interactions <interaction>      -> Discord's answer   (SAFE8: signed - x-signature-ed25519, x-signature-timestamp)
// A BANNED ACCOUNT is answered 403 { error: 'banned', until, reason } on every door behind a session but signing out.
// PRIVATE-REPORT, a registered player's private report to the readers REPORT_READER_HANDLES names (reports.js):
//   POST /v1/report/send { kind, subject, body, context?, rid } -> { ok, id, sentAt } | { ok, repeat, id, sentAt }
//   POST /v1/report/mine {}                    -> { reports: [{ id, kind, subject, sentAt, read, state }], max }
//   POST /v1/report/inbox { which? }           -> { which, reports: [{ ...head, from }], unread, open, max }   (a reader's)
//   POST /v1/report/read { id }                -> { report: { ...head, from, body, context, closedAt } }   (a reader's)
//   POST /v1/report/close { id, state }        -> { ok, id, state }   (a reader's: fixed | wontfix | duplicate | open)
// CUSTOMS-PASS, a developer alone - one character of one account through customs (tools/customsPass.mjs):
//   POST /v1/mod/customs-pass { name | account, revoke? } -> { ok, target, name, open, changed }
//   POST /v1/mod/realm-holds | realm-findings { id } | realm-clear { id, note? } | realm-hold { id, note? }
//        | realm-rollback { id, note? } | realm-budget { days?, set? }   INT6: the review of the judge's verdicts (review.js)
//        | realm-bodies { days? }   INT14: the boss fights' count, measured (review.js bodiesMeasure)
//        | realm-grants { days? }   GRANT2: the spawn grants' asks, measured (grants.js grantsMeasure)
//        | realm-gains { days? } | realm-trades { id }   HACKED-GOLD: who gained past the bucket; a character's trades (review.js)
//        | realm-characters { name } | realm-repair { id, ticket, faction, flag, gold, note? }   SUMMON-REPAIR: an account's
//          realm characters by handle; one character mended by staff - a flag bit cleared, gold given back, once a ticket
//        | realm-mend { id, ticket, was, gold, note? }   PURSE-MEND: a purse a wrapped sale left below nothing set to nothing, what
//          the character is owed given as a letter of credit, once a ticket - and the law's hold lifted when the purse was all it held on
// DUEL1, the duelling record. The caller of `loss` is the loser:
//   POST /v1/duel/loss   { winner }       -> { recorded, wins, losses }
//   POST /v1/duel/record { id }           -> { id, wins, losses, gates }
// WB5b, the gates closed. The caller is the account the receipt names:
//   POST /v1/serpent/claim { receipt, character, name?, cid? } -> { recorded, slain, renown, spoils, order, marks?, title?, aura?, titleNew?, auraNew? }   (SERPENT1: a sea serpent's receipt; SERPENT-SET: `marks` its silver where it recorded); SERPENT5: the Old Coil's grants on its first write
//   POST /v1/sd/claim    { receipt } -> { recorded, slot?, title?, aura?, broken }   (SD9b: a Brass Remnant's receipt - an Hour broken; Hourbreaker and The Turning Hour rolled on its first write)
//   POST /v1/ketch/claim { receipt } -> { recorded, voyage?, share, why?, sailed, guest? }   (KETCH: a Tonal Warden's receipt - the Ketchmaster's hold, once a voyage an account; `taken` another crew's this week)
//   POST /v1/eg/keys     {} -> { keys, live, rehearsal, proven, redoubts, sink, annals, feats, first }   (EG-PLAY: the Weir Keys held, the live breach; EG-E1: `sink` the week's Panoply sale, { week, piece }; EG-E2: the Annals' pages kept, each lord's feats; EG-ZF: the first-time lines shown - and First of the Spire's letter, once, to an account its list names)
//   POST /v1/eg/first    { bits } -> { first }   (EG-ZF: the first-time lines a client showed, OR'ed onto the account - guest 403, bits 400)
//   POST /v1/eg/open     { rq, rh?, ew?, wg?, again? } -> { order, b, ez, keys, until, rh, at? }   (EG-PLAY: a key staked - or the day's Rehearsal - and the open order signed; idempotent on `rq`; EG-F: `ew` the start Redoubt, `wg` the Wager; AUDIT EG IV: `again` 1 the stake `rq` took asked after a lost answer - its order as of its `at`, none taken; refused guest 403, unproven 403, start 403 (`w`), rq/wager 400, live 409 (`b`), short 409 (`keys`), rehearsed 409, spent 409, none 404)
//   POST /v1/eg/admit    { b } -> { order, b }   (EG-PLAY: a member's admission order; one live breach an account; refused guest 403, breach 400 (no stake opened it), spent 409 (its stake settled or its open window past), start 403 (`w`), live 409 (`b`))
//   POST /v1/eg/claim    { receipt, character? } -> { recorded, q, b, w?, keys, ... }   (EG-PLAY: an `e1` - a Redoubt taken, a member's end, a void; EG-E1: a Redoubt's `paid`, `again`, `marks`, `deed`, `embers`, `purse`, `weir`, `pity`, an end's `rl`; EG-ZF: an end's `board`, the member's standing - { k: 'descent', br, rank } or { k: 'depths', rank }; EG-E2: `honours`, the titles a Redoubt newly granted)
//   POST /v1/eg/sink     { piece } -> { ok, piece, week, purse }   (EG-E1: the Broker's Panoply piece, once a week for 20 embers - guest 403, piece 400, bought / short 409)
//   POST /v1/eg/board    {} -> { ok, season, descent: { alone, few, company }, depths, deepest, proclamation, best }   (EG-E2: the Elite Breach's three boards - egHonours.js)
//   POST /v1/eg/find     { tier } -> { found, keys, asks }   (EG-E3: a dungeon elite's find - 'super' | 'elite' | 'regular', the service's die, 6 asks a tier a day, 2 keys a week)
//   POST /v1/eg/starts   { subs } -> { starts: { [sub]: [w, ..., 0] | null }, keys, rehearsal, rk }   (EG-F: the start window's preflight - which starts each member may make)
//   POST /v1/lamp/claim  {} -> { granted, why? }   (LAMP-KEEPER II: a lamp keeper spoken to - I Love Lamp, laid once on the row; `why` 'held' | 'guest')
//   POST /v1/ql/claim    { line, step, phase, choice? } -> { opened } | { witnessed, title?, key?, keys? } | { why }   (QL12: a questline's step - `open` writes its opening, a guest's too; `end` reads its endgame receipt, claimed in the line's window and order; a line's title once, the Covens' Hoard's Weir Key once an account; `why` 'unpaid' | 'guest'; behind QUESTLINES_OPEN - 403 ql-closed, 400 ql-body)
//   POST /v1/gate/claim  { receipt, region?, character? } -> { recorded, stones, closed, seat? }   (WB12d: the row's embers, AUDIT WB12d A4; SEAT1b: `seat` the kill's influence)
// MARKS1, Marks - an account's alone, behind MARKS_OPEN (marks.js); `rid` the act's own id:
//   POST /v1/marks/balance {}                               -> { balance, today, bank }
//   POST /v1/marks/exchange { marks, rid }                  -> { ok, marks, gold, balance, exchangedToday } | { repeat, ... }
//   POST /v1/marks/find { kind, rid }                       -> { ok, struck, balance, today, why? } | { repeat, ... }   (SILVER-FINDS: a loot find)
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
//   POST /v1/prof/temper { character, recipe, quality, provenance?, rid } -> { ok, recipe, quality, provenance, record?, xp, track, stores } | { repeat, ... }   (CRAFT4: a piece a quality step better, up to Superior)
//   POST /v1/prof/reforge { character, tier, count?, rid }             -> { ok, tier, essence, seed, track, store } | { repeat, ... }   (CRAFT4: an Enchanter's Reforge for Arcane Essence; REFORGE-REPLACE: `count` the piece's reforges, doubling it)
//   POST /v1/stores/withdraw { character, material, qty, rid }         -> { ok, material, qty, store } | { repeat, ... }
//        BAG1: { carry: true, held, seen? } counts the units as carried -> { ..., carry, carried }
//   POST /v1/stores/deposit { character, material, qty, held, order, rid, seen? } -> { ok, material, qty, own, bought, gold, loose?, store, carried } | { repeat, ... }   (BAG1: `order` 'all' or 'spend'; a deposit made is answered as made, for good - prof_deposits; BAG-CRAFT: 'work', a station's, moves `loose` units the count does not hold too)
//   POST /v1/writs/list { character, region }                          -> { region, day, endsAt, writs, today, crafts: { writs, today } }   (CRAFT-WRITS: the character's crafting writs)
//   POST /v1/writs/deliver { character, id, rid }                      -> { ok, writ, pay, balance, track, store, today, renown, order } | { repeat, ... }
//   POST /v1/writs/craft { character, id, rid, realm, pieces? }        -> { ok, writ, pay, xp, balance, track, today, renown, realm, order } | { repeat, ... }   (CRAFT-WRITS: a crafting writ filled, its goods out of the realm record)
// RENOWN1, Renown. The caller's own character, by the id its
// save carries (RENOWN-CHAR: a track a character again - RENOWN-ACCOUNT
// kept one an account for a day); the level rides the token when the
// mint names one:
//   POST /v1/renown/xp { character, xp, name?, rid?, region? } -> { character, xp, level, credited, rose, order, max?, repeat? }   (SEAT1b: `region` where it was earned)
// FIRM1, THE FIRMAMENT (firmament.js; the law src/net/firmament/firmamentLaw.js): a character's passive tree, its Stars the Renown
// track's and its Craft points the profession tracks', every change the whole tree judged by the law, a refund's silver
// burnt in the change's batch. Behind FIRMAMENT_OPEN:
//   POST /v1/firmament/state { character }            -> { tree, renown, stars, craft, ranks, left, refund }
//   POST /v1/firmament/set { character, tree, rid }   -> { ...state, silver, balance? } | { repeat, ... }
//   POST /v1/firmament/respec { character, rid, realm?, region? } -> { ...state, respec, gold, realm? } (the whole sky back for 10,000 gold)
//   POST /v1/auth/token { character? }    -> { ..., level, xp }   (RENOWN4: xp, the track's total)
//   (REALM-DOOR: the token says whether that character is one of the account's realm characters, `rc`)
//   (ARENA4b: and, for a realm character, the level on its tile - its summary's - as `cl`, 1..1000)
// CHAP1, THE ROLL (bible/11-Multiplayer/Chapters-Arc.md 3): a realm character's standing with Daggerfall's own guilds -
// the twenty-two guild factions' reputation and its memberships - kept here, under the playing tab's lease, while
// CHAPTERS_OPEN lets the account in (npcRoll.js; the law src/net/npcChapterLaw.js):
//   POST /v1/chapters/roll { character, lease, seed? } -> { roll, from, seeded? } | { roll: null }   (seeded once from the save - a customs crossing from the epoch capped; what is owed paid)
//   POST /v1/chapters/claim { character, lease, rid, deltas, members } -> { roll, credited } | { roll, repeat }   (a loss whole, a gain at the day's pace and the rest owed)
//   POST /v1/chapters/witness { hall: { key, region, factions } } -> { ok, counted, why? }   (CHAP2a: a town's guild halls, witnessed as a seat is)
//   POST /v1/chapters/halls { region } -> { region, towns: [{ key, state, region, factions, witnesses, audit }], ignored }   (AUDIT CHAP2 E1: a developer's audit list)
//   POST /v1/chapters/strike { key } -> { ok, key, reports }   (AUDIT CHAP2 E1: a false town struck, a developer's)
//   POST /v1/chapters/list {} -> { week, chapters: [{ f, region, strength, band, seats: [{ seat, name }] }] }   (CHAP3b: the chapter sheet, the Turnings due settled first; CHAP5a its seats' holders)
//   POST /v1/chapters/focus { character, faction, region, focus } -> { ok, focus, week } | { error }   (CHAP4d: a Master's Focus)
//   POST /v1/chapters/history { region } -> { rows: [{ faction, week, kind, data, name }], zero }   (CHAP4d: a region's Chronicle; AUDIT CHAP4 R10)
//   POST /v1/chapters/back { character, faction, region, side } -> { ok, event, side } | { error }   (CHAP6b: a Schism's side, a Succession's candidate)
//   POST /v1/chapters/patron { character, faction, region, marks, rid } -> { ok, season, marks, guildMarks } | { error }   (CHAP7a: a guild's bid for a chapter's patronage)
// TOWN-ECON TE2 (bible/06-Systems/Town-Economy-Arc.md section 4; AUDIT TOWN-ECON 2 SVC-13: its own list, out of the chapters'):
//   POST /v1/towns/econ {} -> { ok, towns: [[map, share], ...] }   (every town's players' share of 1 or more, kept by the clock - SVC-3)
//   POST /v1/towns/witness { town: { map, px, py, region, location }, receipt } -> { ok, counted, confirmed?, why? }   (the town registry, witnessed as a seat is; SVC-1: a Watch tick at its pixel)
//   POST /v1/towns/watch { receipts, sea? } -> { ok, counted, sea, why, full }   (the Watch's ticks walked in a confirmed town, capped a town a day; SEA-TRADE: `sea` the ticks that vouch a dealing at a port's exchange)
//   POST /v1/towns/strike { map } -> { ok, map, reports }   (SVC-1: a false town struck, a developer's)
//   POST /v1/towns/audit { region } -> { ok, towns: [{ map, px, py, location, at, by }] }   (SVC-1: a region's confirmed towns, a developer's)
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
// HOME-VOTE, a registered account's word on another's home (homeVotes.js; /v1/homes/town's homes carry `score` and the
// caller's `vote`):
//   POST /v1/homes/vote { mapId, buildingKey, vote: 1 | -1 | 0 } -> { ok, mapId, buildingKey, vote, score }
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
  register, login, recover, changePassword, setEmail, overRate, overAccountRate, accountRateFull,
  newRecoveryCodes,   // RECOVERY-SET: a new set of codes from the profile
  accountWardrobe, equipTitle, equipAura, equipIcon, equipGlyph, buyInsignia, insigniaPurse, creditPlay, isMuted, mutedUntil,
  duelRecordOf, claimDuel, gateRecordOf, claimGate, legalRefusal,
  nameAsOf, wornNameOf, chooseNameAs,   // NAME-AS: the name the room reads - the account's or the character's
  ACCOUNT_MAX, ACCOUNT_WINDOW_S,
} from './accounts.js';
import { mintToken, mintRenownOrder, mintGuildOrder, mintGuildOutOrder, mintHomeOrder, MAX_TTL_S, TOKEN_V, ID_RE, SEAT_TITLES, CHAPTER_TITLES, TOKEN_MAX_CHARS, TOKEN_BODY_MAX, tokenBodyOf } from '../../src/net/identityToken.js';
import { ACCOUNT_VERSION, MAX_BODY_BYTES, ROUTES, OPEN_ROUTES, PATREON_OPEN_ROUTES, SAFE_OPEN_ROUTES, STAFF_ROUTES, savePathOf, realmPathOf, poiPathOf, SAVE_MAX_BYTES, SHOT_MAX_BYTES, maintaining, routeDb, d1BookmarkOf, D1_BOOKMARK_RE, d1Overloaded, noteOverload, shedding } from './service.js';   // SCALE4d: the routes a read replica may serve, and the session they are served on
import { poiRolesOf, putPoiAsset, getPoiAsset, savePoiDraft, submitPoi, withdrawPoi, requestRetire, reviewPoi, rollbackPoi, listPoi, poiHistory, poiQueue, poiLiveFeed, poiHeldVersion, poiFeedTag, listShelf, shelfEntry, shelve, unshelve, POI_ASSET_MAX, POI_DRAFT_BODY_MAX, POI_LIVE_ASSET_MAX_AGE_S } from './poi.js';   // POI-1: the POI store - builders draft, an approver decides, the feed is what is live; POI-4b: the library's shelf
import { listSaves, putCard, putBlob, getBlob, deleteSave, saveCardOf } from './saves.js';
import { signingKey, gatePublicKey } from './signing.js';
import { takeGrantMeasure, GRANT_FEED_PATH } from './grants.js';   // GRANT2: the spawn grants' measure, the relay's door in
import { GRANT_MEASURE_SIG_HEADER, GRANT_MEASURE_MAX_BYTES } from '../../src/net/grantMeasure.js';
import { takeNetFeed, NET_FEED_PATH } from './staffNet.js';   // STAFF-PANEL5-FEEDS: the relay's net feed, its door in
import { takeReactionFeed, REACTION_FEED_PATH } from './staffReactions.js';   // STAFF-PANEL5-FEEDS: the bot check's episodes, their door in
import { STAFF_FEED_SIG_HEADER, STAFF_FEED_MAX_BYTES } from '../../server/src/staffFeedLaw.js';
import { stakeCards, cashoutCards } from './cards.js';   // CARDS6: a card table's stakes, escrowed
import { seaBountyBoard, seaBountyPost, seaBountyCollect } from './seaBounty.js';   // SEA-BOUNTY: a freeport's bounty board on the open sea's killers
import { seaSeasonBoard } from './seaSeason.js';   // SEA-SEASON: the sea's season boards
import { seaWreck, seaPrizeCollect, seaPrizeReclaim } from './seaWreck.js';   // SHIP-PVP: a wreck at sea, and its prize
import { deckOrderOf, claimIliac, iliacBoardOf } from './iliac.js';
import { claimGambit, gambitBoardOf } from './gambit.js';   // KG6: The King's Gambit's season board and its GRANDMASTER   // CARDS10: a ranked seat's deck vouched for, Iliac Hand's season board and its title
import { titleWorn, glyphsOf, glyphsHidden, auraWorn, iconWorn } from './titles.js';
import { withHonours } from './honours.js';   // SIGN-BATCH: the three games' honours on a badge's row, in one batch
import { claimArena, arenaAttempt, arenaBoardOf, arenaTeam, arenaRatingOf, ARENA_HONOUR_PATHS, ARENA_RENOWN_REGION } from './arena.js';   // ARENA4: the arena's records, its board, its banners, and the honours the mint reads
import { arenaSeasonOf } from '../../src/net/arena/arenaLaw.js';
import { BUSY_RETRY_AFTER_S } from '../../src/net/busyLaw.js';   // BUSY-GATE: how long an overload answer tells a client to stand back
import { sendLetter, inboxOf, readLetter, deleteLetter } from './letters.js';   // MAIL1: the letters' routes
import { postBoxOf, readPost, claimPost, deletePost } from './post.js';   // SERVER-POST: the server's post
import { mailLostSpoils } from './lostSpoils.js';   // LOST-SPOILS: a boss's floor's leftovers into the post
import { LOST_BODY_MAX } from '../../src/net/lostLaw.js';
import { sendReport, myReports, reportInbox, readReport, closeReport } from './reports.js';   // PRIVATE-REPORT: a player's private report
import { REPORT_BODY_BYTES } from '../../src/net/reportLaw.js';
import { reportRenownXp, renownTrackOf, renownTracksOf, renownCharacterOk } from './renownTracks.js';   // RENOWN1: Renown's track - RENOWN-CHAR: a character's again
import { firmamentState, setFirmament, respecFirmament, FIRM_STATUS } from './firmament.js';   // FIRM1: the Firmament - a character's passive tree
import { chaptersOpenFor, readRoll, claimRoll } from './npcRoll.js';   // CHAP1: the Roll - a realm character's standing with Daggerfall's guilds
import { witnessHall, listHalls, strikeHall } from './npcHalls.js';
import { witnessTown, claimTownWatch, townsEcon, raidActStatements, strikeTown, auditTowns, townsOpen } from './townEcon.js';   // TOWN-ECON TE2: the players' share
import { creditReceipt } from './npcReceipts.js';   // CHAP2b: a receipt's standing and the chapter's receipt writ
import { chapterSheet, chapterSeatsOf, chapterTitlesOpenFor, chapterTitlesOfAccount, setChapterFocus, chapterChronicle, backChapter, bidPatron } from './npcChapters.js';   // CHAP3b: the chapter sheet; CHAP4a: a character's seats; CHAP4c: the chapters' titles
import { contractRegionOfRaid } from '../../src/net/writLaw.js';   // CHAP2b: the region a raid's key names   // CHAP2a: a town's guild halls, witnessed; AUDIT CHAP2 E1: audited and struck
import { claimRaid, raidRecordOf } from './raids.js';   // RAID4: the towns defended
import { claimSerpent, serpentRecordOf } from './serpents.js';   // SERPENT1: the serpents slain
import { claimStar, starRecordOf } from './stars.js';   // STAR7: the fallen stars held
import { claimSd, sdRecordOf } from './sds.js';   // SD9b: the Hours broken
import { claimKetch, ketchRecordOf } from './ketch.js';   // KETCH: the Ketchmaster's hold, once a voyage - and the voyages sailed, on the cards
import { egKeysOf, openEg, admitEg, claimEg, rollWeirKey, findEg, egFirstSay, egGateWeir, egGateWeirAnswer } from './eg.js';   // EG-PLAY: the Elite Breach - the Weir Keys, the open, the admission, the claim; EG-E3: a dungeon elite's find
import { egBoardOf, withEgHonours } from './egHonours.js';   // EG-E2: the Elite Breach's boards, and Spire Champion on the row
import { egSink } from './egEconomy.js';   // EG-E1: the Broker's Panoply sink
import { startsEg } from './egStarts.js';   // EG-F: the start window's preflight
import { claimLamp } from './lamp.js';
import { festivalOf, findFestival, buyFestival, festivalTown, setOffering, fillOffering, takeInOffering, takeFromOffering, FEST_STATUS } from './festival.js';   // WITCH1: the Witches' Festival   // LAMP-KEEPER II: I Love Lamp, laid on the row
import { claimQl, QL_STATUS } from './questlines.js';   // QL12: a questline's step claimed - what the service witnessed, paid
import { voteHome } from './homeVotes.js';   // HOME-VOTE: a town's word on a player's house
import { claimHome, releaseHome, setHomeEntry, homesInTown, homesOf, setHomeLook, homeLayoutsKept, arenaMoveHome, arenaMovesOf, arenaMoveSeen, holdDeed, inheritHome } from './homes.js';   // HOME1: the online homes' routes; HOME-LOOK: its outside; WD3: the towns' layouts; ARENA4b: the homes the arena displaced, moved; FIELD BUGS 2026-10-04d KNIGHT-HOUSE: a deed held
import { homeTransfer } from './homeTransfer.js';   // a house offered to one account, accepted as one write
import { roomsOf, offerRoom, withdrawRoom, rentRoom, collectRent } from './rent.js';   // HOME-RENT: a home's rooms, rented
import {
  foundGuild, guildOf, invitesOf, inviteToGuild, answerInvite, leaveGuild, removeFromGuild, rankGuildMember, renameGuildRanks,
  depositToGuild, withdrawFromGuild, handOverGuild, disbandGuild, guildBadgeOf, mintMemberOf,
  renameGuild,   // GUILD2a
} from './guilds.js';   // GUILD1: the guilds' routes; GUILD1c: the guild a token carries
import { vaultOf, vaultPut, vaultTake, vaultGrant } from './guildVault.js';   // GUILD2b: the guild's vault
import { HOME_ORDER_KEYS_MAX } from '../../src/net/homeLaw.js';   // QUEST-HOME: the most buildings one home order names
import { buyHall, sellHall, setHallEntry, setHeraldry } from './halls.js';   // GUILD1d: the guild hall and heraldry
import { readGuildBoard, pinGuildNote, takeDownGuildNote } from './guildBoard.js';   // GUILD1e: a guild's own board
import { listSeats, witnessSeat, strikeSeat, seatsOpenFor } from './townSeats.js';   // SEAT1a: the seats' witnessed registry
import { pledgeSeat, claimWatch, creditGate, creditRenown, readStandings, payTribute, claimOrcCamp, readRecords } from './seatInfluence.js';   // SEAT1b: influence   // SEASON1 part two: an Orc Raid's camp
import { settleDueOnce, seatsBoard, relinquishSeat, seatBadgeOf, seatTitlesOf } from './seatTurning.js';   // SEAT1c: the Turning, the Charters, their titles and glyphs
import { setTithe, proclaimEdict, claimBounty } from './seatHolding.js';   // SEAT1d: the holder's levers, a Bounty's camp
import { setWindow, signBattle, unsignBattle, hireSellsword, withdrawHire, siegesLive } from './seatBattles.js';   // SEAT2a: the battles' week
import { siegePass, claimSiege, voidSiege } from './seatSiege.js';   // SEAT2a part three: the pass, the result, Honours   // VOID: a moderator's void
import { royalPass, claimRoyal, keptTitleOf, KEPT_TITLES } from './seatRoyal.js';   // CROWN1 part two: the Royal Tourney's pass, its bouts, its champion's title (SEASON1: every title kept)
import { ribbonOf } from './seatRibbons.js';   // SEASON1 part two: a Season's banner ribbon, on the token
import { seatWeekOf, seasonOf, seasonZeroOf } from '../../src/net/townSeatLaw.js';   // SEASON1: the Season counted
import { offerFealty, acceptFealty, breakFealty, offerPact, breakPact } from './seatPolitics.js';   // CROWN2: fealty and Pacts, the red lines
import { fundFort, readForts } from './seatForts.js';   // SEAT2b: a seat's fortifications

/** SEAT1c: the account's row with the Charter titles it may wear laid on it (`seatTitles`, titles.js titlesHeld), while the
 *  seats are open to it - for the wardrobe's read and its write. */
const withSeatTitles = async (ctx, player, env) => withChapterTitles(ctx, seatsOpenFor(player, env) ? { ...player, seatTitles: await seatTitlesOf(ctx.db, player.id) } : player, env);
/** CHAP4c: and the chapters' seats' titles its characters hold, while CHAPTER_TITLES is on (npcChapters.js). */
const withChapterTitles = async (/** @type {any} */ ctx, /** @type {any} */ player, /** @type {any} */ env) => (chapterTitlesOpenFor(player, env)
  ? { ...player, chapterTitles: [...new Set((await chapterTitlesOfAccount(ctx.db, player.id, ctx.nowS, seasonZeroOf(env.SEASON_ZERO_WEEK))).map((t) => t.title))] } : player);
import { decorOf, placeDecor, moveDecor, removeDecor, hideDecorBase, yardsKept, forgetYards, settleYards } from './decor.js';   // YARD-SHED: a town's yards kept   // DECOR1: an online home's decor; BASE-HIDE: what its owner took out
import { commitDecorBatch } from './decorBatch.js';   // DECOR-BATCH: one Confirm for a home's draft
import { decorUse } from './decorAccess.js';   // DECOR-ACCESS: who may use a container or a station
import { DECOR_BATCH_BYTES } from '../../src/net/decorLaw.js';
import { gateStrikeStatement, gateStrikeAnswer, raidStrikeStatement, combatStrikeAnswer, raidStrikeRid, deedStatements, deedAnswer, deedEvent, marksOf, marksCardOf, exchangeMarks, depositGuildMarks, withdrawGuildMarks, marksReport, serpentStrikeStatement, serpentStrikeAnswer, findMarks, starStrikeStatement, starStrikeRid } from './marks.js';   // MARKS1: the server's currency; SILVER-WAYS: a raid's silver and a guild's deeds
import { readBoard, pinNote, takeDownNote, reportNote, moderateNote, postNotice, removeNotice } from './board.js';   // NOTICE1: the Notice Board
import { craftWritBoard, deliverCraftWrit } from './craftWrits.js';   // CRAFT-WRITS: the guilds' asks of a crafter
import { profState, profPixels, harvestNode, chooseSpec, withdrawStores, depositStores, smeltAtForge, craftAtAnvil, temperPiece, buyStock, listWrits, deliverWrit } from './professions.js';   // BAG1: a deposit   // PROF1: the professions; PROF2: the forge; PROF3: the anvil and the smith's stock
import { brewAtStation, disenchantPiece, reforgeWithEssence } from './alchemy.js';   // PROF12: Alchemy's brew, Enchanting's disenchant
import {
  writBoard, postGuildWrit, supplyGuildWrit, withdrawGuildWrit, setWritBudget, postCommission, fulfilCommission, cancelCommission, declineCommission,
  guildStores, depositGuildStores, withdrawGuildStores,
} from './writs.js';   // PROF6: guild writs, commissions and the guild Stores
import { contractBoard, postContract, withdrawContract, contractPayStatements, contractPaysOf } from './contracts.js';   // SILVER-WAYS: guild contracts
import { motherlodesRead, strikeMotherlode, isMotherlodeNode } from './motherlodes.js';   // PROF2b: the Motherlodes
import { marketRead, marketList, marketBuy, marketCancel, marketOrder, marketFill, marketUnorder, marketCollect, marketReport, marketRemove, marketAuction, marketBid, marketGoldCollect, marketVendor, marketVendors, marketMyVendors } from './market.js';   // PROF5: the market; PROF5b: its auctions; GOLD-MARKET: gold held collected
import {
  listRealm, createRealm, customsRealm, joinRealm, checkpointRealm, getRealmBlob, leaveRealm, deleteRealm, undoRealm,
  realmMintFacts, grantCustomsPass, REALM_CHARACTERS_MAX, REALM_MAX_BYTES, objectBytesOf,
} from './realm.js';   // REALM P1: the realm's characters; ARENA4b: the level on a realm character's tile, the token's `cl`
import { grantSpoils, portentPieces } from './budget.js';   // INT5: a signed win's spoils fill the playing character's budget (AUDIT WB14 WIRE-6: a portent's pieces with them)
import { reviewAct } from './review.js';   // INT6: the review of the judge's verdicts
import { doorReads } from './door.js';   // PRIMARY-FOLD: the door's reads in one trip
import { passRoute, passKey, mintPass, readPass, passMintable } from './sessionPass.js';   // SESSION-SIGN: the hot routes believe a pass
import { SESSION_PASS_HEADER } from '../../src/net/sessionPassLaw.js';   // SESSION-SIGN: its one name on the wire
import { PROGRESS_ROUTES, seatRefusalOf, progressConfig, progressRoom, progressSpent } from './progress.js';   // INT16-INT17: a progression claim's seat, and the play that pays for it
import { isGzip, gzipSizeOf, gunzipText, REALM_TEXT_MAX_BYTES } from '../../src/net/realm/realmSaveCodec.js';   // REALM-GZIP: a save rides packed
import { tradeRealm, REALM_TRADE_BODY_MAX } from './realmTrade.js';   // REALM P2.1: a trade, settled here
import { wildFall, wildCollect, wildReclaim, wildEscrows } from './wild.js';   // INT9: a death in the open zone's drop, taken off the record; MAC (2026-10-14): its killer's piece in escrow - collected, taken back, listed
import { listLineages, putLineage, realmDie, realmRaise, realmWed, listUnions, LINEAGE_BODY_MAX } from './legacy.js';   // LEGACY7: Project Legacy's lines and the tombstone; REZ-BLOODLINE AUDIT R1: a Resurrect inside its hold
import { measured, heartbeatPartsOf } from './metrics.js';   // SCALE1: every request counted (Workers Analytics Engine); AUDIT SCALE II A-3: a heartbeat's parts, of the body the route read
import { runCron } from './cron.js';   // SCALE4b: the service's own clock
import { blocksOf, blockAccount, unblockAccount, fileReport, agreeConduct, conductAgreed, takeFeed, bannedAnswer, modCases, modCase, modDismiss, modAct, REPORT_BODY_MAX } from './safety.js';   // SAFE1-SAFE7: the chat's safety
import { strikesLook, isBanned } from './sanctions.js';   // SAFE4: the record, the ladder and the ban
import { freezeRefusal, frozenAnswer, playerStaffChat, isFrozen, STAFF_CHAT_ROUTES, STAFF_CHAT_STATUS } from './staffFreeze.js';   // STAFF-PANEL5-FREEZE: the freeze gate and the player's staff chat
import { staffRoute, STAFF_STATUS, STAFF_SESSION_HEADER, auditStatement } from './staff.js';   // STAFF-PANEL1: the staff panel's sign-in, sessions, roles and audit log
import { staffMessagesFor, staffMessageOk } from './staffMessage.js';   // STAFF-PANEL5-MESSAGE: the game's two doors
import { hiddenToken, takeHiddenSeen } from './staffHidden.js';   // STAFF-PANEL5-HIDDEN: a hidden staff member's token, and a private home it entered
import { HIDDEN_SEEN_PATH, HIDDEN_SEEN_MAX_BYTES, HIDDEN_SEEN_SIG_HEADER } from '../../src/net/hiddenSeen.js';
import { discordSigned, discordInteraction, DISCORD_BODY_MAX } from './discord.js';   // SAFE8: the moderators' queue in Discord
import { FEED_MAX_BYTES, FEED_SIG_HEADER } from '../../src/net/safety/chatFeed.js';   // SAFE5: the relay's feed of public lines
import { heartbeat } from './heartbeat.js';   // SCALE4c: one request for a tab's three clocks
import { ADMIT_ROUTES, admitWait } from './admit.js';   // ADMIT-LINE: the sign-in line
export { AdmitGate } from './admit.js';   // ADMIT-LINE: the line's Durable Object (wrangler.toml binds it from this module)
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
/** POI-1: a POI store refusal's status - a role refused 403, a thing not there 404 (taken off the shelf, 410), a state
 *  moved or a builder's holdings full 409, a full day 429. AUDIT POI: `poi-changed` (S1), `poi-drafts-full` (S10),
 *  `poi-shelf-full` and `poi-shelf-spent` (S10), `poi-gone` (U13). */
const POI_STATUS = {
  'poi-not-builder': 403, 'poi-not-approver': 403, 'poi-not-author': 403, 'not-found': 404, 'poi-gone': 410, 'poi-state': 409, 'poi-changed': 409, 'poi-pending': 409, 'poi-not-live': 409,
  'poi-drafts-full': 409, 'poi-shelf-full': 409, 'poi-shelf-spent': 409, 'poi-quota': 429, 'no-storage': 503,
};
/** POI-1: what one address may ask of the POI store's open reads in a window - a game streaming a town's models at once. */
const POI_OPEN_MAX = 600;
/** POI-1: AN ASSET'S BYTES, as stored - a live one cached a day (AUDIT POI S4: its name is its hash, so its bytes never
 *  change, but it can stop being public - "immutable for a year" had made that impossible to take back), a draft's never
 *  cached (a builder's business, and it may never go live). */
const poiAssetResponse = (/** @type {any} */ r, /** @type {string} */ origin) => new Response(r.object.body, {
  status: 200,
  headers: {
    'content-type': r.type,
    'access-control-allow-origin': origin,
    'cache-control': r.live ? `public, max-age=${POI_LIVE_ASSET_MAX_AGE_S}` : 'private, no-store',
  },
});
/** AUDIT ONLINE A17's law, the service's one answer to a throw: LOGGED, not lost, and a player told nothing about it -
 *  an overloaded D1 a 503 (SCALE4f: counted apart from a bug), any other a 500. HOMES-SHED (2026-10-13, the database
 *  overloaded from 14:11 UTC): the try's catch below, and the one route above it that asks the database (the siege
 *  blackout's question), whose throw had left the Worker as a bare 500 - no body, no log line, no metrics point. */
const thrown = (path, e, origin) => {
  console.error('[account]', path, e?.stack ?? String(e));
  if (!d1Overloaded(e)) return no('server', 500, origin);
  noteOverload(Date.now());   // BUSY-GATE: and this isolate sheds the reads a moment (service.js)
  return overloaded(origin);
};
/** BUSY-GATE (net/busyLaw.js): THE OVERLOAD'S ANSWER - `server`, 503 (SCALE4f), and how long to stand back. The client's
 *  gate holds its reads that long at least; a client from before the gate asks again on its own schedule. */
const overloaded = (origin) => {
  const res = no('server', 503, origin);
  res.headers.set('retry-after', String(BUSY_RETRY_AFTER_S));
  return res;
};
/** REALM P1: each realm refusal's status - a bad shape 400 (the default), a character that is not the caller's 404, a
 *  lease another tab holds or a sequence that is not the next 409 (the tab that lost it goes offline), the account's
 *  bound 409, customs refused 403/409, no storage 503. */
/** INT3/INT4 (the INTEGRITY arc - bible/06-Systems/Integrity-Arc.md): THE JUDGE'S REFUSALS, the same at every route that
 *  hands a realm character's value to another player - its trade held, its record unread since the judge shipped, a
 *  piece the id ledger marked a duplicate - each a conflict with what stands (realm.js holdRefusal, prepareRealmRecord). */
const JUDGE_STATUS = Object.freeze({ 'trade-held': 409, 'record-unjudged': 409, 'piece-dupe': 409, 'piece-claimed': 409, 'piece-legacy': 409 });
/** INT9: a death's drop's refusals - no key to verify or sign with 503, a receipt not the caller's 403, the fallen's own
 *  grace or the room's falls 409; the record's own (REALM_STATUS) after them, a bad shape 400 (the default). */
const WILD_STATUS = Object.freeze({ 'no-gate-key': 503, 'no-signing-key': 503, 'not-yours': 403, grace: 409, 'fallen-frozen': 409, nonce: 400, 'no-escrow': 404, 'escrow-wait': 409, 'escrow-late': 409, 'escrow-moved': 409, 'escrow-collected': 409, 'escrow-returned': 409, 'sea-prize-moved': 409, 'sea-prize-realm': 403 });   // MAC (2026-10-14): the escrow's; SHIP-PVP: a prize's
/** HOME-RENT: a room's refusals - a bad shape 400 (the default). */
const RENT_STATUS = Object.freeze({
  ...JUDGE_STATUS,
  'rent-taken': 409, 'rent-held': 409, 'rent-rooms': 409, 'rent-none': 409, 'rent-own': 403, 'realm-only': 403,
  'rent-rate': 429, 'no-rent-room': 404, 'no-home': 404,
});
/** AUDIT CARDS-6 D8: a card table's and a ranked deck's refusals that are not a bad request (400, the default): the service
 *  with no key to sign with, a guest asking for a ranked seat. */
const CARDS_STATUS = Object.freeze({ 'cards-closed': 503, 'ranked-needs-account': 403 });
/** PRIVATE-REPORT: a report's refusals that are not a bad request (400, the default). */
const REPORT_STATUS = Object.freeze({ 'report-rate': 429, 'report-full': 409, 'no-report': 404, 'not-report-reader': 403 });
/** SERVER-POST: the post's own refusals; a claim's realm words are REALM_STATUS's. */
const POST_STATUS = Object.freeze({ 'no-post': 404, 'post-no-item': 409, 'post-claimed': 409, 'post-unclaimed': 409, 'realm-only': 403, 'realm-needed': 409, server: 503,
  'lost-pieces': 400, 'lost-item': 400, 'lost-no-kill': 409, 'lost-spent': 409, 'lost-full': 409 });   // AUDIT SERVER-POST: a batch D1 dropped is the service's failure, counted as one
const REALM_STATUS = Object.freeze({
  ...JUDGE_STATUS,   // INT3/INT4
  'no-realm-character': 404, 'no-data': 404, lease: 409, seq: 409, 'too-many-characters': 409, auth: 401,   // SESSION-SIGN E3: a checkpoint's session gone
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
  // LEGACY7 (legacy.js): a tombstone is gone for good; a line or person the birth cannot be; a line's model is its founder's
  dead: 410, 'no-lineage': 404, 'lineage-person': 409, 'lineage-played': 409, 'lineage-model': 409, 'too-many-lineages': 409,
  'wed-no-line': 409, 'wed-already': 409, 'wed-partner': 409, 'wed-spent': 409,   // LEGACY7 part three: a wedding the realm cannot make
  'lineage-too-large': 413,   // AUDIT LEGACY III O2/P1: a line's record past its bound - its own word, never a malformed body's
  'not-dead': 409, 'raise-late': 409, 'raise-no-line': 409,   // REZ-BLOODLINE AUDIT R1: a Resurrect the realm will not take
});
/** CUSTOMS-PASS: a pass's refusals - a bad shape 400 (the default), a caller who is no developer 403, no such account
 *  404, a guest's name two accounts wear 409. */
const PASS_STATUS = Object.freeze({ 'not-developer': 403, 'no-player': 404, ambiguous: 409 });
/** CHAP1: the Roll's refusals - a bad shape 400 (the default), the switch shut 403, no such character or none of its
 *  saves landed 404, a lease another tab took 409 (the tab stops), a Roll not yet read or a race lost 409 (the tab asks
 *  again - AUDIT CHAP R12: this said the lease was asked again too), a tombstone 410. */
const ROLL_STATUS = Object.freeze({
  'chapters-closed': 403, 'no-realm-character': 404, 'no-data': 404, lease: 409, 'roll-unseeded': 409, 'roll-busy': 409, dead: 410,
  'halls-need-account': 403, 'halls-rate': 429,   // CHAP2a: a hall's witness - a guest's, or past the hour's
  'roll-rate': 429,   // AUDIT CHAP2 E2: the claims' hour
  'hall-struck': 409, 'not-developer': 403, 'bad-region': 400,   // AUDIT CHAP2 E1: a struck town; the audit and the strike a developer's
  'not-master': 403,   // CHAP4d: a Focus set by a character that is not that chapter's Master ('no-focus' and 'body' the shape's 400)
  'no-event': 409, closed: 409, 'not-member': 403,   // CHAP6b: a backing where the Season holds nothing to back, one decided, or by no member ('no-side' the shape's 400)
  // CHAP7a: a patron's bid - an account's, a request's id, the Marks switch, its rank, the hour's writes; no Season or chapter to bid on; too
  // little or no more than it stood at, too little in the treasury ('bad-marks', 'marks-rid', 'guild-character' the shape's 400)
  'marks-need-account': 403, 'marks-closed': 403, 'guilds-need-account': 403, 'no-guild': 404, 'guild-rank': 403, 'marks-rate': 429,
  'no-season': 409, 'no-chapter': 404, 'patron-low': 409, 'guild-marks-short': 409,
});
/** INT6: the review's refusals - no developer 403, no such character 404, nothing clean to roll back to 409. */
const REVIEW_STATUS = Object.freeze({ 'not-developer': 403, 'no-realm-character': 404, 'no-clean': 409, 'service-moved': 409, 'dead': 409, 'no-player': 404, 'repair-no-faction': 409, 'repair-not-set': 409, seq: 409, 'mend-not-negative': 409, 'mend-moved': 409, 'repair-ticket': 409 });   // SUMMON-REPAIR: from 'no-player' on; PURSE-MEND: the last three
/** GUILD1: each guild refusal's status - a bad shape 400 (the default), the wrong rank or too little Renown 403, a
 *  thing that is not there 404, a conflict with what is 409, the hour's writes spent 429. */
const GUILD_STATUS = Object.freeze({
  ...JUDGE_STATUS,   // INT3/INT4
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
  'guild-rename-same': 409, 'guild-name-word': 400, 'guild-rank-word': 400, 'guild-rename-soon': 409, 'guild-rename-siege': 409, 'guild-rename-gold': 409, 'guild-rename-moved': 409,
  'guild-vault-rank': 403, 'guild-vault-limit': 409, 'guild-vault-full': 409, 'guild-vault-empty': 404, 'guild-vault-moved': 409, 'vault-goods': 409, 'guild-vault': 409,
  'realm-only': 400, 'bad-vault-item': 400, 'bad-vault-count': 400, 'bad-vault-slot': 400, 'bad-vault-grant': 400,
  'guild-seat': 409, 'guild-battle': 409,   // SEAT1c: a guild holding a Charter, or named in a battle still to come, does not go
  'guild-patron': 409,   // AUDIT CHAP5 E4: nor one whose bid for a chapter's patronage stands
  // GUILD1e: the guild's board - the Notice Board's switch, a mute, no such note, the member's notes full, the hour spent
  'board-closed': 403, muted: 403, 'no-note': 404, 'notes-full': 409, 'board-rate': 429, 'board-ops-rate': 429,
  // REALM P2.2: a realm character's record moves with the act - where it stands, and whether it can pay
  'realm-needed': 400, 'realm-gold': 409, lease: 409, seq: 409, 'no-realm-character': 404, 'no-data': 404, 'no-storage': 503,
});
/** MARKS1: each Marks refusal's status - not this account's (a guest, the switch, a rank, a developer's; AUDIT 625 S1:
 *  the finds of an account not yet a week registered) 403, no guild 404, short or capped 409, the hour's acts spent
 *  429, a bad shape 400 (the default). */
/** EG-PLAY: each Elite Breach refusal's status - the service without its key 503, not this account's (a guest, another's
 *  receipt) 403, a breach held or no key to stake 409, a bad shape 400 (the default). EG-E3: a find's day spent 409. */
const EG_STATUS = Object.freeze({
  'no-signing-key': 503, 'no-gate-key': 503,
  guest: 403, 'not-yours': 403, unproven: 403,
  live: 409, short: 409, rehearsed: 409, spent: 409, capped: 409,   // EG-E3: a find past its day's asks
  bought: 409,   // EG-E1: the week's Panoply piece already bought
  start: 403,   // EG-F: a start the account may not make (no carries)
  none: 404,   // AUDIT EG IV (lane3 #1): an open asked again (`again`) whose request id took no key
});
const MARKS_STATUS = Object.freeze({
  'marks-need-account': 403, 'marks-closed': 403, 'marks-young': 403, 'not-developer': 403, 'guild-rank': 403, 'guilds-need-account': 403,
  'no-guild': 404,
  'marks-short': 409, 'marks-bank-cap': 409, 'marks-full': 409, 'guild-marks-short': 409, 'guild-marks-full': 409,
  'marks-rate': 429,
});
/** NOTICE1: each board refusal's status - not this account's (a guest, the switch, a mute, a moderator's or a
 *  developer's act) 403, no such note 404, the author's notes full 409, the hour's acts spent 429, a bad shape 400. */
/** SAFE1, SAFE3, SAFE7: the chat safety's refusals by status - the rest 400. */
const SAFETY_STATUS = Object.freeze({ 'no-player': 404, 'no-case': 404, 'report-unwitnessed': 403, 'report-closed': 503, 'conduct-stale': 409, 'blocks-full': 409, rate: 429,
  'not-moderator': 403, protected: 403, ambiguous: 409,
  // STAFF-PANEL2-FIX (safety.js modAct): the bounds, a case another act took or closed or another staff member holds, a
  // spawn case (a developer's), an Admin's sanction (an Admin's to lift), a press's id of the wrong shape
  'bad-minutes': 400, 'bad-days': 400, 'not-banned': 400, 'case-acted': 409, 'case-closed': 409, 'staff-claimed': 409, 'not-developer': 403, 'admin-sanction': 403,
  'bad-click': 400 });
const BOARD_STATUS = Object.freeze({
  'board-need-account': 403, 'board-closed': 403, 'muted': 403, 'not-moderator': 403, 'not-developer': 403, 'own-note': 403,
  'guild-rank': 403, 'guilds-need-account': 403,
  'no-note': 404, 'no-notice': 404, 'note-no-guild': 404,
  'notes-full': 409,
  'board-rate': 429, 'board-ops-rate': 429,
});
/** TOWN-ECON TE2: each town refusal's status - a guest 403, the hour's reports spent 429, no relay key 503, a bad shape 400
 *  (the default). */
const TOWN_STATUS = Object.freeze({ 'towns-need-account': 403, 'towns-rate': 429, 'no-gate-key': 503, 'towns-closed': 403, 'not-developer': 403, 'town-unwalked': 403 });   // AUDIT TOWN-ECON 2
/** SEAT1a (SEAT1b): each seat refusal's status - not this account's (a guest, the switch, a developer's act) 403, a seat struck
 *  409, the hour's reports spent 429, a bad shape 400 (the default). */
/** SEAT-LEASE: the seat routes that only read, answered from the state as it stands while another settles the Turning. */
const SEAT_READS = new Set(['/v1/seats/list', '/v1/seats/standings', '/v1/seats/records', '/v1/seats/forts']);
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
 *  no such writ 404, a conflict with what stands (the day, the hour, a bound, the Stores, a node or writ taken) 409, the
 *  hour's acts spent 429, a bad shape 400 (the default). */
const PROF_STATUS = Object.freeze({
  ...JUDGE_STATUS,   // INT3/INT4
  'prof-need-account': 403, 'prof-closed': 403, 'marks-closed': 403, 'prof-rank': 403,
  'no-writ': 404, 'bad-recipe': 404,
  'prof-pixel': 409, 'prof-day': 409, 'prof-late': 409, 'stores-full': 409, 'stores-short': 409,   // ANY-HOUR: no `prof-night` - no node keeps hours; CAP-OFF: no `prof-cap` - no day's cap
  'prof-deep-cap': 409, 'prof-spec-stale': 409, 'prof-spec-taken': 409, 'prof-trial-over': 409,   // AUDIT PERK-TRIAL P4: a change asked free, its day out   // AUDIT 29 (CAP-OFF: no `prof-account-cap`)
  'prof-no-pack-form': 409,   // PROF3: the smith's stock stays in the Stores until its professions' templates
  'carried-full': 409, 'carried-short': 409,   // BAG1: a carried count at its bound, or holding fewer than a deposit asks
  'prof-later': 409,   // PROF4: a recipe whose slice is to come - the Ram Kit (PROF0 25)
  'prof-hunt-high': 409, 'prof-foe': 400, 'prof-dye': 400,   // PROF7: Hunting's rare hides (3 of tiers 5-6 a day - CAP-OFF: no `prof-hunt-cap`, nor PROF8's `prof-fish-cap`), a body no knife skins, a dye asked of what takes none
  'prof-sculptor': 403,   // PROF11: the stone decor is a Sculptor's - a skill's door, as the rank's
  'prof-lapidary': 403,   // PROF10: a Siege-cracked Gem is set as a gem by a Lapidary alone - a skill's door, as the Sculptor's
  // PROF12: a transmutation is a Transmuter's (a skill's door); a cauldron DFU's law answers with no such potion, a bad piece's id;
  // no such piece, another's; one listed, on the road or set down; one that makes no Essence
  'prof-transmuter': 403, 'bad-brew': 400, 'bad-piece': 400, 'prof-no-piece': 404, 'prof-not-yours': 403, 'prof-piece-busy': 409, 'prof-no-essence': 409,
  // AUDIT PROF-541 B2: a realm character's disenchant moves its record - a piece the record does not hold, and the record's own words
  'prof-piece-gone': 409, 'realm-needed': 400, lease: 409, seq: 409, 'no-realm-character': 404, 'no-data': 404, 'no-storage': 503,
  'node-taken': 409, 'writ-taken': 409, 'writ-expired': 409, 'writ-cap': 409, 'marks-full': 409, 'marks-short': 409, 'prof-respec-pending': 409,
  'prof-rate': 429,
  'craft-writ-cap': 409, 'craft-writ-filled': 409, 'craft-unbrewed': 409, 'craft-pieces': 409, 'craft-goods-gone': 409,   // CRAFT-WRITS: the day's three, the brews, the pieces, the record's goods
  'chapters-closed': 403,   // AUDIT CHAP2 S3: a hall writ while the Chapters are not this account's - 403, as every door says it
  // PROF6: guild writs, commissions and the guild Stores
  'writs-closed': 403, 'guild-rank': 403, 'guilds-need-account': 403, 'commission-not-yours': 403, 'market-not-yours': 403,
  'no-guild': 404, 'commission-crafter': 404,
  'writ-gone': 409, 'writ-elsewhere': 409, 'writ-short': 409, 'writ-moved': 409, 'writ-budget': 409, 'guild-marks-short': 409,
  'guild-writs-max': 409, 'guild-stores-full': 409, 'guild-stores-short': 409, 'commissions-max': 409, 'commissions-crafter-max': 409,
  'commission-self': 409, 'commission-piece': 409, 'commission-not-made': 409, 'commission-worn': 409, 'market-listed': 409,
  'market-piece-gone': 409,   // INT19: a crafted piece the crafter's record does not hold
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
  ...JUDGE_STATUS,   // INT3/INT4
  'prof-need-account': 403, 'market-closed': 403, 'not-moderator': 403, 'not-developer': 403,   // STAFF-PANEL2-FIX: a pull is a developer's
  'market-gone': 404,
  'marks-short': 409, 'marks-full': 409, 'stores-full': 409, 'stores-short': 409, 'market-own': 409, 'market-short': 409,
  'market-seller-frozen': 409,   // STAFF-PANEL5-FREEZE: a frozen seller's goods sell nothing while the freeze stands
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
  'market-piece-gone': 409,   // INT19: a crafted piece its seller's record does not hold
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

/** FIELD BUGS 2026-10-14 QUEST-HOME (Mac, 2026-10-15: "Close both"): AN ACT'S ANSWER THAT MOVED A HOME, WITH ITS ORDERS
 *  SIGNED in place of what it says (`moved`, src/net/homeLaw.js homeMoved) - `homeOrders`, each one town's
 *  (HOME_ORDER_KEYS_MAX buildings at most), which the acting client carries to the hub, whose fan reaches every page
 *  online: a quest never picks its residence in a house bought after a page's boot read, and one picked there and not yet
 *  reached is chosen again. A service with no key still acts, answering none: the pages read the move at their next
 *  boot (homes.js homeLayouts). */
async function homeOrdersOf(r, s, env, subtle, nowS) {
  const { moved, ...answer } = r ?? {};
  if (!Array.isArray(moved) || !moved.length) return answer;
  const key = await signingKey(env, subtle);
  if (!key) return answer;
  const homeOrders = [];
  for (const { mapId, on = [], off = [] } of moved) {
    const keys = [...on.map((k) => [k, 1]), ...off.map((k) => [k, 0])];
    for (let at = 0; at < keys.length; at += HOME_ORDER_KEYS_MAX) {
      const part = keys.slice(at, at + HOME_ORDER_KEYS_MAX);
      homeOrders.push(await mintHomeOrder({ s, bm: mapId, bu: part.filter(([, u]) => u).map(([k]) => k), bd: part.filter(([, u]) => !u).map(([k]) => k) }, key, { subtle, nowS }));
    }
  }
  return { ...answer, homeOrders };
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

/** A JSON object body within `max` bytes - or null (not a JSON object), or undefined (past the bound: AUDIT LEGACY III
 *  O2, which the line's route answers in its own word). Both refuse alike wherever a route asks only `!body`. */
async function readBody(request, max = MAX_BODY_BYTES) {
  const bytes = await readCapped(request, max);
  if (!bytes) return undefined;
  const text = new TextDecoder().decode(bytes);
  if (!text) return {};
  try { const v = JSON.parse(text); return v && typeof v === 'object' && !Array.isArray(v) ? v : null; } catch { return null; }
}

// SCALE1: THE SERVICE, and below it the handler workerd calls - which serves it and counts it (metrics.js). The
// service is a plain object, not an export: this module still exports `default` and nothing else.
const service = {
  /** SCALE4g: THE ANSWER CARRIES ITS SESSION'S NEWEST BOOKMARK (`x-d1-bookmark`, exposed to the page), so the tab's next
   *  read starts no older than everything this one saw and wrote - the routes `route` answers are untouched.
   *  AUDIT SCALE II A-3: `said` is what the route tells the metrics point (metrics.js measured) - a heartbeat's parts. */
  async fetch(request, env, said = { parts: '' }, exec = null) {
    const held = { session: null, said, exec, pass: null };
    const res = await service.route(request, env, held);
    let mark = null;
    try { mark = held.session?.getBookmark?.() ?? null; } catch { mark = null; }
    const marked = typeof mark === 'string' && D1_BOOKMARK_RE.test(mark);
    if (!marked && !held.pass) return res;
    const out = new Response(res.body, res);   // its status and headers, copied - a copy's headers may be set
    if (marked) { out.headers.set('x-d1-bookmark', mark); out.headers.append('access-control-expose-headers', 'x-d1-bookmark'); }
    if (held.pass) { out.headers.set(SESSION_PASS_HEADER, held.pass); out.headers.append('access-control-expose-headers', SESSION_PASS_HEADER); }   // SESSION-SIGN: the pass a lookup on a hot route minted
    return out;
  },
  async route(request, env, held = { session: null, said: { parts: '' }, pass: null }) {
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
          'access-control-allow-headers': 'content-type, authorization, x-realm-lease, x-realm-seq, x-realm-summary, x-d1-bookmark, if-none-match, x-session-pass, x-staff-session',   // REALM P1: a checkpoint's lease, sequence and tile; SCALE4g: the tab's D1 bookmark; POI-1: the feed version a game holds; SESSION-SIGN: the session's pass
          'access-control-max-age': '86400',
        },
      });
    }

    // SEAT2a part three: THE DEPLOY BLACKOUT'S QUESTION (Seats-Arc 17) - public, as the health is: whether any battle is
    // live or starts within thirty minutes, and the latest end among them. It names no guild.
    if (path === '/v1/seats/sieges/live') {
      if (request.method !== 'GET') return no('method', 405, origin);
      if (!env.DB) return no('no-database', 503, origin);
      try {
        return json(await siegesLive(env.DB, Math.floor(Date.now() / 1000)), 200, origin);
      } catch (e) {
        return thrown(path, e, origin);   // HOMES-SHED: above the try below, so its own
      }
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
    // GRANT3 (bible/11-Multiplayer/Spawn-Grants.md section 13): THE RELAY'S PUBLIC HALF, as openly - every reader checks a
    // spawn grant's signature with it, a guest's game too (the Elite Gates' `rk` rides /v1/eg/keys, a signed-in route a
    // guest's client never asks). It verifies the relay's signatures and mints nothing.
    if (path === '/v1/relaykey') {
      const rk = String(env.GATE_PUBLIC_KEY ?? '');
      return rk ? json({ rk }, 200, origin) : no('no-relay-key', 503, origin);
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
    const poiPath = poiPathOf(path);   // POI-1: the POI store's paths, matched the same way
    if (!ROUTES.has(path) && !slot && !realmSlot && !poiPath) return no('not-found', 404, origin);

    if (!env.DB) return no('no-database', 503, origin);
    // ADMIT-LINE (admit.js): A SIGN-IN TAKES ITS PLACE IN THE LINE before it costs the database a statement - the open
    // routes' address bucket is a D1 write of its own. Told its place, it is answered 503 `queue` with the place and the
    // wait (and Retry-After, in seconds); a gate that fails lets it in.
    if (ADMIT_ROUTES.has(path) && request.method === 'POST') {
      const queued = await admitWait(env, request.headers.get('cf-connecting-ip') || 'unknown');
      if (queued) {
        const res = json({ error: 'queue', position: queued.position, wait: queued.wait }, 503, origin);
        res.headers.set('retry-after', String(Math.ceil(queued.wait / 1000)));
        return res;
      }
    }
    // SCALE4d: the token's mint on one D1 session whose first statement (the session lookup) is the primary's and whose
    // reads after it a replica may serve - the reconnect wave's dozen reads a player off the one primary (service.js
    // REPLICA_ROUTES); every other route on the binding as before
    // SCALE4g: and the reads a tab keeps asking, each on the session of the bookmark it carries; the session is held so
    // the answer can carry its newest bookmark back (`fetch`, below)
    const db = routeDb(env.DB, path, request.method, d1BookmarkOf(request));
    if (db !== env.DB) held.session = db;
    const ctx = { db, primary: env.DB, subtle, rand, nowS };   // SCALE4g: `primary` the binding, for a read-then-store a session must not make (board.js)
    // BUSY-GATE (service.js shedding): A READ THIS ISOLATE SHEDS, having just met an overloaded database, is answered as
    // the overload is - before the session's lookup or any statement of its own
    if (shedding(path, request.method, Date.now())) return overloaded(origin);

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

      // GRANT2 (bible/11-Multiplayer/Spawn-Grants.md section 12): THE SPAWN GRANTS' MEASURE - a cell's window of asks,
      // posted by the relay and proven by its signature over the exact bytes (the chat feed's kind of door, grants.js)
      if (path === GRANT_FEED_PATH) {
        if (request.method !== 'POST') return no('method', 405, origin);
        const bytes = await readCapped(request, GRANT_MEASURE_MAX_BYTES);
        if (!bytes) return no('too-large', 413, origin);
        const r = await takeGrantMeasure(ctx, env, new Uint8Array(bytes), request.headers.get(GRANT_MEASURE_SIG_HEADER));
        return 'error' in r ? no(r.error, r.error === 'grant-signature' ? 401 : 400, origin) : json(r, 202, origin);
      }

      // STAFF-PANEL5-FEEDS (staffNet.js, staffReactions.js): THE RELAY'S TWO STAFF FEEDS - its players over a limit and the bot
      // check's episodes, each proven by its signature over the exact bytes (the grant feed's kind of door), never a session
      if (path === NET_FEED_PATH || path === REACTION_FEED_PATH) {
        if (request.method !== 'POST') return no('method', 405, origin);
        const bytes = await readCapped(request, STAFF_FEED_MAX_BYTES);
        if (!bytes) return no('too-large', 413, origin);
        const r = await (path === NET_FEED_PATH ? takeNetFeed : takeReactionFeed)(ctx, env, new Uint8Array(bytes), request.headers.get(STAFF_FEED_SIG_HEADER));
        return 'error' in r ? no(r.error, r.error === 'feed-signature' ? 401 : 400, origin) : json(r, 202, origin);
      }
      // STAFF-PANEL5-HIDDEN (staffHidden.js): A HIDDEN STAFF SUBJECT ENTERED A PRIVATE HOME - the relay's note, proven by its
      // signature over the exact bytes (the grants' measure's kind of door), written to the staff audit log
      if (path === HIDDEN_SEEN_PATH) {
        if (request.method !== 'POST') return no('method', 405, origin);
        const bytes = await readCapped(request, HIDDEN_SEEN_MAX_BYTES);
        if (!bytes) return no('too-large', 413, origin);
        const r = await takeHiddenSeen(ctx, env, new Uint8Array(bytes), request.headers.get(HIDDEN_SEEN_SIG_HEADER));
        return 'error' in r ? no(r.error, r.error === 'seen-signature' ? 401 : 400, origin) : json(r, 202, origin);
      }

      // SAFE5 + SAFE8: THE TWO DOORS THE CHAT'S SAFETY OPENS TO A STRANGER - the relay's feed and Discord's interactions.
      // Neither is JSON a session carries; each is proven by a signature over its exact bytes, checked before a byte is read.
      if (SAFE_OPEN_ROUTES.has(path)) {
        if (request.method !== 'POST') return no('method', 405, origin);
        const bytes = await readCapped(request, path === '/v1/mod/feed' ? FEED_MAX_BYTES : DISCORD_BODY_MAX);
        if (!bytes) return no('too-large', 413, origin);
        if (path === '/v1/mod/feed') {
          const r = await takeFeed(ctx, env, new Uint8Array(bytes), request.headers.get(FEED_SIG_HEADER));
          return 'error' in r ? no(r.error, r.error === 'feed-signature' ? 401 : 400, origin) : json(r, 202, origin);
        }
        if (!(await discordSigned(env, new Uint8Array(bytes), request.headers.get('x-signature-ed25519'), request.headers.get('x-signature-timestamp'), { subtle, nowS }))) return no('signature', 401, origin);
        let interaction = null;
        try { interaction = JSON.parse(new TextDecoder().decode(bytes)); } catch { interaction = null; }
        if (!interaction || typeof interaction !== 'object') return no('body', 400, origin);
        // AUDIT SAFE DISCORD-4: what may follow the answer (the order to the relay's door) waits on the Worker's waitUntil,
        // never on Discord's three seconds
        const exec = /** @type {any} */ (held).exec;
        return json(await discordInteraction(ctx, env, interaction, typeof exec?.waitUntil === 'function' ? { later: (p) => exec.waitUntil(p) } : {}), 200, origin);
      }

      // STAFF-PANEL1 (staff.js): THE STAFF PANEL'S DOORS. None takes a game session - a game secret opens no staff door and a
      // staff token no game door - so they are answered here, before the ladder resolves one.
      if (STAFF_ROUTES.has(path)) {
        if (request.method !== 'POST') return no('method', 405, origin);
        const body = await readBody(request);
        if (!body) return no('body', 400, origin);
        const exec = /** @type {any} */ (held).exec;   // the refusal audit's write follows the answer (staff.js `refused`)
        const r = await staffRoute(typeof exec?.waitUntil === 'function' ? { ...ctx, later: (/** @type {Promise<any>} */ p) => exec.waitUntil(p) } : ctx, env, path, body, { ip: request.headers.get('cf-connecting-ip') || 'unknown', token: request.headers.get(STAFF_SESSION_HEADER) });
        return 'error' in r ? no(r.error, STAFF_STATUS[/** @type {keyof typeof STAFF_STATUS} */ (r.error)] ?? 400, origin) : json(r, 200, origin);
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
          // AUDIT SAFE SERVICE-7: a banned account, its password right, is told its ban (bannedAnswer's shape) - no session
          if (r.error === 'banned') return json(r, 403, origin);
          return r.error ? no(r.error, r.error === 'rate' ? 429 : 401, origin) : json(r, 200, origin);
        }
        // /v1/auth/recover
        const r = await recover(ctx, { handle: body.handle, code: body.code, password: body.password, set: body.set === true });   // RECOVERY-SET: a set for a build that asks
        if (r.error === 'banned') return json(r, 403, origin);   // AUDIT SAFE SERVICE-7: the code unspent, no session
        return r.error ? no(r.error, r.error === 'rate' ? 429 : r.error === 'codes-moved' ? 409 : 401, origin) : json(r, 200, origin);   // AUDIT RECOVERY-SET A4
      }

      // EVERY ROUTE BELOW NEEDS A SECRET, and resolving it is the same
      // one indexed lookup every time.
      // REALM P2.1: a trade's half carries two offers of up to sixteen records each - a JSON route past 4 KiB. AUDIT LEGACY
      // III O2/P1: and a line's record, to its own bound (legacy.js LINEAGE_BODY_MAX) - read at 4 KiB, a played founder's
      // first save was refused, and the realm held the founding copy for good
      // PRIVATE-REPORT: and a report's words, to theirs (reportLaw.js REPORT_BODY_BYTES). LOST-SPOILS: and a floor's leftovers,
      // to theirs (lostLaw.js LOST_BODY_MAX - the largest spoils send past 4 KiB)
      const body = request.method === 'POST'
        ? await readBody(request, path === '/v1/realm/lineage' ? LINEAGE_BODY_MAX : path === '/v1/realm/trade' ? REALM_TRADE_BODY_MAX : path === '/v1/homes/decor/batch' ? DECOR_BATCH_BYTES : path === '/v1/safety/report' ? REPORT_BODY_MAX : path === '/v1/report/send' ? REPORT_BODY_BYTES : path === '/v1/post/lost' ? LOST_BODY_MAX : MAX_BODY_BYTES) : {};   // SAFE3: a report's stamped lines; DECOR-BATCH: a home's Confirm; LOST-SPOILS
      if (body === undefined && path === '/v1/realm/lineage') return no('lineage-too-large', 413, origin);
      if (body === undefined && path === '/v1/homes/decor/batch') return no('too-large', 413, origin);   // DECOR-BATCH: past 128 KiB, before a session is read
      if (!body) return no('body', 400, origin);
      // YARD-SHED (2026-10-06, the service down - "D1 DB is overloaded. Requests queued for too long."): A TOWN'S YARDS NEED
      // NO SESSION. Its answer is every caller's alike, any guest's to read (decor.js yardsKept), and the two reads a
      // session costs were most of the database's day - so it is answered here, from the isolate's kept answer, bounded
      // per address in this isolate's memory as a session's door is per account (no write to count it).
      if (path === '/v1/homes/yards' && request.method === 'POST') {
        const ip = request.headers.get('cf-connecting-ip') || 'unknown';
        if (overAccountRate(`yards:${ip}`, nowS, ACCOUNT_MAX, ACCOUNT_WINDOW_S)) return no('rate', 429, origin);
        const r = await yardsKept(ctx, body.mapId, nowS);
        return 'error' in r ? no(r.error, 400, origin) : json(r, 200, origin);
      }
      // POI-1: THE LIVE FEED AND A LIVE ASSET NEED NO SESSION - what every approved POI is, and the bytes it names, are
      // every player's to read, the game's included (poi.js). Bounded per address in this isolate's memory, as the yards
      // are; the feed kept in the isolate and answered 304 to a game that already holds its version; an asset by its
      // hash, cached a day (AUDIT POI S4: it can stop being public). An asset no live POI names falls through to a builder's session below.
      if (poiPath && request.method === 'GET' && (poiPath.route === 'live' || poiPath.route === 'asset')) {
        const ip = request.headers.get('cf-connecting-ip') || 'unknown';
        if (overAccountRate(`poi:${ip}`, nowS, POI_OPEN_MAX, ACCOUNT_WINDOW_S)) return no('rate', 429, origin);
        // AUDIT POI S11: the version the game holds, read strong or weak - newer than this isolate's kept feed, the version is asked now
        const held = poiPath.route === 'live' ? poiHeldVersion(request.headers.get('if-none-match')) : -1;
        const feed = await poiLiveFeed(env.DB, Date.now(), held);
        if (poiPath.route === 'live') {
          const etag = poiFeedTag(feed.v);
          const headers = { 'access-control-allow-origin': origin, 'access-control-expose-headers': 'etag', etag, 'cache-control': 'public, max-age=30' };
          if (held === feed.v) return new Response(null, { status: 304, headers });
          return new Response(feed.body, { status: 200, headers: { ...headers, 'content-type': 'application/json; charset=utf-8' } });
        }
        if (feed.live.has(poiPath.sha) || !request.headers.get('authorization')) {
          const r = await getPoiAsset({ ...ctx, db: env.DB, bucket: env.SAVES }, poiPath.sha, { builder: false });
          return 'error' in r ? no(r.error, r.error === 'no-storage' ? 503 : 404, origin) : poiAssetResponse(r, origin);
        }
      }
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
      // SESSION-SIGN (sessionPass.js; bible/11-Multiplayer/Scale-Arc.md THE PLAN PAST 1,000, decision 4): A HOT ROUTE
      // BELIEVES ITS PASS - who the lookup found, signed for five minutes and bound to this secret - and asks the lookup
      // only for one it cannot believe, minting the next beside its answer
      const hot = passRoute(path, request.method) ? await passKey(env, subtle) : null;
      const who = (hot && await readPass(hot, request.headers.get(SESSION_PASS_HEADER), secret, nowS, subtle)) || await resolveSession(ctx, secret);
      if (!who) return no('auth', 401, origin);
      // SAFE4: A BANNED ACCOUNT ACTS IN NOTHING - no token (so no room), no save, no trade - and is told until when, and why,
      // on every door; it may still sign out
      // STAFF-PANEL5-FREEZE (staffFreeze.js; design doc Weak spots: "Freeze blocks only some routes"): ONE FREEZE GATE BESIDE
      // THE BAN'S (asked first, so a banned account hears its ban) - a frozen account opens nothing but signing out, its own account, the realm doors that load the character it
      // looks around as, its relay token and the staff chat. Refused here, it is minted no pass; under a pass minted before
      // the freeze, the checkpoint and the beat ask it in their own statements (realm.js, accounts.js creditPlay)
      const frozen = !isBanned(who.player, nowS) && freezeRefusal(path, request.method === 'GET' && !!realmSlot, who.player, nowS);
      if (frozen) return json(frozen, 403, origin);
      if (isBanned(who.player, nowS) && path !== '/v1/auth/logout') return json(bannedAnswer(who.player), 403, origin);
      // SESSION-SIGN: the next pass, after the ban (a banned account pays its lookup - AUDIT PLAN-1000 E6) and off the
      // primary's own answer alone (a replica's may stand before a sign-out - E5)
      if (hot && !('pass' in who) && passMintable(db, env.DB)) held.pass = await mintPass(hot, who, secret, nowS, subtle);

      // AUDIT LEGACY III O12: A TOMBSTONE ACTS IN NOTHING. Every act a character does names it as the body's
      // `character` - the professions, the Stores, the writs, the market, Renown, the guilds - and a fallen Bloodline
      // character (an Enduring elder retired) is never played again (legacy.js), yet only the guilds' door asked (O5): a
      // request naming the dead read its Stores and withdrew them into its heir's pack, and wrote its tracks after its
      // death. Asked here, once, before any route - but the token's mint, which is no act: it vouches for the account,
      // and mints a tombstone no realm character (REALM-DOOR's `rc` 0, no house, no `ci`), which the relay's door refuses;
      // a page under its death screen still mints for the hub it stands in.
      // PRIMARY-FOLD (bible/11-Multiplayer/Scale-Arc.md THE PLAN PAST 1,000): the door's reads - the tombstone of a body's
      // `character`, and a progression claim's seat and its stream's bucket - in one trip (door.js doorReads), answered in
      // the order each was asked on its own
      const progressRoute = request.method === 'POST' ? PROGRESS_ROUTES[/** @type {keyof typeof PROGRESS_ROUTES} */ (path)] : undefined;
      // AUDIT PLAN-1000 C4: a claim the account's rate will refuse (asked without counting - the count is the door's below,
      // after the tombstone, as ever) asks the tombstone alone
      const claimed = progressRoute && !accountRateFull(who.player.id, nowS, ACCOUNT_MAX, ACCOUNT_WINDOW_S) ? progressRoute[0] : null;
      const door = await doorReads(db, who.player.id, { tomb: path !== '/v1/auth/token' && typeof body.character === 'string' ? body.character : null, stream: claimed });
      if (door.dead) return no('dead', 410, origin);

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

      // INT16 (bible/06-Systems/Integrity-Arc.md section 7): A PROGRESSION CLAIM IS ITS SEAT'S - Renown, a raid's cleanse, a
      // camp, the Watch, a silver find, a profession's XP (progress.js PROGRESS_ROUTES) asked of the account's realm character
      // holding its lease, never one the judge holds, before any route reads a word of it. INT17: and once staff enforce the
      // line, a stream whose bucket play has not refilled is refused, and a Renown report asks no more than the bucket holds.
      if (progressRoute) {
        const [stream, named] = progressRoute;
        // AUDIT PLAN-1000 F1: a claim the rate's peek found full and its count let through (the window turned between the two,
        // another request of the account opening the next) asked no seat at the door - it asks now, as the door would have
        const read = door.seat === undefined ? await doorReads(db, who.player.id, { tomb: null, stream }) : door;
        const seat = seatRefusalOf(read.seat, { named, character: body.character });   // PRIMARY-FOLD: the door's read of the seat
        if (seat) return json(seat, 403, origin);
        const line = await progressConfig(db);
        if (line.enforce) {
          const room = await progressRoom(db, who.player.id, stream, line, read.bucket);   // PRIMARY-FOLD: and of the bucket
          if (room < 1) return no('progress-play', 429, origin);
          if (stream === 'renown' && Number.isSafeInteger(body.xp)) body.xp = Math.min(body.xp, room);
        }
      }

      // ARENA4: THE ARENA'S HONOURS ON THE ROW, where a badge is minted or a wardrobe read - the Grand Champion's row, the
      // season's #1 (server-account/src/arena.js arenaHonoursOf) - so titles.js derives `grandchampion`, `arenachampion`
      // and the laurel from the arena's rows as it derives the founder from a date. Only on the doors that read a badge.
      // AUDIT SCALE4d A1: ON THE BINDING, never the mint's replica session - a #1 found stale is COUNTED AGAIN AND WRITTEN
      // (arena.js championNow -> storeArenaChampion, iliac.js the same): counted off a replica as new as the session lookup,
      // the write put back a #1 a rated bout had just moved past, and the clock only re-stamps a kept #1
      const honoursCtx = { ...ctx, db: env.DB };
      // CARDS10: and Iliac Hand's season #1 (iliac.js), on the same doors; KG6: and The King's Gambit's (gambit.js);
      // SIGN-BATCH: the three games' reads in ONE batch (honours.js withHonours), each answered as its with*Honours answers; EG-E2: and
      // the Spire Champions - the last season's Descent's top tens (egHonours.js), read beside them
      if (ARENA_HONOUR_PATHS.has(path)) who.player = await withEgHonours(honoursCtx, await withHonours(honoursCtx, who.player, nowS), nowS);

      if (path === '/v1/auth/token' && request.method === 'POST') {
        const key = await signingKey(env, subtle);
        // A service with no key can still hand out accounts; it just
        // cannot vouch for them. Said plainly rather than by minting
        // something the relay will refuse.
        if (!key) return no('no-signing-key', 503, origin);
        // STAFF-PANEL5-HIDDEN (staffHidden.js): A HIDDEN STAFF MEMBER'S TOKEN IS THE SPECTATOR'S - `hd`, a subject of their
        // staff session's and no badge, written in the staff audit log - while an Admin or a Moderator holds a live staff
        // session with Hide me on. Every other account reads nothing more here.
        const hidden = await hiddenToken(ctx, env, who.player, key);
        if (hidden) return hidden.error ? no(hidden.error, 409, origin) : json(hidden, 200, origin);   // STAFF-PANEL5-HIDDEN-FIX: a lapsed hidden session mints nothing, never a visible token
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
        const worn = await withChapterTitles(ctx, seats ? { ...who.player, seatTitles: await seatTitlesOf(ctx.db, who.player.id) } : who.player, env);   // CHAP4c: and a chapter's
        const zero = seasonZeroOf(env.SEASON_ZERO_WEEK);   // SEASON1: the Season on a title's claim
        // SCALE4f part two: THE CHARACTER'S MEMBERSHIP READ ONCE (guilds.js mintMemberOf) for the seat badge, the ribbon and the
        // guild's badge below - three reads of one row; each keeps its own law over it
        const member = renownCharacterOk(body.character) && (seats || body.guild === true) ? await mintMemberOf(ctx, who.player.id, body.character) : undefined;
        const seatBadge = seats && renownCharacterOk(body.character) ? await seatBadgeOf(ctx.db, who.player.id, body.character, seasonOf(seatWeekOf(nowS * 1000), zero)?.n ?? 0, member) : null;
        const wornT = titleWorn(worn, env);
        // CROWN1 part two: the champion's is the account's own, kept for good - no guildmaster's; SEASON1: and so are a
        // Season's crowned and keeper (seatRoyal.js keptTitleOf)
        const kept = seats && KEPT_TITLES.includes(wornT) ? await keptTitleOf(ctx.db, who.player.id, wornT, zero) : null;
        // CHAP4c: a chapter's seat's title worn only by a character of the account that holds it, with its claim - the
        // named character's own first, else none (a title a character does not hold is not signed for it)
        const chapterT = CHAPTER_TITLES.includes(wornT) && renownCharacterOk(body.character)
          ? (await chapterTitlesOfAccount(ctx.db, who.player.id, nowS, zero, body.character)).find((t) => t.title === wornT) ?? null : null;
        const seatT = KEPT_TITLES.includes(wornT) ? (kept ? { t: wornT, ts: kept.ts } : {})
          : SEAT_TITLES.includes(wornT) ? (seatBadge?.title === wornT ? { t: wornT, ts: seatBadge.ts } : {})
            : CHAPTER_TITLES.includes(wornT) ? (chapterT ? { t: chapterT.high ? 'highmaster' : wornT, ts: chapterT.ts } : {}) : (wornT ? { t: wornT } : {});   // CHAP6e: a Master's in an Ascendancy signed its High Master
        // SEASON1 part two (Seats-Arc 9.1): AND A SEASON'S BANNER RIBBON - the named character's, where its guild kept a
        // seat through the Season before and it was a member at that Season's last Turning (seatRibbons.js ribbonOf)
        const rb = seats && renownCharacterOk(body.character) ? await ribbonOf(ctx.db, who.player.id, body.character, seasonOf(seatWeekOf(nowS * 1000), zero), member) : null;
        const wardrobe = {
          ...seatT,
          g: [...glyphsOf(who.player, env, nowS), ...(seatBadge?.glyphs ?? [])],
          au: auraWorn(who.player, env),   // WB9g: the aura worn, the title's law - absent for none; AEGIS: a list's read off the config
          pi: iconWorn(who.player),   // WITCH1: the profile icon worn, the aura's law - absent for none (the character's face)
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
        // STAFF-PANEL5-FREEZE: AND A FREEZE, the mute's law (design doc Weak spots: "A reload sheds a freeze") - only while it
        // stands, so an unfrozen player mints the bytes they always did
        const fz = isFrozen(who.player, nowS) ? who.player.frozen_until : undefined;
        // RENOWN1: AND THE LEVEL, when the client names the character it is
        // bringing online - that character's, derived from its track now
        // (1 for a character that has earned nothing yet). The client's
        // word is only WHICH of its own characters; the number is this
        // service's. A mint naming none (an older build) carries none.
        // (RENOWN-CHAR: the named character's again - RENOWN-ACCOUNT read
        // the account's one track whichever was named.)
        // RENOWN4: and the track's TOTAL beside it in the answer (never in the token - a room needs the level, not the
        // XP): the page's own bar is drawn from it the moment the character comes online (ui/hud/hudRenown.js).
        const track = renownCharacterOk(body.character) ? ((await renownTrackOf(ctx, who.player.id, body.character)) ?? { xp: 0, level: 1 }) : null;
        const lv = track ? track.level : undefined;
        // GUILD1c: AND THE GUILD, the named character's - its id, its tag and its member row off the roster as it
        // stands now - so a room reads the tag beside the name off the signature, and routes the guild's chat to its
        // own members alone. The client never says which guild; a mint naming no character carries none.
        // AUDIT MERGE-PLUS A6: AND ONLY A MINT THAT ASKS (`guild: true`). A build from before GUILD1c names its character
        // too (RENOWN1), and a token wearing a guild is what the hub routes the guild's lines to - that build knows no
        // guild channel and filed them on its World tab, where a reply goes to everyone. It wears no guild instead.
        const guild = renownCharacterOk(body.character) && body.guild === true ? await guildBadgeOf(ctx, who.player.id, body.character, member) : null;
        // REALM-DOOR (2026-09-29, the field): AND WHETHER THAT CHARACTER IS THE REALM'S. A realm-era tab goes online only
        // as a realm character and names it here; a build from before the realm names its offline character, or none.
        // The relay refuses a 0 at its door, so online is the realm's at the servers too. Stamped on every mint, a 0
        // included: a token with no `rc` is a service from before this, which the relay still admits.
        // SCALE4f: THE FOUR READS OF ITS ROW IN ONE (realm.js realmMintFacts) - whether it is the realm's, its level, its arms
        // and its house, each exactly as its own read answered it
        const facts = await realmMintFacts(ctx, who.player.id, body.character);
        const rc = facts.rc;
        // ARENA4b: AND THAT REALM CHARACTER'S LEVEL, `cl` - the level on its tile (realm.js realmMintFacts: INT7 - the level
        // its judge trusts, else its summary, 1..1000), which the relay reads (a bout's vitality) as it reads `lv`. Absent for any
        // other character, none named, or a level out of the claim's bounds - a token without it is a token as before.
        const cl = facts.cl;
        // INT7: AND THAT REALM CHARACTER'S ARMS, `wa` - the most reach of its judged pack's lawful weapons and its bow
        // (realm.js realmMintFacts), every referee's clip of a blow between players. Absent before its first judged checkpoint.
        const wa = facts.wa;
        // ARENA4: AND THE ACCOUNT'S ARENA RATING this season, for a registered account - the hall queues by it (net/arena/arenaLaw.js
        // pairQueue), off the signature, never a word of the client's. A guest's token carries none (a guest is not queued).
        const ar = who.player.handle ? (await arenaRatingOf(ctx, who.player.id, arenaSeasonOf(nowS))).rating : undefined;
        // LEGACY7 part two: AND THAT REALM CHARACTER'S HOUSE (realm.js realmMintFacts, by legacy.js houseOn: its line's
        // surname, its given name, a Bloodline's mark, the generation's numeral) - off the line the service holds, never a
        // word of the client's
        const house = facts.house;
        // NAME-AS (2026-10-12): AND THE NAME THE ROOM READS - the account's, or, where the account chose its character's,
        // that realm character's own (`facts.name`, off the same read), where the wire can carry it and it is no other
        // account's username (accounts.js wornNameOf). Never a word of the request: the body names WHICH character, as it
        // always did, and its name is the row's.
        const nameWorn = await wornNameOf(ctx, who.player, facts.name);
        // AUDIT LEGACY III O1: AND WHICH REALM CHARACTER (`ci`, beside a 1 alone) - the relay stamps it on a wedding's frames,
        // so each half names the character its player saw. Kept when a house is left unsaid: the widest token without a
        // house is under TOKEN_MAX_CHARS with it (test/auditlegacy3)
        const signed = { s: who.player.id, n: nameWorn.name, k: accountKind(who.player), ...wardrobe, mu, lv, ...(guild ?? {}), rc, ...(rc ? { ci: body.character } : {}), ...(ar !== undefined ? { ar } : {}), ...(cl != null ? { cl } : {}), ...(wa ? { wa } : {}), ...(fz ? { fz } : {}) };
        let token = await mintToken(house ? { ...signed, ...house } : signed, key, { subtle, nowS });
        // the token's own bounds (identityToken.js TOKEN_MAX_CHARS, and AUDIT LEGACY III O11 the relay hello's TOKEN_BODY_MAX):
        // a house that would take it past either is left unsaid, never the rest
        let houseWorn = house;
        if (house && (token.length > TOKEN_MAX_CHARS || tokenBodyOf(token).length > TOKEN_BODY_MAX)) { token = await mintToken(signed, key, { subtle, nowS }); houseWorn = null; }
        return json({
          token,
          name: nameWorn.name,   // NAME-AS: the name the token signs - the room's, which the live sessions take in (NAME-ADOPT)
          accountName: displayName(who.player),   // NAME-AS: and the account's own, which the device's stored session keeps (the profile mark's)
          nameAs: nameAsOf(who.player),   // NAME-AS: the choice the name was signed under
          ...(nameWorn.why ? { nameWhy: nameWorn.why, ...(nameWorn.word ? { nameWord: nameWorn.word } : {}) } : {}),   // NAME-AS: why the character's name stood aside, absent where it did not
          kind: accountKind(who.player),
          title: wardrobe.t ?? null,
          ...(wardrobe.ts ? { ts: wardrobe.ts } : {}),   // SEAT1c: a seat title's claim, the client's to word
          glyphs: wardrobe.g,
          ...(wardrobe.gx ? { glyphsOff: wardrobe.gx } : {}),   // GLYPH-WEAR: the ones my own name leaves out, absent for none
          mutedUntil: mu ?? 0,
          frozenUntil: fz ?? 0,   // STAFF-PANEL5-FREEZE: the freeze the token carries - the game's freeze screen (net/staffChat.js)
          conduct: conductAgreed(who.player),   // SAFE7: whether the code of conduct as it stands is agreed - the client asks before a first line when not
          level: lv ?? null,
          xp: track ? track.xp : null,
          guild: guild ? guild.gt : null,   // GUILD1c: the tag my own name wears, beside the token as the level is
          aura: wardrobe.au ?? null,   // WB9g: the aura at my own feet, beside the token as the title is
          icon: wardrobe.pi ?? null,   // WITCH1: the profile icon in my own portrait well, beside the token as the aura is
          ribbon: wardrobe.rb ?? null,   // SEASON1 part two: the ribbon under my own name, beside the token as the aura is
          house: houseWorn ?? null,   // LEGACY7: the house my token wears, beside it as the ribbon is
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
          account: { ...accountView(who.player, nowS), duels: await duelRecordOf(ctx, who.player.id), gates: await gateRecordOf(ctx, who.player.id), raids: await raidRecordOf(ctx, who.player.id), serpents: await serpentRecordOf(ctx, who.player.id), sds: await sdRecordOf(ctx, who.player.id), stars: await starRecordOf(ctx, who.player.id), ketch: await ketchRecordOf(ctx, who.player.id), renown: await renownTracksOf(ctx, who.player.id), marks: await marksCardOf(ctx, who.player, env) },
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
        // DUEL1's LOSER'S OWN REPORT - INT8: RETIRED. A duel's result is the relay's signed receipt now (below); a loss a
        // client reports counts for nothing, and is told so.
        return no('retired', 410, origin);
      }

      if (path === '/v1/duel/claim' && request.method === 'POST') {
        // INT8 (bible/06-Systems/Integrity-Arc.md lane 2): A DUEL'S RESULT, THE RELAY'S - either fighter carries the receipt
        // the referee handed it (src/net/duel/duelReceipt.js `d1`); the session must be one of its two, never the body's word,
        // and accounts.js `claimDuel` counts it once (its bout's id) inside its bounds. No public half here yet: 503, and
        // the client keeps the receipt for its day.
        const r = await claimDuel(ctx, who.player, body.receipt, await gatePublicKey(env, subtle));
        if (r.error) return json({ error: r.error, ...(r.why ? { why: r.why } : {}) }, r.error === 'no-gate-key' ? 503 : r.error === 'not-yours' ? 403 : 400, origin);   // AUDIT WB A5's law: which rung refused it
        return json(r, 200, origin);
      }

      if (path === '/v1/wild/fall' && request.method === 'POST') {
        // INT9 (bible/06-Systems/Integrity-Arc.md lane 2): A DEATH IN THE OPEN ZONE'S DROP, TAKEN OFF THE FALLEN'S JUDGED
        // RECORD (wild.js `wildFall`) - against the fall the relay signed (src/net/wild/wildReceipt.js `f1`: the fallen's own tab
        // with its record's `at`, its killer's after the grace), or none (a death to a foe - refused `foe`, FOE-KEEPS). The
        // answer's `order` is the service's word on the records, the room's to keep a deposit on.
        const r = await wildFall({ ...ctx, bucket: env.SAVES }, who.player, body, { gateKey: body.receipt !== undefined ? await gatePublicKey(env, subtle) : null, signing: await signingKey(env, subtle) });
        if (!('error' in r)) return json(r, 200, origin);
        if (r.error === 'seq') return json({ error: 'seq', seq: r.seq }, 409, origin);   // the record moved: its tab checkpoints and asks again
        return json({ error: r.error, ...(r.why ? { why: r.why } : {}) }, WILD_STATUS[r.error] ?? REALM_STATUS[r.error] ?? 400, origin);
      }

      if ((path === '/v1/wild/collect' || path === '/v1/wild/reclaim' || path === '/v1/wild/escrows') && request.method === 'POST') {
        // MAC'S DECISION (2026-10-14, the two-phase handoff - wild.js): the killer's worn piece the fall put in ESCROW -
        // collected into the killer's record against the room's signed collect (`g1`, the gate's key), taken back into the
        // fallen's once its killer could no longer collect it, or listed for the fallen's tab
        const wctx = { ...ctx, bucket: env.SAVES };
        const r = path === '/v1/wild/collect' ? await wildCollect(wctx, who.player, body, { gateKey: await gatePublicKey(env, subtle) })
          : path === '/v1/wild/reclaim' ? await wildReclaim(wctx, who.player, body) : await wildEscrows(wctx, who.player, body);
        if (!('error' in r)) return json(r, 200, origin);
        if (r.error === 'seq') return json({ error: 'seq', seq: r.seq }, 409, origin);
        return json({ error: r.error, ...(r.why ? { why: r.why } : {}), ...(Number.isSafeInteger(r.wait) ? { wait: r.wait } : {}) }, WILD_STATUS[r.error] ?? REALM_STATUS[r.error] ?? 400, origin);
      }

      if ((path === '/v1/sea/wreck' || path === '/v1/sea/prize/collect' || path === '/v1/sea/prize/reclaim') && request.method === 'POST') {
        // SHIP-PVP (2026-10-22, bible/03-World/Eltheric-Ocean.md SHIP-PVP): a ship wrecked at another captain's guns, against
        // the wreck the relay signed (src/net/wild/wildReceipt.js `n1`, the gate's key: her captain's own tab with its
        // record's `at`, her killer's after the grace) - boarded, her hold's share held for her killer; and the prizes
        // collected by the killer's character, or reclaimed by her captain's once its killer left them (seaWreck.js)
        const sctx = { ...ctx, bucket: env.SAVES };
        const r = path === '/v1/sea/wreck' ? await seaWreck(sctx, who.player, body, { gateKey: await gatePublicKey(env, subtle) })
          : path === '/v1/sea/prize/collect' ? await seaPrizeCollect(sctx, who.player, body) : await seaPrizeReclaim(sctx, who.player, body);
        if (!('error' in r)) return json(r, 200, origin);
        if (r.error === 'seq') return json({ error: 'seq', seq: r.seq }, 409, origin);
        return json({ error: r.error, ...(r.why ? { why: r.why } : {}) }, WILD_STATUS[r.error] ?? REALM_STATUS[r.error] ?? 400, origin);
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
        return json({ id: body.id, ...(await duelRecordOf(ctx, body.id)), gates: await gateRecordOf(ctx, body.id), raids: await raidRecordOf(ctx, body.id), serpents: await serpentRecordOf(ctx, body.id), sds: await sdRecordOf(ctx, body.id), stars: await starRecordOf(ctx, body.id), ketch: await ketchRecordOf(ctx, body.id) }, 200, origin);   // RAID4: and the towns defended; SERPENT1: and the serpents slain; SD9b: and the Hours broken; STAR7: and the fallen stars held; KETCH: and the voyages sailed
      }

      if (path === '/v1/gate/claim' && request.method === 'POST') {
        // WB5b: THE ACCOUNT THE RECEIPT NAMES CARRIES IT HERE. The
        // relay signed it at the kill (src/net/gate/gateReceipt.js); the
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
          weir: egGateWeir(ctx, who.player),   // AUDIT EG IV (lane3 #16): the Weir Key's roll in the claim's own batch (eg.js)
        });
        // AUDIT WB A5: a refused receipt says WHICH rung refused it - the client keeps one the service can mend (its key
        // not the relay's pair, a clock) and lets go of one it cannot
        if (r.error) return json({ error: r.error, ...(r.why ? { why: r.why } : {}) }, r.error === 'no-gate-key' ? 503 : r.error === 'not-yours' ? 403 : 400, origin);
        if (r.recorded === true) await grantSpoils(ctx.db, who.player.id, portentPieces(r.portent));   // INT5: a signed win's spoils, the budget's fill - AUDIT WB14 (WIRE-6): and a portent night's pieces
        // MARKS1: THE FIRST FAUCET - a receipt that made its row strikes the gate's Marks, in the row's own batch
        // (marks.js gateStrikeStatement: 50 under SILVER-WAYS' day's combat cap with the raids', the gate's own day its
        // line's id); `marks` null where Marks are not this account's
        const answer = { ...r };
        delete answer.day; delete answer.struck; delete answer.deedStruck; delete answer.weirRow; delete answer.portent;   // the service's own: the line's day and whether the batch struck (AUDIT EG IV: and the key's row; AUDIT WB14: the receipt's portents, the fill's)
        if (r.recorded && !r.rite && r.deedStruck !== undefined) answer.deed = await deedAnswer(db, who.player, deedEvent('gate', r.day), r.deedStruck);   // SILVER-WAYS: where a deed was this claim's to try
        // SEAT1b (Seats-Arc 4.2): a kill recorded now is influence for the account's war-guild where it pledged in the
        // region the claim named (`seat` the answer: counted, or why not - the kill stands either way). WB12d: the rite
        // alone is no kill, and is no influence
        if (r.recorded && !r.rite && body.region != null) answer.seat = await creditGate(ctx, who.player, env, { character: body.character ?? null, day: r.day, region: body.region });
        // CHAP2b (Chapters-Arc 3.3, 4): and the guilds the character is a member of on its Roll that keep a chapter there
        // remember it (npcReceipts.js - after the kill's row, never instead of it)
        if (r.recorded && !r.rite && body.region != null) answer.chapters = await creditReceipt(ctx, who.player, env, { character: body.character ?? null, kind: 'gate', id: r.day, region: body.region });
        // EG-PLAY: a recorded breach closed rolls a Weir Key - the service's own die; AUDIT EG IV (lane3 #16): in the claim's
        // own batch, the first decided by the row it wrote (eg.js egGateWeir), its row said here
        if (r.recorded && !r.rite) answer.weir = egGateWeirAnswer(r.weirRow);
        return json(r.recorded && !r.rite ? { ...answer, marks: await gateStrikeAnswer(ctx, who.player, env, !!r.struck, r.day) } : answer, 200, origin);   // AUDIT WB12d (A2): the rite alone strikes no Drakes, and says none
      }

      if (path === '/v1/raid/claim' && request.method === 'POST') {
        // RAID4: THE ACCOUNT A RAID'S RECEIPT NAMES CARRIES IT HERE, with the character that fought it. The relay signed
        // it at the cleanse (src/net/raid/raidReceipt.js); the session says who is asking, never the body, and raids.js
        // `claimRaid` holds the rest - the signature, the account, one row a (raid, account), the day's bound, the
        // Renown (RENOWN-CHAR: the fighting character's again). A level that ROSE comes back with a signed order, as a
        // Renown report's does.
        // SILVER-WAYS: the town's silver (30, under the day's combat cap), the guild's deed and the guild contracts the
        // raid's region posts, each in the claim's own batch and by its own row (raids.js)
        const r = await claimRaid(ctx, who.player, { receipt: body.receipt, character: body.character, name: body.name ?? null, cid: body.cid ?? null }, await gatePublicKey(env, subtle), {   // AUDIT RAID R4: `cid` - the device's claim, which the town's thanks are keyed to
          strike: (key, nonce) => raidStrikeStatement(ctx, who.player, env, key, nonce),
          deeds: (key, nonce, character) => deedStatements(ctx, who.player, env, { kind: 'raid', event: deedEvent('raid', key), character, guard: [key, nonce] }),
          contracts: (key, nonce) => contractPayStatements(ctx, who.player, env, { key, nonce }),
          econ: (key, nonce) => raidActStatements(ctx.db, who.player, nowS, key, nonce),   // TOWN-ECON TE2: the town driven clear of it
        });
        if (r.error) return json({ error: r.error, ...(r.why ? { why: r.why } : {}) }, r.error === 'no-gate-key' ? 503 : r.error === 'not-yours' ? 403 : 400, origin);
        if (r.recorded === true) await grantSpoils(ctx.db, who.player.id);   // INT5: a signed win's spoils, the budget's fill
        await progressSpent(ctx, who.player.id, path, r);   // INT17: a cleanse, and the Renown it paid
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
          // CHAP2b: the town defended, remembered by the character's guilds that keep a chapter in its region (the key's)
          answer.chapters = await creditReceipt(ctx, who.player, env, { character: body.character ?? null, kind: 'raid', id: r.key, region: contractRegionOfRaid(r.key) });
        }
        return json({ ...answer, order }, 200, origin);
      }

      if (path === '/v1/star/claim' && request.method === 'POST') {
        // STAR7: A FALLEN STAR'S RECEIPT, CARRIED HERE BY THE ACCOUNT IT NAMES, with the character that fought it. The relay
        // signed it at the master's fall (src/net/starfall/starReceipt.js); the session says who is asking, never the body,
        // and stars.js `claimStar` holds the rest - the signature, the account, one row a (star, account), the day's bound,
        // the Renown, the device's spoils, and its silver under the day's combat cap (marks.js starStrikeStatement). A
        // level that ROSE comes back with a signed order, as a raid's does.
        // AUDIT STARFALL B3: INT5's fill rides the claim's own batch (stars.js - budget.js spoilsGrantStatement), never after
        // it: an answer lost past the batch is retried as `claimed`, and the fill was lost with it. What runs below is no
        // credit: INT17's measure (a debit a lost answer only spares), the order (signed again for a `claimed` that is the
        // device's own - stars.js `own`), the silver's answer (struck in the batch)
        const r = await claimStar(ctx, who.player, { receipt: body.receipt, character: body.character, name: body.name ?? null, cid: body.cid ?? null }, await gatePublicKey(env, subtle), {
          strike: (key, nonce) => starStrikeStatement(ctx, who.player, env, key, nonce),
        });
        if (r.error) return json({ error: r.error, ...(r.why ? { why: r.why } : {}) }, r.error === 'no-gate-key' ? 503 : r.error === 'not-yours' ? 403 : 400, origin);
        await progressSpent(ctx, who.player.id, path, r);   // INT17: the Renown it paid
        let order = null;
        if (r.renown?.rose) {
          const key = await signingKey(env, subtle);
          if (key) order = await mintRenownOrder({ s: who.player.id, lv: r.renown.level }, key, { subtle, nowS });
        }
        const answer = { ...r };
        delete answer.key; delete answer.struck;   // the service's own
        if (r.recorded) {
          const marks = await combatStrikeAnswer(ctx, who.player, env, !!r.struck, starStrikeRid(r.key));
          if (marks) answer.marks = marks;
        }
        return json({ ...answer, order }, 200, origin);
      }

      if (path === '/v1/serpent/claim' && request.method === 'POST') {
        // SERPENT1: A SERPENT'S RECEIPT, CARRIED HERE BY THE ACCOUNT IT NAMES, with the character that fought it. The relay
        // signed it at the kill (src/net/serpent/serpentReceipt.js); the session says who is asking, never the body, and serpents.js
        // `claimSerpent` holds the rest - the signature, the account, one row a (day, account), the Renown, the device's
        // hoard. A level that ROSE comes back with a signed order, as a raid's does.
        // SERPENT-SET: and its silver, a combat strike in the row's own batch (marks.js serpentStrikeStatement - 40, a ship
        // that stood half, under the day's combat cap with the gates and the raids), answered as `marks` where it recorded
        const r = await claimSerpent(ctx, who.player, { receipt: body.receipt, character: body.character, name: body.name ?? null, cid: body.cid ?? null, stones: body.stones ?? null }, await gatePublicKey(env, subtle), {   // AUDIT 625 P4: the embers its build mints
          strike: (d, nonce, earned) => serpentStrikeStatement(ctx, who.player, env, d, nonce, earned),
        });
        if (r.error) return json({ error: r.error, ...(r.why ? { why: r.why } : {}) }, r.error === 'no-gate-key' ? 503 : r.error === 'not-yours' ? 403 : 400, origin);
        if (r.recorded === true) await grantSpoils(ctx.db, who.player.id);   // INT5: a signed win's spoils, the budget's fill
        const key = r.renown?.rose ? await signingKey(env, subtle) : null;   // a level that rose: its signed order, for the rooms
        const signed = key ? await mintRenownOrder({ s: who.player.id, lv: r.renown.level }, key, { subtle, nowS }) : null;
        const answer = { ...r };
        delete answer.day; delete answer.struck;   // the service's own: the kill's day and whether the batch struck
        return json({ ...answer, order: signed, ...(r.recorded ? { marks: await serpentStrikeAnswer(ctx, who.player, env, !!r.struck, r.day) } : {}) }, 200, origin);
      }

      if (path === '/v1/sd/claim' && request.method === 'POST') {
        // SD9b: A BRASS REMNANT'S RECEIPT, CARRIED HERE BY THE ACCOUNT IT NAMES. The relay signed it at the fall
        // (src/net/superDungeon/sdReceipt.js); the session says who is asking, never the body, and sds.js `claimSd` holds the rest - the
        // signature, the account, one row a (slot, account), and on that first write the Hour's grants off its seed. A
        // refusal says its rung, as the gate's does (AUDIT WB A5): the client keeps a receipt the service can mend.
        const r = await claimSd(ctx, who.player, body.receipt, await gatePublicKey(env, subtle));
        if (r.error) return json({ error: r.error, ...(r.why ? { why: r.why } : {}) }, r.error === 'no-gate-key' ? 503 : r.error === 'not-yours' ? 403 : 400, origin);
        if (r.recorded === true) await grantSpoils(ctx.db, who.player.id);   // INT5: a signed win's spoils, the budget's fill
        if (r.recorded === true) return json({ ...r, weir: await rollWeirKey(ctx, who.player, { kind: 'sd' }) }, 200, origin);   // EG-PLAY: an Hour broken rolls a Weir Key, one in three
        return json(r, 200, origin);
      }

      if (path === '/v1/ketch/claim' && request.method === 'POST') {
        // KETCH: A TONAL WARDEN'S RECEIPT, CARRIED HERE BY THE ACCOUNT IT NAMES (src/net/ketch/ketchReceipt.js) - ketch.js
        // `claimKetch` holds the rest: the signature, the account, one row a (voyage, account), and the week's share. A
        // refusal says its rung, as the Hour's does: the client keeps a receipt the service can mend.
        const r = await claimKetch(ctx, who.player, body.receipt, await gatePublicKey(env, subtle), body.cid);   // AUDIT KETCH L2-1: the device's claim id; L2-9: the budget's fill in its batch
        if (r.error) return json({ error: r.error, ...(r.why ? { why: r.why } : {}) }, r.error === 'no-gate-key' ? 503 : r.error === 'not-yours' ? 403 : 400, origin);
        return json(r, 200, origin);
      }

      // ═══ EG-PLAY: THE ELITE BREACH ════════════════════════════════════
      //
      // Elite-Gates.md sections 5 and 23: the Weir Keys an account holds, the open that stakes one (or the day's Rehearsal)
      // and signs the order the hub opens the breach on, a member's admission, and the relay's `e1` receipts (eg.js).
      if (path.startsWith('/v1/eg/')) {
        if (request.method !== 'POST') return no('method', 405, origin);
        const act = {
          '/v1/eg/keys': async () => ({ ...(await egKeysOf(ctx, who.player, env)), rk: String(env.GATE_PUBLIC_KEY ?? '') || null }),   // EG-F: and the relay's public half - a stranger's arch verified (egStarts.js); EG-ZF: `env`, First of the Spire's list
          '/v1/eg/first': async () => egFirstSay(ctx, who.player, body),   // EG-ZF: the first-time lines shown, once an account
          '/v1/eg/starts': async () => startsEg(ctx, who.player, body, String(env.GATE_PUBLIC_KEY ?? '') || null),   // EG-F: the start window's preflight
          '/v1/eg/open': async () => openEg(ctx, who.player, body, await signingKey(env, subtle)),
          '/v1/eg/admit': async () => admitEg(ctx, who.player, body, await signingKey(env, subtle)),
          // EG-E1: what a Redoubt pays - the Marks' switch (`env`) and the claiming character, its guild's deed
          '/v1/eg/claim': async () => claimEg(ctx, who.player, body.receipt, await gatePublicKey(env, subtle), { env, character: typeof body.character === 'string' ? body.character : null }),
          '/v1/eg/sink': async () => egSink(ctx, who.player, body),   // EG-E1: the Broker's Panoply piece, once a week
          '/v1/eg/board': async () => egBoardOf({ ...ctx, db: env.DB }, who.player, env),   // EG-E2: the three boards - on the binding, as a #1's count is (the last season's champions may be written here)
          '/v1/eg/find': async () => findEg(ctx, who.player, body),   // EG-E3: a dungeon elite's find
        }[path];
        if (!act) return no('not-found', 404, origin);
        const r = await act();
        if ('error' in r) return json({ error: r.error, ...(r.why ? { why: r.why } : {}), ...(typeof r.b === 'string' ? { b: r.b } : {}), ...(Number.isSafeInteger(r.keys) ? { keys: r.keys } : {}),
          ...(Number.isSafeInteger(r.w) ? { w: r.w } : {}), ...(typeof r.piece === 'string' ? { piece: r.piece } : {}), ...(Number.isSafeInteger(r.purse) ? { purse: r.purse, price: r.price } : {}) }, EG_STATUS[r.error] ?? 400, origin);   // EG-E1: the sink's - which piece, the purse and the price
        if (path === '/v1/eg/claim' && r.recorded === true && r.q === 'w' && r.paid === true) await grantSpoils(ctx.db, who.player.id);   // INT5: a signed win's spoils, the budget's fill (EG-E1: a Redoubt the week pays)
        return json(r, 200, origin);
      }

      if (path === '/v1/lamp/claim' && request.method === 'POST') {
        // LAMP-KEEPER II: A LAMP KEEPER SPOKEN TO - the session says who, lamp.js lays I Love Lamp on the row once
        return json(await claimLamp(ctx, who.player), 200, origin);
      }

      if (path === '/v1/ql/claim' && request.method === 'POST') {
        // QL12: A QUESTLINE'S STEP CLAIMED - the session says who, questlines.js opens the step (`open`) or reads its witness
        // (`end`: the endgame place's own receipt row, in the line's window and order) and pays the line's title and the key
        const r = await claimQl({ ...ctx, env }, who.player, body, nowS);
        if ('error' in r) return no(r.error, QL_STATUS[/** @type {keyof typeof QL_STATUS} */ (r.error)] ?? 400, origin);
        return json(r, 200, origin);
      }

      if (path === '/v1/arena/claim' && request.method === 'POST') {
        // ARENA4: A BOUT'S RECEIPT, CARRIED HERE BY AN ACCOUNT IT NAMES. The relay refereed the bout and signed its result
        // (src/net/arena/arenaReceipt.js); arena.js `claimArena` holds the rest - the signature, the account, one row a bout, a
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

      if (path === '/v1/iliac/claim' && request.method === 'POST') {
        // CARDS10: A RANKED GAME'S RECEIPT, CARRIED HERE BY AN ACCOUNT IT NAMES - the arena players' bout's law for Iliac
        // Hand (iliac.js claimIliac): the signature, the account, one row a game, both ratings. A refusal says its rung.
        const r = await claimIliac(ctx, who.player, body.receipt, await gatePublicKey(env, subtle));
        if (r.error) return json({ error: r.error, ...(r.why ? { why: r.why } : {}) }, r.error === 'no-gate-key' || r.error === 'busy' ? 503 : r.error === 'not-yours' ? 403 : 400, origin);
        return json(r, 200, origin);
      }

      if (path === '/v1/iliac/board' && request.method === 'POST') {
        // CARDS10: ILIAC HAND'S SEASON BOARD (Tavern-Cards section 6.4: "a season board, the Arena's way, with a title for
        // the top of it"), counted from the rows, and the caller's own.
        return json(await iliacBoardOf(ctx, who.player, env), 200, origin);
      }

      if (path === '/v1/gambit/claim' && request.method === 'POST') {
        // KG6: A RATED KING'S GAMBIT'S RECEIPT, CARRIED HERE BY AN ACCOUNT IT NAMES - Iliac Hand's law (gambit.js
        // claimGambit): the signature, the account, one row a game, both ratings. A refusal says its rung.
        const r = await claimGambit(ctx, who.player, body.receipt, await gatePublicKey(env, subtle));
        if (r.error) return json({ error: r.error, ...(r.why ? { why: r.why } : {}) }, r.error === 'no-gate-key' || r.error === 'busy' ? 503 : r.error === 'not-yours' ? 403 : 400, origin);
        return json(r, 200, origin);
      }

      if (path === '/v1/gambit/board' && request.method === 'POST') {
        // KG6: THE KING'S GAMBIT'S SEASON BOARD (Kings-Gambit.md 10.7: "a season board the Arena's way ... whose #1 over 10
        // games against 5 foes wears GRANDMASTER"), counted from the rows, and the caller's own.
        return json(await gambitBoardOf(ctx, who.player, env), 200, origin);
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
        await progressSpent(ctx, who.player.id, path, r);   // INT17: what it credited, measured against the play that paid for it
        let order = null;
        if (r.rose || (r.repeat && r.level > 1)) {
          const key = await signingKey(env, subtle);
          if (key) order = await mintRenownOrder({ s: who.player.id, lv: r.level }, key, { subtle, nowS });
        }
        return json({ ...r, order }, 200, origin);
      }

      // ═══ FIRM1: THE FIRMAMENT ═══════════════════════════════════
      //
      // A character's passive tree: read with its purses, and changed WHOLE - the law judges the tree asked for against the
      // purses this service counts, and a refund's silver is burnt in the change's own batch (firmament.js).
      if (path === '/v1/firmament/state' || path === '/v1/firmament/set' || path === '/v1/firmament/respec') {
        if (request.method !== 'POST') return no('method', 405, origin);
        const r = path === '/v1/firmament/state' ? await firmamentState(ctx, who.player, env, body)
          : path === '/v1/firmament/set' ? await setFirmament(ctx, who.player, env, body)
            : await respecFirmament({ ...ctx, bucket: env.SAVES }, who.player, env, body);   // a realm character's record is in R2
        if ('error' in r) return json({ error: r.error, ...(Number.isSafeInteger(r.silver) ? { silver: r.silver } : {}), ...(r.error === 'seq' && Number.isSafeInteger(r.seq) ? { seq: r.seq } : {}) }, /** @type {Record<string, number>} */ (FIRM_STATUS)[r.error] ?? 400, origin);
        return json(r, 200, origin);
      }

      // ═══ CHAP1: THE ROLL ═════════════════════════════════════════
      //
      // A realm character's standing with Daggerfall's own guilds, kept here
      // (npcRoll.js): read - and seeded, the first time - as the character
      // comes online, then claimed as it moves. The account is the
      // session's, the character must be its own and standing, and the
      // lease the playing tab's. Behind CHAPTERS_OPEN; shut, the save keeps
      // the standing as it did before CHAP1.
      if (path === '/v1/chapters/roll' || path === '/v1/chapters/claim' || path === '/v1/chapters/witness'
        || path === '/v1/chapters/halls' || path === '/v1/chapters/strike' || path === '/v1/chapters/list'
        || path === '/v1/chapters/focus' || path === '/v1/chapters/history' || path === '/v1/chapters/back' || path === '/v1/chapters/patron') {
        if (request.method !== 'POST') return no('method', 405, origin);
        if (!chaptersOpenFor(who.player, env)) return no('chapters-closed', 403, origin);
        // CHAP2a: and a town's guild halls witnessed, as a seat is (npcHalls.js); AUDIT CHAP2 E1: a region's audit list
        // and a false town struck, a developer's
        // CHAP3b: and the chapter sheet - every chapter's Strength and band, after the Turnings due (npcChapters.js)
        // CHAP4d: and a chapter's Master's Focus, and a region's Chronicle of its chapters' seats
        const r = path === '/v1/chapters/list' ? await chapterSheet(ctx, who.player, env)
          : path === '/v1/chapters/focus' ? await setChapterFocus(ctx, who.player, env, body)
          : path === '/v1/chapters/history' ? await chapterChronicle(ctx, who.player, env, body)
          : path === '/v1/chapters/back' ? await backChapter(ctx, who.player, env, body)   // CHAP6b: a member's backing in its chapter's Season
          : path === '/v1/chapters/patron' ? await bidPatron(ctx, who.player, env, body)   // CHAP7a: a guild's bid for a chapter's patronage
          : path === '/v1/chapters/witness' ? await witnessHall(ctx, who.player, env, body)
          : path === '/v1/chapters/halls' ? await listHalls(ctx, who.player, env, body)
            : path === '/v1/chapters/strike' ? await strikeHall(ctx, who.player, env, body)
              : path === '/v1/chapters/roll' ? await readRoll(ctx, who.player, body) : await claimRoll(ctx, who.player, body);
        if ('error' in r) return no(r.error, /** @type {Record<string, number>} */ (ROLL_STATUS)[r.error] ?? 400, origin);
        // CHAP4a: the Roll's answer carries the character's seats - ranks 8 and 9 are a seat's, never the book's
        if ((path === '/v1/chapters/roll' || path === '/v1/chapters/claim') && /** @type {any} */ (r).roll) /** @type {any} */ (r).roll.seats = await chapterSeatsOf(ctx.db, body?.character);
        return json(r, 200, origin);
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
        if (path === '/v1/homes/layouts') return json(await homeLayoutsKept(ctx), 200, origin);   // WD3: every town holding a home, and the layout it keeps; STORM-SHED 2: read again only once a town's homes moved
        if (path === '/v1/homes/decor') {
          const r = await decorOf(ctx, who.player, body);
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
                : path === '/v1/homes/decor/batch' ? await commitDecorBatch(hctx, who.player, body)   // DECOR-BATCH
                  : path === '/v1/homes/decor/use' ? await decorUse(hctx, who.player, body)   // DECOR-ACCESS
                    : await removeDecor(hctx, who.player, body);
          forgetYards(body?.mapId);   // YARD-SHED: the town's kept yards let go, whatever the write did
          await settleYards(ctx.db, body?.mapId).catch((e) => console.warn('[yards] the town not built', e?.message ?? e));   // YARD-SNAP: and built again (the clock builds one this misses)
          if (!('error' in r)) return json(r, 200, origin);
          const said = realmNo(r);
          if (said) return said;
          const status = r.error === 'decor-cap' || r.error === 'yard-cap' || r.error === 'decor-taken' || r.error === 'guild-treasury-full' || r.error === 'vendor-stocked' || r.error === 'decor-rev' || r.error === 'decor-holds' || r.error === 'decor-shut' || r.error === 'decor-held' ? 409   // GUILD1d: a hall piece's half back, into a full treasury; HOME-VENDOR: a stocked trader stays; DECOR-BATCH: a stale revision, or a chest that still holds goods; DECOR-ACCESS: shut, or the good is already held
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
        if (path === '/v1/homes/vote') {   // HOME-VOTE: a registered account's word on a home it is no insider of
          const r = await voteHome(ctx, who.player, body);
          if (!('error' in r)) return json(r, 200, origin);
          return no(r.error, r.error === 'no-home' ? 404 : r.error === 'vote-rate' ? 429 : r.error === 'vote-own' || r.error === 'vote-young' ? 403 : 400, origin);
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
          if (!('error' in r)) return json(await homeOrdersOf(r, who.player.id, env, subtle, nowS), 200, origin);   // QUEST-HOME
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
          if (!('error' in r)) return json(await homeOrdersOf(r, who.player.id, env, subtle, nowS), 200, origin);   // QUEST-HOME
          if (r.error === 'home-layout') return json({ error: 'home-layout', layout: r.layout ?? null }, 409, origin);   // as /v1/homes/claim answers it
          const status = r.error === 'home-taken' || r.error === 'home-arena' ? 409 : r.error === 'home-rate' ? 429 : r.error === 'no-deed' || r.error === 'no-realm-character' ? 404 : 400;
          return no(r.error, status, origin);
        }
        if (path === '/v1/homes/inherit') {
          // PERMADEATH-HOUSES: a fallen member's home taken up by a living realm character of their line (homes.js
          // inheritHome) - the tombstone gate above has already refused a `character` that is dead
          const r = await inheritHome(hctx, who.player, body);
          if (!('error' in r)) return json(r, 200, origin);
          return no(r.error, r.error === 'not-heir' ? 403 : r.error === 'no-home' ? 404 : r.error === 'homes-need-account' ? 403 : 400, origin);
        }
        if (path === '/v1/homes/claim') {
          const r = await claimHome(hctx, who.player, body);
          if (!('error' in r)) return json(await homeOrdersOf(r, who.player.id, env, subtle, nowS), 200, origin);   // QUEST-HOME: a home now, said to every page online
          const said = realmNo(r);
          if (said) return said;
          if (r.error === 'home-layout') return json({ error: 'home-layout', layout: r.layout ?? null }, 409, origin);   // WD3 (AUDIT WD3 O1): the layout the town keeps, for the client to hear
          const status = r.error === 'home-taken' || r.error === 'home-cap' || r.error === 'home-arena' ? 409 : r.error === 'home-rate' ? 429 : r.error === 'home-update' ? 426 : 400;   // AUDIT WD3 B2: a build from before the town mods   // WD3: a town kept in another layout   // ARENA4b: the arena stands there
          return no(r.error, status, origin);
        }
        if (path === '/v1/homes/transfer') {
          const r = await homeTransfer(hctx, who.player, body);
          if (!('error' in r)) return json(r, 200, origin);
          const said = realmNo(r);
          if (said) return said;
          const conflict = r.error === 'home-cap' || r.error === 'home-tenants' || r.error === 'home-vendor-stocked' || r.error === 'home-holds' || r.error === 'offer-open' || r.error === 'offer-closed' || r.error === 'offer-stale' || r.error === 'home-deed';
          return no(r.error, r.error === 'home-rate' ? 429 : conflict ? 409 : r.error === 'no-home' ? 404 : 400, origin);
        }
        const r = path === '/v1/homes/release' ? await releaseHome(hctx, who.player, body) : await setHomeEntry(hctx, who.player, body, env);   // AUDIT LW-II-2 S4: a door leaving public reckons its patrons, by the service's secret
        if ('error' in r) return realmNo(r) ?? no(r.error, r.error === 'bad-entry' || r.error === 'realm-needed' ? 400 : r.error === 'home-crossed' || r.error === 'home-tenants' || r.error === 'home-vendor-stocked' || r.error === 'home-holds' ? 409 : 404, origin);   // HOME-CROSSED; HOME-RENT: a sale waits for its tenants; HOME-VENDOR: and its stocked trader; a shared chest still holding goods
        return json(await homeOrdersOf(r, who.player.id, env, subtle, nowS), 200, origin);   // QUEST-HOME: a sale - a house again to every page online
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
        if (!('error' in r)) return json(await homeOrdersOf(await guildOrdersOf(r, who.player.id, env, subtle, nowS), who.player.id, env, subtle, nowS), 200, origin);   // QUEST-HOME: a hall bought or sold
        if (r.error === 'seq') return json({ error: 'seq', seq: r.seq }, 409, origin);   // REALM P2.2: the service's own, as a checkpoint's
        if (r.error === 'home-layout') return json({ error: 'home-layout', layout: r.layout ?? null }, 409, origin);   // AUDIT PRE-MERGE 1003 WD1: the town's layout, as /v1/homes/claim answers it
        // AUDIT2 GUILD2 S2/S7: the word the filter caught (`why`, the door's own field for a refusal's reason), and when the
        // next new name may come - each dropped here, so the page could say neither
        if ((r.error === 'guild-name-word' || r.error === 'guild-rank-word') && typeof r.word === 'string') return json({ error: r.error, why: r.word }, GUILD_STATUS[r.error], origin);   // TEXT-F1: a rank's name's word too
        if (r.error === 'guild-rename-soon' && Number.isSafeInteger(r.at)) return json({ error: r.error, at: r.at }, GUILD_STATUS[r.error], origin);
        // GUILD3c (bible/11-Multiplayer/Guilds-Made-Plain.md): a leave's or a disbanding's refusal names everything that holds the guild
        if (Array.isArray(r.keeps)) return json({ error: r.error, keeps: r.keeps }, GUILD_STATUS[r.error] ?? 400, origin);
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
          '/v1/marks/find': () => findMarks(ctx, who.player, env, body),   // SILVER-FINDS: a loot find
          '/v1/marks/guild/deposit': () => depositGuildMarks(ctx, who.player, env, body),
          '/v1/marks/guild/withdraw': () => withdrawGuildMarks(ctx, who.player, env, body),
          '/v1/marks/report': () => marksReport(ctx, who.player, env),
        }[path];
        if (!act) return no('not-found', 404, origin);
        const r = await act();
        if (progressRoute) await progressSpent(ctx, who.player.id, path, r);   // INT17: a find
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

      // ═══ TOWN-ECON TE2: THE TOWNS' ECONOMY ════════════════════════════
      //
      // bible/06-Systems/Town-Economy-Arc.md section 4 (townEcon.js): every town's players' share, read by any session; a
      // town witnessed by the client standing in it (the registry); the Watch's ticks walked in a town, claimed.
      if (path.startsWith('/v1/towns/')) {
        if (request.method !== 'POST') return no('method', 405, origin);
        // AUDIT TOWN-ECON 2 SVC-7: the doors shut by TOWNS_OPEN 'off' (townEcon.js townsOpen) - the load shed by a variable
        if (!townsOpen(env)) return no('towns-closed', TOWN_STATUS['towns-closed'], origin);
        const act = {
          '/v1/towns/econ': () => townsEcon(ctx),
          '/v1/towns/witness': async () => witnessTown(ctx, who.player, env, body, await gatePublicKey(env, subtle)),   // AUDIT TOWN-ECON 2 SVC-1: a walk's tick
          '/v1/towns/watch': async () => claimTownWatch(ctx, who.player, env, body, await gatePublicKey(env, subtle)),
          '/v1/towns/strike': () => strikeTown(ctx, who.player, env, body),   // SVC-1: a developer's
          '/v1/towns/audit': () => auditTowns(ctx, who.player, env, body),
        }[path];
        if (!act) return no('not-found', 404, origin);
        const r = await act();
        return 'error' in r ? no(r.error, TOWN_STATUS[r.error] ?? 400, origin) : json(r, 200, origin);
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
        // SEAT-LEASE: one settler at a time (seatTurning.js settleDueOnce) - while another holds the Turning a read answers
        // the state as it stands, and an act is told to ask again in a moment, never made on a week half turned
        if (seatsOpenFor(who.player, env) && (await settleDueOnce(ctx.db, nowS, seasonZeroOf(env.SEASON_ZERO_WEEK))).pending && !SEAT_READS.has(path)) return no('seats-settling', 503, origin);   // SEASON1: a Season's end at its Turning
        const act = {
          '/v1/seats/list': async () => {
            const r = await listSeats(ctx, who.player, env);
            return 'error' in r ? r : { ...r, ...(await seatsBoard(ctx.db, r.seats, nowS)), zero: seasonZeroOf(env.SEASON_ZERO_WEEK) };   // SEAT-BATCH: the holders, battles, Edicts, works and red lines in one batch   // SEAT1c: each seat's holder and battle   // CROWN2: the server's red lines   // SEASON1 part two: the week Season 0 began, for the client's Tides
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
        if (progressRoute) await progressSpent(ctx, who.player.id, path, r);   // INT17: a camp, the Watch's ticks
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
          '/v1/prof/temper': () => temperPiece(ctx, who.player, env, body),   // CRAFT4: a piece a quality step better
          '/v1/prof/reforge': () => reforgeWithEssence(ctx, who.player, env, body),   // CRAFT4: a line rolled again for Arcane Essence
          '/v1/stores/withdraw': () => withdrawStores(ctx, who.player, env, body),
          '/v1/stores/deposit': () => depositStores(ctx, who.player, env, body),   // BAG1: what is carried, into the Stores
          // PROF6: the Court's writs, and beside them this board's guild writs and commissions (writs.js writBoard)
          '/v1/writs/list': async () => {
            const r = await listWrits(ctx, who.player, env, body);
            return 'error' in r ? r : { ...r, ...(await writBoard(ctx, who.player, env, body)), ...(await contractBoard(ctx, who.player, env, body)), ...(await craftWritBoard(ctx, who.player, env, body)) };   // SILVER-WAYS: and its guild contracts; CRAFT-WRITS: and the character's crafting writs
          },
          '/v1/writs/deliver': () => deliverWrit(ctx, who.player, env, body),
          '/v1/writs/craft': () => deliverCraftWrit({ ...ctx, bucket: env.SAVES }, who.player, env, body),   // CRAFT-WRITS: the goods out of the realm record, in R2
          '/v1/writs/post': () => postGuildWrit(ctx, who.player, env, body),   // PROF6: a guild writ
          '/v1/writs/supply': () => supplyGuildWrit(ctx, who.player, env, body),
          '/v1/writs/withdraw': () => withdrawGuildWrit(ctx, who.player, env, body),
          '/v1/writs/budget': () => setWritBudget(ctx, who.player, env, body),
          '/v1/writs/contract': () => postContract(ctx, who.player, env, body),   // SILVER-WAYS: a guild contract
          '/v1/writs/contract-withdraw': () => withdrawContract(ctx, who.player, env, body),
          '/v1/writs/commission': () => postCommission(ctx, who.player, env, body),   // PROF6: a commission
          '/v1/writs/fulfil': () => fulfilCommission({ ...ctx, bucket: env.SAVES }, who.player, env, body),   // INT19: the piece out of the crafter's realm record, in R2
          '/v1/writs/cancel': () => cancelCommission(ctx, who.player, env, body),
          '/v1/writs/decline': () => declineCommission(ctx, who.player, env, body),
          '/v1/stores/guild': () => guildStores(ctx, who.player, env, body),   // PROF6: the guild Stores
          '/v1/stores/guild-deposit': () => depositGuildStores(ctx, who.player, env, body),
          '/v1/stores/guild-withdraw': () => withdrawGuildStores(ctx, who.player, env, body),
        }[path];
        if (!act) return no('not-found', 404, origin);
        const r = await act();
        if (progressRoute) await progressSpent(ctx, who.player.id, path, r);   // INT17: a profession's XP, a harvest's silver, a writ's Renown
        // AUDIT PROF-541 B2: a realm record's sequence (a checkpoint's own word) and a refusal's `why` ride with it
        if ('error' in r) return json({ error: r.error, ...(typeof r.why === 'string' ? { why: r.why } : {}), ...(r.error === 'seq' && Number.isSafeInteger(r.seq) ? { seq: r.seq } : {}) }, PROF_STATUS[r.error] ?? 400, origin);
        if (r.renown?.rose) {
          const key = await signingKey(env, subtle);
          return json({ ...r, order: key ? await mintRenownOrder({ s: who.player.id, lv: r.renown.level }, key, { subtle, nowS }) : null }, 200, origin);
        }
        return json(r, 200, origin);
      }

      // ═══ SEA-BOUNTY: A FREEPORT'S BOUNTY BOARD ══════════════════════════
      //
      // bible/03-World/Eltheric-Ocean.md SEA-BOUNTY: the wanted captains of the open sea and the gold on their heads; a post
      // off the poster's record, a collect into the killer's - each act its own batch, the gold and the row together
      // (seaBounty.js). The kills are written with their falls (wild.js wildFall).
      if (path.startsWith('/v1/sea/bounty/')) {
        if (request.method !== 'POST') return no('method', 405, origin);
        const sctx = { ...ctx, bucket: env.SAVES };
        const act = {
          '/v1/sea/bounty/board': async () => seaBountyBoard(sctx, who.player, body),
          '/v1/sea/bounty/post': async () => seaBountyPost(sctx, who.player, body),
          '/v1/sea/bounty/collect': async () => seaBountyCollect(sctx, who.player, body),
        }[path];
        if (!act) return no('not-found', 404, origin);
        const r = await act();
        if (r.error === 'seq') return json({ error: 'seq', seq: r.seq }, 409, origin);   // the record moved under the act, as a checkpoint's
        if ('error' in r) return json({ error: r.error }, REALM_STATUS[r.error] ?? JUDGE_STATUS[r.error] ?? 400, origin);
        return json(r, 200, origin);
      }

      // SEA-SEASON (2026-10-22, bible/03-World/Eltheric-Ocean.md SEA-SEASON): the season's deepest voyages and legends
      // ended - read here; the figures come with each clean checkpoint (seaSeason.js, realm.js checkpointRealm)
      if (path === '/v1/sea/season/board') {
        if (request.method !== 'POST') return no('method', 405, origin);
        return json(await seaSeasonBoard(ctx, who.player, body), 200, origin);
      }

      // ═══ CARDS6: A CARD TABLE'S STAKES ══════════════════════════════════
      //
      // Tavern-Cards section 23: a realm character's buy-in held here against the service's order, and the relay's cash-out
      // receipt paid back into the record - each act its own batch, the gold and the row together (cards.js).
      if (path.startsWith('/v1/cards/')) {
        if (request.method !== 'POST') return no('method', 405, origin);
        const cctx = { ...ctx, bucket: env.SAVES };
        const act = {
          '/v1/cards/stake': async () => stakeCards(cctx, who.player, env, body, await signingKey(env, subtle)),
          '/v1/cards/cashout': async () => cashoutCards(cctx, who.player, env, body, await gatePublicKey(env, subtle)),
          '/v1/cards/deck': async () => deckOrderOf(cctx, who.player, env, body, await signingKey(env, subtle)),   // CARDS10: a ranked seat's deck, vouched for
        }[path];
        if (!act) return no('not-found', 404, origin);
        const r = await act();
        if (r.error === 'seq') return json({ error: 'seq', seq: r.seq }, 409, origin);   // the record moved under the act, as a checkpoint's
        // AUDIT CARDS-4 A4: and why a receipt was refused - the device keeps one refused on its signature or clock
        // AUDIT CARDS-6 D7: and the card a short deck lacks (iliac.js deckOrderOf) - said nowhere, the vouch's "(card)" never
        // could be; D8: the service without its key is the service's 503 (the token's own no-signing-key), and a guest's
        // ranked seat the account's 403 (the arena's ladder-needs-account) - neither a bad request
        if ('error' in r) return json({ error: r.error, ...(r.why ? { why: r.why } : {}), ...(typeof r.card === 'string' ? { card: r.card } : {}) }, CARDS_STATUS[r.error] ?? JUDGE_STATUS[r.error] ?? 400, origin);   // INT3: a held stake's own
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
          '/v1/market/auction': () => marketAuction(mctx, who.player, env, body),   // PROF5b; INT19: the Masterwork out of its seller's record
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

      if (path === '/v1/account/icon' && request.method === 'POST') {
        // WITCH1: WEAR ONE PROFILE ICON, OR NONE - the aura's door, in the portrait well. 403 for `not-held`, as the aura's.
        const r = await equipIcon(ctx, await withSeatTitles(ctx, who.player, env), env, body.icon ?? null);
        return r.error ? no(r.error, r.error === 'not-held' ? 403 : 400, origin) : json(r, 200, origin);
      }

      // ═══ WITCH1: THE WITCHES' FESTIVAL ════════════════════════════════
      //
      // bible/06-Systems/Witches-Festival.md: an account's Soul Cakes and what they bought, a find the service's die decides,
      // a sale by its request id, and the Hearth Offerings at homes' doors (festival.js).
      if (path.startsWith('/v1/festival/')) {
        if (request.method !== 'POST') return no('method', 405, origin);
        const act = {
          '/v1/festival/mine': async () => festivalOf(ctx, who.player, env),
          '/v1/festival/find': async () => findFestival(ctx, who.player, body, env),
          '/v1/festival/buy': async () => buyFestival(ctx, who.player, body, env),
          '/v1/festival/town': async () => festivalTown(ctx, who.player, body, env),
          '/v1/festival/offering/set': async () => setOffering(ctx, who.player, body, env),
          '/v1/festival/offering/fill': async () => fillOffering(ctx, who.player, body, env),
          '/v1/festival/offering/take-in': async () => takeInOffering(ctx, who.player, body),
          '/v1/festival/offering/take': async () => takeFromOffering(ctx, who.player, body, env),
        }[path];
        if (!act) return no('not-found', 404, origin);
        const r = await act();
        if ('error' in r) return json({ error: r.error, ...(Number.isSafeInteger(r.cakes) ? { cakes: r.cakes } : {}), ...(Number.isSafeInteger(r.bowls) ? { bowls: r.bowls } : {}) }, FEST_STATUS[r.error] ?? 400, origin);
        return json(r, 200, origin);
      }

      if (path === '/v1/account/glyph' && request.method === 'POST') {
        // GLYPH-WEAR: SHOW ONE GLYPH, OR HIDE IT - `{ glyph, on }`. 403 for `not-held`, as the title's.
        const r = await equipGlyph(ctx, await withSeatTitles(ctx, who.player, env), env, body.glyph, body.on !== false);   // AUDIT COLLECTIONS-II: the wardrobe it answers keeps a Charter's and a chapter's titles, as the title's door does
        return r.error ? no(r.error, r.error === 'not-held' ? 403 : 400, origin) : json(r, 200, origin);
      }

      if (path === '/v1/account/name' && request.method === 'POST') {
        // NAME-AS (2026-10-12, Mac: "toggle to use their account name or character name for ingame use"): WHICH NAME THE
        // ROOM READS - `{ as: 'account' | 'character' }`, the row's choice, which every later mint signs (accounts.js
        // wornNameOf). Nothing to hold, so nothing to refuse but a word that is neither: 400 `no-name-as`.
        const r = await chooseNameAs(ctx, who.player, body.as);
        return r.error ? no(r.error, 400, origin) : json(r, 200, origin);
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
        // SAFE4: the act kept in the record for good, and the order pushed to the relay's door - the hub hands it to the
        // target's own client, which reaches the rooms the moderator's does not hold. AUDIT SAFE SERVICE-2: a moderator's
        // mute closes the account's open case - as the moderator's act. STAFF-PANEL2-FIX: all of it safety.js modAct's, the
        // code every door shares - one sanction a case, and a case another staff member holds in the panel is theirs
        const r = await modAct(ctx, who.player, env, { act: 'mute', target: body.target, minutes: body.minutes, from: 'in the game' });
        return 'error' in r ? no(r.error, SAFETY_STATUS[r.error] ?? 400, origin) : json(r, 200, origin);
      }

      // SAFE4 (bible/11-Multiplayer/Chat-Safety-Arc.md section 5): A MODERATOR'S BAN, UNBAN AND LOOK - sanctions.js. A ban's
      // order goes back to the moderator's client to carry to its rooms (MOD1's carrier) and to the relay's door.
      // STAFF-PANEL2-FIX: the ban and the unban are safety.js modAct's, as the mute is
      if ((path === '/v1/mod/ban' || path === '/v1/mod/unban' || path === '/v1/mod/strikes') && request.method === 'POST') {
        const who2 = { target: body.target, name: body.name };
        const r = path === '/v1/mod/strikes' ? await strikesLook(ctx, who.player, env, who2)
          : path === '/v1/mod/ban' ? await modAct(ctx, who.player, env, { act: 'ban', ...who2, days: body.days, reason: body.reason, from: 'in the game' })
            : await modAct(ctx, who.player, env, { act: 'unban', ...who2, from: 'in the game' });
        return 'error' in r ? no(r.error, SAFETY_STATUS[r.error] ?? 400, origin) : json(r, 200, origin);
      }

      // AUDIT SAFE DOC-4 (bible/11-Multiplayer/Chat-Safety-Arc.md section 9): THE CASES, READ IN THE GAME - a moderator's
      // list of the open cases, one case, and its dismissal (safety.js); a dismissal's unmute order goes back to the
      // moderator's client to carry, as /mute's does
      if ((path === '/v1/mod/cases' || path === '/v1/mod/case' || path === '/v1/mod/dismiss') && request.method === 'POST') {
        const who2 = { target: body.target, name: body.name };
        const r = path === '/v1/mod/cases' ? await modCases(ctx, who.player, env)
          : path === '/v1/mod/case' ? await modCase(ctx, who.player, env, who2)
            : await modDismiss(ctx, who.player, env, who2);
        return 'error' in r ? no(r.error, SAFETY_STATUS[r.error] ?? 400, origin) : json(r, 200, origin);
      }

      // SAFE1, SAFE3, SAFE7 (bible/11-Multiplayer/Chat-Safety-Arc.md): A PLAYER'S BLOCK LIST, A REPORT, THE CODE AGREED - safety.js
      if (path.startsWith('/v1/safety/')) {
        if (request.method !== 'POST') return no('method', 405, origin);
        const act = {
          '/v1/safety/blocks': () => blocksOf(ctx, who.player),
          '/v1/safety/block': () => blockAccount(ctx, who.player, { target: body.target }),
          '/v1/safety/unblock': () => unblockAccount(ctx, who.player, { target: body.target }),
          '/v1/safety/report': () => fileReport(ctx, who.player, env, body),
          '/v1/safety/conduct': () => agreeConduct(ctx, who.player, { v: body.v }),
          '/v1/safety/staff-messages': () => staffMessagesFor(ctx, who.player),   // STAFF-PANEL5-MESSAGE: Message on screen, read by the player's own game
          '/v1/safety/staff-message-ok': () => staffMessageOk(ctx, who.player, body),   // ...and its OK (their game's word, never proof)
        }[path];
        if (!act) return no('not-found', 404, origin);
        const r = await act();
        return 'error' in r ? no(r.error, SAFETY_STATUS[r.error] ?? 400, origin) : json(r, 200, origin);
      }

      // INT6 (bible/06-Systems/Integrity-Arc.md): THE REVIEW - a developer's read of the judge's verdicts and the acts on
      // them (review.js): the held, a character's findings, a hold lifted or laid, a rollback to the last clean save, the
      // measure and the budget's config. 403 for a caller who is not one.
      if (path.startsWith('/v1/mod/realm-') && request.method === 'POST') {
        const act = path.slice('/v1/mod/realm-'.length);
        const r = await reviewAct({ ...ctx, bucket: env.SAVES }, who.player, env, act, body);
        return r.error ? no(r.error, REVIEW_STATUS[r.error] ?? 400, origin) : json(r, 200, origin);
      }

      if (path === '/v1/mod/customs-pass' && request.method === 'POST') {
        // CUSTOMS-PASS (2026-09-29, Mac, asked what becomes of a character a build from before the realm stranded:
        // "Staff customs pass"): A DEVELOPER GRANTS ONE ACCOUNT ONE CHARACTER THROUGH CUSTOMS (realm.js). 403 for a
        // caller who is not one - the credential is good, the right is not theirs, as the save wall reads it.
        const r = await grantCustomsPass(ctx, who.player, env, { name: body.name, account: body.account, revoke: body.revoke });
        return r.error ? no(r.error, PASS_STATUS[r.error] ?? 400, origin) : json(r, 200, origin);
      }

      // STAFF-PANEL5-FREEZE (staffFreeze.js): THE PLAYER'S OWN STAFF CHAT THREAD - read, and a line of theirs in it
      if (STAFF_CHAT_ROUTES.includes(path)) {
        if (request.method !== 'POST') return no('method', 405, origin);
        const r = await playerStaffChat(ctx, env, path, body, who.player, auditStatement);
        return 'error' in r ? no(r.error, STAFF_CHAT_STATUS[/** @type {keyof typeof STAFF_CHAT_STATUS} */ (r.error)] ?? 400, origin) : json(r, 200, origin);
      }

      // SCALE4c: ONE HEARTBEAT - the beat, the letterbox and a town's board, whichever the body names, each part answered
      // as its own route answers it (heartbeat.js), under the one session this request resolved
      if (path === '/v1/heartbeat') {
        if (request.method !== 'POST') return no('method', 405, origin);
        held.said.parts = heartbeatPartsOf(body);   // AUDIT SCALE II A-3: the parts of the body read above - capped, and behind the session
        return json(await heartbeat(ctx, who.player, env, body, who.session?.id ?? null), 200, origin);   // SESSION-SIGN E3: the beat asks its session
      }
      if (path === '/v1/account/played' && request.method === 'POST') {
        // ACC4: A BEAT, AND NOTHING IN IT IS READ. Whatever the body
        // says, the credit is the gap by THIS clock (accounts.js
        // `creditPlay`), so there is no field a client could inflate.
        return json(await creditPlay(ctx, who.player.id, who.session?.id ?? null), 200, origin);
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
        const r = await register(ctx, who.player.id, { handle: body.handle, password: body.password, legal: { terms: body.terms, privacy: body.privacy }, set: body.set === true });   // RECOVERY-SET: a set for a build that asks
        return r.error ? no(r.error, 400, origin) : json(r, 200, origin);
      }

      if (path === '/v1/account/password' && request.method === 'POST') {
        const r = await changePassword(ctx, who.player, who.session, { oldPassword: body.oldPassword, password: body.password });
        return r.error ? no(r.error, r.error === 'rate' ? 429 : r.error === 'bad-login' ? 401 : 400, origin) : json(r, 200, origin);
      }

      if (path === '/v1/account/recovery-codes' && request.method === 'POST') {
        // RECOVERY-SET: a NEW set of recovery codes, behind the password and one current code (AUDIT RECOVERY-SET A1) -
        // shown once, the old set dead with the write
        const r = await newRecoveryCodes(ctx, who.player, { password: body.password, code: body.code });
        return r.error ? no(r.error, r.error === 'rate' ? 429 : r.error === 'bad-login' || r.error === 'bad-code' ? 401 : r.error === 'codes-moved' ? 409 : 400, origin) : json(r, 200, origin);
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
          const r = await sendLetter(ctx, who.player, { to: body.to, toAccount: body.toAccount, subject: body.subject, body: body.body });   // NAME-AS: or by account - a friend's letter
          if (!('error' in r)) return json(r, 200, origin);
          const status = r.error === 'muted' ? 403 : r.error === 'no-reader' || r.error === 'reader-guest' ? 404 : r.error === 'mail-rate' ? 429 : r.error === 'inbox-full' ? 409 : 400;
          return no(r.error, status, origin);
        }
        const r = path === '/v1/mail/read' ? await readLetter(ctx, who.player, env, body.id) : await deleteLetter(ctx, who.player, body.id);
        return 'error' in r ? no(r.error, 404, origin) : json(r, 200, origin);
      }

      // SERVER-POST (2026-10-08, Mac: "an ingame server mailbox that goes next to the hourglass in the pause menu ... First
      // use is to utilize it for players being granted items"): THE SERVER'S POST - the developers' pieces to one account,
      // a registered one's alone (the letters' wall, its own word), each perhaps holding an item its reader claims into the
      // online character being played (post.js). Read, claimed and thrown away here; written only by the operator's workflow.
      if (path.startsWith('/v1/post/')) {
        if (accountKind(who.player) !== 'linked') return no('post-needs-account', 403, origin);
        if (path === '/v1/post/box') {
          if (request.method !== 'GET') return no('method', 405, origin);
          return json(await postBoxOf(ctx, who.player, env), 200, origin);   // PRIVATE-REPORT: env, a reader's count
        }
        if (request.method !== 'POST') return no('method', 405, origin);
        const act = {
          '/v1/post/read': () => readPost(ctx, who.player, body.id),
          '/v1/post/claim': () => claimPost({ ...ctx, bucket: env.SAVES }, who.player, { id: body.id, character: body.character, realm: body.realm }),   // the realm record is in R2
          '/v1/post/delete': () => deletePost(ctx, who.player, body.id),
          '/v1/post/lost': () => mailLostSpoils(ctx, who.player, { day: body.day, pieces: body.pieces }),   // LOST-SPOILS: the Lost and Found's (lostSpoils.js)
        }[path];
        if (!act) return no('not-found', 404, origin);
        const r = await act();
        if (!('error' in r)) return json(r, 200, origin);
        if (r.error === 'seq') return json({ error: 'seq', seq: r.seq }, 409, origin);   // the service's own, as a checkpoint's
        return no(r.error, POST_STATUS[r.error] ?? REALM_STATUS[r.error] ?? 400, origin);
      }

      // PRIVATE-REPORT (2026-10-17, Mac: "Can we add a private disclosure method for exploits/bugs with the client"): A
      // PLAYER'S PRIVATE REPORT - an exploit, a bug, a security hole - to the readers REPORT_READER_HANDLES names, and
      // their inbox (reports.js). A registered account's alone, the letters' wall with its own word: a guest is a device,
      // and a report a reader cannot answer to anybody is one the next storage clear forgets who sent.
      if (path.startsWith('/v1/report/')) {
        if (accountKind(who.player) !== 'linked') return no('report-needs-account', 403, origin);
        if (request.method !== 'POST') return no('method', 405, origin);
        const act = {
          '/v1/report/send': () => sendReport(ctx, who.player, body),
          '/v1/report/mine': () => myReports(ctx, who.player),
          '/v1/report/inbox': () => reportInbox(ctx, who.player, env, body),
          '/v1/report/read': () => readReport(ctx, who.player, env, body.id),
          '/v1/report/close': () => closeReport(ctx, who.player, env, body),
        }[path];
        if (!act) return no('not-found', 404, origin);
        const r = await act();
        return 'error' in r ? no(r.error, REPORT_STATUS[r.error] ?? 400, origin) : json(r, 200, origin);
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
      // ═══ POI-1: THE POI STORE (poi.js) ═════════════════════════
      //
      // A builder's uploads, drafts and submissions; an approver's queue and word; the list and a POI's history. Every
      // door asks the role itself (poi.js poiRolesOf), so a route here is never more than the roles say.
      if (poiPath) {
        const pctx = { ...ctx, bucket: env.SAVES };
        const me = who.player;
        const answer = (r) => ('error' in r ? json(r, POI_STATUS[r.error] ?? 400, origin) : json(r, 200, origin));
        const { route } = poiPath;
        if (route === 'me' && request.method === 'GET') return json({ handle: me.handle ?? null, ...poiRolesOf(me, env) }, 200, origin);
        if (route === 'list' && request.method === 'GET') return answer(await listPoi(pctx, me, env));
        if (route === 'queue' && request.method === 'GET') return answer(await poiQueue(pctx, me, env));
        if (route === 'doc' && request.method === 'GET') return answer(await poiHistory(pctx, me, env, poiPath.id));
        if (route === 'shelf' && request.method === 'GET') return answer(poiPath.id ? await shelfEntry(pctx, me, env, poiPath.id) : await listShelf(pctx, me, env));
        if (route === 'shelf' && request.method === 'PUT' && !poiPath.id) {
          // POI-4b: an entry on the library's shelf, read to a draft's own bound (an entry is a POI without its place)
          if (!poiRolesOf(me, env).builder) return no('poi-not-builder', 403, origin);
          const put = await readBody(request, POI_DRAFT_BODY_MAX);
          if (put === undefined) return no('too-large', 413, origin);
          if (!put) return no('body', 400, origin);
          return answer(await shelve(pctx, me, env, { item: put.item }));
        }
        if (route === 'asset' && request.method === 'GET') {
          const r = await getPoiAsset(pctx, poiPath.sha, poiRolesOf(me, env));
          return 'error' in r ? no(r.error, r.error === 'no-storage' ? 503 : 404, origin) : poiAssetResponse(r, origin);
        }
        if (route === 'asset' && request.method === 'PUT') {
          // A RAW BODY, against its kind's own bound (as a save's is), read only for a builder
          if (!poiRolesOf(me, env).builder) return no('poi-not-builder', 403, origin);
          const kind = url.searchParams.get('kind');
          if (kind !== 'mesh' && kind !== 'texture') return no('poi-kind', 400, origin);
          const raw = await readCapped(request, POI_ASSET_MAX[kind]);
          if (!raw) return no('too-large', 413, origin);
          if (!raw.byteLength) return no('body', 400, origin);
          return answer(await putPoiAsset(pctx, me, env, { sha: poiPath.sha, kind, bytes: raw }));
        }
        if (route === 'draft' && request.method === 'PUT') {
          if (!poiRolesOf(me, env).builder) return no('poi-not-builder', 403, origin);
          const draft = await readBody(request, POI_DRAFT_BODY_MAX);
          if (draft === undefined) return no('too-large', 413, origin);
          if (!draft) return no('body', 400, origin);
          return answer(await savePoiDraft(pctx, me, env, { doc: draft.doc, base: draft.base ?? null }));
        }
        if (request.method === 'POST') {
          if (route === 'submit') return answer(await submitPoi(pctx, me, env, { id: body.id, rev: body.rev }));
          if (route === 'withdraw') return answer(await withdrawPoi(pctx, me, env, { id: body.id, rev: body.rev }));
          if (route === 'retire') return answer(await requestRetire(pctx, me, env, { id: body.id }));
          if (route === 'review') return answer(await reviewPoi(pctx, me, env, { id: body.id, rev: body.rev, verdict: body.verdict, note: body.note ?? null, docSha: body.docSha ?? null }));   // AUDIT POI S1: what the approver saw
          if (route === 'rollback') return answer(await rollbackPoi(pctx, me, env, { id: body.id, rev: body.rev }));
          if (route === 'unshelve') return answer(await unshelve(pctx, me, env, { id: body.id }));
        }
        return no('method', 405, origin);
      }

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
              session: who.session?.id ?? null,   // SESSION-SIGN (AUDIT PLAN-1000 E3): the save asks its session and the ban itself
            }, raw, raw.byteLength);
            // a sequence refused says the service's own, so a tab whose last answer was lost can resync (never a way in:
            // the write still needs the lease)
            if (r.error === 'seq') return json({ error: 'seq', seq: r.seq }, 409, origin);
            if (r.error === 'banned') return json(bannedAnswer(r.player), 403, origin);   // E3: a ban under a pass, at once
            if (r.error === 'frozen') return json(frozenAnswer(r.player), 403, origin);   // STAFF-PANEL5-FREEZE: a freeze under a pass, the same
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
        if (path === '/v1/realm/create') return leased(await createRealm(rctx, me, { name: body.name, summary: body.summary, lineage: body.lineage, person: body.person }));   // LEGACY7: born as a person of the account's own line
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
        // LEGACY7 (legacy.js): Project Legacy's lines - listed, written past their rev (a stale write answered with the
        // stored record, to merge into), and a fallen character's tombstone under its lease
        if (path === '/v1/realm/lineages') return json({ lineages: await listLineages(rctx, me) }, 200, origin);
        if (path === '/v1/realm/lineage') {
          const r = await putLineage(rctx, me, { id: body.id, record: body.record, base: body.base ?? null });   // AUDIT LEGACY III A2: the rev it was made from
          if (r.error === 'lineage-stale') return json(r, 409, origin);
          if (r.error === 'lineage-law') return json(r, 400, origin);   // INT18: which of the family's laws the copy broke
          return answer(r);
        }
        if (path === '/v1/realm/die') return answer(await realmDie(rctx, me, { id: body.id, lease: body.lease, why: body.why, hold: body.hold ?? false }));   // LEGACY7 part three: 'retired' keeps a union; REZ-BLOODLINE AUDIT R1: `hold`, the death door's fall a Resurrect may take back
        if (path === '/v1/realm/raise') return answer(await realmRaise(rctx, me, { id: body.id, lease: body.lease, diedAt: body.diedAt }));   // REZ-BLOODLINE AUDIT R1: a party's Resurrect inside the hold, under the lease that fell
        // LEGACY7 part three: a half of one wedding, and the account's unions
        // AUDIT LEGACY III O1/O3: the other's character as the relay stamped it, and a half taken back
        if (path === '/v1/realm/wed') return answer(await realmWed(rctx, me, { id: body.id, lease: body.lease, sid: body.sid, partner: body.partner, partnerChar: body.partnerChar, withdraw: body.withdraw === true }));
        if (path === '/v1/realm/unions') return json({ unions: await listUnions(rctx, me) }, 200, origin);
        // /v1/realm/delete - HOUSE-LOSS: which undoes one too, for a door that asks a delete. ACCOUNT-HOMES: the homes it
        // bought go with it (QUEST-HOME's `moved`), and their towns' kept yards are let go as a decor write lets them go (YARD-SHED)
        const deleted = await deleteRealm(rctx, me, body.id);
        for (const { mapId } of deleted?.moved ?? []) forgetYards(mapId);
        return answer(await homeOrdersOf(deleted, me, env, subtle, nowS));   // QUEST-HOME: its homes a house again to every page online
      }

      // a path this service serves, reached with a method it does not
      return no('method', 405, origin);
    } catch (e) {
      return thrown(path, e, origin);   // AUDIT ONLINE A17's law, on this side too; SCALE4f: an overloaded primary counted apart
    }
  },
};

export default {
  fetch: (request, env, exec) => measured(request, env, service.fetch, exec),   // AUDIT SAFE DISCORD-4: the ExecutionContext, for waitUntil
  // SCALE4b: THE SERVICE'S OWN CLOCK - wrangler.toml's [triggers] crons, each firing its list (cron.js), the sweeps no
  // read runs any more and the settlements every read now nearly always finds done
  scheduled: (controller, env) => runCron(env, { cron: controller?.cron, nowS: Math.floor(Number(controller?.scheduledTime ?? Date.now()) / 1000) }),
};
