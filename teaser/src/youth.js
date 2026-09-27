/* Bundle of Brave Fete — "christmas plans" (20 s, 9:16, for 16–25s).
 *
 * A group chat can't decide on christmas. Someone drops a link; it opens into a
 * riso-printed gig-poster lineup. Back in the chat, one quiet line about the
 * cause. Everyone's "in." The group gets renamed. End card: christmas plans: sorted.
 *
 * Score: tools/compose_youth.py — 120 BPM, 40 beats = 20 s. Timed in beats.
 */
(() => {
'use strict';
const B = window.BOB;
const { C, clamp, lerp, inv, E, spring, rng, hash, noise1, rrect, starPath, text, mkCanvas } = B;
const W = 1080, H = 1920, CX = W / 2, TAU = Math.PI * 2;
const BPM = 120, BEAT = 60 / BPM, DUR = 20;

const K = {
  bg: '#141011', bar: '#1C1718', recv: '#2A2324', sent: C.red, txt: '#F2EFE7', dim: '#8E8383',
  red: C.red, maroon: C.maroon, paper: C.paper, ink: C.ink, pink: C.pink, sun: C.sun, gold: C.gold, sky: C.sky,
};
const WHO = { kabir: C.sky, mia: C.pink, aarav: C.sun, zoe: C.orange, you: C.red };

const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');

// ------------------------------------------------------------------ chat script
const MSGS = [
  { b: 0, who: 'kabir', t: 'ok christmas plans' },
  { b: 0.5, who: 'mia', t: 'not another house party' },
  { b: 1, who: 'aarav', t: "i'm NOT hosting" },
  { b: 1.5, who: 'zoe', t: 'someone decide' },
  { b: 2, who: 'kabir', t: '??' },
  { b: 2.5, who: 'mia', t: 'hello??' },
  { b: 3, who: 'you', type: 'typing', until: 5 },
  { b: 5, who: 'you', type: 'link', reacts: [[5.5, 'heart'], [5.75, '!!']] },
  { b: 6.25, who: 'zoe', t: 'wait what is this' },
  { b: 7, who: 'you', t: 'just open it' },
  // b 8–20: the poster
  { b: 20.5, who: 'aarav', t: "ok but what's bundle of brave?" },
  { b: 21, who: 'you', type: 'typing', until: 22 },
  { b: 22, who: 'you', t: 'youth-led. they fulfil the last wishes of kids with terminal cancer.', key: 'cause', reacts: [[24, 'heart']] },
  { b: 26, who: 'kabir', t: "ok i'm in" },
  { b: 27, who: 'mia', t: 'in.' },
  { b: 28, who: 'zoe', t: 'in.' },
  { b: 29, who: 'aarav', t: 'in. bringing my cousins' },
  { b: 29.5, who: 'kabir', t: 'finally, a plan' },
  { b: 31, type: 'sys', t: 'you renamed the group "bundle of brave fete"' },
];

const UI = '600 44px "Inter Tight"', NAME = '600 27px "Inter Tight"';
const MAXW = 640, LINE = 56, PADX = 34, PADY = 24, GAP = 14;
function wrap(g, str, maxw) {
  const words = str.split(' '), lines = [];
  let cur = '';
  for (const w of words) {
    const test = cur ? cur + ' ' + w : w;
    if (g.measureText(test).width > maxw && cur) { lines.push(cur); cur = w; } else cur = test;
  }
  if (cur) lines.push(cur);
  return lines;
}
function measure(g) {
  g.font = UI;
  let prev = null;
  for (const m of MSGS) {
    if (m.type === 'link') { m.w = 700; m.h = 560; }
    else if (m.type === 'typing') { m.w = 150; m.h = 96; }
    else if (m.type === 'sys') { m.w = W; m.h = 84; }
    else {
      m.lines = wrap(g, m.t, MAXW - PADX * 2);
      m.w = Math.max(...m.lines.map(l => g.measureText(l).width)) + PADX * 2;
      m.h = m.lines.length * LINE + PADY * 2;
    }
    m.named = m.who !== 'you' && m.type !== 'sys' && (!prev || prev.who !== m.who || prev.type === 'typing');
    m.full = m.h + (m.named ? 38 : 0) + (m.reacts ? 30 : 0);
    if (m.type !== 'typing') prev = m;
  }
}

// ------------------------------------------------------------------ helpers
function heart(g, x, y, s, col) {
  g.save(); g.translate(x, y); g.scale(s / 100, s / 100); g.translate(-50, -50);
  g.fillStyle = col; g.beginPath(); g.moveTo(50, 88);
  g.bezierCurveTo(-6, 50, 18, -4, 50, 26); g.bezierCurveTo(82, -4, 106, 50, 50, 88); g.fill();
  g.restore();
}
function popIn(b, bs, dur = 0.35) {
  const x = (b - bs) * BEAT;
  if (x <= 0) return 0;
  return spring(x, 2.4, 9);
}
function fitFont(g, str, font, maxw, cap) {
  g.font = `100px ${font}`;
  const w = g.measureText(str).width;
  return Math.min(cap, 100 * maxw / w);
}

// ------------------------------------------------------------------ textures
let GRAIN, DOTS;
function buildTextures() {
  const r = rng(77);
  GRAIN = mkCanvas(512, 512);
  const q = GRAIN.getContext('2d'), gd = q.createImageData(512, 512);
  for (let i = 0; i < gd.data.length; i += 4) { const v = r() * 255; gd.data[i] = gd.data[i + 1] = gd.data[i + 2] = v; gd.data[i + 3] = 255; }
  q.putImageData(gd, 0, 0);
  DOTS = mkCanvas(24, 24);
  const d = DOTS.getContext('2d'); d.fillStyle = '#000'; d.beginPath(); d.arc(12, 12, 4.2, 0, TAU); d.fill();
}
function grain(g, t, a = 0.08) {
  g.save(); g.globalCompositeOperation = 'overlay'; g.globalAlpha = a;
  const f = Math.floor(t * 30), pat = g.createPattern(GRAIN, 'repeat');
  pat.setTransform(new DOMMatrix().translate((hash(f) * 512) | 0, (hash(f + 9) * 512) | 0));
  g.fillStyle = pat; g.fillRect(0, 0, W, H); g.restore();
}
function halftone(g, a, rot = 0.26) {
  g.save(); g.globalAlpha = a; g.globalCompositeOperation = 'multiply';
  const pat = g.createPattern(DOTS, 'repeat'); pat.setTransform(new DOMMatrix().rotate(rot * 57.3));
  g.fillStyle = pat; g.fillRect(0, 0, W, H); g.restore();
}

// ------------------------------------------------------------------ chat rendering
const TOP = 250, BOTTOM = H - 410;
function statusBar(g) {
  g.fillStyle = K.txt; g.font = '600 34px "Inter Tight"'; g.textBaseline = 'middle'; g.textAlign = 'left';
  g.fillText('9:41', 70, 62);
  g.fillStyle = K.txt; rrect(g, W - 150, 48, 68, 30, 8); g.fill(); g.fillStyle = K.bg; rrect(g, W - 146, 52, 50, 22, 5); g.fill();
  g.fillStyle = K.txt; g.fillRect(W - 80, 57, 5, 12);
  for (let i = 0; i < 4; i++) g.fillRect(W - 230 + i * 14, 72 - i * 7, 9, 8 + i * 7);
}
function header(g, b) {
  g.fillStyle = K.bar; g.fillRect(0, 0, W, 230);
  g.fillStyle = 'rgba(255,255,255,.06)'; g.fillRect(0, 229, W, 2);
  statusBar(g);
  g.strokeStyle = K.txt; g.lineWidth = 6; g.lineCap = 'round'; g.lineJoin = 'round';
  g.beginPath(); g.moveTo(70, 132); g.lineTo(48, 158); g.lineTo(70, 184); g.stroke();
  // group avatar: flips to a ransom-note B when renamed
  const rn = E.inOutCubic(inv(31, 31.6, b));
  g.save(); g.translate(150, 158); g.scale(1, Math.abs(Math.cos(rn * Math.PI)) || 0.001);
  if (rn < 0.5) {
    const cols = [C.sky, C.pink, C.sun, C.orange];
    cols.forEach((c, i) => { g.fillStyle = c; g.beginPath(); g.arc(-14 + (i % 2) * 28, -14 + ((i / 2) | 0) * 28, 17, 0, TAU); g.fill(); });
  } else {
    g.fillStyle = K.red; g.beginPath(); g.arc(0, 0, 44, 0, TAU); g.fill();
    text(g, 'B', { x: 0, y: 2, size: 56, fill: K.paper, seed: 3, wob: 0.15 });
  }
  g.restore();
  // title swap
  g.save(); g.beginPath(); g.rect(210, 105, 820, 110); g.clip();
  const oldY = lerp(0, -80, rn), newY = lerp(80, 0, rn);
  g.textAlign = 'left'; g.textBaseline = 'middle';
  g.globalAlpha = 1 - rn;
  g.fillStyle = K.txt; g.font = '600 42px "Inter Tight"'; g.fillText('christmas plans', 220, 140 + oldY);
  g.fillStyle = K.dim; g.font = '500 28px "Inter Tight"'; g.fillText('aarav, kabir, mia, zoe, you', 220, 186 + oldY);
  g.globalAlpha = rn;
  if (rn > 0) {
    text(g, 'BUNDLE OF BRAVE FETE', { x: 220 + 330, y: 140 + newY, size: 40, fill: (i) => (i % 5 === 0 ? K.paper : K.ink), seed: 51, track: 0.12, wob: 0.08,
      tile: { colors: [K.red, K.paper, C.sun, K.paper, K.sky], pad: 0.22 } });
    g.fillStyle = K.dim; g.font = '500 28px "Inter Tight"'; g.fillText('aarav, kabir, mia, zoe, you', 220, 190 + newY);
  }
  g.restore();
}
function inputBar(g) {
  g.fillStyle = K.bar; g.fillRect(0, H - 380, W, 380);
  g.fillStyle = '#2A2324'; rrect(g, 60, H - 350, W - 220, 96, 48); g.fill();
  g.fillStyle = K.dim; g.font = '500 38px "Inter Tight"'; g.textAlign = 'left'; g.textBaseline = 'middle'; g.fillText('message', 110, H - 302);
  g.fillStyle = K.red; g.beginPath(); g.arc(W - 100, H - 302, 48, 0, TAU); g.fill();
  g.strokeStyle = K.paper; g.lineWidth = 7; g.lineCap = 'round'; g.lineJoin = 'round';
  g.beginPath(); g.moveTo(W - 100, H - 280); g.lineTo(W - 100, H - 324); g.moveTo(W - 118, H - 306); g.lineTo(W - 100, H - 324); g.lineTo(W - 82, H - 306); g.stroke();
}
function linkCard(g, x, y, w, h, b, local = false) {
  // x,y = top-left. image area (brand) + meta area
  const ih = 340;
  g.save();
  rrect(g, x, y, w, h, 34); g.clip();
  g.fillStyle = '#2A2324'; g.fillRect(x, y, w, h);
  posterThumb(g, x, y, w, ih, b);
  g.fillStyle = K.txt; g.font = '600 40px "Inter Tight"'; g.textAlign = 'left'; g.textBaseline = 'middle';
  g.fillText('bundle of brave fete', x + 34, y + ih + 58);
  g.fillStyle = K.dim; g.font = '500 30px "Inter Tight"';
  g.fillText('coming this christmas', x + 34, y + ih + 110);
  g.fillText('presented by bundle of brave', x + 34, y + ih + 152);
  g.restore();
  return { x, y, w, h: ih };
}
function posterThumb(g, x, y, w, h, b) {
  g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip();
  g.fillStyle = K.red; g.fillRect(x, y, w, h);
  text(g, 'BUNDLE OF BRAVE', { x: x + w / 2, y: y + h * 0.36, size: 46, fill: (i) => (i % 4 === 1 ? K.red : K.ink), seed: 21, track: 0.14, wob: 0.09,
    tile: { colors: [K.paper, C.sun, K.paper, C.pink, K.paper, K.sky], pad: 0.2 } });
  g.font = `italic 96px "Instrument Serif"`; g.fillStyle = K.paper; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('fete', x + w / 2, y + h * 0.7);
  g.restore();
}
function bubble(g, m, x, y, s, b) {
  // x = anchor side edge, y = top of bubble
  const sent = m.who === 'you';
  const bx = sent ? x - m.w : x;
  g.save();
  const ox = sent ? x : x, oy = y + m.h;
  g.translate(ox, oy); g.scale(s, s); g.translate(-ox, -oy);
  if (m.type === 'typing') {
    g.fillStyle = K.recv; rrect(g, bx, y, m.w, m.h, 48); g.fill();
    for (let i = 0; i < 3; i++) {
      const k = 0.5 + 0.5 * Math.sin(b * Math.PI * 2 - i * 0.9);
      g.fillStyle = `rgba(242,239,231,${0.35 + 0.5 * k})`; g.beginPath(); g.arc(bx + 42 + i * 33, y + 48 - k * 8, 11, 0, TAU); g.fill();
    }
  } else if (m.type === 'link') {
    linkCard(g, bx, y, m.w, m.h, b);
  } else {
    g.fillStyle = sent ? K.sent : K.recv; rrect(g, bx, y, m.w, m.h, 40); g.fill();
    g.fillStyle = K.txt; g.font = UI; g.textAlign = 'left'; g.textBaseline = 'middle';
    m.lines.forEach((l, i) => g.fillText(l, bx + PADX, y + PADY + LINE / 2 + i * LINE + 2));
  }
  // reactions
  if (m.reacts) {
    let rx = sent ? bx + 30 : bx + m.w - 40;
    m.reacts.forEach(([rb, kind], i) => {
      const p = popIn(b, rb);
      if (p <= 0) return;
      const cx = rx + (sent ? i * 70 : -i * 70), cy = y + m.h + 6;
      g.save(); g.translate(cx, cy); g.scale(p, p);
      g.fillStyle = '#3A3132'; rrect(g, -32, -26, 64, 52, 26); g.fill();
      g.strokeStyle = K.bg; g.lineWidth = 5; g.stroke();
      if (kind === 'heart') heart(g, 0, 1, 36, m.key === 'cause' ? K.gold : K.red);
      else { g.fillStyle = K.sun; g.font = '900 30px "Inter Tight"'; g.textAlign = 'center'; g.fillText(kind, 0, 2); }
      g.restore();
    });
  }
  g.restore();
}
/* lays out and draws the chat at beat b. returns rects of special items. */
function drawChat(g, b) {
  g.fillStyle = K.bg; g.fillRect(0, 0, W, H);
  const out = {};
  const vis = MSGS.filter(m => b >= m.b && !(m.type === 'typing' && b >= m.until));
  let cursor = BOTTOM;
  const placed = [];
  for (let i = vis.length - 1; i >= 0; i--) {
    const m = vis[i];
    let grow = E.outCubic(inv(m.b, m.b + 0.3, b));
    if (m.type === 'typing') grow *= 1 - E.outCubic(inv(m.until - 0.15, m.until, b));
    const h = m.full * grow;
    const top = cursor - h;
    placed.push({ m, top, grow });
    cursor = top - GAP * grow;
    if (cursor < -600) break;
  }
  g.save(); g.beginPath(); g.rect(0, 230, W, H - 230 - 380); g.clip();
  for (const { m, top, grow } of placed) {
    const s = clamp(popIn(b, m.b), 0, 1.15) * (m.type === 'typing' ? grow : 1);
    if (s <= 0.001) continue;
    if (m.type === 'sys') {
      g.globalAlpha = grow; g.fillStyle = K.dim; g.font = '500 30px "Inter Tight"'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(m.t, CX, top + m.h / 2); g.globalAlpha = 1; continue;
    }
    let y = top;
    if (m.named) {
      g.fillStyle = WHO[m.who]; g.font = NAME; g.textAlign = 'left'; g.textBaseline = 'middle';
      g.globalAlpha = clamp(s); g.fillText(m.who, 74, y + 16); g.globalAlpha = 1; y += 38;
    }
    const x = m.who === 'you' ? W - 50 : 50;
    const item = { m, x, y, s };
    if (m.type === 'link') out.card = { x: x - m.w, y, w: m.w, h: 340 };
    if (m.key) out[m.key] = item;
    bubble(g, m, x, y, s, b);
  }
  g.restore();
  return out;
}
function chatFrame(g, b) {
  const t = b * BEAT;
  // haptic shake as the hook messages land
  let sx = 0;
  for (const hb of [0, 0.5, 1, 1.5, 2, 2.5, 5]) {
    const d = (b - hb) * BEAT;
    if (d >= 0 && d < 0.25) sx += Math.sin(d * 140) * 9 * Math.exp(-d * 18);
  }
  g.save(); g.translate(sx, 0);
  const R = drawChat(g, b);
  // the quiet beat: everything but the cause line recedes
  const dim = clamp(inv(22.3, 23, b) - inv(25.4, 26, b));
  if (dim > 0 && R.cause) {
    g.fillStyle = `rgba(10,6,7,${0.75 * dim})`; g.fillRect(0, 0, W, H);
    const c = R.cause;
    g.save(); g.beginPath(); g.rect(0, 230, W, H - 610); g.clip();
    bubble(g, c.m, c.x, c.y, c.s, b); g.restore();
  }
  header(g, b);
  inputBar(g);
  // hook overlay: POV label on a strip of paper
  const pv = popIn(b, 0.25) * (1 - E.inCubic(inv(4.5, 5, b)));
  if (pv > 0.01) {
    g.save(); g.translate(CX, 420); g.rotate(-0.04); g.scale(pv, pv);
    g.fillStyle = 'rgba(0,0,0,.4)'; g.fillRect(-460 + 10, -70 + 12, 920, 140);
    g.fillStyle = K.paper; g.fillRect(-460, -70, 920, 140);
    g.fillStyle = 'rgba(251,237,195,.7)'; g.save(); g.rotate(0.3); g.fillRect(-500, -20, 120, 40); g.restore();
    text(g, 'POV: YOUR GROUP CHAT', { x: 0, y: 4, size: 54, fill: (i) => (i < 4 ? K.red : K.ink), seed: 9, track: 0.05, wob: 0.07 });
    g.restore();
  }
  g.restore();
  return R;
}

// ------------------------------------------------------------------ the poster
const LINEUP = [
  { w: 'games', bs: 9 }, { w: 'fun activities', bs: 11 }, { w: 'entertainment', bs: 13 },
  { w: 'laughter', bs: 15 }, { w: 'festive vibes', bs: 17 },
];
let lineupLayout = null;
function layoutLineup(g) {
  let y = 480;
  lineupLayout = LINEUP.map((L, i) => {
    const size = fitFont(g, L.w, '"Archivo Black"', 930, 300);
    const top = y; y += size * 0.86 + 26;
    return { ...L, size, top, i };
  });
}
function riso(g, str, x, y, font, b, bs, { ink = K.paper, a = 1, align = 'left' } = {}) {
  const d = (b - bs) * BEAT;
  if (d <= 0) return;
  const k = 0.18 + 0.82 * Math.exp(-d * 7) * Math.cos(d * 18) ** 2;
  g.font = font; g.textAlign = align; g.textBaseline = 'alphabetic';
  g.save(); g.globalAlpha = a;
  g.globalCompositeOperation = 'source-over';
  g.fillStyle = K.pink; g.fillText(str, x + 16 * k, y - 10 * k);
  g.fillStyle = K.sun; g.fillText(str, x - 12 * k, y + 9 * k);
  g.fillStyle = ink; g.fillText(str, x, y);
  g.restore();
}
function poster(g, b) {
  const t = b * BEAT;
  g.fillStyle = K.red; g.fillRect(0, 0, W, H);
  const z = 1 + 0.025 * inv(8, 20, b);
  g.save(); g.translate(CX, H / 2); g.scale(z, z); g.translate(-CX, -H / 2);
  // hairline 12-col grid, drawn on
  const gp = E.outCubic(inv(8, 9, b));
  g.strokeStyle = 'rgba(242,239,231,0.16)'; g.lineWidth = 2;
  for (let i = 0; i <= 12; i++) {
    const x = 75 + i * (930 / 12), len = H * clamp(gp * 1.4 - i * 0.03);
    g.beginPath(); g.moveTo(x, 0); g.lineTo(x, len); g.stroke();
  }
  // registration marks
  g.strokeStyle = 'rgba(242,239,231,0.7)'; g.lineWidth = 2.5;
  [[60, 250], [W - 60, 250], [60, H - 330], [W - 60, H - 330]].forEach(([x, y], i) => {
    const s = popIn(b, 8.3 + i * 0.1) * 22;
    g.beginPath(); g.moveTo(x - s, y); g.lineTo(x + s, y); g.moveTo(x, y - s); g.lineTo(x, y + s); g.stroke();
    g.beginPath(); g.arc(x, y, s * 0.55, 0, TAU); g.stroke();
  });
  // masthead: ransom-note brand + "presents"
  if (b >= 8.2) {
    text(g, 'BUNDLE OF BRAVE', { x: 75 + 290, y: 330, size: 52, fill: (i) => (i % 4 === 1 ? K.red : K.ink), seed: 31, track: 0.14, wob: 0.08,
      tile: { colors: [K.paper, C.sun, K.paper, C.pink, K.paper, K.sky], pad: 0.2 },
      anim: (i) => B.slap(b, 8.2 + i * 0.04, { seed: i, from: 1.8, rot: 0.3 }) });
    const pr = inv(8.8, 9.4, b);
    g.save(); g.globalAlpha = pr; g.fillStyle = K.paper; g.font = '500 36px "Space Grotesk"'; g.textAlign = 'left'; g.textBaseline = 'middle';
    g.fillText('presents', 700, 332); g.restore();
    g.fillStyle = 'rgba(242,239,231,.8)'; g.fillRect(75, 400, 930 * E.outCubic(inv(8.4, 9.2, b)), 3);
  }
  // the lineup: each line set to the full measure, riso misregistered
  lineupLayout.forEach((L) => {
    const d = (b - L.bs) * BEAT;
    if (d <= 0) return;
    const e = E.outExpo(clamp(d / 0.35));
    const base = L.top + L.size * 0.74;
    g.save(); g.beginPath(); g.rect(0, L.top - 30, W, L.size * 0.86 + 60); g.clip();
    g.translate(0, (1 - e) * L.size * 0.9);
    riso(g, L.w, 75, base, `${L.size}px "Archivo Black"`, b, L.bs);
    g.restore();
    // index + rule
    g.fillStyle = 'rgba(242,239,231,.75)'; g.fillRect(75, base + 22, 930 * E.outCubic(clamp(d / 0.5)), 2);
    g.globalAlpha = clamp(d / 0.3); g.font = '500 24px "JetBrains Mono"'; g.textAlign = 'right'; g.textBaseline = 'top';
    g.fillText('0' + (L.i + 1), 1005, base + 32); g.globalAlpha = 1;
  });
  // headline
  if (b >= 19) {
    const d = (b - 19) * BEAT, e = E.outExpo(clamp(d / 0.4));
    const y = 1455;
    g.save(); g.beginPath(); g.rect(0, y - 150, W * e, 200); g.clip();
    riso(g, 'this christmas', 75, y, 'italic 150px "Instrument Serif"', b, 19, { ink: K.gold });
    g.restore();
    const a = inv(19.2, 19.6, b);
    g.globalAlpha = a; g.fillStyle = K.paper; g.font = '500 28px "JetBrains Mono"'; g.textAlign = 'left'; g.textBaseline = 'middle';
    g.fillText('presented by bundle of brave', 75, 1540); g.globalAlpha = 1;
  }
  g.restore();
  halftone(g, 0.10);
}

// ------------------------------------------------------------------ end card
function tearPath(g, p, seed) { // jagged diagonal tear moving across the frame
  const r = rng(seed);
  const y0 = lerp(-400, H + 900, p);
  g.beginPath(); g.moveTo(-50, -50); g.lineTo(W + 50, -50);
  const pts = [];
  for (let x = W + 50; x >= -50; x -= 36) pts.push([x, y0 - (x / W) * 500 + (r() - .5) * 36]);
  pts.forEach(([x, y]) => g.lineTo(x, y));
  g.closePath();
  return pts;
}
function endCard(g, b) {
  const t = b * BEAT;
  g.fillStyle = K.paper; g.fillRect(0, 0, W, H);
  halftone(g, 0.06, 0.6);
  // hairline frame
  g.strokeStyle = 'rgba(57,49,49,.35)'; g.lineWidth = 2; g.strokeRect(50, 250, W - 100, 1330);
  const hit = 1 + 0.05 * Math.exp(-Math.max(0, (b - 36)) * BEAT * 7) * (b >= 36);
  g.font = '500 32px "JetBrains Mono"'; g.fillStyle = K.ink; g.textAlign = 'left'; g.textBaseline = 'middle';
  g.globalAlpha = inv(32, 32.4, b); g.fillText('re: christmas plans', 90, 320); g.globalAlpha = 1;
  const lines = [
    { s: 'BUNDLE OF', y: 520, size: 150, fill: K.ink, t0: 32 },
    { s: 'BRAVE', y: 720, size: 230, fill: K.ink, t0: 32.2 },
  ];
  lines.forEach((L, j) => text(g, L.s, { x: CX, y: L.y, size: L.size, fill: L.fill, seed: 71 + j, track: 0.02, wob: 0.05,
    anim: (i) => B.slap(b, L.t0 + i * 0.03, { seed: j * 10 + i, from: 1.5, rot: 0.2 }) }));
  g.save(); g.translate(CX, 990); g.scale(hit, hit);
  text(g, 'FETE', { x: 0, y: 0, size: 250, fill: (i) => [K.paper, K.red, K.paper, K.ink][i], seed: 81, track: 0.12, wob: 0.09,
    tile: { colors: [K.red, C.sun, K.ink, C.pink], pad: 0.24 },
    anim: (i) => B.slap(b, 32.5 + i * 0.12, { seed: 40 + i, from: 2.2, rot: 0.4 }) });
  g.restore();
  // this christmas (riso)
  if (b >= 33) {
    const e = E.outExpo(clamp((b - 33) * BEAT / 0.4));
    g.save(); g.beginPath(); g.rect(0, 1100, W * e, 200); g.clip();
    riso(g, 'this christmas', CX, 1250, 'italic 130px "Instrument Serif"', b, 33, { ink: K.red, align: 'center' });
    g.restore();
  }
  const a1 = inv(34, 34.5, b), a2 = inv(34.8, 35.3, b), a3 = inv(35.4, 35.9, b);
  g.textAlign = 'center';
  g.globalAlpha = a1; g.fillStyle = K.ink; g.font = '700 54px "Space Grotesk"'; g.fillText('christmas plans: sorted.', CX, 1350 + (1 - E.outCubic(a1)) * 20);
  g.globalAlpha = a2; g.fillStyle = K.red; g.font = '700 34px "JetBrains Mono"'; g.fillText('send this to the group chat →', CX, 1440 + (1 - E.outCubic(a2)) * 20);
  g.fillRect(CX - 290 * E.outCubic(a2), 1468, 580 * E.outCubic(a2), 3);
  g.globalAlpha = a3; g.fillStyle = 'rgba(57,49,49,.8)'; g.font = '500 25px "JetBrains Mono"';
  g.fillText('presented by bundle of brave', CX, 1522);
  g.fillText('gift a bundle. brighten a day.', CX, 1556);
  g.globalAlpha = 1;
  // a single gold riso star on the final hit
  const sp = popIn(b, 36);
  if (sp > 0) {
    g.save(); g.translate(905, 850); g.rotate(0.2 + (1 - clamp(sp)) * 1.5); g.scale(sp, sp);
    g.fillStyle = K.pink; starPath(g, 7, -5, 5, 62, 26); g.fill();
    g.fillStyle = K.gold; starPath(g, 0, 0, 5, 62, 26); g.fill();
    g.restore();
  }
}

// ------------------------------------------------------------------ timeline
let lastCard = { x: W - 750, y: 900, w: 700, h: 340 };
function zoomRect(from, p) { // card rect -> full frame
  return { x: lerp(from.x, 0, p), y: lerp(from.y, 0, p), w: lerp(from.w, W, p), h: lerp(from.h, H, p), r: lerp(34, 0, p) };
}
function draw(g, t) {
  const b = t / BEAT;
  g.save();
  if (b < 7.6) {
    const R = chatFrame(g, b); if (R.card) lastCard = R.card;
  } else if (b < 8.15) { // link opens: the card grows into the poster
    const R = chatFrame(g, 7.6); if (R.card) lastCard = R.card;
    const p = E.inOutCubic(inv(7.6, 8.15, b));
    const r = zoomRect(lastCard, p);
    g.save(); rrect(g, r.x, r.y, r.w, r.h, r.r); g.clip();
    g.translate(r.x, r.y); g.scale(r.w / W, r.h / H);
    poster(g, Math.max(b, 8)); g.restore();
    g.save(); g.globalAlpha = 1 - p; posterThumb(g, r.x, r.y, r.w, r.h, b); g.restore();
  } else if (b < 19.7) {
    poster(g, b);
  } else if (b < 20.3) { // poster folds back into the card
    const R = chatFrame(g, 20.3 - 0.001); if (R.card) lastCard = R.card;
    const p = 1 - E.inOutCubic(inv(19.7, 20.3, b));
    const r = zoomRect(lastCard, p);
    g.save(); rrect(g, r.x, r.y, r.w, r.h, r.r); g.clip();
    g.translate(r.x, r.y); g.scale(r.w / W, r.h / H);
    poster(g, b); g.restore();
    g.save(); g.globalAlpha = 1 - p; posterThumb(g, r.x, r.y, r.w, r.h, b); g.restore();
  } else if (b < 32) {
    chatFrame(g, b);
  } else { // the chat is torn away to reveal the end card
    endCard(g, b);
    const p = E.inCubic(inv(32, 32.7, b));
    if (p < 1) {
      g.save();
      g.translate(0, p * -200); g.rotate(-p * 0.08);
      g.save(); tearPath(g, 1 - p, 5); g.clip(); chatFrame(g, 31.99); g.restore();
      // torn paper edge
      const pts = (() => { g.save(); const q = tearPath(g, 1 - p, 5); g.restore(); return q; })();
      g.strokeStyle = '#FFFFFF'; g.lineWidth = 14; g.lineJoin = 'round'; g.beginPath();
      pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke();
      g.restore();
    }
  }
  g.restore();
  grain(g, t, 0.07);
  // opening: hard cut from black on the first kick
  if (b < 0.08) { g.fillStyle = '#000'; g.fillRect(0, 0, W, H); }
}

// ------------------------------------------------------------------ boot
let samples = 1, shutter = 0.5, fps = 60;
const acc = mkCanvas(W, H), accG = acc.getContext('2d');
function render(t) {
  if (samples <= 1) { draw(ctx, t); return; }
  for (let i = 0; i < samples; i++) {
    draw(accG, Math.max(0, t + (i / samples - 0.5) * shutter / fps));
    ctx.globalAlpha = 1 / (i + 1); ctx.drawImage(acc, 0, 0);
  }
  ctx.globalAlpha = 1;
}
window.ready = window.ready.then(async () => {
  await Promise.all(['600 44px "Inter Tight"', '900 30px "Inter Tight"', '100px "Archivo Black"', 'italic 100px "Instrument Serif"',
    '500 30px "JetBrains Mono"', '700 30px "JetBrains Mono"', '500 30px "Space Grotesk"', '700 30px "Space Grotesk"'].map(f => document.fonts.load(f)));
  buildTextures();
  measure(ctx);
  layoutLineup(ctx);
  window.renderFrame = render;
  window.setMotion = (n, sh = 0.5, f = 60) => { samples = n; shutter = sh; fps = f; };
  render(0);
  if (location.search.includes('play')) {
    document.body.classList.add('preview');
    const audio = new Audio('../build/youth-music.wav');
    let on = false;
    const loop = () => { if (on) render(Math.min(audio.currentTime, DUR - 0.001)); requestAnimationFrame(loop); };
    document.body.addEventListener('click', () => { audio.currentTime = 0; audio.play(); on = true; });
    requestAnimationFrame(loop);
  }
  return true;
});
})();
