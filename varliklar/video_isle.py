"""Görselden üretilmiş videodaki (Veo vb.; magenta zemin, sabit kamera, yerinde hareket) döngüyü oyun şeridine çevirir.

    python3 varliklar/video_isle.py ham/anim/lejyoner_yuru_video.mp4 enemy_legion_walk            # döngüyü kendisi bulur
    python3 varliklar/video_isle.py ham/anim/lejyoner_yuru_video.mp4 enemy_legion_walk --start 61 --len 31

- Video 24 kare/sn'ye çevrilir; --len verilmezse 20-40 kare arası en iyi kapanan döngü (baş ve son kare en benzer) aranır.
- Magenta zemin silinir, kırıntılar atılır; kareler SABİT bir çerçeveyle kesilir (videodaki doğal inip kalkma korunur).
- Çıktı: sinir-kalesi/img/<ad>.webp (yan yana kareler), img/anim.json kare bilgisi, manifest.
"""
import json, os, subprocess, sys, tempfile
import numpy as np
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from anim_isle import remove_magenta, biggest_mask

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IMG = os.path.join(ROOT, 'sinir-kalesi', 'img')
TARGET_H = 300  # şerit bellek tutmasın (oyunda karakter en çok ~150 px çizilir)


try:  # ffmpeg sistemde yoksa pip paketi imageio-ffmpeg'in getirdiği kullanılır
    import imageio_ffmpeg
    FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()
except ImportError:
    FFMPEG = 'ffmpeg'


def frames_of(video, fps=24):
    d = tempfile.mkdtemp()
    subprocess.run([FFMPEG, '-v', 'error', '-i', video, '-vf', f'fps={fps}', os.path.join(d, 'f_%04d.png')], check=True)
    fs = sorted(os.listdir(d))
    return [np.asarray(Image.open(os.path.join(d, f)).convert('RGB')) for f in fs]


def find_loop(rgb, lo=20, hi=40):
    small = []
    for a in rgb:
        s = a[::4, ::4].astype(np.float32); m = ((s[..., 0] + s[..., 2]) / 2 - s[..., 1]) < 90
        small.append(np.where(m[..., None], s, 0))
    small = np.array(small); N = len(small); best = None
    for st in range(8, N - hi - 2):
        for L in range(lo, hi + 1):
            if st + L + 1 >= N: break
            v = np.abs(small[st] - small[st + L]).mean() + 0.5 * np.abs(small[st + 1] - small[st + L + 1]).mean()
            if best is None or v < best[0]: best = (v, st, L)
    return best[1], best[2]


def main(src, name, start=None, length=None, fps=24):
    rgb = frames_of(os.path.join(ROOT, 'varliklar', src), fps)
    if start is None or length is None:
        start, length = find_loop(rgb)
        print('döngü: başlangıç', start, 'uzunluk', length)
    cells = []
    for a in rgb[start:start + length]:
        rgba = remove_magenta(a)
        keep = biggest_mask(rgba[..., 3])
        rgba[..., 3] = np.where(keep | ((rgba[..., 3] > 0) & (rgba[..., 3] <= 128)), rgba[..., 3], 0)
        cells.append(rgba)
    boxes = []
    for c in cells:
        ys, xs = np.nonzero(c[..., 3] > 128); boxes.append((ys.min(), ys.max(), xs.min(), xs.max()))
    y0 = min(b[0] for b in boxes); y1 = max(b[1] for b in boxes); x0 = min(b[2] for b in boxes); x1 = max(b[3] for b in boxes)
    hs = sorted(b[1] - b[0] for b in boxes); chH = hs[len(hs) // 2]
    k = TARGET_H / chH; pad = 6
    # kare ortası: başın (miğfer/sorguç) ortalama yatay yeri (sabit; mızrak uzansa da karakter kaymaz,
    # yürüyüş ve saldırı şeritleri aynı noktaya oturur)
    def head_x(c, b):
        ys, xs = np.nonzero(c[..., 3] > 128); sel = ys < b[0] + (b[1] - b[0]) * 0.16
        return xs[sel].mean()
    cx = np.mean([head_x(c, b) for c, b in zip(cells, boxes)])
    half = max(cx - x0, x1 - cx) + pad
    X0 = int(cx - half); X1 = int(cx + half); Y0 = y0 - pad; Y1 = y1 + pad
    FW = int(round((X1 - X0) * k)); FH = int(round((Y1 - Y0) * k))
    out = Image.new('RGBA', (FW * len(cells), FH), (0, 0, 0, 0))
    for i, c in enumerate(cells):
        im = Image.fromarray(c[max(0, Y0):Y1, max(0, X0):X1]).resize((FW, FH), Image.LANCZOS)
        out.paste(im, (i * FW, 0))
    out.save(os.path.join(IMG, name + '.webp'), 'WEBP', quality=86, method=6)
    meta_p = os.path.join(IMG, 'anim.json')
    meta = json.load(open(meta_p)) if os.path.exists(meta_p) else {}
    meta[name] = {'n': len(cells), 'fw': FW, 'fh': FH, 'base': round((Y1 - y1) / (Y1 - Y0), 4), 'ch': round(chH / (Y1 - Y0), 4)}
    if name.endswith('_walk'):
        # duruş karesi: ayakların en kapalı olduğu kare (oyunda dururken bu gösterilir)
        def legw(c):
            a = c[int(c.shape[0] * 0.75):, :, 3] > 128; xs = np.nonzero(a)[1]; return xs.max() - xs.min() if len(xs) else 1e9
        meta[name]['idle'] = int(np.argmin([legw(c) for c in cells]))
    json.dump(meta, open(meta_p, 'w'), indent=1)
    man_p = os.path.join(IMG, 'manifest.json'); man = json.load(open(man_p))
    if name + '.webp' not in man: json.dump(sorted(man + [name + '.webp']), open(man_p, 'w'), indent=0)
    print(name, len(cells), 'kare', FW, 'x', FH, 'şerit', out.size)


if __name__ == '__main__':
    a = sys.argv
    st = int(a[a.index('--start') + 1]) if '--start' in a else None
    ln = int(a[a.index('--len') + 1]) if '--len' in a else None
    fps = int(a[a.index('--fps') + 1]) if '--fps' in a else 24
    main(a[1], a[2], st, ln, fps)
