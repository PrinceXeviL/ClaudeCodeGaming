"""Kara Veba Kazanı Veo videosu (16 Eki, Caner): ham/anim/karaveba_cagri_veo.mp4 (1280x720, Frames-to-Video, ilk = son kare).
İki şerit, AYNI kutu ve ölçekle:
  tower_artillery_plague_idle: IDLE_S..IDLE_S+IDLE_L-1 (kaynayan kazan, mor şelaleler, mangallar; en temiz kapanan döngü)
  tower_artillery_plague_call: CALL_S..CALL_E (sürü çağrısı: kafatası çenesini açar, kazan taşar, gözler yanar); sürü kalkınca bir kez oynar
Çağrı sonu karesi bekleme döngüsünün ilk karesine en çok benzeyen kare seçilir (dönüş dikişsiz). Her kare (Veo akıcılık).
Kutu: videonun 1. karesindeki kule gövdesi (alfa > 128) = durağan görselin (tower_artillery_plague) gövde kutusu; ikisi eşlenir.
    .venv/bin/python varliklar/karaveba_veo_isle.py
"""
import json, os, sys
import numpy as np
from PIL import Image
H0 = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, H0)
import video_isle
IMG = os.path.join(H0, '..', 'sinir-kalesi', 'img')
SRC = 'ham/anim/karaveba_cagri_veo.mp4'
TW = 190                     # şeritte kule gövdesinin genişliği (px)
IDLE_S, IDLE_L = 183, 48     # bekleme döngüsü (dikiş farkı en küçük: 2.6, komşu kare ort. 1.8)
CALL_S = 66                  # çağrı başı (çene 76. karede açılmaya başlar)
fr = video_isle.frames_of(os.path.join(H0, SRC), 24)
H, W = fr[0].shape[:2]
def cut(a):
    c = video_isle.remove_magenta(a); al = c[..., 3]
    c[..., 3] = np.where(video_isle.biggest_mask(al), al, 0)
    f = c.astype(np.float32); r, g, b = f[..., 0], f[..., 1], f[..., 2]
    pink = (np.minimum(r, b) - g > 25) & (np.abs(r - b) < 90) & (f[..., 3] < 250)
    f[..., 3] = np.where(pink, f[..., 3] * 0.15, f[..., 3])
    return f.astype(np.uint8)
c0 = cut(fr[0]); ys, xs = np.nonzero(c0[..., 3] > 128); tx0, tx1, ty0, ty1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
sm = lambda f: np.asarray(Image.fromarray(f[ty0:ty1, tx0:tx1]).resize((80, 100))).astype(np.float32)
s0 = sm(fr[IDLE_S]); CALL_E = min(range(134, 182), key=lambda j: np.abs(sm(fr[j]) - s0).mean())
call = [cut(fr[i]) for i in range(CALL_S, CALL_E + 1)]; idle = [cut(fr[i]) for i in range(IDLE_S, IDLE_S + IDLE_L)]
allc = call + idle
X0 = min(np.nonzero(c[..., 3] > 60)[1].min() for c in allc) - 4; X1 = max(np.nonzero(c[..., 3] > 60)[1].max() for c in allc) + 5
Y0 = min(np.nonzero(c[..., 3] > 60)[0].min() for c in allc) - 4; Y1 = max(np.nonzero(c[..., 3] > 60)[0].max() for c in allc) + 3
X0, Y0, X1, Y1 = max(0, X0), max(0, Y0), min(W, X1), min(H, Y1)
k = TW / (tx1 - tx0); FW, FH = int(round((X1 - X0) * k)), int(round((Y1 - Y0) * k))
# durağan görselin gövde kutusu (kesir): şerit kutusu ona göre
st = np.asarray(Image.open(os.path.join(IMG, 'tower_artillery_plague.webp')).convert('RGBA'))[..., 3]
sy_, sx_ = np.nonzero(st > 128); SW, SH = st.shape[1], st.shape[0]
s0x, s1x, s0y, s1y = sx_.min() / SW, (sx_.max() + 1) / SW, sy_.min() / SH, (sy_.max() + 1) / SH
Wt, Ht = tx1 - tx0, ty1 - ty0
fx = lambda v: round(float(s0x + (v - tx0) / Wt * (s1x - s0x)), 4); fy = lambda v: round(float(s0y + (v - ty0) / Ht * (s1y - s0y)), 4)
box = [fx(X0), fy(Y0), fx(X1), fy(Y1)]
meta_p = os.path.join(IMG, 'anim.json'); meta = json.load(open(meta_p)); man_p = os.path.join(IMG, 'manifest.json'); man = json.load(open(man_p))
for name, frames, extra in (('tower_artillery_plague_call', call, {'fps': 24}), ('tower_artillery_plague_idle', idle, {'fps': 24})):
    out, cols = video_isle.pack([Image.fromarray(c[Y0:Y1, X0:X1]).resize((FW, FH), Image.LANCZOS) for c in frames], FW, FH)
    out.save(os.path.join(IMG, name + '.webp'), 'WEBP', quality=86, method=6)
    meta[name] = dict({'n': len(frames), 'fw': FW, 'fh': FH, 'tower': True, 'box': box}, **extra)
    if cols: meta[name]['cols'] = cols
    if name + '.webp' not in man: man.append(name + '.webp')
    print(name, meta[name], os.path.getsize(os.path.join(IMG, name + '.webp')) // 1024, 'KB')
print('çağrı sonu', CALL_E, 'video gövde', (tx0, ty0, tx1, ty1), 'görsel gövde', (round(s0x, 3), round(s0y, 3), round(s1x, 3), round(s1y, 3)))
json.dump(meta, open(meta_p, 'w'), indent=1); json.dump(sorted(man), open(man_p, 'w'), indent=0)
