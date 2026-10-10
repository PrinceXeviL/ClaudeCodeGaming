"""Hayalet okçu poz sayfası (Gemini, 5 poz yan yana, magenta zemin; varliklar/ham/nm_hayalet_okcu_pozlari.webp) -> oyun kareleri.
Pozlar yay/kirişle birbirine değdiği için elle ölçülmüş kesim çizgileriyle ayrılır (CUTS: her sınır için (x, y) kırık çizgisi).
Hepsi ortak ölçekle 300 px boya, ayak ortası tuvalin ortasına gelecek şekilde aynı tuvale konur (kareler arasında karakter kaymaz).
Çıktı: img/unit_ghostarcher (1 bekleme), _nock (2 ok takma), _half (3 yarım germe), _draw (4 tam germe), _rel (5 bırakma) + meta.json + manifest."""
import json, os, sys
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage
H0 = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, H0)
from anim_isle import remove_magenta
IMG = os.path.join(H0, '..', 'sinir-kalesi', 'img')
src = np.array(Image.open(os.path.join(H0, 'ham', 'nm_hayalet_okcu_pozlari.webp')).convert('RGB'))
A = remove_magenta(src); Hh, Ww = A.shape[:2]
CUTS = [[(226, 0), (226, 262), (204, 275), (204, 434)],
        [(402, 0), (402, 190), (409, 210), (409, 262), (398, 290), (396, 434)],
        [(617, 0), (617, 125), (592, 140), (592, 240), (582, 262), (586, 300), (586, 434)],
        [(806, 0), (806, 434)]]
def region(i):
    m = Image.new('L', (Ww, Hh), 0); d = ImageDraw.Draw(m)
    left = CUTS[i - 1] if i > 0 else [(0, 0), (0, Hh)]; right = CUTS[i] if i < len(CUTS) else [(Ww, 0), (Ww, Hh)]
    d.polygon(left + right[::-1], fill=255); return np.array(m) > 0
NAMES = ['unit_ghostarcher', 'unit_ghostarcher_nock', 'unit_ghostarcher_half', 'unit_ghostarcher_draw', 'unit_ghostarcher_rel']
polys, boxes = [], []
for i in range(5):
    P = A.copy(); P[~region(i), 3] = 0
    a = P[..., 3] > 40; lab, n = ndimage.label(a); sz = ndimage.sum(a, lab, range(1, n + 1))
    main = lab == (int(np.argmax(sz)) + 1); near = ndimage.binary_dilation(main, iterations=3)  # komşu pozdan kalan kopuk kırıntılar atılır
    keep = np.isin(lab, [k + 1 for k in range(n) if (near & (lab == k + 1)).any()]); P[~ndimage.binary_dilation(keep, iterations=2), 3] = 0
    ys, xs = np.nonzero(P[..., 3] > 40); y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    feet = (P[y1 - 40:y1, :, 3] > 100) & (P[y1 - 40:y1, :, 1] > 110);  # kemik ayaklar (kızıl sis değil)
    fx = np.nonzero(feet.any(0))[0]; foot = (fx.min() + fx.max()) / 2
    polys.append(P); boxes.append((x0, y0, x1, y1, foot))
S = 300 / max(b[3] - b[1] for b in boxes)  # en uzun poz 300 px
half = max(max(b[4] - b[0], b[2] - b[4]) for b in boxes)
cw, ch = int(np.ceil(2 * half * S)) + 4, 300
meta = json.load(open(os.path.join(IMG, 'meta.json'))); mf = json.load(open(os.path.join(IMG, 'manifest.json')))
for P, (x0, y0, x1, y1, foot), nm in zip(polys, boxes, NAMES):
    crop = Image.fromarray(P[y0:y1, x0:x1]); w, h = round((x1 - x0) * S), round((y1 - y0) * S)
    crop = crop.resize((w, h), Image.LANCZOS)
    can = Image.new('RGBA', (cw, ch), (0, 0, 0, 0)); can.paste(crop, (round(cw / 2 - (foot - x0) * S), ch - h), crop)
    can.save(os.path.join(IMG, nm + '.webp'), 'WEBP', quality=92); meta[nm] = [cw, ch]
    if nm + '.webp' not in mf: mf.append(nm + '.webp')
    print(nm, (x0, y0, x1, y1), round(foot))
json.dump(meta, open(os.path.join(IMG, 'meta.json'), 'w'), separators=(',', ':')); json.dump(mf, open(os.path.join(IMG, 'manifest.json'), 'w'), indent=0)
# tam germe pozunda ok ucunun yeri (tuval kesri): kızıl ok ucu en sağdaki parlak kırmızı piksel kümesi
x0, y0, x1, y1, foot = boxes[3]; P = polys[3]; r, g, b, a = [P[..., k].astype(int) for k in range(4)]
red = (a > 100) & (r > 200) & (g < 120); ys, xs = np.nonzero(red); j = xs.argmax(); tx, ty = xs[j], ys[j]
print('tip', round((cw / 2 + (tx - foot) * S) / cw, 3), round(1 - (y1 - ty) * S / ch, 3), 'canvas', cw, ch)
