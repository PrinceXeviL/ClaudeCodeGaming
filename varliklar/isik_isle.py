"""Dekor ışıkları (11 Eki, Caner: "normal ışıklar hep sarı; bize ait şeylerin ışığı yeşil").
Mum, fener, tabela feneri gibi sıradan ışıkların yeşil alevleri sıcak sarıya boyanır; ışık noktaları img/lights.json'a yazılır,
oyun (game.js BG_LIGHTS) zemin dekorunda bunları her karede titretir. Mantarlar, mahzen kapısı, kütük gözleri yeşil kalır (büyü/canlı).
    .venv/bin/python varliklar/isik_isle.py
Asıl görseller varliklar/cikti/<ad>_isiksiz.webp olarak bir kez saklanır (betik tekrar çalışınca oradan okur).
"""
import json, os, shutil
import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IMG, OUT = os.path.join(ROOT, 'sinir-kalesi', 'img'), os.path.join(ROOT, 'varliklar', 'cikti')
WARM = ['nm3_candles', 'nm3_sign_1', 'nm3_sign_2', 'nm3_totem_1', 'nm3_totem_2', 'nm3_totem_3', 'nm_tree_2', 'nm_ruin_4']
FIRE = ['nm4_brazier', 'nm4_firebarrel', 'nm4_shrine', 'nm4_board', 'nm4_barrels']  # 2. sefer: zaten sarı/turuncu alevler, yalnız ışık noktası çıkarılır
GREEN = ['nm_shroom', 'nm_ruin_3', 'nm3_stump']  # yeşil kalır, yalnız nabız gibi parlar
MIN = {'nm_shroom': 900, 'nm3_stump': 60, 'nm4_brazier': 400, 'nm4_firebarrel': 400, 'nm4_shrine': 40, 'nm4_board': 60, 'nm4_barrels': 60}  # mantar başına ~1 nokta (çok nokta kareyi yavaşlatır)


def main():
    os.makedirs(OUT, exist_ok=True)
    lights = {}
    for name in WARM + GREEN + FIRE:
        src = os.path.join(OUT, name + '_isiksiz.webp')
        if not os.path.exists(src): shutil.copy(os.path.join(IMG, name + '.webp'), src)
        a = np.asarray(Image.open(src).convert('RGBA')).astype(np.float32); H, W = a.shape[:2]
        r, g, b, al = a[..., 0], a[..., 1], a[..., 2], a[..., 3]
        core = (al > 150) & (g > r + 50) & (g > b + 20) & (g > 150)
        if name in FIRE: core = (al > 200) & (r > 235) & (g > 150) & (b < 150)  # alev çekirdeği: parlak sarı-turuncu
        if name in WARM:
            halo = ((al > 0) & (g > r + 22) & (g > b + 8)) | ((al < 250) & ((r + b) / 2 - g > 18)) | ((b > g + 30) & (r > g + 10) & (np.maximum(r, b) > 150))  # yeşil alev + magentaya bulaşmış mor hale
            lum = np.maximum(np.maximum(r, g), b)
            for i, k in enumerate((1.0, 0.8, 0.38)): a[..., i] = np.where(halo, lum * k, a[..., i])
            Image.fromarray(a.clip(0, 255).astype(np.uint8)).save(os.path.join(IMG, name + '.webp'), 'WEBP', quality=90, method=6)
        lab, n = ndimage.label(core); pts = []
        for i in range(1, n + 1):
            ys, xs = np.nonzero(lab == i)
            if len(ys) < MIN.get(name, 20): continue
            pts.append([round(xs.mean() / W, 4), round(ys.mean() / H, 4), round(max(np.ptp(xs), np.ptp(ys)) / W, 4)])
        if name in FIRE:  # bir alevin parçaları (mum damlası, meşale dili) tek noktada birleşir
            pts.sort(key=lambda q: -q[2]); keep = []
            for q in pts:
                if not any(abs(q[0] - k[0]) < 0.07 and abs(q[1] - k[1]) < 0.12 for k in keep): keep.append(q)
            pts = keep
        lights[name] = {'col': 'green' if name in GREEN else 'warm', 'pts': pts}
        print(name, len(pts))
    json.dump(lights, open(os.path.join(IMG, 'lights.json'), 'w'))


if __name__ == '__main__':
    main()
