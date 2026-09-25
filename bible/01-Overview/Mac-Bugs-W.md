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

---

## W4 — "Also blood is black": the mark took ambient and nothing else

Mac, same day: *"Also blood is black."*

**FOUND.** It is not `TEXTURE.380` and it is not the splash — it is
**BLOOD1's decals**, which landed on `main` while this branch was
elsewhere and which this report arrived on top of.

What follows is the elimination first, because that is what found it:
`tools/bloodProbe.mjs` (`npm run blood`) drives the port's own
`createHitEffects` pool and `drawBillboards` over a texture whose
colour is known, in a real WebGL2 context.

| frame | pixel |
|---|---|
| clockless (full bright) | `168,16,16` — exactly the texel |
| exterior noon | `176,16,16` |
| dungeon ambient, no lights | `20,2,2` |
| dungeon ambient **+ a torch on it** | `187,18,18` |
| **a plain sprite in the same dungeon light** | `20,2,2` |

So, ruled out:

- **the pool** — it uploads, and the batch reaches the draw;
- **the key** — `380_0#0` is uploaded and `380_0#0` is what the
  billboard pass asks for (the two are minted in different files and
  this is the first thing that checks they agree);
- **the shader's emission arm** — a non-emissive record gets the black
  emission texture and draws at `albedo × tint`, which the first two
  rows show is its own colour;
- **anything specific to blood.** The last row is the one that matters:
  a sprite standing in the same light comes back **the same 20,2,2**.
  A blood splash is exactly as dark as everything else beside it.

### ...and then main brought BLOOD1

The merge that took this branch to `main` brought **BLOOD1 — "the
port's own blood, gore and bleeding"** — a whole decal system the probe
above knew nothing about. Pointed at *that* pass, it answers in one
run.

`bloodMarks.draw` sends **one blow through two passes**: the marks go
through `renderer.drawDecals`, the gibs through `drawBillboards`. And
the decal pass was lit by **ambient and nothing else**:

```js
// The scene's own light, so a mark on a dungeon floor is as dark as
// the floor. Clockless scenes keep full bright, as the flats do.
if (this._clockLit) gl.uniform3fv(d.tint, this._c3(this._ambient, this._decA));
```

The comment says exactly what it is for, and it is the one thing it
does not do. A floor is a **mesh**, lit by ambient *and* the sun *and*
the point lights. A dungeon's ambient is `0.12`. A red mark came out at
about two units of red — **black** — while the chunks from the same
kill landed on top of it in full light.

Measured, before and after:

| | before | after | a sprite beside it |
|---|---|---|---|
| dark dungeon | `20,2,2` | `20,2,2` | `20,2,2` |
| **a torch standing on it** | `20,2,2` | `187,18,18` | `187,18,18` |
| **exterior noon** | `92,9,9` | `176,16,16` | `176,16,16` |

The first row is why it was never caught: with no light at all the two
passes agree, and the fault appears *the moment there is anything to
see by* — torchlight on a dungeon floor, or daylight. Exactly where a
player is looking.

**The fix is the flats' own light, term for term.** A decal has no
normal, precisely as a billboard has none, so it takes the billboard
model: the ambient-plus-moon-half tint, the sun's Lambert-average half,
attenuation-only point lights on a squared linear falloff, and the
indirect term on the same attenuation. Written to mirror that shader
line for line so the two cannot drift — and the pin compares the two
loops against each other rather than quoting either.

It also honours a lesson that pass had to learn the hard way: **three
colours, three scratches**. `AUDIT PERF-SUN/FOG F4` found the billboard
tint computing its *moon* term from the *sun's* colour because both
decodes shared one scratch array. The new upload takes `_decA`, `_decB`
and `_decC`, and a mutant holds it there.

### One limit, named rather than left to be found

