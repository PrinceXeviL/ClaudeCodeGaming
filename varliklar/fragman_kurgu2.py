"""Fragman v2 kurgusu (22 Eki): tools/fragman-kayit2.js kayıtlarından (3840x2160) yatay 1920x1080 ve dikey 1080x1920, 30 kare/sn.
Giriş (gece, kahve, ordu, "YETER!") → gelişme (kule inşası, üçe bölünmüş ekranda kuleler, dalga, diriltme + zombi ordusu, boss, 4 alan yeteneği art arda)
→ sonuç (boss düşer, iskeletler sevinir, Mortimer kahvesine döner) → kapanış (logo, "yakında", iOS · Android · Steam).
Müzik: giriş ekranının ana müziği (ses/muzik_menu.mp3): baştan, son bölümde parçanın kendi kapanışı. Sesler: kayıt günlüğü + vuruşlar; seslendirme (fragman_ses2.py) hafif yankılı.
    .venv/bin/python3 varliklar/fragman_kurgu2.py <kayıt> <kart> <ifade dizini> <çıkış öneki> tr|en
"""
import json, os, random, subprocess, sys
from multiprocessing import Pool
import numpy as np
import imageio_ffmpeg
from PIL import Image, ImageFilter, ImageEnhance, ImageChops

H0 = os.path.dirname(os.path.abspath(__file__))
SES = os.path.join(H0, '..', 'sinir-kalesi', 'ses'); IMG = os.path.join(H0, '..', 'sinir-kalesi', 'img')
FF = imageio_ffmpeg.get_ffmpeg_exe()
REC, KART, IFD, OUT, LANG = sys.argv[1:6]
FPS, SR = 30, 48000
SIZES = {'yatay': (1920, 1080), 'dikey': (1080, 1920)}

# ---------------- kurgu ----------------
# (tür, süre sn, ayar)  tür: full | split3 | art | end ; ayar: sahne, ilk kare, kart, altyazı, parlama, dikey ('crop' + cx | 'fill')
SHOTS = [
    ('full', 4.0, dict(sc='gece', f0=4, sub=1, v='crop', cx=0.5, letter=True, zoom=1.2, cy=0.44)),
    ('full', 4.6, dict(sc='kahve', f0='KAHVE', v='crop', cx=0.5)),
    ('full', 3.8, dict(sc='ordu', f0=6, v='fill', flash=True)),
    ('art', 1.3, dict(img='ifade_ofkeli', kart=5)),
    ('full', 1.4, dict(sc='insa', f0=0, kart=1, v='crop', cx=0.5, flash=True)),
    ('full', 0.9, dict(sc='insa', f0=58, v='crop', cx=0.5)),
    ('split3', 5.0, dict(scs=['kule_ok', 'kule_veba', 'kule_fener'], f0=4, flash=True)),
    ('full', 2.6, dict(sc='dalga', f0=30, v='fill', flash=True)),
    ('full', 1.8, dict(sc='ucus', f0=24, kart=2, v='crop', cx=0.5, flash=True)),
    ('full', 3.8, dict(sc='zombi', f0=4, v='fill')),
    ('full', 4.0, dict(sc='boss', f0=10, v='fill', flash=True)),
    ('full', 1.0, dict(sc='meteor', f0=44, kart=3, v='fill', flash=True, beat=True)),
    ('full', 1.0, dict(sc='kasirga', f0=24, v='fill', flash=True, beat=True)),
    ('full', 1.0, dict(sc='kangolu', f0=14, v='fill', flash=True, beat=True)),
    ('full', 1.0, dict(sc='okyagmuru', f0=34, v='fill', flash=True, beat=True)),
    ('full', 5.4, dict(sc='final', f0=20, kart=4, v='fill', flash=True)),
    ('full', 2.6, dict(sc='kahve', f0='KAHVE2', v='crop', cx=0.5)),
    ('end', 5.5, dict()),
]
MUS_START = None  # müzik (giriş ekranı parçası) 3,6. sn'de baştan girer: parçanın 9. sn'deki vuruşu "YETER!"e denk gelir
starts, t = [], 0.0
for s in SHOTS: starts.append(t); t += s[1]
DUR = t; NF = int(round(DUR * FPS))
VO_AT = {1: 0.5, 2: starts[1] + 0.1, 3: starts[2] + 0.1, 4: starts[3] + 0.05, 5: starts[6] + 0.2, 6: starts[8] + 0.1, 7: starts[10] + 0.3, 8: starts[11], 9: starts[16] + 0.15, 10: starts[17] + 0.6}
CUT_B = starts[15]  # final sahnesi: müzik kapanış bölümüne geçer
B0 = 176.0 - (DUR - CUT_B)
MUS_START = starts[3] - 9.0  # kapanış bölümü parçanın kendi sonuyla biter
VO_LEN = {i: float(subprocess.run([FF, '-i', os.path.join(H0, 'ham', 'fragman2', 'kirp', f'vo_{LANG}_{i}.wav')], capture_output=True, text=True).stderr.split('Duration: ')[1].split(',')[0].split(':')[2]) for i in range(1, 11)}
KAHVE = int(os.environ.get('KAHVE', 18)); KAHVE2 = int(os.environ.get('KAHVE2', 150))


