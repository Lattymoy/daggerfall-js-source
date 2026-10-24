# AUDIT FOE-KEEPS (2026-10-24) - a death in the open zone to a foe, audited cold

The owner, of FOE-KEEPS (`11-Multiplayer/Wild-Zone.md` section 4, the answer to *"I feel like the eltheric sea can be too
punishing. I dont want people to lose everything they have. Espcially the fact you can lose your spellbook?
Ridiculous"* - asked, the owner chose "Only PvP deaths drop", "The usual tenth" and "Both zones"): **"Audit this"**.
This page is the findings, each with its verdict. What the audit changed is written into the record's sections as they
now stand (`11-Multiplayer/Wild-Zone.md` sections 3, 4 and 8; `03-World/Eltheric-Ocean.md` ETHER-WILD), each change
under its finding's id, and the code says the same at every site.

## How it was run

Five lanes, each a cold adversarial reader of FOE-KEEPS at 099949918 (its commit 3f7b262a0 and its merge of main), told
to reproduce every finding - a probe and its saved output - before reporting it, to cite the code by its text, and to fix
nothing. They read FROZEN SNAPSHOTS (detached worktrees of 099949918 - lane P its own, since its mutants write the files
they judge; lane O its own, for the browser), never the working tree, so Home.md's DO NOT FIX WHILE THE VERIFIER IS
READING held while the findings already in were fixed in the tree. Every finding below was reproduced again by hand in
the working tree before a line changed; lane H's harness - the real death-flow closures lifted out of world.js, over the
real account service and a real relay-signed receipt - was run again over the fixed tree.

| Lane | Over | How |
|---|---|---|
| L - the law, the service, the relay | the drop law at the tenth, every `/v1/wild/*` route, the `foe` refusal's place and status, a build from before the change against the new service and the reverse, the referee's every way a death gets a receipt | node probes over the real Worker (standService), realmGoldAct and the relay Room |
| H - the client's death flow and the hosts | every order the referee's fall, the first dead frame, the receipt and the rise can come in; the death screen's stated loss; a Resurrect; the four hosts | world.js's own closures, lifted verbatim, over the real modules and service; raw CDP in Chromium for a hidden tab |
| E - the economy and the design's edges | what a cheap death to a foe makes cheap - the zone's way out, the sea's, a hunter denied, the share's math, letters, carts, companions, bounties | node probes over the real modules and the real map on ARENA2 |
| O - the words, the languages, the windows | every sentence that says what a zone death costs, the 5 strings in 25 languages, the death screen and the zone map's legend at 1280, 375 and 360 px | the real DeathScreen, enhanced face and legend in Chromium through the real text core, 108 screenshots |
| P - the pins and the record | every moved and added assertion, `foekeeps.json` and 39 mutants of its own, the docs' every claim, the gates | `tools/mutate.mjs` on its own snapshot; the bible gates and the L10N tests |

**WHAT THEY FOUND.** 44 findings and notes in five lanes, several met by more than one lane (L1 = H1 = P1 = E5; L2 = H3
= P5 = E4; L5 = E6; L6 = E2; L7 = P6 = O7; H6 = O N3; E7 = O N5). Four were design questions put to the owner, who
answered all four: "Rise inside the zone" (E1), "Credit the last player" (E2), "Refuse on the open sea" (E3) and, of
the letters (L5), "Your choice". Every finding is fixed, pinned and named below, or left and said.

## L - the law, the service, the relay

- **L1 HIGH - a kill the first dead frame did not see was charged twice, under "You keep what you carry".** The rise
  decided kill or foe from the killer's name, set at the first dead frame from a fall heard within 15 s. A hidden tab
  hears its socket and runs no frame; a foe's blow kills on my machine while a player's, in flight, reaches the referee
  first. Either way the receipt's take laid the bag and a tenth in the remains, and the rise took the usual tenth again
  - 190 or 200 of 1,000 where the rule is 100. FIXED, as H1.
- **L2 MEDIUM - a tab from before FOE-KEEPS pays nothing at a foe's death.** Its `{ n }` ask meets `foe` (400, nothing
  moved, the session kept) and its own rise skips the tenth at any zone death. LEFT, SAID: a deploy's window that ends
  when the tab reloads, and the gain is the player's; taking an old tab's tenth on the service is a new path for a
  closing window. Section 4 says so.
