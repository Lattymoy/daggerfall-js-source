// YARD-CELL (bible/11-Multiplayer/Yard-Cells.md): A WHOLE TOWN'S YARDS, READ THROUGH THE CELL ROUTE - for the tests that
// assert on a town's yards as the old whole-town answer gave them. Every cell of a town is asked with no version held,
// and the cells the answer's budget left (`more`) are asked again, so the answer is the town's every yard in building-key
// order: `{ status, body: { mapId, yards: [{ buildingKey, pieces }] } }`, or the route's own answer where it refused.

/** Every cell a town can have: its 8 x 8 blocks, (x << 8) + y, and BUILDING_KEY_0's (65536) - in key order. */
export const TOWN_CELLS = Object.freeze([
  ...Array.from({ length: 64 }, (_, i) => ((i >> 3) << 8) + (i & 7)),
  65536,
]);

/** A town's yards through `call(path, body, secret)` - a stood service's (test/accountDb.mjs). */
export async function townYards(call, mapId, secret = undefined) {
  const yards = [];
  let cells = TOWN_CELLS.map((cell) => [cell, 0]);
  for (;;) {
    const answer = await call('/v1/homes/yards/cells', { mapId, cells }, secret);
    if (answer.status !== 200) return answer;
    for (const cell of answer.body.cells) yards.push(...cell.yards);
    if (!answer.body.more?.length) break;
    cells = answer.body.more.map((cell) => [cell, 0]);
  }
  yards.sort((a, b) => a.buildingKey - b.buildingKey);
  return { status: 200, body: { mapId, yards } };
}
