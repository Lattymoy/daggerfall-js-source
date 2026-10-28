# AUDIT PVP-EASE - the open PvP overhaul read cold, 2026-10-26

The owner, of PVP-EASE (`11-Multiplayer/Wild-Zone.md`: STORE-KEEPS, WILD-INSURE, REPEAT-SHIELD, ZONE-GRACE), the day it was
written: *"Can we audit this"*. Four cold lanes read the change at `b6cdc35d7`, its whole diff since `bf0726620`, in a
frozen worktree. Each lane was given the owner's ask, the owner's design answers and its files, never a conclusion, and
had to reproduce every finding with a probe on the real code before reporting it.

| Lane | Read | Found |
|---|---|---|
| L1 | the account service: `/v1/wild/fall`, `/v1/wild/insure`, migration 0181 (0176 on its branch), the real Worker over the fake D1 | 3 - 3 MAJOR |
| L2 | what a death takes, and storage: the drop law, the death path, the cart, the companions | 3 - 2 MAJOR (both the owner's call), 1 MINOR |
| L3 | the relay's referee and the wire: two real Rooms and the hub (`test/fakeRoom.mjs`) | 7 - 1 BLOCKER, 3 MAJOR (one the owner's call), 3 MINOR (one the owner's call) |
| L4 | the client's insurance book, its card, the words in 25 languages and the edited bible | 8 - 3 MAJOR, 5 MINOR |

21 reported. Five were one defect seen from two lanes:
- L1-3 = L2-2;
- L1-2 = L4-2;
- L3-3 = L4-3;
- L3-7 = L4-6;
- L2-3 = L4-1.

That leaves 16 defects, and all 16 are fixed. Four were design holes the owner settled before the fixing. Each fix is
pinned by a test that fails on the code as it stood, with a mutant in `tools/mutants/audit_pvpease.json` (39 records,
all dead). Records in other lists whose text the fixes moved were re-aimed by content: `wildinsure.json`,
`zonegrace.json`, `auditsea.json`, `housedrop.json`, `int_lane2.json`, `shippvp.json` and `hostsplit.json`.

The one that broke the feature outright: **a cell crossed granted a fresh minute of safe passage** (L3-1). The hub kept a
carry for a struck fighter alone, read within the mend's half minute, so a striker crossing a cell, a fighter whose
passage had run out and a walker who never fought were each granted sixty seconds at every crossing. The lane walked a
fighter cell to cell and kept it under passage the whole time.

## The owner's calls

Asked of the owner with the lanes' options; the owner chose:

| ID | The hole | The owner's choice | Fix |
|---|---|---|---|
| L2-1 | **Storage you can reach from anywhere made the drop optional.** STORE-KEEPS made the cart, a companion's pack, a hold and a sworn one's kit storage no death takes, and every one of them is open from anywhere in the zone, mid-fight, at 1 HP. A cart owner moved the bag, the purse and the letters into the wagon, and a kill cost them one worn piece at most. | "Combat lock" | For `WILD_STORE_LOCK_MS` (60 s) after a player's blow, given or taken (a sword's, a spell's, a ship's gun's), nothing may be stored: the wagon, any list the host marks `storage`, gold dropped into either, and a sworn one's kit. A fall at another's hand locks it a minute past the pick, so a Resurrect inside it stores nothing before the take. Taking out is never locked. `wildStoreLock.js` `wildStoreRefusal`, `noteWildBlow` (a leaf: the account Worker bundles the inventory's law, and the zone's leaf is no part of it); `inventorySession.js` `storeRefusalOf`; `itemTransfer.js` `planStore` and `planDropGold`'s `store` refusal; `revenantCompanions.js` `giveSwornGear`; `seaBroadsides.js`'s hull word. Pinned by `combatlock.test.js`. |
| L1-3 = L2-2 | **A policy was spent when nothing was at risk.** Every insured piece carried or worn lost its policy at any player kill: a hall death (no body searched), a kill whose killer let the pick pass, a worn piece no pick named. Eight insured worn pieces lost eight policies where an uninsured kill could take one piece. | "Only when it saved the piece" | `takeWildDeath`'s `saved`: a dry run of the same law without the policies, on the very save it takes from. Only the policies on what that death would have taken are spent: the worn piece the killer picked, or a bag piece the drop would have carried into the remains. The killer's offer reads no policy at either end, and a pick of an insured piece lands on nothing and spends its policy. That also removes L2-3's two ends disagreeing. Pinned by `wildinsure.test.js` (the drop, the kill in a hall). |
| L3-4 | **Remains looted under safe passage.** The rise's minute made the run back to one's own body untouchable, and a graced player could loot another's. | "Any take ends passage" | A take from any remains, one's own or another's, ends the taker's passage as its blow does: `wildGraceTaken`, the relay's `_wildGraceTake` on `got` and on a collect. Pinned by `zonegrace.test.js`. |
| L3-6 | **A death to a foe rose in the zone with no passage.** Only a fall the referee kept counted as a rise; the bible said every rise. | "Yes, every rise" | A death the referee did not keep, said `died` on its way out, marks the fighter (`diedAt`, carried as `dd` to the town's cell). Its rise inside is granted the minute, once. Pinned by `zonegrace.test.js`. |

## Fixed - the service and the law (L1)

| ID | Sev | Finding | Fix | Pinned by |
|---|---|---|---|---|
| L1-1 | MAJOR | **The repeat shield measured when a fall was carried, not when it was killed.** A receipt is good for an hour, so a killer who held a second kill's receipt (the fallen's page closed on the death screen, `g` 1) until the first's row was half an hour old took it whole. | `wild_falls.ki`, the receipt's own signing. The shield asks for a fall by the same killer within `WILD_REPEAT_S` of this kill, on either side (`idx_wild_falls_pair` on `ki`). | `wildinsure.test.js` REPEAT-SHIELD L1-1 (carried late; either side; fifty minutes apart, both carried now) |
| L1-2 = L4-2 | MAJOR | **A policy never ended unless a fall saved its piece.** Policies on pieces sold, traded, salvaged or dropped before they were in force stood `active` for good, and 32 of them shut the door on the character for ever, with a refusal that blamed the falls. | Such a policy LAPSES at the next insure, in its batch (`state` 'lapsed', migration 0180), and only policies on pieces the record still holds count toward `WILD_INSURE_MAX`. `wildPolicyHeld` reads the key anywhere in the record, so a piece in the cart keeps its policy. The client leaves the cap to the service. | `wildinsure.test.js` THE CAP, A POLICY'S PIECE HELD |

## Fixed - the relay's safe passage (L3)

| ID | Sev | Finding | Fix | Pinned by |
|---|---|---|---|---|
| L3-1 | BLOCKER | **A cell crossed granted a fresh minute** (above). | The carry holds the last fight (`fa`), whether the fighter stands in the zone by the last room's word (`in`), the passage left or ended (`gr`) and a death (`dd`), and `takeCarry` reads all of it at any age (only the bar and the fall stay bounded by the mend and the rise). The relay puts it at an entry, a leave, a socket gone (`_wildLeaveCarry`), a death, a passage ended and a landed blow on the fighter. The hub drops a leave said by a room the fighter has already left (`lr`; `rk` on the branch until the fold, where RAID2's tree check caught a foes frame's raid word read in the relay). A striker's blow puts none: the hub's `in` already refuses a fresh minute, and one put per blow would double the hub's writes. | `zonegrace.test.js` L3-1 THE LAW, L3-1 THE RELAY (two real Rooms and the hub: a striker crossing, a room woken, a real leave and a quiet return) |
| L3-2 | MAJOR | **A room woken from HIBERNATE's sleep granted a fresh minute mid-fight.** Its fighters live in memory, and the 15 s keepalive counted as an entry. | L3-1's carry: the woken room's fighter reads the hub's `in`. | the same |
| L3-3 = L4-3 | MAJOR | **Ships' guns ignored safe passage both ways.** A ship under it was broadsided and boarded, and a graced captain wrecked a sloop while staying immune to blades. | `seaShot`: a ship whose captain is under passage takes no shot (`grace`); a shooter's shot ends its passage (`graceEnded`, said by `_wildGraceBlow`); a landed shot is a fight for both, for an entry's ask. | `zonegrace.test.js` L3-3 THE SEA |
| L3-5 | MINOR | **A passage ended by the fighter's own blow came back at the next cell**: the hub still held the carry from before it ended. | The carry is put when a passage ends, and `takeCarry` sets the passage from the carry, none when it holds none. | `zonegrace.test.js` L3-1 THE LAW |
| L3-7 = L4-6 | MINOR | **"Your safe passage has ended. Other players can attack you." came a minute after stepping out of the zone**, and every stranger heard stayed in the client's map. | `wildGrace.frame(inZone)`: out of the zone it forgets and says nothing, and strangers' passages that ran out are pruned. | `zonegrace.test.js` THE CLIENT |

## Fixed - the client's book and words (L2, L4)

| ID | Sev | Finding | Fix | Pinned by |
|---|---|---|---|---|
| L4-1 = L2-3 | MAJOR | **The book read the policies once, at boot, for a stand-in character, and never again.** `characterIdOf` mints an id before the save loads, the service answered `body`, and `fresh()` had no caller. Every player's card showed no policy, Insure was offered on insured pieces, and the first dead frame offered insured pieces the service then kept. | The book is the joined realm character's (`realmSession.id`). The card asks it again when stale (`lineOf` calls `fresh`). The offer reads no policy (L2-2). | `wildinsure.test.js` THE BOOK, THE WORDS AND THE HOST |
| L4-4 | MINOR | **A policy whose write landed but whose answer was lost was forgotten** (`realmGoldAct`'s `landed`). | The book reads its policies back. | `wildinsure.test.js` THE BOOK |
| L4-5 | MINOR | **"In force" was judged by the device's clock.** | The book takes the shared clock (`Date.now() + _sharedOffsetMs`), as the host's other books do. | `wildinsure.test.js` THE WORDS AND THE HOST |
| L4-7 | MINOR | **Twelve part-drafted languages still said the cart drops** (`tutorials.wildZone.body2` on its old English). AUDIT UPDATE II A4 caught it too. | Redrafted in el, fi, hu, ja, nl, pl, sv, tr, uk, vi, zh-Hans and zh-Hant. | `audit_update_ii.test.js` |
| L4-8 | MINOR (docs) | **Two claims in Wild-Zone.md were false**: the book read "again when stale" and "again after ten minutes". | True now (L4-1), and the page says how. | - |

## Found in the fixing

The full suite on the merged head, which the change had not yet faced whole, caught:
- **AUDIT SET D6.** The Enhanced pack's new import of the insurance book loaded the item law's graph, which registers the
  item law with the wire (`setItemLaw`) for every reader of `validLootItem` on the page or in the test. The test's honest
  set pieces were then judged by it. The pack now reads the book through a leaf of its own,
  `net/wild/wildInsureSlot.js`.
- **The pins STORE-KEEPS should have moved.** WILD1's and LETTERS-DROP's cart drop, the schema's table list
  (`wild_insurance`), INT3's sinks (the premium burnt into no player's hands), and the account-version history's regex.
- **Three account-version pins written as regexes** (`/^acct194$/`), which a quoted-value bump does not see.

## The numbers after it

- Relay `world270`, re-hashed in place (not yet deployed; `world269` on its branch).
- Account `acct196` (`acct195` on its branch).
- Migration 0181 (0176 on its branch) carries `ki` and the lapsed state; it has not been applied anywhere yet.
- All three renumbered past the TESA fold's own when PVP-EASE was folded into #1184.
- bootWorld 36,208 -> 36,211: the book's shared clock and the combat lock's blow, wiring alone. The lock's law lives in
  `wildZone.js` and its readers.
