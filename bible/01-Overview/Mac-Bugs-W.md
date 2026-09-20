# MAC-BUGS W (2026-09-20) — three from the field

Mac, three reports in one message:

1. a screenshot of the temple's cure-disease box: *"curing disease in
   temple gives this %cpn thing"* — `"%cpn prides itself on having the
   lowest prices in . …"`
2. *"got locked inside a windmill when i went inside. not sure if it's
   all of them that do that"*
3. *"repairing items doesn't work. he just takes your gold and doesn't
   actually repair anything (for armor, and when online, at least)"*

Three unrelated systems, and **the same shape three times**: a law that
works everywhere it was written for, asked one question outside that
range, answering something that is not an error.

---

## W1 — `%cpn`: the table was filled for the symbols someone expected

**What the player saw.** A temple asking for 284 gold to cure a disease,
naming itself `%cpn` and standing in a town called `` (nothing).

**Why.** `cureDiseaseOffer` answers `TRADE_MESSAGE_BASE_ID + offset` —
the cure haggle speaks a **trade record**, and those quote the shop and
the town back at the player (`%cpn` is `MacroHelper.cs:69`'s ShopName;
`%cn` the city). `buildCureDiseaseFlow`'s context passed neither, so
`expandGuildMacros` left `%cpn` verbatim (its null rule) and `%cn`
collapsed to the empty string (its `''` default) — *"in ."*

**The fix is U39's own argument, one table row further along.** U39 put
`%ra` and `%hnr` on the shared `identity` helper precisely because *"DFU
expands the WHOLE MacroHelper table over each record"* — a window that
fills only the symbols it expects leaves the rest raw. `%cpn` and `%cn`
belong there for the same reason, so they ride `identity` beside the
first two and all three service flows (training, donation, cure) take
them from the host. The next record to quote a symbol nobody expected is
answered by the table, not by a third fix at a call site.

A missing name still leaves the token **loud** rather than blank. That
is `expandGuildMacros`'s null rule, and it is why this was reportable at
all: the empty `%cn` printed *"in ."* and said nothing, while the raw
`%cpn` was the thing Mac could see and name.

---

## W2 — the windmill: an interior's exit is a *model*

**It is all of them.** All seven mills share one interior.

**Why.** A building's way out is not a record in its own data — it is a
**static door baked into one of the interior's placed models**
(`getStaticDoors`). Every classic interior has one, so nothing in the
port had ever needed to ask whether an interior *has* one. The hosts
turn `interiorCtx.doors` into the only activation targets an interior
offers, and **an empty array is a perfectly good array**: no error, no
warning, no way out.

WM2g attached Kamer's vendored mill interior to each farm block, and the
way *in* is a **classic model (118)** — the structure standing beside
the mill, which `windmillMesh.js`'s placements say in as many words.
Nothing in the mill's own interior carries a door, so the door that let
you in had no twin on the inside.

**The exit goes where the player lands.** `interiorLanding` already
falls back to the **enter marker** when it finds no door, so the mill
was already dropping the player at its own 199.8 marker and then giving
them nothing to walk back out of. That marker is the threshold the
interior itself claims — the same point named twice — so this is not a
guess about geometry.

A **last resort, not a policy**: an interior that produced even one real
door is untouched, so no classic building's door set moves by a byte;
and an interior with neither a door nor a marker gets nothing, because
there is nowhere honest to put one.

---

## W3 — repairs online: a deadline that nobody shifted

**Verified; this is the "when online" half.**

`alignEntityClocks` (WORLD5 C3) rebases every marker a save carries when
the player arrives in a shared world — *"a room rented with twenty hours
left keeps twenty hours, a loan due in a week is due in a week."* It
shifts the skill clocks, the letters, active effects, vampirism, bank
loans, rented rooms, and items' `timeForItemToDisappear`.

**A repair job is exactly that shape and was not in the list.**
`item.repairData.timeStarted` is stamped from `worldMinutes()` at the
counter and read back against `worldMinutes()` later — the same shape as
a loan's due date. Going online left it dated by the save's own clock,
and a world reading *behind* the save never reaches the due time: the
smith keeps the item for ever. A player pays gold and gets nothing back.

**And the collection mattered as much as the field.** An in-repair item
lives in `entity.otherItems` (DFU's `PlayerEntity.OtherItems`), not in
`items` — so that walk had never so much as looked at one. The wagon was
the same oversight for the disappear clock it already carried. All three
collections, one walk.

A zero `timeStarted` stays zero: the port's absent `repairData` **is**
DFU's `timeStarted = 0` sentinel (`repairService.js` says so), so a zero
means "not in repair" and must not be shifted into a date.

### What is NOT fixed, said plainly

**The "for armor" half is not reproduced.** The repair engine was driven
end to end against a real damaged cuirass — the refusal gate, the cost,
the queue-stretched time, the booking, and the condition restored on
collection — and armour behaves exactly as a weapon does. Both host
paths (the native `REPR01I0` window and the keyed fallback) were read
against DFU and agree. If armour is still not coming back repaired
offline, it is something these three fixes do not touch and it needs the
failing case.

**One residual, named:** the multiplayer wire carries a hit's `kind`,
not its weapon, which is a separate unfixed thing recorded under
FIELD-GUN14 — unrelated to this, listed so the two are not confused.

---

## The lesson

Three systems, one fault: **a default is not an error.** A macro table
that leaves an unknown symbol alone, a door list that comes back empty,
a clock-alignment walk that visits the collections it knows about —
every one of them did something reasonable, silently, and a player paid
for it. The pins added here all assert the *presence* of the thing that
was missing, because none of the three could have been caught by
asserting that nothing threw.

**Campaign** `tools/mutants/macbugs-20260920.json`: 9 mutants, 9 dead.
