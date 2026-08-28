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

/* ── TOKENS ────────────────────────────────────────────────
   Identical to enhanced.html on purpose. The menu and the in-game
   screens are ONE interface seen at two moments, and the moment a
   front door owns its own palette it stops being the same
   product as the rooms behind it.

   EXPORTED ON THEIR OWN (U60) because the site's landing page - the
   door in front of this door - is a static index.html that cannot
   mount this module, and a second copy of eight hex values is the
   drift this file exists to prevent. scripts/landingHtml.mjs injects
   this block into that page at build; the rest of the skin stays a
   string the game pays for only when a screen is mounted. */
export const ENHANCED_TOKENS = `:root {
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
  --brand: 'Grenze Gotisch', 'Cormorant', Georgia, serif;

  --side: 264px;
  --gap: 1px;
}`;

/* ── THE FACES ──────────────────────────────────────────────
   Three families, each one string, each a Google Fonts css2 `family=`
   argument, so a URL is composed and never typed. The skin loads
   DISPLAY + DATA. The site's landing page (U60b, Mac's call: a
   Daggerfall-esque face) loads BRAND + DATA - Grenze Gotisch, a
   gothic-roman hybrid chosen off a rendered sheet of a dozen free
   faces for being the one that reads as the classic title without
   turning a headline into a fraktur puzzle. --brand is declared in
   the tokens above so the menu can take the same wordmark in one
   line if that is ever wanted; nothing in-game uses it today, and
   nothing in-game loads it. */
export const FONT_DISPLAY = 'Cormorant:wght@300;400;600';
export const FONT_DATA = 'Barlow+Semi+Condensed:wght@400;500;600';
export const FONT_BRAND = 'Grenze+Gotisch:wght@300;400;500';
/* THE PIXEL FACES (PX1, Mac 2026-08-27): the menu's home screen is
   pixel art now - Jacquard 12 is a 12px-grid pixel BLACKLETTER (the
   wordmark; the same family Grenze Gotisch was chosen to evoke, on an
   actual pixel grid), Pixelify Sans the list face beside it. Chosen in
   menu-pixel.html, the prototype of record. */
export const FONT_PIXEL_BRAND = 'Jacquard+12';
export const FONT_PIXEL_DATA = 'Pixelify+Sans:wght@400;500';
export const fontsUrl = (families) =>
  `https://fonts.googleapis.com/css2?${families.map((f) => `family=${f}`).join('&')}&display=swap`;

/** The one Google Fonts request the enhanced skin makes (Port-Ledger:
 *  the port's only third-party request, non-blocking, `?nofonts` skips
 *  it). A named export rather than a literal so nothing else can hold
 *  a second copy of it. PX1 folded the two pixel faces into the SAME
 *  request rather than making a second one - one request is the row's
 *  own claim. */
export const ENHANCED_FONTS_URL = fontsUrl([FONT_DISPLAY, FONT_DATA, FONT_PIXEL_BRAND, FONT_PIXEL_DATA]);

