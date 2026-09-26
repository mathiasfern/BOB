/* Bundle of Brave Fete — 15 s teaser.
 * Every frame is a pure function of time: renderFrame(t) draws the teaser at t
 * seconds. The music (tools/compose.py) runs at 128 BPM, so everything here is
 * timed in beats (b = t / BEAT). 32 beats = 15 s.
 */
(() => {
'use strict';

const W = 1920, H = 1080, CX = W / 2, CY = H / 2;
const BPM = 128, BEAT = 60 / BPM, DUR = 15;
const TAU = Math.PI * 2;

// Brand palette, plus two Christmas greens and a deep red for depth.
const C = {
  red: '#A60E19', maroon: '#782015', deep: '#4A070D', paper: '#F2EFE7', paper2: '#F2F1EB',
  ink: '#393131', slate: '#304254', sun: '#FFDE59', orange: '#FE9321', coral: '#E25539',
  tomato: '#E7443B', pink: '#FF789D', magenta: '#F781EE', sky: '#A9CAF5', leaf: '#A1C181',
  gold: '#FCBD3F', cream: '#FBEDC3', white: '#FFFFFF', pine: '#0E4A2B', holly: '#1C7A44',
  night: '#1A0508', goldDeep: '#B9780F',
};
const FESTIVE = [C.red, C.gold, C.holly, C.orange, C.cream, C.pink, C.sun, C.tomato, C.sky, C.white];

const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');

// ------------------------------------------------------------------ helpers
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, t) => a + (b - a) * t;
const inv = (a, b, x) => clamp((x - a) / (b - a));
const E = {
  outCubic: t => 1 - Math.pow(1 - t, 3),
  inCubic: t => t * t * t,
  inOutCubic: t => (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  outExpo: t => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t)),
  inExpo: t => (t <= 0 ? 0 : Math.pow(2, 10 * t - 10)),
  outBack: (t, s = 1.9) => 1 + (s + 1) * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2),
  outQuart: t => 1 - Math.pow(1 - t, 4),
  inOutSine: t => -(Math.cos(Math.PI * t) - 1) / 2,
};
// damped spring 0 -> 1 (x in seconds-ish units), freq in Hz
function spring(x, freq = 3, damp = 7) {
  if (x <= 0) return 0;
  return 1 - Math.exp(-damp * x) * Math.cos(TAU * freq * x);
}
function rng(seed) {
  let a = (seed * 2654435761) >>> 0 || 1;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const hash = (n) => rng(n)();
function noise1(x, seed = 0) { // smooth value noise
  const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f);
  return lerp(hash(i * 7 + seed * 131) , hash((i + 1) * 7 + seed * 131), u) * 2 - 1;
}
function mkCanvas(w, h) {
  const c = document.createElement('canvas'); c.width = Math.ceil(w); c.height = Math.ceil(h);
  return c;
}
function rrect(g, x, y, w, h, r) {
  g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}
function starPath(g, x, y, n, r1, r2, rot = -Math.PI / 2) {
  g.beginPath();
  for (let i = 0; i < n * 2; i++) {
    const r = i % 2 ? r2 : r1, a = rot + i * Math.PI / n;
    i ? g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r) : g.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
  }
  g.closePath();
}

// ------------------------------------------------------------------ cut-paper type
// Glyph outlines are pre-simplified polygons (tools/build-glyphs.js). Each letter
// instance gets its own seeded wobble so repeated letters never look identical —
// the same scissor-cut, ransom-note feel as the Bundle of Brave logo.
const pathCache = new Map();
function glyphPath(font, ch, seed, jit) {
  const key = font + ch + '|' + seed + '|' + jit;
  let p = pathCache.get(key);
  if (p) return p;
  const F = GLYPHS[font], g = F[ch];
  p = new Path2D();
  if (g) {
    const r = rng(seed * 97 + ch.charCodeAt(0));
    const ox = -g.a / 2, oy = F.capH / 2;
    for (const c of g.c) {
      for (let i = 0; i < c.length; i += 2) {
        const x = c[i] + ox + (r() - .5) * jit, y = c[i + 1] + oy + (r() - .5) * jit;
        i ? p.lineTo(x, y) : p.moveTo(x, y);
      }
      p.closePath();
    }
  }
  pathCache.set(key, p);
  return p;
}
function layout(str, font, size, track = 0) {
  const F = GLYPHS[font];
  const out = [];
  let x = 0;
  for (const ch of str) {
    const w = ch === ' ' ? 0.32 : (F[ch] ? F[ch].a : 0.5);
    out.push({ ch, x: x + w * size / 2, w: w * size });
    x += w * size + track * size;
  }
  const total = x - track * size;
  out.forEach(L => (L.x -= total / 2));
  out.width = total;
  return out;
}
/* text(g, str, o) — o: x, y, size, font, track, fill (str|fn(i)), shadow {x,y,color},
   outline {w,color}, extrude {n,dx,dy,color}, tile {colors, pad}, jit, wob (rotation
   jitter in rad), seed, anim(i, n, L) -> {x,y,s,sx,sy,r,a} | null (hidden) */
function text(g, str, o) {
  const font = o.font || 'cut', size = o.size || 100;
  const Ls = layout(str, font, size, o.track || 0);
  const capH = GLYPHS[font].capH;
  const seed = o.seed || 1, jit = o.jit ?? 0.035, wob = o.wob ?? 0.06;
  const n = Ls.length;
  for (let i = 0; i < n; i++) {
    const L = Ls[i];
    if (L.ch === ' ') continue;
    const a = o.anim ? o.anim(i, n, L) : {};
    if (!a) continue;
    const s = a.s ?? 1;
    if (s <= 0.001 || (a.a ?? 1) <= 0.001) continue;
    const r = rng(seed * 31 + i * 7);
    const rot = (r() - .5) * 2 * wob + (a.r || 0);
    const by = (r() - .5) * 0.06 * size;
    g.save();
    g.globalAlpha *= (a.a ?? 1);
    g.translate(o.x + L.x + (a.x || 0), o.y + by + (a.y || 0));
    g.rotate(rot);
    g.scale(s * (a.sx || 1), s * (a.sy || 1));
    if (o.tile) {
      const tc = o.tile.colors[(i + (o.tile.offset || 0)) % o.tile.colors.length];
      const tw = L.w + size * (o.tile.pad ?? 0.16), th = capH * size * 1.42;
      const tr = rng(seed * 13 + i);
      g.save();
      g.rotate((tr() - .5) * 0.12);
      g.fillStyle = 'rgba(40,10,10,0.35)';
      g.fillRect(-tw / 2 + size * .05, -th / 2 + size * .07, tw, th);
      g.fillStyle = tc;
      g.fillRect(-tw / 2, -th / 2, tw, th);
      g.restore();
    }
    g.scale(size, size);
    const p = glyphPath(o.fonts ? o.fonts[i % o.fonts.length] : font, L.ch, seed * 17 + i, jit);
    if (o.extrude) {
      const ex = o.extrude;
      g.fillStyle = ex.color;
      for (let k = ex.n; k >= 1; k--) {
        g.save(); g.translate(ex.dx * k / size, ex.dy * k / size); g.fill(p); g.restore();
      }
    }
    if (o.shadow) {
      g.save(); g.translate(o.shadow.x / size, o.shadow.y / size);
      g.fillStyle = o.shadow.color;
      if (o.outline) { g.lineJoin = 'round'; g.lineWidth = o.outline.w * 2 / size; g.strokeStyle = o.shadow.color; g.stroke(p); }
      g.fill(p); g.restore();
    }
    if (o.outline) {
      g.lineJoin = 'round'; g.lineWidth = o.outline.w * 2 / size; g.strokeStyle = o.outline.color; g.stroke(p);
    }
    const fill = typeof o.fill === 'function' ? o.fill(i, n) : (o.fill || C.paper);
    g.fillStyle = fill;
    g.fill(p);
    if (o.gloss) { // light sweep clipped to the glyph
      g.save(); g.clip(p);
      g.fillStyle = o.gloss(i, n, L) || 'rgba(0,0,0,0)';
      g.fillRect(-1, -1, 2, 2);
      g.restore();
    }
    if (a.flash) { g.fillStyle = `rgba(255,255,255,${a.flash})`; g.fill(p); }
    g.restore();
  }
  return Ls;
}
// letter "slap": pops in at beat bs with squash & stretch and spin
function slap(b, bs, { from = 2.2, rot = 0.5, dur = 0.35, seed = 0, drop = 0 } = {}) {
  const x = (b - bs) * BEAT;
  if (x < 0) return null;
  const k = spring(x, 2.6, 9);
  const r = rng(seed)();
  const sq = Math.exp(-x * 14) * Math.sin(x * 40) * 0.25;
  return {
    s: lerp(from, 1, clamp(k, 0, 1.2)),
    sx: 1 + sq, sy: 1 - sq,
    r: (1 - clamp(k)) * rot * (r > .5 ? 1 : -1),
    y: (1 - clamp(k, 0, 1.3)) * drop,
    a: clamp(x / 0.05),
    flash: clamp(1 - x / 0.12) * 0.9,
  };
}

// ------------------------------------------------------------------ sprites
const IMG = {};
function loadImg(name, src) {
  return new Promise((res, rej) => { const i = new Image(); i.onload = () => { IMG[name] = i; res(); }; i.onerror = rej; i.src = src; });
}
/* bake(draw, w, h, {outline, shadow}) → a sticker: icon + white die-cut border +
   soft drop shadow, rendered once at high resolution. */
function bake(draw, w, h, { outline = 0, oc = C.white, shadow = true } = {}) {
  const pad = outline + 40;
  const cw = w + pad * 2, ch = h + pad * 2;
  const icon = mkCanvas(cw, ch), ic = icon.getContext('2d');
  ic.translate(pad, pad); draw(ic, w, h);
  const out = mkCanvas(cw, ch), o = out.getContext('2d');
  let base = icon;
  if (outline) {
    const sil = mkCanvas(cw, ch), s = sil.getContext('2d');
    s.drawImage(icon, 0, 0); s.globalCompositeOperation = 'source-in'; s.fillStyle = oc; s.fillRect(0, 0, cw, ch);
    const dil = mkCanvas(cw, ch), d = dil.getContext('2d');
    for (let a = 0; a < 32; a++) d.drawImage(sil, Math.cos(a / 32 * TAU) * outline, Math.sin(a / 32 * TAU) * outline);
    for (let a = 0; a < 16; a++) d.drawImage(sil, Math.cos(a / 16 * TAU) * outline * .5, Math.sin(a / 16 * TAU) * outline * .5);
    d.drawImage(icon, 0, 0);
    base = dil;
  }
  if (shadow) {
    const sh = mkCanvas(cw, ch), s = sh.getContext('2d');
    s.drawImage(base, 0, 0); s.globalCompositeOperation = 'source-in'; s.fillStyle = 'rgba(30,5,5,0.35)'; s.fillRect(0, 0, cw, ch);
    o.filter = `blur(${Math.max(4, w * 0.02)}px)`;
    o.drawImage(sh, w * 0.025, h * 0.04);
    o.filter = 'none';
  }
  o.drawImage(base, 0, 0);
  return { c: out, w: cw, h: ch, iw: w };
}
function spr(g, S, x, y, size, rot = 0, alpha = 1, sx = 1, sy = 1) {
  if (!S || size <= 0 || alpha <= 0) return;
  const k = size / S.iw;
  g.save(); g.globalAlpha *= alpha; g.translate(x, y); g.rotate(rot); g.scale(k * sx, k * sy);
  g.drawImage(S.c, -S.w / 2, -S.h / 2);
  g.restore();
}
function pop(b, bs, dur = 0.5) { // 0 → 1 with overshoot, in beats
  const x = (b - bs) * BEAT;
  return x <= 0 ? 0 : spring(x, 2.2, 7.5);
}

