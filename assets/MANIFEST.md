# Asset Manifest - Infernal Crucible

Per ART_BIBLE.md section 12.3. One row per file in `assets/`.
No asset below is `approved`: an agent may not promote an asset on a successful
generation alone (section 13.1), so every new piece waits in `review` until a
human picks it.

Generation model for the Comfy pieces: Z-Image-Turbo, `gguf/z_image_turbo-Q4_K_M.gguf`
(Q4_K_M, 6B, loaded by `UnetLoaderGGUF`), text encoder `qwen_3_4b_fp8_mixed.safetensors`
(`lumina2`), VAE `ae.safetensors`, 8 steps, cfg 1.0, `res_multistep`/`simple`, shift 3.0.
The Comfy graphs live in `assets/workflows/` and run against the local ComfyUI server.

| Asset ID | Filename | Category | Description | Generation model | Workflow identifier | Seed | Reference images | Resolution | Approval status | Intended game usage |
|---|---|---|---|---|---|---|---|---|---|---|
| ENV-OLD-001 | `environment_old_ruins_v01.png` | environment | Old Ruins dungeon fragment, high three-quarter iso view, torch warm key plus cold moonlight crack, toppled chest, bone picks | Blender 4.x render through the Blender MCP session | Blender scene saved as `assets/oldruins.blend`, rendered at 2048x1152 | - | none (first piece of the set) | 2048x1152 | review | background art for the Old Ruins band, the first theme row of `THEMES` |
| CHR-WAR-001 | `character_warrior_figure_v01.png` | character | Knight-class warrior in scratched grey steel, plumed helm pushed up, sword point down, battered shield, full body on obsidian ground | Blender 4.x render through the Blender MCP session (primitive figure build under a `wk_root` empty, own camera and rim lights) | figure stage, 1024x1536; the figure graph is not stored in `assets/` (the saved `.blend` predates it) | - | none | 1024x1536 | review | the `CLASSES.war` hero figure, grey steel #3e4a5c / #7e8ea4 |
| CHR-GOB-001 | `character_goblin_swarmling_v01.png` | character | Hunched green goblin swarmling, ragged leather and stolen mail, jagged cleaver, one foot on a broken flagstone | z-image_turbo Q4_K_M GGUF | `assets/workflows/zimage_goblin_v01.json` | 103 | `character_warrior_figure_v01.png` for scale | 1024x1024 | review | the Goblin row of `MTYPES`, green #5d8f3a, fast 150, first swarm foe of every new level |
| CHR-ZOM-001 | `character_zombie_shambler_v01.png` | character | Shambling undead, sunken face, open wounds and pale bone, rotted burial rags with rusted rib plates | z-image_turbo Q4_K_M GGUF | `assets/workflows/zimage_zombie_v01.json` | 204 | `character_goblin_swarmling_v01.png` for the silhouette weight | 1024x1024 | review | the Zombie pool of `MTYPES` from checkpoint 2 on |
| CHR-GOR-001 | `character_goruk_warboss_v01.png` | character | Goruk the Goblin Warboss: hulking red goblinoid warlord, broken spiked iron crown, gold-trimmed lamellar, notched black-iron cleaver with a faint infernal edge glow | z-image_turbo Q4_K_M GGUF | `assets/workflows/zimage_goruk_v01.json` | 305 | `character_goblin_swarmling_v01.png` (must read far larger) | 1024x1536 | review | `BOSSES[0]` first level overlord, `r:27` body and red #b03a3a |
| ENV-LIC-001 | `environment_lich_throne_v01.png` | environment | Lich Throne hall: bone-white masonry, blood carpet up a two-step dais, skull-crowned gothic throne, cold green candle flame, no exit in the room | z-image_turbo Q4_K_M GGUF, rendered 1536x864 then Lanczos to 2048x1152 | `assets/workflows/zimage_lichthrone_v01.json` | 406 | none | 2048x1152 | review | background for stage thirteen, `FINAL_THEME` / `game.finalHall` |
| CHR-ADR-001 | `character_adrith_lichking_v01.png` | character | Adrith the Lich King: skull head under a crown of bone spires, bone-and-ash plate over rotted mail, reaping scythe with the blade curved over the head, cold aura at the feet | z-image_turbo Q4_K_M GGUF | `assets/workflows/zimage_adrith_v01.json` | 507 | `environment_lich_throne_v01.png` | 1024x1536 | review | `BOSSES[FINAL_LEVEL - 1]`, `FINAL_BOSS_BIG` |
| CHR-GOB-001C | `character_goblin_cut_v01.png` | character | The goblin plate above, cut from a chroma-magenta ground and cropped to its own bounds, alpha included | same graph re-rendered on a chroma plate (`assets/workflows/chroma_goblin_v01.json`, seed 103) and colour-keyed by `assets/tools/chromakey.py` | `assets/workflows/chroma_goblin_v01.json` | 103 | `character_goblin_swarmling_v01.png` | 776x735 | review | the plate the arena draws for `MTYPES.fallen`, feet on the ground line and `cx: 353` as the body line |
| CHR-ZOM-001C | `character_zombie_cut_v01.png` | character | The zombie plate above, cut and cropped the same way | same graph re-rendered on a chroma plate (`assets/workflows/chroma_zombie_v01.json`, seed 204) and keyed by `assets/tools/chromakey.py` | `assets/workflows/chroma_zombie_v01.json` | 204 | `character_zombie_shambler_v01.png` | 605x906 | review | the plate the arena draws for `MTYPES.zombie` |
| CHR-GOR-001C | `character_goruk_cut_v01.png` | character | The Goruk plate above, cut and cropped the same way | same graph re-rendered on a chroma plate (`assets/workflows/chroma_goruk_v01.json`, seed 305) and keyed by `assets/tools/chromakey.py` | `assets/workflows/chroma_goruk_v01.json` | 305 | `character_goruk_warboss_v01.png` | 885x1245 | review | the plate the arena draws for `BOSSES[0]`, `SPRITES.sig0` |
| CHR-ADR-001C | `character_adrith_cut_v01.png` | character | The Adrith plate above, cut and cropped the same way | same graph re-rendered on a chroma plate (`assets/workflows/chroma_adrith_v01.json`, seed 507) and keyed by `assets/tools/chromakey.py` | `assets/workflows/chroma_adrith_v01.json` | 507 | `character_adrith_lichking_v01.png` | 815x1380 | review | the plate the arena draws for the last overlord, `SPRITES.lich` |
| UI-CLV-003 | `icon_skill_cleave_v03.png` | ui icon | A wide axe sweeping a bone-coloured arc, one object on a square panel with a thin antique gold rim | z-image_turbo Q4_K_M GGUF | `assets/workflows/icon_skill_cleave_v03.json` | 701 | the character set above, for the set's shared anchor | 512x512 (2x of the 256 nominal, for the 56 px slot) | review | the plate `HUD.iconSkill2` / `iconSkill3` wear for `SKILL_ICON.cleave` (issue #70) |
| UI-QKA-003 | `icon_skill_earthquake_v03.png` | ui icon | A mailed fist landing in a cracked crater with a gold shock star | z-image_turbo Q4_K_M GGUF | `assets/workflows/icon_skill_earthquake_v03.json` | 702 | as above | 512x512 | review | `SKILL_ICON.earthquake` |
| UI-HRO-003 | `icon_skill_herostrike_v03.png` | ui icon | A heavy hammer planted on an impact star, the foe shoved beyond it | z-image_turbo Q4_K_M GGUF | `assets/workflows/icon_skill_herostrike_v03.json` | 703 | as above | 512x512 | review | `SKILL_ICON.herostrike` |
| UI-WHL-003 | `icon_skill_whirlwind_v03.png` | ui icon | A spiral of blade tips around a hub | z-image_turbo Q4_K_M GGUF | `assets/workflows/icon_skill_whirlwind_v03.json` | 704 | as above | 512x512 | review | `SKILL_ICON.whirlwind` |
| UI-VEN-003 | `icon_skill_venshot_v03.png` | ui icon | A drawn bow whose arrowhead drips venom | z-image_turbo Q4_K_M GGUF | `assets/workflows/icon_skill_venshot_v03.json` | 705 | as above | 512x512 | review | `SKILL_ICON.venshot` |
| UI-FAN-003 | `icon_skill_bladefan_v03.png` | ui icon | Six shafts fanned out of a grip | z-image_turbo Q4_K_M GGUF | `assets/workflows/icon_skill_bladefan_v03.json` | 706 | as above | 512x512 | review | `SKILL_ICON.bladefan` |
| UI-FRO-003 | `icon_skill_frostlance_v03.png` | ui icon | A four-sided frost lance head trailing a comet in arcane blue | z-image_turbo Q4_K_M GGUF | `assets/workflows/icon_skill_frostlance_v03.json` | 707 | as above | 512x512 | review | `SKILL_ICON.frostlance` |
| UI-CHN-003 | `icon_skill_chainbolt_v03.png` | ui icon | A lightning kink walking from one struck head to the next in spectral violet | z-image_turbo Q4_K_M GGUF | `assets/workflows/icon_skill_chainbolt_v03.json` | 708 | as above | 512x512 | review | `SKILL_ICON.chainbolt` |

