# Audit log

<!-- HARD5, 2026-09-15: MOVED HERE FROM `Home.md`, BYTE FOR BYTE - 82 KB
     in 1,386 lines. Nothing below was re-worded in the move. The audits
     that have their own pages (`Audit-26.md`, `Audit-UI.md`, ...) are
     listed in `Active-Arcs.md`; what lives here is the running log of
     the ones that do not. -->

Newest first.

**2026-09-18 - AUDIT-MAP2: THE HELD MAP, THE LAST AUDIT BEFORE MERGE
(MAP1-MAP3).** Mac: *"Before we merge, let's do one last audit on the
new maps."* Three reviewer lenses (the rig's side of MAP3, the window's
side of MAP3, fresh eyes on MAP1/MAP2) and a hands-lane layer in the
browser probe on the real fixture rig. Thirty-two findings, twenty-five
fixed. The browser found the first two: the root's lane class was the
thumbs canvas's `pointer-events: none` class (every click in the hands
lane went to the arm underneath), and the sheet sat past the arm's far
plane (ink over the sky, no parchment). The rig reviewer found the
quaternions packed `[x,y,z,w]` against the rig's `[w,x,y,z]` - a
forty-degree bend arriving as a hundred-and-forty-degree turn about the
wrong axis, invisible to pins that tested the module against itself;
the bone names in the family retail's clips never key; the coplanar
second winding; the sheet anchored to a moving eye once; stale corners
after the arm stopped drawing. The window reviewer found the one-way
lane latch, the `''` sentinel collision, the repack per resize, the
pointer unclamped to the sheet over a full-viewport stage, the pinch in
screen pixels, the foot without a scrim over the world. The fresh eyes
found a free teleport for a poor mage on Y, Escape bypassing the fee's
close, the guild's teleport map offering a fast-travel panel that
committed into no hook, the far band turning a click on a hidden hamlet
into a nameless walk, and the static layer freed and re-zeroed on every
pan frame. Record: `10-UI/Held-Map-Arc.md`, AUDIT-MAP2.

