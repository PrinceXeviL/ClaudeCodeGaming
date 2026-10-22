"""Veo videosunda açık haç simgelerini güneş amblemine çevirir (22 Eki, f1_severus_giris_veo: başlıkta ve göğüste 3 haç).
Referans karede (sabit kamera) haçların yeri ve boyu verilir; her kare için şablon eşleştirme ile ileri/geri izlenir (şablon her karede
yenilenir: yavaş yakınlaşma ve kıpırdanma da tutar), güveni düşen karelerde komşu karelerden ara değer. Üstüne altın güneş amblemi boyanır.
    .venv/bin/python3 varliklar/hac_boya.py girdi.mp4 cikti.mp4
"""
import subprocess, sys
import numpy as np
import imageio_ffmpeg
from PIL import Image, ImageDraw, ImageFilter
from numpy.lib.stride_tricks import sliding_window_view as swv

FF = imageio_ffmpeg.get_ffmpeg_exe()
SRC, OUT = sys.argv[1], sys.argv[2]
W, H, FPS = 1280, 720, 24
REF = 192  # 8. sn
CROSSES = [(580, 225, 26, 34), (595, 358, 24, 28), (595, 408, 22, 28)]  # x, y, genişlik, yükseklik (referans karede)
START = 66  # bu kareden önce Severus görünmüyor (uzak plan)

