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

The title card is painted by the same code as the game: a crossed-swords
**logo** carries the name, a full-armoured **warrior** with his sword planted
framing one side of the window and the **crowned princess** you are there to
save, lantern in hand, framing the other. She keeps her gown on - the prize
reads as a prize, not as a trophy.

Prefer to watch first? The title screen's **Watch the Demo (AI plays)** button
hands the hero to a small internal AI and lets the run play itself: the bot
duels whatever it can actually **see** (a foe behind a wall is ignored, not
walked into), rounds corners instead of pressing into geometry, picks up and
equips any drop better than what it wears, springs chests, drinks when low,
heads for the gate, stirs the overlord waiting there and duels him before
stepping through, and it spends
level-up attribute points in its class' proportions — a spectator
run you can follow from the title screen to its death screen. It never flails at
out-of-reach foes: a swing only lands within the weapon's true tip distance, and a
swing that ends on thin air sends the bot walking in before it swings again; it
answers only to things inside its sight with a clear line - foe, loot, chest, trader,
gate - never through a wall, free-exploring when nothing interesting stands around;
and when it spies a trader it walks over and lets him buy every spare the backpack
still holds, the pack turned back into gold.

## Controls

| Input | Action |
|---|---|
| **Right mouse button / click** | move to the clicked point; **hold it down** and the character keeps following the cursor, stopping the instant you release |
| **Left mouse button** (hold) | attack with whatever is in your hand — an axe or a sword swings, a bow fires an arrow straight at the cursor, a staff looses a magic missile that curves only toward foes in front of it |
| **WASD / arrows** | movement (same as click-to-move) |
| **1** | healing potion — unlimited uses, one charge per 60 s (fresh at each checkpoint) |
| **2** | your class' **opener** — the skillbar names it; cheap on Mana, ready again in seconds |
| **3** | your class' **finisher** — the skillbar names it; way stronger, way more Mana, a long cooldown |
| **C** | character sheet: attributes, equipment, inventory |
| **M** | area map — fog of war: only parts the player has walked through are revealed (boss/portal/start markers appear once discovered) |
| **P** | pause: the frame goes dark, nothing regenerates and no enemy stirs, until you press P again |
| **T** | trade with the wandering merchant when you stand near him: the world stops and a two-tab stall opens (Sell / Buy) — the **X** in the stall's top right corner closes it too |

Clicking an **icon of a skill with the left mouse button** casts it directly —
potion, your class' opener, its finisher or the attack of whatever you are holding — handy when you
don't want to reach the keyboard.

## The loop

Each act is a **procedurally generated dungeon** — rooms connected by
corridors, lit by wall torches. Monsters **sleep where they stand** and
wake up only when you step into their aggro radius (or when you hit them):
explore room by room like in Diablo, no pulls from across the map. Every
**three levels the theme changes** — Old Ruins in warm stone, Frozen
Hollows under cold blue light, Bone Flats in pale dust — and the stones,
torch flames and the dark between them change with them. The **tenth
level is no dungeon at all** but the arena of **the Demon's Roost**: one
vast hall ringed by broken pillars, and its overlord waiting by the gate
is bred bigger than any other — wider shoulders, thicker hide, heavier
hand. Kill the
quota of monsters' worth of progress, find the **portal** — and the level is
not over the moment you set foot near it: no overlord is placed in the deepest
room any more — he waits *at the gate itself* and steps out when you come
within **half of what your hero can see** of it, then comes straight at you. The
gate stays dim and shut under him, so a level cannot be run past — slay him
and it blazes open and you descend one level deeper. **Treasure chests** hide among the rooms — walk up to one
and it springs open: a **magic-or-better** item plus gold. Die → stats
screen → try again. Foes give chase only up to a **leash** — far from
their spot they stop, glance around, and walk back to sleep where they
started. The leash even holds each level's **overlord to his post by the
portal**: he
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
- **Class skills**: the first slot is the same tonic for everyone, the other two
  belong to the class and answer for the weapon that class actually fights with,
  so a Barbarian cannot spin with a staff and a Mage cannot lob lightning through
  a bowstring — pressing the wrong one spends nothing and says so. Same shape
  every time: the opener is a solid single blow well past a plain attack (12-14
  Mana, 4 s), the finisher is way stronger over an area (40-45 Mana, 11-13 s).
  **Barbarian** — **Cleave** (a wider, longer swing, 1.7x) and **Earthquake** (hurl
  yourself at the crowd, 2.4x and a stun that holds). **Warrior** — **Hero Strike**
  (one planted blow, 2.1x, that shoves the foe back; with nothing in reach it
  refuses) and **Whirlwind** (2.2x for every foe inside it). **Rogue** — **Venom
  Shot** (1.8x, and the foe it bites crawls) and **Blade Fan** (six arrows down a
  fan). **Mage** — **Frost Lance** (1.9x, chilled) and **Chain Bolt** (lightning
  through the four nearest foes you can see). The skillbar shows which pair you
  carry, and its tooltip spells out the Mana, the cooldown and the weapon it wants.
