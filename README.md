# Infernal Crucible — a Diablo-like

Dark hack-and-slash dungeon crawler reimagining the moods of **Diablo III**,
written from scratch in pure **HTML / CSS / JavaScript** — a single canvas
engine, zero dependencies, zero external assets (all sound effects are
generated procedurally with WebAudio). UI is fully in English.

## How to play

Just open `index.html` in any modern browser (double-click works), or serve
the folder:

```bash
python3 -m http.server 8123   # then open http://localhost:8123/
```

## Controls

| Input | Action |
|---|---|
| **Right mouse button / click** | move to the clicked point; **hold it down** and the character keeps following the cursor, stopping the instant you release |
| **Left mouse button** (hold) | sword attack (auto-aims at nearest foe) |
| **WASD / arrows** | movement (same as click-to-move) |
| **1** | healing potion — unlimited uses, one charge per 60 s (fresh at each checkpoint) |
| **2** | Whirlwind — AoE spin, spends 30 Mana |
| **3** | Leap — jump forward, AoE landing + stun, spends 25 Mana |
| **C** | character sheet: attributes, equipment, inventory |
| **M** | area map — fog of war: only parts the player has walked through are revealed (boss/portal/start markers appear once discovered) |

Clicking an **icon of a skill with the left mouse button** casts it directly —
potion, Whirlwind, Leap or the sword swing — handy when you don't want to
reach the keyboard.

## The loop

Each act is a **procedurally generated dungeon** — rooms connected by
corridors, lit by wall torches. Monsters **sleep where they stand** and
wake up only when you step into their aggro radius (or when you hit them):
explore room by room like in Diablo, no pulls from across the map. Kill the
quota of monsters' worth of progress, find the **boss waiting in the
deepest room**, slay him to unlock the **portal behind his throne** (it
stays dim while he lives, blazing bright once he falls) and descend one
level deeper. **Treasure chests** hide among the rooms — walk up to one
and it springs open: a guaranteed magic item plus gold. Die → stats
screen → try again. Every portal you enter
**saves your journey in the browser** (checkpoint, level, attributes,
gear, gold) — close the tab and the title screen will offer to continue
your last journey instead of starting over.

## Systems

- **Attributes**: Strength, Dexterity, Intelligence, Vitality — +3 points per
  level, spent from the character sheet. Main attribute scales your weapon's
  damage (each weapon rolls one of str/dex/int), dexterity feeds crits,
  intelligence feeds max Mana, vitality feeds HP and very slow natural HP
  regen from level 5.
- **Mana** (blue) regenerates slowly; combat swings feed it back.
- **Globes**: slain enemies drop green XP globes, blue Mana globes and,
  with a 30% chance, a **red heal orb** that restores 30% of your life.
- **Bestiary**: Goblins (plus sneaky Goblin Archers), Zombies, Skeletons,
  Orc Brutes with iron pauldrons and tusks, and Orc Shaman casting from
  afar — each checkpoint deepens the mix; a **Goblin Warboss** guards the
  throne room. Elites wear gold nameplates.
- **Items**: common/magic/rare/legendary gear for weapon/helm/armour with
  affixes. Each weapon rolls an attribute-scaling bonus **(+1–200% of one
  attribute, high rolls progressively rarer)**, shown on the item like
  `Damage: +14 (+87% Strength)` — the bonus is attribute value × that %.
  Affixes roll at most one bonus per kind out of **Damage / Life / Mana /
  Critical Chance / Movement Speed**, each shown on the item line. Every pickup
  goes to your 12-slot **inventory** — you equip and swap gear manually from
  the sheet (key C), even mid-fight.
- **Zoom** scales with your monitor: the visible world stays readable on big
  screens.

## Project layout

| File | What |
|---|---|
| `index.html` | DOM contract: HUD, screens, character sheet, cooldown slots |
| `style.css` | gothic UI: panels, cooldown conic rings, rarity colors, English labels |
| `game.js` | the whole engine: dungeon gen, lighting, AI, combat, progression, SFX |

## Notes

- Rendering: Canvas 2D with a pseudo-3D wall pass, darkness layer with
  torch/portal light holes and additive warm haloes. The player is a
  hand-drawn armored warrior — cuirass, pauldrons, greaved legs and a
  sword arm — with a walk cycle (limbs counter-swing, boots lift).
- Deterministic dungeon layouts per checkpoint (seeded hash), monster waves
  vary per run.
- Work in progress: it is a *reimagining of the moods*, not a clone — no
  loot pipetry, no skills trees, one character class.
