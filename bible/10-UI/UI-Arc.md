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

### U8c HOTFIX 2 (2026-08-17, Mac's catch): icons/text spilling the cells

The list cells were free-styled (59-wide centring, 1.5x upscale, a
name label) and the icons spilled over the art's slot frames. The
VERBATIM ItemListScroller law now stands: four 50x38 item BUTTONS
at x0 of the scroller (the right 9px is the scroll strip - its top
half scrolls up, bottom half down, and it never trades), icons
ScaleToFit with MaxAutoScale 1 - NEVER upscaled - centred in the
button both axes, and the ONLY cell text is the stack count at the
button's top-left when stackCount > 1 (classic lists draw NO item
names - names ride the info/tooltip seam, FLAGGED). Pinned (the
cell metrics, the no-upscale/centring draw, the strip-vs-pick
split). Suite 457/101; re-probed + re-eyeballed - every book
centred inside its own frame.

### AUDIT 17d (2026-08-17, after Mac's third catch): the UI parity audit

Three native-window positioning defects in two days ("dude. come on
how hstd is it to have parity with dfu and positioning") meant the
windows were built from MEMORY of DFU, not from its source. This
audit re-grounded EVERY drawn element of all three native windows
line-by-line against DaggerfallCharacterSheetWindow /
DaggerfallTalkWindow / DaggerfallInventoryWindow + ItemListScroller
+ ListBox. Findings, all fixed + pinned:
- TRADE (the big one): even HOTFIX 2 had the scroller MIRRORED.
  itemListPanelRect is (9,0,50,152) - the four 50x38 buttons sit at
  x=9 and the 9px scroll rail is the LEFT column: up arrow
  (0,0,9,16), down arrow (0,136,9,16), scrollbar (1,18,6,117)
  between. Rail clicks scroll (arrows one slot, the bar pages);
  they never trade. Icons centre in the BUTTON at x9.
- TRADE stack labels: FONT0004 (DFU's Font4 for stack counts), not
  the default FONT0003 - preloaded with the art.
- TALK topic rows: 7px verbatim (ListBox row height = FONT0003
  fixedHeight 7 + RowSpacing 0), not the 9px guess; TOPIC_ROWS
  derives (104/7 = 14 visible rows).
- TALK conversation lines: 11px (RowSpacing 4), not the 8px guess.
- TALK colors: questions render DaggerfallQuestionTextColor
  (0.698,0.812,1) in the PLAYER-SAYS panel (123,8,124,38) - the
  panel was drawn empty before; answers render
  DaggerfallAnswerTextColor (227,223,0), not the default yellow.
- TALK NPC name: centred in its 197-wide panel
  (HorizontalAlignment.Center), not left-aligned.
- CHARSHEET: audited clean - every label already on its verbatim
  DFU coordinate.
Both probes re-run + re-eyeballed: books inside their frames with
the left rail clear, the light-blue question over the yellow
conversation, the centred name. Suite 457/101 (assertions only).

THE NATIVE-WINDOW RULE (standing, from this audit): every drawn
element of a native window - rect, font, color, scale, alignment -
must cite its DFU source line (file + member) in the code comment
or the arc record BEFORE it ships. No free-styled geometry: if the
DFU value is unknown, the element does not draw until it is looked
up. Guessing cost three hotfixes; looking up costs one grep.

## U8d: the native inventory window (2026-08-17)

The classic inventory screen on real art - the FIRST window built
UNDER the native-window rule: every element below cites
DaggerfallInventoryWindow.cs.
- ui/nativeInventory.js: INVE00I0.IMG base; INVE01I0.IMG is DFU's
  SELECTED-state sheet (ImageReader.GetSubTexture cuts each active
  button from it at the button's own rect) - ported as drawImgSub
  on nativePanel (IMG top-down, straight UVs). Verbatim rects
  (#region UI Rects): tabs weaponsAndArmor (0,0,92,10) / magicItems
  (93,0,69,10) / clothingAndMisc (163,0,91,10) / ingredients
  (255,0,65,10); action buttons 31x14 at x226 - wagon y14, info
  y36, equip y58, remove y80, use y103, gold y126; local/remote
  lists (163/261,48,59x152); exit (222,178,39,22).
- THE TAB FILTER (AddLocalItem verbatim): WeaponsAndArmor = groups
  Weapons/Armor not enchanted; MagicItems = enchanted or Spellbook
  (MiscItems.Spellbook = 132); Ingredients = isIngredient not
  enchanted - DFU's ItemTemplates.txt marks EXACTLY template
  indices 0..77 (verified: 78 rows, contiguous); ClothingAndMisc =
  everything else. Defaults verbatim: WeaponsAndArmor tab
  (SelectTabPage on setup), Equip mode (selectedActionMode; Remove
  for loot targets pends with the loot flow).
- ui/itemScroller.js: the ItemListScroller EXTRACTED to one shared
  module (the 17d law - buttons at x9, the LEFT rail, no-upscale
  centring, FONT0004 stack labels) - nativeTrade rewired onto it,
  the inventory rides the same code. One layout, one fix site.
- THE SLICE LINE: this is the VIEW + INFO half. Info-mode clicks
  pop an interim name/weight/value panel (DFU's 1016 info text +
  paperdoll cutout pend); Equip/Use/Remove local clicks and the
  whole remote (dropped-pile) side are FLAGGED loud - equipping
  needs the paperdoll arc, dropping needs the ground loot flat
  (droppedItems in DFU's OnPush). Wagon/gold consumed no-ops.
- F6 opens it in BOTH exterior hosts (DFU's default Inventory
  binding; the F5 host-rule shape), art warmed at boot, art-less
  sessions leave F6 dark (never trap).

Probed live + EYEBALLED (tools/nativeInventoryProbe.mjs): the gold
tab highlight landing exactly on the baked WEAPONS & ARMOR button,
EQUIP lit as the default mode, dagger + buckler inside their slot
frames right-side-up, the Clothing tab swapping to the book with
its FONT0004 "3" at the button top-left, the INFO panel over the
paperdoll space, Escape closing. Suite 460/102.

## U8e: dropped loot - the ground pile (2026-08-17)

The inventory's remote column comes alive: DFU's droppedItems +
CreateDroppedLootContainer, every law cited.
- scenes/droppedLoot.js: dropPile mints a pile at the ground below
  the player with an archive-216 flat (DaggerfallLootDataTables.
  randomTreasureArchive) on a RANDOM record from the verbatim
  20-entry randomTreasureIconIndices; batches ride the hosts'
  person-flat axis (the corpse-batch shape); lootTargets carry the
  corpse activation box. EMPTIED piles vanish from both reads
  (SerializableLootContainer: Items.Count == 0 -> remove).
- nativeInventory REMOTE SIDE: Remove-mode local clicks transfer
  whole stacks into the remote pile (LocalItemListScroller_
  OnItemClick; the stack-split popup pends); remote clicks in Equip
  OR Remove transfer back to the player (RemoteItemListScroller
  verbatim - Equip's equip-after half pends the paperdoll);
  closing with session drops hands them to onDrop (the OnPop mint).
  Loot-target opens default to REMOVE ("so player does not
  accidentially equip when picking up").
- HOSTS (both exteriors): dropFeet raycasts the ground below the
  motor (FindGroundPosition); E on a pile slots between corpse loot
  and doors in the activation order and reopens the inventory WITH
  the pile as remote target; pile batches draw with the person
  flats. FLAGGED loud: save persistence (piles die with the
  session, as guard corpses do), the ?world pixel-destroy frame
  doctrine (piles share the corpse-batch stance), the stack-split
  popup, TrackLooseObject.

PROBE LESSON (tools/droppedLootProbe.mjs): the first run dropped
while the boot collider was still streaming - the motor hung at
spawn height, the ground raycast had no tris, and the pile minted
mid-air. Probes that DROP things must wait for the MOTOR TO SETTLE
(two stable __player.pos reads), not just __shotReady. Probed +
EYEBALLED end to end: the classic treasure sprite lying on the
street, E reopening the window with REMOVE lit and the dagger in
the pile column, the pickup emptying the pile and the flat gone.
Suite 462/103.

## U8f: the equip foundation - ItemEquipTable + the paperdoll base (2026-08-17)

The paperdoll arc opens. Two halves, every law cited:
- systems/equip.js: the MECHANICS half of ItemEquipTable over the
  EXISTING C5a/C5c foundation (characters/paperdoll.js EQUIP_SLOTS
  + characters/equipTable.js's verbatim GetEquipSlot/GetItemHands,
  whose header always deferred "equip/unequip mechanics" to the
  Systems arc): EquipItem (arrows refused, SplitStack ONE off a
  worn stack, a 2H clears both hands, a shield bumps a held 2H, the
  destination swaps its occupant out and returns the unequipped
  list), UnequipItem, the string-group bag shape translated to
  C5c's numeric enum at the boundary (C5c's getItemHands now
  accepts both - worn bag items land in the slots verbatim and the
  2H-replace rule inspects them). Items STAY in the bag and carry
  equipSlot when worn - FilterLocalItems' !IsEquipped gate hides
  them from the tab lists. FLAGGED: equip sounds, enchantment
  payloads.
  THE NEAR-MISS (process): the first draft REBUILT GetEquipSlot/
  GetItemHands from the DFU source without checking the tree - the
  C5c foundation already carried them, and the duplicate overwrote
  test/equip.test.js (the manifest drift guard caught the five
  vanished tests at the gate). BEFORE porting a DFU class, grep the
  bible + tree for an existing port; the manifest guard is load-
  bearing - never bypass it.
- ui/paperDoll.js: the avatar base on the inventory - the context
  SCBG background (town SCBG04I0; dungeon/graveyard/region branches
  cited and pending their contexts) as the subrect (8,7,110,184)
  filling the 110x184 panel at (49,13); the BODY IMG placed by its
  OWN baked header offset minus paperDollOrigin (200,8); BlitBody
  verbatim - nude body, then the NoPlayerNudity censor welds from
  the clothed sheet in waistHeight-40 bands gated on
  IsUpperClothed/IsLowerClothed; the FACE CIF head at the entity's
  faceIndex by its record offset. INTERIM loud: Breton male face 0
  until chargen fronts identity.
- THE SLICE LINE: the equip machine is TESTED but not yet wired to
  the EQUIP button - equip-mode clicks stay flagged no-ops until
  U8g lands the item overlay layers (playerTexture re-extraction +
  dyes) and the paperdoll click-to-unequip mask; the FP-weapon
  binding rides that slice too.

Probed + EYEBALLED: the classic Breton avatar standing on the town
background inside the panel frame - head with its silver band at
the baked offset, the censor underwear from the clothed weld, the
list icons beside him. Suite 464/104.

## U8g: item overlays + LIVE EQUIP (2026-08-17)

The paperdoll dresses and the EQUIP button works. The renderer
moved to DFU's own architecture - the doll composes into ONE
texture (PaperDollRenderer renders to target), done CPU-side over
INDEXED bitmaps, which hands us GetEquipIndex's click resolution
for free. Every law cited:
- LAYER ORDER (Refresh): cloak interiors (the first drawn cloak's
  template record) -> nude body -> the censor welds gated on
  chest/legs slots -> head -> items ascending drawOrder (BlitItems;
  jewellery only when EquipSlot > 11). Each layer places by its OWN
  baked offset minus paperDollOrigin (200,8); TEXTURE.237 records
  52/54 carry DFU's known-bad-offset fix (237,43).
- ITEM IMAGES (GetItemImage forPaperDoll + GetInventoryTexture*):
  clothing = template archive + bodyMorphology (Human +2, Breton
  INTERIM) with cloaks +1 past their interior record; armor =
  firstMale/FemaleArchive (249/245) + morphology with the
  SetVariant MATERIAL-FAMILY CLAMPS (cuirass leather 0 / chain 4 /
  plate 1..3; greaves 0..1/6/2..5; pauldrons 0/4/1..3; gauntlets
  0/1; boots 0/1..2); weapons = the template archive, an
  Either-hand weapon worn RIGHT draws record+1; masks removed
  (ChangeMask 0xFF -> transparent).
- DYES through the C5b tables (ChangeDye): clothing on the 0x60
  band (item.dye, Blue identity default - stock dye variety
  FLAGGED); weapons/armor on the 0x70 band by material
  (GetWeapon/GetArmorDyeColor; leather + chain fall to the identity
  None table).
- THE CLICK MASK (GetEquipIndex): blitted item layers walked
  BACKWARDS, first non-transparent pixel wins its slot. REMOVE mode
  clicks the doll to unequip; INFO pops the item panel.
- LIVE EQUIP: equip-mode list clicks run EquipItem (swap-outs
  reappear in the lists), equip-mode REMOTE clicks transfer AND
  equip (TransferItem equip true), every change recomposes.
FLAGGED loud: the FP-weapon rig binding (the worn RightHand weapon
should drive weaponRig - U8h), light-source Use, stock clothing
dye variety, armor values on the doll (RefreshArmourValues), the
other 7 races/genders (chargen).

Probed live (tools/equipProbe.mjs) + EYEBALLED: the avatar WEARING
the iron plate cuirass with the longsword at his hip and red-dyed
pants (all three left their list rows), then the REMOVE doll-click
stripping exactly the cuirass. Suite 465/104.

## U8h: the worn-weapon FP binding + armor values (2026-08-17)

The equip system grows its TEETH - wearing gear now changes combat.
- THE FP BINDING: both exterior hosts assign
  weaponRig.playerWeapon.weapon = equip.slots[RightHand] ?? null
  every frame - the rig swings the WORN weapon's art and formulas;
  bare hands take the unarmed hand-to-hand path (weaponTypeForItem
  null -> Melee, the C8 formulas' !weapon branch). The C8 INTERIM
  Iron Dagger moved INTO the bag as seedStartingEquipment (equipped
  at boot, idempotent, skips probe-seeded bags; chargen's starting
  gear roll replaces it). The dungeon host keeps its interim weapon
  until its inventory mounts (FLAGGED).
- ARMOR VALUES (UpdateEquippedArmorValues verbatim): the 7-part
  table starts at 100 each (CharacterDocument - no armor); armor
  subtracts GetMaterialArmorValue()*5 on its body part (leather 3,
  chain 6, plate iron 7 .. daedric 21); shields subtract
  GetShieldArmorValue()*5 (1/2/3/4) on their protected parts
  MATERIAL-BLIND (buckler arm+hands; round/kite +legs; tower
  +head); unequip adds back; DFU's clothing branch is a value-0
  no-op and is omitted. calculateSuccessfulHit consumes
  armorValues[struckBodyPart] directly - THE PARITY CHANGE, loud:
  the player entity now carries the verbatim 100-per-part table, so
  an UNARMORED player is far easier to hit than under the old
  armor:0 scalar (the classic law - armor IS the defense). The doll
  shows (100-av)/5 per part at the verbatim armourLabelPos
  ((70,12),(20,38),(86,38),(12,58),(6,90),(18,120),(22,168));
  drained/increased label colors pend their effect channels.

Probed (tools/equipProbe.mjs extended) + EYEBALLED: "7" engraved at
the chest of the iron-cuirassed doll with zeros elsewhere, and the
FP view drawing the LONGSWORD blade after Z - the worn weapon, not
the old interim dagger (the probe clears the boot seed so the
loadout is the whole story). Suite 467/104.

## AUDIT 17e Wave 1: high-impact parity across the U8 arc (2026-08-18)

The comprehensive pass's second wave - ten confirmed parity defects,
each cited and pinned.
- F8 THE PAPERDOLL CLICK WAS INVERTED: PaperDoll_OnMouseClick
  (DaggerfallInventoryWindow.cs:1932-1952) unequips in EQUIP and
  Select, uses in Use, reads in Info - REMOVE has NO branch and is
  INERT. U8g shipped it on Remove, and its probe asserted the
  inversion, so the bug had a green test AND a green probe. The probe
  now asserts BOTH halves (a Remove-mode doll click changes nothing;
  an Equip-mode click strips the piece).
- F9 THE LISTS DREW WORLD SPRITES: GetItemImage draws the PLAYER
  (inventory) texture for everything except UselessItems1 /
  ingredients / arrows / ReligiousItems / MiscItems
  (DaggerfallUnityItem.UseWorldTexture:1830-1855) - 111 of 288
  templates differ. The port only HAD the world texture because
  systems/itemTemplatesData.js was a LOSSY second copy of
  characters/itemTemplates.json. The two were verified identical
  field-for-field, the copy was deleted, and systems/itemTemplates.js
  now reads the verbatim DFU row - which also brings variants,
  drawOrder and enchantment points into the one place. inventoryItemImage
  ports GetInventoryTextureArchive/Record incl. the Katana +1 bump
  and the cloak interior-first record.
- F10 CLOTHING GAVE NO ARMOR: UpdateEquippedArmorValues admits Armor
  AND the FOOTWEAR window of each clothing group (Mens 147..149,
  Womens 186..188). Leather boots are worth 15 on the Feet part; the
  port granted 0. Sandals (150/189) map to Feet but sit outside DFU's
  GroupIndex window and correctly grant nothing - preserved.
- F11/F18 THE CONVERSATION PANEL: RowSpacing 4 is per LIST ITEM, not
  per wrapped line - rows inside one entry sit 7px apart and only the
  gap BETWEEN entries adds 4 (the port applied 11px to every wrapped
  line AND pushed a blank row, doubling the gaps). Colours were one
  flat ANSWER yellow; DFU uses the ListBox default, the question
  colour on question rows, and white on the NEWEST row.
- F12 OKAY CLOSED THE WINDOW: DFU's Okay is the ASK button. Goodbye
  is the only close; Okay is a consumed no-op until the topic
  highlight lands (FLAGGED).
- F13 THE QUESTION WAS AN ENGLISH LITERAL: it is TEXT.RSC
  7225 + toneIndex (TalkManager.cs:1324), with %1com expanding
  through GetPCGreetingOrFollowUpText (:1149-1156) - the FIRST
  question opens with a greeting (7215 + tone), later ones with a
  follow-up (7218 + tone), and the NPC name is "friend"/"stranger"
  (7221 + tone) at reaction <= 0. The tone flavour is real classic
  text: Blunt asks "Where the hell is %key?". DFU also pushes the
  question/answer PAIR into the conversation - the port only ever
  showed the question in the player-says panel.
- F14 ARROWS: CreateWeapon's arrow branch takes NO material roll, so
  a shelf arrow is worth its basePrice (the port multiplied it by
  material, and stocked a hardcoded stack of 1 where DFU stocks
  1..20). loot.js already had this right - a second divergent copy of
  one special case.
- F15 SCROLL INDICES NEVER RE-CLAMPED: equipping, dropping or selling
  under a scrolled list stranded the rest off-screen. Ported as
  ItemListScroller's delayScrollUp semantics - correct ONLY once the
  index runs past the end, which leaves the partly-filled column
  classic keeps (a plain clamp would over-correct).
- F16 refreshPaperDoll DROPPED concurrent requests (ASYNC NEVER
  DROPS): now coalesced.
- F17 THE FOURTH HOST: the worn-weapon bind moved INTO createWeaponRig,
  so the interior host (which owns its own rig and kept swinging the
  interim dagger inside every building) and the dungeon inherit it.
  The dungeon's own inventory now equips through the real table
  instead of assigning the rig's weapon directly - one equip model in
  every host. ?weapon=bow opts out via bindWorn:false.
- F25/F26 CELL LAYOUT: stack labels are Right/Bottom aligned inside
  the 2px margin with NO shadow in the tooltip colour (230,230,200)
  (ItemListScroller.cs:360-365) - the port drew them top-left,
  shadowed, in gold; and ScaleToFit fits the button's INTERIOR
  (46x34 after itemButtonMargin 2), so icons drew ~9% oversized.
- F32/F33 ONE DFU MEMBER, ONE EXPORT: systems/armorMaterials.js now
  owns ArmorMaterialTypes, GetMaterialArmorValue, the shield tables,
  BodyParts and SetVariant's clamps. systems/equip.js and
  ui/paperDoll.js each carried a copy, and both had invented
  Chain2 = 0x0101 where DFU has 0x0103 (so a Chain2 piece would take
  the PLATE variant clamp and a plate armor value). Latent until
  classic-save import, fixed now.

Probed + EYEBALLED: the item lists now draw real INVENTORY sprites -
the dagger with its golden hilt instead of the world drop sprite -
and the equip probe drives the corrected doll-click law end to end.
Suite 477/105.

## AUDIT 17e Wave 2: the leaks, the origin, and the remaining parity (2026-08-18)

- F19 THE CLIPPED TOPIC ROW: DFU's PixelWise ListBox DRAWS the
  partially clipped last row (104/7 = 14.857 -> 15) and its hit test
  selects it. The port drew floor() = 14 while the click rect already
  admitted row 14 - clicking the bottom band selected a row that was
  never rendered. Fixed the DRAW, not the click.
- F20 THE WHERE-IS CATEGORY LIST: CheckBuildingTypeInSkipList
  (TalkManager.cs:2919-2938) drops Palaces, Furniture stores, all six
  house types, HouseForSale, Ship, Town4/23 and the Specials - the
  port offered Palaces and Furniture stores. The list is now built in
  BUILDING_TYPES enum order (DFU walks the enum) with the three
  paraphrased captions corrected (Armorers / Bookstores / Local
  temples).
- F22 COURT REPUTATION, BOTH WAYS: banishment does NOT call
  RaiseReputationForDoingSentence (DaggerfallCourtWindow.cs:263-278)
  and the port did; a successful not-guilty defense DOES (:426) and
  the port did not. DFU's own comment notes classic repairs nothing
  there - we port DFU.
- F23 THE FLOATING ORIGIN LEFT THINGS BEHIND: the ?world recenter
  shifted the camera and player only, so live guards, corpse
  billboards, corpse-loot AABBs and dropped piles stranded 819.2
  units away on every crossing. Live guards rebuild their billboards
  per frame (shifting ai.feet is enough); the PERSISTENT corpse and
  pile batches bake their centers into a STATIC_DRAW buffer, so they
  are REBUILT at the new origin rather than mutated. Pile keys became
  STABLE IDS in the same pass - an index-based key would rebind to a
  different pile after releaseEmptied splices.
- F24 THE MISSING FOV GATE: WeaponManager's melee requires the target
  inside the CAMERA VIEW; the dungeon host had the test inline while
  both exterior hosts passed null and cityGuards defaulted to ACCEPT,
  so a guard standing behind the player could be hit. Extracted to
  player/cameraView.js and passed by both hosts.
- F27/F28/F29 THREE GL LEAKS (EVERY ALLOCATION HAS AN OWNER): the
  paperdoll minted a new versioned texture per refresh and never
  freed the old one (~81 KB per equip click); emptied dropped piles
  kept their billboard batch forever - now freed at WINDOW CLOSE, as
  DFU's RemoveLootContainer fires there and NOT on the empty
  transition (a pile refilled before closing must keep its flat, or
  lootTargets - which gates only on items.length - would offer an
  invisible activatable ghost); and the dungeon never freed its
  per-foe, corpse or missile batches, leaking a VAO + buffers per
  sprite on every enter/exit cycle. renderer.releaseTexture is new.
- F30 CARRIED WEIGHT: the char sheet re-implemented it from the raw
  template baseWeight, ignoring the MATERIAL weight rule
  systems/inventory.js already ports - a daedric warhammer weighed
  its iron base. Now the single-sourced itemWeight plus the gold term.
- F37 THE FRAME COUNTER RAN BACKWARDS: the exterior host ASSIGNED
  window.__frame from its own counter where the world host
  increments, undoing worldModes' modal-frame increments - probes
  frame-syncing across an overlay could stall. Probe-only.
- F41 F5 RELOADED THE PAGE INSIDE BUILDINGS: the mode gate skipped
  the handler AND its preventDefault, so F5 in an interior destroyed
  the session. preventDefault now runs in every mode; routing F5/F6
  into interiors stays its own arc (FLAGGED).

Suite 480/105.

## AUDIT 17e Wave 3: duplicates, vacuous pins, stale flags (2026-08-18)

The cheap half of the pass - no behaviour changes except where a
duplicate had drifted, but this is the wave that keeps the bible
honest.
- F34 ONE DFU MEMBER, ONE EXPORT: droppedLoot.js re-declared
  randomTreasureArchive + randomTreasureIconIndices, regressing the
  single-sourcing the 2026-07-06b audit had already done in
  systems/loot.js. Now imported and re-exported.
- F35 A PIN MUST FAIL: equip.test.js asserted `bows >= 8`, a
  one-sided inequality that survives promoting ANY weapon to
  two-handed (mutation-proven with Mace). The whole 18-row
  GetItemHands table is pinned instead.
- F36 A PIN MUST FAIL: the "(100-av)/5 display law" was pinned by
  `Math.trunc((100-55)/5) === 9` - literal arithmetic touching no
  port code, with a stale 55 besides. The law is now an exported
  armorLabelValue pinned against LIVE armor values, and DFU's
  armorMod term is flagged where it belongs.
- F38/F39 RETIRING A FLAG DELETES THE SENTENCE: both exterior hosts
  still carried "this host has no HUD-text layer yet" three lines
  above the T3b wiring that gave them one, and nativeInventory's
  header still called Equip and equip-after-transfer FLAGGED after
  U8g shipped both. The open-flags list is grep-regenerated, so it
  had been re-publishing all three as live work. Corrected, with what
  is genuinely still open (interior HUD text; Use mode; wagon/gold)
  left standing.
- F40 the pool-exhaustion comment claimed DFU keeps the block's
  placeholder data; DFU copies a ZEROED pool item. Doc-corrected but
  deliberately NOT implemented: the branch is unreachable on classic
  data (39256 draws against 39256 entries across all 15251
  locations) and DFU only reaches it through WorldDataReplacement,
  which this port omits - implementing it would be untestable dead
  code.

DEFERRED with reasons recorded (see Home Open flags): the paperdoll
MASK pass (F31 - DFU's shader erases layers beneath a masked item, so
a helm cuts out the hair; the port only skips the item's own masked
pixels. The obvious fix - writing transparent black - is WRONG for
this architecture because the SCBG is baked into the same buffer, so
it needs either an SCBG restore or a layering restructure; measured
divergence is 6-89 px per item, cosmetic); and Chain2
reachability (the constant is fixed, but nothing mints 0x0103 until
classic-save import exists). The KRAVE01.HS2 Order-of-the-Raven
override (F21) SHIPPED in AUDIT 18 - otherNames needed no threading,
it was already on dfBlock.rmbBlock.fldHeader.

All four native-window probes re-run green. Suite 480/105.

## S3c/U9: CHARGEN - identity, all eight races, and the fourth host (2026-08-18)

The loudest INTERIM in the tree retires: the player is no longer a
Breton male face 0 with flat skills.

FIRST, per the audit's ONE DFU MEMBER ONE EXPORT rule, the tree was
grepped before anything was ported - and most of chargen ALREADY
existed. systems/chargen.js held the verbatim S3 rolling laws
(StatsRollout/SkillsRollout pools, hit points, spell points,
starting spells) and ui/chargen.js held the ChargenFlow with the
pool-distribution rules. What was actually missing was identity, the
other seven races, and three of the four hosts. Nothing was rebuilt.

- systems/races.js: DFU RaceTemplate (RaceTemplate.cs:172-345) for
  all EIGHT races. The art tables are GENERATED from the regular
  scheme (background SCBG0nI0, male BODY0nI0/I1, female BODY1nI0/I1,
  heads FACE0nI0/FACE1nI0) because the Races ENUM is 1-based while
  the art index is 0-based - exactly the off-by-one that makes
  hand-typed tables drift - and pinned against the DFU literals.
  Each FACE CIF carries 10 heads (verified against shipping ARENA2).
- THE PAPERDOLL IS IDENTITY-DRIVEN: it carried a Breton-only table
  and hardcoded the Human body morphology. It now loads the entity's
  race/gender/face and RELOADS when that identity changes (chargen
  picks after boot, so the old bare `if (_art) return` guard would
  have frozen the doll on Breton forever). Clothing, armor and cloak
  archives all take the race's morphology (Argonian 0 / Elf 1 /
  Human 2 / Khajiit 3) instead of assuming Human.
- THE FLOW GAINS RACE + FACE between name and gender/class, in
  classic's order. result() carries race/raceId/faceIndex,
  applyCharacter writes them onto the entity, and the save envelope
  carries them.
- THE FOURTH HOST (the four hosts rule, the audit's own): chargen
  ran ONLY in dungeonContext, so booting straight into a town left
  the player on the pre-chargen INTERIM entity - flat skills 30,
  maxHealth 50 - for the entire session. systems/chargenSession.js
  now owns the career load, the overlay-shaped window (translating
  raw key codes through the SHARED overlayAction table, not a second
  copy) and the finish; both exterior hosts mount it at boot, and
  the dungeon was repointed at the same loader.

Probed live in the EXTERIOR host (tools/chargenProbe.mjs) +
EYEBALLED: the flow drove name -> race -> gender -> face -> class ->
stats -> skills to a finished Khajiit FEMALE face 3 Mage with rolled
maxHealth 31 and a real skills array, and F6 then drew the paperdoll
as a female Khajiit - the striped facial markings and the female
body, entirely different art from the Breton male the port had shown
since U8f.

STILL FLAGGED: the classic chargen ART (the flow draws clean text
panels; the portrait/biography/reflex screens ride the chargen-art
slice), the biography questions, reflexes, and DFU's
starting-equipment roll (seedStartingEquipment's interim dagger
stands in).

Suite 482/106.

## S3d: STARTING EQUIPMENT (2026-08-18)

AssignStartingGear (ItemHelper.cs:1277-1364) verbatim - the INTERIM
iron dagger retires and a new character begins dressed, armed and
funded, which closes the loop chargen -> identity -> gear -> equip
table -> paperdoll art.
- CLOTHES are gender-specific and WORN: men Short_shirt (165) +
  Casual_pants (151), women Short_shirt_closed (206) + Casual_pants
  (190). The shirt takes a RandomClothingDye from the 10-entry
  table, the pants a random variant, and both go through EquipItem.
- a SPELLBOOK for every player, carried not worn.
- the CLASS WEAPON from StartingWeaponTypesByClass with its
  iron/steel choice (the Mage's shortsword is STEEL; the Monk gets a
  staff; the Warrior an iron broadsword). A CUSTOM class gets an
  iron Longsword instead.
- the ARCHER alone also gets a steel Battle Axe and 24 iron arrows -
  proven archer-only against the Ranger, who carries a battle axe as
  its class weapon but no bow and no arrows.
- +100 gold as a Currency stack.
- torches/candles ride DFU's PlayerTorchFromItems SETTING, which is
  a DFU enhancement rather than classic - ported but defaulted OFF,
  the same stance the 17e audit took on the enhanced 16-slot list.
- every minted item carries a NAME and a VALUE (the 17e F2 root fix:
  an item reaching the shop without a value priced at 1, which was
  half of an unbounded gold loop).
- THE SEED ORDER: the interim dagger seed is now the FALLBACK only.
  A character who runs chargen gets the real kit, and finishChargen
  clears the bag/equip table first so a host that seeded at boot
  cannot leave a stray dagger behind. The dungeon's headless
  fallback path gets the real kit too.

Probed + EYEBALLED: the Khajiit female Mage from the S3c probe now
begins with a shirt, pants, spellbook, steel shortsword and 100
gold, and her paperdoll draws her DRESSED - real classic shirt and
trouser art, the censor welds gone because actual clothing covers
chest and legs. Suite 488/107.

## AUDIT 17f: the parity pass over the audit's own changes (2026-08-18)

Mac: "lets first do a comprehensive audit on changes so far and parity
pass" - the same request that produced 17e, now aimed at what 17e
itself (Waves 0-3) plus S3c/U9 and S3d shipped. Read by hand against
DFU source rather than fanned out; the surface is one arc wide, and
the interesting findings are the ones a wave INTRODUCED while fixing
something else. Sixteen confirmed, all in this slice. The full ledger
lives in `bible/Home.md` under Audits - the parts that belong to this
arc:

**The item lists never got SetRace.** 17e F9's whole point was that
the lists must draw the PLAYER texture, not the world sprite - and it
read that archive straight off the TEMPLATE. In DFU the archive is an
INSTANCE field that `SetRace` offsets by the wearer's body morphology
at creation (ItemBuilder.cs:850-854; armor replaces it outright via
ApplyArmorSettings :466-485), and `GetInventoryTextureArchive`
(DaggerfallUnityItem.cs:1728-1735) returns that offset field. So every
list - inventory, trade, loot - drew clothing off the morphology-0
ARGONIAN row and armor off the men's Argonian archive, whoever was
wearing it. The paperdoll had the law since U8g; the list did not,
which is exactly the split ONE DFU MEMBER, ONE EXPORT exists to catch.
`characters/paperdollArt.js` now owns `playerArchiveFor` and both
windows resolve through it; `makeIconDrawer` takes the wearer.
Eyeballed: a Khajiit female's short shirt is archive 238, not 235.

**The gold stack had no template.** Three producers hand-built it
with no `templateIndex` and two spellings of the name, so it drew NO
icon (there was nothing for GetItemImage's world-texture fallback to
fall back FROM) and weighed nothing through `itemWeight` - which is
why `charsheet.js` carried its own 0.0025 constant. It is
Currency.Gold_pieces (276) now: the classic pile icon at 216/1, the
template weight, one name. A pre-17f save upgrades its stack on
restore, because `stacksWith` compares template index and a legacy
stack would otherwise split off a second pile `goldAmount` never
looks past. Eyeballed: the pile icon draws in Clothing & Misc where a
bare "100" had floated in an empty button.

**The paperdoll leaked on identity change.** 17e F27 gave the
composite an owner; S3c then added the identity-reload path and set
`_live = null` directly, orphaning the texture the refresh would have
freed. Chargen hits it on every race/gender/face change. The same
path advanced `_deps` before the art loaded, so a failed load left a
Khajiit identity addressing Breton bitmaps.

**paperdollArt kept a third copy.** 17e F32 collapsed the armor
material tables out of equip.js and paperDoll.js and stopped one file
short. `characters/paperdollArt.js` still held the SetVariant clamps
keyed by material FAMILY and a second export literally named
`armorArchive` whose second argument was a RACE where the other's was
a MORPHOLOGY. Same member, same name, incompatible arguments. It
wraps the single home now, keeping the C6a signature.

**Chargen: the town path was the poor relation.** A Mage created in a
town got an EMPTY spellbook (the exterior hosts called `finishChargen`
with no spell table; only the dungeon host loaded SPELLS.STD), the
`?class=N` headless skip minted an empty bag (S3d landed the kit on
two of three creation paths), and the exterior hosts PARSED `?class`
for the dungeon they might build while ignoring it for their own
chargen - which is why S3c's chargen-on-boot silently wedged the
U8d/U8e/U8g probes and no gate noticed. `loadSpellIndex` and
`applyHeadlessChargen` join `loadCareers`/`finishChargen` as shared
session members; dungeonContext, which had re-grown a hand-inlined
copy of finishChargen one slice after it was extracted, calls the
shared one. `createChargenWindow`'s doc promised onDone fires once and
the code fired it on every key after done, each re-running
applyCharacter and re-rolling the kit.

**AssignStartingGear, three drifted details.** The Spellbook is added
FIRST (ItemHelper.cs:1300-1306) and `AddPosition.Back` makes
collection order the DRAW order, so the port's bag led with the
shirt; the pants variant was hardcoded to 4, the MEN'S count, where
women's Casual pants (190) has FIVE, so a woman could never roll her
last variant; and the names were lower-cased hand copies of
`ItemTemplate.name`. Clothes are equipped where DFU equips them, ahead
of the weapon.

**Checked and CLEARED** - recorded because it reads like a bug: 17e
F15's `safeScrollIndex` only re-clamps when the index is past the end,
which looks like a missing clamp against `GetSafeScrollIndex`. It is
not. That function has two branches, and the port implements the
`delayScrollUp = TRUE` one - which is precisely the branch the `Items`
SETTER takes (ItemListScroller.cs:181), and the setter is what a
refilter runs. The tight clamp belongs to the scrollbar and
mouse-leave paths, which we raise no event for. The partly-filled
column really is classic.

**FLAGGED, not fixed** (reasons at the sites): gold as a bag stack at
all - classic keeps `playerEntity.GoldPieces` as a counter that never
appears in a list, and retiring the port's S2 shape touches
goldAmount, trade and loot; a REMOTE list drawing its clothing on the
PLAYER's morphology, because shop stock carries no owner identity;
quicksave still living only in the dungeon host.

Pins: `test/audit17f.test.js`, ten tests, each mutation-proven.
Probes: the chargen probe now asserts bag ORDER, template names, the
starting spellbook and the wearer-addressed icon archive; the equip
probe clears the derived tables instead of unhooking "the interim
dagger" by hand; all three exterior probes take the `?class=16` skip.

## U10: CHARGEN ART - the classic screens + the portrait (2026-08-18)

Mac: chargen art next. The U2b flow has drawn on clean text panels
since it shipped, with the background art FLAGGED pending name
verification against real ARENA2 - and S3c's face picker chose a face
index BLIND, with the text panel apologising for it in so many words.
This retires both.

`src/ui/chargenArt.js` draws all seven screens on the U8a native
panel, every rect and colour citing its DFU line (THE NATIVE-WINDOW
RULE):

- **name** CHAR00I0.IMG, the text box at (80,5) 214x7 in
  DaggerfallDefaultInputTextColor, OK at (263,172,39,22)
  (CreateCharNameSelect.cs:26,73-85).
- **race** TMAP00I0.IMG, the province map, with the verbatim prompt
  centred at y=16 - and the PROVINCE CLICK is live: TAMRIEL2.IMG is
  never drawn, its palette INDEX at the click point IS the race id,
  because RaceTemplate.GetRaceDictionary keys on ID
  (CreateCharRaceSelect.cs:30-31,93-102). Probed: a click on
  Hammerfell lands on Redguard with no key pressed.
- **gender** the verbatim TEXT.RSC 2200 prompt over the same map.
  FLAGGED: DFU's is a DaggerfallMessageBox and the port has no
  message-box FRAME art, so a plain panel stands behind it.
- **face** CHAR01I0.IMG and THE PORTRAIT - FacePicker's 64x40 display
  panel at (247,25) with the head centred/middle inside it, PREVIOUS
  (245,69,42,9) and NEXT (287,69,26,9) (FacePicker.cs:55-68). The ten
  head records come from the race/gender FACE CIF, and the load
  COALESCES rather than dropping when the identity changes mid-flight.
- **class** PICK00I0.IMG centred/middle, the nine-row list at (26,27)
  138x72 with rowSpacing 1 (ListBox.cs:36-37) and the selected row in
  DaggerfallDefaultSelectedTextColor - over a SCREEN DIM, because the
  list picker is the one chargen screen that is a popup rather than a
  full-panel window.
- **stats** CHAR02I0.IMG + StatsRollout: value panels at (8,33) 34x6
  stepping 22 with CENTRED labels, green when raised above the roll,
  the UpDownSpinner (CHAR02I1.IMG) riding the selected row and
  carrying the bonus pool, the seven derived labels at their verbatim
  positions, REROLL and OK.
- **skills** CHAR03I0.IMG + SkillsRollout: three groups at y 32 / 81 /
  130, labels at x=68, values at x=187, rows 10 apart, the
  LeftRightSpinner (CHAR03I1.IMG) on the cursor row carrying that
  GROUP's pool.

Clicks land on DFU's own buttons through the shared overlay pointer
seam (the U8b law - taps and clicks ride one path), and the whole
keyboard flow is untouched, so the phone, the probe and the mouse all
drive the same window.

**Three things this slice found on the way.**

**Solid quads never blended.** `drawScreenQuad` wrote a solid colour's
alpha straight out with GL blending OFF, so every translucent UI panel
in the port drew OPAQUE - DaggerfallUI.ScreenDimColor (0,0,0,0.5)
BLACKED OUT the screen behind a modal window instead of dimming it,
and the same went for the talk, rest, action-text and char-sheet
backdrops. SIXTEEN call sites had been authoring alpha that never
applied. Blending is enabled for untextured quads with alpha < 1;
textured quads keep their existing discard law, so no art path
changes. Eyeballed on the class picker and the talk window.

**The port printed enum keys where classic prints names.** The skills
screen was the first window to show a skill list at chargen scale and
it read "ShortBlade" and "BluntWeapon". `TextProvider.GetSkillName`
returns "Short Blade" and "Blunt Weapon" (Internal_Strings.csv:380-
400,498), and the char sheet had been printing the raw keys too since
U8a. `SKILL_KEYS` is now the code identity and `SKILL_NAMES` is what a
window prints.

**The derived stats had no home.** Drawing CHAR02I0's right column
needed all seven of FormulaHelper's derived values, and the port had
them scattered - MaxEncumbrance inline in charsheet.js, MagicResist
inline in spellcast.js, HealingRateModifier in rest.js, SpellPoints in
chargen.js - with ToHitModifier and HitPointsModifier missing
entirely. They live in `combat/formulas.js` beside DamageModifier now,
and the old sites import them.

**And three more wedged probes.** AUDIT 17f found that S3c's
chargen-on-boot silently wedged three probes; it wedged SIX. The char
sheet, talk and trade probes take the `?class=16` skip too now. The
trade probe additionally hand-built a Currency literal with no
template index, which stopped MERGING with the starting kit's stack
once 17f gave gold its template - it sat behind it as a second pile
`goldAmount` never reached and the buy was refused for lack of funds.
It adds gold through the real producer now (TEST THE SHAPE THE
PRODUCER MINTS).

Pins: `test/chargenart.test.js`, seven tests, each mutation-proven.
Probed + eyeballed, every screen: "Name thyself" with the OK button,
the Empire of Tamriel map with the verbatim prompt, "Choose thy face"
with a Khajiit female portrait in the picker frame, the class scroll
over a real dim, "Add bonus points" with all eight stats and the
derived block, and the three skill groups with "Short Blade" and the
spinner sitting between its arrows.

FLAGGED, not done: the DaggerfallMessageBox frame (which the gender
screen and the race DESCRIPTION box both want), biography questions,
reflexes, and the custom-class path - none of which the flow has
states for yet.

## U11: THE PARCHMENT MESSAGE BOX (2026-08-18)

The last plain panel in an otherwise native chargen. DFU's
`DaggerfallMessageBox` is the frame behind every popup in the game
and the port had never had it: U6's action boxes, U10's gender screen
and the race description all drew on a flat colour rect.

`src/ui/messageBox.js` ports it whole, every law citing its DFU line:

- **the frame** is a NINE-SLICE over SPOP.RCI
  (DaggerfallUI.cs:48,905-949): records 0-8 are topLeft, top,
  topRight, left, fill, right, bottomLeft, bottom, bottomRight, all
  22x22 in the shipping data - which is WHY the box rounds its size
  to a multiple of 22. Corners draw once, edges and fill tile
  (Panel.cs:243-330), here an exact integer repeat.
- **the sizing law** (UpdatePanelSizes, :506-570): margins 10;
  width = max(button strip, text) + both margins, floored at
  minBoxWidth 132; height = label block + both margins; each rounded
  UP to a slice, or 44 if under 44. Adding buttons grows the label
  block ONCE by the button height + buttonTextDistance 4 - the
  `finalSize.y - buttonPanel.Size.y > 0` gate passes only on the
  first button, so one button and four cost the same height.
- **the buttons** are BUTTONS.RCI records INDEXED BY THE ENUM VALUE
  (:67-90, :369-371), 32x16, laid left to right with buttonSpacing
  32, the strip centred, and the verbatim single-button HACK that
  drops a lone button 11px lower "so that it aligns like two or more
  buttons".

**One deliberate departure, flagged at the site.** DFU computes the
button Y from `messagePanel.Size.y` - which at that moment still holds
the height from the PREVIOUS UpdatePanelSizes call, the panel being
resized three lines later. The strip lands 6px above the last text
row even though the label block reserved exactly stripH + 4 beneath
it. Eyeballed on the Redguard description, whose final line is long
and centred: "Is your [YES]ter to [NO]Redguard?". The reservation is
plainly the intent - 4px under the text is where 16px of button
exactly fills it - so the port clamps the strip to that and never
lets it ride higher. Nothing else in the file departs.

**The TEXT.RSC bug this uncovered.** The race description came back as
one run-on line with words fused across the breaks - "Hammerfell.You
are part of". `plainText` broke only on NewLine (0x00) and dropped
JustifyLeft (0xFC) and JustifyCenter (0xFD) as "every other control
byte". In DFU all three call `NewLine()`
(MultiFormatTextLabel.cs:333-345); JustifyCenter additionally centres
the row it just closed. Most centred records lay their text out with
0xFD, so **every one of them had been rendering as a single fused
line** everywhere the port shows TEXT.RSC. Fixed, with a new
`linesById` returning rows WITH their per-row alignment. The old pin
asserted "justify drops" - it was pinning the bug.

**Wired:** the chargen gender screen (TEXT.RSC 2200 with Male/Female),
the race confirm box (the template's DescriptionID with Yes/No -
Yes accepts and moves on, No returns to the map, and the box is MODAL
over both the map's clicks and its keys), and U6's ActionTextBox and
ActionInputBox. The race table gained `descriptionId` and `clipId`
(RaceTemplate.cs:177-332; note the ids are NOT in enum order - Nord is
2000, Breton 2003). Warmed in all three chargen hosts; worldModes
hosts no popup (its `say` goes to the console, already flagged).

Pins: `test/messagebox.test.js`, six tests, and the corrected
`textrsc` pins - each mutation-proven.
Probed + eyeballed: the gender box on the province map with real MALE
and FEMALE buttons, and the Redguard description reading as seven
proper lines with YES and NO clear beneath it.

FLAGGED, not done: the scrolling variant (a label past MaxTextHeight
gets a scroll bar and clipped rendering, :571-590) - nothing in the
port yet feeds a box more text than fits.

## AUDIT 17g: the deep parity pass over U10 + U11 (2026-08-18)

Mac asked for a deep audit of the two slices just shipped. Read by
hand against DFU source. Six confirmed; the full ledger is in
`bible/Home.md` under Audits, and the parts that belong to this arc:

**The wiring that read right and did nothing.** U11's
`preloadMessageBoxArt` landed inside `dungeonContext.toggleCharSheet()`
- the comment beside it said "for the action boxes" - so a dungeon
trigger popping a ShowText box drew the FLAT fallback unless the
player had pressed F5 earlier in the session. It warms at scene boot
now, beside the TEXT.RSC load whose records it frames. Exactly the
shape of 17e's silently-no-op'd `releaseEmptied`: a line that reads
correct, sits in the wrong scope, and fails without a sound.

**The box centred every row.** `MultiFormatTextLabel` sets
HorizontalAlignment.Center on the rows a JustifyCenter closed and
leaves the rest LEFT (:341-344). U11's own `linesById` carries that
flag and `drawMessageBox` discarded it. Counted over the shipping
TEXT.RSC: of 676 multi-row records, 596 are all-centre - which is
precisely why the race descriptions looked right and hid this - but
**53 are entirely left and 27 mix the two**. Rows flow as
{ text, center } now; a plain string still centres, which is what the
gender prompt (composed in code, not read from a record) wants.

**The class list jumped.** `ListBox` scrolls minimally on a selection
move: `SelectPrevious` pulls the window up only when the selection
falls above it, `SelectNext` pushes it down only when it falls below
(:709-730). U10 recomputed a CENTRED window at draw time, so the whole
list lurched on every arrow and the selection could never sit anywhere
but the middle. The scroll index is the list's own state now, moved by
the verbatim rule, and a click on a row selects it as DFU's list does.

**Three smaller ones.** `chargenHit`'s `class` case derefed the art
directly where every other case returns null, so the ONE state that
needs the art was the one that threw. `ActionInputBox` re-laid its box
out from its own live entry every frame, so the parchment gained a
whole 22px slice mid-word - `layoutMessageBox` takes `sizingRows` and
measures the field at its maximum (maxCharacters 20). And a keyboard
confirm on the race screen walked straight past the description box a
click always opened; DFU has no keyboard path there at all, so both
route through the same box now, with an art-less flow pinned never to
trap.

**Checked and CLEARED**, recorded because both looked like findings:
the ten FACE textures per identity are not a leak - `uploadTexture`
memoises by key, so they are bounded (160 worst case) and shared
exactly like archive art. And the U11 TEXT.RSC line-break fix has no
live regression despite changing 714 of 1408 records: every record the
port currently draws through a single-string path (greetings, tones,
where-is answers, palace names) is single-row, and `drawText` renders
a stray control byte as a blank advance rather than a glyph.

**FLAGGED, not fixed:** the class picker's scrollbar THUMB. The
geometry is verbatim and simple (height = rail x displayed/total,
floored at 10; y = scroll x (rail - height) / (total - displayed)) but
the thumb is three texture slices this port has not identified, and
inventing a colour would break the NATIVE-WINDOW RULE.

Pins: `test/audit17g.test.js`, six tests, each mutation-proven.
Probed: all seven exterior probes green, and the keyboard confirm
opens the Khajiit description at 9 rows live.

## S3e/U12: THE BIOGRAPHY QUESTIONS (2026-08-18)

The chargen screen classic players actually remember, and the one that
makes two characters of the same class play differently. Twelve
questions per class, each answer carrying a list of EFFECTS.

**`src/formats/biogFile.js`** ports BiogFile's StringReader walk
(BiogFile.cs:44-146): blank lines skipped between questions, a
question's first line leading with `N.` and its text being everything
after the FIRST dot, an optional second line, then answers while the
line has `.` at index 1 and starts with a LETTER, each followed by its
effect lines. One trap worth naming: C#'s `Split('.', 2)` keeps the
REMAINDER in the last element where JavaScript's limit argument
DISCARDS it, so a naive port loses everything after a second dot -
"What is it, Mr. Smith?" would come back as "What is it, Mr". Two of
DFU's rules are defensive and unreachable in the shipping data and are
ported but deliberately NOT pinned; the corpus gate is the proof.

**`src/systems/biography.js`** ports ApplyPlayerEffect (:248-445) -
the whole grammar, counted over all 18 shipping files: 692 skill
lines, 589 text tokens, 420 item grants, 136 faction and 111
social-group reputation changes, 84 AF, 55 gold, 38 AE, 18 each of
RP/FT/RD/MR, 14 each of RR/TH, and 12 bare `&` lines. Both gold quirks
are verbatim: "GP + 250" is ONE argument (DFU corrects the spaced
sign), and the player can never carry negative gold. Social reputation
ACCUMULATES while the six single-field mods ASSIGN - a second `RP`
overwrites the first, because every one of those branches reads
`= parseResult`.

**This is not cosmetic.** `biographyReactionMod` and
`sGroupReputations` are already read by `getReactionToPlayer`
(talk.js), so a biography answer changes how townspeople greet you
from the first conversation. Probed live: a walk through all twelve
questions left social reputations at [-5, 0, 5, 5, ...], poison
resistance at -10, and 950 gold instead of the kit's 100.

**Where the effects land.** DFU keeps the answer list on the
CharacterDocument and applies it at StartGameBehaviour.cs:416 - at
GAME START, over the finished character. The port does the same in
`finishChargen`, after `applyCharacter`, so a skill bonus rides on top
of the distributed value instead of being overwritten by the roll. The
SKILLS SCREEN meanwhile DISPLAYS the bonus on top of the working value
(CreateCharAddBonusSkills.cs:67-72) without turning it green, since
that colour compares working against ROLLED and the bonus is not the
player's spend.

**The screen** is BIOG00I0.IMG with the verbatim geometry
(CreateCharBiography.cs:32-42): the two question lines at (30,23)
stepping 11, and TEN answer buttons 149x24 from (10,71) - even indices
in the left column, odd in the right, a row every two - with the
answer label at (21,5) inside its button. Answers past the question's
count leave their buttons BLANK and a click on them is INERT, verbatim.

FLAGGED: `rf` faction reputation queues on the entity for the faction
slice to drain; AE/AF/AO are parsed and logged but NOT applied,
exactly as DFU leaves them (:427-440) - applying a guess would be a
divergence, not a fix; the bare `&` hits DFU's own invalid-command
branch. Also FLAGGED: the port's overall wizard ORDER still differs
from DFU's (we ask the name first and the face early); biography sits
where it does relative to the class choice and the bonus screens,
which is what the effects depend on, but putting the whole wizard on
the classic sequence is its own slice. The backstory TEXT the '#'/'!'
tokens compose, and the reputation-change message box that closes the
screen (reputationToken 35), pend with it.

Pins: `test/biography.test.js`, 16 tests, each mutation-proven, plus a
CORPUS GATE walking all 18 shipping files - twelve full questions each
that fit the ten buttons, and every one of their ~2200 effects a
command we implement bar the twelve `&`.
Probed + eyeballed: the classic BIOGRAPHY screen with "What school of
magic have you been studying the longest?" and its six answers in two
columns, the picked one in the classic dark red.

## U13: REFLEXES + THE BACKSTORY (2026-08-18)

The two pieces S3e left flagged, and the ones that close chargen.

**REFLEXES** (CHAR05I0.IMG + the CHAR05I1.IMG highlight strip). The
info panel at (0,15) carries TEXT.RSC 307 - classic's own explanation
that reflexes set "the overall speed of the game" - and the picker
sits at (127,148): five 66x9 rows stacked, VeryHigh at the top, with
the 66x45 highlight strip banded five ways. DFU draws band
`0.2 * (4 - value)` in Unity's BOTTOM-UP texcoords, which is band
`value` counted from the top; the strip's own baked offset is
(127,148), the picker position exactly.

**This screen was the only missing piece - the mechanics were already
live.** Both consumers have been in the port for slices:
`EnemyAttack`'s melee timer (`+= 450 * (reflexes - 2)`, enemyAttack.js)
and the monster multi-attack gate (`50 - 10 * (reflexes - 2)`,
formulas.js), and both hosts already passed `playerEntity.reflexes`.
They were reading a hardcoded Average because nothing could set it.
Picking Very High now genuinely makes monsters swing sooner and land
fewer of their extra attacks. Probed: the pick reaches the entity.

**THE BACKSTORY.** `GenerateBackstory` (BiogFile.cs:169-232): the
class's TEXT.RSC record (4116 + classIndex) is prose carrying %q1..%q12
and %q1a..%q12a macros, each expanding to the FIRST text line of a
record the player's own answers named. The subtlety worth recording:
both the '#' and the '!' token of a question land in the SAME
per-question list, because `tokenLists` is indexed by the QUESTION and
not by the prefix - so %qN is that list's first entry and %qNa its
second (BiogFileMCP.cs:150-161, :306-317). A question with no token of
that kind expands to NOTHING, which is what leaves the prose reading
cleanly. Live over real data: the Mage backstory is 62 rows, and its
six macros all resolve - "%q1" became "sending sparks of flame and ice
flying around the yard", which is the Destruction answer's own record.

**THE REPUTATION BOX.** The last biography answer composes the
backstory and pops TEXT.RSC 35 in a ClickAnywhereToClose box, its
%r1..%r5 filled from `DigestRepChanges` - the per-group totals the
twelve answers moved. Probed live: "Commoners: -5" over
[-5, 0, 5, 5, 0]. The box is MODAL: any key closes it AND ends the
screen, which is the pin that catches a half-wired dismissal.

Two of DFU's guards here are DEFENSIVE and unreachable, and are ported
WITHOUT pins rather than with fake ones: DigestRepChanges' `rf` arm
(the split never parses a faction id anyway) joins the two BIOG parser
rules S3e already recorded.

Pins: `test/biography.test.js` grows to 21, the five new laws each
mutation-proven.
Probed + eyeballed: the REFLEXES screen with classic's own text and
the highlight band on AVERAGE, and the reputation box carrying the
real deltas.

FLAGGED, still: the custom-class path (CreateCharCustomClass - the
gear law already handles `isCustom`, only the screen is missing) and
the port's overall wizard ORDER, which still asks the name first and
the face early where DFU asks race, gender, class, biography, name,
face. Chargen is otherwise complete.

## AUDIT 17h: the parity pass over S3e + U13 (2026-08-18)

Three findings. The arc-local two, and one that turned out to be
several slices older than the work that exposed it.

**The port had never saved player reputation.** `sGroupReputations`
and `reactionMods` are read by `getReactionToPlayer` on EVERY greeting
and written by the T3f tone tallies, the G2 court sentences and now
the biography - and the quicksave carried neither, nor any of the six
`biography*Mod` fields. DFU writes all of it out field by field
(SerializablePlayer.cs:136-141, :152-162, :305-310). A load reset the
player's standing with every social group to zero.

This gap predates the biography. What S3e changed is that reputation
now matters from the FIRST MINUTE of a new character rather than
accumulating quietly over a session, which is what made a load-wipe
visible enough to find. Persisted now, along with the queued faction
deltas and the composed backstory - and the SNAPSHOT detaches from the
live entity, because the quicksave write happens after
`snapshotPlayer` returns, the same law save.js already stated for its
nested effect entries. A pre-17h save leaves the entity's own state
alone rather than nulling it.

**The dungeon host skipped the biography.** It builds its own
`ChargenFlow` and never received the question sets, so a character
created in a dungeon answered no questions at all. This is the THIRD
time this exact host gap has hit this flow - 17f found it for the
starting spellbook and for the starting kit, and here it is one slice
later for the biography. The lesson is not "remember the dungeon
host". It is that anything the flow needs should be handed to it BY
THE SHARED SESSION, the way `createChargenWindow` takes `biogs`, not
wired per host. The dungeon builds its flow by hand and so keeps
missing each new dependency; folding that construction into
chargenSession is the standing fix, and it is now the obvious next
tidy on this arc.

**The reflex info panel is a parchment popup.**
`CreateCharReflexSelect.cs:60-88` calls `SetDaggerfallPopupStyle` on
it and sizes it to its text plus the margins. U13 drew bare rows over
the province map. U11 already owned that frame - a two-line fix that
should have been the first draft.

**Checked and CLEARED:** the level-up sums anchor before the biography
bonuses in the port, and they do in DFU too (the effects are applied
at game start, after the entity setup that computes the sums). The 18
BIOG files loaded at boot mirror the 18 CLASS files already loaded
beside them, and only when chargen actually runs.

Pins: `test/audit17h.test.js`, four tests, each mutation-proven -
including the greeting compared either side of a save round trip,
which is the assertion that would have caught this years of slices
ago.

## AUDIT 17i: THE ONE CONSTRUCTION SEAM (2026-08-18)

Not a parity slice - a root-cause fix for a bug SHAPE that had
recurred three times.

The dungeon host built its `ChargenFlow` by hand while the exterior
hosts went through `createChargenWindow`. So every dependency the flow
grew had to be remembered twice, and each time it was not:

- 17f: the starting SPELLBOOK (a town-created Mage began with none)
- 17f: the starting KIT (`?class=N` minted an empty bag)
- 17h: the BIOGRAPHY (a dungeon-created character answered no
  questions at all)

Three separate audits, three fixes, one shape. Patching a fourth
instance later is not a plan.

**`createChargenFlow(fetchBytes)`** is now the only place a flow is
built. It loads the careers, SPELLS.STD and the eighteen biography
sets, ATTACHES them, and hands back `{ flow, careers, spellsByIndex,
biogs }`. All three hosts call it; `createChargenWindow` no longer
constructs anything, it WRAPS a flow for the exterior overlay seam.
A dependency added tomorrow is added HERE, once, where no host can
miss it.

**The rule is enforced, not remembered.** `test/chargenseam.test.js`
sweeps `src/scenes` and fails if any host contains
`new ChargenFlow(`. A host that news one up gets whatever
dependencies existed the day it was written and silently misses every
one added since - which is exactly how all three bugs happened. The
companion pin proves the seam attaches everything rather than merely
returning it beside the flow.

Probed: `tools/dungeonChargenProbe.mjs` boots the DUNGEON host with no
`?class` and reads its live flow - 18 careers, 12 biography questions.
The host that kept falling behind is the one the probe watches.

A probe lesson worth keeping: the first draft waited on
`__shotReady`, which never fires while a chargen overlay is up -
the modal pauses the scene before frame 5, correctly. Wait on the
thing the probe is actually about.

## U14: THE MENU BACKDROP + THE POINTER PATH (2026-08-18)

Mac, on seeing chargen run: the true menu backdrop, and the pointer
working rather than the keyboard alone. Both are parity gaps, and
both had the same root - the port grew chargen INSIDE the running
world, where classic runs it from the menu.

**The backdrop.** `DaggerfallBaseWindow.cs:40` paints the parent panel
BLACK behind the 320x200 native panel. Classic never shows the world
around a chargen window because there is no world yet. The port drew
the live town through the letterbox on every screen. Black now, drawn
before the screen - and it is OPAQUE, which the pin states plainly,
because a translucent value would look like a design choice and be
the same bug.

**The class picker sits on the screen it came from.** A
`DaggerfallPopupWindow` is pushed OVER the previous window, which
keeps drawing beneath it - so the list is dimmed over the FACE screen,
not over a bare backdrop. Eyeballed: the Redguard portrait and
PREVIOUS/NEXT show through the dim behind the scroll.

**The pointer.** Three gaps, not one:
- the DUNGEON host had NO pointer path at all. Every click went to
  `requestPointerLock`, so chargen there was keyboard-only while the
  exterior hosts had been clickable since U8b. It has an
  `overlayClick` seam now, taking native coords like townTalk's, and
  an open window withholds the pointer lock instead of grabbing the
  mouse behind itself.
- the GENDER buttons were a selection that then demanded a separate
  confirm. `CreateCharGenderSelect.cs:59-71`: both handlers end in
  `CloseWindow()`. The classic box has no OK for the extra step to
  use, so the button sets AND closes.
- `clickNative` gained a pure `applyHit` half, so the pointer path is
  testable without art the way `chargenHit` already was.

**The guard rail.** A screen that ships keyboard-only is invisible on
a phone, and three of them did. `test/chargenpointer.test.js` walks
every chargen state and requires EVERY one of its own controls to
answer a click - not merely one of them, because a screen whose OK
button works while its controls are dead is still keyboard-only in
practice. That is the pin that would have caught all three.

Probed: `tools/chargenClickProbe.mjs` drives a COMPLETE chargen with
clicks alone - the name OK, a province, the race YES, the gender
button, face NEXT and OK, a class row, twelve biography answers, the
reputation box, the stat spinner, three skill spinners, a reflex row
and the final OK. Only the name's letters are typed, as they are in
classic. Out the other end: a Redguard female with Very High reflexes.

RETIRED by U15: the random-name button is live.

## U15 - THE CLASSIC WIZARD ORDER + THE RANDOM NAME BUTTON (2026-08-18)

The port had invented its own chargen order. DFU's is an enum, and it
is not a suggestion - `DaggerfallStartNewGameWizard.cs:63-79`:

    SelectRace, SelectGender, SelectClassMethod/GenerateClass/
    SelectClassFromList/CustomClassBuilder, SelectBiographyMethod,
    BiographyQuestions, SelectName, SelectFace, AddBonusStats,
    AddBonusSkills, SelectReflexes, Summary

The port asked the NAME first and put the FACE early. `STATES` is now
`race, gender, class, biography, name, face, stats, skills, reflexes`
and every transition and `back` target follows it - the race screen is
first, so its `back` returns rather than moving.

**Why the order is not cosmetic.** Two screens read state that the old
order had not collected yet:

- the FACE screen draws RACE-and-GENDER face art. Running it before
  the race is chosen paints faces from whatever race the flow happened
  to be seeded with. The click probe's `click-face.png` now shows a
  Redguard female head because a Redguard female had already been
  chosen two screens earlier.
- `CreateCharNameSelect.cs:112-119` DISABLES the random-name button
  when `raceTemplate == null`. A name screen that precedes the race
  can only ever draw that button dead. This is what finally forced the
  reorder: the flag U14 left could not be cleared without it.

**The button.** `getNameBank(raceKey)` in `characters/nameHelper.js`
is `MacroHelper.GetNameBank` (`MacroHelper.cs:344-366`) - the eight
player races onto `NameHelper.BankTypes`, with the quirk DFU's own
enum comment spells out: ARGONIAN maps to the IMPERIAL bank, because
"Imperial names appear where one would expect Argonian names"
(`NameHelper.cs:50`). Unknown races fall to Breton, which is the C#
`default` arm sharing the Breton case. The button mints
`fullName(getNameBank(race), gender)` - the same NAMEGEN path the rest
of the port already used for NPCs - and is drawn at
`RECTS.randomName = [279,3,36,10]` on a grey `[0.5,0.5,0.5,0.75]`
backing with the verbatim shadowed label.

**The pin that mattered.** The first draft asserted the button
returned some non-empty string. That passes while wired to the WRONG
bank - a Khajiit handed Breton names is still a name. The pin now
seeds `srand(12345)` and requires the button's output to equal a
direct `fullName(getNameBank(race), gender)` call character for
character, so the bank and the gender are both pinned, not just the
liveness.

Probed: `tools/chargenClickProbe.mjs` walks the new order by clicks
alone and exercises the random button on the way through. Out the
other end, unchanged: a Redguard female with Very High reflexes -
named `Rlillki` by the button, not by the keyboard.

## U17 - THE CLASS PICKER + THE THREE SKILL SPINNERS (2026-08-18)

Mac's report: **double-tapping to select a class does not work.** It
is worse than that - there was no pointer path off the class screen at
all, and the probe had been papering over it with a keyboard press and
a comment admitting why ("no OK button on the picker").

**The list is a ListBox, and a ListBox has two gestures.**
`MouseClick` (`ListBox.cs:500-504`) sets `selectedIndex` and raises
`OnSelectItem` - it SELECTS and nothing more. `MouseDoubleClick`
(`:507-512`) calls `UseSelectedItem`, which is what raises
`OnUseSelectedItem` -> `OnItemPicked`. Return does the same
(`:296-297`). The port had folded both into one click and then wanted
a confirm the picker has no button for.

The double-click window is `doubleClickDelay = 0.3f`
(`BaseScreenComponent.cs:54`), and the test at `:691` is on TIME
ALONE - the second click need not land on the same row, because
`MouseClick` has already moved the selection there by the time
`MouseDoubleClick` reads it. So a fast pair across two rows picks the
second one, verbatim.

**And picking is not choosing.** `DaggerfallClassSelectWindow_OnItemPicked`
(`CreateCharClassSelect.cs:70-96`) opens the class's DESCRIPTION in a
Yes/No box on `TEXT.RSC 2100 + index`, exactly as the race screen does
on its own template id. Yes closes both windows; No drops the
selection and returns to the list. The port had no such box, so it
also never showed the player what the class they were choosing
actually was.

**The three skill spinners.** `SkillsRollout` carries THREE
`LeftRightSpinner`s, not one (`:41-46`, `:240-262`), each with its own
selected skill (`SelectPrimarySkill` and its two siblings, `:356-372`)
and its own `Value` - that group's remaining pool. The port collapsed
the nine rows onto one cursor and drew a single spinner, so two of the
three pools were invisible until the cursor happened to walk into
them. All three draw now, each on its group's own selected row.

The flat cursor survives as the KEYBOARD's walk - classic has no
keyboard on this screen at all - and moving it keeps the group
selection underneath it in step. One consequence worth naming: a walk
necessarily re-selects every row it passes through, where a click
jumps. That is the flat cursor's own artefact, not something DFU has
an opinion about.

Probed: the click walk now selects a row with one tap (and pins that
it does NOT pick), picks it with a double tap, reads the description
box and presses YES - all by pointer. Eyeballed: the Battle Mage
description on the parchment with YES/NO, and the skills screen with
all three spinners showing 6.

## U16 - THE SUMMARY SCREEN (2026-08-18)

`WizardStages.Summary` was the last stage the port did not have, and
it is the one that CLOSES the wizard: `ReflexSelectWindow_OnClose`
goes to `SetSummaryWindow`, and it is `SummaryWindow_OnClose` that
calls `StartNewGame`. The port had been ending on the reflex screen.

`CreateCharSummary` is barely a layout of its own. Setup (:63-96)
COMPOSITES components that already exist onto `CHAR04I0.IMG`:

| component | where | already ported for |
|---|---|---|
| `StatsRollout` | (8,33) step 22 | the stats screen |
| `SkillsRollout` | groups at 32 / 81 / 130 | the skills screen |
| `FacePicker` | (247,25) 64x40 | the face screen |
| `ReflexPicker` | **(246,95)** | the reflex screen, at (127,148) |
| `TextBox` | **(100,5)** 214x7 | the name screen, at (80,5) |

Only the last two move. `ReflexPicker` is a self-contained 66x45 panel
its host merely POSITIONS, so it takes an origin now instead of being
written twice - and the four blocks were EXTRACTED from their screens
rather than copied, which is the whole reason this slice is small.

Worth noting for the stats block: `CreateCharSummary` news up
`StatsRollout()` with `onCharacterSheet` false, so the (141,17)/24-step
alternate layout in that class is the CHARACTER SHEET's, not the
summary's. Same geometry as the stats screen, verbatim.

**What the screen actually does.** Nearly every control is live - this
is a review screen you can still edit on. OK is gated on FOUR pools,
not one, because you can take points back DOWN off any of them; an
unspent point pops TEXT.RSC 14 ("You must distribute your bonus
points") on U11's parchment rather than closing. RESTART is a SOFT
restart: `SetRaceSelectWindow` with the document intact, so a player
who re-picks the same class keeps the roll (the 17j F7 rule).

**Two things the port had to change underneath.**

- The stats and skills rollouts needed INDEPENDENT selections. One
  shared `cursor` was fine while they were separate screens; the
  summary draws both, and a click on a skill row would have moved the
  stat spinner.
- The biography reset moved onto `_enterBiography`. AUDIT 17j F3 put
  it on the NAME screen's cancel, which was the only arrival that
  existed then. RESTART is a second one, and it would have walked back
  through the questions with the previous run's effects still in the
  list, applying every one of them twice. DFU never reuses that window
  - both `SetBiographyWindow` and `SetChooseBioWindow` construct a
  fresh `CreateCharBiography` over a fresh `BiogFile` - so every
  arrival resets, and now every arrival goes through one door.

**One verbatim quirk, ported deliberately.** `SetSummaryWindow`
assigns `CharacterDocument` on every push, and that setter zeroes all
four pools (:119-136). So: un-spend a point ON the summary, back out
to the reflex screen, come forward again, and the pool is zeroed while
the lowered value stands - the point is gone. DFU does exactly that.

**What the screenshot caught.** The seven DERIVED labels (damage,
encumbrance, spell points, magic resistance, to-hit, hit points,
healing rate) had been folded into the shared stats block. They belong
to `CreateCharAddBonusStats`' OWN panel (:94-100) - `StatsRollout` has
never heard of them - so the summary drew them across its skill
panels: "+BRIMARY SKILLS", a stray 110 over the Axe row, a +0 between
two groups. No test would have found that; eyeballing did.

FLAGGED: DFU's `SkillsRollout` carries THREE `LeftRightSpinner`s, one
per group, each with its own selected skill and its own remaining
pool. The port collapses that to one cursor over all nine rows and
draws a single spinner. Every point can still be spent, but classic
shows all three pools at once, and the summary is where the difference
becomes obvious. Its own slice.

Probed: the click probe now walks the summary too - it takes a stat
point back down, watches OK REFUSE with the parchment box up, closes
the box, re-spends, moves the reflex pick at the summary's own picker
origin, and only then confirms. Eyeballed: every panel reads, the
green modified values are right, and the gate screenshot shows STR
70 -> 69 with a 1 in the spinner behind "You must distribute your
bonus points."

**AUDIT 17j corrected the back arms.** U15 got the wizard's ORDER
right and every one of its BACK arms wrong, because the order was read
forwards and the cancels then inferred by reading it backwards. DFU
writes its cancel targets out one handler at a time, and three of them
do not step back one screen: the class screen cancels to RACE, the
name screen cancels to the biography method (and DISCARDS the answers
so far), and the stats and skills screens RESTORE rather than reroll.
The U15 back pin asserted the bug. The random-name button was also
deterministic - `Rlillki` on every boot - because DFU reseeds DFRandom
on every push of the name window and the port never did. See Audits.

## U18 - THE CLASS-QUESTIONS PATH (2026-08-18)

The first item off the U17 queue: `WizardStages.SelectClassMethod` and
`GenerateClass` - the two stages between gender and the class list
that the wizard's enum has always named (:67-68) and the port skipped
straight past. A classic player was never sent to the list; they were
ASKED how they want their class chosen.

**The method screen** (`CreateCharChooseClassGen`). BUTN01I0.IMG
centred on the native panel - headerless 26496 bytes = 184x144, so the
panel sits at (68,28) - with both buttons BAKED in the art:
choose-from-a-list at (8,41,167,43), answer-questions at (8,100,167,34).
Both handlers end in `CloseWindow()` (:63-72), so the click sets AND
closes, the U14 gender law again. The wizard's `ChooseClassGen_OnClose`
(:318-328) has NO cancelled arm - ANY close that is not ChoseGenerate
goes to the class list, Escape included - so `back` lands there too,
ported verbatim rather than "one screen up". The popup draws over the
race map dimmed (`previous = createCharRaceSelectWindow`, :144).

**The questions screen** (`CreateCharClassQuestions`). Three format
finds on the way in:

- THE QUESTIONS LIVE IN TEXT.RSC RECORD 9000 AS LITERAL '{' MARKERS.
  Not subrecord separators (0xFF) - the byte 0x7B, inside the text
  range. DFU's string-table importer splits the record on '{' and keys
  the pieces "9000.1".."9000.40" (`SplitQuestionnaireRecord`); the
  port performs the same split on the record's plain text. Each
  question then loses its leading number through the `\d+[.]` split
  law, quirk included (a number-dot ANYWHERE in a line truncates
  everything before it), and the a)/b)/c) row indices come from
  `Contains`, last match wins - all verbatim from `GetQuestions` /
  `DisplayQuestion`.
- THE SCROLL IS THE ONLY GFX CONSUMER IN THE GAME. SCRL00I0.GFX +
  SCRL01I0.GFX are 8 parchment frames each, 320x80, TEXTURE-style RLE
  rows behind a per-row offset table - `src/formats/gfxFile.js` is the
  ninth format reader, GfxFile.cs verbatim. The two files load as ONE
  contiguous 16-frame list (:103-118) and the frame advances with
  every pixel of text scroll, wrapping.
- CHGN00I0.IMG IS PALETTIZED (its own 768-byte palette after the
  pixels, x4 on load) and ImgFile._readPalette writes INTO the palette
  it is handed - so the screen loads it over its OWN DFPalette, never
  the shared ART_PAL. The scroll frames borrow that palette, exactly
  as DFU assigns `scrollFile.Palette = backgroundBitmap.Palette`.

**The logic, verbatim** (`src/systems/classQuestions.js`): ten UNIQUE
questions picked by random start + linear probe; the 40x3 answer
table ripped from FALL.EXE v1.07.213 at 0x0059820C steering each
answer to Warrior/Rogue/Mage weights; and CLASSES.DAT's results walk -
all 66 possible ten-answer triples from offset 18, four slots per
class, the header byte with its left nibble zeroed past slot 3. The
classic anchors hold on the real file: all-warrior is the KNIGHT,
all-rogue the THIEF, all-mage the MAGE. The ten answers then open the
resolved class's DESCRIPTION on TEXT.RSC 2100 + index - the SAME
describeClass source the list's double-click uses - Yes adopting it
into the flow (the careers array is CLASS00..17.CFG in file order, so
the index IS the load), No dropping it to the class list, exactly
`CreateCharClassQuestions_OnClose`'s two arms.

**The constellations.** Answering brightens the answered path's
constellation: palette slots 192/160/128 hold (0,0,blue), blue 8 +
24 per answer, and the background re-uploads from the mutated palette
(versioned textures, stale ones released - the paperdoll ownership
law). The PRISTINE embedded palette shows until the first answer,
as DFU only writes the slots at the first anim's end.

**FLAGGED loud, three departures recorded in the Ledger:** the three
FLC constellation animations (ROGUE/MAGE/WARRIOR.CEL - an Autodesk
FLIC decoder the port does not have) do not play, so the next question
shows immediately where DFU waits out the CEL, and the Ignite one-shot
that rides the answer waits with them; the question label is clipped
to the text window BY ROW where DFU clips by pixel (until the renderer
grows a scissor seam); and the mouse WHEEL is not wired through the
hosts' overlay seam - the scroll answers the click margins (one pixel
per event) and the arrow keys.

**Also on the way through:** the wizard-ORDER flag retired by U15 was
still printed in two file headers (chargen.js, chargenArt.js) - the
sentences deleted, per RETIRING A FLAG DELETES THE SENTENCE. And
tools/chargenProbe.mjs had ROTTED on the pre-U15 order (it typed the
name first, expected the biography to land on stats, and ended before
U16's summary) - the click probe had quietly taken over as the only
live walk. Repaired to the classic sequence; both probes run again.
Port-Ledger housekeeping: a stray `>>>>>>> origin/main` conflict
marker in section C (left by the 2026-08-16 two-lane merge) deleted.

Pins (test/classquestions.test.js, 23 with the pointer sweep): the
answer table deepEqual against the FALL.EXE literal AND every row
covering all three paths; the linear-probe pick under a stuck PRNG;
the nibble law on crafted and real headers; the no-cancel-arm law; the
weights walk (ten a) answers -> [7,1,2] -> Barbarian on the real
file); the description box's Yes/No arms; re-entry freshness; the
blues law; the scroll clamp + frame wrap; the crafted-GFX RLE
round-trip byte-exact; and the corpus gates - all 40 questions parse
with ordered answer rows, all 66 triples resolve on the real
CLASSES.DAT, all 16 scroll frames decode. The U14 pointer sweep now
walks the two new screens too.

Probed by clicks end to end (tools/chargenClickProbe.mjs): the gender
button closes onto the METHOD screen, the questions button opens the
scroll, ten a)-row clicks (auto-scrolled into the click band on long
questions) sum the weights to ten and open the description box, NO
falls to the class list - where the original U17 walk continues
unchanged - and the list path then runs to the finished character.
Eyeballed: the method panel over the dimmed province map, the
parchment scroll under the constellation chart, the description box.

## U19 - THE BIOGRAPHY-METHOD SCREEN (2026-08-18)

`WizardStages.SelectBiographyMethod` - the LAST stage in the wizard's
enum the port skipped. Every class-accept arm in DFU goes to
`SetChooseBioWindow` (:344 for the questions path, :365 for the list,
:401 for the custom builder); the port had collapsed the stage and
sent the class choice straight to the questions.

**The screen** (`CreateCharChooseBio`): BUTN02I0.IMG centred - the
file decodes 184x168, so the panel sits at (68,16) - with both
buttons BAKED in the art: have-your-history-generated at
(8,41,167,54), answer-questions at (8,113,167,46). Both handlers end
in `CloseWindow()`, so the click chooses AND closes (the U14/U18
law); the popup draws over the race map dimmed (previous =
createCharRaceSelectWindow, :180); Escape cancels to the CLASS LIST
(the OnClose cancel arm :458-461).

**The GENERATE arm** (`CreateCharChooseBioWindow_OnClose` :427-452):
a fresh BiogFile, every question answered at `rand.Next(0,
answers.Count)` - `new System.Random(DateTime.Now.Millisecond)` is an
engine PRNG, so it rides the flow's injectable rolls (Ledger A) -
each chosen answer's effects added through the SAME tagEffect the
manual path uses, then DigestRepChanges and the ClickAnywhereToClose
reputation box on TEXT.RSC 35, shown OVER the method screen (the
wizard pushes it over createCharChooseBioWindow, :444). Closing it
goes to the name screen (`ReputationBox_OnClose` :464-467). The
backstory composes from the rolled answers, exactly as the manual
path's does.

**Three cancel arms rewired onto the stage.** The name screen's
cancel returns HERE (:483-493) - 17j F3 had collapsed it onto the
questions; the BIOGRAPHY's own cancel comes here too (:477-480),
which the port simply lacked; and the method screen's Escape falls
to the class list. The fresh-BiogFile reset now rides BOTH arms
(the U16/17j double-apply law), extracted with the biography's
closing tail (`_resetBiography` / `_finishBiography`) so the manual
and auto paths share one implementation - ONE DFU MEMBER, ONE
EXPORT.

**Also: the stale queue entry retired.** "The dungeon-host
worn-weapon binding" had sat in the queue since U8h flagged it -
but AUDIT 17e F17 moved the bind INTO createWeaponRig (every host
that passes an entity inherits it), and 17k's fist crash proved the
dungeon binding live (the null weapon CAME from the bound empty
hand). Retired with this record rather than re-shipped.

Pins (test/biomethod.test.js, 6): every class-accept arm lands on
the method screen and a missing question set skips it; the questions
arm resets; the generate arm's pick law pinned at both PRNG extremes
(rolls 0 -> answer a everywhere, rolls .999 -> the LAST answer, every
effect of a multi-effect answer landing); generating twice cannot
double-apply; the three cancel arms; the pointer path (both DFU
rects, the dead zone, the modal reputation box eating the buttons).
The U14 pointer sweep walks the new screen.

Probed both ways: the KEYBOARD probe takes the generate path -
BUTN02I0 eyeballed, one Enter auto-answers all twelve, the
reputation box shows OVER the method screen with the run's own
totals, and those totals land verbatim on the entity
(sGroupReputations[0..5] deepEqual the digest - the pin is the run's
OWN numbers now that the answers are random). The CLICK probe keeps
the manual path: the questions button by tap, then the twelve
answer clicks as before.

## U20a - THE CUSTOM-CLASS BUILDER (2026-08-18)

`WizardStages.CustomClassBuilder` - the last chargen SCREEN the port
did not have. With it, every stage in DFU's wizard enum exists.

**The way in.** `CreateCharClassSelect` appends ONE row after the
eighteen CLASS*.CFG careers (:66-67) and that row is Custom; picking
it sets `selectedClass = null` and closes with NO description box and
no drums (:72-77). The port's list had only ever known its careers,
so the row is new state (`classRowCount`/`classRowName`) - and the
LIVE PROBE caught both bugs that came with it: `careers[classIndex]`
THREW on the highlighted row (DFU's selectedClass is simply null
there), and the list's click bound was still `careers.length`, so the
row answered the keyboard and NOTHING to a tap - the U14
keyboard-only shape again.

**The builder** (CUST00I0.IMG full-screen): the name TextBox at
(100,5), a StatsRollout in FREE EDIT (values clamp 10..75, the pool
is a zero-sum ledger that may go negative, and modified values do NOT
turn green because freeEdit's modifiedStatTextColor IS the default
colour), twelve skill buttons at their verbatim rects each opening a
list picker of the UNASSIGNED skills alphabetically, the HP spinner
(4..30), the HELP picker over eight TEXT.RSC topics, the REPUTATIONS
window, and EXIT behind four gates in DFU's order: no name (301), a
skill unset (300), an unbalanced pool (302), the dagger in the red
(306).

**The difficulty gauge, verbatim.** Points are +1 per HP above the
default and -2 per HP BELOW it; the advancement multiplier is
`0.3 + 2.7*(points+12)/52` - exactly 0.3 at the legal floor and 3.0
at the ceiling; and the dagger's Y walks 115 up toward 46 or down
toward 186 with C#'s `(int)` TRUNCATION, not rounding.

**The reputation window** (CUST03I0, centred on DFU's half pixel -
Unity's Middle alignment on a 189-tall image really is 5.5): five
columns whose bars are flat colour panels, the click's column picked
by x threshold and its sign by which side of the middle line it fell,
the value `+-(height/5)` after RoundNearestBarHeight's own quirk (a
remainder of exactly 4 rounds UP, 1..3 round DOWN, capped at 50), and
an exit gated on the NEGATED sum being zero (303).

**What the finished class carries out** (`CreateCharCustomClassWindow_
OnClose` :374-401): the typed name onto the career, the working stats
copied onto its base attributes, `BiogFile.GetClassAffinityIndex`'s
best-overlap index onto classIndex - which is what picks the
BIOGRAPHY QUIZ - and the five reputations onto the document, where
they SEED sGroupReputations before the biography's own changes add on
top. A custom class's starting spells follow
`SetStartingSpells`' custom arm: the SPELLSWORD set if any PRIMARY or
MAJOR skill is one of the six magic schools, none otherwise (a magic
MINOR does not qualify).

**Three verbatim quirks ported deliberately, one of them ugly.**
`isCustom` is assigned in exactly ONE place in the whole DFU codebase
- `= true` when the Custom ROW is picked (:358) - and is never
cleared. So opening the builder, cancelling out of it and then
picking a standard class leaves a document that still says custom:
ItemHelper gives it the custom starting kit and StartGameBehaviour
routes it through the custom spell rule. The first draft of this
slice "tidied" that by clearing the flag on every standard accept,
and the parity review caught it. The reputations ride the same rule.
And a click exactly ON the rep window's middle line ZEROES that
group (repVal is computed on every click) while moving no bar.

**Two pre-existing defects the slice's own review surfaced and fixed.**
DFU's `ListBox.SelectPrevious/SelectNext` CLAMP at the list's ends
(:709-740); the port wrapped with a modulo, so the class list ran off
its own ends onto the far one - and this slice's first draft asserted
the wrap in a pin. (The FacePicker's wrap is that component's own law
and stays.) And the stats/skills REROLL MEMO keyed on `classIndex`,
which was equivalent while every class came from the list - but a
custom class carries the AFFINITY index, so a custom whose affinity
matched a previously rolled class restored that class's roll instead
of rolling for the new career. DFU compares the CAREER object
(`DFClass != characterDocument.career`), and so does the port now.

**And one the probe caught in a neighbouring host.** Typing "Scout"
read back "scout": the exterior hosts' key router handed the overlay
only `e.code`, so `codeToKey` lowercased every letter and a typed
character NAME could never carry a capital there. The dungeon host
never had it - `routeKey` passes the real event. The event rides
along now, and a source sweep pins the seam.

FLAGGED to U20b: `CreateCharSpecialAdvantageWindow` - the builder's
two Edit Special Advantages/Disadvantages buttons answer loudly and
the difficulty tally's advantage/disadvantage terms stay 0 until it
ships. Recorded in the Ledger: the hidden ResetBonusPool shortcut,
the dagger's fading trail, and the rep window's stale-bar quirk.

The class-index CONFLATION this paragraph used to carry as a fourth
item is FIXED, not recorded - see AUDIT 17m. The sentence claimed the
Ledger held it and the Ledger never did, which is the drift the
Ledger exists to prevent: a departure narrated in an arc doc but
absent from the table is not recorded at all.

Pins (test/customclass.test.js, 28): the difficulty tally and its
multiplier at both ends of the legal band; the dagger's truncation
and clamps; the picker's alphabetical unassigned list; the built
career's DFCareer defaults, skills and stats, with its x0.50 spell
multiplier decoded through the port's OWN reader; the affinity
index's tie rule; the custom spell rule at every arm including the
magic-MINOR negative; the bar rounding quirk; the column thresholds
and the sign rule; the balance ledger; the Custom row's null career
and its clickability; the freeEdit clamps and the ledger's
conservation; the four exit gates in order; the affinity + reputation
handoff; the isCustom quirk both ways; the sub-windows' modality; and
the typed-capitals seam.

Probed live by clicks (tools/customClassProbe.mjs): eighteen clicks
of the picker's own NEXT arrow to reach Custom, a double click into
the builder, twelve skills through twelve pickers, the HP spinner
moving the difficulty 0 -> 6, the name TYPED with its capital, the
stat gate refusing and clearing, the reputation window's own gate
refusing until balanced, and out through the rest of the wizard. The
entity at the end: career Scout, 11 HP/level, advancement 1.0788
(0.3 + 2.7*15/52), the Spellsword spell set from its magic primary,
the custom starting kit, and sGroupReputations carrying the builder's
seed with the biography's changes added on top. Eyeballed: the stone
window with its three skill panels and the dagger exactly on AVERAGE,
and the reputation window with its green bar and refusal parchment.

## AUDIT 17m - the picker's row is not the document's class

2026-08-18. U20a's own adversarial review came back after the slice
had shipped, and one finding survived every lens: the port carried
DFU's TWO class indices in ONE field.

DFU keeps them apart and the separation is load-bearing.
`characterDocument.classIndex` is the document's class, written in
exactly three places - DaggerfallStartNewGameWizard.cs:343 (the
questions path), :364 (a list pick, copying the window's
SelectedClassIndex across) and :382 (a custom class's biography
AFFINITY). `listBox.SelectedIndex` is CreateCharClassSelect's own
highlighted row; the wizard never writes it, and it SURVIVES a
revisit because SetClassSelectWindow (:158-167) reuses the window
behind a `== null` guard - unlike SetCustomClassWindow (:170-175),
which reconstructs every time.

The port's single `classIndex` was both. So `customExit`, writing the
affinity for the biography quiz, also moved the class picker and
scrolled to it. The consequence was a lost character, not a cosmetic
slip: build a custom class, press Escape off the biography-method
screen (the wizard's own cancel arm, :458-461), and the list came
back with a STANDARD class highlighted. Confirm there and `useClass`
took the non-Custom branch into `_acceptStandardClass`, which nulls
`customCareer` - the built class was gone and the player became a
class they had never picked. DFU, with the Custom row still selected,
re-opens the builder.

The fix is the second field, not a guard: `classListIndex` is the
picker's row and `classIndex` is the document's. Every list gesture -
the arrow clamp, the click, the row hit, the Custom-row test, the
description lookup, both draws - moves the picker; the document is
written only by the three accept arms, and `_acceptStandardClass`
now performs :364's copy explicitly instead of inheriting it from the
shared field. `_adoptCareer` is the shared tail so the two arms cannot
drift apart again.

Found on the way, and fixed with it: the builder's keyboard had a
LIVE `plus` arm against a DEAD `minus` one. The shared overlay table
(ui/input.js:18) matches `-` inside its character class first, so the
minus arm never fired from any host - but `+` is not in that class and
fell through to spend a point. A keyboard could take from the freeEdit
pool and never give back. DFU has no keyboard stat control on this
screen at all (StatsRollout's steps are UpDownSpinner *Button*
handlers, :231-256 and :259-281, mouse only) while the name TextBox
holds focus unfiltered, so a typed `-` belongs in the CLASS NAME,
which is what the port already did. The `plus` arm is gone; the pool
moves by click. Residual, deliberate and small: DFU would type a
literal `+` where the port's shared table has already spent that key
on the stats and skills screens, so `+` is inert here rather than
typed.

And a documentation find that matters more than its size. This arc
doc claimed the conflation was "Recorded in the Ledger". It was not -
there is no such row, and there never was. A departure narrated in an
arc doc but missing from the Ledger table is not recorded at all, and
the claim actively hid the defect: a reviewer checking whether the
behaviour was known would read the sentence and stop. The sentence is
deleted rather than backfilled, because the departure is fixed.

Pins (test/audit17m.test.js, 6), every one mutation-proven - restoring
the original defect fails three of them: the affinity landing on the
document with the picker untouched; the whole back-out path ending in
the BUILDER with the career intact; a list pick copying the row only
on accept; the questions path leaving the picker alone; the builder's
keyboard moving no stat while `-` types; and a source sweep failing if
`customExit` ever writes the picker again or the list art draws the
document index.

## U20b - the special advantages / disadvantages window

2026-08-18. `CreateCharSpecialAdvantageWindow` - the last chargen
window the port lacked, and the one that makes U20a's two difficulty
terms real.

This was never "a missing screen". U20a shipped
`difficultyPoints(hp, advantageAdjust, disadvantageAdjust)` and nothing
ever passed the last two arguments, so the whole
advantage/disadvantage balance was inert: the tally fed
`advancementMultiplier`, which became `career.advancementMultiplier`,
which `advancement.js` consumes in `skillUsesForAdvancement`. Every
custom class advanced at its HP-only rate however many advantages it
took on. A Scout with Immunity To Fire now carries a multiplier of
1.442 where it read 0.923 - the balance lever the builder is FOR.

ONE window serves both lists: CUST01I0 is the body and CUST02I0 (168x31)
lays over its top strip to retitle it from Disadvantages to Special
Advantages (:243-254), which is why only the advantages arm draws the
overlay. The panel is Left/Top (:236-237), NOT the Center/Middle the
reputation window uses (:110-111) - and the screenshot proves that
deliberate rather than a DFU slip: the window covers the left half and
leaves the builder's control column AND THE DIFFICULTY DAGGER visible
on the right, so you watch the dagger climb as you add advantages.
Every rect is relative to that origin, which is why the add button sits
at x=80 and the exit strip spans 6..161 inside a 168-wide panel.

THE STRINGS were the slice's real obstacle. DFU resolves them through
`TextManager` from HardStrings KEYS, and the display text lives in
StreamingAssets, which the sparse Scripts checkout does not carry. They
are not in TEXT.RSC either - I searched every record of the real file
and found nothing, because they were hard-coded in FALL.EXE, which is
in neither the data directory nor DaggerfallGameFiles.zip. The
recovered text is DFU's `Internal_Strings.csv`, fetched out of the repo
tree, whose own header says it "stores text that was hard-coded in
FALL.EXE" - so the labels are classic's, by way of DFU's recovery.

THE BIT LAYOUT was ground-truthed before anything was built on it. The
port keeps a career in its raw CLASS.CFG bitfield form, not DFU's
decoded properties, so `parseCareerData` writes bitfields: forbidden
proficiencies at 0..5 and expert at 16..21 of one u32, armors at 6..8,
shields at 9..12, the special abilities in the ability bitfield's low
byte with light magery at 6..7, darkness at 8..9 and the spell-point
multiplier at 10..12 above them. Decoding the real 18-class corpus
through those positions returns exactly what classic's classes should
be - Archer is the one class expert in missile weapons, Sorcerer
carries noRegenSpellPoints, Monk forbids all three armors, Warrior
forbids nothing, Knight forbids leather - which is the check that the
positions are right rather than merely self-consistent.

The pins decode back through the port's OWN consumers -
`spellPointMultiplier`, `hasSpecialAbility`, `careerAttackModifier` -
rather than re-asserting the literals just written (TEST THE SHAPE THE
PRODUCER MINTS). That is what caught the one real subtlety: Increased
Magery must REPLACE the multiplier bits, not OR into them, because the
builder starts at Times_0_50 and an OR leaves a corrupt value.

Counted rather than remembered: the difficulty table has FIFTY entries,
not the 53 an earlier reading of this slice recorded. The port's table
diffs key-for-key against the C# literal with no duplicates, and the
pin asserts 50.

One departure, recorded in the Ledger: DFU pushes a half-built item
onto the list before opening the secondary picker and pops it on
cancel; the port never pushes it. Same end state, and no frame in which
a redraw could catch a primary with no secondary under it.

Pins (test/specialadvantages.test.js, 27), each mutation-proven -
dropping the two adjust terms from the tally fails four of them, and
the ONLY-ONE limit, the equal-secondary pair rule, the magery replace
and the expert-proficiency shift each fail their own. Probed live by
clicks: the window over the builder, an eleven-row primary list, a
secondary pick landing as Immunity/To Fire with the +6 tandem squish,
the dagger moving off AVERAGE because of it, a label click removing it
and the tally following, and immunityFlags 8 on the built career at the
far end.

## AUDIT 17n - the parity pass over U20b

2026-08-18. Mac asked for a comprehensive audit after U20b shipped.
The data transcription came back clean; the wiring did not.

WHAT WAS CLEAN, checked mechanically rather than by eye: the 50-entry
difficulty table diffs key-for-key AND value-for-value against the C#
literal with no duplicates; all 71 display labels match DFU's recovered
FALL.EXE text exactly; every secondary list matches its DFU array in
order; the builder is reconstructed on re-entry on both sides, so the
pick lists reset; a career's flags survive the save round trip (the
career is spread as plain CFG data, save.js:61,88 - worth checking
because AUDIT 17h caught exactly this shape dropping player
reputation); and parseCareerData leaves every numeric field finite and
unsigned under the maximal fourteen-pick set.

F1 - THE ENEMY-TYPE ATTACK MODIFIER HAD NEVER APPLIED TO ANYBODY, and
it was broken in two independent places, which is why neither half
showed up as an obvious bug.

DFU reads `attacker.Career.<group>AttackModifier` for every attacker
(FormulaHelper.cs:993-1030). The port flattened that byte onto the
entity, and only the FOE builder ever set it (enemyEntity.js:105). A
player carries `career` and no flat field, so
`bonusOrPenaltyByEnemyType`'s null guard returned 0 on every swing.
That alone would have been enough.

Underneath it, a second break: `calculateAttackDamage` resolves
`targetGroup` and threads it to the monster branch and the
hand-to-hand branch, but the WEAPON branch called
`weaponAttackDamage` without it - and that function read
`target.group`, a field NOTHING in the codebase mints. So even a
correctly-flagged attacker got nothing through the path players
actually use. DFU has one call taking the target entity
(FormulaHelper.cs:788) and derives the group inside it; the port split
that apart and only carried the group down one of the two forks.

The target half of the player's swing was correct all along -
playerWeapon.js:159 passes `enemyGroupOf(foe.entity.affinity)` - which
is precisely why this looked wired.

This is NOT a U20b regression. The classic ASSASSIN ships
attackModifierFlags 0x04, a Humanoid bonus, and has never received it;
the gap dates to the combat arc. U20b only made the same modifier
purchasable, at 3-6 difficulty points for a bonus and -4 for a phobia,
which is what turned a dormant gap into one the player pays for.

F2 - WHICH PICKS ACTUALLY DO ANYTHING. A window that writes a career
flag no system reads is not a working feature, and the slice must not
imply otherwise. Catalogued in the Ledger rather than left to be
rediscovered. LIVE: Increased Magery (maxMagicka reads the
multiplier), the tolerance quartet (spellcast.js), Rapid Healing
(rest.js), Inability To Regen Spell Points, and - after F1 - Bonus to
hit and Phobia. INERT for want of a consuming subsystem: Spell
Absorption, Regenerate Health, Acute Hearing, Athleticism, Adrenaline
Rush, Damage From Sunlight/Holy Places, and all four Forbidden
categories plus Expertise In. The flags are written correctly and
persist; they simply have no reader yet.

F3 - U20b UNBLOCKS THREE STANDING INTERIMS. Two source notes said the
career advantage flags "pend" a decode - formulas.js on adrenaline
rush and dungeonContext.js on the Athleticism fatigue multiplier.
That decode now exists (SPECIAL_ABILITY_BITS beside
rest.js's hasSpecialAbility), so what actually pends is the EFFECT,
not the read. Both sentences re-pointed rather than left to imply a
missing capability the port now has.

Pins (test/audit17n.test.js, 7), each mutation-proven - reverting
either half of F1 fails three and one respectively, and dropping the
level scaling fails three. F1 is pinned on both entity shapes, on an
attacker carrying neither, through real damage via
calculateAttackDamage, and against the real CLASS11.CFG so the
Assassin claim fails if the corpus ever disagrees.