raw = subprocess.run([FF, '-v', 'error', '-i', SRC, '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], capture_output=True).stdout
fr = np.frombuffer(raw, np.uint8).reshape(-1, H, W, 3).copy(); N = len(fr)
gray = fr.astype(np.float32).mean(3)


def match(g, tpl, cx, cy, R):
    th, tw = tpl.shape; x0, y0 = int(cx - tw / 2 - R), int(cy - th / 2 - R)
    x0, y0 = max(0, x0), max(0, y0); reg = g[y0:y0 + th + 2 * R, x0:x0 + tw + 2 * R]
    if reg.shape[0] < th or reg.shape[1] < tw: return cx, cy, 0
    win = swv(reg, (th, tw)); t = (tpl - tpl.mean()) / (tpl.std() + 1e-6)
    m = win.mean((2, 3), keepdims=True); s = win.std((2, 3), keepdims=True) + 1e-6
    ncc = (((win - m) / s) * t).mean((2, 3)); iy, ix = np.unravel_index(np.argmax(ncc), ncc.shape)
    return x0 + ix + tw / 2, y0 + iy + th / 2, float(ncc[iy, ix])


# 22 Eki (2): her karede çok ölçekli arama (8. sn'deki temiz haçların şablonu küçültülerek), önceki kareden tahminle; sonra aykırı sıçramalar
# medyanla ayıklanır (şablon güncellenmez: kayma olmaz). Başlangıç: 80. kare (elle ölçülmüş yer ve ölçek).
from PIL import Image as _I
REFT = [gray[REF, int(c[1] - c[3]):int(c[1] + c[3]), int(c[0] - c[2]):int(c[0] + c[2])] for c in CROSSES]
def tpl_at(k, sc):
    t = REFT[k]; h, w = max(6, int(t.shape[0] * sc)), max(6, int(t.shape[1] * sc))
    return np.asarray(_I.fromarray(t.astype(np.uint8)).resize((w, h), _I.BILINEAR)).astype(np.float32)
def track_from(f0, pos0, sc0, frames):
    res = {}; pos, sc = list(pos0), sc0
    for f in frames:
        out = []
        for k in range(3):
            bq, bx, by, bs = -1, pos[k][0], pos[k][1], sc
            for s2 in (sc * 0.96, sc, sc * 1.04):
                x, y, q = match(gray[f], tpl_at(k, s2), pos[k][0], pos[k][1], 16)
                if q > bq: bq, bx, by, bs = q, x, y, s2
            out.append((bx, by, bq, bs))
        good = [o for o in out if o[2] > 0.45]
        if good:
            sc = float(np.median([o[3] for o in good]))
            for k, o in enumerate(out):
                if o[2] > 0.45: pos[k] = (o[0], o[1])
        res[f] = [(pos[k][0], pos[k][1], sc, out[k][2]) for k in range(3)]
    return res
P80 = [(603, 220), (630, 293), (637, 323)]
tr = track_from(80, P80, 0.59, range(80, N)); tr.update(track_from(80, P80, 0.59, range(80, START - 1, -1)))
fs = sorted(tr); arr = np.array([[[v[0], v[1], v[2]] for v in tr[f]] for f in fs])  # kare, haç, (x, y, ölçek)
from scipy.ndimage import median_filter
sm = median_filter(arr, size=(7, 1, 1), mode='nearest')
sm[:, 1, 0] = sm[:, 2, 0] - 4 * sm[:, 2, 2]; sm[:, 1, 1] = sm[:, 2, 1] - 50 * sm[:, 2, 2]  # göğüs haçı: alttakinin hemen üstünde (kendi izi omuza kayıyordu)
track = {f: [(sm[i, k, 0], sm[i, k, 1], max(CROSSES[k][2], CROSSES[k][3]) * 0.5 * sm[i, k, 2] * (1.0 if k == 0 else 0.92)) for k in range(3)] for i, f in enumerate(fs)}
# parlamada (94-121) başlık haçı izlenemiyor: elle işaretlenmiş yerlerden ara değer, amblem biraz büyük (hata payı)
MK = {94: (570, 260), 98: (578, 258), 102: (566, 258), 106: (562, 262), 110: (594, 263), 114: (603, 256), 118: (600, 250), 121: (599, 247)}
mk = sorted(MK)
for f in range(mk[0], mk[-1] + 1):
    a2 = max(k for k in mk if k <= f); b2 = min(k for k in mk if k >= f); u = 0 if a2 == b2 else (f - a2) / (b2 - a2)
    x = MK[a2][0] + (MK[b2][0] - MK[a2][0]) * u; y = MK[a2][1] + (MK[b2][1] - MK[a2][1]) * u
    if f in track: r0 = track[f][0][2]; track[f] = [(x, y, max(r0, 13.5))] + list(track[f][1:])
print('izlenen', len(track), 'düşük güven kare', sum(1 for f in tr if min(v[3] for v in tr[f]) < 0.45))


def sun(d, cx, cy, r):
    gold, dark, hi = (226, 176, 64), (70, 34, 18), (255, 226, 130)
    for i in range(8):
        a = i * np.pi / 4; x1, y1 = cx + np.cos(a) * r * 1.55, cy + np.sin(a) * r * 1.55
        xa, ya = cx + np.cos(a + 0.35) * r * 0.9, cy + np.sin(a + 0.35) * r * 0.9; xb, yb = cx + np.cos(a - 0.35) * r * 0.9, cy + np.sin(a - 0.35) * r * 0.9
        d.polygon([(x1, y1), (xa, ya), (xb, yb)], fill=gold, outline=dark)
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=gold, outline=dark, width=max(1, int(r * 0.18)))
    d.ellipse([cx - r * 0.45, cy - r * 0.55, cx, cy - r * 0.1], fill=hi)


p = subprocess.Popen([FF, '-y', '-v', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}', '-r', str(FPS), '-i', '-', '-i', SRC,
                      '-map', '0:v', '-map', '1:a?', '-c:v', 'libx264', '-crf', '17', '-pix_fmt', 'yuv420p', '-c:a', 'copy', OUT], stdin=subprocess.PIPE)
for f in range(N):
    im = Image.fromarray(fr[f])
    if f in track:
        lay = Image.new('RGBA', (W * 2, H * 2), (0, 0, 0, 0)); d = ImageDraw.Draw(lay)
        for x, y, r in track[f]: sun(d, x * 2, y * 2, r * 2)
        lay = lay.resize((W, H), Image.LANCZOS).filter(ImageFilter.GaussianBlur(0.4))
        im = im.convert('RGBA'); im.alpha_composite(lay); im = im.convert('RGB')
    p.stdin.write(np.asarray(im).tobytes())
p.stdin.close(); p.wait()
print('kare', N, 'boyanan', len(track))