**2026-09-18 - AUDIT-MAP: THE HELD MAP, THE AUDIT OF MAP0-MAP2.** Mac:
*"Let's audit everything so far, wanna make sure this is perfect."*
Three reviewer lenses (the ink's geometry and cost on the real bay; the
window against the host and a real browser; the mod's laws against the
classic window and the C#), a browser probe written for the sheet
(`tools/heldMapProbe.mjs`, 37 checks, screenshots), and the screenshots
read. Twenty-two fixed: the data's edge drawn as a shore and the corner
cut chamfering straight runs (the screenshot's own), the pulse
repainting the whole bay's ink per frame (a kept static layer now), the
zoom drifting at the ceiling, the recursive simplifier, per-point chain
culling, the harbour glyph's stray line, gaps at three-province points,
the glide breaking the clamp, the Close button dropping the toggles, no
pinch on touch, online billing inn nights, a box holding only the stage,
the fee's No leaving the map up, the walked trip handing DFU's minutes to
the ETA, the mod's fare scaling never billed on the enhanced skin (one
pure export now, both skins), the info box's click reaching the button
under it, the junction disc reading the mark off the wrong window, and
the small ones (wheel modes, fonts, onload order, fade-from-current).
Five departures recorded. `test/heldmap.test.js` +20 (67),
`tools/mutants/auditmap.json` 26 dead. `10-UI/Held-Map-Arc.md`,
AUDIT-MAP.

**2026-09-18 - AUDIT-TO1: TRAVEL OPTIONS, THE AUDIT OF THE PORT.** Mac:
*"Please do a comprehensive audit on this."* Fourteen finders over the
mod's eight C# files against the port, three adversarial verifiers a
finding, and four exact table diffs by hand (417/417 port ids, 44/44
strings, 51/51 settings, the autopilot method by method - all clean).
THE HEADLINE: the slice's headline feature never ran. The host handed
the mod `isPlayerOnHUD` as the exact complement of the `gamePaused`
beside it, so every accelerated journey interrupted itself on its
first unpaused frame - and 41 pins were green because every one of them
supplied the flag by hand. Three of the mod's eight classes had not
been read (part 1, `68910ff`); the default skin could not start a
journey at all; the ship restriction was inverted; the strip drew as a
white bar; the junction map was invisible in the two moments it exists
for; the follow key shipped on SocialInteract's F; the location rects
came off a method MapsFile never had. Twenty-odd defects, each with a
two-way pin and a mutant (55 pins, 113 mutants); departures 6/8/9
corrected, 10-14 added; the mutant list's one "equivalent" was a live
survivor. The lesson for the next 1:1 slice, stated once: A PIN THAT
HANDS THE HOST'S FLAGS IN BY HAND PINS NOTHING ABOUT THE HOST - drive
the leaf with the host's own expressions, and read every file the
mod's manifest names. `06-Systems/Travel-Options.md`, AUDIT-TO1.

**2026-09-15 - MENU1: THE ENHANCED MENUS THAT SOMETIMES DO NOT OPEN.**
Mac, relaying a player: *"sometimes you're unable to open the enhanced
menus. For example a player might open the radial and select the
spellbook, but it will fail to open."*

THE ROOT CAUSE IS THE DEPLOY, AND IT IS NOT IN THE GAME CODE AT ALL.
Every enhanced menu builds to its own content-hashed LAZY CHUNK -
`enhancedSpellbook`, `enhancedMenu`, `enhancedInventory`,
`enhancedChronicle`, `enhancedTalk`, `enhancedBook` - reached by a
dynamic `import()` the first time a player opens that door. The site
publishes through GitHub Pages, which REPLACES the whole tree, so the
files a build replaces are gone. Measured against the live site rather
than assumed: the previous build's `assets/main-EDqp0hIk.js` answered
404 within the hour, while `assets/enhancedSpellbook-B4Vx_SNE.js` -
whose content had not changed between the two builds and so kept its
hash - answered 200.

That last detail is the whole "random". A tab left open across a deploy
keeps running the entry bundle it already has and asks for old chunk
URLs; the ones that 404 are exactly the menus THAT deploy touched. The
dial itself is in the main bundle, so the rose still opens - and the
door behind it does not. Hence a report that reads like caprice:
sometimes, some menus, no pattern a player could see.

WHAT MADE IT UNREPORTABLE was the doors' answer, and that IS ours. Six
of the seven caught the rejection, wrote `console.warn` and called
`close()`; `charSheetDoor.js` had no catch at all and left an unhandled
rejection. Either way the player got nothing - no box, no line, no
sound - from a failure they did not cause and could not diagnose, in a
game where every other refusal speaks ("(the spellbook art is
unavailable)", "(the travel map art is unavailable)"). A door that
declines in silence is indistinguishable from a press that never
landed, which is precisely how this arrived: "it will fail to open".

THE FIX IS ONE HOME, `ui/enhancedChunk.js`, and all seven doors go
through it: retry once (a transient fetch costs one round trip to rule
out), then SPEAK in the door's own host element with inline style only
- the error path must not depend on anything that could be the thing
that broke - and STAY OPEN behind the notice, so the game does not hand
the keys back to a player who thinks they missed. The Reload button is
offered for a chunk that would not fetch and withheld for a module that
threw, because a reload fixes the first and reproduces the second; and
it is offered, never taken, because unsaved progress is the player's to
spend.

U51'S LAW SURVIVED THE REWRITE AND SHARPENED IT. Its pin read back one
door's `.catch((e) => { ... host.remove() }` - the implementation - but
its own message stated the rule: "a failed load must take its empty div
with it, or the host holds an overlay that never reports done - a
frozen game." Staying open satisfies that only while there IS a way
out, so the one home falls back to exactly the old answer when the
notice cannot paint. Without that fallback this fix would have traded a
silent refusal for a wedged game, which is the worse of the two. The
pin is re-aimed at the one home and so covers all seven doors instead
of one.

STILL OPEN, and it is Mac's call because it is infrastructure rather
than code: this can be ELIMINATED instead of reported, by letting a
deploy keep the previous build's `assets/` alongside the new one. The
workflow assembles `site/` from `dist/` and Pages replaces the tree, so
layering the new build over the live one would leave stale tabs able to
fetch the chunks they still believe in. The port cannot decide that
from here.

`test/menu1_enhanced_chunk.test.js` (9), driven against the one home
with an injected failing loader - no browser and no game data needed.
Three mutants, three killed: close silently again, drop the retry, let
one door fetch its own chunk.


**2026-09-15 - GUARD1: THE WATCH THAT VANISHED (a player report, relayed
by Mac).** *"After a while of chasing me around the villages they
disappeared. And then i was free to go on a killing spree."*

THE DEFECT WAS A DROPPED CLAUSE, AND ITS DAMAGE CAME FROM A LAW THE
PORT GOT RIGHT. `EnemyEntity.Update` (:184-191) despawns the city watch
on FOUR terms - EnemyClass, Knight_CityWatch, `CrimeCommitted == None`,
and `!PlayerEffectManager.IsTransformedLycanthrope()` -
and `scenes/cityGuards.js` carried three. On its own a missing fourth
clause looks harmless. It is not, because this port also carries
`LycanthropyEffect.SuppressCrime` (:121-124): `court.js`'s one setter
resolves EVERY crime write to None while the player is transformed. The
two compose into a trap. A transformed lycanthrope can never hold a
crime, so the three-clause test was true on every frame, so the entire
watch was deleted the moment the player shapechanged - and no later
crime could summon another, because the pool a crime would fill is the
one being emptied. A werewolf in this port was simply immune to the
city watch: the guards evaporated and a whole village could be murdered
unopposed. DFU's fourth clause exists to hold the watch standing
through exactly that window, and it is back.

THE LESSON IS ABOUT COMPOSITION, not about werewolves. Both halves were
ported carefully and separately, each with its own citation, and the
bug lives only in the gap between them. `SuppressCrime` was read as "a
transformed player commits no crime"; the despawn was read as "no
crime, no watch". Neither reader had cause to look at the other, and
the reference's own answer to the composition - the fourth clause - was
the one line that carried no behaviour of its own to test.

FOUND ON THE WAY, at the same seam: `crimeCommitted` had TWO
representations. Every writer in the port sets the numeric `CRIMES` id
except `systems/talk.js`'s pickpocket law, which wrote the STRING
`'Pickpocketing'` - because `court.js` imports `talk.js`, so `talk.js`
could reach neither the one setter nor the enum. `arrestFlow.crimeId()`
had grown a `typeof c === 'string'` arm to translate it back;
`systems/classicSave.js` had no such arm and wrote the string into a
save byte that classic keeps as an integer. A cycle is not a reason to
change a value's type: the enum is a leaf module now
(`systems/crimes.js`, no imports, no behaviour), `court.js` re-exports
it so no other caller moved, and both sides of the cycle can have it.
Two existing pins had read the string back and so held the defect in
place; both were re-aimed.

WHY NOTHING CAUGHT EITHER. `test/cityguards.test.js` - the watch's own
suite - is ARENA2-gated end to end, so CI has never executed a line of
the pool's behaviour. It does not need to be: the pool's records are
its public `guards` array and the despawn arm runs long before anything
wants art. `test/guard1_watch_despawn.test.js` (7) takes no ARENA2 and
runs everywhere: the three clauses that were there, the fourth that was
not (and that the term is the TRANSFORMATION, not the lycanthropy), the
mortal's untouched path, the spawn chain still answering after a
walk-away, the cap on both sides of `<= maxActiveGuardSpawns`, and the
crime id as a number from one enum. Three mutants, three killed.

STILL OPEN: whether this is the defect the player hit. The symptom
matches it exactly, but it needs the player to have been a transformed
lycanthrope. The port has three other ways for the watch to vanish and
all three are verbatim DFU - the location-rect exit
(`PlayerGPS_OnExitLocationRect`, :2449-2453, which clears the crime
about 100 m past a village's edge), the post-fast-travel clear
(:2455-2459), and the court release. Nothing records WHICH fired, which
is why a report like this cannot be answered from the text alone.


**2026-08-25 - THE ENHANCED-MENU AUDIT (U49 and everything under it).**
Mac's call the day the front door shipped. Scope: `ui/enhancedMenu.js`,
`ui/enhancedStyle.js`, `systems/uiSkin.js`, the `main.js` routing and
the two front doors, read adversarially against the port's own standing
laws rather than against DFU - none of this HAS a DFU original, which
is exactly why it needed reading. EIGHT findings, all fixed at root and
pinned, seven mutation-proven.

TWO WERE SEVERE AND BOTH ARE OLD SHAPES IN NEW CLOTHES.

(F1) AUDIT 24'S OWN LAW, BROKEN IN THE SCREEN THAT REPLACED THE SCREEN
IT WAS FOUND IN. Forty sub-44px touch targets on a Pixel 5: every row
label 19px tall, every value pill 38, every stepper 34 - and the CSS
carried a comment saying "the hit box around it is 44 because a thumb
is" over a rule that read `content: ''` and `position: absolute` and
nothing else. It drew no box, claimed no space and hit nothing. A
comment asserting a law the code does not implement is worse than no
comment: it is the thing a reader checks INSTEAD of measuring, which is
the AUDIT 17m shape. The classic screen's pin (settingsUI T14) could
not see this side, so `tools/enhancedTapProbe.mjs` now MEASURES every
button on every pane and every settings category on a phone in both
orientations - `getBoundingClientRect`, not a stylesheet - and kills
the original bug when the dead rule is put back.

(F2) CONTINUE COULD SILENTLY START A NEW GAME, which is AUDIT 19 F3
exactly, one layer down and past the guard F3 installed. `readQuicksave`
parses the blob; it does not test its VERSION, and `restorePlayer`
refuses a stale envelope AFTER the world has booted - printing "Save
version mismatch." into a HUD nobody is looking at yet and coming up on
the chargen wizard. Both front doors had it: the classic menu's
`hasSavedGame` was `!!readQuicksave()` and had been since U21. The
question is "can this build restore it", the answer belongs beside the
restorer whose law it is, and `restorableQuicksave` is now that one
home with both doors calling it.

(F8) WAS FOUND BY THE LIVE CHECK RATHER THAN BY READING, and that is
the entry's real lesson. On a phone the settings detail pane is a sheet
that only rises when a ROW is tapped, so the CATEGORY card - and the
Reset button living inside it - could never be reached at all.
Playwright spent thirty seconds trying to click a control translated
101% off the bottom of the screen. Same family as F1 and as AUDIT 24: a
control that exists, is drawn, and is unreachable on the device that
needs it most. A second tap on the active category opens it, which is
`settingsWindow`'s own second-tap-acts gesture one level up rather than
an invention, with a dot on the active tab because a gesture nobody can
see is a gesture nobody uses.

THE REST. (F3) Reset wiped every override on one press where the
classic screen has always confirmed - and the classic screen's own
confirm TEXT lies, promising to clear "this screen's own preferences,
like Text Size" when `resetToDefaults` never touches `uiPrefs`; the
enhanced copy says what it actually does. (F4) Delete was drawn
undimmed and operable-looking and did nothing, caught by `onAction` and
returned - the exact lie the anti-lie law forbids; it is wired now,
behind the same confirm. (F5) Colour and text rows drew a value with no
control and no reason, reading as broken rather than as unbuilt; colour
rows get the browser's own picker, writing through the same `setValue`
door as every other row and CARRYING DFU'S ALPHA BYTE through
(`ToolTipBackgroundColor` ships D2 and means it). (F6) The enhanced
skin pulls two font families from Google - the port's ONLY third-party
request, made by the DEFAULT skin, in a build whose doctrine is that it
ships self-contained; non-blocking and with fallbacks, but undocumented,
which is what made it a finding rather than a choice. Now a Ledger A
row with a `?nofonts` opt-out, and self-hosting is Mac's call. (F7)
`effectiveSettings()` - a full merge of all 171 keys - ran ONCE PER
ROW, so Video rebuilt the whole store sixty-six times per render.

CLEARED, recorded because each was checked: the mount/unmount cycle
leaks no listeners and resets its own state; `?skin` still persists
nothing; the classic path is byte-for-byte untouched; every control is
a real `<button>` so tab focus and Enter work with the browser's own
focus ring.

**2026-08-23 - AUDIT 25, THE COMPLETENESS AUDIT.** `01-Overview/Audit-25.md`.
Mac asked what we need to complete the 1:1 port. AUDIT 23 and 24 were
PARITY audits - they read `src/` against its C# originals and asked
whether what shipped was right. This one inverts the denominator: a
real DFU checkout (849 `.cs`, 261,659 lines) split into 27 subsystem
groups so every non-Editor C# file sat in exactly one manifest, a
surveyor per group, an adversarial refuter per survey (refute by
default - a false gap costs more than a missed one), and four
reconciliation passes over the top. 1,327 units judged; 767 surviving
gaps; ~63,400 JS lines estimated, against 88,640 in `src/` today. The
verdict: about two thirds of the way, with the remaining third
concentrated in whole systems never started - ENCHANTING at 0% (24
payload classes, no dispatcher, so every magic item is a label), BOTH
AUTOMAPS at ~2%, the six magic crafting windows, BANKING at 0%, the
classic `.SAV` reader at 0%, the pause menu and key rebinding at 0%.
Seven P0 blockers, all of them host seams over laws the port already
carries: **quest foes never spawn** (`createFoeGameObjects`/
`tryPlaceFoe`/`standFoe` have consumers and no supplier), the dungeon
half of the quest scene mount, `RespawnPlayer`, the dungeon quicksave
that drops quest + conversation state, and four of the talk window's
five pages. THE PATTERN WORTH NAMING: the port repeatedly translates a
law correctly and never wires it - `systems/mysticism.js` carries the
whole Mysticism school and only `silenceBlocksCast` has a production
consumer; `test/mysticism.test.js:224` *asserts* the host does not call
the rest. Exact counts where a surface was countable: quest actions 61
of 82 (21 are `PendingTrigger` guards), the classic effect library 60
of 82 keys landed (22 fall to `out.skipped++`), FormulaHelper ~80 of 97
statics (the 17 absent name the unbuilt services exactly). And the
finding about our own bookkeeping: of the 767 gaps, 137 map to a
Port-Ledger C row and 630 do not - **the ledger has been tracking about
a quarter of the remaining work**, because parity audits only see what
the port already touches.

**2026-08-20 - AUDIT 23, the whole-codebase bug + parity audit.** The
overnight mandate: a fresh 1:1 pass over EVERYTHING, before further
development. Seventeen read-only find lanes (formats x2, save/load,
hosts, guilds/factions/talk, cross-cutting, entity laws, audio/music,
items/economy, magic, combat, characters/AI, world-assembly,
world-terrain/streaming, player-motor, ui-native, ui-chargen) swept
src/ against the full DFU Scripts tree with dual-evidence rules;
~180 findings landed in the session scratchpad register, the
high-impact set re-verified by hand against both sources before any
fix (DO NOT FIX WHILE THE VERIFIER IS READING held throughout - fixes
waited for their files' lanes). Two majors were REFUTED in hostile
verification and are recorded as non-bugs: interior/dungeon editor
flats are correctly hidden (DaggerfallBillboard.Start disables the
renderer for FlatTypes.Editor unless the debug ShowEditorFlats option
is on - the lane read the layout functions, not the billboard), and
with them the M4 doc-truth claim stands as written.

FIVE FIX WAVES, every fix pinned (audit23{,_magic,_combat,_systems,
_hosts,_ui}.test.js - 56 new pins), the key pins mutation-proven
(twenty-plus mutations, each a red suite):

WAVE 1, save integrity - the SHIP-BLOCKER (two independent finders):
a save loaded before anything attached the faction store dropped
every earned reputation permanently; restore now stashes, a
store-less re-save carries the stash, attach replays it. Guild
memberships clear-then-apply on load; lastSkillCheckTime rides the
envelope anchored at the classic start; regionPrices persists;
dropped piles ride the dungeon world snapshot with their saved icon;
worldModes' quickload applier goes through player.spawn.

WAVE 3 laws: the classic Free Action patch (SPELLS.STD spell 10);
AreaAtRange wall explosions; cast tallies; the absorption self-cast
refund cap made live; cost-at-ready + instant CasterOnly; the enemy
silence gate; THE BOW MACHINE ENGAGED (isBow was never set - bows
swung on the melee clock); multi-target melee; foes-before-env; the
swing sounds moved to DFU's placements; Arrow=131/Helm=107; item
conditions minted everywhere; icon variant clamps; %wth/%kg; the
TEXT.RSC empty-variant step-back; the first-wins spell fold; the four
guild subclass service switches + the Mages library; TG_Spymaster
806; FrameSpeedDivisor; spawn bands; pile gender; song channel-gain
resync; advancement moved from the per-minute tick to the rest-end
close (DFU's only live site).

THE HOST BATCH: ONE CLOCK - the exterior hosts' time-of-day gates
read a frozen demo clock while gameplay time advanced elsewhere, so
night never fell for music, lights, windows or the sun; minuteNow now
reads worldMinutes (?tod sets, ?timescale scales), the sky adds the
calendar season, ambient rides the weather scale. The exhaustion
collapse, jump drain+tally, quarter-rate Running tally and the
112-day reputation normalization all moved into the shared entity
tick with per-host presenters; the guards demand the classic clock;
the exterior swing arms drain and tally fully (the double tally
died); death above ground presents again; night interiors darken;
dungeon F5/F6 swallowed; the music director feeds above the modal
return; the wandering population takes the climate race with the
region name bank; the motor forces the swim crouch and Jump no longer
breaks the stealth standing test.

WAVE 4 + docs: the level-up double pool roll; talk activation
distances (the 76.8 ray with per-mode too-far lines); the drawn-space
GlyphSpacing asymmetry; the chargen skills cursor; the voxelfolk rig
leak; Charm prices chance only; the player cast sound; duplicate
constants deleted per ONE DFU MEMBER ONE EXPORT. THIRTY-NINE
doc-truth findings resolved: stale FLAGGED/INTERIM sentences retired
or corrected across fourteen files, three new Ledger A rows
(lightSourceIndex, AmbientEffectsPlayer PRNG, the biography GP-minus
inert divergence), the castle-detection and Move-door rows corrected,
and TWENTY-EIGHT new Ledger C rows routing everything the audit
established as unported (above-ground spellcasting is the PRIORITY
row; condition damage, combat voices, archer bands, pacification,
enemy doors, encounter spawns, encumbrance, climbing, spellbook
management, and the rest are named with their DFU members).

Numbered 23 because the two paused parallel sessions landed AUDIT 21
and AUDIT 22; their fixes are merged below but their own log entries
were never written into this section - noted here so the numbering
reads straight.

**2026-08-19 - AUDIT 20, the parity pass over S25 + G1 + G2.** Numbered
20 because AUDIT 19 is in flight on main (batch 1 landed; its Home.md
entry has not). Scope: the faction reputation store and the two guild
slices built on it, read against PersistentFactionData.cs, Guild.cs,
GuildManager.cs, Temple.cs and KnightlyOrder.cs. The read was completed
BEFORE any fix (17l), and every one of the nine fixes is pinned and
proven to fail when reverted.

FIVE MAJOR. (1) THE THIRD REPUTATION CHANNEL DID NOT PERSIST: the save
envelope carried sGroupReputations and legalRep but not the faction
store, so every backstory `rf` answer and every crime's People delta
was lost on load - and guild rank, computed from it, reset with it.
(2) Guild memberships did not persist either; DFU serialises
GuildMembership_v1. (3) applyHeadlessChargen - the ?class= path all
three exterior hosts can boot - never attached the store, because it
is a SECOND copy of the construction that hand-rolls the starting kit
instead of going through applyCreationExtras. THE ONE CONSTRUCTION
SEAM, found for a fourth time, in the same shape 17f, 17h and 17i each
found. (4) The membership slot is keyed by GUILD GROUP in DFU, not by
guild: all eight temples share HolyOrder and all ten orders share
KnightlyOrder, so joining Mara's temple REPLACES Arkay's. Keyed by
name, the port let a player hold all eight temples and all ten orders
at once. (5) TokensPromotion is PER RANK in five of the six guilds -
the message announces the benefit that rank unlocked (Mages library at
2, magic items at 3, summoning at 6, teleport at 8; Thieves fence at
2, spymaster at 4; the Temple's is computed from its own service-rank
columns, which is what makes those columns load-bearing). The port
returned one flat record, so a member promoted into a benefit was told
the generic line.

FOUR MINOR. GetGuildGroup's "temples nested under deity" branch was
missing, and every divine's own ggroup is None in the shipped file, so
every temple answered "not a guild". guildOfFaction still answered
null for all eighteen variants after G2 shipped them. zeroAllReputations
REBOUND store.dict, stranding any caller that captured it - court.js
reads it on every crime. And createFactionRep's clone was one level
deep, leaving the children array shared with the reader, so the
module header promised a guarantee it did not keep.

Two DFU behaviours were left deliberately unported and flagged rather
than guessed: the Thieves Guild's rank 6/8 promotion messages are
RevealLocation()-gated (quest/map state), and the Knightly Order's
rank 9 message is OwnsHouse-gated (banking). Both take the plain
promotion record until those slices land.

1051 tests -> 1060, and the suite is green with ARENA2 set and unset.


**2026-08-19 - AUDIT 18, the whole-codebase parity audit.** Mac's call:
the ultimate bug-and-parity pass over everything ported so far. 18
domain lanes read the port against the DFU C# and produced 147
findings; a hostile verifier per lane, told to REFUTE by default, then
re-opened both sources on every one - 130 CONFIRMED, 15 PARTIAL, 2
REFUTED, and 84 MORE defects the verifiers found while re-reading.
Eleven fix domains applied them in isolated worktrees, each required to
prove every pin FAILS when reverted. 160+ fixes, 221 new pins, 688
tests -> 909.

TWO THINGS WERE BUILT THAT THIS PROJECT HAD NEVER HAD, and they carried
the audit:

THE DIFFERENTIAL HARNESS. DaggerfallConnect's own readers now COMPILE
AND RUN under Mono (35 reader files + a tiny Unity shim; there is no
UnityEngine.Vector3 dependency at all - FaceUVTool uses
DaggerfallConnect's own DOUBLE-precision Vector3). Both sides dump the
same format - floats as IEEE-754 bit patterns, bulk data as SHA-1 - so
comparison is exact. 10,865,545 values compared across every reader and
the whole ARENA2 corpus: 12,487 BSA records, 11,211 TEXTURE frames plus
the full getColor32 parameter surface, ARCH3D's 797,433 points, WOODS'
500,000-pixel sweep, MAPS' 15,251 locations, 1,295 BLOCKS, 65,000
DFRandom draws. The reader layer came back byte-identical. Three real
divergences fell out (F3, F4, and the fixed-length ReadCString), and
one honest correction: Ledger row 18's approved float->double widening
costs 52,505 of 1,917,087 UVs (2.74%) - nobody had ever measured it,
and "validated against corpus" had never meant bit-identical. A 1,803-UV
residual at MATCHED precision is unexplained and is now a Ledger C row
rather than a silence. The harness is re-runnable.

THE MUTATION AUDIT. 631 targeted one-character mutations to ported
logic; 281 SURVIVED all 688 tests - a mutation score of 55.3%,
validated by re-running a random sample of survivors against the full
suite (12/12 still survived). 29.9% of src/ lines were executed by no
test. Only 24 of 179 parity-surface tables were pinned whole. The four
parallel scene hosts - 3,906 lines of DFU-cited behaviour - had ZERO
execution coverage, known to the suite only through five regex greps.
The weakest operators were the ones this port depends on most:
trunc/floor/round swaps 44% caught, >> vs >>> 20%. And one pin was
vacuous by construction (enemyequipment.test.js's armour deepEqual had
IDENTICAL ternary branches, so it pinned nothing about which parts a
Buckler protects).

THE HEADLINE DEFECTS. Every armed player swing computed NaN: DFU never
stores a weapon's damage, it resolves the TEMPLATE on every swing
(GetBaseDamageMin/Max), and the port read baked fields that only enemy
equipment ever set - so from the moment S3d's starting gear replaced
the interim dagger, a chargen-created character did NaN damage with the
weapon the game hands them. Three shipped readers had NO DATA in
production (the ingest diet predates U18/T3a/S3e and dropped
CLASSES.DAT, FACTION.TXT and every BIOG*.TXT; dev hid it because vite
serves the network fallback that production 404s). U7 rest never
advanced an hour in either host - the clock ticked inside drawFoes,
which both hosts skip whenever an overlay is up, and the rest window IS
the overlay. ?world and ?exterior were ENTIRELY SILENT until a dungeon
was entered. No enemy could fire a bow. Looted gold was unspendable. 26
of 58 fully-implemented spells were charged the wrong cost. And the
player's whole world clock - magic rounds, disease days, poison rounds,
fatigue, skill advancement - ran ONLY inside a dungeon, so a character
who stayed above ground never advanced a skill or gained a level.

THREE TIMES THE PIN WAS THE FINDING. F1's fixtures built weapons in a
shape no production path mints, which is exactly why the NaN shipped
invisibly. F3's pin asserted the port's own invention (rulerPowerBonus
20..70) over DFU's value - FactionData is a struct, DFU copies it into
the dict BEFORE assigning the seed, so every faction it hands the game
carries 0 - and that pin would have made the fix read as the
regression. And the suite could not see the NaN, the silence, the
frozen clock or the dead bow at all, because the hosts have no
coverage.

THE MERGE FOUND FOUR MORE. Eleven independently-developed domains
disagree, and reconciling them was not bookkeeping: two fixed the audio
bootstrap separately (two bootstraps, two flags - the duplicate-port
shape this project keeps catching), two fixed the ingest diet
separately (the blanket .TXT form won over the named one: it removes
the class, not three instances), a pin asserted ENEMY_BASICS had no
parrySounds column while another domain was adding it (EnemyBasics.cs
gives Knight_CityWatch ParrySounds = true, so the merged CODE was right
and the PIN was the stale half), and one domain replaced
enemyGroupOf(affinity) with enemyEntityGroup(careerIndex) - DFU groups
by career - while another still imported the old name. That last one is
a hard ESM link error that SURVIVED ALL 904 TESTS and was caught only
by `vite build`. It is pinned now: F7 imports every module under src/,
so a dangling import fails the suite instead of the deploy.

THE DOCS WERE LOAD-BEARING AND WRONG. Port-Ledger C listed
breath/drowning and the crouch motor as unported when P12 shipped both
- LIVE CODE sitting inside the Ledger's own "not yet ported" exemption,
which is precisely how a defect there would have escaped this audit.
Systems.md and UI.md said "Not started" for arcs that shipped S1-S22
and U1-U20b. Testing.md claimed CI ran "88 pass, 49 skip" - it was 613
/ 75, describing a suite that had not existed for many milestones, and
the real point it hid is that those 75 real-data pins NEVER RUN IN THE
DEPLOY GATE. Two source comments cited Ledger rows that do not exist -
the exact AUDIT 17m shape, twice more. Home.md's open-flags list is now
regenerated MECHANICALLY from the flag sites and pinned BOTH ways: a
drifted citation, a flag retired without deleting its sentence, or a
new flag never listed all fail the suite.

WHAT THE PINS LEARNED. The audit's own rule - A PIN MUST FAIL - was
applied to every fix by reverting it, and several agents reported
honestly that a doc-only change cannot be pinned rather than padding
one. Where a host seam genuinely cannot be driven in node, the pin is a
SOURCE SWEEP and says so. Where a fix made something testable for the
first time (the player world clock, the fatigue bands), the pin is
behavioural. Three pins were rewritten from source greps into
behavioural assertions when the merge made their mechanism stale but
their intent correct.

**2026-08-19 - AUDIT 18, the DOC-TRUTH sweep.** The bible is load-bearing:
17m proved a false "recorded in the Ledger" claim actively hid a live defect
from the person checking whether it was known. This pass audited the bible
AGAINST the code and fixed what was false, with the checks that keep it that
way in test/audit18_bible_docs.test.js.

Present-tense lies, corrected: `06-Systems/Systems.md` and `10-UI/UI.md` both
said "Not started" through S1-S22/E1-E3 and U1-U20b (37 and 19 live modules);
`03-World/World.md` said COMPLETE where the arc had reopened;
`04-Characters/Characters.md` said ACTIVE and stopped at C5;
`01-Overview/Port-Doctrine.md`'s phase plan still called Readers-Arc active.
`07-Rendering/Rendering.md` listed `groundMesh.js`, deleted at R10, as a
CURRENT module and tagged it "(ledgered departure)" when Ledger A has no
ground-mesh row - the 17m shape exactly; `03-World/World-Arc.md` carried the
same module plus `terrainMesh.js`, deleted at R9. This page's ground rules
still said "Desktop-only. No touch controls, no mobile layout" six days after
the approved touch layer shipped into all four hosts. This page's open-flags
list promised "Line numbers refreshed" while six of its 109 citations pointed
at the wrong line, up to 41 off.

Ledger lies, corrected: section C still listed breath/drowning AND the crouch
motor as unported, so P12's live code was sitting inside the Ledger's "not
yet ported" exemption (the Argonian breath refund and PlayerHeightChanger's
0.1s timed transition, which genuinely are unported, now have their own row);
the house-container row claimed a feature S2b shipped; `Audio.md` closed the
activation-sounds queue on the claim that both PlayerActivate clips were
"already ours", when ActivateLockUnlock = 316 is in neither soundClips.js nor
any consumer (folded into the door-lockpicking row, where its mechanic
lives); section B recorded a 0-hour rest running a full hour as a preserved
DFU quirk when DaggerfallRestWindow.Update ends a 0-hour rest immediately -
the row was a divergence wearing a quirk's clothes; and the SetEnemyEquipment
Feet-slot quirk (EnemyEntity.cs:414's strict `<`, which leaves enemy boots
out of ArmorValues[Feet]) had no row at all while enemyEquipment.js
subtracted them - up to a 65-point swing at daedric. Two source comments cited
Ledger rows that did not exist (chargen.js's `isCustom`, encounterTables.js's
dead Cemetery block); both now have B rows.

Silent gaps promoted out of prose: `collectExteriorNpcs` has NO production
caller - the interior twin is live, the exterior side is dead - so no
exterior static NPC is a talk or activation target, recorded as a C row
rather than left inside a "C2 SHIPPED" heading. `Systems-Arc.md` said
DamageSpellPoints' MagnitudeCosts(20, 28) was "already in the S10 cost
table"; spellcost.js has no `4,2` key, so those spells fall through to the
zero-component fudge and are priced wrong.

Lesson, and the reason for the new test: EVERY check here is mechanical.
Home.md's open-flags list is grep-regenerated from `src/`, which is why it
could never catch a false claim in Home.md's own prose - a doc rule that
only a human re-reads is a doc rule that rots. The pins assert citations
resolve, that flagged sites and the list agree BOTH ways, that every
`src/...` path the bible names exists, and that a section index cannot say
"Not started" while its own arc says SHIPPED.

**2026-08-18 - AUDIT 17n, the parity pass over U20b.** The data came
back clean - the 50-entry difficulty table diffs key-for-key AND
value-for-value against the C# literal, all 71 labels match DFU's
recovered FALL.EXE text, every secondary list matches in order, and a
career's flags survive the save round trip (the shape 17h caught
dropping reputation). The WIRING did not. THE ENEMY-TYPE ATTACK
MODIFIER HAD NEVER APPLIED TO ANYBODY, broken in two independent
places: DFU reads attacker.Career.<group>AttackModifier for every
attacker (FormulaHelper.cs:993-1030) and the port flattened that byte
onto the entity, where only the FOE builder set it - so a player, who
carries `career` and no flat field, tripped the null guard and scored 0
on every swing; and underneath it, calculateAttackDamage threaded
targetGroup to the monster and hand-to-hand branches but called
weaponAttackDamage without it, leaving that function reading
`target.group`, a field NOTHING in the codebase mints. The target half
was correct all along, which is exactly why it looked wired. Not a U20b
regression - the classic ASSASSIN ships 0x04, a Humanoid bonus, and has
never received it; U20b only made the same modifier purchasable.
Catalogued alongside: which U20b picks actually do anything (six live,
twelve inert for want of a consuming subsystem - in the Ledger, so the
window does not imply they all work), and two standing interims whose
"pends a decode" notes are now stale because U20b provides the decode.
Seven pins, mutation-proven.

**2026-08-18 - AUDIT 17m, the picker's row is not the document's
class.** U20a's adversarial review finished after the slice had
already merged, and one finding survived every lens. DFU carries TWO
class indices - `characterDocument.classIndex` (written at the
wizard's :343, :364 and :382) and CreateCharClassSelect's own
`listBox.SelectedIndex`, which the wizard never writes and which
survives a revisit because SetClassSelectWindow reuses the window
(:158-167). The port had ONE field doing both jobs, so `customExit`'s
affinity write also moved the class picker. That cost a character:
build a custom class, press Escape off the biography-method screen,
and the list came back on a STANDARD row - confirming there ran
`_acceptStandardClass`, nulled `customCareer`, and made the player a
class they never picked. Split into `classIndex` (the document) and
`classListIndex` (the picker), with `_adoptCareer` as the shared tail
of the accept arms so they cannot drift apart again. Fixed with it:
the builder's keyboard had a live `plus` arm against a DEAD `minus`
one (the overlay table matches `-` as a character first), so a
keyboard could spend from the freeEdit pool and never refund - DFU has
no keyboard stat control on that screen at all, and the pool moves by
click now. And a doc find worth more than its size: UI-Arc.md claimed
the conflation was "Recorded in the Ledger" when no such row existed,
which actively hid the defect from anyone checking whether it was
known. RETIRING A FLAG DELETES THE SENTENCE - it is deleted, not
backfilled, because the departure is fixed. Six pins, mutation-proven
(restoring the original defect fails three).

**2026-08-18 - AUDIT 17l, the U20a parity review.** The custom-class
builder was reviewed adversarially against its DFU sources the moment
it was written - five dimensions (the builder's own laws, the
reputation window, the wizard wiring, the port's standing rules,
regression risk in the seams U20a changed), each finding then read
back against the C# before it was believed. Sixteen survived, all
shipped: eleven inside U20a itself and five here, in the slices it
touched.

(F1) THE EXTRACTED LIST PICKER PICKED ON A SINGLE CLICK. U20a pulled
`drawListPicker` out of the class list so the builder's skill and
help pickers could share it - and carried the geometry but not the
GESTURE. A DaggerfallListPickerWindow raises OnItemPicked from
`listBox.OnUseSelectedItem` (:84,136-148), the DOUBLE-click door U17
already pinned for the class list. One click selects, two pick, and
Return goes through the same door - one implementation for all three
pickers now.

(F2) THE DUNGEON HOST'S FONT-LESS FALLBACK HAD REGROWN ITS OWN APPLY
CODE. `chargenInputFallback` hand-built its result and called
createCharacter / startingSpells / assignStartingGear directly, so it
silently dropped every field the flow has grown since - 17f caught
that shape for the spellbook, and U20a's `isCustom` and custom
reputations had already fallen through it. The tail is factored now:
`applyCreationExtras` owns the spellbook, the kit and the reputation
seed, and both finishChargen and the fallback come through it. The
FOURTH instance of the dungeon-host-falls-behind shape this week.

(F3) THE MINUS KEY WAS UNREACHABLE, and had been since the stats
screen shipped. `overlayAction` tests the typed-character class FIRST
and the hyphen is a literal inside it (input.js:18), so `-` always
arrives as `char:-`: a stat or skill point could be spent from the
keyboard and never taken back. ('+' and '=' were never affected -
neither is a typed character.) Both screens accept the typed hyphen
as their minus now.

(F4) THE REPUTATION BALANCE IS THE WINDOW'S OWN FIELD, not a fresh
sum. `pointsToDistribute` is a short initialised to 0 and updated
only by UpdatePointsToDistribute on a BAR CLICK, and the window is
NEWed on every press of the Reputations button - so re-opening it
over an unbalanced ledger reads 0, and the exit gate reads that stale
0. Classic really does let an unbalanced ledger out that way. Ported
as a field, with the Escape-cancels-unconditionally arm beside it.

(F5) ONE DFU MEMBER, ONE EXPORT: the six magic schools were declared
twice - U20a's `MAGIC_SKILLS` and the private `MAGIC_SKILL_IDS` that
`SetEnemyCareer` has used since S16. Both import one table from
skills.js now.

Also fixed inside U20a before it shipped: the rep hit was
horizontally unbounded (an off-panel click set underworld
reputation), the picker's origin became a constant so its hit is
art-free like every other screen (it was the one path the pins could
not drive), the rep window's Escape was wrongly gated, a click on the
middle line kept the old value where DFU zeroes it, both draw arms
now guard `flow.custom` the way the hit arm does, and repClick could
emit a negative zero.

**2026-08-18 - AUDIT 17k, the parity pass over U16 + U17 + U18, and
THE FIST CRASH.** Mac's report first: attacking with a fist crashed
the game. Root-caused live (tools/fistProbe.mjs reproduced it at
`dungeonContext.js:1823` before the fix): bare hands are a NULL weapon
since U8h bound the rig to `equip.slots[RightHand]` - and the DEFAULT
state, because starting weapons land in the bag unequipped (DFU adds
them via AddItem, never equips) - and the DUNGEON host read
`WEAPON_SKILL[playerWeapon.weapon.name]` raw at BOTH its swing sites
where the exterior hosts guarded with `?.`. The strike-frame bow test
threw on EVERY bare-handed swing; the melee tally threw on every
resolved fist hit. The FOURTH instance of the
dungeon-host-falls-behind shape (17f twice, 17h, now this), so the fix
ships with the 17i-style rule: a source sweep over src/scenes FAILS on
any `playerWeapon.weapon.` deref without the guard (17k F2,
mutation-proven), a functional pin drives the whole bare-handed path
(ready with no draw sound, swing, HandToHand damage), and a corpus pin
holds WEAPON10.CIF - the fist art, now the default draw - against
every MELEE_ANIMS row. Probed: two full fist swings in the dungeon,
zero page errors, the fists eyeballed mid-swing.

(F1) THE CONSTELLATION PALETTE NEVER RESTORED. DFU constructs the
questions window over a FRESH ImgFile every time, so a re-entered
screen always shows the file's own palette; the port keeps ONE CHGN
palette and only ever WROTE the brightened blues into it - so a
second run's un-answered screen re-uploaded the LAST run's
constellation glow under the 'pristine' texture key. The palette law
extracted pure (`constellationPalette`): answered runs write
(0,0,blue), a pristine draw restores the slot colours captured at
load. Pinned both ways, mutation-proven.

(F3) THE SCROLL CLAMP'S BOUNDARY WAS UNPINNED. The U18 scroll pin
only exercised labels far from the text-window edge, so mutating the
strict `>` to `>=` survived it. The 17k pin walks a 7-row label to
the exact edge: one pixel past scrolls, exactly ON the edge blocks.

Clean elsewhere: the U16 summary re-read against CreateCharSummary.cs
whole (the pool zeroing, the four-pool OK gate, restart, the name box,
the biography bonuses on the summary's skill block - all as pinned);
Escape-cancels verified against DaggerfallPopupWindow's allowCancel
default (no CreateChar window overrides it, so the method and
questions screens cancel exactly as ported); the U18 click boundaries
(strict margins, strict row bounds, no x test) re-checked verbatim;
the answer-table/nibble/results-walk laws already deepEqual-pinned;
the remaining raw `entity.weapon` derefs all sit inside
`if (entity.weapon)` guards (dungeonContext:403/417, cityGuards:95).
Recorded, not fixed: the dungeon tests its bow branch by WEAPON_SKILL
where the other hosts use weaponTypeForItem - same verdict for every
item and for null, two spellings of one law.

**2026-08-18 - AUDIT 17j, the parity pass over U14 + U15.** The
pointer path and the wizard reorder (PRs #65, #66), read against DFU's
`DaggerfallStartNewGameWizard` HANDLER TABLE and `CreateCharNameSelect`
rather than against the port's own `STATES` list. Seven confirmed, all
shipped here. The through-line: U15 got the ORDER of the wizard right
and every one of its BACK arms wrong, because I read the order forwards
and then inferred the cancels by reading it backwards. DFU's cancel
targets are written out one by one and three of them do not step back
one screen.

(F1) THE RANDOM-NAME BUTTON WAS DETERMINISTIC. `ShowRandomButton`
reseeds DFRandom from a fresh `System.Random` every time the name
window is pushed, and says why in as many words:
"better than starting with a seed of 0 every time"
(`CreateCharNameSelect.cs:123-126`). The port never reseeded, and
DFRandom is a GLOBAL whose last `srand` before chargen is the dungeon's
`locationId` - so every character of a given race and gender got the
SAME suggested name on every boot. Proven before the fix by two
simulated boots returning `Faarn-e` twice, and after it by the live
click probe returning `Rlillki` on every run, then `Florhttha`, then
`Kught-i`. The reseed lives in a `_enterName()` that every path into the
screen goes through, since DFU's is on OnPush and not on Setup alone.

(F2) THE CLASS SCREEN CANCELLED TO GENDER. `ClassSelectWindow_OnClose`
(:353-370) cancels to `SetRaceSelectWindow` - it skips the gender
screen. The U15 pin ASSERTED THE BUG: I wrote it from the STATES order
read backwards rather than from the handler. DFU also calls
`createCharRaceSelectWindow.Reset()` there, nulling the selected race;
the port's race screen has no unselected state, so that half is
recorded at the site rather than ported.

(F3) THE NAME SCREEN HAD NO CANCEL AT ALL - the one screen in the
wizard you could not back out of. `NameSelectWindow_OnClose` (:483-493)
cancels to `SetChooseBioWindow`, which on its way forward CONSTRUCTS a
fresh `CreateCharBiography` over a fresh `BiogFile`. That construction
is load-bearing, not incidental: `answerBiography` APPENDS to
`biographyEffects`, so re-answering without discarding would have
applied every biography effect twice.

(F4) THE NAME SURVIVED A RACE OR GENDER CHANGE. `SetRaceTemplate` and
`SetGender` (:142-161) both EMPTY the textbox when the value changed,
and `SetNameSelectWindow` re-assigns both on every push. Newly
reachable, because F2 and F3 are what give the wizard real back
navigation. The first entry never clears - that is what DFU's
`if (this.raceTemplate != null)` guard buys.

(F5) THE NAME WAS CAPPED AT 16 CHARACTERS. `CreateCharNameSelect` never
sets `MaxCharacters`, so the box keeps `TextBox`'s class default of 31
(`TextBox.cs:26`). Sixteen cut real names short, and the RANDOM button
- which assigns rather than types - could already mint a name the
player was then unable to retype.

(F6) THE POINTER SEAM REACHED ONE HOST OF TWO. U14 gave
`dungeonContext` an `overlayClick` and wired `dungeon.js` to it.
`worldModes` mounts the same context, DRAWS the same overlay in the
`uiOverlayActive` branch of its dungeon frame, and gated its
`pointerdown` on interior mode alone - so it could not click what it
drew. Latent rather than live today (chargen is the only overlay with a
`clickNative`, and it runs at boot where this host already has a
player), but it is the FOUR HOSTS shape for the fourth time in this
flow, so it is fixed and swept.

(F7) THE STATS AND SKILLS SCREENS REROLLED ON RE-ENTRY, throwing away
the roll and everything the player had spent from the pool. DFU keeps
both: `SetAddBonusStatsWindow` (:227-246) rerolls only
`if (DFClass != characterDocument.career)`, and
`SetAddBonusSkillsWindow` (:249-259) passes `!skillsNeedReroll` as
`isRestored`, whose arm RESTORES the document's skills
(`CreateCharAddBonusSkills.cs:62-68`). Both reduce to one rule - reroll
when the class changed, otherwise restore - and the screens' own Reroll
button still forces.

STILL OPEN, and each a slice rather than a fix: `WizardStages.Summary`
(the `CreateCharSummary` review screen, whose cancel arm feeds skills
and stats back to the earlier screens), `SelectClassMethod` +
`GenerateClass` (the class-by-questions path), `SelectBiographyMethod`
(the "answer at random" arm, which also picks the biography TEMPLATE
index), and `CustomClassBuilder`.

**2026-08-18 - AUDIT 17h, the parity pass over S3e + U13.** The
biography and reflex slices (PRs #61, #62), read against DFU source.
Three confirmed, all shipped here - and the first is older and larger
than the slices that exposed it.
(F1) THE PORT HAS NEVER SAVED PLAYER REPUTATION. `sGroupReputations`
is read by `getReactionToPlayer` on EVERY greeting and written by the
biography (the G2 court writes `legalRep` beside it) - and NOTHING
persisted it. A quicksave/load reset the player's standing with every
social group to zero. The six `biography*Mod` fields went with it, and
DFU writes all of that out field by field (SerializablePlayer.cs:136-141,
:152-162, :305-310). (`reactionMods` rode this fix too until AUDIT 65
SL-4 struck it: PlayerEntity.cs:128-129 is "do not serialize, set by
live effects", and :152-162 answers the reputations alone.) S3e made it
load-bearing from the first minute; the reputations are persisted now, with the queued faction deltas and the
composed backstory, and with the snapshot DETACHING from the live
entity - the quicksave write happens after snapshotPlayer returns,
the same law save.js already stated for the nested effect entries. A
pre-17h save leaves the entity's own state alone rather than nulling
it.
(F2) THE DUNGEON HOST SKIPPED THE BIOGRAPHY. It builds its own
ChargenFlow and never received the question sets, so a character
created in a dungeon answered no questions at all. The THIRD time this
exact host gap has appeared on this flow: 17f found it for the
starting spellbook and the starting kit, and here it is again one
slice later for the biography. The lesson is not "remember the dungeon
host" - it is that anything the flow needs must be handed to it by the
shared session, not wired per host.
(F3) THE REFLEX INFO PANEL IS A PARCHMENT POPUP.
CreateCharReflexSelect.cs:60-88 calls SetDaggerfallPopupStyle on it
and sizes it to its text plus the margins; U13 drew bare rows over the
province map. U11 already owned that frame, so this is a two-line fix
that should have been the first draft.
CHECKED AND CLEARED: the level-up sums anchor BEFORE the biography
bonuses in the port, and they do in DFU too - the effects are applied
at game start, after the entity setup that computes them. The 18
BIOG files loaded at boot mirror the 18 CLASS files already loaded
beside them, and only when chargen actually runs.
Pins: test/audit17h.test.js, four tests, each mutation-proven.
Probed + eyeballed: the reflex screen's text now sits in its parchment
panel.

**2026-08-18 - AUDIT 17g, the deep parity pass over U10 + U11.**
The chargen-art and message-box slices (PRs #58, #59), read
line-by-line against DFU source. Six confirmed, all shipped here.
(F1) THE WIRING THAT READ RIGHT AND DID NOTHING. U11's
`preloadMessageBoxArt` went into dungeonContext's `toggleCharSheet()`
- the comment beside it even said "for the action boxes" - so a
dungeon trigger that popped a ShowText box drew the FLAT fallback
unless the player happened to have pressed F5 earlier in the session.
Nothing failed loudly; the box just quietly wasn't classic. Moved to
scene boot, beside the TEXT.RSC load whose records it frames. The
same shape as 17e's silently-no-op'd `releaseEmptied` wiring.
(F2) THE BOX CENTRED EVERY ROW. MultiFormatTextLabel sets
HorizontalAlignment.Center on rows a JustifyCenter closed and leaves
the rest LEFT (:341-344). U11's own `linesById` carries that flag and
`drawMessageBox` threw it away. Counted over the real TEXT.RSC: of 676
multi-row records, 596 are all-centre (which is why the race
descriptions looked right), but 53 are entirely LEFT and 27 MIX the
two - 80 records that would have drawn wrong the moment the port
showed them. Rows now flow as { text, center } and a bare string still
centres, which is what a caller composing its own prompt wants.
(F3) THE ONE BRANCH THAT NEEDED THE ART WAS THE ONE THAT CRASHED.
`chargenHit`'s `class` case derefed `_art.imgs` directly where every
other case returns null, so calling it before the art loaded threw.
The live caller guards; nothing else had to know that.
(F4) THE PARCHMENT GREW AS YOU TYPED. `ActionInputBox` re-laid its box
out every frame from its own live entry, so the frame gained a whole
22px slice mid-word. `layoutMessageBox` takes `sizingRows` now and
measures the widest the field can get (maxCharacters 20, the same
clamp the input already enforces).
(F5) THE KEYBOARD WALKED PAST THE RACE DESCRIPTION. A click opened the
Yes/No box; a keyboard confirm went straight to gender. DFU has no
keyboard path on that screen at all - the map click IS the selection -
so routing both through the same box is the closer read. An art-less
flow still advances rather than trapping, pinned.
(F6) THE CLASS LIST JUMPED. ListBox scrolls MINIMALLY on a selection
move - SelectPrevious only pulls the window up when the selection
falls above it, SelectNext only pushes it down when it falls below
(:709-730). U10 recomputed a CENTRED window at draw time, so the whole
list lurched on every arrow and the selection never sat anywhere but
the middle. The scroll index is the list's own state now, and a click
on a row selects it as DFU's list does.
CHECKED AND CLEARED, recorded because each looked like a finding:
the FACE textures are not a leak - `uploadTexture` MEMOISES by key, so
the ten records per identity are bounded (160 worst case) and shared
exactly like archive art. The TEXT.RSC line-break fix has no live
regression: 714 of 1408 records changed shape, but every record the
port currently draws through a single-string path (the greetings,
tones, where-is answers, palace names) is single-row, and `drawText`
renders a stray control byte as a blank advance rather than a glyph.
FLAGGED, not fixed: the class picker's scrollbar THUMB. The geometry
is verbatim and simple (height = rail x displayed/total, min 10) but
the thumb art is three texture slices this port has not identified,
and inventing a colour would break the NATIVE-WINDOW RULE.
Pins: test/audit17g.test.js, six tests, each mutation-proven.
Probed: all seven exterior probes green; the keyboard confirm now
opens the Khajiit description at 9 rows, live.

**2026-08-18 - AUDIT 17f, the parity pass over the audit's own
changes.** Mac asked for a comprehensive audit of everything shipped
SINCE 17e - the four 17e waves themselves, S3c/U9 chargen, S3d
starting gear (PRs #51-#56). Read line-by-line against DFU source by
hand rather than fanned out: the surface is one arc wide, and the
findings that matter here are the ones a wave INTRODUCED while fixing
something else. Sixteen confirmed, all shipped in this one slice.
(F1) THE BIGGEST ONE - SetRace never reached the INVENTORY LIST.
17e F9 correctly moved the lists off world sprites onto the PLAYER
texture, but read the archive straight off the TEMPLATE. DFU offsets
that field by the wearer's body morphology at creation
(ItemBuilder.SetRace :850-854, ApplyArmorSettings :466-485) and
GetInventoryTextureArchive hands the OFFSET field back
(DaggerfallUnityItem.cs:1728-1735) - so every item list in the game
drew clothing from the morphology-0 ARGONIAN row and armor from the
Argonian archive, for every player of every race. The paperdoll had
the law; the list did not. `playerArchiveFor` is now the one home and
both windows call it; the wearer identity threads through
makeIconDrawer into the inventory and trade windows. Probed live: a
Khajiit's short shirt resolves to archive 238, not 235.
(F2) A MAGE CREATED IN A TOWN HAD AN EMPTY SPELLBOOK. The exterior
hosts called finishChargen with NO spell table - SPELLS.STD was
loaded only by the dungeon host - so the identical character created
in a town silently lost their starting spells. loadSpellIndex joins
loadCareers as a shared loader. Probed live: five spells.
(F3) THE ?class=N SKIP MINTED AN EMPTY BAG. S3d put AssignStartingGear
on the flow and on the font-less fallback and missed the headless
path, which sets chargenDone - so the hosts' interim seed skipped it
too and the character had no clothes, no weapon and no gold. The skip
is now one shared function (applyHeadlessChargen) and the exterior
hosts honour it too; they had PARSED ?class for the dungeon they might
build and ignored it for their own chargen.
(F4) THE PROBE ROT S3c CAUSED. Putting chargen on a fresh town boot
wedged the U8d/U8e/U8g probes - the overlay ate every key - and
nothing caught it because a probe is not a gate. Fixed by the F3 skip;
the equip probe additionally still cleared "the interim dagger" from
slot 19 by hand, so S3d's WORN starting clothes rode along and its
count assertion was reading four where it meant three.
(F5) ONE DFU MEMBER, ONE EXPORT, again. 17e F32 collapsed the armor
material tables from equip.js and paperDoll.js and stopped one file
short: characters/paperdollArt.js still held a third copy of the
SetVariant clamps and a SECOND export named `armorArchive` whose
second argument was a RACE where the other's was a MORPHOLOGY - the
same DFU member, same name, incompatible arguments. Collapsed onto the
single home with the C6a signature kept as a wrapper.
(F6) ONE GOLD MINT. Three producers (startingGear, court, talk) hand-
built the Currency stack with NO template index and two spellings of
the name, so the stack drew no icon at all - eyeballed as a bare
"100" floating in an empty button - and weighed nothing through
itemWeight, which is why charsheet carried a second copy of the
0.0025 constant. It is Currency.Gold_pieces (276) now, with the
classic pile icon (216/1) and the template weight; a pre-17f save
upgrades its stack on restore, because stacksWith compares template
index and a legacy stack would otherwise split off a second pile
goldAmount could never see.
(F7) THE CHARGEN COMPLETION GREW A SECOND COPY. dungeonContext
hand-inlined applyCharacter + startingSpells + AssignStartingGear -
the exact duplication systems/chargenSession.js had been extracted to
end one slice earlier. It calls finishChargen now.
(F8) createChargenWindow's own doc said onDone fires once; the code
fired it on EVERY key after the flow reached done, each one re-running
applyCharacter and re-rolling the starting kit.
(F9) THE PAPERDOLL LEAKED ON IDENTITY CHANGE. 17e F27 gave the
composite an owner, and S3c then added an identity-reload path that
set `_live = null` directly - orphaning the GL texture the refresh
would have freed. Chargen reaches it on every race/gender/face change.
(F10) The same reload advanced `_deps` (the identity paperdollItemImage
keys off) BEFORE the art loaded, so a failed load left a Khajiit
identity addressing Breton bitmaps.
(F11-F13) AssignStartingGear's three drifted details: the Spellbook is
added FIRST in DFU (ItemHelper.cs:1300-1306) and AddPosition.Back
makes collection order the DRAW order, so a new character's bag led
with their shirt instead; the pants variant was hardcoded to 4, which
is the MEN'S count - women's Casual pants (template 190) has FIVE, so
a woman could never roll her last variant; and the item names were
hand-written lower-cased copies of ItemTemplate.name ("Short shirt"
for "Short Shirt"). The clothes are also equipped where DFU equips
them, before the weapon is minted.
(F14) RETIRING A FLAG DELETES THE SENTENCE: armorMaterials.js still
carried "the other morphologies arrive with chargen (INTERIM, flagged
there)" after chargen shipped.
CHECKED AND CLEARED, worth recording because it looked wrong: 17e
F15's `safeScrollIndex` is CORRECT. DFU's GetSafeScrollIndex has two
branches and the port implements the delayScrollUp=TRUE one - which
is exactly the branch the Items SETTER takes
(ItemListScroller.cs:181), and the setter is what a refilter runs. The
tight clamp is the scrollbar/mouse-leave path we have no event for.
The partly-filled column really is classic.
FLAGGED, not fixed, with reasons: gold as a bag stack at all (classic
keeps playerEntity.GoldPieces as a counter that never appears in the
list - retiring the port's S2 shape touches goldAmount, trade and
loot, and is its own slice); a REMOTE list drawing its clothing on the
PLAYER's morphology (shop stock carries no owner identity yet);
quicksave living only in the dungeon host.
Pins: test/audit17f.test.js, ten tests, each mutation-proven - a
one-character change to the law it names turns it red.
Probed + eyeballed: chargen -> the Khajiit female in real clothes,
the bag reading Spellbook / Short Shirt / Casual Pants / Shortsword /
Gold Pieces, five starting spells, and the gold PILE icon drawing in
the Clothing & Misc list where a bare "100" had floated.

**2026-08-18 - AUDIT 17e, the comprehensive parity pass over the U8
native-UI arc + the economy/talk/crime slices.** Ten dimensions
audited line-by-line against DFU source in parallel, every finding
put through two independent verifiers (one adversarial, one
checking user-visible consequence + reachability), then a
completeness critic hunting what the audit itself missed. 106 raw
findings, 59 confirmed, 46 unanimous. WAVE 0 (shipped): seven
ship-blockers plus two the critic found.
(F1) THE MODAL CONTRACT BREAK - worldModes.frame() returned
`undefined` from the dungeon's UI-overlay early-out while every
other exit returned true; both hosts gate their whole exterior
frame on that value, so a dungeon overlay made them draw the town
over the dungeon and feed dungeon-local coordinates to the ?world
streaming recenter.
(F2/F3) TWO UNBOUNDED GOLD LOOPS - buyPrice fell back to value 1
where sellPrice fell back to itemBaseValue, and only sellPrice
multiplied by the stack. Nothing outside shopStock stamps `value`,
so any looted item sold for thousands, landed on the shelf, and
bought back for 1; and any stack bought for the price of one item.
Both branches now share one value resolution and the multiplier,
pinned by a round-trip invariant (buy never undercuts sell).
(F4) WORN GEAR WAS MERCHANDISE - the sell lists offered equipped
items and doSell spliced them out of the bag without releasing the
slot: a dangling equip table, a permanent armor bonus, and the FP
rig still swinging a sold weapon.
(F5) THE WRONG ANSWER TABLE - ANSWERS_TO_DIRECTIONS' knows-half was
DFU's answersToNonDirections (7261..7294 instead of 7256..7289), so
EVERY successful Where-is answer drew the wrong TEXT.RSC record -
and the test pinned 7261, certifying the bug and blocking its own
fix. Both tables now exist, pinned whole against the DFU literals.
(F6/F7) CRIME STATE HAD NO LIFECYCLE OWNER - crimeCommitted was
cleared only by the court, so walking out of town left the player
wanted for the session (the watch kept respawning; the despawn law,
gated on the same flag, could never fire); and
haveShownSurrenderDialogue never reset when the watch died, killing
the surrender box - the only call site of LowerRepForCrime.
(C1, critic) SAVE/LOAD DROPPED THE EQUIP TABLE - a load left it
empty, and since worn items are hidden from every inventory tab
they became permanently unreachable and un-removable, with armor
silently reset; a same-session load left the table pointing at
pre-load objects and kept the old armor bonus forever. Both fixed
by DFU's own derive-on-restore (SerializablePlayer.cs:301,355-368).
(C2, critic) NO ITEM WAS EVER ENCHANTED - three consumers read
`item.enchanted`, a property nothing writes (loot mints
`enchantments[]`), so looted magic weapons sat in Weapons & Armor
instead of Magic Items, swung the mundane animation set, and
stacked when DFU forbids it. IsEnchanted is now DERIVED, as in DFU,
and the three tests that fed hand-built `enchanted: true` literals
no producer could create were repointed at the real shape.
WAVE 1 (shipped): the paperdoll click was INVERTED (DFU unequips in
Equip/Select; Remove is inert - and the U8g probe asserted the
inversion, so the bug had a green test and a green probe); the item
lists drew WORLD sprites where DFU draws the player/inventory texture
for 111 of 288 templates - the port only had the world texture
because a lossy generated copy of ItemTemplates.txt shadowed the
verbatim one, now deleted; clothing footwear granted no armor;
the talk conversation had the wrong line pitch (RowSpacing is per
ITEM, not per wrapped line) and one flat colour; Okay closed the
window instead of asking; the player's question was a hardcoded
English literal instead of TEXT.RSC 7225+tone through the greeting
chain; arrows were material-priced and stocked as a stack of 1;
scroll indices never re-clamped; refreshPaperDoll dropped concurrent
requests; the worn-weapon bind moved into the weapon RIG so all four
hosts inherit it; stack labels and icon scaling were off by the 2px
button margin; and GetMaterialArmorValue's two divergent copies (both
inventing Chain2 = 0x0101 for DFU's 0x0103) collapsed into
systems/armorMaterials.js. WAVE 2 (shipped): the three GL leaks each got an owner (the
paperdoll's per-refresh composite, emptied loot piles freeing at
window close as DFU does, the dungeon's per-sprite batches); the
?world floating origin left guards, corpses and ground piles 819.2
units behind on every crossing (persistent billboard batches are
REBUILT, since their centers are baked into a static buffer, and pile
keys became stable ids); melee lost DFU's camera-FOV gate in both
exterior hosts, so a guard behind the player could be hit; the
Where-is list offered Palaces and Furniture stores that classic skips
and was out of enum order; court reputation was raised on banishment
(DFU does not) and withheld on acquittal (DFU does); the char sheet
weighed items by raw base weight, ignoring the material rule;
the exterior host's frame counter ran backwards after a modal frame;
and F5 inside a building reloaded the page. WAVE 3 (shipped): the treasure table's second declaration removed
(it had regressed a 2026-07-06b single-sourcing), two vacuous pins
repaired - a one-sided `bows >= 8` that survived promoting any weapon
to two-handed, and a "display law" pin that was pure literal
arithmetic touching no port code - and three stale flags deleted that
the grep-regenerated open-flags list had been re-publishing as live
work (two retired HUD-text flags, one Equip flag U8g had closed).
DEFERRED with reasons recorded: the paperdoll mask pass (cosmetic,
and the obvious fix is wrong for this architecture) and Chain2
reachability (constant fixed; nothing mints it until classic-save
import). The KRAVE01.HS2 Order-of-the-Raven override SHIPPED in
AUDIT 18 - the "needs otherNames threading" blocker was stale
(otherNames has always been at dfBlock.rmbBlock.fldHeader.otherNames);
it is now in talkTopics.mergeNamedBuildings and fires on 16 Dwynnen
buildings across 16 towns, pinned over the real corpus.

S3c/U9 CHARGEN (2026-08-18): the loudest INTERIM retires - the player
is no longer a Breton male face 0 with flat skills. Grepping first
(the audit's own rule) found most of chargen ALREADY built: the
verbatim rolling laws and the pool flow both existed, and only
identity, the other seven races and three of the four hosts were
missing. systems/races.js ports all eight RaceTemplates (art tables
GENERATED from the regular scheme because the Races enum is 1-based
while the art index is 0-based, then pinned against DFU's literals);
the paperdoll now loads the ENTITY's race/gender/face and reloads
when that identity changes, with armor/clothing archives taking the
race's body morphology instead of assuming Human; the flow gains RACE
and FACE screens; and systems/chargenSession.js gives all four hosts
one chargen - it had run only in the dungeon, so booting into a town
left the player on the pre-chargen entity for the whole session.
Probed + eyeballed: a Khajiit female Mage created in town, her
paperdoll drawn with the classic striped Khajiit face and female
body. Chargen ART, biography, reflexes and DFU's starting-equipment
roll stay FLAGGED.

S3d STARTING EQUIPMENT (2026-08-18): AssignStartingGear verbatim - the
INTERIM dagger retires. Gender-specific clothes (dyed, varied, and
WORN), a spellbook, the class weapon with its iron/steel choice, the
archer's extra axe and 24 arrows, a custom class's iron longsword, and
100 gold; DFU's PlayerTorchFromItems is ported but defaulted off as a
non-classic setting. The interim seed becomes the fallback only, and
finishChargen clears the bag first so a boot seed cannot leave a stray
dagger. Probed + eyeballed: the Khajiit Mage now begins dressed - real
classic shirt and trousers on the paperdoll, censor welds gone.

**2026-08-17d - the native-window UI parity audit (U8a/U8b/U8c).**
Triggered by Mac's third positioning catch in two days. Every drawn
element of the three native windows re-grounded line-by-line against
DaggerfallCharacterSheetWindow / DaggerfallTalkWindow /
DaggerfallInventoryWindow + ItemListScroller + ListBox. Findings
fixed + pinned: the trade scroller was MIRRORED even after hotfix 2
(itemListPanelRect (9,0,50,152) - buttons at x=9, the 9px rail is
the LEFT column with 16px arrows at y0/y136), stack counts moved to
FONT0004, talk topic rows corrected 9->7px (FONT0003 fixedHeight +
RowSpacing 0), conversation lines 8->11px (RowSpacing 4), the
question now renders DaggerfallQuestionTextColor light blue in the
player-says panel and answers DaggerfallAnswerTextColor, the NPC
name centres; the char sheet audited clean. Both probes re-run +
re-eyeballed. THE NATIVE-WINDOW RULE entered Process. See
`10-UI/UI-Arc.md`.

**2026-08-17c - the comprehensive audit of the guards/court/where-is
stretch (T3-touch, G1, G2, T3c).** Re-read the four slices line by
line against their DFU sources (SpawnCityGuards/SpawnCityGuard,
EnemyAttack's surrender interception, DaggerfallCourtWindow,
TalkManager's GetBuildingList/GenerateBuildingName pipeline), swept
the shared-seam laws, and re-ran every gate and live probe. FIVE
REAL FINDINGS, all fixed at root with pins:
(F1) THE SUBRECORD-BOUNDED POOL MERGE - DFU scans
SubRecords.Length entries of BuildingDataList, not all 32 header
slots; our merge iterated everything, so garbage named-type entries
past the subrecord count stole named-building pool draws and
misaligned every later name (live proof: three identical "Doctor
Rodynak's Herbs" alchemists became three distinct names post-fix).
(F2) THE STALE OVERLAY CALLBACK - townTalk's onClosed callback was
not cleared before firing, and chained windows assigned overlay
directly past it; a court verdict callback could re-fire on a later
unrelated window close. The callback now clears BEFORE it fires and
every chain routes through showOverlay.
(F3) THE DODGING TALLY - DFU tallies Dodging on EVERY resolved
enemy attack against the player (hit or miss); never tallied since
C8. Added at both resolution sites (dungeon foes + city guards).
(F4) THE SEEN-BY-GUARD MASS CONVERSION - DFU's non-immediate loop
puts `if (seenByGuard)` INSIDE the pool loop but OUTSIDE the
range/LOS gate: once any guard NPC sees the crime, every REMAINING
pool NPC converts to a guard (range, LOS, and guard-flag
irrelevant). We had converted only the seer. Preserved verbatim,
pinned.
(F5) THE RAW COURT MACROS - TEXT.RSC 8050 renders %pcn/%cri/%pen
literally on screen (the arrest probe caught it). Added the
CRIME_NAMES table + Penalty string (MacroHelper verbatim) and the
courtMacros expansion; %pcn's appositive collapses gracefully while
the player is nameless pre-chargen (chargen wiring FLAGGED).
Verbatim-confirmed clean: the court math line by line (the two
FailedRolls, the penalty clamp /40, the coin loop, the gold-capped
fine conversion, the plea formulas, THE NEVER-CHARGED VERDICT QUIRK,
execution unreachable), the guard-hit interception incl. the
fatal-blow forced surrender, the spawn constants/order (77.5 /
105.469-degree behind arc at 1/4 / the 2-5 ring / max 5), the
GiveUpTimer cadence (200 ticks, refill-on-detect, x3 for guards),
%ef's burned rand + %rt ruler titles, the palace dot-trim, the
compass bands, the ANSWERS_TO_DIRECTIONS table shape. Suite
437 -> 439 (the audit pins); whereIsProbe + arrestProbe re-run
green post-fix (distinct alchemist names; the full surrender ->
court -> prison -> release circuit with expanded court text).

**2026-08-17b - the comprehensive audit of the towns/talk stretch
(T1, T2, T3a, T3b).** Re-verified the three T1 town modules line by
line against their DFU sources (they were built from working digests;
the talk/faction slices were source-read at build time), swept the
host-parity seams, and re-ran every gate and live probe. SIX REAL
FINDINGS, all fixed at root with pins:
(F1) THE SELF-TARGET PLACE - InitMotor sets targetScenePosition =
transform.position; our place() left target at the origin, so a
politeness idle entered BEFORE the first seek resumed marching toward
world (0,0,0). place() now targets self with the -1 nav sentinel, and
_seek gained InitNavPosition's rederive-from-position.
(F2) THE N/S/E-ONLY BEST SCAN - DFU's downgrade-leave loop iterates
Enumerable.Range(0,3): West is NEVER evaluated as a best direction (a
DFU quirk, preserved 1:1; we had scanned all four).
(F3) THE TICK RESET - PopulationManager resets its timer to ZERO on
fire (at most one tick per frame, remainder dropped); our accumulator
burst-ticked on slow frames and could spawn a crowd.
(F4) THE SPAWN RANGE GATE - maxPlayerDistanceOutsideRect: no spawn
attempts unless the player is inside the location rect + 2500 classic
units (62.5); far streaming pixels now park at pool 0 (probed).
(F5) RANDOMISE-NPC PER SPAWN - identity re-rolls at EVERY spawn, not
per pool item: 1/32 spawns are GUARDS (texture 399, male, variant 0 -
guards never spawned before this audit), else the gender flip + one
of four outfit variants; recycled walkers come back as someone else.
The hosts re-point batch.archive per frame and resolve frameCount by
the LIVE archive (the creation-bound texture closure was stale).
(F6) THE UI PAUSE - DFU pauses the sim under UI windows; the
population now freezes (dt 0) while the talk overlay is up, so the
subject cannot walk away mid-conversation.
Verbatim-confirmed clean: tile weights/carve/row flip (TileTypes
enum exact), spawn probe semantics (uniform [-r,r], 11 attempts), the
anti-skate render gate, the promote/recycle gating incl. the 180-degree
half-plane math, MoveAnims records/flips/speeds and the 4-variant
outfit tables, idle 5 / guard 15, the politeness gate term for term
(inBeastForm live in both hosts since AUDIT 63 F46; it was N/A only
before Ledger V4 shipped the transformed host laws), the reaction
ladder + -20 edge, activation
distances, the pickpocket formula + outcomes (the CAUGHT path
witnessed live this audit: crime landed on the entity), FACTION.TXT
parse laws. Departures documented LOUD: pickpocket gold/nothing as
HUD lines pending the U-arc message boxes; DFU's dawn-churn
scheduleRecycle quirk on inactive items not reproduced (unobservable);
our release() clears both tiles where DFU leaks the spawn tile's
Occupied flag on recycle-before-first-move (kept - a DFU resource
leak with no gameplay signature). Suite 420 -> 428 (the audit pins);
all three live probes re-run green.

**2026-08-16f - the comprehensive audit of the P13..C10 stretch
(the post-16e day: stealth, rest, movement, sneak, the weapon rig).**
Re-verified the least source-grounded slices against DFU code (U7
was ported mid-session from working notes - it drew the findings),
swept the host-parity matrix and the day's dead code, and ran an
independent high-effort review over the unmerged diff. THREE REAL
FINDINGS + two review nits, all fixed at root: (F1) the REST
SUB-TICK LAW - DFU fires a sub-tick every waitTimePerHour /
minutesPerTick real seconds; the divisor is the CONSTANT 10, not the
6 ticks an hour takes, so a rested hour passes in 0.45s (loiter
0.75s) - the first cut divided by ticks-per-hour and rested ~1.7x
slow; quirk preserved verbatim. (F2) the rest PRE-gate used the
STRICT AreEnemiesNearby - DFU's dfuiOpenRestWindow uses the RESTING
variant (an unaware foe blocks only within 12 units), so ours
refused rest with any unaware foe anywhere in the 1024-unit spawn
band; now shares the hourly check's dep. (F3) the airborne 355 gate
lacked StartRestGroundedCheck's raycast fallback (grounded OR floor
within 0.2 below the feet - a near-ground levitator may rest); plus
the 0-HOUR QUIRK ported (DFU tests hoursRemaining < 1 only AFTER an
hour: resting 0 rests one full hour) and the empty-entry no-op.
Review nits: the 354 refusal's SetEnemyAlert leg ROUTED (no alert
state exists yet - fast travel pends), the grounded-ray constants
derived from CAPSULE_HEIGHT instead of hardcoded. Dead code swept:
the post-P14 latch.jump slots, the post-C10 swingSoundFor import.
HOST-PARITY MATRIX (the standing rule, all seams x all four motor
hosts): crouch/sneak/held-jump/fall-damage/weapon ALL COVERED; rest
is dungeon-only BY DESIGN for now (exterior/interior rest needs the
classic clock + vitals machinery those hosts do not own - recorded
residual, not a violation); breath/swim dungeon-scoped (exterior
water pends); paralysis dungeon-scoped (no effects tick outside).
Suite 389/86 green on real ARENA2 pre-commit.

**2026-08-16e - the pre-merge audit of the S18/S19/P12/A3 stretch
(7670dd5..HEAD).** Re-diffed every slice shipped on this lane since
the 16c audit against DFU source, swept the cross-cutting invariants
(host parity, roll orders, Dice100 semantics, save round-trips,
casterless levels), closed green on real ARENA2 (357/357) with BOTH
shot probes (dungeon ?foes + exterior) rendering. FOUR REAL
FINDINGS, fixed at root: (F1, the big one) the WALK-SPEED DRAG TERM
- DFU's GetWalkSpeed is (SPD + 150 - drag)/39.5 with drag = 0.5 x
(100 - max(30, SPD)); our P1-era walkSpeed dropped the term and the
player walked ~14% fast at SPD 50 ever since. The fix forced two
verbatim companions: the RUN base is UNDRAGGED (the old
walk-x-multiplier run only matched DFU because walk lacked its
drag - decoupled), and GetRunSpeed has a CROUCH branch (crouch base
x run multiplier - running while crouched is real in DFU; P12 had
crouch swallow run). Swimming inherits the fix through its walk
base, verbatim (LevitateMotor's GetSwimSpeed(GetBaseSpeed()) - no
run adjustment while swimming, confirmed). (F2) trap CastSpell
missiles ran at the PLAYER's level - DFU casterless bundles run
CalculateCasterLevel(null) = 1 for magnitude, duration AND chance;
they now carry casterLevel 1. (F3) the S19a paralysis input gate
also swallowed the crouch toggle - DFU's DecideHeightAction has no
paralysis check (FrictionMotor zeroes movement only); crouch stays
live while paralyzed in both dungeon hosts. (F4) host parity,
again: the two EXTERIOR walk motors (world.js walk mode,
exterior.js walk mode) never received P12's crouch input - the
standing per-host rule caught its third violation; both wired.
VERIFIED CLEAN (the negative results that matter): Dice100
semantics (Range(0,100) < chance) match our dice100 everywhere the
S18/S19 chance rolls ride it; the poison variant switch re-read
row by row (Range EXCLUSIVE-hi args, call order); the AssignBundle
gate order + AddState-first quirk pinned as shipped; the disease
FAT/SPL raw-units rule confirmed against DecreaseFatigue's default
multiplier; A3's clip ids/waits re-checked against the enum and the
serialized scene; exterior ambience sits BELOW worldModes' early
return (never plays indoors); the new save fields
(currentBreath, statMods maps, poison/paralyze entries) all
round-trip pinned. ACCEPTED STRUCTURAL NOTE (documented, not a
bug): our per-round pass runs diseases -> poisons -> other effects
as three walks where DFU interleaves by bundle assignment order;
per-round aggregates are identical, only intra-round side-effect
ordering differs, and no consumer observes it. The stale
"08-Audio not started" Home line and the P12 "crouch replaces
walk/run outright" prose corrected. Lesson, same as 16c but now
three-for-three: A SEAM SHIPS IN EVERY HOST THAT OWNS A MOTOR -
world.js and exterior.js walk modes are motors too, not just the
dungeon pair.

**2026-08-16c - the post-merge audit (parity pass + host-parity
sweep).** Full pass over the two-lane merge (`3f3d827`), closed green
on real ARENA2 (327/327). The merge reconciliation itself held: both
lanes' features verified present in the unified action runtime (spot
re-check: EntityEffectManager.HealAttribute's walk re-read whole and
matches S15's port exactly). THREE REAL FINDINGS, fixed at root:
(1) HOST PARITY - the world-scene dungeon mode (worldModes) never
wired P10's teleport warp or P11's swim/levitate/fatigue feed; only
the standalone ?dungeon scene did. A world-mode teleporter logged and
no-opped, and a world-mode dungeon SANK the player under water at
walk speed. Both hosts now install the same seams (the S8 slowfall
precedent - per-host wiring is a standing audit checkpoint for every
future scene-side seam). (2) The AttemptBash sound seam (onDoorBash)
existed unwired since the bash slice routed it to Audio; A2's engine
was already in place, so it now plays PlayerDoorBash (7) from the
door. (3) A dead export (DELEGATED_RELAY_FLAGS - declared, never
consumed) and a stale sink doc (restoreMagicka listed in applySpell's
contract after the S15 key fix removed its caller) cleaned. PARITY
EVIDENCE, new corpus gate: all 84 corpus teleporters probed
end-to-end - 82 resolve their destination through the P10 position
index; N0000003/W0000003 @23676 target an ACTIONLESS model, which
DFU's actionLinkDict (acting objects + editor flats only) also never
links - its Teleport delegate logs "can't teleport" exactly as ours
does. Kept bug-for-bug and pinned in dungeon.test.js. Open-flags list
regenerated (40 rows); Ledger and arc lines verified against the
merged code.

**2026-08-16 - the dungeon-parity + FP-viewmodel audit (Mac-directed).**
Full diff of the dungeon chain (layout, actions, doors, enemies,
lights, textures, water, triggers) against the DFU C# (sparse clone)
plus a pixel audit of the FP voxel pass. Verified clean, no change:
model matrices (T*Rz*Rx*Ry), texture tables (CLIMATE_INDICES
byte-exact), overlap removal incl. DFU's missing-block-origin quirk,
water Y, spawn, Hurt math, the trigger gate table, encounter tables,
light constants. ELEVEN real findings, all rooted and shipped:
(1) the FP viewmodel rendered ZERO pixels in every state and frame -
the P9 hole-fix constants overshot the whole rig out of the frustum;
probe-locked replacement (back 0.25, cast -0.20) via the new standing
tools/fpProbe.mjs. The before/after gallery is generated LOCALLY into
visual-changes/ and is gitignored - AUDIT 21 (doctrine F1) found it under
public/, which Vite copies into dist/ and deploy.yml publishes, and twelve of
its fourteen frames carried classic WEAPON*.CIF sprites.
(2) sampleClip takes SECONDS and all three pose paths passed a PHASE -
FP strikes lost their back half, enemy swings died at 40-66%, staggers
cut at a third. (3) pressing use CRASHED on any registered trap (effect
objects carry no cpu) - activationTargets is the single builder now.
(4) CastSpell never reset its 1000 cooldown - traps machine-gunned.
(5) chains died at every non-move/non-effect link: relays, chained
doors, the four door VERBS, special doors, and flat/marker actions all
now registered verbatim (locks carry VALUES; the IsLocked gate ships
with lockpicking as one Ledger unit). (6) nothing ever sent the Attack
trigger and doors could not be BASHED - the WeaponEnvDamage pass now
runs on the swing frame. (7) random enemies read GENDER bits out of
their slot byte (useGenderFlag is fixed-only). (8) playerLevel was
never wired into the encounter banding - stuck at 1 despite live
advancement. (9) collision triggers gated on position delta and missed
pushing into blocking WalkInto objects - input-held now, verbatim.
(10) ACTION_FLAGS lacked Unknown50/DoorText (Enum.IsDefined parity).
(11) layoutRdbBlock emitted a second, unconsumed lights array without
the *3 under a wrong "prefab-side" comment - collectDungeonLights is
the single source. Standing lesson, the third time now: **a pin
certifies what it pins** - the clip tests pinned seconds while every
caller passed phase, and the sweep that proved the viewmodel invisible
took one probe that nothing had ever pointed at the shipped surface. Older per-fix audits are consolidated into their arc
records; Home keeps the one-line pointer and the standing lessons.

**2026-08-14 - the post-ship audit (mobile/deploy/UI/A1).** Full
sweep of the week's shipped surface, closed green on real ARENA2
(293/293 - the corpus gates had been skipping since the enemyBasics
regeneration; this run re-proved them). Byte discipline: the A1 regen
diff verified semantically equal minus exactly the three sound
columns (62 entries). A1 vs source: SoundClips-as-record-index
confirmed (SoundReader casts the index straight through, divisor
1/128 matches), dungeon door clips 25/24 confirmed from the
serialized prefab, swing/hit tables and volumes re-checked. One real
find, fixed: AU2 - the 3D profile was one 40-unit linear panner for
everything where DFU is per-source (DaggerfallAudioSource min 1 /
max 500 logarithmic; enemy sources clamp at AttractRadius 16) - the
engine now defaults to the inverse/500 shape with per-call overrides
and every enemy-side call passes 16. The data diet's whole fetch
surface (literal + variable-name sites: HUD art, palette indirection
incl. MAP.PAL/NIGHTSKY.COL, NITE images, TEXTURE templates) passes
KEEP on both diets; SKY-on-lean is the designed gradient. (AUDIT 18
correction: NIGHTSKY.COL really is fetched - scenes/shared.js:62 loads
it through `img.paletteName` - but MAP.PAL is NOT. Its only namer is
ImgFile.paletteName for TMAP00I0.IMG, and the one loader of that file,
chargenArt.js loadOne, draws it with the shared ART_PAL and never
re-palettes. MAP.PAL belongs to the diet's KEEP list, not to its
VERIFIED-FETCHED list, until the re-palette loader lands.) The
letterbox offset has exactly one caller pair (set + finally-reset).
Three stale Ledger C rows pruned with shipped evidence (enemy AI,
dungeon loot, Hurt/CastSpell traps - Poison stays routed). Lesson:
after any generated-file change, the ARENA2 suite must run BEFORE the
commit ships, not at the next audit - bare-suite green hid zero
defects this time by luck, not design.

**2026-08-13 - the DFU parity audit (F1-F17).** Full sweep of every
1:1-claimed surface against the DFU C# (sparse clone), baselined and
closed green on real ARENA2 (288/288). Twelve behavioral parity
breaks found and rooted, all in COMBAT/SYSTEMS - the corpus-gated
formats/world layers held clean. The big four: the to-hit chain was
missing CalculateAdjustmentsToHit entirely (the flat -50 on every
attack and the +40 vs monsters - F1), monster weaponless attacks ran
the H2H skill formula instead of the basics multi-attack loop with
the DFRandom reflex gate (F2), weapon material to-hit (x10) never
landed (F3), and continuous effects held a once-rolled save instead
of DFU's fresh roll every magic round plus the initial round firing
AT CAST (F10/F17). Also fixed: duration multiplier min-1 clamp (F11),
incumbent re-casts STACK rounds (F12), permanent-vs-live stat
sourcing both directions (F8 level-up HP / F9 saving throws), all 8
career stats on enemy entities (F14), additive bonus+phobia bits
(F16), mastered-skill re-eval per raise (F7). Latent-only: the
leather weight int-div shape (F13 - converges on every classic
template). Routed to Ledger C: enemy spellcasting (F15), OnMonsterHit
riders, the enchantment to-hit channel (F4), armor-value effect
modifiers (F5). Standing lesson, again and sharper: **a pin certifies
what it pins** - seven suite tests were green on the broken shapes
(the "ONCE-rolled save" test literally named the bug); porting a
function without diffing its CALLERS (CalculateAttackDamage's monster
branch, AssignBundle's initial round) is how whole control-flow limbs
go missing while every leaf tests green.

**2026-07-07 - the live-play hardening arc (P9).** The deployed build
was played against real ARENA2 for the first time and a run of bugs
surfaced that the unit gate is structurally blind to. All fixed and
rooted; the full blow-by-blow (boot/build crashes, spawn placement,
pointer lock, the g:0 grounding knife-edge, the SKIN-shell stair
regression, and the FP-viewmodel "hole") lives in
`03-World/Player-Arc.md` under P9, with the S2 blocks-binding
correction in `06-Systems/Systems-Arc.md` S2. Two standing rules came
out of it and hold for all future work:
  1. **Unit-green is not playable-green.** The suite passing does not
     mean the game runs; several "root fixes" this session were real
     bugs but not the reported one, and the true cause (the FP camera
     rendering inside the player's own body) was visible in the first
     screenshot yet missed for a dozen commits. A change to
     live-executed code is unverified until it is actually played.
  2. **Read what is on the screen before theorizing about what is
     behind it.** Mac diagnosed the decisive bug from one look; the F8
     debug HUD (build tag, feet, markers, lock, motor, raw input) now
     exists so evidence, not theory, drives the next fix.

**2026-07-07 - the crash-class audit (no-undef joins the gate).** Mac's second live crash (Y1@407:239805) mapped through the
deterministic bundle to characterSprite.js:57 calling trs() WITHOUT
importing it - unbound since C8 E3d; vite emits unknown identifiers
as presumed globals, so node --check, the build, and the headless
suite all pass while the first real viewmodel frame throws
ReferenceError. THE CLASS IS NOW CLOSED: eslint (flat config,
browser globals) with no-undef runs FIRST in npm run check. The
sweep found and rooted every member: trs (the crash - imported),
FLASH_TYPE_KEY in the rewrite/ bench (a real unexported constant -
exported + imported), and quadInto in pieces/draped.js (a phantom
helper UNBOUND FOR THE FILE'S WHOLE LIFE - the cloth tests exercise
drapedGrid, never the faces path; now defined in the pieceLoft face
convention). ONE MISREAD, owned: interleaved grep output made
draped.js look like a dead orphan with unresolvable imports and I
git-rm'd a LIVE tested module - the suite caught it in the same
gate run and it was restored + root-fixed instead. createImageBitmap
joined the config globals; the two 'unexpected token with' parse
errors were import attributes, fixed by ecmaVersion latest.


**2026-07-06f (Mac): deep audit + bible update, S5/bows/triggers
sweep.** Suite 249/60 green, build clean, manifest MATCH both
directions, git clean pre-audit. One GENUINE GAP in the Combat
COMPLETE claim found and closed: MOVERS carried no AABB, so classic
step-on platforms (Collision01 elevators) could not
collision-trigger - movers now carry their AT-REST bounds and the
trigger pass tests them only while parked at 'start' (the static
bounds are truthful exactly when the step matters; mid-flight rides
do not re-trigger, matching classic). A dead always-truthy guard
(SKILLS &&) cleaned. KNOWN DEBT recorded: dungeonContext has grown
to ~770 lines absorbing foes + missiles + arrows + casting +
triggers - a future combat-scene extraction is queued as debt, NOT
churned blind under audit. Ledger regenerated (06f).


**2026-07-06e (Mac): deep audit + bible update, S4 sweep.** Suite
245/59 green, build clean, manifest MATCH both directions, git clean
pre-audit. Fixed at root - one class, five sites: the S3/S4 slices
had re-introduced DYNAMIC imports of statically-imported modules in
dungeonContext (shared.fetchBytes, ClassFile, loot.js twice,
magicDef alongside its own static) plus foeDeps still bagging
ClassFile/generateItems/fetchBytes dynamically - exactly the
double-sourcing class audits 06c/06d killed; every site now rides
the statics (7 dynamics remain, all genuinely lazy foe-path deps).
A dead missile field (m.half) dropped. The loot magic-item registry
documented as single-active-context by design. Home's Systems and
Combat lines refreshed (S4 complete; CastSpell shipped). Ledger
regenerated (06e).


**2026-07-06d (Mac): deep audit + bible update, S3/S3b sweep.** Suite
236/56 green, build clean, manifest MATCH both directions, git clean.
Fixed at root: (1) COHESION - the skills MODEL (SKILLS enum,
WEAPON_SKILL, skillValue, tallySkill) lived in chargen.js while three
modules imported entity-layer concepts from creation logic; extracted
to systems/skills.js and every importer (formulas, advancement,
dungeonContext, both tests) moved to the real home - a first-cut
re-export shim was itself removed as a band-aid. (2) TRUTH -
playerEntity's header still said chargen pends the Systems arc;
rewritten (chargen exists; the initial values are the pre-boot state
only). (3) STALE - the Systems-Arc queue still listed shipped S3; the
Home Systems line said 'Next: S3'. Ledger regenerated (06d). No raw
flat-skill reads bypass skillValue (grep-verified).


**2026-07-06c (Mac): deep audit, all changes since 06b.** Suite 230/54
green, build clean, manifest math verified BOTH directions (doc rows
== real files, doc total == real tests). Fixed at root: (1) the
verbatim treasure DATA (archive 216, icon table, marker record 19,
the 19-row dungeon-key table) lived in a SCENE file - moved to
systems/loot.js, its DFU-shaped home; rdbLayout's 216 now imports the
single source (cycle-checked through the full suite). (2)
dungeonContext double-sourced floorLanding + playerEntity (static
imports AND the foeDeps dynamic pair) - dynamics dropped; an unused
LOOT_MATRICES import dropped. (3) window.__player was written from
SEVEN sites AND collided with the probe scenes' motor-snapshot
global of the same name - the entity surface is now surfacePlayer()
writing __playerEntity (one site, no collision). (4) Home.md's S1
status line had landed inside the DIRECTORY list; the Active-arcs
section lacked Combat and Systems lines and carried stale Player/
Rendering tails - section rewritten to truth. Ledger regenerated.


**2026-07-06 (Mac): comprehensive audit, engine included.** Suite
211/47 green, build clean, manifest cross-checked. Findings fixed at
root: (1) ENGINE - the character-sprite RT cache keyed on exact
(pw, ph) and reallocated FBO+texture+renderbuffer every frame per
character once foes at differing distances shared it; now ONE fixed
CHAR_SPRITE_RT_SIZE (256) target, sprites render into a viewport
sub-rect, the quad samples the scaled UV extent, full-target clear
keeps out-of-rect transparent (NEAREST boundary bleed discards).
(2) SINGLE-SOURCE - CLASSIC_UPDATE_INTERVAL was defined in both
weaponStates and enemyMotor (same GameManager.cs:42 value); enemyMotor
now imports + re-exports. Enemy capsule-height defaults were literal
1.8s; now CAPSULE_HEIGHT from the motor. exterior.js carried a dead
`ortho` import after the sprite-pass extraction. (3) The Open flags
ledger above was generated and pinned. Stale docs refreshed (this
file's arc line, the C8 records).
