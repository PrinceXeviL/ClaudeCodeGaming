"""Lanet Kulesi Veo videoları (16-17 Eki, Caner): her kulede bir video = bekleme döngüsü + lanet saldırısı (beyaz zemin, 1280x720, 24 kare/sn).
Referans 1920x1080 beyaz tuvalde kulenin boyu %45, ortada, +40 px aşağıda yerleştirildi (veo_lanet_kulesi/); video 2/3 ölçekte aynı yerde.
Bu yüzden durağan görselin (tower_altar_<k>) videodaki kutusu tam bilinir ve şerit görselle piksel piksel hizalanır (anim.json box).
  <görsel>_idle: başı ve sonu en benzer döngü (0-120. kareler arasında)
  <görsel>_atk : ışın başlamadan biraz önce başlar, bekleme döngüsünün ilk karesine en çok benzeyen karede biter (dönüş dikişsiz)
Kulenin dışına taşan ışın ve şimşek kesilir (kutu kenarında yumuşak söner): oyun laneti hedefe kendisi çizer. Her kare (Veo akıcılık).
    .venv/bin/python varliklar/lanet_veo_isle.py [1 2 3 rite blight]
"""
import json, os, sys
import numpy as np
from PIL import Image
H0 = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, H0)
import video_isle
IMG = os.path.join(H0, '..', 'sinir-kalesi', 'img')
VIDS = {'1': 'lanet_1_veo.mp4', '2': 'lanet_2_veo.mp4', '3': 'lanet_3_veo.mp4', 'rite': 'lanet_rite_veo.mp4', 'blight': 'lanet_blight_veo.mp4'}
MX, MT, MB, FADE = 0.2, 0.08, 0.02, 14
LOOP = {'2': (56, 118)}  # bekleme döngüsünün aranacağı kareler (2. kademe: baştaki duman bitince)  # kutu payı: yanlarda genişliğin, üstte/altta boyun kesri; FADE: kenarda sönme (px)

def sprite_rect(name, W, H):
    im = Image.open(os.path.join(IMG, name + '.webp')); h = int(1080 * 0.45); w = int(im.width * h / im.height)
    x0, y0 = (1920 - w) // 2, (1080 - h) // 2 + 40; k = W / 1920
    return x0 * k, y0 * k, w * k, h * k

