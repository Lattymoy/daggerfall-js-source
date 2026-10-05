# AUDIT 625 - PR #625 audited, 2026-10-05

Mac, of PR #625 (LOOT-EASE, SILVER-FINDS, SERPENT-SET, WALLET1 and RENOWN-LOOT on one branch): *"Lets do a
comprehensive audit on this. Instead of a flat loot increase, lets also tie it to renoun level"*. The second half is
RENOWN-LOOT (`06-Systems/Loot-Arc.md` section 20). The first is this page. Five lenses read the branch at RENOWN-LOOT's
commit, and each one checked its own findings with a node probe before reporting them:

- **the loot** - LOOT-EASE and RENOWN-LOOT: the kit's roll at death, the cap, the supplies, the four hosts' body
  doors and the wire;
- **the silver** - SILVER-FINDS: the client's roll and its doors, the marks book, the service's two faucets and the
  weekly report;
- **the serpent** - SERPENT-SET: Sethrakul's Coilscale's powers, the duel's word, the serpent's claim and its hoard;
- **the wallet** - WALLET1: the pack-only law at every door out of the pack, the sheet, the silver's words;
- **the docs, the pins and the merges** - every page and cite the branch wrote, every pin it moved, every mutant record
  it named, and the four merges of main it carries.

Thirty-two findings. Two of them are the same finding (D1 = L6), so 31 are distinct. Every one was read again here before
any line changed. Three were design calls, and Mac made them (below). Each fix carries an `AUDIT 625 <ID>` comment. They
are pinned in `test/audit625_loot.test.js` (6), `test/audit625_wallet.test.js` (4), `test/audit625_silver.test.js` (7)
and `test/audit625_serpent.test.js` (6), plus the AUDIT 625 pins added to `test/silverfinds_service.test.js` (S1, S6),
`test/serpentset_service.test.js` (P4, P5) and `test/citedrift.test.js` (CD7b). They are mutated in
`tools/mutants/audit625.json`: **71 mutants, 71 dead.** A pin a fix moved says `PIN MOVED` where it stands.

## Mac's calls

Each was put to Mac with its options and the trade-off. Mac's answer is the law:

- **L3 - whose ladder a champion's or a boss's kit rolls: "The plain ladder".** Every foe's worn kit rolls the plain
  ladder at its death. That is RENOWN-LOOT's ladder, at the roller's Renown. Champions, elites and bosses keep their
  better ladders for the loot they carry.
