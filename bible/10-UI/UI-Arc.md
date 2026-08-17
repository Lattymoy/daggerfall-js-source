# UI-Arc (ACTIVE)

Opened 2026-07-06 after Combat completed. Goal: the classic
Daggerfall UI over our WebGL2 frame - HUD first (the Systems stats
exist, nothing shows them), then the paper windows (chargen, char
sheet, inventory, spellbook) that retire the headless interim
policies one by one.

## U1 (classic HUD - vitals + compass): SHIPPED

The renderer gains ONE screen-space primitive: drawScreenQuad -
positioned pixel-rect destination (top-left origin), source-UV
window, textured (0.5 alpha cut) or solid color; depth off, NEAREST.
src/ui/hud.js is the verbatim DFU-fullscreen HUD: vitals
bottom-left from the classic bar art (MAIN03I0 health / MAIN04I0
fatigue / MAIN05I0 magicka), each cropped BOTTOM-ANCHORED by
current/max (the VerticalProgress shape; fatigue draws FULL,
FLAGGED - the stat pends); the compass bottom-right - COMPBOX frame
over a 64px window into COMPASS.IMG scrolled by trunc(258 x
heading01) (nonWrappedPart; the strip's tail duplicates its head so
scroll 257 + 64 = 321 < 322, no runtime wrap - pinned). Integer
scale floor(canvasHeight/200), min 1, keeps the art crisp. Indexed
IMG pixels convert with the classic index-0 transparency and ride
renderer.uploadTexture under img/name keys. Heading derives from
the view forward the file already uses (0 = +z, wrapped). Art-gated:
absent IMGs disable the HUD loudly. Review catch IN-SLICE: the new
static ImgFile import double-sourced against foeDeps' dynamic - the
06e recidivist class, caught before commit this time.

## U2a (classic text - the FNT reader + drawing): SHIPPED

formats/fntFile.js is the verbatim FNT reader: header {fixedWidth,
fixedHeight u16}, 240 glyph entries {dataOffset, width u16}, 32-byte
glyphs of 16 rows x 2 bytes - with the source's L/R HALF SWAP (the
left 8 pixels come from the ODD byte, the right 8 from the EVEN, each
expanding MSB-first) pinned on crafted bytes. ui/text.js builds ONE
white 256x240 atlas per font through the existing uploadTexture and
draws through drawScreenQuad with per-call tint - one atlas serves
every classic text color; DaggerfallFont's rules carried (glyph =
code - 33, sub-33 codes advance a fixedWidth space, classic 1px
spacing, integer scale). Live consumer NOW (infra never ships dead):
the HUD shows the readied spell name + cost in FONT0003 above the
vitals - the U4 spellbook window replaces it. Review catch: the font
load was written as dynamic imports IN THE SLICE AFTER the 06e class
was caught in-slice - rooted static before commit; the pattern's
pull is real and the audits keep earning their keep.

## U2b (the chargen flow): SHIPPED

