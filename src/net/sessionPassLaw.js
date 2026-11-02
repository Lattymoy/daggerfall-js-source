// @ts-check
// SESSION-SIGN (2026-10-18; bible/11-Multiplayer/Scale-Arc.md SESSION-SIGN; AUDIT PLAN-1000 H11): THE SESSION'S PASS, ITS
// ONE NAME ON THE WIRE - the header the account service hands a pass back in and the page sends it with, both ways
// (server-account/src/sessionPass.js mints and believes it; net/accountClient.js keeps and sends it).

/** The header a pass rides in, both ways. */
export const SESSION_PASS_HEADER = 'x-session-pass';
