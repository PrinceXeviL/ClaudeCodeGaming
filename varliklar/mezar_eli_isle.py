"""Mezardan çıkan el (11 Eki, Gemini; her kare ayrı görsel, aynı tuval ve aynı toprak halkası):
ham/nm3_el_k1.jpg (parmak uçları), nm3_el_k3.jpg (açık pençe), nm3_el_k4.jpg (yumruk) -> img/:
  nm3_hand_idle  : k1 olduğu gibi (halka + parmak uçları)
  nm3_hand_ring  : k3'ün toprak halkası ve deliği (kol çıkarılmış)
  nm3_hand_open / nm3_hand_fist : yalnız kol ve el (halkasız); oyun bunları halkanın arkasından yükseltir (CUT çizgisinde kırpılır)
Hepsi aynı kesim kutusunda (BOX), böylece üst üste tam oturur. Oyun: game.js GRAVE_HAND.
"""
import os, sys, json
import numpy as np
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from anim_isle import remove_magenta

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HAM, IMG = os.path.join(ROOT, 'varliklar', 'ham'), os.path.join(ROOT, 'sinir-kalesi', 'img')
BOX = (470, 240, 1610, 1912)   # kesim (2048 tuvalde)
COL, RING_TOP, CUT = (868, 1212), 1544, 1735  # kolun halka bandındaki sütunu, halkanın üstü, kolun görünen alt sınırı
K = 0.32  # küçültme


def load(k):
    a = remove_magenta(np.asarray(Image.open(os.path.join(HAM, f'nm3_el_k{k}.jpg')).convert('RGB')))
    a[:8, ..., 3] = 0; a[-8:, ..., 3] = 0; a[:, :8, 3] = 0; a[:, -8:, 3] = 0
    return a


def arm_mask(a):
    H, W = a.shape[:2]; Y = np.arange(H)[:, None]; X = np.arange(W)[None, :]
    r, g, b = [a[..., i].astype(int) for i in range(3)]; L = (r + g + b) / 3
    brown = (r > g + 10) & (r > b + 5)
    band = (Y >= RING_TOP) & (Y < CUT) & (X >= COL[0]) & (X <= COL[1]) & (L > 45) & ~brown
    return (a[..., 3] > 0) & ((Y < RING_TOP) | band)


def save(arr, name):
    im = Image.fromarray(arr).crop(BOX); im = im.resize((round(im.width * K), round(im.height * K)), Image.LANCZOS)
    im.save(os.path.join(IMG, name + '.webp'), 'WEBP', quality=90, method=6); return im.size


def main():
    man_p, meta_p = os.path.join(IMG, 'manifest.json'), os.path.join(IMG, 'meta.json')
    man, meta = set(json.load(open(man_p))), json.load(open(meta_p))
    k1, k3, k4 = load(1), load(3), load(4)
    out = {'nm3_hand_idle': k1}
    m3 = arm_mask(k3); ring = k3.copy(); ring[..., 3] = np.where(m3, 0, ring[..., 3])
    # kolun halka içindeki yeri: her satırda boşluğun iki yanındaki pikseller arasında doğrusal geçiş (arka toprak kenarı + delik)
    for y in range(RING_TOP, CUT):
        xs = np.nonzero(m3[y])[0]
        if not len(xs): continue
        x0, x1 = xs.min() - 3, xs.max() + 3
        if ring[y, x0, 3] < 200 or ring[y, x1, 3] < 200: continue  # halkanın dışı
        t = np.linspace(0, 1, x1 - x0 + 1)[:, None]
        ring[y, x0:x1 + 1, :3] = (ring[y, x0, :3] * (1 - t) + ring[y, x1, :3] * t).astype(np.uint8); ring[y, x0:x1 + 1, 3] = 255
    out['nm3_hand_ring'] = ring
    for nm, a in (('nm3_hand_open', k3), ('nm3_hand_fist', k4)):
        m = arm_mask(a); c = a.copy(); c[..., 3] = np.where(m, c[..., 3], 0); out[nm] = c
    for nm, a in out.items():
        sz = save(a, nm); meta[nm] = list(sz); man.add(nm + '.webp'); print(nm, sz)
    json.dump(sorted(man), open(man_p, 'w'), indent=0); json.dump(meta, open(meta_p, 'w'))
    print('kesim', BOX, 'CUT', (CUT - BOX[1]) / (BOX[3] - BOX[1]))


if __name__ == '__main__':
    main()