// ------------------------------------------------------------------ icon art
// All icons are drawn in a 100×100 box, scaled to the bake size.
const ICON = {
  dice(g, pips = 5) {
    rrect(g, 10, 16, 80, 80, 16); g.fillStyle = '#D8C6A8'; g.fill();
    rrect(g, 10, 8, 80, 80, 16); g.fillStyle = '#FFF9EF'; g.fill();
    g.fillStyle = C.red;
    const P = { 1: [[50, 48]], 2: [[30, 28], [70, 68]], 3: [[28, 26], [50, 48], [72, 70]], 4: [[30, 28], [70, 28], [30, 68], [70, 68]],
      5: [[28, 26], [72, 26], [50, 48], [28, 70], [72, 70]], 6: [[30, 24], [70, 24], [30, 48], [70, 48], [30, 72], [70, 72]] }[pips];
    for (const [x, y] of P) { g.beginPath(); g.arc(x, y, 8, 0, TAU); g.fill(); }
  },
  target(g) {
    const cols = [C.red, C.paper, C.red, C.paper, C.gold];
    [48, 38, 28, 18, 8].forEach((r, i) => { g.beginPath(); g.arc(50, 50, r, 0, TAU); g.fillStyle = cols[i]; g.fill(); });
  },
  dart(g) {
    g.save(); g.translate(50, 50); g.rotate(-0.7);
    g.fillStyle = C.ink; g.fillRect(-4, -3, 58, 6);
    g.fillStyle = C.gold; g.fillRect(-28, -5, 26, 10);
    g.fillStyle = C.holly;
    g.beginPath(); g.moveTo(-28, 0); g.lineTo(-48, -18); g.lineTo(-40, 0); g.lineTo(-48, 18); g.closePath(); g.fill();
    g.fillStyle = '#C9C9C9'; g.beginPath(); g.moveTo(54, -3); g.lineTo(66, 0); g.lineTo(54, 3); g.fill();
    g.restore();
  },
  ring(g, col = C.gold) {
    g.lineWidth = 14; g.strokeStyle = col; g.beginPath(); g.ellipse(50, 50, 38, 38, 0, 0, TAU); g.stroke();
    g.lineWidth = 4; g.strokeStyle = 'rgba(255,255,255,.7)'; g.beginPath(); g.arc(50, 50, 38, -2.6, -1.6); g.stroke();
  },
  note(g, col = C.gold) {
    g.fillStyle = col; g.strokeStyle = col;
    g.save(); g.translate(26, 76); g.rotate(-0.4); g.beginPath(); g.ellipse(0, 0, 16, 11, 0, 0, TAU); g.fill(); g.restore();
    g.save(); g.translate(72, 66); g.rotate(-0.4); g.beginPath(); g.ellipse(0, 0, 16, 11, 0, 0, TAU); g.fill(); g.restore();
    g.lineWidth = 7; g.beginPath(); g.moveTo(39, 72); g.lineTo(39, 14); g.moveTo(85, 62); g.lineTo(85, 4); g.stroke();
    g.beginPath(); g.moveTo(36, 12); g.lineTo(88, 2); g.lineTo(88, 18); g.lineTo(36, 28); g.closePath(); g.fill();
  },
  note1(g, col = C.sun) {
    g.fillStyle = col; g.strokeStyle = col;
    g.save(); g.translate(40, 78); g.rotate(-0.4); g.beginPath(); g.ellipse(0, 0, 20, 14, 0, 0, TAU); g.fill(); g.restore();
    g.lineWidth = 8; g.beginPath(); g.moveTo(56, 74); g.lineTo(56, 8); g.stroke();
    g.beginPath(); g.moveTo(56, 8); g.bezierCurveTo(70, 22, 88, 26, 80, 52); g.bezierCurveTo(80, 36, 70, 32, 56, 30); g.fill();
  },
  mic(g) {
    g.fillStyle = C.ink; rrect(g, 42, 48, 16, 48, 7); g.fill();
    g.fillStyle = C.red; g.fillRect(40, 48, 20, 9);
    g.beginPath(); g.arc(50, 30, 26, 0, TAU); g.fillStyle = C.gold; g.fill();
    g.save(); g.clip(); g.strokeStyle = C.goldDeep; g.lineWidth = 3;
    for (let i = -30; i < 60; i += 9) { g.beginPath(); g.moveTo(24 + i, 4); g.lineTo(84 + i, 60); g.stroke(); g.beginPath(); g.moveTo(84 - i, 4); g.lineTo(24 - i, 60); g.stroke(); }
    g.restore();
    g.fillStyle = 'rgba(255,255,255,.6)'; g.beginPath(); g.ellipse(40, 20, 7, 4, -0.6, 0, TAU); g.fill();
  },
  balloon(g, col = C.red) {
    g.fillStyle = col;
    g.beginPath(); g.moveTo(50, 90); g.bezierCurveTo(10, 70, 10, 6, 50, 6); g.bezierCurveTo(90, 6, 90, 70, 50, 90); g.fill();
    g.beginPath(); g.moveTo(50, 88); g.lineTo(43, 97); g.lineTo(57, 97); g.closePath(); g.fill();
    g.fillStyle = 'rgba(255,255,255,.45)'; g.beginPath(); g.ellipse(36, 30, 7, 13, 0.5, 0, TAU); g.fill();
  },
  bauble(g, col = C.red, band = C.gold) {
    g.fillStyle = C.gold; rrect(g, 40, 6, 20, 14, 3); g.fill();
    g.strokeStyle = C.goldDeep; g.lineWidth = 3; g.beginPath(); g.arc(50, 6, 6, Math.PI, 0); g.stroke();
    g.beginPath(); g.arc(50, 58, 40, 0, TAU); g.fillStyle = col; g.fill();
    g.save(); g.clip();
    g.fillStyle = band; g.beginPath(); g.moveTo(0, 50);
    for (let i = 0; i <= 10; i++) g.lineTo(i * 10, i % 2 ? 44 : 56);
    g.lineTo(100, 66); for (let i = 10; i >= 0; i--) g.lineTo(i * 10, i % 2 ? 60 : 72); g.fill();
    g.fillStyle = 'rgba(0,0,0,.18)'; g.beginPath(); g.arc(62, 70, 40, 0, TAU); g.fill();
    g.restore();
    g.fillStyle = 'rgba(255,255,255,.55)'; g.beginPath(); g.ellipse(34, 40, 8, 13, 0.6, 0, TAU); g.fill();
  },
  gift(g, col = C.red, rib = C.gold) {
    g.fillStyle = col; g.fillRect(14, 44, 72, 52);
    g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(14, 44, 72, 8);
    g.fillStyle = col; g.fillRect(8, 30, 84, 18);
    g.fillStyle = rib; g.fillRect(44, 30, 12, 66); g.fillRect(8, 36, 84, 7);
    g.beginPath(); g.ellipse(36, 22, 16, 9, 0.4, 0, TAU); g.ellipse(64, 22, 16, 9, -0.4, 0, TAU); g.fill();
    g.fillStyle = C.goldDeep; g.beginPath(); g.arc(50, 28, 6, 0, TAU); g.fill();
  },
  candy(g) {
    g.lineCap = 'round'; g.lineWidth = 16;
    const path = () => { g.beginPath(); g.moveTo(58, 96); g.lineTo(58, 34); g.arc(40, 34, 18, 0, Math.PI, true); };
    g.strokeStyle = C.white; path(); g.stroke();
    g.strokeStyle = C.red; g.setLineDash([9, 11]); path(); g.stroke(); g.setLineDash([]);
  },
  smiley(g) {
    g.beginPath(); g.arc(50, 50, 46, 0, TAU); g.fillStyle = C.sun; g.fill();
    g.fillStyle = 'rgba(255,120,157,.7)'; g.beginPath(); g.ellipse(24, 58, 9, 6, 0, 0, TAU); g.ellipse(76, 58, 9, 6, 0, 0, TAU); g.fill();
    g.strokeStyle = C.ink; g.lineWidth = 6; g.lineCap = 'round';
    g.beginPath(); g.moveTo(24, 40); g.lineTo(36, 34); g.lineTo(24, 28); g.stroke();
    g.beginPath(); g.moveTo(76, 40); g.lineTo(64, 34); g.lineTo(76, 28); g.stroke();
    g.fillStyle = C.ink; g.beginPath(); g.moveTo(26, 54); g.quadraticCurveTo(50, 60, 74, 54); g.quadraticCurveTo(70, 88, 50, 88); g.quadraticCurveTo(30, 88, 26, 54); g.fill();
    g.fillStyle = C.pink; g.beginPath(); g.ellipse(50, 80, 12, 7, 0, 0, TAU); g.fill();
    g.fillStyle = C.sky; g.beginPath(); g.moveTo(12, 44); g.quadraticCurveTo(2, 60, 10, 64); g.quadraticCurveTo(20, 60, 12, 44); g.fill();
    g.beginPath(); g.moveTo(88, 44); g.quadraticCurveTo(98, 60, 90, 64); g.quadraticCurveTo(80, 60, 88, 44); g.fill();
  },
  palette(g) {
    g.fillStyle = C.cream;
    g.beginPath(); g.moveTo(50, 8); g.bezierCurveTo(92, 8, 100, 50, 86, 70); g.bezierCurveTo(74, 88, 60, 70, 50, 84);
    g.bezierCurveTo(40, 98, 4, 92, 4, 52); g.bezierCurveTo(4, 26, 24, 8, 50, 8); g.fill();
    g.globalCompositeOperation = 'destination-out'; g.beginPath(); g.ellipse(34, 66, 9, 7, 0, 0, TAU); g.fill();
    g.globalCompositeOperation = 'source-over';
    [[28, 34, C.red], [50, 24, C.gold], [72, 32, C.holly], [80, 54, C.sky], [18, 52, C.pink]].forEach(([x, y, c]) => {
      g.fillStyle = c; g.beginPath(); g.arc(x, y, 9, 0, TAU); g.fill();
    });
  },
  pinwheel(g) {
    const cols = [C.red, C.gold, C.holly, C.sky];
    for (let i = 0; i < 4; i++) {
      g.save(); g.translate(50, 50); g.rotate(i * Math.PI / 2);
      g.fillStyle = cols[i]; g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -46); g.quadraticCurveTo(40, -40, 44, 0); g.closePath(); g.fill();
      g.fillStyle = 'rgba(0,0,0,.15)'; g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -46); g.quadraticCurveTo(14, -24, 0, 0); g.fill();
      g.restore();
    }
    g.fillStyle = C.white; g.beginPath(); g.arc(50, 50, 6, 0, TAU); g.fill();
  },
  crayon(g, col = C.red) {
    g.save(); g.translate(50, 50); g.rotate(-0.8);
    g.fillStyle = col; rrect(g, -40, -10, 64, 20, 4); g.fill();
    g.beginPath(); g.moveTo(24, -10); g.lineTo(44, 0); g.lineTo(24, 10); g.fill();
    g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(-30, -10, 6, 20); g.fillRect(8, -10, 6, 20);
    g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(-40, 4, 64, 6);
    g.restore();
  },
  brush(g) {
    g.save(); g.translate(50, 50); g.rotate(0.8);
    g.fillStyle = C.orange; rrect(g, -6, -8, 12, 56, 6); g.fill();
    g.fillStyle = '#C9C9C9'; g.fillRect(-8, -24, 16, 18);
    g.fillStyle = C.magenta; g.beginPath(); g.moveTo(-8, -24); g.quadraticCurveTo(-10, -44, 0, -52); g.quadraticCurveTo(10, -44, 8, -24); g.fill();
    g.restore();
  },
  tree(g) {
    g.fillStyle = '#6B3B1F'; g.fillRect(44, 82, 12, 14);
    [[50, 6, 26, 40], [50, 22, 36, 62], [50, 40, 46, 86]].forEach(([x, y, w, yb]) => {
      g.fillStyle = C.holly; g.beginPath(); g.moveTo(x, y); g.lineTo(x + w, yb); g.lineTo(x - w, yb); g.closePath(); g.fill();
    });
    [[40, 50, C.red], [60, 66, C.gold], [36, 76, C.sky], [64, 44, C.pink], [52, 30, C.orange]].forEach(([x, y, c]) => {
      g.fillStyle = c; g.beginPath(); g.arc(x, y, 4.5, 0, TAU); g.fill();
    });
    g.fillStyle = C.sun; starPath(g, 50, 8, 5, 10, 4.5); g.fill();
  },
  ticket(g) {
    g.fillStyle = C.gold;
    g.beginPath(); g.moveTo(4, 26); g.lineTo(96, 26); g.lineTo(96, 42); g.arc(96, 50, 8, -Math.PI / 2, Math.PI / 2, true);
    g.lineTo(96, 74); g.lineTo(4, 74); g.lineTo(4, 58); g.arc(4, 50, 8, Math.PI / 2, -Math.PI / 2, true); g.closePath(); g.fill();
    g.strokeStyle = C.red; g.setLineDash([4, 4]); g.lineWidth = 2; g.beginPath(); g.moveTo(72, 30); g.lineTo(72, 70); g.stroke(); g.setLineDash([]);
    g.fillStyle = C.red; starPath(g, 38, 50, 5, 14, 6); g.fill(); starPath(g, 84, 50, 5, 7, 3); g.fill();
  },
  cstar(g, col = C.gold, n = 5, seed = 3) { // crayon doodle star, like the logo's
    const r = rng(seed);
    g.save();
    const pts = [];
    for (let i = 0; i < n * 2; i++) {
      const rad = (i % 2 ? 20 : 48) + (r() - .5) * 6, a = -Math.PI / 2 + i * Math.PI / n + (r() - .5) * 0.12;
      pts.push([50 + Math.cos(a) * rad, 52 + Math.sin(a) * rad]);
    }
    g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath();
    g.fillStyle = col; g.fill();
    g.clip();
    // crayon scribble texture
    for (let i = 0; i < 260; i++) {
      g.strokeStyle = r() > .5 ? 'rgba(255,255,255,.28)' : 'rgba(0,0,0,.10)';
      g.lineWidth = 0.6 + r() * 1.4;
      const x = r() * 100, y = r() * 100, a = -0.9 + (r() - .5) * .4, l = 8 + r() * 22;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
    }
    g.restore();
    g.strokeStyle = col; g.lineWidth = 2.5; g.lineJoin = 'round';
    g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); g.stroke();
  },
  sparkle(g, col = C.white) {
    g.fillStyle = col; g.beginPath();
    g.moveTo(50, 0); g.quadraticCurveTo(56, 44, 100, 50); g.quadraticCurveTo(56, 56, 50, 100);
    g.quadraticCurveTo(44, 56, 0, 50); g.quadraticCurveTo(44, 44, 50, 0); g.fill();
  },
  splat(g, col = C.magenta, seed = 5) {
    const r = rng(seed); g.fillStyle = col; g.beginPath();
    const n = 14;
    for (let i = 0; i <= n; i++) {
      const a = i / n * TAU, rad = 26 + r() * 16;
      const x = 50 + Math.cos(a) * rad, y = 50 + Math.sin(a) * rad;
      i ? g.quadraticCurveTo(50 + Math.cos(a - .2) * (rad + 8), 50 + Math.sin(a - .2) * (rad + 8), x, y) : g.moveTo(x, y);
    }
    g.fill();
    for (let i = 0; i < 7; i++) { const a = r() * TAU, d = 44 + r() * 8; g.beginPath(); g.arc(50 + Math.cos(a) * d, 50 + Math.sin(a) * d, 2 + r() * 4, 0, TAU); g.fill(); }
  },
  heart(g, col = C.pink) {
    g.fillStyle = col; g.beginPath(); g.moveTo(50, 88);
    g.bezierCurveTo(-6, 50, 18, -4, 50, 26); g.bezierCurveTo(82, -4, 106, 50, 50, 88); g.fill();
    g.fillStyle = 'rgba(255,255,255,.5)'; g.beginPath(); g.ellipse(30, 32, 6, 10, 0.6, 0, TAU); g.fill();
  },
};
const S = {}; // baked stickers
function buildSprites() {
  const ic = (fn, size = 360, outline = 14, ...args) => bake((g, w) => { g.scale(w / 100, w / 100); fn(g, ...args); }, size, size, { outline });
  S.dice = [1, 2, 3, 4, 5, 6].map(p => ic(ICON.dice, 300, 12, p));
  S.target = ic(ICON.target, 420, 14);
  S.dart = ic(ICON.dart, 300, 8);
  S.ring = [C.gold, C.pink, C.sky, C.holly].map(c => ic(ICON.ring, 260, 10, c));
  S.note = ic(ICON.note, 260, 10, C.sun);
  S.note1 = ic(ICON.note1, 260, 10, C.gold);
  S.noteP = ic(ICON.note, 260, 10, C.pink);
  S.mic = ic(ICON.mic, 360, 14);
  S.balloon = [C.red, C.gold, C.pink, C.sky, C.orange, C.cream].map(c => ic(ICON.balloon, 300, 0, c));
  S.bauble = [[C.red, C.gold], [C.gold, C.red], [C.holly, C.cream], [C.sky, C.white], [C.pink, C.gold]].map(([a, b]) => ic(ICON.bauble, 300, 10, a, b));
  S.gift = [[C.red, C.gold], [C.holly, C.red], [C.gold, C.red], [C.sky, C.pink]].map(([a, b]) => ic(ICON.gift, 300, 12, a, b));
  S.candy = ic(ICON.candy, 300, 10);
  S.smiley = ic(ICON.smiley, 360, 14);
  S.palette = ic(ICON.palette, 380, 14);
  S.pinwheel = ic(ICON.pinwheel, 360, 12);
  S.crayon = [C.red, C.holly, C.sky, C.gold].map(c => ic(ICON.crayon, 300, 10, c));
  S.brush = ic(ICON.brush, 320, 12);
  S.tree = ic(ICON.tree, 380, 14);
  S.ticket = ic(ICON.ticket, 340, 12);
  S.cstarY = ic(ICON.cstar, 300, 0, C.gold, 5, 3);
  S.cstarY2 = ic(ICON.cstar, 300, 0, C.sun, 5, 9);
  S.cstarB = ic(ICON.cstar, 300, 0, C.sky, 6, 4);
  S.cstarP = ic(ICON.cstar, 300, 0, C.pink, 5, 11);
  S.sparkle = bake((g, w) => { g.scale(w / 100, w / 100); ICON.sparkle(g); }, 200, 200, { shadow: false });
  S.sparkleG = bake((g, w) => { g.scale(w / 100, w / 100); ICON.sparkle(g, C.sun); }, 200, 200, { shadow: false });
  S.splat = [C.magenta, C.sky, C.sun].map((c, i) => ic(ICON.splat, 300, 0, c, 5 + i));
  S.heart = [C.pink, C.red].map(c => ic(ICON.heart, 280, 12, c));
  const imgSticker = (img, w, outline) => bake((g) => g.drawImage(img, 0, 0, w, w * img.height / img.width), w, w * img.height / img.width, { outline });
  S.strawberry = imgSticker(IMG.strawberry, 420, 14);
  S.gem = imgSticker(IMG.gem, 520, 0);
  S.teddy = imgSticker(IMG.teddy, 384, 12);
}

