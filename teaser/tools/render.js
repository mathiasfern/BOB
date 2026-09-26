// Renders the teaser frame-by-frame in headless Chromium and encodes it with ffmpeg.
//
//   node tools/render.js                  -> build/bundle-of-brave-fete-teaser.mp4 (1080p60)
//   node tools/render.js --stills 0.5,3,8 -> build/stills/*.png (quick look at given seconds)
//   options: --fps 60  --workers 4  --blur 3 (motion-blur sub-samples)
const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn, execFileSync } = require('child_process');
const { chromium } = require('playwright');

const ROOT = path.join(__dirname, '..');
const BUILD = path.join(ROOT, 'build');
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const FPS = +opt('fps', 60), WORKERS = +opt('workers', 4), BLUR = +opt('blur', 3);
const DUR = 15;
const FFMPEG = execFileSync('python3', ['-c', 'import imageio_ffmpeg as i;print(i.get_ffmpeg_exe())']).toString().trim();

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png', '.ttf': 'font/ttf', '.wav': 'audio/wav', '.jpg': 'image/jpeg', '.webp': 'image/webp' };
function serve() {
  return new Promise(res => {
    const srv = http.createServer((q, r) => {
      const f = path.join(ROOT, decodeURIComponent(q.url.split('?')[0]));
      if (!f.startsWith(ROOT) || !fs.existsSync(f)) { r.writeHead(404); return r.end(); }
      r.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' });
      fs.createReadStream(f).pipe(r);
    }).listen(0, () => res(srv));
  });
}

async function openPage(browser, port) {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  page.on('pageerror', e => console.error('PAGE ERROR', e.message));
  page.on('console', m => { if (m.type() === 'error') console.error('console:', m.text()); });
  await page.goto(`http://localhost:${port}/src/index.html`);
  await page.evaluate(() => window.ready);
  await page.evaluate(([n, f]) => window.setMotion(n, 0.5, f), [BLUR, FPS]);
  return page;
}

async function grab(page, t) {
  await page.evaluate(t => window.renderFrame(t), t);
  return page.screenshot({ type: 'png', clip: { x: 0, y: 0, width: 1920, height: 1080 } });
}

async function stills(browser, port, times) {
  const dir = path.join(BUILD, 'stills');
  fs.mkdirSync(dir, { recursive: true });
  const page = await openPage(browser, port);
  for (const t of times) {
    const buf = await grab(page, t);
    fs.writeFileSync(path.join(dir, `t${t.toFixed(3).padStart(6, '0')}.png`), buf);
  }
  console.log('stills ->', dir);
}

async function segment(browser, port, k, f0, f1) {
  const page = await openPage(browser, port);
  const out = path.join(BUILD, `seg${k}.mp4`);
  const ff = spawn(FFMPEG, ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-i', '-',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '14', '-pix_fmt', 'yuv420p', '-r', String(FPS), out]);
  const done = new Promise((res, rej) => ff.on('close', c => (c ? rej(new Error('ffmpeg ' + c)) : res())));
  for (let f = f0; f < f1; f++) {
    const buf = await grab(page, f / FPS);
    if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
    if ((f - f0) % 60 === 0) console.log(`worker ${k}: frame ${f}/${f1}`);
  }
  ff.stdin.end();
  await done;
  return out;
}

(async () => {
  fs.mkdirSync(BUILD, { recursive: true });
  const srv = await serve();
  const port = srv.address().port;
  const browser = await chromium.launch({ args: ['--disable-web-security', '--font-render-hinting=none'] });
  try {
    const st = opt('stills', null);
    if (st) { await stills(browser, port, st.split(',').map(Number)); return; }
    const total = Math.round(DUR * FPS), per = Math.ceil(total / WORKERS);
    const t0 = Date.now();
    const segs = await Promise.all([...Array(WORKERS)].map((_, k) => segment(browser, port, k, k * per, Math.min(total, (k + 1) * per))));
    const list = path.join(BUILD, 'segments.txt');
    fs.writeFileSync(list, segs.map(s => `file '${s}'`).join('\n'));
    const out = path.join(BUILD, 'bundle-of-brave-fete-teaser.mp4');
    execFileSync(FFMPEG, ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list, '-i', path.join(BUILD, 'music.wav'),
      '-c:v', 'copy', '-c:a', 'aac', '-b:a', '256k', '-shortest', '-movflags', '+faststart', out]);
    segs.forEach(s => fs.unlinkSync(s)); fs.unlinkSync(list);
    console.log(`done in ${((Date.now() - t0) / 1000).toFixed(0)}s ->`, out);
  } finally {
    await browser.close();
    srv.close();
  }
})();
