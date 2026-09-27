/* Bundle of Brave Fete — 20 s invitation film (the slower, heartfelt cut).
 * Reuses the teaser engine (window.BOB). The score (tools/compose_invite.py) is
 * 96 BPM, so 32 beats = 20 s; everything below is timed in beats (b = t / BEAT).
 *
 *  b 0–8    the wish      a crayon star is drawn; "every brave little heart has a wish"
 *  b 8–16   the scrapbook polaroids of the fete drop in; THIS CHRISTMAS
 *  b 16–24  the diorama   a paper-cut fete at dusk; what's on is tagged one by one
 *  b 24–32  the invite    an envelope opens and the invitation card rises
 */
(() => {
'use strict';
const B = window.BOB;
const { W, H, CX, CY, TAU, C, clamp, lerp, inv, E, spring, rng, hash, rrect, starPath, text, spr, S,
  radialBg, sunburst, fairyLights, sparkles, glowDot, drawConfetti, addBurst, BURSTS, overlayTextures, flash } = B;
const BPM = 96, BEAT = 60 / BPM, DUR = 20;

// gentle entrances — this film breathes, nothing slams
function settle(b, bs, { dur = 0.8, rise = 40, rot = 0.08, seed = 0 } = {}) {
  const x = inv(bs, bs + dur, b);
  if (x <= 0) return null;
  const e = E.outCubic(x), r = hash(seed + 1) > .5 ? 1 : -1;
  return { y: (1 - e) * rise, a: clamp(x * 2.2), s: 0.92 + 0.08 * e, r: (1 - e) * rot * r };
}
function soft(b, bs) { // soft pop 0 → 1 in beats with a small overshoot
  const x = (b - bs) * BEAT;
  return x <= 0 ? 0 : spring(x, 1.4, 5.5);
}
function script(g, str, x, y, size, col, b, b0, b1, { shadow = null, align = 'center' } = {}) {
  const p = inv(b0, b1, b);
  if (p <= 0) return;
  g.save();
  g.font = `${size}px Quintessential`; g.textAlign = align; g.textBaseline = 'middle';
  const w = g.measureText(str).width, x0 = align === 'center' ? x - w / 2 : x;
  // write-on: a feathered clip travelling left → right
  const edge = x0 - 40 + (w + 80) * E.inOutSine(p);
  const gr = g.createLinearGradient(edge - 60, 0, edge, 0);
  gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
  const tmp = B.mkCanvas(w + 120, size * 2), tg = tmp.getContext('2d');
  tg.font = g.font; tg.textBaseline = 'middle';
  if (shadow) { tg.fillStyle = shadow; tg.fillText(str, 62, size + 3); }
  tg.fillStyle = col; tg.fillText(str, 60, size);
  tg.globalCompositeOperation = 'destination-in';
  tg.setTransform(1, 0, 0, 1, -(x0 - 60), 0);
  tg.fillStyle = gr; tg.fillRect(x0 - 60, 0, edge - x0 + 60, size * 2);
  g.drawImage(tmp, x0 - 60, y - size);
  g.restore();
}
function paperBg(g, base, warm = 'rgba(255,220,160,0.35)', cx = CX, cy = CY * 0.8) {
  g.fillStyle = base; g.fillRect(-60, -60, W + 120, H + 120);
  const gr = g.createRadialGradient(cx, cy, 0, cx, cy, W * 0.7);
  gr.addColorStop(0, warm); gr.addColorStop(1, 'rgba(120,70,40,0.18)');
  g.fillStyle = gr; g.fillRect(-60, -60, W + 120, H + 120);
}
function tape(g, x, y, w, h, rot, col = 'rgba(251,237,195,0.8)') {
  g.save(); g.translate(x, y); g.rotate(rot);
  g.fillStyle = col; g.beginPath(); g.moveTo(-w / 2, -h / 2);
  for (let i = 0; i <= 6; i++) g.lineTo(-w / 2 + (w * i) / 6, -h / 2 + (i % 2 ? 2 : -2));
  g.lineTo(w / 2, h / 2); for (let i = 6; i >= 0; i--) g.lineTo(-w / 2 + (w * i) / 6, h / 2 + (i % 2 ? -2 : 2));
  g.fill();
  g.fillStyle = 'rgba(255,255,255,.25)'; g.fillRect(-w / 2, -h / 2, w, h * 0.3);
  g.restore();
}

// ------------------------------------------------------------------ fete props
// a tall paper-cut Christmas tree with twinkling lights (the diorama's centrepiece)
function bigTree(g, x, y, k, t) {
  g.save(); g.translate(x, y); g.scale(k, k);
  g.fillStyle = '#4A2414'; g.fillRect(-22, -20, 44, 60);
  const tiers = [[-470, 130, -300], [-350, 190, -170], [-220, 250, -20]];
  tiers.forEach(([top, hw, base], i) => {
    g.fillStyle = 'rgba(0,0,0,.25)'; g.beginPath(); g.moveTo(8, top + 8); g.lineTo(hw + 8, base + 8); g.lineTo(-hw + 8, base + 8); g.closePath(); g.fill();
    g.fillStyle = i % 2 ? '#1C7A44' : '#16643A';
    g.beginPath(); g.moveTo(0, top); g.lineTo(hw, base);
    for (let j = 6; j >= -6; j--) g.lineTo((hw * j) / 6, base + (j % 2 ? 14 : 0));
    g.closePath(); g.fill();
  });
  // garland of lights
  g.globalCompositeOperation = 'lighter';
  const cols = ['rgba(255,77,77,', 'rgba(255,211,77,', 'rgba(110,200,255,', 'rgba(255,123,216,'];
  for (let i = 0; i < 26; i++) {
    const u = i / 25, yy = -430 + u * 400, hw = 40 + u * 210, xx = Math.sin(u * 14) * hw * 0.85;
    const on = 0.45 + 0.55 * Math.max(0, Math.sin(t * 3 + i * 1.3));
    glowDot(g, xx, yy, 26, cols[i % 4] + (0.7 * on) + ')');
  }
  g.globalCompositeOperation = 'source-over';
  for (let i = 0; i < 26; i++) {
    const u = i / 25, yy = -430 + u * 400, hw = 40 + u * 210, xx = Math.sin(u * 14) * hw * 0.85;
    g.fillStyle = BULBS[i % 4]; g.beginPath(); g.arc(xx, yy, 6, 0, TAU); g.fill();
  }
  g.fillStyle = C.sun; starPath(g, 0, -480, 5, 46, 20); g.fill();
  g.globalCompositeOperation = 'lighter'; glowDot(g, 0, -480, 120, 'rgba(255,220,120,0.5)'); g.globalCompositeOperation = 'source-over';
  g.restore();
}
const BULBS = ['#FF4D4D', '#FFD34D', '#6EC8FF', '#FF7BD8'];
function stall(g, x, y, w, h, a, b2, t, flag = C.gold) {
  g.save(); g.translate(x, y);
  g.fillStyle = 'rgba(30,5,5,.35)'; g.fillRect(-w / 2 + 12, -h + 14, w, h);
  g.fillStyle = '#6E2A1A'; g.fillRect(-w / 2, -h * 0.62, w, h * 0.62);        // booth
  g.fillStyle = '#2B0F0A'; g.fillRect(-w / 2 + 16, -h * 0.55, w - 32, h * 0.3); // window
  g.fillStyle = C.cream; g.fillRect(-w / 2 - 8, -h * 0.25, w + 16, 14);        // counter
  // warm light inside
  g.globalCompositeOperation = 'lighter';
  glowDot(g, 0, -h * 0.42, w * 0.45, 'rgba(255,190,90,0.45)');
  g.globalCompositeOperation = 'source-over';
  // striped roof
  const stripesN = 6, sw = (w + 40) / stripesN, top = -h, eave = -h * 0.62;
  for (let i = 0; i < stripesN; i++) {
    g.fillStyle = i % 2 ? b2 : a;
    g.beginPath(); g.moveTo(0, top - 30); g.lineTo(-w / 2 - 20 + i * sw, eave); g.lineTo(-w / 2 - 20 + (i + 1) * sw, eave); g.closePath(); g.fill();
    g.beginPath(); g.arc(-w / 2 - 20 + (i + 0.5) * sw, eave, sw / 2, 0, Math.PI); g.fill();
  }
  // pennant
  g.strokeStyle = '#3B1A12'; g.lineWidth = 3; g.beginPath(); g.moveTo(0, top - 30); g.lineTo(0, top - 80); g.stroke();
  g.fillStyle = flag; g.beginPath(); g.moveTo(0, top - 80);
  g.quadraticCurveTo(22, top - 74 + Math.sin(t * 4) * 5, 40, top - 70 + Math.sin(t * 4 + 1) * 6); g.lineTo(0, top - 58); g.fill();
  g.restore();
}
function bunting(g, x1, y1, x2, y2, sag, n, t, cols = [C.red, C.gold, C.cream, C.holly, C.pink]) {
  const mx = (x1 + x2) / 2, my = Math.max(y1, y2) + sag;
  const pt = u => [(1 - u) ** 2 * x1 + 2 * u * (1 - u) * mx + u * u * x2, (1 - u) ** 2 * y1 + 2 * u * (1 - u) * my + u * u * y2];
  g.strokeStyle = '#3B1A12'; g.lineWidth = 3; g.beginPath();
  for (let i = 0; i <= 30; i++) { const [x, y] = pt(i / 30); i ? g.lineTo(x, y) : g.moveTo(x, y); }
  g.stroke();
  for (let i = 0; i < n; i++) {
    const [xa, ya] = pt((i + 0.1) / n), [xb, yb] = pt((i + 0.9) / n);
    const sw = Math.sin(t * 3 + i) * 4;
    g.fillStyle = cols[i % cols.length];
    g.beginPath(); g.moveTo(xa, ya); g.lineTo(xb, yb); g.lineTo((xa + xb) / 2 + sw, (ya + yb) / 2 + 46); g.closePath(); g.fill();
  }
}
function hills(g, y0, amp, freq, seed, col, edge, off = 0) {
  g.fillStyle = 'rgba(20,0,0,.25)';
  const path = (dy) => {
    g.beginPath(); g.moveTo(-100, H + 100);
    for (let x = -100; x <= W + 100; x += 24) {
      const u = (x + off) * freq;
      g.lineTo(x, y0 + dy + Math.sin(u + seed) * amp + Math.sin(u * 2.7 + seed * 3) * amp * 0.35 + (hash(Math.floor(x / 24) + seed * 97) - .5) * 4);
    }
    g.lineTo(W + 100, H + 100); g.closePath();
  };
  path(10); g.fill();
  path(0); g.fillStyle = col; g.fill();
  if (edge) { g.strokeStyle = edge; g.lineWidth = 3; g.stroke(); }
}

// ------------------------------------------------------------------ panel 1: the wish
const STAR = (() => { // hand-drawn 5-point star path, slightly wonky
  const r = rng(12), pts = [];
  for (let i = 0; i <= 10; i++) {
    const k = i % 10, rad = (k % 2 ? 78 : 185) + (r() - .5) * 14, a = -Math.PI / 2 + k * Math.PI / 5 + (r() - .5) * 0.06;
    pts.push([Math.cos(a) * rad, Math.sin(a) * rad]);
  }
  return pts;
})();
function crayonStroke(g, pts, p, col, width, seed) {
  // draw the first p (0..1) of a polyline as layered, jittery crayon strokes
  const segs = pts.length - 1, upto = p * segs;
  for (let pass = 0; pass < 4; pass++) {
    const r = rng(seed + pass * 17);
    g.strokeStyle = col; g.globalAlpha = pass ? 0.35 : 0.9; g.lineWidth = width * (pass ? 0.55 : 1);
    g.lineCap = 'round'; g.lineJoin = 'round';
    g.beginPath();
    for (let i = 0; i <= Math.ceil(upto); i++) {
      const k = Math.min(i, upto), i0 = Math.floor(k), f = k - i0;
      const a = pts[i0], bb = pts[Math.min(i0 + 1, segs)];
      const x = lerp(a[0], bb[0], f) + (r() - .5) * 6 * (pass ? 1 : 0.3), y = lerp(a[1], bb[1], f) + (r() - .5) * 6 * (pass ? 1 : 0.3);
      i ? g.lineTo(x, y) : g.moveTo(x, y);
    }
    g.stroke();
  }
  g.globalAlpha = 1;
}
function panelWish(g, b) {
  const t = b * BEAT;
  paperBg(g, C.paper, 'rgba(255,214,150,0.45)', CX, 380);
  // slow push-in across the whole panel
  const z = 1 + 0.05 * E.inOutSine(inv(0, 8, b));
  g.save(); g.translate(CX, CY); g.scale(z, z); g.translate(-CX, -CY);
  // fairy lights warm up one after another
  g.save(); g.globalAlpha = inv(0.2, 3, b);
  fairyLights(g, -60, -10, W + 60, -10, 120, 18, t, { phase: 1, sway: 8, size: 0.9 });
  g.restore();
  // paper bits: torn strip, washi tape, doodles
  tape(g, 250, 180, 260, 46, -0.35, 'rgba(255,120,157,0.55)');
  tape(g, 1690, 210, 240, 44, 0.3, 'rgba(169,202,245,0.6)');
  spr(g, S.cstarP, 290, 420, 90 * soft(b, 3.2), 0.3 + Math.sin(t) * 0.05);
  spr(g, S.cstarB, 1620, 430, 110 * soft(b, 3.6), -0.2 + t * 0.1);
  spr(g, S.cstarY2, 1480, 250, 70 * soft(b, 4.1), 0.5);
  // the wish star, drawn in crayon
  g.save(); g.translate(CX, 330);
  const dp = E.inOutSine(inv(0, 2, b));
  const glow = inv(1.8, 3, b);
  if (glow > 0) {
    g.globalCompositeOperation = 'multiply';
    g.globalCompositeOperation = 'source-over';
    glowDot(g, 0, 0, 380, `rgba(255,200,80,${0.45 * glow})`);
  }
  g.rotate(Math.sin(t * 0.8) * 0.03);
  if (dp > 0) crayonStroke(g, STAR, dp, C.goldDeep, 12, 5);
  const fill = inv(1.7, 2.6, b);
  if (fill > 0) spr(g, S.cstarY, 0, 8, 440 * (0.94 + 0.06 * E.outCubic(fill)), 0.02, fill);
  if (dp > 0) crayonStroke(g, STAR, dp, 'rgba(160,90,10,0.85)', 5, 9);
  g.restore();
  if (b > 2) sparkles(g, t, 10, 41, { area: [CX - 260, 110, 520, 440], size: 44, col: 'gold' });
  // words, one at a time
  const w1 = ['every', 'brave', 'little', 'heart'];
  g.save(); g.font = '92px Quintessential'; g.textBaseline = 'middle';
  const widths = w1.map(w => g.measureText(w + ' ').width), tot = widths.reduce((a, c) => a + c, 0);
  let x = CX - tot / 2;
  w1.forEach((w, i) => {
    const a = settle(b, 2.2 + i * 0.45, { dur: 1, rise: 26 });
    if (a) {
      g.globalAlpha = a.a; g.fillStyle = 'rgba(80,20,15,.25)'; g.fillText(w, x + 3, 690 + a.y + 3);
      g.fillStyle = i === 1 ? C.red : C.ink; g.fillText(w, x, 690 + a.y);
    }
    x += widths[i];
  });
  g.restore();
  text(g, 'HAS A WISH', {
    x: CX, y: 850, size: 130, fill: (i) => (i >= 6 ? C.red : C.maroon), seed: 7, track: 0.05,
    shadow: { x: 6, y: 9, color: 'rgba(90,30,10,.3)' },
    anim: (i) => settle(b, 4.2 + i * 0.09, { dur: 0.9, rise: 50, rot: 0.2, seed: i }),
  });
  // crayon underline under WISH
  const up = E.inOutSine(inv(5.6, 6.6, b));
  if (up > 0) {
    const pts = []; for (let i = 0; i <= 20; i++) pts.push([1010 + i * 21, 945 + Math.sin(i * 0.9) * 5 - i * 0.6]);
    crayonStroke(g, pts, up, C.gold, 14, 3);
  }
  // stickers settle in
  const ted = soft(b, 5);
  if (ted > 0) spr(g, S.teddy, 1640, 1180 - 330 * ted, 300, -0.08 + Math.sin(t * 1.5) * 0.04);
  spr(g, S.strawberry, 270, 860, 230 * soft(b, 5.6), -0.2 + Math.sin(t * 1.2) * 0.04);
  g.restore();
}

// ------------------------------------------------------------------ panel 2: the scrapbook
function vignette(g, kind, t, w, h) {
  if (kind === 1) { // game stall
    g.fillStyle = '#3A0A10'; g.fillRect(0, 0, w, h);
    stall(g, w / 2, h * 0.96, w * 0.78, h * 0.8, C.red, C.cream, t);
    spr(g, S.target, w * 0.5, h * 0.52, w * 0.3, 0);
    spr(g, S.ring[0], w * 0.22, h * 0.22, w * 0.16, t, 1, 1, 0.6);
    spr(g, S.ring[1], w * 0.8, h * 0.3, w * 0.14, -t, 1, 1, 0.6);
  } else if (kind === 2) { // stage + music
    g.fillStyle = '#1D0A2A'; g.fillRect(0, 0, w, h);
    g.globalCompositeOperation = 'lighter';
    const a = Math.sin(t * 1.3) * 0.25;
    g.save(); g.translate(w / 2, -10); g.rotate(a);
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, 'rgba(255,230,160,.6)'); gr.addColorStop(1, 'rgba(255,200,120,0)');
    g.fillStyle = gr; g.beginPath(); g.moveTo(-12, 0); g.lineTo(-w * 0.45, h); g.lineTo(w * 0.45, h); g.lineTo(12, 0); g.fill(); g.restore();
    g.globalCompositeOperation = 'source-over';
    g.fillStyle = '#6B2A16'; g.fillRect(0, h * 0.8, w, h * 0.2);
    g.fillStyle = C.red; for (let i = 0; i < 6; i++) { g.beginPath(); g.arc(i * w / 5, 0, w / 9, 0, Math.PI); g.fill(); }
    spr(g, S.mic, w * 0.5, h * 0.6, w * 0.34, -0.2 + Math.sin(t * 2) * 0.06);
    [[0.2, 0.35, S.note], [0.8, 0.28, S.note1], [0.75, 0.62, S.noteP]].forEach(([x, y, s0], i) =>
      spr(g, s0, w * x, h * y + Math.sin(t * 2 + i) * 8, w * 0.2, Math.sin(t * 2 + i) * 0.2));
  } else { // balloons + lights
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#0E3F2A'); gr.addColorStop(1, '#1C7A44');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    fairyLights(g, -20, 10, w + 20, 10, 60, 7, t, { size: 0.6 });
    [[0.25, 0.62, 0], [0.5, 0.5, 1], [0.75, 0.66, 2], [0.4, 0.8, 4]].forEach(([x, y, k], i) => {
      const yy = h * y + Math.sin(t * 1.5 + i) * 10;
      g.strokeStyle = 'rgba(255,255,255,.7)'; g.lineWidth = 2; g.beginPath(); g.moveTo(w * x, yy + w * 0.1); g.lineTo(w * x + 5, h + 10); g.stroke();
      spr(g, S.balloon[k], w * x, yy, w * 0.26, Math.sin(t + i) * 0.1);
    });
    spr(g, S.gift[0], w * 0.8, h * 0.86, w * 0.22, 0);
  }
}
const POLAROIDS = [
  { x: 520, y: 600, r: -0.06, bs: 9.5, k: 1, cap: 'games' },
  { x: 960, y: 580, r: 0.04, bs: 11, k: 2, cap: 'music & shows' },
  { x: 1400, y: 610, r: -0.05, bs: 12.5, k: 3, cap: 'festive fun' },
];
function polaroid(g, P, b) {
  const x = (b - P.bs) * BEAT;
  if (x <= 0) return;
  const fall = E.outCubic(clamp(x / 0.55));
  const swing = Math.exp(-x * 3) * Math.sin(x * 9) * 0.12;
  const pw = 360, ph = 430, photo = 316;
  g.save();
  g.translate(P.x, lerp(P.y - 1100, P.y, fall));
  // shadow grows as it lands
  g.save(); g.rotate(P.r + swing); g.fillStyle = `rgba(60,25,10,${0.28 * fall})`;
  g.filter = 'blur(10px)'; g.fillRect(-pw / 2 + 14 * fall, -ph / 2 + 22 * fall, pw, ph); g.filter = 'none'; g.restore();
  g.rotate(P.r + swing);
  g.fillStyle = '#FFFDF8'; g.fillRect(-pw / 2, -ph / 2, pw, ph);
  g.save(); g.beginPath(); g.rect(-photo / 2, -ph / 2 + 22, photo, photo); g.clip();
  g.translate(-photo / 2, -ph / 2 + 22);
  vignette(g, P.k, b * BEAT, photo, photo);
  // photo "develops": starts washed out
  const dev = inv(P.bs, P.bs + 1.6, b);
  g.fillStyle = `rgba(255,250,240,${0.85 * (1 - E.outCubic(dev))})`; g.fillRect(0, 0, photo, photo);
  g.restore();
  g.font = '40px "Caveat Brush"'; g.textAlign = 'center'; g.fillStyle = C.ink;
  g.globalAlpha = inv(P.bs + 0.6, P.bs + 1.2, b);
  g.fillText(P.cap, 0, ph / 2 - 30);
  g.globalAlpha = 1;
  tape(g, 0, -ph / 2 + 4, 150, 40, -0.05 + P.r);
  g.restore();
}
function panelScrapbook(g, b) {
  const t = b * BEAT;
  paperBg(g, '#EFE9DC', 'rgba(255,225,170,0.4)');
  // subtle dotted-grid journal page
  g.fillStyle = 'rgba(120,90,60,.12)';
  for (let y = 40; y < H; y += 48) for (let x = 40; x < W; x += 48) { g.beginPath(); g.arc(x, y, 2, 0, TAU); g.fill(); }
  const drift = Math.sin(t * 0.5) * 8;
  g.save(); g.translate(drift, 0);
  // red paper ribbon behind the headline
  const rp = E.outCubic(inv(8, 9, b));
  if (rp > 0) {
    g.save(); g.translate(CX, 170); g.rotate(-0.02);
    g.fillStyle = 'rgba(80,10,10,.25)'; g.fillRect(-620 * rp + 10, -78, 1240 * rp, 160);
    g.fillStyle = C.red;
    g.beginPath(); g.moveTo(-620 * rp, -84);
    for (let x = -620; x <= 620; x += 40) g.lineTo(x * rp, -84 + (hash(x) - .5) * 10);
    for (let x = 620; x >= -620; x -= 40) g.lineTo(x * rp, 76 + (hash(x + 5) - .5) * 10);
    g.fill(); g.restore();
  }
  text(g, 'THIS CHRISTMAS', {
    x: CX, y: 168, size: 120, fill: C.paper, seed: 21, track: 0.06,
    shadow: { x: 5, y: 7, color: 'rgba(60,0,0,.5)' },
    anim: (i) => settle(b, 8.3 + i * 0.06, { dur: 0.8, rise: 30, rot: 0.15, seed: i + 3 }),
  });
  POLAROIDS.forEach(P => polaroid(g, P, b));
  spr(g, S.heart[0], 540, 900, 90 * soft(b, 10.2), -0.3);
  spr(g, S.cstarY, 1380, 900, 100 * soft(b, 11.7), 0.2 + t * 0.1);
  spr(g, S.gem, 1810, 360, 120 * soft(b, 13), Math.sin(t) * 0.1);
  g.restore();
  script(g, 'a day to bring everyone together', CX, 985, 70, C.red, b, 13.4, 15, { shadow: 'rgba(120,40,20,.25)' });
}

// ------------------------------------------------------------------ panel 3: the diorama
const TAGS = [
  { w: 'GAMES', x: 270, y: 170, bs: 17, r: -0.06 },
  { w: 'FUN ACTIVITIES', x: 820, y: 150, bs: 18.5, r: 0.03 },
  { w: 'ENTERTAINMENT', x: 1480, y: 175, bs: 20, r: -0.04 },
  { w: 'LAUGHTER', x: 560, y: 320, bs: 21.5, r: 0.05 },
  { w: 'FESTIVE VIBES', x: 1180, y: 325, bs: 23, r: -0.03 },
];
function tag(g, T, b, i) {
  const x = (b - T.bs) * BEAT;
  if (x <= 0) return;
  const s = spring(x, 1.3, 5);
  const sw = Math.sin(b * BEAT * 1.8 + i) * 0.04 + Math.exp(-x * 3) * Math.sin(x * 10) * 0.18;
  const Ls = B.layout(T.w, 'cut', 50, 0.05), tw = Ls.width + 90, th = 104;
  g.save(); g.translate(T.x, T.y - (1 - clamp(s)) * 60); g.rotate(T.r + sw); g.scale(clamp(s, 0, 1.2), clamp(s, 0, 1.2));
  g.strokeStyle = C.cream; g.lineWidth = 2; g.beginPath(); g.moveTo(0, -th / 2 - 4); g.lineTo(0, -th / 2 - 120); g.stroke();
  g.fillStyle = 'rgba(20,0,0,.3)'; g.beginPath();
  const shape = (ox, oy) => {
    g.beginPath(); g.moveTo(-tw / 2 + 30 + ox, -th / 2 + oy); g.lineTo(tw / 2 + ox, -th / 2 + oy); g.lineTo(tw / 2 + ox, th / 2 + oy);
    g.lineTo(-tw / 2 + 30 + ox, th / 2 + oy); g.lineTo(-tw / 2 + ox, oy); g.closePath();
  };
  shape(8, 10); g.fill();
  shape(0, 0); g.fillStyle = C.cream; g.fill();
  g.fillStyle = '#3A1010'; g.beginPath(); g.arc(-tw / 2 + 26, 0, 8, 0, TAU); g.fill();
  text(g, T.w, { x: 16, y: 2, size: 50, fill: i % 2 ? C.holly : C.red, seed: 60 + i, track: 0.05, jit: 0.025,
    anim: (j) => settle(b, T.bs + 0.1 + j * 0.025, { dur: 0.5, rise: 12, rot: 0.1, seed: j }) });
  g.restore();
}
function panelDiorama(g, b) {
  const t = b * BEAT;
  const pan = E.inOutSine(inv(15, 24, b)); // parallax travel across the panel
  const sky = g.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, '#2A0714'); sky.addColorStop(0.55, '#8A1E22'); sky.addColorStop(0.85, '#E0683A'); sky.addColorStop(1, '#FCBD3F');
  g.fillStyle = sky; g.fillRect(-60, -60, W + 120, H + 120);
  // stars + paper moon
  const r = rng(3);
  for (let i = 0; i < 60; i++) {
    const x = r() * W, y = r() * 520, k = 0.5 + 0.5 * Math.sin(t * (1 + r() * 2) + i);
    g.fillStyle = `rgba(255,240,210,${0.25 + 0.6 * k})`; g.beginPath(); g.arc(x - pan * 40, y, 1.5 + r() * 2, 0, TAU); g.fill();
  }
  g.fillStyle = C.cream; g.beginPath(); g.arc(1640 - pan * 60, 470, 70, 0, TAU); g.fill();
  g.fillStyle = 'rgba(0,0,0,.08)'; g.beginPath(); g.arc(1660 - pan * 60, 460, 60, 0, TAU); g.fill();
  hills(g, 700, 50, 0.004, 1, '#5A1420', null, pan * 200);
  bigTree(g, 470 - pan * 160, 800, 1.25, t);
  hills(g, 800, 30, 0.006, 4, '#3E0E18', 'rgba(255,190,120,.25)', pan * 420);
  // stalls on the mid layer
  const mid = -pan * 380;
  stall(g, 980 + mid, 900, 300, 330, C.red, C.cream, t, C.gold);
  stall(g, 1370 + mid, 915, 280, 300, C.holly, C.cream, t, C.red);
  stall(g, 1760 + mid, 905, 300, 320, C.gold, C.red, t, C.holly);
  stall(g, 2150 + mid, 915, 280, 300, C.sky, C.cream, t, C.pink);
  bunting(g, 780 + mid, 560, 2300 + mid, 580, 90, 22, t);
  fairyLights(g, -60, 600 + 20, W + 60, 610, 80, 22, t, { phase: 2, sway: 6, size: 0.8 });
  // front ground layer
  hills(g, 960, 18, 0.008, 7, '#0E4A2B', 'rgba(161,193,129,.6)', pan * 700);
  // balloons drifting up across the panel
  const rb = rng(17);
  for (let i = 0; i < 9; i++) {
    const x = rb() * W, st = 16 + rb() * 7, sp = 90 + rb() * 60, k = i % 6, sz = 90 + rb() * 60;
    const dt = (b - st) * BEAT;
    if (dt <= 0) continue;
    const y = 1150 - dt * sp, sx = x - pan * 300 + Math.sin(dt * 1.4 + i) * 20;
    g.strokeStyle = 'rgba(255,255,255,.5)'; g.lineWidth = 2; g.beginPath(); g.moveTo(sx, y + sz * 0.5); g.lineTo(sx + 6, y + sz * 1.4); g.stroke();
    spr(g, S.balloon[k], sx, y, sz, Math.sin(dt + i) * 0.1);
  }
  sparkles(g, t, 16, 71, { area: [0, 0, W, 560], size: 26, col: 'gold' });
  // warm haze
  const hz = g.createLinearGradient(0, 700, 0, H); hz.addColorStop(0, 'rgba(255,170,90,0)'); hz.addColorStop(1, 'rgba(255,170,90,.18)');
  g.fillStyle = hz; g.fillRect(0, 700, W, H - 700);
  TAGS.forEach((T, i) => tag(g, T, b, i));
}