- **Starting kit**: every run begins with the class' own tool already **in hand**,
  equipped from the first frame — a **Barbarian** carries an **Axe**, a **Warrior**
  a **Sword**, a **Rogue** a **Bow** and a **Mage** a **Staff**. It is a plain tool:
  the kind's own damage at its lowest end, one flat line, no scaling bonus and no
  affix behind it, so a fresh run starts able to fight without starting holding a
  lucky draw. A saved journey keeps whatever it was carrying, and a hand that
  saved empty is refilled with that same plain tool rather than started bare.
- **Attributes**: Strength, Dexterity, Intelligence, Vitality — +3 points per
  level, spent from the character sheet: press anywhere on a stat's row and the
  plus spends one free point. Main attribute scales your weapon's
  damage (an axe wants Strength, a sword Dexterity, a staff Intelligence —
  see **Weapon types** below), dexterity feeds crits, intelligence feeds max
  Mana - and, since issue #66, how fast that Mana fills back on its own - while
  vitality feeds HP and very slow natural HP regen from level 5.
- **Mana** (blue): the size of the pool AND the pace it fills back at both belong to
  **Intelligence**, so the classes do not even agree on the same budget. A **Barbarian**
  (Intelligence 6) holds 68 and gets roughly **1.3 a second**; a **Mage** (14) holds
  116 and gets roughly **2.8 a second** - a third of what the old flat rate handed
  everyone, so the arcane is something you spend with care rather than a drum that
  never stops. The character sheet prints your own rate next to the pool. Combat
  swings feed a little back and blue Mana globes feed more. A **staff** shot drinks
  5 mana: with less than that left the staff stays silent and the toast says your
  mana is too low.
- **Inventory**: 20-slot backpack. A full backpack **refuses new loot** —
  the item waits on the floor and you are told so,
  but you keep control too: each sheet row has a **discard ✕** (destroys the
  item), and every level hides a **wandering merchant** — stand near him and
  press T and the world stops at his trade post: a **heading across the top of the
  screen** names it a **Trading menu** and says what it does and what you carry
  (your gold, your backpack, how many goods he has left), and the **stall itself
  opens centred on the screen** below it, with two tabs. **Sell**
  lists your backpack and one click hands that item to him for gold (it lands on
  his shelf, so you can buy it back, pricier); **Buy** lists the pack he rolled
  when this level was generated - goods made by the same roll as any monster drop,
  so strong affixes stay rare. Every trader is a different man with a different
  pack, and moving to the next level discards the old one. Two ways out: press T
  again, or hit the **X** pinned to the top right corner of the window.
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
  Names come from the bonuses themselves — Sword/Axe/Bow/Staff/Helm/Armour plus the
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
- **Weapon types** decide both the attribute a weapon scales with and how the
  hero uses it, and you can **see** what you are holding: an **Axe** (Strength,
  swings), a **Sword** (Dexterity, swings), a **Bow** (Dexterity, fires arrows
  and never swings) and a **Staff** (Intelligence, fires arcane missiles
  straight at the cursor and never swings). Neither weapon auto-aims: an arrow and a
  missile both leave down the line the mouse drew, so a foe standing politely
  in reach cannot steal either shot. A magic missile may still bend, but only
  toward a foe inside a 90 degree arc straight ahead of it and only a little
  at a time, never a U-turn onto whatever happens to be behind. Shots fade out
  at their own reach (520 world px), deliberately a number of their own and not
  the hero's torchlight radius, so changing what you can see never changes how
  far a shot carries. Whatever a shot lands on spits a small splash, so the hit
  reads on the board. The same gate runs on **every class skill**: a swung weapon
  wants a swung skill, a bow or a staff wants a shot, and bare fists count as
  swung, so the Warrior's Whirlwind works with them while his Hero Strike just
  needs a foe to plant against.
- **Zoom** scales with your monitor: the visible world stays readable on big
  screens.

## Project layout

| File | What |
|---|---|
| `index.html` | DOM contract: HUD, screens, character sheet, cooldown slots |
| `style.css` | gothic UI: panels, cooldown conic rings, rarity colors, English labels |
| `game.js` | the whole engine: dungeon gen, lighting, AI, combat, progression, SFX |
| `ART_BIBLE.md` | visual direction: palette, material and silhouette rules every asset must follow |
| `prompts.txt` | the five image-generator prompts that will paint the art swap (location, warrior, goblin, zombie, first-level boss) |

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
  Since issue #59 every thing the bot answers to (foes, loot, globes, chests, the
  trader, the gate and its keeper) must sit inside its visual range AND down a clear
  line; a melee swing is asked for only within the blade's true tip distance, and a
  swing that ends without the foe losing a single hit point sends the bot stepping
  in to meet it; a trader in sight draws the bot to his stall, where the whole
  spare backpack is sold to him - his shelf grows, your gold comes back - so the
  demo run pays its leftovers down instead of hoarding them. And since issue #63 the
  bot reaches for the class' own pair when its weapon and its Mana allow it, so the
  spectator run swings and shoots the way a real player of that class would.
- Work in progress: it is a *reimagining of the moods*, not a clone — no
  loot pipetry, no skills trees, four starting classes.
