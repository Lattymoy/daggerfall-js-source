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

.row {
  display: flex; align-items: center; gap: 14px; width: 100%;
  padding: 11px 18px; min-height: 52px; border-bottom: 1px solid #20262e;
}
.row:hover { background: #12161b; }
.row.on { background: #12161b; box-shadow: inset 2px 0 0 var(--brass); }
.row-main { flex: 1; min-width: 0; }
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
}
.step:hover { color: var(--bone); border-color: var(--dim); }
/* AUDIT 24's finding, kept: the drawn size and the TARGET size are
   two rects. The pill is 34px because 44px of brass reads as a
   button bar; the hit box around it is 44 because a thumb is. */
.step::after { content: ''; position: absolute; }
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

/** The web fonts. Separate from the stylesheet because a font is a
 *  NETWORK request and the sheet is not: if Google Fonts is blocked or
 *  offline the screens still lay out, in the stack's fallbacks
 *  (Georgia and the system sans), which is the same never-traps law
 *  the title screen follows when its art is missing. */
export function injectEnhancedFonts(doc = document) {
  if (doc.getElementById('dagger-enhanced-fonts')) return;
  const link = doc.createElement('link');
  link.id = 'dagger-enhanced-fonts';
  link.rel = 'stylesheet';
  link.href = 'https://fonts.googleapis.com/css2?family=Cormorant:wght@300;400;600&family=Barlow+Semi+Condensed:wght@400;500;600&display=swap';
  doc.head.append(link);
}