// ------------------------------------------------------------------ panel 4: the invitation
function envelope(g, b, cx, cy) {
  const ew = 1060, eh = 620;
  const open = E.inOutCubic(inv(24.2, 25, b));        // flap: 1 closed … -1 open
  const out = E.inOutCubic(inv(26.4, 27.4, b));       // envelope drops away
  const cardUp = E.inOutCubic(inv(25, 26.4, b));
  const ey = cy + out * 1400;
  const flapK = 1 - 2 * open;
  const card = { y: lerp(cy + 40, cy - 300, cardUp) };
  // back of the envelope
  g.save(); g.translate(cx, ey);
  g.fillStyle = 'rgba(20,0,0,.35)'; g.fillRect(-ew / 2 + 16, -eh / 2 + 26, ew, eh);
  g.fillStyle = '#E8D9B8'; g.fillRect(-ew / 2, -eh / 2, ew, eh);
  // flap when open sits behind the card
  if (flapK < 0) {
    g.fillStyle = '#DCC9A0'; g.beginPath(); g.moveTo(-ew / 2, -eh / 2); g.lineTo(ew / 2, -eh / 2); g.lineTo(0, -eh / 2 + flapK * eh * 0.55); g.closePath(); g.fill();
  }
  g.restore();
  return { card, draw: () => { // front pocket + closed flap drawn after the card
    g.save(); g.translate(cx, ey);
    g.fillStyle = '#F2E6CA';
    g.beginPath(); g.moveTo(-ew / 2, -eh / 2 + 40); g.lineTo(0, eh * 0.08); g.lineTo(ew / 2, -eh / 2 + 40); g.lineTo(ew / 2, eh / 2); g.lineTo(-ew / 2, eh / 2); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(120,80,40,.2)'; g.lineWidth = 3; g.stroke();
    g.fillStyle = C.red; g.fillRect(-ew / 2, eh / 2 - 26, ew, 10); g.fillStyle = C.gold; g.fillRect(-ew / 2, eh / 2 - 12, ew, 6);
    if (flapK >= 0) {
      g.fillStyle = '#E3D2AC'; g.beginPath(); g.moveTo(-ew / 2, -eh / 2); g.lineTo(ew / 2, -eh / 2); g.lineTo(0, -eh / 2 + flapK * eh * 0.55); g.closePath(); g.fill();
      g.strokeStyle = 'rgba(120,80,40,.25)'; g.stroke();
    }
    // wax seal pops off as it opens
    const seal = inv(24, 24.5, b);
    if (seal < 1) {
      const sy = -eh / 2 + eh * 0.55 * Math.max(flapK, 0) - 10 - seal * 120, sa = 1 - seal;
      g.save(); g.globalAlpha = sa; g.translate(0, sy); g.rotate(seal * 1.5); g.scale(1 + seal * 0.4, 1 + seal * 0.4);
      g.fillStyle = C.maroon; g.beginPath();
      for (let i = 0; i < 14; i++) { const a = i / 14 * TAU, rr = 62 + (i % 2) * 6; g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } g.fill();
      g.fillStyle = C.red; g.beginPath(); g.arc(0, 0, 48, 0, TAU); g.fill();
      heartSeal(g);
      g.restore();
    }
    g.restore();
  } };
}
function heartSeal(g) { g.save(); g.translate(-26, -28); g.scale(0.52, 0.52); B.ICON.heart(g, C.gold); g.restore(); }
function inviteCard(g, b, cx, cy, s) {
  const cw = 980, ch = 660;
  g.save(); g.translate(cx, cy); g.scale(s, s);
  g.fillStyle = 'rgba(20,0,0,.35)'; g.fillRect(-cw / 2 + 18, -ch / 2 + 26, cw, ch);
  g.fillStyle = C.paper; g.fillRect(-cw / 2, -ch / 2, cw, ch);
  g.globalAlpha = 0.25; g.drawImage(PAPER_TILE(), -cw / 2, -ch / 2, cw, ch); g.globalAlpha = 1;
  g.strokeStyle = C.gold; g.lineWidth = 6; g.strokeRect(-cw / 2 + 26, -ch / 2 + 26, cw - 52, ch - 52);
  g.lineWidth = 2; g.strokeStyle = C.red; g.strokeRect(-cw / 2 + 40, -ch / 2 + 40, cw - 80, ch - 80);
  g.font = '44px Quintessential'; g.textAlign = 'center'; g.textBaseline = 'middle';
  const a0 = inv(26, 26.6, b);
  g.fillStyle = C.red; g.globalAlpha = a0; g.fillText('you are warmly invited to the', 0, -228); g.globalAlpha = 1;
  text(g, 'BUNDLE OF BRAVE', { x: 0, y: -140, size: 88, fill: C.ink, seed: 81, track: 0.04, jit: 0.03,
    anim: (i) => settle(b, 26.3 + i * 0.03, { dur: 0.7, rise: 20, rot: 0.12, seed: i }) });
  const sweep = inv(30, 31, b);
  text(g, 'FETE', { x: 0, y: 30, size: 250, fill: C.gold, seed: 83, track: 0.05,
    extrude: { n: 12, dx: 0.6, dy: 1.3, color: '#8C4F07' }, outline: { w: 6, color: C.red }, shadow: { x: 10, y: 22, color: 'rgba(80,20,0,.25)' },
    gloss: (i) => {
      if (sweep <= 0 || sweep >= 1) return null;
      const gx = lerp(-3, 3, sweep) - (i - 1.5) * 0.9;
      const gr = g.createLinearGradient(gx - 0.35, -0.5, gx + 0.35, 0.5);
      gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.8)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      return gr;
    },
    anim: (i) => {
      const x = (b - (27 + i * 0.12)) * BEAT;
      if (x <= 0) return null;
      const k = spring(x, 1.6, 6);
      return { s: lerp(1.6, 1, clamp(k, 0, 1.15)), a: clamp(x * 5), y: (1 - clamp(k)) * -40 };
    } });
  text(g, 'COMING THIS CHRISTMAS', { x: 0, y: 190, size: 54, fill: C.red, seed: 85, track: 0.08, jit: 0.02,
    anim: (i) => settle(b, 28 + i * 0.025, { dur: 0.6, rise: 16, rot: 0.1, seed: i }) });
  const pa = inv(28.8, 29.6, b);
  g.globalAlpha = pa; g.font = '46px Quintessential'; g.fillStyle = C.maroon; g.fillText('presented by Bundle of Brave', 0, 262); g.globalAlpha = 1;
  spr(g, S.gem, cw / 2 - 40, -ch / 2 + 30, 150 * soft(b, 27.8), 0.2 + Math.sin(b * BEAT) * 0.05);
  spr(g, S.strawberry, -cw / 2 + 20, ch / 2 - 40, 170 * soft(b, 28.3), -0.25);
  spr(g, S.cstarB, -cw / 2 + 40, -ch / 2 + 50, 100 * soft(b, 28.6), b * 0.2);
  g.restore();
}
let paperTile = null;
function PAPER_TILE() {
  if (paperTile) return paperTile;
  paperTile = B.mkCanvas(512, 346); const p = paperTile.getContext('2d'), r = rng(5);
  for (let i = 0; i < 900; i++) { p.strokeStyle = r() > .5 ? 'rgba(160,120,80,.25)' : 'rgba(255,255,255,.5)'; p.lineWidth = r();
    const x = r() * 512, y = r() * 346, a = r() * TAU, l = 6 + r() * 20; p.beginPath(); p.moveTo(x, y); p.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); p.stroke(); }
  return paperTile;
}
function panelInvite(g, b) {
  const t = b * BEAT;
  radialBg(g, '#B8141F', '#3A0509', CX, 480);
  sunburst(g, CX, 460, 24, t * 0.05, C.gold, 0.07);
  fairyLights(g, -60, -10, W + 60, -10, 110, 20, t, { phase: 4, sway: 6, size: 0.9 });
  sparkles(g, t, 26, 91, { size: 30, col: 'gold' });
  drawConfetti(g, t, B0 => B0.t0 >= 23.9 * BEAT);
  const env = envelope(g, b, CX, 640);
  const lift = E.inOutCubic(inv(26.4, 27.6, b));
  const cy = lerp(env.card.y, 555, lift), s = lerp(0.9, 1.05, lift);
  if (b >= 24.9) inviteCard(g, b, CX, cy, s);
  env.draw();
  spr(g, S.teddy, 1640, lerp(1300, 900, E.outCubic(inv(28.4, 29.4, b))), 280, 0.1 + Math.sin(t * 1.6) * 0.05);
  flash(g, (1 - inv(30, 30.35, b)) * 0.35 * (b >= 30), '255,240,210');
}