The decal pass is now a **fifth classic program**, and it has **no
Enhanced Lighting twin**. The lane replaces the other four (mesh,
billboard, terrain, character) with 48-light versions; a decal keeps
the classic sixteen.

That had teeth, not just tidiness: `_pointLights` really does hold 48
under the lane, and a shader declaring `uPointLights[16]` handed a
count of 48 reads off the end of its own array. The count is clamped to
`CLASSIC_MAX_LIGHTS`, and the two pins that count classic programs
(`EL1`, `LT1`) say **five** now, with the reason.

What it costs, stated: the sixteen a decal gets are the sixteen
**nearest**, because `nearestLights` sorted them before any of this —
the same sixteen the whole renderer had before the lane existed. A mark
under the seventeenth lantern in a forty-eight-light hall is lit by the
sixteen closer ones. The alternative is a fifth lane shader with its
own exposure, in-scatter and encode, which is a slice rather than a bug
fix.

**W6 (same day) paid that slice, and the limit was the small half of
it** — see below: under the lane the classic decal was not merely short
of lanterns, it was handed *linear* light and drew it raw.

Campaign `tools/mutants/macbugw4.json`: 6 mutants, 6 dead.

The probe stays, and it earned its keep: it ruled out four suspects in
one run and then named the fifth the moment there was a fifth to name.

---

## W5: blood doesn't work outside

Mac, 2026-09-20: *"Also blood doesn't work outside"*

### What it was

`bloodMarks.spray` casts a ray straight down from each drop and puts a
decal where it lands. That ray was `collider.raycastHit`, and
**`raycastHit` walks the triangle buckets and nothing else** — meshes
registered with `addMesh`.

Indoors and underground that is the entire world: a floor is a mesh.
Outside it is not.

| host | collider | where the ground is |
|---|---|---|
| `dungeonContext.js:303` | `new Collider(() => -Infinity)` | floor meshes |
| `interiorContext.js:322` | `new Collider(() => -Infinity)` | floor meshes |
| `exterior.js:564` | `new Collider(() => GROUND_OFFSET * 0.025)` | **`heightAt`** |
| `world.js:1351` | `new Collider(heightAt)` | **`heightAt`** |

`heightAt` is applied to the **capsule**, in `_resolveSphere`, and
nowhere else. So every drop cast down outdoors met nothing — and
*nothing is not an error*: `continue` is the correct answer for
spatter thrown off a walkway, so the pool under the body took the same
silent arm. No blood has marked the ground outside since BLOOD1a
shipped.

The same ray runs the gibs and the drips, so a chunk outdoors fell for
ever — `gibFly` reads a miss as "still in the air", which is right for
a thing thrown off a ledge.

This is the month's fault class again, worn one more way: *a law
written over DFU's own range, asked about the outdoors, answering its
default.*

### The fix

`Collider.surfaceHit` — **a second door, not a change to the first**.
Every caller that wants a wall, a ceiling, a head-bump or a line of
sight wants exactly the buckets, which is why `raycastHit` is
untouched. `surfaceHit` is that ray plus the `heightAt` floor, **nearer
wins**, and the floor is only ever met on the way *down*: a walkway
over a valley still catches what lands on it, the valley still catches
what misses the walkway, and a ray cast up from below the ground finds
no surface overhead.

The ground's normal is its own **slope**, by central difference on the
sampler, because a hillside is a surface and a quad laid flat on a
hill stands in it. A sampler with no slope answers straight up by
construction, so the flat case costs four lookups and nothing else.

### What the pins were saying

Every blood-mark stub in `blood1_decals.test.js` answers a floor for
any downward ray, and one of them calls itself *"an outdoor fight"*.
That stub is the **indoor** collider wearing an outdoor name — which
is why forty pins were green while the feature did not exist outside.

The stubs are kept (the ladder is what those arms are about) and the
new pins drive a **real `Collider`**, built the way the two outdoor
hosts build theirs, because that is the one thing a stub cannot
misrepresent. One of them reproduces the bug directly: the same
ladder, on a collider whose `surfaceHit` is the bare bucket ray, marks
nothing.