def run(key):
    name = 'tower_altar_' + key
    fr = video_isle.frames_of(os.path.join(H0, 'ham', 'anim', VIDS[key]), 24); H, W = fr[0].shape[:2]
    sx, sy, sw, sh = sprite_rect(name, W, H)
    X0, X1, Y0, Y1 = int(sx - MX * sw), int(sx + sw * (1 + MX)), int(sy - MT * sh), int(sy + sh * (1 + MB))
    X0, Y0, X1, Y1 = max(0, X0), max(0, Y0), min(W, X1), min(H, Y1)
    box = [round((X0 - sx) / sw, 4), round((Y0 - sy) / sh, 4), round((X1 - sx) / sw, 4), round((Y1 - sy) / sh, 4)]
    fade = np.ones((Y1 - Y0, X1 - X0), np.float32)
    for i in range(FADE): k = (i + 1) / (FADE + 1); fade[:, i] *= k; fade[:, -1 - i] *= k; fade[i, :] *= k
    # durağan görselin gövdesi (alfa) videonun kesim kutusuna yerleştirilir: gövde dışındaki soluk beyaz-gri duman (Veo'nun eklediği sis) silinir,
    # renkli ışık (mor/kızıl parlama, ışın) kalır
    from scipy import ndimage as nd
    st = Image.open(os.path.join(IMG, name + '.webp')).convert('RGBA').resize((int(round(sw)), int(round(sh))), Image.LANCZOS)
    body = np.zeros((Y1 - Y0, X1 - X0), bool); bx, by = int(round(sx)) - X0, int(round(sy)) - Y0
    sa = np.asarray(st)[..., 3] > 40; y0b, x0b = max(0, by), max(0, bx); y1b, x1b = min(body.shape[0], by + sa.shape[0]), min(body.shape[1], bx + sa.shape[1])
    body[y0b:y1b, x0b:x1b] = sa[y0b - by:y1b - by, x0b - bx:x1b - bx]; body = nd.binary_dilation(body, iterations=3)
    body_atk = nd.binary_dilation(body, iterations=2)
    def cut(a, atk=False):
        c = video_isle.remove_white_fx(a)[Y0:Y1, X0:X1].astype(np.float32)
        if atk: c[..., 3] = np.where(body_atk, c[..., 3], 0) * fade; return c.clip(0, 255).astype(np.uint8)  # saldırı: gövde dışı (ışın, şimşek, beyaz kenar) silinir
        r, g, b = c[..., 0], c[..., 1], c[..., 2]; mx, mn = np.maximum(np.maximum(r, g), b), np.minimum(np.minimum(r, g), b); sat = (mx - mn) / np.maximum(mx, 1)
        smoke = ~body & (mn > 120) & (sat < 0.3)
        c[..., 3] = np.where(smoke, c[..., 3] * np.clip((sat - 0.12) / 0.18, 0, 1), c[..., 3]) * fade
        return c.clip(0, 255).astype(np.uint8)
    # ışın: kulenin sağında (kutunun dışında) koyu/renkli piksel olan kareler
    beam = [i for i, a in enumerate(fr) if (a[:, X1:].min(2) < 200).sum() > 500 or (a[:, :X0].min(2) < 200).sum() > 500]
    b0, b1 = (beam[0], beam[-1]) if beam else (125, 160)
    sm = lambda a: np.asarray(Image.fromarray(a[Y0:Y1, X0:X1]).resize((60, 120))).astype(np.float32)
    S = [sm(a) for a in fr]
    best = None  # bekleme döngüsü: s..s+L-1, S[s] ile S[s+L] en benzer
    lo, hi = LOOP.get(key, (0, b0 - 16))
    for s in range(lo, min(lo + 50, hi)):
        for L in range(48, 104, 2):
            if s + L > hi: break
            d = np.abs(S[s] - S[s + L]).mean()
            if best is None or d < best[0]: best = (d, s, L)
    _, s, L = best
    A0 = max(s + L, b0 - 14); A1 = min(range(b1 + 8, len(fr)), key=lambda j: np.abs(S[j] - S[s]).mean())
    idle = [cut(fr[i]) for i in range(s, s + L)]; atk = [cut(fr[i], True) for i in range(A0, A1)]
    FW, FH = X1 - X0, Y1 - Y0
    meta_p = os.path.join(IMG, 'anim.json'); meta = json.load(open(meta_p)); man_p = os.path.join(IMG, 'manifest.json'); man = json.load(open(man_p))
    for n2, frames in ((name + '_idle', idle), (name + '_atk', atk)):
        video_isle.save_strip(n2, frames, FW, FH, IMG, meta, man, {'fps': 24, 'tower': True, 'box': box}, keep=False)
    json.dump(meta, open(meta_p, 'w'), indent=1); json.dump(sorted(man), open(man_p, 'w'), indent=0)
    print(key, 'döngü', s, L, 'fark', round(best[0], 2), 'saldırı', A0, A1, 'ışın', b0, b1, 'kutu', box)


