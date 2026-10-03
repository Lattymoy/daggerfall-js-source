// @ts-check
// ARENA2 (2026-10-02): THE HERALD'S CHOICE at the arena's gate - "Watch the exhibition", "Fight on the ladder", "Go
// down to the fighters' hall", "Leave" - what he says before it (the bout on the sand or the next one, the player's next
// ladder bout, the title the arena calls them by) and which choices stand. The full Arena window is ARENA3's; this is
// a keyed choice (ui/talkWindow.js ChoiceWindow), the enhanced dialog on the Plus skin (ui/enhancedDialog.js
// drawEnhancedChoice) and the classic panel on the other. A choice that cannot be taken is not offered, and HIS LINES
// SAY WHY (the house's refusal rule: a sentence, never a button that silently vanishes).
//
// Pure: the clock, the city's bout, the ladder and the player's state in; `{ lines, options }` out, each option
// `{ code, label, act }` (`act` 'watch' | 'fight' | 'hall' | 'leave' - the host's to do). Not a DFU member. Ledger A.

import { ARENA_TEXT } from './arenaText.js';
import { exhibitionFor, nextExhibitionHour, nextLadderBout, ladderTitle } from './arenaLadder.js';
import { rollLeague, leagueStandings, joinRefusal, laurelWorn, otherBanner } from './arenaLeague.js';   // ARENA3: the banners

/** A fighter must have this share of their health to be let onto the sand. */
export const FIGHT_HEALTH_MIN = 0.5;

/**
 * ARENA3: `window` - the host opens the Arena window ("A - The Arena window"); `league` the banners' record
 * (systems/arenaLeague.js) - he names the banner you fight under, and the laurel when you wear it.
 * ARENA5: `replays` how many of the save's ladder bouts the records keep (systems/arenaReplay.js) - the last one is
 * offered to watch again ("R - Watch your last bout again").
 * @param {{ gameMinutes: number, cityBout?: { a: string, b: string } | null, ladder?: any, healthShare?: number, window?: boolean, league?: any, replays?: number }} o
 */
export function heraldChoice({ gameMinutes, cityBout = null, ladder = null, healthShare = 1, window = true, league = null, replays = 0 }) {
  const H = ARENA_TEXT.herald;
  const lines = [];
  const hour = Math.floor(Math.max(0, gameMinutes) / 60);
  lines.push(H.greet[hour % H.greet.length]);
  lines.push('');
  const ex = exhibitionFor(gameMinutes);
  const canWatch = !!cityBout || !!ex?.open;
  if (cityBout) lines.push(H.onNow(cityBout.a, cityBout.b));
  else if (!canWatch) { lines.push(H.noWatch); lines.push(H.nextAt(nextExhibitionHour(gameMinutes))); }
  const next = nextLadderBout(ladder);
  const fit = healthShare >= FIGHT_HEALTH_MIN;
  if (!next) lines.push(H.ladderDone);
  else {
    lines.push(H.ladderNext(next.tierName, next.label));
    if (!fit) lines.push(H.noFight);
  }
  const title = ladderTitle(ladder);
  if (title) lines.push(H.title(title));
  const team = league ? rollLeague(league, gameMinutes).team : null;
  if (team) lines.push(laurelWorn(league, gameMinutes) ? ARENA_TEXT.teams.laurelYou : ARENA_TEXT.teams.under(ARENA_TEXT.teams.the[team]));   // ARENA3
  if (replays > 0) lines.push(ARENA_TEXT.replay.heraldLine);   // ARENA5
  const options = [];
  if (canWatch) options.push({ code: 'KeyW', label: H.watch, act: 'watch' });
  if (next && fit) options.push({ code: 'KeyF', label: H.fight, act: 'fight' });
  if (replays > 0) options.push({ code: 'KeyR', label: ARENA_TEXT.replay.herald, act: 'replay' });   // ARENA5: your ladder replay, the newest
  if (window) options.push({ code: 'KeyA', label: H.window, act: 'window' });   // ARENA3: the Arena window's first door
  options.push({ code: 'KeyH', label: H.hall, act: 'hall' });
  options.push({ code: 'KeyL', label: H.leave, act: 'leave' });
  options.push({ code: 'Escape', label: null, act: 'leave' });   // the key alone: Escape leaves him
  return { lines, options, exhibition: ex, next };
}

// ── THE RECRUITERS (ARENA3; systems/arenaLeague.js) ─────────────────────────────────────────────────────────────
/**
 * A BANNER'S RECRUITER at the gate: his pitch, the season's standing, the player's place, and what may be done - join
 * (when the banner will take them), quit (when they wear it - asked again before it is done, `quitAsk`), the Arena
 * window, leave. A refusal is a line, never a button that vanishes unsaid. `banner` 'red' | 'blue'. Pure.
 * `window` whether the host opens the Arena window.
 * @param {{ banner: 'red'|'blue', league: any, gameMinutes: number, window?: boolean }} o
 */
export function recruiterChoice({ banner, league, gameMinutes, window = true }) {
  const R = ARENA_TEXT.recruiter, T = ARENA_TEXT.teams;
  const me = T.the[banner];
  const L = rollLeague(league, gameMinutes);
  const st = leagueStandings(L, gameMinutes);
  const lines = [...R.greet[banner], ''];
  lines.push(`${cap(T.season(st.season))}, ${T.seasonDay(st.day)}.`);
  lines.push(T.standing(st.red, st.blue));
  const why = joinRefusal(L, banner, gameMinutes);
  if (why === 'already') { lines.push(R.yours(me)); lines.push(T.given(st.given)); if (laurelWorn(L, gameMinutes)) lines.push(T.laurelYou); }
  else if (why === 'other') lines.push(R.theirs(T.the[otherBanner(banner)]));
  else if (why === 'season') lines.push(R.wait(T.the[otherBanner(banner)]));
  else { lines.push(R.pitch); lines.push(R.rule); }
  const options = [];
  if (!why) options.push({ code: 'KeyJ', label: R.join(me), act: 'join' });
  if (why === 'already') options.push({ code: 'KeyQ', label: R.quit(me), act: 'quit' });
  if (window) options.push({ code: 'KeyA', label: R.window, act: 'window' });
  options.push({ code: 'KeyL', label: R.leave, act: 'leave' });
  options.push({ code: 'Escape', label: null, act: 'leave' });
  return { lines, options };
}
/** The question before a banner is quit: yes strikes the name, no keeps it. */
export function quitAsk(banner) {
  const R = ARENA_TEXT.recruiter;
  return {
    lines: [R.askQuit(ARENA_TEXT.teams.the[banner])],
    options: [{ code: 'KeyY', label: R.yes, act: 'quit' }, { code: 'KeyN', label: R.no, act: 'stay' }, { code: 'Escape', label: null, act: 'stay' }],
  };
}
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
