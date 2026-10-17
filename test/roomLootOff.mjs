// PARTY-LOOT (bible/06-Systems/Online-Arc.md PARTY-LOOT): THE DUNGEON'S ROOM-LOOT SEAMS WITH NO ROOM. A harness that
// mounts the dungeon host's foe doors (buildFoeAt, spawnCorpse, setFoeDead, stand, the kill, the stream's death, the
// restore) out of src/scenes/dungeonContext.js reaches the PARTY-LOOT block's names from them; spread this into its
// state and they answer as an offline dungeon's do - no room, no room container, nothing born or forgotten, the build's
// list unrecorded - so the harness's own law is what it pins. test/systems/partyloot.test.js mounts the block itself.
// Not a .test.js on purpose - the manifest counts suites, and this is a fixture.
export const ROOM_LOOT_OFF = Object.freeze({
  roomLootOn: () => false,
  roomCanonOfFoe: () => null,
  isRoomBaseContainer: () => false,
  roomUnborn: () => false,
  roomBodyBorn: () => {},
  forgetRoomContainer: () => {},
  lootBuiltOf: () => null,
  isRoomWord: () => false,
  composeRoomContainer: () => false,
  roomTakeSeat: () => {},
  roomClaimTick: () => {},
  roomSettle: () => false,
  _roomMintHold: 0,
});
