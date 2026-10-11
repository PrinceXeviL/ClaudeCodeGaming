"""Kemik Kulesi canlı katmanları (11 Eki): dalgalanan bayraklar ve renk değiştiren rünler.

    python3 varliklar/kule_canli_isle.py

Kule görsellerinin bayraksız asılları varliklar/cikti/<ad>_tam.webp olarak bir kez saklanır (betik tekrar çalışınca oradan okur).
- Bayrak: kutudaki kumaş (renk kuralı, satır satır doldurulur, kenar çizgisi için genişletilir) img/<ad>_flag<i>.webp olur;
  kule görselinden ve ön korkuluk katmanından (<ad>_front.webp) silinir. Oyun bayrağı direğe asılı noktadan dalgalandırır.
- Rün: kutudaki parlak rün pikselleri img/<ad>_rune.webp (beyaz, saydamlık = parlaklık); oyun bunu renk renk boyayıp üstüne çizer.
Kutular görsel kesri (x0, y0, x1, y1). Sonda game.js TOWER_LIVE için JSON yazar.
"""
import json, os, shutil
import numpy as np
from PIL import Image, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IMG = os.path.join(ROOT, 'sinir-kalesi', 'img')
OUT = os.path.join(ROOT, 'varliklar', 'cikti')

FLAGS = {
    'tower_xbow_3': [((0.0, 0.272, 0.16, 0.56), 'red'), ((0.838, 0.272, 0.985, 0.54), 'red')],
    'tower_archer_fan': [((0.03, 0.285, 0.16, 0.56), 'red'), ((0.83, 0.285, 0.97, 0.56), 'red')],
    'tower_archer_bow': [((0.04, 0.59, 0.135, 0.735), 'teal'), ((0.855, 0.59, 0.95, 0.735), 'teal')],
}
# sallanan fenerler (11 Eki): kutu (x0, y0, x1, y1) ve asılma noktası (görsel kesri); kutudaki her şey (zincirin alt kısmı + fener) ayrı katman
SWING = {'tower_archer_bow': [((38 / 960, 472 / 1294, 148 / 960, 668 / 1294), (88 / 960, 472 / 1294)), ((818 / 960, 472 / 1294, 920 / 960, 668 / 1294), (868 / 960, 472 / 1294))]}
RUNES = {
    'tower_xbow_1': [(0.28, 0.71, 0.36, 0.80), (0.62, 0.72, 0.72, 0.82)],
    'tower_xbow_2': [(0.28, 0.44, 0.37, 0.69), (0.58, 0.44, 0.68, 0.67)],
    'tower_xbow_3': [(0.31, 0.46, 0.40, 0.74), (0.60, 0.50, 0.68, 0.66)],
    'tower_archer_bow': [(0.34, 0.47, 0.42, 0.75), (0.59, 0.46, 0.67, 0.75)],
    'tower_archer_fan': [(0.30, 0.48, 0.41, 0.65), (0.58, 0.47, 0.69, 0.64), (0.55, 0.33, 0.76, 0.40)],
}


def px(box, W, H):
    return int(box[0] * W), int(box[1] * H), int(box[2] * W), int(box[3] * H)


def cloth_mask(a, box, kind):
    H, W = a.shape[:2]; x0, y0, x1, y1 = px(box, W, H)
    r, g, b = [a[y0:y1, x0:x1, i].astype(int) for i in range(3)]
    col = ((r > g + 35) & (r > b + 15)) if kind == 'red' else ((g > r + 20) & (b > r + 10) & (r + g + b > 300))
    col &= a[y0:y1, x0:x1, 3] > 128
    cnt = col.sum(0); keep = cnt >= cnt.max() * 0.08  # kumaşın sütunları (kule kenarındaki kızılımsı lekeler dışarıda)
    c0, c1 = np.nonzero(keep)[0].min(), np.nonzero(keep)[0].max()
    col[:, :c0] = False; col[:, c1 + 1:] = False
    m = np.zeros_like(col)
    for y in range(col.shape[0]):  # satır satır doldur: kumaşın üstündeki amblem de bayrağa girer
        xs = np.nonzero(col[y])[0]
        if len(xs) > 2: m[y, xs.min():xs.max() + 1] = True
    m = np.asarray(Image.fromarray((m * 255).astype('uint8')).filter(ImageFilter.MaxFilter(13))) > 0  # kenar çizgisi
    full = np.zeros(a.shape[:2], bool); full[y0:y1, x0:x1] = m
    return full