- **S1 - the unwitnessed faucets and alts: "A week old, like witnesses".** Finds and gathering silver open to an
  account once it has been registered for a week (`nodeLaw.js` WITNESS.ageS, the witnesses' own age).
- **P3 - Constrict on a sweep: "A coil per foe".** Every foe has its own coil. Each builds to five stacks, and each
  fades 6 s after the last blow on that foe.

## Fixed

**The loot** (`src/systems/foeLootCap.js`, `src/scenes/dungeonContext.js`, `src/systems/survival/camp.js`,
`src/scenes/cityGuards.js`)

| ID | Sev | Finding | Fix |
|---|---|---|---|
| L1 | medium | KIT-ROLL never rolled for a foe restored from a save. It found the kit through the foe's equip table, object by object. Every restore puts the save's COPIES into a foe's list and leaves its table alone: the dungeon's in-place patch, and the street's and the watch's re-spawn and overlay. So after any load, every foe still standing dropped Common kit again, and the "only steel" report was back. | The kit is now every rarity-eligible piece the spawn's roll left UNMARKED. The spawn's roll marks every piece it rolls `untaken` (LOOT8's mark), and that field is saved, so the mark comes back on every copy. |
| L2 | low | The kit was laddered on the live objects. The droppable cut shares them with the foe's table and its hand, so a foe brought back to life in place (the save's rewind, the stream's un-death) fought with the piece its own death had laddered. That breaks LR4's rule. | The body holds a laddered, marked COPY. The table's piece stays as it was minted. |
| L3 | medium | KIT-ROLL rolled for plain foes only, which flipped the order it was meant to keep. A champion's, an Elite Dungeon foe's and a boss's kit stayed Common. Every humanoid from level 18 counts as a boss (`lootRarity.js` BOSS_LEVEL), so these foes left less colour than a plain foe of their kind. | Mac's call: every foe's kit rolls the plain ladder (`boss: false`), never a boss's multiplied ladder and never an Elite Dungeon's quality. A revenant's kit never rolls, because its list holds a player's own pieces. |
| L4 | low | An Ember Jar's fire was sent over the camp wire without its `jar` field. REST-LOOT had opened the jar's use online, so a peer's copy showed a plain campfire ("You see a campfire.") and none of the jar's own words. | The wire carries `j: 1`. A record with any other value for it is refused whole, and a wood fire carries no `j`. A reader one build behind drops the field and sees the campfire it always saw. |
| L5 | low | A joiner's copy of a body and an arrival's copy were never capped after their kit, food and sigils, as the host's death caps its own. The room adopts whichever list the first opener sends (WORLD4), so a copy could carry more than the cap allows. These lines were already being edited by this PR, so FOE-CAP's gap was fixed with them. | `capFoeLoot` runs last on both copies. |
| L6 = D1 | low | KIT-ROLL's pins checked that the kit rolled, but not how it rolled. Four mutants survived all eleven suites: the player's luck dropped, the finders dropped, the door's last pass dropped, and the family that steers a Legendary dropped. The keep's pin only checked a band (0.7 to 0.8). | Each part is pinned by what it decides. The keep is pinned at its exact threshold: 0.7499 keeps and 0.75 does not. |
| L7 | nit | The cap's potion test re-implemented DFU's IsPotion. The watch's comment named the wrong case for a kit left bare. | The cap uses `useItem.js` `isPotion`, the one export. The comment now names the case: a defender's death by a monster or a fall. |

**The silver** (`server-account/src/marks.js`, `server-account/src/index.js`, `src/net/marksBook.js`,
`src/net/accountClient.js`, `src/systems/silverFinds.js`, `src/scenes/dungeonContext.js`, `src/scenes/worldModes.js`,
`src/scenes/world.js`, `src/scenes/corpseMarker.js`, `src/scenes/exteriorFoes.js`)

| ID | Sev | Finding | Fix |
|---|---|---|---|
| S1 | medium | Both faucets are bounded by the day but not witnessed, so every extra account was another day's cap: 50 silver a day for an alt registered a minute ago. | Mac's call: a loot find from an account under a week old is `marks-young` (403) and strikes nothing. Its harvest is counted, but finds nothing even when the dice found silver. The check comes after the line, as the switch's does. The client treats `marks-young` as the account's day being met, and owes none of its finds. |
| S2 | medium | THE FOUR HOSTS: an interior's TREASURE pile never rolled a find. That covers a tavern's, a guild hall's and DFU's RandomTreasure markers. The record said worldModes had no door to add. The streaming host's own scene containers (World of Daggerfall's piles and casket, Deep Waters' chests) were not named at all. | Each host's pile door rolls a find for the scene's own containers (`container: true`) once they hold something, and never for a pile the player dropped. An interior's pile is keyed by its town, its building and its marker, because `treasure:<i>` alone is the same key in every tavern. The streaming host's containers are unsaved and minted fresh, so each object is its own key. `scenes/exterior.js` is the offline town page and is never online, so it has no door. |
| S3 | low | ASYNC NEVER DROPS: the book let an owed find go when the answer was the switch shut, a guest, no session or a refused session. The owed finds lived in memory only, so a reload lost them. | A find stays owed through every answer that says nothing about it, and is asked again later under its own id. Only a refusal of the find itself lets it go: an id the service cannot read, a kind that does not exist, or the hour's rate spent. In that last case the rest wait for the next hour (MARKS_FINAL's law). The owed finds are KEPT in the store next to the Bank's kept sale (`marks1.owedFinds`) and read back under their own law, FINDS_OWED_MAX at most. |
| S4 | low | An owed find was sent under whichever session was stored at the time. If another tab signed in to a different account in between, account Y was paid for account X's find. | A find is sent under the account that found it, or not at all. `sessionPost`'s `as` reads the session once, checks that its account matches, and sends that session's secret. If the accounts differ, the answer is `no-session` and the find stays owed for its own account. |
| S5 | low | "Once a session" was tracked per JS object. The dungeon builds its objects again at every entry, so leaving and coming back rolled every container again. | The dungeon names each container the way the room's memory does: `dun:<map>:<container>`, and for a body the same name plus its death's stamp (a foe the hour raised and killed again leaves a new body). The hour's restock is the same pile and does not roll again. A dungeon with no name of its own keeps using its objects. |
| S6 | low (doc) | The weekly report's `capped` counted the combat cap and the Bank's cap, but not the two finds' caps. Those are the two faucets bounded only by the day, which is where a scripted client would show up. | `capped` and `cappedDays` now also count `gather` and `find`. |
| S7 | nit | A peer's body holding nothing but arrows rolled silver, while the same body of my own did not. | One law (`corpseMarker.js` `arrowsOnly`), read before the take empties the body. |
| D6 | low | The silver find rolled before the open could be refused (a werebeast's pack, GetSuppressInventory). `corpseMarker` rolled after `openWindow` whether or not the window had mounted. | Every door now rolls only after it OPENED: a window that mounted, or the quick door's take. The body doors answer `true` or `!!w` to say which happened. |

**The serpent** (`src/characters/playerEntity.js`, `src/systems/sigilSetPowers.js`, `src/systems/sigil.js`,
`src/systems/sigilSets.js`, `src/scenes/world.js`, `server-account/src/serpents.js`, `src/net/accountClient.js`)

| ID | Sev | Finding | Fix |
|---|---|---|---|
| P1 | low | Shed Skin fired on a killing blow that a death save turned aside (Unbroken, Divine Grace: the door leaves me at 1). It healed on top of the save and spent its recovery on a death that never happened. | The hurt door tells every listener `saved: true`, and Shed Skin sheds nothing on a saved blow. A blow that only takes me under the line still sheds. |
| P2 | medium | An arena bout between players woke every attacking power: a set's Constrict, a sigil's per cent, a Legendary's thorns, and the sets' shields stood. The opponent is a Daedra Lord's stand-in for the formulas, not a player, so the gates that refuse a blow at a player never saw one. The sets slept only for `duelMgr`. This was not new with SERPENT-SET; it went back to SET2. | The duel's word is ONE flag, kept by SIGIL1's door (`sigil.js` setSigilDueling). The sets, the loot's powers and the weapon's own blow all read it. `world.js` raises it for a duel and for a live relay bout between players (`arenaPvpLive`). |
| P3 | low | Constrict never built when a swing hit two foes. The coil moved from foe A to foe B and back, starting over each time. | Mac's call: a coil per foe (a WeakMap, entity to `{ n, until }`). A foe's death ends only its own coil, and a body's coil reads none. |
| P4 | low | A claim from an older client recorded `stones = 1` without minting an ember. Every serpent row counted SERPENT_EMBERS, so a build from before the embers put an ember in the insignia's purse that its pack was never given. The serpent's answer also lacked `stones`, which the gate's answer has. | The row counts the embers the CLAIM says its build's hoard mints (`stones`, at most SERPENT_EMBERS; none from a build before them). The answer says the row's embers, and a repeated claim gets the row's own. The client sends SERPENT_EMBERS with every claim. |
| P5 | low | Neither the production claim's shape (a device's claim id, with Marks open) nor the batch's statement order was pinned. The Coilscale tests drove hand-made Rares that no producer mints. | Pinned through the real Worker in production's shape, so the hoard's answer and the silver's are each read from their own statement. The powers are driven on pieces that `aetheric.js` mintAetheric mints. |
| P6 | low (doc) | Sea-Serpent.md section 11's deploy order was stale (acct78, migration 0081). | It now names acct83 and migration 0083, with the hoard law's place in that order. |
| D2 | low | The serpent's silver card (`CLAIM_SOURCE.serpent`, "Serpent slain") and its embers' glow tier were not pinned. | Both are pinned: the serpent's own source, and the gate's tier (`spoilsPool.js` SIGIL_TIER). |

**The wallet** (`src/systems/decorItems.js`, `src/systems/revenant.js`, `src/ui/enhancedInventory.js`,
`src/ui/enhancedStyle.js`, `src/ui/enhancedPlusStyle.js`, `src/systems/walletItem.js`, `src/systems/quickslots.js`,
`src/systems/startingGear.js`)

| ID | Sev | Finding | Fix |
|---|---|---|---|
| W1 | medium | The decorate panel could set the wallet out, and a piece set down leaves the pack (`decorTool.js` commitOwn). A wallet out of the pack drops what it holds back onto the pack's pages. | `decorStandOf` refuses a pack-only piece the way it refuses the Materials Bag, so the panel lists no row for it. |
| W2 | low (latent) | A revenant could take the wallet (RVN8's pick). One that escaped would keep it, and the wallet gift is only given once. | `revenantMayTake` refuses a pack-only piece, and the next piece is taken instead. |
| W3 | low | Each piece the wallet held was a button that only opened its card, so it lost every other gesture its page gave it: Shift into the store, the drag, the double click, the right click's menu and the pad's X. The docs claimed every act was still there. | Each piece is now the pack's own row (`itemRow`), laid out like the dock's tiles on both skins (the Plus skin's frames had named only the dock's rows). |
| W4 | low (doc) | `startingGear.js` said "every load gives one". | It now says what the code does: a character from before the wallet is given one ONCE, when its save is restored (the `walletGift` mark). |
| W5 | low | The hotbar never asked for the account's silver, so a press only showed a figure if some other door had already asked. Every case without a figure showed the offline words, even online. | The hotbar asks afresh for its next press, with one ask in flight at a time. The silver line says why there is no figure: offline, online while asking, or an account that holds none. |

**The docs, the pins and the merges**

| ID | Sev | Finding | Fix |
|---|---|---|---|
| D3 | low | This PR's cite shift turned the settings pin's range in Settings-Screen-Spec.md from 35 to 35 into 36 to 35, which runs backwards. The root cause is that the page wrote all sixteen of its ranges with U+2011, a non-breaking hyphen. citeShift, citeMerge and citedrift's CD7 read only an ASCII hyphen, so to all three each range was a cite of its first number alone. Every shift moved the head and left the tail, and CD7 never saw a range run backwards. Eight already had. | The sixteen ranges are re-resolved against the code and written in ASCII. CD7b (`test/citedrift.test.js`) refuses a range written with any typographic dash. |
| D4 | low | LOOT-EASE's rewrite of Testing.md's `search1_searchables` row dropped the descriptions of pins that are still live. | The descriptions are restored, and the row gives KIT-ROLL's scope as AUDIT 625 left it. |
| D5 | low | Testing.md's `auditrealm` row said five registrars and that "a sixth fails the pin". The pin lists twelve, and its own title said eight. | Both now say twelve. |
| D7 | low | HARD5's split of Home.md was half done. It moved the 53 page lines that stood together and left eight that stood among the folder lines. The stub said the page index had gone, and the stub and the page's header dated the move to the merge commit instead of its own. | The eight lines moved too, byte for byte, so every page's line is in one place. The stub, the header and Hardening.md's HARD5 record now say what happened and when. |

## Decided, not changed

- **Ruhn's Wrath of the Warden on a saved blow.** It still bursts. SET2 reports a saved blow as the blow it was (one
  that took me under the line), and the Wrath is a burst of damage, not a second save. Shed Skin was a heal on top of
  a save, which is why P1 fixed it.
- **A find whose hour's rate is spent** (`marks-rate`) is let go, and the rest wait owed for the next hour. MARKS_FINAL's
  law: the rate refuses the act, it does not delay it.
- **A pile the hour restocks within a session** rolls no second find, because it is the same pile (S5). A respawned
  foe's body rolls its own find, because its death's stamp is new.
- **`scenes/exterior.js` has no find door.** It is the offline town page, never online, and SILVER-FINDS' finder is
  online only.
- **Artifact procs in an arena bout between players** are DFU's artifacts, not this PR's powers. P2 put the duel's word
  over every power this PR's arcs own and over SIGIL1's blow. Whether a Daedric artifact's own effect should sleep in
  the ring is a question for the arena's arc.

## Found on the way, not this PR's

The mutation sweep below ran every list a moved pin or a changed line touches. It found survivors that existed before
this branch: all seven survive the same way on main itself (`255dffcf`, run there with the same tool). They are
recorded here and left unchanged:

- **GUILD1's five ledger-trigger records** (`tools/mutants/guild1.json`: the kind swapped, the amount signed, the
  balance before, a line for nothing, the ledger on the wrong write). They mutate the `guild_ledger_line` trigger in
  `migrations/0013_guilds.sql`, but `0046_guild_halls.sql` drops and recreates that trigger. Every database the pins
  build therefore runs 0046's trigger, and a mutant of 0013's cannot fail. The records need to be re-aimed at 0046's
  trigger, by content.
