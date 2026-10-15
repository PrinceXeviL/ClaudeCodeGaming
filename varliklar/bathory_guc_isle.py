"""Báthory'nin Veo saldırı videosundan (16 Eki; Merlin betiğinden uyarlandı). Eski açıklama: Merlin'in Veo güç videosundan (beyaz zemin, ilk ~2 sn yakın çekim) üç komutan şeridi: _skill (Zaman Kapısı), _cast (yetenek), _idle.
Kamera 48. kareden sonra sabit; bütün şeritler AYNI kutu ve ölçekle kesilir (boy: alev tepesinden sis altına ~674 px), oyunda
sabit görselle (hero_merlin) aynı boyda durur. Işın patlaması kareleri (117-129) kadrajın kenarında kesildiği için atlanır.

    .venv/bin/python varliklar/merlin_veo_isle.py
"""
import json, os, sys
import numpy as np
from PIL import Image
H0 = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, H0)
import video_isle
IMG = os.path.join(H0, '..', 'sinir-kalesi', 'img')
SRC = 'ham/anim/bathory_guc_veo.mp4'
FIG_TOP, FIG_BOT, CX = 78, 671, 600       # bekleme karelerinde taç tepesi, kan dalgası altı ve gövde ortası (video pikseli)
BOX = (CX - 495, 0, CX + 555, 720)         # ortak kesim kutusu (fırlayan kan oku dışarıda kalır)
TARGET = 300                               # figür boyu (şerit pikseli)
SETS = {
    # Kan Gölü: asa kalkar, kalp küresi parlar, ayağında kan girdabı döner, asa yere iner, kan dört yana sıçrar, başlangıç duruşuna döner
    'hero_bathory_skill': list(range(40, 237, 4)),   # 16 Eki: 4 karede bir (oyunda 2 sn'ye sığar: ~25 kare/sn; önce 12,5)
    # yetenek (Kan Bağı, Kan Fedası): asa kalkar, küre parlar, geri iner
    'hero_bathory_cast': list(range(40, 121, 6)) + list(range(120, 39, -8))[1:],
}
ONLY = set(sys.argv[1:])  # 16 Eki: ad verilirse yalnız o şeritler yeniden kesilir


fr = video_isle.frames_of(os.path.join(H0, SRC), 24)
k = TARGET / (FIG_BOT - FIG_TOP); x0, y0, x1, y1 = BOX
FW, FH = int(round((x1 - x0) * k)), int(round((y1 - y0) * k))
meta_p = os.path.join(IMG, 'anim.json'); meta = json.load(open(meta_p)); man_p = os.path.join(IMG, 'manifest.json'); man = json.load(open(man_p))
for name, order in SETS.items():
    if ONLY and name not in ONLY: continue
    video_isle.save_strip(name, [video_isle.remove_white(fr[n])[y0:y1, x0:x1] for n in order], FW, FH, IMG, meta, man,
        {'base': round((y1 - FIG_BOT) / (y1 - y0), 4), 'ch': round((FIG_BOT - FIG_TOP) / (y1 - y0), 4), **({'fps': 24} if name.endswith('_idle') else {})})
json.dump(meta, open(meta_p, 'w'), indent=1); json.dump(sorted(man), open(man_p, 'w'), indent=0)
