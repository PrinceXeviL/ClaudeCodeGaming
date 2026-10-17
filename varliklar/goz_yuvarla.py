"""Lanet Kulesi 1. kademe Veo şeritlerinde gözün dikey yarık gözbebeğini yuvarlak yapar (17 Eki, Caner: "yuvarlak olsun").
Her karede göz penceresinde: mor iris pikselleri + irisin içindeki koyu yarık bulunur; yarık irisin (komşu) rengiyle doldurulur,
yarığın ağırlık merkezine irise sığan kara yuvarlak gözbebeği ve küçük bir parlama çizilir (4 kat büyük çizilip küçültülür: yumuşak kenar).
Gözbebeği görünmeyen karelere (göz kapalı / yukarı bakıyor) dokunulmaz. Eski şeritler varliklar/cikti/lanet_veo_yarik/.
    .venv/bin/python3 varliklar/goz_yuvarla.py [tower_altar_1_idle tower_altar_1_atk]
"""
import json, os, sys
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage as nd
H0 = os.path.dirname(os.path.abspath(__file__)); IMG = os.path.join(H0, '..', 'sinir-kalesi', 'img'); SRC = os.path.join(H0, 'cikti', 'lanet_veo_yarik')
EYE = {'tower_altar_1': (0.611, 0.777, 0.07)}  # görselde göz merkezi [x, alttan y, yarı genişlik] (game.js ALTAR_RAGE)


def fix_frame(f, cx, cy, R):
    x0, y0 = max(0, cx - R), max(0, cy - R); w = f[y0:cy + R, x0:cx + R].astype(np.float32)
    r, g, b, a = w[..., 0], w[..., 1], w[..., 2], w[..., 3]
    iris = (a > 200) & (b > 130) & (r > 90) & (b > g + 35) & (r > g + 20)  # açık pembe-mor dahil
    if iris.sum() < 25: return False
    dark = (a > 200) & ((r + g + b) / 3 < 75)
    hull = nd.binary_fill_holes(nd.binary_closing(iris, iterations=3))
    slit = dark & hull & nd.binary_dilation(iris, iterations=2)
    l, n = nd.label(slit)
    if not n: return False
    sz = nd.sum(slit, l, range(1, n + 1)); k = int(np.argmax(sz)) + 1
    if sz[k - 1] < 14: return False  # kenardaki küçük koyu leke gözbebeği değil
    P = l == k; ys, xs = np.nonzero(P); ph = ys.max() - ys.min() + 1
    if ph < 6: return False  # kapak kısık: gözbebeği zaten nokta gibi
    col = np.median(w[iris][:, :3], axis=0)  # iris rengi
    fillm = nd.binary_dilation(P, iterations=1) & (hull | P)
    w[fillm, :3] = col; w[fillm, 3] = 255
    pcy, pcx = ys.mean(), xs.mean()
    dt = nd.distance_transform_edt(hull | fillm)
    req = np.sqrt(hull.sum() / np.pi); rad = max(3.2, min(req * 0.42, dt[int(round(pcy)), int(round(pcx))] * 0.9))  # irisle orantılı, en az 3,2 px (nokta gibi kalmasın)
    S = 4; big = Image.fromarray(w.astype(np.uint8)).resize((w.shape[1] * S, w.shape[0] * S), Image.NEAREST)
    d = ImageDraw.Draw(big); X, Y, Rr = pcx * S + S / 2, pcy * S + S / 2, rad * S
    d.ellipse((X - Rr, Y - Rr, X + Rr, Y + Rr), fill=(18, 6, 24, 255))
    hr = Rr * 0.32; d.ellipse((X - Rr * 0.35 - hr, Y - Rr * 0.4 - hr, X - Rr * 0.35 + hr, Y - Rr * 0.4 + hr), fill=(255, 245, 255, 235))
    small = np.asarray(big.resize((w.shape[1], w.shape[0]), Image.LANCZOS)).astype(np.float32)
    region = nd.binary_dilation(fillm, iterations=2) | ((np.hypot(*np.mgrid[0:w.shape[0], 0:w.shape[1]] - np.array([pcy, pcx])[:, None, None]) <= rad + 1.5))
    region &= nd.binary_dilation(hull | fillm, iterations=1)  # iris dışına (kapağa) taşmaz
    w[region] = small[region]
    f[y0:cy + R, x0:cx + R] = w.clip(0, 255).astype(np.uint8)
    return True


def run(name):
    A = json.load(open(os.path.join(IMG, 'anim.json')))[name]; base = name.rsplit('_', 1)[0]; ex, ey, er = EYE[base]
    b = A['box']; fw, fh, n = A['fw'], A['fh'], A['n']; C = A.get('cols') or n
    cx = int(round((ex - b[0]) / (b[2] - b[0]) * fw)); cy = int(round(((1 - ey) - b[1]) / (b[3] - b[1]) * fh)); R = int(round(er / (b[2] - b[0]) * fw * 2.2))
    im = np.asarray(Image.open(os.path.join(SRC, name + '.webp')).convert('RGBA')).copy(); done = 0
    for i in range(n):
        c, r = i % C, i // C; f = im[r * fh:(r + 1) * fh, c * fw:(c + 1) * fw]
        if fix_frame(f, cx, cy, R): done += 1
    Image.fromarray(im).save(os.path.join(IMG, name + '.webp'), 'WEBP', quality=92, method=6)
    print(name, 'kare', n, 'yuvarlanan', done, 'merkez', cx, cy, 'pencere', R)


for nm in (sys.argv[1:] or ['tower_altar_1_idle', 'tower_altar_1_atk']): run(nm)
