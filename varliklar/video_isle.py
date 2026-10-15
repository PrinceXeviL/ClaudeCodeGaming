"""Görselden üretilmiş videodaki (Veo vb.; magenta zemin, sabit kamera, yerinde hareket) döngüyü oyun şeridine çevirir.

    python3 varliklar/video_isle.py ham/anim/lejyoner_yuru_video.mp4 enemy_legion_walk            # döngüyü kendisi bulur
    python3 varliklar/video_isle.py ham/anim/lejyoner_yuru_video.mp4 enemy_legion_walk --start 61 --len 31
    python3 varliklar/video_isle.py ham/anim/mortimer_bekle_veo.mp4 mortimer_bekle --beyaz --fps 10 --lo 50 --hi 80   # beyaz zemin, uzun döngü

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
UNIT_H = 160    # düşman/iskelet şeritleri: en yakın zoomda ekrandaki boy kadar (bellek ~1/4, oyunda fark edilmez)


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


def remove_white(a):
    """Beyaz zeminli video (15 Eki, Veo): kenara bağlı açık renkli zemin silinir, kontur içindeki beyaz kalır."""
    from scipy import ndimage as nd
    f = a.astype(np.float32); mn = f.min(2); mx = f.max(2)
    lab, n = nd.label((mn > 228) & (mx - mn < 26))
    edge = set(np.unique(np.r_[lab[0], lab[-1], lab[:, 0], lab[:, -1]])) - {0}
    bg = np.isin(lab, list(edge))
    # kontur içinde kalan zemin (ör. tırpan sapıyla cübbe arası): büyük ve neredeyse saf beyaz bileşenler de zemin
    idx = np.arange(n + 1); pure = ((mn > 240) & (mx - mn < 14)).astype(np.float32)
    inner = (nd.sum(np.ones_like(mn), lab, idx) >= 60) & (nd.mean(pure, lab, idx) > 0.7); inner[0] = False
    bg = nd.binary_opening(bg | inner[lab], iterations=1)
    dist = nd.distance_transform_edt(~bg)
    al = np.where(bg, 0, np.where(dist < 2.5, np.clip((255 - mn) / 45, 0, 1), 1))
    rgb = f.copy(); k = (al > 0) & (al < 1)
    rgb[k] = np.clip((f[k] - 255 * (1 - al[k, None])) / np.maximum(al[k, None], 0.05), 0, 255)
    return np.dstack([rgb, al * 255]).astype(np.uint8)


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


def main(src, name, start=None, length=None, fps=24, order=None, first_h=False, white=False, lo=20, hi=40):
    rgb = frames_of(os.path.join(ROOT, 'varliklar', src), fps)
    if order is None and (start is None or length is None):
        start, length = find_loop(rgb, lo, hi)
        print('döngü: başlangıç', start, 'uzunluk', length)
    picked = [rgb[i] for i in order] if order is not None else rgb[start:start + length]  # order: kare sırası (döngüyü kaydırmak için)
    cells = []
    for a in picked:
        rgba = remove_white(a) if white else remove_magenta(a)
        keep = biggest_mask(rgba[..., 3])
        rgba[..., 3] = np.where(keep | ((rgba[..., 3] > 0) & (rgba[..., 3] <= 128)), rgba[..., 3], 0)
        cells.append(rgba)
    boxes = []
    for c in cells:
        ys, xs = np.nonzero(c[..., 3] > 128); boxes.append((ys.min(), ys.max(), xs.min(), xs.max()))
    y0 = min(b[0] for b in boxes); y1 = max(b[1] for b in boxes); x0 = min(b[2] for b in boxes); x1 = max(b[3] for b in boxes)
    hs = sorted(b[1] - b[0] for b in boxes); chH = hs[len(hs) // 2]
    if first_h or name.endswith('_die'): chH = max(b[1] - b[0] for b in boxes[:4])  # ölüm: boy ayaktaki ilk karelerden; yatan karelerle ölçek büyümesin (15 Eki: _die şeritlerinde kendiliğinden)
    k = (UNIT_H if name.startswith(('enemy_', 'unit_')) else TARGET_H) / chH; pad = 6
    # kare ortası: başın (miğfer/sorguç) ortalama yatay yeri (sabit; mızrak uzansa da karakter kaymaz,
    # yürüyüş ve saldırı şeritleri aynı noktaya oturur)
    def head_x(c, b):
        ys, xs = np.nonzero(c[..., 3] > 128); sel = ys < b[0] + (b[1] - b[0]) * 0.16
        return xs[sel].mean()
    cx = np.mean([head_x(c, b) for c, b in zip(cells, boxes)])
    half = max(cx - x0, x1 - cx) + pad
    X0 = int(cx - half); X1 = int(cx + half); Y0 = y0 - pad; Y1 = y1 + pad
    k = min(k, 16000 / ((X1 - X0) * len(cells)))  # WebP en çok 16383 px genişlik: geniş saldırı karelerinde şerit küçülür
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
    lo = int(a[a.index('--lo') + 1]) if '--lo' in a else 20
    hi = int(a[a.index('--hi') + 1]) if '--hi' in a else 40
    main(a[1], a[2], st, ln, fps, white='--beyaz' in a, lo=lo, hi=hi)  # --beyaz: beyaz zeminli video


def remove_white_fx(a, dark=110, grow=10, gain=1.7, core_r=6, core_max=5000):
    """Beyaz zeminde parlak efektli kareler (14 Eki, Merlin'in ateşi/şimşeği): remove_white ateş ve şimşek parıltısını opak soluk leke
    bırakıyordu. Karakterin gövdesi (koyu pikseller, grow px genişletilir) remove_white ile kesilir; gövde dışındaki açık efekt pikselleri
    beyazın üstüne bindirilmiş gibi ayrıştırılır (renk = (c - 255(1-a)) / a, a = 1 - min/255) ve saydamlık gain ile güçlendirilir."""
    from scipy import ndimage as nd
    base = remove_white(a).astype(np.float32)
    f = a.astype(np.float32); mn = f.min(2)
    body = nd.binary_fill_holes(nd.binary_dilation(mn < dark, iterations=grow))
    a0 = np.clip((255 - mn) / 255, 0, 1)
    col = np.clip((f - 255 * (1 - a0[..., None])) / np.maximum(a0[..., None], 0.02), 0, 255)
    fx = ~body & (a0 > 0.03)
    out = base.copy()
    out[fx, :3] = col[fx]; out[fx, 3] = np.clip(a0[fx] * gain, 0, 1) * 255
    # alevin / şimşeğin bembeyaz çekirdeği zeminden ayrılamaz: efekt şeklinin içinde kalan (kapanışla dolan) açık pikseller parlak çekirdek
    sat = (f.max(2) - mn) / np.maximum(f.max(2), 1)
    glowc = (f.max(2) > 150) & (sat > 0.3)  # efektin renkli parıltısı (koyu cübbe girmez); çekirdek bunun içinde kalan delik
    holes = nd.binary_fill_holes(glowc) & ~glowc; lab, n = nd.label(holes)  # ateş topunun iri çekirdeği: parıltıyla çevrili küçük delikler (yer halkasının içi gibi büyükler değil)
    small = np.isin(lab, [i + 1 for i, z in enumerate(nd.sum(holes, lab, range(1, n + 1))) if z < core_max]) if n else holes
    core = (nd.binary_closing(glowc, iterations=core_r) | small) & (a0 <= 0.3) & (~body | (base[..., 3] < 10))
    out[core, :3] = f[core]; out[core, 3] = 235
    out[~body & ~fx & ~core] = 0
    return out.astype(np.uint8)


def pack(tiles, FW, FH, limit=16000):
    """16 Eki: kareleri şeride dizer; WebP 16383 px sınırını aşarsa satırlara böler.
    Döner: (görsel, cols) — cols yalnız birden çok satır varsa anim.json'a 'cols' olarak yazılır (game.js drawFrame okur)."""
    n = len(tiles); rows = max(1, -(-FW * n // limit)); cols = -(-n // rows)
    out = Image.new('RGBA', (FW * cols, FH * rows), (0, 0, 0, 0))
    for i, t in enumerate(tiles): out.paste(t, ((i % cols) * FW, (i // cols) * FH))
    return out, (cols if rows > 1 else None)
