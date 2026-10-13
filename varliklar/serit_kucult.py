"""Animasyon şeritlerini küçültür (karakter boyu hedef px): bellek boyun karesiyle düşer, oyunda en yakın zoomda bile keskin.

    .venv/bin/python varliklar/serit_kucult.py          # değişecekleri yazar
    .venv/bin/python varliklar/serit_kucult.py --yaz    # uygular
Her kare ayrı küçültülür (ızgara bozulmasın, komşu kare sızmasın); anim.json'daki fw/fh güncellenir (base, ch, stride, fx, rel kesir,
aynı kalır). Zaten küçük olanlara dokunmaz.
Hedef karakter boyu: düşman/iskelet UNIT_H (160), komutan 220, Mortimer 220 (15 Eki: komutan ve Mortimer şeritleri de eklendi;
telefonda bellek dolup oyun kapanıyordu, iPhone Jetsam kaydında WebContent ~1 GB).
"""
import json, os, sys
from PIL import Image
from video_isle import UNIT_H
IMG = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'sinir-kalesi', 'img')
TARGET = [('enemy_', UNIT_H), ('unit_', UNIT_H), ('hero_', 220), ('mortimer_', 220)]
meta_p = os.path.join(IMG, 'anim.json'); meta = json.load(open(meta_p)); before = after = 0
for name, F in meta.items():
    T = next((t for p, t in TARGET if name.startswith(p)), None)
    if not T or F.get('tower'): continue
    p = os.path.join(IMG, name + '.webp')
    if not os.path.exists(p): continue
    k = T / (F.get('ch', 1) * F['fh'])
    if k > 0.95: continue
    fw, fh = round(F['fw'] * k), round(F['fh'] * k)
    before += F['fw'] * F['n'] * F['fh'] * 4; after += fw * F['n'] * fh * 4
    print(f"{name}: {F['fw']}x{F['fh']} -> {fw}x{fh}", flush=True)
    if '--yaz' not in sys.argv: continue
    im = Image.open(p).convert('RGBA')
    out = Image.new('RGBA', (fw * F['n'], fh), (0, 0, 0, 0))
    for i in range(F['n']):
        out.paste(im.crop((i * F['fw'], 0, (i + 1) * F['fw'], F['fh'])).resize((fw, fh), Image.LANCZOS), (i * fw, 0))
    out.save(p, 'WEBP', quality=90, method=6)
    F['fw'], F['fh'] = fw, fh
if '--yaz' in sys.argv: json.dump(meta, open(meta_p, 'w'), indent=1, ensure_ascii=False)
print(f'çözülmüş bellek: {before / 1e6:.0f} MB -> {after / 1e6:.0f} MB')
