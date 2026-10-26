# FIELD BUGS 2026-10-25h - a death in the open zone escaped by closing the game

One report, from a player, with the killer's own account of it: "if you die in the wilderness and alt f4 before you
are looted you wont be able to be looted by who killed you. you can also skip the death timer this way. Its way faster
to log in than wait 2 minutes." - "I killed a guy and was unable to loot him. He had Daedric gear on, i could see it. he
must have Alt f4'd. He then came back immedietly". Read on main's `80eafd01ff`. The pins are
`test/systems/wild/wildrejoin.test.js` and int9's WILD-REJOIN THE SERVICE (`test/net/int9_wild_ref.test.js`), the
mutants `tools/mutants/wildrejoin.json` (22, all dead). Not seen with two live clients: the relay, the service and the
page's decisions run in the pins, the world host's wiring of them does not.

| | Report | What it was | Done |
|---|---|---|---|
| 1 | "you can also skip the death timer this way" | A fall lives in the relay's referee and on the dying game's screen. The account service's record is the last save from before it - a dead character is never saved (`realmCheckpoint`), and the death's own save runs only when the fall's receipt reaches the game. A game closed on the death screen came back alive, where it last saved, its two minutes skipped. The referee still held the fighter down - so it walked the zone alive and could not be struck | WILD-REJOIN |
| 2 | "you wont be able to be looted by who killed you" | Nothing reached the killer while the fallen's game was gone: its receipt waited `WILD_FALL_GRACE_S` (and the pick, or `WILD_REF.pickMs`) for the fallen's own tab to take the drop first. A game that came back in the same room took its drop when its owed receipt arrived - and laid nothing, since the body it remembers was read at a death this page never had (`_wildBody` null). The pile then stood only if the killer's own seizure asked again inside the order's minute | WILD-REJOIN |

## WILD-REJOIN (1, 2) - `src/net/wild/wildRef.js`, `server/src/index.js`, `src/net/wild/wildReceipt.js`, `server-account/src/wild.js`, `src/systems/wild/wildRejoin.js`, `src/scenes/world.js`

No DFU member: the open zone and its referee are DFO's own (`11-Multiplayer/Wild-Zone.md`), so no Ledger row is owed.

THE CHANGE:

- THE REFEREE SAYS A FALL IS STILL DOWN. The fighter keeps where its body lay with its fall
  (`wildRef.js:"t.fell = { r: rid, at: now, pose: t.pose ? { ...t.pose } : null };"`), and a socket that says it stands
  in the zone while its fighter is down is told `{ t: 'wref', k: 'down', ms, r?, p? }`
  (`wildRef.js:"export function wildDownWord"`, said by `server/src/index.js:"_wildDownSay(st, sub, now) {"`) - the time left and,
  from the room that refereed the fall, its remains' id and the body's place. It is said BEFORE the receipts the socket
  is owed, so the page is dead when it takes its drop. A fall carried from another room (the hub's carry) says its time
  alone. Nothing is said inside `WILD_DOWN_SAY_MIN_MS` (5 s) of the rise: a hall's death rises in a town of the zone, and
  a risen fallen is never killed again by clocks a moment apart.
- THE PAGE LIES DOWN AGAIN (`systems/wild/wildRejoin.js`, wired in `world.js:"const wildDownIn = (g, room) => {"`). A
  living page that saw no death of its own in the zone inside `WILD_REJOIN_KNOWN_MS` takes the word: the death's words
  set (a kill, nothing dropped yet, `served` the seconds it already lay - kept through the death's later words), the
  character put down by `playerEntity.js:"export function presentHeardDeath"` (the health at zero and the host's screen,
  no subscriber told again: Project Legacy decided the death on the page that closed), and the body laid where the word
  says. The death screen holds `WILD_DEATH_HOLD_S` less `served` (`deathScreen.js:"get holdSeconds()"`). The first dead
  frame takes that death once (`wildRejoin.begin`) and offers no worn piece; the rise is the zone's as ever. A page that
  knows its death - on the screen, risen, raised by a party's Resurrect - takes nothing.
- THE KILLER DOES NOT WAIT FOR A GAME THAT HAS GONE. A fall signed while its fallen had no socket in the room carries
  `g` 1 (`server/src/index.js:"const fallenGone = this._siegeSocketOf(fall.fallen) ? 0 : 1;"`), and its grace is none
  (`wildReceipt.js:"export const wildFallGraceS"`): the service lets the killer seize at once, and the killer's tab
  carries it five seconds after the receipt, where it waited thirty-five. An account service from before the word
  answers 'grace'; the tab asks again once the old grace has gone by, once.

THE SEIZURE'S FRAME MOVED (HOST-SPLIT): `bootWorld` stood one logical line under its ceiling. `wildSeizeFrame` - one
member, writing nothing of the host's - went verbatim to `src/scenes/wildSeizeHost.js` (`createWildSeizeHost`) by
`tools/hostMove.mjs` before the change touched it, 17 logical lines out; the wiring took them back (36,386 before and
after). Two pins that quoted it read the moved spelling (`host.online`). The body record both deaths lay - composed
twice in the host - is the module's `bodyAt` (`wildRejoin.js:"bodyAt(p, room) {"`): 4 logical lines more out, the
ceiling down by them (`01-Overview/Host-Split.md`, WILD-REJOIN BODY).

DECIDED (2026-10-25, the two questions asked with the fix, answered "with your recommended defaults"): a page that comes
back serves the time LEFT of the two minutes, never a fresh two; the killer keeps the whole pick window when the fallen's
game closes before it picks.

THE FOUR HOSTS: `world.js` wired (the zone's death, its referee's words and its seizure are the streaming host's alone).
`exterior.js`, `worldModes.js` and `dungeonContext.js` run no zone death of their own - the zone's halls and buildings
die through `world.js`'s online frame - so none is wired.

DEPLOY: the account service `acct191` (acct186 on its branch, renumbered past DECOR-USE and PERK-TRIAL, AFFIX-LINES and REFORGE-REPLACE, FIRST-BUDGET, DAEDRIC-SMELT and DEEP-OPEN, and BROKER-RID at the merges) FIRST (an older one holds a `g` fall's killer to the grace), then the relay
`world260` (world258 on its branch, renumbered past KETCH-LONGER and ASK-LONGER at the merges), then the site.

LIMITS (`11-Multiplayer/Wild-Zone.md` section 22): a page that comes back outside the zone, or inside one of its
buildings, says no zone word and hears no `down` until it steps into the zone; the hub's carry is in memory alone; a
fallen whose socket blinked just as its fall was signed is counted gone.
