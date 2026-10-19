"""20 Eki: ücretli planda yeniden üretilen ElevenLabs kayıtlarından, işleme betiği olmayan türler (başlık, harita, başarım, sinek, eşya, yıldız)
-> sinir-kalesi/ses/<tür>_N.wav. Ses yüksekliği her dosyanın eski hâline (etkin bölge RMS) eşitlenir; eski dosya önce yedekte (cikti/ses_ucretsiz_yedek_20eki).
    .venv/bin/python3 varliklar/ses_ek_isle_20eki.py"""
import os, sys, glob, wave
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from ses_kayit_isle import load_mp3, save, OUT
from elevenlabs_isle import act_rms
KINDS = ['achieve', 'flybuzz', 'flyswarm', 'gearon', 'mapfly', 'starchime', 'titlego', 'titlesoft']
for k in KINDS:
    for p in sorted(glob.glob(os.path.join(OUT, k + '_[0-9]*.wav'))):
        n = os.path.basename(p)[:-4]
        if not os.path.exists(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'ham', 'ses', 'eleven', n + '.mp3')): print('ham yok:', n); continue
        with wave.open(p) as w: db = act_rms(np.frombuffer(w.readframes(w.getnframes()), '<i2') / 32768)
        x = load_mp3(n); L = len(x); f = min(int(L * 0.15), 4410)
        if f > 0: x[-f:] *= np.linspace(1, 0, f)
        save(n, x, round(db, 1)); print(n, round(db, 1), 'dB')
