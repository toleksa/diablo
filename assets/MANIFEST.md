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
| UI-ICONS-001 | `icon_skill_*_v01.png` (8 pieces, not generated yet) | ui icon | The eight class-skill plates: cleave, earthquake, herostrike, whirlwind, venshot, bladefan, frostlance, chainbolt | - | - | - | the approved character set above | 256x256 PNG with alpha, 2x for the 56 px slot | planned | painted replacements for `SKILL_ICON` (issue #70), ridden by `HUD.iconSkill2` / `HUD.iconSkill3`; the set lands as one piece, one icon alone breaks section 10.4 |

## Set notes

- prompts.txt blocks 1-7 are delivered here, block 8 (the icon set) is `planned`.
- Comfy runs used cfg 1.0 with `ConditioningZeroOut` as the negative, which is how Z-Image-Turbo
  is meant to be sampled, so the `NEGATIVE:` blocks in prompts.txt were not pasted into the graph:
  with cfg 1.0 a negative prompt has no effect. Off-model wording is instead carried by the shared
  style anchor inside every PROMPT.
- Nothing in this table is wired into `game.js` yet. ART_BIBLE 13.2 and the note at the end of
  prompts.txt both ask for the side-by-side check and an explicit approval before production
  references switch, and the previous painted sprites in `game.js` stay untouched until then.
