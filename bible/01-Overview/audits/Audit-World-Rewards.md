# AUDIT WORLD-REWARDS (2026-10-15) - the world's rewards, audited

The owner, of GILDED2 and SERPENT5 (the gate's and the serpent's Gilded weapons, the serpent's title and aura -
`06-Systems/Gilded.md` section 7, `11-Multiplayer/Sea-Serpent.md` section 17; branch `ccr-e660de04-86ebxr` at 696a9229):
**"Audit this"**. This page is the findings, each with its verdict. What the audit changed is written into the record's
sections as they now stand, each marked AUDIT WORLD-REWARDS and its id.

## How it was run

Five lanes, each a cold adversarial reader of a FROZEN snapshot (a worktree at 696a9229 - `Home.md`'s DO NOT FIX WHILE
THE VERIFIER IS READING: the fixes went into the tree while the lanes read the snapshot), each told to prove a finding -
a repro run against the real code, or the code quoted with a concrete trace - before reporting it; then the author's
pass, every finding reproduced before it was acted on, and every fix proven by the lane's own repro run again against
the fixed tree:

| Lane | Over | How |
|---|---|---|
| A - the items, the law, the drops | `systems/gilded.js`, the spoils, every door a piece passes (the wire, the item law and the judge, saves, trade, the market, the vault, the crash records, every door that alters a piece), the floor's pictures, the budget | both trees imported in one process; 5,999 seeds base against new; the real judge, market and trade checks |
| B - the powers in the real flow | `systems/loot/lootPowers.js` Dragonfire and Undertow against the real call sites | the real `calculateAttackDamage` and `PlayerWeapon.resolveHit`, the gate court's real stand-ins (`bossStandIn`, `hostStandIn`, `crystalStandIn`) |
| C - the serpent's honours | `server-account/src/serpents.js`, migration 0116 (0119 since the merge of main), `titles.js`, the vocabulary and the relay, `net/serpent/serpentClaims.js`, the world host's door | the real Worker on node:sqlite with forced draws; a race of two claims; every statement's binds counted; 402 recorded mutants |
| D - the Maelstrom drawn | `render/auraRing.js`'s ninth look and every reader of an aura | the real `AuraRingRenderer` in headless Chromium (ANGLE's strict ES 3.00 translator), a float target, clipping measured over lit floors |
| E - the record, the tests, the mutants | every sentence the slice wrote against the code; every moved pin; every re-aimed record | 39 recorded mutants run; seven new ones written; 87 records over the touched files run again |

What reached a player: nothing yet (the branch is unmerged, the relay and the service undeployed). On the branch, the
gate's own reward did not do its one thing in the gate: Dragonfire never fired at the Warden or his host (B1) - nor would
it in an Elite Gate, whose legion the relay runs too; a swing that felled two lost a kill's heal (B2); over a lit floor
The Maelstrom washed out to white (D1); and the Hour's popup pin had gone blind under the serpent's new line (C1).

## Findings

### Lane A - the items, the law, the drops

| # | Sev | Finding | Verdict |
|---|---|---|---|
| A1 | LOW | The Oath took a picture draw among the pieces, so in every spoils it came in the ember's, the gold's, the card's and the gems' floor pictures moved off what the seed gave them (51 of 5,999 seeds) - AUDIT CARDS-6 A8's law | FIXED: its picture drawn LAST (`scenes/spoilsPool.js` `spoilsList`); pinned against the look stream's own oracle (`gilded2_world` THE FLOOR), mutant |
| A2 | LOW | Three pieces, a Regalia piece, the Oath and the card put the gold pile ninth - past the glow's eight, its line undrawn (7 in 20,000) | LEFT, its reason in `Gilded.md` section 7: the Oath is always inside the eight; the gold pile's line is the least of them |
| A3 | LOW | The wealth budget's spoils grant is not sized for a 93,750 piece | LEFT, its reason in `Gilded.md` section 7: a measure today (`enforce: false`), its numbers the measure's to set; loosening it for every claim loosens what it catches |
| A4 | LOW | An older build refuses a container or lot holding either record whole (`validLootList`) | LEFT, written: read as "from a newer version" and kept, nothing lost, and the relay's new version brings every client to the new build (SERPENT-SET's own trade-off) |
| A5 | LOW | The Collections page's codex never showed the Gilded rung (GILDED1's gap; wider by two hints) though it says its rows are the Reforge's | FIXED: the rung first, each by its own hint, a found one opened whole in the Reforge's lines (`ui/collectionsPage.js`); `auditcards5_ui` pins it, mutant |
| A6 | LOW | The acct135 note (acct137 since the merge of main) named SERPENT5 alone, not item law 5 | FIXED (`server-account/src/service.js`) |