// ------------------------------------------------------------------ timeline
const PANELS = [
  { b0: 0, b1: 8, fn: panelWish },
  { b0: 8, b1: 16, fn: panelScrapbook },
  { b0: 16, b1: 24, fn: panelDiorama },
  { b0: 24, b1: 33, fn: panelInvite },
];
// camera moves between panels like turning through a scrapbook
const MOVES = [
  { b0: 7, b1: 8.1, dx: 1, dy: 0 },
  { b0: 15, b1: 16.1, dx: 1, dy: 0 },
  { b0: 23, b1: 24.1, dx: 0, dy: 1 },
];
function panelAt(b) { for (const P of PANELS) if (b >= P.b0 && b < P.b1) return P; return PANELS[PANELS.length - 1]; }
function draw(g, t) {
  const b = t / BEAT;
  g.save();
  g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
  // slow handheld float
  g.translate(Math.sin(t * 0.7) * 4, Math.cos(t * 0.53) * 3);
  let M = null;
  for (const m of MOVES) if (b >= m.b0 && b < m.b1) M = m;
  if (M) {
    const p = E.inOutCubic(inv(M.b0, M.b1, b));
    const from = panelAt(M.b0 - 0.001), to = panelAt(M.b1);
    const z = 1 - 0.1 * Math.sin(Math.PI * p);           // pull back mid-move
    g.translate(CX, CY); g.scale(z, z); g.translate(-CX, -CY);
    g.save(); g.translate(-p * W * M.dx, -p * H * M.dy); from.fn(g, b); g.restore();
    g.save(); g.translate((1 - p) * W * M.dx, (1 - p) * H * M.dy); to.fn(g, b); g.restore();
    // paper edge shadow between the pages
    g.fillStyle = 'rgba(40,10,5,.35)';
    if (M.dx) g.fillRect((1 - p) * W - 14, -200, 14, H + 400); else g.fillRect(-200, (1 - p) * H - 14, W + 400, 14);
  } else panelAt(b).fn(g, b);
  g.restore();
  overlayTextures(g, t);
  // soft fade-up at the start and settle at the end
  flash(g, 1 - inv(0, 0.6, b), '242,239,231');
}

window.ready = window.ready.then(() => {
  BURSTS.length = 0;
  addBurst(24.2, CX, -80, Math.PI / 2, 2.6, 500, 220, 21, { g: 260, life: 12 });
  addBurst(30, CX, -80, Math.PI / 2, 2.8, 700, 240, 22, { g: 260, life: 8 });
  B.draw = draw;
  window.TEASER = { W, H, DUR, BEAT };
  window.renderFrame(0);
  if (location.search.includes('play')) {
    document.body.classList.add('preview');
    const audio = new Audio('../build/invite-music.wav');
    let on = false;
    const loop = () => { if (on) window.renderFrame(Math.min(audio.currentTime, DUR - 0.001)); requestAnimationFrame(loop); };
    document.body.addEventListener('click', () => { audio.currentTime = 0; audio.play(); on = true; });
    requestAnimationFrame(loop);
  }
  return true;
});
})();
