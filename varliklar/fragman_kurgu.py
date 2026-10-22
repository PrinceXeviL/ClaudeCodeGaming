"""Fragman kurgusu (22 Eki): sinir-kalesi/tools/fragman-kayit.js karelerinden 30 sn'lik fragman (1920x1080, 30 kare/sn).
Görüntü: sahneler arka arkaya (sert kesme + vuruşlarda kısa beyaz parlama), büyük başlık kartları, altyazı, son kart (logo).
Ses: müzik (muzik_boss), oyunun kayıt sırasında çaldığı sesler (ses.json → ses/<tür>_N.wav), Mortimer seslendirmesi (fragman_ses.py).
    .venv/bin/python3 varliklar/fragman_kurgu.py <kayıt dizini> <kart dizini> <çıkış.mp4> tr|en
"""
import json, os, random, subprocess, sys
import numpy as np
import imageio_ffmpeg
from PIL import Image, ImageFilter, ImageEnhance

H0 = os.path.dirname(os.path.abspath(__file__))
SES = os.path.join(H0, '..', 'sinir-kalesi', 'ses')
IMG = os.path.join(H0, '..', 'sinir-kalesi', 'img')
FF = imageio_ffmpeg.get_ffmpeg_exe()
REC, KART, OUT, LANG = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4]
FPS, W, H, SR = 30, 1920, 1080, 48000
random.seed(7)

# (sahne, ilk kare, kare sayısı, kart no, altyazı/ses no, parlama)
CUTS = [
    ('balkon', 0, 114, None, 1, False),
    ('ordu', 16, 84, None, 2, True),
    ('buyu', 100, 72, None, None, False),
    ('kuleler', 30, 150, 1, 3, True),
    ('ucus', 15, 72, 2, 4, True),
    ('dirilt', 6, 90, None, None, False),
    ('meteor', 0, 90, 3, None, True),
    ('boss', 20, 108, 4, 5, True),
]
END_N = 120  # son kart (4 sn)
VO_AT = {1: 0.35, 2: 4.15, 3: 9.25, 4: 14.4, 5: 23.6, 6: 26.9}  # seslendirme başlangıcı (sn)


def load_audio(p):
    b = subprocess.run([FF, '-v', 'error', '-i', p, '-f', 'f32le', '-ac', '2', '-ar', str(SR), '-'], capture_output=True).stdout
    return np.frombuffer(b, np.float32).reshape(-1, 2).copy()


def png(name):
    p = os.path.join(KART, f'{LANG}_{name}.png')
    return Image.open(p).convert('RGBA') if os.path.exists(p) else None


