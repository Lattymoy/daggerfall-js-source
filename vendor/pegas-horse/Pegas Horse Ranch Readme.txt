-----------------------------------------------------------------------------------------------------
Pegas Horse Ranch ( requires either Tribunal or Bloodmoon ) 
created by MADMAX and Team ( Sep 2004 )
-----------------------------------------------------------------------------------------------------
-----------------------------------------------------------------------------------------------------
INDEX
-----------------------------------------------------------------------------------------------------
  1. CREDITS
  2. INTRODUCTION
  3. GAME SUMMARY
  4. INSTALLATION
  5. THE RIDING SCRIPT
  6. HORSE ATTRIBUTES
  7. HORSE BREEDS
  8. RANCH OPERATIONS
  9. BONUS FEATURE
10. VERSION UPDATES ( Read this )
11. FUTURE ADDON
12. DISCLAIMER

------------------------------------------------------------------------------------------------------
1. CREDITS
------------------------------------------------------------------------------------------------------
I have to say that this mod will not exist without the help of a
team of many talented people who has put in a lot of time and
effort to make it happen. I salute all of them and each one
deserves all the credits that they can get.

First of all, thanks to Cait for giving us such a wonderful horse
model. And, Kagrenac for letting me use the horse models that
were specially created for him by Cait. They have inspired me
to come out with this idea and concept for the mod.

Romualdo and Angel who without them this mod has never
started. They did all the wonderful landscaping and foundation
work which I would never have the time to do myself. Their
contribution has greatly helped to make this mod a reality. So,
a big thank you to them.

DoomedMarauder who has helped tremendously on ideas for
breeding, creating all the nice names and manificent write up
on horse bios and characteristics. She is also instrumental in
roping together a team for this project. You can say that I can't
live without her.

AcidBasick on all his beautiful models and textures. His
commitment and work rate is astounding. I have never come
across any other person who can model high quality stuff so
fast. Modelling is like drinking coffee for him. ;)

Highpressure on dialogues and web pages. His attitude on
helping people is second to none. He has been a buddy to me
for a long, long time.

Tsuruga for the very nice horse banners. This guy is a real
artist. Trust me!! ;)

The Beta Testers; my sincere gratitude for their time and help
on getting the mod out as bug free as possible.
a. DoomedMarauder
b. AcidBasick
c. Highpressure
d. Cethegus
e. Brash
f. Pseron Wyrd
g. MagicNakor
h. Telephoros
i. Sunsi

And, not forgeting Matt (Simpleton) Edlefsen for his simplistic
trigonometry code.

Ronin49 and SirLuthor for their contribution on the horse
names and writeup.

-----------------------------------------------------------------------------------------------------
2. INTRODUCTION
-----------------------------------------------------------------------------------------------------
The title says it all. It's a horse ranch and it allows you to do
what a ranch supposed to do. With the ranch, you now have the
ability to buy, sell, train and even breed horses. Not to mention
the latest riding script that comes with it.

Also, there is no conflict at all with IWWH. So, you can play
both mods together.

----------------------------------------------------------------------------------------------------
3. GAME SUMMARY
----------------------------------------------------------------------------------------------------
The horse ranch is located in Grazeland slightly south of Vos
and NOT Tel Vos. To get there, you need to travel by ship to
Vos after which just go south for a short distance and you
should be able to locate the place. There are NPCs in the game
which you can talk to discover how things operate in the ranch.
There is also a horse riding manual in the game which you
can refer to.

----------------------------------------------------------------------------------------------------
4. INSTALLATION
----------------------------------------------------------------------------------------------------
******************VERY IMPORTANT*******************************
This mod requires either TRIBUNAL or BLOODMOON installed!!!
*********************************************************************

All the files are zipped in a RAR format with all the relative paths
attached. When you open up the zip file, you should see 170
files including this readme file.  ( approx. 4.6Mb )
- Textures ( 48 files )
- Sound ( 5 files )
- Music ( 1 file )
- Meshes ( 88 files )
- Icons ( 5 files )
- BookArt ( 20 files )
- Esm ( 1 file )
- Esp ( 1 file )
- Readme ( 1 file )

To install the plugin, I suggest that you unzip the files onto the
desktop first. Then copy the folders to your main Morrowind
directory.

****VERY IMPORTANT****
DO NOT CHECK BOTH ESM AND ESP. SELECT EITHER ONE!!
**********************

Email your feedback and bug report to:
maxyuecy@yahoo.com

