# Piekielna Krucjata — Diablo-like

Dark hack-and-slash dungeon crawler reimagining the moods of **Diablo III**,
written from scratch in pure **HTML / CSS / JavaScript** — a single canvas
engine, zero dependencies, zero external assets (all sound effects are
generated procedurally with WebAudio). UI is fully in Polish.

## How to play

Just open `index.html` in any modern browser (double-click works), or serve
the folder:

```bash
python3 -m http.server 8123   # then open http://localhost:8123/
```

## Controls

| Input | Action |
|---|---|
| **Right mouse button / click** | move to the clicked point |
| **Left mouse button** (hold) | sword attack (auto-aims at nearest foe) |
| **WASD / arrows** | movement (same as click-to-move) |
| **1** | healing potion (limited — merchant restocks at each checkpoint) |
| **2** | Whirlwind — AoE spin, spends 30 Mana |
| **3** | Leap — jump forward, AoE landing + stun, spends 25 Mana |
| **C** | character sheet: attributes, equipment, inventory |

## The loop

Each act is a **procedurally generated dungeon** — rooms connected by
corridors, lit by wall torches. Monsters **sleep where they stand** and
wake up only when you step into their aggro radius (or when you hit them):
explore room by room like in Diablo, no pulls from across the map. Kill the
quota of monsters' worth of progress, find the **boss waiting in the
deepest room**, slay him to unlock the **portal behind his throne** and
descend one level deeper. Die → stats screen → try again.

## Systems

- **Attributes**: Strength, Dexterity, Intelligence, Vitality — +3 points per
  level, spent from the character sheet. Main attribute scales your weapon's
  damage (each weapon rolls one of str/dex/int), dexterity feeds crits,
  intelligence feeds max Mana, vitality feeds HP and very slow natural HP
  regen from level 5.
- **Mana** (blue) regenerates slowly; combat swings feed it back.
- **Items**: common/magic/rare/legendary gear for weapon/helm/armour with
  affixes; weapons scale with an attribute shown on the item. Better drops
  auto-equip; the rest go to your 12-slot **inventory** — click in the sheet
  to swap gear mid-fight.
- **Zoom** scales with your monitor: the visible world stays readable on big
  screens.

## Project layout

| File | What |
|---|---|
| `index.html` | DOM contract: HUD, screens, character sheet, cooldown slots |
| `style.css` | gothic UI: panels, cooldown conic rings, rarity colors, Polish labels |
| `game.js` | the whole engine: dungeon gen, lighting, AI, combat, progression, SFX |

## Notes

- Rendering: Canvas 2D with a pseudo-3D wall pass, darkness layer with
  torch/portal light holes and additive warm haloes.
- Deterministic dungeon layouts per checkpoint (seeded hash), monster waves
  vary per run.
- Work in progress: it is a *reimagining of the moods*, not a clone — no
  loot pipetry, no skills trees, one character class.