// ------------------------------------------------------------------ textures
let GRAIN, PAPER;
function buildTextures() {
  // paper fibre texture
  PAPER = mkCanvas(1024, 1024);
  const p = PAPER.getContext('2d');
  const r = rng(99);
  const id = p.createImageData(1024, 1024);
  for (let i = 0; i < id.data.length; i += 4) {
    const v = 128 + (r() - .5) * 40;
    id.data[i] = id.data[i + 1] = id.data[i + 2] = v; id.data[i + 3] = 255;
  }
  p.putImageData(id, 0, 0);
  for (let i = 0; i < 1400; i++) {
    p.strokeStyle = r() > .5 ? 'rgba(255,255,255,.10)' : 'rgba(0,0,0,.08)';
    p.lineWidth = r() * 1.5;
    const x = r() * 1024, y = r() * 1024, a = r() * TAU, l = 10 + r() * 50;
    p.beginPath(); p.moveTo(x, y); p.quadraticCurveTo(x + Math.cos(a + 1) * l / 2, y + Math.sin(a + 1) * l / 2, x + Math.cos(a) * l, y + Math.sin(a) * l); p.stroke();
  }
  // animated film grain tile
  GRAIN = mkCanvas(512, 512);
  const q = GRAIN.getContext('2d');
  const gd = q.createImageData(512, 512);
  for (let i = 0; i < gd.data.length; i += 4) {
    const v = r() * 255;
    gd.data[i] = gd.data[i + 1] = gd.data[i + 2] = v; gd.data[i + 3] = 255;
  }
  q.putImageData(gd, 0, 0);
}
function overlayTextures(g, t) {
  g.save();
  g.globalCompositeOperation = 'overlay';
  g.globalAlpha = 0.16;
  g.fillStyle = g.createPattern(PAPER, 'repeat');
  g.fillRect(0, 0, W, H);
  g.globalAlpha = 0.07;
  const f = Math.floor(t * 30);
  const pat = g.createPattern(GRAIN, 'repeat');
  pat.setTransform(new DOMMatrix().translate((hash(f) * 512) | 0, (hash(f + 999) * 512) | 0));
  g.fillStyle = pat; g.fillRect(0, 0, W, H);
  g.restore();
  // vignette
  const v = g.createRadialGradient(CX, CY, H * 0.35, CX, CY, H * 1.05);
  v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(10,0,0,0.42)');
  g.fillStyle = v; g.fillRect(0, 0, W, H);
}