def png(name):
    p = os.path.join(KART, name + '.png')
    return Image.open(p).convert('RGBA') if os.path.exists(p) else None


def src(sc, i):
    p = os.path.join(REC, sc, f'{i:04d}.jpg')
    if not os.path.exists(p):  # sahne kısa kaldıysa son kare
        n = len([f for f in os.listdir(os.path.join(REC, sc)) if f.endswith('.jpg')]); p = os.path.join(REC, sc, f'{max(0, min(i, n - 1)):04d}.jpg')
    return Image.open(p).convert('RGB')


def grade(im):  # necromancer havası: gölgeler mor-yeşile, kenar kararması
    W, H = im.size
    key = (W, H)
    if key not in VIG:
        y, x = np.mgrid[0:H, 0:W].astype(np.float32); d = np.sqrt(((x - W / 2) / (W / 2)) ** 2 + ((y - H / 2) / (H / 2)) ** 2)
        VIG[key] = Image.fromarray((np.clip(1 - 0.55 * np.clip(d - 0.55, 0, 1) ** 1.4, 0, 1) * 255).astype(np.uint8))
    a = np.asarray(im).astype(np.float32); lum = a.mean(2, keepdims=True) / 255
    a = a * (1 - 0.12 * (1 - lum)) + np.array([18, 6, 26], np.float32) * (1 - lum) * 0.9
    out = Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))
    return ImageChops.multiply(out, Image.merge('RGB', [VIG[key]] * 3))
VIG = {}


def fit_center(im, W, H, cx=0.5, zoom=1.0, cy=0.5):  # kaynaktan hedef oranında kesip ölçekle
    sw, sh = im.size; tr = W / H
    if sw / sh > tr: ch = sh / zoom; cw = ch * tr
    else: cw = sw / zoom; ch = cw / tr
    x0 = min(max(0, cx * sw - cw / 2), sw - cw); y0 = min(max(0, cy * sh - ch / 2), sh - ch)
    return im.resize((W, H), Image.LANCZOS, box=(x0, y0, x0 + cw, y0 + ch))


