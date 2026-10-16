"""Kan sayfası (16 Eki, Caner: "kan pikselleri amatör"): Gemini, yeşil (#00FF00) zemin, 3 sıra (4 sıçrama, 6 damla, 5 yer lekesi).
Yeşil zemin silinir (kırmızı kan magentada pembe sızdırıyordu), kenardaki yeşil yansıma temizlenir, her parça çevresindeki damlalarla
birlikte (genişletilmiş maske kümesi) kesilir ve oyun boyuna küçültülür → sinir-kalesi/img/nm32_*.webp + manifest/meta.
    python3 varliklar/kan_isle.py
"""
import os, json
import numpy as np
from PIL import Image
from scipy.ndimage import label, binary_dilation, find_objects

KOK = os.path.dirname(os.path.abspath(__file__)); IMG = os.path.join(KOK, '..', 'sinir-kalesi', 'img')
ROWS = [['nm32_bspray', 'nm32_bstar', 'nm32_bcrescent', 'nm32_bpuff'],
        ['nm32_drop_round', 'nm32_drop_tear', 'nm32_drop_streak', 'nm32_drop_pair', 'nm32_drop_cluster', 'nm32_drop_strand'],
        ['nm32_splat_pool', 'nm32_splat_drips', 'nm32_splat_mid', 'nm32_splat_smear', 'nm32_splat_spots']]
SIZE = [220, 72, 200]  # sıra başına en büyük kenar (px)

def main():
    a = np.asarray(Image.open(os.path.join(KOK, 'ham', 'nm32_kan.jpg')).convert('RGB')).astype(np.float32)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    gn = g - np.maximum(r, b)  # yeşillik
    al = 1 - np.clip((gn - 30) / 110, 0, 1)
    g2 = np.minimum(g, np.maximum(r, b) * 1.0 + 6)  # yeşil yansıma: g, kırmızı/mavinin üstüne çıkamaz
    rgba = np.dstack([r, g2, b, al * 255]).clip(0, 255).astype(np.uint8)
    m = al > 0.5
    big = binary_dilation(m, iterations=34)
    lab, n = label(big); objs = find_objects(lab)
    items = [(s, i + 1) for i, s in enumerate(objs) if (m[s] & (lab[s] == i + 1)).sum() > 400]
    items.sort(key=lambda t: (t[0][0].start + t[0][0].stop) / 2)
    H = a.shape[0]; rows = [[], [], []]
    for s, i in items: rows[min(2, int((s[0].start + s[0].stop) / 2 / (H / 3)))].append((s, i))
    man_p, meta_p = os.path.join(IMG, 'manifest.json'), os.path.join(IMG, 'meta.json')
    man, meta = set(json.load(open(man_p))), json.load(open(meta_p))
    for ri, row in enumerate(rows):
        row.sort(key=lambda t: t[0][1].start)
        assert len(row) == len(ROWS[ri]), f'{ri}. sırada {len(row)} parça (beklenen {len(ROWS[ri])})'
        for (s, i), name in zip(row, ROWS[ri]):
            c = rgba[s].copy(); c[..., 3] = np.where(lab[s] == i, c[..., 3], 0)
            ys, xs = np.nonzero(c[..., 3] > 10); c = c[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
            im = Image.fromarray(c); k = SIZE[ri] / max(im.size)
            if k < 1: im = im.resize((max(1, round(im.width * k)), max(1, round(im.height * k))), Image.LANCZOS)
            im.save(os.path.join(IMG, name + '.webp'), 'WEBP', quality=90, method=6)
            meta[name] = [im.width, im.height]; man.add(name + '.webp'); print(name, im.size)
    json.dump(sorted(man), open(man_p, 'w'), indent=0); json.dump(meta, open(meta_p, 'w'))

main()
