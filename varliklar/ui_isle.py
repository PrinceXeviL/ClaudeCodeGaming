"""Gemini arayüz sayfasını (beyaz zemin) parçalara ayırır: mor taş + yeşil rune menü stili (15 Eki, Caner seçti).

    .venv/bin/python varliklar/ui_isle.py            # ham/ui_deneme_a_mor_tas.jpg → sinir-kalesi/img/ui_*.webp

Parçalar (sayfadaki kutular, beyaz zemin silinir; dilim ölçüleri game.js UI_FRAME / UI_3):
  ui_frame     pencere çerçevesi (yatay sütunlarla esnetilir; köşeler, runeler ve kafatası madalyon bozulmaz)
  ui_btn_back  yuvarlak geri düğmesi
  ui_pill      uzun düğme (kızıl iç, yeşil taşlı);  ui_toggle  anahtar yuvası (topuz kodla değil, yuvanın sol ucu aynalanır)
  ui_slider    ses çubuğu (yeşil ışıklı uçlar);  ui_knob  kaydırıcının ışıklı kafatası topuzu
Kızıl-altın deneme (ui_deneme_b_kizil_altin.jpg) kullanılmadı; bu betiğin önceki sürümü git geçmişinde.
"""
import json, os, sys
import numpy as np
from PIL import Image
H0 = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, H0)
from video_isle import remove_white
IMG = os.path.join(H0, '..', 'sinir-kalesi', 'img')
SRC = os.path.join(H0, 'ham', 'ui_deneme_a_mor_tas.jpg')
BOX = {'ui_frame': (72, 56, 1222, 923), 'ui_btn_back': (1454, 455, 1765, 773),
       'ui_pill': (90, 1024, 1037, 1294), 'ui_toggle': (1364, 862, 1793, 1046), 'ui_slider': (1090, 1110, 1954, 1319)}

A = remove_white(np.array(Image.open(SRC).convert('RGB')))
out = {k: A[y0:y1, x0:x1].copy() for k, (x0, y0, x1, y1) in BOX.items()}
for k in ('ui_pill', 'ui_toggle'): # altlarındaki gri gölge: düşük doygunluklu açık pikseller atılır
    p = out[k]; f = p[..., :3].astype(int); p[(f.max(2) - f.min(2) < 16) & (f.min(2) > 150), 3] = 0
# kaydırıcı topuzu: ışıklı kafatası diski (ışığıyla birlikte)
kn = A[1212 - 112:1212 + 112, 1520 - 112:1520 + 112].copy(); kh = kn.shape[0]; yy, xx = np.mgrid[0:kh, 0:kh]
kn[..., 3] = (kn[..., 3] * np.clip((110 - np.hypot(xx - kh / 2, yy - kh / 2)) / 3, 0, 1)).astype(np.uint8); out['ui_knob'] = kn

man_p = os.path.join(IMG, 'manifest.json'); man = json.load(open(man_p)); info = {}
for old in ('ui_btn.webp',):  # kızıl denemeden kalan
    if os.path.exists(os.path.join(IMG, old)): os.remove(os.path.join(IMG, old))
    if old in man: man.remove(old)
for k, v in out.items():
    Image.fromarray(v).save(os.path.join(IMG, k + '.webp'), 'WEBP', quality=90, method=6)
    if k + '.webp' not in man: man.append(k + '.webp')
    info[k] = v.shape[1::-1]
json.dump(sorted(man), open(man_p, 'w'), indent=0)
print(info)
