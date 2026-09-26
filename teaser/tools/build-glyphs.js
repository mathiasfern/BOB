// Turns font outlines into angular "cut-paper" polygons.
// Curves are flattened, then heavily simplified (Ramer–Douglas–Peucker) so every
// letter looks like it was snipped out of card with scissors, like the logo.
// Output: src/glyphs.js  ->  window.GLYPHS = { fontKey: { char: {a, c:[[x,y,...]]} } }
const fs = require('fs');
const path = require('path');
const opentype = require('opentype.js');

const ROOT = path.join(__dirname, '..');
const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!?&.,\'-+:';
const FONTS = {
  cut: { file: 'BowlbyOne.ttf', eps: 0.028 },   // chunky cut-paper display
  mono: { file: 'RubikMonoOne.ttf', eps: 0.03 }, // wide geometric tiles
};

function flatten(cmds, step) {
  const contours = [];
  let cur = null, x = 0, y = 0;
  for (const c of cmds) {
    if (c.type === 'M') { cur = [[c.x, c.y]]; contours.push(cur); x = c.x; y = c.y; }
    else if (c.type === 'L') { cur.push([c.x, c.y]); x = c.x; y = c.y; }
    else if (c.type === 'Q') {
      for (let i = 1; i <= step; i++) {
        const t = i / step, u = 1 - t;
        cur.push([u * u * x + 2 * u * t * c.x1 + t * t * c.x, u * u * y + 2 * u * t * c.y1 + t * t * c.y]);
      }
      x = c.x; y = c.y;
    } else if (c.type === 'C') {
      for (let i = 1; i <= step; i++) {
        const t = i / step, u = 1 - t;
        cur.push([
          u * u * u * x + 3 * u * u * t * c.x1 + 3 * u * t * t * c.x2 + t * t * t * c.x,
          u * u * u * y + 3 * u * u * t * c.y1 + 3 * u * t * t * c.y2 + t * t * t * c.y,
        ]);
      }
      x = c.x; y = c.y;
    }
  }
  return contours.filter(c => c.length > 2);
}

function rdp(pts, eps) {
  if (pts.length < 3) return pts;
  const [a, b] = [pts[0], pts[pts.length - 1]];
  let idx = 0, max = 0;
  const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy) || 1;
  for (let i = 1; i < pts.length - 1; i++) {
    const d = Math.abs(dy * pts[i][0] - dx * pts[i][1] + b[0] * a[1] - b[1] * a[0]) / len;
    if (d > max) { max = d; idx = i; }
  }
  if (max <= eps) return [a, b];
  const l = rdp(pts.slice(0, idx + 1), eps), r = rdp(pts.slice(idx), eps);
  return l.slice(0, -1).concat(r);
}

// closed-contour RDP: split at the point farthest from the first one
function rdpClosed(pts, eps) {
  let far = 0, fd = 0;
  for (let i = 1; i < pts.length; i++) {
    const d = Math.hypot(pts[i][0] - pts[0][0], pts[i][1] - pts[0][1]);
    if (d > fd) { fd = d; far = i; }
  }
  const a = rdp(pts.slice(0, far + 1), eps);
  const b = rdp(pts.slice(far).concat([pts[0]]), eps);
  return a.slice(0, -1).concat(b.slice(0, -1));
}

const out = {};
for (const [key, spec] of Object.entries(FONTS)) {
  const font = opentype.loadSync(path.join(ROOT, 'fonts', spec.file));
  const upm = font.unitsPerEm;
  out[key] = { capH: (font.tables.os2.sCapHeight || upm * 0.7) / upm };
  for (const ch of CHARS) {
    const g = font.charToGlyph(ch);
    const p = g.getPath(0, 0, 1); // 1 = em size, y down
    const contours = flatten(p.commands, 10)
      .map(c => rdpClosed(c, spec.eps))
      .filter(c => c.length >= 3)
      .map(c => c.flatMap(([x, y]) => [+x.toFixed(4), +y.toFixed(4)]));
    out[key][ch] = { a: +(g.advanceWidth / upm).toFixed(4), c: contours };
  }
}
fs.mkdirSync(path.join(ROOT, 'src'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'src', 'glyphs.js'), 'window.GLYPHS=' + JSON.stringify(out) + ';\n');
console.log('glyphs written', Object.keys(out).map(k => k + ':' + Object.keys(out[k]).length).join(' '));
