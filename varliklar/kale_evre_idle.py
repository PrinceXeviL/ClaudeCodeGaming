"""Hasarlı kale evrelerinin Veo idle döngüleri (13 Eki, Caner): beyaz zeminli video -> img/castle_keep_<N>_idle.webp şeridi.
1. evrenin döngüsü kale_idle_isle.py ile yapıldı; bu betik genel: video ile o evrenin durağan görselini (castle_keep_N) hizalar.
Hizalama: durağan görsel videoda kaba kuvvetle aranır (ölçek + konum, maskeli ortalama fark); saydamlık videonun ortalama karesinden
(beyaz taşma doldurma), kapı kafatasının gözleri en sönük karedeki haliyle sabit; 12 fps, en temiz kapanan 24-36 kare.
    .venv/bin/python varliklar/kale_evre_idle.py ham/anim/kale_v3_idle_orta.mp4 2
"""
import glob, json, os, subprocess, sys, tempfile
import numpy as np
from PIL import Image
from scipy import ndimage
from ses_kayit_isle import FF

D = os.path.dirname(os.path.abspath(__file__)); IMG = os.path.join(D, '..', 'sinir-kalesi', 'img')
VID, N_ST = os.path.join(D, sys.argv[1]), int(sys.argv[2]); OUT = f'castle_keep_{N_ST}_idle'
FW, FPS = 420, 10.8
tmp = tempfile.mkdtemp()
subprocess.run([FF, '-loglevel', 'error', '-y', '-i', VID, '-vf', 'fps=12', os.path.join(tmp, 'f_%03d.png')], check=True)
fs = sorted(glob.glob(os.path.join(tmp, 'f_*.png')))
small = [np.asarray(Image.open(f).convert('L').resize((320, 180))).astype(np.float32) for f in fs]
best = min((np.abs(small[s] - small[s + L]).mean(), L, s) for L in range(24, 37) for s in range(0, len(fs) - L))
_, NF, START = best
print('döngü', NF, 'kare, başlangıç', START, 'fark', round(float(best[0]), 2))

# hizalama: durağan evre görseli videonun karesinde (1280x720) nerede, hangi ölçekte
V = np.asarray(Image.open(fs[START]).convert('RGB')).astype(float)
keep = Image.open(os.path.join(IMG, f'castle_keep_{N_ST}.webp')).convert('RGBA'); kw, kh = keep.size
def score(s, x0, y0, step=3):
    w, h = round(kw * s), round(kh * s); t = np.asarray(keep.resize((w, h), Image.BILINEAR)).astype(float)
    ys, xs = np.where(t[..., 3] > 200); sel = (ys % step == 0) & (xs % step == 0); ys, xs = ys[sel], xs[sel]
    X, Y = xs + x0, ys + y0; ok = (X >= 0) & (X < V.shape[1]) & (Y >= 0) & (Y < V.shape[0])
    return np.abs(V[Y[ok], X[ok]] - t[ys[ok], xs[ok], :3]).mean() if ok.mean() > 0.97 else 1e9
m = V.min(2) < 225; ys, xs = np.where(m); s0 = (ys.max() - ys.min()) / kh  # boydan (yanlara uçan kıvılcımlar genişliği şaşırtır)
bestA = (1e9,)
for s in np.arange(s0 - 0.05, s0 + 0.05, 0.0025):
    w, h = kw * s, kh * s; cx, cy = float(np.median(xs)) - w / 2, (ys.min() + ys.max()) / 2 - h / 2
    for dx in range(-30, 31, 3):
        for dy in range(-30, 31, 3):
            e = score(s, int(cx + dx), int(cy + dy))
            if e < bestA[0]: bestA = (e, s, int(cx + dx), int(cy + dy))
e, s, x0, y0 = bestA
for s2 in np.arange(s - 0.003, s + 0.0031, 0.001):
    for X0 in range(x0 - 3, x0 + 4):
        for Y0 in range(y0 - 3, y0 + 4):
            e2 = score(s2, X0, Y0, 2)
            if e2 < bestA[0]: bestA = (e2, s2, X0, Y0)
