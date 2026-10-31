# Integrity

The world runs on each player's own machine, so a modified client can lie about what it found, how hard it hit and how
much it was hurt. Integrity is the set of checks that keeps such a lie from reaching another player: what a character
holds is judged by the account service, every blow between players is refereed by the relay, a boss fight is counted by
the relay, and a peer's word is bounded at the reader. Players meet it only when it refuses something: a held trade, a
locked piece, a blow clipped.

## How it works

### The principle and its limit

A kill, a chest's contents and a price stay the client's word; the simulation is not moved to a server. What changes is
what that word can buy. Everything another player can see, take or be ranked against is decided where the client cannot
reach it. A modified client can still invent lawful loot at the rate an honest player earns. It cannot carry an
impossible piece, or a copy that keeps its id, to another player through the service.

### The economy

- **The item law** (`src/systems/item/itemLaw.js`) answers one question: could an honest client have minted this item?
  The account service asks it of every item in a realm checkpoint, a listing, a trade and a vault deposit
  (`server-account/src/judge.js`); the client asks it of every item a peer hands it, through
  `src/systems/loot/loot.js` `validLootItem`. A finding is a proof: the law holds only rules every producer keeps.
- **Ids and the ledger** (`src/systems/item/itemIds.js`, `server-account/src/ledger.js`): each piece has an id. A copy
  locks the copied piece, never the character.
- **The verdict** (`server-account/src/verdict.js`) is written in the same batch as the checkpoint. A held character
  cannot hand value to another player; reasons are `staff`, `law` and `budget`. A law hold clears at the next clean
  checkpoint until `STRIKES_FOR_TIMED` holds have come; then it is timed (`LAW_HOLD_S`, then `LAW_HOLD_REPEAT_S`) and
  lifts on its own. Strikes fade after `LAW_FADE_S`. Staff can excuse a finding they judge wrong.
- **The wealth budget** (`server-account/src/budget.js`): between checkpoints, wealth may rise by what the service saw
  (a market sale, a vault piece, a signed win's spoils) and by a bucket that fills with time played, which the service
  measures itself. It ships with `enforce` off: a gain past the bucket is recorded for staff and holds nothing.
- **A crafted piece** listed, auctioned or filled to a commission leaves its seller's record
  (`server-account/src/craftedPiece.js`).
- **A peer's word** never hands on a letter of credit (`src/systems/peerWord.js`), and a peer's price is held under the
  law's ceiling (`lawPriced` in `src/systems/loot/loot.js`). A purse past `GOLD_INT_MAX` is a law finding.
- **The review**: staff read findings, gains and trades through `server-account/src/review.js` and
  `tools/realmReview.mjs`.

### Fights between players

One referee law (`src/net/siege/siegeRef.js`) runs under sieges, the Royal Tourney, the arena, duels
(`src/net/duel/duelRef.js`) and the open zone (`src/net/wild/wildRef.js`). The relay holds both fighters' vitality and
judges each blow from the striker's look, clipped to the arms the identity token signs (`armsOf`, at most
`ARMS_TOP_MAX`). A spell between players is a number the relay clips (`SIEGE_CASTS`: a rate and a most per cast). No
target's machine applies a peer's harm. A duel's winner and a fall's drop in the open zone are receipts the relay signs
and the account service settles (`src/net/duel/duelReceipt.js`, `src/net/wild/wildReceipt.js`). A duel is outdoors
only.

### Boss fights

In a gate's court, an Abyss Dungeon and a serpent's waters, the relay judges the boss's blows itself from the poses it
holds (`src/net/bossRef.js` `judgeGate`, `judgeRemnant`, `judgeSerpent`) and keeps its own count of each fighter's
body or ship's hull (`src/net/bossBody.js`). The count measures first: each boss receipt carries what it saw. Once
staff set `enforce`, a body the count takes to nothing falls by the relay's word and rises no sooner than
`BODY_RISE_MS`.

### Progression

Every progression claim (Renown, a raid's cleanse, a bounty, the Watch, a silver find, profession XP) is asked of the
account's seated, unheld realm character first (`server-account/src/progress.js` `progressRefusal`), and each stream
is a bucket that play fills, measured first. A family line's record is held to its own law
(`src/systems/legacy/legacyLaw.js`).

### A peer's foes

A reader believes no more of one owner's foes than one honest frame holds, at most `PEER_ELITE_PUPPETS_MAX` elites and
`PEER_REVENANT_PUPPETS_MAX` revenants, and champions within `PEER_CHAMPION_PUPPETS_MAX` (`src/scenes/exteriorFoes.js`).
Server-rolled spawns are in `bible/11-Multiplayer/Spawn-Grants.md`.

## Rules

- The world stays simulated on the client; the server judges only what crosses to another player
  (`bible/11-Multiplayer/Multiplayer.md`).
- A breach freezes trading, never progress: a checkpoint that breaks the law is stored, and every route that hands value
  to another player refuses it (Mac).
- Budgets: measure first, then enforce. The wealth budget, the boss count and the progression buckets ship measuring;
  staff turn `enforce` on (Mac).
- Characters already in the realm: items judged, wealth baselined (Mac).
- No hold waits on a person: a copy locks its piece, a repeated law hold is timed and lifts on its own (Mac).
- A finding is a proof, never a guess: the item law carries only rules every honest producer keeps
  (`test/systems/item/int1_itemlaw.test.js` mints through the producers and expects no finding).

## Code and tests

- `src/systems/item/itemLaw.js` - the item law, both ends
- `server-account/src/judge.js`, `server-account/src/verdict.js` - the checkpoint's judgement and hold
- `server-account/src/ledger.js`, `src/systems/item/itemIds.js` - ids and copies
- `server-account/src/budget.js` - the wealth budget
- `server-account/src/progress.js` - progression claims
- `src/net/siege/siegeRef.js`, `src/net/duel/duelRef.js`, `src/net/wild/wildRef.js` - the PvP referee
- `src/net/bossRef.js`, `src/net/bossBody.js` - boss fights
- `src/scenes/exteriorFoes.js` - a peer's foes bounded
- `test/systems/item/int1_itemlaw.test.js` - the law against every honest producer
- `test/server/int16_progress.test.js` - progression claims
- `test/server/autohold.test.js` - timed holds and locked pieces
- `test/scenes/foeforge.test.js` - a forged foe frame against an honest one
- `test/systems/hackedgold.test.js` - letters and prices on a peer's word

## Open

- The wealth budget, the boss count and the progression buckets measure and do not enforce until staff turn them on.
- A magic item whose bounds live in ARENA2 data (MAGIC.DEF, SPELLS.STD) is bounded by the budget and ids, not proven by
  the law.
- A forged sender can still stand a frame's worth of plain foes; each sender is counted apart.
- A class foe's level and weapon, and which foe is a champion, are the owner's word.
