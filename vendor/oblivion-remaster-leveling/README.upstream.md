# OblivionRemasterLikeLeveling

A mod for Open Morrowind 0.49 that simulates the new leveling system implemented in Oblivion Remastered

>[!CAUTION]
>## Requirements
>Requires [Open Morrowind 0.49](https://openmw.org/downloads/)
>
>## Potential Conflicts
>Mods that updates the global variable ***iLevelupTotal***\
>Mods that impacts leveling\
>Mods that impacts player maximum skill or attribute value\
>Mods that impacts player HP

## Release v0.5.3
Fixed the following bugs:
- Infinite Leveling increase and roll over after a skill reach 100

Changed Major/Minor/Misc skill impact default values to 8/6/2

## Release v0.5.2
Fixed the following bugs:
- Spelling mistake in mod settings description
- No Health increase on level up

## Release v0.5.1
Fixed the following bugs:
- Extra point added to level up progression while upgrading a major or minor skills
- Level Up progression not rolled over if the roll over is greater than one level

Tried to synchronize Menu update to avoid "Error in Delayed Action Update UI: Lua error: Delayed Action is not allowed to create another DelayedAction" errors

## Release v0.5.0
Early release - first public release - Full test playtrough in progress\
New Level Up Menu to distribute virtues as in Oblivion Remastered\
Major, Minor and Misc skills impacts fully configurable on a basis of 100 points requierd for leveling up\
Skill Upgrade points are rolled over to the next Level


## Installation Instruction

#### Manual
Extract the zip file in a folder of your convenience

Edit **openmw.cfg** (on Windows it should be located in %USERPROFILE%\Documents\My Games\OpenMW)

At the end of **DATA PATHS** section, add\
`data="_Path to OblivionRemasterLikeLeveling folder_"`

At the end of **CONTENT FILES** section, add\
`content=OblivionRemasterLikeLeveling.omwaddon`\
`content=OblivionRemasterLikeLeveling.omwscripts`

#### Automatic
The mod can be added to an [Open Morrowind mod list](https://modding-openmw.com/guides/auto/) following [Customizing Mod Lists](https://modding-openmw.com/tips/customizing-modlists/) instructions\
I made it work as is with **I Heart Vanilla: Director's Cut** list

Ensure both **OblivionRemasterLikeLeveling.omwaddon** and **OblivionRemasterLikeLeveling.omwscripts** are activated when launching the game