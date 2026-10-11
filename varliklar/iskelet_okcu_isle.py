"""İskelet okçu poz sayfaları (Gemini, 5 poz yan yana, magenta zemin): ham/nm_iskelet_okcu_<k>.jpg -> img/unit_archer<k>(_nock,_half,_draw,_rel).
Pozlar yay ve okla birbirine değdiği için kesim çizgileri elle ölçülür (CUTS[k]: 2000 genişlikli önizleme koordinatı, sayfa boyuna ölçeklenir).
Hepsi ortak ölçekle 300 px boya, ayak ortası tuvalin ortasında. Tam germe pozunda en sağdaki piksel (ok ucu) 'tip' olarak yazdırılır.
    .venv/bin/python varliklar/iskelet_okcu_isle.py 1
"""
import json, os, sys
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage
H0 = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, H0)
from anim_isle import remove_magenta
IMG = os.path.join(H0, '..', 'sinir-kalesi', 'img')
CUTS = {
    1: [[(465, 0), (465, 800), (430, 860), (430, 1100)],
        [(800, 0), (800, 470), (848, 500), (848, 720), (800, 800), (800, 1100)],
        [(1112, 0), (1112, 450), (1158, 460), (1158, 560), (1180, 600), (1180, 720), (1150, 800), (1150, 1100)],
        [(1557, 0), (1557, 560), (1535, 600), (1535, 1100)]],
}
k = int(sys.argv[1]) if len(sys.argv) > 1 else 1
src = np.array(Image.open(os.path.join(H0, 'ham', f'nm_iskelet_okcu_{k}.jpg')).convert('RGB'))
A = remove_magenta(src); Hh, Ww = A.shape[:2]; f = Ww / 2000
cuts = [[(x * f, y * f) for x, y in c] for c in CUTS[k]]
def region(i):
    m = Image.new('L', (Ww, Hh), 0); d = ImageDraw.Draw(m)
    left = cuts[i - 1] if i > 0 else [(0, 0), (0, Hh)]; right = cuts[i] if i < len(cuts) else [(Ww, 0), (Ww, Hh)]
    d.polygon(left + right[::-1], fill=255); return np.array(m) > 0
NAMES = [f'unit_archer{k}', f'unit_archer{k}_nock', f'unit_archer{k}_half', f'unit_archer{k}_draw', f'unit_archer{k}_rel']
polys, boxes = [], []
for i in range(5):
    P = A.copy(); P[~region(i), 3] = 0
    a = P[..., 3] > 40; lab, n = ndimage.label(a); sz = ndimage.sum(a, lab, range(1, n + 1))
    main = lab == (int(np.argmax(sz)) + 1); near = ndimage.binary_dilation(main, iterations=3)
    keep = np.isin(lab, [j + 1 for j in range(n) if (near & (lab == j + 1)).any() and sz[j] > 30]); P[~ndimage.binary_dilation(keep, iterations=2), 3] = 0
    ys, xs = np.nonzero(P[..., 3] > 40); y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    fx = np.nonzero((P[y1 - int(60 * f):y1, :, 3] > 100).any(0))[0]; foot = (fx.min() + fx.max()) / 2
    polys.append(P); boxes.append((x0, y0, x1, y1, foot))
S = 300 / max(b[3] - b[1] for b in boxes)
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
json.dump(meta, open(os.path.join(IMG, 'meta.json'), 'w')); json.dump(sorted(mf), open(os.path.join(IMG, 'manifest.json'), 'w'))
x0, y0, x1, y1, foot = boxes[3]; P = polys[3]; ys, xs = np.nonzero(P[..., 3] > 100); j = xs.argmax(); tx, ty = xs[j], ys[j]
print('tip', round((cw / 2 + (tx - foot) * S) / cw, 3), round(1 - (y1 - ty) * S / ch, 3), 'canvas', cw, ch)
