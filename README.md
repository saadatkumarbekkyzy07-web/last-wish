# Last Wish

A 3D browser game (Three.js). A girl takes her toy monkey to university abroad, where cockroaches scare her. The Moon lets the monkey come alive at night, for a limited number of nights and only if nobody sees it.

The game has 4 nights and 2 Moon quizzes on a progress map. You earn ★ stars for fast nights and spend them on costumes in the market. Passing a quiz gives ♥ lives. There is also a 2-player duel: the monkey against the mega cockroach.

## Play

| Folder | For | Open |
|---|---|---|
| `LastWish_laptop/` | laptop or PC: keyboard + mouse | `Last Wish.html` |
| `LastWish_bigscreen/` | touch screen / video wall (7680×2160): buttons on screen | `Last Wish - Big Screen.html` in Edge |

Each folder is complete on its own and works offline: download it and open the HTML file. See `HOW TO PLAY.txt` inside each folder.

## Source

`source/src/` holds the game code (`game.js`, `settings.js`, `materials.js`, `index.html`). `source/build.py` bundles it with Three.js into the single HTML files above. Easy changes such as timers, damage, prices and sizes are in `settings.js`, and also at the top of each built HTML under `GAME SETTINGS`.
