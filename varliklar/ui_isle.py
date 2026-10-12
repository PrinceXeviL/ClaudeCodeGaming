"""Gemini arayüz sayfasını (beyaz zemin) parçalara ayırır: kızıl-altın menü stili (15 Eki, Caner 2. denemeyi seçti).

    .venv/bin/python varliklar/ui_isle.py            # ham/ui_deneme_b_kizil_altin.jpg → sinir-kalesi/img/ui_*.webp

Parçalar (sayfadaki kutular, beyaz zemin silinir):
  ui_frame   pencere çerçevesi (oyunda 9 dilimle esnetilir; tepe arması ayrı çizilir, dilim ölçüleri game.js UI_FRAME)
  ui_btn     yuvarlak düğme, ortası boş (simge kodla çizilir); ui_btn_back geri oku hazır çizimli
  ui_pill    uzun düğme;  ui_toggle  açık/kapalı anahtarı (kafatası topuzlu);  ui_slider  ses çubuğu (kemik uçlu)
  ui_knob    kaydırıcının kafatası topuzu (ayrı, sürüklenince yer değiştirir)
Sayfanın altındaki oyun içi simge sırası kullanılmaz (Gemini bizim ekran görüntüsünden kopyalamış).
"""
import json, os, sys
import numpy as np
from PIL import Image
H0 = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, H0)
from video_isle import remove_white
IMG = os.path.join(H0, '..', 'sinir-kalesi', 'img')
SRC = os.path.join(H0, 'ham', 'ui_deneme_b_kizil_altin.jpg')
BOX = {'ui_frame': (66, 139, 964, 1214), 'ui_btn_gear': (1020, 253, 1320, 555), 'ui_btn_sound': (1345, 252, 1644, 554), 'ui_btn_back': (1666, 250, 1966, 552),
       'ui_pill': (1050, 621, 1927, 846), 'ui_toggle': (1278, 936, 1706, 1092), 'ui_slider': (1076, 1125, 1902, 1268)}

A = remove_white(np.array(Image.open(SRC).convert('RGB')))
out = {}
for k, (x0, y0, x1, y1) in BOX.items(): out[k] = A[y0 - 2:y1 + 2, x0 - 2:x1 + 2].copy()
# uzun düğmenin altındaki gri gölge: düşük doygunluklu açık pikseller atılır
p = out['ui_pill']; f = p[..., :3].astype(int); grey = (f.max(2) - f.min(2) < 20) & (f.min(2) > 120); p[grey, 3] = 0
# boş yuvarlak düğme: ses düğmesinin ortasındaki simge kızıl kadife diskle örtülür (r <= 93, kenar yumuşak)
b = out['ui_btn_sound'].astype(np.float32); h, w = b.shape[:2]; cy, cx = h / 2, w / 2
yy, xx = np.mgrid[0:h, 0:w]; r = np.hypot(xx - cx, yy - cy); d = np.hypot(xx - (cx - 30), yy - (cy - 36))
t = np.clip(d / 120, 0, 1)[..., None]
col = np.array([150, 34, 58]) * (1 - t) + np.array([62, 14, 30]) * t
m = np.clip((93 - r) / 2.5, 0, 1)[..., None]
b[..., :3] = b[..., :3] * (1 - m) + col * m; b[..., 3] = np.maximum(b[..., 3], m[..., 0] * 255)
out['ui_btn'] = b.astype(np.uint8); del out['ui_btn_sound'], out['ui_btn_gear']
# kaydırıcı topuzu: kafatası diski (çubuğun ortasından kesilir)
kn = A[1196 - 74:1196 + 74, 1460 - 74:1460 + 74].copy(); kh = kn.shape[0]; yy, xx = np.mgrid[0:kh, 0:kh]
kn[..., 3] = (kn[..., 3] * np.clip((70 - np.hypot(xx - kh / 2, yy - kh / 2)) / 2, 0, 1)).astype(np.uint8); out['ui_knob'] = kn

man_p = os.path.join(IMG, 'manifest.json'); man = json.load(open(man_p)); info = {}
for k, v in out.items():
    Image.fromarray(v).save(os.path.join(IMG, k + '.webp'), 'WEBP', quality=90, method=6)
    if k + '.webp' not in man: man.append(k + '.webp')
    info[k] = v.shape[1::-1]
json.dump(sorted(man), open(man_p, 'w'), indent=0)
print(info)
