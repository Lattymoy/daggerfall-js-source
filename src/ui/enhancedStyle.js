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

.body { padding: 24px 30px 40px; }
.body.flush { padding: 0; }

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