e, s, x0, y0 = bestA; print('hizalama fark', round(float(e), 1), 'ölçek', round(float(s), 4), 'konum', x0, y0)
box = (x0, y0, x0 + kw * s, y0 + kh * s); FH = round(FW * kh / kw)

frames = [Image.open(fs[START + i]).convert('RGB').crop(tuple(round(b) for b in box)).resize((FW, FH), Image.LANCZOS) for i in range(NF)]
avg = np.mean([np.asarray(f).astype(float) for f in frames], 0); mn, mx = avg.min(2), avg.max(2)
white = (mn > 222) & (mx - mn < 26); lab, n = ndimage.label(white)
edge = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
sz = ndimage.sum(np.ones_like(mn), lab, range(1, n + 1)); pure = ndimage.mean(mn, lab, range(1, n + 1))
bg = np.isin(lab, list(edge) + [i + 1 for i in range(n) if sz[i] >= 8 and pure[i] > 236])
a = ndimage.gaussian_filter((~bg).astype(float), 0.7); a = np.clip((a - 0.25) / 0.5, 0, 1)
soft = (a < 1) & (a > 0); a[soft] *= np.clip((255 - mn[soft]) / 60, 0.3, 1)
alpha = Image.fromarray((a * 255).astype(np.uint8))
# kapı kafatasının gözleri sönük (Caner)
E = [(0.39, 0.688), (0.505, 0.692)]; R = 0.06 * FW
yy, xx = np.mgrid[:FH, :FW]; mk = np.zeros((FH, FW))
for ex, ey in E: mk = np.maximum(mk, np.clip(1.6 - np.hypot(xx - ex * FW, (yy - ey * FH) * 1.25) / R, 0, 1))
F = [np.asarray(f).astype(float) for f in frames]
dim = F[int(np.argmin([(f.mean(2) * mk).sum() for f in F]))]
# --agac: Veo bahçe ağaçlarını bazı karelerde beyaza boyamış; alt köşelerdeki ağaçlar durağan çizimden (renk ve saydamlık), yumuşak geçişle
if '--agac' in sys.argv:
    st = np.asarray(keep.resize((FW, FH), Image.LANCZOS)).astype(float); tm = np.zeros((FH, FW))
    for x0, y0, x1, y1 in [(0, 0.5, 0.2, 1), (0.8, 0.5, 1, 1)]:
        tm[int(y0 * FH):int(y1 * FH), int(x0 * FW):int(x1 * FW)] = 1
    tm = ndimage.gaussian_filter(tm, 8)
    F = [f * (1 - tm[..., None]) + st[..., :3] * tm[..., None] for f in F]
    alpha = Image.fromarray((np.asarray(alpha).astype(float) * (1 - tm) + st[..., 3] * tm).astype(np.uint8))
strip = Image.new('RGBA', (FW * NF, FH))
for i, f in enumerate(F):
    fr = Image.fromarray((f * (1 - mk[..., None]) + dim * mk[..., None]).astype(np.uint8)); fr.putalpha(alpha); strip.paste(fr, (i * FW, 0))
strip.save(os.path.join(IMG, OUT + '.webp'), 'WEBP', quality=88, method=6)
an = json.load(open(os.path.join(IMG, 'anim.json'))); an[OUT] = {'n': NF, 'fw': FW, 'fh': FH, 'fps': FPS}
json.dump(an, open(os.path.join(IMG, 'anim.json'), 'w'), indent=1, ensure_ascii=False)
man = json.load(open(os.path.join(IMG, 'manifest.json')))
if OUT + '.webp' not in man: json.dump(sorted(man + [OUT + '.webp']), open(os.path.join(IMG, 'manifest.json'), 'w'), indent=0)
print(OUT, NF, 'kare', os.path.getsize(os.path.join(IMG, OUT + '.webp')) // 1024, 'KB')
