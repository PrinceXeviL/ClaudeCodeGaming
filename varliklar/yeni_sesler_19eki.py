"""19 Eki: yay germe, arbalet kurma, zırhlı / pati / dev adımları, kule yıkılma (ElevenLabs, elevenlabs_efekt.py) -> sinir-kalesi/ses/<ad>_N.wav + manifest.
Yalnız bu sesleri işler (ses_kayit_isle.py eski varyantları siler, onu çalıştırma).
    .venv/bin/python3 varliklar/yeni_sesler_19eki.py"""
import json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from ses_kayit_isle import load_mp3, save, OUT
NEW = {'bonecrash': (4, -21), 'boneclatter': (3, -24), 'swordarmor': (4, -22), 'horncall': (3, -20), 'wingflap': (4, -26), 'firecrackle': (3, -27), 'shieldblock': (4, -21), 'acidbubble': (3, -27), 'bowdraw': (3, -25), 'xbowload': (3, -25), 'step_armor': (6, -26), 'step_paw': (4, -27), 'step_heavy': (4, -21), 'towercrash': (2, -19)}
made = [save(f'{n}_{i}', load_mp3(f'{n}_{i}'), db) for n, (c, db) in NEW.items() for i in range(1, c + 1)]
mp = os.path.join(OUT, 'manifest.json'); man = set(json.load(open(mp))) | set(made); json.dump(sorted(man), open(mp, 'w'))
print(len(made), 'ses:', ', '.join(made))
