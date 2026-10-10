"""Videodan çıkan karakter şeritlerini keskinleştirir (Caner, 10 Eki: yakınlaşınca birimler bulanık, binalar net).

    python3 varliklar/serit_keskin.py
Her kare ayrı keskinleştirilir (komşu kareye taşmasın): renge hafif, alfaya daha hafif keskinlik maskesi.
İşlenen şerit anim.json'da 'sh': 1 ile işaretlenir; yeniden çalıştırınca ikinci kez keskinleştirmez.
Yeni şerit eklenince (video_isle / Kaggle) bu betiği yeniden çalıştır.
"""
import json, os
import numpy as np
from PIL import Image, ImageFilter
IMG = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'sinir-kalesi', 'img')
meta_p = os.path.join(IMG, 'anim.json'); meta = json.load(open(meta_p))
for name, F in meta.items():
    if not name.startswith(('enemy_', 'unit_', 'hero_')) or F.get('sh'): continue
    p = os.path.join(IMG, name + '.webp')
    if not os.path.exists(p): continue
    im = Image.open(p).convert('RGBA'); fw = F['fw']; out = Image.new('RGBA', im.size, (0, 0, 0, 0))
    for i in range(F['n']):
        a = np.array(im.crop((i * fw, 0, (i + 1) * fw, im.height)))
        rgb = Image.fromarray(a[..., :3]).filter(ImageFilter.UnsharpMask(1.0, 100, 1))
        al = Image.fromarray(a[..., 3]).filter(ImageFilter.UnsharpMask(0.7, 60, 2))
        out.paste(Image.fromarray(np.dstack([np.array(rgb), np.array(al)])), (i * fw, 0))
    out.save(p, 'WEBP', quality=90, method=6)
    F['sh'] = 1
    print(name, flush=True)
json.dump(meta, open(meta_p, 'w'), indent=1, ensure_ascii=False)
