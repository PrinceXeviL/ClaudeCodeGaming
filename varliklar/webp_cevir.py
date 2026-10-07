"""sinir-kalesi/img/*.png -> .webp (saydamlık korunur, kalite 88) ve manifest.json güncellenir. PNG silinir.

    python3 varliklar/webp_cevir.py

nm_isle.py / anim_isle.py PNG yazar; görsel ekledikten sonra bunu çalıştır (indirme boyutu ~%75 küçülür).
Oyun yükleyicisi dosya adını uzantısız kullandığı için kod değişmez; meta.json ve anim.json adla tutulur.
"""
import json, os
from PIL import Image

IMG = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'sinir-kalesi', 'img')
man_p = os.path.join(IMG, 'manifest.json')
man = json.load(open(man_p))
before = after = 0
for i, f in enumerate(man):
    if not f.endswith('.png'):
        continue
    src = os.path.join(IMG, f)
    if not os.path.exists(src):
        continue
    dst = src[:-4] + '.webp'
    im = Image.open(src)
    im.save(dst, 'WEBP', quality=88, method=6)
    before += os.path.getsize(src); after += os.path.getsize(dst)
    os.remove(src)
    man[i] = f[:-4] + '.webp'
json.dump(sorted(set(man)), open(man_p, 'w'), indent=0)
print(f'{before / 1e6:.1f} MB -> {after / 1e6:.1f} MB')