// ------------------------------------------------------------------ backgrounds & fx
function radialBg(g, inner, outer, cx = CX, cy = CY) {
  const gr = g.createRadialGradient(cx, cy, 0, cx, cy, W * 0.62);
  gr.addColorStop(0, inner); gr.addColorStop(1, outer);
  g.fillStyle = gr; g.fillRect(-50, -50, W + 100, H + 100);
}
function sunburst(g, cx, cy, n, rot, col, alpha = 1) {
  g.save(); g.globalAlpha *= alpha; g.fillStyle = col; g.translate(cx, cy); g.rotate(rot);
  g.beginPath();
  for (let i = 0; i < n; i++) {
    const a0 = i / n * TAU, a1 = a0 + TAU / n / 2;
    g.moveTo(0, 0); g.lineTo(Math.cos(a0) * 2400, Math.sin(a0) * 2400); g.lineTo(Math.cos(a1) * 2400, Math.sin(a1) * 2400);
  }
  g.fill(); g.restore();
}
function harlequin(g, col, size, off, alpha) {
  g.save(); g.globalAlpha *= alpha; g.fillStyle = col; g.beginPath();
  for (let y = -size; y < H + size * 2; y += size) {
    for (let x = -size * 2; x < W + size * 2; x += size) {
      if (((x / size + y / size) & 1) === 0) continue;
      const px = x + (off % (size * 2)), py = y;
      g.moveTo(px, py - size / 2); g.lineTo(px + size / 2, py); g.lineTo(px, py + size / 2); g.lineTo(px - size / 2, py); g.closePath();
    }
  }
  g.fill(); g.restore();
}
function halftone(g, col, alpha, t) {
  g.save(); g.globalAlpha *= alpha; g.fillStyle = col; g.beginPath();
  const s = 44;
  for (let y = 0; y < H + s; y += s) for (let x = ((y / s) & 1) * s / 2; x < W + s; x += s) {
    const d = Math.hypot(x - CX, y - CY) / 900;
    const r = clamp(0.5 + 0.5 * Math.sin(d * 9 - t * 6)) * s * 0.3 + 2;
    g.moveTo(x + r, y); g.arc(x, y, r, 0, TAU);
  }
  g.fill(); g.restore();
}
function stripes(g, cols, w, off, ang) {
  g.save(); g.translate(CX, CY); g.rotate(ang);
  const n = Math.ceil(2600 / w) + 2;
  for (let i = -n; i < n; i++) {
    g.fillStyle = cols[((i % cols.length) + cols.length) % cols.length];
    g.fillRect(i * w + (off % (w * cols.length)) - 0, -1500, w + 1, 3000);
  }
  g.restore();
}
function shockwave(g, x, y, b, bs, col = C.gold, maxR = 900, w = 40) {
  const p = (b - bs) * BEAT / 0.55;
  if (p <= 0 || p >= 1) return;
  g.save(); g.strokeStyle = col; g.globalAlpha *= (1 - p); g.lineWidth = w * (1 - p) + 2;
  g.beginPath(); g.arc(x, y, E.outCubic(p) * maxR, 0, TAU); g.stroke(); g.restore();
}
function flash(g, a, col = '255,255,255') {
  if (a <= 0) return;
  g.fillStyle = `rgba(${col},${clamp(a)})`; g.fillRect(-50, -50, W + 100, H + 100);
}
function glowDot(g, x, y, r, col, a = 1) {
  const gr = g.createRadialGradient(x, y, 0, x, y, r);
  gr.addColorStop(0, col); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.globalAlpha = a; g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); g.globalAlpha = 1;
}
const BULB = ['#FF4D4D', '#FFD34D', '#5DFF8A', '#6EC8FF', '#FF7BD8', '#FFA53D'];
const BULB_GLOW = ['rgba(255,77,77,', 'rgba(255,211,77,', 'rgba(93,255,138,', 'rgba(110,200,255,', 'rgba(255,123,216,', 'rgba(255,165,61,'];
function fairyLights(g, x1, y1, x2, y2, sag, n, t, { phase = 0, sway = 0, size = 1, chase = 0 } = {}) {
  const mx = (x1 + x2) / 2 + Math.sin(t * 2 + phase) * sway, my = Math.max(y1, y2) + sag;
  const pt = (u) => [(1 - u) * (1 - u) * x1 + 2 * u * (1 - u) * mx + u * u * x2, (1 - u) * (1 - u) * y1 + 2 * u * (1 - u) * my + u * u * y2];
  g.save();
  g.strokeStyle = '#2B1A12'; g.lineWidth = 4 * size; g.beginPath();
  for (let i = 0; i <= 40; i++) { const [x, y] = pt(i / 40); i ? g.lineTo(x, y) : g.moveTo(x, y); }
  g.stroke();
  g.globalCompositeOperation = 'lighter';
  const bulbs = [];
  for (let i = 0; i < n; i++) {
    const u = (i + 0.5) / n, [x, y] = pt(u);
    const ci = (i + Math.floor(phase)) % BULB.length;
    const tw = 0.55 + 0.45 * Math.sin(t * 7 + i * 1.7 + phase) + (chase ? chase * (Math.floor(t / BEAT * 2) % 3 === i % 3 ? 0.6 : -0.3) : 0);
    bulbs.push([x, y, ci, clamp(tw, 0.15, 1.2)]);
    glowDot(g, x, y + 16 * size, 46 * size, BULB_GLOW[ci] + (0.55 * clamp(tw)) + ')');
  }
  g.globalCompositeOperation = 'source-over';
  for (const [x, y, ci, tw] of bulbs) {
    g.fillStyle = '#3A2A1E'; g.fillRect(x - 5 * size, y - 2, 10 * size, 10 * size);
    g.fillStyle = BULB[ci]; g.beginPath(); g.ellipse(x, y + 18 * size, 9 * size, 14 * size, 0, 0, TAU); g.fill();
    g.fillStyle = `rgba(255,255,255,${0.35 + 0.5 * clamp(tw)})`; g.beginPath(); g.ellipse(x - 2 * size, y + 14 * size, 3 * size, 6 * size, 0, 0, TAU); g.fill();
  }
  g.restore();
}
function sparkles(g, t, n, seed, { area = [0, 0, W, H], size = 30, speed = 1, col } = {}) {
  const r = rng(seed);
  for (let i = 0; i < n; i++) {
    const x = area[0] + r() * area[2], y = area[1] + r() * area[3], ph = r() * TAU, sp = (1.5 + r() * 2.5) * speed, sz = size * (0.4 + r());
    const k = Math.pow(clamp(Math.sin(t * sp + ph)), 3);
    if (k < 0.02) continue;
    spr(g, col === 'gold' ? S.sparkleG : S.sparkle, x, y, sz * k, t * 0.5 + ph, k);
  }
}
function snow(g, t, n, seed, warp = 0) {
  const r = rng(seed);
  g.save(); g.fillStyle = 'rgba(255,255,255,0.85)';
  for (let i = 0; i < n; i++) {
    const x0 = r() * W, y0 = r() * H, z = 0.3 + r() * 0.7, sp = 40 + r() * 60;
    let x = (x0 + Math.sin(t * 1.3 + i) * 20) % W, y = ((y0 + t * sp * z) % (H + 40)) - 20;
    if (warp > 0) { // stretch radially from center (hyperspace build)
      const dx = x - CX, dy = y - CY, k = 1 + warp * 2.5 * z;
      const x2 = CX + dx * k, y2 = CY + dy * k;
      g.strokeStyle = `rgba(255,255,255,${0.6 * z})`; g.lineWidth = 3 * z; g.beginPath(); g.moveTo(x, y); g.lineTo(x2, y2); g.stroke();
      continue;
    }
    g.globalAlpha = 0.35 + z * 0.5; g.beginPath(); g.arc(x, y, 2 + z * 4, 0, TAU); g.fill();
  }
  g.restore();
}

// ------------------------------------------------------------------ confetti
const BURSTS = [];
function addBurst(beat, x, y, ang, spread, speed, count, seed, o = {}) {
  const r = rng(seed), parts = [];
  for (let i = 0; i < count; i++) {
    const a = ang + (r() - .5) * spread, v = speed * (0.35 + r() * 0.9);
    parts.push({
      vx: Math.cos(a) * v, vy: Math.sin(a) * v, rot: r() * TAU, vr: (r() - .5) * 18, flip: 4 + r() * 10, ph: r() * TAU,
      col: (o.cols || FESTIVE)[(r() * (o.cols || FESTIVE).length) | 0], shape: r(), sz: (o.size || 1) * (10 + r() * 12),
      wob: 20 + r() * 60, k: 2.2 + r() * 1.6,
    });
  }
  BURSTS.push({ t0: beat * BEAT, x, y, parts, g: o.g ?? 900, life: o.life ?? 5 });
}
function drawConfetti(g, t, filter) {
  for (const B of BURSTS) {
    if (filter && !filter(B)) continue;
    const dt = t - B.t0;
    if (dt < 0 || dt > B.life) continue;
    for (const p of B.parts) {
      const e = Math.exp(-p.k * dt), d = (1 - e) / p.k;
      const x = B.x + p.vx * d + Math.sin(dt * 3 + p.ph) * p.wob * (1 - e);
      const y = B.y + (p.vy - B.g / p.k) * d + B.g * dt / p.k;
      if (x < -60 || x > W + 60 || y > H + 60 || y < -400) continue;
      const fl = Math.cos(dt * p.flip + p.ph);
      g.save(); g.translate(x, y); g.rotate(p.rot + p.vr * dt);
      g.fillStyle = p.col;
      if (p.shape < 0.55) { g.scale(1, fl); g.fillRect(-p.sz / 2, -p.sz * 0.3, p.sz, p.sz * 0.6); }
      else if (p.shape < 0.8) { g.scale(fl, 1); g.beginPath(); g.arc(0, 0, p.sz * 0.35, 0, TAU); g.fill(); }
      else if (p.shape < 0.92) { g.scale(1, fl); starPath(g, 0, 0, 5, p.sz * 0.6, p.sz * 0.27); g.fill(); }
      else { g.strokeStyle = p.col; g.lineWidth = 4; g.beginPath(); g.moveTo(-p.sz, 0); g.bezierCurveTo(-p.sz / 2, -p.sz * fl, p.sz / 2, p.sz * fl, p.sz, 0); g.stroke(); }
      g.restore();
    }
  }
}

// ------------------------------------------------------------------ fly-through objects
function flyThrough(g, b, b0, b1, items, seed) {
  const r = rng(seed);
  for (let i = 0; i < items.length; i++) {
    const S0 = items[i];
    const start = b0 + r() * (b1 - b0) * 0.7, len = 0.9 + r() * 0.8, a = r() * TAU, rot = (r() - .5) * 4;
    const p = (b - start) / len;
    if (p <= 0 || p >= 1) continue;
    const z = Math.pow(p, 2.2);
    const dist = 80 + z * 1300, x = CX + Math.cos(a) * dist, y = CY + Math.sin(a) * dist * 0.75;
    spr(g, S0, x, y, 60 + z * 520, rot * p, clamp(p * 5));
  }
}

// ------------------------------------------------------------------ scenes
// Each scene draws the whole frame for beat b (global beats).