- **L3 MEDIUM - the Worker's law moved without ACCOUNT_VERSION**, so the site's deploy gate (`deploy.yml`'s wait on
  `/v1/health`) was satisfied by the old service, and a kill could take half while the new game said a tenth. FIXED:
  acct179 -> acct180 (`service.js`, `wrangler.toml`), every pin and mutant record moved by content.
- **L4 MEDIUM, older than FOE-KEEPS - a kill nobody signs drops nothing and costs nothing** (the killer gone before its
  pick, nobody posing in the cell). LEFT, SAID: INT9's, and with H1's fix such a death still pays no tenth - in the
  player's favour, the owner's direction.
- **L5 NOTE - a letter of credit dropped whole at a kill** while coin drops a tenth: 50,100 of 51,000 gone. PUT TO THE
  OWNER ("Your choice") - FIXED, LETTERS-TENTH (below).
- **L6 NOTE - a losing player can die to a foe to dodge the drop.** PUT TO THE OWNER - FIXED, as E2.
- **L7 NOTE - "half" stood in two comments.** FIXED, with P6.

Checked and sound: the tenth's floor per source and its one pile; the refusal after the shape, freeze, room, record and
once-a-fall checks and before any write; the seizure, the escrow handoff, collect, reclaim, the freeze; SEA-BOUNTY and
SHIP-PVP ride receipts alone; the spellbook kept by three rules; no death the owner calls a foe's gets a receipt but L1's
race.

## H - the client's death flow and the hosts

- **H1 HIGH - the double tenth, in three real orders** (a hidden tab's kill; a hall's, signed at once while hidden; the
  race). FIXED: THE KILL IS THE REFEREE'S WORD. The fall now lives beside the kill it makes in `wildZone.js` (it was the
  host's `_wildFell`): `wildDeathAtHand` marks the death a kill whenever the word is heard, names the killer on the
  screen if it is up, and a take against my receipt marks it too (`kill: true`); `wildDeathKill` is what the rise and a
  Resurrect read, `wildFallHeard` what the first dead frame offers the worn pieces against - no 15-second window. Lane
  H's harness over the fixed host: every order 100 (C, D, E and I were 200). Pinned (`auditfoekeeps.test.js` H1, H1 H2
  H4 THE HOST), AFK-H1-*.
- **H2 MEDIUM, older than FOE-KEEPS - a kill whose first dead frame found no room** (the socket reconnecting) was
  charged twice and rose inside the zone. FIXED: the rise reads the kill (`wildRise = !!wildDeath() || wildDeathKill()`).
  AFK-H2-the-room-less-death-rises-in-the-zone.
- **H3 LOW** = L2. LEFT.
- **H4 LOW - a Resurrect after a kill said the gold it claimed stayed in the purse** - it lay in the remains. FIXED: the
  spared loss read before the death ends, none at a kill. AFK-H4-the-rez-reads-the-stated-loss.
- **H5 LOW - "You keep what you carry" stood over a revenant's theft at the rise.** FIXED, with O1's line.
- **H6 LOW - at a kill the screen states the purse's tenth alone**, not the cart's or a companion's coin. LEFT, SAID: the
  purse's figure is now exactly the purse's loss (before, it said a tenth while half went), and the cart's and the
  packs' coin lie in the gold pile the drop line counts.
- Notes: an unsigned kill (= L4); a kill's stated loss is left unspent and every later screen restates it - nothing
  consumes the leftover; THE FOUR HOSTS: interiors and halls reach `respawnOnlinePlayer`, worldModes' in-place respawn is
  the Privateer's Hold's, exterior.js is offline - FOE-KEEPS' record named none of them and now does here; HALL-CROWS
  (= E7).

## E - the economy and the design's edges

