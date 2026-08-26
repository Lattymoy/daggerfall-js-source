// THE ENHANCED SKIN'S STYLE, in one place and injected once.
//
// It lived in menu.html's <style> while the menu was only a prototype
// page. It cannot stay there now that the game mounts the same screen:
// two copies of a design language is how the front door and the rooms
// behind it drift apart, and this project has caught that shape often
// enough to have a rule about it (ONE DFU MEMBER, ONE EXPORT - the
// same argument applies to something that is ours).
//
// A STRING RATHER THAN A .css FILE, deliberately: index.html carries
// no stylesheet link and the game is a canvas, so the enhanced screens
// pay for their CSS only when one of them is actually mounted. A
// player who chose classic never loads a byte of this.
//
// The tokens are the ones enhanced.html established. Brass and
// verdigris are Daggerfall's own - its chrome is carved stone with
// brass fittings, and verdigris is what brass becomes - and the ground
// is a blue-black rather than a true black, because Skyrim's void is
// right for a cold empty north and wrong for the Iliac Bay, which is a
// place with weather in it.

export const ENHANCED_CSS = `
/* ── TOKENS ────────────────────────────────────────────────
   Identical to enhanced.html on purpose. The menu and the in-game
   screens are ONE interface seen at two moments, and the moment a
   front door owns its own palette it stops being the same
   product as the rooms behind it. */
:root {
  --ink: #0e1013;
  --slate: #171b21;
  --iron: #2b323b;
  --bone: #e9e4d9;
  --dim: #8b8578;
  --brass: #c08a3e;
  --blood: #8c3a32;
  --verdigris: #4e7f72;

  --display: 'Cormorant', Georgia, serif;
  --data: 'Barlow Semi Condensed', system-ui, sans-serif;

  --side: 264px;
  --gap: 1px;
}

* { box-sizing: border-box; }
html, body { height: 100%; margin: 0; }
body {
  background: var(--ink);
  color: var(--bone);
  font-family: var(--data);
  font-size: 15px;
  -webkit-font-smoothing: antialiased;
  overflow: hidden;
}
button { font: inherit; background: none; border: 0; color: inherit; cursor: pointer; text-align: left; }
#app { height: 100dvh; }

/* ── SHELL ─────────────────────────────────────────────────
   Two columns and nothing else. Daggerfall's own start screen is
   a picture with three words painted on it; the words are the
   whole interface, so they get a column of their own and the
   other column answers them. */
.shell {
  height: 100%;
  display: grid;
  grid-template-columns: var(--side) 1fr;
  gap: var(--gap);
  background: var(--iron);
}
.side { background: var(--ink); display: flex; flex-direction: column; min-height: 0; }
.pane { background: var(--slate); overflow: auto; min-height: 0; }

/* ── BRAND ─────────────────────────────────────────────────
   The wordmark is TYPE, not the classic .IMG. PICK03I0 has its
   labels painted into the bitmap at 320x200, which is the exact
   thing this overhaul exists to stop doing: art that carries text
   cannot reflow, cannot scale and cannot be read on a phone. */
.brand { padding: 30px 22px 24px; }
.brand h1 {
  font-family: var(--display); font-weight: 300; font-size: 34px;
  letter-spacing: 0.03em; margin: 0; line-height: 1;
}
.brand .sub {
  color: var(--brass); font-size: 11px; letter-spacing: 0.26em;
  text-transform: uppercase; margin-top: 9px;
}

/* ── RAIL ──────────────────────────────────────────────────
   Six destinations, one press each. Classic makes you leave the
   menu to reach settings and gives mods nowhere to live at all.
   Everything is here, and what is not built yet is here too,
   saying so. */
.rail { padding: 6px 0 20px; flex: 1; min-height: 0; overflow: auto; }
.railbtn {
  display: block; width: 100%; padding: 13px 22px; min-height: 48px;
  border-left: 2px solid transparent; color: var(--dim);
  letter-spacing: 0.05em;
}
.railbtn:hover { color: var(--bone); }
.railbtn.on { color: var(--brass); border-left-color: var(--brass); background: #12161b; }
.railbtn .rk { display: block; font-size: 15px; }

.foot {
  padding: 14px 22px max(18px, env(safe-area-inset-bottom));
  border-top: 1px solid var(--iron); color: #5f5b53; font-size: 11px;
  letter-spacing: 0.08em;
}
.foot span { color: var(--dim); }

/* ── PANE HEAD ─────────────────────────────────────────────
   ONE LINE. It carried a kicker, a title and a blurb, which is
   the rail's own word said three times before the player reaches
   anything they can press. */
.head { padding: 28px 30px 18px; border-bottom: 1px solid var(--iron); }
.head h2 { font-family: var(--display); font-weight: 300; font-size: 30px; margin: 0; }

/* U51: A READING COLUMN. The body had no width at all, so a card
   carrying three lines stretched the full 1500px of a desktop pane and
   every screen but Settings - which owns its own three columns - read
   as mostly empty. The cap is the measure the .empty paragraph already
   uses one rule down (58ch), rounded to a pixel the cards can share,
   and it is
   LEFT rather than centred so the column starts on the same x as the
   heading above it. */
.body { padding: 24px 30px 40px; max-width: 720px; }
.body.flush { padding: 0; max-width: none; }

/* ── CARDS + ACTIONS ───────────────────────────────────────── */
.card { border: 1px solid var(--iron); padding: 20px; margin-bottom: 16px; background: #12161b; }
.card h3 { font-family: var(--display); font-weight: 400; font-size: 22px; margin: 0 0 4px; }
.card .meta { color: var(--dim); font-size: 13px; margin: 0 0 16px; }
.stats { display: grid; grid-template-columns: auto 1fr; gap: 7px 18px; margin: 0 0 18px; }
.stats dt { color: var(--dim); font-size: 12px; letter-spacing: 0.1em; text-transform: uppercase; }
.stats dd { margin: 0; font-variant-numeric: tabular-nums; }

.acts { display: flex; gap: 8px; flex-wrap: wrap; }
.act {
  padding: 12px 20px; border: 1px solid var(--iron); color: var(--dim);
  letter-spacing: 0.06em; min-height: 46px;
}
.act:hover { color: var(--bone); border-color: var(--dim); }
.act.primary { border-color: var(--brass); color: var(--brass); }
/* A value pill inside a settings row is drawn compact (a 44px pill
   beside a 44px row is a wall of brass) and TARGETED at 44 the same
   way the stepper is. */
.row .act { position: relative; }
.row .act::after {
  content: ''; position: absolute; left: 50%; top: 50%;
  transform: translate(-50%, -50%);
  width: 100%; height: 44px; min-width: 44px;
}
.act.primary:hover { background: var(--brass); color: var(--ink); }
.act[disabled] { opacity: 0.4; cursor: not-allowed; }
.act[disabled]:hover { color: var(--dim); border-color: var(--iron); }

/* ── EMPTY STATE ───────────────────────────────────────────
   THE ANTI-LIE LAW, borrowed from the char sheet's withheld
   logbook: a thing that does not work yet is shown and says why.
   It is never shown working, and never quietly absent. */
.empty { border: 1px dashed var(--iron); padding: 26px 22px; margin-bottom: 16px; }
.empty h3 { font-family: var(--display); font-weight: 400; font-size: 21px; margin: 0 0 8px; color: var(--dim); }
.empty p { color: var(--dim); margin: 0 0 10px; max-width: 58ch; font-size: 14px; }
.empty p:last-child { margin-bottom: 0; }
.tag {
  display: inline-block; font-size: 10px; letter-spacing: 0.18em; text-transform: uppercase;
  color: var(--brass); border: 1px solid #3a3226; padding: 3px 8px; margin-bottom: 12px;
}
.tag.grey { color: var(--dim); border-color: var(--iron); }

/* ── SETTINGS: RAIL | LIST | DETAIL ────────────────────────
   The same three-pane shape the in-game screens use, because it
   is the same problem: too many rows to show at once, and no row
   that may be deleted. Disclosure, not deletion. */
.panes { display: grid; grid-template-columns: 178px minmax(280px, 1fr) minmax(280px, 340px); gap: var(--gap); background: var(--iron); height: 100%; min-height: 0; }
.subrail { background: var(--ink); overflow: auto; padding: 8px 0; }
.list { background: var(--slate); overflow: auto; }
.detail { background: #12161b; overflow: auto; }

.subbtn {
  display: block; width: 100%; padding: 11px 16px; min-height: 46px;
  border-left: 2px solid transparent; color: var(--dim); font-size: 14px;
}
.subbtn:hover { color: var(--bone); }
.subbtn.on { color: var(--brass); border-left-color: var(--brass); background: #12161b; }
.subbtn .count { float: right; font-size: 11px; color: #5f5b53; font-variant-numeric: tabular-nums; }
/* The affordance for "tap me again to read about this group and reset
   it" - the only way to the category card on a phone (AUDIT F8). It
   shows on the ACTIVE tab only, because that is the only tab the
   gesture applies to. */
.subbtn .more-dot { display: none; }

.row {
  display: flex; align-items: center; gap: 14px; width: 100%;
  padding: 11px 18px; min-height: 52px; border-bottom: 1px solid #20262e;
}
.row:hover { background: #12161b; }
.row.on { background: #12161b; box-shadow: inset 2px 0 0 var(--brass); }
.row-main {
  flex: 1; min-width: 0;
  /* THE WHOLE ROW HEIGHT, not the height of the words in it. This was
     a 19px target inside a 52px row - the label sized itself and the
     36px of row around it hit nothing at all. */
  align-self: stretch; display: flex; flex-direction: column; justify-content: center;
  padding: 6px 0; min-height: 44px;
}
.row-name { font-size: 14px; }
.row.blocked .row-name { color: var(--dim); }

/* THE CONTROL IS THE VALUE. A row shows the word a player reads,
   never the ini string - \`4\` reads Beautiful, \`True\` reads On.
   (settingsLaw.formatValue owns that, and this borrows it whole.) */
.ctl { display: flex; align-items: center; gap: 2px; flex: 0 0 auto; }
.val {
  min-width: 76px; text-align: right; font-variant-numeric: tabular-nums;
  color: var(--brass); font-size: 14px;
}
.row.blocked .val { color: #5f5b53; }
.step {
  width: 34px; height: 34px; display: grid; place-items: center;
  border: 1px solid var(--iron); color: var(--dim); margin-left: 6px;
  position: relative;
}
.step:hover { color: var(--bone); border-color: var(--dim); }
/* AUDIT 24's finding, and this file FAILED IT until 2026-08-25.
   The drawn size and the TARGET size really are two rects - a 44px
   pill reads as a button bar and a 34px target is not a thumb - but
   the rule that was here said content:'' and position:absolute and
   nothing else, so it drew no box, claimed no space and hit nothing.
   A comment asserting a law the code does not implement is worse than
   no comment: it is the thing a reader checks INSTEAD of measuring.
   Measured now, on a Pixel 5, by tools/enhancedTapProbe.mjs.

   The pseudo-element is centred on the pill and forced to 44,
   so the target grows
   OUTWARD from the drawn pill and the row's own height is unchanged. */
.step::after {
  content: ''; position: absolute; inset: -5px -5px;
  min-width: 44px; min-height: 44px;
  left: 50%; top: 50%; transform: translate(-50%, -50%);
  width: 44px; height: 44px;
}
.swatch { width: 26px; height: 20px; border: 1px solid var(--iron); }

/* THE TIER IS A DOT. The word was correct and it was also
   twenty-one repetitions of STORED down one column - the state
   still shows, and the sentence explaining it is one press away
   in the help panel where it is read once. */
.tier {
  width: 6px; height: 6px; border-radius: 50%; flex: 0 0 auto;
  margin-left: 12px; background: #2f3742;
}
.tier.live { background: var(--verdigris); }
.tier.unavailable { background: var(--blood); }
.legend {
  display: flex; gap: 16px; padding: 12px 18px; color: #5f5b53;
  font-size: 11px; letter-spacing: 0.08em; border-bottom: 1px solid #20262e;
  position: sticky; top: 0; background: var(--slate); z-index: 2;
}
.legend span { display: flex; align-items: center; gap: 7px; }
.legend i { width: 6px; height: 6px; border-radius: 50%; background: #2f3742; }
.legend i.live { background: var(--verdigris); }
.legend i.unavailable { background: var(--blood); }

.dcard { padding: 24px 20px 32px; }
.dcard h3 { font-family: var(--display); font-weight: 400; font-size: 22px; margin: 0 0 10px; }
.dcard p { color: var(--dim); font-size: 13px; margin: 0 0 14px; }
.dcard .status { color: var(--bone); font-size: 13px; }
.dcard code {
  display: inline-block; font-family: ui-monospace, monospace; font-size: 11px;
  color: #5f5b53; letter-spacing: 0.04em; margin-top: 18px;
}
.sheet-close { display: none; }

/* ── PHONE ─────────────────────────────────────────────────
   The rail goes to the BOTTOM, in the thumb's arc - the same law
   the in-game prototype follows and for the same reason. The
   settings sub-rail becomes a horizontal scroller and the help
   becomes a sheet, because one column is one column. */
@media (max-width: 860px) {
  .shell { grid-template-columns: 1fr; grid-template-rows: auto 1fr auto; }
  .side { display: contents; }
  .brand { padding: 22px 20px 16px; background: var(--ink); }
  .brand h1 { font-size: 27px; }
  .rail {
    order: 3; display: flex; gap: 2px; padding: 0 12px 12px;
    padding-bottom: max(12px, env(safe-area-inset-bottom));
    background: var(--ink); overflow-x: auto; overflow-y: hidden;
    scrollbar-width: none; flex: 0 0 auto;
  }
  .rail::-webkit-scrollbar { display: none; }
  .railbtn {
    width: auto; white-space: nowrap; border-left: 0; border-top: 2px solid var(--iron);
    padding: 12px 14px; min-height: 50px; text-align: center;
  }
  .railbtn.on { border-left: 0; border-top-color: var(--brass); background: none; }
  .railbtn .rn { display: none; }
  /* U51: IT WRAPS RATHER THAN SCROLLS. Seven destinations do not fit
     one phone row, the scrollbar is hidden two rules up, and an
     off-screen destination with no affordance is a destination that
     does not exist - which is the AUDIT 24 shape exactly: a control
     that is drawn, exists, and cannot be reached on the device that
     needs it most. SIX did not fit either, so this is the front door's
     bug as much as the pause door's; it only became visible when the
     rail grew a seventh entry and the one pushed off the end was EXIT.
     NOT THE WIZARD'S RAIL: that one is a WALK through ten stages in
     order, it shows where you ARE rather than where you may go, and a
     walk that wraps stops reading as a line. */
  .rail { flex-wrap: wrap; overflow-x: visible; }
  .railbtn { flex: 1 1 auto; }
  .wizard .rail { flex-wrap: nowrap; overflow-x: auto; }
  .foot { display: none; }
  .pane { order: 2; }
  .head { padding: 22px 20px 16px; }
  .head h2 { font-size: 26px; }
  .body { padding: 18px 20px 30px; }

  .panes { grid-template-columns: 1fr; grid-template-rows: auto 1fr; }
  .subrail {
    display: flex; overflow-x: auto; overflow-y: hidden; padding: 0;
    scrollbar-width: none;
  }
  .subrail::-webkit-scrollbar { display: none; }
  .subbtn {
    width: auto; white-space: nowrap; border-left: 0; border-bottom: 2px solid transparent;
    padding: 12px 15px;
  }
  .subbtn.on { border-left: 0; border-bottom-color: var(--brass); }
  .subbtn .count { float: none; margin-left: 7px; }
  /* THE ONLY WAY TO THE CATEGORY CARD ON A PHONE (AUDIT F8), so the
     gesture needs to be visible. Active tab only - it is the only tab
     the second tap applies to. */
  .subbtn.on .more-dot {
    display: inline-block; width: 4px; height: 4px; border-radius: 50%;
    background: var(--brass); vertical-align: middle; margin-left: 7px;
  }
  .detail {
    position: fixed; left: 0; right: 0; bottom: 0; max-height: 74dvh; z-index: 20;
    transform: translateY(101%); transition: transform 0.22s ease;
    border-top: 1px solid var(--brass);
    padding-bottom: max(80px, calc(env(safe-area-inset-bottom) + 80px));
  }
  .detail.open { transform: translateY(0); }
  .sheet-close {
    display: block; width: 100%; padding: 14px; min-height: 48px;
    color: var(--dim); font-size: 12px; letter-spacing: 0.16em;
    text-transform: uppercase; border-bottom: 1px solid var(--iron);
  }
}

@media (prefers-reduced-motion: reduce) { * { transition: none !important; } }

/* ── THE CHARACTER SHEET (U52) ──────────────────────────────
   The first IN-GAME screen in this language. Three columns because
   the sheet answers three questions - what you are, what you can do,
   what state you are in - and the classic sheet answers all three in
   one 320x200 panel by showing nine skills at a time.

   It borrows the menu's card, act and stats rules whole rather than
   restating them: one design language, one home. What is new here is
   the METER, which the eight attributes and the four vitals share -
   they are the same shape at two scales, so they are one rule. */
.sheet-shell { height: 100%; display: flex; flex-direction: column; min-height: 0; }

.sheet-id {
  display: flex; align-items: flex-start; justify-content: space-between; gap: 16px;
  padding: 26px 30px 18px; border-bottom: 1px solid var(--iron); background: var(--ink);
}
.sheet-id h2 { font-family: var(--display); font-weight: 300; font-size: 30px; margin: 0; }
.sheet-id .meta { color: var(--dim); font-size: 13px; margin: 6px 0 0; }

.sheet {
  flex: 1; min-height: 0; display: grid; gap: var(--gap);
  grid-template-columns: repeat(3, minmax(0, 1fr));
  background: var(--iron);
}
.sheetcol { background: var(--slate); overflow: auto; padding: 20px 22px 26px; min-height: 0; }
.colhead {
  font-family: var(--data); font-weight: 500; font-size: 11px; letter-spacing: 0.2em;
  text-transform: uppercase; color: var(--dim); margin: 0 0 16px;
}

/* THE METER. A label, its numbers, and a track - and the track is the
   thing the classic sheet has no room for at all: eight attributes as
   bare integers make you do the comparing. */
.meter { margin-bottom: 13px; }
.meter-k { font-size: 14px; }
.meter-v { float: right; color: var(--dim); font-size: 13px; font-variant-numeric: tabular-nums; }
.meter-track { clear: both; height: 4px; background: #0b0e12; margin-top: 6px; }
.meter-fill { height: 100%; }
.meter-fill.brass { background: var(--brass); }
.meter-fill.blood { background: var(--blood); }
.meter-fill.verdigris { background: var(--verdigris); }
.meter-fill.iron { background: var(--dim); }

/* SKILLS. The career groups are the character's chosen shape and are
   headed; the miscellaneous remainder is one press away. A career row
   is brighter than a miscellaneous one because that difference IS the
   character - it is what the three groups mean. */
.skillgroup {
  font-family: var(--data); font-weight: 500; font-size: 10px; letter-spacing: 0.18em;
  text-transform: uppercase; color: var(--brass); margin: 18px 0 8px;
}
.skillgroup:first-of-type { margin-top: 0; }
.skillrow {
  display: flex; justify-content: space-between; gap: 12px;
  padding: 7px 0; border-bottom: 1px solid #1b2027; color: var(--dim); font-size: 14px;
}
.skillrow.career { color: var(--bone); }
.skill-v { font-variant-numeric: tabular-nums; }
.act.more { width: 100%; margin-top: 18px; text-align: center; }

/* THE FOUR NAVIGATION BUTTONS, in the thumb's arc on a phone and along
   the foot of the sheet everywhere. A button is drawn only where the
   host handed a factory - see ui/enhancedCharSheet.js's nav(). */
.sheet-nav {
  display: flex; gap: 8px; flex-wrap: wrap; padding: 16px 30px;
  padding-bottom: max(16px, env(safe-area-inset-bottom));
  border-top: 1px solid var(--iron); background: var(--ink);
}
.sheet-nav .act { flex: 1 1 auto; text-align: center; }
.sheet-notice { color: #d98074; font-size: 13px; margin: 0; padding: 12px 30px 0; }

@media (max-width: 860px) {
  .sheet { grid-template-columns: 1fr; grid-auto-rows: min-content; overflow: auto; }
  .sheetcol { overflow: visible; }
  .sheet-id { padding: 20px; }
  .sheet-id h2 { font-size: 25px; }
  .sheet-nav { padding: 12px 16px; padding-bottom: max(12px, env(safe-area-inset-bottom)); }
}

/* ── THE PACK + THE SLOT MAP (U53) ─────────────────────────
   Three columns: what you are wearing, what you are carrying, and
   what one of them is. The schematic gets a column of its own because
   it is the screen's whole argument - twenty-seven slots read at a
   glance rather than hunted for on a picture of a person. */
.pack-shell { height: 100%; display: flex; flex-direction: column; min-height: 0; }
.pack-id {
  display: flex; align-items: flex-start; justify-content: space-between; gap: 16px;
  padding: 26px 30px 18px; border-bottom: 1px solid var(--iron); background: var(--ink);
}
.pack-id h2 { font-family: var(--display); font-weight: 300; font-size: 30px; margin: 0; }
.pack-id .meta { color: var(--dim); font-size: 13px; margin: 6px 0 0; font-variant-numeric: tabular-nums; }

.pack {
  flex: 1; min-height: 0; display: grid; gap: var(--gap);
  grid-template-columns: minmax(240px, 320px) minmax(0, 1fr) minmax(240px, 320px);
  background: var(--iron);
}
.packcol { background: var(--slate); overflow: auto; padding: 18px 20px 26px; min-height: 0; }

/* THE SLOT MAP. The figure is a schematic in --iron so it reads as
   scaffolding; the NODES carry the information, and a filled one is
   brass and twice the radius of an empty one - the difference has to
   survive being glanced at on a phone. */
.slotmap { background: var(--ink); padding: 14px 10px 10px; height: 100%; overflow: auto; }
.slotmap svg { width: 100%; height: auto; max-height: 62vh; display: block; }
.slotmap .figure path { fill: none; stroke: #232a33; stroke-width: 1.5; }
.slotmap .node circle { fill: #171b21; stroke: var(--iron); stroke-width: 1.5; transition: none; }
.slotmap .node.off circle { stroke: #232a33; }
.slotmap .node.filled circle { fill: var(--brass); stroke: var(--brass); }
.slotmap .node.filled { cursor: pointer; }
.slotmap .node.filled:hover circle { fill: var(--bone); stroke: var(--bone); }
.slotmap .node:focus-visible circle { stroke: var(--bone); stroke-width: 2.5; outline: none; }
.slotcount {
  color: var(--dim); font-size: 11px; letter-spacing: 0.16em; text-transform: uppercase;
  text-align: center; margin: 8px 0 0;
}

/* THE TABS are DFU's four pages (nativeInventory.js TABS), counted. */
.packtabs { display: flex; gap: 2px; margin: 0 0 14px; flex-wrap: wrap; }
.packtab {
  flex: 1 1 auto; padding: 10px 12px; min-height: 44px; text-align: center;
  border-bottom: 2px solid transparent; color: var(--dim); font-size: 13px;
}
.packtab.on { color: var(--brass); border-bottom-color: var(--brass); }
.packtab .count { display: block; font-size: 10px; color: var(--dim); font-variant-numeric: tabular-nums; }

.itemrow {
  display: flex; align-items: center; gap: 11px; width: 100%;
  padding: 9px 8px; min-height: 48px; border-bottom: 1px solid #1b2027; text-align: left;
}
.itemrow:hover { background: #12161b; }
.itemrow.on { background: #12161b; box-shadow: inset 2px 0 0 var(--brass); }
.tile {
  flex: 0 0 auto; width: 30px; height: 30px; display: grid; place-items: center;
  border: 1px solid var(--iron); color: var(--dim); font-size: 11px; letter-spacing: 0.06em;
}
/* THE REAL ICON, when the archive is here. No border: the sprite is a
   1-bit cutout on nothing, and a box round it makes it look like a
   placeholder, which is what it replaced. */
.tile.has-icon { border-color: transparent; }
.tile img { image-rendering: pixelated; max-width: 30px; max-height: 30px; }
.bigicon {
  display: grid; place-items: center; padding: 6px 0 14px; min-height: 72px;
}
.bigicon img { image-rendering: pixelated; max-width: 100%; max-height: 120px; }
.itemname { flex: 1 1 auto; min-width: 0; display: flex; flex-direction: column; }
.itemname small { color: var(--dim); font-size: 11.5px; }
.itemwt { flex: 0 0 auto; color: var(--dim); font-size: 12px; font-variant-numeric: tabular-nums; }
.packempty { color: var(--dim); font-size: 14px; margin: 10px 2px; }
.packdetail .sheet-close { display: none; }
.iconnote { color: var(--dim); font-size: 11.5px; margin: 12px 2px 0; line-height: 1.5; }

@media (max-width: 860px) {
  .pack { grid-template-columns: 1fr; grid-auto-rows: min-content; overflow: auto; }
  .packcol { overflow: visible; }
  .slotmap svg { max-height: 46vh; }
  .pack-id { padding: 20px; }
  .pack-id h2 { font-size: 25px; }
  /* THE DETAIL IS A SHEET, the same answer the settings pane gives to
     the same problem: three columns do not fit one phone, and a third
     column below the fold is a control the player cannot reach. It
     rises when an item is picked. */
  .packdetail {
    position: fixed; left: 0; right: 0; bottom: 0; max-height: 70dvh; z-index: 20;
    overflow: auto; transform: translateY(101%); transition: transform 0.22s ease;
    border-top: 1px solid var(--brass);
    padding-bottom: max(24px, calc(env(safe-area-inset-bottom) + 24px));
  }
  .packdetail.open { transform: translateY(0); }
  .packdetail .sheet-close {
    display: block; width: 100%; padding: 14px; min-height: 48px;
    color: var(--dim); font-size: 12px; letter-spacing: 0.16em;
    text-transform: uppercase; border-bottom: 1px solid var(--iron); text-align: center;
  }
}

/* ── THE WIZARD ─────────────────────────────────────────────
   Character creation borrows the menu's shell whole - same rail, same
   panes, same phone laws - because it is the same interface one press
   further in. What it adds is a WALK: the rail shows where you are
   rather than where you may go, and an action bar sits under the
   stage because Back must be a control you can see (AUDIT 17j found
   the wizard's back arms wrong on every screen it checked). */
.wizard .railbtn.done .rk { color: var(--dim); }
.wizard .railbtn.done { border-left-color: #3a3226; }
.wizard .railbtn.todo .rk { color: #4a4740; }
.wizard .railbtn[disabled] { cursor: default; }
.wizard .pane { display: flex; flex-direction: column; }

.stagebody {
  flex: 1; min-height: 0; display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(280px, 340px);
  gap: var(--gap); background: var(--iron);
}
.stagebody.solo { grid-template-columns: 1fr; }
.stagebody > .detail { background: #12161b; overflow: auto; }
.stagebody .empty { margin: 30px; background: var(--slate); }

.actionbar {
  display: flex; gap: 8px; padding: 12px 20px;
  padding-bottom: max(12px, env(safe-area-inset-bottom));
  border-top: 1px solid var(--iron); background: var(--ink);
}

/* ── A STAGE THAT IS ONLY ITS QUESTION ──────────────────────────
   Sex and the class METHOD are two choices each. Two choices get two
   large targets and an empty screen around them: a two-button question
   dressed as a form is a two-button question that reads as work. */
.choose { display: grid; place-content: center; gap: 28px; padding: 40px 30px; height: 100%; }
.choose h2 {
  font-family: var(--display); font-weight: 300; font-size: 30px;
  margin: 0; text-align: center;
}
.bigchoice { display: grid; grid-template-columns: repeat(2, minmax(200px, 260px)); gap: 12px; }
.bigchoice.tall { grid-template-columns: minmax(280px, 420px); }
.bigbtn {
  padding: 26px 22px; min-height: 88px; border: 1px solid #39424e;
  background: #12161b; color: var(--dim); text-align: center;
  letter-spacing: 0.05em; font-size: 17px;
}
.bigchoice.tall .bigbtn { text-align: left; }
.bigbtn:hover { color: var(--bone); border-color: var(--dim); }
.bigbtn.on { color: var(--brass); border-color: var(--brass); }
.bigk { display: block; font-size: 17px; color: var(--bone); }
.bigbtn:hover .bigk { color: var(--brass); }
.bign { display: block; font-size: 13px; color: var(--dim); margin-top: 7px; letter-spacing: 0.02em; }
.stagebody > .list { background: var(--slate); overflow: auto; }

/* ── A QUESTION AND ITS ANSWERS ─────────────────────────────────
   DFU stacks ten answer buttons in two columns because it has 320x200
   to spend. The answers are SENTENCES, so one column and full width
   reads far better and costs nothing but scroll. */
.question { padding: 34px 30px 40px; max-width: 760px; margin: 0 auto; width: 100%; overflow: auto; }
.qcount {
  color: var(--brass); font-size: 11px; letter-spacing: 0.2em;
  text-transform: uppercase; margin-bottom: 12px;
}
.question h2 {
  font-family: var(--display); font-weight: 300; font-size: 27px;
  margin: 0 0 24px; line-height: 1.25;
}
.answers { display: flex; flex-direction: column; gap: 8px; }
.answer {
  padding: 15px 18px; min-height: 52px; border: 1px solid var(--iron);
  background: #12161b; color: var(--dim); font-size: 15px; line-height: 1.4;
}
.answer:hover { color: var(--bone); border-color: var(--brass); }
.repbox { max-width: 560px; }
.repbox p { color: var(--dim); font-size: 14px; margin: 0 0 8px; }

/* ── THE NAME BOX ───────────────────────────────────────────────── */
.namebox {
  width: min(420px, 80vw); padding: 14px 16px; min-height: 52px;
  background: #12161b; border: 1px solid #39424e; color: var(--bone);
  font-family: var(--display); font-size: 24px; letter-spacing: 0.02em;
  text-align: center;
}
.namebox:focus { outline: none; border-color: var(--brass); }
.choose .acts { justify-content: center; }

/* ── THE FACE PICKER ────────────────────────────────────────────
   DFU shows one portrait with a previous/next pair because it has
   320x200 to spend. Ten fit here at once, and a picker you can see all
   of is one decision instead of ten. */
.facegrid { display: grid; grid-template-columns: repeat(5, auto); gap: 10px; justify-content: center; }
.facecell {
  padding: 6px; border: 1px solid var(--iron); background: #12161b;
  display: grid; place-items: center; min-width: 56px; min-height: 64px;
  image-rendering: pixelated;
}
.facecell canvas { display: block; image-rendering: pixelated; }
.facecell:hover { border-color: var(--dim); }
.facecell.on { border-color: var(--brass); box-shadow: inset 0 0 0 1px var(--brass); }
.facenum { color: #4a4740; font-size: 15px; }

/* ── POOLS AND SPINNERS ─────────────────────────────────────────
   The pool is the gate on both of these screens - DFU will not leave
   until it is spent - so it is stated, and the primary says how many
   are left rather than refusing in silence. */
.poolbar {
  display: flex; justify-content: space-between; align-items: baseline;
  padding: 12px 18px; border-bottom: 1px solid #20262e;
  position: sticky; top: 0; background: var(--slate); z-index: 2;
}
.poolk { color: var(--dim); font-size: 11px; letter-spacing: 0.14em; text-transform: uppercase; }
.poolv { color: var(--brass); font-size: 19px; font-variant-numeric: tabular-nums; }

.skillpane { padding: 24px 30px 34px; overflow: auto; max-width: 760px; margin: 0 auto; width: 100%; }
.skillgroup { margin-bottom: 22px; }
.skillhead {
  display: flex; justify-content: space-between; align-items: baseline;
  padding: 0 0 8px; border-bottom: 1px solid var(--iron); margin-bottom: 4px;
}
.skillk { color: var(--bone); font-size: 14px; letter-spacing: 0.12em; text-transform: uppercase; }
.skillpool { color: var(--brass); font-size: 12px; }
.skillpane .row { border-bottom: 1px solid #20262e; }
.skillpane .acts { justify-content: flex-end; }

/* ── REVIEW ─────────────────────────────────────────────────────
   The stage that closes the wizard. Everything on it is a control you
   have already met, which is the point: a review you cannot edit is a
   receipt. */
.reviewhead {
  display: flex; gap: 16px; align-items: center; padding: 18px;
  border-bottom: 1px solid var(--iron); background: #12161b;
  position: sticky; top: 0; z-index: 2;
}
.reviewface { border: 1px solid var(--iron); padding: 4px; line-height: 0; }
.reviewface canvas { display: block; image-rendering: pixelated; }
.reviewid { flex: 1; min-width: 0; }
.namebox.small {
  width: 100%; font-size: 20px; text-align: left; padding: 8px 10px; min-height: 44px;
}
.reviewsub { color: var(--dim); font-size: 12px; letter-spacing: 0.06em; margin-top: 6px; }
.skillhead.review { padding: 14px 18px 8px; margin-bottom: 0; }
.reflexpick { display: flex; flex-direction: column; gap: 4px; margin: 0 0 22px; }
.reflexbtn {
  padding: 11px 14px; min-height: 44px; border: 1px solid var(--iron);
  background: #12161b; color: var(--dim); font-size: 14px;
}
.reflexbtn:hover { color: var(--bone); border-color: var(--dim); }
.reflexbtn.on { color: var(--brass); border-color: var(--brass); }

/* ── THE PROVINCE MAP ───────────────────────────────────────
   Traced from the player's own TAMRIEL2.IMG (ui/provinceMap.js), so
   these are Bethesda's coastlines and ours is only the ink. Unselected
   provinces are drawn as outline alone: a map where every region is
   filled is a map where none of them is chosen. */
.mappane { padding: 20px; display: grid; place-items: center; min-height: 0; }
.map { width: 100%; height: 100%; min-height: 0; display: block; }
.prov {
  fill: #1b2027; stroke: #39424e; stroke-width: 0.6;
  stroke-linejoin: round; transition: fill 0.12s ease, stroke 0.12s ease;
  cursor: pointer;
}
/* CSS owns the highlight. It used to be a class the view re-rendered
   itself to apply, and that repaint destroyed the node the pointer was
   over - see ui/enhancedChargen.js's pointerenter handler. */
.prov:not(.inert):hover { fill: #2b3440; stroke: var(--dim); }
/* The Imperial Province: drawn, unlit, unpressable. */
.prov.inert { fill: #141922; stroke: #252c35; cursor: default; }
.provlabel.inert { fill: #4a4740; }
.prov.on { fill: rgba(192, 138, 62, 0.22); stroke: var(--brass); stroke-width: 0.9; }
.provlabel {
  fill: var(--dim); font-family: var(--data); font-size: 6px;
  letter-spacing: 0.06em; pointer-events: none; user-select: none;
}
.provlabel.on { fill: var(--brass); }
.mapnote { color: var(--dim); font-size: 13px; margin: 0 0 16px; }

/* The map's own fallback, and a real control in its own right: eight
   homelands read perfectly well as eight buttons. */
.racegrid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 8px; }
.racecell {
  padding: 16px; min-height: 56px; border: 1px solid var(--iron);
  color: var(--dim); letter-spacing: 0.04em;
}
.racecell:hover { color: var(--bone); border-color: var(--dim); }
.racecell.on { color: var(--brass); border-color: var(--brass); }

/* The wizard's phone progress strip. Hidden on a desk, where the rail
   already says it at length. */
.stepstrip { display: none; }
.segs { display: flex; gap: 3px; }
.seg { flex: 1; height: 2px; background: var(--iron); }
.seg.on { background: var(--brass); }
.steptext {
  color: var(--dim); font-size: 11px; letter-spacing: 0.14em;
  text-transform: uppercase; margin-top: 8px;
}

@media (max-width: 860px) {
  /* ONE COLUMN. The map takes the height it needs for its own aspect
     and the prompt sits under it - a picker whose prompt is off-screen
     is a picker that looks broken. Only the DESCRIPTION becomes a
     sheet, raised by the press that chose the province, because it is
     long and because DFU's is modal. */
  .stagebody { grid-template-columns: 1fr; grid-template-rows: auto 1fr; }
  /* the map keeps the room it had - it is the picker, not a header */
  .stagebody { grid-template-rows: 1fr auto; }
  .mappane { padding: 12px; }
  /* The MENU's phone rule turns every .detail into a sheet, and this
     one is not the menu's - so the inline arm undoes it explicitly.
     A shared class name across two screens is worth the reset: the
     alternative is a second class doing the same job in a second
     stylesheet, which is how two screens drift. */
  .stagebody > .detail:not(.sheet) {
    position: static; transform: none; max-height: none; z-index: auto;
    border-top: 1px solid var(--iron); padding-bottom: 0;
    background: var(--slate);
  }
  .stagebody > .detail:not(.sheet) .sheet-close { display: none; }
  .stagebody > .detail.sheet {
    position: fixed; left: 0; right: 0; bottom: 0; max-height: 72dvh; z-index: 20;
    background: #12161b;
    transform: translateY(101%); transition: transform 0.22s ease;
    border-top: 1px solid var(--brass);
    padding-bottom: max(76px, calc(env(safe-area-inset-bottom) + 76px));
  }
  .stagebody > .detail.sheet.open { transform: translateY(0); }
  /* the rail is the desk's; the strip is the phone's - never both */
  .wizard .rail { display: none; }
  .choose { padding: 28px 20px; gap: 22px; }
  .choose h2 { font-size: 24px; }
  .question { padding: 22px 20px 30px; }
  .facegrid { grid-template-columns: repeat(4, auto); gap: 8px; }
  .skillpane { padding: 18px 20px 28px; }
  .question h2 { font-size: 22px; }
  .bigchoice, .bigchoice.tall { grid-template-columns: 1fr; }
  .wizard .stepstrip { display: block; order: 3; background: var(--ink); padding: 12px 20px max(12px, env(safe-area-inset-bottom)); }
  .wizard .brand { padding-bottom: 12px; }
  .provlabel { font-size: 7px; }
}
`;