// A — brand moment: gem star burst, BUNDLE OF BRAVE cut-paper build (b 0–4)
const LOGO = { l1: { y: 355, size: 250 }, l2: { y: 555, size: 190 }, l3: { y: 770, size: 250 } };
function sceneA(g, b) {
  radialBg(g, '#C3161F', C.deep);
  sunburst(g, CX, CY, 18, b * 0.12, C.gold, 0.08);
  sparkles(g, b * BEAT, 26, 11, { size: 34, col: 'gold' });
  shockwave(g, CX, CY, b, 0, C.gold, 1200, 70);
  shockwave(g, CX, CY, b, 0.12, C.white, 900, 26);

  // gem star: bursts in at the centre, then flies to its accent spot
  const gIn = pop(b, 0);
  const fly = E.inOutCubic(inv(0.55, 1.35, b));
  const gx = lerp(CX, 1540, fly), gy = lerp(CY, 205, fly);
  const gs = lerp(560, 170, fly) * gIn;
  spr(g, S.gem, gx, gy, gs, (1 - gIn) * -3 + b * 0.25 + fly * 0.6, 1);
  if (b < 1.4) sparkles(g, b * BEAT * 2, 10, 3, { area: [gx - gs / 2, gy - gs / 2, gs, gs], size: 70 });

  // stickers
  spr(g, S.cstarY, 640, 470, 150 * pop(b, 1.25), 0.2);
  spr(g, S.cstarY2, 1370, 590, 130 * pop(b, 2.2), -0.3);
  spr(g, S.cstarB, 1520, 820, 220 * pop(b, 3.0), b * 0.3);
  spr(g, S.strawberry, 330, 790, 230 * pop(b, 2.0), -0.18 + Math.sin(b * 2) * 0.05);
  spr(g, S.cstarP, 280, 330, 120 * pop(b, 2.6), 0.4);
  const ted = pop(b, 2.85);
  if (ted > 0) spr(g, S.teddy, 1665, 1230 - 290 * ted, 250, Math.sin(b * 3.2) * 0.12);

  const logo = (str, L, t0, step, seed) => text(g, str, {
    x: CX, y: L.y, size: L.size, fill: C.paper, seed, track: 0.02,
    shadow: { x: 10, y: 14, color: 'rgba(60,4,8,0.9)' },
    anim: (i) => slap(b, t0 + i * step, { seed: seed + i, from: 2.4, rot: 0.6 }),
  });
  logo('BUNDLE', LOGO.l1, 0.5, 0.22, 10);
  logo('OF', LOGO.l2, 1.9, 0.2, 30);
  logo('BRAVE', LOGO.l3, 2.45, 0.2, 50);
  // small script tagline
  const tg = inv(3.1, 3.5, b);
  if (tg > 0) {
    g.save(); g.globalAlpha = tg; g.font = '44px Quintessential'; g.fillStyle = C.cream; g.textAlign = 'center';
    g.fillText('gift a bundle. brighten a day.', CX, 955 + (1 - E.outCubic(tg)) * 20); g.restore();
  }
  drawConfetti(g, b * BEAT, B => B.t0 < 1);
}

// B — COMING THIS CHRISTMAS (b 4–8)
function sceneB(g, b) {
  const t = b * BEAT;
  radialBg(g, '#17663B', '#062616');
  const build = E.inCubic(inv(6, 8, b));
  sunburst(g, CX, CY, 22, -b * 0.1, '#FFFFFF', 0.04 + build * 0.05);
  snow(g, t, 140, 21, build * 0.9);
  // camera push through the build
  g.save();
  const z = 1 + build * 0.16;
  g.translate(CX, CY); g.scale(z, z); g.rotate(build * -0.02); g.translate(-CX, -CY);
  fairyLights(g, -40, 40, W + 40, 60, 150, 16, t, { phase: 0, sway: 30 });
  fairyLights(g, -40, 1020, W + 40, 1000, -120, 16, t, { phase: 3, sway: 30 });
  text(g, 'COMING', {
    x: CX, y: 355, size: 240, fill: C.gold, seed: 61, track: 0.02,
    extrude: { n: 10, dx: 0, dy: 1.6, color: C.goldDeep }, shadow: { x: 0, y: 34, color: 'rgba(0,0,0,.35)' },
    anim: (i) => slap(b, 4 + i * 0.05, { seed: i, from: 1, drop: -700, rot: 0.4 }),
  });
  text(g, 'THIS', {
    x: CX, y: 555, size: 120, fill: C.paper, seed: 71, track: 0.18,
    tile: { colors: [C.red, C.maroon], pad: 0.22 },
    anim: (i) => slap(b, 5 + i * 0.06, { seed: 5 + i, from: 2.6 }),
  });
  const roll = [6, 6.25, 6.5, 6.75, 7, 7.125, 7.25, 7.375, 7.5];
  const tileCols = [C.red, C.gold, C.paper, C.orange, C.white, C.pink, C.sun, C.red, C.cream];
  text(g, 'CHRISTMAS', {
    x: CX, y: 790, size: 175, seed: 81, track: 0.14, fonts: ['cut', 'mono', 'cut', 'cut', 'mono'],
    fill: (i) => ([C.paper, C.red, C.red, C.paper, C.red, C.maroon, C.red, C.paper, C.red][i]),
    tile: { colors: tileCols, pad: 0.2 }, wob: 0.1,
    anim: (i) => slap(b, roll[i], { seed: 9 + i, from: 3, rot: 0.8 }),
  });
  g.restore();
  // pre-drop whiteout
  flash(g, E.inExpo(inv(7.55, 8, b)) * 1.0);
}

// C — DROP: PACKED WITH (b 8–10)
function sceneC(g, b) {
  const t = b * BEAT;
  radialBg(g, '#D01B26', '#5A0910');
  sunburst(g, CX, 470, 16, b * 0.45, C.gold, 0.22);
  sunburst(g, CX, 470, 16, -b * 0.3 + 0.1, '#FFFFFF', 0.05);
  flyThrough(g, b, 8, 10, [S.bauble[0], S.gift[0], S.cstarY, S.bauble[1], S.candy, S.gift[2], S.note, S.bauble[3], S.cstarB, S.heart[0], S.ticket, S.gift[1]], 5);
  shockwave(g, CX, 470, b, 8, C.sun, 1300, 90);
  shockwave(g, CX, 470, b, 8.1, C.white, 1000, 30);
  shockwave(g, CX, 470, b, 9, C.sun, 900, 40);
  const pulse = 1 + 0.05 * Math.exp(-((b % 1)) * 6);
  g.save(); g.translate(CX, 470); g.scale(pulse, pulse); g.translate(-CX, -470);
  text(g, 'PACKED', {
    x: CX, y: 470, size: 330, fill: C.paper, seed: 91, track: 0.01,
    extrude: { n: 14, dx: 1.2, dy: 1.6, color: C.maroon }, shadow: { x: 20, y: 40, color: 'rgba(40,0,0,.35)' },
    anim: (i) => slap(b, 8 + i * 0.03, { seed: 20 + i, from: 3.2, rot: 0.3 }),
  });
  g.restore();
  text(g, 'WITH', {
    x: CX, y: 745, size: 170, fill: C.red, seed: 95, track: 0.12,
    tile: { colors: [C.gold, C.sun, C.gold, C.cream], pad: 0.22 },
    anim: (i) => slap(b, 9 + i * 0.07, { seed: 30 + i, from: 2.5, rot: 0.7 }),
  });
  drawConfetti(g, t, B => B.t0 >= 8 * BEAT - 0.01 && B.t0 < 10 * BEAT);
  flash(g, 1 - inv(8, 8.45, b));
}

// D1 — GAMES (b 10–12)
function sceneGames(g, b) {
  const t = b * BEAT;
  g.fillStyle = C.gold; g.fillRect(0, 0, W, H);
  harlequin(g, C.sun, 150, b * 40, 0.55);
  radialBg(g, 'rgba(255,255,255,0.0)', 'rgba(150,70,0,0.35)');
  // hoopla rings spinning in the air
  for (let i = 0; i < 4; i++) {
    const p = pop(b, 10.25 + i * 0.12);
    const x = 360 + i * 400, y = 185 + Math.sin(b * 3 + i) * 22;
    spr(g, S.ring[i], x, y, 170 * p, b * 0.8 + i, 1, 1, 0.55 + 0.45 * Math.abs(Math.cos(b * 2 + i)));
  }
  // tumbling dice
  const d = [{ x0: -200, x1: 360, y: 820, bs: 10, rot: 7 }, { x0: -300, x1: 600, y: 880, bs: 10.2, rot: 9 }];
  d.forEach((D, i) => {
    const p = clamp((b - D.bs) / 0.9);
    if (b < D.bs) return;
    const x = lerp(D.x0, D.x1, E.outCubic(p));
    const hop = Math.abs(Math.sin(p * Math.PI * 3)) * (1 - p) * 260;
    const face = p < 1 ? Math.floor(b * 8 + i * 3) % 6 : (i ? 4 : 5);
    spr(g, S.dice[face], x, D.y - hop, 230, (1 - E.outCubic(p)) * D.rot);
  });
  // target + dart thwack on beat 11
  const tp = pop(b, 10.3);
  const wob = b > 11 ? Math.exp(-(b - 11) * BEAT * 8) * Math.sin((b - 11) * BEAT * 60) * 0.06 : 0;
  spr(g, S.target, 1540, 760, 380 * tp, wob);
  const dp = inv(10.7, 11, b);
  if (dp > 0) {
    const x = lerp(2100, 1560, E.inCubic(dp)), y = lerp(300, 745, E.inCubic(dp));
    spr(g, S.dart, x + 40, y - 40, 250, 0.1 + (b > 11 ? Math.sin((b - 11) * 30) * 0.08 * Math.exp(-(b - 11) * 5) : 0));
    shockwave(g, 1545, 750, b, 11, C.red, 320, 26);
    if (b > 11) drawConfetti(g, t, B => Math.abs(B.t0 - 11 * BEAT) < 0.01);
  }
  spr(g, S.ticket, 1580, 290, 220 * pop(b, 10.9), -0.3 + Math.sin(b * 2) * 0.05);
  // GAMES — each letter hops like a bouncing ball
  text(g, 'GAMES', {
    x: CX - 30, y: 560, size: 330, fill: C.red, seed: 101, track: 0.02,
    outline: { w: 16, color: C.paper }, shadow: { x: 16, y: 22, color: 'rgba(90,30,0,.45)' },
    anim: (i) => {
      const a = slap(b, 10 + i * 0.1, { seed: 40 + i, from: 0.2, drop: -500, rot: 0.5 });
      if (!a) return null;
      a.y += -Math.abs(Math.sin((b - 10) * Math.PI + i * 0.6)) * 26;
      return a;
    },
  });
}