My site ( MadMax's World of Scripting Magic )
http://www.highpressure-morrowind.com/Madmax_Morrowind.html

The link to AlienSlof wonderful horse retexture is available
on my site.

------------------------------------------------------------------------------------------------------
5. THE RIDING SCRIPT
------------------------------------------------------------------------------------------------------
If you have not tried this script before, it is basically a 
breakthrough in terms of concept on animal riding. Firstly, it
uses a creature and not a static/activator to operate. This
eliminates the problem with cell change and potential CTDs.
But, the biggest plus point is the ability to detect collision.
Another attractive thing about this script is the portability which
means you can use this script on any creatures with very
minor adjustments needed.

Specifically for this mod, a few extra features have been added
to the horse.
a. Ability to detect slopes.
b. Companion share.
c. Jump.
d. Attributes which has impact on gameplay.

Note : You can now save your game while riding.

A quick view on how to ride a horse in this mod.
ACTIVATE (not riding) - ride horse
SNEAK+ACTIVATE (not riding) - open dialog menu
ACTIVATE (riding) - dismount horse
RUN (riding) - toggle horse run/stop
SNEAK (riding) - toggle TROT/GALLOP
Hold_SNEAK (GALLOP) - horse will jump
Hold_SNEAK (TROT) - horse will perform special move
JUMP - if the player falls below the horse.

( Available only on v2.3 and above )
SNEAK+ACTIVATE (riding+1stperson) - toggle free view. The
free view will turn off immediately when you change to 3rd
person perspective.

------------------------------------------------------------------------------------------------------
6. HORSE ATTRIBUTES
------------------------------------------------------------------------------------------------------
There are a total of 4 main attributes and how they will affect
the horse
a. Strength - how much weight the horse can carry.
b. Endurance - how far the horse can run before it gets tired.
c. Intelligence - how susceptible the horse to training.
d. Speed - how fast the horse can run.

The health of the horse is actually generated based on the
strength and endurance attributes. They can be regenerated
by eating food sold by the ranch workers.

Horse food available. :
a. Carrot - 20 points regeneration.
b. Hay - 10 points regeneration.
c. Grass - 5 points regeneration.

When you first purchase a horse from the ranch, they all will
have mediocre attributes. Here, you can improve those stats
through training. You can check the attributes from the horse
dialog menu.

------------------------------------------------------------------------------------------------------
7. HORSE BREEDS
------------------------------------------------------------------------------------------------------
There are 3 categories of breeds.
a. Common breeds ( 10 types )
b. Cross breeds ( 6 types )
c. Ultimate breeds ( 4 types )

Obviously, the cross breeds have higher maximum stats as
compared to the common and ultimate will have the best stats.
Below is a sample of maximum stats for common breeds
a. Strength - 100
b. Endurance - 80
c. Intelligence - 100
d. Speed - 30

To get these horses, you need to breed them. Getting the right
combination is important. Some combinations are known but
mostly you have to experiment with it.

------------------------------------------------------------------------------------------------------
8. RANCH OPERATIONS
------------------------------------------------------------------------------------------------------
As mentioned earlier, the ranch allows you to buy / sell / train /
breed horses. I'll explain a little bit about each functions.

Buying Horses 
-------------------------
In the middle of the ranch, there is a cattle-pen which will
randomly generate some common horse breeds every new
day. This is where you initiate your purchase of a horse. You
can also view the statistics of the horse. The price of the horse
is based on the attributes. If you like it, just select it and then
talk to Dirdayvin inside the office. Talkamor will give you an
overview of the mod when u first enter the ranch office. Talk to
him to learn more. There is no limit to how many horses that
you can buy or keep. But, note that there are only 5 stables
available. For FPS control, I do suggest that you do not keep
more than 10 at one time.

Selling Horses
------------------------
The concept is slightly different fm buying. First, select the
horse that you want to sell. Make sure you RIDE the horse to
the selling pen (it's located just outside the office). After you
dismounted, access the horse dialog menu and select "Sell
Horse". This will activate that horse to be sold. Go and talk to
Dirdayvin again to either complete or cancel the transaction.
BTW, the selling price is calculated fm the horse attributes
plus the disposition of Dirdayvin.

Training Horses
--------------------------
Obviously, you need a trainer. There are 10 trainers scattered
around. You need to locate them. Hints are given by Talkamor.
Now, the interesting concept here is that there are 3 groups of
trainers, POOR, MEDIOCRE and GOOD. And, to make it even
more interesting, I have randomized all of them. So, even
myself cannot tell u which one is a good trainer. You can only
find out the truth after you used them a couple of times. You do
however have the option to sack the trainer and then hire
another one. The 3 groups of trainers will have different effect
on the outcome of the training. For eg, a poor trainer can actually
deteriorate statistics!!! There is also a grandmaster which will
only appear after a certain period of time. The entire training
process will take one full day.

Breeding Horses
----------------------------
There are 3 type of breeds; common, cross and ultimate. Cross
breeds can be attained by breeding common breeds. Wt the
right combination, you will have a 50% chance of getting it right.
The same goes for the ultimate breeds. But, these requires
combinations of cross breeds. The breeding process will take
place when you put 2 horses of opposite sex in the breeding
pen next to Liokys shack. Again, you need to activate the horse
and select "Breed Horse" for each of them. Then, go and talk to
Liokys. The combination of the cross breeds will be made
available. Hints only will be given for ultimate horses combination.
The entire breeding process will take one full day. And, the new
foal will be created in the pen next to Liokys shack. You cannot
ride the foal yet. It will take approx. 3days for it to grow up before
you can ride it. However, if it is not something that you want, you
can always sell it. Also, note that foal should inherit an average
statistics fm its parents.


***************************HINTS**********************************
NOTE : In order for the horse to be recognized in the pen, make
sure you RIDE them to the pen. Using the follow mode will not
enable the pen to detect whether the horse is in it.

If you ever get stuck in a pen after dismounting the horse, the
best way to get unstuck is to mount the horse again. Adjust
yourself and then dismount.

------------------------------------------------------------------------------------------------------
9. BONUS FEATURE
------------------------------------------------------------------------------------------------------
The NPC companion horse riding feature was not intended for
this version but somehow I have managed to squeeze it in for
this release. How does it work?

The scripts written for this allows you to bring along one of your
companion together to ride with you. Firstly, the definition of
companion means any NPCs that has a companion share option
activated. You will see a new topic "Companion Riding" in
their dialogue. The scripts allows you to choose ANY companion
that you want to bring along. However, only one can be selected
at one time. To change to another companion, simply cancel
the existing one and then select the next one.

After selecting the NPC, you can select any horses that you had
purchased or breed. That can include a horse which you are
planning to ride yourself. YES, your companion can ride with
you on the same horse or you can select another horse for your
companion. Use the same topic "Companion Riding" in the
horse dialogue to select or cancel.

Things to note :
I do not have the chance to extensively test this out but should
there be any bugs, please report back to me.

a. Don't complain about alignment and positioning, there's not
a whole lot of improvement that can be done primarily because
I cannot move the NPC any further front without disrupting the
movement of the horse.

b. Apparently, when you re-load a game after you had activated
the companion ride, the script does not attach to the reference
NPC and horse anymore. This cause both the NPC and horse
not performing accordingly. There is nothing much that I can do
about this. The script however can detect a game re-load. Upon
detection, it will try to reset the companion riding. However, if
the NPC is currently riding a horse, you will see that the NPC
will still have the saddle on. To reset this, just talk to the NPC
and activate on the topic "Companion Riding". Everything
should reset to it's original state.

c. During combat, you will have to dismount your horse before
your NPC will help you in battle. However, your companion
horse will help to attack your enemy.

------------------------------------------------------------------------------------------------------
10. VERSION UPDATES
------------------------------------------------------------------------------------------------------
v2.4 ( ESM / ESP )
- added free veiwing for Zeshtopali.
- horses now have animation after dismounted
- added a esp version for those who does not want it in esm.
- It has been know that sometimes the foal does not appear
after breeding. This is because there are some other mods which
conflicts with this mod. It has sort of erases the foals in the
mod. In this case, you may want to try the esp version.

v2.3 ( ESM )
- fix a bug which cause CTD when an Argonian race try to mount
the horse.
- added the option to toggle free viewing while in 1st person
perspective. Check above on how to control the horse.
- The plugin is now an ESM. Do not select both the ESP v2.2 and
the ESM together.

v2.2
- fix CTD bug while trying to mount horse when player is an
argonian.
- added compatibility for Vampire Embrace NEXT release. This
means the vampires can do companion ride with you.
- you can now savegame while your companion is riding with
you.

v2.1
Bug fixes
- breeder "yes" "no" dialogue repeat loop.
- foal missing after successful breeding.
- foal growing up time gone astray.
- horses died while in training, breeding or companion riding
causing problem.
- grandmaster training messing up stats.
- grandmaster training charge mismatch.
- wrong breeding combinations on books.
- icon for saddles.

Additional stuff
- horse now will not attack you if you accidentally hit them while
riding after you dismount.
- the saddle is now a skirt and not an armor.
- some minor additions on books.
- training charges now depends on horse types. And, the GM
charges slightly higher.
- timer for foal growing up is a global script. Which means the
time will be counted even when you are away from the ranch.
- buy more than 5 horses from the ranch.

To continue playing from an earlier savegame. Pls read the
below instructions.

1. DO NOT load this version first. Reload your savegame with
the previous version first.
2. Make sure no horses are on sell, train, breed or companion
mode. Also, make sure there are no foals in the pen.
3. Find an interior cell ( not those created by this mod ). Go
inside and save.
4. Now, exit and select the new version and uncheck the old one.
5. Reload the savegame.
6. Go back to the ranch. Check everything to see whether it is
ok before you save the game.
7. If you see double banners in the game, open up your console.
Click on one of the banner and type "Disable". Repeat the same
for all double banners. This is the only way to eliminate it from
the game if you want to re-use your existing savegame.
8. Save your game with a new name. This is where your game
continues with the new version.

If you still have problem, then you have to restart the game from
scratch. :(

------------------------------------------------------------------------------------------------------
11. FUTURE ADDON
------------------------------------------------------------------------------------------------------
Addon planned for this mod.

- Horse racing against other NPCs.

So, keep your fingers crossed on these. ;)

------------------------------------------------------------------------------------------------------
11. DISCLAIMER
------------------------------------------------------------------------------------------------------
This file ( HorseRanch.rar ) and its contents are 
copyrighted © ( 2004 ) by MADMAX. You may NOT modify any 
of the files or use this mod to "add" to your mod without my 
written consent. This is Freeware. No one is allowed to 
commercially exploit this mod, You may distribute this file 
freely as long as its contents are kept original and intact.
Thanks!