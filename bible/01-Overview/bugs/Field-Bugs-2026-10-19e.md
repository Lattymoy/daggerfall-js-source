# FIELD BUGS 2026-10-19e - the Elite Breach's lords: "he wasnt being damaged", and the moment the team died

> Renumbered at the merge of main: main's FIELD BUGS 2026-10-19d (GAUNTLET-SLAIN) took the letter; the test and the
> mutant record were renamed with it (`fb1019e_`), and the relay's version moved past GAUNTLET-SLAIN's `world225`.

A company's word on its Elite Breach, handed over by the owner on 2026-10-19 ("With the elite breach I recieved this
feedback"):

1. *"Felt like he wasnt being damaged"*
2. *"It wasn't hard actually. It felt like the moment team died difficulty went down."*

Read on main at `25ea3b5ab` (#1061's merge), under the owner's standing word on these threads: no band aids, the root
cause. Both reports were traced on the real relay law (`src/net/eliteGates/egBrain.js` over `egLords.js` and
`egBodies.js`) and the real screen state (`src/net/eliteGates/egLink.js` foldEg, `src/ui/eliteGates/egSpireHud.js`
egLordBars). The pins are `fb1019e_*`, the mutants `tools/mutants/fb1019e_*.json`.

| | Report | What it was | Done |
|---|---|---|---|
| 1 | "Felt like he wasnt being damaged" | A lord's health is a share for each member, 180 s of its level's reference damage (Elite-Gates.md section 13.2). The lords were stood for every living member of the breach, in the hall or not, and a member's blow is its share of the whole bar: 0.14% of Grath's at four members of level 30. Teammates who never reached the hall, or who struck under their level's reference, made the bar crawl for everyone. The screen draws the relay's own health; nothing on the wire lost a blow | the lords stood for the company on their hall's plate (LORD-SHARES); the law's pace, said below |
| 2 | "It wasn't hard actually. It felt like the moment team died difficulty went down" | EG-ZQ took a fallen member's share out of every lord at its fall. Grath at 17,773 of 25,200 stood at 4,444 of 6,300 in the beat three of four fell: the survivor felled him when the four of them would have, each of its blows moved his bar four times as far, and a death cost the company nothing against him | fixed (LORD-SHARES): a lord keeps what the fallen leave |

## LORD-SHARES: a lord is stood for the company on its hall's plate, and keeps what the fallen leave (1, 2)

`src/net/eliteGates/egLords.js` (egLordsShare, egLordsStand), `src/net/eliteGates/egBrain.js` (standFight).

FOUND, measured on the real director (egBreachNew, egEnter, egStep, egBlow) at seed 1's Hall 5. That is Grath's Court:
under the current spec law, Halls 5 and 20 are the Hound in every seed from 1 to 60, Halls 10 and 15 the Armsmaster and
the Spellmaster, and Hall 25 Ilthys. Every member struck once a second at its reference damage (35 at level 30), and
every frame was folded through the wire's validator into the client's state, as a screen does.

- **The screen draws the relay's health.** The lord's bar, and the body's health and whole, matched the relay's at
  every beat, and the validator dropped no frame. Nothing between the relay and the screen lost a blow.
- **A lord is its fighters' shares.** Each member brings `ttkRef(c)` seconds of its level's reference (180 s at circle
  1): four members at level 30 stand Grath at 25,200, and one blow of 35 is 0.14% of his bar, under a pixel of its 460.
  The company together moves it 0.55% a second, the same pace one member alone moves its own lord. He ran 190 s at
  reference, as section 18's clock says.
- **A fall shed its share (EG-ZQ).** With three of the four fallen at 60 s, Grath went from 17,773 of 25,200 to 4,444 of
  6,300 in the beat of the falls. The bar's fraction did not change, so nothing was seen to move, but each of the
  survivor's blows moved it four times as far, and he fell at 190 s, when the four would have felled him. A death cost
  the company nothing against a lord, and a company whose members struck under their reference (report 1's crawl)
  found him melting the moment they fell. That is report 2 word for word.
- **The lords were stood for the absent.** A hall's fight is sized at its wake by every living member of the breach
  (standFight's `living(B)`), and a hall wakes 30 s after its pull with whoever reached its plate (EG_ARRIVE_MAX_MS). A
  member still on the stair, or whose socket had closed, held its share in every lord until its absence became a fall
  180 s on, when EG-ZQ shed it. Two of four in the hall fought a Grath of 25,200 for three minutes, then one at half his
  whole, and felled him at 260 s: report 1 and report 2 again, in one fight, with no death at all.

The other two relay bosses already keep what this restores: the Remnant keeps a fallen body's share while its pose stands
in its arena (`net/superDungeon/sdRemnant.js` stepRemnant), and neither it nor the gate retires one but for absence
(`ABSENT_RETIRE_MS`). EG-ZQ's "seven members never face a lord sized for eight" was this arc's own departure from them
(Elite-Gates.md section 13.2, as written at EG-ZQ).

FIXED. One law: THE LORD IS STOOD FOR THE COMPANY ON ITS HALL'S PLATE, AND KEEPS WHAT THE FALLEN LEAVE.
- As a hall wakes, once every lord of it stands, the share of every member not on its arrival plate leaves each lord
  whole (egLordsStand); the lord's last share never does. Each comes in when the director first sees its member in the
  hall, at the fraction the lord stands at (the seen-and-restore step, the gate's newcomer law: a late arrival never
  heals a lord). The hall's fight is still sized by its whole living company: its legion and its errands are unchanged.
- From a lord's wake, no fall takes a share out of it: the living finish what the fallen left. A lord still asleep in
  its ring lets a fallen member's share go, and wakes for the company standing before it.
- The lords are sized in the beat the hall wakes, whose whole fight (`efs`) every screen hears before any health word.
  A first draft sized them at their own wake instead, and the health word that fell then (`ehp` carries health alone)
  read on every screen as a blow: the lord flinched as it woke. Stood smaller, a lord's health only grows as members
  arrive, which no screen reads as a blow (pinned: no hurt mark on him).

Measured again:
- Three of four fallen at 60 s leave Grath at 17,773 of 25,200. The survivor's blow takes the 35 it took beside them,
  and he stands at 37% at 300 s, with fury from 270 s.
- Two of four on the plate stand him at 12,600 and fell him in 190 s (260 s before). A third reaching the hall at 40 s
  brings its 6,300 at 0.79, and the absent fourth's fall at 180 s moves nothing.

Not a DFU departure: Daggerfall has no Elite Breach. It rewrites this arc's own law (Elite-Gates.md sections 13.2 and
16.5), and Ledger A's ELITE-GATES row already names both files.

THE FOUR HOSTS: none touched. The change is the relay's law alone; `exterior.js`, `world.js`, `worldModes.js` and
`dungeonContext.js` are unchanged, and every screen draws the relay's word as before. The relay is at `world226`
(`test/net/relayversion.test.js`). No word on the wire changed, so either end may deploy first; the fix reaches a breach
when the relay deploys.

Pins: `test/net/eliteGates/fb1019e_lordshares.test.js` (4). Moved, each saying so:
- `egz_relay.test.js`'s EG-ZQ shares pin: its champion sleeps through it, so a fall before the wake lets its share go;
  the precondition is now asserted.
- `egaudit4_lords.test.js`'s held line: the share that moves mid-Examination is now one brought.
- The forty-three pins that name the relay's version.

Mutants: `tools/mutants/fb1019e_lordshares.json` (7, all dead). `egz_relay.json`'s EGZQ-shares-a-fall-kept and
EGZQ-shares-the-last-retired were re-aimed at the moved line, `egaudit4_legion.json`'s EGA4L-mingled-unread kept its
text, and `soc1.json`'s S38-version-not-bumped names world226; all 17 EGZQ-shares records and `egaudit4_lords.json`'s
6 held-line records are dead.

## What is left of report 1: the law's pace, said

With the lords stood for the company on their hall's plate and the fallen's shares kept, the bar still moves only as
fast as the company moves it. Each member's blow is its part of a lord sized for all of them: 180 s of reference for
every fighter, which the page's own model puts at 3:45 for the first Court at 80% uptime (section 18). That stands with
the house's other bosses rather than past them: the gate's Warden carries 240 s a fighter (`BOSS_TTK_S`), the Remnant
420 (`SD_TTK_S`, times its share factor), and the Serpent 150 (`SERPENT_TTK_S`).

This record changes no number. One company's word that a lord "felt like he wasnt being damaged" is not the field
measure section 18 asks for (EG21), and the fix removes both ways the law sized a lord for members who were not
striking him. What would settle the rest: the company's size and levels, the hall and its lord, how long the fight ran,
and whether every member stood in the hall from its wake.

## Found on the way, not fixed

- **The errands are sized for the company the hall woke with.** A lord's errands read `ctx.n`, the fight's `F.n`, its
  living company at the hall's wake (`egBrain.js` lordCtx), never the members still standing: a company that lost
  members mid-Court meets errands sized for its whole (the Cairn-Keeper's souls a gem, the Armsmaster's challengers).
  THE ERRAND FLOOR says an errand that needs *k* bodies needs `min(k, n)`; whether that *n* is the company standing
  when the errand is called is the law's to say. No report named it.
- **A refusal the screen never hears.** THE FAIR TRAIL's second break in a hall refuses a member's hits for 5 s
  (`egFair.js` egFairRefuses, EG_FAIR_REPEAT_MS), and the screen still pops each blow's number and flashes the body
  while the relay lands nothing. A fall into a Court's void is such a break (Grath's islands stand over one).
  TURNED-BLOW recorded the rest of the family (the purse's clip, a Shield-Wall, a flier out of a blade's reach): only
  the relay's word of what each blow landed would close it. Whether this company met it is not known.
- **A share's move reads as a hurt.** A beat says the health (`ehp`) before the whole fight (`egBrain.js` fightTail),
  and the health word carries no whole, so every screen marks a lord whose health fell as struck: 350 ms of its hurt
  frames and a companion's flash (`egLink.js` foldFight). Under EG-ZQ a lord flinched at every fall. Now the one share
  that leaves a lord after its hall's wake is a fall's while it sleeps in its ring, so a sleeping lord flinches when a
  member falls on the way to it. Saying the whole fight before the health in such a beat would end it; it touches every
  beat's word order, so it is left for its own change.