## Set notes

- prompts.txt blocks 1-7 are delivered here, block 8 (the icon set) is `planned`.
- Comfy runs used cfg 1.0 with `ConditioningZeroOut` as the negative, which is how Z-Image-Turbo
  is meant to be sampled, so the `NEGATIVE:` blocks in prompts.txt were not pasted into the graph:
  with cfg 1.0 a negative prompt has no effect. Off-model wording is instead carried by the shared
  style anchor inside every PROMPT.
- The four `*_cut_*` plates are the same renders re-run on a flat chroma-magenta ground at the same
  seed, then colour-keyed by `assets/tools/chromakey.py figure`, which also crops to the figure and reports
  `cx` (the body line) from the crop's left edge. `game.js` draws those cut plates and nothing else
  from the set, so the uncut renders in the table above stay for review only.
- What is wired in `game.js` now: the two backdrop plates as the realm's atmosphere (`THEMES[0].bd`
  and `FINAL_THEME.bd`, baked to half world size once per realm and laid over the stone as a
  multiply pass so an unlit room stays as black as it was), the four cut plates as the figures of
  `MTYPES.fallen`, `MTYPES.zombie`, `BOSSES[0]` and the last overlord, and the eight icon plates on
  the two skill slots. A foe with no plate keeps its painted silhouette, and a plate that has not
  loaded falls the figure back to that silhouette, so the game still runs with an empty `assets/`.