// D2 — FUN ACTIVITIES (b 12–14)
function sceneFun(g, b) {
  g.fillStyle = C.orange; g.fillRect(0, 0, W, H);
  sunburst(g, CX, 470, 12, b * 0.6, C.sun, 0.35);
  radialBg(g, 'rgba(255,255,255,0.0)', 'rgba(140,40,0,0.35)');
  // paint splats land on the beats
  [[300, 250, 12.25, 0], [1650, 300, 12.75, 1], [1500, 880, 13.25, 2], [420, 880, 13.5, 1]].forEach(([x, y, bs, k]) => {
    const p = pop(b, bs);
    spr(g, S.splat[k], x, y, 300 * p, bs);
  });
  spr(g, S.palette, 330, 720, 330 * pop(b, 12.2), -0.2 + Math.sin(b * 2.4) * 0.06);
  spr(g, S.pinwheel, 1600, 270, 290 * pop(b, 12.4), b * 2.5);
  spr(g, S.pinwheel, 250, 250, 200 * pop(b, 12.8), -b * 3);
  spr(g, S.brush, 1560, 820, 300 * pop(b, 12.6), Math.sin(b * 3) * 0.2);
  spr(g, S.crayon[0], 640, 950, 200 * pop(b, 13), 0.3);
  spr(g, S.crayon[1], 1290, 960, 200 * pop(b, 13.1), -0.5);
  spr(g, S.crayon[2], 1750, 560, 180 * pop(b, 13.2), 1.1);
  text(g, 'FUN', {
    x: CX, y: 440, size: 400, fill: C.paper, seed: 111, track: 0.03,
    extrude: { n: 14, dx: 0, dy: 1.8, color: C.red }, shadow: { x: 0, y: 44, color: 'rgba(120,20,0,.35)' },
    anim: (i) => {
      const a = slap(b, 12 + i * 0.08, { seed: 50 + i, from: 3, rot: 0.4 });
      if (a) a.r += Math.sin(b * Math.PI + i) * 0.05;
      return a;
    },
  });
  // ACTIVITIES on a strip of black tape that unrolls
  const u = E.outExpo(inv(12.5, 12.95, b));
  if (u > 0) {
    g.save(); g.translate(CX, 740); g.rotate(-0.03);
    const tw = 1300;
    g.beginPath(); g.rect(-tw / 2 - 20, -110, (tw + 40) * u, 220); g.clip();
    g.fillStyle = 'rgba(80,20,0,.35)'; g.fillRect(-tw / 2 + 10, -72, tw, 160);
    g.fillStyle = C.ink;
    g.beginPath(); g.moveTo(-tw / 2, -80);
    for (let x = -tw / 2; x <= tw / 2; x += 26) g.lineTo(x, -80 + (hash(x) - .5) * 8);
    for (let x = tw / 2; x >= -tw / 2; x -= 26) g.lineTo(x, 80 + (hash(x + 3) - .5) * 8);
    g.fill();
    text(g, 'ACTIVITIES', {
      x: 0, y: 0, size: 128, fill: (i) => [C.sun, C.pink, C.sky, C.gold, C.leaf][i % 5], seed: 121, track: 0.07,
      anim: (i) => slap(b, 12.55 + i * 0.035, { seed: 60 + i, from: 1.8, rot: 0.3 }),
    });
    g.restore();
  }
}

// D3 — ENTERTAINMENT (b 14–16): marquee sign + spotlights + flying notes
function sceneEnt(g, b) {
  const t = b * BEAT;
  radialBg(g, '#5A0C1C', '#12020A', CX, 900);
  // spotlights
  g.save(); g.globalCompositeOperation = 'lighter';
  [[260, 1.0], [1660, -1.0], [CX, 0]].forEach(([x, dir], i) => {
    const a = Math.PI - dir * 0.38 + Math.sin(b * 1.6 + i * 2) * 0.3;
    g.save(); g.translate(x, -60); g.rotate(a);
    const gr = g.createLinearGradient(0, 0, 0, -1400);
    gr.addColorStop(0, 'rgba(255,230,160,0.55)'); gr.addColorStop(1, 'rgba(255,200,120,0)');
    g.fillStyle = gr; g.beginPath(); g.moveTo(-30, 0); g.lineTo(-260, -1400); g.lineTo(260, -1400); g.lineTo(30, 0); g.fill();
    g.restore();
  });
  g.restore();
  sparkles(g, t, 40, 33, { size: 30, col: 'gold' });
  // notes rising
  const r = rng(71);
  for (let i = 0; i < 16; i++) {
    const x = r() * W, st = 14 + r() * 1.6, sp = 0.6 + r() * 0.5, Sx = [S.note, S.note1, S.noteP][i % 3];
    const p = (b - st) / 1.8;
    if (p <= 0 || p >= 1) continue;
    spr(g, Sx, x + Math.sin(p * 6 + i) * 40, lerp(1150, -100, p * sp + 0.2), 120 + r() * 80, Math.sin(p * 5 + i) * 0.4, clamp(p * 6));
  }
  // marquee board
  const bp = pop(b, 14);
  if (bp > 0) {
    g.save(); g.translate(CX, 520); g.scale(bp, bp); g.rotate((1 - clamp(bp)) * 0.2);
    const bw = 1560, bh = 330;
    g.fillStyle = 'rgba(0,0,0,.4)'; rrect(g, -bw / 2 + 16, -bh / 2 + 24, bw, bh, 40); g.fill();
    g.fillStyle = C.goldDeep; rrect(g, -bw / 2 - 8, -bh / 2 - 8, bw + 16, bh + 16, 46); g.fill();
    g.fillStyle = C.gold; rrect(g, -bw / 2, -bh / 2, bw, bh, 40); g.fill();
    g.fillStyle = C.red; rrect(g, -bw / 2 + 36, -bh / 2 + 36, bw - 72, bh - 72, 22); g.fill();
    // chasing bulbs around the border
    const per = [];
    const nx = 26, ny = 6;
    for (let i = 0; i < nx; i++) per.push([-bw / 2 + 18 + i * (bw - 36) / (nx - 1), -bh / 2 + 18]);
    for (let i = 1; i < ny; i++) per.push([bw / 2 - 18, -bh / 2 + 18 + i * (bh - 36) / ny]);
    for (let i = nx - 1; i >= 0; i--) per.push([-bw / 2 + 18 + i * (bw - 36) / (nx - 1), bh / 2 - 18]);
    for (let i = ny - 1; i >= 1; i--) per.push([-bw / 2 + 18, -bh / 2 + 18 + i * (bh - 36) / ny]);
    const step = Math.floor(b * 4);
    per.forEach(([x, y], i) => {
      const on = (i + step) % 3 === 0;
      if (on) { g.globalCompositeOperation = 'lighter'; glowDot(g, x, y, 30, 'rgba(255,240,180,0.9)'); g.globalCompositeOperation = 'source-over'; }
      g.fillStyle = on ? '#FFFBE6' : '#C98A1A'; g.beginPath(); g.arc(x, y, 9, 0, TAU); g.fill();
    });
    // letters flicker on like neon
    text(g, 'ENTERTAINMENT', {
      x: 0, y: 6, size: 142, fill: C.paper, seed: 131, track: 0.03, jit: 0.025,
      shadow: { x: 6, y: 8, color: C.maroon },
      anim: (i) => {
        const on = b - (14.05 + i * 0.045);
        if (on < 0) return null;
        const fl = on < 0.25 ? (hash(Math.floor(on * 40) + i * 13) > 0.4 ? 1 : 0.15) : 1;
        return { a: fl, s: 1 + Math.exp(-on * 8) * 0.25 };
      },
    });
    g.restore();
  }
  spr(g, S.mic, 250, 850, 300 * pop(b, 14.5), -0.35 + Math.sin(b * 3) * 0.08);
  spr(g, S.cstarY, 1680, 860, 220 * pop(b, 14.75), b * 0.6);
  spr(g, S.cstarP, 1770, 180, 150 * pop(b, 15), -b * 0.4);
  spr(g, S.note, 150, 200, 170 * pop(b, 15.1), Math.sin(b * 4) * 0.2);
}

// D4 — LAUGHTER (b 16–18)
function sceneLaugh(g, b) {
  g.fillStyle = C.pink; g.fillRect(0, 0, W, H);
  halftone(g, C.magenta, 0.35, b * BEAT);
  radialBg(g, 'rgba(255,255,255,0.12)', 'rgba(120,0,40,0.25)');
  const has = [[330, 240, 16.5, -0.2, 0], [1560, 230, 17, 0.2, 1], [1600, 880, 17.5, -0.15, 2], [330, 860, 17.25, 0.15, 3]];
  has.forEach(([x, y, bs, rot, k]) => {
    text(g, 'HA!', {
      x, y, size: 120, fill: C.red, seed: 140 + k, track: 0.05, tile: { colors: [C.sun, C.white, C.cream], offset: k },
      anim: (i) => { const a = slap(b, bs + i * 0.06, { seed: k * 5 + i, from: 2.5 }); if (a) a.r += rot + Math.sin(b * 8 + i) * 0.08; return a; },
    });
  });
  // bouncing smileys
  [[640, 190, 16.2], [1300, 170, 16.4]].forEach(([x, y, bs], i) => {
    const p = pop(b, bs);
    spr(g, S.smiley, x, y + Math.abs(Math.sin(b * Math.PI)) * -20, 170 * p, Math.sin(b * 5 + i) * 0.25);
  });
  // teddy giggling
  const tp = pop(b, 16.6);
  if (tp > 0) spr(g, S.teddy, CX, 1260 - 290 * tp, 330, Math.sin(b * 9) * 0.1, 1, 1 + Math.sin(b * 18) * 0.03, 1 - Math.sin(b * 18) * 0.03);
  spr(g, S.heart[1], 1200, 900, 120 * pop(b, 17), Math.sin(b * 4) * 0.3);
  spr(g, S.heart[0], 720, 920, 100 * pop(b, 17.4), -Math.sin(b * 4) * 0.3);
  text(g, 'LAUGHTER', {
    x: CX, y: 540, size: 240, fill: C.paper, seed: 151, track: 0.02,
    extrude: { n: 12, dx: 0, dy: 1.6, color: C.maroon }, shadow: { x: 0, y: 34, color: 'rgba(120,0,40,.3)' },
    anim: (i) => {
      const a = slap(b, 16 + i * 0.05, { seed: 70 + i, from: 2.6, rot: 0.6 });
      if (!a) return null;
      // giggle: letters bob out of phase
      a.y += Math.sin(b * Math.PI * 2 + i * 0.9) * 16;
      a.r += Math.sin(b * Math.PI * 2 + i * 1.3) * 0.06;
      return a;
    },
  });
}