ui/chargen.js: name -> gender -> class (all 18 careers loaded from
their CLASS*.CFG, names from the files) -> stats -> skills -> done,
with the pool rules VERBATIM from the rollout components: stats +
blocked at MaxStatValue 100 or pool 0, - blocked at the ROLLED value
(points return); skills + blocked only at the group pool, - blocked
at the rolled value; both screens REROLL (the components' own);
confirm gates on pool == 0 (all three groups for skills). The
Warrior-16 default is GONE - no ?class and no chargenDone runs the
flow; ?class=N remains the headless skip (rolls + the loud
lowest-first policy, which now serves ONLY that path and the tests).
systems/chargen.js split at root: applyCharacter takes FINISHED
values (the flow's hand distribution or the headless roll) and owns
the health/magicka/sum derivations ONCE; gender lands on the entity
(clothing loot consumes it). Hosts pause gameplay while the overlay
is active (standalone keeps its RAF alive - a plain return would
have killed the loop, caught in review) and route a small key map;
no font art falls back to the headless roll LOUDLY so the game
stays playable without ARENA2 UI art. Screens are clean classic-text
panels; the classic background ART is FLAGGED pending art-name
verification against real ARENA2 (Mac signs off visuals).

## U3 (level-up screen + char sheet): SHIPPED

The headless auto-apply is RETIRED on the UI path: raiseSkills gains
an onLevelUp sink - with it, ready/pending set and NOTHING applies
until the screen confirms; without it (tests, headless runs) the old
immediate apply stands. applyLevelUp is the single application
(HP roll + the 4..6 pool handed to a distribute hook) - the U3
screen distributes BY HAND through the SAME verbatim clamps chargen
exports (max 100, pool 0, floor at the pre-level value), confirm
gated on pool 0, idempotent after. The char sheet (classic F5) is
the read-only page: name/class/level, HP/MP, the eight stats, skills
by career group - live values. ONE GENERIC OVERLAY SEAM replaced the
chargen-specific host wiring (uiOverlayActive / overlayInput /
drawOverlay serving chargen, level-up, and the sheet - a root
refactor, not a third copy); font-less environments fall back
LOUDLY (chargen -> headless roll, level-up -> headless apply, sheet
closes). Classic INFO background art FLAGGED pending art-name
verification. Review catch: the first font-less branch was
convoluted nonsense and was rewritten sane before commit.

## U4 (inventory + spellbook + death): SHIPPED

ONE PLAYER-DAMAGE DOOR first: hurtPlayer consolidates the four
scattered health-decrement sites (trap sink, enemy melee, enemy
arrows, trap-spell missiles) - floors at 0, surfaces, and opens the
DEATH SCREEN at 0 (Enter restarts by reload; save/load pends
Systems). INVENTORY (classic F6): the player's items with stacks +
the quantized weights and total; Enter on a Weapons item EQUIPS it
through a scene callback - ?weapon is retired as the only path
(loot a bow, use it); arrows refuse equip; drop/use pend.
SPELLBOOK (DFU-default Backspace): the KNOWN list - the entity's own
spells when present, else the INTERIM loud fallback of the file's
ranged damage spells (classic starting-spell sets replace it when
their data lands); Enter readies - ?spell retired as the only path.
Both ride the U3 overlay seam; keys route in both hosts BELOW the
overlay branch so Backspace still edits the chargen name. Windows
close on ESC. Backgrounds FLAGGED as U2/U3.

## U5 (HUD popup text): SHIPPED

ui/hudText.js is the classic bottom-center message queue
(AddHUDText shape): newest-last, 4-line cap, ~2s per line with a
0.4s fade, drawn just above the vitals in classic text. SEVEN
consumers wired in the scene: pickup ('You take N items.'), skill
raises ('Your X skill has improved.' - the classic phrasing),
level-up ready, self-cast healing ('You are healed N points.'),
weapon equip, spell readied. The literals are honest stand-ins:
TEXT.RSC is FLAGGED - the real records swap in when that reader
lands. The scattered 'feedback pends UI' flags retire.

## TEXT.RSC (the reader): SHIPPED

formats/textRsc.js ports TextFile.cs verbatim: header
TextRecordHeaderLength u16, RecordCount = headerLength/6 - 1, record
headers {id u16, offset u32}, records raw to AND INCLUDING the 0xFE
terminator (GetBytesById's own shape). The Formatting enum's defined
members carried; plainText() flattens faithfully for message
consumers - chars pass, NewLine, SubrecordSeparator splits VARIANTS,
FontPrefix/PositionPrefix each consume their ONE operand byte (so
printable operands never leak into text - pinned), every other
control drops. Full token semantics (positioning, fonts, pages) pend
the book/scroll renderers. CONSUMERS WIRE PER-ID: each U5 literal
swaps only when its classic record ID is verified against DFU usage
- no guessed IDs; the literals stand until then.

## The input map: SHIPPED

ui/input.js owns every binding: overlayAction (the chargen/window
key table - previously DUPLICATED verbatim in both hosts) and
gameAction (F5 sheet, F6 inventory, Backspace spellbook - the
classic/DFU defaults; C cast is OURS, flagged in the one place it
now lives, click-to-cast queued). routeKey routes one keydown with
overlay precedence (Backspace edits a chargen name, never opens the
spellbook mid-flow - pinned) and returns consumed so hosts
preventDefault exactly when something fired. BOTH hosts collapsed
their if-chains + duplicate routers onto it; the scattered 'input
map pends' flags retire.

## Click-to-cast: SHIPPED (+ an S9 fidelity fix)

The classic shape lands: READYING a spell from the spellbook ARMS
the next attack-click - the RMB press CASTS along the look instead
of starting a swing (a OneShotLatch in ui/input.js, pinned:
unarmed nothing, fires once, double-arm single fire; the pending
cast resolves in the frame where eye + view exist). After the cast
the latch is spent and clicks swing again; the readied spell
persists as our lastSpell equivalent - C recasts it directly (the
RecastSpell convenience). FIDELITY FIX FOUND IN THE SOURCE while
verifying: CastReadySpell aborts a ByTouch cast BEFORE
DecreaseMagicka when no target sits in touch range - the S9 'spends
on a whiff' rule was WRONG and dies: touch whiffs now refuse
without spending, verbatim.

## Live-play fix (2026-07-07): the standalone spawn

Mac's first live run spawned wedged - the standalone host put the
CAMERA (the eye) at the RAW start marker, leaving the feet ~1.5
units under the floor inside the under-geometry shaft; 'only look
up and down' was the shaft's walls, one bug wearing two symptoms.
worldModes carried the verbatim spawn (MovePlayerToMarker + up *
0.6h + the FixStanding floor snap) inline; the standalone predates
it and never got the lift. ROOT: ctx.startSpawn() now owns the
verbatim placement ONCE (the context has the marker and the
collider) - both hosts consume it, the inline copy and a dead
binding died.

## Live-play fix II (2026-07-07): overlays now HOLD the world

Mac reproduced the wedge post-spawn-fix - because the spawn was
never the (only) culprit: BOTH hosts ran LIVE MOVEMENT under the
chargen overlay. The keys Set feeds the motor while typing - a name
containing w/a/s/d walks the player, and by skills-confirm the
character has drifted off the start ledge into a pit ('spawned in a
hole', yaw showing shaft walls). The overlay gate only ever skipped
foes/water. ROOT: overlays hold the world everywhere - the
standalone gates actions.update + both movement branches on
uiOverlayActive; the world/exterior shells gate their motor on
modes.dungeonCtx.uiOverlayActive. Plus a [spawn] diagnostic line
(marker -> feet, 'startSpawn build' tag) so console pastes
self-identify the running bundle.

## U6 (the action text boxes - ShowText / ShowTextWithInput / DoorText): SHIPPED (2026-08-16)

The Ledger C row (with its Systems half - the TEXT.RSC database goes
LIVE in the dungeon context). Verbatim from DaggerfallAction's text
delegates:

- **ShowText (0x0b)**: TEXT.RSC record Index + 8600 in a
  click-anywhere-to-close box on the overlay seam (the world holds).
- **ShowTextWithInput (0x0c)**: record Index + 5400 with the 20-char
  ' > ' entry (DaggerfallInputMessageBox shape; digits joined the
  overlay char map - the blind-god answer is "1"). The verbatim
  actionTypeTwelveLookup answers (5404/5406/5423/5424/5464) gate the
  chain: Play SKIPS the up-front cascade for this flag and only a
  case-insensitive match fires ActivateNext - the classic riddle
  doors work end to end.
- **DoorText (0x63, joins ACTION_FLAGS)**: first activation shows
  record Index + 7700 as HUD text (2.0s) and HOLDS the door (the
  Open() special gate, verbatim including the Receive trigger-gate
  interplay for Direct/MultiTrigger-flagged doors); the patch table
  rides along (7701..7704 -> 7705, the known-missing ids skip);
  later activations run the classic trespass check (axisRaw > 5 ->
  MakeEnemiesHostile - logged loudly here: our live foes are already
  hostile-on-sight, passive teams pend the faction model).
- Presentation: clean classic-text panels (ui/actionText.js), art
  FLAGGED with the other windows. A missing TEXT.RSC record logs
  loudly where DFU throws (the crash-class doctrine).

1 net test (action.test.js 5 -> 6). Suite 313/75, ARENA2 corpus
313/313 green pre-commit.

## Queue
- Classic window art, per-ID TEXT.RSC verification (the database is
  now LIVE via U6; the id sweep remains).
- Starting-spell sets: SHIPPED via Systems S6 (the spellbook lists
  the character's real known spells).

## U7 (the rest window): SHIPPED

The classic rest flow, consuming the S20 rates - recovery finally
has its front door. Ported from DaggerfallRestWindow's rules (the
panel is the U-arc's clean text idiom; backgrounds stay FLAGGED
pending art-name verification):

- **The session machine** (systems/restSession.js, pure + pinned):
  an hour of rest passes in 0.75 REAL seconds (loiter 1.25),
  advanced in six 10-classic-minute sub-ticks so world time - magic
  rounds, diseases, poisons, the once-per-change fatigue drain -
  flows through the rest exactly as RaiseTime does. Each completed
  hour: the RESTING enemies check breaks on TEXT.RSC 354 (an aware
  foe at any spawn-band range, an unaware one only within the
  12-unit resting distance - the P13 senses fields again); then
  vitals tick for timed/full rest (the three S20 per-hour rates +
  a Medical tally; loiter recovers NOTHING) and completion lands -
  full rest ends when fully healed (health AND fatigue full,
  magicka full or NoRegenSpellPoints; 350 "You are healed.", and
  instantly when starting already healed), timed on 353 "You wake
  up.", loiter on 349. Death mid-rest (disease/poison through the
  raised hours) ends at once - the death screen owns that flow
  (DFU's "You never awaken." line rides it).
- **The window** (ui/restWindow.js): selection (rest a while /
  until healed / loiter) -> an hours prompt for the timed modes
  (loiter refused above the classic 3-hour cap with the
  cannot-loiter lines) -> the running page (hours passed + live
  vitals; Escape ends with the mode's finish text) -> the
  click-to-close end box. THE WORLD RUNS UNDER THE OVERLAY - foes
  keep moving while the player rests and genuinely break it.
- **The key + gates**: KeyR (the DFU default) through the input
  map; pre-rest gates in the classic order - enemies nearby (354),
  swimming or airborne (355 "You cannot rest now.", the motor's
  live grounded flag). Building trespass/rent rules pend towns;
  the DFU rest-encounter spawns pend the spawn machinery.

3 tests (restwindow.test.js). Suite 366/83, ARENA2 corpus
pre-commit.

### U7 correction (2026-08-16f audit)

Three parity fixes against DaggerfallRestWindow/DaggerfallUI read
line-by-line: (1) the sub-tick interval is waitTimePerHour /
minutesPerTick VERBATIM (the divisor quirk - an hour rests in 0.45
real seconds, loiter 0.75; the shipped cut divided by ticks-per-hour
and rested ~1.7x slow); (2) the pre-gate's enemy check is the
RESTING AreEnemiesNearby(true) variant, shared with the hourly break
dep (the shipped strict variant refused rest with any unaware foe in
the spawn band); (3) StartRestGroundedCheck's raycast fallback lands
(grounded OR floor within 0.2 below the feet - near-ground
levitators may rest), derived from CAPSULE_HEIGHT. Plus the 0-hour
quirk (resting 0 rests one full hour) and the empty-entry no-op.
ROUTED: SetEnemyAlert on the 354 refusal (no alert state yet);
DFU's youNeverAwaken death text still defers to our death screen
(documented departure); TEXT 26 (>99 hours) is enforced silently by
the 2-digit entry field.

## U8a (2026-08-17): THE NATIVE PANEL - real classic art begins SHIPPED

Mac's call: import the real Daggerfall menus/artwork. The IMG/CIF
readers and all 333 UI art files were already in hand; this slice
lays the foundation and retrofits the FIRST window.

- ui/nativePanel.js - DFU's NativePanel semantics: every classic
  window authors in VIRTUAL 320x200 pixels; the screen mapping is
  integer scale (min 1) + centered letterbox (the hud.js law).
  loadImg (one IMG -> texture + size, deps-injected like loadHud),
  drawImg/drawRect through the mapping, shadowText = DFU's
  AddDefaultShadowedTextLabel (color 243,239,44 / shadow 93,77,12
  at +1,+1 virtual px, verified against DaggerfallUI.cs), SCREEN_DIM
  behind modals, pointToNative for touch hit rects.
- THE CHARACTER SHEET retrofit (the first native window):
  INFO00I0.IMG with DaggerfallCharacterSheetWindow's verbatim label
  geometry - name (41,4) race (41,14) class (46,24) level (45,34)
  gold (39,44) fatigue/64 (57,54) health (52,64) encumbrance (90,74)
  = carried template weight + gold at 0.0025/piece over
  floor(Str*1.5) (FormulaHelper.MaxEncumbrance) - and the 8 stats
  centered in 28-wide panels at (141, 17+i*24). Keys 1-4 pop the
  skill groups as interim text panels (the classic BUTTON popups'
  function); art-less falls back to the old text page (never traps).
- HOST RULE: F5 opens the sheet in BOTH exterior hosts now (it was
  dungeon-only), routed through the townTalk overlay seam
  (isChoiceWindow = raw codes); the dungeon keeps toggleCharSheet
  with a lazy preload; both hosts warm INFO00I0 at boot.

FLAGGED loud: the PORTRAIT (200,8) pends chargen faces; the
level-up screen + every other window stay on the text idiom (one
window per U8 slice: trade/inventory/talk/rest/chargen queue); the
classic buttons draw from the ART (no click/touch rects yet -
pointToNative is ready for them); interior-mode F5 pends worldModes
key routing.

Probed live + EYEBALLED (the doctrine): the real stone page renders
with every label in its engraved field - "RACE: Breton, LEVEL: 1,
FATIGUE: 50/50, ENCUMBRANCE: 0/75", stats in their boxes (the 0s
are the honest pre-chargen interim entity), the portrait window
showing the page art; Digit1 pops the skill panel; F5 toggles
closed. Suite 452/99.

## U8b (2026-08-17): THE NATIVE TALK WINDOW SHIPPED

The second native window - and the most-seen screen in the game:
TALK01I0.IMG replaces the interim ChoiceWindow talk chain in BOTH
exterior hosts (art-less sessions keep the chain - never trap).

- ui/nativeTalk.js: DaggerfallTalkWindow's verbatim geometry as
  TALK_RECTS - the button column (Tell me about 4,4 / Where is 4,14
  / Location 4,26 / People 4,36 / Things 4,46 / Work 4,56, all
  107x10), Okay (4,186), Goodbye (118,183,67x10), the topic list
  (6,71,94x104) at 9px rows, the conversation panel (189,65,
  114x126) wrapped + bottom-anchored, the NPC name strip (117,52),
  the tone radios (258,18/28/38,6x6). The button LABELS are baked
  in the art - DFU overlays invisible hit rects and so do we.
- POINTER ROUTING lands: townTalk.pointerdown maps canvas clicks/
  taps through pointToNative to the window's hit rects, called by
  both hosts BEFORE requestLook (a consumed click never grabs
  pointer lock) - the phone's tap path and the desktop's mouse path
  are the same seam. The session's keyboard accelerators stay: W
  opens Where-is>Location, T cycles tone, digits pick rows, N/P
  page, Esc/E goodbye.
- The session pipeline is UNCHANGED underneath: the same
  categories/directory, answerText (extracted, shared with the
  fallback chain), the T3e knowledge roll, the T3f toned tiers -
  answers append to the conversation history as classic does.

FLAGGED loud: the TFAC portrait pends faces (the art's frame
shows); the TALK02/03 tone-highlight art pends (an interim yellow
mark fills the active radio); People/Things/Work + Tell me about
are hit-consumed no-ops pending their topic sources; the scroll
arrows ride their rects (no INVE06/07 arrow art yet).

Probed live + EYEBALLED: the full classic screen - every baked
button label under its rect, the NORMAL radio marked, the three
alchemists in the topic list (long names truncating at the list
edge), "People of Daggerfall" on the name strip, the greeting +
answer in the conversation panel; the whole circuit driven by MOUSE
CLICKS (Where is -> category -> building -> answer -> tone radio ->
goodbye). Suite 454/100.

## U8c (2026-08-17): THE NATIVE TRADE WINDOW + ITEM ICONS SHIPPED

The third native window - the E2/E3 shop loop on the classic
inventory screen, and the slice that brings ITEM ICONS online (the
capability the inventory window will reuse).

- THE ICON PIPELINE: itemTemplatesData regenerated with
  worldTextureArchive/record per template (the extractor gains the
  fields); icons are plain TEXTURE.### records through the EXISTING
  pipeline (getTexture + uploadRecord), warmed lazily per drawn
  item with the native size captured at warm (the GL handle carries
  no dimensions). Material-DYED weapon/armor icon variants FLAGGED.
- ui/nativeTrade.js: INVE00I0.IMG base + INVE08I0.IMG buy-mode
  action panel at (222,10) + SHOP00I0.IMG cost strip at (49,13)
  with cost/gold labels at +28/+68 (all verified against
  DaggerfallTradeWindow - the FIRST guess TRAD00I0 does not exist;
  the probe caught it). The classic vertical item lists: local
  (163,48,59x152) = the player's shop-accepted sellables, remote
  (261,48,59x152) = the open shelf, four 38px slots each with real
  icons + name/stack labels, 12px top/bottom scroll bands.
- THE TRADE MODEL this slice: clicking a remote item BUYS it
  (doBuy - the E2/E3 transaction core extracted and shared with the
  keyed fallback), clicking a local item SELLS it (onto the shelf,
  buy-backs work); the cost strip shows the last price + live gold;
  Exit/Esc/E close; digits buy visible slots. worldModes gains
  pointerdown (the townTalk shape) and the hosts route it before
  requestLook - interior native windows own the pointer.

FLAGGED loud: the BASKET + mode-action flow (DFU accumulates then
Buy), wagon/info/select/steal consumed no-ops, the sell-mode INVE10
panel art, tab filtering, the paperdoll, scroll-arrow art.

Probed live + EYEBALLED: the full classic screen - the tabs and
jewelry slots of INVE00I0, WAGON/INFO/SELECT/STEAL/BUY/CLEAR/EXIT
on the action panel, COST:0 / 20000 on the strip, and THREE REAL
BOOK ICONS on the shop list; a remote click bought at 3129 (the
book crossing to the local list), a local click sold back at 2968,
Exit closed. Suite 455/101.

### U8c HOTFIX (2026-08-17, Mac's catch): upside-down item icons

The shelf books rendered INVERTED: record textures store BOTTOM-UP
rows (baseImageFile.getColor32 keeps DFU's verbatim GL flip for the
mesh/billboard path) while drawScreenQuad samples v0 at the TOP -
the two paths' V conventions differ, and the icons were the first
record-textures drawn through the screen-quad path. The icon draw
now passes a V-flipped source rect ({v0:1, v1:0}), pinned in
nativetrade.test.js. THE STANDING NOTE for future native windows:
IMG art through loadImg/uploadTexture is top-down (draw plain);
RECORD art through uploadRecord is bottom-up (draw V-flipped).
Suite 456/101; the probe re-run + re-eyeballed - books lying
right-side up.
