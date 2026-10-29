# AUDIT FB1029B - FIELD BUGS 2026-10-29b read cold, 2026-10-29

The owner: *"Audit this"*, of `a0fef08bf` - the four fixes of `../bugs/Field-Bugs-2026-10-29b.md` (LADEN-REST,
KEYS-BLUR, HEARTH-SIBLING, FAMILY-REMOVE, BUILT-IN-MODS, BED-TURN). Four cold lanes read a frozen worktree of that
commit, each given the files and one brief (what to hunt, how to prove it), never a conclusion. Each finding was proven
on the real code - a probe, a test that fails at the commit, or quoted lines - before it was reported, and proven again
here before its fix. Fixes carry an `AUDIT FB1029B <id>` comment.

| Lane | Read | Found |
|---|---|---|
| S | the sea and the keys: the helm's rates under every load, handling and arm; every host's and window's release | 6 |
| H | the homes: the offering's law over every road a home takes; every room both packs lay, their pieces, floors and beds | 6 |
| F | the families: every death, birth, write and refusal around a removal; the menu; the 25 languages | 7 |
| T | the pins, 34 new mutants and the record: every claim measured again | 12 |

Thirty-one found, some twice (T1 the broad run's own; T12 is S2). Every defect is fixed or its record corrected; two
older gaps met are recorded below, not this change's.

## The sea and the keys (S)

**S1 (MEDIUM). Counter-rudder was slower than letting go.** A part-laden swing came off at the light rate let go, but
at the load's with the helm put against it - 5 to 11 times slower, the reporter's own reaction. Now through 0 at the
light rate, then the other way at the load's (`ladenRest.js` swingStep).

**S2 = T12 (MEDIUM). The word every round** for an empty Carrack under Classic (no hold, so mod 0 at any weight), over
other mid-screen text. Now only for a hull with a hold, while she is asked to move (deadWordDue).

**S3 (MEDIUM). The blur skipped every host's own release** - townTalk's, the mode machine's, an overlay's held set: the
automap kept moving with no key down. The blur now gives each held key its keyup at the document; the automap's held
set empties and its camera stands. Mouse buttons are left to their own mouseup.

**S4 (LOW-MEDIUM). A pad held across a blur stayed dead** until the stick was centred: its own held set kept the code.
The pad lets go of its own on blur, so it presses again.

**S5 (LOW). A slide came on at the light rate**: the way's rest read magnitudes alone. Now only along her own line.

**S6 = T3, T7 (MEDIUM). The pins ran Classic, under oars, with no rudder held.** Six mutants brought the bug back
unseen. Now pinned under Responsive and Classic, at the oars and under canvas, let go and against, part laden and dead,
the slide and the word; one vacuous test dropped. The runtime's flag (`resting`) became the step's own argument, so no
rate can read a stale one, and the rules moved to the leaf: the runtime grows 4 logical lines, not 8 (T8).

## The homes (H)

**H1 (MEDIUM). The room's structure was offered as furniture.** The 41000-43999 arm took the mods' beams and planks
and, in a player's own Detailed Ships cabin, the ship's rigging (a 9.4 m mast, 12.6 m beams); every mod room piece took
DET's pillars - its ceilings' rafters, 27% of what was added. Now a model Daggerfall lays as a prop in its own rooms (121,
measured, and measured again by `builtin_mods_alinor.test.js`) or a mod room piece that is not structure.

**H2 (LOW). A bench held a floor's edge over the void** (Beautiful Cities KOWLAL01 #3): taken out, a body walked off
the floor and fell 7 m. A piece with no floor under it stays the room's; that room now offers none such.

**H3 (LOW). The hidden cap's comment** said no interior lays more than 200 pieces; a Detailed Ships cabin lays 456.
Corrected, with the homes' measure (127 at most).

**H4 (LOW). Fill ignored the deed law** a set-out kept. Now asked the same.

**H5 (LOW). An heir taking a home up took the account's bowl down**: the town read the offering by the buyer. It stands
by the account's law now (STANDS_ON).

**H6 (RECORD). The bed figures** ("244 of the 247") did not reproduce. The turn is right by the room's shell: 2,806 of
4,029 coloured beds stood through the walls unturned, 141 turned, none made worse.

## The families (F)

**F1 (MEDIUM). A line could be removed while a fall was held for a Resurrect**; the raise stood her up on no line, and
a copy carrying the death killed her twice. A held fall now keeps its line.

**F2 (LOW). A copy made from a removed line founded it again**, a slot taken unseen. Refused `no-lineage`, and the
device never sends it again that session.

**F3 (LOW). A second Remove read a founding's words** ("Save once, then try again") and kept its row. A line already
gone is said removed.

**F4 (LOW). A birth landed on a line removed mid-birth.** The insert now asks the line.

**F5 (LOW). A failed roster read listed every line as spare.** No card without the realm's answer.

**F6, F7 (LOW).** A doc comment out of place; a Turkish word. And the confirm now says no heir can carry the line on (25
languages).

## The pins and the record (T)

**T1 (HIGH).** The commit turned AUDIT 64 F17's source pin red (`test/world/audit64_layout.test.js`); moved. **T2.** A
container assertion tested a model that is no container; a chest and a shelf written as scenery are pinned built in and
never containers. **T4.** The families card was two regexes; its model is lifted into `waitingHouses.js` (spareFamilies,
withoutLine) and pinned. **T5, T11.** Two offering and two family survivors, pinned. **T6.** The host wiring pins match the
call at the top of the scope. **T9.** The ledger row names its hosts, pins and mutants. **T10.** "Below 0 she crawls"
(the mod is never below 0), struck.

Mutants: `tools/mutants/audit_fb1029b.json` (22, one equivalent), and the lists of the record grown: laden_rest 22 (one
equivalent), keys_blur 9, family_remove 14, hearth_sibling 7, builtin_mods 13. Re-aimed by content: `csa_sailing.json`,
`witch1.json`, `fb1014_innbeds.json`, `hostsplit.json`, `int_lane4.json`, `legacy7.json`, `realm1.json`,
`navaudit_helm.json`.

## Met, not this change's

The broad run's FB1002 CRACK-LIP and FB1009 HOME-FOOT, and WD1's and IT1's patch hashes (all on this session's
freeware download of ARENA2), fail the same on `5995d0bb9`. The record
`navaudit_helm.json` NAV1H-the-brake-unwired-world survives its own test there too.