def paste_center(base, im, cy, scale=1.0, alpha=1.0):
    if scale != 1.0: im = im.resize((max(1, int(im.width * scale)), max(1, int(im.height * scale))), Image.LANCZOS)
    if alpha < 1.0: a = im.split()[3].point(lambda v: int(v * alpha)); im = im.copy(); im.putalpha(a)
    base.alpha_composite(im, ((W - im.width) // 2, int(cy - im.height / 2)))


# ---------------- görüntü ----------------
frames_dir = OUT + '_kareler'; os.makedirs(frames_dir, exist_ok=True)
timeline, n = [], 0  # her kesmenin çıkıştaki başlangıç karesi
logo = Image.open(os.path.join(IMG, 'ui_logo_title.webp')).convert('RGBA'); logo = logo.crop(logo.getbbox()).crop((0, 0, logo.width, int(logo.height * 0.5)))
logo = logo.crop(logo.getbbox())
for ci, (sc, f0, cnt, kart, sub, flash) in enumerate(CUTS):
    timeline.append((n, sc, f0, cnt))
    K = png(f'kart{kart}') if kart else None
    S = png(f'alt{sub}') if sub else None
    for j in range(cnt):
        im = Image.open(os.path.join(REC, sc, f'{f0 + j:04d}.jpg')).convert('RGBA')
        if flash and j < 5: im = Image.blend(im, Image.new('RGBA', im.size, (255, 255, 255, 255)), (1 - j / 5) * 0.55)
        if K and j < 54:  # başlık kartı: büyüyerek gelir, durur, söner
            t = j / FPS; sc_k = 1.25 - 0.25 * min(1, t / 0.18); a = min(1, t / 0.12) * (1 if j < 44 else (54 - j) / 10)
            paste_center(im, K, H * 0.42, sc_k, a)
        if S:
            t0 = VO_AT[sub] - n / FPS; t = j / FPS
            if t >= t0 - 0.05: paste_center(im, S, H - 90, 1.0, min(1, (t - t0 + 0.05) / 0.15))
        im.convert('RGB').save(os.path.join(frames_dir, f'{n:04d}.jpg'), quality=94); n += 1
# son kart: balkon karesi kararır ve bulanıklaşır, logo büyüyerek gelir, "yakında" yazısı
bg0 = Image.open(os.path.join(REC, 'balkon', '0060.jpg')).convert('RGB')
bg = ImageEnhance.Brightness(bg0.filter(ImageFilter.GaussianBlur(6))).enhance(0.42).convert('RGBA')
soon = png('yakinda'); sub6 = png('alt6')
end0 = n
for j in range(END_N):
    t = j / FPS; im = bg.copy()
    if j < 6: im = Image.blend(im, Image.new('RGBA', im.size, (255, 255, 255, 255)), (1 - j / 6) * 0.8)
    k = min(1, t / 0.35); s = (0.62 + 0.38 * (1 - (1 - k) ** 3)) * (1 + 0.02 * t) * 1050 / logo.width
    paste_center(im, logo, H * 0.4, s, min(1, t / 0.2))
    if soon and t > 1.0: paste_center(im, soon, H * 0.74, 1.0, min(1, (t - 1.0) / 0.3))
    if sub6 and t > VO_AT[6] - end0 / FPS: paste_center(im, sub6, H - 90, 1.0, min(1, (t - (VO_AT[6] - end0 / FPS)) / 0.15))
    im.convert('RGB').save(os.path.join(frames_dir, f'{n:04d}.jpg'), quality=94); n += 1
DUR = n / FPS
print('kare', n, 'süre', DUR)

# ---------------- ses ----------------
mix = np.zeros((int(DUR * SR) + SR, 2), np.float32)
def add(a, t, g=1.0, pan=0.0):
    i = int(t * SR); a = a[: max(0, len(mix) - i)]
    if not len(a): return
    if pan: a = a * np.array([1 - max(0, pan), 1 + min(0, pan)], np.float32)
    mix[i:i + len(a)] += a * g
cache = {}
def wav(kind):
    if kind not in cache:
        fs = sorted(f for f in os.listdir(SES) if f.startswith(kind + '_') and f[len(kind) + 1:-4].isdigit() and f.endswith('.wav'))
        cache[kind] = [load_audio(os.path.join(SES, f)) for f in fs]
    return cache[kind]
# müzik: giriş sessiz (yağmur + kahve), 3,8 sn'de muzik_boss'un yükselen yerinden girer; son kartta parçanın kendi kesiği
mus = load_audio(os.path.join(SES, 'muzik_boss.mp3'))
M0 = 48.2; seg = mus[int(M0 * SR): int((M0 + DUR) * SR)].copy()
env = np.clip((np.arange(len(seg)) / SR - 3.0) / 0.8, 0, 1).astype(np.float32)
env *= np.clip((DUR - np.arange(len(seg)) / SR) / 0.8, 0, 1).astype(np.float32)
add(seg * env[:, None], 0, 0.55)
rain = wav('rain') if wav('rain') else []
# oyun sesleri: kayıt günlüğünden, tür başına aralık ve aynı anda en çok sayı (oyundaki SOUND ayarları)
STEP = ('step_', 'el_step')
for (o, sc, f0, cnt) in timeline:
    log = json.load(open(os.path.join(REC, sc, 'ses.json')))['log']
    last, live = {}, {}
    for t, kind, volK, rate, vol, gap, mx, pan in log:
        lt = t - f0 / FPS
        if lt < 0 or lt >= cnt / FPS: continue
        if t - last.get(kind, -9) < max(gap, 0.05): continue
        live[kind] = [x for x in live.get(kind, []) if x > t]
        if len(live[kind]) >= mx: continue
        L = wav(kind)
        if not L: continue
        a = random.choice(L); last[kind] = t; live[kind].append(t + len(a) / SR)
        g = vol * volK * (0.35 if kind.startswith(STEP) else 1.0)
        add(a, o / FPS + lt, min(1.2, g) * 0.9, pan * 0.6)
# elle eklenen vuruşlar: büyüde asa darbesi, uçuşta ruh sesi, son kartta gümbürtü
def first(*kinds):
    for k in kinds:
        if wav(k): return k
for kind, t, g in [(first('bonecrash', 'bash'), 8.45, 0.9), (first('el_bonewall', 'bonewall'), 8.47, 0.6), (first('el_raise', 'raise', 'bossraise'), 14.1, 0.8), (first('el_zboom', 'zboom', 'boom'), end0 / FPS, 1.0),
                   (first('el_legion', 'legion'), 4.0, 0.7), (first('el_portal', 'portal', 'roar'), 22.6, 0.7)]:
    if kind: add(random.choice(wav(kind)), t, g)
# seslendirme (öne): müzik konuşurken kısılır
vo = np.zeros_like(mix)
for i, t in VO_AT.items():
    a = load_audio(os.path.join(H0, 'ham', 'fragman', f'vo_{LANG}_{i}.mp3')); j = int(t * SR); a = a[: len(vo) - j]; vo[j:j + len(a)] += a * 1.25
duck = np.convolve((np.abs(vo).max(1) > 0.02).astype(np.float32), np.ones(int(0.25 * SR)) / int(0.25 * SR), 'same')
mix = mix * (1 - 0.45 * np.clip(duck, 0, 1))[:, None] + vo
mix = mix[: int(DUR * SR)]
pk = np.abs(mix).max(); mix = np.tanh(mix / max(1e-6, pk) * 1.6) * 0.89  # yumuşak sınırlayıcı
wav_p = OUT + '_ses.f32'; mix.astype(np.float32).tofile(wav_p)
subprocess.run([FF, '-y', '-v', 'error', '-framerate', str(FPS), '-i', os.path.join(frames_dir, '%04d.jpg'), '-f', 'f32le', '-ar', str(SR), '-ac', '2', '-i', wav_p,
                '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '21', '-preset', 'medium', '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', OUT], check=True)
print(OUT, os.path.getsize(OUT) // 1024, 'KB')
