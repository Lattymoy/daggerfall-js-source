# THE REALM: online characters, the economy and balance (REALM)

Mac, 2026-09-27, after EMPIRE-BANK: "I want to make sure players cant take an offline character and bring in massive
resources", then: "I wanna do this as comprehensively as possible. A true separation while allowing people to still
play offline. Honestly I also want to take into account of how we can balance the gold economy, eliminate duping,
eliminate true overpowered builds online, and overall bring the experience more in line with a balanced MMO".

**Status: phases 0 and 1 BUILT on the branch (2026-09-28); decisions 1-4 taken.** Phases 2-5 are next. Items still marked **OPEN** are Mac's call. The research behind it was
read on main at 6108d8bd. Code is cited by file and symbol, not line, so the page survives drift.

## What this supersedes, for online characters only

Offline play keeps every one of these decisions exactly as it stands.

- `Accounts-And-Cloud-Saves-Arc.md`: "THE LOCAL SAVE STAYS AUTHORITATIVE", and the service header
  `server-account/src/saves.js`: "THE CLOUD IS A BACKUP. THE LOCAL SAVE IS THE TRUTH". Online, the service holds
  the truth.
- `11-Multiplayer/Multiplayer.md`:
  - inventory and gold "never leaves their browser";
  - "There is no anti-cheat in v1 and no plan for one".
- `Online-Arc.md`'s opening line: "bring your own developed character into a massive server".
- Port-Ledger F304, where the URL power flags were left in ("DECIDED: leave them"). That holds offline; online
  refuses them.

## Where things stand

### The trust boundary

- **The Online door lists every local slot.** The pieces are `src/main.js` (the Online choice sets `load`, `online`
  and `loadkey`), `src/systems/saveSlots.js` `restorableSaves`, and `src/ui/enhancedMenu.js`.
  - `online` is only a URL flag (`src/systems/onlineLane.js` `isOnlinePage`).
  - The save is plain JSON with no signature or hash. Its only gate is `SAVE_VERSION` (`src/systems/save.js`).
- **Online progress writes into every slot of the character.** Closing an online tab saves them all
  (`world.js` `beforeunload` and `saveSlots.js`). The only thing held back is Renown's health and magicka layer.
- **Character ids are minted by the client** (`src/systems/characterId.js`). The service checks their shape only
  (`server-account/src/service.js` `CHAR_ID_RE`), so one character can sit on two accounts.