def fill_v(im, W, H):  # dikey: bulanık büyütülmüş arka plan + ortada geniş kare (biraz yakın)
    bg = fit_center(im, W // 8, H // 8).filter(ImageFilter.GaussianBlur(6)).resize((W, H), Image.BILINEAR)
    bg = ImageEnhance.Brightness(bg).enhance(0.45)
    fw = W; fh = W; fr = fit_center(im, fw, fh, 0.5, 1.0)
    bg.paste(fr, (0, (H - fh) // 2 - 60)); return bg


def paste_c(base, im, cx, cy, scale=1.0, alpha=1.0):
    if im is None: return
    if scale != 1.0: im = im.resize((max(1, int(im.width * scale)), max(1, int(im.height * scale))), Image.LANCZOS)
    if alpha < 1.0: im = im.copy(); im.putalpha(im.split()[3].point(lambda v: int(v * max(0, alpha))))
    base.alpha_composite(im, (int(cx - im.width / 2), int(cy - im.height / 2)))


def sub_alpha(si, gt):
    t0 = VO_AT[si]; return 0 if gt < t0 - 0.05 else min(1, (gt - t0 + 0.05) / 0.15)


LOGO = None; BADGES = None; END_BG = None; ART = {}


def render(fi):
    global LOGO, BADGES, END_BG
    gt = fi / FPS; k = max(i for i, s in enumerate(starts) if s <= gt + 1e-6); kind, dur, o = SHOTS[k]; lt = gt - starts[k]; j = int(round(lt * FPS))
    res = {}
    for orient, (W, H) in SIZES.items():
        V = orient == 'dikey'; sc_ui = (W / 1920) if not V else 1.0
        if kind == 'full':
            f0 = o['f0']; f0 = KAHVE if f0 == 'KAHVE' else KAHVE2 if f0 == 'KAHVE2' else f0
            im = src(o['sc'], f0 + j)
            fr = (fill_v(im, W, H) if o.get('v') == 'fill' else fit_center(im, W, H, o.get('cx', 0.5), o.get('zoom', 1.0), o.get('cy', 0.5))) if V else (fit_center(im, W, H, 0.5, o['zoom'], o.get('cy', 0.5)) if o.get('zoom') else im.resize((W, H), Image.LANCZOS))
            fr = grade(fr).convert('RGBA')
        elif kind == 'split3':
            fr = Image.new('RGBA', (W, H), (12, 4, 10, 255)); n = 3
            for q, sc in enumerate(o['scs']):
                im = src(sc, o['f0'] + j)
                if V: pw, ph = W, (H - 2 * 10) // 3; x, y = 0, q * (ph + 10)
                else: pw, ph = (W - 2 * 10) // 3, H; x, y = q * (pw + 10), 0
                p = grade(fit_center(im, pw, ph, 0.5, 1.15)).convert('RGBA')
                if j >= q * 3: fr.alpha_composite(p, (x, y))  # paneller sırayla belirir
            line = (201, 168, 101, 255)
            for q in (1, 2):
                if V: fr.paste(line[:3], (0, q * ((H - 20) // 3) + (q - 1) * 10, W, q * ((H - 20) // 3) + q * 10))
                else: fr.paste(line[:3], (q * ((W - 20) // 3) + (q - 1) * 10, 0, q * ((W - 20) // 3) + q * 10, H))
        elif kind == 'art':
            bg = src('gece', 100).resize((W // 6, H // 6)).filter(ImageFilter.GaussianBlur(3)).resize((W, H)); bg = ImageEnhance.Brightness(bg).enhance(0.3).convert('RGBA')
            red = Image.new('RGBA', (W, H), (150, 0, 0, int(110 * max(0, 1 - lt / 0.5)))); bg.alpha_composite(red)
            a = ART.get(o['img']) or ART.setdefault(o['img'], Image.open(os.path.join(IFD, o['img'] + '.png')).convert('RGBA'))
            s = (H * (0.62 if not V else 0.36) / a.height) * (1.18 - 0.18 * min(1, lt / 0.12))
            sh = int(10 * max(0, 1 - lt / 0.4) * (1 if j % 2 else -1))
            paste_c(bg, a, W / 2 + sh, H * (0.43 if not V else 0.40), s)
            fr = bg
        else:  # son kart
            if END_BG is None:
                END_BG = src('gece', 110)
            bg = END_BG.resize((W // 4, H // 4)).filter(ImageFilter.GaussianBlur(4)).resize((W, H), Image.BILINEAR) if not V else fit_center(END_BG, W // 4, H // 4).filter(ImageFilter.GaussianBlur(4)).resize((W, H), Image.BILINEAR)
            fr = grade(ImageEnhance.Brightness(bg).enhance(0.5)).convert('RGBA')
            if LOGO is None:
                L = Image.open(os.path.join(IMG, 'ui_logo_title.webp')).convert('RGBA'); L = L.crop((0, 0, L.width, int(L.height * 0.5))); LOGO = L.crop(L.getbbox())
                BADGES = [png('rozet_' + n) for n in ('apple', 'android', 'steam')]
            mk = ART.get('ifade_kibirli') or ART.setdefault('ifade_kibirli', Image.open(os.path.join(IFD, 'ifade_kibirli.png')).convert('RGBA'))
            km = min(1, lt / 0.5)
            if not V: paste_c(fr, mk, W * 0.5, H * 0.23 + (1 - km) * 60, H * 0.36 / mk.height, km)
            else: paste_c(fr, mk, W * 0.5, H * 0.2 + (1 - km) * 60, H * 0.2 / mk.height, km)
            lk = min(1, lt / 0.35); ls = (0.7 + 0.3 * (1 - (1 - lk) ** 3)) * (1 + 0.015 * lt) * ((W * 0.62) if not V else W * 0.92) / LOGO.width
            paste_c(fr, LOGO, W / 2, H * (0.52 if not V else 0.42), ls, lk)
            soon = png(f'{LANG}_yakinda')
            if lt > 1.1: paste_c(fr, soon, W / 2, H * (0.71 if not V else 0.57), 1.0, min(1, (lt - 1.1) / 0.3))
            if lt > 1.5:
                bw = [b.width for b in BADGES]; gap = 26
                if not V:
                    x = W / 2 - (sum(bw) + gap * 2) / 2
                    for q, b in enumerate(BADGES):
                        a = min(1, (lt - 1.5 - q * 0.15) / 0.25)
                        if a > 0: paste_c(fr, b, x + b.width / 2, H * 0.83 + (1 - a) * 20, 1.0, a)
                        x += b.width + gap
                else:
                    for q, b in enumerate(BADGES):
                        a = min(1, (lt - 1.5 - q * 0.15) / 0.25)
                        if a > 0: paste_c(fr, b, W / 2, H * (0.66 + q * 0.075) + (1 - a) * 20, 1.0, a)
        # parlama, kart, altyazı, sinema şeridi
        if o.get('flash') and j < 5: fr = Image.blend(fr, Image.new('RGBA', fr.size, (255, 255, 255, 255)), (1 - j / 5) * (0.5 if not o.get('beat') else 0.35))
        if o.get('kart'):
            K = png(f'{LANG}_kart{o["kart"]}')
            if K is not None and lt < 1.7 + (0 if kind != 'art' else 9):
                sk = (1.22 - 0.22 * min(1, lt / 0.16)) * (1.0 if not V else min(1.0, (W * 0.94) / K.width)); a = min(1, lt / 0.1) * (1 if kind == 'art' or lt < 1.4 else (1.7 - lt) / 0.3)
                paste_c(fr, K, W / 2, H * (0.42 if not V else 0.2) if kind != 'art' else H * (0.82 if not V else 0.75), sk, a)
        act = [si for si, t0 in VO_AT.items() if t0 - 0.05 <= gt <= t0 + VO_LEN.get(si, 2) + 0.35]
        for si in act[-1:]:
            t0 = VO_AT[si]
            if True:
                S = png(f'{LANG}_alt{si}'); a = min(sub_alpha(si, gt), (t0 + VO_LEN.get(si, 2) + 0.35 - gt) / 0.15)
                if S is not None: paste_c(fr, S, W / 2, H - ((70 if kind == 'end' else 80) if not V else (200 if kind == 'end' else 330)), min(1.0, (W * 0.94) / S.width), min(1, a))
        if o.get('letter'):
            bh = int(H * 0.11 * (1 - max(0, (lt - 3.2) / 0.8))) if not V else 0
            if bh > 0: fr.paste((0, 0, 0), (0, 0, W, bh)); fr.paste((0, 0, 0), (0, H - bh, W, H))
        if fi < 12: fr = Image.blend(Image.new('RGBA', fr.size, (0, 0, 0, 255)), fr, fi / 12)  # siyahtan açılış
        if fi > NF - 10: fr = Image.blend(Image.new('RGBA', fr.size, (0, 0, 0, 255)), fr, (NF - fi) / 10)
        p = os.path.join(OUT + f'_{orient}_kareler', f'{fi:04d}.jpg'); fr.convert('RGB').save(p, quality=92); res[orient] = p
    return fi


def load_audio(p, filt=None):
    cmd = [FF, '-v', 'error', '-i', p] + (['-af', filt] if filt else []) + ['-f', 'f32le', '-ac', '2', '-ar', str(SR), '-']
    return np.frombuffer(subprocess.run(cmd, capture_output=True).stdout, np.float32).reshape(-1, 2).copy()


def build_audio():
    random.seed(11)
    mix = np.zeros((int(DUR * SR) + SR, 2), np.float32)
    def add(a, t, g=1.0, pan=0.0):
        i = int(t * SR)
        if i < 0: a = a[-i:]; i = 0
        a = a[: max(0, len(mix) - i)]
        if not len(a): return
        if pan: a = a * np.array([1 - max(0, pan), 1 + min(0, pan)], np.float32)
        mix[i:i + len(a)] += a * g
    cache = {}
    def wav(kind):
        if kind not in cache:
            fs = sorted(f for f in os.listdir(SES) if f.startswith(kind + '_') and f[len(kind) + 1:-4].isdigit() and f.endswith('.wav'))
            cache[kind] = [load_audio(os.path.join(SES, f)) for f in fs]
        return cache[kind]
    # müzik: menü parçası baştan; final sahnesinde parçanın kapanış bölümüne (B0) 0,6 sn çapraz geçiş
    mus = load_audio(os.path.join(SES, 'muzik_menu.mp3'))
    A = mus[: int((CUT_B - MUS_START + 0.6) * SR)].copy(); B = mus[int((B0 - 0.6) * SR): int((B0 + DUR - CUT_B) * SR)].copy()
    fa = np.ones(len(A), np.float32); fa[-int(0.6 * SR):] = np.linspace(1, 0, int(0.6 * SR)); A *= fa[:, None]
    fb = np.ones(len(B), np.float32); fb[: int(0.6 * SR)] = np.linspace(0, 1, int(0.6 * SR)); B *= fb[:, None]
    ia = np.ones(len(A), np.float32); ia[: int(0.8 * SR)] = np.linspace(0, 1, int(0.8 * SR)); A *= ia[:, None]
    add(A, MUS_START, 0.62); add(B, CUT_B - 0.6, 0.62)
    if wav('rain'): r = random.choice(wav('rain')); add(np.tile(r, (int(5 * SR / len(r)) + 1, 1))[: int(4.5 * SR)], 0, 0.35)
    # oyun sesleri: kayıt günlüğünden (tür başına aralık + aynı anda en çok)
    for k, (kind, dur, o) in enumerate(SHOTS):
        scs = o.get('scs') or ([o['sc']] if o.get('sc') else [])
        for sc in scs:
            f0 = o['f0']; f0 = KAHVE if f0 == 'KAHVE' else KAHVE2 if f0 == 'KAHVE2' else f0
            log = json.load(open(os.path.join(REC, sc, 'ses.json')))['log']; last, live = {}, {}
            for t, kd, volK, rate, vol, gap, mx, pan in log:
                lt = t - f0 / FPS
                if lt < 0 or lt >= dur: continue
                if t - last.get(kd, -9) < max(gap, 0.06): continue
                live[kd] = [x for x in live.get(kd, []) if x > t]
                if len(live[kd]) >= mx: continue
                L = wav(kd)
                if not L: continue
                a = random.choice(L); last[kd] = t; live[kd].append(t + len(a) / SR)
                g = vol * volK * (0.3 if kd.startswith(('step_', 'el_step')) else 1.0) * (0.6 if len(scs) > 1 else 1.0)
                add(a, starts[k] + lt, min(1.2, g) * 0.85, pan * 0.6)
    def first(*kinds):
        for kd in kinds:
            if wav(kd): return kd
    hits = [(first('el_legion', 'legion'), starts[2], 0.8), (first('el_bash', 'bash'), starts[3], 1.0), (first('bonecrash'), starts[3] + 0.02, 0.7),
            (first('el_raise', 'bossraise'), starts[8] + 0.2, 0.8), (first('el_roar', 'roar'), starts[10] + 0.1, 0.8), (first('el_zboom', 'zboom', 'el_bash'), starts[17], 1.0)]
    for q in range(11, 15): hits.append((first('el_whoosh', 'whoosh', 'el_swing'), starts[q] - 0.08, 0.5))
    for kd, t, g in hits:
        if kd: add(random.choice(wav(kd)), t, g)
    # seslendirme: hafif yankı (necromancer), konuşurken müzik kısılır
    vo = np.zeros_like(mix)
    for i, t in VO_AT.items():
        a = load_audio(os.path.join(H0, 'ham', 'fragman2', 'kirp', f'vo_{LANG}_{i}.wav'), 'aecho=0.8:0.6:55|110:0.22|0.12,highpass=f=70')
        jx = int(t * SR); a = a[: len(vo) - jx]; vo[jx:jx + len(a)] += a * 1.35
    env = (np.abs(vo).max(1) > 0.015).astype(np.float32); w = int(0.3 * SR)
    duck = np.convolve(env, np.ones(w) / w, 'same')
    mix = mix * (1 - 0.5 * np.clip(duck * 1.5, 0, 1))[:, None] + vo
    mix = mix[: int(DUR * SR)]
    fade = np.ones(len(mix), np.float32); fade[-int(0.35 * SR):] = np.linspace(1, 0, int(0.35 * SR)); mix *= fade[:, None]
    pk = np.abs(mix).max(); mix = np.tanh(mix / max(1e-6, pk) * 1.7) * 0.9
    p = OUT + '_ses.f32'; mix.astype(np.float32).tofile(p); return p


if __name__ == '__main__':
    for o in SIZES: os.makedirs(OUT + f'_{o}_kareler', exist_ok=True)
    print('süre', DUR, 'kare', NF)
    with Pool(6) as P:
        for n, _ in enumerate(P.imap_unordered(render, range(NF), chunksize=8)):
            if n % 200 == 0: print('kare', n, flush=True)
    ap = build_audio()
    for o in SIZES:
        mp4 = f'{OUT}_{o}.mp4'
        subprocess.run([FF, '-y', '-v', 'error', '-framerate', str(FPS), '-i', os.path.join(OUT + f'_{o}_kareler', '%04d.jpg'), '-f', 'f32le', '-ar', str(SR), '-ac', '2', '-i', ap,
                        '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '21', '-preset', 'medium', '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', mp4], check=True)
        print(mp4, os.path.getsize(mp4) // 1024, 'KB')