### Not changed, but noticed

`droppedTorches.js:247` casts the same bucket ray to find what a
thrown torch hit, with a `raycast` fallback that has the same blind
spot outdoors. It is not what was reported and it is not blood, so it
is left alone and written down here instead.

Campaign `tools/mutants/macbugw5.json`: 13 mutants, 12 dead, 1
equivalent as recorded.


---

## W6 — "super dark coloring instead of red": the decal under the lane

Mac, 2026-09-20, pushing for a real audit of the blood system: *"I
noticed inconsistencies with blood with the exterior and super dark
coloring instead of red."*

### What it was

**The port ships with the Enhanced Lighting lane ON** (`features.js`,
`enhanced-lighting`, `initial: true`). Under the lane the renderer
**decodes every colour it uploads** to linear — the ambient, the sun,
the moon, the lanterns, the indirect (`_c3`, `_pointColorData`) —
because the lane's five shaders light in linear space and encode back
to sRGB at the end (`elFinish`: exposure, tonemap, fog in linear,
in-scatter, encode, dither).

The decal pass was, as W4 pinned it, *"a fifth classic program with no
lane twin."* So under the lane it took those linear values as display
ones, multiplied an **undecoded** texel by them, and wrote the product
straight to the canvas — no exposure, no tonemap, no encode. A
dungeon's `0.12` ambient decodes to `0.013`, and `0.013` written raw is
three units of red.

W4's probe read the classic set and was green the whole time. Read
again with the lane installed, a sprite and a mark side by side in the
same light:

| state | sprite | mark (before) | mark (after) |
|---|---|---|---|
| noon | `137,13,12` | `128,12,11` | `137,13,12` |
| dusk | `69,1,1` | **`25,1,1`** | `69,1,1` |
| dungeon + a torch on it | `186,27,27` | `169,16,16` | `186,27,27` |
| dungeon, no lights | `17,0,0` | **`2,0,0`** | `17,0,0` |

Every mark the port has drawn under its default lighting has been
darker than the blood it came from — a little at noon, three times at
dusk, eight times in the dark. "Super dark instead of red."

### The fix

**A lane twin: `EL_DECAL_FS`** in `render/enhancedLighting.js`, the
classic `DECAL_FS`'s every term on the lane's pipeline — the water
surface's precedent (EL7) for a program the lane did not replace. It is
the **flat's model, term for term with `EL_BB_FS`**: the texel and the
decal's tint decode together (as the rig's vertex colour does), the
sun's Lambert-average half under the cloud's shadow and the sun map,
`elPointFlat` and `elIndirectFlat`, then `elFinish`. Forty-eight
lanterns, as the flats have.

The one thing a mark has that a flat does not is a **surface**. A flat
reads its shadows half a unit *up* from its base so the sprite cannot
shadow itself; a mark on a ceiling read that way reads inside the
rock. The mark's normal is derived from its own quad (a planar quad's
screen derivatives are exact), turned to face the eye, and the shadow
is read half a unit out *along it* — a floor's mark reads up, a
ceiling's down, a wall's into the room.

**The renderer builds the decal as the set's fifth program** — the
classic one at boot, the lane's on install, kept across swaps like the
other four — instead of lazily on the first batch. `drawDecals` cuts
its lanterns to the installed set's cap (`maxPointLights`), uploads
the cloud shadow pair and the lane's own uniforms (`_uploadEl('decal')`
— the exposure, the in-scatter, the shadow maps, the eye) by the same
tables the other four use. The classic program is untouched: no lane
uniform in it, sixteen lights, and the classic rows of the probe read
what they always read.

### What the pins were saying

W4's parity pin held the decal to the *classic* billboard shader, and
the probe read the *classic* set. Both were true and neither was the
shipped default. The probe reads both sets now, and the lane rows hold
the mark to the sprite beside it at every state, to the unit.

