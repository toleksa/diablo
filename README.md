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

Prefer to watch first? The title screen's **Watch the Demo (AI plays)** button
hands the hero to a small internal AI and lets the run play itself: the bot
duels whatever it can actually **see** (a foe behind a wall is ignored, not
walked into), rounds corners instead of pressing into geometry, picks up and
equips any drop better than what it wears, springs chests, drinks when low,
heads for the boss and steps through the portal once it opens, and it spends
level-up attribute points in its class' proportions — a spectator
run you can follow from the title screen to its death screen.

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
| **P** | pause: the frame goes dark, nothing regenerates and no enemy stirs, until you press P again |
| **T** | trade with the wandering merchant when you stand near him: the world stops and a two-tab stall opens (Sell / Buy) |

Clicking an **icon of a skill with the left mouse button** casts it directly —
potion, Whirlwind, Leap or the sword swing — handy when you don't want to
reach the keyboard.

## The loop

Each act is a **procedurally generated dungeon** — rooms connected by
corridors, lit by wall torches. Monsters **sleep where they stand** and
wake up only when you step into their aggro radius (or when you hit them):
explore room by room like in Diablo, no pulls from across the map. Every
**three levels the theme changes** — Old Ruins in warm stone, Frozen
Hollows under cold blue light, Bone Flats in pale dust — and the stones,
torch flames and the dark between them change with them. The **tenth
level is no dungeon at all** but the arena of **the Demon's Roost**: one
vast hall ringed by broken pillars, and the boss waiting in the middle of
it is bred bigger than any other — wider shoulders, thicker hide, heavier
hand. Kill the
quota of monsters' worth of progress, find the **boss waiting in the
deepest room**, slay him to unlock the **portal behind his throne** (it
stays dim while he lives, blazing bright once he falls) and descend one
level deeper. **Treasure chests** hide among the rooms — walk up to one
and it springs open: a **magic-or-better** item plus gold. Die → stats
screen → try again. Foes give chase only up to a **leash** — far from
their spot they stop, glance around, and walk back to sleep where they
started. The leash even holds the **Goblin Warboss** to his throne room: he
never hunts the whole dungeon, he is slower than a running hero, and he
shuffles back to his mark at half pace. Stand **idle for a quarter of a
minute** and the hero starts shifting weight on his own - shoulder roll,
blade lifting off the shoulder, head scanning the hall - a two-second
stretch that stops the frame any input comes back. Every portal you enter
**saves your journey in the browser** (checkpoint, level, attributes,
gear, gold) — close the tab and the title screen will offer to continue
your last journey instead of starting over.

