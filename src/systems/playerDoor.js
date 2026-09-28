// @ts-check
// SET2 (2026-09-26, Sigil Sets - bible/11-Multiplayer/Sigil-Sets.md): THE PLAYER'S DOOR TO THE LIVE SCENE.
//
// A set's power sometimes reaches past the one blow the formula resolves: Malacath's Spite strikes the foe that struck
// me, Ruhn's Cleave the next foe beside the one I struck, the Warden's Nova every foe around me, and Nocturnal's
// Eventide wraps ME in a spell. The foes, the player's feet and the doors that land a hurt or a spell belong to the
// host that is running now (scenes/hostMagic.js - one engine per host, each with its own foes and sinks), so that
// engine PUBLISHES itself here every frame it updates, and a power reads whichever host published last - the one the
// player is standing in. A leaf: it imports nothing.
//
// The door: {
//   foes()          the live foes MY harm may reach ([{ entity, ai, dead, puppet? }]; the town's defenders left out)
//   feet()          my feet in that host's frame ([x, y, z])
//   hurtFoe(f, n)   n damage from ME to foe record f, through its own pool's door (a kill is mine, a puppet's goes to
//                   its owner as my hit - the sinks every spell of mine already lands through)
//   castOnPlayer(b) a spell bundle on me, no saving throw and no chance roll (a potion's way)
//   player()        my entity (a kill's word names the foe, not me)
//   clear(a, b)     AUDIT SET M4 (optional): whether nothing solid stands between feet a and feet b, chest high
// }

/** @type {null | { foes: () => any[], feet: () => number[]|null, hurtFoe: (f: any, n: number) => void, castOnPlayer: (b: any) => void, player?: () => any, clear?: (a: number[], b: number[]) => boolean }} */
let _door = null;
/** The running host's word: this is the scene now. `null` takes it down. */
export function setPlayerDoor(door) { _door = door && typeof door === 'object' ? door : null; }
/** The scene the player stands in, or null before a host has run a frame. */
export const playerDoor = () => _door;
