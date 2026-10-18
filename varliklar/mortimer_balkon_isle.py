"""Mortimer balkonda (18 Eki, Caner: "yeni evin balkonunda kırmızı koltukta otururken ve teleskoptan düşmana bakarken"): Gemini, beyaz zemin.
ham/nm39_mortimer_koltuk.jpg -> img/mortimer_pose_koltuk.webp, ham/nm39_mortimer_teleskop.jpg -> img/mortimer_pose_teleskop.webp (atlasa girer) (eşyasıyla birlikte;
oyunda kaledeki koltuğun / teleskopun yerine oturur, kalenin eşyasını örter). Beyaz zemin kale_v5_isle.beyaz_sil ile; kenar serit_temizle.kare ile.
    .venv/bin/python3 varliklar/mortimer_balkon_isle.py [koltuk|teleskop]"""
import os, sys, json
import numpy as np
from PIL import Image
D = os.path.dirname(os.path.abspath(__file__)); IMG = os.path.join(D, '..', 'sinir-kalesi', 'img'); sys.path.insert(0, D)
src = open(os.path.join(D, 'kale_v5_isle.py')).read(); ns = {'__file__': os.path.join(D, 'kale_v5_isle.py')}
exec(src[src.index('import os'):src.index('new = beyaz_sil(')], ns)
import serit_temizle
for k in (sys.argv[1:] or ['koltuk', 'teleskop']):
    p = os.path.join(D, 'ham', f'nm39_mortimer_{k}.jpg')
    if not os.path.exists(p): print('yok', p); continue
    a = ns['beyaz_sil'](np.asarray(Image.open(p).convert('RGB')))
    ys, xs = np.nonzero(a[..., 3] > 20); a = a[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    im = Image.fromarray(a); s = 360 / im.height; im = im.resize((round(im.width * s), 360), Image.LANCZOS)
    im = Image.fromarray(serit_temizle.kare(np.asarray(im), 'mortimer_' + k))
    im.save(os.path.join(IMG, f'mortimer_pose_{k}.webp'), 'WEBP', quality=90, method=6); print(k, im.size)
    m = json.load(open(os.path.join(IMG, 'meta.json'))); m[f'mortimer_pose_{k}'] = [im.width, im.height]; json.dump(m, open(os.path.join(IMG, 'meta.json'), 'w'))