Checked clean, with the real pieces: the mint byte-identical and drawless (the Hourlock's too); the wire, the item law,
the judge (no findings, law 5), the market and the vault, realm trade (438 bytes), saves and the crash records; every
door that alters a piece refuses both; both draws truly last (0 mismatches over 5,999 seeds, the Abyss's list untouched).

### Lane B - the powers in the real flow

| # | Sev | Finding | Verdict |
|---|---|---|---|
| B1 | HIGH | Dragonfire never fired in the gate: the court, its Warden, his crystals and his host are the relay's bodies, no record of any door, so the burst found nothing (twenty real blows on the Warden's stand-in: no burst) - and an Elite Gate's legion is the relay's too. Of the host only the Ward-Bearers are Daedra by DFU's groups | FIXED: the STRUCK Daedra burns again for a third - through its record, or owed to its blow's own claim where the relay runs it (OPEN-HAND's path, `oweFoe` -> `landOnBoss`/`landOnHost`); the slayer line went (+15 Endurance in its place - the two together were three quarters over the best of the melee); the lane's repro: 181 owed of 545 landed |
| B2 | MED | Undertow's kill heal was one slot, so a swing that struck two (every struck foe's strike is told before the hosts apply any) healed for neither the first felled nor both | FIXED: each foe its own record; the lane's repro: 50 -> 63 and 50 -> 73, a heal for each |
| B3 | LOW | A blow the Warden's ward turns still counted Undertow's stacks (lootStrike had no ward check; lootBlow did) | FIXED: `lootStrike` refuses a warded foe - nothing landed, nothing answers it (the toll and the leech with it); Constrict's twin in `sigilSetPowers.js` is the sets' and left to them |
| B4 | LOW | Undertow's stacks never expired: a crystal kept for the whole fight, an Echo kept for the realm, a foe a quickload un-killed came back with them | FIXED: a 6 s window from the last landed blow, as Flow's; the lane's repro a Reckoning (60 s) later: 100, not 150 |
| B5 | LOW | `Gilded.md` said 9.9 where a third of the blow is 9.8; Systems.md and Page-Index still said one record; no HUD chip | FIXED (the numbers measured - E6); the chip LEFT: no law asks one, and the Hourlock's toll shows none |

Checked clean: the strike's damage is the final landed number; pool and co-op foes keep their entity; no recursion
through `hurtFoe`; the powers sleep in duels and arena PvP; Earthshaker-alike reach elsewhere; prices and spans.

### Lane C - the serpent's honours

| # | Sev | Finding | Verdict |
|---|---|---|---|
| C1 | MED | `test/systems/lootbanner.test.js`'s pin on the Hour's popup door matched the serpent's identical new line, so the Hour's could be dropped unseen (HONOUR-BANNER-world-hands-no-door SURVIVED) | FIXED: anchored to `createSdClaims`'s own door; the record dies again |
| C2 | LOW | The two new chat lines were hard-coded English and the L10N4 ratchet was raised for them | FIXED: routed (`serpent.honour.title` / `.aura`), drafted in-session in the thirteen whole languages through `tools/l10nInSession.mjs`, the ratchet back to 4 (the records' words stay with the ladder's - `Gilded.md` section 7) |
| C3 | LOW | Two claims at the same moment from two devices can both answer "New" | LEFT: one client claims in turn; only two tabs or devices at once, and the Hour's claim is the same - the row stays right |
| C4 | INFO | A lost answer's retry says `claimed`: the grant is held but not said | LEFT: the Hour's own behaviour; the wardrobe shows it |

Checked clean: the route passes the grants through; a race lays one claim's draw; every bind counted (INSERT 12/12,
UPDATE 10/10); the rates over 400,000 draws; the token (304 characters) and the wardrobe; board and mail badges; the
relay's world205 hash; migrations 0001-0116 whole; the deploy order the workflow enforces.

