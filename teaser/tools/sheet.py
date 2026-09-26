import sys, glob, os
from PIL import Image, ImageDraw
files = sorted(glob.glob('build/stills/*.png'))
cols = int(sys.argv[1]) if len(sys.argv) > 1 else 4
tw, th = 480, 270
rows = (len(files) + cols - 1) // cols
sheet = Image.new('RGB', (cols * tw, rows * (th + 18)), 'black')
d = ImageDraw.Draw(sheet)
for i, f in enumerate(files):
    im = Image.open(f).convert('RGB').resize((tw, th))
    x, y = (i % cols) * tw, (i // cols) * (th + 18)
    sheet.paste(im, (x, y))
    t = float(os.path.basename(f)[1:-4])
    d.text((x + 4, y + th + 3), f't={t:.2f}s  b={t/0.46875:.1f}', fill='white')
out = sys.argv[2] if len(sys.argv) > 2 else 'build/sheet.jpg'
sheet.save(out, quality=88)
print(out, len(files))
