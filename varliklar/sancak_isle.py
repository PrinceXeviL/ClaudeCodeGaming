"""2. sefer sancağı (11 Eki): nm4_banner bezini ayrı katmana ayırır, oyunda bez rüzgârda dalgalanır (game.js BANNER).
    .venv/bin/python varliklar/sancak_isle.py
- nm4_banner_pole.webp: direk ve çapraz çubuk; bezin arkasında kalan direk, bezin altındaki görünür direkten yukarı uzatılır
- nm4_banner_cloth.webp: yalnız bez (aynı boyutta tuval, aynı konum)
Bez kutusu (oran) BAND; game.js BANNER.top/bot ile aynı olmalı.
"""
import json, os
import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IMG = os.path.join(ROOT, 'sinir-kalesi', 'img')
BAND = (0.14, 0.73, 0.1, 0.9)  # çapraz çubuğun altından bez uçlarının altına  # y0, y1, x0, x1


def main():
    a = np.asarray(Image.open(os.path.join(IMG, 'nm4_banner.webp')).convert('RGBA')).copy()
    H, W = a.shape[:2]; y0, y1, x0, x1 = round(BAND[0] * H), round(BAND[1] * H), round(BAND[2] * W), round(BAND[3] * W)
    cloth = np.zeros_like(a); cloth[y0:y1, x0:x1] = a[y0:y1, x0:x1]
    pole = a.copy(); pole[y0:y1, x0:x1] = 0
    ref = round(0.8 * H); row = a[ref, :, 3] > 150  # bezin altındaki direk satırı: ortaya en yakın opak dilim
    c = W // 2 + int(np.argmin([abs(i) if row[W // 2 + i] else 999 for i in range(-W // 4, W // 4)])) - W // 4
    px0 = px1 = c
    while px0 > 0 and row[px0 - 1]: px0 -= 1
    while px1 < W and row[px1]: px1 += 1
    pole[y0:y1, px0:px1] = a[ref, px0:px1]
    # bezin altında görünen direk parçası bez katmanında kalmasın (dalgalanırken direk ikilenir): direk sütununda kırmızı/altın olmayanlar silinir
    col = cloth[y0:y1, px0:px1].astype(int); low = np.arange(y0, y1)[:, None] > y0 + (y1 - y0) * 0.75
    cloth[y0:y1, px0:px1, 3] = np.where(low & ~(col[..., 0] > col[..., 1] + 35), 0, cloth[y0:y1, px0:px1, 3])
    Image.fromarray(cloth).save(os.path.join(IMG, 'nm4_banner_cloth.webp'), 'WEBP', quality=90, method=6)
    Image.fromarray(pole).save(os.path.join(IMG, 'nm4_banner_pole.webp'), 'WEBP', quality=90, method=6)
    mp, metp = os.path.join(IMG, 'manifest.json'), os.path.join(IMG, 'meta.json')
    man, meta = json.load(open(mp)), json.load(open(metp))
    for n in ('nm4_banner_cloth', 'nm4_banner_pole'):
        if n + '.webp' not in man: man.append(n + '.webp')
        meta[n] = meta['nm4_banner']
    json.dump(sorted(man), open(mp, 'w'), indent=0); json.dump(meta, open(metp, 'w'))
    print('direk', px0, px1, 'bez', y0, y1)


if __name__ == '__main__':
    main()