const STYLE_ID = 'dagger-enhanced-style';

/** Put the stylesheet in the document, once. Safe to call from every
 *  mount site; the second call is a no-op. */
export function injectEnhancedStyle(doc = document) {
  if (doc.getElementById(STYLE_ID)) return;
  const el = doc.createElement('style');
  el.id = STYLE_ID;
  el.textContent = ENHANCED_CSS;
  doc.head.append(el);
}

/** The web fonts.
 *
 *  A RECORDED DEPARTURE (AUDIT 2026-08-25 F6, Port-Ledger A). This is
 *  the ONLY third-party request the game makes, and it is made by the
 *  DEFAULT skin, on a build whose whole doctrine is that it ships
 *  self-contained and reads its game data off the player's own disk.
 *  Nobody had written that down, which is the part that made it a
 *  finding rather than a choice.
 *
 *  It is separate from the stylesheet because a font is a NETWORK
 *  request and the sheet is not: blocked, offline or opted out, the
 *  screens still lay out in the stack's fallbacks (Georgia and the
 *  system sans), which is the same never-traps law the title screen
 *  follows when its art is missing.
 *
 *  And it is SKIPPABLE. `?nofonts` is the escape hatch for anyone who
 *  does not want the request at all - a probe, an offline build, or a
 *  player who would rather not tell Google their browser exists.
 *  Self-hosting the two families is the real answer and is its own
 *  slice: it costs bytes in the repo and that is Mac's call, not
 *  mine. */
export function injectEnhancedFonts(doc = document, search = globalThis.location?.search ?? '') {
  if (new URLSearchParams(search).has('nofonts')) return;
  if (doc.getElementById('dagger-enhanced-fonts')) return;
  const link = doc.createElement('link');
  link.id = 'dagger-enhanced-fonts';
  link.rel = 'stylesheet';
  link.href = 'https://fonts.googleapis.com/css2?family=Cormorant:wght@300;400;600&family=Barlow+Semi+Condensed:wght@400;500;600&display=swap';
  doc.head.append(link);
}