- **E1 HIGH - a death to a foe was the zone's free, instant way out**, the cart with it: from the heart the walk out is
  39.5 px at the median (65 real minutes on a horse at the pace cap), and a death rose 46 to 61 px away outside the zone
  for a tenth of the purse - nothing at all with the coin in the cart. PUT TO THE OWNER: "Rise inside the zone". FIXED:
  a foe's death rises at the nearest town or temple INSIDE the zone in the ring it fell in, else anywhere inside, else
  outside (`wildDeath.js:"export function wildRisePicks"`, `world.js` wildRiseSite over it - out of bootWorld); a kill
  still rises outside, a hall's death at the city nearest the hall. Over the real map, 1,412 deaths sampled: every
  foe's rise inside its own ring, a median 5.4 to 7.1 px away; every kill's outside. Pinned (`auditfoekeeps.test.js` E1,
  on ARENA2), AFK-E1-*.
- **E2 HIGH - a player losing a fight denied the winner everything by dying to anything else**, and
  `WILD_KILL_CREDIT_MS` ("the player who brought you down") was read by nothing. PUT TO THE OWNER: "Credit the last
  player". FIXED: my zone word says I left the zone dying (`zone` 0 with `dd`) and the relay names the last fair player
  to strike me within `WILD_REF.creditMs` (10 s, pinned equal) the killer (`wildRef.js` wildCredit,
  `server/src/index.js` _wildCredit): the fall made, said and signed as a blow's. RELAY_VERSION world253 -> world254, its
  law's hash recorded. Pinned over the real relay room (`test/net/auditfoekeeps_relay.test.js`), AFK-E2-*.