# 2. tur (17 Eki): bekleme ve saldırı ayrı videolar (Frames to Video: ilk ve son kare = durağan kule). Işın/duman yok, etki gözde.
#   ham/anim/lanet2_<k>_bekle.mp4  → <görsel>_idle: videonun içinde başı ve sonu en benzer 72-120 karelik döngü
#   ham/anim/lanet2_<k>_saldiri.mp4 → <görsel>_atk: ilk kareden en çok ayrılan bölümün çevresi (başta/sonda durağan kısım atılır)
def run2(key):
    name = 'tower_altar_' + key
    pb, pa = [os.path.join(H0, 'ham', 'anim', 'lanet2_%s_%s.mp4' % (key, t)) for t in ('bekle', 'saldiri')]
    meta_p = os.path.join(IMG, 'anim.json'); meta = json.load(open(meta_p)); man_p = os.path.join(IMG, 'manifest.json'); man = json.load(open(man_p))
    for kind, path in (('idle', pb), ('atk', pa)):
        if not os.path.exists(path): continue
        fr = video_isle.frames_of(path, 24); H, W = fr[0].shape[:2]
        sx, sy, sw, sh = sprite_rect(name, W, H)
        X0, X1, Y0, Y1 = max(0, int(sx - MX * sw)), min(W, int(sx + sw * (1 + MX))), max(0, int(sy - MT * sh)), min(H, int(sy + sh * (1 + MB)))
        box = [round((X0 - sx) / sw, 4), round((Y0 - sy) / sh, 4), round((X1 - sx) / sw, 4), round((Y1 - sy) / sh, 4)]
        fade = np.ones((Y1 - Y0, X1 - X0), np.float32)
        for i in range(FADE): k = (i + 1) / (FADE + 1); fade[:, i] *= k; fade[:, -1 - i] *= k; fade[i, :] *= k
        cut = lambda a: (lambda c: (c.__setitem__((Ellipsis, 3), c[..., 3] * fade), c.clip(0, 255).astype(np.uint8))[1])(video_isle.remove_white_fx(a)[Y0:Y1, X0:X1].astype(np.float32))
        sm = lambda a: np.asarray(Image.fromarray(a[Y0:Y1, X0:X1]).resize((60, 120))).astype(np.float32)
        S = [sm(a) for a in fr]
        if kind == 'idle':
            best = None
            for s0 in range(0, 48):
                for L in range(72, 122, 2):
                    if s0 + L >= len(fr): break
                    d = np.abs(S[s0] - S[s0 + L]).mean()
                    if best is None or d < best[0]: best = (d, s0, L)
            d, s0, L = best; idx = range(s0, s0 + L); info = 'döngü %d+%d fark %.2f' % (s0, L, d); idle0 = S[s0]
        else:
            # başlangıç: ilk kareden ayrılmadan biraz önce; bitiş: hareket söndükten sonra bekleme döngüsünün ilk karesine en çok benzeyen kare
            # (oyun saldırıdan sonra döngüyü 0. kareden başlatır: dikişsiz dönüş)
            dv = [np.abs(S[i] - S[0]).mean() for i in range(len(fr))]; on = [i for i, v in enumerate(dv) if v > 3]
            a0 = max(0, on[0] - 6) if on else 0; peak = max(range(len(fr)), key=lambda i: dv[i])
            ref = locals().get('idle0', S[0]); a1 = min(range(peak + 12, min(len(fr), peak + 90)), key=lambda j: np.abs(S[j] - ref).mean()) + 1
            idx = range(a0, a1); info = 'saldırı %d-%d (tepe %d, dönüş farkı %.1f)' % (a0, a1, peak, np.abs(S[a1 - 1] - ref).mean())
        frames = [cut(fr[i]) for i in idx]
        video_isle.save_strip(name + '_' + kind, frames, X1 - X0, Y1 - Y0, IMG, meta, man, {'fps': 24, 'tower': True, 'box': box}, keep=False)
        print(key, kind, info, 'kare', len(frames), 'kutu', box)
    json.dump(meta, open(meta_p, 'w'), indent=1); json.dump(sorted(man), open(man_p, 'w'), indent=0)

if sys.argv[1:2] == ['2']:
    for k in sys.argv[2:]: run2(k)
else:
    for k in (sys.argv[1:] or [k for k in VIDS if os.path.exists(os.path.join(H0, 'ham', 'anim', VIDS[k]))]): run(k)
