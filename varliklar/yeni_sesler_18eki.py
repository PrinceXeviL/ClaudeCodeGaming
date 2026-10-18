"""18 Eki: yeni anların ElevenLabs sesleri (elevenlabs_efekt.py ile üretildi) -> sinir-kalesi/ses/<ad>_N.wav + manifest.
Yalnız bu sesleri işler; başka hiçbir ses dosyasına dokunmaz (ses_kayit_isle.py eski varyantları siler, onu çalıştırma).
    .venv/bin/python3 varliklar/yeni_sesler_18eki.py   (sonra gonder.sh paketi kendisi yeniden kurar)"""
import json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from ses_kayit_isle import load_mp3, save, OUT
# ad: (adet, ses düzeyi dB RMS)
NEW = {'teleport': (2, -22), 'tome': (1, -23), 'legion': (1, -19), 'sigfire': (1, -19), 'stickbone': (2, -26), 'bossraise': (1, -18), 'zboom': (2, -20)}
made = [save(f'{n}_{i}', load_mp3(f'{n}_{i}'), db) for n, (c, db) in NEW.items() for i in range(1, c + 1)]
mp = os.path.join(OUT, 'manifest.json'); man = set(json.load(open(mp))) | set(made); json.dump(sorted(man), open(mp, 'w'))
print(len(made), 'ses:', ', '.join(made))
