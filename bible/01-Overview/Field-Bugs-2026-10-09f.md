# FIELD BUGS 2026-10-09f - ten Discord threads

Ten threads from the Discord's bug-reports, handed over as screenshots. Six were already answered by earlier waves.

| | Report | What it was | Done |
|---|---|---|---|
| 1 | "Missing quest location house - An Item On Loan" (Black Feather Meadowlark) | Beautiful Villages' TEMPASD1 House2 #6 in the author's hills | fixed already (HILL-HOUSE, `Field-Bugs-2026-10-09e.md`) |
| 2 | "Ghost companion isn't showing health bar - clipping into ceiling" (BigOOF) | a following flyer's floor lift | fixed already (CEIL-GHOST, `Field-Bugs-2026-10-09c.md`) |
| 3 | "Cast when held destroying Magic gear durability" - "breaking sometimes IMMEDIATELY when re-equipping" (BigOOF) | DFU bills a held spell's whole casting cost at every equip | fixed (HELD-REWEAR), a departure |
| 4 | "Some ingredients won't let you store them" (axelento) | law 3: the Stores take back only what the service counted | the page names them already (UNCOUNTED, `Field-Bugs-2026-10-09c.md`); counting looted or traded units is the owner's call |
| 5 | "River/Stream Creation Turned Some Roads into Canals" (Codename: Scheming Eunuch) | a shared arm painted as water | fixed already (CANAL-ARM, `Field-Bugs-2026-10-09b.md`) |
| 6 | The Stolen Item's thief unknown to the questor (Etrius) | DFU's own law | kept (`Field-Bugs-2026-10-09b.md`) |
| 7 | "Blocked out of continuing as another bloodline character" (Sahh) | online a failed heir's birth left the line no door | fixed (HOUSE-WAITS) |
| 8 | "Dark Brotherhood not showing on city map" (satoshi god pack) | DISC28-K's re-stamp blanked the reveal | fixed already (HALL-STAMP, `Field-Bugs-2026-10-09b.md`) |
| 9 | weapon and torch both in the right hand (Starempire42) | - | not taken up (the owner: not important) |
| 10 | Lord K'var Part 1 stuck in Privateer's Hold (Themicles) | the main story's dungeon seated a random quest | fixed already (KVAR-HOLD); not reproduced since (`Field-Bugs-2026-10-09b.md`) |

## HELD-REWEAR: a fresh spell is not paid twice, and the bill never breaks the piece (3)

CastWhenHeld.cs InstantiateSpellBundle lowers the item by the spell's casting cost (CalculateCastingCost at the
player's live skill) at every equip that is not a recast - a hundred-odd points on an 800-point amulet - and the
port's hotbar wear slots and the pack's swaps make equips cheap to repeat. A piece swapped off and on was spent by the
swapping, and one with less left than the bill broke the moment it went on. Two laws now (`systems/enchantments.js`):
a piece re-worn within REROLL_MINIMUM_HOURS (6) of `timeEffectsLastRerolled` - the stamp every equip and reroll writes,
DFU's own recast clock - pays nothing, decided once per piece before its first power restamps; and the bill stops at 1
condition (`heldEquipBill`, after the weapon pool's repool). The wear while worn (1 every 4 magic rounds) is DFU's and
still breaks a piece in the end. Port-Ledger A, HELD-REWEAR. Pinned by `test/fb1009f.test.js`.

## HOUSE-WAITS: the Online page answers a waiting Succession (7)

A Bloodline fall waits on the record (`family.pending`), and its only door was a save of the line loaded into the world.
Online the fallen is the realm's tombstone (the roster drops them, the realm refuses their join) and a sibling never
played has no character, so a heir's birth that went back to the title ("The heir could not be born ... load the
fallen's save") left a line with living members and nothing to press. The Online page now reads the account's lines
(`legacy/realmLine.js` pull) and shows each whose fall waits, with a "Carry on as" button for every living member of the
blood without a living character (`systems/legacy/waitingHouses.js` waitingHouses). The press is succeed's choice made
from the menu (`takeUpLine`: the heir current and of age, the record stored and pushed to the realm, the birth left in
the tab) and boots `?online&realmnew&legacyborn=` through `main.js` - the world host's own online birth, which settles
the fall when the heir lands. The failed birth's words online now point at the Online page. NOT PROVEN on the
reporter's account: why their first birth failed is not known (a refusal is said on the card now). Port-Ledger A,
HOUSE-WAITS. Pinned by `test/fb1009f.test.js`.