- **E3 MEDIUM - on the open sea, a death and the Fleet's Summon were a free hop** for captain, ship and hold to the
  nearest freeport. PUT TO THE OWNER: "Refuse on the open sea". FIXED: no Summon and no Send away into, out of or about
  the open sea while it is a PvP zone (`fleetHost.js` openSea; the host's `where().sea`). Pinned (E3 THE FLEET), AFK-E3-*.
- **E4 LOW** = L2. LEFT.
- **E5 LOW** = L1. FIXED.
- **E6 NOTE** = L5. FIXED, LETTERS-TENTH.
- **E7 NOTE - a foe's death in a hall still calls the crows and grants a pass back in** for remains that no longer
  exist. LEFT, SAID: HALL-CROWS is the owner's call ("whether or not the pack had anything to drop").
- **E8 NOTE, older than FOE-KEEPS - an ordinary death outside the zone can rise in a zone town** (694 of 37,771 region-16
  pixels outside the cut). LEFT, SAID for the owner: the respawn's other arm, outside this change.
- **E9 NOTE - a kill's gold reward is cut by four fifths**, and a solo player who meets no one pays an ordinary death's
  cost for the zone's loot. The owner's choice; no action.

## O - the words, the languages, the windows

- **O1 MEDIUM - "You keep what you carry." was untrue at the one death it is shown for** - over "DEATH CLAIMS 52 GOLD"
  (and in Japanese, "you lose none of your belongings"). FIXED: "Nothing dropped. Only another player's kill drops what
  you carry." - true beside the tenth and a revenant's theft (H5) - in 25 languages. AFK-O1-the-kept-line-again.
- **O2 LOW - the Indonesian line ran past a phone's width on the classic face.** FIXED: the new line is short in every
  language (pinned at 80 characters for the five longest).
- **O3 LOW, older than FOE-KEEPS - on the classic skin the zone's entry line is one unwrapped label** and clips the
  clause FOE-KEEPS added. LEFT, SAID: every long line clips there; the full line stands in the message log.
- **O4 LOW - the tutorial page named the mountains alone and said the bag and cart lost whole at a kill.** FIXED: both
  zones, the cart only while it is with you, a tenth of the gold at a kill and the usual tenth at any other death -
  through the text core, within the popup's sixty words (TUT1). AFK-O4-the-page-read-once.
- **O5 LOW - Hungarian "A Eltheric-óceán"**: FIXED, "Az".
- **O6 LOW, older than FOE-KEEPS - the classic face clips the escrow's "held" line.** LEFT, SAID.
- **O7 LOW** = L7. FIXED.
- Notes: N1, the death screen's neighbours are English constants (L10N4's ratchet's own work) - LEFT; N2, the zone
  map's ZONE_RULES are English and hidden at 860 px and under - LEFT, older; N3 = H6; N4, the sea's words say only a kill
  costs you, though a wreck can be plundered without one - SHIP-PVP's own law, LEFT; N5 = E7; N6, Polish "w Wrothgarian"
  FIXED to "we"; the German, Spanish and French rows drop the article as their other `{zone}` rows do - LEFT; N7, the
  enhanced title overflows at 375 px in three languages - LEFT, older; N8, the client has no sentence for `foe` - no
  current game asks it, LEFT.

## P - the pins and the record

- **P1** = H1. FIXED, and its two surviving mutants (the fall never read; an unnamed killer read as a foe) now die.
- **P2 LOW - every coin the pins held was a multiple of ten.** FIXED: THE SHARE floors a 1,009 purse, a 455 cart and a
  307 pack.
- **P3 LOW - `WILD_GOLD_LOSS` was read by no code.** FIXED: it is `1 / WILD_GOLD_DIVISOR`, and the docs name the divisor.
- **P4 LOW - nothing pinned that the two new getters translate when read.** FIXED: read in German after the module
  loaded.
- **P5** = L2. LEFT.
- **P6 LOW - the old law stood in thirteen places** (Integrity-Arc's drop, Wild-Zone's underground death, wildRemains,
  wildDropLaw's companions, wildDeath's EITHER DEATH, accountClient, the account index, wild.js twice, world.js's dead
  branch, three tests' words). FIXED, each.
- **P7 NOTE - the record's counts and its Pins section.** FIXED: Wild-Zone.md's Pins name FOE-KEEPS' and this audit's
  tests and lists; the counts are restated below.
- **P8 NOTE - the host's edits are pinned by their text**, the project's way for bootWorld; P1's inputs were outside the
  quoted lines - now inside them, and lane H's harness confirms the behaviour over the fixed host.
- **P9 NOTE - ZONE_RULES and the tutorial page were English in every language.** The page FIXED (O4); ZONE_RULES LEFT
  (its module routes nothing).
- **P10 NOTE, outside FOE-KEEPS - INT10-MEND-CLEARS-THE-CASTS survives** in `int_lane2.json` (wildRef.js's mend). LEFT,
  SAID.

## LETTERS-TENTH (L5, E6 - the owner: "Your choice")

Asked whether a kill should take a letter of credit whole, a tenth of its worth, or none, the owner left it to the
audit. DECIDED: A TENTH OF ITS WORTH, the coin's own share - LETTERS-DROP's "letter of credits should be dropped" (a
letter is coin in another form, and one kept whole would make every purse a letter before a fight) and FOE-KEEPS' "I
dont want people to lose everything they have" both kept. A kill takes a tenth of each letter's worth into the remains'
one gold pile and the letter stays where it lies; a quest's letter, one the ledger keeps and one worth under ten pay
nothing (`wildDropLaw.js:"export const WILD_FALL_LETTERS = 1;"`, `gold.letters` by the letter's id). The fallen's own
ask says its game lowers a letter by its share (`letters` 1, `wildDeath.js` wildFallWords) and a seizure - which no game
applies - takes the tenth too; a tab from before the word is answered as before, its letters whole, since its game
would never lower one (the COMPANION-DROP word's own pattern). The death screen says it: "A tenth of your letters of
credit, 5,000 gold, lies where you fell." Pinned (`auditfoekeeps.test.js` LETTERS-TENTH, and through the service),
AFK-LT-*.

## The tests and the mutants

`test/systems/wild/auditfoekeeps.test.js` - 7 tests (H1, the host, the words, E1 on ARENA2, E3, LETTERS-TENTH and its
service); `test/net/auditfoekeeps_relay.test.js` - 3 (E2's law, wire and real relay room); `tools/mutants/auditfoekeeps.json`
- 45 records, 43 dead and 2 recorded equivalent (a fighter down never has a blow to credit; a quest's letter is kept by
the decor law before the share is asked). `test/systems/wild/foekeeps.test.js` (5) and `tools/mutants/foekeeps.json` (12:
11 dead, one recorded equivalent - the spellbook's two rules) moved with it. The versions: ACCOUNT_VERSION acct180,
RELAY_VERSION world254. The neighbouring records re-run after the fixes (200 across 29 lists - int_lane2, fb1019f, fb1015,
etherwild, fb1014, the Fleet's and the ships' lists among them): 195 dead, 4 recorded equivalent, and the one survivor lane
P found before the change (P10).