- **ONE-SEAT is per account, not per character** (`src/net/oneSeat.js`, and the hub's `cl` claim in `server/src/index.js`).
- **The hub has two identities:** a browser-minted social id for friends and parties, and the token's `sub` for
  seat, guild and Renown.
- **What the service holds:**
  - guild treasuries, on the client's word;
  - the homes registry, at a price the client names;
  - decor;
  - Renown tracks, bounded per account per hour;
  - gate kills, letters and duels.
  - Everything else is the save's. In the code's own words: "The gold is the save's, as all of it is" (`server-account/src/decor.js`) and "The GOLD is the client's" (`server-account/src/guilds.js`).
- **What the client is trusted with:**
  - PvE damage, up to 10,000 a blow (`dungeonContext.js`);
  - loot grants ("A forged item still lands, at its true price", `src/systems/loot.js`);
  - trade goods ("the price of having no server-side inventory", `src/net/tradeSession.js`);
  - Renown XP, within its caps;
  - guild deposits and home prices.
- **The relay checks shape and rate only.** It is authoritative for one thing: the gate boss (`src/net/gateBrain.js`).

### Duplication and rollback

Items have no unique ids: "the port's items have no UID" (`save.js`), and "the port's item IS its UID"
(`inventory.js`). Nothing on the service keeps a save's history: no sequence number, no watermark, no ledger.

1. **Give something away, then skip the exit save.** An exit save cannot fire in three cases, and there is no periodic
   online autosave:
   - a second tab takes the seat, and the old tab never saves (`seatOut`);
   - the player dies, and the tab closes on the death screen;
   - the page is killed (a phone gets no `beforeunload`).
   Load the older save and the goods are back.
2. **Bring back an older copy.**
   - An imported export zip adds a slot and never overwrites one (`saveTransfer.js`).
   - Downloading a cloud card has no age check (`cloudSaves.js`).
   - The exit save writes only the first of two twin slots.
3. **One character on two accounts.** Copy the save to a second browser or account. Nothing binds the character id.
4. **Trade.** An honest client fails toward loss, as `tradeSession.js`'s law says. A modified client can commit and
   keep its goods, because nothing checks that the sender removed them.
5. **Guild deposit.** The service never sees the purse. Roll back and deposit again, or deposit from a tab that lost
   the seat.
6. **Homes and guild founding.** The claim lands first and the purse pays after. Roll back, then sell for 85% of the
   client-named price. A guild founded this way is free.
7. **Decor and stations.** The service is written first and the client pays after. `moveDecor` rewrites `paid` and
   `station` on the client's word, and station fees never reach the service.
8. **Shared containers.**
   - Two players open the same chest: "both take it and both keep it" (`Online-Arc.md`).
   - A non-host takes, leaves, and re-enters before the host's 15-second publish.
   - The last close writes the whole list.
9. **Gate spoils.** The crash record hands the pieces back at every boot until a save of the character lands.

**Safe today:**
- decor made of the player's own items (`decorItems.js`);
- home storage and visitor drops;
- player corpses, private drops, wagons;
- quest items, which cannot be traded.

### The economy

**Sources:**
- **Corpse gold.** Unleveled Loot turns it from level-scaled to luck-scaled.
- **Pile gold.** Unleveled Loot's hook that divides pile gold by level is never called (`unleveledLoot.js`), so pile
  gold grows with level.
- **Hourly respawn, online only.** Dead layout foes and emptied piles come back after one real hour.
- **Loot rarity.** Forced on online. Luck adds 2 per mille over 50 to every threshold (`lootRarity.js`).
- **Quest gold.** At most about 7.5k. A shared quest pays every member their own roll (`questShare.js`).
- **Gate spoils.** Per account, per gate, and a gate comes every 2 real hours:
  - 250 × level × (0.8 to 1.2) in gold;
  - a Sigil Stone;
  - one Rare or Legendary piece and two Magic-or-better pieces;
  - a Regalia piece one time in six.
  Items plus the stone average about 27k at level 10 and 33k at level 30. The full payout goes to anyone who stands
  alive through half the fight (`gateSpoils.js`, `gateBrain.js`).
- **The Sigil Broker.** Six offers a day at 2, 3, 3 and 6 stones. The average item value is about 14.5k per stone. A
  stone sells to a shop for about 3.7k to 5.9k. A Regalia plate sells for 117k to 222k. "no server checks a sale"
  (`sigilBroker.js`).
- **Selling to shops.** DFU's formula verbatim (`shopStock.js`). A quality-1 shop pays more than it charges from
  Mercantile 2. Travel online is instant and free, so buying in one region and selling in another also pays.
- **Loans.** Each region lends separately (`banking.js` `borrowDecision`). A default costs a reputation drop in that
  region only (`settleOverdueLoan`), and there are up to 62 regions. Roleplay & Realism's `loanAmountPerLevel` stays
  the player's own setting online.

**Sinks:**
- **Mostly one-time:** stations at 50k, 100k and 200k; ships; houses; Daedra summoning.
- **Small and recurring:** training, repairs, identify.
- **None at all:** taxes, upkeep, and any cost for dying online. A dead player respawns at 50% health
  (`deathRespawn.js`). Prison serves no days online.

**Holes:**
- **Settings the player still controls online that change loot value.** The online lane forces only `Enabled` for
  most mods (`onlineLane.js`). The online-lane pin checks on/off switches only, so none of these are caught:
  - Unleveled Loot's material remaps: Iron → Daedric turns a 300-gold cuirass into a 153,600-gold one;
  - RRI's `conditionBasedPrices`;
  - Roleplay & Realism's `loanAmountPerLevel`.
- **Cheat flags work online.** `?shot` installs `window.__addGold`, and nothing refuses `?shot` online. `?fly`,
  `?nofoes`, `?tp` and `?timescale` also work online (F304).

### Power

- **Spell cost floor.** Cost is `trunc(gold × (110 − skill) / 400)` with a floor of 5 (`spellcost.js`), and skill
  values are never capped (`skills.js`). At 110 in a school, every spell in it costs 5 SP. Enhances Skill (+15, and
  it stacks), a skill affix (up to +30) and Mora's Mantle get a character there. Magnitude per level makes spells of
  2,000 to 3,000 points: damage, a Shield pool, or Regenerate per round.
- **Custom classes.**
  - Immunity costs 10 points for any element (`specialAdvantages.js`).
  - Disadvantages that cost a warrior nothing pay for six immunities plus Regenerate.
  - Attributes can be set freely within the 400 total.
  - Class files can be imported.
  - Nothing checks any of this online.
- **The item maker.** Side effects add budget at no gold cost (`enchanting.js`), and several never fire on worn gear:
  Weakens Armor (−700), Health Leech "whenever used" (−4,000). On top of that:
  - Daedric triples an item's power;
  - an item takes 10 enchantments;
  - Extra Spell Points stacks;
  - magic repairs are forced on online.
- **Stacking.**
  - Luck lifts every rarity threshold.
  - Affix bonuses sum with no cap (`entityMods.js`), and resistances that sum to 50 give immunity.
  - PCAAO critical hits scale with a skill that has no cap.
  - Backstab is certain at 100.
  - Set powers multiply on top (Nightfall +60% against an unaware target).
- **Online settings the player still controls.**
  - PCAAO's modules: `fixedStrengthDamageModifier` off doubles the strength bonus, and `fadingEnchantedItems` off
    stops enchanted gear breaking for good.
  - Oblivion leveling's settings: up to 40 attribute points a level.
- **Rest.** A rest online restores everything and runs a skill check in seconds. The shared clock runs at 12×, so the
  skill clock opens every 30 real minutes.
- **Already restricted:**
  - duels clamp stats, level and material and strip enchantments;
  - the gate boss has a damage budget;
  - party scaling;
  - clamps on spells cast on other players;
  - HOME-MAGIC;
  - Test Room characters are refused online.

## The design

### 1. Two lanes, two truths

- **OFFLINE characters** stay exactly as they are today. The local save is the truth, and every mod switch, URL flag,
  loan cap and console command belongs to the player.
- **ONLINE (realm) characters:**
  - They are born online, through the Online door's own character creation.
  - Their character id is minted by the service and bound to the account.
  - The service holds the truth: a `realm_characters` row (id, account, `seq`, lease, summary, flags) plus the save
    blob in R2, which the existing cloud-save store already holds.
  - The client keeps a working copy.
- **The doors:** the Online door lists realm characters only, and offline Load lists offline slots only.
- **Realm characters never load offline.** "Copy to offline" forks a snapshot into a new offline character with a new
  id. Nothing played on the copy ever comes back. **OPEN, decision 2.**
- **Offline to online:** **OPEN, decision 3.** Recommended: no ongoing import. There is a one-time migration at
  cutover for characters that have already played online, through customs (section 6).

### 2. The realm save protocol

- **Join.**
  - The service grants a lease on the character: ONE-SEAT, taken from the account to the character.
  - It returns the blob and `seq`. The blob always comes from the service, never from a local slot.
- **Checkpoint.** The client writes `{seq + 1, blob, summary}`:
  - every 2 real minutes;
  - before any hand-over (section 3);
  - on exit.
  The service takes a checkpoint only from the lease holder, and only at `seq + 1`. So these can never write again:
  - an old tab or a second device;
  - a restored backup, an import, or an edited copy.
  A copy of the blob is also worthless as a way in, because the Online door loads only from the service.
- **Crashes.** A crash loses at most two minutes of play, and never a hand-over, because every hand-over is settled on
  the service first.
- **Local slots never hold a realm character's truth.** A local copy is a cache under its own key, so offline Load
  never lists it.
- **The hub gets one identity per player.** Friends, parties, the seat and guilds all hang off the account.

### 3. Hand-overs become service transactions

- **Trade.** Escrowed on the service, or on a Durable Object per trade. Both offers are checked against both
  characters' last checkpoints. The swap is applied to both records at once, both `seq`s go up, and both clients
  load the result. This replaces the peer-to-peer commit, which can never be atomic.
- **Guild treasury.** One D1 transaction debits the character and credits the treasury. A withdrawal is the reverse.
- **Homes, decor, stations and guild founding.** The service debits the character's gold at claim time, at the
  service's own price.
- **Gate spoils and broker purchases.** The service grants them into the record, from the relay's signed receipt and
  its seed.
- **Shared containers.**
  - The room keeps a lock per container, and the second taker is refused.
  - Takes publish at once, which closes the leave-and-re-enter window.
  - A close writes only what was taken, not the whole list.

### 4. Validation at checkpoint: the budget model

The service reads the checkpoint's summary, spot-checks the blob, and refuses a checkpoint that breaks the law. The
last good checkpoint then stands, and the character is flagged for review.

- **Caps (section 5):**
  - attributes 100;
  - skills at the online cap, item bonuses included;
  - the online level cap (**OPEN**);
  - online class rules;
  - item values within their template for their material;
  - no forbidden items (Test Room or dev items);
  - enchantments within the online item-maker rules.
- **Budgets per hour of online play the service measured itself** (`accounts.js` already measures play time: "The
  client sends no number"):
  - gold plus item value gained, as a function of level;
  - XP;
  - Rare-or-better items.
  These follow the shape of Renown's `RENOWN_XP_HOUR_MAX`.
- **Item ids.** Valuable items get a service-issued id: Magic and above, artifacts, sigil stones and Regalia. The same
  id in two records freezes both for review.
- **Honest limit.** A modified client can still invent loot inside the budgets. The budgets bound it and the id
  ledger catches copies. Removing it entirely needs the service to roll the loot (phase 5), as the gate already does
  with its seeds.

### 5. Power rules online

These apply at online character creation and are enforced at checkpoint. The numbers are proposals.

- **Skills.** A hard cap of 100 for every use: spell cost, critical hits, backstab. Item bonuses count toward it.
- **Spell cost.** Never below 20% of the spell's cost before skill, instead of a flat 5.
- **The spellmaker.** Per-level magnitude is capped, and Shield and Regenerate pools are capped as a share of maximum
  health.
- **Custom classes (OPEN, decision 4).** Either:
  - rebalanced points: no immunities (resistances only), new costs, and disadvantages that don't touch the build (a
    magic restriction on a class with no magic skills) worth little; or
  - a curated list of classes.
- **The item maker.**
  - Side effects fund at most 25% of an item's budget.
  - Effects that never fire on worn gear cannot be taken for it.
  - One Extra Spell Points and one Enhances Skill per item.
- **Across all worn gear:** at most +30 to any skill and at most 75% in any resistance.
- **Luck.** Its rarity term counts up to luck 70 only.
- **Critical hits and backstab.** Each capped at 50% chance.
- **Set powers.** They add to each other instead of multiplying.
- **Rest.** A cooldown, or only at an inn or a home. The skill-clock credit from resting is capped per hour.
- **Every mod setting locked online**, not just `Enabled`. The online-lane pin should walk every key of every mod.
- **Cheat flags and probe seams refused online:** `?shot` (and `__addGold` with it), `?fly`, `?nofoes`, `?tp` and
  `?timescale`.

### 6. The economy online

**Faucets:**
- **Broker items are bound:** no shop sale and no trade, or a nominal sale price.
- **Gate spoils by contribution.** Only standing alive earns a small share.
- **Pile gold divided by level** online. Respawn is set per dungeon instead of hourly for every pile.
- **Shared quest rewards are split** across the party.
- **The Empire is one lender.**
  - One loan per character.
  - A default anywhere closes the Empire everywhere and garnishes future deposits.
  - The cap comes from the service, with `loanAmountPerLevel` locked.
  - At cutover, any debt above the Empire's cap is called in.

**Sinks:**
- **Vendor spread.** Online, a shop pays at most 50% of its own selling price. This ends both the same-shop profit and
  the region-to-region profit.
- **Trade tax** of 5% of the gold that moves, and a fee on guild treasury moves.
- **Weekly upkeep** on online homes, stations included.
- **Dying costs something:** durability, plus a fee of 5% of the gold carried, capped.
- **A fee for each fast travel online.** Online travel has no inn nights to pay for.

**Telemetry.** Checkpoint summaries give the service a live ledger: total gold in the realm, the top holders, and
source and sink tallies. Tune by data rather than by guess.

**Customs** (the migration at cutover, decision 3):
- Loans are settled from bank and purse.
- Liquid wealth (purse, banks, letters of credit) is capped at an allowance for the character's level (**OPEN**).
- Skills, attributes and items are brought within online caps. Anything over is converted to gold inside the
  allowance, or removed.
- A custom class is re-checked under online rules.
- Renown starts from its existing track, as it already does.

## Phases

- **0. Hotfixes.** Days, no migration needed:
  - refuse cheat flags and probe seams online;
  - lock every mod setting online, with the online-lane pin walking every key;
  - the Empire as one lender, and call in oversized debt when a character joins;
  - vendor spread online;
  - divide pile gold by level;
  - bind broker items;
  - split shared quest rewards;
  - a periodic online autosave, which narrows rollback vector 1 until phase 1 closes it.
- **1. Realm characters: the separation.**
  - character ids minted by the service;
  - `realm_characters` with lease and `seq` checkpoints;
  - the Online door and online character creation;
  - "Copy to offline";
  - one identity at the hub;
  - the cutover migration through customs.
- **2. Service transactions.** Trade escrow, the treasury, homes, decor and stations, gate and broker grants, and
  container locks.
- **3. Validation.** Caps, budgets, item ids, quarantine, and a review tool.
- **4. The balance pass.** The power rules and the economy numbers, plus telemetry.
- **5. Later.** The service rolls loot for high-value sources, and an auction house.

## Progress

- **P0.1 done (2026-09-28): the URL's powers stay offline.** An online boot drops `?shot` (whose probe seams include `window.__addGold`), `?fly`, `?nofoes`, `?tp`, `?class`, `?spell`, `?weapon`, `?spawn`, `?region`, `?loc` and the clock and sky overrides before anything reads them (`onlineLane.js` `ONLINE_REFUSED_FLAGS`, `refuseOnlinePowerFlags`; `world.js` beside the Test Room refusal). Offline, F304 stands.
- **P0.2 done (2026-09-28): the balance mods are the room's whole.** Online, every key of Meaner Monsters, PCAAO, Unleveled Loot, Roleplay & Realism, RR: Items and Oblivion leveling reads the room's value or its shipped default (`onlineLane.js` `ONLINE_WHOLE_MODS`, `modSettings.js` `onlineModSetting`): forty-eight dials beside the thirty-four the room already owned. Two cosmetic keys (who stands behind a counter and in a house) and Oblivion leveling's on/off stay the player's. The Mods pane locks a room dial with its reason, and the offline "sync from server" copies the dials home.
- **P0.3 done (2026-09-28): the Empire is one lender.** Online (`banking.js`): one loan a character, wherever it stands (`empireRefusal` in `borrowDecision` and `borrowLoan`, and the bank window names the branch); a default anywhere shuts every branch; an overdue loan draws on every account before it defaults (`drawEmpireAccounts`); a defaulter's deposit, gold or letters, pays the default first (`garnishDeposit`). At the join (`worldTick.js` `empireJoin`, called in `onlineStart` after the markers are aligned to the world's clock) the Empire keeps one loan, the largest, up to its cap with interest, and calls in the rest: the loan's own account, the other accounts, then the purse. A call left unpaid falls due and defaults at once, with the region's reputation. The cap from the service waits for phase 1; `loanAmountPerLevel` is the room's since P0.2.
- **P0.4 done (2026-09-28): the faucets.** Online:
  - **Vendor spread.** A shop pays at most half the LEAST it asks for the same piece - the ask of the best haggler there is, 100 Mercantile and Personality or the seller's own where a spell lifts them higher (`shopStock.js` `calculateTradePrice`, `ONLINE_SALE_SHARE`, `ONLINE_SALE_REFERENCE_SKILL`) - so buying a piece and selling it back no longer makes gold (a quality-1 shop with Mercantile 2 paid 488 and asked 484), and no skill lowers a sale. MERC-RISE (2026-09-29, ValenValarys: "Higher skill resulted in lower payout" - 3499 gold at Mercantile 60, 2888 at 90): P0.4 took half of the SELLER's own ask, which falls as Mercantile and Personality rise, and the cap binds for nearly every seller online; half the least ask is still at most half of what the shop asks anyone. Below the cap Daggerfall's haggle stands (`01-Overview/Field-Bugs-2026-09-29d.md` MERC-RISE).
  - **Pile gold.** Every treasure pile's gold is divided back by the level, never below one piece (`loot.js` `addPileLootExtras`, `unlevelPileGold`). This is Unleveled Loot's own arm, which DFU never calls, and here it runs whether the mod is on or off. The dungeon, interior and camp piles all hand in the level.
  - **Bound broker items.** The Sigil Broker's piece is bound to its buyer. Built here first as its own binding (`itemLock.js`, set at the sale); main's SS4 bound the same wares the same day (`itemBound.js`, marked in `brokerStock`, with SS3's world rules and SS4's counter), and the merge (AUDIT REALM) keeps SS4's binding alone, so there is one law: no trade, no counter sale, never the ground, a chest, a body or a reward tray; the wagon and the player's own storage still take it, and a lock neither binds nor unbinds it. The binding holds offline too.
  - **Shared quest rewards.** A party's shared quest pays its gold in the party's shares (`quest/actions.js` `shareQuestGold` in GivePc; the machine's `rewardShares`; the host's `partySize`). Each partner's copy pays, so a party of six drew six purses. Item rewards stay each partner's own.