- **AUDIT-REALM-L1F3's two client records** (the pieces' client cost, the sale's client share), in the online homes.

## Found while verifying

RENOWN-LOOT's commit had left one pin red. `lr1_lootrarity`'s corpse-door regex still named LOOT-EASE's constant
ladder, where the door now reads `plainFoeRarityWeights(ease)`. The tests a change picks (`npm run test:changed`)
never chose it, because it reads the host's text rather than importing the module it pins. Only the full suite ran
it. The commit had not been pushed, so the pin's move went into RENOWN-LOOT's own commit and every commit on the
branch is green. The lesson is CLAUDE.md's own: a change to a host the source pins read needs the whole suite, here
or in CI, before it is called done.

## The mutation sweep

The sweep covered every list with a record on a line a fix changed or naming a test a fix moved: 56 lists and 2,631
records, judged in a copy of the tree with `tools/mutate.mjs --jobs 4`.

- **2,611 dead**, 14 equivalent as already recorded, and 6 survived:
  - five are GUILD1's pre-existing records (above);
  - the sixth, `SILVER-FINDS-book-refused-owed`, was a gap S3 itself had opened. The hour's refusal got a branch of its
    own, so the record's pin no longer reached the branch that drops a refused find. The pin now asks the refusals of
    the find itself (an id the service cannot read, a kind that does not exist), and `silverfinds.json` re-ran 86 of
    86 dead.
- **The audit's own list, `audit625.json`**, re-ran on the final tree after the cites were re-mapped: 71 of 71 dead.
  The D3 record mutates a bible page, so it is judged in place.

Records re-aimed by content, each keeping the fault it was written for:

- the per-foe coil: SERPENT-SET's six (the coil carried over, uncapped, held twice as long, a death ignored, the blow
  at anyone, a killing blow shed) and its embers record;
- the duel's word: SET1's, SET2's, SET4's two, SET5's two and SIGIL1's player-target record;
- the silver: SILVER-FINDS' twelve and nine more found by `mutantdrift` (home1, lootstack, macbugs, pickupfeed,
  audit28);
- the loot and the wallet: lootease's KIT-ROLL records (its reversed-law notes say so), wallet1, rvn8, fb1004_onebag
  and sigil1;
- the cite shift's own: SURVTIERS3's rest-window cite record.

## Not verified here

There is no GPU and no browser in this container. The sheet's rows (W3) were driven through the DOM harness, not seen.
The arena's relay bout (P2) was driven through its host's word and its source, not through a live bout.
