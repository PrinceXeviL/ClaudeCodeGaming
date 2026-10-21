"""Mortimer v2 (21 Eki) Veo balkon videoları → şeritler (her kare, 24 kare/sn; KATI kural: kare atlama yok).
Videolar ham/anim/mortimer_v2/*.mp4 (1280x720, beyaz zemin). Her iş: video, başlangıç/bitiş karesi, aynalama, toz temizliği.
Kesim: kenara bağlı nötr açık zemin silinir (gri duman, krem toz da), en büyük parça kalır (uçuşan kırıntı, yer gölgesi gider),
gövdenin içinde kalan saf beyaz boşluklar açılır. Bütün karelerde aynı kutu: yatayda ilk karedeki gövde ortasına simetrik,
dikeyde birleşik kutu; ch ve base ilk karedeki ayakta duruşa göre (yükselen / kollarını açan Mortimer kutuda kayar, boyu sabit).
    .venv/bin/python3 varliklar/mortimer_v2_veo_isle.py [ad ...]
"""
import json, os, sys
import numpy as np
from PIL import Image
from scipy import ndimage as nd
H0 = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, H0)
import video_isle
IMG = os.path.join(H0, '..', 'sinir-kalesi', 'img')
VID = os.path.join(H0, 'ham', 'anim', 'mortimer_v2')
CHAR_PX = 200  # ayakta Mortimer'ın şeritteki boyu (bellek: eski şeritler ~220)
# ad: (video, ilk kare, son kare (dahil değil), ayna, toz bandı kareleri)
JOBS = {
    'mortimer_bekle': ('veo_ayakta.mp4', 0, 226, False, None),
    'mortimer_buyu': ('veo_buyu.mp4', 12, 196, False, (120, 175)),
    'mortimer_dirilt': ('veo_dirilt.mp4', 20, 228, True, None),
}


def cut(a, dust=False, feet=None):
    f = a.astype(np.float32); mn, mx = f.min(2), f.max(2); sat = (mx - mn) / np.maximum(mx, 1)
    bg = (mn > 150) & (sat < 0.09)
    if dust and feet is not None:  # yere vuruşta ayak dibinde kalkan krem toz: ayak bandındaki açık, soluk pikseller zemin sayılır
        band = np.zeros_like(bg); band[feet - 70:feet + 30] = True
        bg |= band & (mn > 150) & (sat < 0.28)
    lab, n = nd.label(bg)
    edge = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    fg = nd.binary_opening(~np.isin(lab, list(edge)), iterations=1)
    lab, n = nd.label(fg)
    if n == 0: return np.zeros(a.shape[:2], bool)
    sz = nd.sum(fg, lab, range(1, n + 1)); m = lab == np.argmax(sz) + 1
    hole, hn = nd.label(m & (mn > 228) & (sat < 0.06))
    if hn:
        hs = nd.sum(np.ones_like(mn), hole, range(1, hn + 1))
        m &= ~np.isin(hole, [i + 1 for i in range(hn) if hs[i] >= 12])
    return m


def run(name):
    vid, s0, s1, mirror, dust = JOBS[name]
    fr = video_isle.frames_of(os.path.join(VID, vid), 24)[s0:s1]
    if mirror: fr = [np.ascontiguousarray(f[:, ::-1]) for f in fr]
    m0 = cut(fr[0]); ys, xs = np.nonzero(m0)
    top, feet = ys.min(), ys.max()
    rows = (ys > top + (feet - top) * 0.3) & (ys < top + (feet - top) * 0.9)
    cx = int(np.median(xs[rows]))  # gövde ortası (asa ince, cüppe geniş)
    masks = []
    for i, f in enumerate(fr):
        masks.append(cut(f, dust is not None and dust[0] <= i + s0 < dust[1], feet))
    U = np.any(masks, axis=0); uy, ux = np.nonzero(U)
    hw = max(cx - ux.min(), ux.max() - cx) + 6
    Y0, Y1 = max(0, uy.min() - 6), min(fr[0].shape[0], max(uy.max(), feet) + 6)
    X0, X1 = cx - hw, cx + hw
    k = CHAR_PX / (feet - top)
    FW, FH = int(round((X1 - X0) * k)), int(round((Y1 - Y0) * k))
    crops = []
    for f, m in zip(fr, masks):
        al = nd.gaussian_filter(m.astype(np.float32), 0.6) * 255
        al[~nd.binary_dilation(m, iterations=1)] = 0
        rgba = np.dstack([f, al.clip(0, 255).astype(np.uint8)])
        pad = np.zeros((Y1 - Y0, X1 - X0, 4), np.uint8)
        sx0, sx1 = max(0, X0), min(f.shape[1], X1)
        pad[:, sx0 - X0:sx1 - X0] = rgba[Y0:Y1, sx0:sx1]
        crops.append(pad)
    meta_p, man_p = os.path.join(IMG, 'anim.json'), os.path.join(IMG, 'manifest.json')
    meta, man = json.load(open(meta_p)), json.load(open(man_p))
    info = {'fps': 24, 'ch': round((feet - top) / (Y1 - Y0), 4), 'base': round((Y1 - feet) / (Y1 - Y0), 4), 'v2': 1}
    meta.pop(name, None)
    video_isle.save_strip(name, crops, FW, FH, IMG, meta, man, info, keep=False)
    json.dump(meta, open(meta_p, 'w'), ensure_ascii=False, indent=1)
    print(name, 'kare', len(crops), 'kutu', FW, FH, 'bellek', FW * FH * 4 * len(crops) // 2 ** 20, 'MB')


if __name__ == '__main__':
    for n in sys.argv[1:] or JOBS: run(n)