Campaign `tools/mutants/macbugw6.json`: 9 mutants, 9 dead — the twin
missing from the lane, an undecoded texel, no finish, the classic
sixteen declared under forty-eight, the lane uniforms never uploaded,
the cut to the classic cap, the cloud shadow never reaching the mark,
the set failing to install the program, and the ceiling's mark reading
its shadow inside the rock.

---

# MAC-BUGS X (2026-09-20) — three from Discord

Mac, three screenshots: rabid.rivas *"Crash when exiting..."*, kurkku
*"A finely drawn vellum reveals the secret location of %map, which you
record."*, kurkku *"same kind of thing"* — *"Ah, %pcn, your reputation
precedes you. %fon always has room for a skillful knight of high moral
standing."*

## X1 — MENU-EXIT1: a repaint after the action that tore the screen down

**What the player saw.** `TypeError: can't access property "innerHTML",
j is null` in the enhanced menu, on the way out of a game.

**Why.** The confirm card's yes runs the confirmed action and then
repaints: `f(); render();`. For "Leave this game" the action is
`onAction('exit')`, which unwinds to the front door and destroys the
menu synchronously — `destroy()` nulls `app` — and `renderInto` began
with `app.innerHTML = ''`. Every exit through the confirm crashed at
the last line of the handler.

**Fix.** `render()` answers nothing for a screen that is gone (`if
(!app) return`). The handler order stands — the action first, as DFU's
yes-button — because the guard belongs at the one entry every handler
repaints through, not in each handler. Pinned by source in
`test/fieldbugs_x.test.js`; the mutant (guard removed) dies.

## X2 — MACROS1 `%map`: the record was shown, the context was not

**What the player saw.** Record 499 verbatim after reading a map.

**Why.** `useItem`'s map arm answers `{ textId: 499, revealed }` and
the three consumers of a textId (the enhanced inventory, the native
inventory, the quick slots) hand `lines(499)` straight to the box. DFU's
box runs MacroHelper with `PlayerGPS.LocationRevealedByMapItem`. The
quest macro table's own `%map` read a world hook
(`locationRevealedByMapItem`) that no host ever provided, so a quest
message with `%map` printed `%map[nullMCP]` as well.

**Fix.** The outcome carries `macros: { map: revealed }`, every textId
consumer expands its rows with the outcome's macros
(`questMacros.expandRowValues` — a row keeps its shape and its
`center`), and the map reveal sets the field the world hook answers.

## X3 — MACROS1 `%pcn`/`%fon`: the guild window's rows were verbatim

**What the player saw.** The knightly order's invitation with the
player's name and the order's name as tokens.

**Why.** The join flow's `rows` was `townTalk.lines(id)` — TEXT.RSC
rows, no context — while DFU's `GuildServicePopupWindow` hands *itself*
to MacroHelper for every box it shows (`%fon`/`%kno` are the guild's
`FactionOrderName`, `%pcn` the player). MAC-BUGS W1's lesson one symbol
on: MH1's `expandGuildMacros` was filled for the symbols somebody
expected, and `%fon` was not among them.

**Fix.** `expandGuildMacros` takes `factionName` (→ `%fon`, `%kno`);
`expandGuildRows` maps a record through it; the join flow's rows go
through it with the player's name and the guild's FACTION.TXT name.
One walk, as MH1 meant. Two other verbatim `rows` sites stand
(the witches' coven window, the repair list) — no report names them
and their records were not read for macros here; they are the next
place this class will be found.

**Pins.** `test/fieldbugs_x.test.js` (4). Mutants
(`tools/mutants/fieldbugs_x.json`): the guard removed, the map's macro
dropped, the inventory dropping it, the row shape lost, the world hook
unanswered, `%fon` dropped, the join rows verbatim again — 7, all dead.
