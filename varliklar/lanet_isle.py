"""Lanet Kulesi sayfası (16 Eki, nm33_lanet_kulesi.jpg) için kesici. Mor ışıklar ve eflatun göz akı magenta zemine çok yakın;
genel kesici (remove_magenta) bunları yarı saydam sayıp siliyordu. Burada yalnız DIŞTAN zemine bağlı magenta silinir:
zemine yakın pikseller sınırdan taşkın doldurma ile bulunur, kenar bandında alfa yumuşar ve magenta karışımı ayrıştırılır
(renk = (c - (1-a)·zemin) / a). Kulenin içindeki mor alanlar dokunulmadan kalır.
    python3 varliklar/lanet_isle.py
"""
import os, json
import numpy as np
from PIL import Image
from scipy.ndimage import label, binary_dilation, distance_transform_edt

KOK = os.path.dirname(os.path.abspath(__file__)); IMG = os.path.join(KOK, '..', 'sinir-kalesi', 'img')
NAMES = ['tower_altar_1', 'tower_altar_2', 'tower_altar_3', 'tower_altar_rite', 'tower_altar_blight']
BOXES = [(0, 562), (562, 1104), (1104, 1651), (1651, 2180), (2180, 2752)]  # Kara Lanet'in soldaki rünleri 2188'den başlar
HGT = {'tower_altar_1': 950, 'tower_altar_2': 1080, 'tower_altar_3': 1180, 'tower_altar_rite': 1250, 'tower_altar_blight': 1250}  # oyun boyu (meta)

def main():
    a = np.asarray(Image.open(os.path.join(KOK, 'ham', 'nm33_lanet_kulesi.jpg')).convert('RGB')).astype(np.float32)
    bgc = np.median(np.concatenate([a[:8].reshape(-1, 3), a[-8:].reshape(-1, 3)]), 0)  # zemin rengi
    d = np.sqrt(((a - bgc) ** 2).sum(-1))
    near = d < 70  # zemine çok yakın
    lab, _ = label(near); edge = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    sz = np.bincount(lab.ravel()); pure = d < 30
    holes = [i for i in range(1, len(sz)) if i not in edge and sz[i] > 400 and pure[lab == i].mean() > 0.6]  # kemerin içindeki kapalı zemin boşlukları
    bg = np.isin(lab, list(edge) + holes)  # dıştan bağlı zemin + kapalı boşluklar
    band = binary_dilation(bg, iterations=10) & ~bg & (d < 160)  # kenar bandı: yumuşak ışık halesi magentadan ayrışır
    al = np.ones(d.shape, np.float32); al[bg] = 0
    al[band] = np.clip((d[band] - 40) / 110, 0, 1)
    k = al[..., None]; col = np.where(k > 0.02, (a - (1 - k) * bgc) / np.maximum(k, 0.02), a).clip(0, 255)
    rgba = np.dstack([col, al * 255]).astype(np.uint8)
    man_p, meta_p = os.path.join(IMG, 'manifest.json'), os.path.join(IMG, 'meta.json')
    man, meta = set(json.load(open(man_p))), json.load(open(meta_p))
    for (x0, x1), name in zip(BOXES, NAMES):
        c = rgba[:, x0:x1].copy(); m = c[..., 3] > 20
        lb, n = label(m); sz = np.bincount(lb.ravel())[1:]; big = sz.argmax() + 1
        keep = np.zeros_like(m); dist = distance_transform_edt(lb != big)
        for i in range(1, n + 1):
            if i == big or (sz[i - 1] > 30 and dist[lb == i].min() < 60): keep |= lb == i  # ana gövde ve yakınındaki parçalar (rün, duman)
        c[..., 3] = np.where(keep, c[..., 3], 0)
        ys, xs = np.nonzero(c[..., 3] > 10); c = c[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
        im = Image.fromarray(c)
        im.save(os.path.join(IMG, name + '.webp'), 'WEBP', quality=88, method=6)
        h = HGT[name]; meta[name] = [round(im.width * h / im.height), h, 0.13]; man.add(name + '.webp'); print(name, im.size, meta[name])
    json.dump(sorted(man), open(man_p, 'w'), indent=0); json.dump(meta, open(meta_p, 'w'))

main()
