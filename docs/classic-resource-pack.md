# Classic visual packs (RC63)
The built-in GOLD theme remains unchanged. Classic uses an optional same-origin manifest at public/classic-pack/manifest.json. An empty or missing manifest retains the existing RC62 art.
Only add images whose rights permit their use and distribution in this application. The source and permission fields are required provenance records, not a license verification mechanism. No third-party game graphics are included.
## Packaging
Convert authorized SWF, JXR and ATF graphics offline to PNG/WebP/JPEG first. Place files under public/classic-pack/ using subdirectories. Do not execute imported SWF, scripts or original game clients. The runtime does not accept remote URLs, path traversal or executable image formats.
Each asset entry has key, file, source, permission, and optionally mode (static, directional, animated), frames (1–120), columns, width, height, heading (degrees), fps. Uniform atlas cells must include transparency and have consistent center/pivot. Directional frame 0 points right; frames increase clockwise. Set heading to correct an offset. Size is in game canvas units.
Example entry (illustrative only; file not included):
```json
{"version":1,"assets":[{"key":"sprite:classic-ship-goliath","file":"ships/goliath.png","source":"Your authorized source","permission":"Record of permission","mode":"directional","frames":32,"columns":8,"width":96,"height":96}]}
```
## Supported key groups
- sprite:<renderer-kind> (ships, designs, rank-specific drones, PET and NPC fallback)
- npc:<lowercase hyphenated NPC name> (e.g. npc:boss-kristallin)
- drone:<code>:<rank>:<design> (exact catalog identifiers)
- shop:<category>:<id> (ships, CPU, generators, ammunition, other catalog art)
- map:<world map ID> or map:default (static full-screen background)
- portal:<kind> or portal:default (static/animated)
Not yet wired: combat projectile textures, sound, map tile layers, all HUD icons, hangar inventory art and UI skins. The import layer is visual only; it never imports combat stats, accounts, credentials, server logic or map topology. Asset size limits and fallback preserve operation if a file is missing.
