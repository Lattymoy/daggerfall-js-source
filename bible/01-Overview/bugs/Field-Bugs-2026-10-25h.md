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
| 3 | (the two-client check of #1246, 2026-10-26) a fall's whole drop lost: the service took it off the fallen's record and no remains stood, whoever carried it | The room checked a deposit's remains order with its verifying key without loading it. A hello loads the key, and a room that woke from hibernation since its last hello held none, so it refused every chunk - the fallen's own tab's and its killer's seizure alike. It predates WILD-REJOIN (INT9's deposit arm read the key so from the start) | WILD-REMAINS-LOSS |
| 4 | (the same check) a seizure's remains stood as "Traveller", "Your remains" on its killer's screen, and unmarked on the fallen's | The room named a remains for the socket that laid it, and a game read a remains as its own by the peer that laid it (`oid`) before the fallen's account (`os`). A seizure is laid by the killer | WILD-REMAINS-LOSS |
| 5 | (#1302's re-check, 2026-10-27) a fallen game the social hub had not seated never took its drop; its killer's seizure took it, and the fallen rose with every item still in its pack | A game knew its own account only from the hub's snapshot, so it never read a fall's receipt as its own. The seizure moved the record under it (its next save is refused, never written twice), but until then it held and could use what the remains held. INT9 read the account so from the start | WILD-REMAINS-LOSS |

## WILD-REJOIN (1, 2) - `src/net/wild/wildRef.js`, `server/src/index.js`, `src/net/wild/wildReceipt.js`, `server-account/src/wild.js`, `src/systems/wild/wildRejoin.js`, `src/scenes/world.js`

No DFU member: the open zone and its referee are DFO's own (`11-Multiplayer/Wild-Zone.md`), so no Ledger row is owed.

THE CHANGE:

- THE REFEREE SAYS A FALL IS STILL DOWN. The fighter keeps where its body lay with its fall
  (`wildRef.js:"t.fell = { r: rid"`), and a socket that says it stands
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

## WILD-REMAINS-LOSS (3, 4, 5) - `server/src/index.js`, `server-account/src/wild.js`, `src/net/identityToken.js`, `src/net/wild/wildRemains.js`, `src/scenes/world.js`, `src/net/wild/wildSelf.js`, `tools/loadHarness.mjs`

Found by the two-client check of #1246 on main's `9aa6bc4662` (the real relay and account service in local workerd, two
browser clients). In two runs of three the fallen came back with 19 of 46 items and its killer never saw the remains.
The relay now says in its log why it keeps nothing of a `fall` chunk
(`server/src/index.js:"_wildFallRefused(ws, a, d, why, rec = null, junk = true) {"` - each exit had been silent), and the
rerun named it on every chunk: `order-no-key`, in the plain-death control (the fallen on its death screen, its own tab
carrying the drop) as in the early return (its killer's seizure). The base before #1246 (`5233ad703c`) lost the same
way where no hello had reached the woken room before the deposit, and kept the remains where the fallen's returning
game had said hello first.

THE CHANGE:

- THE KEY LOADED FIRST. The `fall` arm loads the room's verifying key before it checks the order, as every other
  order's check does (`server/src/index.js:"WILD-REMAINS-LOSS: the key loaded first"`). Nothing drops twice: a remains
  is still laid once a fall, the second carrier's deposit answered by the first (`laid-already` in the log).
- THE REMAINS NAMED FOR THE FALLEN. The service's remains order carries the name the fallen wears, `wnm` - its token's,
  by the same law: the account's name, or the realm character's where the player chose it
  (`wild.js:"async function fallenNameOf"` over `accounts.js:"export async function wornNameOf"`, checked as the wire keeps a name -
  `identityToken.js:"&& !(typeof c.wnm === 'string' && c.wnm === sanitizeName(c.wnm))"`), and the room names the remains with it whoever carries the order
  (`server/src/index.js:"nm: c.wnm ?? (a.sub === c.s"`). A game reads a remains as its own by the fallen's account where
  the room names one, by the peer that laid it only where it names none, or as the remains its own deposit laid
  (`wildRemains.js:"export const remainsMine"`). A guest's game knows its account too, so a guest is marked as a
  registered player is.
- A GAME THE HUB HAS NOT SEATED KNOWS ITS OWN FALL (WILD-HUBLESS, 5). The zone reads my account as the hub's word where it
  has seated me, else the signed-in session's - the token's subject, the same id the receipt's `f` and `k` and the
  remains' `os` name (`wildSelf.js:"export const wildSelf = "`). A fallen game with its hub link down or its snapshot not
  yet in takes its own drop, and its killer's game seizes, and each marks its own remains, as a seated one does. No DFU
  reference: DFU has no online zone and no drop at death.
- THE HARNESS MINTS THE GATE PAIR. `standServices` minted the identity pair alone, so the local account service answered
  every seizure `no-gate-key`; it mints the gate's receipt pair beside it now
  (`loadHarness.mjs:"const [gatePriv, gatePub]"`, `tools/mintGateKeys.mjs`).

Pinned by `test/net/wildremainsloss.test.js` (a deposit by the fallen and by its killer into a room woken since its
last hello, through the real account service and the relay's Room); `tools/mutants/wildremainsloss.json` (9, all dead); `test/net/wildself.test.js`, `tools/mutants/wildself.json` (2, all
dead).

NOT DONE, and asked: three other relay paths read the verifying key without loading it first - a ranked deck's vouch
and the Iliac table's (`server/src/index.js:"async _iliacVouch(a, m, now, refuse) {"`), and a siege's admission
(`server/src/index.js:"async _siegeAdmit(key, who, sp, now) {"`). A room woken since its last hello refuses them the same
way. The game's own `canTake` still reads the remains' `oid` as the fallen's peer (a seizure's carrier is its killer),
so the killer's party and guild see no pile of a remains the room would let them take.

DEPLOY: the account service `acct208` (acct193 to acct207 on its branch, renumbered past COPY-LIFT, NIRNROOT-SAGE, LOCKPICK, WOVEN-PAYS, JEWEL-KIN, FIELD BUGS 2026-10-26r, MASTER-ART, SEA-OPEN, APPEARANCES, HUNTERS-MARK, LEVEL-45, SHOP and SHOP-LOCAL at the merges) first (its order's `wnm` - an older relay ignores the field), then the relay
`world277` (world265 to world276 on its branch, renumbered past GATE-COURTS, AUDIT KETCH II, KETCH-WORDS, NIRNROOT-SAGE, BOW-TOPS, CHAT-POST, MASTER-THREE, FIELD BUGS 2026-10-26r, APPEARANCES and HUNTERS-MARK, LADDER-CUT, SD-PARTY and TESA and SHOP at the merges), then the site.

LIMITS (`11-Multiplayer/Wild-Zone.md` section 22): a page that comes back outside the zone, or inside one of its
buildings, says no zone word and hears no `down` until it steps into the zone; the hub's carry is in memory alone; a
fallen whose socket blinked just as its fall was signed is counted gone.
