# The Realm

Online characters are realm characters: born online, their truth held by the account service, their saves checkpointed
under a lease, their gold and goods moved by service transactions. Offline characters stay exactly as they are, the
local save their truth. An offline character crosses into the realm once, through customs; a realm character can be
copied to offline but never comes back. The realm also carries the online economy's faucets and sinks. The player meets
it at the Online door (realm characters only, **Bring online** on an offline tile, **Copy to offline** on a realm tile),
and in the prices and rules that differ online.

## How it works

**Two lanes.** Offline, the local save is the truth and every mod switch, URL flag, loan cap and console command is the
player's. Online, the service holds a `realm_characters` row (id, account, `seq`, lease, summary, flags) and the save
blob in R2 (`server-account/src/realm.js`); the client keeps a working copy under its own key, which offline Load never
lists. A realm character's id is minted by the service. The Online door lists realm characters; offline Load lists
offline slots.

**The save protocol** (`src/systems/realmSaves.js` `createRealmSession`).
- *Join*: the service grants a lease on the character (ONE-SEAT, by character) and returns the blob and `seq`. The blob
  comes from the service, never a local slot.
- *Checkpoint*: `{seq + 1, blob, summary}` every `ONLINE_CHECKPOINT_MS` (5 minutes,
  `src/systems/online/onlineCheckpoint.js`), before every hand-over, when the seat is lost, and on exit. The service
  takes a checkpoint only from the lease holder and only at `seq + 1`, so an old tab, a second device, a backup or an
  edited copy cannot write.
- *Packed*: a save rides gzipped when the service says it opens one (`src/net/realm/realmSaveCodec.js`; gzip's magic
  bytes tell the forms apart, bounded by `REALM_TEXT_MAX_BYTES`).
- *Rescue*: a save the service has not taken is kept on the device with the `seq` it follows
  (`keepUnsent`, after `REALM_UNSENT_GRACE_MS`, at once on a hidden page, or on a refused put), packed if large. A join
  whose record still stands at that `seq` plays the kept copy; a record past it sets the copy aside, and the tile offers
  **Recover it**.
- *Counters*: a trade counter's staged lot is written at the pack's end (`src/systems/item/heldOut.js`), so a checkpoint
  under an open Identify or sale never drops it.

**Hand-overs are service transactions.** A trade between realm characters is escrowed on the service
(`server-account/src/realmTrade.js`, `/v1/realm/trade`): both offers checked against both records, applied at once,
both `seq`s raised. A guild's founding, deposits and withdrawals, home claims and sales, decor, card-table stakes and
gate and broker grants move gold on the character's record in the act's own batch, both sides or neither.

**Validation.** Every checkpoint is judged by the Integrity arc (`06-Systems/Integrity-Arc.md`): what breaks the law or
the budget holds the character's trade for review, never a refused checkpoint. A first save is checked
(`firstSaveRefusal`): a newborn must be level 1, within `REALM_BIRTH_WEALTH_MAX` (10,000), carrying a creation's 35
skills and one unique career; a customs character within its level's allowance. The online level cap is `LEVEL_CAP`
(45, `src/systems/levelCap.js`).

**The door at the servers.** The token mint signs whether the named character is one of the account's realm
characters (`rc`), and the relay refuses a non-realm character in every room, so an old build cannot bring an offline
character online.