- **P0.5 done (2026-09-28): the character is saved as it plays online.** `onlineCheckpoint.js`: every two real minutes, and at each change a trade makes to the pack (the goods out before the commit frame is queued, back, the peer's in), the character is saved quietly to every slot the exit save writes (`exitAutosaveNames`; no shot, no "Game saved."). It is refused out of the seat, in a duel and on the death screen, as the exit save is. This narrows rollback vector 1 (a seat taken, a crash, a death screen skipping the exit save) to two minutes, and a trade's to none. Phase 1 replaces it with the service's `seq` checkpoints. A chest or a pile handed over in a room is not yet checkpointed; container locks in phase 2 close that.
- **P1.1 done (2026-09-28): the realm's characters, service side.** `server-account/src/realm.js` and migration 0018 (0016 on its branch - main's raids took 0016 and 0017 first): a realm character's id is minted by the service, and its save is held in R2 under the lease and sequence of section 2. A join takes the character from any other tab and frees the account's others. A checkpoint lands only under the current lease at `seq + 1`. The save alternates between two objects, so the one before survives. Customs lets an offline character in once, and only if it has a Renown track (any trace from before the realm since CUSTOMS-CARRY). Six characters an account. `Accounts-And-Cloud-Saves-Arc.md` REALM P1.1; `test/realm1.test.js`.
- **P1.2 done (2026-09-28): the client's calls and the playing tab's session.** `src/systems/realmSaves.js`: the realm routes as calls, and `createRealmSession`. Checkpoints go in order at the next sequence, and the newest save replaces an older one that never left. A checkpoint whose answer was lost is resynced, since the service now says its own sequence in a `seq` refusal. Offline, the newest save waits for the next checkpoint. `lease`, `no-realm-character` and `auth` end the session, told to the host once. A leave sends what waits first. A leave as the page goes sends the leave alone with keepalive, because a browser cannot finish a save that large after the page is gone; the two-minute checkpoints bound that loss. `test/realm2.test.js`.
- **P1.3 done (2026-09-28): the Online door and the boot, from the service.** The Online pane lists the account's realm characters, asked once a visit. Its Play boots `?online&load&realm=<id>`. `world.js` joins the character and reads its save from the service before any save is read (`openRealmBoot`), never a local slot; a join that fails returns to the door with the reason. Every save of a realm character is the service's checkpoint: the two-minute one, a trade's, and even F9, which says "Saved to the realm." (`shared.js` `realmSaveSink`, in both composers). No local slot of it is written, so no offline door lists it. The page going sends the leave with keepalive. The pause menu's Exit makes the last checkpoint and leaves first (`setBeforeTitleExit`). A tab put away is checkpointed. A lost lease returns to the door. "New online character" boots the online lane with no relay for its chargen; the realm makes it, saves it at 1 and boots it from the service (`realmBirth`). An online boot with no realm character in it plays offline and says so. A Test Room character never enters the realm.
- **P1.4 done (2026-09-28): Copy to offline.** A realm tile's copy writes the realm's save as a new offline character with a new id. Nothing played on it comes back.
- **P1.5 done (2026-09-28): customs.** An offline character's tile in the Online pane says "Bring online". Customs (`realmCustoms.js`) runs on a copy: every loan is settled (the Empire keeps none for a newcomer), then the liquid wealth left is capped at the level's allowance. Every deed crosses, marked, and the realm's bank never buys a crossed one back (RESTORE, below - AUDIT REALM2 T3 took whole deeds off the copy, and HOUSE-LOSS only narrowed when); the gold over the allowance is taken from what the character left in the world first (AUDIT REALM F2), then the fullest account, the wagon, the letters and the purse. The service refuses a character the realm has no trace of from before it began - unless a developer's pass lets it in (CUSTOMS-PASS below) - or a second try (CUSTOMS-CARRY below). It carries the Renown track, the online homes and the guild place to the realm's id (`realm.js` `customsCarry`); AUDIT REALM2 S2 had left the homes and the guild place behind, and CUSTOMS-CARRY carries them again. Since RENOWN-ACCOUNT the track is history, because the Renown itself is the account's. **OPEN:** the allowance is a first setting (20,000 plus 10,000 a level, `CUSTOMS_WEALTH_BASE` and `CUSTOMS_WEALTH_PER_LEVEL`). Skills, attributes and items within online caps arrive with phase 4.
- **P1.6 (2026-09-28): one identity at the hub - already true.** Friends, the party and the seat key on the account (`net/social.js` `acct`, ONE-SEAT). A guild stays per character, by GUILD1's own decision, now under the realm's id. `test/realm3.test.js`.
- **P2.1 done (2026-09-28): a trade is the realm's.** When both sides of a trade between realm characters confirm, neither hands its goods over. Each checkpoints its save as it stands, reserves its goods, and sends its half to the service (`/v1/realm/trade`): what it gives and what it takes, as its window showed them. The service (`server-account/src/realmTrade.js`, migration 0019 - 0017 on its branch) pairs the halves by the trade's sid. When they agree, it takes each side's goods out of its own copy of that side's last checkpoint - what the record holds, never what a client says - and writes both records one sequence on in one batch. A guard rolls the batch back unless both moved, so a trade is both records or neither. The law both ends read is `src/net/realmTradeLaw.js`: a record may leave exactly when the pack's own law lets it, and an offer is its record when every field it names but the count, the price and the receiver's marks is the record's own. A refusal moves nothing and restores the reserved goods: the offers disagree, a record cannot back its side, the first half waited past its minute, a record moved on mid-settle. From the moment the goods are about to leave the pack until the service answers, the tab sends no checkpoint (`realmSaves.js` `transact`, begun in `realmTradeEscrow`'s hold): the checkpoint P0.5's pack makes as the goods are reserved would otherwise be the record the service settles against, and it would refuse the honest trade. An answer that never comes keeps the goods out and ends the session, because only a join reads how the trade ended. A realm trade numbers its revisions from `REALM_TRADE_REV_BASE`, so a tab still on an older build can never confirm with one and loses nothing. **Every write of a realm character is now a new object** (`obj` and `prev` on the row): a write that loses its race drops its own object and never touches the current save. P1 alternated two objects by `seq`, and a checkpoint racing a settle could land on the current one. What a modified client can still do is write a checkpoint that keeps what it gave; the item ids of phase 3 catch that copy. `test/realm4.test.js`; `tools/mutants/realm4.json`.
- **P2.2a done (2026-09-28): a guild's gold moves on the realm character's record.** A realm character's founding fee, deposit and withdrawal move its record's gold in the guild's own batch on the service, guarded, so both land or neither (`guilds.js` `realmTreasury` and `foundGuild`; `realm.js` `prepareRealmRecord`, `realmSideOf`, `mustChange`). The record pays exactly as the client's wallet pays (`src/net/realmGoldLaw.js`, pinned equal to `court.js` `deductGold` and the region's bank account for the shortfall). A realm character must say where its record stands, or it is refused (`realm-needed`); no other character may name a record. The client (`guildBook.js` over `realmSaves.js` `realmGoldAct`) checkpoints the purse first and holds, pays at once (a founding, a deposit), and gives the gold back on a refusal. A withdrawal's gold comes in on the answer. A lost answer is asked again with the same record: while the hold stands nothing else moves it, so a `seq` refusal one ahead is the act, landed, and it is never paid twice. Still lost, the session ends and a join reads the truth. Before this, a tab closed between a deposit and its next checkpoint left the gold both in the treasury and in the save. `test/realm5.test.js`; `tools/mutants/realm5.json`.
- **P1.3 fix (2026-09-28): a realm checkpoint that lands clears the gate's spoils it holds.** A boss's spoils ride a record on the device until a save holds them (`spoilsPool.js`, AUDIT WBX S3), and only a local slot's save (`onSlotSaved`) cleared it. A realm character writes no slot, so the record never cleared, and every boot handed the same spoils back into the pack, and the next checkpoint kept them. Now the realm's save sink captures which records a checkpoint was composed holding (`heldIds`) and, once it lands, clears those (`saved(who, only)`); spoils that came in after it wait for a checkpoint that holds them. `test/realm3.test.js`.
- **P2.2b done (2026-09-28): a home's and its decor's gold moves on the realm character's record.** A realm character's home claim pays its price off the record, and its sale pays Daggerfall's deed share (`homeLaw.js` `homeSaleRefund`, pinned to the client's) and its placed pieces' half into the house's region's account on the record, each in the act's own batch, both or neither (`homes.js` `realmClaim`, `realmRelease`). A placed piece's price, a resize's difference or half back, a station's licence and a removal's half move the record's gold with the piece's own write (`decor.js` `decorGoldDelta`, `realmDecorWrite`). A write that moves no gold (one's own item, a piece moved and no bigger, a station unmade) names no record. Each act asks where the record stands first, so an act sent again after it landed is told so (`seq`, read as landed), and a second press on a house already the character's pays nothing. The client (`onlineHomes.js` `buyOnlineHome` and `sellOnlineHome`; `decorTool.js`'s place, move, remove and station) acts through `realmGoldAct`: the purse checkpointed and held, a price paid at once and given back on a refusal, a credit taken on the answer. A sale whose answer never came ends the session rather than guess the refund (`needsAnswer`). **OPEN:** a house's price and a piece's size are the client's geometry, which the service cannot read. The record pays exactly the price stored and gets back exactly its share, so no gold is made, but a client that names a low price buys cheap. A price table the service can hold is phase 4's. `test/realm6.test.js`; `tools/mutants/realm6.json`.
- **AUDIT REALM2 done (2026-09-28, Mac: "Do a comprehensive audit"): the audit of REALM as merged with main.** Five lanes; each finding was reproduced and pinned failing before its fix.
  - **The account service (S1-S8)** (`test/auditrealm2_service.test.js`, 11):
    - The service reads a character's FIRST save (`realm.js` `firstSaveRefusal`). A character born online must be level 1 and within `REALM_BIRTH_WEALTH_MAX` (**OPEN**, 10,000). A customs character must be within its level's allowance.
    - It measures by the one law customs caps with, now in `net/realmGoldLaw.js` and re-exported by `realmCustoms.js`: one function at both ends.
    - Only a realm character can claim a house, place a piece or found a guild. Customs carried the Renown track and nothing else (reversed on Mac's call by CUSTOMS-CARRY, 2026-09-29).
    - A batch that landed but lost its answer keeps its save.
    - An offer must match its record in every field, and a traded record is at most 4,096 characters.
    - A new waiting half replaces the old one, and the customs carry rides the census batch.
    - A checkpoint that moved nothing reads the row again.
    - A lone guildmaster's delete waits for an empty treasury.
    - **OPEN:** a customs allowance is read at the level the customs call says; the census holds no level to check it against.
  - **Trades and customs (T1-T7)** (`test/auditrealm2_customs.test.js`, 7):
    - Come Sail Away's deeds and parts are never traded; a traded deed was a second boat.
    - Customs counts a boat's hold and every container. This reverses AUDIT REALM F2's "the world's loot", since the pack fills any container.
    - Customs counts each deed at what the realm's bank pays for it: the ship, each house at the deed's share of `CUSTOMS_HOUSE_PRICE` (**OPEN**, 100,000, so 85,000 a house), and the pieces bought for its room. Past the stashes it stripped whole deeds, dearest first (RESTORE: no longer - every deed crosses, marked, and the realm's bank buys none back).
    - A settle moves `lightSourceIndex` with its record.
  - **The client's saves (C1-C8, M3-M5)** (`test/auditrealm2_client.test.js`, 14):
    - Both spoils pools ride the realm hooks.
    - The seat is left on `pagehide` and taken again on `pageshow`, never given up at `beforeunload`.
    - F9 says what the realm answered.
    - Come Sail Away's record rides every save with the mod off, and a ship lent at a helm comes back.
    - Each checkpoint gets its own answer.
    - The tile header escapes names past Latin-1.
    - A home's sale moves its things inside the act.
    - Exit ends a duel first.
    - A 4xx refusal ends the session.
    - The console stays offline.
    - `realmCheckpoint` answers its composer's result.
  - **Left open:** a stripped deed's room stays in the save's permanent scenes, and an offline peer's `unwire` still takes boat items.
- `test/realm0.test.js`; `tools/mutants/realm0.json`.
- **CUSTOMS-CARRY done (2026-09-29, the field - `01-Overview/Field-Bugs-2026-09-29.md`): who comes in, what comes with them, and the door says so first.**
  - **The census counts every trace from before the realm** (migration 0022). "Bring online" refused characters that had played online (EnragedBard, Tony H.): 0020 counted Renown tracks alone, and a track needs a first online kill (DATA-7), so a character played online before RENOWN1 (2026-09-24), or one that never killed there, had none. The census now also counts an online home, a guild place, a raid fought and a cloud backup, each stamped before 1790638734 (the commit that brought 0020 to main). A backup proves the character stood before the realm, not that it played online - Mac's call. The census stays frozen, so a Copy to offline's new id never counts (L1-F5), and "once" stays the character's on every account (L3-F2). The refusal names what counts.
  - **Customs carries the online homes and the guild place again** (`realm.js` `CHARACTER_TABLES`), and 0022 carried them for every character already brought in. S2 had left them under the offline id, where they were lost to everyone: Dracula/Valentin's guild "deleted", its master gone, its name and tag kept from any founding; a house exclusive to nobody who could walk in. They are what stood before the realm (only a realm character claims, places or founds since - S2's rule stands) and pay out nothing that was not the realm's (0020's `paid` and `realm_gold`). A realm character already in a guild keeps it, and the old place stays where it was.
  - **Loans are still called in, and the door says so first.** "Bring online" shows what customs will do - the loans it calls in, what the allowance leaves behind, the deeds that stay, that the homes and the guild place cross, that the offline character keeps everything - off customs run on a copy, and runs it on the answer (`enhancedMenu.js` `bringOnline`, `realmCustoms.js` `customsLines(report, { before: true })`, `CUSTOMS_PROMISE`).
  - `test/fb0929_customs.test.js` (5); `tools/mutants/fb0929_customs.json` (13 mutants, 13 dead). S2's pins flipped to the new law (`realm1`, `auditrealm2_service`), their mutants re-aimed.
  - **Left open:** a home or guild place under an origin whose realm character was deleted still stands under the dead id (a building nobody can buy); 0022 moves nothing that no realm character stands on.
- **REALM-DOOR done (2026-09-29, the field - `01-Overview/Field-Bugs-2026-09-29b.md`): online is the realm's at the servers, not only in the new build.**
  - **Why.** The separation was the new build's law alone - its boot never takes a local slot online (`world.js` `realmRefused`) - and neither Worker asked: `/v1/auth/token` minted for any character a client named, and the relay admitted any token it could verify (world124 before and after REALM). So a build from before the realm - a tab left open, or the desktop app's portable exe and macOS copies, which never update themselves - played online as before, and a character made there after the census froze (Gryphoth's) could never come in. Customs refusing it was the census law working; the door was open.
  - **The mint signs the realm's word on the character it names** (`rc`: 1 for one of the account's realm characters, else 0 - `realm.js` `realmCharacterHeld`, acct21), and the relay refuses a 0 in every room before anything is written, with words a build from before the realm prints as it stands and never retries (`server/src/index.js` `_named`, `net/wire.js` `REALM_DOOR_WORD`, world129). A token with no `rc` is a service from before acct21 and is admitted as it was: the two Workers deploy on their own, in either order.
  - **A realm-era tab names the realm character it joined** at the mint (never an id the save carries or `characterIdOf` mints), and one the door refuses anyway - its character deleted elsewhere, its account changed under it - goes to the Online door with the realm's word (`realmSaves.js` `realmDoorShut`).
  - `test/realmdoor.test.js` (6); `tools/mutants/realmdoor.json` (12 mutants, 12 dead).
  - **Left open:** a build from before the realm still reports Renown XP to its account while shut out (the report names no character since RENOWN-ACCOUNT) - bounded by the hour's cap; Renown XP is on this page's list of what the client is trusted with until phase 3's budgets.
- **CUSTOMS-PASS done (2026-09-29, Mac: "Staff customs pass" - Decision 9).** The census stays frozen for everyone; the one way past it is a person's. A developer grants an account one open pass (`POST /v1/mod/customs-pass`, `realm.js` `grantCustomsPass`, migration 0024; `tools/customsPass.mjs`), and customs spends it on the account's next character its census does not count - inside `customsRealm`'s own guarded write, so the loans are called in, the wealth capped and the first save read as for any customs. It is never spent on a character the census admits anyway, never lets in one already brought in from any account (its census spent, or a realm character standing on it - L3-F2), and a spent pass stays the record of whom it let in. One open pass an account. The refusal a stranded player meets says where to ask. `test/customspass.test.js` (6); `tools/mutants/customspass.json` (14 mutants, 14 dead).
- **CUSTOMS-GRANT (2026-09-29, the field through Mac: "Please activate ToxicTaco69 character for online mode. He cant access it" - `01-Overview/Field-Bugs-2026-09-29.md`) - retired for CUSTOMS-PASS at the merge, never deployed.** Its branch let a character the census never saw in by a handle list in the config (`CUSTOMS_GRANT_HANDLES`) and a table of its own (`customs_grants`): one character an account, once, through customs' guarded batch. CUSTOMS-PASS, above, does the same by a developer's act, and is Mac's own choice (decision 9, "Staff customs pass"), so the realm keeps one way past the census, not two. ToxicTaco69's character comes in on a pass (`node tools/customsPass.mjs ToxicTaco69`). What stays of CUSTOMS-GRANT is HOUSE-LOSS's undo giving back what customs spent, a pass included.
- **HOUSE-LOSS done (2026-09-29, the field through Mac: "GarySoup lost his house and furniture. I suspect a lot of people lost a ton of belongings" - `01-Overview/Field-Bugs-2026-09-29.md`): two roads took players' houses at customs, both reproduced before their fix.**
  - **The delete that took what customs carried.** Customs carries the origin's home, guild place and track to the realm's id in the census's own batch, before the first save is sent (CUSTOMS-CARRY), and a first save can fail - refused, too large, lost on the way. The door then showed a "Never saved" tile whose one live button was Delete, and said "Delete it and make it again"; the delete took the home, its pieces and its hidden furniture (the tables' cascade) and left the census spent, so the character could never come in again. Live from CUSTOMS-CARRY's arrival on main (2026-09-29 03:09:50 UTC) to this deploy, and destructive: only D1 Time Travel brings those rows back. **Now a customs whose first save never landed is UNDONE by its delete** (`realm.js` `undoCustoms`): what it carried goes back to the offline id, the census rows it spent are unspent on every account, and a customs pass it spent comes back with the census row the pass wrote - open again, or, when a developer has granted the account another since, its record dropped (one open pass an account), since the customs it recorded never stood. Nothing of such a character ever played in the realm - it has no record, and every act, trade and purchase asks one - so this is the realm as it stood before that customs. Guarded on `bytes = 0`: a first save landing in the same moment keeps the character (`seq`). The door offers **"Undo bringing in"** on its own route (`/v1/realm/undo`, `undoRealm`), so a door newer than its service gets `not-found` from the old one, never a delete; and the never-saved word sends one brought in back to its offline tile.
  - **The deed stripped for an excess the gold could pay.** AUDIT REALM2 T3 stripped whole deeds - a house and every piece bought for its room, or the ship - before a coin of the bank or the purse: level 10, a furnished house and 60,000 in the bank lost the house and kept the bank. The cap is the same whichever goes; what differs is whether the player keeps the house. **Now a deed goes only while the deeds by themselves are over the allowance**, dearest first, stopping the moment the deeds left fit, and the gold pays the rest - which it always can (`realmCustoms.js` `applyCustoms`). T3's counting stands; its order pin is flipped. The offline character always kept everything (customs runs on a copy), but customs is once, so a realm character that lost a deed this way cannot redo it. **Superseded the same day by RESTORE**: no deed is taken at all, and what was taken comes back.
  - **Left for Mac** (the page's "For Mac"): the rows the delete destroyed (Time Travel), the realm characters already stripped of a deed (their offline saves still hold it), and the homes left under an offline id - the queries are on the field page.
  - `test/house_loss.test.js` (7, all failing before the fix); `tools/mutants/house_loss.json` (now 17: 16 dead, 1 equivalent as recorded - the deeds-last rule's two retired by RESTORE; the grant's two re-aimed at the pass, and two more for its reopening). The account service is `acct23` (`acct20`, then `acct21` and `acct22`, on its branch - main's TERMS1, PENITENT and REALM-DOOR took each first).
- **RESTORE done (2026-09-29, Mac: "I want people to get their stuff back" - `01-Overview/Field-Bugs-2026-09-29.md`): everything the two roads took comes back, and customs takes no deed again.** Mac's calls (decisions 10 and 11): the deeds "Keep all, can't sell"; the lost homes "To the offline character".
  - **A. Customs keeps every deed** (`realmCustoms.js` `crossDeeds`): a house's slot is marked `crossed`, the ship `shipCrossed`, and every bought piece in their rooms pays nothing back (`paid` 0). Online, the bank of the Empire buys no crossed deed back and says so in the window, never an offer (`banking.js` `crossedDeedLines`, `sellHouse`, `sellShip`; `bankWindow.js`; the host's hook in `worldModes.js`); offline, a copy is an offline character's and sells. A crossed deed is none the allowance counts (`realmGoldLaw.js` `deedsOf`), so only gold is capped, and nothing a deed carries reaches the realm as gold. A house or ship bought in the realm is the buyer's own (`allocateHouseToPlayer`, `assignShipToPlayer`, `resetShip` clear the mark). The ship's mark rides the save (`save.js`); a house's rides its slot.
  - **B. What customs took is given back** (`realmCustoms.js` `reclaimCustomsDeeds`, `reclaimFromDevice`, `reclaimLines`): T3 emptied the slot, dropped the ship and took the room's bought pieces off the realm's copy, but LEFT THE ROOM among its permanent scenes - where a sale never leaves one (`sellHouse`, `sellShip` drop it). So a deed the offline character still owns, whose room the realm character's save still keeps, is one customs took: the two together are the evidence. At the realm boot the join names the offline id (`realm.js` `joinRealm` `origin`, `realmSaves.js` `openRealmBoot`), the newest offline save of it on this device gives the deed back into the realm's save before anything restores it (`world.js`), marked as every deed crosses now, and the player is told once the world stands. The first checkpoint keeps it; until then each boot gives it back again. Nothing comes back for a house sold in the realm, a rented room, a house bought offline after customs, or an own-item piece the realm character took back into its pack; nothing is taken to make room.
  - **C. The online homes a deleted customs character took** exist only in D1's history. `tools/realmRestore.mjs` plans them back from a snapshot before the loss against the present: every home (pieces, hidden list), guild place and track back under the offline id, and the census unspent so the character comes in again carrying them - HOUSE-LOSS's undo, for the past. An account whose deleted character traded in the realm is HELD for Mac (its offline items would come in again beside what it traded away); a building someone else bought since is reported, never taken back. `.github/workflows/realm-restore.yml` runs it by hand: the account service HELD for maintenance first (`MAINTENANCE`, `service.js` `maintaining`: every call but health and the public key refused 503, which a checkpoint waits out; the hold proven by a write route asked with no credential, which writes nothing held or not - never an account route, which writes its rate row before it refuses), the present's bookmark and counts kept, the database rewound in place (D1's only way to its past) and proven there, what stood then exported, the present put back ALWAYS and proven by its counts, the plan written only on apply, and the hold lifted only over the present. A dry run by default.
  - `test/restore.test.js` (6), `test/realm_restore.test.js` (5); T3's pins and HOUSE-LOSS's deed pins flipped to the new law. `tools/mutants/restore.json` (45, all dead); eight T3 and HOUSE-LOSS records retired whose law was the stripping or its order, seven re-aimed at the crossing.

## Decisions

Mac, 2026-09-28, answering the four questions:

1. **Truth:** "Account service". An online character's truth lives on the service; the browser caches it.
2. **Offline play:** "No, fork a copy". A realm character plays only online; "Copy to offline" forks it.
3. **Existing characters:** "Migrate once via customs". Characters that have played online move over once, through customs; new realm characters start fresh.
4. **Classes:** "Rebalanced points". The class maker stays online, with online costs.
5. **The numbers** stay OPEN. The proposals on this page are the starting values, each a named constant.

Mac, 2026-09-29, answering the field (CUSTOMS-CARRY):

6. **Who customs admits:** "Any pre-realm trace". A character the service saw before the realm - a Renown track, an online home, a guild place, a raid fought or a cloud backup - comes in once; the census stays frozen at the realm's start.
7. **Homes and guild places:** "Carry them". They cross with the character, and those already brought in get theirs.
8. **Loans at customs:** "Call in all loans", as section 6 says - with a confirm screen first.

Mac, 2026-09-29, answering the field (REALM-DOOR - Gryphoth's character, made and played online on a build from before the
realm after the census froze, which the relay still admitted):

9. **Characters stranded that way:** "Staff customs pass". A developer grants one account one pass, and its next Bring online of a character the census does not count comes in once, through customs as any does. The census stays frozen for everyone else, and no pass lets in a character already brought in.

Mac, 2026-09-29, after HOUSE-LOSS: "I want people to get their stuff back" (RESTORE), and, asked:

10. **The deeds at customs:** "Keep all, can't sell". Every house, ship and piece crosses and comes back to those who
    lost it; the realm's bank buys nothing that came through customs back, so it carries no gold past the allowance.
11. **The homes a deleted customs character took:** "To the offline character". Restored from the database's history to
    the offline character, which can be brought in again; an account whose deleted character traded is held for Mac.

### As asked

1. **Where does an online character's truth live?** Recommended: on the service. Without that, no rollback or copy
   dupe (vectors 1 to 3, 5 to 7 and 9) can be closed.
2. **Can a realm character be played offline?** Recommended: no, with "Copy to offline" as a fork.
3. **What happens to existing characters?**
   - (a) a fresh realm for everyone;
   - (b) a one-time migration through customs for characters that have played online (recommended);
   - (c) any offline character may move online through customs, at any time.
4. **Custom classes online:** rebalanced points, a curated list, or standard classes only.
5. **The numbers:** the online level cap, the customs allowance, the vendor spread, the trade tax, the upkeep and the
   death fee.