// D5 — FESTIVE VIBES (b 18–20)
function sceneFestive(g, b) {
  const t = b * BEAT;
  radialBg(g, '#1B7442', '#07301B');
  snow(g, t, 110, 44);
  // balloons rising
  const r = rng(8);
  for (let i = 0; i < 12; i++) {
    const x = 80 + r() * (W - 160), st = 17.8 + r() * 1.2, sp = 700 + r() * 400, k = i % S.balloon.length, sz = 170 + r() * 90;
    const dt = (b - st) * BEAT;
    if (dt <= 0) continue;
    const y = 1250 - dt * sp, sw = Math.sin(dt * 2.5 + i) * 30;
    g.strokeStyle = 'rgba(255,255,255,.7)'; g.lineWidth = 2.5; g.beginPath(); g.moveTo(x + sw, y + sz * 0.5);
    g.bezierCurveTo(x + sw - 20, y + sz * 0.9, x + sw + 20, y + sz * 1.2, x + sw, y + sz * 1.5); g.stroke();
    spr(g, S.balloon[k], x + sw, y, sz, Math.sin(dt * 2 + i) * 0.12);
  }
  // hanging baubles swinging from the top
  [[260, 250, 0], [560, 170, 1], [1360, 190, 3], [1680, 270, 4]].forEach(([x, len, k], i) => {
    const drop = E.outBack(clamp((b - 18 - i * 0.08) / 0.5), 2.2);
    const a = Math.sin(b * 2.4 + i) * 0.22 * (1 + Math.exp(-(b - 18) * 2));
    const L = len * drop;
    const bx = x + Math.sin(a) * L, by = -20 + Math.cos(a) * L;
    g.strokeStyle = C.gold; g.lineWidth = 3; g.beginPath(); g.moveTo(x, -20); g.lineTo(bx, by); g.stroke();
    spr(g, S.bauble[k], bx, by + 60, 150, -a);
  });
  fairyLights(g, -40, 30, W + 40, 30, 120, 18, t, { phase: 1, sway: 20, size: 1.1 });
  // gift box pops at beat 19
  const gp = pop(b, 18.3);
  spr(g, S.gift[0], 1620, 870, 250 * gp, Math.sin(b * 3) * 0.05);
  spr(g, S.gift[1], 290, 880, 220 * pop(b, 18.5), -Math.sin(b * 3) * 0.05);
  spr(g, S.tree, 1280, 890, 250 * pop(b, 18.7), 0);
  spr(g, S.candy, 620, 900, 190 * pop(b, 18.9), 0.3);
  if (b > 19) { shockwave(g, 1620, 820, b, 19, C.sun, 400, 26); drawConfetti(g, t, B => Math.abs(B.t0 - 19 * BEAT) < 0.01); }
  text(g, 'FESTIVE', {
    x: CX, y: 440, size: 250, fill: C.gold, seed: 161, track: 0.02,
    extrude: { n: 11, dx: 0, dy: 1.6, color: C.goldDeep }, shadow: { x: 0, y: 30, color: 'rgba(0,0,0,.35)' },
    anim: (i) => slap(b, 18 + i * 0.05, { seed: 80 + i, from: 2.4, rot: 0.5 }),
  });
  text(g, 'VIBES', {
    x: CX, y: 690, size: 190, fill: C.red, seed: 171, track: 0.14,
    tile: { colors: [C.paper, C.cream, C.white], pad: 0.24 },
    anim: (i) => {
      const a = slap(b, 18.5 + i * 0.07, { seed: 90 + i, from: 2.6, rot: 0.8 });
      if (a) a.y += Math.sin(b * Math.PI * 2 + i) * 10;
      return a;
    },
  });
}

// E — rapid-fire montage on 8th notes (b 20–24)
const CUTS = [
  { w: 'PLAY', bg: C.red, st: [C.red, '#B8141F'], fg: C.gold, ic: () => S.dice[5] },
  { w: 'SING', bg: C.holly, st: [C.holly, '#228A4E'], fg: C.paper, ic: () => S.mic },
  { w: 'DANCE', bg: C.magenta, st: [C.magenta, C.pink], fg: C.paper, ic: () => S.note },
  { w: 'LAUGH', bg: C.gold, st: [C.gold, C.sun], fg: C.red, ic: () => S.smiley },
  { w: 'CHEER', bg: C.orange, st: [C.orange, '#FFA640'], fg: C.paper, ic: () => S.cstarY },
  { w: 'SPARKLE', bg: C.slate, st: [C.slate, '#3C536B'], fg: C.sun, ic: () => S.gem },
  { w: 'CELEBRATE', bg: C.red, st: [C.red, C.maroon], fg: C.paper, ic: () => S.gift[2] },
  { w: 'TOGETHER', bg: C.pine, st: [C.pine, C.holly], fg: C.gold, ic: () => S.heart[1] },
];
function sceneMontage(g, b) {
  const k = clamp(Math.floor((b - 20) * 2), 0, 7), c = CUTS[k], lb = b - (20 + k * 0.5);
  const build = inv(22, 24, b);
  stripes(g, c.st, 90, b * 400 * (k % 2 ? -1 : 1), 0.5 + k * 0.3);
  radialBg(g, 'rgba(0,0,0,0)', 'rgba(0,0,0,0.35)');
  g.save();
  const z = 1 + build * 0.2 + Math.exp(-lb * BEAT * 14) * 0.12;
  g.translate(CX, CY); g.scale(z, z); g.rotate((k % 2 ? 1 : -1) * 0.03 * (1 - clamp(lb * 2))); g.translate(-CX, -CY);
  const ic = c.ic();
  spr(g, ic, CX, CY, 700 * (0.8 + 0.2 * pop(b, 20 + k * 0.5)), (k % 2 ? 1 : -1) * (0.2 + lb * 0.3), 0.95);
  const Ls = layout(c.w, 'cut', 280, 0.02);
  const size = Math.min(280, 280 * 1300 / Ls.width);
  text(g, c.w, {
    x: CX, y: CY + 20, size, fill: c.fg, seed: 200 + k, track: 0.02,
    outline: { w: 14, color: C.ink }, shadow: { x: 14, y: 20, color: 'rgba(0,0,0,.4)' },
    anim: (i) => {
      const a = slap(b, 20 + k * 0.5 + i * 0.012, { seed: 100 + k * 10 + i, from: 1.7, rot: 0.3 });
      return a;
    },
  });
  g.restore();
  sparkles(g, b * BEAT, 20, 90 + k, { size: 40 });
  flash(g, E.inExpo(inv(23.55, 24, b)));
}

// F/G — finale: BUNDLE OF BRAVE / FETE slam, then the end card (b 24–32)
function sceneFinale(g, b) {
  const t = b * BEAT;
  radialBg(g, '#C8161F', '#3E0509');
  sunburst(g, CX, 560, 20, b * 0.18, C.gold, 0.14 + 0.06 * Math.exp(-(b % 1) * 4));
  sparkles(g, t, 36, 55, { size: 36, col: 'gold' });
  fairyLights(g, -40, 20, W + 40, 20, 90, 20, t, { phase: 2, sway: 10, chase: 0.5 });
  // end-card settle: title group rises and shrinks a touch at the button (b 28)
  const settle = E.inOutCubic(inv(28, 28.9, b));
  const gy = lerp(0, -95, settle), gz = lerp(1, 0.86, settle);
  shockwave(g, CX, 640, b, 25.5, C.sun, 1100, 60);
  shockwave(g, CX, 640, b, 26, C.white, 1200, 60);
  shockwave(g, CX, 540, b, 28, C.sun, 1400, 90);
  g.save();
  g.translate(CX, 540 + gy); g.scale(gz, gz); g.translate(-CX, -540);
  // stickers around the title
  spr(g, S.strawberry, 250, 660, 240 * pop(b, 27), -0.2 + Math.sin(b * 2) * 0.06);
  spr(g, S.teddy, 1680, 690, 260 * pop(b, 27.5), 0.12 + Math.sin(b * 2.6) * 0.06);
  spr(g, S.cstarB, 1740, 180, 150 * pop(b, 26.5), b * 0.4);
  spr(g, S.cstarY, 190, 190, 140 * pop(b, 26.25), -b * 0.3);
  // BUNDLE OF BRAVE — letters converge from everywhere
  const r0 = rng(300);
  const dirs = [];
  for (let i = 0; i < 15; i++) dirs.push([(r0() - .5) * 2600, (r0() - .5) * 1600, (r0() - .5) * 6]);
  text(g, 'BUNDLE OF BRAVE', {
    x: CX, y: 300, size: 130, fill: C.paper, seed: 301, track: 0.03,
    shadow: { x: 7, y: 10, color: 'rgba(50,0,5,.8)' },
    anim: (i) => {
      const st = 24 + i * 0.03;
      const x = (b - st) * BEAT;
      if (x < 0) return null;
      const k = E.outCubic(clamp(x / 0.32));
      const s = slap(b, st + 0.32 / BEAT, { seed: i, from: 1.3, rot: 0.1 });
      return {
        x: dirs[i][0] * (1 - k), y: dirs[i][1] * (1 - k), r: dirs[i][2] * (1 - k),
        s: s ? s.s : 1.3 - 0.3 * k, sx: s ? s.sx : 1, sy: s ? s.sy : 1, flash: s ? s.flash : 0,
      };
    },
  });
  // FETE — giant gold extruded letters on the brass stabs (25.5, 26)
  const hits = [25.5, 25.5, 26, 26];
  const sweep = inv(30, 30.8, b);
  text(g, 'FETE', {
    x: CX, y: 640, size: 440, fill: C.gold, seed: 311, track: 0.04,
    extrude: { n: 20, dx: 0.8, dy: 1.6, color: '#8C4F07' }, shadow: { x: 20, y: 60, color: 'rgba(30,0,0,.4)' },
    outline: { w: 10, color: C.paper },
    gloss: (i) => {
      if (sweep <= 0 || sweep >= 1) return null;
      const gx = lerp(-3, 3, sweep) - (i - 1.5) * 0.9;
      const gr = g.createLinearGradient(gx - 0.35, -0.5, gx + 0.35, 0.5);
      gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.85)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      return gr;
    },
    anim: (i) => {
      const a = slap(b, hits[i] + (i % 2) * 0.08, { seed: 400 + i, from: 3.4, rot: 0.25 });
      if (!a) return null;
      a.s *= 1 + 0.04 * Math.exp(-((b - 28) * BEAT) * 6) * (b > 28) + 0.05 * Math.exp(-((b - 30) * BEAT) * 6) * (b > 30);
      return a;
    },
  });
  // gem star crowns the E on beat 27
  const gp = pop(b, 27);
  spr(g, S.gem, 1630, 400, 180 * gp, (1 - clamp(gp)) * 6 + Math.sin(b * 2) * 0.1);
  if (b > 27) sparkles(g, t * 2, 8, 7, { area: [1550, 320, 160, 160], size: 60 });
  // snare-fill star pops
  for (let i = 0; i < 8; i++) {
    const st = 27 + i * 0.125, rr = rng(500 + i);
    spr(g, rr() > .5 ? S.sparkle : S.sparkleG, 300 + rr() * 1320, 150 + rr() * 700, 90 * clamp(1 - (b - st) * 1.5) * (b > st), 0);
  }
  g.restore();

  // end card: ribbon banner + presented by
  const rib = E.outExpo(inv(28, 28.7, b));
  if (rib > 0) {
    g.save(); g.translate(CX, 862); g.rotate(-0.015);
    const rw = 1400 * rib, rh = 120;
    // ribbon tails
    g.fillStyle = C.goldDeep;
    [-1, 1].forEach(s => {
      g.beginPath(); g.moveTo(s * (rw / 2 - 40), -rh / 2 + 22); g.lineTo(s * (rw / 2 + 90), -rh / 2 + 22);
      g.lineTo(s * (rw / 2 + 50), 22); g.lineTo(s * (rw / 2 + 90), rh / 2 + 22); g.lineTo(s * (rw / 2 - 40), rh / 2 + 22); g.fill();
    });
    g.fillStyle = C.gold; g.fillRect(-rw / 2, -rh / 2, rw, rh);
    g.fillStyle = 'rgba(255,255,255,.25)'; g.fillRect(-rw / 2, -rh / 2, rw, 10);
    g.beginPath(); g.rect(-rw / 2, -rh / 2, rw, rh); g.clip();
    text(g, 'COMING THIS CHRISTMAS', {
      x: 0, y: 2, size: 72, fill: C.red, seed: 601, track: 0.05, jit: 0.025,
      anim: (i) => slap(b, 28.15 + i * 0.03, { seed: 700 + i, from: 1.8, rot: 0.3 }),
    });
    g.restore();
  }
  const pb = inv(29, 29.8, b);
  if (pb > 0) {
    g.save();
    g.font = '58px Quintessential'; g.textAlign = 'center'; g.textBaseline = 'middle';
    const str = 'presented by Bundle of Brave';
    const tw = g.measureText(str).width;
    g.beginPath(); g.rect(CX - tw / 2 - 20, 940, (tw + 40) * E.outCubic(pb), 90); g.clip();
    g.fillStyle = 'rgba(40,0,0,.5)'; g.fillText(str, CX + 3, 989);
    g.fillStyle = C.cream; g.fillText(str, CX, 985);
    g.restore();
  }
  drawConfetti(g, t, B => B.t0 >= 24 * BEAT - 0.01);
  flash(g, 1 - inv(24, 24.4, b));
  flash(g, (1 - inv(28, 28.3, b)) * 0.7 * (b >= 28), '255,245,220');
  flash(g, (1 - inv(30, 30.25, b)) * 0.45 * (b >= 30), '255,245,220');
}