**Customs** (`src/systems/realmCustoms.js`). **Bring online** runs on a copy and shows the result first. Every loan is
called in; liquid wealth is capped at the level's allowance (`src/net/realm/realmGoldLaw.js`, one law at both ends);
skills, items and the custom class are brought within online rules. Every deed (house, ship, the pieces bought for its
room) crosses marked, and the realm's bank never buys a crossed deed back (`CUSTOMS_HOUSE_PRICE` sets its weight).
Online homes, the guild place and the Renown track cross with the character. Only a character the service saw before
the realm (the census, frozen at the realm's start) may cross, once; a developer may grant an account one
**customs pass** (`/v1/mod/customs-pass`, `tools/customsPass.mjs`). An Oblivion-leveling character crosses onto
Daggerfall's leveling (`crossLeveling`).

**Copy to offline** writes the realm save as a new offline character with a new id, marked as a copy, so its tile says
why it cannot be brought online.

**The economy online.**
- *URL powers refused*: `?shot`, `?fly`, `?nofoes`, `?tp`, `?class`, `?spell`, `?weapon`, `?spawn`, `?region`, `?loc`,
  the clock and sky overrides and the editor (`src/systems/online/onlineLane.js` `ONLINE_REFUSED_FLAGS`).
- *Balance mods are the room's*: every key of the balance mods reads the room's value (`ONLINE_WHOLE_MODS`).
- *One lender*: one Empire loan per character wherever it stands, a default anywhere shuts every branch, and the Empire
  keeps one account across branches (`src/systems/banking.js`).
- *Vendor spread*: a shop pays at most `ONLINE_SALE_SHARE` (half) of the least it asks for the piece, with Mercantile and
  Personality read within `ONLINE_HAGGLE_MAX` (100). Under that ceiling the seller's skills still count at
  `ONLINE_SALE_SKILL_WEIGHT` (half strength) of Daggerfall's slope (`src/systems/shopStock.js` `calculateTradePrice`).
  Buying is untouched; offline DFU's haggle stands.
- *Pile gold* is divided back by the level, never below one piece (`src/systems/loot/loot.js` `unlevelPileGold`).
- *Broker items* are bound to their buyer.
- *Shared quest gold* is split across the copies held (`src/systems/quest/actions.js` `shareQuestGold`).

## Rules

- Offline characters cannot bring massive resources online; the realm is a true separation that still allows offline
  play, with a balanced economy, no duping and no overpowered online builds (Mac).
- An online character's truth is the account service (Mac).
- A realm character plays only online; Copy to offline forks it (Mac).
- Existing characters migrate once through customs; new realm characters start fresh (Mac).
- Custom classes stay online with rebalanced points (Mac).
- Customs admits any pre-realm trace; homes and guild places cross; all loans are called in, with a confirm screen
  first (Mac).
- Characters stranded outside the census enter by a staff customs pass (Mac).
- Deeds at customs: keep all, cannot sell; homes a deleted customs character took go back to the offline character
  (Mac).
- An edited device copy as a way in is accepted for now; the server-side checks answer it (Mac).
- Online selling: whatever is most balanced (Mac) - the half stays the ceiling, skills count under it.
- The proposed numbers (allowance, spread, tax, upkeep, death fee) stay open; each is a named constant.

## Code and tests

- `server-account/src/realm.js`, `server-account/src/realmTrade.js` - the realm's records, leases, checkpoints, first
  save, trades and gold acts
- `src/systems/realmSaves.js` - the client session, rescue copy, recovery
- `src/systems/realmCustoms.js`, `src/net/realm/realmGoldLaw.js` - customs and the wealth law
- `src/net/realm/realmSaveCodec.js` - packed saves
- `src/systems/online/onlineLane.js`, `src/systems/online/onlineCheckpoint.js` - online refusals and checkpoints
- `test/systems/realm0.test.js` - refused flags, locked mods, the lender, the faucets
- `test/server/realm1.test.js`, `test/server/realm2.test.js`, `test/systems/realm3.test.js`, `test/net/realm4.test.js`,
  `test/net/realm5.test.js`, `test/server/realm6.test.js` - records, sessions, the door, customs, trades, gold acts
- `test/systems/auditrealm2_service.test.js`, `test/systems/auditrealm2_customs.test.js`,
  `test/systems/auditrealm2_client.test.js`, `test/systems/auditrealm.test.js` - the audits
- `test/server/fb0929_customs.test.js`, `test/server/customspass.test.js` - who customs admits
- `test/net/realmdoor.test.js` - the door at the servers
- `test/net/realm_gzip.test.js`, `test/server/rescuesave.test.js`, `test/net/realm_restore.test.js` - packed saves,
  the rescue copy, restoring lost homes
- `test/systems/realm_copy_mark.test.js` - the offline copy's mark

## Open

- A modified client can still invent loot inside the budgets; the budgets bound it and the item id ledger catches
  copies. Removing it needs the service to roll loot.
- A customs allowance is read at the level the customs call states; the census holds no level to check it against.
- Why saves grow: never-pruned parts (building discovery, the notebook archive, the scene cache) are unmeasured.
- A build from before the realm still reports Renown XP while shut out, bounded by the hour's cap.
