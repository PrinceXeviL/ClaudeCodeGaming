"""Mezardan çıkış: Ceset Golemi'nin 6 karelik kalkış şeridi (12 Eki, Caner: "kare kare kaliteli olmalı").

Ham: varliklar/ham/mezar_cikis/kare1..6.jpg (Gemini, magenta zemin, her kare ayrı görsel; poz kılavuzları Downloads/mezar_cikis).
Kareler toprak yığınının tabanına göre hizalanır (Gemini golemi her karede aynı boyda çiziyor, ölçek değişmez).
3. karede Gemini kılavuzdaki kahverengi zemin bandını da çizdi: kenar sütunları magenta olmayan alt satırlar atılır.
Çıktı: sinir-kalesi/img/unit_corpsegolem_rise.webp + anim.json kaydı. Ayak çizgisi (base) 6. karede golemin bastığı yer,
ch: 6. karedeki golem boyu / kare boyu (oyunda drawFrame(..., BIG_H.golem) golemi yürüyen golemle aynı boyda çizer).
    python3 varliklar/mezar_cikis_isle.py
"""
import json, os, sys
import numpy as np
from PIL import Image
from scipy import ndimage

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from anim_isle import remove_magenta

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'varliklar', 'ham', 'mezar_cikis')
IMG = os.path.join(ROOT, 'sinir-kalesi', 'img')
NAME = 'unit_corpsegolem_rise'
S = 2000            # ham kareler bu boya getirilir
GOLEM_H = 260       # şeritte 6. karedeki golemin boyu (px)
FOOT = 200          # golemin ayakları yığının tabanından bu kadar yukarıda (6. kare, ham px)
MIN_BLOB = 40       # bundan küçük kırıntılar silinir (ham px alanı)


def longest(row):
    best = (0, 0, 0); s = None
    for x, v in enumerate(list(row) + [False]):
        if v and s is None: s = x
        if not v and s is not None:
            if x - s > best[0]: best = (x - s, s, x)
            s = None
    return best


def load(i):
    im = Image.open(os.path.join(SRC, 'kare%d.jpg' % i)).convert('RGB')
    if im.size != (S, S): im = im.resize((S, S), Image.LANCZOS)
    a = np.asarray(im)
    f = a.astype(int); mag = (f[..., 0] + f[..., 2]) / 2 - f[..., 1] > 80
    edge = mag[:, :12].mean(1) + mag[:, -12:].mean(1)
    band = S  # alttaki düz zemin bandı (kenarları magenta değil)
    for y in range(S - 1, 0, -1):
        if edge[y] > 0.5: break
        band = y
    rgba = remove_magenta(a)
    rgba[band:, :, 3] = 0
    lab, n = ndimage.label(rgba[..., 3] > 40)
    if n:
        sizes = ndimage.sum(np.ones_like(lab), lab, range(1, n + 1))
        rgba[np.isin(lab, 1 + np.nonzero(sizes < MIN_BLOB)[0]), 3] = 0
    al = rgba[..., 3] > 128
    W = [longest(al[y]) for y in range(S)]
    yb = max(y for y in range(S) if W[y][0] > 500)          # yığının tabanı
    L, s, e = W[max(0, yb - 100)]
    return rgba, (s + e) / 2, yb


def main():
    fr = [load(i) for i in range(1, 7)]
    # ortak tuval: her kare tabanı (cx, yb) ortak noktaya gelecek şekilde
    boxes = []
    for rgba, cx, yb in fr:
        ys, xs = np.nonzero(rgba[..., 3] > 8)
        boxes.append((xs.min() - cx, xs.max() - cx, ys.min() - yb, ys.max() - yb))
    x0 = min(b[0] for b in boxes); x1 = max(b[1] for b in boxes); y0 = min(b[2] for b in boxes); y1 = max(b[3] for b in boxes)
    half = max(-x0, x1) + 4
    Wc, Hc = int(2 * half), int(y1 - y0 + 8)
    top6 = boxes[5][2]                                   # 6. kare golemin tepesi (tabana göre)
    k = GOLEM_H / (-FOOT - top6)
    fw, fh = int(round(Wc * k)), int(round(Hc * k))
    strip = Image.new('RGBA', (fw * 6, fh), (0, 0, 0, 0))
    for j, (rgba, cx, yb) in enumerate(fr):
        can = Image.new('RGBA', (Wc, Hc), (0, 0, 0, 0))
        im = Image.fromarray(rgba, 'RGBA')
        can.paste(im, (int(round(half - cx)), int(round(-y0 + 4 - yb))), im)
        strip.paste(can.resize((fw, fh), Image.LANCZOS), (j * fw, 0))
    foot_y = (-y0 + 4 - FOOT) * k                        # ayak çizgisi (kare içinde, üstten)
    base = round(1 - foot_y / fh, 4)
    ch = round(GOLEM_H / fh, 4)
    strip.save(os.path.join(IMG, NAME + '.webp'), 'WEBP', quality=90, method=6)
    p = os.path.join(IMG, 'anim.json'); meta = json.load(open(p))
    meta[NAME] = {'n': 6, 'fw': fw, 'fh': fh, 'base': base, 'ch': ch, 'sh': 1}
    json.dump(meta, open(p, 'w'), indent=1, ensure_ascii=False)
    mp = os.path.join(IMG, 'manifest.json'); man = json.load(open(mp))
    if NAME + '.webp' not in man: man.append(NAME + '.webp'); json.dump(man, open(mp, "w"), indent=0)
    print(NAME, 'kare', fw, 'x', fh, 'base', base, 'ch', ch)


if __name__ == '__main__':
    main()