### Lane D - The Maelstrom drawn

| # | Sev | Finding | Verdict |
|---|---|---|---|
| D1 | MED | Over a lit floor it washed out to white - 723 and 4,706 pixels clipped at 0.42 and 0.55 floors, where The Turning Hour clips 151 and 497 - the failure FIRST_SHADE fixed, not carried | FIXED: `MAELSTROM_SHADE` 0.72; the lane's own probe on the fixed tree: 95 and 415 |
| D2 | LOW | `pow(0.5 + 0.5 * cos(ph), 6.0)` with no guard - GLSL leaves a negative base undefined (AUDIT SD II's law) | FIXED: `max(..., 0.0)`; a source pin (the interpreter's Math.pow cannot see it), mutant |
| D3 | LOW | `tools/auraProbe.mjs`, the real GL's only aura check, did not draw it | FIXED: five checks (arms where the law stands them, the eye, the wrap, unkindled, the curl from the side) - 77/77 |
| D4 | INFO | A drop's arc topped out at the strip's edge, its top half cut; and (E5) the spray was not carried with the pool | FIXED: `MAELSTROM_DROP_TOP` 0.9 |

Checked clean: compiled, linked and validated under ANGLE's strict translator with empty logs; no NaN or Inf; legible
as a three-armed whirlpool; clockwise on screen as claimed; no seam at the clock's wrap or the angle's; every consumer of
an aura generic; COIL_TIDE's distance from every title colour.

### Lane E - the record, the tests, the mutants

| # | Sev | Finding | Verdict |
|---|---|---|---|
| E1 | MED | An aura held already was never pinned "never new", at the service or the carrier (two mutants SURVIVED) | FIXED: pinned at both; mutants |
| E2 | LOW | "A service from before acct135 says neither" (acct137 since the merge of main) pinned for the title alone | FIXED |
| E3 | LOW | The kill row's `aura` column unpinned but where both dropped | FIXED: a title-only and an aura-only row read |
| E4 | LOW | Dragonfire's 3 m pinned only by a foe at 3.4 m | FIXED: one at 3.05 m; mutant |
| E5 | LOW | The surf and the spray unpinned - and "carried round with the pool" false (a tenth of its pace, snapping back) | FIXED: the spray carried with the pool (`maelstromDropAt`, the shader's mirror); both pinned by the shader run; mutants |
| E6 | MED | Section 7's table missed the Oath's own +15 Strength (+3 a blow) | FIXED: the table MEASURED with the real `weaponAttackDamage` |
| E7 | LOW | Comments and an index still said "one record" | FIXED (gilded.js, testRoom.js, sdSpoils.js, Systems.md, Page-Index) |
| E8 | LOW | The L10N4 ratchet raised for new English | FIXED with C2 for the sentences; the records' words named in section 7 |
| E9 | LOW | No SERPENT5 test ran the real producer at the route | FIXED: THE ROUTE - the real Worker, the session's own row, a forced draw |
| E10 | LOW | A moved pin's comment credited GILDED2 with the wardrobe's items | FIXED |
| E11 | INFO | The acct135 note, truncated hint quotes, a re-aim note's wording | FIXED |

Checked clean: every other claim of the record; every moved pin narrowed by exactly the new draw on both sides; every
re-aimed record still aimed at its law (the 87 run again; the one survivor, WB5-ammunition-kept, survives on the base too).

## Pinned

`test/systems/gilded2_world.test.js` (8) and `tools/mutants/gilded2.json` (25, all dead); `test/net/serpent/serpent5_honours.test.js` (9)
and `tools/mutants/serpent5.json` (30, all dead); `test/systems/auditcards5_ui.test.js`'s Gilded rows; `test/systems/lootbanner.test.js`'s
anchored door; `tools/auraProbe.mjs`'s Maelstrom (77/77). The lanes' repros (lane B's real-flow scripts, lane D's
real-GL probe) were run again against the fixed tree, and their numbers are the ones written above.