- Status reads survive the swap: a poisoned or frozen plate is washed in its own silhouette
  (`tintFor` stamps the colour through the plate's alpha), the venom haze and bubbles are painted
  over whatever the foe is drawn as, and the hit flash re-draws the plate through `lighter`.
- The eight icon plates are one set and ship in one pass: swapping one icon alone breaks the
  consistency section 10.4 asks of icons, since the eight are generated from one shared anchor and
  one framing.
- Approval is still `review` on everything: the human check ART_BIBLE 13.2 asks for has not run.
- The icon set took three passes to land. The first pass used the block's own wording verbatim and
  came back as round medallions; the second pass asked for the square panel the block and section
  10.4 want and answered by tiling the frame, because naming what must not appear in a prompt with
  cfg 1.0 is exactly what invites it. The third pass is the shipped one: one object stated first,
  the panel described in affirmative clauses only, and the block's materials, palette, rim and light
  carried as clauses with the set's eight-skill wording taken out of the prompt, since that wording
  kept teaching the model to paint eight objects in one frame. `icon_skill_*_v01/v02` are not in the
  repo: only the shipped pass is.
- The icon plates are keyed the same way as the cut plates and framed by the panel rather than by
  the figure: `assets/tools/chromakey.py panel` crops to the panel and scales every piece to one
  square with the same small margin, which is what lets the eight share one box in the slot. The
  character plates use the tool's other framing, `figure`, and are untouched by this pass - running
  the tool over the same chroma output reproduces the committed cut plates byte for byte.
- The icon set is wired too: `HUD.iconSkill2` / `iconSkill3` wear the plates over their slot, the
  painted `SKILL_ICON` glyph is dropped once a plate is on hand and stays the moment it is not, and
  the slot marks itself `.plate` so the rules that dim an unusable slot dim a plate as much as they
  dim a glyph.
