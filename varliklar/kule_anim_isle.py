"""Kule atış animasyonları: Kaggle (Wan) videosunu kule şeridine çevirir (kaggle_wan.py, iş 'kule': true ise bunu çağırır).

Kule görseli referansta video_uret.ref_of ile konur (832x480, altta 40 px pay). Bütün karelerin ortak sınırı kesilir;
anim.json'a şeridin görsele göre yeri (box: görsel dikdörtgeni 0..1 iken çerçevenin sol, üst, sağ, alt kenarı),
fırlatma karesi (rel: 0..1) ve o karede hareket eden parçanın merkezi (relPt, görsele göre) yazılır.
Oyun (game.js drawTowerBody) atışta bu kareleri oynatır, mermiyi rel anında relPt'den çıkarır.
Kare atlanmaz: videonun bütün kareleri (16 fps) kullanılır.
"""
import json, os
import numpy as np
from PIL import Image
import video_isle
from anim_isle import remove_magenta

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IMG = os.path.join(ROOT, 'sinir-kalesi', 'img')
OUT = os.path.join(ROOT, 'varliklar', 'ham', 'anim')
FH_MAX = 300  # şerit kare yüksekliği (px); 49 kare x ~300 px genişlik doku sınırına sığar


def process(job):
    name = job['name']; base = name[:-4]  # tower_..._atk -> görsel adı
    im = Image.open(os.path.join(IMG, base + '.webp')); iw, ih = im.size
    k = min(400 / ih, 560 / iw); sw, sh = iw * k, ih * k; sx0 = (832 - int(sw)) // 2; sy0 = 480 - int(sh) - 40
    rgb = video_isle.frames_of(os.path.join(OUT, name + '.mp4'), 16)
    L = len(rgb) - (1 if job.get('loop') else 0)
    fr = [remove_magenta(a) for a in rgb[:L]]
    al = np.array([f[..., 3] > 40 for f in fr])
    ys, xs = np.nonzero(al.any(0)); x0, x1, y0, y1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
    # fırlatma karesi: ilk kareden en çok ayrışan kare; hareket eden parçanın merkezi
    diff = [(a & ~al[0]).sum() for a in al]; rel = int(np.argmax(diff))
    my, mx = np.nonzero(al[rel] & ~al[0])
    rp = [((mx.mean() if len(mx) else (x0 + x1) / 2) - sx0) / sw, ((my.mean() if len(my) else y0) - sy0) / sh]
    s = min(1, FH_MAX / (y1 - y0)); fw, fh = max(1, round((x1 - x0) * s)), max(1, round((y1 - y0) * s))
    strip = Image.new('RGBA', (fw * L, fh))
    for i, f in enumerate(fr):
        strip.paste(Image.fromarray(f[y0:y1, x0:x1]).resize((fw, fh), Image.LANCZOS), (i * fw, 0))
    strip.save(os.path.join(IMG, name + '.webp'), 'WEBP', quality=86, method=6)
    meta_p = os.path.join(IMG, 'anim.json'); meta = json.load(open(meta_p))
    meta[name] = {'n': L, 'fw': fw, 'fh': fh, 'tower': True, 'rel': round(rel / max(1, L - 1), 3), 'relPt': [round(v, 3) for v in rp],
                  'box': [round((x0 - sx0) / sw, 4), round((y0 - sy0) / sh, 4), round((x1 - sx0) / sw, 4), round((y1 - sy0) / sh, 4)]}
    json.dump(meta, open(meta_p, 'w'), indent=1)
    man_p = os.path.join(IMG, 'manifest.json'); man = set(json.load(open(man_p))); man.add(name + '.webp')
    json.dump(sorted(man), open(man_p, 'w'), indent=0)
    print('kule şeridi', name, L, 'kare', fw, 'x', fh, meta[name])


if __name__ == '__main__':
    import sys
    for n in sys.argv[1:]: process({'name': n, 'loop': True})
