// @ts-check
// MENTOR2 (2026-10-27; bible/06-Systems/Mentor-Mode.md) - MENTOR MODE IN THE STREAMING WORLD. scenes/world.js builds it
// once and calls `frame` from its party frame. Each frame it reads the party members whose bodies are drawn in my room
// (outdoors within MENTOR_NEAR_METRES), steadies them (mentorMode.js createMentorPresence), lays the mentor's and the
// pupil's profiles on my entity, hands the Firmament its scale and says a start or an end in the chat - once each.
//
// scenes/exterior.js (the fixed city), scenes/worldModes.js (interiors) and scenes/dungeonContext.js (dungeons) wire
// nothing: the party frame is the streaming host's alone, and interiors and dungeons run inside it.

import {
  createMentorPresence,
  refreshMentor,
  refreshPupil,
  mentorPowerScale,
  MENTOR_NEAR_METRES,
} from '../systems/mentorMode.js';
import { mentorStatusText, mentorEndedText, pupilStatusText } from '../systems/mentorText.js';
import { setFirmamentMentorScale } from '../systems/firmamentLive.js';

/** @param {{ player: () => any, social: () => any, near: () => { acct: string, feet?: number[] }[], outdoors: () => boolean,
 *   feet: () => number[] | null, fighting: () => boolean, chat: () => any }} deps */
export function createMentorHost(deps) {
  const presence = createMentorPresence();
  /** A line in the active chat tab - none before the chat stands (the sheet says it too). */
  const say = (text) => {
    const log = deps.chat?.();
    try {
      if (text && log) log.push(log.active, { text, system: true });
    } catch {
      /* the chat is the host's */
    }
  };

  /** A party member is asked whether they fight, only while a change waits (presence.levels). */
  const fighting = () => {
    try {
      return !!deps.fighting();
    } catch {
      return false;
    }
  };
  /** The party members beside me this frame, with their real levels (their pose's `cl`). */
  function nearPartners(mates) {
    if (!mates.length) return [];
    const mine = deps.outdoors() ? deps.feet() : null;
    const out = [];
    for (const n of deps.near() ?? []) {
      const m = mates.find((x) => x.acct === n.acct);
      if (!m || m.online === false || !Number.isInteger(m.p?.cl)) continue;
      if (mine && n.feet && Math.hypot(n.feet[0] - mine[0], n.feet[2] - mine[2]) > MENTOR_NEAR_METRES) continue;
      out.push({ acct: n.acct, level: m.p.cl });
    }
    return out;
  }

  /** @param {number} nowMs */
  function frame(nowMs) {
    const me = deps.player();
    if (!me) return;
    const social = deps.social();
    if (!social?.party) presence.reset(); // leaving the party is a deliberate act: I am myself again the same frame
    const mates = social?.party ? social.others() : [];
    const member = (acct) => mates.some((m) => m.acct === acct);
    const levels = presence.levels(nearPartners(mates), nowMs, { fighting, member });
    const word = refreshMentor(me, levels);
    const pupil = refreshPupil(me, levels);
    setFirmamentMentorScale(mentorPowerScale(me));
    if (word === 'on') say(mentorStatusText(me));
    else if (word === 'off') say(mentorEndedText());
    if (pupil === 'on') say(pupilStatusText(me));
  }

  return { frame, reset: () => presence.reset() };
}
