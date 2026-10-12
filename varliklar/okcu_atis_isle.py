"""Veo okçu atış videosundan oyun şeridi (<pre>_shot): seçilen kareler (24 fps sırası), beyaz zemin ve ayak gölgesi silinir.
anim.json'a rel (okun bırakıldığı şerit karesi) ve fx (ayak ortası) yazılır; oyunda archShot() kullanır.

    .venv/bin/python varliklar/okcu_atis_isle.py 2

Kare seçimi: 0-2 bekleme, 3..rel-1 ok takma ve germe (uzun bekleyişler seyreltilir), rel bırakma, sonrası geri tepme ve dönüş.
"""
import json, os, sys
import numpy as np
from PIL import Image
from scipy import ndimage as nd
H0 = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, H0)
import video_isle
IMG = os.path.join(H0, '..', 'sinir-kalesi', 'img')
SETS = {
    # 1. kademe (15 Eki) videosu 12 fps'de 4..30 alınmıştı: 24 fps'de 8, 10, .., 60 (bırakma 44)
    1: ('ham/anim/iskelet_okcu_1_atis_veo.mp4', list(range(8, 61, 2))),
    # 2. kademe: bekleme 20-32, takma 34-52, germe (uzun tutuş seyreltildi) 56-97, bırakma 99, tepme ve dönüş 102-146
    2: ('ham/anim/iskelet_okcu_2_atis_veo.mp4', [20, 26, 32, 34, 37, 40, 43, 46, 49, 52, 56, 60, 66, 72, 80, 88, 94, 97, 99,
        102, 106, 110, 114, 118, 122, 126, 130, 134, 138, 142, 146]),
}


def shadow_clean(name):
    p = os.path.join(IMG, name + '.webp'); im = np.array(Image.open(p).convert('RGBA')).astype(np.int16)
    m = json.load(open(os.path.join(IMG, 'anim.json'))); e = m[name]; H, W = im.shape[:2]; n = e['n']; fw = W // n
    rgb = im[..., :3]; grey = (rgb.max(2) - rgb.min(2) < 22) & (rgb.min(2) > 120); rows = np.zeros((H, W), bool); rows[int(H * 0.86):] = True
    im[grey & rows, 3] = 0
    for i in range(n): # kırıntılar (gölge parçası, uçan ok kalıntısı) atılır
        sl = im[:, i * fw:(i + 1) * fw]; a = sl[..., 3] > 40; lab, k = nd.label(a)
        if k > 1:
            sz = nd.sum(a, lab, range(1, k + 1)); keep = np.isin(lab, [j + 1 for j in range(k) if sz[j] > 40]); sl[~nd.binary_dilation(keep, iterations=1), 3] = 0
    Image.fromarray(im.astype(np.uint8)).save(p, 'WEBP', quality=86, method=6)
    low = np.nonzero((im[..., 3] > 128).any(1))[0].max(); e['base'] = round(float(H - 1 - low) / H, 4)
    a = im[:, 0:fw, 3] > 128; y1 = np.nonzero(a.any(1))[0].max(); fx = np.nonzero(a[y1 - int(0.04 * H):y1 + 1].any(0))[0]
    e['fx'] = round(float((fx.min() + fx.max()) / 2) / fw, 4)
    return m, e


if __name__ == '__main__':
    k = int(sys.argv[1]); src, order = SETS[k]; name = f'unit_archer{k}_shot'
    rel = {1: 18, 2: 18}[k]
    video_isle.main(src, name, fps=24, order=order, white=True)
    m, e = shadow_clean(name); e['rel'] = rel
    json.dump(m, open(os.path.join(IMG, 'anim.json'), 'w'), indent=1); print(name, e)
