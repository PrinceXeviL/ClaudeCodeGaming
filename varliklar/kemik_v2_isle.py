# Kemik Kulesi v2 (20 Eki 2026, "Devin Kemikleri"): Gemini sayfası ham/nm_kemik_v2_kademe.jpg -> img/tower_xbow_1..3.webp + _front.webp
# Sayfadaki üç kule magenta boşluklarla ayrılır; mor rünler magenta silinirken delinir, deliklere kaynağın rengi geri konur.
# _front: platformun ön kenarının önü (okçuların ayağını örten korkuluk ve tahta kalınlığı), görselin üstten FRONT kesri kadar.
# Eski görseller varliklar/cikti/kemik_eski/ altına taşınır (ilk çalıştırmada).
import json, os, shutil
import numpy as np
from PIL import Image
from scipy import ndimage as nd
from anim_isle import remove_magenta

HAM = 'ham/nm_kemik_v2_kademe.jpg'
IMG = '../sinir-kalesi/img'
ESKI = 'cikti/kemik_eski'
SEGS = [(88, 649), (719, 1275), (1321, 1973)]  # sayfadaki kule sütunları (px)
SCALE = 1.6  # oyundaki çözünürlük (eski görseller ~960 px genişlikteydi)
# ön kenar: [sol köşe, ön köşe, sağ köşe] (görsel kesri) ya da çanak yayı ('arc', cx, cy, rx, ry); rail: kenarın üstündeki korkuluk payı
FRONT = [
    dict(edge=[[0.19, 0.165], [0.47, 0.27], [0.79, 0.17]], rail=0.075, front=0.32),
    dict(edge=[[0.12, 0.14], [0.5, 0.245], [0.87, 0.14]], rail=0.07, front=0.30),
    dict(arc=[0.54, 0.15, 0.235, 0.065], rail=0.0, front=0.30),
]


def cut(src, rgba, a, b):
    sub = rgba[:, a:b].copy(); s0 = src[:, a:b]; m = sub[..., 3] > 40
    bg = np.array([src[5, 5], src[5, -6], src[-6, 5], src[-6, -6]]).mean(0)
    l, n = nd.label(m); s = nd.sum(m, l, range(1, n + 1)); keep = np.isin(l, [i + 1 for i, v in enumerate(s) if v > 800])
    filled = nd.binary_fill_holes(nd.binary_closing(keep, iterations=3))
    hole = filled & (sub[..., 3] < 250) & (np.sqrt(((s0 - bg) ** 2).sum(-1)) > 70)
    sub[hole, :3] = s0[hole]; sub[hole, 3] = 255
    out = np.zeros_like(sub); km = nd.binary_dilation(keep, iterations=1) | hole; out[km] = sub[km]
    ys, xs = np.where(out[..., 3] > 0)
    return out[ys.min():ys.max() + 1, xs.min():xs.max() + 1]


def front_mask(W, H, F):
    yy, xx = np.mgrid[0:H, 0:W]; fx, fy = xx / W, yy / H
    if 'arc' in F:
        cx, cy, rx, ry = F['arc']; u = np.clip((fx - cx) / rx, -1, 1)
        line = np.where(np.abs(fx - cx) < rx, cy + ry * np.sqrt(1 - u * u), -1)
    else:
        (x0, y0), (x1, y1), (x2, y2) = F['edge']
        line = np.where(fx < x1, y0 + (y1 - y0) * (fx - x0) / (x1 - x0), y1 + (y2 - y1) * (fx - x1) / (x2 - x1))
        line = np.where((fx < x0) | (fx > x2), -1, line)
    return (fy > line - F['rail']) & (fy < F['front'])


def main():
    os.makedirs(ESKI, exist_ok=True)
    src = np.array(Image.open(HAM).convert('RGB')).astype(int)
    rgba = remove_magenta(src.astype(np.uint8))
    meta = json.load(open(IMG + '/meta.json'))
    for k, (a, b) in enumerate(SEGS):
        name = f'tower_xbow_{k + 1}'
        for suf in ('', '_front', '_rune', '_collapse') + (('_flag1', '_flag2') if k == 2 else ()):
            p = f'{IMG}/{name}{suf}.webp'
            if os.path.exists(p) and not os.path.exists(f'{ESKI}/{name}{suf}.webp'): shutil.copy(p, f'{ESKI}/{name}{suf}.webp')
        c = Image.fromarray(cut(src, rgba, a, b)); c = c.resize((round(c.width * SCALE), round(c.height * SCALE)), Image.LANCZOS)
        c.save(f'{IMG}/{name}.webp', quality=90)
        F = FRONT[k]; arr = np.array(c); m = front_mask(c.width, c.height, F); fr = arr.copy(); fr[~m] = 0
        Image.fromarray(fr[:round(F['front'] * c.height)]).save(f'{IMG}/{name}_front.webp', quality=90)
        print(name, c.size)
    print('meta (elle): tower_xbow_1..3 genişlik/taban oranlarını game.js ile birlikte ayarla')


if __name__ == '__main__':
    main()
