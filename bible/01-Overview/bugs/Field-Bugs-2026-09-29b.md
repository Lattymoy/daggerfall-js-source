# FIELD BUGS 2026-09-29b - the character an old build stranded

From the Discord, through Mac, as one screenshot. Gryphoth:

> "Hey I had an issue I think came from a version mismatch, I was playing online on a new character, went to trade
> with someone and it said my client was outdated. So I logged out, updated and when I logged back in my character was
> no longer online, and when I go to bring him online it says he has no renown or guilds and cant be brought online."

Mac, asked what becomes of a character stranded that way, chose **"Staff customs pass"** (`06-Systems/Realm-Arc.md`
Decision 9).

## REALM-DOOR: online is the realm's at the servers, not only in the new build (the root cause)

**Reproduced first**, on the base, over the real account Worker and the real relay Room under one key pair: the
service signed an identity token for an offline character's id - what a build from before the realm names at its
mint - and the relay WELCOMED it, in a place room and in the hub; customs refused the same character
`customs-never-online`. `test/net/realmdoor.test.js`'s first pin is that story, with the door now shut.

**Why.** The realm (REALM P1, main at f4dc60ce, 2026-09-28 23:38:54 UTC) was the new build's law alone. Its boot never
takes a local slot online (`world.js` `realmRefused`) and its Online door lists realm characters only - but neither
server ever asked. `/v1/auth/token` minted for whatever character a client named, and the relay admitted any token it
could verify; the realm never touched the relay at all (world124 before and after it). So a build from before the
realm - a tab left open across the deploy, or the desktop app's portable exe and macOS copies, which never update
themselves (`01-Overview/Desktop-App.md`) - went on playing online exactly as before, a character made after the
census froze included. Nothing told its player until a trade with a realm-era peer failed: the realm side cancels a
hand-to-hand trade with "They are playing an older build - both must reload to trade." (`tradeSession.js`
`OLDER_BUILD_TRADE_TEXT`), and an older build offered a piece it does not know says "reload for the newest version"
(`tradeUnreadableText`) - Gryphoth's "my client was outdated", whichever of the two he read. Updated, the new build
found an offline character (a local slot, which the Online door offers only through customs), and customs refused it:
the census is frozen at the realm's start (AUDIT REALM L1-F5 - a Copy to offline's new id gathers traces too), and a
character made after it has no trace from before it. Customs was right; the door was open.

**The fix.**

- **The service signs the realm's word on the character** (`server-account/src/index.js` `/v1/auth/token`, `realm.js`
  `realmCharacterHeld`): `rc` 1 when the character the mint names is one of the account's realm characters, else 0 -
  an offline id, another account's character, one deleted, none named. Stamped on every mint from acct22.
- **The relay refuses a 0 at its door** (`server/src/index.js` `_named`, world130): in every room, before anything is
  written, with `REALM_DOOR_WORD` (`net/wire.js`) - "this game is out of date - update it to play online (restart the
  app, or reload the page)". A build from before the realm prints a relay's refusal as it stands ("online: ..." on the
  HUD, "chat: ..." under the chat box) and never retries a policy close, so its player is told the one thing to do. A
  token with no `rc` is a service from before acct22 - the relay and the service deploy on their own, in either order -
  and is admitted as it was; once acct22 stands no mint lacks it, and a token lives five minutes.
- **A realm-era tab names the realm character it joined** at the mint (`world.js` identity minter: the realm session's
  id, never an id the save carries or `characterIdOf` mints), and one the door refuses anyway - its character deleted
  elsewhere, or its account signed out and another in - goes to the Online door with the realm's own word
  (`realmSaves.js` `realmDoorShut`, the online frame's first question), never the old build's "out of date".

Pinned: `test/net/realmdoor.test.js` (6), `tools/mutants/realmdoor.json` (12 mutants, 12 dead).

## CUSTOMS-PASS: the characters already stranded (Mac: "Staff customs pass")

The census stays frozen: it is the law that keeps a Copy to offline from coming back in. The exception is a person's.
A developer grants an account ONE open pass (`POST /v1/mod/customs-pass`, `realm.js` `grantCustomsPass`, migration
0024), and that account's next Bring online of a character its census does not count comes in once - through customs
exactly as any does: the loans called in, the wealth capped at the level's allowance, the first save read, all in
`customsRealm`'s own guarded write. The pass is spent on that character and keeps whom and when (`origin_id`,
`spent_at`); it is never spent on a character the census admits anyway, and it never lets in a character already
brought in from any account - its census spent, or a realm character standing on it. One open pass an account; a
revoke takes back an open one and never a spent one. The refusal a stranded player meets now says where to ask.

**The tool** (`tools/customsPass.mjs`): `node tools/customsPass.mjs <name>` - a handle, or a guest's two-word name
exactly as the game shows it; `--account <id>` when two guests share a name; `--revoke` to take one back. Signed in
as a developer (a handle in `DEVELOPER_HANDLES`) with `DAGGER_HANDLE` and `DAGGER_PASSWORD`, which it signs out again,
or `DAGGER_SECRET`.

Pinned: `test/server/customspass.test.js` (6), `tools/mutants/customspass.json` (14 mutants, 14 dead).

## The realm6 flake, explained

FIELD BUGS 2026-09-29 noted that `test/server/realm6.test.js`'s end-to-end sale failed once under load and could not say why.
It failed again in this batch's second full run (the sequence 3 where 4 was asked). The cause: `realmSaves.js`
`realmGoldAct` sends the outcome's checkpoint and does not wait for it - by design, as the host never does - and the pin
read `session.seq` right after the act, so a checkpoint answered later than the record read beside it (a loaded
machine's WebCrypto and SQLite) was not yet counted. Made to happen every time by answering the checkpoint's PUT 5 ms
late, it failed; the pin now waits for the checkpoint the act sent, and passes so, and eight times at once. The game's
code is unchanged: nothing there reads the sequence the pin did.

## For Mac

- **Gryphoth, once this deploys:** `DAGGER_HANDLE=<yours> DAGGER_PASSWORD=<yours> node tools/customsPass.mjs <his
  account's name>` (his handle, or his guest name exactly as the game shows it), then ask him to press **Bring online**
  on that character. It asks first, as every Bring online does, showing what customs calls in and caps.
- **The deploy drops every connected player once** (world130, as every relay bump does), and the account service
  deploys acct22 with migration 0024. Either may land first; until both have, the door stands open as before.
- **Anyone still on a build from before the realm is refused online from then on**, told to update. The macOS app and
  the portable exe never update themselves: their players download the new build.
- **Left open:** a build from before the realm still reports Renown XP to its account while it plays on shut out
  (the report names no character since RENOWN-ACCOUNT - RENOWN-CHAR, later that day, made it name its character again,
  so the XP lands on that offline id's track) - bounded by the hour's cap, and Renown XP is already on
  Realm-Arc's list of what the client is trusted with until phase 3's budgets.
