"""Kalenin Veo idle döngüsü (13 Eki, Caner): ham/anim/kale_v3_idle.mp4 (beyaz zemin, sabit kamera) -> img/castle_keep_1_idle.webp şeridi.
Veo görseli ~%13 yakınlaştırmış: kale kutusu referansla (~/Downloads/kale_yeni/4_kale_veo_yatay.jpg) eşlenip castle_keep_1 kadrajına oturtulur.
Saydamlık castle_keep_1'in maskesinden (kenarlar titremesin); 12 fps, en temiz kapanan 30 kare (2,5 sn). Yalnız 1. evrede çizilir.
    .venv/bin/python varliklar/kale_idle_isle.py
"""
import glob, json, os, subprocess, tempfile
import numpy as np
from PIL import Image
from ses_kayit_isle import FF

D = os.path.dirname(os.path.abspath(__file__)); IMG = os.path.join(D, '..', 'sinir-kalesi', 'img')
FW = 420; START, N, STEP = 106, 30, 2   # video karesi (24 fps), kare sayısı, adım (12 fps)
tmp = tempfile.mkdtemp()
subprocess.run([FF, '-loglevel', 'error', '-y', '-i', os.path.join(D, 'ham', 'anim', 'kale_v3_idle.mp4'), '-vf', 'fps=24', os.path.join(tmp, 'f_%03d.png')], check=True)
fs = sorted(glob.glob(os.path.join(tmp, 'f_*.png')))
bbox = lambda a: (lambda ys, xs: (xs.min(), xs.max(), ys.min(), ys.max()))(*np.where(a.min(2) < 225))
v = bbox(np.asarray(Image.open(fs[START]).convert('RGB')).astype(int))
r = (427, 851, 73, 647)   # referansın 1280x720'deki kutusu (ölçüldü)
sx, sy = (v[1] - v[0]) / (r[1] - r[0]), (v[3] - v[2]) / (r[3] - r[2])
keep = Image.open(os.path.join(IMG, 'castle_keep_1.webp')); FH = round(FW * keep.height / keep.width)
X0, X1, Y0, Y1 = 1280 / 1920 * 640, 1280 / 1920 * 1280, 72, 648   # castle_keep_1 kadrajı referansta
box = (v[0] + (X0 - r[0]) * sx, v[2] + (Y0 - r[2]) * sy, v[0] + (X1 - r[0]) * sx, v[2] + (Y1 - r[2]) * sy)
frames = [Image.open(fs[START + i * STEP]).convert('RGB').crop(tuple(round(b) for b in box)).resize((FW, FH), Image.LANCZOS) for i in range(N)]
# saydamlık videonun ortalama karesinden (Veo ince sivrileri biraz farklı çizmiş): kenardan beyaz taşma doldurma + kapalı beyaz cepler
from scipy import ndimage
avg = np.mean([np.asarray(f).astype(float) for f in frames], 0); mn, mx = avg.min(2), avg.max(2)
white = (mn > 222) & (mx - mn < 26); lab, n = ndimage.label(white)
edge = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
sz = ndimage.sum(np.ones_like(mn), lab, range(1, n + 1)); pure = ndimage.mean(mn, lab, range(1, n + 1))
bg = np.isin(lab, list(edge) + [i + 1 for i in range(n) if sz[i] >= 8 and pure[i] > 236])
a = ndimage.gaussian_filter((~bg).astype(float), 0.7); a = np.clip((a - 0.25) / 0.5, 0, 1)
soft = (a < 1) & (a > 0); a[soft] *= np.clip((255 - mn[soft]) / 60, 0.3, 1)
alpha = Image.fromarray((a * 255).astype(np.uint8))
# 13 Eki (Caner): kapı kafatasının gözleri yanıp sönmesin, sönük kalsın: gözleri en sönük karedeki hali bütün karelere yumuşak kenarlı yapıştırılır
E = [(0.39, 0.688), (0.505, 0.692)]; R = 0.06 * FW
yy, xx = np.mgrid[:FH, :FW]; m = np.zeros((FH, FW))
for ex, ey in E: m = np.maximum(m, np.clip(1.6 - np.hypot(xx - ex * FW, (yy - ey * FH) * 1.25) / R, 0, 1))
F = [np.asarray(f).astype(float) for f in frames]
dim = F[int(np.argmin([(f.mean(2) * m).sum() for f in F]))]
frames = [Image.fromarray((f * (1 - m[..., None]) + dim * m[..., None]).astype(np.uint8)) for f in F]
strip = Image.new('RGBA', (FW * N, FH))
for i, fr in enumerate(frames): fr.putalpha(alpha); strip.paste(fr, (i * FW, 0))
strip.save(os.path.join(IMG, 'castle_keep_1_idle.webp'), 'WEBP', quality=88, method=6)
an = json.load(open(os.path.join(IMG, 'anim.json'))); an['castle_keep_1_idle'] = {'n': N, 'fw': FW, 'fh': FH, 'fps': 10.8}  # 13 Eki (Caner): ateş %10 yavaş
json.dump(an, open(os.path.join(IMG, 'anim.json'), 'w'), indent=1, ensure_ascii=False)
man = json.load(open(os.path.join(IMG, 'manifest.json')))
if 'castle_keep_1_idle.webp' not in man: man = sorted(man + ['castle_keep_1_idle.webp']); json.dump(man, open(os.path.join(IMG, 'manifest.json'), 'w'), indent=0)
print(type(man).__name__, box, FW, FH, os.path.getsize(os.path.join(IMG, 'castle_keep_1_idle.webp')) // 1024, 'KB')