export const ENHANCED_CSS = `
/* ── TOKENS ── see ENHANCED_TOKENS above */
${ENHANCED_TOKENS}

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

/* ── THE SWITCH ON THE DOOR ──────────────────────────────────
   The two skins under the brand, the one in effect in brass, the
   other a press away; "switch anytime" under them, because a pair of
   words is not obviously a control until it says so. Same tracked caps
   as the sub it replaced, so the brand block keeps its shape. */
.skinswitch { display: flex; flex-wrap: wrap; align-items: center; gap: 1px; margin-top: 9px; }
.skinopt {
  font-family: var(--data); font-size: 11px; letter-spacing: 0.26em; text-transform: uppercase;
  color: var(--dim); background: transparent; border: 1px solid var(--iron);
  padding: 5px 10px 6px; min-height: 28px; cursor: pointer;
}
.skinopt:hover { color: var(--bone); }
.skinopt.on { color: var(--brass); border-color: var(--brass); cursor: default; }
.skinhint { flex-basis: 100%; color: var(--dim); font-size: 10px; letter-spacing: 0.12em; margin-top: 5px; }

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
  .skinopt { min-height: 44px; padding: 8px 14px; }   /* a thumb's target, as every control on a phone */
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

/* ── THE CHARACTER COLUMN ───────────────────────────────────
   U59. The avatar and the worn list, stacked - one picture of the
   player and one reading of what is on them. The panel is the space
   the VOXEL render lands in later; only its contents change. */
.charcol {
  display: flex; flex-direction: column; gap: 16px; min-height: 0; overflow: auto;
  padding: 14px 14px 22px; background: var(--ink);
}
.figure-doll {
  display: grid; place-items: center; padding: 4px 0 10px;
  /* STICKY, because the column scrolls and the whole point of this
     slice is seeing the avatar AND the worn list at once - a doll that
     scrolls away the moment you read past the boots is the small
     button again. */
  position: sticky; top: 0; z-index: 1; background: var(--ink);
}
/* PIXELATED, and capped by HEIGHT rather than width: the panel is
   110x184, so a width cap on a tall column leaves it swimming. The cap
   is deliberately well under its 3x natural size - at full height the
   worn list started below the fold, which is the thing this was
   supposed to fix. */
.figure-doll img {
  image-rendering: pixelated; max-width: 100%; max-height: 32vh;
  height: auto; cursor: pointer;
}
.equipped { display: flex; flex-direction: column; }
.equippedhead { margin: 0 2px 8px; }
.equippedhead h3 { font-family: var(--display); font-weight: 300; font-size: 17px; margin: 0; }
.equippedhead .meta { color: var(--dim); font-size: 11.5px; margin: 4px 0 0; font-variant-numeric: tabular-nums; }
.wornrow {
  display: flex; align-items: baseline; gap: 10px; width: 100%;
  padding: 9px 8px; min-height: 44px; text-align: left;
  border-bottom: 1px solid #1b2027;
}
.wornrow:not(.wornempty):hover { background: #12161b; }
.wornrow.on { background: #12161b; box-shadow: inset 2px 0 0 var(--brass); }
/* THE SLOT IS THE CONSTANT and the item is the news, so the label is
   the quiet half and sits in a fixed gutter the eye can run down. */
.wornslot {
  flex: 0 0 88px; color: var(--dim); font-size: 10.5px; letter-spacing: 0.08em;
  text-transform: uppercase; line-height: 1.35;
}
.wornname { flex: 1 1 auto; min-width: 0; font-size: 13.5px; }
.wornname.wornempty { color: #2b333d; }
/* An empty row is a SLOT, not a control - it must read as
   unavailable rather than as a button that does nothing, and it must
   be cheap: twenty-two of the twenty-seven are empty on a bare
   character, and at full row height they bury the five that matter. */
.wornrow.wornempty {
  min-height: 0; padding: 3px 8px; border-bottom-color: #14181d;
}
.wornrow.wornempty .wornslot { font-size: 9.5px; color: #333c47; }


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

/* ── THE REMOTE SIDE ────────────────────────────────────────
   DFU's window is TWO lists side by side, so these are PEERS sharing
   one grid cell rather than a panel hung off the pack. Splitting the
   middle column keeps the outer three-column shape - and every phone
   rule written against it - exactly as it was. */
.packlists {
  display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: var(--gap); min-height: 0; background: var(--iron);
}
.packremote { background: #10141a; }
.remotehead {
  display: flex; align-items: flex-start; justify-content: space-between;
  gap: 10px; flex-wrap: wrap; margin: 0 0 14px;
}
.remotewho h3 {
  font-family: var(--display); font-weight: 300; font-size: 19px; margin: 0;
}
.remotewho .meta {
  color: var(--dim); font-size: 12px; margin: 5px 0 0; font-variant-numeric: tabular-nums;
}
.remoteacts { display: flex; gap: 6px; flex-wrap: wrap; }
.goldfield {
  display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
  padding: 12px; margin: 0 0 14px; background: var(--ink); border: 1px solid var(--iron);
}
.goldfield input {
  flex: 1 1 90px; min-width: 0; min-height: 44px; padding: 0 12px;
  background: #0b0e12; border: 1px solid var(--iron); color: var(--bone);
  font: inherit; font-size: 15px; font-variant-numeric: tabular-nums;
}
.goldfield input:focus-visible { outline: none; border-color: var(--brass); }
.goldfield .meta { flex: 1 0 100%; color: var(--dim); font-size: 11.5px; margin: 0; }

/* THE LISTS STACK BELOW THE PACK'S OWN BREAKPOINT, not at it: two
   half-width lists are still readable at 1100px, and one of them
   sitting under the doll is not. */
@media (max-width: 1100px) {
  /* The PAIR scrolls as one when it stacks - two independently
     scrolling half-height lists in one column is a scroll trap. */
  .packlists { grid-template-columns: 1fr; grid-auto-rows: min-content; overflow: auto; }
  .packlists .packcol { overflow: visible; }
  /* THE LIST YOU CAME FOR GOES FIRST. Opening a corpse and being shown
     your own pack is the screen answering a question nobody asked; the
     ground and the wagon are the other way round, because there you
     came to put something down. */
  .packlists.remotefirst .packremote { order: 0; }
  .packlists.remotefirst > .packcol:not(.packremote) { order: 1; }
}

/* THE SCHEMATIC GOES LAST ON A PHONE. Stacked, it is 46vh of figure
   above everything, so the LISTS started below the fold - the remote
   one at y=781 in a 727px viewport, which is a browser-only finding
   and exactly the shape AUDIT 24 keeps turning up. A player opening
   their pack came for their items; the doll is what they scroll to. */
@media (max-width: 860px) {
  .pack .charcol { order: 2; }
  .pack .packlists { order: 1; }
  .pack .packdetail { order: 3; }
}

.iconnote { color: var(--dim); font-size: 11.5px; margin: 12px 2px 0; line-height: 1.5; }

@media (max-width: 860px) {
  .pack { grid-template-columns: 1fr; grid-auto-rows: min-content; overflow: auto; }
  .packcol, .charcol { overflow: visible; }
  .slotmap svg { max-height: 40vh; }
  .figure-doll img { max-height: 30vh; }
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
  .stagebody > .detail:not(.wizsheet) {
    position: static; transform: none; max-height: none; z-index: auto;
    border-top: 1px solid var(--iron); padding-bottom: 0;
    background: var(--slate);
  }
  .stagebody > .detail:not(.wizsheet) .sheet-close { display: none; }
  .stagebody > .detail.wizsheet {
    position: fixed; left: 0; right: 0; bottom: 0; max-height: 72dvh; z-index: 20;
    background: #12161b;
    transform: translateY(101%); transition: transform 0.22s ease;
    border-top: 1px solid var(--brass);
    padding-bottom: max(76px, calc(env(safe-area-inset-bottom) + 76px));
  }
  .stagebody > .detail.wizsheet.open { transform: translateY(0); }
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

/* ── THE OVERWORLD (U61) ────────────────────────────────────
   The travel map whose picture is the GL frame beneath it, so the
   root is TRANSPARENT - the one deliberate break from the opaque
   peer div, recorded in ui/overworldMap.js. Everything drawn here
   is chrome floating over the relief; every class is ov-prefixed
   (the .detail/.packcol/.empty lesson, three times paid). */
.ovroot {
  position: fixed; inset: 0; z-index: 13; overflow: hidden;
  background: transparent; cursor: grab; touch-action: none;
  font-family: var(--body, sans-serif); color: var(--bone);
}
.ovroot:active { cursor: grabbing; }
.ovtop {
  position: absolute; top: 0; left: 0; right: 0; display: flex;
  align-items: flex-start; gap: 14px; padding: 14px 18px;
  pointer-events: none;
}
.ovlabel {
  flex: 1 1 auto; min-width: 0; font-family: var(--display);
  font-weight: 300; font-size: 24px; line-height: 1.2;
  text-shadow: 0 1px 8px rgba(0,0,0,0.8); min-height: 30px;
}
.ovsearch { position: relative; flex: 0 1 300px; pointer-events: auto; }
.ovsearch input {
  width: 100%; min-height: 44px; padding: 8px 12px;
  background: rgba(10, 13, 17, 0.82); border: 1px solid var(--iron);
  color: var(--bone); font-size: 14px;
}
.ovsearch input:focus { outline: none; border-color: var(--brass); }
.ovresults {
  display: none; position: absolute; top: 100%; left: 0; right: 0;
  margin: 4px 0 0; padding: 0; list-style: none; max-height: 46vh;
  overflow: auto; background: rgba(10, 13, 17, 0.94);
  border: 1px solid var(--iron); z-index: 1;
}
.ovresults.open { display: block; }
.ovresult {
  display: flex; justify-content: space-between; gap: 12px; width: 100%;
  min-height: 44px; padding: 9px 12px; text-align: left; font-size: 13.5px;
}
.ovresult:hover { background: #12161b; }
.ovresult-region { color: var(--dim); font-size: 12px; }
.ovclose { pointer-events: auto; }
.ovfilters {
  position: absolute; left: 18px; bottom: 18px; display: flex; gap: 8px;
  padding-bottom: env(safe-area-inset-bottom);
}
.ovchip {
  min-height: 44px; padding: 9px 16px; font-size: 13px; color: var(--brass);
  background: rgba(10, 13, 17, 0.82); border: 1px solid var(--brass);
}
/* a filter flag TRUE HIDES its bucket - the chip dims with its dots */
.ovchip.off { color: var(--dim); border-color: var(--iron); }
.ovcard {
  display: none; position: absolute; right: 18px; bottom: 18px;
  width: min(340px, calc(100vw - 36px)); padding: 18px 20px;
  background: rgba(10, 13, 17, 0.92); border: 1px solid var(--iron);
  margin-bottom: env(safe-area-inset-bottom);
}
.ovcard.open { display: block; }
.ovname { font-family: var(--display); font-weight: 300; font-size: 24px; margin: 0; }
.ovmeta { color: var(--dim); font-size: 13px; margin: 4px 0 12px; }
.ovprompt { font-size: 14px; margin: 10px 0 12px; }
.ovacts { display: flex; gap: 8px; margin-top: 12px; }
.ovacts .act { flex: 1 1 auto; text-align: center; }
.act.ovghost { color: var(--dim); border-color: var(--iron); }
.ovpair { display: flex; align-items: center; gap: 6px; margin-bottom: 8px; }
.ovpair-k {
  flex: 0 0 64px; color: var(--dim); font-size: 10.5px;
  letter-spacing: 0.12em; text-transform: uppercase;
}
.ovpick {
  flex: 1 1 auto; min-height: 44px; padding: 8px 6px; font-size: 13px;
  color: var(--dim); background: transparent; border: 1px solid var(--iron);
}
.ovpick.on { color: var(--brass); border-color: var(--brass); background: #12161b; }
.ovtrip { margin: 12px 0 0; }
.ovnotice { color: #d98074; font-size: 13px; margin: 10px 0 0; }
.ovskip {
  display: none; position: absolute; left: 50%; bottom: 42px;
  transform: translateX(-50%); padding: 10px 18px; font-size: 12px;
  letter-spacing: 0.14em; text-transform: uppercase; color: var(--bone);
  background: rgba(10, 13, 17, 0.7); border: 1px solid var(--iron);
  pointer-events: none;
}
.ovskip.on { display: block; }
.ovhint {
  position: absolute; left: 50%; top: 8px; transform: translateX(-50%);
  color: var(--dim); font-size: 11px; letter-spacing: 0.08em;
  pointer-events: none; opacity: 0.8;
}
@media (max-width: 860px) {
  .ovlabel { font-size: 18px; }
  .ovtop { flex-wrap: wrap; }
  .ovsearch { flex: 1 1 100%; order: 3; }
  .ovhint { display: none; }
  .ovcard { right: 12px; bottom: 76px; }
  .ovfilters { left: 12px; bottom: 12px; flex-wrap: wrap; max-width: calc(100vw - 24px); }
}

/* ── PX1: THE PIXEL HOME (Mac, 2026-08-27) ──────────────────
   The boot menu's front face in Daggerfall's own idiom, adopted from
   menu-pixel.html: no boxes - the list floats over the dithered night
   (src/ui/pixelGround.js), the wordmark is pixel blackletter, and the
   focused row wears THE CLASSIC SHADOWED-LABEL PAIR - yellow
   243,239,44 over its 93,77,12 shadow at +1,+1 (scaled x2 for the
   larger type), the idiom every native window draws. States SNAP:
   pixels do not tween, so there are no transitions in this block. */
.px-home { position: fixed; inset: 0; overflow: hidden; background: #0a0c11;
  font-variant-ligatures: none; font-feature-settings: 'liga' 0, 'clig' 0;   /* the fi ligature - see .shell */
  font-family: 'Pixelify Sans', monospace; color: #d8cfae;
  -webkit-font-smoothing: none; }
/* PX2: the pause face - a scrim, not the night; the paused frame is
   the ground. */
.px-home.px-over { background: rgba(10,12,17,0.55); }   /* PX4: the game reads through */
/* ── PX3: THE PAUSE WINDOW ── a framed panel with tabs (Mac's
   reference: Skyrim's journal), whole pixels throughout: 2px border,
   corner gems, a tab strip whose active tab wears the classic gold
   pair. The window scrolls its body; the scrim keeps the foot. */
.px-win { position: relative; width: min(920px, 94vw); height: min(620px, 74dvh);
  display: flex; flex-direction: column;
  background: rgba(10,12,17,0.72); border: 2px solid #7d7460; }   /* PX4: slight transparency, per the reference */
/* Each gem CENTERS on its corner: the core is 2px with 4px shadow
   arms, so a translate by half its own size puts the diamond's heart
   exactly on the frame's corner point. SCOPED under .px-win because
   the base .px-gem rule sits LATER in this sheet and its
   position:relative won the single-class tie - all four gems piled up
   relative at the top-left (caught by the geometry probe). */
.px-win .px-corner { position: absolute; }
.px-win .px-tl { left: -1px; top: -1px; transform: translate(-50%,-50%); }
.px-win .px-tr { right: -1px; top: -1px; transform: translate(50%,-50%); }
.px-win .px-bl { left: -1px; bottom: -1px; transform: translate(-50%,50%); }
.px-win .px-br { right: -1px; bottom: -1px; transform: translate(50%,50%); }
.px-tabs { display: flex; justify-content: center; gap: 4px;
  border-bottom: 2px solid rgba(125,116,96,0.55); padding: 6px 8px 2px; }
.px-tabs button { font: inherit; font-size: 20px; letter-spacing: 0.16em; text-indent: 0.16em;
  text-transform: uppercase; color: #d8cfae; background: none; border: 0; cursor: pointer;
  min-height: 44px; padding: 6px 18px; display: flex; align-items: center; gap: 12px;
  text-shadow: 2px 2px 0 rgba(0,0,0,0.8); transition: none; }
.px-tabs button .px-c { font-size: 15px; color: rgb(243,239,44); visibility: hidden;
  text-shadow: 2px 2px 0 rgb(93,77,12); }
.px-tabs button:hover, .px-tabs button:focus-visible { outline: none;
  color: rgb(243,239,44); text-shadow: 2px 2px 0 rgb(93,77,12); }
.px-tabs button.on { color: rgb(243,239,44); text-shadow: 2px 2px 0 rgb(93,77,12); }
.px-tabs button.on .px-c, .px-tabs button:hover .px-c, .px-tabs button:focus-visible .px-c { visibility: visible; }
.px-body { flex: 1; overflow-y: auto; padding: 18px 26px; }
/* System: the same floating list, sized for a panel. */
.px-menu.px-compact { gap: 0; }
.px-menu.px-compact button { font-size: 22px; min-height: 46px; padding: 6px 22px; }
/* Stats */
.px-statshead { display: flex; flex-direction: column; align-items: center; gap: 4px;
  margin: 6px 0 16px; text-shadow: 2px 2px 0 rgba(0,0,0,0.8); }
.px-statshead strong { font-size: 26px; font-weight: 400; letter-spacing: 0.1em; }
.px-statshead span { color: #7d7460; font-size: 16px; letter-spacing: 0.12em; text-transform: uppercase; }
.px-statgrid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 6px 18px; margin-bottom: 14px; }
.px-stat { display: flex; justify-content: space-between; gap: 10px;
  border-bottom: 2px solid rgba(125,116,96,0.3); padding: 6px 2px;
  text-shadow: 2px 2px 0 rgba(0,0,0,0.8); }
.px-stat .k { color: #7d7460; font-size: 15px; letter-spacing: 0.14em; text-transform: uppercase; align-self: center; }
.px-stat .v { font-size: 19px; white-space: nowrap; }
.px-attrs { grid-template-columns: repeat(auto-fit, minmax(110px, 1fr)); }
/* Quests */
.px-quest { margin: 0 0 16px; padding: 10px 14px; border-left: 2px solid var(--brass);
  text-shadow: 2px 2px 0 rgba(0,0,0,0.8); }
.px-quest p { margin: 0 0 4px; font-size: 17px; line-height: 1.45; }
.px-note { color: #7d7460; text-align: center; margin-top: 24px; font-size: 17px;
  text-shadow: 2px 2px 0 rgba(0,0,0,0.7); }
/* ── PX4: THE JOURNAL ── the reference's shape: names on a left rail
   (the archive beneath a small heading), the chosen quest on the
   right - its name inside wing rules, the latest entry as the
   description, the trail as diamond-marked entries under a titled
   divider. */
.px-journal { display: flex; gap: 0; min-height: 100%; }
.px-qrail { flex: 0 0 240px; border-right: 2px solid rgba(125,116,96,0.45);
  padding: 4px 12px 4px 0; overflow-y: auto; }
.px-qrow { font: inherit; font-size: 16px; letter-spacing: 0.08em; text-transform: uppercase;
  color: #d8cfae; background: none; border: 0; cursor: pointer; text-align: left;
  display: flex; align-items: center; gap: 10px; width: 100%;
  min-height: 44px; padding: 6px 8px; text-shadow: 2px 2px 0 rgba(0,0,0,0.8); transition: none; }
.px-qrow .px-c { font-size: 12px; color: rgb(243,239,44); visibility: hidden;
  text-shadow: 2px 2px 0 rgb(93,77,12); }
.px-qrow:hover, .px-qrow:focus-visible { outline: none; color: rgb(243,239,44);
  text-shadow: 2px 2px 0 rgb(93,77,12); }
.px-qrow.on { color: rgb(243,239,44); text-shadow: 2px 2px 0 rgb(93,77,12); }
.px-qrow.on .px-c, .px-qrow:hover .px-c, .px-qrow:focus-visible .px-c { visibility: visible; }
.px-qrow.done { color: #7d7460; }
.px-qrow.done.on { color: rgb(243,239,44); }
.px-qarch { color: #7d7460; font-size: 13px; letter-spacing: 0.3em; text-indent: 0.3em;
  text-transform: uppercase; text-align: center; margin: 14px 0 4px;
  border-top: 2px solid rgba(125,116,96,0.3); padding-top: 10px;
  text-shadow: 2px 2px 0 rgba(0,0,0,0.7); }
.px-qarch.px-qfirst { border-top: 0; padding-top: 2px; margin-top: 2px; }   /* PX5: the first heading needs no rule above it */
/* PX5: a running clock on a rail row - a gold gem pushed to the right. */
.px-qtimed { margin-left: auto; font-size: 11px; color: rgb(243,239,44);
  text-shadow: 2px 2px 0 rgb(93,77,12); }
/* PX5: the kind tag and the timer under the quest name. */
.px-qmeta { display: flex; align-items: center; justify-content: center; gap: 18px;
  margin: -8px 0 12px; }
.px-qkind { color: #7d7460; font-size: 13px; letter-spacing: 0.24em; text-indent: 0.24em;
  text-transform: uppercase; text-shadow: 2px 2px 0 rgba(0,0,0,0.7); }
.px-qtimer { color: #c5bda2; font-size: 14px; letter-spacing: 0.1em;
  text-shadow: 2px 2px 0 rgba(0,0,0,0.8); }
.px-qtimer.urgent { color: rgb(243,239,44); text-shadow: 2px 2px 0 rgb(93,77,12); }
/* PX5: the world's date and time, bottom-right on the scrim. */
.px-clock { position: absolute; right: 18px; bottom: 12px; text-align: right;
  display: flex; flex-direction: column; gap: 2px;
  color: #c5bda2; font-size: 15px; letter-spacing: 0.1em;
  text-shadow: 2px 2px 0 rgba(0,0,0,0.8); }
.px-clocktime { color: #7d7460; font-size: 13px; letter-spacing: 0.14em; }
/* ── PX6: THE STATS PAGE ── meters and rows in whole pixels. */
.px-mrow { margin: 0 0 14px; }
.px-mtop { display: flex; justify-content: space-between; align-items: baseline; margin: 0 0 5px; }
.px-mtop .k { color: #7d7460; font-size: 14px; letter-spacing: 0.16em; text-transform: uppercase;
  text-shadow: 2px 2px 0 rgba(0,0,0,0.7); }
.px-mtop .v { font-size: 18px; text-shadow: 2px 2px 0 rgba(0,0,0,0.8); white-space: nowrap; }
.px-meter { height: 10px; border: 2px solid rgba(125,116,96,0.55); background: rgba(0,0,0,0.4); }
.px-fill { height: 100%; background: #d8cfae; }
.px-fill.blood { background: var(--blood); }
.px-fill.verdigris { background: var(--verdigris); }
.px-fill.thin { background: rgba(216,207,174,0.75); }
.px-skillgrid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 4px 26px; margin-bottom: 8px; }
.px-skill { margin: 0 0 8px; }
.px-skill .px-meter { height: 6px; border-width: 2px; }
.px-skill .px-mtop { margin-bottom: 3px; }
.px-skill .px-mtop .v { font-size: 16px; }
.px-disclose { width: auto; margin: 10px auto 0; }
.px-stat .v.won { color: rgb(243,239,44); text-shadow: 2px 2px 0 rgb(93,77,12); }
.px-stat .v.bad { color: var(--blood); }
/* ── PX7: THE SYSTEM PAGE ── the shell's own panes repainted in whole
   pixels. The LAWS stay in the pane functions; every rule here is
   paint over the same markup (.card/.act/.empty/.stats/.tag/.row). */
.px-sys .card, .px-sys .dcard { background: rgba(0,0,0,0.35); border: 2px solid rgba(125,116,96,0.55);
  padding: 16px 20px; margin: 0 0 14px; }
.px-sys h3 { font-family: inherit;   /* the shell's own h3 rule sets Cormorant; the window is pixel */
  font-size: 22px; font-weight: 400; letter-spacing: 0.12em; text-indent: 0.12em;
  text-transform: uppercase; margin: 0 0 6px; text-shadow: 2px 2px 0 rgba(0,0,0,0.8); }
.px-sys p, .px-sys .meta { color: #c5bda2; font-size: 16px; line-height: 1.5; margin: 0 0 8px;
  text-shadow: 2px 2px 0 rgba(0,0,0,0.8); }
.px-sys .tag { display: inline-block; color: rgb(243,239,44); font-size: 12px;
  letter-spacing: 0.24em; text-indent: 0.24em; text-transform: uppercase;
  text-shadow: 2px 2px 0 rgb(93,77,12); margin: 0 0 4px; }
.px-sys .stats { display: grid; grid-template-columns: auto 1fr; gap: 4px 18px; margin: 8px 0 10px; }
.px-sys .stats dt { color: #7d7460; font-size: 14px; letter-spacing: 0.14em; text-transform: uppercase;
  text-shadow: 2px 2px 0 rgba(0,0,0,0.7); }
.px-sys .stats dd { margin: 0; font-size: 16px; text-shadow: 2px 2px 0 rgba(0,0,0,0.8); }
.px-sys .acts { display: flex; gap: 12px; margin-top: 10px; }
.px-sys .act { font: inherit; font-size: 17px; letter-spacing: 0.16em; text-indent: 0.16em;
  text-transform: uppercase; color: #d8cfae; background: none; cursor: pointer;
  border: 2px solid rgba(125,116,96,0.55); padding: 8px 20px; min-height: 44px;
  text-shadow: 2px 2px 0 rgba(0,0,0,0.8); transition: none; }
.px-sys .act:hover, .px-sys .act:focus-visible { outline: none; color: rgb(243,239,44);
  border-color: var(--brass); text-shadow: 2px 2px 0 rgb(93,77,12); }
.px-sys .act.primary { color: rgb(243,239,44); border-color: var(--brass);
  text-shadow: 2px 2px 0 rgb(93,77,12); }
.px-sys .act:disabled { color: rgba(125,116,96,0.45); border-color: rgba(125,116,96,0.3);
  cursor: default; text-shadow: 2px 2px 0 rgba(0,0,0,0.7); }
.px-sys .empty { text-align: center; margin: 14px 0; }
.px-sys .empty h3 { font-size: 17px; color: #c5bda2; }
.px-sys .empty p { color: #7d7460; font-size: 15px; }
/* Mods' DFU-switch rows keep their shell markup; here they read as
   quiet key/value rows. */
.px-sys .row { display: flex; align-items: center; justify-content: space-between; gap: 12px;
  border-bottom: 2px solid rgba(125,116,96,0.3); min-height: 44px; }
.px-sys .row-main { font: inherit; background: none; border: 0; color: inherit; text-align: left;
  cursor: default; padding: 6px 0; }
.px-sys .row-name { font-size: 15px; text-shadow: 2px 2px 0 rgba(0,0,0,0.8); }
.px-sys .ctl { display: flex; align-items: center; gap: 8px; }
.px-sys .ctl .val { color: #7d7460; font-size: 14px; letter-spacing: 0.1em;
  text-shadow: 2px 2px 0 rgba(0,0,0,0.7); }
.px-qdetail { flex: 1; padding: 4px 6px 4px 22px; overflow-y: auto; }
.px-qname { display: flex; align-items: center; justify-content: center; gap: 14px; margin: 6px 0 14px; }
.px-qname h3 { font-size: 24px; font-weight: 400; letter-spacing: 0.14em; text-indent: 0.14em;
  text-transform: uppercase; margin: 0; text-align: center;
  text-shadow: 2px 2px 0 rgba(0,0,0,0.8); }
.px-qwing { flex: 1; height: 2px; max-width: 120px;
  background: linear-gradient(90deg, transparent, rgba(125,116,96,0.7)); }
.px-qwing.px-flip { background: linear-gradient(90deg, rgba(125,116,96,0.7), transparent); }
.px-qdesc p { margin: 0 0 5px; font-size: 17px; line-height: 1.5;
  text-shadow: 2px 2px 0 rgba(0,0,0,0.8); }
.px-qgap { height: 10px; }
.px-divider { display: flex; align-items: center; justify-content: center; gap: 12px; margin: 16px 0 12px; }
.px-divider::before, .px-divider::after { content: ''; flex: 1; height: 2px; max-width: 140px;
  background: rgba(125,116,96,0.55); }
.px-divword { color: #7d7460; font-size: 13px; letter-spacing: 0.3em; text-indent: 0.3em;
  text-transform: uppercase; text-shadow: 2px 2px 0 rgba(0,0,0,0.7); }
.px-qentry { display: flex; gap: 12px; margin: 0 0 12px; }
.px-qmark { color: var(--brass); font-size: 14px; line-height: 1.6;
  text-shadow: 2px 2px 0 rgba(0,0,0,0.8); }
.px-qentry p { margin: 0 0 4px; font-size: 16px; line-height: 1.45; color: #c5bda2;
  text-shadow: 2px 2px 0 rgba(0,0,0,0.8); }
.px-qverdict { text-align: center; color: #7d7460; font-size: 14px; letter-spacing: 0.2em;
  text-transform: uppercase; margin: -6px 0 12px; text-shadow: 2px 2px 0 rgba(0,0,0,0.7); }
.px-qverdict.won { color: rgb(243,239,44); text-shadow: 2px 2px 0 rgb(93,77,12); }
@media (max-width: 480px) {
  .px-win { width: 100vw; height: calc(100dvh - 48px); border-left: 0; border-right: 0; }
  .px-tabs button { font-size: 17px; letter-spacing: 0.1em; text-indent: 0.1em; padding: 6px 10px; gap: 8px; }
  /* PX4: the journal stacks - the rail is a strip of rows across the
     top, the detail beneath, both still whole pixels. */
  .px-journal { flex-direction: column; }
  .px-qrail { flex: 0 0 auto; max-height: 32%; border-right: 0;
    border-bottom: 2px solid rgba(125,116,96,0.45); padding: 0 0 6px; }
  .px-qdetail { padding: 10px 2px 4px; }
}
.px-ground { position: absolute; left: -25%; top: -25%; width: 150%; height: 150%;
  image-rendering: pixelated; animation: px-drift 160s linear infinite alternate; }
@keyframes px-drift { from { transform: translate(0,0) } to { transform: translate(4%,2%) } }
.px-vignette { position: absolute; inset: 0; pointer-events: none;
  background: radial-gradient(95% 95% at 50% 45%, transparent 60%, rgba(0,0,0,0.5) 100%); }
.px-stage { position: relative; height: 100%; display: flex; flex-direction: column;
  align-items: center; justify-content: center; padding: 24px; }
.px-wordmark { font-family: 'Jacquard 12', var(--brand); font-weight: 400; margin: 0;
  font-size: 96px; line-height: 1; text-align: center;
  text-shadow: 4px 4px 0 rgba(0,0,0,0.7); }
.px-wordmark small { display: block; font-family: 'Pixelify Sans', monospace;
  font-size: 16px; letter-spacing: 0.5em; text-indent: 0.5em;
  text-transform: uppercase; color: #7d7460; margin-top: 8px;
  text-shadow: 2px 2px 0 rgba(0,0,0,0.7); }
.px-rule { display: flex; align-items: center; gap: 16px;
  width: min(420px, 70vw); margin: 28px 0 30px; }
.px-rule::before, .px-rule::after { content: ''; flex: 1; height: 2px;
  background: #7d7460; opacity: 0.55; }
.px-gem { position: relative; width: 2px; height: 2px; background: var(--brass);
  box-shadow:
    0 -4px 0 var(--brass), 0 4px 0 var(--brass),
    -4px 0 0 var(--brass), 4px 0 0 var(--brass),
    -2px -2px 0 var(--brass), 2px -2px 0 var(--brass),
    -2px 2px 0 var(--brass), 2px 2px 0 var(--brass); }
.px-menu { display: flex; flex-direction: column; align-items: center; gap: 6px; }
.px-menu button { font: inherit; font-size: 28px; font-weight: 400;
  letter-spacing: 0.18em; text-indent: 0.18em; text-transform: uppercase;
  color: #d8cfae; background: none; border: 0; cursor: pointer;
  padding: 8px 26px; min-height: 48px; text-align: center;
  display: flex; align-items: center; gap: 18px;
  text-shadow: 2px 2px 0 rgba(0,0,0,0.8); transition: none; }
.px-menu button .px-c { font-size: 22px; color: rgb(243,239,44); visibility: hidden;
  text-shadow: 2px 2px 0 rgb(93,77,12); }
.px-menu button:hover, .px-menu button:focus-visible { outline: none;
  color: rgb(243,239,44); text-shadow: 2px 2px 0 rgb(93,77,12); }
.px-menu button:hover .px-c, .px-menu button:focus-visible .px-c { visibility: visible; }
/* PX1b: THREE ZONES - build left, the skin toggle dead center, About
   the bottom-right box. A grid, because flex space-between centers the
   middle child only when the outer two happen to weigh the same. */
.px-foot { position: absolute; left: 0; right: 0; bottom: 0;
  display: grid; grid-template-columns: 1fr auto 1fr; align-items: end;
  padding: 12px 16px; font-size: 15px; letter-spacing: 0.12em;
  text-transform: uppercase; color: #7d7460;
  text-shadow: 2px 2px 0 rgba(0,0,0,0.7); }
.px-build { justify-self: start; }
/* The skin switch keeps skinSwitch()'s own markup; on the pixel foot
   the active option takes the classic gold, stays a 44px target, and
   the 'switch anytime' hint is the shell's - the centered pair reads
   as a control on its own. */
.px-foot .skinswitch { justify-self: center; display: flex; align-items: center; gap: 14px; }
.px-foot .skinopt { font: inherit; min-height: 44px; color: #7d7460; cursor: pointer;
  border: 0; background: none; padding: 0 6px; }   /* the shell's box has no place on the boxless face */
.px-foot .skinopt.on { color: rgb(243,239,44); text-shadow: 2px 2px 0 rgb(93,77,12); }
.px-foot .skinhint { display: none; }
/* The About box: the ONE box on the boxless face, which is what makes
   it read as a plaque rather than a menu row. 2px border in whole
   pixels, gold on hover by the same pair. */
.px-about { font: inherit; font-size: 16px; letter-spacing: 0.14em; text-indent: 0.14em;
  text-transform: uppercase; color: #d8cfae; cursor: pointer;
  justify-self: end; min-height: 44px; padding: 8px 18px;
  background: rgba(10,12,17,0.55); border: 2px solid #7d7460;
  text-shadow: 2px 2px 0 rgba(0,0,0,0.8); transition: none; }
.px-about:hover, .px-about:focus-visible { outline: none;
  color: rgb(243,239,44); border-color: var(--brass);
  text-shadow: 2px 2px 0 rgb(93,77,12); }
@media (max-width: 480px) {
  .px-wordmark { font-size: 60px; }
  .px-menu button { font-size: 24px; letter-spacing: 0.12em; text-indent: 0.12em; }

  /* PX1b: a phone foot is two rows - the toggle centered on its own,
     build and About beneath it - because three zones across 393px made
     the toggle wrap vertically and shoulder into the build line. */
  .px-foot { grid-template-columns: 1fr auto;
    grid-template-areas: 'switch switch' 'build about'; row-gap: 4px; }
  .px-foot .skinswitch { grid-area: switch; }
  .px-build { grid-area: build; align-self: center; }
  .px-about { grid-area: about; }
}
@media (prefers-reduced-motion: reduce) { .px-ground { animation: none; } }
/* PX8, caught by the tap probe TWICE: centering the list on a SHORT
   screen ran its last rows UNDER the fixed foot, whose skin switch
   then intercepted their taps - Load Game was drawn and unreachable,
   the AUDIT F1 shape exactly. The first fix keyed on max-WIDTH and a
   landscape phone (851x393) sailed past it: the condition was never
   'narrow', it was 'short'. The stage stops centering, scrolls, and
   reserves the foot's height whenever height is the constraint; the
   foot stacks two rows only where width also runs out. */
@media (max-height: 560px), (max-width: 480px) {
  .px-stage { justify-content: flex-start; padding: 7dvh 24px 132px; overflow-y: auto; }
}

/* ── PX8: THE SHELL WEARS THE PIXELS (Mac: "Settings next") ─────
   The section shell - side rail, pane, and above all the settings
   three-pane screen - repainted into the pixel idiom. EVERY RULE
   HERE IS PAINT: scoped under .shell (the menu's root alone; the
   wizard, sheet and inventory own other roots), later in the sheet
   so it wins the ties, and it moves NO geometry - the 44px targets
   AUDIT F1's tap probe measures, the phone sheet, the second-tap
   gesture and the dot all keep their sizes and their laws. */
.shell { font-family: 'Pixelify Sans', monospace; -webkit-font-smoothing: none;
  /* U63 (found on the site, which wears the same face): Pixelify Sans
     ships an fi LIGATURE whose glyph reads as a capital A - "files"
     renders "Ales", "first" renders "Arst", "Difficulty" renders
     "DifAculty". Every enhanced screen is set in this face, so the
     ligatures go off at the root of both faces. */
  font-variant-ligatures: none; font-feature-settings: 'liga' 0, 'clig' 0; }
.shell button { transition: none; border-radius: 0; }
.shell .brand h1 { font-family: 'Jacquard 12', var(--brand); font-weight: 400;
  letter-spacing: 0.02em; text-shadow: 2px 2px 0 rgba(0,0,0,0.7); }
.shell .skinopt { border-radius: 0; letter-spacing: 0.14em; }
.shell .skinopt.on { color: rgb(243,239,44); border-color: var(--brass);
  text-shadow: 2px 2px 0 rgb(93,77,12); }
.shell .railbtn { letter-spacing: 0.12em; text-transform: uppercase;
  text-shadow: 2px 2px 0 rgba(0,0,0,0.7); }
.shell .railbtn.on { color: rgb(243,239,44); text-shadow: 2px 2px 0 rgb(93,77,12); }
.shell .railbtn:hover { color: rgb(243,239,44); text-shadow: 2px 2px 0 rgb(93,77,12); }
.shell .head h2 { font-family: inherit; font-weight: 400; letter-spacing: 0.14em;
  text-transform: uppercase; text-shadow: 2px 2px 0 rgba(0,0,0,0.8); }
.shell .card, .shell .dcard { border: 2px solid rgba(125,116,96,0.55); border-radius: 0;
  background: rgba(0,0,0,0.35); }
.shell .card h3, .shell .dcard h3, .shell .empty h3 { font-family: inherit; font-weight: 400;
  letter-spacing: 0.12em; text-transform: uppercase;
  text-shadow: 2px 2px 0 rgba(0,0,0,0.8); }
.shell .tag { color: rgb(243,239,44); text-shadow: 2px 2px 0 rgb(93,77,12);
  letter-spacing: 0.24em; background: none; border: 0; }
.shell .act { border: 2px solid rgba(125,116,96,0.55); border-radius: 0; background: none;
  letter-spacing: 0.14em; text-transform: uppercase; color: var(--bone);
  text-shadow: 2px 2px 0 rgba(0,0,0,0.8); }
.shell .act:hover, .shell .act:focus-visible { color: rgb(243,239,44); border-color: var(--brass);
  background: none; text-shadow: 2px 2px 0 rgb(93,77,12); }
.shell .act.primary { color: rgb(243,239,44); border-color: var(--brass); background: none;
  text-shadow: 2px 2px 0 rgb(93,77,12); }
.shell .act:disabled { color: rgba(125,116,96,0.45); border-color: rgba(125,116,96,0.3); }
/* ── the settings screen ── */
.shell .subbtn { letter-spacing: 0.1em; text-transform: uppercase; border-radius: 0;
  text-shadow: 2px 2px 0 rgba(0,0,0,0.7); }
.shell .subbtn.on { color: rgb(243,239,44); text-shadow: 2px 2px 0 rgb(93,77,12); }
.shell .subbtn .count { font-family: inherit; border-radius: 0;
  border: 2px solid rgba(125,116,96,0.4); background: none; }
.shell .more-dot { border-radius: 0; width: 6px; height: 6px; background: var(--brass); }
.shell .legend i { border-radius: 0; width: 6px; height: 6px; }
.shell .row { border-radius: 0; }
.shell .row.on { outline: 2px solid rgba(192,138,62,0.6); outline-offset: -2px; }
.shell .row-name { text-shadow: 2px 2px 0 rgba(0,0,0,0.8); }
.shell .ctl .val { letter-spacing: 0.08em; text-shadow: 2px 2px 0 rgba(0,0,0,0.7); }
.shell .step { border: 2px solid rgba(125,116,96,0.55); border-radius: 0; background: none;
  text-shadow: 2px 2px 0 rgba(0,0,0,0.8); }
.shell .step:hover { color: rgb(243,239,44); border-color: var(--brass);
  text-shadow: 2px 2px 0 rgb(93,77,12); }
.shell .swatch { border: 2px solid rgba(125,116,96,0.55); border-radius: 0; }
.shell .dcard h3 { font-size: 20px; }
.shell .dcard code { font-family: inherit; border: 2px solid rgba(125,116,96,0.4);
  border-radius: 0; background: rgba(0,0,0,0.35); letter-spacing: 0.06em; }
.shell .sheet-close { letter-spacing: 0.2em; text-shadow: 2px 2px 0 rgba(0,0,0,0.7); }
/* tier dots stay their tier colours; only the shape squares off. */
/* ── PX11: THE SHELL STANDS ON THE SKY (Mac: the fullscreen settings
   gets the treatment) ── the boot shell renders over the home's own
   ground canvas; every old panel colour comes off and real 2px rules
   replace the painted grid gaps. Paint and grounds only - the grid,
   the sizes and every measured target are exactly where they were. */
.shell { position: relative; z-index: 1; background: transparent; }
.shell .side { background: rgba(10,12,17,0.62); border-right: 2px solid rgba(125,116,96,0.35); }
.shell .pane { background: transparent; }
.shell .head { background: transparent; border-bottom: 2px solid rgba(125,116,96,0.35); }
.shell .panes { background: transparent; }
.shell .subrail { background: rgba(10,12,17,0.45); border-right: 2px solid rgba(125,116,96,0.35); }
.shell .list { background: rgba(10,12,17,0.38); }   /* a breath of scrim so the stars stay behind the words */
.shell .detail { background: rgba(10,12,17,0.55); border-left: 2px solid rgba(125,116,96,0.35); }
.shell .row { background: none; border-bottom: 2px solid rgba(125,116,96,0.3); }
.shell .row:hover { background: rgba(0,0,0,0.25); }
.shell .row.on { background: rgba(0,0,0,0.25); box-shadow: none; }
.shell .foot { background: transparent; }

/* ── PX12: THE DETAIL PASS ──────────────────────────────────────
   The craft layer, named flaw by flaw before it was written:
   1. SCROLLBARS. The browser default broke the idiom on every
      scrolling column. Square 10px rails, dim square thumbs, brass
      on hover - shell and pause window alike, plus the Firefox pair.
   2. THE GEM SPEAKS EVERYWHERE. The rail's and the category strip's
      active rows take the same diamond every other surface leads
      with - the glyph, never a rotated box (a rotated square
      anti-aliases its diagonals; the pixel font does not).
   3. SECTION TITLES take the window's wing rules.
   4. ONE DATA COLOUR. Values read #c5bda2 in the window and brass in
      the shell; data is c5bda2 everywhere now - brass is ornament,
      gold is the hand.
   5. THE F8 DOT becomes the diamond it always wanted to be.
   6. EMPTY STATES shed the dashed 1px box for a quiet open diamond
      over pixel type.
   7. KEYBOARD FOCUS in the language: rows and chips take the gold
      pair plus a brass outline under :focus-visible, so a tab is as
      visible as a hover.
   8. NOTHING EASES. The last row transition dies. */
.shell ::-webkit-scrollbar, .px-win ::-webkit-scrollbar { width: 10px; height: 10px; }
.shell ::-webkit-scrollbar-track, .px-win ::-webkit-scrollbar-track { background: rgba(0,0,0,0.3); }
.shell ::-webkit-scrollbar-thumb, .px-win ::-webkit-scrollbar-thumb {
  background: rgba(125,116,96,0.5); border: 2px solid rgba(0,0,0,0.3); border-radius: 0; }
.shell ::-webkit-scrollbar-thumb:hover, .px-win ::-webkit-scrollbar-thumb:hover { background: var(--brass); }
.shell, .px-win { scrollbar-width: thin; scrollbar-color: rgba(125,116,96,0.6) rgba(0,0,0,0.3); }

.shell .railbtn.on .rk::before, .shell .railbtn:focus-visible .rk::before {
  content: '\\25c6  '; color: rgb(243,239,44); font-size: 12px;
  text-shadow: 2px 2px 0 rgb(93,77,12); }
.shell .subbtn.on::before { content: '\\25c6'; color: rgb(243,239,44); font-size: 11px;
  margin-right: 8px; text-shadow: 2px 2px 0 rgb(93,77,12); }
.shell .more-dot { width: auto; height: auto; background: none; }
.shell .more-dot::before { content: '\\25c6'; color: var(--brass); font-size: 10px;
  text-shadow: 2px 2px 0 rgba(0,0,0,0.7); }

.shell .head { display: flex; align-items: center; gap: 16px;
  border-bottom: 2px solid rgba(125,116,96,0.35); }
.shell .head::before, .shell .head::after { content: ''; flex: 1; height: 2px; max-width: 110px;
  background: linear-gradient(90deg, transparent, rgba(125,116,96,0.7)); }
.shell .head::after { background: linear-gradient(90deg, rgba(125,116,96,0.7), transparent); }
.shell .head h2 { font-size: 24px; letter-spacing: 0.14em; text-indent: 0.14em; }

.shell .val, .px-setwrap .val { color: #c5bda2; text-shadow: 2px 2px 0 rgba(0,0,0,0.7); }

.shell .empty, .px-sys .empty { border: 0; text-align: center; padding: 20px 22px; }
.shell .empty::before, .px-sys .empty::before { content: '\\25c7'; display: block;
  color: rgba(125,116,96,0.7); font-size: 15px; margin-bottom: 8px;
  text-shadow: 2px 2px 0 rgba(0,0,0,0.7); }
.shell .empty h3 { font-family: inherit; font-size: 16px; letter-spacing: 0.14em;
  text-transform: uppercase; color: #c5bda2; text-shadow: 2px 2px 0 rgba(0,0,0,0.8); }
.shell .empty p { text-shadow: 2px 2px 0 rgba(0,0,0,0.7); }

.shell .row-main:focus-visible { outline: 2px solid var(--brass); outline-offset: -2px; }
.shell .row-main:focus-visible .row-name { color: rgb(243,239,44);
  text-shadow: 2px 2px 0 rgb(93,77,12); }
.shell .subbtn:focus-visible, .shell .railbtn:focus-visible { outline: none;
  color: rgb(243,239,44); text-shadow: 2px 2px 0 rgb(93,77,12); }
.px-qrow:focus-visible { outline: none; }
.px-setwrap .row-main:focus-visible { outline: 2px solid var(--brass); outline-offset: -2px; }

.shell .row, .shell .act, .shell .step { transition: none; }
.shell .dcard .status { color: #c5bda2; text-shadow: 2px 2px 0 rgba(0,0,0,0.7); }
.shell .tag { border: 2px solid rgba(125,116,96,0.4); color: rgb(243,239,44);
  text-shadow: 2px 2px 0 rgb(93,77,12); letter-spacing: 0.24em; }

/* ── PX13: THE WIZARD WEARS THE PIXELS ──────────────────────────
   The new-game walk on the same sky, in the same language - paint
   over U50's machine, which does not move: every stage, every back
   arm, the keyboard table and the walk-not-a-menu rail law are the
   flow's and stay the flow's.
   THE RAIL IS A GEM SPINE: done stages carry a dim filled diamond,
   the current stage the gold pair, the road ahead an open one - the
   walk drawn as ornament, read at a glance. */
.wizard { background: transparent; }
.wizard .railbtn .rk::before { content: '\\25c7  '; color: rgba(125,116,96,0.55);
  font-size: 12px; }
.wizard .railbtn.done .rk::before { content: '\\25c6  '; color: #7d7460; }
.wizard .railbtn.on .rk::before { content: '\\25c6  '; color: rgb(243,239,44);
  text-shadow: 2px 2px 0 rgb(93,77,12); }
.wizard .railbtn.done { border-left-color: transparent; }
.wizard .railbtn.done .rk { color: #7d7460; }
.wizard .railbtn.todo .rk { color: rgba(125,116,96,0.5); }
.wizard .stepstrip .seg { border-radius: 0; background: rgba(125,116,96,0.3); }
.wizard .stepstrip .seg.on { background: var(--brass); }
.wizard .steptext { letter-spacing: 0.14em; text-transform: uppercase; color: #7d7460;
  text-shadow: 2px 2px 0 rgba(0,0,0,0.7); }
/* The stage questions take the window's wing rules - every screen
   asks its one question between the same ornaments. */
.wizard .choose h2 { font-family: inherit; font-weight: 400; font-size: 24px;
  letter-spacing: 0.14em; text-indent: 0.14em; text-transform: uppercase;
  display: flex; align-items: center; justify-content: center; gap: 14px;
  text-shadow: 2px 2px 0 rgba(0,0,0,0.8); }
.wizard .choose h2::before, .wizard .choose h2::after { content: ''; flex: 0 0 90px; height: 2px; }
.wizard .choose h2::before { background: linear-gradient(90deg, transparent, rgba(125,116,96,0.7)); }
.wizard .choose h2::after { background: linear-gradient(90deg, rgba(125,116,96,0.7), transparent); }
/* The big choices: pixel plaques - the About box's language at
   decision size. */
.wizard .bigbtn { border: 2px solid rgba(125,116,96,0.55); border-radius: 0;
  background: rgba(10,12,17,0.55); color: #d8cfae; font-family: inherit;
  letter-spacing: 0.1em; text-transform: uppercase; font-size: 16px;
  text-shadow: 2px 2px 0 rgba(0,0,0,0.8); transition: none; }
.wizard .bigbtn:hover, .wizard .bigbtn:focus-visible { outline: none;
  color: rgb(243,239,44); border-color: var(--brass); background: rgba(0,0,0,0.35);
  text-shadow: 2px 2px 0 rgb(93,77,12); }
.wizard .bigbtn.on { color: rgb(243,239,44); border-color: var(--brass);
  text-shadow: 2px 2px 0 rgb(93,77,12); }
/* The race grid and the map's fallback list ride the same plaque. */
.wizard .racegrid button { border: 2px solid rgba(125,116,96,0.55); border-radius: 0;
  background: rgba(10,12,17,0.55); color: #d8cfae; font-family: inherit;
  letter-spacing: 0.1em; text-transform: uppercase;
  text-shadow: 2px 2px 0 rgba(0,0,0,0.8); transition: none; }
.wizard .racegrid button:hover, .wizard .racegrid button:focus-visible { outline: none;
  color: rgb(243,239,44); border-color: var(--brass);
  text-shadow: 2px 2px 0 rgb(93,77,12); }
/* The name box: a pixel field - ink ground, 2px frame, gold focus. */
.wizard .namebox { font-family: inherit; font-size: 20px; letter-spacing: 0.08em;
  color: #d8cfae; background: rgba(0,0,0,0.4); border: 2px solid rgba(125,116,96,0.55);
  border-radius: 0; padding: 10px 14px; text-shadow: 2px 2px 0 rgba(0,0,0,0.8); }
.wizard .namebox:focus { outline: none; border-color: var(--brass);
  color: rgb(243,239,44); text-shadow: 2px 2px 0 rgb(93,77,12); }
/* The ten faces: 2px frames, the chosen one gold - and the number
   fallback reads as a plaque, not a hole. */
.wizard .facegrid button { border: 2px solid rgba(125,116,96,0.55); border-radius: 0;
  background: rgba(10,12,17,0.55); transition: none; }
.wizard .facegrid button:hover, .wizard .facegrid button:focus-visible { outline: none; border-color: var(--brass); }
.wizard .facegrid button.on { border-color: var(--brass);
  outline: 2px solid rgba(192,138,62,0.5); outline-offset: 2px; }
.wizard .facenum { font-family: inherit; color: #7d7460; font-size: 18px;
  text-shadow: 2px 2px 0 rgba(0,0,0,0.7); }
/* Reflexes: the five bands as plaques, the chosen one gold. */
.wizard .reflexbtn { border: 2px solid rgba(125,116,96,0.55); border-radius: 0;
  background: rgba(10,12,17,0.55); color: #d8cfae; font-family: inherit;
  letter-spacing: 0.12em; text-transform: uppercase;
  text-shadow: 2px 2px 0 rgba(0,0,0,0.8); transition: none; }
.wizard .reflexbtn:hover, .wizard .reflexbtn:focus-visible { outline: none;
  color: rgb(243,239,44); border-color: var(--brass); text-shadow: 2px 2px 0 rgb(93,77,12); }
.wizard .reflexbtn.on { color: rgb(243,239,44); border-color: var(--brass);
  text-shadow: 2px 2px 0 rgb(93,77,12); }
/* The map's caption and the pending-stage words sit in pixel dim. */
.wizard .mapnote { color: #7d7460; text-shadow: 2px 2px 0 rgba(0,0,0,0.7); }
/* PX17a: the description reads as prose - a size a person reads at,
   air between the lines, air between the paragraphs. */
.wizard .dcard p { font-size: 15px; line-height: 1.6; margin: 0 0 12px;
  color: #c5bda2; text-shadow: 2px 2px 0 rgba(0,0,0,0.7); }
/* The action bar's Back/Cancel is the shell's own .act, already
   repainted; the bar just loses its old hairline for the 2px rule. */
.wizard .actionbar { border-top: 2px solid rgba(125,116,96,0.35); background: transparent; }
/* PX13b (Mac: "the main background is still the old basic ui"): the
   stage ground was .stagebody's var(--iron) - the SAME gap-paint
   trick PX10b found on the settings .panes, one file later. Off, and
   the walk floats on the sky like every other face; the class list
   keeps the shell's 0.38 breath and the dcard its own bordered card. */
.wizard .stagebody { background: transparent; }

/* ── PX14/PX17d: THE DIAL, BUILT ── the in-game compass rose with
   its craft pass. FADE INTO VIEW: opacity and the depth-of-field
   blur step in together over 220ms in five pixel steps - the world
   behind falls out of focus (backdrop blur + a light desaturate),
   which is the reference's own gesture; reduced-motion gets the end
   state at once. CLOSE IS INSTANT - the dial must be gone before the
   window it opens takes the keys. Everything else is the family:
   corner gems framing the dial space, a layered diamond knot, 2px
   arm rules with a mid gem and an open terminal, labels in the caps,
   the chosen arm in the gold pair with its flanking diamonds. */
.px-dial { position: fixed; inset: 0; z-index: 14; background: rgba(10,12,17,0.4);
  display: grid; place-items: center; grid-template-rows: 1fr auto;
  font-family: 'Pixelify Sans', monospace; -webkit-font-smoothing: none; color: #d8cfae;
  opacity: 0; backdrop-filter: blur(0px) saturate(100%);
  -webkit-backdrop-filter: blur(0px) saturate(100%);
  transition: opacity 0.22s steps(5, end), backdrop-filter 0.22s steps(5, end),
    -webkit-backdrop-filter 0.22s steps(5, end); }
.px-dial.on { opacity: 1; backdrop-filter: blur(7px) saturate(82%);
  -webkit-backdrop-filter: blur(7px) saturate(82%); }
@media (prefers-reduced-motion: reduce) {
  .px-dial { transition: none; opacity: 1; backdrop-filter: blur(7px) saturate(82%);
    -webkit-backdrop-filter: blur(7px) saturate(82%); }
}
.px-rose { position: relative; width: min(560px, 86vw); height: min(500px, 78vh); }
.px-rose .px-corner { position: absolute; }
.px-rose .px-tl { left: -1px; top: -1px; transform: translate(-50%,-50%); }
.px-rose .px-tr { right: -1px; top: -1px; transform: translate(50%,-50%); }
.px-rose .px-bl { left: -1px; bottom: -1px; transform: translate(-50%,50%); }
.px-rose .px-br { right: -1px; bottom: -1px; transform: translate(50%,50%); }
/* THE KNOT: three layered diamonds, one center. */
.px-knotwrap { position: absolute; left: 50%; top: 50%; width: 0; height: 0; }
.px-knot { position: absolute; left: 0; top: 0; transform: translate(-50%,-50%);
  text-shadow: 2px 2px 0 rgba(0,0,0,0.8); }
.px-knot-outer { font-size: 64px; color: rgba(125,116,96,0.4); }
.px-knot-mid { font-size: 34px; color: var(--brass); }
.px-knot-core { font-size: 14px; color: rgb(243,239,44); text-shadow: 2px 2px 0 rgb(93,77,12); }
/* THE ARMS: a 2px rule from the knot, a small gem at its middle, an
   open terminal past the label. */
.px-arm { position: absolute; font: inherit; font-size: 22px; letter-spacing: 0.18em;
  text-indent: 0.18em; text-transform: uppercase; color: #c5bda2; background: none;
  border: 0; cursor: pointer; min-height: 44px; min-width: 44px; padding: 8px 14px;
  display: flex; align-items: center; gap: 12px;
  text-shadow: 2px 2px 0 rgba(0,0,0,0.85); transition: none; }
.px-arm .px-c { font-size: 13px; color: rgb(243,239,44); visibility: hidden;
  text-shadow: 2px 2px 0 rgb(93,77,12); }
.px-arm .px-term { font-size: 11px; color: rgba(125,116,96,0.7);
  text-shadow: 2px 2px 0 rgba(0,0,0,0.8); }
.px-arm::before { content: ''; position: absolute; background: rgba(125,116,96,0.55); }
.px-arm::after { content: '\\25c6'; position: absolute; font-size: 9px;
  color: rgba(192,138,62,0.8); text-shadow: 2px 2px 0 rgba(0,0,0,0.8); }
.px-arm.on, .px-arm:hover, .px-arm:focus-visible { outline: none;
  color: rgb(243,239,44); text-shadow: 2px 2px 0 rgb(93,77,12); }
.px-arm.on .px-c, .px-arm:hover .px-c, .px-arm:focus-visible .px-c { visibility: visible; }
.px-arm.on .px-term, .px-arm:hover .px-term { color: var(--brass); }
.px-arm.on::before, .px-arm:hover::before { background: var(--brass); }
.px-n { left: 50%; top: 5%; transform: translateX(-50%); flex-direction: column; gap: 6px; }
.px-n .px-term { order: -1; }
.px-n::before { left: 50%; top: 100%; width: 2px; height: 92px; transform: translateX(-50%); }
.px-n::after { left: 50%; top: calc(100% + 42px); transform: translate(-50%,-50%); }
.px-s { left: 50%; bottom: 5%; transform: translateX(-50%); flex-direction: column-reverse; gap: 6px; }
.px-s .px-term { order: -1; }
.px-s::before { left: 50%; bottom: 100%; width: 2px; height: 92px; transform: translateX(-50%); }
.px-s::after { left: 50%; bottom: calc(100% + 42px); transform: translate(-50%,50%); }
.px-e { right: 3%; top: 50%; transform: translateY(-50%); flex-direction: row-reverse; }
/* PX18b (Mac): the horizontal rules stopped ON the knot while the
   vertical ones stopped short - measured -38px vs +12px clearance.
   62px gives east and west the same 12px breath as north and south;
   the mid gems recentre with them. */
.px-e::before { right: 100%; top: 50%; height: 2px; width: 62px; transform: translateY(-50%); }
.px-e::after { right: calc(100% + 31px); top: 50%; transform: translate(50%,-50%); }
.px-w { left: 3%; top: 50%; transform: translateY(-50%); }
.px-w .px-term { order: -1; }
.px-w::before { left: 100%; top: 50%; height: 2px; width: 62px; transform: translateY(-50%); }
.px-w::after { left: calc(100% + 31px); top: 50%; transform: translate(-50%,-50%); }
/* THE HINT: the keys, taught where they are used. */
.px-dialhint { color: #7d7460; font-size: 13px; letter-spacing: 0.2em; text-indent: 0.2em;
  text-transform: uppercase; margin: 0 0 18px; text-shadow: 2px 2px 0 rgba(0,0,0,0.7); }
@media (max-width: 480px) {
  .px-arm { font-size: 17px; }
  .px-n::before, .px-s::before { height: 58px; }
  .px-e::before, .px-w::before { width: 34px; }
  .px-n::after { top: calc(100% + 26px); }
  .px-s::after { bottom: calc(100% + 26px); }
  .px-e::after { right: calc(100% + 17px); }
  .px-w::after { left: calc(100% + 17px); }
  .px-knot-outer { font-size: 46px; }
  .px-knot-mid { font-size: 26px; }
}

/* ── PX19: THE PACK IS A WINDOW ── (Mac: centered, window-based).
   The pause window's own frame - corner gems, 2px dim border, 0.72
   ink glass - centered over the live game, arriving with THE DIAL'S
   OWN GESTURE: a five-step fade while the world behind drops into
   depth-of-field. Inside, the reference's anatomy compressed to a
   window: the category spine left, bare names middle (local over the
   ground/wagon pair, the pair law intact), the SHOWCASE right -
   figure above, the bracketed plaque beneath - and the window
   carries its own footer: items, the carry meter (blood past
   four-fifths), gold. */
.pack-shell { position: absolute; inset: 0; z-index: 1; background: rgba(10,12,17,0.45);
  display: grid; place-items: center;
  font-family: 'Pixelify Sans', monospace; -webkit-font-smoothing: none; color: #d8cfae;
  opacity: 0; backdrop-filter: blur(0px) saturate(100%); -webkit-backdrop-filter: blur(0px) saturate(100%);
  transition: opacity 0.22s steps(5, end), backdrop-filter 0.22s steps(5, end),
    -webkit-backdrop-filter 0.22s steps(5, end); }
.pack-shell.on { opacity: 1; backdrop-filter: blur(6px) saturate(85%);
  -webkit-backdrop-filter: blur(6px) saturate(85%); }
@media (prefers-reduced-motion: reduce) {
  .pack-shell { transition: none; opacity: 1; backdrop-filter: blur(6px) saturate(85%);
    -webkit-backdrop-filter: blur(6px) saturate(85%); } }
.pack-shell button { transition: none; border-radius: 0; }
.pack-win { position: relative; width: min(1040px, 95vw); height: min(660px, 86dvh);
  display: flex; flex-direction: column;
  background: rgba(10,12,17,0.72); border: 2px solid #7d7460;
  transform: translateY(8px); transition: transform 0.22s steps(5, end); }
.pack-shell.on .pack-win { transform: none; }
@media (prefers-reduced-motion: reduce) { .pack-win { transform: none; transition: none; } }
.pack-win .px-corner { position: absolute; }
.pack-win .px-tl { left: -1px; top: -1px; transform: translate(-50%,-50%); }
.pack-win .px-tr { right: -1px; top: -1px; transform: translate(50%,-50%); }
.pack-win .px-bl { left: -1px; bottom: -1px; transform: translate(-50%,50%); }
.pack-win .px-br { right: -1px; bottom: -1px; transform: translate(50%,50%); }
.pack-shell .pack-id { display: flex; justify-content: space-between; align-items: center;
  background: transparent; border-bottom: 2px solid rgba(125,116,96,0.35); padding: 8px 16px; }
.pack-shell .pack-id h2 { font-family: inherit; font-weight: 400; font-size: 20px; margin: 0;
  letter-spacing: 0.18em; text-indent: 0.18em; text-transform: uppercase;
  display: flex; align-items: center; gap: 14px; text-shadow: 2px 2px 0 rgba(0,0,0,0.85); }
.pack-shell .pack-id h2::before { content: ''; flex: 0 0 48px; height: 2px;
  background: linear-gradient(90deg, transparent, rgba(125,116,96,0.7)); }
/* PX19f: the reference's skeleton - the character region and the
   details share the top; the inventory is a BOTTOM DOCK. */
.pack-shell .pack { flex: 1; min-height: 0; display: flex; flex-direction: column;
  background: transparent; }
.pack-shell .pack-main { flex: 1; min-height: 0; display: grid;
  grid-template-columns: 1fr; }   /* PX19i: the details ride a tooltip; the character takes the width */
.pack-shell .pack-dock { flex: 0 0 auto; max-height: 38%; display: flex;
  flex-direction: column; border-top: 2px solid rgba(125,116,96,0.35);
  background: rgba(0,0,0,0.25); }
.pack-shell .packcats { background: transparent; border-right: 0;
  border-bottom: 2px solid rgba(125,116,96,0.3); overflow-x: auto; padding: 0 8px; }
.pack-shell .packtabs { display: flex; flex-direction: row; gap: 2px; margin: 0; }
.pack-shell .packtab { display: flex; align-items: center; gap: 10px; text-align: left;
  min-height: 44px; padding: 8px 14px; border: 0; background: none; cursor: pointer;
  color: #a89f88; font-family: inherit; font-size: 13px; letter-spacing: 0.16em;
  text-transform: uppercase; text-shadow: 2px 2px 0 rgba(0,0,0,0.85); }
.pack-shell .packtab .count { font-family: inherit; font-size: 11px; color: #7d7460;
  background: none; border: 0; margin-left: auto; }
.pack-shell .packtab:hover, .pack-shell .packtab:focus-visible { outline: none; color: #d8cfae; }
.pack-shell .packtab.on { color: rgb(243,239,44);
  box-shadow: inset 0 -2px 0 var(--brass); text-shadow: 2px 2px 0 rgb(93,77,12); }
.pack-shell .packtab.on::after { content: '\\25c6'; font-size: 10px; margin-left: 8px; }
.pack-shell .packlists { display: block; background: transparent; overflow-y: auto; }   /* the base sheet's two-column grid, off - the loot has its own window */
/* The dock's rows are the reference's TILE GRID: square panels, the
   monogram carrying the item, the count in the corner, the name in
   the title and the plaque. The tiles live directly in .packcol -
   '.list' is the SHELL'S word, the .detail/.packcol lesson again
   (and backticks may NEVER appear inside this template literal:
   this comment's first draft closed ENHANCED_CSS mid-file and made
   the rest a tagged-template call - the octal lesson's sibling). */
.pack-shell .pack-dock .packcol { padding: 8px 10px; display: flex; flex-wrap: wrap;
  gap: 6px; align-content: flex-start; }
.pack-shell .itemrow { position: relative; display: flex; align-items: center;
  justify-content: center; width: 56px; height: 56px; padding: 0; cursor: pointer;
  background: rgba(10,12,17,0.6); border: 2px solid rgba(125,116,96,0.35);
  color: #a89f88; font-family: inherit; text-shadow: 2px 2px 0 rgba(0,0,0,0.85); }
.pack-shell .itemrow .tile { display: flex; width: 34px; height: 34px; align-items: center;
  justify-content: center; border: 0; background: none; font-size: 16px; color: #c5bda2; }
.pack-shell .itemrow .itemname { position: absolute; width: 1px; height: 1px;
  overflow: hidden; clip-path: inset(50%); }   /* the probes read it; the plaque shows it */
.pack-shell .itemrow .itemwt { display: none; }
.pack-shell .itemrow .rowcount, .pack-shell .itemrow .count { position: absolute;
  right: 2px; bottom: 1px; font-size: 9px; color: var(--brass);
  text-shadow: 2px 2px 0 rgba(0,0,0,0.85); }
.pack-shell .itemrow:hover, .pack-shell .itemrow:focus-visible { outline: none;
  border-color: var(--brass); color: #d8cfae; }
.pack-shell .itemrow.on { border-color: var(--brass); color: rgb(243,239,44);
  outline: 2px solid rgba(192,138,62,0.5); outline-offset: 2px; box-shadow: none;
  text-shadow: 2px 2px 0 rgb(93,77,12); }
.pack-shell .packempty { color: #7d7460; padding: 12px 16px; font-size: 14px;
  text-shadow: 2px 2px 0 rgba(0,0,0,0.7); }
.pack-shell .remotehead, .pack-shell .equippedhead { font-family: inherit; color: #7d7460;
  font-size: 11px; letter-spacing: 0.3em; text-indent: 0.3em; text-transform: uppercase;
  text-align: center; background: none; border-top: 2px solid rgba(125,116,96,0.3);
  border-bottom: 0; padding: 10px 0 4px; text-shadow: 2px 2px 0 rgba(0,0,0,0.7); }
.pack-shell .remotewho, .pack-shell .remotewho * { font-family: inherit; }
.pack-shell h3, .pack-shell .equippedhead h3, .pack-shell .remotehead * { font-family: inherit;
  font-weight: 400; letter-spacing: 0.24em; text-indent: 0.24em; text-transform: uppercase; }
.pack-shell .equippedhead h3 { font-size: 17px; color: #d8cfae; margin: 0;
  text-shadow: 2px 2px 0 rgba(0,0,0,0.8); }
.pack-shell .equippedhead .meta { font-size: 10px; color: #7d7460; margin: 2px 0 0; }
.pack-shell .remoteacts { padding: 0 10px; }
/* The showcase column: the figure over the plaque, both scrolling
   together, the game glass behind them through the window. */
/* PX19g/i: NO SCROLLING CHARACTER SHEET, NO WEB CHROME - and no
   right panel: the details are a TOOLTIP, absolutely placed beside
   its anchor inside the frame, in the plaque's own dress; the phone
   keeps the .packdetail bottom sheet's physics untouched. */
.pack-shell .charcol { overflow: hidden; padding: 12px 22px 16px; display: flex;
  flex-direction: column; justify-content: stretch; }
/* .packtip.packdetail outranks the base .packdetail column rules
   (same-specificity, later-in-sheet was the trap: the tip computed
   RELATIVE, joined the flex column and folded the whole window -
   caught by measuring pre/post heights, 557 -> 260). */
.pack-shell .packtip.packdetail { position: absolute; z-index: 4;
  width: 320px; max-width: 320px;
  /* the tip is INVISIBLE FURNITURE: the base sheet's .packcol slate
     ground + padding were riding under the card and drew a grey mat
     around the plaque - the CARD is the frame, the wrapper is
     nothing. */
  background: transparent; padding: 0; border: 0; }
/* ...and the tip's CARD is near-opaque: the 0.72 glass is the pause
   window's, made for a dimmed scrim - a tooltip floats over LIVE
   text, and glass there reads as the dock bleeding through the
   plaque. */
.pack-shell .packtip.packdetail .card { background: rgba(10,12,17,0.96); }   /* (0,4,0): the base card rule ties at (0,3,0) later in the sheet - the same tie the tip's position rule already paid */
@media (max-width: 640px) {
  .pack-shell .packtip.packdetail { position: fixed; width: auto; max-width: none;
    left: 0 !important; top: auto !important; }
}
.pack-shell .figure-doll { border: 2px solid rgba(125,116,96,0.55); background: rgba(0,0,0,0.3); }
.pack-shell .slotmap, .pack-shell .wornlist, .pack-shell .equipped { background: rgba(0,0,0,0.3); }
/* PX19d: THE SLOTS STAND ON THE BODY (Mac's concept reference) - the
   worn map places each tile AT the classic doll's own anatomical
   coordinate, scaled: helm above, amulets and rings on their flanks,
   hands at the hands, feet below, marks and crystals in the off-body
   row the map already gives them. The DOLL stands behind the tiles
   when its art can draw; the tiles alone are the schematic when it
   cannot. The chosen tile wears the gold pair and the brass frame;
   an empty slot is a dim open diamond and NOT a button. */
.pack-shell .equipped { display: flex; flex-direction: column; min-height: 0;
  text-align: center; }
.pack-shell .equipped .wornmap { flex: 1; min-height: 0; }
/* PX20c: the name in the title bar, after PACK, in the dim - the bar
   already names the window, so the character is the second word. */
.pack-shell .pack-id .pack-who { color: #7d7460; margin-left: 4px; }
.pack-shell .pack-id .pack-who::before { content: '\\00b7'; margin-right: 14px; }
/* PX19g: the region FITS ITS SPACE - 5 rows of 52 + gaps + the WORN
   head ~= 310, inside the main area's ~380 - so the character sheet
   never scrolls. The doll owns the center: a framed panel spanning
   rows 2-4, art inside when it can draw, a quiet Avatar plaque when
   it cannot. */
/* PX20a (Mac: "spread out and organize the center now that we have
   more space"): PX19i freed the whole width when the details became a
   tooltip, and the map kept the 380px it was given when it had a third
   of the window - a 1036px area with 330px of dead air down each side.
   The map is now SIZED TO ITS SPACE: wider, with the centre column
   carrying half again the flanks (it holds a standing figure; they
   hold a word and a monogram), and rows that FILL the height instead
   of stopping at 52px: five rows of 1fr each, with the
   map claiming the area's height, so the composition breathes at any
   window size rather than at one. */
.pack-shell .wornmap { position: relative; display: grid;
  /* PX20c: the centre column is AUTO - it takes exactly the width the
     aspect-locked sprite asks for, so there is no air beside the
     figure and the two flanks split everything that is left. The map
     then fills the region it was given rather than floating in it. */
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
  grid-template-rows: repeat(6, minmax(44px, 1fr));
  gap: 12px; width: min(960px, 100%); height: 100%; margin: 0 auto;
  align-content: stretch; }
/* PX20a (Mac: "enlarge the paper sprite and remove the background"):
   the sprite stands on the window's own glass. PX19g framed it because
   an empty frame reads Avatar and the composition never collapses -
   that reasoning holds only when there is NO ART, so the frame is now
   the placeholder's alone (the .noart class). With art, no border, no
   background, no outline: a character standing among their gear. */
.pack-shell .wornmap-doll { grid-area: 1 / 2 / span 6 / auto;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 4px; border: 0; background: none; outline: 0;
  overflow: visible; color: rgba(125,116,96,0.6); padding: 2px 0; }
.pack-shell .wornmap-doll.noart { border: 2px solid rgba(125,116,96,0.45);
  background: rgba(0,0,0,0.35); outline: 2px solid rgba(125,116,96,0.25);
  outline-offset: 3px; overflow: hidden; }
/* PX20c (Mac: "ensure the paperdoll's slot is a perfect fit"): the
   cell was whatever the grid's centre column happened to be, so the
   sprite sat inside it with air down both sides - object-fit letterbox,
   which is a fit only in the sense that nothing overflows. The cell now
   CARRIES THE SPRITE'S OWN ASPECT: aspect-ratio 110/184, the classic
   paperdoll's exact proportion, height-driven and centred in the
   column. The sprite then fills it edge to edge with no letterbox at
   all, and it stays a perfect fit at every window size because the
   ratio is the constraint rather than a measured pixel. */
.pack-shell .wornmap-doll img { display: block; height: 100%; width: 100%;
  object-fit: contain; image-rendering: pixelated;
  filter: drop-shadow(3px 3px 0 rgba(0,0,0,0.55)); }
.pack-shell .wornmap-doll.hasart { aspect-ratio: 110 / 184; height: 100%; width: auto;
  justify-self: center; align-self: center; padding: 0; }
.pack-shell .wornmap-doll .wornslot { color: rgba(125,116,96,0.6); }
/* PX20c: the tile is a ROW again, because the width is there now - a
   big monogram on the left, the family word and THE PIECE'S NAME
   stacked beside it. PX19g had to hide the name when the tiles were
   52px squares and it clipped; nothing about that reasoning survives a
   300px tile, so the name comes back where a player reads it. */
.pack-shell .equipped .wornrow { position: relative; z-index: 1;
  display: flex; flex-direction: row; align-items: center; justify-content: flex-start;
  gap: 14px; min-height: 44px; padding: 8px 14px; overflow: hidden; text-align: left;
  background: rgba(10,12,17,0.72); border: 2px solid rgba(125,116,96,0.35);
  color: #a89f88; font-family: inherit; text-shadow: 2px 2px 0 rgba(0,0,0,0.85); }
/* PX19g hid this line because a 52px square clipped it; PX20c gives
   the tiles the region's whole width and the name comes back - the
   family word above it in the dim, the piece itself in the bone. */
.pack-shell .wornrow .wornname { display: block; font-size: 14px; color: #d8cfae;
  max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  text-shadow: 2px 2px 0 rgba(0,0,0,0.85); }
.pack-shell .wornrow.wornempty .wornname { color: rgba(125,116,96,0.5); }
/* The word and the name are one stack beside the monogram. */
.pack-shell .wornrow .worntext, .pack-shell .transport .worntext {
  display: flex; flex-direction: column; gap: 3px;
  min-width: 0; align-items: flex-start; }
.pack-shell .transport .wornname { display: block; font-size: 14px; color: #d8cfae;
  max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pack-shell .transport .wornname.wornempty { color: rgba(125,116,96,0.5); }
.pack-shell .transport .wornslot { font-size: 11px; letter-spacing: 0.16em;
  text-transform: uppercase; color: #7d7460; }
.pack-shell .wornrow .worntile, .pack-shell .wornrow .tile { flex: 0 0 auto; }
.pack-shell .worncount { position: absolute; right: 5px; top: 4px; font-size: 11px;
  color: var(--brass); text-shadow: 2px 2px 0 rgba(0,0,0,0.85); }
.pack-shell .wornrow .tile { display: flex; width: 40px; height: 40px; align-items: center;
  justify-content: center; border: 0; background: none; font-size: 24px; color: #c5bda2; }
/* PX20c: the tiles carry the area now, so the MONOGRAM carries the
   tile - the reference's own read is the piece, big, with its family
   word under it. */
.pack-shell .wornrow .worntile { font-size: 26px; color: rgba(125,116,96,0.6); }
.pack-shell .wornslot { flex: 0 0 auto;   /* the base rule's 88px was a column WIDTH; on a vertical tile it becomes 88px of HEIGHT */
  font-size: 11px; letter-spacing: 0.16em; text-transform: uppercase;
  color: #7d7460; max-width: 100%; line-height: 1.1; white-space: nowrap; }
.pack-shell .wornrow .itemwt { display: none; }
.pack-shell button.wornrow { cursor: pointer; }
.pack-shell button.wornrow:hover, .pack-shell button.wornrow:focus-visible { outline: none;
  color: rgb(243,239,44); border-color: var(--brass); text-shadow: 2px 2px 0 rgb(93,77,12); }
.pack-shell .wornrow.on { color: rgb(243,239,44); border-color: var(--brass);
  outline: 2px solid rgba(192,138,62,0.5); outline-offset: 2px;
  text-shadow: 2px 2px 0 rgb(93,77,12); }
.pack-shell .wornrow.wornempty { color: rgba(125,116,96,0.5);
  border-color: rgba(125,116,96,0.22); background: rgba(0,0,0,0.18); }
.pack-shell button.wornrow .tile { color: #d8cfae; }
.pack-shell .wornrow.wornempty .wornname { display: none; }   /* the open diamond and the slot word carry an empty */
.pack-shell .packdetail { position: relative; transform: none; width: 100%; max-width: 420px; }
.pack-shell .packdetail .card, .pack-shell .card { min-width: 0; max-width: none;
  border: 2px solid rgba(216,207,174,0.7); outline: 2px solid rgba(125,116,96,0.35);
  outline-offset: 4px; border-radius: 0; background: rgba(10,12,17,0.72); padding: 14px 18px; }
.pack-shell .card h3 { font-family: inherit; font-weight: 400; font-size: 18px;
  letter-spacing: 0.14em; text-indent: 0.14em; text-transform: uppercase; text-align: center;
  margin: 0 0 8px; padding-bottom: 8px; border-bottom: 2px solid rgba(125,116,96,0.5);
  text-shadow: 2px 2px 0 rgba(0,0,0,0.85); }
.pack-shell .card .stats { display: grid; grid-template-columns: auto auto;
  justify-content: center; align-items: baseline; gap: 6px 14px; margin: 10px 0; }
.pack-shell .card .stats dt { color: #7d7460; font-size: 11px; letter-spacing: 0.22em;
  text-transform: uppercase; text-align: right; text-shadow: 2px 2px 0 rgba(0,0,0,0.7); }
.pack-shell .card .stats dd { margin: 0; font-size: 19px; overflow-wrap: anywhere;
  text-shadow: 2px 2px 0 rgba(0,0,0,0.85); }
.pack-shell .card .meta, .pack-shell .card p { color: #c5bda2; text-align: center; font-size: 14px;
  text-shadow: 2px 2px 0 rgba(0,0,0,0.7); }
.pack-shell .card .tag { float: right; color: #c5bda2; font-size: 10px; letter-spacing: 0.2em;
  text-transform: uppercase; border: 0; background: none;
  text-shadow: 2px 2px 0 rgba(0,0,0,0.7); }
.pack-shell .acts { display: flex; justify-content: center; gap: 8px; margin-top: 10px; flex-wrap: wrap; }
.pack-shell .act { border: 2px solid rgba(125,116,96,0.55); border-radius: 0; background: none;
  color: #d8cfae; font-family: inherit; letter-spacing: 0.12em; text-transform: uppercase;
  min-height: 44px; padding: 8px 14px; text-shadow: 2px 2px 0 rgba(0,0,0,0.85); }
.pack-shell .act:hover, .pack-shell .act:focus-visible { outline: none;
  color: rgb(243,239,44); border-color: var(--brass); background: none;
  text-shadow: 2px 2px 0 rgb(93,77,12); }
.pack-shell .act.primary { color: rgb(243,239,44); border-color: var(--brass); background: none;
  text-shadow: 2px 2px 0 rgb(93,77,12); }
.pack-shell .act:disabled { color: rgba(125,116,96,0.45); border-color: rgba(125,116,96,0.3); }
.pack-shell .sheet-close { color: #7d7460; background: none; border: 0;
  letter-spacing: 0.2em; text-transform: uppercase; min-height: 44px;
  text-shadow: 2px 2px 0 rgba(0,0,0,0.7); }
.pack-shell .packbar { display: flex; align-items: center; gap: 22px;
  border-top: 2px solid rgba(125,116,96,0.35); background: rgba(0,0,0,0.3);
  padding: 8px 16px; }
.pack-shell .packbar .k { color: #7d7460; font-size: 11px; letter-spacing: 0.22em;
  text-transform: uppercase; margin-right: 8px; text-shadow: 2px 2px 0 rgba(0,0,0,0.7); }
.pack-shell .packbar .v { font-size: 16px; text-shadow: 2px 2px 0 rgba(0,0,0,0.85); }
.pack-shell .packitems { color: #7d7460; font-size: 12px; letter-spacing: 0.14em;
  text-transform: uppercase; margin-right: auto; text-shadow: 2px 2px 0 rgba(0,0,0,0.7); }
.pack-shell .packcarry { display: flex; align-items: center; gap: 10px; }
.pack-shell .packcarry .px-meter { width: 140px; height: 8px;
  border: 2px solid rgba(125,116,96,0.55); background: rgba(0,0,0,0.4); }
.pack-shell .packgold { display: flex; align-items: baseline; }
.pack-shell .sheet-notice { color: #c5bda2; text-align: center;
  text-shadow: 2px 2px 0 rgba(0,0,0,0.7); }
.pack-shell ::-webkit-scrollbar { display: none; }
.pack-shell .pack-dock .packcol, .pack-shell .packlists, .loot-win { scrollbar-width: none; }
.loot-win::-webkit-scrollbar { display: none; }
/* PX19c: THE LOOT WINDOW - containers, corpses, the wagon and a
   littered ground ride their OWN smaller window beside the pack,
   the same frame language one size down; absent entirely when the
   ground is bare. */
.pack-shell { grid-auto-flow: column; gap: 18px; }
.loot-win { position: relative; width: min(340px, 90vw); max-height: min(560px, 80dvh);
  display: flex; flex-direction: column; overflow-y: auto;
  background: rgba(10,12,17,0.72); border: 2px solid #7d7460; padding-bottom: 8px; }
.loot-win .px-corner { position: absolute; }
.loot-win .px-tl { left: -1px; top: -1px; transform: translate(-50%,-50%); }
.loot-win .px-tr { right: -1px; top: -1px; transform: translate(50%,-50%); }
.loot-win .px-bl { left: -1px; bottom: -1px; transform: translate(-50%,50%); }
.loot-win .px-br { right: -1px; bottom: -1px; transform: translate(50%,50%); }
.loot-win .packremote { border-top: 0; background: transparent; padding: 0 0 4px; }
.loot-win .remotehead { border-top: 0; padding: 14px 16px 10px;
  border-bottom: 2px solid rgba(125,116,96,0.3); }

/* ── PX21b: THE LOOT WINDOW READS ───────────────────────────────
   Mac: "give it a solid redesign with readability". The loot list
   inherited the DOCK's 56px tile grid - anonymous squares with the
   name behind a clip-path - which is right for a bag you already know
   and wrong for a chest you have never opened: the whole question a
   container asks is WHAT IS IN IT. So in this window the rows are
   ROWS: the icon, the name, its material and word beneath, the weight
   on the right, one per line, at a size a player reads at a glance. */
.loot-win .remotewho h3 { font-size: 16px; color: #d8cfae; }
.loot-win .remotewho .meta { font-size: 12px; letter-spacing: 0.14em; color: #7d7460;
  text-transform: uppercase; margin-top: 6px; }
.loot-win .packlists, .loot-win .packcol { display: block; padding: 0; }
.loot-win .itemrow { width: 100%; height: auto; min-height: 52px;
  display: flex; align-items: center; justify-content: flex-start; gap: 12px;
  padding: 8px 14px; border: 0; border-bottom: 2px solid rgba(125,116,96,0.16);
  text-align: left; }
.loot-win .itemrow:last-child { border-bottom: 0; }
.loot-win .itemrow .tile { width: 38px; height: 38px; font-size: 18px; flex: 0 0 auto; }
.loot-win .itemrow .itemname { position: static; width: auto; height: auto;
  clip-path: none; overflow: hidden; display: flex; flex-direction: column; gap: 2px;
  min-width: 0; flex: 1; font-size: 14px; color: #d8cfae; }
.loot-win .itemrow .itemname > span { overflow: hidden; text-overflow: ellipsis;
  white-space: nowrap; }
.loot-win .itemrow .itemname small { font-size: 11px; letter-spacing: 0.12em;
  text-transform: uppercase; color: #7d7460; }
.loot-win .itemrow .itemwt { display: block; flex: 0 0 auto; font-size: 12px;
  color: #7d7460; font-variant-numeric: tabular-nums; }
.loot-win .itemrow .rowcount, .loot-win .itemrow .count { position: static;
  font-size: 12px; margin-left: 4px; }
.loot-win .itemrow:hover, .loot-win .itemrow:focus-visible { background: rgba(125,116,96,0.12); }
.loot-win .itemrow.on { background: rgba(192,138,62,0.14); outline: 0;
  box-shadow: inset 3px 0 0 var(--brass); }

/* ── PX21c: THE LOOT HOVER PLAQUE ───────────────────────────────
   A readout under the crosshair, not a control: centred low so it
   never sits on the reticle, in the same dress as the floating
   windows, with pointer-events off because nothing here is clickable.
   It SNAPS on and off - the whole point is that it answers before you
   have finished deciding to ask. */
.loothover { position: fixed; left: 50%; bottom: 16%; transform: translateX(-50%);
  z-index: 6; display: none; min-width: 190px; max-width: 300px; padding: 10px 14px;
  background: rgba(10,12,17,0.9); border: 2px solid #7d7460; pointer-events: none;
  font-family: 'Pixelify Sans', monospace; -webkit-font-smoothing: none; color: #d8cfae;
  font-variant-ligatures: none; font-feature-settings: 'liga' 0, 'clig' 0;
  text-shadow: 2px 2px 0 rgba(0,0,0,0.85); }
.loothover.on { display: block; }
.loothover-head { font-size: 11px; letter-spacing: 0.3em; text-indent: 0.3em;
  text-transform: uppercase; color: #7d7460; text-align: center;
  padding-bottom: 8px; margin-bottom: 8px;
  border-bottom: 2px solid rgba(125,116,96,0.3); }
.loothover-row { display: flex; align-items: baseline; gap: 10px; font-size: 14px;
  line-height: 1.5; }
.loothover-count { margin-left: auto; color: var(--brass); font-size: 12px; }
.loothover-empty, .loothover-more { color: #7d7460; font-size: 12px; }

/* ── PX21a: THE TRANSPORT STRIP ─────────────────────────────────
   What you travel with, under what you wear and carry. Two plaques,
   the cart's one doubling as the wagon's door. */
.pack-shell .transport { flex: 0 0 auto; display: grid;
  grid-template-columns: 1fr 1fr; gap: 12px; margin: 12px auto 0;
  width: min(960px, 100%); }
.pack-shell .transport .tplaque { display: flex; align-items: center; gap: 14px;
  min-height: 52px; padding: 8px 14px; text-align: left; cursor: default;
  background: rgba(10,12,17,0.6); border: 2px solid rgba(125,116,96,0.35);
  color: #a89f88; font-family: inherit; text-shadow: 2px 2px 0 rgba(0,0,0,0.85); }
.pack-shell .transport button.tplaque { cursor: pointer; }
.pack-shell .transport button.tplaque:hover, .pack-shell .transport button.tplaque:focus-visible {
  outline: none; border-color: var(--brass); color: #d8cfae; }
.pack-shell .transport .tplaque.on { border-color: var(--brass); color: rgb(243,239,44);
  text-shadow: 2px 2px 0 rgb(93,77,12); }
.pack-shell .transport .tplaque.tempty { border-style: dashed; }
.pack-shell .transport .tgo { margin-left: auto; font-size: 11px; letter-spacing: 0.16em;
  text-transform: uppercase; color: var(--brass); }
.pack-shell .transport .worntile { font-size: 22px; }
.pack-shell .transport .tile { width: 34px; height: 34px; font-size: 18px; }
@media (max-width: 640px) {
  .pack-win { width: 100vw; height: 100dvh; border-left: 0; border-right: 0; }
  /* PX19f: on a phone the main area is the character region alone
     (the detail keeps its SHEET) and the dock grows to half. */
  .pack-shell .pack-main { grid-template-columns: 1fr; }
  .pack-shell .pack-dock { max-height: 50%; }
  /* the stage dissolves but its CHILDREN keep flowing - display:none
     here would hide the fixed detail SHEET inside it; contents lets
     the sheet fix to the viewport while the figure alone hides. */
  /* PX19f/i: the phone shows the character region; the detail is the
     .packdetail sheet, now the tooltip's phone dress. */
  /* the loot window stacks under the pack on a phone */
  .pack-shell { grid-auto-flow: row; gap: 0; }
  .loot-win { width: 100vw; max-height: 40dvh; border-left: 0; border-right: 0; }
}

/* ── PX9: SETTINGS INSIDE THE PAUSE WINDOW ──────────────────────
   The same paneSettings DOM, reflowed for the window: the category
   subrail becomes a wrapping chip strip on top, the rows scroll
   beneath, and the help/reset detail rises as a SHEET inside the
   window - the phone pattern the screen already carries, applied one
   size up. All paint and flow; the machine underneath is untouched. */
.px-setwrap { padding: 0; overflow: hidden; display: flex; }
.px-setwrap .panes { display: flex; flex-direction: column; flex: 1; min-width: 0; position: relative; overflow: hidden;
  background: none; }   /* PX10b: the slate lived on .panes (its base gap-colour trick), not .list */
.px-setwrap .subrail { display: flex; flex-direction: row; flex-wrap: wrap; gap: 2px;
  width: auto; border-right: 0; border-bottom: 2px solid rgba(125,116,96,0.45);
  padding: 4px 6px 6px; overflow: visible; }
.px-setwrap .subbtn { min-height: 44px; padding: 6px 12px; font-size: 14px;
  display: flex; align-items: center; gap: 8px;
  color: #d8cfae; text-shadow: 2px 2px 0 rgba(0,0,0,0.8); }
.px-setwrap .subbtn.on { color: rgb(243,239,44); text-shadow: 2px 2px 0 rgb(93,77,12); }
.px-setwrap .subbtn .count { font-size: 11px; }
.px-setwrap .list { flex: 1; overflow-y: auto; padding: 8px 12px 12px; background: none; }   /* PX10b: the old sheet's slate panel, off */
.px-setwrap .row { min-height: 44px; }
/* The sheet: absolute within the window (px-win is relative), risen
   by the same .open class the phone sheet uses. */
.px-setwrap .detail { position: absolute; left: 0; right: 0; bottom: 0; max-height: 78%;
  overflow-y: auto; z-index: 5; background: rgba(10,12,17,0.96);
  border-top: 2px solid var(--brass);
  transform: translateY(101%); transition: transform 0.18s steps(4); }
.px-setwrap .detail.open { transform: translateY(0); }
.px-setwrap .sheet-close { display: block; width: 100%; min-height: 44px;
  color: #7d7460; letter-spacing: 0.2em; text-transform: uppercase;
  border-bottom: 2px solid rgba(125,116,96,0.4);
  text-shadow: 2px 2px 0 rgba(0,0,0,0.7); }
@media (prefers-reduced-motion: reduce) { .px-setwrap .detail { transition: none; } }

/* ── PX10b: THE ROWS SHED THE OLD CHROME (Mac: "it's the old ui
   backdrop") ── the base .row/.step/.val rules are the OLD sheet's -
   slate hover fills, 1px iron hairlines, brass inset - and PX8's
   repaint was scoped to .shell, which the pause window is not in.
   Same repaint, scoped here; the 44px target pseudo-element and every
   size stay exactly as measured. */
.px-setwrap .row { background: none; border-bottom: 2px solid rgba(125,116,96,0.3); }
.px-setwrap .row:hover { background: rgba(0,0,0,0.25); }
.px-setwrap .row.on { background: rgba(0,0,0,0.25); box-shadow: none;
  outline: 2px solid rgba(192,138,62,0.6); outline-offset: -2px; }
.px-setwrap .row-name { font-size: 15px; text-shadow: 2px 2px 0 rgba(0,0,0,0.8); }
.px-setwrap .val { color: #c5bda2; letter-spacing: 0.08em;
  text-shadow: 2px 2px 0 rgba(0,0,0,0.7); }
.px-setwrap .step { border: 2px solid rgba(125,116,96,0.55); border-radius: 0;
  background: none; color: #d8cfae; text-shadow: 2px 2px 0 rgba(0,0,0,0.8); }
.px-setwrap .step:hover { color: rgb(243,239,44); border-color: var(--brass);
  text-shadow: 2px 2px 0 rgb(93,77,12); }
.px-setwrap .act { border: 2px solid rgba(125,116,96,0.55); border-radius: 0;
  background: none; color: #d8cfae; letter-spacing: 0.14em; text-transform: uppercase;
  text-shadow: 2px 2px 0 rgba(0,0,0,0.8); transition: none; }
.px-setwrap .act:hover, .px-setwrap .act:focus-visible { color: rgb(243,239,44);
  border-color: var(--brass); background: none; text-shadow: 2px 2px 0 rgb(93,77,12); }
.px-setwrap .act.primary { color: rgb(243,239,44); border-color: var(--brass);
  background: none; text-shadow: 2px 2px 0 rgb(93,77,12); }
.px-setwrap .swatch { border: 2px solid rgba(125,116,96,0.55); border-radius: 0; }
.px-setwrap .legend i, .px-setwrap .row i { border-radius: 0; }
.px-setwrap .dcard h3 { font-family: inherit; font-weight: 400; letter-spacing: 0.12em;
  text-transform: uppercase; text-shadow: 2px 2px 0 rgba(0,0,0,0.8); }
.px-setwrap .dcard p { color: #c5bda2; text-shadow: 2px 2px 0 rgba(0,0,0,0.8); }
.px-setwrap .dcard code { font-family: inherit; border: 2px solid rgba(125,116,96,0.4);
  border-radius: 0; background: rgba(0,0,0,0.35); letter-spacing: 0.06em; }

/* ── PX18: THE WORLD MAP WEARS THE PIXELS ── U61's overworld screen
   (the GL world IS the picture; the chrome floats over it) joins the
   family: Pixelify chrome, 2px frames, the gold pair on the hand,
   glass panels at the established scrims, the travel card in the
   pack's plaque language. The GL frame and every travel law
   underneath are untouched. */
#enhanced-travelmap, .ovroot { font-family: 'Pixelify Sans', monospace;
  -webkit-font-smoothing: none; color: #d8cfae; }
.ovroot button { transition: none; border-radius: 0; }
.ovtop { background: rgba(10,12,17,0.45); border-bottom: 2px solid rgba(125,116,96,0.35); }
.ovlabel { font-family: inherit; letter-spacing: 0.18em; text-indent: 0.18em;
  text-transform: uppercase; text-shadow: 2px 2px 0 rgba(0,0,0,0.85); }
.ovsearch input { font-family: inherit; font-size: 16px; letter-spacing: 0.06em;
  color: #d8cfae; background: rgba(0,0,0,0.4); border: 2px solid rgba(125,116,96,0.55);
  border-radius: 0; padding: 8px 12px; text-shadow: 2px 2px 0 rgba(0,0,0,0.8); }
.ovsearch input:focus { outline: none; border-color: var(--brass); color: rgb(243,239,44);
  text-shadow: 2px 2px 0 rgb(93,77,12); }
.ovresult { font-family: inherit; border: 0; border-bottom: 2px solid rgba(125,116,96,0.3);
  background: rgba(10,12,17,0.72); color: #c5bda2; text-shadow: 2px 2px 0 rgba(0,0,0,0.8); }
.ovresult:hover, .ovresult:focus-visible { outline: none; color: rgb(243,239,44);
  background: rgba(0,0,0,0.5); text-shadow: 2px 2px 0 rgb(93,77,12); }
.ovresult-region { color: #7d7460; }
.ovchip { font-family: inherit; font-size: 13px; letter-spacing: 0.14em; text-transform: uppercase;
  color: #a89f88; background: rgba(10,12,17,0.45); border: 2px solid rgba(125,116,96,0.4);
  border-radius: 0; min-height: 44px; padding: 6px 12px;
  text-shadow: 2px 2px 0 rgba(0,0,0,0.8); }
.ovchip:hover, .ovchip:focus-visible { outline: none; color: rgb(243,239,44);
  border-color: var(--brass); text-shadow: 2px 2px 0 rgb(93,77,12); }
.ovchip.on { color: rgb(243,239,44); border-color: var(--brass);
  text-shadow: 2px 2px 0 rgb(93,77,12); }
.ovcard { position: relative; border: 2px solid rgba(216,207,174,0.7);
  outline: 2px solid rgba(125,116,96,0.35); outline-offset: 4px; border-radius: 0;
  background: rgba(10,12,17,0.72); font-family: inherit;
  text-shadow: 2px 2px 0 rgba(0,0,0,0.85); }
.ovcard h3, .ovcard h2 { font-family: inherit; font-weight: 400; letter-spacing: 0.14em;
  text-indent: 0.14em; text-transform: uppercase; text-align: center;
  border-bottom: 2px solid rgba(125,116,96,0.5); padding-bottom: 8px;
  text-shadow: 2px 2px 0 rgba(0,0,0,0.85); }
.ovmeta { color: #7d7460; font-size: 13px; letter-spacing: 0.2em; text-transform: uppercase;
  text-align: center; text-shadow: 2px 2px 0 rgba(0,0,0,0.7); }
.ovprompt, .ovnotice { color: #c5bda2; text-align: center; font-size: 15px;
  text-shadow: 2px 2px 0 rgba(0,0,0,0.7); }
.ovpair { display: flex; justify-content: space-between; gap: 14px;
  border-bottom: 2px solid rgba(125,116,96,0.3); min-height: 32px; align-items: baseline; }
.ovpair-k { color: #7d7460; font-size: 13px; letter-spacing: 0.18em; text-transform: uppercase;
  text-shadow: 2px 2px 0 rgba(0,0,0,0.7); }
.ovacts { display: flex; justify-content: center; gap: 10px; }
.ovroot .act { border: 2px solid var(--brass); border-radius: 0; background: none;
  color: rgb(243,239,44); font-family: inherit; letter-spacing: 0.14em; text-transform: uppercase;
  min-height: 44px; padding: 8px 16px; text-shadow: 2px 2px 0 rgb(93,77,12); }
.ovroot .act.ovghost { border-color: rgba(125,116,96,0.55); color: #d8cfae;
  text-shadow: 2px 2px 0 rgba(0,0,0,0.85); }
.ovroot .act:hover, .ovroot .act:focus-visible { outline: none; color: rgb(243,239,44);
  border-color: var(--brass); background: rgba(0,0,0,0.35); text-shadow: 2px 2px 0 rgb(93,77,12); }
.ovskip, .ovhint { color: #7d7460; font-size: 12px; letter-spacing: 0.18em; text-transform: uppercase;
  text-shadow: 2px 2px 0 rgba(0,0,0,0.7); }
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
  link.href = ENHANCED_FONTS_URL;
  doc.head.append(link);
}
