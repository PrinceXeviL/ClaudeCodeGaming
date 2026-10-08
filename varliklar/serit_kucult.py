"""Düşman/iskelet animasyon şeritlerini küçültür (karakter boyu UNIT_H px): bellek ~1/4, oyunda en yakın zoomda bile keskin.

    python3 varliklar/serit_kucult.py
Her kare ayrı küçültülür (ızgara bozulmasın); anim.json'daki fw/fh güncellenir. Zaten küçük olanlara dokunmaz.
"""
import json, os
from PIL import Image
from video_isle import UNIT_H
IMG = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'sinir-kalesi', 'img')
meta_p = os.path.join(IMG, 'anim.json'); meta = json.load(open(meta_p))
for name, F in meta.items():
    if not name.startswith(('enemy_', 'unit_')): continue
    p = os.path.join(IMG, name + '.webp')
    if not os.path.exists(p): continue
    k = UNIT_H / (F['ch'] * F['fh'])
    if k > 0.95: continue
    im = Image.open(p).convert('RGBA'); fw, fh = round(F['fw'] * k), round(F['fh'] * k)
    out = Image.new('RGBA', (fw * F['n'], fh), (0, 0, 0, 0))
    for i in range(F['n']):
        out.paste(im.crop((i * F['fw'], 0, (i + 1) * F['fw'], F['fh'])).resize((fw, fh), Image.LANCZOS), (i * fw, 0))
    out.save(p, 'WEBP', quality=90, method=6)
    print(f"{name}: {im.width}x{im.height} -> {out.width}x{out.height}", flush=True)
    F['fw'], F['fh'] = fw, fh
json.dump(meta, open(meta_p, 'w'), indent=1, ensure_ascii=False)
