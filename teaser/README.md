# Bundle of Brave Fete — 15 s teaser

`bundle-of-brave-fete-teaser.mp4`: 1920×1080, 60 fps, H.264 + AAC, 15.0 s.

Everything in the video is generated from code: the kinetic type, icons, confetti, transitions and the music. Brand imagery comes from the Bundle of Brave kit (strawberry, gem star, teddy).

## Timeline (128 BPM, 8 bars = 15 s, every cut on the beat)

| Time | Beat | What happens |
|---|---|---|
| 0.00 | 0 | Gem-star burst and shockwave. BUNDLE / OF / BRAVE are slapped in letter by letter as cut paper, with stickers |
| 1.64 | 3.5 | Iris zooms through the "O" |
| 1.88 | 4 | COMING (gold drop-in), THIS, then CHRISTMAS as ransom-note tiles on the snare roll. Fairy lights, snow warps into a whiteout |
| 3.75 | 8 | **Drop.** PACKED WITH, confetti cannons, fly-through ornaments |
| 4.69 | 10 | GAMES: dice, hoopla rings, a dart that hits the target on the beat |
| 5.63 | 12 | FUN ACTIVITIES: paint splats, pinwheels, an unrolling tape strip |
| 6.56 | 14 | ENTERTAINMENT: chasing marquee bulbs, spotlights, music notes |
| 7.50 | 16 | LAUGHTER: giggling letters, HA! tiles, the teddy |
| 8.44 | 18 | FESTIVE VIBES: balloons, baubles, fairy lights, a gift burst |
| 9.38 | 20 | 8th-note montage: PLAY · SING · DANCE · LAUGH · CHEER · SPARKLE · CELEBRATE · TOGETHER |
| 11.25 | 24 | BUNDLE OF BRAVE converges, FETE slams on the brass stabs, gem star crowns it |
| 13.13 | 28 | End card: COMING THIS CHRISTMAS ribbon, "presented by Bundle of Brave", light sweep on the final hit |

## Film 2 — 20 s invitation (slower, heartfelt cut)

`bundle-of-brave-fete-invite.mp4`: 1920×1080, 60 fps, 20.0 s. The score is 96 BPM in G major (32 beats = 20 s), from `tools/compose_invite.py`. The angle here is the heart behind the fete, not hype. The camera moves between four scrapbook pages:

| Time | Beat | Page |
|---|---|---|
| 0–5 s | 0–8 | **The wish.** A crayon star is drawn on craft paper, then "every brave little heart / HAS A WISH". |
| 5–10 s | 8–16 | **The scrapbook.** THIS CHRISTMAS, three polaroids (games, music & shows, festive fun) drop in and develop, then "a day to bring everyone together". |
| 10–15 s | 16–24 | **The diorama.** A paper-cut fete at dusk (a lit Christmas tree, stalls, bunting, balloons). The tags GAMES, FUN ACTIVITIES, ENTERTAINMENT, LAUGHTER and FESTIVE VIBES are hung one by one. |
| 15–20 s | 24–32 | **The invitation.** The wax seal pops, the envelope opens and the card rises: BUNDLE OF BRAVE FETE, COMING THIS CHRISTMAS, presented by Bundle of Brave. A light sweep plays on the final chime. |

`src/invite.js` reuses the teaser engine (`window.BOB`), and its preview lives at `src/invite.html?play`.

```bash
python3 tools/compose_invite.py
NODE_PATH=$(npm root -g) node tools/render.js --page invite.html --dur 20 --music invite-music.wav --out bundle-of-brave-fete-invite.mp4
```

## Film 3: "christmas plans" (20 s, vertical 9:16, for 16–25s)

`bundle-of-brave-fete-groupchat.mp4`: 1080×1920, 60 fps, 20.0 s, made for Reels and TikTok. The score is minimal UK garage at 120 BPM (40 beats = 20 s), from `tools/compose_youth.py`.

**Idea:** a group chat can't agree on christmas plans. Someone drops a link, and it opens into a riso-printed gig-poster lineup. Back in the chat there's one plain line about the cause, then everyone's in, the group gets renamed, and the end card reads *christmas plans: sorted.* It's phone-native and built to be shared ("send this to the group chat"). The brand's cut-paper letters appear as ransom-note tiles instead of stickers.

| Time | What happens |
|---|---|
| 0–4 s | POV: your group chat. Messages slam in on the beat, typing dots, a link card lands, "just open it". |
| 4–10 s | The card opens into a Swiss-grid poster: BUNDLE OF BRAVE presents games / fun activities / entertainment / laughter / festive vibes, then *this christmas*, with riso misregistration. |
| 10–13 s | The beat drops out. "ok but what's bundle of brave?" gets the reply "youth-led. they fulfil the last wishes of kids with terminal cancer." Everything else dims. |
| 13–16 s | The groove returns. "ok i'm in" / "in." / "in." / "in. bringing my cousins". The group is renamed "bundle of brave fete". |
| 16–20 s | The chat tears away to the end card: BUNDLE OF BRAVE FETE, this christmas, christmas plans: sorted, send this to the group chat. |

**How it was chosen:** three parallel brainstorms looked at it through internet culture, editorial design and purpose. Two independently landed on the group chat, and the editorial pitch supplied the lineup-poster look. Deliberately left out: rides jokes, "not your parents' gala", hype "drop" language next to the cause, and any claim about where ticket money goes. The chat names are fictional.

```bash
python3 tools/compose_youth.py
NODE_PATH=$(npm root -g) node tools/render.js --page youth.html --w 1080 --h 1920 --dur 20 --music youth-music.wav --out bundle-of-brave-fete-groupchat.mp4
```

## Rebuild

```bash
npm install                            # opentype.js
pip install numpy scipy imageio-ffmpeg
node tools/build-glyphs.js             # font outlines -> cut-paper polygons (src/glyphs.js)
python3 tools/compose.py               # original score -> build/music.wav
NODE_PATH=$(npm root -g) node tools/render.js   # needs playwright + chromium
```

- `node tools/render.js --stills 1.5,8.2` renders single frames to `build/stills/`.
- `--blur N` sets the number of motion-blur sub-samples (default 3).
- For a live preview with sound, serve the folder and open `src/index.html?play`, then click.

## Files

- `src/teaser.js`: the animation. Each frame is a pure function of time, and scenes are timed in beats.
- `tools/compose.py`: the synthesized score (celesta, sleigh bells, supersaw, brass, 4-on-the-floor).
- `tools/build-glyphs.js`: flattens Bowlby One / Rubik Mono One outlines into scissor-cut polygons.
- The fonts (Bowlby One, Rubik Mono One, Quintessential, Caveat Brush, Anton) are Google Fonts under the SIL OFL.
