# Infernal Crucible — a Diablo-like

Dark hack-and-slash dungeon crawler reimagining the moods of **Diablo III**,
written from scratch in pure **HTML / CSS / JavaScript** — a single canvas
engine, zero dependencies. The only files it reads are the painted plates of
the art set in `assets/`, and even those are optional: a plate that has not arrived
falls its figure back to the painted silhouette, so the game still runs with an
empty `assets/`. Every sound effect is still generated procedurally with
WebAudio, and the UI is fully in English.

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
| **Space** | a second attack key — a swung weapon keeps its auto-aim; with the cursor **not** held down a bow or a staff shot flies the way you are heading, so a running archer looses down his own line of travel rather than down the cursor (issue #78) |
| **WASD / arrows** | movement (same as click-to-move) |
| **Moving while you shoot** | walking never steers your shots: a bow or a staff keeps firing along the cursor line even as you strafe, so an archer running south looses his arrows where he is pointing rather than at his own heels (issue #67) |
| **1** | healing potion — unlimited uses, one charge per 30 s (fresh at each checkpoint) |
| **2** | your class' **opener** — the skillbar shows its own plate and names it; cheap on Mana, ready again in seconds |
| **3** | your class' **finisher** — the skillbar shows its own plate and names it; way stronger, way more Mana, a long cooldown |
| **C** | character sheet: attributes, equipment, inventory |
| **M** | area map — fog of war: only parts the player has walked through are revealed (boss/portal/start markers appear once discovered) |
| **P** | pause: the frame goes dark, nothing regenerates and no enemy stirs, until you press P again |
| **T** | trade with the wandering merchant when you stand near him: the world stops and a two-tab stall opens (Sell / Buy) — the **X** in the stall's top right corner closes it too |

Clicking an **icon of a skill with the left mouse button** casts it directly —
potion, your class' opener, its finisher or the attack of whatever you are holding — handy when you
don't want to reach the keyboard. Aim is the cursor's at all times: only a hero
the mouse has never been pointed for aims down his own walk (issue #67).

The **L** key opens the developer menu — god mode, insta kill, an instant level, one
spawned item per tier, a merchant at hand, the whole map revealed, a jump to the next level
— a testing harness that no clean run has to touch.

## The loop

Each act is a **procedurally generated dungeon** — rooms connected by
corridors, lit by wall torches. Monsters **sleep where they stand** and
wake up only when you step into their aggro radius (or when you hit them):
explore room by room like in Diablo, no pulls from across the map. Every
**three levels the theme changes** — Old Ruins in warm stone, Frozen
Hollows under cold blue light, Bone Flats in pale dust — and the stones,
torch flames and the dark between them change with them, and the **Demon's Roost**
in brick and ember holds three halls of its own. The thirteenth stage is no
dungeon and no hall: it is the **Lich Throne**, one small square room hung with
pale banners, floored by a blood carpet that runs from the south gate up to a
dais, walled by candlesticks — and the overlord waiting at the head of
that carpet is bred **far** bigger than any other: wider shoulders, thicker
hide, heavier hand, a taller skull-crown and a reaping scythe. Kill the
quota of monsters' worth of progress, find the **portal** — and the level is
not over the moment you set foot near it: no overlord is placed in the deepest
room any more — he waits *at the gate itself* and steps out once the **whole
gate stands inside the ring of torchlight around him** — a gate merely clipped
by the edge of that ring leaves him asleep in the dark, so once you can make the
portal out you may back off and prepare for the fight before he comes. The
gate stays dim and shut under him, so a level cannot be run past — slay him
and it blazes open and you descend one level deeper. Thirteen stages are drawn in
all, so the Roost's halls end at the twelfth gate: the **thirteenth has no portal
at all**. There the lich king waits asleep at the head of the carpet, and he is
stirred only once his **whole model** sits inside the ring of torchlight around
you — the same construction the gate learned, read off the king's own
shoulders. What his death wakes is not a gate but the **throne** on the dais: it
burns cold, words itself over its head, and touching it sits the hero down, which
ends the run. **Treasure chests** hide among the rooms — walk up to one
and it springs open: a **magic-or-better** item plus gold. Die → stats
screen → try again. Foes give chase only up to a **leash** — far from
their spot they stop, glance around, and walk back to sleep where they
started. The leash even holds each level's **overlord to his post by the
portal**: he
never hunts the whole dungeon, he is slower than a running hero, and he
shuffles back to his mark at half pace. Stand **idle for a quarter of a
minute** and one of **three** idle routines starts on its own - a **weight
shift** over planted feet, a **weapon read** that takes the blade off the
shoulder and brings it up to eye height, or a **look round** the halls that
leaves the body put and turns the head. Each runs about two seconds, and as
long as he keeps standing another starts **five idle seconds** after the
previous one settled, always a different routine from the one just played,
so the three alternate rather than repeating. Any input at all stops the
whole cadence on the frame it comes back on, and the quarter-minute has to
be sat through again. Every portal you enter
**saves your journey in the browser** (checkpoint, level, attributes,
gear, gold) — close the tab and the title screen will offer to continue
your last journey instead of starting over.

**The Crucible is thirteen stages deep and every one has its own overlord**: Goruk,
Kragg and Ugruk in the Old Ruins, Vessara, Kryon and Hrolfr out in the Frozen
Hollows, Sessith, Tharkas and Vomir across the Bone Flats, and **Vermithe the
Undying**, **Kazrek the Withered** and **Ur-Thul the Bone Crown** in the Roost's own
three halls — thirteen men, thirteen nameplates, thirteen silhouettes, the last one
bred far wider than any before him. Foes and overlords get
stronger the deeper you go, and so do you: your level feeds the loot ladder
(issue #50), your attributes and your affixes grow with it, so the climb stays a
fight rather than a slide. Felling the **Lich King** and sitting on his throne
**wins the run**: he is held on the seat while he settles into it and nothing
answers to your hands, then a victory window comes up over the hall, painted with
the prize — a draped marble figure on a plinth, laurel in her raised hand, the
king's cold crown at her feet — above a tally of the **fame** you cleared and the
**glory** you hoarded. Two buttons sit at its foot: **Return to the Menu** takes
you back to the title screen, **Continue the Journey** carries the hero past the
throne into the **endless gauntlet** (issue #79): the window closes, he stands up off
the cooled seat so the prize cannot be claimed twice, and stage fourteen begins - the
halls keep regenerating under the final theme, the clamped overlord table hands the
same last man back every time, and every one of those stages carries its own portal,
so there is no last stage. The button says so itself: the caption **endless gauntlet**
rides on it, under its own label.

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
  Mana, 2 s), the finisher is way stronger over an area (40-45 Mana, 5.5-6.5 s) —
  issue #81 halved the whole skillbar, the potion included, in one pass.
  **Barbarian** — **Cleave** (a wider, longer swing, 1.7x) and **Earthquake** (hurl
  yourself at the crowd, 2.4x and a stun that holds). **Warrior** — **Hero Strike**
  (one planted blow, 2.1x, that shoves the foe back; with nothing in reach it
  refuses) and **Whirlwind** (2.2x for every foe inside it). **Rogue** — **Venom
  Shot** (an ordinary arrow that **poisons** what it bites instead of slowing it:
  the arrow lands a basic hit, and the venom the arrowhead leaves behind then eats
  another **two hundred percent** of that same hit, taken one second at a time for
  **thirty seconds** — and the envenomed foe wears a green coat, a green haze and
  bubbles climbing off it for as long as the dose is worth) and **Blade Fan** (six
  arrows down a
  fan). **Mage** — **Frost Lance** (1.9x, chilled) and **Chain Bolt**, which **travels**
  rather than branching: the bolt leaves the hero for the nearest foe he can see,
  and from there it answers for whichever foe stands nearest to the one it has just
  struck, up to four. Every leap is drawn — a wide arcane halo under a thin white
  core, kinked when the bolt is born so it does not shiver — and each arc carries its
  own light, so a chain that runs BETWEEN the crowd can be followed in an unlit hall
  rather than only inside the hero's torch. The skillbar shows which pair you
  carry, **each skill riding its own plate**: eight skills, eight drawn icons, no two
  alike, and each composed the way its cast behaves — **Cleave** sweeps an axe
  through an arc, **Earthquake** lands in a cracked crater, **Hero Strike** plants a
  hammer on a shock star and shoves, **Whirlwind** spirals blades, **Venom Shot** is a
  drawn bow with a dripping head, **Blade Fan** really does fan six shafts, **Frost
  Lance** is a cold head on a comet, **Chain Bolt** kinks through four heads. They
  wear the very colour their own cast throws on the floor, and the bar is drawn as
  vector markup at load rather than as a shared glyph, so nothing has to be
  downloaded and the plate dims with the slot when the skill cannot be spent. Its
  tooltip spells out the Mana, the cooldown and the weapon it wants.
- **Starting kit**: every run begins with the class' own tool already **in hand**,
  equipped from the first frame — a **Barbarian** carries an **Axe**, a **Warrior**
  a **Sword**, a **Rogue** a **Bow** and a **Mage** a **Staff**. It is a plain tool:
  the kind's own damage at its lowest end, one flat line, no scaling bonus and no
  affix behind it, so a fresh run starts able to fight without starting holding a
  lucky draw. A saved journey keeps whatever it was carrying, and a hand that
  saved empty is refilled with that same plain tool rather than started bare.
- **The thirteenth stage**: four realms of three levels each, then the **Lich Throne** —
  one small square hall with nothing in it but its king, candlesticks around the
  walls and a blood carpet up to the dais. The **Lich King** waits asleep at the head
  of that carpet and comes down only when his **whole model** fits inside the torch
  around you. He has three hands of his own: a **grave chorus** that raises three of
  the fallen at his feet, a **cold grasp** that pulses frost out of his ring and
  leaves the hero **chilled** - his legs go at 0.58 of their usual speed for just over
  three seconds and thaw on their own - and the overlord's charge. His death wakes the
  **throne** rather than a
  gate: the seat burns cold and words itself, and touching it seats the hero there,
  which ends the run.
- **Attributes**: Strength, Dexterity, Intelligence, Vitality — +3 points per
  level, spent from the character sheet: press anywhere on a stat's row and the
  plus spends one free point. Main attribute scales your weapon's
  damage (an axe wants Strength, a sword Dexterity, a staff Intelligence —
  see **Weapon types** below), dexterity feeds crits, intelligence feeds max
  Mana - and, since issue #66, how fast that Mana fills back on its own - while
  vitality feeds HP (issue #82 made life answer to it the way mana answers to
  Intelligence: the pool is 60 + 14 per level past the first + 6 per Vitality plus
  whatever the gear carries, so a fresh Barbarian sits at 126, a Warrior at 144, a
  Rogue at 114 and a Mage at 96) and very slow natural HP regen from level 5.
- **Mana** (blue): the size of the pool AND the pace it fills back at both belong to
  **Intelligence**, so the classes do not even agree on the same budget. A **Barbarian**
  (Intelligence 6) holds **40** and gets roughly **1.3 a second**; a **Mage** (14) holds
  **104** and gets roughly **2.8 a second** - a third of what the old flat rate handed
  everyone, so the arcane is something you spend with care rather than a drum that
  never stops. The pool itself is 56 plus 8 per point of Intelligence past 8, so the
  plate-and-axe pair sits at exactly one 40-mana finisher while the Mage holds a
  little over two; the character sheet prints your own rate next to the pool. Combat
  swings feed a little back and blue Mana globes feed more. A **staff** shot drinks
  5 mana: with less than that left the staff stays silent and the toast says your
  mana is too low. A **fresh** run already starts with the pool full (issue #75), so
  the first finisher is ready on the first frame; a continued journey keeps whatever
  its save had left in it.
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
  the mix; a **Goblin Warboss** guards the first stage's gate. Elites wear
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
| `prompts.txt` | the eight image-generator prompts the art set was painted from (blocks 1-8 have all landed; the goblin's four run beats reuse block 3's brief at its own seed) |
| `assets/` | the generated art set the game reads: two backdrop plates, four cut character plates, four goblin run-cycle beats, eight skill-icon plates |
| `assets/MANIFEST.md` | one row per file in `assets/` per ART_BIBLE 12.3: provenance, seed, workflow, approval status |
| `assets/workflows/` | the Comfy graphs behind the set, run against the local ComfyUI server |
| `assets/tools/chromakey.py` | the colour-key pass that cuts the plates (`figure` framing for characters, `panel` for icons) |
| `assets/oldruins.blend` | the Blender scene the Old Ruins backdrop was rendered from |

## Notes

- Rendering: Canvas 2D with a pseudo-3D wall pass, darkness layer with
  torch/portal light holes and additive warm haloes. The player is a
  hand-drawn armored warrior — cuirass, pauldrons, greaved legs and a
  sword arm — with a walk cycle (limbs counter-swing, boots lift). The **foes**
  now wear the art set (issue #83): the Goblin, the Zombie, Goruk and the Lich King
  draw from their cut plates, the Goblin's four run beats swap by the ground he has
  covered at 1.6 body radii a beat and ride that stride - the body dips 0.1 of its
  radius as a foot plants and leans 0.05 into its travel - the two backdrops lay
  over the stone as a multiply pass and the eight skill plates ride the two slots.
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
