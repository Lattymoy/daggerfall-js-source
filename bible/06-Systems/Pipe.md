# The Pipe and Nirnroot

The **Pipe** is the clay pipe Daggerfall stands among its household clutter (`TEXTURE.211` record 24), made into a
thing the player carries. **Nirnroot** is the herb it is packed with. Both are the port's own items (templates 585 and
586, miscellany); DFU has neither. Code: `src/systems/pipe/`.

## How it works

**Smoking.** The pipe's Use takes one nirnroot from the pack, closes the pack and says so on the HUD. The world then
goes hazy for a whole number of seconds from 30 to 60: the game's canvas is blurred and tinted with a CSS filter, and
a pale green mist drifts over it. The haze fades in over 2 seconds and is gone by the end of its time. Smoking again
while hazy restarts the clock from now; the haze never gets thicker. With no nirnroot in the pack the pipe says so and
nothing is spent. The pipe itself is never used up.

**Where they are sold.** Every General Store's and Pawn Shop's counter shelf carries one pipe, and every Alchemist's and
General Store's counter shelf carries a stack of five nirnroot. They are added after DFU's own draws and from no roll,
so the rest of the shelf is unchanged.

**Pictures.** The pipe wears its decor picture. Nirnroot wears Daggerfall's Root Bulb.

**The item law** reads both rows headless from the leaf `pipeRow.js`, as it reads the Lockpick's.
