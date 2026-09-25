// @ts-check
// ═══════════════════════════════════════════════════════════════════
// PROFILE1 — THE PROFILE MARK IS A PORTRAIT, NOT A BUTTON.
//
// Mac (2026-09-25): "I kinda wanna make the menu profile icon more
// relevant, more like a profile icon less like a button" - and, asked
// what the picture should be, the LAST CHARACTER'S FACE.
//
// ACC1f drew the mark as a bordered box holding a gem and a word, which
// read as one more menu button in the corner. A profile icon is a
// picture of WHO YOU ARE: here the face of the character you last
// played - the race-and-gender FACE CIF record the save tiles draw
// (ui/facePortrait.js, TILE1's one home, so the corner and the tiles
// cannot disagree about a face) - in a round rimmed frame, with the
// account's name and that character's line as a caption beside it.
//
// THE GEM STAYS, as a jewel on the rim: FILLED with a session, HOLLOW
// without - ACC1f's "am I signed in, at a glance" survives the redraw.
//
// NEVER TRAPS. The face is a Promise and the portrait is on screen
// before it: a hooded silhouette stands in until the face lands, and
// for good when there is no character yet, no game data, or a face
// that would not draw (loadFace answers null for all three).
// ═══════════════════════════════════════════════════════════════════

/**
 * The character the portrait shows: the most recent save whose
 * character is FINISHED and carries its identity. A save written in
 * the middle of chargen has no face chosen yet, and one from before
 * S3c/U9 stored no race - loadFace would draw a Breton default for it,
 * which is a stranger's face, not yours. `saves` are most recent first.
 * @param {Array<{race?: string|null, chargenDone?: boolean}>} saves
 */
export function portraitSave(saves) {
  return (saves ?? []).find((s) => s && s.chargenDone !== false && typeof s.race === 'string' && s.race) ?? null;
}

/**
 * PROFILE2: the character the portrait shows ON THE PAUSE SCREEN - the one being played, not the newest save. Paused,
 * the newest save may be another character's (a second character saved from the door, a load of an older one), and
 * the player in the game is the one whose skin the card changes. The live entity carries the same identity fields a
 * save does (race, gender, faceIndex, name, level - net/remotePlayers.js composeLook reads the first three off it);
 * with no race it is no character yet, and the silhouette stands.
 * @param {{race?: string|null, gender?: string, faceIndex?: number, name?: string, level?: number}|null|undefined} entity
 */
export function liveCharacter(entity) {
  if (!entity || typeof entity.race !== 'string' || !entity.race) return null;
  return { name: entity.name, level: entity.level, race: entity.race, gender: entity.gender, faceIndex: entity.faceIndex };
}

/** The caption's second line: whose face this is. */
export function characterLine(save) {
  if (!save) return 'No character yet';
  return [save.name || 'Unnamed', Number.isFinite(save.level) ? `level ${save.level}` : null].filter(Boolean).join(' \u00b7 ');
}

/**
 * The mark. `doc` the document (the pins hand a fake).
 * @param {Document} doc
 * @param {{session?: {name?: string}|null, save?: object|null,
 *          face?: HTMLCanvasElement|Promise<HTMLCanvasElement|null>|null, onOpen?: () => void}} [opts]
 */
export function profileBadge(doc, { session = null, save = null, face = null, onOpen = () => {} } = {}) {
  const el = (t, cls, txt) => {
    const n = doc.createElement(t);
    if (cls) n.className = cls;
    if (txt != null) n.textContent = txt;
    return n;
  };
  const b = el('button', 'px-profile');
  b.type = 'button';
  b.setAttribute('aria-label', session
    ? `Profile: ${session.name ?? 'signed in'}${save ? `, playing ${characterLine(save)}` : ''}`
    : 'Sign in or create an account');

  // ── THE PORTRAIT ────────────────────────────────────────────────
  const frame = el('span', 'px-portrait');
  frame.setAttribute('aria-hidden', 'true');
  const stand = el('span', 'px-silhouette');
  frame.append(stand);
  const show = (art) => {
    if (!art) return;
    stand.remove();
    frame.append(art);
    frame.className = 'px-portrait has-face';
  };
  if (face && typeof (/** @type {any} */ (face).then) === 'function') {
    /** @type {Promise<HTMLCanvasElement|null>} */ (face).then(show).catch(() => {});
  } else show(face);
  frame.append(el('span', `px-profilegem${session ? ' on' : ''}`, session ? '\u25c6' : '\u25c7'));
  b.append(frame);

  // ── THE CAPTION ─────────────────────────────────────────────────
  const words = el('span', 'px-profiletext');
  words.append(el('span', 'px-profilename', session?.name ?? 'Sign in'));
  words.append(el('span', 'px-profilesub', characterLine(save)));
  b.append(words);

  b.onclick = () => onOpen();
  return b;
}
