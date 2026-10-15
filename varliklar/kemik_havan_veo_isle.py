"""Kemik Havan Kazanı Veo videosu (16 Eki, Caner: "bu olmuş, hem idle hem atış"): ham/anim/kemik_havan_atis_veo2.mp4
(WhatsApp'tan 1024x576; tam çözünürlük gelirse SRC değişir, kutular otomatik). İki şerit, AYNI kutu ve ölçekle:
  tower_artillery_bonemortar_atk : 0..FIRE_END (havan geri teper, yeşil duman patlar, gülle 18. karede ağızdan çıkar)
  tower_artillery_bonemortar_idle: IDLE_S..IDLE_S+IDLE_L-1 (köpüren sıvı, alevler; en temiz kapanan döngü)
Atış sonu karesi bekleme döngüsünün başına en çok benzeyen kare seçilir (geçiş dikişsiz). Her kare (Veo akıcılık).
Kopuk parçalar (dumandan ayrılan gülle, Veo zemin kırıntıları) biggest_mask ile, duman dağılırkenki pembe yarı saydam izler alfa ile gider.
    .venv/bin/python varliklar/kemik_havan_veo_isle.py
"""
import json, os, sys
import numpy as np
from PIL import Image
H0 = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, H0)
import video_isle
IMG = os.path.join(H0, '..', 'sinir-kalesi', 'img')
SRC = 'ham/anim/kemik_havan_atis_veo_hq.mp4'   # 16 Eki: tam çözünürlük (belge olarak gönderildi)
TW = 190                     # şeritte kulenin genişliği (px)
REL = 18                     # gülle ağızdan çıkar
IDLE_S, IDLE_L = 143, 64     # bekleme döngüsü (dikiş farkı en küçük)
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
# atışın bitişi: 45..100 arasında bekleme döngüsünün ilk karesine en çok benzeyen kare
sm = lambda f: np.asarray(Image.fromarray(f[ty0:ty1, tx0:tx1]).resize((80, 100))).astype(np.float32)
s0 = sm(fr[IDLE_S]); FIRE_END = min(range(45, 100), key=lambda j: np.abs(sm(fr[j]) - s0).mean())
fire = [cut(fr[i]) for i in range(0, FIRE_END + 1)]; idle = [cut(fr[i]) for i in range(IDLE_S, IDLE_S + IDLE_L)]
allc = fire + idle
X0 = min(np.nonzero(c[..., 3] > 60)[1].min() for c in allc) - 4; X1 = max(np.nonzero(c[..., 3] > 60)[1].max() for c in allc) + 5
Y0 = min(np.nonzero(c[..., 3] > 60)[0].min() for c in allc) - 4; Y1 = max(ty1, max(np.nonzero(c[..., 3] > 60)[0].max() for c in allc) + 1) + 2
X0, Y0, X1, Y1 = max(0, X0), max(0, Y0), min(W, X1), min(H, Y1)
k = TW / (tx1 - tx0); FW, FH = int(round((X1 - X0) * k)), int(round((Y1 - Y0) * k))
Wt, Ht = tx1 - tx0, ty1 - ty0
box = [round(float((X0 - tx0) / Wt), 4), round(float((Y0 - ty0) / Ht), 4), round(float((X1 - tx0) / Wt), 4), round(float((Y1 - ty0) / Ht), 4)]
meta_p = os.path.join(IMG, 'anim.json'); meta = json.load(open(meta_p)); man_p = os.path.join(IMG, 'manifest.json'); man = json.load(open(man_p))
# bırakma noktası: 18. karede güllenin (ağzın üstündeki koyu yuvarlak) yeri, görsel kesri
rp = [0.514, 0.05]
for name, frames, extra in (('tower_artillery_bonemortar_atk', fire, {'rel': round(REL / len(fire), 4), 'relPt': rp}), ('tower_artillery_bonemortar_idle', idle, {'fps': 24})):
    out, cols = video_isle.pack([Image.fromarray(c[Y0:Y1, X0:X1]).resize((FW, FH), Image.LANCZOS) for c in frames], FW, FH)
    out.save(os.path.join(IMG, name + '.webp'), 'WEBP', quality=86, method=6)
    meta[name] = dict({'n': len(frames), 'fw': FW, 'fh': FH, 'tower': True, 'box': box}, **extra)
    if cols: meta[name]['cols'] = cols
    if name + '.webp' not in man: man.append(name + '.webp')
    print(name, meta[name], os.path.getsize(os.path.join(IMG, name + '.webp')) // 1024, 'KB')
print('atış sonu', FIRE_END, 'kule kutusu', (tx0, ty0, tx1, ty1))
json.dump(meta, open(meta_p, 'w'), indent=1); json.dump(sorted(man), open(man_p, 'w'), indent=0)