**The Crucible is ten levels deep and every level has its own overlord**: Goruk,
Kragg and Ugruk in the Old Ruins, Vessara, Kryon and Hrolfr out in the Frozen
Hollows, Sessith, Tharkas and Vomir across the Bone Flats, and **Vermithe the
Undying** waiting in the Roost — ten men, ten nameplates, ten silhouettes, the
last one bred taller and heavier than any before him. Foes and overlords get
stronger the deeper you go, and so do you: your level feeds the loot ladder
(issue #50), your attributes and your affixes grow with it, so the climb stays a
fight rather than a slide. Felling the Roost's overlord and stepping into his
portal **wins the run**: the world holds still and a victory window comes up over
it, painted with the Roost's own muse — a draped marble figure on a plinth,
laurel in her raised hand, the overlord's broken crown shattered at her feet —
above a tally of the **fame** you cleared and the **glory** you hoarded. Two
buttons sit at its foot: **Return to the Menu** takes you back to the title
screen, **Continue the Journey** closes the window, hands control back to your
hero and lets the Roost be run again, as many times deep as you care to go.

## Systems

- **Classes** (chosen at the start screen): **Barbarian** (strong, hardy,
  poor intellect), **Warrior** (hardiest, strong, poor intellect),
  **Rogue** (quick, clever, frail) and **Mage** (mighty-minded, nimble,
  fragile) — each starts with a different attribute spread and its own look: the
  **Barbarian** is bare-chested under a bear pelt, bare-headed, braided and
  painted in war red; the **Warrior** rides in grey steel; the **Rogue** in
  mossy green leather; the **Mage** in blue over light blue. The class is shown
  on the character sheet and saved with your journey.
- **Attributes**: Strength, Dexterity, Intelligence, Vitality — +3 points per
  level, spent from the character sheet: press anywhere on a stat's row and the
  plus spends one free point. Main attribute scales your weapon's
  damage (each weapon rolls one of str/dex/int), dexterity feeds crits,
  intelligence feeds max Mana, vitality feeds HP and very slow natural HP
  regen from level 5.
- **Mana** (blue) regenerates slowly; combat swings feed it back.
- **Inventory**: 20-slot backpack. A full backpack **refuses new loot** —
  the item waits on the floor and you are told so,
  but you keep control too: each sheet row has a **discard ✕** (destroys the
  item), and every level hides a **wandering merchant** — stand near him and
  press T and the world stops at his trade post: a panel with two tabs. **Sell**
  lists your backpack and one click hands that item to him for gold (it lands on
  his shelf, so you can buy it back, pricier); **Buy** lists the pack he rolled
  when this level was generated - goods made by the same roll as any monster drop,
  so strong affixes stay rare. Every trader is a different man with a different
  pack, and moving to the next level discards the old one. T again closes the stall.
- **Globes**: slain enemies drop blue Mana globes and, with a 30% chance,
  a **red heal orb** that restores 30% of your life. XP is **not** a pickup
  — it lands on your player card the instant a kill lands, so nothing is
  ever lost or interruptible.
- **Bestiary**: Goblins are quick and brittle swarmlings (plus sneaky
  Goblin Archers keeping distance), Zombies shamble in slow but heavy,
  Skeletons scuttle fast as glass cannons, Orc Brutes hit hard and
  sluggish, and Orc Shamans cast from afar — each checkpoint deepens
  the mix; a **Goblin Warboss** guards the throne room. Elites wear
  gold nameplates.
- **Items**: common/magic/rare/legendary gear for weapon/helm/armour with
  affixes — common carries only its base stat (damage + attribute scaling
  for weapons, life for armour), magic/rare/legendary add exactly 1/2/3
  bonuses. The odds fall away **exponentially** — about 100 : 22 : 5.5 : 1.4 —
  so most drops are plain goods, a magic item a treat, a rare one a rarity and
  a **legendary a special occasion** you hear the bell for. Every roll is also
  handed a **luck** ladder: your level, the depth you stand on and the enemy's
  rank (normal none, elite small, boss big) add to it, and luck bends that
  curve instead of adding flat odds, so a level-1 novice in the Old Ruins
  almost never sees a rare while a veteran near the arena drops one in five —
  the same luck also fattens the bonuses themselves, so a veteran's affixes
  land in the top of their range far more often. **Treasure chests never hold
  common gear** — they roll magic-or-better. Ground drops glow **white /
  blue / purple / orange** by rarity.
  Names come from the bonuses themselves — Sword/Helm/Armour plus the
  first bonus's affix-linked prefix and an `of X` suffix for each later
  bonus, so no bonus ever lends two words (e.g. `Keen Armour
  of the Lucky Blade`), legendaries also get a grand title (`Ancient …`).
  Each weapon rolls an attribute-scaling bonus **(+1–200% of one
  attribute, on an exponential curve where past 100 is quite rare and past
  150 a once-in-a-long-run roll)**, shown on the item like
  `Damage: +14 (+87% Strength)` — the bonus is attribute value × that %.
  Affixes roll at most one bonus per kind out of **Damage / Life / Mana /
  Critical Chance / Movement Speed** and the four attributes, every one of them
  rolled on an exponential min-to-max curve (issue #36) so the top of a range is
  far harder to hit than the bottom, each shown on the item line. Every pickup
  goes to your 20-slot **inventory** — you equip and swap gear manually from
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
- Item affixes name themselves by strength: each bonus kind has three affix
  words sorted weakest to strongest (`Strong -> Brawny -> Colossal`,
  `Clever -> Wise -> Brilliant`), and the word an item shows follows where its
  rolled value landed inside that kind's limit — up to a third gets the weak
  word, up to two thirds the middle one, above that the strongest. A bonus
  never lends more than one affix.
- Demo mode drives the same input surface as the player: the bot only sets
  `game.moveTarget` and `game.mouseDown`, so a spectator run goes through the
  exact same update path a human one does. Its targets are sight-limited
  (`losClear` samples the tile grid), its wander goals stay in sight, and a
  blocked straight step is re-aimed at the nearest passable detour, so it walks
  around walls rather than into them. On level up it spends the free points
  across Strength/Dexterity/Intelligence/Vitality in its class' proportions.
- Work in progress: it is a *reimagining of the moods*, not a clone — no
  loot pipetry, no skills trees, four starting classes.
