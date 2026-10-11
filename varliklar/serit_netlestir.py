"""Video şeritlerini netleştirir (11 Eki): küçültmede incelen kalın konturu geri kazandırır, kareler arası renk titremesini kilitler.
    .venv/bin/python varliklar/serit_netlestir.py enemy_legion_walk [enemy_legion_atk ...] [--dene]   (--dene: img/ yerine scratchpad'e yazar)
Her kare: 1) (yalnız --renk) renk kilidi: kare renkleri asıl görselin (enemy_x.webp) renk dağılımına çekilir (kanal başına ortalama/sapma, yalnız opak alanda)
2) netleştirme (unsharp mask) 3) dış kontur: opak alanın 1 px dışına koyu kontur (görsellerin kalın çizgi tarzı).
Asıl şerit varliklar/cikti/serit_yedek/ içinde saklanır (betik ikinci kez çalışınca yedekten okur, üst üste işlemez).
"""
import json, os, shutil, sys
import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IMG = os.path.join(ROOT, 'sinir-kalesi', 'img')
BAK = os.path.join(ROOT, 'varliklar', 'cikti', 'serit_yedek')
OUTLINE = np.array([24, 16, 14], np.float32)
RENK = '--renk' in sys.argv


def stats(a, m):
    px = a[..., :3][m].astype(np.float32)
    return px.mean(0), px.std(0) + 1e-3


def process(name, out_dir):
    A = json.load(open(os.path.join(IMG, 'anim.json')))[name]
    os.makedirs(BAK, exist_ok=True)
    bak = os.path.join(BAK, name + '.webp')
    if not os.path.exists(bak): shutil.copy(os.path.join(IMG, name + '.webp'), bak)
    strip = np.asarray(Image.open(bak).convert('RGBA')).copy()
    fw, n = A['fw'], A['n']
    base = name.rsplit('_', 1)[0]
    for suf in ('_walk', '_atk2', '_atk3', '_atk', '_skill', '_die', '_walk_on', '_walk_arka'):
        if name.endswith(suf): base = name[:-len(suf)]; break
    refp = os.path.join(IMG, base + '.webp')
    ref = np.asarray(Image.open(refp).convert('RGBA')) if os.path.exists(refp) else None
    rm, rs = stats(ref, ref[..., 3] > 200) if ref is not None else (None, None)
    frames = []
    for i in range(n):
        f = strip[:, i * fw:(i + 1) * fw].astype(np.float32)
        m = f[..., 3] > 200
        if RENK and rm is not None and m.sum() > 50:  # renk kilidi (11 Eki denemesi: parıltıları soldurdu, varsayılan kapalı; --renk ile açılır)
            fm, fs = stats(f, m)
            adj = (f[..., :3] - fm) / fs * rs + rm
            f[..., :3] = np.where(m[..., None], f[..., :3] * 0.5 + adj * 0.5, f[..., :3])
        im = Image.fromarray(f.clip(0, 255).astype(np.uint8), 'RGBA')
        rgb = im.convert('RGB').filter(ImageFilter.UnsharpMask(radius=1.4, percent=90, threshold=2))
        g = np.dstack([np.asarray(rgb).astype(np.float32), f[..., 3]])
        al = g[..., 3] > 110
        ring = ndimage.binary_dilation(al, iterations=1) & ~al  # 1 px dış kontur
        g[ring, :3] = OUTLINE; g[ring, 3] = np.maximum(g[ring, 3], 235)
        frames.append(g.clip(0, 255).astype(np.uint8))
    out = np.concatenate(frames, 1)
    Image.fromarray(out, 'RGBA').save(os.path.join(out_dir, name + '.webp'), 'WEBP', quality=90, method=6)
    return os.path.join(out_dir, name + '.webp')


if __name__ == '__main__':
    out = sys.argv[sys.argv.index('--dene') + 1] if '--dene' in sys.argv else IMG
    names = [a for a in sys.argv[1:] if not a.startswith('--') and a != out]
    for n in names:
        if not os.path.exists(os.path.join(IMG, n + '.webp')): print('yok, atlandı:', n); continue
        print(process(n, out))
