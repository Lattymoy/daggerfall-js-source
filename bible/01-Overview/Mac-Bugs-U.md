# MAC-U - three play reports, two roots, 2026-09-18

Mac, with screenshots:

> now some work (only this guy actually now that I ran around talking to
> some more people in taverns), though the portrait doesn't match the
> overworld sprite
>
> none of the attribute explanations show actual values
>
> talking to anyone indoors shows the error, outdoors looks normal

The first and third are **one bug**. The second is its own.

## PORTRAIT1 - one key missing from a hand-written object

The "error" in the third report is not an error message. It is
Daggerfall's own debug face - record 410, the one whose caption reads
"OOPS! Tell Mack NOW" - and the port uses it exactly as the reference
does: as the value the portrait law *starts* at, before anything better
resolves. Seeing it means nothing better ever resolved.

The law itself (`systems/npcSession.js`) is a faithful translation and
was never wrong. It tries the faction's flat in FLATS.CFG for a face
index, then the NPC's OWN billboard, which overwrites it because it is
"more specific than just the factiondata - which will always resolve to
the same portrait for a specific faction". That second lookup is the one
that makes a portrait match the person standing there.

**Both lookups were dead, because the hosts never handed the lookup
over.** `world.js` and `exterior.js` build the bag they give the mode
machine as a hand-written list of keys, and `flatFaceIndex` was not on
it. `worldModes`' `staticNpcPortrait` reads it with `?.`, so nothing
threw: the call answered `undefined`, both arms collapsed to -1, and
record 410 - a last resort - became the only outcome for every static
NPC in the game.

**And that is the first report too.** An INDIVIDUAL faction returns
*before* the lookups, from its own `face` column. That arm still worked,
so the one NPC whose portrait appeared was a named individual wearing
that faction's canonical face - which has no relationship to the sprite
in the street. A real face, the wrong person. "Outdoors looks normal"
only because wandering mobiles take a different law entirely
(`personFaceRecordId`); exterior *static* NPCs were just as broken and
easy to miss among the walkers.

FLATS.CFG was loaded and warm the whole time. The captions read it
correctly, because they close over the host's own `pipeline` variable
and never went through the bag at all - which is what made the stale
comment on the portrait seam ("loaded for the captions already") read
like a reason rather than a coincidence. That comment is corrected.

**THE SECOND TIME THIS LIST HAS COST A KEY.** The note above it already
recorded the first: `uploadRecordFrame` was left out, arrived as
`undefined` and threw `is not a function` on the first enemy frame in a
dungeon entered from that host, "while the standalone `?dungeon` scene
(which spreads the whole pipeline) was fine". The reading was right and
the lesson was not taken - the list stayed a list. So the fix is not the
key, it is the list: **both hosts spread the pipeline now**, as
`dungeon.js` always has.

And the pin that existed for exactly this class - written *after* the
first incident - had a hole: it checked the keys `worldModes`
DESTRUCTURES and `flatFaceIndex` is taken as a MEMBER read. It now
checks both, and understands the spread.

## ATTRMACRO1 - a macro pass that was never made, and a source that never existed

Clicking an attribute pops its TEXT.RSC record. The window read the
record and mounted it, and that was all: no macro pass, so `%str`,
`%ark`, `%dam` and `%enc` reached the screen as literal tokens. The
reference's line is `SetTextTokens(tag, playerEntity.Stats)` - a record
**and a macro source** - and the port's own comment beside the call has
said so since AUDIT 58 while the code did neither.

Three defects, not one:

1. **No pass.** Fixed at the one call site, and deliberately not inside
   the shared `rows` hook, which the journal, the item text, the health
   box and the skills dialog all read through.
2. **No source.** `%str..%luc` and `%ark` were wired to `call(mcp, ...)`
   with nothing on the other end - the bible's own unported list names
   `DaggerfallStatsMCP`. It exists now, and it is **stateful by design**:
   `AttributeRating()` takes no argument and reads the last stat macro
   evaluated in the same expansion, which is why every record says
   "%str ... %ark" in that order. The eighty rating words are the
   reference's own table, not TEXT.RSC, which is why nothing in ARENA2
   supplies them and they are written down in the port.
3. **`%dam` and its three siblings were wrong even when they resolved.**
   The reference declares DamageModifier, ToHitModifier,
   HitPointsModifier and HealingRateModifier as properties computed over
   the LIVE stat. The port read them as fields on the entity, and
   **nothing in the tree has ever assigned those fields** - so they
   answered 0 for every player, always, with the signed format dressing
   the nothing up as a real modifier. A pin was holding that in place
   with a fixture that carried them as fields; it is corrected.

## The campaign

`test/nativetalk.test.js` (the portrait law over a real in-memory
FLATS.CFG, and that an unwired host silently yields the debug face),
`test/hostdeps.test.js` (the bag contract, now member reads and the
spread), `test/macrocoverage.test.js` (the box driven through the real
character sheet; the rating word per attribute; the thresholds by
behaviour). `tools/mutants/portrait1.json` 6 dead,
`tools/mutants/attrmacro1.json` 9 dead.

## Not seen on a GPU

Nobody has clicked an NPC or an attribute in a browser. The portrait law
is driven over a parsed FLATS.CFG built in memory; the box is driven
through the real sheet. Worth a pass: talk to someone indoors, talk to a
static NPC in the street, and click all eight attributes.