// ------------------------------------------------------------------ timeline
const SCENES = [
  { b0: 0, b1: 4, fn: sceneA },
  { b0: 4, b1: 8, fn: sceneB },
  { b0: 8, b1: 10, fn: sceneC },
  { b0: 10, b1: 12, fn: sceneGames },
  { b0: 12, b1: 14, fn: sceneFun },
  { b0: 14, b1: 16, fn: sceneEnt },
  { b0: 16, b1: 18, fn: sceneLaugh },
  { b0: 18, b1: 20, fn: sceneFestive },
  { b0: 20, b1: 24, fn: sceneMontage },
  { b0: 24, b1: 32.1, fn: sceneFinale },
];
// transitions end exactly on the downbeat so the next scene's hit lands on it
const TRANS = [
  { at: 4, len: 0.5, type: 'iris', x: CX, y: LOGO.l2.y, ring: C.gold },
  { at: 10, len: 0.3, type: 'slash', cols: [C.paper, C.red], dir: 1 },
  { at: 12, len: 0.3, type: 'iris', x: 1545, y: 750, ring: C.red },
  { at: 14, len: 0.3, type: 'slash', cols: [C.gold, C.ink], dir: -1 },
  { at: 16, len: 0.3, type: 'iris', x: 250, y: 830, ring: C.pink },
  { at: 18, len: 0.3, type: 'blinds', cols: [C.gold, C.red] },
  { at: 20, len: 0.3, type: 'slash', cols: [C.paper, C.gold], dir: 1 },
];
function sceneAt(b) {
  for (const s of SCENES) if (b >= s.b0 && b < s.b1) return s;
  return SCENES[SCENES.length - 1];
}
function slashPoly(g, e, dir) { // region "behind" an edge moving across the frame
  const k = 380;
  g.beginPath();
  if (dir > 0) { g.moveTo(-k, -10); g.lineTo(e + k, -10); g.lineTo(e - k, H + 10); g.lineTo(-k, H + 10); }
  else { g.moveTo(W + k, -10); g.lineTo(W - e - k, -10); g.lineTo(W - e + k, H + 10); g.lineTo(W + k, H + 10); }
  g.closePath();
}
function drawTransition(g, T, b, from, to) {
  const p = clamp((b - (T.at - T.len)) / T.len);
  from.fn(g, b);
  if (T.type === 'iris') {
    const R = E.inCubic(p) * 2300;
    g.save(); g.beginPath(); g.arc(T.x, T.y, R, 0, TAU); g.clip(); to.fn(g, b); g.restore();
    g.save(); g.strokeStyle = T.ring; g.lineWidth = 30 + 30 * p; g.beginPath(); g.arc(T.x, T.y, R, 0, TAU); g.stroke();
    g.strokeStyle = C.white; g.lineWidth = 8; g.beginPath(); g.arc(T.x, T.y, R + 34 + 30 * p, 0, TAU); g.stroke(); g.restore();
  } else if (T.type === 'slash') {
    const span = W + 800;
    const edges = [0, 0.18, 0.36].map(d => E.inOutCubic(clamp(p * 1.36 - d)) * span - 20);
    T.cols.forEach((c, i) => { g.save(); slashPoly(g, edges[i], T.dir); g.fillStyle = c; g.fill(); g.restore(); });
    g.save(); slashPoly(g, edges[2], T.dir); g.clip(); to.fn(g, b); g.restore();
  } else if (T.type === 'blinds') {
    const n = 8, w = W / n;
    for (let i = 0; i < n; i++) {
      const q = E.outCubic(clamp(p * 1.6 - i * 0.075));
      const q2 = E.outCubic(clamp(p * 1.6 - i * 0.075 - 0.25));
      const down = i % 2 === 0;
      g.fillStyle = T.cols[i % 2];
      if (down) g.fillRect(i * w, 0, w + 1, H * q); else g.fillRect(i * w, H * (1 - q), w + 1, H * q);
      g.save(); g.beginPath();
      if (down) g.rect(i * w, 0, w + 1, H * q2); else g.rect(i * w, H * (1 - q2), w + 1, H * q2);
      g.clip(); to.fn(g, b); g.restore();
    }
  }
}

// camera: shake on the big hits, micro zoom pulse on the kicks in the drop
const HITS = [[0, 1], [8, 1.3], [11, 0.4], [24, 1.2], [25.5, 0.8], [26, 1], [28, 1.2], [30, 0.9]];
function camera(g, b) {
  const t = b * BEAT;
  let sx = 0, sy = 0, rot = 0;
  for (const [hb, s] of HITS) {
    const d = (b - hb) * BEAT;
    if (d < 0 || d > 0.6) continue;
    const k = s * Math.exp(-d * 9);
    sx += noise1(t * 40, hb) * 26 * k; sy += noise1(t * 40, hb + 5) * 26 * k; rot += noise1(t * 30, hb + 9) * 0.012 * k;
  }
  let z = 1;
  if (b >= 8 && b < 28) z += 0.012 * Math.exp(-(b % 1) * BEAT * 10);
  g.translate(CX + sx, CY + sy); g.rotate(rot); g.scale(z, z); g.translate(-CX, -CY);
}

function drawFrame(g, t) {
  const b = t / BEAT;
  g.save();
  g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
  camera(g, b);
  let T = null;
  for (const tr of TRANS) if (b >= tr.at - tr.len && b < tr.at) T = tr;
  if (T) drawTransition(g, T, b, sceneAt(T.at - 0.001), sceneAt(T.at));
  else sceneAt(b).fn(g, b);
  g.restore();
  overlayTextures(g, t);
}

// ------------------------------------------------------------------ confetti cues
function setupBursts() {
  addBurst(0, CX, CY, -Math.PI / 2, TAU, 2200, 160, 1, { g: 700 });
  addBurst(8, -20, 1100, -1.0, 0.5, 3300, 240, 2);
  addBurst(8, W + 20, 1100, -Math.PI + 1.0, 0.5, 3300, 240, 3);
  addBurst(8, CX, 470, 0, TAU, 2600, 200, 4, { g: 800 });
  addBurst(9, CX, 745, -Math.PI / 2, 2.4, 1900, 100, 5);
  addBurst(11, 1545, 750, -Math.PI / 2 - 0.4, 2.6, 1600, 90, 6, { cols: [C.red, C.paper, C.ink, C.white] });
  addBurst(19, 1620, 800, -Math.PI / 2, 1.2, 2200, 120, 7);
  addBurst(24, -20, 1100, -1.05, 0.5, 3400, 260, 8);
  addBurst(24, W + 20, 1100, -Math.PI + 1.05, 0.5, 3400, 260, 9);
  addBurst(26, CX, 640, 0, TAU, 2800, 220, 10, { g: 800 });
  addBurst(28, CX, -60, Math.PI / 2, 2.8, 900, 320, 11, { g: 500, life: 6 });
  addBurst(30, -20, 900, -0.8, 0.6, 3000, 180, 12);
  addBurst(30, W + 20, 900, -Math.PI + 0.8, 0.6, 3000, 180, 13);
}

// ------------------------------------------------------------------ boot
let motionSamples = 1, shutter = 0.5, fps = 60;
const acc = mkCanvas(W, H), accG = acc.getContext('2d');
// other films (src/invite.js) reuse this engine and swap in their own draw()
window.BOB = {
  W, H, CX, CY, TAU, C, FESTIVE, clamp, lerp, inv, E, spring, rng, hash, noise1, mkCanvas, rrect, starPath,
  text, layout, slap, spr, pop, S, IMG, ICON, bake, radialBg, sunburst, harlequin, halftone, stripes, shockwave,
  flash, glowDot, fairyLights, sparkles, snow, BURSTS, addBurst, drawConfetti, overlayTextures, loadImg,
  draw: null,
};
const frameFn = () => window.BOB.draw || drawFrame;
window.renderFrame = (t) => {
  const drawFrame = frameFn();
  if (motionSamples <= 1) { drawFrame(ctx, t); return; }
  // motion blur: average sub-frames across the shutter interval
  for (let i = 0; i < motionSamples; i++) {
    const st = t + (i / motionSamples - 0.5) * shutter / fps;
    drawFrame(accG, Math.max(0, st));
    ctx.globalAlpha = 1 / (i + 1);
    ctx.drawImage(acc, 0, 0);
  }
  ctx.globalAlpha = 1;
};
window.setMotion = (n, sh = 0.5, f = 60) => { motionSamples = n; shutter = sh; fps = f; };
window.TEASER = { W, H, DUR, BEAT };

window.ready = (async () => {
  await Promise.all([
    loadImg('strawberry', '../assets/strawberry.png'),
    loadImg('gem', '../assets/gem-star.png'),
    loadImg('teddy', '../assets/teddy-cut.png'),
    document.fonts.load('58px Quintessential'),
    document.fonts.load('40px "Caveat Brush"'),
  ]);
  buildTextures();
  buildSprites();
  setupBursts();
  window.renderFrame(0);
  return true;
})();

// interactive preview: open src/index.html?play (click to start with music)
if (location.search.includes('play') && !window.BOB_EXTERNAL) {
  document.body.classList.add('preview');
  window.ready.then(() => {
    const audio = new Audio('../build/music.wav');
    let t0 = null;
    const loop = (now) => {
      if (t0 !== null) {
        const t = audio.currentTime;
        window.renderFrame(Math.min(t, DUR - 0.001));
      }
      requestAnimationFrame(loop);
    };
    document.body.addEventListener('click', () => { audio.currentTime = 0; audio.play(); t0 = 0; });
    requestAnimationFrame(loop);
  });
}
})();
