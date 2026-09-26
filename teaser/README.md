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
