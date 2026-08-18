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