def main():
    os.makedirs(OUT, exist_ok=True)
    live, man = {}, set(json.load(open(os.path.join(IMG, 'manifest.json'))))
    for name in set(FLAGS) | set(RUNES) | set(SWING):
        tam = os.path.join(OUT, name + '_tam.webp')
        if not os.path.exists(tam): shutil.copy(os.path.join(IMG, name + '.webp'), tam)
        tamf = os.path.join(OUT, name + '_front_tam.webp')
        if os.path.exists(os.path.join(IMG, name + '_front.webp')) and not os.path.exists(tamf): shutil.copy(os.path.join(IMG, name + '_front.webp'), tamf)
        a = np.asarray(Image.open(tam).convert('RGBA')).copy(); H, W = a.shape[:2]
        L = {}
        cut = np.zeros((H, W), bool)
        for i, (box, kind) in enumerate(FLAGS.get(name, []), 1):
            m = cloth_mask(a, box, kind); cut |= m
            x0, y0, x1, y1 = px(box, W, H)
            f = a[y0:y1, x0:x1].copy(); f[..., 3] = np.where(m[y0:y1, x0:x1], f[..., 3], 0)
            fn = f'{name}_flag{i}.webp'; Image.fromarray(f).save(os.path.join(IMG, fn), 'WEBP', quality=90, method=6); man.add(fn)
            L.setdefault('flags', []).append([round(x0 / W, 4), round(y0 / H, 4), round(x1 / W, 4), round(y1 / H, 4)])
        for i, (box, piv) in enumerate(SWING.get(name, []), 1):
            x0, y0, x1, y1 = px(box, W, H); m = np.zeros((H, W), bool); m[y0:y1, x0:x1] = a[y0:y1, x0:x1, 3] > 0; cut |= m
            f = a[y0:y1, x0:x1].copy()
            fn = f'{name}_sw{i}.webp'; Image.fromarray(f).save(os.path.join(IMG, fn), 'WEBP', quality=90, method=6); man.add(fn)
            L.setdefault('swing', []).append([round(x0 / W, 4), round(y0 / H, 4), round(x1 / W, 4), round(y1 / H, 4), piv[0], piv[1]])
        if FLAGS.get(name) or SWING.get(name):
            b = a.copy(); b[..., 3] = np.where(cut, 0, b[..., 3]); Image.fromarray(b).save(os.path.join(IMG, name + '.webp'), 'WEBP', quality=88, method=6)
            if os.path.exists(tamf):
                fr = np.asarray(Image.open(tamf).convert('RGBA')).copy(); fr[..., 3] = np.where(cut[:fr.shape[0]], 0, fr[..., 3])
                Image.fromarray(fr).save(os.path.join(IMG, name + '_front.webp'), 'WEBP', quality=88, method=6)
        # rünler: tek görselde (kutuların toplam alanı), beyaz + parlaklıkla saydamlık
        bx = RUNES.get(name, [])
        if bx:
            X0, Y0 = min(q[0] for q in bx), min(q[1] for q in bx); X1, Y1 = max(q[2] for q in bx), max(q[3] for q in bx)
            x0, y0, x1, y1 = px((X0, Y0, X1, Y1), W, H)
            r, g, bb = [a[..., i].astype(int) for i in range(3)]
            fan = name == 'tower_archer_fan'
            glow = ((r > 140) & (bb > 140) & (r - g > 70)) if fan else ((g > r + 45) & (g > bb + 10))
            inbox = np.zeros((H, W), bool)
            for q in bx:
                qx0, qy0, qx1, qy1 = px(q, W, H); inbox[qy0:qy1, qx0:qx1] = True
            m = glow & inbox & (a[..., 3] > 200)
            lum = (np.maximum(np.maximum(r, g), bb) / 255.0)
            al = np.where(m, np.clip((lum - 0.35) / 0.5, 0, 1) * 255, 0).astype(np.uint8)
            al = np.asarray(Image.fromarray(al).filter(ImageFilter.GaussianBlur(0.8)))
            rr = np.zeros((y1 - y0, x1 - x0, 4), np.uint8); rr[..., :3] = 255; rr[..., 3] = al[y0:y1, x0:x1]
            fn = f'{name}_rune.webp'; Image.fromarray(rr).save(os.path.join(IMG, fn), 'WEBP', quality=90, method=6); man.add(fn)
            L['rune'] = [round(x0 / W, 4), round(y0 / H, 4), round(x1 / W, 4), round(y1 / H, 4)]
        live[name] = L
    json.dump(sorted(man), open(os.path.join(IMG, 'manifest.json'), 'w'), indent=0)
    print(json.dumps(live))


if __name__ == '__main__':
    main()
